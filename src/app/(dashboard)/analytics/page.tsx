'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  TrendingUp, Users, Mail, Activity, RefreshCw, BarChart2
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExhibition, setSelectedExhibition] = useState<string>('all');

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
          <div className="flex items-center gap-2">
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
                      <RechartsTooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                      />
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
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                        />
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
          </div>
        )}

      </div>
    </div>
  );
}
