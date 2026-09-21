import { NextRequest, NextResponse } from 'next/server';
import { LeadsRepository } from '@/lib/repositories/leads';
import { supabaseAdmin } from '@/lib/supabase';
import { EmailService } from '@/lib/services/email';
import { SettingsService } from '@/lib/services/settings';

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

    const supabase = supabaseAdmin;
    const lead = await LeadsRepository.getLeadById(supabase, id);
    if (!lead) {
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
        id // Used for tracking pixel
      );
      
      if (emailSent) {
        // Update the lead status
        await supabase
          .from('leads')
          .update({ status: 'contacted' })
          .eq('id', id);
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
