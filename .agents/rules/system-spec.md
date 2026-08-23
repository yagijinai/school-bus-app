スクールバス運行管理システム 仕様書 (system-spec.md)

本ドキュメントは、Google Antigravityが開発・コード生成を行う際の前提ルール（コンテキスト）として参照されるシステム仕様書です。

1. システム概要 & 目的

目的: スクールバスの運行状況、生徒の乗降情報、月次事前予約（1ヶ月分一括設定＋例外差分変更）、遅延・急な欠席連絡を「保護者」「バス運転者」「学校管理者」の3者でリアルタイムに共有し、運用効率化と安全確保を図る。

利用形態: Webアプリケーション（スマートフォン・PCレスポンシブ対応）

セキュリティ方針: 個人（生徒・保護者）情報を取り扱うため、事前許可されたユーザー（Google ID）のみがアクセスできる厳格な認証・認可基盤を構築する。

2. 技術スタック

フロントエンド: React, Tailwind CSS, Vite

バックエンド / DB / 認証: Supabase

Database: PostgreSQL (Row Level Security: RLS 導入必須)

Authentication: Supabase Auth (Google OAuth 2.0 による Google ID ログイン)

外部連携API: Google Calendar API (学校行事・運休スケジュールの取得)、Google Sheets API (スプレッドシート「スクールバスマスター」からの自動・手動同期)

デプロイ先想定: Vercel または Netlify

3. ユーザー区分とアクセス権限 (RBAC / RLS)

システムを利用するユーザーは以下の3つの役割（ロール）に分類されます。

ユーザーロール

認証方法

参照・操作権限の範囲

保護者 (Parent)

Google ID (個人Gmailなど)

・初回ログイン時の新規登録（保護者氏名・生徒名最大5名まで登録）



・自分の紐づく子供（生徒）の乗車状況の確認



・バスの現在地・遅延情報の閲覧



・基本パターンの事前登録（登校1便、下校1〜5便/乗車なし）



・毎月末における次月1ヶ月分の乗車便一括予約（変更日のみピンポイント修正）



・当日の急なキャンセル入力（※当日朝7:00まで受付）

バス運転者 (Driver)

Google ID (指定アカウント)

・担当便の運行開始 / 終了スイッチの切り替え



・バス停別の乗車対象生徒名簿の確認（停車順に誰がどのバス停で乗るか一覧表示）



・各バス停での乗車完了チェック



・運行中の遅延時間（5分・10分等）の更新

学校管理者 (Admin)

Google ID (@school.ed.jp 等)

・全バスの運行動態モニター・遅延アラートの管理



・バス便（登校1便・下校最大5便）およびバス停の事前登録・管理



・日別・便別・バス停別の乗車予約詳細確認機能（どの生徒がどのバス停から乗車予定か確認）



・スプレッドシート「スクールバスマスター」からの最新データ同期および相互書き込み管理

4. データベース構成案 (Supabase Schema & Migrations)

