import nodemailer from 'nodemailer';

export class EmailService {
  /**
   * Initializes and returns the Nodemailer Gmail transporter.
   * Returns null if credentials are not configured, triggering console fallback.
   */
  private static getTransporter(user?: string, pass?: string) {
    const finalUser = user || process.env.GMAIL_USER;
    const finalPass = pass || process.env.GMAIL_APP_PASSWORD;

    if (!finalUser || !finalPass) {
      console.warn('Email credentials missing. Email service is running in Console Log fallback mode.');
      return null;
    }

    if (finalPass.startsWith('re_')) {
      return nodemailer.createTransport({
        host: 'smtp.resend.com',
        port: 465,
        secure: true,
        auth: {
          user: 'resend',
          pass: finalPass,
        },
      });
    }

    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: finalUser,
        pass: finalPass,
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
    credentials: { user?: string; pass?: string; fromName?: string },
    to: string, 
    subject: string, 
    body: string, 
    leadId?: string, 
    touchPosition?: number,
    appUrl?: string,
    attachments?: { filename: string; content: string; encoding: string }[]
  ): Promise<string> {
    let finalUser = credentials.user || process.env.GMAIL_USER;
    let finalPass = credentials.pass || process.env.GMAIL_APP_PASSWORD;

    // Force Gmail override if the provided custom pass is a Resend API key and a Gmail app password exists in .env
    if (credentials.pass?.startsWith('re_') && process.env.GMAIL_APP_PASSWORD) {
      finalUser = process.env.GMAIL_USER;
      finalPass = process.env.GMAIL_APP_PASSWORD;
    }
    const transporter = this.getTransporter(finalUser, finalPass);
    let fromAddress = finalUser || 'test@gmail.com';
    const fromName = credentials.fromName || finalUser?.split('@')[0] || '';
    let finalTo = to;

    if (finalPass?.startsWith('re_')) {
      // Resend free tier restrictions
      fromAddress = 'onboarding@resend.dev';
      finalTo = 'avrsmain@gmail.com';
    }

    // Plain text version — always included. This is required for inbox delivery.
    // By sending ONLY plain text, we avoid all HTML-based spam filters.
    const textBody = `${body}\n\n${fromName}`;

    // HTML version — minimal, no styling, looks like a personal reply.
    const safeBody = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    // Build tracking pixel URL (only appended to HTML part)
    let pixelTag = '';
    if (leadId) {
      const finalAppUrl = appUrl || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : ''));
      if (finalAppUrl) {
        const trackingUrl = `${finalAppUrl}/api/leads/${leadId}/track-open${touchPosition ? `?touch=${touchPosition}` : ''}`;
        pixelTag = `<img src="${trackingUrl}" width="0" height="0" alt="" style="display:none;" />`;
      }
    }

    const htmlBody = `
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
      <a href="https://kuula.co/share/5dBs1/collection/7ckpl?logo=-1&info=0&fs=1&vr=1&sd=1&autorotate=1.5&autop=10&thumbs=1" style="display: inline-block; padding: 16px 36px; background-color: #d32e2d; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 4px; letter-spacing: 0.5px;">
        VPV DEMO
      </a>
    </div>

    <div class="border-divider" style="padding-top: 30px; border-top: 1px solid #eaeaea; margin-bottom: 25px;">
      <div style="border-left: 3px solid #d32e2d; padding-left: 15px;">
        <div class="text-primary" style="font-size: 15px; font-weight: bold; color: #1a202c; letter-spacing: 0.5px;">${fromName || 'Nitin Gupta'}</div>
        <div class="text-secondary" style="font-size: 11px; color: #718096; text-transform: uppercase; letter-spacing: 1px; margin-top: 3px; font-weight: 600;">Export Marketing Strategist</div>
      </div>
    </div>
    
  </div>
  ${pixelTag}
</body>
</html>
    `;

    if (!transporter) {
      // Mock sending by logging to output console
      console.log(`
==================================================
[MOCK EMAIL DISPATCH]
To: ${to}
From: "${fromName}" <${fromAddress}>
Subject: ${subject}
Tracking: ${leadId ? 'enabled' : 'disabled'}
--------------------------------------------------
Text:
${textBody}
==================================================
      `);
      return `mock-email-id-${Date.now()}`;
    }

    try {
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to: finalTo,
        subject: subject,
        // Send BOTH text and minimal HTML so tracking pixel works while mimicking personal email
        text: textBody,
        html: htmlBody,
        attachments: attachments || [],
      });

      return info.messageId || 'nodemailer-success-id';
    } catch (error: any) {
      throw new Error(`Nodemailer API error: ${error.message || error}`);
    }
  }
}
