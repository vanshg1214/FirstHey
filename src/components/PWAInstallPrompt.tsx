'use client';

import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if the prompt was previously dismissed
    const isDismissed = localStorage.getItem('pwa_prompt_dismissed') === 'true';
    if (isDismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Also check if already installed
    window.addEventListener('appinstalled', () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the PWA install prompt');
    } else {
      console.log('User dismissed the PWA install prompt');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed bottom-20 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:w-96 z-50"
        >
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl border border-blue-500/30 rounded-2xl p-4 shadow-2xl shadow-indigo-500/20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-800/20 rounded-xl flex items-center justify-center shrink-0">
                <Download className="w-6 h-6 text-slate-600" />
              </div>
              <div>
                <h4 className="text-slate-900 font-bold text-sm">Install FirstHey</h4>
                <p className="text-slate-500 text-xs mt-0.5">Add to your home screen for offline capture mode.</p>
              </div>
            </div>
            
            <div className="flex flex-col gap-2 shrink-0">
              <button 
                onClick={handleDismiss}
                className="absolute top-2 right-2 text-slate-400 hover:text-slate-900 p-1"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={handleInstallClick}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-slate-800 text-slate-900 text-xs font-bold rounded-lg transition-colors"
              >
                Install App
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
