'use client';

import React, { useState, useEffect } from 'react';
import RecordButton from '@/components/RecordButton';
import CardScanner from '@/components/CardScanner';
import BulkCardScanner from '@/components/BulkCardScanner';
import NotesScanner from '@/components/NotesScanner';
import ExtractedFieldsForm from '@/components/ExtractedFieldsForm';
import FollowupDraftEditor from '@/components/FollowupDraftEditor';
import { Camera, Upload, Mic, Keyboard, Check, Loader2, ArrowRight, Zap, X, Image as ImageIcon, Briefcase, FileText, Globe, LogOut, FilePlus2, Layers, AlertCircle, RefreshCw, Smartphone, Mail, ChevronLeft, ChevronRight, Sparkles, CheckCircle2, User, ShieldCheck, Play, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { OfflineStorage } from '@/lib/services/offline';
import { DynamicLoader } from '@/components/DynamicLoader';

interface ExtractedContact {
  name: string | null;
  company: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  secondary_phone: string | null;
  confidence: number;
  image?: string;
}

function CaptureDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();


  const [mode, setMode] = useState<'card_choice' | 'voice' | 'card' | 'notes' | 'bulk' | 'review'>('card_choice');

  const [leadId, setLeadId] = useState<string | null>(null);
  
  // Event Tracking States
  const [exhibitionId, setExhibitionId] = useState<string>('');
  const [exhibitionsList, setExhibitionsList] = useState<any[]>([]);
  const [exhibition, setExhibition] = useState<string>('');
  const [stall, setStall] = useState<string>('');

  useEffect(() => {
    // Check if exhibition_id is passed in URL
    const urlExhibitionId = searchParams.get('exhibition_id');
    if (urlExhibitionId) {
      setExhibitionId(urlExhibitionId);
    }
    
    // Fetch all exhibitions for the dropdown
    fetch(`/api/exhibitions?t=${Date.now()}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(res => {
        if (res.data) setExhibitionsList(res.data);
      })
      .catch(err => console.error('Failed to fetch exhibitions', err));
  }, [searchParams]);

  // Sync exhibition name when ID changes (for backward compatibility if needed)
  useEffect(() => {
    if (exhibitionId && exhibitionsList.length > 0) {
      const ex = exhibitionsList.find(e => e.id === exhibitionId);
      if (ex) setExhibition(ex.name);
    }
  }, [exhibitionId, exhibitionsList]);
  
  // Processing States
  const [audioProcessing, setAudioProcessing] = useState(false);
  const [notesProcessing, setNotesProcessing] = useState(false);
  const [cardProcessing, setCardProcessing] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Data States
  const [transcript, setTranscript] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [context, setContext] = useState<any>(null);
  const [extractedFields, setExtractedFields] = useState<ExtractedContact | null>(null);
  const [bulkExtractedData, setBulkExtractedData] = useState<(ExtractedContact | null)[]>([]);
  const [emailDraft, setEmailDraft] = useState<{ subject: string; emailBody: string; whatsappBody: string } | null>(null);
  
  // Offline caching states
  const [offlineAudioBase64, setOfflineAudioBase64] = useState<string | null>(null);
  const [audioBlobType, setAudioBlobType] = useState<string | null>(null);
  
  const [syncSystem, setSyncSystem] = useState<'zoho' | 'sheets' | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const handleExit = () => {
    if (exhibitionId) {
      router.push(`/exhibitions/${exhibitionId}`);
    } else {
      router.push('/leads');
    }
  };

  // Bulk Processing States
  const [verificationQueue, setVerificationQueue] = useState<string[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);
  const [isBulkAutoSaving, setIsBulkAutoSaving] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ processed: 0, total: 0, successes: 0, failures: 0 });

  // Modals
  const [showFieldsModal, setShowFieldsModal] = useState(false);

  const mockOrganizationId = process.env.NEXT_PUBLIC_ORGANIZATION_ID || '738de77c-ddd0-4a71-9d8d-3e346590ca0d';

  // Initialize DB if not already initialized
  const ensureLeadId = async () => {
    if (leadId) return leadId;
    try {
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      const response = await fetch('/api/leads/recording/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          organizationId: mockOrganizationId, 
          userId: user?.id || null
        }),
      });
      const result = await response.json();
      if (response.ok && result.data?.leadId) {
        setLeadId(result.data.leadId);
        return result.data.leadId;
      }
    } catch (e) {
      console.warn('DB initialization bypassed:', e);
    }
    return null;
  };

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setAudioProcessing(true);
    setAudioUrl(URL.createObjectURL(audioBlob));
    setAudioBlobType(audioBlob.type);
    
    // If offline, cache recording locally as base64 data-URI
    if (typeof window !== 'undefined' && !navigator.onLine) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });
        setOfflineAudioBase64(base64);
        setTranscript('[Audio conversation recorded offline - Cloud sync pending for AI analysis]');
        setContext({
          problem: 'Pending sync',
          needs: 'Pending sync',
          action_items: ['Sync to cloud when online'],
          sentiment: 'neutral'
        });
      } catch (err) {
        console.error('Failed to convert offline audio to base64:', err);
      } finally {
        setAudioProcessing(false);
        setMode('review');
      }
      return;
    }

    const activeLeadId = await ensureLeadId();
    
    const formData = new FormData();
    formData.append('audio', audioBlob);
    if (activeLeadId) formData.append('leadId', activeLeadId);
    formData.append('organizationId', mockOrganizationId);

    try {
      const response = await fetch('/api/leads/recording/stop', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        if (result.data) {
          setTranscript(result.data.transcript);
          setContext(result.data.context);
          if (result.data.leadId && !leadId) setLeadId(result.data.leadId);
        }
      }
    } catch (e) {
      console.error('Audio processing failed:', e);
    } finally {
      setAudioProcessing(false);
      setMode('review');
    }
  };

  const handleNotesScanComplete = async (data: any) => {
    // If offline, bypass for now or just set state
    if (typeof window !== 'undefined' && !navigator.onLine) {
      setContext(data);
    } else {
      await ensureLeadId();
      setContext(data);
    }
    // Advance to voice step
    setMode('voice');
  };

  const handleScanComplete = async (data: any) => {
    // If offline, bypass ensureLeadId since we can't initialize it in the DB yet
    if (typeof window !== 'undefined' && !navigator.onLine) {
      setExtractedFields(data);
      setShowFieldsModal(true);
      return;
    }
    const activeLeadId = await ensureLeadId();
    setExtractedFields(data);
    setShowFieldsModal(true);
  };

  const handleBulkImagesSelected = (images: string[]) => {
    setVerificationQueue(images);
    setQueueIndex(-1); // Waiting for user choice
  };

  const startManualReview = async () => {
    setCardProcessing(true);
    try {
      const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
      const results = [];
      for (let i = 0; i < verificationQueue.length; i++) {
        const base64 = verificationQueue[i];
        try {
          const response = await fetch('/api/leads/card-scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64 }),
          });
          if (response.ok) {
            const result = await response.json();
            results.push({ ...result.data, image: base64 });
            
            // Add a polite 2-second delay between requests to avoid rate limiting
            if (i < verificationQueue.length - 1) {
              await delay(2000);
            }
            continue;
          }
        } catch (e) {
          console.warn('Batch OCR extraction error', e);
        }
        results.push({ name: '', company: '', title: '', email: '', phone: '', secondary_phone: '', confidence: 0, image: base64 });
      }
      setBulkExtractedData(results);
      setExtractedFields(results[0]);
      setQueueIndex(0);
    } finally {
      setCardProcessing(false);
    }
  };

  const processCardForManualReview = async (index: number) => {
    if (index >= verificationQueue.length) {
      handleExit();
      return;
    }
    setCardProcessing(true);
    setExtractedFields(null);
    setLeadId(null);
    try {
      const activeLeadId = await ensureLeadId();
      const response = await fetch('/api/leads/card-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: verificationQueue[index] }),
      });
      if (response.ok) {
        const result = await response.json();
        setExtractedFields({ ...result.data, image: verificationQueue[index] });
        if (mode !== 'bulk') {
          setShowFieldsModal(true);
        }
      } else {
        console.warn('OCR failed, falling back to manual entry');
        setExtractedFields({ name: '', company: '', title: '', email: '', phone: '', secondary_phone: '', confidence: 0, image: verificationQueue[index] });
        if (mode !== 'bulk') {
          setShowFieldsModal(true);
        }
      }
    } catch (e) {
      console.error('Manual card processing failed:', e);
      setExtractedFields({ name: '', company: '', title: '', email: '', phone: '', secondary_phone: '', confidence: 0, image: verificationQueue[index] });
      if (mode !== 'bulk') {
        setShowFieldsModal(true);
      }
    } finally {
      setCardProcessing(false);
    }
  };

  const handleBulkNextCard = async (confirmedFields: ExtractedContact) => {
    setCardProcessing(true);
    try {
      // 1. Initialize the new lead in the database
      const createRes = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'bulk-card-scan',
          status: 'hot',
        })
      });
      
      const createData = await createRes.json();
      const newLeadId = createData.data?.id;

      if (newLeadId) {
        // 2. Upload the card image and save the confirmed contact fields
        await fetch(`/api/leads/${newLeadId}/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactFields: confirmedFields,
            cardImage: verificationQueue[queueIndex],
            source: 'card_scan',
            exhibition: exhibition || null,
            exhibition_id: exhibitionId || null,
            stall: stall || null,
          })
        });
      }

      const nextIndex = queueIndex + 1;
      if (nextIndex >= verificationQueue.length) {
        // Finished all cards
        handleExit();
        return;
      }
      
      setQueueIndex(nextIndex);
      // Instantly load next card from batch memory
      setExtractedFields(bulkExtractedData[nextIndex]);
    } catch (e) {
      console.error('Error processing next card', e);
    } finally {
      setCardProcessing(false);
    }
  };

  const handleNextInQueue = () => {
    setShowFieldsModal(false);
    const nextIndex = queueIndex + 1;
    setQueueIndex(nextIndex);
    // Note: handleNextInQueue is legacy for the old single-card flow.
    // If needed, it would process the next card here.
  };

  const startAutoSaveAll = async () => {
    setIsBulkAutoSaving(true);
    setBulkProgress({ processed: 0, total: verificationQueue.length, successes: 0, failures: 0 });
    
    let currentUserId = null;
    try {
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      currentUserId = user?.id || null;
    } catch (e) {
      console.warn('Could not fetch user ID for bulk save:', e);
    }

    for (let i = 0; i < verificationQueue.length; i++) {
      try {
        const base64 = verificationQueue[i];
        
        const scanRes = await fetch('/api/leads/card-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 }),
        });
        if (!scanRes.ok) throw new Error('OCR Failed');
        const scanResult = await scanRes.json();
        const extracted = scanResult.data;

        const initRes = await fetch('/api/leads/recording/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            organizationId: mockOrganizationId, 
            userId: currentUserId
          }),
        });
        if (!initRes.ok) throw new Error('Init Failed');
        const initResult = await initRes.json();
        const newLeadId = initResult.data.leadId;

        const saveRes = await fetch(`/api/leads/${newLeadId}/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contactFields: extracted,
            cardImage: base64,
            confidence: typeof extracted.confidence === 'number' ? (extracted.confidence / 100) : 1.0,
            exhibition: exhibition || null,
            stall: stall || null
          }),
        });
        if (!saveRes.ok) throw new Error('Save Failed');

        setBulkProgress(prev => ({ ...prev, processed: prev.processed + 1, successes: prev.successes + 1 }));
      } catch (err) {
        console.error('Auto-save failed for card', i, err);
        setBulkProgress(prev => ({ ...prev, processed: prev.processed + 1, failures: prev.failures + 1 }));
      }
    }
    
    setTimeout(() => {
      handleExit();
    }, 1500);
  };

  const handleConfirmFields = async (confirmedFields: ExtractedContact) => {
    setExtractedFields(confirmedFields);
    setShowFieldsModal(false);
    // Advance to notes step
    setMode('notes');
  };

  const handleGenerateDraft = async () => {
    setIsDrafting(true);
    try {
      let activeLeadId = leadId;
      if (!activeLeadId) {
        activeLeadId = await ensureLeadId();
      }

      if (!activeLeadId) throw new Error("Could not initialize lead ID");

      const response = await fetch(`/api/leads/${activeLeadId}/confirm-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactFields: extractedFields || {},
          senderName: 'Sales Exec',
        }),
      });

      const result = await response.json();
      if (response.ok && result.data?.draft) {
        setEmailDraft(result.data.draft);
      } else {
        setEmailDraft({
          subject: `Following up from our conversation at ${extractedFields?.company || 'the exhibition'}`,
          emailBody: `Hi ${extractedFields?.name || 'there'},\n\nIt was great speaking with you today. Let's connect next week.\n\nBest,\nSales Exec`,
          whatsappBody: `Hi ${extractedFields?.name || 'there'}, it was great speaking with you today!`,
        });
      }
    } catch (e) {
      console.error('Draft generation failed:', e);
    } finally {
      setIsDrafting(false);
    }
  };

  const handleSaveDraft = async () => {
    // If offline, save lead structure to local offline queue and redirect
    if (typeof window !== 'undefined' && !navigator.onLine && extractedFields) {
      setIsSaving(true);
      setSaveError(null);
      try {
        OfflineStorage.enqueue({
          contactFields: {
            name: extractedFields.name,
            company: extractedFields.company,
            title: extractedFields.title,
            email: extractedFields.email,
            phone: extractedFields.phone,
          },
          audioBase64: offlineAudioBase64,
          audioMimeType: audioBlobType,
          cardImageBase64: extractedFields.image || null,
          exhibition: exhibition || null,
          exhibition_id: exhibitionId || null,
          stall: stall || null,
        });
        
        handleExit();
      } catch (err) {
        console.error('Failed to save lead offline:', err);
        setSaveError('Failed to cache lead locally. Browser storage might be full.');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    let activeLeadId = leadId;
    if (!activeLeadId) {
      activeLeadId = await ensureLeadId();
    }

    if (activeLeadId) {
      setIsSaving(true);
      setSaveError(null);
      try {
        const res = await fetch(`/api/leads/${activeLeadId}/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contactFields: extractedFields || {},
            cardImage: extractedFields?.image || null,
            confidence: typeof extractedFields?.confidence === 'number' 
              ? (extractedFields.confidence / 100) 
              : 1.0,
            exhibition: exhibition || null,
            stall: stall || null
          }),
        });
        if (!res.ok) throw new Error('Failed to save to database');
        
        if (verificationQueue.length > 0 && queueIndex >= 0) {
          handleNextInQueue();
        } else {
          router.refresh(); // Clear Next.js router cache to show new lead instantly
          handleExit();
        }
      } catch (e: any) {
        console.error('Failed to save draft:', e);
        setSaveError('Failed to save. Please check your connection and try again.');
      } finally {
        setIsSaving(false);
      }
    } else {
      handleExit();
    }
  };

  const handleFollowupSuccess = (system: 'zoho' | 'sheets' | 'direct') => {
    setSyncSystem(system === 'direct' ? 'sheets' : system);
    setIsComplete(true);
    setEmailDraft(null);
  };

  const handleReset = () => {
    setLeadId(null);
    setTranscript('');
    setAudioUrl(null);
    setContext(null);
    setExtractedFields(null);
    setEmailDraft(null);
    setIsComplete(false);
    setSyncSystem(null);
    setMode('card_choice');
  };

  // We only show the Generate Draft button if we have contact fields (since we need an email to send to).
  // The transcript is optional (can send a generic intro just from a card).
  const canGenerateDraft = extractedFields !== null;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col p-4 md:p-8 font-sans relative overflow-hidden">
      {/* Premium Background Elements */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-emerald-600/5 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Premium Header */}
      <header className="w-full max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between py-4 z-10 gap-4 md:gap-6">
        <Link 
          href="/leads" 
          className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          Back to Dashboard
        </Link>
        
        <div className="flex items-center justify-between w-full md:w-auto gap-1 bg-white/80 backdrop-blur-md border border-slate-200 p-1 rounded-xl shadow-sm">
          {[
            { id: 'card_choice', label: '1. Card', shortLabel: 'Card', icon: '💳', match: ['card_choice', 'card', 'bulk'] },
            { id: 'notes', label: '2. Notes', shortLabel: 'Notes', icon: '📝', match: ['notes'] },
            { id: 'voice', label: '3. Voice', shortLabel: 'Voice', icon: '🎙️', match: ['voice'] },
            { id: 'review', label: '4. Review', shortLabel: 'Review', icon: '✨', match: ['review'] }
          ].map((step) => {
            const isActive = step.match.includes(mode);
            return (
              <button
                key={step.id}
                onClick={() => setMode(step.id as any)}
                className={`flex flex-col sm:flex-row items-center justify-center flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-lg transition-all duration-300 gap-1 sm:gap-1.5 ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-md transform sm:scale-[1.02]' 
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span className="text-base sm:text-sm leading-none">{step.icon}</span>
                <span className="text-[9px] sm:text-[10px] font-bold leading-none hidden sm:inline">{step.label}</span>
                <span className="text-[9px] sm:text-[10px] font-bold leading-none sm:hidden">{step.shortLabel}</span>
              </button>
            );
          })}
        </div>
          
        <div className="hidden md:flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[10px] font-bold tracking-widest text-slate-600 uppercase">Live Workspace</span>
        </div>
      </header>

      {/* Exhibition Selector */}
      <div className="w-full max-w-6xl mx-auto mb-4 flex justify-center md:justify-end z-10 relative">
        <div className="bg-white border border-slate-200 rounded-lg p-1.5 shadow-sm flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-2">Active Event:</span>
          <select
            value={exhibitionId}
            onChange={(e) => setExhibitionId(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-md focus:ring-blue-500 focus:border-blue-500 block p-1.5 outline-none min-w-[200px] cursor-pointer hover:border-blue-300 transition-colors"
          >
            <option value="">-- Select Exhibition (Optional) --</option>
            {exhibitionsList.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.name}</option>
            ))}
          </select>
        </div>
      </div>

      {isComplete ? (
        <div className="flex-1 w-full max-w-lg mx-auto flex flex-col items-center justify-center z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="bg-white border border-slate-200 rounded-3xl w-full text-center space-y-6 shadow-xl p-10 border-t-4 border-t-emerald-500 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-emerald-50 opacity-30 pointer-events-none"></div>
            <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner relative z-10">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <div className="space-y-3 relative z-10">
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Lead Captured!</h3>
              <p className="text-base text-slate-500 leading-relaxed px-4">
                Profile synced to <span className="text-emerald-600 font-bold">{syncSystem === 'zoho' ? 'Zoho CRM' : 'Google Sheets'}</span> and the personalized intro email is on its way.
              </p>
            </div>
            <button
              onClick={handleReset}
              className="w-full mt-6 py-4 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-bold text-sm transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 relative z-10"
            >
              Capture Next Lead
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <main className="flex-1 w-full max-w-[1800px] px-8 mx-auto z-10 flex flex-col justify-center gap-8 py-8 md:py-12">
          
          {/* Main Content Area - Beautiful Center Layout */}
          <div className="flex flex-col items-center justify-center w-full min-h-[400px]">
            {/* WIZARD STEPS */}
            {(mode !== 'review' && mode !== 'bulk') && (
              <div className="w-full max-w-xl animate-in fade-in zoom-in-95 duration-500">
                {mode === 'card_choice' && (
                  <div className="bg-white border border-slate-200 shadow-xl rounded-3xl p-6 md:p-10 text-center space-y-6 flex flex-col items-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-2 shadow-inner">
                      <Sparkles className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mb-2">
                        Step 1: Capture Contact Info
                      </h2>
                      <p className="text-sm text-slate-500">
                        Scan a business card to instantly extract the contact details.
                      </p>
                    </div>
                    <div className="w-full max-w-sm mx-auto flex flex-col gap-3">
                      <button onClick={() => setMode('card')} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 text-sm rounded-xl shadow-lg transition-all">
                        Scan Single Card
                      </button>
                      <button onClick={() => setMode('bulk')} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-3 text-sm rounded-xl border border-slate-200 transition-all">
                        Bulk Scan Multiple Cards
                      </button>
                    </div>
                    <button onClick={() => setMode('notes')} className="text-[11px] font-bold text-slate-400 hover:text-slate-600 mt-2 underline decoration-slate-300 underline-offset-4 transition-colors">
                      Skip for now, add notes later &rarr;
                    </button>
                  </div>
                )}

                {(mode === 'voice' || mode === 'notes') && (
                  <div className="bg-white border border-slate-200 shadow-xl rounded-3xl p-8 md:p-12 text-center space-y-8 flex flex-col items-center">
                    <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-2 shadow-inner">
                      <Sparkles className="w-10 h-10" />
                    </div>
                    <div>
                      <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-3">
                        {mode === 'voice' ? 'Step 3: Record Conversation' : 'Step 2: Scan Meeting Notes'}
                      </h2>
                      {audioProcessing || notesProcessing ? (
                        <p className="mt-4 font-medium text-slate-700 animate-pulse">
                          {extractedFields?.company ? "Researching company and drafting email..." : "Generating AI draft..."}
                        </p>
                      ) : (
                        <p className="text-slate-500">
                          {mode === 'voice' 
                            ? 'Tap the microphone below and let the AI extract contact details and meeting context automatically.'
                            : 'Upload a photo of your handwritten notes or business card scribbles.'}
                        </p>
                      )}
                    </div>
                    <div className="w-full max-w-sm mx-auto">
                      {mode === 'voice' && <RecordButton onRecordingComplete={handleRecordingComplete} isProcessing={audioProcessing} />}
                      {mode === 'notes' && <NotesScanner onScanComplete={handleNotesScanComplete} isProcessing={notesProcessing} leadId={leadId} />}
                    </div>
                    <button 
                      onClick={() => setMode(mode === 'notes' ? 'voice' : 'review')} 
                      className="text-sm font-bold text-slate-400 hover:text-slate-600 mt-8 underline decoration-slate-300 underline-offset-4 transition-colors"
                    >
                      {mode === 'notes' ? 'Skip & proceed to Voice Recording \u2192' : 'Skip & Review \u2192'}
                    </button>
                  </div>
                )}
                
                {mode === 'card' && (
                  <div className="bg-white border border-slate-200 shadow-xl rounded-3xl overflow-hidden">
                    <CardScanner onScanComplete={handleScanComplete} isProcessing={cardProcessing} />
                  </div>
                )}
              </div>
            )}

            {mode === 'bulk' && (
              <div className="w-full max-w-xl animate-in fade-in zoom-in-95 duration-500">
                <div className="bg-white border border-slate-200 shadow-xl rounded-3xl overflow-hidden">
                  <BulkCardScanner onImagesSelected={handleBulkImagesSelected} isProcessing={false} />
                </div>
              </div>
            )}

            {/* BULK PROCESSING STATE */}
            {mode === 'bulk' && verificationQueue.length > 0 && (
              <div className="w-full max-w-xl animate-in fade-in zoom-in-95 duration-500">
                <div className="flex flex-col gap-6 mt-6">
                  <div className="space-y-6">
                    {isBulkAutoSaving ? (
                      <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-8 text-center space-y-4">
                        <DynamicLoader 
                          messages={["Extracting card data...", "Saving to CRM...", "Almost done..."]} 
                          className="py-4"
                        />
                        <h3 className="text-xl font-bold text-slate-900 mt-4">Auto-Saving Leads</h3>
                        <p className="text-slate-500">Processing {bulkProgress.processed} of {bulkProgress.total} cards...</p>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 mt-4 overflow-hidden">
                          <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${(bulkProgress.processed / bulkProgress.total) * 100}%` }}></div>
                        </div>
                        <div className="flex justify-center gap-4 mt-4 font-semibold text-sm">
                          <span className="text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">{bulkProgress.successes} Success</span>
                          <span className="text-red-600 bg-red-50 px-3 py-1 rounded-full">{bulkProgress.failures} Failed</span>
                        </div>
                      </div>
                    ) : queueIndex === -1 ? (
                      <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-8 text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mx-auto shadow-inner">
                          <Sparkles className="w-10 h-10 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">{verificationQueue.length} Cards Captured</h3>
                          <p className="text-slate-500 font-medium">How would you like to process these cards?</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                          <button onClick={startManualReview} className="bg-white hover:bg-slate-50 text-slate-900 p-4 rounded-xl font-bold transition-all border-2 border-slate-200 hover:border-slate-300">
                            Review Manually
                          </button>
                          <button onClick={startAutoSaveAll} className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl font-bold transition-all shadow-md shadow-blue-600/20">
                            Auto-save All
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full max-w-[1800px] mx-auto animate-in fade-in zoom-in-95 duration-500">
                        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative">
                          <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
                              <Layers className="w-6 h-6 text-blue-600" />
                              Manual Verification
                            </h3>
                            <div className="bg-slate-100 text-slate-600 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
                              Card {queueIndex + 1} of {verificationQueue.length}
                            </div>
                          </div>
                          
                          {cardProcessing ? (
                            <div className="py-24 text-center">
                              <DynamicLoader 
                                messages={queueIndex === -1 ? ["Extracting details from cards...", "Running OCR..."] : ["Saving details...", "Securing data..."]} 
                                className="py-4"
                              />
                            </div>
                          ) : extractedFields ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2 flex items-center justify-center sticky top-6">
                                <img src={verificationQueue[queueIndex]} className="max-w-full w-full rounded-xl object-contain max-h-[600px] shadow-sm" alt="Business Card" />
                              </div>
                              <div className="h-full">
                                <ExtractedFieldsForm
                                  initialFields={extractedFields}
                                  onConfirm={handleBulkNextCard}
                                  onCancel={handleExit}
                                  submitLabel={queueIndex === verificationQueue.length - 1 ? "Save & Finish" : "Save & Next Card"}
                                  cancelLabel="Exit Review"
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* REVIEW MODE (FINAL STEP) */}
            {mode === 'review' && (context || extractedFields) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full animate-in fade-in slide-in-from-bottom-8 duration-500">
                {/* LEFT COLUMN: Context */}
                <div className="flex flex-col gap-6">
                  {context ? (
                    <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 md:p-8 flex-1 relative overflow-hidden group hover:border-blue-200 transition-colors">
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 rounded-l-3xl"></div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-blue-600" /> Meeting Context
                      </h4>
                      <div className="space-y-6">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Stated Need</span>
                          <p className="text-base text-slate-800 leading-relaxed font-medium">{context.needs || 'No specific needs stated.'}</p>
                        </div>
                        {context.notable_quotes?.length > 0 && (
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Key Quote</span>
                            <p className="text-lg text-slate-600 italic border-l-4 border-blue-200 pl-4 bg-blue-50/50 py-3 rounded-r-xl">"{context.notable_quotes[0]}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 border-dashed rounded-3xl p-6 md:p-8 flex-1 flex flex-col items-center justify-center text-center text-slate-400">
                      <p className="text-sm font-medium">No notes or voice recorded</p>
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN: Contact Profile */}
                <div className="flex flex-col gap-6">
                  {extractedFields ? (
                    <div 
                      className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 md:p-8 flex-1 relative group cursor-pointer hover:border-teal-200 hover:shadow-md transition-all" 
                      onClick={() => setShowFieldsModal(true)}
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-teal-500 rounded-l-3xl"></div>
                      <div className="absolute top-4 right-4 text-[10px] uppercase font-bold text-teal-600 bg-teal-50 px-3 py-1 rounded-full border border-teal-200 opacity-0 group-hover:opacity-100 transition-opacity">Edit Profile</div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <User className="w-4 h-4 text-teal-600" /> Contact Profile
                      </h4>
                      <div className="space-y-6">
                        <div>
                          <h2 className="text-3xl font-black text-slate-900 tracking-tight">{extractedFields.name || 'Unknown Name'}</h2>
                          <p className="text-base font-medium text-teal-600 mt-1">{extractedFields.title} <span className="text-slate-400 mx-1">at</span> {extractedFields.company}</p>
                        </div>
                        <div className="pt-6 border-t border-slate-100 space-y-3">
                          <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email</span> 
                            <span className="text-sm font-semibold text-slate-700">{extractedFields.email || '--'}</span>
                          </div>
                          <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phone</span> 
                            <span className="text-sm font-semibold text-slate-700">{extractedFields.phone || '--'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 border-dashed rounded-3xl p-6 md:p-8 flex-1 flex flex-col items-center justify-center text-center text-slate-400">
                      <p className="text-sm font-medium">No contact card scanned</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Floating Action Bar */}
          {(canGenerateDraft || leadId) && (
            <div className="sticky bottom-6 mt-auto max-w-2xl mx-auto w-full animate-in slide-in-from-bottom-12 duration-700 flex flex-col gap-3">
              {saveError && (
                <div className="w-full p-3 bg-red-950/80 border border-red-500/50 text-red-300 rounded-xl text-sm flex items-center justify-center gap-2 backdrop-blur-md shadow-2xl">
                  <AlertCircle className="w-4 h-4" />
                  {saveError}
                </div>
              )}
              {canGenerateDraft && (
                <button
                  onClick={handleGenerateDraft}
                  disabled={isDrafting}
                  className="w-full py-5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg shadow-2xl transition-all duration-300 flex items-center justify-center gap-3 shadow-sm hover:scale-[1.01] border border-slate-700"
                >
                  {isDrafting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Drafting Personalized Email...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-6 h-6" />
                      Review & Send Follow-up
                    </>
                  )}
                </button>
              )}
              
              <button
                onClick={handleSaveDraft}
                disabled={isSaving}
                className="w-full py-4 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSaving ? 'Saving...' : 'Save & Exit'}
              </button>
            </div>
          )}
        </main>
      )}

      {/* Modals */}
      {showFieldsModal && extractedFields && (
        <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl p-6">
            {verificationQueue.length > 0 && queueIndex >= 0 && extractedFields?.image && (
              <div className="bg-slate-50/50 rounded-xl p-2 border border-slate-200 mb-6">
                <img src={extractedFields.image} alt="Card preview" className="w-full max-h-48 object-contain rounded-lg" />
              </div>
            )}
            <ExtractedFieldsForm
              initialFields={extractedFields}
              onConfirm={handleConfirmFields}
              onCancel={() => setShowFieldsModal(false)}
            />
          </div>
        </div>
      )}

      {emailDraft && leadId && (
        <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <FollowupDraftEditor
            leadId={leadId}
            initialDraft={emailDraft}
            phoneNumber={extractedFields?.phone || ''}
            onSuccess={handleFollowupSuccess}
            onCancel={() => setEmailDraft(null)}
          />
        </div>
      )}
    </div>
  );
}

export default function CaptureDashboard() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-white flex flex-col justify-center items-center">
        <DynamicLoader messages={[]} />
      </div>
    }>
      <CaptureDashboardContent />
    </React.Suspense>
  );
}
