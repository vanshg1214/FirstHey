'use client';

import React from 'react';
import { Calendar, Building, ChevronRight, Users, Trash2, Edit2, MoreVertical } from 'lucide-react';
import { motion } from 'framer-motion';
import LeadStatusBadge from './LeadStatusBadge';

interface LeadListProps {
  leads: any[];
  onSelectLead: (lead: any) => void;
  selectedIds?: string[];
  onToggleSelection?: (id: string) => void;
  onToggleAll?: () => void;
  onEditLead?: (lead: any) => void;
  onDeleteLead?: (lead: any) => void;
}

// Avatar color palette — deterministic from name
const AVATAR_COLORS = [
  'bg-slate-800',
  'bg-teal-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-fuchsia-500',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Lead Score calculator
function calcLeadScore(lead: any): number {
  let score = 0;
  const contact = lead.contact_fields || {};
  const ctx = lead.context_summary || {};
  if (contact.email) score += 2;
  if (ctx.sentiment === 'positive') score += 3;
  if ((lead.open_count || 0) > 0) score += 2;
  if (lead.zoho_analytics?.clicks > 0) score += 2;
  if (lead.card_scans) score += 1;
  return Math.min(score, 10);
}

function LeadScoreBadge({ score }: { score: number }) {
  const color = score >= 7 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
    : score >= 4 ? 'text-amber-400 bg-amber-500/10 border-amber-500/25'
    : 'text-slate-400 bg-slate-100/50 border-zinc-700/50';
  return (
    <span className={`text-[9px] font-black border rounded px-1.5 py-0.5 font-mono leading-none ${color}`} title="Lead Score">
      {score}/10
    </span>
  );
}

export default function LeadList({ 
  leads, 
  onSelectLead,
  selectedIds = [],
  onToggleSelection,
  onToggleAll,
  onEditLead,
  onDeleteLead
}: LeadListProps) {
  if (!leads || leads.length === 0) {
    return null;
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="w-full space-y-3">
      {/* Desktop Table view (hidden on mobile) */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white/40 backdrop-blur-md shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-white/40">
              {onToggleAll && (
                <th className="py-3.5 px-4 w-12">
                  <input 
                    type="checkbox" 
                    checked={leads.length > 0 && selectedIds.length === leads.length}
                    onChange={onToggleAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white"
                  />
                </th>
              )}
              <th className="py-3.5 px-4">Contact</th>
              <th className="py-3.5 px-4">Company</th>
              <th className="py-3.5 px-4">Title</th>
              <th className="py-3.5 px-4">Location</th>
              <th className="py-3.5 px-4">Score</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Captured At</th>
              <th className="py-3.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <motion.tbody 
            initial="hidden" 
            animate="visible" 
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.05 }
              }
            }}
            className="divide-y divide-white/5 text-xs"
          >
            {leads.map((lead) => {
              const contact = lead.contact_fields || {};
              const score = calcLeadScore(lead);
              const name = contact.name || 'Unnamed Lead';
              return (
                <motion.tr 
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0 }
                  }}
                  key={lead.id} 
                  onClick={() => onSelectLead(lead)}
                  className="hover:bg-slate-50 transition-colors group"
                >
                  {onToggleSelection && (
                    <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(lead.id)}
                        onChange={() => onToggleSelection(lead.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white"
                      />
                    </td>
                  )}
                  <td className="py-3.5 px-4 cursor-pointer" onClick={() => onSelectLead(lead)}>
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full ${getAvatarColor(name)} flex items-center justify-center text-slate-900 text-[11px] font-black flex-shrink-0 select-none shadow-sm`}>
                        {getInitials(name)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <span>{name}</span>
                          {((lead.open_count || 0) >= 2) && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.1)] select-none animate-pulse">
                              🔥 Hot
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {contact.email && (
                            <span className="text-[10px] text-slate-400">{contact.email}</span>
                          )}
                          {((lead.open_count || 0) > 0) && (
                            <>
                              {contact.email && <span className="text-[10px] text-zinc-700 select-none">•</span>}
                              <span className="text-[9px] font-semibold text-slate-500 bg-white/60 border border-slate-200 px-1.5 py-0.5 rounded flex items-center gap-1 select-none">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                👁️ {lead.open_count || 0} views
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 font-medium">{contact.company || 'Unknown'}</td>
                  <td className="py-3.5 px-4 text-slate-500">{contact.title || 'Not Specified'}</td>
                  <td className="py-3.5 px-4">
                    {(lead.exhibition || lead.stall) ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {lead.exhibition && <span className="bg-white/5 border border-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-700 uppercase font-mono">{lead.exhibition}</span>}
                        {lead.stall && <span className="bg-white/5 border border-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-700 uppercase font-mono">{lead.stall}</span>}
                      </div>
                    ) : (
                      <span className="text-[10px] text-zinc-600 italic">--</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <LeadScoreBadge score={score} />
                  </td>
                  <td className="py-3.5 px-4">
                    <LeadStatusBadge status={lead.status} />
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-mono">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {formatDate(lead.created_at)}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      {onEditLead && (
                        <button onClick={() => onEditLead(lead)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {onDeleteLead && (
                        <button onClick={() => onDeleteLead(lead)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => onSelectLead(lead)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="View Details">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </motion.tbody>
        </table>
      </div>

      {/* Mobile Card view (hidden on desktop) */}
      <motion.div 
        initial="hidden" 
        animate="visible" 
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.05 }
          }
        }}
        className="grid grid-cols-1 gap-3 md:hidden"
      >
        {leads.map((lead) => {
          const contact = lead.contact_fields || {};
          const score = calcLeadScore(lead);
          const name = contact.name || 'Unnamed Lead';
          return (
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0 }
              }}
              key={lead.id}
              onClick={() => onSelectLead(lead)}
              className="p-5 rounded-2xl bg-white/40 border border-slate-200 shadow-xl space-y-4 cursor-pointer hover:border-blue-500/30 transition-all hover:scale-[1.02]"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {onToggleSelection && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(lead.id)}
                        onChange={() => onToggleSelection(lead.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white"
                      />
                    </div>
                  )}
                  <div className={`w-10 h-10 rounded-full ${getAvatarColor(name)} flex items-center justify-center text-slate-900 text-sm font-black flex-shrink-0 select-none shadow-sm`}>
                    {getInitials(name)}
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                      <span>{name}</span>
                      {((lead.open_count || 0) >= 2) && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30 select-none animate-pulse">
                          🔥 Hot
                        </span>
                      )}
                    </h4>
                    {contact.title && (
                      <p className="text-xs text-slate-500">{contact.title}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <LeadScoreBadge score={score} />
                      {((lead.open_count || 0) > 0) && (
                        <span className="text-[9px] font-semibold text-slate-500 bg-white/60 border border-slate-200 px-1.5 py-0.5 rounded flex items-center gap-1 select-none">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          👁️ {lead.open_count || 0} views
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <LeadStatusBadge status={lead.status} />
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate max-w-[120px]">{contact.company || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {formatDate(lead.created_at)}
                  </div>
                </div>
                
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {onEditLead && (
                    <button onClick={() => onEditLead(lead)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {onDeleteLead && (
                    <button onClick={() => onDeleteLead(lead)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}

