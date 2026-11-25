import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { EyeResultCard } from '@/components/result/EyeResultCard';
import { EyeData } from '@/lib/api/schema';

describe('EyeResultCard States', () => {
  it('renders referable DR state with warning badge and referral message', () => {
    const referableData: EyeData = {
      side: 'L',
      recaptureAttempts: 1,
      prediction: {
        referralState: 'referable',
        referableProb: 0.85,
        confidence: 0.9,
        predictedClass: 'Moderate DR',
        classProbabilities: { 'Moderate DR': 0.85, 'No DR': 0.15 },
        modelVersion: 'v2.1',
        preprocessingVersion: 'clahe-v2',
        calibrationVersion: 'platt',
        timestamp: new Date().toISOString()
      }
    };

    render(<EyeResultCard eyeData={referableData} eyeLabel="Left Eye" />);
    expect(screen.getByText(/Referable DR/i)).toBeDefined();
    expect(screen.getByText(/Referral to Ophthalmologist Recommended/i)).toBeDefined();
    expect(screen.getByText(/Model attention. Not a clinical finding./i)).toBeDefined();
  });

  it('renders non-referable state with green badge and routine care advice', () => {
    const nonReferableData: EyeData = {
      side: 'R',
      recaptureAttempts: 1,
      prediction: {
        referralState: 'non_referable',
        referableProb: 0.12,
        confidence: 0.94,
        predictedClass: 'No DR',
        classProbabilities: { 'No DR': 0.88, 'Mild DR': 0.12 },
        modelVersion: 'v2.1',
        preprocessingVersion: 'clahe-v2',
        calibrationVersion: 'platt',
        timestamp: new Date().toISOString()
      }
    };

    render(<EyeResultCard eyeData={nonReferableData} eyeLabel="Right Eye" />);
    expect(screen.getByText(/Non-Referable/i)).toBeDefined();
    expect(screen.getByText(/No Referable DR Detected/i)).toBeDefined();
  });

  it('renders ungradable state when marked unable to capture', () => {
    const ungradableData: EyeData = {
      side: 'L',
      recaptureAttempts: 3,
      unableToCapture: true
    };

    render(<EyeResultCard eyeData={ungradableData} eyeLabel="Left Eye" />);
    expect(screen.getByText(/Ungradable/i)).toBeDefined();
    expect(screen.getByText(/Marked as unable to capture/i)).toBeDefined();
  });
});

