import React, { useState, useMemo, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import {
  Bus,
  Calendar,
  MapPin,
  CheckCircle2,
  Circle,
  RefreshCw,
  LogOut,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCheck
} from 'lucide-react'
import { RoleSwitcher } from '../components/RoleSwitcher'
import { SchoolTimetableModal } from '../components/SchoolTimetableModal'
import { formatTimeToHHmm, isMonthPublished } from '../lib/spreadsheetApi'
import { getJapaneseHolidayName } from '../lib/japaneseHolidays'

export const DriverDashboard: React.FC = () => {
  const {
    user,
    logout,
    refreshAll,
    syncing,
    schedules,
    busStops,
    guardianMaster,
    basicSettings,
    schoolTimetable,
    recordBoarding
  } = useApp()

  // 今日の日付 (YYYY/MM/DD)
  const getTodayStr = () => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}/${m}/${day}`
  }

  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr())
  const [selectedTrip, setSelectedTrip] = useState<'morning' | 'afternoon_1' | 'afternoon_2' | 'afternoon_3'>('morning')
  // 点呼チェック状態 (運転中のローカル確認用メモリステート)
  const [checkedStudents, setCheckedStudents] = useState<Record<string, boolean>>({})
  // バス停カードの折りたたみ状態（0名バス停はデフォルト折りたたみ）
  const [collapsedStops, setCollapsedStops] = useState<Record<string, boolean>>({})

  // 月間時刻表 閲覧モーダル
  const [isTimetableModalOpen, setIsTimetableModalOpen] = useState(false)

  const selectedYearMonth = useMemo(() => {
    return selectedDate.slice(0, 7) // YYYY/MM
  }, [selectedDate])

  const isSelectedMonthPublished = useMemo(() => {
    return isMonthPublished(selectedYearMonth, basicSettings)
  }, [selectedYearMonth, basicSettings])

  // 日付の前後移動
  const changeDateByDays = (days: number) => {
    const parts = selectedDate.split('/').map(Number)
    const d = new Date(parts[0], parts[1] - 1, parts[2] + days)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    setSelectedDate(`${y}/${m}/${day}`)
  }

  // 選択日の曜日
  const selectedDayOfWeekStr = useMemo(() => {
    const parts = selectedDate.split('/').map(Number)
    if (parts.length < 3) return ''
    const d = new Date(parts[0], parts[1] - 1, parts[2])
    const weekDays = ['日', '月', '火', '水', '木', '金', '土']
    return weekDays[d.getDay()]
  }, [selectedDate])

  // 祝日判定
  const holidayName = useMemo(() => {
    return getJapaneseHolidayName(selectedDate)
  }, [selectedDate])

  // 運休判定
  const holidayInfo = useMemo(() => {
    const target = selectedDate.replace(/-/g, '/')
    for (const b of basicSettings) {
      if (!b.start_date || !b.end_date) continue
      const s = b.start_date.replace(/-/g, '/')
      const e = b.end_date.replace(/-/g, '/')
      if (target >= s && target <= e) {
        return b
      }
    }
    return null
  }, [selectedDate, basicSettings])

  // 学校用時刻表の該当日データ
  const schoolTimetableRow = useMemo(() => {
    const target = selectedDate.replace(/-/g, '/')
    return schoolTimetable.find(t => t.date.replace(/-/g, '/') === target)
  }, [selectedDate, schoolTimetable])

  // 便ごとの発車時刻文字列
  const tripTimeStr = useMemo(() => {
    if (selectedTrip === 'morning') {
      return schoolTimetableRow?.morning_trip ? formatTimeToHHmm(schoolTimetableRow.morning_trip) : ''
    }
    if (selectedTrip === 'afternoon_1') {
      return schoolTimetableRow?.afternoon_trip_1 ? formatTimeToHHmm(schoolTimetableRow.afternoon_trip_1) : ''
    }
    if (selectedTrip === 'afternoon_2') {
      return schoolTimetableRow?.afternoon_trip_2 ? formatTimeToHHmm(schoolTimetableRow.afternoon_trip_2) : ''
    }
    if (selectedTrip === 'afternoon_3') {
      return schoolTimetableRow?.afternoon_trip_3 ? formatTimeToHHmm(schoolTimetableRow.afternoon_trip_3) : ''
    }
    return ''
  }, [selectedTrip, schoolTimetableRow])

  // 選択日の全乗車生徒の割り出し
  const tripPassengers = useMemo(() => {
    const list: {
      studentName: string
      busStopName: string
      note: string
      parentEmail: string
    }[] = []

    // 1. 登録されている全生徒を走査
    guardianMaster.forEach(guardian => {
      guardian.student_names.forEach(student => {
        if (!student) return

        // 運行予定カレンダーで該当日・該当生徒のレコードを照合
        const sched = schedules.find(
          s => s.student_name === student && s.date.replace(/-/g, '/') === selectedDate.replace(/-/g, '/')
        )

        let isRiding = false
        let note = ''

        if (sched) {
          note = sched.note
          if (selectedTrip === 'morning') {
            isRiding = sched.morning_status === '乗る'
          } else if (selectedTrip === 'afternoon_1') {
            isRiding = sched.afternoon_status !== '乗らない' && !!sched.afternoon_trip_1
          } else if (selectedTrip === 'afternoon_2') {
            isRiding = sched.afternoon_status !== '乗らない' && !!sched.afternoon_trip_2
          } else if (selectedTrip === 'afternoon_3') {
            isRiding = sched.afternoon_status !== '乗らない' && !!sched.afternoon_trip_3
          }
        } else {
          // 未予約日の場合は「生徒・保護者マスター」の基本設定を適用
          if (selectedTrip === 'morning') {
            isRiding = guardian.default_morning === '乗る'
          } else if (selectedTrip === 'afternoon_1') {
            isRiding = guardian.default_afternoon.includes('1便')
          } else if (selectedTrip === 'afternoon_2') {
            isRiding = guardian.default_afternoon.includes('2便')
          } else if (selectedTrip === 'afternoon_3') {
            isRiding = guardian.default_afternoon.includes('3便')
          }
        }

        if (isRiding) {
          list.push({
            studentName: student,
            busStopName: guardian.bus_stop_name || '未設定',
            note,
            parentEmail: guardian.parent_email
          })
        }
      })
    })

    return list
  }, [selectedDate, selectedTrip, schedules, guardianMaster])

  // バス停順（order昇順）にグループ化
  const sortedBusStopsWithStudents = useMemo(() => {
    const stops = [...busStops].sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999))
    
    // 定義されているバス停
    const grouped = stops.map(stop => {
      const studentsAtStop = tripPassengers.filter(p => p.busStopName === stop.name)
      return {
        stop,
        students: studentsAtStop
      }
    })

    // 定義外または未設定のバス停にいる生徒
    const otherStudents = tripPassengers.filter(
      p => !stops.some(s => s.name === p.busStopName)
    )
    if (otherStudents.length > 0) {
      grouped.push({
        stop: {
          name: 'その他・未登録バス停',
          address: '',
          arrival_time_morning: '-',
          order: 999
        },
        students: otherStudents
      })
    }

    return grouped
  }, [busStops, tripPassengers])

  // schedules から乗車確認済み状態を復元・同期
  useEffect(() => {
    const nextChecked: Record<string, boolean> = {}
    tripPassengers.forEach(p => {
      const sched = schedules.find(
        s => s.student_name === p.studentName && s.date.replace(/-/g, '/') === selectedDate.replace(/-/g, '/')
      )
      const boardedVal = selectedTrip === 'morning' ? sched?.morning_boarding : sched?.afternoon_boarding
      const key = `${selectedDate}_${selectedTrip}_${p.studentName}`
      if (boardedVal) {
        nextChecked[key] = true
      }
    })
    setCheckedStudents(prev => ({
      ...nextChecked,
      ...prev
    }))
  }, [schedules, selectedDate, selectedTrip, tripPassengers])

  // チェックトグル（楽観的更新 ＋ GAS recordBoarding 呼び出し）
  const toggleCheck = (studentName: string, busStopName: string = '') => {
    const key = `${selectedDate}_${selectedTrip}_${studentName}`
    const nextChecked = !checkedStudents[key]
    
    // 1. 楽観的UI更新（画面上は即座にチェックマーク切り替え）
    setCheckedStudents(prev => ({
      ...prev,
      [key]: nextChecked
    }))

    // 2. バックグラウンドで GAS の recordBoarding を呼び出し
    const tripType = selectedTrip === 'morning' ? '登校' : '下校'
    recordBoarding({
      date: selectedDate,
      studentName,
      tripType,
      boarded: nextChecked,
      busStop: busStopName
    })
  }

  // バス停内の生徒を一括チェック/解除（楽観的更新 ＋ GAS連動）
  const toggleAllStudentsAtStop = (students: Array<{ studentName: string; busStopName?: string }>, defaultStopName: string = '') => {
    const allChecked = students.every(s => checkedStudents[`${selectedDate}_${selectedTrip}_${s.studentName}`])
    const nextChecked = !allChecked
    const tripType = selectedTrip === 'morning' ? '登校' : '下校'

    // 1. 楽観的一括更新
    setCheckedStudents(prev => {
      const next = { ...prev }
      students.forEach(s => {
        next[`${selectedDate}_${selectedTrip}_${s.studentName}`] = nextChecked
      })
      return next
    })

    // 2. 各生徒ごとにバックグラウンドで recordBoarding を呼び出し
    students.forEach(s => {
      recordBoarding({
        date: selectedDate,
        studentName: s.studentName,
        tripType,
        boarded: nextChecked,
        busStop: s.busStopName || defaultStopName
      })
    })
  }

  // チェック状況カウント
  const checkedCount = useMemo(() => {
    let count = 0
    tripPassengers.forEach(p => {
      const key = `${selectedDate}_${selectedTrip}_${p.studentName}`
      if (checkedStudents[key]) count++
    })
    return count
  }, [tripPassengers, selectedDate, selectedTrip, checkedStudents])

  // 折りたたみトグル
  const toggleStop = (stopName: string) => {
    setCollapsedStops(prev => ({
      ...prev,
      [stopName]: !prev[stopName]
    }))
  }

  const tripTabs = [
    { id: 'morning', label: '登校便', shortLabel: '登校', icon: '🌅', color: 'amber' },
    { id: 'afternoon_1', label: '下校1便', shortLabel: '下校1', icon: '🚌', color: 'sky' },
    { id: 'afternoon_2', label: '下校2便', shortLabel: '下校2', icon: '🚍', color: 'indigo' },
    { id: 'afternoon_3', label: '下校3便', shortLabel: '下校3', icon: '🌙', color: 'purple' }
  ] as const

  const isAllChecked = tripPassengers.length > 0 && checkedCount === tripPassengers.length

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans pb-12">
      {/* ========================================================= */}
      {/* 1. 最上部固定エリア（ヘッダー ＋ 日付ナビ ＋ 便切り替えタブ ＋ 合計乗車人数） */}
      {/* スマホ縦画面・片手操作で指が届きやすく直感的に把握できる設計 */}
      {/* ========================================================= */}
      <div className="sticky top-0 z-40 bg-slate-900 text-white shadow-lg border-b border-slate-850">
        {/* 最上段：タイトル・操作ボタン */}
        <div className="max-w-xl mx-auto px-3.5 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <div className="bg-emerald-500 p-1.5 rounded-lg text-slate-950 shadow-md shrink-0">
              <Bus className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-black tracking-tight leading-tight whitespace-nowrap">乗務員ダッシュボード</h1>
              <p className="text-[10px] text-slate-400 font-mono truncate max-w-[130px]">
                {user?.name || user?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <RoleSwitcher />
            <button
              onClick={() => refreshAll()}
              disabled={syncing}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 rounded-lg transition shrink-0"
              title="スプレッドシート再取得"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              onClick={logout}
              className="p-1.5 bg-rose-950 hover:bg-rose-900 active:scale-95 text-rose-300 rounded-lg transition shrink-0"
              title="ログアウト"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2行目：学校運行時刻表クイックバー ＆ 確定ステータス */}
        <div className="max-w-xl mx-auto px-3.5 pb-2">
          <button
            type="button"
            onClick={() => setIsTimetableModalOpen(true)}
            className="w-full px-3 py-1.5 bg-slate-850 hover:bg-slate-800 active:scale-[0.99] border border-slate-700/80 rounded-xl transition flex items-center justify-between gap-2 cursor-pointer shadow-sm group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1 bg-sky-500/20 text-sky-400 rounded-lg group-hover:bg-sky-500/30 transition shrink-0">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-black text-slate-200 group-hover:text-white truncate">
                学校運行時刻表（登下校便カレンダー）
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isSelectedMonthPublished ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  確定・公開中
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  調整中
                </span>
              )}
            </div>
          </button>
        </div>

        {/* 2段目：日付ナビゲーション */}
        <div className="bg-slate-950/80 px-3.5 py-2 border-t border-slate-800/80">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-2">
            <button
              onClick={() => changeDateByDays(-1)}
              className="px-2.5 py-1.5 bg-slate-850 hover:bg-slate-800 active:scale-90 text-slate-300 rounded-xl border border-slate-750 flex items-center gap-1 text-xs font-bold transition"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>前日</span>
            </button>

            {/* 日付選択 */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-750 px-3 py-1 rounded-xl shadow-inner flex-1 justify-center max-w-[240px]">
              <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
              <input
                type="date"
                value={selectedDate.replace(/\//g, '-')}
                onChange={e => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value.replace(/-/g, '/'))
                  }
                }}
                className="bg-transparent text-white font-black text-sm text-center focus:outline-none cursor-pointer w-28"
              />
              <span className={`text-xs font-bold ${
                selectedDayOfWeekStr === '日' || holidayName ? 'text-rose-400' :
                selectedDayOfWeekStr === '土' ? 'text-sky-400' : 'text-slate-400'
              }`}>
                ({selectedDayOfWeekStr})
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSelectedDate(getTodayStr())}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-90 text-white rounded-xl text-xs font-black transition shadow-sm"
              >
                今日
              </button>
              <button
                onClick={() => changeDateByDays(1)}
                className="px-2.5 py-1.5 bg-slate-850 hover:bg-slate-800 active:scale-90 text-slate-300 rounded-xl border border-slate-755 flex items-center gap-1 text-xs font-bold transition"
              >
                <span>翌日</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 3段目：便切り替え大型タブ（🌅 登校便 / 🚌 下校1便 / 🚍 下校2便 / 🌙 下校3便） */}
        <div className="px-2.5 pt-2 pb-2.5 bg-slate-900 border-t border-slate-800">
          <div className="max-w-xl mx-auto grid grid-cols-4 gap-1.5">
            {tripTabs.map(trip => {
              const active = selectedTrip === trip.id
              return (
                <button
                  key={trip.id}
                  onClick={() => setSelectedTrip(trip.id as any)}
                  className={`py-2.5 px-1 rounded-2xl text-center font-black transition-all flex flex-col items-center justify-center space-y-0.5 active:scale-95 select-none ${
                    active
                      ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-300'
                      : 'bg-slate-800/90 text-slate-300 hover:bg-slate-750 border border-slate-700'
                  }`}
                >
                  <span className="text-lg leading-none">{trip.icon}</span>
                  <span className="text-xs sm:text-sm tracking-tight">{trip.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 4段目：当該便の「合計乗車人数」＆点呼確認サマリーバー */}
        <div className="bg-slate-950 px-3.5 py-2.5 border-t border-slate-800/80">
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">乗車合計:</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-emerald-400 tracking-tight">
                  {tripPassengers.length}
                </span>
                <span className="text-xs font-bold text-slate-400">名</span>
              </div>
              {tripTimeStr && (
                <span className="ml-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-mono font-bold border border-slate-700">
                  {tripTimeStr}発
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="text-[11px] text-slate-400 font-bold">点呼完了:</span>
                  <span className={`text-sm font-black font-mono ${
                    isAllChecked ? 'text-emerald-400' : 'text-white'
                  }`}>
                    {checkedCount} / {tripPassengers.length}
                  </span>
                </div>
                {/* 進行状況バー */}
                <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5 ml-auto">
                  <div
                    className={`h-full transition-all duration-300 ${isAllChecked ? 'bg-emerald-400' : 'bg-emerald-500'}`}
                    style={{
                      width: tripPassengers.length > 0 ? `${(checkedCount / tripPassengers.length) * 100}%` : '0%'
                    }}
                  />
                </div>
              </div>

              {isAllChecked && (
                <span className="flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                  <Sparkles className="w-3 h-3" />
                  全員確認
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. メインコンテンツエリア */}
      {/* ========================================================= */}
      <main className="flex-1 max-w-xl w-full mx-auto px-3.5 py-3 space-y-3">
        {/* 祝日・運休・学校連絡アラート */}
        {holidayName && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-2xl shadow-sm flex items-center gap-2 text-xs font-bold">
            <span className="text-base">🎌</span>
            <span>日本の祝日: <strong>{holidayName}</strong> です</span>
          </div>
        )}

        {holidayInfo && (
          <div className="bg-amber-500 text-slate-950 p-3 rounded-2xl shadow-md flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0 text-slate-950 mt-0.5" />
            <div className="text-xs">
              <span className="font-black">【運休・特別期間】</span> {holidayInfo.setting_name}（{holidayInfo.start_date} ～ {holidayInfo.end_date}）
              {holidayInfo.note && <div className="mt-0.5 text-[11px] font-medium opacity-90">{holidayInfo.note}</div>}
            </div>
          </div>
        )}

        {schoolTimetableRow?.note && (
          <div className="bg-sky-50 border border-sky-200 text-sky-900 p-2.5 rounded-2xl text-xs flex items-center gap-2 shadow-sm">
            <span className="font-black bg-sky-600 text-white px-1.5 py-0.5 rounded text-[10px]">学校連絡</span>
            <span className="font-medium">{schoolTimetableRow.note}</span>
          </div>
        )}

        {/* バス停ごとのカード（ルート順・アコーディオン対応） */}
        <div className="space-y-3">
          {sortedBusStopsWithStudents.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center text-slate-400 border border-slate-200 shadow-sm">
              バス停データがありません。
            </div>
          ) : (
            sortedBusStopsWithStudents.map(({ stop, students }) => {
              const studentCount = students.length
              const hasStudents = studentCount > 0
              // 0名のバス停はデフォルト折りたたみ、生徒がいるバス停はデフォルト展開
              const isCollapsed = collapsedStops[stop.name] !== undefined
                ? collapsedStops[stop.name]
                : !hasStudents

              // バス停内の点呼完了チェック
              const stopCheckedCount = students.filter(
                p => checkedStudents[`${selectedDate}_${selectedTrip}_${p.studentName}`]
              ).length
              const isStopAllChecked = hasStudents && stopCheckedCount === studentCount

              // バス停の時刻見出し（登校便はマスタ時刻、下校便は時刻表マスタ等）
              const stopTime = selectedTrip === 'morning'
                ? (stop.arrival_time_morning && stop.arrival_time_morning !== '-' ? formatTimeToHHmm(stop.arrival_time_morning) : '')
                : tripTimeStr

              return (
                <div
                  key={stop.name}
                  className={`rounded-3xl border transition-all overflow-hidden ${
                    !hasStudents
                      ? 'bg-slate-100/80 border-slate-200/80 opacity-70'
                      : isStopAllChecked
                      ? 'bg-white border-emerald-300 shadow-sm ring-1 ring-emerald-200'
                      : 'bg-white border-slate-200 shadow-md'
                  }`}
                >
                  {/* バス停カードヘッダー（タップで開閉可能） */}
                  <div
                    onClick={() => toggleStop(stop.name)}
                    className={`px-4 py-3.5 flex items-center justify-between cursor-pointer transition select-none ${
                      !hasStudents
                        ? 'bg-slate-100 hover:bg-slate-200/60'
                        : isStopAllChecked
                        ? 'bg-emerald-50/70 hover:bg-emerald-100/50'
                        : 'bg-slate-50 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* 順序バッジ */}
                      <span className={`w-7 h-7 rounded-xl text-xs font-black flex items-center justify-center shrink-0 ${
                        !hasStudents
                          ? 'bg-slate-300 text-slate-600'
                          : isStopAllChecked
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-800 text-white shadow-sm'
                      }`}>
                        {stop.order || '-'}
                      </span>

                      {/* バス停名と発車予定時刻 */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <MapPin className={`w-4 h-4 shrink-0 ${hasStudents ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <h3 className={`font-black text-sm sm:text-base truncate ${
                            hasStudents ? 'text-slate-900' : 'text-slate-500'
                          }`}>
                            {stop.name}
                            {stopTime && (
                              <span className="ml-1 text-xs font-normal text-slate-500 font-mono">
                                （{stopTime}発）
                              </span>
                            )}
                          </h3>
                        </div>
                        {stop.address && (
                          <p className="text-[11px] text-slate-400 truncate pl-5">{stop.address}</p>
                        )}
                      </div>
                    </div>

                    {/* 右側：人数バッジ・ステータス・開閉トグル */}
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {hasStudents ? (
                        <div className="flex items-center gap-1.5">
                          {isStopAllChecked ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center gap-1 shadow-sm">
                              <CheckCircle2 className="w-3 h-3" />
                              完了 {studentCount}名
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-black">
                              {stopCheckedCount}/{studentCount}名
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-500 text-[11px] font-bold">
                          通過（0名）
                        </span>
                      )}

                      <div className="text-slate-400 p-1">
                        {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* アコーディオン展開部：生徒リスト */}
                  {!isCollapsed && (
                    <div className="border-t border-slate-100">
                      {hasStudents ? (
                        <>
                          {/* バス停内一括操作バー */}
                          <div className="px-4 py-2 bg-slate-50/50 flex items-center justify-between border-b border-slate-100 text-xs">
                            <span className="text-slate-500 font-bold text-[11px]">
                              乗車生徒一覧 ({studentCount}名)
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleAllStudentsAtStop(students, stop.name)
                              }}
                              className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-emerald-50 transition"
                            >
                              <CheckCheck className="w-3.5 h-3.5" />
                              {isStopAllChecked ? 'すべて未乗車に戻す' : 'このバス停全員を乗車済みにする'}
                            </button>
                          </div>

                          {/* 生徒一覧 */}
                          <div className="divide-y divide-slate-100">
                            {students.map(p => {
                              const checkKey = `${selectedDate}_${selectedTrip}_${p.studentName}`
                              const isChecked = !!checkedStudents[checkKey]

                              // スプレッドシート保存済みの乗車確認値を取得
                              const sched = schedules.find(
                                s => s.student_name === p.studentName && s.date.replace(/-/g, '/') === selectedDate.replace(/-/g, '/')
                              )
                              const boardingTimeStr = selectedTrip === 'morning' ? sched?.morning_boarding : sched?.afternoon_boarding

                              return (
                                <div
                                  key={p.studentName}
                                  onClick={() => toggleCheck(p.studentName, p.busStopName || stop.name)}
                                  className={`px-4 py-3.5 min-h-[58px] flex items-center justify-between hover:bg-slate-50 cursor-pointer transition select-none active:bg-slate-100 ${
                                    isChecked ? 'bg-emerald-50/40' : 'bg-white'
                                  }`}
                                >
                                  {/* 左側：チェックボックス ＆ 生徒名 ＆ 備考 */}
                                  <div className="flex items-center gap-3 min-w-0">
                                    <button
                                      type="button"
                                      className="p-1 -ml-1 text-emerald-600 focus:outline-none"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleCheck(p.studentName, p.busStopName || stop.name)
                                      }}
                                    >
                                      {isChecked ? (
                                        <CheckCircle2 className="w-7 h-7 text-emerald-600 fill-emerald-100 shrink-0" />
                                      ) : (
                                        <Circle className="w-7 h-7 text-slate-300 shrink-0 hover:text-slate-400" />
                                      )}
                                    </button>

                                    <div className="min-w-0">
                                      <p className={`font-black text-base sm:text-lg tracking-tight ${
                                        isChecked ? 'text-emerald-950 line-through opacity-70' : 'text-slate-900'
                                      }`}>
                                        {p.studentName}
                                      </p>
                                      {p.note && (
                                        <p className="text-xs text-amber-900 bg-amber-100/90 border border-amber-200 px-2 py-0.5 rounded-lg mt-0.5 inline-block font-bold">
                                          備考: {p.note}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* 右側：乗車状況バッジ */}
                                  <span
                                    className={`text-xs font-black px-3 py-1.5 rounded-xl shrink-0 transition flex items-center gap-1.5 ${
                                      isChecked
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                    }`}
                                  >
                                    {isChecked ? (
                                      <>
                                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                        <span>{boardingTimeStr ? `${boardingTimeStr} 乗車済` : '乗車済'}</span>
                                      </>
                                    ) : (
                                      '未乗車'
                                    )}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="p-3.5 text-center text-xs text-slate-400 bg-slate-50/50">
                          このバス停での乗車生徒はいません（通過）
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </main>

      {/* ========================================================= */}
      {/* 運転手向け 学校運行時刻表モーダル（スマホ対応縦型タイムライン ＆ PC月間カレンダー） */}
      {/* ========================================================= */}
      <SchoolTimetableModal
        isOpen={isTimetableModalOpen}
        onClose={() => setIsTimetableModalOpen(false)}
        schoolTimetable={schoolTimetable}
        basicSettings={basicSettings}
      />
    </div>
  )
}
