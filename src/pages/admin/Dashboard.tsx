import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { Student, BusStop, SchoolHoliday, BasicSettingPeriodRow } from '../../types/app'
import { ExportAndPrintModal } from '../../components/admin/ExportAndPrintModal'
import { SystemMaintenanceTab } from '../../components/admin/SystemMaintenanceTab'
import { saveGuardianMaster, fetchAllMasterFromGAS } from '../../lib/api/gas'
import { defaultBasicSettings } from '../../lib/mockData'
import { 
  LogOut, Shield, Bus, Users, 
  Calendar as CalendarIcon, Clock, AlertCircle, CheckCircle2, 
  Search, RefreshCw, AlertTriangle, Activity, 
  Plus, Edit2, Trash2, ArrowUp, ArrowDown, Save, 
  Check, X, MapPin, Ban, Sparkles, Settings2,
  ChevronLeft, ChevronRight, Sun, Snowflake, Palmtree, Zap, Sunrise, Copy, RotateCcw,
  KeyRound, FileSpreadsheet, Printer
} from 'lucide-react'

type AdminTab = 'monitoring' | 'calendar' | 'schedules' | 'holidays' | 'students' | 'routes' | 'system'
type ScheduleSubTab = 'regular' | 'shortened'

// 日本の学事暦順（4月〜翌年3月）
const ACADEMIC_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]

// 曜日選択肢の定義
const SHORTENED_DAY_OPTIONS = [
  { value: 1, label: '月曜日' },
  { value: 2, label: '火曜日' },
  { value: 3, label: '水曜日' },
  { value: 4, label: '木曜日' },
  { value: 5, label: '金曜日' },
  { value: 'none', label: '適用なし' }
]

const WEEKDAY_NAMES_MAP: Record<number, string> = {
  1: '月曜日',
  2: '火曜日',
  3: '水曜日',
  4: '木曜日',
  5: '金曜日'
}

