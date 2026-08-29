import OpenAI from 'openai';
import { getGroqApiKey, getGroqModel } from '../config/env.js';
import {
  AIProvider,
  AIProviderError,
  parseModelJson,
  sanitizeProviderError
} from './provider.js';

export class GroqProvider extends AIProvider {
  constructor() {
    const model = getGroqModel() || 'groq/compound';
    super({ name: 'groq', model });
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      throw new AIProviderError('AI SERVICE UNAVAILABLE', { code: 'AI_SERVICE_UNAVAILABLE', provider: 'groq' });
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1'
    });
  }

  async generateJson(prompt, systemInstruction) {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: `${systemInstruction}\nReturn valid JSON only.` },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2048
      });
      const text = response.choices?.[0]?.message?.content;
      return parseModelJson(text);
    } catch (err) {
      throw new AIProviderError(sanitizeProviderError(err.message || 'AI_PROVIDER_ERROR'), { provider: 'groq' });
    }
  }

  async healthCheck() {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Reply with the single word pong.' }],
        max_tokens: 16
      });
      const text = response.choices?.[0]?.message?.content;
      if (text === undefined || text === null) {
        return { ok: false, provider: this.name, model: this.model };
      }
      return { ok: true, provider: this.name, model: this.model };
    } catch (err) {
      console.error('Groq health check failed:', err);
      return { ok: false, provider: this.name, model: this.model, reason: err.message };
    }
  }
}
