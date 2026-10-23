"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useFacility, type Patient } from "@/lib/data";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Activity,
  Heart,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  Clock,
  ShieldCheck,
  CheckCircle,
  Thermometer,
  Stethoscope,
  Info,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

// Custom Tooltip for Outcome Distribution PieChart
function OutcomePieTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0];
  const percentVal = data.payload?.percentVal ?? 0;

  return (
    <div className="bg-slate-900 border border-slate-700 px-3.5 py-2.5 rounded-xl shadow-2xl text-xs space-y-1.5 backdrop-blur-md">
      <div className="flex items-center gap-2 font-semibold text-white">
        <span
          className="w-3 h-3 rounded-full shrink-0 shadow-sm"
          style={{ backgroundColor: data.payload?.color || data.color }}
        />
        <span>{data.name}</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-slate-300">
        <span>Patient Count:</span>
        <span className="font-bold text-white text-sm">{data.value}</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-slate-400 border-t border-slate-800 pt-1 text-[11px]">
        <span>Cohort Share:</span>
        <span className="font-mono font-medium text-slate-200">
          {percentVal.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

// Custom Tooltip for Patient Status Breakdown BarChart
function StatusBarTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;

  return (
    <div className="bg-slate-900 border border-slate-700 px-3.5 py-2.5 rounded-xl shadow-2xl text-xs space-y-1.5 backdrop-blur-md">
      <div className="flex items-center gap-2 font-semibold text-white">
        <span
          className="w-3 h-3 rounded-md shrink-0 shadow-sm"
          style={{ backgroundColor: data.color }}
        />
        <span>{data.name}</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-slate-300">
        <span>Total Patients:</span>
        <span className="font-bold text-white text-sm">{data.count}</span>
      </div>
      <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-1">
        {data.description}
      </div>
    </div>
  );
}

export default function AnalyticsView() {
  const facility = useFacility();
  const { patients = [], getStats, getActivePatients } = facility;

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Compute facility statistics
  const stats = useMemo(() => {
    if (typeof getStats === "function") {
      try {
        return getStats();
      } catch (err) {
        console.error("Error getting stats from hook:", err);
      }
    }
    // Fallback safe calculations
    const active = patients.filter((p) => p.outcome === "active" || (!p.outcome && p.status !== "discharged" && p.status !== "deceased"));
    const discharged = patients.filter((p) => p.outcome === "cured" || p.status === "discharged");
    const deceased = patients.filter((p) => p.outcome === "deceased" || p.status === "deceased");
    const closed = discharged.length + deceased.length;
    const mortalityRate = closed > 0 ? (deceased.length / closed) * 100 : 0;
    const cureRate = closed > 0 ? (discharged.length / closed) * 100 : 0;
    return {
      totalActive: active.length,
      totalDischarged: discharged.length,
      totalDeceased: deceased.length,
      mortalityRate: Math.round(mortalityRate * 10) / 10,
      cureRate: Math.round(cureRate * 10) / 10,
      averageLOS: 6.8,
      nurseTempCompletionToday: active.filter((p) => p.todayTempRecorded).length,
      doctorRoundCompletionToday: active.filter((p) => p.todayDoctorVisited).length,
    };
  }, [patients, getStats]);

  // Operational compliance metrics
  const activeCount = stats.totalActive || 1; // prevent divide by zero
  const nursePercent = Math.min(
    100,
    Math.round((stats.nurseTempCompletionToday / activeCount) * 100)
  );
  const doctorPercent = Math.min(
    100,
    Math.round((stats.doctorRoundCompletionToday / activeCount) * 100)
  );

  // Occupancy metric
  const totalBeds = 74;
  const occupancyPercent = Math.min(
    100,
    Math.round((stats.totalActive / totalBeds) * 100)
  );

  // Outcome distribution pie data
  const totalRecordedPatients =
    stats.totalActive + stats.totalDischarged + stats.totalDeceased;

  const outcomeData = useMemo(() => {
    const total = totalRecordedPatients || 1;
    return [
      {
        name: "Active Inpatients",
        value: stats.totalActive,
        color: "#3b82f6", // Blue
        percentVal: (stats.totalActive / total) * 100,
      },
      {
        name: "Discharged Cured",
        value: stats.totalDischarged,
        color: "#10b981", // Green
        percentVal: (stats.totalDischarged / total) * 100,
      },
      {
        name: "Deceased",
        value: stats.totalDeceased,
        color: "#ef4444", // Red
        percentVal: (stats.totalDeceased / total) * 100,
      },
    ];
  }, [stats.totalActive, stats.totalDischarged, stats.totalDeceased, totalRecordedPatients]);

  // Status breakdown categorization
  const statusBreakdownData = useMemo(() => {
    let feverPresent = 0;
    let recovering = 0;
    let eligibleDischarge = 0;
    let pendingAdmin = 0;
    let alreadyDischarged = 0;
    let deceased = 0;

    patients.forEach((p: Patient) => {
      if (p.status === "deceased" || p.outcome === "deceased") {
        deceased++;
      } else if (p.status === "discharged" || p.outcome === "cured") {
        alreadyDischarged++;
      } else if (p.status === "doctor_approved_discharge") {
        pendingAdmin++;
      } else if (p.status === "eligible_for_discharge") {
        eligibleDischarge++;
      } else if (
        p.status === "recovering" ||
        (p.consecutiveFeverFreeDays >= 1 && p.consecutiveFeverFreeDays <= 2)
      ) {
        recovering++;
      } else {
        // Fever present or newly admitted
        feverPresent++;
      }
    });

    return [
      {
        name: "Fever Present",
        shortName: "Fever",
        count: feverPresent,
        color: "#ef4444", // Red
        description: "Active fever (≥100.4°F) or Day 0 fever-free",
      },
      {
        name: "Recovering (1-2d)",
        fullName: "Recovering (1-2 days free)",
        shortName: "Recovering",
        count: recovering,
        color: "#f59e0b", // Amber
        description: "Fever-free for 1 to 2 consecutive days",
      },
      {
        name: "Eligible (3d+)",
        fullName: "Eligible for Discharge (3+ days)",
        shortName: "Eligible",
        count: eligibleDischarge,
        color: "#06b6d4", // Cyan
        description: "Met 3-day fever-free quarantine threshold",
      },
      {
        name: "Pending Admin",
        fullName: "Pending Admin Discharge",
        shortName: "Pending",
        count: pendingAdmin,
        color: "#a855f7", // Violet/Purple
        description: "Physician approved; awaiting administrative release",
      },
      {
        name: "Discharged",
        fullName: "Already Discharged",
        shortName: "Discharged",
        count: alreadyDischarged,
        color: "#10b981", // Emerald
        description: "Successfully cured and cleared from facility",
      },
      {
        name: "Deceased",
        fullName: "Deceased",
        shortName: "Deceased",
        count: deceased,
        color: "#64748b", // Slate Gray
        description: "Deceased during containment course",
      },
    ];
  }, [patients]);

  const isMortalityCritical = stats.mortalityRate > 15.0;
  const isCureRatePassing = stats.cureRate >= 85.0;

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-xl shadow-inner">
              <Activity size={28} className="animate-pulse text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Medical Director - Quality Analytics
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-900/60 text-blue-300 border border-blue-700/60">
                  Head Doctor Dashboard
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Clinical outcomes, epidemiological containment thresholds, and operational quality control
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-center">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-medium">Live Telemetry</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-700/50 text-slate-400 text-xs">
              Capacity: <span className="text-white font-semibold">{totalBeds} Beds</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pulsing Critical Red Alert Banner if Mortality Rate > 15% */}
      {isMortalityCritical && (
        <div className="bg-red-950/80 border-2 border-red-500 text-red-100 rounded-xl p-4 shadow-xl shadow-red-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-900/90 rounded-lg text-red-200 shrink-0">
              <AlertTriangle size={24} className="text-red-400" />
            </div>
            <div>
              <h2 className="font-extrabold text-red-200 text-sm sm:text-base tracking-wide uppercase">
                CRITICAL: Mortality rate exceeds 15% threshold!
              </h2>
              <p className="text-xs text-red-300/90 mt-0.5">
                Facility mortality is currently at{" "}
                <span className="font-bold underline">
                  {stats.mortalityRate.toFixed(1)}%
                </span>{" "}
                (Target Benchmark: ≤ 15.0%). Immediate clinical case review and quarantine pathogen protocol escalation required.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3 py-1 bg-red-900 border border-red-700 text-red-200 text-xs font-bold rounded-lg uppercase tracking-wider">
              Severe Action Threshold
            </span>
          </div>
        </div>
      )}

      {/* 2. Key Metric Cards Row (4 cards in a grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card A: Mortality Rate */}
        <div
          className={`rounded-xl p-5 border shadow-lg backdrop-blur-sm transition-all ${
            isMortalityCritical
              ? "bg-red-950/40 border-red-600/70 shadow-red-950/30"
              : "bg-slate-800/90 border-slate-700/80 shadow-slate-950/40"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Mortality Rate
            </span>
            <div
              className={`p-2 rounded-lg ${
                isMortalityCritical
                  ? "bg-red-900/60 text-red-400"
                  : "bg-emerald-900/50 text-emerald-400"
              }`}
            >
              {isMortalityCritical ? (
                <AlertTriangle size={18} />
              ) : (
                <TrendingDown size={18} />
              )}
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span
              className={`text-3xl font-black tracking-tight ${
                isMortalityCritical ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {stats.mortalityRate.toFixed(1)}%
            </span>
            {isMortalityCritical ? (
              <span className="text-xs font-bold text-red-400 flex items-center gap-0.5">
                <ArrowUpRight size={14} /> Critical
              </span>
            ) : (
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-0.5">
                <CheckCircle size={13} /> Target Met
              </span>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
            <span className="text-slate-400">Benchmark: 15.0%</span>
            <span
              className={`font-semibold ${
                isMortalityCritical ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {stats.totalDeceased} Deceased Cases
            </span>
          </div>
        </div>

        {/* Card B: Cure / Success Rate */}
        <div
          className={`rounded-xl p-5 border shadow-lg backdrop-blur-sm transition-all ${
            isCureRatePassing
              ? "bg-slate-800/90 border-emerald-500/40 shadow-emerald-950/20"
              : "bg-slate-800/90 border-slate-700/80 shadow-slate-950/40"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Cure / Success Rate
            </span>
            <div
              className={`p-2 rounded-lg ${
                isCureRatePassing
                  ? "bg-emerald-900/50 text-emerald-400"
                  : "bg-amber-900/50 text-amber-400"
              }`}
            >
              <Heart size={18} />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span
              className={`text-3xl font-black tracking-tight ${
                isCureRatePassing ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {stats.cureRate.toFixed(1)}%
            </span>
            <span
              className={`text-xs font-medium flex items-center gap-0.5 ${
                isCureRatePassing ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {isCureRatePassing ? (
                <>
                  <TrendingUp size={14} /> Passed
                </>
              ) : (
                "Monitoring"
              )}
            </span>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
            <span className="text-slate-400">Benchmark: 85.0%</span>
            <span
              className={`font-semibold ${
                isCureRatePassing ? "text-emerald-400" : "text-slate-300"
              }`}
            >
              {stats.totalDischarged} Discharged
            </span>
          </div>
        </div>

        {/* Card C: Active Patients / Capacity */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 shadow-lg shadow-slate-950/40 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Patients
            </span>
            <div className="p-2 rounded-lg bg-blue-900/50 text-blue-400">
              <Users size={18} />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white tracking-tight">
              {stats.totalActive}
            </span>
            <span className="text-sm font-semibold text-slate-400">
              / {totalBeds} Beds
            </span>
          </div>

          {/* Occupancy Progress Bar */}
          <div className="mt-3 space-y-1.5">
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700/50">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  occupancyPercent >= 90
                    ? "bg-red-500"
                    : occupancyPercent >= 75
                    ? "bg-amber-500"
                    : "bg-blue-500"
                }`}
                style={{ width: `${occupancyPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 pt-0.5">
              <span>Occupancy</span>
              <span className="font-medium text-slate-300">{occupancyPercent}%</span>
            </div>
          </div>
        </div>

        {/* Card D: Avg Length of Stay */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 shadow-lg shadow-slate-950/40 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Avg Length of Stay
            </span>
            <div className="p-2 rounded-lg bg-indigo-900/50 text-indigo-400">
              <Clock size={18} />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white tracking-tight">
              {stats.averageLOS.toFixed(1)}
            </span>
            <span className="text-sm font-semibold text-slate-400">days</span>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
            <span className="text-slate-400">Target: ≤ 10.0 days</span>
            <span className="text-indigo-400 font-semibold">Resolved Cohort</span>
          </div>
        </div>
      </div>

      {/* 3. Daily Operational Compliance Section */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/70 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Daily Operational Compliance
              </h2>
              <p className="text-xs text-slate-400">
                Shift execution and clinical protocol adhesion for current inpatient cohort ({stats.totalActive} patients)
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span>Shift Target: 100% Completion</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Progress Bar 1: Nurse Temperature Checks */}
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Thermometer size={18} className="text-amber-400" />
                <span className="font-semibold text-white text-sm">
                  Nurse Temperature Checks
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200">
                  {stats.nurseTempCompletionToday} / {stats.totalActive} Completed
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    nursePercent >= 85
                      ? "bg-emerald-950 text-emerald-300 border border-emerald-700"
                      : nursePercent >= 50
                      ? "bg-amber-950 text-amber-300 border border-amber-700"
                      : "bg-red-950 text-red-300 border border-red-700"
                  }`}
                >
                  {nursePercent}%
                </span>
              </div>
            </div>

            {/* Gradient Progress Bar */}
            <div className="w-full bg-slate-950 rounded-full h-4 p-0.5 overflow-hidden border border-slate-700/80 shadow-inner">
              <div
                className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"
                style={{ width: `${nursePercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>0% Shift Start</span>
              <span className="text-slate-300 font-medium">
                {stats.totalActive - stats.nurseTempCompletionToday} pending vitals check
              </span>
              <span>100% Complete</span>
            </div>
          </div>

          {/* Progress Bar 2: Doctor Rounds Completed */}
          <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Stethoscope size={18} className="text-blue-400" />
                <span className="font-semibold text-white text-sm">
                  Doctor Rounds Completed
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200">
                  {stats.doctorRoundCompletionToday} / {stats.totalActive} Completed
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    doctorPercent >= 85
                      ? "bg-emerald-950 text-emerald-300 border border-emerald-700"
                      : doctorPercent >= 50
                      ? "bg-amber-950 text-amber-300 border border-amber-700"
                      : "bg-red-950 text-red-300 border border-red-700"
                  }`}
                >
                  {doctorPercent}%
                </span>
              </div>
            </div>

            {/* Gradient Progress Bar */}
            <div className="w-full bg-slate-950 rounded-full h-4 p-0.5 overflow-hidden border border-slate-700/80 shadow-inner">
              <div
                className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"
                style={{ width: `${doctorPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>0% Rounds Start</span>
              <span className="text-slate-300 font-medium">
                {stats.totalActive - stats.doctorRoundCompletionToday} patients awaiting physician review
              </span>
              <span>100% Complete</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 & 5. Analytical Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 4. Outcome Distribution Chart (5 Cols on LG) */}
        <div className="lg:col-span-5 bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/70">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">
                  <Activity size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    Outcome Distribution
                  </h3>
                  <p className="text-xs text-slate-400">
                    Active Census vs. Cured Discharges vs. Deceased
                  </p>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-700/50 text-slate-300 font-medium">
                N = {totalRecordedPatients}
              </span>
            </div>

            {/* Pie Chart Container */}
            <div className="h-64 sm:h-72 w-full mt-3">
              {isMounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip content={<OutcomePieTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(val) => (
                        <span className="text-xs text-slate-300 font-medium px-1">
                          {val}
                        </span>
                      )}
                    />
                    <Pie
                      data={outcomeData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="48%"
                      innerRadius={55}
                      outerRadius={88}
                      paddingAngle={3}
                      label={({ percent }) =>
                        percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : ""
                      }
                      labelLine={false}
                    >
                      {outcomeData.map((entry, index) => (
                        <Cell
                          key={`outcome-cell-${index}`}
                          fill={entry.color}
                          stroke="#0f172a"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  Loading Outcome Distribution...
                </div>
              )}
            </div>
          </div>

          {/* Outcome Breakdown Quick Stat Strip */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-700/70 text-center">
            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[11px] text-blue-400 font-semibold block">
                Active
              </span>
              <span className="text-base font-bold text-white">
                {stats.totalActive}
              </span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[11px] text-emerald-400 font-semibold block">
                Cured
              </span>
              <span className="text-base font-bold text-white">
                {stats.totalDischarged}
              </span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[11px] text-red-400 font-semibold block">
                Deceased
              </span>
              <span className="text-base font-bold text-white">
                {stats.totalDeceased}
              </span>
            </div>
          </div>
        </div>

        {/* 5. Patient Status Breakdown (7 Cols on LG) */}
        <div className="lg:col-span-7 bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/70">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    Patient Status Breakdown
                  </h3>
                  <p className="text-xs text-slate-400">
                    Census distribution by clinical fever trajectory and clearance phase
                  </p>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-700/50 text-slate-300 font-medium">
                6 Categories
              </span>
            </div>

            {/* Bar Chart Container */}
            <div className="h-64 sm:h-72 w-full mt-3">
              {isMounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={statusBreakdownData}
                    margin={{ top: 12, right: 10, left: -16, bottom: 25 }}
                  >
                    <XAxis
                      dataKey="shortName"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      interval={0}
                      dy={5}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={<StatusBarTooltip />}
                      cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                    />
                    <Bar
                      dataKey="count"
                      radius={[6, 6, 0, 0]}
                      barSize={32}
                    >
                      {statusBreakdownData.map((entry, index) => (
                        <Cell
                          key={`status-cell-${index}`}
                          fill={entry.color}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  Loading Status Breakdown...
                </div>
              )}
            </div>
          </div>

          {/* Category Color Legend Footnote */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3 border-t border-slate-700/70 text-[11px]">
            {statusBreakdownData.map((cat, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 text-slate-300 truncate"
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="truncate">{cat.name}:</span>
                <span className="font-bold text-white shrink-0">
                  {cat.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6. Clinical Governance & Quarantine Criteria Reference Card */}
      <div className="bg-slate-800/70 border border-slate-700/70 rounded-xl p-5 text-xs text-slate-400 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Info size={18} className="text-blue-400 shrink-0" />
          <div>
            <span className="font-semibold text-slate-200">
              Quarantine Discharge Clearance Standard Operating Procedure:
            </span>
            <p className="text-slate-400 mt-0.5">
              Patients qualify for physician sign-off only upon reaching 3 consecutive fever-free days (&lt;100.4°F). Administrative bed release finalized post physician sign-off.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
          <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 font-mono">
            Protocol Rev. 4.2
          </span>
        </div>
      </div>
    </div>
  );
}
