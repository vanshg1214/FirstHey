'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ListChecks, RefreshCw, Pause, Play, Send, Clock, PauseCircle, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useToast } from '@/components/Toast';

const fmtWhen = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const overdue = d.getTime() <= Date.now();
  const text = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return overdue ? `${text} (due now)` : text;
};

export default function QueuePage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sequence/queue', { cache: 'no-store' });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      setData(json.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load the sending queue.');
    } finally {
      setIsLoading(false);
    }
  };

  const run = async (action: 'pause_all' | 'resume_all') => {
    const question =
      action === 'pause_all'
        ? 'Pause every automatic sequence? No follow-up emails will go out until you resume.'
        : 'Resume all paused sequences? Overdue emails restart tomorrow, not all at once.';
    if (!confirm(question)) return;
    setIsWorking(true);
    try {
      const res = await fetch('/api/sequence/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      addToast('success', action === 'pause_all' ? `Paused ${json.data.paused} sequence(s)` : `Resumed ${json.data.resumed} sequence(s)`);
      await load();
    } catch (err: any) {
      addToast('error', err.message || 'Could not update the queue');
    } finally {
      setIsWorking(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (isLoading && !data) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 pb-28 md:pb-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-blue-600" />
              Sending Queue
            </h1>
            <p className="text-sm text-slate-500 mt-1">Follow-up emails waiting to go out, and a stop button if you need one.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={load}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => run('resume_all')}
              disabled={isWorking}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-semibold hover:bg-slate-50 shadow-sm transition-all disabled:opacity-60"
            >
              <Play className="w-3.5 h-3.5" />
              Resume all
            </button>
            <button
              onClick={() => run('pause_all')}
              disabled={isWorking}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 border border-rose-600 rounded-lg text-sm text-white font-semibold hover:bg-rose-700 shadow-sm transition-all disabled:opacity-60"
            >
              <Pause className="w-3.5 h-3.5" />
              Pause all
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl">{error}</div>
        )}

        {data && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Status banner */}
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 ${
                data.sendingAllowed ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              {data.sendingAllowed ? <ShieldCheck className="w-5 h-5 mt-0.5" /> : <ShieldAlert className="w-5 h-5 mt-0.5" />}
              <div className="text-sm">
                <p className="font-bold">{data.sendingAllowed ? 'Sending is open right now' : 'Sending is closed right now'}</p>
                <p className="mt-0.5 opacity-90">
                  {data.sendingAllowed
                    ? 'Due emails go out in small batches during business hours.'
                    : `${data.blockedReason} Emails stay queued and go out when sending opens.`}
                </p>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Queued</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mt-1">{data.queued}</h3>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sent Today</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mt-1">
                    {data.sentToday} <span className="text-sm font-semibold text-slate-400">of {data.dailyCap}</span>
                  </h3>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                  <PauseCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Paused Leads</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mt-1">{data.pausedLeads}</h3>
                </div>
              </div>
            </div>

            {/* Queue table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900">Next emails to go out</h2>
                <p className="text-xs text-slate-500 mt-0.5">Earliest first. Showing up to 100.</p>
              </div>
              {data.items.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  Nothing is waiting. Emails appear here as soon as a lead's sequence has a next email scheduled.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/60">
                        <th className="text-left px-5 py-2.5">Lead</th>
                        <th className="text-left px-3 py-2.5">Company</th>
                        <th className="text-right px-3 py-2.5">Email #</th>
                        <th className="text-right px-3 py-2.5">Scheduled</th>
                        <th className="text-right px-5 py-2.5">State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.items.map((item: any) => (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-3">
                            <Link href="/leads" className="font-semibold text-slate-900 hover:text-blue-600">
                              {item.name || item.email || 'Unnamed lead'}
                            </Link>
                            {item.name && item.email && <div className="text-xs text-slate-400">{item.email}</div>}
                          </td>
                          <td className="px-3 py-3 text-slate-600">{item.company || '—'}</td>
                          <td className="px-3 py-3 text-right text-slate-600">{item.position}</td>
                          <td className="px-3 py-3 text-right text-slate-600">{fmtWhen(item.scheduledFor)}</td>
                          <td className="px-5 py-3 text-right">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                                item.leadPaused
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : item.status === 'sending'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-slate-50 text-slate-600 border-slate-200'
                              }`}
                            >
                              {item.leadPaused ? 'Paused' : item.status === 'sending' ? 'Sending' : 'Queued'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
