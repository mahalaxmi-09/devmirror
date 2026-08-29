import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { generateStructuredJson } from '../ai/jsonGenerate.js';

function getSystemPromptForMode(mode) {
  const basePrompt = `You are DevMirror Mirror AI, an expert software debugging and code repair agent.

Analyze the supplied source code, user request, and context attachments.

Never invent an error.
Identify the exact problem when one exists.
Explain the root cause clearly.
Produce a corrected version of the code.
Preserve the user's intended functionality.
Do not unnecessarily rewrite working code.

Return structured JSON containing exactly these fields:
- problem: string (empty if code is already correct)
- explanation: string (clear root-cause explanation)
- fixedCode: string (full corrected source code)
- changes: string[] (concise list of what changed)
- severity: "none" | "low" | "medium" | "high" | "critical"
- verificationNotes: string (how to verify the fix; do not claim execution happened)

If the code is already correct, explicitly say that it is correct instead of inventing a bug.
Set severity to "none" when no bug exists and fixedCode should equal the original code.`;

  switch (mode) {
    case 'quick':
      return `${basePrompt}\nProvide a extremely concise, rapid diagnosis and a direct code fix immediately. Skip long secondary details.`;
    case 'deep':
      return `${basePrompt}\nConduct an exhaustive root-cause analysis. Scan for edge cases, performance trade-offs, state mutations, and architectural implications in detail.`;
    case 'review':
      return `${basePrompt}\nAnalyze this as a senior staff code reviewer. Target readability, code smells, duplicate statements, architectural patterns, compliance, and clean formatting.`;
    case 'security':
      return `${basePrompt}\nAnalyze this as an expert application security auditor. Scan for OWASP Top 10 vulnerabilities, input injection risks, memory safety concerns, parameter validation, and cryptography errors.`;
    case 'performance':
      return `${basePrompt}\nAnalyze this as a performance optimization engineer. Assess asymptotic big-O complexity, runtime bottlenecks, redundant cycles, and resource leaks.`;
    case 'explain':
      return `${basePrompt}\nAnalyze this as an empathetic tech lead educator. Explain every concept, line, and function call step-by-step to maximize student comprehension.`;
    case 'interview':
      return `${basePrompt}\nPresent the explanation in a structured style typical of senior engineering design interviews. Conclude with 2-3 advanced conceptual verification follow-up questions.`;
    default:
      return basePrompt;
  }
}

const SUPPORTED_LANGUAGES = new Set([
  'javascript',
  'typescript',
  'python',
  'java',
  'go',
  'cpp',
  'c',
  'csharp',
  'php',
  'ruby',
  'rust',
  'kotlin',
  'swift',
  'sql',
  'html',
  'css',
  'json'
]);

const RUNNABLE_LANGUAGES = new Set(['javascript', 'typescript', 'python']);

const VERIFY_TIMEOUT_MS = 15_000;
const MAX_OUTPUT = 50_000;

function normalizeLanguage(language) {
  const raw = String(language || 'javascript').trim().toLowerCase();
  const aliases = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    'c++': 'cpp',
    'c#': 'csharp'
  };
  return aliases[raw] || raw;
}

function buildAnalysisPrompt({ code, language, request }) {
  return `Language: ${language}

User request:
${request}

Source code:
\`\`\`${language}
${code}
\`\`\`

Respond with JSON only.`;
}

function normalizeAiResult(raw, originalCode) {
  const problem = String(raw?.problem || '').trim();
  const explanation = String(raw?.explanation || '').trim();
  const fixedCode = String(raw?.fixedCode || raw?.fixed_code || '').trim() || originalCode;
  const changes = Array.isArray(raw?.changes)
    ? raw.changes.map((c) => String(c).trim()).filter(Boolean)
    : [];
  const severity = String(raw?.severity || (problem ? 'medium' : 'none')).toLowerCase();
  const verificationNotes = String(raw?.verificationNotes || raw?.verification_notes || '').trim();

  const analysisParts = [explanation];
  if (problem) analysisParts.unshift(`Problem: ${problem}`);
  if (severity && severity !== 'none') analysisParts.push(`Severity: ${severity}`);
  if (verificationNotes) analysisParts.push(`Verification notes: ${verificationNotes}`);

  return {
    problem,
    explanation,
    fixedCode,
    changes,
    severity,
    verificationNotes,
    analysis: analysisParts.filter(Boolean).join('\n\n'),
    error: problem || null,
    reasoning: explanation
  };
}

