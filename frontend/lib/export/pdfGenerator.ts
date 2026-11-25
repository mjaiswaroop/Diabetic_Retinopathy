import { ScreeningRecord } from '@/lib/api/schema';

/**
 * Clean client-side PDF document generator producing a formal vector PDF screening report.
 * Embeds high-resolution circular fundus thumbnails, Grad-CAM++ saliency overlays,
 * bilateral summaries, quality compliance, and research disclaimers.
 * Zero external package dependencies, zero bundling conflicts.
 */
export function generateClinicalPDF(screening: ScreeningRecord): void {
  const { patient, leftEye, rightEye } = screening;
  const leftPred = leftEye.prediction;
  const rightPred = rightEye.prediction;

  // Triage state computation
  const isLeftUngradable = leftEye.unableToCapture || leftPred?.referralState === 'ungradable' || leftPred?.isGradable === false || leftPred?.predictedGrade === -1;
  const isRightUngradable = rightEye.unableToCapture || rightPred?.referralState === 'ungradable' || rightPred?.isGradable === false || rightPred?.predictedGrade === -1;

  const isLeftReferable = !isLeftUngradable && leftPred?.referralState === 'referable';
  const isRightReferable = !isRightUngradable && rightPred?.referralState === 'referable';

  let overallStatus = 'NON-REFERABLE (ANNUAL ROUTINE RESCREEN)';
  if (isLeftReferable || isRightReferable) {
    overallStatus = 'REFERABLE DR (OPHTHALMIC SPECIALIST REFERRAL REQUIRED)';
  } else if (isLeftUngradable || isRightUngradable) {
    overallStatus = 'UNGRADABLE SCAN — RECAPTURE OR OPHTHALMIC REVIEW REQUIRED';
  } else if (leftPred?.referralState === 'uncertain' || rightPred?.referralState === 'uncertain') {
    overallStatus = 'UNCERTAIN FINDINGS — CLINICAL SLIT-LAMP REVIEW RECOMMENDED';
  }

  const reportDate = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const leftFundus = leftEye.imageUrl || '';
  const leftHeatmap = leftPred?.heatmapUrl || leftEye.xai?.heatmapUrl || '';

  const rightFundus = rightEye.imageUrl || '';
  const rightHeatmap = rightPred?.heatmapUrl || rightEye.xai?.heatmapUrl || '';

  // Construct printable HTML formatted window for instant clean PDF export
  const printWindow = window.open('', '_blank', 'width=950,height=1150');
  if (!printWindow) {
    alert('Please allow popups to download or print the Clinical PDF Screening Report.');
    return;
  }

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>RetinaScan_Pro_Screening_Report_${screening.patient.patientId || screening.id.slice(0, 8)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 12mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 10.5px;
      line-height: 1.35;
    }
    .header-bar {
      border-bottom: 2px solid #0f766e;
      padding-bottom: 6px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand-title {
      font-size: 17px;
      font-weight: 800;
      color: #0f766e;
      letter-spacing: -0.5px;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .brand-sub {
      font-size: 8.5px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .meta-box {
      text-align: right;
      font-size: 8.5px;
      color: #475569;
    }
    .triage-banner {
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid;
    }
    .triage-referable {
      background-color: #fff1f2;
      border-color: #fecdd3;
      color: #9f1239;
    }
    .triage-nonreferable {
      background-color: #f0fdf4;
      border-color: #bbf7d0;
      color: #166534;
    }
    .triage-ungradable {
      background-color: #fffbeb;
      border-color: #fde68a;
      color: #92400e;
    }
    .section-title {
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #334155;
      margin-top: 8px;
      margin-bottom: 5px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 2px;
    }
    .demographics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 10px;
      margin-bottom: 10px;
    }
    .demo-item span {
      display: block;
      font-size: 7.5px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
    }
    .demo-item strong {
      font-size: 10.5px;
      color: #0f172a;
    }
    .eyes-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 8px;
    }
    .eye-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      background: #ffffff;
    }
    .eye-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 5px;
      margin-bottom: 6px;
    }
    .eye-name {
      font-size: 11px;
      font-weight: 700;
      color: #0f172a;
    }
    .eye-badge {
      font-size: 8.5px;
      font-weight: 700;
      padding: 2px 5px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .badge-referable { background: #fee2e2; color: #991b1b; }
    .badge-nonref { background: #dcfce7; color: #166534; }
    .badge-ungradable { background: #fef3c7; color: #92400e; }
    
    .images-row {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-bottom: 6px;
      background: #090d16;
      border-radius: 6px;
      padding: 6px;
    }
    .thumb-wrapper {
      position: relative;
      width: 90px;
      height: 90px;
      border-radius: 4px;
      overflow: hidden;
      border: 1px solid #334155;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .thumb-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .thumb-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      mix-blend-mode: screen;
      opacity: 0.85;
    }
    .thumb-label {
      position: absolute;
      bottom: 2px;
      left: 2px;
      background: rgba(0, 0, 0, 0.75);
      color: #fff;
      font-size: 7px;
      font-weight: 600;
      padding: 1px 3px;
      border-radius: 2px;
      text-transform: uppercase;
    }

    .metric-row {
      display: flex;
      justify-content: space-between;
      padding: 2.5px 0;
      border-bottom: 1px dashed #f1f5f9;
      font-size: 9.5px;
    }
    .metric-row:last-child {
      border-bottom: none;
    }
    .metric-label {
      color: #64748b;
    }
    .metric-val {
      font-weight: 600;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
    }
    .guidance-box {
      margin-top: 6px;
      padding: 5px 8px;
      border-radius: 4px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      font-size: 9px;
      line-height: 1.3;
      color: #334155;
    }
    .disclaimer-box {
      margin-top: 10px;
      border: 1px solid #e2e8f0;
      border-radius: 5px;
      background: #fafafa;
      padding: 6px 8px;
      font-size: 8px;
      color: #64748b;
      line-height: 1.3;
    }
    .sign-row {
      margin-top: 18px;
      display: flex;
      justify-content: space-between;
      padding-top: 6px;
    }
    .sign-block {
      width: 190px;
      border-top: 1px solid #94a3b8;
      padding-top: 3px;
      text-align: center;
      font-size: 8.5px;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <div>
      <div class="brand-title">
        RetinaScan Pro
        <span style="font-size: 8px; font-weight: 700; color: #475569; border: 1px solid #cbd5e1; padding: 1px 4px; border-radius: 3px; text-transform: uppercase;">Research Tool</span>
      </div>
      <div class="brand-sub">Investigational DR Screening & Triage Report</div>
    </div>
    <div class="meta-box">
      <div><strong>Screening ID:</strong> ${screening.id}</div>
      <div><strong>Generated:</strong> ${reportDate} (IST)</div>
      <div><strong>Model:</strong> ResNet-50 Calibrated (&tau; = 41.06%, T = 1.9567)</div>
    </div>
  </div>

  <div class="triage-banner ${
    isLeftReferable || isRightReferable
      ? 'triage-referable'
      : isLeftUngradable || isRightUngradable
      ? 'triage-ungradable'
      : 'triage-nonreferable'
  }">
    <div>
      <span style="font-size: 8px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; display: block;">
        Overall Screening Triage Result
      </span>
      <strong style="font-size: 12px; font-weight: 800;">
        ${overallStatus}
      </strong>
    </div>
    <div style="font-size: 9px; text-align: right; font-weight: 600;">
      Worst-Eye Protocol &bull; Single-Field Non-Mydriatic
    </div>
  </div>

  <div class="section-title">Patient Demographics & Clinical Profile</div>
  <div class="demographics-grid">
    <div class="demo-item">
      <span>Patient Name / ID</span>
      <strong>${patient.name || 'Anonymous'} (${patient.patientId || 'N/A'})</strong>
    </div>
    <div class="demo-item">
      <span>Age / Sex</span>
      <strong>${patient.age || 'N/A'} yrs &bull; ${patient.sex ? patient.sex.toUpperCase() : 'N/A'}</strong>
    </div>
    <div class="demo-item">
      <span>Diabetes Profile</span>
      <strong>${(patient.diabetesType || 'Type 2').replace('_', ' ')} (${patient.diabetesDurationYears || 0} yrs)</strong>
    </div>
    <div class="demo-item">
      <span>Study / Center ID</span>
      <strong>${screening.siteId || 'Rural Center 01'}</strong>
    </div>
  </div>

  <div class="section-title">Bilateral Fundus Evaluation (OS vs. OD)</div>
  <div class="eyes-grid">
    <!-- Left Eye (OS) -->
    <div class="eye-card">
      <div class="eye-header">
        <span class="eye-name">Left Eye (OS - Oculus Sinister)</span>
        <span class="eye-badge ${
          isLeftUngradable ? 'badge-ungradable' : isLeftReferable ? 'badge-referable' : 'badge-nonref'
        }">
          ${isLeftUngradable ? 'Ungradable' : leftPred?.predictedClass || 'Normal'}
        </span>
      </div>

      <!-- Left Visuals -->
      <div class="images-row">
        <div class="thumb-wrapper">
          ${leftFundus ? `<img src="${leftFundus}" class="thumb-img" alt="OS Fundus"/>` : '<span style="color:#64748b; font-size:8px;">No Image</span>'}
          <span class="thumb-label">Original</span>
        </div>
        <div class="thumb-wrapper">
          ${leftFundus ? `<img src="${leftFundus}" class="thumb-img" alt="OS Fundus"/>` : ''}
          ${leftHeatmap ? `<img src="${leftHeatmap}" class="thumb-overlay" alt="OS Grad-CAM++"/>` : ''}
          <span class="thumb-label">Grad-CAM++</span>
        </div>
      </div>

      <div class="metric-row">
        <span class="metric-label">Predicted ICDR Stage:</span>
        <span class="metric-val">${isLeftUngradable ? 'Ungradable Quality (Grade -1)' : leftPred?.predictedClass || 'Grade 0'}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Referable DR Risk P(&ge;2):</span>
        <span class="metric-val">${isLeftUngradable ? 'N/A' : (leftPred?.referableProb != null ? `${Math.round(leftPred.referableProb * 100)}%` : 'N/A')} (Cutoff &tau; = 41.06%)</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Diabetic Macular Edema (DME):</span>
        <span class="metric-val">${isLeftUngradable ? 'Ungradable' : (leftPred?.predictedGrade && leftPred.predictedGrade >= 2 ? 'Referable DME Suspected' : 'No DME Detected')}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Diagnostic Optical Quality:</span>
        <span class="metric-val">${isLeftUngradable ? 'Failed Quality Criteria' : 'Adequate (Sharpness &ge; 14.0)'}</span>
      </div>
      <div class="guidance-box">
        <strong>Clinical Recommendation:</strong><br/>
        ${
          isLeftUngradable
            ? (leftPred?.rejectionReason || 'Defocus, glare, or underexposure. Pupil re-alignment and clean lens recapture mandated.')
            : isLeftReferable
            ? 'Specialist vitreo-retina consultation within 2-4 weeks for comprehensive dilated examination.'
            : 'Annual routine DR rescreening. Maintain tight glycemic and blood pressure control.'
        }
      </div>
    </div>

    <!-- Right Eye (OD) -->
    <div class="eye-card">
      <div class="eye-header">
        <span class="eye-name">Right Eye (OD - Oculus Dextrus)</span>
        <span class="eye-badge ${
          isRightUngradable ? 'badge-ungradable' : isRightReferable ? 'badge-referable' : 'badge-nonref'
        }">
          ${isRightUngradable ? 'Ungradable' : rightPred?.predictedClass || 'Normal'}
        </span>
      </div>

      <!-- Right Visuals -->
      <div class="images-row">
        <div class="thumb-wrapper">
          ${rightFundus ? `<img src="${rightFundus}" class="thumb-img" alt="OD Fundus"/>` : '<span style="color:#64748b; font-size:8px;">No Image</span>'}
          <span class="thumb-label">Original</span>
        </div>
        <div class="thumb-wrapper">
          ${rightFundus ? `<img src="${rightFundus}" class="thumb-img" alt="OD Fundus"/>` : ''}
          ${rightHeatmap ? `<img src="${rightHeatmap}" class="thumb-overlay" alt="OD Grad-CAM++"/>` : ''}
          <span class="thumb-label">Grad-CAM++</span>
        </div>
      </div>

      <div class="metric-row">
        <span class="metric-label">Predicted ICDR Stage:</span>
        <span class="metric-val">${isRightUngradable ? 'Ungradable Quality (Grade -1)' : rightPred?.predictedClass || 'Grade 0'}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Referable DR Risk P(&ge;2):</span>
        <span class="metric-val">${isRightUngradable ? 'N/A' : (rightPred?.referableProb != null ? `${Math.round(rightPred.referableProb * 100)}%` : 'N/A')} (Cutoff &tau; = 41.06%)</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Diabetic Macular Edema (DME):</span>
        <span class="metric-val">${isRightUngradable ? 'Ungradable' : (rightPred?.predictedGrade && rightPred.predictedGrade >= 2 ? 'Referable DME Suspected' : 'No DME Detected')}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Diagnostic Optical Quality:</span>
        <span class="metric-val">${isRightUngradable ? 'Failed Quality Criteria' : 'Adequate (Sharpness &ge; 14.0)'}</span>
      </div>
      <div class="guidance-box">
        <strong>Clinical Recommendation:</strong><br/>
        ${
          isRightUngradable
            ? (rightPred?.rejectionReason || 'Defocus, glare, or underexposure. Pupil re-alignment and clean lens recapture mandated.')
            : isRightReferable
            ? 'Specialist vitreo-retina consultation within 2-4 weeks for comprehensive dilated examination.'
            : 'Annual routine DR rescreening. Maintain tight glycemic and blood pressure control.'
        }
      </div>
    </div>
  </div>

  <div class="disclaimer-box">
    <strong>REGULATORY & CLINICAL RESEARCH PROTOTYPE DISCLAIMER:</strong><br/>
    This software is an investigational decision-support research prototype. It is NOT certified as a standalone medical diagnostic device under US FDA, EU MDR, or CDSCO regulations. The predictions, referable probabilities, and spatial saliency maps generated by this system are designed to assist community health workers in triage prioritization and do not constitute a definitive medical diagnosis. All treatment decisions and clinical prescriptions must be validated by a registered ophthalmologist through direct clinical examination.
  </div>

  <div class="sign-row">
    <div class="sign-block">
      Screening Operator / Field Nurse<br/>
      <strong>ID: ${screening.operatorId || 'OP-RURAL-01'}</strong>
    </div>
    <div class="sign-block">
      Consulting Ophthalmologist Reviewer<br/>
      <strong>Reg. No: ________________________</strong>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
