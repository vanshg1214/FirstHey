'use client';

import React, { useState, useRef } from 'react';
import { FileText, RefreshCw, AlertCircle, Sparkles, Loader2, Image as ImageIcon, X, Plus, Check, Keyboard, Edit3 } from 'lucide-react';

interface NotesScannerProps {
  onScanComplete: (data: {
    problem: string;
    needs: string;
    action_items: string[];
    sentiment: string;
    notable_quotes: string[];
  }) => void;
  isProcessing?: boolean;
  leadId?: string | null;
}

export default function NotesScanner({ onScanComplete, isProcessing: externalProcessing = false, leadId }: NotesScannerProps) {
  const [images, setImages] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typedNotes, setTypedNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        // Compress image using canvas
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
          // Compress to JPEG with 0.8 quality to avoid API payload crash
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
          setImages(prev => [...prev, compressedBase64]);
        } else {
          // Fallback if canvas fails
          setImages(prev => [...prev, reader.result as string]);
        }
      };
      img.src = reader.result as string;
    };
    reader.onerror = () => {
      setError('Failed to read the image file.');
    };
    reader.readAsDataURL(file);
  };

  const triggerCameraInput = () => {
    cameraInputRef.current?.click();
  };

  const triggerUploadInput = () => {
    uploadInputRef.current?.click();
  };

  const handleScan = async () => {
    if (images.length === 0) return;

    setIsScanning(true);
    setError(null);

    try {
      const response = await fetch('/api/leads/notes-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ images, leadId }),
      });

      if (!response.ok) {
        throw new Error('Failed to parse notes. Please try again.');
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error.message || 'Scanning failed.');
      }

      onScanComplete({
        problem: result.data.problem,
        needs: result.data.needs,
        action_items: result.data.action_items,
        sentiment: result.data.sentiment,
        notable_quotes: result.data.notable_quotes,
      });
      // Optionally clear image here if we want it to reset after success
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsScanning(false);
    }
  };

  const resetScanner = () => {
    setImages([]);
    setTypedNotes('');
    setIsTyping(false);
    setError(null);
    setIsScanning(false);
  };

  const handleSaveTypedNotes = () => {
    if (!typedNotes.trim()) {
      setError('Please type some notes before saving.');
      return;
    }
    onScanComplete({
      problem: typedNotes.trim(),
      needs: '',
      action_items: [],
      sentiment: 'neutral',
      notable_quotes: [],
    });
  };

  const isBusy = isScanning || externalProcessing;

  if (externalProcessing) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 bg-indigo-950/20 border border-blue-500/20 rounded-3xl w-full h-[184px]">
        <Loader2 className="w-8 h-8 text-slate-600 animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-700">Extracting fields...</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />
      <input
        type="file"
        ref={uploadInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {images.length === 0 && !isTyping ? (
        <button
          onClick={() => setShowMenu(true)}
          className="relative flex flex-col items-center justify-center w-full py-8 px-4 h-[184px] rounded-3xl bg-slate-50 border-2 border-slate-200 hover:border-zinc-700 hover:bg-slate-100/80 transition-all duration-300 group overflow-hidden"
        >
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-slate-800/10 border border-blue-500/20 mb-3 group-hover:scale-105 transition-transform duration-300">
            <FileText className="w-7 h-7 text-slate-600 group-hover:text-slate-500" />
          </div>
          
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold tracking-wide text-indigo-100 group-hover:text-slate-900">
              ADD NOTES
            </span>
            <span className="text-sm text-slate-400 font-medium mt-1">
              Upload photo or type manually
            </span>
          </div>
        </button>
      ) : isTyping ? (
        <div className="w-full rounded-3xl overflow-hidden border border-slate-200 bg-white/90 p-4 shadow-2xl relative group">
          <textarea
            value={typedNotes}
            onChange={(e) => setTypedNotes(e.target.value)}
            placeholder="Type your meeting notes here..."
            className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 placeholder-slate-400 resize-none outline-none font-medium mb-4"
          ></textarea>
          <div className="flex gap-2">
            <button
              onClick={resetScanner}
              className="py-3 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm font-medium text-slate-500 transition-colors flex items-center justify-center"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={handleSaveTypedNotes}
              className="flex-1 py-3 bg-blue-600 hover:bg-slate-800 rounded-xl text-sm font-bold text-white hover:text-white transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Check className="w-4 h-4" />
              Save Notes
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full rounded-3xl overflow-hidden border border-slate-200 bg-white/90 p-4 shadow-2xl relative group">
          
          {/* Thumbnails Grid */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {images.map((imgSrc, idx) => (
              <div key={idx} className="relative rounded-xl overflow-hidden aspect-[4/3] bg-white group/thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={imgSrc} 
                  alt={`Notes page ${idx + 1}`} 
                  className={`w-full h-full object-cover transition-opacity duration-500 ${isBusy ? 'opacity-40 blur-sm' : 'opacity-100'}`}
                />
                {!isBusy && (
                  <button 
                    onClick={() => setImages(images.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 bg-white/60 hover:bg-red-500/80 p-1 rounded-full text-slate-900 backdrop-blur-sm opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <div className="absolute bottom-1 left-1 bg-white/60 px-1.5 py-0.5 rounded text-[10px] text-slate-900 font-mono backdrop-blur-sm">
                  Pg {idx + 1}
                </div>
              </div>
            ))}
            
            {/* Add More Button inside grid */}
            {!isBusy && (
              <button 
                onClick={() => setShowMenu(true)}
                className="relative rounded-xl border border-dashed border-zinc-700 bg-slate-50/50 hover:bg-slate-100/80 flex flex-col items-center justify-center aspect-[4/3] transition-colors"
              >
                <Plus className="w-6 h-6 text-slate-500 mb-1" />
                <span className="text-xs text-slate-400 font-medium">Add Page</span>
              </button>
            )}
          </div>
          
          {isBusy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-white/60 backdrop-blur-sm rounded-3xl">
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_15px_#6366f1] animate-[scan_2s_ease-in-out_infinite]"></div>
              <Loader2 className="w-10 h-10 text-slate-900 animate-spin drop-shadow-xl" />
              <span className="text-slate-900 font-semibold mt-2 drop-shadow-md tracking-wider text-sm uppercase">Analyzing {images.length} Page{images.length > 1 ? 's' : ''}</span>
            </div>
          )}

          {!isBusy && (
            <div className="flex gap-2">
              <button
                onClick={resetScanner}
                className="py-3 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm font-medium text-slate-500 hover:text-zinc-200 transition-colors flex items-center justify-center"
                title="Clear All"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={handleScan}
                className="flex-1 py-3 bg-blue-600 hover:bg-slate-800 rounded-xl text-sm font-bold text-slate-900 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <Check className="w-4 h-4" />
                Done (Extract All)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Choice Popup Modal */}
      {showMenu && (
        <div className="fixed inset-0 bg-white/75 backdrop-blur-sm z-[999] flex items-end sm:items-center justify-center p-4 transition-all duration-300">
          {/* Click outside to close */}
          <div className="absolute inset-0" onClick={() => setShowMenu(false)} />
          
          <div className="relative bg-slate-50 border border-slate-200/80 rounded-t-[32px] sm:rounded-[32px] w-full max-w-sm overflow-hidden p-6 shadow-2xl animate-in slide-in-from-bottom-8 duration-200 z-10">
            {/* Grab handle for mobile */}
            <div className="w-12 h-1 bg-slate-100 rounded-full mx-auto mb-6 sm:hidden" />
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-bold text-indigo-100 tracking-wide">
                ADD HANDWRITTEN NOTES
              </h3>
              <button 
                onClick={() => setShowMenu(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-zinc-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Option 1: Camera */}
              <button
                onClick={() => {
                  setShowMenu(false);
                  triggerCameraInput();
                }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/60 border border-slate-200 hover:border-zinc-700 hover:bg-slate-50 transition-all duration-200 group text-left"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800/10 border border-blue-500/20 text-slate-600 group-hover:scale-105 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 group-hover:text-slate-900">
                    Take Photo
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Scan using your device camera
                  </div>
                </div>
              </button>

              {/* Option 2: Upload */}
              <button
                onClick={() => {
                  setShowMenu(false);
                  triggerUploadInput();
                }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/60 border border-slate-200 hover:border-zinc-700 hover:bg-slate-50 transition-all duration-200 group text-left"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:scale-105 transition-transform">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 group-hover:text-slate-900">
                    Upload from Device
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Choose an existing photo or file
                  </div>
                </div>
              </button>

              {/* Option 3: Type Manually */}
              <button
                onClick={() => {
                  setShowMenu(false);
                  setIsTyping(true);
                }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/60 border border-slate-200 hover:border-zinc-700 hover:bg-slate-50 transition-all duration-200 group text-left"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 group-hover:scale-105 transition-transform">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 group-hover:text-slate-900">
                    Type Notes
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Write down notes manually
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowMenu(false)}
              className="mt-6 w-full py-3.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-zinc-200 rounded-xl text-sm font-bold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 w-full p-3 bg-red-950/40 border border-red-500/30 text-red-400 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <style jsx global>{`
        @keyframes scan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
      `}</style>
    </div>
  );
}
