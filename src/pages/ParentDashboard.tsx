import React, { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { 
  Bus, 
  ChevronLeft, ChevronRight, User, RefreshCw, LogOut, CheckCircle2, Ban,
  Plus, UserPlus, AlertCircle, X
} from 'lucide-react'
import { toSlashDate, toHyphenDate } from '../lib/spreadsheetApi'

export const ParentDashboard: React.FC = () => {
  const { 
    user, logout, guardianMaster, schedules, 
    basicSettings, schoolTimetable, busStops, 
    saveReservation, linkStudentWithCode, syncing, refreshAll 
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
  React.useEffect(() => {
    if (studentNames.length > 0 && (!selectedStudent || !studentNames.includes(selectedStudent))) {
      setSelectedStudent(studentNames[0])
    }
  }, [studentNames, selectedStudent])

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

  // 予約変更ハンドラ
  const handleUpdate = async (dateSlash: string, field: 'morning' | 'afternoon', value: string) => {
    if (!user || !selectedStudent) return

    // 既存予約行を探す
    const existing = schedules.find(s => s.date === dateSlash && s.student_name === selectedStudent)
    
    // 現在値
    const curMorning = existing ? existing.morning_status : (myGuardian?.default_morning || '')
    const curAfternoonStatus = existing ? existing.afternoon_status : (myGuardian?.default_afternoon === '乗らない' ? '乗らない' : '')
    const curTrip1 = existing ? existing.afternoon_trip_1 : (myGuardian?.default_afternoon === '1便' ? '1便' : '')
    const curTrip2 = existing ? existing.afternoon_trip_2 : (myGuardian?.default_afternoon === '2便' ? '2便' : '')
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
        newTrip1 = '1便'
        newTrip2 = ''
        newTrip3 = ''
      } else if (value === '2便') {
        newAfternoonStatus = ''
        newTrip1 = ''
        newTrip2 = '2便'
        newTrip3 = ''
      } else if (value === '3便') {
        newAfternoonStatus = ''
        newTrip1 = ''
        newTrip2 = ''
        newTrip3 = '3便'
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
          <button
            type="button"
            onClick={() => refreshAll()}
            disabled={syncing}
            className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition-all text-xs font-bold flex items-center gap-1.5"
            title="最新データを再取得"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin text-amber-400' : ''}`} />
            {syncing ? '更新中' : '同期'}
          </button>
          <button
            type="button"
            onClick={logout}
            className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-rose-400 transition-all text-xs font-bold flex items-center gap-1.5"
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

      {/* 週間カレンダーコントロール */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3">
        <button
          type="button"
          onClick={() => setWeekOffset(prev => prev - 1)}
          className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition-all flex items-center gap-1 text-xs font-bold"
        >
          <ChevronLeft className="h-4 w-4" />
          前の週
        </button>
        <div className="text-center">
          <span className="text-sm font-black text-white">
            {weekDays[0]?.dateStrSlash} 〜 {weekDays[4]?.dateStrSlash}
          </span>
          {weekOffset === 0 && (
            <span className="ml-2 text-[10px] px-2 py-0.5 bg-amber-500/15 text-amber-300 rounded font-bold">
              今週
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setWeekOffset(prev => prev + 1)}
          className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition-all flex items-center gap-1 text-xs font-bold"
        >
          次の週
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* 週間予約カードグリッド */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {weekDays.map(day => {
          const suspension = checkSuspension(day.dateStrSlash)
          const timetableRow = schoolTimetable.find(t => t.date === day.dateStrSlash)
          const existing = schedules.find(s => s.date === day.dateStrSlash && s.student_name === selectedStudent)
          
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

          const cardKey = `${day.dateStrSlash}-${selectedStudent}`
          const isSaving = savingKey === cardKey
          const isSaved = savedKey === cardKey

          return (
            <div
              key={day.dateStrSlash}
              className={`bg-slate-900/90 border rounded-3xl p-4 flex flex-col justify-between space-y-3 transition-all ${
                suspension.isSuspended 
                  ? 'border-rose-500/30 bg-rose-950/10' 
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* 日付ヘッダー */}
              <div className="border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-400">
                    {day.dateStrSlash.slice(5)}
                  </span>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                    day.dayName === '月' ? 'bg-sky-500/10 text-sky-400' :
                    day.dayName === '金' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-slate-800 text-slate-300'
                  }`}>
                    （{day.dayName}）
                  </span>
                </div>

                {/* 行事・時刻表備考 */}
                {timetableRow?.calendar_label && (
                  <div className="mt-1 text-[10px] text-amber-300 font-bold truncate">
                    {timetableRow.calendar_label}
                  </div>
                )}

                {/* 運休表示 */}
                {suspension.isSuspended && (
                  <div className="mt-1.5 p-1.5 bg-rose-500/20 border border-rose-500/30 rounded-xl flex items-center gap-1 text-[10px] text-rose-300 font-black">
                    <Ban className="h-3 w-3 shrink-0" />
                    <span className="truncate">{suspension.name || '運休期間'}</span>
                  </div>
                )}
              </div>

              {/* 予約選択フォーム */}
              {suspension.isSuspended ? (
                <div className="py-6 text-center text-xs font-bold text-slate-500">
                  全便運休
                </div>
              ) : (
                <div className="space-y-3 py-1">
                  {/* 登校便 */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
                      <span>登校便:</span>
                      {myBusStop?.arrival_time_morning && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          {myBusStop.arrival_time_morning}
                        </span>
                      )}
                    </label>
                    <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleUpdate(day.dateStrSlash, 'morning', '乗る')}
                        className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                          morningVal === '乗る'
                            ? 'bg-amber-500 text-slate-950 shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        乗る
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdate(day.dateStrSlash, 'morning', '')}
                        className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                          morningVal === '乗らない'
                            ? 'bg-slate-800 text-slate-200 shadow'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        乗らない
                      </button>
                    </div>
                  </div>

                  {/* 下校便 */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 block">
                      下校便:
                    </label>
                    <select
                      value={afternoonVal}
                      onChange={(e) => handleUpdate(day.dateStrSlash, 'afternoon', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-bold text-white focus:border-amber-400 outline-none transition-all cursor-pointer"
                    >
                      <option value="1便">下校 1便{timetableRow?.afternoon_trip_1 ? ` (${timetableRow.afternoon_trip_1})` : ''}</option>
                      <option value="2便">下校 2便{timetableRow?.afternoon_trip_2 ? ` (${timetableRow.afternoon_trip_2})` : ''}</option>
                      <option value="3便">下校 3便{timetableRow?.afternoon_trip_3 ? ` (${timetableRow.afternoon_trip_3})` : ''}</option>
                      <option value="乗らない">乗らない（保護者送迎等）</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 保存ステータスインジケーター */}
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                <span className="text-slate-500">
                  {existing ? '登録済' : '基本設定適用'}
                </span>
                {isSaving ? (
                  <span className="text-amber-400 font-bold flex items-center gap-1">
                    <RefreshCw className="h-2.5 w-2.5 animate-spin" /> 保存中
                  </span>
                ) : isSaved ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                    <CheckCircle2 className="h-3 w-3" /> 保存済
                  </span>
                ) : (
                  <span className="text-slate-600 font-mono">自動同期</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

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
    </div>
  )
}
