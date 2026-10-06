import { supabaseAdmin } from '@/lib/supabase';

/**
 * Interest score: a deliberately simple points system.
 *  - 1 point for every email the person opened (counted once per email)
 *  - 5 points for every email they clicked the demo link in (counted once per email)
 *  - 10 points for replying
 * Clicks weigh most because mail apps (Gmail, Apple Mail) pre-load images, which inflates opens.
 */
export const SCORE_POINTS = { open: 1, click: 5, reply: 10 } as const;

export type InterestLevel = 'Hot' | 'Warm' | 'Interested' | 'No activity';

export function interestLevel(score: number): InterestLevel {
  if (score >= 10) return 'Hot';
  if (score >= 5) return 'Warm';
  if (score >= 1) return 'Interested';
  return 'No activity';
}

export interface LeadEngagement {
  id: string;
  name: string;
  company: string;
  title: string;
  email: string;
  phone: string;
  exhibition: string;
  stall: string;
  status: string;
  sequenceStatus: string;
  capturedAt: string | null;
  emailsSent: number;
  firstSentAt: string | null;
  lastSentAt: string | null;
  opens: number;
  uniqueOpens: number;
  clicks: number;
  uniqueClicks: number;
  replied: boolean;
  score: number;
  level: InterestLevel;
  firstOpenAt: string | null;
  lastActivityAt: string | null;
  /** Per email number: did they open / click it. Used for the per-email breakdown. */
  touches: Record<number, { sentAt: string | null; opened: boolean; clicked: boolean }>;
  aiScore: number | null;
  notes: string;
}

export interface TouchStats {
  touch: number;
  sent: number;
  opened: number;
  clicked: number;
  openRate: number;
  clickRate: number;
}

export interface ExhibitionStats {
  name: string;
  leads: number;
  emailed: number;
  opened: number;
  clicked: number;
  replied: number;
  hot: number;
  emailsSent: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  avgScore: number;
}

export interface EngagementSummary {
  totalLeads: number;
  emailed: number;
  emailsSent: number;
  openedLeads: number;
  clickedLeads: number;
  repliedLeads: number;
  unsubscribed: number;
  bounced: number;
  hot: number;
  warm: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
}

