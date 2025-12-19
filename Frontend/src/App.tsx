import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router'
import './App.css'
import Register from './pages/Auth/Register'
import Login from './pages/Auth/Login'
import Dashboard from './pages/Dashboard/Dashboard'
import { useUserStore } from './store/store'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useUserStore()
  const location = useLocation()
  
  if (!user?.access) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  
  return <>{children}</>
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useUserStore()
  
  if (user?.access) {
    return <Navigate to="/dashboard" replace />
  }
  
  return <>{children}</>
}

function AppRoutes() {
  const { user } = useUserStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user?.access && window.location.pathname === '/') {
      navigate('/login', { replace: true })
    } else if (user?.access && window.location.pathname === '/') {
      navigate('/dashboard', { replace: true })
    }
  }, [user, navigate])

  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        } 
      />
      <Route 
        path="/register" 
        element={
          <PublicOnlyRoute>
            <Register />
          </PublicOnlyRoute>
        } 
      />
      <Route 
        path="/" 
        element={
          user?.access 
            ? <Navigate to="/dashboard" replace /> 
            : <Navigate to="/login" replace />
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
