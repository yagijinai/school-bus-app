import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard as ParentDashboard } from './pages/parent/Dashboard'
import { DriverDashboard } from './pages/driver/Dashboard'
import { AdminDashboard } from './pages/admin/Dashboard'

// 認証状態とロールに基づきルートを保護するコンポーネント
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { user, profile, loading, isRegistered } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        <p className="mt-4 text-slate-400 text-sm">読み込み中...</p>
      </div>
    )
  }

  // 1. 未ログインの場合はログインへ
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // 2. ログイン済みだがユーザープロファイル未作成の場合は初期登録画面へ
  if (!isRegistered) {
    if (location.pathname !== '/register') {
      return <Navigate to="/register" replace />
    }
    return <>{children}</>
  }

  // 既に登録済みで /register にアクセスしようとした場合は適切なダッシュボードへ
  if (location.pathname === '/register') {
    if (profile?.role === 'parent') return <Navigate to="/parent/dashboard" replace />
    if (profile?.role === 'driver') return <Navigate to="/driver/dashboard" replace />
    if (profile?.role === 'admin') return <Navigate to="/admin/dashboard" replace />
  }

  // 3. ロールベースの認可チェック
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    if (profile.role === 'parent') return <Navigate to="/parent/dashboard" replace />
    if (profile.role === 'driver') return <Navigate to="/driver/dashboard" replace />
    if (profile.role === 'admin') return <Navigate to="/admin/dashboard" replace />
  }

  return <>{children}</>
}

// 既にログイン済みのユーザーをダッシュボードへ流すためのパブリックルート
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading, isRegistered } = useAuth()

  if (loading) return null

  if (user) {
    if (!isRegistered) {
      return <Navigate to="/register" replace />
    }
    if (profile?.role === 'parent') return <Navigate to="/parent/dashboard" replace />
    if (profile?.role === 'driver') return <Navigate to="/driver/dashboard" replace />
    if (profile?.role === 'admin') return <Navigate to="/admin/dashboard" replace />
  }

  return <>{children}</>
}

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      
      <Route path="/register" element={<ProtectedRoute><Register /></ProtectedRoute>} />
      
      <Route 
        path="/parent/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['parent']}>
            <ParentDashboard />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/driver/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['driver']}>
            <DriverDashboard />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/admin/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  )
}

export default App
