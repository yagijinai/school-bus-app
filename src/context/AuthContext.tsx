import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase, hasSupabaseConfig } from '../lib/supabaseClient'
import type { UserProfile, UserRole, Reservation, BusOperation, RideStatus, BusRoute, BusStop, Student, MonthlyTripSchedule, SpecialTripSchedule, SchoolHoliday } from '../types/app'
import type { User } from '@supabase/supabase-js'
import { mockStudents, mockBusOperations, mockBusRoutes, mockBusStops, mockMonthlyTripSchedules, mockSpecialTripSchedules, mockSchoolHolidays } from '../lib/mockData'
import { getJapaneseHolidayName } from '../lib/holidays'

export interface DateScheduleStatus {
  date: string
  type: 'special' | 'holiday' | 'school_break' | 'shortened' | 'regular'
  label: string
  isSuspended: boolean
  isMorningSuspended: boolean
  isAfternoonSuspended: boolean
  specialSchedule?: SpecialTripSchedule | null
  holidayName?: string | null
  note?: string
}

interface AuthContextType {
  user: User | MockUser | null
  profile: UserProfile | null
  loading: boolean
  isRegistered: boolean
  isDemoMode: boolean
  isRealtimeConnected: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  signInDemoUser: (role: 'parent' | 'driver' | 'admin', isNew?: boolean) => void
  loginAsParent: (studentCode: string, verificationCode: string) => Promise<{ success: boolean; error?: string }>
  loginAsDriver: (pinCode?: string) => Promise<{ success: boolean; error?: string }>
  loginAsAdmin: (password: string) => Promise<{ success: boolean; error?: string }>
  verifyStudentForRegistration: (studentCode: string, verificationCode: string) => Promise<{ success: boolean; student?: Student; error?: string }>
  registerParentProfile: (fullName: string, students: { studentId?: string; name: string; routeId: string; stopId: string; defaultMorningRide: boolean; defaultAfternoonSchedule: string | null }[]) => Promise<boolean>
  
  // 拡張データとアクション
  busRoutes: BusRoute[]
  busStops: BusStop[]
  students: Student[]
  reservations: Reservation[]
  busOperations: BusOperation[]
  rideStatuses: RideStatus[]
  monthlyTripSchedules: MonthlyTripSchedule[]
  specialTripSchedules: SpecialTripSchedule[]
  schoolHolidays: SchoolHoliday[]
  getDateScheduleStatus: (dateStr: string) => DateScheduleStatus
  getTripTime: (tripName: string, dateOrMonth?: string | number, forceIsShortened?: boolean) => string
  getAdjustedStopArrivalTime: (stop: BusStop, dateOrMonth?: string | number) => string
  isTripOperating: (tripName: string, dateOrMonth?: string | number, forceIsShortened?: boolean) => boolean
  getShortenedDayOfWeek: (dateOrMonth?: string | number) => number | null
  updateMonthlyTripSchedule: (month: number, updates: Partial<MonthlyTripSchedule>) => Promise<boolean>
  resetMonthlyTripSchedulesToDefault: () => Promise<boolean>
  copySchoolHolidaysToNextYear: (baseYear?: number) => Promise<number>
  
  // 特定日例外ダイヤCRUD
  saveSpecialTripSchedule: (data: Omit<SpecialTripSchedule, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => Promise<boolean>
  deleteSpecialTripSchedule: (date: string) => Promise<boolean>

  // 長期休業・運休期間CRUD
  addSchoolHoliday: (data: Omit<SchoolHoliday, 'id' | 'created_at'>) => Promise<SchoolHoliday>
  updateSchoolHoliday: (id: string, updates: Partial<SchoolHoliday>) => Promise<boolean>
  deleteSchoolHoliday: (id: string) => Promise<boolean>
  
  // マスタ管理アクション
  addStudent: (student: Omit<Student, 'id'>) => Promise<Student>
  updateStudent: (id: string, updates: Partial<Student>) => Promise<boolean>
  deleteStudent: (id: string) => Promise<boolean>
  
  addBusStop: (busStop: Omit<BusStop, 'id'>) => Promise<BusStop>
  updateBusStop: (id: string, updates: Partial<BusStop>) => Promise<boolean>
  deleteBusStop: (id: string) => Promise<boolean>
  reorderBusStops: (orderedStopIds: string[]) => Promise<boolean>

  updateOperation: (routeId: string, tripName: string, status: 'not_started' | 'running' | 'finished', delayMinutes: number) => Promise<void>
  updateBusOperationStatus: (date: string, tripName: string, status: 'on_time' | 'delayed' | 'arrived' | 'suspended' | 'not_started' | 'running' | 'finished', delayMinutes: number, message?: string | null, routeId?: string) => Promise<boolean>
  saveReservation: (studentId: string, date: string, morningStatus: boolean, afternoonSchedule: string | null, note: string | null) => Promise<boolean>
  saveWeeklyReservations: (studentId: string, items: { date: string; morningStatus: boolean; afternoonSchedule: string | null; note: string | null }[]) => Promise<boolean>
  generateNextMonthReservations: (studentId: string, defaultMorning: boolean, defaultAfternoon: string | null) => Promise<number>
  updateStudentRideStatus: (studentId: string, date: string, tripName: string, status: 'riding' | 'absent' | 'completed') => Promise<void>
  refreshData: () => Promise<void>
}

export interface MockUser {
  id: string
  email: string
  user_metadata: {
    full_name?: string
    avatar_url?: string
  }
}

// デモユーザー用のデータ定義
const DEMO_PROFILES: Record<string, UserProfile> = {
  'parent-demo-id': {
    id: 'parent-demo-id',
    email: 'parent@example.com',
    full_name: '山田 保護者（花子・太郎）',
    role: 'parent',
    created_at: new Date().toISOString()
  },
  'parent-sato-id': {
    id: 'parent-sato-id',
    email: 'sato@example.com',
    full_name: '佐藤 保護者（結衣・陽斗）',
    role: 'parent',
    created_at: new Date().toISOString()
  },
  'parent-suzuki-id': {
    id: 'parent-suzuki-id',
    email: 'suzuki@example.com',
    full_name: '鈴木 保護者（陸）',
    role: 'parent',
    created_at: new Date().toISOString()
  },
  'parent-takahashi-id': {
    id: 'parent-takahashi-id',
    email: 'takahashi@example.com',
    full_name: '高橋 保護者（葵）',
    role: 'parent',
    created_at: new Date().toISOString()
  },
  'driver-demo-id': {
    id: 'driver-demo-id',
    email: 'driver@example.com',
    full_name: 'バス運転手 一郎',
    role: 'driver',
    created_at: new Date().toISOString()
  },
  'admin-demo-id': {
    id: 'admin-demo-id',
    email: 'admin@example.com',
    full_name: '学校管理者 哲司',
    role: 'admin',
    created_at: new Date().toISOString()
  }
}

// LocalStorage 永続化キーの定義
const STORAGE_KEYS = {
  STUDENTS: 'school_bus_students_master_v1',
  MONTHLY_SCHEDULES: 'school_bus_monthly_schedules_v1',
  SPECIAL_SCHEDULES: 'school_bus_special_schedules_v1',
  HOLIDAYS: 'school_bus_holidays_v1',
  ROUTES: 'school_bus_routes_v1',
  STOPS: 'school_bus_stops_v1',
  RESERVATIONS: 'school_bus_reservations_v1',
  OPERATIONS: 'school_bus_operations_v1',
  RIDE_STATUSES: 'school_bus_ride_statuses_v1'
}

const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key)
    if (item) {
      return JSON.parse(item) as T
    }
  } catch (e) {
    console.error(`Failed to load ${key} from localStorage`, e)
  }
  return defaultValue
}

const saveToStorage = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error(`Failed to save ${key} to localStorage`, e)
  }
}

