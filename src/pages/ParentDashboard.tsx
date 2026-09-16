import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { 
  Bus, 
  ChevronLeft, ChevronRight, ChevronDown, RefreshCw, LogOut, CheckCircle2, Ban,
  Plus, UserPlus, AlertCircle, X, Calendar, CalendarDays, Sparkles, Check,
  Lock, Circle
} from 'lucide-react'
import { toSlashDate, toHyphenDate, formatTimeToHHmm, extractBoardingTime, isMonthPublished } from '../lib/spreadsheetApi'
import { RoleSwitcher } from '../components/RoleSwitcher'
import { SchoolTimetableModal } from '../components/SchoolTimetableModal'
import { getJapaneseHolidayName } from '../lib/japaneseHolidays'

export const ParentDashboard: React.FC = () => {
  const navigate = useNavigate()
  const { 
    user, logout, guardianMaster, schedules, 
    basicSettings, schoolTimetable, busStops, 
    saveReservation, saveBatchSchedules, linkStudentWithCode, syncing, refreshAll 
  } = useApp()

  // ログイン保護者のマスターデータ（認証コード・生徒名・メールによる高精度突合）
  const myGuardians = useMemo(() => {
    if (!user) return []
    // 0. user.authCode が指定されている場合、その認証コードを持つ世帯行を最優先
    if (user.authCode) {
      const match = guardianMaster.filter(g => g.auth_code && g.auth_code.trim().toUpperCase() === user.authCode!.trim().toUpperCase())
      if (match.length > 0) return match
    }
    // 1. user.studentName が指定されている場合、その生徒名を含む行を優先
    if (user.studentName) {
      const match = guardianMaster.filter(g => g.student_names.includes(user.studentName!))
      if (match.length > 0) return match
    }
    // 2. user.studentNames がある場合、そのいずれかを含む行
    if (user.studentNames && user.studentNames.length > 0) {
      const match = guardianMaster.filter(g => g.student_names.some(s => user.studentNames!.includes(s)))
      if (match.length > 0) return match
    }
    // 3. user.email が parent_${studentName} の形式の場合
    if (user.email && user.email.startsWith('parent_')) {
      const sName = user.email.replace(/^parent_/, '')
      const match = guardianMaster.filter(g => g.student_names.includes(sName))
      if (match.length > 0) return match
    }
    // 4. 通常のメールアドレス完全一致（空文字でない場合）
    if (user.email && !user.email.startsWith('parent_')) {
      const match = guardianMaster.filter(g => g.parent_email && g.parent_email.toLowerCase() === user.email.toLowerCase())
      if (match.length > 0) return match
    }
    // 5. フォールバック
    return guardianMaster.slice(0, 1)
  }, [user, guardianMaster])

  // 生徒一覧（同一世帯のB列:第1子、C列:第2子を正確に抽出・維持）
  const studentNames = useMemo(() => {
    const list: string[] = []

    // 0. user.studentNames がセッションにある場合（B列、C列順）
    if (user?.studentNames && user.studentNames.length > 0) {
      user.studentNames.forEach(s => {
        if (s && !list.includes(s)) list.push(s)
      })
    }

    // 1. myGuardians の世帯行から B列(student_name_1), C列(student_name_2) を抽出
    myGuardians.forEach(g => {
      const s1 = g.student_name_1 || g.student_names[0]
      const s2 = g.student_name_2 || g.student_names[1]
      if (s1 && !list.includes(s1)) list.push(s1)
      if (s2 && !list.includes(s2)) list.push(s2)
      g.student_names.forEach(s => {
        if (s && !list.includes(s)) list.push(s)
      })
    })

    // 2. user.studentName が指定されているがまだ入っていない場合
    if (user?.studentName && !list.includes(user.studentName)) {
      list.unshift(user.studentName)
    }

    return list
  }, [myGuardians, user])

  // 選択中の生徒
  const [selectedStudent, setSelectedStudent] = useState<string>(() => user?.studentName || '')

  // 選択中生徒に対応する行（バス停・基本設定を正確に反映）
  const myGuardian = useMemo(() => {
    if (!myGuardians.length) return null
    if (selectedStudent) {
      const match = myGuardians.find(g => g.student_names.includes(selectedStudent))
      if (match) return match
    }
    return myGuardians[0]
  }, [myGuardians, selectedStudent])

  // 初期選択の更新
  useEffect(() => {
    if (selectedStudent && studentNames.includes(selectedStudent)) {
      // 既に選択されており、リストに含まれていれば維持
      return
    }
    if (user?.studentName && studentNames.includes(user.studentName)) {
      setSelectedStudent(user.studentName)
    } else if (studentNames.length > 0) {
      setSelectedStudent(studentNames[0])
    }
  }, [studentNames, selectedStudent, user?.studentName])

  // 一括設定コントロールバー用の入力ステート（通常日6時間と5時間授業日の2系統下校指定）
  const [batchMorning, setBatchMorning] = useState<'乗る' | '乗らない'>('乗る')
  const [batchAfternoon6Hour, setBatchAfternoon6Hour] = useState<'1便' | '2便' | '3便' | '乗らない'>('1便')
  const [batchAfternoon5Hour, setBatchAfternoon5Hour] = useState<'1便' | '2便' | '3便' | '乗らない'>('1便')

  // スプレッドシート「基本設定・運休期間」より「5時間授業曜日」を取得（例: ['水']）
  const fiveHourDaysOfWeek = useMemo(() => {
    const setting = basicSettings.find(b => 
      b.setting_name === '5時間授業曜日' || 
      b.setting_name === '基本5時間授業曜日' ||
      b.setting_name.includes('5時間授業曜日')
    )
    if (!setting || !setting.content_time) {
      return ['水']
    }
    const tokens = setting.content_time.split(/[,、\s]+/).filter(Boolean)
    const days: string[] = []
    tokens.forEach(t => {
      const match = t.match(/[月火水木金土日]/)
      if (match) days.push(match[0])
    })
    return days.length > 0 ? days : ['水']
  }, [basicSettings])

  // 各日付が「5時間授業日」かどうかを判定（①曜日の合致 または ②学校時刻表の備考に5時間/短縮が含まれる）
  const isFiveHourDay = (dateSlash: string): boolean => {
    // 1. 学校用時刻表マスタ（schoolTimetable）のその日の備考・行事名に「5時間」または「短縮」が含まれているか
    const timetableRow = schoolTimetable.find(t => t.date === dateSlash)
    if (timetableRow) {
      const text = `${timetableRow.note || ''} ${timetableRow.calendar_label || ''}`
      if (/5時間|短縮/.test(text)) {
        return true
      }
    }

    // 2. その日の曜日がスプレッドシート設定の「5時間授業曜日」に含まれているか
    const parts = dateSlash.split('/')
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
      const dayNames = ['日', '月', '火', '水', '木', '金', '土']
      const dayName = dayNames[d.getDay()]
      if (fiveHourDaysOfWeek.includes(dayName)) {
        return true
      }
    }

    return false
  }

  // 初期値の同期
  useEffect(() => {
    if (myGuardian) {
      if (myGuardian.default_morning === '乗らない') {
        setBatchMorning('乗らない')
      } else {
        setBatchMorning('乗る')
      }

      if (myGuardian.default_afternoon === '2便') {
        setBatchAfternoon6Hour('2便')
      } else if (myGuardian.default_afternoon === '3便') {
        setBatchAfternoon6Hour('3便')
      } else if (myGuardian.default_afternoon === '乗らない') {
        setBatchAfternoon6Hour('乗らない')
      } else {
        setBatchAfternoon6Hour('1便')
      }

      // 5時間日は基本的に1便での下校が標準
      setBatchAfternoon5Hour('1便')
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

  // 本日の運行データ（リアルタイム車内点呼連動）
  const todaySched = useMemo(() => {
    return schedules.find(s => s.date === todayStrSlash && s.student_name === selectedStudent)
  }, [schedules, todayStrSlash, selectedStudent])

  const todayMorningBoarding = todaySched?.morning_boarding || todaySched?.boarded_at
  const todayAfternoonBoarded = todaySched?.boarded_at
  const todayAfternoonAlighted = todaySched?.alighted_at || todaySched?.afternoon_boarding

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

    // 10秒間隔の定期バックグラウンド同期（アクティブ時）
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshAll().then(() => updateTime()).catch(() => {})
      }
    }, 10000)

    // 画面復帰時（アプリに切り替えた時やブラウザタブがアクティブになった時）の自動更新
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshAll().then(() => updateTime()).catch(() => {})
      }
    }
    const handleFocus = () => {
      refreshAll().then(() => updateTime()).catch(() => {})
    }

    // BroadcastChannel によるタブ間リアルタイム同期通知
    let channel: BroadcastChannel | null = null
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel('school_bus_boarding_sync')
        channel.onmessage = (e) => {
          if (e.data && e.data.type === 'BOARDING_UPDATED') {
            updateTime()
          }
        }
      } catch (err) {
        console.warn('BroadcastChannel error:', err)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(interval)
      if (channel) channel.close()
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
    return Array.from(set).sort()
  }, [weekDays])

  // 年月文字列（YYYY/MM）を「YYYY年M」形式に変換するヘルパー
  const formatYearMonthJapanese = (ym: string) => {
    const parts = ym.split('/')
    if (parts.length === 2) {
      return `${parts[0]}年${parseInt(parts[1], 10)}`
    }
    return ym.replace('/', '年')
  }

  // 表示中週の中で、実際に未確定（ロック中）となっている年月一覧
  const unpublishedWeekMonths = useMemo(() => {
    return weekYearMonths.filter(ym => !isMonthPublished(ym, basicSettings))
  }, [weekYearMonths, basicSettings])

  // 週内の全日（月〜金）がすべて確定・公開されているか
  const isWeekAllPublished = useMemo(() => {
    return unpublishedWeekMonths.length === 0
  }, [unpublishedWeekMonths])

  // 未確定アラート用の表示月名（例: 10月のみ未確定なら「2026年10」、両方なら「2026年9・2026年10」）
  const displayUnpublishedMonth = useMemo(() => {
    if (unpublishedWeekMonths.length === 0) return ''
    return unpublishedWeekMonths.map(formatYearMonthJapanese).join('・')
  }, [unpublishedWeekMonths])

  // 主たる年月（週初日の年月）
  const primaryYearMonth = weekYearMonths[0] || ''
  const isPrimaryMonthPublished = isMonthPublished(primaryYearMonth, basicSettings)

  // 週内の確定案内用表示月名（単月なら「2026年9」、月跨ぎなら「2026年9・2026年10」）
  const displayYearMonth = useMemo(() => {
    if (weekYearMonths.length === 0) return ''
    return weekYearMonths.map(formatYearMonthJapanese).join('・')
  }, [weekYearMonths])

  // 対象月（primaryYearMonth）の実運行日一覧（土日・祝日・基本運休・学校休校等を除外し、学校時刻表で運行時刻が設定されている日のみ）
  const targetMonthOperatingDays = useMemo(() => {
    if (!primaryYearMonth) return []

    const parts = primaryYearMonth.split('/')
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    if (isNaN(year) || isNaN(month)) return []

    const lastDay = new Date(year, month + 1, 0).getDate()
    const operatingDays: string[] = []

    for (let day = 1; day <= lastDay; day++) {
      const d = new Date(year, month, day)
      const dayOfWeek = d.getDay()
      // ① 土日は除外
      if (dayOfWeek === 0 || dayOfWeek === 6) continue

      const dateSlash = toSlashDate(d)

      // ② 祝日は除外
      if (getJapaneseHolidayName(dateSlash)) continue

      // ③ 基本設定・運休期間は除外
      if (checkSuspension(dateSlash).isSuspended) continue

      // ④ 学校用時刻表（schoolTimetable）と必ず突合
      const tRow = schoolTimetable.find(t => t.date === dateSlash)
      if (!tRow) continue

      // 備考やカレンダー表示用で「運休」「祝日」「休校」等となっていないか
      const note = tRow.note || ''
      const label = tRow.calendar_label || ''
      if (/運休|祝日|休校/.test(note) || /運休|祝日|休校/.test(label)) {
        continue
      }

      // 「登校便」または「下校便」の運行時刻が設定されているか
      const morningTime = formatTimeToHHmm(tRow.morning_trip)
      const trip1Time = formatTimeToHHmm(tRow.afternoon_trip_1)
      const trip2Time = formatTimeToHHmm(tRow.afternoon_trip_2)
      const trip3Time = formatTimeToHHmm(tRow.afternoon_trip_3)

      if (!morningTime && !trip1Time && !trip2Time && !trip3Time) {
        continue
      }

      operatingDays.push(dateSlash)
    }

    return operatingDays
  }, [primaryYearMonth, schoolTimetable, basicSettings])

  // 対象月の実運行日すべてに予約が保存されているか（予約完了判定）
  const isAllReservedForMonth = useMemo(() => {
    if (!selectedStudent || targetMonthOperatingDays.length === 0) return false

    return targetMonthOperatingDays.every(dateSlash => {
      const sched = schedules.find(s => s.date === dateSlash && s.student_name === selectedStudent)
      if (!sched) return false
      // 登校（乗る/乗らない）または下校（1便/2便/3便/乗らない）の意思表示が保存されていること
      const hasMorning = !!sched.morning_status
      const hasAfternoon = !!sched.afternoon_status || !!sched.afternoon_trip_1 || !!sched.afternoon_trip_2 || !!sched.afternoon_trip_3
      return hasMorning || hasAfternoon
    })
  }, [selectedStudent, targetMonthOperatingDays, schedules])

  // 学校時刻表 閲覧モーダル用状態
  const [isTimetableModalOpen, setIsTimetableModalOpen] = useState(false)

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

  // 今月分モーダルのトリガー（実運行日と突合）
  const openMonthConfirmModal = () => {
    if (targetMonthOperatingDays.length === 0) {
      alert(`${displayYearMonth}月に運行予定の平日がありません（すべて運休または非平日）`)
      return
    }

    setConfirmModal({
      isOpen: true,
      mode: 'month',
      title: `${displayYearMonth}月分（実運行平日）の予約を一括反映しますか？`,
      startDate: targetMonthOperatingDays[0],
      endDate: targetMonthOperatingDays[targetMonthOperatingDays.length - 1],
      targetCount: targetMonthOperatingDays.length,
      targetDates: targetMonthOperatingDays
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
        const t3Time = formatTimeToHHmm(timetableRow?.afternoon_trip_3) || '17:00'

        // 5時間授業日判定による下校便の自動振り分け
        const is5Hour = isFiveHourDay(dateSlash)
        const targetChoice = is5Hour ? batchAfternoon5Hour : batchAfternoon6Hour

        let aftStatus = ''
        let trip1 = ''
        let trip2 = ''
        let trip3 = ''

        if (targetChoice === '乗らない') {
          aftStatus = '乗らない'
        } else if (targetChoice === '1便') {
          trip1 = t1Time
        } else if (targetChoice === '2便') {
          trip2 = t2Time
        } else if (targetChoice === '3便') {
          trip3 = t3Time
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
          parent_email: myGuardian?.parent_email || user.email
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
        parent_email: myGuardian?.parent_email || user.email
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 max-w-5xl mx-auto">
      {/* 上部ヘッダー */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-3.5 sm:p-4 md:p-5 shadow-xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 sm:p-3 bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 rounded-2xl shadow-md shrink-0">
            <Bus className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-black text-white whitespace-nowrap tracking-tight">
              保護者マイページ
            </h1>
            {/* 保護者情報（登校行は削除し登録バス停のみをコンパクト表示） */}
            <div className="mt-0.5 space-y-0.5">
              <div className="text-xs font-bold text-slate-200 truncate">
                {(user?.name && user.name !== user.email) ? user.name : (user?.email || '保護者')} 様
              </div>
              <div className="text-xs text-slate-400 truncate">
                <span>登録バス停: <strong className="text-amber-400 font-bold">{myGuardian?.bus_stop_name || '未設定'}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* 操作ボタン群（モバイル: 2行構成で文字縦折れ完全防止 / PC: 横一列配置） */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80 shrink-0">
          {/* 上段（モバイル）: ロール切替 ＆ ログアウト */}
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <RoleSwitcher />
            <button
              type="button"
              onClick={() => {
                logout()
                navigate('/login')
              }}
              className="px-3 py-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap shadow-sm cursor-pointer shrink-0"
              title="ログアウト（お試しロール選択へ戻る）"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span>ログアウト</span>
            </button>
          </div>

          {/* 下段（モバイル）: 📅 月別カレンダー ＆ 同期 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTimetableModalOpen(true)}
              className="flex-1 sm:flex-initial px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-300 hover:text-sky-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap shadow-sm cursor-pointer shrink-0"
              title="学校の月間時刻表を確認（月別カレンダー）"
            >
              <span>📅 月別カレンダー</span>
            </button>
            <button
              type="button"
              onClick={() => refreshAll()}
              disabled={syncing}
              className="px-3 py-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap shadow-sm cursor-pointer shrink-0"
              title="最新データを再取得"
            >
              <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${syncing ? 'animate-spin text-amber-400' : ''}`} />
              <span>{syncing ? '更新中' : '同期'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 生徒切り替えタブ（同一世帯の第1子(B列)・第2子(C列)兄弟管理 ＆ コード追加） */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-3 sm:p-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <div className="text-xs font-black text-slate-400 flex items-center gap-1.5 shrink-0 mr-1">
              <span>対象のお子様:</span>
            </div>
            {studentNames.map((name, idx) => {
              const isSelected = selectedStudent === name
              const icon = idx === 0 ? '👦' : idx === 1 ? '👧' : '🧒'
              const label = studentNames.length > 1
                ? `第${idx + 1}子: ${name}`
                : `${name} さん`

              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedStudent(name)}
                  className={`px-4 sm:px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-amber-500/25 ring-2 ring-amber-300 scale-100'
                      : 'bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="text-base leading-none">{icon}</span>
                  <span>{label}</span>
                  {isSelected && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-950/30 text-slate-950 rounded-full font-bold">
                      選択中
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* ＋ お子様を追加（兄弟姉妹）ボタン */}
          <button
            type="button"
            onClick={() => {
              setSiblingError(null)
              setSiblingSuccess(null)
              setSiblingCode('')
              setIsAddSiblingModalOpen(true)
            }}
            className="px-3.5 py-2 bg-slate-950 hover:bg-slate-850 border border-dashed border-amber-500/50 hover:border-amber-400 text-amber-300 hover:text-amber-200 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap shadow-sm shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 text-amber-400" />
            <span>お子様を追加（コード入力）</span>
          </button>
        </div>
      </div>

      {/* 🚌 本日の運行・乗車ステータスカード（車内点呼リアルタイム即時反映） */}
      {selectedStudent && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/30 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <Bus className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-1.5 flex-wrap">
                  <span>{selectedStudent} さんの本日の運行状況</span>
                  <span className="text-xs font-normal text-slate-400 font-mono">（{todayStrSlash}）</span>
                </h3>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
              点呼リアルタイム連動
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* 登校便 */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-3 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 shrink-0">
                🌅 登校便:
              </span>
              {todayMorningBoarding ? (
                <span className="text-xs sm:text-sm font-black text-emerald-300 bg-emerald-500/20 border border-emerald-400/50 px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ✅ {extractBoardingTime(todayMorningBoarding) ? `${extractBoardingTime(todayMorningBoarding)} 乗車完了` : '乗車完了'}
                </span>
              ) : todaySched?.morning_status === '乗る' || (!todaySched && myGuardian?.default_morning === '乗る') ? (
                <span className="text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-xl flex items-center gap-1.5 shrink-0">
                  <Circle className="h-3.5 w-3.5 text-slate-400" />
                  乗車待ち
                </span>
              ) : (
                <span className="text-xs text-slate-500 font-bold">乗車予定なし</span>
              )}
            </div>

            {/* 下校便 */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-3 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 shrink-0">
                🚌 下校便:
              </span>
              {todayAfternoonAlighted ? (
                <span className="text-xs sm:text-sm font-black text-emerald-300 bg-emerald-500/20 border border-emerald-400/50 px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  🏁 {extractBoardingTime(todayAfternoonAlighted) ? `${extractBoardingTime(todayAfternoonAlighted)} 降車完了（バス停に到着しました）` : '降車完了（バス停に到着しました）'}
                </span>
              ) : todayAfternoonBoarded ? (
                <span className="text-xs sm:text-sm font-black text-sky-300 bg-sky-500/20 border border-sky-400/50 px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-sm">
                  <CheckCircle2 className="h-4 w-4 text-sky-400 shrink-0" />
                  ✅ {extractBoardingTime(todayAfternoonBoarded) ? `${extractBoardingTime(todayAfternoonBoarded)} 乗車完了（学校を出発しました）` : '乗車完了（学校を出発しました）'}
                </span>
              ) : (todaySched?.afternoon_status !== '乗らない' && (todaySched?.afternoon_trip_1 || todaySched?.afternoon_trip_2 || todaySched?.afternoon_trip_3)) || (!todaySched && myGuardian?.default_afternoon && myGuardian.default_afternoon !== '乗らない') ? (
                <span className="text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-xl flex items-center gap-1.5 shrink-0">
                  <Circle className="h-3.5 w-3.5 text-slate-400" />
                  乗車待ち
                </span>
              ) : (
                <span className="text-xs text-slate-500 font-bold">乗車予定なし</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 📢 確定・公開ステータス通知エリア */}
      <div>
        {isWeekAllPublished ? (
          <div className={`p-4 rounded-3xl border shadow-xl animate-in fade-in transition-all ${
            isAllReservedForMonth
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200 shadow-emerald-950/20'
              : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200 shadow-emerald-950/10'
          }`}>
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className={`p-2.5 rounded-2xl shrink-0 ${
                isAllReservedForMonth ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {isAllReservedForMonth ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black flex items-center gap-2 flex-wrap">
                  <span className="text-emerald-300">時刻表確定済</span>
                  {isAllReservedForMonth ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      予約完了
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40">
                      次の月の予約を行ってください
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold text-slate-200 mt-1 leading-relaxed">
                  {isAllReservedForMonth ? (
                    <span>✅ 予約完了しました。変更のある場合は当日7:00までに変更してください。</span>
                  ) : (
                    <span>📢 {displayYearMonth}月分のバス時刻表が確定しました。予約を入力・確定してください。</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-3xl text-amber-200 shadow-xl shadow-amber-950/20 animate-in fade-in">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl shrink-0">
                <AlertCircle className="h-5 w-5 text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-amber-300 flex items-center gap-2">
                  <span>時刻表調整中</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                    予約入力ロック中
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-200 mt-1 leading-relaxed">
                  ⚠️ {displayUnpublishedMonth}月分のバス時刻表は現在学校で調整中です。時刻表が確定するまで予約の入力・変更はできません。
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

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
                自動判別（登校:{batchMorning} / 通常下校:{batchAfternoon6Hour} / 5時間日下校:{batchAfternoon5Hour}）
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

            <div className="space-y-4">
              {/* 基本設定入力UI：登校、通常日下校、5時間日下校 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* ① 登校便 */}
                <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">① 登校便</span>
                    <span className="text-[10px] text-amber-400/90 font-medium">全運行日共通</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setBatchMorning('乗る')}
                      className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
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
                      className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                        batchMorning === '乗らない'
                          ? 'bg-slate-800 text-slate-200 shadow'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      乗らない
                    </button>
                  </div>
                </div>

                {/* ② 6時間授業（通常日）の下校便 */}
                <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">② 通常日（6時間）下校</span>
                    <span className="text-[10px] text-sky-400/90 font-medium">月・火・木・金など</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800/80">
                    {(['1便', '2便', '3便', '乗らない'] as const).map(choice => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => setBatchAfternoon6Hour(choice)}
                        className={`min-h-[40px] px-1 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap text-center ${
                          batchAfternoon6Hour === choice
                            ? choice === '乗らない'
                              ? 'bg-slate-800 text-slate-200 shadow'
                              : 'bg-sky-500 text-slate-950 shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ③ 5時間授業日の下校便 */}
                <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">③ 5時間授業日の下校</span>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      {fiveHourDaysOfWeek.join('・')}曜/短縮日
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800/80">
                    {(['1便', '2便', '3便', '乗らない'] as const).map(choice => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => setBatchAfternoon5Hour(choice)}
                        className={`min-h-[40px] px-1 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap text-center ${
                          batchAfternoon5Hour === choice
                            ? choice === '乗らない'
                              ? 'bg-slate-800 text-slate-200 shadow'
                              : 'bg-emerald-500 text-slate-950 shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 反映ボタン群 */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
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
                <div className="text-right">
                  <span className="text-[10px] text-amber-400/90 font-bold inline-flex items-center gap-1">
                    <Lock className="h-3 w-3" /> 時刻表未確定のため一括反映はロック中
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 週間カレンダーコントロールバー ＆ リアルタイム同期表示 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-3xl p-3.5 sm:p-4 shadow-xl">
        {/* 3分割均等ナビゲーション */}
        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset(prev => prev - 1)}
            className="min-h-[40px] sm:min-h-[44px] px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1 text-xs font-black active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            <span>前週</span>
          </button>
          
          {weekOffset !== 0 ? (
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="min-h-[40px] sm:min-h-[44px] px-3 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 rounded-2xl text-xs font-black transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap"
            >
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>今週</span>
            </button>
          ) : (
            <span className="min-h-[40px] sm:min-h-[44px] px-3 py-2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-2xl text-xs font-black flex items-center justify-center gap-1 whitespace-nowrap">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>今週</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => setWeekOffset(prev => prev + 1)}
            className="min-h-[40px] sm:min-h-[44px] px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1 text-xs font-black active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <span>次週</span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </button>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
          <span className="font-mono font-black text-white text-xs sm:text-sm whitespace-nowrap">
            {weekDays[0]?.dateStrSlash} 〜 {weekDays[4]?.dateStrSlash}
          </span>
          {lastSyncedTime && (
            <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 whitespace-nowrap">
              <RefreshCw className={`h-2.5 w-2.5 shrink-0 ${syncing ? 'animate-spin text-amber-400' : 'text-emerald-400'}`} />
              <span>最終同期: {lastSyncedTime}</span>
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
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1 shrink-0">
                      🌅 登校:
                    </span>
                    {morningVal === '乗る' ? (
                      morningBoarding ? (
                        <span className="text-xs sm:text-sm font-black text-emerald-300 bg-emerald-500/20 border border-emerald-400/50 px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-sm ring-1 ring-emerald-500/30">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          {extractBoardingTime(morningBoarding) ? `✅ ${extractBoardingTime(morningBoarding)} 乗車完了` : '✅ 乗車完了'}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-slate-300 bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-xl flex items-center gap-1.5 shrink-0">
                          <Circle className="h-3.5 w-3.5 text-slate-400" />
                          乗車待ち
                        </span>
                      )
                    ) : (
                      <span className="text-[11px] text-slate-500 font-bold">乗車予定なし</span>
                    )}
                  </div>

                  {/* 下校便ステータス */}
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1 shrink-0">
                      🚌 下校 ({afternoonVal}):
                    </span>
                    {afternoonVal !== '乗らない' ? (
                      afternoonBoarding ? (
                        <span className="text-xs sm:text-sm font-black text-emerald-300 bg-emerald-500/20 border border-emerald-400/50 px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-sm ring-1 ring-emerald-500/30">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          {extractBoardingTime(afternoonBoarding) ? `✅ ${extractBoardingTime(afternoonBoarding)} 降車完了` : '✅ 降車完了'}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-slate-300 bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-xl flex items-center gap-1.5 shrink-0">
                          <Circle className="h-3.5 w-3.5 text-slate-400" />
                          乗車待ち
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
                        <span>登校乗車記録: {extractBoardingTime(morningBoarding) || morningBoarding}</span>
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
                        <span>下校降車記録: {extractBoardingTime(afternoonBoarding) || afternoonBoarding}</span>
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
                <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1 text-slate-300">
                  <span className="text-slate-500 text-xs">反映する内容:</span>
                  <div className="font-bold text-xs space-y-1 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <div className="text-amber-300">・登校便: {batchMorning}</div>
                    <div className="text-sky-300">・通常日（6時間）下校: {batchAfternoon6Hour === '乗らない' ? '乗らない' : `下校${batchAfternoon6Hour}`}</div>
                    <div className="text-emerald-300">・5時間授業日（{fiveHourDaysOfWeek.join('・')}曜/短縮日）下校: {batchAfternoon5Hour === '乗らない' ? '乗らない' : `下校${batchAfternoon5Hour}`}</div>
                  </div>
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
      {/* 学校運行時刻表モーダル（スマホ対応縦型タイムライン ＆ PC月間カレンダー） */}
      <SchoolTimetableModal
        isOpen={isTimetableModalOpen}
        onClose={() => setIsTimetableModalOpen(false)}
        schoolTimetable={schoolTimetable}
        basicSettings={basicSettings}
      />
    </div>
  )
}
