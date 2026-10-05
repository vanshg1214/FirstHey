import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isLikelyBot } from '@/lib/emailTracking';

// 1x1 transparent GIF base64 string
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const touch = url.searchParams.get('touch') || 'Immediate';
    
    // In background, fetch the current lead to get open count and history
    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('open_count, open_history, organization_id')
      .eq('id', id)
      .single();

    if (lead) {
      const currentHistory = lead.open_history || [];
      const newHistoryEvent = {
        opened_at: new Date().toISOString(),
        touch: touch,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown'
      };

      const touchNumber = parseInt(touch, 10);
      await supabaseAdmin.from('email_events').insert({
        lead_id: id,
        organization_id: lead.organization_id,
        touch: Number.isFinite(touchNumber) ? touchNumber : null,
        event_type: 'open',
        ip: newHistoryEvent.ip,
        user_agent: newHistoryEvent.user_agent,
        is_bot: isLikelyBot(newHistoryEvent.user_agent),
      });

      // Update the lead's open tracking data
      await supabaseAdmin
        .from('leads')
        .update({
          is_opened: true,
          last_engagement_at: newHistoryEvent.opened_at,
          open_count: (lead.open_count || 0) + 1,
          open_history: [...currentHistory, newHistoryEvent],
        })
        .eq('id', id);
    }
  } catch (error) {
    console.error('Error tracking open:', error);
  }

  // Always instantly return the transparent GIF so the email client doesn't block
  return new NextResponse(TRANSPARENT_GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
