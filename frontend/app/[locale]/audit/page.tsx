'use client';

import React, { useState } from 'react';
import { db } from '@/lib/offline/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search } from 'lucide-react';

export default function AuditLogPage() {
  const [filterAction, setFilterAction] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const auditEvents = useLiveQuery(async () => {
    return await db.auditEvents.reverse().sortBy('timestamp');
  }, []) || [];

  const filtered = auditEvents.filter((ev) => {
    if (filterAction !== 'all' && ev.action !== filterAction) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        ev.actorId.toLowerCase().includes(q) ||
        ev.objectId.toLowerCase().includes(q) ||
        ev.action.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Audit Trail</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            FR-10: Immutable audit records for authentication, screening, reviews, and threshold edits.
          </p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Actor ID, Object ID, or Action..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
        >
          <option value="all">All Actions</option>
          <option value="SUBMIT_CLINICIAN_REVIEW">Clinician Review</option>
          <option value="UPDATE_AI_THRESHOLDS">Threshold Updates</option>
          <option value="CAPTURE_IMAGE">Image Capture</option>
          <option value="LOGIN">User Login</option>
        </select>
      </div>

      {/* Events List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-xs">
            No audit records matching search filter.
          </div>
        ) : (
          filtered.map((ev) => (
            <div key={ev.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    {ev.action}
                  </span>
                  <span className="text-slate-500">&bull;</span>
                  <span className="font-semibold text-slate-800">Actor: {ev.actorId}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-100 text-slate-600">
                    {ev.role}
                  </span>
                </div>
                <p className="text-slate-500">
                  Target: {ev.objectType} ({ev.objectId}) &bull; Site: {ev.siteId}
                </p>
                {ev.metadata && (
                  <pre className="text-[10px] bg-slate-50 p-2 rounded text-slate-600 overflow-x-auto">
                    {JSON.stringify(ev.metadata)}
                  </pre>
                )}
              </div>

              <div className="text-right text-[11px] text-slate-400 font-mono">
                {new Date(ev.timestamp).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