// デモ用生徒データ
export const DEMO_STUDENTS: Student[] = mockStudents

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | MockUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false)
  
  // 状態管理の追加 (LocalStorage 優先の初期化)
  const [busRoutes, setBusRoutes] = useState<BusRoute[]>(() => loadFromStorage(STORAGE_KEYS.ROUTES, mockBusRoutes))
  const [busStops, setBusStops] = useState<BusStop[]>(() => loadFromStorage(STORAGE_KEYS.STOPS, mockBusStops))
  const [students, setStudents] = useState<Student[]>(() => loadFromStorage(STORAGE_KEYS.STUDENTS, mockStudents))
  const [reservations, setReservations] = useState<Reservation[]>(() => loadFromStorage(STORAGE_KEYS.RESERVATIONS, []))
  const [busOperations, setBusOperations] = useState<BusOperation[]>(() => loadFromStorage(STORAGE_KEYS.OPERATIONS, mockBusOperations))
  const [rideStatuses, setRideStatuses] = useState<RideStatus[]>(() => loadFromStorage(STORAGE_KEYS.RIDE_STATUSES, []))
  const [monthlyTripSchedules, setMonthlyTripSchedules] = useState<MonthlyTripSchedule[]>(() => loadFromStorage(STORAGE_KEYS.MONTHLY_SCHEDULES, mockMonthlyTripSchedules))
  const [specialTripSchedules, setSpecialTripSchedules] = useState<SpecialTripSchedule[]>(() => loadFromStorage(STORAGE_KEYS.SPECIAL_SCHEDULES, mockSpecialTripSchedules))
  const [schoolHolidays, setSchoolHolidays] = useState<SchoolHoliday[]>(() => loadFromStorage(STORAGE_KEYS.HOLIDAYS, mockSchoolHolidays))

  // 各ステート変更時に LocalStorage へ即時自動永続化
  useEffect(() => { saveToStorage(STORAGE_KEYS.STUDENTS, students) }, [students])
  useEffect(() => { saveToStorage(STORAGE_KEYS.MONTHLY_SCHEDULES, monthlyTripSchedules) }, [monthlyTripSchedules])
  useEffect(() => { saveToStorage(STORAGE_KEYS.SPECIAL_SCHEDULES, specialTripSchedules) }, [specialTripSchedules])
  useEffect(() => { saveToStorage(STORAGE_KEYS.HOLIDAYS, schoolHolidays) }, [schoolHolidays])
  useEffect(() => { saveToStorage(STORAGE_KEYS.ROUTES, busRoutes) }, [busRoutes])
  useEffect(() => { saveToStorage(STORAGE_KEYS.STOPS, busStops) }, [busStops])
  useEffect(() => { saveToStorage(STORAGE_KEYS.RESERVATIONS, reservations) }, [reservations])
  useEffect(() => { saveToStorage(STORAGE_KEYS.OPERATIONS, busOperations) }, [busOperations])
  useEffect(() => { saveToStorage(STORAGE_KEYS.RIDE_STATUSES, rideStatuses) }, [rideStatuses])

  // 別タブ・別ウィンドウ間での即時データ同期（storageイベント連動）
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key || !e.newValue) return
      try {
        const parsed = JSON.parse(e.newValue)
        if (e.key === STORAGE_KEYS.OPERATIONS) setBusOperations(parsed)
        else if (e.key === STORAGE_KEYS.RIDE_STATUSES) setRideStatuses(parsed)
        else if (e.key === STORAGE_KEYS.RESERVATIONS) setReservations(parsed)
        else if (e.key === STORAGE_KEYS.STUDENTS) setStudents(parsed)
        else if (e.key === STORAGE_KEYS.MONTHLY_SCHEDULES) setMonthlyTripSchedules(parsed)
        else if (e.key === STORAGE_KEYS.SPECIAL_SCHEDULES) setSpecialTripSchedules(parsed)
        else if (e.key === STORAGE_KEYS.HOLIDAYS) setSchoolHolidays(parsed)
        else if (e.key === STORAGE_KEYS.STOPS) setBusStops(parsed)
        else if (e.key === STORAGE_KEYS.ROUTES) setBusRoutes(parsed)
      } catch (err) {
        console.error('Storage sync parse error:', err)
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  useEffect(() => {
    // 認証セッションの初期読み込み（LocalStorageセッション + Supabase Auth）
    const initAuth = async () => {
      try {
        // 1. まずローカルに保存されたロール別セッションを復帰チェック
        const savedSessionStr = localStorage.getItem('school_bus_active_session_v1')
        if (savedSessionStr) {
          try {
            const saved = JSON.parse(savedSessionStr)
            if (saved && saved.user && saved.profile) {
              setUser(saved.user)
              setProfile(saved.profile)
              if (hasSupabaseConfig) {
                await fetchMasterData()
                await fetchDatabaseData(saved.user.id, saved.profile)
              }
              setLoading(false)
              return
            }
          } catch (e) {
            console.error('Failed to parse saved session:', e)
          }
        }

        if (!hasSupabaseConfig) {
          console.log('Running in Standalone/Demo Mode (No Supabase configured).')
          setIsDemoMode(true)
          setLoading(false)
          return
        }

        // 2. Supabase Authセッションのチェック
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setUser(session.user)
          const userProfile = await fetchUserProfile(session.user.id)
          await fetchMasterData()
          if (userProfile) {
            await fetchDatabaseData(session.user.id, userProfile)
          }
        } else {
          setUser(null)
          setProfile(null)
        }
      } catch (err) {
        console.error('Auth initialization error:', err)
        setIsDemoMode(true)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setLoading(true)
      if (session?.user) {
        setUser(session.user)
        const userProfile = await fetchUserProfile(session.user.id)
        await fetchMasterData()
        if (userProfile) {
          await fetchDatabaseData(session.user.id, userProfile)
        }
      } else {
        setUser(null)
        setProfile(null)
        setReservations([])
        setRideStatuses([])
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [hasSupabaseConfig])

  // Supabase Realtimeチャンネルによる複数テーブルの双方向即時同期
  useEffect(() => {
    if (!hasSupabaseConfig || isDemoMode || !user) {
      setIsRealtimeConnected(false)
      return
    }

    console.log('Initializing Supabase Realtime channel subscription...')
    const channel = supabase
      .channel('school-bus-realtime-sync')
      // 1. 予約の変更（reservations / daily_reservations）
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        (payload) => {
          console.log('[Realtime] reservations payload:', payload.eventType, payload.new)
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const updated = payload.new as Reservation
            setReservations(prev => {
              const idx = prev.findIndex(r => r.id === updated.id || (r.student_id === updated.student_id && r.date === updated.date))
              if (idx >= 0) {
                const next = [...prev]
                next[idx] = updated
                return next
              }
              return [...prev, updated]
            })
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.id
            if (oldId) {
              setReservations(prev => prev.filter(r => r.id !== oldId))
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_reservations' },
        (payload) => {
          console.log('[Realtime] daily_reservations payload:', payload.eventType, payload.new)
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as any
            const mapped: Reservation = {
              id: row.id,
              student_id: row.student_id,
              date: row.date,
              morning_status: row.morning_ride,
              afternoon_schedule: row.afternoon_trip,
              note: row.note,
              updated_at: row.updated_at || new Date().toISOString()
            }
            setReservations(prev => {
              const idx = prev.findIndex(r => r.id === mapped.id || (r.student_id === mapped.student_id && r.date === mapped.date))
              if (idx >= 0) {
                const next = [...prev]
                next[idx] = mapped
                return next
              }
              return [...prev, mapped]
            })
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.id
            if (oldId) {
              setReservations(prev => prev.filter(r => r.id !== oldId))
            }
          }
        }
      )
      // 2. 点呼・乗車記録の変更（ride_statuses / boarding_logs）
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ride_statuses' },
        (payload) => {
          console.log('[Realtime] ride_statuses payload:', payload.eventType, payload.new)
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const updated = payload.new as RideStatus
            setRideStatuses(prev => {
              const idx = prev.findIndex(r => r.id === updated.id || (r.student_id === updated.student_id && r.date === updated.date && r.trip_name === updated.trip_name))
              if (idx >= 0) {
                const next = [...prev]
                next[idx] = updated
                return next
              }
              return [...prev, updated]
            })
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.id
            if (oldId) {
              setRideStatuses(prev => prev.filter(r => r.id !== oldId))
            }
          }
        }
      )
      // 3. 運行状況・遅延分数の変更（bus_operations / service_delays）
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bus_operations' },
        (payload) => {
          console.log('[Realtime] bus_operations payload:', payload.eventType, payload.new)
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const updated = payload.new as BusOperation
            setBusOperations(prev => {
              const idx = prev.findIndex(o => o.id === updated.id || (o.date === updated.date && o.trip_name === updated.trip_name))
              if (idx >= 0) {
                const next = [...prev]
                next[idx] = updated
                return next
              }
              return [...prev, updated]
            })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_delays' },
        (payload) => {
          console.log('[Realtime] service_delays payload:', payload.eventType, payload.new)
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as any
            const mapped: BusOperation = {
              id: row.id,
              bus_route_id: row.bus_route_id || 'route-a',
              date: row.date,
              trip_name: row.trip_name || '登校便',
              status: row.status || 'running',
              delay_minutes: row.delay_minutes || 0
            }
            setBusOperations(prev => {
              const idx = prev.findIndex(o => o.id === mapped.id || (o.date === mapped.date && o.trip_name === mapped.trip_name))
              if (idx >= 0) {
                const next = [...prev]
                next[idx] = mapped
                return next
              }
              return [...prev, mapped]
            })
          }
        }
      )
      // 4. 特別ダイヤ・緊急運休の変更（special_trip_schedules / calendar_events）
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'special_trip_schedules' },
        (payload) => {
          console.log('[Realtime] special_trip_schedules payload:', payload.eventType, payload.new)
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const updated = payload.new as SpecialTripSchedule
            setSpecialTripSchedules(prev => {
              const idx = prev.findIndex(s => s.id === updated.id || s.date === updated.date)
              if (idx >= 0) {
                const next = [...prev]
                next[idx] = updated
                return next
              }
              return [...prev, updated]
            })
          } else if (payload.eventType === 'DELETE') {
            const oldDate = (payload.old as any)?.date
            const oldId = (payload.old as any)?.id
            if (oldDate || oldId) {
              setSpecialTripSchedules(prev => prev.filter(s => s.id !== oldId && s.date !== oldDate))
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events' },
        (payload) => {
          console.log('[Realtime] calendar_events payload:', payload.eventType, payload.new)
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as any
            const mapped: SpecialTripSchedule = {
              id: row.id,
              date: row.date,
              is_temporary_operation: row.is_temporary_operation ?? false,
              is_all_day_suspended: row.is_all_day_suspended ?? false,
              is_morning_suspended: row.is_morning_suspended ?? false,
              is_afternoon_suspended: row.is_afternoon_suspended ?? false,
              morning_trip_time: row.morning_trip_time,
              trip_1_time: row.trip_1_time,
              trip_2_time: row.trip_2_time,
              trip_3_time: row.trip_3_time,
              trip_4_time: row.trip_4_time,
              trip_5_time: row.trip_5_time,
              note: row.event_name || row.note,
              created_at: row.created_at,
              updated_at: row.updated_at
            }
            setSpecialTripSchedules(prev => {
              const idx = prev.findIndex(s => s.id === mapped.id || s.date === mapped.date)
              if (idx >= 0) {
                const next = [...prev]
                next[idx] = mapped
                return next
              }
              return [...prev, mapped]
            })
          } else if (payload.eventType === 'DELETE') {
            const oldDate = (payload.old as any)?.date
            const oldId = (payload.old as any)?.id
            if (oldDate || oldId) {
              setSpecialTripSchedules(prev => prev.filter(s => s.id !== oldId && s.date !== oldDate))
            }
          }
        }
      )
      // 5. 生徒マスタの変更（students）
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        (payload) => {
          console.log('[Realtime] students payload:', payload.eventType, payload.new)
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const updated = payload.new as Student
            setStudents(prev => {
              const idx = prev.findIndex(s => s.id === updated.id)
              if (idx >= 0) {
                const next = [...prev]
                next[idx] = updated
                return next
              }
              return [...prev, updated]
            })
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.id
            if (oldId) {
              setStudents(prev => prev.filter(s => s.id !== oldId))
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status)
        setIsRealtimeConnected(status === 'SUBSCRIBED')
      })

    return () => {
      console.log('Unsubscribing and removing Supabase Realtime channel...')
      supabase.removeChannel(channel)
      setIsRealtimeConnected(false)
    }
  }, [hasSupabaseConfig, isDemoMode, user?.id])

  // デモモード時の初期デフォルト予約の生成（全生徒・複数世帯パターンを整備）
  useEffect(() => {
    if (isDemoMode && reservations.length === 0) {
      const todayStr = new Date().toISOString().split('T')[0]
      const dummyReservations: Reservation[] = [
        // 山田家（バス停1: 青葉台公園前・兄弟）
        {
          id: 'res-1',
          student_id: 'std-1',
          date: todayStr,
          morning_status: true,
          afternoon_schedule: '下校2便',
          note: '山田 花子（基本パターン）',
          updated_at: new Date().toISOString()
        },
        {
          id: 'res-2',
          student_id: 'std-2',
          date: todayStr,
          morning_status: true,
          afternoon_schedule: '下校2便',
          note: '山田 太郎（基本パターン）',
          updated_at: new Date().toISOString()
        },
        // 佐藤家（バス停2: 美咲が丘三丁目・兄弟）
        {
          id: 'res-101',
          student_id: 'std-101',
          date: todayStr,
          morning_status: true,
          afternoon_schedule: '下校2便',
          note: '佐藤 結衣（基本パターン）',
          updated_at: new Date().toISOString()
        },
        {
          id: 'res-102',
          student_id: 'std-102',
          date: todayStr,
          morning_status: true,
          afternoon_schedule: '下校2便',
          note: '佐藤 陽斗（基本パターン）',
          updated_at: new Date().toISOString()
        },
        // 鈴木家（バス停3: 東小学校前歩道橋・単身）
        {
          id: 'res-201',
          student_id: 'std-201',
          date: todayStr,
          morning_status: true,
          afternoon_schedule: '下校3便',
          note: '鈴木 陸（部活動のため下校3便）',
          updated_at: new Date().toISOString()
        },
        // 高橋家（バス停4: 中央駅ロータリー・単身）
        {
          id: 'res-301',
          student_id: 'std-301',
          date: todayStr,
          morning_status: true,
          afternoon_schedule: '下校1便',
          note: '高橋 葵（習い事のため下校1便）',
          updated_at: new Date().toISOString()
        }
      ]
      setReservations(dummyReservations)
    }
  }, [isDemoMode])

  // DBから静的なマスタデータを取得
  const fetchMasterData = async () => {
    try {
      const [routesRes, stopsRes, monthlyRes, specialRes, holidayRes] = await Promise.all([
        supabase.from('bus_routes').select('*').order('route_name'),
        supabase.from('bus_stops').select('*').order('order_index'),
        supabase.from('monthly_trip_schedules').select('*').order('month'),
        supabase.from('special_trip_schedules').select('*').order('date'),
        supabase.from('school_holidays').select('*').order('start_date')
      ])

      if (routesRes.data) setBusRoutes(routesRes.data as BusRoute[])
      if (stopsRes.data) setBusStops(stopsRes.data as BusStop[])
      if (monthlyRes.data && monthlyRes.data.length > 0) {
        setMonthlyTripSchedules(monthlyRes.data as MonthlyTripSchedule[])
      } else {
        setMonthlyTripSchedules(mockMonthlyTripSchedules)
      }
      if (specialRes.data) setSpecialTripSchedules(specialRes.data as SpecialTripSchedule[])
      if (holidayRes.data) setSchoolHolidays(holidayRes.data as SchoolHoliday[])
    } catch (err) {
      console.error('Failed to fetch master data:', err)
    }
  }

  // DBから動的な予約・運行・チェックログを取得
  const fetchDatabaseData = async (userId: string, userProfile: UserProfile) => {
    try {
      const todayStr = new Date().toISOString().split('T')[0]
      
      // 1. ロールに基づく生徒データのフェッチ
      let studentsList: Student[] = []
      if (userProfile.role === 'parent') {
        // 保護者の場合は自分の子どもだけ
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .eq('parent_id', userId)
        if (error) throw error
        studentsList = data as Student[]
      } else {
        // 運転手・管理者の場合は全生徒
        const { data, error } = await supabase
          .from('students')
          .select('*')
        if (error) throw error
        studentsList = data as Student[]
      }
      setStudents(studentsList)

      // 2. 本日の運行データのフェッチ
      const { data: opsData } = await supabase
        .from('bus_operations')
        .select('*')
        .eq('date', todayStr)
      if (opsData && opsData.length > 0) {
        setBusOperations(opsData as BusOperation[])
      } else {
        // レコードがない場合はデフォルトの運行前状態で初期化
        setBusOperations(mockBusOperations.map(op => ({ ...op, date: todayStr })))
      }

      // 3. 生徒IDリストに基づいた予約と乗降ステータスの取得（RLSエラー回避のためのクエリ最適化）
      if (studentsList.length > 0) {
        const studentIds = studentsList.map(s => s.id)
        
        const [resRes, rideRes] = await Promise.all([
          supabase.from('reservations').select('*').in('student_id', studentIds),
          supabase.from('ride_statuses').select('*').in('student_id', studentIds)
        ])

        if (resRes.data) setReservations(resRes.data as Reservation[])
        if (rideRes.data) setRideStatuses(rideRes.data as RideStatus[])
      } else {
        setReservations([])
        setRideStatuses([])
      }
    } catch (err) {
      console.error('Failed to load database data:', err)
    }
  }

  // ユーザープロファイルの取得（usersテーブル不要・Authメタデータ＆LocalStorageから安全に生成）
  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      // 1. LocalStorageに保存されたプロファイルがあれば優先
      const cached = localStorage.getItem(`user_profile_${userId}`)
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (parsed && parsed.id === userId) {
            setProfile(parsed)
            return parsed
          }
        } catch (_) {}
      }

      // 2. Supabase Auth ユーザーのメタデータからプロファイルを構築
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const email = authUser?.email || user?.email || ''
      const fullName = authUser?.user_metadata?.full_name || user?.user_metadata?.full_name || email.split('@')[0] || '保護者'
      const role: UserRole = authUser?.user_metadata?.role || (email.includes('admin') ? 'admin' : email.includes('driver') ? 'driver' : 'parent')

      const profileObj: UserProfile = {
        id: userId,
        email,
        full_name: fullName,
        role,
        created_at: authUser?.created_at || new Date().toISOString()
      }

      localStorage.setItem(`user_profile_${userId}`, JSON.stringify(profileObj))
      setProfile(profileObj)
      return profileObj
    } catch (err) {
      console.warn('Failed to fetch user profile:', err)
      return null
    }
  }

  // 手動リフレッシュ用関数
  const refreshData = async () => {
    if (isDemoMode || !user || !profile) return
    await fetchMasterData()
    await fetchDatabaseData(user.id, profile)
  }

  // ログアウト処理
  const signOut = async () => {
    setLoading(true)
    try {
      localStorage.removeItem('school_bus_active_session_v1')
      if (hasSupabaseConfig && !isDemoMode) {
        await supabase.auth.signOut().catch(() => {})
      }
      setUser(null)
      setProfile(null)
    } catch (err) {
      console.error('Sign Out Error:', err)
    } finally {
      setLoading(false)
    }
  }

  // 1. 保護者ログイン（生徒ID＋照合キー）
  const loginAsParent = async (studentCode: string, verificationCode: string): Promise<{ success: boolean; error?: string }> => {
    const cleanCode = studentCode.trim().toUpperCase()
    const cleanVerif = verificationCode.trim().toUpperCase()

    if (!cleanCode || !cleanVerif) {
      return { success: false, error: '生徒IDと照合キー（または生徒氏名）の両方を入力してください。' }
    }

    try {
      // 生徒リストから検索（Supabaseまたはローカルstudents）
      let matchedStudent: Student | undefined

      if (hasSupabaseConfig && !isDemoMode) {
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .ilike('student_code', cleanCode)

        if (!error && data && data.length > 0) {
          matchedStudent = (data as Student[]).find(s => {
            const vCode = (s.verification_code || '').trim().toUpperCase()
            const sName = (s.name || '').trim().toUpperCase()
            const sNameNoSpace = sName.replace(/\s+/g, '')
            return vCode === cleanVerif || sName === cleanVerif || sNameNoSpace === cleanVerif.replace(/\s+/g, '')
          })
        }
      }

      // ローカル生徒マスタからのフォールバック検索
      if (!matchedStudent) {
        matchedStudent = students.find(s => {
          const sCode = (s.student_code || s.id || '').trim().toUpperCase()
          if (sCode !== cleanCode) return false
          const vCode = (s.verification_code || '').trim().toUpperCase()
          const sName = (s.name || '').trim().toUpperCase()
          const sNameNoSpace = sName.replace(/\s+/g, '')
          return vCode === cleanVerif || sName === cleanVerif || sNameNoSpace === cleanVerif.replace(/\s+/g, '')
        })
      }

      if (!matchedStudent) {
        return { 
          success: false, 
          error: '該当する生徒情報が見つかりませんでした。生徒IDおよび照合キー（配布資料記載）をご確認ください。' 
        }
      }

      const parentId = matchedStudent.parent_id || `parent-${matchedStudent.household_id || matchedStudent.id}`
      const parentUser: MockUser = {
        id: parentId,
        email: `${cleanCode.toLowerCase()}@parent.school-bus.app`,
        user_metadata: {
          full_name: `${matchedStudent.name} 保護者`,
          avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'
        }
      }

      const parentProfile: UserProfile = {
        id: parentId,
        email: `${cleanCode.toLowerCase()}@parent.school-bus.app`,
        full_name: `${matchedStudent.name} 保護者`,
        role: 'parent',
        created_at: new Date().toISOString()
      }

      // 生徒のparent_idを自動紐付け更新
      setStudents(prev => prev.map(s => {
        if (s.id === matchedStudent!.id || (matchedStudent!.household_id && s.household_id === matchedStudent!.household_id)) {
          return { ...s, parent_id: parentId }
        }
        return s
      }))

      // セッションを永続化
      localStorage.setItem('school_bus_active_session_v1', JSON.stringify({
        user: parentUser,
        profile: parentProfile,
        studentId: matchedStudent.id,
        studentCode: matchedStudent.student_code,
        studentName: matchedStudent.name
      }))

      setUser(parentUser)
      setProfile(parentProfile)

      return { success: true }
    } catch (err: any) {
      console.error('Parent Login Error:', err)
      return { success: false, error: err.message || 'ログイン処理中にエラーが発生しました。' }
    }
  }

  // 2. ドライバーログイン（PINコードまたは簡易認証）
  const loginAsDriver = async (_pinCode?: string): Promise<{ success: boolean; error?: string }> => {
    // 任意のPINまたは1234/未入力でも認証可能（現場の利便性向上）
    const driverId = 'driver-active-session'
    const driverUser: MockUser = {
      id: driverId,
      email: 'driver@school-bus.app',
      user_metadata: {
        full_name: 'スクールバス運行乗務員',
        avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&h=150&q=80'
      }
    }

    const driverProfile: UserProfile = {
      id: driverId,
      email: 'driver@school-bus.app',
      full_name: 'スクールバス運行乗務員',
      role: 'driver',
      created_at: new Date().toISOString()
    }

    localStorage.setItem('school_bus_active_session_v1', JSON.stringify({
      user: driverUser,
      profile: driverProfile
    }))

    setUser(driverUser)
    setProfile(driverProfile)

    return { success: true }
  }

  // 3. 管理者ログイン（パスワード認証）
  const loginAsAdmin = async (password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanPass = password.trim()
    if (!cleanPass) {
      return { success: false, error: '管理者パスワードを入力してください。' }
    }

    // 簡易パスワード認証（admin, 1234, admin1234, または設定値）
    const validPasswords = ['admin', '1234', 'admin1234', 'school', 'school2026', 'bus2026']
    if (!validPasswords.includes(cleanPass.toLowerCase()) && cleanPass !== 'admin') {
      return { success: false, error: '管理者パスワードが正しくありません。' }
    }

    const adminId = 'admin-active-session'
    const adminUser: MockUser = {
      id: adminId,
      email: 'admin@school-bus.app',
      user_metadata: {
        full_name: '学校運行管理者',
        avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80'
      }
    }

    const adminProfile: UserProfile = {
      id: adminId,
      email: 'admin@school-bus.app',
      full_name: '学校運行管理者',
      role: 'admin',
      created_at: new Date().toISOString()
    }

    localStorage.setItem('school_bus_active_session_v1', JSON.stringify({
      user: adminUser,
      profile: adminProfile
    }))

    setUser(adminUser)
    setProfile(adminProfile)

    return { success: true }
  }

  // デモ用のクイックログイン
  const signInDemoUser = (role: 'parent' | 'driver' | 'admin', isNew: boolean = false) => {
    const demoId = `${role}-demo-id`
    const mockUser: MockUser = {
      id: demoId,
      email: `${role}@example.com`,
      user_metadata: {
        full_name: isNew ? undefined : DEMO_PROFILES[demoId]?.full_name || 'デモユーザー',
        avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'
      }
    }
    
    setUser(mockUser)
    if (isNew) {
      setProfile(null)
    } else {
      setProfile(DEMO_PROFILES[demoId] || null)
    }
  }

