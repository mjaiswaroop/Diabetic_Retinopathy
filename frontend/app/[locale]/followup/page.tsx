'use client';

import React, { useState } from 'react';
import { db } from '@/lib/offline/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { ScreeningRecord } from '@/lib/api/schema';
import { 
  Users, 
  Search, 
  Calendar, 
  Building2, 
  CheckCircle2, 
  Clock, 
  Phone, 
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Filter
} from 'lucide-react';

export default function FollowUpTrackingPage({ params: { locale } }: { params: { locale: string } }) {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedScreening, setSelectedScreening] = useState<ScreeningRecord | null>(null);

  // Form states for updating follow-up
  const [hospitalName, setHospitalName] = useState('District Eye Hospital Mandya');
  const [treatmentStatus, setTreatmentStatus] = useState<'pending' | 'completed_laser' | 'completed_antivegf' | 'lost_to_follow_up' | 'scheduled'>('scheduled');
  const [visitConfirmed, setVisitConfirmed] = useState(false);
  const [doctorNotes, setDoctorNotes] = useState('');

  const screenings = useLiveQuery(async () => {
    return await db.screenings.toArray();
  }) || [];

  // Filter only referable or high-risk patients who require ophthalmology follow-up
  const referredPatients = screenings.filter(s => {
    const isReferable = 
      s.leftEye.prediction?.referralState === 'referable' ||
      s.rightEye.prediction?.referralState === 'referable' ||
      s.status === 'needs_review' ||
      s.status === 'reviewed';

    if (!isReferable) return false;

    if (filterStatus === 'visited') return s.followUp?.actualVisitConfirmed;
    if (filterStatus === 'pending') return !s.followUp?.actualVisitConfirmed;
    if (filterStatus === 'lost') return s.followUp?.treatmentStatus === 'lost_to_follow_up';

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const name = s.patient.name?.toLowerCase() || '';
      const pid = s.patient.patientId?.toLowerCase() || '';
      return name.includes(q) || pid.includes(q);
    }

    return true;
  });

  const handleUpdateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScreening) return;

    const updatedFollowUp = {
      referredToHospitalName: hospitalName,
      referralDate: selectedScreening.followUp?.referralDate || new Date().toISOString(),
      actualVisitConfirmed: visitConfirmed,
      treatmentStatus: treatmentStatus,
      doctorFeedbackNotes: doctorNotes,
      updatedAt: new Date().toISOString()
    };

    await db.screenings.update(selectedScreening.id, {
      followUp: updatedFollowUp
    });

    await db.auditEvents.put({
      id: `audit-${Date.now()}`,
      actorId: 'nurse-coordinator',
      role: 'operator',
      siteId: selectedScreening.siteId,
      action: 'UPDATE_FOLLOW_UP_LOOP',
      objectType: 'Screening',
      objectId: selectedScreening.id,
      timestamp: new Date().toISOString(),
      metadata: { visitConfirmed, treatmentStatus }
    });

    alert('Follow-up status recorded in clinical registry.');
    setSelectedScreening(null);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider">
            Closed-Loop Continuum of Care
          </span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-slate-900 tracking-tight">
          Referral Tracking & Closed-Loop Follow-Up
        </h1>
        <p className="text-xs text-slate-500">
          Ensure sight-threatening Diabetic Retinopathy & DME patients complete confirmatory hospital visits and laser/anti-VEGF treatment.
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="med-card p-4 space-y-1">
          <span className="text-slate-400 text-xs font-medium">Referred High-Risk</span>
          <p className="font-heading text-2xl font-bold text-slate-900">{referredPatients.length}</p>
          <span className="text-[10px] text-slate-500">ICDR Grade &ge; 2 or DME</span>
        </div>

        <div className="med-card p-4 space-y-1">
          <span className="text-slate-400 text-xs font-medium">Visit Confirmed</span>
          <p className="font-heading text-2xl font-bold text-[#059669]">
            {screenings.filter(s => s.followUp?.actualVisitConfirmed).length}
          </p>
          <span className="text-[10px] text-emerald-700">Examined by Retina Specialist</span>
        </div>

        <div className="med-card p-4 space-y-1">
          <span className="text-slate-400 text-xs font-medium">Pending Completion</span>
          <p className="font-heading text-2xl font-bold text-amber-600">
            {referredPatients.filter(s => !s.followUp?.actualVisitConfirmed).length}
          </p>
          <span className="text-[10px] text-amber-700">Follow-up reminder call due</span>
        </div>

        <div className="med-card p-4 space-y-1">
          <span className="text-slate-400 text-xs font-medium">Completed Laser / Anti-VEGF</span>
          <p className="font-heading text-2xl font-bold text-sky-600">
            {screenings.filter(s => s.followUp?.treatmentStatus === 'completed_laser' || s.followUp?.treatmentStatus === 'completed_antivegf').length}
          </p>
          <span className="text-[10px] text-sky-700">Intervention executed</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="med-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterStatus === 'all' ? 'bg-[#059669] text-white shadow-sm' : 'bg-slate-100 text-slate-600'
            }`}
          >
            All Referrals
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterStatus === 'pending' ? 'bg-[#059669] text-white shadow-sm' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Pending Visit
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('visited')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterStatus === 'visited' ? 'bg-[#059669] text-white shadow-sm' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Confirmed Visited
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search patient name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
          />
        </div>
      </div>

      {/* Patient Referral Cards List */}
      <div className="space-y-3">
        {referredPatients.length === 0 ? (
          <div className="med-card p-8 text-center text-slate-400 text-xs">
            No referable patient records currently requiring closed-loop tracking.
          </div>
        ) : (
          referredPatients.map((s) => (
            <div key={s.id} className="med-card p-5 space-y-3 border-slate-200 hover:border-slate-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-bold text-base text-slate-900">{s.patient.name || 'Anonymous Patient'}</h3>
                    <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">{s.patient.patientId || s.id}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Age: {s.patient.age} &bull; Gender: {s.patient.sex} &bull; Mobile: <strong>{s.patient.mobileNumber || 'Not provided'}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    s.followUp?.actualVisitConfirmed
                      ? 'bg-emerald-50 text-[#059669] border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    {s.followUp?.actualVisitConfirmed ? 'Confirmed Hospital Visit' : 'Follow-Up Pending'}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedScreening(s);
                      setHospitalName(s.followUp?.referredToHospitalName || 'District Eye Hospital Mandya');
                      setVisitConfirmed(s.followUp?.actualVisitConfirmed || false);
                      setTreatmentStatus(s.followUp?.treatmentStatus || 'scheduled');
                      setDoctorNotes(s.followUp?.doctorFeedbackNotes || '');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-[#059669] hover:text-white text-slate-800 text-xs font-bold transition"
                  >
                    Update Tracking
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px]">Referred Center</span>
                  <strong className="text-slate-800 block truncate">{s.followUp?.referredToHospitalName || 'District Eye Hospital'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Treatment Status</span>
                  <span className="font-semibold text-slate-800 capitalize block">
                    {s.followUp?.treatmentStatus?.replace('_', ' ') || 'Awaiting appointment'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Screening Date</span>
                  <span className="text-slate-800 block">{new Date(s.createdAt).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Specialist Notes</span>
                  <span className="text-slate-800 truncate block">{s.followUp?.doctorFeedbackNotes || 'None logged'}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Update Tracking Modal */}
      {selectedScreening && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="med-card max-w-md w-full p-6 space-y-4 bg-white shadow-2xl">
            <h3 className="font-heading text-lg font-bold text-slate-900">
              Update Closed-Loop Follow-Up
            </h3>
            <p className="text-xs text-slate-500">
              Patient: <strong>{selectedScreening.patient.name}</strong> ({selectedScreening.id})
            </p>

            <form onSubmit={handleUpdateFollowUp} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Referred Hospital / Center</label>
                <input
                  type="text"
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Treatment Outcome</label>
                <select
                  value={treatmentStatus}
                  onChange={(e) => setTreatmentStatus(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
                >
                  <option value="scheduled">Scheduled Appointment</option>
                  <option value="completed_laser">Completed Panretinal Photocoagulation (Laser)</option>
                  <option value="completed_antivegf">Completed Anti-VEGF Intravitreal Injection</option>
                  <option value="lost_to_follow_up">Lost to Follow-Up / Refused Treatment</option>
                </select>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={visitConfirmed}
                    onChange={(e) => setVisitConfirmed(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span>Confirm Patient Physically Attended Clinic</span>
                </label>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Doctor Feedback & Notes</label>
                <textarea
                  rows={2}
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="e.g. Visual acuity 6/18. Confirmatory slit-lamp exam and OCT completed."
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedScreening(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#059669] hover:bg-emerald-700 text-white font-bold"
                >
                  Save Follow-Up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

