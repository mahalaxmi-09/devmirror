import './config/env.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { initDb } from './db/connection.js';
import authRouter from './routes/auth.js';
import missionsRouter from './routes/missions.js';
import skillsRouter from './routes/skills.js';
import mirrorRouter from './routes/mirror.js';
import { getAIProviderName, getGeminiKeyStatus } from './config/env.js';
import { pingAllProviders } from './ai/providerFactory.js';
import { BACKEND_ROOT } from './config/env.js';

const app = express();
const PORT = process.env.PORT || 5005;

app.use(cors());
app.use(express.json({ limit: '8mb' }));

const uploadsDir = path.join(BACKEND_ROOT, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

app.use('/api/auth', authRouter);
app.use('/api/missions', missionsRouter);
app.use('/api/mirror', mirrorRouter);
app.use('/api', skillsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

app.get('/api/ai/health', async (req, res) => {
  try {
    const result = await pingAllProviders();
    const geminiStatus = getGeminiKeyStatus();
    return res.json({
      ...result,
      gemini: result.providers?.find((p) => p.provider === 'gemini')?.status === 'connected' ? 'connected' : 'unavailable',
      geminiKey: geminiStatus.validFormat ? 'valid' : (geminiStatus.configured ? 'invalid_format' : 'missing'),
      hint: geminiStatus.hint || (result.status === 'unavailable'
        ? 'Check AI provider quota/billing or set ANTHROPIC_API_KEY as fallback.'
        : null)
    });
  } catch {
    res.json({
      provider: getAIProviderName(),
      status: 'unavailable',
      gemini: 'unavailable',
      hint: 'AI provider check failed.'
    });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'A professional systems error occurred. Please contact DevMirror operations.' });
});

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
