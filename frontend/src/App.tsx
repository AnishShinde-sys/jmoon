import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { UIProvider } from './context/UIContext'
import { MapProvider } from './context/MapContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Alert from './components/ui/Alert'

// Pages
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import DashboardPage from './pages/DashboardPage'
import FarmPage from './pages/FarmPage'
import AdminPage from './pages/AdminPage'
import ScriptPage from './pages/ScriptPage'
import NotFoundPage from './pages/NotFoundPage'

function App() {
  return (
    <AuthProvider>
      <UIProvider>
        <MapProvider>
          <Alert />
          <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/farm/:farmId"
            element={
              <ProtectedRoute>
                <FarmPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/farm/:farmId/:layerType/:layerId"
            element={
              <ProtectedRoute>
                <FarmPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/script"
            element={
              <ProtectedRoute>
                <ScriptPage />
              </ProtectedRoute>
            }
          />

          {/* Default route */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </MapProvider>
      </UIProvider>
    </AuthProvider>
  )
}

export default App
