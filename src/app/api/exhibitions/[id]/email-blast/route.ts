import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { EmailService } from '@/lib/services/email';
import { SettingsService } from '@/lib/services/settings';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { subject, body, leadIds } = await req.json();
    
    if (!subject || !body || !leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'Subject, body, and an array of selected leadIds are required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single();
    if (!userData?.organization_id) throw new Error('Organization not found');

    // Get specific leads selected by the user
    const { data: allLeads, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .in('id', leadIds)
      .eq('exhibition_id', id)
      .eq('organization_id', userData.organization_id);

    if (error) throw new Error(error.message);

    if (!allLeads || allLeads.length === 0) {
      return NextResponse.json({ message: 'No eligible leads found for the selected IDs.' });
    }

    // Initialize Email Service credentials
    const settings = await SettingsService.getSettings(userData.organization_id);
    const emailCreds = {
      user: settings.email_user || undefined,
      pass: settings.email_password || undefined,
      fromName: settings.email_from_name || '',
    };
    
    let sentCount = 0;
    const failedLeads: string[] = [];
    const BATCH_SIZE = 10;

    // Send emails in parallel batches to avoid serverless timeouts
    for (let i = 0; i < allLeads.length; i += BATCH_SIZE) {
      const batch = allLeads.slice(i, i + BATCH_SIZE);
      
      await Promise.allSettled(batch.map(async (lead) => {
        const contactFields = lead.contact_fields || {};
        const targetEmail = lead.email || contactFields.email;
        const targetName = lead.name || contactFields.name || 'there';
        
        if (!targetEmail) return;

        // Personalize simple merge tags
        const personalizedBody = body
          .replace(/\[Name\]/g, targetName)
          .replace(/\[Company\]/g, lead.company || contactFields.company || 'your company');
          
        const personalizedSubject = subject
          .replace(/\[Name\]/g, targetName)
          .replace(/\[Company\]/g, lead.company || contactFields.company || 'your company');

        try {
          await EmailService.sendEmail(
            emailCreds,
            targetEmail,
            personalizedSubject,
            personalizedBody,
            lead.id,
            undefined,
            process.env.NEXT_PUBLIC_APP_URL
          );

          // Mark as contacted
          await supabaseAdmin.from('leads').update({ status: 'contacted' }).eq('id', lead.id);
          sentCount++;
        } catch (err: any) {
          console.error(`Failed to send email to ${targetEmail}:`, err);
          failedLeads.push(lead.id);
        }
      }));
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
