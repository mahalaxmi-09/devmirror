import './config/env.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { initDb, query } from './db/connection.js';
import authRouter from './routes/auth.js';
import missionsRouter from './routes/missions.js';
import skillsRouter from './routes/skills.js';
import mirrorRouter from './routes/mirror.js';
import authMiddleware from './middleware/auth.js';
import { getAIProviderName, getGeminiKeyStatus } from './config/env.js';
import { pingAllProviders } from './ai/providerFactory.js';
import { BACKEND_ROOT } from './config/env.js';
import { runStatelessDebug } from './services/statelessDebug.js';

const app = express();
const PORT = process.env.PORT || 5005;

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = [
      /^https:\/\/devmirror[a-z0-9-]*\.vercel\.app$/,
      /^http:\/\/localhost(:\d+)?$/,
      /^http:\/\/127\.0\.0\.1(:\d+)?$/
    ];
    if (allowed.some((pattern) => pattern.test(origin))) {
      return callback(null, true);
    }
    callback(null, true);
  },
  credentials: true
};

app.use(cors(corsOptions));
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

app.get('/api/health', async (req, res) => {
  let databaseOk = false;
  let aiOk = false;

  try {
    const dbRes = await query('SELECT 1');
    if (dbRes) databaseOk = true;
  } catch (err) {
    console.error('Health check database error:', err);
  }

  try {
    const aiHealth = await pingAllProviders();
    if (aiHealth?.status === 'connected') aiOk = true;
  } catch (err) {
    console.error('Health check AI error:', err);
  }

  res.json({
    status: (databaseOk && aiOk) ? 'ok' : 'error',
    ai: aiOk,
    database: databaseOk
  });
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

app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'A professional systems error occurred. Please contact DevMirror operations.' });
});

const startServer = async () => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DevMirror AI backend service running on port ${PORT}`);
  });

  try {
    await initDb();
  } catch (error) {
    console.error('Database connection failed, server could not start:', error);
    process.exit(1);
  }
};

startServer();
