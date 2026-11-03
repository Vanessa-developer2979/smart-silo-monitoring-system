import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout.jsx'
import { AuthProvider } from './context/AuthProvider.jsx'
import { DataModeProvider } from './context/DataModeProvider.jsx'
import { useAuth } from './hooks/useAuth.js'
import { LoginPage } from './pages/auth/LoginPage.jsx'
import { AdministratorDashboard } from './pages/admin/AdministratorDashboard.jsx'
import { OperatorDashboard } from './pages/operator/OperatorDashboard.jsx'
import { ContentPage } from './pages/ContentPage.jsx'

function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) return <div className="auth-loading">Loading your secure session…</div>
  return user ? <AppLayout /> : <Navigate to="/login" replace />
}

function RequireAdmin() {
  const { user } = useAuth()
  return user?.role === 'administrator' ? <Outlet /> : <Navigate to="/" replace />
}

function RoleDashboard() {
  const { user } = useAuth()
  return user?.role === 'administrator'
    ? <AdministratorDashboard />
    : <OperatorDashboard />
}

function LoginRoute() {
  const { user } = useAuth()
  return user ? <Navigate to="/" replace /> : <LoginPage />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataModeProvider>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route element={<RequireAuth />}>
              <Route index element={<RoleDashboard />} />
              <Route path="silos" element={<ContentPage page="silos" />} />
              <Route path="monitoring" element={<ContentPage page="monitoring" />} />
              <Route path="alerts" element={<ContentPage page="alerts" />} />
              <Route path="reports" element={<ContentPage page="reports" />} />
              <Route element={<RequireAdmin />}>
                <Route path="users" element={<ContentPage page="users" />} />
                <Route path="settings" element={<ContentPage page="settings" />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </DataModeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
