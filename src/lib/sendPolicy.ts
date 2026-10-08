/**
 * Server-side rules for when automatic emails may go out. They are enforced inside the sender
 * itself, so even someone holding CRON_SECRET (or a mistaken manual run) can't send at 3am,
 * on a Sunday, or while the kill switch is on.
 *
 * Env settings (all optional):
 *   SEQUENCE_PAUSED=true          emergency stop: nothing sends until it is removed
 *   SEND_WINDOW_START_UTC=4       first hour (UTC) emails may go out. 4 = 09:30 IST
 *   SEND_WINDOW_END_UTC=13        hour (UTC) sending stops, exclusive. 13 = 18:30 IST
 *   SEND_DAYS_UTC=1,2,3,4,5       days of week allowed (0 = Sunday ... 6 = Saturday)
 *   SEQUENCE_ENFORCE_WINDOW=false turn the time rules off (for testing only)
 */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function intFromEnv(name: string, fallback: number): number {
  const v = parseInt(process.env[name] || '', 10);
  return Number.isFinite(v) ? v : fallback;
}

export function checkSendingAllowed(now: Date = new Date()): { allowed: true } | { allowed: false; reason: string } {
  if ((process.env.SEQUENCE_PAUSED || '').toLowerCase() === 'true') {
    return { allowed: false, reason: 'Sending is paused (SEQUENCE_PAUSED=true).' };
  }
  if ((process.env.SEQUENCE_ENFORCE_WINDOW || '').toLowerCase() === 'false') {
    return { allowed: true };
  }

  const start = intFromEnv('SEND_WINDOW_START_UTC', 4);
  const end = intFromEnv('SEND_WINDOW_END_UTC', 13);
  const days = (process.env.SEND_DAYS_UTC || '1,2,3,4,5')
    .split(',')
    .map(d => parseInt(d.trim(), 10))
    .filter(d => d >= 0 && d <= 6);

  const day = now.getUTCDay();
  const hour = now.getUTCHours();

  if (!days.includes(day)) {
    return { allowed: false, reason: `Outside sending days (${DAY_NAMES[day]} is not allowed).` };
  }
  if (hour < start || hour >= end) {
    return { allowed: false, reason: `Outside sending hours (${hour}:00 UTC; allowed ${start}:00 to ${end}:00 UTC).` };
  }
  return { allowed: true };
}

/**
 * Cheap sanity check on an address before we mail it. Card scans make typos like
 * "john@gmailcom"; mailing those creates bounces, which damage the sending domain's reputation.
 */
export function isPlausibleEmail(value: string | null | undefined): boolean {
  if (!value) return false;
  const email = value.trim();
  if (email.length > 254 || /\s/.test(email)) return false;
  const match = /^[^@\s]+@([^@\s]+)$/.exec(email);
  if (!match) return false;
  const domain = match[1];
  // needs a dot, no empty labels, and a TLD of at least 2 letters
  return /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain);
}
