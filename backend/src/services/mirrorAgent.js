import { generateStructuredJson } from '../ai/jsonGenerate.js';

export const AVA_SYSTEM_INSTRUCTION = `You are Ava, the Mirror AI communication coach inside DevMirror AI.

Your job is to help the user practice communication for whatever they are preparing for.

First understand the user's preparation goal.
Generate relevant questions dynamically.
Listen carefully to every answer.
Adapt the next question based on the user's previous answer.
Evaluate communication quality including clarity, structure, fluency, pacing, relevance and explanation quality.
Provide constructive coaching.

Do not use a fixed question list.
Do not invent facts about the user's project.
If project material is provided, base questions on the actual material.
When visual or audio signals are provided, describe only observable communication indicators.
Never diagnose mental health conditions.
Never claim certainty about emotions.
Use cautious language such as 'possible tension indicators' or 'your speech became faster during this response.'
Be encouraging but honest.
Your goal is to help the user communicate more clearly and confidently.

Always return valid JSON only.`;

async function generateJson(prompt, systemInstruction = AVA_SYSTEM_INSTRUCTION) {
  return generateStructuredJson(prompt, systemInstruction);
}

export function analyzeLocalCommunication(text = '') {
  const raw = String(text);
  const words = raw.trim().split(/\s+/).filter(Boolean);
  const fillers = (raw.toLowerCase().match(/\b(um+|uh+|er+|like|actually|basically|you know)\b/g) || []);
  const sentences = raw.split(/[.!?]+/).filter((s) => s.trim());
  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    fillerWords: fillers,
    fillerCount: fillers.length,
    estimatedSeconds: Math.max(1, Math.round(words.length / 2.2))
  };
}

export function tensionBand({ fillerCount, visual = {} }) {
  const lookAway = Number(visual.lookAwayFrequency || 0);
  const score = fillerCount + lookAway;
  if (score <= 1) return 'CALM';
  if (score <= 3) return 'MOSTLY STEADY';
  if (score <= 6) return 'SOME HESITATION';
  return 'POSSIBLE TENSION';
}

export async function generatePrepProfile(prepType, materialText) {
  return generateJson(
    `The user is preparing for: ${prepType}
Optional context material:
${materialText || '(none)'}

Infer only from this input. Do not invent employers, projects, or facts that are not present.

Return JSON:
{
  "prep_title": "short title",
  "sessionType": "Practice|Interview|Presentation|Project|Viva|Communication|Custom",
  "topics": ["..."],
  "skills": ["..."],
  "requirements": ["..."],
  "difficulty": "Beginner|Intermediate|Advanced",
  "important_areas": ["..."],
  "sessionObjective": "one sentence"
}`
  );
}

export async function generateAdaptiveQuestion(profile, dialogHistory, extras = {}) {
  const lastAnswer = [...(dialogHistory || [])].reverse().find((d) => d.answer_text)?.answer_text || '';
  const local = analyzeLocalCommunication(lastAnswer);
  const visual = extras.visualMetrics || {};
  return generateJson(
    `Session profile:
${JSON.stringify(profile)}

Conversation so far (oldest first):
${JSON.stringify((dialogHistory || []).map((d) => ({ question: d.question_text, answer: d.answer_text, inputMode: d.input_mode })))}

Derived speech metrics from the latest answer only (not medical):
${JSON.stringify(local)}

Optional camera-derived indicators (not identity, not emotion diagnosis):
${JSON.stringify(visual)}

If this is the first turn (no answers yet), greet briefly and ask the first relevant question for their goal.
If they already answered, adapt the next question to that answer. Do not repeat a previous question.

Return JSON:
{
  "ava_remark": "short spoken transition",
  "response": "Ava's spoken reply including coaching if they just answered",
  "question_text": "the next question",
  "difficulty": "Beginner|Intermediate|Advanced",
  "feedback": {
    "well": "what they did well, or empty on first turn",
    "improve": "one improvement, or empty",
    "tryThis": "a better structure, or empty"
  },
  "communication": {
    "clarityNote": "",
    "paceNote": "",
    "structureNote": ""
  }
}`
  );
}

export async function generateMirrorReport(profile, dialogHistory, extras = {}) {
  const answers = (dialogHistory || []).filter((d) => d.answer_text);
  const combined = answers.map((d) => d.answer_text).join('\n');
  const local = analyzeLocalCommunication(combined);
  return generateJson(
    `Create an AI communication coaching report. This is coaching, not a medical or scientific assessment.
Do not diagnose anxiety or mental health.
Do not invent quotes that are not in the history.

Profile: ${JSON.stringify(profile)}
Dialog: ${JSON.stringify(answers.map((d) => ({ q: d.question_text, a: d.answer_text, mode: d.input_mode })))}
Derived metrics: ${JSON.stringify(local)}
Visual indicators if any: ${JSON.stringify(extras.visualMetrics || {})}

Return JSON:
{
  "communication": {
    "clarity": "",
    "structure_feedback": "",
    "filler_words_observed": [],
    "filler_words_count": 0,
    "paceNote": "",
    "fluencyNote": ""
  },
  "technical": {
    "strong_areas": [],
    "weak_areas": [],
    "explanation_quality": ""
  },
  "scores": {
    "clarity": 0,
    "fluency": 0,
    "pace": 0,
    "answerQuality": 0,
    "structure": 0,
    "technicalExplanation": 0,
    "engagement": 0,
    "overall": 0
  },
  "tensionIndicator": "CALM|MOSTLY STEADY|SOME HESITATION|POSSIBLE TENSION",
  "strengths": [{"area":"","evidence":""}],
  "development_areas": [{"area":"","evidence":""}],
  "practiceSuggestions": [],
  "next_challenge": {"title":"","description":""},
  "strongestArea": "",
  "improvementArea": "",
  "nextRecommendation": ""
}`
  );
}
