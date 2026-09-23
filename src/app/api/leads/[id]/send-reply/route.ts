import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { EmailService } from '@/lib/services/email';
import { SettingsService } from '@/lib/services/settings';
import { getCurrentUserOrgId } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { subject, message, notificationId } = body;

    if (!subject || !message) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });
    }

    const orgId = await getCurrentUserOrgId();
    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch Lead (scoped to this org)
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('contact_fields')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const toEmail = lead.contact_fields?.email;
    if (!toEmail) {
      return NextResponse.json({ error: 'Lead has no email address' }, { status: 400 });
    }

    // 2. Send the Email using this org's configured credentials
    const orgSettings = await SettingsService.getSettings(orgId);
    if (!orgSettings.email_user || !orgSettings.email_password) {
      return NextResponse.json({ error: 'Please configure your Email Integration in Settings to send emails.' }, { status: 400 });
    }

    await EmailService.sendEmail(
      {
        user: orgSettings.email_user,
        pass: orgSettings.email_password,
        fromName: orgSettings.email_from_name || '',
        fromTitle: orgSettings.email_sender_title || '',
      },
      toEmail,
      subject,
      message,
      id
    );

    // 3. Mark notification as read
    if (notificationId) {
      await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('organization_id', orgId);
    }

    // Optional: We can unpause the sequence here if we want them back on the drip,
    // but usually after a manual reply, you take over manually or put them in a different sequence.
    // Let's keep them paused for now.

    return NextResponse.json({ message: 'Reply sent successfully' });
  } catch (error: any) {
    console.error('Error sending reply:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
