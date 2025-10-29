# Budbase Frontend

React + TypeScript frontend application for the Budbase farm management system. Built with Vite, Tailwind CSS, and Mapbox GL JS for interactive geospatial visualization.

## Features

- **Authentication**: Secure login/signup with Supabase
- **Farm Management**: Create and manage farms with location data
- **Block Mapping**: Draw and edit vineyard/farm blocks on interactive maps
- **Dataset Visualization**: Upload and visualize geospatial data (CSV, GeoJSON, etc.)
- **Real-time Mapping**: Interactive Mapbox GL JS maps with drawing tools
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS
- **React Router** - Client-side routing
- **Supabase** - Authentication
- **Mapbox GL JS** - Interactive maps
- **Turf.js** - Geospatial analysis
- **Axios** - HTTP client

## Prerequisites

- Node.js 18+ and npm
- Supabase project for authentication
- Mapbox account and access token
- Backend API running (see backend README)

## Quick Start

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment

Create a `.env` file in the `frontend` directory:

```env
# Supabase Authentication
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Backend API
VITE_API_BASE_URL=http://localhost:8080

# Mapbox
VITE_MAPBOX_ACCESS_TOKEN=pk.your-mapbox-token
```

**IMPORTANT**: Never commit the `.env` file. Use `.env.example` as a template.

### 3. Run Development Server

```bash
npm run dev
```

The app will open at `http://localhost:3000`.

### 4. Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

### 5. Preview Production Build

```bash
npm run preview
```

## Project Structure

```
frontend/
├── public/              # Static assets
├── src/
│   ├── assets/         # Images, styles
│   │   └── styles/
│   │       └── index.css
│   ├── components/     # React components
│   │   ├── blocks/    # Block components
│   │   ├── datasets/  # Dataset components
│   │   ├── farm/      # Farm components
│   │   ├── map/       # Map components
│   │   └── ui/        # Reusable UI components
│   ├── context/       # React Context providers
│   │   ├── AuthContext.tsx
│   │   ├── UIContext.tsx
│   │   └── MapContext.tsx
│   ├── hooks/         # Custom React hooks
│   │   ├── useFarms.ts
│   │   ├── useBlocks.ts
│   │   ├── useDatasets.ts
│   │   └── useMap.ts
│   ├── lib/           # Third-party library configs
│   │   ├── supabaseClient.ts
│   │   └── apiClient.ts
│   ├── pages/         # Page components
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── FarmPage.tsx
│   │   └── AdminPage.tsx
│   ├── services/      # Business logic services
│   │   ├── geospatial.ts
│   │   └── mapbox.ts
│   ├── types/         # TypeScript type definitions
│   │   ├── user.ts
│   │   ├── farm.ts
│   │   ├── block.ts
│   │   ├── dataset.ts
│   │   └── api.ts
│   ├── App.tsx        # Root component
│   └── main.tsx       # Entry point
├── .env               # Environment variables (gitignored)
├── .env.example       # Environment template
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## Available Scripts

- `npm run dev` - Start development server (port 3000)
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

## Key Components

### Authentication

The `AuthContext` provides authentication state and methods throughout the app:

```typescript
import { useAuth } from './context/AuthContext'

function MyComponent() {
  const { user, signIn, signOut } = useAuth()
  // ...
}
```

### Map Components

Interactive mapping with Mapbox GL JS:

```typescript
import MapContainer from './components/map/MapContainer'

function MyPage() {
  return (
    <MapContainer
      center={[-122.5, 38.5]}
      zoom={12}
      enableDrawing={true}
    />
  )
}
```

### Custom Hooks

Manage data fetching and state:

```typescript
import { useFarms } from './hooks/useFarms'

function FarmList() {
  const { farms, loading, createFarm, updateFarm } = useFarms()
  // ...
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `VITE_API_BASE_URL` | Backend API base URL | Yes |
| `VITE_MAPBOX_ACCESS_TOKEN` | Mapbox access token | Yes |

## Routing

The app uses React Router for navigation:

- `/login` - Login/signup page
- `/` - Dashboard (protected)
- `/farm/:farmId` - Farm details page (protected)
- `/admin` - Admin panel (protected, admin only)
- `/scripts` - Script runner page (protected, admin only)

Protected routes require authentication and redirect to `/login` if not authenticated.

## Authentication Flow

1. User enters email/password on login page
2. Supabase authenticates and returns JWT token
3. Token is stored in browser (localStorage via Supabase)
4. `apiClient` automatically includes token in all API requests
5. Backend verifies token on each request
6. Frontend refreshes token automatically via Supabase

## Styling

The app uses Tailwind CSS with custom utility classes:

```css
/* Buttons */
.btn              /* Base button */
.btn-primary      /* Primary action */
.btn-secondary    /* Secondary action */

/* Inputs */
.input            /* Base input */

/* Cards */
.card             /* Card container */
```

See `src/assets/styles/index.css` for all custom utilities.

## Map Features

### Drawing Blocks

1. Open "Create Block" drawer
2. Click "Start Drawing"
3. Click on map to add polygon points
4. Double-click to finish
5. Fill in block details
6. Save

### Visualizing Datasets

1. Upload dataset (CSV, GeoJSON)
2. Dataset is processed on backend
3. Data appears on map with color-coded visualization
4. Use legend to understand data ranges

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Build
npm run build

# Deploy
netlify deploy --prod --dir=dist
```

### Firebase Hosting

```bash
# Install Firebase CLI
npm i -g firebase-tools

# Build
npm run build

# Deploy
firebase deploy --only hosting
```

## Security Best Practices

1. **Never commit `.env` file** - Use `.env.example` as template
2. **Rotate Mapbox token** - If accidentally exposed
3. **Use HTTPS** - Always in production
4. **CSP Headers** - Configure Content Security Policy
5. **Input Validation** - Validate all user inputs

## Troubleshooting

### Error: "Mapbox GL JS not initialized"

Ensure `VITE_MAPBOX_ACCESS_TOKEN` is set in your `.env` file.

### Error: "Network Error" when calling API

Check that:
1. Backend is running
2. `VITE_API_BASE_URL` is correct
3. CORS is properly configured on backend

### Maps not displaying

1. Verify Mapbox token is valid
2. Check browser console for errors
3. Ensure proper CSP headers allow Mapbox resources

### Build errors with Vite

Clear cache and reinstall:

```bash
rm -rf node_modules dist .vite
npm install
npm run build
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Android 90+)

## Performance Optimization

- **Code Splitting**: Automatic with Vite and React.lazy()
- **Asset Optimization**: Images compressed, fonts subset
- **Lazy Loading**: Maps and heavy components load on demand
- **Caching**: Service worker for offline support (optional)

## Future Enhancements

- [ ] Add offline mode with service workers
- [ ] Implement real-time collaboration
- [ ] Add mobile app (React Native)
- [ ] Add data export features
- [ ] Implement advanced analytics dashboard
- [ ] Add notification system
- [ ] Add user settings page
- [ ] Implement internationalization (i18n)

## Testing

```bash
# Unit tests (not yet implemented)
npm test

# E2E tests (not yet implemented)
npm run test:e2e
```

## Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit: `git commit -am 'Add feature'`
3. Push to branch: `git push origin feature/my-feature`
4. Create pull request

## License

Proprietary - All Rights Reserved

## Support

For questions or issues, contact: support@budbase.com
