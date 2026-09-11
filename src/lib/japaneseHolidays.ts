/**
 * 日本の祝日判定ユーティリティ
 * 内閣府「国民の祝日に関する法律（昭和23年法律第178号）」完全準拠
 * - ハッピーマンデー制度
 * - 春分の日・秋分の日 天文計算
 * - 振替休日（祝日が日曜の場合、翌日以降の最も近い平日）
 * - 国民の休日（祝日と祝日に挟まれた平日）
 */

// キャッシュ: year -> Map<string, string> (キー: "YYYY/MM/DD", 値: 祝日名)
const holidayCache = new Map<number, Map<string, string>>()

// 春分の日の計算 (1980年〜2099年)
function getVernalEquinoxDay(year: number): number {
  if (year < 1980 || year > 2099) return 20
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
}

// 秋分の日の計算 (1980年〜2099年)
function getAutumnalEquinoxDay(year: number): number {
  if (year < 1980 || year > 2099) return 23
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
}

// 第N月曜日を求める (n: 1-indexed, month: 1-indexed)
function getNthMonday(year: number, month: number, nth: number): number {
  const firstDay = new Date(year, month - 1, 1).getDay()
  // 最初の月曜日の日付
  const firstMonday = ((8 - firstDay) % 7) || 7
  return firstMonday + (nth - 1) * 7
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * 指定年の全祝日・振替休日・国民の休日マップを生成
 */
export function getJapaneseHolidaysForYear(year: number): Map<string, string> {
  if (holidayCache.has(year)) {
    return holidayCache.get(year)!
  }

  const holidays = new Map<string, string>()

  const addHoliday = (month: number, day: number, name: string) => {
    const key = `${year}/${pad(month)}/${pad(day)}`
    holidays.set(key, name)
  }

  // 1. 固定祝日 & ハッピーマンデー
  // 1月
  addHoliday(1, 1, '元日')
  addHoliday(1, getNthMonday(year, 1, 2), '成人の日')

  // 2月
  addHoliday(2, 11, '建国記念の日')
  if (year >= 2020) {
    addHoliday(2, 23, '天皇誕生日')
  }

  // 3月
  const vernalDay = getVernalEquinoxDay(year)
  addHoliday(3, vernalDay, '春分の日')

  // 4月
  addHoliday(4, 29, '昭和の日')

  // 5月
  addHoliday(5, 3, '憲法記念日')
  addHoliday(5, 4, 'みどりの日')
  addHoliday(5, 5, 'こどもの日')

  // 7月
  addHoliday(7, getNthMonday(year, 7, 3), '海の日')

  // 8月
  if (year >= 2016) {
    addHoliday(8, 11, '山の日')
  }

  // 9月
  const respectDay = getNthMonday(year, 9, 3)
  addHoliday(9, respectDay, '敬老の日')
  const autumnalDay = getAutumnalEquinoxDay(year)
  addHoliday(9, autumnalDay, '秋分の日')

  // 10月
  addHoliday(10, getNthMonday(year, 10, 2), 'スポーツの日')

  // 11月
  addHoliday(11, 3, '文化の日')
  addHoliday(11, 23, '勤労感謝の日')

  // 2. 国民の休日判定（祝日と祝日に挟まれた平日）
  // 9月の敬老の日と秋分の日の間に挟まれるケースなど
  for (let m = 1; m <= 12; m++) {
    const daysInMonth = new Date(year, m, 0).getDate()
    for (let d = 2; d < daysInMonth; d++) {
      const prevKey = `${year}/${pad(m)}/${pad(d - 1)}`
      const currentKey = `${year}/${pad(m)}/${pad(d)}`
      const nextKey = `${year}/${pad(m)}/${pad(d + 1)}`

      if (holidays.has(prevKey) && holidays.has(nextKey) && !holidays.has(currentKey)) {
        const curDate = new Date(year, m - 1, d)
        // 日曜日でない場合
        if (curDate.getDay() !== 0) {
          holidays.set(currentKey, '国民の休日')
        }
      }
    }
  }

  // 3. 振替休日判定
  // 祝日が日曜日の場合、その日後においてその日に最も近い「国民の祝日でない日」を休日とする
  const baseHolidayKeys = Array.from(holidays.keys()).sort()
  for (const key of baseHolidayKeys) {
    const [y, m, d] = key.split('/').map(Number)
    const date = new Date(y, m - 1, d)
    if (date.getDay() === 0) {
      // 日曜日が祝日の場合、翌日以降で祝日でない直近の日を探す
      let testDate = new Date(y, m - 1, d + 1)
      while (true) {
        const testKey = `${testDate.getFullYear()}/${pad(testDate.getMonth() + 1)}/${pad(testDate.getDate())}`
        if (!holidays.has(testKey)) {
          holidays.set(testKey, '振替休日')
          break
        }
        testDate.setDate(testDate.getDate() + 1)
      }
    }
  }

  holidayCache.set(year, holidays)
  return holidays
}

/**
 * 指定された日付（YYYY/MM/DD または YYYY-MM-DD）が祝日かどうかを判定し、祝日名を返す
 * 祝日でない場合は null を返す
 */
export function getJapaneseHolidayName(dateStr: string): string | null {
  if (!dateStr) return null
  const normalized = dateStr.replace(/-/g, '/')
  const parts = normalized.split('/')
  if (parts.length < 3) return null

  const year = parseInt(parts[0], 10)
  if (isNaN(year)) return null

  const holidays = getJapaneseHolidaysForYear(year)
  const padKey = `${year}/${pad(parseInt(parts[1], 10))}/${pad(parseInt(parts[2], 10))}`
  return holidays.get(padKey) || null
}
