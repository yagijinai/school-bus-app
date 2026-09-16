import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { 
  Bus, ArrowRight, RefreshCw, AlertCircle, KeyRound, CheckCircle2, 
  ShieldCheck, Sparkles, Lock, User
} from 'lucide-react'

export const LoginPage: React.FC = () => {
  const { quickLoginAs, loginWithAuthCode, refreshAll, syncing } = useApp()
  const navigate = useNavigate()
  
  const [parentIdentifier, setParentIdentifier] = useState('')
  const [authCodeInput, setAuthCodeInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 画面マウント時およびタブ復帰時の自動最新データ同期
  useEffect(() => {
    refreshAll().catch(() => {})

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        refreshAll().catch(() => {})
      }
    }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleFocus)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleFocus)
    }
  }, [refreshAll])

  // 管理者・運転手ログイン処理
  const handleQuickRoleLogin = async (type: 'admin' | 'driver') => {
    setError(null)
    setLoading(true)
    try {
      await quickLoginAs(type)
      if (type === 'admin') {
        navigate('/admin')
      } else {
        navigate('/driver')
      }
    } catch (err: any) {
      setError(err.message || 'ログインに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // 保護者 認証コードログイン送信ハンドラ
  const handleAuthCodeLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!parentIdentifier.trim()) {
      setError('保護者メールアドレス（または氏名）を入力してください')
      return
    }
    if (!authCodeInput.trim()) {
      setError('お子様の認証コードを入力してください')
      return
    }

    setError(null)
    setSuccessMessage(null)
    setLoading(true)
    try {
      const res = await loginWithAuthCode(parentIdentifier.trim(), authCodeInput.trim())
      if (res.success) {
        const studentInfo = res.studentNames && res.studentNames.length > 0 
          ? `（お子様: ${res.studentNames.join('・')}）` 
          : ''
        setSuccessMessage(`認証に成功しました！${studentInfo} マイページを開きます...`)
        setTimeout(() => {
          navigate('/parent')
        }, 700)
      } else {
        setError(res.message || '認証コードの照合に失敗しました。コードをご確認ください。')
      }
    } catch (err: any) {
      setError(err.message || 'ログイン処理中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-3 sm:p-4 md:p-6 relative overflow-hidden">
      {/* 背景の美しいアンビエントグラデーション */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-xl relative z-10 space-y-5">
        {/* ヘッダーエリア */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-tr from-amber-500 to-orange-500 rounded-2xl shadow-lg shadow-amber-500/20 text-slate-950">
            <Bus className="h-7 w-7" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            スクールバス運行管理システム
          </h1>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/25 rounded-full text-[11px] font-bold text-amber-300">
              <ShieldCheck className="h-3 w-3 text-amber-400" />
              保護者セキュア認証
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/25 rounded-full text-[11px] font-bold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              スプレッドシート連動
            </span>
          </div>
          <p className="text-xs text-slate-400 pt-1 leading-relaxed">
            生徒の個人情報を保護するため、認証コード照合方式を採用しています。<br className="hidden sm:inline" />
            一度ログインするとブラウザにセッションが保持されます。
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2 text-rose-300 text-xs animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-start gap-2 text-emerald-300 text-xs animate-in fade-in font-bold">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* ① 保護者様 認証ログインフォーム（生徒名非露出・完全セキュア） */}
        {/* ========================================================= */}
        <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-amber-500/20 text-amber-300 rounded-lg">
                <Lock className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                  <span>保護者ログイン（認証コード照合）</span>
                </h2>
                <p className="text-[10px] text-slate-400">学校から配布された認証コードをご入力ください</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => refreshAll()}
              disabled={syncing}
              className="text-[10px] text-slate-400 hover:text-amber-400 font-bold flex items-center gap-1 transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-800"
              title="スプレッドシートから最新データを再同期"
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin text-amber-400' : ''}`} />
              <span>{syncing ? '同期中' : '同期'}</span>
            </button>
          </div>

          <form onSubmit={handleAuthCodeLoginSubmit} className="space-y-3.5">
            {/* 1. 保護者メールアドレス（または氏名） */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span>保護者メールアドレス（または保護者氏名）</span>
                <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={parentIdentifier}
                  onChange={(e) => setParentIdentifier(e.target.value)}
                  placeholder="例: parent@school.jp または 山田 保護者"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-600 outline-none transition-colors"
                />
              </div>
              <p className="text-[10px] text-slate-500">※初回ログイン時にスプレッドシートへ自動登録されます</p>
            </div>

            {/* 2. お子様の認証コード（J列） */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-amber-300 flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>お子様の認証コード（世帯共通コード）</span>
                <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={authCodeInput}
                  onChange={(e) => setAuthCodeInput(e.target.value.toUpperCase())}
                  placeholder="例: SB-FWBQ または SB-3U8W"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-amber-500/50 focus:border-amber-400 rounded-xl text-sm sm:text-base font-mono font-black text-amber-300 tracking-wider placeholder:text-slate-600 placeholder:font-normal placeholder:tracking-normal outline-none transition-colors"
                />
              </div>
            </div>

            {/* 認証してログインボタン */}
            <button
              type="submit"
              disabled={loading || syncing}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>認証・照合中...</span>
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  <span>認証してログイン</span>
                  <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* ========================================================= */}
        {/* ② 検証・運用関係者用ロール切替（学校管理者・運転手） */}
        {/* ========================================================= */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold px-1">
            <span className="flex items-center gap-1 text-slate-400">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              検証・関係者用ログイン
            </span>
            <span className="text-[10px] text-slate-500">教職員・バス乗務員専用</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* 1. 🏫 学校管理者としてログイン */}
            <button
              type="button"
              disabled={loading || syncing}
              onClick={() => handleQuickRoleLogin('admin')}
              className="text-left p-3 rounded-xl bg-slate-950/80 hover:bg-slate-850 border border-indigo-500/40 hover:border-indigo-400 transition-all flex items-center justify-between group cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-lg shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-white group-hover:text-indigo-200 truncate">
                    🏫 学校管理者
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    時刻表・運休管理
                  </div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* 2. 👨‍✈️ 運転手としてログイン */}
            <button
              type="button"
              disabled={loading || syncing}
              onClick={() => handleQuickRoleLogin('driver')}
              className="text-left p-3 rounded-xl bg-slate-950/80 hover:bg-slate-850 border border-emerald-500/40 hover:border-emerald-400 transition-all flex items-center justify-between group cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-lg shrink-0">
                  <Bus className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-white group-hover:text-emerald-200 truncate">
                    👨‍✈️ バス運転手
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    スマホ点呼・乗車記録
                  </div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
