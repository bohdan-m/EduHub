import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import './App.css'
import Register from './pages/Auth/Register'
import Login from './pages/Auth/Login'
import Dashboard from './pages/Dashboard/Dashboard'
import { useUserStore } from './store/store'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const {user} = useUserStore()

  useEffect(() => {
    const token = user?.access
    setIsAuthenticated(!!token)
  }, [])

  return (
    <BrowserRouter>
      <Routes>
          <Route path="login" element={<Login/>}/>
          <Route path="register" element={<Register/>}/>
          <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />}/>
          <Route path="dashboard" element={<Dashboard/>}/>
      </Routes>
    </BrowserRouter>
  )
}

export default App
