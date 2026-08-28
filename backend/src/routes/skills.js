import express from 'express';
import { query } from '../db/connection.js';
import authMiddleware from '../middleware/auth.js';
import { evaluateSession } from '../services/gemini.js';

const router = express.Router();

// 1. Analyze and save SkillMirror results for a completed mission
router.post('/missions/:id/mirror', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    // Check mission status
    const missionRes = await query('SELECT * FROM missions WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (missionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Mission not found.' });
    }
    const mission = missionRes.rows[0];

    if (mission.status !== 'VERIFIED_FIXED') {
      return res.status(400).json({ error: 'SkillMirror activates only after the debugging session is completed.' });
    }

    // Check if session is already mirrored
    const existingSession = await query('SELECT id FROM skill_sessions WHERE mission_id = $1', [id]);
    if (existingSession.rows.length > 0) {
      // Fetch details and return them
      const session = existingSession.rows[0];
      const signals = await query('SELECT * FROM skill_signals WHERE skill_session_id = $1', [session.id]);
      return res.json(signals.rows[0]);
    }

    // Load logs for Gemini evaluation
    const filesRes = await query('SELECT filename FROM mission_files WHERE mission_id = $1', [id]);
    const runsRes = await query('SELECT * FROM test_runs WHERE mission_id = $1', [id]);
    const changesRes = await query('SELECT filename, before_content, after_content FROM code_changes WHERE mission_id = $1', [id]);

    console.log(`Calculating SkillMirror signals for completed Mission #${id}...`);
    const evalResults = await evaluateSession(
      mission.voice_transcript,
      filesRes.rows,
      runsRes.rows,
      changesRes.rows
    );

    // Save Session
    const sessionInsert = await query(
      'INSERT INTO skill_sessions (mission_id, user_id) VALUES ($1, $2) RETURNING id',
      [id, req.user.id]
    );
    const sessionId = sessionInsert.rows[0].id;

    // Save Skill Signals
    const notesText = JSON.stringify({
      communication_evidence: evalResults.communication_evidence,
      problem_solving_evidence: evalResults.problem_solving_evidence,
      debugging_evidence: evalResults.debugging_evidence,
      technical_understanding_evidence: evalResults.technical_understanding_evidence,
      independent_reasoning_evidence: evalResults.independent_reasoning_evidence,
      strongest_area: evalResults.strongest_area,
      development_area: evalResults.development_area,
      why: evalResults.why
    });

    const signalRes = await query(
      `INSERT INTO skill_signals 
       (skill_session_id, communication, problem_solving, debugging, technical_understanding, independent_reasoning, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [
        sessionId, 
        evalResults.skills.communication, 
        evalResults.skills.problem_solving, 
        evalResults.skills.debugging, 
        evalResults.skills.technical_understanding, 
        evalResults.skills.independent_reasoning, 
        notesText
      ]
    );

    // Save Challenge recommendation
    if (evalResults.challenge) {
      await query(
        `INSERT INTO skill_challenges 
         (user_id, title, description, code_language, initial_code, test_code, bug_description, mode, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          req.user.id,
          evalResults.challenge.title,
          evalResults.challenge.description,
          evalResults.challenge.code_language || 'javascript',
          evalResults.challenge.initial_code,
          evalResults.challenge.test_code,
          evalResults.challenge.bug_description,
          'GUIDED',
          'AVAILABLE'
        ]
      );
    }

    res.status(201).json(signalRes.rows[0]);

  } catch (error) {
    console.error('Error generating SkillMirror:', error);
    res.status(500).json({ error: 'Failed to generate SkillMirror analysis.' });
  }
});

// 2. Fetch SkillMirror results for a completed mission
router.get('/missions/:id/mirror', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const sessionRes = await query('SELECT id FROM skill_sessions WHERE mission_id = $1 AND user_id = $2', [id, req.user.id]);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'No SkillMirror session found for this mission.' });
    }

    const signals = await query('SELECT * FROM skill_signals WHERE skill_session_id = $1', [sessionRes.rows[0].id]);
    res.json(signals.rows[0]);
  } catch (error) {
    console.error('Error fetching SkillMirror:', error);
    res.status(500).json({ error: 'Failed to fetch SkillMirror.' });
  }
});

// 3. Aggregate user skill metrics and trends
router.get('/skills', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT ss.completed_at, s.* 
       FROM skill_sessions ss
       JOIN skill_signals s ON s.skill_session_id = ss.id
       WHERE ss.user_id = $1 
       ORDER BY ss.completed_at ASC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching dashboard progress:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard skill tracking.' });
  }
});

// 4. Fetch challenges
router.get('/challenges', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM skill_challenges WHERE user_id = $1 ORDER BY id DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching challenges:', error);
    res.status(500).json({ error: 'Failed to retrieve challenges.' });
  }
});

