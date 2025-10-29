# Budbase Backend API

Express + TypeScript backend API for the Budbase farm management system. This API provides RESTful endpoints for managing farms, blocks, datasets, and user profiles, with data stored in Google Cloud Storage as JSON files.

## Architecture

- **Runtime**: Node.js 18+
- **Framework**: Express.js with TypeScript
- **Authentication**: Supabase JWT tokens
- **Data Storage**: Google Cloud Storage (JSON files)
- **Deployment**: Google Cloud Run (containerized)

## Prerequisites

- Node.js 18+ and npm
- Google Cloud Platform account
- GCS bucket for data storage
- Supabase project for authentication

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Create a `.env` file in the `backend` directory:

```env
# Server
PORT=8080
NODE_ENV=development

# Supabase Authentication
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Google Cloud Storage
GCS_BUCKET_NAME=budbase-app-data
GCP_PROJECT_ID=your-gcp-project-id

# CORS
CORS_ORIGIN=http://localhost:3000
```

### 3. Set Up Google Cloud Authentication

**Option A: Local Development (Service Account)**

1. Create a service account in GCP Console
2. Download the JSON key file
3. Set environment variable:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

**Option B: Cloud Run (Workload Identity)**

Cloud Run uses Application Default Credentials automatically. No additional configuration needed.

### 4. Run Development Server

```bash
npm run dev
```

The server will start on `http://localhost:8080`.

### 5. Build for Production

```bash
npm run build
npm start
```

## API Endpoints

### Health Check

```
GET /health
```

Returns server status.

### User Routes (`/api/users`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/users/me` | Get current user profile | Yes |
| POST | `/api/users/me` | Create user profile | Yes |
| PUT | `/api/users/me` | Update user profile | Yes |

### Farm Routes (`/api/farms`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/farms` | List user's farms | Yes |
| POST | `/api/farms` | Create new farm | Yes |
| GET | `/api/farms/:farmId` | Get farm details | Yes |
| PUT | `/api/farms/:farmId` | Update farm | Yes (owner only) |
| DELETE | `/api/farms/:farmId` | Delete farm | Yes (owner only) |

### Block Routes (`/api/farms/:farmId/blocks`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/farms/:farmId/blocks` | Get all blocks as GeoJSON | Yes |
| POST | `/api/farms/:farmId/blocks` | Create new block | Yes |
| PUT | `/api/farms/:farmId/blocks/:blockId` | Update block | Yes |
| DELETE | `/api/farms/:farmId/blocks/:blockId` | Delete block | Yes |

### Dataset Routes

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/farms/:farmId/datasets` | List farm datasets | Yes |
| POST | `/api/farms/:farmId/datasets/upload` | Upload dataset file | Yes |
| GET | `/api/datasets/:datasetId?farmId=xxx` | Get dataset with GeoJSON | Yes |
| PUT | `/api/datasets/:datasetId?farmId=xxx` | Update dataset metadata | Yes |
| DELETE | `/api/datasets/:datasetId?farmId=xxx` | Delete dataset | Yes |

## Data Model (GCS Structure)

All data is stored as JSON files in Google Cloud Storage:

```
gs://budbase-app-data/
├── users/
│   └── {userId}/
│       ├── profile.json          # User profile
│       └── farms.json            # Array of farm IDs
├── farms/
│   └── {farmId}/
│       ├── metadata.json         # Farm details
│       ├── blocks.json           # GeoJSON FeatureCollection
│       └── datasets/
│           └── {datasetId}/
│               ├── metadata.json      # Dataset info
│               ├── raw.{ext}          # Original file
│               └── processed.geojson  # Processed GeoJSON
```

### Example: User Profile

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "user",
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-02T00:00:00Z"
}
```

### Example: Farm Metadata

```json
{
  "id": "farm-uuid",
  "name": "Smith Vineyard",
  "location": {
    "latitude": 38.5,
    "longitude": -122.5,
    "address": "Napa Valley, CA"
  },
  "owner": "user-uuid",
  "collaborators": [],
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z",
  "blockCount": 3,
  "datasetCount": 5,
  "totalArea": 150000
}
```

