'use client';

import React, { useRef, useState } from 'react';
import { Camera, Upload, AlertCircle, CheckCircle2, RotateCcw, ArrowRight } from 'lucide-react';
import { QualityAssessment } from '@/lib/api/schema';
import { validateImageFile, assessImageQuality, autoPreprocessImage } from '@/lib/api/client';

interface CaptureControlProps {
  eyeSide: 'L' | 'R';
  eyeLabel: string;
  recaptureAttempts: number;
  maxAttempts?: number;
  onQualityApproved: (file: File, quality: QualityAssessment) => void;
  onMarkUnableToCapture: () => void;
  onReferClinician: () => void;
  onProceedNext?: () => void;
}

export function CaptureControl({
  eyeSide,
  eyeLabel,
  recaptureAttempts,
  maxAttempts = 3,
  onQualityApproved,
  onMarkUnableToCapture,
  onReferClinician,
  onProceedNext
}: CaptureControlProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [preCheckError, setPreCheckError] = useState<string | null>(null);
  const [qualityResult, setQualityResult] = useState<QualityAssessment | null>(null);

  // Hardware / Lens Calibration Metadata States
  const [deviceType, setDeviceType] = useState<'desktop_fundus' | 'smartphone_adapter' | 'handheld_fundus'>('desktop_fundus');
  const [lensModel, setLensModel] = useState<'20D' | '28D' | 'Volk_iNview' | 'Remidio_FOP' | 'Internal'>('Internal');
  const [fovDegrees, setFovDegrees] = useState<30 | 45 | 50 | 60 | 90>(45);
  const [pupilStatus, setPupilStatus] = useState<'mydriatic' | 'non_mydriatic'>('non_mydriatic');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (file: File) => {
    setPreCheckError(null);
    setQualityResult(null);
    setValidating(true);

    // 1. Client-side pre-checks (format, size, corruption)
    const check = await validateImageFile(file);
    if (!check.valid) {
      setPreCheckError(check.error || 'Invalid image file.');
      setValidating(false);
      return;
    }

    // 2. Intelligent Preprocessing: Normalize aspect ratio and scale to fundus standard (>= 800x800)
    let processedFile = file;
    try {
      const preprocessed = await autoPreprocessImage(file);
      processedFile = preprocessed.file;
    } catch (err) {
      console.warn('Auto-preprocessing warning, proceeding with original:', err);
    }

    setSelectedFile(processedFile);
    const objUrl = URL.createObjectURL(processedFile);
    setPreviewUrl(objUrl);

    // 3. Automated Quality Check
    try {
      const assessment = await assessImageQuality(processedFile);
      setQualityResult(assessment);
      if (assessment.gradable) {
        onQualityApproved(processedFile, assessment);
      }
    } catch {
      setPreCheckError('Failed to run quality check. Please retry.');
    } finally {
      setValidating(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleRecapture = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setQualityResult(null);
    setPreCheckError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Hardware / Lens Calibration Metadata Form */}
      <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-3 text-xs">
        <span className="font-heading font-bold text-slate-800 block uppercase tracking-wider text-[10px]">
          Hardware & Lens Calibration Metadata
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div>
            <label className="text-slate-500 block mb-1">Camera Device</label>
            <select
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value as any)}
              className="w-full border border-slate-200 rounded-xl p-2 bg-white text-xs"
            >
              <option value="desktop_fundus">Desktop Fundus (Zeiss/Topcon)</option>
              <option value="smartphone_adapter">Smartphone + Adapter</option>
              <option value="handheld_fundus">Handheld (Remidio/Forus)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-500 block mb-1">Condensing Lens</label>
            <select
              value={lensModel}
              onChange={(e) => setLensModel(e.target.value as any)}
              className="w-full border border-slate-200 rounded-xl p-2 bg-white text-xs"
            >
              <option value="Internal">Integrated Optics (Internal)</option>
              <option value="20D">Volk 20D Lens</option>
              <option value="28D">Volk 28D Lens</option>
              <option value="Volk_iNview">Volk iNview Adapter</option>
              <option value="Remidio_FOP">Remidio FOP 10x</option>
            </select>
          </div>

          <div>
            <label className="text-slate-500 block mb-1">Field of View (FOV)</label>
            <select
              value={fovDegrees}
              onChange={(e) => setFovDegrees(parseInt(e.target.value) as any)}
              className="w-full border border-slate-200 rounded-xl p-2 bg-white text-xs"
            >
              <option value={30}>30&deg; (Macula centered)</option>
              <option value={45}>45&deg; (Standard ETDRS)</option>
              <option value={50}>50&deg; (Wide-field)</option>
              <option value={90}>90&deg; (Ultra-wide)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-500 block mb-1">Pupil Dilation</label>
            <select
              value={pupilStatus}
              onChange={(e) => setPupilStatus(e.target.value as any)}
              className="w-full border border-slate-200 rounded-xl p-2 bg-white text-xs"
            >
              <option value="non_mydriatic">Non-Mydriatic (Natural)</option>
              <option value="mydriatic">Mydriatic (Dilated &ge;6mm)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Visual Examples: Good vs Bad Framing */}
      <div className="grid grid-cols-2 gap-3.5 p-4 bg-slate-50/80 border border-[#E2E8F0] rounded-2xl text-xs">
        <div className="flex flex-col items-center text-center p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center border-2 border-[#059669] mb-2 shadow-sm">
            <div className="w-6 h-6 rounded-full bg-amber-400 border border-amber-600" title="Centred Optic Disc" />
          </div>
          <span className="font-heading font-bold text-emerald-900 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" /> Good Framing
          </span>
          <span className="text-slate-600 mt-1 font-medium leading-relaxed">Centred optic disc, sharp focus, even light</span>
        </div>

        <div className="flex flex-col items-center text-center p-3 rounded-2xl bg-rose-50/80 border border-rose-200">
          <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center border-2 border-rose-400 mb-2 opacity-75 blur-[1px] shadow-sm">
            <div className="w-4 h-4 rounded-full bg-amber-600 translate-x-3 -translate-y-3" title="Off-centre Disc" />
          </div>
          <span className="font-heading font-bold text-rose-900 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Common Defects
          </span>
          <span className="text-slate-600 mt-1 font-medium leading-relaxed">Blur, dark, glare reflections, cut-off retina</span>
        </div>
      </div>

      {/* Capture Actions */}
      {!selectedFile && (
        <div className="space-y-3">
          <input
            type="file"
            accept="image/jpeg,image/png"
            capture="environment"
            ref={cameraInputRef}
            onChange={handleInputChange}
            className="hidden"
            id={`camera-capture-${eyeSide}`}
          />
          <input
            type="file"
            accept="image/jpeg,image/png"
            ref={fileInputRef}
            onChange={handleInputChange}
            className="hidden"
            id={`file-upload-${eyeSide}`}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label
              htmlFor={`camera-capture-${eyeSide}`}
              className="flex items-center justify-center gap-2.5 p-4 rounded-2xl bg-[#059669] hover:bg-emerald-700 text-white font-semibold cursor-pointer shadow-sm transition duration-300 active:scale-[0.98] min-h-[52px]"
            >
              <Camera className="w-5 h-5" />
              <span>Capture Photo (Camera)</span>
            </label>

            <label
              htmlFor={`file-upload-${eyeSide}`}
              className="flex items-center justify-center gap-2.5 p-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 border-2 border-[#E2E8F0] font-semibold cursor-pointer shadow-sm transition duration-300 active:scale-[0.98] min-h-[52px]"
            >
              <Upload className="w-5 h-5 text-[#0284c7]" />
              <span>Upload from Fundus Camera</span>
            </label>
          </div>
        </div>
      )}

      {/* Pre-check Error */}
      {preCheckError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-heading font-bold">Unable to process image</p>
            <p className="text-xs mt-0.5 font-medium">{preCheckError}</p>
          </div>
        </div>
      )}

      {/* Validating indicator */}
      {validating && (
        <div className="p-5 rounded-2xl border border-[#E2E8F0] bg-slate-50 flex items-center justify-center gap-3">
          <div className="w-5 h-5 border-2 border-[#059669] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-slate-700">Checking image quality & defect analysis...</span>
        </div>
      )}

      {/* Quality Result Card with 175-184 & 185-190 Controls */}
      {qualityResult && previewUrl && (
        <div className="p-5 rounded-2xl border space-y-4 bg-white shadow-sm border-[#E2E8F0]">
          {/* 175. Image quality score & 176. Gradability status */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="font-heading text-xs font-bold text-slate-500 uppercase tracking-wider block">
                {eyeLabel} Eye Quality Assessment
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-bold text-slate-900">
                  Quality Score: {Math.round(qualityResult.score * 100)}%
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  qualityResult.gradable
                    ? 'bg-emerald-50 text-[#059669] border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {qualityResult.gradable ? 'Gradable (Pass)' : 'Ungradable (Fail)'}
                </span>
              </div>
            </div>

            <span className="text-xs text-slate-600 font-semibold bg-slate-100 px-3 py-1 rounded-full">
              Attempt {recaptureAttempts} of {maxAttempts}
            </span>
          </div>

          <div className="relative rounded-2xl overflow-hidden bg-[#090D16] flex items-center justify-center aspect-square max-h-[460px] mx-auto border border-slate-800 shadow-inner">
            {/* Visual Retinal Alignment Ring Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[84%] h-[84%] rounded-full border-2 border-emerald-400/40 border-dashed animate-pulse flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border border-emerald-400/30" />
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt={`${eyeLabel} Eye capture preview`} className="w-full h-full object-contain relative z-0" />
          </div>

          {/* 177, 178, 179, 180, 181, 182: Defect Pass/Fail Grid & Explanations */}
          <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Automated Optical Quality Checks
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {/* 177. Blur detection */}
              <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                qualityResult.defects.includes('blur')
                  ? 'bg-rose-50/80 border-rose-200 text-rose-800'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}>
                <span>Blur</span>
                {qualityResult.defects.includes('blur') ? (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-[#059669]" />
                )}
              </div>

              {/* 178. Glare detection */}
              <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                qualityResult.defects.includes('glare') || qualityResult.defects.includes('overexposed')
                  ? 'bg-rose-50/80 border-rose-200 text-rose-800'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}>
                <span>Glare</span>
                {qualityResult.defects.includes('glare') || qualityResult.defects.includes('overexposed') ? (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-[#059669]" />
                )}
              </div>

              {/* 179. Illumination detection */}
              <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                qualityResult.defects.includes('underexposed') || qualityResult.defects.includes('low_contrast')
                  ? 'bg-rose-50/80 border-rose-200 text-rose-800'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}>
                <span>Lighting</span>
                {qualityResult.defects.includes('underexposed') || qualityResult.defects.includes('low_contrast') ? (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-[#059669]" />
                )}
              </div>

              {/* 180. Centering detection */}
              <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                qualityResult.defects.includes('poor_centering') || qualityResult.defects.includes('incomplete_field')
                  ? 'bg-rose-50/80 border-rose-200 text-rose-800'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}>
                <span>Centering</span>
                {qualityResult.defects.includes('poor_centering') || qualityResult.defects.includes('incomplete_field') ? (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-[#059669]" />
                )}
              </div>
            </div>

            {/* 182. Defect explanation */}
            {qualityResult.defects.length > 0 && (
              <div className="mt-2 p-2.5 bg-rose-50 rounded-xl text-xs text-rose-900 border border-rose-200">
                <strong>Defects Detected:</strong> {qualityResult.recaptureInstruction || 'Image quality below clinical threshold.'}
              </div>
            )}
          </div>

          {/* 7. Image Recapture Instructions & Action Guides (185-189) */}
          {!qualityResult.gradable && (
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-300 text-amber-950 space-y-2.5 text-xs">
              <span className="font-bold flex items-center gap-1.5 text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>185. Recapture Guidance for Operator</span>
              </span>

              <ul className="space-y-1 list-disc list-inside text-amber-900 font-medium">
                {qualityResult.defects.includes('blur') && (
                  <li><strong>186. Blur Correction:</strong> Rest patient chin firmly on cup. Adjust diopter focus wheel until retinal vessel bifurcations are sharp.</li>
                )}
                {(qualityResult.defects.includes('underexposed') || qualityResult.defects.includes('low_contrast')) && (
                  <li><strong>187. Lighting Correction:</strong> Dim room illumination or adjust camera flash intensity. Verify pupil dilation is &ge; 4mm.</li>
                )}
                {(qualityResult.defects.includes('glare') || qualityResult.defects.includes('overexposed')) && (
                  <li><strong>188. Glare Correction:</strong> Shift camera objective lens slightly off corneal reflection axis.</li>
                )}
                {(qualityResult.defects.includes('poor_centering') || qualityResult.defects.includes('incomplete_field')) && (
                  <li><strong>189. Centering Correction:</strong> Instruct patient to fixate on the internal target light to align optic disc 2-disc-diameters nasal to macula.</li>
                )}
                {qualityResult.defects.length === 0 && (
                  <li>General: Reposition camera and ensure unobstructed view of posterior pole.</li>
                )}
              </ul>
            </div>
          )}

          {/* Accept Gradable Image & Reject / Retake Actions */}
          <div className="space-y-2 pt-2">
            {qualityResult.gradable ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => onQualityApproved(selectedFile!, qualityResult)}
                  className="w-full py-3 px-4 rounded-xl bg-[#059669] hover:bg-emerald-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 active:scale-[0.99] transition duration-200 min-h-[44px]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Accept Gradable Image</span>
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Reject and Retake Option for Gradable Image */}
                  <button
                    type="button"
                    onClick={handleRecapture}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                    <span>Reject &amp; Retake New Image</span>
                  </button>

                  {onProceedNext && (
                    <button
                      type="button"
                      onClick={onProceedNext}
                      className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-semibold text-xs shadow-sm flex items-center justify-center gap-1.5 transition"
                    >
                      <span>
                        {eyeSide === 'L' ? 'Proceed to Right Eye (OD)' : 'Proceed to AI Analysis'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Retake Image Button */}
                  <button
                    type="button"
                    onClick={handleRecapture}
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retake Image</span>
                  </button>

                  {/* Reject Ungradable Image */}
                  <button
                    type="button"
                    onClick={() => {
                      if (recaptureAttempts >= maxAttempts) {
                        onReferClinician();
                      } else {
                        handleRecapture();
                      }
                    }}
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Reject Ungradable Image</span>
                  </button>
                </div>

                {recaptureAttempts >= maxAttempts && (
                  <button
                    type="button"
                    onClick={onReferClinician}
                    className="w-full py-2.5 px-4 bg-[#0284c7] hover:bg-sky-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
                  >
                    Exceeded {maxAttempts} Attempts &bull; Refer for Clinician Direct Exam
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Fallback option to mark unable */}
          {!qualityResult.gradable && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onMarkUnableToCapture}
                className="text-xs text-slate-500 hover:text-slate-800 underline min-h-[36px]"
              >
                Mark as unable to capture this eye
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

