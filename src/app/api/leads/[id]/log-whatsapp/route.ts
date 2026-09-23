import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { LeadsRepository } from '@/lib/repositories/leads';
import { getCurrentUserOrgId } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { whatsappBody } = body;

    if (!whatsappBody) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: 'Missing parameters' } },
        { status: 400 }
      );
    }

    const orgId = await getCurrentUserOrgId();
    if (!orgId) {
      return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }

    const supabase = supabaseAdmin;
    const lead = await LeadsRepository.getLeadById(supabase, id);
    if (!lead || lead.organization_id !== orgId) {
      return NextResponse.json({ data: null, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
    }

    // Update the lead status
    await supabase
      .from('leads')
      .update({ status: 'contacted' })
      .eq('id', id);

    // Insert into followups table to log it
    await supabase.from('followups').insert({
      lead_id: id,
      sequence_position: 1,
      channel: 'whatsapp',
      status: 'sent',
      body: whatsappBody,
      scheduled_for: new Date().toISOString(),
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({
      data: { success: true },
      error: null,
    });
  } catch (error: any) {
    console.error('Error logging WhatsApp followup:', error);
    return NextResponse.json({ data: null, error: { code: 'LOG_WHATSAPP_FAILED', message: error.message } }, { status: 500 });
  }
}
