import { supabase, isSupabaseConfigured } from '../supabaseClient'
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
 * 3年生 -> 卒業
 * 2年生 -> 3年生
 * 1年生 -> 2年生
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

  const updates: { id: string; grade: string }[] = []

  for (const student of currentStudents) {
    const rawGrade = (student.grade || '').trim()
    const cleanNum = rawGrade.replace(/[^0-9]/g, '')

    if (cleanNum === '3' || rawGrade === '3年' || rawGrade === '３年' || rawGrade === '高3' || rawGrade === '中3') {
      updates.push({ id: student.id, grade: '卒業' })
      result.graduatedCount++
    } else if (cleanNum === '2' || rawGrade === '2年' || rawGrade === '２年' || rawGrade === '高2' || rawGrade === '中2') {
      updates.push({ id: student.id, grade: '3年' })
      result.promotedTo3rdCount++
    } else if (cleanNum === '1' || rawGrade === '1年' || rawGrade === '１年' || rawGrade === '高1' || rawGrade === '中1') {
      updates.push({ id: student.id, grade: '2年' })
      result.promotedTo2ndCount++
    } else {
      result.unchangedCount++
    }
  }

  result.totalProcessed = updates.length

  if (isSupabaseConfigured && updates.length > 0) {
    // 降順（卒業 -> 3年 -> 2年）でバッチ更新
    for (const item of updates) {
      const { error } = await supabase
        .from('students')
        .update({ grade: item.grade, updated_at: new Date().toISOString() })
        .eq('id', item.id)

      if (error) {
        console.error(`Failed to update student grade ${item.id}:`, error)
      }
    }
  }

  return result
}

/**
 * 2. テストデータ生成用ダミー生徒マスター定義 (18名)
 */
const DUMMY_STUDENTS_SEED = [
  { name: '佐藤 翔太', grade: '1年', class_name: '1組', default_morning: true, default_afternoon: '下校2便', note: 'バス通学・定刻' },
  { name: '鈴木 葵', grade: '1年', class_name: '1組', default_morning: true, default_afternoon: '下校1便', note: '木曜部活' },
  { name: '高橋 蓮', grade: '1年', class_name: '2組', default_morning: true, default_afternoon: '下校2便', note: '' },
  { name: '田中 陽菜', grade: '1年', class_name: '2組', default_morning: true, default_afternoon: '下校3便', note: '放課後自習' },
  { name: '渡辺 大和', grade: '1年', class_name: '1組', default_morning: false, default_afternoon: '下校2便', note: '朝は保護者送迎' },
  { name: '伊藤 結衣', grade: '1年', class_name: '2組', default_morning: true, default_afternoon: '下校1便', note: '' },
  { name: '山本 颯太', grade: '2年', class_name: '1組', default_morning: true, default_afternoon: '下校2便', note: 'サッカー部' },
  { name: '中村 美咲', grade: '2年', class_name: '1組', default_morning: true, default_afternoon: '下校3便', note: '吹奏楽部' },
  { name: '小林 陸', grade: '2年', class_name: '2組', default_morning: true, default_afternoon: '下校2便', note: 'バスケ部' },
  { name: '加藤 さくら', grade: '2年', class_name: '2組', default_morning: true, default_afternoon: '下校1便', note: '火・木病院' },
  { name: '吉田 湊', grade: '2年', class_name: '1組', default_morning: true, default_afternoon: '下校2便', note: '' },
  { name: '山田 莉央', grade: '2年', class_name: '2組', default_morning: false, default_afternoon: '下校2便', note: '' },
  { name: '佐々木 悠斗', grade: '3年', class_name: '1組', default_morning: true, default_afternoon: '下校3便', note: '受験補講' },
  { name: '松本 凛', grade: '3年', class_name: '1組', default_morning: true, default_afternoon: '下校3便', note: '生徒会' },
  { name: '井上 樹', grade: '3年', class_name: '2組', default_morning: true, default_afternoon: '下校2便', note: '図書委員' },
  { name: '木村 結菜', grade: '3年', class_name: '2組', default_morning: true, default_afternoon: '下校1便', note: '進路面談' },
  { name: '林 櫂', grade: '3年', class_name: '1組', default_morning: true, default_afternoon: '下校2便', note: '' },
  { name: '清水 心愛', grade: '3年', class_name: '2組', default_morning: true, default_afternoon: '下校3便', note: '個別指導' }
]

/**
 * 2. テスト生徒＆直近2週間分の予約データを一括生成
 */
