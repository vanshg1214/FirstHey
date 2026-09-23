'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Users, Mail, Loader2, Calendar, MapPin, Send, Plus, Sparkles, UserPlus } from 'lucide-react';
import { useToast } from '@/components/Toast';
import LeadList from '@/components/LeadList';
import { getOrganizationSettings } from '@/lib/actions/settings';

export default function ExhibitionDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { addToast } = useToast();
  
  const [exhibition, setExhibition] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmailConfigured, setIsEmailConfigured] = useState(false);
  
  // Email Blast Modal State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailBlastStep, setEmailBlastStep] = useState<1 | 2>(1);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [emailFilterStatus, setEmailFilterStatus] = useState<string>('all');
  const [isSending, setIsSending] = useState(false);
  const [emailSubject, setEmailSubject] = useState('Nice meeting you at [Company]');
  const [emailBody, setEmailBody] = useState('Hi [Name],\n\nIt was great meeting you at our booth. I wanted to follow up and share some more information about our services.\n\nLet me know if you are available for a quick chat next week.\n\nBest,\n[Your Name]');
  const [blastContext, setBlastContext] = useState('');
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);

  // Add Leads Modal State
  const [isAddLeadsModalOpen, setIsAddLeadsModalOpen] = useState(false);
  const [selectedAddLeadIds, setSelectedAddLeadIds] = useState<Set<string>>(new Set());
  const [isAddingLeads, setIsAddingLeads] = useState(false);

  const availableLeadsToAdd = allLeads.filter(l => l.exhibition_id !== resolvedParams.id);

  const handleAddLeads = async () => {
    if (selectedAddLeadIds.size === 0) return;
    setIsAddingLeads(true);
    try {
      const res = await fetch(`/api/exhibitions/${resolvedParams.id}/add-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          leadIds: Array.from(selectedAddLeadIds),
          exhibitionName: exhibition?.name || null
        })
      });
      if (!res.ok) throw new Error('Failed to add leads');
      addToast('success', `Added ${selectedAddLeadIds.size} lead(s) to exhibition`);
      setIsAddLeadsModalOpen(false);
      setSelectedAddLeadIds(new Set());
      fetchData(); // Refresh list
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setIsAddingLeads(false);
    }
  };

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
      const leadsRes = await fetch(`/api/leads?status=all&t=${Date.now()}`, { cache: 'no-store' });
      if (!leadsRes.ok) throw new Error('Failed to load leads');
      const { data: leadsData } = await leadsRes.json();
      
      setAllLeads(leadsData || []);
      const exLeads = (leadsData || []).filter((l: any) => l.exhibition_id === resolvedParams.id);
      setLeads(exLeads);

      // 3. Check Email Settings
      const orgSettings = await getOrganizationSettings();
      if (orgSettings?.email_user && orgSettings?.email_password) {
        setIsEmailConfigured(true);
      } else {
        setIsEmailConfigured(false);
      }
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [resolvedParams.id]);

  const handleGenerateBlastTemplate = async () => {
    if (!blastContext) return;
    setIsGeneratingTemplate(true);
    try {
      const response = await fetch(`/api/exhibitions/${resolvedParams.id}/generate-blast-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customContext: blastContext }),
      });
      const result = await response.json();
      if (response.ok && result.draft) {
        setEmailSubject(result.draft.subject || '');
        setEmailBody(result.draft.emailBody || '');
      } else {
        addToast('error', 'Failed to generate template: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Template generation failed:', error);
      addToast('error', 'Network error while generating template.');
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  const handleSendEmails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    try {
      const res = await fetch(`/api/exhibitions/${resolvedParams.id}/email-blast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          subject: emailSubject, 
          body: emailBody, 
          leadIds: Array.from(selectedLeadIds) 
        })
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

  const eligibleLeads = leads.filter(l => {
    const hasEmail = Boolean(l.email || l.contact_fields?.email);
    if (!hasEmail) return false;
    if (emailFilterStatus !== 'all' && l.status !== emailFilterStatus) return false;
    return true;
  });

  const toggleSelectAll = () => {
    if (selectedLeadIds.size === eligibleLeads.length && eligibleLeads.length > 0) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(eligibleLeads.map(l => l.id)));
    }
  };

  const toggleLeadSelection = (id: string) => {
    const next = new Set(selectedLeadIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeadIds(next);
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
              onClick={() => {
                setSelectedAddLeadIds(new Set());
                setIsAddLeadsModalOpen(true);
              }}
              className="py-2 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Existing Lead
            </button>
            <button 
              onClick={() => {
                setIsEmailModalOpen(true);
                setEmailBlastStep(1);
                setSelectedLeadIds(new Set());
                setEmailFilterStatus('all');
              }}
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

      {/* Add Existing Leads Modal */}
      {isAddLeadsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Add Existing Leads</h2>
                <p className="text-xs text-slate-500 mt-1">Select leads to assign to {exhibition.name}</p>
              </div>
            </div>
            
            <div className="p-5 bg-slate-50/50">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm max-h-[400px] overflow-y-auto">
                {availableLeadsToAdd.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    No available leads to add. All leads are already in this exhibition.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    <div className="p-3 bg-slate-50 flex justify-between items-center text-xs font-bold text-slate-500 uppercase sticky top-0 bg-slate-50/90 backdrop-blur-sm border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedAddLeadIds.size > 0 && selectedAddLeadIds.size === availableLeadsToAdd.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAddLeadIds(new Set(availableLeadsToAdd.map(l => l.id)));
                            } else {
                              setSelectedAddLeadIds(new Set());
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Select All</span>
                      </div>
                      <span>{availableLeadsToAdd.length} Available</span>
                    </div>
                    {availableLeadsToAdd.map(lead => (
                      <label key={lead.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedAddLeadIds.has(lead.id)}
                          onChange={(e) => {
                            const newSet = new Set(selectedAddLeadIds);
                            if (e.target.checked) newSet.add(lead.id);
                            else newSet.delete(lead.id);
                            setSelectedAddLeadIds(newSet);
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 truncate">{lead.contact_fields?.name || lead.name || 'Unknown'}</p>
                          <p className="text-xs text-slate-500 truncate">{lead.contact_fields?.company || lead.company || 'No Company'}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-white">
              <button
                onClick={() => setIsAddLeadsModalOpen(false)}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddLeads}
                disabled={isAddingLeads || selectedAddLeadIds.size === 0}
                className="px-6 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2"
              >
                {isAddingLeads && <Loader2 className="w-4 h-4 animate-spin" />}
                Add {selectedAddLeadIds.size > 0 ? selectedAddLeadIds.size : ''} Leads
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Send Email Blast</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {emailBlastStep === 1 ? 'Step 1: Select leads to email' : `Step 2: Compose email for ${selectedLeadIds.size} leads`}
                </p>
              </div>
            </div>
            
            {emailBlastStep === 1 ? (
              <div className="p-5 space-y-4">
                {!isEmailConfigured && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                    <h3 className="text-orange-800 font-bold text-sm mb-1">Email Settings Required</h3>
                    <p className="text-orange-700 text-xs mb-3">You must configure your email address and app password before you can send an email blast.</p>
                    <Link href="/settings" className="inline-block px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors">
                      Go to Settings
                    </Link>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="selectAll"
                      checked={eligibleLeads.length > 0 && selectedLeadIds.size === eligibleLeads.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="selectAll" className="text-sm font-medium text-slate-700">Select All</label>
                  </div>
                  <select 
                    value={emailFilterStatus}
                    onChange={(e) => setEmailFilterStatus(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="new">New</option>
                    <option value="qualified">Qualified</option>
                    <option value="contacted">Contacted</option>
                  </select>
                </div>
                
                <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl">
                  {eligibleLeads.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">No leads match this filter.</div>
                  ) : (
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 font-semibold text-slate-600 text-xs">Select</th>
                          <th className="px-4 py-2 font-semibold text-slate-600 text-xs">Name</th>
                          <th className="px-4 py-2 font-semibold text-slate-600 text-xs">Email</th>
                          <th className="px-4 py-2 font-semibold text-slate-600 text-xs">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {eligibleLeads.map(l => (
                          <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2">
                              <input 
                                type="checkbox"
                                checked={selectedLeadIds.has(l.id)}
                                onChange={() => toggleLeadSelection(l.id)}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-4 py-2 font-medium text-slate-900">{l.name || l.contact_fields?.name || '-'}</td>
                            <td className="px-4 py-2 text-slate-500 text-xs">{l.email || l.contact_fields?.email || '-'}</td>
                            <td className="px-4 py-2"><span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase font-bold">{l.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                
                <div className="pt-3 flex gap-2">
                  <button type="button" onClick={() => setIsEmailModalOpen(false)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors text-sm">Cancel</button>
                  <button 
                    type="button" 
                    onClick={() => setEmailBlastStep(2)} 
                    disabled={selectedLeadIds.size === 0 || !isEmailConfigured} 
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg transition-colors shadow-lg flex items-center justify-center gap-1.5 text-sm"
                  >
                    Next ({selectedLeadIds.size} Selected)
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendEmails} className="p-5 space-y-4">
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 space-y-2 mb-2">
                  <label className="text-[10px] font-bold text-indigo-500 uppercase flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    AI Template Assistant
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Tell them about our new product line"
                      value={blastContext}
                      onChange={e => setBlastContext(e.target.value)}
                      className="flex-1 bg-white border border-indigo-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500 transition-colors"
                    />
                    <button 
                      type="button"
                      onClick={handleGenerateBlastTemplate} 
                      disabled={isGeneratingTemplate || !blastContext}
                      className="text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded-lg shadow-sm flex items-center justify-center min-w-[70px] disabled:opacity-50"
                    >
                      {isGeneratingTemplate ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Generate'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Subject Line</label>
                  <input required type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:bg-white transition-all font-medium text-slate-900 text-sm" />
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email Body (Use [Name] and [Company] tags)</label>
                  <textarea required value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={6} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:bg-white transition-all font-medium text-slate-700 leading-relaxed text-sm"></textarea>
                </div>
                
                <div className="pt-3 flex gap-2">
                  <button type="button" onClick={() => setEmailBlastStep(1)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors text-sm">Back</button>
                  <button type="submit" disabled={isSending} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg transition-colors shadow-lg flex items-center justify-center gap-1.5 text-sm">
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {isSending ? 'Sending...' : `Send ${selectedLeadIds.size} Emails`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
