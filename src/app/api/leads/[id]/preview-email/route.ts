import { NextRequest, NextResponse } from 'next/server';
import { EmailService } from '@/lib/services/email';
import { SettingsService } from '@/lib/services/settings';
import { getCurrentUserOrgId } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { emailBody } = body;

    const orgSettings = await SettingsService.getSettings(orgId);
    
    const fromName = orgSettings.email_from_name || 'Nitin Gupta';
    const fromTitle = orgSettings.email_sender_title || 'Export Marketing Strategist';

    const html = EmailService.generateHtml(emailBody || '', fromName, fromTitle);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error: any) {
    console.error('Error previewing email:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
