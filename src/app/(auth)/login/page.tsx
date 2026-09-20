'use client';

import React, { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Target, Mail, Lock, AlertCircle, ArrowRight, Eye, EyeOff, Building, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const router = useRouter();
  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isForgotPassword) {
        // Password Reset Flow
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/update-password`,
        });
        if (authError) throw new Error(authError.message);
        setSuccessMsg('Password reset link sent! Please check your email.');
      } else if (isSignUp) {
        // Sign Up Flow
        if (!companyName.trim()) {
          throw new Error('Company name is required for new accounts.');
        }

        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              company_name: companyName.trim(),
            }
          }
        });

        if (authError) throw new Error(authError.message);
        
        // Supabase often requires email verification by default
        
        // If they don't require verification, data.session might exist
        if (data.session) {
          router.push('/leads');
        } else {
          // Trigger OTP verification flow
          setIsVerifyingOtp(true);
          setSuccessMsg('Account created! Please check your email for the 6-digit verification code.');
        }
      } else {
        // Sign In Flow
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) throw new Error(authError.message || 'Invalid email or password.');

        if (data.session) {
          router.push('/leads');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'signup'
      });

      if (verifyError) throw new Error(verifyError.message);
      
      if (data.session) {
        router.push('/leads');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifyingOtp) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-600/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="w-full max-w-md space-y-6 relative z-10">
          <div className="text-center space-y-4 mb-8">
            <div className="w-48 h-12 flex items-center justify-center mx-auto translate-x-2">
              <img src="/logo.png?v=2" alt="FirstHey Logo" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Verify Your Email</h2>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              We sent a 6-digit code to <span className="font-bold">{email}</span>. Please enter it below.
            </p>
          </div>

          <div className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-xl rounded-3xl p-8">
            {error && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-rose-700 leading-relaxed">{error}</p>
              </div>
            )}
            
            {successMsg && (
              <div className="mb-6 p-4 bg-teal-50 border border-teal-100 rounded-2xl flex items-start gap-3">
                <p className="text-xs font-medium text-teal-700 leading-relaxed">{successMsg}</p>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="otp" className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-800" />
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  id="otp"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  required
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-slate-200 rounded-2xl px-4 py-3 text-center text-xl tracking-[0.5em] font-mono text-slate-900 placeholder-slate-400 transition-all outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || otpCode.length < 6}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3.5 px-4 rounded-2xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      Verify & Login
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
              
              <button
                type="button"
                onClick={() => setIsVerifyingOtp(false)}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-700 font-medium mt-4"
              >
                &larr; Back
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background visual accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-600/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Logo Header */}
        <div className="text-center space-y-4 mb-8">
          <div className="w-48 h-12 flex items-center justify-center mx-auto translate-x-2">
            <img src="/logo.png?v=2" alt="FirstHey Logo" className="w-full h-full object-contain" />
          </div>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            {isForgotPassword
              ? 'Enter your email address and we will send you a secure link to reset your password.'
              : isSignUp 
                ? 'Join today to capture event leads instantly and automate follow-ups.' 
                : 'Sign in to access your event leads and intelligence.'}
          </p>
        </div>

        {/* Login Panel */}
        <div className="bg-white p-8 rounded-3xl space-y-6 border border-slate-200 shadow-xl shadow-slate-200/50">
          
          {/* Tabs */}
          {!isForgotPassword && (
            <div className="flex p-1 bg-slate-50 rounded-xl border border-slate-100">
              <button
                type="button"
                onClick={() => { setIsSignUp(false); setError(null); setSuccessMsg(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${!isSignUp ? 'bg-white text-slate-900 shadow border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsSignUp(true); setError(null); setSuccessMsg(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${isSignUp ? 'bg-white text-slate-900 shadow border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Sign Up
              </button>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            
            {/* Company Name (Sign Up Only) */}
            {isSignUp && !isForgotPassword && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                <label htmlFor="company" className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-800" />
                  Company Name
                </label>
                <input
                  type="text"
                  id="company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Corp"
                  required={isSignUp}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-all outline-none"
                />
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-800" />
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rep@yourcompany.com"
                required
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-all outline-none"
              />
            </div>

            {/* Password */}
            {!isForgotPassword && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-800" />
                    Password
                  </label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => { setIsForgotPassword(true); setError(null); setSuccessMsg(null); }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required={!isForgotPassword}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-all outline-none"
                  />
                  <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-600 text-xs leading-relaxed">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-emerald-600 text-xs leading-relaxed">
                <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-md hover:bg-blue-700 hover:shadow-lg transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-70"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  {isForgotPassword ? 'Send Reset Link' : isSignUp ? 'Create Account' : 'Sign In'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {isForgotPassword && (
              <button
                type="button"
                onClick={() => { setIsForgotPassword(false); setError(null); setSuccessMsg(null); }}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-700 font-medium"
              >
                &larr; Back to Sign In
              </button>
            )}
          </form>

        </div>
      </div>
    </div>
  );
}
