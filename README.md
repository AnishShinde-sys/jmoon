# Budbase Developer Guide

Budbase is a full-stack platform for managing farms, blocks, datasets, and geospatial workflows. This README captures the essentials for working on the project locally and tracks day-to-day UI/logic tweaks.

## Workspace Layout

| Path | Description |
| --- | --- |
| `frontend/` | Next.js 14 application powering the dashboard and marketing pages. |
| `backend/` | Express + TypeScript API that orchestrates GCS storage, dataset processing, and notifications. |
| `firebase.json` | Firebase hosting/config stub (for reference). |

## Quick Start

1. **Install dependencies**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
2. **Run the backend**
   ```bash
   cd backend
   npm run watch
   ```
   Set `GOOGLE_APPLICATION_CREDENTIALS` and `GCS_BUCKET_NAME` in your shell for local testing.
3. **Run the frontend**
   ```bash
   cd frontend
   npm run dev
   ```
   The app is available at `http://localhost:3000`.

## Change Log

> Each entry captures UI/logic updates that matter to other contributors.

### 2025-11-01

- **CSV uploads**: Reworked `fileProcessor.processCSV` to build GeoJSON features without relying on `csv2geojson`, fixing the "Automatic processing failed" regressions for files such as `mac02 (ucce).csv`.
- **Map highlighting**: Added `setPaintProperty` helper in `useMap` and updated the block list to highlight the selected block immediately, removing stale layer artifacts.

### 2025-10-31 (historical)

- Baseline setup of backend Express services, GCS storage helpers, and Next.js dashboard.

---

Need to capture another tweak? Append it to the **Change Log** section (newer dates first) and include a short note about why it matters.

