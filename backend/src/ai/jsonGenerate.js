import { getAIProvider } from './providerFactory.js';
import { AIProviderError } from './provider.js';

export async function generateStructuredJson(prompt, systemInstruction) {
  let provider;
  try {
    provider = getAIProvider();
  } catch {
    const wrapped = new Error('Mirror AI is temporarily unavailable.');
    wrapped.code = 'AI_SERVICE_UNAVAILABLE';
    throw wrapped;
  }

  if (typeof provider.generateJson !== 'function') {
    const wrapped = new Error('Mirror AI is temporarily unavailable.');
    wrapped.code = 'AI_SERVICE_UNAVAILABLE';
    throw wrapped;
  }

  let lastError;
  try {
    return await provider.generateJson(prompt, systemInstruction);
  } catch (err) {
    lastError = err;
    console.error('Structured JSON generation failed:', String(err?.message || 'unknown').slice(0, 180));
    const wrapped = new Error('Mirror AI is temporarily unavailable.');
    wrapped.code = 'AI_SERVICE_UNAVAILABLE';
    wrapped.cause = lastError;
    throw wrapped;
  }
}
