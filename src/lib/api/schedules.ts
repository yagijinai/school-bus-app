/**
 * 運行ダイヤ・カレンダーモジュール
 * Supabaseテーブルクエリを完全撤廃
 */

export type MonthlyScheduleRow = any
export type MonthlyScheduleInsert = any
export type CalendarEventRow = any
export type CalendarEventInsert = any

export async function fetchMonthlySchedules(): Promise<MonthlyScheduleRow[]> {
  return []
}

export async function fetchMonthlyScheduleByMonth(_month: number): Promise<MonthlyScheduleRow | null> {
  return null
}

export async function upsertMonthlySchedule(schedule: MonthlyScheduleInsert): Promise<MonthlyScheduleRow> {
  return schedule
}

export async function bulkUpsertMonthlySchedules(schedules: MonthlyScheduleInsert[]): Promise<MonthlyScheduleRow[]> {
  return schedules
}

export async function fetchCalendarEvents(_startDate?: string, _endDate?: string): Promise<CalendarEventRow[]> {
  return []
}

export async function fetchCalendarEventByDate(_date: string): Promise<CalendarEventRow | null> {
  return null
}

export async function upsertCalendarEvent(event: CalendarEventInsert): Promise<CalendarEventRow> {
  return event
}

export async function bulkUpsertCalendarEvents(events: CalendarEventInsert[]): Promise<CalendarEventRow[]> {
  return events
}

export async function deleteCalendarEvent(_id: string): Promise<void> {
  // no-op
}
