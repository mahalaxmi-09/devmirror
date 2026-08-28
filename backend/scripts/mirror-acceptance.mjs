const BASE = process.env.BASE_URL || 'http://127.0.0.1:5005';

const TEST_CODE = `function calculateTotal(price, quantity) {
  return price * quantity;
}

const total = calculateTotal(100, "3");

console.log("Total:", total.toFixed(2));`;

const TEST_REQUEST = 'Debug this code. Identify the exact error, explain why it happens, generate the corrected code, and verify the output.';

async function req(method, url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function register(email) {
  const auth = await req('POST', '/api/auth/register', {
    email,
    password: 'MirrorTest123!',
    full_name: 'Mirror Tester'
  });
  if (!auth.json.token) {
    throw new Error('register failed: ' + JSON.stringify(auth.json));
  }
  return auth.json.token;
}

const stamp = Date.now();
const token = await register(`mirror_code_${stamp}@devmirror.local`);

const health = await req('GET', '/api/ai/health');
console.log('HEALTH', health.json.status, health.json.provider, health.json.model);

if (health.json.status === 'unavailable') {
  console.error('AI provider unavailable — set GEMINI_API_KEY or OPENAI_API_KEY in backend/.env');
  process.exit(1);
}

const analyze = await req('POST', '/api/mirror/analyze', {
  code: TEST_CODE,
  language: 'javascript',
  request: TEST_REQUEST
}, token);

if (!analyze.json.success) {
  console.error('ANALYZE_FAIL', analyze.status, analyze.json);
  process.exit(1);
}

console.log('PROBLEM', analyze.json.error || analyze.json.problem);
console.log('CHANGES', analyze.json.changes);
console.log('FIXED_HAS_NUMBER', /calculateTotal\(100,\s*3\)/.test(analyze.json.fixedCode || ''));
console.log('STRING_BUG_MENTIONED', /string/i.test(analyze.json.analysis || ''));

const verifyFixed = await req('POST', '/api/mirror/verify', {
  code: analyze.json.fixedCode,
  language: 'javascript'
}, token);

if (!verifyFixed.json.success) {
  console.error('VERIFY_FAIL', verifyFixed.json);
  process.exit(1);
}

const output = verifyFixed.json.verification?.output || '';
console.log('VERIFY_STATUS', verifyFixed.json.verification?.status);
console.log('VERIFY_OUTPUT', output.trim());
console.log('EXPECTED_OUTPUT', output.includes('Total: 300.00'));

if (!/calculateTotal\(100,\s*3\)/.test(analyze.json.fixedCode || '')) {
  console.error('fix did not correct string quantity');
  process.exit(1);
}
if (verifyFixed.json.verification?.status !== 'passed') {
  console.error('verification did not pass');
  process.exit(1);
}
if (!output.includes('Total: 300.00')) {
  console.error('expected output not found');
  process.exit(1);
}

console.log('MIRROR_CODE_ACCEPTANCE_OK');