// 5. Start a challenge as a debug mission
router.post('/challenges/:id/start', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { mode = 'GUIDED' } = req.body;

  try {
    const challengeRes = await query('SELECT * FROM skill_challenges WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (challengeRes.rows.length === 0) {
      return res.status(404).json({ error: 'Challenge not found.' });
    }
    const challenge = challengeRes.rows[0];

    // Create a new mission based on the challenge files
    const missionRes = await query(
      'INSERT INTO missions (user_id, voice_transcript, status, language) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, `Challenge: ${challenge.title}. ${challenge.description}`, 'INVESTIGATING', challenge.code_language]
    );
    const mission = missionRes.rows[0];

    // Write initial challenge code files
    await query(
      'INSERT INTO mission_files (mission_id, filename, file_content, is_original) VALUES ($1, $2, $3, $4)',
      [mission.id, 'index.js', challenge.initial_code, 1]
    );
    
    await query(
      'INSERT INTO mission_files (mission_id, filename, file_content, is_original) VALUES ($1, $2, $3, $4)',
      [mission.id, 'test.js', challenge.test_code, 1]
    );

    // Write package.json for standard execute test
    const pkgJson = JSON.stringify({
      name: "devmirror-challenge",
      version: "1.0.0",
      scripts: { test: "node test.js" }
    }, null, 2);
    
    await query(
      'INSERT INTO mission_files (mission_id, filename, file_content, is_original) VALUES ($1, $2, $3, $4)',
      [mission.id, 'package.json', pkgJson, 1]
    );

    // Update challenge status
    await query('UPDATE skill_challenges SET status = $1, mode = $2 WHERE id = $3', ['STARTED', mode, id]);

    // Add agent logs
    await query(
      'INSERT INTO agent_events (mission_id, agent_name, message, event_type, status) VALUES ($1, $2, $3, $4, $5)',
      [mission.id, 'ORCHESTRATOR', `Challenge mission #${mission.id} initialized in ${mode} mode.`, 'init', 'success']
    );

    res.status(201).json({ mission, challenge });
  } catch (error) {
    console.error('Error starting challenge:', error);
    res.status(500).json({ error: 'Failed to start challenge.' });
  }
});

// 6. Fetch Skill History list for User
router.get('/skills/history', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT ss.id as session_id, ss.completed_at, m.id as mission_id, m.voice_transcript, m.status, m.language,
       s.communication, s.problem_solving, s.debugging, s.technical_understanding, s.independent_reasoning, s.notes
       FROM skill_sessions ss
       JOIN missions m ON ss.mission_id = m.id
       JOIN skill_signals s ON s.skill_session_id = ss.id
       WHERE ss.user_id = $1
       ORDER BY ss.completed_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching skill history:', error);
    res.status(500).json({ error: 'Failed to fetch skill history.' });
  }
});

// 7. Explain It Back submission endpoint
router.post('/missions/:id/explain', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { user_explanation } = req.body;

  if (!user_explanation) {
    return res.status(400).json({ error: 'User explanation is required.' });
  }

  try {
    // 1. Fetch skill session details
    const sessionRes = await query(
      'SELECT id FROM skill_sessions WHERE mission_id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'SkillMirror session not active for this mission yet.' });
    }
    const sessionId = sessionRes.rows[0].id;

    // 2. Fetch diagnosis code patch details to evaluate against
    const changesRes = await query('SELECT filename, after_content FROM code_changes WHERE mission_id = $1', [id]);
    const patch = changesRes.rows[0];
    const rootCauseText = patch ? `Modified ${patch.filename}` : "Code bug patch";
    const patchedCode = patch ? patch.after_content : "";

    // 3. Evaluate using gemini helper
    const { evaluateExplanation } = await import('../services/gemini.js');
    const evaluation = await evaluateExplanation(user_explanation, rootCauseText, patchedCode);

    // 4. Update skill signals notes to store feedback and user answers
    const signalRes = await query('SELECT * FROM skill_signals WHERE skill_session_id = $1', [sessionId]);
    const signal = signalRes.rows[0];
    
    let notes = {};
    if (signal && signal.notes) {
      try {
        notes = JSON.parse(signal.notes);
      } catch (e) {
        notes = { legacy_notes: signal.notes };
      }
    }

    notes.user_explanation = user_explanation;
    notes.explanation_rating = evaluation.rating;
    notes.explanation_feedback = evaluation.feedback;

    await query(
      'UPDATE skill_signals SET notes = $1 WHERE id = $2',
      [JSON.stringify(notes), signal.id]
    );

    res.json({
      rating: evaluation.rating,
      feedback: evaluation.feedback
    });

  } catch (error) {
    console.error('Error evaluating explanation:', error);
    res.status(500).json({ error: 'Failed to submit explanation.' });
  }
});

// 8. Save Presentation webcam signals
router.post('/missions/:id/presentation', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { fluency, engagement, composure, notes } = req.body;

  try {
    const sessionRes = await query(
      'SELECT id FROM skill_sessions WHERE mission_id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'SkillMirror session not active for this mission.' });
    }
    const sessionId = sessionRes.rows[0].id;

    // Insert or update presentation details
    const existing = await query('SELECT id FROM presentation_sessions WHERE skill_session_id = $1', [sessionId]);
    
    if (existing.rows.length > 0) {
      await query(
        'UPDATE presentation_sessions SET fluency = $1, engagement = $2, composure = $3, notes = $4 WHERE id = $5',
        [fluency, engagement, composure, notes, existing.rows[0].id]
      );
    } else {
      await query(
        'INSERT INTO presentation_sessions (skill_session_id, fluency, engagement, composure, notes) VALUES ($1, $2, $3, $4, $5)',
        [sessionId, fluency, engagement, composure, notes]
      );
    }

    res.json({ success: true, message: 'Presentation signals saved.' });
  } catch (error) {
    console.error('Error saving presentation details:', error);
    res.status(500).json({ error: 'Failed to record presentation signals.' });
  }
});

export default router;
