import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './assets/styles/index.css'

// Initialize Mapbox GL and Turf as global variables (like the old Vue app)
import mapboxgl from 'mapbox-gl'
import * as turf from '@turf/turf'

;(window as any).mapboxgl = mapboxgl
;(window as any).turf = turf

// Set Mapbox access token from environment
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || ''

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
