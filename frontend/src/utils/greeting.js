/**
 * Time-of-day greeting from the given Date's local clock
 * (browser timezone when called with `new Date()`).
 *
 * 05:00–11:59  Good Morning
 * 12:00–16:59  Good Afternoon
 * 17:00–20:59  Good Evening
 * 21:00–04:59  Good Night
 */
export function getTimeBasedGreeting(date = new Date(), username) {
  const when = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const hour = when.getHours();

  let greeting;
  if (hour >= 5 && hour < 12) {
    greeting = 'Good Morning';
  } else if (hour >= 12 && hour < 17) {
    greeting = 'Good Afternoon';
  } else if (hour >= 17 && hour < 21) {
    greeting = 'Good Evening';
  } else {
    greeting = 'Good Night';
  }

  const name = typeof username === 'string' ? username.trim() : '';
  if (!name) return greeting;
  return `${greeting}, ${name}`;
}

export function msUntilNextGreetingBoundary(date = new Date()) {
  const when = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const hours = [5, 12, 17, 21];
  const y = when.getFullYear();
  const m = when.getMonth();
  const d = when.getDate();
  const upcoming = [];
  for (const hour of hours) {
    upcoming.push(new Date(y, m, d, hour, 0, 0, 0));
    upcoming.push(new Date(y, m, d + 1, hour, 0, 0, 0));
  }
  const next = upcoming
    .map((boundary) => boundary.getTime() - when.getTime())
    .filter((ms) => ms > 0)
    .sort((a, b) => a - b)[0];
  return Math.max(1000, next || 60 * 1000);
}

/** Phrase-only greeting kept for other screens; Dashboard uses getTimeBasedGreeting. */
export function timeOfDayGreeting(date = new Date()) {
  const when = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const hour = when.getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}
