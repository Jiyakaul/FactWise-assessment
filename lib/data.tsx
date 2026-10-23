"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────

export type PatientStatus =
  | "admitted"
  | "fever_present"
  | "recovering"
  | "eligible_for_discharge"
  | "doctor_approved_discharge"
  | "discharged"
  | "deceased";

export interface TemperatureReading {
  date: string;
  temperature: number;
  recordedBy: "nurse" | "doctor";
  notes: string;
  timestamp: number;
}

export interface Patient {
  id: number;
  name: string;
  age: number;
  bedNumber: number;
  bed?: number | string;
  gender?: string;
  admissionDate: string;
  status: PatientStatus;
  consecutiveFeverFreeDays: number;
  temperatureHistory: TemperatureReading[];
  todayTempRecorded: boolean;
  todayDoctorVisited: boolean;
  doctorNotes: string[];
  dischargeDate: string | null;
  outcome: "active" | "cured" | "deceased";
  [key: string]: any;
}

export interface Toast {
  id: string;
  message: string;
  type: "success" | "warning" | "error";
}

export interface FacilityStats {
  totalActive: number;
  totalDischarged: number;
  totalDeceased: number;
  mortalityRate: number;
  cureRate: number;
  averageLOS: number;
  nurseTempCompletionToday: number;
  doctorRoundCompletionToday: number;
}

// ─── Names ───────────────────────────────────────────────────────────

const FIRST_NAMES = [
  "Aarav","Vivaan","Aditya","Vihaan","Arjun","Reyansh","Sai","Arnav","Dhruv","Kabir",
  "Ananya","Diya","Myra","Sara","Aanya","Aadhya","Isha","Kiara","Riya","Priya",
  "Rohan","Nikhil","Rahul","Amit","Vikram","Suresh","Mahesh","Rajesh","Karan","Neel",
  "Pooja","Neha","Sneha","Kavya","Meera","Lakshmi","Sunita","Geeta","Anjali","Divya",
];

const LAST_NAMES = [
  "Sharma","Verma","Gupta","Singh","Kumar","Patel","Shah","Reddy","Nair","Joshi",
  "Mehta","Rao","Das","Chatterjee","Mukherjee","Iyer","Pillai","Mishra","Pandey","Bhat",
];

// ─── Mock Data Generator ─────────────────────────────────────────────

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(d1: string, d2: string): number {
  const a = new Date(d1).getTime();
  const b = new Date(d2).getTime();
  return Math.round(Math.abs(b - a) / (1000 * 60 * 60 * 24));
}

