import { GoogleGenAI } from '@google/genai';
import { getGeminiApiKey, getGeminiModel, getGeminiModelCandidates } from '../config/env.js';
import { geminiToolDeclarations } from '../services/debugTools.js';
import { AIProvider, AIProviderError, classifyText, toolCallResponse, DEBUG_SYSTEM_INSTRUCTION, sanitizeProviderError, parseModelJson } from './provider.js';

export class GeminiProvider extends AIProvider {
  constructor() {
    super({ name: 'gemini', model: getGeminiModel() });
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new AIProviderError('AI SERVICE UNAVAILABLE', { code: 'AI_SERVICE_UNAVAILABLE', provider: 'gemini' });
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  ensureState(context) {
    if (!context.providerState) {
      context.providerState = {
        contents: [
          {
            role: 'user',
            parts: this.buildInitialParts(context)
          }
        ]
      };
    }
  }

  buildInitialParts(context) {
    const parts = [{ text: context.userPrompt }];
    if (Array.isArray(context.images)) {
      for (const img of context.images) {
        if (img?.data && img?.mimeType) {
          parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
        }
      }
    }
    return parts;
  }

  async generateContent(contents, extraConfig = {}) {
    const candidates = this.workingModel
      ? [this.workingModel, ...getGeminiModelCandidates().filter((m) => m !== this.workingModel)]
      : getGeminiModelCandidates();
    let lastError;
    for (const model of candidates) {
      try {
        const response = await this.client.models.generateContent({
          model,
          contents,
          config: extraConfig
        });
        this.workingModel = model;
        this.model = model;
        return response;
      } catch (err) {
        lastError = err;
        const msg = String(err.message || '');
        const retryable = /not found|NOT_FOUND|invalid argument|UNAVAILABLE|high demand|503|404|overloaded/i.test(msg);
        if (!retryable) break;
      }
    }
    throw new AIProviderError(sanitizeProviderError(lastError?.message || 'AI_PROVIDER_ERROR'), { provider: 'gemini' });
  }

  async generate(context) {
    this.ensureState(context);
    return this.generateContent(context.providerState.contents, {
      systemInstruction: DEBUG_SYSTEM_INSTRUCTION,
      tools: [{ functionDeclarations: geminiToolDeclarations() }],
      automaticFunctionCalling: { disable: true }
    });
  }

  async healthCheck() {
    const response = await this.generateContent('Reply with the single word pong.', { maxOutputTokens: 64 });
    const text = response.text;
    const hasCandidate = Array.isArray(response.candidates) && response.candidates.length > 0;
    if ((text === undefined || text === null) && !hasCandidate) {
      return { ok: false, provider: this.name, model: this.model };
    }
    return { ok: true, provider: this.name, model: this.model };
  }

  appendModelContent(context, response) {
    const content = response.candidates?.[0]?.content;
    if (content) context.providerState.contents.push(content);
  }

  appendToolResults(context, toolResults = []) {
    if (!toolResults.length) return;
    context.providerState.contents.push({
      role: 'user',
      parts: toolResults.map((r) => ({
        functionResponse: {
          name: r.tool,
          response: r.result && typeof r.result === 'object' ? r.result : { result: r.result }
        }
      }))
    });
  }

  parseFunctionCalls(response) {
    const calls = [];
    if (Array.isArray(response.functionCalls) && response.functionCalls.length) {
      for (const fc of response.functionCalls) {
        calls.push({
          tool: fc.name,
          toolArguments: fc.args || fc.arguments || {},
          id: fc.id
        });
      }
    } else {
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.functionCall) {
          calls.push({
            tool: part.functionCall.name,
            toolArguments: part.functionCall.args || {},
            id: part.functionCall.id
          });
        }
      }
    }
    return calls;
  }

  async startDebugSession(context) {
    context.providerState = null;
    this.ensureState(context);
    return this.continueDebugSession(context);
  }

  async continueDebugSession(context, toolResults = []) {
    this.ensureState(context);
    this.appendToolResults(context, toolResults);
    const response = await this.generate(context);
    this.appendModelContent(context, response);
    const calls = this.parseFunctionCalls(response);
    if (calls.length) return toolCallResponse(calls, response.text || '');
    return classifyText(response.text || '');
  }

  async generateJson(prompt, systemInstruction) {
    const response = await this.generateContent(prompt, {
      systemInstruction,
      responseMimeType: 'application/json',
      maxOutputTokens: 2048
    });
    return parseModelJson(response.text);
  }

  async generateDiagnosis(context) {
    const response = await this.continueDebugSession(context);
    return { ...response, type: response.type === 'final' ? 'diagnosis' : response.type };
  }

  async generatePatch(context) {
    const response = await this.continueDebugSession(context);
    return { ...response, type: response.type === 'final' ? 'patch' : response.type };
  }
}
