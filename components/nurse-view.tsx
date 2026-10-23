"use client";

import React, { useState, useMemo } from "react";
import { useFacility, Patient, TemperatureReading } from "@/lib/data";
import {
  Thermometer,
  CheckCircle,
  AlertTriangle,
  X,
  Search,
  Activity,
  User,
  Calendar,
  Clock,
  ArrowUpDown,
  Sparkles,
  ClipboardList,
  AlertCircle,
  TrendingUp,
} from "lucide-react";

type FilterTab = "needs_check" | "completed";

export default function NurseView() {
  const { patients, recordTemperature, addToast, getActivePatients } = useFacility();

  // State
  const [activeTab, setActiveTab] = useState<FilterTab>("needs_check");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Modal Form State
  const [tempInput, setTempInput] = useState<string>("98.6");
  const [notesInput, setNotesInput] = useState<string>("");
  const [formError, setFormError] = useState<string>("");

  // Get active patients only, sorted by bed number
  const activePatients = useMemo(() => {
    const list = getActivePatients ? getActivePatients() : patients.filter((p) => p.outcome === "active");
    return [...list].sort((a, b) => a.bedNumber - b.bedNumber);
  }, [patients, getActivePatients]);

  // Counts
  const pendingCount = useMemo(() => {
    return activePatients.filter((p) => !p.todayTempRecorded).length;
  }, [activePatients]);

  const completedCount = useMemo(() => {
    return activePatients.filter((p) => p.todayTempRecorded).length;
  }, [activePatients]);

  const completionPercentage = activePatients.length > 0
    ? Math.round((completedCount / activePatients.length) * 100)
    : 0;

  // Filtered patients for display
  const displayedPatients = useMemo(() => {
    return activePatients.filter((p) => {
      // Tab filter
      if (activeTab === "needs_check" && p.todayTempRecorded) return false;
      if (activeTab === "completed" && !p.todayTempRecorded) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesBed = p.bedNumber.toString().includes(query) || `bed ${p.bedNumber}`.includes(query);
        return matchesName || matchesBed;
      }
      return true;
    });
  }, [activePatients, activeTab, searchQuery]);

  // Calculate days admitted from admissionDate
  const calculateDaysAdmitted = (admissionDate: string) => {
    try {
      const adm = new Date(admissionDate);
      const today = new Date();
      adm.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      const diffTime = Math.abs(today.getTime() - adm.getTime());
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(1, diffDays);
    } catch {
      return 1;
    }
  };

  // Open modal handler
  const handleOpenModal = (patient: Patient) => {
    setSelectedPatient(patient);
    // If patient already has a reading recorded today, use that; otherwise default to 98.6
    const latestReading = patient.temperatureHistory[patient.temperatureHistory.length - 1];
    if (patient.todayTempRecorded && latestReading) {
      setTempInput(latestReading.temperature.toFixed(1));
      setNotesInput(latestReading.notes || "");
    } else {
      setTempInput("98.6");
      setNotesInput("");
    }
    setFormError("");
  };

  // Close modal handler
  const handleCloseModal = () => {
    setSelectedPatient(null);
    setFormError("");
  };

  // Determine temperature category
  const getTempCategory = (temp: number) => {
    if (isNaN(temp)) return null;
    if (temp < 99.5) {
      return {
        label: "Normal",
        badgeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
        bgClass: "bg-emerald-950/40 border-emerald-600/50 text-emerald-200",
        dotClass: "bg-emerald-400",
        message: "Normal body temperature. Streak will advance towards discharge qualification.",
        status: "normal",
      };
    } else if (temp <= 100.3) {
      return {
        label: "Mild Fever",
        badgeClass: "bg-amber-500/20 text-amber-400 border-amber-500/40",
        bgClass: "bg-amber-950/40 border-amber-600/50 text-amber-200",
        dotClass: "bg-amber-400",
        message: "Elevated temperature. Patient remains under close monitoring.",
        status: "mild",
      };
    } else {
      return {
        label: "HIGH FEVER",
        badgeClass: "bg-red-500/20 text-red-400 border-red-500/40",
        bgClass: "bg-red-950/40 border-red-600/50 text-red-200",
        dotClass: "bg-red-400 animate-pulse",
        message: "CRITICAL: Temperature ≥ 100.4°F resets fever-free streak to 0 days!",
        status: "high",
      };
    }
  };

  const parsedTemp = parseFloat(tempInput);
  const tempCategory = !isNaN(parsedTemp) ? getTempCategory(parsedTemp) : null;

  // Submit temperature
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;

    const tempVal = parseFloat(tempInput);
    if (isNaN(tempVal)) {
      setFormError("Please enter a valid numeric temperature.");
      return;
    }

    if (tempVal < 95 || tempVal > 108) {
      setFormError("Temperature must be between 95.0°F and 108.0°F.");
      return;
    }

    // Call recordTemperature hook function
    recordTemperature(selectedPatient.id, tempVal, notesInput.trim(), "nurse");

    // Add toast notification
    if (tempVal >= 100.4) {
      addToast(
        `High fever (${tempVal}°F) recorded for ${selectedPatient.name} (Bed #${selectedPatient.bedNumber}). Streak reset to 0 days.`,
        "warning"
      );
    } else {
      addToast(
        `Temperature ${tempVal}°F recorded successfully for ${selectedPatient.name} (Bed #${selectedPatient.bedNumber}).`,
        "success"
      );
    }

    handleCloseModal();
  };

  return (
    <div className="space-y-6">
      {/* ─── 1. Header Section ─── */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 shadow-inner">
              <Thermometer size={28} className="stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
                Nurse Station - Temperature Tracking
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Daily clinical shift monitoring & fever-free quarantine evaluation
              </p>
            </div>
          </div>

          {/* Count Badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-950/40 border border-red-800/60 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-xs uppercase tracking-wider font-semibold text-red-300">Pending:</span>
              <span className="text-base font-bold text-red-200">{pendingCount}</span>
            </div>

            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-950/40 border border-emerald-800/60 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-xs uppercase tracking-wider font-semibold text-emerald-300">Completed:</span>
              <span className="text-base font-bold text-emerald-200">{completedCount}</span>
            </div>

            <div className="hidden lg:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-700/40 border border-slate-600/50">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Total Active:</span>
              <span className="text-base font-bold text-slate-200">{activePatients.length}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-5 pt-4 border-t border-slate-700/60">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-medium">
            <span>Shift Completion Progress</span>
            <span className="text-slate-200 font-semibold">{completionPercentage}% ({completedCount}/{activePatients.length} Patients Checked)</span>
          </div>
          <div className="w-full bg-slate-900/80 rounded-full h-2.5 overflow-hidden border border-slate-700/40">
            <div
              className="bg-gradient-to-r from-blue-500 to-emerald-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* ─── 2. Controls & Filter Tabs ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Filter Tabs */}
        <div className="flex p-1 bg-slate-800/90 border border-slate-700/80 rounded-xl max-w-md shadow-md">
          <button
            onClick={() => setActiveTab("needs_check")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === "needs_check"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/40"
            }`}
          >
            <AlertCircle size={16} />
            <span>Needs Temp Check</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === "needs_check"
                  ? "bg-blue-800/80 text-blue-100"
                  : "bg-red-950/60 text-red-400 border border-red-800/40"
              }`}
            >
              {pendingCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("completed")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === "completed"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/40"
            }`}
          >
            <CheckCircle size={16} />
            <span>Completed Today</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === "completed"
                  ? "bg-blue-800/80 text-blue-100"
                  : "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
              }`}
            >
              {completedCount}
            </span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative min-w-[260px] sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search bed # or patient name..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800/90 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ─── 3. Patient Table ─── */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700/90 bg-slate-800/60 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4">Bed #</th>
                <th className="py-3.5 px-4">Patient Name</th>
                <th className="py-3.5 px-4">Age</th>
                <th className="py-3.5 px-4">Days Admitted</th>
                <th className="py-3.5 px-4">Fever-Free Streak</th>
                <th className="py-3.5 px-4">Today&apos;s Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-sm">
              {displayedPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="p-3 bg-slate-700/40 rounded-full text-slate-500">
                        {activeTab === "needs_check" ? (
                          <CheckCircle size={32} className="text-emerald-400" />
                        ) : (
                          <ClipboardList size={32} />
                        )}
                      </div>
                      <p className="text-base font-semibold text-slate-300">
                        {activeTab === "needs_check"
                          ? "All temperature checks completed!"
                          : "No patients recorded today yet."}
                      </p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        {activeTab === "needs_check"
                          ? "All active patients have had their daily temperature logged for this shift."
                          : "Record temperatures from the 'Needs Temp Check' tab to see entries here."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedPatients.map((patient) => {
                  const daysAdmitted = calculateDaysAdmitted(patient.admissionDate);
                  const latestTempReading = patient.temperatureHistory[patient.temperatureHistory.length - 1];

                  // Streak styling: green if >=3, yellow if 1-2, gray if 0
                  const streak = patient.consecutiveFeverFreeDays;
                  let streakBadgeClass = "bg-slate-700/50 text-slate-400 border-slate-600/60";
                  if (streak >= 3) {
                    streakBadgeClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-900/30";
                  } else if (streak >= 1) {
                    streakBadgeClass = "bg-amber-500/20 text-amber-300 border-amber-500/40";
                  }

                  return (
                    <tr
                      key={patient.id}
                      className="hover:bg-slate-700/40 transition-colors group"
                    >
                      {/* Bed # */}
                      <td className="py-3.5 px-4 font-mono font-bold text-white whitespace-nowrap">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-slate-700/60 border border-slate-600/70 text-blue-300 group-hover:border-blue-500/40 transition-colors">
                          Bed {patient.bedNumber}
                        </span>
                      </td>

                      {/* Patient Name */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-white group-hover:text-blue-300 transition-colors flex items-center gap-2">
                          <span>{patient.name}</span>
                          {streak >= 3 && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              title="Eligible for discharge evaluation"
                            >
                              Ready for Discharge
                            </span>
                          )}
                        </div>
                        {patient.todayTempRecorded && latestTempReading && (
                          <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <Thermometer size={12} className="text-slate-400" />
                            <span>
                              Recorded: <strong className="text-slate-300">{latestTempReading.temperature}°F</strong>
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Age */}
                      <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                        {patient.age} yrs
                      </td>

                      {/* Days Admitted */}
                      <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={14} className="text-slate-400" />
                          <span>{daysAdmitted} {daysAdmitted === 1 ? "day" : "days"}</span>
                        </div>
                      </td>

                      {/* Fever-Free Streak */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${streakBadgeClass}`}
                        >
                          {streak >= 3 ? (
                            <Sparkles size={12} className="text-emerald-400" />
                          ) : streak >= 1 ? (
                            <Activity size={12} className="text-amber-400" />
                          ) : (
                            <Clock size={12} className="text-slate-400" />
                          )}
                          {streak}/3 Days
                        </span>
                      </td>

                      {/* Today's Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {patient.todayTempRecorded ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle size={13} className="text-emerald-400" />
                            Done
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30">
                            <AlertTriangle size={13} className="text-red-400" />
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleOpenModal(patient)}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            patient.todayTempRecorded
                              ? "bg-slate-700/80 hover:bg-slate-600 text-slate-200 border border-slate-600/70"
                              : "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25 active:scale-95"
                          }`}
                        >
                          <Thermometer size={14} />
                          {patient.todayTempRecorded ? "Update Temp" : "Record Temp"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 4. Record Temperature Modal ─── */}
      {selectedPatient && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                  <Thermometer size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Record Temperature</h3>
                  <p className="text-xs text-slate-400">Clinical Vitals Entry</p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Patient Info Header */}
            <div className="px-6 py-3.5 bg-slate-800/40 border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono px-2 py-0.5 rounded bg-blue-900/40 border border-blue-700/50 text-blue-300 font-bold">
                  Bed #{selectedPatient.bedNumber}
                </span>
                <span className="font-bold text-white text-sm">{selectedPatient.name}</span>
                <span className="text-slate-400">({selectedPatient.age} yrs)</span>
              </div>
              <div className="text-slate-400">
                Streak:{" "}
                <span className="font-semibold text-slate-200">
                  {selectedPatient.consecutiveFeverFreeDays}/3 Days
                </span>
              </div>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {formError && (
                <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Temperature Input & Quick Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="temp-input" className="text-sm font-semibold text-slate-200">
                    Temperature (°F) <span className="text-red-400">*</span>
                  </label>
                  <span className="text-xs text-slate-400">Valid range: 95.0°F - 108.0°F</span>
                </div>

                <div className="relative">
                  <input
                    id="temp-input"
                    type="number"
                    step="0.1"
                    min="95"
                    max="108"
                    required
                    value={tempInput}
                    onChange={(e) => {
                      setTempInput(e.target.value);
                      setFormError("");
                    }}
                    autoFocus
                    className="w-full text-2xl font-mono font-bold px-4 py-3 bg-slate-800/90 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-center tracking-wider"
                    placeholder="98.6"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-semibold text-sm">
                    °F
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-slate-400">Presets:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { val: "98.2", label: "98.2°" },
                      { val: "98.6", label: "98.6° (Normal)" },
                      { val: "99.8", label: "99.8° (Mild)" },
                      { val: "100.4", label: "100.4° (Fever)" },
                      { val: "101.5", label: "101.5°" },
                    ].map((preset) => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => {
                          setTempInput(preset.val);
                          setFormError("");
                        }}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${
                          tempInput === preset.val
                            ? "bg-blue-600 text-white border-blue-500 font-bold"
                            : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750 hover:text-white"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Color Indicator Below Input */}
              {tempCategory ? (
                <div
                  className={`p-3.5 rounded-xl border transition-all ${tempCategory.bgClass}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${tempCategory.dotClass}`}></span>
                      <span className="text-xs uppercase tracking-wider font-bold">
                        Status: {tempCategory.label}
                      </span>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${tempCategory.badgeClass}`}
                    >
                      {tempCategory.label}
                    </span>
                  </div>
                  <p className="text-xs opacity-90 leading-relaxed">
                    {tempCategory.message}
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 text-xs text-slate-400">
                  Enter a valid temperature between 95°F and 108°F to view live classification.
                </div>
              )}

              {/* Clinical Notes Textarea */}
              <div className="space-y-1.5">
                <label htmlFor="notes-input" className="text-sm font-semibold text-slate-200">
                  Clinical Notes / Observations
                </label>
                <textarea
                  id="notes-input"
                  rows={3}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Record symptoms, chills, paracetamol administration, patient discomfort..."
                  className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                ></textarea>
              </div>

              {/* Patient Recent History Mini-Preview */}
              {selectedPatient.temperatureHistory.length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="font-semibold text-slate-300">Previous Readings (Last 3)</span>
                    <span>Total readings: {selectedPatient.temperatureHistory.length}</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {selectedPatient.temperatureHistory.slice(-3).map((r, idx) => (
                      <div
                        key={idx}
                        className="flex-1 min-w-[100px] p-2 rounded-lg bg-slate-800/60 border border-slate-700/60 text-center text-xs"
                      >
                        <div className="text-[10px] text-slate-400">{r.date}</div>
                        <div
                          className={`font-mono font-bold mt-0.5 ${
                            r.temperature >= 100.4
                              ? "text-red-400"
                              : r.temperature >= 99.5
                              ? "text-amber-400"
                              : "text-emerald-400"
                          }`}
                        >
                          {r.temperature}°F
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition-all active:scale-95 flex items-center gap-2"
                >
                  <Thermometer size={16} />
                  <span>Save Temperature</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
