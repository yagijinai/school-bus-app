import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { 
  Bus, ShieldCheck, 
  ArrowRight, AlertCircle, 
  Smartphone, Sparkles
} from 'lucide-react'

export const Login: React.FC = () => {
  const navigate = useNavigate()
  const { 
    loginAsParent, 
    loginAsDriver, 
    loginAsAdmin, 
    signInWithGoogle
  } = useAuth()

  // ドライバーログイン入力
  const [driverPin, setDriverPin] = useState('')

  // 管理者ログイン入力
  const [adminPassword, setAdminPassword] = useState('')

  // 状態管理
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [savedSession, setSavedSession] = useState<{
    role: string
    email?: string
    full_name?: string
    lastPath?: string
  } | null>(null)

  // 前回のセッション情報の読み込み（固定仕様：二択フロー用）
  useEffect(() => {
    try {
      const savedStr = localStorage.getItem('school_bus_active_session_v2')
      if (savedStr) {
        const saved = JSON.parse(savedStr)
        if (saved && (saved.profile || saved.user)) {
          setSavedSession({
            role: saved.profile?.role || 'parent',
            email: saved.user?.email || saved.profile?.email,
            full_name: saved.profile?.full_name || saved.user?.user_metadata?.full_name,
            lastPath: saved.lastPath || (saved.profile?.role === 'driver' ? '/driver/dashboard' : saved.profile?.role === 'admin' ? '/admin/dashboard' : '/parent/dashboard')
          })
        }
      }
    } catch (e) {
      console.error('Failed to load saved session:', e)
    }
  }, [])

  // 【選択肢①】Google ログイン実行（認証後はロール選択画面へ進む）
  const handleGoogleLogin = async () => {
    setErrorMessage(null)
    setIsLoading(true)
    try {
      await signInWithGoogle()
    } catch (err: any) {
      setErrorMessage(err.message || 'Google認証エラーが発生しました。')
      setIsLoading(false)
    }
  }

  // 【選択肢②】前と同じGoogleアカウントで入る（直前セッションから直接遷移）
  const handleResumeSavedSession = async () => {
    if (!savedSession) return
    setIsLoading(true)
    try {
      const targetRole = savedSession.role || 'parent'
      const targetEmail = savedSession.email || 'yagijinai@gmail.com'

      if (targetRole === 'parent') {
        await loginAsParent(targetEmail)
        navigate('/parent/dashboard')
      } else if (targetRole === 'driver') {
        await loginAsDriver()
        navigate('/driver/dashboard')
      } else if (targetRole === 'admin') {
        await loginAsAdmin('admin')
        navigate('/admin/dashboard')
      } else {
        navigate(savedSession.lastPath || '/parent/dashboard')
      }
    } catch (err: any) {
      setErrorMessage(err.message || '前回のセッション復帰に失敗しました。')
    } finally {
      setIsLoading(false)
    }
  }

  // ドライバー直接ログイン実行
  const handleDriverLogin = async (e?: React.FormEvent) => {
    e?.preventDefault?.()
    setErrorMessage(null)
    setIsLoading(true)

    try {
      const res = await loginAsDriver(driverPin)
      if (res.success) {
        navigate('/driver/dashboard')
      } else {
        setErrorMessage(res.error || 'ドライバーログインに失敗しました。')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'ログイン中にエラーが発生しました。')
    } finally {
      setIsLoading(false)
    }
  }

  // 管理者直接ログイン実行
  const handleAdminLogin = async (e?: React.FormEvent) => {
    e?.preventDefault?.()
    setErrorMessage(null)
    setIsLoading(true)

    try {
      const res = await loginAsAdmin(adminPassword)
      if (res.success) {
        navigate('/admin/dashboard')
      } else {
        setErrorMessage(res.error || '管理者パスワードが正しくありません。')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'ログイン中にエラーが発生しました。')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-10 sm:px-6 lg:px-8 relative overflow-hidden text-slate-100 font-sans">
      
      {/* 背景装飾 */}
      <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* アプリロゴ ＆ タイトル */}
      <div className="sm:mx-auto sm:w-full sm:max-w-lg z-10 text-center px-4">
        <div className="inline-flex p-3.5 bg-gradient-to-tr from-amber-500 to-orange-500 rounded-3xl shadow-2xl shadow-amber-500/20 ring-1 ring-white/20 mb-4 animate-in fade-in zoom-in duration-300">
          <Bus className="h-10 w-10 text-slate-950" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          スクールバス運行管理システム
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-slate-400">
          Googleアカウント認証 ＆ スプレッドシート完全連携
        </p>
      </div>

      {/* メインログインカード（固定仕様：二択フロー） */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg z-10 px-4">
        <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-2xl py-6 sm:py-8 px-4 sm:px-8 shadow-2xl rounded-3xl space-y-6">
          
          {/* エラーメッセージ */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs font-bold flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <div className="text-center space-y-1">
            <h2 className="text-base sm:text-lg font-black text-white">
              ログイン方法を選択してください
            </h2>
            <p className="text-xs text-slate-400">
              以下のいずれかの方法ですぐにご利用を開始できます
            </p>
          </div>

          <div className="space-y-4 pt-2">
            {/* 【選択肢①】Googleアカウントで入る */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full p-4.5 bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-900 font-black rounded-2xl text-sm sm:text-base transition-all flex items-center justify-between gap-3 shadow-xl shadow-white/5 border border-slate-200 disabled:opacity-50 group text-left"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-2.5 rounded-xl bg-slate-100 shrink-0 group-hover:scale-105 transition-transform">
                  <svg className="h-6 w-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <span className="text-sm sm:text-base font-black text-slate-900 block">
                    Googleアカウントで入る
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                    認証後に役割（保護者・乗務員・管理者）を選択
                  </span>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-400 group-hover:translate-x-1 transition-transform shrink-0" />
            </button>

            {/* 【選択肢②】前と同じGoogleアカウントで入る */}
            {savedSession ? (
              <button
                type="button"
                onClick={handleResumeSavedSession}
                disabled={isLoading}
                className="w-full p-4.5 bg-gradient-to-r from-indigo-950/80 to-purple-950/80 hover:from-indigo-900/90 hover:to-purple-900/90 active:scale-[0.98] border border-indigo-500/40 rounded-2xl transition-all flex items-center justify-between gap-3 shadow-xl shadow-indigo-950/40 group text-left disabled:opacity-50"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 shrink-0 group-hover:scale-105 transition-transform">
                    <Smartphone className="h-6 w-6 text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider block">
                      直前のセッションから自動復帰
                    </span>
                    <span className="text-sm sm:text-base font-black text-white block">
                      前と同じGoogleアカウントで入る
                    </span>
                    <span className="text-[11px] text-slate-300 font-medium block mt-0.5 truncate">
                      前回: <strong className="text-indigo-200">{savedSession.full_name || savedSession.email || '前回の利用者'} 様</strong> ({savedSession.role === 'parent' ? '保護者' : savedSession.role === 'driver' ? '乗務員' : '学校管理者'})
                    </span>
                  </div>
                </div>
                <div className="px-3 py-1.5 bg-indigo-600 group-hover:bg-indigo-500 text-white font-black text-xs rounded-xl transition-colors shrink-0 flex items-center gap-1 shadow-md shadow-indigo-600/30">
                  <span>開く</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </button>
            ) : (
              <div className="w-full p-4.5 bg-slate-950/50 border border-slate-800 rounded-2xl flex items-center gap-3.5 text-slate-500 select-none">
                <div className="p-2.5 rounded-xl bg-slate-900 text-slate-600 shrink-0">
                  <Smartphone className="h-6 w-6" />
                </div>
                <div className="min-w-0 text-xs">
                  <span className="font-bold text-slate-400 block text-sm">前と同じGoogleアカウントで入る</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">（過去のログイン履歴がこの端末にありません）</span>
                </div>
              </div>
            )}

            {/* 開発環境（localhost / 127.0.0.1）限定 テスト用保護者ログインボタン */}
            {(typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('192.168.'))) && (
              <button
                type="button"
                id="test-yagijinai-login-btn"
                onClick={async () => {
                  setIsLoading(true)
                  await loginAsParent('yagijinai@gmail.com')
                  navigate('/parent/dashboard')
                }}
                className="w-full py-3 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 hover:from-amber-500/30 hover:to-orange-500/30 active:scale-95 text-amber-300 font-bold rounded-2xl text-xs transition-all border border-amber-500/40 flex items-center justify-center gap-2 shadow-lg ring-1 ring-amber-400/30"
              >
                <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
                <span>【テスト用：yagijinai@gmail.com で保護者画面を開く】</span>
              </button>
            )}
          </div>

          {/* 乗務員・学校管理者用の直接ログイン（アコーディオン） */}
          {/* TODO: [本番リリース時] パスワード認証を有効化すること（現在は試作段階のためバイパス中） */}
          <div className="pt-2 border-t border-slate-800/80">
            <details className="group">
              <summary className="text-[11px] font-bold text-slate-500 hover:text-slate-300 cursor-pointer list-none flex items-center justify-between py-1.5 select-none">
                <span>乗務員・学校管理者用の直接ログイン（試作版：パスワード不要）</span>
                <span className="text-xs transition-transform group-open:rotate-180 text-slate-400">▼</span>
              </summary>

              <div className="mt-4 space-y-4 pt-2">
                {/* 乗務員PINログインフォーム */}
                <form noValidate onSubmit={handleDriverLogin} className="p-3.5 bg-slate-950/70 border border-emerald-500/30 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                      <Bus className="h-4 w-4" />
                      <span>スクールバス乗務員</span>
                    </div>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                      パスワード不要
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={driverPin}
                      onChange={(e) => setDriverPin(e.target.value)}
                      placeholder="PINコード（試作版のため入力不要）"
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-xl text-xs transition-all shrink-0 cursor-pointer shadow-md shadow-emerald-900/30"
                    >
                      乗務員画面へ
                    </button>
                  </div>
                </form>

                {/* 学校管理者パスワードログインフォーム */}
                <form noValidate onSubmit={handleAdminLogin} className="p-3.5 bg-slate-950/70 border border-purple-500/30 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-400">
                      <ShieldCheck className="h-4 w-4" />
                      <span>学校管理者</span>
                    </div>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-bold border border-purple-500/30">
                      パスワード不要
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="パスワード（試作版のため入力不要）"
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl text-xs transition-all shrink-0 cursor-pointer shadow-md shadow-purple-900/30"
                    >
                      管理者画面へ
                    </button>
                  </div>
                </form>
              </div>
            </details>
          </div>

        </div>

        {/* フッター */}
        <div className="mt-6 text-center text-xs text-slate-500">
          <p>© 2026 スクールバス運行管理システム（スプレッドシート連携版）</p>
        </div>

      </div>
    </div>
  )
}
