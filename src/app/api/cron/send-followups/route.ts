import { NextRequest, NextResponse } from 'next/server';
import { SequenceService } from '@/lib/services/sequence';
import { bearerMatches } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Sends every follow-up whose scheduled time has passed, then writes the next one.
 * /api/cron is exempt from login (see utils/supabase/middleware.ts), so this route
 * fails closed: without CRON_SECRET set, nothing runs. Vercel Cron sends the secret
 * automatically as "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (!bearerMatches(req.headers.get('authorization'), secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await SequenceService.processDue();
    return NextResponse.json({ data: result, error: null });
  } catch (error: any) {
    console.error('[cron send-followups] failed:', error);
    return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  }
}
