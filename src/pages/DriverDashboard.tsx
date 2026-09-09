import React, { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import {
  Bus,
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  Circle,
  RefreshCw,
  LogOut,
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { RoleSwitcher } from '../components/RoleSwitcher'

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
    schoolTimetable
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

  // 日付の前後移動
  const changeDateByDays = (days: number) => {
    const parts = selectedDate.split('/').map(Number)
    const d = new Date(parts[0], parts[1] - 1, parts[2] + days)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    setSelectedDate(`${y}/${m}/${day}`)
  }

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

  // 学校用時刻表の備考
  const schoolTimetableRow = useMemo(() => {
    const target = selectedDate.replace(/-/g, '/')
    return schoolTimetable.find(t => t.date.replace(/-/g, '/') === target)
  }, [selectedDate, schoolTimetable])


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

  // チェックトグル
  const toggleCheck = (studentName: string) => {
    const key = `${selectedDate}_${selectedTrip}_${studentName}`
    setCheckedStudents(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
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

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* ヘッダー */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-600 p-2 rounded-xl text-white shadow-md">
              <Bus className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">乗車運行リスト</h1>
              <p className="text-xs text-slate-400">
                運転手: {user?.name || user?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <RoleSwitcher />
            <button
              onClick={() => refreshAll()}
              disabled={syncing}
              className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-lg text-sm transition"
              title="スプレッドシート再取得"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-emerald-400' : ''}`} />
              <span className="hidden sm:inline">{syncing ? '同期中...' : '更新'}</span>
            </button>
            <button
              onClick={logout}
              className="flex items-center space-x-1 px-3 py-1.5 bg-rose-900/80 hover:bg-rose-800 text-rose-100 rounded-lg text-sm transition"
              title="ログアウト"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>
        </div>
      </header>

      {/* メインエリア */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-4 space-y-4">
        {/* 運休・注意アラート */}
        {holidayInfo && (
          <div className="bg-amber-500 text-white p-3.5 rounded-xl shadow flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-bold">【運休・特別期間】</span> {holidayInfo.setting_name}（{holidayInfo.start_date} ～ {holidayInfo.end_date}）
              {holidayInfo.note && <span className="ml-2">※ {holidayInfo.note}</span>}
            </div>
          </div>
        )}

        {schoolTimetableRow?.note && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-xl text-xs flex items-center space-x-2">
            <span className="font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded text-[10px]">学校連絡</span>
            <span>{schoolTimetableRow.note}</span>
          </div>
        )}

        {/* 日付ナビゲーション */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => changeDateByDays(-1)}
              className="p-2 hover:bg-slate-100 active:scale-95 rounded-xl border border-slate-200 text-slate-700 transition"
              title="前日"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              <input
                type="date"
                value={selectedDate.replace(/\//g, '-')}
                onChange={e => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value.replace(/-/g, '/'))
                  }
                }}
                className="font-bold text-slate-800 border-none bg-slate-50 px-3 py-1.5 rounded-lg text-base focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={() => changeDateByDays(1)}
              className="p-2 hover:bg-slate-100 active:scale-95 rounded-xl border border-slate-200 text-slate-700 transition"
              title="翌日"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={() => setSelectedDate(getTodayStr())}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
          >
            今日へ移動
          </button>
        </div>

        {/* 便選択タブ */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { id: 'morning', label: '登校便 (朝)', icon: '🌅' },
            { id: 'afternoon_1', label: '下校 1便', icon: '🚌' },
            { id: 'afternoon_2', label: '下校 2便', icon: '🚍' },
            { id: 'afternoon_3', label: '下校 3便', icon: '🌙' }
          ].map(trip => {
            const active = selectedTrip === trip.id
            return (
              <button
                key={trip.id}
                onClick={() => setSelectedTrip(trip.id as any)}
                className={`py-3 px-2 rounded-xl text-center font-bold text-xs sm:text-sm transition flex flex-col items-center justify-center space-y-1 ${
                  active
                    ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-500 ring-offset-1'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm'
                }`}
              >
                <span className="text-base">{trip.icon}</span>
                <span>{trip.label}</span>
              </button>
            )
          })}
        </div>

        {/* サマリーバー */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-slate-800 p-2.5 rounded-xl">
              <Users className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">乗車予定人数</p>
              <p className="text-xl font-bold">
                {tripPassengers.length} <span className="text-xs font-normal text-slate-400">名</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-slate-800/80 px-4 py-2 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-300">点呼確認済:</span>
            <span className="text-sm font-bold text-emerald-400">{checkedCount} / {tripPassengers.length}</span>
          </div>
        </div>

        {/* バス停順乗車リスト */}
        <div className="space-y-3">
          {sortedBusStopsWithStudents.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-slate-400 border border-slate-200">
              バス停データがありません。
            </div>
          ) : (
            sortedBusStopsWithStudents.map(({ stop, students }) => {
              const hasStudents = students.length > 0

              return (
                <div
                  key={stop.name}
                  className={`bg-white rounded-2xl border transition shadow-sm overflow-hidden ${
                    hasStudents ? 'border-slate-200' : 'border-slate-100 opacity-60'
                  }`}
                >
                  {/* バス停ヘッダー */}
                  <div className={`px-4 py-3 flex items-center justify-between ${hasStudents ? 'bg-slate-50' : 'bg-slate-50/50'}`}>
                    <div className="flex items-center space-x-3">
                      <span className="w-7 h-7 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {stop.order || '-'}
                      </span>
                      <div>
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-emerald-600" />
                          <h3 className="font-bold text-slate-800 text-base">{stop.name}</h3>
                        </div>
                        {stop.address && (
                          <p className="text-xs text-slate-400 pl-6">{stop.address}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      {stop.arrival_time_morning && selectedTrip === 'morning' && (
                        <div className="flex items-center space-x-1 text-xs text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-md">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{stop.arrival_time_morning} 予定</span>
                        </div>
                      )}
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                          hasStudents
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {students.length}名
                      </span>
                    </div>
                  </div>

                  {/* 生徒一覧 */}
                  {hasStudents ? (
                    <div className="divide-y divide-slate-100">
                      {students.map(p => {
                        const checkKey = `${selectedDate}_${selectedTrip}_${p.studentName}`
                        const isChecked = !!checkedStudents[checkKey]

                        return (
                          <div
                            key={p.studentName}
                            onClick={() => toggleCheck(p.studentName)}
                            className={`p-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition select-none ${
                              isChecked ? 'bg-emerald-50/50' : ''
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              {isChecked ? (
                                <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                              ) : (
                                <Circle className="w-6 h-6 text-slate-300 flex-shrink-0" />
                              )}
                              <div>
                                <p className={`font-bold text-base ${isChecked ? 'text-emerald-950 line-through' : 'text-slate-900'}`}>
                                  {p.studentName}
                                </p>
                                {p.note && (
                                  <p className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded mt-0.5 inline-block font-medium">
                                    備考: {p.note}
                                  </p>
                                )}
                              </div>
                            </div>

                            <span
                              className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                                isChecked
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {isChecked ? '乗車済' : '未乗車'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="p-3 text-center text-xs text-slate-400">
                      このバス停での乗車予定生徒はいません
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </main>
    </div>
  )
}
