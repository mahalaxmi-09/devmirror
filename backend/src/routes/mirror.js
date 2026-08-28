import express from 'express';
import { query } from '../db/connection.js';
import authMiddleware from '../middleware/auth.js';
import { 
  generatePrepProfile, 
  generateAdaptiveQuestion, 
  generateMirrorReport 
} from '../services/gemini.js';

const router = express.Router();

// 1. Start a Mirror Preparation Session
router.post('/sessions', authMiddleware, async (req, res) => {
  const { prep_type, pasted_text, is_demo } = req.body;

  if (!prep_type) {
    return res.status(400).json({ error: 'prep_type is required.' });
  }

  try {
    // Generate preparation profile using Gemini or local rules
    const profile = await generatePrepProfile(prep_type, pasted_text);

    // Save Mirror Session
    const topicsStr = JSON.stringify(profile.topics || []);
    const skillsStr = JSON.stringify(profile.skills || []);
    const requirementsStr = JSON.stringify(profile.requirements || []);
    const areasStr = JSON.stringify(profile.important_areas || []);

    const sessionRes = await query(
      `INSERT INTO mirror_sessions 
       (user_id, prep_type, prep_title, topics, skills, requirements, difficulty, important_areas, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [
        req.user.id,
        prep_type,
        profile.prep_title || `Prep for ${prep_type}`,
        topicsStr,
        skillsStr,
        requirementsStr,
        profile.difficulty || 'medium',
        areasStr,
        'ACTIVE'
      ]
    );
    const session = sessionRes.rows[0];

    // Generate initial conversational question
    const initialQuestionData = await generateAdaptiveQuestion(profile, []);
    
    // Save Initial Question Dialog
    const dialogRes = await query(
      'INSERT INTO mirror_dialogs (session_id, question_text) VALUES ($1, $2) RETURNING *',
      [session.id, initialQuestionData.question_text]
    );

    res.status(201).json({
      session,
      profile,
      initial_question: dialogRes.rows[0]
    });

  } catch (error) {
    console.error('Error creating Mirror session:', error);
    res.status(500).json({ error: 'Failed to initialize Mirror session: ' + error.message });
  }
});

// 2. Submit Answer & Get Next Adapted Question
router.post('/sessions/:id/submit-answer', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { answer_text, input_mode, observational_signals } = req.body;

  if (!answer_text) {
    return res.status(400).json({ error: 'answer_text is required.' });
  }

  try {
    // Check ownership
    const sessionRes = await query('SELECT * FROM mirror_sessions WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Mirror session not found.' });
    }
    const session = sessionRes.rows[0];

    // Locate current pending question
    const pendingRes = await query(
      'SELECT * FROM mirror_dialogs WHERE session_id = $1 AND answer_text IS NULL ORDER BY id DESC LIMIT 1',
      [id]
    );

    if (pendingRes.rows.length === 0) {
      return res.status(400).json({ error: 'No active question found to answer. Please retrieve next question.' });
    }
    const pendingDialog = pendingRes.rows[0];

    // Update with answer details
    await query(
      'UPDATE mirror_dialogs SET answer_text = $1, input_mode = $2, gaze_observational_signals = $3 WHERE id = $4',
      [answer_text, input_mode || 'text', observational_signals || null, pendingDialog.id]
    );

    // Fetch conversation dialog history so far
    const dialogsRes = await query('SELECT * FROM mirror_dialogs WHERE session_id = $1 ORDER BY id ASC', [id]);
    const dialogs = dialogsRes.rows;

    // Build profile object for Gemini
    const profile = {
      prepType: session.prep_type,
      prep_title: session.prep_title,
      topics: JSON.parse(session.topics || '[]'),
      skills: JSON.parse(session.skills || '[]'),
      requirements: JSON.parse(session.requirements || '[]'),
      difficulty: session.difficulty,
      important_areas: JSON.parse(session.important_areas || '[]')
    };

    // Limit conversation size to 5 questions
    if (dialogs.length >= 5) {
      return res.json({
        session_limit_reached: true,
        message: 'Mirror session limits reached. You can now End Session to generate your reflection report.'
      });
    }

    // Generate next adapted question
    const nextQuestionData = await generateAdaptiveQuestion(profile, dialogs);

    // Insert new pending dialog
    const newDialogRes = await query(
      'INSERT INTO mirror_dialogs (session_id, question_text) VALUES ($1, $2) RETURNING *',
      [id, nextQuestionData.question_text]
    );

    res.json({
      success: true,
      next_question: newDialogRes.rows[0],
      ava_remark: nextQuestionData.ava_remark
    });

  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ error: 'Failed to process answer.' });
  }
});

// 3. End Session & Generate Mirror Report
router.post('/sessions/:id/end', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const sessionRes = await query('SELECT * FROM mirror_sessions WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Mirror session not found.' });
    }
    const session = sessionRes.rows[0];

    // Load completed dialogs
    const dialogsRes = await query(
      'SELECT * FROM mirror_dialogs WHERE session_id = $1 AND answer_text IS NOT NULL ORDER BY id ASC',
      [id]
    );
    const dialogs = dialogsRes.rows;

    if (dialogs.length === 0) {
      return res.status(400).json({ error: 'Please answer at least one question before ending the session.' });
    }

    const profile = {
      prepType: session.prep_type,
      prep_title: session.prep_title,
      topics: JSON.parse(session.topics || '[]'),
      skills: JSON.parse(session.skills || '[]'),
      requirements: JSON.parse(session.requirements || '[]'),
      difficulty: session.difficulty,
      important_areas: JSON.parse(session.important_areas || '[]')
    };

    console.log(`Generating Mirror Reflection Report for Session #${id}...`);
    const report = await generateMirrorReport(profile, dialogs);

    // Check if report already exists for this session
    const existingReport = await query('SELECT id FROM mirror_reports WHERE session_id = $1', [id]);
    if (existingReport.rows.length > 0) {
      await query('DELETE FROM mirror_reports WHERE session_id = $1', [id]);
    }

    // Save report to DB
    const reportRes = await query(
      `INSERT INTO mirror_reports 
       (session_id, communication_json, technical_json, presentation_json, strengths_json, weaknesses_json, next_challenge) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [
        id,
        JSON.stringify(report.communication),
        JSON.stringify(report.technical),
        JSON.stringify(report.presentation || null),
        JSON.stringify(report.strengths || []),
        JSON.stringify(report.development_areas || []),
        JSON.stringify(report.next_challenge || null)
      ]
    );

    // Update session status to COMPLETED
    await query("UPDATE mirror_sessions SET status = 'COMPLETED' WHERE id = $1", [id]);

    res.json({
      success: true,
      report: reportRes.rows[0]
    });

  } catch (error) {
    console.error('Error ending Mirror session:', error);
    res.status(500).json({ error: 'Failed to generate Mirror reflection: ' + error.message });
  }
});

// 4. List user Mirror Sessions
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
    console.error('Error listing Mirror sessions:', error);
    res.status(500).json({ error: 'Failed to list Mirror history.' });
  }
});

// 5. Get Session details & Report
router.get('/sessions/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const sessionRes = await query('SELECT * FROM mirror_sessions WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Mirror session not found.' });
    }
    const session = sessionRes.rows[0];

    const dialogsRes = await query('SELECT * FROM mirror_dialogs WHERE session_id = $1 ORDER BY id ASC', [id]);
    const reportRes = await query('SELECT * FROM mirror_reports WHERE session_id = $1', [id]);

    res.json({
      session,
      dialogs: dialogsRes.rows,
      report: reportRes.rows[0] || null
    });
  } catch (error) {
    console.error('Error getting Mirror details:', error);
    res.status(500).json({ error: 'Failed to retrieve Mirror session details.' });
  }
});

export default router;
