// Google スプレッドシート完全準拠の型定義

/**
 * 1. 「生徒・保護者マスター」
 * A: 保護者メールアドレス / B: 生徒名１ / C: 生徒名２ / D: 生徒名３ / E: 生徒名４ / F: 登録バス停名 / G: 備考 / H: 基本_登校 / I: 基本_下校
 */
export interface GuardianMasterRow {
  email: string
  student_name_1: string
  student_name_2?: string | null
  student_name_3?: string | null
  student_name_4?: string | null
  bus_stop_name: string
  note?: string | null
  default_morning: string // '乗る' | '乗らない'
  default_afternoon: string // '1便' | '2便' | '3便' | '乗らない'
}

/**
 * 2. 「バス停マスタ」
 * A: バス停名 / B: 住所 / C: 到着予定時刻（登校便） / D: 停車順序
 */
export interface BusStopMasterRow {
  stop_name: string
  address: string
  arrival_time_morning: string
  order_index: number
}

/**
 * 3. 「運行予定カレンダー」
 * A: ID / B: 日付 / C: 生徒名 / D: 登校ステータス / E: 下校ステータス / F: 下校1便 / G: 下校2便 / H: 下校3便 / I: 備考 / J: 更新日時 / K: 保護者メールアドレス
 */
export interface OperationScheduleRow {
  id: string
  date: string
  student_name: string
  morning_status: string // '乗車' | '欠席' | '乗る' | '乗らない'
  afternoon_status: string // '乗車' | '欠席' | '乗る' | '乗らない'
  trip_1?: string | boolean | null // 下校1便
  trip_2?: string | boolean | null // 下校2便
  trip_3?: string | boolean | null // 下校3便
  note?: string | null
  updated_at: string
  guardian_email: string
}

/**
 * 4. 「基本設定・運休期間」
 * A: 設定名 / B: 開始日 / C: 終了日 / D: 標準運行 / E: 内容・時刻 / F: 備考
 */
export interface BasicSettingPeriodRow {
  setting_name: string
  start_date: string
  end_date: string
  standard_operation: string
  content_time: string
  note?: string | null
}

/**
 * 5. 「学校用時刻表」
 * A: 日付 / B: 登校便 / C: 下校1便 / D: 下校2便 / E: 下校3便 / F: 備考 / G: カレンダー表示用
 */
export interface SchoolTimetableRow {
  date: string
  morning_trip: string
  trip_1: string
  trip_2: string
  trip_3: string
  note?: string | null
  calendar_display?: string | null
}

/**
 * 6. 「ユーザー権限マスタ」
 * A: メールアドレス / B: 指名 / C: 役割
 */
export interface UserPermissionRow {
  email: string
  name: string
  role: 'parent' | 'driver' | 'admin'
}

// アプリケーション内部で利用する統一インターフェース定義
export type UserRole = 'parent' | 'driver' | 'admin'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: UserRole
  created_at: string
}

export interface Student {
  id: string
  student_code?: string | null
  verification_code?: string | null
  name: string
  grade?: string | null
  class_name?: string | null
  household_id?: string | null
  parent_id?: string | null
  bus_route_id?: string | null
  default_bus_stop_id?: string | null
  bus_stop_name?: string | null
  default_morning_ride?: boolean
  default_afternoon_schedule?: string | null
  parent_email?: string | null
}

export interface BusRoute {
  id: string
  route_name: string
  driver_id?: string | null
}

export interface BusStop {
  id: string
  bus_route_id?: string | null
  stop_name: string
  address?: string | null
  arrival_time_morning: string
  order_index: number
}

export interface Reservation {
  id: string
  student_id: string
  student_name?: string
  date: string
  morning_status: boolean
  afternoon_schedule: string | null
  trip_1?: boolean
  trip_2?: boolean
  trip_3?: boolean
  note: string | null
  guardian_email?: string
  updated_at: string
}

export interface BusOperation {
  id: string
  bus_route_id?: string
  bus_id?: string
  date: string
  operation_date?: string
  trip_name: string
  trip_type?: string
  status: 'not_started' | 'running' | 'finished' | 'on_time' | 'delayed' | 'arrived' | 'suspended'
  delay_minutes: number
  message?: string | null
  note?: string | null
  updated_at?: string
}

export interface RideStatus {
  id: string
  student_id: string
  date: string
  trip_name: string
  status: 'riding' | 'absent' | 'completed'
  updated_at: string
}

export interface MonthlyTripSchedule {
  id: string
  month: number
  shortened_day_of_week?: number | null
  morning_trip_time?: string | null
  trip_1_time?: string | null
  trip_2_time?: string | null
  trip_3_time?: string | null
  trip_4_time?: string | null
  trip_5_time?: string | null
  wed_trip_1_time?: string | null
  wed_trip_2_time?: string | null
  wed_trip_3_time?: string | null
  wed_trip_4_time?: string | null
  wed_trip_5_time?: string | null
  note?: string | null
}

export interface SpecialTripSchedule {
  id: string
  date: string
  is_temporary_operation?: boolean
  is_all_day_suspended?: boolean
  is_morning_suspended?: boolean
  is_afternoon_suspended?: boolean
  morning_trip_time?: string | null
  trip_1_time?: string | null
  trip_2_time?: string | null
  trip_3_time?: string | null
  trip_4_time?: string | null
  trip_5_time?: string | null
  note?: string | null
  created_at?: string
  updated_at?: string
}

export interface SchoolHoliday {
  id: string
  holiday_name: string
  start_date: string
  end_date: string
  holiday_type?: string | null
  standard_operation?: string | null
  content_time?: string | null
  note?: string | null
  created_at?: string
}
