import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type {
  AllMasterData,
  AuthUser,
  GuardianMasterRow,
  BusStopRow,
  ScheduleCalendarRow,
  BasicSettingRow,
  SchoolTimetableRow,
  UserPermissionRow,
  HolidayItem
} from '../types/spreadsheet'
import { 
  fetchSpreadsheetMaster, 
  saveReservationToSheet, 
  saveBatchSchedulesToSheet,
  saveBasicSettingToSheet,
  saveMonthPublishStatusToSheet,
  saveGuardianMasterToSheet,
  saveSchoolTimetableToSheet,
  saveBatchSchoolTimetableToSheet,
  saveBusStopToSheet,
  deleteBusStopFromSheet,
  registerNewStudentWithCodeToSheet,
  linkStudentWithCodeToSheet,
  deleteGuardianMasterFromSheet,
  recordBoardingToSheet,
  extractBoardingTime,
  formatNowJ,
  normalizeYearMonth,
  isMonthPublished
} from '../lib/spreadsheetApi'

// SWR（Stale-While-Revalidate）ローカルストレージキャッシュキー
const SWR_MASTER_CACHE_KEY = 'sb_swr_master_cache_v2'
const SWR_USER_CACHE_KEY = 'sb_swr_user_cache_v2'

function loadCachedMaster(): AllMasterData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SWR_MASTER_CACHE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        const hasAnyData = (
          (Array.isArray(parsed.guardianMaster) && parsed.guardianMaster.length > 0) ||
          (Array.isArray(parsed.basicSettings) && parsed.basicSettings.length > 0) ||
          (Array.isArray(parsed.schoolTimetable) && parsed.schoolTimetable.length > 0) ||
          (Array.isArray(parsed.schedules) && parsed.schedules.length > 0)
        )
        if (hasAnyData) {
          return parsed
        }
      }
    }
  } catch (e) {
    console.warn('[AppContext] Failed to load cached master:', e)
  }
  return null
}

function loadCachedUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SWR_USER_CACHE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.email && parsed.role) {
        return parsed
      }
    }
  } catch (e) {
    console.warn('[AppContext] Failed to load cached user:', e)
  }
  return null
}

interface AppContextType {
  user: AuthUser | null
  loading: boolean
  syncing: boolean
  error: string | null
  lastSyncedTime: string
  // 5秒タイムアウト復帰フォールバックUI管理
  showTimeoutFallback: boolean
  hasCachedData: boolean
  isUsingCachedData: boolean
  openWithCachedData: () => void
  retryConnection: () => Promise<void>
  // スプレッドシート直結生データ
  guardianMaster: GuardianMasterRow[]
  busStops: BusStopRow[]
  schedules: ScheduleCalendarRow[]
  basicSettings: BasicSettingRow[]
  schoolTimetable: SchoolTimetableRow[]
  userPermissions: UserPermissionRow[]
  holidays: HolidayItem[]
  // 公開月リスト（ローカル保護ガード反映済）
  publishedMonths: string[]
  // 操作
  login: (email: string) => Promise<{ success: boolean; message?: string; needAuthCode?: boolean; email?: string }>
  logout: () => void
  refreshAll: (force?: boolean) => Promise<void>
  saveReservation: (payload: Parameters<typeof saveReservationToSheet>[0]) => Promise<{ success: boolean; message?: string }>
  saveBatchSchedules: (schedules: Parameters<typeof saveBatchSchedulesToSheet>[0]) => Promise<{ success: boolean; message?: string; total?: number; updatedCount?: number; insertedCount?: number }>
  recordBoarding: (payload: { date: string; studentName: string; tripType: '登校' | '下校'; boarded: boolean; busStop?: string; rollCallType?: 'boarded' | 'alighted' }) => Promise<{ success: boolean; boardingValue?: string; message?: string }>
  saveBasicSetting: (payload: Parameters<typeof saveBasicSettingToSheet>[0]) => Promise<{ success: boolean; message?: string }>
  saveMonthPublishStatus: (payload: Parameters<typeof saveMonthPublishStatusToSheet>[0]) => Promise<{ success: boolean; message?: string; yearMonth?: string; isPublished?: boolean }>
  saveGuardianMaster: (payload: Parameters<typeof saveGuardianMasterToSheet>[0]) => Promise<{ success: boolean; message?: string }>
  saveSchoolTimetable: (payload: Parameters<typeof saveSchoolTimetableToSheet>[0]) => Promise<{ success: boolean; message?: string }>
  saveBatchSchoolTimetable: (timetables: Parameters<typeof saveBatchSchoolTimetableToSheet>[0]) => Promise<{ success: boolean; message?: string; count?: number }>
  saveBusStop: (payload: Parameters<typeof saveBusStopToSheet>[0]) => Promise<{ success: boolean; message?: string }>
  deleteBusStop: (stopName: string) => Promise<{ success: boolean; message?: string }>
  registerNewStudentWithCode: (payload: Parameters<typeof registerNewStudentWithCodeToSheet>[0]) => Promise<{ success: boolean; message?: string; code?: string; auth_code?: string; student_name?: string }>
  linkStudentWithCode: (payload: { email: string; code: string }) => Promise<{ success: boolean; message?: string; student_name?: string }>
  deleteGuardianMaster: (payload: { parent_email?: string; auth_code?: string; student_name?: string }) => Promise<{ success: boolean; status?: string; message?: string; [key: string]: any }>
  switchRole: (targetRole: '管理者' | '運転手' | '保護者', studentName?: string) => Promise<void>
  quickLoginAs: (type: string, studentName?: string) => Promise<void>
  loginAsParentStudent: (studentName: string) => Promise<void>
  loginWithAuthCode: (emailOrName: string, authCode: string) => Promise<{ success: boolean; message?: string; studentNames?: string[] }>
  clearAllCacheAndResync: () => Promise<{ success: boolean; message?: string }>
}

const AppContext = createContext<AppContextType | undefined>(undefined)

