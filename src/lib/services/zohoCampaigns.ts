export class ZohoCampaignsService {
  private static getApiUrl(): string {
    return process.env.ZOHO_CAMPAIGNS_API_URL || 'https://campaigns.zoho.com/api/v1.1';
  }

  private static tokenCache: Record<string, { accessToken: string; tokenExpiry: number }> = {};

  private static async getAccessToken(
    orgId: string,
    clientId: string,
    clientSecret: string,
    refreshToken: string,
    accountsUrl: string = 'https://accounts.zoho.com'
  ): Promise<string> {
    const now = Date.now();
    const cached = this.tokenCache[orgId];
    if (cached && now < cached.tokenExpiry - 60000) {
      return cached.accessToken;
    }

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Zoho Campaigns credentials (clientId, clientSecret, refreshToken) are missing.');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });

    const tokenUrl = `${accountsUrl}/oauth/v2/token?${params.toString()}`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh Zoho Campaigns access token: ${await response.text()}`);
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error('Zoho token response did not contain access_token');
    }

    this.tokenCache[orgId] = {
      accessToken: data.access_token,
      tokenExpiry: Date.now() + (data.expires_in * 1000)
    };

    return data.access_token;
  }

  /**
   * Pushes lead engagement data to Zoho Campaigns.
   */
  public static async pushEngagement(
    credentials: { orgId: string; clientId: string; clientSecret: string; refreshToken: string; accountsUrl?: string; campaignsApiUrl?: string },
    email: string,
    campaignName: string,
    action: 'opened' | 'clicked',
    details: string
  ): Promise<boolean> {
    try {
      const token = await this.getAccessToken(credentials.orgId, credentials.clientId, credentials.clientSecret, credentials.refreshToken, credentials.accountsUrl);
      const apiUrl = `${credentials.campaignsApiUrl || this.getApiUrl()}/updateContactActivity`;

      const params = new URLSearchParams({
        resfmt: 'JSON',
        contactinfo: JSON.stringify({
          'Contact Email': email,
          'Campaign Name': campaignName,
          'Action': action,
          'Details': details
        })
      });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        console.warn('Failed to sync with Zoho Campaigns:', await response.text());
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error syncing with Zoho Campaigns:', error);
      return false;
    }
  }

  /**
   * Triggers an email dispatch using Zoho Campaigns Transmission API
   */
  public static async triggerEmail(
    credentials: { orgId: string; clientId: string; clientSecret: string; refreshToken: string; accountsUrl?: string; campaignsApiUrl?: string },
    campaignKey: string,
    recipientEmail: string,
    recipientName: string,
    customBody: string
  ): Promise<boolean> {
    try {
      const token = await this.getAccessToken(credentials.orgId, credentials.clientId, credentials.clientSecret, credentials.refreshToken, credentials.accountsUrl);
      const apiUrl = `${credentials.campaignsApiUrl || this.getApiUrl()}/json/transmission`;

      // Structure for Zoho Campaigns transmission
      const payload = {
        campaign_key: campaignKey,
        recipients: [
          {
            email: recipientEmail,
            first_name: recipientName,
            merge_data: {
              AI_Email_Body: customBody
            }
          }
        ]
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.warn('Failed to trigger Zoho Campaigns email:', await response.text());
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error triggering Zoho Campaigns email:', error);
      return false;
    }
  }

  /**
   * Fetches all mailing lists from Zoho Campaigns.
   */
  public static async getMailingLists(
    credentials: { orgId: string; clientId: string; clientSecret: string; refreshToken: string; accountsUrl?: string; campaignsApiUrl?: string }
  ) {
    try {
      const token = await this.getAccessToken(credentials.orgId, credentials.clientId, credentials.clientSecret, credentials.refreshToken, credentials.accountsUrl);
      const apiUrl = `${credentials.campaignsApiUrl || this.getApiUrl()}/getmailinglists?resfmt=JSON`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'Authorization': `Zoho-oauthtoken ${token}` }
      });

      if (!response.ok) return [];
      const data = await response.json();
      
      if (data && data.list_of_details) {
        return data.list_of_details; // Array of mailing lists
      }
      return [];
    } catch (error) {
      console.error('Error fetching Zoho Mailing Lists:', error);
      return [];
    }
  }

  /**
   * Creates a new Zoho Campaign.
   */
  public static async createCampaign(
    credentials: { orgId: string; clientId: string; clientSecret: string; refreshToken: string; accountsUrl?: string; campaignsApiUrl?: string },
    payload: {
      campaignname: string;
      from_email: string;
      subject: string;
      listkey: string;
      content_url: string;
    }
  ) {
    try {
      const token = await this.getAccessToken(credentials.orgId, credentials.clientId, credentials.clientSecret, credentials.refreshToken, credentials.accountsUrl);
      const apiUrl = `${credentials.campaignsApiUrl || this.getApiUrl()}/createCampaign`;

      // API requires x-www-form-urlencoded
      const formData = new URLSearchParams();
      formData.append('resfmt', 'JSON');
      formData.append('campaignname', payload.campaignname);
      formData.append('from_email', payload.from_email);
      formData.append('subject', payload.subject);
      // list_details expects JSON string: {"listkey1":[]}
      formData.append('list_details', JSON.stringify({ [payload.listkey]: [] }));
      formData.append('content_url', payload.content_url);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      const data = await response.json();
      
      if (data && data.status === 'success' && data.recent_activities && data.recent_activities.campaign_key) {
        return data.recent_activities.campaign_key;
      } else if (data && data.campaign_key) {
        return data.campaign_key;
      }
      
      console.warn('Failed to parse campaign key from response:', data);
      return null;
    } catch (error) {
      console.error('Error creating Zoho Campaign:', error);
      return null;
    }
  }

  /**
   * Fetches aggregate campaign statistics (sent, opened, clicked) from Zoho Campaigns.
   */
  public static async fetchCampaignAnalytics(
    credentials: { orgId: string; clientId: string; clientSecret: string; refreshToken: string; accountsUrl?: string; campaignsApiUrl?: string },
    campaignName: string
  ) {
    try {
      const token = await this.getAccessToken(credentials.orgId, credentials.clientId, credentials.clientSecret, credentials.refreshToken, credentials.accountsUrl);
      
      const searchUrl = `${credentials.campaignsApiUrl || this.getApiUrl()}/getCampaigns?resfmt=JSON&status=sent`;
      const searchResponse = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`
        },
      });

      if (!searchResponse.ok) {
        console.warn('Failed to fetch campaigns from Zoho Campaigns:', await searchResponse.text());
        return null;
      }

      const searchRaw = await searchResponse.text();
      let searchData;
      try {
        searchData = JSON.parse(searchRaw);
      } catch (e) {
        console.warn('Zoho Campaigns returned non-JSON (likely XML error):', searchRaw);
        return null;
      }
      
      // The API returns recent campaigns. Find the one matching our name.
      const campaignsList = searchData.recent_campaigns || [];
      const matchedCampaign = campaignsList.find((c: any) => c.campaign_name === campaignName);

      if (!matchedCampaign) {
        console.warn(`Campaign ${campaignName} not found in Zoho Campaigns or has not been sent yet.`);
        return {
          totalSent: 0,
          totalOpened: 0,
          openRate: 0,
          totalClicked: 0,
          campaignKey: null
        };
      }

      const campaignKey = matchedCampaign.campaign_key;

      // Now fetch the specific summary for this campaign
      const summaryUrl = `${credentials.campaignsApiUrl || this.getApiUrl()}/getCampaignSummary?resfmt=JSON&campaign_key=${campaignKey}`;
      const summaryResponse = await fetch(summaryUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`
        },
      });

      if (!summaryResponse.ok) {
        console.warn('Failed to fetch campaign summary:', await summaryResponse.text());
        return null;
      }

      const summaryRaw = await summaryResponse.text();
      let summaryData;
      try {
        summaryData = JSON.parse(summaryRaw);
      } catch (e) {
        console.warn('Zoho Campaigns returned non-JSON for summary:', summaryRaw);
        return null;
      }
      const details = summaryData.campaign_details || {};

      const totalSent = parseInt(details.emails_sent, 10) || 0;
      const totalOpened = parseInt(details.unique_opens, 10) || 0;
      const totalClicked = parseInt(details.unique_clicks, 10) || 0;
      
      const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;

      return {
        totalSent,
        totalOpened,
        openRate,
        totalClicked,
        campaignKey
      };
    } catch (error) {
      console.error('Error fetching Zoho Campaigns analytics:', error);
      return null;
    }
  }

  /**
   * Fetches granular recipient data (opens or clicks) for a specific campaign.
   */
  public static async fetchCampaignRecipients(
    credentials: { orgId: string; clientId: string; clientSecret: string; refreshToken: string; accountsUrl?: string; campaignsApiUrl?: string },
    campaignKey: string,
    type: 'open' | 'click'
  ) {
    try {
      const token = await this.getAccessToken(credentials.orgId, credentials.clientId, credentials.clientSecret, credentials.refreshToken, credentials.accountsUrl);
      const url = `${credentials.campaignsApiUrl || this.getApiUrl()}/getCampaign${type === 'open' ? 'Opened' : 'Clicked'}Details?resfmt=JSON&campaign_key=${campaignKey}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`
        }
      });

      if (!response.ok) {
        return [];
      }

      const rawData = await response.text();
      let data;
      try {
        data = JSON.parse(rawData);
      } catch (e) {
        return [];
      }
      
      if (data && data.response && data.response.result && data.response.result.campaign_recipients) {
        return data.response.result.campaign_recipients;
      }
      
      if (data.campaign_recipients) {
        return data.campaign_recipients;
      }

      if (Array.isArray(data)) {
        return data;
      }

      return [];
    } catch (error) {
      return [];
    }
  }
}
