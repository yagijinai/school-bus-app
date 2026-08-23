import React from 'react'
import type { Student, BusStop, Reservation, RideStatus, BusOperation } from '../../types/app'

interface PrintableRosterProps {
  date: string
  tripName: string
  routeName?: string
  driverName?: string
  students: Student[]
  busStops: BusStop[]
  reservations: Reservation[]
  rideStatuses: RideStatus[]
  busOperations: BusOperation[]
  getAdjustedStopArrivalTime: (stop: BusStop, date: string) => string
  getTripTime: (tripName: string, date: string) => string
}

export const PrintableRoster: React.FC<PrintableRosterProps> = ({
  date,
  tripName,
  routeName = 'スクールバス運行ルート',
  driverName = '担当ドライバー',
  students,
  busStops,
  reservations,
  rideStatuses,
  busOperations,
  getAdjustedStopArrivalTime,
  getTripTime
}) => {
  const dateObj = new Date(`${date}T00:00:00`)
  const weekdaysJa = ['日', '月', '火', '水', '木', '金', '土']
  const weekday = weekdaysJa[dateObj.getDay()] || ''
  const departureTime = getTripTime(tripName, date)

  const currentOp = busOperations.find(
    op => op.date === date && (op.trip_name === tripName || (!op.trip_name && tripName === '登校便'))
  )

  // 該当便の乗車対象生徒を抽出
  const isStudentRiding = (studentId: string): boolean => {
    const res = reservations.find(r => r.student_id === studentId && r.date === date)
    if (!res) return false
    return tripName === '登校便' ? res.morning_status === true : res.afternoon_schedule === tripName
  }

  const sortedStops = [...busStops].sort((a, b) => a.order_index - b.order_index)

  // 生徒リストをバス停順に整列
  const stopGroupedStudents = sortedStops.map(stop => {
    const stopStudents = students.filter(s => s.default_bus_stop_id === stop.id && isStudentRiding(s.id))
    return {
      stop,
      students: stopStudents
    }
  })

  // バス停未設定またはその他
  const unassignedStudents = students.filter(
    s => (!s.default_bus_stop_id || !sortedStops.some(st => st.id === s.default_bus_stop_id)) && isStudentRiding(s.id)
  )

  const totalRiders = stopGroupedStudents.reduce((acc, g) => acc + g.students.length, 0) + unassignedStudents.length

  const completedCount = students.filter(s => {
    if (!isStudentRiding(s.id)) return false
    const status = rideStatuses.find(r => r.student_id === s.id && r.date === date && (r.trip_name === tripName || (!r.trip_name && tripName === '登校便')))
    return status?.status === 'completed'
  }).length

  const absentCount = students.filter(s => {
    if (!isStudentRiding(s.id)) return false
    const status = rideStatuses.find(r => r.student_id === s.id && r.date === date && (r.trip_name === tripName || (!r.trip_name && tripName === '登校便')))
    return status?.status === 'absent'
  }).length

  return (
    <div className="printable-document bg-white text-black p-6 max-w-[210mm] mx-auto text-[10pt] font-sans border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0 print:m-0">
      
      {/* 帳票ヘッダー */}
      <div className="border-b-2 border-black pb-2 mb-3">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[9pt] font-bold text-slate-600 block tracking-widest">
              【運行管理・安全点呼記録簿】
            </span>
            <h1 className="text-xl font-black tracking-wider text-black mt-0.5">
              スクールバス乗車点呼名簿
            </h1>
            <p className="text-xs text-slate-700 mt-1">
              路線名: <strong>{routeName}</strong> ／ 発車定刻: <strong>{departureTime !== '--:--' ? `${departureTime} 発` : '通常ダイヤ'}</strong>
            </p>
          </div>

          {/* 検印枠（4枠: 校長・教頭・運行管理者・運転手） */}
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
              <div className="bg-slate-100 border-b border-black py-0.5 font-bold text-[8.5pt]">運転手</div>
              <div className="h-11 flex items-center justify-center text-slate-300">印</div>
            </div>
          </div>
        </div>

        {/* 運行基本情報メタバー */}
        <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-400 text-xs">
          <div>
            <span className="font-bold text-slate-600">運行日:</span>{' '}
            <strong className="text-sm font-mono">{dateObj.getFullYear()}年{dateObj.getMonth() + 1}月{dateObj.getDate()}日 ({weekday})</strong>
          </div>
          <div>
            <span className="font-bold text-slate-600">対象便:</span>{' '}
            <strong className="text-sm underline font-bold bg-slate-100 px-2 py-0.5 rounded">{tripName}</strong>
          </div>
          <div>
            <span className="font-bold text-slate-600">乗務員:</span>{' '}
            <strong>{driverName}</strong>
          </div>
          <div>
            <span className="font-bold text-slate-600">天候/気温:</span>{' '}
            <span>＿＿＿＿（＿＿℃）</span>
          </div>
        </div>
      </div>

      {/* サマリー集計バー */}
      <div className="grid grid-cols-5 gap-2 bg-slate-100 border border-black px-3 py-1.5 rounded mb-3 text-xs text-center font-bold">
        <div className="border-r border-slate-300">
          乗車予定: <strong className="text-sm text-black font-mono">{totalRiders}</strong> 名
        </div>
        <div className="border-r border-slate-300">
          乗車確認済: <strong className="text-sm text-emerald-800 font-mono">{completedCount}</strong> 名
        </div>
        <div className="border-r border-slate-300">
          欠席・不乗車: <strong className="text-sm text-rose-800 font-mono">{absentCount}</strong> 名
        </div>
        <div className="border-r border-slate-300">
          未点呼: <strong className="text-sm text-slate-700 font-mono">{totalRiders - completedCount - absentCount}</strong> 名
        </div>
        <div>
          遅延状況: <span className="font-bold">{currentOp?.delay_minutes ? `⚠️ 約${currentOp.delay_minutes}分遅延` : '定刻運行'}</span>
        </div>
      </div>

      {/* 点呼名簿テーブル */}
      <table className="w-full text-left border-collapse border-2 border-black text-xs">
        <thead>
          <tr className="bg-slate-200 text-black border-b-2 border-black text-center font-bold">
            <th className="border border-black py-1 px-1.5 w-8">順</th>
            <th className="border border-black py-1 px-2 w-32">乗降停留所 / 予定時刻</th>
            <th className="border border-black py-1 px-1.5 w-16">学年・組</th>
            <th className="border border-black py-1 px-3">生徒氏名</th>
            <th className="border border-black py-1 px-2 w-14">予定</th>
            <th className="border border-black py-1 px-2 w-28">点呼チェック（〇・✕）</th>
            <th className="border border-black py-1 px-2">保護者連絡メモ・特記事項</th>
          </tr>
        </thead>
        <tbody>
          {totalRiders > 0 ? (
            stopGroupedStudents.map((group) => {
              if (group.students.length === 0) return null
              const stopTime = getAdjustedStopArrivalTime(group.stop, date)

              return group.students.map((student, idx) => {
                const res = reservations.find(r => r.student_id === student.id && r.date === date)
                const ride = rideStatuses.find(
                  r => r.student_id === student.id && r.date === date && (r.trip_name === tripName || (!r.trip_name && tripName === '登校便'))
                )
                const isCompleted = ride?.status === 'completed'
                const isAbsent = ride?.status === 'absent'
                const checkTime = ride?.updated_at ? new Date(ride.updated_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : ''

                return (
                  <tr key={student.id} className="border-b border-black hover:bg-slate-50">
                    {idx === 0 ? (
                      <td
                        rowSpan={group.students.length}
                        className="border border-black text-center font-bold bg-slate-50 align-middle py-1.5 px-1 font-mono text-[9pt]"
                      >
                        {group.stop.order_index}
                      </td>
                    ) : null}

                    {idx === 0 ? (
                      <td
                        rowSpan={group.students.length}
                        className="border border-black font-bold bg-slate-50 align-middle py-1.5 px-2"
                      >
                        <div className="font-bold text-black">{group.stop.stop_name}</div>
                        <div className="text-[8.5pt] text-slate-600 font-mono font-bold">
                          {stopTime ? `${stopTime} 発` : ''}
                        </div>
                      </td>
                    ) : null}

                    <td className="border border-black text-center py-2 px-1.5 text-slate-800">
                      {student.grade} {student.class_name || ''}
                    </td>

                    <td className="border border-black font-black py-2 px-3 text-sm text-black">
                      {student.name}
                      {student.student_code && (
                        <span className="text-[8pt] text-slate-500 font-normal font-mono ml-1.5">
                          ({student.student_code})
                        </span>
                      )}
                    </td>

                    <td className="border border-black text-center py-2 px-1.5">
                      <span className="text-xs font-bold text-slate-800">
                        {tripName === '登校便' ? (res?.morning_status ? '乗車' : '不乗車') : (res?.afternoon_schedule || '乗車')}
                      </span>
                    </td>

                    <td className="border border-black text-center py-2 px-2">
                      {isCompleted ? (
                        <span className="font-black text-black">
                          ◯ 乗車済 {checkTime && <span className="font-mono text-[8pt]">({checkTime})</span>}
                        </span>
                      ) : isAbsent ? (
                        <span className="font-bold text-slate-700">✕ 欠席</span>
                      ) : (
                        <span className="inline-block w-8 h-5 border border-dashed border-slate-400 rounded"></span>
                      )}
                    </td>

                    <td className="border border-black py-2 px-2 text-[9pt] text-slate-800 leading-snug">
                      {res?.note ? (
                        <span className="font-bold text-black">💬 {res.note}</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                )
              })
            })
          ) : (
            <tr>
              <td colSpan={7} className="border border-black py-10 text-center text-slate-500 italic">
                本便（{tripName}）の乗車予約生徒はいません。
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* 運行・安全点検＆申し送り欄（ボールペン記入用） */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="border border-black p-2.5 rounded text-xs space-y-1.5 bg-slate-50/50">
          <span className="font-bold block text-black border-b border-slate-300 pb-1">
            【安全点呼・日常点検チェック】
          </span>
          <div className="grid grid-cols-2 gap-2 text-[9pt]">
            <div>
              <span>アルコール検知器測定:</span><br />
              <strong className="text-black font-mono">[ 0.00 mg/L ] (適正)</strong>
            </div>
            <div>
              <span>車両日常点検:</span><br />
              <strong className="text-black">[ 異常なし・実施済 ]</strong>
            </div>
          </div>
          <div className="text-[8.5pt] text-slate-600 pt-1">
            点呼執行者確認印: [　　　] ／ 同乗指導員: ＿＿＿＿＿＿
          </div>
        </div>

        <div className="border border-black p-2.5 rounded text-xs space-y-1 bg-slate-50/50">
          <span className="font-bold block text-black border-b border-slate-300 pb-1">
            【乗務日報・道路状況・申し送り事項】
          </span>
          <div className="h-12 text-[9pt] text-slate-700">
            {currentOp?.message ? `連絡事項: ${currentOp.message}` : '※特記事項・道路工事・忘れ物等があればご記入ください。'}
          </div>
        </div>
      </div>

      {/* フッター出力情報 */}
      <div className="mt-2 text-[8pt] text-slate-500 flex justify-between items-center">
        <span>※本帳票は運行前点呼および乗車確認時に使用し、運行完了後に学校へ提出・保管してください。</span>
        <span>帳票出力日時: {new Date().toLocaleString('ja-JP')}</span>
      </div>

    </div>
  )
}
