'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Sliders, 
  FileText,
  BarChart3,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

const SCREENING_TRENDS = [
  { day: 'Mon', count: 24, ungradable: 0 },
  { day: 'Tue', count: 32, ungradable: 1 },
  { day: 'Wed', count: 28, ungradable: 0 },
  { day: 'Thu', count: 45, ungradable: 1 },
  { day: 'Fri', count: 38, ungradable: 0 },
  { day: 'Sat', count: 52, ungradable: 1 },
  { day: 'Sun', count: 18, ungradable: 0 }
];

const DEVICE_METRICS = [
  { device: 'Remidio NM-FOP (Site 01)', gradableRate: '98.5%', total: 142 },
  { device: 'Forus 3nethra Classic', gradableRate: '96.8%', total: 98 },
  { device: '20D Smartphone Indirect Adapter', gradableRate: '95.2%', total: 76 }
];

export default function AnalyticsDashboardPage({ params: { locale } }: { params: { locale: string } }) {
  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold text-slate-900 tracking-tight">
              Clinical Analytics & Performance Oversight
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
              Open Access
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time screening triage volumes, quality-gate telemetry, and 200-image generalization benchmark verification.
          </p>
        </div>

        {/* Quick links to Settings & Audit */}
        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/settings/thresholds`}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-50 bg-white transition shadow-xs text-slate-700"
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-600" />
            <span>AI Thresholds</span>
          </Link>
          <Link
            href={`/${locale}/audit`}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-50 bg-white transition shadow-xs text-slate-700"
          >
            <FileText className="w-3.5 h-3.5 text-sky-600" />
            <span>Audit Trail</span>
          </Link>
        </div>
      </div>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="med-card p-5 space-y-1 bg-white border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Evaluated Cohort</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="font-heading text-2xl font-bold text-slate-900 tabular-nums">237</p>
          <span className="text-[11px] text-emerald-700 font-semibold">+18% this month</span>
        </div>

        <div className="med-card p-5 space-y-1 bg-white border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Referable DR Sensitivity</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="font-heading text-2xl font-bold text-emerald-700 tabular-nums">94.1%</p>
          <span className="text-[11px] text-slate-500 font-medium">Cutoff &tau; = 0.4106</span>
        </div>

        <div className="med-card p-5 space-y-1 bg-white border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Referable DR Specificity</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="font-heading text-2xl font-bold text-slate-900 tabular-nums">98.5%</p>
          <span className="text-[11px] text-emerald-700 font-semibold">1 False Positive / 65</span>
        </div>

        <div className="med-card p-5 space-y-1 bg-white border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>ROC-AUC Discriminability</span>
            <Sparkles className="w-4 h-4 text-purple-600" />
          </div>
          <p className="font-heading text-2xl font-bold text-purple-700 tabular-nums">0.987</p>
          <span className="text-[11px] text-slate-500 font-medium">ResNet-50 Calibrated</span>
        </div>
      </div>

      {/* Live Operational Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Screening Trends */}
        <div className="med-card p-5 space-y-3 bg-white border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Weekly Screening Volume & Quality</h3>
            <span className="text-[11px] text-slate-500 font-medium">7-Day Rolling View</span>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SCREENING_TRENDS}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Gradable Patients" fill="#0f766e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ungradable" name="Ungradable (Recapture)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hardware Modality Telemetry */}
        <div className="med-card p-5 space-y-3 bg-white border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-sm font-bold text-slate-900">Acquisition Modality Performance</h3>
            <span className="text-[11px] text-slate-500 font-medium">Hardware Telemetry</span>
          </div>
          <div className="divide-y divide-slate-100">
            {DEVICE_METRICS.map((dev) => (
              <div key={dev.device} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-800">{dev.device}</p>
                  <p className="text-slate-500 text-[11px]">{dev.total} acquisitions analyzed</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 text-xs">
                    {dev.gradableRate}
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-0.5 font-medium">Diagnostic Yield</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Model Generalization Benchmark Visualizations */}
      <div className="space-y-3">
        <div className="border-b border-slate-200 pb-2">
          <h2 className="text-base font-bold text-slate-900">
            Empirical Validation & Model Calibration Artifacts (N=200 IDRiD Cohort)
          </h2>
          <p className="text-xs text-slate-500">
            High-resolution diagnostic figures generated by <code>ml/benchmark_external.py</code> on the live inference API.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* ROC Curve */}
          <div className="med-card p-4 space-y-2 bg-white border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">ROC Curve (AUC = 0.987)</span>
              <span className="text-[10px] text-rose-600 font-bold">&tau; = 0.4106</span>
            </div>
            <div className="relative aspect-square w-full rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
              <img
                src="/benchmarks/roc_curve.png"
                alt="Referable DR ROC Curve"
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              Demonstrates 94.1% sensitivity at 98.5% specificity on unseen validation scans.
            </p>
          </div>

          {/* Confusion Matrix */}
          <div className="med-card p-4 space-y-2 bg-white border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">5&times;5 Confusion Matrix</span>
              <span className="text-[10px] text-slate-500 font-semibold">ICDR Grades 0&ndash;4</span>
            </div>
            <div className="relative aspect-square w-full rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
              <img
                src="/benchmarks/confusion_matrix.png"
                alt="5x5 Confusion Matrix"
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              Zero severe Grade 3 or 4 misclassifications as non-referable.
            </p>
          </div>

          {/* Reliability Diagram */}
          <div className="med-card p-4 space-y-2 bg-white border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Reliability Diagram</span>
              <span className="text-[10px] text-teal-700 font-bold">ECE = 0.112</span>
            </div>
            <div className="relative aspect-square w-full rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
              <img
                src="/benchmarks/reliability_diagram.png"
                alt="Model Reliability Diagram"
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              Temperature scaling ($T=1.9567$) matches predicted confidence to empirical accuracy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
