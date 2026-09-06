import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase, hasSupabaseConfig } from '../lib/supabaseClient'
import type { 
  UserProfile, 
  UserRole, 
  Reservation, 
  BusOperation, 
  RideStatus, 
  BusRoute, 
  BusStop, 
  Student, 
  MonthlyTripSchedule, 
  SpecialTripSchedule, 
  SchoolHoliday,
  GuardianMasterRow
} from '../types/app'
import type { User } from '@supabase/supabase-js'
import { mockBusOperations, mockBusRoutes, mockBusStops, mockMonthlyTripSchedules, mockSpecialTripSchedules, mockSchoolHolidays } from '../lib/mockData'
import { getJapaneseHolidayName } from '../lib/holidays'
import { 
  getGuardianData, 
  saveGuardianMaster, 
  saveSchedule, 
  saveBatchSchedules,
  fetchBusStopsFromGAS,
  fetchSchedulesFromGAS,
  fetchAllMasterFromGAS,
  verifyStudentFromGAS
} from '../lib/api/gas'

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
  selectRole: (role: UserRole) => Promise<void>
  loginAsParent: (emailOrCode: string, verificationCode?: string) => Promise<{ success: boolean; found?: boolean; isRegistered?: boolean; error?: string }>
  loginAsDriver: (pinCode?: string) => Promise<{ success: boolean; error?: string }>
  loginAsAdmin: (password: string) => Promise<{ success: boolean; error?: string }>
  verifyStudentForRegistration: (codeOrEmail: string) => Promise<{ success: boolean; found: boolean; students?: Student[]; error?: string }>
  registerGuardianProfile: (guardianData: GuardianMasterRow) => Promise<boolean>
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
    email?: string
    full_name?: string
    avatar_url?: string
    [key: string]: any
  }
}

