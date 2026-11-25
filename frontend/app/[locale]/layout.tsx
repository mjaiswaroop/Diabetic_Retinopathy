'use client';

import React from 'react';
import { Locale } from '@/lib/i18n';
import { ShieldCheck } from 'lucide-react';
import { NavigationHeader } from '@/components/ui/NavigationHeader';

export default function LocaleLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: Locale };
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#F1F5F9] text-slate-900 font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation Header with Role Links, Sync Chip, Language & Logout */}
      <NavigationHeader locale={locale} />

      {/* Main Screen Content with constrained 1440px master viewport */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {children}
      </main>

      {/* Persistent Research Prototype / Clinical-Support Disclaimer Banner */}
      <footer className="bg-white text-slate-700 py-3 px-4 border-t border-slate-200 text-center text-xs print:hidden shadow-xs">
        <div className="w-full max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5 px-2">
          <div className="flex items-center gap-2 text-slate-700 text-left">
            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[10px] uppercase tracking-wide border border-amber-300 shrink-0">
              Research Prototype
            </span>
            <span className="text-[11px] leading-tight text-slate-600">
              <strong>Clinical Decision-Support Software:</strong> Designed strictly for triage assistance in investigational research. Not an FDA/CE-marked diagnostic medical device. Final clinical management requires direct evaluation by a certified ophthalmologist.
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium shrink-0">
            <span>ResNet-50 Calibrated (&tau;=0.4106)</span>
            <span>&bull;</span>
            <span>Offline First Local Inference</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

