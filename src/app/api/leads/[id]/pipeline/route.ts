import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';
import { SettingsService } from '@/lib/services/settings';

export const dynamic = 'force-dynamic';

async function getAuth(): Promise<{ userId: string; orgId: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single();
  if (!userData?.organization_id) return null;
  return { userId: user.id, orgId: userData.organization_id };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }

    // Scoped to org so one org can never read another org's pipeline.
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', id)
      .eq('organization_id', auth.orgId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ data: null, error: { code: 'NOT_FOUND', message: 'Lead not found' } }, { status: 404 });
    }

    // The follow-ups / notifications tables may be missing in older databases
    // (the minimal schema migration drops them). Report that instead of failing.
    const warnings: string[] = [];

    const { data: followups, error: followupsError } = await supabaseAdmin
      .from('followups')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: true });
    if (followupsError) warnings.push(`Follow-up log unavailable: ${followupsError.message}`);

    const { data: replies, error: repliesError } = await supabaseAdmin
      .from('notifications')
      .select('id, created_at, title, action_data')
      .eq('lead_id', id)
      .eq('organization_id', auth.orgId)
      .eq('type', 'reply_received')
      .order('created_at', { ascending: true });
    if (repliesError) warnings.push(`Reply log unavailable: ${repliesError.message}`);

    let sender: { configured: boolean; email: string | null; fromName: string | null } = {
      configured: false,
      email: null,
      fromName: null,
    };
    try {
      const settings: any = await SettingsService.getSettings(auth.orgId);
      sender = {
        configured: !!(settings?.email_user && settings?.email_password),
        email: settings?.email_user || null,
        fromName: settings?.email_from_name || null,
      };
    } catch (e) {
      warnings.push('Could not read email settings.');
    }

    return NextResponse.json({
      data: {
        lead: {
          id: lead.id,
          status: lead.status,
          created_at: lead.created_at,
          email: lead.email || lead.contact_fields?.email || null,
          latest_draft: lead.context_summary?.latest_draft || null,
          is_opened: !!lead.is_opened,
          open_count: lead.open_count || 0,
          open_history: lead.open_history || [],
          has_replied: !!lead.has_replied,
          sequence_status: lead.sequence_status || null,
          current_sequence_step: lead.current_sequence_step ?? null,
          last_engagement_at: lead.last_engagement_at || null,
        },
        followups: followups || [],
        replies: replies || [],
        sender,
        warnings,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Error in GET lead pipeline:', error);
    return NextResponse.json(
      { data: null, error: { code: 'PIPELINE_FETCH_FAILED', message: error.message || 'An error occurred.' } },
      { status: 500 }
    );
  }
}
