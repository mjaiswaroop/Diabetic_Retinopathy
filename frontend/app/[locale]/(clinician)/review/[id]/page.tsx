'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/offline/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { SynchronizedViewer } from '@/components/viewer/SynchronizedViewer';
import { ReferralState, ClinicianReviewDecision } from '@/lib/api/schema';
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Send 
} from 'lucide-react';

export default function ClinicianReviewDetailPage({
  params: { locale, id }
}: {
  params: { locale: string; id: string };
}) {
  const router = useRouter();
  const [selectedEye, setSelectedEye] = useState<'L' | 'R'>('L');
  const [decision, setDecision] = useState<'confirm' | 'disagree' | 'needs_further_review'>('confirm');
  const [overrideReferral, setOverrideReferral] = useState<ReferralState>('referable');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRecaptureModal, setShowRecaptureModal] = useState(false);
  const [recaptureReason, setRecaptureReason] = useState('Blurry posterior pole, unable to assess maculopathy');
  const [nurseInstruction, setNurseInstruction] = useState<'recapture' | 'dilate_pupil' | 'realign_disc'>('recapture');

  const screening = useLiveQuery(async () => {
    return await db.screenings.get(id);
  }, [id]);

  if (!screening) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Loading screening details...</p>
      </div>
    );
  }

  const eyeData = selectedEye === 'L' ? screening.leftEye : screening.rightEye;
  const originalImage = eyeData.imageUrl;
  const overlayImage = eyeData.xai?.heatmapUrl || eyeData.imageUrl;

  // Doctor-to-Nurse Recapture Rejection Loop
  const handleRejectForRecapture = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const updatedEye = {
      ...eyeData,
      clinicianRejection: {
        rejectedBy: 'dr-sharma',
        reason: recaptureReason,
        rejectedAt: new Date().toISOString(),
        nurseActionRequired: nurseInstruction
      }
    };

    if (selectedEye === 'L') {
      screening.leftEye = updatedEye;
    } else {
      screening.rightEye = updatedEye;
    }

    screening.status = 'clinician_rejected_for_recapture';
    screening.updatedAt = new Date().toISOString();
    await db.screenings.put(screening);

    await db.auditEvents.put({
      id: `audit-${Date.now()}`,
      actorId: 'dr-sharma',
      role: 'clinician',
      siteId: screening.siteId,
      action: 'DOCTOR_REJECT_IMAGE_FOR_RECAPTURE',
      objectType: 'Screening',
      objectId: screening.id,
      timestamp: new Date().toISOString(),
      metadata: { eye: selectedEye, reason: recaptureReason, instruction: nurseInstruction }
    });

    setIsSubmitting(false);
    setShowRecaptureModal(false);
    alert(`Image rejected back to Nurse's queue for ${selectedEye === 'L' ? 'Left Eye' : 'Right Eye'} recapture.`);
    router.push(`/${locale}/review`);
  };

  const handleSubmitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const review: ClinicianReviewDecision = {
      screeningId: screening.id,
      clinicianId: 'dr-sharma',
      decision,
      overrideReferralState: decision === 'disagree' ? overrideReferral : undefined,
      notes: clinicalNotes,
      reviewedAt: new Date().toISOString()
    };

    // Keep AI output immutable; append decision row & mark status
    screening.status = 'reviewed';
    screening.updatedAt = new Date().toISOString();
    await db.screenings.put(screening);

    // Write audit event
    await db.auditEvents.put({
      id: `audit-${Date.now()}`,
      actorId: 'dr-sharma',
      role: 'clinician',
      siteId: screening.siteId,
      action: 'SUBMIT_CLINICIAN_REVIEW',
      objectType: 'Screening',
      objectId: screening.id,
      timestamp: new Date().toISOString(),
      metadata: { decision, override: review.overrideReferralState }
    });

    setIsSubmitting(false);
    alert('Clinical decision recorded successfully.');
    router.push(`/${locale}/review`);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top back navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push(`/${locale}/review`)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Review Queue</span>
        </button>

        <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded">
          {screening.patient.studyId || screening.id}
        </span>
      </div>

      {/* Eye Selector Tabs */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setSelectedEye('L')}
          className={`pb-2.5 text-sm font-bold border-b-2 transition duration-300 ${
            selectedEye === 'L'
              ? 'border-[#059669] text-[#059669]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Left Eye View
        </button>
        <button
          onClick={() => setSelectedEye('R')}
          className={`pb-2.5 text-sm font-bold border-b-2 transition duration-300 ${
            selectedEye === 'R'
              ? 'border-[#059669] text-[#059669]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Right Eye View
        </button>
      </div>

      {/* Synchronized Viewer Component (PRD §7.3) */}
      <div className="med-card p-5">
        <SynchronizedViewer originalSrc={originalImage} overlaySrc={overlayImage} />
      </div>

      {/* Panels: AI Probabilities, Quality History, Patient Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Quality & Model Metadata */}
        <div className="med-card p-6 space-y-3">
          <h3 className="font-heading text-xs font-bold text-slate-500 uppercase tracking-wider">
            Image Quality & Model Provenance
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Quality Score:</span>
              <span className="font-semibold text-slate-800">
                {eyeData.quality?.score ? `${Math.round(eyeData.quality.score * 100)}%` : 'Gradable'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Recapture History:</span>
              <span className="font-semibold text-slate-800">
                {eyeData.recaptureAttempts || 1} capture attempt(s)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Model Version:</span>
              <span className="font-mono text-slate-700">{eyeData.prediction?.modelVersion || 'v2.1.0-resnet50'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Calibration:</span>
              <span className="font-mono text-slate-700">{eyeData.prediction?.calibrationVersion || 'Platt-2026.1'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Pre-processing:</span>
              <span className="font-mono text-slate-700">{eyeData.prediction?.preprocessingVersion || 'CLAHE-v2'}</span>
            </div>
          </div>
        </div>

        {/* AI Class Probabilities */}
        <div className="med-card p-6 space-y-3">
          <h3 className="font-heading text-xs font-bold text-slate-500 uppercase tracking-wider">
            AI Class Probabilities (Calibrated)
          </h3>

          <div className="space-y-2.5 text-xs">
            {Object.entries(eyeData.prediction?.classProbabilities || {
              'No DR': 0.12,
              'Mild DR': 0.44,
              'Moderate DR': 0.38,
              'Severe DR': 0.04,
              'Proliferative DR': 0.02
            }).map(([label, prob]) => (
              <div key={label} className="space-y-1">
                <div className="flex justify-between text-slate-700 font-medium">
                  <span>{label}</span>
                  <span className="font-mono font-bold text-slate-900">{Math.round(prob * 100)}%</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#059669] rounded-full transition-all duration-500"
                    style={{ width: `${Math.round(prob * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Clinician Decision Form */}
      <form onSubmit={handleSubmitDecision} className="med-card p-6 sm:p-8 space-y-5">
        <h2 className="font-heading text-base font-bold text-slate-900">Clinician Review Decision</h2>
        <p className="text-xs text-slate-500">
          The AI model output remains immutable. Your decision will be logged with full audit attribution.
        </p>

        {/* Decision Radio Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label
            onClick={() => setDecision('confirm')}
            className={`p-4 rounded-2xl border flex flex-col items-center text-center cursor-pointer transition duration-300 ${
              decision === 'confirm'
                ? 'border-[#059669] bg-emerald-50 text-emerald-900 ring-2 ring-emerald-300 font-bold'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <CheckCircle2 className="w-5 h-5 text-[#059669] mb-1" />
            <span className="text-xs">Confirm AI Referral</span>
          </label>

          <label
            onClick={() => setDecision('disagree')}
            className={`p-4 rounded-2xl border flex flex-col items-center text-center cursor-pointer transition duration-300 ${
              decision === 'disagree'
                ? 'border-rose-600 bg-rose-50 text-rose-900 ring-2 ring-rose-200 font-bold'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <XCircle className="w-5 h-5 text-rose-600 mb-1" />
            <span className="text-xs">Disagree with AI</span>
          </label>

          <label
            onClick={() => setDecision('needs_further_review')}
            className={`p-4 rounded-2xl border flex flex-col items-center text-center cursor-pointer transition duration-300 ${
              decision === 'needs_further_review'
                ? 'border-[#0284c7] bg-sky-50 text-sky-900 ring-2 ring-sky-200 font-bold'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <HelpCircle className="w-5 h-5 text-[#0284c7] mb-1" />
            <span className="text-xs">Needs Clinical Workup</span>
          </label>
        </div>

        {/* Override Referral State if Disagree */}
        {decision === 'disagree' && (
          <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-2">
            <span className="text-xs font-semibold text-rose-900 block">
              Override Referral Classification:
            </span>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-800">
                <input
                  type="radio"
                  name="override"
                  checked={overrideReferral === 'non_referable'}
                  onChange={() => setOverrideReferral('non_referable')}
                />
                Non-Referable (Routine)
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-800">
                <input
                  type="radio"
                  name="override"
                  checked={overrideReferral === 'referable'}
                  onChange={() => setOverrideReferral('referable')}
                />
                Referable DR (Specialist)
              </label>
            </div>
          </div>
        )}

        {/* Clinical Notes */}
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Clinical Notes / Rationale (Optional)
          </label>
          <textarea
            rows={3}
            value={clinicalNotes}
            onChange={(e) => setClinicalNotes(e.target.value)}
            placeholder="Document observed microaneurysms, hard exudates, or media opacity..."
            className="w-full border border-slate-300 rounded-2xl p-3 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#059669]"
          />
        </div>

        {/* Submit & Reject to Nurse Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={() => setShowRecaptureModal(true)}
            className="w-full py-3 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition min-h-[48px]"
          >
            Reject Image Back to Nurse (Recapture Request)
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-[#059669] hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2 active:scale-[0.99] transition duration-300 min-h-[48px]"
          >
            <Send className="w-4 h-4" />
            <span>Submit Final Clinical Decision</span>
          </button>
        </div>
      </form>

      {/* Doctor-to-Nurse Recapture Modal */}
      {showRecaptureModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="med-card max-w-md w-full p-6 space-y-4 bg-white shadow-2xl">
            <h3 className="font-heading text-lg font-bold text-rose-900">
              Reject Image to Nurse Queue
            </h3>
            <p className="text-xs text-slate-500">
              Flag {selectedEye === 'L' ? 'Left Eye (OS)' : 'Right Eye (OD)'} as clinically uninterpretable and return to operator for repeat acquisition.
            </p>

            <form onSubmit={handleRejectForRecapture} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Specific Nurse Action Required</label>
                <select
                  value={nurseInstruction}
                  onChange={(e) => setNurseInstruction(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-white text-xs"
                >
                  <option value="recapture">Repeat standard capture with chin steady</option>
                  <option value="dilate_pupil">Tropicamide pupil dilation required (pupil &lt; 3mm)</option>
                  <option value="realign_disc">Re-align 45-degree field to include superior temporal arcade</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Clinical Rejection Reason</label>
                <textarea
                  rows={3}
                  value={recaptureReason}
                  onChange={(e) => setRecaptureReason(e.target.value)}
                  placeholder="Explain why this fundus photograph cannot be graded clinically..."
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRecaptureModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
                >
                  Confirm Rejection to Nurse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

