import { NextRequest, NextResponse } from 'next/server';
import { LeadsRepository } from '@/lib/repositories/leads';
import { supabaseAdmin } from '@/lib/supabase';
import { EmailService } from '@/lib/services/email';
import { SettingsService } from '@/lib/services/settings';
import { getCurrentUserOrgId } from '@/lib/auth';
import { SequenceService } from '@/lib/services/sequence';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { subject, body: emailBody } = body;

    if (!subject || !emailBody) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: 'Missing parameters' } },
        { status: 400 }
      );
    }

    const orgId = await getCurrentUserOrgId();
    if (!orgId) {
      return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }

    const supabase = supabaseAdmin;
    const lead = await LeadsRepository.getLeadById(supabase, id);
    if (!lead || lead.organization_id !== orgId) {
      return NextResponse.json({ data: null, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
    }

    const toEmail = lead.email || (lead.contact_fields ? lead.contact_fields.email : null);
    
    if (toEmail) {
      // Fetch organization settings to get custom SMTP and Sender Name
      let orgSettings: any = {};
      try {
        orgSettings = await SettingsService.getSettings(lead.organization_id);
      } catch (e) {
        console.warn("Could not fetch org settings for email dispatch", e);
      }

      if (!orgSettings.email_user || !orgSettings.email_password) {
        return NextResponse.json(
          { data: null, error: { code: 'EMAIL_NOT_CONFIGURED', message: 'Please configure your Email Integration in Settings to send emails.' } },
          { status: 400 }
        );
      }

      // Next touch number = highest email position so far + 1 (WhatsApp rows don't count)
      const { data: lastEmail } = await supabase
        .from('followups')
        .select('sequence_position')
        .eq('lead_id', id)
        .eq('channel', 'email')
        .order('sequence_position', { ascending: false })
        .limit(1)
        .maybeSingle();
      const touchPosition = (lastEmail?.sequence_position || 0) + 1;

      // Send directly via Nodemailer
      const emailSent = await EmailService.sendEmail(
        { 
          user: orgSettings.email_user,
          pass: orgSettings.email_password,
          fromName: orgSettings.email_from_name || '',
          fromTitle: orgSettings.email_sender_title || ''
        },
        toEmail,
        subject,
        emailBody,
        id, // Used for tracking pixel and the unsubscribe link
        touchPosition
      );
      
      if (emailSent) {
        // Update the lead status
        await supabase
          .from('leads')
          .update({ status: 'contacted' })
          .eq('id', id);

        // Insert into followups table to log it
        const { error: logError } = await supabase.from('followups').insert({
          lead_id: id,
          sequence_position: touchPosition,
          channel: 'email',
          status: 'sent',
          subject: subject,
          body: emailBody,
          scheduled_for: new Date().toISOString(),
          sent_at: new Date().toISOString(),
        });
        if (logError) {
          console.error('Email was sent but logging to followups failed:', logError.message);
        } else {
          // Email N is out, so the AI writes email N+1 now and queues it for the next cycle.
          // A failure here must not turn a successful send into an error for the user.
          try {
            const next = await SequenceService.scheduleNext(id);
            if (!next.scheduled) console.log(`[sequence] next email not scheduled for ${id}: ${next.reason}`);
          } catch (e: any) {
            console.error('[sequence] scheduleNext failed after send:', e.message);
          }
        }
      } else {
        await supabase
          .from('leads')
          .update({ status: 'failed_to_contact' })
          .eq('id', id);
      }
    } else {
      return NextResponse.json(
        { data: null, error: { code: 'NO_EMAIL', message: 'Lead has no email address' } },
        { status: 400 }
      );
    }

    // Return INSTANTLY to the UI
    return NextResponse.json({
      data: {
        leadId: id,
        status: 'contacted',
      },
      error: null,
    });

  } catch (error: any) {
    console.error('Error in approve-followup API route:', error);
    return NextResponse.json({ data: null, error: { code: 'APPROVE_FOLLOWUP_FAILED', message: error.message } }, { status: 500 });
  }
}
