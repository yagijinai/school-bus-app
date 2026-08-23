import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { Student } from '../../types/app'
import { mockStudents } from '../../lib/mockData'
import { DriverStatusControl } from '../../components/driver/DriverStatusControl'
import { ExportAndPrintModal } from '../../components/admin/ExportAndPrintModal'
import { NextMonthScheduleView } from '../../components/driver/NextMonthScheduleView'
import { 
  getOfflineQueue, 
  enqueueOfflineRide, 
  clearOfflineQueue, 
  triggerHaptic, 
  type OfflineRideLog 
} from '../../lib/offlineQueue'
import { 
  LogOut, Bus, Clock, AlertCircle, 
  Play, Square, UserCheck, 
  CheckCircle2, RotateCcw, Users, Calendar, 
  ChevronLeft, ChevronRight, RefreshCw, MessageSquare, 
  MapPin, ShieldAlert, Sparkles, Filter, Printer, CalendarDays,
  WifiOff
} from 'lucide-react'

// 運行便の定義
export const BUS_TRIPS = [
  { id: '登校便', name: '登校便', time: '朝（07:30〜）', type: 'morning' },
  { id: '下校1便', name: '下校1便', time: '15:00発', type: 'afternoon' },
  { id: '下校2便', name: '下校2便', time: '16:00発', type: 'afternoon' },
  { id: '下校3便', name: '下校3便', time: '17:00発', type: 'afternoon' },
  { id: '下校4便', name: '下校4便', time: '18:00発', type: 'afternoon' },
  { id: '下校5便', name: '下校5便', time: '18:30発', type: 'afternoon' }
] as const

