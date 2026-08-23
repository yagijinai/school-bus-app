import { supabase, isSupabaseConfigured } from '../supabaseClient'
import type { Database } from '../../types/supabase'

export type DailyReservationRow = Database['public']['Tables']['daily_reservations']['Row']
export type DailyReservationInsert = Database['public']['Tables']['daily_reservations']['Insert']
export type DailyReservationUpdate = Database['public']['Tables']['daily_reservations']['Update']

/**
 * 指定日の日別予約・乗車実績一覧を取得（ドライバー・管理者用）
 */
export async function fetchDailyReservations(date: string): Promise<DailyReservationRow[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('daily_reservations')
    .select('*')
    .eq('date', date)

  if (error) {
    console.error(`Error fetching daily reservations for ${date}:`, error)
    throw error
  }
  return data || []
}

/**
 * 生徒ID配列と期間指定で予約履歴を取得（保護者ダッシュボード用）
 */
export async function fetchReservationsByStudentIds(
  studentIds: string[],
  startDate: string,
  endDate: string
): Promise<DailyReservationRow[]> {
  if (!isSupabaseConfigured || studentIds.length === 0) return []

  const { data, error } = await supabase
    .from('daily_reservations')
    .select('*')
    .in('student_id', studentIds)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  if (error) {
    console.error('Error fetching reservations by student ids:', error)
    throw error
  }
  return data || []
}

/**
 * 予約の新規登録または更新 (Upsert)
 */
export async function upsertDailyReservation(
  reservation: DailyReservationInsert
): Promise<DailyReservationRow> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured')
  }

  const { data, error } = await supabase
    .from('daily_reservations')
    .upsert(reservation, { onConflict: 'date,student_id' })
    .select()
    .single()

  if (error) {
    console.error('Error upserting daily reservation:', error)
    throw error
  }
  return data
}

/**
 * 複数予約の一括保存（複数日/複数生徒の予約登録用）
 */
export async function bulkUpsertDailyReservations(
  reservations: DailyReservationInsert[]
): Promise<DailyReservationRow[]> {
  if (!isSupabaseConfigured || reservations.length === 0) return []

  const { data, error } = await supabase
    .from('daily_reservations')
    .upsert(reservations, { onConflict: 'date,student_id' })
    .select()

  if (error) {
    console.error('Error bulk upserting daily reservations:', error)
    throw error
  }
  return data || []
}

/**
 * 点呼・乗車済フラグの更新（ドライバー用）
 */
export async function updateBoardingStatus(
  date: string,
  studentId: string,
  updates: { morning_boarded?: boolean; afternoon_boarded?: boolean }
): Promise<DailyReservationRow> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured')
  }

  // レコードが存在しなければupsert、存在すれば更新
  const { data, error } = await supabase
    .from('daily_reservations')
    .upsert({
      date,
      student_id: studentId,
      ...updates
    }, { onConflict: 'date,student_id' })
    .select()
    .single()

  if (error) {
    console.error(`Error updating boarding status for student ${studentId} on ${date}:`, error)
    throw error
  }
  return data
}
