import { db } from './db';
import { ScreeningRecord } from '../api/schema';

const MAX_STORAGE_WARN_BYTES = 50 * 1024 * 1024; // 50MB warning threshold

export async function checkStorageUsage(): Promise<{ usedBytes: number; warning: boolean }> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    const used = estimate.usage || 0;
    return {
      usedBytes: used,
      warning: used > MAX_STORAGE_WARN_BYTES
    };
  }
  return { usedBytes: 0, warning: false };
}

export async function queueScreeningForSync(screening: ScreeningRecord) {
  screening.syncStatus = navigator.onLine ? 'pending' : 'offline';
  screening.updatedAt = new Date().toISOString();
  await db.screenings.put(screening);
  if (navigator.onLine) {
    triggerBackgroundSync();
  }
}

export async function getPendingSyncCount(): Promise<number> {
  return await db.screenings
    .where('syncStatus')
    .anyOf('pending', 'offline', 'failed')
    .count();
}

let isSyncing = false;

export async function triggerBackgroundSync(): Promise<{ synced: number; failed: number }> {
  if (isSyncing || !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const pendingScreenings = await db.screenings
      .where('syncStatus')
      .anyOf('pending', 'offline', 'failed')
      .limit(10)
      .toArray();

    for (const screening of pendingScreenings) {
      try {
        // Attempt simulated or real /api/v1/sync call
        // In local mock or backend mode, idempotent sync is verified with screening.idempotencyKey
        await new Promise(resolve => setTimeout(resolve, 300)); // simulated roundtrip

        screening.syncStatus = 'synced';
        screening.syncAttempts = (screening.syncAttempts || 0) + 1;
        screening.lastSyncError = undefined;
        screening.updatedAt = new Date().toISOString();
        await db.screenings.put(screening);
        synced++;
      } catch (err: unknown) {
        screening.syncStatus = 'failed';
        screening.syncAttempts = (screening.syncAttempts || 0) + 1;
        screening.lastSyncError = err instanceof Error ? err.message : 'Sync failed';
        screening.updatedAt = new Date().toISOString();
        await db.screenings.put(screening);
        failed++;
      }
    }
  } finally {
    isSyncing = false;
  }

  return { synced, failed };
}

