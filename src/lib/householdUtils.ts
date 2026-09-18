import type { GuardianMasterRow } from '../types/spreadsheet'

export interface HouseholdInfo {
  householdIndex: number
  primaryStudent: string
  allStudents: string[]
  familyName: string
  mainLabel: string
  subLabel: string
  busStopName: string
  parentEmail: string
}

/**
 * 生徒・保護者マスターのレコードから世帯情報・表示ラベル・苗字を動的に抽出
 */
export function extractHouseholdInfo(guardian: GuardianMasterRow | undefined, index: number): HouseholdInfo {
  if (!guardian) {
    return {
      householdIndex: index,
      primaryStudent: '',
      allStudents: [],
      familyName: `保護者${index}`,
      mainLabel: `保護者${index}として入る`,
      subLabel: '世帯テスト',
      busStopName: '',
      parentEmail: ''
    }
  }

  const names = guardian.student_names && guardian.student_names.length > 0
    ? guardian.student_names
    : [guardian.student_name_1, guardian.student_name_2, guardian.student_name_3, guardian.student_name_4].filter(Boolean) as string[]

  const primaryStudent = (names[0] || guardian.student_name_1 || '').trim()

  if (!primaryStudent) {
    return {
      householdIndex: index,
      primaryStudent: '',
      allStudents: [],
      familyName: `保護者${index}`,
      mainLabel: `保護者${index}として入る`,
      subLabel: '世帯テスト',
      busStopName: guardian.bus_stop_name || '',
      parentEmail: guardian.parent_email || ''
    }
  }

  // 苗字抽出（全角スペース、半角スペース、または先頭文字）
  let familyName = ''
  if (primaryStudent.includes('　')) {
    familyName = primaryStudent.split('　')[0].trim()
  } else if (primaryStudent.includes(' ')) {
    familyName = primaryStudent.split(' ')[0].trim()
  } else if (primaryStudent.length >= 4) {
    familyName = primaryStudent.slice(0, 2)
  } else {
    familyName = primaryStudent
  }

  const mainLabel = `${familyName}様の保護者として入る`
  const studentListStr = names.map(n => n.trim()).filter(Boolean).join('・')
  const subLabel = studentListStr ? `${studentListStr} 世帯` : '世帯テスト'

  return {
    householdIndex: index,
    primaryStudent,
    allStudents: names.map(n => n.trim()).filter(Boolean),
    familyName,
    mainLabel,
    subLabel,
    busStopName: guardian.bus_stop_name || '',
    parentEmail: guardian.parent_email || ''
  }
}
