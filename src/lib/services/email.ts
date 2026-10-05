import nodemailer from 'nodemailer';
import { DEFAULT_LINK_KEY, TRACKED_LINKS } from '@/lib/emailTracking';

export class EmailService {
  /**
   * Initializes and returns the Nodemailer Gmail transporter.
   * Returns null if credentials are not configured, triggering console fallback.
   */
  private static getTransporter(user?: string, pass?: string) {
    if (!user || !pass) {
      return null;
    }

    if (pass.startsWith('re_')) {
      return nodemailer.createTransport({
        host: 'smtp.resend.com',
        port: 465,
        secure: true,
        auth: {
          user: 'resend',
          pass: pass,
        },
      });
    }

    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: user,
        pass: pass,
      },
    });
  }

  /**
   * Sends an email using Nodemailer via Gmail SMTP, or mocks the output to the console if unconfigured.
   * Sends as multipart (text + html) so Gmail treats it like a real personal email.
   * The tracking pixel is embedded only in the HTML part.
   * Gmail will proxy the pixel image through its own servers, masking the external domain.
   */
  public static async sendEmail(
    credentials: { user?: string; pass?: string; fromName?: string; fromTitle?: string },
    to: string, 
    subject: string, 
    body: string, 
    leadId?: string, 
    touchPosition?: number,
    appUrl?: string,
    attachments?: { filename: string; content: string; encoding: string }[]
  ): Promise<string> {
    const finalUser = credentials.user;
    const finalPass = credentials.pass;

    if (!finalUser || !finalPass) {
      throw new Error('Email credentials missing. Please configure your email in Settings.');
    }

    const transporter = this.getTransporter(finalUser, finalPass);
    let fromAddress = finalUser;
    const fromName = credentials.fromName || finalUser.split('@')[0] || '';
    const finalTo = to;

    if (finalPass.startsWith('re_')) {
      // Resend authenticates with the API key, so the sender must be an address on a
      // domain verified in Resend. Fall back to EMAIL_FROM_ADDRESS if the saved user isn't an email.
      fromAddress = finalUser.includes('@') ? finalUser : process.env.EMAIL_FROM_ADDRESS || '';
      if (!fromAddress) {
        throw new Error('Resend needs a verified sender address. Set it as the email user in Settings or EMAIL_FROM_ADDRESS.');
      }
    }

    // Plain text version — always included. This is required for inbox delivery.
    // By sending ONLY plain text, we avoid all HTML-based spam filters.
    const finalAppUrl = appUrl || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : ''));
    const unsubscribeUrl = leadId && finalAppUrl ? `${finalAppUrl}/api/unsubscribe/${leadId}` : '';

    const textBody = `${body}\n\n${fromName}${unsubscribeUrl ? `\n\nTo stop receiving these emails: ${unsubscribeUrl}` : ''}`;

    // Build tracking pixel URL (only appended to HTML part)
    let pixelTag = '';
    if (leadId && finalAppUrl) {
      const trackingUrl = `${finalAppUrl}/api/leads/${leadId}/track-open${touchPosition ? `?touch=${touchPosition}` : ''}`;
      pixelTag = `<img src="${trackingUrl}" width="0" height="0" alt="" style="display:none;" />`;
    }

    const demoUrl = leadId && finalAppUrl
      ? `${finalAppUrl}/api/leads/${leadId}/track-click?l=${DEFAULT_LINK_KEY}${touchPosition ? `&touch=${touchPosition}` : ''}`
      : TRACKED_LINKS[DEFAULT_LINK_KEY];

    const htmlBody = this.generateHtml(body, fromName, credentials.fromTitle || 'Export Marketing Strategist', pixelTag, unsubscribeUrl, demoUrl);

    if (!transporter) {
      throw new Error('Failed to initialize email transporter.');
    }

    try {
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to: finalTo,
        subject: subject,
        // Send BOTH text and minimal HTML so tracking pixel works while mimicking personal email
        text: textBody,
        html: htmlBody,
        headers: unsubscribeUrl
          ? {
              'List-Unsubscribe': `<${unsubscribeUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            }
          : undefined,
        attachments: attachments || [],
      });

      return info.messageId || 'nodemailer-success-id';
    } catch (error: any) {
      throw new Error(`Nodemailer API error: ${error.message || error}`);
    }
  }

  public static generateHtml(body: string, fromName: string, fromTitle: string, pixelTag: string = '', unsubscribeUrl: string = '', demoUrl: string = TRACKED_LINKS[DEFAULT_LINK_KEY]): string {
    const safeBody = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Follow Up</title>
  <style>
    :root { color-scheme: light dark; }
    @media (prefers-color-scheme: dark) {
      body, .email-bg, .email-container { background-color: #121212 !important; color: #e2e8f0 !important; }
      .text-primary { color: #f8fafc !important; }
      .text-secondary { color: #a0aec0 !important; }
      .border-divider { border-color: #2d3748 !important; }
    }
  </style>
</head>
<body class="body email-bg" style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #ffffff; color: #2d3748;">
  <div class="email-container" style="max-width: 600px; margin: 30px auto; padding: 0 15px; background-color: #ffffff;">
    
    <div style="margin-bottom: 35px;">
      <div class="text-primary" style="font-size: 22px; font-weight: 900; color: #1a202c; letter-spacing: -0.5px; text-transform: uppercase;">The Next <span style="color: #d32e2d;">D</span>esign</div>
      <div style="height: 2px; width: 40px; background-color: #d32e2d; margin-top: 10px;"></div>
    </div>

    <div class="text-primary" style="font-size: 16px; color: #2d3748; line-height: 1.6; white-space: pre-wrap; margin-bottom: 25px;">${safeBody}</div>

    <div style="margin-bottom: 30px;">
      <a href="${demoUrl}" style="display: inline-block; padding: 16px 36px; background-color: #d32e2d; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 4px; letter-spacing: 0.5px;">
        VPV DEMO
      </a>
    </div>

    <div class="border-divider" style="padding-top: 30px; border-top: 1px solid #eaeaea; margin-bottom: 25px;">
      <div style="border-left: 3px solid #d32e2d; padding-left: 15px;">
        <div class="text-primary" style="font-size: 15px; font-weight: bold; color: #1a202c; letter-spacing: 0.5px;">${fromName || 'Nitin Gupta'}</div>
        <div class="text-secondary" style="font-size: 11px; color: #718096; text-transform: uppercase; letter-spacing: 1px; margin-top: 3px; font-weight: 600;">${fromTitle || 'Export Marketing Strategist'}</div>
      </div>
    </div>

    ${unsubscribeUrl ? `<div class="text-secondary" style="font-size: 11px; color: #a0aec0; margin-top: 10px;">Not interested? <a href="${unsubscribeUrl}" style="color: #a0aec0; text-decoration: underline;">Unsubscribe</a></div>` : ''}

  </div>
  ${pixelTag}
</body>
</html>
    `;
  }
}
