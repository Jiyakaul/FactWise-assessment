# BioCare Quarantine & Treatment Facility Portal
> **Assessment: Technical Product Manager** | FactWise  
> Candidate: **Jiya Kaul**  
> Submission Document: [`Jiya Kaul TPM.pdf`](./Jiya%20Kaul%20TPM.pdf)

---

## 🏥 Operational Problem Context
A specialized 74-bed viral quarantine and treatment facility is operating at maximum occupancy. The virus has a **15% expected mortality benchmark**, and patients are considered cured once they achieve **3 consecutive full days fever-free** (< 100.4°F). 

Current operational bottlenecks:
1. **Unsynchronized Rounds:** Doctors visit patients before nurses measure temperatures, wasting precious physician time.
2. **Discharge Delays:** Recovered patients stay an extra 1–2 days due to paper transcription and delayed communication to admin.
3. **Missing Metrics:** No real-time tracking against the 15% mortality rate benchmark or the 85% success/cure rate.

---

## 🚀 Live Demo & Repository Structure
- **Framework:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Visualization:** Recharts (temperature trend sparklines, outcome distribution pie chart, status breakdown bar chart)
- **Icons:** Lucide React
- **Architecture:** Client-side React Context (`lib/data.tsx`) with optimistic updates and comprehensive mock dataset covering all 74 beds.

---

## 📋 Assessment Answers Summary

### Q1: User Types & Action Mapping
The portal provides four dedicated, role-based interfaces:
1. **Nurse Station:** Daily vitals round list (`Needs Check Today` vs `Completed Today`), temperature recording modal with physiological validation and color coding, and automatic fever-free day counter.
2. **Doctor Rounds & Clinical Review:** Sequential queue prioritizing patients whose vitals have been recorded today, 7-day temperature trend sparklines with 100.4°F threshold markers, progress notes, and 1-click discharge sign-off (unlocked only after 3 consecutive fever-free days).
3. **Admin & Bed Management:** Interactive visual matrix of all 74 beds (color-coded by Occupied, Discharge Pending, and Available), discharge desk to finalize departures and free beds, patient intake form with strict 74-bed capacity validation, and mortality recording.
4. **Head Doctor / Medical Director Analytics:** Real-time benchmarking against the 15% mortality threshold (with automated flashing critical alarm banner if exceeded), 85% cure rate benchmark, rolling Average Length of Stay (ALOS), and shift compliance progress bars.

### Q3: Logical Constraints & Developer Specifications
- **Nurse-First Sequential Workflow:** Flags reset at `00:00:00`. If a doctor opens a patient without nurse vitals, a warning is displayed with an optional vitals intake that logs the reading as `recordedBy: "doctor"`.
- **Strict 3-Day Fever-Free Cure Rule:** Any reading $\ge 100.4^\circ\text{F}$ strictly resets the consecutive streak to Day 0. Discharge approval is disabled until streak $\ge 3$.
- **Two-Stage Discharge Handoff:** Doctor signs medical discharge order $\rightarrow$ Admin finalizes logistical checkout and releases the bed.
- **Capacity Ceiling:** Hard ceiling at 74 active patients. New admissions are blocked when active patients = 74.
- **Closed-Cases Formula:**
  $$\text{Mortality Rate} = \frac{\text{Total Deceased}}{\text{Discharged Cured} + \text{Deceased}} \times 100$$
  $$\text{Cure Rate} = \frac{\text{Discharged Cured}}{\text{Discharged Cured} + \text{Deceased}} \times 100$$

### Q4: Sprint Planning Mathematical Knapsack Solution
- **Velocity:** 25 Story Points (SP). Committed: $3 \times 5 = 15\text{ SP}$. **Available Capacity:** **10 SP**.
- **Value Formula:** Low = 1, Medium = 3, High = 6.
- **Greedy High-First Selection:** {A, B, C, F} = 10 SP for 21 Value Units (0 buffer).
- **Optimal Knapsack Selection:** **{A, B, D, F, G, H, I, J}** = **8.3 SP for 22 Value Units** (1.7 SP buffer).
- **Conclusion:** Selecting {A, B, D, F, G, H, I, J} maximizes business value (22 units, beating all other combinations) while saving 1.7 story points of effort.

---

## 🧪 Interactive Prototype Test Scenarios
The application includes pre-configured mock data for evaluators:
1. **Nurse Temperature Check (Bed 5, 12, or 28):** Pre-configured with exactly 2 fever-free days. Recording a normal temp (< 100.4°F) increments the counter to 3/3 and automatically triggers "Eligible for Discharge".
2. **Doctor Discharge Sign-Off (Bed 40):** Pre-configured with 3 fever-free days. The "Sign Discharge Order" button is enabled with a green pulse animation.
3. **Admin Bed Release (Bed 55):** Doctor has already approved discharge. In Admin View $\rightarrow$ Discharge Desk, click "Finalize Discharge & Release Bed" to immediately vacate Bed 55 on the 74-bed matrix.
4. **Capacity Enforcement:** The 74-bed grid dynamically updates in real time.

---

## 🛠️ Local Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Run development server
npm run dev

# 3. Open in browser
http://localhost:3000

# 4. Production build test
npm run build
```

---

## 🌐 Deploy to Vercel
Deploy in one command using the Vercel CLI:
```bash
npx vercel
```
Or import this repository directly into [Vercel](https://vercel.com) with standard Next.js settings.
