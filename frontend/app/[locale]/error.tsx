'use client';

import React from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-700 mb-4 shadow-sm">
        <AlertTriangle className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h2>
      <p className="text-sm text-slate-500 max-w-md mb-6">
        {error.message || 'An unexpected rendering error occurred. You can safely retry or return to the registration screen.'}
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => reset()}
          className="px-4 py-2.5 bg-teal-700 text-white font-semibold text-sm rounded-xl shadow hover:bg-teal-800 transition flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Retry</span>
        </button>
        <button
          onClick={() => (window.location.href = '/en/screenings/new')}
          className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold text-sm rounded-xl hover:bg-slate-50 transition"
        >
          New Screening
        </button>
      </div>
    </div>
  );
}

