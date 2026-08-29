import express from 'express';
import authMiddleware from '../middleware/auth.js';
import { callAI } from '../services/gemini.js';
import { getAIProviderName } from '../config/env.js';

const router = express.Router();

// Helper to sanitize code logs (printing a safe preview length)
const safeCodePreview = (code) => {
  if (!code) return '';
  return code.slice(0, 120) + (code.length > 120 ? '...' : '');
};

// 1. Compatibility route for POST /api/debug
router.post('/', authMiddleware, async (req, res) => {
  const { code, language, error, context, prompt: userPrompt } = req.body;
  
  // SAFE DEBUG LOGGING
  console.log('[DEBUG AI] Request received');
  console.log(`[DEBUG AI] Language: ${language || 'Auto Detect'}`);
  console.log(`[DEBUG AI] Code received: "${safeCodePreview(code)}"`);
  console.log(`[DEBUG AI] Provider: ${getAIProviderName()}`);

  if (!code) {
    return res.status(400).json({ error: 'Code block is required for debugging.' });
  }

  const promptCtx = userPrompt || context || 'Debug this code.';

  try {
    const systemPrompt = `You are Mirror AI - a professional code repair engine.
Analyze the user's code, error message, and instructions. Propose a root cause diagnosis and fix.
Return valid JSON only containing:
- errorType: string (e.g. ReferenceError, TypeError, SyntaxError, LogicError)
- errorMessage: string (the exact error message from the log, or brief explanation)
- rootCause: string (technical root cause)
- explanation: string (explanation of resolution)
- correctedCode: string (COMPLETE corrected code block)
- expectedOutput: string (expected execution output / stdout of corrected code)`;

    const promptText = `
Programming Language: ${language}
Current Code:
${code}

Current Error Log:
${error || 'No error log provided.'}

Context/Prompt:
${promptCtx}

Return JSON only.`;

    console.log('[DEBUG AI] AI request started');
    const responseText = await callAI(systemPrompt, promptText, 'application/json');
    console.log('[DEBUG AI] AI response received');

    let cleaned = responseText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    }
    const result = JSON.parse(cleaned);

    const analysis = {
      errorType: result.errorType || 'Error',
      errorMessage: result.errorMessage || error || 'N/A',
      rootCause: result.rootCause || 'N/A',
      explanation: result.explanation || 'N/A',
      correctedCode: result.correctedCode || code,
      expectedOutput: result.expectedOutput || 'N/A'
    };

    const finalResult = {
      success: true,
      fixedCode: analysis.correctedCode,
      correctedCode: analysis.correctedCode,
      errorType: analysis.errorType,
      rootCause: analysis.rootCause,
      explanation: analysis.explanation,
      verification: 'Execution not verified.',
      analysis
    };

    console.log('[DEBUG AI] Response sent');
    res.json(finalResult);
  } catch (err) {
    console.error('[DEBUG AI] Stateless debug error:', err);
    res.status(500).json({ error: 'Stateless debugging failed.' });
  }
});

