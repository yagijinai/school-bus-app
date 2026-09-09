/**
 * スクールバス運行管理システム - Googleスプレッドシート全6シート完全準拠 型定義
 */

// 1. シート名: 「生徒・保護者マスター」
// A列: 保護者メールアドレス / B〜E列: 生徒名１〜４ / F列: 登録バス停名 / G列: 備考 / H列: 基本_登校 / I列: 基本_下校
export interface GuardianMasterRow {
  parent_email: string
  student_names: string[] // B〜E列から非空の生徒名を抽出
  student_name_1?: string
  student_name_2?: string
  student_name_3?: string
  student_name_4?: string
  bus_stop_name: string
  note: string
  default_morning: string // 「乗る」または 空白
  default_afternoon: string // 「1便」「2便」「乗らない」等
}

// 2. シート名: 「バス停マスタ」
// A列: バス停名 / B列: 住所 / C列: 到着予定時刻（登校便） / D列: 停車順序
export interface BusStopRow {
  name: string
  address: string
  arrival_time_morning: string
  order: number
}

// 3. シート名: 「運行予定カレンダー」
// A: ID / B: 日付(YYYY/MM/DD) / C: 生徒名 / D: 登校ステータス / E: 下校ステータス / F: 下校1便 / G: 下校2便 / H: 下校3便 / I: 備考 / J: 更新日時 / K: 保護者メールアドレス
export interface ScheduleCalendarRow {
  id: number | string
  date: string // YYYY/MM/DD
  student_name: string
  morning_status: string // 「乗る」または 空白
  afternoon_status: string // 「乗らない」または 空白
  afternoon_trip_1: string
  afternoon_trip_2: string
  afternoon_trip_3: string
  note: string
  updated_at: string
  parent_email: string
}

// 4. シート名: 「基本設定・運休期間」
// A列: 設定名 / B列: 開始日（YYYY/MM/DD） / C列: 終了日（YYYY/MM/DD） / D列: 標準運行 / E列: 内容・時刻 / F列: 備考
export interface BasicSettingRow {
  setting_name: string
  start_date: string // YYYY/MM/DD
  end_date: string // YYYY/MM/DD
  standard_operation: string
  content_time: string
  note: string
}

// 5. シート名: 「学校用時刻表」
// A列: 日付（YYYY/MM/DD） / B列: 登校便 / C〜E列: 下校1〜3便 / F列: 備考 / G列: カレンダー表示用
export interface SchoolTimetableRow {
  date: string // YYYY/MM/DD
  morning_trip: string
  afternoon_trip_1: string
  afternoon_trip_2: string
  afternoon_trip_3: string
  note: string
  calendar_label: string
}

// 6. シート名: 「ユーザー権限マスタ」
// A列: メールアドレス / B列: 指名 / C列: 役割（管理者 / 運転手 / 保護者）
export type UserRole = '管理者' | '運転手' | '保護者'

export interface UserPermissionRow {
  email: string
  name: string
  role: UserRole
}

// 全マスタ一括取得（action: 'getAllMaster'）レスポンス
export interface AllMasterData {
  guardianMaster: GuardianMasterRow[]
  busStops: BusStopRow[]
  schedules: ScheduleCalendarRow[]
  basicSettings: BasicSettingRow[]
  schoolTimetable: SchoolTimetableRow[]
  userPermissions: UserPermissionRow[]
}

// ログインユーザー情報
export interface AuthUser {
  email: string
  name: string
  role: UserRole
}
