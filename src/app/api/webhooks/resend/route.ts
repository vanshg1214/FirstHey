import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { SequenceService } from '@/lib/services/sequence';
import { safeEqual } from '@/lib/security';

export const dynamic = 'force-dynamic';

const MAX_AGE_SECONDS = 5 * 60;

/** Verifies a Resend (Svix) webhook signature. Returns false for anything that doesn't check out. */
function verifySignature(req: NextRequest, rawBody: string, secret: string): boolean {
  const id = req.headers.get('svix-id');
  const timestamp = req.headers.get('svix-timestamp');
  const signatureHeader = req.headers.get('svix-signature');
  if (!id || !timestamp || !signatureHeader) return false;

  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > MAX_AGE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest('base64');

  return signatureHeader
    .split(' ')
    .map(part => part.split(',')[1])
    .some(sig => !!sig && safeEqual(sig, expected));
}

/**
 * Resend tells us when an email bounced or was marked as spam. A bad address is never emailed
 * again, and a spam complaint is treated as an unsubscribe. Protects the sender's reputation.
 *
 * Setup in Resend: Webhooks > Add endpoint > https://<your-app>/api/webhooks/resend,
 * events email.bounced and email.complained. Put its signing secret in RESEND_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'RESEND_WEBHOOK_SECRET is not configured' }, { status: 503 });
  }

  const rawBody = await req.text();
  if (!verifySignature(req, rawBody, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const type: string = event?.type || '';
  const recipients: string[] = Array.isArray(event?.data?.to) ? event.data.to : [];

  let action: 'bounced' | 'unsubscribed' | null = null;
  if (type === 'email.complained') action = 'unsubscribed';
  if (type === 'email.bounced') {
    // Temporary problems (a full mailbox) can clear up. Only a permanent bounce ends the sequence.
    const bounceType = String(event?.data?.bounce?.type || 'Permanent').toLowerCase();
    if (bounceType === 'permanent') action = 'bounced';
  }
  if (!action) return NextResponse.json({ data: { ignored: type }, error: null });

  let stopped = 0;
  for (const raw of recipients) {
    const address = String(raw || '').trim();
    if (!address) continue;
    const [byColumn, byField] = await Promise.all([
      supabaseAdmin.from('leads').select('id').eq('email', address),
      supabaseAdmin.from('leads').select('id').eq('contact_fields->>email', address),
    ]);
    const ids = new Set([...(byColumn.data || []), ...(byField.data || [])].map((l: any) => l.id as string));
    for (const id of ids) {
      await SequenceService.stop(id, action);
      stopped++;
    }
  }

  console.log(`[resend webhook] ${type}: stopped ${stopped} sequence(s) as ${action}`);
  return NextResponse.json({ data: { type, stopped }, error: null });
}