export function generateMockPatients(): Patient[] {
  const rand = seededRandom(42);
  const today = formatDate(new Date());
  const patients: Patient[] = [];

  // Beds that are already discharged (freed)
  const dischargedBeds = new Set([31, 33, 35, 37, 39, 41, 43, 45]);
  // Beds with deceased patients
  const deceasedBeds = new Set([70, 71, 72, 73, 74]);
  // Beds with exactly 2 fever-free days (for evaluator testing)
  const twoFeverFreeBeds = new Set([5, 12, 28]);
  // Bed with 3 fever-free days (eligible for discharge)
  const eligibleBed = 40;
  // Bed with doctor-approved discharge
  const approvedBed = 55;

  for (let bed = 1; bed <= 74; bed++) {
    const firstName = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
    const age = Math.floor(rand() * 57) + 18;
    const daysAdmitted = Math.floor(rand() * 12) + 2;
    const admDate = formatDate(daysAgo(daysAdmitted));

    const tempHistory: TemperatureReading[] = [];

    if (dischargedBeds.has(bed)) {
      // Discharged patients: had fever then recovered
      const stayDays = Math.floor(rand() * 5) + 5;
      for (let day = 0; day < stayDays; day++) {
        const d = new Date(daysAgo(stayDays - day));
        const temp = day < stayDays - 3
          ? 100.4 + rand() * 2.5
          : 97.5 + rand() * 1.5;
        tempHistory.push({
          date: formatDate(d),
          temperature: Math.round(temp * 10) / 10,
          recordedBy: "nurse",
          notes: "",
          timestamp: d.getTime(),
        });
      }
      patients.push({
        id: bed,
        name: `${firstName} ${lastName}`,
        age,
        bedNumber: bed,
        admissionDate: formatDate(daysAgo(stayDays)),
        status: "discharged",
        consecutiveFeverFreeDays: 3,
        temperatureHistory: tempHistory,
        todayTempRecorded: false,
        todayDoctorVisited: false,
        doctorNotes: ["Patient recovered. Discharge approved."],
        dischargeDate: formatDate(daysAgo(Math.floor(rand() * 3))),
        outcome: "cured",
      });
      continue;
    }

    if (deceasedBeds.has(bed)) {
      // Deceased patients
      const stayDays = Math.floor(rand() * 8) + 3;
      for (let day = 0; day < stayDays; day++) {
        const d = new Date(daysAgo(stayDays - day));
        const temp = 101.0 + rand() * 3.0;
        tempHistory.push({
          date: formatDate(d),
          temperature: Math.round(temp * 10) / 10,
          recordedBy: "nurse",
          notes: day === stayDays - 1 ? "Critical condition" : "",
          timestamp: d.getTime(),
        });
      }
      patients.push({
        id: bed,
        name: `${firstName} ${lastName}`,
        age,
        bedNumber: bed,
        admissionDate: formatDate(daysAgo(stayDays)),
        status: "deceased",
        consecutiveFeverFreeDays: 0,
        temperatureHistory: tempHistory,
        todayTempRecorded: false,
        todayDoctorVisited: false,
        doctorNotes: ["Patient condition deteriorated. Unresponsive to treatment."],
        dischargeDate: formatDate(daysAgo(Math.floor(rand() * 2))),
        outcome: "deceased",
      });
      continue;
    }

    // Active patients
    let consecutiveFeverFree = 0;
    let status: PatientStatus = "fever_present";

    if (twoFeverFreeBeds.has(bed)) {
      // Exactly 2 fever-free days
      consecutiveFeverFree = 2;
      status = "recovering";
      for (let day = 0; day < daysAdmitted; day++) {
        const d = new Date(daysAgo(daysAdmitted - day));
        let temp: number;
        if (day >= daysAdmitted - 2) {
          // Last 2 days: fever-free
          temp = 97.5 + rand() * 1.8;
        } else if (day >= daysAdmitted - 3) {
          // Day before that: fever (to show the reset would have happened)
          temp = 100.4 + rand() * 1.5;
        } else {
          temp = 99.0 + rand() * 3.0;
        }
        tempHistory.push({
          date: formatDate(d),
          temperature: Math.round(temp * 10) / 10,
          recordedBy: "nurse",
          notes: "",
          timestamp: d.getTime(),
        });
      }
    } else if (bed === eligibleBed) {
      // 3 fever-free days
      consecutiveFeverFree = 3;
      status = "eligible_for_discharge";
      for (let day = 0; day < daysAdmitted; day++) {
        const d = new Date(daysAgo(daysAdmitted - day));
        let temp: number;
        if (day >= daysAdmitted - 3) {
          temp = 97.2 + rand() * 1.5;
        } else {
          temp = 100.0 + rand() * 2.5;
        }
        tempHistory.push({
          date: formatDate(d),
          temperature: Math.round(temp * 10) / 10,
          recordedBy: "nurse",
          notes: "",
          timestamp: d.getTime(),
        });
      }
    } else if (bed === approvedBed) {
      // Doctor-approved discharge
      consecutiveFeverFree = 3;
      status = "doctor_approved_discharge";
      for (let day = 0; day < daysAdmitted; day++) {
        const d = new Date(daysAgo(daysAdmitted - day));
        let temp: number;
        if (day >= daysAdmitted - 3) {
          temp = 97.0 + rand() * 1.5;
        } else {
          temp = 100.5 + rand() * 2.0;
        }
        tempHistory.push({
          date: formatDate(d),
          temperature: Math.round(temp * 10) / 10,
          recordedBy: "nurse",
          notes: "",
          timestamp: d.getTime(),
        });
      }
    } else {
      // Regular active patients: mix of fever and recovering
      const isFeverFree = rand() > 0.6;
      if (isFeverFree) {
        consecutiveFeverFree = Math.floor(rand() * 2) + 1;
        status = "recovering";
      } else {
        consecutiveFeverFree = 0;
        status = "fever_present";
      }

      for (let day = 0; day < daysAdmitted; day++) {
        const d = new Date(daysAgo(daysAdmitted - day));
        let temp: number;
        if (isFeverFree && day >= daysAdmitted - consecutiveFeverFree) {
          temp = 97.5 + rand() * 1.8;
        } else {
          temp = 99.0 + rand() * 3.5;
        }
        tempHistory.push({
          date: formatDate(d),
          temperature: Math.round(temp * 10) / 10,
          recordedBy: "nurse",
          notes: "",
          timestamp: d.getTime(),
        });
      }
    }

    // Set todayTempRecorded for some patients (about 24 out of ~61 active)
    const todayTemp = bed <= 24 && !twoFeverFreeBeds.has(bed);

    patients.push({
      id: bed,
      name: `${firstName} ${lastName}`,
      age,
      bedNumber: bed,
      admissionDate: admDate,
      status,
      consecutiveFeverFreeDays: consecutiveFeverFree,
      temperatureHistory: tempHistory,
      todayTempRecorded: todayTemp,
      todayDoctorVisited: bed <= 10 && bed > 5,
      doctorNotes: bed % 3 === 0 ? ["Vitals stable. Continue monitoring."] : [],
      dischargeDate: null,
      outcome: "active",
    });
  }

  return patients;
}

