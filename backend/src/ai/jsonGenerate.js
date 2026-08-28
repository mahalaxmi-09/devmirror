import { getAIProvider } from './providerFactory.js';
import { AIProviderError } from './provider.js';

export async function generateStructuredJson(prompt, systemInstruction) {
  let provider;
  try {
    provider = getAIProvider();
  } catch (err) {
    const wrapped = new Error('Mirror AI is temporarily unavailable.');
    wrapped.code = 'AI_SERVICE_UNAVAILABLE';
    throw wrapped;
  }

  if (typeof provider.generateJson !== 'function') {
    const wrapped = new Error('Mirror AI is temporarily unavailable.');
    wrapped.code = 'AI_SERVICE_UNAVAILABLE';
    throw wrapped;
  }

  try {
    return await provider.generateJson(prompt, systemInstruction);
  } catch (err) {
    const wrapped = new Error('Mirror AI is temporarily unavailable.');
    wrapped.code = 'AI_SERVICE_UNAVAILABLE';
    wrapped.cause = err instanceof AIProviderError ? err : undefined;
    throw wrapped;
  }
}
