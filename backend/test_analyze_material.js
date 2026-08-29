import './src/config/env.js';
import { generateStructuredJson } from './src/ai/jsonGenerate.js';

async function testAnalyze() {
  const text = `
HTML & CSS Interview Preparation
- Semantic HTML tags: header, footer, section, article, nav, aside.
- Accessibility: ARIA attributes, alt text, keyboard navigation, color contrast.
- GET vs POST: GET parameters in URL, POST in request body.
- Box Model: content, padding, border, margin.
  `;

  const systemInstruction = `You are Mirror AI Content Analyzer.
Scan the technical preparation text, resume details, or description and extract topics, technologies, important concepts, and potential interview focus areas.
Return structured JSON only, containing these fields:
- title: string (descriptive title of content)
- topics: string[] (up to 6 core topics detected)
- technologies: string[] (developer toolsets and technologies detected)
- concepts: string[] (theoretical concepts detected)
- potentialAreas: string[] (likely interview questions categories)`;

  const prompt = `Material context:\n${text.slice(0, 5000)}`;

  try {
    console.log('Sending material analysis task...');
    const result = await generateStructuredJson(prompt, systemInstruction);
    console.log('Analysis Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Analysis failed:', err.message);
    if (err.cause) {
      console.error('Root cause details:', err.cause.message || err.cause);
    }
  }
}

testAnalyze();
