import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');
import authMiddleware from '../middleware/auth.js';
import { BACKEND_ROOT } from '../config/env.js';
import { generateStructuredJson } from '../ai/jsonGenerate.js';
import { getGeminiClient, getGeminiModel } from '../services/geminiClient.js';

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

// Vision assistant to extract text, slides, and architectural patterns from diagrams
async function analyzeImageWithAI(buffer, mimeType) {
  const client = getGeminiClient();
  if (!client) {
    throw new Error('AI provider is not configured. Please supply a valid GEMINI_API_KEY.');
  }
  const base64Image = buffer.toString('base64');
  
  const response = await client.models.generateContent({
    model: getGeminiModel() || 'gemini-2.5-flash',
    contents: [
      {
        inlineData: {
          mimeType,
          data: base64Image
        }
      },
      "Extract and explain the content of this image in detail. Describe any diagrams, slides, text labels, codebase architectures, databases, or project outlines displayed so it can be used to generate practice questions."
    ]
  });

  return response.text || 'No description could be extracted from this image.';
}

// Unified file upload route (PDFs and Images)
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No file was uploaded.' });
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
  if (!allowedExts.includes(ext)) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    return res.status(400).json({ error: 'Unsupported file type. Please upload a PDF document or a JPG/PNG/WebP image.' });
  }

  try {
    const dataBuffer = fs.readFileSync(file.path);
    let extractedText = '';
    let fileType = '';

    if (ext === '.pdf') {
      fileType = 'PDF';
      const parser = new PDFParse({ data: dataBuffer });
      const pdfData = await parser.getText();
      await parser.destroy();
      extractedText = pdfData.text;
    } else {
      fileType = 'Image';
      const mimeType = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg');
      try {
        extractedText = await analyzeImageWithAI(dataBuffer, mimeType);
      } catch (err) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(503).json({ error: 'AI vision extraction is temporarily unavailable: ' + err.message });
      }
    }

    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

    res.json({
      success: true,
      text: extractedText,
      fileType,
      fileName: file.originalname,
      fileSize: file.size
    });
  } catch (err) {
    console.error('File upload/extraction error:', err);
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.status(500).json({ error: 'Unable to read or extract content from this file.' });
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
    if (err.code === 'AI_SERVICE_UNAVAILABLE') {
      return res.status(503).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to analyze preparation material.' });
  }
});

// 2. Generate custom interview questions
router.post('/generate-questions', authMiddleware, async (req, res) => {
  const { topics = [], mode, difficulty = 'medium', questionCount = 5, interviewType = 'Mixed', materialText = '' } = req.body || {};

  let systemInstruction = `You are Mirror AI Coach.
Generate professional practice questions based on the listed topics, difficulty, and selected practice mode.
Ensure questions are highly specific, realistic, and ground them in the provided Context Material. Do not generate generic random questions.
Return structured JSON only, containing exactly:
- questions: array of objects with fields:
  - id: number
  - text: string`;

  if (mode === 'viva') {
    systemInstruction += `\nPractice Mode is Project Viva. Act as an academic external examiner. Ask the candidate to defend their project overview, problem statement, architecture, technology stack, implementation, database, APIs, security, testing, deployment, challenges, and technical decisions.`;
  } else if (mode === 'presentation' || mode === 'communication') {
    systemInstruction += `\nPractice Mode is Presentation Practice / Communication Practice. Act as a presentation auditor and speech coach. Ask the user to explain specific sections, slides, diagrams, or content details from their material.`;
  } else {
    const type = interviewType || mode || 'Mixed';
    systemInstruction += `\nPractice Mode is Mock Interview (Type: ${type}). Act as a real professional interviewer. Ask specific questions targeted at assessing depth in ${difficulty} concepts.`;
  }

  const prompt = `Context Material:\n${materialText.slice(0, 4000)}\n\nTopics: ${JSON.stringify(topics)}\nDifficulty: ${difficulty}\nQuestion Count limit: ${questionCount}`;

  try {
    const result = await generateStructuredJson(prompt, systemInstruction);
    res.json(result);
  } catch (err) {
    console.error('Question generator error:', err);
    if (err.code === 'AI_SERVICE_UNAVAILABLE') {
      return res.status(503).json({ error: err.message });
    }
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
Analyze the user's answer to the given question and generate high-fidelity practice metrics.
Assess answer quality, technical accuracy, vocabulary clarity, and detect filler words (e.g., um, uh, like, actually, basically, you know).
Return structured JSON only, containing:
- score: number (1 to 10)
- technicalScore: number (1 to 10)
- communicationScore: number (1 to 10)
- relevanceScore: number (1 to 10)
- completenessScore: number (1 to 10)
- feedback: string (general feedback summary)
- technicalUnderstanding: string (brief assessment of tech concepts)
- communicationFeedback: string (brief assessment of speaking clarity)
- relevanceFeedback: string (brief assessment of answer relevance)
- completenessFeedback: string (brief assessment of how thorough the answer was)
- didWell: string (what user did well)
- toImprove: string (what user should improve)
- betterAnswer: string (suggested model answer guide)
- followUpQuestion: string (contextual adaptive follow-up question, or empty if none)
- fillerWords: string[] (detected filler words from the answer text)
- paceIndicator: string (speaking pace explanation)
- confidenceIndicator: number (1 to 100, Presentation Confidence Indicator calculated from pace, filler words, answer length, completeness)
- gazeFeedback: string (eye contact recommendation, e.g. "Consider maintaining more consistent eye contact with the camera.")`;

  const prompt = `Current Question: ${question}
User Answer: ${responseText}
Mode: ${mode}
Past Dialogs: ${JSON.stringify(history)}`;

  try {
    const result = await generateStructuredJson(prompt, systemInstruction);
    res.json(result);
  } catch (err) {
    console.error('Response evaluator error:', err);
    if (err.code === 'AI_SERVICE_UNAVAILABLE') {
      return res.status(503).json({ error: err.message });
    }
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
Identify potential nervousness indicators based on observable signals (filler words, speaking rate, pauses) without making a medical or psychological diagnosis.
Return structured JSON only, containing:
- overallScore: number (1 to 100)
- communicationScore: number (1 to 100)
- technicalScore: number (1 to 100)
- answerQualityScore: number (1 to 100)
- confidenceIndicator: number (1 to 100, Presentation Confidence Indicator summarizing speaking and camera behaviors)
- strengths: string[]
- improvements: string[]
- nervousnessIndicators: string[]
- gazeIndicators: string[] (observable gaze and camera presence recommendations, e.g. "Avoid looking away from the camera frequently")
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
    if (err.code === 'AI_SERVICE_UNAVAILABLE') {
      return res.status(503).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to generate performance report.' });
  }
});

export default router;
