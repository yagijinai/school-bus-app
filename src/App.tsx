import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { LoginPage } from './pages/LoginPage'
import { ParentDashboard } from './pages/ParentDashboard'
import { AdminDashboard } from './pages/AdminDashboard'
import { DriverDashboard } from './pages/DriverDashboard'
import { Bus, AlertCircle, RefreshCw, Smartphone, Trash2 } from 'lucide-react'

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

// ログイン済みユーザーのリダイレクトガード
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
  const {
    user,
    loading,
    showTimeoutFallback,
    hasCachedData,
    isUsingCachedData,
    openWithCachedData,
    retryConnection,
    clearAllCacheAndResync
  } = useApp()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex flex-col justify-center items-center text-white font-sans p-4 select-none">
        <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-600/30 animate-pulse">
          <Bus className="w-8 h-8 text-white" />
        </div>
        <p className="mt-4 text-base font-bold text-slate-100 tracking-wide">
          スクールバス運行管理システム
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Googleスプレッドシートより最新データを取得しています...
        </p>

        {/* 5秒タイムアウト復帰フォールバックUI */}
        {showTimeoutFallback && (
          <div className="mt-6 w-full max-w-sm bg-slate-800/95 border border-slate-700/80 rounded-2xl p-5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-300">
            {/* 警告メッセージ */}
            <div className="flex items-start gap-2.5 text-amber-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
              <p className="text-xs leading-relaxed font-bold">
                ⚠️ データの取得に時間がかかっています（Googleサーバーの混雑、または電波状況の一時的な不安定）
              </p>
            </div>

            {/* ボタン表示エリア（端末データ有無で動的分岐） */}
            <div className="mt-4 space-y-2.5">
              {hasCachedData ? (
                // ケースA：端末に保存データが存在する場合（2回目以降の利用）
                <>
                  <button
                    type="button"
                    onClick={openWithCachedData}
                    className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4 text-emerald-200" />
                    <span>📱 前回の保存データで開く</span>
                  </button>

                  <button
                    type="button"
                    onClick={retryConnection}
                    className="w-full py-2.5 px-4 bg-slate-700/80 hover:bg-slate-700 active:scale-[0.98] text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-slate-600 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-300" />
                    <span>🔄 もう一度接続する</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('端末の保存データを全消去し、GASから強制再同期しますか？')) {
                        clearAllCacheAndResync()
                      }
                    }}
                    className="w-full py-2.5 px-4 bg-rose-950/60 hover:bg-rose-900/80 active:scale-[0.98] text-rose-300 hover:text-rose-100 font-bold text-xs rounded-xl border border-rose-800/80 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>🗑 保存データを全消去して再同期</span>
                  </button>

                  <p className="mt-2 text-[11px] text-slate-400 text-center leading-relaxed">
                    ※解消しない場合は、上の「全消去して再同期」をお試しください。
                  </p>
                </>
              ) : (
                // ケースB：端末に保存データが一切ない場合（初回起動時など）
                <>
                  <button
                    type="button"
                    onClick={retryConnection}
                    className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4 text-emerald-200" />
                    <span>🔄 もう一度接続する</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => clearAllCacheAndResync()}
                    className="w-full py-2.5 px-4 bg-rose-950/60 hover:bg-rose-900/80 active:scale-[0.98] text-rose-300 hover:text-rose-100 font-bold text-xs rounded-xl border border-rose-800/80 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>🗑 保存データを全消去して再同期</span>
                  </button>

                  <p className="mt-2 text-[11px] text-slate-400 text-center leading-relaxed">
                    ※一度アプリを閉じて、もう一度アプリを開いてください。
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* キャッシュ利用中の常時バッジ */}
      {isUsingCachedData && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 font-black px-4 py-2 text-xs text-center flex items-center justify-center gap-2 sticky top-0 z-50 shadow-md border-b border-amber-600/30">
          <span className="flex items-center gap-1.5">
            <span className="text-sm">⚠️</span>
            <span className="tracking-wide">前回取得データで表示中</span>
          </span>
          <span className="text-[11px] font-medium text-slate-900/80 hidden sm:inline">
            （通信復旧時に自動で最新化されます）
          </span>
        </div>
      )}
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
    </>
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
