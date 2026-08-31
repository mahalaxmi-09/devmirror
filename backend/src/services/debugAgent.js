import fs from 'fs';
import path from 'path';
import { query } from '../db/connection.js';
import { getAIProvider } from '../ai/providerFactory.js';
import { getAIProviderName } from '../config/env.js';
import { BACKEND_ROOT } from '../config/env.js';
import { recordEvent, setMissionStatus, MISSION_STATUS } from './agentEvents.js';
import { executeTool, getLastExecution } from './debugTools.js';
import { createWorkspace, syncFilesToWorkspace } from './workspace.js';
import { AIProviderError } from '../ai/provider.js';

const MAX_TURNS = 22;

function inferExpected(description) {
  const text = String(description || '');
  const m = text.match(/should be\s+([^\s.]+)/i) || text.match(/expected[:\s]+([^\n]+)/i);
  return m ? m[1].trim() : text;
}

function hasEnoughEvidence(mission, files) {
  const desc = String(mission.voice_transcript || '').trim();
  const vague = /^(my (website|app|code|program) (is )?(broken|not working)|it('s| is) broken)\.?$/i;
  const hasCode = files.some((f) => !['error.log'].includes(f.filename));
  const hasLog = files.some((f) => /log|stack|error/i.test(f.filename));
  const hasShot = Boolean(mission.screenshot_path);
  if (!desc) return false;
  if (vague.test(desc) && !hasCode && !hasLog && !hasShot) return false;
  return hasCode || hasLog || hasShot || desc.length > 40;
}

function loadScreenshot(mission) {
  if (!mission.screenshot_path) return [];
  const relative = mission.screenshot_path.replace(/^\//, '');
  const candidates = [
    path.join(process.cwd(), relative),
    path.join(BACKEND_ROOT, relative),
    path.join(BACKEND_ROOT, 'uploads', path.basename(relative))
  ];
  for (const abs of candidates) {
    if (fs.existsSync(abs)) {
      const ext = path.extname(abs).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      return [{ mimeType: mime, data: fs.readFileSync(abs).toString('base64') }];
    }
  }
  return [];
}

function buildUserPrompt(mission, files, meta) {
  return `MISSION ${mission.id}
This mission is isolated. Ignore any other missions.

Problem description:
${mission.voice_transcript}

Input mode: ${mission.input_mode || 'text'}
Language hint from user (do not assume it is correct): ${mission.language || 'unknown'}
Screenshot attached: ${mission.screenshot_path ? 'yes (inspect the image)' : 'no'}

Workspace files currently available:
${files.map((f) => `- ${f.filename}`).join('\n') || '(none yet)'}

Project inspection will be done with tools. Do not invent additional files.

Use tools to:
1. inspect_project
2. read/search the actual source
3. reproduce by running the original program (for JS: node <file>)
4. identify root cause from evidence
5. apply_patch with exact before/after from the file
6. run the program again
7. verify_result with the user's expected behavior

Expected behavior from the user (parse carefully, do not invent):
${inferExpected(mission.voice_transcript)}

Provider: ${meta.provider}
Model: ${meta.model}
`;
}

async function persistPatchedFiles(missionId) {
  const filesRes = await query('SELECT filename FROM mission_files WHERE mission_id = $1', [missionId]);
  for (const row of filesRes.rows) {
    try {
      const result = await executeTool('read_file', { path: row.filename }, missionId);
      if (result.raw != null) {
        await query(
          'UPDATE mission_files SET file_content = $1, is_original = 0 WHERE mission_id = $2 AND filename = $3',
          [result.raw, missionId, row.filename]
        );
      }
    } catch {
      /* ignore missing */
    }
  }
}

export async function runDebugAgent(missionId) {
  const missionRes = await query('SELECT * FROM missions WHERE id = $1', [missionId]);
  if (missionRes.rows.length === 0) throw new Error('Mission not found');
  const mission = missionRes.rows[0];

  const filesRes = await query('SELECT filename, file_content FROM mission_files WHERE mission_id = $1', [missionId]);
  const files = filesRes.rows;

  await recordEvent(missionId, 'mission_created', `Mission ${missionId} debugging session started.`, { agentName: 'ORCHESTRATOR' });

  if (!hasEnoughEvidence(mission, files)) {
    await setMissionStatus(missionId, MISSION_STATUS.NEEDS_INPUT);
    const message = 'I need more evidence to investigate this. Please upload the project, screenshot, browser console error, or relevant code.';
    await recordEvent(missionId, 'needs_input', message, { agentName: 'ORCHESTRATOR', level: 'info' });
    return { success: false, status: 'NEEDS_INPUT', error: 'NEEDS MORE EVIDENCE', message };
  }

  await recordEvent(missionId, 'evidence_received', `Evidence loaded: ${files.length} file(s).`, { files: files.map((f) => f.filename) });
  createWorkspace(missionId);
  syncFilesToWorkspace(missionId, files);

  let provider;
  try {
    provider = getAIProvider();
  } catch (err) {
    await setMissionStatus(missionId, MISSION_STATUS.FAILED);
    await recordEvent(missionId, 'provider_error', 'AI SERVICE UNAVAILABLE', { level: 'error', provider: getAIProviderName() });
    return { success: false, status: 'FAILED', error: 'AI SERVICE UNAVAILABLE', provider: getAIProviderName() };
  }

  await recordEvent(missionId, 'gemini_started', `Provider ${provider.name} started.`, { provider: provider.name, model: provider.model });
  await setMissionStatus(missionId, MISSION_STATUS.ANALYZING);

  const context = {
    missionId,
    userId: mission.user_id,
    problemDescription: mission.voice_transcript,
    expectedBehavior: inferExpected(mission.voice_transcript),
    actualBehavior: null,
    evidence: files.map((f) => f.filename),
    projectMetadata: {},
    conversation: [],
    toolHistory: [],
    executionHistory: [],
    images: loadScreenshot(mission),
    userPrompt: buildUserPrompt(mission, files, { provider: provider.name, model: provider.model }),
    providerState: null
  };

  let toolResults = [];
  let lastPatch = null;
  let verified = false;
  let needsInput = null;
  let lastMessage = '';
  let reproduced = false;

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = turn === 0 && toolResults.length === 0
        ? await provider.startDebugSession(context)
        : await provider.continueDebugSession(context, toolResults);

      toolResults = [];
      lastMessage = response.message || lastMessage;
      context.conversation.push({ turn, type: response.type, message: response.message, tool: response.tool });

      if (response.type === 'final' && context.toolHistory.length === 0 && turn < 2) {
        const nudge = 'You must use tools. Inspect the workspace, run the original program to reproduce the bug, apply a minimal exact patch, run it again, then call verify_result. Do not guess and do not claim success without execution evidence.';
        if (Array.isArray(context.providerState?.contents)) {
          context.providerState.contents.push({ role: 'user', parts: [{ text: nudge }] });
        } else {
          context.providerState.pendingInput = [{
            role: 'user',
            content: [{ type: 'input_text', text: nudge }]
          }];
        }
        continue;
      }

      if (response.type === 'tool_call') {
        const calls = response.toolCalls?.length ? response.toolCalls : [{ tool: response.tool, toolArguments: response.toolArguments, id: response.id }];
        for (const call of calls) {
          if (call.tool === 'run_command' || call.tool === 'run_tests') {
            if (!reproduced) {
              await setMissionStatus(missionId, MISSION_STATUS.REPRODUCING);
            } else {
              await setMissionStatus(missionId, MISSION_STATUS.EXECUTING);
            }
          }
          if (call.tool === 'apply_patch') {
            await recordEvent(missionId, 'patch_generated', 'Patch proposed by model.', { file: call.toolArguments?.file });
            await setMissionStatus(missionId, MISSION_STATUS.PATCH_READY);
          }
          if (['inspect_project', 'read_file', 'search_code'].includes(call.tool)) {
            await setMissionStatus(missionId, reproduced ? MISSION_STATUS.INVESTIGATING : MISSION_STATUS.ANALYZING);
          }

          const result = await executeTool(call.tool, call.toolArguments || {}, missionId);
          context.toolHistory.push({ tool: call.tool, arguments: call.toolArguments, result });
          if (call.tool === 'run_command' || call.tool === 'run_tests') {
            context.executionHistory.push(result);
            if (!reproduced) {
              reproduced = true;
              await recordEvent(missionId, 'problem_reproduced', 'Original program executed.', {
                stdout: (result.stdout || '').slice(0, 800),
                exitCode: result.exitCode
              });
            }
          }
          if (call.tool === 'apply_patch' && result.success) {
            lastPatch = { file: call.toolArguments.file, before: call.toolArguments.before, after: call.toolArguments.after, reason: call.toolArguments.reason };
            await query('DELETE FROM code_changes WHERE mission_id = $1', [missionId]);
            await query(
              'INSERT INTO code_changes (mission_id, filename, before_content, after_content, status) VALUES ($1, $2, $3, $4, $5)',
              [missionId, lastPatch.file, lastPatch.before, lastPatch.after, 'APPLIED']
            );
          }
          if (call.tool === 'verify_result' && result.status === 'PASS') {
            verified = true;
          }
          toolResults.push({ tool: call.tool, result, id: call.id || call.tool });
        }
        if (verified) break;
        continue;
      }

      if (response.type === 'question') {
        needsInput = response.message;
        break;
      }

      if (response.type === 'diagnosis') {
        await setMissionStatus(missionId, MISSION_STATUS.DIAGNOSIS_READY);
        await recordEvent(missionId, 'root_cause_identified', response.message || 'Diagnosis recorded.', {});
        continue;
      }

      if (response.type === 'patch') {
        await setMissionStatus(missionId, MISSION_STATUS.PATCH_READY);
        continue;
      }

      if (response.type === 'final') {
        const last = getLastExecution(missionId);
        if (!verified && last) {
          const verify = await executeTool('verify_result', {
            expectedBehavior: context.expectedBehavior,
            actualResult: last.stdout
          }, missionId);
          verified = verify.status === 'PASS';
        }
        break;
      }
    }

    const last = getLastExecution(missionId);
    if (last) {
      await query(
        'INSERT INTO test_runs (mission_id, attempt_number, stdout, stderr, exit_code, status) VALUES ($1, $2, $3, $4, $5, $6)',
        [missionId, context.executionHistory.length || 1, last.stdout || '', last.stderr || '', last.exitCode ?? 1, verified ? 'PASSED' : 'FAILED']
      );
    }

    if (needsInput) {
      await setMissionStatus(missionId, MISSION_STATUS.NEEDS_INPUT);
      return { success: false, status: 'NEEDS_INPUT', error: 'NEEDS MORE EVIDENCE', message: needsInput, toolHistory: context.toolHistory };
    }

    if (verified) {
      await persistPatchedFiles(missionId);
      await setMissionStatus(missionId, MISSION_STATUS.VERIFIED);
      await recordEvent(missionId, 'verification_passed', 'BUG VERIFIED FIXED', { provider: provider.name, model: provider.model });
      return {
        success: true,
        status: 'VERIFIED',
        provider: provider.name,
        model: provider.model,
        message: lastMessage,
        patch: lastPatch,
        execution: last,
        toolHistory: context.toolHistory
      };
    }

    if (lastPatch) {
      await persistPatchedFiles(missionId);
      await setMissionStatus(missionId, 'PATCH_GENERATED');
      await recordEvent(missionId, 'patch_generated_unverified', 'AI-generated fix — execution not verified.', { provider: provider.name, model: provider.model });
      return {
        success: true,
        status: 'PATCH_GENERATED',
        provider: provider.name,
        model: provider.model,
        message: lastMessage || 'AI-generated fix — execution not verified.',
        patch: lastPatch,
        execution: last,
        toolHistory: context.toolHistory,
        unverified: true
      };
    }

    await setMissionStatus(missionId, MISSION_STATUS.FAILED);
    await recordEvent(missionId, 'verification_failed', 'UNABLE TO VERIFY', { level: 'error' });
    return {
      success: false,
      status: 'FAILED',
      error: 'UNABLE TO VERIFY',
      provider: provider.name,
      model: provider.model,
      message: lastMessage,
      execution: last,
      toolHistory: context.toolHistory
    };
  } catch (err) {
    const code = err instanceof AIProviderError ? err.code : 'AI_PROVIDER_ERROR';
    await setMissionStatus(missionId, MISSION_STATUS.FAILED);
    await recordEvent(missionId, 'provider_error', code === 'AI_SERVICE_UNAVAILABLE' ? 'AI SERVICE UNAVAILABLE' : 'AI_PROVIDER_ERROR', {
      level: 'error',
      detail: err.message
    });
    return { success: false, status: 'FAILED', error: code, message: err.message };
  }
}
