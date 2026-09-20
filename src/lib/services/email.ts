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
      const finalAppUrl = appUrl || process.env.NEXT_PUBLIC_APP_URL || '';
      if (finalAppUrl) {
        const trackingUrl = `${finalAppUrl}/api/leads/${leadId}/track-open${touchPosition ? `?touch=${touchPosition}` : ''}`;
        pixelTag = `<img src="${trackingUrl}" width="0" height="0" alt="" style="display:none;" />`;
      }
    }

    const htmlBody = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;">${safeBody}<br><br>${fromName}</div>${pixelTag}`;

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
