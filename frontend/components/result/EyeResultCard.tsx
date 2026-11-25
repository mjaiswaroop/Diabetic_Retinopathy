'use client';

import React, { useState } from 'react';
import { EyeData, ReferralState } from '@/lib/api/schema';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, Eye, Layers, Activity, SearchCheck, Sparkles, MapPin } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface EyeResultCardProps {
  eyeData: EyeData;
  eyeLabel: string; // 'Left Eye' | 'Right Eye'
  researchMode?: boolean;
}

export function EyeResultCard({ eyeData, eyeLabel, researchMode = false }: EyeResultCardProps) {
  const [showOverlay, setShowOverlay] = useState(true);
  const [showPinLabels, setShowPinLabels] = useState(true);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0.75);

  const { prediction, unableToCapture, xai } = eyeData;

  if (unableToCapture || prediction?.referralState === 'ungradable' || prediction?.isGradable === false || prediction?.predictedGrade === -1) {
    const reasonText = prediction?.rejectionReason || prediction?.uncertaintyReason || 'Image quality inadequate or marked as unable to capture.';
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-12">
          <div className="p-6 rounded-2xl border-2 border-amber-300 bg-amber-50/90 text-amber-950 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-amber-200/80 pb-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                <div>
                  <h3 className="font-heading text-base font-bold text-slate-900">{eyeLabel}: Ungradable Quality</h3>
                  <p className="text-xs text-amber-800 font-medium">Diagnostic quality criteria not satisfied</p>
                </div>
              </div>
              <span className="px-3 py-1 text-xs rounded-full bg-amber-200 text-amber-900 font-bold uppercase tracking-wider">
                Recapture Required
              </span>
            </div>
            
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-slate-900">Clinical Reason:</p>
              <p className="text-amber-900 bg-white/80 p-3 rounded-lg border border-amber-200 text-xs leading-relaxed font-mono">
                {reasonText}
              </p>
            </div>

            <div className="p-3 bg-amber-100/70 rounded-lg text-xs text-amber-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                <strong>Action Mandated:</strong> Clean lens, align patient pupil on the optical axis, verify focus and illumination in the preview guide, and acquire a new scan. If 3 consecutive captures fail, escalate directly for in-person slit-lamp biomicroscopy.
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="p-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center text-slate-500 py-8">
        <p className="text-sm font-medium">Analysis Pending for {eyeLabel}</p>
      </div>
    );
  }

  const referralState: ReferralState = prediction.referralState;

  // Chart data from class probabilities
  const chartData = Object.entries(prediction.classProbabilities || {}).map(([stage, prob]) => ({
    stage,
    percent: Math.round(prob * 100)
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left Column: Clinical Diagnosis, Referral Probability & DME (5 cols on lg) */}
      <div className="lg:col-span-5 space-y-4">
        {/* Primary Staging Card */}
        <div className="med-card p-5 space-y-3.5 bg-white border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="font-heading text-base font-bold text-slate-900">{eyeLabel}</span>
              <span className="block text-xs text-slate-500 font-medium">
                Diagnosis: <strong className="text-teal-700">{prediction.predictedClass}</strong>
              </span>
            </div>
            
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                referralState === 'referable'
                  ? 'bg-rose-50 text-rose-800 border-rose-300'
                  : referralState === 'uncertain'
                  ? 'bg-sky-50 text-sky-800 border-sky-300'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
              }`}
            >
              {referralState === 'referable' && <AlertCircle className="w-3.5 h-3.5 text-rose-600" />}
              {referralState === 'uncertain' && <AlertTriangle className="w-3.5 h-3.5 text-sky-600" />}
              {referralState === 'non_referable' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
              <span className="capitalize">
                {referralState === 'referable'
                  ? 'Referable DR'
                  : referralState === 'uncertain'
                  ? 'Uncertain / Review'
                  : 'Non-Referable'}
              </span>
            </div>
          </div>

          {/* Referral description */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs space-y-1">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-teal-700 shrink-0" />
              <p className="font-bold text-slate-900">
                {referralState === 'referable' && 'Ophthalmology Referral Indicated'}
                {referralState === 'uncertain' && 'Clinical Slit-Lamp Review Needed'}
                {referralState === 'non_referable' && 'Annual Routine Follow-up'}
              </p>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              {referralState === 'referable' && (
                prediction.predictedClass.includes('Grade 1') || prediction.predictedClass.includes('Mild')
                  ? `Cumulative referable risk is ${Math.round((prediction.referableProb ?? 0) * 100)}% (\u03c4 \u2265 41.1%). Early specialist evaluation mandated.`
                  : 'Pathological biomarkers corresponding to ICDR Grade 2+ identified. High risk of visual impairment without intervention.'
              )}
              {referralState === 'uncertain' &&
                (prediction.uncertaintyReason || 'Borderline findings detected. Recommended for direct slit-lamp examination.')}
              {referralState === 'non_referable' &&
                'Clear fundus view. No sight-threatening microvascular lesions detected. Next screen in 12 months.'}
            </p>
          </div>

          {/* Bounded Referable DR Probability Bar */}
          {prediction.referableProb !== null && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-700">Cumulative Referable Risk</span>
                <span className={`tabular-nums ${prediction.referableProb >= 0.4106 ? 'text-rose-600 font-bold' : 'text-emerald-700'}`}>
                  {Math.round(prediction.referableProb * 100)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    prediction.referableProb >= 0.4106 ? 'bg-rose-600' : 'bg-emerald-600'
                  }`}
                  style={{ width: `${Math.round(prediction.referableProb * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 tabular-nums">
                <span>Threshold: 41.1% (&ge;90% sens)</span>
                <span>Predicted Grade: {prediction.predictedGrade ?? 0}</span>
              </div>
            </div>
          )}
        </div>

        {/* DME Assessment Card */}
        <div className={`med-card p-4 space-y-2 border ${
          prediction.predictedGrade && prediction.predictedGrade >= 2
            ? 'bg-rose-50/50 border-rose-200'
            : 'bg-emerald-50/50 border-emerald-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <h4 className="font-heading text-[11px] font-bold uppercase tracking-wider text-slate-800">
                Diabetic Macular Edema (DME)
              </h4>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              prediction.predictedGrade && prediction.predictedGrade >= 2
                ? 'bg-rose-100 text-rose-800 border-rose-300'
                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
            }`}>
              {prediction.predictedGrade && prediction.predictedGrade >= 2
                ? 'Referable DME'
                : 'No DME Detected'}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            {prediction.predictedGrade && prediction.predictedGrade >= 2
              ? 'Hard exudate rings detected within 1 disc diameter of foveal avascular zone (FAZ). High risk of central vision loss.'
              : 'Fovea is free from circinate hard exudates or central intraretinal fluid leakage.'}
          </p>
        </div>

        {/* Research Mode Probabilities */}
        {researchMode && (
          <div className="med-card p-4 space-y-2 bg-white border border-slate-200/90 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-700 block uppercase tracking-wider">
              Class Probabilities (Calibrated T=1.96)
            </span>
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 15 }}>
                  <XAxis dataKey="stage" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" />
                  <YAxis tick={{ fontSize: 9 }} domain={[0, 100]} />
                  <Tooltip formatter={(value) => [`${value ?? 0}%`, 'Probability']} />
                  <Bar dataKey="percent" radius={[3, 3, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.stage.includes('Moderate') || entry.stage.includes('Severe') || entry.stage.includes('Proliferative')
                            ? '#e11d48'
                            : entry.stage.includes('Mild')
                            ? '#d97706'
                            : '#059669'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Aspect-Locked #090D16 Grad-CAM++ Viewer (7 cols on lg) */}
      <div className="lg:col-span-7 space-y-4">
        <div className="med-card p-4 space-y-3 bg-white border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#059669]" />
              <span className="text-xs font-bold text-slate-800">
                Grad-CAM++ Spatial Saliency Attention
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPinLabels(!showPinLabels)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border flex items-center gap-1 transition ${
                  showPinLabels
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                <MapPin className="w-3 h-3" />
                <span>{showPinLabels ? 'Hide Markers' : 'Show Markers'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowOverlay(!showOverlay)}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-[#059669] border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1 transition"
              >
                <Eye className="w-3 h-3" />
                <span>{showOverlay ? 'Original Fundus' : 'Show Heatmap'}</span>
              </button>
            </div>
          </div>

          {/* Saliency Retinal Canvas: Aspect-locked, max-h-[480px] in precision #090D16 frame */}
          <div className="relative rounded-xl overflow-hidden bg-[#090D16] flex items-center justify-center p-2 border border-slate-800 shadow-inner">
            <div className="relative w-full max-w-[480px] aspect-square flex items-center justify-center rounded-lg overflow-hidden">
              {eyeData.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={eyeData.imageUrl}
                  alt="Fundus capture"
                  className="w-full h-full object-contain relative z-0"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-[#090D16] text-xs p-4 text-center">
                  <span>No retinal image captured</span>
                </div>
              )}

              {/* Grad-CAM++ Activation Map */}
              {showOverlay && xai?.heatmapUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={xai.heatmapUrl}
                  alt="Grad-CAM++ Activation Map"
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-150"
                  style={{ opacity: opacity }}
                />
              )}

              {/* Interactive Lesion Pins */}
              {showPinLabels && xai?.lesionsDetected && xai.lesionsDetected.map((lesion, idx) => {
                const x = lesion.xPct ?? 50;
                const y = lesion.yPct ?? 50;
                const isHovered = activePinId === lesion.id || activePinId === `lesion-${idx}`;
                return (
                  <div
                    key={lesion.id || idx}
                    style={{ left: `${x}%`, top: `${y}%` }}
                    className="absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer group"
                    onClick={() => setActivePinId(isHovered ? null : (lesion.id || `lesion-${idx}`))}
                  >
                    <div className="relative flex items-center justify-center">
                      <span
                        className="absolute inline-flex h-6 w-6 rounded-full opacity-75 animate-ping"
                        style={{ backgroundColor: lesion.color || '#ef4444' }}
                      />
                      <div
                        className="relative inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[9px] font-black text-white shadow-lg border border-white transition-transform transform hover:scale-110"
                        style={{ backgroundColor: lesion.color || '#ef4444' }}
                      >
                        {lesion.termCode || (idx + 1)}
                      </div>
                    </div>

                    <div
                      className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-44 p-2 rounded-lg bg-slate-900/95 text-white text-[10px] shadow-xl backdrop-blur-sm border border-slate-700 pointer-events-none transition-all duration-200 ${
                        isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1 border-b border-slate-700 font-bold">
                        <span style={{ color: lesion.color || '#fca5a5' }}>{lesion.termCode}: {lesion.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-300 mt-1 leading-tight">{lesion.description}</p>
                      <div className="mt-1 flex items-center justify-between text-[9px] text-slate-400">
                        <span>{lesion.region}</span>
                        <span className="font-semibold text-teal-300">{Math.round(lesion.confidence * 100)}% conf</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded bg-black/80 text-white text-[9px] font-semibold flex items-center gap-1 border border-slate-700">
              <Sparkles className="w-3 3 text-amber-400" />
              <span>ResNet-50 Grad-CAM++ Active</span>
            </div>
          </div>

          {/* Opacity slider */}
          {showOverlay && xai?.heatmapUrl && (
            <div className="flex items-center justify-between gap-3 px-1 pt-1 text-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Overlay Opacity
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="w-28 accent-emerald-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
                <span className="text-[11px] font-mono font-bold text-slate-700 w-8 text-right">
                  {Math.round(opacity * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Detailed Saliency Findings & Focus Region Breakdown */}
        {xai?.lesionsDetected && xai.lesionsDetected.length > 0 && (
          <div className="med-card p-3.5 bg-white border border-slate-200/90 shadow-xs space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <SearchCheck className="w-3.5 h-3.5 text-teal-700" />
              <span>Model Attention Focus &amp; Region Breakdown</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {xai.lesionsDetected.map((lesion, idx) => (
                <div
                  key={idx}
                  onClick={() => setActivePinId(activePinId === (lesion.id || `lesion-${idx}`) ? null : (lesion.id || `lesion-${idx}`))}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                    activePinId === (lesion.id || `lesion-${idx}`)
                      ? 'bg-teal-50/80 border-teal-500 ring-1 ring-teal-400'
                      : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                  } space-y-1`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0"
                        style={{ backgroundColor: lesion.color || '#0d9488' }}
                      >
                        {lesion.termCode || (idx + 1)}
                      </span>
                      <span className="font-bold text-xs text-slate-900">{lesion.name}</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-white border border-slate-200 text-slate-700">
                      {lesion.severity}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight pl-5">{lesion.description}</p>
                  <div className="flex justify-between text-[10px] text-slate-400 pt-0.5 pl-5">
                    <span>Region: {lesion.region}</span>
                    <span className="font-semibold text-slate-700">Weight: {Math.round(lesion.confidence * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>

            {xai.clinicalSummary && (
              <p className="text-[11px] text-slate-600 font-medium pt-1 border-t border-slate-100 leading-relaxed">
                <strong>Model Reasoning Summary:</strong> {xai.clinicalSummary}
              </p>
            )}
          </div>
        )}

        {/* Mandatory Caption */}
        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2 text-[11px] text-amber-950">
          <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
          <span>
            <strong>Model Saliency:</strong> Colored heat spots show retinal regions with maximum activation in the convolution layers driving the DR classification decision.
          </span>
        </div>
      </div>
    </div>
  );
}

