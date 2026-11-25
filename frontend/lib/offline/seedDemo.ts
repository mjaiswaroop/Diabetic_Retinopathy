import { db } from './db';

/**
 * seedDemoData has been cleared: 0 mock data.
 * Pure real database: start fresh with zero mock records.
 */
export async function seedDemoData() {
  // 0 mock data seeded
}

/**
 * Clear any existing mock/demo screenings from IndexedDB
 */
export async function clearAllMockData() {
  await db.screenings.clear();
  await db.images.clear();
  await db.auditEvents.clear();
}
