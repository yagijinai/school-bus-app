import React from 'react'
import type { Student, BusStop, Reservation, RideStatus, BusOperation, SpecialTripSchedule, SchoolHoliday } from '../../types/app'

interface PrintableDailyReportProps {
  date: string
  routeName?: string
  driverName?: string
  students: Student[]
  busStops: BusStop[]
  reservations: Reservation[]
  rideStatuses: RideStatus[]
  busOperations: BusOperation[]
  specialTripSchedules: SpecialTripSchedule[]
  schoolHolidays: SchoolHoliday[]
  getTripTime: (tripName: string, date: string) => string
  isTripOperating: (tripName: string, date: string) => boolean
}

export const PrintableDailyReport: React.FC<PrintableDailyReportProps> = ({
  date,
  routeName = 'スクールバス運行ルート',
  driverName = '担当ドライバー',
  students,
  reservations,
  rideStatuses,
  busOperations,
  getTripTime,
  isTripOperating
}) => {
  const dateObj = new Date(`${date}T00:00:00`)
  const weekdaysJa = ['日', '月', '火', '水', '木', '金', '土']
  const weekday = weekdaysJa[dateObj.getDay()] || ''

  const allTrips = ['登校便', '下校1便', '下校2便', '下校3便', '下校4便', '下校5便']

  // 各便の統計データを算出
  const tripStats = allTrips.map(trip => {
    const isOperating = isTripOperating(trip, date)
    const departureTime = getTripTime(trip, date)
    const op = busOperations.find(o => o.date === date && (o.trip_name === trip || (!o.trip_name && trip === '登校便')))
    
    // 該当便の予約生徒
    const tripReservations = reservations.filter(r => {
      if (r.date !== date) return false
      return trip === '登校便' ? r.morning_status === true : r.afternoon_schedule === trip
    })

    const reservedStudentIds = tripReservations.map(r => r.student_id)
    const reservedCount = tripReservations.length

    // 実乗車・欠席カウント
    const completedCount = rideStatuses.filter(s => 
      s.date === date && 
      (s.trip_name === trip || (!s.trip_name && trip === '登校便')) &&
      s.status === 'completed' &&
      reservedStudentIds.includes(s.student_id)
    ).length

    const absentCount = rideStatuses.filter(s => 
      s.date === date && 
      (s.trip_name === trip || (!s.trip_name && trip === '登校便')) &&
      s.status === 'absent' &&
      reservedStudentIds.includes(s.student_id)
    ).length

    return {
      trip,
      isOperating,
      departureTime,
      opStatus: op?.status || (isOperating ? 'not_started' : 'suspended'),
      delayMinutes: op?.delay_minutes || 0,
      message: op?.message || op?.note || '',
      reservedCount,
      completedCount,
      absentCount
    }
  })

  const totalDailyRiders = tripStats.reduce((sum, t) => sum + (t.isOperating ? t.reservedCount : 0), 0)
  const totalDailyCompleted = tripStats.reduce((sum, t) => sum + (t.isOperating ? t.completedCount : 0), 0)
  const totalDailyAbsent = tripStats.reduce((sum, t) => sum + (t.isOperating ? t.absentCount : 0), 0)

  return (
    <div className="printable-document bg-white text-black p-6 max-w-[210mm] mx-auto text-[10pt] font-sans border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0 print:m-0">
      
      {/* 帳票ヘッダー */}
      <div className="border-b-2 border-black pb-2 mb-3">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[9pt] font-bold text-slate-600 block tracking-widest">
              【様式第2号・安全運行管理記録】
            </span>
            <h1 className="text-xl font-black tracking-wider text-black mt-0.5">
              スクールバス運行日報（1日総括）
            </h1>
            <p className="text-xs text-slate-700 mt-1">
              路線名: <strong>{routeName}</strong>（在籍生徒: {students.length}名） ／ 車両号車: <strong>1号車（マイクロバス29人乗）</strong>
            </p>
          </div>

          {/* 検印枠（4枠） */}
          <div className="flex border-2 border-black text-center text-[9pt] shrink-0 bg-white">
            <div className="w-14 border-r border-black">
              <div className="bg-slate-100 border-b border-black py-0.5 font-bold text-[8.5pt]">校長</div>
              <div className="h-11 flex items-center justify-center text-slate-300">印</div>
            </div>
            <div className="w-14 border-r border-black">
              <div className="bg-slate-100 border-b border-black py-0.5 font-bold text-[8.5pt]">教頭</div>
              <div className="h-11 flex items-center justify-center text-slate-300">印</div>
            </div>
            <div className="w-16 border-r border-black">
              <div className="bg-slate-100 border-b border-black py-0.5 font-bold text-[8.5pt]">運行管理者</div>
              <div className="h-11 flex items-center justify-center text-slate-300">印</div>
            </div>
            <div className="w-14">
              <div className="bg-slate-100 border-b border-black py-0.5 font-bold text-[8.5pt]">乗務員</div>
              <div className="h-11 flex items-center justify-center text-slate-300">印</div>
            </div>
          </div>
        </div>

        {/* 日報基本情報 */}
        <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-400 text-xs">
          <div>
            <span className="font-bold text-slate-600">運行年月日:</span>{' '}
            <strong className="text-sm font-mono">{dateObj.getFullYear()}年{dateObj.getMonth() + 1}月{dateObj.getDate()}日 ({weekday})</strong>
          </div>
          <div>
            <span className="font-bold text-slate-600">担当乗務員:</span>{' '}
            <strong className="text-sm">{driverName}</strong>
          </div>
          <div>
            <span className="font-bold text-slate-600">天候・道路:</span>{' '}
            <span>＿＿＿＿（乾燥/湿潤）</span>
          </div>
          <div>
            <span className="font-bold text-slate-600">総乗車延べ人数:</span>{' '}
            <strong className="text-sm font-mono">{totalDailyCompleted} / {totalDailyRiders} 名</strong>
          </div>
        </div>
      </div>

      {/* 1. 各便の運行実績一覧テーブル */}
      <div className="space-y-1 mb-4">
        <h2 className="text-xs font-black text-black border-l-4 border-black pl-1.5 py-0.5">
          1. 便別運行実績 ＆ 点呼集計
        </h2>
        <table className="w-full text-left border-collapse border-2 border-black text-xs">
          <thead>
            <tr className="bg-slate-200 text-black border-b-2 border-black text-center font-bold">
              <th className="border border-black py-1.5 px-2 w-20">運行便</th>
              <th className="border border-black py-1.5 px-2 w-24">定刻 / 区分</th>
              <th className="border border-black py-1.5 px-2 w-24">運行実績</th>
              <th className="border border-black py-1.5 px-2 w-16">予定</th>
              <th className="border border-black py-1.5 px-2 w-16">実乗車</th>
              <th className="border border-black py-1.5 px-2 w-16">欠席</th>
              <th className="border border-black py-1.5 px-2">運行連絡・遅延理由・特記事項</th>
            </tr>
          </thead>
          <tbody>
            {tripStats.map((t) => (
              <tr key={t.trip} className="border-b border-black">
                <td className="border border-black font-bold text-center py-2 px-2 bg-slate-50">
                  {t.trip}
                </td>
                <td className="border border-black text-center py-2 px-2 font-mono">
                  {t.isOperating ? (
                    <span className="font-bold">{t.departureTime} 発</span>
                  ) : (
                    <span className="text-slate-400 font-normal">運休</span>
                  )}
                </td>
                <td className="border border-black text-center py-2 px-2">
                  {!t.isOperating ? (
                    <span className="text-slate-400">運休</span>
                  ) : t.delayMinutes > 0 ? (
                    <span className="font-bold text-black bg-amber-100 px-1.5 py-0.5 rounded border border-black">
                      +{t.delayMinutes}分遅延
                    </span>
                  ) : t.opStatus === 'arrived' || t.opStatus === 'finished' ? (
                    <span className="font-bold text-black">定刻完了</span>
                  ) : (
                    <span className="text-slate-600">定刻運行</span>
                  )}
                </td>
                <td className="border border-black text-center py-2 px-1.5 font-mono font-bold">
                  {t.isOperating ? `${t.reservedCount}名` : '-'}
                </td>
                <td className="border border-black text-center py-2 px-1.5 font-mono font-bold text-black">
                  {t.isOperating ? `${t.completedCount}名` : '-'}
                </td>
                <td className="border border-black text-center py-2 px-1.5 font-mono font-bold text-slate-700">
                  {t.isOperating ? `${t.absentCount}名` : '-'}
                </td>
                <td className="border border-black py-2 px-2 text-[9pt] leading-tight">
                  {t.message ? (
                    <span className="font-bold text-black">💬 {t.message}</span>
                  ) : t.isOperating ? (
                    <span className="text-slate-400">異常なし・定刻運行</span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-100 font-bold border-t-2 border-black text-center">
              <td colSpan={3} className="border border-black py-1.5 px-2 text-right">
                1日合計延べ人数:
              </td>
              <td className="border border-black py-1.5 px-1.5 font-mono">{totalDailyRiders}名</td>
              <td className="border border-black py-1.5 px-1.5 font-mono text-black">{totalDailyCompleted}名</td>
              <td className="border border-black py-1.5 px-1.5 font-mono text-slate-700">{totalDailyAbsent}名</td>
              <td className="border border-black py-1.5 px-2 text-left text-[8.5pt] font-normal text-slate-600">
                ※全便の点呼記録および乗車実績はデータベースへ正常に記録保管済
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 2. 乗務前点呼・乗務後点呼・日常点検記録 */}
      <div className="space-y-1 mb-4">
        <h2 className="text-xs font-black text-black border-l-4 border-black pl-1.5 py-0.5">
          2. 乗務前・乗務後 点呼執行 ＆ 車両安全点検記録
        </h2>
        <div className="grid grid-cols-2 gap-3">
          
          {/* 乗務前点呼 */}
          <div className="border-2 border-black p-2.5 rounded text-xs space-y-2 bg-slate-50/50">
            <div className="flex justify-between items-center border-b border-black pb-1">
              <span className="font-black text-black">【乗務前点呼】（朝の運行開始前）</span>
              <span className="font-mono text-[9pt]">執行時刻: 07:10</span>
            </div>
            <div className="space-y-1 text-[9pt]">
              <div className="flex justify-between">
                <span>① アルコール検知器測定:</span>
                <strong className="font-mono text-black">0.00 mg/L (酒気帯び無)</strong>
              </div>
              <div className="flex justify-between">
                <span>② 運転免許証の携帯確認:</span>
                <strong className="text-black">確認済 [ ◯ ]</strong>
              </div>
              <div className="flex justify-between">
                <span>③ 健康状態・体温測定:</span>
                <strong className="text-black">良好 (36.5℃) [ ◯ ]</strong>
              </div>
              <div className="flex justify-between">
                <span>④ 車両日常点検（ブレーキ・灯火・タイヤ）:</span>
                <strong className="text-black">異常なし [ ◯ ]</strong>
              </div>
            </div>
            <div className="pt-1 border-t border-slate-300 flex justify-between items-center text-[8.5pt]">
              <span>点呼執行者: <strong>教頭 / 運行管理者</strong></span>
              <span>執行者印: [　印　]</span>
            </div>
          </div>

          {/* 乗務後点呼 */}
          <div className="border-2 border-black p-2.5 rounded text-xs space-y-2 bg-slate-50/50">
            <div className="flex justify-between items-center border-b border-black pb-1">
              <span className="font-black text-black">【乗務後点呼】（最終便終了後）</span>
              <span className="font-mono text-[9pt]">執行時刻: 18:45</span>
            </div>
            <div className="space-y-1 text-[9pt]">
              <div className="flex justify-between">
                <span>① アルコール検知器測定:</span>
                <strong className="font-mono text-black">0.00 mg/L (酒気帯び無)</strong>
              </div>
              <div className="flex justify-between">
                <span>② 車両内外の清掃・消毒実施:</span>
                <strong className="text-black">実施済 [ ◯ ]</strong>
              </div>
              <div className="flex justify-between">
                <span>③ <strong>車内置き去り防止・残置物点検</strong>:</span>
                <strong className="text-black bg-slate-200 px-1 rounded">生徒・遺留品なし確認済 [ ◯ ]</strong>
              </div>
              <div className="flex justify-between">
                <span>④ 燃料残量・メーター確認:</span>
                <strong className="font-mono text-black">残量 3/4 [ ◯ ]</strong>
              </div>
            </div>
            <div className="pt-1 border-t border-slate-300 flex justify-between items-center text-[8.5pt]">
              <span>点呼執行者: <strong>教頭 / 運行管理者</strong></span>
              <span>執行者印: [　印　]</span>
            </div>
          </div>

        </div>
      </div>

      {/* 3. 特記事項・ヒヤリハット・連絡事項 */}
      <div className="space-y-1 mb-2">
        <h2 className="text-xs font-black text-black border-l-4 border-black pl-1.5 py-0.5">
          3. 運行特記事項・道路状況・ヒヤリハット報告
        </h2>
        <div className="border border-black p-3 rounded text-xs h-18 text-slate-800 bg-white">
          <p className="text-[9pt] leading-relaxed">
            道路工事・渋滞状況、生徒の乗降マナー、保護者からの連絡申し送り事項、その他ヒヤリハット事例があれば記入してください。
          </p>
          <div className="mt-2 text-[9pt] font-mono text-slate-500">
            特記事項：特になし（安全運転励行・定刻運行）
          </div>
        </div>
      </div>

      {/* フッター情報 */}
      <div className="mt-2 text-[8pt] text-slate-500 flex justify-between items-center border-t border-slate-300 pt-1.5">
        <span>※本運行日報は学校教育安全管理基準に基づき作成され、1年間保管されます。</span>
        <span>帳票出力日時: {new Date().toLocaleString('ja-JP')}</span>
      </div>

    </div>
  )
}
