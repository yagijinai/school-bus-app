import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Ban,
  Clock
} from 'lucide-react'
import type { SchoolTimetableRow, BasicSettingRow } from '../types/spreadsheet'
import { formatTimeOnly, isMonthPublished } from '../lib/spreadsheetApi'
import { getJapaneseHolidayName } from '../lib/japaneseHolidays'

interface SchoolTimetableModalProps {
  isOpen: boolean
  onClose: () => void
  schoolTimetable: SchoolTimetableRow[]
  basicSettings: BasicSettingRow[]
  initialDate?: Date
}

export const SchoolTimetableModal: React.FC<SchoolTimetableModalProps> = ({
  isOpen,
  onClose,
  schoolTimetable,
  basicSettings,
  initialDate
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(() => initialDate || new Date())
  // モバイル時のフィルター（'all': 全日, 'weekday': 平日・運行日のみ）
  const [mobileFilter, setMobileFilter] = useState<'all' | 'weekday'>('weekday')

  const todayItemRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // 年月文字列 (YYYY/MM)
  const yearMonthStr = useMemo(() => {
    const y = currentDate.getFullYear()
    const m = String(currentDate.getMonth() + 1).padStart(2, '0')
    return `${y}/${m}`
  }, [currentDate])

  const isPublished = useMemo(() => {
    return isMonthPublished(yearMonthStr, basicSettings)
  }, [yearMonthStr, basicSettings])

  // 今日の日付文字列
  const todayStr = useMemo(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}/${m}/${day}`
  }, [])

  // 運休期間判定
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

  // 1. モバイル用：当月の日別縦型リストデータ（1日〜末日）
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() // 0-indexed
    const lastDay = new Date(year, month + 1, 0).getDate()
    const pad = (n: number) => String(n).padStart(2, '0')
    const dayNames = ['日', '月', '火', '水', '木', '金', '土']

    const list: Array<{
      dateStr: string
      dayNumber: number
      dayName: string
      dayOfWeek: number
      isToday: boolean
      isWeekend: boolean
      holiday: string | null
      suspension: { isSuspended: boolean; name: string; note: string }
      timetable: SchoolTimetableRow | undefined
      hasTrips: boolean
    }> = []

    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${year}/${pad(month + 1)}/${pad(d)}`
      const dObj = new Date(year, month, d)
      const dayOfWeek = dObj.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const holiday = getJapaneseHolidayName(dateStr)
      const suspension = checkSuspension(dateStr)
      const timetable = schoolTimetable.find(t => t.date.replace(/-/g, '/') === dateStr)

      const morning = formatTimeOnly(timetable?.morning_trip)
      const t1 = formatTimeOnly(timetable?.afternoon_trip_1)
      const t2 = formatTimeOnly(timetable?.afternoon_trip_2)
      const t3 = formatTimeOnly(timetable?.afternoon_trip_3)
      const hasTrips = !!(morning || t1 || t2 || t3)

      list.push({
        dateStr,
        dayNumber: d,
        dayName: dayNames[dayOfWeek],
        dayOfWeek,
        isToday: dateStr === todayStr,
        isWeekend,
        holiday,
        suspension,
        timetable,
        hasTrips
      })
    }

    return list
  }, [currentDate, todayStr, schoolTimetable, basicSettings])

  // モバイル表示でフィルター適用
  const filteredMonthDays = useMemo(() => {
    if (mobileFilter === 'all') return monthDays
    // 平日または運行便がある日のみ
    return monthDays.filter(d => !d.isWeekend || d.hasTrips)
  }, [monthDays, mobileFilter])

  // 2. PC用：7列カレンダーグリッドデータ（前月・当月・翌月余白含む）
  const gridDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const firstDayOfWeek = firstDay.getDay()
    const lastDay = new Date(year, month + 1, 0)
    const totalDays = lastDay.getDate()
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    const pad = (n: number) => String(n).padStart(2, '0')

    const days: Array<{
      dateStr: string
      dayNumber: number
      isCurrentMonth: boolean
      isToday: boolean
      dayOfWeek: number
      holiday: string | null
      suspension: { isSuspended: boolean; name: string; note: string }
      timetable: SchoolTimetableRow | undefined
    }> = []

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
        dayOfWeek: dayDate.getDay(),
        holiday: getJapaneseHolidayName(dateStr),
        suspension: checkSuspension(dateStr),
        timetable: schoolTimetable.find(t => t.date.replace(/-/g, '/') === dateStr)
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
        dayOfWeek: dayDate.getDay(),
        holiday: getJapaneseHolidayName(dateStr),
        suspension: checkSuspension(dateStr),
        timetable: schoolTimetable.find(t => t.date.replace(/-/g, '/') === dateStr)
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
        dayOfWeek: dayDate.getDay(),
        holiday: getJapaneseHolidayName(dateStr),
        suspension: checkSuspension(dateStr),
        timetable: schoolTimetable.find(t => t.date.replace(/-/g, '/') === dateStr)
      })
    }

    return days
  }, [currentDate, todayStr, schoolTimetable, basicSettings])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden">
        {/* ========================================================= */}
        {/* モーダルヘッダー */}
        {/* ========================================================= */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/95">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl shrink-0">
              <Calendar className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-lg font-black text-white truncate flex items-center gap-2">
                <span>学校運行時刻表</span>
                <span className="hidden sm:inline-block text-[11px] font-normal text-slate-400">
                  （月別カレンダー）
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                全便の運行時刻と学校行事予定を確認できます
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition cursor-pointer shrink-0 ml-2"
            title="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ========================================================= */}
        {/* 月切り替えナビゲーション ＆ 確定ステータス */}
        {/* ========================================================= */}
        <div className="px-3.5 py-2.5 sm:px-6 sm:py-3 bg-slate-950/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h4 className="text-base sm:text-lg font-black text-white whitespace-nowrap">
              {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
            </h4>
            <button
              type="button"
              onClick={() => setCurrentDate(new Date())}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              今月
            </button>
            {isPublished ? (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[11px] border border-emerald-500/30 whitespace-nowrap flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 shrink-0" />
                <span>確定・公開中</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[11px] border border-amber-500/30 whitespace-nowrap flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>時刻表調整中</span>
              </span>
            )}
          </div>

          {/* 前月・次月ボタン ＆ スマホ表示切り替え */}
          <div className="flex items-center gap-2">
            {/* モバイル専用：表示フィルタータブ */}
            <div className="flex sm:hidden items-center bg-slate-900 p-0.5 rounded-xl border border-slate-800 text-[11px]">
              <button
                type="button"
                onClick={() => setMobileFilter('weekday')}
                className={`px-2.5 py-1 rounded-lg font-black transition cursor-pointer ${
                  mobileFilter === 'weekday'
                    ? 'bg-sky-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                平日のみ
              </button>
              <button
                type="button"
                onClick={() => setMobileFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-black transition cursor-pointer ${
                  mobileFilter === 'all'
                    ? 'bg-sky-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                全日
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition cursor-pointer active:scale-95"
                title="前月"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition cursor-pointer active:scale-95"
                title="次月"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 凡例バー */}
        {/* ========================================================= */}
        <div className="hidden sm:flex flex-wrap items-center gap-3 text-[11px] text-slate-400 px-6 py-2 bg-slate-950/40 border-b border-slate-800/60 shrink-0">
          <span className="flex items-center gap-1.5 font-bold text-amber-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> 🌅 登校便
          </span>
          <span className="flex items-center gap-1.5 font-bold text-sky-300">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" /> 🚌 下校1便
          </span>
          <span className="flex items-center gap-1.5 font-bold text-indigo-300">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block" /> 🚍 下校2便
          </span>
          <span className="flex items-center gap-1.5 font-bold text-purple-300">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" /> 🌙 下校3便
          </span>
          <span className="flex items-center gap-1.5 font-bold text-rose-400">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> 🎌 祝日/運休
          </span>
        </div>

        {/* ========================================================= */}
        {/* メインコンテンツ表示部 */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5 space-y-3">
          {/* ===================================================== */}
          {/* ① スマホ専用ビュー：日別の縦型タイムライン／リスト形式 (< 640px) */}
          {/* 折り返しや省略が一切なく、大きなフォントでハッキリ読める */}
          {/* ===================================================== */}
          <div className="block sm:hidden space-y-2.5">
            {filteredMonthDays.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                該当する日程はありません
              </div>
            ) : (
              filteredMonthDays.map(item => {
                const morning = formatTimeOnly(item.timetable?.morning_trip)
                const t1 = formatTimeOnly(item.timetable?.afternoon_trip_1)
                const t2 = formatTimeOnly(item.timetable?.afternoon_trip_2)
                const t3 = formatTimeOnly(item.timetable?.afternoon_trip_3)
                const label = (item.timetable?.calendar_label || '').trim()
                const isSusp = item.suspension.isSuspended

                return (
                  <div
                    key={item.dateStr}
                    ref={item.isToday ? todayItemRef : null}
                    className={`rounded-2xl border p-3.5 transition-all ${
                      item.isToday
                        ? 'border-amber-400 ring-2 ring-amber-400/50 bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 shadow-lg'
                        : isSusp
                        ? 'border-rose-900/40 bg-rose-950/20'
                        : item.holiday || item.dayOfWeek === 0
                        ? 'border-rose-900/30 bg-slate-900/60'
                        : item.dayOfWeek === 6
                        ? 'border-sky-900/30 bg-slate-900/60'
                        : 'border-slate-800 bg-slate-900/90'
                    }`}
                  >
                    {/* 上段：日付・曜日・祝日・行事ラベル */}
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-base font-black tracking-tight ${
                            item.isToday
                              ? 'text-amber-300'
                              : item.holiday || item.dayOfWeek === 0
                              ? 'text-rose-400'
                              : item.dayOfWeek === 6
                              ? 'text-sky-400'
                              : 'text-white'
                          }`}
                        >
                          {item.dateStr.slice(5)}
                        </span>
                        <span
                          className={`text-xs font-black px-2 py-0.5 rounded-md ${
                            item.dayOfWeek === 0
                              ? 'bg-rose-500/20 text-rose-300'
                              : item.dayOfWeek === 6
                              ? 'bg-sky-500/20 text-sky-300'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          （{item.dayName}）
                        </span>
                        {item.holiday && (
                          <span className="text-[11px] text-rose-300 font-bold bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-lg truncate max-w-[130px]">
                            🎌 {item.holiday}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {item.isToday && (
                          <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-[10px] font-black rounded-full shadow-sm flex items-center gap-0.5">
                            <Sparkles className="h-3 w-3" /> 本日
                          </span>
                        )}
                        {isSusp && (
                          <span className="px-2 py-0.5 bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[10px] font-bold rounded-lg flex items-center gap-1">
                            <Ban className="h-3 w-3" /> 運休
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 学校行事・備考表示 */}
                    {label && (
                      <div className="mb-2 text-xs text-amber-300 font-bold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl">
                        📝 {label}
                      </div>
                    )}

                    {/* 下段：各便の運行時刻（折り返しなし・大きなフォントでハッキリ表示） */}
                    {isSusp ? (
                      <div className="py-2 text-center text-xs font-bold text-rose-400 bg-rose-950/30 rounded-xl border border-rose-900/30">
                        {item.suspension.name ? `全便運休（${item.suspension.name}）` : '全便運休期間'}
                      </div>
                    ) : item.hasTrips ? (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {/* 登校便 */}
                        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                          <span className="text-slate-400 font-bold flex items-center gap-1">
                            🌅 登校:
                          </span>
                          {morning ? (
                            <span className="text-sm font-black text-amber-300 font-mono tracking-wide">
                              {morning}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[11px]">なし</span>
                          )}
                        </div>

                        {/* 下校1便 */}
                        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                          <span className="text-slate-400 font-bold flex items-center gap-1">
                            🚌 下校1:
                          </span>
                          {t1 ? (
                            <span className="text-sm font-black text-sky-300 font-mono tracking-wide">
                              {t1}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[11px]">なし</span>
                          )}
                        </div>

                        {/* 下校2便 */}
                        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                          <span className="text-slate-400 font-bold flex items-center gap-1">
                            🚍 下校2:
                          </span>
                          {t2 ? (
                            <span className="text-sm font-black text-indigo-300 font-mono tracking-wide">
                              {t2}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[11px]">なし</span>
                          )}
                        </div>

                        {/* 下校3便 */}
                        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                          <span className="text-slate-400 font-bold flex items-center gap-1">
                            🌙 下校3:
                          </span>
                          {t3 ? (
                            <span className="text-sm font-black text-purple-300 font-mono tracking-wide">
                              {t3}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[11px]">なし</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 text-center text-xs text-slate-500 font-bold bg-slate-950/40 rounded-xl border border-slate-800/60">
                        運行便なし（休校または非平日）
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* ===================================================== */}
          {/* ② PC・タブレット専用ビュー：従来の月間カレンダーグリッド (>= 640px) */}
          {/* ===================================================== */}
          <div className="hidden sm:block">
            <div className="grid grid-cols-7 gap-1.5 md:gap-2">
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

              {gridDays.map((day, idx) => {
                const morning = formatTimeOnly(day.timetable?.morning_trip)
                const t1 = formatTimeOnly(day.timetable?.afternoon_trip_1)
                const t2 = formatTimeOnly(day.timetable?.afternoon_trip_2)
                const t3 = formatTimeOnly(day.timetable?.afternoon_trip_3)
                const label = (day.timetable?.calendar_label || '').trim()
                const isSun = day.dayOfWeek === 0
                const isSat = day.dayOfWeek === 6

                return (
                  <div
                    key={idx}
                    className={`min-h-[90px] md:min-h-[110px] p-2 rounded-2xl border flex flex-col justify-between transition-all ${
                      !day.isCurrentMonth
                        ? 'bg-slate-950/30 border-slate-900/50 opacity-30'
                        : day.isToday
                        ? 'bg-slate-900/90 border-amber-500 ring-2 ring-amber-400/40 shadow-md'
                        : day.holiday || isSun || day.suspension.isSuspended
                        ? 'bg-rose-950/15 border-rose-900/30'
                        : 'bg-slate-950/70 border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className={`text-xs font-black ${
                          day.isToday
                            ? 'text-amber-400 font-black'
                            : day.holiday || isSun
                            ? 'text-rose-400'
                            : isSat
                            ? 'text-sky-400'
                            : 'text-slate-300'
                        }`}
                      >
                        {day.dayNumber}
                      </span>
                      {day.holiday && (
                        <span className="text-[9px] text-rose-300 truncate max-w-[70%] font-bold">
                          🎌 {day.holiday}
                        </span>
                      )}
                    </div>

                    {label && (
                      <div className="text-[10px] text-emerald-300 font-bold truncate my-0.5">
                        {label}
                      </div>
                    )}
                    {day.suspension.isSuspended && !label && (
                      <div className="text-[10px] text-rose-400 font-bold truncate my-0.5">
                        {day.suspension.name || '運休'}
                      </div>
                    )}

                    {/* 便情報 */}
                    <div className="space-y-0.5 text-[10px] font-mono">
                      {morning && (
                        <div className="text-amber-300 truncate font-bold">
                          登校 {morning}
                        </div>
                      )}
                      {t1 && (
                        <div className="text-sky-300 truncate font-bold">
                          下校1 {t1}
                        </div>
                      )}
                      {t2 && (
                        <div className="text-indigo-300 truncate font-bold">
                          下校2 {t2}
                        </div>
                      )}
                      {t3 && (
                        <div className="text-purple-300 truncate font-bold">
                          下校3 {t3}
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
          </div>
        </div>

        {/* ========================================================= */}
        {/* フッター */}
        {/* ========================================================= */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-t border-slate-800 bg-slate-900 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-sky-400" />
            <span>時刻表の運行時間は予定です</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-black text-xs rounded-xl transition cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
