'use client';

import React, { useEffect, useState } from 'react';
import {
  Workflow,
  UserPlus,
  Sparkles,
  Send,
  Eye,
  Reply,
  Check,
  Circle,
  AlertTriangle,
  RefreshCw,
  Mail,
  MessageCircle,
} from 'lucide-react';

interface EmailPipelineProps {
  leadId: string;
  /** Changes whenever the parent refreshes, so the pipeline refetches. */
  refreshKey?: unknown;
}

type StageState = 'done' | 'current' | 'pending';

const fmt = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

const followupStatusStyle: Record<string, string> = {
  sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  queued: 'bg-slate-50 text-slate-500 border-slate-200',
  due: 'bg-amber-50 text-amber-700 border-amber-200',
  sending: 'bg-blue-50 text-blue-700 border-blue-200',
  send_failed: 'bg-red-50 text-red-700 border-red-200',
  skipped: 'bg-slate-50 text-slate-400 border-slate-200',
  cancelled: 'bg-slate-50 text-slate-400 border-slate-200',
};

export default function EmailPipeline({ leadId, refreshKey }: EmailPipelineProps) {
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isTogglingSequence, setIsTogglingSequence] = useState(false);
  const [sequenceError, setSequenceError] = useState<string | null>(null);

  const toggleSequence = async (action: 'pause' | 'resume') => {
    setIsTogglingSequence(true);
    setSequenceError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/sequence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to update sequence.');
      setReloadTick(t => t + 1);
    } catch (e: any) {
      setSequenceError(e.message);
    } finally {
      setIsTogglingSequence(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/leads/${leadId}/pipeline?t=${Date.now()}`)
      .then(res => res.json())
      .then(res => {
        if (cancelled) return;
        if (res.error) {
          setError(res.error.message || 'Failed to load pipeline.');
          setData(null);
        } else {
          setError(null);
          setData(res.data);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load pipeline.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId, refreshKey, reloadTick]);

  const header = (
    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/40 pb-2">
      <Workflow className="w-4 h-4 text-slate-600" />
      Email Pipeline
    </h4>
  );

  if (loading && !data) {
    return (
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 space-y-3">
        {header}
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <RefreshCw className="w-3 h-3 animate-spin" /> Loading pipeline...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 space-y-3">
        {header}
        <p className="text-[11px] text-red-500">{error || 'Pipeline unavailable.'}</p>
      </div>
    );
  }

  const { lead, followups, replies, sender, warnings } = data;
  const sentFollowups = followups.filter((f: any) => f.status === 'sent');
  const firstSent = sentFollowups[0];
  const emailSent = sentFollowups.some((f: any) => f.channel === 'email');
  const firstOpen = lead.open_history?.[0];
  const lastOpen = lead.open_history?.[lead.open_history.length - 1];
  const hasReplied = lead.has_replied || replies.length > 0;
  const hasDraft = !!lead.latest_draft;
  const failed = followups.some((f: any) => f.status === 'send_failed') || lead.status === 'failed_to_contact';

  const stages: { key: string; label: string; detail: string; icon: React.ReactNode; done: boolean }[] = [
    {
      key: 'captured',
      label: 'Lead captured',
      detail: fmt(lead.created_at) || '',
      icon: <UserPlus className="w-3 h-3" />,
      done: true,
    },
    {
      key: 'drafted',
      label: 'AI draft prepared',
      detail: hasDraft ? lead.latest_draft.subject || 'Draft ready' : lead.email ? 'No draft yet' : 'Needs an email address',
      icon: <Sparkles className="w-3 h-3" />,
      done: hasDraft || emailSent,
    },
    {
      key: 'sent',
      label: 'Email sent',
      detail: firstSent
        ? `${fmt(firstSent.sent_at || firstSent.created_at)} · ${sentFollowups.length} sent`
        : failed
          ? 'Sending failed'
          : 'Not sent yet',
      icon: <Send className="w-3 h-3" />,
      done: emailSent || sentFollowups.length > 0,
    },
    {
      key: 'opened',
      label: 'Opened',
      detail: lead.is_opened
        ? `${lead.open_count} open${lead.open_count === 1 ? '' : 's'} · first ${fmt(firstOpen?.opened_at)}, last ${fmt(lastOpen?.opened_at)}`
        : emailSent
          ? 'Waiting for an open'
          : '—',
      icon: <Eye className="w-3 h-3" />,
      done: lead.is_opened,
    },
    {
      key: 'replied',
      label: 'Replied',
      detail: hasReplied
        ? replies.length > 0
          ? `${fmt(replies[replies.length - 1].created_at)} · ${replies[replies.length - 1].action_data?.sentiment || 'reply received'}`
          : 'Reply received'
        : emailSent
          ? 'Waiting for a reply'
          : '—',
      icon: <Reply className="w-3 h-3" />,
      done: hasReplied,
    },
  ];

  const firstPendingIdx = stages.findIndex(s => !s.done);
  const stageState = (i: number): StageState =>
    stages[i].done ? 'done' : i === firstPendingIdx ? 'current' : 'pending';

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 space-y-4">
      {header}

      {/* Sender / delivery setup */}
      <div
        className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] ${
          sender.configured
            ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}
      >
        {sender.configured ? (
          <Mail className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        )}
        <div className="leading-relaxed">
          {sender.configured ? (
            <>
              Sending from <span className="font-semibold">{sender.fromName ? `${sender.fromName} <${sender.email}>` : sender.email}</span>
              {' '}with open tracking enabled.
            </>
          ) : (
            <>Email sending is not configured. Add your email credentials in Settings before sending.</>
          )}
        </div>
      </div>

      {/* Stage tracker */}
      <ol className="relative border-l border-slate-200 ml-2.5 space-y-3.5">
        {stages.map((s, i) => {
          const state = stageState(i);
          return (
            <li key={s.key} className="pl-5 relative">
              <span
                className={`absolute -left-[11px] top-0 w-5 h-5 rounded-full border flex items-center justify-center ${
                  state === 'done'
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : state === 'current'
                      ? 'bg-white border-blue-500 text-blue-600'
                      : 'bg-white border-slate-200 text-slate-300'
                }`}
              >
                {state === 'done' ? <Check className="w-3 h-3" /> : state === 'current' ? s.icon : <Circle className="w-2 h-2" />}
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-semibold ${state === 'pending' ? 'text-slate-400' : 'text-slate-900'}`}>
                  {s.label}
                </span>
                {state === 'current' && (
                  <span className="text-[9px] font-bold uppercase text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Next</span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed truncate">{s.detail}</p>
            </li>
          );
        })}
      </ol>

      {/* Automatic sequence: status, next send, pause/resume */}
      {(() => {
        const seqStatus: string = lead.sequence_status || 'active';
        const nextQueued = followups.find((f: any) => f.status === 'queued' && f.channel === 'email');
        const sentEmails = followups.filter((f: any) => f.channel === 'email' && f.status === 'sent').length;
        const canResume = seqStatus === 'paused' || seqStatus === 'bounced';
        const canPause = seqStatus === 'active' && sentEmails > 0;
        const statusNote: Record<string, string> = {
          active: nextQueued
            ? `Email #${nextQueued.sequence_position} is written and will send automatically on ${fmt(nextQueued.scheduled_for)}.`
            : sentEmails > 0
              ? 'No email queued right now.'
              : 'Starts automatically after you approve and send the first email.',
          paused: 'Paused. Nothing will send until you resume.',
          completed: 'All planned emails have been sent.',
          bounced: 'Stopped because an email failed to send. Check the address, then resume.',
          unsubscribed: 'This contact unsubscribed. No more emails will be sent.',
        };
        return (
          <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Auto follow-ups (every 14 days)</span>
              <span className="font-semibold text-slate-800 capitalize">{seqStatus}</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">{statusNote[seqStatus] || seqStatus}</p>
            {(canPause || canResume) && (
              <button
                onClick={() => toggleSequence(canPause ? 'pause' : 'resume')}
                disabled={isTogglingSequence}
                className="text-[10px] font-bold px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-50"
              >
                {isTogglingSequence ? 'Working...' : canPause ? 'Pause sequence' : 'Resume sequence'}
              </button>
            )}
            {sequenceError && <p className="text-[10px] text-red-500">{sequenceError}</p>}
          </div>
        );
      })()}

      {/* Every touch */}
      <div className="space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Touches ({followups.length})</div>
        {followups.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic">No messages sent or scheduled for this lead yet.</p>
        ) : (
          followups.map((f: any) => {
            const expanded = expandedId === f.id;
            return (
              <div key={f.id} className="border border-slate-100 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : f.id)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-left"
                >
                  {f.channel === 'email' ? (
                    <Mail className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  ) : (
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-800 truncate">
                      #{f.sequence_position}{' '}
                      {f.subject || (f.body ? (f.channel === 'email' ? 'Email' : 'WhatsApp message') : 'AI will write this before sending')}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {f.status === 'sent' ? `Sent ${fmt(f.sent_at || f.created_at)}` : `Scheduled ${fmt(f.scheduled_for)}`}
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                      followupStatusStyle[f.status] || followupStatusStyle.queued
                    }`}
                  >
                    {f.status.replace('_', ' ')}
                  </span>
                </button>
                {expanded && (
                  <div className="px-2.5 pb-2.5 text-[11px] text-slate-600 whitespace-pre-line leading-relaxed border-t border-slate-100 pt-2">
                    {f.body || 'Not written yet. The AI writes it right before it is sent.'}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {warnings?.length > 0 && (
        <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-0.5">
          {warnings.map((w: string, i: number) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}
    </div>
  );
}
