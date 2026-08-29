import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import authMiddleware from '../middleware/auth.js';
import { BACKEND_ROOT } from '../config/env.js';
import { generateStructuredJson } from '../ai/jsonGenerate.js';

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
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// PDF extraction route
router.post('/pdf', authMiddleware, upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No PDF file uploaded.' });
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.pdf') {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    return res.status(400).json({ error: 'Only PDF files are allowed.' });
  }

  try {
    const dataBuffer = fs.readFileSync(file.path);
    const parser = new PDFParse({ data: dataBuffer });
    const pdfData = await parser.getText();
    await parser.destroy();
    fs.unlinkSync(file.path);

    res.json({
      success: true,
      text: pdfData.text,
      pages: pdfData.total || 1
    });
  } catch (err) {
    console.error('PDF parser error:', err);
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.status(500).json({ error: 'Failed to parse PDF document.' });
  }
});

// 1. Analyze preparation material
router.post('/analyze-material', authMiddleware, async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'No preparation text provided.' });
  }

  const systemInstruction = `You are Mirror AI Content Analyzer.
Scan the technical preparation text, resume details, or description and extract topics, technologies, important concepts, and potential interview focus areas.
Return structured JSON only, containing these fields:
- title: string (descriptive title of content)
- topics: string[] (up to 6 core topics detected)
- technologies: string[] (developer toolsets and technologies detected)
- concepts: string[] (theoretical concepts detected)
- potentialAreas: string[] (likely interview questions categories)`;

  const prompt = `Material context:\n${text.slice(0, 5000)}`;

  try {
    const result = await generateStructuredJson(prompt, systemInstruction);
    res.json(result);
  } catch (err) {
    console.error('Material analyzer error:', err);
    res.status(500).json({ error: 'Failed to analyze preparation material.' });
  }
});

// 2. Generate custom interview questions
router.post('/generate-questions', authMiddleware, async (req, res) => {
  const { topics = [], mode, difficulty = 'medium', questionCount = 5 } = req.body || {};

  const systemInstruction = `You are Mirror AI Interviewer.
Generate professional interview questions based on the listed topics, technologies, difficulty, and selected practice mode.
Ensure questions are specific, realistic, and match the target practice mode style (e.g. mock interview, project viva, study materials, rapid fire, stress).
Return structured JSON only, containing exactly:
- questions: array of objects with fields:
  - id: number
  - text: string`;

  const prompt = `Topics: ${JSON.stringify(topics)}
Mode: ${mode}
Difficulty: ${difficulty}
Question Count limit: ${questionCount}`;

  try {
    const result = await generateStructuredJson(prompt, systemInstruction);
    res.json(result);
  } catch (err) {
    console.error('Question generator error:', err);
    res.status(500).json({ error: 'Failed to generate practice questions.' });
  }
});

// 3. Evaluate User response (Adaptive interview question follow-up)
router.post('/evaluate-response', authMiddleware, async (req, res) => {
  const { question, responseText, mode, history = [] } = req.body || {};
  if (!question || !responseText) {
    return res.status(400).json({ error: 'Question and response text are required.' });
  }

  const systemInstruction = `You are Mirror AI Evaluator.
Analyze the user's answer to the given question.
Assess answer quality, technical accuracy, vocabulary clarity, and detect filler words (e.g., um, uh, like, actually, basically, you know).
Provide a score between 1 and 10.
Decide if an adaptive follow-up question is appropriate:
- If response is strong: ask a deeper question extending the topic.
- If response is weak: ask a clarifying foundational question.
- If response is excellent: raise difficulty.
Return structured JSON only, containing:
- score: number (1 to 10)
- feedback: string (brief explanation of score)
- followUpQuestion: string (adaptive follow-up question, or empty if proceeding to next prompt)
- fillerWords: string[] (detected filler words)
- paceIndicator: string (speaking speed/pace explanation)`;

  const prompt = `Current Question: ${question}
User Answer: ${responseText}
Mode: ${mode}
Past Dialogs: ${JSON.stringify(history)}`;

  try {
    const result = await generateStructuredJson(prompt, systemInstruction);
    res.json(result);
  } catch (err) {
    console.error('Response evaluator error:', err);
    res.status(500).json({ error: 'Failed to evaluate response.' });
  }
});

// 4. Generate final session performance report
router.post('/generate-report', authMiddleware, async (req, res) => {
  const { mode, dialogs = [] } = req.body || {};
  if (!dialogs.length) {
    return res.status(400).json({ error: 'No practice dialogues to analyze.' });
  }

  const systemInstruction = `You are Mirror AI Performance Auditor.
Summarize the full practice dialogue history. Calculate scores and metrics.
Identify core strengths and specific technical areas to improve.
Provide a question-by-question review outlining score, feedback, better answer templates, and recommended follow-up study points.
Identify potential nervousness indicators based on observable signals (filler words, speaking rate, pauses) without making a medical diagnosis.
Return structured JSON only, containing:
- overallScore: number (1 to 100)
- communicationScore: number (1 to 100)
- technicalScore: number (1 to 100)
- answerQualityScore: number (1 to 100)
- strengths: string[]
- improvements: string[]
- nervousnessIndicators: string[]
- questionReviews: array of objects with fields:
  - question: string
  - answer: string
  - score: number
  - evaluation: string
  - betterAnswer: string
  - followUpRecommend: string`;

  const prompt = `Mode: ${mode}
Dialogs: ${JSON.stringify(dialogs)}`;

  try {
    const result = await generateStructuredJson(prompt, systemInstruction);
    res.json(result);
  } catch (err) {
    console.error('Report generator error:', err);
    res.status(500).json({ error: 'Failed to generate performance report.' });
  }
});

export default router;
