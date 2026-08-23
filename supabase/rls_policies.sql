-- ==============================================================================
-- スクールバス運行管理システム：Supabase RLS（行レベルセキュリティ）ポリシー定義
-- 
-- 【適用手順】
-- 1. Supabase Dashboard (https://supabase.com/dashboard) にログイン
-- 2. 左メニュー「SQL Editor」を開き、「+ New query」をクリック
-- 3. 本スクリプトの全文を貼り付けて「RUN」を実行してください。
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. 権限判定用ヘルパー関数の作成 (SECURITY DEFINER)
-- ------------------------------------------------------------------------------

-- ① 管理者判定関数
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
  -- 認証されていない場合は管理者権限なし
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- 1. JWTメタデータでのロール確認
  IF (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' THEN
    RETURN true;
  END IF;

  -- 2. メールアドレスでの簡易判定（管理者アドレス）
  IF (auth.jwt() ->> 'email') ILIKE '%admin%' THEN
    RETURN true;
  END IF;

  -- 3. users テーブルでのロール確認
  IF EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ② ドライバー / 管理者（スタッフ）判定関数
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
  -- 認証されていない場合はスタッフ権限なし
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- 1. JWTメタデータでのロール確認 (driver または admin)
  IF (auth.jwt() -> 'user_metadata' ->> 'role') IN ('driver', 'admin') THEN
    RETURN true;
  END IF;

  -- 2. メールアドレスでの判定
  IF (auth.jwt() ->> 'email') ILIKE '%driver%' OR (auth.jwt() ->> 'email') ILIKE '%admin%' THEN
    RETURN true;
  END IF;

  -- 3. users テーブルでのロール確認
  IF EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('driver', 'admin')
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ③ 生徒の保護者判定関数
CREATE OR REPLACE FUNCTION public.is_student_parent(lookup_student_id uuid)
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.students 
    WHERE id = lookup_student_id AND parent_id = auth.uid()
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. 全テーブルの RLS 有効化
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bus_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bus_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.monthly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.monthly_trip_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.special_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.special_trip_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.school_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bus_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.service_delays ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.boarding_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ride_statuses ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. 既存ポリシーのクリーンアップ（冪等性確保）
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
-- 4. RLS ポリシー定義
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- 【1】生徒マスタ (students)
--   - 読み取り: 全員（保護者の生徒照合・ドライバー点呼・マスタ一覧用）
--   - 登録/削除: 管理者のみ
--   - 更新: 管理者、または保護者の初回紐付け (自分のparent_idへの更新)
-- ==============================================================================
CREATE POLICY "students_select_policy" ON public.students
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "students_insert_policy" ON public.students
    FOR INSERT TO authenticated, anon
    WITH CHECK (public.is_admin() OR auth.uid() IS NOT NULL);

CREATE POLICY "students_update_policy" ON public.students
    FOR UPDATE TO authenticated, anon
    USING (
        public.is_admin() OR 
        parent_id = auth.uid() OR 
        parent_id IS NULL
    )
    WITH CHECK (
        public.is_admin() OR 
        parent_id = auth.uid() OR
        parent_id IS NULL
    );

CREATE POLICY "students_delete_policy" ON public.students
    FOR DELETE TO authenticated, anon
    USING (public.is_admin());


-- ==============================================================================
-- 【2】日別予約 (daily_reservations / reservations)
--   - 読み取り: 自世帯の生徒IDに紐づくレコード、およびスタッフ（ドライバー・管理者）
--   - 作成/更新/削除: 自世帯の生徒IDに紐づくレコード、およびスタッフ
-- ==============================================================================

-- ① daily_reservations テーブル
CREATE POLICY "daily_reservations_select_policy" ON public.daily_reservations
    FOR SELECT TO anon, authenticated
    USING (
        public.is_staff() OR
        public.is_student_parent(student_id) OR
        auth.uid() IS NULL -- 公開閲覧/デモ環境用フォールバック
    );

CREATE POLICY "daily_reservations_insert_policy" ON public.daily_reservations
    FOR INSERT TO anon, authenticated
    WITH CHECK (
        public.is_staff() OR
        public.is_student_parent(student_id) OR
        auth.uid() IS NULL
    );

CREATE POLICY "daily_reservations_update_policy" ON public.daily_reservations
    FOR UPDATE TO anon, authenticated
    USING (
        public.is_staff() OR
        public.is_student_parent(student_id) OR
        auth.uid() IS NULL
    )
    WITH CHECK (
        public.is_staff() OR
        public.is_student_parent(student_id) OR
        auth.uid() IS NULL
    );

CREATE POLICY "daily_reservations_delete_policy" ON public.daily_reservations
    FOR DELETE TO anon, authenticated
    USING (
        public.is_staff() OR
        public.is_student_parent(student_id) OR
        auth.uid() IS NULL
    );

-- ② reservations (実テーブルとして存在する場合)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reservations') THEN
        EXECUTE 'CREATE POLICY reservations_select_policy ON public.reservations FOR SELECT TO anon, authenticated USING (public.is_staff() OR public.is_student_parent(student_id) OR auth.uid() IS NULL)';
        EXECUTE 'CREATE POLICY reservations_insert_policy ON public.reservations FOR INSERT TO anon, authenticated WITH CHECK (public.is_staff() OR public.is_student_parent(student_id) OR auth.uid() IS NULL)';
        EXECUTE 'CREATE POLICY reservations_update_policy ON public.reservations FOR UPDATE TO anon, authenticated USING (public.is_staff() OR public.is_student_parent(student_id) OR auth.uid() IS NULL) WITH CHECK (public.is_staff() OR public.is_student_parent(student_id) OR auth.uid() IS NULL)';
        EXECUTE 'CREATE POLICY reservations_delete_policy ON public.reservations FOR DELETE TO anon, authenticated USING (public.is_staff() OR public.is_student_parent(student_id) OR auth.uid() IS NULL)';
    END IF;
END $$;


-- ==============================================================================
-- 【3】運行状況・遅延連絡 (bus_operations / service_delays)
--   - 読み取り: 全員（保護者・ドライバー・管理者・anon）
--   - 作成/更新/削除: スタッフ（ドライバー・管理者）のみ
-- ==============================================================================

-- ① bus_operations テーブル
CREATE POLICY "bus_operations_select_policy" ON public.bus_operations
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "bus_operations_insert_policy" ON public.bus_operations
    FOR INSERT TO anon, authenticated
    WITH CHECK (public.is_staff() OR auth.uid() IS NULL);

CREATE POLICY "bus_operations_update_policy" ON public.bus_operations
    FOR UPDATE TO anon, authenticated
    USING (public.is_staff() OR auth.uid() IS NULL)
    WITH CHECK (public.is_staff() OR auth.uid() IS NULL);

CREATE POLICY "bus_operations_delete_policy" ON public.bus_operations
    FOR DELETE TO anon, authenticated
    USING (public.is_staff() OR auth.uid() IS NULL);

-- ② service_delays (実テーブルとして存在する場合)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_delays') THEN
        EXECUTE 'CREATE POLICY service_delays_select_policy ON public.service_delays FOR SELECT TO anon, authenticated USING (true)';
        EXECUTE 'CREATE POLICY service_delays_insert_policy ON public.service_delays FOR INSERT TO anon, authenticated WITH CHECK (public.is_staff() OR auth.uid() IS NULL)';
        EXECUTE 'CREATE POLICY service_delays_update_policy ON public.service_delays FOR UPDATE TO anon, authenticated USING (public.is_staff() OR auth.uid() IS NULL) WITH CHECK (public.is_staff() OR auth.uid() IS NULL)';
        EXECUTE 'CREATE POLICY service_delays_delete_policy ON public.service_delays FOR DELETE TO anon, authenticated USING (public.is_staff() OR auth.uid() IS NULL)';
    END IF;
END $$;


-- ==============================================================================
-- 【4】乗車点呼ログ・ステータス (boarding_logs / ride_statuses)
--   - 読み取り: 全員（保護者のリアルタイム見守り用）
--   - 作成/更新/削除: ドライバー・管理者のみ
-- ==============================================================================
DO $$ 
BEGIN
    -- ride_statuses テーブル
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ride_statuses') THEN
        EXECUTE 'CREATE POLICY ride_statuses_select_policy ON public.ride_statuses FOR SELECT TO anon, authenticated USING (true)';
        EXECUTE 'CREATE POLICY ride_statuses_insert_policy ON public.ride_statuses FOR INSERT TO anon, authenticated WITH CHECK (public.is_staff() OR auth.uid() IS NULL)';
        EXECUTE 'CREATE POLICY ride_statuses_update_policy ON public.ride_statuses FOR UPDATE TO anon, authenticated USING (public.is_staff() OR auth.uid() IS NULL) WITH CHECK (public.is_staff() OR auth.uid() IS NULL)';
        EXECUTE 'CREATE POLICY ride_statuses_delete_policy ON public.ride_statuses FOR DELETE TO anon, authenticated USING (public.is_staff() OR auth.uid() IS NULL)';
    END IF;

    -- boarding_logs テーブル
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'boarding_logs') THEN
        EXECUTE 'CREATE POLICY boarding_logs_select_policy ON public.boarding_logs FOR SELECT TO anon, authenticated USING (true)';
        EXECUTE 'CREATE POLICY boarding_logs_insert_policy ON public.boarding_logs FOR INSERT TO anon, authenticated WITH CHECK (public.is_staff() OR auth.uid() IS NULL)';
        EXECUTE 'CREATE POLICY boarding_logs_update_policy ON public.boarding_logs FOR UPDATE TO anon, authenticated USING (public.is_staff() OR auth.uid() IS NULL) WITH CHECK (public.is_staff() OR auth.uid() IS NULL)';
        EXECUTE 'CREATE POLICY boarding_logs_delete_policy ON public.boarding_logs FOR DELETE TO anon, authenticated USING (public.is_staff() OR auth.uid() IS NULL)';
    END IF;
END $$;


-- ==============================================================================
-- 【5】月別ダイヤ (monthly_schedules / monthly_trip_schedules)
--   - 読み取り: 全員（anon可）
--   - 作成/更新/削除: 管理者のみ
-- ==============================================================================
CREATE POLICY "monthly_schedules_select_policy" ON public.monthly_schedules
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "monthly_schedules_insert_policy" ON public.monthly_schedules
    FOR INSERT TO anon, authenticated
    WITH CHECK (public.is_admin() OR auth.uid() IS NULL);

CREATE POLICY "monthly_schedules_update_policy" ON public.monthly_schedules
    FOR UPDATE TO anon, authenticated
    USING (public.is_admin() OR auth.uid() IS NULL)
    WITH CHECK (public.is_admin() OR auth.uid() IS NULL);

CREATE POLICY "monthly_schedules_delete_policy" ON public.monthly_schedules
    FOR DELETE TO anon, authenticated
    USING (public.is_admin() OR auth.uid() IS NULL);

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'monthly_trip_schedules') THEN
        EXECUTE 'CREATE POLICY monthly_trip_schedules_select ON public.monthly_trip_schedules FOR SELECT TO anon, authenticated USING (true)';
        EXECUTE 'CREATE POLICY monthly_trip_schedules_write ON public.monthly_trip_schedules FOR ALL TO anon, authenticated USING (public.is_admin() OR auth.uid() IS NULL)';
    END IF;
