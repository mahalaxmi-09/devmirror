import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { query } from '../db/connection.js';
import authMiddleware from '../middleware/auth.js';
import { runInSandbox } from '../services/sandbox.js';
import { runDebugAgent } from '../services/agent.js';
import { recordEvent, setMissionStatus, MISSION_STATUS } from '../services/agentEvents.js';
import { createWorkspace, shouldIgnoreEntry, syncFilesToWorkspace, writeWorkspaceFile } from '../services/workspace.js';

import { BACKEND_ROOT } from '../config/env.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(BACKEND_ROOT, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Helper to create agent events
async function logAgentEvent(missionId, agentName, message, eventType = 'info', status = 'success') {
  await query(
    'INSERT INTO agent_events (mission_id, agent_name, message, event_type, status) VALUES ($1, $2, $3, $4, $5)',
    [missionId, agentName, message, eventType, status]
  );
}

// Upload evidence file (ZIP, Source, or screenshot)
router.post('/:id/upload-evidence', authMiddleware, upload.single('file'), async (req, res) => {
  const { id } = req.params;
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  try {
    const missionCheck = await query('SELECT id FROM missions WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (missionCheck.rows.length === 0) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(404).json({ error: 'Mission not found.' });
    }

    const filename = file.originalname;
    const filepath = file.path;
    const ext = path.extname(filename).toLowerCase();

    // 1. If it's a zip archive
    if (ext === '.zip') {
      await logAgentEvent(id, 'ORCHESTRATOR', `Processing project ZIP archive: ${filename}`, 'evidence', 'success');
      
      const zip = new AdmZip(filepath);
      const zipEntries = zip.getEntries();
      let fileCount = 0;

      for (const entry of zipEntries) {
        if (entry.isDirectory) continue;
        
        const entryName = entry.entryName.replace(/\\/g, '/');
        if (entryName.includes('..') || path.isAbsolute(entryName) || shouldIgnoreEntry(entryName)) {
          continue;
        }

        // Check if it's a text/code file
        const fileExt = path.extname(entryName).toLowerCase();
        const textExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.json', '.toml', '.html', '.css', '.md', '.go', '.rs', '.sql', '.yaml', '.yml', '.txt'];
        if (!textExtensions.includes(fileExt) && !entryName.endsWith('Dockerfile') && !entryName.endsWith('package.json')) {
          continue;
        }

        const fileContent = entry.getData().toString('utf8');
        createWorkspace(id);
        try { writeWorkspaceFile(id, entryName, fileContent); } catch { continue; }

        const existing = await query('SELECT id FROM mission_files WHERE mission_id = $1 AND filename = $2', [id, entryName]);
        if (existing.rows.length > 0) {
          await query('UPDATE mission_files SET file_content = $1 WHERE id = $2', [fileContent, existing.rows[0].id]);
        } else {
          await query('INSERT INTO mission_files (mission_id, filename, file_content, is_original) VALUES ($1, $2, $3, 1)', [id, entryName, fileContent]);
        }
        fileCount++;
      }

      // Cleanup uploaded zip temp file
      fs.unlinkSync(filepath);

      await recordEvent(id, 'evidence_received', `Successfully extracted and loaded ${fileCount} files from ZIP.`, { fileCount });
      await setMissionStatus(id, MISSION_STATUS.COLLECTING_EVIDENCE);
      await logAgentEvent(id, 'ORCHESTRATOR', `Successfully extracted and loaded ${fileCount} files from ZIP.`, 'evidence', 'success');
      return res.json({ success: true, type: 'zip', fileCount, message: `Loaded ${fileCount} project files.` });
    }
    
    // 2. If it's an image screenshot
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
    if (imageExtensions.includes(ext)) {
      const publicPath = `/uploads/${path.basename(filepath)}`;
      await query('UPDATE missions SET screenshot_path = $1 WHERE id = $2', [publicPath, id]);
      await recordEvent(id, 'evidence_received', `Screenshot uploaded: ${filename}`, { type: 'image' });
      await setMissionStatus(id, MISSION_STATUS.COLLECTING_EVIDENCE);
      await logAgentEvent(id, 'ORCHESTRATOR', `Screenshot uploaded: ${filename}`, 'evidence', 'success');
      return res.json({ success: true, type: 'image', path: publicPath, message: 'Screenshot added.' });
    }

    // 3. Otherwise treat it as a single source file upload (text)
    const textExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.json', '.toml', '.html', '.css', '.md', '.go', '.rs', '.sql', '.yaml', '.yml', '.txt'];
    if (textExtensions.includes(ext) || filename.endsWith('Dockerfile') || filename === 'package.json') {
      const fileContent = fs.readFileSync(filepath, 'utf8');
      
      // Store/update file in DB
      const existing = await query('SELECT id FROM mission_files WHERE mission_id = $1 AND filename = $2', [id, filename]);
      if (existing.rows.length > 0) {
        await query('UPDATE mission_files SET file_content = $1 WHERE id = $2', [fileContent, existing.rows[0].id]);
      } else {
        await query('INSERT INTO mission_files (mission_id, filename, file_content, is_original) VALUES ($1, $2, $3, 1)', [id, filename, fileContent]);
      }

      createWorkspace(id);
      writeWorkspaceFile(id, filename, fileContent);
      fs.unlinkSync(filepath);

      await recordEvent(id, 'evidence_received', `Source file uploaded: ${filename}`, { filename });
      await setMissionStatus(id, MISSION_STATUS.COLLECTING_EVIDENCE);
      await logAgentEvent(id, 'ORCHESTRATOR', `Source file uploaded: ${filename}`, 'evidence', 'success');
      return res.json({ success: true, type: 'file', message: `Source file ${filename} added.` });
    }

    // If not supported
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    return res.status(400).json({ error: `File type '${ext}' not supported for code analysis.` });

  } catch (error) {
    console.error('File upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to process file upload: ' + error.message });
  }
});

