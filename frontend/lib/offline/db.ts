import Dexie, { Table } from 'dexie';
import { ScreeningRecord, AuditEvent, UserAccount } from '../api/schema';

export interface QueuedImage {
  id: string; // image UUID
  screeningId: string;
  eyeSide: 'L' | 'R';
  blob: Blob;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256?: string;
  createdAt: string;
}

export interface ThresholdConfig {
  id: string;
  referableThreshold: number; // e.g. 0.41
  uncertaintyThreshold: number; // e.g. 0.65
  qualityCutoff: number; // e.g. 0.60
  dmeSensitivityCutoff: number; // e.g. 0.50
  autoEmergencyAlerts: boolean; // PDR / DME SMS & Push
  modelVersion: string; // e.g. v2.1.0-resnet50
  updatedAt: string;
  updatedBy: string;
}

export class XAIDatabase extends Dexie {
  screenings!: Table<ScreeningRecord, string>;
  images!: Table<QueuedImage, string>;
  auditEvents!: Table<AuditEvent, string>;
  thresholds!: Table<ThresholdConfig, string>;
  users!: Table<UserAccount, string>;

  constructor() {
    super('XAIDatabase');
    this.version(2).stores({
      screenings: 'id, idempotencyKey, status, syncStatus, createdAt',
      images: 'id, screeningId, eyeSide, createdAt',
      auditEvents: 'id, actorId, action, timestamp',
      thresholds: 'id, updatedAt',
      users: 'id, username, role, assignedClinic, status'
    });
  }
}

export const db = new XAIDatabase();

// Pre-seed default thresholds & admin accounts if not present
export async function initDatabase() {
  const legacyMockKeys = ['SCR-104921', 'SCR-104922', 'SCR-104923', 'SCR-104924', 'SCR-104925', 'SCR-104926'];
  for (const k of legacyMockKeys) {
    await db.screenings.delete(k);
  }

  // Pre-seed default users
  const userCount = await db.users.count();
  if (userCount === 0) {
    await db.users.bulkPut([
      {
        id: 'usr-admin-1',
        username: 'superadmin',
        fullName: 'Dr. Anita Desai (System Administrator)',
        role: 'admin',
        assignedClinic: 'National Tele-Ophthalmology Grid',
        status: 'active',
        phone: '+91 98450 11223',
        email: 'anita.desai@telehealth.gov.in',
        createdAt: new Date().toISOString()
      },
      {
        id: 'usr-nurse-1',
        username: 'sunita.nurse',
        fullName: 'Sister Sunita Patil (Field Nurse)',
        role: 'nurse',
        assignedClinic: 'PHC Mandya, Rural Karnataka',
        status: 'active',
        phone: '+91 94481 23456',
        email: 'sunita.patil@karnataka.health',
        createdAt: new Date().toISOString()
      },
      {
        id: 'usr-doctor-1',
        username: 'dr.sharma',
        fullName: 'Dr. Alok Sharma, MS (Retina Specialist)',
        role: 'doctor',
        assignedClinic: 'Minto Eye Hospital / District Tele-Center',
        status: 'active',
        phone: '+91 98860 78901',
        email: 'alok.sharma@mintoeye.org',
        createdAt: new Date().toISOString()
      }
    ]);
  }

  const existing = await db.thresholds.get('default');
  if (!existing) {
    await db.thresholds.put({
      id: 'default',
      referableThreshold: 0.41,
      uncertaintyThreshold: 0.65,
      qualityCutoff: 0.60,
      dmeSensitivityCutoff: 0.50,
      autoEmergencyAlerts: true,
      modelVersion: 'v2.1.0-resnet50',
      updatedAt: new Date().toISOString(),
      updatedBy: 'system'
    });
  }
}

