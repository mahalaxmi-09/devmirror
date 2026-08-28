import { GoogleGenAI } from '@google/genai';
import { getGeminiApiKey, getGeminiModel, isGeminiConfigured } from '../config/env.js';

let client = null;

export function getGeminiClient() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export { getGeminiModel, isGeminiConfigured };

export async function generateJson(prompt, systemInstruction) {
  const ai = getGeminiClient();
  if (!ai) {
    const err = new Error('AI SERVICE UNAVAILABLE');
    err.code = 'AI_SERVICE_UNAVAILABLE';
    throw err;
  }

  const response = await ai.models.generateContent({
    model: getGeminiModel(),
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json'
    }
  });

  const text = (response.text || '').trim();
  if (!text) {
    const err = new Error('AI SERVICE UNAVAILABLE');
    err.code = 'AI_SERVICE_UNAVAILABLE';
    throw err;
  }

  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned);
}

export async function pingGemini() {
  const ai = getGeminiClient();
  const model = getGeminiModel();
  if (!ai) {
    return { ok: false, model };
  }

  const response = await ai.models.generateContent({
    model,
    contents: 'Reply with the single word pong.',
    config: { maxOutputTokens: 16 }
  });

  const text = response.text;
  if (text === undefined || text === null) {
    return { ok: false, model };
  }
  return { ok: true, model };
}
