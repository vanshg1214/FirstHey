'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, Plus, MapPin, Users, LayoutDashboard, Search, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/Toast';

export default function ExhibitionsDashboard() {
  const [exhibitions, setExhibitions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { addToast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    start_date: '',
    end_date: '',
    description: ''
  });

  const fetchExhibitions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/exhibitions');
      if (!res.ok) throw new Error('Failed to fetch');
      const { data } = await res.json();
      setExhibitions(data || []);
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExhibitions();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/exhibitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!res.ok) throw new Error('Failed to create exhibition');
      
      addToast('success', 'Exhibition created successfully');
      setIsModalOpen(false);
      setFormData({ name: '', location: '', start_date: '', end_date: '', description: '' });
      fetchExhibitions();
    } catch (err: any) {
      addToast('error', err.message);
    }
  };

  const filtered = exhibitions.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (e.location || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white/60 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <Link href="/leads" className="flex items-center">
            <div className="w-36 h-7 flex items-center justify-start">
              <img src="/logo.png?v=2" alt="FirstHey Logo" className="w-full h-full object-contain object-left" />
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/leads"
              className="py-2 px-3 sm:py-2.5 sm:px-5 rounded-xl border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-bold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-all"
            >
              <LayoutDashboard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <button
              onClick={() => setIsModalOpen(true)}
              className="py-2 px-3 sm:py-2.5 sm:px-5 rounded-xl bg-slate-900 hover:bg-slate-800 font-bold text-xs sm:text-sm text-white flex items-center gap-1.5 sm:gap-2 shadow-lg transition-all"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Create <span className="hidden sm:inline">Exhibition</span></span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-8 space-y-8 z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <Calendar className="w-7 h-7 text-blue-600" />
              Exhibitions & Events
            </h1>
            <p className="text-sm text-slate-500 mt-2">Manage your events and group captured leads by exhibition.</p>
          </div>
          
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search exhibitions..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No Exhibitions Found</h3>
            <p className="text-slate-500 mt-1 mb-6">You haven't created any exhibitions yet.</p>
            <button onClick={() => setIsModalOpen(true)} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700">
              Create Your First Exhibition
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(ex => (
              <Link key={ex.id} href={`/exhibitions/${ex.id}`}>
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-blue-700 transition-colors">{ex.name}</h3>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-transform group-hover:translate-x-1" />
                  </div>
                  
                  <div className="space-y-2 mt-auto">
                    {ex.location && (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span>{ex.location}</span>
                      </div>
                    )}
                    {(ex.start_date || ex.end_date) && (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span>
                          {ex.start_date ? new Date(ex.start_date).toLocaleDateString() : '?'} - {ex.end_date ? new Date(ex.end_date).toLocaleDateString() : '?'}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                        <Users className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-slate-700">{ex.lead_count || 0} Leads</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">Create Exhibition</h2>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Exhibition Name *</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 focus:bg-white transition-all" placeholder="e.g. CES 2026" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Location *</label>
                <input required type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 focus:bg-white transition-all" placeholder="e.g. Las Vegas Convention Center" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date *</label>
                  <input required type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date *</label>
                  <input required type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm" />
                </div>
              </div>
              
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors shadow-lg">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
