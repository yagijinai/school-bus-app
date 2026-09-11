import React, { useState, useMemo, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { 
  Bus, 
  ChevronLeft, ChevronRight, ChevronDown, User, RefreshCw, LogOut, CheckCircle2, Ban,
  Plus, UserPlus, AlertCircle, X, Calendar, CalendarDays, Sparkles, Check,
  Lock, Circle
} from 'lucide-react'
import { toSlashDate, toHyphenDate, formatTimeToHHmm, formatTimeOnly, isMonthPublished } from '../lib/spreadsheetApi'
import { RoleSwitcher } from '../components/RoleSwitcher'
import { getJapaneseHolidayName } from '../lib/japaneseHolidays'

export const ParentDashboard: React.FC = () => {
  const { 
    user, logout, guardianMaster, schedules, 
    basicSettings, schoolTimetable, busStops, 
    saveReservation, saveBatchSchedules, linkStudentWithCode, syncing, refreshAll 
  } = useApp()

  // ログイン保護者のマスターデータ（同メールの全行を取得）
  const myGuardians = useMemo(() => {
    if (!user) return []
    return guardianMaster.filter(g => g.parent_email.toLowerCase() === user.email.toLowerCase())
  }, [user, guardianMaster])

  const myGuardian = myGuardians[0] || null

  // 生徒一覧（B〜E列および同メールの全行からユニーク抽出）
  const studentNames = useMemo(() => {
    const set = new Set<string>()
    myGuardians.forEach(g => {
      g.student_names.forEach(s => {
        if (s) set.add(s)
      })
    })
    return Array.from(set)
  }, [myGuardians])

  // 選択中の生徒
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  // 初期選択
  useEffect(() => {
    if (studentNames.length > 0 && (!selectedStudent || !studentNames.includes(selectedStudent))) {
      setSelectedStudent(studentNames[0])
    }
  }, [studentNames, selectedStudent])

  // 一括設定コントロールバー用の入力ステート
  const [batchMorning, setBatchMorning] = useState<'乗る' | '乗らない'>('乗る')
  const [batchAfternoon, setBatchAfternoon] = useState<'1便' | '2便' | '乗らない'>('1便')

  // 初期値の同期
  useEffect(() => {
    if (myGuardian) {
      if (myGuardian.default_morning === '乗らない') {
        setBatchMorning('乗らない')
      } else {
        setBatchMorning('乗る')
      }

      if (myGuardian.default_afternoon === '2便') {
        setBatchAfternoon('2便')
      } else if (myGuardian.default_afternoon === '乗らない') {
        setBatchAfternoon('乗らない')
      } else {
        setBatchAfternoon('1便')
      }
    }
  }, [myGuardian])

  // 一括反映確認モーダルステート
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    mode: 'week' | 'month'
    title: string
    startDate: string
    endDate: string
    targetCount: number
    targetDates: string[]
  } | null>(null)

  const [isBatchApplying, setIsBatchApplying] = useState(false)
  const [batchSuccessMsg, setBatchSuccessMsg] = useState<string | null>(null)

  // 兄弟姉妹の追加モーダル状態
  const [isAddSiblingModalOpen, setIsAddSiblingModalOpen] = useState(false)
  const [siblingCode, setSiblingCode] = useState('')
  const [isAddingSibling, setIsAddingSibling] = useState(false)
  const [siblingError, setSiblingError] = useState<string | null>(null)
  const [siblingSuccess, setSiblingSuccess] = useState<string | null>(null)

  const handleAddSiblingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!siblingCode.trim() || !user) return
    setIsAddingSibling(true)
    setSiblingError(null)
    setSiblingSuccess(null)
    try {
      const res = await linkStudentWithCode({
        email: user.email,
        code: siblingCode.trim()
      })
      if (res.success) {
        setSiblingSuccess(`お子様「${res.student_name || ''}」を追加連携しました！`)
        if (res.student_name) {
          setSelectedStudent(res.student_name)
        }
        setTimeout(() => {
          setIsAddSiblingModalOpen(false)
          setSiblingCode('')
          setSiblingSuccess(null)
        }, 1200)
      } else {
        setSiblingError(res.message || '登録コードの照合に失敗しました')
      }
    } finally {
      setIsAddingSibling(false)
    }
  }

  // 週間カレンダーの週オフセット（0: 今週, 1: 来週, etc.）
  const [weekOffset, setWeekOffset] = useState<number>(0)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)

  // スマホ最適化：一括予約バーのアコーディオン開閉状態（デフォルトは画面を占有しないよう閉じる）
  const [isBatchAccordionOpen, setIsBatchAccordionOpen] = useState<boolean>(false)
  // リアルタイム最終同期時刻
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('')

  // 今日の日付 (YYYY/MM/DD)
  const todayStrSlash = useMemo(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}/${m}/${day}`
  }, [])

  // リアルタイム自動同期（20秒ポーリング ＆ 画面復帰時の自動サイレント更新）
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      const ss = String(now.getSeconds()).padStart(2, '0')
      setLastSyncedTime(`${hh}:${mm}:${ss}`)
    }
    updateTime()

    // 20秒間隔の定期バックグラウンド同期
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshAll().then(() => updateTime()).catch(() => {})
      }
    }, 20000)

    // 画面復帰時（アプリに切り替えた時やブラウザタブがアクティブになった時）の自動更新
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshAll().then(() => updateTime()).catch(() => {})
      }
    }
    const handleFocus = () => {
      refreshAll().then(() => updateTime()).catch(() => {})
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
    }
  }, [refreshAll])

  // 対象週の月曜日〜金曜日の日付一覧を生成
  const weekDays = useMemo(() => {
    const today = new Date()
    const curDayOfWeek = today.getDay() // 0:日, 1:月...
    const diffToMonday = curDayOfWeek === 0 ? -6 : 1 - curDayOfWeek
    
    const monday = new Date(today)
    monday.setDate(today.getDate() + diffToMonday + weekOffset * 7)

    const days: { dateStrSlash: string; dateStrHyphen: string; dateObj: Date; dayName: string }[] = []
    const dayNames = ['月', '火', '水', '木', '金']

    for (let i = 0; i < 5; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dateStrSlash = toSlashDate(d)
      const dateStrHyphen = toHyphenDate(dateStrSlash)
      days.push({
        dateStrSlash,
        dateStrHyphen,
        dateObj: d,
        dayName: dayNames[i]
      })
    }
    return days
  }, [weekOffset])

  // 登録バス停の到着予定時刻
  const myBusStop = useMemo(() => {
    if (!myGuardian) return null
    return busStops.find(b => b.name === myGuardian.bus_stop_name) || null
  }, [myGuardian, busStops])

  // 運休期間判定（スプレッドシート「基本設定・運休期間」より判定）
  const checkSuspension = (dateSlash: string) => {
    for (const b of basicSettings) {
      const isSuspended = b.standard_operation === '運休' || b.content_time.includes('運休')
      if (!isSuspended) continue
      const start = b.start_date
      const end = b.end_date
      if (!start || !end) continue

      if (start <= end) {
        if (dateSlash >= start && dateSlash <= end) {
          return { isSuspended: true, name: b.setting_name, note: b.note }
        }
      } else {
        // 年跨ぎ
        const dMD = dateSlash.slice(5)
        const sMD = start.slice(5)
        const eMD = end.slice(5)
        if (dMD >= sMD || dMD <= eMD) {
          return { isSuspended: true, name: b.setting_name, note: b.note }
        }
      }
    }
    return { isSuspended: false, name: '', note: '' }
  }

  // 表示中週に含まれる年月の判定
  const weekYearMonths = useMemo(() => {
    const set = new Set<string>()
    weekDays.forEach(d => {
      const ym = d.dateStrSlash.slice(0, 7) // YYYY/MM
      set.add(ym)
    })
    return Array.from(set)
  }, [weekDays])

  // 週内の全日（月〜金）がすべて確定・公開されているか
  const isWeekAllPublished = useMemo(() => {
    if (weekYearMonths.length === 0) return false
    return weekYearMonths.every(ym => isMonthPublished(ym, basicSettings))
  }, [weekYearMonths, basicSettings])

  // 主たる年月（週初日の年月）
  const primaryYearMonth = weekYearMonths[0] || ''
  const isPrimaryMonthPublished = isMonthPublished(primaryYearMonth, basicSettings)

  // 学校時刻表 閲覧モーダル用状態
  const [isTimetableModalOpen, setIsTimetableModalOpen] = useState(false)
  const [timetableModalDate, setTimetableModalDate] = useState<Date>(() => new Date())

  const timetableModalYearMonth = useMemo(() => {
    const y = timetableModalDate.getFullYear()
    const m = String(timetableModalDate.getMonth() + 1).padStart(2, '0')
    return `${y}/${m}`
  }, [timetableModalDate])

  const timetableModalDays = useMemo(() => {
    const year = timetableModalDate.getFullYear()
    const month = timetableModalDate.getMonth()
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

    const pad = (n: number) => String(n).padStart(2, '0')
    const todayStr = `${new Date().getFullYear()}/${pad(new Date().getMonth() + 1)}/${pad(new Date().getDate())}`

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

    // 当月
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
  }, [timetableModalDate])

  // 今週分モーダルのトリガー
  const openWeekConfirmModal = () => {
    const validDays = weekDays
      .map(d => d.dateStrSlash)
      .filter(d => !checkSuspension(d).isSuspended)

    if (validDays.length === 0) {
      alert('対象週に運行予定の平日がありません（すべて運休または非平日）')
      return
    }

    setConfirmModal({
      isOpen: true,
      mode: 'week',
      title: '今週分の予約を一括反映しますか？',
      startDate: weekDays[0].dateStrSlash,
      endDate: weekDays[4].dateStrSlash,
      targetCount: validDays.length,
      targetDates: validDays
    })
  }

  // 今月分モーダルのトリガー
  const openMonthConfirmModal = () => {
    const baseDate = weekDays[0]?.dateObj || new Date()
    const year = baseDate.getFullYear()
    const month = baseDate.getMonth() // 0-indexed

    const lastDay = new Date(year, month + 1, 0).getDate()
    const validDays: string[] = []

    for (let day = 1; day <= lastDay; day++) {
      const d = new Date(year, month, day)
      const dayOfWeek = d.getDay()
      // 土日は除外 (0:日, 6:土)
      if (dayOfWeek === 0 || dayOfWeek === 6) continue

      const dateSlash = toSlashDate(d)
      // 運休日は除外
      if (checkSuspension(dateSlash).isSuspended) continue

      validDays.push(dateSlash)
    }

    if (validDays.length === 0) {
      alert(`${month + 1}月に運行予定の平日がありません（すべて運休または非平日）`)
      return
    }

    setConfirmModal({
      isOpen: true,
      mode: 'month',
      title: '今月分（平日）の予約を一括反映しますか？',
      startDate: validDays[0],
      endDate: validDays[validDays.length - 1],
      targetCount: validDays.length,
      targetDates: validDays
    })
  }

  // 一括反映の実行（GAS action: 'saveBatchSchedules' 呼び出し）
  const handleApplyBatch = async () => {
    if (!confirmModal || !user || !selectedStudent) return
    setIsBatchApplying(true)
    try {
      const payload = confirmModal.targetDates.map(dateSlash => {
        const timetableRow = schoolTimetable.find(t => t.date === dateSlash)
        const t1Time = formatTimeToHHmm(timetableRow?.afternoon_trip_1) || '15:00'
        const t2Time = formatTimeToHHmm(timetableRow?.afternoon_trip_2) || '16:00'

        let aftStatus = ''
        let trip1 = ''
        let trip2 = ''
        let trip3 = ''

        if (batchAfternoon === '乗らない') {
          aftStatus = '乗らない'
        } else if (batchAfternoon === '1便') {
          trip1 = t1Time
        } else if (batchAfternoon === '2便') {
          trip2 = t2Time
        }

        const existing = schedules.find(s => s.date === dateSlash && s.student_name === selectedStudent)

        return {
          date: dateSlash,
          student_name: selectedStudent,
          morning_status: batchMorning === '乗る' ? '乗る' : '',
          afternoon_status: aftStatus,
          afternoon_trip_1: trip1,
          afternoon_trip_2: trip2,
          afternoon_trip_3: trip3,
          note: existing?.note || '',
          parent_email: user.email
        }
      })

      const res = await saveBatchSchedules(payload)
      if (res.success || (res as any).status === 'success') {
        setBatchSuccessMsg(`${confirmModal.mode === 'week' ? '今週分' : '今月分'}の平日（${payload.length}日分）に一括反映しました！`)
        setTimeout(() => setBatchSuccessMsg(null), 3500)
        setConfirmModal(null)
      } else {
        alert(`一括反映に失敗しました: ${res.message || 'エラーが発生しました'}`)
      }
    } catch (err: any) {
      alert(`エラーが発生しました: ${err.message}`)
    } finally {
      setIsBatchApplying(false)
    }
  }

  // 日別個別予約変更ハンドラ（ピンポイント変更・即時保存維持）
  const handleUpdate = async (dateSlash: string, field: 'morning' | 'afternoon', value: string) => {
    if (!user || !selectedStudent) return

    const timetableRow = schoolTimetable.find(t => t.date === dateSlash)
    const t1Time = formatTimeToHHmm(timetableRow?.afternoon_trip_1) || '15:00'
    const t2Time = formatTimeToHHmm(timetableRow?.afternoon_trip_2) || '16:00'
    const t3Time = formatTimeToHHmm(timetableRow?.afternoon_trip_3) || '17:00'

    // 既存予約行を探す
    const existing = schedules.find(s => s.date === dateSlash && s.student_name === selectedStudent)
    
    // 現在値
    const curMorning = existing ? existing.morning_status : (myGuardian?.default_morning || '')
    const curAfternoonStatus = existing ? existing.afternoon_status : (myGuardian?.default_afternoon === '乗らない' ? '乗らない' : '')
    const curTrip1 = existing ? existing.afternoon_trip_1 : (myGuardian?.default_afternoon === '1便' ? t1Time : '')
    const curTrip2 = existing ? existing.afternoon_trip_2 : (myGuardian?.default_afternoon === '2便' ? t2Time : '')
    const curTrip3 = existing ? existing.afternoon_trip_3 : ''

    let newMorning = curMorning
    let newAfternoonStatus = curAfternoonStatus
    let newTrip1 = curTrip1
    let newTrip2 = curTrip2
    let newTrip3 = curTrip3

    if (field === 'morning') {
      newMorning = value // '乗る' または ''
    } else {
      // 下校便の選択: '1便' | '2便' | '3便' | '乗らない'
      if (value === '乗らない') {
        newAfternoonStatus = '乗らない'
        newTrip1 = ''
        newTrip2 = ''
        newTrip3 = ''
      } else if (value === '1便') {
        newAfternoonStatus = ''
        newTrip1 = t1Time
        newTrip2 = ''
        newTrip3 = ''
      } else if (value === '2便') {
        newAfternoonStatus = ''
        newTrip1 = ''
        newTrip2 = t2Time
        newTrip3 = ''
      } else if (value === '3便') {
        newAfternoonStatus = ''
        newTrip1 = ''
        newTrip2 = ''
        newTrip3 = t3Time
      } else {
        newAfternoonStatus = '乗らない'
        newTrip1 = ''
        newTrip2 = ''
        newTrip3 = ''
      }
    }

    const key = `${dateSlash}-${selectedStudent}`
    setSavingKey(key)

    try {
      const res = await saveReservation({
        date: dateSlash,
        student_name: selectedStudent,
        morning_status: newMorning,
        afternoon_status: newAfternoonStatus,
        afternoon_trip_1: newTrip1,
        afternoon_trip_2: newTrip2,
        afternoon_trip_3: newTrip3,
        note: existing?.note || '',
        parent_email: user.email
      })

      if (res.success) {
        setSavedKey(key)
        setTimeout(() => setSavedKey(null), 2500)
      } else {
        alert(`保存に失敗しました: ${res.message}`)
      }
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* 上部ヘッダー */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 rounded-2xl shadow-md">
            <Bus className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white flex items-center gap-2">
              保護者マイページ
              <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-bold">
                スプレッドシート直結
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              {user?.email} 様
              {myGuardian?.bus_stop_name && (
                <span className="ml-2 text-amber-400 font-bold">
                  （登録バス停: {myGuardian.bus_stop_name} {myBusStop?.arrival_time_morning ? `| 登校 ${myBusStop.arrival_time_morning}` : ''}）
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <RoleSwitcher />
          <button
            type="button"
            onClick={() => setIsTimetableModalOpen(true)}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-300 hover:text-sky-200 rounded-xl transition-all text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="学校の月間時刻表を確認"
          >
            <Calendar className="h-4 w-4 text-sky-400" />
            <span className="hidden sm:inline">学校時刻表</span>
          </button>
          <button
            type="button"
            onClick={() => refreshAll()}
            disabled={syncing}
            className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            title="最新データを再取得"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin text-amber-400' : ''}`} />
            {syncing ? '更新中' : '同期'}
          </button>
          <button
            type="button"
            onClick={logout}
            className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-rose-400 transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            ログアウト
          </button>
        </div>
      </header>

      {/* 生徒切り替えタブ（B〜E列） ＆ 兄弟追加ボタン */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {studentNames.map(name => (
          <button
            key={name}
            type="button"
            onClick={() => setSelectedStudent(name)}
            className={`px-5 py-2.5 rounded-2xl font-black text-sm flex items-center gap-2 transition-all shadow-md whitespace-nowrap ${
              selectedStudent === name
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-amber-500/20 scale-100'
                : 'bg-slate-900 hover:bg-slate-850 text-slate-400 border border-slate-800'
            }`}
          >
            <User className="h-4 w-4" />
            {name}
          </button>
        ))}

        {/* ＋ お子様を追加（兄弟姉妹）ボタン */}
        <button
          type="button"
          onClick={() => {
            setSiblingError(null)
            setSiblingSuccess(null)
            setSiblingCode('')
            setIsAddSiblingModalOpen(true)
          }}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-850 border border-dashed border-amber-500/50 hover:border-amber-400 text-amber-300 hover:text-amber-200 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap shadow-sm shrink-0"
        >
          <Plus className="h-4 w-4 text-amber-400" />
          お子様を追加（コード入力）
        </button>
      </div>

      {/* 📢 確定・公開ステータス通知バナー */}
      {isWeekAllPublished ? (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-200 shadow-xl shadow-emerald-950/20 animate-in fade-in">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-emerald-300 flex items-center gap-2">
                <span>時刻表確定済</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                  予約受付中
                </span>
              </div>
              <div className="text-xs font-bold text-slate-200 mt-0.5">
                📢 {primaryYearMonth.replace('/', '年')}月分のバス時刻表が確定しました。予約を入力・確定してください。
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsTimetableModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Calendar className="h-3.5 w-3.5" />
            学校時刻表を確認
          </button>
        </div>
      ) : (
        <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200 shadow-xl shadow-amber-950/20 animate-in fade-in">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl shrink-0">
              <AlertCircle className="h-5 w-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-amber-300 flex items-center gap-2">
                <span>時刻表調整中</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                  予約入力ロック中
                </span>
              </div>
              <div className="text-xs font-bold text-slate-200 mt-0.5">
                ⚠️ {primaryYearMonth.replace('/', '年')}月分のバス時刻表は現在学校で調整中です。時刻表が確定するまで予約の入力・変更はできません。
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsTimetableModalOpen(true)}
            className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Calendar className="h-3.5 w-3.5" />
            学校時刻表を確認
          </button>
        </div>
      )}

      {/* ② 一括予約反映コントロールバー（スマホ最適化折りたたみアコーディオン） */}
      <section className="bg-slate-900/95 border border-slate-800 rounded-3xl overflow-hidden shadow-xl transition-all">
        {/* アコーディオン開閉ヘッダー */}
        <button
          type="button"
          onClick={() => setIsBatchAccordionOpen(prev => !prev)}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-slate-850/50 transition cursor-pointer select-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-white">
                  一括予約バー
                </h2>
                <span className="text-[11px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded-lg font-bold">
                  {selectedStudent} さん
                </span>
                <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  {isBatchAccordionOpen ? 'タップで閉じる ▲' : 'タップで設定展開 ▼'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                基本パターン（登校:{batchMorning} / 下校:{batchAfternoon}）を平日にまとめて反映
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-2">
            <div className={`p-2 rounded-xl bg-slate-800 text-slate-300 transition-transform duration-200 ${
              isBatchAccordionOpen ? 'rotate-180 bg-amber-500/20 text-amber-400' : ''
            }`}>
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>
        </button>

        {/* 展開時の中身 */}
        {isBatchAccordionOpen && (
          <div className="p-4 sm:p-5 pt-0 border-t border-slate-800/80 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            {batchSuccessMsg && (
              <div className="px-3.5 py-2.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{batchSuccessMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              {/* 基本設定入力UI */}
              <div className="lg:col-span-7 flex flex-wrap items-center gap-4">
                {/* 登校設定 */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 whitespace-nowrap">登校:</span>
                  <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setBatchMorning('乗る')}
                      className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        batchMorning === '乗る'
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      乗る
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchMorning('乗らない')}
                      className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        batchMorning === '乗らない'
                          ? 'bg-slate-800 text-slate-200 shadow'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      乗らない
                    </button>
                  </div>
                </div>

                {/* 下校設定 */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 whitespace-nowrap">下校:</span>
                  <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setBatchAfternoon('1便')}
                      className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        batchAfternoon === '1便'
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      下校1便
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchAfternoon('2便')}
                      className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        batchAfternoon === '2便'
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      下校2便
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchAfternoon('乗らない')}
                      className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        batchAfternoon === '乗らない'
                          ? 'bg-slate-800 text-slate-200 shadow'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      乗らない
                    </button>
                  </div>
                </div>
              </div>

              {/* 反映ボタン群 */}
              <div className="lg:col-span-5 flex flex-col items-start lg:items-end gap-1.5 w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:w-auto">
                  <button
                    type="button"
                    onClick={openWeekConfirmModal}
                    disabled={!isWeekAllPublished || isBatchApplying || syncing}
                    className="min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 cursor-pointer"
                  >
                    {!isWeekAllPublished ? <Lock className="h-3.5 w-3.5" /> : <Calendar className="h-4 w-4" />}
                    今週分に反映（月〜金）
                  </button>
                  <button
                    type="button"
                    onClick={openMonthConfirmModal}
                    disabled={!isPrimaryMonthPublished || isBatchApplying || syncing}
                    className="min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 cursor-pointer"
                  >
                    {!isPrimaryMonthPublished ? <Lock className="h-3.5 w-3.5" /> : <CalendarDays className="h-4 w-4" />}
                    今月分に一括反映（平日）
                  </button>
                </div>
                {!isWeekAllPublished && (
                  <span className="text-[10px] text-amber-400/90 font-bold flex items-center gap-1 mt-1">
                    <Lock className="h-3 w-3" /> 時刻表未確定のため一括反映はロック中
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 週間カレンダーコントロールバー ＆ リアルタイム同期表示 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl">
        <div className="flex items-center justify-between sm:justify-start gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset(prev => prev - 1)}
            className="min-h-[44px] px-4 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl text-slate-300 hover:text-white transition-all flex items-center gap-1 text-xs font-black active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
            前週
          </button>
          
          {weekOffset !== 0 ? (
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="min-h-[44px] px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 rounded-2xl text-xs font-black transition-all active:scale-95 cursor-pointer"
            >
              今週へ戻る
            </button>
          ) : (
            <span className="text-[11px] px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl font-black flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> 今週表示中
            </span>
          )}

          <button
            type="button"
            onClick={() => setWeekOffset(prev => prev + 1)}
            className="min-h-[44px] px-4 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl text-slate-300 hover:text-white transition-all flex items-center gap-1 text-xs font-black active:scale-95 cursor-pointer"
          >
            次週
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
          <span className="font-mono font-black text-white text-sm">
            {weekDays[0]?.dateStrSlash} 〜 {weekDays[4]?.dateStrSlash}
          </span>
          {lastSyncedTime && (
            <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
              <RefreshCw className={`h-2.5 w-2.5 ${syncing ? 'animate-spin text-amber-400' : 'text-emerald-400'}`} />
              最終同期: {lastSyncedTime}
            </span>
          )}
        </div>
      </div>

      {/* 週間予約カード一覧（スマホ特化縦型カードリスト ＆ PC 5列グリッド） */}
      <div className="flex flex-col md:grid md:grid-cols-5 gap-4">
        {weekDays.map(day => {
          const isToday = day.dateStrSlash === todayStrSlash
          const suspension = checkSuspension(day.dateStrSlash)
          const timetableRow = schoolTimetable.find(t => t.date === day.dateStrSlash)
          const existing = schedules.find(s => s.date === day.dateStrSlash && s.student_name === selectedStudent)
          const isDayPublished = isMonthPublished(day.dateStrSlash.slice(0, 7), basicSettings)
          const holiday = getJapaneseHolidayName(day.dateStrSlash)
          
          // 学校用時刻表からの各便時刻
          const t1Time = formatTimeToHHmm(timetableRow?.afternoon_trip_1)
          const t2Time = formatTimeToHHmm(timetableRow?.afternoon_trip_2)
          const t3Time = formatTimeToHHmm(timetableRow?.afternoon_trip_3)

          // 登校状態（デフォルト値フォールバック）
          const morningVal = existing 
            ? (existing.morning_status === '乗る' ? '乗る' : '乗らない')
            : (myGuardian?.default_morning === '乗る' ? '乗る' : '乗らない')

          // 下校便状態（デフォルト値フォールバック）
          let afternoonVal = '乗らない'
          if (existing) {
            if (existing.afternoon_trip_1) afternoonVal = '1便'
            else if (existing.afternoon_trip_2) afternoonVal = '2便'
            else if (existing.afternoon_trip_3) afternoonVal = '3便'
            else if (existing.afternoon_status === '乗らない') afternoonVal = '乗らない'
          } else if (myGuardian?.default_afternoon) {
            afternoonVal = myGuardian.default_afternoon
          }

          // 乗車確認データ（12列目: 登校 / 13列目: 下校）
          const morningBoarding = existing?.morning_boarding
          const afternoonBoarding = existing?.afternoon_boarding

          const cardKey = `${day.dateStrSlash}-${selectedStudent}`
          const isSaving = savingKey === cardKey
          const isSaved = savedKey === cardKey

          return (
            <div
              key={day.dateStrSlash}
              className={`border rounded-3xl p-4 sm:p-5 flex flex-col justify-between space-y-3.5 transition-all relative ${
                suspension.isSuspended 
                  ? 'border-rose-500/30 bg-rose-950/15' 
                  : !isDayPublished
                  ? 'border-slate-850 bg-slate-950/70 opacity-80'
                  : isToday
                  ? 'border-amber-400 ring-2 ring-amber-400/50 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 shadow-2xl shadow-amber-500/10'
                  : 'border-slate-800 bg-slate-900/90 hover:border-slate-700'
              }`}
            >
              {/* ① 日付ヘッダー */}
              <div className="border-b border-slate-800/80 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-base font-black tracking-tight ${
                      isToday ? 'text-amber-300' : 'text-white'
                    }`}>
                      {day.dateStrSlash.slice(5)}
                    </span>
                    <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                      day.dayName === '月' ? 'bg-sky-500/10 text-sky-400' :
                      day.dayName === '金' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      （{day.dayName}）
                    </span>
                    {holiday && (
                      <span className="text-[10px] text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-lg font-bold truncate max-w-[110px]">
                        🎌 {holiday}
                      </span>
                    )}
                  </div>

                  {isToday && (
                    <span className="px-2.5 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 rounded-full text-[10px] font-black shadow-sm flex items-center gap-1 shrink-0">
                      <Sparkles className="h-3 w-3" /> 本日
                    </span>
                  )}
                </div>

                {/* 未確定ロックバッジ */}
                {!isDayPublished && (
                  <div className="mt-2 px-2.5 py-1 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center gap-1.5 text-[11px] text-amber-300 font-bold">
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    <span>時刻表未確定（予約ロック中）</span>
                  </div>
                )}

                {/* 学校行事/備考タグ */}
                {timetableRow?.calendar_label && (
                  <div className="mt-1.5 text-xs text-amber-300 font-bold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl truncate">
                    📝 {timetableRow.calendar_label}
                  </div>
                )}

                {/* 運休表示 */}
                {suspension.isSuspended && (
                  <div className="mt-2 p-2 bg-rose-500/20 border border-rose-500/30 rounded-xl flex items-center gap-1.5 text-xs text-rose-300 font-black">
                    <Ban className="h-4 w-4 shrink-0" />
                    <span className="truncate">{suspension.name || '全便運休期間'}</span>
                  </div>
                )}
              </div>

              {/* ② 当日リアルタイム乗車確認バッジ（当日ハイライトパネル） */}
              {isToday && !suspension.isSuspended && (
                <div className="p-3 bg-gradient-to-r from-emerald-950/50 via-slate-950 to-slate-950 border border-emerald-500/30 rounded-2xl space-y-2.5 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      リアルタイム乗車確認
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      車内点呼連動
                    </span>
                  </div>

                  {/* 登校便ステータス */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1 shrink-0">
                      🌅 登校:
                    </span>
                    {morningVal === '乗る' ? (
                      morningBoarding ? (
                        <span className="text-xs font-black text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 rounded-lg flex items-center gap-1 truncate shadow-sm">
                          <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          {morningBoarding} 乗車完了
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0">
                          <Circle className="h-3 w-3 text-slate-400" />
                          ⚪ 乗車待ち
                        </span>
                      )
                    ) : (
                      <span className="text-[11px] text-slate-500 font-bold">乗車予定なし</span>
                    )}
                  </div>

                  {/* 下校便ステータス */}
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1 shrink-0">
                      🚌 下校 ({afternoonVal}):
                    </span>
                    {afternoonVal !== '乗らない' ? (
                      afternoonBoarding ? (
                        <span className="text-xs font-black text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 rounded-lg flex items-center gap-1 truncate shadow-sm">
                          <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          {afternoonBoarding} 乗車完了
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0">
                          <Circle className="h-3 w-3 text-slate-400" />
                          ⚪ 乗車待ち
                        </span>
                      )
                    ) : (
                      <span className="text-[11px] text-slate-500 font-bold">乗車予定なし</span>
                    )}
                  </div>
                </div>
              )}

              {/* ③ 予約選択フォーム（スマホ特化・大型タップ領域 ＆ 即時保存） */}
              {suspension.isSuspended ? (
                <div className="py-8 text-center text-xs font-bold text-slate-500">
                  全便運休
                </div>
              ) : (
                <div className="space-y-4 py-1">
                  {/* 登校便のワンタップ切替（44px以上の大型トグル） */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span className="flex items-center gap-1">
                        🌅 登校便
                      </span>
                      {myBusStop?.arrival_time_morning && (
                        <span className="text-[11px] text-amber-400 font-mono font-bold">
                          バス停 {myBusStop.arrival_time_morning}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                      <button
                        type="button"
                        onClick={() => isDayPublished && handleUpdate(day.dateStrSlash, 'morning', '乗る')}
                        disabled={!isDayPublished}
                        className={`min-h-[48px] text-sm font-black rounded-xl transition-all flex items-center justify-center gap-1.5 select-none active:scale-[0.98] cursor-pointer ${
                          !isDayPublished
                            ? 'opacity-40 cursor-not-allowed text-slate-500'
                            : morningVal === '乗る'
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md font-black'
                            : 'text-slate-400 hover:text-white hover:bg-slate-900'
                        }`}
                      >
                        <Check className={`h-4 w-4 ${morningVal === '乗る' ? 'opacity-100' : 'opacity-0'}`} />
                        乗る
                      </button>
                      <button
                        type="button"
                        onClick={() => isDayPublished && handleUpdate(day.dateStrSlash, 'morning', '')}
                        disabled={!isDayPublished}
                        className={`min-h-[48px] text-sm font-black rounded-xl transition-all flex items-center justify-center gap-1.5 select-none active:scale-[0.98] cursor-pointer ${
                          !isDayPublished
                            ? 'opacity-40 cursor-not-allowed text-slate-500'
                            : morningVal === '乗らない'
                            ? 'bg-slate-800 text-slate-100 shadow-md border border-slate-700'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
                        }`}
                      >
                        乗らない
                      </button>
                    </div>

                    {/* 当日以外の過去・未来乗車確認バッジ（控えめ表示） */}
                    {!isToday && morningBoarding && (
                      <div className="mt-1 text-[11px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/30 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>登校乗車記録: {morningBoarding}</span>
                      </div>
                    )}
                  </div>

                  {/* 下校便プルダウン（大型化48px & フォント16px以上） */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">
                      🚌 下校便の選択
                    </label>
                    <div className="relative">
                      <select
                        value={afternoonVal}
                        disabled={!isDayPublished}
                        onChange={(e) => isDayPublished && handleUpdate(day.dateStrSlash, 'afternoon', e.target.value)}
                        className={`w-full min-h-[48px] bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-base font-bold text-white focus:border-amber-400 outline-none transition-all appearance-none cursor-pointer pr-10 ${
                          !isDayPublished ? 'opacity-40 cursor-not-allowed bg-slate-900/50' : 'hover:border-slate-700 focus:ring-2 focus:ring-amber-500/20'
                        }`}
                        style={{ fontSize: '16px' }}
                      >
                        <option value="乗らない" className="bg-slate-950 text-slate-300">乗らない</option>
                        <option value="1便" className="bg-slate-950 text-white font-bold">
                          下校1便{t1Time ? ` (${t1Time})` : ''}
                        </option>
                        {t2Time && (
                          <option value="2便" className="bg-slate-950 text-white font-bold">
                            下校2便 ({t2Time})
                          </option>
                        )}
                        {t3Time && (
                          <option value="3便" className="bg-slate-950 text-white font-bold">
                            下校3便 ({t3Time})
                          </option>
                        )}
                      </select>
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronDown className="h-5 w-5" />
                      </div>
                    </div>

                    {/* 当日以外の過去・未来乗車確認バッジ（控えめ表示） */}
                    {!isToday && afternoonBoarding && (
                      <div className="mt-1 text-[11px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/30 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>下校乗車記録: {afternoonBoarding}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ④ 保存ステータスインジケーター */}
              <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">
                  {!isDayPublished ? '時刻表確定待ち' : existing ? '個別設定済' : '基本設定適用'}
                </span>
                {!isDayPublished ? (
                  <span className="text-amber-400 font-bold flex items-center gap-1 text-[11px]">
                    <Lock className="h-3 w-3" /> ロック
                  </span>
                ) : isSaving ? (
                  <span className="text-amber-400 font-bold flex items-center gap-1 text-[11px]">
                    <RefreshCw className="h-3 w-3 animate-spin" /> 保存中...
                  </span>
                ) : isSaved ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="h-3.5 w-3.5" /> 保存完了
                  </span>
                ) : (
                  <span className="text-slate-600 font-mono text-[10px]">即時自動保存</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ② 一括予約反映 確認モーダル */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                {confirmModal.title}
              </h3>
              <button
                type="button"
                onClick={() => !isBatchApplying && setConfirmModal(null)}
                disabled={isBatchApplying}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-500">対象のお子様:</span>
                  <span className="font-bold text-white px-2 py-0.5 bg-slate-800 rounded-lg">
                    {selectedStudent}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-500">反映対象期間:</span>
                  <span className="font-mono font-bold text-amber-300">
                    {confirmModal.startDate} 〜 {confirmModal.endDate}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-500">対象日数:</span>
                  <span className="font-bold text-white">
                    平日 {confirmModal.targetCount} 日間
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center text-slate-300">
                  <span className="text-slate-500">反映する内容:</span>
                  <span className="font-bold text-emerald-400">
                    登校: {batchMorning} / 下校: {batchAfternoon === '乗らない' ? '乗らない' : `下校${batchAfternoon}`}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300/90 text-[11px] leading-relaxed space-y-1">
                <p className="font-bold flex items-center gap-1 text-amber-300">
                  <AlertCircle className="h-3.5 w-3.5" />
                  ご確認事項
                </p>
                <p>
                  ・土日および運休期間は自動的に除外されます。<br />
                  ・対象平日に未予約の日程は空いている行へ順番に追記され、既存予約がある日程は上書き更新されます。<br />
                  ・反映後も、日付ごとにピンポイントで個別変更が可能です。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                disabled={isBatchApplying}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleApplyBatch}
                disabled={isBatchApplying}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/20 disabled:opacity-50 active:scale-95"
              >
                {isBatchApplying ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> 一括反映中...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" /> 一括反映を実行する
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* お子様追加（兄弟姉妹）モーダル */}
      {isAddSiblingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-amber-400" />
                お子様（ご兄弟）の追加登録
              </h3>
              <button
                type="button"
                onClick={() => setIsAddSiblingModalOpen(false)}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddSiblingSubmit} className="space-y-4">
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 text-amber-400" />
                  学校配布の登録コードを入力
                </p>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  追加するお子様の登録コード（例: <span className="font-mono font-bold text-amber-300">SB-7829</span>）を入力すると、現在のアカウント（{user?.email}）に兄弟として追加され、タブで切り替えられるようになります。
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  お子様の登録コード（認証コード）
                </label>
                <input
                  type="text"
                  required
                  value={siblingCode}
                  onChange={(e) => setSiblingCode(e.target.value.toUpperCase())}
                  placeholder="例: SB-7829"
                  className="w-full px-4 py-3 bg-slate-950 border-2 border-amber-500/50 focus:border-amber-400 rounded-xl text-base font-mono font-bold text-amber-300 text-center tracking-widest placeholder:text-slate-700 outline-none shadow-inner"
                />
              </div>

              {siblingError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2 text-rose-300 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{siblingError}</span>
                </div>
              )}

              {siblingSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2 text-emerald-300 text-xs font-bold">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{siblingSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddSiblingModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isAddingSibling}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  {isAddingSibling ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> 追加中...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" /> お子様を追加
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 学校時刻表 閲覧専用モーダル */}
      {isTimetableModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 max-w-4xl w-full shadow-2xl space-y-4 my-8 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            {/* ヘッダー */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black text-white flex items-center gap-2">
                    学校運行時刻表（月別カレンダー）
                  </h3>
                  <p className="text-xs text-slate-400">
                    学校全体の運行便時刻・行事予定表です。予約入力の参考にご確認ください。
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTimetableModalOpen(false)}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ナビゲーション */}
            <div className="flex items-center justify-between bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3">
              <div className="flex items-center gap-3">
                <h4 className="text-base md:text-lg font-black text-white">
                  {timetableModalDate.getFullYear()}年 {timetableModalDate.getMonth() + 1}月
                </h4>
                <button
                  type="button"
                  onClick={() => setTimetableModalDate(new Date())}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  今月
                </button>
                {/* 確定ステータスバッジ */}
                {isMonthPublished(timetableModalYearMonth, basicSettings) ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[11px] border border-emerald-500/30">
                    ✓ 確定済（公開中）
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[11px] border border-amber-500/30">
                    ⚠️ 調整中（未確定）
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTimetableModalDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition-all cursor-pointer"
                  title="前月"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setTimetableModalDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition-all cursor-pointer"
                  title="次月"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 凡例 */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 px-1">
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
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> 祝日/運休
              </span>
            </div>

            {/* カレンダーグリッド */}
            <div className="grid grid-cols-7 gap-1 md:gap-2">
              {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                <div
                  key={d}
                  className={`py-1.5 text-center text-xs font-black uppercase ${
                    i === 0 ? 'text-rose-400' : i === 6 ? 'text-sky-400' : 'text-slate-400'
                  }`}
                >
                  {d}
                </div>
              ))}

              {timetableModalDays.map((day, idx) => {
                const row = schoolTimetable.find(t => t.date.replace(/-/g, '/') === day.dateStr.replace(/-/g, '/'))
                const hol = getJapaneseHolidayName(day.dateStr)
                const susp = checkSuspension(day.dateStr)
                const isSun = day.dayOfWeek === 0
                const isSat = day.dayOfWeek === 6

                const morning = formatTimeOnly(row?.morning_trip)
                const t1 = formatTimeOnly(row?.afternoon_trip_1)
                const t2 = formatTimeOnly(row?.afternoon_trip_2)
                const t3 = formatTimeOnly(row?.afternoon_trip_3)
                const label = (row?.calendar_label || '').trim()

                return (
                  <div
                    key={idx}
                    className={`min-h-[85px] md:min-h-[105px] p-2 rounded-2xl border flex flex-col justify-between transition-all ${
                      !day.isCurrentMonth
                        ? 'bg-slate-950/30 border-slate-900/50 opacity-30'
                        : day.isToday
                        ? 'bg-slate-900/90 border-amber-500/80 shadow-md'
                        : hol || isSun || susp.isSuspended
                        ? 'bg-rose-950/15 border-rose-900/30'
                        : 'bg-slate-950/70 border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className={`text-xs font-black ${
                        day.isToday ? 'text-amber-400' : hol || isSun ? 'text-rose-400' : isSat ? 'text-sky-400' : 'text-slate-300'
                      }`}>
                        {day.dayNumber}
                      </span>
                      {hol && (
                        <span className="text-[9px] text-rose-300 truncate max-w-[70%] font-bold">
                          🎌 {hol}
                        </span>
                      )}
                    </div>

                    {label && (
                      <div className="text-[10px] text-emerald-300 font-bold truncate my-0.5">
                        {label}
                      </div>
                    )}
                    {susp.isSuspended && !label && (
                      <div className="text-[10px] text-rose-400 font-bold truncate my-0.5">
                        {susp.name || '運休'}
                      </div>
                    )}

                    {/* 便情報 */}
                    <div className="space-y-0.5 text-[10px] font-mono">
                      {morning && (
                        <div className="text-amber-300 truncate">
                          登校 {morning}
                        </div>
                      )}
                      {t1 && (
                        <div className="text-sky-300 truncate">
                          下校1便 {t1}
                        </div>
                      )}
                      {t2 && (
                        <div className="text-indigo-300 truncate">
                          下校2便 {t2}
                        </div>
                      )}
                      {t3 && (
                        <div className="text-purple-300 truncate">
                          下校3便 {t3}
                        </div>
                      )}
                      {!morning && !t1 && !t2 && !t3 && day.isCurrentMonth && (
                        <div className="text-slate-600 text-[9px]">運行なし</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* フッター */}
            <div className="flex items-center justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsTimetableModalOpen(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
