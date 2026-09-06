import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Bus, User, ShieldCheck, ArrowRight } from 'lucide-react'
import type { UserRole } from '../types/app'

export const RoleSelect: React.FC = () => {
  const navigate = useNavigate()
  const { user, profile, selectRole } = useAuth()

  const email = user?.email || (user as any)?.user_metadata?.email || 'yagijinai@gmail.com'
  const name = profile?.full_name || (user as any)?.user_metadata?.full_name || (email === 'yagijinai@gmail.com' ? 'てつ' : email.split('@')[0])

  const handleSelectRole = async (role: UserRole) => {
    if (selectRole) {
      await selectRole(role)
    }
    if (role === 'parent') {
      navigate('/parent/dashboard')
    } else if (role === 'driver') {
      navigate('/driver/dashboard')
    } else if (role === 'admin') {
      navigate('/admin/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-10 sm:px-6 lg:px-8 relative overflow-hidden text-slate-100 font-sans">
      {/* 背景装飾 */}
      <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-xl z-10 text-center px-4">
        <div className="inline-flex p-3 bg-gradient-to-tr from-amber-500 to-orange-500 rounded-2xl shadow-xl shadow-amber-500/20 mb-3">
          <Bus className="h-8 w-8 text-slate-950" />
        </div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
          ご利用の役割を選択してください
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-slate-400">
          ログイン中のアカウント: <strong className="text-amber-400">{name} 様</strong> ({email})
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl z-10 px-4 space-y-4">
        {/* 1. 保護者カード */}
        <button
          type="button"
          onClick={() => handleSelectRole('parent')}
          className="w-full p-5 bg-slate-900/90 hover:bg-slate-850/90 active:scale-[0.99] border-2 border-indigo-500/40 hover:border-indigo-500 rounded-3xl transition-all text-left flex items-center justify-between group shadow-xl shadow-indigo-950/20"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-3.5 rounded-2xl bg-indigo-500/20 text-indigo-400 shrink-0 group-hover:scale-105 transition-transform">
              <User className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black text-white">
                  保護者の方
                </span>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold border border-indigo-500/30">
                  推奨
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                毎日のスクールバス乗車・下校便の予約、運行状況・遅延の確認
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-indigo-400 group-hover:translate-x-1.5 transition-transform shrink-0" />
        </button>

        {/* 2. バス運転手カード */}
        <button
          type="button"
          onClick={() => handleSelectRole('driver')}
          className="w-full p-5 bg-slate-900/90 hover:bg-slate-850/90 active:scale-[0.99] border border-slate-800 hover:border-emerald-500/60 rounded-3xl transition-all text-left flex items-center justify-between group shadow-xl"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-3.5 rounded-2xl bg-emerald-500/20 text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
              <Bus className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <span className="text-base sm:text-lg font-black text-white block">
                スクールバス乗務員
              </span>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                乗車点呼・出席確認、バス運行ステータス（運行中/到着/遅延）の更新
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1.5 transition-transform shrink-0" />
        </button>

        {/* 3. 学校管理者カード */}
        <button
          type="button"
          onClick={() => handleSelectRole('admin')}
          className="w-full p-5 bg-slate-900/90 hover:bg-slate-850/90 active:scale-[0.99] border border-slate-800 hover:border-purple-500/60 rounded-3xl transition-all text-left flex items-center justify-between group shadow-xl"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-3.5 rounded-2xl bg-purple-500/20 text-purple-400 shrink-0 group-hover:scale-105 transition-transform">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <span className="text-base sm:text-lg font-black text-white block">
                学校管理者
              </span>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                全ルート運行モニター、生徒マスター・行事予定・特別ダイヤの管理
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-1.5 transition-transform shrink-0" />
        </button>
      </div>
    </div>
  )
}
