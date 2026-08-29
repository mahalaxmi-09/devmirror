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
  if (process.env.AI_PROVIDER) {
    return String(process.env.AI_PROVIDER).trim().toLowerCase();
  }
  if (getGroqApiKey()) return 'groq';
  return 'gemini';
}

export function getGeminiApiKey() {
  const key = readKey('GEMINI_API_KEY');
  if (!key) return null;
  if (key.startsWith('AQ.') || key.startsWith('ya29.')) {
    console.warn('GEMINI_API_KEY looks like a short-lived OAuth token. Use a Google AI Studio key (starts with AIza).');
  }
  return key;
}

export function getGeminiKeyStatus() {
  const key = readKey('GEMINI_API_KEY');
  if (!key) return { configured: false, validFormat: false, hint: 'Set GEMINI_API_KEY in backend/.env' };
  if (key.startsWith('AIza')) return { configured: true, validFormat: true, hint: null };
  if (key.startsWith('AQ.') || key.startsWith('ya29.')) {
    return {
      configured: true,
      validFormat: false,
      hint: 'GEMINI_API_KEY appears to be a temporary token. Create a key at https://aistudio.google.com/apikey (starts with AIza).'
    };
  }
  return { configured: true, validFormat: true, hint: null };
}

export function getGeminiModel() {
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

export function getGeminiModelCandidates() {
  const primary = getGeminiModel();
  const extras = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];
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

export function getGroqApiKey() {
  return readKey('GROQ_API_KEY');
}

export function getGroqModel() {
  return process.env.GROQ_MODEL || 'groq/compound';
}

export function isGeminiConfigured() {
  return Boolean(getGeminiApiKey());
}
