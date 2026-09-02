import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ZohoService } from '@/lib/services/zoho';
import { ZohoCampaignsService } from '@/lib/services/zohoCampaigns';
import { SettingsService } from '@/lib/services/settings';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const touch = searchParams.get('touch') || 'unknown';

    // 1. Fetch the lead record
    const { data: lead, error: fetchError } = await supabaseAdmin
      .from('leads')
      .select('context_summary, crm_record_id, contact_fields, organization_id')
      .eq('id', id)
      .single();

    if (!fetchError && lead) {
      const contextSummary = lead.context_summary || {};
      
      // Update open stats in JSONB
      const currentOpens = typeof contextSummary.open_count === 'number' ? contextSummary.open_count : 0;
      const newOpens = currentOpens + 1;
      
      const emailOpens = contextSummary.email_opens || {};
      emailOpens[touch] = (emailOpens[touch] || 0) + 1;

      // Track the detailed history of every distinct open
      const openHistory = contextSummary.open_history || [];
      const currentTimestamp = new Date().toISOString();
      openHistory.push({
        touch,
        timestamp: currentTimestamp
      });

      // Determine if lead is "HOT" based on multiple email opens
      const isHot = newOpens >= 2;

      const updatedContext = {
        ...contextSummary,
        open_count: newOpens,
        email_opens: emailOpens,
        open_history: openHistory,
        is_hot: isHot,
      };

      // Save back to DB with the new advanced sequence tracking columns
      await supabaseAdmin
        .from('leads')
        .update({ 
          context_summary: updatedContext,
          last_engagement_at: new Date().toISOString(),
          total_emails_opened: newOpens
        })
        .eq('id', id);

      // Update the specific followup record with opened status and timestamp
      const touchPos = parseInt(touch, 10);
      if (!isNaN(touchPos)) {
        await supabaseAdmin
          .from('followups')
          .update({
            opened_at: new Date().toISOString()
          })
          .eq('lead_id', id)
          .eq('sequence_position', touchPos);
          
        // Adaptive State Machine Upgrade (Opened Branch)
        // If they open, they get upgraded to E(X+1) S1
        const currentEmailLevel = contextSummary.current_email_level || 1;
        const nextEmailLevel = currentEmailLevel + 1;
        const nextSubjectLevel = 1;
        
        // Find the queued follow-up (the default "No Open" branch) and upgrade it
        const { data: queuedFollowup } = await supabaseAdmin
          .from('followups')
          .select('id')
          .eq('lead_id', id)
          .eq('status', 'queued')
          .single();
          
        if (queuedFollowup) {
          // Accelerate the timing to tomorrow since they are engaged
          const acceleratedTime = new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString();
          
          await supabaseAdmin.from('followups').update({
            scheduled_for: acceleratedTime
          }).eq('id', queuedFollowup.id);

          // Update the scalable queue as well
          await supabaseAdmin.from('email_queue').update({
            scheduled_for: acceleratedTime
          }).eq('followup_id', queuedFollowup.id);
          
          // Update the context state
          await supabaseAdmin.from('leads').update({
            context_summary: {
              ...updatedContext,
              current_email_level: nextEmailLevel,
              current_subject_level: nextSubjectLevel,
            }
          }).eq('id', id);
        }
      }

      // Sync open tracking to Zoho CRM
      if (lead.crm_record_id && !lead.crm_record_id.startsWith('sheets:')) {
        try {
          const settings = await SettingsService.getSettings(lead.organization_id);
          
          if (settings.zoho_client_id && settings.zoho_client_secret && settings.zoho_refresh_token) {
            const zohoCredentials = {
              orgId: lead.organization_id,
              clientId: settings.zoho_client_id,
              clientSecret: settings.zoho_client_secret,
              refreshToken: settings.zoho_refresh_token,
              apiUrl: settings.zoho_api_url || 'https://www.zohoapis.in',
              accountsUrl: settings.zoho_accounts_url || 'https://accounts.zoho.in'
            };

            const currentProblem = updatedContext.problem || 'Not specified';
            const currentNeeds = updatedContext.needs || 'Not specified';
            const baseDescription = `Prospect captured from Trade Show recording. Problem: ${currentProblem}. Needs: ${currentNeeds}`;
            
            await ZohoService.updateLead(zohoCredentials, lead.crm_record_id, {
              Lead_Status: isHot ? 'Contacted' : 'Attempted to Contact',
              Description: `${baseDescription}\n\n[System Log] Email Touch "${touch}" opened. Total opens: ${newOpens}. Lead Hot Status: ${isHot ? 'HOT' : 'Warm'}.`
            });

            await ZohoService.addNote(
              zohoCredentials,
              lead.crm_record_id,
              `Email Opened (Touch: ${touch})`,
              `The recipient opened the follow-up email.\nTotal Open Count: ${newOpens}\nTime: ${new Date().toLocaleString()}`
            );
          }
        } catch (zohoErr) {
          console.error('Failed to sync open status/note to Zoho CRM:', zohoErr);
        }
      }
      
      // Sync to Zoho Campaigns
      const contactEmail = lead.contact_fields?.email;
      if (contactEmail) {
        const settings = await SettingsService.getSettings(lead.organization_id);
        
        await ZohoCampaignsService.pushEngagement(
          {
            orgId: lead.organization_id,
            clientId: settings.zoho_client_id || '',
            clientSecret: settings.zoho_client_secret || '',
            refreshToken: settings.zoho_refresh_token || '',
            accountsUrl: settings.zoho_accounts_url,
            campaignsApiUrl: settings.zoho_campaigns_api_url
          },
          lead.contact_fields.email,
          'AI CRM Automations', 
          'opened',
          `Opened Followup Email at ${new Date().toISOString()}`
        );
      }
    }

    // 2. Return a 1x1 transparent GIF image
    const gifBase64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const gifBuffer = Buffer.from(gifBase64, 'base64');

    return new NextResponse(gifBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Content-Length': gifBuffer.length.toString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Debug-FetchError': fetchError ? (fetchError.message || JSON.stringify(fetchError)) : 'none',
      },
    });
  } catch (error) {
    console.error('Error tracking email open:', error);
    const gifBase64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const gifBuffer = Buffer.from(gifBase64, 'base64');
    return new NextResponse(gifBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Content-Length': gifBuffer.length.toString(),
        'X-Debug-Error': error instanceof Error ? error.message : String(error),
      },
    });
  }
}
