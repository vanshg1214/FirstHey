import { NextRequest, NextResponse } from 'next/server';
import { CampaignsRepository } from '@/lib/repositories/campaigns';
import { getCurrentUserOrgId } from '@/lib/auth';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { SettingsService } from '@/lib/services/settings';
import { ZohoCampaignsService } from '@/lib/services/zohoCampaigns';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const supabase = await createClient();
    const campaigns = await CampaignsRepository.getCampaigns(supabase, orgId);
    return NextResponse.json({ data: campaigns, error: null });
  } catch (error: any) {
    console.error('Failed to fetch campaigns:', error);
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, zoho_list_key, zoho_list_name } = body;

    if (!name) {
      return NextResponse.json(
        { data: null, error: { message: 'Campaign name is required' } },
        { status: 400 }
      );
    }

    let zoho_campaign_key: string | undefined = undefined;

    // --- ZOHO AUTO-CREATION LOGIC ---
    try {
      const settings = await SettingsService.getSettings(orgId);
      console.log(`[ZOHO SETUP] Checking credentials... ID: ${!!settings.zoho_client_id}, Secret: ${!!settings.zoho_client_secret}, Token: ${!!settings.zoho_refresh_token}`);
      console.log(`[ZOHO SETUP] Using Refresh Token starting with:`, settings.zoho_refresh_token ? settings.zoho_refresh_token.substring(0, 20) + '...' : 'none');
      console.log(`[ZOHO SETUP] Accounts URL:`, settings.zoho_accounts_url);
      console.log(`[ZOHO SETUP] Campaigns URL:`, settings.zoho_campaigns_api_url);
      
      // If Zoho is configured, try to create the campaign
      if (settings.zoho_client_id && settings.zoho_client_secret && settings.zoho_refresh_token) {
        const credentials = {
          orgId,
          clientId: settings.zoho_client_id,
          clientSecret: settings.zoho_client_secret,
          refreshToken: settings.zoho_refresh_token,
          accountsUrl: settings.zoho_accounts_url,
          campaignsApiUrl: settings.zoho_campaigns_api_url || (settings.zoho_accounts_url?.includes('.in') ? 'https://campaigns.zoho.in/api/v1.1' : 'https://campaigns.zoho.com/api/v1.1')
        };

        const mailingLists = await ZohoCampaignsService.getMailingLists(credentials);
        console.log(`[ZOHO SETUP] Fetched Mailing Lists:`, mailingLists?.length);
        
        if (mailingLists && mailingLists.length > 0) {
          // Find the first list that actually has contacts in it to avoid Code 6606
          const validList = mailingLists.find((list: any) => parseInt(list.noofcontacts || '0', 10) > 0) || mailingLists[0];
          const targetListKey = validList.listkey;
          console.log(`[ZOHO SETUP] Selected List: ${validList.listname} (${validList.noofcontacts} contacts)`);
          
          // Fetch Topics if Topic Management is enabled
          const topics = await ZohoCampaignsService.getTopics(credentials);
          let topicId = undefined;
          if (topics && topics.length > 0) {
            topicId = topics[0].topicId;
            console.log(`[ZOHO SETUP] Selected Topic: ${topics[0].topicName} (${topicId})`);
          }

          // Generate dynamic webhook URL to permanently bypass UNABLE_TO_IMPORT
          const hookRes = await fetch('https://webhook.site/token', { method: 'POST' });
          const hookToken = await hookRes.json();
          await fetch(`https://webhook.site/token/${hookToken.uuid}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              default_content: '<html><body><p>$[AI_Email_Body]$</p><p>$[ZCSNIP_Unsubscribe]$</p></body></html>',
              default_content_type: 'text/html'
            })
          });
          const dynamicContentUrl = `https://webhook.site/${hookToken.uuid}`;
          
          console.log(`[ZOHO SETUP] Attempting to create Campaign: FirstHey: ${name}...`);
          const campaignKey = await ZohoCampaignsService.createCampaign(credentials, {
            campaignname: `FirstHey: ${name} - ${Date.now()}`,
            from_email: (settings as any).email_user || 'ng@thenextdesign.com',
            subject: '$[AI_Email_Body]$',
            listkey: targetListKey,
            content_url: dynamicContentUrl,
            topicId: topicId
          });

          console.log(`[ZOHO SETUP] Created Campaign Key:`, campaignKey);

          if (campaignKey) {
            zoho_campaign_key = campaignKey;
          } else {
            console.warn(`[ZOHO SETUP] createCampaign returned null/undefined`);
          }
        } else {
          console.warn(`[ZOHO SETUP] No mailing lists found to attach the campaign to.`);
        }
      } else {
        console.warn(`[ZOHO SETUP] Missing Zoho credentials in settings. Skipping Zoho API.`);
      }
    } catch (zohoError) {
      console.error("[ZOHO SETUP] Error during auto-creation:", zohoError);
    }
    // --------------------------------

    const supabase = supabaseAdmin;
    const campaign = await CampaignsRepository.createCampaign(supabase, {
      organization_id: orgId,
      name,
      description,
      zoho_campaign_key,
      zoho_list_key,
      zoho_list_name
    });

    return NextResponse.json({ data: campaign, error: null });
  } catch (error: any) {
    console.error('Failed to create campaign:', error);
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    );
  }
}
