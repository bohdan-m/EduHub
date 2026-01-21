import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router'
import './App.css'
import Register from './pages/Auth/Register'
import Login from './pages/Auth/Login'
import { useUserStore } from './store/store'
import Home from './pages/Dashboard/Dashboard'
import About from './pages/About/About'
import Contact from './pages/Contact/Contact'
import Pricing from './pages/Pricing/Pricing'

// function ProtectedRoute({ children }: { children: React.ReactNode }) {
//   const isAuthenticated = useUserStore((state) => !!state.user?.access)
//   const location = useLocation()
  
//   if (!isAuthenticated) {
//     return <Navigate to="/login" state={{ from: location }} replace />
//   }
  
//   return <>{children}</>
// }

// function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
//   const isAuthenticated = useUserStore((state) => !!state.user?.access)
  
//   if (isAuthenticated) {
//     return <Navigate to="/dashboard" replace />
//   }
  
//   return <>{children}</>
// }

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={
              <Login />
            } 
        />
        <Route 
          path="/register" 
          element={
              <Register />
          } 
        />
        <Route 
          path="/home" 
          element={
              <Home />
          } 
        />
        <Route 
          path="/about" 
          element={
              <About />
          } 
        />
        <Route 
          path="/contact" 
          element={
              <Contact />
          } 
        />
        <Route 
          path="/pricing" 
          element={
              <Pricing />
          } 
        />
        <Route 
          path="/" 
          element={<RedirectFromRoot />} 
        />
        <Route 
          path="*" 
          element={<Navigate to="/" replace />} 
        />
      </Routes>
    </BrowserRouter>
  )
}

function RedirectFromRoot() {
  const isAuthenticated = useUserStore((state) => !!state.user?.access)
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
}

export default App
