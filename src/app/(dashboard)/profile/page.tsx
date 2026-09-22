'use client';

import React, { useState, useEffect } from 'react';
import { User, Lock, Save, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/Toast';

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { addToast } = useToast();

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/profile');
        const json = await res.json();
        if (json.error) throw new Error(json.error.message);
        setProfile(json.data);
        setName(json.data?.name || '');
      } catch (err: any) {
        addToast('error', err.message || 'Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, [addToast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password && password !== confirmPassword) {
      return addToast('error', 'Passwords do not match');
    }
    
    setIsSaving(true);
    try {
      const payload: any = { name };
      if (password) payload.password = password;

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error.message);
      
      addToast('success', 'Profile updated successfully');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600" />
            My Profile
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage your personal account settings and password.</p>
        </div>

        <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 md:p-6 space-y-5">
            
            <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
              <div className="w-14 h-14 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl font-bold uppercase shadow-sm">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full rounded-xl object-cover" />
                ) : (
                  name ? name.charAt(0) : profile?.email?.charAt(0) || 'U'
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{profile?.email}</h3>
                <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold uppercase tracking-wider">
                  Role: {profile?.role}
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                Personal Information
              </h4>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-0 outline-none transition-colors"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-400" />
                Change Password
              </h4>
              <p className="text-[10px] text-slate-500">Leave blank if you don't want to change your password.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-0 outline-none transition-colors"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-0 outline-none transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

          </div>
          
          <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm shadow-sm hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
