import React, { useState, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Printer, 
  Sparkles, Info
} from 'lucide-react'

interface NextMonthScheduleViewProps {
  onClose?: () => void
}

export const NextMonthScheduleView: React.FC<NextMonthScheduleViewProps> = () => {
  const { 
    monthlyTripSchedules, 
    specialTripSchedules, 
    schoolHolidays,
    getDateScheduleStatus, 
    getTripTime, 
    isTripOperating,
    busRoutes 
  } = useAuth()

  // 翌月の年月を初期値に設定
  const today = new Date()
  const defaultNextMonth = today.getMonth() === 11 ? 0 : today.getMonth() + 1
  const defaultNextYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear()

  const [selectedYear, setSelectedYear] = useState<number>(defaultNextYear)
  const [selectedMonth, setSelectedMonth] = useState<number>(defaultNextMonth) // 0-11

  // 前月・翌月切替
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11)
      setSelectedYear(prev => prev - 1)
    } else {
      setSelectedMonth(prev => prev - 1)
    }
  }

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0)
      setSelectedYear(prev => prev + 1)
    } else {
      setSelectedMonth(prev => prev + 1)
    }
  }

  const handleSetToNextMonth = () => {
    setSelectedYear(defaultNextYear)
    setSelectedMonth(defaultNextMonth)
  }

  const handleSetToCurrentMonth = () => {
    setSelectedYear(today.getFullYear())
    setSelectedMonth(today.getMonth())
  }

  // 対象月の日付リストとダイヤ情報を生成
  const monthData = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
    const days = []

    let totalOperatingDays = 0
    let totalSuspendedDays = 0
    let totalMorningTrips = 0
    const tripCounts: Record<string, number> = {
      '下校1便': 0,
      '下校2便': 0,
      '下校3便': 0,
      '下校4便': 0,
      '下校5便': 0
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const dateObj = new Date(`${dateStr}T00:00:00`)
      const dayOfWeekNum = dateObj.getDay()
      const weekdayNames = ['日', '月', '火', '水', '木', '金', '土']
      const weekdayStr = weekdayNames[dayOfWeekNum]
      const isWeekend = dayOfWeekNum === 0 || dayOfWeekNum === 6

      // 運行判定
      const scheduleStatus = getDateScheduleStatus(dateStr)
      const isSuspended = scheduleStatus.isSuspended

      // 各便の時刻・運行可否
      const morningTime = getTripTime('登校便', dateStr)
      const isMorningOp = isTripOperating('登校便', dateStr)

      const afternoonTrips = [1, 2, 3, 4, 5].map(num => {
        const tripName = `下校${num}便`
        const time = getTripTime(tripName, dateStr)
        const isOp = isTripOperating(tripName, dateStr)
        if (isOp) {
          tripCounts[tripName] = (tripCounts[tripName] || 0) + 1
        }
        return {
          tripName,
          time,
          isOperating: isOp
        }
      })

      if (isMorningOp) {
        totalMorningTrips++
      }

      const hasAnyTrip = isMorningOp || afternoonTrips.some(t => t.isOperating)
      if (hasAnyTrip) {
        totalOperatingDays++
      } else {
        totalSuspendedDays++
      }

      days.push({
        day,
        dateStr,
        dayOfWeekNum,
        weekdayStr,
        isWeekend,
        scheduleStatus,
        isSuspended,
        morningTime,
        isMorningOp,
        afternoonTrips,
        hasAnyTrip
      })
    }

    return {
      days,
      totalOperatingDays,
      totalSuspendedDays,
      totalMorningTrips,
      tripCounts,
      daysInMonth
    }
  }, [selectedYear, selectedMonth, monthlyTripSchedules, specialTripSchedules, schoolHolidays])

  // 対象月の月別基本ダイヤ
  const currentMonthMaster = monthlyTripSchedules.find(m => m.month === (selectedMonth + 1))

  // 印刷ハンドラ
  const handlePrint = () => {
    window.print()
  }

  const isSelectedNextMonth = selectedYear === defaultNextYear && selectedMonth === defaultNextMonth

  return (
    <div className="space-y-6">
      {/* 印刷専用ヘッダー (print時のみ表示) */}
      <div className="hidden print:block text-black p-4 mb-4 border-b-2 border-black">
        <h1 className="text-xl font-bold text-center">
          スクールバス運行予定・ダイヤ表（{selectedYear}年{selectedMonth + 1}月）
        </h1>
        <div className="flex justify-between text-xs mt-2">
          <span>運行ルート: {busRoutes[0]?.route_name || 'スクールバス運行ルート'}</span>
          <span>出力日時: {new Date().toLocaleDateString('ja-JP')}</span>
        </div>
      </div>

      {/* 画面用ナビゲーション ＆ アクションヘッダー */}
      <div className="bg-gradient-to-r from-slate-900/90 to-indigo-950/40 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-500/30">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">
                  月別運行カレンダー・シフト調整ダイヤ
                </h2>
                {isSelectedNextMonth && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    翌月ダイヤ
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                乗務員シフト作成・人員配置のための月間運行予定一覧です。
              </p>
            </div>
          </div>
        </div>

        {/* 年月切り替えコントローラー */}
        <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={handlePrevMonth}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all active:scale-95"
              title="前月へ"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="font-mono font-black text-sm px-3 text-white">
              {selectedYear}年 {selectedMonth + 1}月
            </span>

            <button
              onClick={handleNextMonth}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all active:scale-95"
              title="翌月へ"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={handleSetToNextMonth}
            className={`px-3 py-2 rounded-xl text-xs font-black transition-all border ${
              isSelectedNextMonth
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
            }`}
          >
            翌月 ({defaultNextYear}年{defaultNextMonth + 1}月)
          </button>

          <button
            onClick={handleSetToCurrentMonth}
            className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold transition-all"
          >
            当月
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95"
            title="ダイヤ表を印刷"
          >
            <Printer className="h-3.5 w-3.5" />
            印刷 / PDF出力
          </button>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 print:hidden">
        <div className="bg-slate-900/60 border border-slate-850 p-3.5 rounded-2xl">
          <p className="text-[11px] text-slate-400 font-bold">運行予定日数</p>
          <p className="text-xl font-black text-emerald-400 font-mono mt-0.5">
            {monthData.totalOperatingDays} <span className="text-xs font-normal text-slate-400">日</span>
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-850 p-3.5 rounded-2xl">
          <p className="text-[11px] text-slate-400 font-bold">終日運休日数</p>
          <p className="text-xl font-black text-rose-400 font-mono mt-0.5">
            {monthData.totalSuspendedDays} <span className="text-xs font-normal text-slate-400">日</span>
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-850 p-3.5 rounded-2xl">
          <p className="text-[11px] text-slate-400 font-bold">登校便 (朝)</p>
          <p className="text-xl font-black text-indigo-300 font-mono mt-0.5">
            {monthData.totalMorningTrips} <span className="text-xs font-normal text-slate-400">本</span>
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-850 p-3.5 rounded-2xl">
          <p className="text-[11px] text-slate-400 font-bold">下校1便</p>
          <p className="text-xl font-black text-purple-300 font-mono mt-0.5">
            {monthData.tripCounts['下校1便']} <span className="text-xs font-normal text-slate-400">本</span>
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-850 p-3.5 rounded-2xl">
          <p className="text-[11px] text-slate-400 font-bold">下校2便</p>
          <p className="text-xl font-black text-purple-300 font-mono mt-0.5">
            {monthData.tripCounts['下校2便']} <span className="text-xs font-normal text-slate-400">本</span>
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-850 p-3.5 rounded-2xl">
          <p className="text-[11px] text-slate-400 font-bold">下校3便</p>
          <p className="text-xl font-black text-purple-300 font-mono mt-0.5">
            {monthData.tripCounts['下校3便']} <span className="text-xs font-normal text-slate-400">本</span>
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-850 p-3.5 rounded-2xl">
          <p className="text-[11px] text-slate-400 font-bold">下校4・5便</p>
          <p className="text-xl font-black text-purple-300 font-mono mt-0.5">
            {(monthData.tripCounts['下校4便'] || 0) + (monthData.tripCounts['下校5便'] || 0)} <span className="text-xs font-normal text-slate-400">本</span>
          </p>
        </div>
      </div>

      {/* 月別ダイヤ基本パターン案内 */}
      {currentMonthMaster && (
        <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-3.5 text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-indigo-400 shrink-0" />
            <span>
              <strong className="text-white font-bold">{selectedMonth + 1}月の基本ダイヤ設定:</strong>{' '}
              {currentMonthMaster.note || '通常運行'}
              {currentMonthMaster.shortened_day_of_week && (
                <span className="ml-2 text-amber-300 font-bold">
                  （短縮日課: 毎週{['', '月', '火', '水', '木', '金'][currentMonthMaster.shortened_day_of_week]}曜日）
                </span>
              )}
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            登校便基準: {currentMonthMaster.morning_trip_time?.substring(0, 5) || '07:30'}発
          </span>
        </div>
      )}

      {/* 運行カレンダー・ダイヤ一覧表 */}
      <div className="bg-slate-900/60 border border-slate-850 rounded-3xl overflow-hidden shadow-2xl print:border-none print:shadow-none print:bg-white print:text-black">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold print:bg-gray-100 print:text-black print:border-black">
                <th className="py-3 px-3.5 w-24 text-center">日付</th>
                <th className="py-3 px-3 w-16 text-center">曜日</th>
                <th className="py-3 px-3 w-36">運行区分・行事</th>
                <th className="py-3 px-3 w-24 text-center bg-indigo-950/20 text-indigo-300 print:bg-transparent print:text-black">登校便</th>
                <th className="py-3 px-3 w-20 text-center">下校1便</th>
                <th className="py-3 px-3 w-20 text-center">下校2便</th>
                <th className="py-3 px-3 w-20 text-center">下校3便</th>
                <th className="py-3 px-3 w-20 text-center">下校4便</th>
                <th className="py-3 px-3 w-20 text-center">下校5便</th>
                <th className="py-3 px-3.5">備考・連絡事項</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/60 print:divide-gray-300">
              {monthData.days.map((item) => {
                const isSunday = item.dayOfWeekNum === 0
                const isSaturday = item.dayOfWeekNum === 6
                const isWed = item.dayOfWeekNum === 3

                // 行のハイライト色
                let rowBg = 'hover:bg-slate-850/40'
                if (item.scheduleStatus.type === 'special') {
                  rowBg = 'bg-amber-950/15 hover:bg-amber-950/25 print:bg-amber-50'
                } else if (item.scheduleStatus.type === 'shortened') {
                  rowBg = 'bg-indigo-950/15 hover:bg-indigo-950/25 print:bg-blue-50'
                } else if (item.isSuspended) {
                  rowBg = 'bg-slate-950/40 opacity-70 hover:opacity-90 print:bg-gray-50'
                }

                return (
                  <tr key={item.dateStr} className={`transition-colors ${rowBg} print:text-black`}>
                    {/* 日付 */}
                    <td className="py-2.5 px-3.5 text-center font-mono font-black text-white print:text-black">
                      {selectedMonth + 1}/{item.day}
                    </td>

                    {/* 曜日 */}
                    <td className="py-2.5 px-3 text-center font-bold">
                      <span className={`px-2 py-0.5 rounded text-[11px] ${
                        isSunday
                          ? 'bg-rose-500/20 text-rose-300 print:text-red-600 print:bg-transparent'
                          : isSaturday
                          ? 'bg-blue-500/20 text-blue-300 print:text-blue-600 print:bg-transparent'
                          : isWed
                          ? 'bg-amber-500/20 text-amber-300 print:text-orange-600 print:bg-transparent'
                          : 'text-slate-300 print:text-black'
                      }`}>
                        {item.weekdayStr}
                      </span>
                    </td>

                    {/* 運行区分・行事 */}
                    <td className="py-2.5 px-3">
                      {item.scheduleStatus.type === 'special' ? (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-300 text-[11px] bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 print:border-none print:text-amber-800">
                          <Sparkles className="h-3 w-3 shrink-0" />
                          {item.scheduleStatus.label}
                        </span>
                      ) : item.scheduleStatus.type === 'holiday' ? (
                        <span className="inline-flex items-center gap-1 font-bold text-rose-300 text-[11px] bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/20 print:border-none print:text-red-700">
                          祝日運休 ({item.scheduleStatus.holidayName})
                        </span>
                      ) : item.scheduleStatus.type === 'school_break' ? (
                        <span className="inline-flex items-center gap-1 font-bold text-rose-300 text-[11px] bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/20 print:border-none print:text-red-700">
                          {item.scheduleStatus.label}
                        </span>
                      ) : item.scheduleStatus.type === 'shortened' ? (
                        <span className="font-bold text-amber-300 text-[11px] bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 print:border-none print:text-amber-800">
                          短縮日課ダイヤ
                        </span>
                      ) : item.isWeekend ? (
                        <span className="text-slate-500 text-[11px]">土日運休</span>
                      ) : (
                        <span className="text-slate-300 text-[11px]">通常ダイヤ</span>
                      )}
                    </td>

                    {/* 登校便 */}
                    <td className="py-2.5 px-3 text-center bg-indigo-950/10 print:bg-transparent">
                      {item.isMorningOp ? (
                        <span className="font-mono font-bold text-emerald-300 text-[11px] print:text-black">
                          {item.morningTime}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-[10px] print:text-gray-400">運休</span>
                      )}
                    </td>

                    {/* 下校1便〜5便 */}
                    {item.afternoonTrips.map((t, idx) => (
                      <td key={idx} className="py-2.5 px-3 text-center">
                        {t.isOperating ? (
                          <span className="font-mono font-bold text-purple-200 text-[11px] print:text-black">
                            {t.time}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[10px] print:text-gray-400">-</span>
                        )}
                      </td>
                    ))}

                    {/* 備考・特記事項 */}
                    <td className="py-2.5 px-3.5 text-[11px] text-slate-400 print:text-gray-700">
                      {item.scheduleStatus.note || '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
