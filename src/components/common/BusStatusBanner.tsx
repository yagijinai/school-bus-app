import React from 'react'
import { useAuth } from '../../context/AuthContext'
import { Bus, Clock, AlertTriangle, Sparkles, Ban, Info } from 'lucide-react'

interface BusStatusBannerProps {
  targetDate?: string
  targetTrip?: string
}

export const BusStatusBanner: React.FC<BusStatusBannerProps> = ({
  targetDate,
  targetTrip
}) => {
  const { busOperations, getDateScheduleStatus, getTripTime, isTripOperating } = useAuth()

  const todayStr = new Date().toISOString().split('T')[0]
  const date = targetDate || todayStr
  const trip = targetTrip || '登校便'

  // 1. スケジュール判定（運休・特別ダイヤ等）
  const scheduleStatus = getDateScheduleStatus(date)
  const isOperating = isTripOperating(trip, date)

  // 2. 該当便の運行ステータスを取得
  const operation = busOperations.find(
    op => op.date === date && (op.trip_name === trip || (!op.trip_name && trip === '登校便'))
  )

  const delayMinutes = operation?.delay_minutes || 0
  const opStatus = operation?.status || 'not_started'
  const message = operation?.message || operation?.note || null
  const tripTime = getTripTime(trip, date)

  // 運休の場合
  if (!isOperating || scheduleStatus.isSuspended || opStatus === 'suspended') {
    return (
      <div className="bg-gradient-to-r from-rose-950/80 via-rose-900/60 to-slate-900/90 border border-rose-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl animate-in fade-in flex items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 shrink-0">
            <Ban className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-rose-500 text-slate-950">
                本日の{trip}：運休
              </span>
              <span className="text-xs text-rose-300 font-bold font-mono">
                {date}
              </span>
            </div>
            <p className="text-sm font-bold text-white mt-1">
              {scheduleStatus.note || scheduleStatus.label || '本日の便は運休となっております。'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 到着完了の場合
  if (opStatus === 'arrived' || opStatus === 'finished') {
    return (
      <div className="bg-gradient-to-r from-blue-950/80 via-indigo-950/60 to-slate-900/90 border border-blue-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl animate-in fade-in flex items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-blue-500/20 border border-blue-500/40 text-blue-400 shrink-0">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-blue-500 text-white">
                {trip}：学校に到着完了
              </span>
              <span className="text-xs text-blue-300 font-bold font-mono">
                {date}
              </span>
            </div>
            <p className="text-sm font-bold text-white mt-1">
              本便のバスは予定ルートを運行し、目的地に到着完了いたしました。
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 遅延発生中の場合
  if (delayMinutes > 0 || opStatus === 'delayed') {
    return (
      <div className="bg-gradient-to-r from-amber-950/90 via-orange-950/70 to-slate-900/90 border border-amber-500/50 rounded-3xl p-4 sm:p-5 shadow-2xl shadow-amber-950/30 animate-in fade-in ring-1 ring-amber-500/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 shrink-0 relative">
              <span className="animate-ping absolute top-1 right-1 h-3 w-3 rounded-full bg-amber-400 opacity-75"></span>
              <AlertTriangle className="h-6 w-6 relative" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 flex items-center gap-1 shadow-md shadow-amber-500/20">
                  <Clock className="h-3.5 w-3.5" />
                  ⚠️ 約 {delayMinutes} 分遅延中
                </span>
                <span className="text-xs font-bold text-amber-300">
                  【{trip}】
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {date}
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-black text-white mt-1 flex items-center gap-2">
                スクールバスに遅れが生じています
              </h3>

              {message ? (
                <div className="mt-1.5 p-2.5 rounded-xl bg-slate-950/80 border border-amber-500/30 text-amber-200 text-xs font-bold flex items-start gap-1.5">
                  <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>ドライバー連絡: <strong>{message}</strong></span>
                </div>
              ) : (
                <p className="text-xs text-amber-300/90 mt-1 font-medium">
                  道路状況等により約{delayMinutes}分遅れて運行しております。安全運転で向かっておりますのでご安心ください。
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 定刻運行中の場合
  if (opStatus === 'running' || opStatus === 'on_time') {
    return (
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900/90 to-slate-900/90 border border-emerald-500/30 rounded-3xl p-4 sm:p-5 shadow-xl animate-in fade-in flex items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shrink-0 relative">
            <span className="animate-ping absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-75"></span>
            <Bus className="h-6 w-6 relative" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950">
                定刻通り運行中
              </span>
              <span className="text-xs font-bold text-slate-200">
                【{trip} ({tripTime}発)】
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 font-medium">
              現在、順調に定刻通り運行しております。
              {message && <strong className="text-emerald-300 ml-1">（連絡: {message}）</strong>}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 運行前（デフォルト）
  return (
    <div className="bg-slate-900/60 border border-slate-850 rounded-3xl p-4 sm:p-5 shadow-lg flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-400 shrink-0">
          <Bus className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-400">
              本日 {date} の運行予定:
            </span>
            <span className="text-xs font-black text-amber-400">
              {trip}（定刻: {tripTime !== '--:--' ? `${tripTime}発` : '運休'}）
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            運行が開始されると、遅延状況や到着ステータスがここにリアルタイム配信されます。
          </p>
        </div>
      </div>
    </div>
  )
}
