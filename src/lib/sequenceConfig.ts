/** One follow-up email every 14 days, for about a year (touch 1 + 26 more). */
export const SEQUENCE_GAP_DAYS = 14;
export const SEQUENCE_MAX_TOUCHES = 27;

/** Lead sequence states. Anything other than 'active' stops automatic sending. */
export type SequenceStatus = 'active' | 'paused' | 'completed' | 'bounced' | 'unsubscribed';
