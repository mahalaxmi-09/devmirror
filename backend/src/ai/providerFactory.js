import { getAIProviderName, getGeminiApiKey, getOpenAIApiKey, getAnthropicApiKey, getGroqApiKey } from '../config/env.js';
import { GeminiProvider } from './geminiProvider.js';
import { OpenAIProvider } from './openaiProvider.js';
import { AnthropicProvider } from './anthropicProvider.js';
import { GroqProvider } from './groqProvider.js';
import { AIProviderError } from './provider.js';

const PROVIDER_ORDER = ['groq', 'gemini', 'openai', 'anthropic'];

export function getConfiguredProviderNames() {
  const configured = [];
  if (getGroqApiKey()) configured.push('groq');
  if (getGeminiApiKey()) configured.push('gemini');
  if (getOpenAIApiKey()) configured.push('openai');
  if (getAnthropicApiKey()) configured.push('anthropic');
  const primary = getAIProviderName();
  const ordered = [primary, ...PROVIDER_ORDER.filter((p) => p !== primary)];
  return ordered.filter((name) => configured.includes(name));
}

export function getAIProviderByName(name) {
  if (name === 'groq') {
    if (!getGroqApiKey()) {
      throw new AIProviderError('AI SERVICE UNAVAILABLE', { code: 'AI_SERVICE_UNAVAILABLE', provider: 'groq' });
    }
    return new GroqProvider();
  }
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
  throw new AIProviderError(`Unknown AI provider '${name}'.`, {
    code: 'AI_PROVIDER_CONFIG_ERROR',
    provider: name
  });
}

export function getAIProvider() {
  const names = getConfiguredProviderNames();
  if (!names.length) {
    throw new AIProviderError('AI SERVICE UNAVAILABLE', { code: 'AI_SERVICE_UNAVAILABLE', provider: getAIProviderName() });
  }
  return getAIProviderByName(names[0]);
}

export async function pingProvider(name) {
  try {
    const provider = getAIProviderByName(name);
    const health = await provider.healthCheck();
    return {
      provider: provider.name,
      model: provider.model,
      status: health.ok ? 'connected' : 'unavailable'
    };
  } catch (err) {
    const safe = String(err?.message || 'unavailable');
    const redacted = safe
      .replace(/sk-[A-Za-z0-9_\-]+/g, '[redacted]')
      .replace(/AIza[A-Za-z0-9_\-]+/g, '[redacted]')
      .replace(/AQ\.[A-Za-z0-9_\-]+/g, '[redacted]');
    return { provider: name, status: 'unavailable', reason: redacted.slice(0, 120) };
  }
}

export async function pingAllProviders() {
  const names = getConfiguredProviderNames();
  const results = await Promise.all(names.map((name) => pingProvider(name)));
  const connected = results.find((r) => r.status === 'connected');
  return {
    primary: getAIProviderName(),
    status: connected ? 'connected' : 'unavailable',
    provider: connected?.provider || getAIProviderName(),
    model: connected?.model,
    providers: results
  };
}

export async function pingSelectedProvider() {
  const summary = await pingAllProviders();
  if (summary.status === 'connected') {
    const payload = {
      provider: summary.provider,
      model: summary.model,
      status: 'connected',
      providers: summary.providers
    };
    if (summary.provider === 'gemini') payload.gemini = 'connected';
    return payload;
  }
  console.error('AI health check failed: no connected provider');
  const payload = {
    provider: summary.primary,
    status: 'unavailable',
    providers: summary.providers
  };
  if (summary.primary === 'gemini') payload.gemini = 'unavailable';
  return payload;
}
