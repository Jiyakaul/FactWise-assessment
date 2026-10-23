"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useFacility } from "@/lib/data";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Stethoscope,
  FileText,
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  Thermometer,
  Clock,
  X,
  ChevronDown,
  ChevronUp,
  Search,
  Sparkles,
  Activity,
  User,
  Check,
  ShieldCheck,
  Calendar,
  Bed,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";

// Safe helper to obtain latest temperature
function getLatestTemp(patient: any): number | null {
  if (patient.currentTemp !== undefined && patient.currentTemp !== null) {
    const val = Number(patient.currentTemp);
    if (!isNaN(val)) return val;
  }
  if (Array.isArray(patient.temperatureHistory) && patient.temperatureHistory.length > 0) {
    const last = patient.temperatureHistory[patient.temperatureHistory.length - 1];
    if (last && last.temperature !== undefined && last.temperature !== null) {
      const val = Number(last.temperature);
      if (!isNaN(val)) return val;
    }
  }
  if (patient.latestTemp !== undefined && patient.latestTemp !== null) {
    const val = Number(patient.latestTemp);
    if (!isNaN(val)) return val;
  }
  return null;
}

// Safe helper to normalize past doctor notes
function getDoctorNotesList(notes: any): Array<{ id: string | number; text: string; date?: string }> {
  if (!notes) return [];
  if (Array.isArray(notes)) {
    return notes.map((item, index) => {
      if (typeof item === "string") {
        return { id: index, text: item };
      }
      if (typeof item === "object" && item !== null) {
        return {
          id: item.id ?? index,
          text: item.note || item.text || item.content || JSON.stringify(item),
          date: item.date || item.timestamp,
        };
      }
      return { id: index, text: String(item) };
    });
  }
  if (typeof notes === "string") {
    return notes
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line, idx) => ({ id: idx, text: line }));
  }
  return [];
}

