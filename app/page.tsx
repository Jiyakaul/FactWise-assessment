"use client";

import { useState } from "react";
import { FacilityProvider, useFacility } from "@/lib/data";
import NurseView from "@/components/nurse-view";
import DoctorView from "@/components/doctor-view";
import AdminView from "@/components/admin-view";
import AnalyticsView from "@/components/analytics-view";
import {
  Thermometer,
  Stethoscope,
  Building,
  Activity,
  RefreshCw,
  X,
  Shield,
  Clock,
} from "lucide-react";

type Role = "nurse" | "doctor" | "admin" | "analytics";

function ToastContainer() {
  const { toasts, removeToast } = useFacility();

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-enter flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
            toast.type === "success"
              ? "bg-emerald-900/90 border-emerald-700 text-emerald-100"
              : toast.type === "warning"
              ? "bg-amber-900/90 border-amber-700 text-amber-100"
              : "bg-red-900/90 border-red-700 text-red-100"
          }`}
        >
          <span className="text-sm flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="p-1 hover:bg-white/10 rounded"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

function AppContent() {
  const [activeRole, setActiveRole] = useState<Role>("nurse");
  const { getStats, resetDailyStatus } = useFacility();
  const stats = getStats();

  const roles: { key: Role; label: string; icon: React.ReactNode }[] = [
    { key: "nurse", label: "Nurse View", icon: <Thermometer size={16} /> },
    { key: "doctor", label: "Doctor View", icon: <Stethoscope size={16} /> },
    { key: "admin", label: "Admin / Beds", icon: <Building size={16} /> },
    {
      key: "analytics",
      label: "Head Doctor",
      icon: <Activity size={16} />,
    },
  ];

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Top Header Bar */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4">
          {/* Title Row */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-600 p-2 rounded-lg">
                <Shield size={20} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">
                  BioCare Quarantine & Treatment Facility
                </h1>
                <p className="text-xs text-slate-400">
                  Virus Containment & Recovery Center
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Occupancy Badge */}
              <div
                className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                  stats.totalActive >= 74
                    ? "bg-red-900/60 text-red-300 border border-red-700"
                    : stats.totalActive >= 60
                    ? "bg-amber-900/60 text-amber-300 border border-amber-700"
                    : "bg-emerald-900/60 text-emerald-300 border border-emerald-700"
                }`}
              >
                Occupancy: {stats.totalActive} / 74 Beds
              </div>

              {/* Time */}
              <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                <Clock size={14} />
                {timeStr}
              </div>

              {/* Reset Button */}
              <button
                onClick={resetDailyStatus}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition-colors"
                title="Reset daily shift status for demonstration"
              >
                <RefreshCw size={14} />
                Reset Daily
              </button>
            </div>
          </div>

          {/* Role Switcher */}
          <div className="flex gap-1 pb-2">
            {roles.map((role) => (
              <button
                key={role.key}
                onClick={() => setActiveRole(role.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeRole === role.key
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                }`}
              >
                {role.icon}
                {role.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        {activeRole === "nurse" && <NurseView />}
        {activeRole === "doctor" && <DoctorView />}
        {activeRole === "admin" && <AdminView />}
        {activeRole === "analytics" && <AnalyticsView />}
      </main>

      {/* Toast Container */}
      <ToastContainer />
    </div>
  );
}

export default function Home() {
  return (
    <FacilityProvider>
      <AppContent />
    </FacilityProvider>
  );
}
