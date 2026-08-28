import { query } from '../db/connection.js';

const SENSITIVE = /key|secret|token|authorization|password|credential|api[-_]?key/i;

function sanitizeMetadata(metadata = {}) {
  const safe = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (k === 'agentName' || k === 'level') continue;
    if (SENSITIVE.test(k)) continue;
    if (typeof v === 'string' && SENSITIVE.test(v) && v.length > 20) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) {
      safe[k] = typeof v === 'string' && v.length > 2000 ? `${v.slice(0, 2000)}…` : v;
    } else if (Array.isArray(v)) {
      safe[k] = v.slice(0, 50);
    } else if (typeof v === 'object') {
      safe[k] = sanitizeMetadata(v);
    }
  }
  return safe;
}

export async function recordEvent(missionId, eventType, message, metadata = {}) {
  const safe = sanitizeMetadata(metadata);
  const status = metadata.level === 'error' ? 'danger' : (metadata.level === 'info' ? 'info' : 'success');
  const agentName = metadata.agentName || 'SKILLDEBUG';
  const extra = Object.keys(safe).length ? ` ${JSON.stringify(safe)}` : '';
  const display = `${message}${extra}`.slice(0, 4000);

  await query(
    'INSERT INTO agent_events (mission_id, agent_name, message, event_type, status) VALUES ($1, $2, $3, $4, $5)',
    [missionId, agentName, display, eventType, status]
  );
}

export async function setMissionStatus(missionId, status) {
  await query('UPDATE missions SET status = $1 WHERE id = $2', [status, missionId]);
  return status;
}

export const MISSION_STATUS = {
  CREATED: 'CREATED',
  COLLECTING_EVIDENCE: 'COLLECTING_EVIDENCE',
  ANALYZING: 'ANALYZING',
  REPRODUCING: 'REPRODUCING',
  INVESTIGATING: 'INVESTIGATING',
  DIAGNOSIS_READY: 'DIAGNOSIS_READY',
  PATCH_READY: 'PATCH_READY',
  PATCH_APPLIED: 'PATCH_APPLIED',
  EXECUTING: 'EXECUTING',
  TESTING: 'TESTING',
  VERIFYING: 'VERIFYING',
  VERIFIED: 'VERIFIED',
  FAILED: 'FAILED',
  NEEDS_INPUT: 'NEEDS_INPUT'
};
