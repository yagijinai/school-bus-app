import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import { 
  Bus, Calendar, FileSpreadsheet, Users, MapPin, 
  RefreshCw, LogOut, Check, 
  Sun, Snowflake, Palmtree, Ban
} from 'lucide-react'
import type { BasicSettingRow } from '../types/spreadsheet'
import { toSlashDate, toHyphenDate } from '../lib/spreadsheetApi'

export const AdminDashboard: React.FC = () => {
  const { 
    user, logout, basicSettings, schedules, 
    guardianMaster, busStops, 
    saveBasicSetting, syncing, refreshAll 
  } = useApp()

  const [activeTab, setActiveTab] = useState<'basicSettings' | 'schedules' | 'guardians' | 'stops'>('basicSettings')

  // 基本設定インラインドラフト用状態（設定名キー）
  const [drafts, setDrafts] = useState<Record<string, Partial<BasicSettingRow>>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)

  // 運行カレンダー一覧用日付フィルター
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return toSlashDate(new Date())
  })

  // ドラフト変更
  const handleDraftChange = (settingName: string, field: keyof BasicSettingRow, val: string) => {
    setDrafts(prev => ({
      ...prev,
      [settingName]: {
        ...(prev[settingName] || {}),
        [field]: val
      }
    }))
  }

  // 基本設定の自動保存実行（即座にGASへ送信）
  const handleAutoSave = async (settingName: string, field: keyof BasicSettingRow, val: string) => {
    const row = basicSettings.find(b => b.setting_name === settingName)
    const draft = drafts[settingName] || {}

    const startDate = field === 'start_date' ? val : (draft.start_date !== undefined ? draft.start_date : (row?.start_date || ''))
    const endDate = field === 'end_date' ? val : (draft.end_date !== undefined ? draft.end_date : (row?.end_date || ''))
    const stdOp = field === 'standard_operation' ? val : (draft.standard_operation !== undefined ? draft.standard_operation : (row?.standard_operation || ''))
    const content = field === 'content_time' ? val : (draft.content_time !== undefined ? draft.content_time : (row?.content_time || ''))
    const note = field === 'note' ? val : (draft.note !== undefined ? draft.note : (row?.note || ''))

    setSavingKey(settingName)
    try {
      const res = await saveBasicSetting({
        setting_name: settingName,
        start_date: startDate,
        end_date: endDate,
        standard_operation: stdOp,
        content_time: content,
        note: note
      })

      if (res.success) {
        setSavedKey(settingName)
        setTimeout(() => setSavedKey(null), 2500)
      } else {
        alert(`保存に失敗しました: ${res.message}`)
      }
    } finally {
      setSavingKey(null)
    }
  }

  // 選択日の運行状況一覧
  const currentDaySchedules = schedules.filter(s => s.date === selectedDate)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* 上部ヘッダー */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white rounded-2xl shadow-md">
            <Bus className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white flex items-center gap-2">
              管理者コンソール (ADMIN CONSOLE)
              <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-bold">
                スプレッドシート生データ直結
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              ログイン: {user?.email}（{user?.name}）
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => refreshAll()}
            disabled={syncing}
            className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-amber-400 hover:text-amber-300 transition-all text-xs font-bold flex items-center gap-1.5"
            title="スプレッドシートの生データを再取得"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'データ再同期中...' : 'GASから最新データを再同期'}
          </button>
          <button
            type="button"
            onClick={logout}
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-rose-400 transition-all text-xs font-bold flex items-center gap-1"
          >
            <LogOut className="h-4 w-4" />
            ログアウト
          </button>
        </div>
      </header>

      {/* タブナビゲーション */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-850 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('basicSettings')}
          className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all ${
            activeTab === 'basicSettings'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/15'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          基本設定・運休期間マスタ ({basicSettings.length}件)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('schedules')}
          className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all ${
            activeTab === 'schedules'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/15'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Calendar className="h-4 w-4" />
          運行予定カレンダー一覧 ({schedules.length}件)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('guardians')}
          className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all ${
            activeTab === 'guardians'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/15'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Users className="h-4 w-4" />
          生徒・保護者マスター ({guardianMaster.length}世帯)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('stops')}
          className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all ${
            activeTab === 'stops'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/15'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <MapPin className="h-4 w-4" />
          バス停マスタ ({busStops.length}停留所)
        </button>
      </div>

      {/* ========================================================= */}
      {/* タブ 1: 基本設定・運休期間（生データ直結・インライン即時保存） */}
      {/* ========================================================= */}
      {activeTab === 'basicSettings' && (
        <div className="space-y-6">
          {/* ハイライトカード表示（スプレッドシート生文字列をそのまま直接描画） */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <Sun className="h-4 w-4 text-amber-400" />
                長期休業・運休期間ハイライト（スプレッドシート生データ表示）
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                全 {basicSettings.length} 行取得済
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {basicSettings.map((period, idx) => {
                const settingName = period.setting_name
                const draft = drafts[settingName] || {}
                const curStart = draft.start_date !== undefined ? draft.start_date : period.start_date
                const curEnd = draft.end_date !== undefined ? draft.end_date : period.end_date
                const isSaving = savingKey === settingName
                const isSaved = savedKey === settingName

                const isSummer = settingName.includes('夏')
                const isWinter = settingName.includes('冬')
                const isSpring = settingName.includes('春')

                return (
                  <div
                    key={idx}
                    className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-3 relative overflow-hidden hover:border-slate-700 transition-all shadow-lg"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2.5 rounded-2xl ${
                          isSummer ? 'bg-amber-500/20 text-amber-300' :
                          isWinter ? 'bg-sky-500/20 text-sky-300' :
                          isSpring ? 'bg-emerald-500/20 text-emerald-300' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          {isSummer ? <Sun className="h-5 w-5" /> :
                           isWinter ? <Snowflake className="h-5 w-5" /> :
                           isSpring ? <Palmtree className="h-5 w-5" /> :
                           <Ban className="h-5 w-5 text-rose-400" />}
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block">
                            スプレッドシート行
                          </span>
                          <h3 className="text-base font-black text-white">
                            {settingName}
                          </h3>
                        </div>
                      </div>

                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {period.standard_operation || '運休'}
                      </span>
                    </div>

                    <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-900 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px] font-bold">期間（生データ直結）:</span>
                        <span className="font-mono font-bold text-amber-300 tracking-wide text-xs">
                          {curStart || '-'} 〜 {curEnd || '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[11px]">内容・時刻:</span>
                        <span className="font-bold text-slate-200 text-xs">{period.content_time || '全便運休'}</span>
                      </div>
                      {period.note && (
                        <div className="pt-1.5 text-[11px] text-slate-400 border-t border-slate-900">
                          備考: {period.note}
                        </div>
                      )}

                      {/* カード内での即時日付変更（直接GASへ送信） */}
                      <div className="pt-2 border-t border-slate-900 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 font-bold">日付即時変更:</span>
                          {isSaving ? (
                            <span className="text-amber-400 font-bold flex items-center gap-1 animate-pulse">
                              <RefreshCw className="h-2.5 w-2.5 animate-spin" /> GAS更新中...
                            </span>
                          ) : isSaved ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                              <Check className="h-3 w-3" /> 保存完了
                            </span>
                          ) : (
                            <span className="text-slate-600 font-mono">即時自動保存</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[9px] text-slate-500 block mb-0.5">開始日</span>
                            <input
                              type="date"
                              value={toHyphenDate(curStart)}
                              onChange={(e) => {
                                const slash = toSlashDate(e.target.value)
                                handleDraftChange(settingName, 'start_date', slash)
                                handleAutoSave(settingName, 'start_date', slash)
                              }}
                              className="w-full bg-slate-900 border border-slate-800 hover:border-amber-500/60 rounded-lg px-2 py-1 text-[11px] text-amber-300 font-mono focus:outline-none transition-all cursor-pointer"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block mb-0.5">終了日</span>
                            <input
                              type="date"
                              value={toHyphenDate(curEnd)}
                              onChange={(e) => {
                                const slash = toSlashDate(e.target.value)
                                handleDraftChange(settingName, 'end_date', slash)
                                handleAutoSave(settingName, 'end_date', slash)
                              }}
                              className="w-full bg-slate-900 border border-slate-800 hover:border-amber-500/60 rounded-lg px-2 py-1 text-[11px] text-amber-300 font-mono focus:outline-none transition-all cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 全項目インライン編集テーブル */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                スプレッドシート「基本設定・運休期間」インライン編集テーブル
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                開始日・終了日（日付選択時）、標準運行（選択時）、内容・備考（入力完了時）に即座にGAS（action: saveBasicSetting）へ送信されます。
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center text-slate-600">#</th>
                    <th className="py-3 px-3 min-w-[130px]">設定名 (A列)</th>
                    <th className="py-3 px-3 min-w-[145px]">開始日 (B列)</th>
                    <th className="py-3 px-3 min-w-[145px]">終了日 (C列)</th>
                    <th className="py-3 px-3 min-w-[115px]">標準運行 (D列)</th>
                    <th className="py-3 px-3 min-w-[160px]">内容・時刻 (E列)</th>
                    <th className="py-3 px-3 min-w-[160px]">備考 (F列)</th>
                    <th className="py-3 px-3 w-24 text-center">保存状況</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {basicSettings.map((row, idx) => {
                    const settingName = row.setting_name
                    const draft = drafts[settingName] || {}
                    const curStart = draft.start_date !== undefined ? draft.start_date : row.start_date
                    const curEnd = draft.end_date !== undefined ? draft.end_date : row.end_date
                    const curStdOp = draft.standard_operation !== undefined ? draft.standard_operation : row.standard_operation
                    const curContent = draft.content_time !== undefined ? draft.content_time : row.content_time
                    const curNote = draft.note !== undefined ? draft.note : row.note

                    const isSaving = savingKey === settingName
                    const isSaved = savedKey === settingName

                    return (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 text-center font-mono text-slate-500 text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 font-bold text-white">
                          {settingName}
                        </td>
                        {/* 開始日 (B列) */}
                        <td className="py-3 px-3">
                          <input
                            type="date"
                            value={toHyphenDate(curStart)}
                            onChange={(e) => {
                              const slash = toSlashDate(e.target.value)
                              handleDraftChange(settingName, 'start_date', slash)
                              handleAutoSave(settingName, 'start_date', slash)
                            }}
                            className="w-full bg-slate-950 border border-slate-800 hover:border-amber-500/60 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 font-mono focus:outline-none transition-all cursor-pointer"
                          />
                        </td>
                        {/* 終了日 (C列) */}
                        <td className="py-3 px-3">
                          <input
                            type="date"
                            value={toHyphenDate(curEnd)}
                            onChange={(e) => {
                              const slash = toSlashDate(e.target.value)
                              handleDraftChange(settingName, 'end_date', slash)
                              handleAutoSave(settingName, 'end_date', slash)
                            }}
                            className="w-full bg-slate-950 border border-slate-800 hover:border-amber-500/60 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 font-mono focus:outline-none transition-all cursor-pointer"
                          />
                        </td>
                        {/* 標準運行 (D列) */}
                        <td className="py-3 px-3">
                          <select
                            value={curStdOp}
                            onChange={(e) => {
                              const val = e.target.value
                              handleDraftChange(settingName, 'standard_operation', val)
                              handleAutoSave(settingName, 'standard_operation', val)
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs font-bold text-white focus:outline-none cursor-pointer"
                          >
                            <option value="運休">運休</option>
                            <option value="通常運行">通常運行</option>
                            <option value="特別ダイヤ">特別ダイヤ</option>
                          </select>
                        </td>
                        {/* 内容・時刻 (E列) */}
                        <td className="py-3 px-3">
                          <input
                            type="text"
                            value={curContent}
                            onChange={(e) => handleDraftChange(settingName, 'content_time', e.target.value)}
                            onBlur={(e) => handleAutoSave(settingName, 'content_time', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                          />
                        </td>
                        {/* 備考 (F列) */}
                        <td className="py-3 px-3">
                          <input
                            type="text"
                            value={curNote}
                            onChange={(e) => handleDraftChange(settingName, 'note', e.target.value)}
                            onBlur={(e) => handleAutoSave(settingName, 'note', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
                          />
                        </td>
                        {/* 保存状態 */}
                        <td className="py-3 px-3 text-center">
                          {isSaving ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 animate-pulse">
                              <RefreshCw className="h-3 w-3 animate-spin" /> 保存中
                            </span>
                          ) : isSaved ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                              <Check className="h-3 w-3" /> 保存済
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-600 font-mono">自動同期</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* タブ 2: 運行予定カレンダー一覧（全生徒運行状況） */}
      {/* ========================================================= */}
      {activeTab === 'schedules' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-400" />
                運行予定カレンダー 全生徒予約状況
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                スプレッドシート「運行予定カレンダー」シートから直接取得した全行データです。
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-400">日付選択:</label>
              <input
                type="date"
                value={toHyphenDate(selectedDate)}
                onChange={(e) => setSelectedDate(toSlashDate(e.target.value))}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3">日付</th>
                  <th className="py-3 px-3">生徒名</th>
                  <th className="py-3 px-3 text-center">登校便</th>
                  <th className="py-3 px-3 text-center">下校便</th>
                  <th className="py-3 px-3">保護者メール</th>
                  <th className="py-3 px-3">備考</th>
                  <th className="py-3 px-3 font-mono text-[10px]">更新日時</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {currentDaySchedules.length > 0 ? (
                  currentDaySchedules.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-400">{row.date}</td>
                      <td className="py-3 px-3 font-bold text-white">{row.student_name}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.morning_status === '乗る'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'text-slate-500'
                        }`}>
                          {row.morning_status === '乗る' ? '乗車' : '運休/不在'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.afternoon_trip_1 ? 'bg-sky-500/20 text-sky-300' :
                          row.afternoon_trip_2 ? 'bg-indigo-500/20 text-indigo-300' :
                          row.afternoon_trip_3 ? 'bg-purple-500/20 text-purple-300' :
                          'text-slate-500'
                        }`}>
                          {row.afternoon_trip_1 ? '下校1便' :
                           row.afternoon_trip_2 ? '下校2便' :
                           row.afternoon_trip_3 ? '下校3便' : '乗らない'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">{row.parent_email}</td>
                      <td className="py-3 px-3 text-slate-400">{row.note || '-'}</td>
                      <td className="py-3 px-3 font-mono text-[10px] text-slate-500">{row.updated_at || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      選択日（{selectedDate}）の予約データはありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* タブ 3: 生徒・保護者マスター一覧 */}
      {/* ========================================================= */}
      {activeTab === 'guardians' && (
        <div className="bg-slate-900/70 border border-slate-850 rounded-3xl p-6 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-400" />
              生徒・保護者マスター（全世帯一覧）
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              スプレッドシート「生徒・保護者マスター」シートから直接取得したデータです。
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3">保護者メール (A列)</th>
                  <th className="py-3 px-3">登録生徒 (B〜E列)</th>
                  <th className="py-3 px-3">登録バス停 (F列)</th>
                  <th className="py-3 px-3">基本_登校 (H列)</th>
                  <th className="py-3 px-3">基本_下校 (I列)</th>
                  <th className="py-3 px-3">備考 (G列)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {guardianMaster.map((g, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-mono text-slate-300 font-bold">{g.parent_email}</td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1">
                        {g.student_names.map((name, i) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-800 text-white rounded font-bold text-[11px]">
                            {name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-amber-300 font-bold">{g.bus_stop_name || '-'}</td>
                    <td className="py-3 px-3">{g.default_morning || '-'}</td>
                    <td className="py-3 px-3">{g.default_afternoon || '-'}</td>
                    <td className="py-3 px-3 text-slate-400">{g.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* タブ 4: バス停マスタ一覧 */}
      {/* ========================================================= */}
      {activeTab === 'stops' && (
        <div className="bg-slate-900/70 border border-slate-850 rounded-3xl p-6 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <MapPin className="h-5 w-5 text-emerald-400" />
              バス停マスタ（停車順序一覧）
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              スプレッドシート「バス停マスタ」シートから直接取得したデータです。
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3 w-16 text-center">順序</th>
                  <th className="py-3 px-3">バス停名 (A列)</th>
                  <th className="py-3 px-3">到着予定時刻 (C列)</th>
                  <th className="py-3 px-3">住所 (B列)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {busStops.map((stop, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 text-center font-mono text-amber-400 font-bold">{stop.order || idx + 1}</td>
                    <td className="py-3 px-3 font-bold text-white text-sm">{stop.name}</td>
                    <td className="py-3 px-3 font-mono text-emerald-300 font-bold">{stop.arrival_time_morning || '-'}</td>
                    <td className="py-3 px-3 text-slate-400">{stop.address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
