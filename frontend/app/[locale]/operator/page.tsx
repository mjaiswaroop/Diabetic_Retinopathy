'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/lib/offline/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Users, 
  PlusCircle, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Camera, 
  ArrowRight,
  ShieldCheck,
  Search,
  FileSpreadsheet,
  DatabaseBackup,
  Upload
} from 'lucide-react';
import { exportScreeningsToExcel, exportDatabaseBackup, restoreDatabaseFromBackup } from '@/lib/export/dataExport';

export default function OperatorDashboardPage({ params: { locale } }: { params: { locale: string } }) {
  const [isOnline, setIsOnline] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Live queries for operator metrics
  const allScreenings = useLiveQuery(async () => {
    return await db.screenings.toArray();
  }) || [];

  // Metrics calculations
  const inProgressCount = allScreenings.filter(s => s.status === 'images_pending' || s.status === 'ready_for_analysis').length;
  const completedTodayCount = allScreenings.filter(s => s.status === 'analyzed' || s.status === 'reviewed').length;
  
  // Recapture required count (either eye has recapture attempt > 0 or ungradable quality)
  const recaptureCount = allScreenings.filter(s => 
    (s.leftEye.recaptureAttempts > 0 && !s.leftEye.quality?.gradable) || 
    (s.rightEye.recaptureAttempts > 0 && !s.rightEye.quality?.gradable)
  ).length;

  // Failed quality checks
  const failedQualityCount = allScreenings.filter(s => 
    (s.leftEye.quality && !s.leftEye.quality.gradable) || 
    (s.rightEye.quality && !s.rightEye.quality.gradable)
  ).length;

  // Pending sync queue vs synced records
  const pendingSyncQueue = allScreenings.filter(s => s.syncStatus === 'pending' || s.syncStatus === 'offline');
  const syncedRecords = allScreenings.filter(s => s.syncStatus === 'synced');

  // Filtered recent patients
  const recentPatients = allScreenings
    .filter(s => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const name = s.patient.name?.toLowerCase() || '';
      const pid = s.patient.patientId?.toLowerCase() || '';
      const sid = s.id.toLowerCase();
      return name.includes(term) || pid.includes(term) || sid.includes(term);
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-4 w-full pb-6">
      {/* Header with Operator Info & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold text-[#059669] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider">
              Clinical Registry &amp; Patient Queue
            </span>
            <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              isOnline ? 'bg-emerald-50 text-[#059669] border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span>{isOnline ? 'Online Ready' : 'Offline Mode (Local DB)'}</span>
            </div>
          </div>
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Patient Registry &amp; Screening Status
          </h1>
          <p className="text-xs text-slate-500">
            Comprehensive patient list, triage urgency status, image gradability, and central synchronization.
          </p>
        </div>

        {/* Action Buttons: Export Excel, Vault Backup & Start New Screening */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportScreeningsToExcel(allScreenings, 'RetinaScan_All_Patients')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs transition"
            title="Export all patient records to Excel / CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={() => exportDatabaseBackup()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 bg-white text-slate-700 font-semibold text-xs transition"
            title="Download full encrypted backup file (JSON)"
          >
            <DatabaseBackup className="w-3.5 h-3.5 text-slate-500" />
            <span>Backup File</span>
          </button>

          <label
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-slate-300 hover:bg-slate-50 bg-white text-slate-600 font-medium text-xs cursor-pointer transition"
            title="Restore database from a backup JSON file"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Restore Backup</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const res = await restoreDatabaseFromBackup(file);
                  if (res.success) {
                    alert(`Successfully restored ${res.count} patient records from backup.`);
                  } else {
                    alert(`Backup restore failed: ${res.error}`);
                  }
                }
              }}
            />
          </label>

          <Link
            href={`/${locale}/screenings/new`}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-xs shadow-sm active:scale-95 transition-all duration-200"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Start New Screening</span>
          </Link>
        </div>
      </div>

      {/* Overview KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* In-progress */}
        <div className="med-card-hover p-4 space-y-0.5">
          <div className="flex items-center justify-between text-slate-500 mb-0.5">
            <span className="text-[11px] font-medium">In-Progress</span>
            <Clock className="w-3.5 h-3.5 text-[#0284c7]" />
          </div>
          <p className="font-heading text-xl font-bold text-slate-900">{inProgressCount}</p>
          <span className="text-[10px] text-slate-500 font-medium">Awaiting retinal capture</span>
        </div>

        {/* Recaptures */}
        <div className="med-card-hover p-4 space-y-0.5">
          <div className="flex items-center justify-between text-slate-500 mb-0.5">
            <span className="text-[11px] font-medium">Recaptures Needed</span>
            <Camera className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="font-heading text-xl font-bold text-slate-900">{recaptureCount}</p>
          <span className="text-[10px] text-amber-600 font-medium">Blur / poor illumination</span>
        </div>

        {/* Failed quality */}
        <div className="med-card-hover p-4 space-y-0.5">
          <div className="flex items-center justify-between text-slate-500 mb-0.5">
            <span className="text-[11px] font-medium">Failed Quality</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <p className="font-heading text-xl font-bold text-slate-900">{failedQualityCount}</p>
          <span className="text-[10px] text-rose-600 font-medium">IQA &lt; 60% threshold</span>
        </div>

        {/* Sync queue */}
        <div className="med-card-hover p-4 space-y-0.5">
          <div className="flex items-center justify-between text-slate-500 mb-0.5">
            <span className="text-[11px] font-medium">Sync Queue</span>
            <RefreshCw className="w-3.5 h-3.5 text-[#059669]" />
          </div>
          <p className="font-heading text-xl font-bold text-slate-900">{pendingSyncQueue.length}</p>
          <span className="text-[10px] text-[#059669] font-medium">{syncedRecords.length} records synced</span>
        </div>
      </div>

      {/* Sync Status Banner */}
      <div className="med-card p-4 bg-gradient-to-r from-slate-50 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#059669] flex items-center justify-center shrink-0 border border-emerald-200">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-xs text-slate-900">Local Offline Data Store (IndexedDB)</h3>
            <p className="text-[11px] text-slate-500">
              {pendingSyncQueue.length === 0 
                ? 'All screening records and retinal image payloads are safely synchronized.' 
                : `${pendingSyncQueue.length} patient record(s) queued for synchronization.`}
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
          {allScreenings.length} Total Patients
        </span>
      </div>

      {/* Recent Patients Table */}
      <div className="med-card p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-heading text-lg font-bold text-slate-900 tracking-tight">Recent Patients</h2>
            <p className="text-xs text-slate-500">Search and track daily patient screening workflows.</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#059669]"
            />
          </div>
        </div>

        {recentPatients.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-600">No screenings recorded yet</p>
            <p className="text-xs text-slate-400">Click &quot;Start New Screening&quot; above to register the first patient.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Patient Name / ID</th>
                  <th className="py-2.5 px-3">Age / Gender</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Quality</th>
                  <th className="py-2.5 px-3">Sync</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentPatients.map((s) => {
                  const leftGradable = s.leftEye.quality?.gradable ?? true;
                  const rightGradable = s.rightEye.quality?.gradable ?? true;
                  const hasQualityIssue = !leftGradable || !rightGradable;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 block">{s.patient.name || 'Anonymous Patient'}</span>
                        <span className="font-mono text-[10px] text-slate-400">{s.patient.patientId || s.id}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        {s.patient.age} yrs &bull; <span className="capitalize">{s.patient.sex}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full font-semibold text-[10px] border ${
                          s.status === 'analyzed' || s.status === 'reviewed'
                            ? 'bg-emerald-50 text-[#059669] border-emerald-200'
                            : s.status === 'images_pending'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-sky-50 text-[#0284c7] border-sky-200'
                        }`}>
                          {s.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {hasQualityIssue ? (
                          <span className="text-amber-600 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Recapture
                          </span>
                        ) : (
                          <span className="text-[#059669] font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Gradable
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`font-medium ${
                          s.syncStatus === 'synced' ? 'text-[#059669]' : 'text-slate-500'
                        }`}>
                          {s.syncStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link
                          href={
                            s.status === 'images_pending'
                              ? `/${locale}/screenings/${s.id}/capture?eye=L`
                              : `/${locale}/screenings/${s.id}/result`
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-[#059669] font-semibold text-[11px] transition"
                        >
                          <span>{s.status === 'images_pending' ? 'Capture' : 'View'}</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

