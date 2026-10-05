/** Links that emails may point to. Click tracking redirects only to these, never to a URL taken from the request. */
export const TRACKED_LINKS: Record<string, string> = {
  demo: 'https://kuula.co/share/5dBs1/collection/7ckpl?logo=-1&info=0&fs=1&vr=1&sd=1&autorotate=1.5&autop=10&thumbs=1',
};

export const DEFAULT_LINK_KEY = 'demo';

/**
 * Security scanners and link previewers fetch every link in an email the moment it lands,
 * which looks like a click. Flag the obvious ones so analytics can exclude them.
 */
const BOT_UA = /bot|crawl|spider|preview|scanner|proofpoint|mimecast|barracuda|safelinks|python-requests|curl|wget|headless/i;

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  return !!userAgent && BOT_UA.test(userAgent);
}
