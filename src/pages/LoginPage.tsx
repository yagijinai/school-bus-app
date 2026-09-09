import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Bus, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react'

export const LoginPage: React.FC = () => {
  const { login, userPermissions, guardianMaster, syncing, refreshAll } = useApp()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
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
        setError(res.message || 'ログインに失敗しました')
      }
    } finally {
      setLoading(false)
    }
  }

  // スプレッドシートから取得した登録済みメール候補リスト（テスト用クイックログイン）
  const sampleUsers = [
    ...userPermissions.map(p => ({ email: p.email, name: `${p.name} (${p.role})`, role: p.role })),
    ...guardianMaster.map(g => ({ email: g.parent_email, name: `${g.student_names.join('・')} の保護者`, role: '保護者' as const }))
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
            <Bus className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">スクールバス運行管理</h1>
          <p className="text-xs text-slate-400">
            Googleスプレッドシート直結型システム
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[11px] font-bold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            スプレッドシート連動中
          </div>
        </div>

        {/* ログインフォーム */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">
              メールアドレス
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="例: parent@school.jp"
              autoComplete="email"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl text-sm font-medium text-white placeholder:text-slate-600 outline-none transition-all"
            />
            <p className="text-[11px] text-slate-500">
              ※スプレッドシートの登録アドレスと完全一致で照合されます。
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
        </form>

        {/* スプレッドシート登録済みアドレスのクイック選択 */}
        {sampleUsers.length > 0 && (
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
