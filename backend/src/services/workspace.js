import fs from 'fs';
import path from 'path';
import { BACKEND_ROOT } from '../config/env.js';

export const SANDBOX_ROOT = path.join(BACKEND_ROOT, 'sandbox');

const IGNORED_NAMES = new Set([
  'node_modules',
  '.git',
  '.env',
  '.env.local',
  '.venv',
  'venv',
  '__pycache__',
  '.DS_Store',
  'dist',
  'build',
  'coverage',
  '.backups'
]);

const SENSITIVE_FILES = /\.(pem|p12|pfx|key)$/i;
const BINARY_EXT = /\.(png|jpg|jpeg|gif|webp|pdf|zip|tar|gz|woff|woff2|ttf|exe|dll|so|dylib|bin|class|o)$/i;

export function missionWorkspaceDir(missionId) {
  return path.join(SANDBOX_ROOT, `mission_${missionId}`);
}

export function ensureSandboxRoot() {
  if (!fs.existsSync(SANDBOX_ROOT)) {
    fs.mkdirSync(SANDBOX_ROOT, { recursive: true });
  }
}

export function createWorkspace(missionId) {
  ensureSandboxRoot();
  const dir = missionWorkspaceDir(missionId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmp = path.join(dir, '.tmp');
  if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
  return dir;
}

export function resolveSafePath(missionId, relPath = '.') {
  const root = path.resolve(missionWorkspaceDir(missionId));
  if (!relPath || relPath === '.') return root;
  const normalized = String(relPath).replace(/\\/g, '/');
  if (path.isAbsolute(normalized) || normalized.includes('\0')) {
    const err = new Error('Path escape rejected.');
    err.code = 'PATH_ESCAPE';
    throw err;
  }
  if (normalized.split('/').some((part) => part === '..')) {
    const err = new Error('Path traversal rejected.');
    err.code = 'PATH_ESCAPE';
    throw err;
  }
  const resolved = path.resolve(root, normalized);
  const rel = path.relative(root, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    const err = new Error('Workspace traversal rejected.');
    err.code = 'PATH_ESCAPE';
    throw err;
  }
  if (fs.existsSync(resolved)) {
    const realRoot = fs.realpathSync(root);
    const realResolved = fs.realpathSync(resolved);
    const realRel = path.relative(realRoot, realResolved);
    if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
      const err = new Error('Symlink escape rejected.');
      err.code = 'PATH_ESCAPE';
      throw err;
    }
    return realResolved;
  }
  return resolved;
}

export function shouldIgnoreEntry(relPath) {
  const parts = relPath.split(/[/\\]/);
  if (parts.some((p) => IGNORED_NAMES.has(p))) return true;
  const base = path.basename(relPath);
  if (base === '.env' || base.startsWith('.env.')) return true;
  if (SENSITIVE_FILES.test(base)) return true;
  return false;
}

export function writeWorkspaceFile(missionId, filename, content) {
  const target = resolveSafePath(missionId, filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  return target;
}

export function syncFilesToWorkspace(missionId, files = []) {
  const dir = createWorkspace(missionId);
  for (const file of files) {
    if (!file?.filename || shouldIgnoreEntry(file.filename)) continue;
    writeWorkspaceFile(missionId, file.filename, file.file_content ?? '');
  }
  return dir;
}

export function listWorkspaceFiles(missionId, rel = '.') {
  const start = resolveSafePath(missionId, rel);
  const root = path.resolve(missionWorkspaceDir(missionId));
  const results = [];

  const walk = (abs) => {
    if (!fs.existsSync(abs)) return;
    const stat = fs.lstatSync(abs);
    if (stat.isSymbolicLink()) return;
    const relPath = path.relative(root, abs).replace(/\\/g, '/') || '.';
    if (relPath !== '.' && shouldIgnoreEntry(relPath)) return;
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(abs)) {
        walk(path.join(abs, entry));
      }
      return;
    }
    if (stat.size > 2_000_000) return;
    if (BINARY_EXT.test(abs)) return;
    results.push(relPath);
  };

  walk(start);
  return results.sort();
}

export function readWorkspaceText(missionId, relPath) {
  const abs = resolveSafePath(missionId, relPath);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    const err = new Error('File not found.');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const stat = fs.statSync(abs);
  if (stat.size > 1_000_000) {
    const err = new Error('File too large to read.');
    err.code = 'TOO_LARGE';
    throw err;
  }
  return fs.readFileSync(abs, 'utf8');
}
