import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DEFAULT_LINK_KEY, TRACKED_LINKS, isLikelyBot } from '@/lib/emailTracking';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const url = new URL(req.url);
  const linkKey = url.searchParams.get('l') || DEFAULT_LINK_KEY;
  const destination = TRACKED_LINKS[linkKey] || TRACKED_LINKS[DEFAULT_LINK_KEY];

  try {
    const { id } = await params;
    const touch = parseInt(url.searchParams.get('touch') || '', 10);
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const bot = isLikelyBot(userAgent);

    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('organization_id, click_count')
      .eq('id', id)
      .single();

    if (lead) {
      await supabaseAdmin.from('email_events').insert({
        lead_id: id,
        organization_id: lead.organization_id,
        touch: Number.isFinite(touch) ? touch : null,
        event_type: 'click',
        link_key: linkKey,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        user_agent: userAgent,
        is_bot: bot,
      });

      if (!bot) {
        const now = new Date().toISOString();
        await supabaseAdmin
          .from('leads')
          .update({
            click_count: (lead.click_count || 0) + 1,
            last_clicked_at: now,
            last_engagement_at: now,
          })
          .eq('id', id);
      }
    }
  } catch (error) {
    console.error('Error tracking click:', error);
  }

  // Always send the visitor on, even if logging failed.
  return NextResponse.redirect(destination, 302);
}