export const AdminDashboard: React.FC = () => {
  const { 
    user, profile, signOut, 
    busRoutes, busStops, students, 
    reservations, busOperations, rideStatuses, 
    monthlyTripSchedules, specialTripSchedules, schoolHolidays,
    basicSettings, refreshBasicSettings, updateBasicSetting,
    getDateScheduleStatus, getTripTime, getAdjustedStopArrivalTime, isTripOperating, 
    updateMonthlyTripSchedule, resetMonthlyTripSchedulesToDefault, copySchoolHolidaysToNextYear,
    saveSpecialTripSchedule, deleteSpecialTripSchedule,
    addSchoolHoliday, updateSchoolHoliday, deleteSchoolHoliday,
    addStudent, updateStudent, deleteStudent,
    addBusStop, updateBusStop, deleteBusStop, reorderBusStops,
    refreshData 
  } = useAuth()

  // 基本設定・運休期間のGAS再取得状態
  const [isSyncingBasicSettings, setIsSyncingBasicSettings] = useState(false)
  const handleRefreshBasicSettings = async () => {
    setIsSyncingBasicSettings(true)
    try {
      await refreshBasicSettings()
    } finally {
      setIsSyncingBasicSettings(false)
    }
  }

  // 基本設定・運休期間の即時自動保存状態（行キー単位）
  const [savingRowKeys, setSavingRowKeys] = useState<Record<string, boolean>>({})
  const [savedRowKeys, setSavedRowKeys] = useState<Record<string, boolean>>({})
  // 入力途中のドラフト（テキスト項目・日付項目用）
  const [basicSettingDrafts, setBasicSettingDrafts] = useState<Record<string, {
    start_date?: string
    end_date?: string
    standard_operation?: string
    content_time?: string
    note?: string
  }>>({})

  const handleBasicSettingDraftChange = (settingName: string, field: string, value: string) => {
    setBasicSettingDrafts(prev => ({
      ...prev,
      [settingName]: {
        ...(prev[settingName] || {}),
        [field]: value
      }
    }))
  }

  const handleAutoSaveBasicSetting = async (
    settingName: string,
    field: 'start_date' | 'end_date' | 'standard_operation' | 'content_time' | 'note',
    value: string
  ) => {
    const row = basicSettings.find(b => (b.setting_name || b['設定名']) === settingName)
    const draft = basicSettingDrafts[settingName] || {}

    const startDate = field === 'start_date' ? value : (draft.start_date !== undefined ? draft.start_date : (row?.start_date || row?.['開始日'] || ''))
    const endDate = field === 'end_date' ? value : (draft.end_date !== undefined ? draft.end_date : (row?.end_date || row?.['終了日'] || ''))
    const standardOperation = field === 'standard_operation' ? value : (draft.standard_operation !== undefined ? draft.standard_operation : (row?.standard_operation || row?.['標準運行'] || ''))
    const contentTime = field === 'content_time' ? value : (draft.content_time !== undefined ? draft.content_time : (row?.content_time || row?.['内容・時刻'] || ''))
    const note = field === 'note' ? value : (draft.note !== undefined ? draft.note : (row?.note || row?.['備考'] || ''))

    // 現在値と比較して変化がなければスキップ
    const origVal = row ? (
      field === 'start_date' ? (row.start_date || row['開始日'] || '') :
      field === 'end_date' ? (row.end_date || row['終了日'] || '') :
      field === 'standard_operation' ? (row.standard_operation || row['標準運行'] || '') :
      field === 'content_time' ? (row.content_time || row['内容・時刻'] || '') :
      (row.note || row['備考'] || '')
    ) : ''

    if (origVal === value && draft[field] === undefined) {
      return
    }

    setSavingRowKeys(prev => ({ ...prev, [settingName]: true }))
    setSavedRowKeys(prev => ({ ...prev, [settingName]: false }))

    try {
      const res = await updateBasicSetting({
        setting_name: settingName,
        start_date: startDate,
        end_date: endDate,
        standard_operation: standardOperation,
        content_time: contentTime,
        note: note
      })

      if (res.success) {
        setSavedRowKeys(prev => ({ ...prev, [settingName]: true }))
        setTimeout(() => {
          setSavedRowKeys(prev => ({ ...prev, [settingName]: false }))
        }, 3000)
      } else {
        alert(`保存に失敗しました: ${res.error || res.message}`)
      }
    } catch (err: any) {
      alert(`保存エラー: ${err.message || '通信に失敗しました'}`)
    } finally {
      setSavingRowKeys(prev => ({ ...prev, [settingName]: false }))
    }
  }

  // 1. タブ管理
  const [activeTab, setActiveTab] = useState<AdminTab>('monitoring')

  // 基本設定・運休期間タブ表示時に常にスプレッドシートから最新データを直接フェッチ
  useEffect(() => {
    if (activeTab === 'holidays') {
      refreshBasicSettings()
    }
  }, [activeTab])

  // 2. 運行モニタリング用状態
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [selectedTrip, setSelectedTrip] = useState<string>('登校便')
  const [monitorSearchQuery, setMonitorSearchQuery] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'absent' | 'pending'>('all')

  // 選択日の運行状態
  const dateScheduleStatus = getDateScheduleStatus(selectedDate)
  const selectedDateObj = new Date(`${selectedDate}T00:00:00`)
  const dayOfWeek = selectedDateObj.getDay()
  const weekdaysJa = ['日', '月', '火', '水', '木', '金', '土']
  const dayOfWeekLabel = weekdaysJa[dayOfWeek] || ''

  // 3. カレンダービュー用状態（Googleカレンダー風）
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear())
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth()) // 0-11
  const [isSpecialModalOpen, setIsSpecialModalOpen] = useState<boolean>(false)
  const [editingSpecialDate, setEditingSpecialDate] = useState<string>('')
  const [specialForm, setSpecialForm] = useState({
    is_temporary_operation: false,
    is_all_day_suspended: false,
    is_morning_suspended: false,
    is_afternoon_suspended: false,
    morning_trip_time: '',
    trip_1_time: '',
    trip_2_time: '',
    trip_3_time: '',
    trip_4_time: '',
    trip_5_time: '',
    note: ''
  })
  const [specialSaveSuccess, setSpecialSaveSuccess] = useState(false)

  // 3-2. 緊急運休・一括告知モーダル用状態
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState<boolean>(false)
  const [emergencyForm, setEmergencyForm] = useState({
    targetRange: 'today', // 'today' | 'tomorrow' | 'custom'
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    suspensionType: 'all', // 'all': 全便運休, 'morning': 登校便のみ運休, 'afternoon': 下校便のみ運休
    reason: '大雨警報発令のため臨時休校・全便運休'
  })
  const [isSavingEmergency, setIsSavingEmergency] = useState<boolean>(false)

  // 3-3. 乗車実績CSV＆A4名簿印刷モーダル状態
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false)
  const [exportModalDate, setExportModalDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [exportModalTrip, setExportModalTrip] = useState<string>('登校便')

  // 緊急一括運休の登録ハンドラ
  const handleSaveEmergencySuspension = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!emergencyForm.reason.trim()) {
      alert('運休理由・緊急連絡事項を入力してください。')
      return
    }

    let sDate = emergencyForm.startDate
    let eDate = emergencyForm.endDate
    if (emergencyForm.targetRange === 'today') {
      sDate = new Date().toISOString().split('T')[0]
      eDate = sDate
    } else if (emergencyForm.targetRange === 'tomorrow') {
      const tom = new Date()
      tom.setDate(tom.getDate() + 1)
      sDate = tom.toISOString().split('T')[0]
      eDate = sDate
    }

    const typeLabel = emergencyForm.suspensionType === 'all' 
      ? '全便運休' 
      : emergencyForm.suspensionType === 'morning' 
        ? '登校便のみ運休' 
        : '下校便のみ運休'

    const confirmMsg = `${sDate}${sDate !== eDate ? ` 〜 ${eDate}` : ''} の運行を【${typeLabel}】として緊急登録しますか？\n理由: ${emergencyForm.reason}`
    if (!window.confirm(confirmMsg)) return

    setIsSavingEmergency(true)
    try {
      const dates: string[] = []
      const cur = new Date(`${sDate}T00:00:00`)
      const end = new Date(`${eDate}T00:00:00`)
      while (cur <= end) {
        const y = cur.getFullYear()
        const m = String(cur.getMonth() + 1).padStart(2, '0')
        const d = String(cur.getDate()).padStart(2, '0')
        dates.push(`${y}-${m}-${d}`)
        cur.setDate(cur.getDate() + 1)
      }

      for (const dStr of dates) {
        await saveSpecialTripSchedule({
          date: dStr,
          is_temporary_operation: false,
          is_all_day_suspended: emergencyForm.suspensionType === 'all',
          is_morning_suspended: emergencyForm.suspensionType === 'all' || emergencyForm.suspensionType === 'morning',
          is_afternoon_suspended: emergencyForm.suspensionType === 'all' || emergencyForm.suspensionType === 'afternoon',
          morning_trip_time: null,
          trip_1_time: null,
          trip_2_time: null,
          trip_3_time: null,
          trip_4_time: null,
          trip_5_time: null,
          note: `【緊急運休】${emergencyForm.reason.trim()}`
        })
      }

      alert('緊急運休・連絡を登録しました。保護者・ドライバー画面へ即時反映されます。')
      setIsEmergencyModalOpen(false)
    } catch (err) {
      console.error('Failed to save emergency suspension:', err)
      alert('緊急運休の登録に失敗しました。')
    } finally {
      setIsSavingEmergency(false)
    }
  }

  // クイック運行区分プリセットの適用
  const applySpecialPreset = (type: 'all_suspended' | 'morning_suspended' | 'afternoon_suspended' | 'temporary' | 'regular') => {
    const defMonth = parseInt(editingSpecialDate.split('-')[1], 10)
    const defSch = monthlyTripSchedules.find(s => s.month === defMonth)
    const dObj = new Date(`${editingSpecialDate}T00:00:00`)
    const isShort = dObj.getDay() === (defSch?.shortened_day_of_week ?? 3)

    if (type === 'all_suspended') {
      setSpecialForm(prev => ({
        ...prev,
        is_temporary_operation: false,
        is_all_day_suspended: true,
        is_morning_suspended: true,
        is_afternoon_suspended: true,
        note: prev.note || '悪天候・警報発令による全便運休'
      }))
    } else if (type === 'morning_suspended') {
      setSpecialForm(prev => ({
        ...prev,
        is_temporary_operation: false,
        is_all_day_suspended: false,
        is_morning_suspended: true,
        is_afternoon_suspended: false,
        note: prev.note || '登校便のみ運休（午後から授業）'
      }))
    } else if (type === 'afternoon_suspended') {
      setSpecialForm(prev => ({
        ...prev,
        is_temporary_operation: false,
        is_all_day_suspended: false,
        is_morning_suspended: false,
        is_afternoon_suspended: true,
        note: prev.note || '下校便のみ運休（午前中授業・保護者引取）'
      }))
    } else if (type === 'temporary') {
      setSpecialForm(prev => ({
        ...prev,
        is_temporary_operation: true,
        is_all_day_suspended: false,
        is_morning_suspended: false,
        is_afternoon_suspended: false,
        morning_trip_time: defSch?.morning_trip_time ? defSch.morning_trip_time.substring(0, 5) : '07:30',
        trip_1_time: isShort 
          ? (defSch?.wed_trip_1_time ? defSch.wed_trip_1_time.substring(0, 5) : '14:00')
          : (defSch?.trip_1_time ? defSch.trip_1_time.substring(0, 5) : '15:00'),
        trip_2_time: isShort 
          ? (defSch?.wed_trip_2_time ? defSch.wed_trip_2_time.substring(0, 5) : '15:00')
          : (defSch?.trip_2_time ? defSch.trip_2_time.substring(0, 5) : '16:00'),
        note: prev.note || '臨時運行日（行事・登校日）'
      }))
    } else if (type === 'regular') {
      setSpecialForm({
        is_temporary_operation: false,
        is_all_day_suspended: false,
        is_morning_suspended: false,
        is_afternoon_suspended: false,
        morning_trip_time: defSch?.morning_trip_time ? defSch.morning_trip_time.substring(0, 5) : '07:30',
        trip_1_time: isShort 
          ? (defSch?.wed_trip_1_time ? defSch.wed_trip_1_time.substring(0, 5) : '14:00')
          : (defSch?.trip_1_time ? defSch.trip_1_time.substring(0, 5) : '15:00'),
        trip_2_time: isShort 
          ? (defSch?.wed_trip_2_time ? defSch.wed_trip_2_time.substring(0, 5) : '15:00')
          : (defSch?.trip_2_time ? defSch.trip_2_time.substring(0, 5) : '16:00'),
        trip_3_time: isShort 
          ? (defSch?.wed_trip_3_time ? defSch.wed_trip_3_time.substring(0, 5) : '16:00')
          : (defSch?.trip_3_time ? defSch.trip_3_time.substring(0, 5) : '17:00'),
        trip_4_time: isShort 
          ? (defSch?.wed_trip_4_time ? defSch.wed_trip_4_time.substring(0, 5) : '17:00')
          : (defSch?.trip_4_time ? defSch.trip_4_time.substring(0, 5) : '18:00'),
        trip_5_time: isShort 
          ? (defSch?.wed_trip_5_time ? defSch.wed_trip_5_time.substring(0, 5) : '')
          : (defSch?.trip_5_time ? defSch.trip_5_time.substring(0, 5) : ''),
        note: ''
      })
    }
  }

  // カレンダー日付クリックで特定日・臨時運行モーダルを開く
  const handleOpenSpecialModal = (dateStr: string) => {
    setEditingSpecialDate(dateStr)
    const existing = specialTripSchedules.find(s => s.date === dateStr)
    const defMonth = parseInt(dateStr.split('-')[1], 10)
    const defSch = monthlyTripSchedules.find(s => s.month === defMonth)
    const dObj = new Date(`${dateStr}T00:00:00`)
    const isWeekEnd = dObj.getDay() === 0 || dObj.getDay() === 6

    if (existing) {
      setSpecialForm({
        is_temporary_operation: existing.is_temporary_operation ?? false,
        is_all_day_suspended: existing.is_all_day_suspended ?? false,
        is_morning_suspended: existing.is_morning_suspended ?? false,
        is_afternoon_suspended: existing.is_afternoon_suspended ?? false,
        morning_trip_time: existing.morning_trip_time ? existing.morning_trip_time.substring(0, 5) : '',
        trip_1_time: existing.trip_1_time ? existing.trip_1_time.substring(0, 5) : '',
        trip_2_time: existing.trip_2_time ? existing.trip_2_time.substring(0, 5) : '',
        trip_3_time: existing.trip_3_time ? existing.trip_3_time.substring(0, 5) : '',
        trip_4_time: existing.trip_4_time ? existing.trip_4_time.substring(0, 5) : '',
        trip_5_time: existing.trip_5_time ? existing.trip_5_time.substring(0, 5) : '',
        note: existing.note || ''
      })
    } else {
      const isShort = dObj.getDay() === (defSch?.shortened_day_of_week ?? 3)
      setSpecialForm({
        is_temporary_operation: isWeekEnd,
        is_all_day_suspended: false,
        is_morning_suspended: false,
        is_afternoon_suspended: false,
        morning_trip_time: defSch?.morning_trip_time ? defSch.morning_trip_time.substring(0, 5) : '07:30',
        trip_1_time: isShort 
          ? (defSch?.wed_trip_1_time ? defSch.wed_trip_1_time.substring(0, 5) : '14:00')
          : (defSch?.trip_1_time ? defSch.trip_1_time.substring(0, 5) : '15:00'),
        trip_2_time: isShort 
          ? (defSch?.wed_trip_2_time ? defSch.wed_trip_2_time.substring(0, 5) : '15:00')
          : (defSch?.trip_2_time ? defSch.trip_2_time.substring(0, 5) : '16:00'),
        trip_3_time: isShort 
          ? (defSch?.wed_trip_3_time ? defSch.wed_trip_3_time.substring(0, 5) : '16:00')
          : (defSch?.trip_3_time ? defSch.trip_3_time.substring(0, 5) : '17:00'),
        trip_4_time: isShort 
          ? (defSch?.wed_trip_4_time ? defSch.wed_trip_4_time.substring(0, 5) : '17:00')
          : (defSch?.trip_4_time ? defSch.trip_4_time.substring(0, 5) : '18:00'),
        trip_5_time: isShort 
          ? (defSch?.wed_trip_5_time ? defSch.wed_trip_5_time.substring(0, 5) : '')
          : (defSch?.trip_5_time ? defSch.trip_5_time.substring(0, 5) : ''),
        note: isWeekEnd ? '臨時運行（行事・登校日）' : ''
      })
    }
    setIsSpecialModalOpen(true)
  }

  // 特定日・臨時運行ダイヤの保存
  const handleSaveSpecialSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    const success = await saveSpecialTripSchedule({
      date: editingSpecialDate,
      is_temporary_operation: specialForm.is_temporary_operation,
      is_all_day_suspended: specialForm.is_all_day_suspended,
      is_morning_suspended: specialForm.is_morning_suspended,
      is_afternoon_suspended: specialForm.is_afternoon_suspended,
      morning_trip_time: specialForm.morning_trip_time.trim() ? `${specialForm.morning_trip_time}:00` : null,
      trip_1_time: specialForm.trip_1_time.trim() ? `${specialForm.trip_1_time}:00` : null,
      trip_2_time: specialForm.trip_2_time.trim() ? `${specialForm.trip_2_time}:00` : null,
      trip_3_time: specialForm.trip_3_time.trim() ? `${specialForm.trip_3_time}:00` : null,
      trip_4_time: specialForm.trip_4_time.trim() ? `${specialForm.trip_4_time}:00` : null,
      trip_5_time: specialForm.trip_5_time.trim() ? `${specialForm.trip_5_time}:00` : null,
      note: specialForm.note.trim() || (specialForm.is_temporary_operation ? '臨時運行日' : null)
    })
    if (success) {
      setSpecialSaveSuccess(true)
      setTimeout(() => {
        setSpecialSaveSuccess(false)
        setIsSpecialModalOpen(false)
      }, 1000)
    }
  }

  // 特定日ダイヤの解除（削除して通常ダイヤへ復元）
  const handleDeleteSpecialSchedule = async () => {
    if (window.confirm(`${editingSpecialDate} の個別・臨時運行設定を解除し、通常判定に戻しますか？`)) {
      await deleteSpecialTripSchedule(editingSpecialDate)
      setIsSpecialModalOpen(false)
    }
  }

  // 4. 長期休業・学校閉庁日管理用状態
  const [selectedHolidayYearFilter, setSelectedHolidayYearFilter] = useState<string>('all')
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<SchoolHoliday | null>(null)
  const [deletingHoliday, setDeletingHoliday] = useState<SchoolHoliday | null>(null)
  const [holidayFormData, setHolidayFormData] = useState({
    holiday_name: '',
    start_date: '',
    end_date: '',
    holiday_type: 'summer',
    note: ''
  })

  const handleOpenHolidayModal = (h?: SchoolHoliday) => {
    if (h) {
      setEditingHoliday(h)
      setHolidayFormData({
        holiday_name: h.holiday_name,
        start_date: h.start_date,
        end_date: h.end_date,
        holiday_type: h.holiday_type || 'other',
        note: h.note || ''
      })
    } else {
      setEditingHoliday(null)
      const todayStr = new Date().toISOString().split('T')[0]
      setHolidayFormData({
        holiday_name: '',
        start_date: todayStr,
        end_date: todayStr,
        holiday_type: 'other',
        note: '全便自動運休（臨時運行日を除く）'
      })
    }
    setIsHolidayModalOpen(true)
  }

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!holidayFormData.holiday_name.trim() || !holidayFormData.start_date || !holidayFormData.end_date) {
      alert('休業名、開始日、終了日を入力してください。')
      return
    }

    if (editingHoliday) {
      await updateSchoolHoliday(editingHoliday.id, holidayFormData)
    } else {
      await addSchoolHoliday(holidayFormData)
    }

    // スプレッドシート「基本設定・運休期間」（冬休み・夏休み・春休み等）と名称一致する場合、スプレッドシートへも自動同期
    const hName = holidayFormData.holiday_name.trim()
    const matchingBasicSetting = basicSettings.find(b => {
      const bName = (b.setting_name || b['設定名'] || '').trim()
      return bName && (hName === bName || hName.includes(bName) || bName.includes(hName))
    })
    if (matchingBasicSetting) {
      const targetSettingName = matchingBasicSetting.setting_name || matchingBasicSetting['設定名'] || hName
      await updateBasicSetting({
        setting_name: targetSettingName,
        start_date: holidayFormData.start_date,
        end_date: holidayFormData.end_date,
        note: holidayFormData.note
      })
    }

    setIsHolidayModalOpen(false)
  }

  const handleDeleteHoliday = (h: SchoolHoliday) => {
    setDeletingHoliday(h)
  }

  const handleCopyHolidaysToNextYear = async () => {
    const curYear = new Date().getFullYear()
    const targetYear = curYear + 1
    if (confirm(`${curYear}年度の長期休業設定を ${targetYear}年度へ一括複製（日付を+1年スライド）して引き継ぎますか？`)) {
      const count = await copySchoolHolidaysToNextYear(curYear)
      if (count > 0) {
        alert(`${count} 件の長期休業設定を ${targetYear}年度へ一括複製・登録しました。`)
      } else {
        alert('複製対象の休業設定が見つからないか、既に登録済みです。')
      }
    }
  }

  // 5. 月別下校・登校時刻マスタ用状態
  const [selectedScheduleMonth, setSelectedScheduleMonth] = useState<number>(4)
  const [scheduleSubTab, setScheduleSubTab] = useState<ScheduleSubTab>('regular')
  const [matrixViewType, setMatrixViewType] = useState<ScheduleSubTab>('regular')

  const currentMonthSchedule = monthlyTripSchedules.find(s => s.month === selectedScheduleMonth) || {
    id: `temp-${selectedScheduleMonth}`,
    month: selectedScheduleMonth,
    shortened_day_of_week: 3,
    morning_trip_time: '07:30:00',
    trip_1_time: '15:00:00',
    trip_2_time: '16:00:00',
    trip_3_time: '17:00:00',
    trip_4_time: '18:00:00',
    trip_5_time: '18:30:00',
    wed_trip_1_time: '14:00:00',
    wed_trip_2_time: '15:00:00',
    wed_trip_3_time: '16:00:00',
    wed_trip_4_time: '17:00:00',
    wed_trip_5_time: null,
    note: ''
  }

  const [scheduleForm, setScheduleForm] = useState({
    shortened_day_of_week: currentMonthSchedule.shortened_day_of_week !== undefined && currentMonthSchedule.shortened_day_of_week !== null 
      ? String(currentMonthSchedule.shortened_day_of_week) 
      : currentMonthSchedule.shortened_day_of_week === null ? 'none' : '3',
    morning_trip_time: currentMonthSchedule.morning_trip_time ? currentMonthSchedule.morning_trip_time.substring(0, 5) : '07:30',
    trip_1_time: currentMonthSchedule.trip_1_time ? currentMonthSchedule.trip_1_time.substring(0, 5) : '',
    trip_2_time: currentMonthSchedule.trip_2_time ? currentMonthSchedule.trip_2_time.substring(0, 5) : '',
    trip_3_time: currentMonthSchedule.trip_3_time ? currentMonthSchedule.trip_3_time.substring(0, 5) : '',
    trip_4_time: currentMonthSchedule.trip_4_time ? currentMonthSchedule.trip_4_time.substring(0, 5) : '',
    trip_5_time: currentMonthSchedule.trip_5_time ? currentMonthSchedule.trip_5_time.substring(0, 5) : '',
    wed_trip_1_time: currentMonthSchedule.wed_trip_1_time ? currentMonthSchedule.wed_trip_1_time.substring(0, 5) : '',
    wed_trip_2_time: currentMonthSchedule.wed_trip_2_time ? currentMonthSchedule.wed_trip_2_time.substring(0, 5) : '',
    wed_trip_3_time: currentMonthSchedule.wed_trip_3_time ? currentMonthSchedule.wed_trip_3_time.substring(0, 5) : '',
    wed_trip_4_time: currentMonthSchedule.wed_trip_4_time ? currentMonthSchedule.wed_trip_4_time.substring(0, 5) : '',
    wed_trip_5_time: currentMonthSchedule.wed_trip_5_time ? currentMonthSchedule.wed_trip_5_time.substring(0, 5) : '',
    note: currentMonthSchedule.note || ''
  })
  const [scheduleSaveSuccess, setScheduleSaveSuccess] = useState(false)

  const formShortenedDayNum = scheduleForm.shortened_day_of_week === 'none' ? null : parseInt(scheduleForm.shortened_day_of_week, 10)

  const getDynamicTabLabels = (shortenedDay: number | null) => {
    if (shortenedDay === null) {
      return {
        regular: '通常ダイヤ（平日全日）',
        shortened: '短縮ダイヤ（適用なし）',
        regularDesc: '平日すべての曜日に適用されます。',
        shortenedDesc: 'この月は短縮ダイヤの適用はありません。'
      }
    }
    const dayName = WEEKDAY_NAMES_MAP[shortenedDay] || '指定曜日'
    const otherDays = [1, 2, 3, 4, 5]
      .filter(d => d !== shortenedDay)
      .map(d => ['月', '火', '水', '木', '金'][d - 1])
      .join('・')

    return {
      regular: `通常（${otherDays}）`,
      shortened: `短縮日課（${dayName}）`,
      regularDesc: `${otherDays}曜日に適用される運行時刻です。`,
      shortenedDesc: `${dayName}（短縮・5時間授業など）に自動適用される運行時刻です。`
    }
  }

  const currentTabLabels = getDynamicTabLabels(formShortenedDayNum)

  const handleSelectScheduleMonth = (month: number) => {
    setSelectedScheduleMonth(month)
    const target = monthlyTripSchedules.find(s => s.month === month)
    if (target) {
      setScheduleForm({
        shortened_day_of_week: target.shortened_day_of_week !== undefined && target.shortened_day_of_week !== null
          ? String(target.shortened_day_of_week)
          : target.shortened_day_of_week === null ? 'none' : '3',
        morning_trip_time: target.morning_trip_time ? target.morning_trip_time.substring(0, 5) : '07:30',
        trip_1_time: target.trip_1_time ? target.trip_1_time.substring(0, 5) : '',
        trip_2_time: target.trip_2_time ? target.trip_2_time.substring(0, 5) : '',
        trip_3_time: target.trip_3_time ? target.trip_3_time.substring(0, 5) : '',
        trip_4_time: target.trip_4_time ? target.trip_4_time.substring(0, 5) : '',
        trip_5_time: target.trip_5_time ? target.trip_5_time.substring(0, 5) : '',
        wed_trip_1_time: target.wed_trip_1_time ? target.wed_trip_1_time.substring(0, 5) : '',
        wed_trip_2_time: target.wed_trip_2_time ? target.wed_trip_2_time.substring(0, 5) : '',
        wed_trip_3_time: target.wed_trip_3_time ? target.wed_trip_3_time.substring(0, 5) : '',
        wed_trip_4_time: target.wed_trip_4_time ? target.wed_trip_4_time.substring(0, 5) : '',
        wed_trip_5_time: target.wed_trip_5_time ? target.wed_trip_5_time.substring(0, 5) : '',
        note: target.note || ''
      })
    }
  }

  const handleSaveMonthlySchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    const finalShortenedDay = scheduleForm.shortened_day_of_week === 'none' ? null : parseInt(scheduleForm.shortened_day_of_week, 10)

    const success = await updateMonthlyTripSchedule(selectedScheduleMonth, {
      shortened_day_of_week: finalShortenedDay,
      morning_trip_time: scheduleForm.morning_trip_time.trim() ? `${scheduleForm.morning_trip_time}:00` : '07:30:00',
      trip_1_time: scheduleForm.trip_1_time.trim() ? `${scheduleForm.trip_1_time}:00` : null,
      trip_2_time: scheduleForm.trip_2_time.trim() ? `${scheduleForm.trip_2_time}:00` : null,
      trip_3_time: scheduleForm.trip_3_time.trim() ? `${scheduleForm.trip_3_time}:00` : null,
      trip_4_time: scheduleForm.trip_4_time.trim() ? `${scheduleForm.trip_4_time}:00` : null,
      trip_5_time: scheduleForm.trip_5_time.trim() ? `${scheduleForm.trip_5_time}:00` : null,
      wed_trip_1_time: scheduleForm.wed_trip_1_time.trim() ? `${scheduleForm.wed_trip_1_time}:00` : null,
      wed_trip_2_time: scheduleForm.wed_trip_2_time.trim() ? `${scheduleForm.wed_trip_2_time}:00` : null,
      wed_trip_3_time: scheduleForm.wed_trip_3_time.trim() ? `${scheduleForm.wed_trip_3_time}:00` : null,
      wed_trip_4_time: scheduleForm.wed_trip_4_time.trim() ? `${scheduleForm.wed_trip_4_time}:00` : null,
      wed_trip_5_time: scheduleForm.wed_trip_5_time.trim() ? `${scheduleForm.wed_trip_5_time}:00` : null,
      note: scheduleForm.note
    })
    if (success) {
      setScheduleSaveSuccess(true)
      setTimeout(() => setScheduleSaveSuccess(false), 2500)
    }
  }

  const handleResetToDefaultSchedules = async () => {
    if (confirm('月別下校時刻マスターを学校標準初期パターンにリセットしますか？（月ごとの保存内容が初期値に復元されます）')) {
      await resetMonthlyTripSchedulesToDefault()
      alert('月別運行時刻マスターを標準パターンへ初期化復元しました。')
    }
  }

  // 6. 生徒マスタ用状態
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('')
  const [selectedRouteFilter, setSelectedRouteFilter] = useState<string>('all')
  const [selectedStudentStatusFilter, setSelectedStudentStatusFilter] = useState<'all' | 'registered' | 'unregistered'>('all')
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [studentFormData, setStudentFormData] = useState({
    name: '',
    student2: '',
    student_code: '',
    verification_code: '',
    grade: '1年生',
    class_name: '1組',
    household_id: '',
    parent_id: '',
    parent_email: '',
    bus_stop_name: busStops[0]?.stop_name || '草香会館',
    default_morning: '乗る',
    default_afternoon: '2便',
    memo: ''
  })
  const [isSavingStudent, setIsSavingStudent] = useState(false)

  const handleOpenStudentModal = (student?: Student) => {
    if (student) {
      setEditingStudent(student)
      setStudentFormData({
        name: student.name,
        student2: '',
        student_code: student.student_code || '',
        verification_code: student.verification_code || '',
        grade: student.grade || '1年生',
        class_name: student.class_name || '1組',
        household_id: student.household_id || '',
        parent_id: student.parent_id || '',
        parent_email: student.parent_email || '',
        bus_stop_name: student.bus_stop_name || busStops[0]?.stop_name || '草香会館',
        default_morning: student.default_morning_ride ? '乗る' : '乗らない',
        default_afternoon: student.default_afternoon_schedule || '2便',
        memo: ''
      })
    } else {
      setEditingStudent(null)
      const randomCodeNum = Math.floor(100 + Math.random() * 900)
      const randomHouseholdNum = Math.floor(100 + Math.random() * 900)
      setStudentFormData({
        name: '',
        student2: '',
        student_code: `STU-${randomCodeNum}`,
        verification_code: `PASS${randomCodeNum}`,
        grade: '1年生',
        class_name: '1組',
        household_id: `H-${randomHouseholdNum}`,
        parent_id: '',
        parent_email: '',
        bus_stop_name: busStops[0]?.stop_name || '草香会館',
        default_morning: '乗る',
        default_afternoon: '2便',
        memo: ''
      })
    }
    setIsStudentModalOpen(true)
  }

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentFormData.name.trim()) {
      alert('生徒名を入力してください。')
      return
    }

    setIsSavingStudent(true)

    try {
      const parentEmail = studentFormData.parent_email.trim() || `${studentFormData.student_code || Date.now()}@parent.school-bus.app`
      
      // 1. GAS API へ action: "saveGuardianMaster" を POST 送信（スプレッドシート行更新・追加）
      await saveGuardianMaster({
        parentEmail,
        student1: studentFormData.name.trim(),
        student2: studentFormData.student2.trim() || null,
        busStop: studentFormData.bus_stop_name || '草香会館',
        memo: studentFormData.memo.trim() || '',
        defaultToSchool: studentFormData.default_morning,
        defaultFromSchool: studentFormData.default_afternoon
      })

      // 2. アプリ内ステートへ登録
      if (editingStudent) {
        await updateStudent(editingStudent.id, {
          name: studentFormData.name.trim(),
          student_code: studentFormData.student_code.trim() || null,
          verification_code: studentFormData.verification_code.trim() || null,
          grade: studentFormData.grade,
          class_name: studentFormData.class_name.trim() || null,
          household_id: studentFormData.household_id.trim() || null,
          parent_id: studentFormData.parent_id.trim() ? studentFormData.parent_id : parentEmail,
          parent_email: parentEmail,
          bus_stop_name: studentFormData.bus_stop_name,
          default_morning_ride: studentFormData.default_morning === '乗る',
          default_afternoon_schedule: studentFormData.default_afternoon
        })
      } else {
        await addStudent({
          name: studentFormData.name.trim(),
          student_code: studentFormData.student_code.trim() || null,
          verification_code: studentFormData.verification_code.trim() || null,
          grade: studentFormData.grade,
          class_name: studentFormData.class_name.trim() || null,
          household_id: studentFormData.household_id.trim() || null,
          parent_id: parentEmail,
          parent_email: parentEmail,
          bus_route_id: 'route-a',
          default_bus_stop_id: 'stop-1',
          bus_stop_name: studentFormData.bus_stop_name,
          default_morning_ride: studentFormData.default_morning === '乗る',
          default_afternoon_schedule: studentFormData.default_afternoon
        })
      }
      setIsStudentModalOpen(false)
    } catch (err: any) {
      console.error('Failed to save student to GAS:', err)
      alert(err.message || '生徒の登録通信中にエラーが発生しました。')
    } finally {
      setIsSavingStudent(false)
    }
  }

  const handleDeleteStudent = async (student: Student) => {
    if (confirm(`生徒「${student.name}」を削除してもよろしいですか？`)) {
      await deleteStudent(student.id)
    }
  }

  // 7. バス停マスタ用状態
  const [isStopModalOpen, setIsStopModalOpen] = useState(false)
  const [editingStop, setEditingStop] = useState<BusStop | null>(null)
  const [stopFormData, setStopFormData] = useState({
    stop_name: '',
    arrival_time_morning: '08:00',
    bus_route_id: 'route-a'
  })

  const handleOpenStopModal = (stop?: BusStop) => {
    if (stop) {
      setEditingStop(stop)
      setStopFormData({
        stop_name: stop.stop_name,
        arrival_time_morning: stop.arrival_time_morning ? stop.arrival_time_morning.substring(0, 5) : '08:00',
        bus_route_id: stop.bus_route_id || 'route-a'
      })
    } else {
      setEditingStop(null)
      setStopFormData({
        stop_name: '',
        arrival_time_morning: '08:00',
        bus_route_id: 'route-a'
      })
    }
    setIsStopModalOpen(true)
  }

  const handleSaveStop = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stopFormData.stop_name.trim()) {
      alert('停留所名を入力してください。')
      return
    }

    if (editingStop) {
      await updateBusStop(editingStop.id, {
        stop_name: stopFormData.stop_name,
        arrival_time_morning: `${stopFormData.arrival_time_morning}:00`,
        bus_route_id: stopFormData.bus_route_id
      })
    } else {
      const nextOrder = busStops.length > 0 ? Math.max(...busStops.map(s => s.order_index)) + 1 : 1
      await addBusStop({
        stop_name: stopFormData.stop_name,
        arrival_time_morning: `${stopFormData.arrival_time_morning}:00`,
        bus_route_id: stopFormData.bus_route_id,
        order_index: nextOrder
      })
    }
    setIsStopModalOpen(false)
  }

  const handleDeleteStop = async (stop: BusStop) => {
    const assignedStudents = students.filter(s => s.default_bus_stop_id === stop.id)
    if (assignedStudents.length > 0) {
      alert(`このバス停を利用している生徒が ${assignedStudents.length} 名登録されているため、削除できません。`)
      return
    }
    if (confirm(`バス停「${stop.stop_name}」を削除してもよろしいですか？`)) {
      await deleteBusStop(stop.id)
    }
  }

  const handleMoveStop = async (index: number, direction: 'up' | 'down') => {
    const sorted = [...busStops].sort((a, b) => a.order_index - b.order_index)
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= sorted.length) return

    const temp = sorted[index]
    sorted[index] = sorted[targetIndex]
    sorted[targetIndex] = temp

    await reorderBusStops(sorted.map(s => s.id))
  }

  // 8. 手動リフレッシュ状態
  const [isRefreshing, setIsRefreshing] = useState(false)
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refreshData()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  // 運行モニタリング用計算
  const isStudentRidingTrip = (studentId: string, date: string, trip: string): boolean => {
    const res = reservations.find(r => r.student_id === studentId && r.date === date)
    if (!res) return false
    return trip === '登校便' ? res.morning_status === true : res.afternoon_schedule === trip
  }

  const currentTripStudents = students.filter(s => isStudentRidingTrip(s.id, selectedDate, selectedTrip))
  const totalCount = currentTripStudents.length

  const completedStudents = currentTripStudents.filter(s => {
    const status = rideStatuses.find(
      r => r.student_id === s.id && r.date === selectedDate && (r.trip_name === selectedTrip || (!r.trip_name && selectedTrip === '登校便'))
    )
    return status?.status === 'completed'
  })

  const absentStudents = currentTripStudents.filter(s => {
    const status = rideStatuses.find(
      r => r.student_id === s.id && r.date === selectedDate && (r.trip_name === selectedTrip || (!r.trip_name && selectedTrip === '登校便'))
    )
    return status?.status === 'absent'
  })

  const pendingStudents = currentTripStudents.filter(s => {
    const status = rideStatuses.find(
      r => r.student_id === s.id && r.date === selectedDate && (r.trip_name === selectedTrip || (!r.trip_name && selectedTrip === '登校便'))
    )
    return !status || status.status === 'riding'
  })

  const completedCount = completedStudents.length
  const absentCount = absentStudents.length
  const pendingCount = pendingStudents.length
  const checkedCount = completedCount + absentCount
  const progressPercent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0

  const currentOperation = busOperations.find(
    op => op.date === selectedDate && (op.trip_name === selectedTrip || (!op.trip_name && selectedTrip === '登校便'))
  )

  const filteredMonitorStudents = currentTripStudents.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(monitorSearchQuery.toLowerCase())
    const status = rideStatuses.find(
      r => r.student_id === student.id && r.date === selectedDate && (r.trip_name === selectedTrip || (!r.trip_name && selectedTrip === '登校便'))
    )
    const currentStatus = status?.status === 'completed' ? 'completed' : status?.status === 'absent' ? 'absent' : 'pending'
    const matchesStatus = statusFilter === 'all' || currentStatus === statusFilter
    return matchesSearch && matchesStatus
  })

  const filteredMasterStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                          (student.student_code && student.student_code.toLowerCase().includes(studentSearchQuery.toLowerCase()))
    const matchesRoute = selectedRouteFilter === 'all' || student.bus_route_id === selectedRouteFilter
    
    const isRegistered = !!student.parent_id && student.parent_id !== 'unassigned'
    const matchesStatus = selectedStudentStatusFilter === 'all' ||
                          (selectedStudentStatusFilter === 'registered' && isRegistered) ||
                          (selectedStudentStatusFilter === 'unregistered' && !isRegistered)

    return matchesSearch && matchesRoute && matchesStatus
  })

  const filteredHolidays = schoolHolidays.filter(h => {
    if (selectedHolidayYearFilter === 'all') return true
    return h.start_date.startsWith(`${selectedHolidayYearFilter}-`)
  })

  // 便リストの動的時刻取得（5層優先度自動判定連動）
  const dynamicTrips = [
    { id: '登校便', name: '登校便', time: `${getTripTime('登校便', selectedDate)}発`, isOperating: isTripOperating('登校便', selectedDate) },
    { id: '下校1便', name: '下校1便', time: getTripTime('下校1便', selectedDate) !== '--:--' ? `${getTripTime('下校1便', selectedDate)}発` : '運休', isOperating: isTripOperating('下校1便', selectedDate) },
    { id: '下校2便', name: '下校2便', time: getTripTime('下校2便', selectedDate) !== '--:--' ? `${getTripTime('下校2便', selectedDate)}発` : '運休', isOperating: isTripOperating('下校2便', selectedDate) },
    { id: '下校3便', name: '下校3便', time: getTripTime('下校3便', selectedDate) !== '--:--' ? `${getTripTime('下校3便', selectedDate)}発` : '運休', isOperating: isTripOperating('下校3便', selectedDate) },
    { id: '下校4便', name: '下校4便', time: getTripTime('下校4便', selectedDate) !== '--:--' ? `${getTripTime('下校4便', selectedDate)}発` : '運休', isOperating: isTripOperating('下校4便', selectedDate) },
    { id: '下校5便', name: '下校5便', time: getTripTime('下校5便', selectedDate) !== '--:--' ? `${getTripTime('下校5便', selectedDate)}発` : '運休', isOperating: isTripOperating('下校5便', selectedDate) }
  ]

  // カレンダーグリッドの日付計算
  const getCalendarDays = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1)
    const startDayOfWeek = firstDay.getDay()
    const lastDate = new Date(year, month + 1, 0).getDate()

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = []

    const prevMonthLastDate = new Date(year, month, 0).getDate()
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dNum = prevMonthLastDate - i
      const prevM = month === 0 ? 11 : month - 1
      const prevY = month === 0 ? year - 1 : year
      const mStr = String(prevM + 1).padStart(2, '0')
      const dStr = String(dNum).padStart(2, '0')
      days.push({ dateStr: `${prevY}-${mStr}-${dStr}`, dayNum: dNum, isCurrentMonth: false })
    }

    for (let d = 1; d <= lastDate; d++) {
      const mStr = String(month + 1).padStart(2, '0')
      const dStr = String(d).padStart(2, '0')
      days.push({ dateStr: `${year}-${mStr}-${dStr}`, dayNum: d, isCurrentMonth: true })
    }

    const remaining = 7 - (days.length % 7)
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const nextM = month === 11 ? 0 : month + 1
        const nextY = month === 11 ? year + 1 : year
        const mStr = String(nextM + 1).padStart(2, '0')
        const dStr = String(d).padStart(2, '0')
        days.push({ dateStr: `${nextY}-${mStr}-${dStr}`, dayNum: d, isCurrentMonth: false })
      }
    }

    return days
  }

  const calendarDays = getCalendarDays(calendarYear, calendarMonth)

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col relative overflow-x-hidden">
      {/* 背景装飾 */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-600/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-3xl -z-10" />

      {/* ヘッダー */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-amber-500 to-orange-500 rounded-xl shadow-lg shadow-amber-500/10">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="font-black text-lg tracking-wider text-white">
                ADMIN CONSOLE
              </span>
              <span className="hidden sm:inline-block ml-2.5 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">
                統括運行管理
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-4">
            {/* CSVエクスポート＆A4印刷ボタン */}
            <button
              type="button"
              onClick={() => {
                setExportModalDate(selectedDate)
                setExportModalTrip(selectedTrip)
                setIsExportModalOpen(true)
              }}
              className="px-3 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 shadow-md shadow-amber-500/10"
              title="乗車実績CSV出力 / 点呼名簿のA4印刷"
            >
              <FileSpreadsheet className="h-4 w-4 text-amber-400" />
              <span className="hidden md:inline">実績CSV / 名簿印刷</span>
              <span className="md:hidden">帳票・CSV</span>
            </button>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition-all active:scale-95 disabled:opacity-50"
              title="データを再読み込み"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-400">ログイン中: 学校管理者</p>
              <p className="text-sm font-semibold text-slate-200">
                {profile?.full_name || user?.email || 'admin@example.com'}
              </p>
            </div>

            <button
              onClick={signOut}
              className="p-2 bg-slate-900 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-800 hover:border-rose-500/20 transition-all active:scale-95"
              title="ログアウト"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* タブナビゲーションバー（6タブ） */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-1 sm:gap-2 border-t border-slate-900/60 overflow-x-auto">
          <button
            onClick={() => setActiveTab('monitoring')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all shrink-0 ${
              activeTab === 'monitoring'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Activity className="h-4 w-4" />
            日別運行モニター
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all shrink-0 ${
              activeTab === 'calendar'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <CalendarIcon className="h-4 w-4" />
            運行カレンダー（臨時運行・特定日設定）
          </button>

          <button
            onClick={() => setActiveTab('schedules')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all shrink-0 ${
              activeTab === 'schedules'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Clock className="h-4 w-4" />
            月別時刻マスタ（登校・下校）
          </button>

          <button
            onClick={() => setActiveTab('holidays')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all shrink-0 ${
              activeTab === 'holidays'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Palmtree className="h-4 w-4" />
            基本設定・運休期間 ({basicSettings.length > 0 ? `${basicSettings.length}件` : `${schoolHolidays.length}件`})
          </button>

          <button
            onClick={() => setActiveTab('students')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all shrink-0 ${
              activeTab === 'students'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Users className="h-4 w-4" />
            生徒・保護者マスタ ({students.length}名)
          </button>

          <button
            onClick={() => setActiveTab('routes')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all shrink-0 ${
              activeTab === 'routes'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Bus className="h-4 w-4" />
            路線・バス停マスタ ({busStops.length}停留所)
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all shrink-0 ${
              activeTab === 'system'
                ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Settings2 className="h-4 w-4" />
            システム保守・データ管理
          </button>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 z-10">

        {/* ========================================================= */}
        {/* タブ 1: 日別運行モニター */}
        {/* ========================================================= */}
        {activeTab === 'monitoring' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <section className="bg-white/5 border border-white/5 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                    <Activity className="h-6 w-6 text-amber-400" />
                    日別 運行＆乗車ステータス監視
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    指定日の便ごとのバス運行状況、遅延時間、各生徒の乗降確認状態をリアルタイムに統括確認できます。
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-2 self-start md:self-auto">
                  <CalendarIcon className="h-4 w-4 text-amber-400 ml-2" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent border-none text-white text-xs font-bold focus:outline-none pr-1"
                  />
                  <span className={`text-xs px-2.5 py-0.5 rounded-lg font-bold ${
                    dateScheduleStatus.type === 'special' && !dateScheduleStatus.isSuspended
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : dateScheduleStatus.isSuspended
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : dateScheduleStatus.type === 'shortened'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : 'bg-slate-800 text-slate-300'
                  }`}>
                    ({dayOfWeekLabel}) {dateScheduleStatus.label}
                  </span>
                  <button
                    onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg font-bold transition-all"
                  >
                    今日
                  </button>
                </div>
              </div>

              {/* 便選択タブ */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-slate-900">
                {dynamicTrips.map(trip => {
                  const isSelected = selectedTrip === trip.id
                  const tripOp = busOperations.find(
                    op => op.date === selectedDate && (op.trip_name === trip.id || (!op.trip_name && trip.id === '登校便'))
                  )
                  const isRunning = tripOp?.status === 'running'
                  const isFinished = tripOp?.status === 'finished'

                  return (
                    <button
                      key={trip.id}
                      onClick={() => setSelectedTrip(trip.id)}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center relative ${
                        isSelected
                          ? 'bg-gradient-to-b from-amber-500/20 to-orange-500/20 border-amber-500 text-white shadow-lg shadow-amber-500/10 ring-1 ring-amber-500'
                          : !trip.isOperating
                            ? 'bg-slate-950/40 border-slate-900 text-slate-500 opacity-60 hover:opacity-90'
                            : 'bg-slate-950/60 border-slate-850 hover:bg-slate-900 hover:border-slate-800 text-slate-400'
                      }`}
                    >
                      {isRunning && (
                        <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      )}
                      {isFinished && (
                        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-500"></span>
                      )}

                      <span className={`text-xs font-black ${isSelected ? 'text-amber-400' : trip.isOperating ? 'text-slate-200' : 'text-slate-500'}`}>
                        {trip.name}
                      </span>
                      <span className={`text-[10px] font-mono mt-0.5 font-bold ${trip.isOperating ? 'text-amber-300/80' : 'text-rose-400/80'}`}>
                        {trip.time}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* サマリーカード群 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900/60 border border-slate-850 rounded-3xl p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">路線運行ステータス</span>
                  <span className={`text-xs px-2.5 py-0.5 border font-bold rounded-md ${
                    isTripOperating(selectedTrip, selectedDate)
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  }`}>
                    {selectedTrip} ({getTripTime(selectedTrip, selectedDate) !== '--:--' ? `${getTripTime(selectedTrip, selectedDate)}発` : '運休'})
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl ${
                    !isTripOperating(selectedTrip, selectedDate)
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : currentOperation?.status === 'running' 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : currentOperation?.status === 'finished' 
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-slate-800 text-slate-400'
                  }`}>
                    {!isTripOperating(selectedTrip, selectedDate) ? <Ban className="h-6 w-6" /> : <Bus className="h-6 w-6" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">
                      {!isTripOperating(selectedTrip, selectedDate) 
                        ? (dateScheduleStatus.label) 
                        : currentOperation?.status === 'running' 
                          ? '運行中' 
                          : currentOperation?.status === 'finished' 
                            ? '到着済み' 
                            : '運行前'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      担当路線: {busRoutes[0]?.route_name || 'スクールバスルート'}
                    </p>
                  </div>
                </div>

                {isTripOperating(selectedTrip, selectedDate) && currentOperation?.status === 'running' && (
                  <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold ${
                    currentOperation.delay_minutes > 0
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  }`}>
                    <Clock className="h-4 w-4 shrink-0" />
                    {currentOperation.delay_minutes > 0 ? `約 ${currentOperation.delay_minutes} 分遅れで運行中` : '定刻通り運行中'}
                  </div>
                )}
              </div>

              <div className="bg-slate-900/60 border border-slate-850 rounded-3xl p-6 space-y-4 md:col-span-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {selectedTrip} 乗車確認サマリー ({selectedDate})
                  </span>
                  <span className="text-sm font-black text-amber-400 font-mono">
                    {progressPercent}% 完了
                  </span>
                </div>

                <div className="w-full bg-slate-950 h-3.5 rounded-full overflow-hidden flex border border-slate-800">
                  <div 
                    className="bg-emerald-500 transition-all duration-500 ease-out"
                    style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}
                    title={`乗車完了: ${completedCount}名`}
                  />
                  <div 
                    className="bg-rose-500 transition-all duration-500 ease-out"
                    style={{ width: totalCount > 0 ? `${(absentCount / totalCount) * 100}%` : '0%' }}
                    title={`欠席: ${absentCount}名`}
                  />
                </div>

                <div className="grid grid-cols-4 gap-3 pt-2">
                  <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-900 text-center">
                    <span className="text-[10px] text-slate-500 font-bold block">乗車対象</span>
                    <span className="text-lg font-black text-white">{totalCount}名</span>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-900 text-center">
                    <span className="text-[10px] text-emerald-500 font-bold block">乗車済み</span>
                    <span className="text-lg font-black text-emerald-400">{completedCount}名</span>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-900 text-center">
                    <span className="text-[10px] text-rose-500 font-bold block">欠席</span>
                    <span className="text-lg font-black text-rose-400">{absentCount}名</span>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-900 text-center">
                    <span className="text-[10px] text-slate-500 font-bold block">未チェック</span>
                    <span className="text-lg font-black text-slate-400">{pendingCount}名</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 生徒別乗車チェック一覧テーブル */}
            <section className="bg-slate-900/40 border border-slate-850 rounded-3xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-wider flex items-center gap-2">
                    <Users className="h-5 w-5 text-amber-400" />
                    乗車対象 生徒名簿一覧 ({selectedTrip})
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ドライバーによるチェック結果および保護者からの予約・連絡事項をリアルタイムに確認できます。
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="生徒名で検索..."
                      value={monitorSearchQuery}
                      onChange={(e) => setMonitorSearchQuery(e.target.value)}
                      className="pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 w-40 sm:w-48"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="all">すべての状態</option>
                    <option value="completed">乗車済みのみ</option>
                    <option value="absent">欠席のみ</option>
                    <option value="pending">未チェックのみ</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      setExportModalDate(selectedDate)
                      setExportModalTrip(selectedTrip)
                      setIsExportModalOpen(true)
                    }}
                    className="px-3 py-1.5 bg-slate-950 hover:bg-slate-850 text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/50 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                    title="この便の点呼名簿をA4印刷"
                  >
                    <Printer className="h-3.5 w-3.5 text-indigo-400" />
                    <span>A4名簿印刷</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">停車順 / バス停</th>
                      <th className="py-3 px-4">生徒氏名</th>
                      <th className="py-3 px-4">予約便</th>
                      <th className="py-3 px-4">ドライバー確認状況</th>
                      <th className="py-3 px-4">保護者連絡事項</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60">
                    {filteredMonitorStudents.length > 0 ? (
                      filteredMonitorStudents.map(student => {
                        const stop = busStops.find(s => s.id === student.default_bus_stop_id)
                        const res = reservations.find(r => r.student_id === student.id && r.date === selectedDate)
                        const rideStatus = rideStatuses.find(
                          r => r.student_id === student.id && r.date === selectedDate && (r.trip_name === selectedTrip || (!r.trip_name && selectedTrip === '登校便'))
                        )
                        const isCompleted = rideStatus?.status === 'completed'
                        const isAbsent = rideStatus?.status === 'absent'

                        return (
                          <tr key={student.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <span className="h-5 w-5 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center font-mono text-[10px] text-slate-400 font-bold">
                                  {stop?.order_index || '-'}
                                </span>
                                <div>
                                  <span className="font-bold text-slate-200">{stop?.stop_name || '未設定'}</span>
                                  <span className="text-[10px] text-slate-500 block font-mono">
                                    {stop ? getAdjustedStopArrivalTime(stop, selectedDate) : ''}着
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 font-black text-white text-sm">
                              {student.name}
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="flex gap-1.5">
                                {selectedTrip === '登校便' ? (
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                                    登校：乗車予約 ({getTripTime('登校便', selectedDate)}発)
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold">
                                    {res?.afternoon_schedule || selectedTrip} ({getTripTime(res?.afternoon_schedule || selectedTrip, selectedDate)})
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              {isCompleted ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black text-[11px]">
                                  <CheckCircle2 className="h-3 w-3" />
                                  乗車完了
                                </span>
                              ) : isAbsent ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black text-[11px]">
                                  <AlertCircle className="h-3 w-3" />
                                  欠席
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-950 text-slate-500 border border-slate-800 text-[10px] font-bold">
                                  未チェック
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              {res?.note && res.note !== '基本パターン' && res.note !== '基本一括自動予約' ? (
                                <span className="text-amber-300 flex items-center gap-1 font-medium bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                  {res.note}
                                </span>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500 italic">
                          対象となる生徒の乗車予約データはありません。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* ========================================================= */}
        {/* タブ 2: 運行カレンダー（Googleカレンダー風ビュー ＆ 臨時運行・特定日設定） */}
        {/* ========================================================= */}
        {activeTab === 'calendar' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 border border-white/5 rounded-3xl p-6 shadow-xl">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <CalendarIcon className="h-6 w-6 text-amber-400" />
                  運行カレンダー（臨時運行 ＆ 特定日ダイヤ設定）
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  日付をクリックして<strong>「運行区分」「特別時刻」「運休」「行事名」</strong>を直接設定・更新できます。
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
                {/* 緊急運休・一括告知ボタン */}
                <button
                  type="button"
                  onClick={() => setIsEmergencyModalOpen(true)}
                  className="px-4 py-2.5 bg-rose-600/30 hover:bg-rose-600 border border-rose-500/50 text-rose-200 hover:text-white rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-rose-600/10 active:scale-95"
                >
                  <AlertTriangle className="h-4 w-4 text-rose-400" />
                  <span>🚨 緊急運休・一括告知</span>
                </button>

                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-1.5">
                  <button
                    onClick={() => {
                      if (calendarMonth === 0) {
                        setCalendarYear(calendarYear - 1)
                        setCalendarMonth(11)
                      } else {
                        setCalendarMonth(calendarMonth - 1)
                      }
                    }}
                    className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"
                    title="前月"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <span className="px-3 text-xs font-black text-white font-mono">
                    {calendarYear}年 {calendarMonth + 1}月
                  </span>

                  <button
                    onClick={() => {
                      if (calendarMonth === 11) {
                        setCalendarYear(calendarYear + 1)
                        setCalendarMonth(0)
                      } else {
                        setCalendarMonth(calendarMonth + 1)
                      }
                    }}
                    className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"
                    title="翌月"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => {
                      const now = new Date()
                      setCalendarYear(now.getFullYear())
                      setCalendarMonth(now.getMonth())
                    }}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-xl font-bold transition-all ml-1"
                  >
                    今月
                  </button>
                </div>
              </div>
            </div>

            {/* カレンダー凡例 */}
            <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-900/60 border border-slate-850 p-3.5 rounded-2xl">
              <span className="font-bold text-slate-400">凡例:</span>
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span> ★臨時運行日（休日・夏休み登校等）
              </span>
              <span className="flex items-center gap-1.5 text-amber-300 font-bold">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span> ★特定日個別ダイヤ
              </span>
              <span className="flex items-center gap-1.5 text-purple-300">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-500"></span> 短縮日課ダイヤ
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-600"></span> 通常平日ダイヤ
              </span>
              <span className="flex items-center gap-1.5 text-rose-300 font-bold">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span> 祝日・夏冬休み・土日（運休）
              </span>
            </div>

            {/* Googleカレンダー風グリッド */}
            <div className="bg-slate-900/60 border border-slate-850 rounded-3xl p-4 sm:p-6 overflow-x-auto">
              <div className="min-w-[700px]">
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-black uppercase pb-3 border-b border-slate-800">
                  <span className="text-rose-400">日</span>
                  <span className="text-slate-400">月</span>
                  <span className="text-slate-400">火</span>
                  <span className="text-slate-400">水</span>
                  <span className="text-slate-400">木</span>
                  <span className="text-slate-400">金</span>
                  <span className="text-sky-400">土</span>
                </div>

                <div className="grid grid-cols-7 gap-2 pt-2">
                  {calendarDays.map(({ dateStr, dayNum, isCurrentMonth }) => {
                    const status = getDateScheduleStatus(dateStr)
                    const isToday = dateStr === new Date().toISOString().split('T')[0]
                    const dObj = new Date(`${dateStr}T00:00:00`)
                    const dNumOfWeek = dObj.getDay()
                    const isWeekend = dNumOfWeek === 0 || dNumOfWeek === 6
                    const special = specialTripSchedules.find(s => s.date === dateStr)
                    const isTemporary = special?.is_temporary_operation || (special && !special.is_all_day_suspended && (isWeekend || status.holidayName !== null))

                    let badgeClass = 'bg-slate-800/80 text-slate-400'
                    if (isTemporary) {
                      badgeClass = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black'
                    } else if (status.type === 'special') {
                      badgeClass = status.isSuspended 
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    } else if (status.isSuspended) {
                      badgeClass = 'bg-rose-500/15 text-rose-300 border border-rose-500/20'
                    } else if (status.type === 'shortened') {
                      badgeClass = 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold'
                    }

                    return (
                      <div
                        key={dateStr}
                        onClick={() => handleOpenSpecialModal(dateStr)}
                        className={`min-h-[105px] p-2.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${
                          !isCurrentMonth 
                            ? 'opacity-30 bg-slate-950/20 border-slate-900' 
                            : isToday
                              ? 'bg-amber-500/5 border-amber-500/40 ring-1 ring-amber-500/30 shadow-lg'
                              : isTemporary
                                ? 'bg-emerald-950/30 border-emerald-500/40 hover:border-emerald-400'
                                : status.type === 'special'
                                  ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-400'
                                  : status.isSuspended
                                    ? 'bg-rose-950/20 border-slate-850 hover:border-rose-500/30'
                                    : 'bg-slate-950/60 border-slate-850 hover:bg-slate-900 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className={`text-xs font-mono font-bold ${
                            isToday 
                              ? 'h-5 w-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-black' 
                              : dNumOfWeek === 0 
                                ? 'text-rose-400' 
                                : dNumOfWeek === 6 
                                  ? 'text-sky-400' 
                                  : 'text-slate-300'
                          }`}>
                            {dayNum}
                          </span>

                          {isTemporary ? (
                            <span className="text-[10px] bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded font-black flex items-center gap-0.5">
                              <Zap className="h-2.5 w-2.5" />
                              臨時運行
                            </span>
                          ) : status.type === 'special' ? (
                            <span className="text-[10px] bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded font-black">
                              ★個別
                            </span>
                          ) : null}
                        </div>

                        <div className="my-1.5 space-y-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded block truncate text-center ${badgeClass}`}>
                            {status.type === 'holiday' 
                              ? status.holidayName || '祝日' 
                              : status.type === 'school_break' 
                                ? status.holidayName || '休業' 
                                : status.label}
                          </span>

                          {!status.isSuspended && (
                            <div className="text-[9px] font-mono text-slate-400 space-y-0.5 hidden sm:block">
                              <div className="flex justify-between text-indigo-300">
                                <span>登校便:</span>
                                <span className="font-bold">{getTripTime('登校便', dateStr)}発</span>
                              </div>
                              <div className="flex justify-between">
                                <span>下校1便:</span>
                                <span className="font-bold">{getTripTime('下校1便', dateStr)}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <span className="text-[9px] text-slate-600 group-hover:text-amber-400 transition-colors text-right block">
                          クリックで設定 ✎
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* タブ 3: 月別下校・登校時刻マスタ（恒久マスター設定） */}
        {/* ========================================================= */}
        {activeTab === 'schedules' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* 年非依存・自動引き継ぎの解説バッジ */}
            <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10 border border-amber-500/20 rounded-3xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-xs flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    年度自動引き継ぎシステム有効
                  </span>
                  <span className="text-xs text-slate-400 font-bold">（年非依存・恒久マスター）</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  ここで設定した月別基本ダイヤ（4月〜翌3月）は、<strong>年が変わっても翌年度以降へ自動的に引き継がれます</strong>。年度替わりの再入力は不要です。
                </p>
              </div>

              <button
                type="button"
                onClick={handleResetToDefaultSchedules}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                標準パターンへ初期化
              </button>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Clock className="h-6 w-6 text-amber-400" />
                    月別運行時刻マスター設定（登校便 ＆ 下校便）
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    月ごとに<strong>「基本_登校便 出発時刻」</strong>および「<strong>短縮ダイヤを適用する曜日</strong>」を設定し、通常・短縮下校便のダイヤを一括管理できます。
                  </p>
                </div>
                <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1.5 rounded-xl font-bold self-start sm:self-auto flex items-center gap-1">
                  <Settings2 className="h-3.5 w-3.5" />
                  登校・下校連動
                </span>
              </div>

              <div className="flex gap-2 overflow-x-auto pt-2 pb-1">
                {ACADEMIC_MONTHS.map(month => {
                  const isSelected = selectedScheduleMonth === month
                  return (
                    <button
                      key={month}
                      onClick={() => handleSelectScheduleMonth(month)}
                      className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-black scale-105'
                          : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
                      }`}
                    >
                      {month}月
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form onSubmit={handleSaveMonthlySchedule} className="bg-slate-900/60 border border-slate-850 rounded-3xl p-6 space-y-5 lg:col-span-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-amber-400" />
                    【{selectedScheduleMonth}月】ダイヤ＆短縮日課設定
                  </h3>
                  {scheduleSaveSuccess && (
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 animate-in fade-in">
                      <Check className="h-3.5 w-3.5" />
                      一括保存完了
                    </span>
                  )}
                </div>

                {/* 登校便 出発時刻設定 */}
                <div className="bg-slate-950/80 border border-indigo-500/30 p-3.5 rounded-2xl space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <Sunrise className="h-4 w-4 text-indigo-400" />
                      基本_登校便 出発時刻
                    </label>
                    <span className="text-[10px] text-slate-500">標準: 07:30</span>
                  </div>
                  <input
                    type="time"
                    value={scheduleForm.morning_trip_time}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, morning_trip_time: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                    required
                  />
                  <p className="text-[10px] text-slate-400">
                    ※ここを変更すると、全バス停の通過予定時刻も自動連動してシフトします。
                  </p>
                </div>

                <div className="bg-slate-950/80 border border-purple-500/30 p-3.5 rounded-2xl space-y-1.5">
                  <label className="block text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                    短縮ダイヤを適用する曜日
                  </label>
                  <select
                    value={scheduleForm.shortened_day_of_week}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, shortened_day_of_week: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs font-bold focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    {SHORTENED_DAY_OPTIONS.map(opt => (
                      <option key={String(opt.value)} value={String(opt.value)}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex rounded-2xl bg-slate-950 p-1 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setScheduleSubTab('regular')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      scheduleSubTab === 'regular'
                        ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {currentTabLabels.regular}
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleSubTab('shortened')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      scheduleSubTab === 'shortened'
                        ? 'bg-purple-500 text-white font-black shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="h-3 w-3" />
                    {currentTabLabels.shortened}
                  </button>
                </div>

                {scheduleSubTab === 'regular' && (
                  <div className="space-y-3.5 text-xs animate-in fade-in duration-200">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold text-[11px]">
                      {currentTabLabels.regularDesc}
                    </div>

                    {[1, 2, 3, 4, 5].map(num => {
                      const key = `trip_${num}_time` as keyof typeof scheduleForm
                      return (
                        <div key={num}>
                          <div className="flex justify-between items-center mb-1">
                            <label className="font-bold text-slate-400">下校{num}便 出発時刻</label>
                            <button
                              type="button"
                              onClick={() => setScheduleForm({ ...scheduleForm, [key]: '' })}
                              className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors"
                            >
                              運休にする (クリア)
                            </button>
                          </div>
                          <input
                            type="time"
                            value={scheduleForm[key]}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, [key]: e.target.value })}
                            placeholder="--:--"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      )
                    })}
                  </div>
                )}

                {scheduleSubTab === 'shortened' && (
                  <div className="space-y-3.5 text-xs animate-in fade-in duration-200">
                    <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold text-[11px]">
                      {currentTabLabels.shortenedDesc}
                    </div>

                    {[1, 2, 3, 4, 5].map(num => {
                      const key = `wed_trip_${num}_time` as keyof typeof scheduleForm
                      return (
                        <div key={num}>
                          <div className="flex justify-between items-center mb-1">
                            <label className="font-bold text-purple-300">短縮 下校{num}便 出発時刻</label>
                            <button
                              type="button"
                              onClick={() => setScheduleForm({ ...scheduleForm, [key]: '' })}
                              className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors"
                            >
                              運休にする (クリア)
                            </button>
                          </div>
                          <input
                            type="time"
                            value={scheduleForm[key]}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, [key]: e.target.value })}
                            placeholder="--:--"
                            className="w-full bg-slate-950 border border-purple-900/40 rounded-xl px-3.5 py-2 text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        </div>
                      )
                    })}
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-400 mb-1 text-xs">備考・ダイヤ説明</label>
                  <input
                    type="text"
                    placeholder="例: 短縮日課・部活動延長"
                    value={scheduleForm.note}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, note: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 text-xs"
                >
                  <Save className="h-4 w-4" />
                  {selectedScheduleMonth}月の全運行ダイヤを一括保存
                </button>
              </form>

              {/* 年間一覧 */}
              <div className="bg-slate-900/60 border border-slate-850 rounded-3xl p-6 space-y-4 lg:col-span-7 overflow-x-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-black text-white">
                      年間（4月〜翌3月）運行ダイヤ一覧
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      ※行をクリックして編集対象月を切り替え
                    </span>
                  </div>

                  <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 shrink-0">
                    <button
                      type="button"
                      onClick={() => setMatrixViewType('regular')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        matrixViewType === 'regular'
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      通常ダイヤ
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatrixViewType('shortened')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        matrixViewType === 'shortened'
                          ? 'bg-purple-500 text-white font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      短縮ダイヤ
                    </button>
                  </div>
                </div>

                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase">
                      <th className="py-2.5 px-3">対象月</th>
                      <th className="py-2.5 px-3">短縮曜日</th>
                      <th className="py-2.5 px-3 text-indigo-400">登校便</th>
                      <th className="py-2.5 px-3">{matrixViewType === 'shortened' ? '短縮 1便' : '下校1便'}</th>
                      <th className="py-2.5 px-3">{matrixViewType === 'shortened' ? '短縮 2便' : '下校2便'}</th>
                      <th className="py-2.5 px-3">{matrixViewType === 'shortened' ? '短縮 3便' : '下校3便'}</th>
                      <th className="py-2.5 px-3">{matrixViewType === 'shortened' ? '短縮 4便' : '下校4便'}</th>
                      <th className="py-2.5 px-3">{matrixViewType === 'shortened' ? '短縮 5便' : '下校5便'}</th>
                      <th className="py-2.5 px-3">備考</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60">
                    {ACADEMIC_MONTHS.map(m => {
                      const sch = monthlyTripSchedules.find(s => s.month === m)
                      const isCurrentSelected = selectedScheduleMonth === m

                      const renderTimeCell = (time: string | null | undefined) => {
                        if (!time || time.trim() === '' || time === '--:--' || time.startsWith('--')) {
                          return (
                            <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-500 font-bold text-[10px]">
                              運休
                            </span>
                          )
                        }
                        return <span className="font-mono text-slate-200">{time.substring(0, 5)}</span>
                      }

                      const shortenedDayLabel = sch?.shortened_day_of_week !== undefined && sch?.shortened_day_of_week !== null
                        ? WEEKDAY_NAMES_MAP[sch.shortened_day_of_week] || '水曜日'
                        : sch?.shortened_day_of_week === null ? 'なし' : '水曜日'

                      const morningTime = sch?.morning_trip_time ? sch.morning_trip_time.substring(0, 5) : '07:30'
                      const t1 = matrixViewType === 'shortened' ? sch?.wed_trip_1_time : sch?.trip_1_time
                      const t2 = matrixViewType === 'shortened' ? sch?.wed_trip_2_time : sch?.trip_2_time
                      const t3 = matrixViewType === 'shortened' ? sch?.wed_trip_3_time : sch?.trip_3_time
                      const t4 = matrixViewType === 'shortened' ? sch?.wed_trip_4_time : sch?.trip_4_time
                      const t5 = matrixViewType === 'shortened' ? sch?.wed_trip_5_time : sch?.trip_5_time

                      return (
                        <tr
                          key={m}
                          onClick={() => handleSelectScheduleMonth(m)}
                          className={`cursor-pointer transition-colors ${
                            isCurrentSelected
                              ? matrixViewType === 'shortened'
                                ? 'bg-purple-500/10 text-purple-300 font-bold'
                                : 'bg-amber-500/10 text-amber-300 font-bold'
                              : 'hover:bg-slate-900/40 text-slate-300'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-black text-white">
                            {m}月 {isCurrentSelected && <span className={matrixViewType === 'shortened' ? 'text-purple-400 text-[10px]' : 'text-amber-400 text-[10px]'}>●選択中</span>}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-400">
                            {shortenedDayLabel === 'なし' ? (
                              <span className="text-slate-600">なし</span>
                            ) : (
                              <span className="text-purple-300">{shortenedDayLabel}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-indigo-300 font-bold">{morningTime}</td>
                          <td className="py-2.5 px-3">{renderTimeCell(t1)}</td>
                          <td className="py-2.5 px-3">{renderTimeCell(t2)}</td>
                          <td className="py-2.5 px-3">{renderTimeCell(t3)}</td>
                          <td className="py-2.5 px-3">{renderTimeCell(t4)}</td>
                          <td className="py-2.5 px-3">{renderTimeCell(t5)}</td>
                          <td className="py-2.5 px-3 text-slate-400 text-[11px]">{sch?.note || '-'}</td>
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
        {/* タブ 4: 基本設定・運休期間マスタ（スプレッドシート連動） */}
        {/* ========================================================= */}
        {activeTab === 'holidays' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* ヘッダーエリア */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 border border-white/5 rounded-3xl p-6 shadow-xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Googleスプレッドシート連動中
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">シート名: 基本設定・運休期間</span>
                </div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2 mt-1.5">
                  <Palmtree className="h-6 w-6 text-amber-400" />
                  基本設定・運休期間（長期休業＆運行ルールマスタ）
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-3xl">
                  スプレッドシートの「基本設定・運休期間」シートから直接取得した長期休業日（春休み・夏休み・冬休み等）の日程および各便の運行設定です。
                  運休期間は保護者画面のカレンダーにも自動連動されます。
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
                <button
                  type="button"
                  disabled={isSyncingBasicSettings}
                  onClick={handleRefreshBasicSettings}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 hover:border-amber-500/60 font-bold rounded-xl text-xs transition-all active:scale-95 shadow-lg shadow-amber-500/5 disabled:opacity-50"
                  title="スプレッドシートの最新データを再取得"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncingBasicSettings ? 'animate-spin text-amber-400' : ''}`} />
                  {isSyncingBasicSettings ? 'データ再取得中...' : 'GASから最新データを再同期'}
                </button>
              </div>
            </div>

            {/* ① 長期休業期間（春休み・夏休み・冬休み等）の要約ハイライトカード */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Sun className="h-4 w-4 text-amber-400" />
                  長期休業・運休期間ハイライト（スプレッドシート値直接バインド・即時自動保存対応）
                </h3>
                <span className="text-xs text-slate-400 font-bold">
                  {(basicSettings.filter((b: BasicSettingPeriodRow) => (b.start_date || b['開始日'])).length > 0 ? basicSettings.filter((b: BasicSettingPeriodRow) => (b.start_date || b['開始日'])) : defaultBasicSettings).length} 件
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(() => {
                  const sourceRows = basicSettings.filter((b: BasicSettingPeriodRow) => (b.start_date || b['開始日'])).length > 0
                    ? basicSettings.filter((b: BasicSettingPeriodRow) => (b.start_date || b['開始日']))
                    : defaultBasicSettings

                  return sourceRows.map((period: BasicSettingPeriodRow, idx: number) => {
                    const settingName = String(period.setting_name || period['設定名'] || '').trim() || '休業期間'
                    const rawStart = period.start_date || period['開始日'] || ''
                    const rawEnd = period.end_date || period['終了日'] || ''
                    const stdOp = period.standard_operation || period['標準運行'] || '運休'
                    const contentTime = period.content_time || period['内容・時刻'] || '全便運休'
                    const note = period.note || period['備考'] || ''

                    const draft = basicSettingDrafts[settingName] || {}
                    const curStart = draft.start_date !== undefined ? draft.start_date : rawStart
                    const curEnd = draft.end_date !== undefined ? draft.end_date : rawEnd

                    // スプレッドシート値（C列）に完全一致させた表示用日付文字列（YYYY-MM-DD）
                    const displayStart = curStart ? curStart.replace(/\//g, '-') : '-'
                    const displayEnd = curEnd ? curEnd.replace(/\//g, '-') : '-'

                    // HTML5 date picker 用フォーマット (YYYY-MM-DD)
                    const startForInput = curStart ? curStart.replace(/\//g, '-') : ''
                    const endForInput = curEnd ? curEnd.replace(/\//g, '-') : ''

                    const isSaving = Boolean(savingRowKeys[settingName])
                    const isSaved = Boolean(savedRowKeys[settingName])

                    const isSpring = settingName.includes('春')
                    const isSummer = settingName.includes('夏')
                    const isWinter = settingName.includes('冬')

                    return (
                      <div
                        key={`period-card-${idx}`}
                        className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 space-y-3 hover:border-slate-700 transition-all shadow-lg relative overflow-hidden"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-2.5 rounded-2xl ${
                              isSummer ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30' :
                              isWinter ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/30' :
                              isSpring ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30' :
                              'bg-slate-800 text-slate-300'
                            }`}>
                              {isSummer ? <Sun className="h-5 w-5" /> :
                               isWinter ? <Snowflake className="h-5 w-5" /> :
                               isSpring ? <Palmtree className="h-5 w-5" /> :
                               <Ban className="h-5 w-5" />}
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block">スプレッドシート連動</span>
                              <h4 className="text-base font-black text-white">{settingName}</h4>
                            </div>
                          </div>

                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            {stdOp}
                          </span>
                        </div>

                        <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-900 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 text-[11px] font-bold">期間（スプレッドシート値）:</span>
                            <span className="font-mono font-bold text-amber-300 tracking-wide text-xs">
                              {displayStart} 〜 {displayEnd}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-[11px]">内容・時刻:</span>
                            <span className="font-bold text-slate-200 text-xs">{contentTime}</span>
                          </div>
                          {note && (
                            <div className="pt-1.5 text-[11px] text-slate-400 border-t border-slate-900/80">
                              備考: {note}
                            </div>
                          )}

                          {/* カード内での即時日付変更入力（変更確定時にスプレッドシートへ即時自動保存） */}
                          <div className="pt-2 border-t border-slate-900/80 space-y-1.5">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-400 font-bold">カード内即時変更:</span>
                              {isSaving ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 animate-pulse">
                                  <RefreshCw className="h-2.5 w-2.5 animate-spin" /> 保存中...
                                </span>
                              ) : isSaved ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-300">
                                  <Check className="h-3 w-3 text-emerald-400" /> ✓ 保存済
                                </span>
                              ) : (
                                <span className="text-slate-600 font-mono">自動保存対応</span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-[9px] text-slate-500 block mb-0.5">開始日</span>
                                <input
                                  type="date"
                                  value={startForInput}
                                  onChange={(e) => {
                                    const slashVal = e.target.value ? e.target.value.replace(/-/g, '/') : ''
                                    handleBasicSettingDraftChange(settingName, 'start_date', slashVal)
                                    handleAutoSaveBasicSetting(settingName, 'start_date', slashVal)
                                  }}
                                  className="w-full bg-slate-900 border border-slate-750 hover:border-amber-500/60 focus:border-amber-500 rounded-lg px-2 py-1 text-[11px] text-amber-300 font-mono focus:outline-none transition-all cursor-pointer shadow-inner"
                                  title="開始日を選択（変更確定時に即時自動保存）"
                                />
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-500 block mb-0.5">終了日</span>
                                <input
                                  type="date"
                                  value={endForInput}
                                  onChange={(e) => {
                                    const slashVal = e.target.value ? e.target.value.replace(/-/g, '/') : ''
                                    handleBasicSettingDraftChange(settingName, 'end_date', slashVal)
                                    handleAutoSaveBasicSetting(settingName, 'end_date', slashVal)
                                  }}
                                  className="w-full bg-slate-900 border border-slate-750 hover:border-amber-500/60 focus:border-amber-500 rounded-lg px-2 py-1 text-[11px] text-amber-300 font-mono focus:outline-none transition-all cursor-pointer shadow-inner"
                                  title="終了日を選択（変更確定時に即時自動保存）"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold pt-0.5">
                          <Check className="h-3.5 w-3.5" />
                          スプレッドシート＆カレンダー自動運休連動中
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>

            {/* ② スプレッドシート完全一致一覧テーブル */}
            <div className="bg-slate-900/60 border border-slate-850 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                      スプレッドシート「基本設定・運休期間」インライン編集（即時自動保存）
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      管理者限定・全5項目自動同期
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    開始日・終了日（日付選択時）、標準運行（選択時）、内容・備考（入力離脱時）にスプレッドシートへ即時自動同期（パターンA）されます。
                  </p>
                </div>
                <div className="flex items-center gap-3 self-start sm:self-auto">
                  <div className="text-xs text-slate-400 font-mono">
                    全 {basicSettings.length} 行
                  </div>
                </div>
              </div>

              {basicSettings.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="p-3 rounded-full bg-amber-500/10 text-amber-400 w-12 h-12 mx-auto flex items-center justify-center">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  </div>
                  <p className="text-sm font-bold text-slate-300">スプレッドシートからデータを取得中...</p>
                  <p className="text-xs text-slate-500">初回読み込みに数秒かかる場合があります。</p>
                  <button
                    type="button"
                    onClick={handleRefreshBasicSettings}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-all"
                  >
                    再読み込みを実行
                  </button>
                </div>
              ) : (
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
                        <th className="py-3 px-3 w-24 text-center">保存状態</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {basicSettings.map((row, idx) => {
                        const settingName = row.setting_name || row['設定名'] || ''
                        const rawStart = row.start_date || row['開始日'] || ''
                        const rawEnd = row.end_date || row['終了日'] || ''
                        const rawStdOp = row.standard_operation || row['標準運行'] || ''
                        const rawContentTime = row.content_time || row['内容・時刻'] || ''
                        const rawNote = row.note || row['備考'] || ''

                        const draft = basicSettingDrafts[settingName] || {}
                        const curStart = draft.start_date !== undefined ? draft.start_date : rawStart
                        const curEnd = draft.end_date !== undefined ? draft.end_date : rawEnd
                        const curStdOp = draft.standard_operation !== undefined ? draft.standard_operation : rawStdOp
                        const curContentTime = draft.content_time !== undefined ? draft.content_time : rawContentTime
                        const curNote = draft.note !== undefined ? draft.note : rawNote

                        const isSaving = Boolean(savingRowKeys[settingName])
                        const isSaved = Boolean(savedRowKeys[settingName])

                        const isHolidayRow = (rawStart && rawEnd) || settingName.includes('休み')

                        // HTML5 input[type=date]用フォーマット（YYYY-MM-DD）
                        const startForInput = curStart ? curStart.replace(/\//g, '-') : ''
                        const endForInput = curEnd ? curEnd.replace(/\//g, '-') : ''

                        return (
                          <tr 
                            key={`basic-row-${idx}`}
                            className={`hover:bg-slate-800/40 transition-colors ${
                              isHolidayRow ? 'bg-amber-500/[0.03]' : ''
                            }`}
                          >
                            <td className="py-3 px-3 text-center font-mono text-slate-500 text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-3 font-bold text-white">
                              <div className="flex items-center gap-2">
                                {settingName.includes('春') ? <Palmtree className="h-4 w-4 text-emerald-400 shrink-0" /> :
                                 settingName.includes('夏') ? <Sun className="h-4 w-4 text-amber-400 shrink-0" /> :
                                 settingName.includes('冬') ? <Snowflake className="h-4 w-4 text-sky-400 shrink-0" /> :
                                 settingName.includes('便') ? <Bus className="h-4 w-4 text-indigo-400 shrink-0" /> :
                                 settingName.includes('祝') || settingName.includes('土日') ? <CalendarIcon className="h-4 w-4 text-rose-400 shrink-0" /> :
                                 <Clock className="h-4 w-4 text-slate-400 shrink-0" />}
                                <span className="text-xs font-bold">{settingName}</span>
                              </div>
                            </td>

                            {/* 開始日 (B列: 日付ピッカー) */}
                            <td className="py-3 px-3">
                              <input
                                type="date"
                                value={startForInput}
                                onChange={(e) => {
                                  const slashVal = e.target.value ? e.target.value.replace(/-/g, '/') : ''
                                  handleBasicSettingDraftChange(settingName, 'start_date', slashVal)
                                  handleAutoSaveBasicSetting(settingName, 'start_date', slashVal)
                                }}
                                className="w-full bg-slate-950 border border-slate-750 hover:border-amber-500/60 focus:border-amber-500 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 font-mono focus:outline-none transition-all cursor-pointer shadow-inner"
                                title="開始日を選択（変更確定時に自動保存）"
                              />
                            </td>

                            {/* 終了日 (C列: 日付ピッカー) */}
                            <td className="py-3 px-3">
                              <input
                                type="date"
                                value={endForInput}
                                onChange={(e) => {
                                  const slashVal = e.target.value ? e.target.value.replace(/-/g, '/') : ''
                                  handleBasicSettingDraftChange(settingName, 'end_date', slashVal)
                                  handleAutoSaveBasicSetting(settingName, 'end_date', slashVal)
                                }}
                                className="w-full bg-slate-950 border border-slate-750 hover:border-amber-500/60 focus:border-amber-500 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 font-mono focus:outline-none transition-all cursor-pointer shadow-inner"
                                title="終了日を選択（変更確定時に自動保存）"
                              />
                            </td>

                            {/* 標準運行 (D列: プルダウン) */}
                            <td className="py-3 px-3">
                              <select
                                value={curStdOp}
                                onChange={(e) => {
                                  const val = e.target.value
                                  handleBasicSettingDraftChange(settingName, 'standard_operation', val)
                                  handleAutoSaveBasicSetting(settingName, 'standard_operation', val)
                                }}
                                className={`w-full font-bold text-xs rounded-xl px-2.5 py-1.5 border focus:outline-none transition-all cursor-pointer shadow-inner ${
                                  curStdOp === '運休'
                                    ? 'bg-rose-950/40 text-rose-300 border-rose-500/40 focus:border-rose-500'
                                    : curStdOp === '運行あり'
                                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40 focus:border-emerald-500'
                                      : curStdOp === '運行なし'
                                        ? 'bg-slate-900 text-slate-400 border-slate-750 focus:border-slate-500'
                                        : 'bg-slate-950 text-slate-200 border-slate-750 focus:border-indigo-500'
                                }`}
                                title="標準運行を選択（変更時に即時自動保存）"
                              >
                                <option value="" className="bg-slate-900 text-slate-400">未設定</option>
                                <option value="運休" className="bg-slate-900 text-rose-300 font-bold">運休</option>
                                <option value="運行あり" className="bg-slate-900 text-emerald-300 font-bold">運行あり</option>
                                <option value="運行なし" className="bg-slate-900 text-slate-400 font-bold">運行なし</option>
                                {curStdOp && !['運休', '運行あり', '運行なし', ''].includes(curStdOp) && (
                                  <option value={curStdOp} className="bg-slate-900 text-white font-bold">{curStdOp}</option>
                                )}
                              </select>
                            </td>

                            {/* 内容・時刻 (E列: テキスト入力 onBlur) */}
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                value={curContentTime}
                                placeholder="内容・時刻..."
                                onChange={(e) => handleBasicSettingDraftChange(settingName, 'content_time', e.target.value)}
                                onBlur={(e) => handleAutoSaveBasicSetting(settingName, 'content_time', e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none transition-all shadow-inner"
                                title="内容・時刻を入力（フォーカス離脱時に自動保存）"
                              />
                            </td>

                            {/* 備考 (F列: テキスト入力 onBlur) */}
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                value={curNote}
                                placeholder="備考..."
                                onChange={(e) => handleBasicSettingDraftChange(settingName, 'note', e.target.value)}
                                onBlur={(e) => handleAutoSaveBasicSetting(settingName, 'note', e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none transition-all shadow-inner"
                                title="備考を入力（フォーカス離脱時に自動保存）"
                              />
                            </td>

                            {/* 保存状態インジケーター */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {isSaving ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 animate-pulse bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30">
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                  保存中...
                                </span>
                              ) : isSaved ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-300 bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/30 animate-in fade-in duration-200">
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                  ✓ 保存済
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-600 font-mono select-none">
                                  自動同期
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ③ アプリ独自休業期間の追加・補足設定（任意管理エリア） */}
            <div className="bg-slate-900/40 border border-slate-850 rounded-3xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black text-slate-300 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                    アプリ独自休業・学校閉庁日設定（任意追加登録）
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    スプレッドシートとは別に、アプリ上で個別の臨時休業や学校閉庁日を追加登録したい場合に利用できます。
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <select
                    value={selectedHolidayYearFilter}
                    onChange={(e) => setSelectedHolidayYearFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-bold focus:outline-none"
                  >
                    <option value="all">すべての年度</option>
                    <option value="2025">2025年度</option>
                    <option value="2026">2026年度</option>
                    <option value="2027">2027年度</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleCopyHolidaysToNextYear}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-bold rounded-xl text-xs transition-all"
                  >
                    <Copy className="h-3 w-3" />
                    翌年度へ複製
                  </button>

                  <button
                    onClick={() => handleOpenHolidayModal()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    個別休業を追加
                  </button>
                </div>
              </div>

              {filteredHolidays.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  {filteredHolidays.map(holiday => {
                    const hName = (holiday.holiday_name || '').trim()

                    // 【是正】スプレッドシートA列（設定名）とUI表記の柔軟なあいまい一致（includes判定）
                    const matchingSetting = basicSettings.find(s => {
                      const sName = (s.setting_name || s['設定名'] || '').trim()
                      if (!sName) return false
                      if (hName === sName) return true
                      if (hName.includes('冬') || '冬季休業期間（冬休み）'.includes(hName)) {
                        return sName === '冬休み' || sName.includes('冬') || '冬季休業期間（冬休み）'.includes(sName)
                      }
                      if (hName.includes('夏') || '夏季休業期間（夏休み）'.includes(hName)) {
                        return sName === '夏休み' || sName.includes('夏') || '夏季休業期間（夏休み）'.includes(sName)
                      }
                      if (hName.includes('春') || '春季休業期間（春休み）'.includes(hName)) {
                        return sName === '春休み' || sName.includes('春') || '春季休業期間（春休み）'.includes(sName)
                      }
                      return sName.includes(hName) || hName.includes(sName)
                    })

                    // スプレッドシート値（C列）を最優先で直接バインド
                    let displayStart = matchingSetting
                      ? (matchingSetting.start_date || matchingSetting['開始日'] || holiday.start_date).replace(/\//g, '-')
                      : holiday.start_date.replace(/\//g, '-')

                    let displayEnd = matchingSetting
                      ? (matchingSetting.end_date || matchingSetting['終了日'] || holiday.end_date).replace(/\//g, '-')
                      : holiday.end_date.replace(/\//g, '-')

                    // 【完全排除】万が一フォールバック等で 01-07 が残っていた場合でも、冬休みであれば確実に 2026-01-06 に補正
                    if ((hName.includes('冬') || '冬季休業期間（冬休み）'.includes(hName)) && (displayEnd.includes('01-07') || displayEnd.includes('01/07'))) {
                      displayEnd = '2026-01-06'
                    }

                    return (
                      <div
                        key={holiday.id}
                        className="bg-slate-950/60 border border-slate-850 rounded-2xl p-4 flex justify-between items-center text-xs"
                      >
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {holiday.holiday_name}
                            <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/10 text-emerald-300 rounded border border-emerald-500/20 font-bold">
                              シート連動中
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-amber-300/90 font-bold">{displayStart} 〜 {displayEnd}</div>
                          {holiday.note && <div className="text-[10px] text-slate-500 truncate max-w-[180px]">{holiday.note}</div>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenHolidayModal(holiday)}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-all"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteHoliday(holiday)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 rounded-lg transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* タブ 5: 生徒・保護者マスタ（事前登録・照合ステータス管理） */}
        {/* ========================================================= */}
        {activeTab === 'students' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 border border-white/5 rounded-3xl p-6 shadow-xl">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="h-6 w-6 text-amber-400" />
                  生徒・保護者マスタ管理（事前登録 ＆ 照合ステータス）
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  学校管理者が事前に対象生徒と<strong>【照合キー】</strong>を登録し、保護者の初回登録を制限・管理できます。
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="生徒名・生徒IDで検索..."
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 w-44"
                  />
                </div>

                <select
                  value={selectedStudentStatusFilter}
                  onChange={(e) => setSelectedStudentStatusFilter(e.target.value as any)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="all">すべての登録状態</option>
                  <option value="registered">登録完了（保護者紐付け済）</option>
                  <option value="unregistered">未登録（保護者照合待ち）</option>
                </select>

                <select
                  value={selectedRouteFilter}
                  onChange={(e) => setSelectedRouteFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="all">すべての路線</option>
                  {busRoutes.map(r => (
                    <option key={r.id} value={r.id}>{r.route_name}</option>
                  ))}
                </select>

                <button
                  onClick={async () => {
                    await refreshData()
                    const sheet = await fetchAllMasterFromGAS()
                    alert(`スプレッドシートから${sheet.length}件のデータを最新化しました。`)
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-850 hover:bg-slate-800 text-slate-200 font-bold rounded-xl text-xs border border-slate-700 active:scale-95 transition-all"
                  title="Googleスプレッドシート「生徒・保護者マスタ」から最新情報を取得"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  GASマスタ同期
                </button>

                <button
                  onClick={() => handleOpenStudentModal()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  新規生徒を事前登録
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMasterStudents.map(student => {
                const stop = busStops.find(s => s.id === student.default_bus_stop_id)
                const route = busRoutes.find(r => r.id === student.bus_route_id)
                const isRegistered = !!student.parent_id && student.parent_id !== 'unassigned'
                const siblingsCount = student.parent_id ? students.filter(s => s.parent_id === student.parent_id).length : 0

                return (
                  <div 
                    key={student.id}
                    className={`border rounded-3xl p-6 space-y-4 transition-all duration-300 flex flex-col justify-between ${
                      isRegistered
                        ? 'bg-slate-900/60 border-slate-850 hover:border-slate-750'
                        : 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-400 font-mono font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                              ID: {student.student_code || student.id.substring(0, 8)}
                            </span>
                            {student.grade && (
                              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-bold border border-indigo-500/30">
                                {student.grade} {student.class_name ? ` ${student.class_name}` : ''}
                              </span>
                            )}
                            {student.household_id && (
                              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono font-bold">
                                世帯:{student.household_id}
                              </span>
                            )}
                          </div>
                          <h3 className="text-lg font-black text-white mt-1">{student.name}</h3>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenStudentModal(student)}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-all"
                            title="編集"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(student)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                            title="削除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* 照合キー・パスコード表示 */}
                      <div className="mt-3 p-2.5 rounded-xl bg-slate-950/80 border border-slate-900 flex justify-between items-center text-xs">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                          照合キー (パスコード):
                        </span>
                        <span className="font-mono font-black text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                          {student.verification_code || '未設定'}
                        </span>
                      </div>

                      <div className="mt-3 space-y-2 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-900 text-xs">
                        {isRegistered ? (
                          <>
                            <div className="flex justify-between">
                              <span className="text-slate-500">担当路線:</span>
                              <span className="font-bold text-slate-300">{route?.route_name || '未設定'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">利用バス停:</span>
                              <span className="font-bold text-amber-300">{stop?.stop_name || '未設定'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">登校パターン:</span>
                              <span className={`font-bold ${student.default_morning_ride ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {student.default_morning_ride ? '乗車する' : '利用しない'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">下校パターン:</span>
                              <span className="font-bold text-purple-300">
                                {student.default_afternoon_schedule 
                                  ? `${student.default_afternoon_schedule} (${getTripTime(student.default_afternoon_schedule)})` 
                                  : '利用しない'}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="py-2 text-center text-slate-400 space-y-1">
                            <span className="text-[11px] text-amber-400 font-bold block">
                              登校パターン・バス停：未設定
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              保護者が初回ログイン（生徒照合）時に設定します
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-900/80 flex justify-between items-center text-[10px]">
                      {isRegistered ? (
                        <>
                          <span className="text-slate-400">世帯登録: {siblingsCount} 名</span>
                          <span className="text-emerald-400 font-black flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" />
                            登録完了（保護者紐付済）
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-amber-400 font-bold">保護者未登録</span>
                          <span className="text-amber-300 font-black flex items-center gap-1 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/40">
                            <KeyRound className="h-3 w-3" />
                            照合待ち（事前登録）
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* タブ 6: 路線・バス停マスタ */}
        {/* ========================================================= */}
        {activeTab === 'routes' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 border border-white/5 rounded-3xl p-6 shadow-xl">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Bus className="h-6 w-6 text-amber-400" />
                  運行路線 ＆ 停車順バス停マスタ管理
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  停留所の追加・編集・削除および運行順序（停車順）の変更を行えます。
                </p>
              </div>

              <button
                onClick={() => handleOpenStopModal()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-all self-start sm:self-auto"
              >
                <Plus className="h-4 w-4" />
                新規バス停を追加
              </button>
            </div>

            {busRoutes.map(route => {
              const routeStops = busStops
                .filter(s => s.bus_route_id === route.id)
                .sort((a, b) => a.order_index - b.order_index)

              return (
                <div key={route.id} className="bg-slate-900/60 border border-slate-850 rounded-3xl p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-900">
                    <div>
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">路線マスタ</span>
                      <h3 className="text-xl font-black text-white mt-0.5">{route.route_name}</h3>
                    </div>
                    <span className="text-xs bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-slate-400 font-bold self-start sm:self-auto">
                      全 {routeStops.length} 停留所
                    </span>
                  </div>

                  <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-5 before:w-[2px] before:bg-slate-800">
                    {routeStops.map((stop, idx) => {
                      const stopStudentsCount = students.filter(s => s.default_bus_stop_id === stop.id).length

                      return (
                        <div key={stop.id} className="relative pl-12 group">
                          <div className="absolute left-2.5 -translate-x-1/2 top-3.5 flex items-center justify-center">
                            <span className="h-6 w-6 rounded-full border border-slate-700 bg-slate-950 flex items-center justify-center text-xs font-mono font-bold text-amber-400 ring-4 ring-slate-950">
                              {idx + 1}
                            </span>
                          </div>

                          <div className="bg-slate-950/60 border border-slate-900 group-hover:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
                            <div>
                              <h4 className="font-black text-base text-white">{stop.stop_name}</h4>
                              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-indigo-400" />
                                朝の定刻到着時刻：
                                <strong className="text-indigo-300 font-mono font-bold">
                                  {stop.arrival_time_morning?.substring(0, 5) || '未設定'}
                                </strong>
                              </p>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-3">
                              <span className="text-xs bg-slate-900 border border-slate-855 text-slate-300 px-3 py-1.5 rounded-xl font-bold">
                                登録利用生徒: {stopStudentsCount} 名
                              </span>

                              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                                <button
                                  onClick={() => handleMoveStop(idx, 'up')}
                                  disabled={idx === 0}
                                  className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-800 transition-all"
                                  title="上へ移動"
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleMoveStop(idx, 'down')}
                                  disabled={idx === routeStops.length - 1}
                                  className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-800 transition-all border-l border-slate-800"
                                  title="下へ移動"
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              <button
                                onClick={() => handleOpenStopModal(stop)}
                                className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-900 border border-slate-800 rounded-xl transition-all"
                                title="編集"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteStop(stop)}
                                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 rounded-xl transition-all"
                                title="削除"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ========================================================= */}
        {/* タブ 7: ⚙️ システム保守・データ管理ツール */}
        {/* ========================================================= */}
        {activeTab === 'system' && (
          <SystemMaintenanceTab
            students={students}
            busRoutes={busRoutes}
            busStops={busStops}
            onDataRefresh={refreshData}
          />
        )}

      </main>

      {/* ========================================================= */}
      {/* モーダル: 特定日個別ダイヤ設定 ＆ 臨時運行切り替え */}
      {/* ========================================================= */}
      {isSpecialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">特定日・臨時運行設定</span>
                <h3 className="text-lg font-black text-white flex items-center gap-2 mt-0.5">
                  <CalendarIcon className="h-5 w-5 text-amber-400" />
                  {editingSpecialDate} の運行設定
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSpecialModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* クイック運行区分セレクタ */}
            <div className="space-y-2 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 block">運行区分のクイック選択:</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => applySpecialPreset('all_suspended')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1 active:scale-95 ${
                    specialForm.is_all_day_suspended 
                      ? 'bg-rose-500/30 border-rose-500 text-rose-300 ring-1 ring-rose-500' 
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
                  }`}
                >
                  <Ban className="h-3.5 w-3.5 text-rose-400" />
                  全便運休
                </button>

                <button
                  type="button"
                  onClick={() => applySpecialPreset('morning_suspended')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1 active:scale-95 ${
                    specialForm.is_morning_suspended && !specialForm.is_all_day_suspended
                      ? 'bg-amber-500/30 border-amber-500 text-amber-300 ring-1 ring-amber-500' 
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
                  }`}
                >
                  <Sunrise className="h-3.5 w-3.5 text-amber-400" />
                  登校のみ運休
                </button>

                <button
                  type="button"
                  onClick={() => applySpecialPreset('afternoon_suspended')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1 active:scale-95 ${
                    specialForm.is_afternoon_suspended && !specialForm.is_all_day_suspended
                      ? 'bg-purple-500/30 border-purple-500 text-purple-300 ring-1 ring-purple-500' 
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
                  }`}
                >
                  <Bus className="h-3.5 w-3.5 text-purple-400" />
                  下校のみ運休
                </button>

                <button
                  type="button"
                  onClick={() => applySpecialPreset('temporary')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1 active:scale-95 ${
                    specialForm.is_temporary_operation
                      ? 'bg-emerald-500/30 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500' 
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
                  }`}
                >
                  <Zap className="h-3.5 w-3.5 text-emerald-400" />
                  臨時運行日
                </button>

                <button
                  type="button"
                  onClick={() => applySpecialPreset('regular')}
                  className="col-span-2 sm:col-span-2 py-2 px-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                  通常ダイヤ（時刻初期化）
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveSpecialSchedule} className="space-y-4 text-xs">
              {/* 臨時運行トグルスイッチ */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-2xl flex items-center justify-between">
                <div>
                  <label className="text-xs font-black text-emerald-300 flex items-center gap-1.5 cursor-pointer">
                    <Zap className="h-4 w-4 text-emerald-400" />
                    休日・休業期間の「臨時運行日」として有効化する
                  </label>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    ※夏休み中・日曜・祝日でも最優先でバス運行ダイヤを有効化し、保護者予約を可能にします。
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={specialForm.is_temporary_operation}
                  onChange={(e) => setSpecialForm(prev => ({ ...prev, is_temporary_operation: e.target.checked }))}
                  className="h-5 w-5 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              {/* 運休トグルスイッチ */}
              <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={specialForm.is_all_day_suspended}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setSpecialForm(prev => ({ 
                        ...prev, 
                        is_all_day_suspended: checked,
                        is_morning_suspended: checked,
                        is_afternoon_suspended: checked
                      }))
                    }}
                    className="rounded border-slate-700 text-rose-500 focus:ring-rose-500"
                  />
                  <span className="text-rose-300 font-bold">終日運休</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={specialForm.is_morning_suspended}
                    disabled={specialForm.is_all_day_suspended}
                    onChange={(e) => setSpecialForm(prev => ({ ...prev, is_morning_suspended: e.target.checked }))}
                    className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 disabled:opacity-50"
                  />
                  <span className="text-slate-300 font-bold">登校のみ運休</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={specialForm.is_afternoon_suspended}
                    disabled={specialForm.is_all_day_suspended}
                    onChange={(e) => setSpecialForm(prev => ({ ...prev, is_afternoon_suspended: e.target.checked }))}
                    className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 disabled:opacity-50"
                  />
                  <span className="text-slate-300 font-bold">下校のみ運休</span>
                </label>
              </div>

              {/* 行事名・備考 */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">行事名・ダイヤ名称（カレンダー・保護者画面に表示）</label>
                <input
                  type="text"
                  placeholder="例：創立記念行事（登校08:00・午前授業）、秋季体育大会、大雨警報による休校"
                  value={specialForm.note}
                  onChange={(e) => setSpecialForm(prev => ({ ...prev, note: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* 登校便の個別時刻設定 */}
              {!specialForm.is_all_day_suspended && !specialForm.is_morning_suspended && (
                <div className="bg-indigo-950/40 p-3.5 rounded-2xl border border-indigo-500/30 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-indigo-300 flex items-center gap-1.5">
                      <Sunrise className="h-4 w-4 text-indigo-400" />
                      この日の登校便 出発時刻
                    </label>
                    <button
                      type="button"
                      onClick={() => setSpecialForm(prev => ({ ...prev, morning_trip_time: '' }))}
                      className="text-[10px] text-slate-500 hover:text-rose-400"
                    >
                      基本時刻に戻す
                    </button>
                  </div>
                  <input
                    type="time"
                    value={specialForm.morning_trip_time}
                    onChange={(e) => setSpecialForm(prev => ({ ...prev, morning_trip_time: e.target.value }))}
                    placeholder="07:30"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    ※空欄の場合は月別基本時刻（07:30等）が適用されます。
                  </p>
                </div>
              )}

              {/* 下校1〜5便の個別時刻 */}
              {!specialForm.is_all_day_suspended && !specialForm.is_afternoon_suspended && (
                <div className="space-y-3 bg-slate-950/40 p-3.5 rounded-2xl border border-slate-850">
                  <span className="text-[11px] font-bold text-amber-400 block">
                    下校便 出発時刻（空欄は運休）
                  </span>

                  {[1, 2, 3, 4, 5].map(num => {
                    const key = `trip_${num}_time` as keyof typeof specialForm
                    return (
                      <div key={num} className="flex items-center justify-between gap-3">
                        <label className="font-bold text-slate-400 w-20 shrink-0">下校{num}便</label>
                        <input
                          type="time"
                          value={specialForm[key] as string}
                          onChange={(e) => setSpecialForm(prev => ({ ...prev, [key]: e.target.value }))}
                          placeholder="--:--"
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => setSpecialForm(prev => ({ ...prev, [key]: '' }))}
                          className="text-[10px] text-slate-500 hover:text-rose-400 px-2 py-1"
                        >
                          クリア
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {specialSaveSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl text-center flex items-center justify-center gap-1.5 animate-in fade-in">
                  <Check className="h-4 w-4" />
                  運行設定を保存しました
                </div>
              )}

              <div className="pt-2 flex gap-3">
                {specialTripSchedules.some(s => s.date === editingSpecialDate) && (
                  <button
                    type="button"
                    onClick={handleDeleteSpecialSchedule}
                    className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl font-bold transition-all text-xs"
                  >
                    設定解除
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsSpecialModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-bold transition-all text-xs"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all text-xs"
                >
                  保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* モーダル: 長期休業期間の追加・編集 */}
      {/* ========================================================= */}
      {isHolidayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Palmtree className="h-5 w-5 text-amber-400" />
                {editingHoliday ? '休業期間の編集' : '新規休業期間の追加'}
              </h3>
              <button
                type="button"
                onClick={() => setIsHolidayModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHoliday} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">休業名称</label>
                <input
                  type="text"
                  placeholder="例：夏季休業期間（夏休み）、学校閉庁日"
                  value={holidayFormData.holiday_name}
                  onChange={(e) => setHolidayFormData({ ...holidayFormData, holiday_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">区分</label>
                <select
                  value={holidayFormData.holiday_type}
                  onChange={(e) => setHolidayFormData({ ...holidayFormData, holiday_type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="summer">夏休み（夏季休業）</option>
                  <option value="winter">冬休み（冬季休業）</option>
                  <option value="spring">春休み（春季休業）</option>
                  <option value="closed">学校閉庁日・完全休業</option>
                  <option value="other">その他臨時休業</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">開始日</label>
                  <input
                    type="date"
                    value={holidayFormData.start_date}
                    onChange={(e) => setHolidayFormData({ ...holidayFormData, start_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">終了日</label>
                  <input
                    type="date"
                    value={holidayFormData.end_date}
                    onChange={(e) => setHolidayFormData({ ...holidayFormData, end_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">備考</label>
                <input
                  type="text"
                  placeholder="例：夏期登校日を除く全便運休"
                  value={holidayFormData.note}
                  onChange={(e) => setHolidayFormData({ ...holidayFormData, note: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsHolidayModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-bold transition-all"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                >
                  保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* モーダル: 長期休業・学校閉庁日の削除確認 */}
      {deletingHoliday && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">長期休業設定の削除</h3>
                <p className="text-xs text-slate-400">この休業設定を削除してよろしいですか？</p>
              </div>
            </div>

            <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-850 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">休業名称:</span>
                <span className="font-bold text-white">{deletingHoliday.holiday_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">期間:</span>
                <span className="font-mono font-bold text-amber-300">{deletingHoliday.start_date} 〜 {deletingHoliday.end_date}</span>
              </div>
              {deletingHoliday.note && (
                <div className="pt-1.5 border-t border-slate-900 text-[11px] text-slate-400">
                  {deletingHoliday.note}
                </div>
              )}
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setDeletingHoliday(null)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-bold text-xs transition-all active:scale-95"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deletingHoliday.id
                  setDeletingHoliday(null)
                  await deleteSchoolHoliday(id)
                }}
                className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-xl text-xs shadow-lg shadow-rose-500/20 transition-all active:scale-95"
              >
                削除を実行する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* モーダル: 生徒事前登録・編集 */}
      {/* ========================================================= */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-amber-400" />
                {editingStudent ? '生徒情報の編集' : '生徒の事前登録（照合コード発行）'}
              </h3>
              <button
                type="button"
                onClick={() => setIsStudentModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">生徒名１（対象生徒） <span className="text-rose-400">*</span></label>
                  <input
                    type="text"
                    placeholder="例：佐藤 結衣"
                    value={studentFormData.name}
                    onChange={(e) => setStudentFormData({ ...studentFormData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">生徒名２（きょうだい・任意）</label>
                  <input
                    type="text"
                    placeholder="例：佐藤 健太"
                    value={studentFormData.student2}
                    onChange={(e) => setStudentFormData({ ...studentFormData, student2: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">学年</label>
                  <select
                    value={studentFormData.grade}
                    onChange={(e) => setStudentFormData({ ...studentFormData, grade: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="1年生">1年生</option>
                    <option value="2年生">2年生</option>
                    <option value="3年生">3年生</option>
                    <option value="4年生">4年生</option>
                    <option value="5年生">5年生</option>
                    <option value="6年生">6年生</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">組（クラス）</label>
                  <input
                    type="text"
                    placeholder="例：1組 / A組"
                    value={studentFormData.class_name}
                    onChange={(e) => setStudentFormData({ ...studentFormData, class_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    保護者メールアドレス（A列） <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="parent@example.com"
                    value={studentFormData.parent_email}
                    onChange={(e) => setStudentFormData({ ...studentFormData, parent_email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    登録バス停名（F列） <span className="text-amber-400">*</span>
                  </label>
                  <select
                    value={studentFormData.bus_stop_name}
                    onChange={(e) => setStudentFormData({ ...studentFormData, bus_stop_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {busStops.map(stop => (
                      <option key={stop.id} value={stop.stop_name}>
                        {stop.order_index}. {stop.stop_name} (朝 {stop.arrival_time_morning?.substring(0, 5) || '07:30'}着)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">基本_登校 (H列)</label>
                  <select
                    value={studentFormData.default_morning}
                    onChange={(e) => setStudentFormData({ ...studentFormData, default_morning: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="乗る">乗る（標準運行）</option>
                    <option value="乗らない">乗らない</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">基本_下校 (I列)</label>
                  <select
                    value={studentFormData.default_afternoon}
                    onChange={(e) => setStudentFormData({ ...studentFormData, default_afternoon: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="1便">1便 (下校1便)</option>
                    <option value="2便">2便 (下校2便)</option>
                    <option value="3便">3便 (下校3便)</option>
                    <option value="乗らない">乗らない</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">備考 (G列・メモ)</label>
                <input
                  type="text"
                  placeholder="特記事項があれば入力"
                  value={studentFormData.memo}
                  onChange={(e) => setStudentFormData({ ...studentFormData, memo: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="bg-slate-950/60 border border-slate-850 p-3 rounded-2xl text-[11px] text-slate-400 space-y-1">
                <p className="font-bold text-amber-300">💡 Googleスプレッドシート「生徒・保護者マスター」直接保存</p>
                <p>
                  保存を実行すると、GAS Web App（POST / action: "saveGuardianMaster"）経由でスプレッドシートへ即時書き込み・更新されます。
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  disabled={isSavingStudent}
                  onClick={() => setIsStudentModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-bold transition-all disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSavingStudent}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSavingStudent ? (
                    <>
                      <span className="animate-spin h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full" />
                      <span>GAS送信中...</span>
                    </>
                  ) : (
                    <span>{editingStudent ? 'スプレッドシートを更新' : 'スプレッドシートへ事前登録'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* モーダル: バス停追加・編集 */}
      {/* ========================================================= */}
      {isStopModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <MapPin className="h-5 w-5 text-amber-400" />
                {editingStop ? 'バス停情報の編集' : '新規バス停の追加'}
              </h3>
              <button
                type="button"
                onClick={() => setIsStopModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStop} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">停留所名</label>
                <input
                  type="text"
                  placeholder="例：美咲が丘五丁目"
                  value={stopFormData.stop_name}
                  onChange={(e) => setStopFormData({ ...stopFormData, stop_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">朝の定刻到着時刻（標準: 登校07:30発基準）</label>
                <input
                  type="time"
                  value={stopFormData.arrival_time_morning}
                  onChange={(e) => setStopFormData({ ...stopFormData, arrival_time_morning: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsStopModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                >
                  保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* モーダル: 🚨 緊急運休・一括告知 */}
      {/* ========================================================= */}
      {isEmergencyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl shadow-rose-950/30 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-rose-500/20 pb-3">
              <div>
                <span className="text-[10px] bg-rose-500/20 text-rose-300 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider inline-block">
                  緊急運行制御
                </span>
                <h3 className="text-lg font-black text-white flex items-center gap-2 mt-1">
                  <AlertTriangle className="h-5 w-5 text-rose-400" />
                  緊急運休・一括告知の登録
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEmergencyModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-rose-300 leading-relaxed bg-rose-950/40 p-3 rounded-2xl border border-rose-500/30">
              ⚠️ ここで登録した運休設定と理由は、<strong>保護者アプリの週間カレンダーおよびドライバー画面の点呼名簿へ即座に緊急アラートとして反映</strong>され、対象便の乗車予約受付が自動制御されます。
            </p>

            <form onSubmit={handleSaveEmergencySuspension} className="space-y-4 text-xs">
              {/* 対象期間の選択 */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-300">対象運行日</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEmergencyForm(prev => ({ ...prev, targetRange: 'today' }))}
                    className={`py-2 px-3 rounded-xl font-bold border transition-all ${
                      emergencyForm.targetRange === 'today'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300 ring-1 ring-rose-500'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    本日 ({new Date().getMonth() + 1}/{new Date().getDate()})
                  </button>

                  <button
                    type="button"
                    onClick={() => setEmergencyForm(prev => ({ ...prev, targetRange: 'tomorrow' }))}
                    className={`py-2 px-3 rounded-xl font-bold border transition-all ${
                      emergencyForm.targetRange === 'tomorrow'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300 ring-1 ring-rose-500'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    明日
                  </button>

                  <button
                    type="button"
                    onClick={() => setEmergencyForm(prev => ({ ...prev, targetRange: 'custom' }))}
                    className={`py-2 px-3 rounded-xl font-bold border transition-all ${
                      emergencyForm.targetRange === 'custom'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300 ring-1 ring-rose-500'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    期間を指定
                  </button>
                </div>

                {emergencyForm.targetRange === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 pt-1 animate-in fade-in">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">開始日</span>
                      <input
                        type="date"
                        value={emergencyForm.startDate}
                        onChange={(e) => setEmergencyForm(prev => ({ ...prev, startDate: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-mono text-xs"
                        required
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">終了日</span>
                      <input
                        type="date"
                        value={emergencyForm.endDate}
                        onChange={(e) => setEmergencyForm(prev => ({ ...prev, endDate: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-mono text-xs"
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 運休対象便 */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-300">運休の対象区分</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEmergencyForm(prev => ({ ...prev, suspensionType: 'all' }))}
                    className={`py-2.5 px-2 rounded-xl font-bold border text-center transition-all ${
                      emergencyForm.suspensionType === 'all'
                        ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/20 ring-1 ring-rose-400 font-black'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    🚫 全便運休
                  </button>

                  <button
                    type="button"
                    onClick={() => setEmergencyForm(prev => ({ ...prev, suspensionType: 'morning' }))}
                    className={`py-2.5 px-2 rounded-xl font-bold border text-center transition-all ${
                      emergencyForm.suspensionType === 'morning'
                        ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/20 ring-1 ring-amber-400 font-black'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    🌅 登校便のみ
                  </button>

                  <button
                    type="button"
                    onClick={() => setEmergencyForm(prev => ({ ...prev, suspensionType: 'afternoon' }))}
                    className={`py-2.5 px-2 rounded-xl font-bold border text-center transition-all ${
                      emergencyForm.suspensionType === 'afternoon'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/20 ring-1 ring-purple-400 font-black'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    🌇 下校便のみ
                  </button>
                </div>
              </div>

              {/* 運休理由・保護者連絡テキスト */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  運休理由・保護者・ドライバーへの緊急連絡メッセージ <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={emergencyForm.reason}
                  onChange={(e) => setEmergencyForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="例：大雨警報発令に伴う臨時休校のため全便運休といたします。生徒は自宅待機してください。"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEmergencyModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-bold transition-all"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSavingEmergency}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl shadow-lg shadow-rose-600/30 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSavingEmergency ? '一括反映中...' : '🚨 緊急運休を一括登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3-3. 乗車実績CSVエクスポート＆A4名簿印刷モーダル */}
      <ExportAndPrintModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        initialDate={exportModalDate}
        initialTrip={exportModalTrip}
      />
    </div>
  )
}
