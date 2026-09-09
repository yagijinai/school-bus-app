/**
 * 開発・検証用機能フラグ
 * 
 * 本番運用開始時にGoogle OAuth（限定アクセス認証）へ切り替える際は、
 * 環境変数 VITE_ENABLE_DEV_SWITCHER=false を指定するか、
 * 本フラグを false に変更するだけで、検証用ワンクリックログインや
 * 画面上部のロール切替バーが自動的に完全非表示化されます。
 */
export const IS_DEV_SWITCHER_ENABLED =
  import.meta.env.VITE_ENABLE_DEV_SWITCHER !== 'false' &&
  import.meta.env.NEXT_PUBLIC_ENABLE_DEV_SWITCHER !== 'false'
