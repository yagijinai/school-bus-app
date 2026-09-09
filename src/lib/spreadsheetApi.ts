/**
 * Google Apps Script (GAS) スプレッドシート直結 API クライアント
 * ※ブラウザキャッシュ (localStorage) は一切使用せず、常にGASから最新データを取得します。
 */

import type {
  AllMasterData,
  GuardianMasterRow,
  BusStopRow,
  ScheduleCalendarRow,
  BasicSettingRow,
  SchoolTimetableRow,
  UserPermissionRow
} from '../types/spreadsheet'

const GAS_API_URL = 
  import.meta.env.VITE_GAS_API_URL || 
  import.meta.env.NEXT_PUBLIC_GAS_API_URL || 
  'https://script.google.com/macros/s/AKfycbxm4XlGSbamPsbQyKmqg5ia5pJ85LPmgX83Sn-RhNV3gdOcwZpvMB2Oju3z41EBk-6omQ/exec'

/**
 * 日付文字列を YYYY/MM/DD 形式（スラッシュ区切り）に正規化
 */
export function toSlashDate(val: any): string {
  if (!val) return ''
  if (val instanceof Date) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}/${m}/${d}`
  }
  const str = String(val).trim().replace(/-/g, '/')
  const parts = str.split('/')
  if (parts.length === 3) {
    const y = parts[0]
    const m = parts[1].padStart(2, '0')
    const d = parts[2].padStart(2, '0')
    return `${y}/${m}/${d}`
  }
  return str
}

/**
 * 日付文字列を YYYY-MM-DD 形式（input[type=date]用）に変換
 */
export function toHyphenDate(val: string): string {
  if (!val) return ''
  return val.trim().replace(/\//g, '-')
}

/**
 * 現在日時を YYYY/MM/DD HH:mm:ss 形式で生成
 */
export function formatNowJ(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/**
 * 時刻文字列を確実に「HH:mm」形式（日付部分を完全排除）に正規化
 * 例: "1899/12/30 07:45:00" -> "07:45"
 * 例: "07:45:00" -> "07:45"
 * 例: "7:45" -> "07:45"
 */
export function formatTimeToHHmm(val: any): string {
  if (!val && val !== 0) return ''
  if (val instanceof Date) {
    const h = String(val.getHours()).padStart(2, '0')
    const m = String(val.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  }
  const str = String(val).trim()
  if (!str) return ''

  // 1. ISO/Date文字列または通常文字列から時:分を抽出
  const match = str.match(/(?:(?:^|\s|T))(\d{1,2}):(\d{2})(?::\d{2})?/)
  if (match) {
    const h = match[1].padStart(2, '0')
    const m = match[2].padStart(2, '0')
    return `${h}:${m}`
  }

  // 2. Dateオブジェクトへのフォールバック変換
  const d = new Date(str)
  if (!isNaN(d.getTime())) {
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  }

  return str
}

/**
 * GAS GETリクエスト送信
 */
async function sendGASGet<T>(params: Record<string, string>): Promise<{ success: boolean; data?: T; message?: string }> {
  try {
    const url = new URL(GAS_API_URL)
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v))
    // キャッシュ無効化のためタイムスタンプを付与
    url.searchParams.append('_t', String(Date.now()))

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    })
    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status}`)
    }
    const json = await res.json()
    return {
      success: json.status === 'success' || json.success === true,
      data: json.data || json,
      message: json.message
    }
  } catch (err: any) {
    console.error(`[GAS GET ${params.action}] Error:`, err)
    return { success: false, message: err.message }
  }
}

/**
 * GAS POSTリクエスト送信（CORS対策 text/plain）
 */
