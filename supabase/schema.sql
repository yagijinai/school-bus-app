-- ==============================================================================
-- スクールバス運行管理システム：Supabase（PostgreSQL）データベーススキーマ
-- ==============================================================================

-- 1. 拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. 共通トリガー関数（更新日時の自動更新）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Enum 型の定義
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('parent', 'driver', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE trip_type AS ENUM ('登校便', '下校1便', '下校2便', '下校3便', '下校4便', '下校5便');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE operation_status AS ENUM ('not_started', 'running', 'finished');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE calendar_category AS ENUM ('holiday', 'closed', 'temporary', 'special');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 4. テーブル作成

-- ① ユーザープロファイル (users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'parent',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ② バスルートマスタ (bus_routes)
CREATE TABLE IF NOT EXISTS public.bus_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_name TEXT NOT NULL,
    driver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ③ バス停マスタ (bus_stops)
CREATE TABLE IF NOT EXISTS public.bus_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bus_route_id UUID NOT NULL REFERENCES public.bus_routes(id) ON DELETE CASCADE,
    stop_name TEXT NOT NULL,
    arrival_time_morning TIME,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (bus_route_id, order_index)
);

-- ④ 生徒マスタ (students)
-- 要件: 生徒ID, 照合キー, 氏名, 学年, 世帯ID, バス停名
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_code TEXT UNIQUE NOT NULL,                       -- 生徒ID（例: STU-001）
    verification_code TEXT NOT NULL,                         -- 照合キー/初期パスコード（例: PASS001）
    name TEXT NOT NULL,                                      -- 氏名
    grade TEXT NOT NULL,                                     -- 学年（例: "1年生", "2年生"）
    class_name TEXT,                                         -- 組（例: "1組", "2組"）
    parent_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- 保護者Auth ID
    household_id TEXT,                                       -- 世帯ID（保護者照合グループ）
    bus_route_id UUID REFERENCES public.bus_routes(id) ON DELETE SET NULL,
    default_bus_stop_id UUID REFERENCES public.bus_stops(id) ON DELETE SET NULL,
    bus_stop_name TEXT,                                      -- バス停名（表示用キャッシュ/直接指定）
    default_morning_ride BOOLEAN NOT NULL DEFAULT TRUE,      -- 登校デフォルト乗車
    default_afternoon_schedule TEXT DEFAULT '下校1便',       -- 下校デフォルト便
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ⑤ 月別ダイヤ (monthly_schedules)
-- 要件: 月, 1〜5便の時刻/運休
CREATE TABLE IF NOT EXISTS public.monthly_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12) UNIQUE, -- 対象月 (1〜12)
    shortened_day_of_week INTEGER CHECK (shortened_day_of_week BETWEEN 1 AND 5), -- 短縮日課曜日 (1:月〜5:金)
    morning_trip_time TIME NOT NULL DEFAULT '07:30:00',          -- 登校便 出発時刻
    trip_1_time TIME,                                            -- 下校1便 時刻 (NULLは運休)
    trip_2_time TIME,                                            -- 下校2便 時刻 (NULLは運休)
    trip_3_time TIME,                                            -- 下校3便 時刻 (NULLは運休)
    trip_4_time TIME,                                            -- 下校4便 時刻 (NULLは運休)
    trip_5_time TIME,                                            -- 下校5便 時刻 (NULLは運休)
    wed_trip_1_time TIME,                                        -- 水曜/短縮日 下校1便
    wed_trip_2_time TIME,                                        -- 水曜/短縮日 下校2便
    wed_trip_3_time TIME,                                        -- 水曜/短縮日 下校3便
    wed_trip_4_time TIME,                                        -- 水曜/短縮日 下校4便
    wed_trip_5_time TIME,                                        -- 水曜/短縮日 下校5便
    note TEXT,                                                   -- 備考・ダイヤ名
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ⑥ 運行カレンダー・特別日 (calendar_events)
-- 要件: 日付, 区分[長期休業/閉庁日/臨時運行/特別行事], 行事名, 運行フラグ, 登校時刻
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,                                   -- 対象日付
    category calendar_category NOT NULL DEFAULT 'special',       -- 区分 (holiday:長期休業, closed:閉庁日, temporary:臨時運行, special:特別日課)
    event_name TEXT NOT NULL,                                    -- 行事名/休業名
    is_operating BOOLEAN NOT NULL DEFAULT TRUE,                  -- 運行フラグ (TRUE:運行, FALSE:運休)
    is_temporary_operation BOOLEAN NOT NULL DEFAULT FALSE,       -- 休日等の臨時運行フラグ
    is_all_day_suspended BOOLEAN NOT NULL DEFAULT FALSE,         -- 終日運休フラグ
    is_morning_suspended BOOLEAN NOT NULL DEFAULT FALSE,         -- 登校便運休フラグ
    is_afternoon_suspended BOOLEAN NOT NULL DEFAULT FALSE,       -- 下校便運休フラグ
    morning_trip_time TIME,                                      -- 登校時刻（NULL時は通常ダイヤ）
    trip_1_time TIME,                                            -- 特別 下校1便
    trip_2_time TIME,                                            -- 特別 下校2便
    trip_3_time TIME,                                            -- 特別 下校3便
    trip_4_time TIME,                                            -- 特別 下校4便
    trip_5_time TIME,                                            -- 特別 下校5便
    note TEXT,                                                   -- 備考
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ⑦ 日別予約・乗車実績 (daily_reservations)
-- 要件: 日付, 生徒ID, 登校乗車フラグ, 下校便選択, 登校乗車済, 下校乗車済
CREATE TABLE IF NOT EXISTS public.daily_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,                                          -- 対象運行日
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    morning_ride BOOLEAN NOT NULL DEFAULT TRUE,                  -- 登校乗車フラグ (TRUE:乗車, FALSE:欠席/不乗車)
    afternoon_trip TEXT,                                         -- 下校便選択 (例: '下校1便', '下校2便', '利用なし', '運休')
    morning_boarded BOOLEAN NOT NULL DEFAULT FALSE,              -- 登校乗車済フラグ（実績）
    afternoon_boarded BOOLEAN NOT NULL DEFAULT FALSE,            -- 下校乗車済フラグ（実績）
    note TEXT,                                                   -- 連絡事項・備考
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (date, student_id)
);