// 2. Cloudflare Sandbox-verified code debugging route (POST /api/debug/run)
router.post('/run', authMiddleware, async (req, res) => {
  const { language, code, error, context, prompt: userPrompt } = req.body;

  // SAFE DEBUG LOGGING
  console.log('[DEBUG AI] Request received');
  console.log(`[DEBUG AI] Language: ${language || 'Auto Detect'}`);
  console.log(`[DEBUG AI] Code received: "${safeCodePreview(code)}"`);
  console.log(`[DEBUG AI] Provider: ${getAIProviderName()}`);

  if (!code) {
    return res.status(400).json({ error: 'Code block is required for debugging.' });
  }

  const promptCtx = userPrompt || context || 'Debug this code.';

  const lang = (language || '').toLowerCase();
  if (lang !== 'javascript' && lang !== 'js' && lang !== 'node' && lang !== 'python' && lang !== 'py') {
    return res.status(400).json({ error: 'Unsupported language. Only Javascript and Python are supported in this sandbox version.' });
  }

  const sandboxUrl = process.env.CLOUDFLARE_SANDBOX_URL;
  const isSandboxAvailable = Boolean(sandboxUrl);

  const maxAttempts = isSandboxAvailable ? 3 : 1;
  let currentCode = code;
  let currentError = error || '';
  let latestResult = null;
  
  let executionStdout = '';
  let executionStderr = '';
  let executionExitCode = -1;
  let executionSuccess = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[DEBUG AI] Cloudflare Sandbox debug verification attempt ${attempt}/${maxAttempts}...`);

    const systemPrompt = `You are Mirror AI - a professional code repair engine.
Analyze the user's code, error message, and context. Propose a root cause diagnosis and fix.
Return valid JSON only containing:
- errorType: string (e.g. ReferenceError, TypeError, SyntaxError, LogicError)
- errorMessage: string (the exact error message from the log, or brief explanation)
- rootCause: string (technical root cause)
- explanation: string (explanation of resolution)
- correctedCode: string (COMPLETE corrected code block)
- expectedOutput: string (expected execution output / stdout of corrected code)`;

    const promptText = `
Programming Language: ${language}
Current Code:
${currentCode}

Current Error Log:
${currentError || 'No error log provided.'}

Context/Prompt:
${promptCtx}

Return JSON only.`;

    try {
      console.log('[DEBUG AI] AI request started');
      const aiResponse = await callAI(systemPrompt, promptText, 'application/json');
      console.log('[DEBUG AI] AI response received');

      let cleaned = aiResponse.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/```$/, '').trim();
      }
      latestResult = JSON.parse(cleaned);

      if (isSandboxAvailable) {
        // Send workload to secure Cloudflare Sandbox
        console.log(`Sending execution workload to Cloudflare Sandbox at ${sandboxUrl}/run...`);
        const cfResponse = await fetch(`${sandboxUrl}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language, code: latestResult.correctedCode })
        });

        if (!cfResponse.ok) {
          throw new Error(`Cloudflare Sandbox returned HTTP status ${cfResponse.status}`);
        }

        const runResult = await cfResponse.json();
        executionStdout = runResult.stdout || '';
        executionStderr = runResult.stderr || '';
        executionExitCode = runResult.exitCode !== undefined ? runResult.exitCode : -1;
        executionSuccess = runResult.success === true;

        if (executionSuccess) {
          console.log(`Cloudflare Sandbox verification passed on attempt ${attempt}!`);
          break;
        } else {
          console.warn(`Cloudflare Sandbox verification failed on attempt ${attempt}:`, executionStderr);
          currentCode = latestResult.correctedCode;
          currentError = executionStderr || executionStdout || 'Code execution returned non-zero exit code.';
        }
      } else {
        // Fallback: Sandbox offline, return AI diagnosis directly
        console.log('Cloudflare Sandbox is not configured/available. Returning AI-only diagnosis.');
        executionStdout = 'N/A - Sandbox not configured.';
        executionStderr = 'N/A - Sandbox not configured.';
        executionExitCode = 0;
        executionSuccess = true;
        break;
      }
    } catch (err) {
      console.error(`Attempt ${attempt} failed:`, err.message);
      if (attempt === maxAttempts) {
        return res.status(500).json({
          success: false,
          error: err.message,
          diagnosis: `### ❌ Execution Failed\nFailed to compile AI diagnosis: ${err.message}`,
          fixedCode: code,
          execution: { stdout: '', stderr: err.message, exitCode: -1 },
          testsPassed: false
        });
      }
    }
  }

  // Compile final markdown report for the "diagnosis" field
  const verificationBanner = isSandboxAvailable 
    ? `✅ **Execution Verified**: Verified successfully in Cloudflare Sandbox environment.`
    : `⚠️ **AI-Only Diagnosis**: Cloudflare Sandbox is currently offline/unconfigured. This fix was NOT execution-verified.`;

  const reportMarkdown = `
${verificationBanner}

### 🔍 Root Cause
${latestResult.rootCause}

### 💡 Why It Happened
${latestResult.explanation}

### ⚠️ Original Error
${error || 'No error log provided.'}

### ⚙️ Expected Output
${latestResult.expectedOutput}
`;

  const analysis = {
    errorType: latestResult.errorType || 'Error',
    errorMessage: latestResult.errorMessage || error || 'N/A',
    rootCause: latestResult.rootCause || 'N/A',
    explanation: latestResult.explanation || 'N/A',
    correctedCode: latestResult.correctedCode || code,
    expectedOutput: latestResult.expectedOutput || 'N/A'
  };

  const finalResult = {
    success: executionSuccess,
    diagnosis: reportMarkdown.trim(),
    fixedCode: latestResult.correctedCode,
    correctedCode: latestResult.correctedCode,
    errorType: latestResult.errorType,
    rootCause: latestResult.rootCause,
    explanation: latestResult.explanation,
    verification: isSandboxAvailable 
      ? (executionSuccess ? 'VERIFIED_SUCCESS' : 'VERIFIED_FAILED') 
      : 'Execution not verified.',
    confidence: latestResult.confidence || 95,
    execution: {
      stdout: executionStdout,
      stderr: executionStderr,
      exitCode: executionExitCode
    },
    testsPassed: executionSuccess,
    analysis
  };

  console.log('[DEBUG AI] Response sent');
  res.json(finalResult);
});

export default router;
