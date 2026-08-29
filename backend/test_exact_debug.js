import './src/config/env.js';
import jwt from 'jsonwebtoken';

async function runExactTest() {
  const url = 'http://localhost:5005/api/debug/run';
  const secret = process.env.JWT_SECRET || 'super_secret_devmirror_token_key_123';
  
  // Generate a valid mock token that satisfies authMiddleware
  const mockToken = jwt.sign({ id: 9999, email: 'test@devmirror.ai' }, secret, { expiresIn: '1h' });
  
  const payload = {
    language: 'javascript',
    code: `
function greetUser() {
    console.log("Hello " + userName);
}

greetUser();
    `,
    error: 'ReferenceError: userName is not defined',
    prompt: 'Debug this JavaScript code. Find the exact error, explain why it occurs, provide the corrected code, and show the expected output.'
  };

  try {
    console.log('Sending exact test code to local debug API with valid token...');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mockToken}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Status Code:', response.status);
    console.log('Response JSON:\n', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Test script failed:', err);
  }
}

runExactTest();
