import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';
import { SequenceService } from '@/lib/services/sequence';

async function getOrgId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('users').select('organization_id').eq('id', user.id).single();
  return data?.organization_id || null;
}

/** Pause or resume the automatic follow-up sequence for one lead. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orgId = await getOrgId();
    if (!orgId) {
      return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }

    const { action } = await req.json();
    if (action !== 'pause' && action !== 'resume') {
      return NextResponse.json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'action must be pause or resume' } }, { status: 400 });
    }

    // Org check first so one org can't touch another org's leads.
    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('id')
      .eq('id', id)
      .eq('organization_id', orgId)
      .maybeSingle();
    if (!lead) {
      return NextResponse.json({ data: null, error: { code: 'NOT_FOUND', message: 'Lead not found' } }, { status: 404 });
    }

    if (action === 'pause') {
      await SequenceService.pause(id);
    } else {
      const res = await SequenceService.resume(id);
      if (!res.ok) {
        return NextResponse.json({ data: null, error: { code: 'CANNOT_RESUME', message: res.reason } }, { status: 409 });
      }
    }

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error: any) {
    console.error('Error updating sequence:', error);
    return NextResponse.json(
      { data: null, error: { code: 'SEQUENCE_UPDATE_FAILED', message: error.message } },
      { status: 500 }
    );
  }
}
