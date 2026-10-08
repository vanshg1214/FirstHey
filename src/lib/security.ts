import { createHash, timingSafeEqual } from 'crypto';

/** Compares two secrets in constant time, so response timing can't be used to guess one. */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** True when the header is exactly "Bearer <secret>". */
export function bearerMatches(header: string | null | undefined, secret: string): boolean {
  return safeEqual(header ?? '', `Bearer ${secret}`);
}