async function sendGASPost<T>(body: any): Promise<{ success: boolean; data?: T; message?: string; status?: string; code?: string; auth_code?: string; [key: string]: any }> {
  try {
    const res = await fetch(GAS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status}`)
    }
    const json = await res.json()
    const isSuccess = json.status === 'success' || json.success === true
    return {
      ...json,
      success: isSuccess,
      status: json.status || (isSuccess ? 'success' : 'error'),
      data: json.data || json,
      message: json.message
    }
  } catch (err: any) {
    console.error(`[GAS POST ${body.action}] Error:`, err)
    return { success: false, status: 'error', message: err.message }
  }
}

/**
 * 1. スプレッドシート全6シート一括直接取得（action: "getAllMaster"）
 * 画面を開くたびにスプレッドシートの生データを最新状態でフェッチします。
 */
export async function fetchSpreadsheetMaster(): Promise<AllMasterData> {
  const res = await sendGASGet<any>({ action: 'getAllMaster' })
  if (!res.success || !res.data) {
    console.warn('[GAS] getAllMaster returned no data or failed. Fallback to empty.')
    return {
      guardianMaster: [],
      busStops: [],
      schedules: [],
      basicSettings: [],
      schoolTimetable: [],
      userPermissions: []
    }
  }

  const raw = res.data

  // ① 生徒・保護者マスター (A: 保護者メールアドレス, B〜E: 生徒名1〜4, F: 登録バス停名, G: 備考, H: 基本_登校, I: 基本_下校)
  const rawGuardians = raw.guardianMaster || raw['生徒・保護者マスター'] || []
  const guardianMaster: GuardianMasterRow[] = (Array.isArray(rawGuardians) ? rawGuardians : []).map((row: any) => {
    const email = String(row.parent_email || row['保護者メールアドレス'] || '').trim().toLowerCase()
    const name1 = String(row.student_name_1 || row['生徒名１'] || row['生徒名1'] || '').trim()
    const name2 = String(row.student_name_2 || row['生徒名２'] || row['生徒名2'] || '').trim()
    const name3 = String(row.student_name_3 || row['生徒名３'] || row['生徒名3'] || '').trim()
    const name4 = String(row.student_name_4 || row['生徒名４'] || row['生徒名4'] || '').trim()
    const student_names = [name1, name2, name3, name4].filter(Boolean)

    return {
      parent_email: email,
      student_names,
      student_name_1: name1,
      student_name_2: name2,
      student_name_3: name3,
      student_name_4: name4,
      bus_stop_name: String(row.bus_stop_name || row['登録バス停名'] || '').trim(),
      note: String(row.note || row['備考'] || '').trim(),
      default_morning: String(row.default_morning || row['基本_登校'] || '').trim(),
      default_afternoon: String(row.default_afternoon || row['基本_下校'] || '').trim(),
      auth_code: String(row.auth_code || row['認証コード'] || '').trim()
    }
  }).filter(g => g.parent_email || g.student_names.length > 0 || g.auth_code)

  // ② バス停マスタ (A: バス停名, B: 住所, C: 到着予定時刻, D: 停車順序)
  const rawStops = raw.busStops || raw['バス停マスタ'] || []
  const busStops: BusStopRow[] = (Array.isArray(rawStops) ? rawStops : []).map((row: any) => ({
    name: String(row.name || row.bus_stop_name || row['バス停名'] || '').trim(),
    address: String(row.address || row['住所'] || '').trim(),
    arrival_time_morning: formatTimeToHHmm(row.arrival_time_morning || row['到着予定時刻（登校便）'] || row['到着予定時刻'] || ''),
    order: Number(row.order || row.order_index || row['停車順序'] || 0)
  })).filter(b => b.name)

  // ③ 運行予定カレンダー (A: ID, B: 日付, C: 生徒名, D: 登校ステータス, E: 下校ステータス, F〜H: 下校1〜3便, I: 備考, J: 更新日時, K: メール)
  const rawSchedules = raw.schedules || raw['運行予定カレンダー'] || []
  const schedules: ScheduleCalendarRow[] = (Array.isArray(rawSchedules) ? rawSchedules : []).map((row: any) => ({
    id: row.id ?? row['ID'] ?? '',
    date: toSlashDate(row.date || row['日付'] || ''),
    student_name: String(row.student_name || row['生徒名'] || '').trim(),
    morning_status: String(row.morning_status || row['登校ステータス'] || '').trim(),
    afternoon_status: String(row.afternoon_status || row['下校ステータス'] || '').trim(),
    afternoon_trip_1: String(row.afternoon_trip_1 || row['下校1便'] || '').trim(),
    afternoon_trip_2: String(row.afternoon_trip_2 || row['下校2便'] || '').trim(),
    afternoon_trip_3: String(row.afternoon_trip_3 || row['下校3便'] || '').trim(),
    note: String(row.note || row['備考'] || '').trim(),
    updated_at: String(row.updated_at || row['更新日時'] || '').trim(),
    parent_email: String(row.parent_email || row['保護者メールアドレス'] || '').trim().toLowerCase()
  })).filter(s => s.date && s.student_name)

  // ④ 基本設定・運休期間 (A: 設定名, B: 開始日, C: 終了日, D: 標準運行, E: 内容・時刻, F: 備考)
  const rawSettings = raw.basicSettings || raw['基本設定・運休期間'] || []
  const basicSettings: BasicSettingRow[] = (Array.isArray(rawSettings) ? rawSettings : []).map((row: any) => ({
    setting_name: String(row.setting_name || row['設定名'] || '').trim(),
    start_date: toSlashDate(row.start_date || row['開始日'] || ''),
    end_date: toSlashDate(row.end_date || row['終了日'] || ''),
    standard_operation: String(row.standard_operation || row['標準運行'] || '').trim(),
    content_time: String(row.content_time || row['内容・時刻'] || '').trim(),
    note: String(row.note || row['備考'] || '').trim()
  })).filter(s => s.setting_name)

  // ⑤ 学校用時刻表 (A: 日付, B: 登校便, C〜E: 下校1〜3便, F: 備考, G: カレンダー表示用)
  const rawTimetable = raw.schoolTimetable || raw['学校用時刻表'] || []
  const schoolTimetable: SchoolTimetableRow[] = (Array.isArray(rawTimetable) ? rawTimetable : []).map((row: any) => ({
    date: toSlashDate(row.date || row['日付'] || ''),
    morning_trip: String(row.morning_trip || row['登校便'] || '').trim(),
    afternoon_trip_1: String(row.afternoon_trip_1 || row['下校1便'] || '').trim(),
    afternoon_trip_2: String(row.afternoon_trip_2 || row['下校2便'] || '').trim(),
    afternoon_trip_3: String(row.afternoon_trip_3 || row['下校3便'] || '').trim(),
    note: String(row.note || row['備考'] || '').trim(),
    calendar_label: String(row.calendar_label || row['カレンダー表示用'] || '').trim()
  })).filter(t => t.date)

  // ⑥ ユーザー権限マスタ (A: メールアドレス, B: 指名, C: 役割)
  const rawPerms = raw.userPermissions || raw['ユーザー権限マスタ'] || []
  const userPermissions: UserPermissionRow[] = (Array.isArray(rawPerms) ? rawPerms : []).map((row: any) => {
    const rawRole = String(row.role || row['役割'] || '').trim()
    const roleLower = rawRole.toLowerCase()
    let role: '管理者' | '運転手' | '保護者' = '保護者'

    // 役割判定：管理者（または教頭・教諭・admin等の管理者キーワードを含む場合）
    if (
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
      role = '管理者'
    } else if (
      // 役割判定：運転手（またはdriver等を含む場合）
      rawRole.includes('運転手') ||
      rawRole.includes('運転') ||
      rawRole.includes('ドライバー') ||
      roleLower.includes('driver')
    ) {
      role = '運転手'
    } else {
      role = '保護者'
    }

    return {
      email: String(row.email || row['メールアドレス'] || '').trim().toLowerCase(),
      name: String(row.name || row['指名'] || row['氏名'] || '').trim(),
      role
    }
  }).filter(p => p.email)

  return {
    guardianMaster,
    busStops,
    schedules,
    basicSettings,
    schoolTimetable,
    userPermissions
  }
}

/**
 * 2. 運行予定カレンダーの保存（action: "saveReservation"）
 */
export async function saveReservationToSheet(payload: {
  date: string // YYYY/MM/DD
  student_name: string
  morning_status: string // 「乗る」または 空白
  afternoon_status: string // 「乗らない」または 空白
  afternoon_trip_1?: string
  afternoon_trip_2?: string
  afternoon_trip_3?: string
  note?: string
  parent_email: string
}): Promise<{ success: boolean; message?: string }> {
  return sendGASPost({
    action: 'saveReservation',
    date: toSlashDate(payload.date),
    student_name: payload.student_name,
    morning_status: payload.morning_status,
    afternoon_status: payload.afternoon_status,
    afternoon_trip_1: payload.afternoon_trip_1 || '',
    afternoon_trip_2: payload.afternoon_trip_2 || '',
    afternoon_trip_3: payload.afternoon_trip_3 || '',
    note: payload.note || '',
    parent_email: payload.parent_email.trim().toLowerCase(),
    updated_at: formatNowJ()
  })
}

/**
 * 3. 基本設定・運休期間の保存・セル更新（action: "saveBasicSetting"）
 */
export async function saveBasicSettingToSheet(payload: {
  setting_name: string
  start_date?: string
  end_date?: string
  standard_operation?: string
  content_time?: string
  note?: string
}): Promise<{ success: boolean; message?: string }> {
  return sendGASPost({
    action: 'saveBasicSetting',
    setting_name: payload.setting_name.trim(),
    start_date: payload.start_date ? toSlashDate(payload.start_date) : '',
    end_date: payload.end_date ? toSlashDate(payload.end_date) : '',
    standard_operation: payload.standard_operation || '',
    content_time: payload.content_time || '',
    note: payload.note || ''
  })
}

/**
 * 4. 生徒・保護者マスターの保存・更新（action: "saveGuardianMaster"）
 */
export async function saveGuardianMasterToSheet(payload: {
  parent_email: string
  student_name_1?: string
  student_name_2?: string
  student_name_3?: string
  student_name_4?: string
  bus_stop_name: string
  note?: string
  default_morning: string
  default_afternoon: string
}): Promise<{ success: boolean; message?: string }> {
  return sendGASPost({
    action: 'saveGuardianMaster',
    parentEmail: payload.parent_email.trim().toLowerCase(),
    student1: payload.student_name_1 || '',
    student2: payload.student_name_2 || '',
    student3: payload.student_name_3 || '',
    student4: payload.student_name_4 || '',
    busStop: payload.bus_stop_name || '',
    memo: payload.note || '',
    defaultToSchool: payload.default_morning || '乗る',
    defaultFromSchool: payload.default_afternoon || '1便'
  })
}

/**
 * 5. 学校用時刻表の保存・更新（action: "saveSchoolTimetable"）
 */
export async function saveSchoolTimetableToSheet(payload: {
  date: string // YYYY/MM/DD
  morning_trip?: string
  afternoon_trip_1?: string
  afternoon_trip_2?: string
  afternoon_trip_3?: string
  note?: string
  calendar_label?: string
}): Promise<{ success: boolean; message?: string }> {
  return sendGASPost({
    action: 'saveSchoolTimetable',
    date: toSlashDate(payload.date),
    morning_trip: payload.morning_trip || '',
    afternoon_trip_1: payload.afternoon_trip_1 || '',
    afternoon_trip_2: payload.afternoon_trip_2 || '',
    afternoon_trip_3: payload.afternoon_trip_3 || '',
    note: payload.note || '',
    calendar_label: payload.calendar_label || ''
  })
}

/**
 * 6. バス停マスタの保存・更新・追加（action: "saveBusStop"）
 */
export async function saveBusStopToSheet(payload: {
  name: string
  old_name?: string
  address?: string
  arrival_time_morning?: string
  order?: number
}): Promise<{ success: boolean; message?: string }> {
  return sendGASPost({
    action: 'saveBusStop',
    name: payload.name.trim(),
    old_name: payload.old_name ? payload.old_name.trim() : payload.name.trim(),
    address: payload.address || '',
    arrival_time_morning: formatTimeToHHmm(payload.arrival_time_morning || ''),
    order: payload.order !== undefined ? Number(payload.order) : 0
  })
}

/**
 * 7. バス停マスタの削除（action: "deleteBusStop"）
 */
export async function deleteBusStopFromSheet(stopName: string): Promise<{ success: boolean; message?: string }> {
  return sendGASPost({
    action: 'deleteBusStop',
    name: stopName.trim()
  })
}

/**
 * 8. 新入生・新規生徒の事前登録＆認証コード発行（管理者向け action: "registerNewStudentWithCode"）
 */
export async function registerNewStudentWithCodeToSheet(payload: {
  student_name: string
  bus_stop_name?: string
  note?: string
}): Promise<{ success: boolean; status?: string; message?: string; code?: string; auth_code?: string; student_name?: string; [key: string]: any }> {
  return sendGASPost({
    action: 'registerNewStudentWithCode',
    student_name: payload.student_name.trim(),
    bus_stop_name: payload.bus_stop_name || '',
    note: payload.note || ''
  })
}

/**
 * 9. 保護者アカウントと生徒の認証コード連携（action: "linkStudentWithCode"）
 */
export async function linkStudentWithCodeToSheet(payload: {
  email: string
  code: string
}): Promise<{ success: boolean; status?: string; message?: string; student_name?: string; is_sibling?: boolean; [key: string]: any }> {
  return sendGASPost({
    action: 'linkStudentWithCode',
    email: payload.email.trim().toLowerCase(),
    code: payload.code.trim()
  })
}

/**
 * 10. 生徒・保護者マスターの行削除（action: "deleteGuardianMaster"）
 */
export async function deleteGuardianMasterFromSheet(payload: {
  parent_email?: string
  auth_code?: string
  student_name?: string
}): Promise<{ success: boolean; status?: string; message?: string; [key: string]: any }> {
  return sendGASPost({
    action: 'deleteGuardianMaster',
    parent_email: payload.parent_email ? payload.parent_email.trim().toLowerCase() : '',
    email: payload.parent_email ? payload.parent_email.trim().toLowerCase() : '',
    parentEmail: payload.parent_email ? payload.parent_email.trim().toLowerCase() : '',
    auth_code: payload.auth_code ? payload.auth_code.trim() : '',
    code: payload.auth_code ? payload.auth_code.trim() : '',
    student_name: payload.student_name ? payload.student_name.trim() : ''
  })
}