// Custom Recharts Tooltip
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const temp = Number(data.temperature);
  const isFever = temp >= 100.4;

  return (
    <div className="bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg shadow-xl text-xs space-y-1">
      <div className="text-slate-400 flex items-center justify-between gap-4">
        <span>{data.date}</span>
        {data.time && <span>{data.time}</span>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-slate-300 font-medium">Temperature:</span>
        <span className={`font-bold ${isFever ? "text-red-400" : "text-emerald-400"}`}>
          {temp.toFixed(1)}°F
        </span>
      </div>
      <div className="flex items-center gap-1.5 pt-0.5 border-t border-slate-800">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            isFever ? "bg-red-500" : "bg-emerald-500"
          }`}
        />
        <span className={isFever ? "text-red-300 font-semibold" : "text-emerald-300"}>
          {isFever ? "Fever (≥ 100.4°F)" : "Normal Range"}
        </span>
      </div>
      {data.notes && (
        <div className="text-slate-400 italic text-[11px] max-w-xs truncate pt-1">
          &quot;{data.notes}&quot;
        </div>
      )}
    </div>
  );
}

export default function DoctorView() {
  const facilityData = useFacility();
  const {
    patients = [],
    completeDoctorRound,
    approveDischarge,
    recordTemperature,
    addToast,
    getActivePatients,
  } = facilityData;

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);

  // Modal local state
  const [doctorNoteInput, setDoctorNoteInput] = useState("");
  const [manualTempInput, setManualTempInput] = useState("");
  const [manualTempNotes, setManualTempNotes] = useState("");
  const [isSubmittingTemp, setIsSubmittingTemp] = useState(false);

  // Active patients list
  const activePatients = useMemo(() => {
    if (typeof getActivePatients === "function") {
      try {
        const active = getActivePatients();
        if (Array.isArray(active)) return active;
      } catch (err) {
        console.error("Error calling getActivePatients:", err);
      }
    }
    return (patients || []).filter((p: any) => p.status === "active" || !p.status);
  }, [patients, getActivePatients]);

  // Filtered patients by search query
  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return activePatients;
    const q = searchQuery.toLowerCase().trim();
    return activePatients.filter((p: any) => {
      const nameMatch = p.name?.toLowerCase().includes(q);
      const bedMatch = String(p.bedNumber || p.bed || "").toLowerCase().includes(q);
      const idMatch = String(p.id || "").toLowerCase().includes(q);
      return nameMatch || bedMatch || idMatch;
    });
  }, [activePatients, searchQuery]);

  // Queue separation
  const readyQueue = useMemo(
    () => filteredPatients.filter((p: any) => p.todayTempRecorded && !p.todayDoctorVisited),
    [filteredPatients]
  );

  const pendingQueue = useMemo(
    () => filteredPatients.filter((p: any) => !p.todayTempRecorded && !p.todayDoctorVisited),
    [filteredPatients]
  );

  const completedQueue = useMemo(
    () => filteredPatients.filter((p: any) => p.todayDoctorVisited),
    [filteredPatients]
  );

  // Selected patient details
  const selectedPatient = useMemo(() => {
    if (!selectedPatientId) return null;
    return (
      activePatients.find((p: any) => p.id === selectedPatientId) ||
      (patients || []).find((p: any) => p.id === selectedPatientId) ||
      null
    );
  }, [selectedPatientId, activePatients, patients]);

  // Reset modal input states when patient selection changes
  useEffect(() => {
    if (selectedPatient) {
      setDoctorNoteInput("");
      setManualTempInput("");
      setManualTempNotes("");
      setIsSubmittingTemp(false);
    }
  }, [selectedPatientId, selectedPatient]);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedPatientId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handlers
  const handleOpenPatient = (patientId: string) => {
    setSelectedPatientId(patientId);
  };

  const handleCloseModal = () => {
    setSelectedPatientId(null);
  };

  const handleRecordManualTemp = () => {
    if (!selectedPatient) return;
    const tempNum = parseFloat(manualTempInput);
    if (isNaN(tempNum) || tempNum < 90 || tempNum > 110) {
      if (typeof addToast === "function") {
        addToast("Please enter a valid temperature between 90°F and 110°F", "warning");
      }
      return;
    }

    setIsSubmittingTemp(true);
    if (typeof recordTemperature === "function") {
      recordTemperature(
        selectedPatient.id,
        tempNum,
        manualTempNotes.trim() || "Vitals recorded directly by physician during rounds",
        "doctor"
      );
    }

    if (typeof addToast === "function") {
      addToast(
        `Recorded ${tempNum.toFixed(1)}°F vitals for ${selectedPatient.name}`,
        "success"
      );
    }

    setManualTempInput("");
    setManualTempNotes("");
    setIsSubmittingTemp(false);
  };

  const handleCompleteRound = () => {
    if (!selectedPatient) return;

    // If manual temp was entered but not saved yet, record it too
    if (!selectedPatient.todayTempRecorded && manualTempInput.trim()) {
      const tempNum = parseFloat(manualTempInput);
      if (!isNaN(tempNum) && tempNum >= 90 && tempNum <= 110) {
        if (typeof recordTemperature === "function") {
          recordTemperature(
            selectedPatient.id,
            tempNum,
            manualTempNotes.trim() || "Recorded during physician round",
            "doctor"
          );
        }
      }
    }

    const noteToSave = doctorNoteInput.trim() || "Physician round completed. Patient evaluated.";

    if (typeof completeDoctorRound === "function") {
      completeDoctorRound(selectedPatient.id, noteToSave);
    }

    if (typeof addToast === "function") {
      addToast(
        `Doctor round completed for ${selectedPatient.name} (Bed ${
          selectedPatient.bedNumber || selectedPatient.bed || selectedPatient.id
        })`,
        "success"
      );
    }

    setSelectedPatientId(null);
  };

  const handleApproveDischarge = () => {
    if (!selectedPatient) return;

    const feverFreeDays = selectedPatient.consecutiveFeverFreeDays || 0;
    if (feverFreeDays < 3) {
      if (typeof addToast === "function") {
        addToast(
          `Cannot approve discharge: Patient only has ${feverFreeDays}/3 consecutive fever-free days.`,
          "warning"
        );
      }
      return;
    }

    if (typeof approveDischarge === "function") {
      approveDischarge(selectedPatient.id);
    }

    if (typeof addToast === "function") {
      addToast(
        `Discharge order officially signed for ${selectedPatient.name}! Quarantine clearance verified.`,
        "success"
      );
    }

    setSelectedPatientId(null);
  };

  // Prepare chart data for modal (last 7 temperature readings)
  const chartData = useMemo(() => {
    if (!selectedPatient) return [];
    const history = selectedPatient.temperatureHistory || [];
    const last7 = history.slice(-7);

    return last7.map((entry: any, index: number) => {
      const rawTemp = entry.temperature;
      const numTemp = typeof rawTemp === "number" ? rawTemp : parseFloat(rawTemp);
      const displayDate = entry.date
        ? String(entry.date).length > 10
          ? String(entry.date).slice(5, 10)
          : String(entry.date)
        : `Day ${index + 1}`;

      return {
        date: displayDate,
        fullDate: entry.date,
        time: entry.time,
        temperature: isNaN(numTemp) ? 98.6 : Number(numTemp.toFixed(1)),
        notes: entry.notes || "",
      };
    });
  }, [selectedPatient]);

  const pastDoctorNotes = useMemo(() => {
    if (!selectedPatient) return [];
    return getDoctorNotesList(selectedPatient.doctorNotes);
  }, [selectedPatient]);

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-xl shadow-inner">
              <Stethoscope size={28} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Doctor Rounds &amp; Treatment
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-900/60 text-blue-300 border border-blue-700/60">
                  Physician Portal
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Clinical review, temperature trending, round sign-offs, and discharge authorization.
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center flex-wrap gap-2.5 text-xs">
            <div className="bg-slate-900/80 border border-emerald-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-slate-400">Ready for Round:</span>
              <span className="text-emerald-300 font-bold">{readyQueue.length}</span>
            </div>
            <div className="bg-slate-900/80 border border-amber-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-slate-400">Pending Vitals:</span>
              <span className="text-amber-300 font-bold">{pendingQueue.length}</span>
            </div>
            <div className="bg-slate-900/80 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <CheckCircle size={14} className="text-slate-400" />
              <span className="text-slate-400">Completed:</span>
              <span className="text-slate-200 font-bold">{completedQueue.length}</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-4 pt-4 border-t border-slate-700/60 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search by patient name, bed number, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="text-xs text-slate-400 hidden sm:block">
            Showing <span className="font-semibold text-white">{filteredPatients.length}</span> active quarantine patients
          </div>
        </div>
      </div>

      {/* 2. Queue Sections */}
      <div className="space-y-6">
        {/* Section 2a: Ready for Round (Green Header) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Ready for Round</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700">
                  {readyQueue.length}
                </span>
              </h2>
            </div>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Vitals recorded by nursing staff today • Ready for doctor examination
            </span>
          </div>

          {readyQueue.length === 0 ? (
            <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-xl p-8 text-center text-slate-400 text-sm">
              <CheckCircle className="mx-auto text-emerald-500/60 mb-2" size={28} />
              <p className="font-medium text-slate-300">No patients currently awaiting doctor rounds</p>
              <p className="text-xs text-slate-500 mt-1">
                Patients with logged vitals will automatically queue here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {readyQueue.map((patient: any) => {
                const latestTemp = getLatestTemp(patient);
                const feverFreeDays = patient.consecutiveFeverFreeDays || 0;
                const isDischargeReady = feverFreeDays >= 3;
                const bedNum = patient.bedNumber || patient.bed || "Unassigned";

                return (
                  <div
                    key={patient.id}
                    onClick={() => handleOpenPatient(patient.id)}
                    className="group bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500/50 border-l-4 border-l-emerald-500 rounded-r-xl p-4 shadow-md hover:shadow-lg transition-all cursor-pointer relative flex flex-col justify-between"
                  >
                    <div>
                      {/* Top row: Bed # and Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-emerald-300">
                          <Bed size={13} />
                          {bedNum}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isDischargeReady && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-600 animate-pulse">
                              <Sparkles size={11} />
                              Discharge Ready
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-900/40 text-emerald-300 border border-emerald-800/60">
                            <CheckCircle size={11} />
                            Vitals Logged
                          </span>
                        </div>
                      </div>

                      {/* Patient Name */}
                      <div className="text-base font-semibold text-white group-hover:text-emerald-300 transition-colors">
                        {patient.name}
                      </div>

                      {/* Patient extra info if present */}
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        {patient.age && <span>{patient.age}y</span>}
                        {patient.gender && <span>• {patient.gender}</span>}
                        <span>• ID: {patient.id.slice(0, 8)}</span>
                      </div>
                    </div>

                    {/* Vitals and Fever-Free meter */}
                    <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Thermometer
                          size={15}
                          className={
                            latestTemp !== null && latestTemp >= 100.4
                              ? "text-red-400"
                              : "text-emerald-400"
                          }
                        />
                        <span className="text-xs text-slate-400">Latest Temp:</span>
                        <span
                          className={`text-xs font-bold ${
                            latestTemp !== null && latestTemp >= 100.4
                              ? "text-red-400"
                              : "text-slate-100"
                          }`}
                        >
                          {latestTemp !== null ? `${latestTemp.toFixed(1)}°F` : "N/A"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-xs">
                        <span
                          className={`px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                            feverFreeDays >= 3
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-600"
                              : feverFreeDays > 0
                              ? "bg-blue-950 text-blue-300 border border-blue-800"
                              : "bg-slate-700/60 text-slate-400"
                          }`}
                        >
                          {feverFreeDays} / 3 Days Fever-Free
                        </span>
                      </div>
                    </div>

                    {/* Hover call to action indicator */}
                    <div className="mt-2 flex items-center justify-end text-[11px] text-emerald-400/80 font-medium group-hover:text-emerald-300 transition-colors">
                      <span>Examine Patient</span>
                      <ArrowRight size={12} className="ml-1 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2b: Pending Nurse Vitals (Amber Header) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Pending Nurse Vitals</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-700">
                  {pendingQueue.length}
                </span>
              </h2>
            </div>
            <span className="text-xs text-amber-400/80 hidden sm:inline">
              Morning temperature has not been entered yet by nursing staff
            </span>
          </div>

          {pendingQueue.length === 0 ? (
            <div className="bg-slate-800/30 border border-dashed border-slate-700/60 rounded-xl p-6 text-center text-slate-400 text-sm">
              <Check className="mx-auto text-amber-500/60 mb-1.5" size={24} />
              <p className="font-medium text-slate-300">All morning vitals have been logged</p>
              <p className="text-xs text-slate-500 mt-0.5">
                No patients pending vitals check from nursing.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {pendingQueue.map((patient: any) => {
                const latestTemp = getLatestTemp(patient);
                const feverFreeDays = patient.consecutiveFeverFreeDays || 0;
                const bedNum = patient.bedNumber || patient.bed || "Unassigned";

                return (
                  <div
                    key={patient.id}
                    onClick={() => handleOpenPatient(patient.id)}
                    className="group bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-amber-500/50 border-l-4 border-l-amber-500 rounded-r-xl p-4 shadow-sm hover:shadow-md opacity-75 hover:opacity-100 transition-all cursor-pointer relative flex flex-col justify-between"
                  >
                    <div>
                      {/* Top row: Bed # and Warning Badge */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-amber-300">
                          <Bed size={13} />
                          {bedNum}
                        </span>

                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-amber-950/80 text-amber-300 border border-amber-600/70 shadow-sm">
                          <AlertTriangle size={12} className="text-amber-400" />
                          ⚠️ Temp Not Taken
                        </span>
                      </div>

                      {/* Patient Name */}
                      <div className="text-base font-semibold text-white group-hover:text-amber-300 transition-colors">
                        {patient.name}
                      </div>

                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        {patient.age && <span>{patient.age}y</span>}
                        {patient.gender && <span>• {patient.gender}</span>}
                        <span>• ID: {patient.id.slice(0, 8)}</span>
                      </div>
                    </div>

                    {/* Vitals and Fever-Free meter */}
                    <div className="mt-4 pt-3 border-t border-slate-700/40 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} className="text-amber-400" />
                        <span className="text-xs text-slate-400">Previous:</span>
                        <span className="text-xs font-medium text-slate-300">
                          {latestTemp !== null ? `${latestTemp.toFixed(1)}°F` : "No prior vitals"}
                        </span>
                      </div>

                      <div className="text-xs">
                        <span className="px-2 py-0.5 rounded-full font-medium text-[11px] bg-slate-700/50 text-slate-400">
                          {feverFreeDays} / 3 Days Fever-Free
                        </span>
                      </div>
                    </div>

                    {/* Action Prompt */}
                    <div className="mt-2 flex items-center justify-end text-[11px] text-amber-400/90 font-medium group-hover:text-amber-300 transition-colors">
                      <span>Examine / Enter Vitals</span>
                      <ArrowRight size={12} className="ml-1 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2c: Rounds Completed (Gray, Collapsible) */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => setIsCompletedOpen(!isCompletedOpen)}
            className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-800/60 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle size={18} className="text-slate-400" />
              <h2 className="text-base font-bold text-slate-200">
                Rounds Completed Today
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">
                {completedQueue.length}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{isCompletedOpen ? "Hide completed" : "View completed"}</span>
              {isCompletedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          {isCompletedOpen && (
            <div className="p-4 pt-1 border-t border-slate-700/50 space-y-3">
              {completedQueue.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-400">
                  <p>No physician rounds have been completed yet today.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {completedQueue.map((patient: any) => {
                    const latestTemp = getLatestTemp(patient);
                    const feverFreeDays = patient.consecutiveFeverFreeDays || 0;
                    const bedNum = patient.bedNumber || patient.bed || "Unassigned";

                    return (
                      <div
                        key={patient.id}
                        onClick={() => handleOpenPatient(patient.id)}
                        className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 border-l-4 border-l-slate-500 rounded-r-xl p-3.5 shadow-sm transition-all cursor-pointer flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-slate-300">
                              {bedNum}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                              <CheckCircle size={11} /> Round Done
                            </span>
                          </div>
                          <div className="font-semibold text-white text-sm">
                            {patient.name}
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-700/40 flex items-center justify-between text-xs text-slate-400">
                          <span>Temp: {latestTemp !== null ? `${latestTemp.toFixed(1)}°F` : "N/A"}</span>
                          <span>{feverFreeDays} / 3 Fever-Free</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Patient Detail Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-300 font-mono font-bold text-sm">
                  Bed {selectedPatient.bedNumber || selectedPatient.bed || selectedPatient.id}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">
                      {selectedPatient.name}
                    </h2>
                    {selectedPatient.todayDoctorVisited && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-700">
                        Round Completed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                    <span>Patient ID: {selectedPatient.id}</span>
                    {selectedPatient.age && <span>• Age: {selectedPatient.age}</span>}
                    {selectedPatient.gender && <span>• Gender: {selectedPatient.gender}</span>}
                    {selectedPatient.admissionDate && (
                      <span>• Admitted: {selectedPatient.admissionDate}</span>
                    )}
                  </p>
                </div>
              </div>

              <button
                onClick={handleCloseModal}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors"
                title="Close Modal (Esc)"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* WARNING BANNER: if todayTempRecorded === false */}
              {!selectedPatient.todayTempRecorded && (
                <div className="bg-amber-950/70 border-2 border-amber-500 text-amber-200 rounded-xl p-4 shadow-lg flex items-start gap-3.5">
                  <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={24} />
                  <div className="flex-1">
                    <h3 className="font-bold text-amber-300 text-base">
                      Warning: Temperature has not been recorded today by a nurse.
                    </h3>
                    <p className="text-sm text-amber-200/90 mt-1 leading-relaxed">
                      Proceeding will require you to take vitals yourself. Enter the current temperature below before signing off on this round.
                    </p>
                  </div>
                </div>
              )}

              {/* Optional Temperature Input Field (If temp not recorded today) */}
              {!selectedPatient.todayTempRecorded && (
                <div className="bg-slate-800/80 border border-amber-500/40 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
                      <Thermometer size={16} />
                      <span>Doctor Vitals Intake</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      Take temperature with portable scanner
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Temperature (°F) <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="92"
                        max="108"
                        placeholder="e.g. 98.6"
                        value={manualTempInput}
                        onChange={(e) => setManualTempInput(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Vitals Note / Method
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Forehead scanner reading during physician round"
                        value={manualTempNotes}
                        onChange={(e) => setManualTempNotes(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-3 flex items-end">
                      <button
                        type="button"
                        onClick={handleRecordManualTemp}
                        disabled={!manualTempInput.trim() || isSubmittingTemp}
                        className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow"
                      >
                        <Check size={15} />
                        Record Vitals
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Fever-Free Counter: Prominent 3-day indicator */}
              <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-5 shadow-inner">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Discharge Qualification Criterion
                    </span>
                    <div className="flex items-center gap-3 mt-1">
                      <h4 className="text-2xl sm:text-3xl font-black text-white">
                        {selectedPatient.consecutiveFeverFreeDays || 0} / 3 Days Fever-Free
                      </h4>
                      {(selectedPatient.consecutiveFeverFreeDays || 0) >= 3 ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-500 flex items-center gap-1.5">
                          <CheckCircle size={14} className="text-emerald-400" />
                          Ready for Discharge Order
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-700/80 text-slate-300 border border-slate-600">
                          {3 - (selectedPatient.consecutiveFeverFreeDays || 0)} more fever-free day(s) required
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 sm:text-right">
                    <span>Threshold: &lt; 100.4°F</span>
                    <p className="text-[11px] text-slate-500">Requires 3 consecutive days below fever line</p>
                  </div>
                </div>

                {/* 3-Step Progress Indicator */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {[1, 2, 3].map((dayIndex) => {
                    const isMet = (selectedPatient.consecutiveFeverFreeDays || 0) >= dayIndex;
                    return (
                      <div
                        key={dayIndex}
                        className={`rounded-xl border p-3 text-center transition-all ${
                          isMet
                            ? "bg-emerald-950/70 border-emerald-500/70 text-emerald-300 shadow-md shadow-emerald-950/40"
                            : "bg-slate-900/60 border-slate-700/70 text-slate-500"
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1.5 text-xs font-bold">
                          {isMet ? (
                            <CheckCircle size={14} className="text-emerald-400" />
                          ) : (
                            <Clock size={14} className="text-slate-500" />
                          )}
                          <span>Day {dayIndex}</span>
                        </div>
                        <div className="text-[11px] mt-1 font-medium">
                          {isMet ? "Fever-Free Verified" : "Pending Vitals"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Temperature Trend Chart */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity size={18} className="text-blue-400" />
                    <h4 className="font-bold text-white text-base">
                      Temperature Trend (Last 7 Readings)
                    </h4>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-blue-500 rounded" />
                      <span className="text-slate-300">Temp (°F)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-red-500 border-dashed rounded" />
                      <span className="text-red-400 font-semibold">Fever Line (100.4°F)</span>
                    </div>
                  </div>
                </div>

                {chartData.length === 0 ? (
                  <div className="h-56 flex flex-col items-center justify-center text-slate-500 text-sm">
                    <Thermometer size={32} className="mb-2 opacity-40" />
                    <p>No temperature recordings on file yet for this patient.</p>
                  </div>
                ) : (
                  <div className="h-60 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{ top: 15, right: 30, left: -10, bottom: 5 }}
                      >
                        <XAxis
                          dataKey="date"
                          stroke="#64748b"
                          fontSize={11}
                          tickLine={false}
                          tick={{ fill: "#94a3b8" }}
                        />
                        <YAxis
                          domain={[
                            (dataMin: number) => Math.min(96, Math.floor(dataMin - 1)),
                            (dataMax: number) => Math.max(102, Math.ceil(dataMax + 1)),
                          ]}
                          stroke="#64748b"
                          fontSize={11}
                          tickLine={false}
                          unit="°F"
                          tick={{ fill: "#94a3b8" }}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <ReferenceLine
                          y={100.4}
                          stroke="#ef4444"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                          label={{
                            value: "Fever Threshold (100.4°F)",
                            fill: "#ef4444",
                            position: "insideTopRight",
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="temperature"
                          stroke="#3b82f6"
                          strokeWidth={2.5}
                          dot={{
                            r: 4,
                            fill: "#3b82f6",
                            stroke: "#1e293b",
                            strokeWidth: 2,
                          }}
                          activeDot={{
                            r: 6,
                            fill: "#60a5fa",
                            stroke: "#ffffff",
                            strokeWidth: 2,
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Doctor Round Notes Input */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-blue-400" />
                    <h4 className="font-bold text-white text-base">
                      Doctor Round Notes
                    </h4>
                  </div>
                  <span className="text-xs text-slate-400">
                    Clinical findings &amp; treatment directives
                  </span>
                </div>

                <textarea
                  rows={3}
                  value={doctorNoteInput}
                  onChange={(e) => setDoctorNoteInput(e.target.value)}
                  placeholder="Enter current round observations, symptoms review, lung sounds, medication adjustments, or planned discharge notes..."
                  className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Previous Doctor Notes */}
              <div className="bg-slate-800/50 border border-slate-700/70 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={18} className="text-slate-400" />
                    <h4 className="font-semibold text-slate-200 text-sm">
                      Previous Doctor Notes &amp; Rounds History
                    </h4>
                  </div>
                  <span className="text-xs text-slate-500">
                    {pastDoctorNotes.length} recorded entry(ies)
                  </span>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                  {pastDoctorNotes.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-500">
                      No previous physician notes logged for this patient.
                    </div>
                  ) : (
                    pastDoctorNotes.map((noteItem) => (
                      <div
                        key={noteItem.id}
                        className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 text-xs space-y-1"
                      >
                        {noteItem.date && (
                          <div className="text-[11px] font-semibold text-slate-400">
                            {noteItem.date}
                          </div>
                        )}
                        <p className="text-slate-200 leading-relaxed">
                          {noteItem.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer / Action Buttons */}
            <div className="px-6 py-4 bg-slate-800 border-t border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-slate-600 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
              >
                Close
              </button>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {/* Complete Round Button */}
                <button
                  type="button"
                  onClick={handleCompleteRound}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                >
                  <Stethoscope size={16} />
                  <span>
                    {selectedPatient.todayDoctorVisited
                      ? "Update Round Notes"
                      : "Complete Round"}
                  </span>
                </button>

                {/* Approve Discharge Button */}
                {(selectedPatient.consecutiveFeverFreeDays || 0) >= 3 ? (
                  <button
                    type="button"
                    onClick={handleApproveDischarge}
                    className="glow-green w-full sm:w-auto px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles size={16} className="text-emerald-200 animate-spin" />
                    <span>Sign Discharge Order ✓ (3 Days Fever-Free Met)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="Requires 3 consecutive fever-free days"
                    className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-slate-800 text-slate-500 border border-slate-700 text-sm font-medium cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <ShieldCheck size={16} className="text-slate-600" />
                    <span>Approve Discharge</span>
                    <span className="text-xs bg-slate-700/60 text-slate-400 px-1.5 py-0.5 rounded">
                      Requires 3 Days Fever-Free
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
