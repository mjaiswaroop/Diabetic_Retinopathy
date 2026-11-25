'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/offline/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ScreeningRecord } from '@/lib/api/schema';
import { 
  UserCheck, 
  Search, 
  PlusCircle, 
  History, 
  CopyCheck, 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  ArrowRight,
  ShieldCheck,
  Calendar,
  Clock,
  User,
  Phone
} from 'lucide-react';

export default function PatientVerificationPage({ params: { locale } }: { params: { locale: string } }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<ScreeningRecord | null>(null);
  const [operatorId, setOperatorId] = useState('nurse-sunita');
  const [targetEye, setTargetEye] = useState<'OD' | 'OS' | 'both'>('both');

  // Live query of all screenings in local DB
  const screenings = useLiveQuery(async () => {
    return await db.screenings.toArray();
  }) || [];

  // Filtered search by patient ID, name, or phone (149. Search by patient ID)
  const matchingScreenings = screenings.filter(s => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase();
    const pid = s.patient.patientId?.toLowerCase() || '';
    const name = s.patient.name?.toLowerCase() || '';
    const mobile = s.patient.mobileNumber?.toLowerCase() || '';
    const sid = s.id.toLowerCase();
    return pid.includes(q) || name.includes(q) || mobile.includes(q) || sid.includes(q);
  });

  // Duplicate check for existing patient (152. Check for duplicate records)
  const duplicateRecords = selectedPatient
    ? screenings.filter(s => 
        (s.patient.patientId && s.patient.patientId === selectedPatient.patient.patientId) ||
        (s.patient.mobileNumber && s.patient.mobileNumber === selectedPatient.patient.mobileNumber) ||
        (s.patient.name && s.patient.name.toLowerCase() === selectedPatient.patient.name?.toLowerCase())
      )
    : [];

  // Create new screening from verified patient (153 & 155 & 156)
  const handleStartVerifiedScreening = async () => {
    if (!selectedPatient) return;

    const newScreeningId = `SCR-${Date.now().toString().slice(-6)}`;
    const newRecord: ScreeningRecord = {
      id: newScreeningId,
      idempotencyKey: `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      patient: {
        ...selectedPatient.patient,
        createdAt: new Date().toISOString()
      },
      status: 'images_pending',
      leftEye: { side: 'L', recaptureAttempts: 0 },
      rightEye: { side: 'R', recaptureAttempts: 0 },
      syncStatus: navigator.onLine ? 'pending' : 'offline',
      syncAttempts: 0,
      siteId: selectedPatient.siteId || 'site-rural-01',
      operatorId: operatorId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.screenings.put(newRecord);

    // 157 & 158: Eye selection (OD = Right, OS = Left)
    const initialEye = targetEye === 'OD' ? 'R' : 'L';
    router.push(`/${locale}/screenings/${newScreeningId}/capture?eye=${initialEye}`);
  };

  return (
    <div className="space-y-4 w-full pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold text-[#059669] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider">
              Nurse &bull; Patient Verification
            </span>
          </div>
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Patient Identity & Eye Selection
          </h1>
          <p className="text-xs text-slate-500">
            Confirm identity, review prior screening history, detect duplicate registrations, and initiate bilateral OD/OS capture.
          </p>
        </div>

        <Link
          href={`/${locale}/screenings/new`}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
        >
          <PlusCircle className="w-3.5 h-3.5 text-[#059669]" />
          <span>Register Brand New Patient</span>
        </Link>
      </div>

      {/* 149. Search by patient ID / Name / Mobile */}
      <div className="med-card p-5 space-y-3">
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
          Search Patient Database
        </label>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
          <input
            type="text"
            placeholder="Search by Patient ID (e.g. PAT-SCR-...), Name, or Mobile Number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-[#059669] text-sm transition-all"
          />
        </div>

        {searchQuery.trim() && matchingScreenings.length > 0 && (
          <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white shadow-sm mt-3">
            {matchingScreenings.map((s) => (
              <div
                key={s.id}
                onClick={() => setSelectedPatient(s)}
                className={`p-3.5 flex items-center justify-between cursor-pointer hover:bg-emerald-50/60 transition ${
                  selectedPatient?.id === s.id ? 'bg-emerald-50/90 border-l-4 border-l-[#059669]' : ''
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{s.patient.name || 'Anonymous Patient'}</span>
                    <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">{s.patient.patientId || s.id}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Age: {s.patient.age} &bull; {s.patient.sex} &bull; Mobile: {s.patient.mobileNumber || 'N/A'} &bull; Type: {s.patient.diabetesType}
                  </p>
                </div>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-[#059669] hover:text-white transition"
                >
                  Select Patient
                </button>
              </div>
            ))}
          </div>
        )}

        {searchQuery.trim() && matchingScreenings.length === 0 && (
          <div className="p-4 bg-slate-50 rounded-2xl text-center text-xs text-slate-500">
            No matching patient found in local records. You can register them as a new patient.
          </div>
        )}
      </div>

      {/* 150. Verify Patient Details & 152. Duplicate Check */}
      {selectedPatient && (
        <div className="med-card p-6 space-y-6 border-emerald-300 ring-2 ring-emerald-500/10">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#059669] flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-heading text-lg font-bold text-slate-900">Verified Patient Dossier</h2>
                <span className="text-xs text-[#059669] font-semibold">Identity Confirmed &bull; Ready for Screening</span>
              </div>
            </div>

            {/* 152. Duplicate Records Alert */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
              <CopyCheck className="w-3.5 h-3.5 text-[#0284c7]" />
              <span>{duplicateRecords.length} Total Visits Recorded</span>
            </div>
          </div>

          {/* Demographic Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50/70 rounded-2xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Full Name</span>
              <strong className="text-slate-900 text-sm block mt-0.5">{selectedPatient.patient.name || 'Anonymous'}</strong>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Patient ID</span>
              <strong className="text-slate-900 font-mono text-sm block mt-0.5">{selectedPatient.patient.patientId || selectedPatient.id}</strong>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Age & Gender</span>
              <strong className="text-slate-900 text-sm block mt-0.5">{selectedPatient.patient.age} yrs / {selectedPatient.patient.sex}</strong>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Mobile Phone</span>
              <strong className="text-slate-900 text-sm block mt-0.5">{selectedPatient.patient.mobileNumber || 'Not provided'}</strong>
            </div>
          </div>

          {/* 151. View Previous Screening History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-400" />
                <span>Previous Screening Sessions</span>
              </h3>
              <span className="text-[11px] text-slate-400">{duplicateRecords.length} record(s)</span>
            </div>

            <div className="space-y-2">
              {duplicateRecords.map((r, idx) => (
                <div key={r.id} className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-semibold text-slate-800 block">Session {r.id}</span>
                      <span className="text-slate-400 text-[10px]">{new Date(r.createdAt).toLocaleDateString()} at {new Date(r.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      r.status === 'analyzed' || r.status === 'reviewed' ? 'bg-emerald-50 text-[#059669]' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {r.status}
                    </span>
                    <Link
                      href={`/${locale}/screenings/${r.id}/result`}
                      className="text-[#0284c7] hover:underline font-semibold text-[11px]"
                    >
                      View Report
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. New Screening & Eye Selection Config (154, 155, 156, 157, 158, 159, 160, 161) */}
          <div className="p-5 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 rounded-2xl border border-emerald-200/80 space-y-4">
            <h3 className="font-heading text-sm font-bold text-slate-900 flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#059669]" />
              <span>Initiate New Screening Session</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 160. Date & Time */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="text-slate-400 block font-medium flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Date & Time
                </span>
                <span className="font-bold text-slate-800 block">{new Date().toLocaleDateString()}</span>
                <span className="text-slate-500 text-[10px]">{new Date().toLocaleTimeString()}</span>
              </div>

              {/* 161. Operator ID */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="text-slate-400 block font-medium flex items-center gap-1">
                  <User className="w-3 h-3" /> Operator ID
                </span>
                <input
                  type="text"
                  value={operatorId}
                  onChange={(e) => setOperatorId(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded px-2 py-1"
                />
              </div>

              {/* 154 & 159. Bilateral Linkage */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="text-slate-400 block font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-[#059669]" /> Linkage
                </span>
                <span className="font-bold text-emerald-800 block">Bilateral (OD + OS)</span>
                <span className="text-[10px] text-slate-400">Linked to single patient exam</span>
              </div>
            </div>

            {/* 157 & 158: Eye selection (OD = Right, OS = Left) */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Starting Eye Capture
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetEye('both')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition text-center ${
                    targetEye === 'both'
                      ? 'border-[#059669] bg-white text-[#059669] shadow-sm ring-2 ring-emerald-200'
                      : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
                  }`}
                >
                  Bilateral (L & R)
                </button>

                <button
                  type="button"
                  onClick={() => setTargetEye('OD')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition text-center ${
                    targetEye === 'OD'
                      ? 'border-[#059669] bg-white text-[#059669] shadow-sm ring-2 ring-emerald-200'
                      : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
                  }`}
                >
                  Right Eye (OD)
                </button>

                <button
                  type="button"
                  onClick={() => setTargetEye('OS')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition text-center ${
                    targetEye === 'OS'
                      ? 'border-[#059669] bg-white text-[#059669] shadow-sm ring-2 ring-emerald-200'
                      : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
                  }`}
                >
                  Left Eye (OS)
                </button>
              </div>
            </div>

            {/* 163. Start Image Capture Action */}
            <button
              type="button"
              onClick={handleStartVerifiedScreening}
              className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-md shadow-emerald-700/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span>163. Start Image Capture</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

