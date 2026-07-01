# NRCC Power Plant Dashboard

Operations dashboard for equipment status, running hours, and maintenance tracking.
React + Vite + Tailwind, backed by Supabase.

## Run locally
```bash
npm install
npm run dev
```
Open the printed localhost URL. The `.env` file already holds the Supabase URL
and publishable key.

## Build
```bash
npm run build      # outputs to dist/
npm run preview    # preview the production build
```

## Structure
- `src/lib/supabase.js` — Supabase client
- `src/lib/hooks.js` — data hooks for the dashboard views
- `src/components/` — Layout (sidebar) + shared UI primitives
- `src/pages/Dashboard.jsx` — Plant Status home (built)
- `src/pages/{Equipment,Maintenance,DataGaps}.jsx` — stubs for later phases

## Notes
- Routing uses HashRouter for GitHub Pages compatibility.
- Dashboard reads from views: v_equipment_current_status, v_maintenance_due, v_data_gaps.
- Dev-stage: anon read access is enabled on the DB so data renders before the
  shared login is wired. Tighten this when auth is added.
