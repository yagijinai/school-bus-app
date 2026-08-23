import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 簡易的なURLバリデーション
const isValidUrl = (url: string | undefined): boolean => {
  if (!url) return false
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// プレースホルダーのデフォルト値かどうかも含めて判定
export const isSupabaseConfigured = 
  isValidUrl(supabaseUrl) && 
  supabaseUrl !== 'your_supabase_url_here' &&
  !!supabaseAnonKey && 
  supabaseAnonKey !== 'your_supabase_anon_key_here'

if (!isSupabaseConfigured) {
  console.warn(
    '【スクールバス運行管理システム】\n' +
    'Supabaseの接続環境変数 (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) が未設定またはプレースホルダーです。\n' +
    'ローカルストレージを使用したデモモード（オフライン動作）で起動します。'
  )
}

// createClientがクラッシュするのを防ぐため、未設定時は安全なダミーURLをフォールバックとして使用
const dummyUrl = 'https://placeholder-project.supabase.co'
const dummyKey = 'placeholder-anon-key'

export const supabase = createClient<Database>(
  isSupabaseConfigured ? supabaseUrl! : dummyUrl,
  isSupabaseConfigured ? supabaseAnonKey! : dummyKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
)

export const hasSupabaseConfig = isSupabaseConfigured
