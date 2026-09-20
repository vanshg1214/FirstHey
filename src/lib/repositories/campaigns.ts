import { SupabaseClient } from '@supabase/supabase-js';

export interface CampaignInsert {
  organization_id: string;
  name: string;
  description?: string;
  created_by?: string;
  zoho_campaign_key?: string;
  zoho_list_key?: string;
  zoho_list_name?: string;
}

export class CampaignsRepository {
  /**
   * Creates a new campaign.
   */
  public static async createCampaign(supabase: SupabaseClient<any, "public", any>, campaignData: CampaignInsert) {
    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        organization_id: campaignData.organization_id,
        name: campaignData.name,
        description: campaignData.description || null,
        created_by: campaignData.created_by || null,
        zoho_campaign_key: campaignData.zoho_campaign_key || null,
        zoho_list_key: campaignData.zoho_list_key || null,
        zoho_list_name: campaignData.zoho_list_name || null,
        status: 'active'
      })
      .select()
      .single();

    if (error) throw new Error(`Database error creating campaign: ${error.message}`);
    return data;
  }

  /**
   * Retrieves all campaigns for an organization, including lead counts.
   */
  public static async getCampaigns(supabase: SupabaseClient<any, "public", any>, organizationId: string) {
    // We can fetch campaigns and join on campaign_leads to get counts
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        campaign_leads(
          lead:leads(context_summary, total_emails_sent, followups(status))
        )
      `)
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Database error fetching campaigns: ${error.message}`);

    // Map the Supabase count object to a flat number and calculate stats
    return data.map((campaign: any) => {
      const leads = campaign.campaign_leads || [];
      const hotCount = leads.filter((cl: any) => cl.lead?.context_summary?.is_hot === true).length;
      const openedCount = leads.filter((cl: any) => (cl.lead?.context_summary?.open_count || 0) > 0).length;
      const sentCount = leads.reduce((sum: number, cl: any) => {
        const leadSent = cl.lead?.followups ? cl.lead.followups.filter((f: any) => ['sent', 'opened'].includes(f.status)).length : 0;
        return sum + Math.max(leadSent, (cl.lead?.total_emails_sent || 0));
      }, 0);
      
      return {
        ...campaign,
        lead_count: leads.length,
        hot_count: hotCount,
        opened_count: openedCount,
        emails_sent: sentCount,
        campaign_leads: undefined // clean up response
      };
    });
  }

  /**
   * Retrieves a single campaign with all its associated leads.
   */
  public static async getCampaignById(supabase: SupabaseClient<any, "public", any>, campaignId: string) {
    // Execute campaign details and leads queries concurrently to improve speed
    const [campaignRes, leadsRes] = await Promise.all([
      supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single(),
      supabase
        .from('campaign_leads')
        .select(`
          lead_id,
          added_at,
          leads (*)
        `)
        .eq('campaign_id', campaignId)
        .order('added_at', { ascending: false })
    ]);

    if (campaignRes.error) throw new Error(`Database error fetching campaign: ${campaignRes.error.message}`);
    if (leadsRes.error) throw new Error(`Database error fetching campaign leads: ${leadsRes.error.message}`);

    const campaign = campaignRes.data;
    const leads = leadsRes.data;

    return {
      ...campaign,
      leads: leads
        .filter(cl => cl && cl.leads) // extra safety check
        .map(cl => ({
          ...(cl.leads || {}),
          id: cl.lead_id, // Force the ID to be present from the pivot table
          campaign_added_at: cl.added_at
        }))
    };
  }

  /**
   * Adds a single lead to a campaign.
   */
  public static async addLeadToCampaign(supabase: SupabaseClient<any, "public", any>, campaignId: string, leadId: string) {
    const { data, error } = await supabase
      .from('campaign_leads')
      .insert({
        campaign_id: campaignId,
        lead_id: leadId,
      })
      .select()
      .single();

    if (error) {
      // Ignore unique constraint violations (if lead is already in campaign)
      if (error.code === '23505') {
        return null; 
      }
      throw new Error(`Database error adding lead to campaign: ${error.message}`);
    }

    return data;
  }

  /**
   * Removes a single lead from a campaign.
   */
  public static async removeLeadFromCampaign(supabase: SupabaseClient<any, "public", any>, campaignId: string, leadId: string) {
    const { error } = await supabase
      .from('campaign_leads')
      .delete()
      .match({ campaign_id: campaignId, lead_id: leadId });

    if (error) throw new Error(`Database error removing lead from campaign: ${error.message}`);
    return true;
  }

  /**
   * Archives a campaign.
   */
  public static async archiveCampaign(supabase: SupabaseClient<any, "public", any>, campaignId: string) {
    const { error } = await supabase
      .from('campaigns')
      .update({ status: 'archived' })
      .eq('id', campaignId);

    if (error) throw new Error(`Database error archiving campaign: ${error.message}`);
    return true;
  }
  /**
   * Updates a campaign.
   */
  public static async updateCampaign(supabase: SupabaseClient<any, "public", any>, campaignId: string, updates: any) {
    const { data, error } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', campaignId)
      .select()
      .single();

    if (error) throw new Error(`Database error updating campaign: ${error.message}`);
    return data;
  }
}
