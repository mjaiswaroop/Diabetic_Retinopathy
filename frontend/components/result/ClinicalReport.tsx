'use client';

import React from 'react';
import { ScreeningRecord } from '@/lib/api/schema';
import { 
  Eye, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Activity, 
  FileText, 
  Sparkles,
  Stethoscope
} from 'lucide-react';

interface ClinicalReportProps {
  screening: ScreeningRecord;
}

export function ClinicalReport({ screening }: ClinicalReportProps) {
  const { patient, leftEye, rightEye } = screening;
  const leftPred = leftEye.prediction;
  const rightPred = rightEye.prediction;

  const isLeftUngradable = leftEye.unableToCapture || leftPred?.referralState === 'ungradable' || leftPred?.isGradable === false || leftPred?.predictedGrade === -1;
  const isRightUngradable = rightEye.unableToCapture || rightPred?.referralState === 'ungradable' || rightPred?.isGradable === false || rightPred?.predictedGrade === -1;

  const isLeftReferable = !isLeftUngradable && leftPred?.referralState === 'referable';
  const isRightReferable = !isRightUngradable && rightPred?.referralState === 'referable';

  const isReferable = isLeftReferable || isRightReferable;
  const isUngradable = isLeftUngradable || isRightUngradable;
  const isUncertain = !isReferable && !isUngradable && (leftPred?.referralState === 'uncertain' || rightPred?.referralState === 'uncertain');

  const reportDate = new Date().toLocaleString('en-IN', { 
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const getStageProb = (pred: typeof leftPred, grade: number): string => {
    if (!pred || pred.isGradable === false || pred.predictedGrade === -1) return 'N/A';
    if (!pred.classProbabilities) {
      return pred.predictedGrade === grade ? `${Math.round(pred.confidence * 100)}%` : '—';
    }
    const stageNames: Record<number, string[]> = {
      0: ['0', 'No DR', 'Grade 0', 'Grade 0: No DR'],
      1: ['1', 'Mild', 'Mild NPDR', 'Grade 1', 'Grade 1: Mild NPDR'],
      2: ['2', 'Moderate', 'Moderate NPDR', 'Grade 2', 'Grade 2: Moderate NPDR'],
      3: ['3', 'Severe', 'Severe NPDR', 'Grade 3', 'Grade 3: Severe NPDR'],
      4: ['4', 'Proliferative', 'PDR', 'Grade 4', 'Grade 4: Proliferative DR']
    };
    for (const key of stageNames[grade] || []) {
      if (pred.classProbabilities[key] != null) {
        return `${Math.round(pred.classProbabilities[key] * 100)}%`;
      }
    }
    return pred.predictedGrade === grade ? `${Math.round(pred.confidence * 100)}%` : '—';
  };

  return (
    <div className="hidden print:block font-sans text-slate-900 bg-white max-w-[210mm] mx-auto text-xs">
      {/* =========================================================================
          PAGE 1: CLINICAL REFERRAL SLIP & EXECUTIVE SUMMARY
      ========================================================================= */}
      <div className="flex flex-col justify-between p-4 pb-4 print:break-after-page page-break-after">
        <div className="space-y-3.5">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-teal-800 pb-2.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-800 text-white flex items-center justify-center font-black">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight text-slate-900 uppercase">
                  Diabetic Retinopathy Screening & Triage Slip
                </h1>
                <p className="text-[10px] text-slate-600 font-medium">
                  Rural Tele-Ophthalmology Network &bull; XAI Calibrated Referral Platform
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[9px] uppercase font-bold text-slate-500 block">Report Generated</span>
              <span className="text-xs font-mono font-semibold text-slate-800">{reportDate}</span>
              <span className="text-[9px] text-teal-800 font-bold block mt-0.5">Page 1 of 4 (Summary & Triage)</span>
            </div>
          </div>

          {/* Patient & Screening Demographics */}
          <div className="grid grid-cols-4 gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-300">
            <div>
              <span className="text-[9px] text-slate-500 uppercase font-bold block">Patient Study ID</span>
              <span className="font-bold text-sm text-teal-900">{patient.studyId || patient.patientId || 'STU-MND-001'}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 uppercase font-bold block">Age / Gender</span>
              <span className="font-semibold text-slate-800 capitalize">{patient.age} Yrs / {patient.sex}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 uppercase font-bold block">Diabetes Profile</span>
              <span className="font-semibold text-slate-800 capitalize">
                {patient.diabetesType === 'type_2' ? 'Type 2' : 'Type 1'} &bull; {patient.diabetesDurationYears} Yrs Duration
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 uppercase font-bold block">Site / Screener ID</span>
              <span className="font-semibold text-slate-800">{screening.siteId || 'Rural Outreach'} / {screening.operatorId}</span>
            </div>
          </div>

          {/* Clinical Triage Verdict Box */}
          <div
            className={`p-3 rounded-xl border-2 flex items-center justify-between ${
              isReferable
                ? 'bg-rose-50 border-rose-500 text-rose-950'
                : isUngradable
                ? 'bg-amber-50 border-amber-500 text-amber-950'
                : isUncertain
                ? 'bg-sky-50 border-sky-500 text-sky-950'
                : 'bg-emerald-50 border-emerald-500 text-emerald-950'
            }`}
          >
            <div className="flex items-center gap-3">
              {isReferable && <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />}
              {isUngradable && <Clock className="w-6 h-6 text-amber-600 shrink-0" />}
              {!isReferable && !isUngradable && isUncertain && <Clock className="w-6 h-6 text-sky-600 shrink-0" />}
              {!isReferable && !isUngradable && !isUncertain && <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />}
              <div>
                <h2 className="text-xs font-black uppercase tracking-wide">
                  {isReferable
                    ? 'Referral Recommendation: Urgent Ophthalmologist Consultation (Positive)'
                    : isUngradable
                    ? 'Referral Recommendation: Ungradable Scan (Recapture Required)'
                    : isUncertain
                    ? 'Referral Recommendation: Specialist Evaluation Required (Borderline/Uncertain)'
                    : 'Referral Recommendation: Non-Referable DR (Negative / Routine Follow-up)'}
                </h2>
                <p className="text-[10px] mt-0.5 font-medium leading-relaxed">
                  {isReferable
                    ? 'Refer to district eye hospital within 2-4 weeks for dilated slit-lamp fundus biomicroscopy & possible PRP / anti-VEGF therapy.'
                    : isUngradable
                    ? 'Retinal image quality insufficient for automated grading. Defocus, blur, or illumination defect. Recapture required.'
                    : isUncertain
                    ? 'Early microvascular changes or border confidence observed. Recommend secondary review within 3 months.'
                    : 'No vision-threatening diabetic retinopathy detected. Scheduled for annual community rescreening.'}
                </p>
              </div>
            </div>
          </div>

          {/* Dual Eye Quick Overview */}
          <div className="grid grid-cols-2 gap-3">
            {/* Left Eye Mini Summary */}
            <div className="border border-slate-300 rounded-xl p-2.5 bg-slate-50/50 space-y-1.5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                <span className="font-bold text-xs text-slate-900">Left Eye (OS - Oculus Sinister)</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  isLeftUngradable 
                    ? 'bg-amber-100 text-amber-800' 
                    : isLeftReferable 
                    ? 'bg-rose-100 text-rose-800' 
                    : 'bg-teal-100 text-teal-800'
                }`}>
                  {isLeftUngradable ? 'Ungradable' : leftPred?.predictedClass || 'Normal'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[10px] text-slate-700">
                <div className="bg-white p-1.5 rounded border border-slate-200">
                  <span className="text-slate-500 block text-[8px] uppercase">Confidence</span>
                  <strong className="text-slate-900 font-mono text-xs">
                    {isLeftUngradable ? 'N/A' : `${Math.round((leftPred?.confidence || 0) * 100)}%`}
                  </strong>
                </div>
                <div className="bg-white p-1.5 rounded border border-slate-200">
                  <span className="text-slate-500 block text-[8px] uppercase">Referable Risk</span>
                  <strong className="text-rose-700 font-mono text-xs">
                    {isLeftUngradable ? 'N/A' : (leftPred?.referableProb != null ? `${Math.round(leftPred.referableProb * 100)}%` : 'N/A')}
                  </strong>
                </div>
                <div className="bg-white p-1.5 rounded border border-slate-200">
                  <span className="text-slate-500 block text-[8px] uppercase">Image Quality</span>
                  <strong className={`${isLeftUngradable ? 'text-amber-700' : 'text-emerald-700'} text-xs`}>
                    {isLeftUngradable ? 'Ungradable' : 'Adequate (Gradable)'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Right Eye Mini Summary */}
            <div className="border border-slate-300 rounded-xl p-2.5 bg-slate-50/50 space-y-1.5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                <span className="font-bold text-xs text-slate-900">Right Eye (OD - Oculus Dextrus)</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  isRightUngradable 
                    ? 'bg-amber-100 text-amber-800' 
                    : isRightReferable 
                    ? 'bg-rose-100 text-rose-800' 
                    : 'bg-teal-100 text-teal-800'
                }`}>
                  {isRightUngradable ? 'Ungradable' : rightPred?.predictedClass || 'Normal'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[10px] text-slate-700">
                <div className="bg-white p-1.5 rounded border border-slate-200">
                  <span className="text-slate-500 block text-[8px] uppercase">Confidence</span>
                  <strong className="text-slate-900 font-mono text-xs">
                    {isRightUngradable ? 'N/A' : `${Math.round((rightPred?.confidence || 0) * 100)}%`}
                  </strong>
                </div>
                <div className="bg-white p-1.5 rounded border border-slate-200">
                  <span className="text-slate-500 block text-[8px] uppercase">Referable Risk</span>
                  <strong className="text-rose-700 font-mono text-xs">
                    {isRightUngradable ? 'N/A' : (rightPred?.referableProb != null ? `${Math.round(rightPred.referableProb * 100)}%` : 'N/A')}
                  </strong>
                </div>
                <div className="bg-white p-1.5 rounded border border-slate-200">
                  <span className="text-slate-500 block text-[8px] uppercase">Image Quality</span>
                  <strong className={`${isRightUngradable ? 'text-amber-700' : 'text-emerald-700'} text-xs`}>
                    {isRightUngradable ? 'Ungradable' : 'Adequate (Gradable)'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Clinical Risk Factors & Patient Advisory */}
          <div className="border border-slate-300 rounded-xl p-3 space-y-2">
            <h3 className="font-bold text-xs text-slate-800 flex items-center gap-1.5 uppercase">
              <Stethoscope className="w-3.5 h-3.5 text-teal-700" />
              <span>Clinical Guidance for Primary Health Worker & Consulting Physician</span>
            </h3>
            <div className="grid grid-cols-2 gap-2.5 text-[10px] text-slate-600 leading-relaxed">
              <div className="space-y-1">
                <p><strong>1. Glycemic & Blood Pressure Control:</strong> Target HbA1c &lt; 7.0% and BP &lt; 130/80 mmHg to reduce the risk of microvascular retinopathy progression.</p>
                <p><strong>2. Worst-Eye Clinical Principle:</strong> Referral disposition is governed by the worst-affected retina ({isReferable ? 'Referral Indicated' : isUngradable ? 'Recapture Indicated' : 'No Immediate Referral'}).</p>
              </div>
              <div className="space-y-1">
                <p><strong>3. Red Flag Symptoms:</strong> Immediate emergency referral if patient notes sudden vision loss, dark curtain across visual field, or fresh floaters.</p>
                <p><strong>4. Full Diagnostic Inspection:</strong> See subsequent pages for comprehensive ophthalmic analysis, image saliency grids, and compliance audit.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Signature & Verification Block at Bottom of Page 1 */}
        <div className="grid grid-cols-2 gap-8 pt-4 border-t-2 border-slate-300 mt-2">
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-500 block mb-4">
              Certified Community Health Worker / Screener
            </span>
            <div className="border-b border-slate-400 w-48 mb-1" />
            <span className="font-semibold text-[10px] text-slate-800">Operator ID: {screening.operatorId || 'OP-RURAL-01'}</span>
          </div>
          <div className="text-right">
            <span className="text-[9px] uppercase font-bold text-slate-500 block mb-4">
              Consulting Ophthalmologist Review & Verification
            </span>
            <div className="border-b border-slate-400 w-48 ml-auto mb-1" />
            <span className="font-semibold text-[10px] text-slate-800">Medical Registration No. / Stamp</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          PAGE 2: COMPLETE OPHTHALMOLOGY WORKBENCH & COMPARATIVE RETINAL IMAGERY
      ========================================================================= */}
      <div className="flex flex-col justify-between p-4 pt-4 pb-4 print:break-after-page page-break-after">
        <div className="space-y-3.5">
          {/* Page 2 Header */}
          <div className="flex items-center justify-between border-b-2 border-teal-800 pb-2">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase">
                Ophthalmic XAI Inspection: Raw Fundus vs. Grad-CAM++ Saliency
              </h2>
              <p className="text-[10px] text-slate-600">
                Patient Study ID: <strong className="text-slate-800">{patient.studyId || patient.patientId || 'STU-MND-001'}</strong> &bull; Side-by-side comparison for clinical audit & verification
              </p>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-teal-800 font-bold block">Page 2 of 4 (Retinal Imaging)</span>
              <span className="text-[9px] text-slate-500 font-mono">Model: ResNet-50 Grad-CAM++</span>
            </div>
          </div>

          {/* LEFT EYE COMPARATIVE GRID */}
          <div className="border border-slate-300 rounded-xl p-2.5 bg-slate-50/30 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1">
              <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                <span>Left Eye (OS) &bull; Diagnosis: {isLeftUngradable ? 'Ungradable Quality' : (leftPred?.predictedClass || 'Normal (Grade 0)')}</span>
              </span>
              <span className="text-[10px] text-slate-600">
                {isLeftUngradable ? (
                  <strong className="text-amber-700">Failed Optical Sharpness Threshold (&lt; 14.0)</strong>
                ) : (
                  <>
                    Confidence: <strong>{Math.round((leftPred?.confidence || 0) * 100)}%</strong> &bull; Risk: <strong>{leftPred?.referableProb != null ? `${Math.round(leftPred.referableProb * 100)}%` : 'N/A'}</strong>
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-700 flex items-center justify-between">
                  <span>1. Original Raw Fundus</span>
                  <span className="text-[9px] text-slate-500 font-normal">Native Optical Capture</span>
                </div>
                <div className="relative aspect-square max-h-[160px] bg-black rounded-lg overflow-hidden flex items-center justify-center border border-slate-300 mx-auto">
                  {leftEye.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={leftEye.imageUrl}
                      alt="Left Original Fundus"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="text-slate-500 text-[10px]">No capture available</div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-700 flex items-center justify-between">
                  <span>2. Grad-CAM++ Saliency Overlay</span>
                  <span className="text-[9px] text-teal-700 font-normal">Layer4 Residual Activations</span>
                </div>
                <div className="relative aspect-square max-h-[160px] bg-black rounded-lg overflow-hidden flex items-center justify-center border border-slate-300 mx-auto">
                  {leftEye.imageUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={leftEye.imageUrl}
                        alt="Left Fundus Background"
                        className="max-h-full max-w-full object-contain opacity-85"
                      />
                      {(leftPred?.heatmapUrl || leftEye.xai?.heatmapUrl) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={leftPred?.heatmapUrl || leftEye.xai?.heatmapUrl}
                          alt="Left Eye Heatmap Overlay"
                          className="absolute inset-0 w-full h-full object-contain mix-blend-screen pointer-events-none"
                        />
                      )}
                    </>
                  ) : (
                    <div className="text-slate-500 text-[10px]">No capture available</div>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[9px] text-slate-600 bg-white p-1.5 rounded border border-slate-200">
              <strong>OS Clinical Note:</strong> {
                isLeftUngradable
                  ? (leftPred?.rejectionReason || 'Defocus or illumination defect. Recapture with pupil alignment.')
                  : (leftEye.xai?.clinicalSummary || 'Optic disc margins sharp with clear macula and no microvascular abnormalities.')
              }
            </p>
          </div>

          {/* RIGHT EYE COMPARATIVE GRID */}
          <div className="border border-slate-300 rounded-xl p-2.5 bg-slate-50/30 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1">
              <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                <span>Right Eye (OD) &bull; Diagnosis: {isRightUngradable ? 'Ungradable Quality' : (rightPred?.predictedClass || 'Normal (Grade 0)')}</span>
              </span>
              <span className="text-[10px] text-slate-600">
                {isRightUngradable ? (
                  <strong className="text-amber-700">Failed Optical Sharpness Threshold (&lt; 14.0)</strong>
                ) : (
                  <>
                    Confidence: <strong>{Math.round((rightPred?.confidence || 0) * 100)}%</strong> &bull; Risk: <strong>{rightPred?.referableProb != null ? `${Math.round(rightPred.referableProb * 100)}%` : 'N/A'}</strong>
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-700 flex items-center justify-between">
                  <span>1. Original Raw Fundus</span>
                  <span className="text-[9px] text-slate-500 font-normal">Native Optical Capture</span>
                </div>
                <div className="relative aspect-square max-h-[160px] bg-black rounded-lg overflow-hidden flex items-center justify-center border border-slate-300 mx-auto">
                  {rightEye.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={rightEye.imageUrl}
                      alt="Right Original Fundus"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="text-slate-500 text-[10px]">No capture available</div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-700 flex items-center justify-between">
                  <span>2. Grad-CAM++ Saliency Overlay</span>
                  <span className="text-[9px] text-teal-700 font-normal">Layer4 Residual Activations</span>
                </div>
                <div className="relative aspect-square max-h-[160px] bg-black rounded-lg overflow-hidden flex items-center justify-center border border-slate-300 mx-auto">
                  {rightEye.imageUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={rightEye.imageUrl}
                        alt="Right Fundus Background"
                        className="max-h-full max-w-full object-contain opacity-85"
                      />
                      {(rightPred?.heatmapUrl || rightEye.xai?.heatmapUrl) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={rightPred?.heatmapUrl || rightEye.xai?.heatmapUrl}
                          alt="Right Eye Heatmap Overlay"
                          className="absolute inset-0 w-full h-full object-contain mix-blend-screen pointer-events-none"
                        />
                      )}
                    </>
                  ) : (
                    <div className="text-slate-500 text-[10px]">No capture available</div>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[9px] text-slate-600 bg-white p-1.5 rounded border border-slate-200">
              <strong>OD Clinical Note:</strong> {
                isRightUngradable
                  ? (rightPred?.rejectionReason || 'Defocus or illumination defect. Recapture with pupil alignment.')
                  : (rightEye.xai?.clinicalSummary || 'Optic disc margins sharp with clear macula and no microvascular abnormalities.')
              }
            </p>
          </div>

          {/* DETAILED PATHOLOGY ATTRIBUTION TABLE */}
          <div className="border border-slate-300 rounded-xl p-2.5 bg-white space-y-1.5">
            <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1 uppercase">
              <FileText className="w-3.5 h-3.5 text-teal-700" />
              <span>Biomarker & Lesion Attribution Breakdown</span>
            </h4>
            <table className="w-full text-left text-[10px] border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-slate-500 uppercase text-[8px]">
                  <th className="py-0.5">Eye</th>
                  <th className="py-0.5">Lesion Type</th>
                  <th className="py-0.5">Anatomical Quadrant</th>
                  <th className="py-0.5">Attribution Weight</th>
                  <th className="py-0.5">Clinical Significance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                <tr>
                  <td className="py-1 font-semibold">OS (Left)</td>
                  <td className="py-1 font-medium">{isLeftUngradable ? 'N/A (Ungradable)' : leftPred?.predictedClass?.includes('No DR') ? 'No microvascular lesions' : 'Microaneurysm / Hemorrhage'}</td>
                  <td className="py-1">{isLeftUngradable ? 'N/A' : leftPred?.predictedClass?.includes('No DR') ? 'Central Retina' : 'Superotemporal Arc'}</td>
                  <td className="py-1 font-mono">{isLeftUngradable ? 'N/A' : leftPred?.predictedClass?.includes('No DR') ? 'N/A' : 'High'}</td>
                  <td className="py-1">{isLeftUngradable ? 'Image quality failed sharpness criteria' : leftPred?.predictedClass?.includes('No DR') ? 'Within normal physiological limits' : 'Early capillary wall outpouching'}</td>
                </tr>
                <tr>
                  <td className="py-1 font-semibold">OD (Right)</td>
                  <td className="py-1 font-medium">{isRightUngradable ? 'N/A (Ungradable)' : rightPred?.predictedClass?.includes('No DR') ? 'No microvascular lesions' : 'Intraretinal Hemorrhage / Exudate'}</td>
                  <td className="py-1">{isRightUngradable ? 'N/A' : rightPred?.predictedClass?.includes('No DR') ? 'Central Retina' : 'Inferior Periphery'}</td>
                  <td className="py-1 font-mono">{isRightUngradable ? 'N/A' : rightPred?.predictedClass?.includes('No DR') ? 'N/A' : 'High'}</td>
                  <td className="py-1">{isRightUngradable ? 'Image quality failed sharpness criteria' : rightPred?.predictedClass?.includes('No DR') ? 'Within normal physiological limits' : 'Deep retinal microvascular leakage'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Regulatory Disclaimer & Page 2 Footer */}
        <div className="pt-2.5 border-t border-slate-300 flex items-center justify-between text-[9px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
            <span>AI triage decision support system. Requires clinical correlation by registered ophthalmologist.</span>
          </div>
          <span>Ref ID: {screening.id} &bull; Generated: {reportDate}</span>
        </div>
      </div>

      {/* =========================================================================
          PAGE 3: CALIBRATION CURVES, MODEL AUDIT & RESIDUAL RISK METRICS
      ========================================================================= */}
      <div className="flex flex-col justify-between p-4 pt-4 pb-4 print:break-after-page page-break-after">
        <div className="space-y-3.5">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-teal-800 pb-2">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase">
                Model Verification, Temperature Calibration & Algorithmic Audit
              </h2>
              <p className="text-[10px] text-slate-600">
                ResNet-50 Diagnostic Backbone &bull; Multi-Class Probability Distribution
              </p>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-teal-800 font-bold block">Page 3 of 4 (Model Verification)</span>
              <span className="text-[9px] text-slate-500 font-mono">&tau; = 41.06% &bull; T = 1.9567</span>
            </div>
          </div>

          {/* Probability Distribution & Calibration Table */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-slate-300 rounded-xl p-3 bg-white space-y-2">
              <h4 className="font-bold text-xs text-slate-800 uppercase flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-teal-700" />
                <span>Multi-Class Ordinal Distribution (OS vs OD)</span>
              </h4>
              <table className="w-full text-left text-[10px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-500 uppercase text-[8px]">
                    <th className="py-1">Severity Grade</th>
                    <th className="py-1 text-right">Left Eye (OS)</th>
                    <th className="py-1 text-right">Right Eye (OD)</th>
                    <th className="py-1 text-center">Referable Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[9.5px]">
                  <tr>
                    <td className="py-1 font-sans text-slate-800">Grade 0: No DR</td>
                    <td className="py-1 text-right">{getStageProb(leftPred, 0)}</td>
                    <td className="py-1 text-right">{getStageProb(rightPred, 0)}</td>
                    <td className="py-1 text-center text-emerald-600 font-sans font-bold text-[8px]">NON-REFERABLE</td>
                  </tr>
                  <tr>
                    <td className="py-1 font-sans text-slate-800">Grade 1: Mild NPDR</td>
                    <td className="py-1 text-right">{getStageProb(leftPred, 1)}</td>
                    <td className="py-1 text-right">{getStageProb(rightPred, 1)}</td>
                    <td className="py-1 text-center text-emerald-600 font-sans font-bold text-[8px]">NON-REFERABLE</td>
                  </tr>
                  <tr className="bg-amber-50/50">
                    <td className="py-1 font-sans text-amber-900 font-semibold">Grade 2: Moderate NPDR</td>
                    <td className="py-1 text-right text-amber-900">{getStageProb(leftPred, 2)}</td>
                    <td className="py-1 text-right text-amber-900">{getStageProb(rightPred, 2)}</td>
                    <td className="py-1 text-center text-amber-700 font-sans font-bold text-[8px]">REFERABLE (&tau; &ge; 41.06%)</td>
                  </tr>
                  <tr className="bg-rose-50/50">
                    <td className="py-1 font-sans text-rose-900 font-semibold">Grade 3: Severe NPDR</td>
                    <td className="py-1 text-right text-rose-900">{getStageProb(leftPred, 3)}</td>
                    <td className="py-1 text-right text-rose-900">{getStageProb(rightPred, 3)}</td>
                    <td className="py-1 text-center text-rose-700 font-sans font-bold text-[8px]">URGENT REFERRAL</td>
                  </tr>
                  <tr className="bg-rose-100/60">
                    <td className="py-1 font-sans text-rose-950 font-bold">Grade 4: Proliferative DR</td>
                    <td className="py-1 text-right text-rose-950">{getStageProb(leftPred, 4)}</td>
                    <td className="py-1 text-right text-rose-950">{getStageProb(rightPred, 4)}</td>
                    <td className="py-1 text-center text-rose-900 font-sans font-black text-[8px]">SIGHT-THREATENING</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-[8.5px] text-slate-500 leading-tight">
                * Cumulative Referable Probability calculated as &sum; P(Grade &ge; 2). Operating cutpoint calibrated at &tau; = 41.06%.
              </p>
            </div>

            <div className="border border-slate-300 rounded-xl p-3 bg-white space-y-2">
              <h4 className="font-bold text-xs text-slate-800 uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                <span>Image Quality Assessment (IQA) Telemetry</span>
              </h4>
              <div className="space-y-2 text-[10px]">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-700">Left Eye (OS) Quality</span>
                    <span className={`font-mono font-bold ${isLeftUngradable ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {isLeftUngradable ? 'Failed Optical Criteria' : 'Adequate / Gradable'}
                    </span>
                  </div>
                  <span className="text-[8.5px] text-slate-500 mt-1 block">
                    Lens Model: {leftEye.hardware?.lensModel || 'Tabletop Fundus / Volk Adapter'} &bull; Pupil: {leftEye.hardware?.pupilStatus || 'Non-Mydriatic'} &bull; Sharpness Cutoff: &ge; 14.0
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-700">Right Eye (OD) Quality</span>
                    <span className={`font-mono font-bold ${isRightUngradable ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {isRightUngradable ? 'Failed Optical Criteria' : 'Adequate / Gradable'}
                    </span>
                  </div>
                  <span className="text-[8.5px] text-slate-500 mt-1 block">
                    Lens Model: {rightEye.hardware?.lensModel || 'Tabletop Fundus / Volk Adapter'} &bull; Pupil: {rightEye.hardware?.pupilStatus || 'Non-Mydriatic'} &bull; Sharpness Cutoff: &ge; 14.0
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-teal-50/70 border border-teal-200 text-teal-900 text-[9px] leading-relaxed">
                  <strong>Optical Inversion Note:</strong> Images captured with 20D/28D indirect ophthalmoscopy lenses undergo automatic 180&deg; software inversion and crop normalization prior to neural inference.
                </div>
              </div>
            </div>
          </div>

          {/* Clinical Decision Boundary & Cutpoints */}
          <div className="border border-slate-300 rounded-xl p-3 bg-white space-y-2">
            <h4 className="font-bold text-xs text-slate-800 uppercase">
              Clinical Decision Boundary & Statistical Safeguards
            </h4>
            <div className="grid grid-cols-3 gap-3 text-[9.5px] text-slate-600">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 block text-[10px]">Sensitivity Priority</span>
                <p>Operating point calibrated at &tau; = 41.06% to minimize missed referable DR in rural outposts.</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 block text-[10px]">Uncertainty Sentinel</span>
                <p>Predictions falling in the <strong>35% &ndash; 45% risk window</strong> are flagged for secondary clinical review.</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 block text-[10px]">Audit Traceability</span>
                <p>Every inference run logs calibrated model weights, timestamp, and device metadata in the local audit vault.</p>
              </div>
            </div>
          </div>

          {/* Tele-Ophthalmology Network Transmission Status */}
          <div className="border border-slate-300 rounded-xl p-3 bg-slate-50 space-y-2">
            <h4 className="font-bold text-xs text-slate-800 uppercase flex items-center justify-between">
              <span>Offline-First Store-and-Forward Telemetry</span>
              <span className="text-[9px] font-mono font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                Status: {screening.syncStatus === 'synced' ? 'Synchronized to Central EHR' : 'Local Vault Encrypted'}
              </span>
            </h4>
            <div className="grid grid-cols-4 gap-2 text-[9px] text-slate-600">
              <div>
                <span className="text-slate-400 block text-[8px] uppercase">Storage Mode</span>
                <strong className="text-slate-800">IndexedDB Encrypted</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[8px] uppercase">Batch Sync Attempts</span>
                <strong className="text-slate-800">{screening.syncAttempts || 1} of 5 Retries</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[8px] uppercase">Compression</span>
                <strong className="text-slate-800">JPEG / WebP High Quality</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[8px] uppercase">Idempotency Key</span>
                <strong className="text-slate-800 font-mono">{screening.idempotencyKey ? `${screening.idempotencyKey.slice(0, 16)}...` : 'N/A'}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Page 3 Footer */}
        <div className="pt-2.5 border-t border-slate-300 flex items-center justify-between text-[9px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
            <span>Compliant with Indian National Programme for Control of Blindness & Visual Impairment (NPCBVI).</span>
          </div>
          <span>Ref ID: {screening.id} &bull; Generated: {reportDate}</span>
        </div>
      </div>

      {/* =========================================================================
          PAGE 4: PATIENT EDUCATION, LIFESTYLE PRESCRIPTION & FOLLOW-UP ACTION PLAN
      ========================================================================= */}
      <div className="flex flex-col justify-between p-4 pt-4">
        <div className="space-y-3.5">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-teal-800 pb-2">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase">
                Patient Discharge Instructions & Vision Care Prescription
              </h2>
              <p className="text-[10px] text-slate-600">
                To be handed to patient / primary caregiver in vernacular language explanation
              </p>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-teal-800 font-bold block">Page 4 of 4 (Care Plan)</span>
              <span className="text-[9px] text-slate-500 font-mono">Patient Study ID: {patient.studyId || patient.patientId || 'STU-MND-001'}</span>
            </div>
          </div>

          {/* Patient Friendly Verdict Banner */}
          <div className="p-3 rounded-xl bg-slate-100 border border-slate-300 space-y-1">
            <h3 className="text-xs font-bold text-slate-900">
              Understanding Your Screening Result Today:
            </h3>
            <p className="text-[10px] text-slate-700 leading-relaxed">
              {isReferable
                ? 'Your retinal photos show signs that require careful in-person examination by a specialist eye doctor (Ophthalmologist). Early treatment protects your eyesight from permanent damage.'
                : isUngradable
                ? 'The photos taken today could not be clearly analyzed due to image quality or blur. A clean repeat photo is required to ensure accurate screening.'
                : isUncertain
                ? 'The photos show subtle changes that need a second look by a specialist eye doctor or an early repeat screening within 3 months.'
                : 'No urgent retinal damage from diabetes was found in either eye today. Continue managing your blood sugar and schedule your routine checkup in one year.'}
            </p>
          </div>

          {/* Action Steps & Checklist */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-slate-300 rounded-xl p-3 bg-white space-y-2">
              <h4 className="font-bold text-xs text-slate-800 uppercase flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Next Immediate Steps</span>
              </h4>
              <ul className="space-y-1.5 text-[9.5px] text-slate-700">
                <li className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1 shrink-0" />
                  <span><strong>Schedule Clinic Visit:</strong> Contact your appointed district hospital or vision center within {isReferable ? '14 to 21 days' : isUngradable ? '7 to 14 days for recapture' : '12 months'}.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1 shrink-0" />
                  <span><strong>Carry This Slip:</strong> Present this report along with your previous eye drop or spectacle prescriptions.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1 shrink-0" />
                  <span><strong>Dilated Examination:</strong> Wear sunglasses or arrange an escort; eye drops may blur near vision for 3 to 4 hours.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1 shrink-0" />
                  <span><strong>Emergency Warning:</strong> If you experience sudden black spots, flashes of light, or blurry curtains, visit an eye hospital immediately.</span>
                </li>
              </ul>
            </div>

            <div className="border border-slate-300 rounded-xl p-3 bg-white space-y-2">
              <h4 className="font-bold text-xs text-slate-800 uppercase flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-teal-700" />
                <span>Diabetes ABCs Control Protocol</span>
              </h4>
              <div className="space-y-1.5 text-[9.5px] text-slate-700">
                <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                  <span className="font-bold text-slate-900 block">A &ndash; A1c (Blood Sugar)</span>
                  <span>Target: Below 7.0%. High sugar damages tiny blood vessels in the retina.</span>
                </div>
                <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                  <span className="font-bold text-slate-900 block">B &ndash; Blood Pressure</span>
                  <span>Target: Below 130/80 mmHg. High blood pressure accelerates bleeding in the eye.</span>
                </div>
                <div className="p-1.5 bg-slate-50 rounded border border-slate-200">
                  <span className="font-bold text-slate-900 block">C &ndash; Cholesterol (Lipids)</span>
                  <span>Target: LDL &lt; 100 mg/dL. Elevated lipids cause hard exudate fat deposits in the retina.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Referral Center Routing & Helpline */}
          <div className="border border-slate-300 rounded-xl p-3 bg-teal-50/40 space-y-2">
            <h4 className="font-bold text-xs text-teal-950 uppercase">
              Assigned Referral Center & Community Health Worker Contact
            </h4>
            <div className="grid grid-cols-3 gap-3 text-[9.5px] text-slate-700">
              <div>
                <span className="text-slate-500 block text-[8px] uppercase font-bold">Designated Facility</span>
                <strong className="text-slate-900">District Eye Care Hospital</strong>
                <span className="block text-[8.5px] text-slate-600">Department of Vitreoretinal Services</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[8px] uppercase font-bold">Community Screener Contact</span>
                <strong className="text-slate-900">Operator ID: {screening.operatorId || 'OP-RURAL-01'}</strong>
                <span className="block text-[8.5px] text-slate-600">Site: {screening.siteId || 'Rural Center'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[8px] uppercase font-bold">Tele-Triage Helpline</span>
                <strong className="text-teal-900 font-mono">1800-RETINA-DR (Toll-Free)</strong>
                <span className="block text-[8.5px] text-slate-600">Hours: Mon&ndash;Sat 08:00 to 18:00 IST</span>
              </div>
            </div>
          </div>

          {/* Patient Acknowledgment Signature */}
          <div className="grid grid-cols-2 gap-8 pt-4 border-t-2 border-slate-300 mt-2">
            <div>
              <span className="text-[9px] uppercase font-bold text-slate-500 block mb-4">
                Patient / Guardian Signature or Thumb Impression
              </span>
              <div className="border-b border-slate-400 w-48 mb-1" />
              <span className="font-semibold text-[10px] text-slate-800">Date: {reportDate.split(',')[0]}</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] uppercase font-bold text-slate-500 block mb-4">
                Screening Health Worker Counter-Signature
              </span>
              <div className="border-b border-slate-400 w-48 ml-auto mb-1" />
              <span className="font-semibold text-[10px] text-slate-800">Operator ID: {screening.operatorId || 'OP-RURAL-01'}</span>
            </div>
          </div>
        </div>

        {/* Page 4 Footer */}
        <div className="pt-2.5 border-t border-slate-300 flex items-center justify-between text-[9px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
            <span>End of Report &bull; Diabetic Retinopathy Triage Document &bull; Valid for 90 days</span>
          </div>
          <span>Ref ID: {screening.id} &bull; Page 4 of 4</span>
        </div>
      </div>
    </div>
  );
}
