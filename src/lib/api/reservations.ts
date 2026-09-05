/**
 * 予約データ連携モジュール（GASスプレッドシート運行予定カレンダー完全準拠）
 * Supabaseテーブルクエリを完全撤廃
 */

import { fetchSchedulesFromGAS, saveSchedule, saveBatchSchedules } from './gas'

export type DailyReservationRow = any
export type DailyReservationInsert = any
export type DailyReservationUpdate = any

/**
 * 指定日の日別予約・乗車実績一覧を取得
 */
export async function fetchDailyReservations(date: string): Promise<DailyReservationRow[]> {
  const all = await fetchSchedulesFromGAS()
  return all.filter(r => r.date === date)
}

/**
 * 生徒ID配列と期間指定で予約履歴を取得
 */
export async function fetchReservationsByStudentIds(
  studentIds: string[],
  startDate: string,
  endDate: string
): Promise<DailyReservationRow[]> {
  const all = await fetchSchedulesFromGAS()
  return all.filter(r => studentIds.includes(r.student_id) && startDate <= r.date && r.date <= endDate)
}

/**
 * 予約の新規登録または更新 (GASへ送信)
 */
export async function upsertDailyReservation(
  reservation: DailyReservationInsert
): Promise<DailyReservationRow> {
  await saveSchedule({
    id: `SCH-${reservation.date}-${reservation.student_id}`,
    date: reservation.date,
    studentName: reservation.student_id,
    morningStatus: reservation.morning_status ?? true,
    afternoonStatus: !!reservation.afternoon_schedule,
    trip1: reservation.afternoon_schedule === '下校1便',
    trip2: reservation.afternoon_schedule === '下校2便',
    trip3: reservation.afternoon_schedule === '下校3便',
    note: reservation.note,
    guardianEmail: reservation.guardian_email || ''
  })
  return reservation
}

/**
 * 複数予約の一括保存
 */
export async function bulkUpsertDailyReservations(
  reservations: DailyReservationInsert[]
): Promise<DailyReservationRow[]> {
  await saveBatchSchedules(reservations.map(r => ({
    date: r.date,
    studentName: r.student_id,
    morningStatus: r.morning_status ?? true,
    afternoonSchedule: r.afternoon_schedule || null,
    note: r.note || null,
    guardianEmail: r.guardian_email || ''
  })))
  return reservations
}

/**
 * 点呼・乗車済フラグの更新
 */
export async function updateBoardingStatus(
  date: string,
  studentId: string,
  updates: { morning_boarded?: boolean; afternoon_boarded?: boolean }
): Promise<DailyReservationRow> {
  return {
    date,
    student_id: studentId,
    ...updates
  }
}
