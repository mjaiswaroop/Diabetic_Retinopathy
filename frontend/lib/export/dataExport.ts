import { ScreeningRecord } from '@/lib/api/schema';
import { db } from '@/lib/offline/db';

/**
 * Clean data export service for Excel (CSV/XLSX) and Full System Backup (JSON).
 * Zero heavy external dependencies, robust and offline-first.
 */

// Escape cell contents for CSV format (Excel standard RFC 4180)
function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/"/g, '""');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str}"`;
  }
  return str;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Exports a single screening record or an array of screenings into an Excel-compatible CSV file.
 * Automatically adds UTF-8 Byte Order Mark (BOM) so Microsoft Excel opens it directly with correct characters.
 */
export function exportScreeningsToExcel(screenings: ScreeningRecord | ScreeningRecord[], filenamePrefix = 'RetinaScan_Export'): void {
  const records = Array.isArray(screenings) ? screenings : [screenings];
  if (records.length === 0) {
    alert('No screening records available to export.');
    return;
  }

  const headers = [
    'Screening ID',
    'Date & Time (UTC)',
    'Study ID',
    'Patient ID',
    'Patient Name',
    'Age',
    'Sex',
    'Diabetes Type',
    'Diabetes Duration (Yrs)',
    'Site ID',
    'Operator ID',
    'Overall Status',
    'Sync Status',
    // Left Eye (OS)
    'OS Status',
    'OS ICDR Grade',
    'OS Diagnosis Class',
    'OS Referable Risk P(>=2)',
    'OS Confidence',
    'OS DME Detected',
    'OS Optical Quality',
    'OS Rejection Reason',
    // Right Eye (OD)
    'OD Status',
    'OD ICDR Grade',
    'OD Diagnosis Class',
    'OD Referable Risk P(>=2)',
    'OD Confidence',
    'OD DME Detected',
    'OD Optical Quality',
    'OD Rejection Reason',
    // Clinical Parameters
    'Calibrated Cutoff (tau)',
    'Temperature (T)'
  ];

  const rows = records.map(s => {
    const leftPred = s.leftEye.prediction;
    const rightPred = s.rightEye.prediction;

    const isLeftUngradable = s.leftEye.unableToCapture || leftPred?.referralState === 'ungradable' || leftPred?.isGradable === false || leftPred?.predictedGrade === -1;
    const isRightUngradable = s.rightEye.unableToCapture || rightPred?.referralState === 'ungradable' || rightPred?.isGradable === false || rightPred?.predictedGrade === -1;

    const isLeftReferable = !isLeftUngradable && leftPred?.referralState === 'referable';
    const isRightReferable = !isRightUngradable && rightPred?.referralState === 'referable';

    let overallTriage = 'Non-Referable';
    if (isLeftReferable || isRightReferable) overallTriage = 'Referable DR';
    else if (isLeftUngradable || isRightUngradable) overallTriage = 'Ungradable Scan';
    else if (leftPred?.referralState === 'uncertain' || rightPred?.referralState === 'uncertain') overallTriage = 'Uncertain / Review';

    return [
      s.id,
      s.createdAt,
      s.patient.studyId || '',
      s.patient.patientId || '',
      s.patient.name || '',
      s.patient.age ?? '',
      s.patient.sex || '',
      s.patient.diabetesType || '',
      s.patient.diabetesDurationYears ?? '',
      s.siteId || '',
      s.operatorId || '',
      overallTriage,
      s.syncStatus,
      // Left Eye
      isLeftUngradable ? 'Ungradable' : (leftPred?.referralState || 'Pending'),
      isLeftUngradable ? -1 : (leftPred?.predictedGrade ?? ''),
      isLeftUngradable ? 'Ungradable Quality' : (leftPred?.predictedClass || ''),
      isLeftUngradable ? 'N/A' : (leftPred?.referableProb != null ? `${Math.round(leftPred.referableProb * 100)}%` : ''),
      isLeftUngradable ? 'N/A' : (leftPred?.confidence != null ? `${Math.round(leftPred.confidence * 100)}%` : ''),
      isLeftUngradable ? 'N/A' : (leftPred?.predictedGrade && leftPred.predictedGrade >= 2 ? 'Suspected' : 'No DME'),
      isLeftUngradable ? 'Failed Optical Criteria' : 'Adequate (Sharpness >= 14.0)',
      leftPred?.rejectionReason || '',
      // Right Eye
      isRightUngradable ? 'Ungradable' : (rightPred?.referralState || 'Pending'),
      isRightUngradable ? -1 : (rightPred?.predictedGrade ?? ''),
      isRightUngradable ? 'Ungradable Quality' : (rightPred?.predictedClass || ''),
      isRightUngradable ? 'N/A' : (rightPred?.referableProb != null ? `${Math.round(rightPred.referableProb * 100)}%` : ''),
      isRightUngradable ? 'N/A' : (rightPred?.confidence != null ? `${Math.round(rightPred.confidence * 100)}%` : ''),
      isRightUngradable ? 'N/A' : (rightPred?.predictedGrade && rightPred.predictedGrade >= 2 ? 'Suspected' : 'No DME'),
      isRightUngradable ? 'Failed Optical Criteria' : 'Adequate (Sharpness >= 14.0)',
      rightPred?.rejectionReason || '',
      // Params
      '41.06%',
      '1.9567'
    ].map(escapeCSV).join(',');
  });

  // UTF-8 BOM (\uFEFF) forces Microsoft Excel to decode UTF-8 correctly
  const csvContent = '\uFEFF' + [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `${filenamePrefix}_${timestamp}.csv`;
  triggerDownload(blob, filename);
}

/**
 * Exports complete database backup archive as a structured, versioned JSON snapshot file.
 * Includes all screenings, patient metadata, audit events, and hardware configurations.
 */
export async function exportDatabaseBackup(): Promise<void> {
  const screenings = await db.screenings.toArray();
  const auditEvents = await db.auditEvents.toArray();
  const thresholds = await db.thresholds.toArray();
  const users = await db.users.toArray();

  const backupData = {
    app: 'RetinaScan Pro',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    stats: {
      screeningsCount: screenings.length,
      auditEventsCount: auditEvents.length,
      usersCount: users.length
    },
    tables: {
      screenings,
      auditEvents,
      thresholds,
      users
    }
  };

  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  triggerDownload(blob, `RetinaScan_Backup_Vault_${timestamp}.json`);
}

/**
 * Restores the database from a user-uploaded JSON backup file.
 */
export async function restoreDatabaseFromBackup(file: File): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.tables || !Array.isArray(data.tables.screenings)) {
      return { success: false, count: 0, error: 'Invalid backup file structure. Missing screenings table.' };
    }

    if (data.tables.screenings.length > 0) {
      await db.screenings.bulkPut(data.tables.screenings);
    }
    if (Array.isArray(data.tables.auditEvents) && data.tables.auditEvents.length > 0) {
      await db.auditEvents.bulkPut(data.tables.auditEvents);
    }
    if (Array.isArray(data.tables.users) && data.tables.users.length > 0) {
      await db.users.bulkPut(data.tables.users);
    }

    return { success: true, count: data.tables.screenings.length };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, count: 0, error: message };
  }
}

