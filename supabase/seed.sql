-- ==============================================================================
-- スクールバス運行管理システム：初期マスターデータ投入SQL (seed.sql)
-- ==============================================================================

-- 1. ルート・バス停データ
INSERT INTO public.bus_routes (id, route_name, driver_id)
VALUES ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'スクールバス運行ルート', NULL)
ON CONFLICT (id) DO UPDATE SET route_name = EXCLUDED.route_name;

INSERT INTO public.bus_stops (id, bus_route_id, stop_name, arrival_time_morning, order_index)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '青葉台公園前', '07:30:00', 1),
  ('22222222-2222-2222-2222-222222222222', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '美咲が丘三丁目', '07:42:00', 2),
  ('33333333-3333-3333-3333-333333333333', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '東小学校前歩道橋', '07:55:00', 3),
  ('44444444-4444-4444-4444-444444444444', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '中央駅ロータリー', '08:05:00', 4),
  ('55555555-5555-5555-5555-555555555555', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '市役所前（バス停）', '08:15:00', 5),
  ('66666666-6666-6666-6666-666666666666', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '桜木通り交差点', '08:25:00', 6),
  ('77777777-7777-7777-7777-777777777777', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '緑ヶ丘団地センター', '08:35:00', 7),
  ('88888888-8888-8888-8888-888888888888', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '西ヶ原クリニック前', '08:45:00', 8)
ON CONFLICT (id) DO UPDATE SET 
  stop_name = EXCLUDED.stop_name,
  arrival_time_morning = EXCLUDED.arrival_time_morning,
  order_index = EXCLUDED.order_index;

-- 2. 生徒マスター初期データ
INSERT INTO public.students (id, student_code, verification_code, name, grade, class_name, household_id, bus_route_id, default_bus_stop_id, bus_stop_name, default_morning_ride, default_afternoon_schedule)
VALUES
  ('c1c1c1c1-1111-1111-1111-111111111111', 'STU-001', 'PASS001', '山田 花子', '3年生', '1組', 'H-001', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '11111111-1111-1111-1111-111111111111', '青葉台公園前', TRUE, '下校2便'),
  ('c1c1c1c1-2222-2222-2222-222222222222', 'STU-002', 'PASS002', '山田 太郎', '1年生', '2組', 'H-001', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '11111111-1111-1111-1111-111111111111', '青葉台公園前', TRUE, '下校2便'),
  ('c1c1c1c1-3333-3333-3333-333333333333', 'STU-101', 'PASS101', '佐藤 結衣', '2年生', '1組', 'H-002', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '22222222-2222-2222-2222-222222222222', '美咲が丘三丁目', TRUE, '下校2便'),
  ('c1c1c1c1-4444-4444-4444-444444444444', 'STU-102', 'PASS102', '佐藤 陽斗', '1年生', '1組', 'H-002', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '22222222-2222-2222-2222-222222222222', '美咲が丘三丁目', TRUE, '下校2便'),
  ('c1c1c1c1-5555-5555-5555-555555555555', 'STU-201', 'PASS201', '鈴木 陸', '3年生', '2組', 'H-003', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '33333333-3333-3333-3333-333333333333', '東小学校前歩道橋', TRUE, '下校3便'),
  ('c1c1c1c1-6666-6666-6666-666666666666', 'STU-301', 'PASS301', '高橋 葵', '1年生', '3組', 'H-004', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '44444444-4444-4444-4444-444444444444', '中央駅ロータリー', TRUE, '下校1便')
ON CONFLICT (student_code) DO UPDATE SET
  verification_code = EXCLUDED.verification_code,
  name = EXCLUDED.name,
  grade = EXCLUDED.grade,
  class_name = EXCLUDED.class_name,
  household_id = EXCLUDED.household_id,
  bus_stop_name = EXCLUDED.bus_stop_name;

