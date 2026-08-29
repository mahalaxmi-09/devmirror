import express from 'express';
import authMiddleware from '../middleware/auth.js';
import { callAI } from '../services/gemini.js';

const router = express.Router();

// Compatibility route for /api/debug
router.post('/', authMiddleware, async (req, res) => {
  const { code, language, error, context } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Code block is required for debugging.' });
  }

  try {
    const systemPrompt = `You are DevMirror AI - a professional autonomous code repair assistant. Your objective is to resolve the user's coding error.`;
    const prompt = `
Programming Language: ${language}
Original Code:
${code}

Error / Unexpected Behavior:
${error || 'No error log provided.'}

Additional Context:
${context || 'No additional context.'}

Analyze the problem and return structured JSON only:
{
  "success": true,
  "error": "Summary of the error encountered, or null",
  "rootCause": "Detailed technical explanation of the root cause",
  "explanation": "Explanation of how you fixed it",
  "fixedCode": "The COMPLETE modified code block with the fix applied",
  "changes": ["List of changes made"],
  "confidence": 95
}`;

    const responseText = await callAI(systemPrompt, prompt, 'application/json');
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    }
    const result = JSON.parse(cleaned);
    res.json(result);
  } catch (err) {
    console.error('Stateless debug error:', err);
    res.status(500).json({ error: 'Stateless debugging failed.' });
  }
});

// New Cloudflare Sandbox-verified code debugging route
router.post('/run', authMiddleware, async (req, res) => {
  const { language, code, error, context } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Code block is required for debugging.' });
  }

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
    console.log(`Cloudflare Sandbox debug verification attempt ${attempt}/${maxAttempts}...`);

    const systemPrompt = `You are Mirror AI - a professional code repair engine.
Analyze the user's code, error message, and context. Propose a root cause diagnosis and fix.
Return valid JSON only containing:
- rootCause: string
- whyItHappened: string
- fixedCode: string (COMPLETE corrected code block)
- changes: string[]
- testsPerformed: string (tests to run/verify this code)
- remainingIssues: string
- preventionAdvice: string`;

    const prompt = `
Programming Language: ${language}
Current Code:
${currentCode}

Current Error Log:
${currentError || 'No error log provided.'}

Context:
${context || 'No additional context.'}

Return JSON only.`;

    try {
      const aiResponse = await callAI(systemPrompt, prompt, 'application/json');
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
          body: JSON.stringify({ language, code: latestResult.fixedCode })
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
          currentCode = latestResult.fixedCode;
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
${latestResult.whyItHappened}

### ⚠️ Original Error
${error || 'No error log provided.'}

### ⚙️ Tests Performed
${latestResult.testsPerformed}

### 📌 Remaining Issues
${latestResult.remainingIssues}

### 🛡️ Prevention Advice
${latestResult.preventionAdvice}
`;

  res.json({
    success: executionSuccess,
    diagnosis: reportMarkdown.trim(),
    fixedCode: latestResult.fixedCode,
    execution: {
      stdout: executionStdout,
      stderr: executionStderr,
      exitCode: executionExitCode
    },
    testsPassed: executionSuccess
  });
});

export default router;
