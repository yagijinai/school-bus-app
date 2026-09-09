import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Bus, ArrowRight, RefreshCw, AlertCircle, KeyRound, CheckCircle2, ChevronLeft } from 'lucide-react'

export const LoginPage: React.FC = () => {
  const { login, linkStudentWithCode, userPermissions, guardianMaster, syncing, refreshAll } = useApp()
  const [email, setEmail] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [isCodeMode, setIsCodeMode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 通常ログイン処理
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('メールアドレスを入力してください')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await login(email)
      if (!res.success) {
        if (res.needAuthCode) {
          // 未登録アドレスの場合、エラーではなく「お子様の登録コード入力」画面へ自動遷移
          setIsCodeMode(true)
          setError(null)
        } else {
          setError(res.message || 'ログインに失敗しました')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  // 認証コード入力・連携処理
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('メールアドレスを入力してください')
      return
    }
    if (!authCode.trim()) {
      setError('登録コードを入力してください')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await linkStudentWithCode({
        email: email.trim(),
        code: authCode.trim()
      })
      if (res.success) {
        setSuccessMessage(`お子様「${res.student_name || ''}」と連携しました！画面を切り替えます...`)
        // AppContext内で自動的にsetUserが呼ばれ、カレンダー予約画面へ遷移します
      } else {
        setError(res.message || '登録コードの照合に失敗しました。コードをご確認ください。')
      }
    } finally {
      setLoading(false)
    }
  }

  // スプレッドシートから取得した登録済みメール候補リスト（テスト用クイックログイン）
  const sampleUsers = [
    ...userPermissions.map(p => ({ email: p.email, name: `${p.name} (${p.role})`, role: p.role })),
    ...guardianMaster
      .filter(g => g.parent_email)
      .map(g => ({ email: g.parent_email, name: `${g.student_names.join('・')} の保護者`, role: '保護者' as const }))
  ].filter((v, i, a) => a.findIndex(t => t.email.toLowerCase() === v.email.toLowerCase()) === i)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* 背景装飾 */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
        {/* ヘッダー */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3.5 bg-gradient-to-tr from-amber-500 to-amber-400 rounded-2xl shadow-lg shadow-amber-500/20 text-slate-950">
            {isCodeMode ? <KeyRound className="h-8 w-8" /> : <Bus className="h-8 w-8" />}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            {isCodeMode ? 'お子様の登録コード入力' : 'スクールバス運行管理'}
          </h1>
          <p className="text-xs text-slate-400">
            {isCodeMode
              ? '学校から配布された認証コードでアカウントを連携します'
              : 'Googleスプレッドシート直結型システム'}
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[11px] font-bold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            スプレッドシート連動中
          </div>
        </div>

        {/* 状態1: 通常ログインフォーム */}
        {!isCodeMode ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="例: parent@school.jp"
                autoComplete="email"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl text-sm font-medium text-white placeholder:text-slate-600 outline-none transition-all"
              />
              <p className="text-[11px] text-slate-400 leading-relaxed">
                ※初めてご利用の保護者様も、メールアドレスを入力して「ログイン」を押すと登録コード入力画面へ進みます。
              </p>
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2 text-rose-300 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || syncing}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {loading || syncing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  スプレッドシート照合中...
                </>
              ) : (
                <>
                  ログイン
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setIsCodeMode(true)
                }}
                className="text-xs text-amber-400 hover:text-amber-300 font-bold underline transition-colors"
              >
                学校から発行された「登録コード」をお持ちの方はこちら
              </button>
            </div>
          </form>
        ) : (
          /* 状態2: お子様の登録コード入力フォーム */
          <form onSubmit={handleCodeSubmit} className="space-y-4 animate-in fade-in duration-200">
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-200 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                初回連携・新入生登録
              </p>
              <p className="text-[11px] text-amber-300/80 leading-relaxed">
                学校から案内された4〜7桁の登録コード（例: <span className="font-mono font-bold text-amber-300">SB-7829</span> または <span className="font-mono font-bold text-amber-300">7829</span>）を入力してください。入力されたメールアドレスとお子様が紐付けられます。
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                保護者メールアドレス
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="例: parent@school.jp"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-amber-300 block flex items-center justify-between">
                <span>お子様の登録コード（認証コード）</span>
                <span className="text-[10px] text-slate-500 font-normal">英大文字または数字</span>
              </label>
              <input
                type="text"
                required
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value.toUpperCase())}
                placeholder="例: SB-7829"
                className="w-full px-4 py-3 bg-slate-950 border-2 border-amber-500/50 focus:border-amber-400 rounded-xl text-base font-mono font-bold text-amber-300 text-center tracking-widest placeholder:text-slate-700 outline-none shadow-inner"
              />
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2 text-rose-300 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2 text-emerald-300 text-xs font-bold">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || syncing}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {loading || syncing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  コード照合＆アカウント連携中...
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  連携してカレンダー予約へ進む
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setIsCodeMode(false)
                }}
                className="text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1 mx-auto transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                通常のログイン画面に戻る
              </button>
            </div>
          </form>
        )}

        {/* スプレッドシート登録済みアドレスのクイック選択 */}
        {!isCodeMode && sampleUsers.length > 0 && (
          <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400">
                登録済みアカウント（クリックで簡単入力）
              </span>
              <button
                type="button"
                onClick={() => refreshAll()}
                className="text-[10px] text-amber-400 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                再読み込み
              </button>
            </div>
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {sampleUsers.slice(0, 8).map((u, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setEmail(u.email)}
                  className="w-full text-left px-3 py-2 bg-slate-950/60 hover:bg-slate-800 border border-slate-850 hover:border-slate-700 rounded-xl flex items-center justify-between text-xs transition-all group"
                >
                  <div className="truncate">
                    <span className="font-bold text-slate-200 block truncate group-hover:text-amber-300">
                      {u.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block truncate">
                      {u.email}
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold shrink-0 ${
                    u.role === '管理者' ? 'bg-indigo-500/20 text-indigo-300' :
                    u.role === '運転手' ? 'bg-emerald-500/20 text-emerald-300' :
                    'bg-amber-500/20 text-amber-300'
                  }`}>
                    {u.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
