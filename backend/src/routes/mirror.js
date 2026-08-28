import express from 'express';
import authMiddleware from '../middleware/auth.js';
import { analyzeCode, verifyCode } from '../services/mirrorCodeAgent.js';

const router = express.Router();

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

export default router;
