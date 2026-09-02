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
      if (service === 'zoho') credentials = { clientId: settings.zoho_client_id, clientSecret: settings.zoho_client_secret, refreshToken: settings.zoho_refresh_token };

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

  const handleAutoSetup = async () => {
    // Check if basic OAuth fields exist
    if (!settings.zoho_client_id || !settings.zoho_refresh_token || !settings.zoho_client_secret) {
      addToast('error', 'Please fill in your Zoho Client ID, Client Secret, and Refresh Token first, and click Save.');
      return;
    }
    
    setIsAutoSettingUp(true);
    addToast('info', 'Connecting to Zoho API to auto-configure campaign...');
    try {
      const res = await fetch('/api/settings/zoho-auto-setup', { method: 'POST' });
      const data = await res.json();
      
      if (data.success && data.campaign_key) {
        setSettings(prev => ({ ...prev, zoho_campaign_key: data.campaign_key }));
        addToast('success', 'Campaign auto-created! Please verify it in your Zoho Campaigns dashboard and submit for review.');
      } else {
        addToast('error', data.error || 'Failed to auto-create campaign');
      }
    } catch (err) {
      addToast('error', 'Network error during auto-setup');
    } finally {
      setIsAutoSettingUp(false);
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Organization Settings</h1>
          <p className="mt-2 text-slate-500">
            Configure your Bring Your Own Key (BYOK) integrations. These credentials are encrypted and scoped to your organization.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Organization Profile */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-900 flex items-center">
                <svg className="w-5 h-5 mr-2 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">Required for context extraction, card scanning, and automated replies.</p>
              </div>
            </div>
          </div>

          {/* Email Settings */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-900 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">Use a 16-digit App Password for Gmail.</p>
              </div>
            </div>
          </div>

          {/* Zoho Settings */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-900 flex items-center">
                <svg className="w-5 h-5 mr-2 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Zoho CRM
              </h2>
              <button
                type="button"
                onClick={() => handleTestConnection('zoho')}
                disabled={testingService === 'zoho' || !settings.zoho_client_id || !settings.zoho_refresh_token}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {testingService === 'zoho' ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700">Client ID</label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="zoho_client_id"
                    value={settings.zoho_client_id || ''}
                    onChange={handleChange}
                    className="block w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-blue-500 focus:ring-blue-500 sm:text-sm shadow-sm"
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700">Client Secret</label>
                <div className="mt-1">
                  <input
                    type="password"
                    name="zoho_client_secret"
                    value={settings.zoho_client_secret || ''}
                    onChange={handleChange}
                    className="block w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-blue-500 focus:ring-blue-500 sm:text-sm shadow-sm"
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700">Refresh Token</label>
                <div className="mt-1">
                  <input
                    type="password"
                    name="zoho_refresh_token"
                    value={settings.zoho_refresh_token || ''}
                    onChange={handleChange}
                    className="block w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-blue-500 focus:ring-blue-500 sm:text-sm shadow-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">CRM API URL</label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="zoho_api_url"
                    value={settings.zoho_api_url || ''}
                    onChange={handleChange}
                    className="block w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-blue-500 focus:ring-blue-500 sm:text-sm shadow-sm"
                    placeholder="https://www.zohoapis.in"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Accounts URL</label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="zoho_accounts_url"
                    value={settings.zoho_accounts_url || ''}
                    onChange={handleChange}
                    className="block w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-blue-500 focus:ring-blue-500 sm:text-sm shadow-sm"
                    placeholder="https://accounts.zoho.in"
                  />
                </div>
              </div>
              <div className="sm:col-span-2 pt-4 border-t border-slate-100">
                <h3 className="text-sm font-semibold text-slate-800 mb-4">Zoho Campaigns (Email Dispatch & Analytics)</h3>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Campaigns API URL</label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="zoho_campaigns_api_url"
                    value={settings.zoho_campaigns_api_url || ''}
                    onChange={handleChange}
                    className="block w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-blue-500 focus:ring-blue-500 sm:text-sm shadow-sm"
                    placeholder="https://campaigns.zoho.in/api/v1.1"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Target Campaign Key</label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="zoho_campaign_key"
                    value={settings.zoho_campaign_key || ''}
                    onChange={handleChange}
                    className="block w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-blue-500 focus:ring-blue-500 sm:text-sm shadow-sm"
                    placeholder="Found in Zoho Campaigns Dashboard"
                  />
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleAutoSetup}
                      disabled={isAutoSettingUp}
                      className="inline-flex items-center rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-100 disabled:opacity-50"
                    >
                      {isAutoSettingUp ? 'Setting up...' : 'Auto-Setup Zoho Campaign'}
                    </button>
                    <p className="text-xs text-slate-500">Creates the campaign automatically and fetches the key.</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">If provided, the AI CRM will send emails via Zoho Campaigns instead of normal SMTP to track detailed engagement analytics.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-8 mt-8 border-t border-slate-200">
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-6 py-3 text-sm font-medium text-red-600 shadow-sm hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex justify-center rounded-lg border border-transparent bg-blue-600 px-8 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
