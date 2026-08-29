import OpenAI from 'openai';
import { getGroqApiKey } from './src/config/env.js';

async function listModels() {
  const apiKey = getGroqApiKey();
  console.log('Using API Key:', apiKey);
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1'
  });

  try {
    const list = await client.models.list();
    console.log('Available Groq Models:');
    for (const m of list.data) {
      console.log(`- ${m.id}`);
    }
  } catch (err) {
    console.error('Failed to list models:', err.message);
  }
}

listModels();
