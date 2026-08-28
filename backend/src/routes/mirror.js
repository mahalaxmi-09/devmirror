import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { query } from '../db/connection.js';
import authMiddleware from '../middleware/auth.js';
import {
  generateSessionStart,
  generateAdaptiveQuestion,
  generateMirrorReport,
  analyzeLocalCommunication,
  tensionBand,
  transcriptDerivedReport
} from '../services/mirrorAgent.js';
import { extractProjectContext } from '../services/projectContext.js';
import { BACKEND_ROOT } from '../config/env.js';

const router = express.Router();

const uploadDir = path.join(BACKEND_ROOT, 'uploads', 'mirror-tmp');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 8 * 1024 * 1024 }
});

function cleanupUpload(file) {
  if (file?.path) {
    try { fs.unlinkSync(file.path); } catch { /* ignore */ }
  }
}

async function getOwnedSession(id, userId) {
  const sessionRes = await query('SELECT * FROM mirror_sessions WHERE id = $1 AND user_id = $2', [id, userId]);
  return sessionRes.rows[0] || null;
}

function parseProfile(session) {
  const parse = (v, fallback) => {
    try { return JSON.parse(v || ''); } catch { return fallback; }
  };
  return {
    prepType: session.prep_type,
    prep_title: session.prep_title,
    sessionType: session.session_mode || session.prep_type,
    topics: parse(session.topics, []),
    skills: parse(session.skills, []),
    requirements: parse(session.requirements, []),
    difficulty: session.difficulty,
    important_areas: parse(session.important_areas, []),
    projectContext: session.project_context || ''
  };
}

async function fetchRow(table, id) {
  const res = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  return res.rows[0] || { id };
}

function normalizeCoachingScores(scores = {}) {
  const entries = Object.entries(scores).filter(([, v]) => typeof v === 'number' && !Number.isNaN(v));
  if (!entries.length) return scores;
  const max = Math.max(...entries.map(([, v]) => v));
  if (max <= 10) {
    return Object.fromEntries(entries.map(([k, v]) => [k, Math.round(v * 10)]));
  }
  return scores;
}
  return /^(finish|end session|end)$/i.test(String(text || '').trim());
}

async function handleSubmitAnswer(req, res) {
  const { id } = req.params;
  const answer_text = req.body.answer_text || req.body.message || req.body.transcription;
  const input_mode = req.body.input_mode || req.body.inputMode || 'text';
  const observational_signals = req.body.observational_signals || (req.body.visualMetrics ? JSON.stringify(req.body.visualMetrics) : null);
  const visualMetrics = req.body.visualMetrics || {};

  if (!answer_text || !String(answer_text).trim()) {
    return res.status(400).json({ error: 'A typed or transcribed response is required.' });
  }

  if (isFinishCommand(answer_text)) {
    req.body = req.body || {};
    return completeSession(req, res);
  }

  try {
    const session = await getOwnedSession(id, req.user.id);
    if (!session) return res.status(404).json({ error: 'Mirror session not found.' });

    const pendingRes = await query(
      'SELECT * FROM mirror_dialogs WHERE session_id = $1 AND answer_text IS NULL ORDER BY id DESC LIMIT 1',
      [id]
    );
    if (pendingRes.rows.length === 0) {
      return res.status(400).json({ error: 'No active question. Please start or continue the session.' });
    }
    const pendingDialog = pendingRes.rows[0];
    const local = analyzeLocalCommunication(answer_text);

    await query(
      'UPDATE mirror_dialogs SET answer_text = $1, input_mode = $2, gaze_observational_signals = $3, communication_feedback = $4 WHERE id = $5',
      [answer_text, input_mode, observational_signals || null, JSON.stringify({ local, visualMetrics }), pendingDialog.id]
    );

    const dialogsRes = await query('SELECT * FROM mirror_dialogs WHERE session_id = $1 ORDER BY id ASC', [id]);
    const dialogs = dialogsRes.rows;
    const profile = parseProfile(session);

    const nextQuestionData = await generateAdaptiveQuestion(profile, dialogs, { visualMetrics });

    const newDialogRes = await query(
      'INSERT INTO mirror_dialogs (session_id, question_text, communication_feedback) VALUES ($1, $2, $3) RETURNING *',
      [id, nextQuestionData.question_text, JSON.stringify(nextQuestionData.feedback || {})]
    );
    const nextQuestion = await fetchRow('mirror_dialogs', newDialogRes.rows[0].id);

    res.json({
      success: true,
      response: nextQuestionData.response || nextQuestionData.ava_remark || '',
      nextQuestion,
      next_question: nextQuestion,
      ava_remark: nextQuestionData.ava_remark,
      feedback: nextQuestionData.feedback || null,
      communication: nextQuestionData.communication || null,
      sessionState: {
        questionsAsked: dialogs.length,
        questionsAnswered: dialogs.filter((d) => d.answer_text).length,
        tensionIndicator: tensionBand({ fillerCount: local.fillerCount, visual: visualMetrics })
      }
    });
  } catch (error) {
    const msg = error.code === 'AI_SERVICE_UNAVAILABLE'
      ? 'Mirror AI is temporarily unavailable.'
      : 'Failed to process answer.';
    console.error('Error submitting Mirror answer:', error.message);
    res.status(500).json({ error: msg });
  }
}

