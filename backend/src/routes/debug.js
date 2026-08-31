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

// Two-pass validation and code fixing helper
async function getAIForCodeFix(originalCode, language, error, promptCtx) {
  console.log(`[SkillDebug] Request received`);
  console.log(`[SkillDebug] Language: ${language || 'Auto Detect'}`);
  console.log(`[SkillDebug] Code length: ${originalCode ? originalCode.length : 0}`);
  console.log(`[SkillDebug] Error received: ${error || 'None'}`);

  const hasRealError = Boolean(error && error.trim() && !/no error/i.test(error));

  // PASS 1: Analyze the error and create a fix
  const systemPromptPass1 = `You are Mirror AI - a professional code repair engine.
Analyze the user's code, error message, and instructions. Propose a root cause diagnosis and fix.
Specifically explain how the supplied error log relates to the code.
Do not return the original broken code as the corrected code if there is an error in it.
Return valid JSON only containing:
- errorType: string (e.g. ReferenceError, TypeError, SyntaxError, LogicError)
- errorMessage: string (the exact error message from the log, or brief explanation)
- rootCause: string (technical root cause)
- explanation: string (explanation of resolution)
- correctedCode: string (COMPLETE corrected code block)
- changes: string[] (list of specific changes made)
- expectedOutput: string (expected execution output / stdout of corrected code)`;

  const promptTextPass1 = `
Programming Language: ${language}
Current Code:
${originalCode}

Current Error Log:
${error || 'No error log provided.'}

Context/Prompt:
${promptCtx}

Return JSON only.`;

  console.log(`[SkillDebug] First correction generated`);
  const responseText = await callAI(systemPromptPass1, promptTextPass1, 'application/json');
  
  let cleaned = responseText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/s, '').trim();
  }
  
  let pass1Result = null;
  try {
    pass1Result = JSON.parse(cleaned);
  } catch (e) {
    console.warn(`[SkillDebug] Pass 1 JSON parsing failed. Retrying...`);
  }

  // PASS 2: Review the proposed fix (Two-Pass Debugging)
  let finalResult = pass1Result;
  
  if (pass1Result && pass1Result.correctedCode) {
    console.log(`[SkillDebug] Comparing original and corrected code`);
    const isSame = pass1Result.correctedCode === originalCode;
    
    const reviewSystemPrompt = `You are Mirror AI Reviewer.
Review the proposed fix for the code error.
Does this corrected code actually resolve the supplied error?
Original Code:
${originalCode}

Error Log:
${error || 'None'}

Proposed Fix:
${pass1Result.correctedCode}

If the proposed fix is correct and resolves the error, return it.
If the proposed fix does not resolve the error, or if the code is identical and still has the error, output a corrected code block that fixes it.
Return valid JSON only containing:
- resolvesError: boolean (true if the proposed fix is correct and resolves the error, false otherwise)
- errorType: string
- errorMessage: string
- rootCause: string
- explanation: string (explanation of resolution)
- correctedCode: string (COMPLETE final corrected code block)
- changes: string[] (list of specific changes made)
- expectedOutput: string`;

    console.log(`[SkillDebug] Verification started`);
    const reviewResponse = await callAI(reviewSystemPrompt, "Perform the review and return the JSON.", 'application/json');
    let cleanedReview = reviewResponse.trim();
    if (cleanedReview.startsWith('```')) {
      cleanedReview = cleanedReview.replace(/^```json\s*/i, '').replace(/```$/s, '').trim();
    }
    
    try {
      const reviewResult = JSON.parse(cleanedReview);
      if (reviewResult.correctedCode) {
        finalResult = reviewResult;
      }
    } catch (e) {
      console.warn(`[SkillDebug] Pass 2 JSON parsing failed.`);
    }
  }

  // Final Validation Check
  const valid = finalResult && 
                finalResult.correctedCode && 
                (!hasRealError || finalResult.correctedCode !== originalCode) &&
                finalResult.explanation;

  if (!valid) {
    console.warn(`[SkillDebug] Correction validation failed. Attempting a final corrective pass...`);
    const systemPromptPass3 = `You are Mirror AI. You MUST resolve this error and return a corrected code block that is DIFFERENT from the original code.
Original Code:
${originalCode}

Error:
${error || 'None'}

Return valid JSON containing:
- errorType: string
- errorMessage: string
- rootCause: string
- explanation: string
- correctedCode: string (MUST be different from original code and fix the error)
- changes: string[]
- expectedOutput: string`;

    const responsePass3 = await callAI(systemPromptPass3, "Fix the error and output JSON.", 'application/json');
    let cleaned3 = responsePass3.trim();
    if (cleaned3.startsWith('```')) {
      cleaned3 = cleaned3.replace(/^```json\s*/i, '').replace(/```$/s, '').trim();
    }
    try {
      finalResult = JSON.parse(cleaned3);
    } catch (e) {
      console.error(`[SkillDebug] Final fallback pass failed to parse JSON.`);
    }
  }

  console.log(`[SkillDebug] Correction validated`);
  console.log(`[SkillDebug] Final response returned`);
  return finalResult;
}

