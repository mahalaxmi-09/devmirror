import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db/connection.js';
import authRouter from './routes/auth.js';
import missionsRouter from './routes/missions.js';
import skillsRouter from './routes/skills.js';
import mirrorRouter from './routes/mirror.js';

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

function isConfiguredKey(key, placeholder = 'your_') {
  return key && key !== '' && !key.includes(placeholder);
}

async function testGeminiConnection() {
  const key = process.env.GEMINI_API_KEY;
  if (!isConfiguredKey(key, 'your_gemini_api_key_here')) {
    return { provider: 'gemini', status: 'unavailable', reason: 'GEMINI_API_KEY not configured' };
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(key);
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const model = genAI.getGenerativeModel({ model: modelName });
    await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'healthcheck' }] }],
      generationConfig: { maxOutputTokens: 1 }
    });
    return { provider: 'gemini', status: 'connected', model: modelName };
  } catch (err) {
    console.error('Gemini Healthcheck Error:', err.message);
    return { provider: 'gemini', status: 'unavailable', reason: err.message };
  }
}

async function testOpenAIConnection() {
  const key = process.env.OPENAI_API_KEY;
  if (!isConfiguredKey(key, 'your_openai_api_key_here')) {
    return { provider: 'openai', status: 'unavailable', reason: 'OPENAI_API_KEY not configured' };
  }

  try {
    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: 'healthcheck' }],
        max_tokens: 1
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${body.slice(0, 200)}`);
    }

    return { provider: 'openai', status: 'connected', model: modelName };
  } catch (err) {
    console.error('OpenAI Healthcheck Error:', err.message);
    return { provider: 'openai', status: 'unavailable', reason: err.message };
  }
}

// AI health check — performs a real provider request
app.get('/api/ai/health', async (req, res) => {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

  if (provider === 'openai') {
    const result = await testOpenAIConnection();
    return res.json({
      ai_provider: 'openai',
      openai: result.status,
      model: result.model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      reason: result.reason || undefined
    });
  }

  const result = await testGeminiConnection();
  return res.json({
    ai_provider: 'gemini',
    gemini: result.status,
    model: result.model || process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    reason: result.reason || undefined
  });
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
