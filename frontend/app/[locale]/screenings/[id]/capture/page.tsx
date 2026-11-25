'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProgressStepper } from '@/components/ui/ProgressStepper';
import { CaptureControl } from '@/components/capture/CaptureControl';
import { db } from '@/lib/offline/db';
import { ScreeningRecord, QualityAssessment } from '@/lib/api/schema';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight } from 'lucide-react';

export default function CaptureScreen({
  params: { locale, id }
}: {
  params: { locale: string; id: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeEye = (searchParams.get('eye') === 'R' ? 'R' : 'L') as 'L' | 'R';

  const screening = useLiveQuery(async () => {
    return await db.screenings.get(id);
  }, [id]);

  const [eyeCaptured, setEyeCaptured] = useState(false);

  useEffect(() => {
    if (screening) {
      const currentEyeData = activeEye === 'L' ? screening.leftEye : screening.rightEye;
      setEyeCaptured(Boolean(currentEyeData?.quality?.gradable || currentEyeData?.unableToCapture));
    }
  }, [screening, activeEye]);

  if (!screening) {
    return (
      <div className="max-w-xl mx-auto p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4 my-8">
        <h3 className="text-base font-semibold text-slate-800">No Screening Found</h3>
        <p className="text-xs text-slate-500">Screening session {id} does not exist in local database.</p>
        <div className="pt-2">
          <button
            onClick={() => router.push(`/${locale}/screenings/new`)}
            className="px-4 py-2 bg-teal-700 text-white rounded-xl text-xs font-semibold hover:bg-teal-800 transition"
          >
            Create New Patient Screening
          </button>
        </div>
      </div>
    );
  }

  const eyeData = activeEye === 'L' ? screening.leftEye : screening.rightEye;
  const eyeLabel = activeEye === 'L' ? 'Left' : 'Right';

  const handleQualityApproved = async (file: File, quality: QualityAssessment) => {
    // Read file as persistent Base64 Data URI so it survives page reloads and cross-page navigation in IndexedDB
    const reader = new FileReader();
    reader.onload = async () => {
      const base64DataUrl = reader.result as string;
      const updatedScreening = { ...screening };
      const target = activeEye === 'L' ? updatedScreening.leftEye : updatedScreening.rightEye;

      target.imageUrl = base64DataUrl;
      target.quality = quality;
      target.capturedAt = new Date().toISOString();
      target.recaptureAttempts = (target.recaptureAttempts || 0) + 1;
      target.unableToCapture = false;

      await db.screenings.put(updatedScreening);
      setEyeCaptured(true);
    };
    reader.readAsDataURL(file);
  };

  const handleMarkUnable = async () => {
    const updatedScreening = { ...screening };
    const target = activeEye === 'L' ? updatedScreening.leftEye : updatedScreening.rightEye;
    target.unableToCapture = true;
    target.recaptureAttempts = (target.recaptureAttempts || 0) + 1;
    await db.screenings.put(updatedScreening);
    setEyeCaptured(true);
  };

  const handleProceedNext = () => {
    if (activeEye === 'L') {
      // Proceed to Right Eye capture
      window.location.href = `/${locale}/screenings/${id}/capture?eye=R`;
    } else {
      // Both eyes captured -> navigate to result / analysis
      window.location.href = `/${locale}/screenings/${id}/result`;
    }
  };

  const handleReferClinician = () => {
    window.location.href = `/${locale}/screenings/${id}/result?escalated=true`;
  };

  return (
    <div className="space-y-4 w-full">
      <ProgressStepper
        currentStep={activeEye === 'L' ? 'leftEye' : 'rightEye'}
        labels={{
          register: 'Register',
          leftEye: 'Left Eye',
          rightEye: 'Right Eye',
          analysis: 'Analysis',
          result: 'Result'
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Patient Context & Screening Tracker (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="med-card p-5 space-y-4 bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="font-heading font-bold text-sm text-slate-900">Patient File</span>
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {screening.id}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Name:</span>
                <span className="font-bold text-slate-800">{screening.patient.name || 'Anonymous'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Demographics:</span>
                <span className="font-semibold text-slate-800">
                  {screening.patient.age} yrs &bull; {screening.patient.sex}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Diabetes Status:</span>
                <span className="font-semibold text-slate-800">
                  Type {screening.patient.diabetesType === 'type_2' ? '2' : '1'} ({screening.patient.diabetesDurationYears} yrs)
                </span>
              </div>
            </div>

            {/* Bilateral Progress Tracker */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Bilateral Progress
              </span>
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className={`p-2 rounded-lg border ${
                  activeEye === 'L'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                    : screening.leftEye.quality?.gradable
                    ? 'bg-white border-slate-200 text-emerald-600 font-semibold'
                    : 'bg-white border-slate-200 text-slate-400'
                }`}>
                  Left Eye (OS)
                  <span className="block text-[10px] mt-0.5 font-normal">
                    {screening.leftEye.quality?.gradable ? '✓ Captured' : activeEye === 'L' ? 'Active' : 'Pending'}
                  </span>
                </div>
                <div className={`p-2 rounded-lg border ${
                  activeEye === 'R'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                    : screening.rightEye.quality?.gradable
                    ? 'bg-white border-slate-200 text-emerald-600 font-semibold'
                    : 'bg-white border-slate-200 text-slate-400'
                }`}>
                  Right Eye (OD)
                  <span className="block text-[10px] mt-0.5 font-normal">
                    {screening.rightEye.quality?.gradable ? '✓ Captured' : activeEye === 'R' ? 'Active' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: High-Density Interactive Capture Station (8 cols on lg) */}
        <div className="lg:col-span-8">
          <div className="med-card p-6 sm:p-7 space-y-6 bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wide">
                  Step {activeEye === 'L' ? '2 of 4' : '3 of 4'}
                </span>
                <h1 className="font-heading text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Capture {eyeLabel} Eye (Fundus)
                </h1>
              </div>
              <span className="text-xs font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full font-bold">
                {activeEye === 'L' ? 'Left Eye (OS)' : 'Right Eye (OD)'}
              </span>
            </div>

            {/* Capture Control Component */}
            <CaptureControl
              eyeSide={activeEye}
              eyeLabel={eyeLabel}
              recaptureAttempts={eyeData.recaptureAttempts || 1}
              maxAttempts={3}
              onQualityApproved={handleQualityApproved}
              onMarkUnableToCapture={handleMarkUnable}
              onReferClinician={handleReferClinician}
              onProceedNext={handleProceedNext}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