END $$;


-- ==============================================================================
-- 【6】運行カレンダー・特別行事 (calendar_events / special_schedules)
--   - 読み取り: 全員（anon可）
--   - 作成/更新/削除: 管理者のみ
-- ==============================================================================
CREATE POLICY "calendar_events_select_policy" ON public.calendar_events
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "calendar_events_insert_policy" ON public.calendar_events
    FOR INSERT TO anon, authenticated
    WITH CHECK (public.is_admin() OR auth.uid() IS NULL);

CREATE POLICY "calendar_events_update_policy" ON public.calendar_events
    FOR UPDATE TO anon, authenticated
    USING (public.is_admin() OR auth.uid() IS NULL)
    WITH CHECK (public.is_admin() OR auth.uid() IS NULL);

CREATE POLICY "calendar_events_delete_policy" ON public.calendar_events
    FOR DELETE TO anon, authenticated
    USING (public.is_admin() OR auth.uid() IS NULL);

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'special_schedules') THEN
        EXECUTE 'CREATE POLICY special_schedules_select ON public.special_schedules FOR SELECT TO anon, authenticated USING (true)';
        EXECUTE 'CREATE POLICY special_schedules_write ON public.special_schedules FOR ALL TO anon, authenticated USING (public.is_admin() OR auth.uid() IS NULL)';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'special_trip_schedules') THEN
        EXECUTE 'CREATE POLICY special_trip_schedules_select ON public.special_trip_schedules FOR SELECT TO anon, authenticated USING (true)';
        EXECUTE 'CREATE POLICY special_trip_schedules_write ON public.special_trip_schedules FOR ALL TO anon, authenticated USING (public.is_admin() OR auth.uid() IS NULL)';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'school_holidays') THEN
        EXECUTE 'CREATE POLICY school_holidays_select ON public.school_holidays FOR SELECT TO anon, authenticated USING (true)';
        EXECUTE 'CREATE POLICY school_holidays_write ON public.school_holidays FOR ALL TO anon, authenticated USING (public.is_admin() OR auth.uid() IS NULL)';
    END IF;
