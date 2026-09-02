import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserOrgId } from '@/lib/auth';
import { createClient } from '@/utils/supabase/server';
import { SettingsService } from '@/lib/services/settings';
import { ZohoCampaignsService } from '@/lib/services/zohoCampaigns';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await SettingsService.getSettings(orgId);
    
    // Verify credentials exist
    if (!settings.zoho_client_id || !settings.zoho_client_secret || !settings.zoho_refresh_token) {
      return NextResponse.json({ error: 'Zoho OAuth credentials are not fully configured.' }, { status: 400 });
    }

    const credentials = {
      orgId,
      clientId: settings.zoho_client_id,
      clientSecret: settings.zoho_client_secret,
      refreshToken: settings.zoho_refresh_token,
      accountsUrl: settings.zoho_accounts_url,
      campaignsApiUrl: settings.zoho_campaigns_api_url
    };

    // 1. Fetch Mailing Lists to get a listkey
    const mailingLists = await ZohoCampaignsService.getMailingLists(credentials);
    
    if (!mailingLists || mailingLists.length === 0) {
      return NextResponse.json({ error: 'No Mailing Lists found in your Zoho Campaigns account. Please create at least one Mailing List first.' }, { status: 400 });
    }
    
    // Grab the first listkey
    const targetListKey = mailingLists[0].listkey;

    // 2. Determine base URL for content_url
    // In production, we need the actual deployed domain. If not set, fallback to request URL origin.
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
    
    const contentUrl = `${baseUrl}/api/assets/zoho-template`;

    // 3. Create the campaign
    const campaignKey = await ZohoCampaignsService.createCampaign(credentials, {
      campaignname: `Apexora AI Auto-Followups - ${Date.now()}`,
      from_email: (settings as any).from_email || 'hello@apexora.ai',
      subject: '$[AI_Email_Body]$', // Provide placeholder subject just in case
      listkey: targetListKey,
      content_url: contentUrl
    });

    if (!campaignKey) {
      return NextResponse.json({ error: 'Failed to create Zoho Campaign. Please check your credentials and try again.' }, { status: 500 });
    }

    // 4. Save the campaign key to DB
    const supabase = await createClient();
    await supabase
      .from('organization_settings')
      .upsert(
        { 
          organization_id: orgId, 
          zoho_campaign_key: campaignKey 
        }, 
        { onConflict: 'organization_id' }
      );

    return NextResponse.json({ success: true, campaign_key: campaignKey });
  } catch (error: any) {
    console.error('Zoho Auto-Setup Error:', error);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred.' }, { status: 500 });
  }
}
