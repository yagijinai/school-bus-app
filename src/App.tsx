import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Login } from './pages/Login'
import { Dashboard as ParentDashboard } from './pages/parent/Dashboard'
import { DriverDashboard } from './pages/driver/Dashboard'
import { AdminDashboard } from './pages/admin/Dashboard'
import { Bus } from 'lucide-react'

// 保護者用ダイレクトダッシュボードコンポーネント（直接描画）
const DirectParentContainer: React.FC = () => {
  return <ParentDashboard />
}

// 認証ガード
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        <p className="mt-4 text-slate-400 text-sm">認証状態確認中...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    if (profile.role === 'driver') return <Navigate to="/driver/dashboard" replace />
    if (profile.role === 'admin') return <Navigate to="/admin/dashboard" replace />
    return <DirectParentContainer />
  }

  return <>{children}</>
}

// パブリックルート（ログイン済みならダッシュボードへ）
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading } = useAuth()

  if (loading) return null

  if (user) {
    if (profile?.role === 'driver') return <Navigate to="/driver/dashboard" replace />
    if (profile?.role === 'admin') return <Navigate to="/admin/dashboard" replace />
    return <Navigate to="/parent/dashboard" replace />
  }

  return <>{children}</>
}

const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth()

  // 画面描画最優先ローディングロック（OAuthリダイレクトおよび初期認証確認が100%完了するまで全ルートを完全ロック）
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-white font-sans p-4 select-none">
        <div className="relative">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 via-indigo-500 to-purple-600 p-0.5 animate-spin">
            <div className="w-full h-full bg-slate-950 rounded-3xl flex items-center justify-center">
              <Bus className="h-7 w-7 text-amber-400 animate-pulse" />
            </div>
          </div>
        </div>
        <p className="mt-5 text-base font-black text-slate-100 tracking-wide">
          認証・運行データ同期中...
        </p>
        <p className="mt-1.5 text-xs text-slate-400">
          Googleアカウント照合およびスプレッドシート連携を実行しています
        </p>
      </div>
    )
  }

  return (
    <Routes>
      <Route 
        path="/" 
        element={
          user ? <Navigate to="/parent/dashboard" replace /> : <Navigate to="/login" replace />
        } 
      />

      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      
      {/* 保護者ダッシュボード */}
      <Route 
        path="/parent/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['parent']}>
            <DirectParentContainer />
          </ProtectedRoute>
        } 
      />

      <Route path="/parent" element={<Navigate to="/parent/dashboard" replace />} />
      <Route path="/register" element={<Navigate to="/parent/dashboard" replace />} />
      <Route path="/verify" element={<Navigate to="/parent/dashboard" replace />} />
      
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

      <Route 
        path="*" 
        element={
          user ? <Navigate to="/parent/dashboard" replace /> : <Navigate to="/login" replace />
        } 
      />
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
