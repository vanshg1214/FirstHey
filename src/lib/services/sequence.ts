import { supabaseAdmin } from '@/lib/supabase';
import { SettingsService } from '@/lib/services/settings';
import { EmailService } from '@/lib/services/email';
import { SequenceDraftAgent } from '@/lib/agents/sequenceDraft';
import { SEQUENCE_GAP_DAYS, SEQUENCE_MAX_TOUCHES, type SequenceStatus } from '@/lib/sequenceConfig';

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_LOCK_MS = 15 * 60 * 1000;

export interface ProcessResult {
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export class SequenceService {
  /** Builds the AI draft for the next touch of a lead. Throws if generation fails. */
  private static async draftFor(lead: any, nextPosition: number, emailFollowups: any[]) {
    const settings = await SettingsService.getSettings(lead.organization_id);
    const apiKey = settings.gemini_api_key;
    if (!apiKey) throw new Error('Gemini API key is not configured.');

    let exhibition: string | null = lead.exhibition || null;
    if (lead.exhibition_id) {
      const { data } = await supabaseAdmin.from('exhibitions').select('name').eq('id', lead.exhibition_id).single();
      if (data?.name) exhibition = data.name;
    }

    const contact = lead.contact_fields || {};
    const context = lead.context_summary || {};
    const history: any[] = lead.open_history || [];

    return SequenceDraftAgent.generateNext(apiKey, {
      contact: {
        name: contact.name || lead.name || null,
        company: contact.company || lead.company || null,
        title: contact.title || lead.title || null,
      },
      context: {
        problem: context.problem || null,
        needs: context.needs || null,
        action_items: context.action_items || [],
        notable_quotes: context.notable_quotes || [],
      },
      exhibition,
      companyProfile: settings.company_profile || null,
      previousEmails: emailFollowups
        .filter(f => f.status === 'sent')
        .slice(-5)
        .map(f => ({ position: f.sequence_position, subject: f.subject, body: f.body, sent_at: f.sent_at })),
      engagement: {
        opened: !!lead.is_opened,
        openCount: lead.open_count || 0,
        lastOpenedAt: history.length ? history[history.length - 1]?.opened_at || null : null,
      },
      touchNumber: nextPosition,
      totalTouches: SEQUENCE_MAX_TOUCHES,
      senderName: settings.email_from_name || 'Sales Representative',
    });
  }

  /**
   * Called right after an email is sent. Writes the next email with AI and queues it
   * SEQUENCE_GAP_DAYS from now. If AI fails, a placeholder row is queued and the cron
   * job writes it right before sending, so the sequence never silently stops.
   */
  public static async scheduleNext(leadId: string): Promise<{ scheduled: boolean; reason?: string }> {
    const { data: lead } = await supabaseAdmin.from('leads').select('*').eq('id', leadId).single();
    if (!lead) return { scheduled: false, reason: 'lead not found' };

    const status: SequenceStatus = lead.sequence_status || 'active';
    if (status !== 'active') return { scheduled: false, reason: `sequence is ${status}` };

    const { data: rows, error } = await supabaseAdmin
      .from('followups')
      .select('id, sequence_position, status, subject, body, sent_at')
      .eq('lead_id', leadId)
      .eq('channel', 'email')
      .order('sequence_position', { ascending: true });
    if (error) throw new Error(`Could not read follow-ups: ${error.message}`);

    const emailFollowups = rows || [];
    if (emailFollowups.some(f => ['queued', 'due', 'sending'].includes(f.status))) {
      return { scheduled: false, reason: 'next email already queued' };
    }

    const sentCount = emailFollowups.filter(f => f.status === 'sent').length;
    if (sentCount === 0) return { scheduled: false, reason: 'no email sent yet' };

    if (sentCount >= SEQUENCE_MAX_TOUCHES) {
      await supabaseAdmin.from('leads').update({ sequence_status: 'completed' }).eq('id', leadId);
      return { scheduled: false, reason: 'sequence completed' };
    }

    const nextPosition = Math.max(...emailFollowups.map(f => f.sequence_position)) + 1;

    let subject: string | null = null;
    let body: string | null = null;
    try {
      const draft = await this.draftFor(lead, nextPosition, emailFollowups);
      subject = draft.subject;
      body = draft.emailBody;
    } catch (e: any) {
      console.error(`[sequence] AI draft failed for lead ${leadId}, will retry at send time:`, e.message);
    }

    const { error: insertError } = await supabaseAdmin.from('followups').insert({
      lead_id: leadId,
      sequence_position: nextPosition,
      channel: 'email',
      status: 'queued',
      subject,
      body,
      scheduled_for: new Date(Date.now() + SEQUENCE_GAP_DAYS * DAY_MS).toISOString(),
    });

    if (insertError) {
      // Unique index on (lead_id, sequence_position): another process already queued it.
      if (insertError.code === '23505') return { scheduled: false, reason: 'next email already queued' };
      throw new Error(`Could not queue next email: ${insertError.message}`);
    }

    await supabaseAdmin
      .from('leads')
      .update({ current_sequence_step: nextPosition, sequence_status: 'active' })
      .eq('id', leadId);

    return { scheduled: true };
  }

  /** Stops the drip and cancels anything still waiting to send. */
  public static async stop(leadId: string, status: Exclude<SequenceStatus, 'active'>) {
    await supabaseAdmin.from('leads').update({ sequence_status: status }).eq('id', leadId);
    if (status !== 'paused') {
      await supabaseAdmin
        .from('followups')
        .update({ status: 'cancelled' })
        .eq('lead_id', leadId)
        .eq('channel', 'email')
        .in('status', ['queued', 'due']);
    }
  }

  public static async pause(leadId: string) {
    await this.stop(leadId, 'paused');
  }

  /** Resumes a paused or bounced sequence. Overdue emails go out tomorrow, not in a burst. */
  public static async resume(leadId: string): Promise<{ ok: boolean; reason?: string }> {
    const { data: lead } = await supabaseAdmin.from('leads').select('sequence_status').eq('id', leadId).single();
    if (!lead) return { ok: false, reason: 'lead not found' };
    if (lead.sequence_status === 'unsubscribed') {
      return { ok: false, reason: 'This contact unsubscribed and cannot be resumed.' };
    }

    await supabaseAdmin.from('leads').update({ sequence_status: 'active' }).eq('id', leadId);

    const now = new Date();
    const tomorrow = new Date(now.getTime() + DAY_MS).toISOString();
    await supabaseAdmin
      .from('followups')
      .update({ scheduled_for: tomorrow })
      .eq('lead_id', leadId)
      .eq('channel', 'email')
      .eq('status', 'queued')
      .lt('scheduled_for', now.toISOString());

    await this.scheduleNext(leadId).catch(e => console.error('[sequence] resume scheduleNext failed:', e.message));
    return { ok: true };
  }

  /** Sends every email that is due. Called by the cron route. */
  public static async processDue(opts: { limit?: number; deadlineMs?: number } = {}): Promise<ProcessResult> {
    const limit = opts.limit ?? 25;
    const deadline = Date.now() + (opts.deadlineMs ?? 50_000);
    const result: ProcessResult = { sent: 0, skipped: 0, failed: 0, errors: [] };

    // Recover rows left in 'sending' by a run that died mid-flight.
    await supabaseAdmin
      .from('followups')
      .update({ status: 'queued', locked_at: null })
      .eq('status', 'sending')
      .lt('locked_at', new Date(Date.now() - STALE_LOCK_MS).toISOString());

    const { data: due, error } = await supabaseAdmin
      .from('followups')
      .select('id, lead_id, sequence_position')
      .eq('status', 'queued')
      .eq('channel', 'email')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(limit);
    if (error) throw new Error(`Could not load due emails: ${error.message}`);

    for (const item of due || []) {
      if (Date.now() > deadline) break; // the rest are picked up on the next run

      // Claim the row so two overlapping runs can never send the same email.
      const { data: claimed } = await supabaseAdmin
        .from('followups')
        .update({ status: 'sending', locked_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('status', 'queued')
        .select('*')
        .maybeSingle();
      if (!claimed) {
        result.skipped++;
        continue;
      }

      const release = (patch: Record<string, any> = {}) =>
        supabaseAdmin.from('followups').update({ status: 'queued', locked_at: null, ...patch }).eq('id', claimed.id);

      try {
        const { data: lead } = await supabaseAdmin.from('leads').select('*').eq('id', claimed.lead_id).single();
        const toEmail = lead?.email || lead?.contact_fields?.email;

        if (!lead || !toEmail) {
          await supabaseAdmin.from('followups').update({ status: 'cancelled', locked_at: null }).eq('id', claimed.id);
          result.skipped++;
          continue;
        }

        const status: SequenceStatus = lead.sequence_status || 'active';
        if (status === 'paused') {
          await release(); // stays queued until resumed
          result.skipped++;
          continue;
        }
        if (status !== 'active') {
          await supabaseAdmin.from('followups').update({ status: 'cancelled', locked_at: null }).eq('id', claimed.id);
          result.skipped++;
          continue;
        }

        const settings = await SettingsService.getSettings(lead.organization_id);
        if (!settings.email_user || !settings.email_password) {
          await release();
          result.errors.push(`lead ${lead.id}: email not configured`);
          result.skipped++;
          continue;
        }

        let subject: string | null = claimed.subject;
        let body: string | null = claimed.body;
        if (!subject || !body) {
          const { data: rows } = await supabaseAdmin
            .from('followups')
            .select('sequence_position, status, subject, body, sent_at')
            .eq('lead_id', lead.id)
            .eq('channel', 'email')
            .order('sequence_position', { ascending: true });
          try {
            const draft = await this.draftFor(lead, claimed.sequence_position, rows || []);
            subject = draft.subject;
            body = draft.emailBody;
            await supabaseAdmin.from('followups').update({ subject, body }).eq('id', claimed.id);
          } catch (e: any) {
            await release();
            result.errors.push(`lead ${lead.id}: draft failed (${e.message})`);
            result.failed++;
            continue;
          }
        }

        try {
          await EmailService.sendEmail(
            {
              user: settings.email_user,
              pass: settings.email_password,
              fromName: settings.email_from_name || '',
              fromTitle: settings.email_sender_title || '',
            },
            toEmail,
            subject!,
            body!,
            lead.id,
            claimed.sequence_position
          );
        } catch (e: any) {
          // A send failure counts as a bounce: stop mailing this address until a human looks.
          await supabaseAdmin
            .from('followups')
            .update({ status: 'send_failed', locked_at: null })
            .eq('id', claimed.id);
          await this.stop(lead.id, 'bounced');
          result.errors.push(`lead ${lead.id}: send failed (${e.message})`);
          result.failed++;
          continue;
        }

        await supabaseAdmin
          .from('followups')
          .update({ status: 'sent', sent_at: new Date().toISOString(), locked_at: null })
          .eq('id', claimed.id);
        result.sent++;

        // Email N just went out, so write email N+1 now.
        await this.scheduleNext(lead.id).catch(e =>
          result.errors.push(`lead ${lead.id}: could not schedule next (${e.message})`)
        );
      } catch (e: any) {
        await release();
        result.errors.push(`followup ${item.id}: ${e.message}`);
        result.failed++;
      }
    }

    return result;
  }
}
