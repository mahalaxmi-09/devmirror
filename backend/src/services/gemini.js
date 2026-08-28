import { generateJson } from './geminiClient.js';
import {
  generatePrepProfile,
  generateAdaptiveQuestion,
  generateMirrorReport
} from './mirrorAgent.js';

export const analyzeBug = async () => {
  const err = new Error('AI SERVICE UNAVAILABLE');
  err.code = 'USE_DEBUG_AGENT';
  throw err;
};

export const evaluateSession = async (voiceTranscript, files, testRuns, codeChanges) => {
  return generateJson(
    `Analyze this completed debugging session and return JSON skill scores 0-100 plus evidence fields.
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
}`,
    'You are SkillMirror. Score only from provided evidence. Never invent execution results.'
  );
};

export const evaluateExplanation = async (userExplanation, rootCause, patchedCode) => {
  return generateJson(
    `Developer explanation: ${userExplanation}
Root cause: ${rootCause}
Patched code: ${patchedCode}
Return {"rating":"Strong"|"Good"|"Developing","feedback":"..."}`,
    'Evaluate technical understanding from the explanation only.'
  );
};

export { generatePrepProfile, generateAdaptiveQuestion, generateMirrorReport };
