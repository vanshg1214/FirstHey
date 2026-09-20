import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { EmailService } from '@/lib/services/email';
import { SettingsService } from '@/lib/services/settings';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { subject, body } = await req.json();
    
    if (!subject || !body) {
      return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single();
    if (!userData?.organization_id) throw new Error('Organization not found');

    // Get leads for this exhibition that have emails and haven't been contacted yet
    const { data: leads, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('exhibition_id', id)
      .eq('organization_id', userData.organization_id)
      .neq('status', 'contacted')
      .not('email', 'is', null);

    if (error) throw new Error(error.message);
    
    // Also check contact_fields for email if email column is null (legacy data)
    const { data: legacyLeads } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('exhibition_id', id)
      .eq('organization_id', userData.organization_id)
      .neq('status', 'contacted')
      .is('email', null)
      .not('contact_fields->email', 'is', null);

    const allLeads = [...(leads || []), ...(legacyLeads || [])];

    if (allLeads.length === 0) {
      return NextResponse.json({ message: 'No eligible uncontacted leads found with an email address.' });
    }

    // Initialize Email Service
    const settings = await SettingsService.getSettings(userData.organization_id);
    const emailCreds = settings.email_user && settings.email_password 
      ? { user: settings.email_user, pass: settings.email_password }
      : undefined;
      
    const emailService = new EmailService(emailCreds, settings.email_from_name || '');
    
    let sentCount = 0;
    const failedLeads = [];

    // Send emails in a loop (for large blasts this should be queued, but fine for MVP)
    for (const lead of allLeads) {
      const contactFields = lead.contact_fields || {};
      const targetEmail = lead.email || contactFields.email;
      const targetName = lead.name || contactFields.name || 'there';
      
      if (!targetEmail) continue;

      // Personalize simple merge tags
      const personalizedBody = body
        .replace(/\[Name\]/g, targetName)
        .replace(/\[Company\]/g, lead.company || contactFields.company || 'your company');
        
      const personalizedSubject = subject
        .replace(/\[Name\]/g, targetName)
        .replace(/\[Company\]/g, lead.company || contactFields.company || 'your company');

      try {
        await emailService.sendEmail({
          to: targetEmail,
          subject: personalizedSubject,
          body: personalizedBody,
          leadId: lead.id,
        });

        // Mark as contacted
        await supabaseAdmin.from('leads').update({ status: 'contacted' }).eq('id', lead.id);
        sentCount++;
      } catch (err: any) {
        console.error(`Failed to send email to ${targetEmail}:`, err);
        failedLeads.push(lead.id);
      }
    }

    return NextResponse.json({ 
      success: true, 
      sentCount, 
      failedCount: failedLeads.length 
    });
  } catch (error: any) {
    console.error('Email blast error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