export async function generateDummyTestData(
  busRoutes: BusRoute[],
  busStops: BusStop[]
): Promise<TestDataGenerationResult> {
  const defaultRoute = busRoutes[0] || { id: 'route-a', route_name: 'スクールバス運行ルート' }
  const stops = busStops.length > 0 ? busStops : [
    { id: 'stop-1', stop_name: '中央駅前', order_index: 1, bus_route_id: defaultRoute.id, arrival_time_morning: '07:30' },
    { id: 'stop-2', stop_name: '市役所北口', order_index: 2, bus_route_id: defaultRoute.id, arrival_time_morning: '07:38' },
    { id: 'stop-3', stop_name: '緑が丘公園前', order_index: 3, bus_route_id: defaultRoute.id, arrival_time_morning: '07:45' },
    { id: 'stop-4', stop_name: '学校正門（終点）', order_index: 4, bus_route_id: defaultRoute.id, arrival_time_morning: '08:00' }
  ]

  const insertedStudents: Student[] = []

  // 1. 生徒データの生成・投入
  for (let i = 0; i < DUMMY_STUDENTS_SEED.length; i++) {
    const seed = DUMMY_STUDENTS_SEED[i]
    const assignedStop = stops[i % stops.length]
    const studentCode = `TEST-${String(i + 1).padStart(3, '0')}`
    const verifyCode = String(1000 + i * 111).slice(0, 4)

    const studentPayload = {
      student_code: studentCode,
      name: seed.name,
      grade: seed.grade,
      class_name: seed.class_name,
      verification_code: verifyCode,
      bus_route_id: assignedStop.bus_route_id || defaultRoute.id,
      default_bus_stop_id: assignedStop.id,
      bus_stop_name: assignedStop.stop_name,
      default_morning_ride: seed.default_morning,
      default_afternoon_schedule: seed.default_afternoon,
      parent_id: null,
      household_id: `HH-TEST-${Math.floor(i / 2) + 1}`
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('students')
        .upsert(studentPayload, { onConflict: 'student_code' })
        .select()
        .single()

      if (!error && data) {
        insertedStudents.push(data as Student)
      }
    } else {
      insertedStudents.push({
        id: `mock-student-${studentCode}`,
        ...studentPayload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as Student)
    }
  }

  // 2. 直近2週間（今週の月〜金 + 来週の月〜金）の日付を算出
  const targetDates: string[] = []
  const now = new Date()
  const currentDay = now.getDay() // 0:日, 1:月
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay

  for (let week = 0; week < 2; week++) {
    for (let day = 0; day < 5; day++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset + (week * 7) + day)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dt = String(d.getDate()).padStart(2, '0')
      targetDates.push(`${y}-${m}-${dt}`)
    }
  }

  // 3. 予約データの生成
  const reservationsToInsert: any[] = []
  const afternoonOptions = ['下校1便', '下校2便', '下校3便', '下校4便', null]
  const sampleNotes = [
    '部活のため下校2便',
    '病院受診のため朝欠席',
    '図書委員会',
    '保護者お迎え',
    '塾のため1便',
    null,
    null,
    null
  ]

  for (const student of insertedStudents) {
    for (let dIndex = 0; dIndex < targetDates.length; dIndex++) {
      const dateStr = targetDates[dIndex]
      const rand = (student.student_code?.charCodeAt(student.student_code.length - 1) || 0) + dIndex

      const morningStatus = rand % 10 === 0 ? false : student.default_morning_ride ?? true
      const afternoonSchedule = rand % 8 === 0 ? null : (afternoonOptions[rand % afternoonOptions.length] || student.default_afternoon_schedule || '下校2便')
      const note = rand % 5 === 0 ? sampleNotes[rand % sampleNotes.length] : null

      reservationsToInsert.push({
        student_id: student.id,
        date: dateStr,
        morning_status: morningStatus,
        afternoon_schedule: afternoonSchedule,
        note: note
      })
    }
  }

  let resCount = 0
  if (isSupabaseConfigured && reservationsToInsert.length > 0) {
    // 50件ずつバッチUpsert
    const chunkSize = 50
    for (let i = 0; i < reservationsToInsert.length; i += chunkSize) {
      const chunk = reservationsToInsert.slice(i, i + chunkSize)
      const { error } = await supabase
        .from('reservations')
        .upsert(chunk, { onConflict: 'student_id,date' })

      if (!error) {
        resCount += chunk.length
      } else {
        console.error('Error inserting test reservations chunk:', error)
      }
    }
  } else {
    resCount = reservationsToInsert.length
  }

  return {
    studentsCount: insertedStudents.length,
    reservationsCount: resCount
  }
}

/**
 * 3. テストデータ（TEST-プレフィックス）の一括クリア
 */
