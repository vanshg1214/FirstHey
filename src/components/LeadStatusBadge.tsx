'use client';

import React from 'react';

type LeadStatus = 'capturing' | 'extracted' | 'confirmed' | 'synced' | 'needs_attention';

interface LeadStatusBadgeProps {
  status: LeadStatus | string;
}

export default function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
  const getStatusStyles = (leadStatus: string) => {
    switch (leadStatus) {
      case 'contacted':
        return {
          bg: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
          dot: 'bg-purple-500 shadow-[0_0_8px_#a855f7]',
          label: 'Contacted',
        };
      case 'failed_to_contact':
        return {
          bg: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
          dot: 'bg-orange-500 shadow-[0_0_8px_#f97316]',
          label: 'Contact Failed',
        };
      case 'synced':
        return {
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          dot: 'bg-emerald-400 shadow-[0_0_8px_#10b981]',
          label: 'Synced to CRM',
        };
      case 'needs_attention':
        return {
          bg: 'bg-red-500/10 text-red-400 border-red-500/20',
          dot: 'bg-red-400 shadow-[0_0_8px_#ef4444] animate-pulse',
          label: 'Needs Review',
        };
      case 'extracted':
        return {
          bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
          dot: 'bg-blue-400 shadow-[0_0_8px_#3b82f6]',
          label: 'Extracted',
        };
      case 'confirmed':
        return {
          bg: 'bg-slate-800/10 text-slate-600 border-blue-500/20',
          dot: 'bg-indigo-400 shadow-[0_0_8px_#6366f1]',
          label: 'Confirmed',
        };
      case 'capturing':
      default:
        return {
          bg: 'bg-slate-100 text-slate-500 border-zinc-700',
          dot: 'bg-zinc-500',
          label: 'Capturing',
        };
    }
  };

  const styles = getStatusStyles(status);

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${styles.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`}></span>
      {styles.label}
    </span>
  );
}
