# Headache Tracker

A bilingual Arabic/English, mobile-first headache diary built with React, TypeScript, Vite, Supabase, Three.js, and Recharts. It supports an interactive 3D head map, intensity changes over time, reusable multi-treatment logging, pattern estimates, PDF reports, and AI answers with the responding provider shown below each result.

## Run locally

1. Copy `.env.example` to `.env.local` and add the Supabase project URL and publishable key.
2. Run `npm install`.
3. Run `npm run dev`.

The sign-in screen includes a guest demo with local sample data. Guest changes stay in that browser and are deleted when the user exits the demo.

## Production setup

- Deploy the Vite project to Vercel.
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to Vercel.
- Complete [Supabase auth and AI setup](docs/SUPABASE_AUTH_SETUP.md).
- Add the final Vercel URL to the Supabase Auth redirect allow list.

## Checks

- `npm test`
- `npm run build`

The tracker presents pattern estimates and self-recorded summaries. It does not diagnose headaches or replace medical care.
