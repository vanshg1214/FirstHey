import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserOrgId } from '@/lib/auth';
import { SettingsService } from '@/lib/services/settings';
import { ZohoCampaignsService } from '@/lib/services/zohoCampaigns';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const settings = await SettingsService.getSettings(orgId);

    if (!settings.zoho_client_id || !settings.zoho_refresh_token) {
      return NextResponse.json(
        { data: null, error: { message: 'Zoho is not configured in settings.' } },
        { status: 400 }
      );
    }

    const credentials = {
      orgId,
      clientId: settings.zoho_client_id,
      clientSecret: settings.zoho_client_secret || '',
      refreshToken: settings.zoho_refresh_token,
      accountsUrl: settings.zoho_accounts_url || 'https://accounts.zoho.in',
      campaignsApiUrl: settings.zoho_campaigns_api_url || (settings.zoho_accounts_url?.includes('.in') ? 'https://campaigns.zoho.in/api/v1.1' : 'https://campaigns.zoho.com/api/v1.1')
    };

    const mailingLists = await ZohoCampaignsService.getMailingLists(credentials);

    if (!mailingLists) {
      return NextResponse.json({ data: [], error: null });
    }

    const simplifiedLists = mailingLists.map((list: any) => ({
      listkey: list.listkey,
      listname: list.listname,
      contactCount: list.noofcontacts
    }));

    return NextResponse.json({ data: simplifiedLists, error: null });
  } catch (error: any) {
    console.error('Failed to fetch Zoho lists:', error);
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    );
  }
}