-- ⑧ 運行遅延・ステータス状況 (bus_operations / service_delays)
-- 要件: 運行日, 便種別, バスID, 遅延分数, 運行状態, 連絡メッセージ, 更新日時
CREATE TABLE IF NOT EXISTS public.bus_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,                     -- 運行日 (operation_date互換)
    operation_date DATE GENERATED ALWAYS AS (date) STORED,       -- エイリアスカラム
    bus_route_id UUID REFERENCES public.bus_routes(id) ON DELETE CASCADE,
    bus_id TEXT DEFAULT 'bus_1',                                 -- バス識別子
    trip_name TEXT NOT NULL,                                     -- 便種別 (例: '登校便', '下校1便' 等)
    trip_type TEXT GENERATED ALWAYS AS (trip_name) STORED,       -- エイリアスカラム
    delay_minutes INTEGER NOT NULL DEFAULT 0,                    -- 遅延分数 (0:定刻, 正の値:遅延分数)
    status TEXT NOT NULL DEFAULT 'on_time',                      -- 運行状態 ('on_time', 'delayed', 'arrived', 'suspended', 'running', 'finished')
    message TEXT,                                                -- ドライバーからのメッセージ/遅延理由
    note TEXT,                                                   -- 連絡メモ
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (date, trip_name)
);

-- 5. 後方互換性用ビュー（旧テーブル名・ビュー参照の互換性確保）
CREATE OR REPLACE VIEW public.monthly_trip_schedules AS SELECT * FROM public.monthly_schedules;
CREATE OR REPLACE VIEW public.special_trip_schedules AS 
SELECT 
    id, date, is_temporary_operation, is_all_day_suspended, is_morning_suspended, 
    is_afternoon_suspended, morning_trip_time, trip_1_time, trip_2_time, trip_3_time, 
    trip_4_time, trip_5_time, note, created_at, updated_at 
