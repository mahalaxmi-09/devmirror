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

export function transcriptDerivedReport(profile, dialogHistory, extras = {}) {
  const answers = (dialogHistory || []).filter((d) => d.answer_text);
  const combined = answers.map((d) => d.answer_text).join('\n');
  const local = analyzeLocalCommunication(combined);
  const visual = extras.visualMetrics || {};
  const fillerRatio = local.wordCount ? local.fillerCount / local.wordCount : 0;
  const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
  const clarity = clamp(90 - fillerRatio * 250);
  const fluency = clamp(88 - local.fillerCount * 6);
  const pace = clamp(local.wordCount < 20 ? 55 : 78);
  const structure = clamp(answers.length >= 2 ? 72 : 60);
  const technical = clamp(combined.length > 80 ? 70 : 50);
  const engagement = clamp(100 - Number(visual.lookAwayFrequency || 0) * 4);
  const overall = clamp((clarity + fluency + pace + structure + technical + engagement) / 6);

  return {
    communication: {
      clarity: `Transcript-derived indicator from ${local.wordCount} words and ${local.fillerCount} filler tokens. A full AI narrative was unavailable for this close-out.`,
      structure_feedback: `You answered ${answers.length} question(s). This close-out used observable transcript metrics only.`,
      filler_words_observed: local.fillerWords,
      filler_words_count: local.fillerCount,
      paceNote: `Estimated speaking length about ${local.estimatedSeconds}s based on word count.`,
      fluencyNote: local.fillerCount ? 'Filler tokens were observed in the transcript.' : 'No common filler tokens were counted in the transcript.'
    },
    technical: {
      strong_areas: (profile.topics || []).slice(0, 3),
      weak_areas: [],
      explanation_quality: 'Full technical evaluation from the model was unavailable. No project facts were invented.'
    },
    scores: {
      clarity,
      fluency,
      pace,
      answerQuality: structure,
      structure,
      technicalExplanation: technical,
      engagement,
      overall
    },
    tensionIndicator: tensionBand({ fillerCount: local.fillerCount, visual }),
    strengths: [{ area: 'Participation', evidence: 'You completed at least one answer in this session.' }],
    development_areas: [{ area: 'Full AI report', evidence: 'Retry ending the session when Mirror AI is available for a complete coaching write-up.' }],
    practiceSuggestions: ['Answer again with a problem → approach → result structure.'],
    next_challenge: { title: 'Retry full report', description: 'End the session again when the AI provider is available.' },
    strongestArea: 'Follow-through',
    improvementArea: 'Obtain a full AI coaching write-up',
    nextRecommendation: 'Run another short session and end it while the AI provider is connected.',
    reportSource: 'transcript-derived'
  };
}

export async function generateSessionStart(prepType, materialText, difficulty, mode) {
  return generateJson(
    `The user is preparing for: ${prepType}
Requested behavioral mode: ${mode || 'unspecified'}
Requested difficulty: ${difficulty || 'Intermediate'}
Optional context material:
${materialText || '(none)'}

Infer only from this input. Do not invent employers, projects, or facts that are not present.
Greet briefly as Ava and ask the first relevant question for their goal.
Do not use a fixed question list.

Return JSON:
{
  "prep_title": "short title",
  "sessionType": "Practice|Interview|Presentation|Project|Viva|Communication|Custom",
  "topics": ["..."],
  "skills": ["..."],
  "requirements": ["..."],
  "difficulty": "Beginner|Intermediate|Advanced",
  "important_areas": ["..."],
  "sessionObjective": "one sentence",
  "ava_remark": "short spoken greeting",
  "response": "Ava's spoken opening including the first question",
  "question_text": "the first question"
}`
  );
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
Keep every string field under 240 characters. Keep arrays to at most 4 items.

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
