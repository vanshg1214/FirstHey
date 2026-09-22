'use client';

import React, { useState, useEffect, useRef } from 'react';
import LeadList from '@/components/LeadList';
import LeadDetailPanel from '@/components/LeadDetailPanel';
import LeadFormModal from '@/components/LeadFormModal';
import {
  Target,
  Sparkles,
  Users,
  RefreshCw,
  Search,
  CheckCircle,
  AlertTriangle,
  UserPlus,
  LayoutDashboard,
  Clock,
  Download,
  Trash2,
  Plus
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/Toast';

export default function LeadsDashboard() {
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<string | null>(null);
  const [offlineQueueLength, setOfflineQueueLength] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { addToast } = useToast();

  const exportToCSV = () => {
    if (filteredLeads.length === 0) return;
    const headers = ['Name', 'Company', 'Title', 'Email', 'Phone', 'Exhibition', 'Stall', 'Status', 'Sentiment', 'Opens', 'Captured At'];
    const rows = filteredLeads.map(lead => {
      const c = lead.contact_fields || {};
      const ctx = lead.context_summary || {};
      return [
        c.name || '', c.company || '', c.title || '', c.email || '', c.phone || '',
        lead.exhibition || '', lead.stall || '', lead.status || '',
        ctx.sentiment || '', ctx.open_count || 0,
        new Date(lead.created_at).toLocaleDateString(),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', `Exported ${filteredLeads.length} leads`, 'CSV file downloaded successfully.');
  };

  // Animated count hook
  const useAnimatedCount = (target: number, duration = 800) => {
    const [count, setCount] = useState(0);
    const prevTarget = useRef(0);
    useEffect(() => {
      if (target === prevTarget.current) return;
      prevTarget.current = target;
      const start = Date.now();
      const tick = () => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        setCount(Math.round(ease * target));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, [target, duration]);
    return count;
  };

  interface Activity {
    id: string;
    leadId: string;
    leadName: string;
    company: string;
    type: 'capture' | 'ocr' | 'voice' | 'sync' | 'open';
    timestamp: string;
    details: string;
  }

  const activities = React.useMemo(() => {
    const list: Activity[] = [];
    leads.forEach((lead) => {
      const contact = lead.contact_fields || {};
      const name = contact.name || 'Unnamed Prospect';
      const company = contact.company || 'Unknown Company';
      
      if (lead.created_at) {
        list.push({
          id: `${lead.id}-capture`,
          leadId: lead.id,
          leadName: name,
          company,
          type: 'capture',
          timestamp: lead.created_at,
          details: 'Prospect captured'
        });
      }

      const card = lead.card_scans 
        ? (Array.isArray(lead.card_scans) ? lead.card_scans[0] : lead.card_scans) 
        : null;
      if (card && card.image_url) {
        list.push({
          id: `${lead.id}-ocr`,
          leadId: lead.id,
          leadName: name,
          company,
          type: 'ocr',
          timestamp: card.created_at || lead.created_at,
          details: 'Business card scanned'
        });
      }

      const recording = lead.recordings 
        ? (Array.isArray(lead.recordings) ? lead.recordings[0] : lead.recordings) 
        : null;
      if (recording && (recording.audio_url || recording.transcript)) {
        list.push({
          id: `${lead.id}-voice`,
          leadId: lead.id,
          leadName: name,
          company,
          type: 'voice',
          timestamp: recording.created_at || lead.created_at,
          details: 'Conversation transcribed'
        });
      }

      if (lead.status === 'synced' && lead.crm_record_id) {
        list.push({
          id: `${lead.id}-sync`,
          leadId: lead.id,
          leadName: name,
          company,
          type: 'sync',
          timestamp: lead.created_at,
          details: 'Synced to Zoho CRM'
        });
      }

      const context = lead.context_summary || {};
      if (context.open_count > 0) {
        // Try to find the earliest open timestamp from followups
        const followups = lead.followups || [];
        const openedFollowup = followups.find((f: any) => f.opened_at);
        const openTime = openedFollowup?.opened_at 
          ? new Date(openedFollowup.opened_at).toISOString() 
          : new Date(new Date(lead.created_at).getTime() + 10 * 60 * 1000).toISOString(); // fallback

        list.push({
          id: `${lead.id}-open`,
          leadId: lead.id,
          leadName: name,
          company,
          type: 'open',
          timestamp: openTime,
          details: `Follow-up email opened (${context.open_count} views)`
        });
      }
    });

    return list
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  }, [leads]);

  const fetchLeads = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch all leads so global metrics remain accurate across filters
      const response = await fetch(`/api/leads?status=all&t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load leads from database.');
      }
      const result = await response.json();
      setLeads(result.data || []);
      
      if (selectedLead) {
        const updated = (result.data || []).find((l: any) => l.id === selectedLead.id);
        if (updated) setSelectedLead(updated);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleToggleAll = () => {
    if (selectedIds.length === filteredLeads.length && filteredLeads.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLeads.map(l => l.id));
    }
  };

  const handleSaveLead = async (payload: any) => {
    try {
      const url = '/api/leads';
      const method = payload.id ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to save lead');
      
      addToast('success', payload.id ? 'Lead updated' : 'Lead created');
      fetchLeads();
      if (selectedLead && payload.id === selectedLead.id) {
        setSelectedLead(null); // Reset selection or refetch single lead
      }
    } catch (err: any) {
      addToast('error', err.message);
      throw err;
    }
  };

  const handleDeleteLead = async (lead: any) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      const response = await fetch('/api/leads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [lead.id] })
      });
      if (!response.ok) throw new Error('Failed to delete lead');
      
      addToast('success', 'Lead deleted');
      setSelectedIds(prev => prev.filter(id => id !== lead.id));
      fetchLeads();
    } catch (err: any) {
      addToast('error', err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} leads?`)) return;
    setIsDeleting(true);
    try {
      const response = await fetch('/api/leads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      });
      if (!response.ok) throw new Error('Failed to delete leads');
      
      addToast('success', `${selectedIds.length} leads deleted`);
      setSelectedIds([]);
      fetchLeads();
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSearchQuery(''); // Reset search when filter tab changes
  }, [statusFilter]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const filter = params.get('filter');
      const sort = params.get('sort');
      if (filter) setStatusFilter(filter);
      if (sort) setSortField(sort);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const updateOfflineCount = () => {
      const queue = localStorage.getItem('exhibition_crm_offline_leads');
      setOfflineQueueLength(queue ? JSON.parse(queue).length : 0);
    };
    
    window.addEventListener('offline-queue-updated', updateOfflineCount);
    window.addEventListener('offline-sync-complete', () => {
      updateOfflineCount();
      fetchLeads();
    });
    
    updateOfflineCount();
    
    return () => {
      window.removeEventListener('offline-queue-updated', updateOfflineCount);
      window.removeEventListener('offline-sync-complete', updateOfflineCount);
    };
  }, []);

  const sentimentCounts = React.useMemo(() => {
    return leads.reduce((acc: any, lead) => {
      const sentiment = (lead.notes || '').toLowerCase().includes('positive') ? 'positive' : 'neutral';
      acc[sentiment] = (acc[sentiment] || 0) + 1;
      return acc;
    }, { positive: 0, neutral: 0, skeptical: 0, critical: 0 });
  }, [leads]);

  const totalLeads = leads.length;
  const syncedCount = React.useMemo(() => leads.filter((l) => l.status === 'synced').length, [leads]);
  const alertCount = React.useMemo(() => leads.filter((l) => l.status === 'needs_attention').length, [leads]);
  const hotCount = React.useMemo(() => leads.filter((l) => (l.open_count || 0) >= 2).length, [leads]);

  const animTotalLeads = useAnimatedCount(isLoading ? 0 : totalLeads);
  const animSyncedCount = useAnimatedCount(isLoading ? 0 : syncedCount);
  const animAlertCount = useAnimatedCount(isLoading ? 0 : alertCount);
  const animHotCount = useAnimatedCount(isLoading ? 0 : hotCount);

  const filteredLeads = React.useMemo(() => {
    let list = leads;
    
    // Apply status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'hot') {
        list = list.filter(l => (l.open_count || 0) >= 2);
      } else {
        list = list.filter(l => l.status === statusFilter);
      }
    }
    
    // Apply search query
    list = list.filter((lead) => {
      const contact = lead.contact_fields || {};
      const name = (contact.name || '').toLowerCase();
      const company = (contact.company || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      return name.includes(query) || company.includes(query);
    });

    if (sortField === 'exhibition') {
      list = [...list].sort((a, b) => {
        const extA = (a.exhibition || '').toLowerCase();
        const extB = (b.exhibition || '').toLowerCase();
        if (!extA) return 1;
        if (!extB) return -1;
        return extA.localeCompare(extB);
      });
    }

    return list;
  }, [leads, searchQuery, statusFilter, sortField]);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-teal-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white/60 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex items-center justify-start">
              <span className="text-xl font-black text-slate-900 tracking-tight">FirstHey</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/exhibitions"
              className="py-2 px-3 sm:py-2.5 sm:px-5 rounded-xl border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-bold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all"
            >
              <LayoutDashboard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Exhibitions</span>
            </Link>
            <button
              onClick={fetchLeads}
              className="p-2 sm:p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all group"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:text-slate-600 transition-colors ${isLoading ? 'animate-spin text-slate-600' : ''}`} />
            </button>
            <button
              onClick={() => { setEditingLead(null); setIsFormOpen(true); }}
              className="p-2 sm:p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all group"
              title="Add Lead Manually"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <Link
              href="/capture"
              className="py-2 px-3 sm:py-2.5 sm:px-5 rounded-xl bg-white hover:bg-zinc-200 font-bold text-xs sm:text-sm text-black flex items-center gap-1.5 sm:gap-2 shadow-lg shadow-white/10 hover:scale-[1.02] transition-all"
            >
              <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Capture<span className="hidden sm:inline"> Lead</span></span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-8 space-y-8 z-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-slate-800" />
              Exhibitions Overview
            </h1>
            <p className="text-sm text-slate-500 mt-1">Monitor all lead processing, extraction status, and automated CRM syncs.</p>
          </div>
          
          {/* Status Tabs */}
          <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-slate-200 overflow-x-auto max-w-full backdrop-blur-md whitespace-nowrap scrollbar-none">
            {['all', 'synced', 'needs_attention', 'hot', 'capturing'].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all flex-shrink-0 flex items-center gap-1 ${
                  statusFilter === tab
                    ? 'bg-white text-black shadow-md'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab === 'hot' && '🔥'}
                {tab === 'needs_attention' ? 'Alerts' : tab === 'hot' ? `Hot (${hotCount})` : tab}
              </button>
            ))}
          </div>
        </div>

        {/* Metrics Banner */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-3 gap-3 md:gap-4"
        >
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-3 md:p-4 flex flex-col md:flex-row items-center gap-3 group hover:shadow-md hover:border-blue-200 transition-all cursor-default">
            <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 text-center md:text-left">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                Total Leads
              </span>
              <div className="text-xl md:text-2xl font-black text-slate-900 leading-none">{isLoading ? <span className="animate-pulse text-slate-300">...</span> : animTotalLeads}</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-3 md:p-4 flex flex-col md:flex-row items-center gap-3 group hover:shadow-md hover:border-teal-200 transition-all cursor-default">
            <div className="w-10 h-10 rounded-lg bg-teal-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 text-center md:text-left">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                Synced CRM
              </span>
              <div className="text-xl md:text-2xl font-black text-slate-900 leading-none">{isLoading ? <span className="animate-pulse text-slate-300">...</span> : animSyncedCount}</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-3 md:p-4 flex flex-col md:flex-row items-center gap-3 group hover:shadow-md hover:border-rose-200 transition-all cursor-default">
            <div className="w-10 h-10 rounded-lg bg-rose-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 text-center md:text-left">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                Alerts
              </span>
              <div className="text-xl md:text-2xl font-black text-slate-900 leading-none">{isLoading ? <span className="animate-pulse text-slate-300">...</span> : animAlertCount}</div>
            </div>
          </div>
        </motion.div>

        {/* Offline Sync Alert */}
        {offlineQueueLength > 0 && (
          <div className="p-4 bg-indigo-950/40 border border-blue-500/30 text-indigo-200 rounded-3xl text-sm flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-800 animate-ping"></span>
              <span className="font-semibold">Sync Queue: {offlineQueueLength} lead(s) cached locally waiting for connection.</span>
            </div>
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Syncing in background</span>
          </div>
        )}

        {/* 2-Column Responsive Dashboard Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Main Leads List Area (3/4 Width) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Search + Export */}
            <div className="flex gap-2 items-center">
              <div className="relative flex-1 bg-white border border-slate-200 shadow-sm rounded-xl group focus-within:border-blue-500/50 transition-colors">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-slate-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Search leads by name, company, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-900 placeholder-zinc-600 focus:ring-0 outline-none"
                />
              </div>
                <button
                  onClick={exportToCSV}
                  disabled={filteredLeads.length === 0}
                  title="Export to CSV"
                  className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-teal-500/30 text-slate-500 hover:text-teal-500 transition-all disabled:opacity-40"
                >
                  <Download className="w-4 h-4" />
                </button>
                {selectedIds.length > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    disabled={isDeleting}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 font-bold text-xs shadow-sm hover:bg-red-100 transition-all disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Delete ({selectedIds.length})</span>
                  </button>
                )}
              </div>


            {/* Leads List */}
            {isLoading && leads.length === 0 ? (
              <div className="flex justify-center py-20">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : error ? (
              <div className="p-6 bg-red-950/20 border border-red-500/20 text-red-400 rounded-3xl text-sm font-medium text-center">
                {error}
              </div>
            ) : (
              <LeadList 
                leads={filteredLeads} 
                onSelectLead={setSelectedLead} 
                selectedIds={selectedIds}
                onToggleSelection={handleToggleSelection}
                onToggleAll={handleToggleAll}
                onEditLead={(lead) => { setEditingLead(lead); setIsFormOpen(true); }}
                onDeleteLead={handleDeleteLead}
              />
            )}
          </div>

          {/* Right Sidebar: Analytics & Real-time Log (1/4 Width) */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Sentiment Breakdown */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 space-y-4">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-slate-600" />
                Sentiment Breakdown
              </h4>
              <div className="space-y-3">
                {[
                  { name: 'Positive', key: 'positive', color: 'bg-emerald-500', barColor: 'bg-emerald-500/20' },
                  { name: 'Neutral', key: 'neutral', color: 'bg-blue-500', barColor: 'bg-blue-500/20' },
                  { name: 'Skeptical', key: 'skeptical', color: 'bg-amber-500', barColor: 'bg-amber-500/20' },
                  { name: 'Critical', key: 'critical', color: 'bg-rose-500', barColor: 'bg-rose-500/20' }
                ].map((s) => {
                  const count = sentimentCounts[s.key] || 0;
                  const percent = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
                  return (
                    <div key={s.key} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">{s.name}</span>
                        <span className="text-slate-400 font-mono">{count} ({percent}%)</span>
                      </div>
                      <div className={`w-full h-1.5 rounded-full ${s.barColor} overflow-hidden`}>
                        <div className={`h-full rounded-full ${s.color}`} style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Activity Log */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 space-y-4">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-600" />
                Live Activity Log
              </h4>
              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
                {activities.length === 0 ? (
                  <p className="text-[11px] text-zinc-600 text-center italic select-none py-6">
                    No recent activities recorded.
                  </p>
                ) : (
                  activities.map((act) => (
                    <div key={act.id} className="relative pl-3 border-l border-slate-200 text-[10px] space-y-0.5">
                      {/* Event dot */}
                      <span className={`absolute -left-[4.5px] top-1 w-2 h-2 rounded-full ${
                        act.type === 'capture' ? 'bg-slate-800' :
                        act.type === 'ocr' ? 'bg-teal-500' :
                        act.type === 'voice' ? 'bg-purple-500' :
                        act.type === 'sync' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
                      }`}></span>
                      <div className="flex justify-between text-slate-700">
                        <span className="font-semibold">{act.leadName}</span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-400">{act.details} @ {act.company}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Side drawer detail inspector */}
      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onRefresh={fetchLeads}
        />
      )}
      {/* Lead Form Modal */}
      <LeadFormModal 
        isOpen={isFormOpen} 
        onClose={() => { setIsFormOpen(false); setEditingLead(null); }} 
        onSave={handleSaveLead}
        initialData={editingLead}
      />
    </div>
  );
}
