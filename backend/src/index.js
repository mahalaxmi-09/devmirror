import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db/connection.js';
import authRouter from './routes/auth.js';
import missionsRouter from './routes/missions.js';
import skillsRouter from './routes/skills.js';
import mirrorRouter from './routes/mirror.js';
import { getAIProviderName, getGeminiKeyStatus } from './config/env.js';
import { pingAllProviders } from './ai/providerFactory.js';
import { BACKEND_ROOT } from './config/env.js';
import authMiddleware from './middleware/auth.js';
import { runStatelessDebug } from './services/statelessDebug.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5005;

import path from 'path';
import fs from 'fs';

// Middleware
app.use(cors());
app.use(express.json());

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/missions', missionsRouter);
app.use('/api/mirror', mirrorRouter);
app.use('/api', skillsRouter); // Mounts /missions/:id/mirror, /skills, /challenges

// Base endpoint check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// AI health check
app.get('/api/ai/health', async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const isGemini = geminiKey && geminiKey !== 'your_gemini_api_key_here' && geminiKey !== '';

  const openAIKey = process.env.OPENAI_API_KEY;
  const isOpenAI = openAIKey && openAIKey !== 'your_openai_api_key_here' && openAIKey !== '';

  const status = { 
    gemini: { configured: isGemini, status: 'unavailable' }, 
    openai: { configured: isOpenAI, status: 'unavailable' } 
  };

  if (isOpenAI) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAIKey}`
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1
        })
      });
      if (response.ok) {
        status.openai.status = 'available';
      }
    } catch (e) {}
  }

  if (isGemini) {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });
      await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 1 }
      });
      status.gemini.status = 'available';
    } catch (e) {}
  }

  const activeProvider = status.openai.status === 'available' ? 'openai' : (status.gemini.status === 'available' ? 'gemini' : 'none');

  res.json({
    openai: status.openai,
    gemini: status.gemini,
    activeProvider
  });
});

// Stateless Debug Endpoint
app.post('/api/debug', authMiddleware, async (req, res) => {
  const { code, language, error, context } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Code block is required for debugging.' });
  }
  try {
    const result = await runStatelessDebug(code, language, error, context);
    res.json(result);
  } catch (err) {
    console.error('Error in stateless debugging endpoint:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      rootCause: 'Internal system error occurred',
      explanation: 'Our backend AI system encountered an unhandled exception.',
      fixedCode: code,
      changes: [],
      confidence: 0
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'A professional systems error occurred. Please contact DevMirror operations.' });
});

// Start Database & Server
const startServer = async () => {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`DevMirror AI backend service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Database connection failed, server could not start:', error);
    process.exit(1);
  }
};

startServer();
