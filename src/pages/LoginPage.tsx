import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { 
  Bus, ArrowRight, RefreshCw, AlertCircle, KeyRound, CheckCircle2, 
  ChevronLeft, ChevronDown, ShieldCheck, Users, Sparkles
} from 'lucide-react'

export const LoginPage: React.FC = () => {
  const { login, linkStudentWithCode, quickLoginAs, loginAsParentStudent, guardianMaster, refreshAll, syncing } = useApp()
  const navigate = useNavigate()
  
  const [email, setEmail] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [isCodeMode, setIsCodeMode] = useState(false)
  const [isManualOpen, setIsManualOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedRoleType, setSelectedRoleType] = useState<string | null>(null)

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

  // スプレッドシート「生徒・保護者マスター」から全生徒リストを動的生成
  interface StudentEntry {
    studentName: string
    parentEmail: string
    busStopName: string
    defaultMorning: string
    defaultAfternoon: string
    authCode: string
  }

  const studentList = useMemo(() => {
    const list: StudentEntry[] = []
    const seen = new Set<string>()

    guardianMaster.forEach(g => {
      const names = g.student_names && g.student_names.length > 0
        ? g.student_names
        : [g.student_name_1, g.student_name_2, g.student_name_3, g.student_name_4].filter(Boolean) as string[]

      names.forEach(name => {
        const cleanName = String(name || '').trim()
        if (cleanName && !seen.has(cleanName)) {
          seen.add(cleanName)
          list.push({
            studentName: cleanName,
            parentEmail: g.parent_email || '',
            busStopName: g.bus_stop_name || '',
            defaultMorning: g.default_morning || '',
            defaultAfternoon: g.default_afternoon || '',
            authCode: g.auth_code || ''
          })
        }
      })
    })
    return list
  }, [guardianMaster])

  // 管理者・運転手ログイン処理
  const handleQuickRoleLogin = async (type: 'admin' | 'driver') => {
    setError(null)
    setLoading(true)
    setSelectedRoleType(type)
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
      setSelectedRoleType(null)
    }
  }

  // 生徒保護者ワンタップログイン処理
  const handleStudentParentLogin = async (studentName: string) => {
    setError(null)
    setLoading(true)
    setSelectedRoleType(`parent_${studentName}`)
    try {
      await loginAsParentStudent(studentName)
      navigate('/parent')
    } catch (err: any) {
      setError(err.message || 'ログインに失敗しました')
    } finally {
      setLoading(false)
      setSelectedRoleType(null)
    }
  }

  // 通常の手動メールログイン処理
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
      if (res.success) {
        // AppRoutesでロールに応じて自動リダイレクト
      } else {
        if (res.needAuthCode) {
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
        setTimeout(() => {
          navigate('/parent')
        }, 1000)
      } else {
        setError(res.message || '登録コードの照合に失敗しました。コードをご確認ください。')
      }
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
              <Sparkles className="h-3 w-3 text-amber-400" />
              お試し検証用ログイン
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/25 rounded-full text-[11px] font-bold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              スプレッドシート連動
            </span>
          </div>
          <p className="text-xs text-slate-400 pt-1 leading-relaxed">
            ワンタップで各立場（ロール）の画面へ即座にアクセスできます。<br className="hidden sm:inline" />
            各機能の動作や見え方を手軽にお試し・検証いただけます。
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2 text-rose-300 text-xs animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* ① お試しロール選択ログインパネル（4つの大型ボタン） */}
        {/* ========================================================= */}
        <div className="space-y-2.5">
          {/* 1. 🏫 学校管理者としてログイン */}
          <button
            type="button"
            disabled={loading || syncing}
            onClick={() => handleQuickRoleLogin('admin')}
            className="w-full text-left p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 hover:from-indigo-900/80 hover:to-slate-850 border border-indigo-500/40 hover:border-indigo-400/80 shadow-md transition-all active:scale-[0.99] group cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2.5 bg-indigo-500/20 text-indigo-300 rounded-xl shrink-0 group-hover:scale-105 transition-transform mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm sm:text-base font-black text-white group-hover:text-indigo-200">
                      🏫 学校管理者としてログイン
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold">
                      /admin
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200/80 mt-1 font-medium">
                    時刻表の自動生成・確定ロック・運休設定
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    教頭・運行管理者の視点で操作
                  </p>
                </div>
              </div>
              <div className="shrink-0 p-1.5 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 group-hover:translate-x-0.5 transition-all">
                {selectedRoleType === 'admin' ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-300" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
              </div>
            </div>
          </button>

          {/* 2. 👨‍✈️ 運転手としてログイン */}
          <button
            type="button"
            disabled={loading || syncing}
            onClick={() => handleQuickRoleLogin('driver')}
            className="w-full text-left p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 hover:from-emerald-900/80 hover:to-slate-850 border border-emerald-500/40 hover:border-emerald-400/80 shadow-md transition-all active:scale-[0.99] group cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-300 rounded-xl shrink-0 group-hover:scale-105 transition-transform mt-0.5">
                  <Bus className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm sm:text-base font-black text-white group-hover:text-emerald-200">
                      👨‍✈️ 運転手としてログイン
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                      /driver
                    </span>
                  </div>
                  <p className="text-xs text-emerald-200/80 mt-1 font-medium">
                    スマホ片手点呼・リアルタイム乗車記録
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    スクールバス乗務員の視点で操作
                  </p>
                </div>
              </div>
              <div className="shrink-0 p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 group-hover:translate-x-0.5 transition-all">
                {selectedRoleType === 'driver' ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-300" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
              </div>
            </div>
          </button>

          {/* 保護者ログインセクション見出し ＆ 同期インジケータ */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-black text-amber-400">
              <Users className="w-3.5 h-3.5" />
              <span>保護者としてログイン（生徒選択）</span>
            </div>
            <button
              type="button"
              onClick={() => refreshAll()}
              disabled={syncing}
              className="text-[11px] text-slate-400 hover:text-amber-400 font-bold flex items-center gap-1 transition-colors cursor-pointer px-2 py-0.5 rounded-lg hover:bg-slate-800"
              title="スプレッドシートから最新の生徒データを再取得"
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin text-amber-400' : ''}`} />
              <span>{syncing ? '同期中...' : '最新データに更新'}</span>
            </button>
          </div>

          {/* 生徒一覧ボタン（動的生成） */}
          {studentList.length > 0 ? (
            studentList.map((st) => {
              const isCurrentSelected = selectedRoleType === `parent_${st.studentName}`
              return (
                <button
                  key={st.studentName}
                  type="button"
                  disabled={loading || syncing}
                  onClick={() => handleStudentParentLogin(st.studentName)}
                  className="w-full text-left p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-950/70 via-slate-900 to-slate-900 hover:from-amber-900/80 hover:to-slate-850 border border-amber-500/40 hover:border-amber-400/80 shadow-md transition-all active:scale-[0.99] group cursor-pointer disabled:opacity-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2.5 bg-amber-500/20 text-amber-300 rounded-xl shrink-0 group-hover:scale-105 transition-transform mt-0.5">
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm sm:text-base font-black text-white group-hover:text-amber-200">
                            👨‍👩‍👦 {st.studentName} の保護者としてログイン
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold">
                            /parent
                          </span>
                        </div>
                        <p className="text-xs text-amber-200/80 mt-1 font-medium">
                          登録バス停: <strong className="text-white font-bold">{st.busStopName || '未設定'}</strong>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>基本設定: 登校 {st.defaultMorning || '未設定'} / 下校 {st.defaultAfternoon || '未設定'}</span>
                          {st.authCode && (
                            <span className="font-mono text-slate-500">（認証コード: {st.authCode}）</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 p-1.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 group-hover:translate-x-0.5 transition-all">
                      {isCurrentSelected ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          ) : syncing ? (
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-center gap-2 text-xs text-amber-300/80">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span>最新の生徒データをスプレッドシートから読み込み中...</span>
            </div>
          ) : (
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl text-center text-xs text-slate-400">
              登録されている生徒データがありません。スプレッドシートの「生徒・保護者マスター」をご確認ください。
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* ② 手動入力・認証コード登録（アコーディオン） */}
        {/* ========================================================= */}
        <div className="pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => setIsManualOpen(prev => !prev)}
            className="w-full py-2 text-center text-xs text-slate-400 hover:text-slate-200 font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer select-none"
          >
            <span>✉️ メールアドレス直接入力・登録コード入力はこちら</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isManualOpen ? 'rotate-180' : ''}`} />
          </button>

          {isManualOpen && (
            <div className="mt-3 p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
              {!isCodeMode ? (
                <form onSubmit={handleLoginSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">
                      メールアドレス直接入力
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="例: parent@school.jp"
                      autoComplete="email"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || syncing}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                    手動ログイン
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCodeMode(true)}
                      className="text-[11px] text-amber-400 hover:underline"
                    >
                      学校発行の登録コード入力（初回連携）はこちら
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleCodeSubmit} className="space-y-3 animate-in fade-in">
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-200">
                    学校配布の登録コード（例: <span className="font-mono font-bold text-amber-300">SB-7829</span>）を入力してください。
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">
                      保護者メールアドレス
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="例: parent@school.jp"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-amber-300 block">
                      登録コード（認証コード）
                    </label>
                    <input
                      type="text"
                      required
                      value={authCode}
                      onChange={(e) => setAuthCode(e.target.value.toUpperCase())}
                      placeholder="例: SB-7829"
                      className="w-full px-3 py-2 bg-slate-900 border border-amber-500/50 rounded-xl text-sm font-mono font-bold text-amber-300 text-center tracking-widest"
                    />
                  </div>

                  {successMessage && (
                    <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-1.5 font-bold">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>{successMessage}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || syncing}
                    className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    コード照合してログイン
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCodeMode(false)}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center justify-center gap-1 mx-auto"
                    >
                      <ChevronLeft className="h-3 w-3" />
                      メール入力に戻る
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
