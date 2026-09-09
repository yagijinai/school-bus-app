import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { LoginPage } from './pages/LoginPage'
import { ParentDashboard } from './pages/ParentDashboard'
import { AdminDashboard } from './pages/AdminDashboard'
import { DriverDashboard } from './pages/DriverDashboard'
import { Bus } from 'lucide-react'

// 認証・ロールガード
const ProtectedRoute: React.FC<{
  children: React.ReactNode
  allowedRoles?: ('管理者' | '運転手' | '保護者')[]
}> = ({ children, allowedRoles }) => {
  const { user, loading } = useApp()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center text-white font-sans">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-300 font-bold tracking-wide">スプレッドシートデータ取得中...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === '管理者') return <Navigate to="/admin" replace />
    if (user.role === '運転手') return <Navigate to="/driver" replace />
    return <Navigate to="/parent" replace />
  }

  return <>{children}</>
}

// 認証済みならダッシュボードへリダイレクト
const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useApp()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center text-white font-sans">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-300 font-bold tracking-wide">スプレッドシート同期中...</p>
      </div>
    )
  }

  if (user) {
    if (user.role === '管理者') return <Navigate to="/admin" replace />
    if (user.role === '運転手') return <Navigate to="/driver" replace />
    return <Navigate to="/parent" replace />
  }

  return <>{children}</>
}

const AppRoutes: React.FC = () => {
  const { user, loading } = useApp()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center text-white font-sans p-4">
        <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
          <Bus className="w-8 h-8 text-white" />
        </div>
        <p className="mt-4 text-base font-bold text-slate-100">
          スクールバス運行管理システム
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Googleスプレッドシートより最新データを取得しています...
        </p>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />

      {/* 保護者画面 */}
      <Route
        path="/parent"
        element={
          <ProtectedRoute allowedRoles={['保護者', '管理者']}>
            <ParentDashboard />
          </ProtectedRoute>
        }
      />

      {/* 管理者画面 */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['管理者']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* 運転手画面 */}
      <Route
        path="/driver"
        element={
          <ProtectedRoute allowedRoles={['運転手', '管理者']}>
            <DriverDashboard />
          </ProtectedRoute>
        }
      />

      {/* 旧URL互換リダイレクト */}
      <Route path="/parent/dashboard" element={<Navigate to="/parent" replace />} />
      <Route path="/admin/dashboard" element={<Navigate to="/admin" replace />} />
      <Route path="/driver/dashboard" element={<Navigate to="/driver" replace />} />

      {/* ルートURL: ロールに応じて自動分岐 */}
      <Route
        path="/"
        element={
          user ? (
            user.role === '管理者' ? (
              <Navigate to="/admin" replace />
            ) : user.role === '運転手' ? (
              <Navigate to="/driver" replace />
            ) : (
              <Navigate to="/parent" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export const App: React.FC = () => {
  return (
    <AppProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AppProvider>
  )
}

export default App
