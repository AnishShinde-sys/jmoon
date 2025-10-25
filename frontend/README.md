# Budbase Frontend

Modern React + TypeScript frontend for agricultural data management.

## Tech Stack

- **React 18** with functional components and hooks
- **TypeScript** for type safety
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **React Router v6** for navigation
- **Supabase** for authentication
- **Axios** for API calls
- **Mapbox GL JS** for interactive maps
- **Turf.js** for geospatial operations

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase project (for authentication)
- Backend API running (see `../backend/README.md`)
- Mapbox access token

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your values
# - VITE_SUPABASE_URL: Your Supabase project URL
# - VITE_SUPABASE_ANON_KEY: Your Supabase anon/public key
# - VITE_API_BASE_URL: Your backend API URL (e.g., https://api.budbase.com)
# - VITE_MAPBOX_ACCESS_TOKEN: Your Mapbox access token
```

### Development

```bash
# Start dev server (runs on http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Project Structure

```
src/
├── assets/           # Static assets (styles, images)
│   └── styles/       # Tailwind CSS and global styles
├── components/       # Reusable React components
│   ├── auth/         # Authentication components
│   ├── ui/           # Generic UI components (Modal, Drawer, Alert)
│   ├── farm/         # Farm-related components
│   ├── datasets/     # Dataset components
│   ├── blocks/       # Block components
│   ├── collectors/   # Data collector components
│   ├── map/          # Map and geospatial components
│   └── images/       # Image handling components
├── context/          # React Context providers
│   ├── AuthContext   # Supabase auth state
│   ├── UIContext     # UI state (modals, drawers, alerts)
│   ├── FarmContext   # Current farm state (to be added)
│   └── MapContext    # Map instance and controls (to be added)
├── hooks/            # Custom React hooks
│   ├── useAuth       # From AuthContext
│   ├── useFarms      # Farm CRUD operations
│   ├── useDatasets   # Dataset operations
│   ├── useBlocks     # Block operations
│   └── ...
├── lib/              # Core utilities
│   ├── supabaseClient  # Supabase initialization
│   ├── apiClient       # Axios instance with auth
│   └── mapbox          # Mapbox utilities
├── pages/            # Page components (routes)
│   ├── LoginPage
│   ├── DashboardPage
│   ├── FarmPage
│   ├── AdminPage
│   └── ...
├── services/         # Business logic services
│   └── geospatialService  # Turf.js helpers
├── types/            # TypeScript type definitions
│   ├── user.ts
│   ├── farm.ts
│   ├── dataset.ts
│   └── ...
├── App.tsx           # Root component with routing
└── main.tsx          # Entry point
```

## Key Features

### Authentication

- **Supabase Auth** for user management
- Email/password sign in and sign up
- JWT tokens automatically included in API requests
- Protected routes redirect to login if not authenticated

```tsx
// Example usage
import { useAuth } from '@/context/AuthContext'

function MyComponent() {
  const { user, signIn, signOut } = useAuth()

  // user object contains Supabase user data
  // Call signIn(email, password) to authenticate
  // Call signOut() to log out
}
```

### API Calls

All API calls use the `apiClient` which automatically:
- Adds Supabase JWT to Authorization header
- Redirects to login on 401 errors
- Uses configured backend base URL

```tsx
import apiClient from '@/lib/apiClient'

// GET request
const response = await apiClient.get('/api/farms')

// POST request
const response = await apiClient.post('/api/farms', {
  name: 'My Farm',
  description: 'A great farm'
})
```

### Custom Hooks

Use provided hooks for data fetching and mutations:

```tsx
import { useFarms } from '@/hooks/useFarms'

function FarmList() {
  const { farms, loading, error, createFarm, updateFarm, deleteFarm } = useFarms()

  if (loading) return <Spinner />
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      {farms.map(farm => (
        <div key={farm.id}>{farm.name}</div>
      ))}
    </div>
  )
}
```

### UI Components

Pre-built components for common UI patterns:

```tsx
import { useUI } from '@/context/UIContext'
import Modal from '@/components/ui/Modal'
import Drawer from '@/components/ui/Drawer'

function MyComponent() {
  const { showAlert, modals, openModal, closeModal } = useUI()

  // Show an alert
  showAlert('Operation successful!', 'success')

  // Open a modal
  openModal('createFarm')

  return (
    <Modal
      isOpen={modals.createFarm}
      onClose={() => closeModal('createFarm')}
      title="Create Farm"
    >
      {/* Modal content */}
    </Modal>
  )
}
```

### Mapbox Integration

The `MapService` class provides utilities for working with Mapbox GL JS:

