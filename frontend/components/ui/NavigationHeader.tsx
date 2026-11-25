'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { SyncStatusChip } from '@/components/ui/SyncStatusChip';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { Locale } from '@/lib/i18n';
import { 
  Eye, 
  LogOut, 
  Settings, 
  PlusCircle, 
  ListChecks, 
  LayoutDashboard, 
  ShieldAlert,
  Users,
  ClipboardList,
  Lock,
  Menu,
  X
} from 'lucide-react';
import { getStoredUser, setStoredUser, AuthUser } from '@/lib/auth/session';
import { initDatabase } from '@/lib/offline/db';

export function NavigationHeader({ locale }: { locale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    initDatabase();
    setUser(getStoredUser());
  }, [pathname]);

  const handleLogout = () => {
    setStoredUser(null);
    router.push(`/${locale}/login`);
  };

  const isLoginPage = pathname.includes('/login');
  const currentRole = user?.role || 'operator';

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs print:hidden transition-all duration-300">
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
        {/* Logo / Brand */}
        <Link href={`/${locale}/screenings/new`} className="flex items-center gap-3 group shrink-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <Eye className="w-5 h-5 group-hover:scale-105 transition" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-bold text-base sm:text-lg text-slate-900 tracking-tight leading-tight block">
                Retina<span className="text-emerald-600">Scan</span> Pro
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-300">
                Research Tool
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase block">
              Clinical DR Screening Platform
            </span>
          </div>
        </Link>

        {/* Center Nav Links (Strictly filtered by role) */}
        {!isLoginPage && (
          <nav className="hidden md:flex items-center gap-1 text-xs font-semibold bg-slate-100 p-1 rounded-xl border border-slate-200">
            {/* --- NURSE / OPERATOR TABS --- */}
            {(currentRole === 'operator' || currentRole === 'admin') && (
              <>
                <Link
                  href={`/${locale}/operator`}
                  className={`px-3 py-1.5 transition-all flex items-center gap-1.5 rounded-lg ${
                    pathname.includes('/operator')
                      ? 'bg-white text-emerald-700 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Nurse Hub</span>
                </Link>

                <Link
                  href={`/${locale}/verify`}
                  className={`px-3 py-1.5 transition-all flex items-center gap-1.5 rounded-lg ${
                    pathname.includes('/verify')
                      ? 'bg-white text-emerald-700 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verify Patient</span>
                </Link>

                <Link
                  href={`/${locale}/screenings/new`}
                  className={`px-3 py-1.5 transition-all flex items-center gap-1.5 rounded-lg ${
                    pathname.includes('/screenings')
                      ? 'bg-white text-emerald-700 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>New Screening</span>
                </Link>
              </>
            )}

            {/* --- DOCTOR / CLINICIAN TABS --- */}
            {(currentRole === 'clinician' || currentRole === 'admin') && (
              <>
                <Link
                  href={`/${locale}/review`}
                  className={`px-3 py-1.5 transition-all flex items-center gap-1.5 rounded-lg ${
                    pathname.includes('/review')
                      ? 'bg-white text-sky-700 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <ListChecks className="w-3.5 h-3.5 text-sky-600" />
                  <span>Doctor Queue</span>
                </Link>

                <Link
                  href={`/${locale}/operator`}
                  className={`px-3 py-1.5 transition-all flex items-center gap-1.5 rounded-lg ${
                    pathname.includes('/operator')
                      ? 'bg-white text-sky-700 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-sky-600" />
                  <span>Patient Registry</span>
                </Link>

                <Link
                  href={`/${locale}/followup`}
                  className={`px-3 py-1.5 transition-all flex items-center gap-1.5 rounded-lg ${
                    pathname.includes('/followup')
                      ? 'bg-white text-sky-700 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5 text-sky-600" />
                  <span>Follow-Up Loop</span>
                </Link>
              </>
            )}

            {/* --- GLOBAL TABS: ACCESSIBLE TO EVERYONE --- */}
            <Link
              href={`/${locale}/dashboard`}
              className={`px-3 py-1.5 transition-all flex items-center gap-1.5 rounded-lg ${
                pathname.includes('/dashboard')
                  ? 'bg-white text-purple-700 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-purple-600" />
              <span>Analytics</span>
            </Link>

            {/* --- ADMIN ONLY TABS --- */}
            {currentRole === 'admin' && (
              <>
                <Link
                  href={`/${locale}/admin/users`}
                  className={`px-3 py-1.5 transition-all flex items-center gap-1.5 rounded-lg ${
                    pathname.includes('/admin/users')
                      ? 'bg-white text-purple-700 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5 text-purple-600" />
                  <span>Admin Portal</span>
                </Link>

                <Link
                  href={`/${locale}/compliance`}
                  className={`px-3 py-1.5 transition-all flex items-center gap-1.5 rounded-lg ${
                    pathname.includes('/compliance')
                      ? 'bg-white text-purple-700 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5 text-purple-600" />
                  <span>Compliance</span>
                </Link>
              </>
            )}
          </nav>
        )}

        {/* Right side controls: Role Chip, Sync, User Badge & Logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          <SyncStatusChip />

          {!isLoginPage && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              {/* Quick Role Switcher for Testing */}
              <select
                value={currentRole}
                onChange={(e) => {
                  const newRole = e.target.value as any;
                  const updated = {
                    id: user?.id || `usr-${Date.now()}`,
                    name: newRole === 'operator' ? 'Sister Sunita (Nurse)' : newRole === 'clinician' ? 'Dr. Sharma (Doctor)' : 'Super Admin',
                    role: newRole,
                    siteId: user?.siteId || 'site-01',
                    siteName: user?.siteName || 'PHC Center'
                  };
                  setStoredUser(updated);
                  setUser(updated);
                }}
                className="text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 cursor-pointer focus:ring-1 focus:ring-emerald-500"
                title="Switch active role view"
              >
                <option value="operator">🩺 Nurse View</option>
                <option value="clinician">🔬 Doctor View</option>
                <option value="admin">⚙️ Admin View</option>
              </select>

              {/* Logout Button */}
              <button
                type="button"
                onClick={handleLogout}
                title="Log Out"
                aria-label="Log Out"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition active:scale-95 min-h-[36px]"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log out</span>
              </button>

              {/* Mobile Menu Toggle */}
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200"
                aria-label="Toggle navigation menu"
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {menuOpen && !isLoginPage && (
        <div className="md:hidden border-t border-slate-200 bg-white p-3 space-y-1.5">
          <Link
            href={`/${locale}/screenings/new`}
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 p-2.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <PlusCircle className="w-4 h-4 text-teal-700" />
            <span>New Patient Screening (Operator)</span>
          </Link>

          <Link
            href={`/${locale}/review`}
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 p-2.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ListChecks className="w-4 h-4 text-teal-700" />
            <span>Review Queue (Clinician)</span>
          </Link>

          <Link
            href={`/${locale}/dashboard`}
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 p-2.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <LayoutDashboard className="w-4 h-4 text-teal-700" />
            <span>Analytics Dashboard (Admin)</span>
          </Link>

          <Link
            href={`/${locale}/settings/thresholds`}
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 p-2.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Settings className="w-4 h-4 text-teal-700" />
            <span>AI Thresholds</span>
          </Link>

          <Link
            href={`/${locale}/audit`}
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 p-2.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ShieldAlert className="w-4 h-4 text-teal-700" />
            <span>Audit Trail</span>
          </Link>
        </div>
      )}
    </header>
  );
}

