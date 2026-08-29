import './src/config/env.js';
import { callAI } from './src/services/gemini.js';

async function testAISolve() {
  const code = `
function addNumbers(a, b) {
  return a + c; // c is not defined!
}
`;
  
  const systemPrompt = `You are Mirror AI - a professional code repair engine.
Analyze the user's code, error message, and context. Propose a root cause diagnosis and fix.
Return valid JSON only containing:
- errorType: string
- rootCause: string
- explanation: string
- correctedCode: string
- verification: string
- confidence: number`;

  const prompt = `
Programming Language: javascript
Current Code:
${code}
Current Error Log:
ReferenceError: c is not defined
`;

  try {
    console.log('Sending debug task to connected AI...');
    const aiResponse = await callAI(systemPrompt, prompt, 'application/json');
    console.log('Raw AI Response:', aiResponse);
    
    let cleaned = aiResponse.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    }
    const result = JSON.parse(cleaned);
    console.log('\nParsed JSON Output:');
    console.log('Error Type:', result.errorType);
    console.log('Root Cause:', result.rootCause);
    console.log('Corrected Code:\n', result.correctedCode);
  } catch (err) {
    console.error('Test run failed:', err);
  }
}

testAISolve();
