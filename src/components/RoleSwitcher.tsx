import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { IS_DEV_SWITCHER_ENABLED } from '../config/features'
import { extractHouseholdInfo } from '../lib/householdUtils'
import { ChevronDown, Check, ShieldCheck, Bus, Users, Sparkles, Trash2 } from 'lucide-react'

export const RoleSwitcher: React.FC = () => {
  if (!IS_DEV_SWITCHER_ENABLED) return null

  const { user, quickLoginAs, loginAsParentStudent, guardianMaster, clearAllCacheAndResync } = useApp()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // スプレッドシート連動：先頭2世帯の動的世帯情報を抽出
  const household1 = useMemo(() => extractHouseholdInfo(guardianMaster[0], 1), [guardianMaster])
  const household2 = useMemo(() => extractHouseholdInfo(guardianMaster[1], 2), [guardianMaster])

  // 外部クリックでメニューを閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 生徒一覧の抽出
  const studentList = useMemo(() => {
    const list: { studentName: string; busStopName: string; parentEmail: string }[] = []
    const seen = new Set<string>()

    guardianMaster.forEach(g => {
      const names = g.student_names && g.student_names.length > 0
        ? g.student_names
        : [g.student_name_1, g.student_name_2, g.student_name_3, g.student_name_4].filter(Boolean) as string[]

      names.forEach(name => {
        const cleanName = String(name || '').trim()
        if (cleanName && !seen.has(cleanName)) {
          seen.add(cleanName)
          list.push({
            studentName: cleanName,
            busStopName: g.bus_stop_name || '',
            parentEmail: g.parent_email || ''
          })
        }
      })
    })
    return list
  }, [guardianMaster])

  if (!user) return null

  const handleSelectRole = async (targetType: 'admin' | 'driver') => {
    setIsSwitching(true)
    try {
      await quickLoginAs(targetType)
      setIsOpen(false)
      if (targetType === 'admin') {
        navigate('/admin')
      } else {
        navigate('/driver')
      }
    } finally {
      setIsSwitching(false)
    }
  }

  const handleSelectStudent = async (studentName: string) => {
    setIsSwitching(true)
    try {
      await loginAsParentStudent(studentName)
      setIsOpen(false)
      navigate('/parent')
    } finally {
      setIsSwitching(false)
    }
  }

  const roleConfig = {
    '管理者': {
      label: '管理者',
      badgeColor: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
      icon: <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
    },
    '運転手': {
      label: '運転手',
      badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      icon: <Bus className="w-3.5 h-3.5 text-emerald-400" />
    },
    '保護者': {
      label: user.studentName ? `${user.studentName}の保護者` : '保護者',
      badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      icon: <Users className="w-3.5 h-3.5 text-amber-400" />
    }
  }

  const currentConfig = roleConfig[user.role] || roleConfig['保護者']

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* 切替トリガーボタン */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        disabled={isSwitching}
        className="group px-3 py-1.5 bg-slate-950/80 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/50 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
        title="立場（ロール）をワンクリックで切り替えます"
      >
        <span className="hidden sm:inline text-slate-400 text-[11px]">立場:</span>
        <span className={`px-2 py-0.5 rounded-lg border text-[11px] font-black flex items-center gap-1 ${currentConfig.badgeColor}`}>
          {currentConfig.icon}
          {currentConfig.label}
        </span>
        <span className="text-[11px] text-amber-400 font-bold flex items-center gap-0.5">
          切替
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {/* ドロップダウンメニュー */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 max-h-96 overflow-y-auto rounded-2xl bg-slate-900/95 border border-slate-750 shadow-2xl backdrop-blur-xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1.5 border-b border-slate-800 text-[10px] text-slate-400 font-bold flex items-center justify-between">
            <span className="flex items-center gap-1 text-amber-400">
              <Sparkles className="w-3 h-3" />
              【検証用】ロール即時切替
            </span>
            <span className="text-slate-500">お試しモード</span>
          </div>

          {/* 1. 管理者 */}
          <button
            type="button"
            onClick={() => handleSelectRole('admin')}
            disabled={isSwitching}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
              user.role === '管理者'
                ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30'
                : 'hover:bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <div>
                <span className="block font-black">🏫 学校管理者</span>
                <span className="block text-[10px] text-slate-400 font-normal">時刻表確定・運休設定</span>
              </div>
            </div>
            {user.role === '管理者' && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
          </button>

          {/* 2. 運転手 */}
          <button
            type="button"
            onClick={() => handleSelectRole('driver')}
            disabled={isSwitching}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
              user.role === '運転手'
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                : 'hover:bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Bus className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="block font-black">👨‍✈️ バス運転手</span>
                <span className="block text-[10px] text-slate-400 font-normal">スマホ点呼・乗車記録</span>
              </div>
            </div>
            {user.role === '運転手' && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
          </button>

          {/* 保護者セクション見出し */}
          <div className="px-2.5 pt-2 pb-1 border-t border-slate-800 text-[10px] text-amber-400 font-bold flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              保護者ワンタップ切替
            </span>
            <span className="text-[9px] text-slate-500 font-normal">検証用テスト</span>
          </div>

          {/* 第1世帯（例: 山田家） */}
          {household1.primaryStudent && (
            <button
              type="button"
              onClick={() => handleSelectStudent(household1.primaryStudent)}
              disabled={isSwitching}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                user.role === '保護者' && (household1.allStudents.includes(user.studentName || '') || user.email === household1.parentEmail)
                  ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30'
                  : 'hover:bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <div>
                  <span className="block font-black">👨‍👩‍👦 {household1.mainLabel}</span>
                  <span className="block text-[10px] text-slate-400 font-normal">{household1.subLabel}</span>
                </div>
              </div>
              {user.role === '保護者' && (household1.allStudents.includes(user.studentName || '') || user.email === household1.parentEmail) && (
                <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
            </button>
          )}

          {/* 第2世帯（例: 佐藤家） */}
          {household2.primaryStudent && (
            <button
              type="button"
              onClick={() => handleSelectStudent(household2.primaryStudent)}
              disabled={isSwitching}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                user.role === '保護者' && (household2.allStudents.includes(user.studentName || '') || user.email === household2.parentEmail)
                  ? 'bg-orange-500/20 text-orange-200 border border-orange-500/30'
                  : 'hover:bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-orange-400" />
                <div>
                  <span className="block font-black">👨‍👩‍👦 {household2.mainLabel}</span>
                  <span className="block text-[10px] text-slate-400 font-normal">{household2.subLabel}</span>
                </div>
              </div>
              {user.role === '保護者' && (household2.allStudents.includes(user.studentName || '') || user.email === household2.parentEmail) && (
                <Check className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              )}
            </button>
          )}

          {/* その他生徒一覧 */}
          {studentList.filter(st => !household1.allStudents.includes(st.studentName) && !household2.allStudents.includes(st.studentName)).length > 0 && (
            <div className="px-2.5 pt-2 pb-1 border-t border-slate-800 text-[10px] text-slate-500 font-bold">
              その他の登録生徒
            </div>
          )}

          {/* 3. 各生徒の保護者（動的ループ） */}
          {studentList
            .filter(st => !household1.allStudents.includes(st.studentName) && !household2.allStudents.includes(st.studentName))
            .map(st => {
              const isSelected = user.role === '保護者' && (user.studentName === st.studentName || user.email === `parent_${st.studentName}`)
              return (
                <button
                  key={st.studentName}
                  type="button"
                  onClick={() => handleSelectStudent(st.studentName)}
                  disabled={isSwitching}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30'
                      : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="block font-black">👨‍👩‍👦 {st.studentName} の保護者</span>
                      <span className="block text-[10px] text-slate-400 font-normal">
                        バス停: {st.busStopName || '未設定'}
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </button>
              )
            })}

          {/* キャッシュ全消去＆強制再同期 */}
          <div className="pt-2 mt-1 border-t border-slate-800">
            <button
              type="button"
              onClick={async () => {
                if (window.confirm('端末の保存データ（localStorage）を全消去し、GASから最新データを強制再取得しますか？')) {
                  setIsSwitching(true)
                  try {
                    const res = await clearAllCacheAndResync()
                    setIsOpen(false)
                    alert(res.message)
                  } finally {
                    setIsSwitching(false)
                  }
                }
              }}
              disabled={isSwitching}
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 border border-transparent hover:border-rose-800/60"
            >
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
                <span>🗑 保存データを全消去して再同期</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
