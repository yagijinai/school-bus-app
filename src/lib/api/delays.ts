/**
 * 運行遅延・ステータスモジュール
 * Supabaseテーブルクエリを完全撤廃
 */

export interface ServiceDelayRow {
  id?: string
  date: string
  trip_name: string
  delay_minutes: number
  status: 'not_started' | 'running' | 'finished' | 'on_time' | 'delayed' | 'arrived' | 'suspended'
  message?: string | null
  updated_at?: string
}

export type ServiceDelayInsert = ServiceDelayRow
export type ServiceDelayUpdate = Partial<ServiceDelayRow>

/**
 * 指定日（デフォルト本日）の運行遅延・ステータス一覧を取得
 */
export async function fetchServiceDelays(_date?: string): Promise<ServiceDelayRow[]> {
  return []
}

/**
 * 遅延分数・運行ステータスの更新
 */
export async function updateServiceDelay(
  tripName: string,
  delayMinutes: number,
  status: 'not_started' | 'running' | 'finished' = 'running',
  message?: string,
  date?: string
): Promise<ServiceDelayRow> {
  const targetDate = date || new Date().toISOString().split('T')[0]
  return {
    date: targetDate,
    trip_name: tripName,
    delay_minutes: delayMinutes,
    status,
    message: message || null,
    updated_at: new Date().toISOString()
  }
}

/**
 * リアルタイム監視（Supabase Realtime は完全無効化）
 */
export function subscribeToServiceDelays(
  _onUpdate: (delay: ServiceDelayRow) => void
): null {
  return null
}