### Example: Blocks GeoJSON

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "block-uuid",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[...]]
      },
      "properties": {
        "id": "block-uuid",
        "farmId": "farm-uuid",
        "name": "Block A",
        "variety": "Cabernet Sauvignon",
        "plantingYear": 2018,
        "area": 50000,
        "createdAt": "2025-01-01T00:00:00Z",
        "updatedAt": "2025-01-01T00:00:00Z"
      }
    }
  ]
}
```

## Authentication

The API uses Supabase JWT tokens for authentication. Clients must include the token in the `Authorization` header:

```
Authorization: Bearer <supabase-access-token>
```

The `authenticate` middleware verifies the token using the `SUPABASE_JWT_SECRET` and extracts user information.

## Error Handling

All errors follow this format:

```json
{
  "error": "ErrorName",
  "message": "Human-readable error message",
  "details": {},
  "stack": "..." // Only in development
}
```

Common error codes:
- `400` - Validation Error
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## File Upload

Dataset uploads support the following formats:
- **CSV**: Point data with lat/lon columns
- **GeoJSON**: Vector data
- **Shapefile**: As ZIP archive (not yet implemented)
- **KML/KMZ**: Google Earth format (not yet implemented)
- **TIFF**: Raster data (not yet implemented)

Maximum file size: 50 MB

## Deployment to Cloud Run

### 1. Build Docker Image

```bash
# Build locally
docker build -t gcr.io/YOUR_PROJECT_ID/budbase-api:latest .

# Or use Cloud Build
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/budbase-api:latest
```

### 2. Deploy to Cloud Run

```bash
gcloud run deploy budbase-api \
  --image gcr.io/YOUR_PROJECT_ID/budbase-api:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "SUPABASE_URL=https://...,SUPABASE_JWT_SECRET=...,GCS_BUCKET_NAME=budbase-app-data"
```

### 3. Set Up Custom Domain (Optional)

```bash
gcloud run domain-mappings create \
  --service budbase-api \
  --domain api.budbase.com \
  --region us-central1
```

## Development

### Project Structure

```
backend/
├── src/
│   ├── index.ts              # Express app entry point
│   ├── middleware/
│   │   ├── auth.ts           # JWT authentication
│   │   └── errorHandler.ts  # Global error handler
│   ├── routes/
│   │   ├── users.ts          # User routes
│   │   ├── farms.ts          # Farm routes
│   │   ├── blocks.ts         # Block routes
│   │   └── datasets.ts       # Dataset routes
│   ├── services/
│   │   ├── gcsClient.ts      # GCS wrapper
│   │   ├── fileProcessor.ts  # File conversion
│   │   └── imageProcessor.ts # Image processing
│   ├── types/
│   │   └── index.ts          # TypeScript types
│   └── utils/
│       └── verifySupabaseToken.ts
├── Dockerfile
├── package.json
└── tsconfig.json
```

### Scripts

- `npm run dev` - Start development server with auto-reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run production server
- `npm run lint` - Run ESLint

### Testing

```bash
# Run tests (not yet implemented)
npm test

# Run with coverage
npm run test:coverage
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | 8080 |
| `NODE_ENV` | Environment | No | development |
| `SUPABASE_URL` | Supabase project URL | Yes | - |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | No | - |
| `SUPABASE_JWT_SECRET` | JWT secret for verification | Yes | - |
| `GCS_BUCKET_NAME` | GCS bucket name | Yes | - |
| `GCP_PROJECT_ID` | GCP project ID | No | Auto-detected |
| `CORS_ORIGIN` | Allowed CORS origin | No | * |

## Security

- **JWT Verification**: All protected routes verify Supabase JWT tokens
- **CORS**: Configured to allow requests from frontend origin only
- **Helmet**: Security headers enabled
- **Input Validation**: All user inputs are validated
- **File Upload**: Size limits and type validation enforced
- **Service Account**: Uses least-privilege IAM roles

## Troubleshooting

### Error: "SUPABASE_JWT_SECRET not set"

Ensure your `.env` file contains the correct JWT secret from Supabase project settings.

### Error: "GCS_BUCKET_NAME not set"

Create a GCS bucket and set the bucket name in your `.env` file.

### Error: "Permission denied" for GCS

Ensure your service account has the following IAM roles:
- `roles/storage.objectAdmin` (on the bucket)

### CORS errors

Update `CORS_ORIGIN` in `.env` to match your frontend URL.

## Future Enhancements

- [ ] Implement Shapefile processing
- [ ] Implement KML/KMZ processing
- [ ] Implement TIFF/raster processing
- [ ] Add WebSocket support for real-time updates
- [ ] Add rate limiting
- [ ] Add request caching
- [ ] Add comprehensive test suite
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Add database for faster queries (optional)

## License

Proprietary - All Rights Reserved

## Support

For questions or issues, contact: support@budbase.com
