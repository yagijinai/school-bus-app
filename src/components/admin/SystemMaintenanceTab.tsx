import React, { useState, useRef } from 'react'
import type { Student, BusRoute, BusStop } from '../../types/app'
import { 
  promoteAllStudents, 
  generateDummyTestData, 
  clearDummyTestData, 
  parseStudentCSV, 
  bulkImportStudents, 
  downloadStudentCSVTemplate,
  type CSVParseResult
} from '../../lib/api/maintenance'
import { 
  Settings2, GraduationCap, Database, FileSpreadsheet, 
  Upload, Download, AlertTriangle, CheckCircle2, Trash2, 
  RefreshCw, Sparkles, AlertCircle, X, Check
} from 'lucide-react'

interface SystemMaintenanceTabProps {
  students: Student[]
  busRoutes: BusRoute[]
  busStops: BusStop[]
  onDataRefresh: () => Promise<void>
}

export const SystemMaintenanceTab: React.FC<SystemMaintenanceTabProps> = ({
  students,
  busRoutes,
  busStops,
  onDataRefresh
}) => {
  // 処理中状態
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [processingMessage, setProcessingMessage] = useState<string>('')

  // メッセージトースト
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  // 1. 進級処理モーダル状態
  const [showPromoteModal, setShowPromoteModal] = useState<boolean>(false)

  // 2. テストデータクリア確認モーダル
  const [showClearTestModal, setShowClearTestModal] = useState<boolean>(false)

  // 3. CSV取り込みモーダル状態
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvParseResult, setCsvParseResult] = useState<CSVParseResult | null>(null)
  const [showCsvPreviewModal, setShowCsvPreviewModal] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ type, message })
    setTimeout(() => {
      setNotification(null)
    }, 4500)
  }

  // 学年別集計
  const gradeCounts = {
    first: students.filter(s => (s.grade || '').includes('1')).length,
    second: students.filter(s => (s.grade || '').includes('2')).length,
    third: students.filter(s => (s.grade || '').includes('3')).length,
    graduated: students.filter(s => (s.grade || '').includes('卒業')).length,
    other: students.filter(s => !s.grade || (!s.grade.includes('1') && !s.grade.includes('2') && !s.grade.includes('3') && !s.grade.includes('卒業'))).length
  }

  // テスト生徒数
  const testStudentCount = students.filter(s => (s.student_code || '').startsWith('TEST-')).length

  // 1. 一括進級処理の実行
  const handleExecutePromotion = async () => {
    setShowPromoteModal(false)
    setIsProcessing(true)
    setProcessingMessage('全校生徒の進級・卒業処理を実行中...')

    try {
      const res = await promoteAllStudents(students)
      await onDataRefresh()
      showToast(
        `一括進級が完了しました。（2年→3年: ${res.promotedTo3rdCount}名, 1年→2年: ${res.promotedTo2ndCount}名, 3年→卒業: ${res.graduatedCount}名）`,
        'success'
      )
    } catch (err: any) {
      console.error('Failed to promote students:', err)
      showToast(`進級処理中にエラーが発生しました: ${err.message || err}`, 'error')
    } finally {
      setIsProcessing(false)
      setProcessingMessage('')
    }
  }

  // 2. テストデータ生成の実行
  const handleGenerateTestData = async () => {
    setIsProcessing(true)
    setProcessingMessage('テスト用生徒（18名）と直近2週間の予約データを生成中...')

    try {
      const res = await generateDummyTestData(busRoutes, busStops)
      await onDataRefresh()
      showToast(
        `テストデータを投入しました。（生徒: ${res.studentsCount}名, 予約データ: ${res.reservationsCount}件）`,
        'success'
      )
    } catch (err: any) {
      console.error('Failed to generate test data:', err)
      showToast(`テストデータ生成中にエラーが発生しました: ${err.message || err}`, 'error')
    } finally {
      setIsProcessing(false)
      setProcessingMessage('')
    }
  }

  // 2-2. テストデータ一括クリアの実行
  const handleExecuteClearTestData = async () => {
    setShowClearTestModal(false)
    setIsProcessing(true)
    setProcessingMessage('テスト用生徒および関連予約データを一括削除中...')

    try {
      const res = await clearDummyTestData()
      await onDataRefresh()
      showToast(`テスト用生徒データ ${res.deletedStudentsCount}名 および関連予約を全削除しました。`, 'success')
    } catch (err: any) {
      console.error('Failed to clear test data:', err)
      showToast(`テストデータ削除中にエラーが発生しました: ${err.message || err}`, 'error')
    } finally {
      setIsProcessing(false)
      setProcessingMessage('')
    }
  }

  // 3. CSVファイル選択ハンドラ
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    setProcessingMessage('CSVファイルを解析中（文字コード自動判定）...')

    try {
      const parseResult = await parseStudentCSV(file)
      setCsvFile(file)
      setCsvParseResult(parseResult)
      setShowCsvPreviewModal(true)
    } catch (err: any) {
      console.error('CSV parse error:', err)
      showToast(`CSVの読み込みに失敗しました: ${err.message || err}`, 'error')
    } finally {
      setIsProcessing(false)
      setProcessingMessage('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // 3-2. CSV生徒データの一括インポート実行
  const handleExecuteCsvImport = async () => {
    if (!csvParseResult || csvParseResult.validRows.length === 0) return

    setShowCsvPreviewModal(false)
    setIsProcessing(true)
    setProcessingMessage(`${csvParseResult.validRows.length}名の生徒データを一括インポート中...`)

    try {
      const res = await bulkImportStudents(csvParseResult.validRows, busRoutes, busStops)
      await onDataRefresh()
      showToast(`${res.insertedCount}名の生徒データを一括登録/更新しました。`, 'success')
      setCsvFile(null)
      setCsvParseResult(null)
    } catch (err: any) {
      console.error('Failed to import CSV:', err)
      showToast(`CSVインポート中にエラーが発生しました: ${err.message || err}`, 'error')
    } finally {
      setIsProcessing(false)
      setProcessingMessage('')
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 通知トースト */}
      {notification && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-2xl transition-all animate-in slide-in-from-top-2 ${
          notification.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
            : notification.type === 'error'
            ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
            : 'bg-indigo-950/90 border-indigo-500/40 text-indigo-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            ) : notification.type === 'error' ? (
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-indigo-400 shrink-0" />
            )}
            <span className="text-xs font-bold leading-relaxed">{notification.message}</span>
          </div>
          <button 
            onClick={() => setNotification(null)}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 処理中ローディングオーバーレイ */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-4 text-center max-w-sm mx-4">
            <div className="p-4 rounded-2xl bg-amber-500/10 text-amber-400 animate-spin">
              <RefreshCw className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">データ処理を実行中</h3>
              <p className="text-xs text-slate-400 mt-1">{processingMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* セクション見出し */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20">
            <Settings2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              システム保守 ＆ データ管理ツール
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                管理者専用
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              新年度の一括進級・新入生CSV一括登録・動作検証用テストデータの自動生成と安全な一括削除を行えます。
            </p>
          </div>
        </div>

        <button
          onClick={() => onDataRefresh()}
          disabled={isProcessing}
          className="self-start md:self-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-slate-700 active:scale-95 shrink-0 shadow-sm"
        >
          <RefreshCw className="h-4 w-4 text-amber-400" />
          <span>最新データ再取得</span>
        </button>
      </div>

      {/* 3大管理カードグリッド */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ======================================================== */}
        {/* カード 1: 新年度・新学期一括進級処理 */}
        {/* ======================================================== */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-black text-white">1. 新年度一括進級処理</h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-300 font-bold">
                年度替わり
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              全校生徒の学年を1学年繰り上げます。<strong>3年生は自動的に「卒業」ステータス</strong>へと安全に更新されます。
            </p>

            {/* 現在の学年別内訳サマリー */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-850 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 block">現在の在籍状況:</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">1年生:</span>
                  <span className="font-bold text-white font-mono">{gradeCounts.first}名</span>
                </div>
                <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">2年生:</span>
                  <span className="font-bold text-white font-mono">{gradeCounts.second}名</span>
                </div>
                <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">3年生:</span>
                  <span className="font-bold text-pink-400 font-mono">{gradeCounts.third}名</span>
                </div>
                <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">卒業済:</span>
                  <span className="font-bold text-slate-500 font-mono">{gradeCounts.graduated}名</span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowPromoteModal(true)}
            disabled={isProcessing || students.length === 0}
            className="w-full py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-xs font-black rounded-2xl shadow-lg shadow-pink-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <GraduationCap className="h-4 w-4" />
            <span>🌸 新年度一括進級を実行する</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* カード 2: 動作検証用テストデータ生成・全削除 */}
        {/* ======================================================== */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Database className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-black text-white">2. 検証用テストデータ管理</h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 font-bold">
                開発・デバッグ
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              点呼や帳票印刷、予約同期の動作検証用に、<strong>ダミー生徒（18名）と直近2週間分の予約データ</strong>を一括投入します。
            </p>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-850 space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">登録済みテスト生徒:</span>
                <span className={`font-black font-mono px-2 py-0.5 rounded-md ${
                  testStudentCount > 0 ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-slate-500'
                }`}>
                  {testStudentCount} 名
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-normal">
                ※ テスト生徒は「TEST-xxx」の管理コードで識別され、検証完了後にワンクリックで安全に一括削除できます。
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={handleGenerateTestData}
              disabled={isProcessing}
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black rounded-2xl shadow-lg shadow-purple-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              <span>🧪 テスト生徒＆予約を自動生成</span>
            </button>

            {testStudentCount > 0 && (
              <button
                type="button"
                onClick={() => setShowClearTestModal(true)}
                disabled={isProcessing}
                className="w-full py-2.5 bg-slate-950 hover:bg-rose-950/60 border border-rose-500/40 text-rose-300 hover:text-rose-200 text-xs font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                <span>テストデータのみ一括クリア ({testStudentCount}名)</span>
              </button>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* カード 3: 新入生・生徒マスタCSV一括取り込み */}
        {/* ======================================================== */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-black text-white">3. 生徒マスタCSV一括登録</h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-bold">
                CSV一括
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              新入生や全校生徒のCSVファイルを読み込み、生徒マスタへ一括登録（Upsert）します。<strong>Shift-JIS / Excel文字化けも自動補正</strong>。
            </p>

            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850 flex items-center justify-between">
              <div className="text-xs">
                <span className="font-bold text-slate-300 block">フォーマット雛形:</span>
                <span className="text-[10px] text-slate-500">生徒番号, 氏名, 学年, 組, バス停名...</span>
              </div>
              <button
                type="button"
                onClick={() => downloadStudentCSVTemplate(busStops)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-750 text-emerald-300 hover:text-emerald-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1 shrink-0"
                title="CSVテンプレートをダウンロード"
              >
                <Download className="h-3.5 w-3.5" />
                <span>雛形DL</span>
              </button>
            </div>
          </div>

          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
              id="student-csv-file-input"
            />
            <label
              htmlFor="student-csv-file-input"
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black rounded-2xl shadow-lg shadow-emerald-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              <span>📁 CSVファイルを選択して取り込む</span>
            </label>
          </div>
        </div>

      </div>

      {/* ======================================================== */}
      {/* モーダル 1: 新年度一括進級の確認 */}
      {/* ======================================================== */}
      {showPromoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 text-white space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black">新年度一括進級の実行確認</h3>
                <p className="text-xs text-slate-400">学年繰り上げ・卒業処理</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <p className="text-slate-300 font-bold">以下の処理が一括実行されます:</p>
              <ul className="space-y-1 text-slate-400 list-disc list-inside">
                <li><strong className="text-pink-300">3年生 ({gradeCounts.third}名)</strong> → 「卒業」ステータスへ移行</li>
                <li><strong className="text-white">2年生 ({gradeCounts.second}名)</strong> → 「3年生」に進級</li>
                <li><strong className="text-white">1年生 ({gradeCounts.first}名)</strong> → 「2年生」に進級</li>
              </ul>
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-medium mt-2">
                ⚠️ この操作は全校生徒の学年データを一括更新します。実行してよろしいですか？
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPromoteModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold transition-all"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleExecutePromotion}
                className="flex-1 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl text-xs font-black shadow-lg shadow-pink-600/30 transition-all active:scale-95"
              >
                進級を実行する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* モーダル 2: テストデータ一括削除の確認 */}
      {/* ======================================================== */}
      {showClearTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 text-white space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black">テストデータ一括削除の確認</h3>
                <p className="text-xs text-slate-400">TEST-プレフィックスの生徒・予約</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <p className="text-slate-300">
                管理コードが「<code className="text-purple-300 bg-purple-950/60 px-1 py-0.5 rounded">TEST-</code>」で始まるダミー生徒（<strong>{testStudentCount}名</strong>）および、それに紐付くすべての予約・点呼データを完全に削除します。
              </p>
              <p className="text-slate-400 text-[11px]">
                ※ 本番運用の実生徒データは削除されません。
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearTestModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold transition-all"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleExecuteClearTestData}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-600/30 transition-all active:scale-95"
              >
                テストデータを削除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* モーダル 3: CSV取り込みプレビュー */}
      {/* ======================================================== */}
      {showCsvPreviewModal && csvParseResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-white">
            
            {/* ヘッダー */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">CSV生徒データ取り込みプレビュー</h3>
                  <p className="text-xs text-slate-400">
                    ファイル: {csvFile?.name}（有効行: {csvParseResult.validRows.length}件 / エラー: {csvParseResult.errors.length}件）
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCsvPreviewModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* コンテンツ本文 */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* エラー行の警告 */}
              {csvParseResult.errors.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-xs space-y-1">
                  <span className="font-bold text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-rose-400" />
                    以下の行でフォーマットエラーが検知されました（スキップされます）:
                  </span>
                  <div className="max-h-24 overflow-y-auto space-y-1 text-slate-300">
                    {csvParseResult.errors.map((e, idx) => (
                      <p key={idx} className="text-[11px]">
                        行 {e.row}: {e.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* プレビューテーブル */}
              <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">生徒番号</th>
                        <th className="py-2.5 px-3">氏名</th>
                        <th className="py-2.5 px-3">学年・組</th>
                        <th className="py-2.5 px-3">照合コード</th>
                        <th className="py-2.5 px-3">利用バス停</th>
                        <th className="py-2.5 px-3">朝利用</th>
                        <th className="py-2.5 px-3">下校便</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {csvParseResult.validRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/50">
                          <td className="py-2 px-3 font-mono font-bold text-white">{row.student_code}</td>
                          <td className="py-2 px-3 font-bold text-emerald-300">{row.name}</td>
                          <td className="py-2 px-3 text-slate-300">{row.grade} {row.class_name}</td>
                          <td className="py-2 px-3 font-mono text-slate-400">{row.verification_code}</td>
                          <td className="py-2 px-3 text-amber-300">{row.bus_stop_name || 'デフォルトバス停'}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.default_morning_ride ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {row.default_morning_ride ? '○ 乗車' : '× 不乗車'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-300">{row.default_afternoon_schedule || '下校2便'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* フッター */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowCsvPreviewModal(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold transition-all"
              >
                キャンセル
              </button>

              <button
                type="button"
                onClick={handleExecuteCsvImport}
                disabled={csvParseResult.validRows.length === 0}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/30 transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                <span>{csvParseResult.validRows.length} 名を一括登録する</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
