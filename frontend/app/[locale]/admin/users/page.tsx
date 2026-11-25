'use client';

import React, { useState } from 'react';
import { db } from '@/lib/offline/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { UserAccount } from '@/lib/api/schema';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Building2, 
  Phone, 
  Mail, 
  Ban, 
  CheckCircle, 
  Sliders, 
  Cpu, 
  BellRing,
  AlertTriangle
} from 'lucide-react';

export default function AdminPortalPage({ params: { locale } }: { params: { locale: string } }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState<'nurse' | 'doctor' | 'admin'>('nurse');
  const [newClinic, setNewClinic] = useState('PHC Mandya, Rural Karnataka');
  const [newPhone, setNewPhone] = useState('+91 ');
  const [newEmail, setNewEmail] = useState('');

  // AI Model Configuration
  const [modelVersion, setModelVersion] = useState('v2.1.0-resnet50');
  const [referableThreshold, setReferableThreshold] = useState(0.41);
  const [dmeSensitivity, setDmeSensitivity] = useState(0.50);
  const [emergencyAlertsEnabled, setEmergencyAlertsEnabled] = useState(true);

  const users = useLiveQuery(async () => {
    return await db.users.toArray();
  }) || [];

  const handleToggleSuspend = async (user: UserAccount) => {
    const updatedStatus = user.status === 'active' ? 'suspended' : 'active';
    await db.users.update(user.id, { status: updatedStatus });
    await db.auditEvents.put({
      id: `audit-${Date.now()}`,
      actorId: 'superadmin',
      role: 'admin',
      siteId: user.assignedClinic,
      action: updatedStatus === 'suspended' ? 'SUSPEND_USER' : 'ACTIVATE_USER',
      objectType: 'UserAccount',
      objectId: user.id,
      timestamp: new Date().toISOString()
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newUsername.trim()) return;

    const newUser: UserAccount = {
      id: `usr-${Date.now()}`,
      username: newUsername.trim(),
      fullName: newFullName.trim(),
      role: newRole,
      assignedClinic: newClinic,
      status: 'active',
      phone: newPhone.trim(),
      email: newEmail.trim(),
      createdAt: new Date().toISOString()
    };

    await db.users.put(newUser);
    setShowAddModal(false);
    setNewFullName('');
    setNewUsername('');
    setNewEmail('');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200 uppercase tracking-wider">
              System Administration
            </span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-slate-900 tracking-tight">
            Super Admin & Clinical Governance Portal
          </h1>
          <p className="text-xs text-slate-500">
            Account provisioning, multi-clinic site assignments, user suspensions, and AI inference calibration.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#059669] hover:bg-emerald-700 text-white text-xs font-bold shadow transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>Provision New Account</span>
        </button>
      </div>

      {/* AI Model Governance & Escalation Triggers Card */}
      <div className="med-card p-6 space-y-4 border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#059669]" />
            <h2 className="font-heading text-base font-bold text-slate-900">
              AI Backbone & Threshold Governance
            </h2>
          </div>
          <span className="text-xs font-mono font-bold bg-emerald-50 text-[#059669] px-2.5 py-1 rounded-lg border border-emerald-200">
            Active: {modelVersion}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          {/* Referable Threshold */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-700">DR Sensitivity Cutoff (&ge; Gr 2)</span>
              <strong className="text-slate-900 font-mono text-sm">{Math.round(referableThreshold * 100)}%</strong>
            </div>
            <input
              type="range"
              min="0.30"
              max="0.60"
              step="0.01"
              value={referableThreshold}
              onChange={(e) => setReferableThreshold(parseFloat(e.target.value))}
              className="w-full accent-emerald-600"
            />
            <span className="text-[10px] text-slate-500 block">IDRiD calibrated optimal: 41%</span>
          </div>

          {/* DME Sensitivity */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-700">DME Detection Cutoff</span>
              <strong className="text-slate-900 font-mono text-sm">{Math.round(dmeSensitivity * 100)}%</strong>
            </div>
            <input
              type="range"
              min="0.30"
              max="0.70"
              step="0.05"
              value={dmeSensitivity}
              onChange={(e) => setDmeSensitivity(parseFloat(e.target.value))}
              className="w-full accent-sky-600"
            />
            <span className="text-[10px] text-slate-500 block">Foveal zone exudate tolerance</span>
          </div>

          {/* Emergency Escalations */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-700">Automated SMS/Push Protocol</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                emergencyAlertsEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
              }`}>
                {emergencyAlertsEnabled ? 'ACTIVE' : 'MUTED'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setEmergencyAlertsEnabled(!emergencyAlertsEnabled)}
              className="w-full mt-1 py-1.5 px-3 rounded-xl border border-slate-300 bg-white font-semibold text-xs text-slate-700 hover:bg-slate-50"
            >
              {emergencyAlertsEnabled ? 'Disable Automated SMS' : 'Enable Emergency PDR SMS'}
            </button>
            <span className="text-[10px] text-slate-500 block">Instant doctor alerts for PDR & center DME</span>
          </div>
        </div>
      </div>

      {/* User Management Table */}
      <div className="med-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-700" />
            <h2 className="font-heading text-base font-bold text-slate-900">
              Staff & Clinician Accounts ({users.length})
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Full Name / Username</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Assigned Clinic Location</th>
                <th className="py-2.5 px-3">Contact Details</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-900 block">{u.fullName}</span>
                    <span className="font-mono text-[10px] text-slate-400">@{u.username}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      u.role === 'doctor'
                        ? 'bg-sky-50 text-[#0284c7] border border-sky-200'
                        : u.role === 'nurse'
                        ? 'bg-emerald-50 text-[#059669] border border-emerald-200'
                        : 'bg-purple-50 text-purple-700 border border-purple-200'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-700 flex items-center gap-1.5 mt-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{u.assignedClinic}</span>
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    <div className="space-y-0.5">
                      <span className="block">{u.phone}</span>
                      <span className="text-[10px] text-slate-400 block">{u.email}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      u.status === 'active'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}>
                      {u.status === 'active' ? (
                        <>
                          <CheckCircle className="w-3 h-3 text-emerald-600" /> Active
                        </>
                      ) : (
                        <>
                          <Ban className="w-3 h-3 text-rose-600" /> Suspended
                        </>
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleToggleSuspend(u)}
                      className={`px-3 py-1 rounded-xl font-semibold text-xs transition ${
                        u.status === 'active'
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {u.status === 'active' ? 'Suspend' : 'Reinstate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="med-card max-w-md w-full p-6 space-y-4 bg-white shadow-2xl">
            <h3 className="font-heading text-lg font-bold text-slate-900">Provision User Account</h3>
            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Rajesh Rao"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Login Username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. rajesh.rao"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
                  >
                    <option value="nurse">Nurse / Operator</option>
                    <option value="doctor">Doctor / Ophthalmologist</option>
                    <option value="admin">System Admin</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Clinic Center</label>
                  <select
                    value={newClinic}
                    onChange={(e) => setNewClinic(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
                  >
                    <option value="PHC Mandya, Rural Karnataka">PHC Mandya</option>
                    <option value="CHC Maddur, Karnataka">CHC Maddur</option>
                    <option value="Minto Ophthalmic Hospital">Minto Hospital</option>
                    <option value="District Tele-Ophthal Grid">District Grid</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Mobile (for Emergency Escalations)</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#059669] hover:bg-emerald-700 text-white font-bold"
                >
                  Save & Authorize
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

