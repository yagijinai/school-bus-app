-- ==============================================================================
-- スクールバス運行管理システム：本番用 Row Level Security (RLS) & Realtime 設定
-- 
-- 【適用方法】
-- Supabaseダッシュボードの左メニュー「SQL Editor」を開き、
-- 本スクリプトの全文を貼り付けて「RUN」を実行してください。
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RLSの有効化 (Row Level Security Enable)
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bus_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bus_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.monthly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bus_operations ENABLE ROW LEVEL SECURITY;

-- 互換テーブルが存在する場合のRLS有効化
ALTER TABLE IF EXISTS public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.special_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ride_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.boarding_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.service_delays ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. 既存ポリシーのクリーンアップ（冪等性の確保）
-- ------------------------------------------------------------------------------
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 3. RLSポリシー定義
-- （※ anon [公開キー] および authenticated [ログインユーザー] の双方から
--   アプリケーションの予約・点呼・遅延連絡・マスタ参照を円滑に行えるポリシー）
-- ------------------------------------------------------------------------------

-- ① users テーブル
CREATE POLICY "users_select_all" ON public.users 
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "users_insert_all" ON public.users 
    FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "users_update_all" ON public.users 
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "users_delete_all" ON public.users 
    FOR DELETE TO anon, authenticated USING (true);

-- ② bus_routes テーブル
CREATE POLICY "bus_routes_select_all" ON public.bus_routes 
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "bus_routes_insert_all" ON public.bus_routes 
    FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "bus_routes_update_all" ON public.bus_routes 
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "bus_routes_delete_all" ON public.bus_routes 
    FOR DELETE TO anon, authenticated USING (true);

-- ③ bus_stops テーブル
CREATE POLICY "bus_stops_select_all" ON public.bus_stops 
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "bus_stops_insert_all" ON public.bus_stops 
    FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "bus_stops_update_all" ON public.bus_stops 
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "bus_stops_delete_all" ON public.bus_stops 
    FOR DELETE TO anon, authenticated USING (true);

-- ④ 生徒マスタ (students)
CREATE POLICY "students_select_all" ON public.students 
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "students_insert_all" ON public.students 
    FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "students_update_all" ON public.students 
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "students_delete_all" ON public.students 
    FOR DELETE TO anon, authenticated USING (true);

-- ⑤ 月別ダイヤ (monthly_schedules)
CREATE POLICY "monthly_schedules_select_all" ON public.monthly_schedules 
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "monthly_schedules_insert_all" ON public.monthly_schedules 
    FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "monthly_schedules_update_all" ON public.monthly_schedules 
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "monthly_schedules_delete_all" ON public.monthly_schedules 
    FOR DELETE TO anon, authenticated USING (true);

-- ⑥ 運行カレンダー・特別日課 (calendar_events)
CREATE POLICY "calendar_events_select_all" ON public.calendar_events 
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "calendar_events_insert_all" ON public.calendar_events 
    FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "calendar_events_update_all" ON public.calendar_events 
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "calendar_events_delete_all" ON public.calendar_events 
    FOR DELETE TO anon, authenticated USING (true);

-- ⑦ 日別予約・乗車点呼ログ (daily_reservations)
CREATE POLICY "daily_reservations_select_all" ON public.daily_reservations 
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "daily_reservations_insert_all" ON public.daily_reservations 
    FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "daily_reservations_update_all" ON public.daily_reservations 
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "daily_reservations_delete_all" ON public.daily_reservations 
    FOR DELETE TO anon, authenticated USING (true);

-- ⑧ 運行状況・遅延連絡 (bus_operations)
CREATE POLICY "bus_operations_select_all" ON public.bus_operations 
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "bus_operations_insert_all" ON public.bus_operations 
    FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "bus_operations_update_all" ON public.bus_operations 
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "bus_operations_delete_all" ON public.bus_operations 
    FOR DELETE TO anon, authenticated USING (true);

