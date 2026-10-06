'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  TrendingUp, Users, Mail, Activity, RefreshCw, BarChart2, Download, MousePointerClick, Reply, UserMinus, MailWarning, Trophy
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/Toast';

const LEVEL_STYLE: Record<string, string> = {
  Hot: 'bg-rose-50 text-rose-700 border-rose-200',
  Warm: 'bg-amber-50 text-amber-700 border-amber-200',
  Interested: 'bg-blue-50 text-blue-700 border-blue-200',
  'No activity': 'bg-slate-50 text-slate-500 border-slate-200',
};

const TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: 'none',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
};

const fmtActivity = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExhibition, setSelectedExhibition] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);
  const { addToast } = useToast();

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = selectedExhibition === 'all'
        ? '/api/analytics'
        : `/api/analytics?exhibition=${encodeURIComponent(selectedExhibition)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      setData(json.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics data.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const url = selectedExhibition === 'all'
        ? '/api/analytics/export'
        : `/api/analytics/export?exhibition=${encodeURIComponent(selectedExhibition)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || 'Failed to generate the Excel report');
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `firsthey-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(href);
      addToast('success', 'Excel report downloaded');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to generate the Excel report');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedExhibition]);

  if (isLoading && !data) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-blue-600" />
              Analytics & Insights
            </h1>
            <p className="text-sm text-slate-500 mt-1">Performance metrics, engagement tracking, and lead sentiment analysis.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data?.availableExhibitions?.length > 0 && (
              <select
                value={selectedExhibition}
                onChange={(e) => setSelectedExhibition(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
              >
                <option value="all">All Exhibitions</option>
                {data.availableExhibitions.map((exh: string) => (
                  <option key={exh} value={exh}>{exh}</option>
                ))}
              </select>
            )}
            <button
              onClick={fetchAnalytics}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 border border-blue-600 rounded-lg text-sm text-white font-semibold hover:bg-blue-700 shadow-sm transition-all disabled:opacity-60"
            >
              <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
              {isExporting ? 'Preparing...' : 'Export Excel'}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl">
            {error}
          </div>
        )}

        {data && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Top Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Link href="/leads" className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 hover:-translate-y-1 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Leads</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mt-1">{data.totalLeads}</h3>
                </div>
              </Link>

              <Link href="/leads?filter=hot&sort=exhibition" className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 hover:-translate-y-1 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hot Leads</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mt-1">{data.hotLeads}</h3>
                </div>
              </Link>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Emails Sent</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mt-1">{data.emailStats.sent}</h3>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Open Rate</p>
                  <h3 className="text-2xl font-black text-slate-900 leading-none mt-1">{data.emailStats.openRate}%</h3>
                </div>
              </div>
            </div>

            {/* Engagement Metrics */}
            {data.summary && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: 'Click Rate', value: `${data.summary.clickRate}%`, sub: `${data.summary.clickedLeads} clicked the demo`, icon: MousePointerClick, tone: 'bg-purple-100 text-purple-600' },
                  { label: 'Reply Rate', value: `${data.summary.replyRate}%`, sub: `${data.summary.repliedLeads} replied`, icon: Reply, tone: 'bg-emerald-100 text-emerald-600' },
                  { label: 'Unsubscribed', value: data.summary.unsubscribed, sub: 'Opted out of emails', icon: UserMinus, tone: 'bg-slate-100 text-slate-600' },
                  { label: 'Bounced', value: data.summary.bounced, sub: 'Emails that failed to send', icon: MailWarning, tone: 'bg-amber-100 text-amber-600' },
                ].map(card => (
                  <div key={card.label} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.tone}`}>
                      <card.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{card.label}</p>
                      <h3 className="text-2xl font-black text-slate-900 leading-none mt-1">{card.value}</h3>
                      <p className="text-[10px] text-slate-400 mt-1">{card.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* Lead Volume Bar Chart */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
                <h3 className="text-base font-bold text-slate-900 mb-4">Lead Capture Volume (Last 30 Days)</h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.leadsByDate} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Sentiment Pie Chart */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                <h3 className="text-base font-bold text-slate-900 mb-4">Lead Sentiment Analysis</h3>
                <div className="flex-1 min-h-[280px]">
                  {data.sentiment.reduce((a:any,b:any) => a+b.value, 0) > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.sentiment}
                          cx="50%"
                          cy="45%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {data.sentiment.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                      Not enough sentiment data gathered yet.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Engagement over time + per-email performance */}
            {data.summary && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
                  <h3 className="text-base font-bold text-slate-900 mb-1">Opens & Clicks (Last 30 Days)</h3>
                  <p className="text-xs text-slate-400 mb-4">Clicks are the most reliable signal. Opens can be overcounted by mail apps that pre-load images.</p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} interval={4} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                        <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={TOOLTIP_STYLE} />
                        <Legend verticalAlign="top" height={30} iconType="circle" />
                        <Bar dataKey="opens" name="Opens" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={20} />
                        <Bar dataKey="clicks" name="Clicks" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-base font-bold text-slate-900 mb-4">Performance by Email</h3>
                  {data.byTouch.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-slate-400 text-sm italic">No emails sent yet.</div>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {data.byTouch.map((t: any) => (
                        <div key={t.touch} className="border border-slate-100 rounded-lg px-3 py-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800">Email {t.touch}</span>
                            <span className="text-slate-400">{t.sent} sent</span>
                          </div>
                          <div className="mt-2 space-y-1.5">
                            {[
                              { label: 'Opened', pct: t.openRate, bar: 'bg-blue-500' },
                              { label: 'Clicked', pct: t.clickRate, bar: 'bg-purple-500' },
                            ].map(m => (
                              <div key={m.label} className="flex items-center gap-2 text-[10px] text-slate-500">
                                <span className="w-12">{m.label}</span>
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${m.bar}`} style={{ width: `${m.pct}%` }} />
                                </div>
                                <span className="w-8 text-right font-semibold text-slate-700">{m.pct}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Exhibition performance */}
            {data.byExhibition?.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="text-base font-bold text-slate-900">Exhibition Performance</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/60">
                        <th className="text-left px-5 py-2.5">Exhibition</th>
                        <th className="text-right px-3 py-2.5">Leads</th>
                        <th className="text-right px-3 py-2.5">Emailed</th>
                        <th className="text-right px-3 py-2.5">Open Rate</th>
                        <th className="text-right px-3 py-2.5">Click Rate</th>
                        <th className="text-right px-3 py-2.5">Replies</th>
                        <th className="text-right px-3 py-2.5">Hot</th>
                        <th className="text-right px-5 py-2.5">Avg Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.byExhibition.map((e: any) => (
                        <tr key={e.name} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-3 font-semibold text-slate-800">{e.name}</td>
                          <td className="px-3 py-3 text-right text-slate-600">{e.leads}</td>
                          <td className="px-3 py-3 text-right text-slate-600">{e.emailed}</td>
                          <td className="px-3 py-3 text-right text-slate-600">{e.openRate}%</td>
                          <td className="px-3 py-3 text-right text-slate-600">{e.clickRate}%</td>
                          <td className="px-3 py-3 text-right text-slate-600">{e.replied}</td>
                          <td className="px-3 py-3 text-right font-semibold text-rose-600">{e.hot}</td>
                          <td className="px-5 py-3 text-right font-semibold text-slate-800">{e.avgScore}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Most interested leads */}
            {data.topLeads && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    Most Interested Leads
                  </h3>
                  <span className="text-[11px] text-slate-400">Score: open 1 · click 5 · reply 10</span>
                </div>
                {data.topLeads.length === 0 ? (
                  <div className="px-5 py-10 text-center text-slate-400 text-sm italic">
                    No opens, clicks or replies yet. Interested leads will appear here.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/60">
                          <th className="text-left px-5 py-2.5">Lead</th>
                          <th className="text-left px-3 py-2.5">Exhibition</th>
                          <th className="text-right px-3 py-2.5">Sent</th>
                          <th className="text-right px-3 py-2.5">Opened</th>
                          <th className="text-right px-3 py-2.5">Clicked</th>
                          <th className="text-right px-3 py-2.5">Last Activity</th>
                          <th className="text-right px-5 py-2.5">Interest</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.topLeads.map((l: any) => (
                          <tr key={l.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-5 py-3">
                              <Link href="/leads" className="font-semibold text-slate-800 hover:text-blue-600">{l.name || 'Unnamed lead'}</Link>
                              <div className="text-[11px] text-slate-400">{l.company}</div>
                            </td>
                            <td className="px-3 py-3 text-slate-500">{l.exhibition || '—'}</td>
                            <td className="px-3 py-3 text-right text-slate-600">{l.emailsSent}</td>
                            <td className="px-3 py-3 text-right text-slate-600">{l.opens}</td>
                            <td className="px-3 py-3 text-right text-slate-600">{l.clicks}</td>
                            <td className="px-3 py-3 text-right text-slate-500">{fmtActivity(l.lastActivityAt)}</td>
                            <td className="px-5 py-3 text-right">
                              <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${LEVEL_STYLE[l.level] || LEVEL_STYLE['No activity']}`}>
                                {l.level} · {l.score}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
