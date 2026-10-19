import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUserOrgId } from '@/lib/auth';
import { SequenceService } from '@/lib/services/sequence';
import { checkSendingAllowed } from '@/lib/sendPolicy';

export const dynamic = 'force-dynamic';

const unauthorized = () =>
  NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });

/** The emails waiting to go out, plus today's sending status, for this organization. */
export async function GET() {
  try {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) return unauthorized();

    const [{ data: rows, error }, allowance, { count: pausedLeads }, { count: queuedTotal }] = await Promise.all([
      supabaseAdmin
        .from('followups')
        .select('id, lead_id, sequence_position, scheduled_for, status, attempts, leads!inner(organization_id, email, contact_fields, sequence_status)')
        .eq('channel', 'email')
        .in('status', ['queued', 'sending'])
        .eq('leads.organization_id', orgId)
        .order('scheduled_for', { ascending: true })
        .limit(100),
      SequenceService.getDailyAllowance(orgId),
      supabaseAdmin
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('sequence_status', 'paused'),
      supabaseAdmin
        .from('followups')
        .select('id, leads!inner(organization_id)', { count: 'exact', head: true })
        .eq('channel', 'email')
        .eq('status', 'queued')
        .eq('leads.organization_id', orgId),
    ]);
    if (error) throw new Error(error.message);

    const policy = checkSendingAllowed();

    const items = (rows || []).map((r: any) => ({
      id: r.id,
      leadId: r.lead_id,
      name: r.leads?.contact_fields?.name || null,
      company: r.leads?.contact_fields?.company || null,
      email: r.leads?.email || r.leads?.contact_fields?.email || null,
      position: r.sequence_position,
      scheduledFor: r.scheduled_for,
      status: r.status,
      leadPaused: r.leads?.sequence_status === 'paused',
    }));

    return NextResponse.json({
      data: {
        items,
        queued: queuedTotal || 0,
        pausedLeads: pausedLeads || 0,
        sentToday: allowance.sentToday,
        dailyCap: allowance.cap,
        sendingAllowed: policy.allowed,
        blockedReason: policy.allowed ? null : policy.reason,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Error loading send queue:', error);
    return NextResponse.json({ data: null, error: { code: 'QUEUE_FAILED', message: error.message } }, { status: 500 });
  }
}

/** Pause or resume every automatic sequence in this organization. */
export async function POST(req: NextRequest) {
  try {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) return unauthorized();

    const { action } = await req.json();

    if (action === 'pause_all') {
      const { data, error } = await supabaseAdmin
        .from('leads')
        .update({ sequence_status: 'paused' })
        .eq('organization_id', orgId)
        .eq('sequence_status', 'active')
        .select('id');
      if (error) throw new Error(error.message);
      return NextResponse.json({ data: { paused: data?.length || 0 }, error: null });
    }

    if (action === 'resume_all') {
      // People who replied stay paused: they must never get another automatic email.
      const { data: paused, error } = await supabaseAdmin
        .from('leads')
        .select('id')
        .eq('organization_id', orgId)
        .eq('sequence_status', 'paused')
        .or('has_replied.is.null,has_replied.eq.false')
        .limit(1000);
      if (error) throw new Error(error.message);

      let resumed = 0;
      for (const lead of paused || []) {
        const result = await SequenceService.resume(lead.id);
        if (result.ok) resumed++;
      }
      return NextResponse.json({ data: { resumed }, error: null });
    }

    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'action must be pause_all or resume_all' } },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error updating send queue:', error);
    return NextResponse.json({ data: null, error: { code: 'QUEUE_FAILED', message: error.message } }, { status: 500 });
  }
}
