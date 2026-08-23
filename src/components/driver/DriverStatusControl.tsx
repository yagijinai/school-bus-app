import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Clock, AlertTriangle, CheckCircle2, Send, Bus, MessageSquare, Sparkles, Check } from 'lucide-react'
import { triggerHaptic } from '../../lib/offlineQueue'

interface DriverStatusControlProps {
  selectedDate: string
  selectedTrip: string
  routeId?: string
}

export const DriverStatusControl: React.FC<DriverStatusControlProps> = ({
  selectedDate,
  selectedTrip,
  routeId
}) => {
  const { busOperations, updateBusOperationStatus } = useAuth()

  // 現在の運行ステータスを取得
  const currentOp = busOperations.find(
    op => op.date === selectedDate && (op.trip_name === selectedTrip || (!op.trip_name && selectedTrip === '登校便'))
  )

  const [statusType, setStatusType] = useState<'on_time' | 'delayed' | 'arrived' | 'running' | 'finished'>('on_time')
  const [delayMinutes, setDelayMinutes] = useState<number>(0)
  const [message, setMessage] = useState<string>('')
  const [isUpdating, setIsUpdating] = useState<boolean>(false)
  const [updateSuccess, setUpdateSuccess] = useState<boolean>(false)

  // 選択日や便、既存ステータスが切り替わったら初期化
  useEffect(() => {
    if (currentOp) {
      const opStatus = currentOp.status
      if (opStatus === 'arrived' || opStatus === 'finished') {
        setStatusType('arrived')
        setDelayMinutes(0)
      } else if (currentOp.delay_minutes > 0) {
        setStatusType('delayed')
        setDelayMinutes(currentOp.delay_minutes)
      } else {
        setStatusType('on_time')
        setDelayMinutes(0)
      }
      setMessage(currentOp.message || currentOp.note || '')
    } else {
      setStatusType('on_time')
      setDelayMinutes(0)
      setMessage('')
    }
  }, [currentOp, selectedDate, selectedTrip])

  // クイックボタン押下
  const handleQuickStatus = async (
    type: 'on_time' | 'delayed' | 'arrived',
    minutes: number,
    presetMessage?: string
  ) => {
    triggerHaptic(60)
    setStatusType(type)
    setDelayMinutes(minutes)
    if (presetMessage !== undefined) {
      setMessage(presetMessage)
    }

    setIsUpdating(true)
    try {
      await updateBusOperationStatus(
        selectedDate,
        selectedTrip,
        type,
        minutes,
        presetMessage !== undefined ? presetMessage : message,
        routeId
      )
      setUpdateSuccess(true)
      setTimeout(() => setUpdateSuccess(false), 2500)
    } catch (err) {
      console.error('Failed to update status:', err)
    } finally {
      setIsUpdating(false)
    }
  }

  // 手動送信（メッセージ付き）
  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdating(true)
    try {
      await updateBusOperationStatus(
        selectedDate,
        selectedTrip,
        statusType,
        delayMinutes,
        message.trim() || null,
        routeId
      )
      setUpdateSuccess(true)
      setTimeout(() => setUpdateSuccess(false), 2500)
    } catch (err) {
      console.error('Failed to update status:', err)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <section className="bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-slate-950/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0 mt-0.5 sm:mt-0">
            <Bus className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-black text-white">
                【{selectedTrip}】運行ステータス・遅延送信
              </h2>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                保護者へ即時通知
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              運行日: <strong className="text-white font-mono">{selectedDate}</strong>
            </p>
          </div>
        </div>

        {updateSuccess && (
          <span className="self-start sm:self-auto flex items-center gap-1.5 text-xs font-black text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-3 py-1.5 rounded-xl animate-in fade-in">
            <Check className="h-4 w-4" />
            送信完了
          </span>
        )}
      </div>

      {/* クイックステータスボタン群 */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold text-slate-400 block">
          ワンタップ送信（即座に保護者アプリへ配信されます）:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {/* 定刻 */}
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => handleQuickStatus('on_time', 0, '')}
            className={`py-3 px-2 rounded-2xl border text-xs font-black transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-md ${
              statusType === 'on_time' && delayMinutes === 0
                ? 'bg-emerald-600 text-white border-emerald-400 ring-2 ring-emerald-500/40 shadow-emerald-600/30'
                : 'bg-slate-950/80 hover:bg-slate-850 border-slate-800 text-slate-300'
            }`}
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>定刻運行</span>
            <span className="text-[10px] opacity-75 font-normal">遅延なし</span>
          </button>

          {/* 5分遅延 */}
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => handleQuickStatus('delayed', 5)}
            className={`py-3 px-2 rounded-2xl border text-xs font-black transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-md ${
              statusType === 'delayed' && delayMinutes === 5
                ? 'bg-amber-500 text-slate-950 border-amber-300 ring-2 ring-amber-500/40 shadow-amber-500/30'
                : 'bg-slate-950/80 hover:bg-slate-850 border-slate-800 text-amber-300'
            }`}
          >
            <Clock className="h-4 w-4 text-amber-400" />
            <span>5分遅延</span>
            <span className="text-[10px] opacity-75 font-normal">+5分目安</span>
          </button>

          {/* 10分遅延 */}
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => handleQuickStatus('delayed', 10)}
            className={`py-3 px-2 rounded-2xl border text-xs font-black transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-md ${
              statusType === 'delayed' && delayMinutes === 10
                ? 'bg-orange-500 text-white border-orange-300 ring-2 ring-orange-500/40 shadow-orange-500/30'
                : 'bg-slate-950/80 hover:bg-slate-850 border-slate-800 text-orange-300'
            }`}
          >
            <AlertTriangle className="h-4 w-4 text-orange-400" />
            <span>10分遅延</span>
            <span className="text-[10px] opacity-75 font-normal">+10分目安</span>
          </button>

          {/* 15分遅延 */}
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => handleQuickStatus('delayed', 15)}
            className={`py-3 px-2 rounded-2xl border text-xs font-black transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-md ${
              statusType === 'delayed' && delayMinutes === 15
                ? 'bg-rose-600 text-white border-rose-400 ring-2 ring-rose-600/40 shadow-rose-600/30'
                : 'bg-slate-950/80 hover:bg-slate-850 border-slate-800 text-rose-300'
            }`}
          >
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            <span>15分遅延</span>
            <span className="text-[10px] opacity-75 font-normal">+15分以上</span>
          </button>

          {/* 到着完了 */}
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => handleQuickStatus('arrived', 0, '学校に到着完了しました')}
            className={`py-3 px-2 rounded-2xl border text-xs font-black transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-md col-span-2 sm:col-span-1 ${
              statusType === 'arrived'
                ? 'bg-blue-600 text-white border-blue-300 ring-2 ring-blue-500/40 shadow-blue-600/30'
                : 'bg-slate-950/80 hover:bg-slate-850 border-slate-800 text-blue-300'
            }`}
          >
            <Sparkles className="h-4 w-4 text-blue-400" />
            <span>到着完了</span>
            <span className="text-[10px] opacity-75 font-normal">運行終了</span>
          </button>
        </div>
      </div>

      {/* 理由・メッセージ入力欄 */}
      <form onSubmit={handleCustomSubmit} className="space-y-2 pt-2 border-t border-slate-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-amber-400" />
            遅延理由・保護者への連絡メモ（任意）:
          </label>

          {/* クイック理由チップス */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {['道路混雑のため', '踏切点検のため', '悪天候のため徐行中'].map((txt) => (
              <button
                key={txt}
                type="button"
                onClick={() => setMessage(txt)}
                className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-amber-300 transition-colors"
              >
                + {txt}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="例：踏切点検のため5分ほど遅れが生じています。安全運転で向かっています。"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
          />

          <button
            type="submit"
            disabled={isUpdating}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-2xl text-xs transition-all active:scale-95 flex items-center gap-1.5 shadow-lg shadow-amber-500/20 disabled:opacity-50 shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
            <span>メッセージ送信</span>
          </button>
        </div>
      </form>
    </section>
  )
}
