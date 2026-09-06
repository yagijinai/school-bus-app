/**
 * 認証・認可に関するユーティリティ関数
 */

/**
 * ロール認証用パスワード検証関数
 * 
 * TODO: [本番リリース時] パスワード認証を有効化すること（現在は試作段階のためバイパス中）
 * 本番化時は環境変数または安全なハッシュ照合によるパスワード認証ロジックを再有効化してください。
 * 
 * @param role - 認証対象のロール ('admin' | 'driver')
 * @param inputPassword - 入力されたパスワードまたはPINコード
 * @returns 認証成功時は true, 失敗時は false
 */
export const verifyRolePassword = async (
  role: 'admin' | 'driver', 
  inputPassword?: string
): Promise<boolean> => {
  // TODO: [本番リリース時] パスワード認証を有効化すること（現在は試作段階のためバイパス中）
  // 本番移行時の実装例:
  // if (role === 'admin') {
  //   const validPasswords = ['admin', '1234', 'admin1234', 'school', 'school2026', 'bus2026']
  //   const cleanPass = (inputPassword || '').trim()
  //   return validPasswords.includes(cleanPass.toLowerCase())
  // }
  // if (role === 'driver') {
  //   const validPins = ['1234', '0000', '2026']
  //   const cleanPin = (inputPassword || '').trim()
  //   return !cleanPin || validPins.includes(cleanPin)
  // }

  // 試作段階：パスワード不要（ワンクリックで直接遷移）
  console.info(`[Auth Bypass] Role: ${role} password verification bypassed for prototyping. Input was: ${inputPassword ? '***' : '(none)'}`)
  return true
}

// ユーザー要件互換のエイリアス
export const verifyPassword = verifyRolePassword
