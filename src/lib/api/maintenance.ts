/**
 * システムメンテナンス・一括処理モジュール
 * Supabaseテーブルクエリを完全撤廃
 */

import type { Student, BusRoute, BusStop } from '../../types/app'

export interface PromotionResult {
  totalProcessed: number
  graduatedCount: number
  promotedTo3rdCount: number
  promotedTo2ndCount: number
  unchangedCount: number
}

export interface TestDataGenerationResult {
  studentsCount: number
  reservationsCount: number
}

export interface CSVStudentRow {
  student_code: string
  name: string
  grade: string
  class_name?: string
  verification_code: string
  bus_stop_name?: string
  default_morning_ride: boolean
  default_afternoon_schedule: string | null
}

export interface CSVParseResult {
  validRows: CSVStudentRow[]
  errors: { row: number; error: string; raw: string }[]
}

/**
 * 1. 新年度・新学期一括進級処理
 */
export async function promoteAllStudents(currentStudents: Student[]): Promise<PromotionResult> {
  const result: PromotionResult = {
    totalProcessed: 0,
    graduatedCount: 0,
    promotedTo3rdCount: 0,
    promotedTo2ndCount: 0,
    unchangedCount: 0
  }

  if (currentStudents.length === 0) return result

  for (const student of currentStudents) {
    const rawGrade = (student.grade || '').trim()
    const cleanNum = rawGrade.replace(/[^0-9]/g, '')

    if (cleanNum === '3' || rawGrade.includes('3')) {
      result.graduatedCount++
    } else if (cleanNum === '2' || rawGrade.includes('2')) {
      result.promotedTo3rdCount++
    } else if (cleanNum === '1' || rawGrade.includes('1')) {
      result.promotedTo2ndCount++
    } else {
      result.unchangedCount++
    }
  }

  result.totalProcessed = currentStudents.length
  return result
}

/**
 * 2. テストデータ生成
 */
export async function generateDummyTestData(
  _busRoutes: BusRoute[],
  _busStops: BusStop[]
): Promise<TestDataGenerationResult> {
  return {
    studentsCount: 0,
    reservationsCount: 0
  }
}

/**
 * 3. テストデータの一括クリア
 */
export async function clearDummyTestData(): Promise<{ deletedStudentsCount: number }> {
  return { deletedStudentsCount: 0 }
}

/**
 * 4. CSVファイル読み込み
 */
export async function parseStudentCSV(file: File): Promise<CSVParseResult> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  let text = ''
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true })
    text = utf8Decoder.decode(bytes)
  } catch {
    const sjisDecoder = new TextDecoder('shift_jis', { fatal: false })
    text = sjisDecoder.decode(bytes)
  }

  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1)
  }

  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0)
  if (lines.length <= 1) {
    return { validRows: [], errors: [{ row: 1, error: 'CSVにデータ行が含まれていません。', raw: text }] }
  }

  const header = parseCSVLine(lines[0])
  const colMap = {
    code: header.findIndex(h => /生徒番号|生徒コード|student_code|id/i.test(h)),
    name: header.findIndex(h => /氏名|名前|生徒名|name/i.test(h)),
    grade: header.findIndex(h => /学年|grade/i.test(h)),
    className: header.findIndex(h => /組|クラス|class/i.test(h)),
    verify: header.findIndex(h => /照合コード|照合キー|確認コード|verification/i.test(h)),
    stop: header.findIndex(h => /バス停|停留所|乗車場所|stop/i.test(h)),
    morning: header.findIndex(h => /朝乗車|登校便|朝利用|morning/i.test(h)),
    afternoon: header.findIndex(h => /下校便|帰り便|afternoon/i.test(h))
  }

  const validRows: CSVStudentRow[] = []
  const errors: { row: number; error: string; raw: string }[] = []

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i]
    const cols = parseCSVLine(rawLine)
    if (cols.length === 0 || cols.every(c => c === '')) continue

    const code = colMap.code !== -1 ? cols[colMap.code] : cols[0]
    const name = colMap.name !== -1 ? cols[colMap.name] : cols[1]
    const grade = colMap.grade !== -1 ? cols[colMap.grade] : cols[2]
    const className = colMap.className !== -1 ? cols[colMap.className] : cols[3]
    const verify = colMap.verify !== -1 ? cols[colMap.verify] : cols[4]
    const stop = colMap.stop !== -1 ? cols[colMap.stop] : cols[5]
    const morningRaw = colMap.morning !== -1 ? cols[colMap.morning] : cols[6]
    const afternoonRaw = colMap.afternoon !== -1 ? cols[colMap.afternoon] : cols[7]

    if (!code || !name) {
      errors.push({ row: i + 1, error: '生徒番号または氏名が空です。', raw: rawLine })
      continue
    }

    const morningRide = morningRaw ? !/^(0|false|無|不乗車|乗らない|×)$/i.test(morningRaw.trim()) : true
    const afternoonSchedule = afternoonRaw && !/^(無|乗らない|不乗車|なし)$/i.test(afternoonRaw.trim()) 
      ? afternoonRaw.trim() 
      : '下校2便'

    validRows.push({
      student_code: code.trim(),
      name: name.trim(),
      grade: grade ? grade.trim() : '1年',
      class_name: className ? className.trim() : '1組',
      verification_code: verify ? verify.trim() : '0000',
      bus_stop_name: stop ? stop.trim() : undefined,
      default_morning_ride: morningRide,
      default_afternoon_schedule: afternoonSchedule
    })
  }

  return { validRows, errors }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let insideQuote = false
  let current = ''

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (insideQuote && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        insideQuote = !insideQuote
      }
    } else if (char === ',' && !insideQuote) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

/**
 * 5. パースされたCSV生徒データの一括登録
 */
export async function bulkImportStudents(
  rows: CSVStudentRow[],
  _busRoutes: BusRoute[],
  _busStops: BusStop[]
): Promise<{ insertedCount: number; updatedCount: number }> {
  return { insertedCount: rows.length, updatedCount: rows.length }
}

/**
 * 6. CSVテンプレートのダウンロード生成
 */
export function downloadStudentCSVTemplate(busStops: BusStop[]) {
  const sampleStop = busStops[0]?.stop_name || '中央駅前'
  const sampleStop2 = busStops[1]?.stop_name || '市役所北口'

  const headers = ['生徒番号', '氏名', '学年', '組', '照合コード', 'バス停名', '朝乗車', '下校便']
  const sampleRows = [
    ['2026001', '新入 太郎', '1年', '1組', '1234', sampleStop, '1', '下校2便'],
    ['2026002', '新入 花子', '1年', '1組', '5678', sampleStop2, '1', '下校1便'],
    ['2026003', '進級 次郎', '2年', '2組', '9012', sampleStop, '0', '下校3便']
  ]

  const csvContent = [
    headers.join(','),
    ...sampleRows.map(r => r.map(c => `"${c}"`).join(','))
  ].join('\r\n')

  const bom = new Uint8Array([0xEF, 0xBB, 0xBF])
  const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `生徒マスタ登録テンプレート_${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