// 1. Create a debug mission
router.post('/', authMiddleware, async (req, res) => {
  const { voice_transcript, problem_description, input_mode = 'text', isDemo, language = 'javascript' } = req.body;
  const description = String(problem_description || voice_transcript || '').trim();
  if (!description) {
    return res.status(400).json({ error: 'NEEDS MORE EVIDENCE', message: 'A problem description is required.' });
  }

  try {
    const missionRes = await query(
      'INSERT INTO missions (user_id, voice_transcript, status, language, input_mode) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.id, description, MISSION_STATUS.CREATED, language, input_mode]
    );
    const missionId = missionRes.rows[0].id;
    const missionFetch = await query('SELECT * FROM missions WHERE id = $1', [missionId]);
    const mission = missionFetch.rows[0] || missionRes.rows[0];

    await recordEvent(mission.id, 'mission_created', `Initialized debugging session #DM-${mission.id}`, { agentName: 'ORCHESTRATOR', input_mode });
    await logAgentEvent(mission.id, 'ORCHESTRATOR', 'Ready to accept code evidence.', 'status', 'success');
    createWorkspace(mission.id);

    // If it's a demo, load the broken authHelper files automatically
    if (isDemo) {
      console.log(`Setting up Demo Project files for Mission #${mission.id}...`);
      const demoDir = path.join(BACKEND_ROOT, 'demo_project');
      
      const fileNames = ['package.json', 'authHelper.js', 'test.js'];
      for (const name of fileNames) {
        const content = fs.readFileSync(path.join(demoDir, name), 'utf8');
        await query(
          'INSERT INTO mission_files (mission_id, filename, file_content, is_original) VALUES ($1, $2, $3, $4)',
          [mission.id, name, content, 1]
        );
      }
      
      await recordEvent(mission.id, 'evidence_received', 'Project files loaded from demo_project directory.', { files: fileNames });
      await setMissionStatus(mission.id, MISSION_STATUS.COLLECTING_EVIDENCE);
      const loaded = fileNames.map((name) => ({
        filename: name,
        file_content: fs.readFileSync(path.join(demoDir, name), 'utf8')
      }));
      syncFilesToWorkspace(mission.id, loaded);
    }

    res.status(201).json(mission);
  } catch (error) {
    console.error('Error creating mission:', error);
    res.status(500).json({ error: 'Failed to initialize mission.' });
  }
});

