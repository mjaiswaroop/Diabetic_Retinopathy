'use client';

import React, { useState, useEffect } from 'react';
import { db, ThresholdConfig } from '@/lib/offline/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Save, ShieldAlert, Check } from 'lucide-react';

export default function ThresholdSettingsPage() {
  const [referableCutoff, setReferableCutoff] = useState(0.50);
  const [uncertaintyBand, setUncertaintyBand] = useState(0.65);
  const [qualityCutoff, setQualityCutoff] = useState(0.60);
  const [savedMessage, setSavedMessage] = useState(false);

  const stored = useLiveQuery(async () => {
    return await db.thresholds.get('default');
  }, []);

  useEffect(() => {
    if (stored) {
      setReferableCutoff(stored.referableThreshold);
      setUncertaintyBand(stored.uncertaintyThreshold);
      setQualityCutoff(stored.qualityCutoff);
    }
  }, [stored]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated: ThresholdConfig = {
      id: 'default',
      referableThreshold: referableCutoff,
      uncertaintyThreshold: uncertaintyBand,
      qualityCutoff: qualityCutoff,
      dmeSensitivityCutoff: 0.50,
      autoEmergencyAlerts: true,
      modelVersion: 'v2.1.0-resnet50',
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin-lead'
    };

    await db.thresholds.put(updated);

    // Audit event for clinical safety tracking
    await db.auditEvents.put({
      id: `audit-${Date.now()}`,
      actorId: 'admin-lead',
      role: 'admin',
      siteId: 'global',
      action: 'UPDATE_AI_THRESHOLDS',
      objectType: 'ThresholdConfig',
      objectId: 'default',
      timestamp: new Date().toISOString(),
      metadata: { referableCutoff, uncertaintyBand, qualityCutoff }
    });

    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900 tracking-tight">AI Referral & Quality Thresholds</h1>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          Configures referral cutoffs, uncertainty sensitivity, and image quality bounds.
        </p>
      </div>

      {/* Safety Warning */}
      <div className="p-5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-heading font-bold text-sm">Clinical Protocol Warning</p>
          <p className="text-amber-900 leading-relaxed font-medium">
            Modifying these thresholds directly impacts clinical sensitivity, specificity, and patient referral rates across all field sites. Changes are permanently logged in the audit trail.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="med-card p-6 sm:p-8 space-y-6">
        {/* Referable Probability Cutoff */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <label className="font-bold text-slate-800">
              Referable DR Probability Cutoff
            </label>
            <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              {referableCutoff.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0.2"
            max="0.8"
            step="0.01"
            value={referableCutoff}
            onChange={(e) => setReferableCutoff(parseFloat(e.target.value))}
            className="w-full accent-teal-600 h-2 bg-slate-200 rounded cursor-pointer"
          />
          <p className="text-[11px] text-slate-500">
            Cases with calibrated referable probability &ge; this value trigger specialist referral.
          </p>
        </div>

        {/* Model Uncertainty Threshold */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <label className="font-bold text-slate-800">
              Uncertainty Decision Band Threshold
            </label>
            <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              {uncertaintyBand.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0.4"
            max="0.8"
            step="0.01"
            value={uncertaintyBand}
            onChange={(e) => setUncertaintyBand(parseFloat(e.target.value))}
            className="w-full accent-teal-600 h-2 bg-slate-200 rounded cursor-pointer"
          />
          <p className="text-[11px] text-slate-500">
            When maximum class probability is below this threshold, result is flagged as &apos;Uncertain&apos;.
          </p>
        </div>

        {/* Quality Cutoff */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <label className="font-bold text-slate-800">
              Minimum Image Quality Score (IQA)
            </label>
            <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              {qualityCutoff.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0.4"
            max="0.8"
            step="0.01"
            value={qualityCutoff}
            onChange={(e) => setQualityCutoff(parseFloat(e.target.value))}
            className="w-full accent-teal-600 h-2 bg-slate-200 rounded cursor-pointer"
          />
          <p className="text-[11px] text-slate-500">
            Images with clarity scores below this value are deemed ungradable, prompting recapture.
          </p>
        </div>

        {/* Save button */}
        <div className="pt-2">
          <button
            type="submit"
            className="w-full py-3.5 px-4 bg-[#059669] hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow flex items-center justify-center gap-2 transition duration-300 active:scale-[0.99] min-h-[48px]"
          >
            {savedMessage ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{savedMessage ? 'Changes Saved & Logged' : 'Save Threshold Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

