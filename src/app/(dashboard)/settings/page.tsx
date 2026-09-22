'use client';

import { useState, useEffect } from 'react';
import { getOrganizationSettings, saveOrganizationSettings, getOrganizationInfo, updateOrganizationInfo } from '@/lib/actions/settings';
import { OrganizationSettings } from '@/lib/services/settings';
import { useToast } from '@/components/Toast';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState<OrganizationSettings>({});
  const [orgName, setOrgName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testingService, setTestingService] = useState<string | null>(null);
  const [isAutoSettingUp, setIsAutoSettingUp] = useState(false);
  const { addToast } = useToast();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  useEffect(() => {
    async function loadSettings() {
      try {
        const [data, orgInfo] = await Promise.all([
          getOrganizationSettings(),
          getOrganizationInfo()
        ]);
        if (data) setSettings(data);
        if (orgInfo) setOrgName(orgInfo.name);
      } catch (error) {
        addToast('error', 'Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const [settingsResult, orgResult] = await Promise.all([
        saveOrganizationSettings(settings),
        updateOrganizationInfo(orgName)
      ]);
      
      if (settingsResult.success && orgResult.success) {
        addToast('success', 'Settings saved successfully!');
      } else {
        addToast('error', settingsResult.error || orgResult.error || 'Failed to save settings');
      }
    } catch (error) {
      addToast('error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async (service: 'gemini' | 'smtp' | 'zoho') => {
    setTestingService(service);
    try {
      let credentials = {};
      if (service === 'gemini') credentials = { apiKey: settings.gemini_api_key };
      if (service === 'smtp') credentials = { user: settings.email_user, pass: settings.email_password };

      const res = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, credentials })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        addToast('success', data.message);
      } else {
        addToast('error', data.error?.message || 'Connection test failed');
      }
    } catch (err: any) {
      addToast('error', 'Network error during test');
    } finally {
      setTestingService(null);
    }
  };


  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col px-4 py-8 sm:px-6 lg:px-8 text-slate-900">
      <div className="mx-auto max-w-3xl w-full">
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Organization Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure your Bring Your Own Key (BYOK) integrations. These credentials are encrypted and scoped to your organization.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8" autoComplete="off">
          {/* Organization Profile */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
              <svg className="w-4 h-4 mr-2 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Organization Profile
            </h2>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700">Company / Organization Name</label>
                <div className="mt-1">
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="block w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-blue-500 focus:ring-blue-500 sm:text-sm shadow-sm"
                    placeholder="Acme Corp"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Company Profile / What We Offer (For AI Chatbot)</label>
                <div className="mt-1">
                  <textarea
                    name="company_profile"
                    value={settings.company_profile || ''}
                    onChange={(e) => setSettings((prev) => ({ ...prev, company_profile: e.target.value }))}
                    rows={4}
                    className="block w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-blue-500 focus:ring-blue-500 sm:text-sm shadow-sm"
                    placeholder="Describe what your company does and what you offer. The AI will use this to qualify leads and answer questions..."
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">This helps the AI Assistant understand your business context.</p>
              </div>
            </div>
          </div>

          {/* AI Settings */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center">
                <svg className="w-4 h-4 mr-2 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Google Gemini AI
              </h2>
              <button
                type="button"
                onClick={() => handleTestConnection('gemini')}
                disabled={testingService === 'gemini' || !settings.gemini_api_key}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {testingService === 'gemini' ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700">Gemini API Key</label>
                <div className="mt-1">
                  <input
                    type="password"
                    name="gemini_api_key"
                    value={settings.gemini_api_key || ''}
                    onChange={handleChange}
                    className="block w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-blue-500 focus:ring-blue-500 sm:text-sm shadow-sm"
                    placeholder="AIzaSy..."
                    autoComplete="new-password"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">Required for context extraction, card scanning, and automated replies.</p>
              </div>
            </div>
          </div>

          {/* Email Settings */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center">
                <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email Integration (SMTP/Gmail)
              </h2>
              <button
                type="button"
                onClick={() => handleTestConnection('smtp')}
                disabled={testingService === 'smtp' || !settings.email_user || !settings.email_password}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {testingService === 'smtp' ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
            
            <div className="mb-6 rounded-lg bg-blue-50 p-4 border border-blue-100">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-bold text-blue-800 mb-1">How to set up your Gmail App Password:</h3>
                  <p className="text-xs text-blue-800 mb-2">Google requires an "App Password" to allow FirstHey to send emails safely on your behalf.</p>
                  <div className="mt-2 text-xs text-blue-700">
                    <ol className="list-decimal pl-5 space-y-1.5">
                      <li>Go to your <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-blue-900 text-blue-800">Google Account Security settings</a>.</li>
                      <li>Ensure <strong>2-Step Verification</strong> is turned ON (Google strictly requires this first).</li>
                      <li>Use the search bar at the top of your Google settings and search for <strong>"App Passwords"</strong>.</li>
                      <li>Create a new App Password (you can name it "FirstHey"). Google will generate a 16-character passcode in a yellow box.</li>
                      <li>Copy that 16-digit passcode (you can ignore the spaces) and paste it exactly into the <strong>App Password</strong> field below.</li>
                      <li>Finally, put your normal Gmail address in the <strong>Email Address (User)</strong> field.</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700">Sender Name</label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="email_from_name"
                    value={settings.email_from_name || ''}
                    onChange={handleChange}
                    className="block w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-blue-500 focus:ring-blue-500 sm:text-sm shadow-sm"
                    placeholder="John Doe (Sales Team)"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Sender Title / Designation</label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="email_sender_title"
                    value={settings.email_sender_title || ''}
                    onChange={handleChange}
                    className="block w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-blue-500 focus:ring-blue-500 sm:text-sm shadow-sm"
                    placeholder="Export Marketing Strategist"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Email Address (User)</label>
                <div className="mt-1">
                  <input
                    type="email"
                    name="email_user"
                    value={settings.email_user || ''}
                    onChange={handleChange}
                    className="block w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-blue-500 focus:ring-blue-500 sm:text-sm shadow-sm"
                    placeholder="you@company.com"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">App Password</label>
                <div className="mt-1">
                  <input
                    type="password"
                    name="email_password"
                    value={settings.email_password || ''}
                    onChange={handleChange}
                    className="block w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-blue-500 focus:ring-blue-500 sm:text-sm shadow-sm"
                    placeholder="abcd efgh ijkl mnop"
                    autoComplete="new-password"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">Use a 16-digit App Password for Gmail.</p>
              </div>
            </div>
          </div>


          <div className="flex justify-between items-center pt-8 mt-8 border-t border-slate-200">
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex justify-center rounded-lg border border-transparent bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
