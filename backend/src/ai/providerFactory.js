import { getAIProviderName, getGeminiApiKey, getOpenAIApiKey, getAnthropicApiKey } from '../config/env.js';
import { GeminiProvider } from './geminiProvider.js';
import { OpenAIProvider } from './openaiProvider.js';
import { AnthropicProvider } from './anthropicProvider.js';
import { AIProviderError } from './provider.js';

export function getAIProvider() {
  const name = getAIProviderName();
  if (name === 'gemini') {
    if (!getGeminiApiKey()) {
      throw new AIProviderError('AI SERVICE UNAVAILABLE', { code: 'AI_SERVICE_UNAVAILABLE', provider: 'gemini' });
    }
    return new GeminiProvider();
  }
  if (name === 'openai') {
    if (!getOpenAIApiKey()) {
      throw new AIProviderError('AI SERVICE UNAVAILABLE', { code: 'AI_SERVICE_UNAVAILABLE', provider: 'openai' });
    }
    return new OpenAIProvider();
  }
  if (name === 'anthropic' || name === 'claude') {
    if (!getAnthropicApiKey()) {
      throw new AIProviderError('AI SERVICE UNAVAILABLE', { code: 'AI_SERVICE_UNAVAILABLE', provider: 'anthropic' });
    }
    return new AnthropicProvider();
  }
  throw new AIProviderError(`Unknown AI_PROVIDER '${name}'. Use gemini, openai, or anthropic.`, {
    code: 'AI_PROVIDER_CONFIG_ERROR',
    provider: name
  });
}

export async function pingSelectedProvider() {
  try {
    const provider = getAIProvider();
    const health = await provider.healthCheck();
    return {
      provider: provider.name,
      model: provider.model,
      status: health.ok ? 'connected' : 'unavailable',
      gemini: provider.name === 'gemini' && health.ok ? 'connected' : (provider.name === 'gemini' ? 'unavailable' : undefined)
    };
  } catch (err) {
    const safe = String(err?.message || 'unavailable');
    const redacted = safe
      .replace(/sk-[A-Za-z0-9_\-]+/g, '[redacted]')
      .replace(/AIza[A-Za-z0-9_\-]+/g, '[redacted]')
      .replace(/AQ\.[A-Za-z0-9_\-]+/g, '[redacted]');
    console.error('AI health check failed:', redacted.slice(0, 180));
    return {
      provider: getAIProviderName(),
      status: 'unavailable'
    };
  }
}
