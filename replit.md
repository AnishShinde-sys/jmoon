# Budbase Project - Replit Setup

## Project Overview
Budbase is a modern agricultural data management platform for precision farming, vineyard management, and crop monitoring.

## Current Status
**⚠️ Repository Status**: This GitHub repository currently contains only documentation (README.md). The actual application code described in the README has not yet been committed to the repository.

According to the README, the planned architecture includes:
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Auth**: Supabase (authentication only)
- **Backend**: Google Cloud Run (Express + TypeScript)
- **Data Storage**: Google Cloud Storage (JSON files)
- **Maps**: Mapbox GL JS + Turf.js

## Expected Directory Structure
```
Budbase/
├── frontend/          # React + TypeScript frontend (NOT YET IN REPO)
├── backend/           # Google Cloud Run API (NOT YET IN REPO)
├── functions/         # Cloud Functions v2 (NOT YET IN REPO)
├── infra/             # Infrastructure & deployment (NOT YET IN REPO)
└── docs/              # Documentation (NOT YET IN REPO)
```

## Next Steps
To get this project running in Replit, the repository owner needs to:
1. Push the frontend code to the GitHub repository
2. Push any backend code if available
3. Include necessary configuration files (package.json, etc.)

Once the actual code is available in the repository, the Replit setup will include:
- Installing Node.js and dependencies
- Configuring the Vite dev server to run on port 5000 with host 0.0.0.0
- Setting up environment variables for Supabase and backend API
- Configuring deployment settings

## Date
Setup attempted: October 25, 2025
