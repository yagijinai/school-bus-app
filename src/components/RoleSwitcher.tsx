import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { IS_DEV_SWITCHER_ENABLED } from '../config/features'
import { ChevronDown, Check, ShieldCheck, Bus, Users, Sparkles } from 'lucide-react'

export const RoleSwitcher: React.FC = () => {
  if (!IS_DEV_SWITCHER_ENABLED) return null

  const { user, switchRole } = useApp()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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

  if (!user) return null

  const handleSelectRole = async (targetRole: '管理者' | '運転手' | '保護者') => {
    if (user.role === targetRole) {
      setIsOpen(false)
      return
    }
    setIsSwitching(true)
    try {
      await switchRole(targetRole)
      setIsOpen(false)
      if (targetRole === '管理者') {
        navigate('/admin')
      } else if (targetRole === '運転手') {
        navigate('/driver')
      } else {
        navigate('/parent')
      }
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
      label: '保護者',
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
        className="group px-3 py-1.5 bg-slate-950/80 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/50 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
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
        <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-slate-900/95 border border-slate-750 shadow-2xl backdrop-blur-xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1.5 border-b border-slate-800 text-[10px] text-slate-400 font-bold flex items-center justify-between">
            <span className="flex items-center gap-1 text-amber-400">
              <Sparkles className="w-3 h-3" />
              【検証用】ロール即時切替
            </span>
            <span className="text-slate-500">お試しモード</span>
          </div>

          {/* 管理者 */}
          <button
            type="button"
            onClick={() => handleSelectRole('管理者')}
            disabled={isSwitching}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
              user.role === '管理者'
                ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30'
                : 'hover:bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              🏫 学校管理者コンソール
            </span>
            {user.role === '管理者' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
          </button>

          {/* 運転手 */}
          <button
            type="button"
            onClick={() => handleSelectRole('運転手')}
            disabled={isSwitching}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
              user.role === '運転手'
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                : 'hover:bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Bus className="w-4 h-4 text-emerald-400" />
              🚌 バス乗務員画面
            </span>
            {user.role === '運転手' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
          </button>

          {/* 保護者 */}
          <button
            type="button"
            onClick={() => handleSelectRole('保護者')}
            disabled={isSwitching}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
              user.role === '保護者'
                ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30'
                : 'hover:bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              👨‍👩‍👧 保護者予約画面
            </span>
            {user.role === '保護者' && <Check className="w-3.5 h-3.5 text-amber-400" />}
          </button>
        </div>
      )}
    </div>
  )
}
