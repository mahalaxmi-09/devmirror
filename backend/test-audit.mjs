/**
 * DevMirror system audit integration tests
 * Run: node test-audit.mjs
 */
const BASE = 'http://localhost:5005/api';

let passed = 0;
let failed = 0;
const failures = [];

function assert(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    failures.push({ name, detail });
    console.log(`  FAIL: ${name}${detail ? ' — ' + detail : ''}`);
  }
}

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

const discountCode = `function calculateDiscount(price, discount) {
  return price + (price * discount / 100);
}

const finalPrice = calculateDiscount(1000, 20);
console.log("Final Price:", finalPrice);`;

const isAdultCode = `function isAdult(age) {
  return age < 18;
}

console.log(isAdult(20));`;

const syntaxErrorCode = `function greet(name {
  console.log("Hello " + name);
}`;

const runtimeErrorCode = `const user = null;
console.log(user.name);`;

async function run() {
  console.log('\n=== AUTH TESTS ===');
  const regA = await req('POST', '/auth/register', {
    email: `audit_a_${Date.now()}@test.dev`,
    password: 'testpass123',
    full_name: 'Audit User A'
  });
  assert('Register user A', regA.status === 201, `status ${regA.status}`);
  const tokenA = regA.data.token;

  const regB = await req('POST', '/auth/register', {
    email: `audit_b_${Date.now()}@test.dev`,
    password: 'testpass123',
    full_name: 'Audit User B'
  });
  assert('Register user B', regB.status === 201);
  const tokenB = regB.data.token;

  const me = await req('GET', '/auth/me', null, tokenA);
  assert('Get profile /me', me.status === 200 && me.data.full_name === 'Audit User A');

  const noAuth = await req('GET', '/missions');
  assert('Unauthenticated missions blocked', noAuth.status === 401);

  const badLogin = await req('POST', '/auth/login', { email: 'nope@test.dev', password: 'wrong' });
  assert('Bad login rejected', badLogin.status === 400);

  console.log('\n=== AI HEALTH ===');
  const aiHealth = await req('GET', '/ai/health');
  assert('AI health endpoint responds', aiHealth.status === 200);
  assert('AI health reports provider', aiHealth.data.ai_provider === 'gemini');
  console.log(`  INFO: AI status = ${aiHealth.data.gemini}, reason = ${aiHealth.data.reason || 'ok'}`);

  console.log('\n=== SANDBOX SECURITY ===');
  const { resolveSafePath } = await import('./src/services/sandbox.js');
  let traversalBlocked = false;
  try { resolveSafePath('/tmp/sandbox', '../../etc/passwd'); } catch { traversalBlocked = true; }
  assert('Path traversal ../ rejected', traversalBlocked);

  let absBlocked = false;
  try { resolveSafePath('/tmp/sandbox', '/etc/passwd'); } catch { absBlocked = true; }
  assert('Absolute path rejected', absBlocked);

  console.log('\n=== MISSION CREATION ===');
  const noDesc = await req('POST', '/missions', {}, tokenA);
  assert('Mission requires description', noDesc.status === 400);

  console.log('\n=== DISCOUNT DEBUG PIPELINE ===');
  const missionRes = await req('POST', '/missions', {
    problem_description: 'The final price should be 800, but the program gives the wrong result.',
    language: 'javascript'
  }, tokenA);
  assert('Create discount mission', missionRes.status === 201, `status ${missionRes.status}`);
  const missionId = missionRes.data.id;

  const fileRes = await req('POST', `/missions/${missionId}/files`, {
    filename: 'index.js',
    file_content: discountCode
  }, tokenA);
  assert('Upload discount code', fileRes.status === 201);

  const { runInSandbox } = await import('./src/services/sandbox.js');
  const repro = await runInSandbox(`audit-${missionId}`, [{ filename: 'index.js', file_content: discountCode }]);
  assert('Reproduce discount bug output contains 1200', repro.stdout.includes('1200'), `stdout: ${repro.stdout.trim()}`);
  assert('Reproduction from actual execution', repro.stdout.includes('Final Price: 1200'));

  const analyze = await req('POST', `/missions/${missionId}/analyze`, null, tokenA);
  console.log(`  INFO: analyze result status=${analyze.data?.status}, success=${analyze.data?.success}`);
  if (aiHealth.data.gemini === 'connected') {
    assert('Discount analyze succeeds with AI', analyze.data?.success === true || analyze.data?.status === 'VERIFIED_FIXED');
  } else {
    assert('Discount analyze fails gracefully without AI', analyze.data?.success === false);
  }

  console.log('\n=== SESSION ISOLATION ===');
  const userBMissions = await req('GET', `/missions/${missionId}`, null, tokenB);
  assert('User B cannot access User A mission', userBMissions.status === 404);

  console.log('\n=== MIRROR SESSION ===');
  const mirrorStart = await req('POST', '/mirror/sessions', {
    prep_type: 'Viva',
    pasted_text: 'I am preparing for my DevMirror project viva.'
  }, tokenA);
  assert('Start mirror session', mirrorStart.status === 201, `status ${mirrorStart.status}`);
  const sessionId = mirrorStart.data.session?.id;
  assert('Mirror initial question exists', !!mirrorStart.data.initial_question?.question_text);

  const mirrorB = await req('GET', `/mirror/sessions/${sessionId}`, null, tokenB);
  assert('User B cannot access User A mirror session', mirrorB.status === 404);

  console.log('\n=== BUILD CHECK ===');
  const { execSync } = await import('child_process');
  try {
    execSync('npm run build', { cwd: '/workspace/frontend', stdio: 'pipe' });
    assert('Frontend production build', true);
  } catch (e) {
    assert('Frontend production build', false, e.message);
  }

  console.log('\n========================================');
  console.log(`PASSED: ${passed}  FAILED: ${failed}`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  - ${f.name}: ${f.detail}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Audit script crash:', err);
  process.exit(1);
});
