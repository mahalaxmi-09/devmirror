import OpenAI from 'openai';
import { generateJson } from './geminiClient.js';

import { getGroqApiKey, getGroqModel } from '../config/env.js';

let openaiClient = null;
const getOpenAI = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'your_openai_api_key_here') return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
};

export const callAI = async (systemInstruction, prompt, mimeType = 'text/plain') => {
  // Priority 1: Groq
  const groqKey = getGroqApiKey();
  if (groqKey) {
    try {
      console.log('Routing request to Groq...');
      const groqClient = new OpenAI({
        apiKey: groqKey,
        baseURL: 'https://api.groq.com/openai/v1'
      });
      const groqModel = getGroqModel() || 'groq/compound';
      const response = await groqClient.chat.completions.create({
        model: groqModel,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        response_format: mimeType === 'application/json' ? { type: 'json_object' } : undefined,
        max_tokens: 2048
      });
      return response.choices[0].message.content;
    } catch (err) {
      console.error('Groq call failed. Falling back to next provider...', err.message);
    }
  }

  // Priority 2: OpenAI (If configured)
  const openai = getOpenAI();
  if (openai) {
    try {
      console.log('Routing request to OpenAI gpt-4o...');
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        response_format: mimeType === 'application/json' ? { type: 'json_object' } : undefined
      });
      return response.choices[0].message.content;
    } catch (err) {
      console.error('OpenAI call failed. Falling back to Gemini...', err.message);
    }
  }

  // Priority 3: Gemini (Default / Fallback)
  console.log('Routing request to Gemini...');
  if (mimeType === 'application/json') {
    const res = await generateJson(prompt, systemInstruction);
    return typeof res === 'object' ? JSON.stringify(res) : res;
  } else {
    const { getGeminiClient, getGeminiModel } = await import('./geminiClient.js');
    const ai = getGeminiClient();
    if (!ai) throw new Error('AI providers unavailable.');
    const response = await ai.models.generateContent({
      model: getGeminiModel(),
      contents: prompt,
      config: { systemInstruction }
    });
    return response.text;
  }
};

export const analyzeBug = async () => {
  const err = new Error('AI SERVICE UNAVAILABLE');
  err.code = 'USE_DEBUG_AGENT';
  throw err;
};

export const evaluateSession = async (voiceTranscript, files, testRuns, codeChanges) => {
  const systemInstruction = 'You are SkillMirror. Score only from provided evidence. Never invent execution results.';
  const prompt = `Analyze this completed debugging session and return JSON skill scores 0-100 plus evidence fields.
Transcript: ${voiceTranscript}
Files: ${JSON.stringify((files || []).map((f) => f.filename))}
Test runs: ${JSON.stringify(testRuns || [])}
Code changes: ${JSON.stringify(codeChanges || [])}

Return:
{
  "skills": { "communication": 0, "problem_solving": 0, "debugging": 0, "technical_understanding": 0, "independent_reasoning": 0 },
  "communication_evidence": "",
  "problem_solving_evidence": "",
  "debugging_evidence": "",
  "technical_understanding_evidence": "",
  "independent_reasoning_evidence": "",
  "strongest_area": "",
  "development_area": "",
  "why": "",
  "challenge": { "title": "", "description": "", "code_language": "javascript", "initial_code": "", "test_code": "", "bug_description": "" }
}`;

  const res = await callAI(systemInstruction, prompt, 'application/json');
  return typeof res === 'string' ? JSON.parse(res) : res;
};

export const evaluateExplanation = async (userExplanation, rootCause, patchedCode) => {
  const systemInstruction = 'Evaluate technical understanding from the explanation only.';
  const prompt = `Developer explanation: ${userExplanation}
Root cause: ${rootCause}
Patched code: ${patchedCode}
Return {"rating":"Strong"|"Good"|"Developing","feedback":"..."}`;

  const res = await callAI(systemInstruction, prompt, 'application/json');
  return typeof res === 'string' ? JSON.parse(res) : res;
};