export interface EngagementReport {
  leads: LeadEngagement[];
  summary: EngagementSummary;
  byTouch: TouchStats[];
  byExhibition: ExhibitionStats[];
  daily: { date: string; opens: number; clicks: number }[];
  exhibitions: string[];
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

/** Supabase returns at most 1000 rows per request, so read big tables page by page. */
async function fetchAll<T = any>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export class EngagementService {
  /**
   * Builds the full engagement picture for an organization, optionally for one exhibition.
   * Everything is scoped by organization_id; callers must pass the signed-in user's org.
   */
  public static async buildReport(orgId: string, opts: { exhibition?: string | null; leadId?: string } = {}): Promise<EngagementReport> {
    const { data: exhibitionRows } = await supabaseAdmin
      .from('exhibitions')
      .select('id, name')
      .eq('organization_id', orgId);
    const exhibitionNames = new Map<string, string>((exhibitionRows || []).map((e: any) => [e.id, e.name]));

    const allLeads = await fetchAll((from, to) => {
      let q = supabaseAdmin
        .from('leads')
        .select(
          'id, name, company, title, email, phone, exhibition, exhibition_id, stall, status, sequence_status, created_at, has_replied, score, notes, contact_fields, open_count, open_history'
        )
        .eq('organization_id', orgId);
      if (opts.leadId) q = q.eq('id', opts.leadId);
      return q.order('created_at', { ascending: true }).range(from, to);
    });

    const effectiveExhibition = (l: any): string =>
      (l.exhibition_id && exhibitionNames.get(l.exhibition_id)) || l.exhibition || '';

    const exhibitions = Array.from(new Set(allLeads.map(effectiveExhibition).filter(Boolean))).sort();

    const filter = opts.exhibition && opts.exhibition !== 'all' ? opts.exhibition : null;
    const leadsInScope = filter ? allLeads.filter(l => effectiveExhibition(l) === filter) : allLeads;
    const leadIds = new Set(leadsInScope.map(l => l.id));

    // Emails that actually went out.
    const followups = (
      await fetchAll((from, to) => {
        let q = supabaseAdmin
          .from('followups')
          .select('lead_id, sequence_position, sent_at, channel, status, leads!inner(organization_id)')
          .eq('leads.organization_id', orgId)
          .eq('channel', 'email')
          .eq('status', 'sent');
        if (opts.leadId) q = q.eq('lead_id', opts.leadId);
        return q.order('sent_at', { ascending: true }).range(from, to);
      })
    ).filter((f: any) => leadIds.has(f.lead_id));

    // Opens and clicks, ignoring scanners and link previewers.
    const events = (
      await fetchAll((from, to) => {
        let q = supabaseAdmin
          .from('email_events')
          .select('lead_id, touch, event_type, created_at')
          .eq('organization_id', orgId)
          .eq('is_bot', false);
        if (opts.leadId) q = q.eq('lead_id', opts.leadId);
        return q.order('created_at', { ascending: true }).range(from, to);
      })
    ).filter((e: any) => leadIds.has(e.lead_id));

    const sentByLead = new Map<string, any[]>();
    for (const f of followups) {
      const list = sentByLead.get(f.lead_id) || [];
      list.push(f);
      sentByLead.set(f.lead_id, list);
    }
    const eventsByLead = new Map<string, any[]>();
    for (const e of events) {
      const list = eventsByLead.get(e.lead_id) || [];
      list.push(e);
      eventsByLead.set(e.lead_id, list);
    }

    const leads: LeadEngagement[] = leadsInScope.map(l => {
      const contact = l.contact_fields || {};
      const sent = sentByLead.get(l.id) || [];
      const evs = eventsByLead.get(l.id) || [];

      const touches: LeadEngagement['touches'] = {};
      for (const s of sent) {
        touches[s.sequence_position] = { sentAt: s.sent_at || null, opened: false, clicked: false };
      }

      let opens = 0;
      let clicks = 0;
      let firstOpenAt: string | null = null;
      let lastActivityAt: string | null = null;

      for (const ev of evs) {
        // Events without an email number belong to the most recent email sent before them.
        let touch: number | null = typeof ev.touch === 'number' ? ev.touch : null;
        if (touch === null) {
          const before = sent.filter(s => s.sent_at && s.sent_at <= ev.created_at);
          touch = before.length ? before[before.length - 1].sequence_position : sent[0]?.sequence_position ?? null;
        }
        const slot = touch !== null ? (touches[touch] ||= { sentAt: null, opened: false, clicked: false }) : null;

        if (ev.event_type === 'open') {
          opens++;
          if (slot) slot.opened = true;
          if (!firstOpenAt) firstOpenAt = ev.created_at;
        } else if (ev.event_type === 'click') {
          clicks++;
          if (slot) {
            slot.clicked = true;
            slot.opened = true; // a click implies the email was opened
          }
        }
        lastActivityAt = ev.created_at;
      }

      // Opens recorded before email_events existed live only on the lead row.
      const legacyOpens = Number(l.open_count) || 0;
      if (opens === 0 && legacyOpens > 0) {
        opens = legacyOpens;
        const hist = Array.isArray(l.open_history) ? l.open_history : [];
        firstOpenAt = hist[0]?.opened_at || null;
        lastActivityAt = hist[hist.length - 1]?.opened_at || null;
        const firstTouch = sent[0]?.sequence_position;
        if (firstTouch !== undefined && touches[firstTouch]) touches[firstTouch].opened = true;
      }

      const touchList = Object.values(touches);
      const uniqueOpens = touchList.filter(t => t.opened).length;
      const uniqueClicks = touchList.filter(t => t.clicked).length;
      const replied = !!l.has_replied;
      const score =
        uniqueOpens * SCORE_POINTS.open + uniqueClicks * SCORE_POINTS.click + (replied ? SCORE_POINTS.reply : 0);

      return {
        id: l.id,
        name: l.name || contact.name || '',
        company: l.company || contact.company || '',
        title: l.title || contact.title || '',
        email: l.email || contact.email || '',
        phone: l.phone || contact.phone || '',
        exhibition: effectiveExhibition(l),
        stall: l.stall || '',
        status: l.status || '',
        sequenceStatus: l.sequence_status || '',
        capturedAt: l.created_at || null,
        emailsSent: sent.length,
        firstSentAt: sent[0]?.sent_at || null,
        lastSentAt: sent[sent.length - 1]?.sent_at || null,
        opens,
        uniqueOpens,
        clicks,
        uniqueClicks,
        replied,
        score,
        level: interestLevel(score),
        firstOpenAt,
        lastActivityAt,
        touches,
        aiScore: typeof l.score === 'number' ? l.score : null,
        notes: l.notes || '',
      };
    });

    // ---- Summary
    const emailedLeads = leads.filter(l => l.emailsSent > 0);
    const emailed = emailedLeads.length;
    const openedLeads = emailedLeads.filter(l => l.uniqueOpens > 0).length;
    const clickedLeads = emailedLeads.filter(l => l.uniqueClicks > 0).length;
    const repliedLeads = leads.filter(l => l.replied).length;

    const summary: EngagementSummary = {
      totalLeads: leads.length,
      emailed,
      emailsSent: followups.length,
      openedLeads,
      clickedLeads,
      repliedLeads,
      unsubscribed: leads.filter(l => l.sequenceStatus === 'unsubscribed').length,
      bounced: leads.filter(l => l.sequenceStatus === 'bounced').length,
      hot: leads.filter(l => l.level === 'Hot').length,
      warm: leads.filter(l => l.level === 'Warm').length,
      openRate: pct(openedLeads, emailed),
      clickRate: pct(clickedLeads, emailed),
      replyRate: pct(repliedLeads, emailed),
    };

    // ---- Per email number (email #1, #2, ...)
    const touchMap = new Map<number, { sent: number; opened: number; clicked: number }>();
    for (const l of leads) {
      for (const [k, t] of Object.entries(l.touches)) {
        if (!t.sentAt) continue;
        const n = Number(k);
        const row = touchMap.get(n) || { sent: 0, opened: 0, clicked: 0 };
        row.sent++;
        if (t.opened) row.opened++;
        if (t.clicked) row.clicked++;
        touchMap.set(n, row);
      }
    }
    const byTouch: TouchStats[] = Array.from(touchMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([touch, r]) => ({
        touch,
        sent: r.sent,
        opened: r.opened,
        clicked: r.clicked,
        openRate: pct(r.opened, r.sent),
        clickRate: pct(r.clicked, r.sent),
      }));

    // ---- Per exhibition
    const groups = new Map<string, LeadEngagement[]>();
    for (const l of leads) {
      const key = l.exhibition || 'No exhibition';
      groups.set(key, [...(groups.get(key) || []), l]);
    }
    const byExhibition: ExhibitionStats[] = Array.from(groups.entries())
      .map(([name, group]) => {
        const sentGroup = group.filter(l => l.emailsSent > 0);
        const e = sentGroup.length;
        const opened = sentGroup.filter(l => l.uniqueOpens > 0).length;
        const clicked = sentGroup.filter(l => l.uniqueClicks > 0).length;
        const replied = group.filter(l => l.replied).length;
        return {
          name,
          leads: group.length,
          emailed: e,
          opened,
          clicked,
          replied,
          hot: group.filter(l => l.level === 'Hot').length,
          emailsSent: group.reduce((s, l) => s + l.emailsSent, 0),
          openRate: pct(opened, e),
          clickRate: pct(clicked, e),
          replyRate: pct(replied, e),
          avgScore: group.length ? Math.round((group.reduce((s, l) => s + l.score, 0) / group.length) * 10) / 10 : 0,
        };
      })
      .sort((a, b) => b.leads - a.leads);

    // ---- Last 30 days of opens and clicks
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const dailyMap = new Map<string, { opens: number; clicks: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dailyMap.set(dayKey(d), { opens: 0, clicks: 0 });
    }
    for (const ev of events) {
      const row = dailyMap.get(String(ev.created_at).slice(0, 10));
      if (!row) continue;
      if (ev.event_type === 'open') row.opens++;
      else if (ev.event_type === 'click') row.clicks++;
    }
    const daily = Array.from(dailyMap.entries()).map(([date, v]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      ...v,
    }));

    return { leads, summary, byTouch, byExhibition, daily, exhibitions };
  }

  /** Engagement for one lead, used by the lead panel. */
  public static async forLead(orgId: string, leadId: string): Promise<LeadEngagement | null> {
    const report = await this.buildReport(orgId, { leadId });
    return report.leads[0] || null;
  }
}