export const DriverDashboard: React.FC = () => {
  const { 
    user, signOut, busOperations, updateOperation, 
    reservations, rideStatuses, updateStudentRideStatus, refreshData,
    busRoutes, busStops, students: dbStudents, getTripTime, getAdjustedStopArrivalTime, 
    isTripOperating, getDateScheduleStatus, isRealtimeConnected 
  } = useAuth()

  // 0. メインタブ状態 ('daily': 本日の点呼・運行, 'monthly': 翌月・月別運行ダイヤ確認)
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily')

  // 1. 対象日付状態（デフォルトは本日 YYYY-MM-DD）
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })

  // 2. 選択中の運行便（デフォルトは登校便）
  const [selectedTrip, setSelectedTrip] = useState<string>('登校便')

  // 3. データ再取得（リフレッシュ）状態
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)

  // 4. トースト通知状態
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // 5. 名簿印刷・日報モーダル状態
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false)

  // 6. 不乗車（予約なし）生徒の表示トグル
  const [showNonRiders, setShowNonRiders] = useState<boolean>(false)

  // 7. オフライン未送信キュー状態
  const [offlineQueue, setOfflineQueue] = useState<OfflineRideLog[]>(() => getOfflineQueue())
  const [isSyncingQueue, setIsSyncingQueue] = useState<boolean>(false)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 3000)
  }

  // 運転手の担当ルートを自動取得（ドライバーIDに紐づくルート、または先頭ルート）
  const userRoute = busRoutes.find(r => r.driver_id === user?.id)
  const route = userRoute || busRoutes.find(r => r.id === 'route-a') || busRoutes[0] || { id: 'route-a', route_name: 'スクールバス運行ルート', driver_id: null }
  const routeId = route.id

  // 選択中の運行便のステータスを取得
  const operation = busOperations.find(
    op => op.bus_route_id === routeId && (op.trip_name === selectedTrip || (!op.trip_name && selectedTrip === '登校便'))
  )

  const defaultStudents: Student[] = mockStudents
  const students = dbStudents && dbStudents.length > 0 ? dbStudents : defaultStudents

  // 選択日の運行状況・スケジュールステータス
  const scheduleStatus = getDateScheduleStatus(selectedDate)
  const selectedDateObj = new Date(`${selectedDate}T00:00:00`)
  const dayOfWeekNum = selectedDateObj.getDay()
  const weekdayJa = ['日', '月', '火', '水', '木', '金', '土'][dayOfWeekNum]
  const isToday = selectedDate === new Date().toISOString().split('T')[0]

  // 日付送り・戻し
  const handlePrevDay = () => {
    const d = new Date(`${selectedDate}T00:00:00`)
    d.setDate(d.getDate() - 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    setSelectedDate(`${y}-${m}-${day}`)
  }

  const handleNextDay = () => {
    const d = new Date(`${selectedDate}T00:00:00`)
    d.setDate(d.getDate() + 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    setSelectedDate(`${y}-${m}-${day}`)
  }

  const handleSetToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0])
  }

  // リアルタイム手動更新
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refreshData()
      showToast('最新の予約・点呼データを再取得しました')
    } catch (err) {
      console.error(err)
    } finally {
      setIsRefreshing(false)
    }
  }

  // 選択中の便における生徒の乗車対象判定
  const isStudentRidingCurrentTrip = (studentId: string): boolean => {
    const res = reservations.find(r => r.student_id === studentId && r.date === selectedDate)
    const student = students.find(s => s.id === studentId)

    if (res) {
      if (selectedTrip === '登校便') {
        return res.morning_status === true
      } else {
        return res.afternoon_schedule === selectedTrip
      }
    }

    // reservations レコードがまだない場合は生徒デフォルト設定を反映
    if (selectedTrip === '登校便') {
      return student ? student.default_morning_ride : false
    } else {
      return student ? student.default_afternoon_schedule === selectedTrip : false
    }
  }

  // オフラインキューの再同期
  const syncOfflineQueue = useCallback(async () => {
    const queue = getOfflineQueue()
    if (queue.length === 0) return

    setIsSyncingQueue(true)
    let successCount = 0
    try {
      for (const item of queue) {
        try {
          await updateStudentRideStatus(item.studentId, item.date, item.tripName, item.status)
          successCount++
        } catch (err) {
          console.error('Failed to sync offline item:', item, err)
        }
      }
      clearOfflineQueue()
      setOfflineQueue([])
      triggerHaptic(60)
      showToast(`オフライン点呼データ ${successCount}件をサーバーへ送信完了しました`)
    } catch (err) {
      console.error('Offline sync error:', err)
    } finally {
      setIsSyncingQueue(false)
    }
  }, [updateStudentRideStatus])

  // オンライン復帰時の自動再送リスナー
  useEffect(() => {
    const handleOnline = () => {
      syncOfflineQueue()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [syncOfflineQueue])

  // 運行スイッチハンドラ
  const handleStartRoute = async () => {
    triggerHaptic(50)
    await updateOperation(routeId, selectedTrip, 'running', 0)
    showToast(`「${selectedTrip}」の運行を開始しました`)
  }

  const handleFinishRoute = async () => {
    if (window.confirm(`「${selectedTrip}」の運行を終了しますか？運行ステータスが「到着済み」になります。`)) {
      triggerHaptic(50)
      await updateOperation(routeId, selectedTrip, 'finished', 0)
      showToast(`「${selectedTrip}」の運行を終了しました`)
    }
  }

  const handleResetRoute = async () => {
    if (window.confirm(`「${selectedTrip}」の運行ステータスをリセットして運行前に戻しますか？`)) {
      triggerHaptic(50)
      await updateOperation(routeId, selectedTrip, 'not_started', 0)
      showToast(`「${selectedTrip}」の運行をリセットしました`)
    }
  }

  // 遅延時間更新ハンドラ
  const handleSetDelay = async (minutes: number) => {
    triggerHaptic(50)
    await updateOperation(routeId, selectedTrip, 'running', minutes)
    showToast(minutes === 0 ? '定時運行に設定しました' : `遅延 +${minutes}分 を保護者へ配信しました`)
  }

  // 乗降チェックの切替（同日内・便ごとに保存 + オフライン退避 & 触覚フィードバック）
  const handleToggleRideStatus = async (
    studentId: string, 
    currentStatus: string | undefined, 
    targetStatus: 'riding' | 'absent' | 'completed'
  ) => {
    const student = students.find(s => s.id === studentId)
    const newStatus = currentStatus === targetStatus ? 'riding' : targetStatus

    // 触覚フィードバック
    if (newStatus === 'completed') {
      triggerHaptic(40)
    } else if (newStatus === 'absent') {
      triggerHaptic([30, 40, 30])
    } else {
      triggerHaptic(20)
    }

    try {
      await updateStudentRideStatus(studentId, selectedDate, selectedTrip, newStatus)
      if (newStatus === 'completed') {
        showToast(`${student?.name || '生徒'} の乗車完了を記録しました`)
      } else if (newStatus === 'absent') {
        showToast(`${student?.name || '生徒'} の欠席を記録しました`)
      } else {
        showToast(`${student?.name || '生徒'} のチェックを解除しました`)
      }
    } catch (err) {
      console.warn('Network error, saving to offline queue:', err)
      const updatedQ = enqueueOfflineRide({
        studentId,
        date: selectedDate,
        tripName: selectedTrip,
        status: newStatus
      })
      setOfflineQueue(updatedQ)
      showToast(`【オフライン保存】${student?.name || '生徒'} の点呼を端末に一時保存しました`)
    }
  }

  // バス停ごとの全員一括乗車完了
  const handleBulkCheckStop = async (studentIds: string[]) => {
    triggerHaptic(60)
    let hasError = false
    for (const sId of studentIds) {
      try {
        await updateStudentRideStatus(sId, selectedDate, selectedTrip, 'completed')
      } catch (err) {
        hasError = true
        enqueueOfflineRide({
          studentId: sId,
          date: selectedDate,
          tripName: selectedTrip,
          status: 'completed'
        })
      }
    }
    if (hasError) {
      setOfflineQueue(getOfflineQueue())
      showToast(`${studentIds.length}名の一括乗車を端末に保存しました（電波回復時に自動送信）`)
    } else {
      showToast(`${studentIds.length}名の一括乗車完了を記録しました`)
    }
  }

  // 同一世帯（兄弟）の一括乗車完了
  const handleBulkCheckSiblings = async (siblingIds: string[]) => {
    triggerHaptic(60)
    let hasError = false
    for (const sId of siblingIds) {
      try {
        await updateStudentRideStatus(sId, selectedDate, selectedTrip, 'completed')
      } catch (err) {
        hasError = true
        enqueueOfflineRide({
          studentId: sId,
          date: selectedDate,
          tripName: selectedTrip,
          status: 'completed'
        })
      }
    }
    if (hasError) {
      setOfflineQueue(getOfflineQueue())
      showToast(`兄弟 ${siblingIds.length}名の一括乗車を端末に保存しました`)
    } else {
      showToast(`兄弟 ${siblingIds.length}名の一括乗車完了を記録しました`)
    }
  }

  // 名字取得ヘルパー
  const getSurname = (fullName: string) => fullName.split(/\s+/)[0] || fullName

  // 本便全体の集計
  const tripStudents = students.filter(s => isStudentRidingCurrentTrip(s.id))
  const totalRidingCount = tripStudents.length
  
  const completedCount = tripStudents.filter(s => {
    const status = rideStatuses.find(r => r.student_id === s.id && r.date === selectedDate && (r.trip_name === selectedTrip || (!r.trip_name && selectedTrip === '登校便')))
    return status?.status === 'completed'
  }).length

  const absentCount = tripStudents.filter(s => {
    const status = rideStatuses.find(r => r.student_id === s.id && r.date === selectedDate && (r.trip_name === selectedTrip || (!r.trip_name && selectedTrip === '登校便')))
    return status?.status === 'absent'
  }).length

  const waitingCount = Math.max(0, totalRidingCount - completedCount - absentCount)
  const checkedCount = completedCount + absentCount
  const progressPercent = totalRidingCount > 0 ? Math.round((checkedCount / totalRidingCount) * 100) : 0

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col relative overflow-x-hidden font-sans">
      {/* トースト通知 */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-950/95 border border-emerald-500/50 rounded-2xl shadow-2xl backdrop-blur-md text-emerald-200 text-xs font-bold">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* ヘッダー (100%不透明なbg-slate-950でスクロール時の文字透けを完全防止) */}
      <header className="border-b border-slate-800 bg-slate-950 sticky top-0 z-40 shadow-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-2.5 flex flex-wrap items-center justify-between gap-3 bg-slate-950">
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-2 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-xl shadow-lg shadow-emerald-500/20">
              <Bus className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm sm:text-base tracking-tight text-white">
                  スクールバス運行管理
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                  乗務員
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {route?.route_name || '運行ルート'}担当
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* リアルタイム接続バッジ */}
            {isRealtimeConnected && (
              <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="hidden sm:inline">リアルタイム同期</span>
              </span>
            )}

            {/* 翌月ダイヤ確認クイックボタン */}
            <button
              onClick={() => setActiveTab(prev => prev === 'monthly' ? 'daily' : 'monthly')}
              className={`p-2 rounded-xl border transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold ${
                activeTab === 'monthly'
                  ? 'bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-600/30'
                  : 'bg-slate-900 hover:bg-slate-800 text-purple-300 hover:text-white border-purple-500/30 hover:border-purple-500/50'
              }`}
              title="翌月の運行ダイヤ・シフト調整カレンダーを表示"
            >
              <CalendarDays className="h-4 w-4 text-purple-400" />
              <span className="hidden sm:inline">翌月ダイヤ</span>
            </button>

            {/* 名簿印刷ボタン */}
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="p-2 bg-slate-900 hover:bg-slate-800 text-indigo-300 hover:text-white rounded-xl border border-indigo-500/30 hover:border-indigo-500/50 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold"
              title="本日の点呼名簿・日報をA4印刷"
            >
              <Printer className="h-4 w-4 text-indigo-400" />
              <span className="hidden sm:inline">名簿印刷</span>
            </button>

            {/* 再取得ボタン */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold"
              title="最新の保護者予約・点呼データを再取得"
            >
              <RefreshCw className={`h-4 w-4 text-emerald-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">更新</span>
            </button>

            <button
              onClick={signOut}
              className="p-2 bg-slate-900 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-800 hover:border-rose-500/20 transition-all active:scale-95 flex items-center gap-1 text-xs font-bold"
              title="ログアウト"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>
        </div>
      </header>

      {/* メイン */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-6 z-10">
        
        {/* オフライン未送信キュー通知バナー */}
        {offlineQueue.length > 0 && (
          <div className="bg-amber-500/15 border-2 border-amber-500/50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in shadow-xl">
            <div className="flex items-center gap-2.5">
              <WifiOff className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-xs sm:text-sm font-black text-amber-200">
                  【電波不安定/オフライン】未送信の点呼ログが {offlineQueue.length} 件あります
                </p>
                <p className="text-[11px] text-amber-400/80">
                  端末内に安全に一時退避されています。電波復帰時に自動送信されます。
                </p>
              </div>
            </div>

            <button
              onClick={syncOfflineQueue}
              disabled={isSyncingQueue}
              className="min-h-[44px] px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncingQueue ? 'animate-spin' : ''}`} />
              <span>{isSyncingQueue ? 'サーバーへ同期中...' : '今すぐ手動同期'}</span>
            </button>
          </div>
        )}

        {/* メインタブ切り替え (本日の点呼・運行管理 / 翌月・月別運行ダイヤ確認) */}
        <div className="flex items-center gap-2 border-b border-slate-850 pb-2 print:hidden bg-slate-950">
          <button
            onClick={() => setActiveTab('daily')}
            className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'daily'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Bus className="h-4 w-4" />
            本日の点呼・運行管理
          </button>

          <button
            onClick={() => setActiveTab('monthly')}
            className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'monthly'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            翌月ダイヤ確認（シフト調整用）
          </button>
        </div>

        {/* タブコンテンツ */}
        {activeTab === 'monthly' ? (
          <NextMonthScheduleView />
        ) : (
          <>
            {/* 0. 運行ステータス・遅延リアルタイム操作パネル */}
            <DriverStatusControl
              selectedDate={selectedDate}
              selectedTrip={selectedTrip}
              routeId={routeId}
            />

            {/* 1. 日付ナビゲーション ＆ 特別ダイヤ情報バナー */}
            <section className="bg-gradient-to-r from-slate-900/90 to-indigo-950/40 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* 日付操作ボタン */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handlePrevDay}
                    className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 transition-all flex items-center gap-1 text-xs font-bold active:scale-95"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">前日</span>
                  </button>

              <button
                onClick={handleSetToday}
                disabled={isToday}
                className={`px-3 py-2 rounded-xl text-xs font-black border transition-all ${
                  isToday
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/30'
                    : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                }`}
              >
                今日
              </button>

              <button
                onClick={handleNextDay}
                className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 transition-all flex items-center gap-1 text-xs font-bold active:scale-95"
              >
                <span className="hidden sm:inline">翌日</span>
                <ChevronRight className="h-4 w-4" />
              </button>

              {/* 日付直接ピッカー */}
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* 日付＆特別ダイヤバッジ */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm sm:text-base font-black text-white">
                {selectedDateObj.getFullYear()}年 {selectedDateObj.getMonth() + 1}月{selectedDateObj.getDate()}日({weekdayJa})
              </span>

              {scheduleStatus.type === 'special' ? (
                <span className="text-xs px-2.5 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold rounded-xl flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  特別ダイヤ: {scheduleStatus.label}
                </span>
              ) : scheduleStatus.isSuspended ? (
                <span className="text-xs px-2.5 py-1 bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold rounded-xl flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  運休: {scheduleStatus.label}
                </span>
              ) : scheduleStatus.type === 'shortened' ? (
                <span className="text-xs px-2.5 py-1 bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold rounded-xl">
                  水曜短縮日課
                </span>
              ) : (
                <span className="text-xs px-2.5 py-1 bg-slate-950 border border-slate-800 text-slate-400 font-bold rounded-xl">
                  通常ダイヤ運行
                </span>
              )}
            </div>
          </div>

          {scheduleStatus.note && (
            <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
              📢 運行連絡：{scheduleStatus.note}
            </p>
          )}
        </section>

        {/* 2. 運行便フィルターセレクター */}
        <section className="bg-slate-900/60 border border-slate-850 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-800">
            <div>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                運行便の選択
              </span>
              <h2 className="text-base font-bold text-white mt-0.5">
                点呼・確認する運行便を選択してください
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-slate-400 font-mono">
                {route?.route_name || '全線'}
              </span>
            </div>
          </div>

          {/* 便の切り替えタブ */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {BUS_TRIPS.map(trip => {
              const isSelected = selectedTrip === trip.id
              const tripOp = busOperations.find(
                op => op.bus_route_id === routeId && (op.trip_name === trip.id || (!op.trip_name && trip.id === '登校便'))
              )
              const isRunning = tripOp?.status === 'running'
              const isFinished = tripOp?.status === 'finished'
              const isOperating = isTripOperating(trip.id, selectedDate)

              return (
                <button
                  key={trip.id}
                  disabled={!isOperating}
                  onClick={() => setSelectedTrip(trip.id)}
                  className={`flex flex-col items-center justify-center min-h-[60px] p-3 rounded-2xl border transition-all text-center relative active:scale-95 ${
                    isSelected
                      ? 'bg-gradient-to-b from-emerald-500/30 to-teal-500/30 border-emerald-400 text-white shadow-xl shadow-emerald-500/20 ring-2 ring-emerald-500 font-black'
                      : !isOperating
                        ? 'bg-slate-950/40 border-slate-900 text-slate-600 opacity-40 cursor-not-allowed'
                        : 'bg-slate-950/80 border-slate-800 hover:bg-slate-900 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  {/* 運行中ステータスバッジ */}
                  {isRunning && (
                    <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                  )}
                  {isFinished && (
                    <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-blue-500"></span>
                  )}

                  <span className={`text-sm sm:text-base font-black ${isSelected ? 'text-emerald-300' : isOperating ? 'text-slate-100' : 'text-slate-500'}`}>
                    {trip.name}
                  </span>
                  <span className={`text-[11px] font-mono mt-0.5 ${isOperating ? 'text-slate-400 font-bold' : 'text-rose-500 font-bold'}`}>
                    {isOperating ? `${getTripTime(trip.id, selectedDate)}${trip.id === '登校便' ? '着' : '発'}` : '運休'}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* 3. 運行状況サマリーカード（リアルタイム集計 4指標） */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* 乗車予定人数 */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-lg">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
              <span>乗車予定人数</span>
              <Users className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-white font-mono">{totalRidingCount}</span>
              <span className="text-xs text-slate-400">名</span>
            </div>
            <p className="text-[10px] text-slate-500">{selectedTrip} の予約総数</p>
          </div>

          {/* 乗車完了人数 */}
          <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-2xl p-4 space-y-1 shadow-lg">
            <div className="flex items-center justify-between text-xs text-emerald-300 font-bold">
              <span>乗車完了</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">{completedCount}</span>
              <span className="text-xs text-emerald-300">名</span>
            </div>
            <p className="text-[10px] text-emerald-400/80">点呼チェック済</p>
          </div>

          {/* 未乗車（待ち）人数 */}
          <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-4 space-y-1 shadow-lg">
            <div className="flex items-center justify-between text-xs text-amber-300 font-bold">
              <span>未乗車 (待ち)</span>
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-amber-300 font-mono">{waitingCount}</span>
              <span className="text-xs text-amber-300">名</span>
            </div>
            <p className="text-[10px] text-amber-400/80">乗車確認待ち</p>
          </div>

          {/* 欠席人数 */}
          <div className="bg-rose-950/30 border border-rose-500/40 rounded-2xl p-4 space-y-1 shadow-lg">
            <div className="flex items-center justify-between text-xs text-rose-300 font-bold">
              <span>欠席連絡・確認</span>
              <AlertCircle className="h-4 w-4 text-rose-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-rose-400 font-mono">{absentCount}</span>
              <span className="text-xs text-rose-300">名</span>
            </div>
            <p className="text-[10px] text-rose-400/80">欠席確認済</p>
          </div>
        </section>

        {/* 進捗プログレスバー */}
        <section className="bg-slate-900/40 border border-slate-850 rounded-2xl p-4 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-300">
              点呼進捗率: <strong className="text-emerald-400 font-mono">{progressPercent}%</strong>
            </span>
            <span className="text-slate-400 font-mono">
              ({checkedCount}/{totalRidingCount} 名確認済)
            </span>
          </div>
          <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden flex border border-slate-800">
            <div 
              className="bg-emerald-500 transition-all duration-500 ease-out"
              style={{ width: totalRidingCount > 0 ? `${(completedCount / totalRidingCount) * 100}%` : '0%' }}
              title={`乗車完了: ${completedCount}名`}
            />
            <div 
              className="bg-rose-500 transition-all duration-500 ease-out"
              style={{ width: totalRidingCount > 0 ? `${(absentCount / totalRidingCount) * 100}%` : '0%' }}
              title={`欠席: ${absentCount}名`}
            />
          </div>
        </section>

        {/* 4. 運行スイッチ ＆ 遅延報告パネル */}
        <section className="bg-slate-900/60 border border-slate-850 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-xl">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {route?.route_name || 'スクールバス運行ルート'}
              </span>
              <span className="text-xs px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold rounded-md">
                {selectedTrip} ({weekdayJa}曜日)
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1.5">
              {selectedTrip} の運行管理
            </h1>
            <div className="flex items-center gap-2.5 mt-2">
              <span className={`h-3 w-3 rounded-full ${
                operation?.status === 'running' 
                  ? 'bg-emerald-500 animate-pulse' 
                  : operation?.status === 'finished' 
                    ? 'bg-blue-500' 
                    : 'bg-slate-700'
              }`}></span>
              <span className="text-xs font-semibold text-slate-400">
                運行状態：
                <strong className={`ml-1 text-sm font-bold ${
                  operation?.status === 'running' ? 'text-emerald-400 font-black' : operation?.status === 'finished' ? 'text-blue-400 font-black' : 'text-slate-300'
                }`}>
                  {operation?.status === 'running' ? '運行中' : operation?.status === 'finished' ? '到着済み（運行終了）' : '運行前'}
                </strong>
              </span>

              {operation?.status === 'running' && operation.delay_minutes > 0 && (
                <span className="text-xs px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black rounded-md flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {operation.delay_minutes}分遅れ配信中
                </span>
              )}
            </div>
          </div>

          {/* 運行スイッチ群 */}
          <div className="flex flex-wrap gap-3">
            {(!operation || operation.status === 'not_started') && (
              <button
                onClick={handleStartRoute}
                className="w-full sm:w-auto min-h-[50px] flex items-center justify-center gap-2 py-3 px-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm rounded-2xl shadow-lg shadow-emerald-500/25 transition-all active:scale-95"
              >
                <Play className="h-4 w-4 fill-slate-950" />
                {selectedTrip} の運行を開始
              </button>
            )}

            {operation?.status === 'running' && (
              <button
                onClick={handleFinishRoute}
                className="w-full sm:w-auto min-h-[50px] flex items-center justify-center gap-2 py-3 px-6 bg-blue-500 hover:bg-blue-400 text-white font-black text-sm rounded-2xl shadow-lg shadow-blue-500/25 transition-all active:scale-95"
              >
                <Square className="h-4 w-4 fill-white" />
                {selectedTrip} の運行を終了
              </button>
            )}

            {operation?.status === 'finished' && (
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={handleStartRoute}
                  className="flex-1 min-h-[46px] flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition-all active:scale-95 text-xs"
                >
                  <Play className="h-3.5 w-3.5 fill-white" />
                  再開
                </button>
                <button
                  onClick={handleResetRoute}
                  className="flex-1 min-h-[46px] flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl transition-all border border-slate-700 active:scale-95 text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  運行前へリセット
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ワンタップ遅延報告 */}
        {operation?.status === 'running' && (
          <section className="bg-gradient-to-r from-slate-900/90 to-amber-950/30 border border-amber-500/40 rounded-3xl p-4 sm:p-5 space-y-3 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-amber-300 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  遅延報告（ワンタップで保護者画面へ即時反映）
                </h3>
              </div>
              <div className="flex items-center gap-2 bg-slate-950/90 px-3 py-1 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400">現在:</span>
                <strong className={`font-black ${operation.delay_minutes > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {operation.delay_minutes === 0 ? '定刻運行中' : `+${operation.delay_minutes}分 遅延配信中`}
                </strong>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
              {[
                { label: '定時 (定刻)', minutes: 0 },
                { label: '+5分', minutes: 5 },
                { label: '+10分', minutes: 10 },
                { label: '+15分', minutes: 15 },
                { label: '+20分', minutes: 20 },
                { label: '+30分', minutes: 30 }
              ].map(item => {
                const isActive = operation.delay_minutes === item.minutes
                return (
                  <button
                    key={item.minutes}
                    onClick={() => handleSetDelay(item.minutes)}
                    className={`min-h-[44px] py-2 px-2 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1 active:scale-95 ${
                      isActive 
                        ? 'bg-amber-500/30 border-amber-400 text-amber-300 ring-2 ring-amber-500 shadow-md shadow-amber-500/20' 
                        : 'bg-slate-950/80 border-slate-800 hover:bg-slate-850 text-slate-300'
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* 5. 停車順 乗車・降車点呼名簿 */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <MapPin className="h-5 w-5 text-emerald-400" />
                停車順 乗車・降車点呼名簿
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                バス停ごとに生徒の乗車・欠席チェックおよび保護者連絡メモを確認できます。
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNonRiders(!showNonRiders)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                  showNonRiders 
                    ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200' 
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Filter className="h-3.5 w-3.5" />
                {showNonRiders ? '不乗車生徒を表示中' : '不乗車生徒を非表示'}
              </button>
            </div>
          </div>

          <div className="space-y-5 relative before:absolute before:inset-y-0 before:left-6.5 before:w-[2px] before:bg-slate-900">
            {busStops.map((stop, index) => {
              const stopStudents = students.filter(s => s.default_bus_stop_id === stop.id)
              
              // 選択中の運行便に乗車予定の生徒
              const activeStudents = stopStudents.filter(student => isStudentRidingCurrentTrip(student.id))
              // 不乗車（この便に乗らない）生徒
              const nonRiderStudents = stopStudents.filter(student => !isStudentRidingCurrentTrip(student.id))

              // このバス停の完了状況
              const stopCompletedStudents = activeStudents.filter(s => {
                const status = rideStatuses.find(r => r.student_id === s.id && r.date === selectedDate && (r.trip_name === selectedTrip || (!r.trip_name && selectedTrip === '登校便')))
                return status?.status === 'completed' || status?.status === 'absent'
              })
              const stopCompletedCount = stopCompletedStudents.length
              const isAllChecked = activeStudents.length > 0 && stopCompletedCount === activeStudents.length
              const hasUncheckedStudents = activeStudents.length > 0 && stopCompletedCount < activeStudents.length

              // バス停内の兄弟（同一世帯）の検出とグルーピング
              const householdGroups = new Map<string, typeof activeStudents>()
              activeStudents.forEach(st => {
                const key = st.household_id || st.parent_id || getSurname(st.name)
                const list = householdGroups.get(key) || []
                list.push(st)
                householdGroups.set(key, list)
              })

              return (
                <div key={stop.id} className="relative pl-12 sm:pl-14 group">
                  {/* タイムライン用インジケーター */}
                  <div className="absolute left-3.5 -translate-x-1/2 top-2 flex items-center justify-center">
                    <span className={`h-7 w-7 rounded-full border flex items-center justify-center text-xs font-mono font-black ring-4 ring-slate-950 transition-all ${
                      isAllChecked 
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400 ring-emerald-500/20' 
                        : 'border-slate-800 bg-slate-950 text-slate-400 group-hover:border-slate-700'
                    }`}>
                      {index + 1}
                    </span>
                  </div>

                  {/* バス停カード */}
                  <div className={`border rounded-3xl p-4 sm:p-5 transition-all duration-300 ${
                    isAllChecked 
                      ? 'bg-slate-900/40 border-emerald-500/30 shadow-lg shadow-emerald-500/5' 
                      : 'bg-white/5 border-white/5 hover:border-slate-850'
                  }`}>
                    <div className="flex flex-wrap justify-between items-start gap-3 pb-3 border-b border-slate-900/60">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-white">{stop.stop_name}</h3>
                          {isAllChecked && (
                            <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              確認完了
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1 font-mono">
                          <Clock className="h-3.5 w-3.5 text-indigo-400" />
                          定刻到着：{getAdjustedStopArrivalTime(stop, selectedDate)}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* このバス停の全員を一括乗車完了ボタン */}
                        {hasUncheckedStudents && (
                          <button
                            onClick={() => handleBulkCheckStop(activeStudents.map(s => s.id))}
                            className="min-h-[48px] text-xs sm:text-sm bg-emerald-600/30 hover:bg-emerald-600 border border-emerald-500/50 text-emerald-300 hover:text-white px-4 py-2 rounded-xl font-black transition-all flex items-center gap-1.5 active:scale-95 shadow-md shadow-emerald-500/10"
                          >
                            <UserCheck className="h-4 w-4 shrink-0" />
                            バス停全員を一括乗車
                          </button>
                        )}

                        <span className={`text-xs px-3 py-2 rounded-xl font-bold uppercase tracking-wider ${
                          activeStudents.length > 0
                            ? 'bg-slate-900 border border-slate-800 text-indigo-300'
                            : 'bg-slate-950 border border-slate-900 text-slate-600'
                        }`}>
                          乗車予定: {activeStudents.length}名
                        </span>
                      </div>
                    </div>

                    {/* そのバス停の乗車予定生徒名簿 */}
                    <div className="mt-4 space-y-3">
                      {activeStudents.length > 0 ? (
                        activeStudents.map(student => {
                          const res = reservations.find(r => r.student_id === student.id && r.date === selectedDate)
                          const rideStatus = rideStatuses.find(
                            r => r.student_id === student.id && r.date === selectedDate && (r.trip_name === selectedTrip || (!r.trip_name && selectedTrip === '登校便'))
                          )
                          
                          const isCompleted = rideStatus?.status === 'completed'
                          const isAbsent = rideStatus?.status === 'absent'

                          // 同一世帯（兄弟）かどうかの判定
                          const hKey = student.household_id || student.parent_id || getSurname(student.name)
                          const siblingsAtStop = householdGroups.get(hKey) || []
                          const hasSiblingsAtStop = siblingsAtStop.length > 1
                          const uncheckedSiblings = siblingsAtStop.filter(sib => {
                            const sibStatus = rideStatuses.find(r => r.student_id === sib.id && r.date === selectedDate && (r.trip_name === selectedTrip || (!r.trip_name && selectedTrip === '登校便')))
                            return sibStatus?.status !== 'completed' && sibStatus?.status !== 'absent'
                          })

                          return (
                            <div 
                              key={student.id} 
                              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 rounded-2xl border transition-all duration-200 ${
                                isCompleted
                                  ? 'bg-emerald-950/40 border-emerald-500/70 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/10'
                                  : isAbsent
                                    ? 'bg-rose-950/40 border-rose-500/70 ring-2 ring-rose-500/40 shadow-lg shadow-rose-500/10'
                                    : 'bg-slate-950/80 border-slate-850 hover:border-slate-750'
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* 学年バッジ */}
                                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                                    {student.grade || '生徒'}
                                    {student.class_name ? ` ${student.class_name}` : ''}
                                  </span>

                                  {/* 生徒氏名 */}
                                  <h4 className={`font-black text-base ${
                                    isCompleted ? 'text-emerald-300' : isAbsent ? 'text-rose-300' : 'text-slate-100'
                                  }`}>
                                    {student.name}
                                  </h4>

                                  {/* 同一世帯・兄弟バッジ */}
                                  {hasSiblingsAtStop && (
                                    <span className="text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                      👨‍👩‍👧‍👦 兄弟同乗 ({getSurname(student.name)}家 {siblingsAtStop.length}名)
                                    </span>
                                  )}

                                  {/* チェック状態のバッジ */}
                                  {isCompleted && (
                                    <span className="text-[10px] bg-emerald-400 text-slate-950 font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                      <CheckCircle2 className="h-3 w-3" />
                                      乗車完了
                                    </span>
                                  )}
                                  {isAbsent && (
                                    <span className="text-[10px] bg-rose-500 text-white font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                      <AlertCircle className="h-3 w-3" />
                                      欠席
                                    </span>
                                  )}
                                  {!isCompleted && !isAbsent && (
                                    <span className="text-[10px] bg-slate-900 text-slate-400 border border-slate-800 font-bold px-2 py-0.5 rounded-full">
                                      未確認
                                    </span>
                                  )}
                                </div>

                                <div className="mt-2 flex flex-wrap gap-2">
                                  <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded font-semibold">
                                    対象便: {selectedTrip}
                                  </span>

                                  {selectedTrip === '登校便' && res?.afternoon_schedule && (
                                    <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded font-semibold">
                                      下校予定: {res.afternoon_schedule}
                                    </span>
                                  )}
                                </div>

                                {/* 保護者連絡メモの表示 */}
                                {res?.note && res.note !== '基本パターン' && res.note !== '基本一括自動予約' && res.note !== '基本パターン適用' && (
                                  <p className="text-xs text-amber-300 font-medium mt-2 flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-xl">
                                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                                    <span>保護者メモ: <strong>{res.note}</strong></span>
                                  </p>
                                )}
                              </div>

                              {/* 乗車チェックアクションボタン (最小タップ領域 48px × 48px 以上で片手親指操作に最適化) */}
                              <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                                {/* 兄弟一括乗車ボタン */}
                                {hasSiblingsAtStop && uncheckedSiblings.length > 0 && (
                                  <button
                                    onClick={() => handleBulkCheckSiblings(siblingsAtStop.map(s => s.id))}
                                    className="min-h-[50px] px-3.5 rounded-2xl text-xs font-black bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 transition-all active:scale-95 shadow-sm flex items-center justify-center gap-1"
                                    title="この兄弟をまとめて乗車完了にします"
                                  >
                                    兄弟一括
                                  </button>
                                )}

                                {/* 乗車完了ボタン */}
                                <button
                                  onClick={() => handleToggleRideStatus(student.id, rideStatus?.status, 'completed')}
                                  className={`flex-1 sm:flex-none min-h-[50px] min-w-[100px] flex items-center justify-center gap-2 px-5 rounded-2xl text-sm font-black border transition-all active:scale-95 shadow-md ${
                                    isCompleted
                                      ? 'bg-emerald-400 text-slate-950 border-emerald-300 ring-2 ring-emerald-400/80 shadow-emerald-500/30'
                                      : 'bg-slate-900 border-slate-700 text-slate-100 hover:bg-slate-800 hover:border-slate-600'
                                  }`}
                                >
                                  <UserCheck className="h-4 w-4 shrink-0" />
                                  <span>{isCompleted ? '乗車済' : '乗車完了'}</span>
                                </button>

                                {/* 欠席ボタン */}
                                <button
                                  onClick={() => handleToggleRideStatus(student.id, rideStatus?.status, 'absent')}
                                  className={`flex-1 sm:flex-none min-h-[50px] min-w-[80px] flex items-center justify-center gap-1.5 px-4 rounded-2xl text-sm font-black border transition-all active:scale-95 shadow-md ${
                                    isAbsent
                                      ? 'bg-rose-500 text-white border-rose-300 ring-2 ring-rose-400/80 shadow-rose-500/30'
                                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white'
                                  }`}
                                >
                                  <AlertCircle className="h-4 w-4 shrink-0" />
                                  <span>{isAbsent ? '欠席中' : '欠席'}</span>
                                </button>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <p className="text-xs text-slate-600 italic py-2 text-center bg-slate-950/20 rounded-xl">
                          このバス停で「{selectedTrip}」の乗車予約はありません。
                        </p>
                      )}

                      {/* 不乗車生徒の展開表示（任意） */}
                      {showNonRiders && nonRiderStudents.length > 0 && (
                        <div className="pt-2 border-t border-slate-900 space-y-2">
                          <span className="text-[11px] text-slate-500 font-bold block">
                            ※ このバス停の不乗車・別便利用生徒 ({nonRiderStudents.length}名):
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {nonRiderStudents.map(student => {
                              const res = reservations.find(r => r.student_id === student.id && r.date === selectedDate)
                              return (
                                <div key={student.id} className="p-2 bg-slate-950/40 rounded-xl border border-slate-900 text-xs text-slate-500 flex justify-between items-center">
                                  <span>{student.name} ({student.grade})</span>
                                  <span className="text-[10px]">
                                    {selectedTrip === '登校便' 
                                      ? (res?.morning_status === false ? '不乗車' : '予約なし')
                                      : (res?.afternoon_schedule ? `${res.afternoon_schedule}利用` : '不乗車')}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
        </>
        )}
      </main>

      {/* 名簿印刷＆CSVモーダル */}
      <ExportAndPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        initialDate={selectedDate}
        initialTrip={selectedTrip}
      />
    </div>
  )
}
