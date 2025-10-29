# Budbase Deployment Guide

## Overview
This guide will walk you through deploying:
1. **Backend** → Google Cloud Run
2. **Frontend** → Firebase Hosting

## Prerequisites
- Google Cloud Project with billing enabled
- Firebase project (can use same GCP project)
- Google Cloud Storage bucket created (`budbase-app-data`)
- Supabase project with credentials

## Part 1: Deploy Backend to Cloud Run

### Option A: Using Google Cloud Console (Recommended - No CLI needed)

1. **Navigate to Cloud Run**
   - Go to https://console.cloud.google.com/run
   - Make sure your project is selected in the top dropdown

2. **Create New Service**
   - Click "CREATE SERVICE"
   - Select "Continuously deploy from a source repository"

3. **Set Up Cloud Build**
   - Click "SET UP WITH CLOUD BUILD"
   - Connect your repository (GitHub, GitLab, or Bitbucket)
   - Select repository and branch
   - Build type: Dockerfile
   - Dockerfile path: `backend/Dockerfile`
   - Click "SAVE"

4. **Configure Service**
   - **Service name**: `budbase-api`
   - **Region**: Choose closest to your users (e.g., `us-central1`)
   - **CPU allocation**: "CPU is only allocated during request processing"
   - **Minimum instances**: 0
   - **Maximum instances**: 10
   - **Ingress**: "Allow all traffic"
   - **Authentication**: "Allow unauthenticated invocations" (we handle auth in the app)

5. **Set Environment Variables**
   Click "CONTAINER, VARIABLES & SECRETS, CONNECTIONS" → "VARIABLES & SECRETS" tab

   Add these environment variables:
   ```
   NODE_ENV=production
   PORT=8080
   SUPABASE_URL=https://lvbniygebpfqxvlxcuhs.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2Ym5peWdlYnBmcXh2bHhjdWhzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTM5MjUzNywiZXhwIjoyMDc2OTY4NTM3fQ.ZNVeHCCoHz-XQoLpLWEJlSCpeGNBNi46a-NWo1kJuWo
   SUPABASE_JWT_SECRET=xhw10hkXi9CaHAdMf2u/QctfM0KWzaIMT6nZ4KKhf+clbHUfVff4Xt61DSrLwANfM/AUKUJc/zr13Lur7MWzzA==
   GCS_BUCKET_NAME=budbase-app-data
   GCP_PROJECT_ID=your-gcp-project-id
   CORS_ORIGIN=*
   ```

   **Important**: Update `GCP_PROJECT_ID` with your actual project ID

