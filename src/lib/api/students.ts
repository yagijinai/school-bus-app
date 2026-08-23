import { supabase, isSupabaseConfigured } from '../supabaseClient'
import type { Database } from '../../types/supabase'

export type StudentRow = Database['public']['Tables']['students']['Row']
export type StudentInsert = Database['public']['Tables']['students']['Insert']
export type StudentUpdate = Database['public']['Tables']['students']['Update']

/**
 * 生徒マスタ一覧を取得（管理者・ドライバー用）
 */
export async function fetchStudents(): Promise<StudentRow[]> {
  if (!isSupabaseConfigured) return []
  
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('student_code', { ascending: true })

  if (error) {
    console.error('Error fetching students:', error)
    throw error
  }
  return data || []
}

/**
 * ID指定で生徒情報を取得
 */
export async function fetchStudentById(id: string): Promise<StudentRow | null> {
  if (!isSupabaseConfigured) return null

  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error(`Error fetching student ${id}:`, error)
    throw error
  }
  return data
}

/**
 * 保護者に紐づく生徒一覧を取得（保護者ダッシュボード用）
 */
export async function fetchStudentsByParent(parentId: string): Promise<StudentRow[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('parent_id', parentId)
    .order('student_code', { ascending: true })

  if (error) {
    console.error(`Error fetching students for parent ${parentId}:`, error)
    throw error
  }
  return data || []
}

/**
 * 生徒IDと照合キーで保護者アカウントに生徒を連携（照合登録）
 */
export async function verifyAndLinkStudent(
  studentCode: string,
  verificationCode: string,
  parentId: string
): Promise<StudentRow> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured')
  }

  // 1. 生徒コードと照合コードの一致を確認
  const { data: student, error: verifyError } = await supabase
    .from('students')
    .select('*')
    .eq('student_code', studentCode.trim())
    .eq('verification_code', verificationCode.trim())
    .single()

  if (verifyError || !student) {
    throw new Error('生徒IDまたは照合キーが一致しません。')
  }

  // 2. 保護者IDを紐付け更新
  const { data: updatedStudent, error: updateError } = await supabase
    .from('students')
    .update({ parent_id: parentId })
    .eq('id', student.id)
    .select()
    .single()

  if (updateError || !updatedStudent) {
    throw updateError || new Error('保護者の紐付けに失敗しました。')
  }

  return updatedStudent
}

/**
 * 生徒情報の新規作成または更新 (Upsert)
 */
export async function upsertStudent(student: StudentInsert): Promise<StudentRow> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured')
  }

  const { data, error } = await supabase
    .from('students')
    .upsert(student, { onConflict: 'student_code' })
    .select()
    .single()

  if (error) {
    console.error('Error upserting student:', error)
    throw error
  }
  return data
}

/**
 * 生徒マスタの一括インポート/更新 (CSV登録・マスター反映用)
 */
export async function bulkUpsertStudents(studentsList: StudentInsert[]): Promise<StudentRow[]> {
  if (!isSupabaseConfigured || studentsList.length === 0) return []

  const { data, error } = await supabase
    .from('students')
    .upsert(studentsList, { onConflict: 'student_code' })
    .select()

  if (error) {
    console.error('Error bulk upserting students:', error)
    throw error
  }
  return data || []
}

/**
 * 生徒の削除
 */
export async function deleteStudent(id: string): Promise<void> {
  if (!isSupabaseConfigured) return

  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', id)

  if (error) {
    console.error(`Error deleting student ${id}:`, error)
    throw error
  }
}
