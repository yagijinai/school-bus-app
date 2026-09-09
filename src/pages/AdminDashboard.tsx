import React, { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { 
  Bus, Calendar, FileSpreadsheet, Users, MapPin, Clock,
  RefreshCw, LogOut, Check, 
  Sun, Snowflake, Palmtree, Ban, Filter,
  ChevronLeft, ChevronRight, Plus, Trash2, Edit3, X, Sparkles, CheckCircle2, Layers
} from 'lucide-react'
import type { BasicSettingRow, GuardianMasterRow, SchoolTimetableRow, BusStopRow } from '../types/spreadsheet'
import { toSlashDate, toHyphenDate, formatTimeToHHmm } from '../lib/spreadsheetApi'

export const AdminDashboard: React.FC = () => {
  const { 
    user, logout, basicSettings, schedules, 
    guardianMaster, busStops, schoolTimetable,
    saveBasicSetting, saveGuardianMaster, saveSchoolTimetable,
    saveBusStop, deleteBusStop,
    syncing, refreshAll 
  } = useApp()

  const [activeTab, setActiveTab] = useState<'basicSettings' | 'schedules' | 'guardians' | 'timetable' | 'stops'>('basicSettings')

  // ==========================================
  // 1. 基本設定インラインドラフト用状態
  // ==========================================
  const [drafts, setDrafts] = useState<Record<string, Partial<BasicSettingRow>>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)

  const handleDraftChange = (settingName: string, field: keyof BasicSettingRow, val: string) => {
    setDrafts(prev => ({
      ...prev,
      [settingName]: {
        ...(prev[settingName] || {}),
        [field]: val
      }
    }))
  }

  const handleAutoSave = async (settingName: string, field: keyof BasicSettingRow, val: string) => {
    const row = basicSettings.find(b => b.setting_name === settingName)
    const draft = drafts[settingName] || {}

    const startDate = field === 'start_date' ? val : (draft.start_date !== undefined ? draft.start_date : (row?.start_date || ''))
    const endDate = field === 'end_date' ? val : (draft.end_date !== undefined ? draft.end_date : (row?.end_date || ''))
    const stdOp = field === 'standard_operation' ? val : (draft.standard_operation !== undefined ? draft.standard_operation : (row?.standard_operation || ''))
    const content = field === 'content_time' ? val : (draft.content_time !== undefined ? draft.content_time : (row?.content_time || ''))
    const note = field === 'note' ? val : (draft.note !== undefined ? draft.note : (row?.note || ''))

    setSavingKey(settingName)
    try {
      const res = await saveBasicSetting({
        setting_name: settingName,
        start_date: startDate,
        end_date: endDate,
        standard_operation: stdOp,
        content_time: content,
        note: note
      })

      if (res.success) {
        setSavedKey(settingName)
        setTimeout(() => setSavedKey(null), 2500)
      } else {
        alert(`保存に失敗しました: ${res.message}`)
      }
    } finally {
      setSavingKey(null)
    }
  }

  // ==========================================
  // 2. 運行予定カレンダー一覧・集計
  // ==========================================
  const getTodaySlash = () => toSlashDate(new Date())
  const getTomorrowSlash = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return toSlashDate(d)
  }

  const [selectedDate, setSelectedDate] = useState<string>(getTodaySlash)
  const [isAllDates, setIsAllDates] = useState<boolean>(false)

  // 生徒名から登録バス停を引くマップ
  const studentBusStopMap = useMemo(() => {
    const map = new Map<string, string>()
    guardianMaster.forEach(g => {
      g.student_names.forEach(s => {
        if (s) map.set(s, g.bus_stop_name)
      })
    })
    return map
  }, [guardianMaster])

  // 絞り込み済み運行予定
  const filteredSchedules = useMemo(() => {
    if (isAllDates) return schedules
    const target = selectedDate.replace(/-/g, '/')
    return schedules.filter(s => s.date.replace(/-/g, '/') === target)
  }, [schedules, isAllDates, selectedDate])

  // リアルタイム集計
  const summaryCounts = useMemo(() => {
    let morningCount = 0
    let trip1Count = 0
    let trip2Count = 0
    let trip3Count = 0
    let notRidingCount = 0

    filteredSchedules.forEach(row => {
      if (row.morning_status === '乗る') {
        morningCount++
      }
      if (row.afternoon_status === '乗らない') {
        notRidingCount++
      } else {
        if (row.afternoon_trip_1) trip1Count++
        if (row.afternoon_trip_2) trip2Count++
        if (row.afternoon_trip_3) trip3Count++
      }
    })

    return {
      morningCount,
      trip1Count,
      trip2Count,
      trip3Count,
      notRidingCount,
      totalReservations: filteredSchedules.length
    }
  }, [filteredSchedules])

  // ==========================================
  // 3. 生徒・保護者マスター インライン編集
  // ※「基本_登校」「基本_下校」は保護者が各自決定するため、管理者画面からは変更せず既存値を維持
  // ==========================================
  const [guardianDrafts, setGuardianDrafts] = useState<Record<string, Partial<GuardianMasterRow>>>({})
  const [savingGuardianEmail, setSavingGuardianEmail] = useState<string | null>(null)
  const [savedGuardianEmail, setSavedGuardianEmail] = useState<string | null>(null)

  const handleGuardianDraftChange = (email: string, field: keyof GuardianMasterRow, val: string) => {
    setGuardianDrafts(prev => ({
      ...prev,
      [email]: {
        ...(prev[email] || {}),
        [field]: val
      }
    }))
  }

  const handleSaveGuardian = async (email: string, field: keyof GuardianMasterRow, val: string) => {
    const row = guardianMaster.find(g => g.parent_email.toLowerCase() === email.toLowerCase())
    const draft = guardianDrafts[email] || {}

    const busStop = field === 'bus_stop_name' ? val : (draft.bus_stop_name !== undefined ? draft.bus_stop_name : (row?.bus_stop_name || ''))
    const memo = field === 'note' ? val : (draft.note !== undefined ? draft.note : (row?.note || ''))
    // 基本_登校・下校は既存の保護者設定値をそのまま保持
    const defMorning = row?.default_morning || '乗る'
    const defAfternoon = row?.default_afternoon || '1便'

    setSavingGuardianEmail(email)
    try {
      const res = await saveGuardianMaster({
        parent_email: email,
        student_name_1: row?.student_name_1,
        student_name_2: row?.student_name_2,
        student_name_3: row?.student_name_3,
        student_name_4: row?.student_name_4,
        bus_stop_name: busStop,
        note: memo,
        default_morning: defMorning,
        default_afternoon: defAfternoon
      })

      if (res.success) {
        setSavedGuardianEmail(email)
        setTimeout(() => setSavedGuardianEmail(null), 2500)
      } else {
        alert(`保護者マスター保存に失敗しました: ${res.message}`)
      }
    } finally {
      setSavingGuardianEmail(null)
    }
  }

  // ==========================================
  // 4. 学校用時刻表マスタ（月別カレンダー & 特別運行日編集モーダル）
  // ==========================================
  const [timetableDisplayMode, setTimetableDisplayMode] = useState<'calendar' | 'table'>('calendar')
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(() => new Date())
  const [isTimetableModalOpen, setIsTimetableModalOpen] = useState(false)
  const [selectedTimetableDate, setSelectedTimetableDate] = useState<string>('')
  const [timetableModalDraft, setTimetableModalDraft] = useState<SchoolTimetableRow>({
    date: '',
    morning_trip: '',
    afternoon_trip_1: '',
    afternoon_trip_2: '',
    afternoon_trip_3: '',
    note: '',
    calendar_label: ''
  })
  const [isSavingTimetableModal, setIsSavingTimetableModal] = useState(false)
  const [savedTimetableModal, setSavedTimetableModal] = useState(false)

  // テーブル表示用のドラフト状態
  const [timetableDrafts, setTimetableDrafts] = useState<Record<string, Partial<SchoolTimetableRow>>>({})
  const [savingTimetableDate, setSavingTimetableDate] = useState<string | null>(null)
  const [savedTimetableDate, setSavedTimetableDate] = useState<string | null>(null)

  // カレンダー前月・次月・今月切り替え
  const handlePrevMonth = () => {
    setCurrentCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }
  const handleNextMonth = () => {
    setCurrentCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }
  const handleCurrentMonth = () => {
    setCurrentCalendarDate(new Date())
  }

  // 月間グリッド配列生成
  const calendarDays = useMemo(() => {
    const year = currentCalendarDate.getFullYear()
    const month = currentCalendarDate.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const firstDayOfWeek = firstDay.getDay()
    const lastDay = new Date(year, month + 1, 0)
    const totalDays = lastDay.getDate()
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    
    const days: Array<{
      dateStr: string
      dayNumber: number
      isCurrentMonth: boolean
      isToday: boolean
      dayOfWeek: number
    }> = []

    const todayStr = toSlashDate(new Date())
    const pad = (n: number) => String(n).padStart(2, '0')

    // 前月余白
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i
      const prevMonth = month === 0 ? 12 : month
      const prevYear = month === 0 ? year - 1 : year
      const dateStr = `${prevYear}/${pad(prevMonth)}/${pad(d)}`
      const dayDate = new Date(prevYear, prevMonth - 1, d)
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        dayOfWeek: dayDate.getDay()
      })
    }

    // 当月の日付
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}/${pad(month + 1)}/${pad(d)}`
      const dayDate = new Date(year, month, d)
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        dayOfWeek: dayDate.getDay()
      })
    }

    // 翌月余白
    const remainingDays = (7 - (days.length % 7)) % 7
    for (let d = 1; d <= remainingDays; d++) {
      const nextMonth = month + 2 > 12 ? 1 : month + 2
      const nextYear = month + 2 > 12 ? year + 1 : year
      const dateStr = `${nextYear}/${pad(nextMonth)}/${pad(d)}`
      const dayDate = new Date(nextYear, nextMonth - 1, d)
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        dayOfWeek: dayDate.getDay()
      })
    }

    return days
  }, [currentCalendarDate])

  // 日付 -> 時刻表データのマップ
  const timetableMap = useMemo(() => {
    const map = new Map<string, SchoolTimetableRow>()
    schoolTimetable.forEach(t => {
      const norm = t.date.replace(/-/g, '/')
      map.set(norm, t)
    })
    return map
  }, [schoolTimetable])

  // カレンダーセルクリック：特別運行日・運行時刻編集モーダルを開く
  const handleOpenTimetableModal = (dateStr: string) => {
    setSelectedTimetableDate(dateStr)
    const existing = timetableMap.get(dateStr)
    setTimetableModalDraft({
      date: dateStr,
      morning_trip: existing?.morning_trip || '',
      afternoon_trip_1: existing?.afternoon_trip_1 || '',
      afternoon_trip_2: existing?.afternoon_trip_2 || '',
      afternoon_trip_3: existing?.afternoon_trip_3 || '',
      note: existing?.note || '',
      calendar_label: existing?.calendar_label || ''
    })
    setSavedTimetableModal(false)
    setIsTimetableModalOpen(true)
  }

  // クイック入力プリセット適用
  const handleApplyPreset = (preset: 'normal' | 'morning_only' | 'holiday' | 'clear') => {
    if (preset === 'normal') {
      setTimetableModalDraft(prev => ({
        ...prev,
        morning_trip: '08:00',
        afternoon_trip_1: '15:00',
        afternoon_trip_2: '16:00',
        afternoon_trip_3: '17:00',
        calendar_label: prev.calendar_label || '通常運行'
      }))
    } else if (preset === 'morning_only') {
      setTimetableModalDraft(prev => ({
        ...prev,
        morning_trip: '08:00',
        afternoon_trip_1: '',
        afternoon_trip_2: '',
        afternoon_trip_3: '',
        calendar_label: '午前便のみ運行'
      }))
    } else if (preset === 'holiday') {
      setTimetableModalDraft(prev => ({
        ...prev,
        morning_trip: '',
        afternoon_trip_1: '',
        afternoon_trip_2: '',
        afternoon_trip_3: '',
        calendar_label: '全便運休'
      }))
    } else if (preset === 'clear') {
      setTimetableModalDraft(prev => ({
        ...prev,
        morning_trip: '',
        afternoon_trip_1: '',
        afternoon_trip_2: '',
        afternoon_trip_3: '',
        note: '',
        calendar_label: ''
      }))
    }
  }

  // モーダルから保存
  const handleSaveTimetableModal = async () => {
    if (!selectedTimetableDate) return
    setIsSavingTimetableModal(true)
    try {
      const res = await saveSchoolTimetable({
        date: selectedTimetableDate,
        morning_trip: formatTimeToHHmm(timetableModalDraft.morning_trip),
        afternoon_trip_1: formatTimeToHHmm(timetableModalDraft.afternoon_trip_1),
        afternoon_trip_2: formatTimeToHHmm(timetableModalDraft.afternoon_trip_2),
        afternoon_trip_3: formatTimeToHHmm(timetableModalDraft.afternoon_trip_3),
        note: timetableModalDraft.note,
        calendar_label: timetableModalDraft.calendar_label
      })
      if (res.success) {
        setSavedTimetableModal(true)
        setTimeout(() => {
          setIsTimetableModalOpen(false)
          setSavedTimetableModal(false)
        }, 800)
      } else {
        alert(`保存に失敗しました: ${res.message}`)
      }
    } finally {
      setIsSavingTimetableModal(false)
    }
  }

  // テーブル用インライン変更
  const handleTimetableDraftChange = (date: string, field: keyof SchoolTimetableRow, val: string) => {
    setTimetableDrafts(prev => ({
      ...prev,
      [date]: {
        ...(prev[date] || {}),
        [field]: val
      }
    }))
  }

  const handleSaveTimetable = async (date: string, field: keyof SchoolTimetableRow, val: string) => {
    const row = schoolTimetable.find(t => t.date.replace(/-/g, '/') === date.replace(/-/g, '/'))
    const draft = timetableDrafts[date] || {}

    const morningTrip = field === 'morning_trip' ? val : (draft.morning_trip !== undefined ? draft.morning_trip : (row?.morning_trip || ''))
    const trip1 = field === 'afternoon_trip_1' ? val : (draft.afternoon_trip_1 !== undefined ? draft.afternoon_trip_1 : (row?.afternoon_trip_1 || ''))
    const trip2 = field === 'afternoon_trip_2' ? val : (draft.afternoon_trip_2 !== undefined ? draft.afternoon_trip_2 : (row?.afternoon_trip_2 || ''))
    const trip3 = field === 'afternoon_trip_3' ? val : (draft.afternoon_trip_3 !== undefined ? draft.afternoon_trip_3 : (row?.afternoon_trip_3 || ''))
    const note = field === 'note' ? val : (draft.note !== undefined ? draft.note : (row?.note || ''))
    const label = field === 'calendar_label' ? val : (draft.calendar_label !== undefined ? draft.calendar_label : (row?.calendar_label || ''))

    setSavingTimetableDate(date)
    try {
      const res = await saveSchoolTimetable({
        date,
        morning_trip: formatTimeToHHmm(morningTrip),
        afternoon_trip_1: formatTimeToHHmm(trip1),
        afternoon_trip_2: formatTimeToHHmm(trip2),
        afternoon_trip_3: formatTimeToHHmm(trip3),
        note,
        calendar_label: label
      })

      if (res.success) {
        setSavedTimetableDate(date)
        setTimeout(() => setSavedTimetableDate(null), 2500)
      } else {
        alert(`時刻表保存に失敗しました: ${res.message}`)
      }
    } finally {
      setSavingTimetableDate(null)
    }
  }

  // ==========================================
  // 5. バス停マスタ（インライン編集・新規追加・HH:mm時刻適正化）
  // ==========================================
  const [busStopDrafts, setBusStopDrafts] = useState<Record<string, Partial<BusStopRow>>>({})
  const [savingBusStopName, setSavingBusStopName] = useState<string | null>(null)
  const [savedBusStopName, setSavedBusStopName] = useState<string | null>(null)
  
  // 新規追加カード/モーダル状態
  const [isAddBusStopModalOpen, setIsAddBusStopModalOpen] = useState(false)
  const [newBusStop, setNewBusStop] = useState<{
    name: string
    arrival_time_morning: string
    address: string
    order: number
  }>({
    name: '',
    arrival_time_morning: '07:30',
    address: '',
    order: 1
  })
  const [isAddingBusStop, setIsAddingBusStop] = useState(false)

  const handleBusStopDraftChange = (originalName: string, field: keyof BusStopRow, val: any) => {
    setBusStopDrafts(prev => ({
      ...prev,
      [originalName]: {
        ...(prev[originalName] || {}),
        [field]: val
      }
    }))
  }

  const handleSaveBusStopInline = async (originalName: string) => {
    const row = busStops.find(b => b.name === originalName)
    const draft = busStopDrafts[originalName] || {}
    const newName = (draft.name !== undefined ? draft.name : (row?.name || '')).trim()
    if (!newName) {
      alert('バス停名を入力してください')
      return
    }
    const address = draft.address !== undefined ? draft.address : (row?.address || '')
    const time = draft.arrival_time_morning !== undefined ? draft.arrival_time_morning : (row?.arrival_time_morning || '')
    const order = draft.order !== undefined ? Number(draft.order) : (row?.order || 0)

    setSavingBusStopName(originalName)
    try {
      const res = await saveBusStop({
        name: newName,
        old_name: originalName,
        address,
        arrival_time_morning: formatTimeToHHmm(time),
        order
      })
      if (res.success) {
        setSavedBusStopName(originalName)
        setTimeout(() => setSavedBusStopName(null), 2000)
      } else {
        alert(`バス停の保存に失敗しました: ${res.message}`)
      }
    } finally {
      setSavingBusStopName(null)
    }
  }

  const handleCreateBusStop = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBusStop.name.trim()) {
      alert('バス停名を入力してください')
      return
    }
    setIsAddingBusStop(true)
    try {
      const res = await saveBusStop({
        name: newBusStop.name.trim(),
        address: newBusStop.address.trim(),
        arrival_time_morning: formatTimeToHHmm(newBusStop.arrival_time_morning),
        order: Number(newBusStop.order) || busStops.length + 1
      })
      if (res.success) {
        setIsAddBusStopModalOpen(false)
        setNewBusStop({
          name: '',
          arrival_time_morning: '07:30',
          address: '',
          order: busStops.length + 2
        })
      } else {
        alert(`新規バス停追加に失敗しました: ${res.message}`)
      }
    } finally {
      setIsAddingBusStop(false)
    }
  }

  const handleDeleteBusStopClick = async (name: string) => {
    if (!window.confirm(`バス停「${name}」を削除しますか？`)) return
    setSavingBusStopName(name)
    try {
      const res = await deleteBusStop(name)
      if (!res.success) {
        alert(`削除に失敗しました: ${res.message}`)
      }
    } finally {
      setSavingBusStopName(null)
    }
  }


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* 上部ヘッダー */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white rounded-2xl shadow-md">
            <Bus className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white flex items-center gap-2">
              管理者コンソール (ADMIN CONSOLE)
              <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-bold">
                スプレッドシート生データ直結
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              ログイン: {user?.email}（{user?.name}）
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => refreshAll()}
            disabled={syncing}
            className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-amber-400 hover:text-amber-300 transition-all text-xs font-bold flex items-center gap-1.5"
            title="スプレッドシートの生データを再取得"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'データ再同期中...' : 'GASから最新データを再同期'}
          </button>
          <button
            type="button"
            onClick={logout}
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-rose-400 transition-all text-xs font-bold flex items-center gap-1"
          >
            <LogOut className="h-4 w-4" />
            ログアウト
          </button>
        </div>
      </header>

      {/* タブナビゲーション */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-850 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('basicSettings')}
          className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'basicSettings'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/15'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          基本設定・運休期間マスタ ({basicSettings.length}件)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('schedules')}
          className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'schedules'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/15'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Calendar className="h-4 w-4" />
          運行予定カレンダー一覧 ({schedules.length}件)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('guardians')}
          className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'guardians'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/15'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Users className="h-4 w-4" />
          生徒・保護者マスター ({guardianMaster.length}世帯)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('timetable')}
          className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'timetable'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/15'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Clock className="h-4 w-4" />
          学校用時刻表マスタ ({schoolTimetable.length}日分)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('stops')}
          className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'stops'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/15'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <MapPin className="h-4 w-4" />
          バス停マスタ ({busStops.length}停留所)
        </button>
      </div>

      {/* ========================================================= */}
      {/* タブ 1: 基本設定・運休期間（生データ直結・インライン即時保存） */}
      {/* ========================================================= */}
      {activeTab === 'basicSettings' && (
        <div className="space-y-6">
          {/* ハイライトカード表示 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <Sun className="h-4 w-4 text-amber-400" />
                長期休業・運休期間ハイライト（スプレッドシート生データ表示）
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                全 {basicSettings.length} 行取得済
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {basicSettings.map((period, idx) => {
                const settingName = period.setting_name
                const draft = drafts[settingName] || {}
                const curStart = draft.start_date !== undefined ? draft.start_date : period.start_date
                const curEnd = draft.end_date !== undefined ? draft.end_date : period.end_date
                const isSaving = savingKey === settingName
                const isSaved = savedKey === settingName

                const isSummer = settingName.includes('夏')
                const isWinter = settingName.includes('冬')
                const isSpring = settingName.includes('春')

                return (
                  <div
                    key={idx}
                    className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-3 relative overflow-hidden hover:border-slate-700 transition-all shadow-lg"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2.5 rounded-2xl ${
                          isSummer ? 'bg-amber-500/20 text-amber-300' :
                          isWinter ? 'bg-sky-500/20 text-sky-300' :
                          isSpring ? 'bg-emerald-500/20 text-emerald-300' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          {isSummer ? <Sun className="h-5 w-5" /> :
                           isWinter ? <Snowflake className="h-5 w-5" /> :
                           isSpring ? <Palmtree className="h-5 w-5" /> :
                           <Ban className="h-5 w-5 text-rose-400" />}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">{settingName}</h3>
                          <span className="text-[10px] text-slate-400 font-mono">行 #{idx + 1}</span>
                        </div>
                      </div>

                      {isSaving ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                          <RefreshCw className="h-3 w-3 animate-spin" /> 保存中
                        </span>
                      ) : isSaved ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                          <Check className="h-3 w-3" /> 保存完了
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 bg-slate-950 px-2 py-0.5 rounded-md">
                          自動同期
                        </span>
                      )}
                    </div>

                    <div className="bg-slate-950/80 rounded-2xl p-3 border border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 font-bold">期間（スプレッドシート直結）</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {period.standard_operation || '運休'}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-xs font-mono font-bold text-slate-200 bg-slate-900/90 px-2.5 py-1.5 rounded-xl border border-slate-800 flex items-center justify-between">
                          <span className="text-amber-400">{curStart || '未設定'}</span>
                          <span className="text-slate-500">～</span>
                          <span className="text-amber-400">{curEnd || '未設定'}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          <div>
                            <span className="text-[9px] text-slate-500 block mb-0.5">開始日</span>
                            <input
                              type="date"
                              value={toHyphenDate(curStart)}
                              onChange={(e) => {
                                const slash = toSlashDate(e.target.value)
                                handleDraftChange(settingName, 'start_date', slash)
                                handleAutoSave(settingName, 'start_date', slash)
                              }}
                              className="w-full bg-slate-900 border border-slate-800 hover:border-amber-500/60 rounded-lg px-2 py-1 text-[11px] text-amber-300 font-mono focus:outline-none transition-all cursor-pointer"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block mb-0.5">終了日</span>
                            <input
                              type="date"
                              value={toHyphenDate(curEnd)}
                              onChange={(e) => {
                                const slash = toSlashDate(e.target.value)
                                handleDraftChange(settingName, 'end_date', slash)
                                handleAutoSave(settingName, 'end_date', slash)
                              }}
                              className="w-full bg-slate-900 border border-slate-800 hover:border-amber-500/60 rounded-lg px-2 py-1 text-[11px] text-amber-300 font-mono focus:outline-none transition-all cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 全項目インライン編集テーブル */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                スプレッドシート「基本設定・運休期間」インライン編集テーブル
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                開始日・終了日（日付選択時）、標準運行（選択時）、内容・備考（入力完了時）に即座にGAS（action: saveBasicSetting）へ送信されます。
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center text-slate-600">#</th>
                    <th className="py-3 px-3 min-w-[130px]">設定名 (A列)</th>
                    <th className="py-3 px-3 min-w-[145px]">開始日 (B列)</th>
                    <th className="py-3 px-3 min-w-[145px]">終了日 (C列)</th>
                    <th className="py-3 px-3 min-w-[115px]">標準運行 (D列)</th>
                    <th className="py-3 px-3 min-w-[160px]">内容・時刻 (E列)</th>
                    <th className="py-3 px-3 min-w-[160px]">備考 (F列)</th>
                    <th className="py-3 px-3 w-24 text-center">保存状況</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {basicSettings.map((row, idx) => {
                    const settingName = row.setting_name
                    const draft = drafts[settingName] || {}
                    const curStart = draft.start_date !== undefined ? draft.start_date : row.start_date
                    const curEnd = draft.end_date !== undefined ? draft.end_date : row.end_date
                    const curStdOp = draft.standard_operation !== undefined ? draft.standard_operation : row.standard_operation
                    const curContent = draft.content_time !== undefined ? draft.content_time : row.content_time
                    const curNote = draft.note !== undefined ? draft.note : row.note

                    const isSaving = savingKey === settingName
                    const isSaved = savedKey === settingName

                    return (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 text-center font-mono text-slate-500 text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 font-bold text-white">
                          {settingName}
                        </td>
                        {/* 開始日 */}
                        <td className="py-3 px-3">
                          <input
                            type="date"
                            value={toHyphenDate(curStart)}
                            onChange={(e) => {
                              const slash = toSlashDate(e.target.value)
                              handleDraftChange(settingName, 'start_date', slash)
                              handleAutoSave(settingName, 'start_date', slash)
                            }}
                            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-amber-300 font-mono text-xs focus:outline-none focus:border-amber-400 cursor-pointer w-full"
                          />
                        </td>
                        {/* 終了日 */}
                        <td className="py-3 px-3">
                          <input
                            type="date"
                            value={toHyphenDate(curEnd)}
                            onChange={(e) => {
                              const slash = toSlashDate(e.target.value)
                              handleDraftChange(settingName, 'end_date', slash)
                              handleAutoSave(settingName, 'end_date', slash)
                            }}
                            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-amber-300 font-mono text-xs focus:outline-none focus:border-amber-400 cursor-pointer w-full"
                          />
                        </td>
                        {/* 標準運行 */}
                        <td className="py-3 px-3">
                          <select
                            value={curStdOp}
                            onChange={(e) => {
                              const val = e.target.value
                              handleDraftChange(settingName, 'standard_operation', val)
                              handleAutoSave(settingName, 'standard_operation', val)
                            }}
                            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-amber-400 cursor-pointer w-full"
                          >
                            <option value="運行">運行</option>
                            <option value="運休">運休</option>
                            <option value="特別運行">特別運行</option>
                            <option value="未定">未定</option>
                          </select>
                        </td>
                        {/* 内容・時刻 */}
                        <td className="py-3 px-3">
                          <input
                            type="text"
                            value={curContent}
                            onChange={(e) => handleDraftChange(settingName, 'content_time', e.target.value)}
                            onBlur={(e) => handleAutoSave(settingName, 'content_time', e.target.value)}
                            placeholder="例: 全便運休"
                            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-amber-400 w-full"
                          />
                        </td>
                        {/* 備考 */}
                        <td className="py-3 px-3">
                          <input
                            type="text"
                            value={curNote}
                            onChange={(e) => handleDraftChange(settingName, 'note', e.target.value)}
                            onBlur={(e) => handleAutoSave(settingName, 'note', e.target.value)}
                            placeholder="備考入力"
                            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 text-xs focus:outline-none focus:border-amber-400 w-full"
                          />
                        </td>
                        {/* 保存状況 */}
                        <td className="py-3 px-3 text-center">
                          {isSaving ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
                              <RefreshCw className="h-3 w-3 animate-spin" /> 保存中
                            </span>
                          ) : isSaved ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                              <Check className="h-3 w-3" /> 保存済
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-600 font-mono">自動同期</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* タブ 2: 運行予定カレンダー一覧（集計カード & 日付フィルター） */}
      {/* ========================================================= */}
      {activeTab === 'schedules' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          {/* 上部フィルターバー */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-400" />
                運行予定カレンダー 全生徒予約状況・リアルタイム集計
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                スプレッドシート「運行予定カレンダー」シートから直接取得した全行データです。
              </p>
            </div>

            {/* 日付絞り込みボタングループ */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(getTodaySlash())
                  setIsAllDates(false)
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  !isAllDates && selectedDate === getTodaySlash()
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                今日
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(getTomorrowSlash())
                  setIsAllDates(false)
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  !isAllDates && selectedDate === getTomorrowSlash()
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                明日
              </button>
              <button
                type="button"
                onClick={() => setIsAllDates(true)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isAllDates
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                全件表示 ({schedules.length}件)
              </button>

              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <input
                  type="date"
                  value={toHyphenDate(selectedDate)}
                  onChange={(e) => {
                    setSelectedDate(toSlashDate(e.target.value))
                    setIsAllDates(false)
                  }}
                  className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* 運行便ごとのリアルタイム集計カード */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">
                {isAllDates ? '【全期間集計】' : `【${selectedDate} 集計】`}
              </span>
              <span className="text-xs font-mono text-slate-500">
                該当予約: {summaryCounts.totalReservations}件
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {/* 登校便 */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between shadow-sm">
                <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                  🌅 登校便
                </span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">{summaryCounts.morningCount}</span>
                  <span className="text-xs text-slate-400">名</span>
                </div>
              </div>

              {/* 下校1便 */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between shadow-sm">
                <span className="text-[11px] font-bold text-sky-400 flex items-center gap-1">
                  🚌 下校1便
                </span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">{summaryCounts.trip1Count}</span>
                  <span className="text-xs text-slate-400">名</span>
                </div>
              </div>

              {/* 下校2便 */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between shadow-sm">
                <span className="text-[11px] font-bold text-indigo-400 flex items-center gap-1">
                  🚍 下校2便
                </span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">{summaryCounts.trip2Count}</span>
                  <span className="text-xs text-slate-400">名</span>
                </div>
              </div>

              {/* 下校3便 */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between shadow-sm">
                <span className="text-[11px] font-bold text-purple-400 flex items-center gap-1">
                  🌙 下校3便
                </span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">{summaryCounts.trip3Count}</span>
                  <span className="text-xs text-slate-400">名</span>
                </div>
              </div>

              {/* 下校乗らない */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between shadow-sm col-span-2 sm:col-span-1">
                <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                  🚫 下校乗らない
                </span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">{summaryCounts.notRidingCount}</span>
                  <span className="text-xs text-slate-400">名</span>
                </div>
              </div>
            </div>
          </div>

          {/* 一覧テーブル */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3">日付</th>
                  <th className="py-3 px-3">生徒名</th>
                  <th className="py-3 px-3">登録バス停</th>
                  <th className="py-3 px-3 text-center">登校ステータス</th>
                  <th className="py-3 px-3 text-center">下校便</th>
                  <th className="py-3 px-3">保護者メール</th>
                  <th className="py-3 px-3">備考</th>
                  <th className="py-3 px-3 font-mono text-[10px]">更新日時</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredSchedules.length > 0 ? (
                  filteredSchedules.map((row, idx) => {
                    const busStopName = studentBusStopMap.get(row.student_name) || '-'

                    return (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 font-mono text-slate-400">{row.date}</td>
                        <td className="py-3 px-3 font-bold text-white text-sm">{row.student_name}</td>
                        <td className="py-3 px-3 text-amber-300 font-bold">{busStopName}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            row.morning_status === '乗る'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'text-slate-500 bg-slate-950'
                          }`}>
                            {row.morning_status === '乗る' ? '乗る' : '運休/不在'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            row.afternoon_status === '乗らない'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : row.afternoon_trip_1 ? 'bg-sky-500/20 text-sky-300'
                              : row.afternoon_trip_2 ? 'bg-indigo-500/20 text-indigo-300'
                              : row.afternoon_trip_3 ? 'bg-purple-500/20 text-purple-300'
                              : 'text-slate-500 bg-slate-950'
                          }`}>
                            {row.afternoon_status === '乗らない' ? '乗らない' :
                             row.afternoon_trip_1 ? `下校1便 (${row.afternoon_trip_1})` :
                             row.afternoon_trip_2 ? `下校2便 (${row.afternoon_trip_2})` :
                             row.afternoon_trip_3 ? `下校3便 (${row.afternoon_trip_3})` : '未指定'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">{row.parent_email}</td>
                        <td className="py-3 px-3 text-slate-300">{row.note || '-'}</td>
                        <td className="py-3 px-3 font-mono text-[10px] text-slate-500">{row.updated_at || '-'}</td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      {isAllDates ? '予約データがありません' : `選択日（${selectedDate}）の予約データはありません`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* タブ 3: 生徒・保護者マスター（インライン編集＆即時自動保存） */}
      {/* ※基本_登校/下校は保護者が各自決定するため管理者一覧からは完全削除 */}
      {/* ========================================================= */}
      {activeTab === 'guardians' && (
        <div className="bg-slate-900/70 border border-slate-850 rounded-3xl p-6 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-400" />
              生徒・保護者マスター インライン編集＆即時自動保存
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              登録バス停のプルダウン変更時、備考の入力完了時（フォーカス離脱時）に即座にGAS（action: saveGuardianMaster）へ送信されます。（基本_登下校設定は保護者が各自で決定するため管理者画面のテーブルからは削除されています）
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3 min-w-[160px]">保護者メールアドレス (A列)</th>
                  <th className="py-3 px-3 min-w-[160px]">登録生徒名 (B〜E列)</th>
                  <th className="py-3 px-3 min-w-[180px]">登録バス停名 (F列)</th>
                  <th className="py-3 px-3 min-w-[200px]">備考 (G列)</th>
                  <th className="py-3 px-3 w-24 text-center">保存状況</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {guardianMaster.map((g, idx) => {
                  const email = g.parent_email
                  const draft = guardianDrafts[email] || {}
                  const curBusStop = draft.bus_stop_name !== undefined ? draft.bus_stop_name : g.bus_stop_name
                  const curNote = draft.note !== undefined ? draft.note : (g.note || '')

                  const isSaving = savingGuardianEmail === email
                  const isSaved = savedGuardianEmail === email

                  return (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-300 font-bold">
                        {email}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {g.student_names.map((name, i) => (
                            <span key={i} className="px-2 py-0.5 bg-slate-800 text-white rounded font-bold text-[11px]">
                              {name}
                            </span>
                          ))}
                        </div>
                      </td>
                      {/* 登録バス停名（バス停マスタのプルダウン） */}
                      <td className="py-3 px-3">
                        <select
                          value={curBusStop}
                          onChange={(e) => {
                            const val = e.target.value
                            handleGuardianDraftChange(email, 'bus_stop_name', val)
                            handleSaveGuardian(email, 'bus_stop_name', val)
                          }}
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-amber-300 font-bold text-xs focus:outline-none focus:border-amber-400 cursor-pointer w-full"
                        >
                          <option value="">未選択</option>
                          {busStops.map(b => (
                            <option key={b.name} value={b.name}>{b.name}</option>
                          ))}
                        </select>
                      </td>
                      {/* 備考（onBlurで保存） */}
                      <td className="py-3 px-3">
                        <input
                          type="text"
                          value={curNote}
                          onChange={(e) => handleGuardianDraftChange(email, 'note', e.target.value)}
                          onBlur={(e) => handleSaveGuardian(email, 'note', e.target.value)}
                          placeholder="備考入力"
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300 text-xs focus:outline-none focus:border-amber-400 w-full"
                        />
                      </td>
                      {/* 保存状況 */}
                      <td className="py-3 px-3 text-center">
                        {isSaving ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
                            <RefreshCw className="h-3 w-3 animate-spin" /> 保存中
                          </span>
                        ) : isSaved ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                            <Check className="h-3 w-3" /> 保存済
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-600 font-mono">自動同期</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* タブ 4: 学校用時刻表マスタ（Googleカレンダー風月別表示 & モーダル編集） */}
      {/* ========================================================= */}
      {activeTab === 'timetable' && (
        <div className="space-y-6">
          {/* ヘッダー＆表示モード切り替え */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/70 border border-slate-850 rounded-3xl p-6 shadow-xl">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-sky-400" />
                学校用時刻表マスタ（月別運行カレンダー）
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Googleカレンダー風の月別表示です。日付セルをクリックして登校便・下校便の運行時刻や学校行事・備考を入力・保存できます。
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-2xl border border-slate-800 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setTimetableDisplayMode('calendar')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  timetableDisplayMode === 'calendar'
                    ? 'bg-sky-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                カレンダー表示
              </button>
              <button
                type="button"
                onClick={() => setTimetableDisplayMode('table')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  timetableDisplayMode === 'table'
                    ? 'bg-sky-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                テーブル表示
              </button>
            </div>
          </div>

          {/* カレンダー表示 */}
          {timetableDisplayMode === 'calendar' && (
            <div className="bg-slate-900/80 border border-slate-850 rounded-3xl p-5 md:p-6 shadow-xl space-y-4">
              {/* 年月ナビゲーション */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h4 className="text-lg md:text-xl font-black text-white tracking-wide">
                    {currentCalendarDate.getFullYear()}年 {currentCalendarDate.getMonth() + 1}月
                  </h4>
                  <button
                    type="button"
                    onClick={handleCurrentMonth}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all"
                  >
                    今月
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition-all"
                    title="前月"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition-all"
                    title="次月"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* 凡例 */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                <span className="flex items-center gap-1.5 font-bold text-amber-300">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 登校便
                </span>
                <span className="flex items-center gap-1.5 font-bold text-sky-300">
                  <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> 下校1便
                </span>
                <span className="flex items-center gap-1.5 font-bold text-indigo-300">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" /> 下校2便
                </span>
                <span className="flex items-center gap-1.5 font-bold text-purple-300">
                  <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> 下校3便
                </span>
                <span className="text-slate-500">※日付セルをクリックすると編集モーダルが開きます</span>
              </div>

              {/* カレンダーグリッド */}
              <div className="grid grid-cols-7 gap-1 md:gap-2">
                {/* 曜日ヘッダー */}
                {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                  <div
                    key={d}
                    className={`py-2 text-center text-xs font-black tracking-wider uppercase ${
                      i === 0 ? 'text-rose-400' : i === 6 ? 'text-sky-400' : 'text-slate-400'
                    }`}
                  >
                    {d}
                  </div>
                ))}

                {/* 各日付セル */}
                {calendarDays.map((day, idx) => {
                  const data = timetableMap.get(day.dateStr)
                  const hasMorning = !!data?.morning_trip
                  const hasTrip1 = !!data?.afternoon_trip_1
                  const hasTrip2 = !!data?.afternoon_trip_2
                  const hasTrip3 = !!data?.afternoon_trip_3
                  const label = data?.calendar_label || ''
                  const note = data?.note || ''

                  const isSun = day.dayOfWeek === 0
                  const isSat = day.dayOfWeek === 6

                  return (
                    <div
                      key={idx}
                      onClick={() => handleOpenTimetableModal(day.dateStr)}
                      className={`min-h-[100px] md:min-h-[110px] p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group select-none ${
                        !day.isCurrentMonth
                          ? 'bg-slate-950/40 border-slate-900/60 opacity-40 hover:opacity-80'
                          : day.isToday
                          ? 'bg-slate-900/90 border-amber-500/80 shadow-md shadow-amber-500/10 hover:border-amber-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-sky-500/60 hover:bg-slate-900/60'
                      }`}
                    >
                      {/* セル上部：日付番号と行事ラベル */}
                      <div className="flex items-start justify-between gap-1">
                        <span
                          className={`inline-flex items-center justify-center text-xs font-black rounded-lg ${
                            day.isToday
                              ? 'bg-amber-500 text-slate-950 w-6 h-6'
                              : isSun
                              ? 'text-rose-400'
                              : isSat
                              ? 'text-sky-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {day.dayNumber}
                        </span>

                        {label && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold truncate max-w-[70px] md:max-w-[90px] border border-amber-500/30">
                            {label}
                          </span>
                        )}
                      </div>

                      {/* セル中央：運行便情報バッジ */}
                      <div className="space-y-1 my-1">
                        {hasMorning ? (
                          <div className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20 truncate flex items-center justify-between">
                            <span>登校</span>
                            <span>{formatTimeToHHmm(data?.morning_trip)}</span>
                          </div>
                        ) : null}

                        {(hasTrip1 || hasTrip2 || hasTrip3) ? (
                          <div className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/20 truncate flex items-center justify-between">
                            <span>下校</span>
                            <span>
                              {hasTrip1 ? formatTimeToHHmm(data?.afternoon_trip_1) : ''}
                              {hasTrip2 ? ` / ${formatTimeToHHmm(data?.afternoon_trip_2)}` : ''}
                              {hasTrip3 ? ` / ${formatTimeToHHmm(data?.afternoon_trip_3)}` : ''}
                            </span>
                          </div>
                        ) : null}

                        {!hasMorning && !hasTrip1 && !hasTrip2 && !hasTrip3 && (
                          <div className="text-[10px] text-slate-600 italic px-1 text-center py-1">
                            {note ? note : '未設定'}
                          </div>
                        )}
                      </div>

                      {/* セル下部：ホバー時に編集アイコン */}
                      <div className="text-[9px] text-slate-500 flex justify-end items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="flex items-center gap-0.5 text-sky-400 font-bold">
                          <Edit3 className="h-2.5 w-2.5" /> 編集
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* テーブル表示モード */}
          {timetableDisplayMode === 'table' && (
            <div className="bg-slate-900/70 border border-slate-850 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-3 min-w-[110px]">日付 (A列)</th>
                      <th className="py-3 px-3 min-w-[100px]">登校便 (B列)</th>
                      <th className="py-3 px-3 min-w-[100px]">下校1便 (C列)</th>
                      <th className="py-3 px-3 min-w-[100px]">下校2便 (D列)</th>
                      <th className="py-3 px-3 min-w-[100px]">下校3便 (E列)</th>
                      <th className="py-3 px-3 min-w-[140px]">備考 (F列)</th>
                      <th className="py-3 px-3 min-w-[130px]">カレンダー表示 (G列)</th>
                      <th className="py-3 px-3 w-24 text-center">保存状況</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {schoolTimetable.length > 0 ? (
                      schoolTimetable.map((row, idx) => {
                        const date = row.date
                        const draft = timetableDrafts[date] || {}
                        const curMorning = draft.morning_trip !== undefined ? draft.morning_trip : row.morning_trip
                        const curTrip1 = draft.afternoon_trip_1 !== undefined ? draft.afternoon_trip_1 : row.afternoon_trip_1
                        const curTrip2 = draft.afternoon_trip_2 !== undefined ? draft.afternoon_trip_2 : row.afternoon_trip_2
                        const curTrip3 = draft.afternoon_trip_3 !== undefined ? draft.afternoon_trip_3 : row.afternoon_trip_3
                        const curNote = draft.note !== undefined ? draft.note : row.note
                        const curLabel = draft.calendar_label !== undefined ? draft.calendar_label : row.calendar_label

                        const isSaving = savingTimetableDate === date
                        const isSaved = savedTimetableDate === date

                        return (
                          <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-3 font-mono font-bold text-amber-300">
                              {date}
                            </td>
                            {/* 登校便 */}
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                value={curMorning}
                                onChange={(e) => handleTimetableDraftChange(date, 'morning_trip', e.target.value)}
                                onBlur={(e) => handleSaveTimetable(date, 'morning_trip', e.target.value)}
                                placeholder="例: 08:00"
                                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white text-xs font-mono focus:outline-none focus:border-amber-400 w-full"
                              />
                            </td>
                            {/* 下校1便 */}
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                value={curTrip1}
                                onChange={(e) => handleTimetableDraftChange(date, 'afternoon_trip_1', e.target.value)}
                                onBlur={(e) => handleSaveTimetable(date, 'afternoon_trip_1', e.target.value)}
                                placeholder="例: 15:00"
                                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-sky-300 text-xs font-mono focus:outline-none focus:border-amber-400 w-full"
                              />
                            </td>
                            {/* 下校2便 */}
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                value={curTrip2}
                                onChange={(e) => handleTimetableDraftChange(date, 'afternoon_trip_2', e.target.value)}
                                onBlur={(e) => handleSaveTimetable(date, 'afternoon_trip_2', e.target.value)}
                                placeholder="例: 16:00"
                                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-indigo-300 text-xs font-mono focus:outline-none focus:border-amber-400 w-full"
                              />
                            </td>
                            {/* 下校3便 */}
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                value={curTrip3}
                                onChange={(e) => handleTimetableDraftChange(date, 'afternoon_trip_3', e.target.value)}
                                onBlur={(e) => handleSaveTimetable(date, 'afternoon_trip_3', e.target.value)}
                                placeholder="例: 17:00"
                                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-purple-300 text-xs font-mono focus:outline-none focus:border-amber-400 w-full"
                              />
                            </td>
                            {/* 備考 */}
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                value={curNote}
                                onChange={(e) => handleTimetableDraftChange(date, 'note', e.target.value)}
                                onBlur={(e) => handleSaveTimetable(date, 'note', e.target.value)}
                                placeholder="備考入力"
                                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 text-xs focus:outline-none focus:border-amber-400 w-full"
                              />
                            </td>
                            {/* カレンダー表示用 */}
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                value={curLabel}
                                onChange={(e) => handleTimetableDraftChange(date, 'calendar_label', e.target.value)}
                                onBlur={(e) => handleSaveTimetable(date, 'calendar_label', e.target.value)}
                                placeholder="行事名など"
                                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-emerald-300 text-xs focus:outline-none focus:border-amber-400 w-full"
                              />
                            </td>
                            {/* 保存状況 */}
                            <td className="py-3 px-3 text-center">
                              {isSaving ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
                                  <RefreshCw className="h-3 w-3 animate-spin" /> 保存中
                                </span>
                              ) : isSaved ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                                  <Check className="h-3 w-3" /> 保存済
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-600 font-mono">自動同期</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500">
                          学校用時刻表データがありません
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* タブ 5: バス停マスタ（追加・名称変更・HH:mm形式入力） */}
      {/* ========================================================= */}
      {activeTab === 'stops' && (
        <div className="bg-slate-900/70 border border-slate-850 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <MapPin className="h-5 w-5 text-emerald-400" />
                バス停マスタ（停車順序・到着時刻・名称管理）
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                バス停の名称変更、停車順序、登校便の到着時刻（HH:mm）を編集してスプレッドシートへ直接保存できます。
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setNewBusStop({
                  name: '',
                  arrival_time_morning: '07:30',
                  address: '',
                  order: busStops.length + 1
                })
                setIsAddBusStopModalOpen(true)
              }}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              新規バス停を追加
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3 w-20 text-center">順序 (D列)</th>
                  <th className="py-3 px-3 min-w-[180px]">バス停名 (A列)</th>
                  <th className="py-3 px-3 min-w-[140px]">到着予定時刻 (C列)</th>
                  <th className="py-3 px-3 min-w-[220px]">住所 (B列)</th>
                  <th className="py-3 px-3 w-36 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {busStops.length > 0 ? (
                  busStops.map((stop, idx) => {
                    const originalName = stop.name
                    const draft = busStopDrafts[originalName] || {}
                    const curName = draft.name !== undefined ? draft.name : stop.name
                    const curTime = draft.arrival_time_morning !== undefined ? draft.arrival_time_morning : formatTimeToHHmm(stop.arrival_time_morning)
                    const curAddress = draft.address !== undefined ? draft.address : (stop.address || '')
                    const curOrder = draft.order !== undefined ? draft.order : (stop.order || idx + 1)

                    const isSaving = savingBusStopName === originalName
                    const isSaved = savedBusStopName === originalName

                    return (
                      <tr key={originalName} className="hover:bg-slate-800/40 transition-colors">
                        {/* 停車順序 */}
                        <td className="py-3 px-3 text-center">
                          <input
                            type="number"
                            value={curOrder}
                            onChange={(e) => handleBusStopDraftChange(originalName, 'order', Number(e.target.value))}
                            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-amber-400 font-mono font-bold text-xs text-center w-16 focus:outline-none focus:border-emerald-400"
                          />
                        </td>
                        {/* バス停名（名称変更可能） */}
                        <td className="py-3 px-3">
                          <input
                            type="text"
                            value={curName}
                            onChange={(e) => handleBusStopDraftChange(originalName, 'name', e.target.value)}
                            placeholder="バス停名"
                            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-bold text-xs focus:outline-none focus:border-emerald-400 w-full"
                          />
                        </td>
                        {/* 到着予定時刻（HH:mm形式統一） */}
                        <td className="py-3 px-3">
                          <input
                            type="time"
                            value={curTime}
                            onChange={(e) => handleBusStopDraftChange(originalName, 'arrival_time_morning', e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-emerald-300 font-mono font-bold text-xs focus:outline-none focus:border-emerald-400 w-full cursor-pointer"
                          />
                        </td>
                        {/* 住所 */}
                        <td className="py-3 px-3">
                          <input
                            type="text"
                            value={curAddress}
                            onChange={(e) => handleBusStopDraftChange(originalName, 'address', e.target.value)}
                            placeholder="住所・ランドマーク"
                            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-emerald-400 w-full"
                          />
                        </td>
                        {/* 操作ボタン */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSaveBusStopInline(originalName)}
                              disabled={isSaving}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                                isSaved
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black'
                              }`}
                            >
                              {isSaving ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : isSaved ? (
                                <>
                                  <Check className="h-3.5 w-3.5" /> 保存済
                                </>
                              ) : (
                                '保存'
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBusStopClick(originalName)}
                              disabled={isSaving}
                              className="p-1.5 bg-slate-950 hover:bg-rose-500/20 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 rounded-lg transition-all"
                              title="バス停を削除"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      バス停データがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 時刻表・特別運行日 編集モーダル */}
      {/* ========================================================= */}
      {isTimetableModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Clock className="h-5 w-5 text-sky-400" />
                  運行時刻・行事設定
                </h3>
                <p className="text-xs text-amber-300 font-mono font-bold mt-0.5">
                  対象日: {selectedTimetableDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTimetableModalOpen(false)}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* クイックプリセット */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                クイック設定プリセット
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyPreset('normal')}
                  className="px-2 py-1.5 bg-slate-950 hover:bg-sky-500/20 border border-slate-800 hover:border-sky-500/40 rounded-xl text-xs font-bold text-sky-300 transition-all text-center"
                >
                  通常運行
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('morning_only')}
                  className="px-2 py-1.5 bg-slate-950 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-500/40 rounded-xl text-xs font-bold text-amber-300 transition-all text-center"
                >
                  午前のみ運行
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('holiday')}
                  className="px-2 py-1.5 bg-slate-950 hover:bg-rose-500/20 border border-slate-800 hover:border-rose-500/40 rounded-xl text-xs font-bold text-rose-300 transition-all text-center"
                >
                  全便運休
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('clear')}
                  className="px-2 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 rounded-xl text-xs font-bold transition-all text-center"
                >
                  クリア
                </button>
              </div>
            </div>

            {/* 入力フォーム */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 登校便 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-amber-300 flex items-center gap-1">
                    登校便 出発時刻
                  </label>
                  <input
                    type="time"
                    value={timetableModalDraft.morning_trip}
                    onChange={(e) => setTimetableModalDraft(prev => ({ ...prev, morning_trip: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* 下校1便 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-sky-300 flex items-center gap-1">
                    下校 1便 時刻
                  </label>
                  <input
                    type="time"
                    value={timetableModalDraft.afternoon_trip_1}
                    onChange={(e) => setTimetableModalDraft(prev => ({ ...prev, afternoon_trip_1: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sky-400"
                  />
                </div>

                {/* 下校2便 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-indigo-300 flex items-center gap-1">
                    下校 2便 時刻
                  </label>
                  <input
                    type="time"
                    value={timetableModalDraft.afternoon_trip_2}
                    onChange={(e) => setTimetableModalDraft(prev => ({ ...prev, afternoon_trip_2: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-indigo-400"
                  />
                </div>

                {/* 下校3便 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-purple-300 flex items-center gap-1">
                    下校 3便 時刻
                  </label>
                  <input
                    type="time"
                    value={timetableModalDraft.afternoon_trip_3}
                    onChange={(e) => setTimetableModalDraft(prev => ({ ...prev, afternoon_trip_3: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              {/* カレンダー表示ラベル */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  カレンダー表示用ラベル（行事名・短縮名）
                </label>
                <input
                  type="text"
                  value={timetableModalDraft.calendar_label}
                  onChange={(e) => setTimetableModalDraft(prev => ({ ...prev, calendar_label: e.target.value }))}
                  placeholder="例: 午前授業、校外学習、創立記念日"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-emerald-300 text-xs focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* 備考 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  備考・メモ (F列)
                </label>
                <input
                  type="text"
                  value={timetableModalDraft.note}
                  onChange={(e) => setTimetableModalDraft(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="例: 下校バスは15:00発のみ運行します"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* フッター */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsTimetableModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSaveTimetableModal}
                disabled={isSavingTimetableModal}
                className={`px-5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  savedTimetableModal
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-lg shadow-sky-500/20'
                }`}
              >
                {isSavingTimetableModal ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> 保存中...
                  </>
                ) : savedTimetableModal ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> 保存完了！
                  </>
                ) : (
                  'スプレッドシートに保存'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 新規バス停追加モーダル */}
      {/* ========================================================= */}
      {isAddBusStopModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <MapPin className="h-5 w-5 text-emerald-400" />
                新規バス停を追加
              </h3>
              <button
                type="button"
                onClick={() => setIsAddBusStopModalOpen(false)}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBusStop} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  バス停名 (A列) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newBusStop.name}
                  onChange={(e) => setNewBusStop(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例: 中央公園前"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-emerald-300">
                    到着予定時刻 (HH:mm)
                  </label>
                  <input
                    type="time"
                    value={newBusStop.arrival_time_morning}
                    onChange={(e) => setNewBusStop(prev => ({ ...prev, arrival_time_morning: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-emerald-300 font-mono text-xs focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-amber-300">
                    停車順序 (番号)
                  </label>
                  <input
                    type="number"
                    value={newBusStop.order}
                    onChange={(e) => setNewBusStop(prev => ({ ...prev, order: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-amber-300 font-mono text-xs focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  住所・目印 (B列)
                </label>
                <input
                  type="text"
                  value={newBusStop.address}
                  onChange={(e) => setNewBusStop(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="例: ○○町1-2-3 公園北口側"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddBusStopModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isAddingBusStop}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                >
                  {isAddingBusStop ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> 追加中...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" /> スプレッドシートに追加
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
