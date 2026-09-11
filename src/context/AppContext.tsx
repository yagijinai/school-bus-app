import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type {
  AllMasterData,
  AuthUser,
  GuardianMasterRow,
  BusStopRow,
  ScheduleCalendarRow,
  BasicSettingRow,
  SchoolTimetableRow,
  UserPermissionRow
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
  formatNowJ,
  normalizeYearMonth,
  isMonthPublished
} from '../lib/spreadsheetApi'

// 過去のLocalStorageゴミを完全強制消去
if (typeof window !== 'undefined') {
  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch (e) {
    console.warn('Cache clear error:', e)
  }
}

interface AppContextType {
  user: AuthUser | null
  loading: boolean
  syncing: boolean
  error: string | null
  // スプレッドシート直結生データ
  guardianMaster: GuardianMasterRow[]
  busStops: BusStopRow[]
  schedules: ScheduleCalendarRow[]
  basicSettings: BasicSettingRow[]
  schoolTimetable: SchoolTimetableRow[]
  userPermissions: UserPermissionRow[]
  // 公開月リスト（ローカル保護ガード反映済）
  publishedMonths: string[]
  // 操作
  login: (email: string) => Promise<{ success: boolean; message?: string; needAuthCode?: boolean; email?: string }>
  logout: () => void
  refreshAll: () => Promise<void>
  saveReservation: (payload: Parameters<typeof saveReservationToSheet>[0]) => Promise<{ success: boolean; message?: string }>
  saveBatchSchedules: (schedules: Parameters<typeof saveBatchSchedulesToSheet>[0]) => Promise<{ success: boolean; message?: string; total?: number; updatedCount?: number; insertedCount?: number }>
  recordBoarding: (payload: { date: string; studentName: string; tripType: '登校' | '下校'; boarded: boolean; busStop?: string }) => Promise<{ success: boolean; boardingValue?: string; message?: string }>
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
  switchRole: (targetRole: '管理者' | '運転手' | '保護者') => Promise<void>
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [syncing, setSyncing] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // 全マスタ（メモリステートのみ・localStorage一切不使用）
  const [data, setData] = useState<AllMasterData>({
    guardianMaster: [],
    busStops: [],
    schedules: [],
    basicSettings: [],
    schoolTimetable: [],
    userPermissions: []
  })

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

  // スプレッドシート最新データの一括直接フェッチ
  const refreshAll = useCallback(async () => {
    setSyncing(true)
    setError(null)
    try {
      const master = await fetchSpreadsheetMaster()

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
    } catch (err: any) {
      console.error('[AppContext] Failed to refresh spreadsheet data:', err)
      setError('スプレッドシートのデータ取得に失敗しました。GASの接続状況を確認してください。')
    } finally {
      setSyncing(false)
      setLoading(false)
    }
  }, [])

  // アプリ初期ロード時：常にスプレッドシートから生データを直接取得
  useEffect(() => {
    refreshAll()
  }, [refreshAll])

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

  // 検証用：立場（ロール）の即時切り替え
  const switchRole = async (targetRole: '管理者' | '運転手' | '保護者') => {
    if (targetRole === '管理者') {
      const match = data.userPermissions.find(p => p.role === '管理者')
      setUser({
        email: match?.email || 'admin@school.ed.jp',
        name: match?.name || '管理者様',
        role: '管理者'
      })
    } else if (targetRole === '運転手') {
      const match = data.userPermissions.find(p => p.role === '運転手')
      setUser({
        email: match?.email || 'driver@school.ed.jp',
        name: match?.name || '運転手様',
        role: '運転手'
      })
    } else {
      const match = data.guardianMaster.find(g => g.parent_email)
      const studentName = match?.student_names[0] || '佐藤 太郎'
      setUser({
        email: match?.parent_email || 'yagijinai@gmail.com',
        name: `${studentName}の保護者`,
        role: '保護者'
      })
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

  // 運転手による乗車確認記録（楽観的UI更新 + GAS連動）
  const handleRecordBoarding = async (payload: {
    date: string
    studentName: string
    tripType: '登校' | '下校'
    boarded: boolean
    busStop?: string
  }): Promise<{ success: boolean; boardingValue?: string; message?: string }> => {
    const slashDate = payload.date.replace(/-/g, '/')
    const isMorning = payload.tripType === '登校'
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const timeStr = `${hh}:${mm}`
    const expectedVal = payload.boarded
      ? (payload.busStop ? `${timeStr} (${payload.busStop})` : timeStr)
      : ''

    // 1. 楽観的UI更新（ローカルの schedules を即座に更新）
    setData(prev => {
      let found = false
      const updatedSchedules = prev.schedules.map(s => {
        if (s.date.replace(/-/g, '/') === slashDate && s.student_name === payload.studentName) {
          found = true
          return {
            ...s,
            morning_boarding: isMorning ? expectedVal : s.morning_boarding,
            afternoon_boarding: !isMorning ? expectedVal : s.afternoon_boarding,
            updated_at: formatNowJ()
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
          afternoon_boarding: !isMorning ? expectedVal : ''
        })
      }

      return {
        ...prev,
        schedules: updatedSchedules
      }
    })

    // 2. バックグラウンドで GAS に送信
    try {
      const res = await recordBoardingToSheet({
        date: slashDate,
        studentName: payload.studentName,
        tripType: payload.tripType,
        boarded: payload.boarded,
        busStop: payload.busStop
      })

      if (res.success && res.boardingValue !== undefined) {
        // サーバー側確定値（実記録時刻）で上書き同期
        setData(prev => ({
          ...prev,
          schedules: prev.schedules.map(s => {
            if (s.date.replace(/-/g, '/') === slashDate && s.student_name === payload.studentName) {
              return {
                ...s,
                morning_boarding: isMorning ? res.boardingValue : s.morning_boarding,
                afternoon_boarding: !isMorning ? res.boardingValue : s.afternoon_boarding
              }
            }
            return s
          })
        }))
      }
      return res
    } catch (err: any) {
      console.error('recordBoarding failed:', err)
      return { success: false, message: err.message || '乗車確認の送信に失敗しました' }
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
      if (res.success) {
        setData(prev => {
          const targetEmail = payload.parent_email.trim().toLowerCase()
          const updated = prev.guardianMaster.map(g => {
            if (g.parent_email.toLowerCase() === targetEmail) {
              return {
                ...g,
                student_name_1: payload.student_name_1 !== undefined ? payload.student_name_1 : g.student_name_1,
                student_name_2: payload.student_name_2 !== undefined ? payload.student_name_2 : g.student_name_2,
                student_name_3: payload.student_name_3 !== undefined ? payload.student_name_3 : g.student_name_3,
                student_name_4: payload.student_name_4 !== undefined ? payload.student_name_4 : g.student_name_4,
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
        const guardianMatch = fresh.guardianMaster.find(g => g.parent_email.toLowerCase() === cleanEmail)
        const studentName = res.student_name || guardianMatch?.student_names[0] || 'お子様'
        setUser({
          email: cleanEmail,
          name: `${studentName}の保護者`,
          role: '保護者'
        })
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
            if (payload.auth_code && g.auth_code && g.auth_code === payload.auth_code) {
              return false
            }
            if (!g.parent_email && !g.auth_code && payload.student_name && g.student_names.includes(payload.student_name)) {
              return false
            }
            return true
          })
        }))
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
        guardianMaster: data.guardianMaster,
        busStops: data.busStops,
        schedules: data.schedules,
        basicSettings: data.basicSettings,
        schoolTimetable: data.schoolTimetable,
        userPermissions: data.userPermissions,
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
        switchRole
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
