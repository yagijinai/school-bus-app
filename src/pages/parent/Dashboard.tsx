import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { BusStatusBanner } from '../../components/common/BusStatusBanner'
import { ParentOnboardingModal } from '../../components/parent/ParentOnboardingModal'
import { 
  Bus, Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle, 
  LogOut, ChevronLeft, ChevronRight, RefreshCw, AlertTriangle, Sparkles, MapPin, 
  Users, MessageSquare, Check, X, Info, CalendarDays, UserPlus, HelpCircle
} from 'lucide-react'

export const Dashboard: React.FC = () => {
  const { 
    user,
    profile, 
    signOut, 
    busRoutes, 
    busStops, 
    students: dbStudents, 
    reservations: allReservations, 
    busOperations, 
    rideStatuses: allRideStatuses,
    isDemoMode,
    updateOperation,
    saveReservation,
    saveWeeklyReservations,
    generateNextMonthReservations,
    getDateScheduleStatus,
    getTripTime,
    getAdjustedStopArrivalTime,
    isTripOperating,
    isRealtimeConnected
  } = useAuth()
  const navigate = useNavigate()

  // 1. メインタブ状態 ('weekly': 週間予約入力, 'monthly': 月間カレンダー, 'status': 本日の運行状況)
  const [activeMainTab, setActiveMainTab] = useState<'weekly' | 'monthly' | 'status'>('weekly')

  // 2. ログイン保護者アカウントに紐付いた生徒のみを厳格に抽出（他世帯データの完全遮断）
  const students = (dbStudents || []).filter(s => s.parent_id === user?.id)
  const myStudentIds = students.map(s => s.id)

  // 3. ログイン保護者の生徒IDに一致する予約・乗車ステータスのみを抽出
  const reservations = allReservations.filter(r => myStudentIds.includes(r.student_id))
  const rideStatuses = allRideStatuses.filter(r => myStudentIds.includes(r.student_id))

  // 4. 選択中の生徒ID（兄弟姉妹切り替え）
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')

  // 5. 週間カレンダーの週オフセット（0: 今週, -1: 先週, 1: 翌週）
  const [weekOffset, setWeekOffset] = useState<number>(0)

  // 6. 月間カレンダーの年月状態
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()) // 0: 1月, 11: 12月

  // 7. トースト通知状態
  const [toast, setToast] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // 8. 個別メモ入力用モーダル / 状態
  const [editingNoteDate, setEditingNoteDate] = useState<string | null>(null)
  const [noteInputText, setNoteInputText] = useState<string>('')
  const [isSavingNote, setIsSavingNote] = useState<boolean>(false)

  // 9. 月間個別予約編集モーダルの状態
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editMorning, setEditMorning] = useState(true)
  const [editAfternoon, setEditAfternoon] = useState<string | null>('下校2便')
  const [editNote, setEditNote] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false)

  // 10. オンボーディング＆使い方ガイドモーダルの状態
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false)

  // 初回アクセス時の自動判定（localStorageチェック）
  useEffect(() => {
    try {
      const completed = localStorage.getItem('parent_onboarding_completed')
      if (completed !== 'true') {
        // 初回未完了の場合、画面描画後にスムーズにポップアップ
        const timer = setTimeout(() => {
          setIsOnboardingOpen(true)
        }, 150)
        return () => clearTimeout(timer)
      }
    } catch (e) {
      console.error('Failed to check onboarding state:', e)
    }
  }, [user?.id, dbStudents])

  // オンボーディング完了・スキップ時の保存ハンドラ
  const handleCompleteOnboarding = () => {
    try {
      localStorage.setItem('parent_onboarding_completed', 'true')
    } catch (e) {
      console.error('Failed to save onboarding state:', e)
    }
    setIsOnboardingOpen(false)
  }

  // トースト表示ヘルパー
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now()
    setToast({ id, message, type })
    setTimeout(() => {
      setToast(prev => (prev?.id === id ? null : prev))
    }, 3200)
  }

  // 生徒データが変更されたら選択中生徒IDを安全に初期化・同期
  useEffect(() => {
    if (students.length > 0) {
      if (!selectedStudentId || !myStudentIds.includes(selectedStudentId)) {
        setSelectedStudentId(students[0].id)
      }
    } else {
      setSelectedStudentId('')
    }
  }, [dbStudents, user?.id])

  // 選択中の生徒オブジェクト
  const activeStudent = students.find(s => s.id === selectedStudentId) || students[0]
  const activeStop = busStops.find(s => s.id === activeStudent?.default_bus_stop_id)
  const activeRoute = busRoutes.find(r => r.id === activeStudent?.bus_route_id || r.id === activeStop?.bus_route_id)

  // 曜日計算ヘルパー（指定週オフセットの月〜金の日付配列を生成）
  const getMondayOfWeek = (offset: number): Date => {
    const now = new Date()
    const day = now.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday + (offset * 7))
    return monday
  }

  const getWeekDays = (offset: number): string[] => {
    const monday = getMondayOfWeek(offset)
    const days: string[] = []
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      days.push(`${year}-${month}-${day}`)
    }
    return days
  }

  const currentWeekDays = getWeekDays(weekOffset)
  const mondayDate = new Date(`${currentWeekDays[0]}T00:00:00`)
  const fridayDate = new Date(`${currentWeekDays[4]}T00:00:00`)

  // 予約変更期限（当日朝7:00制限）の判定
  const isPastCancelLimit = (targetDateStr: string): boolean => {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    
    // 過去の日付は変更不可
    if (targetDateStr < todayStr) return true
    
    // 今日の場合、朝7時00分以降は変更不可
    if (targetDateStr === todayStr) {
      const hours = now.getHours()
      if (hours >= 7) return true
    }
    
    return false
  }

  // 週間ビューでの「登校便」ワンタップトグル
  const handleToggleMorning = async (dateStr: string) => {
    if (!activeStudent) return
    if (isPastCancelLimit(dateStr)) {
      showToast('変更受付時間（当日朝7:00）を過ぎているため変更できません。', 'error')
      return
    }

    const currentRes = reservations.find(r => r.student_id === activeStudent.id && r.date === dateStr)
    const currentStatus = currentRes ? currentRes.morning_status : activeStudent.default_morning_ride
    const newStatus = !currentStatus
    const afternoonSchedule = currentRes ? currentRes.afternoon_schedule : activeStudent.default_afternoon_schedule
    const note = currentRes ? currentRes.note : null

    const dateObj = new Date(`${dateStr}T00:00:00`)
    const dayLabel = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()]
    const dateFormatted = `${dateObj.getMonth() + 1}/${dateObj.getDate()}(${dayLabel})`

    const success = await saveReservation(activeStudent.id, dateStr, newStatus, afternoonSchedule, note)
    if (success) {
      showToast(`${dateFormatted} の登校便を「${newStatus ? '乗車する' : '乗車しない'}」に変更しました。`, 'success')
    } else {
      showToast('予約の保存に失敗しました。', 'error')
    }
  }

  // 週間ビューでの「下校便」切り替え
  const handleChangeAfternoon = async (dateStr: string, newTrip: string | null) => {
    if (!activeStudent) return
    if (isPastCancelLimit(dateStr)) {
      showToast('変更受付時間（当日朝7:00）を過ぎているため変更できません。', 'error')
      return
    }

    const currentRes = reservations.find(r => r.student_id === activeStudent.id && r.date === dateStr)
    const morningStatus = currentRes ? currentRes.morning_status : activeStudent.default_morning_ride
    const note = currentRes ? currentRes.note : null

    const dateObj = new Date(`${dateStr}T00:00:00`)
    const dayLabel = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()]
    const dateFormatted = `${dateObj.getMonth() + 1}/${dateObj.getDate()}(${dayLabel})`

    const success = await saveReservation(activeStudent.id, dateStr, morningStatus, newTrip, note)
    if (success) {
      showToast(`${dateFormatted} の下校便を「${newTrip || '乗車しない'}」に変更しました。`, 'success')
    } else {
      showToast('予約の保存に失敗しました。', 'error')
    }
  }

  // 週間ビューでの「今週の基本パターンを一括適用」
  const handleApplyWeekDefaultPattern = async () => {
    if (!activeStudent) return
    
    const confirmMsg = `${activeStudent.name} さんの今週（${mondayDate.getMonth() + 1}/${mondayDate.getDate()} 〜 ${fridayDate.getMonth() + 1}/${fridayDate.getDate()}）の予約に、基本パターン（登校:${activeStudent.default_morning_ride ? '乗車' : '不乗車'} / 下校:${activeStudent.default_afternoon_schedule || '不乗車'}）を一括適用しますか？`
    if (!window.confirm(confirmMsg)) return

    const items = currentWeekDays.map(dateStr => {
      const scheduleStatus = getDateScheduleStatus(dateStr)
      // 運休日の場合は乗車なし
      const isSuspended = scheduleStatus.isSuspended
      const morningStatus = isSuspended || scheduleStatus.isMorningSuspended ? false : activeStudent.default_morning_ride
      const afternoonSchedule = isSuspended || scheduleStatus.isAfternoonSuspended ? null : activeStudent.default_afternoon_schedule
      const currentRes = reservations.find(r => r.student_id === activeStudent.id && r.date === dateStr)
      return {
        date: dateStr,
        morningStatus,
        afternoonSchedule,
        note: currentRes?.note || '基本パターン適用'
      }
    })

    const success = await saveWeeklyReservations(activeStudent.id, items)
    if (success) {
      showToast(`今週分（${mondayDate.getMonth() + 1}/${mondayDate.getDate()}〜）に基本パターンを一括適用しました。`, 'success')
    } else {
      showToast('一括適用に失敗しました。', 'error')
    }
  }

  // メモ編集モーダルを開く
  const handleOpenNoteModal = (dateStr: string) => {
    if (!activeStudent) return
    if (isPastCancelLimit(dateStr)) {
      showToast('変更受付時間（当日朝7:00）を過ぎているため編集できません。', 'error')
      return
    }
    const currentRes = reservations.find(r => r.student_id === activeStudent.id && r.date === dateStr)
    setEditingNoteDate(dateStr)
    setNoteInputText(currentRes?.note || '')
  }

  // メモの保存
  const handleSaveNoteSubmit = async () => {
    if (!activeStudent || !editingNoteDate) return
    setIsSavingNote(true)

    const currentRes = reservations.find(r => r.student_id === activeStudent.id && r.date === editingNoteDate)
    const morningStatus = currentRes ? currentRes.morning_status : activeStudent.default_morning_ride
    const afternoonSchedule = currentRes ? currentRes.afternoon_schedule : activeStudent.default_afternoon_schedule

    const success = await saveReservation(
      activeStudent.id,
      editingNoteDate,
      morningStatus,
      afternoonSchedule,
      noteInputText.trim() || null
    )

    setIsSavingNote(false)
    if (success) {
      showToast('連絡事項・メモを保存しました。', 'success')
      setEditingNoteDate(null)
      setNoteInputText('')
    } else {
      showToast('メモの保存に失敗しました。', 'error')
    }
  }

  // 月間カレンダー用ヘルパー
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay()

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(prev => prev - 1)
    } else {
      setCurrentMonth(prev => prev - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(prev => prev + 1)
    } else {
      setCurrentMonth(prev => prev + 1)
    }
  }

  // 月間カレンダー用個別モーダルを開く
  const openEditModal = (dateStr: string, studentId: string) => {
    if (!myStudentIds.includes(studentId)) return

    const existing = reservations.find(r => r.student_id === studentId && r.date === dateStr)
    setSelectedDate(dateStr)
    setSelectedStudentId(studentId)
    
    const student = students.find(s => s.id === studentId)
    setEditMorning(existing ? existing.morning_status : (student?.default_morning_ride ?? true))
    setEditAfternoon(existing ? existing.afternoon_schedule : (student?.default_afternoon_schedule || '下校2便'))
    setEditNote(existing?.note || '')
    setShowEditModal(true)
  }

  const handleSaveIndividualReservation = async () => {
    if (!selectedDate || !selectedStudentId) return
    if (isPastCancelLimit(selectedDate)) {
      showToast('変更制限（当日朝7:00）を過ぎているため変更できません。', 'error')
      return
    }

    const success = await saveReservation(selectedStudentId, selectedDate, editMorning, editAfternoon, editNote || null)
    if (success) {
      showToast('予約内容を保存しました。', 'success')
    }
    setShowEditModal(false)
    setSelectedDate(null)
  }

  // 月間一括自動予約生成のハンドラ
  const handleBulkGenerate = async (studentId: string) => {
    const student = students.find(s => s.id === studentId)
    if (!student) return

    if (!window.confirm(`${student.name} さんの翌月1ヶ月分の平日予約を、設定された基本パターンで一括自動登録しますか？`)) {
      return
    }

    setIsGeneratingBulk(true)
    const count = await generateNextMonthReservations(
      studentId, 
      student.default_morning_ride, 
      student.default_afternoon_schedule
    )
    setIsGeneratingBulk(false)
    showToast(`${count}日分の平日予約データを作成・保存しました。`, 'success')
  }

  // バスの運行ステータスを切り替えるシミュレータ (デモモード用)
  const toggleOperationStatus = (routeId: string, tripName: string = '登校便') => {
    const op = busOperations.find(o => o.bus_route_id === routeId && (o.trip_name === tripName || (!o.trip_name && tripName === '登校便')))
    let nextStatus: 'not_started' | 'running' | 'finished' = 'not_started'
    let nextDelay = op?.delay_minutes || 0
    
    if (!op || op.status === 'not_started') {
      nextStatus = 'running'
      nextDelay = 5
    } else if (op.status === 'running') {
      nextStatus = 'finished'
      nextDelay = 0
    } else {
      nextStatus = 'not_started'
      nextDelay = 0
    }
    updateOperation(routeId, tripName, nextStatus, nextDelay)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      {/* トースト通知 */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md ${
            toast.type === 'success' 
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200' 
              : toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
              : 'bg-slate-900/90 border-indigo-500/40 text-slate-200'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
            ) : (
              <Info className="h-5 w-5 text-indigo-400 shrink-0" />
            )}
            <span className="text-xs font-bold">{toast.message}</span>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <header className="bg-slate-900/80 border-b border-slate-850 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-md shadow-indigo-500/20">
              <Bus className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-white flex items-center gap-2">
                スクールバス予約
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold border border-indigo-500/30">
                  保護者専用
                </span>
              </span>
              <p className="text-[11px] text-slate-400 font-medium">
                {profile?.full_name ? `${profile.full_name} 様` : '保護者様'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            {isRealtimeConnected && (
              <span 
                className="flex items-center gap-1.5 text-[11px] font-bold px-2 sm:px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0"
                title="リアルタイム運行情報・点呼ステータス同期中"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="hidden md:inline">リアルタイム同期中</span>
              </span>
            )}

            {/* ❓ 使い方ガイド（常設ボタン） */}
            <button
              type="button"
              onClick={() => setIsOnboardingOpen(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-black text-amber-300 hover:text-amber-100 bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 hover:border-amber-400/70 transition-all active:scale-95 shadow-sm shadow-amber-500/10 shrink-0 min-h-[36px]"
              title="アプリの使い方・初期設定ガイドを見る"
            >
              <HelpCircle className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="inline">使い方ガイド</span>
            </button>

            {/* ログアウト */}
            <button
              type="button"
              onClick={() => signOut()}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 transition-all active:scale-95 shrink-0 min-h-[36px]"
              title="ログアウト"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* 生徒登録なしの案内 */}
        {students.length === 0 ? (
          <div className="bg-slate-900/80 border border-slate-850 rounded-3xl p-8 text-center space-y-4 max-w-md mx-auto my-12 shadow-2xl">
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl w-fit mx-auto text-amber-400">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-black text-white">お子様が登録されていません</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              学校から配布された生徒照合コードを用いて、初期登録を完了してください。
            </p>
            <div className="flex flex-col sm:flex-row gap-2 w-full pt-2">
              <button
                onClick={() => navigate('/register')}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs shadow-lg shadow-indigo-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                生徒の照合・登録画面へ進む
              </button>
              <button
                onClick={() => setIsOnboardingOpen(true)}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-bold rounded-xl text-xs border border-slate-700 transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <HelpCircle className="h-4 w-4 text-amber-400" />
                <span>使い方ガイド</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* リアルタイム運行ステータス・遅延バナー */}
            <BusStatusBanner />

            {/* 1. お子様切り替えタブ（兄弟姉妹セレクタ） */}
            <div className="bg-slate-900/60 border border-slate-850 rounded-2xl p-2 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <span className="text-[11px] font-black text-slate-400 px-2 flex items-center gap-1 shrink-0">
                  <Users className="h-3.5 w-3.5 text-indigo-400" />
                  対象のお子様:
                </span>
                {students.map((student) => {
                  const isSelected = student.id === activeStudent?.id
                  return (
                    <button
                      key={student.id}
                      onClick={() => setSelectedStudentId(student.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
                        isSelected
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-500/20 ring-2 ring-indigo-400/40'
                          : 'bg-slate-950/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      <span>{student.name} さん</span>
                      {student.grade && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${isSelected ? 'bg-black/20 text-indigo-100' : 'bg-slate-800 text-slate-400'}`}>
                          {student.grade}{student.class_name ? ` ${student.class_name}` : ''}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* 選択中のお子様の基本利用バス停 */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/80 rounded-xl border border-slate-850 text-xs shrink-0 self-start sm:self-auto">
                <MapPin className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-slate-400 font-medium">基本バス停:</span>
                <span className="font-bold text-amber-300">{activeStop?.stop_name || '未設定'}</span>
                {activeStop?.arrival_time_morning && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    (朝 {activeStop.arrival_time_morning.substring(0, 5)}着)
                  </span>
                )}
              </div>
            </div>

            {/* 2. メイン機能タブ切り替えバー (週間予約 / 月間カレンダー / 本日の運行状況) */}
            <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
              <button
                onClick={() => setActiveMainTab('weekly')}
                className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  activeMainTab === 'weekly'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <CalendarDays className="h-4 w-4" />
                週間予約入力
              </button>

              <button
                onClick={() => setActiveMainTab('monthly')}
                className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  activeMainTab === 'monthly'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <CalendarIcon className="h-4 w-4" />
                月間カレンダー
              </button>

              <button
                onClick={() => setActiveMainTab('status')}
                className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  activeMainTab === 'status'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Clock className="h-4 w-4" />
                本日の運行状況・乗車確認
              </button>
            </div>

            {/* ========================================================= */}
            {/* タブ 1: 週間予約入力ビュー (メイン改善機能) */}
            {/* ========================================================= */}
            {activeMainTab === 'weekly' && (
              <div className="space-y-5 animate-in fade-in duration-300">
                {/* 週間ナビゲーションバー */}
                <div className="bg-gradient-to-r from-slate-900/90 to-indigo-950/40 border border-indigo-500/20 rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setWeekOffset(prev => prev - 1)}
                      className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all flex items-center gap-1 text-xs font-bold active:scale-95"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">前の週</span>
                    </button>

                    <button
                      onClick={() => setWeekOffset(0)}
                      disabled={weekOffset === 0}
                      className={`px-3 py-2 rounded-xl text-xs font-black border transition-all ${
                        weekOffset === 0
                          ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                          : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                      }`}
                    >
                      今週
                    </button>

                    <button
                      onClick={() => setWeekOffset(prev => prev + 1)}
                      className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all flex items-center gap-1 text-xs font-bold active:scale-95"
                    >
                      <span className="hidden sm:inline">次の週</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>

                    <div className="ml-2">
                      <h2 className="text-sm sm:text-base font-black text-white">
                        {mondayDate.getFullYear()}年 {mondayDate.getMonth() + 1}月{mondayDate.getDate()}日(月) 〜 {fridayDate.getMonth() + 1}月{fridayDate.getDate()}日(金)
                      </h2>
                      <p className="text-[10px] sm:text-xs text-indigo-300">
                        {activeStudent?.name} さんの週間運行スケジュール
                      </p>
                    </div>
                  </div>

                  {/* 一括基本パターン適用ボタン */}
                  <button
                    onClick={handleApplyWeekDefaultPattern}
                    className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-1.5 active:scale-95 self-stretch sm:self-auto"
                  >
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    今週の基本パターンを一括適用
                  </button>
                </div>

                {/* 週間予約カードグリッド (月〜金) */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
                  {currentWeekDays.map((dateStr) => {
                    const dateObj = new Date(`${dateStr}T00:00:00`)
                    const dayLabels = ['日', '月', '火', '水', '木', '金', '土']
                    const dayOfWeekNum = dateObj.getDay()
                    const dayName = dayLabels[dayOfWeekNum]
                    const isToday = dateStr === new Date().toISOString().split('T')[0]
                    const isPast = isPastCancelLimit(dateStr)

                    // 運行スケジュールステータス
                    const scheduleStatus = getDateScheduleStatus(dateStr)
                    const isSuspended = scheduleStatus.isSuspended
                    const isMorningSuspended = isSuspended || scheduleStatus.isMorningSuspended
                    const isAfternoonSuspended = isSuspended || scheduleStatus.isAfternoonSuspended

                    // 現在の予約情報
                    const res = reservations.find(r => r.student_id === activeStudent?.id && r.date === dateStr)
                    const isMorningRiding = isMorningSuspended ? false : res ? res.morning_status : activeStudent?.default_morning_ride ?? true
                    const afternoonSchedule = isAfternoonSuspended ? null : res ? res.afternoon_schedule : activeStudent?.default_afternoon_schedule || '下校2便'
                    const note = res?.note || ''

                    // 時刻計算
                    const morningTime = getTripTime('登校便', dateStr)
                    const morningStopArrivalTime = activeStop ? getAdjustedStopArrivalTime(activeStop, dateStr) : ''

                    return (
                      <div 
                        key={dateStr}
                        className={`rounded-3xl border p-4 flex flex-col justify-between space-y-4 transition-all duration-200 ${
                          isToday 
                            ? 'bg-indigo-950/30 border-indigo-500/50 ring-2 ring-indigo-500/20 shadow-xl'
                            : isSuspended 
                            ? 'bg-slate-900/30 border-slate-850 opacity-75'
                            : 'bg-slate-900/60 border-slate-850 hover:border-slate-750 shadow-lg'
                        }`}
                      >
                        {/* 日付ヘッダー */}
                        <div className="border-b border-slate-800 pb-2.5">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-base font-black text-white">
                                  {dateObj.getMonth() + 1}/{dateObj.getDate()}
                                </span>
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                  dayOfWeekNum === 3 ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-300'
                                }`}>
                                  ({dayName})
                                </span>
                              </div>
                              {isToday && (
                                <span className="text-[10px] font-black text-indigo-300 bg-indigo-500/20 px-1.5 py-0.2 rounded inline-block mt-0.5">
                                  本日
                                </span>
                              )}
                            </div>

                            {/* 運行区分バッジ */}
                            {scheduleStatus.type === 'special' ? (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold">
                                {scheduleStatus.label}
                              </span>
                            ) : scheduleStatus.type === 'shortened' ? (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold">
                                水曜短縮
                              </span>
                            ) : isSuspended ? (
                              <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded font-bold">
                                全便運休
                              </span>
                            ) : null}
                          </div>

                          {scheduleStatus.note && (
                            <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                              {scheduleStatus.note}
                            </p>
                          )}
                        </div>

                        {/* メイン予約切り替えセクション */}
                        <div className="space-y-3.5 text-xs">
                          {/* 1. 登校便 */}
                          <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-850 space-y-2">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="font-bold text-slate-300 flex items-center gap-1">
                                <Bus className="h-3 w-3 text-indigo-400" />
                                登校便
                              </span>
                              <span className="font-mono text-[10px] text-slate-400 font-bold">
                                {morningStopArrivalTime ? `${morningStopArrivalTime}乗車` : `${morningTime}発`}
                              </span>
                            </div>

                            {isMorningSuspended ? (
                              <div className="py-2 text-center text-[10px] font-bold text-rose-400 bg-rose-500/10 rounded-xl border border-rose-500/20">
                                登校便は運休です
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={isPast}
                                onClick={() => handleToggleMorning(dateStr)}
                                className={`w-full py-2 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 border active:scale-95 ${
                                  isMorningRiding
                                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-500/10'
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                                } ${isPast ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                {isMorningRiding ? (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                    乗車する
                                  </>
                                ) : (
                                  <>
                                    <X className="h-4 w-4 text-slate-500" />
                                    利用しない
                                  </>
                                )}
                              </button>
                            )}

                            {/* 登校便 リアルタイム乗車見守りバッジ */}
                            {(() => {
                              const ride = rideStatuses.find(
                                r => r.student_id === activeStudent?.id && r.date === dateStr && (r.trip_name === '登校便' || !r.trip_name)
                              )
                              const timeStr = ride?.updated_at ? new Date(ride.updated_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : ''

                              if (!isMorningRiding) {
                                return (
                                  <div className="text-[10px] py-1 px-2 rounded-lg bg-slate-900/60 text-slate-500 text-center font-bold">
                                    不乗車・お休み
                                  </div>
                                )
                              }
                              if (ride?.status === 'completed') {
                                return (
                                  <div className="text-[10px] py-1 px-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-center font-black flex items-center justify-center gap-1 animate-in fade-in">
                                    <Check className="h-3 w-3" />
                                    乗車完了 {timeStr ? `(${timeStr} 乗車)` : ''}
                                  </div>
                                )
                              }
                              if (ride?.status === 'absent') {
                                return (
                                  <div className="text-[10px] py-1 px-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-center font-bold">
                                    欠席確認済み
                                  </div>
                                )
                              }
                              return (
                                <div className="text-[10px] py-1 px-2 rounded-lg bg-slate-900/80 text-amber-300/80 text-center font-bold flex items-center justify-center gap-1">
                                  <Clock className="h-2.5 w-2.5" />
                                  未乗車（点呼待ち）
                                </div>
                              )
                            })()}
                          </div>

                          {/* 2. 下校便 */}
                          <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-850 space-y-2">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="font-bold text-slate-300 flex items-center gap-1">
                                <Bus className="h-3 w-3 text-purple-400" />
                                下校便
                              </span>
                              {afternoonSchedule && afternoonSchedule !== '乗らない' && (
                                <span className="font-mono text-[10px] text-purple-300 font-bold">
                                  {getTripTime(afternoonSchedule, dateStr)}発
                                </span>
                              )}
                            </div>

                            {isAfternoonSuspended ? (
                              <div className="py-2 text-center text-[10px] font-bold text-rose-400 bg-rose-500/10 rounded-xl border border-rose-500/20">
                                下校便は運休です
                              </div>
                            ) : (
                              <select
                                disabled={isPast}
                                value={afternoonSchedule || '乗らない'}
                                onChange={(e) => handleChangeAfternoon(dateStr, e.target.value === '乗らない' ? null : e.target.value)}
                                className={`w-full py-2 px-2.5 bg-slate-900 border rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all ${
                                  afternoonSchedule && afternoonSchedule !== '乗らない'
                                    ? 'border-purple-500/40 text-purple-200 bg-purple-950/20'
                                    : 'border-slate-800 text-slate-400'
                                } ${isPast ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                {[1, 2, 3, 4, 5].map(num => {
                                  const tripKey = `下校${num}便`
                                  const isOp = isTripOperating(tripKey, dateStr)
                                  const timeStr = getTripTime(tripKey, dateStr)
                                  return (
                                    <option key={tripKey} value={tripKey} disabled={!isOp}>
                                      {tripKey} {isOp ? `(${timeStr}発)` : '(運休)'}
                                    </option>
                                  )
                                })}
                                <option value="乗らない">乗車しない（自己送迎等）</option>
                              </select>
                            )}

                            {/* 下校便 リアルタイム乗車見守りバッジ */}
                            {(() => {
                              if (!afternoonSchedule || afternoonSchedule === '乗らない') {
                                return (
                                  <div className="text-[10px] py-1 px-2 rounded-lg bg-slate-900/60 text-slate-500 text-center font-bold">
                                    不乗車・自己送迎
                                  </div>
                                )
                              }
                              const ride = rideStatuses.find(
                                r => r.student_id === activeStudent?.id && r.date === dateStr && r.trip_name === afternoonSchedule
                              )
                              const timeStr = ride?.updated_at ? new Date(ride.updated_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : ''

                              if (ride?.status === 'completed') {
                                return (
                                  <div className="text-[10px] py-1 px-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-center font-black flex items-center justify-center gap-1 animate-in fade-in">
                                    <Check className="h-3 w-3" />
                                    乗車完了 {timeStr ? `(${timeStr} 乗車)` : ''}
                                  </div>
                                )
                              }
                              if (ride?.status === 'absent') {
                                return (
                                  <div className="text-[10px] py-1 px-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-center font-bold">
                                    欠席確認済み
                                  </div>
                                )
                              }
                              return (
                                <div className="text-[10px] py-1 px-2 rounded-lg bg-slate-900/80 text-amber-300/80 text-center font-bold flex items-center justify-center gap-1">
                                  <Clock className="h-2.5 w-2.5" />
                                  未乗車（点呼待ち）
                                </div>
                              )
                            })()}
                          </div>

                          {/* 3. メモ・連絡事項 */}
                          <div className="pt-0.5">
                            {note ? (
                              <button
                                type="button"
                                disabled={isPast}
                                onClick={() => handleOpenNoteModal(dateStr)}
                                className="w-full text-left p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 hover:bg-indigo-500/20 transition-all flex items-start gap-1.5"
                              >
                                <MessageSquare className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{note}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isPast}
                                onClick={() => handleOpenNoteModal(dateStr)}
                                className="w-full py-1.5 px-2 rounded-xl bg-slate-950/40 hover:bg-slate-950 border border-dashed border-slate-800 hover:border-slate-700 text-[10px] text-slate-500 hover:text-slate-400 transition-all flex items-center justify-center gap-1"
                              >
                                <MessageSquare className="h-3 w-3" />
                                連絡メモを追加
                              </button>
                            )}
                          </div>
                        </div>

                        {/* フッター状態表示 */}
                        <div className="pt-2 border-t border-slate-850 flex justify-between items-center text-[10px]">
                          {isPast ? (
                            <span className="text-slate-500 font-bold">変更締切済</span>
                          ) : (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <Check className="h-3 w-3" />
                              受付中（朝7時迄）
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(dateStr, activeStudent?.id || '')}
                            className="text-slate-400 hover:text-white underline text-[10px]"
                          >
                            詳細設定
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* タブ 2: 月間カレンダービュー (月全体の見通し) */}
            {/* ========================================================= */}
            {activeMainTab === 'monthly' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* 翌月一括予約設定パネル */}
                <div className="bg-slate-900/60 border border-slate-850 rounded-3xl p-6 relative shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                    <div>
                      <h3 className="text-base font-black text-white flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-400" />
                        翌月1ヶ月分の基本一括自動登録
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        翌月の平日に基本パターン予約を一括作成できます。
                      </p>
                    </div>

                    <button
                      onClick={() => handleBulkGenerate(activeStudent?.id || '')}
                      disabled={isGeneratingBulk}
                      className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white text-xs font-black rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {activeStudent?.name} の翌月予約を一括実行
                    </button>
                  </div>
                </div>

                {/* 月間カレンダーグリッド */}
                <div className="bg-slate-900/60 border border-slate-850 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
                  {/* 年月ナビゲーション */}
                  <div className="flex justify-between items-center pb-3 border-b border-slate-850">
                    <button
                      onClick={handlePrevMonth}
                      className="p-2 bg-slate-950 hover:bg-slate-800 rounded-xl border border-slate-800 text-slate-300 transition-all active:scale-95"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <h3 className="text-lg font-black text-white font-mono">
                      {currentYear}年 {currentMonth + 1}月
                    </h3>
                    <button
                      onClick={handleNextMonth}
                      className="p-2 bg-slate-950 hover:bg-slate-800 rounded-xl border border-slate-800 text-slate-300 transition-all active:scale-95"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* 曜日ヘッダー */}
                  <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 pb-2">
                    <span className="text-rose-400">日</span>
                    <span>月</span>
                    <span>火</span>
                    <span className="text-amber-400">水</span>
                    <span>木</span>
                    <span>金</span>
                    <span className="text-blue-400">土</span>
                  </div>

                  {/* 日付セル */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {(() => {
                      const daysInMonth = getDaysInMonth(currentYear, currentMonth)
                      const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
                      const cells = []

                      for (let i = 0; i < firstDay; i++) {
                        cells.push(<div key={`empty-${i}`} className="min-h-[85px] bg-slate-950/20 rounded-2xl" />)
                      }

                      for (let day = 1; day <= daysInMonth; day++) {
                        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                        const dObj = new Date(`${dateStr}T00:00:00`)
                        const dayOfWeek = dObj.getDay()
                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
                        const isPast = isPastCancelLimit(dateStr)

                        const scheduleStatus = getDateScheduleStatus(dateStr)
                        const isSuspended = scheduleStatus.isSuspended
                        const res = reservations.find(r => r.student_id === activeStudent?.id && r.date === dateStr)

                        cells.push(
                          <div
                            key={dateStr}
                            onClick={() => !isPast && !isWeekend && openEditModal(dateStr, activeStudent?.id || '')}
                            className={`min-h-[85px] p-2 rounded-2xl border flex flex-col justify-between text-xs transition-all ${
                              isWeekend 
                                ? 'bg-slate-950/40 border-slate-900 text-slate-600' 
                                : isPast
                                ? 'bg-slate-900/30 border-slate-850 opacity-60 cursor-not-allowed'
                                : 'bg-slate-950/80 border-slate-800 hover:border-indigo-500/50 cursor-pointer hover:shadow-lg'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <span className={`font-bold font-mono ${
                                dayOfWeek === 0 ? 'text-rose-400' : dayOfWeek === 6 ? 'text-blue-400' : 'text-white'
                              }`}>
                                {day}
                              </span>
                              {scheduleStatus.type === 'special' && (
                                <span className="text-[8px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-bold">
                                  特
                                </span>
                              )}
                            </div>

                            {!isWeekend && (
                              <div className="space-y-0.5 text-[10px]">
                                {isSuspended ? (
                                  <span className="text-[9px] text-rose-400 font-bold block">運休</span>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-1">
                                      <span className={`h-1.5 w-1.5 rounded-full ${res?.morning_status ?? activeStudent?.default_morning_ride ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                                      <span className="text-slate-300 text-[9px] truncate">
                                        登校:{res?.morning_status ?? activeStudent?.default_morning_ride ? '乗車' : 'なし'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                                      <span className="text-purple-300 text-[9px] truncate">
                                        {res?.afternoon_schedule || activeStudent?.default_afternoon_schedule || 'なし'}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      }
                      return cells
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* タブ 3: 本日の運行状況・乗車確認 */}
            {/* ========================================================= */}
            {activeMainTab === 'status' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* 運行ダイヤ遅延モニター */}
                {(() => {
                  const todayStr = new Date().toISOString().split('T')[0]
                  const now = new Date()
                  const currentHour = now.getHours()
                  const currentTripName = currentHour < 12 ? '登校便' : (reservations.find(r => r.student_id === activeStudent?.id && r.date === todayStr)?.afternoon_schedule || '下校2便')
                  const activeOp = busOperations.find(o => o.bus_route_id === activeRoute?.id && o.trip_name === currentTripName)

                  return (
                    <div className="bg-gradient-to-r from-slate-900/90 to-indigo-950/40 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                      <div className="flex justify-between items-center pb-3 border-b border-slate-850">
                        <div className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-indigo-400" />
                          <h3 className="text-base font-black text-white">本日のバス運行モニター</h3>
                        </div>
                        <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20">
                          {activeRoute?.route_name || '担当路線'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        {activeOp?.status === 'running' ? (
                          activeOp.delay_minutes > 0 ? (
                            <div className="flex items-center gap-3 text-amber-400">
                              <AlertTriangle className="h-6 w-6 shrink-0" />
                              <div>
                                <p className="text-xs text-slate-400">運行状況</p>
                                <p className="text-base font-black text-amber-300">約 {activeOp.delay_minutes} 分遅延して運行中</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 text-emerald-400">
                              <CheckCircle2 className="h-6 w-6 shrink-0" />
                              <div>
                                <p className="text-xs text-slate-400">運行状況</p>
                                <p className="text-base font-black text-emerald-300">定刻通り運行中</p>
                              </div>
                            </div>
                          )
                        ) : activeOp?.status === 'finished' ? (
                          <div className="flex items-center gap-3 text-blue-400">
                            <CheckCircle2 className="h-6 w-6 shrink-0 text-blue-400" />
                            <div>
                              <p className="text-xs text-slate-400">運行状況</p>
                              <p className="text-base font-black text-blue-300">{currentTripName} は運行を終了しました</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 text-slate-400">
                            <Clock className="h-6 w-6 shrink-0 text-slate-500" />
                            <div>
                              <p className="text-xs text-slate-500">運行状況</p>
                              <p className="text-base font-black text-slate-300">運行前（まもなく開始）</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* デモ用シミュレータボタン */}
                      {isDemoMode && activeOp && (
                        <div className="pt-3 border-t border-slate-850 flex gap-2">
                          <button
                            onClick={() => toggleOperationStatus(activeOp.bus_route_id || 'route-a', currentTripName)}
                            className="px-3 py-1.5 rounded-xl text-xs bg-slate-950 border border-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5"
                          >
                            <RefreshCw className="h-3 w-3" />
                            運行ステータス切替 (デモ)
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* 本日の乗車チェックイン状況カード */}
                <div className="bg-slate-900/60 border border-slate-850 rounded-3xl p-6 space-y-4 shadow-xl">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    お子様の本日の乗降チェック状況
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {students.map(student => {
                      const todayStr = new Date().toISOString().split('T')[0]
                      const res = reservations.find(r => r.student_id === student.id && r.date === todayStr)
                      const morningRide = rideStatuses.find(r => r.student_id === student.id && r.date === todayStr && (r.trip_name === '登校便' || !r.trip_name))
                      const afternoonTrip = res?.afternoon_schedule || '下校2便'
                      const afternoonRide = rideStatuses.find(r => r.student_id === student.id && r.date === todayStr && r.trip_name === afternoonTrip)
                      const stop = busStops.find(s => s.id === student.default_bus_stop_id)

                      return (
                        <div key={student.id} className="bg-slate-950/80 border border-slate-850 rounded-2xl p-4 space-y-3">
                          <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                            <div>
                              <h4 className="font-bold text-sm text-white">{student.name} さん</h4>
                              <span className="text-[10px] text-slate-400">バス停: {stop?.stop_name || '未設定'}</span>
                            </div>
                          </div>

                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between items-center p-2 bg-slate-900/60 rounded-xl">
                              <span className="text-slate-400 font-bold">登校便</span>
                              {morningRide?.status === 'completed' ? (
                                <span className="text-emerald-400 font-black flex items-center gap-1">
                                  ✅ 乗車完了
                                  {morningRide.updated_at && (
                                    <span className="text-[10px] text-emerald-300/80 font-mono">
                                      ({new Date(morningRide.updated_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })})
                                    </span>
                                  )}
                                </span>
                              ) : morningRide?.status === 'absent' ? (
                                <span className="text-rose-400 font-bold">❌ 欠席確認済</span>
                              ) : (
                                <span className="text-slate-500 font-bold">未乗車（点呼待ち）</span>
                              )}
                            </div>

                            <div className="flex justify-between items-center p-2 bg-slate-900/60 rounded-xl">
                              <span className="text-slate-400 font-bold">下校 ({afternoonTrip})</span>
                              {afternoonRide?.status === 'completed' ? (
                                <span className="text-emerald-400 font-black flex items-center gap-1">
                                  ✅ 乗車完了
                                  {afternoonRide.updated_at && (
                                    <span className="text-[10px] text-emerald-300/80 font-mono">
                                      ({new Date(afternoonRide.updated_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })})
                                    </span>
                                  )}
                                </span>
                              ) : afternoonRide?.status === 'absent' ? (
                                <span className="text-rose-400 font-bold">❌ 欠席確認済</span>
                              ) : (
                                <span className="text-slate-500 font-bold">未乗車（点呼待ち）</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ========================================================= */}
      {/* モーダル: 簡易メモ・連絡事項の入力 */}
      {/* ========================================================= */}
      {editingNoteDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-indigo-400" />
                連絡メモ・備考の入力
              </h3>
              <button
                onClick={() => setEditingNoteDate(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="text-xs space-y-1">
              <span className="text-slate-400">対象日:</span>
              <p className="font-mono font-bold text-indigo-300">
                {editingNoteDate} ({activeStudent?.name} さん)
              </p>
            </div>

            <textarea
              rows={3}
              value={noteInputText}
              onChange={(e) => setNoteInputText(e.target.value)}
              placeholder="例：部活のため1便変更、病院のため欠席、親送迎など"
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditingNoteDate(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold transition-all"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={isSavingNote}
                onClick={handleSaveNoteSubmit}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* モーダル: 月間用個別予約修正 */}
      {/* ========================================================= */}
      {showEditModal && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">
                  {students.find(s => s.id === selectedStudentId)?.name} さんの予約
                </span>
                <h3 className="text-base font-black text-white mt-0.5">乗車予約の変更</h3>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">対象運行日</label>
                <p className="font-mono font-bold text-indigo-300 bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                  {selectedDate}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">登校便</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditMorning(true)}
                    className={`flex-1 py-2.5 rounded-xl font-bold border transition-all ${
                      editMorning 
                        ? 'bg-emerald-500/25 border-emerald-500 text-emerald-300' 
                        : 'bg-slate-950 border-slate-800 text-slate-500'
                    }`}
                  >
                    乗車する
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditMorning(false)}
                    className={`flex-1 py-2.5 rounded-xl font-bold border transition-all ${
                      !editMorning 
                        ? 'bg-rose-500/25 border-rose-500 text-rose-300' 
                        : 'bg-slate-950 border-slate-800 text-slate-500'
                    }`}
                  >
                    利用しない
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">下校便</label>
                <select
                  value={editAfternoon || '乗らない'}
                  onChange={(e) => setEditAfternoon(e.target.value === '乗らない' ? null : e.target.value)}
                  className="w-full py-2.5 px-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="下校1便">下校1便 ({getTripTime('下校1便', selectedDate)})</option>
                  <option value="下校2便">下校2便 ({getTripTime('下校2便', selectedDate)})</option>
                  <option value="下校3便">下校3便 ({getTripTime('下校3便', selectedDate)})</option>
                  <option value="下校4便">下校4便 ({getTripTime('下校4便', selectedDate)})</option>
                  <option value="下校5便">下校5便 ({getTripTime('下校5便', selectedDate)})</option>
                  <option value="乗らない">乗車しない</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">連絡事項・メモ</label>
                <input
                  type="text"
                  placeholder="例：部活のため変更"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full py-2.5 px-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold transition-all"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSaveIndividualReservation}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 初回オンボーディング＆利用ガイドモーダル */}
      <ParentOnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={handleCompleteOnboarding}
      />
    </div>
  )
}
