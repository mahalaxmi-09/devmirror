import { getTimeBasedGreeting, msUntilNextGreetingBoundary } from './greeting.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

function at(hours, minutes = 0) {
  return new Date(2026, 5, 15, hours, minutes, 0, 0);
}

test('greeting bands with username', () => {
  assert.equal(getTimeBasedGreeting(at(10, 0), 'Maha'), 'Good Morning, Maha');
  assert.equal(getTimeBasedGreeting(at(12, 0), 'Maha'), 'Good Afternoon, Maha');
  assert.equal(getTimeBasedGreeting(at(12, 30), 'Maha'), 'Good Afternoon, Maha');
  assert.equal(getTimeBasedGreeting(at(16, 59), 'Maha'), 'Good Afternoon, Maha');
  assert.equal(getTimeBasedGreeting(at(17, 0), 'Maha'), 'Good Evening, Maha');
  assert.equal(getTimeBasedGreeting(at(18, 30), 'Maha'), 'Good Evening, Maha');
  assert.equal(getTimeBasedGreeting(at(20, 59), 'Maha'), 'Good Evening, Maha');
  assert.equal(getTimeBasedGreeting(at(21, 0), 'Maha'), 'Good Night, Maha');
  assert.equal(getTimeBasedGreeting(at(23, 0), 'Maha'), 'Good Night, Maha');
  assert.equal(getTimeBasedGreeting(at(2, 0), 'Maha'), 'Good Night, Maha');
  assert.equal(getTimeBasedGreeting(at(4, 59), 'Maha'), 'Good Night, Maha');
  assert.equal(getTimeBasedGreeting(at(5, 0), 'Maha'), 'Good Morning, Maha');
  assert.equal(getTimeBasedGreeting(at(11, 59), 'Maha'), 'Good Morning, Maha');
});

test('missing username is omitted', () => {
  assert.equal(getTimeBasedGreeting(at(12, 30), ''), 'Good Afternoon');
  assert.equal(getTimeBasedGreeting(at(12, 30), '   '), 'Good Afternoon');
  assert.equal(getTimeBasedGreeting(at(12, 30), undefined), 'Good Afternoon');
});

test('uses Date#getHours (local), not UTC', () => {
  const localNoon = at(12, 30);
  assert.equal(localNoon.getHours(), 12);
  assert.equal(getTimeBasedGreeting(localNoon, 'Maha'), 'Good Afternoon, Maha');
});

test('boundary timer is positive', () => {
  const ms = msUntilNextGreetingBoundary(at(12, 30));
  assert.ok(ms > 0);
  const untilFive = msUntilNextGreetingBoundary(at(16, 59));
  assert.ok(untilFive <= 60 * 1000 + 1000);
});
