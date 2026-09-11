import React, { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { 
  Bus, Calendar, FileSpreadsheet, Users, MapPin, Clock,
  RefreshCw, LogOut, Check, 
  Sun, Snowflake, Palmtree, Ban, Filter,
  ChevronLeft, ChevronRight, Plus, Trash2, Edit3, X, Sparkles, CheckCircle2, Layers,
  Copy, UserPlus, CalendarCheck, Lock
} from 'lucide-react'
import type { BasicSettingRow, GuardianMasterRow, SchoolTimetableRow, BusStopRow, ScheduleCalendarRow } from '../types/spreadsheet'
import { toSlashDate, toHyphenDate, formatTimeToHHmm, formatTimeOnly, isMonthPublished } from '../lib/spreadsheetApi'
import { getJapaneseHolidayName } from '../lib/japaneseHolidays'
import { RoleSwitcher } from '../components/RoleSwitcher'

export const AdminDashboard: React.FC = () => {
  const { 
    user, logout, basicSettings, schedules, 
    guardianMaster, busStops, schoolTimetable, publishedMonths,
    saveBasicSetting, saveMonthPublishStatus, saveGuardianMaster, saveSchoolTimetable, saveBatchSchoolTimetable,
    saveBusStop, deleteBusStop, registerNewStudentWithCode,
    deleteGuardianMaster,
    syncing, refreshAll 
  } = useApp()

  const [activeTab, setActiveTab] = useState<'schedules' | 'timetable' | 'guardians' | 'stops' | 'basicSettings'>('schedules')

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
  // 便別絞り込みフィルター（集計カードクリック連動）
  const [selectedTripFilter, setSelectedTripFilter] = useState<'all' | 'morning' | 'trip1' | 'trip2' | 'trip3' | 'notRiding'>('all')

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

  // 日付で絞り込まれた運行予定（集計カードの計算母体）
  const dateFilteredSchedules = useMemo(() => {
    if (isAllDates) return schedules
    const target = selectedDate.replace(/-/g, '/')
    return schedules.filter(s => s.date.replace(/-/g, '/') === target)
  }, [schedules, isAllDates, selectedDate])

  // リアルタイム集計（日付内の各便人数）
  const summaryCounts = useMemo(() => {
    let morningCount = 0
    let trip1Count = 0
    let trip2Count = 0
    let trip3Count = 0
    let notRidingCount = 0

    dateFilteredSchedules.forEach(row => {
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
      totalReservations: dateFilteredSchedules.length
    }
  }, [dateFilteredSchedules])

  // 便別フィルターで絞り込まれた一覧表示用データ
  const filteredSchedules = useMemo(() => {
    if (selectedTripFilter === 'all') return dateFilteredSchedules
    if (selectedTripFilter === 'morning') {
      return dateFilteredSchedules.filter(s => s.morning_status === '乗る')
    }
    if (selectedTripFilter === 'trip1') {
      return dateFilteredSchedules.filter(s => s.afternoon_status !== '乗らない' && !!s.afternoon_trip_1)
    }
    if (selectedTripFilter === 'trip2') {
      return dateFilteredSchedules.filter(s => s.afternoon_status !== '乗らない' && !!s.afternoon_trip_2)
    }
    if (selectedTripFilter === 'trip3') {
      return dateFilteredSchedules.filter(s => s.afternoon_status !== '乗らない' && !!s.afternoon_trip_3)
    }
    if (selectedTripFilter === 'notRiding') {
      return dateFilteredSchedules.filter(s => s.afternoon_status === '乗らない')
    }
    return dateFilteredSchedules
  }, [dateFilteredSchedules, selectedTripFilter])

  // 日付 -> 時刻表データのマップ
  const timetableMap = useMemo(() => {
    const map = new Map<string, SchoolTimetableRow>()
    schoolTimetable.forEach(t => {
      const norm = t.date.replace(/-/g, '/')
      map.set(norm, t)
    })
    return map
  }, [schoolTimetable])

  // 下校便表記整形ユーティリティ（「下校1便(16:00)」「下校2便(17:00)」「乗らない」の形式に厳格統一）
  const formatAfternoonTrip = (row: ScheduleCalendarRow): string => {
    if (row.afternoon_status === '乗らない') return '乗らない'

    const extractCleanTime = (raw?: string, fallbackRaw?: string): string => {
      if (raw) {
        const match = raw.match(/(\d{1,2}:\d{2})/)
        if (match) return match[1]
      }
      if (fallbackRaw) {
        const match = fallbackRaw.match(/(\d{1,2}:\d{2})/)
        if (match) return match[1]
      }
      return ''
    }

    const tt = timetableMap.get(row.date.replace(/-/g, '/'))

    if (row.afternoon_trip_1) {
      const t = extractCleanTime(row.afternoon_trip_1, tt?.afternoon_trip_1)
      return t ? `下校1便(${t})` : '下校1便'
    }
    if (row.afternoon_trip_2) {
      const t = extractCleanTime(row.afternoon_trip_2, tt?.afternoon_trip_2)
      return t ? `下校2便(${t})` : '下校2便'
    }
    if (row.afternoon_trip_3) {
      const t = extractCleanTime(row.afternoon_trip_3, tt?.afternoon_trip_3)
      return t ? `下校3便(${t})` : '下校3便'
    }
    return '未指定'
  }

  // 更新日時表記整形ユーティリティ（YYYY/MM/DD の日付のみ抽出、時刻非表示）
  const formatUpdatedAt = (val?: string): string => {
    if (!val) return '-'
    const match = val.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
    if (match) {
      return `${match[1]}/${match[2].padStart(2, '0')}/${match[3].padStart(2, '0')}`
    }
    return val.split(' ')[0] || val
  }

  // バス停ごとのグループ化まとめ表示用データ（バス停マスタの停車順序 order 昇順で完全ソート）
  const groupedFilteredSchedules = useMemo(() => {
    // 1. バス停マスタのソート（order昇順、次点に到着時刻順）
    const sortedStops = [...busStops].sort((a, b) => {
      const orderA = Number(a.order) || 9999
      const orderB = Number(b.order) || 9999
      if (orderA !== orderB) return orderA - orderB
      return (a.arrival_time_morning || '').localeCompare(b.arrival_time_morning || '')
    })

    // 2. 各バス停に属する生徒予約の振り分け
    const stopMap = new Map<string, ScheduleCalendarRow[]>()
    sortedStops.forEach(stop => {
      stopMap.set(stop.name, [])
    })

    const otherSchedules: ScheduleCalendarRow[] = []

    filteredSchedules.forEach(row => {
      const stopName = studentBusStopMap.get(row.student_name)
      if (stopName && stopMap.has(stopName)) {
        stopMap.get(stopName)!.push(row)
      } else {
        otherSchedules.push(row)
      }
    })

    const groups: Array<{
      busStopName: string
      order: number
      arrivalTime?: string
      schedules: ScheduleCalendarRow[]
    }> = []

    sortedStops.forEach(stop => {
      const list = stopMap.get(stop.name) || []
      if (list.length > 0) {
        groups.push({
          busStopName: stop.name,
          order: Number(stop.order) || 0,
          arrivalTime: stop.arrival_time_morning,
          schedules: list
        })
      }
    })

    if (otherSchedules.length > 0) {
      groups.push({
        busStopName: 'その他・バス停未設定',
        order: 9999,
        arrivalTime: '',
        schedules: otherSchedules
      })
    }

    return groups
  }, [busStops, filteredSchedules, studentBusStopMap])

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

  // 新入生・新規生徒の事前登録モーダル状態
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false)
  const [newStudentDraft, setNewStudentDraft] = useState({
    name: '',
    bus_stop_name: '',
    note: ''
  })
  const [isRegisteringStudent, setIsRegisteringStudent] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [successToast, setSuccessToast] = useState<{ message: string; title?: string; code?: string } | null>(null)

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  // 生徒・保護者マスターの行削除処理
  const [deletingGuardianKey, setDeletingGuardianKey] = useState<string | null>(null)
  const handleDeleteGuardianRow = async (g: GuardianMasterRow, idx: number) => {
    const studentNames = g.student_names.join('・')
    const displayName = studentNames 
      ? `${studentNames}さん` 
      : (g.parent_email || (g.auth_code ? `コード: ${g.auth_code}` : `行 #${idx + 1}`))

    if (!window.confirm(`「${displayName}」のデータを削除してもよろしいですか？\n※スプレッドシート上の該当行が削除されます。`)) {
      return
    }

    const rowKey = g.parent_email || g.auth_code || String(idx)
    setDeletingGuardianKey(rowKey)
    try {
      const res = await deleteGuardianMaster({
        parent_email: g.parent_email,
        auth_code: g.auth_code,
        student_name: g.student_names[0]
      })

      const isSuccess = res.success || res.status === 'success'
      if (isSuccess) {
        setSuccessToast({
          message: `「${displayName}」のデータを削除しました`
        })
        setTimeout(() => {
          setSuccessToast(null)
        }, 5000)
      } else {
        alert(`削除に失敗しました: ${res.message || 'エラーが発生しました'}`)
      }
    } finally {
      setDeletingGuardianKey(null)
    }
  }

  const handleRegisterNewStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newStudentDraft.name.trim()) {
      alert('生徒名を入力してください')
      return
    }
    setIsRegisteringStudent(true)
    try {
      const res: any = await registerNewStudentWithCode({
        student_name: newStudentDraft.name.trim(),
        bus_stop_name: newStudentDraft.bus_stop_name || (busStops[0]?.name || '高山研修所前'),
        note: newStudentDraft.note.trim()
      })

      // GASからの返り値（status === 'success' または success === true）を確実に判定
      const isSuccess = res.status === 'success' || res.success === true || (res.data && (res.data.status === 'success' || res.data.success === true))
      const code = res.code || res.auth_code || res.data?.code || res.data?.auth_code || ''

      if (isSuccess) {
        // 1. 登録ウィンドウ（モーダル）を自動的に閉じる
        setIsAddStudentModalOpen(false)

        // 2. フォームの入力値をリセット
        setNewStudentDraft({
          name: '',
          bus_stop_name: busStops[0]?.name || '',
          note: ''
        })

        // 3. 成功トーストを表示（「登録を失敗しました」の誤表示を完全排除）
        const toastMsg = code
          ? `新入生を登録し、認証コードを発行しました（コード: ${code}）`
          : '新入生を登録し、認証コードを発行しました'
        setSuccessToast({
          message: toastMsg,
          code: code
        })

        // 6秒後に自動非表示
        setTimeout(() => {
          setSuccessToast(null)
        }, 6000)
      } else {
        alert(`登録に失敗しました: ${res.message || 'エラーが発生しました'}`)
      }
    } finally {
      setIsRegisteringStudent(false)
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

  // 表示中の年月文字列 (YYYY/MM)
  const currentYearMonth = useMemo(() => {
    const y = currentCalendarDate.getFullYear()
    const m = String(currentCalendarDate.getMonth() + 1).padStart(2, '0')
    return `${y}/${m}`
  }, [currentCalendarDate])

  // 表示中年月の確定・公開ステータス（publishedMonthsガードとbasicSettingsフォールバック両対応）
  const isCurrentMonthPublished = useMemo(() => {
    return publishedMonths.includes(currentYearMonth) || isMonthPublished(currentYearMonth, basicSettings)
  }, [currentYearMonth, publishedMonths, basicSettings])

  const [isTogglingPublish, setIsTogglingPublish] = useState(false)

  // 確定・公開ステータスの切り替え
  const handleToggleMonthPublish = async () => {
    const nextPublished = !isCurrentMonthPublished
    const confirmMsg = nextPublished
      ? `【${currentYearMonth}】の時刻表を「確定・公開」しますか？\n\n確定すると保護者画面で予約受付が開始され、通知バナーが表示されます。`
      : `【${currentYearMonth}】の時刻表を「未確定」に戻しますか？\n\n未確定に戻すと保護者画面の予約入力・変更がロック（非活性化）されます。`
    
    if (!window.confirm(confirmMsg)) return

    setIsTogglingPublish(true)
    try {
      const res = await saveMonthPublishStatus({
        yearMonth: currentYearMonth,
        isPublished: nextPublished
      })
      if (res.success) {
        setSuccessToast({
          title: '時刻表公開ステータス更新',
          message: res.message || `${currentYearMonth} のステータスを更新しました`
        })
      } else {
        alert(`ステータス更新に失敗しました: ${res.message}`)
      }
    } catch (err: any) {
      alert(`エラーが発生しました: ${err.message}`)
    } finally {
      setIsTogglingPublish(false)
    }
  }

  // ==========================================
  // 学校用時刻表 1か月分一括設定用状態
  // ==========================================
  const [isBatchTimetableModalOpen, setIsBatchTimetableModalOpen] = useState(false)
  const [batchYear, setBatchYear] = useState<number>(() => currentCalendarDate.getFullYear())
  const [batchMonth, setBatchMonth] = useState<number>(() => currentCalendarDate.getMonth() + 1)

  // モーダルを開いた時に現在表示中の年月を初期値にセットする
  const handleOpenBatchModal = () => {
    setBatchYear(currentCalendarDate.getFullYear())
    setBatchMonth(currentCalendarDate.getMonth() + 1)
    setIsBatchTimetableModalOpen(true)
  }

  // 基本パターン（通常日・6時間授業）
  const [basePattern, setBasePattern] = useState({
    morning_trip: '07:30',
    afternoon_trip_1: '16:00',
    afternoon_trip_2: '17:00',
    afternoon_trip_3: '18:00',
    note: '通常運行',
  })

  // 特定曜日の特別パターン（水曜日など5時間授業の日）
  const [hasSpecialPattern, setHasSpecialPattern] = useState(true)
  const [specialDays, setSpecialDays] = useState<number[]>([3]) // 3: 水曜日 (1:月, 2:火, 3:水, 4:木, 5:金)
  const [specialPattern, setSpecialPattern] = useState({
    morning_trip: '07:30',
    afternoon_trip_1: '15:00',
    afternoon_trip_2: '16:00',
    afternoon_trip_3: '',
    note: '5時間授業',
  })

  const [isSavingBatchTimetable, setIsSavingBatchTimetable] = useState(false)

  // 曜日選択の切り替え
  const handleToggleSpecialDay = (dayVal: number) => {
    setSpecialDays(prev => 
      prev.includes(dayVal) 
        ? prev.filter(d => d !== dayVal)
        : [...prev, dayVal].sort((a, b) => a - b)
    )
  }

  // 一括生成対象日のプレビュー計算
  const batchPreviewSummary = useMemo(() => {
    const daysInMonth = new Date(batchYear, batchMonth, 0).getDate()
    let totalWeekdays = 0
    let specialCount = 0
    let baseCount = 0
    let skipHolidayCount = 0
    let skipWeekendCount = 0

    const previewList: {
      dateStr: string
      dayOfWeek: number
      dayNumber: number
      holidayName?: string
      type: 'special' | 'base' | 'weekend' | 'holiday'
    }[] = []

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(batchYear, batchMonth - 1, d)
      const dow = dateObj.getDay()
      const padM = String(batchMonth).padStart(2, '0')
      const padD = String(d).padStart(2, '0')
      const dateStr = `${batchYear}/${padM}/${padD}`
      const hol = getJapaneseHolidayName(dateStr)

      if (dow === 0 || dow === 6) {
        skipWeekendCount++
        previewList.push({ dateStr, dayOfWeek: dow, dayNumber: d, type: 'weekend' })
      } else if (hol) {
        skipHolidayCount++
        previewList.push({ dateStr, dayOfWeek: dow, dayNumber: d, holidayName: hol, type: 'holiday' })
      } else {
        totalWeekdays++
        if (hasSpecialPattern && specialDays.includes(dow)) {
          specialCount++
          previewList.push({ dateStr, dayOfWeek: dow, dayNumber: d, type: 'special' })
        } else {
          baseCount++
          previewList.push({ dateStr, dayOfWeek: dow, dayNumber: d, type: 'base' })
        }
      }
    }

    return {
      totalDays: daysInMonth,
      totalWeekdays,
      specialCount,
      baseCount,
      skipHolidayCount,
      skipWeekendCount,
      previewList
    }
  }, [batchYear, batchMonth, hasSpecialPattern, specialDays])

  // 一括設定の実行・保存
  const handleExecuteBatchTimetable = async () => {
    if (batchPreviewSummary.totalWeekdays === 0) {
      alert('生成対象となる平日がありません。')
      return
    }

    setIsSavingBatchTimetable(true)
    try {
      const rowsToSave: Parameters<typeof saveBatchSchoolTimetable>[0] = []

      batchPreviewSummary.previewList.forEach(item => {
        if (item.type === 'special') {
          rowsToSave.push({
            date: item.dateStr,
            morning_trip: formatTimeToHHmm(specialPattern.morning_trip),
            afternoon_trip_1: formatTimeToHHmm(specialPattern.afternoon_trip_1),
            afternoon_trip_2: formatTimeToHHmm(specialPattern.afternoon_trip_2),
            afternoon_trip_3: formatTimeToHHmm(specialPattern.afternoon_trip_3),
            note: specialPattern.note,
            calendar_label: specialPattern.note || '5時間授業'
          })
        } else if (item.type === 'base') {
          rowsToSave.push({
            date: item.dateStr,
            morning_trip: formatTimeToHHmm(basePattern.morning_trip),
            afternoon_trip_1: formatTimeToHHmm(basePattern.afternoon_trip_1),
            afternoon_trip_2: formatTimeToHHmm(basePattern.afternoon_trip_2),
            afternoon_trip_3: formatTimeToHHmm(basePattern.afternoon_trip_3),
            note: basePattern.note,
            calendar_label: basePattern.note || '通常運行'
          })
        }
      })

      const res = await saveBatchSchoolTimetable(rowsToSave)
      if (res.success) {
        setIsBatchTimetableModalOpen(false)
        setSuccessToast({
          title: '学校用時刻表 一括反映完了',
          message: `${rowsToSave.length}日分の時刻表を一括反映しました（${batchYear}年${batchMonth}月）`
        })
        setCurrentCalendarDate(new Date(batchYear, batchMonth - 1, 1))
      } else {
        alert(`一括保存に失敗しました: ${res.message}`)
      }
    } catch (err: any) {
      alert(`エラーが発生しました: ${err.message}`)
    } finally {
      setIsSavingBatchTimetable(false)
    }
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 space-y-6 max-w-7xl mx-auto relative">
      {/* 成功トースト通知（画面上部固定・コードコピー機能付き） */}
      {successToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-xl w-[92%] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-4 bg-slate-900 border-2 border-emerald-500/80 rounded-2xl shadow-2xl shadow-black/80 flex items-center justify-between gap-3 text-white">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-emerald-300">{successToast.title || '新入生登録完了'}</div>
                <div className="text-xs text-slate-200 font-bold truncate sm:whitespace-normal">
                  {successToast.message}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {successToast.code && (
                <button
                  type="button"
                  onClick={() => handleCopyCode(successToast.code!)}
                  className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-amber-500/30 transition-all cursor-pointer"
                >
                  {copiedCode === successToast.code ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      コピー済
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      コードコピー
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSuccessToast(null)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

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
          <RoleSwitcher />
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
          onClick={() => setActiveTab('schedules')}
          className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'schedules'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/15'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Calendar className="h-4 w-4" />
          運行予定カレンダー一覧
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
          学校用時刻表マスタ
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
          生徒・保護者マスター
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
          バス停マスタ
        </button>
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
          基本設定・運休期間マスタ
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
                onClick={() => {
                  setIsAllDates(true)
                  setSelectedTripFilter('all')
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isAllDates && selectedTripFilter === 'all'
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

          {/* 運行便ごとのリアルタイム集計カード（クリックで名簿絞り込み連動） */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">
                  {isAllDates ? '【全期間集計】' : `【${selectedDate} 集計】`}
                </span>
                {selectedTripFilter !== 'all' && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold animate-in fade-in duration-150">
                    <span>
                      絞込中: {
                        selectedTripFilter === 'morning' ? '🌅 登校便' :
                        selectedTripFilter === 'trip1' ? '🚌 下校1便' :
                        selectedTripFilter === 'trip2' ? '🚍 下校2便' :
                        selectedTripFilter === 'trip3' ? '🌙 下校3便' : '🚫 下校乗らない'
                      }（{filteredSchedules.length}名）
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedTripFilter('all')}
                      className="hover:text-white p-0.5"
                      title="フィルター解除"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {selectedTripFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedTripFilter('all')}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-bold underline transition-colors"
                  >
                    全生徒表示に戻す
                  </button>
                )}
                <span className="text-xs font-mono text-slate-500">
                  対象予約: {filteredSchedules.length} / {summaryCounts.totalReservations}件
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {/* 登校便 */}
              <button
                type="button"
                onClick={() => setSelectedTripFilter(prev => prev === 'morning' ? 'all' : 'morning')}
                className={`text-left rounded-2xl p-3.5 flex flex-col justify-between transition-all cursor-pointer shadow-sm relative group ${
                  selectedTripFilter === 'morning'
                    ? 'bg-amber-500/20 border-2 border-amber-400 ring-2 ring-amber-400/30 shadow-amber-500/10'
                    : 'bg-slate-950/80 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                    🌅 登校便
                  </span>
                  {selectedTripFilter === 'morning' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-black">
                      選択中
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">{summaryCounts.morningCount}</span>
                  <span className="text-xs text-slate-400">名</span>
                </div>
              </button>

              {/* 下校1便 */}
              <button
                type="button"
                onClick={() => setSelectedTripFilter(prev => prev === 'trip1' ? 'all' : 'trip1')}
                className={`text-left rounded-2xl p-3.5 flex flex-col justify-between transition-all cursor-pointer shadow-sm relative group ${
                  selectedTripFilter === 'trip1'
                    ? 'bg-sky-500/20 border-2 border-sky-400 ring-2 ring-sky-400/30 shadow-sky-500/10'
                    : 'bg-slate-950/80 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-bold text-sky-400 flex items-center gap-1">
                    🚌 下校1便
                  </span>
                  {selectedTripFilter === 'trip1' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-400 text-slate-950 font-black">
                      選択中
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">{summaryCounts.trip1Count}</span>
                  <span className="text-xs text-slate-400">名</span>
                </div>
              </button>

              {/* 下校2便 */}
              <button
                type="button"
                onClick={() => setSelectedTripFilter(prev => prev === 'trip2' ? 'all' : 'trip2')}
                className={`text-left rounded-2xl p-3.5 flex flex-col justify-between transition-all cursor-pointer shadow-sm relative group ${
                  selectedTripFilter === 'trip2'
                    ? 'bg-indigo-500/20 border-2 border-indigo-400 ring-2 ring-indigo-400/30 shadow-indigo-500/10'
                    : 'bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-bold text-indigo-400 flex items-center gap-1">
                    🚍 下校2便
                  </span>
                  {selectedTripFilter === 'trip2' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-400 text-slate-950 font-black">
                      選択中
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">{summaryCounts.trip2Count}</span>
                  <span className="text-xs text-slate-400">名</span>
                </div>
              </button>

              {/* 下校3便 */}
              <button
                type="button"
                onClick={() => setSelectedTripFilter(prev => prev === 'trip3' ? 'all' : 'trip3')}
                className={`text-left rounded-2xl p-3.5 flex flex-col justify-between transition-all cursor-pointer shadow-sm relative group ${
                  selectedTripFilter === 'trip3'
                    ? 'bg-purple-500/20 border-2 border-purple-400 ring-2 ring-purple-400/30 shadow-purple-500/10'
                    : 'bg-slate-950/80 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-bold text-purple-400 flex items-center gap-1">
                    🌙 下校3便
                  </span>
                  {selectedTripFilter === 'trip3' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-400 text-slate-950 font-black">
                      選択中
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">{summaryCounts.trip3Count}</span>
                  <span className="text-xs text-slate-400">名</span>
                </div>
              </button>

              {/* 下校乗らない */}
              <button
                type="button"
                onClick={() => setSelectedTripFilter(prev => prev === 'notRiding' ? 'all' : 'notRiding')}
                className={`text-left rounded-2xl p-3.5 flex flex-col justify-between transition-all cursor-pointer shadow-sm col-span-2 sm:col-span-1 relative group ${
                  selectedTripFilter === 'notRiding'
                    ? 'bg-rose-500/20 border-2 border-rose-400 ring-2 ring-rose-400/30 shadow-rose-500/10'
                    : 'bg-slate-950/80 border border-slate-800 hover:border-rose-500/50 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                    🚫 下校乗らない
                  </span>
                  {selectedTripFilter === 'notRiding' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-400 text-slate-950 font-black">
                      選択中
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">{summaryCounts.notRidingCount}</span>
                  <span className="text-xs text-slate-400">名</span>
                </div>
              </button>
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
                  <th className="py-3 px-3 font-mono text-[10px]">更新日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {groupedFilteredSchedules.length > 0 ? (
                  groupedFilteredSchedules.map((group) => {
                    return (
                      <React.Fragment key={group.busStopName}>
                        {/* バス停グループ見出しヘッダー（バス停マスタ停車順序でソート） */}
                        <tr className="bg-slate-800/90 border-y-2 border-amber-500/30">
                          <td colSpan={8} className="py-2.5 px-4 font-black text-amber-300">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-2 text-xs sm:text-sm">
                                <span className="text-base">🚏</span>
                                <span className="tracking-wide">{group.busStopName}</span>
                                {group.arrivalTime && (
                                  <span className="text-[11px] font-normal text-slate-400">
                                    （予定 {formatTimeToHHmm(group.arrivalTime)}発）
                                  </span>
                                )}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold">
                                {group.schedules.length}名
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* 当該バス停に所属する生徒行 */}
                        {group.schedules.map((row, idx) => {
                          const tripDisplay = formatAfternoonTrip(row)
                          const updatedDateDisplay = formatUpdatedAt(row.updated_at)

                          return (
                            <tr key={`${group.busStopName}-${row.id || row.student_name}-${idx}`} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-3 px-3 font-mono text-slate-400">{row.date}</td>
                              <td className="py-3 px-3 font-bold text-white text-sm">{row.student_name}</td>
                              <td className="py-3 px-3 text-amber-300 font-bold">{group.busStopName}</td>
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
                                  tripDisplay === '乗らない'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    : tripDisplay.startsWith('下校1便')
                                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                    : tripDisplay.startsWith('下校2便')
                                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                    : tripDisplay.startsWith('下校3便')
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    : 'text-slate-500 bg-slate-950'
                                }`}>
                                  {tripDisplay}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">{row.parent_email}</td>
                              <td className="py-3 px-3 text-slate-300">{row.note || '-'}</td>
                              <td className="py-3 px-3 font-mono text-[10px] text-slate-400">{updatedDateDisplay}</td>
                            </tr>
                          )
                        })}
                      </React.Fragment>
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
      {/* タブ 3: 生徒・保護者マスター（インライン編集＆認証コード管理） */}
      {/* ========================================================= */}
      {activeTab === 'guardians' && (
        <div className="bg-slate-900/70 border border-slate-850 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-400" />
                生徒・保護者マスター インライン編集＆認証コード管理
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                学校側で新入生を登録して認証コードを発行できます。保護者がそのコードを入力するとアカウント連携（兄弟追加含む）が完了します。
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setNewStudentDraft({
                  name: '',
                  bus_stop_name: busStops[0]?.name || '',
                  note: ''
                })
                setIsAddStudentModalOpen(true)
              }}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 self-start sm:self-auto shrink-0"
            >
              <Plus className="h-4 w-4" />
              ＋ 新入生・新規生徒を登録
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3 min-w-[170px]">保護者メールアドレス (A列)</th>
                  <th className="py-3 px-3 min-w-[150px]">登録生徒名 (B〜E列)</th>
                  <th className="py-3 px-3 min-w-[170px]">登録バス停名 (F列)</th>
                  <th className="py-3 px-3 min-w-[170px]">備考 (G列)</th>
                  <th className="py-3 px-3 min-w-[150px] text-center">認証コード (J列)</th>
                  <th className="py-3 px-3 w-24 text-center">保存状況</th>
                  <th className="py-3 px-3 w-16 text-center">操作</th>
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
                  const isDeletingThisRow = deletingGuardianKey === (g.parent_email || g.auth_code || String(idx))

                  return (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-mono text-xs">
                        {email ? (
                          <span className="font-bold text-slate-300">{email}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 text-[11px]">
                            未連携
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {g.student_names.length > 0 ? (
                            g.student_names.map((name, i) => (
                              <span key={i} className="px-2 py-0.5 bg-slate-800 text-white rounded font-bold text-[11px]">
                                {name}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">未設定</span>
                          )}
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
                      {/* 認証コード (J列) */}
                      <td className="py-3 px-3 text-center">
                        {g.auth_code ? (
                          <div className="inline-flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                            <span className="font-mono font-bold text-amber-300 text-xs">
                              {g.auth_code}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(g.auth_code || '')}
                              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
                              title="コードをコピー"
                            >
                              {copiedCode === g.auth_code ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[11px]">-</span>
                        )}
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
                      {/* 操作（行削除ボタン） */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteGuardianRow(g, idx)}
                          disabled={isDeletingThisRow}
                          className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition-all border border-transparent hover:border-rose-500/30 disabled:opacity-40 cursor-pointer"
                          title="この行の生徒・保護者データを削除"
                        >
                          {isDeletingThisRow ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin text-rose-400" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
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
              {/* 年月ナビゲーション ＆ 公開ステータス / 確定ボタン */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h4 className="text-lg md:text-xl font-black text-white tracking-wide">
                    {currentCalendarDate.getFullYear()}年 {currentCalendarDate.getMonth() + 1}月
                  </h4>
                  <button
                    type="button"
                    onClick={handleCurrentMonth}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    今月
                  </button>

                  {/* 公開ステータスバッジ */}
                  {isCurrentMonthPublished ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-black shadow-sm shadow-emerald-500/10">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      予約受付中（確定・公開済）
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-black shadow-sm shadow-amber-500/10">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      未確定・ロック中（保護者入力不可）
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* 「確定・公開」トグルボタン */}
                  <button
                    type="button"
                    onClick={handleToggleMonthPublish}
                    disabled={isTogglingPublish}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md disabled:opacity-50 ${
                      isCurrentMonthPublished
                        ? 'bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-emerald-500/20'
                    }`}
                    title={isCurrentMonthPublished ? 'クリックで未確定（ロック）に戻します' : 'クリックで確定して保護者予約受付を開始します'}
                  >
                    {isTogglingPublish ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>処理中...</span>
                      </>
                    ) : isCurrentMonthPublished ? (
                      <>
                        <Lock className="h-4 w-4 text-emerald-400" />
                        <span>🔒 確定済（公開中） - クリックで未確定に戻す</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 stroke-[3]" />
                        <span>✅ この月の時刻表を確定して予約受付を開始する</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenBatchModal}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    <span>📅</span>
                    <span>1か月分を一括設定</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition-all cursor-pointer"
                    title="前月"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition-all cursor-pointer"
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
                <span className="flex items-center gap-1.5 font-bold text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> 🎌 祝日
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
                  const morningTime = formatTimeOnly(data?.morning_trip)
                  const trip1Time = formatTimeOnly(data?.afternoon_trip_1)
                  const trip2Time = formatTimeOnly(data?.afternoon_trip_2)
                  const trip3Time = formatTimeOnly(data?.afternoon_trip_3)

                  const hasMorning = morningTime !== ''
                  const hasTrip1 = trip1Time !== ''
                  const hasTrip2 = trip2Time !== ''
                  const hasTrip3 = trip3Time !== ''
                  const label = (data?.calendar_label || '').trim()
                  const note = (data?.note || '').trim()

                  const holidayName = getJapaneseHolidayName(day.dateStr)
                  const isHoliday = !!holidayName
                  const isSun = day.dayOfWeek === 0
                  const isSat = day.dayOfWeek === 6

                  return (
                    <div
                      key={idx}
                      onClick={() => handleOpenTimetableModal(day.dateStr)}
                      className={`min-h-[105px] md:min-h-[120px] p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group select-none ${
                        !day.isCurrentMonth
                          ? 'bg-slate-950/40 border-slate-900/60 opacity-40 hover:opacity-80'
                          : day.isToday
                          ? 'bg-slate-900/90 border-amber-500/80 shadow-md shadow-amber-500/10 hover:border-amber-400'
                          : isHoliday || isSun
                          ? 'bg-rose-950/20 border-rose-900/40 hover:border-rose-500/60 hover:bg-rose-950/30'
                          : 'bg-slate-950/70 border-slate-800 hover:border-sky-500/60 hover:bg-slate-900/60'
                      }`}
                    >
                      {/* セル上部：日付番号と祝日バッジ・行事ラベル */}
                      <div className="flex items-start justify-between gap-1">
                        <span
                          className={`inline-flex items-center justify-center text-xs font-black rounded-lg ${
                            day.isToday
                              ? 'bg-amber-500 text-slate-950 w-6 h-6 shadow-sm'
                              : isHoliday || isSun
                              ? 'text-rose-400 font-black'
                              : isSat
                              ? 'text-sky-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {day.dayNumber}
                        </span>

                        <div className="flex flex-col items-end gap-1 max-w-[72%]">
                          {holidayName && (
                            <span 
                              className="text-[9px] md:text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 truncate max-w-full"
                              title={`祝日: ${holidayName}`}
                            >
                              🎌 {holidayName}
                            </span>
                          )}
                          {label && (
                            <span 
                              className="text-[9px] md:text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold truncate max-w-full border border-amber-500/30"
                              title={label}
                            >
                              {label}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* セル中央：運行便情報バッジ（スプレッドシート値に基づく条件付き表示） */}
                      <div className="space-y-1 my-1">
                        {hasMorning && (
                          <div className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20 truncate flex items-center justify-between">
                            <span>登校</span>
                            <span>{formatTimeToHHmm(morningTime)}</span>
                          </div>
                        )}

                        {hasTrip1 && (
                          <div className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/20 truncate flex items-center justify-between">
                            <span>下校1</span>
                            <span>{formatTimeToHHmm(trip1Time)}</span>
                          </div>
                        )}

                        {hasTrip2 && (
                          <div className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 truncate flex items-center justify-between">
                            <span>下校2</span>
                            <span>{formatTimeToHHmm(trip2Time)}</span>
                          </div>
                        )}

                        {hasTrip3 && (
                          <div className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/20 truncate flex items-center justify-between">
                            <span>下校3</span>
                            <span>{formatTimeToHHmm(trip3Time)}</span>
                          </div>
                        )}

                        {!hasMorning && !hasTrip1 && !hasTrip2 && !hasTrip3 && (
                          <div className="text-[10px] text-slate-600 italic px-1 text-center py-1 truncate">
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
                              <div className="flex flex-col gap-0.5">
                                <span>{date}</span>
                                {getJapaneseHolidayName(date) && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 w-fit font-sans">
                                    🎌 {getJapaneseHolidayName(date)}
                                  </span>
                                )}
                              </div>
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
      {/* 学校用時刻表 1か月分一括設定モーダル */}
      {/* ========================================================= */}
      {isBatchTimetableModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-6 my-8 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            {/* モーダルヘッダー */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base md:text-lg font-black text-white flex items-center gap-2">
                  <span className="text-xl">📅</span>
                  学校用時刻表 1か月分を一括設定
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  対象月の平日（月〜金）の便時刻を一律再生成・上書き更新します。土日祝は自動除外され、個別設定は維持されます。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchTimetableModalOpen(false)}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ① 対象年月選択 */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
              <label className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-400" />
                ① 対象年月の選択
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">年:</span>
                  <select
                    value={batchYear}
                    onChange={(e) => setBatchYear(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-amber-400"
                  >
                    {[batchYear - 1, batchYear, batchYear + 1, batchYear + 2].map((y) => (
                      <option key={y} value={y}>{y}年</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">月:</span>
                  <select
                    value={batchMonth}
                    onChange={(e) => setBatchMonth(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-amber-400"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>{m}月</option>
                    ))}
                  </select>
                </div>
                <span className="text-xs text-slate-400 font-medium ml-auto">
                  全 {batchPreviewSummary.totalDays} 日間（平日稼働日: <strong className="text-emerald-400 font-bold">{batchPreviewSummary.totalWeekdays}日</strong>）
                </span>
              </div>
            </div>

            {/* ② 【基本パターン】（通常日・6時間授業） */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <label className="text-xs font-black text-sky-300 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-sky-400" />
                  ② 【基本パターン】（通常日・6時間授業）
                </label>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30">
                  適用対象: {batchPreviewSummary.baseCount}日
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* 登校便 */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-amber-300">
                    登校便 出発時刻
                  </label>
                  <input
                    type="time"
                    value={basePattern.morning_trip}
                    onChange={(e) => setBasePattern(p => ({ ...p, morning_trip: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
                {/* 下校1便 */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-sky-300">
                    下校1便 時刻
                  </label>
                  <input
                    type="time"
                    value={basePattern.afternoon_trip_1}
                    onChange={(e) => setBasePattern(p => ({ ...p, afternoon_trip_1: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-sky-400"
                  />
                </div>
                {/* 下校2便 */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-indigo-300">
                    下校2便（空欄可）
                  </label>
                  <input
                    type="time"
                    value={basePattern.afternoon_trip_2}
                    onChange={(e) => setBasePattern(p => ({ ...p, afternoon_trip_2: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-indigo-400"
                  />
                </div>
                {/* 下校3便 */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-purple-300">
                    下校3便（空欄可）
                  </label>
                  <input
                    type="time"
                    value={basePattern.afternoon_trip_3}
                    onChange={(e) => setBasePattern(p => ({ ...p, afternoon_trip_3: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              {/* 備考 */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400">
                  備考・ラベル（空欄可）
                </label>
                <input
                  type="text"
                  value={basePattern.note}
                  onChange={(e) => setBasePattern(p => ({ ...p, note: e.target.value }))}
                  placeholder="例: 通常運行"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>

            {/* ③ 【特定曜日の特別パターン】（水曜日など5時間授業の日） */}
            <div className={`bg-slate-950/80 border rounded-2xl p-4 space-y-4 transition-all ${
              hasSpecialPattern ? 'border-amber-500/50 bg-amber-950/10' : 'border-slate-800 opacity-80'
            }`}>
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <label className="text-xs font-black text-amber-300 flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasSpecialPattern}
                    onChange={(e) => setHasSpecialPattern(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
                  />
                  <span>③ 【特定曜日の特別パターン】（5時間授業等）</span>
                </label>
                {hasSpecialPattern && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                    適用対象: {batchPreviewSummary.specialCount}日
                  </span>
                )}
              </div>

              {hasSpecialPattern && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* 曜日選択チェックボタングループ */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-300 block">
                      適用曜日を選択（複数選択可）:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { day: 1, label: '月曜日' },
                        { day: 2, label: '火曜日' },
                        { day: 3, label: '水曜日' },
                        { day: 4, label: '木曜日' },
                        { day: 5, label: '金曜日' }
                      ].map(item => {
                        const isSelected = specialDays.includes(item.day)
                        return (
                          <button
                            key={item.day}
                            type="button"
                            onClick={() => handleToggleSpecialDay(item.day)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm font-black'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
                            }`}
                          >
                            {isSelected ? '✓ ' : ''}{item.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* 特別曜日の便時刻設定 */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-amber-300">
                        特別登校便 時刻
                      </label>
                      <input
                        type="time"
                        value={specialPattern.morning_trip}
                        onChange={(e) => setSpecialPattern(p => ({ ...p, morning_trip: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-sky-300">
                        特別下校1便 時刻
                      </label>
                      <input
                        type="time"
                        value={specialPattern.afternoon_trip_1}
                        onChange={(e) => setSpecialPattern(p => ({ ...p, afternoon_trip_1: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-sky-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-indigo-300">
                        特別下校2便（空欄可）
                      </label>
                      <input
                        type="time"
                        value={specialPattern.afternoon_trip_2}
                        onChange={(e) => setSpecialPattern(p => ({ ...p, afternoon_trip_2: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-purple-300">
                        特別下校3便（空欄可）
                      </label>
                      <input
                        type="time"
                        value={specialPattern.afternoon_trip_3}
                        onChange={(e) => setSpecialPattern(p => ({ ...p, afternoon_trip_3: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-purple-400"
                      />
                    </div>
                  </div>

                  {/* 備考（例: 5時間授業） */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">
                      備考・行事名
                    </label>
                    <input
                      type="text"
                      value={specialPattern.note}
                      onChange={(e) => setSpecialPattern(p => ({ ...p, note: e.target.value }))}
                      placeholder="例: 5時間授業"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-amber-300 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ④ サマリーカード */}
            <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 text-xs space-y-2">
              <div className="font-bold text-white flex items-center justify-between">
                <span>生成サマリー ({batchYear}年{batchMonth}月)</span>
                <span className="text-emerald-400 font-bold">合計 {batchPreviewSummary.totalWeekdays} 日分反映</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-300 text-[11px]">
                <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block">基本パターン:</span>
                  <span className="text-sky-300 font-bold text-sm">{batchPreviewSummary.baseCount} 日</span>
                </div>
                <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block">特別パターン:</span>
                  <span className="text-amber-300 font-bold text-sm">{batchPreviewSummary.specialCount} 日</span>
                </div>
                <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block">祝日（除外）:</span>
                  <span className="text-rose-400 font-bold text-sm">{batchPreviewSummary.skipHolidayCount} 日</span>
                </div>
                <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block">土日（除外）:</span>
                  <span className="text-slate-400 font-bold text-sm">{batchPreviewSummary.skipWeekendCount} 日</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 pt-1 leading-relaxed">
                ※ 対象平日は一律上書き再生成されます。土曜日・日曜日・祝日は自動的に除外されるため、行事登校日など個別に設定されたデータは保護・維持されます。
              </p>
            </div>

            {/* モーダルフッター */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsBatchTimetableModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleExecuteBatchTimetable}
                disabled={isSavingBatchTimetable || batchPreviewSummary.totalWeekdays === 0}
                className="px-5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
              >
                {isSavingBatchTimetable ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>一括反映中...</span>
                  </>
                ) : (
                  <>
                    <CalendarCheck className="h-4 w-4" />
                    <span>{batchPreviewSummary.totalWeekdays}日分を一括反映する</span>
                  </>
                )}
              </button>
            </div>
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

      {/* ========================================================= */}
      {/* 新入生・新規生徒登録モーダル（認証コード自動発行） */}
      {/* ========================================================= */}
      {isAddStudentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-indigo-400" />
                新入生・新規生徒の事前登録
              </h3>
              <button
                type="button"
                onClick={() => setIsAddStudentModalOpen(false)}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 入力フォーム */}
            <form onSubmit={handleRegisterNewStudent} className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                生徒名とバス停を登録すると、自動的に専用の認証コード（例: SB-7829）が発行されスプレッドシート（J列）に保存されます。
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  生徒名（氏名） <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStudentDraft.name}
                  onChange={(e) => setNewStudentDraft(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例: 山田 太郎"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-400 rounded-xl text-sm font-bold text-white placeholder:text-slate-600 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  登録バス停名
                </label>
                <select
                  value={newStudentDraft.bus_stop_name}
                  onChange={(e) => setNewStudentDraft(prev => ({ ...prev, bus_stop_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-400 rounded-xl text-xs font-bold text-amber-300 outline-none cursor-pointer"
                >
                  {busStops.map(b => (
                    <option key={b.name} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  備考 (G列)
                </label>
                <input
                  type="text"
                  value={newStudentDraft.note}
                  onChange={(e) => setNewStudentDraft(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="例: 2026年度新入生、1年A組"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-400 rounded-xl text-xs text-slate-300 placeholder:text-slate-600 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddStudentModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isRegisteringStudent}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {isRegisteringStudent ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> 登録中...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" /> 登録して認証コードを発行
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
