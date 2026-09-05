import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import type { GuardianMasterRow } from '../types/app'
import { 
  User, ArrowRight, ArrowLeft, 
  GraduationCap, FileSpreadsheet,
  KeyRound, Search, CheckCircle2, AlertCircle, RefreshCw
} from 'lucide-react'
import { getGuardianData } from '../lib/api/gas'

type RegisterTab = 'verify' | 'direct'

export const Register: React.FC = () => {
  const { 
    user,
    busStops, 
    registerGuardianProfile,
    signOut,
    refreshData 
  } = useAuth()
  const navigate = useNavigate()

  const defaultEmail = user?.email || ''
  const [activeTab, setActiveTab] = useState<RegisterTab>('verify')

  // 1. 照合タブ用状態
  const [verifyEmail, setVerifyEmail] = useState(defaultEmail)
  const [verifyCode, setVerifyCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyMessage, setVerifyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 2. 直接登録タブ用状態
  const [email, setEmail] = useState(defaultEmail)
  const [studentName1, setStudentName1] = useState('')
  const [studentName2, setStudentName2] = useState('')
  const [studentName3, setStudentName3] = useState('')
  const [studentName4, setStudentName4] = useState('')
  const [busStopName, setBusStopName] = useState(busStops[0]?.stop_name || '草香会館')
  const [defaultMorning, setDefaultMorning] = useState<'乗る' | '乗らない'>('乗る')
  const [defaultAfternoon, setDefaultAfternoon] = useState<string>('2便')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (user?.email) {
      setVerifyEmail(user.email)
      setEmail(user.email)
    }
  }, [user])

  // トップ画面・ダッシュボードへ戻る
  const handleCancelAndReturn = () => {
    navigate('/parent/dashboard')
  }

  // 1. 生徒照合コード・メールアドレスによるスプレッドシート照合（action: "getGuardianData"）
  const handleVerifyStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerifyMessage(null)
    const targetEmail = (verifyEmail || defaultEmail).trim().toLowerCase()
    
    if (!targetEmail && !verifyCode.trim()) {
      setVerifyMessage({ type: 'error', text: '保護者メールアドレスまたは照合コードを入力してください。' })
      return
    }

    setIsVerifying(true)
    try {
      // メールアドレスまたは照合コードでGAS問い合わせ
      const res = await getGuardianData(targetEmail || verifyCode.trim())
      if (res.success && res.students && res.students.length > 0) {
        setVerifyMessage({ 
          type: 'success', 
          text: `生徒データ（${res.students.map(s => s.name).join('、')} 様）の照合に成功しました！ダッシュボードへ移動します。` 
        })
        await refreshData()
        setTimeout(() => {
          navigate('/parent/dashboard')
        }, 1200)
      } else {
        setVerifyMessage({ 
          type: 'error', 
          text: res.error || 'スプレッドシートに一致する生徒データが見つかりませんでした。「新規入力で登録」タブから新規登録をお試しください。' 
        })
      }
    } catch (err: any) {
      console.error('Verification error:', err)
      setVerifyMessage({ type: 'error', text: err.message || '通信エラーが発生しました。' })
    } finally {
      setIsVerifying(false)
    }
  }

  // 2. 「生徒・保護者マスター」への新規登録送信（action: "saveGuardianMaster"）
  const handleSubmitDirect = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const targetEmail = (email || defaultEmail).trim().toLowerCase()
    if (!targetEmail) {
      alert('保護者メールアドレスを入力してください。')
      return
    }

    if (!studentName1.trim()) {
      alert('生徒名１（少なくとも1名以上のお子様のお名前）を入力してください。')
      return
    }

    setIsSubmitting(true)

    const payload: GuardianMasterRow = {
      email: targetEmail,
      student_name_1: studentName1.trim(),
      student_name_2: studentName2.trim() || null,
      student_name_3: studentName3.trim() || null,
      student_name_4: studentName4.trim() || null,
      bus_stop_name: busStopName,
      note: note.trim() || null,
      default_morning: defaultMorning,
      default_afternoon: defaultAfternoon
    }

    try {
      const success = await registerGuardianProfile(payload)
      if (success) {
        await refreshData()
        navigate('/parent/dashboard')
      }
    } catch (err: any) {
      console.error('Registration submit error:', err)
      alert(err.message || '登録処理中にエラーが発生しました。')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center py-10 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* 背景グラデーション */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* トップへ戻るボタン */}
      <div className="sm:mx-auto sm:w-full sm:max-w-xl z-10 px-4 mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={handleCancelAndReturn}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-850 px-3.5 py-2 rounded-xl border border-slate-800 transition-all active:scale-95 shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          ダッシュボードへ戻る
        </button>

        <button
          type="button"
          onClick={() => signOut()}
          className="text-xs font-bold text-slate-500 hover:text-rose-400 transition-all"
        >
          ログアウト
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl z-10 px-4 text-center">
        <div className="inline-flex p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl mb-3 border border-indigo-500/30">
          <GraduationCap className="h-7 w-7" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          生徒の照合・保護者マスター登録
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-400">
          Googleスプレッドシート「生徒・保護者マスター」とお子様情報を連携します
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl z-10 px-4">
        <div className="bg-slate-900/90 backdrop-blur-xl py-6 px-5 sm:px-8 shadow-2xl border border-slate-800 rounded-3xl space-y-6">
          
          {/* タブ切り替え */}
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => { setActiveTab('verify'); setVerifyMessage(null); }}
              className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                activeTab === 'verify'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <KeyRound className="h-4 w-4" />
              <span>事前登録コードで照合</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('direct'); setVerifyMessage(null); }}
              className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                activeTab === 'direct'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>新規入力で直接登録</span>
            </button>
          </div>

          {/* メッセージ表示 */}
          {verifyMessage && (
            <div className={`p-4 rounded-2xl text-xs font-bold flex items-start gap-2.5 animate-in fade-in ${
              verifyMessage.type === 'success' 
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
            }`}>
              {verifyMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed">{verifyMessage.text}</div>
            </div>
          )}

          {/* 1. 照合タブフォーム */}
          {activeTab === 'verify' && (
            <form onSubmit={handleVerifyStudent} className="space-y-4 animate-in fade-in">
              <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-xs text-indigo-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <KeyRound className="h-4 w-4 text-indigo-400" />
                  学校から配布された照合キーまたはメールアドレスで検索
                </p>
                <p className="text-[11px] text-indigo-200/80">
                  スプレッドシートに事前登録されたデータとGoogleアカウントを紐付けます。
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  保護者メールアドレス <span className="text-indigo-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={verifyEmail}
                    onChange={(e) => setVerifyEmail(e.target.value)}
                    placeholder="parent@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                  <User className="h-4 w-4 text-slate-500 absolute right-3.5 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  生徒ID / 照合コード（任意・指定がある場合）
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    placeholder="STU-101 または PASS101"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <KeyRound className="h-4 w-4 text-slate-500 absolute right-3.5 top-3 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-95 text-white font-black rounded-2xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 disabled:opacity-50"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>スプレッドシート照合中...</span>
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    <span>スプレッドシートと照合して登録</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* 2. 直接新規登録タブフォーム */}
          {activeTab === 'direct' && (
            <form onSubmit={handleSubmitDirect} className="space-y-4 animate-in fade-in">
              
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  保護者メールアドレス（Googleアカウント） <span className="text-amber-400">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              {/* 生徒名１〜４ */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <GraduationCap className="h-4 w-4 text-amber-400" />
                  お子様のお名前（最大4名）
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      生徒名１ <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={studentName1}
                      onChange={(e) => setStudentName1(e.target.value)}
                      placeholder="例: 佐藤 健太"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      生徒名２ (きょうだい・任意)
                    </label>
                    <input
                      type="text"
                      value={studentName2}
                      onChange={(e) => setStudentName2(e.target.value)}
                      placeholder="例: 佐藤 結衣"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      生徒名３ (任意)
                    </label>
                    <input
                      type="text"
                      value={studentName3}
                      onChange={(e) => setStudentName3(e.target.value)}
                      placeholder="例: 佐藤 悠真"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      生徒名４ (任意)
                    </label>
                    <input
                      type="text"
                      value={studentName4}
                      onChange={(e) => setStudentName4(e.target.value)}
                      placeholder="例: 佐藤 陽菜"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* 登録バス停名 */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  登録バス停名 <span className="text-amber-400">*</span>
                </label>
                <select
                  value={busStopName}
                  onChange={(e) => setBusStopName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {busStops.map(stop => (
                    <option key={stop.id} value={stop.stop_name}>
                      {stop.order_index}. {stop.stop_name} (朝 {stop.arrival_time_morning?.substring(0, 5) || '07:30'}着)
                    </option>
                  ))}
                </select>
              </div>

              {/* 基本_登校 & 基本_下校 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">基本_登校</label>
                  <select
                    value={defaultMorning}
                    onChange={(e) => setDefaultMorning(e.target.value as '乗る' | '乗らない')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="乗る">乗る（標準運行）</option>
                    <option value="乗らない">乗らない</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">基本_下校</label>
                  <select
                    value={defaultAfternoon}
                    onChange={(e) => setDefaultAfternoon(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="1便">1便 (下校1便)</option>
                    <option value="2便">2便 (下校2便)</option>
                    <option value="3便">3便 (下校3便)</option>
                    <option value="乗らない">乗らない</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">備考 (任意)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="連絡事項や特記事項があればご入力ください"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-500 hover:to-yellow-500 active:scale-95 text-slate-950 font-black rounded-2xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>GAS経由でスプレッドシートへ保存中...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>スプレッドシートへ登録して完了</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  )
}
