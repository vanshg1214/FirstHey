import { NextRequest, NextResponse } from 'next/server';
import { CampaignsRepository } from '@/lib/repositories/campaigns';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUserOrgId } from '@/lib/auth';

async function verifyCampaignInOrg(campaignId: string, orgId: string) {
  const { data } = await supabaseAdmin.from('campaigns').select('id').eq('id', campaignId).eq('organization_id', orgId).single();
  return !!data;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const campaignId = resolvedParams.id;
    const body = await req.json();
    const { lead_id } = body;

    if (!lead_id) {
      return NextResponse.json(
        { data: null, error: { message: 'lead_id is required' } },
        { status: 400 }
      );
    }

    const orgId = await getCurrentUserOrgId();
    if (!orgId) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    if (!(await verifyCampaignInOrg(campaignId, orgId))) {
      return NextResponse.json({ data: null, error: { message: 'Campaign not found or access denied' } }, { status: 404 });
    }

    const supabase = await createClient();
    await CampaignsRepository.addLeadToCampaign(supabase, campaignId, lead_id);

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error: any) {
    console.error(`Failed to add lead to campaign:`, error);
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const campaignId = resolvedParams.id;
    // We expect lead_id in the URL search params: ?lead_id=123
    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get('lead_id');

    if (!leadId) {
       return NextResponse.json(
        { data: null, error: { message: 'lead_id is required as a query parameter' } },
        { status: 400 }
      );
    }

    const orgId = await getCurrentUserOrgId();
    if (!orgId) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    if (!(await verifyCampaignInOrg(campaignId, orgId))) {
      return NextResponse.json({ data: null, error: { message: 'Campaign not found or access denied' } }, { status: 404 });
    }

    // Use admin client to bypass RLS which silently ignores deletes for regular users.
    // Ownership was already verified above, so this is safe.
    await CampaignsRepository.removeLeadFromCampaign(supabaseAdmin, campaignId, leadId);

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error: any) {
    console.error(`Failed to remove lead from campaign:`, error);
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    );
  }
}