// 指定期間内の平日リストを返すヘルパー関数
const getWeekdaysOfPeriod = (start: Date, end: Date): string[] => {
  const dates: string[] = []
  const current = new Date(start)
  current.setHours(0, 0, 0, 0)
  const targetEnd = new Date(end)
  targetEnd.setHours(0, 0, 0, 0)

  while (current <= targetEnd) {
    const dayOfWeek = current.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const year = current.getFullYear()
      const month = String(current.getMonth() + 1).padStart(2, '0')
      const day = String(current.getDate()).padStart(2, '0')
      dates.push(`${year}-${month}-${day}`)
    }
    current.setDate(current.getDate() + 1)
  }
  return dates
}

  const verifyStudentForRegistration = async (studentCode: string, verificationCode: string): Promise<{ success: boolean; student?: Student; error?: string }> => {
    const cleanCode = studentCode.trim().toUpperCase()
    const cleanVerif = verificationCode.trim().toUpperCase()

    if (!cleanCode || !cleanVerif) {
      return { success: false, error: '生徒IDと照合キー（または生徒氏名）を入力してください。' }
    }

    // 1. Supabaseが利用可能な場合はDBから直接最新の生徒情報を照会
    if (!isDemoMode && hasSupabaseConfig) {
      try {
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .ilike('student_code', cleanCode)

        if (!error && data && data.length > 0) {
          const matched = data.find(s => {
            const vCode = (s.verification_code || '').trim().toUpperCase()
            const sName = (s.name || '').trim().toUpperCase()
            const sNameNoSpace = sName.replace(/\s+/g, '')
            return vCode === cleanVerif || sName === cleanVerif || sNameNoSpace === cleanVerif.replace(/\s+/g, '')
          })

          if (matched) {
            // 既に他の保護者に紐付けられているか確認
            if (matched.parent_id && matched.parent_id !== 'unassigned' && matched.parent_id !== user?.id) {
              return { 
                success: false, 
                error: 'この生徒は既に保護者アカウントに登録・紐付け済みです。学校管理者にお問い合わせください。' 
              }
            }
            // ローカルステートにも反映
            setStudents(prev => {
              const existingIdx = prev.findIndex(p => p.id === matched.id)
              if (existingIdx >= 0) {
                const next = [...prev]
                next[existingIdx] = matched as Student
                return next
              }
              return [...prev, matched as Student]
            })
            return { success: true, student: matched as Student }
          }
        }
      } catch (err) {
        console.error('Supabase student verification error:', err)
      }
    }

    // 2. ローカルステートまたはフォールバックから検索
    const found = students.find(s => {
      const matchCode = (s.student_code && s.student_code.trim().toUpperCase() === cleanCode) || 
                        s.id.toUpperCase() === cleanCode
      const matchVerif = (s.verification_code && s.verification_code.trim().toUpperCase() === cleanVerif) || 
                         s.name.trim().toUpperCase() === cleanVerif ||
                         s.name.replace(/\s+/g, '').toUpperCase() === cleanVerif.replace(/\s+/g, '')
      return matchCode && matchVerif
    })

    if (!found) {
      return { 
        success: false, 
        error: '該当する生徒が見つかりません。学校から配布された登録案内用紙（生徒ID・照合キー）をご確認ください。' 
      }
    }

    // 既に他の保護者に紐付けられているか確認
    if (found.parent_id && found.parent_id !== 'unassigned' && found.parent_id !== user?.id) {
      return { 
        success: false, 
        error: 'この生徒は既に保護者アカウントに登録・紐付け済みです。学校管理者にお問い合わせください。' 
      }
    }

    return { success: true, student: found }
  }

  // 保護者プロフィールと生徒情報の登録処理
  // 保護者プロフィールと生徒情報の登録処理
  const registerParentProfile = async (
    fullName: string,
    studentsInput: { 
      studentId?: string;
      name: string; 
      routeId: string; 
      stopId: string; 
      defaultMorningRide: boolean; 
      defaultAfternoonSchedule: string | null 
    }[]
  ): Promise<boolean> => {
    if (!user) {
      console.error('registerParentProfile failed: user is null')
      return false
    }
    setLoading(true)

    const isValidUUID = (id?: string | null): boolean => {
      if (!id) return false
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    }

    if (isDemoMode) {
      const newProfile: UserProfile = {
        id: user.id,
        email: user.email || '',
        full_name: fullName,
        role: 'parent',
        created_at: new Date().toISOString()
      }
      DEMO_PROFILES[user.id] = newProfile
      setProfile(newProfile)

      // デモ用生徒データを動的に更新（事前登録生徒の紐付け）
      setStudents(prev => prev.map(s => {
        const input = studentsInput.find(inp => inp.studentId === s.id || inp.name === s.name)
        if (input) {
          return {
            ...s,
            parent_id: user.id,
            name: input.name || s.name,
            bus_route_id: input.routeId,
            default_bus_stop_id: input.stopId,
            default_morning_ride: input.defaultMorningRide,
            default_afternoon_schedule: input.defaultAfternoonSchedule
          }
        }
        return s
      }))

      // 自動初期予約の生成 (今日から翌月末まで)
      const today = new Date()
      const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0)
      const dates = getWeekdaysOfPeriod(today, nextMonthEnd)
      
      const newReservations: Reservation[] = []
      studentsInput.forEach(sInp => {
        const studentId = sInp.studentId || `std-demo-${sInp.name}`
        dates.forEach((date, dIdx) => {
          newReservations.push({
            id: `res-init-${studentId}-${dIdx}-${Math.random().toString(36).substr(2, 5)}`,
            student_id: studentId,
            date,
            morning_status: sInp.defaultMorningRide,
            afternoon_schedule: sInp.defaultAfternoonSchedule,
            note: '初期自動予約',
            updated_at: new Date().toISOString()
          })
        })
      })
      
      const targetIds = studentsInput.map(s => s.studentId).filter(Boolean) as string[]
      setReservations(prev => [...prev.filter(r => !targetIds.includes(r.student_id)), ...newReservations])

      setLoading(false)
      return true
    }

    try {
      console.log('Starting parent profile registration for user:', user.id, 'Name:', fullName)

      // 1. 保護者プロファイルをメモリ＆LocalStorageに設定（usersテーブル非依存）
      const newProfile: UserProfile = {
        id: user.id,
        email: user.email || '',
        full_name: fullName,
        role: 'parent',
        created_at: new Date().toISOString()
      }
      setProfile(newProfile)
      localStorage.setItem(`user_profile_${user.id}`, JSON.stringify(newProfile))

      // Supabase Authのメタデータにもプロファイルを反映
      try {
        await supabase.auth.updateUser({
          data: { full_name: fullName, role: 'parent' }
        })
      } catch (authMetaErr) {
        console.warn('Auth metadata update warning:', authMetaErr)
      }

      // 2. 各生徒レコードを studentsテーブルに更新 (事前登録済み生徒の紐付け)
      for (const s of studentsInput) {
        const safeRouteId = isValidUUID(s.routeId) ? s.routeId : null
        const safeStopId = isValidUUID(s.stopId) ? s.stopId : null

        if (s.studentId) {
          console.log(`Linking student ${s.studentId} (${s.name}) to parent ${user.id}`)
          
          const updatePayload: any = {
            parent_id: user.id,
            default_morning_ride: s.defaultMorningRide,
            default_afternoon_schedule: s.defaultAfternoonSchedule
          }
          if (safeRouteId) updatePayload.bus_route_id = safeRouteId
          if (safeStopId) updatePayload.default_bus_stop_id = safeStopId

          try {
            const { error: updateError } = await supabase
              .from('students')
              .update(updatePayload)
              .eq('id', s.studentId)

            if (updateError) {
              console.warn(`Supabase students update warning for ${s.studentId}:`, updateError)
            }
          } catch (dbErr) {
            console.warn(`Database update error for student ${s.studentId}:`, dbErr)
          }
        }
      }

      // 3. ローカルステート（students）に紐付け結果を即時反映
      setStudents(prev => {
        return prev.map(s => {
          const matchedInput = studentsInput.find(inp => inp.studentId === s.id || inp.name === s.name)
          if (matchedInput) {
            return {
              ...s,
              parent_id: user.id,
              bus_route_id: matchedInput.routeId || s.bus_route_id,
              default_bus_stop_id: matchedInput.stopId || s.default_bus_stop_id,
              default_morning_ride: matchedInput.defaultMorningRide,
              default_afternoon_schedule: matchedInput.defaultAfternoonSchedule
            }
          }
          return s
        })
      })

      // 4. 自動初期予約の生成（カレンダー初期表示用）
      const today = new Date()
      const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0)
      const dates = getWeekdaysOfPeriod(today, nextMonthEnd)
      
      const newReservations: Reservation[] = []
      studentsInput.forEach(sInp => {
        const studentId = sInp.studentId || `std-parent-${sInp.name}`
        dates.forEach((date, dIdx) => {
          newReservations.push({
            id: `res-init-${studentId}-${dIdx}-${Math.random().toString(36).substr(2, 5)}`,
            student_id: studentId,
            date,
            morning_status: sInp.defaultMorningRide,
            afternoon_schedule: sInp.defaultAfternoonSchedule,
            note: '初期自動予約',
            updated_at: new Date().toISOString()
          })
        })
      })
      
      const targetIds = studentsInput.map(s => s.studentId).filter(Boolean) as string[]
      setReservations(prev => [...prev.filter(r => !targetIds.includes(r.student_id)), ...newReservations])

      // 5. 最新データのフェッチを試みる
      try {
        await fetchMasterData()
        await fetchDatabaseData(user.id, newProfile)
      } catch (fetchErr) {
        console.warn('Post-registration data fetch warning:', fetchErr)
      }

      console.log('Parent profile registration completed successfully!')
      return true
    } catch (err: any) {
      console.error('Registration process failed with error:', err)
      const errorMsg = err?.message || '登録処理中にエラーが発生しました。'
      alert(errorMsg)
      return false
    } finally {
      setLoading(false)
    }
  }

  // 運転手による運行状況の更新
  const updateOperation = async (
    routeId: string,
    tripName: string,
    status: 'not_started' | 'running' | 'finished',
    delayMinutes: number
  ) => {
    if (isDemoMode) {
      setBusOperations(prev => {
        const exists = prev.some(op => op.bus_route_id === routeId && op.trip_name === tripName)
        if (exists) {
          return prev.map(op => {
            if (op.bus_route_id === routeId && op.trip_name === tripName) {
              return { ...op, status, delay_minutes: delayMinutes }
            }
            return op
          })
        } else {
          return [
            ...prev,
            {
              id: `op-${Math.random().toString(36).substr(2, 9)}`,
              bus_route_id: routeId,
              date: new Date().toISOString().split('T')[0],
              trip_name: tripName,
              status,
              delay_minutes: delayMinutes
            }
          ]
        }
      })
      return
    }

    try {
      const todayStr = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('bus_operations')
        .select('*')
        .eq('bus_route_id', routeId)
        .eq('date', todayStr)
        .eq('trip_name', tripName)
        .maybeSingle()

      if (error) throw error

      if (data) {
        const { error: updateError } = await supabase
          .from('bus_operations')
          .update({ status, delay_minutes: delayMinutes })
          .eq('id', data.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('bus_operations')
          .insert({
            bus_route_id: routeId,
            date: todayStr,
            trip_name: tripName,
            status,
            delay_minutes: delayMinutes
          })
        if (insertError) throw insertError
      }
      
      if (user && profile) {
        await fetchDatabaseData(user.id, profile)
      }
    } catch (err) {
      console.error('Failed to update bus operation:', err)
    }
  }

  // 保護者による個別予約の保存（楽観的即時更新 + Supabase UPSERT）
  const saveReservation = async (
    studentId: string,
    date: string,
    morningStatus: boolean,
    afternoonSchedule: string | null,
    note: string | null
  ): Promise<boolean> => {
    // 1. ローカルステートを即時楽観的更新
    setReservations(prev => {
      const exists = prev.some(r => r.student_id === studentId && r.date === date)
      if (exists) {
        return prev.map(r => {
          if (r.student_id === studentId && r.date === date) {
            return {
              ...r,
              morning_status: morningStatus,
              afternoon_schedule: afternoonSchedule,
              note,
              updated_at: new Date().toISOString()
            }
          }
          return r
        })
      } else {
        return [
          ...prev,
          {
            id: `res-${Math.random().toString(36).substr(2, 9)}`,
            student_id: studentId,
            date,
            morning_status: morningStatus,
            afternoon_schedule: afternoonSchedule,
            note,
            updated_at: new Date().toISOString()
          }
        ]
      }
    })

    if (isDemoMode) return true

    // 2. Supabase reservations テーブルに保存
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('id')
        .eq('student_id', studentId)
        .eq('date', date)
        .maybeSingle()

      if (error) {
        console.warn('Reservation query warning:', error)
      }

      if (data?.id) {
        const { error: updateError } = await supabase
          .from('reservations')
          .update({
            morning_status: morningStatus,
            afternoon_schedule: afternoonSchedule,
            note,
            updated_at: new Date().toISOString()
          })
          .eq('id', data.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('reservations')
          .insert({
            student_id: studentId,
            date,
            morning_status: morningStatus,
            afternoon_schedule: afternoonSchedule,
            note,
            updated_at: new Date().toISOString()
          })
        if (insertError) throw insertError
      }

      return true
    } catch (err) {
      console.error('Failed to save reservation to Supabase:', err)
      return false
    }
  }

  // 週間一括予約の保存（楽観的更新 + Supabase UPSERT）
  const saveWeeklyReservations = async (
    studentId: string,
    items: { date: string; morningStatus: boolean; afternoonSchedule: string | null; note: string | null }[]
  ): Promise<boolean> => {
    // 1. ローカルステートを即時一括更新
    setReservations(prev => {
      const itemDates = items.map(i => i.date)
      const filtered = prev.filter(r => !(r.student_id === studentId && itemDates.includes(r.date)))
      const newItems: Reservation[] = items.map((item, idx) => ({
        id: `res-week-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        student_id: studentId,
        date: item.date,
        morning_status: item.morningStatus,
        afternoon_schedule: item.afternoonSchedule,
        note: item.note,
        updated_at: new Date().toISOString()
      }))
      return [...filtered, ...newItems]
    })

    if (isDemoMode) return true

    // 2. Supabase 各日保存
    try {
      for (const item of items) {
        const { data } = await supabase
          .from('reservations')
          .select('id')
          .eq('student_id', studentId)
          .eq('date', item.date)
          .maybeSingle()

        if (data?.id) {
          await supabase
            .from('reservations')
            .update({
              morning_status: item.morningStatus,
              afternoon_schedule: item.afternoonSchedule,
              note: item.note,
              updated_at: new Date().toISOString()
            })
            .eq('id', data.id)
        } else {
          await supabase
            .from('reservations')
            .insert({
              student_id: studentId,
              date: item.date,
              morning_status: item.morningStatus,
              afternoon_schedule: item.afternoonSchedule,
              note: item.note,
              updated_at: new Date().toISOString()
            })
        }
      }
      return true
    } catch (err) {
      console.error('Failed to batch save weekly reservations:', err)
      return false
    }
  }

  // 翌月平日の基本パターン一括自動予約
  const generateNextMonthReservations = async (
    studentId: string,
    defaultMorning: boolean,
    defaultAfternoon: string | null
  ): Promise<number> => {
    const today = new Date()
    const targetYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear()
    const targetMonth = today.getMonth() === 11 ? 0 : today.getMonth() + 1
    
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
    const datesToInsert: string[] = []

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(targetYear, targetMonth, day)
      const dayOfWeek = d.getDay()
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const dateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        datesToInsert.push(dateStr)
      }
    }

    if (isDemoMode) {
      setReservations(prev => {
        const filtered = prev.filter(r => {
          const rDate = new Date(r.date)
          const isSameMonth = rDate.getFullYear() === targetYear && rDate.getMonth() === targetMonth
          return !(r.student_id === studentId && isSameMonth)
        })

        const newRes: Reservation[] = datesToInsert.map((date, idx) => ({
          id: `res-bulk-${idx}-${Math.random().toString(36).substr(2, 5)}`,
          student_id: studentId,
          date,
          morning_status: defaultMorning,
          afternoon_schedule: defaultAfternoon,
          note: '基本一括自動予約',
          updated_at: new Date().toISOString()
        }))

        return [...filtered, ...newRes]
      })
      return datesToInsert.length
    }

    try {
      const startDate = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`
      const endDate = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
      
      const { error: deleteError } = await supabase
        .from('reservations')
        .delete()
        .eq('student_id', studentId)
        .gte('date', startDate)
        .lte('date', endDate)

      if (deleteError) throw deleteError

      const insertPayload = datesToInsert.map(date => ({
        student_id: studentId,
        date,
        morning_status: defaultMorning,
        afternoon_schedule: defaultAfternoon,
        note: '基本一括自動予約',
        updated_at: new Date().toISOString()
      }))

      const { error: insertError } = await supabase
        .from('reservations')
        .insert(insertPayload)

      if (insertError) throw insertError
      
      if (user && profile) {
        await fetchDatabaseData(user.id, profile)
      }

      return datesToInsert.length
    } catch (err) {
      console.error('Failed to generate bulk reservations:', err)
      return 0
    }
  }

  // 運転手による生徒の乗車・欠席チェック (便ごとに個別保存)
  const updateStudentRideStatus = async (
    studentId: string,
    date: string,
    tripName: string,
    status: 'riding' | 'absent' | 'completed'
  ) => {
    if (isDemoMode) {
      setRideStatuses(prev => {
        const exists = prev.some(r => r.student_id === studentId && r.date === date && r.trip_name === tripName)
        if (exists) {
          return prev.map(r => {
            if (r.student_id === studentId && r.date === date && r.trip_name === tripName) {
              return { ...r, status, updated_at: new Date().toISOString() }
            }
            return r
          })
        } else {
          return [
            ...prev,
            {
              id: `ride-${Math.random().toString(36).substr(2, 9)}`,
              student_id: studentId,
              date,
              trip_name: tripName,
              status,
              updated_at: new Date().toISOString()
            }
          ]
        }
      })
      return
    }

    try {
      const { data, error } = await supabase
        .from('ride_statuses')
        .select('*')
        .eq('student_id', studentId)
        .eq('date', date)
        .eq('trip_name', tripName)
        .maybeSingle()

      if (error) throw error

      if (data) {
        const { error: updateError } = await supabase
          .from('ride_statuses')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', data.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('ride_statuses')
          .insert({
            student_id: studentId,
            date,
            trip_name: tripName,
            status,
            updated_at: new Date().toISOString()
          })
        if (insertError) throw insertError
      }
      
      if (user && profile) {
        await fetchDatabaseData(user.id, profile)
      }
    } catch (err) {
      console.error('Failed to update student ride status:', err)
    }
  }

  // 短縮ダイヤ適用曜日を取得するヘルパー (1:月, 2:火, 3:水, 4:木, 5:金, null:なし)
  const getShortenedDayOfWeek = (dateOrMonth?: string | number): number | null => {
    let month = 4
    if (typeof dateOrMonth === 'number') {
      month = dateOrMonth
    } else if (typeof dateOrMonth === 'string' && dateOrMonth) {
      if (dateOrMonth.includes('-')) {
        const d = new Date(`${dateOrMonth}T00:00:00`)
        if (!isNaN(d.getTime())) {
          month = d.getMonth() + 1
        }
      } else {
        const parsed = parseInt(dateOrMonth, 10)
        if (!isNaN(parsed)) month = parsed
      }
    } else {
      month = new Date().getMonth() + 1
    }

    const schedule = monthlyTripSchedules.find(s => s.month === month)
    if (schedule && schedule.shortened_day_of_week !== undefined) {
      return schedule.shortened_day_of_week
    }
    return 3 // デフォルトは水曜日 (3)
  }

  // 5層優先度による日付運行ステータス判定ヘルパー
  const getDateScheduleStatus = (dateStr: string): DateScheduleStatus => {
    const formattedDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
    const dObj = new Date(`${formattedDate}T00:00:00`)
    const dayOfWeek = dObj.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    // ① 【第1優先】：特定日例外・臨時運行・個別運休日（最優先上書き）
    const special = specialTripSchedules.find(s => s.date === formattedDate)
    if (special) {
      if (special.is_all_day_suspended) {
        return {
          date: formattedDate,
          type: 'special',
          label: special.note || '終日運休（特定日設定）',
          isSuspended: true,
          isMorningSuspended: true,
          isAfternoonSuspended: true,
          specialSchedule: special,
          note: special.note || '特定日終日運休'
        }
      }

      const holidayName = getJapaneseHolidayName(formattedDate)
      const schoolBreak = schoolHolidays.find(h => h.start_date <= formattedDate && formattedDate <= h.end_date)
      const isTemp = special.is_temporary_operation || isWeekend || holidayName !== null || schoolBreak !== undefined

      return {
        date: formattedDate,
        type: 'special',
        label: special.note || (isTemp ? '臨時運行日（登校・行事）' : '特定日ダイヤ'),
        isSuspended: false,
        isMorningSuspended: special.is_morning_suspended,
        isAfternoonSuspended: special.is_afternoon_suspended,
        specialSchedule: special,
        note: special.note || (isTemp ? '休日・休業期間中の臨時運行' : undefined)
      }
    }

    // ② 【第2優先】：日本の祝日（全便自動運休）
    const holidayName = getJapaneseHolidayName(formattedDate)
    if (holidayName) {
      return {
        date: formattedDate,
        type: 'holiday',
        label: `${holidayName} (祝日運休)`,
        isSuspended: true,
        isMorningSuspended: true,
        isAfternoonSuspended: true,
        holidayName,
        note: `${holidayName}のため全便運休`
      }
    }

    // ②-2 【第2優先】：長期休業期間（夏・冬・春休み・学校閉庁日、全便自動運休）
    const schoolBreak = schoolHolidays.find(h => h.start_date <= formattedDate && formattedDate <= h.end_date)
    if (schoolBreak) {
      return {
        date: formattedDate,
        type: 'school_break',
        label: `${schoolBreak.holiday_name} (運休)`,
        isSuspended: true,
        isMorningSuspended: true,
        isAfternoonSuspended: true,
        holidayName: schoolBreak.holiday_name,
        note: schoolBreak.note || `${schoolBreak.holiday_name}のため全便運休`
      }
    }

    // ③ 【第3優先】：土日（原則運休、臨時運行設定がない場合）
    if (isWeekend) {
      return {
        date: formattedDate,
        type: 'regular',
        label: '土日運休',
        isSuspended: true,
        isMorningSuspended: true,
        isAfternoonSuspended: true
      }
    }

    // ④ 【第4優先】：短縮日課ダイヤ
    const month = dObj.getMonth() + 1
    const schedule = monthlyTripSchedules.find(s => s.month === month)
    const shortenedDay = schedule?.shortened_day_of_week !== undefined ? schedule.shortened_day_of_week : 3

    if (shortenedDay !== null && dayOfWeek === shortenedDay) {
      return {
        date: formattedDate,
        type: 'shortened',
        label: '短縮日課ダイヤ',
        isSuspended: false,
        isMorningSuspended: false,
        isAfternoonSuspended: false
      }
    }

    // ⑤ 【第5優先】：通常平日ダイヤ
    return {
      date: formattedDate,
      type: 'regular',
      label: '通常ダイヤ',
      isSuspended: false,
      isMorningSuspended: false,
      isAfternoonSuspended: false
    }
  }

  // 便名と日付（または月）から出発時刻を取得するヘルパー（5層優先度自動判定連動、運休・未設定は '--:--'）
  const getTripTime = (tripName: string, dateOrMonth?: string | number, forceIsShortened?: boolean): string => {
    if (typeof dateOrMonth === 'string' && dateOrMonth.includes('-')) {
      const status = getDateScheduleStatus(dateOrMonth)
      
      // 終日運休または祝日・休業期間・土日運休
      if (status.isSuspended) {
        return '--:--'
      }

      // ① 特定日ダイヤ・臨時運行がある場合
      if (status.type === 'special' && status.specialSchedule) {
        const sch = status.specialSchedule
        if (tripName === '登校便') {
          if (status.isMorningSuspended) return '--:--'
          if (sch.morning_trip_time && sch.morning_trip_time.trim() !== '') {
            return sch.morning_trip_time.substring(0, 5)
          }
          // 特定日に登校便が明示指定されていない場合は月別設定または標準07:30
          const parsedM = parseInt(dateOrMonth.split('-')[1], 10)
          const mSch = monthlyTripSchedules.find(s => s.month === parsedM)
          return mSch?.morning_trip_time ? mSch.morning_trip_time.substring(0, 5) : '07:30'
        }

        if (status.isAfternoonSuspended) return '--:--'
        let timeVal: string | null = null
        if (tripName === '下校1便') timeVal = sch.trip_1_time
        else if (tripName === '下校2便') timeVal = sch.trip_2_time
        else if (tripName === '下校3便') timeVal = sch.trip_3_time
        else if (tripName === '下校4便') timeVal = sch.trip_4_time
        else if (tripName === '下校5便') timeVal = sch.trip_5_time

        if (!timeVal || timeVal.trim() === '' || timeVal === '--:--' || timeVal.startsWith('--')) {
          return '--:--'
        }
        return timeVal.substring(0, 5)
      }

      // 登校便判定（通常・短縮日）
      if (tripName === '登校便') {
        if (status.isMorningSuspended) return '--:--'
        const parsedM = parseInt(dateOrMonth.split('-')[1], 10)
        const mSch = monthlyTripSchedules.find(s => s.month === parsedM)
        return mSch?.morning_trip_time ? mSch.morning_trip_time.substring(0, 5) : '07:30'
      }

      // 下校便判定
      if (status.isAfternoonSuspended) {
        return '--:--'
      }

      // ④ 短縮日課 または ⑤ 通常日課
      const parsedMonth = parseInt(dateOrMonth.split('-')[1], 10)
      const monthSchedule = monthlyTripSchedules.find(s => s.month === parsedMonth)
      const isShortened = forceIsShortened !== undefined ? forceIsShortened : status.type === 'shortened'

      let timeVal: string | null | undefined = null
      if (isShortened) {
        if (tripName === '下校1便') timeVal = monthSchedule?.wed_trip_1_time
        else if (tripName === '下校2便') timeVal = monthSchedule?.wed_trip_2_time
        else if (tripName === '下校3便') timeVal = monthSchedule?.wed_trip_3_time
        else if (tripName === '下校4便') timeVal = monthSchedule?.wed_trip_4_time
        else if (tripName === '下校5便') timeVal = monthSchedule?.wed_trip_5_time
      } else {
        if (tripName === '下校1便') timeVal = monthSchedule?.trip_1_time
        else if (tripName === '下校2便') timeVal = monthSchedule?.trip_2_time
        else if (tripName === '下校3便') timeVal = monthSchedule?.trip_3_time
        else if (tripName === '下校4便') timeVal = monthSchedule?.trip_4_time
        else if (tripName === '下校5便') timeVal = monthSchedule?.trip_5_time
      }

      if (!timeVal || timeVal.trim() === '' || timeVal === '--:--' || timeVal.startsWith('--')) {
        return '--:--'
      }
      return timeVal.substring(0, 5)
    }

    // 月（数値または月指定文字列）の場合のフォールバック
    const month = typeof dateOrMonth === 'number' ? dateOrMonth : new Date().getMonth() + 1
    const schedule = monthlyTripSchedules.find(s => s.month === month)
    if (tripName === '登校便') {
      return schedule?.morning_trip_time ? schedule.morning_trip_time.substring(0, 5) : '07:30'
    }
    const isShortened = forceIsShortened === true

    let timeVal: string | null | undefined = null
    if (isShortened) {
      if (tripName === '下校1便') timeVal = schedule?.wed_trip_1_time
      else if (tripName === '下校2便') timeVal = schedule?.wed_trip_2_time
      else if (tripName === '下校3便') timeVal = schedule?.wed_trip_3_time
      else if (tripName === '下校4便') timeVal = schedule?.wed_trip_4_time
      else if (tripName === '下校5便') timeVal = schedule?.wed_trip_5_time
    } else {
      if (tripName === '下校1便') timeVal = schedule?.trip_1_time
      else if (tripName === '下校2便') timeVal = schedule?.trip_2_time
      else if (tripName === '下校3便') timeVal = schedule?.trip_3_time
      else if (tripName === '下校4便') timeVal = schedule?.trip_4_time
      else if (tripName === '下校5便') timeVal = schedule?.trip_5_time
    }

    if (!timeVal || timeVal.trim() === '' || timeVal === '--:--' || timeVal.startsWith('--')) {
      return '--:--'
    }
    return timeVal.substring(0, 5)
  }

  // バス停の通過予定時刻を登校便出発時刻のシフトに合わせて自動計算するヘルパー
  const getAdjustedStopArrivalTime = (stop: BusStop, dateOrMonth?: string | number): string => {
    const originalTime = stop.arrival_time_morning ? stop.arrival_time_morning.substring(0, 5) : '07:30'
    const morningDepartureTime = getTripTime('登校便', dateOrMonth)
    
    // 運休判定だが運行中の便がある場合、またはフォールバック時は基本時刻を基準にする
    const effectiveMorningTime = morningDepartureTime !== '--:--' ? morningDepartureTime : '07:30'

    // 基本標準出発時刻は "07:30"
    const [stdH, stdM] = [7, 30]
    const [curH, curM] = effectiveMorningTime.split(':').map(Number)
    const diffMinutes = (curH * 60 + curM) - (stdH * 60 + stdM)

    if (diffMinutes === 0) return originalTime

    const [origH, origM] = originalTime.split(':').map(Number)
    let totalM = origH * 60 + origM + diffMinutes
    if (totalM < 0) totalM += 24 * 60
    totalM = totalM % (24 * 60)

    const newH = Math.floor(totalM / 60)
    const newM = totalM % 60
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
  }

  // 指定便が運行しているか判定（'--:--' / null は運休判定）
  const isTripOperating = (tripName: string, dateOrMonth?: string | number, forceIsShortened?: boolean): boolean => {
    if (typeof dateOrMonth === 'string' && dateOrMonth.includes('-')) {
      const status = getDateScheduleStatus(dateOrMonth)
      if (status.isSuspended) return false
      if (tripName === '登校便' && status.isMorningSuspended) return false
      if (tripName !== '登校便' && status.isAfternoonSuspended) return false
    }
    const time = getTripTime(tripName, dateOrMonth, forceIsShortened)
    return time !== '--:--'
  }

  // 特定日例外ダイヤ・臨時運行の保存・更新
  const saveSpecialTripSchedule = async (data: Omit<SpecialTripSchedule, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<boolean> => {
    const existing = specialTripSchedules.find(s => s.date === data.date)
    const newRecord: SpecialTripSchedule = {
      id: data.id || existing?.id || `sts-${Date.now()}`,
      date: data.date,
      is_temporary_operation: data.is_temporary_operation ?? false,
      is_all_day_suspended: data.is_all_day_suspended ?? false,
      is_morning_suspended: data.is_morning_suspended ?? false,
      is_afternoon_suspended: data.is_afternoon_suspended ?? false,
      morning_trip_time: data.morning_trip_time ? `${data.morning_trip_time.substring(0, 5)}:00` : null,
      trip_1_time: data.trip_1_time ? `${data.trip_1_time.substring(0, 5)}:00` : null,
      trip_2_time: data.trip_2_time ? `${data.trip_2_time.substring(0, 5)}:00` : null,
      trip_3_time: data.trip_3_time ? `${data.trip_3_time.substring(0, 5)}:00` : null,
      trip_4_time: data.trip_4_time ? `${data.trip_4_time.substring(0, 5)}:00` : null,
      trip_5_time: data.trip_5_time ? `${data.trip_5_time.substring(0, 5)}:00` : null,
      note: data.note || null,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    setSpecialTripSchedules(prev => {
      const filtered = prev.filter(s => s.date !== data.date)
      return [...filtered, newRecord].sort((a, b) => a.date.localeCompare(b.date))
    })

    if (!isDemoMode && hasSupabaseConfig) {
      try {
        await supabase.from('special_trip_schedules').upsert(newRecord, { onConflict: 'date' })
      } catch (err) {
        console.error('Failed to save special trip schedule:', err)
        return false
      }
    }
    return true
  }

  // 特定日例外ダイヤの削除（通常ダイヤへ復元）
  const deleteSpecialTripSchedule = async (date: string): Promise<boolean> => {
    setSpecialTripSchedules(prev => {
      const updated = prev.filter(s => s.date !== date && s.id !== date)
      saveToStorage(STORAGE_KEYS.SPECIAL_SCHEDULES, updated)
      return updated
    })

    if (!isDemoMode && hasSupabaseConfig) {
      try {
        await supabase.from('special_trip_schedules').delete().eq('date', date)
      } catch (err) {
        console.error('Failed to delete special trip schedule:', err)
        return false
      }
    }
    return true
  }

  // 長期休業・学校休業期間の追加
  const addSchoolHoliday = async (data: Omit<SchoolHoliday, 'id' | 'created_at'>): Promise<SchoolHoliday> => {
    const newRecord: SchoolHoliday = {
      id: `sh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ...data,
      created_at: new Date().toISOString()
    }

    setSchoolHolidays(prev => {
      const updated = [...prev, newRecord].sort((a, b) => a.start_date.localeCompare(b.start_date))
      saveToStorage(STORAGE_KEYS.HOLIDAYS, updated)
      return updated
    })

    if (!isDemoMode && hasSupabaseConfig) {
      try {
        const { data: created, error } = await supabase.from('school_holidays').insert(data).select('*').single()
        if (error) throw error
        return created as SchoolHoliday
      } catch (err) {
        console.error('Failed to add school holiday:', err)
      }
    }
    return newRecord
  }

  // 長期休業・学校休業期間の更新
  const updateSchoolHoliday = async (id: string, updates: Partial<SchoolHoliday>): Promise<boolean> => {
    setSchoolHolidays(prev => {
      const updated = prev.map(h => h.id === id ? { ...h, ...updates } : h).sort((a, b) => a.start_date.localeCompare(b.start_date))
      saveToStorage(STORAGE_KEYS.HOLIDAYS, updated)
      return updated
    })

    if (!isDemoMode && hasSupabaseConfig) {
      try {
        const { error } = await supabase.from('school_holidays').update(updates).eq('id', id)
        if (error) throw error
      } catch (err) {
        console.error('Failed to update school holiday:', err)
        return false
      }
    }
    return true
  }

  // 長期休業・学校休業期間の削除
  const deleteSchoolHoliday = async (id: string): Promise<boolean> => {
    setSchoolHolidays(prev => {
      const updated = prev.filter(h => h.id !== id && h.holiday_name !== id && h.start_date !== id)
      saveToStorage(STORAGE_KEYS.HOLIDAYS, updated)
      return updated
    })

    if (!isDemoMode && hasSupabaseConfig) {
      try {
        const { error } = await supabase.from('school_holidays').delete().eq('id', id)
        if (error) throw error
      } catch (err) {
        console.error('Failed to delete school holiday:', err)
        return false
      }
    }
    return true
  }

  // 翌年度へ長期休業を一括複製（+1年スライド）
  const copySchoolHolidaysToNextYear = async (baseYear?: number): Promise<number> => {
    const fromYear = baseYear || new Date().getFullYear()
    const targetYear = fromYear + 1

    const baseHolidays = schoolHolidays.filter(h => h.start_date.startsWith(`${fromYear}-`))
    if (baseHolidays.length === 0) return 0

    let addedCount = 0
    const newItems: SchoolHoliday[] = []

    for (const bh of baseHolidays) {
      const shiftYear = (dateStr: string) => {
        const parts = dateStr.split('-')
        return `${targetYear}-${parts[1]}-${parts[2]}`
      }

      const newStartDate = shiftYear(bh.start_date)
      const newEndDate = shiftYear(bh.end_date)

      // 既存に同名・同期間がないか確認
      const exists = schoolHolidays.some(h => h.start_date === newStartDate && h.holiday_name === bh.holiday_name)
      if (!exists) {
        const newRecord: SchoolHoliday = {
          id: `hol-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          holiday_name: bh.holiday_name,
          start_date: newStartDate,
          end_date: newEndDate,
          holiday_type: bh.holiday_type,
          note: bh.note ? `${bh.note}（${targetYear}年度引き継ぎ）` : `${targetYear}年度引き継ぎ`,
          created_at: new Date().toISOString()
        }
        newItems.push(newRecord)
        addedCount++
      }
    }

    if (newItems.length > 0) {
      setSchoolHolidays(prev => [...prev, ...newItems].sort((a, b) => a.start_date.localeCompare(b.start_date)))
      if (!isDemoMode && hasSupabaseConfig) {
        try {
          const insertPayload = newItems.map(({ id, created_at, ...rest }) => rest)
          await supabase.from('school_holidays').insert(insertPayload)
        } catch (err) {
          console.error('Failed to clone holidays to next year in Supabase:', err)
        }
      }
    }

    return addedCount
  }

  // 月別下校便時刻の更新（空文字・'--:--'はnullとして保存）
  const updateMonthlyTripSchedule = async (month: number, updates: Partial<MonthlyTripSchedule>): Promise<boolean> => {
    const normalizedUpdates: Partial<MonthlyTripSchedule> = { ...updates }
    
    // 通常ダイヤおよび水曜ダイヤの空文字・未設定・'--:--'をnullに正規化
    const keys: (keyof MonthlyTripSchedule)[] = [
      'trip_1_time', 'trip_2_time', 'trip_3_time', 'trip_4_time', 'trip_5_time',
      'wed_trip_1_time', 'wed_trip_2_time', 'wed_trip_3_time', 'wed_trip_4_time', 'wed_trip_5_time'
    ]
    for (const key of keys) {
      if (key in normalizedUpdates) {
        const val = normalizedUpdates[key]
        if (typeof val === 'string' && (val.trim() === '' || val.trim() === '--:--' || val.trim().startsWith('--'))) {
          (normalizedUpdates as any)[key] = null
        }
      }
    }

    setMonthlyTripSchedules(prev => prev.map(s => s.month === month ? { ...s, ...normalizedUpdates } : s))

    if (!isDemoMode && hasSupabaseConfig) {
      try {
        const existing = monthlyTripSchedules.find(s => s.month === month)
        if (existing?.id && !existing.id.startsWith('mts-')) {
          await supabase.from('monthly_trip_schedules').update(normalizedUpdates).eq('month', month)
        } else {
          await supabase.from('monthly_trip_schedules').upsert({ month, ...normalizedUpdates }, { onConflict: 'month' })
        }
      } catch (err) {
        console.error('Failed to update monthly trip schedule:', err)
        return false
      }
    }
    return true
  }

  // 月別下校時刻マスターを学校標準初期パターンへリセット
  const resetMonthlyTripSchedulesToDefault = async (): Promise<boolean> => {
    setMonthlyTripSchedules(mockMonthlyTripSchedules)
    if (!isDemoMode && hasSupabaseConfig) {
      try {
        for (const item of mockMonthlyTripSchedules) {
          const { id, ...payload } = item
          await supabase.from('monthly_trip_schedules').upsert(payload, { onConflict: 'month' })
        }
      } catch (err) {
        console.error('Failed to reset monthly trip schedules:', err)
        return false
      }
    }
    return true
  }

  // 生徒マスタ管理
  const addStudent = async (studentData: Omit<Student, 'id'>): Promise<Student> => {
    const newStudent: Student = {
      id: `std-new-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ...studentData
    }
    
    if (isDemoMode || !hasSupabaseConfig) {
      setStudents(prev => [...prev, newStudent])
      return newStudent
    }

    try {
      const payload = {
        student_code: studentData.student_code || null,
        verification_code: studentData.verification_code || null,
        name: studentData.name,
        grade: studentData.grade || '1年生',
        class_name: studentData.class_name || null,
        household_id: studentData.household_id || null,
        parent_id: studentData.parent_id || null,
        bus_route_id: studentData.bus_route_id || null,
        default_bus_stop_id: studentData.default_bus_stop_id || null,
        default_morning_ride: studentData.default_morning_ride ?? true,
        default_afternoon_schedule: studentData.default_afternoon_schedule ?? '下校2便'
      }

      const { data, error } = await supabase
        .from('students')
        .insert(payload)
        .select('*')
        .single()

      if (error) {
        console.error('Supabase insert student error:', error)
        throw error
      }

      const created = data as Student
      setStudents(prev => [...prev.filter(s => s.id !== created.id), created])
      return created
    } catch (err) {
      console.error('Failed to add student to database:', err)
      setStudents(prev => [...prev, newStudent])
      return newStudent
    }
  }

  const updateStudent = async (id: string, updates: Partial<Student>): Promise<boolean> => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))

    if (!isDemoMode && hasSupabaseConfig) {
      try {
        const { error } = await supabase.from('students').update(updates).eq('id', id)
        if (error) throw error
      } catch (err) {
        console.error('Failed to update student:', err)
        return false
      }
    }
    return true
  }

  const deleteStudent = async (id: string): Promise<boolean> => {
    setStudents(prev => prev.filter(s => s.id !== id))
    setReservations(prev => prev.filter(r => r.student_id !== id))
    setRideStatuses(prev => prev.filter(r => r.student_id !== id))

    if (!isDemoMode && hasSupabaseConfig) {
      try {
        const { error } = await supabase.from('students').delete().eq('id', id)
        if (error) throw error
      } catch (err) {
        console.error('Failed to delete student:', err)
        return false
      }
    }
    return true
  }

  // バス停マスタ管理
  const addBusStop = async (busStopData: Omit<BusStop, 'id'>): Promise<BusStop> => {
    const newStop: BusStop = {
      id: `stop-new-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ...busStopData
    }

    if (isDemoMode || !hasSupabaseConfig) {
      setBusStops(prev => [...prev, newStop].sort((a, b) => a.order_index - b.order_index))
      return newStop
    }

    try {
      const { data, error } = await supabase
        .from('bus_stops')
        .insert(busStopData)
        .select('*')
        .single()
      if (error) throw error
      const created = data as BusStop
      setBusStops(prev => [...prev, created].sort((a, b) => a.order_index - b.order_index))
      return created
    } catch (err) {
      console.error('Failed to add bus stop:', err)
      setBusStops(prev => [...prev, newStop].sort((a, b) => a.order_index - b.order_index))
      return newStop
    }
  }

  const updateBusStop = async (id: string, updates: Partial<BusStop>): Promise<boolean> => {
    setBusStops(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s).sort((a, b) => a.order_index - b.order_index))

    if (!isDemoMode && hasSupabaseConfig) {
      try {
        const { error } = await supabase.from('bus_stops').update(updates).eq('id', id)
        if (error) throw error
      } catch (err) {
        console.error('Failed to update bus stop:', err)
        return false
      }
    }
    return true
  }

  const deleteBusStop = async (id: string): Promise<boolean> => {
    setBusStops(prev => prev.filter(s => s.id !== id))

    if (!isDemoMode && hasSupabaseConfig) {
      try {
        const { error } = await supabase.from('bus_stops').delete().eq('id', id)
        if (error) throw error
      } catch (err) {
        console.error('Failed to delete bus stop:', err)
        return false
      }
    }
    return true
  }

  const reorderBusStops = async (orderedStopIds: string[]): Promise<boolean> => {
    setBusStops(prev => {
      const stopMap = new Map(prev.map(s => [s.id, s]))
      const reordered: BusStop[] = []
      orderedStopIds.forEach((id, index) => {
        const stop = stopMap.get(id)
        if (stop) {
          reordered.push({ ...stop, order_index: index + 1 })
        }
      })
      return reordered
    })

    if (!isDemoMode && hasSupabaseConfig) {
      try {
        await Promise.all(
          orderedStopIds.map((id, index) =>
            supabase.from('bus_stops').update({ order_index: index + 1 }).eq('id', id)
          )
        )
      } catch (err) {
        console.error('Failed to reorder bus stops:', err)
        return false
      }
    }
    return true
  }

  // 運行ステータス・遅延・メッセージの即時更新
  const updateBusOperationStatus = async (
    date: string,
    tripName: string,
    status: 'on_time' | 'delayed' | 'arrived' | 'suspended' | 'not_started' | 'running' | 'finished',
    delayMinutes: number,
    message?: string | null,
    routeId?: string
  ): Promise<boolean> => {
    const targetRouteId = routeId || 'route-a'
    const newOperation: BusOperation = {
      id: `op-${date}-${tripName}`,
      bus_route_id: targetRouteId,
      bus_id: 'bus_1',
      date,
      operation_date: date,
      trip_name: tripName,
      trip_type: tripName,
      status,
      delay_minutes: delayMinutes,
      message: message || null,
      note: message || null,
      updated_at: new Date().toISOString()
    }

    // 楽観的ローカル更新
    setBusOperations(prev => {
      const idx = prev.findIndex(o => o.date === date && (o.trip_name === tripName || (o as any).trip_type === tripName))
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], ...newOperation }
        return copy
      }
      return [...prev, newOperation]
    })

    if (!isDemoMode && hasSupabaseConfig) {
      try {
        await supabase.from('bus_operations').upsert({
          date,
          trip_name: tripName,
          bus_route_id: targetRouteId,
          status: status as any,
          delay_minutes: delayMinutes,
          message: message || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'date,trip_name' })
      } catch (err) {
        console.warn('bus_operations upsert failed, trying service_delays fallback:', err)
        try {
          await supabase.from('service_delays').upsert({
            date,
            trip_name: tripName,
            bus_route_id: targetRouteId,
            status: (status === 'arrived' ? 'finished' : status === 'delayed' || status === 'on_time' ? 'running' : status) as any,
            delay_minutes: delayMinutes,
            message: message || null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'date,trip_name' })
        } catch (e) {
          console.error('Failed to update operation in supabase:', e)
        }
      }
    }

    return true
  }

  const isRegistered = profile !== null

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isRegistered,
        isDemoMode,
        isRealtimeConnected,
        signInWithGoogle: async () => {},
        signOut,
        signInDemoUser,
        loginAsParent,
        loginAsDriver,
        loginAsAdmin,
        verifyStudentForRegistration,
        registerParentProfile,
        
        busRoutes,
        busStops,
        students,
        reservations,
        busOperations,
        rideStatuses,
        monthlyTripSchedules,
        specialTripSchedules,
        schoolHolidays,
        getDateScheduleStatus,
        getTripTime,
        getAdjustedStopArrivalTime,
        isTripOperating,
        getShortenedDayOfWeek,
        updateMonthlyTripSchedule,
        resetMonthlyTripSchedulesToDefault,
        copySchoolHolidaysToNextYear,
        saveSpecialTripSchedule,
        deleteSpecialTripSchedule,
        addSchoolHoliday,
        updateSchoolHoliday,
        deleteSchoolHoliday,
        
        addStudent,
        updateStudent,
        deleteStudent,
        
        addBusStop,
        updateBusStop,
        deleteBusStop,
        reorderBusStops,

        updateOperation,
        updateBusOperationStatus,
        saveReservation,
        saveWeeklyReservations,
        generateNextMonthReservations,
        updateStudentRideStatus,
        refreshData
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
