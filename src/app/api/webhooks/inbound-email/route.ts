import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ReplyHandlingAgent } from '@/lib/agents/replyHandling';
import { SettingsService } from '@/lib/services/settings';

export async function POST(req: NextRequest) {
  try {
    // This endpoint is intentionally public (proxy.ts exempts /api/webhooks so
    // the email provider can reach it without a logged-in session), which means
    // anyone on the internet can otherwise POST a fabricated "reply" for any
    // lead's email address. Require a shared secret configured on both sides.
    const webhookSecret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
    if (webhookSecret) {
      const providedSecret = req.headers.get('x-webhook-secret');
      if (providedSecret !== webhookSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      console.warn('[inbound-email webhook] INBOUND_EMAIL_WEBHOOK_SECRET is not set — this endpoint currently accepts unauthenticated requests. Set it and have your email provider send it back as the x-webhook-secret header.');
    }

    const body = await req.json();

    // Webhook payload standard (SendGrid/Resend style mock)
    const { from_email, text, subject } = body;

    if (!from_email || !text) {
      return NextResponse.json({ error: 'Missing from_email or text' }, { status: 400 });
    }

    // 1. Find the lead by email
    // Match on the sender address in either the email column or contact_fields JSON.
    // (Previously this fetched only the first 100 leads, so replies from anyone else were
    // ignored and their drip kept running.)
    const senderEmail = String(from_email).trim().toLowerCase();
    if (!/^[^\s,()"]+@[^\s,()"]+$/.test(senderEmail)) {
      return NextResponse.json({ error: 'Invalid from_email' }, { status: 400 });
    }

    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('id, organization_id, contact_fields, context_summary, sequence_status, email')
      .or(`email.ilike.${senderEmail},contact_fields->>email.ilike.${senderEmail}`)
      .limit(5);

    if (leadError) throw leadError;

    const matchedLead = lead?.[0];

    if (!matchedLead) {
      return NextResponse.json({ message: 'Lead not found for this email, ignoring.' }, { status: 200 });
    }

    // 2. Pause the automated drip
    // Cancel any pending followups so they don't get spammed
    await supabaseAdmin
      .from('followups')
      .update({ status: 'cancelled' })
      .eq('lead_id', matchedLead.id)
      .in('status', ['queued', 'due']);

    await supabaseAdmin
      .from('leads')
      .update({ sequence_status: 'paused', has_replied: true })
      .eq('id', matchedLead.id);

    // 3. Analyze and Draft using Gemini
    const settings = await SettingsService.getSettings(matchedLead.organization_id);
    const apiKey = settings.gemini_api_key || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key is not configured in settings or environment variables.');
    }

    const aiAnalysis = await ReplyHandlingAgent.analyzeAndDraft(apiKey, text, {
      name: matchedLead.contact_fields?.name,
      company: matchedLead.contact_fields?.company,
      context_summary: matchedLead.context_summary
    });

    // 4. Create Notification
    const notificationTitle = `Reply Received (${aiAnalysis.sentiment}): ${matchedLead.contact_fields?.name || 'Prospect'}`;
    const notificationMessage = `They replied: "${text.substring(0, 60)}..." The AI drafted a rebuttal. Review it now.`;

    await supabaseAdmin
      .from('notifications')
      .insert({
        organization_id: matchedLead.organization_id,
        lead_id: matchedLead.id,
        type: 'reply_received',
        title: notificationTitle,
        message: notificationMessage,
        action_data: {
          original_reply: text,
          original_subject: subject,
          sentiment: aiAnalysis.sentiment,
          draft_subject: aiAnalysis.draft_subject,
          draft_body: aiAnalysis.draft_body
        }
      });

    return NextResponse.json({ message: 'Reply processed successfully, drip paused, notification created.' }, { status: 200 });

  } catch (error: any) {
    console.error('Inbound Email Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
