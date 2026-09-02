import { supabaseAdmin } from '@/lib/supabase';

export interface OrganizationSettings {
  gemini_api_key?: string;
  email_provider?: string;
  email_user?: string;
  email_password?: string;
  email_from_name?: string;
  zoho_client_id?: string;
  zoho_client_secret?: string;
  zoho_refresh_token?: string;
  zoho_api_url?: string;
  zoho_accounts_url?: string;
  zoho_campaign_key?: string;
  zoho_campaigns_api_url?: string;
  company_profile?: string;
}

export class SettingsService {
  /**
   * Retrieves the settings for a specific organization using the admin key.
   * This is safe for background jobs.
   */
  public static async getSettings(organizationId: string): Promise<OrganizationSettings> {
    if (!organizationId) {
      throw new Error('organizationId is required to fetch settings.');
    }

    const { data, error } = await supabaseAdmin
      .from('organization_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .single();

    let dbSettings: any = {};

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error(`Failed to fetch organization settings: ${error.message}`);
      }
    } else {
      dbSettings = data || {};
    }

    // Merge DB settings with .env fallback for Internal Tool Mode
    return {
      ...dbSettings,
      gemini_api_key: dbSettings.gemini_api_key || process.env.GEMINI_API_KEY,
      zoho_client_id: dbSettings.zoho_client_id || process.env.ZOHO_CLIENT_ID,
      zoho_client_secret: dbSettings.zoho_client_secret || process.env.ZOHO_CLIENT_SECRET,
      zoho_refresh_token: dbSettings.zoho_refresh_token || process.env.ZOHO_REFRESH_TOKEN,
      zoho_api_url: dbSettings.zoho_api_url || process.env.ZOHO_API_URL,
      zoho_accounts_url: dbSettings.zoho_accounts_url || process.env.ZOHO_ACCOUNTS_URL,
      zoho_campaign_key: dbSettings.zoho_campaign_key || process.env.ZOHO_CAMPAIGN_KEY,
      zoho_campaigns_api_url: dbSettings.zoho_campaigns_api_url || process.env.ZOHO_CAMPAIGNS_API_URL,
    };
  }
}
