'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Building,
  Mail,
  Phone,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Send,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle,
  Camera,
  Save,
  Edit3,
  Trash2,
  FileText,
  MessageCircle,
} from 'lucide-react';
import LeadStatusBadge from './LeadStatusBadge';
import AudioPlayer from './AudioPlayer';
import FollowupDraftEditor from './FollowupDraftEditor';

import InsightsPanel from './InsightsPanel';

interface LeadDetailPanelProps {
  lead: any;
  onClose: () => void;
  onRefresh: () => void;
}

export default function LeadDetailPanel({ lead, onClose, onRefresh }: LeadDetailPanelProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>(lead.notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const contact = lead.contact_fields || {};
  const name = lead.name || lead.contact_fields?.name || 'Unknown Lead';
  
  // recordings and card_scans are 1:1 relationships in the schema and are returned as objects,
  // but were previously accessed as arrays (?.[0]), returning undefined.
  const recording = lead.recordings 
    ? (Array.isArray(lead.recordings) ? lead.recordings[0] : lead.recordings) 
    : {};
  const card = lead.card_scans 
    ? (Array.isArray(lead.card_scans) ? lead.card_scans[0] : lead.card_scans) 
    : {};
    
  const followups = lead.followups || [];
  const syncLogs = lead.crm_sync_log || [];



  // Delete State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingLead, setIsDeletingLead] = useState(false);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(contact.name || '');
  const [editCompany, setEditCompany] = useState(contact.company || '');
  const [editTitle, setEditTitle] = useState(contact.title || '');
  const [editEmail, setEditEmail] = useState(contact.email || '');
  const [editPhone, setEditPhone] = useState(contact.phone || '');
  const [isSavingFields, setIsSavingFields] = useState(false);

  // Follow-up generation State
  const [isDrafting, setIsDrafting] = useState(false);
  const [emailDraft, setEmailDraft] = useState<{ subject: string; emailBody: string; whatsappBody: string } | null>(null);

  // Scanning State
  const [isScanningCard, setIsScanningCard] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cardImageBase64, setCardImageBase64] = useState<string | null>(null);

  // Edit Followup State
  const [editingFollowupId, setEditingFollowupId] = useState<string | null>(null);
  const [editingSubject, setEditingSubject] = useState('');
  const [editingBody, setEditingBody] = useState('');
  const [isSavingFollowup, setIsSavingFollowup] = useState(false);

  // Reset fields when lead changes
  useEffect(() => {
    setEditName(lead.contact_fields?.name || '');
    setEditCompany(lead.contact_fields?.company || '');
    setEditTitle(lead.contact_fields?.title || '');
    setEditEmail(lead.contact_fields?.email || '');
    setEditPhone(lead.contact_fields?.phone || '');
    setNotes(lead.notes || '');
    setIsEditing(false);
    setShowDeleteConfirm(false);
    setScanError(null);
    setEmailDraft(null);
    setCardImageBase64(null);
  }, [lead.id, lead.contact_fields, lead.notes]);

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle || '';
    };
  }, []);

  const handleGenerateDraft = async () => {
    setIsDrafting(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${lead.id}/confirm-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactFields: contact,
          senderName: 'Sales Exec',
        }),
      });

      const result = await response.json();
      if (response.ok && result.data?.draft) {
        setEmailDraft(result.data.draft);
      } else {
        setEmailDraft({
          subject: `Following up from our conversation`,
          emailBody: `Hi ${contact.name || 'there'},\n\nIt was great speaking with you. Let's connect next week.\n\nBest,\nSales Exec`,
          whatsappBody: `Hi ${contact.name || 'there'}, it was great speaking with you!`,
        });
      }
    } catch (e) {
      console.error('Draft generation failed:', e);
      setError('Failed to generate draft. Please try again.');
    } finally {
      setIsDrafting(false);
    }
  };

  const handleDeleteLead = async () => {
    setIsDeletingLead(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error?.message || 'Failed to delete lead.');
      }
      onClose();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred during deletion.');
      setShowDeleteConfirm(false);
    } finally {
      setIsDeletingLead(false);
    }
  };

  const handleSaveFields = async () => {
    setIsSavingFields(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${lead.id}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactFields: {
            name: editName || null,
            company: editCompany || null,
            title: editTitle || null,
            email: editEmail || null,
            phone: editPhone || null,
          },
          cardImage: cardImageBase64 || null,
          confidence: cardImageBase64 ? 0.95 : 1.0,
        }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error?.message || 'Failed to save changes.');
      }
      setIsEditing(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setIsSavingFields(false);
    }
  };

  const handleSaveFollowup = async (followupId: string) => {
    setIsSavingFollowup(true);
    try {
      const response = await fetch(`/api/followups/${followupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: editingSubject,
          body: editingBody,
        }),
      });
      if (response.ok) {
        setEditingFollowupId(null);
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to save followup edit', err);
    } finally {
      setIsSavingFollowup(false);
    }
  };

  const handleCardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningCard(true);
    setScanError(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = async () => {
        // Compress using Canvas to prevent payload size limits
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
          setCardImageBase64(compressedBase64);
          
          try {
            const response = await fetch('/api/leads/card-scan', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image: compressedBase64 }),
            });
            const result = await response.json();
            
            if (response.ok && result.data) {
              const data = result.data;
              // Switch to editing and auto-fill extracted details
              setIsEditing(true);
              if (data.name) setEditName(data.name);
              if (data.company) setEditCompany(data.company);
              if (data.title) setEditTitle(data.title);
              if (data.email) setEditEmail(data.email);
              if (data.phone) setEditPhone(data.phone);
            } else {
              setScanError(result.error?.message || 'Failed to scan card.');
            }
          } catch (err) {
            setScanError('Failed to upload or scan card image.');
          } finally {
            setIsScanningCard(false);
          }
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRetrySync = async () => {
    setIsRetrying(true);
    setError(null);

    // BUG 3 FIX: Use approved draft from the first followup record if available
    const firstFollowup = followups.find((f: any) => f.sequence_position === 1);
    const retrySuject = firstFollowup?.subject || 'Following up on our conversation';
    const retryBody = firstFollowup?.body || `Dear ${contact.name || 'there'} ji,\n\nIt was great speaking with you. I wanted to follow up and see how we can assist you with your requirements.\n\nBest regards,\nSales Exec`;

    try {
      const response = await fetch(`/api/leads/${lead.id}/approve-followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: retrySuject,
          body: retryBody,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || 'Sync retry failed. Both integrations are still unreachable.');
      }

      onRefresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred during synchronization retry.');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
    } catch (e) {
      console.error('Failed to save notes:', e);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleWhatsApp = () => {
    if (!contact.phone) return;
    const phone = contact.phone.replace(/[^0-9+]/g, '');
    
    // Check if we have an AI-generated whatsapp body
    const firstFollowup = followups.find((f: any) => f.sequence_position === 1);
    let messageBody = `Hi ${contact.name || 'there'}, I am following up from our exhibition conversation. Let's connect!`;
    
    // Since we don't have whatsapp_body in the DB schema yet, we might use the email draft if available, 
    // or fallback. For now, just generate a generic clean message.
    if (emailDraft && emailDraft.whatsappBody) {
      messageBody = emailDraft.whatsappBody;
    }
    
    const message = encodeURIComponent(messageBody);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'skeptical':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'critical':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'neutral':
      default:
        return 'text-slate-500 bg-slate-100 border-zinc-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay Backdrop */}
      <div 
        className="absolute inset-0 bg-white/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Slide-over Panel */}
      <div className="relative w-full max-w-lg bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 h-full">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-white/40 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 text-slate-500 hover:text-slate-900 transition-all group"
            >
              <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">{contact.name || 'Unnamed Prospect'}</h3>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {lead.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LeadStatusBadge status={lead.status} />
          </div>
        </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Alerts / Error States */}
        {lead.status === 'needs_attention' && (
          <div className="p-4 bg-red-950/20 border border-red-500/20 rounded-xl space-y-3">
            <div className="flex gap-2 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-semibold block mb-0.5">Synchronization Failed</span>
                Both Zoho CRM and the Google Sheets fallback failed to sync. Review your integration credentials or check internet connectivity.
              </div>
            </div>
            {syncLogs.length > 0 && syncLogs[syncLogs.length - 1]?.error_message && (
              <p className="text-[10px] font-mono text-red-500/80 bg-white/35 p-2 rounded border border-red-900/30">
                Log Error: {syncLogs[syncLogs.length - 1].error_message}
              </p>
            )}
            {error && (
              <p className="text-xs text-red-400 font-medium">Retry error: {error}</p>
            )}
            <button
              onClick={handleRetrySync}
              disabled={isRetrying}
              className="w-full py-2 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-slate-900 flex items-center justify-center gap-1.5 transition-all shadow-[0_0_10px_rgba(239,68,68,0.2)]"
            >
              {isRetrying ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Retry Synchronization Now
            </button>
          </div>
        )}

        {/* 1. Contact Details Card */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 rounded-2xl space-y-4 border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <User className="w-4 h-4 text-slate-600" />
              Contact Profile
            </h4>
            {!isEditing && !showDeleteConfirm && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 rounded hover:bg-slate-50 text-slate-400 hover:text-slate-900 transition-colors"
                  title="Edit Profile"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
                  title="Delete Prospect"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {showDeleteConfirm && (
            <div className="p-4 bg-red-950/20 border border-red-500/20 rounded-xl space-y-3 animate-in fade-in duration-200">
              <div className="flex gap-2 text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-semibold block mb-0.5">Delete Prospect?</span>
                  Are you sure you want to delete this contact and all associated recordings and follow-up templates? This action is permanent.
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteLead}
                  disabled={isDeletingLead}
                  className="flex-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-slate-900 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  {isDeletingLead ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                  Confirm Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="py-1.5 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          
          {isEditing ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-white/90 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-zinc-700 focus:border-blue-500 focus:ring-0 outline-none"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Company</label>
                <input
                  type="text"
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                  className="w-full bg-white/90 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-zinc-700 focus:border-blue-500 focus:ring-0 outline-none"
                  placeholder="e.g. Acme Corp"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Job Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-white/90 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-zinc-700 focus:border-blue-500 focus:ring-0 outline-none"
                  placeholder="e.g. Manager"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-white/90 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-zinc-700 focus:border-blue-500 focus:ring-0 outline-none"
                  placeholder="e.g. name@company.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Phone</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-white/90 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-zinc-700 focus:border-blue-500 focus:ring-0 outline-none"
                  placeholder="e.g. +1 555-0199"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveFields}
                  disabled={isSavingFields}
                  className="flex-1 py-2 px-3 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  {isSavingFields ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Changes
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="py-2 px-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">Company:</span>
                  <span className="text-slate-900 font-medium">{contact.company || 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">Job Title:</span>
                  <span className="text-slate-900 font-medium">{contact.title || 'Not Specified'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">Email:</span>
                  {contact.email ? (
                    <a href={`mailto:${contact.email}`} className="text-slate-600 hover:underline">
                      {contact.email}
                    </a>
                  ) : (
                    <span className="text-slate-400 italic">None</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">Phone:</span>
                  <span className={contact.phone ? "text-slate-900" : "text-slate-400 italic"}>
                    {contact.phone || 'None'}
                  </span>
                </div>
              </div>

              {!contact.name && (
                <div className="border border-dashed border-slate-200 rounded-2xl p-4 text-center space-y-3 bg-white/20">
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Missing prospect info? Upload a business card photo to automatically extract and populate their profile details.
                  </p>
                  <label className="inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-blue-600 hover:bg-slate-800 text-slate-900 text-xs font-bold cursor-pointer transition-all shadow-sm">
                    <Camera className="w-3.5 h-3.5" />
                    {isScanningCard ? 'Processing...' : 'Upload Business Card'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCardUpload}
                      disabled={isScanningCard}
                      className="hidden"
                    />
                  </label>
                  {scanError && (
                    <p className="text-[10px] text-red-400">{scanError}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Follow-up Pipeline Action (If no sequence is scheduled yet) */}
        {followups.length === 0 && (
          <div className="w-full">
            {contact.email ? (
              <button
                onClick={handleGenerateDraft}
                disabled={isDrafting}
                className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.98]"
              >
                {isDrafting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating Follow-up Sequence...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Initialize Follow-up Pipeline
                  </>
                )}
              </button>
            ) : (
              <div className="w-full py-3.5 px-4 rounded-2xl bg-slate-50/90 border border-dashed border-slate-200 text-slate-400 text-xs font-semibold text-center leading-relaxed">
                Add an email address to initialize the 3-month follow-up pipeline.
              </div>
            )}
          </div>
        )}



        {/* 3. AI Extraction Insights */}


        {/* 3. Audio & Transcript */}
        {recording && (recording.audio_url || recording.transcript) && (
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/40 pb-2">
              <MessageSquare className="w-4 h-4 text-slate-600" />
              Recorded Conversation
            </h4>
            {recording.audio_url && (
              <div className="pb-1">
                {recording.audio_url.startsWith('local-placeholder://') ? (
                  <div className="p-3 bg-white/60 border border-zinc-900/60 rounded-xl flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-mono truncate max-w-[280px]">
                      {recording.audio_url.replace('local-placeholder://', '')}
                    </span>
                    <span className="text-[9px] uppercase font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 flex-shrink-0">
                      Local Dev Audio
                    </span>
                  </div>
                ) : (
                  <AudioPlayer src={recording.audio_url} />
                )}
              </div>
            )}
            {recording.transcript && (
              <div className="max-h-40 overflow-y-auto bg-white/60 p-3 rounded-lg border border-zinc-900/60 text-xs text-slate-500 font-mono leading-relaxed whitespace-pre-line">
                {recording.transcript}
              </div>
            )}
          </div>
        )}


        {/* Notes Section */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 rounded-xl space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/40 pb-2">
            <FileText className="w-4 h-4 text-slate-600" />
            Manual Notes
          </h4>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleSaveNotes}
            placeholder="Add private notes about this lead... (auto-saves on blur)"
            rows={4}
            className="w-full bg-white/40 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-blue-500/50 focus:ring-0 outline-none resize-none"
          />
          <button
            onClick={handleSaveNotes}
            disabled={isSavingNotes}
            className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-slate-500 font-semibold transition-colors"
          >
            {isSavingNotes ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            {isSavingNotes ? 'Saving...' : 'Save Notes'}
          </button>
        </div>

        {/* WhatsApp Follow-up */}
        {contact.phone && (
          <button
            onClick={handleWhatsApp}
            className="w-full py-3 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/30 hover:bg-[#25D366]/20 text-[#25D366] font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
          >
            <MessageCircle className="w-4 h-4" />
            Follow up via WhatsApp
          </button>
        )}

        {/* Sync Audits */}
        {syncLogs.length > 0 && (
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 rounded-xl space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/40 pb-2">
              <Clock className="w-4 h-4 text-slate-600" />
              Sync Audit History
            </h4>
            <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
              {syncLogs
                .sort((a: any, b: any) => new Date(b.synced_at).getTime() - new Date(a.synced_at).getTime())
                .map((log: any) => (
                  <div key={log.id} className="flex items-start justify-between text-[11px] p-2 bg-white/60 rounded border border-zinc-900/60">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700 capitalize">{log.target_system} Sync</span>
                        <span className={`text-[9px] uppercase px-1 rounded font-bold ${
                          log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {log.status}
                        </span>
                      </div>
                      {log.error_message && (
                        <p className="text-[10px] text-red-400 font-mono">{log.error_message}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">{new Date(log.synced_at).toLocaleTimeString()}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Editor Modal */}
      {emailDraft && (
        <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <FollowupDraftEditor
            leadId={lead.id}
            initialDraft={emailDraft}
            phoneNumber={lead.contact_fields?.phone || lead.contact_fields?.mobile || ''}
            onSuccess={() => {
              setEmailDraft(null);
              onRefresh();
            }}
            onCancel={() => setEmailDraft(null)}
          />
        </div>
      )}
    </div>
    </div>
  );
}
