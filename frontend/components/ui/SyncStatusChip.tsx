'use client';

import React, { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { SyncStatus } from '@/lib/api/schema';
import { db } from '@/lib/offline/db';
import { triggerBackgroundSync, checkStorageUsage } from '@/lib/offline/syncQueue';
import { useLiveQuery } from 'dexie-react-hooks';

export function SyncStatusChip() {
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);

  // dexie query for pending count
  const pendingCount = useLiveQuery(async () => {
    return await db.screenings
      .where('syncStatus')
      .anyOf('pending', 'offline', 'failed')
      .count();
  }, []) ?? 0;

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      triggerBackgroundSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial storage check
    checkStorageUsage().then(res => setStorageWarning(res.warning));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualSync = async () => {
    if (!isOnline || syncing) return;
    setSyncing(true);
    await triggerBackgroundSync();
    setSyncing(false);
  };

  const getChipStyle = (st: SyncStatus) => {
    switch (st) {
      case 'synced':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'pending':
        return 'bg-amber-50 text-amber-800 border-amber-300';
      case 'failed':
        return 'bg-rose-50 text-rose-800 border-rose-300';
      case 'offline':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const [hasFailed] = useState(false);

  let status: SyncStatus = 'synced';
  if (!isOnline) {
    status = 'offline';
  } else if (hasFailed) {
    status = 'failed';
  } else if (syncing || pendingCount > 0) {
    status = 'pending';
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleManualSync}
        disabled={!isOnline || syncing}
        aria-label={`Sync status: ${status}`}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors shadow-sm min-h-[36px] ${getChipStyle(status)}`}
      >
        {status === 'synced' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
        {status === 'pending' && <RefreshCw className={`w-4 h-4 text-amber-600 ${syncing ? 'animate-spin' : ''}`} />}
        {status === 'offline' && <CloudOff className="w-4 h-4 text-slate-500" />}
        {status === 'failed' && <AlertTriangle className="w-4 h-4 text-rose-600" />}

        <span className="capitalize">
          {status === 'pending' ? `Pending (${pendingCount})` : status}
        </span>
      </button>

      {storageWarning && (
        <span 
          title="Local offline queue is above 50MB. Please sync soon."
          className="p-1 rounded-full bg-amber-100 text-amber-800 text-xs flex items-center"
        >
          <AlertTriangle className="w-3.5 h-3.5 mr-1" /> &gt;50MB
        </span>
      )}
    </div>
  );
}

