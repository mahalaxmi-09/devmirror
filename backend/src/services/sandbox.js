import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const SANDBOX_ROOT = path.join(process.cwd(), 'sandbox');
const MAX_OUTPUT_CHARS = 50000;
const EXEC_TIMEOUT_MS = 6000;

if (!fs.existsSync(SANDBOX_ROOT)) {
  fs.mkdirSync(SANDBOX_ROOT, { recursive: true });
}

/**
 * Reject path traversal and absolute paths outside the sandbox root.
 */
export function resolveSafePath(baseDir, filename) {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename.');
  }

  const normalized = filename.replace(/\\/g, '/');
  if (
    path.isAbsolute(normalized) ||
    normalized.includes('..') ||
    normalized.startsWith('/')
  ) {
    throw new Error(`Path traversal rejected: ${filename}`);
  }

  const resolved = path.resolve(baseDir, normalized);
  const resolvedBase = path.resolve(baseDir);
  if (!resolved.startsWith(resolvedBase + path.sep) && resolved !== resolvedBase) {
    throw new Error(`Path traversal rejected: ${filename}`);
  }

  return resolved;
}

/**
 * Detect the best command to execute project files in the sandbox.
 */
export function detectRunCommand(files, preferredCommand) {
  if (preferredCommand) return preferredCommand;

  const names = files.map((f) => f.filename);
  const hasPackageJson = names.includes('package.json');

  if (hasPackageJson) {
    try {
      const pkgFile = files.find((f) => f.filename === 'package.json');
      const pkg = JSON.parse(pkgFile.file_content || '{}');
      if (pkg.scripts?.test) return 'npm test';
      if (pkg.scripts?.start) return 'npm start';
    } catch {
      return 'npm test';
    }
    return 'npm test';
  }

  if (names.includes('index.js')) return 'node index.js';
  if (names.includes('main.py')) return 'python main.py';
  if (names.includes('test.js')) return 'node test.js';

  const firstJs = names.find((n) => n.endsWith('.js'));
  if (firstJs) return `node ${firstJs}`;

  const firstPy = names.find((n) => n.endsWith('.py'));
  if (firstPy) return `python ${firstPy}`;

  return 'node index.js';
}

function truncateOutput(text) {
  if (!text) return '';
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return text.slice(0, MAX_OUTPUT_CHARS) + '\n...[output truncated]';
}

/**
 * Prepares the sandbox directory with files and runs a command.
 */
export const runInSandbox = async (missionId, files, command) => {
  const missionDir = path.join(SANDBOX_ROOT, String(missionId));

  try {
    if (fs.existsSync(missionDir)) {
      fs.rmSync(missionDir, { recursive: true, force: true });
    }
    fs.mkdirSync(missionDir, { recursive: true });

    for (const file of files) {
      const filePath = resolveSafePath(missionDir, file.filename);
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      fs.writeFileSync(filePath, file.file_content, 'utf8');
    }

    const runCommand = detectRunCommand(files, command);

    return new Promise((resolve) => {
      exec(runCommand, { cwd: missionDir, timeout: EXEC_TIMEOUT_MS }, (error, stdout, stderr) => {
        const exitCode = error ? (error.code || 1) : 0;
        resolve({
          stdout: truncateOutput(stdout || ''),
          stderr: truncateOutput(stderr || (error ? error.message : '')),
          exitCode,
          success: exitCode === 0,
          command: runCommand
        });
      });
    });
  } catch (error) {
    return {
      stdout: '',
      stderr: `Sandbox Setup Failure: ${error.message}`,
      exitCode: -1,
      success: false,
      command: command || null
    };
  }
};

/**
 * Remove a mission sandbox directory after completion.
 */
export function cleanupSandbox(missionId) {
  const missionDir = path.join(SANDBOX_ROOT, String(missionId));
  if (fs.existsSync(missionDir)) {
    fs.rmSync(missionDir, { recursive: true, force: true });
  }
}
