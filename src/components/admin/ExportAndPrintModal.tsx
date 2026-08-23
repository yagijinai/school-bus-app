import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { PrintableRoster } from './PrintableRoster'
import { PrintableDailyReport } from './PrintableDailyReport'
import { 
  FileSpreadsheet, Printer, X, Download, 
  Calendar, CheckCircle2, FileText, ClipboardList
} from 'lucide-react'

interface ExportAndPrintModalProps {
  isOpen: boolean
  onClose: () => void
  initialDate?: string
  initialTrip?: string
}

export const ExportAndPrintModal: React.FC<ExportAndPrintModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  initialTrip = '登校便'
}) => {
  const { 
    students, 
    busStops, 
    reservations, 
    rideStatuses, 
    busOperations,
    specialTripSchedules,
    schoolHolidays,
    getAdjustedStopArrivalTime,
    getTripTime,
    isTripOperating
  } = useAuth()

  const todayStr = new Date().toISOString().split('T')[0]
  const [activeSubTab, setActiveSubTab] = useState<'csv' | 'print'>('csv')

  // CSVエクスポート用状態
  const [csvPeriodType, setCsvPeriodType] = useState<'current_month' | 'prev_month' | 'custom'>('current_month')
  const [csvStartDate, setCsvStartDate] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [csvEndDate, setCsvEndDate] = useState<string>(todayStr)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null)

  // 印刷用状態
  const [printDocType, setPrintDocType] = useState<'roster' | 'daily_report'>('roster')
  const [printDate, setPrintDate] = useState<string>(initialDate || todayStr)
  const [printTrip, setPrintTrip] = useState<string>(initialTrip)

  if (!isOpen) return null

  // 期間切り替え
  const handlePeriodTypeChange = (type: 'current_month' | 'prev_month' | 'custom') => {
    setCsvPeriodType(type)
    const now = new Date()
    if (type === 'current_month') {
      const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      setCsvStartDate(start)
      setCsvEndDate(end)
    } else if (type === 'prev_month') {
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const start = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-01`
      const lastDay = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0).getDate()
      const end = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      setCsvStartDate(start)
      setCsvEndDate(end)
    }
  }

  // CSVダウンロード処理 (BOM付き UTF-8)
  const handleDownloadCsv = () => {
    setIsExporting(true)
    try {
      // 1. ヘッダー行
      const headers = [
        '運行日',
        '便種別',
        '学年',
        '組',
        '生徒ID',
        '氏名',
        '世帯ID',
        '利用バス停',
        '予約状況',
        '点呼乗車実績',
        '点呼記録日時',
        '保護者連絡メモ'
      ]

      const rows: string[][] = []

      // 該当期間内のすべての予約または生徒日毎データを集計
      const start = new Date(`${csvStartDate}T00:00:00`)
      const end = new Date(`${csvEndDate}T23:59:59`)

      const trips = ['登校便', '下校1便', '下校2便', '下校3便', '下校4便', '下校5便']

      // 日付ループ
      const cur = new Date(start)
      while (cur <= end) {
        const dateStr = cur.toISOString().split('T')[0]

        trips.forEach(trip => {
          students.forEach(student => {
            const stop = busStops.find(s => s.id === student.default_bus_stop_id)
            const res = reservations.find(r => r.student_id === student.id && r.date === dateStr)

            let isReserved = false
            if (res) {
              if (trip === '登校便' && res.morning_status) isReserved = true
              if (trip !== '登校便' && res.afternoon_schedule === trip) isReserved = true
            }

            // 点呼記録を取得
            const ride = rideStatuses.find(
              r => r.student_id === student.id && r.date === dateStr && (r.trip_name === trip || (!r.trip_name && trip === '登校便'))
            )

            // 予約または点呼記録がある場合に出力
            if (isReserved || ride) {
              const rideStatusLabel = ride?.status === 'completed'
                ? '乗車完了'
                : ride?.status === 'absent'
                  ? '欠席'
                  : isReserved
                    ? '未点呼'
                    : '予約外'

              const recordedAt = ride?.updated_at
                ? new Date(ride.updated_at).toLocaleString('ja-JP')
                : ''

              rows.push([
                dateStr,
                trip,
                student.grade || '',
                student.class_name || '',
                student.student_code || student.id,
                student.name,
                student.household_id || '',
                stop?.stop_name || '未設定',
                isReserved ? '乗車' : '不乗車',
                rideStatusLabel,
                recordedAt,
                res?.note || ''
              ])
            }
          })
        })

        cur.setDate(cur.getDate() + 1)
      }

      // CSV 文字列組み立て（カンマ・改行・ダブルクォートのエスケープ）
      const escapeCsvCell = (cell: string) => {
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`
        }
        return cell
      }

      const csvContent = [
        headers.map(escapeCsvCell).join(','),
        ...rows.map(row => row.map(escapeCsvCell).join(','))
      ].join('\r\n')

      // UTF-8 BOM を付与して Blob 作成
      const bom = new Uint8Array([0xEF, 0xBB, 0xBF])
      const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `スクールバス乗車実績_${csvStartDate}_${csvEndDate}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setExportSuccessMsg(`${rows.length}件の乗車データを正常にエクスポートしました。`)
      setTimeout(() => setExportSuccessMsg(null), 4000)
    } catch (err) {
      console.error('CSV Export Error:', err)
      alert('CSV出力中にエラーが発生しました。')
    } finally {
      setIsExporting(false)
    }
  }

  // 印刷実行
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white my-auto">
        
        {/* モーダルヘッダー（印刷時は非表示） */}
        <div className="no-print p-4 sm:p-5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              {activeSubTab === 'csv' ? <FileSpreadsheet className="h-5 w-5" /> : <Printer className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                乗車実績CSV出力 ＆ A4帳票印刷
              </h2>
              <p className="text-xs text-slate-400">
                乗車実績CSVの出力や、クリップボードに挟んで現場利用できるA4点呼名簿・運行日報を印刷できます。
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* タブ切り替えボタン（印刷時は非表示） */}
        <div className="no-print flex border-b border-slate-800 bg-slate-950/50 px-5 pt-3 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveSubTab('csv')}
            className={`pb-3 px-3 sm:px-4 text-xs font-black flex items-center gap-2 border-b-2 transition-all ${
              activeSubTab === 'csv'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>乗車実績CSVエクスポート</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('print')}
            className={`pb-3 px-3 sm:px-4 text-xs font-black flex items-center gap-2 border-b-2 transition-all ${
              activeSubTab === 'print'
                ? 'border-indigo-400 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Printer className="h-4 w-4" />
            <span>🖨️ A4帳票・日報の印刷プレビュー</span>
          </button>
        </div>

        {/* コンテンツエリア */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {activeSubTab === 'csv' ? (
            /* CSVエクスポート設定 */
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="bg-slate-950/70 border border-slate-850 rounded-2xl p-5 space-y-4">
                <label className="text-xs font-bold text-slate-300 block">
                  エクスポート対象期間を選択:
                </label>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handlePeriodTypeChange('current_month')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                      csvPeriodType === 'current_month'
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    今月（当月全日）
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePeriodTypeChange('prev_month')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                      csvPeriodType === 'prev_month'
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    先月（前月実績）
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePeriodTypeChange('custom')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                      csvPeriodType === 'custom'
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    期間を任意指定
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-[11px] text-slate-400 font-bold block mb-1">開始日:</label>
                    <input
                      type="date"
                      value={csvStartDate}
                      onChange={(e) => {
                        setCsvStartDate(e.target.value)
                        setCsvPeriodType('custom')
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-bold block mb-1">終了日:</label>
                    <input
                      type="date"
                      value={csvEndDate}
                      onChange={(e) => {
                        setCsvEndDate(e.target.value)
                        setCsvPeriodType('custom')
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 出力項目サマリー */}
              <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-4 text-xs text-slate-400 space-y-2">
                <span className="font-bold text-white block">📋 CSV出力に含まれる項目:</span>
                <p className="leading-relaxed text-[11px]">
                  運行日、便種別（登校便/下校1〜5便）、学年・組、生徒ID、氏名、世帯ID、利用バス停名、保護者予約区分（乗車/不乗車）、ドライバー点呼実績（乗車完了/欠席/未点呼）、点呼記録時刻、保護者連絡メモ
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold pt-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Microsoft Excel 対応（UTF-8 BOM付きで文字化けしません）</span>
                </div>
              </div>

              {exportSuccessMsg && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{exportSuccessMsg}</span>
                </div>
              )}

              <button
                type="button"
                disabled={isExporting}
                onClick={handleDownloadCsv}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-2xl text-xs transition-all active:scale-95 flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                <span>{isExporting ? 'CSV生成中...' : '乗車実績CSVファイルをダウンロード'}</span>
              </button>
            </div>
          ) : (
            /* 印刷プレビュー ＆ 印刷ボタン */
            <div className="space-y-4">
              
              {/* 印刷コントロールバー（印刷時は非表示） */}
              <div className="no-print bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* 帳票種別切り替え */}
                  <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setPrintDocType('roster')}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        printDocType === 'roster'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                      <span>乗車点呼名簿（便別）</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPrintDocType('daily_report')}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        printDocType === 'daily_report'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>運行日報（1日総括）</span>
                    </button>
                  </div>

                  {/* 運行日選択 */}
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 ml-1">
                    <Calendar className="h-4 w-4 text-indigo-400" />
                    <span>対象日:</span>
                  </div>
                  <input
                    type="date"
                    value={printDate}
                    onChange={(e) => setPrintDate(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                  />

                  {/* 便選択（点呼名簿時のみ表示） */}
                  {printDocType === 'roster' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-300 ml-1">便:</span>
                      <select
                        value={printTrip}
                        onChange={(e) => setPrintTrip(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold"
                      >
                        <option value="登校便">登校便</option>
                        <option value="下校1便">下校1便</option>
                        <option value="下校2便">下校2便</option>
                        <option value="下校3便">下校3便</option>
                        <option value="下校4便">下校4便</option>
                        <option value="下校5便">下校5便</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* 印刷実行ボタン */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 shrink-0"
                >
                  <Printer className="h-4 w-4" />
                  <span>🖨️ A4で印刷する (Ctrl + P)</span>
                </button>
              </div>

              {/* プレビュー表示エリア */}
              <div className="border border-slate-800 rounded-2xl p-4 bg-slate-950/60 overflow-x-auto print:border-none print:p-0 print:bg-white">
                <div className="min-w-[720px] max-w-[210mm] mx-auto shadow-2xl rounded-lg overflow-hidden print:shadow-none print:rounded-none">
                  {printDocType === 'roster' ? (
                    <PrintableRoster
                      date={printDate}
                      tripName={printTrip}
                      students={students}
                      busStops={busStops}
                      reservations={reservations}
                      rideStatuses={rideStatuses}
                      busOperations={busOperations}
                      getAdjustedStopArrivalTime={getAdjustedStopArrivalTime}
                      getTripTime={getTripTime}
                    />
                  ) : (
                    <PrintableDailyReport
                      date={printDate}
                      students={students}
                      busStops={busStops}
                      reservations={reservations}
                      rideStatuses={rideStatuses}
                      busOperations={busOperations}
                      specialTripSchedules={specialTripSchedules}
                      schoolHolidays={schoolHolidays}
                      getTripTime={getTripTime}
                      isTripOperating={isTripOperating}
                    />
                  )}
                </div>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  )
}
