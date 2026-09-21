'use server';

import { createClient } from '@/utils/supabase/server';
import { getCurrentUserOrgId } from '@/lib/auth';
import { OrganizationSettings } from '@/lib/services/settings';

export async function getOrganizationSettings(): Promise<OrganizationSettings | null> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('organization_settings')
    .select('*')
    .eq('organization_id', orgId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching settings:', error);
    return null;
  }

  return data;
}

export async function saveOrganizationSettings(settings: OrganizationSettings): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const orgId = await getCurrentUserOrgId();

  if (!user || !orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // Upsert settings
  const { error } = await supabase
    .from('organization_settings')
    .upsert({
      organization_id: orgId,
      gemini_api_key: settings.gemini_api_key,
      email_provider: settings.email_provider || 'gmail',
      email_user: settings.email_user,
      email_password: settings.email_password,
      email_from_name: settings.email_from_name,
      email_sender_title: settings.email_sender_title,
      zoho_client_id: settings.zoho_client_id,
      zoho_client_secret: settings.zoho_client_secret,
      zoho_refresh_token: settings.zoho_refresh_token,
      zoho_api_url: settings.zoho_api_url,
      zoho_accounts_url: settings.zoho_accounts_url,
      zoho_campaign_key: settings.zoho_campaign_key,
      zoho_campaigns_api_url: settings.zoho_campaigns_api_url,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id' });

  if (error) {
    console.error('Error saving settings:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getOrganizationInfo(): Promise<{ name: string } | null> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single();

  if (error) return null;
  return data;
}

export async function updateOrganizationInfo(name: string): Promise<{ success: boolean; error?: string }> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) return { success: false, error: 'Unauthorized' };

  if (!name || name.trim().length === 0) {
    return { success: false, error: 'Organization name cannot be empty' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('organizations')
    .update({ name: name.trim() })
    .eq('id', orgId);

  if (error) {
    console.error('Error updating org name:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
