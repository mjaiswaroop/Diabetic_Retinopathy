'use client';

import React from 'react';
import { Check } from 'lucide-react';

export type StepperStep = 'register' | 'leftEye' | 'rightEye' | 'analysis' | 'result';

interface ProgressStepperProps {
  currentStep: StepperStep;
  labels: Record<StepperStep, string>;
}

const STEPS: StepperStep[] = ['register', 'leftEye', 'rightEye', 'analysis', 'result'];

export function ProgressStepper({ currentStep, labels }: ProgressStepperProps) {
  const currentIndex = STEPS.indexOf(currentStep);

  return (
    <nav aria-label="Screening Progress" className="w-full py-2.5 px-4 bg-white/95 rounded-xl border border-slate-200/90 shadow-xs">
      <ol className="flex items-center justify-between max-w-lg mx-auto">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <li key={step} className="flex-1 flex flex-col items-center relative">
              {idx !== 0 && (
                <div
                  className={`absolute top-3 right-1/2 w-full h-[2px] -z-0 transition-all duration-200 ${
                    idx <= currentIndex ? 'bg-[#059669]' : 'bg-slate-200'
                  }`}
                  aria-hidden="true"
                />
              )}

              <div
                className={`relative z-10 flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold transition-all duration-200 ${
                  isCompleted
                    ? 'bg-[#059669] text-white shadow-xs'
                    : isCurrent
                    ? 'border-2 border-[#059669] bg-white text-[#059669] ring-2 ring-emerald-100 shadow-xs'
                    : 'border border-slate-200 bg-slate-50 text-slate-400'
                }`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : idx + 1}
              </div>

              <span
                className={`mt-1 text-[11px] text-center font-medium tracking-tight truncate max-w-[80px] transition-colors duration-200 ${
                  isCurrent ? 'text-[#059669] font-bold' : isCompleted ? 'text-slate-800 font-semibold' : 'text-slate-400'
                }`}
              >
                {labels[step] || step}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

