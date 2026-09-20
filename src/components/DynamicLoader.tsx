'use client';

import React, { useState, useEffect } from 'react';
import { Lottie } from 'lottie-react';
const AnyLottie = Lottie as any;

interface DynamicLoaderProps {
  messages?: string[];
  intervalMs?: number;
  animationUrl?: string;
  className?: string;
}

export function DynamicLoader({
  messages = [
    "Analyzing data...",
    "Processing context...",
    "Applying models...",
    "Finalizing details..."
  ],
  intervalMs = 2500,
  animationUrl = "https://lottie.host/7c73a804-500b-4b2a-8926-d35b9148d8b6/7NfWvK1Rj2.json", // High tech scanning lottie
  className = ""
}: DynamicLoaderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    // Fetch the lottie json dynamically
    fetch(animationUrl)
      .then(res => {
        if (!res.ok) throw new Error('Response not ok');
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
           throw new TypeError("Not a JSON response");
        }
        return res.json();
      })
      .then(data => setAnimationData(data))
      .catch(err => console.warn("Failed to load Lottie animation, falling back to CSS spinner"));
  }, [animationUrl]);

  useEffect(() => {
    if (messages.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % messages.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [messages, intervalMs]);

  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
      <div className="w-48 h-48 mb-4 relative flex items-center justify-center">
        {animationData ? (
          <>
            <AnyLottie 
              animationData={animationData} 
              loop={true} 
              style={{ width: '100%', height: '100%' }} 
            />
          </>
        ) : (
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        )}
      </div>
      
      <div className="h-6 relative overflow-hidden w-full max-w-[250px] flex justify-center">
        {messages.map((msg, idx) => (
          <p
            key={idx}
            className={`absolute text-sm font-semibold text-blue-900 transition-all duration-500 transform ${
              idx === currentIndex
                ? "translate-y-0 opacity-100"
                : idx < currentIndex
                ? "-translate-y-full opacity-0"
                : "translate-y-full opacity-0"
            }`}
          >
            {msg}
          </p>
        ))}
      </div>
    </div>
  );
}
