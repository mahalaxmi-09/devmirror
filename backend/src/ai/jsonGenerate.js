import { getConfiguredProviderNames, getAIProviderByName } from './providerFactory.js';

function isRetryable(err) {
  const msg = String(err?.message || err?.cause?.message || '');
  return /429|quota|503|UNAVAILABLE|high demand|overloaded|rate limit/i.test(msg);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateStructuredJson(prompt, systemInstruction) {
  const providers = getConfiguredProviderNames();
  if (!providers.length) {
    const err = new Error('Mirror AI is temporarily unavailable. Add GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY in backend/.env');
    err.code = 'AI_SERVICE_UNAVAILABLE';
    throw err;
  }

  let lastError;
  for (const name of providers) {
    let provider;
    try {
      provider = getAIProviderByName(name);
    } catch (err) {
      lastError = err;
      continue;
    }
    if (typeof provider.generateJson !== 'function') continue;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await provider.generateJson(prompt, systemInstruction);
      } catch (err) {
        lastError = err;
        console.error(`Mirror JSON via ${name} failed (attempt ${attempt + 1}):`, String(err?.message || 'unknown').slice(0, 180));
        if (attempt < 3 && isRetryable(err)) {
          await sleep(2000 * (attempt + 1));
          continue;
        }
        break;
      }
    }
  }

  const wrapped = new Error('Mirror AI is temporarily unavailable. AI provider quota may be exceeded — check backend/.env keys.');
  wrapped.code = 'AI_SERVICE_UNAVAILABLE';
  wrapped.cause = lastError;
  throw wrapped;
}
