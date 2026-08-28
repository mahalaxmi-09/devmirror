import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicApiKey, getAnthropicModel } from '../config/env.js';
import { anthropicTools } from '../services/debugTools.js';
import { AIProvider, AIProviderError, classifyText, toolCallResponse, DEBUG_SYSTEM_INSTRUCTION, parseModelJson } from './provider.js';

export class AnthropicProvider extends AIProvider {
  constructor() {
    super({ name: 'anthropic', model: getAnthropicModel() });
    const apiKey = getAnthropicApiKey();
    if (!apiKey) {
      throw new AIProviderError('AI SERVICE UNAVAILABLE', { code: 'AI_SERVICE_UNAVAILABLE', provider: 'anthropic' });
    }
    this.client = new Anthropic({ apiKey });
  }

  ensureState(context) {
    if (!context.providerState) {
      const content = [{ type: 'text', text: context.userPrompt }];
      if (Array.isArray(context.images)) {
        for (const img of context.images) {
          if (img?.data && img?.mimeType) {
            content.push({
              type: 'image',
              source: { type: 'base64', media_type: img.mimeType, data: img.data }
            });
          }
        }
      }
      context.providerState = { messages: [{ role: 'user', content }] };
    }
  }

  async call(context) {
    try {
      return await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: DEBUG_SYSTEM_INSTRUCTION,
        tools: anthropicTools(),
        messages: context.providerState.messages
      });
    } catch (err) {
      throw new AIProviderError(err.message || 'AI_PROVIDER_ERROR', { provider: 'anthropic' });
    }
  }

  async healthCheck() {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply with pong.' }]
    });
    const text = response.content?.map((p) => p.text).filter(Boolean).join('') || '';
    if (!response.content) return { ok: false, provider: this.name, model: this.model };
    return { ok: true, provider: this.name, model: this.model, preview: text.slice(0, 20) };
  }

  appendToolResults(context, toolResults = []) {
    if (!toolResults.length) return;
    context.providerState.messages.push({
      role: 'user',
      content: toolResults.map((r) => ({
        type: 'tool_result',
        tool_use_id: r.id,
        content: JSON.stringify(r.result ?? {})
      }))
    });
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
    context.providerState.messages.push({ role: 'assistant', content: response.content });
    const uses = (response.content || []).filter((p) => p.type === 'tool_use');
    if (uses.length) {
      return toolCallResponse(
        uses.map((u) => ({ tool: u.name, toolArguments: u.input || {}, id: u.id })),
        (response.content || []).filter((p) => p.type === 'text').map((p) => p.text).join('\n')
      );
    }
    const text = (response.content || []).filter((p) => p.type === 'text').map((p) => p.text).join('\n');
    return classifyText(text);
  }

  async generateJson(prompt, systemInstruction) {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: `${systemInstruction}\nReturn valid JSON only.`,
      messages: [{ role: 'user', content: prompt }]
    });
    const text = (response.content || []).filter((p) => p.type === 'text').map((p) => p.text).join('\n');
    return parseModelJson(text);
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