FROM public.calendar_events;
CREATE OR REPLACE VIEW public.reservations AS 
SELECT 
    id, student_id, date, morning_ride AS morning_status, afternoon_trip AS afternoon_schedule, 
    note, updated_at 
FROM public.daily_reservations;
CREATE OR REPLACE VIEW public.service_delays AS 
SELECT 
    id, date, bus_route_id, trip_name, delay_minutes, status, message, updated_at, created_at
FROM public.bus_operations;

-- 6. 更新トリガーの設定
DROP TRIGGER IF EXISTS tr_users_updated_at ON public.users;
CREATE TRIGGER tr_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_students_updated_at ON public.students;
CREATE TRIGGER tr_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_monthly_schedules_updated_at ON public.monthly_schedules;
CREATE TRIGGER tr_monthly_schedules_updated_at BEFORE UPDATE ON public.monthly_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_calendar_events_updated_at ON public.calendar_events;
CREATE TRIGGER tr_calendar_events_updated_at BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_daily_reservations_updated_at ON public.daily_reservations;
CREATE TRIGGER tr_daily_reservations_updated_at BEFORE UPDATE ON public.daily_reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_service_delays_updated_at ON public.service_delays;
CREATE TRIGGER tr_service_delays_updated_at BEFORE UPDATE ON public.service_delays FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. インデックスの作成
CREATE INDEX IF NOT EXISTS idx_students_student_code ON public.students(student_code);
CREATE INDEX IF NOT EXISTS idx_students_parent_id ON public.students(parent_id);
CREATE INDEX IF NOT EXISTS idx_students_household_id ON public.students(household_id);
CREATE INDEX IF NOT EXISTS idx_daily_reservations_date ON public.daily_reservations(date);
CREATE INDEX IF NOT EXISTS idx_daily_reservations_student_id ON public.daily_reservations(student_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON public.calendar_events(date);
CREATE INDEX IF NOT EXISTS idx_service_delays_date ON public.service_delays(date);

-- 8. Row Level Security (RLS) 設定

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_delays ENABLE ROW LEVEL SECURITY;

-- 9. RLS ポリシー定義

-- users
CREATE POLICY "users_select_authenticated" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_insert_own" ON public.users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id);

-- bus_routes & bus_stops
CREATE POLICY "bus_routes_read" ON public.bus_routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "bus_routes_admin_all" ON public.bus_routes FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "bus_stops_read" ON public.bus_stops FOR SELECT TO authenticated USING (true);
CREATE POLICY "bus_stops_admin_all" ON public.bus_stops FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- students
CREATE POLICY "students_read" ON public.students FOR SELECT TO authenticated USING (
    parent_id = auth.uid() OR
    parent_id IS NULL OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('driver', 'admin'))
);
CREATE POLICY "students_admin_all" ON public.students FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "students_parent_update_own" ON public.students FOR UPDATE TO authenticated USING (
    parent_id = auth.uid() OR parent_id IS NULL
) WITH CHECK (
    parent_id = auth.uid()
);

-- monthly_schedules
CREATE POLICY "monthly_schedules_read" ON public.monthly_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "monthly_schedules_admin_all" ON public.monthly_schedules FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- calendar_events
CREATE POLICY "calendar_events_read" ON public.calendar_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "calendar_events_admin_all" ON public.calendar_events FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- daily_reservations
CREATE POLICY "daily_reservations_read" ON public.daily_reservations FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.students WHERE id = student_id AND parent_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('driver', 'admin'))
);
CREATE POLICY "daily_reservations_parent_upsert" ON public.daily_reservations FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.students WHERE id = student_id AND parent_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('driver', 'admin'))
);

-- service_delays
CREATE POLICY "service_delays_read" ON public.service_delays FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_delays_staff_modify" ON public.service_delays FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('driver', 'admin'))
);