```tsx
import mapService from '@/lib/mapbox'

// Initialize map
const map = mapService.initializeMap({
  container: 'map-container',
  center: [-122.5, 38.5],
  zoom: 10
})

// Add drawing controls
const draw = mapService.addDrawControls()

// Add geocoder
const geocoder = mapService.addGeocoder()

// Add GeoJSON data
mapService.addGeoJSONSource('blocks', blocksGeoJSON)

// Fit map to data bounds
mapService.fitBounds(blocksGeoJSON)
```

### Geospatial Operations

Use the `geospatialService` for common spatial calculations:

```tsx
import geospatialService from '@/services/geospatialService'

// Calculate area
const area = geospatialService.calculateArea(feature)
const hectares = geospatialService.toHectares(area)

// Check point in polygon
const isInside = geospatialService.pointInPolygon([lng, lat], polygon)

// Get bounds and center
const bounds = geospatialService.getBounds(geojson)
const center = geospatialService.getCenter(geojson)

// Calculate distance
const distance = geospatialService.distance([lng1, lat1], [lng2, lat2])
```

## Routing

Routes are defined in `App.tsx`:

- `/login` - Authentication page
- `/dashboard` - Farm list (protected)
- `/farm/:farmId` - Farm detail with map (protected)
- `/farm/:farmId/:layerType/:layerId` - Farm with specific layer selected (protected)
- `/admin` - Admin dashboard (protected)
- `/script` - Script console (protected)

All routes except `/login` require authentication.

## Environment Variables

Required environment variables (create `.env` file):

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Backend API
VITE_API_BASE_URL=https://your-backend-url.run.app

# Mapbox
VITE_MAPBOX_ACCESS_TOKEN=pk.your-mapbox-token

# Optional
VITE_APP_NAME=Budbase
```

## Type Safety

All API responses and data structures are typed. See `src/types/` for definitions:

- `user.ts` - User and profile types
- `farm.ts` - Farm and collaborator types
- `block.ts` - Block and custom field types
- `dataset.ts` - Dataset and visualization settings
- `collector.ts` - Data collector and data point types
- `folder.ts` - Folder organization types
- `api.ts` - Generic API response types

## Styling

This project uses Tailwind CSS. Custom utility classes are defined in `src/assets/styles/index.css`:

- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger` - Button styles
- `.input`, `.label` - Form input styles
- `.card`, `.card-header`, `.card-body` - Card container styles
- `.drawer`, `.drawer-open`, `.drawer-closed` - Drawer animation
- `.modal-overlay`, `.modal-content` - Modal styles
- `.spinner` - Loading spinner

## Development Tips

### Adding a New Page

1. Create component in `src/pages/MyPage.tsx`
2. Add route in `src/App.tsx`
3. Wrap with `<ProtectedRoute>` if authentication is required

### Adding a New API Hook

1. Create hook file in `src/hooks/useMyResource.ts`
2. Use `apiClient` for requests
3. Return loading/error states and mutation functions
4. Follow pattern from existing hooks

### Working with the Map

1. Use `MapService` to initialize and control the map
2. Store map instance in context for global access
3. Use `geospatialService` for calculations
4. Reference `window.turf` for advanced operations

## Next Steps

To complete the frontend, you may want to add:

1. **Map Components** - Full Mapbox integration with layers and controls
2. **Dataset Upload** - File upload UI with progress tracking
3. **Block Editor** - Interactive block drawing and editing
4. **Data Collector Forms** - Dynamic forms based on collector definitions
5. **Image Gallery** - Multi-image viewer with signed URL support
6. **Filters & Search** - Dataset filtering and farm search
7. **Permissions UI** - Collaborator management interface
8. **Error Boundaries** - Catch and handle React errors gracefully
9. **Loading States** - Better loading UX throughout the app
10. **Unit Tests** - Add test coverage with Vitest

## Deployment

```bash
# Build for production
npm run build

# The dist/ folder contains the static site
# Deploy to:
# - Firebase Hosting
# - Vercel
# - Netlify
# - Google Cloud Storage + CDN
# - Any static hosting service
```

Example Firebase Hosting deployment:

```bash
npm run build
firebase deploy --only hosting
```

## Troubleshooting

### "Missing Supabase environment variables"
- Make sure `.env` file exists with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### "Network Error" when calling API
- Check `VITE_API_BASE_URL` is correct
- Ensure backend is running and accessible
- Check browser console for CORS errors

### Map not showing
- Verify `VITE_MAPBOX_ACCESS_TOKEN` is set
- Check Mapbox token is valid and has proper scopes
- Look for console errors

### Redirected to login repeatedly
- Check Supabase project settings
- Verify JWT token is being included in requests
- Check backend JWT verification is working

## License

Proprietary - All rights reserved