function truncate(text) {
  const s = String(text || '');
  if (s.length <= MAX_OUTPUT) return s;
  return `${s.slice(0, MAX_OUTPUT)}\n…[truncated]`;
}

function runProcess(bin, args, cwd) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    const child = spawn(bin, args, {
      cwd,
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      if (!settled) {
        settled = true;
        resolve({
          stdout: truncate(stdout),
          stderr: truncate(`${stderr}\nProcess timed out after ${VERIFY_TIMEOUT_MS}ms.`),
          exitCode: 124
        });
      }
    }, VERIFY_TIMEOUT_MS);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout: truncate(stdout), stderr: truncate(err.message), exitCode: 127 });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout: truncate(stdout), stderr: truncate(stderr), exitCode: code ?? 1 });
    });
  });
}

export function isLanguageSupported(language) {
  return SUPPORTED_LANGUAGES.has(normalizeLanguage(language));
}

export function isLanguageRunnable(language) {
  return RUNNABLE_LANGUAGES.has(normalizeLanguage(language));
}

export async function analyzeCode({ code, language, request, mode = 'deep' }) {
  const lang = normalizeLanguage(language);

  if (!code || !String(code).trim()) {
    const err = new Error('Source code is required.');
    err.status = 400;
    throw err;
  }
  if (!request || !String(request).trim()) {
    const err = new Error('A debugging request is required.');
    err.status = 400;
    throw err;
  }
  if (!isLanguageSupported(lang)) {
    const err = new Error(`Unsupported language "${language}". Supported: ${[...SUPPORTED_LANGUAGES].join(', ')}`);
    err.status = 400;
    throw err;
  }

  const prompt = buildAnalysisPrompt({ code: String(code), language: lang, request: String(request).trim() });

  let raw;
  try {
    raw = await generateStructuredJson(prompt, getSystemPromptForMode(mode));
  } catch (error) {
    if (error.code === 'AI_SERVICE_UNAVAILABLE') {
      const err = new Error(error.message || 'Mirror AI is temporarily unavailable.');
      err.status = 503;
      err.code = 'AI_SERVICE_UNAVAILABLE';
      throw err;
    }
    const err = new Error('Failed to analyze code with AI provider.');
    err.status = 502;
    throw err;
  }

  if (!raw || typeof raw !== 'object') {
    const err = new Error('AI returned an invalid response format.');
    err.status = 502;
    throw err;
  }

  const normalized = normalizeAiResult(raw, String(code));

  return {
    success: true,
    ...normalized,
    verification: {
      status: 'not_run',
      output: normalized.verificationNotes || 'Verification has not been executed. Use the Verify action to run the code.'
    }
  };
}

export async function verifyCode({ code, language }) {
  const lang = normalizeLanguage(language);

  if (!code || !String(code).trim()) {
    const err = new Error('Source code is required.');
    err.status = 400;
    throw err;
  }
  if (!isLanguageSupported(lang)) {
    const err = new Error(`Unsupported language "${language}".`);
    err.status = 400;
    throw err;
  }
  if (!isLanguageRunnable(lang)) {
    return {
      success: true,
      verification: {
        status: 'unsupported',
        output: `Automatic execution is not available for ${lang}. Review the proposed fix manually.`,
        exitCode: null
      }
    };
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devmirror-mirror-'));
  try {
    let fileName;
    let command;
    if (lang === 'python') {
      fileName = 'snippet.py';
      command = { bin: 'python3', args: [fileName] };
    } else {
      fileName = lang === 'typescript' ? 'snippet.ts' : 'snippet.js';
      command = { bin: 'node', args: [fileName] };
    }

    fs.writeFileSync(path.join(tmpDir, fileName), String(code), 'utf8');
    const result = await runProcess(command.bin, command.args, tmpDir);
    const combined = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    const passed = result.exitCode === 0;

    return {
      success: true,
      verification: {
        status: passed ? 'passed' : 'failed',
        output: combined || (passed ? 'Program exited successfully with no output.' : 'Program failed with no output.'),
        exitCode: result.exitCode
      }
    };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
