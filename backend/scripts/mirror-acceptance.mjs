const BASE = process.env.BASE_URL || 'http://127.0.0.1:5005';

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
const tokenA = await register(`mirror_a_${stamp}@devmirror.local`);
const tokenB = await register(`mirror_b_${stamp}@devmirror.local`);

const health = await req('GET', '/api/ai/health');
console.log('HEALTH', health.json.status, health.json.provider, health.json.model);

const created = await req('POST', '/api/mirror/sessions', {
  prep_type: 'I am preparing for my agriculture AI project demo.',
  mode: 'Project',
  difficulty: 'Intermediate',
  pasted_text: 'Project: CropSense. React frontend. Python backend. Detects crop disease from leaf photos using a CNN. No irrigation hardware.'
}, tokenA);

if (created.status !== 201) {
  console.error('CREATE_FAIL', created);
  process.exit(1);
}

const sid = created.json.session.id;
const firstQ = created.json.initial_question.question_text;
console.log('SESSION', sid);
console.log('FIRST_Q', firstQ);

const iso = await req('GET', `/api/mirror/sessions/${sid}`, null, tokenB);
console.log('ISOLATION_STATUS', iso.status);

const msg1 = await req('POST', `/api/mirror/sessions/${sid}/message`, {
  message: 'CropSense helps farmers identify leaf disease early using a CNN on phone photos. We chose a CNN because local visual features matter more than sequential language models.',
  inputMode: 'text'
}, tokenA);

if (msg1.json.error) {
  console.error('MSG1_FAIL', msg1.json);
  process.exit(1);
}

const next1 = msg1.json.next_question?.question_text || msg1.json.nextQuestion?.question_text;
console.log('NEXT_Q', next1);
console.log('ADAPTIVE', next1 && next1 !== firstQ);
console.log('FEEDBACK', msg1.json.feedback);

const msg2 = await req('POST', `/api/mirror/sessions/${sid}/message`, {
  message: 'We verify the model on a held-out leaf dataset and show precision and recall during the demo. um like basically the UI is React.',
  inputMode: 'text'
}, tokenA);
const next2 = msg2.json.next_question?.question_text || msg2.json.nextQuestion?.question_text;
console.log('NEXT_Q2', next2);

const done = await req('POST', `/api/mirror/sessions/${sid}/complete`, {}, tokenA);
if (done.json.error) {
  console.error('COMPLETE_FAIL', done.json);
  process.exit(1);
}
const analysis = done.json.analysis || {};
const presentation = JSON.parse(done.json.report?.presentation_json || '{}');
console.log('SCORES', analysis.scores);
console.log('TENSION', analysis.tensionIndicator);
console.log('LABEL', presentation.label);
console.log('STRONGEST', analysis.strongestArea);
console.log('IMPROVE', analysis.improvementArea);

const report = await req('GET', `/api/mirror/sessions/${sid}/report`, null, tokenA);
console.log('REPORT_OK', report.status === 200 && Boolean(report.json.communication_json));

if (iso.status !== 404) {
  console.error('isolation failed');
  process.exit(1);
}
if (!next1 || next1 === firstQ) {
  console.error('question was not adaptive');
  process.exit(1);
}
console.log('MIRROR_ACCEPTANCE_OK');