-- 3. 月別ダイヤ初期データ (1〜12月)
INSERT INTO public.monthly_schedules (month, shortened_day_of_week, morning_trip_time, trip_1_time, trip_2_time, trip_3_time, trip_4_time, trip_5_time, wed_trip_1_time, wed_trip_2_time, wed_trip_3_time, wed_trip_4_time, wed_trip_5_time, note)
VALUES
  (4, 3, '07:30:00', '15:00:00', '16:00:00', '17:00:00', '18:00:00', '18:30:00', '14:00:00', '15:00:00', '16:00:00', '17:00:00', NULL, '新学期・春ダイヤ（水曜5h授業）'),
  (5, 3, '07:30:00', '15:00:00', '16:30:00', '17:30:00', '18:20:00', '18:45:00', '14:00:00', '15:30:00', '16:30:00', '17:30:00', NULL, '夏期部活延長ダイヤ'),
  (6, 3, '07:30:00', '15:00:00', '16:30:00', '17:30:00', '18:30:00', '19:00:00', '14:00:00', '15:30:00', '16:30:00', '17:30:00', NULL, '夏期日没延長'),
  (7, 3, '07:30:00', '15:00:00', '16:30:00', '17:30:00', '18:30:00', NULL, '14:00:00', '15:30:00', '16:30:00', '17:30:00', NULL, '夏季通常ダイヤ（5便運休）'),
  (8, NULL, '08:00:00', '13:00:00', '15:00:00', '16:30:00', NULL, NULL, '13:00:00', '15:00:00', '16:30:00', NULL, NULL, '夏季ダイヤ（短縮日課なし・4/5便運休）'),
  (9, 3, '07:30:00', '15:00:00', '16:30:00', '17:30:00', '18:15:00', '18:45:00', '14:00:00', '15:30:00', '16:30:00', '17:30:00', NULL, '秋期移行ダイヤ'),
  (10, 3, '07:30:00', '15:00:00', '16:00:00', '17:00:00', '17:45:00', NULL, '14:00:00', '15:00:00', '16:00:00', '17:00:00', NULL, '秋期日没短縮（5便運休）'),
  (11, 3, '07:30:00', '15:00:00', '16:00:00', '17:00:00', '17:30:00', NULL, '14:00:00', '15:00:00', '16:00:00', '17:00:00', NULL, '冬期ダイヤ（5便運休）'),
  (12, 3, '07:30:00', '15:00:00', '16:00:00', '16:45:00', NULL, NULL, '14:00:00', '15:00:00', '16:00:00', NULL, NULL, '冬期短縮（4・5便運休）'),
  (1, 3, '07:30:00', '15:00:00', '16:00:00', '17:00:00', '17:30:00', NULL, '14:00:00', '15:00:00', '16:00:00', '17:00:00', NULL, '新春冬期ダイヤ（5便運休）'),
  (2, 3, '07:30:00', '15:00:00', '16:00:00', '17:00:00', '17:45:00', NULL, '14:00:00', '15:00:00', '16:00:00', '17:00:00', NULL, '春期移行準備（5便運休）'),
  (3, 3, '07:30:00', '15:00:00', '16:00:00', '17:00:00', '18:00:00', '18:30:00', '14:00:00', '15:00:00', '16:00:00', '17:00:00', NULL, '春期ダイヤ')
ON CONFLICT (month) DO UPDATE SET
  shortened_day_of_week = EXCLUDED.shortened_day_of_week,
  morning_trip_time = EXCLUDED.morning_trip_time,
  trip_1_time = EXCLUDED.trip_1_time,
  trip_2_time = EXCLUDED.trip_2_time,
  trip_3_time = EXCLUDED.trip_3_time,
  trip_4_time = EXCLUDED.trip_4_time,
  trip_5_time = EXCLUDED.trip_5_time,
  wed_trip_1_time = EXCLUDED.wed_trip_1_time,
  wed_trip_2_time = EXCLUDED.wed_trip_2_time,
  wed_trip_3_time = EXCLUDED.wed_trip_3_time,
  wed_trip_4_time = EXCLUDED.wed_trip_4_time,
  wed_trip_5_time = EXCLUDED.wed_trip_5_time,
  note = EXCLUDED.note;

-- 4. 運行遅延状況の初期レコード
INSERT INTO public.service_delays (bus_route_id, date, trip_name, delay_minutes, status, message)
VALUES
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', CURRENT_DATE, '登校便', 0, 'not_started', '定刻運行中'),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', CURRENT_DATE, '下校1便', 0, 'not_started', '定刻運行予定'),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', CURRENT_DATE, '下校2便', 0, 'not_started', '定刻運行予定'),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', CURRENT_DATE, '下校3便', 0, 'not_started', '定刻運行予定'),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', CURRENT_DATE, '下校4便', 0, 'not_started', '定刻運行予定'),
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', CURRENT_DATE, '下校5便', 0, 'not_started', '定刻運行予定')
ON CONFLICT (date, trip_name) DO NOTHING;
