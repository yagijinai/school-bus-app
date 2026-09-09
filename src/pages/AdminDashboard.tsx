import React, { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { 
  Bus, Calendar, FileSpreadsheet, Users, MapPin, Clock,
  RefreshCw, LogOut, Check, 
  Sun, Snowflake, Palmtree, Ban, Filter
} from 'lucide-react'
import type { BasicSettingRow, GuardianMasterRow, SchoolTimetableRow } from '../types/spreadsheet'
import { toSlashDate, toHyphenDate } from '../lib/spreadsheetApi'

export const AdminDashboard: React.FC = () => {
  const { 
    user, logout, basicSettings, schedules, 
    guardianMaster, busStops, schoolTimetable,
    saveBasicSetting, saveGuardianMaster, saveSchoolTimetable,
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
      // 登校便
      if (row.morning_status === '乗る') {
        morningCount++
      }
      // 下校便
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
    const defMorning = field === 'default_morning' ? val : (draft.default_morning !== undefined ? draft.default_morning : (row?.default_morning || '乗る'))
    const defAfternoon = field === 'default_afternoon' ? val : (draft.default_afternoon !== undefined ? draft.default_afternoon : (row?.default_afternoon || '1便'))
    const memo = field === 'note' ? val : (draft.note !== undefined ? draft.note : (row?.note || ''))

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
  // 4. 学校用時刻表マスタ インライン編集
  // ==========================================
  const [timetableDrafts, setTimetableDrafts] = useState<Record<string, Partial<SchoolTimetableRow>>>({})
  const [savingTimetableDate, setSavingTimetableDate] = useState<string | null>(null)
  const [savedTimetableDate, setSavedTimetableDate] = useState<string | null>(null)

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
        morning_trip: morningTrip,
        afternoon_trip_1: trip1,
        afternoon_trip_2: trip2,
        afternoon_trip_3: trip3,
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
      {/* ========================================================= */}
      {activeTab === 'guardians' && (
        <div className="bg-slate-900/70 border border-slate-850 rounded-3xl p-6 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-400" />
              生徒・保護者マスター インライン編集＆即時自動保存
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              バス停・基本運行のプルダウン変更時、備考の入力完了時（フォーカス離脱時）に即座にGAS（action: saveGuardianMaster）へ送信されます。
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3 min-w-[140px]">保護者メール (A列)</th>
                  <th className="py-3 px-3 min-w-[140px]">登録生徒 (B〜E列)</th>
                  <th className="py-3 px-3 min-w-[180px]">登録バス停名 (F列)</th>
                  <th className="py-3 px-3 min-w-[110px]">基本_登校 (H列)</th>
                  <th className="py-3 px-3 min-w-[120px]">基本_下校 (I列)</th>
                  <th className="py-3 px-3 min-w-[160px]">備考 (G列)</th>
                  <th className="py-3 px-3 w-24 text-center">保存状況</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {guardianMaster.map((g, idx) => {
                  const email = g.parent_email
                  const draft = guardianDrafts[email] || {}
                  const curBusStop = draft.bus_stop_name !== undefined ? draft.bus_stop_name : g.bus_stop_name
                  const curMorning = draft.default_morning !== undefined ? draft.default_morning : g.default_morning
                  const curAfternoon = draft.default_afternoon !== undefined ? draft.default_afternoon : g.default_afternoon
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
                      {/* 基本_登校 */}
                      <td className="py-3 px-3">
                        <select
                          value={curMorning}
                          onChange={(e) => {
                            const val = e.target.value
                            handleGuardianDraftChange(email, 'default_morning', val)
                            handleSaveGuardian(email, 'default_morning', val)
                          }}
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-amber-400 cursor-pointer w-full"
                        >
                          <option value="乗る">乗る</option>
                          <option value="乗らない">乗らない</option>
                          <option value="">空白</option>
                        </select>
                      </td>
                      {/* 基本_下校 */}
                      <td className="py-3 px-3">
                        <select
                          value={curAfternoon}
                          onChange={(e) => {
                            const val = e.target.value
                            handleGuardianDraftChange(email, 'default_afternoon', val)
                            handleSaveGuardian(email, 'default_afternoon', val)
                          }}
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-amber-400 cursor-pointer w-full"
                        >
                          <option value="1便">1便</option>
                          <option value="2便">2便</option>
                          <option value="3便">3便</option>
                          <option value="乗らない">乗らない</option>
                          <option value="">空白</option>
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
      {/* タブ 4: 学校用時刻表マスタ（インライン編集＆即時自動保存） */}
      {/* ========================================================= */}
      {activeTab === 'timetable' && (
        <div className="bg-slate-900/70 border border-slate-850 rounded-3xl p-6 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-sky-400" />
              学校用時刻表マスタ インライン編集＆即時自動保存
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              スプレッドシート「学校用時刻表」シートの全列データです。時刻や行事備考を変更すると即座にGAS（action: saveSchoolTimetable）へ送信されます。
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3 min-w-[110px]">日付 (A列)</th>
                  <th className="py-3 px-3 min-w-[100px]">登校便 (B列)</th>
                  <th className="py-3 px-3 min-w-[100px]">下校1便 (C列)</th>
                  <th className="py-3 px-3 min-w-[100px]">下校2便 (D列)</th>
                  <th className="py-3 px-3 min-w-[100px]">下校3便 (E列)</th>
                  <th className="py-3 px-3 min-w-[150px]">備考 (F列)</th>
                  <th className="py-3 px-3 min-w-[150px]">カレンダー表示用 (G列)</th>
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

      {/* ========================================================= */}
      {/* タブ 5: バス停マスタ一覧 */}
      {/* ========================================================= */}
      {activeTab === 'stops' && (
        <div className="bg-slate-900/70 border border-slate-850 rounded-3xl p-6 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <MapPin className="h-5 w-5 text-emerald-400" />
              バス停マスタ（停車順序一覧）
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              スプレッドシート「バス停マスタ」シートから直接取得したデータです。
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3 w-16 text-center">順序</th>
                  <th className="py-3 px-3">バス停名 (A列)</th>
                  <th className="py-3 px-3">到着予定時刻 (C列)</th>
                  <th className="py-3 px-3">住所 (B列)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {busStops.map((stop, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 text-center font-mono text-amber-400 font-bold">{stop.order || idx + 1}</td>
                    <td className="py-3 px-3 font-bold text-white text-sm">{stop.name}</td>
                    <td className="py-3 px-3 font-mono text-emerald-300 font-bold">{stop.arrival_time_morning || '-'}</td>
                    <td className="py-3 px-3 text-slate-400">{stop.address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
