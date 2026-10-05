import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { SequenceService } from '@/lib/services/sequence';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const page = (title: string, message: string, form?: string) =>
  new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f8fafc;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;">
<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;max-width:420px;text-align:center;">
<h1 style="font-size:20px;margin:0 0 12px;color:#0f172a;">${title}</h1>
<p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 20px;">${message}</p>${form || ''}</div></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );

/**
 * GET only shows a confirm button. Mail scanners and link previews prefetch links,
 * so unsubscribing on GET would silently drop people who never clicked anything.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return page('Link not valid', 'This unsubscribe link is not valid.');

  return page(
    'Unsubscribe',
    'Click below to stop receiving follow-up emails.',
    `<form method="POST"><button type="submit" style="background:#0f172a;color:#fff;border:0;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer;">Confirm unsubscribe</button></form>`
  );
}

/** Handles both the confirm button and the one-click List-Unsubscribe-Post from mail clients. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return page('Link not valid', 'This unsubscribe link is not valid.');

  try {
    const { data: lead } = await supabaseAdmin.from('leads').select('id').eq('id', id).maybeSingle();
    if (lead) await SequenceService.stop(id, 'unsubscribed');
  } catch (e) {
    console.error('Unsubscribe failed:', e);
    return page('Something went wrong', 'We could not process your request. Please reply to the email and we will remove you.');
  }

  // Same response whether or not the lead exists, so ids can't be probed.
  return page('You are unsubscribed', 'You will not receive any more follow-up emails from us.');
}