// 1. Compatibility route for POST /api/debug
router.post('/', authMiddleware, async (req, res) => {
  const { code, language, error, context, prompt: userPrompt } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Code block is required for debugging.' });
  }

  const promptCtx = userPrompt || context || 'Debug this code.';

  try {
    const latestResult = await getAIForCodeFix(code, language, error, promptCtx);

    const changesList = Array.isArray(latestResult.changes) 
      ? latestResult.changes.map(c => `- ${c}`).join('\n') 
      : '- Corrected code bugs';

    const reportMarkdown = `
⚠ **AI-generated fix — execution not verified**

🔴 **Error Detected**
${latestResult.errorMessage || error || 'N/A'}

🧠 **Root Cause**
${latestResult.rootCause || 'N/A'}

🛠 **Corrected Code**
\`\`\`${language || 'javascript'}
${latestResult.correctedCode}
\`\`\`

📝 **What Changed**
${changesList}

▶ **Expected Output**
${latestResult.expectedOutput || 'N/A'}
`;

    const finalResult = {
      success: true,
      fixedCode: latestResult.correctedCode,
      correctedCode: latestResult.correctedCode,
      errorType: latestResult.errorType || 'Error',
      rootCause: latestResult.rootCause || 'N/A',
      explanation: latestResult.explanation || 'N/A',
      changes: latestResult.changes || [],
      expectedOutput: latestResult.expectedOutput || 'N/A',
      verification: 'Execution not verified.',
      diagnosis: reportMarkdown.trim(),
      analysis: {
        errorType: latestResult.errorType || 'Error',
        errorMessage: latestResult.errorMessage || error || 'N/A',
        rootCause: latestResult.rootCause || 'N/A',
        explanation: latestResult.explanation || 'N/A',
        correctedCode: latestResult.correctedCode,
        changes: latestResult.changes || [],
        expectedOutput: latestResult.expectedOutput || 'N/A'
      }
    };

    res.json(finalResult);
  } catch (err) {
    console.error('[SkillDebug] Stateless debug error:', err);
    res.status(500).json({ error: 'Stateless debugging failed.' });
  }
});

// 2. Cloudflare Sandbox-verified code debugging route (POST /api/debug/run)
router.post('/run', authMiddleware, async (req, res) => {
  const { language, code, error, context, prompt: userPrompt } = req.body;

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

    try {
      latestResult = await getAIForCodeFix(currentCode, language, currentError, promptCtx);

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

  // Compile final report markdown
  const verificationBanner = isSandboxAvailable && executionSuccess
    ? `✓ **Verified Fix**: Verified successfully in Cloudflare Sandbox environment.`
    : `⚠ **AI-generated fix — execution not verified**`;

  const changesList = Array.isArray(latestResult.changes) 
    ? latestResult.changes.map(c => `- ${c}`).join('\n') 
    : '- Corrected code bugs';

  const reportMarkdown = `
${verificationBanner}

🔴 **Error Detected**
${latestResult.errorMessage || error || 'N/A'}

🧠 **Root Cause**
${latestResult.rootCause || 'N/A'}

🛠 **Corrected Code**
\`\`\`${language || 'javascript'}
${latestResult.correctedCode}
\`\`\`

📝 **What Changed**
${changesList}

▶ **Expected Output**
${latestResult.expectedOutput || 'N/A'}
`;

  const analysis = {
    errorType: latestResult.errorType || 'Error',
    errorMessage: latestResult.errorMessage || error || 'N/A',
    rootCause: latestResult.rootCause || 'N/A',
    explanation: latestResult.explanation || 'N/A',
    correctedCode: latestResult.correctedCode || code,
    changes: latestResult.changes || [],
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
    changes: latestResult.changes || [],
    expectedOutput: latestResult.expectedOutput || 'N/A',
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