本システムは Supabase (PostgreSQL) を利用し、テーブル構築や初期シードの投入はプロジェクトフォルダ内の以下の SQL スクリプト群を適用して行います。
- スキーマ＆ポリシー定義: [schema.sql](file:///C:/Users/yagij/Desktop/野口/仕事/哲司/アプリ/スクールバス/school-bus-app/supabase/schema.sql)
- 初期マスター投入: [seed.sql](file:///C:/Users/yagij/Desktop/野口/仕事/哲司/アプリ/スクールバス/school-bus-app/supabase/seed.sql)

① Enumタイプ
・`user_role`: 'parent', 'driver', 'admin' （ユーザーの役割）
・`ride_status_enum`: 'riding', 'absent', 'completed' （本日の乗車チェックステータス）
・`bus_operation_status`: 'not_started', 'running', 'finished' （運行状況ステータス）

② users (ユーザープロファイル)
- id (uuid, PK, references auth.users(id) on delete cascade) ※Auth UIDと連動
- email (text, unique)
- full_name (text)
- role (user_role, default: 'parent')
- created_at (timestamptz, default: now())

③ bus_routes (バスルート)
- id (uuid, PK, default: gen_random_uuid())
- route_name (text)
- driver_id (uuid, FK -> users.id, on delete set null)

④ bus_stops (バス停マスター)
- id (uuid, PK, default: gen_random_uuid())
- bus_route_id (uuid, FK -> bus_routes.id, on delete cascade)
- stop_name (text)
- arrival_time_morning (time)
- order_index (integer)
- UNIQUE (bus_route_id, order_index) ※同ルート内の停車順序の重複防止

⑤ students (生徒情報)
- id (uuid, PK, default: gen_random_uuid())
- parent_id (uuid, FK -> users.id, on delete cascade)
- name (text)
- bus_route_id (uuid, FK -> bus_routes.id, on delete set null)
- default_bus_stop_id (uuid, FK -> bus_stops.id, on delete set null)
- default_morning_ride (boolean, default: true)
- default_afternoon_schedule_id (uuid, nullable)

⑥ ride_statuses (日々の乗降記録)
- id (uuid, PK, default: gen_random_uuid())
- date (date, default: current_date)
- student_id (uuid, FK -> students.id, on delete cascade)
- status (ride_status_enum, default: 'riding')
- updated_at (timestamptz, default: now())
- UNIQUE (date, student_id)

⑦ bus_operations (運行状況)
- id (uuid, PK, default: gen_random_uuid())
- bus_route_id (uuid, FK -> bus_routes.id, on delete cascade)
- date (date, default: current_date)
- status (bus_operation_status, default: 'not_started')
- delay_minutes (integer, default: 0)
- UNIQUE (date, bus_route_id)

⑧ bus_schedules (バス便マスター / 日別時刻表)
- id (uuid, PK, default: gen_random_uuid())
- date (date, unique)
- morning_time (time)
- afternoon_1_time (time)
- afternoon_2_time (time)
- afternoon_3_time (time)
- afternoon_4_time (time)
- afternoon_5_time (time)
- note (text)

⑨ reservations (予約テーブル)
- id (uuid, PK, default: gen_random_uuid())
- student_id (uuid, FK -> students.id, on delete cascade)
- date (date)
- morning_status (boolean, default: true)
- afternoon_schedule (text) ※"下校1便", "下校2便", or null
- note (text)
- updated_at (timestamptz, default: now())
- UNIQUE (student_id, date)


4.5 スプレッドシート同期データ構成 (Google Sheets Integration)

マスターファイル 「スクールバスマスター」 とアプリ（Supabase）間の相互同期仕様。

1. シート「生徒・保護者マスター」

A列: 保護者メールアドレス (Google ID認証用ホワイトリスト)

B列: 生徒名１

C列: 生徒名２ (兄弟姉妹最大5人)

D列: 生徒名３

E列: 生徒名４

F列: 生徒名５

G列: 利用バスルート (例: Aルート)

H列: 基本利用バス停 (例: 〇〇公園前)

I列: デフォルト登校便 (乗る / 乗らない)

J列: デフォルト下校便 (下校1便 / 下校2便 / 下校3便 / 下校4便 / 下校5便 / 乗らない)

2. シート「バス停マスタ」

A列: バス停名

B列: 到着予定時刻（登校便）

C列: 停車順序（登校便）

3. シート「運行予定カレンダー」 (保護者予約データの自動蓄積用)

A列: ID (通し番号)

B列: 日付 (YYYY-MM-DD)

C列: 生徒名

D列: 登校ステータス (”乗る” または 空白)

E列: 下校１便 (”乗る” または 空白)

F列: 下校２便 (”乗る” または 空白)

G列: 下校３便 (”乗る” または 空白)

H列: 下校４便 (”乗る” または 空白)

I列: 下校５便 (”乗る” または 空白)

J列: 備考

K列: 更新日時

L列: 保護者メールアドレス

4. シート「基本設定・運休期間」

A列: 設定名 (例: 夏休み)

B列: 開始日 (例: 2026/07/21)

C列: 終了日 (例: 2026/08/31)

D列: 標準運行 (”運休” または ”運行あり”)

E列: 内容・時刻 (”全便運休” など)

F列: 備考

5. シート「学校用時刻表」

A列: 日付 (YYYY/MM/DD)

B列: 登校便 (例: 07:30)

C列: 下校１便 (例: 15:00)

D列: 下校２便 (例: 16:00)

E列: 下校３便 (例: 17:00)

F列: 下校４便 (例: 18:00)

G列: 下校５便 (例: 18:30)

H列: 備考 (例: 5時間授業)

6. シート「ユーザー権限マスタ」

A列: メールアドレス

B列: 氏名 (例: 教頭、バス運転者1 など)

C列: 役割 (学校管理者 / ドライバー / 保護者)

※保護者がアプリ上で初回新規登録を行った際、このシートへ自動追加される。

5. 各画面の主要機能要件

A. 保護者向け画面 (Parent View)

新規登録・初回設定画面 (新規登録フロー)

初回ログイン時、未登録ユーザーの場合は新規登録画面を表示。

保護者氏名、生徒名（最大5名まで）、希望バス停を入力して保存。
※バスルートは学校全体で1ルートのみに固定され、アプリ画面上でのルート選択は不要（自動セット）とする。
※兄弟姉妹（生徒2名以降）を追加した際、1人目のお子様で選択したバス停が初期値として自動セットされる（個別に変更も可能）。

登録完了後、スプレッドシート「ユーザー権限マスタ」および「生徒・保護者マスター」に自動的に1行書き込み同期。


本日の運行ステータス表示

「運行前」「運行中」「到着済み」および遅延情報（例: 10分遅れ）のリアルタイム表示。

基本パターン事前登録＆月末1ヶ月分一括自動予約

基本パターンの登録:

「登校便：乗る / 乗らない」

「下校便：下校1便 / 下校2便 / 下校3便 / 下校4便 / 下校5便 / 乗らない」

毎月末の一括予約（入力の手間削減）:

カレンダーを開いた時点で基本パターンに基づき次月1ヶ月分が自動入力される。

習い事や通院などで予定が変わる特定の日付のみをタップして「下校2便→下校3便」等に変更・保存する。

確定した予約データはスプレッドシートの「運行予定カレンダー」シートに自動蓄積。

バス停の自動セット: 初回登録・学校側で決定された基本バス停が自動紐付けされ毎回の選択不要。

急なキャンセル制限: 当日の急なキャンセルは当日朝7:00までアプリ上で受付（7時以降は変更不可）。

B. バス運転者向け画面 (Driver View)

ワンタップ運行管理

「運行開始」「運行終了」ボタン。

バス停別・生徒乗車名簿リスト

担当便の停車ルート順に「どのバス停で・誰が乗車（または降車）するか」を一覧表示。

バス停ごとの乗車完了チェックボタンを配置し、保護者へステータスをリアルタイム反映。

遅延報告ボタン

「+5分」「+10分」などのボタンでワンタップで全保護者に遅延通知。

C. 学校管理者向け画面 (Admin View)

全体運行モニター

運行中の全バスの遅延状況・乗車完了率・予約埋まり具合を一覧表示。

バス停・バス便マスターの事前登録

登校便（1便）および下校便（最大5便）、各ルートのバス停・停車順を事前設定。

日別・便別・バス停別 乗車予約詳細確認機能

指定した日付・バス便・バス停の乗車予定生徒を一覧確認できるダッシュボード。

スプレッドシート「スクールバスマスター」同期管理

ボタン1タップでスプレッドシート全シートとの双方向同期を実行。

6. セキュリティ・認証仕様

事前許可リスト (ホワイトリスト) 制限

スプレッドシート「ユーザー権限マスタ」または「生徒・保護者マスター」に登録されたメールアドレスのみアクセスを認める。

Row Level Security (RLS) の適用

SupabaseのRLSポリシーにより、データへのアクセス制限を厳格に制御します。詳細は [schema.sql](file:///C:/Users/yagij/Desktop/野口/仕事/哲司/アプリ/スクールバス/school-bus-app/supabase/schema.sql) に定義されています。
・users: 自身のプロファイルのみ編集可能。全プロファイルは認証済みユーザー全員が参照可能。
・students: 保護者は自身の子ども（parent_id = auth.uid()）のみ参照・追加・更新可能。運転手・管理者は全員の参照が可能。
・reservations / ride_statuses: 保護者は自身の子どもに紐づく予約・乗車ログのみ参照・更新可能。運転手・管理者は全員分の参照・更新が可能。
・bus_operations: 全員が参照可能。更新は運転手・管理者のみ許可。

7. 開発・実行指示 (Antigravity向けガイドライン)

コード変更を行う際は、型安全性（TypeScript）を保持すること。

コンポーネントは Tailwind CSS でレスポンシブデザイン（スマホ最適化）に仕上げること。

当日朝7:00のキャンセル制限ロジックおよび基本パターンの1ヶ月一括展開ロジックを正確に実装すること。

スプレッドシート連携（Google Sheets API）による「運行予定カレンダー」への自動追加・「ユーザー権限マスタ」への新規保護者書き込み処理を実装すること。

.env には VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, および Google API 関連の認証情報を保持すること。

8. 実装詳細 & コンポーネント構成（実績仕様）

① グローバル状態管理 (AuthContext.tsx)
・認証情報と連動し、本日の運行情報（busOperations）、全予約データ（reservations）、本日の乗降ステータス（rideStatuses）をグローバルで状態管理。
・開発用デモモードおよび本番Supabase接続モードの双方をサポートし、以下の共通データ操作メソッドを各画面に提供。
  - saveReservation(): 個別日付の予約作成・更新
  - generateNextMonthReservations(): 翌月平日の基本パターン一括自動予約生成
  - updateOperation(): 運転手による運行状況（運行前/運行中/到着済）、遅延時間の更新
  - updateStudentRideStatus(): 各バス停での乗車・欠席チェック更新

② 保護者向け1ヶ月予約 ＆ カレンダー機能 (Dashboard.tsx - Parent)
・月別カレンダー表示：カスタムグリッドにより、各日付の登下校の予約状態（乗車／運休／選択便）をカラーバッジで一覧表示。土日は入力不可（運休固定）。
・一括予約：基本パターン（登校：乗る/乗らない、下校：1〜5便/乗らない）を設定し、翌月の平日（土日を除く）に一括自動展開。
・個別変更と朝7時制限：日付クリックで個別変更ダイアログを表示。対象日が「当日」であり、現在時刻が「朝7:00以降」の場合は、編集をブロック（保存不可とし警告を表示）。

③ 運転手向け運行・名簿管理機能 (Dashboard.tsx - Driver)
・運行状況コントロール：「運行開始」「運行終了」ボタンで運行ステータスを制御。運行中は「定刻」「+5分」「+10分」等の遅延時間をワンタップで即時保護者画面へ反映。
・停車順乗車名簿：バス停マスタの停車順（order_index）に沿ってタイムライン表示。各バス停をアコーディオン展開し、その日の予約（登校・下校）が入っている生徒を名簿表示。
・乗車・欠席チェック：生徒ごとに「乗車完了」「欠席」ボタンを配置し、タップ時に ride_statuses を即座に更新・反映。
