# Headache Tracker — Bilingual 3D Headache & Migraine Diary

<p align="center">
  <a href="https://headache-tracker-platform.vercel.app/" target="_blank">
    <img src="https://img.shields.io/badge/Live%20Demo-Vercel-black?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" />
  </a>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Three.js-3D%20Mapping-black?style=for-the-badge&logo=three.js&logoColor=white" alt="Three.js" />
  <img src="https://img.shields.io/badge/Supabase-Auth%20%26%20DB-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Bilingual-EN%20%2F%20AR-blue?style=for-the-badge" alt="Bilingual" />
</p>

<p align="center">
  A mobile-first, clinical-grade headache and migraine diary designed to help individuals understand pain patterns and communicate clearly with healthcare providers. Built with interactive 3D anatomy mapping, pattern estimation, intelligent symptom logging, and exportable medical reports.
</p>

---

## 🌐 Live Application

- **Production URL:** [https://headache-tracker-platform.vercel.app/](https://headache-tracker-platform.vercel.app/)
- **Deployment Platform:** Vercel
- **Database & Auth:** Supabase (PostgreSQL with Row Level Security)

---

## 📸 Screenshots

<p align="center">
  <img src="docs/screenshots/headache-tracker-landing.png" alt="Headache Tracker Welcome & Sign-in" width="32%" />
  <img src="docs/screenshots/headache-tracker-dashboard.png" alt="Headache Tracker Dashboard" width="32%" />
  <img src="docs/screenshots/headache-tracker-logger.png" alt="Interactive Pain & Symptom Logger" width="32%" />
</p>

---

## ✨ Key Features

- **🧠 Interactive 3D Head Mapping:** Built with Three.js to let users rotate a 3D anatomical model and pinpoint exact pain zones (forehead, temples, crown, occipital, behind eyes, neck).
- **📈 Intensity & Duration Progression:** Record initial pain severity, ongoing fluctuations, and resolution time with interactive visual timelines.
- **💊 Treatment & Medication Tracking:** Log pharmaceuticals, natural remedies, and rest periods alongside dosage and response latency.
- **📊 Predictive Patterns & Trend Insights:** Data-driven pattern analysis showing recurring weekly spikes, duration medians, and common triggers.
- **📄 Clinical PDF Reports:** Generate clean, structured PDF summaries ready to be shared with neurologists or primary care physicians.
- **🌐 Full Bilingual Experience:** Instant seamless toggle between English (LTR) and Arabic (RTL) across all views.
- **⚡ Zero-Friction Guest Mode:** Explore all features with localized sample data without mandatory authentication.
- **🔒 Private & Secure:** End-to-end data isolation protected by Supabase Row Level Security (RLS) policies.

---

## 🏗️ Architecture Overview

```mermaid
flowchart TD
    Client[Client Device / Browser] -->|HTTPS| VercelApp[Vercel: Vite + React 18 + TypeScript]
    VercelApp --> ThreeJS[Three.js / React Three Fiber: 3D Head Anatomy]
    VercelApp --> Recharts[Recharts: Pain Fluctuations & Histograms]
    VercelApp --> PDFGen[jsPDF: Clinical Medical Reports]
    VercelApp -->|Auth & Data Storage| Supabase[(Supabase Cloud: PostgreSQL + RLS)]
    VercelApp -->|Offline / Demo| LocalStorage[Browser LocalStorage Engine]
```

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend Framework** | React 18, TypeScript, Vite |
| **3D Graphics & Canvas** | Three.js, `@react-three/fiber`, `@react-three/drei` |
| **UI Components & Motion** | Tailwind CSS, Lucide React, Framer Motion |
| **Data Visualization** | Recharts |
| **Document Generation** | jsPDF, html2canvas |
| **Backend & Authentication** | Supabase (PostgreSQL, Row Level Security, Magic Link & Google OAuth) |
| **Hosting & CI/CD** | Vercel |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or pnpm

### 1. Clone the repository
```bash
git clone https://github.com/Waelkun/headache-tracker.git
cd headache-tracker
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup environment variables
Copy the example configuration:
```bash
cp .env.example .env.local
```

Set your Supabase credentials in `.env.local`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

### 4. Start development server
```bash
npm run dev
```

### 5. Run tests & production build
```bash
npm test
npm run build
```

---

## ⚠️ Medical Disclaimer

This application is an educational logging and pattern-recognition tool. It does not provide medical diagnoses or replace consultations with licensed healthcare professionals.

---

## 📄 License

Maintained by [Waelkun](https://github.com/Waelkun). All rights reserved.
