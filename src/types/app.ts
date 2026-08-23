import type { Database } from './supabase'

export type UserRole = Database['public']['Tables']['users']['Row']['role']
export type UserProfile = Database['public']['Tables']['users']['Row']
export type Student = Database['public']['Tables']['students']['Row']
export type BusRoute = Database['public']['Tables']['bus_routes']['Row']
export type BusStop = Database['public']['Tables']['bus_stops']['Row']

// データベース新テーブル型
export type MonthlySchedule = Database['public']['Tables']['monthly_schedules']['Row']
export type CalendarEvent = Database['public']['Tables']['calendar_events']['Row']
export type DailyReservation = Database['public']['Tables']['daily_reservations']['Row']
export type ServiceDelay = Database['public']['Tables']['service_delays']['Row']

// 互換性エイリアス型
export type RideStatus = Database['public']['Tables']['ride_statuses']['Row']
export type BusOperation = Database['public']['Tables']['bus_operations']['Row']
export type MonthlyTripSchedule = Database['public']['Tables']['monthly_trip_schedules']['Row']
export type SpecialTripSchedule = Database['public']['Tables']['special_trip_schedules']['Row']
export type SchoolHoliday = Database['public']['Tables']['school_holidays']['Row']
export type Reservation = Database['public']['Tables']['reservations']['Row']

// UI and joined queries helpers
export interface StudentWithDetails extends Student {
  bus_route?: BusRoute | null
  bus_stop?: BusStop | null
}

export interface ReservationWithStudent extends Reservation {
  student?: Student | null
}

export interface DailyReservationWithStudent extends DailyReservation {
  student?: Student | null
}

export interface RideStatusWithStudent extends RideStatus {
  student?: Student | null
}

export interface BusRouteWithDriverAndStops extends BusRoute {
  driver?: UserProfile | null
  stops?: BusStop[]
}
