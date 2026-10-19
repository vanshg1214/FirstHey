/** One follow-up email every 14 days, for about a year (touch 1 + 26 more). */
export const SEQUENCE_GAP_DAYS = 14;
export const SEQUENCE_MAX_TOUCHES = 27;

/** Sending limits. Raise SEQUENCE_DAILY_LIMIT gradually (warm-up) so the domain isn't flagged as spam. */
export const SEQUENCE_DAILY_LIMIT = parseInt(process.env.SEQUENCE_DAILY_LIMIT || '50', 10);
/** Warm-up: a new sender starts small and the daily cap grows each day until it reaches SEQUENCE_DAILY_LIMIT. */
export const SEQUENCE_WARMUP_ENABLED = (process.env.SEQUENCE_WARMUP || '').toLowerCase() !== 'false';
export const SEQUENCE_WARMUP_START = parseInt(process.env.SEQUENCE_WARMUP_START || '20', 10);
export const SEQUENCE_WARMUP_STEP = parseInt(process.env.SEQUENCE_WARMUP_STEP || '10', 10);
export const SEQUENCE_BATCH_SIZE = parseInt(process.env.SEQUENCE_BATCH_SIZE || '20', 10);
export const SEQUENCE_SEND_DELAY_MS = parseInt(process.env.SEQUENCE_SEND_DELAY_MS || '400', 10);
export const SEQUENCE_MAX_ATTEMPTS = 5;
export const RETRY_DELAY_MS = 60 * 60 * 1000;

/** Lead sequence states. Anything other than 'active' stops automatic sending. */
export type SequenceStatus = 'active' | 'paused' | 'completed' | 'bounced' | 'unsubscribed';
