export const DEBUG_SYSTEM_INSTRUCTION = `You are DevMirror SkillDebug, an evidence-driven autonomous software debugging engineer.

Your job is to investigate the user's ACTUAL software problem.

Rules:
1. Never invent files.
2. Never invent code.
3. Never invent test output.
4. Never invent error logs.
5. Never claim a bug is fixed without execution evidence.
6. Use tools to inspect the actual workspace.
7. Reproduce the issue whenever possible.
8. Base every diagnosis on evidence.
9. Generate the smallest reasonable patch.
10. The backend executes tools.
11. After patching, run the relevant program or tests.
12. If verification fails, investigate again.
13. If information is missing, ask the user for it.
14. Never use previous unrelated mission context.

Workflow:
UNDERSTAND → INSPECT → REPRODUCE → INVESTIGATE → ROOT CAUSE → PATCH → EXECUTE → VERIFY

Your final answer must distinguish:
OBSERVED
HYPOTHESIS
ROOT CAUSE
PATCH
EXECUTION RESULT
VERIFICATION

Never confuse a hypothesis with a verified root cause.
Never declare BUG VERIFIED FIXED yourself. Call verify_result after real execution.`;

export class AIProvider {
  constructor({ name, model }) {
    this.name = name;
    this.model = model;
  }

  async healthCheck() {
    throw new Error('healthCheck not implemented');
  }

  async startDebugSession(context) {
    return this.continueDebugSession(context);
  }

  async continueDebugSession(_context) {
    throw new Error('continueDebugSession not implemented');
  }

  async generateDiagnosis(_context) {
    throw new Error('generateDiagnosis not implemented');
  }

  async generatePatch(_context) {
    throw new Error('generatePatch not implemented');
  }
}

export class AIProviderError extends Error {
  constructor(message, extra = {}) {
    super(sanitizeProviderError(message));
    this.name = 'AIProviderError';
    this.code = extra.code || 'AI_PROVIDER_ERROR';
    this.provider = extra.provider;
  }
}

export function sanitizeProviderError(message = '') {
  return String(message)
    .replace(/sk-[A-Za-z0-9_\-]+/g, '[redacted]')
    .replace(/AIza[A-Za-z0-9_\-]+/g, '[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/g, 'Bearer [redacted]')
    .replace(/AQ\.[A-Za-z0-9_\-]+/g, '[redacted]');
}

export function classifyText(text = '') {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed) {
    return { type: 'final', message: '', diagnosis: null, patch: null, tool: null, toolArguments: {} };
  }
  if (
    lower.includes('need more evidence') ||
    lower.includes('please upload') ||
    lower.includes('i need more') ||
    /\?\s*$/.test(trimmed)
  ) {
    return { type: 'question', message: trimmed, tool: null, toolArguments: {}, diagnosis: null, patch: null };
  }
  return { type: 'final', message: trimmed, tool: null, toolArguments: {}, diagnosis: null, patch: null };
}

export function parseModelJson(text) {
  const cleaned = String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  if (!cleaned) {
    throw new AIProviderError('Empty model response', { code: 'AI_SERVICE_UNAVAILABLE' });
  }
  return JSON.parse(cleaned);
}

export function toolCallResponse(toolCalls, message = '') {
  const first = toolCalls[0];
  return {
    type: 'tool_call',
    message,
    tool: first?.tool || null,
    toolArguments: first?.toolArguments || {},
    toolCalls,
    diagnosis: null,
    patch: null
  };
}
