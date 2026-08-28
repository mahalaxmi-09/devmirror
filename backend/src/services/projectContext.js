import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

const TEXT_EXT = new Set([
  '.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.java', '.go', '.rb', '.css', '.html', '.csv', '.yml', '.yaml',
  '.xml', '.sql', '.sh', '.env.example'
]);

function safeReadText(filePath, max = 20000) {
  try {
    return fs.readFileSync(filePath, 'utf8').slice(0, max);
  } catch {
    return '';
  }
}

function extractZipSummary(filePath) {
  try {
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries().filter((e) => !e.isDirectory);
    const names = entries.slice(0, 80).map((e) => e.entryName);
    const textFiles = entries.filter((e) => {
      const ext = path.extname(e.entryName).toLowerCase();
      const lower = e.entryName.toLowerCase();
      if (lower.includes('node_modules/') || lower.includes('.git/')) return false;
      return TEXT_EXT.has(ext);
    }).slice(0, 12);

    const snippets = textFiles.map((e) => {
      const body = e.getData().toString('utf8').slice(0, 1500);
      return `--- ${e.entryName} ---\n${body}`;
    });

    return [
      `Uploaded ZIP listing (do not invent files beyond this list): ${names.join(', ')}`,
      ...snippets
    ].join('\n\n').slice(0, 20000);
  } catch {
    return 'A ZIP was uploaded but could not be read. Do not invent project details.';
  }
}

export function extractProjectContext({ filePath, originalName, pastedText } = {}) {
  const chunks = [];
  if (pastedText && String(pastedText).trim()) {
    chunks.push(String(pastedText).slice(0, 20000));
  }
  if (filePath && originalName) {
    const ext = path.extname(originalName).toLowerCase();
    if (ext === '.zip') {
      chunks.push(extractZipSummary(filePath));
    } else if (TEXT_EXT.has(ext)) {
      const text = safeReadText(filePath);
      chunks.push(text ? `Uploaded file ${originalName}:\n${text}` : `Uploaded file ${originalName} could not be read as text.`);
    } else {
      chunks.push(`User uploaded file "${originalName}". Binary content was not extracted. Do not invent project details from this filename alone.`);
    }
  }
  return chunks.filter(Boolean).join('\n\n').slice(0, 24000);
}
