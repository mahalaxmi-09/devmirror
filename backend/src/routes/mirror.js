import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import authMiddleware from '../middleware/auth.js';
import { analyzeCode, verifyCode } from '../services/mirrorCodeAgent.js';
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
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

function mapError(error, res) {
  const status = error.status || (error.code === 'AI_SERVICE_UNAVAILABLE' ? 503 : 500);
  const message = error.message || 'Mirror AI request failed.';
  if (status >= 500) {
    console.error('Mirror AI error:', message);
  }
  return res.status(status).json({
    success: false,
    error: message,
    analysis: null,
    fixedCode: null,
    changes: [],
    verification: { status: 'error', output: message }
  });
}

router.post('/analyze', authMiddleware, async (req, res) => {
  const { code, language = 'javascript', request } = req.body || {};

  try {
    const result = await analyzeCode({ code, language, request });
    return res.json(result);
  } catch (error) {
    return mapError(error, res);
  }
});

router.post('/verify', authMiddleware, async (req, res) => {
  const { code, language = 'javascript' } = req.body || {};

  try {
    const result = await verifyCode({ code, language });
    return res.json(result);
  } catch (error) {
    return mapError(error, res);
  }
});

// PDF Parsing Endpoint
router.post('/pdf', authMiddleware, upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No PDF file uploaded.' });
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.pdf') {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    return res.status(400).json({ error: 'Only PDF documents are allowed.' });
  }

  try {
    const dataBuffer = fs.readFileSync(file.path);
    const pdfData = await pdfParse(dataBuffer);
    
    // Delete file after parsing
    fs.unlinkSync(file.path);

    res.json({
      success: true,
      filename: file.originalname,
      size: file.size,
      text: pdfData.text,
      pages: pdfData.numpages
    });
  } catch (err) {
    console.error('PDF parsing error:', err);
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.status(500).json({ error: 'Failed to parse PDF document.' });
  }
});

// Multimodal Image Analysis Endpoint
router.post('/analyze-image', authMiddleware, async (req, res) => {
  const { image, request } = req.body || {};
  if (!image) {
    return res.status(400).json({ error: 'Image data is required.' });
  }

  try {
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const { getAIProvider } = await import('../ai/providerFactory.js');
    const provider = getAIProvider();
    
    const mimeType = image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
    let answerText = '';

    if (provider.name === 'openai') {
      const response = await provider.client.chat.completions.create({
        model: provider.model,
        messages: [
          { role: 'system', content: 'You are Mirror AI. Analyze the image and prompt.' },
          {
            role: 'user',
            content: [
              { type: 'text', text: request || 'Analyze this image.' },
              { type: 'image_url', image_url: { url: image } }
            ]
          }
        ]
      });
      answerText = response.choices[0].message.content;
    } else if (provider.name === 'gemini') {
      const response = await provider.client.models.generateContent({
        model: provider.model,
        contents: [
          request || 'Analyze this image.',
          { inlineData: { data: base64Data, mimeType } }
        ],
        config: { systemInstruction: 'You are Mirror AI. Analyze the image.' }
      });
      answerText = response.text;
    } else {
      answerText = 'Multimodal analysis not supported on the active provider.';
    }

    res.json({ success: true, analysis: answerText });
  } catch (err) {
    console.error('Image analysis error:', err);
    res.status(500).json({ error: err.message || 'Failed to analyze captured image.' });
  }
});

export default router;
