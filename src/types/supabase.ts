export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'parent' | 'driver' | 'admin'
          created_at: string
          updated_at?: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: 'parent' | 'driver' | 'admin'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: 'parent' | 'driver' | 'admin'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      bus_routes: {
        Row: {
          id: string
          route_name: string
          driver_id: string | null
        }
        Insert: {
          id?: string
          route_name: string
          driver_id?: string | null
        }
        Update: {
          id?: string
          route_name?: string
          driver_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bus_routes_driver_id_fkey"
            columns: ["driver_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      bus_stops: {
        Row: {
          id: string
          bus_route_id: string
          stop_name: string
          arrival_time_morning: string | null
          order_index: number
        }
        Insert: {
          id?: string
          bus_route_id: string
          stop_name: string
          arrival_time_morning?: string | null
          order_index: number
        }
        Update: {
          id?: string
          bus_route_id?: string
          stop_name?: string
          arrival_time_morning?: string | null
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "bus_stops_bus_route_id_fkey"
            columns: ["bus_route_id"]
            referencedRelation: "bus_routes"
            referencedColumns: ["id"]
          }
        ]
      }
      students: {
        Row: {
          id: string
          student_code: string | null
          verification_code: string | null
          name: string
          grade: string | null
          class_name?: string | null
          parent_id: string | null
          household_id?: string | null
          bus_route_id: string | null
          default_bus_stop_id: string | null
          bus_stop_name?: string | null
          default_morning_ride: boolean
          default_afternoon_schedule: string | null
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          student_code?: string | null
          verification_code?: string | null
          name: string
          grade?: string | null
          class_name?: string | null
          parent_id?: string | null
          household_id?: string | null
          bus_route_id?: string | null
          default_bus_stop_id?: string | null
          bus_stop_name?: string | null
          default_morning_ride?: boolean
          default_afternoon_schedule?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_code?: string | null
          verification_code?: string | null
          name?: string
          grade?: string | null
          class_name?: string | null
          parent_id?: string | null
          household_id?: string | null
          bus_route_id?: string | null
          default_bus_stop_id?: string | null
          bus_stop_name?: string | null
          default_morning_ride?: boolean
          default_afternoon_schedule?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_bus_route_id_fkey"
            columns: ["bus_route_id"]
            referencedRelation: "bus_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_default_bus_stop_id_fkey"
            columns: ["default_bus_stop_id"]
            referencedRelation: "bus_stops"
            referencedColumns: ["id"]
          }
        ]
      }
      monthly_schedules: {
        Row: {
          id: string
          month: number
          shortened_day_of_week: number | null
          morning_trip_time: string
          trip_1_time: string | null
          trip_2_time: string | null
          trip_3_time: string | null
          trip_4_time: string | null
          trip_5_time: string | null
          wed_trip_1_time: string | null
          wed_trip_2_time: string | null
          wed_trip_3_time: string | null
          wed_trip_4_time: string | null
          wed_trip_5_time: string | null
          note: string | null
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          month: number
          shortened_day_of_week?: number | null
          morning_trip_time?: string
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
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          month?: number
          shortened_day_of_week?: number | null
          morning_trip_time?: string
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
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          id: string
          date: string
          category?: 'holiday' | 'closed' | 'temporary' | 'special'
          event_name: string
          is_operating?: boolean
          is_temporary_operation: boolean
          is_all_day_suspended: boolean
          is_morning_suspended: boolean
          is_afternoon_suspended: boolean
          morning_trip_time: string | null
          trip_1_time: string | null
          trip_2_time: string | null
          trip_3_time: string | null
          trip_4_time: string | null
          trip_5_time: string | null
          note: string | null
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          date: string
          category?: 'holiday' | 'closed' | 'temporary' | 'special'
          event_name: string
          is_operating?: boolean
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
        Update: {
          id?: string
          date?: string
          category?: 'holiday' | 'closed' | 'temporary' | 'special'
          event_name?: string
          is_operating?: boolean
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
        Relationships: []
      }
      daily_reservations: {
        Row: {
          id: string
          date: string
          student_id: string
          morning_ride: boolean
          afternoon_trip: string | null
          morning_boarded: boolean
          afternoon_boarded: boolean
          note: string | null
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          date: string
          student_id: string
          morning_ride?: boolean
          afternoon_trip?: string | null
          morning_boarded?: boolean
          afternoon_boarded?: boolean
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          date?: string
          student_id?: string
          morning_ride?: boolean
          afternoon_trip?: string | null
          morning_boarded?: boolean
          afternoon_boarded?: boolean
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_reservations_student_id_fkey"
            columns: ["student_id"]
            referencedRelation: "students"
            referencedColumns: ["id"]
          }
        ]
      }
      service_delays: {
        Row: {
          id: string
          date: string
          bus_route_id: string | null
          trip_name: string
          delay_minutes: number
          status: 'not_started' | 'running' | 'finished'
          message: string | null
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          date?: string
          bus_route_id?: string | null
          trip_name: string
          delay_minutes?: number
          status?: 'not_started' | 'running' | 'finished'
          message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          date?: string
          bus_route_id?: string | null
          trip_name?: string
          delay_minutes?: number
          status?: 'not_started' | 'running' | 'finished'
          message?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_delays_bus_route_id_fkey"
            columns: ["bus_route_id"]
            referencedRelation: "bus_routes"
            referencedColumns: ["id"]
          }
        ]
      }

      // --- 互換性テーブル/エイリアス ---
      monthly_trip_schedules: {
        Row: Database['public']['Tables']['monthly_schedules']['Row']
        Insert: Database['public']['Tables']['monthly_schedules']['Insert']
        Update: Database['public']['Tables']['monthly_schedules']['Update']
        Relationships: []
      }
      special_trip_schedules: {
        Row: {
          id: string
          date: string
          is_temporary_operation: boolean
          is_all_day_suspended: boolean
          is_morning_suspended: boolean
          is_afternoon_suspended: boolean
          morning_trip_time: string | null
          trip_1_time: string | null
          trip_2_time: string | null
          trip_3_time: string | null
          trip_4_time: string | null
          trip_5_time: string | null
          note: string | null
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
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
        Update: {
          id?: string
          date?: string
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
        Relationships: []
      }
      school_holidays: {
        Row: {
          id: string
          holiday_name: string
          start_date: string
          end_date: string
          holiday_type: string
          note: string | null
          created_at?: string
        }
        Insert: {
          id?: string
          holiday_name: string
          start_date: string
          end_date: string
          holiday_type?: string
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          holiday_name?: string
          start_date?: string
          end_date?: string
          holiday_type?: string
          note?: string | null
          created_at?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          id: string
          student_id: string
          date: string
          morning_status: boolean
          afternoon_schedule: string | null
          note: string | null
          updated_at?: string
        }
        Insert: {
          id?: string
          student_id: string
          date: string
          morning_status?: boolean
          afternoon_schedule?: string | null
          note?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          date?: string
          morning_status?: boolean
          afternoon_schedule?: string | null
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_student_id_fkey"
            columns: ["student_id"]
            referencedRelation: "students"
            referencedColumns: ["id"]
          }
        ]
      }
      ride_statuses: {
        Row: {
          id: string
          date: string
          student_id: string
          trip_name: string
          status: 'riding' | 'absent' | 'completed'
          updated_at?: string
        }
        Insert: {
          id?: string
          date: string
          student_id: string
          trip_name?: string
          status?: 'riding' | 'absent' | 'completed'
          updated_at?: string
        }
        Update: {
          id?: string
          date?: string
          student_id?: string
          trip_name?: string
          status?: 'riding' | 'absent' | 'completed'
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_statuses_student_id_fkey"
            columns: ["student_id"]
            referencedRelation: "students"
            referencedColumns: ["id"]
          }
        ]
      }
      bus_operations: {
        Row: {
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
        Insert: {
          id?: string
          bus_route_id?: string
          bus_id?: string
          date?: string
          operation_date?: string
          trip_name?: string
          trip_type?: string
          status?: 'not_started' | 'running' | 'finished' | 'on_time' | 'delayed' | 'arrived' | 'suspended'
          delay_minutes?: number
          message?: string | null
          note?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          bus_route_id?: string
          bus_id?: string
          date?: string
          operation_date?: string
          trip_name?: string
          trip_type?: string
          status?: 'not_started' | 'running' | 'finished' | 'on_time' | 'delayed' | 'arrived' | 'suspended'
          delay_minutes?: number
          message?: string | null
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bus_operations_bus_route_id_fkey"
            columns: ["bus_route_id"]
            referencedRelation: "bus_routes"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'parent' | 'driver' | 'admin'
      trip_type: '登校便' | '下校1便' | '下校2便' | '下校3便' | '下校4便' | '下校5便'
      operation_status: 'not_started' | 'running' | 'finished'
      calendar_category: 'holiday' | 'closed' | 'temporary' | 'special'
    }
  }
}