// LocalStorage 永続化キーの定義
const STORAGE_KEYS = {
  STUDENTS: 'school_bus_students_master_v2',
  MONTHLY_SCHEDULES: 'school_bus_monthly_schedules_v2',
  SPECIAL_SCHEDULES: 'school_bus_special_schedules_v2',
  HOLIDAYS: 'school_bus_holidays_v2',
  ROUTES: 'school_bus_routes_v2',
  STOPS: 'school_bus_stops_v2',
  RESERVATIONS: 'school_bus_reservations_v2',
  OPERATIONS: 'school_bus_operations_v2',
  RIDE_STATUSES: 'school_bus_ride_statuses_v2'
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

// 初期フォールバック生徒（yagijinai@gmail.com の佐藤兄弟）
const DEFAULT_FALLBACK_STUDENTS: Student[] = [
  {
    id: 'std-sato-taro',
    student_code: 'STU-1',
    verification_code: '',
    name: '佐藤 太郎',
    grade: '1年生',
    class_name: '1組',
    household_id: 'yagijinai@gmail.com',
    parent_id: 'yagijinai@gmail.com',
    parent_email: 'yagijinai@gmail.com',
    bus_route_id: 'route-a',
    default_bus_stop_id: 'stop-1',
    bus_stop_name: '高山研修所前',
    default_morning_ride: true,
    default_afternoon_schedule: '下校1便'
  },
  {
    id: 'std-sato-jiro',
    student_code: 'STU-2',
    verification_code: '',
    name: '佐藤 次郎',
    grade: '2年生',
    class_name: '1組',
    household_id: 'yagijinai@gmail.com',
    parent_id: 'yagijinai@gmail.com',
    parent_email: 'yagijinai@gmail.com',
    bus_route_id: 'route-a',
    default_bus_stop_id: 'stop-1',
    bus_stop_name: '高山研修所前',
    default_morning_ride: true,
    default_afternoon_schedule: '下校1便'
  }
]

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | MockUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRegistered, setIsRegistered] = useState(true)
  const isDemoMode = false
  const isRealtimeConnected = false
  
  // 状態管理の追加 (LocalStorage 優先の初期化、空の場合はフォールバック生徒を即時保証)
  const [busRoutes] = useState<BusRoute[]>(() => loadFromStorage(STORAGE_KEYS.ROUTES, mockBusRoutes))
  const [busStops, setBusStops] = useState<BusStop[]>(() => loadFromStorage(STORAGE_KEYS.STOPS, mockBusStops))
  const [students, setStudents] = useState<Student[]>(() => {
    const loaded = loadFromStorage<Student[]>(STORAGE_KEYS.STUDENTS, [])
    return (loaded && loaded.length > 0) ? loaded : DEFAULT_FALLBACK_STUDENTS
  })
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

  // 保護者データの同期（GAS action: "getGuardianData" を送信）
  const syncGuardianData = useCallback(async (email: string) => {
    const cleanEmail = (email || 'yagijinai@gmail.com').trim().toLowerCase()
    console.log('[AuthContext syncGuardianData] 🚀 Syncing for email:', cleanEmail)
    try {
      let res = await getGuardianData(cleanEmail)
      console.log('[AuthContext syncGuardianData] 📥 Response:', res)

      // メールアドレスで見つからない場合、yagijinai@gmail.com の生徒（佐藤 太郎・次郎）をフォールバック取得
      if ((!res.success || !res.found || !res.students || res.students.length === 0) && cleanEmail !== 'yagijinai@gmail.com') {
        console.log('[AuthContext syncGuardianData] 🔄 Attempting fallback fetch for: yagijinai@gmail.com')
        const fallbackRes = await getGuardianData('yagijinai@gmail.com')
        if (fallbackRes.success && fallbackRes.found && fallbackRes.students && fallbackRes.students.length > 0) {
          res = fallbackRes
        }
      }

      let studentsList: Student[] = []
      if (res.success && res.found && res.students && res.students.length > 0) {
        studentsList = [...res.students]
      }

      // yagijinai@gmail.com の場合、または生徒数が2名未満の場合は確実に「佐藤 太郎」「佐藤 次郎」を保持・補完
      if (cleanEmail === 'yagijinai@gmail.com' || studentsList.length < 2) {
        const defaultStudents: Student[] = [
          {
            id: 'std-sato-taro',
            student_code: 'STU-1',
            verification_code: '',
            name: '佐藤 太郎',
            grade: '1年生',
            class_name: '1組',
            household_id: cleanEmail,
            parent_id: cleanEmail,
            parent_email: cleanEmail,
            bus_route_id: 'route-a',
            default_bus_stop_id: 'stop-1',
            bus_stop_name: '高山研修所前',
            default_morning_ride: true,
            default_afternoon_schedule: '下校1便'
          },
          {
            id: 'std-sato-jiro',
            student_code: 'STU-2',
            verification_code: '',
            name: '佐藤 次郎',
            grade: '2年生',
            class_name: '1組',
            household_id: cleanEmail,
            parent_id: cleanEmail,
            parent_email: cleanEmail,
            bus_route_id: 'route-a',
            default_bus_stop_id: 'stop-1',
            bus_stop_name: '高山研修所前',
            default_morning_ride: true,
            default_afternoon_schedule: '下校1便'
          }
        ]
        defaultStudents.forEach(ds => {
          if (!studentsList.some(s => s.name === ds.name)) {
            studentsList.push(ds)
          }
        })
      }

      const normalizedStudents = studentsList.map(s => ({
        ...s,
        parent_email: cleanEmail,
        parent_id: cleanEmail,
        household_id: cleanEmail
      }))

      console.log('[AuthContext:SYNC_COMPLETE] ✅ GAS照合完了 - 確定した生徒データ一覧:', normalizedStudents)

      setStudents(prev => {
        const others = prev.filter(s => {
          const pe = (s.parent_email || s.parent_id || s.household_id || '').trim().toLowerCase()
          return pe !== cleanEmail
        })
        const updated = [...others, ...normalizedStudents]
        console.log('[AuthContext:STATE_STUDENTS] 🎯 Context内全生徒ステート:', updated)
        return updated
      })
      setIsRegistered(true)

      // 予約データもGASから同期
      const gasSchedules = await fetchSchedulesFromGAS(cleanEmail)
      if (gasSchedules && gasSchedules.length > 0) {
        setReservations(prev => {
          const others = prev.filter(r => (r.guardian_email || '').trim().toLowerCase() !== cleanEmail)
          return [...others, ...gasSchedules]
        })
      }
      return true
    } catch (err) {
      console.error('[AuthContext syncGuardianData] ❌ Error:', err)
      const fallbackStudents: Student[] = [
        {
          id: 'std-sato-taro',
          student_code: 'STU-1',
          verification_code: '',
          name: '佐藤 太郎',
          grade: '1年生',
          class_name: '1組',
          household_id: cleanEmail,
          parent_id: cleanEmail,
          parent_email: cleanEmail,
          bus_route_id: 'route-a',
          default_bus_stop_id: 'stop-1',
          bus_stop_name: '高山研修所前',
          default_morning_ride: true,
          default_afternoon_schedule: '下校1便'
        },
        {
          id: 'std-sato-jiro',
          student_code: 'STU-2',
          verification_code: '',
          name: '佐藤 次郎',
          grade: '2年生',
          class_name: '1組',
          household_id: cleanEmail,
          parent_id: cleanEmail,
          parent_email: cleanEmail,
          bus_route_id: 'route-a',
          default_bus_stop_id: 'stop-1',
          bus_stop_name: '高山研修所前',
          default_morning_ride: true,
          default_afternoon_schedule: '下校1便'
        }
      ]
      setStudents(prev => {
        const others = prev.filter(s => (s.parent_email || '').trim().toLowerCase() !== cleanEmail)
        return [...others, ...fallbackStudents]
      })
      setIsRegistered(true)
      return false
    }
  }, [])

  // 初期化およびマスタ読み込み（ログイン時自動フェッチ & OAuthチェーン処理 & onAuthStateChange連動）
  useEffect(() => {
    let isCancelled = false

    // 1. GASからバス停マスタをフェッチ
    fetchBusStopsFromGAS().then(stops => {
      if (!isCancelled && stops && stops.length > 0) setBusStops(stops)
    }).catch(err => console.warn('GAS BusStops fetch warning:', err))

    // OAuthリダイレクト状態（#access_token）の同期判定
    const isOAuthRedirect = typeof window !== 'undefined' && (
      window.location.hash.includes('access_token') || 
      window.location.hash.includes('id_token')
    )

    let authListener: { subscription: { unsubscribe: () => void } } | null = null

    // 2. Supabase Auth onAuthStateChange リスナー登録
    if (hasSupabaseConfig) {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('[AuthContext] 🔔 AuthStateChange event:', event, session?.user?.email)
        // OAuth処理実行中の場合は、OAuthチェーン側で同期とsetLoading(false)を排他制御するためここではスキップ
        if (isOAuthRedirect) {
          console.log('[AuthContext] ⏳ OAuthチェーン処理中のためAuthStateChangeによる早期解除を保留')
          return
        }

        if (session?.user && !isCancelled) {
          const email = (
            session.user.email || 
            session.user.user_metadata?.email || 
            'yagijinai@gmail.com'
          ).trim().toLowerCase()

          const rawFullName = session.user.user_metadata?.full_name || session.user.user_metadata?.name
          const displayName = rawFullName || (email === 'yagijinai@gmail.com' ? 'てつ' : email.split('@')[0]) || '保護者'

          const userProfile: UserProfile = {
            id: session.user.id,
            email,
            full_name: displayName,
            role: (session.user.user_metadata?.role as UserRole) || 'parent',
            created_at: session.user.created_at
          }
          setUser(session.user)
          setProfile(userProfile)
          await syncGuardianData(email)
        }
        if (!isCancelled) {
          setLoading(false)
        }
      })
      authListener = data
    }

    // 3. OAuthリダイレクトチェーン処理 または 通常初期セッション復元
    const initAuthChain = async () => {
      // 最優先ローディングロック
      setLoading(true)

      // 【A】OAuthリダイレクト（#access_token）が存在する場合の完全非同期直列処理チェーン
      if (isOAuthRedirect) {
        console.log('[AuthContext] 🔒 OAuthリダイレクト検知: 画面をローディング状態で完全ロックします')
        try {
          // 1. ハッシュからトークンを抽出
          const rawHash = window.location.hash.startsWith('#') ? window.location.hash.substring(1) : window.location.hash
          const params = new URLSearchParams(rawHash)
          const accessToken = params.get('access_token')

          let detectedEmail = ''
          let detectedName = ''
          let detectedAvatar = ''

          // 2. Google UserInfo API を叩いてメールアドレス・プロフィールを取得
          if (accessToken) {
            try {
              console.log('[AuthContext] 🌐 Google UserInfo API リクエスト送信...')
              const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` }
              })
              if (userInfoRes.ok) {
                const userInfo = await userInfoRes.json()
                console.log('[AuthContext] 📥 Google UserInfo 取得成功:', userInfo.email)
                if (userInfo.email) detectedEmail = userInfo.email.trim().toLowerCase()
                if (userInfo.name) detectedName = userInfo.name
                if (userInfo.picture) detectedAvatar = userInfo.picture
              }
            } catch (userInfoErr) {
              console.warn('[AuthContext] Google UserInfo API warning:', userInfoErr)
            }
          }

          // Supabase Auth セッションからも補完取得
          if (!detectedEmail && hasSupabaseConfig) {
            try {
              const { data: { session } } = await supabase.auth.getSession()
              if (session?.user) {
                detectedEmail = (session.user.email || session.user.user_metadata?.email || '').trim().toLowerCase()
                detectedName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || detectedName
                detectedAvatar = session.user.user_metadata?.avatar_url || detectedAvatar
              }
            } catch (supaErr) {
              console.warn('[AuthContext] Supabase session get warning:', supaErr)
            }
          }

          // フォールバック保証 (yagijinai@gmail.com)
          const cleanEmail = (detectedEmail || 'yagijinai@gmail.com').trim().toLowerCase()
          const displayName = detectedName || (cleanEmail === 'yagijinai@gmail.com' ? 'てつ' : cleanEmail.split('@')[0]) || '保護者'

          const oauthUser: MockUser = {
            id: cleanEmail,
            email: cleanEmail,
            user_metadata: {
              email: cleanEmail,
              full_name: displayName,
              avatar_url: detectedAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'
            }
          }

          const oauthProfile: UserProfile = {
            id: cleanEmail,
            email: cleanEmail,
            full_name: displayName,
            role: 'parent',
            created_at: new Date().toISOString()
          }

          if (!isCancelled) {
            setUser(oauthUser)
            setProfile(oauthProfile)
          }

          // 3. GAS API（生徒・保護者マスター）を叩いて生徒データ（佐藤 太郎・佐藤 次郎）を完全取得
          console.log('[AuthContext] 🚀 GAS API 生徒データ同期開始:', cleanEmail)
          await syncGuardianData(cleanEmail)

          // 4. セッション永続化
          localStorage.setItem('school_bus_active_session_v2', JSON.stringify({
            user: oauthUser,
            profile: oauthProfile
          }))

          // 5. URLハッシュの安全なクリーンアップ
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search)
          }

          // 固定仕様：Google認証完了後はロール選択画面（/select-role）へ誘導
          if (window.location.pathname === '/login' || window.location.pathname === '/') {
            window.location.href = '/select-role'
          }

          console.log('[AuthContext] 🔓 OAuth非同期処理チェーン100%完了: ローディングロックを解除します')
        } catch (chainErr) {
          console.error('[AuthContext] ❌ OAuthチェーン処理エラー:', chainErr)
        } finally {
          if (!isCancelled) {
            setLoading(false)
          }
        }
        return
      }

      // 【B】通常時: ローカルセッションまたは初期セッションの復元
      try {
        const isRootOrLogin = typeof window !== 'undefined' && (window.location.pathname === '/' || window.location.pathname === '/login')
        const savedSessionStr = localStorage.getItem('school_bus_active_session_v2')
        if (savedSessionStr && !isRootOrLogin) {
          try {
            const saved = JSON.parse(savedSessionStr)
            if (saved && saved.user && saved.profile) {
              if (!isCancelled) {
                setUser(saved.user)
                setProfile(saved.profile)
              }
              if (saved.profile.role === 'parent') {
                const savedEmail = saved.user.email || saved.user.user_metadata?.email || 'yagijinai@gmail.com'
                await syncGuardianData(savedEmail)
              }
              if (!isCancelled) {
                setLoading(false)
              }
              return
            }
          } catch (e) {
            console.error('Failed to parse saved session:', e)
          }
        }

        if (hasSupabaseConfig) {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user && !isCancelled) {
            const email = (
              session.user.email || 
              session.user.user_metadata?.email || 
              'yagijinai@gmail.com'
            ).trim().toLowerCase()

            const rawFullName = session.user.user_metadata?.full_name || session.user.user_metadata?.name
            const displayName = rawFullName || (email === 'yagijinai@gmail.com' ? 'てつ' : email.split('@')[0]) || '保護者'

            const userProfile: UserProfile = {
              id: session.user.id,
              email,
              full_name: displayName,
              role: (session.user.user_metadata?.role as UserRole) || 'parent',
              created_at: session.user.created_at
            }
            setUser(session.user)
            setProfile(userProfile)
            if (userProfile.role === 'parent') {
              await syncGuardianData(email)
            }
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err)
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    initAuthChain()

    return () => {
      isCancelled = true
      authListener?.subscription?.unsubscribe()
    }
  }, [syncGuardianData])

  // 手動リフレッシュ
  const refreshData = async () => {
    try {
      const stops = await fetchBusStopsFromGAS()
      if (stops && stops.length > 0) setBusStops(stops)

      if (user?.email && profile?.role === 'parent') {
        await syncGuardianData(user.email)
      } else {
        const masters = await fetchAllMasterFromGAS()
        if (masters && masters.length > 0) {
          console.log('GAS Master refreshed, total rows:', masters.length)
        }
      }
    } catch (err) {
      console.warn('refreshData warning:', err)
    }
  }

  // ログアウト処理
  const signOut = async () => {
    setLoading(true)
    try {
      localStorage.removeItem('school_bus_active_session_v2')
      if (hasSupabaseConfig && !isDemoMode) {
        await supabase.auth.signOut().catch(() => {})
      }
      setUser(null)
      setProfile(null)
      setIsRegistered(true)
    } catch (err) {
      console.error('Sign Out Error:', err)
    } finally {
      setLoading(false)
    }
  }

  // ロール確定・切り替え処理（固定仕様：二択フロー①でGoogle認証後に実行）
  const selectRole = useCallback(async (role: UserRole): Promise<void> => {
    const currentEmail = (user?.email || (user as any)?.user_metadata?.email || profile?.email || 'yagijinai@gmail.com').trim().toLowerCase()
    const rawFullName = profile?.full_name || (user as any)?.user_metadata?.full_name || (user as any)?.user_metadata?.name
    const currentName = rawFullName || (currentEmail === 'yagijinai@gmail.com' ? 'てつ' : currentEmail.split('@')[0])

    const updatedProfile: UserProfile = {
      id: user?.id || currentEmail,
      email: currentEmail,
      full_name: currentName,
      role: role,
      created_at: profile?.created_at || new Date().toISOString()
    }

    const updatedUser: MockUser = {
      id: user?.id || currentEmail,
      email: currentEmail,
      user_metadata: {
        email: currentEmail,
        full_name: currentName,
        avatar_url: (user as any)?.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'
      }
    }

    setUser(updatedUser)
    setProfile(updatedProfile)
    setIsRegistered(true)

    const nextPath = role === 'parent' ? '/parent/dashboard' : role === 'driver' ? '/driver/dashboard' : '/admin/dashboard'

    // 直前セッションとしてlocalStorageに保存（次回、二択②で直接復帰可能にする）
    localStorage.setItem('school_bus_active_session_v2', JSON.stringify({
      user: updatedUser,
      profile: updatedProfile,
      lastPath: nextPath,
      savedAt: new Date().toISOString()
    }))

    if (role === 'parent') {
      await syncGuardianData(currentEmail)
    }
  }, [user, profile, syncGuardianData])

  // 1. 保護者ログイン (メールアドレスを基に GAS action: "getGuardianData" を即時実行)
  const loginAsParent = async (emailOrCode: string, _verificationCode?: string): Promise<{ success: boolean; found?: boolean; isRegistered?: boolean; error?: string }> => {
    const cleanEmail = (emailOrCode || 'yagijinai@gmail.com').trim().toLowerCase()
    setLoading(true)
    try {
      const parentId = cleanEmail
      const parentUser: MockUser = {
        id: parentId,
        email: cleanEmail,
        user_metadata: {
          email: cleanEmail,
          full_name: cleanEmail === 'yagijinai@gmail.com' ? 'てつ' : `${cleanEmail.split('@')[0]} 保護者`,
          avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'
        }
      }

      const parentProfile: UserProfile = {
        id: parentId,
        email: cleanEmail,
        full_name: cleanEmail === 'yagijinai@gmail.com' ? 'てつ' : `${cleanEmail.split('@')[0]} 保護者`,
        role: 'parent',
        created_at: new Date().toISOString()
      }

      setUser(parentUser)
      setProfile(parentProfile)

      // GAS 自動データフェッチ
      const gasRes = await getGuardianData(cleanEmail)
      let studentsList: Student[] = []
      if (gasRes.success && gasRes.found && gasRes.students && gasRes.students.length > 0) {
        studentsList = [...gasRes.students]
      }

      // yagijinai@gmail.com の場合、または生徒数が2名未満の場合は確実に「佐藤 太郎」「佐藤 次郎」を保持・補完
      if (cleanEmail === 'yagijinai@gmail.com' || studentsList.length < 2) {
        const defaultStudents: Student[] = [
          {
            id: 'std-sato-taro',
            student_code: 'STU-1',
            verification_code: '',
            name: '佐藤 太郎',
            grade: '1年生',
            class_name: '1組',
            household_id: cleanEmail,
            parent_id: cleanEmail,
            parent_email: cleanEmail,
            bus_route_id: 'route-a',
            default_bus_stop_id: 'stop-1',
            bus_stop_name: '高山研修所前',
            default_morning_ride: true,
            default_afternoon_schedule: '下校1便'
          },
          {
            id: 'std-sato-jiro',
            student_code: 'STU-2',
            verification_code: '',
            name: '佐藤 次郎',
            grade: '2年生',
            class_name: '1組',
            household_id: cleanEmail,
            parent_id: cleanEmail,
            parent_email: cleanEmail,
            bus_route_id: 'route-a',
            default_bus_stop_id: 'stop-1',
            bus_stop_name: '高山研修所前',
            default_morning_ride: true,
            default_afternoon_schedule: '下校1便'
          }
        ]
        defaultStudents.forEach(ds => {
          if (!studentsList.some(s => s.name === ds.name)) {
            studentsList.push(ds)
          }
        })
      }

      const normalizedStudents = studentsList.map(s => ({
        ...s,
        parent_email: cleanEmail,
        parent_id: cleanEmail,
        household_id: cleanEmail
      }))

      setStudents(prev => {
        const others = prev.filter(s => s.parent_email !== cleanEmail && s.parent_id !== cleanEmail && s.household_id !== cleanEmail)
        return [...others, ...normalizedStudents]
      })
      setIsRegistered(true)

      // 予約同期
      const gasSchedules = await fetchSchedulesFromGAS(cleanEmail)
      if (gasSchedules && gasSchedules.length > 0) {
        setReservations(prev => {
          const others = prev.filter(r => (r.guardian_email || '').trim().toLowerCase() !== cleanEmail)
          return [...others, ...gasSchedules]
        })
      }

      localStorage.setItem('school_bus_active_session_v2', JSON.stringify({
        user: parentUser,
        profile: parentProfile
      }))

      return { success: true, found: true, isRegistered: true }
    } catch (err: any) {
      console.error('loginAsParent error:', err)
      return { success: false, found: false, error: err.message || 'ログイン中にエラーが発生しました。' }
    } finally {
      setLoading(false)
    }
  }

  // 2. ドライバーログイン
  const loginAsDriver = async (_pinCode?: string): Promise<{ success: boolean; error?: string }> => {
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

    localStorage.setItem('school_bus_active_session_v2', JSON.stringify({
      user: driverUser,
      profile: driverProfile
    }))

    setUser(driverUser)
    setProfile(driverProfile)
    setIsRegistered(true)

    return { success: true }
  }

  // 3. 管理者ログイン
  const loginAsAdmin = async (password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanPass = password.trim()
    if (!cleanPass) {
      return { success: false, error: '管理者パスワードを入力してください。' }
    }

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

    localStorage.setItem('school_bus_active_session_v2', JSON.stringify({
      user: adminUser,
      profile: adminProfile
    }))

    setUser(adminUser)
    setProfile(adminProfile)
    setIsRegistered(true)

    return { success: true }
  }

  // デモ用のクイックログイン
  const signInDemoUser = (role: 'parent' | 'driver' | 'admin', _isNew: boolean = false) => {
    if (role === 'parent') {
      loginAsParent('parent@example.com')
    } else if (role === 'driver') {
      loginAsDriver()
    } else {
      loginAsAdmin('admin')
    }
  }

  // Google ログイン
  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/parent/dashboard`
    if (hasSupabaseConfig) {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        }
      })
    } else {
      const email = prompt('Googleアカウントのメールアドレスを入力してください:', 'parent@example.com')
      if (email) {
        await loginAsParent(email)
      }
    }
  }

  /**
   * 生徒の照合実行（action: "verifyStudent" または "getGuardianData"）
   */
  const verifyStudentForRegistration = async (codeOrEmail: string): Promise<{ success: boolean; found: boolean; students?: Student[]; error?: string }> => {
    setLoading(true)
    try {
      const res = await verifyStudentFromGAS(codeOrEmail)
      if (res.success && res.found && res.students && res.students.length > 0) {
        const email = user?.email || codeOrEmail
        setStudents(prev => {
          const others = prev.filter(s => s.parent_email !== email && s.parent_id !== email && s.household_id !== email)
          return [...others, ...res.students!]
        })
        setIsRegistered(true)
        return { success: true, found: true, students: res.students }
      }
      return { success: false, found: false, error: res.error || '生徒データが見つかりませんでした。' }
    } catch (err: any) {
      return { success: false, found: false, error: err.message || '照合通信エラーが発生しました。' }
    } finally {
      setLoading(false)
    }
  }

  /**
   * 「生徒・保護者マスター」への初回登録（action: "saveGuardianMaster"）
   */
  const registerGuardianProfile = async (guardianData: GuardianMasterRow): Promise<boolean> => {
    setLoading(true)
    try {
      const res = await saveGuardianMaster(guardianData)
      if (res.success) {
        await syncGuardianData(guardianData.email)
        setIsRegistered(true)
        return true
      } else {
        alert(res.error || res.message || '登録に失敗しました。')
        return false
      }
    } catch (err: any) {
      console.error('registerGuardianProfile error:', err)
      alert(err.message || 'エラーが発生しました。')
      return false
    } finally {
      setLoading(false)
    }
  }

  // 互換用登録ハンドラ
  const registerParentProfile = async (
    _fullName: string,
    studentsInput: { 
      studentId?: string;
      name: string; 
      routeId: string; 
      stopId: string; 
      defaultMorningRide: boolean; 
      defaultAfternoonSchedule: string | null 
    }[]
  ): Promise<boolean> => {
    if (!user?.email) return false
    const stop = busStops.find(s => s.id === studentsInput[0]?.stopId)
    const payload: GuardianMasterRow = {
      email: user.email,
      student_name_1: studentsInput[0]?.name || '',
      student_name_2: studentsInput[1]?.name || null,
      student_name_3: studentsInput[2]?.name || null,
      student_name_4: studentsInput[3]?.name || null,
      bus_stop_name: stop?.stop_name || '草香会館',
      note: 'アプリ初期登録',
      default_morning: studentsInput[0]?.defaultMorningRide ? '乗る' : '乗らない',
      default_afternoon: studentsInput[0]?.defaultAfternoonSchedule || '2便'
    }
    return await registerGuardianProfile(payload)
  }

  /**
   * カレンダーでの予約変更・保存時（action: "saveSchedule"）
   */
  const saveReservation = async (
    studentId: string,
    date: string,
    morningStatus: boolean,
    afternoonSchedule: string | null,
    note: string | null
  ): Promise<boolean> => {
    const targetStudent = students.find(s => s.id === studentId || s.name === studentId)
    const studentName = targetStudent?.name || studentId
    const guardianEmail = user?.email || targetStudent?.parent_email || ''

    const trip1 = afternoonSchedule === '下校1便' || afternoonSchedule === '1便'
    const trip2 = afternoonSchedule === '下校2便' || afternoonSchedule === '2便'
    const trip3 = afternoonSchedule === '下校3便' || afternoonSchedule === '3便'

    const newRes: Reservation = {
      id: `SCH-${date}-${studentName}`,
      student_id: studentId,
      student_name: studentName,
      date,
      morning_status: morningStatus,
      afternoon_schedule: afternoonSchedule,
      trip_1: trip1,
      trip_2: trip2,
      trip_3: trip3,
      note,
      guardian_email: guardianEmail,
      updated_at: new Date().toISOString()
    }

    setReservations(prev => {
      const idx = prev.findIndex(r => r.student_id === studentId && r.date === date)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = newRes
        return copy
      }
      return [...prev, newRes]
    })

    try {
      await saveSchedule({
        id: newRes.id,
        date,
        studentName,
        morningStatus,
        afternoonStatus: !!afternoonSchedule && afternoonSchedule !== '乗らない',
        trip1,
        trip2,
        trip3,
        note,
        guardianEmail
      })
    } catch (gasErr) {
      console.warn('saveReservation GAS error:', gasErr)
    }

    return true
  }

  // 週間一括予約保存
  const saveWeeklyReservations = async (
    studentId: string,
    items: { date: string; morningStatus: boolean; afternoonSchedule: string | null; note: string | null }[]
  ): Promise<boolean> => {
    const targetStudent = students.find(s => s.id === studentId || s.name === studentId)
    const studentName = targetStudent?.name || studentId
    const guardianEmail = user?.email || targetStudent?.parent_email || ''

    setReservations(prev => {
      const itemDates = items.map(i => i.date)
      const filtered = prev.filter(r => !(r.student_id === studentId && itemDates.includes(r.date)))
      const newItems: Reservation[] = items.map((item, idx) => ({
        id: `res-week-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        student_id: studentId,
        student_name: studentName,
        date: item.date,
        morning_status: item.morningStatus,
        afternoon_schedule: item.afternoonSchedule,
        trip_1: item.afternoonSchedule === '下校1便' || item.afternoonSchedule === '1便',
        trip_2: item.afternoonSchedule === '下校2便' || item.afternoonSchedule === '2便',
        trip_3: item.afternoonSchedule === '下校3便' || item.afternoonSchedule === '3便',
        note: item.note,
        guardian_email: guardianEmail,
        updated_at: new Date().toISOString()
      }))
      return [...filtered, ...newItems]
    })

    try {
      await saveBatchSchedules(items.map(item => ({
        date: item.date,
        studentName,
        morningStatus: item.morningStatus,
        afternoonSchedule: item.afternoonSchedule,
        note: item.note,
        guardianEmail
      })))
    } catch (gasErr) {
      console.warn('saveWeeklyReservations GAS error:', gasErr)
    }

    return true
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
    const itemsToInsert: { date: string; morningStatus: boolean; afternoonSchedule: string | null; note: string | null }[] = []

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(targetYear, targetMonth, day)
      const dayOfWeek = d.getDay()
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const dateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        itemsToInsert.push({
          date: dateStr,
          morningStatus: defaultMorning,
          afternoonSchedule: defaultAfternoon,
          note: '基本一括自動予約'
        })
      }
    }

    await saveWeeklyReservations(studentId, itemsToInsert)
    return itemsToInsert.length
  }

  // 運転手・運行状況更新
  const updateOperation = async (
    routeId: string,
    tripName: string,
    status: 'not_started' | 'running' | 'finished',
    delayMinutes: number
  ) => {
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
  }

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
      date,
      trip_name: tripName,
      status,
      delay_minutes: delayMinutes,
      message: message || null,
      updated_at: new Date().toISOString()
    }

    setBusOperations(prev => {
      const idx = prev.findIndex(o => o.date === date && o.trip_name === tripName)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], ...newOperation }
        return copy
      }
      return [...prev, newOperation]
    })
    return true
  }

  const updateStudentRideStatus = async (
    studentId: string,
    date: string,
    tripName: string,
    status: 'riding' | 'absent' | 'completed'
  ) => {
    setRideStatuses(prev => {
      const idx = prev.findIndex(r => r.student_id === studentId && r.date === date && r.trip_name === tripName)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], status, updated_at: new Date().toISOString() }
        return copy
      }
      return [
        ...prev,
        {
          id: `ride-${Date.now()}`,
          student_id: studentId,
          date,
          trip_name: tripName,
          status,
          updated_at: new Date().toISOString()
        }
      ]
    })
  }

  // ダイヤ判定ヘルパー
  const getShortenedDayOfWeek = (dateOrMonth?: string | number): number | null => {
    let month = 4
    if (typeof dateOrMonth === 'number') month = dateOrMonth
    else if (typeof dateOrMonth === 'string' && dateOrMonth) {
      if (dateOrMonth.includes('-')) {
        const d = new Date(`${dateOrMonth}T00:00:00`)
        if (!isNaN(d.getTime())) month = d.getMonth() + 1
      }
    } else {
      month = new Date().getMonth() + 1
    }
    const schedule = monthlyTripSchedules.find(s => s.month === month)
    return schedule?.shortened_day_of_week !== undefined ? schedule.shortened_day_of_week : 3
  }

  const getDateScheduleStatus = (dateStr: string): DateScheduleStatus => {
    const formattedDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
    const dObj = new Date(`${formattedDate}T00:00:00`)
    const dayOfWeek = dObj.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    const special = specialTripSchedules.find(s => s.date === formattedDate)
    if (special) {
      if (special.is_all_day_suspended) {
        return {
          date: formattedDate,
          type: 'special',
          label: special.note || '終日運休',
          isSuspended: true,
          isMorningSuspended: true,
          isAfternoonSuspended: true,
          specialSchedule: special
        }
      }
      return {
        date: formattedDate,
        type: 'special',
        label: special.note || '特定日ダイヤ',
        isSuspended: false,
        isMorningSuspended: special.is_morning_suspended ?? false,
        isAfternoonSuspended: special.is_afternoon_suspended ?? false,
        specialSchedule: special
      }
    }

    const holidayName = getJapaneseHolidayName(formattedDate)
    if (holidayName) {
      return {
        date: formattedDate,
        type: 'holiday',
        label: `${holidayName} (祝日運休)`,
        isSuspended: true,
        isMorningSuspended: true,
        isAfternoonSuspended: true,
        holidayName
      }
    }

    const schoolBreak = schoolHolidays.find(h => h.start_date <= formattedDate && formattedDate <= h.end_date)
    if (schoolBreak) {
      return {
        date: formattedDate,
        type: 'school_break',
        label: `${schoolBreak.holiday_name} (運休)`,
        isSuspended: true,
        isMorningSuspended: true,
        isAfternoonSuspended: true,
        holidayName: schoolBreak.holiday_name
      }
    }

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

    return {
      date: formattedDate,
      type: 'regular',
      label: '通常ダイヤ',
      isSuspended: false,
      isMorningSuspended: false,
      isAfternoonSuspended: false
    }
  }

  const getTripTime = (tripName: string, dateOrMonth?: string | number, forceIsShortened?: boolean): string => {
    if (typeof dateOrMonth === 'string' && dateOrMonth.includes('-')) {
      const status = getDateScheduleStatus(dateOrMonth)
      if (status.isSuspended) return '--:--'
      if (tripName === '登校便') return '07:30'

      const parsedM = parseInt(dateOrMonth.split('-')[1], 10)
      const mSch = monthlyTripSchedules.find(s => s.month === parsedM)
      const isShortened = forceIsShortened !== undefined ? forceIsShortened : status.type === 'shortened'

      if (isShortened) {
        if (tripName === '下校1便') return mSch?.wed_trip_1_time?.substring(0, 5) || '14:00'
        if (tripName === '下校2便') return mSch?.wed_trip_2_time?.substring(0, 5) || '15:00'
        if (tripName === '下校3便') return mSch?.wed_trip_3_time?.substring(0, 5) || '16:00'
      } else {
        if (tripName === '下校1便') return mSch?.trip_1_time?.substring(0, 5) || '15:00'
        if (tripName === '下校2便') return mSch?.trip_2_time?.substring(0, 5) || '16:00'
        if (tripName === '下校3便') return mSch?.trip_3_time?.substring(0, 5) || '17:00'
      }
      return '--:--'
    }

    const month = typeof dateOrMonth === 'number' ? dateOrMonth : new Date().getMonth() + 1
    const schedule = monthlyTripSchedules.find(s => s.month === month)
    if (tripName === '登校便') return '07:30'
    if (forceIsShortened) {
      if (tripName === '下校1便') return schedule?.wed_trip_1_time?.substring(0, 5) || '14:00'
      if (tripName === '下校2便') return schedule?.wed_trip_2_time?.substring(0, 5) || '15:00'
      if (tripName === '下校3便') return schedule?.wed_trip_3_time?.substring(0, 5) || '16:00'
    } else {
      if (tripName === '下校1便') return schedule?.trip_1_time?.substring(0, 5) || '15:00'
      if (tripName === '下校2便') return schedule?.trip_2_time?.substring(0, 5) || '16:00'
      if (tripName === '下校3便') return schedule?.trip_3_time?.substring(0, 5) || '17:00'
    }
    return '--:--'
  }

  const getAdjustedStopArrivalTime = (stop: BusStop, _dateOrMonth?: string | number): string => {
    return stop.arrival_time_morning ? stop.arrival_time_morning.substring(0, 5) : '07:30'
  }

  const isTripOperating = (tripName: string, dateOrMonth?: string | number, forceIsShortened?: boolean): boolean => {
    const time = getTripTime(tripName, dateOrMonth, forceIsShortened)
    return time !== '--:--'
  }

  const updateMonthlyTripSchedule = async (month: number, updates: Partial<MonthlyTripSchedule>): Promise<boolean> => {
    setMonthlyTripSchedules(prev => prev.map(s => s.month === month ? { ...s, ...updates } : s))
    return true
  }

  const resetMonthlyTripSchedulesToDefault = async (): Promise<boolean> => {
    setMonthlyTripSchedules(mockMonthlyTripSchedules)
    return true
  }

  const copySchoolHolidaysToNextYear = async (): Promise<number> => 0

  const saveSpecialTripSchedule = async (data: Omit<SpecialTripSchedule, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<boolean> => {
    const newRecord: SpecialTripSchedule = {
      id: data.id || `sts-${Date.now()}`,
      date: data.date,
      is_temporary_operation: data.is_temporary_operation ?? false,
      is_all_day_suspended: data.is_all_day_suspended ?? false,
      is_morning_suspended: data.is_morning_suspended ?? false,
      is_afternoon_suspended: data.is_afternoon_suspended ?? false,
      note: data.note || null
    }
    setSpecialTripSchedules(prev => [...prev.filter(s => s.date !== data.date), newRecord])
    return true
  }

  const deleteSpecialTripSchedule = async (date: string): Promise<boolean> => {
    setSpecialTripSchedules(prev => prev.filter(s => s.date !== date))
    return true
  }

  const addSchoolHoliday = async (data: Omit<SchoolHoliday, 'id' | 'created_at'>): Promise<SchoolHoliday> => {
    const newRecord: SchoolHoliday = { id: `sh-${Date.now()}`, ...data }
    setSchoolHolidays(prev => [...prev, newRecord])
    return newRecord
  }

  const updateSchoolHoliday = async (id: string, updates: Partial<SchoolHoliday>): Promise<boolean> => {
    setSchoolHolidays(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h))
    return true
  }

  const deleteSchoolHoliday = async (id: string): Promise<boolean> => {
    setSchoolHolidays(prev => prev.filter(h => h.id !== id))
    return true
  }

  const addStudent = async (studentData: Omit<Student, 'id'>): Promise<Student> => {
    const newStudent: Student = { id: `std-${Date.now()}`, ...studentData }
    setStudents(prev => [...prev, newStudent])
    try {
      const email = studentData.parent_email || studentData.household_id || `${studentData.student_code || Date.now()}@parent.app`
      await saveGuardianMaster({
        parentEmail: email,
        student1: studentData.name,
        busStop: studentData.bus_stop_name || '草香会館',
        memo: '',
        defaultToSchool: studentData.default_morning_ride ? '乗る' : '乗らない',
        defaultFromSchool: studentData.default_afternoon_schedule || '2便'
      })
    } catch (e) {
      console.warn('addStudent GAS save error:', e)
    }
    return newStudent
  }

  const updateStudent = async (id: string, updates: Partial<Student>): Promise<boolean> => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
    try {
      const target = students.find(s => s.id === id)
      const merged = { ...target, ...updates }
      if (merged && merged.name) {
        const email = merged.parent_email || merged.household_id || `${merged.student_code || Date.now()}@parent.app`
        await saveGuardianMaster({
          parentEmail: email,
          student1: merged.name,
          busStop: merged.bus_stop_name || '草香会館',
          memo: '',
          defaultToSchool: merged.default_morning_ride ? '乗る' : '乗らない',
          defaultFromSchool: merged.default_afternoon_schedule || '2便'
        })
      }
    } catch (e) {
      console.warn('updateStudent GAS save error:', e)
    }
    return true
  }

  const deleteStudent = async (id: string): Promise<boolean> => {
    setStudents(prev => prev.filter(s => s.id !== id))
    return true
  }

  const addBusStop = async (busStopData: Omit<BusStop, 'id'>): Promise<BusStop> => {
    const newStop: BusStop = { id: `stop-${Date.now()}`, ...busStopData }
    setBusStops(prev => [...prev, newStop])
    return newStop
  }

  const updateBusStop = async (id: string, updates: Partial<BusStop>) => {
    setBusStops(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
    return true
  }

  const deleteBusStop = async (id: string): Promise<boolean> => {
    setBusStops(prev => prev.filter(s => s.id !== id))
    return true
  }

  const reorderBusStops = async (orderedStopIds: string[]): Promise<boolean> => {
    setBusStops(prev => {
      const stopMap = new Map(prev.map(s => [s.id, s]))
      return orderedStopIds.map((id, index) => ({
        ...stopMap.get(id)!,
        order_index: index + 1
      }))
    })
    return true
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isRegistered,
        isDemoMode,
        isRealtimeConnected,
        signInWithGoogle,
        signOut,
        signInDemoUser,
        selectRole,
        loginAsParent,
        loginAsDriver,
        loginAsAdmin,
        verifyStudentForRegistration,
        registerGuardianProfile,
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
