import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BACKEND_ROOT = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });

const PLACEHOLDER_KEYS = new Set([
  '',
  'YOUR_NEW_KEY',
  'your_gemini_api_key_here',
  'your_actual_gemini_api_key',
  'sk-your-key',
  'changeme'
]);

function readKey(name) {
  const key = process.env[name];
  if (!key || PLACEHOLDER_KEYS.has(String(key).trim())) return null;
  return String(key).trim();
}

export function getAIProviderName() {
  return String(process.env.AI_PROVIDER || 'gemini').trim().toLowerCase();
}

export function getGeminiApiKey() {
  return readKey('GEMINI_API_KEY');
}

export function getGeminiModel() {
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

export function getGeminiModelCandidates() {
  const primary = getGeminiModel();
  const extras = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-3.7-flash'];
  return [primary, ...extras.filter((m) => m !== primary)];
}

export function getOpenAIApiKey() {
  return readKey('OPENAI_API_KEY');
}

export function getOpenAIModel() {
  return process.env.OPENAI_MODEL || 'gpt-4o';
}

export function getAnthropicApiKey() {
  return readKey('ANTHROPIC_API_KEY');
}

export function getAnthropicModel() {
  return process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
}

export function isGeminiConfigured() {
  return Boolean(getGeminiApiKey());
}
