'use client';

import React, { useState, useEffect } from 'react';
import { User, Building, ShieldAlert, Award, Phone, Mail, Check } from 'lucide-react';

interface ExtractedFields {
  name: string | null;
  company: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  secondary_phone: string | null;
  confidence: number;
}

interface ExtractedFieldsFormProps {
  initialFields: ExtractedFields;
  onConfirm: (fields: ExtractedFields) => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
}

export default function ExtractedFieldsForm({
  initialFields,
  onConfirm,
  onCancel,
  submitLabel = "Confirm Details",
  cancelLabel = "Cancel",
}: ExtractedFieldsFormProps) {
  const [fields, setFields] = useState<ExtractedFields>({ ...initialFields });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFields({ ...initialFields });
  }, [initialFields]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFields((prev) => ({
      ...prev,
      [name]: value === '' ? null : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate minor transition animation delay
    setTimeout(() => {
      onConfirm(fields);
      setIsSubmitting(false);
    }, 400);
  };

  // Determine confidence status styling
  const getConfidenceBadge = (score: number) => {
    if (score >= 0.8) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <Award className="w-3.5 h-3.5" />
          High Confidence ({Math.round(score * 100)}%)
        </span>
      );
    } else if (score >= 0.5) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <ShieldAlert className="w-3.5 h-3.5" />
          Moderate Confidence ({Math.round(score * 100)}%)
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
          <ShieldAlert className="w-3.5 h-3.5" />
          Needs Review ({Math.round(score * 100)}%)
        </span>
      );
    }
  };

  return (
    <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl w-full transition-all duration-300 flex flex-col h-full">
      <div className="flex flex-col gap-1.5 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Confirm Lead Details</h3>
        </div>
        <p className="text-xs text-slate-500">
          Review the contact details extracted from the business card and make any necessary corrections.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-5">
        {/* Full Name */}
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-600" />
            Full Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={fields.name || ''}
            onChange={handleChange}
            className="w-full bg-white/50 border border-slate-200 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-zinc-600 transition-all outline-none shadow-inner"
          />
        </div>

        {/* Company Name */}
        <div className="space-y-1.5">
          <label htmlFor="company" className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-slate-600" />
            Company Name
          </label>
          <input
            type="text"
            id="company"
            name="company"
            value={fields.company || ''}
            onChange={handleChange}
            className="w-full bg-white/50 border border-slate-200 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-zinc-600 transition-all outline-none shadow-inner"
          />
        </div>

        {/* Job Title */}
        <div className="space-y-1.5">
          <label htmlFor="title" className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-slate-600" />
            Job Title
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={fields.title || ''}
            onChange={handleChange}
            className="w-full bg-white/50 border border-slate-200 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-zinc-600 transition-all outline-none shadow-inner"
          />
        </div>

        {/* Email Address */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-slate-600" />
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={fields.email || ''}
            onChange={handleChange}
            className="w-full bg-white/50 border border-slate-200 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-zinc-600 transition-all outline-none shadow-inner"
          />
        </div>

        {/* Phone Number */}
        <div className="space-y-1.5">
          <label htmlFor="phone" className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-slate-600" />
            Phone Number
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={fields.phone || ''}
            onChange={handleChange}
            className="w-full bg-white/50 border border-slate-200 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-zinc-600 transition-all outline-none shadow-inner"
          />
        </div>

        {/* Secondary Phone Number */}
        <div className="space-y-1.5">
          <label htmlFor="secondary_phone" className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-slate-600 opacity-70" />
            Secondary Phone
          </label>
          <input
            type="tel"
            id="secondary_phone"
            name="secondary_phone"
            value={fields.secondary_phone || ''}
            onChange={handleChange}
            className="w-full bg-white/50 border border-slate-200 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-zinc-600 transition-all outline-none shadow-inner"
          />
        </div>

        {/* Actions */}
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-sm whitespace-nowrap"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-bold text-white flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all whitespace-nowrap"
          >
            {isSubmitting ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {submitLabel}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