router.post('/sessions', authMiddleware, upload.single('file'), async (req, res) => {
  const prep_type = (req.body.prep_type || req.body.goal || req.body.preparationGoal || '').trim();
  const pasted_text = req.body.pasted_text || req.body.projectContext || req.body.context || '';
  const difficulty = req.body.difficulty || 'Intermediate';
  const mode = req.body.mode || req.body.sessionType || '';

  if (!prep_type) {
    cleanupUpload(req.file);
    return res.status(400).json({ error: 'Tell Ava what you are preparing for.' });
  }

  try {
    const projectContext = extractProjectContext({
      filePath: req.file?.path,
      originalName: req.file?.originalname,
      pastedText: pasted_text
    });
    cleanupUpload(req.file);

    const started = await generateSessionStart(
      mode ? `${prep_type} (${mode})` : prep_type,
      projectContext,
      difficulty,
      mode
    );
    const profile = {
      prep_title: started.prep_title,
      sessionType: started.sessionType,
      topics: started.topics || [],
      skills: started.skills || [],
      requirements: started.requirements || [],
      difficulty: started.difficulty || difficulty,
      important_areas: started.important_areas || [],
      sessionObjective: started.sessionObjective,
      projectContext
    };
    if (!started.question_text) {
      throw Object.assign(new Error('Mirror AI is temporarily unavailable.'), { code: 'AI_SERVICE_UNAVAILABLE' });
    }
    if (projectContext) profile.projectContext = projectContext;

    const insert = await query(
      `INSERT INTO mirror_sessions
       (user_id, prep_type, prep_title, topics, skills, requirements, difficulty, important_areas, project_context, session_mode, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        req.user.id,
        prep_type,
        profile.prep_title || `Prep for ${prep_type}`,
        JSON.stringify(profile.topics || []),
        JSON.stringify(profile.skills || []),
        JSON.stringify(profile.requirements || []),
        profile.difficulty || difficulty,
        JSON.stringify(profile.important_areas || []),
        projectContext || null,
        mode || profile.sessionType || null,
        'ACTIVE'
      ]
    );
    const session = await fetchRow('mirror_sessions', insert.rows[0].id);

    const dialogInsert = await query(
      'INSERT INTO mirror_dialogs (session_id, question_text) VALUES ($1, $2) RETURNING *',
      [session.id, started.question_text]
    );
    const initial_question = await fetchRow('mirror_dialogs', dialogInsert.rows[0].id);

    res.status(201).json({
      session,
      profile,
      initial_question,
      response: started.response || started.ava_remark || '',
      ava_remark: started.ava_remark
    });
  } catch (error) {
    cleanupUpload(req.file);
    const msg = error.code === 'AI_SERVICE_UNAVAILABLE'
      ? 'Mirror AI is temporarily unavailable.'
      : 'Failed to initialize Mirror session.';
    console.error('Error creating Mirror session:', error.message);
    res.status(500).json({ error: msg });
  }
});

router.post('/sessions/:id/submit-answer', authMiddleware, handleSubmitAnswer);
router.post('/sessions/:id/message', authMiddleware, handleSubmitAnswer);
router.post('/sessions/:id/voice', authMiddleware, handleSubmitAnswer);

router.post('/sessions/:id/analyze', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const session = await getOwnedSession(id, req.user.id);
  if (!session) return res.status(404).json({ error: 'Mirror session not found.' });
  const visualMetrics = req.body.visualMetrics || req.body;
  const last = await query(
    'SELECT id FROM mirror_dialogs WHERE session_id = $1 ORDER BY id DESC LIMIT 1',
    [id]
  );
  if (last.rows[0]) {
    await query(
      'UPDATE mirror_dialogs SET gaze_observational_signals = $1 WHERE id = $2',
      [JSON.stringify(visualMetrics), last.rows[0].id]
    );
  }
  res.json({ success: true, visualMetrics });
});

async function completeSession(req, res) {
  const { id } = req.params;
  try {
    const session = await getOwnedSession(id, req.user.id);
    if (!session) return res.status(404).json({ error: 'Mirror session not found.' });

    const dialogsRes = await query(
      'SELECT * FROM mirror_dialogs WHERE session_id = $1 AND answer_text IS NOT NULL ORDER BY id ASC',
      [id]
    );
    const dialogs = dialogsRes.rows;
    if (dialogs.length === 0) {
      return res.status(400).json({ error: 'Please answer at least one question before ending the session.' });
    }

    const profile = parseProfile(session);
    const lastSignals = dialogs[dialogs.length - 1]?.gaze_observational_signals;
    let visualMetrics = {};
    try { visualMetrics = lastSignals ? JSON.parse(lastSignals) : {}; } catch { visualMetrics = {}; }

    let report;
    try {
      report = await generateMirrorReport(profile, dialogs, { visualMetrics });
    } catch (error) {
      if (error.code !== 'AI_SERVICE_UNAVAILABLE') throw error;
      report = transcriptDerivedReport(profile, dialogs, { visualMetrics });
    }
    report.scores = normalizeCoachingScores(report.scores || {});
    const reportInsert = await query(
      `INSERT INTO mirror_reports
       (session_id, communication_json, technical_json, presentation_json, strengths_json, weaknesses_json, next_challenge)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        id,
        JSON.stringify(report.communication),
        JSON.stringify(report.technical),
        JSON.stringify({
          scores: report.scores || {},
          tensionIndicator: report.tensionIndicator,
          practiceSuggestions: report.practiceSuggestions || [],
          strongestArea: report.strongestArea,
          improvementArea: report.improvementArea,
          nextRecommendation: report.nextRecommendation,
          label: report.reportSource === 'transcript-derived'
            ? 'Transcript-derived communication indicators (full AI report unavailable)'
            : 'AI communication coaching score'
        }),
        JSON.stringify(report.strengths || []),
        JSON.stringify(report.development_areas || []),
        JSON.stringify(report.next_challenge || null)
      ]
    );
    const saved = await fetchRow('mirror_reports', reportInsert.rows[0].id);
    await query("UPDATE mirror_sessions SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);

    res.json({ success: true, report: saved, analysis: report });
  } catch (error) {
    const msg = error.code === 'AI_SERVICE_UNAVAILABLE'
      ? 'Mirror AI is temporarily unavailable.'
      : 'Failed to generate Mirror reflection.';
    console.error('Error ending Mirror session:', error.message);
    res.status(500).json({ error: msg });
  }
}

router.post('/sessions/:id/end', authMiddleware, completeSession);
router.post('/sessions/:id/complete', authMiddleware, completeSession);

router.get('/sessions', authMiddleware, async (req, res) => {
  try {
    const listRes = await query(
      `SELECT ms.*,
       (SELECT COUNT(*) FROM mirror_dialogs WHERE session_id = ms.id AND answer_text IS NOT NULL) as answered_count
       FROM mirror_sessions ms
       WHERE ms.user_id = $1
       ORDER BY ms.id DESC`,
      [req.user.id]
    );
    res.json(listRes.rows);
  } catch (error) {
    console.error('Error listing Mirror sessions:', error.message);
    res.status(500).json({ error: 'Failed to list Mirror history.' });
  }
});

router.get('/sessions/:id', authMiddleware, async (req, res) => {
  const session = await getOwnedSession(req.params.id, req.user.id);
  if (!session) return res.status(404).json({ error: 'Mirror session not found.' });
  const dialogsRes = await query('SELECT * FROM mirror_dialogs WHERE session_id = $1 ORDER BY id ASC', [req.params.id]);
  const reportRes = await query('SELECT * FROM mirror_reports WHERE session_id = $1', [req.params.id]);
  res.json({ session, dialogs: dialogsRes.rows, report: reportRes.rows[0] || null });
});

router.get('/sessions/:id/report', authMiddleware, async (req, res) => {
  const session = await getOwnedSession(req.params.id, req.user.id);
  if (!session) return res.status(404).json({ error: 'Report not found.' });
  const reportRes = await query('SELECT * FROM mirror_reports WHERE session_id = $1', [req.params.id]);
  if (!reportRes.rows[0]) return res.status(404).json({ error: 'Report not ready. End the session first.' });
  res.json(reportRes.rows[0]);
});

export default router;
