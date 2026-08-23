import { supabase, isSupabaseConfigured } from '../supabaseClient'
import type { Database } from '../../types/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type ServiceDelayRow = Database['public']['Tables']['service_delays']['Row']
export type ServiceDelayInsert = Database['public']['Tables']['service_delays']['Insert']
export type ServiceDelayUpdate = Database['public']['Tables']['service_delays']['Update']

/**
 * 指定日（デフォルト本日）の運行遅延・ステータス一覧を取得
 */
export async function fetchServiceDelays(date?: string): Promise<ServiceDelayRow[]> {
  if (!isSupabaseConfigured) return []

  const targetDate = date || new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('service_delays')
    .select('*')
    .eq('date', targetDate)
    .order('created_at', { ascending: true })

  if (error) {
    console.error(`Error fetching service delays for ${targetDate}:`, error)
    throw error
  }
  return data || []
}

/**
 * 遅延分数・運行ステータスの更新（ドライバー・管理者用）
 */
export async function updateServiceDelay(
  tripName: string,
  delayMinutes: number,
  status: 'not_started' | 'running' | 'finished' = 'running',
  message?: string,
  date?: string
): Promise<ServiceDelayRow> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured')
  }

  const targetDate = date || new Date().toISOString().split('T')[0]

  const payload: ServiceDelayInsert = {
    date: targetDate,
    trip_name: tripName,
    delay_minutes: delayMinutes,
    status,
    message: message || null,
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('service_delays')
    .upsert(payload, { onConflict: 'date,trip_name' })
    .select()
    .single()

  if (error) {
    console.error(`Error updating service delay for ${tripName}:`, error)
    throw error
  }
  return data
}

/**
 * Supabase Realtimeで運行遅延状況の変更をリアルタイム監視
 */
export function subscribeToServiceDelays(
  onUpdate: (delay: ServiceDelayRow) => void
): RealtimeChannel | null {
  if (!isSupabaseConfigured) return null

  const channel = supabase
    .channel('public:service_delays')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'service_delays'
      },
      (payload) => {
        if (payload.new && typeof payload.new === 'object') {
          onUpdate(payload.new as ServiceDelayRow)
        }
      }
    )
    .subscribe()

  return channel
}
