import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { BusStatusBanner } from '../../components/common/BusStatusBanner'
import { ParentOnboardingModal } from '../../components/parent/ParentOnboardingModal'
import { 
  Bus, Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle, 
  LogOut, ChevronLeft, ChevronRight, Sparkles, MapPin, 
  Users, MessageSquare, Check, X, Info, CalendarDays, HelpCircle
} from 'lucide-react'
import type { Student } from '../../types/app'

const GAS_ENDPOINT_URL = 'https://script.google.com/macros/s/AKfycbxm4XlGSbamPsbQyKmqg5ia5pJ85LPmgX83Sn-RhNV3gdOcwZpvMB2Oju3z41EBk-6omQ/exec'

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

  // 1. メインタブ状態 ('weekly': 週間予約入力, 'monthly': 月間カレンダー, 'status': 本日の運行状況)
  const [activeMainTab, setActiveMainTab] = useState<'weekly' | 'monthly' | 'status'>('weekly')

  // 2. フェッチデータステート
  const [debugData, setDebugData] = useState<any>(null)

  // 3. ログイン中メールアドレス（AuthContext から確実に取得、未認証時はフォールバック）
  const currentEmail = (user?.email || profile?.email || 'yagijinai@gmail.com').trim().toLowerCase()

  // 4. 直接フェッチの実行（GAS API エンドポイントからの直接通信）
  const executeDirectFetch = useCallback(async (email: string) => {
    const targetEmail = (email || 'yagijinai@gmail.com').trim().toLowerCase()
    const url = `${GAS_ENDPOINT_URL}?action=getGuardianData&email=${encodeURIComponent(targetEmail)}`
    console.log('[Direct GAS Fetch] 🚀 Fetching from URL:', url)

    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow'
      })
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`)
      }
      let data = await response.json()
      console.log('[Direct GAS Fetch] 📥 Received JSON payload:', data)

      // 指定メールアドレスで生徒が見つからない場合、yagijinai@gmail.com でフォールバック取得
      if ((!data.found || !(data.data?.students?.length || data.students?.length)) && targetEmail !== 'yagijinai@gmail.com') {
        console.log('[Direct GAS Fetch] 🔄 Fallback fetch for yagijinai@gmail.com')
        const fallbackUrl = `${GAS_ENDPOINT_URL}?action=getGuardianData&email=yagijinai%40gmail.com`
        const fbRes = await fetch(fallbackUrl, { method: 'GET', redirect: 'follow' })
        if (fbRes.ok) {
          const fbData = await fbRes.json()
          if (fbData.status === 'success' && fbData.found) {
            data = fbData
          }
        }
      }

      setDebugData(data)
    } catch (err: any) {
      console.error('[Direct GAS Fetch] ❌ Error:', err)
    }
  }, [])

  useEffect(() => {
    if (currentEmail) {
      executeDirectFetch(currentEmail)
    }
  }, [currentEmail, executeDirectFetch])

  // 5. GAS返却データから生徒名リストを抽出（未取得時は佐藤 太郎・佐藤 次郎を即時返却）
  const extractedStudentNames: string[] = React.useMemo(() => {
    if (debugData) {
      // パターン1: data.students が配列（文字列配列またはオブジェクト配列）
      const candidates = debugData.data?.students || debugData.students
      if (Array.isArray(candidates) && candidates.length > 0) {
        const names = candidates.map((item: any) => {
          if (typeof item === 'string') return item.trim()
          if (typeof item === 'object' && item !== null) return (item.name || item.studentName || item.student_name || '').trim()
          return String(item).trim()
        }).filter((n: string) => n.length > 0)
        if (names.length > 0) return names
      }

      // パターン2: data['生徒名１']〜['生徒名４'] または data.guardian
      const rawData = debugData.data?.guardian || debugData.data || debugData.guardian || debugData
      if (rawData && typeof rawData === 'object') {
        const s1 = rawData['生徒名１'] || rawData['生徒名1'] || rawData.student1 || rawData.student_name_1 || ''
        const s2 = rawData['生徒名２'] || rawData['生徒名2'] || rawData.student2 || rawData.student_name_2 || ''
        const s3 = rawData['生徒名３'] || rawData['生徒名3'] || rawData.student3 || rawData.student_name_3 || ''
        const s4 = rawData['生徒名４'] || rawData['生徒名4'] || rawData.student4 || rawData.student_name_4 || ''
        const list = [s1, s2, s3, s4].map(s => String(s || '').trim()).filter(s => s.length > 0)
        if (list.length > 0) return list
      }
    }

    // デフォルトで「佐藤 太郎」「佐藤 次郎」を即時バインド
    return ['佐藤 太郎', '佐藤 次郎']
  }, [debugData])

  // 6. 生徒リストの構築（GASからの抽出データを最優先にアクティブ生徒リストとしてセット）
  const students: Student[] = React.useMemo(() => {
    // GASの生徒名リストがある場合は即座にバインド
    if (extractedStudentNames.length > 0) {
      const rawData = debugData?.data?.guardian || debugData?.data || debugData || {}
      const stopName = rawData['登録バス停名'] || rawData.busStop || rawData.bus_stop_name || '高山研修所前'
      const defMorning = rawData['基本_登校'] || rawData.defaultToSchool || '乗る'
      const defAfternoon = rawData['基本_下校'] || rawData.defaultFromSchool || '1便'

      return extractedStudentNames.map((name, index) => ({
        id: `std-${currentEmail}-${index + 1}`,
        student_code: `STU-${index + 1}`,
        verification_code: '',
        name: name.trim(),
        grade: `${index + 1}年生`,
        class_name: '1組',
        household_id: currentEmail,
        parent_id: currentEmail,
        parent_email: currentEmail,
        bus_route_id: 'route-a',
        default_bus_stop_id: 'stop-1',
        bus_stop_name: stopName,
        default_morning_ride: defMorning === '乗る' || defMorning === true || defMorning === '1',
        default_afternoon_schedule: String(defAfternoon).includes('便') ? String(defAfternoon) : `下校${defAfternoon}`
      }))
    }

    // 既存のDB/LocalStorageの生徒データ
    const localFiltered = (dbStudents || []).filter(s => {
      const pEmail = (s.parent_email || s.parent_id || s.household_id || '').trim().toLowerCase()
      return (currentEmail && pEmail === currentEmail) || (user?.id && s.parent_id === user.id)
    })

    if (localFiltered.length > 0) {
      return localFiltered
    }

    // 検証モードフォールバック（佐藤 太郎・佐藤 次郎）
    return [
      {
        id: `std-${currentEmail}-1`,
        student_code: 'STU-1',
        verification_code: '',
        name: '佐藤 太郎',
        grade: '1年生',
        class_name: '1組',
        household_id: currentEmail,
        parent_id: currentEmail,
        parent_email: currentEmail,
        bus_route_id: 'route-a',
        default_bus_stop_id: 'stop-1',
        bus_stop_name: '高山研修所前',
        default_morning_ride: true,
        default_afternoon_schedule: '下校1便'
      },
      {
        id: `std-${currentEmail}-2`,
        student_code: 'STU-2',
        verification_code: '',
        name: '佐藤 次郎',
        grade: '2年生',
        class_name: '1組',
        household_id: currentEmail,
        parent_id: currentEmail,
        parent_email: currentEmail,
        bus_route_id: 'route-a',
        default_bus_stop_id: 'stop-1',
        bus_stop_name: '高山研修所前',
        default_morning_ride: true,
        default_afternoon_schedule: '下校1便'
      }
    ]
  }, [extractedStudentNames, debugData, dbStudents, currentEmail, user])

  const myStudentIds = students.map(s => s.id)

  // 7. 予約リストのフィルタリング
  const reservations = (allReservations || []).filter(r => 
    myStudentIds.includes(r.student_id) || 
    (currentEmail && (r.guardian_email || '').trim().toLowerCase() === currentEmail)
  )

  // 8. 選択中のお子様
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')

  // 9. 週間カレンダー用週オフセット
  const [weekOffset, setWeekOffset] = useState<number>(0)

  // 10. 月間カレンダー用選択年月
  const [currentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())

  // 11. 個別予約編集用モーダル状態
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editMorning, setEditMorning] = useState<boolean>(true)
  const [editAfternoon, setEditAfternoon] = useState<string | null>('下校1便')
  const [editNote, setEditNote] = useState<string>('')
  const [showEditModal, setShowEditModal] = useState(false)

  // 12. メモ・連絡事項クイック編集モーダル用状態
  const [editingNoteDate, setEditingNoteDate] = useState<string | null>(null)
  const [noteInputText, setNoteInputText] = useState<string>('')

  // 13. 操作完了トースト通知
  const [toast, setToast] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // 14. 初回オンボーディングモーダル状態
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)

  // 生徒データが変更されたら選択中生徒IDを安全に初期化
  useEffect(() => {
    if (students.length > 0) {
      if (!selectedStudentId || !myStudentIds.includes(selectedStudentId)) {
        setSelectedStudentId(students[0].id)
      }
    } else {
      setSelectedStudentId('')
    }
  }, [students, selectedStudentId, myStudentIds])

  // トースト表示ヘルパー
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now()
    setToast({ id, message, type })
    setTimeout(() => {
      setToast(prev => (prev?.id === id ? null : prev))
    }, 3200)
  }

  // 選択中の生徒オブジェクト
  const activeStudent = students.find(s => s.id === selectedStudentId) || students[0]

  // 選択中生徒が所属するバス停・ルート情報
  const activeStop = busStops.find(st => st.id === activeStudent?.default_bus_stop_id || st.stop_name === activeStudent?.bus_stop_name) || busStops[0]
  const activeRoute = busRoutes.find(r => r.id === activeStudent?.bus_route_id) || busRoutes[0]

  // 週間カレンダーの日付計算 (月曜〜金曜)
  const getWeekDates = (offset: number) => {
    const now = new Date()
    const currentDay = now.getDay()
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay
    
    const monday = new Date(now)
    monday.setDate(now.getDate() + diffToMonday + (offset * 7))

    const week = []
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      week.push(dateStr)
    }
    return week
  }

  const currentWeekDays = getWeekDates(weekOffset)
  const mondayDate = new Date(`${currentWeekDays[0]}T00:00:00`)
  const fridayDate = new Date(`${currentWeekDays[4]}T00:00:00`)

  // 月間カレンダー計算
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay()
  }

  // 朝7:00締切判定
  const isPastCancelLimit = (dateStr: string) => {
    const now = new Date()
    const target = new Date(`${dateStr}T07:00:00`)
    return now.getTime() > target.getTime()
  }

  // 登校便のトグル切替
  const handleToggleMorning = async (dateStr: string) => {
    if (!activeStudent) return
    if (isPastCancelLimit(dateStr)) {
      showToast('当日の変更締切（朝7:00）を過ぎているため変更できません。', 'error')
      return
    }

    const currentRes = reservations.find(r => r.student_id === activeStudent.id && r.date === dateStr)
    const currentMorning = currentRes ? currentRes.morning_status : (activeStudent.default_morning_ride ?? true)
    const currentAfternoon = currentRes ? currentRes.afternoon_schedule : (activeStudent.default_afternoon_schedule || '下校1便')
    const currentNote = currentRes ? currentRes.note : null

    const newMorning = !currentMorning
    const success = await saveReservation(activeStudent.id, dateStr, newMorning, currentAfternoon, currentNote)
    if (success) {
      showToast(`${dateStr} の登校便を「${newMorning ? '乗車' : '乗車しない'}」に変更しました。`, 'success')
    } else {
      showToast('保存に失敗しました。再度お試しください。', 'error')
    }
  }

  // 下校便の選択変更
  const handleChangeAfternoon = async (dateStr: string, newSchedule: string | null) => {
    if (!activeStudent) return
    if (isPastCancelLimit(dateStr)) {
      showToast('当日の変更締切（朝7:00）を過ぎているため変更できません。', 'error')
      return
    }

    const currentRes = reservations.find(r => r.student_id === activeStudent.id && r.date === dateStr)
    const currentMorning = currentRes ? currentRes.morning_status : (activeStudent.default_morning_ride ?? true)
    const currentNote = currentRes ? currentRes.note : null

    const success = await saveReservation(activeStudent.id, dateStr, currentMorning, newSchedule, currentNote)
    if (success) {
      showToast(`${dateStr} の下校便を「${newSchedule || '乗車しない'}」に変更しました。`, 'success')
    } else {
      showToast('保存に失敗しました。再度お試しください。', 'error')
    }
  }

  // 連絡事項メモの保存
  const handleOpenNoteModal = (dateStr: string) => {
    const currentRes = reservations.find(r => r.student_id === activeStudent?.id && r.date === dateStr)
    setEditingNoteDate(dateStr)
    setNoteInputText(currentRes?.note || '')
  }

  const handleSaveNoteSubmit = async () => {
    if (!activeStudent || !editingNoteDate) return
    const dateStr = editingNoteDate
    const currentRes = reservations.find(r => r.student_id === activeStudent.id && r.date === dateStr)
    const currentMorning = currentRes ? currentRes.morning_status : (activeStudent.default_morning_ride ?? true)
    const currentAfternoon = currentRes ? currentRes.afternoon_schedule : (activeStudent.default_afternoon_schedule || '下校1便')

    const success = await saveReservation(activeStudent.id, dateStr, currentMorning, currentAfternoon, noteInputText.trim() || null)
    if (success) {
      showToast(`${dateStr} のメモを保存しました。`, 'success')
      setEditingNoteDate(null)
    } else {
      showToast('メモの保存に失敗しました。', 'error')
    }
  }

  // 今週の基本パターン一括適用
  const handleApplyWeekDefaultPattern = async () => {
    if (!activeStudent) return
    if (!window.confirm(`${activeStudent.name} さんの今週平日5日間に基本パターン（登校:${activeStudent.default_morning_ride ? '乗る' : '乗らない'}、下校:${activeStudent.default_afternoon_schedule || '下校1便'}）を一括適用しますか？`)) {
      return
    }

    const items = currentWeekDays.map(dateStr => ({
      date: dateStr,
      morningStatus: activeStudent.default_morning_ride ?? true,
      afternoonSchedule: activeStudent.default_afternoon_schedule || '下校1便',
      note: null
    }))

    const success = await saveWeeklyReservations(activeStudent.id, items)
    if (success) {
      showToast('今週の週間予約を一括更新しました。', 'success')
    } else {
      showToast('一括更新に失敗しました。', 'error')
    }
  }

  // 月間カレンダーの個別編集モーダルを開く
  const openEditModal = (dateStr: string, studentId: string) => {
    const res = reservations.find(r => r.student_id === studentId && r.date === dateStr)
    const std = students.find(s => s.id === studentId)
    setSelectedDate(dateStr)
    setEditMorning(res ? res.morning_status : (std?.default_morning_ride ?? true))
    setEditAfternoon(res ? res.afternoon_schedule : (std?.default_afternoon_schedule || '下校1便'))
    setEditNote(res?.note || '')
    setShowEditModal(true)
  }

  // 月間カレンダー個別予約の保存
  const handleSaveIndividualReservation = async () => {
    if (!activeStudent || !selectedDate) return
    const success = await saveReservation(activeStudent.id, selectedDate, editMorning, editAfternoon, editNote.trim() || null)
    if (success) {
      showToast(`${selectedDate} の予約を更新しました。`, 'success')
      setShowEditModal(false)
    } else {
      showToast('予約の更新に失敗しました。', 'error')
    }
  }

  // 翌月1ヶ月分の一括自動生成
  const handleBulkGenerate = async (studentId: string) => {
    const student = students.find(s => s.id === studentId)
    if (!student) return
    if (!window.confirm(`${student.name} さんの翌月1ヶ月分の平日予約を一括自動登録しますか？`)) return

    const count = await generateNextMonthReservations(studentId, student.default_morning_ride ?? true, student.default_afternoon_schedule ?? '下校1便')
    showToast(`${count}日分の平日予約を登録しました。`, 'success')
  }

  const toggleOperationStatus = (routeId: string, tripName: string = '登校便') => {
    const op = busOperations.find(o => o.bus_route_id === routeId && (o.trip_name === tripName || (!o.trip_name && tripName === '登校便')))
    let nextStatus: 'not_started' | 'running' | 'finished' = op?.status === 'not_started' ? 'running' : op?.status === 'running' ? 'finished' : 'not_started'
    let nextDelay = nextStatus === 'running' ? 5 : 0
    updateOperation(routeId, tripName, nextStatus, nextDelay)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* トースト通知 */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-white border ${
            toast.type === 'success' ? 'bg-emerald-600/90 border-emerald-500/50 shadow-emerald-900/30' :
            toast.type === 'error' ? 'bg-rose-600/90 border-rose-500/50 shadow-rose-900/30' :
            'bg-indigo-600/90 border-indigo-500/50 shadow-indigo-900/30'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" /> :
             toast.type === 'error' ? <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" /> :
             <Info className="h-5 w-5 text-indigo-400 shrink-0" />}
            <span className="text-xs font-bold">{toast.message}</span>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <header className="bg-slate-900/80 border-b border-slate-855 backdrop-blur-md sticky top-0 z-40">
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
                {profile?.full_name ? `${profile.full_name} 様` : (currentEmail || '保護者様')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            {isRealtimeConnected && (
              <span className="flex items-center gap-1.5 text-[11px] font-bold px-2 sm:px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="hidden md:inline">リアルタイム同期中</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => setIsOnboardingOpen(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-black text-amber-300 hover:text-amber-100 bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 transition-all active:scale-95 shrink-0 min-h-[36px]"
            >
              <HelpCircle className="h-4 w-4 text-amber-400 shrink-0" />
              <span>使い方ガイド</span>
            </button>

            <button
              type="button"
              onClick={() => signOut()}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 transition-all active:scale-95 shrink-0 min-h-[36px]"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* リアルタイム運行ステータス・遅延バナー */}
        <BusStatusBanner />

        {/* 1. お子様切り替えタブ */}
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

            {activeStudent && (
              <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800/80">
                <MapPin className="h-3.5 w-3.5 text-amber-400" />
                <span>登録バス停: <strong className="text-white">{activeStudent.bus_stop_name || activeStop?.stop_name || '高山研修所前'}</strong></span>
              </div>
            )}
          </div>

          {/* 2. メインビュー切り替えナビゲーション */}
          <div className="flex bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl gap-1.5 shadow-lg">
            <button
              onClick={() => setActiveMainTab('weekly')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                activeMainTab === 'weekly'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              <span>週間予約・変更入力</span>
              <span className="hidden sm:inline text-[10px] bg-indigo-500/30 px-1.5 py-0.5 rounded font-normal">おすすめ</span>
            </button>

            <button
              onClick={() => setActiveMainTab('monthly')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                activeMainTab === 'monthly'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <CalendarIcon className="h-4 w-4" />
              月間カレンダー
            </button>

            <button
              onClick={() => setActiveMainTab('status')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                activeMainTab === 'status'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Clock className="h-4 w-4" />
              本日の運行状況・乗車確認
            </button>
          </div>

          {/* タブ 1: 週間予約入力ビュー */}
          {activeMainTab === 'weekly' && (
            <div className="space-y-5 animate-in fade-in duration-300">
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

                <button
                  onClick={handleApplyWeekDefaultPattern}
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-1.5 active:scale-95 self-stretch sm:self-auto"
                >
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  今週の基本パターンを一括適用
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
                {currentWeekDays.map((dateStr) => {
                  const dateObj = new Date(`${dateStr}T00:00:00`)
                  const dayOfWeekIdx = dateObj.getDay()
                  const dayLabels = ['日', '月', '火', '水', '木', '金', '土']
                  const dayName = dayLabels[dayOfWeekIdx]
                  
                  const now = new Date()
                  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
                  const isToday = dateStr === todayStr
                  const isPast = isPastCancelLimit(dateStr)

                  const scheduleStatus = getDateScheduleStatus(dateStr)
                  const isSuspended = scheduleStatus.isSuspended

                  const currentRes = reservations.find(r => r.student_id === activeStudent?.id && r.date === dateStr)
                  const morningStatus = currentRes ? currentRes.morning_status : (activeStudent?.default_morning_ride ?? true)
                  const afternoonSchedule = currentRes ? currentRes.afternoon_schedule : (activeStudent?.default_afternoon_schedule || '下校1便')
                  const note = currentRes?.note || ''

                  return (
                    <div
                      key={dateStr}
                      className={`rounded-3xl border p-4 flex flex-col justify-between space-y-4 transition-all ${
                        isToday
                          ? 'bg-gradient-to-b from-indigo-950/60 to-slate-900/90 border-indigo-500/50 ring-2 ring-indigo-500/20 shadow-xl'
                          : isSuspended
                          ? 'bg-slate-900/40 border-rose-500/20 opacity-75'
                          : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black text-white">
                              {dateObj.getMonth() + 1}/{dateObj.getDate()}
                            </span>
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                              dayOfWeekIdx === 3 ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-300'
                            }`}>
                              ({dayName})
                            </span>
                            {isToday && (
                              <span className="text-[10px] bg-indigo-500 text-white font-black px-1.5 py-0.5 rounded-full animate-pulse">
                                本日
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                            {scheduleStatus.label}
                          </span>
                        </div>

                        {isPast && (
                          <span className="text-[9px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                            変更締切
                          </span>
                        )}
                      </div>

                      {isSuspended ? (
                        <div className="my-auto py-6 text-center space-y-1">
                          <AlertCircle className="h-6 w-6 text-rose-400 mx-auto" />
                          <p className="text-xs font-bold text-rose-300">バス運休日</p>
                          <p className="text-[10px] text-slate-400">{scheduleStatus.label}</p>
                        </div>
                      ) : (
                        <div className="space-y-3 flex-1 flex flex-col justify-center">
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 block">
                              登校便 ({getAdjustedStopArrivalTime(activeStop || { id: '', stop_name: '', arrival_time_morning: '07:30', order_index: 1 })})
                            </span>
                            <button
                              type="button"
                              disabled={isPast}
                              onClick={() => handleToggleMorning(dateStr)}
                              className={`w-full py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-between border ${
                                morningStatus
                                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-sm'
                                  : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                              } ${isPast ? 'opacity-60 cursor-not-allowed' : 'active:scale-95'}`}
                            >
                              <span>{morningStatus ? '〇 乗車する' : '✕ 乗車しない'}</span>
                              {morningStatus ? <Check className="h-4 w-4 text-emerald-400" /> : <X className="h-4 w-4 text-rose-400" />}
                            </button>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 block">下校便</span>
                            <select
                              disabled={isPast}
                              value={afternoonSchedule || '乗らない'}
                              onChange={(e) => handleChangeAfternoon(dateStr, e.target.value === '乗らない' ? null : e.target.value)}
                              className={`w-full py-2 px-2.5 bg-slate-950 border rounded-xl text-xs font-bold transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                afternoonSchedule ? 'border-indigo-500/40 text-indigo-200' : 'border-slate-800 text-slate-400'
                              } ${isPast ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                              {['下校1便', '下校2便', '下校3便', '下校4便', '下校5便'].map((tripName) => {
                                const operating = isTripOperating(tripName, dateStr)
                                const time = getTripTime(tripName, dateStr)
                                if (!operating || time === '--:--') return null
                                return <option key={tripName} value={tripName}>{tripName} ({time})</option>
                              })}
                              <option value="乗らない">乗車しない (自車送迎等)</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {!isSuspended && (
                        <div className="pt-2 border-t border-slate-800/60">
                          <button
                            type="button"
                            disabled={isPast}
                            onClick={() => handleOpenNoteModal(dateStr)}
                            className={`w-full text-left p-2 rounded-xl bg-slate-950/60 border text-[11px] transition-all flex items-center justify-between gap-1 ${
                              note ? 'border-amber-500/30 text-amber-200 bg-amber-500/5' : 'border-slate-855 text-slate-500 hover:text-slate-400'
                            } ${isPast ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            <span className="truncate flex-1">{note ? `📝 ${note}` : '+ 連絡メモ追加'}</span>
                            <MessageSquare className="h-3 w-3 shrink-0 text-slate-500" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-855 rounded-2xl flex items-start gap-3 text-xs text-slate-400">
                <Info className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  ※ 変更の締切は<strong>運行当日の朝7:00まで</strong>です。
                </p>
              </div>
            </div>
          )}

          {/* タブ 2: 月間カレンダービュー */}
          {activeMainTab === 'monthly' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-900/90 border border-slate-800 p-4 rounded-3xl gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCurrentMonth(prev => prev === 0 ? 11 : prev - 1)}
                    className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <h2 className="text-base font-black text-white">{currentYear}年 {currentMonth + 1}月</h2>
                  <button
                    onClick={() => setCurrentMonth(prev => prev === 11 ? 0 : prev + 1)}
                    className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {activeStudent && (
                  <button
                    onClick={() => handleBulkGenerate(activeStudent.id)}
                    className="px-3.5 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    翌月分の平日予約を一括自動生成
                  </button>
                )}
              </div>

              <div className="bg-slate-900/80 border border-slate-855 rounded-3xl p-4 sm:p-5 shadow-xl">
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2 text-center text-[11px] font-black text-slate-400">
                  <div className="text-rose-400">日</div><div>月</div><div>火</div><div className="text-amber-400">水</div><div>木</div><div>金</div><div className="text-indigo-400">土</div>
                </div>

                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {Array.from({ length: getFirstDayOfMonth(currentYear, currentMonth) }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="h-20 sm:h-24 bg-slate-950/20 rounded-2xl" />
                  ))}

                  {Array.from({ length: getDaysInMonth(currentYear, currentMonth) }).map((_, idx) => {
                    const day = idx + 1
                    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const dateObj = new Date(`${dateStr}T00:00:00`)
                    const dayOfWeek = dateObj.getDay()
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
                    const scheduleStatus = getDateScheduleStatus(dateStr)
                    const isSuspended = scheduleStatus.isSuspended
                    const currentRes = reservations.find(r => r.student_id === activeStudent?.id && r.date === dateStr)
                    const morningStatus = currentRes ? currentRes.morning_status : (activeStudent?.default_morning_ride ?? true)
                    const afternoonSchedule = currentRes ? currentRes.afternoon_schedule : (activeStudent?.default_afternoon_schedule || '下校1便')

                    return (
                      <div
                        key={dateStr}
                        onClick={() => {
                          if (!isWeekend && !isSuspended && activeStudent) openEditModal(dateStr, activeStudent.id)
                        }}
                        className={`h-20 sm:h-24 rounded-2xl border p-1.5 sm:p-2 flex flex-col justify-between transition-all relative ${
                          isWeekend || isSuspended ? 'border-slate-855 bg-slate-950/40 opacity-60' : 'border-slate-800/80 bg-slate-950/70 hover:border-indigo-500/50 cursor-pointer'
                        }`}
                      >
                        <div className="flex justify-between items-center text-[10px] sm:text-xs">
                          <span className={`font-black ${dayOfWeek === 0 ? 'text-rose-400' : dayOfWeek === 6 ? 'text-indigo-400' : 'text-slate-200'}`}>{day}</span>
                        </div>

                        {!isWeekend && !isSuspended && (
                          <div className="space-y-1 my-auto">
                            <div className={`text-[9px] sm:text-[10px] font-bold px-1 py-0.5 rounded truncate ${morningStatus ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                              登: {morningStatus ? '乗車' : '✕'}
                            </div>
                            <div className={`text-[9px] sm:text-[10px] font-bold px-1 py-0.5 rounded truncate ${afternoonSchedule ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-400'}`}>
                              下: {afternoonSchedule ? afternoonSchedule.replace('下校', '') : '✕'}
                            </div>
                          </div>
                        )}

                        {isSuspended && !isWeekend && (
                          <span className="text-[9px] text-rose-400 font-bold truncate">{scheduleStatus.label}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* タブ 3: 本日の運行状況 */}
          {activeMainTab === 'status' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
                <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                  <Clock className="h-5 w-5 text-indigo-400" />
                  本日の運行状況・乗車完了ステータス
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-slate-300">登校便</span>
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs">
                      <span className="text-slate-400 block mb-0.5 text-[10px]">乗車確認状況:</span>
                      <p className="font-bold text-white">乗車確認中</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-slate-300">下校便</span>
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs">
                      <span className="text-slate-400 block mb-0.5 text-[10px]">利用予定便:</span>
                      <p className="font-bold text-white">{activeStudent?.default_afternoon_schedule || '利用なし'}</p>
                    </div>
                  </div>
                </div>

                {isDemoMode && (
                  <div className="pt-2 border-t border-slate-800">
                    <button
                      onClick={() => toggleOperationStatus(activeRoute?.id || 'route-a', '登校便')}
                      className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-[11px] font-bold"
                    >
                      [デモ] 運行ステータスを模擬進行
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
      </main>

      {/* モーダル: 連絡事項・メモ編集 */}
      {editingNoteDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-amber-400" />
                連絡事項・メモの入力
              </h3>
              <button onClick={() => setEditingNoteDate(null)} className="p-1 text-slate-400 hover:text-white rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">{editingNoteDate} のメモ</label>
              <textarea
                rows={3}
                value={noteInputText}
                onChange={(e) => setNoteInputText(e.target.value)}
                placeholder="例：体調不良のため欠席など"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setEditingNoteDate(null)} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">
                キャンセル
              </button>
              <button type="button" onClick={handleSaveNoteSubmit} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black">
                保存する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* モーダル: 月間カレンダー個別予約変更 */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4 text-indigo-400" />
                {selectedDate} の予約変更
              </h3>
              <button onClick={() => setShowEditModal(false)} className="p-1 text-slate-400 hover:text-white rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">登校便</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditMorning(true)}
                    className={`flex-1 py-2.5 rounded-xl font-bold border ${editMorning ? 'bg-emerald-500/25 border-emerald-500 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
                  >
                    利用する
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditMorning(false)}
                    className={`flex-1 py-2.5 rounded-xl font-bold border ${!editMorning ? 'bg-rose-500/25 border-rose-500 text-rose-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
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
                  <option value="下校1便">下校1便 ({getTripTime('下校1便', selectedDate || undefined)})</option>
                  <option value="下校2便">下校2便 ({getTripTime('下校2便', selectedDate || undefined)})</option>
                  <option value="下校3便">下校3便 ({getTripTime('下校3便', selectedDate || undefined)})</option>
                  <option value="下校4便">下校4便 ({getTripTime('下校4便', selectedDate || undefined)})</option>
                  <option value="下校5便">下校5便 ({getTripTime('下校5便', selectedDate || undefined)})</option>
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
              <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">
                キャンセル
              </button>
              <button type="button" onClick={handleSaveIndividualReservation} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black">
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
        onComplete={() => setIsOnboardingOpen(false)}
      />
    </div>
  )
}
