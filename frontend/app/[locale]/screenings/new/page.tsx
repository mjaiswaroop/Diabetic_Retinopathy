'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ProgressStepper } from '@/components/ui/ProgressStepper';
import { db } from '@/lib/offline/db';
import { ScreeningRecord } from '@/lib/api/schema';
import { AlertCircle, Search, ArrowRight } from 'lucide-react';

const patientSchema = z.object({
  patientName: z.string().min(2, 'Patient name is required'),
  patientId: z.string().optional(),
  age: z.number().min(1, 'Please enter a valid age').max(120, 'Age exceeds normal bounds'),
  dateOfBirth: z.string().optional(),
  sex: z.enum(['male', 'female', 'other']),
  mobileNumber: z.string().regex(/^(\+91[\-\s]?)?[0]?(91)?[6789]\d{9}$/, 'Enter a valid 10-digit mobile number').or(z.literal('')),
  diabetesType: z.enum(['type_1', 'type_2', 'gestational', 'unknown']),
  diabetesDurationYears: z.number().min(0, 'Years cannot be negative').max(80),
  consentGiven: z.boolean().refine((val) => val === true, {
    message: 'Informed consent is strictly required to proceed.'
  })
});

type PatientFormValues = z.infer<typeof patientSchema>;

export default function NewScreeningPage({ params: { locale } }: { params: { locale: string } }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [screeningId, setScreeningId] = useState('');
  const [repeatMode, setRepeatMode] = useState(false);
  const [searchStudyId, setSearchStudyId] = useState('');
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [hardwareSetup, setHardwareSetup] = useState({
    deviceType: 'desktop_fundus',
    lensModel: 'Internal',
    fovDegrees: 45,
    pupilStatus: 'non_mydriatic'
  });

  useEffect(() => {
    setScreeningId(`SCR-${Date.now().toString().slice(-6)}`);
    setMounted(true);
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isValid }
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      patientName: '',
      mobileNumber: '',
      dateOfBirth: '',
      consentGiven: false,
      diabetesType: 'type_2',
      sex: 'female',
      age: 48,
      diabetesDurationYears: 5
    },
    mode: 'onChange'
  });

  const onSubmit = async (data: PatientFormValues) => {
    const newScreening: ScreeningRecord = {
      id: screeningId,
      idempotencyKey: `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      patient: {
        id: `pat-${Date.now()}`,
        patientId: data.patientId || `PAT-${screeningId}`,
        studyId: `STU-RUR-${screeningId.slice(-4)}`,
        name: data.patientName,
        age: data.age,
        dateOfBirth: data.dateOfBirth,
        sex: data.sex,
        mobileNumber: data.mobileNumber || undefined,
        diabetesType: data.diabetesType,
        diabetesDurationYears: data.diabetesDurationYears,
        consentGiven: data.consentGiven,
        createdAt: new Date().toISOString()
      },
      status: 'images_pending',
      leftEye: { 
        side: 'L', 
        recaptureAttempts: 0,
        hardware: {
          deviceType: hardwareSetup.deviceType as any,
          lensModel: hardwareSetup.lensModel as any,
          fovDegrees: hardwareSetup.fovDegrees as any,
          pupilStatus: hardwareSetup.pupilStatus as any
        }
      },
      rightEye: { 
        side: 'R', 
        recaptureAttempts: 0,
        hardware: {
          deviceType: hardwareSetup.deviceType as any,
          lensModel: hardwareSetup.lensModel as any,
          fovDegrees: hardwareSetup.fovDegrees as any,
          pupilStatus: hardwareSetup.pupilStatus as any
        }
      },
      syncStatus: navigator.onLine ? 'pending' : 'offline',
      syncAttempts: 0,
      siteId: 'site-rural-01',
      operatorId: 'operator-sunita',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Store directly in offline IndexedDB
    await db.screenings.put(newScreening);

    // Proceed to capture flow starting with Left eye
    router.push(`/${locale}/screenings/${screeningId}/capture?eye=L`);
  };

  const handleRepeatSearch = () => {
    if (!searchStudyId.trim()) return;
    setSearchResult(`Existing patient found: STU-${searchStudyId} (Age: 54, Type 2, 8 yrs). Demographics pre-filled.`);
    setValue('patientName', 'Ramesh Kumar');
    setValue('mobileNumber', '9876543210');
    setValue('age', 54);
    setValue('sex', 'male');
    setValue('diabetesType', 'type_2');
    setValue('diabetesDurationYears', 8);
    setValue('patientId', `PAT-${searchStudyId}`);
  };

  return (
    <div className="space-y-4 w-full">
      <ProgressStepper
        currentStep="register"
        labels={{
          register: 'Register',
          leftEye: 'Left Eye',
          rightEye: 'Right Eye',
          analysis: 'Analysis',
          result: 'Result'
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Demographics & Clinical Intake Form (7 cols on lg) */}
        <div className="lg:col-span-7">
          <div className="med-card p-5 space-y-4 bg-white border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h1 className="font-heading text-lg font-bold text-slate-900 tracking-tight">Patient Clinical Registration</h1>
                <p className="text-xs text-slate-500 font-medium">Standard epidemiological data intake. Mandatory fields marked with *.</p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200" suppressHydrationWarning>
                {mounted ? (screeningId || 'SCR-......') : 'SCR-......'}
              </span>
            </div>

            {/* Demographics Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Patient Name & Mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                    Patient Full Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Kumar"
                    {...register('patientName')}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none transition font-medium"
                  />
                  {errors.patientName && <p className="text-[11px] text-rose-600 mt-1 font-semibold">{errors.patientName.message}</p>}
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    placeholder="10-digit number"
                    {...register('mobileNumber')}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none transition font-medium"
                  />
                  {errors.mobileNumber && <p className="text-[11px] text-rose-600 mt-1 font-semibold">{errors.mobileNumber.message}</p>}
                </div>
              </div>

              {/* Age, Gender, Diabetes Type, Duration */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Age */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                    Age (yrs) *
                  </label>
                  <input
                    type="number"
                    {...register('age', { valueAsNumber: true })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none transition font-medium tabular-nums"
                  />
                  {errors.age && <p className="text-[11px] text-rose-600 mt-1 font-semibold">{errors.age.message}</p>}
                </div>

                {/* Sex */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                    Gender *
                  </label>
                  <select
                    {...register('sex')}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none transition font-medium"
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Diabetes Type */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                    Diabetes *
                  </label>
                  <select
                    {...register('diabetesType')}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none transition font-medium"
                  >
                    <option value="type_2">Type 2</option>
                    <option value="type_1">Type 1</option>
                    <option value="gestational">Gestational</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>

                {/* Years with Diabetes */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                    Duration (yrs)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    {...register('diabetesDurationYears', { valueAsNumber: true })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white text-slate-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none transition font-medium tabular-nums"
                  />
                  {errors.diabetesDurationYears && (
                    <p className="text-[11px] text-rose-600 mt-1 font-semibold">{errors.diabetesDurationYears.message}</p>
                  )}
                </div>
              </div>

              {/* Consent Checkbox */}
              <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/80 space-y-1.5">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    {...register('consentGiven')}
                    className="w-4 h-4 mt-0.5 rounded border-slate-400 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 shrink-0 cursor-pointer"
                  />
                  <span className="text-xs text-amber-950 font-medium leading-relaxed">
                    Patient has provided informed written/verbal consent for diabetic retinopathy screening, in accordance with the study ethical approval.
                  </span>
                </label>
                {errors.consentGiven && (
                  <p className="text-xs text-rose-700 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.consentGiven.message}
                  </p>
                )}
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={!isValid}
                className="w-full py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-heading font-bold text-xs shadow-xs transition duration-200 flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
              >
                <span>Continue to Left Eye Capture</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Hardware Setup & Lens Calibration + Readiness (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Hardware & Calibration Selector */}
          <div className="med-card p-5 space-y-3.5 bg-white border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <span className="font-heading font-bold text-xs uppercase tracking-wider text-slate-800">
                Hardware &amp; Lens Calibration
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Calibrated
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Device Modality
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHardwareSetup({ ...hardwareSetup, deviceType: 'desktop_fundus', lensModel: 'Internal' })}
                    className={`p-2.5 rounded-lg border text-left transition ${
                      hardwareSetup.deviceType === 'desktop_fundus'
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 font-bold'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <span className="block text-xs">Tabletop Fundus</span>
                    <span className="text-[10px] text-slate-500 font-normal">Internal optical 45°</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHardwareSetup({ ...hardwareSetup, deviceType: 'smartphone_adapter', lensModel: '20D' })}
                    className={`p-2.5 rounded-lg border text-left transition ${
                      hardwareSetup.deviceType === 'smartphone_adapter'
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 font-bold'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <span className="block text-xs">20D/28D Adapter</span>
                    <span className="text-[10px] text-slate-500 font-normal">Handheld smartphone</span>
                  </button>
                </div>
              </div>

              {hardwareSetup.deviceType === 'smartphone_adapter' && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Condensing Lens
                  </label>
                  <div className="flex gap-2">
                    {(['20D', '28D', 'Volk_iNview'] as const).map(lens => (
                      <button
                        key={lens}
                        type="button"
                        onClick={() => setHardwareSetup({ ...hardwareSetup, lensModel: lens })}
                        className={`flex-1 py-1.5 px-2 rounded-lg border text-center text-xs transition ${
                          hardwareSetup.lensModel === lens
                            ? 'border-emerald-600 bg-emerald-600 text-white font-bold'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        {lens}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Pupil Status
                  </label>
                  <select
                    value={hardwareSetup.pupilStatus}
                    onChange={(e) => setHardwareSetup({ ...hardwareSetup, pupilStatus: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white text-slate-900"
                  >
                    <option value="non_mydriatic">Non-Mydriatic</option>
                    <option value="mydriatic">Mydriatic (Dilated)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Field of View
                  </label>
                  <select
                    value={hardwareSetup.fovDegrees}
                    onChange={(e) => setHardwareSetup({ ...hardwareSetup, fovDegrees: Number(e.target.value) as any })}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white text-slate-900"
                  >
                    <option value={45}>45° Standard</option>
                    <option value={50}>50° Wide</option>
                    <option value={60}>60° Ultra-Wide</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Live Readiness Checklist */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[11px]">
              <span className="font-bold text-slate-700 block text-[10px] uppercase tracking-wider">
                Pre-Screening Readiness Checklist
              </span>
              <ul className="space-y-1 text-slate-600">
                <li className="flex items-center gap-1.5 text-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  <span>Ambient room lighting subdued for physiological dilation</span>
                </li>
                <li className="flex items-center gap-1.5 text-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  <span>Optical lens clean and free of dust or fingerprints</span>
                </li>
                <li className="flex items-center gap-1.5 text-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  <span>Patient instructed to fixate on the internal fixation light</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Repeat Screening Quick Search */}
          <div className="med-card p-4 space-y-2.5 bg-white border border-slate-200/90 shadow-xs">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-emerald-600" />
              <span>Repeat Screening Lookup</span>
            </span>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Patient ID / Study ID"
                value={searchStudyId}
                onChange={(e) => setSearchStudyId(e.target.value)}
                className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
              <button
                type="button"
                onClick={handleRepeatSearch}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition"
              >
                Lookup
              </button>
            </div>

            {searchResult && (
              <p className="text-[11px] text-emerald-900 font-semibold bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                {searchResult}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