export async function clearDummyTestData(): Promise<{ deletedStudentsCount: number }> {
  if (!isSupabaseConfigured) {
    return { deletedStudentsCount: 0 }
  }

  // 1. TEST- で始まる生徒を検索
  const { data: testStudents, error: fetchErr } = await supabase
    .from('students')
    .select('id')
    .ilike('student_code', 'TEST-%')

  if (fetchErr || !testStudents || testStudents.length === 0) {
    return { deletedStudentsCount: 0 }
  }

  const studentIds = testStudents.map(s => s.id)

  // 2. 関連する予約データを削除
  await supabase
    .from('reservations')
    .delete()
    .in('student_id', studentIds)

  // 3. 関連する点呼ステータスを削除
  await supabase
    .from('ride_statuses')
    .delete()
    .in('student_id', studentIds)

  // 4. 生徒データを削除
  const { error: delErr } = await supabase
    .from('students')
    .delete()
    .in('id', studentIds)

  if (delErr) {
    console.error('Error deleting test students:', delErr)
    throw delErr
  }

  return { deletedStudentsCount: studentIds.length }
}

/**
 * 4. CSVファイル読み込みとエンコーディング自動判定（UTF-8, UTF-8 with BOM, Shift-JIS）
 */
export async function parseStudentCSV(file: File): Promise<CSVParseResult> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // BOM判定またはデコード試行
  let text = ''
  try {
    // まず UTF-8 でデコード
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true })
    text = utf8Decoder.decode(bytes)
  } catch {
    try {
      // UTF-8で失敗した場合は Shift-JIS (Windows-31J) でデコード
      const sjisDecoder = new TextDecoder('shift_jis', { fatal: false })
      text = sjisDecoder.decode(bytes)
    } catch {
      // フォールバック
      const fallbackDecoder = new TextDecoder('utf-8')
      text = fallbackDecoder.decode(bytes)
    }
  }

  // BOM除去
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1)
  }

  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0)
  if (lines.length <= 1) {
    return { validRows: [], errors: [{ row: 1, error: 'CSVにデータ行が含まれていません。', raw: text }] }
  }

  // ヘッダー行の解析
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

/**
 * 簡易CSVラインパーサー（カンマ区切り・ダブルクォート対応）
 */
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
 * 5. パースされたCSV生徒データの一括登録/Upsert
 */
export async function bulkImportStudents(
  rows: CSVStudentRow[],
  busRoutes: BusRoute[],
  busStops: BusStop[]
): Promise<{ insertedCount: number; updatedCount: number }> {
  if (rows.length === 0) return { insertedCount: 0, updatedCount: 0 }

  const defaultRoute = busRoutes[0] || { id: 'route-a' }
  const stopNameToIdMap = new Map<string, { id: string; routeId: string }>()
  for (const s of busStops) {
    stopNameToIdMap.set(s.stop_name.trim(), { id: s.id, routeId: s.bus_route_id || defaultRoute.id })
  }

  const payloads = rows.map(r => {
    let stopId: string | null = null
    let routeId: string = defaultRoute.id

    if (r.bus_stop_name && stopNameToIdMap.has(r.bus_stop_name.trim())) {
      const match = stopNameToIdMap.get(r.bus_stop_name.trim())!
      stopId = match.id
      routeId = match.routeId
    } else if (busStops.length > 0) {
      stopId = busStops[0].id
      routeId = busStops[0].bus_route_id || defaultRoute.id
    }

    return {
      student_code: r.student_code,
      name: r.name,
      grade: r.grade,
      class_name: r.class_name || null,
      verification_code: r.verification_code || '0000',
      bus_route_id: routeId,
      default_bus_stop_id: stopId,
      bus_stop_name: r.bus_stop_name || (busStops[0]?.stop_name ?? null),
      default_morning_ride: r.default_morning_ride,
      default_afternoon_schedule: r.default_afternoon_schedule,
      updated_at: new Date().toISOString()
    }
  })

  let count = 0
  if (isSupabaseConfigured) {
    const chunkSize = 50
    for (let i = 0; i < payloads.length; i += chunkSize) {
      const chunk = payloads.slice(i, i + chunkSize)
      const { error } = await supabase
        .from('students')
        .upsert(chunk, { onConflict: 'student_code' })

      if (error) {
        console.error('Error importing student chunk:', error)
        throw error
      }
      count += chunk.length
    }
  } else {
    count = payloads.length
  }

  return { insertedCount: count, updatedCount: count }
}

/**
 * 6. CSVテンプレートのダウンロード生成 (UTF-8 with BOM)
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