// 2. List user missions
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Query missions with file count and attempts count
    const result = await query(
      `SELECT m.*, 
       (SELECT COUNT(*) FROM mission_files WHERE mission_id = m.id) as file_count,
       (SELECT COUNT(*) FROM test_runs WHERE mission_id = m.id) as attempts_count
       FROM missions m 
       WHERE m.user_id = $1 
       ORDER BY m.id DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error listing missions:', error);
    res.status(500).json({ error: 'Failed to list missions.' });
  }
});

// 3. Get mission detail
router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const missionRes = await query('SELECT * FROM missions WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (missionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Mission not found.' });
    }
    const mission = missionRes.rows[0];

    // Fetch related files
    const filesRes = await query('SELECT id, filename, file_content, is_original FROM mission_files WHERE mission_id = $1', [id]);
    
    // Fetch related events
    const eventsRes = await query('SELECT * FROM agent_events WHERE mission_id = $1 ORDER BY timestamp ASC', [id]);

    // Fetch related patches/code changes
    const changesRes = await query('SELECT * FROM code_changes WHERE mission_id = $1', [id]);

    // Fetch related test runs
    const testRunsRes = await query('SELECT * FROM test_runs WHERE mission_id = $1 ORDER BY attempt_number ASC', [id]);

    res.json({
      ...mission,
      files: filesRes.rows,
      events: eventsRes.rows,
      changes: changesRes.rows,
      test_runs: testRunsRes.rows
    });
  } catch (error) {
    console.error('Error getting mission detail:', error);
    res.status(500).json({ error: 'Failed to retrieve mission details.' });
  }
});

// 4. Upload evidence file
router.post('/:id/files', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { filename, file_content } = req.body;

  if (!filename || file_content === undefined) {
    return res.status(400).json({ error: 'Filename and file_content are required.' });
  }

  try {
    const missionCheck = await query('SELECT id FROM missions WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (missionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Mission not found.' });
    }

    // Insert or update file
    const existingFile = await query('SELECT id FROM mission_files WHERE mission_id = $1 AND filename = $2', [id, filename]);
    
    if (existingFile.rows.length > 0) {
      await query(
        'UPDATE mission_files SET file_content = $1 WHERE id = $2',
        [file_content, existingFile.rows[0].id]
      );
    } else {
      await query(
        'INSERT INTO mission_files (mission_id, filename, file_content, is_original) VALUES ($1, $2, $3, 1)',
        [id, filename, file_content]
      );
    }

    createWorkspace(id);
    writeWorkspaceFile(id, filename, file_content);
    await recordEvent(id, 'evidence_received', `Evidence uploaded: ${filename}`, { filename });
    await setMissionStatus(id, MISSION_STATUS.COLLECTING_EVIDENCE);
    await logAgentEvent(id, 'ORCHESTRATOR', `Evidence uploaded: ${filename}`, 'evidence', 'success');

    res.status(201).json({ success: true, message: 'Evidence file uploaded.' });
  } catch (error) {
    console.error('Error saving evidence file:', error);
    res.status(500).json({ error: 'Failed to upload evidence.' });
  }
});

// 5. Delete an evidence file
router.delete('/:id/files/:fileId', authMiddleware, async (req, res) => {
  const { id, fileId } = req.params;

  try {
    const missionCheck = await query('SELECT id FROM missions WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (missionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Mission not found.' });
    }

    const fileCheck = await query('SELECT filename FROM mission_files WHERE id = $1 AND mission_id = $2', [fileId, id]);
    if (fileCheck.rows.length === 0) {
      return res.status(404).json({ error: 'File not found.' });
    }

    await query('DELETE FROM mission_files WHERE id = $1', [fileId]);
    await logAgentEvent(id, 'ORCHESTRATOR', `Evidence removed: ${fileCheck.rows[0].filename}`, 'evidence', 'info');

    res.json({ success: true, message: 'File deleted.' });
  } catch (error) {
    console.error('Error deleting evidence file:', error);
    res.status(500).json({ error: 'Failed to delete evidence.' });
  }
});

async function investigateHandler(req, res) {
  const { id } = req.params;
  try {
    const missionCheck = await query('SELECT id FROM missions WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (missionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Mission not found.' });
    }
    const result = await runDebugAgent(id);
    const statusCode = result.status === 'NEEDS_INPUT' ? 400 : 200;
    res.status(statusCode).json(result);
  } catch (error) {
    console.error('Investigation error:', error);
    res.status(500).json({ error: 'Failed to investigate: ' + error.message });
  }
}

router.post('/:id/investigate', authMiddleware, investigateHandler);
router.post('/:id/analyze', authMiddleware, investigateHandler);

router.get('/:id/events', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const missionCheck = await query('SELECT id FROM missions WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (missionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Mission not found.' });
    }
    const eventsRes = await query('SELECT * FROM agent_events WHERE mission_id = $1 ORDER BY timestamp ASC, id ASC', [id]);
    res.json(eventsRes.rows);
  } catch (error) {
    console.error('Events error:', error);
    res.status(500).json({ error: 'Failed to load events.' });
  }
});

// 7. Verify / Debug Execution (Applies the patch and executes sandbox runs)
router.post('/:id/debug', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const missionRes = await query('SELECT * FROM missions WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (missionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Mission not found.' });
    }

    const changesRes = await query('SELECT * FROM code_changes WHERE mission_id = $1 AND status = $2', [id, 'PENDING']);
    if (changesRes.rows.length === 0) {
      return res.status(400).json({ error: 'No pending patch found. Run analysis first.' });
    }
    const patch = changesRes.rows[0];

    // Load original files
    const filesRes = await query('SELECT filename, file_content FROM mission_files WHERE mission_id = $1', [id]);
    const files = filesRes.rows;

    // Construct code set with applied patch
    const patchedFiles = files.map(file => {
      if (file.filename === patch.filename) {
        return { filename: file.filename, file_content: patch.after_content };
      }
      return file;
    });

    await logAgentEvent(id, 'CODE AGENT', `Applying generated patch to isolated sandbox directory...`, 'patch', 'success');
    await logAgentEvent(id, 'TEST AGENT', `Running test command: npm test`, 'test', 'success');

    // Execute Sandbox verification
    const attemptCountRes = await query('SELECT COUNT(*) as count FROM test_runs WHERE mission_id = $1', [id]);
    const nextAttempt = parseInt(attemptCountRes.rows[0].count) + 1;

    const sandboxResult = await runInSandbox(id, patchedFiles, 'npm test');
    
    // Save run outcome
    await query(
      'INSERT INTO test_runs (mission_id, attempt_number, stdout, stderr, exit_code, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, nextAttempt, sandboxResult.stdout, sandboxResult.stderr, sandboxResult.exitCode, sandboxResult.success ? 'PASSED' : 'FAILED']
    );

    if (sandboxResult.success) {
      await logAgentEvent(id, 'VERIFICATION AGENT', `Verification Succeeded: All tests passed on Attempt ${nextAttempt}.`, 'verify', 'success');
      
      // Permanently update file in database (since it is successfully fixed!)
      await query(
        'UPDATE mission_files SET file_content = $1, is_original = 0 WHERE mission_id = $2 AND filename = $3',
        [patch.after_content, id, patch.filename]
      );
      
      // Update patch status
      await query('UPDATE code_changes SET status = $1 WHERE id = $2', ['APPLIED', patch.id]);

      // Update mission status
      await query('UPDATE missions SET status = $1 WHERE id = $2', ['VERIFIED_FIXED', id]);
    } else {
      await logAgentEvent(id, 'VERIFICATION AGENT', `Verification Failed: Exit code ${sandboxResult.exitCode} on Attempt ${nextAttempt}.`, 'verify', 'danger');
      await query('UPDATE missions SET status = $1 WHERE id = $2', ['FAILED', id]);
    }

    res.json({
      success: sandboxResult.success,
      attempt: nextAttempt,
      stdout: sandboxResult.stdout,
      stderr: sandboxResult.stderr,
      exitCode: sandboxResult.exitCode
    });

  } catch (error) {
    console.error('Debug verify execution error:', error);
    res.status(500).json({ error: 'Sandbox execution failed: ' + error.message });
  }
});

export default router;
