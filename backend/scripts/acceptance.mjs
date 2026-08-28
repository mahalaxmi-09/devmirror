/**
 * Acceptance runner: logical discount + isAdult via real tools and /investigate.
 */
import { spawn } from 'child_process';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5005';

async function req(method, url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

function summarizeTools(history = []) {
  return (history || []).map((h) => ({
    tool: h.tool,
    success: h.result?.success,
    status: h.result?.status,
    exitCode: h.result?.exitCode,
    stdout: (h.result?.stdout || '').slice(0, 200)
  }));
}

async function runCase(token, name, filename, source, problem) {
  const created = await req('POST', '/api/missions', {
    problem_description: problem,
    input_mode: 'text',
    language: 'javascript'
  }, token);
  const missionId = created.json.id;
  await req('POST', `/api/missions/${missionId}/files`, { filename, file_content: source }, token);
  const result = await req('POST', `/api/missions/${missionId}/investigate`, {}, token);
  return { name, missionId, result: result.json, toolCalls: summarizeTools(result.json.toolHistory) };
}

async function main() {
  const health = await req('GET', '/api/ai/health');
  console.log('HEALTH', JSON.stringify(health.json));

  const email = `accept_${Date.now()}@devmirror.local`;
  const auth = await req('POST', '/api/auth/register', {
    email,
    password: 'AcceptTest123!',
    full_name: 'Acceptance Bot'
  });
  const token = auth.json.token;
  if (!token) {
    console.error('AUTH_FAILED', auth.json);
    process.exit(1);
  }

  const discount = await runCase(
    token,
    'calculateDiscount',
    'index.js',
    `function calculateDiscount(price, discount) {
  return price + (price * discount / 100);
}

const finalPrice = calculateDiscount(1000, 20);

console.log("Final Price:", finalPrice);
`,
    'The final price should be 800, but the program gives the wrong result. Find and fix the bug.'
  );

  const adult = await runCase(
    token,
    'isAdult',
    'index.js',
    `function isAdult(age) {
  return age < 18;
}

console.log(isAdult(20));
`,
    'isAdult(20) should return true because 20 is an adult. The program currently prints the wrong boolean. Find and fix the bug.'
  );

  console.log(JSON.stringify({ discount, adult }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
