import OpenAI from 'openai';
import { getOpenAIApiKey, getOpenAIModel } from '../config/env.js';
import { openaiResponsesTools } from '../services/debugTools.js';
import {
  AIProvider,
  AIProviderError,
  classifyText,
  toolCallResponse,
  DEBUG_SYSTEM_INSTRUCTION,
  sanitizeProviderError,
  parseModelJson
} from './provider.js';

function parseArgs(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export class OpenAIProvider extends AIProvider {
  constructor() {
    super({ name: 'openai', model: getOpenAIModel() });
    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
      throw new AIProviderError('AI SERVICE UNAVAILABLE', { code: 'AI_SERVICE_UNAVAILABLE', provider: 'openai' });
    }
    this.client = new OpenAI({ apiKey });
  }

  buildInitialInput(context) {
    const content = [{ type: 'input_text', text: context.userPrompt }];
    if (Array.isArray(context.images)) {
      for (const img of context.images) {
        if (img?.data && img?.mimeType) {
          content.push({
            type: 'input_image',
            image_url: `data:${img.mimeType};base64,${img.data}`
          });
        }
      }
    }
    return [{ role: 'user', content }];
  }

  ensureState(context) {
    if (!context.providerState) {
      context.providerState = {
        previousResponseId: null,
        pendingInput: this.buildInitialInput(context)
      };
    }
  }

  async call(context) {
    const input = context.providerState.pendingInput;
    if (!input || (Array.isArray(input) && input.length === 0)) {
      throw new AIProviderError('Empty provider input', { provider: 'openai' });
    }
    try {
      const payload = {
        model: this.model,
        instructions: DEBUG_SYSTEM_INSTRUCTION,
        input,
        tools: openaiResponsesTools(),
        tool_choice: 'auto'
      };
      if (context.providerState.previousResponseId) {
        payload.previous_response_id = context.providerState.previousResponseId;
      }
      return await this.client.responses.create(payload);
    } catch (err) {
      throw new AIProviderError(sanitizeProviderError(err.message || 'AI_PROVIDER_ERROR'), { provider: 'openai' });
    }
  }

  async healthCheck() {
    const response = await this.client.responses.create({
      model: this.model,
      input: 'Reply with the single word pong.',
      max_output_tokens: 16
    });
    const text = response.output_text;
    if (text === undefined || text === null) {
      return { ok: false, provider: this.name, model: this.model };
    }
    return { ok: true, provider: this.name, model: this.model };
  }

  appendToolResults(context, toolResults = []) {
    if (!toolResults.length) return;
    context.providerState.pendingInput = toolResults.map((r) => ({
      type: 'function_call_output',
      call_id: r.id,
      output: JSON.stringify(r.result ?? {})
    }));
  }

  extractFunctionCalls(response) {
    const output = response.output || [];
    const calls = [];
    for (const item of output) {
      if (item.type === 'function_call' || item.type === 'tool_call') {
        calls.push({
          tool: item.name,
          toolArguments: parseArgs(item.arguments),
          id: item.call_id || item.id
        });
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
    const response = await this.call(context);
    context.providerState.previousResponseId = response.id;
    context.providerState.pendingInput = [];
    const calls = this.extractFunctionCalls(response);
    if (calls.length) return toolCallResponse(calls, response.output_text || '');
    return classifyText(response.output_text || '');
  }

  async generateJson(prompt, systemInstruction) {
    const response = await this.client.responses.create({
      model: this.model,
      instructions: `${systemInstruction}\nReturn valid JSON only.`,
      input: prompt,
      max_output_tokens: 2048
    });
    return parseModelJson(response.output_text);
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
