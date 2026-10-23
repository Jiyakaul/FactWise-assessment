"use client";

import React, { useState, useMemo } from "react";
import { useFacility } from "@/lib/data";
import {
  Building,
  BedDouble,
  UserPlus,
  LogOut,
  Skull,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  ShieldAlert,
} from "lucide-react";

type FacilityHook = ReturnType<typeof useFacility>;
type Patient = FacilityHook["patients"][number];

interface ActivityItem {
  id: string;
  type: "discharge" | "death" | "admit";
  patientName: string;
  bedNumber: number;
  timestamp: string;
  note: string;
}

export default function AdminView() {
  const {
    patients,
    finalizeDischarge,
    admitPatient,
    recordDeath,
    addToast,
    getActivePatients,
  } = useFacility();

  // Selected bed for the detail popover
  const [selectedBedNumber, setSelectedBedNumber] = useState<number | null>(null);

  // Admit patient form state
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientAge, setNewPatientAge] = useState<string>("");
  const [selectedBedForAdmit, setSelectedBedForAdmit] = useState<string>("");

  // Local activity log entries to record immediate session events
  const [sessionActivities, setSessionActivities] = useState<ActivityItem[]>([]);

  // Total facility bed capacity
  const TOTAL_BEDS = 74;

  // Derive active patients list
  const activePatients = useMemo(() => {
    if (typeof getActivePatients === "function") {
      const active = getActivePatients();
      if (active && Array.isArray(active)) {
        return active;
      }
    }
    // Fallback filter
    return patients.filter(
      (p) => p.outcome === "active"
    );
  }, [patients, getActivePatients]);

  const activeOccupancy = activePatients.length;
  const isAtMaxCapacity = activeOccupancy >= TOTAL_BEDS;

  // Map beds 1-74 to active patient (or deceased patient)
  const bedMap = useMemo(() => {
    const map = new Map<number, Patient>();
    // First map active patients
    activePatients.forEach((patient) => {
      if (patient.bedNumber && patient.bedNumber >= 1 && patient.bedNumber <= TOTAL_BEDS) {
        map.set(patient.bedNumber, patient);
      }
    });

    // Also track deceased patients if bed not occupied by active
    patients.forEach((patient) => {
      if (
        (patient.status === "deceased" || patient.outcome === "deceased") &&
        patient.bedNumber &&
        !map.has(patient.bedNumber)
      ) {
        map.set(patient.bedNumber, patient);
      }
    });

    return map;
  }, [activePatients, patients]);

  // List of available bed numbers (1-74) with no active patient
  const availableBeds = useMemo(() => {
    const list: number[] = [];
    for (let i = 1; i <= TOTAL_BEDS; i++) {
      const occupant = bedMap.get(i);
      // Available if no patient or patient is discharged/deceased
      if (
        !occupant ||
        occupant.outcome === "cured" ||
        occupant.status === "discharged"
      ) {
        // If it was marked deceased, it might still need sanitization/clearing, but is available if not occupied
        if (occupant?.status !== "deceased" && occupant?.outcome !== "deceased") {
          list.push(i);
        }
      }
    }
    return list;
  }, [bedMap]);

  // Patients awaiting administrative discharge finalization
  const dischargeDeskPatients = useMemo(() => {
    return patients.filter(
      (p) =>
        p.status === "doctor_approved_discharge" &&
        p.outcome === "active"
    );
  }, [patients]);

  // Count categories for legend and summary badges
  const summaryCounts = useMemo(() => {
    let regularOccupied = 0;
    let dischargePending = 0;
    let deceasedBeds = 0;

    for (let i = 1; i <= TOTAL_BEDS; i++) {
      const p = bedMap.get(i);
      if (!p) continue;
      if (p.status === "deceased" || p.outcome === "deceased") {
        deceasedBeds++;
      } else if (
        p.status === "eligible_for_discharge" ||
        p.status === "doctor_approved_discharge"
      ) {
        dischargePending++;
      } else if (p.outcome === "active") {
        regularOccupied++;
      }
    }

    return {
      regularOccupied,
      dischargePending,
      deceasedBeds,
      available: availableBeds.length,
    };
  }, [bedMap, availableBeds]);

  // Combined activity log (from historical patients + session actions)
  const combinedActivityLog = useMemo(() => {
    const historyFromPatients: ActivityItem[] = [];

    patients.forEach((p) => {
      if (p.status === "discharged" || p.outcome === "cured") {
        const dateStr = p.dischargeDate || p.admissionDate;
        historyFromPatients.push({
          id: `hist-discharge-${p.id}`,
          type: "discharge",
          patientName: p.name,
          bedNumber: p.bedNumber,
          timestamp: dateStr
            ? new Date(dateStr).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "Recent",
          note: "Administrative discharge finalized and bed released",
        });
      } else if (p.status === "deceased" || p.outcome === "deceased") {
        const dateStr = p.dischargeDate || p.admissionDate;
        historyFromPatients.push({
          id: `hist-death-${p.id}`,
          type: "death",
          patientName: p.name,
          bedNumber: p.bedNumber,
          timestamp: dateStr
            ? new Date(dateStr).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "Recent",
          note: "Deceased patient recorded by medical staff",
        });
      }
    });

    // Merge session activities (discharges and deaths) with patient history
    const sessionDischargeAndDeaths = sessionActivities.filter(
      (a) => a.type === "discharge" || a.type === "death"
    );
    const all = [...sessionDischargeAndDeaths, ...historyFromPatients];
    // Return last 10 events
    return all.slice(0, 10);
  }, [patients, sessionActivities]);

  // Calculate days admitted safely
  const calculateDaysAdmitted = (dateString?: string): number => {
    if (!dateString) return 1;
    const admission = new Date(dateString);
    if (isNaN(admission.getTime())) return 1;
    const diff = Math.abs(Date.now() - admission.getTime());
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return Math.max(1, days);
  };

  // Format status for display
  const formatStatus = (status: string) => {
    switch (status) {
      case "admitted":
        return { label: "Admitted", bg: "bg-blue-500/20 text-blue-300 border-blue-500/30" };
      case "fever_present":
        return { label: "Fever Present", bg: "bg-red-500/20 text-red-300 border-red-500/30" };
      case "recovering":
        return { label: "Recovering", bg: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" };
      case "eligible_for_discharge":
        return { label: "Discharge Pending", bg: "bg-amber-500/20 text-amber-300 border-amber-500/30" };
      case "doctor_approved_discharge":
        return { label: "Doctor Approved", bg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" };
      case "discharged":
        return { label: "Discharged", bg: "bg-slate-500/20 text-slate-300 border-slate-500/30" };
      case "deceased":
        return { label: "Deceased", bg: "bg-rose-950/40 text-rose-300 border-rose-800/40" };
      default:
        return { label: status, bg: "bg-slate-500/20 text-slate-300 border-slate-500/30" };
    }
  };

  // Get tile color for a bed
  const getBedStatusMeta = (bedNum: number) => {
    const patient = bedMap.get(bedNum);

    if (!patient) {
      return {
        type: "available",
        bg: "bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-600/50 text-emerald-300",
        badge: "Available",
        dotColor: "bg-emerald-400",
      };
    }

    if (patient.status === "deceased" || patient.outcome === "deceased") {
      return {
        type: "deceased",
        bg: "bg-slate-800 hover:bg-slate-700/80 border-slate-600 text-slate-400",
        badge: "Deceased",
        dotColor: "bg-slate-500",
      };
    }

    if (
      patient.status === "eligible_for_discharge" ||
      patient.status === "doctor_approved_discharge"
    ) {
      return {
        type: "pending",
        bg: "bg-amber-950/50 hover:bg-amber-900/70 border-amber-500 text-amber-200 ring-1 ring-amber-500/30",
        badge: "Discharge Pending",
        dotColor: "bg-amber-400 animate-pulse",
      };
    }

    // Default regular occupied
    return {
      type: "occupied",
      bg: "bg-rose-950/50 hover:bg-rose-900/70 border-rose-600 text-rose-200",
      badge: "Occupied",
      dotColor: "bg-rose-500",
    };
  };

  // Handle Finalize Discharge
  const handleFinalizeDischarge = (patient: Patient) => {
    finalizeDischarge(patient.id);
    const successMsg = `Patient discharged. Bed #${patient.bedNumber} is now available.`;
    addToast(successMsg, "success");

    // Add to session timeline
    const newActivity: ActivityItem = {
      id: `act-${Date.now()}-${patient.id}`,
      type: "discharge",
      patientName: patient.name,
      bedNumber: patient.bedNumber,
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      note: `Finalized discharge for ${patient.name}. Bed #${patient.bedNumber} released.`,
    };
    setSessionActivities((prev) => [newActivity, ...prev]);

    // Close popover if this bed was opened
    if (selectedBedNumber === patient.bedNumber) {
      setSelectedBedNumber(null);
    }
  };

  // Handle Record Death
  const handleRecordDeath = (patient: Patient) => {
    if (typeof recordDeath === "function") {
      recordDeath(patient.id);
      addToast(
        `Patient ${patient.name} recorded as deceased. Bed #${patient.bedNumber} marked.`,
        "warning"
      );

      // Add to session timeline
      const newActivity: ActivityItem = {
        id: `act-death-${Date.now()}-${patient.id}`,
        type: "death",
        patientName: patient.name,
        bedNumber: patient.bedNumber,
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        note: `Fatality recorded for ${patient.name}. Bed #${patient.bedNumber} queued for terminal sterilization.`,
      };
      setSessionActivities((prev) => [newActivity, ...prev]);

      if (selectedBedNumber === patient.bedNumber) {
        setSelectedBedNumber(null);
      }
    }
  };

  // Handle Admit New Patient
  const handleAdmitSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isAtMaxCapacity) {
      addToast("Facility is at maximum capacity (74/74 beds occupied)", "error");
      return;
    }

    if (!newPatientName.trim()) {
      addToast("Please enter patient name", "error");
      return;
    }

    const ageNum = parseInt(newPatientAge, 10);
    if (isNaN(ageNum) || ageNum <= 0 || ageNum > 120) {
      addToast("Please enter a valid age (1-120)", "error");
      return;
    }

    const bedNum = parseInt(selectedBedForAdmit, 10);
    if (isNaN(bedNum) || bedNum < 1 || bedNum > TOTAL_BEDS) {
      addToast("Please select a valid available bed", "error");
      return;
    }

    // Verify bed is truly unoccupied
    if (bedMap.has(bedNum)) {
      const occupant = bedMap.get(bedNum);
      if (
        occupant &&
        occupant.outcome === "active" &&
        occupant.status !== "discharged"
      ) {
        addToast(`Bed #${bedNum} is currently occupied by ${occupant.name}`, "error");
        return;
      }
    }

    // Call hook admitPatient
    admitPatient(newPatientName.trim(), ageNum, bedNum);
    addToast(
      `Patient ${newPatientName.trim()} admitted to Bed #${bedNum}.`,
      "success"
    );

    // Record session activity
    const newActivity: ActivityItem = {
      id: `act-${Date.now()}-${bedNum}`,
      type: "admit",
      patientName: newPatientName.trim(),
      bedNumber: bedNum,
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      note: `New patient admitted to Bed #${bedNum}`,
    };
    setSessionActivities((prev) => [newActivity, ...prev]);

    // Reset form
    setNewPatientName("");
    setNewPatientAge("");
    setSelectedBedForAdmit("");
  };

  // Selected bed occupant info
  const selectedOccupant = selectedBedNumber ? bedMap.get(selectedBedNumber) : null;
  const selectedBedMeta = selectedBedNumber ? getBedStatusMeta(selectedBedNumber) : null;

  return (
    <div className="space-y-6 text-slate-100">
      {/* 1. Header Section */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600/20 border border-blue-500/30 p-2.5 rounded-xl text-blue-400">
              <Building size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Administration & Bed Management
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time isolation ward bed grid, capacity control & discharge operations
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Occupancy Badge */}
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-semibold text-sm shadow-sm transition-all ${
                activeOccupancy >= TOTAL_BEDS
                  ? "bg-red-950/70 border-red-600 text-red-300 ring-1 ring-red-500/50"
                  : activeOccupancy >= 60
                  ? "bg-amber-950/70 border-amber-600 text-amber-300 ring-1 ring-amber-500/50"
                  : "bg-emerald-950/70 border-emerald-600 text-emerald-300 ring-1 ring-emerald-500/50"
              }`}
            >
              <BedDouble size={16} />
              <span>
                Occupancy: {activeOccupancy} / {TOTAL_BEDS}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-black/40 font-mono">
                {Math.round((activeOccupancy / TOTAL_BEDS) * 100)}%
              </span>
            </div>

            {/* Quick Available Bed Indicator */}
            <div className="bg-slate-900/60 border border-slate-700 px-3.5 py-2 rounded-lg text-xs flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span className="text-slate-300 font-medium">
                {summaryCounts.available} Beds Available
              </span>
            </div>
          </div>
        </div>

        {/* Capacity Progress Bar */}
        <div className="mt-4 pt-4 border-t border-slate-700/60">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Ward Capacity Utilization</span>
            <span className="font-mono text-slate-300">
              {activeOccupancy} Occupied &bull; {summaryCounts.available} Vacant
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                activeOccupancy >= TOTAL_BEDS
                  ? "bg-red-500"
                  : activeOccupancy >= 60
                  ? "bg-amber-500"
                  : "bg-gradient-to-r from-emerald-500 to-blue-500"
              }`}
              style={{ width: `${Math.min(100, (activeOccupancy / TOTAL_BEDS) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. 74-Bed Visual Grid */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <BedDouble size={18} className="text-blue-400" />
              Isolation Ward Bed Grid (Beds 1 - 74)
            </h3>
            <p className="text-xs text-slate-400">
              Click any tile to inspect occupant details or release beds
            </p>
          </div>

          <div className="text-xs text-slate-400 font-medium">
            Desktop: 10-col grid &bull; Mobile: 5-col grid
          </div>
        </div>

        {/* Visual Bed Grid: 10 cols desktop, 5 cols mobile */}
        <div className="grid grid-cols-5 md:grid-cols-10 gap-2 p-2 bg-slate-900/80 rounded-xl border border-slate-700/50">
          {Array.from({ length: TOTAL_BEDS }, (_, idx) => {
            const bedNum = idx + 1;
            const meta = getBedStatusMeta(bedNum);
            const occupant = bedMap.get(bedNum);
            const isSelected = selectedBedNumber === bedNum;

            return (
              <button
                key={bedNum}
                type="button"
                onClick={() => {
                  setSelectedBedNumber(isSelected ? null : bedNum);
                  // If available bed clicked and admit form empty, prefill bed selection
                  if (meta.type === "available" && !selectedBedForAdmit) {
                    setSelectedBedForAdmit(String(bedNum));
                  }
                }}
                title={
                  occupant
                    ? `Bed #${bedNum}: ${occupant.name} (${formatStatus(occupant.status).label})`
                    : `Bed #${bedNum}: Available`
                }
                className={`relative aspect-square flex flex-col items-center justify-center rounded-lg border text-xs font-semibold transition-all transform active:scale-95 ${
                  meta.bg
                } ${
                  isSelected
                    ? "ring-2 ring-white scale-105 z-10 shadow-lg"
                    : "hover:scale-[1.02]"
                }`}
              >
                {/* Bed Number */}
                <span className="font-mono text-xs font-bold leading-tight">
                  #{bedNum}
                </span>

                {/* Status Dot */}
                <span
                  className={`w-1.5 h-1.5 rounded-full mt-1 ${meta.dotColor}`}
                />

                {/* Mini indicator icon if pending discharge */}
                {meta.type === "pending" && (
                  <span className="absolute top-1 right-1 text-[9px] text-amber-300 font-bold">
                    !
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Color Legend Below Grid */}
        <div className="mt-4 pt-4 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            {/* Available */}
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-emerald-950 border border-emerald-500/80 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              </span>
              <span className="text-slate-300">
                Available{" "}
                <span className="text-emerald-400 font-semibold font-mono">
                  ({summaryCounts.available})
                </span>
              </span>
            </div>

            {/* Occupied */}
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-rose-950 border border-rose-600 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              </span>
              <span className="text-slate-300">
                Occupied{" "}
                <span className="text-rose-400 font-semibold font-mono">
                  ({summaryCounts.regularOccupied})
                </span>
              </span>
            </div>

            {/* Discharge Pending */}
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-amber-950 border border-amber-500 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              </span>
              <span className="text-slate-300">
                Discharge Pending{" "}
                <span className="text-amber-400 font-semibold font-mono">
                  ({summaryCounts.dischargePending})
                </span>
              </span>
            </div>

            {/* Deceased */}
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-slate-800 border border-slate-600 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              </span>
              <span className="text-slate-300">
                Deceased Bed{" "}
                <span className="text-slate-400 font-semibold font-mono">
                  ({summaryCounts.deceasedBeds})
                </span>
              </span>
            </div>
          </div>

          <span className="text-slate-400 text-[11px]">
            *Click a bed tile to view full occupant profile
          </span>
        </div>

        {/* Selected Bed Popover / Inspector Drawer */}
        {selectedBedNumber !== null && (
          <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-slate-700 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 rounded-lg border ${
                    selectedBedMeta?.bg || "bg-slate-800"
                  }`}
                >
                  <BedDouble size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-base">
                      Bed #{selectedBedNumber}
                    </h4>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        selectedBedMeta
                          ? selectedBedMeta.bg
                          : "bg-slate-800 border-slate-700 text-slate-300"
                      }`}
                    >
                      {selectedBedMeta?.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Isolation Zone &bull; Ward Unit {Math.ceil(selectedBedNumber / 10)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedBedNumber(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Close bed details"
              >
                <X size={16} />
              </button>
            </div>

            {selectedOccupant ? (
              <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-800/70 p-2.5 rounded-lg border border-slate-700/60">
                  <span className="text-slate-400 block mb-0.5">Patient Name</span>
                  <span className="font-semibold text-slate-100 text-sm">
                    {selectedOccupant.name}
                  </span>
                  <span className="text-slate-400 text-[11px] block mt-0.5">
                    Age: {selectedOccupant.age} yrs
                  </span>
                </div>

                <div className="bg-slate-800/70 p-2.5 rounded-lg border border-slate-700/60">
                  <span className="text-slate-400 block mb-0.5">Clinical Status</span>
                  {(() => {
                    const statusMeta = formatStatus(selectedOccupant.status);
                    return (
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] border font-medium ${statusMeta.bg}`}
                      >
                        {statusMeta.label}
                      </span>
                    );
                  })()}
                  <span className="text-slate-400 text-[11px] block mt-1">
                    Outcome: {selectedOccupant.outcome}
                  </span>
                </div>

                <div className="bg-slate-800/70 p-2.5 rounded-lg border border-slate-700/60">
                  <span className="text-slate-400 block mb-0.5">Stay Duration</span>
                  <span className="font-semibold text-slate-100 text-sm">
                    {calculateDaysAdmitted(selectedOccupant.admissionDate)} Days Admitted
                  </span>
                  <span className="text-slate-400 text-[11px] block mt-0.5">
                    Fever-free: {selectedOccupant.consecutiveFeverFreeDays ?? 0} days
                  </span>
                </div>

                <div className="flex flex-col justify-center gap-1.5">
                  {selectedOccupant.status === "doctor_approved_discharge" ? (
                    <button
                      type="button"
                      onClick={() => handleFinalizeDischarge(selectedOccupant)}
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all"
                    >
                      <LogOut size={14} />
                      Finalize Discharge
                    </button>
                  ) : selectedOccupant.status === "deceased" ? (
                    <div className="text-center p-2 rounded bg-rose-950/40 text-rose-300 border border-rose-800/50 text-[11px]">
                      Deceased bed marked for terminal sanitization
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <div className="text-center p-1.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px]">
                        Active Patient Under Treatment
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRecordDeath(selectedOccupant)}
                        className="w-full py-1.5 px-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                        title="Record fatality if declared by medical officer"
                      >
                        <Skull size={12} />
                        Record Fatality
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <p className="text-emerald-400">
                  This bed is currently unoccupied, sanitized, and ready for patient admission.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBedForAdmit(String(selectedBedNumber));
                    const admitInput = document.getElementById("admit-name-input");
                    if (admitInput) admitInput.focus();
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center gap-1.5 transition-colors"
                >
                  <UserPlus size={14} />
                  Assign Patient to Bed #{selectedBedNumber}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3 & 4: Two-Column Section (Discharge Desk & Admit New Patient) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 3. Discharge Desk Section (7 Columns on Large) */}
        <div className="lg:col-span-7 bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-lg flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="bg-emerald-600/20 border border-emerald-500/30 p-2 rounded-lg text-emerald-400">
                <LogOut size={18} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Discharge Desk</h3>
                <p className="text-xs text-slate-400">
                  Doctor-approved patients awaiting administrative discharge & bed release
                </p>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 border border-emerald-700 text-emerald-300">
              {dischargeDeskPatients.length} Pending
            </span>
          </div>

          {dischargeDeskPatients.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-900/40 rounded-xl border border-slate-700/40 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-3 border border-slate-700">
                <CheckCircle2 size={24} className="text-emerald-400" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">
                Discharge Desk Queue Clear
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                No patients are currently pending administrative release. Once doctors approve
                eligible patients, they will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-700/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-300 uppercase tracking-wider text-[11px] border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-3">Bed #</th>
                    <th className="py-3 px-3">Patient Name</th>
                    <th className="py-3 px-3">Days Admitted</th>
                    <th className="py-3 px-3">Fever-Free Days</th>
                    <th className="py-3 px-3">Doctor Approval</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 bg-slate-800/40">
                  {dischargeDeskPatients.map((patient) => {
                    const daysAdmitted = calculateDaysAdmitted(patient.admissionDate);
                    return (
                      <tr
                        key={patient.id}
                        className="hover:bg-slate-700/40 transition-colors"
                      >
                        <td className="py-3 px-3 font-mono font-bold text-slate-200">
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                            #{patient.bedNumber}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-100">
                            {patient.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Age: {patient.age} yrs
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">
                          {daysAdmitted} days
                        </td>
                        <td className="py-3 px-3 font-mono text-emerald-400 font-semibold">
                          {patient.consecutiveFeverFreeDays ?? 0} days
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-emerald-950/60 border border-emerald-600 text-emerald-300 font-medium">
                            <CheckCircle2 size={12} />
                            Approved
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleFinalizeDischarge(patient)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md transition-all text-xs"
                          >
                            <LogOut size={13} />
                            Finalize Discharge & Release Bed
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 4. Admit New Patient Section (5 Columns on Large) */}
        <div className="lg:col-span-5 bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="bg-blue-600/20 border border-blue-500/30 p-2 rounded-lg text-blue-400">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Admit New Patient</h3>
                  <p className="text-xs text-slate-400">
                    Register intake and assign an available isolation bed
                  </p>
                </div>
              </div>

              {isAtMaxCapacity && (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-950 text-red-400 border border-red-700">
                  FULL
                </span>
              )}
            </div>

            {/* Capacity Warning Banner if at capacity */}
            {isAtMaxCapacity && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/50 border border-red-700/80 text-red-200 text-xs flex items-center gap-2.5">
                <ShieldAlert size={18} className="text-red-400 shrink-0" />
                <div>
                  <p className="font-semibold text-red-300">
                    Facility at Maximum Capacity
                  </p>
                  <p className="text-red-400/90 text-[11px]">
                    All 74 isolation beds are actively occupied. Admissions are locked until
                    a bed is vacated via discharge desk.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleAdmitSubmit} className="space-y-4">
              {/* Patient Name */}
              <div>
                <label
                  htmlFor="admit-name-input"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Patient Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  id="admit-name-input"
                  type="text"
                  placeholder="e.g., Alex Walker"
                  disabled={isAtMaxCapacity}
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Patient Age */}
              <div>
                <label
                  htmlFor="admit-age-input"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Age (Years) <span className="text-rose-400">*</span>
                </label>
                <input
                  id="admit-age-input"
                  type="number"
                  min="1"
                  max="120"
                  placeholder="e.g., 34"
                  disabled={isAtMaxCapacity}
                  value={newPatientAge}
                  onChange={(e) => setNewPatientAge(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Bed Selection Dropdown (Only available/green beds) */}
              <div>
                <label
                  htmlFor="admit-bed-select"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Assigned Isolation Bed <span className="text-rose-400">*</span>
                </label>
                <select
                  id="admit-bed-select"
                  disabled={isAtMaxCapacity || availableBeds.length === 0}
                  value={selectedBedForAdmit}
                  onChange={(e) => setSelectedBedForAdmit(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {availableBeds.length === 0
                      ? "-- No Beds Available --"
                      : "-- Select an Available Bed --"}
                  </option>
                  {availableBeds.map((bedNum) => (
                    <option key={bedNum} value={bedNum}>
                      Bed #{bedNum} (Zone {Math.ceil(bedNum / 10)})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Only green/unoccupied beds ({availableBeds.length} available) are eligible for assignment.
                </p>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isAtMaxCapacity || availableBeds.length === 0}
                  className={`w-full py-2.5 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all ${
                    isAtMaxCapacity || availableBeds.length === 0
                      ? "bg-slate-800 border border-red-700/60 text-red-400 cursor-not-allowed opacity-90"
                      : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 active:scale-[0.99]"
                  }`}
                >
                  {isAtMaxCapacity || availableBeds.length === 0 ? (
                    <>
                      <AlertCircle size={15} className="text-red-400" />
                      <span>Facility at Maximum Capacity</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={15} />
                      <span>Admit Patient</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-700/60 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Ward standard intake protocol active</span>
            <span className="font-mono text-emerald-400">
              {availableBeds.length} Vacancies
            </span>
          </div>
        </div>
      </div>

      {/* 5. Recent Activity Log */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-slate-700/60 border border-slate-600/60 p-2 rounded-lg text-slate-300">
              <Clock size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Recent Activity Log</h3>
              <p className="text-xs text-slate-400">
                Timeline audit trail of the last 10 discharges, bed reallocations, and fatalities
              </p>
            </div>
          </div>

          <span className="text-xs text-slate-400">
            Audit Retention: Last 10 records
          </span>
        </div>

        {combinedActivityLog.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-700/40">
            <Clock size={24} className="mx-auto text-slate-500 mb-2" />
            <p className="text-xs text-slate-400">
              No recent administrative activities recorded. Discharges and updates will appear here.
            </p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-700">
            {combinedActivityLog.map((activity) => (
              <div
                key={activity.id}
                className="relative flex items-start justify-between gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-700/50 hover:border-slate-600 transition-colors"
              >
                {/* Timeline node icon */}
                <div
                  className={`absolute -left-[27px] top-3.5 w-6 h-6 rounded-full flex items-center justify-center border text-[11px] ${
                    activity.type === "discharge"
                      ? "bg-emerald-950 border-emerald-500 text-emerald-400"
                      : activity.type === "death"
                      ? "bg-rose-950 border-rose-600 text-rose-400"
                      : "bg-blue-950 border-blue-500 text-blue-400"
                  }`}
                >
                  {activity.type === "discharge" ? (
                    <LogOut size={12} />
                  ) : activity.type === "death" ? (
                    <Skull size={12} />
                  ) : (
                    <UserPlus size={12} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-200 text-xs">
                      {activity.patientName}
                    </span>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                      Bed #{activity.bedNumber}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider ${
                        activity.type === "discharge"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : activity.type === "death"
                          ? "bg-rose-950 text-rose-300 border border-rose-800"
                          : "bg-blue-950 text-blue-300 border border-blue-800"
                      }`}
                    >
                      {activity.type === "discharge"
                        ? "Discharge"
                        : activity.type === "death"
                        ? "Fatality"
                        : "Admission"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mt-1">
                    {activity.note}
                  </p>
                </div>

                <div className="text-[11px] text-slate-400 font-mono whitespace-nowrap shrink-0 flex items-center gap-1">
                  <Clock size={11} />
                  {activity.timestamp}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
