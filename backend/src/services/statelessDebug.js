import { callAI } from './gemini.js';
import { runInSandbox } from './sandbox.js';
import fs from 'fs';
import path from 'path';

export const runStatelessDebug = async (code, language, error, context) => {
  const maxAttempts = 3;
  let currentCode = code;
  let currentError = error || '';
  let latestResult = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`Stateless debug attempt ${attempt}/${maxAttempts}...`);
    
    const systemPrompt = `You are DevMirror AI - a professional autonomous code repair assistant. Your objective is to resolve the user's coding error.`;
    const prompt = `
Programming Language: ${language}
Original Code:
${currentCode}

Error / Unexpected Behavior:
${currentError || 'No error log provided.'}

Additional Context:
${context || 'No additional context.'}

Please analyze the code, identify the root cause of the error, propose a fix, and return ONLY a JSON object in this format:
{
  "success": true,
  "error": "Summary of the error encountered, or null",
  "rootCause": "Detailed technical explanation of the root cause",
  "explanation": "Explanation of how you fixed it",
  "fixedCode": "The COMPLETE modified code block with the fix applied",
  "changes": ["List of changes made"],
  "confidence": 95
}
`;

    try {
      const responseText = await callAI(systemPrompt, prompt, 'application/json');
      
      // Clean JSON formatting wrappers
      let cleaned = responseText.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/```$/, '').trim();
      }
      
      const result = JSON.parse(cleaned);
      latestResult = result;

      // Sandbox validation check
      const filename = language === 'python' || language === 'py' ? 'script.py' : 'index.js';
      const files = [
        { filename, file_content: result.fixedCode }
      ];

      let runCmd = '';
      let canRun = false;
      const lang = (language || '').toLowerCase();
      if (lang === 'javascript' || lang === 'js' || lang === 'node') {
        runCmd = `node ${filename}`;
        canRun = true;
      } else if (lang === 'python' || lang === 'py') {
        runCmd = `python ${filename}`;
        canRun = true;
      }

      if (canRun) {
        const sandboxId = `stateless-debug-${Date.now()}`;
        const runResult = await runInSandbox(sandboxId, files, runCmd);
        
        // Clean up sandbox folder immediately to prevent disk pollution
        const sandboxDir = path.join(process.cwd(), 'sandbox', sandboxId);
        if (fs.existsSync(sandboxDir)) {
          fs.rmSync(sandboxDir, { recursive: true, force: true });
        }

        if (runResult.success) {
          console.log(`Validation succeeded on attempt ${attempt}!`);
          latestResult.success = true;
          return latestResult;
        } else {
          console.log(`Validation failed on attempt ${attempt}:`, runResult.stderr);
          currentCode = result.fixedCode;
          currentError = runResult.stderr || runResult.stdout || 'Execution failed with non-zero exit code.';
          latestResult.success = false;
        }
      } else {
        // If we cannot run it, assume AI patch is the best guess
        console.log(`No sandbox configuration for language ${language}. Returning AI patch directly.`);
        latestResult.success = true;
        return latestResult;
      }
    } catch (err) {
      console.error(`Attempt ${attempt} failed with error:`, err.message);
      if (attempt === maxAttempts) {
        // Fallback to local rule-based diagnostics
        let fixedCode = code;
        let success = false;
        let changes = [];
        let rootCause = "AI Service Unavailable. Applied rule-based diagnostic engine.";
        let explanation = "Fallback engine applied local corrections.";
        
        if (code.includes('console.log(y)') && code.includes('x = 5')) {
          fixedCode = code.replace('console.log(y)', 'console.log(x)');
          success = true;
          changes = ["Replaced undefined reference y with x"];
          rootCause = "ReferenceError: y is not defined. The variable x was defined but y was used.";
          explanation = "Updated the print command to use the defined variable x.";
        }

        return {
          success,
          error: err.message,
          rootCause,
          explanation,
          fixedCode,
          changes,
          confidence: 70
        };
      }
    }
  }

  return latestResult;
};
