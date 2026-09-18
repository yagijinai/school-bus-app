import type { BasicSettingRow, SchoolTimetableRow, ScheduleCalendarRow, HolidayItem } from '../types/spreadsheet'
import { getJapaneseHolidayName } from './japaneseHolidays'

export interface SuspensionResult {
  isSuspended: boolean
  name: string
  note: string
}

/**
 * 日付文字列（YYYY/MM/DD または YYYY-MM-DD）から YYYY/MM/DD 形式のスラッシュ区切り文字列を生成
 */
function normalizeDateSlash(val: string): string {
  if (!val) return ''
  const str = val.trim().replace(/-/g, '/')
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
 * 月日文字列（MM/DD または M/D）を 2桁/2桁 の MM/DD に正規化
 */
function normalizeMonthDay(val: string): string | null {
  if (!val) return null
  const str = val.trim().replace(/-/g, '/')
  const parts = str.split('/')
  if (parts.length === 2) {
    const m = parts[0].padStart(2, '0')
    const d = parts[1].padStart(2, '0')
    return `${m}/${d}`
  }
  if (parts.length === 3) {
    const m = parts[1].padStart(2, '0')
    const d = parts[2].padStart(2, '0')
    return `${m}/${d}`
  }
  return null
}

/**
 * 指定された日付が「基本設定・運休期間」によって運休（夏休み・冬休み・春休み・全便運休等）に該当するか判定
 * 年非依存の「MM/DD〜MM/DD」形式（例: 07/21〜08/31、12/25〜01/07）の自動判定に対応
 */
export function checkSuspension(
  dateSlash: string,
  basicSettings: BasicSettingRow[]
): SuspensionResult {
  if (!dateSlash || !basicSettings || basicSettings.length === 0) {
    return { isSuspended: false, name: '', note: '' }
  }

  const cleanDate = normalizeDateSlash(dateSlash)
  const parts = cleanDate.split('/')
  if (parts.length !== 3) {
    return { isSuspended: false, name: '', note: '' }
  }

  const targetMD = `${parts[1]}/${parts[2]}` // MM/DD

  for (const b of basicSettings) {
    const name = (b.setting_name || '').trim()
    const stdOp = (b.standard_operation || '').trim()
    const content = (b.content_time || '').trim()
    const note = (b.note || '').trim()

    // 確定ステータス用行（時刻表公開_ / PUBLISH_）は除外
    if (name.startsWith('時刻表公開_') || name.toUpperCase().startsWith('PUBLISH_')) {
      continue
    }

    // 運休対象であるかどうかの判定（夏休み・冬休み・春休みの長期休業、または振替休日、運休指定等）
    const isLongVacation = /夏休み|夏期休業|夏期休暇|冬休み|冬期休業|冬期休暇|春休み|春期休業|春期休暇|休業|運休|振替|記念日|創立/.test(name)
    const isSuspendedOp = 
      stdOp === '運休' || 
      stdOp.includes('運休') || 
      content.includes('運休') || 
      content.includes('全便運休') || 
      note.includes('運休') ||
      note.includes('全便運休')

    if (!isLongVacation && !isSuspendedOp) {
      continue
    }

    const startRaw = (b.start_date || '').trim()
    // C列終了日が空欄の場合は開始日と同日の単発休業日（単発日指定）として安全に処理
    const endRaw = (b.end_date || '').trim() || startRaw
    if (!startRaw) continue

    const startParts = startRaw.replace(/-/g, '/').split('/')
    const endParts = endRaw.replace(/-/g, '/').split('/')

    // ① 年非依存形式（MM/DD 〜 MM/DD）の場合
    if (startParts.length === 2 || endParts.length === 2) {
      const sMD = normalizeMonthDay(startRaw)
      const eMD = normalizeMonthDay(endRaw)
      if (!sMD || !eMD) continue

      if (sMD <= eMD) {
        // 同一年内の期間（例: 07/21 〜 08/31、または 09/28 〜 09/28）
        if (targetMD >= sMD && targetMD <= eMD) {
          return { isSuspended: true, name: b.setting_name, note: b.note || b.content_time }
        }
      } else {
        // 年またぎの期間（例: 12/25 〜 01/07）
        if (targetMD >= sMD || targetMD <= eMD) {
          return { isSuspended: true, name: b.setting_name, note: b.note || b.content_time }
        }
      }
    } else if (startParts.length === 3 && endParts.length === 3) {
      // ② 完全日付形式（YYYY/MM/DD 〜 YYYY/MM/DD）の場合
      const sDate = normalizeDateSlash(startRaw)
      const eDate = normalizeDateSlash(endRaw)

      // 該当年での直接比較
      if (sDate <= eDate) {
        if (cleanDate >= sDate && cleanDate <= eDate) {
          return { isSuspended: true, name: b.setting_name, note: b.note || b.content_time }
        }
      } else {
        // 年またぎ
        if (cleanDate >= sDate || cleanDate <= eDate) {
          return { isSuspended: true, name: b.setting_name, note: b.note || b.content_time }
        }
      }

      // 長期休業・年次恒例行事名が付いている場合、過去年で登録されていても毎年自動適用できるよう MM/DD フォールバック判定
      if (isLongVacation) {
        const sMD = `${startParts[1].padStart(2, '0')}/${startParts[2].padStart(2, '0')}`
        const eMD = `${endParts[1].padStart(2, '0')}/${endParts[2].padStart(2, '0')}`
        if (sMD <= eMD) {
          if (targetMD >= sMD && targetMD <= eMD) {
            return { isSuspended: true, name: b.setting_name, note: b.note || b.content_time }
          }
        } else {
          if (targetMD >= sMD || targetMD <= eMD) {
            return { isSuspended: true, name: b.setting_name, note: b.note || b.content_time }
          }
        }
      }
    }
  }

  return { isSuspended: false, name: '', note: '' }
}

export interface IsOperatingDayOptions {
  basicSettings?: BasicSettingRow[]
  schoolTimetable?: SchoolTimetableRow[]
  schedules?: ScheduleCalendarRow[]
  holidays?: HolidayItem[]
}

/**
 * 日付文字列（YYYY/MM/DD または YYYY-MM-DD）から日本の祝日・振替休日の名称を取得
 * Google公式祝日カレンダーデータ（holidays）があれば最優先、なければ内蔵祝日ロジックをフォールバック参照
 */
export function getUnifiedHolidayName(
  dateStr: string,
  googleHolidays?: HolidayItem[]
): string | null {
  if (!dateStr) return null
  const slash = normalizeDateSlash(dateStr)
  const iso = slash.replace(/\//g, '-')

  // ① 内蔵祝日ロジック（祝日法完全準拠・国民の休日自動計算）を最優先判定
  const internal = getJapaneseHolidayName(slash)
  if (internal) {
    return internal
  }

  // ② Google公式祝日カレンダーデータからマッチング（予備補完）
  if (googleHolidays && googleHolidays.length > 0) {
    const found = googleHolidays.find(h => {
      const hSlash = normalizeDateSlash(h.date_slash || h.date)
      const hIso = hSlash.replace(/\//g, '-')
      return hSlash === slash || hIso === iso || h.date === iso || h.date === slash
    })
    if (found && found.title) {
      return found.title
    }
  }

  return null
}

export interface SuspensionOrHolidayInfo {
  isSuspended: boolean
  title: string
  detail: string
  type: 'holiday' | 'vacation' | 'school_suspended' | null
}

/**
 * 日付（YYYY/MM/DD）の祝日、長期休業、または学校独自休業日（全校運休・運動会振替等）の理由と詳細を統合取得
 */
export function getSuspensionOrHolidayReason(
  dateSlash: string,
  options: {
    basicSettings?: BasicSettingRow[]
    holidays?: HolidayItem[]
  } = {}
): SuspensionOrHolidayInfo {
  const cleanDate = normalizeDateSlash(dateSlash)
  if (!cleanDate) {
    return { isSuspended: false, title: '', detail: '', type: null }
  }

  // ① 祝日判定（Google公式祝日優先＋内蔵祝日フォールバック）
  const holidayName = getUnifiedHolidayName(cleanDate, options.holidays)
  if (holidayName) {
    return {
      isSuspended: true,
      title: holidayName,
      detail: '国民の祝日・振替休日',
      type: 'holiday'
    }
  }

  // ② 基本設定・運休期間判定（夏休み・冬休み・春休み、学校独自振替休日・全便運休）
  if (options.basicSettings && options.basicSettings.length > 0) {
    const susp = checkSuspension(cleanDate, options.basicSettings)
    if (susp.isSuspended) {
      const isLongVacation = /夏休み|夏期休業|夏期休暇|冬休み|冬期休業|冬期休暇|春休み|春期休業|春期休暇/.test(susp.name)
      return {
        isSuspended: true,
        title: susp.name,
        detail: susp.note || '学校設定運休日',
        type: isLongVacation ? 'vacation' : 'school_suspended'
      }
    }
  }

  return { isSuspended: false, title: '', detail: '', type: null }
}

/**
 * 指定された日付（YYYY/MM/DD）が実際にスクールバスの運行があり予約が必要な登校日（平日）であるか判定
 * 土日・Google公式祝日/国民祝日・長期休業（夏休み等）・学校独自運休日（運動会振替等）・全校運休日はすべて false を返す
 */
export function isOperatingDay(
  dateSlash: string,
  options: IsOperatingDayOptions = {}
): boolean {
  const cleanDate = normalizeDateSlash(dateSlash)
  const parts = cleanDate.split('/')
  if (parts.length !== 3) return false

  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  if (isNaN(year) || isNaN(month) || isNaN(day)) return false

  const d = new Date(year, month, day)

  // ① 土曜日(6)・日曜日(0)の除外
  const dow = d.getDay()
  if (dow === 0 || dow === 6) return false

  // ② 日本の祝日・振替休日の除外（Google公式祝日優先＋内蔵祝日フォールバック）
  if (getUnifiedHolidayName(cleanDate, options.holidays)) return false

  // ③ 基本設定・運休期間（夏休み・冬休み・春休み等の長期休業、および学校独自の振替休日・全便運休）の除外
  if (options.basicSettings && options.basicSettings.length > 0) {
    if (checkSuspension(cleanDate, options.basicSettings).isSuspended) {
      return false
    }
  }

  // ④ 学校用時刻表（schoolTimetable）での運休・休校判定
  if (options.schoolTimetable && options.schoolTimetable.length > 0) {
    const tRow = options.schoolTimetable.find(t => normalizeDateSlash(t.date) === cleanDate)
    if (tRow) {
      const note = (tRow.note || (tRow as any)['備考'] || '').trim()
      const label = (tRow.calendar_label || (tRow as any).calendar_display || (tRow as any)['カレンダー表示用'] || '').trim()
      if (/運休|全校運休|休校|祝日|休み/.test(note) || /運休|全校運休|休校|祝日|休み/.test(label)) {
        return false
      }
      // 登校便・下校便の時刻がすべて空欄・運休の場合も運行なしとしてスキップ
      const m = (tRow.morning_trip || (tRow as any)['登校便'] || '').trim()
      const t1 = (tRow.afternoon_trip_1 || (tRow as any).trip_1 || (tRow as any)['下校1便'] || '').trim()
      const t2 = (tRow.afternoon_trip_2 || (tRow as any).trip_2 || (tRow as any)['下校2便'] || '').trim()
      const t3 = (tRow.afternoon_trip_3 || (tRow as any).trip_3 || (tRow as any)['下校3便'] || '').trim()
      
      const hasTime = [m, t1, t2, t3].some(val => val && val !== '-' && val !== '--:--' && val !== 'なし' && val !== '運休')
      if (!hasTime) {
        return false
      }
    }
  }

  // ⑤ 運行予定カレンダーデータ（schedules）等で学校全体の運休が設定されている日の除外
  if (options.schedules && options.schedules.length > 0) {
    const daySchedules = options.schedules.filter(s => normalizeDateSlash(s.date) === cleanDate)
    const isSuspendedInSchedules = daySchedules.some(s => 
      s.morning_status === '運休' || 
      s.afternoon_status === '運休' ||
      s.morning_status === '全校運休' || 
      s.afternoon_status === '全校運休' ||
      (s.note && /全校運休|学校運休|臨時休校/.test(s.note))
    )
    if (isSuspendedInSchedules) return false
  }

  return true
}
