import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { EmailService } from '@/lib/services/email';
import { SequencePersonalizationAgent } from '@/lib/agents/sequencePersonalization';
import { FollowupDraftAgent } from '@/lib/agents/followupDraft';
import { ZohoService } from '@/lib/services/zoho';
import { QueueService } from '@/lib/services/queue';
import { SettingsService } from '@/lib/services/settings';
import { ZohoCampaignsService } from '@/lib/services/zohoCampaigns';

export async function GET(req: NextRequest) {
  // Enforce CRON security check (check header or secret key to prevent unauthorized GET trigger)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Cron authentication failed.' } },
      { status: 401 }
    );
  }

  try {
    const now = new Date().toISOString();

    // 1. Fetch locked jobs from the robust email queue
    const pendingJobs = await QueueService.pollPendingJobs(10);

    if (!pendingJobs || pendingJobs.length === 0) {
      return NextResponse.json({
        data: { processed: 0, successes: 0, failures: 0 },
        error: null,
      });
    }

    let successes = 0;
    let failures = 0;

    for (const job of pendingJobs) {
      try {
        // Fetch the associated lead and followup from the queued job
        const { data: lead } = await supabaseAdmin.from('leads').select('*').eq('id', job.lead_id).single();
        if (!lead) throw new Error('Lead not found');

        let followup: any = null;
        if (job.followup_id) {
          const { data: fData } = await supabaseAdmin.from('followups').select('*').eq('id', job.followup_id).single();
          followup = fData;
        }

        // 2. Fetch lead details
        const contactFields = lead.contact_fields || {};
        const email = contactFields.email;
        const isHot = lead.context_summary?.is_hot === true;

        if (!email) {
          if (followup) await supabaseAdmin.from('followups').update({ status: 'skipped' }).eq('id', followup.id);
          await QueueService.completeJob(job.id);
          successes++;
          continue;
        }

        if (isHot) {
          if (followup) await supabaseAdmin.from('followups').update({ status: 'paused_adaptive' }).eq('id', followup.id);
          await QueueService.completeJob(job.id);
          successes++;
          continue;
        }

        let subject = '';
        let body = '';

        const currentContext = lead.context_summary || {};
        const emailLevel = currentContext.current_email_level || 1;
        const subjectLevel = currentContext.current_subject_level || 1;

        const sequencePosition = followup ? followup.sequence_position : lead.current_sequence_step + 1;

        // Fetch settings for the lead's organization
        const settings = await SettingsService.getSettings(lead.organization_id);
        const apiKey = settings.gemini_api_key || process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error('Gemini API key is not configured in settings or environment variables.');
        }

        if (sequencePosition === 1 && emailLevel === 1 && subjectLevel === 1) {
          if (followup && followup.subject && followup.body) {
            subject = followup.subject;
            body = followup.body;
          } else {
            const draft = await FollowupDraftAgent.generateDraft(
              apiKey,
              { name: contactFields.name, company: contactFields.company, title: contactFields.title },
              { problem: currentContext.problem || null, needs: currentContext.needs || null, action_items: currentContext.action_items || [], notable_quotes: currentContext.notable_quotes || [] },
              'Sales Team'
            );
            subject = draft.subject;
            body = draft.body;
          }
        } else {
          const leadDetails = { name: contactFields.name, company: contactFields.company, title: contactFields.title, context_summary: currentContext };
          const personalizedTouch = await SequencePersonalizationAgent.personalizeTouch(apiKey, leadDetails, emailLevel, subjectLevel, 'Sales Team');
          subject = personalizedTouch.subject;
          body = personalizedTouch.body;
        }

        const host = req.headers.get('host') || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const dynamicAppUrl = `${protocol}://${host}`;

        // 4. Send Email
        const recipientEmail = contactFields.email || 'avrsmain@gmail.com';
        const name = contactFields.name || 'Valued Customer';
        const zohoCampaignKey = settings.zoho_campaign_key || process.env.ZOHO_CAMPAIGN_KEY;

        let messageId = `zoho-campaign-${Date.now()}`;

        if (zohoCampaignKey && settings.zoho_client_id) {
          console.log(`Dispatching followup ${sequencePosition} via Zoho Campaigns...`);
          await ZohoCampaignsService.triggerEmail(
            {
              orgId: lead.organization_id,
              clientId: settings.zoho_client_id,
              clientSecret: settings.zoho_client_secret || '',
              refreshToken: settings.zoho_refresh_token || '',
              accountsUrl: settings.zoho_accounts_url,
              campaignsApiUrl: settings.zoho_campaigns_api_url
            },
            zohoCampaignKey, 
            recipientEmail, 
            name, 
            body
          );
        } else {
          const emailCredentials = {
            user: settings.email_user || process.env.EMAIL_USER || process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev',
            pass: settings.email_password || process.env.EMAIL_PASSWORD || process.env.RESEND_API_KEY || '',
            fromName: settings.email_from_name || process.env.EMAIL_FROM_NAME || 'Sales Team'
          };

          messageId = await EmailService.sendEmail(
            emailCredentials,
            recipientEmail,
            subject,
            body,
            lead.id,
            sequencePosition,
            dynamicAppUrl
          );
        }

        // 5. Update followup to 'sent' and log actual content sent
        if (followup) {
          await supabaseAdmin.from('followups').update({ status: 'sent', sent_at: new Date().toISOString(), subject, body }).eq('id', followup.id);
        } else {
          // Create the followup record to log the abstract queue job
          const { data: newF } = await supabaseAdmin.from('followups').insert([{ lead_id: lead.id, sequence_position: sequencePosition, channel: 'email', status: 'sent', sent_at: new Date().toISOString(), subject, body }]).select().single();
          if (newF) followup = newF;
        }

        // 6. Update Zoho CRM Lead Status & Add Note (if synced to Zoho)
        if (lead.crm_record_id && !lead.crm_record_id.startsWith('sheets:')) {
          try {
            const currentProblem = lead.context_summary?.problem || 'Not specified';
            const currentNeeds = lead.context_summary?.needs || 'Not specified';
            const baseDescription = `Prospect captured from Trade Show recording. Problem: ${currentProblem}. Needs: ${currentNeeds}`;
            
            if (settings.zoho_client_id && settings.zoho_client_secret && settings.zoho_refresh_token) {
              const zohoCredentials = {
                orgId: lead.organization_id,
                clientId: settings.zoho_client_id,
                clientSecret: settings.zoho_client_secret,
                refreshToken: settings.zoho_refresh_token,
                apiUrl: settings.zoho_api_url || 'https://www.zohoapis.in',
                accountsUrl: settings.zoho_accounts_url || 'https://accounts.zoho.in'
              };
              await ZohoService.updateLead(zohoCredentials, lead.crm_record_id, {
                Lead_Status: 'Attempted to Contact',
                Description: `${baseDescription}\n\n[System Log] Touch ${sequencePosition} (E${emailLevel} S${subjectLevel}) follow-up email sent on ${new Date().toLocaleString()}.`
              });

              await ZohoService.addNote(
                zohoCredentials,
                lead.crm_record_id,
                `Follow-up Touch ${sequencePosition} (E${emailLevel} S${subjectLevel}) Sent`,
                `Subject: ${subject}\n\nSent at: ${new Date().toLocaleString()}\n\nBody:\n${body}`
              );
            }
          } catch (zohoErr) {
            console.error('Failed to sync email dispatch note/status to Zoho CRM:', zohoErr);
          }
        }

        // 7. Schedule the NEXT default touch (No Open branch)
        // If they don't open, we send E(X) S(Y+1)
        const nextEmailLevel = emailLevel;
        const nextSubjectLevel = subjectLevel + 1;
        
        // Wait 3 days before sending the variation
        const nextScheduledTime = new Date(Date.now() + (3 * 24 * 60 * 60 * 1000)).toISOString();

        // Update context_summary with the default next state
        const updatedContext = { ...currentContext, current_email_level: nextEmailLevel, current_subject_level: nextSubjectLevel };
        await supabaseAdmin.from('leads').update({ 
          context_summary: updatedContext,
          current_sequence_step: sequencePosition,
          total_emails_sent: (lead.total_emails_sent || 0) + 1
        }).eq('id', lead.id);

        // Queue the next touch
        const { data: nextFollowup } = await supabaseAdmin.from('followups').insert([{
          lead_id: lead.id,
          sequence_position: sequencePosition + 1,
          channel: 'email',
          status: 'queued',
          scheduled_for: nextScheduledTime,
        }]).select().single();

        if (nextFollowup) {
          await QueueService.enqueue({
            organizationId: lead.organization_id,
            leadId: lead.id,
            followupId: nextFollowup.id,
            scheduledFor: new Date(nextScheduledTime),
          });
        }

        await QueueService.completeJob(job.id);
        successes++;
      } catch (fError: any) {
        console.error(`Error processing job ID ${job.id}:`, fError);
        failures++;
        if (job.followup_id) {
          await supabaseAdmin.from('followups').update({ status: 'send_failed' }).eq('id', job.followup_id);
        }
        await QueueService.failJob(job.id, job.retry_count || 0, 3, fError.message);
      }
    }

    return NextResponse.json({
      data: {
        processed: pendingJobs.length,
        successes,
        failures,
      },
      error: null,
    });
  } catch (error: any) {
    console.error('Error running cron processor:', error);
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'CRON_EXECUTION_FAILED',
          message: error.message || 'An error occurred during queue processing.',
        },
      },
      { status: 500 }
    );
  }
}

// Support Upstash QStash POST webhooks seamlessly
export const POST = GET;
