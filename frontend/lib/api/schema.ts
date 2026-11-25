export interface PatientDemographics {
  id: string; // client uuid
  patientId?: string; // e.g. PAT-2026-XXXX
  studyId?: string;   // e.g. STU-BLR-004
  name?: string;      // Patient full name
  age: number;
  dateOfBirth?: string;
  sex: 'male' | 'female' | 'other';
  mobileNumber?: string;
  diabetesType: 'type_1' | 'type_2' | 'gestational' | 'unknown';
  diabetesDurationYears: number;
  consentGiven: boolean;
  createdAt: string;
}

export type DefectLabel = 
  | 'blur'
  | 'underexposed'
  | 'overexposed'
  | 'glare'
  | 'incomplete_field'
  | 'poor_centering'
  | 'low_contrast'
  | 'compression_artifact'
  | 'other';

export interface QualityAssessment {
  score: number; // 0.0 - 1.0
  gradable: boolean;
  defects: DefectLabel[];
  recaptureInstruction?: string;
  modelVersion: string;
}

export type ReferralState = 'referable' | 'non_referable' | 'uncertain' | 'ungradable';

export interface PredictionProbabilities {
  [stage: string]: number; // 'No DR': 0.05, 'Mild': 0.1, etc.
}

export type DMEGrade = 'no_dme' | 'non_center_involving' | 'center_involving' | 'ungradable'; // Center-involving is clinically urgent

export interface DMEAssessment {
  detected: boolean;
  grade: DMEGrade;
  referableMaculopathy: boolean;
  hardExudatesNearFovea: boolean;
  fovealZoneDistanceMicrons?: number;
  confidence: number;
}

export interface HardwareMetadata {
  deviceType: 'desktop_fundus' | 'smartphone_adapter' | 'handheld_fundus';
  lensModel?: '20D' | '28D' | 'Volk_iNview' | 'Remidio_FOP' | 'Internal';
  fovDegrees: 30 | 45 | 50 | 60 | 90;
  pupilStatus: 'mydriatic' | 'non_mydriatic';
  flashIntensity?: number;
}

export interface FollowUpTracking {
  referredToHospitalName?: string;
  referralDate: string;
  appointmentScheduledDate?: string;
  actualVisitConfirmed: boolean;
  visitDate?: string;
  treatmentStatus: 'pending' | 'completed_laser' | 'completed_antivegf' | 'lost_to_follow_up' | 'scheduled';
  doctorFeedbackNotes?: string;
  updatedAt: string;
}

export interface PredictionResult {
  referralState: ReferralState;
  referableProb: number | null;
  confidence: number;
  predictedClass: string;
  predictedGrade?: number;
  isGradable?: boolean;
  clinicalStatus?: 'GRADABLE' | 'UNGRADABLE';
  rejectionReason?: string;
  classProbabilities: Record<string, number>;
  dme?: DMEAssessment; // Diabetic Macular Edema detection
  isSightThreatening?: boolean; // PDR or Center-involving DME
  uncertaintyReason?: string;
  modelVersion: string;
  preprocessingVersion: string;
  calibrationVersion: string;
  timestamp: string;
  heatmapUrl?: string;
  lesionsDetected?: LesionDetail[];
}

export interface LesionDetail {
  id?: string;
  name: string;
  termCode?: string; // e.g. MA, HE, CWS, VB, NVE, ATTN
  description: string;
  severity: 'Mild' | 'Moderate' | 'Severe' | 'High' | 'Informational';
  region: string;
  confidence: number;
  // Coordinate percentage on canvas (0 - 100%)
  xPct?: number;
  yPct?: number;
  color?: string;
}

export interface XAIResult {
  heatmapUrl: string;
  overlayUrl: string;
  method: string;
  lesionsDetected?: LesionDetail[];
  clinicalSummary?: string;
  lesionEvidence?: Record<string, unknown>;
  generationVersion: string;
}

export interface EyeData {
  side: 'L' | 'R';
  imageBlob?: Blob;
  imageUrl?: string;
  capturedAt?: string;
  recaptureAttempts: number;
  unableToCapture?: boolean;
  hardware?: HardwareMetadata;
  quality?: QualityAssessment;
  prediction?: PredictionResult;
  xai?: XAIResult;
  clinicianRejection?: {
    rejectedBy: string;
    reason: string;
    rejectedAt: string;
    nurseActionRequired: 'recapture' | 'dilate_pupil' | 'realign_disc';
  };
}

export type ScreeningStatus = 
  | 'created'
  | 'images_pending'
  | 'ready_for_analysis'
  | 'analyzed'
  | 'needs_review'
  | 'reviewed'
  | 'clinician_rejected_for_recapture';

export type SyncStatus = 'synced' | 'pending' | 'offline' | 'failed';

export interface EmergencyEscalationAlert {
  alertId: string;
  triggeredAt: string;
  severity: 'CRITICAL_PDR' | 'URGENT_DME' | 'HIGH_RISK_PROLIFERATIVE';
  recipientsNotified: {
    channel: 'SMS' | 'Email' | 'Push';
    destination: string;
    status: 'sent' | 'delivered' | 'failed';
  }[];
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface ScreeningRecord {
  id: string; // Screening UUID
  idempotencyKey: string;
  patient: PatientDemographics;
  status: ScreeningStatus;
  leftEye: EyeData;
  rightEye: EyeData;
  syncStatus: SyncStatus;
  syncAttempts: number;
  lastSyncError?: string;
  siteId: string;
  operatorId: string;
  emergencyAlert?: EmergencyEscalationAlert;
  followUp?: FollowUpTracking;
  consentWithdrawn?: {
    withdrawnAt: string;
    reason?: string;
    requestedDeletion: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UserAccount {
  id: string;
  username: string;
  fullName: string;
  role: 'nurse' | 'doctor' | 'admin';
  assignedClinic: string;
  status: 'active' | 'suspended';
  phone: string;
  email: string;
  createdAt: string;
  lastLogin?: string;
}

export interface ClinicianReviewDecision {
  screeningId: string;
  clinicianId: string;
  decision: 'confirm' | 'disagree' | 'needs_further_review';
  overrideReferralState?: ReferralState;
  notes?: string;
  reviewedAt: string;
}

export interface AuditEvent {
  id: string;
  actorId: string;
  role: 'operator' | 'clinician' | 'admin' | 'researcher';
  siteId: string;
  action: string;
  objectType: string;
  objectId: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

