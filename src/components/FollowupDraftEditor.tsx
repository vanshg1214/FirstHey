'use client';

import React, { useState, useEffect } from 'react';
import { MailOpen, Edit, Save, Send, AlertTriangle, CheckCircle, Paperclip, X, MessageCircle } from 'lucide-react';
import { useToast } from './Toast';

interface EmailDraft {
  subject: string;
  emailBody: string;
  whatsappBody: string;
}

interface FollowupDraftEditorProps {
  leadId: string;
  initialDraft: EmailDraft;
  phoneNumber: string;
  onSuccess: (syncedTo: 'zoho' | 'sheets' | 'direct') => void;
  onCancel: () => void;
}

export default function FollowupDraftEditor({
  leadId,
  initialDraft,
  phoneNumber,
  onSuccess,
  onCancel,
}: FollowupDraftEditorProps) {
  const [draft, setDraft] = useState<EmailDraft>({ ...initialDraft });
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp'>('email');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [attachments, setAttachments] = useState<{ filename: string; content: string; encoding: string }[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle || '';
    };
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setDraft((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          const content = result.split(',')[1]; // get base64 string without data type prefix
          setAttachments((prev) => [
            ...prev,
            { filename: file.name, content, encoding: 'base64' },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
    // clear input so same file can be selected again if removed
    e.target.value = '';
  };
  
  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/leads/${leadId}/approve-followup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: draft.subject,
          body: draft.emailBody,
          attachments,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to send email.');
      }

      setEmailSent(true);
      addToast('success', 'Email Sent!', `Successfully dispatched directly via Nodemailer`);

      // Switch to WhatsApp tab if not sent yet
      if (!whatsappSent) {
        setActiveTab('whatsapp');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during sending.');
      addToast('error', 'Send Failed', err.message || 'Could not send the email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreview = async () => {
    try {
      const response = await fetch(`/api/leads/${leadId}/preview-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailBody: draft.emailBody }),
      });
      if (response.ok) {
        const html = await response.text();
        setPreviewHtml(html);
        setIsPreviewOpen(true);
      } else {
        addToast('error', 'Preview Failed', 'Could not load preview.');
      }
    } catch (e) {
      addToast('error', 'Preview Failed', 'Network error.');
    }
  };

  const handleWhatsAppSend = () => {
    // 1. Clean phone number (remove everything except numbers and '+')
    let cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
    
    // 2. Fallback to add country code if missing
    if (cleanPhone && !cleanPhone.startsWith('+')) {
      // Assuming US/Canada by default if they don't provide one, but typically user should provide full number.
      // If no + is present, WhatsApp sometimes requires it.
      if (cleanPhone.length === 10) cleanPhone = '1' + cleanPhone;
    }

    if (!cleanPhone) {
      setError("No valid phone number found for this lead.");
      return;
    }

    // 3. Log WhatsApp send and update lead status in background
    fetch(`/api/leads/${leadId}/log-whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        whatsappBody: draft.whatsappBody,
      }),
    }).catch(console.error);

    // 4. Open WA.me link
    const encodedMessage = encodeURIComponent(draft.whatsappBody);
    const waUrl = `https://wa.me/${cleanPhone.replace('+', '')}?text=${encodedMessage}`;
    window.open(waUrl, '_blank');

    setWhatsappSent(true);
    addToast('success', 'WhatsApp Opened!', 'Your WhatsApp application has been opened with the draft.');
  };

  const handleClose = () => {
    if (emailSent || whatsappSent) {
      onSuccess('direct');
    } else {
      onCancel();
    }
  };

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 rounded-2xl w-full max-w-md mx-auto transition-all duration-300">
      <div className="flex items-center justify-between mb-4 border-b border-slate-200/60 pb-3">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-600">
          <MailOpen className="w-5 h-5" />
          Review Follow-Up Email
        </h3>
      </div>

      <div className="space-y-4">
        <p className="text-xs text-slate-500 mb-2">
          The AI drafted this message based on your conversation transcript. You can send an Email, a WhatsApp, or both!
        </p>

          {/* Tabs */}
          <div className="flex p-1 space-x-1 bg-slate-100/50 rounded-xl mb-4 border border-slate-200">
            <button
              onClick={() => setActiveTab('email')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'email'
                  ? 'bg-white text-blue-700 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <MailOpen className="w-4 h-4" />
              Email {emailSent && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
            </button>
            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'whatsapp'
                  ? 'bg-[#25D366]/10 text-[#128C7E] shadow-sm border border-[#25D366]/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp {whatsappSent && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
            </button>
          </div>

          {activeTab === 'email' && (
            <>
              {/* Subject Line */}
          <div className="space-y-1.5">
            <label htmlFor="subject" className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
              <Edit className="w-3.5 h-3.5 text-slate-600" />
              Email Subject
            </label>
            <input
              type="text"
              id="subject"
              name="subject"
              value={draft.subject}
              onChange={handleInputChange}
              required
              className="w-full bg-white/50 border border-slate-200 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-zinc-600 transition-all outline-none shadow-inner"
            />
          </div>

          {/* Email Body */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label htmlFor="body" className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <MailOpen className="w-3.5 h-3.5 text-slate-600" />
                Email Message
              </label>
              <button 
                type="button" 
                onClick={handlePreview}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                Preview Email HTML
              </button>
            </div>
            <textarea
              id="body"
              name="emailBody"
              value={draft.emailBody}
              onChange={handleInputChange}
              required
              rows={8}
              className="w-full bg-white/50 border border-slate-200 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-zinc-600 transition-all outline-none font-sans leading-relaxed resize-none shadow-inner"
            />
          </div>

          {/* Attachments */}
          <div className="space-y-2 pb-2">
            <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-slate-600" />
              Attachments
            </label>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-800/10 border border-blue-500/20 text-slate-500 px-3 py-1.5 rounded-lg text-xs">
                    <span className="truncate max-w-[150px]">{att.filename}</span>
                    <button type="button" onClick={() => removeAttachment(i)} className="text-slate-600 hover:text-indigo-200">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-white/5 file:text-slate-700 hover:file:bg-white/10 transition-all cursor-pointer"
            />
          </div>
          </>
          )}

          {activeTab === 'whatsapp' && (
            <div className="space-y-1.5 animate-in fade-in duration-300">
              <label htmlFor="whatsappBody" className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                WhatsApp Message
              </label>
              <textarea
                id="whatsappBody"
                name="whatsappBody"
                value={draft.whatsappBody}
                onChange={handleInputChange}
                required
                rows={6}
                className="w-full bg-white/50 border border-[#25D366]/30 focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]/20 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-zinc-600 transition-all outline-none font-sans leading-relaxed resize-none shadow-inner"
              />
              {!phoneNumber && (
                 <div className="p-3 mt-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs flex items-start gap-2">
                   <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                   <span>Lead has no phone number recorded. Please update their profile first.</span>
                 </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-950/30 border border-red-500/20 text-red-400 rounded-lg text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-200/40">
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-500 hover:text-zinc-200 hover:bg-slate-50 transition-all"
            >
              {(emailSent || whatsappSent) ? 'Done' : 'Back'}
            </button>
            <button
              onClick={activeTab === 'email' ? handleApprove : handleWhatsAppSend}
              disabled={isSubmitting || (activeTab === 'whatsapp' && !phoneNumber) || (activeTab === 'email' && emailSent)}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 shadow-sm hover:scale-[1.01] transition-all ${
                activeTab === 'email' && emailSent
                  ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed'
                  : activeTab === 'whatsapp' 
                  ? 'bg-[#25D366] hover:bg-[#128C7E] text-white disabled:bg-slate-300' 
                  : 'bg-blue-600 hover:bg-slate-800 text-white disabled:bg-slate-300'
              }`}
            >
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  {activeTab === 'email' && emailSent ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Email Sent!
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      {activeTab === 'whatsapp' ? 'Send via WhatsApp' : 'Send Email'}
                    </>
                  )}
                </>
              )}
            </button>
          </div>
        </div>

      {/* Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <MailOpen className="w-5 h-5 text-slate-500" />
                Email Preview
              </h3>
              <button onClick={() => setIsPreviewOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-4 flex justify-center">
              <div className="w-full max-w-[600px] shadow-sm overflow-hidden rounded-md border border-slate-200 bg-white" style={{ minHeight: '400px' }}>
                 <iframe 
                   srcDoc={previewHtml || ''} 
                   className="w-full h-full min-h-[500px]" 
                   frameBorder="0"
                 />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button onClick={() => setIsPreviewOpen(false)} className="px-5 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors">
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
