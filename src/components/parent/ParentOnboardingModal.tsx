import React, { useState, useEffect } from 'react'
import { 
  Users, Calendar, Bus, Smartphone, CheckCircle2, ChevronLeft, ChevronRight, 
  X, Sparkles, ShieldCheck, UserPlus, Check, Download
} from 'lucide-react'

interface ParentOnboardingModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

export const ParentOnboardingModal: React.FC<ParentOnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1)
  const [osTab, setOsTab] = useState<'ios' | 'android'>('ios')
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState<boolean>(false)

  // PWA インストールプロンプトのキャプチャ
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    // iOS判定（初期タブ自動選択）
    const userAgent = window.navigator.userAgent.toLowerCase()
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setOsTab('ios')
    } else if (/android/.test(userAgent)) {
      setOsTab('android')
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // モーダルが開かれた時にステップを1にリセットし、Escキー監視
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1)
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setIsInstalled(true)
    }
    setDeferredPrompt(null)
  }

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1)
    } else {
      onComplete()
    }
  }

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const steps = [
    { id: 1, title: '生徒連携・兄弟追加', icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/20' },
    { id: 2, title: '予約＆時短テクニック', icon: Calendar, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    { id: 3, title: '運行状況・登下校見守り', icon: ShieldCheck, color: 'text-amber-400', bg: 'bg-amber-500/20' },
    { id: 4, title: 'ホーム画面に追加(PWA)', icon: Smartphone, color: 'text-purple-400', bg: 'bg-purple-500/20' }
  ]

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white">
        
        {/* ヘッダー */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black flex items-center gap-2">
                スクールバス予約アプリ 利用ガイド
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                  Step {currentStep} / 4
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                初めての方も安心！便利な使い方をわかりやすくご案内します
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors"
            title="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ステップ進捗インジケーター */}
        <div className="px-5 pt-3 pb-2 bg-slate-950/50 border-b border-slate-850 shrink-0">
          <div className="grid grid-cols-4 gap-2">
            {steps.map((step) => {
              const isPassed = currentStep > step.id
              const isCurrent = currentStep === step.id
              return (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(step.id)}
                  className={`flex items-center gap-1.5 p-2 rounded-xl text-left transition-all ${
                    isCurrent
                      ? 'bg-slate-800 border border-indigo-500/50 ring-1 ring-indigo-500/30'
                      : isPassed
                      ? 'bg-slate-900/60 border border-slate-800 opacity-90 hover:opacity-100'
                      : 'bg-slate-950/40 border border-transparent opacity-50 hover:opacity-75'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg shrink-0 ${isCurrent ? step.bg : isPassed ? 'bg-emerald-500/20' : 'bg-slate-800'}`}>
                    {isPassed ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <step.icon className={`h-3.5 w-3.5 ${isCurrent ? step.color : 'text-slate-400'}`} />
                    )}
                  </div>
                  <div className="hidden sm:block min-w-0 flex-1">
                    <p className={`text-[10px] font-bold truncate ${isCurrent ? 'text-white' : 'text-slate-400'}`}>
                      {step.title}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* プログレスバー */}
          <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-full transition-all duration-300 rounded-full"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* コンテンツ本文（スクロール可能） */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* STEP 1: 生徒連携・兄弟追加 */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0 mt-0.5">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">お子様との連携・兄弟姉妹の一括管理</h3>
                  <p className="text-xs text-indigo-200/90 mt-1 leading-relaxed">
                    学校から配布された<strong>「生徒照合コード（学年・組・番号）」</strong>を用いてアカウントとお子様を安全に紐付けます。
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 解説カード1 */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/20 text-[10px]">1</span>
                    初期登録とお子様の照合
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    初回登録時にお子様のお名前と照合コードを入力するだけで、対象ルートや乗降バス停が自動セットされます。
                  </p>
                </div>

                {/* 解説カード2 */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-500/20 text-[10px]">2</span>
                    兄弟姉妹のワンタップ切り替え
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    2人目以降のお子様も同じアカウントに追加可能。画面上部のセレクタからワンタップで切り替えて個別に予約できます。
                  </p>
                </div>
              </div>

              {/* UIプレビュー模倣カード */}
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                <p className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-indigo-400" />
                  画面上部のお子様セレクタ（操作イメージ）
                </p>
                <div className="flex items-center gap-2 flex-wrap bg-slate-900 p-2 rounded-xl border border-slate-800">
                  <span className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-black shadow-md shadow-indigo-600/30 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    佐藤 太郎（中1・Aコース）
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-750">
                    佐藤 次郎（小4・Aコース）
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-slate-855 text-indigo-300 text-[10px] font-bold border border-indigo-500/20 ml-auto">
                    + お子様を追加
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: 予約＆時短テクニック */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">週間予約と時短の「基本パターン一括適用」</h3>
                  <p className="text-xs text-emerald-200/90 mt-1 leading-relaxed">
                    毎日の乗車予約はワンタップで完結。毎週のスケジュールが決まっている方は一括適用で入力の手間を大幅カットできます。
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {/* 週間予約の手順 */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 font-black text-xs shrink-0">
                    操作1
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-white">登校便・下校便の選択</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      朝の「乗車 / 不乗車」はボタンを1タップで切り替え。下校便はプルダウンから希望の便（下校1便〜5便）を選ぶだけです。
                    </p>
                  </div>
                </div>

                {/* 個別連絡メモ */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 font-black text-xs shrink-0">
                    操作2
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-white">個別連絡メモ（学校・ドライバーへ通知）</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      「部活のため下校2便」「病院受診のため朝欠席」などの連絡メモを各日付に添えて送信できます。
                    </p>
                  </div>
                </div>

                {/* 時短テクニック */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950/60 to-purple-950/60 border border-indigo-500/30 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 font-black text-xs shrink-0">
                    💡 時短
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-indigo-200">「基本パターン一括適用」が超便利！</h4>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      月・火・水・木・金の基本乗車パターンを一度登録しておけば、<strong>「基本パターンを一括反映」ボタン1つで翌月の全日程を自動入力</strong>できます。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: 運行状況・登下校見守り */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">リアルタイム運行状況＆安心の登下校見守り</h3>
                  <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                    バスの遅延や運休情報はトップバナーで即座に共有され、お子様が乗車したかどうかも手元で確認できます。
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {/* 遅延・運行バナー */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-400">
                    <Bus className="h-4 w-4" />
                    リアルタイム遅延・運行アラート
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    道路工事や渋滞で遅延が発生した際は、トップに「⚠️ 約10分遅延中」などドライバーからの連絡が即時表示されます。
                  </p>
                  <div className="p-2.5 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center justify-between">
                    <span>【登校便】⚠️ 約 10 分遅延中（渋滞のため徐行中）</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black">リアルタイム</span>
                  </div>
                </div>

                {/* 乗車完了見守りバッジ */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-black text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    ドライバー点呼による「乗車完了」確認
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    ドライバーがお子様の乗車時にタブレットで点呼を行うと、保護者画面のカードに「乗車完了（07:42）」と即座に反映され、無事に乗車したことを確認できます。
                  </p>
                  <div className="flex items-center gap-2 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-xs font-bold text-slate-300">朝の登校便:</span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      乗車完了（07:42）
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: ホーム画面に追加(PWA) */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 shrink-0 mt-0.5">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">ホーム画面に追加してアプリのように快適利用</h3>
                  <p className="text-xs text-purple-200/90 mt-1 leading-relaxed">
                    ホーム画面にアイコンを追加すれば、ブラウザのURL入力をせずワンタップで全画面表示できます。
                  </p>
                </div>
              </div>

              {/* ダイレクトインストールボタン（ブラウザが対応している場合） */}
              {deferredPrompt && !isInstalled && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xl shadow-purple-600/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-black">ワンクリックでアプリをインストール</h4>
                    <p className="text-[11px] text-purple-100 mt-0.5">お使いの端末へアプリとして直接追加できます。</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    className="px-4 py-2.5 bg-white text-purple-900 font-black rounded-xl text-xs hover:bg-purple-50 transition-all active:scale-95 flex items-center justify-center gap-1.5 shrink-0 shadow-md"
                  >
                    <Download className="h-4 w-4" />
                    今すぐインストール
                  </button>
                </div>
              )}

              {/* OS切り替えタブ */}
              <div className="space-y-3">
                <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setOsTab('ios')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      osTab === 'ios'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>📱 iPhone (Safari)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOsTab('android')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      osTab === 'android'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🤖 Android (Chrome)</span>
                  </button>
                </div>

                {/* iPhoneの手順 */}
                {osTab === 'ios' && (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                    <ol className="space-y-3 text-slate-300">
                      <li className="flex items-start gap-2.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold shrink-0 text-[11px] mt-0.5">1</span>
                        <div>
                          <strong>Safari</strong> で本ページを開き、画面下部中央の <strong>「共有アイコン（四角と上矢印）」</strong> をタップします。
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold shrink-0 text-[11px] mt-0.5">2</span>
                        <div>
                          表示されたメニューを少し下にスクロールし、<strong>「ホーム画面に追加」</strong> を選択します。
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold shrink-0 text-[11px] mt-0.5">3</span>
                        <div>
                          右上の <strong>「追加」</strong> をタップすると、ホーム画面に専用アイコンが配置されます。
                        </div>
                      </li>
                    </ol>
                  </div>
                )}

                {/* Androidの手順 */}
                {osTab === 'android' && (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                    <ol className="space-y-3 text-slate-300">
                      <li className="flex items-start gap-2.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold shrink-0 text-[11px] mt-0.5">1</span>
                        <div>
                          <strong>Chrome</strong> で本ページを開き、右上の <strong>「メニュー（縦の3点リーダー ⋮）」</strong> をタップします。
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold shrink-0 text-[11px] mt-0.5">2</span>
                        <div>
                          メニュー内の <strong>「アプリをインストール」</strong> または <strong>「ホーム画面に追加」</strong> を選択します。
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold shrink-0 text-[11px] mt-0.5">3</span>
                        <div>
                          画面の指示に従って <strong>「インストール」</strong> をタップすると、アプリ一覧およびホーム画面に追加されます。
                        </div>
                      </li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* フッター操作バー */}
        <div className="px-5 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
          <div>
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <ChevronLeft className="h-4 w-4" />
                前へ
              </button>
            ) : (
              <button
                type="button"
                onClick={onComplete}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors"
              >
                スキップして始める
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black rounded-xl shadow-lg shadow-indigo-600/30 transition-all active:scale-95 flex items-center gap-1.5"
              >
                <span>次へ</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onComplete}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/30 transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Sparkles className="h-4 w-4" />
                <span>利用を開始する</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