const DEFAULT_FALLBACK_GUARDIANS: GuardianMasterRow[] = []

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // SWR初期キャッシュの即時同期復元
  const initialCache = useMemo(() => loadCachedMaster(), [])
  const initialUser = useMemo(() => loadCachedUser(), [])

  const [user, setUserState] = useState<AuthUser | null>(() => initialUser)
  // SWR方式（Stale-While-Revalidate）: 端末にキャッシュがある場合は loading = false で即座に描画（体感0秒起動）
  // キャッシュがない初回利用時のみ loading = true で待機画面を表示
  const [loading, setLoading] = useState<boolean>(() => !initialCache)
  const [syncing, setSyncing] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedTime, setLastSyncedTime] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sb_last_synced_time') || ''
    }
    return ''
  })

  // タイムアウト＆キャッシュ利用ステート
  const [showTimeoutFallback, setShowTimeoutFallback] = useState<boolean>(false)
  const [isUsingCachedData, setIsUsingCachedData] = useState<boolean>(false)
  const [fetchAttempt, setFetchAttempt] = useState<number>(0)

  // 全マスタ（SWRキャッシュで即時展開準備）
  const [data, setDataState] = useState<AllMasterData>(() => initialCache || {
    guardianMaster: DEFAULT_FALLBACK_GUARDIANS,
    busStops: [],
    schedules: [],
    basicSettings: [],
    schoolTimetable: [],
    userPermissions: [],
    holidays: []
  })

  // 端末の保存キャッシュデータ有無判定
  const hasCachedData = useMemo(() => {
    return loadCachedMaster() !== null
  }, [data, fetchAttempt])

  // 5秒タイムアウト判定タイマー
  // isLoading === true の開始から5000ms経過で showTimeoutFallback を有効化
  // 通信完了時は loading が false になるため自動的に解除される
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    if (loading) {
      setShowTimeoutFallback(false)
      timer = setTimeout(() => {
        setShowTimeoutFallback(true)
      }, 5000)
    } else {
      setShowTimeoutFallback(false)
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [loading, fetchAttempt])

  // 前回の保存データで開く（ケースA）
  const openWithCachedData = useCallback(() => {
    const cached = loadCachedMaster()
    if (cached) {
      setDataState(cached)
    }
    const cachedUser = loadCachedUser()
    if (cachedUser && !user) {
      setUserState(cachedUser)
    }
    setLoading(false)
    setIsUsingCachedData(true)
    setShowTimeoutFallback(false)
  }, [user])

  // キャッシュ書き込みラッパー
  const setData = useCallback((updater: AllMasterData | ((prev: AllMasterData) => AllMasterData)) => {
    setDataState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(SWR_MASTER_CACHE_KEY, JSON.stringify(next))
        }
      } catch (e) {
        console.warn('[AppContext] Failed to cache master:', e)
      }
      return next
    })
  }, [])

  const setUser = useCallback((newUser: AuthUser | null) => {
    setUserState(newUser)
    try {
      if (typeof window !== 'undefined') {
        if (newUser) {
          localStorage.setItem(SWR_USER_CACHE_KEY, JSON.stringify(newUser))
        } else {
          localStorage.removeItem(SWR_USER_CACHE_KEY)
        }
      }
    } catch (e) {
      console.warn('[AppContext] Failed to cache user:', e)
    }
  }, [])

  // 確定・公開月のローカル保護ガード (key: YYYY/MM, value: boolean)
  // 保存完了時に即座にセットされ、直後のバックグラウンドフェッチや反映遅延によるロールバックを防止
  const [publishedGuard, setPublishedGuard] = useState<Record<string, boolean>>({})
  const publishedGuardRef = useRef<Record<string, boolean>>({})
  publishedGuardRef.current = publishedGuard

  // 公開中（確定済）の年月リスト (例: ['2026/09'])
  const publishedMonths = useMemo(() => {
    const set = new Set<string>()
    data.basicSettings.forEach(b => {
      if (!b || !b.setting_name) return
      let ym = ''
      if (b.setting_name.startsWith('時刻表公開_')) {
        ym = normalizeYearMonth(b.setting_name.replace('時刻表公開_', ''))
      } else if (b.setting_name.toUpperCase().startsWith('PUBLISH_')) {
        ym = normalizeYearMonth(b.setting_name.slice(8))
      }
      if (ym && isMonthPublished(ym, [b])) {
        set.add(ym)
      }
    })

    // ローカルガードで上書き適用
    Object.entries(publishedGuard).forEach(([ym, isPub]) => {
      if (isPub) {
        set.add(ym)
      } else {
        set.delete(ym)
      }
    })

    return Array.from(set).sort()
  }, [data.basicSettings, publishedGuard])

  // スプレッドシート最新データの一括直接フェッチ（force=true 指定時はGAS側ScriptCacheを強制破棄）
  const refreshAll = useCallback(async (force?: boolean) => {
    setSyncing(true)
    setError(null)
    try {
      // テスト・動作検証用：URLパラメータ ?mock_delay=... がある場合は擬似遅延
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        const mockDelay = params.get('mock_delay')
        if (mockDelay && !isNaN(Number(mockDelay))) {
          await new Promise(r => setTimeout(r, Number(mockDelay)))
        }
      }

      const master = await fetchSpreadsheetMaster(force)

      // ガード適用：直近にローカルで保存・更新された確定ステータスをマージして古いスプレッドシートデータによるロールバックを防止
      const activeGuard = publishedGuardRef.current
      if (Object.keys(activeGuard).length > 0) {
        const mergedSettings = [...master.basicSettings]
        for (const [ym, isPub] of Object.entries(activeGuard)) {
          const targetKeys = [`時刻表公開_${ym}`, `PUBLISH_${ym}`]
          let matched = false
          for (let i = 0; i < mergedSettings.length; i++) {
            const setting = mergedSettings[i]
            if (
              targetKeys.includes(setting.setting_name) ||
              (setting.setting_name.startsWith('時刻表公開_') && normalizeYearMonth(setting.setting_name.replace('時刻表公開_', '')) === ym) ||
              (setting.setting_name.toUpperCase().startsWith('PUBLISH_') && normalizeYearMonth(setting.setting_name.slice(8)) === ym)
            ) {
              mergedSettings[i] = {
                ...setting,
                standard_operation: isPub ? '公開' : '非公開',
                content_time: isPub ? '確定済' : '未確定',
                note: isPub ? '予約受付中' : '時刻表調整中・ロック'
              }
              matched = true
            }
          }
          if (!matched && isPub) {
            const [y, m] = ym.split('/')
            const daysInMonth = new Date(Number(y), Number(m), 0).getDate()
            mergedSettings.push({
              setting_name: `時刻表公開_${ym}`,
              start_date: `${ym}/01`,
              end_date: `${ym}/${String(daysInMonth).padStart(2, '0')}`,
              standard_operation: '公開',
              content_time: '確定済',
              note: '予約受付中'
            })
            mergedSettings.push({
              setting_name: `PUBLISH_${ym}`,
              start_date: `${ym}/01`,
              end_date: `${ym}/${String(daysInMonth).padStart(2, '0')}`,
              standard_operation: '公開',
              content_time: '確定済',
              note: '予約受付中'
            })
          }
        }
        master.basicSettings = mergedSettings
      }

      setData(master)
      setIsUsingCachedData(false)
      setShowTimeoutFallback(false)
      setLoading(false)

      // 最終同期時刻を更新
      const now = new Date()
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      const ss = String(now.getSeconds()).padStart(2, '0')
      const timeStr = `${hh}:${mm}:${ss}`
      setLastSyncedTime(timeStr)
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('sb_last_synced_time', timeStr)
        }
      } catch (e) {}
    } catch (err: any) {
      console.error('[AppContext] Failed to refresh spreadsheet data:', err)
      setError(err?.message || 'スプレッドシートの取得に失敗しました')
      setShowTimeoutFallback(true)
      // エラー発生時は待機画面を維持し、フォールバックUIで再試行またはキャッシュ利用を促す
    } finally {
      setSyncing(false)
    }
  }, [setData])

  // もう一度接続する（再試行）
  const retryConnection = useCallback(async () => {
    setShowTimeoutFallback(false)
    setLoading(true)
    setIsUsingCachedData(false)
    setFetchAttempt(prev => prev + 1)
    await refreshAll(true)
  }, [refreshAll])

  // 端末のlocalStorageおよびメモリ内キャッシュを全消去し、GASから強制再取得
  const clearAllCacheAndResync = useCallback(async () => {
    setSyncing(true)
    setError(null)
    try {
      if (typeof window !== 'undefined') {
        const keysToRemove = [
          SWR_MASTER_CACHE_KEY,
          SWR_USER_CACHE_KEY,
          'sb_last_synced_time',
          'school_bus_user',
          'school_bus_active_session_v2',
          'school_bus_user_session'
        ]
        keysToRemove.forEach(k => {
          try { localStorage.removeItem(k) } catch (e) {}
        })
      }

      // メモリステートのリセット
      setDataState({
        guardianMaster: DEFAULT_FALLBACK_GUARDIANS,
        busStops: [],
        schedules: [],
        basicSettings: [],
        schoolTimetable: [],
        userPermissions: [],
        holidays: []
      })
      setLastSyncedTime('')
      setShowTimeoutFallback(false)
      setIsUsingCachedData(false)

      // GAS ScriptCache を破棄してスプレッドシート生データから強制フェッチ
      const master = await fetchSpreadsheetMaster(true)
      setData(master)

      const now = new Date()
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      const ss = String(now.getSeconds()).padStart(2, '0')
      const timeStr = `${hh}:${mm}:${ss}`
      setLastSyncedTime(timeStr)
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('sb_last_synced_time', timeStr)
        }
      } catch (e) {}

      setLoading(false)
      return { success: true, message: '端末の保存データを全消去し、最新データをGASから同期しました' }
    } catch (err: any) {
      console.error('[AppContext] Failed to clearAllCacheAndResync:', err)
      setError(err?.message || 'キャッシュの消去・再同期に失敗しました')
      return { success: false, message: err?.message || 'キャッシュの消去・再同期に失敗しました' }
    } finally {
      setSyncing(false)
    }
  }, [setData])

  // アプリ初期ロード時：常にスプレッドシートから生データを直接取得（force=trueでGAS側キャッシュも強制破棄）
  useEffect(() => {
    refreshAll(true)
  }, [refreshAll])

  // タブ間・画面間リアルタイム乗車通知同期（BroadcastChannel）
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return

    const channel = new BroadcastChannel('school_bus_boarding_sync')
    channel.onmessage = (event) => {
      const msg = event.data
      if (msg && msg.type === 'BOARDING_UPDATED') {
        const { slashDate, studentName, isMorning, rollCallType, boardingValue } = msg
        setData(prev => {
          let found = false
          const updatedSchedules = prev.schedules.map(s => {
            if (s.date.replace(/-/g, '/') === slashDate && s.student_name === studentName) {
              found = true
              if (isMorning) {
                return {
                  ...s,
                  morning_boarding: boardingValue,
                  boarded_at: boardingValue,
                  updated_at: formatNowJ()
                }
              } else {
                if (rollCallType === 'boarded') {
                  return {
                    ...s,
                    boarded_at: boardingValue,
                    updated_at: formatNowJ()
                  }
                } else {
                  return {
                    ...s,
                    afternoon_boarding: boardingValue,
                    alighted_at: boardingValue,
                    updated_at: formatNowJ()
                  }
                }
              }
            }
            return s
          })

          if (!found) {
            updatedSchedules.push({
              id: `temp-${Date.now()}`,
              date: slashDate,
              student_name: studentName,
              morning_status: isMorning ? '乗る' : '',
              afternoon_status: '',
              afternoon_trip_1: '',
              afternoon_trip_2: '',
              afternoon_trip_3: '',
              note: '',
              updated_at: formatNowJ(),
              parent_email: '',
              morning_boarding: isMorning ? boardingValue : '',
              afternoon_boarding: (!isMorning && rollCallType === 'alighted') ? boardingValue : '',
              boarded_at: (isMorning || rollCallType === 'boarded') ? boardingValue : '',
              alighted_at: (!isMorning && rollCallType === 'alighted') ? boardingValue : ''
            })
          }

          return {
            ...prev,
            schedules: updatedSchedules
          }
        })
      }
    }

    return () => {
      channel.close()
    }
  }, [])

  // メールアドレスによるシンプル認証（ユーザー権限マスタおよび生徒・保護者マスター完全照合）
  const login = async (inputEmail: string): Promise<{ success: boolean; message?: string; needAuthCode?: boolean; email?: string }> => {
    const cleanEmail = inputEmail.trim().toLowerCase()
    if (!cleanEmail) {
      return { success: false, message: 'メールアドレスを入力してください' }
    }

    // ログイン時は常にスプレッドシートから最新マスターを取得して確実に照合
    setSyncing(true)
    let freshMaster: AllMasterData = data
    try {
      freshMaster = await fetchSpreadsheetMaster()
      setData(freshMaster)
    } catch (e) {
      console.warn('Fetch latest master in login failed, using current cache:', e)
    } finally {
      setSyncing(false)
    }

    const currentPerms = freshMaster.userPermissions
    const currentGuardians = freshMaster.guardianMaster

    // 1. ユーザー権限マスタ（A列: メールアドレス）にそのメールアドレスが存在するかチェック
    const permMatch = currentPerms.find(p => p.email && p.email.toLowerCase() === cleanEmail)
    if (permMatch) {
      const rawRole = String(permMatch.role || '')
      const roleLower = rawRole.toLowerCase()
      let resolvedRole: '管理者' | '運転手' | '保護者' = permMatch.role

      // 役割が「管理者」（または教頭・教諭・admin等の管理者キーワードを含む場合）→ 管理者コンソール
      if (
        permMatch.role === '管理者' ||
        rawRole.includes('管理者') ||
        rawRole.includes('教頭') ||
        rawRole.includes('教諭') ||
        rawRole.includes('学校') ||
        rawRole.includes('教職員') ||
        roleLower.includes('admin') ||
        roleLower.includes('principal') ||
        roleLower.includes('manager') ||
        roleLower.includes('staff')
      ) {
        resolvedRole = '管理者'
      } else if (
        // 役割が「運転手」（またはdriver等を含む場合）→ 運転手専用コンソール
        permMatch.role === '運転手' ||
        rawRole.includes('運転手') ||
        rawRole.includes('運転') ||
        rawRole.includes('ドライバー') ||
        roleLower.includes('driver')
      ) {
        resolvedRole = '運転手'
      }

      setUser({
        email: permMatch.email,
        name: permMatch.name || (resolvedRole === '管理者' ? '管理者様' : resolvedRole === '運転手' ? '運転手様' : '利用者様'),
        role: resolvedRole
      })
      return { success: true }
    }

    // 2. 「ユーザー権限マスタ」に該当アドレスがない場合：
    //    「生徒・保護者マスター」にそのメールアドレスが存在すれば → 保護者カレンダー予約画面へ
    const guardianMatch = currentGuardians.find(g => g.parent_email && g.parent_email.toLowerCase() === cleanEmail)
    if (guardianMatch) {
      const studentName = guardianMatch.student_names[0] || '生徒'
      setUser({
        email: guardianMatch.parent_email,
        name: `${studentName}の保護者`,
        role: '保護者'
      })
      return { success: true }
    }

    //    「生徒・保護者マスター」にも存在しない場合 → 「お子様の登録コード入力」画面へ誘導
    return {
      success: false,
      needAuthCode: true,
      email: cleanEmail,
      message: 'お子様の登録コードを入力してください'
    }
  }

  const logout = () => {
    setUser(null)
  }

  // 生徒・保護者マスター準拠：生徒名指定による保護者ログイン（メール未入力生徒への完全対応）
  const loginAsParentStudent = async (studentName: string) => {
    // 該当生徒のレコードを検索
    const match = data.guardianMaster.find(g => g.student_names.includes(studentName))
    const email = (match?.parent_email && match.parent_email.trim())
      ? match.parent_email.trim().toLowerCase()
      : `parent_${studentName}`

    setUser({
      email: email,
      name: `${studentName}の保護者`,
      role: '保護者',
      studentName: studentName,
      studentNames: match?.student_names || [studentName],
      authCode: match?.auth_code
    })
  }

  // 保護者認証コード照合ログイン（J列照合 ＆ A列自動更新 ＆ セッション確立）
  const loginWithAuthCode = async (
    emailOrName: string,
    rawAuthCode: string
  ): Promise<{ success: boolean; message?: string; studentNames?: string[] }> => {
    const cleanEmailOrName = emailOrName.trim()
    const cleanCode = rawAuthCode.trim().toUpperCase()

    if (!cleanEmailOrName) {
      return { success: false, message: '保護者メールアドレス（または保護者氏名）を入力してください' }
    }
    if (!cleanCode) {
      return { success: false, message: 'お子様の認証コードを入力してください' }
    }

    setSyncing(true)
    let currentMaster = data
    try {
      currentMaster = await fetchSpreadsheetMaster()
      setData(currentMaster)
    } catch (e) {
      console.warn('[AppContext] Refresh master in loginWithAuthCode failed, using cache:', e)
    } finally {
      setSyncing(false)
    }

    // 認証コードの一致する世帯レコードを検索（大文字小文字・ハイフンなし等も柔軟に対応）
    const normalizeCode = (c: string) => c.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    const targetNorm = normalizeCode(cleanCode)

    const matched = currentMaster.guardianMaster.find(g => {
      if (!g.auth_code) return false
      return g.auth_code.trim().toUpperCase() === cleanCode || normalizeCode(g.auth_code) === targetNorm
    })

    if (!matched) {
      return {
        success: false,
        message: '認証コードが一致しません。学校から発行されたコードをご確認ください。'
      }
    }

    // B〜E列から生徒名一覧（最大4名）を抽出
    const s1 = matched.student_name_1 || matched.student_names[0] || ''
    const s2 = matched.student_name_2 || matched.student_names[1] || ''
    const s3 = matched.student_name_3 || matched.student_names[2] || ''
    const s4 = matched.student_name_4 || matched.student_names[3] || ''
    const studentNames = [s1, s2, s3, s4].filter(Boolean)
    if (studentNames.length === 0 && matched.student_names.length > 0) {
      studentNames.push(...matched.student_names)
    }

    const primaryStudent = studentNames[0] || '生徒'

    // 初回ログイン時、A列が空欄の場合は入力された保護者メール（または氏名）をスプレッドシートのA列へ自動保存
    const currentParentEmail = (matched.parent_email || '').trim()
    if (!currentParentEmail && matched.auth_code) {
      try {
        await linkStudentWithCodeToSheet({
          email: cleanEmailOrName,
          code: matched.auth_code
        })
        setData(prev => ({
          ...prev,
          guardianMaster: prev.guardianMaster.map(g => {
            if (g.auth_code === matched.auth_code) {
              return { ...g, parent_email: cleanEmailOrName }
            }
            return g
          })
        }))
      } catch (err) {
        console.warn('[AppContext] Failed to auto-save parent email to sheet:', err)
      }
    }

    const effectiveEmail = currentParentEmail || cleanEmailOrName

    // セッションを構築し、localStorageに保存
    const authUser: AuthUser = {
      email: effectiveEmail,
      name: cleanEmailOrName.includes('@') ? `${primaryStudent}の保護者` : `${cleanEmailOrName} 様`,
      role: '保護者',
      studentName: primaryStudent,
      studentNames: studentNames,
      authCode: matched.auth_code
    }

    setUser(authUser)

    return {
      success: true,
      studentNames
    }
  }

  // 検証用：立場（ロール）の即時切り替え
  const switchRole = async (targetRole: '管理者' | '運転手' | '保護者', studentName?: string) => {
    if (targetRole === '管理者') {
      const match = data.userPermissions.find(p => p.role === '管理者')
      setUser({
        email: match?.email || 'ichinomiya1984@gmail.com',
        name: match?.name || '管理者様',
        role: '管理者'
      })
    } else if (targetRole === '運転手') {
      const match = data.userPermissions.find(p => p.role === '運転手')
      setUser({
        email: match?.email || 'driver@example.com',
        name: match?.name || '運転手様',
        role: '運転手'
      })
    } else {
      const target = studentName || user?.studentName || data.guardianMaster[0]?.student_names[0] || ''
      await loginAsParentStudent(target)
    }
  }

  // お試し検証用：ワンタップ・ロールログイン（認証スキップで指定立場へ即時ログイン）
  const quickLoginAs = async (type: string, studentName?: string) => {
    if (type === 'admin') {
      const match = data.userPermissions.find(p => p.role === '管理者' || (p.name && p.name.includes('教頭')))
      setUser({
        email: match?.email || 'ichinomiya1984@gmail.com',
        name: match?.name || '学校管理者（教頭）',
        role: '管理者'
      })
    } else if (type === 'driver') {
      const match = data.userPermissions.find(p => p.role === '運転手')
      setUser({
        email: match?.email || 'driver@example.com',
        name: match?.name || '運転手太郎',
        role: '運転手'
      })
    } else {
      // 保護者ログイン（生徒名指定または自動フォールバック）
      let targetStudent = studentName || ''
      if (!targetStudent && type.startsWith('parent_')) {
        const sub = type.replace(/^parent_/, '')
        if (sub !== 'sato' && sub !== 'other') {
          targetStudent = sub
        }
      }
      if (!targetStudent && type !== 'parent_sato' && type !== 'parent_other') {
        targetStudent = type
      }

      if (targetStudent) {
        await loginAsParentStudent(targetStudent)
      } else {
        // 先頭の生徒をデフォルトに
        const first = data.guardianMaster[0]?.student_names[0] || ''
        await loginAsParentStudent(first)
      }
    }
  }

  // 運行予約の保存
  const handleSaveReservation = async (payload: Parameters<typeof saveReservationToSheet>[0]) => {
    setSyncing(true)
    // 楽観的UI更新
    setData(prev => {
      const targetDate = payload.date.replace(/-/g, '/')
      const exists = prev.schedules.some(s => s.date.replace(/-/g, '/') === targetDate && s.student_name === payload.student_name)
      let updated: ScheduleCalendarRow[]
      if (exists) {
        updated = prev.schedules.map(s => {
          if (s.date.replace(/-/g, '/') === targetDate && s.student_name === payload.student_name) {
            return {
              ...s,
              morning_status: payload.morning_status,
              afternoon_status: payload.afternoon_status,
              afternoon_trip_1: payload.afternoon_trip_1 !== undefined ? payload.afternoon_trip_1 : s.afternoon_trip_1,
              afternoon_trip_2: payload.afternoon_trip_2 !== undefined ? payload.afternoon_trip_2 : s.afternoon_trip_2,
              afternoon_trip_3: payload.afternoon_trip_3 !== undefined ? payload.afternoon_trip_3 : s.afternoon_trip_3,
              note: payload.note !== undefined ? payload.note : s.note,
              updated_at: formatNowJ()
            }
          }
          return s
        })
      } else {
        updated = [
          ...prev.schedules,
          {
            id: prev.schedules.length + 1,
            date: targetDate,
            student_name: payload.student_name,
            morning_status: payload.morning_status,
            afternoon_status: payload.afternoon_status,
            afternoon_trip_1: payload.afternoon_trip_1 || '',
            afternoon_trip_2: payload.afternoon_trip_2 || '',
            afternoon_trip_3: payload.afternoon_trip_3 || '',
            note: payload.note || '',
            updated_at: formatNowJ(),
            parent_email: payload.parent_email
          }
        ]
      }
      return { ...prev, schedules: updated }
    })

    try {
      const res = await saveReservationToSheet(payload)
      if (res.success) {
        // 保存成功後にスプレッドシートから最新データを再同期
        await refreshAll()
      }
      return res
    } finally {
      setSyncing(false)
    }
  }

  // 運行予約の複数一括保存
  const handleSaveBatchSchedules = async (payload: Parameters<typeof saveBatchSchedulesToSheet>[0]) => {
    setSyncing(true)
    // 楽観的UI更新: 内部ステートを即時更新
    setData(prev => {
      const scheduleMap = new Map<string, ScheduleCalendarRow>()
      prev.schedules.forEach(s => {
        scheduleMap.set(`${s.date.replace(/-/g, '/')}_${s.student_name}`, s)
      })

      payload.forEach(item => {
        const d = item.date.replace(/-/g, '/')
        const key = `${d}_${item.student_name}`
        const existing = scheduleMap.get(key)
        const updatedRow: ScheduleCalendarRow = {
          id: existing ? existing.id : prev.schedules.length + 1,
          date: d,
          student_name: item.student_name,
          morning_status: item.morning_status,
          afternoon_status: item.afternoon_status,
          afternoon_trip_1: item.afternoon_trip_1 || '',
          afternoon_trip_2: item.afternoon_trip_2 || '',
          afternoon_trip_3: item.afternoon_trip_3 || '',
          note: item.note !== undefined ? item.note : (existing?.note || ''),
          updated_at: formatNowJ(),
          parent_email: item.parent_email
        }
        scheduleMap.set(key, updatedRow)
      })

      return {
        ...prev,
        schedules: Array.from(scheduleMap.values())
      }
    })

    try {
      const res = await saveBatchSchedulesToSheet(payload)
      // バックグラウンドでスプレッドシートから再取得して最終整合性を同期
      await refreshAll()
      return res
    } finally {
      setSyncing(false)
    }
  }

  // 運転手による乗車・降車確認記録（楽観的UI更新 + GAS連動 + 画面間リアルタイム同期）
  const handleRecordBoarding = async (payload: {
    date: string
    studentName: string
    tripType: '登校' | '下校'
    boarded: boolean
    busStop?: string
    rollCallType?: 'boarded' | 'alighted'
  }): Promise<{ success: boolean; boardingValue?: string; message?: string }> => {
    const slashDate = payload.date.replace(/-/g, '/')
    const isMorning = payload.tripType === '登校'
    const rollCallType = payload.rollCallType || (isMorning ? 'boarded' : 'alighted')
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const timeStr = `${hh}:${mm}`
    // バス停名は含めず、純粋な時刻文字列 "HH:mm" のみで記録
    const expectedVal = payload.boarded ? timeStr : ''

    // 1. 楽観的UI更新（ローカルの schedules および SWR キャッシュを即座に更新）
    setData(prev => {
      let found = false
      const updatedSchedules = prev.schedules.map(s => {
        if (s.date.replace(/-/g, '/') === slashDate && s.student_name === payload.studentName) {
          found = true
          if (isMorning) {
            return {
              ...s,
              morning_boarding: expectedVal,
              boarded_at: expectedVal,
              updated_at: formatNowJ()
            }
          } else {
            if (rollCallType === 'boarded') {
              return {
                ...s,
                boarded_at: expectedVal,
                updated_at: formatNowJ()
              }
            } else {
              return {
                ...s,
                afternoon_boarding: expectedVal,
                alighted_at: expectedVal,
                updated_at: formatNowJ()
              }
            }
          }
        }
        return s
      })

      if (!found) {
        // 未予約日の臨時乗車の場合でもローカルレコードを追加
        updatedSchedules.push({
          id: `temp-${Date.now()}`,
          date: slashDate,
          student_name: payload.studentName,
          morning_status: isMorning ? '乗る' : '',
          afternoon_status: '',
          afternoon_trip_1: '',
          afternoon_trip_2: '',
          afternoon_trip_3: '',
          note: '',
          updated_at: formatNowJ(),
          parent_email: '',
          morning_boarding: isMorning ? expectedVal : '',
          afternoon_boarding: (!isMorning && rollCallType === 'alighted') ? expectedVal : '',
          boarded_at: (isMorning || rollCallType === 'boarded') ? expectedVal : '',
          alighted_at: (!isMorning && rollCallType === 'alighted') ? expectedVal : ''
        })
      }

      return {
        ...prev,
        schedules: updatedSchedules
      }
    })

    // タブ間・画面間リアルタイム同期通知（BroadcastChannel）
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('school_bus_boarding_sync')
        channel.postMessage({
          type: 'BOARDING_UPDATED',
          slashDate,
          studentName: payload.studentName,
          isMorning,
          rollCallType,
          boardingValue: expectedVal
        })
        channel.close()
      } catch (e) {
        console.warn('BroadcastChannel error:', e)
      }
    }

    // 2. バックグラウンド非同期で GAS（スプレッドシート）に永続化送信
    try {
      const res = await recordBoardingToSheet({
        date: slashDate,
        studentName: payload.studentName,
        tripType: payload.tripType,
        boarded: payload.boarded,
        busStop: payload.busStop,
        timeStr: expectedVal,
        rollCallType
      })

      if (res && res.success && res.boardingValue !== undefined) {
        const cleanBoardingValue = extractBoardingTime(res.boardingValue)
        // サーバー側確定値（実記録時刻）で上書き同期
        setData(prev => ({
          ...prev,
          schedules: prev.schedules.map(s => {
            if (s.date.replace(/-/g, '/') === slashDate && s.student_name === payload.studentName) {
              if (isMorning) {
                return {
                  ...s,
                  morning_boarding: cleanBoardingValue,
                  boarded_at: cleanBoardingValue
                }
              } else {
                if (rollCallType === 'boarded') {
                  return {
                    ...s,
                    boarded_at: cleanBoardingValue
                  }
                } else {
                  return {
                    ...s,
                    afternoon_boarding: cleanBoardingValue,
                    alighted_at: cleanBoardingValue
                  }
                }
              }
            }
            return s
          })
        }))
      }
      return res || { success: true, boardingValue: expectedVal }
    } catch (err: any) {
      console.warn('[AppContext] recordBoarding async background save failed:', err)
      // 楽観的更新＆キャッシュ更新済みのため、画面が固まらないよう成功扱いで返却
      return { success: true, boardingValue: expectedVal, message: 'ローカルに記録しました（バックグラウンド同期待ち）' }
    }
  }

  // 基本設定・運休期間の保存
  const handleSaveBasicSetting = async (payload: Parameters<typeof saveBasicSettingToSheet>[0]) => {
    setSyncing(true)
    try {
      const res = await saveBasicSettingToSheet(payload)
      if (res.success) {
        // 内部ステートを即時更新（楽観的UI更新）
        setData(prev => {
          const targetName = payload.setting_name.trim()
          const updated = prev.basicSettings.map(b => {
            if (b.setting_name.trim() === targetName) {
              return {
                ...b,
                start_date: payload.start_date || b.start_date,
                end_date: payload.end_date || b.end_date,
                standard_operation: payload.standard_operation !== undefined ? payload.standard_operation : b.standard_operation,
                content_time: payload.content_time !== undefined ? payload.content_time : b.content_time,
                note: payload.note !== undefined ? payload.note : b.note
              }
            }
            return b
          })
          return { ...prev, basicSettings: updated }
        })
        // その後GASから再同期
        await refreshAll()
      }
      return res
    } finally {
      setSyncing(false)
    }
  }

  // 月間時刻表の確定・公開ステータス保存
  const handleSaveMonthPublishStatus = async (payload: Parameters<typeof saveMonthPublishStatusToSheet>[0]) => {
    setSyncing(true)
    try {
      const normalizedYM = normalizeYearMonth(payload.yearMonth)
      const isPub = payload.isPublished

      // 1. GASへの書き込みレスポンスを await で確実に完了待ち
      const res = await saveMonthPublishStatusToSheet({
        yearMonth: normalizedYM,
        isPublished: isPub
      })

      if (res.success) {
        // 2. 保存成功時はローカルの公開月ガードに即座に保持（直後のfetchやバックグラウンド更新でロールバックしないよう完全保護）
        publishedGuardRef.current = {
          ...publishedGuardRef.current,
          [normalizedYM]: isPub
        }
        setPublishedGuard(prev => ({
          ...prev,
          [normalizedYM]: isPub
        }))

        // 3. ローカルステート（data.basicSettings）に 時刻表公開_ と PUBLISH_ の両キーを即座に反映
        setData(prev => {
          const targetKeys = [`時刻表公開_${normalizedYM}`, `PUBLISH_${normalizedYM}`]
          const [year, month] = normalizedYM.split('/')
          const daysInMonth = new Date(Number(year), Number(month), 0).getDate()

          let foundAny = false
          const updated = prev.basicSettings.map(b => {
            if (
              targetKeys.includes(b.setting_name) ||
              (b.setting_name.startsWith('時刻表公開_') && normalizeYearMonth(b.setting_name.replace('時刻表公開_', '')) === normalizedYM) ||
              (b.setting_name.toUpperCase().startsWith('PUBLISH_') && normalizeYearMonth(b.setting_name.slice(8)) === normalizedYM)
            ) {
              foundAny = true
              return {
                ...b,
                standard_operation: isPub ? '公開' : '非公開',
                content_time: isPub ? '確定済' : '未確定',
                note: isPub ? '予約受付中' : '時刻表調整中・ロック'
              }
            }
            return b
          })

          if (!foundAny) {
            updated.push({
              setting_name: `時刻表公開_${normalizedYM}`,
              start_date: `${normalizedYM}/01`,
              end_date: `${normalizedYM}/${String(daysInMonth).padStart(2, '0')}`,
              standard_operation: isPub ? '公開' : '非公開',
              content_time: isPub ? '確定済' : '未確定',
              note: isPub ? '予約受付中' : '時刻表調整中・ロック'
            })
            updated.push({
              setting_name: `PUBLISH_${normalizedYM}`,
              start_date: `${normalizedYM}/01`,
              end_date: `${normalizedYM}/${String(daysInMonth).padStart(2, '0')}`,
              standard_operation: isPub ? '公開' : '非公開',
              content_time: isPub ? '確定済' : '未確定',
              note: isPub ? '予約受付中' : '時刻表調整中・ロック'
            })
          }
          return { ...prev, basicSettings: updated }
        })

        // 4. 最新データを再同期（ガードが適用されるため上書きロールバックされない）
        await refreshAll()
      }
      return res
    } finally {
      setSyncing(false)
    }
  }

  // 生徒・保護者マスターの保存
  const handleSaveGuardianMaster = async (payload: Parameters<typeof saveGuardianMasterToSheet>[0]) => {
    setSyncing(true)
    try {
      const res = await saveGuardianMasterToSheet(payload)
      if (res.success || (res as any).status === 'success') {
        setData(prev => {
          const targetEmail = (payload.parent_email || '').trim().toLowerCase()
          const targetAuthCode = (payload.auth_code || '').trim().toUpperCase()
          const updated = prev.guardianMaster.map(g => {
            const isEmailMatch = targetEmail && g.parent_email && g.parent_email.toLowerCase() === targetEmail
            const isCodeMatch = targetAuthCode && g.auth_code && g.auth_code.trim().toUpperCase() === targetAuthCode
            if (isEmailMatch || isCodeMatch) {
              const s1 = payload.student_name_1 !== undefined ? payload.student_name_1 : g.student_name_1
              const s2 = payload.student_name_2 !== undefined ? payload.student_name_2 : g.student_name_2
              const s3 = payload.student_name_3 !== undefined ? payload.student_name_3 : g.student_name_3
              const s4 = payload.student_name_4 !== undefined ? payload.student_name_4 : g.student_name_4
              const studentNames = [s1, s2, s3, s4].filter(Boolean) as string[]
              return {
                ...g,
                student_name_1: s1,
                student_name_2: s2,
                student_name_3: s3,
                student_name_4: s4,
                student_names: studentNames,
                bus_stop_name: payload.bus_stop_name || g.bus_stop_name,
                note: payload.note !== undefined ? payload.note : g.note,
                default_morning: payload.default_morning !== undefined ? payload.default_morning : g.default_morning,
                default_afternoon: payload.default_afternoon !== undefined ? payload.default_afternoon : g.default_afternoon
              }
            }
            return g
          })
          return { ...prev, guardianMaster: updated }
        })

        // ログイン中の保護者が編集された世帯である場合、セッションの生徒リストも追従更新
        if (user && user.role === '保護者') {
          const userEmail = (user.email || '').toLowerCase()
          const targetEmail = (payload.parent_email || '').trim().toLowerCase()
          const targetAuthCode = (payload.auth_code || '').trim().toUpperCase()
          const isTargetUser = (targetEmail && userEmail === targetEmail) || (targetAuthCode && user.authCode === targetAuthCode)
          if (isTargetUser) {
            const s1 = payload.student_name_1 !== undefined ? payload.student_name_1 : (user.studentNames?.[0] || '')
            const s2 = payload.student_name_2 !== undefined ? payload.student_name_2 : (user.studentNames?.[1] || '')
            const s3 = payload.student_name_3 !== undefined ? payload.student_name_3 : (user.studentNames?.[2] || '')
            const s4 = payload.student_name_4 !== undefined ? payload.student_name_4 : (user.studentNames?.[3] || '')
            const updatedNames = [s1, s2, s3, s4].filter(Boolean) as string[]
            if (updatedNames.length === 0) {
              logout()
            } else {
              const currentStudentName = user.studentName || ''
              const updatedUser = {
                ...user,
                studentName: currentStudentName && updatedNames.includes(currentStudentName) ? currentStudentName : updatedNames[0],
                studentNames: updatedNames
              }
              setUser(updatedUser)
              localStorage.setItem('school_bus_user', JSON.stringify(updatedUser))
            }
          }
        }

        await refreshAll()
      }
      return res
    } finally {
      setSyncing(false)
    }
  }

  // 学校用時刻表の保存
  const handleSaveSchoolTimetable = async (payload: Parameters<typeof saveSchoolTimetableToSheet>[0]) => {
    setSyncing(true)
    try {
      const res = await saveSchoolTimetableToSheet(payload)
      if (res.success) {
        setData(prev => {
          const targetDate = payload.date.replace(/-/g, '/')
          const exists = prev.schoolTimetable.some(t => t.date.replace(/-/g, '/') === targetDate)
          let updated: SchoolTimetableRow[]
          if (exists) {
            updated = prev.schoolTimetable.map(t => {
              if (t.date.replace(/-/g, '/') === targetDate) {
                return {
                  ...t,
                  morning_trip: payload.morning_trip !== undefined ? payload.morning_trip : t.morning_trip,
                  afternoon_trip_1: payload.afternoon_trip_1 !== undefined ? payload.afternoon_trip_1 : t.afternoon_trip_1,
                  afternoon_trip_2: payload.afternoon_trip_2 !== undefined ? payload.afternoon_trip_2 : t.afternoon_trip_2,
                  afternoon_trip_3: payload.afternoon_trip_3 !== undefined ? payload.afternoon_trip_3 : t.afternoon_trip_3,
                  note: payload.note !== undefined ? payload.note : t.note,
                  calendar_label: payload.calendar_label !== undefined ? payload.calendar_label : t.calendar_label
                }
              }
              return t
            })
          } else {
            updated = [
              ...prev.schoolTimetable,
              {
                date: targetDate,
                morning_trip: payload.morning_trip || '',
                afternoon_trip_1: payload.afternoon_trip_1 || '',
                afternoon_trip_2: payload.afternoon_trip_2 || '',
                afternoon_trip_3: payload.afternoon_trip_3 || '',
                note: payload.note || '',
                calendar_label: payload.calendar_label || ''
              }
            ]
          }
          return { ...prev, schoolTimetable: updated }
        })
        await refreshAll()
      }
      return res
    } finally {
      setSyncing(false)
    }
  }

  // 学校用時刻表の月間一括保存
  const handleSaveBatchSchoolTimetable = async (timetables: Parameters<typeof saveBatchSchoolTimetableToSheet>[0]) => {
    setSyncing(true)
    try {
      const res = await saveBatchSchoolTimetableToSheet(timetables)
      if (res.success) {
        setData(prev => {
          const timetableMap = new Map(prev.schoolTimetable.map(t => [t.date.replace(/-/g, '/'), t]))
          timetables.forEach(t => {
            const d = t.date.replace(/-/g, '/')
            timetableMap.set(d, {
              date: d,
              morning_trip: t.morning_trip || '',
              afternoon_trip_1: t.afternoon_trip_1 || '',
              afternoon_trip_2: t.afternoon_trip_2 || '',
              afternoon_trip_3: t.afternoon_trip_3 || '',
              note: t.note || '',
              calendar_label: t.calendar_label || ''
            })
          })
          return {
            ...prev,
            schoolTimetable: Array.from(timetableMap.values())
          }
        })
        await refreshAll()
      }
      return res
    } finally {
      setSyncing(false)
    }
  }

  // バス停マスタの保存・更新・追加
  const handleSaveBusStop = async (payload: Parameters<typeof saveBusStopToSheet>[0]) => {
    setSyncing(true)
    try {
      const res = await saveBusStopToSheet(payload)
      if (res.success) {
        setData(prev => {
          const targetOldName = (payload.old_name || payload.name).trim()
          const newName = payload.name.trim()
          const exists = prev.busStops.some(b => b.name === targetOldName)
          let updated: BusStopRow[]
          if (exists) {
            updated = prev.busStops.map(b => {
              if (b.name === targetOldName) {
                return {
                  name: newName,
                  address: payload.address !== undefined ? payload.address : b.address,
                  arrival_time_morning: payload.arrival_time_morning !== undefined ? payload.arrival_time_morning : b.arrival_time_morning,
                  order: payload.order !== undefined ? Number(payload.order) : b.order
                }
              }
              return b
            })
          } else {
            updated = [
              ...prev.busStops,
              {
                name: newName,
                address: payload.address || '',
                arrival_time_morning: payload.arrival_time_morning || '',
                order: payload.order !== undefined ? Number(payload.order) : prev.busStops.length + 1
              }
            ]
          }
          updated.sort((a, b) => (a.order || 0) - (b.order || 0))
          return { ...prev, busStops: updated }
        })
        await refreshAll()
      }
      return res
    } finally {
      setSyncing(false)
    }
  }

  // バス停マスタの削除
  const handleDeleteBusStop = async (stopName: string) => {
    setSyncing(true)
    try {
      const res = await deleteBusStopFromSheet(stopName)
      if (res.success) {
        setData(prev => ({
          ...prev,
          busStops: prev.busStops.filter(b => b.name !== stopName.trim())
        }))
        await refreshAll()
      }
      return res
    } finally {
      setSyncing(false)
    }
  }

  // 新入生・新規生徒の事前登録＆コード発行（管理者）
  const handleRegisterNewStudentWithCode = async (payload: Parameters<typeof registerNewStudentWithCodeToSheet>[0]) => {
    setSyncing(true)
    try {
      const res = await registerNewStudentWithCodeToSheet(payload)
      if (res.success || res.status === 'success') {
        const issuedCode = res.auth_code || res.code
        if (issuedCode && payload.student_name_2 && payload.student_name_2.trim()) {
          try {
            await saveGuardianMasterToSheet({
              parent_email: '',
              auth_code: issuedCode,
              student_name_1: payload.student_name.trim(),
              student_name_2: payload.student_name_2.trim(),
              bus_stop_name: payload.bus_stop_name || '',
              note: payload.note || '',
              default_morning: '乗る',
              default_afternoon: '1便'
            })
          } catch (err) {
            console.warn('[AppContext] Failed to update sibling in registerNewStudentWithCode:', err)
          }
        }
        await refreshAll()
      }
      return res
    } finally {
      setSyncing(false)
    }
  }

  // 認証コードによる保護者アカウント連携（初回・兄弟追加）
  const handleLinkStudentWithCode = async (payload: { email: string; code: string }) => {
    setSyncing(true)
    try {
      const res = await linkStudentWithCodeToSheet(payload)
      if (res.success || res.status === 'success') {
        const fresh = await fetchSpreadsheetMaster()
        setData(fresh)
        // ログイン状態をセット/更新
        const cleanEmail = payload.email.trim().toLowerCase()
        const guardianMatch = fresh.guardianMaster.find(g => g.parent_email && g.parent_email.toLowerCase() === cleanEmail)

        // 統合後の全生徒リスト
        const allNames = guardianMatch?.student_names || res.student_names || (res.student_name ? [res.student_name] : ['お子様'])
        const newlyAdded = res.student_name || allNames[allNames.length - 1] || allNames[0]

        const updatedUser: AuthUser = {
          email: cleanEmail,
          name: `${allNames[0] || 'お子様'}の保護者`,
          role: '保護者',
          studentName: newlyAdded, // 追加された妹・弟をアクティブに選択
          studentNames: allNames,
          authCode: guardianMatch?.auth_code || user?.authCode
        }
        try {
          localStorage.setItem('school_bus_active_session_v2', JSON.stringify({
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role,
            studentName: updatedUser.studentName,
            studentNames: updatedUser.studentNames,
            authCode: updatedUser.authCode
          }))
        } catch (e) {
          console.warn('[AppContext] Failed to persist session after linking sibling:', e)
        }
        setUser(updatedUser)
      }
      return res
    } finally {
      setSyncing(false)
    }
  }

  // 生徒・保護者マスターの行削除（action: "deleteGuardianMaster"）
  const handleDeleteGuardianMaster = async (payload: {
    parent_email?: string
    auth_code?: string
    student_name?: string
  }) => {
    setSyncing(true)
    try {
      // 削除対象世帯の生徒名リストを特定
      const targetGuardian = data.guardianMaster.find(g => {
        if (payload.parent_email && g.parent_email && g.parent_email.toLowerCase() === payload.parent_email.toLowerCase()) return true
        if (payload.auth_code && g.auth_code && g.auth_code.trim().toUpperCase() === payload.auth_code.trim().toUpperCase()) return true
        if (payload.student_name && g.student_names.includes(payload.student_name)) return true
        return false
      })
      const deletedStudents = targetGuardian ? targetGuardian.student_names : (payload.student_name ? [payload.student_name] : [])

      const res = await deleteGuardianMasterFromSheet(payload)
      const isSuccess = res.success || res.status === 'success'
      if (isSuccess) {
        // ローカルの guardianMaster から即座に除外（楽観的更新）
        setData(prev => ({
          ...prev,
          guardianMaster: prev.guardianMaster.filter(g => {
            if (payload.parent_email && g.parent_email && g.parent_email.toLowerCase() === payload.parent_email.toLowerCase()) {
              return false
            }
            if (payload.auth_code && g.auth_code && g.auth_code.trim().toUpperCase() === payload.auth_code.trim().toUpperCase()) {
              return false
            }
            if (!g.parent_email && !g.auth_code && payload.student_name && g.student_names.includes(payload.student_name)) {
              return false
            }
            return true
          }),
          // schedules からも削除された生徒の予約レコードを即座に除外
          schedules: prev.schedules.filter(s => !deletedStudents.includes(s.student_name))
        }))

        // もしログイン中の保護者世帯が削除された場合、セッションを即時ログアウト
        if (user && user.role === '保護者') {
          const userEmail = (user.email || '').toLowerCase()
          const isCurrentParentDeleted = (payload.parent_email && userEmail === payload.parent_email.toLowerCase()) ||
            (deletedStudents.includes(user.studentName || ''))
          if (isCurrentParentDeleted) {
            logout()
          }
        }

        await refreshAll()
      }
      return res
    } finally {
      setSyncing(false)
    }
  }

  return (
    <AppContext.Provider
      value={{
        user,
        loading,
        syncing,
        error,
        lastSyncedTime,
        showTimeoutFallback,
        hasCachedData,
        isUsingCachedData,
        openWithCachedData,
        retryConnection,
        guardianMaster: data.guardianMaster,
        busStops: data.busStops,
        schedules: data.schedules,
        basicSettings: data.basicSettings,
        schoolTimetable: data.schoolTimetable,
        userPermissions: data.userPermissions,
        holidays: data.holidays || [],
        publishedMonths,
        login,
        logout,
        refreshAll,
        saveReservation: handleSaveReservation,
        saveBatchSchedules: handleSaveBatchSchedules,
        recordBoarding: handleRecordBoarding,
        saveBasicSetting: handleSaveBasicSetting,
        saveMonthPublishStatus: handleSaveMonthPublishStatus,
        saveGuardianMaster: handleSaveGuardianMaster,
        saveSchoolTimetable: handleSaveSchoolTimetable,
        saveBatchSchoolTimetable: handleSaveBatchSchoolTimetable,
        saveBusStop: handleSaveBusStop,
        deleteBusStop: handleDeleteBusStop,
        registerNewStudentWithCode: handleRegisterNewStudentWithCode,
        linkStudentWithCode: handleLinkStudentWithCode,
        deleteGuardianMaster: handleDeleteGuardianMaster,
        switchRole,
        quickLoginAs,
        loginAsParentStudent,
        loginWithAuthCode,
        clearAllCacheAndResync
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
