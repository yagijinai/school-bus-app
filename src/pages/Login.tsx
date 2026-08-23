import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { 
  Bus, User, ShieldCheck, KeyRound, 
  ArrowRight, AlertCircle, 
  Lock, RefreshCw, Smartphone
} from 'lucide-react'

type LoginRoleTab = 'parent' | 'driver' | 'admin'

export const Login: React.FC = () => {
  const navigate = useNavigate()
  const { 
    loginAsParent, 
    loginAsDriver, 
    loginAsAdmin, 
    signInDemoUser, 
    students,
    user,
    profile
  } = useAuth()

  const [activeTab, setActiveTab] = useState<LoginRoleTab>('parent')

  // 保護者ログイン入力
  const [parentStudentCode, setParentStudentCode] = useState('')
  const [parentVerificationCode, setParentVerificationCode] = useState('')

  // ドライバーログイン入力
  const [driverPin, setDriverPin] = useState('')

  // 管理者ログイン入力
  const [adminPassword, setAdminPassword] = useState('')

  // 状態管理
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [savedSession, setSavedSession] = useState<{
    role: string
    studentName?: string
    studentCode?: string
    full_name?: string
  } | null>(null)

  // 前回のセッション情報の読み込み
  useEffect(() => {
    try {
      const savedStr = localStorage.getItem('school_bus_active_session_v1')
      if (savedStr) {
        const saved = JSON.parse(savedStr)
        if (saved && saved.profile) {
          setSavedSession({
            role: saved.profile.role,
            studentName: saved.studentName,
            studentCode: saved.studentCode,
            full_name: saved.profile.full_name
          })
        }
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  // 既にログイン中の場合はリダイレクト
  useEffect(() => {
    if (user && profile) {
      if (profile.role === 'parent') navigate('/parent/dashboard')
      else if (profile.role === 'driver') navigate('/driver/dashboard')
      else if (profile.role === 'admin') navigate('/admin/dashboard')
    }
  }, [user, profile, navigate])

  // エラークリア
  const handleTabChange = (tab: LoginRoleTab) => {
    setActiveTab(tab)
    setErrorMessage(null)
  }

  // 保護者ログイン実行
  const handleParentLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setIsLoading(true)

    try {
      const res = await loginAsParent(parentStudentCode, parentVerificationCode)
      if (res.success) {
        navigate('/parent/dashboard')
      } else {
        setErrorMessage(res.error || '生徒IDまたは照合キーが一致しません。')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'ログイン中にエラーが発生しました。')
    } finally {
      setIsLoading(false)
    }
  }

  // ドライバーログイン実行
  const handleDriverLogin = async (e: React.FormEvent) => {
    e.preventDefault()
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

  // 管理者ログイン実行
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
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

  // 前回のセッションからの復帰
  const handleResumeSavedSession = () => {
    if (!savedSession) return
    if (savedSession.role === 'parent') {
      if (savedSession.studentCode) {
        // 保存されていた生徒情報でログイン
        const student = students.find(s => s.student_code === savedSession.studentCode || s.id === savedSession.studentCode)
        if (student) {
          loginAsParent(student.student_code || student.id, student.verification_code || student.name || '')
          return
        }
      }
      signInDemoUser('parent', false)
      navigate('/parent/dashboard')
    } else if (savedSession.role === 'driver') {
      loginAsDriver()
      navigate('/driver/dashboard')
    } else if (savedSession.role === 'admin') {
      loginAsAdmin('admin')
      navigate('/admin/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-10 sm:px-6 lg:px-8 relative overflow-hidden text-slate-100">
      
      {/* 背景のグラデーションオーブ装飾 */}
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
          保護者予約・リアルタイム遅延見守り・ドライバー点呼を一元管理
        </p>
      </div>

      {/* メインログインカード */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg z-10 px-4">
        <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-2xl py-6 sm:py-8 px-4 sm:px-8 shadow-2xl rounded-3xl space-y-6">
          
          {/* 前回セッションがある場合のクイック復帰バナー */}
          {savedSession && (
            <div className="p-3.5 bg-gradient-to-r from-indigo-950/70 to-purple-950/70 border border-indigo-500/30 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
                  <Smartphone className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider block">
                    前回のログイン情報
                  </span>
                  <p className="text-xs font-bold text-white truncate">
                    {savedSession.studentName ? `${savedSession.studentName} 保護者様` : savedSession.full_name || '前回利用ユーザー'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleResumeSavedSession}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs rounded-xl transition-all shrink-0 flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
              >
                <span>開く</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* 3つのロール選択タブ */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2 text-center">
              利用者の役割（ロール）を選択してください
            </label>
            <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-850">
              
              {/* 保護者タブ */}
              <button
                type="button"
                onClick={() => handleTabChange('parent')}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                  activeTab === 'parent'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <User className="h-4 w-4 shrink-0" />
                <span>保護者の方</span>
              </button>

              {/* ドライバータブ */}
              <button
                type="button"
                onClick={() => handleTabChange('driver')}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                  activeTab === 'driver'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <Bus className="h-4 w-4 shrink-0" />
                <span>乗務員</span>
              </button>

              {/* 管理者タブ */}
              <button
                type="button"
                onClick={() => handleTabChange('admin')}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                  activeTab === 'admin'
                    ? 'bg-purple-500 text-white font-black shadow-lg shadow-purple-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>学校管理者</span>
              </button>

            </div>
          </div>

          {/* エラーメッセージ表示 */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs font-bold flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 1. 保護者ログインフォーム */}
          {/* ========================================================= */}
          {activeTab === 'parent' && (
            <form onSubmit={handleParentLogin} className="space-y-4 animate-in fade-in duration-200">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    生徒ID（学校配布コード） <span className="text-amber-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={parentStudentCode}
                      onChange={(e) => setParentStudentCode(e.target.value)}
                      placeholder="例: A101 または TEST-001"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono font-bold placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                    <KeyRound className="h-4 w-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    照合キー または 生徒氏名 <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={parentVerificationCode}
                    onChange={(e) => setParentVerificationCode(e.target.value)}
                    placeholder="例: PASS01 または 生徒のフルネーム"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    ※学校配布の登録用紙に記載の照合キー、または生徒氏名を入力してください。
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-95 text-slate-950 font-black rounded-2xl text-xs transition-all flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 disabled:opacity-50"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>保護者マイページへログイン</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              {/* デモ・お試しクイック選択 */}
              <div className="pt-3 border-t border-slate-850 space-y-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block text-center">
                  または サンプル生徒でワンタップ体験:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setParentStudentCode('A101')
                      setParentVerificationCode('PASS01')
                      loginAsParent('A101', 'PASS01').then(() => navigate('/parent/dashboard'))
                    }}
                    className="p-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded-xl text-left transition-all active:scale-95"
                  >
                    <div className="text-xs font-bold text-white">山田 花子</div>
                    <div className="text-[10px] text-slate-400 font-mono">ID: A101 (2名兄弟)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setParentStudentCode('TEST-001')
                      setParentVerificationCode('PASS01')
                      loginAsParent('TEST-001', 'PASS01').then(() => navigate('/parent/dashboard'))
                    }}
                    className="p-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded-xl text-left transition-all active:scale-95"
                  >
                    <div className="text-xs font-bold text-white">佐藤 結衣</div>
                    <div className="text-[10px] text-slate-400 font-mono">ID: TEST-001 (1年生)</div>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ========================================================= */}
          {/* 2. ドライバーログインフォーム */}
          {/* ========================================================= */}
          {activeTab === 'driver' && (
            <form onSubmit={handleDriverLogin} className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-xs text-emerald-300 flex items-start gap-2.5">
                <Bus className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  スクールバス乗務員専用の点呼・運行管理画面です。現場の乗務員端末からワンタップで即座にアクセスできます。
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  乗務員認証PIN（任意 / 未入力可）
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={driverPin}
                    onChange={(e) => setDriverPin(e.target.value)}
                    placeholder="1234（省略可）"
                    maxLength={6}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono text-center tracking-widest placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <Lock className="h-4 w-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-slate-950 font-black rounded-2xl text-xs transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 disabled:opacity-50"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Bus className="h-4 w-4" />
                    <span>運行乗務員画面を開く</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ========================================================= */}
          {/* 3. 学校管理者ログインフォーム */}
          {/* ========================================================= */}
          {activeTab === 'admin' && (
            <form onSubmit={handleAdminLogin} className="space-y-4 animate-in fade-in duration-200">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 text-xs text-purple-300 flex items-start gap-2.5">
                <ShieldCheck className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  学校管理者（教頭・運行主任）専用のダッシュボードです。ダイヤ調整、名簿管理、印刷、システム保守を行います。
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  管理者パスワード <span className="text-purple-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="管理者パスワードを入力 (初期値: admin)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                  <Lock className="h-4 w-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 active:scale-95 text-white font-black rounded-2xl text-xs transition-all flex items-center justify-center gap-2 shadow-xl shadow-purple-500/20 disabled:opacity-50"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>管理者ダッシュボードへログイン</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}

        </div>

        {/* フッター情報 */}
        <div className="mt-6 text-center text-xs text-slate-500">
          <p>© 2026 スクールバス運行管理システム</p>
        </div>

      </div>
    </div>
  )
}
