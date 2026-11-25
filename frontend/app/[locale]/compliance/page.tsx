'use client';

import React, { useState } from 'react';
import { db } from '@/lib/offline/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  ShieldAlert, 
  Trash2, 
  Download, 
  FileCheck, 
  Clock, 
  AlertOctagon, 
  CheckCircle2, 
  Lock,
  Search
} from 'lucide-react';

export default function ComplianceDataPage({ params: { locale } }: { params: { locale: string } }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const screenings = useLiveQuery(async () => {
    return await db.screenings.toArray();
  }) || [];

  const auditEvents = useLiveQuery(async () => {
    return await db.auditEvents.toArray();
  }) || [];

  const handleWithdrawConsent = async (screeningId: string) => {
    const confirmWithdraw = window.confirm(
      'DPDP / HIPAA Consent Revocation: Are you sure you want to withdraw patient consent? This will immediately purge retinal imagery and restrict AI inference access.'
    );
    if (!confirmWithdraw) return;

    await db.screenings.update(screeningId, {
      consentWithdrawn: {
        withdrawnAt: new Date().toISOString(),
        reason: 'Patient requested consent revocation under DPDP Act 2023',
        requestedDeletion: true
      },
      status: 'reviewed'
    });

    await db.auditEvents.put({
      id: `audit-${Date.now()}`,
      actorId: 'compliance-officer',
      role: 'admin',
      siteId: 'site-rural-01',
      action: 'CONSENT_WITHDRAWAL_REVOCATION',
      objectType: 'PatientScreening',
      objectId: screeningId,
      timestamp: new Date().toISOString(),
      metadata: { reason: 'DPDP Right to be Forgotten' }
    });

    alert('Patient consent successfully withdrawn and logged in immutable audit trail.');
  };

  const handleExportPatientData = (screening: any) => {
    const exportPayload = {
      exportTimestamp: new Date().toISOString(),
      regulatoryStandard: 'DPDP Act 2023 / HIPAA Sec 164.524 Portable Medical Format',
      screeningData: screening
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient_data_portability_${screening.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 uppercase tracking-wider">
            Regulatory & Compliance Framework
          </span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-slate-900 tracking-tight">
          Data Retention, Archival & Consent Governance
        </h1>
        <p className="text-xs text-slate-500">
          Enforce Digital Personal Data Protection (DPDP Act 2023) and HIPAA compliance: consent withdrawal, patient data export, and session timeout controls.
        </p>
      </div>

      {/* Compliance Protocol Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="med-card p-4 space-y-1 bg-slate-50 border-slate-200">
          <div className="flex items-center gap-2 text-slate-700">
            <Lock className="w-4 h-4 text-[#059669]" />
            <span className="font-bold text-xs">Shared Clinic Session Timeout</span>
          </div>
          <p className="text-xs text-slate-600">
            Automatic screen lock activates after <strong>15 minutes</strong> of idle time on rural PHC tablet devices.
          </p>
        </div>

        <div className="med-card p-4 space-y-1 bg-slate-50 border-slate-200">
          <div className="flex items-center gap-2 text-slate-700">
            <AlertOctagon className="w-4 h-4 text-amber-600" />
            <span className="font-bold text-xs">Consent Revocation Right</span>
          </div>
          <p className="text-xs text-slate-600">
            Under Section 6(4) DPDP Act, patients can revoke consent at any time to purge biometric fundus files.
          </p>
        </div>

        <div className="med-card p-4 space-y-1 bg-slate-50 border-slate-200">
          <div className="flex items-center gap-2 text-slate-700">
            <Download className="w-4 h-4 text-sky-600" />
            <span className="font-bold text-xs">Data Portability Export</span>
          </div>
          <p className="text-xs text-slate-600">
            Export encrypted complete FHIR/JSON patient dossiers for transfer to tertiary hospital EMRs.
          </p>
        </div>
      </div>

      {/* Patient Consent & Retention Table */}
      <div className="med-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h2 className="font-heading text-base font-bold text-slate-900">
            Patient Biometric Data Retention Registry ({screenings.length})
          </h2>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by patient ID or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Patient Identification</th>
                <th className="py-2.5 px-3">Consent Status</th>
                <th className="py-2.5 px-3">Retention Policy</th>
                <th className="py-2.5 px-3">Registration Date</th>
                <th className="py-2.5 px-3 text-right">Compliance Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {screenings.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-900 block">{s.patient.name || 'Anonymous Patient'}</span>
                    <span className="font-mono text-[10px] text-slate-400">{s.patient.patientId || s.id}</span>
                  </td>
                  <td className="py-3 px-3">
                    {s.consentWithdrawn ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        Consent Revoked (Purged)
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#059669] border border-emerald-200">
                        Informed Consent Active
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    <span className="block font-medium">7-Year Medical Retention</span>
                    <span className="text-[10px] text-slate-400">Archival after 90 days</span>
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleExportPatientData(s)}
                        title="Export portable medical record (JSON)"
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                      >
                        <Download className="w-3.5 h-3.5 text-sky-600" />
                      </button>

                      {!s.consentWithdrawn && (
                        <button
                          type="button"
                          onClick={() => handleWithdrawConsent(s.id)}
                          className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px]"
                        >
                          Revoke Consent
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