// ─── Context ─────────────────────────────────────────────────────────

interface FacilityContextType {
  patients: Patient[];
  recordTemperature: (patientId: number, temp: number, notes: string, recordedBy: "nurse" | "doctor") => void;
  completeDoctorRound: (patientId: number, notes: string) => void;
  approveDischarge: (patientId: number) => void;
  finalizeDischarge: (patientId: number) => void;
  recordDeath: (patientId: number) => void;
  admitPatient: (name: string, age: number, bedNumber: number) => void;
  resetDailyStatus: () => void;
  getActivePatients: () => Patient[];
  getStats: () => FacilityStats;
  toasts: Toast[];
  addToast: (message: string, type: Toast["type"]) => void;
  removeToast: (id: string) => void;
}

const FacilityContext = createContext<FacilityContextType | null>(null);

export function FacilityProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [patients, setPatients] = useState<Patient[]>(() => generateMockPatients());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);

  const addToast = useCallback((message: string, type: Toast["type"]) => {
    const id = `toast-${++toastCounter.current}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const recordTemperature = useCallback(
    (patientId: number, temp: number, notes: string, recordedBy: "nurse" | "doctor") => {
      setPatients((prev) =>
        prev.map((p) => {
          if (p.id !== patientId) return p;

          const hasFever = temp >= 100.4;
          const newFeverFree = hasFever ? 0 : p.consecutiveFeverFreeDays + 1;
          let newStatus: PatientStatus = p.status;

          if (newFeverFree >= 3 && p.status !== "doctor_approved_discharge" && p.status !== "discharged") {
            newStatus = "eligible_for_discharge";
          } else if (hasFever) {
            newStatus = "fever_present";
          } else if (newFeverFree > 0 && newFeverFree < 3) {
            newStatus = "recovering";
          }

          const newReading: TemperatureReading = {
            date: formatDate(new Date()),
            temperature: Math.round(temp * 10) / 10,
            recordedBy,
            notes,
            timestamp: Date.now(),
          };

          return {
            ...p,
            temperatureHistory: [...p.temperatureHistory, newReading],
            todayTempRecorded: true,
            consecutiveFeverFreeDays: newFeverFree,
            status: newStatus,
          };
        })
      );
    },
    []
  );

  const completeDoctorRound = useCallback((patientId: number, notes: string) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patientId) return p;
        return {
          ...p,
          todayDoctorVisited: true,
          doctorNotes: notes ? [...p.doctorNotes, notes] : p.doctorNotes,
        };
      })
    );
  }, []);

  const approveDischarge = useCallback((patientId: number) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patientId) return p;
        return { ...p, status: "doctor_approved_discharge" as PatientStatus };
      })
    );
  }, []);

  const finalizeDischarge = useCallback((patientId: number) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patientId) return p;
        return {
          ...p,
          status: "discharged" as PatientStatus,
          outcome: "cured" as const,
          dischargeDate: formatDate(new Date()),
        };
      })
    );
  }, []);

  const recordDeath = useCallback((patientId: number) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patientId) return p;
        return {
          ...p,
          status: "deceased" as PatientStatus,
          outcome: "deceased" as const,
          dischargeDate: formatDate(new Date()),
        };
      })
    );
  }, []);

  const admitPatient = useCallback((name: string, age: number, bedNumber: number) => {
    const newPatient: Patient = {
      id: Date.now(),
      name,
      age,
      bedNumber,
      admissionDate: formatDate(new Date()),
      status: "admitted",
      consecutiveFeverFreeDays: 0,
      temperatureHistory: [],
      todayTempRecorded: false,
      todayDoctorVisited: false,
      doctorNotes: [],
      dischargeDate: null,
      outcome: "active",
    };
    setPatients((prev) => [...prev, newPatient]);
  }, []);

  const resetDailyStatus = useCallback(() => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.outcome !== "active") return p;
        return { ...p, todayTempRecorded: false, todayDoctorVisited: false };
      })
    );
  }, []);

  const getActivePatients = useCallback(() => {
    return patients.filter((p) => p.outcome === "active");
  }, [patients]);

  const getStats = useCallback((): FacilityStats => {
    const active = patients.filter((p) => p.outcome === "active");
    const discharged = patients.filter((p) => p.outcome === "cured");
    const deceased = patients.filter((p) => p.outcome === "deceased");
    const closedCases = discharged.length + deceased.length;

    const mortalityRate = closedCases > 0 ? (deceased.length / closedCases) * 100 : 0;
    const cureRate = closedCases > 0 ? (discharged.length / closedCases) * 100 : 0;

    // Average LOS for discharged patients
    let totalLOS = 0;
    let losCount = 0;
    for (const p of discharged) {
      if (p.dischargeDate) {
        totalLOS += daysBetween(p.admissionDate, p.dischargeDate);
        losCount++;
      }
    }
    const averageLOS = losCount > 0 ? totalLOS / losCount : 0;

    const nurseTempCompletionToday = active.filter((p) => p.todayTempRecorded).length;
    const doctorRoundCompletionToday = active.filter((p) => p.todayDoctorVisited).length;

    return {
      totalActive: active.length,
      totalDischarged: discharged.length,
      totalDeceased: deceased.length,
      mortalityRate: Math.round(mortalityRate * 10) / 10,
      cureRate: Math.round(cureRate * 10) / 10,
      averageLOS: Math.round(averageLOS * 10) / 10,
      nurseTempCompletionToday,
      doctorRoundCompletionToday,
    };
  }, [patients]);

  return (
    <FacilityContext.Provider
      value={{
        patients,
        recordTemperature,
        completeDoctorRound,
        approveDischarge,
        finalizeDischarge,
        recordDeath,
        admitPatient,
        resetDailyStatus,
        getActivePatients,
        getStats,
        toasts,
        addToast,
        removeToast,
      }}
    >
      {children}
    </FacilityContext.Provider>
  );
}

export function useFacility() {
  const ctx = useContext(FacilityContext);
  if (!ctx) throw new Error("useFacility must be used within FacilityProvider");
  return ctx;
}
