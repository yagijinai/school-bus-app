import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import type { Student } from '../types/app'
import { 
  User, Plus, Trash2, Bus, ArrowRight, ArrowLeft, 
  MapPin, KeyRound, Search, CheckCircle2, AlertCircle, 
  ShieldCheck, GraduationCap, Clock
} from 'lucide-react'

interface StudentRegistrationItem {
  inputStudentCode: string
  inputVerificationCode: string
  verifiedStudent: Student | null
  verifyError: string | null
  isVerifying: boolean
  
  // 登録時の設定項目
  routeId: string
  stopId: string
  defaultMorningRide: boolean
  defaultAfternoonSchedule: string | null
}

export const Register: React.FC = () => {
  const { 
    registerParentProfile, 
    verifyStudentForRegistration, 
    busStops, 
    busRoutes,
    signOut, 
    getTripTime 
  } = useAuth()
  const navigate = useNavigate()

  const [parentName, setParentName] = useState('')
  const [students, setStudents] = useState<StudentRegistrationItem[]>([
    {
      inputStudentCode: '',
      inputVerificationCode: '',
      verifiedStudent: null,
      verifyError: null,
      isVerifying: false,
      routeId: busStops[0]?.bus_route_id || '',
      stopId: busStops[0]?.id || '',
      defaultMorningRide: true,
      defaultAfternoonSchedule: '下校2便'
    }
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // busStopsがロードされたら初期stopIdを設定
  useEffect(() => {
    if (busStops.length > 0 && (!students[0]?.stopId || !students[0]?.routeId)) {
      const defaultStop = busStops[0]
      setStudents(prev => prev.map(s => ({
        ...s,
        stopId: s.stopId || defaultStop.id,
        routeId: s.routeId || defaultStop.bus_route_id || ''
      })))
    }
  }, [busStops])

  // 世帯共通の利用バス停変更ハンドラ（きょうだい全員のバス停を一括同期）
  const handleSharedStopChange = (stopId: string) => {
    const selectedStop = busStops.find(s => s.id === stopId)
    const routeId = selectedStop?.bus_route_id || ''
    setStudents(prev => prev.map(s => ({
      ...s,
      stopId,
      routeId
    })))
  }

  // 生徒の照合を実行
  const handleVerifyStudent = async (index: number) => {
    const target = students[index]
    if (!target.inputStudentCode.trim() || !target.inputVerificationCode.trim()) {
      const newStudents = [...students]
      newStudents[index] = {
        ...target,
        verifyError: '生徒IDと照合キー（パスコード）の両方を入力してください。'
      }
      setStudents(newStudents)
      return
    }

    // 照合中ローディング
    const loadingStudents = [...students]
    loadingStudents[index] = { ...target, isVerifying: true, verifyError: null }
    setStudents(loadingStudents)

    try {
      const result = await verifyStudentForRegistration(target.inputStudentCode, target.inputVerificationCode)
      const newStudents = [...students]

      if (result.success && result.student) {
        // 既に同じ生徒がフォーム内の別行で照合されていないか確認
        const isAlreadyAdded = students.some((s, i) => i !== index && s.verifiedStudent?.id === result.student?.id)
        if (isAlreadyAdded) {
          newStudents[index] = {
            ...target,
            isVerifying: false,
            verifyError: 'この生徒は既に追加されています。'
          }
          setStudents(newStudents)
          return
        }

        // 世帯共通バス停を引き継ぐ（1人目のバス停または事前登録バス停）
        const commonStopId = students[0]?.stopId || result.student.default_bus_stop_id || busStops[0]?.id || ''
        const selectedStop = busStops.find(s => s.id === commonStopId)
        const commonRouteId = selectedStop?.bus_route_id || result.student.bus_route_id || busRoutes[0]?.id || ''

        newStudents[index] = {
          ...target,
          isVerifying: false,
          verifiedStudent: result.student,
          verifyError: null,
          stopId: commonStopId,
          routeId: commonRouteId,
          defaultMorningRide: result.student.default_morning_ride ?? true,
          defaultAfternoonSchedule: result.student.default_afternoon_schedule || '下校2便'
        }
      } else {
        newStudents[index] = {
          ...target,
          isVerifying: false,
          verifiedStudent: null,
          verifyError: result.error || '該当する生徒が見つかりません。学校から配布された登録情報をご確認ください。'
        }
      }

      setStudents(newStudents)
    } catch (err) {
      const newStudents = [...students]
      newStudents[index] = {
        ...target,
        isVerifying: false,
        verifyError: '照合通信中にエラーが発生しました。もう一度お試しください。'
      }
      setStudents(newStudents)
    }
  }

  // 照合リセット（再入力）
  const handleResetVerification = (index: number) => {
    const newStudents = [...students]
    const commonStopId = students[0]?.stopId || busStops[0]?.id || ''
    const selectedStop = busStops.find(s => s.id === commonStopId)
    newStudents[index] = {
      inputStudentCode: '',
      inputVerificationCode: '',
      verifiedStudent: null,
      verifyError: null,
      isVerifying: false,
      stopId: commonStopId,
      routeId: selectedStop?.bus_route_id || busRoutes[0]?.id || '',
      defaultMorningRide: true,
      defaultAfternoonSchedule: '下校2便'
    }
    setStudents(newStudents)
  }

  // きょうだい入力枠を追加
  const handleAddStudent = () => {
    if (students.length >= 5) {
      alert('生徒は最大5名まで登録可能です。')
      return
    }
    const commonStopId = students[0]?.stopId || (busStops[0]?.id || '')
    const selectedStop = busStops.find(s => s.id === commonStopId)
    const commonRouteId = students[0]?.routeId || selectedStop?.bus_route_id || busRoutes[0]?.id || ''
    setStudents([
      ...students, 
      { 
        inputStudentCode: '',
        inputVerificationCode: '',
        verifiedStudent: null,
        verifyError: null,
        isVerifying: false,
        routeId: commonRouteId, 
        stopId: commonStopId, 
        defaultMorningRide: true, 
        defaultAfternoonSchedule: '下校2便' 
      }
    ])
  }

  // きょうだい入力枠を削除
  const handleRemoveStudent = (index: number) => {
    if (students.length <= 1) return
    const newStudents = [...students]
    newStudents.splice(index, 1)
    setStudents(newStudents)
  }

  // 登下校パターンの変更
  const handlePatternChange = (index: number, field: 'defaultMorningRide' | 'defaultAfternoonSchedule', value: any) => {
    const newStudents = [...students]
    newStudents[index] = {
      ...newStudents[index],
      [field]: value
    }
    setStudents(newStudents)
  }

  // トップ画面へ戻る
  const handleCancelAndReturn = async () => {
    await signOut()
    navigate('/')
  }

  // プロフィール登録送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!parentName.trim()) {
      alert('保護者氏名を入力してください。')
      return
    }

    // 全ての生徒が照合完了しているか確認
    const unverifiedIndex = students.findIndex(s => !s.verifiedStudent)
    if (unverifiedIndex !== -1) {
      alert(`生徒${unverifiedIndex + 1}の照合が完了していません。学校から配布された生徒IDと照合キーを入力して「生徒を照合する」を実行してください。`)
      return
    }

    setIsSubmitting(true)

    const payload = students.map(s => ({
      studentId: s.verifiedStudent!.id,
      name: s.verifiedStudent!.name,
      routeId: s.routeId,
      stopId: s.stopId,
      defaultMorningRide: s.defaultMorningRide,
      defaultAfternoonSchedule: s.defaultAfternoonSchedule
    }))

    try {
      const success = await registerParentProfile(parentName, payload)
      if (success) {
        navigate('/parent/dashboard')
      }
    } catch (err) {
      console.error('Submit error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 選択中の世帯共通バス停
  const currentCommonStopId = students[0]?.stopId || (busStops[0]?.id || '')
  const currentCommonStop = busStops.find(s => s.id === currentCommonStopId)

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* 背景装飾 */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl" />

      {/* トップへ戻るボタン（上部） */}
      <div className="sm:mx-auto sm:w-full sm:max-w-xl z-10 px-4 mb-4">
        <button
          type="button"
          onClick={handleCancelAndReturn}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-850 px-3.5 py-2 rounded-xl border border-slate-800 transition-all active:scale-95 shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          ログイン・トップ画面へ戻る
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl z-10 px-4">
        <h2 className="text-center text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
          <Bus className="h-8 w-8 text-indigo-400" />
          保護者・生徒プロフィールの初期登録
        </h2>
        <p className="mt-2 text-center text-xs sm:text-sm text-slate-400">
          安全な運行管理のため、学校から配布された<strong>【生徒ID】</strong>と<strong>【照合キー】</strong>で照合・紐付けを行います。
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl z-10 px-4">
        <div className="bg-white/5 backdrop-blur-xl py-8 px-6 shadow-2xl ring-1 ring-white/10 rounded-3xl sm:px-10">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* 1. 保護者氏名 */}
            <div>
              <label htmlFor="parent-name" className="block text-sm font-semibold text-slate-300">
                保護者（あなた）の氏名
              </label>
              <div className="mt-2.5 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  id="parent-name"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-slate-900/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                  placeholder="例：山田 太郎"
                  required
                />
              </div>
            </div>

            {/* 2. 世帯共通の利用バス停（きょうだい共通） */}
            <div className="bg-slate-900/70 border border-indigo-500/30 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-indigo-400" />
                  世帯共通の利用バス停（乗降場所）
                </label>
                <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 font-bold">
                  きょうだい自動連動
                </span>
              </div>
              <select
                value={currentCommonStopId}
                onChange={(e) => handleSharedStopChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {busStops.map(stop => (
                  <option key={stop.id} value={stop.id}>
                    {stop.order_index}. {stop.stop_name} (朝 {stop.arrival_time_morning?.substring(0, 5) || ''}着)
                  </option>
                ))}
              </select>
              {currentCommonStop && (
                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                  <Clock className="h-3.5 w-3.5 text-indigo-400" />
                  朝の定刻予定時刻：
                  <strong className="text-indigo-300 font-mono font-bold">
                    {currentCommonStop.arrival_time_morning?.substring(0, 5) || '未設定'}
                  </strong>
                </p>
              )}
            </div>

            {/* 3. 生徒情報の事前登録照合カード一覧 */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-indigo-400" />
                  生徒（お子様）の照合・登録
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {students.length}名登録中
                </span>
              </div>

              {students.map((studentItem, index) => {
                const isVerified = !!studentItem.verifiedStudent

                return (
                  <div 
                    key={index}
                    className={`border rounded-2xl p-5 space-y-4 transition-all duration-200 ${
                      isVerified
                        ? 'bg-emerald-950/20 border-emerald-500/40 ring-1 ring-emerald-500/20'
                        : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          生徒 {index + 1}
                        </span>
                        {isVerified ? (
                          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            照合完了
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            <KeyRound className="h-3.5 w-3.5" />
                            照合待ち
                          </span>
                        )}
                      </div>

                      {students.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveStudent(index)}
                          className="text-xs text-slate-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          削除
                        </button>
                      )}
                    </div>

                    {/* 未照合の場合：生徒IDと照合キーの入力フォーム */}
                    {!isVerified ? (
                      <div className="space-y-3 pt-1">
                        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-850 text-xs text-slate-400 space-y-1">
                          <p className="font-bold text-slate-300 flex items-center gap-1">
                            <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                            学校からの配布用紙をご確認ください
                          </p>
                          <p className="text-[11px] text-slate-500">
                            例: 生徒ID「STU-101」、照合キー「PASS101」（または氏名）
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">
                              生徒ID（学籍コード）
                            </label>
                            <input
                              type="text"
                              placeholder="例：STU-101"
                              value={studentItem.inputStudentCode}
                              onChange={(e) => {
                                const newStudents = [...students]
                                newStudents[index].inputStudentCode = e.target.value
                                newStudents[index].verifyError = null
                                setStudents(newStudents)
                              }}
                              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">
                              照合キー / 初期パスコード
                            </label>
                            <input
                              type="text"
                              placeholder="例：PASS101"
                              value={studentItem.inputVerificationCode}
                              onChange={(e) => {
                                const newStudents = [...students]
                                newStudents[index].inputVerificationCode = e.target.value
                                newStudents[index].verifyError = null
                                setStudents(newStudents)
                              }}
                              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                            />
                          </div>
                        </div>

                        {studentItem.verifyError && (
                          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{studentItem.verifyError}</span>
                          </div>
                        )}

                        <button
                          type="button"
                          disabled={studentItem.isVerifying}
                          onClick={() => handleVerifyStudent(index)}
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-indigo-600/20"
                        >
                          <Search className={`h-3.5 w-3.5 ${studentItem.isVerifying ? 'animate-spin' : ''}`} />
                          {studentItem.isVerifying ? '生徒情報を照合中...' : '生徒情報を照合・確認する'}
                        </button>
                      </div>
                    ) : (
                      /* 照合成功後の表示 ＆ 登下校設定 */
                      <div className="space-y-4 pt-1 animate-in fade-in">
                        <div className="bg-slate-950/80 p-4 rounded-xl border border-emerald-500/30 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-500 font-mono">
                              生徒ID: {studentItem.verifiedStudent?.student_code || studentItem.verifiedStudent?.id}
                            </span>
                            <h4 className="text-base font-black text-white flex items-center gap-2 mt-0.5 flex-wrap">
                              {studentItem.verifiedStudent?.name}
                              {studentItem.verifiedStudent?.grade && (
                                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-normal">
                                  {studentItem.verifiedStudent.grade} {studentItem.verifiedStudent.class_name ? ` ${studentItem.verifiedStudent.class_name}` : ''}
                                </span>
                              )}
                              {studentItem.verifiedStudent?.household_id && (
                                <span className="text-[10px] bg-slate-800/80 text-slate-400 font-mono px-1.5 py-0.5 rounded">
                                  世帯:{studentItem.verifiedStudent.household_id}
                                </span>
                              )}
                            </h4>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleResetVerification(index)}
                            className="text-xs text-slate-400 hover:text-rose-400 underline transition-colors"
                          >
                            変更・再照合
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block font-bold text-slate-400 mb-1">
                              基本登校パターン
                            </label>
                            <select
                              value={studentItem.defaultMorningRide ? 'true' : 'false'}
                              onChange={(e) => handlePatternChange(index, 'defaultMorningRide', e.target.value === 'true')}
                              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="true">登校便に乗車する</option>
                              <option value="false">乗車しない（自己送迎等）</option>
                            </select>
                          </div>

                          <div>
                            <label className="block font-bold text-slate-400 mb-1">
                              基本下校パターン
                            </label>
                            <select
                              value={studentItem.defaultAfternoonSchedule || '乗らない'}
                              onChange={(e) => handlePatternChange(index, 'defaultAfternoonSchedule', e.target.value === '乗らない' ? null : e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="下校1便">下校1便 ({getTripTime('下校1便')})</option>
                              <option value="下校2便">下校2便 ({getTripTime('下校2便')})</option>
                              <option value="下校3便">下校3便 ({getTripTime('下校3便')})</option>
                              <option value="下校4便">下校4便 ({getTripTime('下校4便')})</option>
                              <option value="下校5便">下校5便 ({getTripTime('下校5便')})</option>
                              <option value="乗らない">乗車しない</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* きょうだい追加ボタン */}
              {students.length < 5 && (
                <button
                  type="button"
                  onClick={handleAddStudent}
                  className="w-full py-3 border border-dashed border-slate-700 hover:border-indigo-500/60 rounded-2xl text-xs font-bold text-slate-400 hover:text-indigo-300 bg-slate-900/40 hover:bg-slate-900/80 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  きょうだい（{students.length + 1}人目）を追加して照合する
                </button>
              )}
            </div>

            {/* 登録完了ボタン */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting || students.some(s => !s.verifiedStudent)}
                className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-500 hover:to-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-all duration-200 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full" />
                    登録処理中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    登録を完了してダッシュボードへ進む
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </button>

              {students.some(s => !s.verifiedStudent) && (
                <p className="text-[11px] text-center text-amber-400/80 mt-2">
                  ※すべての生徒の照合が完了すると登録ボタンが有効になります。
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
