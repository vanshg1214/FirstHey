import { SupabaseClient } from '@supabase/supabase-js';

export interface LeadInsert {
  organization_id: string;
  captured_by: string | null;
  status?: 'capturing' | 'extracted' | 'confirmed' | 'synced' | 'needs_attention';
  contact_fields?: any;
  context_summary?: any;
}

export class LeadsRepository {
  /**
   * Creates a new lead record along with its associated recording details.
   */
  public static async createLeadWithRecording(
    supabase: SupabaseClient<any, "public", any>,
    leadData: LeadInsert,
    recording: { audio_url: string; transcript: string; status: 'completed' | 'failed' }
  ) {
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        organization_id: leadData.organization_id,
        captured_by: leadData.captured_by,
        status: leadData.status || 'extracted',
        contact_fields: leadData.contact_fields || {},
        context_summary: leadData.context_summary || {},
      })
      .select()
      .single();

    if (leadError) throw new Error(`Database error creating lead: ${leadError.message}`);

    // Voice notes are currently disabled in FirstHey minimal schema.
    // We just return the created lead.
    return lead;
  }

  /**
   * Retrieves a lead with its recording and card scan details.
   */
  public static async getLeadById(supabase: SupabaseClient<any, "public", any>, leadId: string) {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (error) throw new Error(`Database error fetching lead ${leadId}: ${error.message}`);
    return data;
  }

  /**
   * Updates the contact fields and sets status.
   */
  public static async updateContactFields(supabase: SupabaseClient<any, "public", any>, leadId: string, fields: any, status: string = 'extracted') {
    const { data: existing } = await supabase
      .from('leads')
      .select('contact_fields, context_summary')
      .eq('id', leadId)
      .maybeSingle();

    // What the user typed wins over what is stored, but fields they didn't send (address, second phone,
    // website) are kept. The card photo is saved separately, never inside the contact details.
    const { image: _image, ...incoming } = fields || {};
    const previous = existing?.contact_fields || {};
    const merged: Record<string, any> = { ...previous, ...incoming };

    const update: Record<string, any> = {
      name: merged.name || null,
      company: merged.company || null,
      title: merged.title || null,
      email: merged.email || null,
      phone: merged.phone || null,
      secondary_phone: merged.secondary_phone || null,
      website: merged.website || null,
      address: merged.address || null,
      contact_fields: merged,
      status: status,
    };

    // A saved draft was written for the old details. If name, company, title or email changed, drop it
    // so the next draft is written from what the user entered.
    const detailsChanged = ['name', 'company', 'title', 'email'].some(
      k => (previous[k] || null) !== (merged[k] || null)
    );
    if (detailsChanged && existing?.context_summary?.latest_draft) {
      const { latest_draft: _draft, ...rest } = existing.context_summary;
      update.context_summary = rest;
    }

    const { data, error } = await supabase
      .from('leads')
      .update(update)
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw new Error(`Database error updating lead contact fields: ${error.message}`);
    return data;
  }

  /**
   * Associates a card scan image and extracted fields with a lead.
   */
  public static async associateCardScan(
    supabase: SupabaseClient<any, "public", any>,
    leadId: string,
    imageUrl: string,
    extractedFields: any,
    confidence: number
  ) {
    const { data, error } = await supabase
      .from('leads')
      .update({
        cardImage: imageUrl
      })
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw new Error(`Database error updating lead card image: ${error.message}`);
    return data;
  }

  /**
   * Updates the final CRM record ID and marks the status as synced.
   */
  public static async markAsSynced(supabase: SupabaseClient<any, "public", any>, leadId: string, crmRecordId: string) {
    const { data, error } = await supabase
      .from('leads')
      .update({
        crm_record_id: crmRecordId,
        status: 'synced',
      })
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw new Error(`Database error marking lead as synced: ${error.message}`);
    return data;
  }

  /**
   * Updates the lead status (e.g. to 'needs_attention').
   */
  public static async updateStatus(supabase: SupabaseClient<any, "public", any>, leadId: string, status: 'needs_attention' | 'confirmed' | 'synced') {
    const { data, error } = await supabase
      .from('leads')
      .update({ status })
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw new Error(`Database error updating lead status: ${error.message}`);
    return data;
  }

  /**
   * Logs a CRM sync event (Zoho or Sheets fallback).
   */
  public static async logCrmSyncAttempt(
    supabase: SupabaseClient<any, "public", any>,
    leadId: string,
    targetSystem: 'zoho' | 'sheets',
    status: 'success' | 'failed',
    errorMessage?: string
  ) {
    const { data, error } = await supabase
      .from('crm_sync_log')
      .insert({
        lead_id: leadId,
        target_system: targetSystem,
        status,
        error_message: errorMessage || null,
      })
      .select()
      .single();

    if (error) console.error(`Database logging failure: ${error.message}`);
    return data;
  }

  /**
   * Updates the exhibition and stall event tracking data.
   */
  public static async updateEventTracking(
    supabase: SupabaseClient<any, "public", any>,
    leadId: string,
    exhibition: string | null,
    stall: string | null,
    exhibitionId?: string | null
  ) {
    // Only touch the fields that were provided, so saving one never wipes another.
    const patch: Record<string, any> = {};
    if (exhibition) patch.exhibition = exhibition;
    if (exhibitionId) patch.exhibition_id = exhibitionId;
    if (stall) patch.stall = stall;
    if (Object.keys(patch).length === 0) return null;

    const { data, error } = await supabase
      .from('leads')
      .update(patch)
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw new Error(`Database error updating lead event tracking: ${error.message}`);
    return data;
  }
}