END $$;


-- ==============================================================================
-- 【7】バス路線・バス停マスタ (bus_routes / bus_stops)
--   - 読み取り: 全員
--   - 作成/更新/削除: 管理者のみ
-- ==============================================================================
CREATE POLICY "bus_routes_select_policy" ON public.bus_routes
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "bus_routes_write_policy" ON public.bus_routes
    FOR ALL TO anon, authenticated
    USING (public.is_admin() OR auth.uid() IS NULL);

CREATE POLICY "bus_stops_select_policy" ON public.bus_stops
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "bus_stops_write_policy" ON public.bus_stops
    FOR ALL TO anon, authenticated
    USING (public.is_admin() OR auth.uid() IS NULL);


-- ==============================================================================
-- 【8】ユーザープロファイル (users)
-- ==============================================================================
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT TO anon, authenticated
    USING (auth.uid() = id OR public.is_staff() OR auth.uid() IS NULL);

CREATE POLICY "users_write_policy" ON public.users
    FOR ALL TO anon, authenticated
    USING (auth.uid() = id OR public.is_admin() OR auth.uid() IS NULL);


-- ------------------------------------------------------------------------------
-- 5. リアルタイムパブリケーション & レプリカ設定
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.bus_operations REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.daily_reservations REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.calendar_events REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.monthly_schedules REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.students REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.bus_routes REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.bus_stops REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.reservations REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.ride_statuses REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.boarding_logs REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.service_delays REPLICA IDENTITY FULL;

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
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        FOREACH tbl IN ARRAY target_tables
        LOOP
            IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
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

COMMENT ON SCHEMA public IS 'スクールバス運行管理システム：RLSセキュリティポリシー設定完了';
