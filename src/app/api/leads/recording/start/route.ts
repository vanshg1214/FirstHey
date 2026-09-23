import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUserOrgId } from '@/lib/auth';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, campaignId } = body;

    // The organization is always derived from the authenticated session —
    // never trust a client-supplied organizationId, since this insert uses
    // the admin client and bypasses RLS.
    const orgId = await getCurrentUserOrgId();

    if (!orgId) {
      return NextResponse.json(
        {
          data: null,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Unauthorized',
          },
        },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Insert a new lead record in 'capturing' state
    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .insert({
        organization_id: orgId,
        captured_by: user?.id || userId || null,
        status: 'capturing',
        contact_fields: {},
        context_summary: {},
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to initialize lead in database: ${error.message}`);
    }

    return NextResponse.json({
      data: {
        leadId: lead.id,
        status: lead.status,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Error starting recording session:', error);
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'START_RECORDING_FAILED',
          message: error.message || 'An error occurred while starting the recording session.',
        },
      },
      { status: 500 }
    );
  }
}
