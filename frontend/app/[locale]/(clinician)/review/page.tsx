'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/offline/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, ChevronRight, Search } from 'lucide-react';

export default function ReviewQueuePage({ params: { locale } }: { params: { locale: string } }) {
  const [filterState, setFilterState] = useState<'all' | 'needs_review' | 'uncertain' | 'referable'>('needs_review');
  const [searchQuery, setSearchQuery] = useState('');

  const screenings = useLiveQuery(async () => {
    return await db.screenings.toArray();
  }, []) || [];

  const filteredScreenings = screenings.filter((s) => {
    const isNeedsReview = s.status === 'needs_review';
    const isUncertain = s.leftEye.prediction?.referralState === 'uncertain' || s.rightEye.prediction?.referralState === 'uncertain';
    const isReferable = s.leftEye.prediction?.referralState === 'referable' || s.rightEye.prediction?.referralState === 'referable';

    if (filterState === 'needs_review' && !isNeedsReview) return false;
    if (filterState === 'uncertain' && !isUncertain) return false;
    if (filterState === 'referable' && !isReferable) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        s.id.toLowerCase().includes(q) ||
        (s.patient.studyId && s.patient.studyId.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900 tracking-tight">Clinician Review Queue</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            FR-08: Triage uncertain cases, patient escalations, and ungradable retinas.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-2xl text-xs font-semibold">
          <button
            onClick={() => setFilterState('needs_review')}
            className={`px-3 py-1.5 rounded-xl transition duration-300 ${
              filterState === 'needs_review' ? 'bg-[#059669] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Needs Review
          </button>
          <button
            onClick={() => setFilterState('uncertain')}
            className={`px-3 py-1.5 rounded-xl transition duration-300 ${
              filterState === 'uncertain' ? 'bg-[#0284c7] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Uncertain
          </button>
          <button
            onClick={() => setFilterState('referable')}
            className={`px-3 py-1.5 rounded-xl transition duration-300 ${
              filterState === 'referable' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Referable
          </button>
          <button
            onClick={() => setFilterState('all')}
            className={`px-3 py-1.5 rounded-xl transition duration-300 ${
              filterState === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
        <input
          type="text"
          placeholder="Search by Study ID or Screening UUID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-[#E2E8F0] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#059669] shadow-sm"
        />
      </div>

      {/* Screenings Table / List */}
      <div className="med-card overflow-hidden divide-y divide-slate-100">
        {filteredScreenings.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="font-semibold text-sm">Review queue is clear</p>
            <p className="text-xs">No cases match the selected filter criteria.</p>
          </div>
        ) : (
          filteredScreenings.map((sc) => {
            const hasReferable =
              sc.leftEye.prediction?.referralState === 'referable' ||
              sc.rightEye.prediction?.referralState === 'referable';
            const hasUncertain =
              sc.leftEye.prediction?.referralState === 'uncertain' ||
              sc.rightEye.prediction?.referralState === 'uncertain';

            return (
              <Link
                key={sc.id}
                href={`/${locale}/review/${sc.id}`}
                className="p-5 flex items-center justify-between hover:bg-slate-50 transition duration-300 group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-sm text-slate-900 group-hover:text-[#059669] transition duration-300">
                      {sc.patient.studyId || sc.id}
                    </span>

                    {/* Urgency Badge */}
                    {hasReferable && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        High Priority (Referable)
                      </span>
                    )}
                    {hasUncertain && !hasReferable && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-[#0284c7] border border-sky-200">
                        Uncertain Case
                      </span>
                    )}
                    {sc.status === 'needs_review' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#059669] border border-emerald-200">
                        Operator Escalated
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 font-medium">
                    Age {sc.patient.age} &bull; Type {sc.patient.diabetesType === 'type_2' ? '2' : '1'} &bull; Site: {sc.siteId} &bull; Captured {new Date(sc.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-[#059669] hidden sm:inline">
                    Open Review
                  </span>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#059669] transition duration-300" />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

