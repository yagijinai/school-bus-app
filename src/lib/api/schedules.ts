import { supabase, isSupabaseConfigured } from '../supabaseClient'
import type { Database } from '../../types/supabase'

export type MonthlyScheduleRow = Database['public']['Tables']['monthly_schedules']['Row']
export type MonthlyScheduleInsert = Database['public']['Tables']['monthly_schedules']['Insert']

export type CalendarEventRow = Database['public']['Tables']['calendar_events']['Row']
export type CalendarEventInsert = Database['public']['Tables']['calendar_events']['Insert']

// ==========================================
// 1. 月別ダイヤ (Monthly Schedules)
// ==========================================

/**
 * 全ての月別ダイヤ (1〜12月) を取得
 */
export async function fetchMonthlySchedules(): Promise<MonthlyScheduleRow[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('monthly_schedules')
    .select('*')
    .order('month', { ascending: true })

  if (error) {
    console.error('Error fetching monthly schedules:', error)
    throw error
  }
  return data || []
}

/**
 * 対象月の月別ダイヤを取得
 */
export async function fetchMonthlyScheduleByMonth(month: number): Promise<MonthlyScheduleRow | null> {
  if (!isSupabaseConfigured) return null

  const { data, error } = await supabase
    .from('monthly_schedules')
    .select('*')
    .eq('month', month)
    .maybeSingle()

  if (error) {
    console.error(`Error fetching monthly schedule for month ${month}:`, error)
    throw error
  }
  return data
}

/**
 * 月別ダイヤの新規作成または更新 (Upsert)
 */
export async function upsertMonthlySchedule(schedule: MonthlyScheduleInsert): Promise<MonthlyScheduleRow> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured')
  }

  const { data, error } = await supabase
    .from('monthly_schedules')
    .upsert(schedule, { onConflict: 'month' })
    .select()
    .single()

  if (error) {
    console.error('Error upserting monthly schedule:', error)
    throw error
  }
  return data
}

/**
 * 12ヶ月分の月別ダイヤを一括保存
 */
export async function bulkUpsertMonthlySchedules(schedules: MonthlyScheduleInsert[]): Promise<MonthlyScheduleRow[]> {
  if (!isSupabaseConfigured || schedules.length === 0) return []

  const { data, error } = await supabase
    .from('monthly_schedules')
    .upsert(schedules, { onConflict: 'month' })
    .select()

  if (error) {
    console.error('Error bulk upserting monthly schedules:', error)
    throw error
  }
  return data || []
}

// ==========================================
// 2. 運行カレンダー・特別日 (Calendar Events)
// ==========================================

/**
 * 運行カレンダーイベント・特別日一覧を取得（オプションで期間指定可）
 */
export async function fetchCalendarEvents(startDate?: string, endDate?: string): Promise<CalendarEventRow[]> {
  if (!isSupabaseConfigured) return []

  let query = supabase
    .from('calendar_events')
    .select('*')
    .order('date', { ascending: true })

  if (startDate) {
    query = query.gte('date', startDate)
  }
  if (endDate) {
    query = query.lte('date', endDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching calendar events:', error)
    throw error
  }
  return data || []
}

/**
 * 日付指定で特定日の運行設定を取得
 */
export async function fetchCalendarEventByDate(date: string): Promise<CalendarEventRow | null> {
  if (!isSupabaseConfigured) return null

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('date', date)
    .maybeSingle()

  if (error) {
    console.error(`Error fetching calendar event for ${date}:`, error)
    throw error
  }
  return data
}

/**
 * 運行カレンダーイベントの作成または更新 (Upsert)
 */
export async function upsertCalendarEvent(event: CalendarEventInsert): Promise<CalendarEventRow> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured')
  }

  const { data, error } = await supabase
    .from('calendar_events')
    .upsert(event, { onConflict: 'date' })
    .select()
    .single()

  if (error) {
    console.error('Error upserting calendar event:', error)
    throw error
  }
  return data
}

/**
 * 運行カレンダーイベントの一括保存
 */
export async function bulkUpsertCalendarEvents(events: CalendarEventInsert[]): Promise<CalendarEventRow[]> {
  if (!isSupabaseConfigured || events.length === 0) return []

  const { data, error } = await supabase
    .from('calendar_events')
    .upsert(events, { onConflict: 'date' })
    .select()

  if (error) {
    console.error('Error bulk upserting calendar events:', error)
    throw error
  }
  return data || []
}

/**
 * 運行カレンダーイベントの削除
 */
export async function deleteCalendarEvent(id: string): Promise<void> {
  if (!isSupabaseConfigured) return

  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', id)

  if (error) {
    console.error(`Error deleting calendar event ${id}:`, error)
    throw error
  }
}