-- ------------------------------------------------------------------------------
-- 4. 互換テーブル用ポリシー（実テーブルとして作成されている場合のフォールバック）
-- ------------------------------------------------------------------------------
DO $$ 
BEGIN
    -- reservations テーブルが存在する場合
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reservations') THEN
        EXECUTE 'CREATE POLICY reservations_select_all ON public.reservations FOR SELECT TO anon, authenticated USING (true)';
        EXECUTE 'CREATE POLICY reservations_insert_all ON public.reservations FOR INSERT TO anon, authenticated WITH CHECK (true)';
        EXECUTE 'CREATE POLICY reservations_update_all ON public.reservations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
        EXECUTE 'CREATE POLICY reservations_delete_all ON public.reservations FOR DELETE TO anon, authenticated USING (true)';
    END IF;

    -- special_schedules テーブルが存在する場合
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'special_schedules') THEN
        EXECUTE 'CREATE POLICY special_schedules_select_all ON public.special_schedules FOR SELECT TO anon, authenticated USING (true)';
        EXECUTE 'CREATE POLICY special_schedules_insert_all ON public.special_schedules FOR INSERT TO anon, authenticated WITH CHECK (true)';
        EXECUTE 'CREATE POLICY special_schedules_update_all ON public.special_schedules FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
        EXECUTE 'CREATE POLICY special_schedules_delete_all ON public.special_schedules FOR DELETE TO anon, authenticated USING (true)';
    END IF;

    -- ride_statuses テーブルが存在する場合
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ride_statuses') THEN
        EXECUTE 'CREATE POLICY ride_statuses_select_all ON public.ride_statuses FOR SELECT TO anon, authenticated USING (true)';
        EXECUTE 'CREATE POLICY ride_statuses_insert_all ON public.ride_statuses FOR INSERT TO anon, authenticated WITH CHECK (true)';
        EXECUTE 'CREATE POLICY ride_statuses_update_all ON public.ride_statuses FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
        EXECUTE 'CREATE POLICY ride_statuses_delete_all ON public.ride_statuses FOR DELETE TO anon, authenticated USING (true)';
    END IF;

    -- boarding_logs テーブルが存在する場合
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'boarding_logs') THEN
        EXECUTE 'CREATE POLICY boarding_logs_select_all ON public.boarding_logs FOR SELECT TO anon, authenticated USING (true)';
        EXECUTE 'CREATE POLICY boarding_logs_insert_all ON public.boarding_logs FOR INSERT TO anon, authenticated WITH CHECK (true)';
        EXECUTE 'CREATE POLICY boarding_logs_update_all ON public.boarding_logs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
        EXECUTE 'CREATE POLICY boarding_logs_delete_all ON public.boarding_logs FOR DELETE TO anon, authenticated USING (true)';
    END IF;

    -- service_delays テーブルが存在する場合 (VIEWではなく物理テーブルの場合)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_delays') THEN
        EXECUTE 'CREATE POLICY service_delays_select_all ON public.service_delays FOR SELECT TO anon, authenticated USING (true)';
        EXECUTE 'CREATE POLICY service_delays_insert_all ON public.service_delays FOR INSERT TO anon, authenticated WITH CHECK (true)';
        EXECUTE 'CREATE POLICY service_delays_update_all ON public.service_delays FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
        EXECUTE 'CREATE POLICY service_delays_delete_all ON public.service_delays FOR DELETE TO anon, authenticated USING (true)';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. リアルタイム (Supabase Realtime) パブリケーション設定
-- ------------------------------------------------------------------------------
-- レプリカアイデンティティの設定（変更前後のレコードをリアルタイム通知で正しく取得可能にする）
ALTER TABLE IF EXISTS public.bus_operations REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.daily_reservations REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.calendar_events REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.monthly_schedules REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.students REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.bus_routes REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.bus_stops REPLICA IDENTITY FULL;

-- 互換テーブル用
ALTER TABLE IF EXISTS public.reservations REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.ride_statuses REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.boarding_logs REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.service_delays REPLICA IDENTITY FULL;

-- supabase_realtime パブリケーションへの安全な追加
DO $$ 
DECLARE
    tbl TEXT;
    target_tables TEXT[] := ARRAY[
        'bus_operations', 
        'daily_reservations', 
        'calendar_events', 
        'monthly_schedules', 
        'students', 
        'bus_routes', 
        'bus_stops',
        'reservations',
        'ride_statuses',
        'boarding_logs',
        'service_delays'
    ];
BEGIN
    -- supabase_realtime publicationが存在することを確認
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        FOREACH tbl IN ARRAY target_tables
        LOOP
            IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
                -- すでにパブリケーションに追加されていない場合のみ追加
                IF NOT EXISTS (
                    SELECT 1 
                    FROM pg_publication_tables 
                    WHERE pubname = 'supabase_realtime' 
                      AND schemaname = 'public' 
                      AND tablename = tbl
                ) THEN
                    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
                END IF;
            END IF;
        END LOOP;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 完了メッセージ
-- ------------------------------------------------------------------------------
COMMENT ON SCHEMA public IS 'スクールバス運行管理システム：RLSおよびRealtime設定完了';
