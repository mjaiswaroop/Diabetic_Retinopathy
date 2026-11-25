'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole, setStoredUser, getDefaultRouteForRole } from '@/lib/auth/session';
import { Shield, UserCheck, Stethoscope, Settings } from 'lucide-react';

export default function LoginPage({ params: { locale } }: { params: { locale: string } }) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<UserRole>('operator');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = {
      id: `usr-${Date.now()}`,
      name: selectedRole === 'operator' ? 'Sister Sunita (Nurse / Operator)' : selectedRole === 'clinician' ? 'Dr. Sharma (Ophthalmologist)' : 'System Admin',
      role: selectedRole,
      siteId: 'site-rural-01',
      siteName: 'PHC Mandya, Karnataka'
    };
    setStoredUser(user);
    const targetUrl = getDefaultRouteForRole(selectedRole, locale);
    router.push(targetUrl);
  };

  return (
    <div className="max-w-md mx-auto pt-8 sm:pt-14 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center mx-auto">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Sign in to DR Screening</h1>
        <p className="text-sm text-slate-600">
          Select your assigned role to access the authorized workflow.
        </p>
      </div>

      <form onSubmit={handleLogin} className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
            Select Role
          </label>

          <div className="grid grid-cols-1 gap-2.5">
            <button
              type="button"
              onClick={() => setSelectedRole('operator')}
              className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition ${
                selectedRole === 'operator'
                  ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-200'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <UserCheck className="w-5 h-5 text-[#059669]" />
              <div>
                <p className="font-bold text-sm">Nurse / Screening Operator</p>
                <p className="text-xs text-slate-500">Verify patients, duplicate check, bilateral OD/OS capture, review queue</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('clinician')}
              className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition ${
                selectedRole === 'clinician'
                  ? 'border-teal-600 bg-teal-50/70 text-teal-900 ring-2 ring-teal-200'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <Stethoscope className="w-5 h-5 text-teal-700" />
              <div>
                <p className="font-bold text-sm">Ophthalmologist / Clinician</p>
                <p className="text-xs text-slate-500">Review queue, side-by-side XAI overlays, clinical decisions</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('admin')}
              className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition ${
                selectedRole === 'admin'
                  ? 'border-teal-600 bg-teal-50/70 text-teal-900 ring-2 ring-teal-200'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <Settings className="w-5 h-5 text-teal-700" />
              <div>
                <p className="font-bold text-sm">Administrator / Lead</p>
                <p className="text-xs text-slate-500">Site metrics, model thresholds, device assignments & audit logs</p>
              </div>
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm shadow transition active:scale-[0.99] min-h-[48px]"
        >
          Proceed to Workspace
        </button>
      </form>
    </div>
  );
}