6. **Grant Cloud Storage Access**
   - After deployment, go to "PERMISSIONS" tab
   - Find the service account (looks like `123456789-compute@developer.gserviceaccount.com`)
   - Go to [IAM & Admin](https://console.cloud.google.com/iam-admin/iam)
   - Find that service account and click edit
   - Add role: "Storage Object Admin"
   - Save

7. **Deploy**
   - Click "CREATE"
   - Wait for deployment (5-10 minutes)
   - Copy the service URL (e.g., `https://budbase-api-xxxxx-uc.a.run.app`)

### Option B: Using gcloud CLI (if you have it installed)

```bash
cd Budbase/backend

# Build and deploy
gcloud run deploy budbase-api \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,PORT=8080,SUPABASE_URL=https://lvbniygebpfqxvlxcuhs.supabase.co,SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2Ym5peWdlYnBmcXh2bHhjdWhzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTM5MjUzNywiZXhwIjoyMDc2OTY4NTM3fQ.ZNVeHCCoHz-XQoLpLWEJlSCpeGNBNi46a-NWo1kJuWo,SUPABASE_JWT_SECRET=xhw10hkXi9CaHAdMf2u/QctfM0KWzaIMT6nZ4KKhf+clbHUfVff4Xt61DSrLwANfM/AUKUJc/zr13Lur7MWzzA==,GCS_BUCKET_NAME=budbase-app-data,GCP_PROJECT_ID=YOUR_PROJECT_ID,CORS_ORIGIN=*"
```

## Part 2: Update Frontend Environment Variables

After deploying the backend, update the frontend to point to the Cloud Run URL:

1. **Edit `frontend/.env`**
   ```
   VITE_API_BASE_URL=https://budbase-api-xxxxx-uc.a.run.app
   VITE_SUPABASE_URL=https://lvbniygebpfqxvlxcuhs.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
   VITE_MAPBOX_ACCESS_TOKEN=<your-mapbox-token>
   ```

2. **Rebuild Frontend**
   ```bash
   cd Budbase/frontend
   npm run build
   ```

## Part 3: Deploy Frontend to Firebase Hosting

### Option A: Using Firebase Console (Recommended - No CLI needed)

1. **Navigate to Firebase Console**
   - Go to https://console.firebase.google.com
   - Select your project (or create one)

2. **Enable Hosting**
   - Click "Hosting" in left sidebar
   - Click "Get started"
   - Follow the wizard (you can skip the CLI installation steps)

3. **Upload Build Files**
   - Unfortunately, Firebase Console doesn't support direct uploads
   - **You'll need Firebase CLI for this step**
   - Install Node.js and run: `npm install -g firebase-tools`
   - Then follow Option B below

### Option B: Using Firebase CLI

1. **Install Firebase Tools**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**
   ```bash
   firebase login
   ```

3. **Initialize Firebase (if not already done)**
   ```bash
   cd Budbase
   firebase init hosting
   ```
   - Select your Firebase project
   - Public directory: `frontend/dist`
   - Configure as single-page app: Yes
   - Set up automatic builds with GitHub: No
   - Don't overwrite `index.html`

4. **Deploy**
   ```bash
   firebase deploy --only hosting
   ```

5. **Get Your URL**
   - After deployment, you'll see your hosting URL
   - Format: `https://your-project.web.app` or `https://your-project.firebaseapp.com`

## Part 4: Update CORS Settings

After deploying frontend, update the backend's CORS_ORIGIN:

1. Go to Cloud Run service in GCP Console
2. Click "EDIT & DEPLOY NEW REVISION"
3. Go to "VARIABLES & SECRETS"
4. Update `CORS_ORIGIN` to your Firebase URL: `https://your-project.web.app`
5. Click "DEPLOY"

## Part 5: Verify Deployment

1. **Test Backend**
   ```bash
   curl https://budbase-api-xxxxx-uc.a.run.app/health
   ```
   Should return: `{"status":"ok"}`

2. **Test Frontend**
   - Visit your Firebase URL
   - Try logging in
   - Check browser console for errors

## Troubleshooting

### Backend Issues

**401 Unauthorized Errors**
- Verify `SUPABASE_JWT_SECRET` is correct
- Check that it matches your Supabase project's JWT secret

**Storage Access Denied**
- Ensure service account has "Storage Object Admin" role
- Check bucket name is correct: `budbase-app-data`
- Verify bucket exists in the same GCP project

**Container Won't Start**
- Check logs: `gcloud run services logs read budbase-api --region us-central1`
- Verify all environment variables are set
- Ensure PORT is set to 8080

### Frontend Issues

**Blank Page**
- Check browser console for errors
- Verify `VITE_API_BASE_URL` is set correctly
- Ensure `index.html` wasn't overwritten during Firebase init

**API Calls Failing**
- Check CORS settings on backend
- Verify API URL in frontend `.env` is correct
- Check Network tab in browser DevTools

**Map Not Loading**
- Verify `VITE_MAPBOX_ACCESS_TOKEN` is valid
- Check Mapbox account for usage limits

## Next Steps

1. Set up custom domain for Firebase Hosting
2. Set up custom domain for Cloud Run
3. Configure Cloud CDN for better performance
4. Set up Cloud Monitoring and Logging
5. Configure automated backups for GCS bucket
6. Set up CI/CD pipeline with Cloud Build

## Cost Optimization

- **Cloud Run**: Free tier includes 2 million requests/month
- **Firebase Hosting**: Free tier includes 10 GB storage + 360 MB/day bandwidth
- **Cloud Storage**: ~$0.02/GB/month for standard storage
- **Supabase**: Free tier includes 500 MB database + 1 GB file storage

Monitor your usage in GCP Console → Billing
