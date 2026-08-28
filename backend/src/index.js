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

// AI health check
app.get('/api/ai/health', async (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  const isConfigured = key && key !== 'your_gemini_api_key_here' && key !== '';
  if (!isConfigured) {
    return res.json({ gemini: 'unavailable' });
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(key);
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const model = genAI.getGenerativeModel({ model: modelName });
    // Execute a minimal check request
    await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'healthcheck' }] }],
      generationConfig: { maxOutputTokens: 1 }
    });
    res.json({ gemini: 'connected' });
  } catch (err) {
    console.error('Gemini Healthcheck Error:', err);
    res.json({ gemini: 'unavailable' });
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
