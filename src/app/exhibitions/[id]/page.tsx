'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Users, Mail, Loader2, Calendar, MapPin, Send, Plus } from 'lucide-react';
import { useToast } from '@/components/Toast';
import LeadList from '@/components/LeadList';

export default function ExhibitionDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { addToast } = useToast();
  
  const [exhibition, setExhibition] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Email Blast Modal State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [emailSubject, setEmailSubject] = useState('Nice meeting you at [Company]');
  const [emailBody, setEmailBody] = useState('Hi [Name],\n\nIt was great meeting you at our booth. I wanted to follow up and share some more information about our services.\n\nLet me know if you are available for a quick chat next week.\n\nBest,\n[Your Name]');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Exhibition Details
      const exRes = await fetch(`/api/exhibitions/${resolvedParams.id}`);
      if (!exRes.ok) throw new Error('Failed to load exhibition');
      const { data: exData } = await exRes.json();
      setExhibition(exData);

      // 2. Fetch Leads for this exhibition
      // We can use the existing leads API but filter by exhibition client-side for now, 
      // or we just fetch all and filter since there's no native exhibition_id filter in GET /api/leads yet.
      const leadsRes = await fetch('/api/leads?status=all');
      if (!leadsRes.ok) throw new Error('Failed to load leads');
      const { data: leadsData } = await leadsRes.json();
      
      const exLeads = (leadsData || []).filter((l: any) => l.exhibition_id === resolvedParams.id);
      setLeads(exLeads);
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [resolvedParams.id]);

  const handleSendEmails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    try {
      const res = await fetch(`/api/exhibitions/${resolvedParams.id}/email-blast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: emailSubject, body: emailBody })
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || result.message || 'Failed to send emails');
      
      if (result.success) {
        addToast('success', `Sent ${result.sentCount} emails!`, `Failed: ${result.failedCount}`);
        setIsEmailModalOpen(false);
        fetchData(); // refresh leads to show new 'contacted' statuses
      } else {
        addToast('error', result.message || 'Unknown error occurred');
      }
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setIsSending(false);
    }
  };

  const uncontactedCount = leads.filter(l => l.status !== 'contacted' && (l.email || l.contact_fields?.email)).length;

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (!exhibition) {
    return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50"><h2>Exhibition Not Found</h2><Link href="/exhibitions" className="mt-4 text-blue-600 hover:underline">Go Back</Link></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/exhibitions" className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-slate-900">{exhibition.name}</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Link 
              href={`/capture?exhibition_id=${exhibition.id}`}
              className="py-2 px-3 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Capture Lead Here
            </Link>
            <button 
              onClick={() => setIsEmailModalOpen(true)}
              className="py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/20"
            >
              <Mail className="w-3.5 h-3.5" />
              Email Blast
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-8 space-y-8">
        
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center"><Users className="w-5 h-5" /></div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Total Leads</p>
              <p className="text-2xl font-black text-slate-900">{leads.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><Mail className="w-5 h-5" /></div>
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Ready to Email</p>
              <p className="text-2xl font-black text-slate-900">{uncontactedCount}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center">
            {exhibition.location && (
              <div className="flex items-center gap-2 text-slate-600 mb-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{exhibition.location}</span>
              </div>
            )}
            {(exhibition.start_date || exhibition.end_date) && (
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">
                  {exhibition.start_date ? new Date(exhibition.start_date).toLocaleDateString() : '?'} - {exhibition.end_date ? new Date(exhibition.end_date).toLocaleDateString() : '?'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Leads List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5">
          <h2 className="text-base font-bold text-slate-900 mb-4">Captured Leads</h2>
          {leads.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No leads captured for this exhibition yet.</p>
              <Link href={`/capture?exhibition_id=${exhibition.id}`} className="text-blue-600 font-bold mt-2 inline-block hover:underline">
                Capture the first lead
              </Link>
            </div>
          ) : (
            <LeadList leads={leads} onSelectLead={() => {}} />
          )}
        </div>
      </main>

      {/* Email Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Send Email Blast</h2>
                <p className="text-xs text-slate-500 mt-1">This will send an email to {uncontactedCount} uncontacted leads.</p>
              </div>
            </div>
            <form onSubmit={handleSendEmails} className="p-5 space-y-4">
              
              {uncontactedCount === 0 && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 text-xs font-medium">
                  There are no uncontacted leads with valid email addresses in this exhibition.
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Subject Line</label>
                <input required type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:bg-white transition-all font-medium text-slate-900 text-sm" />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email Body (Use [Name] and [Company] tags)</label>
                <textarea required value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={6} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:bg-white transition-all font-medium text-slate-700 leading-relaxed text-sm"></textarea>
              </div>
              
              <div className="pt-3 flex gap-2">
                <button type="button" onClick={() => setIsEmailModalOpen(false)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors text-sm">Cancel</button>
                <button type="submit" disabled={isSending || uncontactedCount === 0} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg transition-colors shadow-lg flex items-center justify-center gap-1.5 text-sm">
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {isSending ? 'Sending...' : `Send ${uncontactedCount} Emails`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
