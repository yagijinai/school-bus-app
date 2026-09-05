import type { Student, BusRoute, BusStop, BusOperation, MonthlyTripSchedule, SpecialTripSchedule, SchoolHoliday } from '../types/app'

export const mockBusRoutes: BusRoute[] = [
  {
    id: 'route-a',
    route_name: 'スクールバス運行ルート',
    driver_id: 'driver-1'
  }
]

export const mockBusStops: BusStop[] = [
  {
    id: 'stop-1',
    bus_route_id: 'route-a',
    stop_name: '高山研修所前',
    arrival_time_morning: '07:30:00',
    order_index: 1
  },
  {
    id: 'stop-2',
    bus_route_id: 'route-a',
    stop_name: '山田水車公園前',
    arrival_time_morning: '07:42:00',
    order_index: 2
  },
  {
    id: 'stop-3',
    bus_route_id: 'route-a',
    stop_name: '明神',
    arrival_time_morning: '07:55:00',
    order_index: 3
  },
  {
    id: 'stop-4',
    bus_route_id: 'route-a',
    stop_name: '草香会館',
    arrival_time_morning: '08:05:00',
    order_index: 4
  }
]

export const mockBusOperations: BusOperation[] = [
  {
    id: 'op-a-morning',
    bus_route_id: 'route-a',
    date: new Date().toISOString().split('T')[0],
    trip_name: '登校便',
    status: 'running',
    delay_minutes: 0
  },
  {
    id: 'op-a-afternoon-1',
    bus_route_id: 'route-a',
    date: new Date().toISOString().split('T')[0],
    trip_name: '下校1便',
    status: 'not_started',
    delay_minutes: 0
  },
  {
    id: 'op-a-afternoon-2',
    bus_route_id: 'route-a',
    date: new Date().toISOString().split('T')[0],
    trip_name: '下校2便',
    status: 'not_started',
    delay_minutes: 0
  },
  {
    id: 'op-a-afternoon-3',
    bus_route_id: 'route-a',
    date: new Date().toISOString().split('T')[0],
    trip_name: '下校3便',
    status: 'not_started',
    delay_minutes: 0
  },
  {
    id: 'op-a-afternoon-4',
    bus_route_id: 'route-a',
    date: new Date().toISOString().split('T')[0],
    trip_name: '下校4便',
    status: 'not_started',
    delay_minutes: 0
  },
  {
    id: 'op-a-afternoon-5',
    bus_route_id: 'route-a',
    date: new Date().toISOString().split('T')[0],
    trip_name: '下校5便',
    status: 'not_started',
    delay_minutes: 0
  }
]

// モック生徒データ（山田太郎・花子等）は完全削除され、GAS / スプレッドシート連携へ移行
export const mockStudents: Student[] = []

export const mockMonthlyTripSchedules: MonthlyTripSchedule[] = [
  { id: 'mts-4', month: 4, shortened_day_of_week: 3, morning_trip_time: '07:30:00', trip_1_time: '15:00:00', trip_2_time: '16:00:00', trip_3_time: '17:00:00', trip_4_time: '18:00:00', trip_5_time: '18:30:00', wed_trip_1_time: '14:00:00', wed_trip_2_time: '15:00:00', wed_trip_3_time: '16:00:00', wed_trip_4_time: '17:00:00', wed_trip_5_time: null, note: '新学期・春ダイヤ（水曜5h授業）' },
  { id: 'mts-5', month: 5, shortened_day_of_week: 3, morning_trip_time: '07:30:00', trip_1_time: '15:00:00', trip_2_time: '16:30:00', trip_3_time: '17:30:00', trip_4_time: '18:20:00', trip_5_time: '18:45:00', wed_trip_1_time: '14:00:00', wed_trip_2_time: '15:30:00', wed_trip_3_time: '16:30:00', wed_trip_4_time: '17:30:00', wed_trip_5_time: null, note: '夏期部活延長ダイヤ' },
  { id: 'mts-6', month: 6, shortened_day_of_week: 3, morning_trip_time: '07:30:00', trip_1_time: '15:00:00', trip_2_time: '16:30:00', trip_3_time: '17:30:00', trip_4_time: '18:30:00', trip_5_time: '19:00:00', wed_trip_1_time: '14:00:00', wed_trip_2_time: '15:30:00', wed_trip_3_time: '16:30:00', wed_trip_4_time: '17:30:00', wed_trip_5_time: null, note: '夏期日没延長' },
  { id: 'mts-7', month: 7, shortened_day_of_week: 3, morning_trip_time: '07:30:00', trip_1_time: '15:00:00', trip_2_time: '16:30:00', trip_3_time: '17:30:00', trip_4_time: '18:30:00', trip_5_time: null, wed_trip_1_time: '14:00:00', wed_trip_2_time: '15:30:00', wed_trip_3_time: '16:30:00', wed_trip_4_time: '17:30:00', wed_trip_5_time: null, note: '夏季通常ダイヤ（5便運休）' },
  { id: 'mts-8', month: 8, shortened_day_of_week: null, morning_trip_time: '08:00:00', trip_1_time: '13:00:00', trip_2_time: '15:00:00', trip_3_time: '16:30:00', trip_4_time: null, trip_5_time: null, wed_trip_1_time: '13:00:00', wed_trip_2_time: '15:00:00', wed_trip_3_time: '16:30:00', wed_trip_4_time: null, wed_trip_5_time: null, note: '夏季ダイヤ（短縮日課なし・4/5便運休）' },
  { id: 'mts-9', month: 9, shortened_day_of_week: 3, morning_trip_time: '07:30:00', trip_1_time: '15:00:00', trip_2_time: '16:30:00', trip_3_time: '17:30:00', trip_4_time: '18:15:00', trip_5_time: '18:45:00', wed_trip_1_time: '14:00:00', wed_trip_2_time: '15:30:00', wed_trip_3_time: '16:30:00', wed_trip_4_time: '17:30:00', wed_trip_5_time: null, note: '秋期移行ダイヤ' },
  { id: 'mts-10', month: 10, shortened_day_of_week: 3, morning_trip_time: '07:30:00', trip_1_time: '15:00:00', trip_2_time: '16:00:00', trip_3_time: '17:00:00', trip_4_time: '17:45:00', trip_5_time: null, wed_trip_1_time: '14:00:00', wed_trip_2_time: '15:00:00', wed_trip_3_time: '16:00:00', wed_trip_4_time: '17:00:00', wed_trip_5_time: null, note: '秋期日没短縮（5便運休）' },
  { id: 'mts-11', month: 11, shortened_day_of_week: 3, morning_trip_time: '07:30:00', trip_1_time: '15:00:00', trip_2_time: '16:00:00', trip_3_time: '17:00:00', trip_4_time: '17:30:00', trip_5_time: null, wed_trip_1_time: '14:00:00', wed_trip_2_time: '15:00:00', wed_trip_3_time: '16:00:00', wed_trip_4_time: '17:00:00', wed_trip_5_time: null, note: '冬期ダイヤ（5便運休）' },
  { id: 'mts-12', month: 12, shortened_day_of_week: 3, morning_trip_time: '07:30:00', trip_1_time: '15:00:00', trip_2_time: '16:00:00', trip_3_time: '16:45:00', trip_4_time: null, trip_5_time: null, wed_trip_1_time: '14:00:00', wed_trip_2_time: '15:00:00', wed_trip_3_time: '16:00:00', wed_trip_4_time: null, wed_trip_5_time: null, note: '冬期短縮（4・5便運休）' },
  { id: 'mts-1', month: 1, shortened_day_of_week: 3, morning_trip_time: '07:30:00', trip_1_time: '15:00:00', trip_2_time: '16:00:00', trip_3_time: '17:00:00', trip_4_time: '17:30:00', trip_5_time: null, wed_trip_1_time: '14:00:00', wed_trip_2_time: '15:00:00', wed_trip_3_time: '16:00:00', wed_trip_4_time: '17:00:00', wed_trip_5_time: null, note: '新春冬期ダイヤ（5便運休）' },
  { id: 'mts-2', month: 2, shortened_day_of_week: 3, morning_trip_time: '07:30:00', trip_1_time: '15:00:00', trip_2_time: '16:00:00', trip_3_time: '17:00:00', trip_4_time: '17:45:00', trip_5_time: null, wed_trip_1_time: '14:00:00', wed_trip_2_time: '15:00:00', wed_trip_3_time: '16:00:00', wed_trip_4_time: '17:00:00', wed_trip_5_time: null, note: '春期移行準備（5便運休）' },
  { id: 'mts-3', month: 3, shortened_day_of_week: 3, morning_trip_time: '07:30:00', trip_1_time: '15:00:00', trip_2_time: '16:00:00', trip_3_time: '17:00:00', trip_4_time: '18:00:00', trip_5_time: '18:30:00', wed_trip_1_time: '14:00:00', wed_trip_2_time: '15:00:00', wed_trip_3_time: '16:00:00', wed_trip_4_time: '17:00:00', wed_trip_5_time: null, note: '春期ダイヤ' }
]

// 特定日例外ダイヤ・臨時運行（サンプル）
export const mockSpecialTripSchedules: SpecialTripSchedule[] = [
  {
    id: 'sts-1',
    date: '2026-05-15',
    is_temporary_operation: false,
    is_all_day_suspended: false,
    is_morning_suspended: false,
    is_afternoon_suspended: false,
    morning_trip_time: '08:00:00',
    trip_1_time: '13:30:00',
    trip_2_time: '14:30:00',
    trip_3_time: null,
    trip_4_time: null,
    trip_5_time: null,
    note: '創立記念行事ダイヤ（午前授業・登校08:00）',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'sts-summer-school',
    date: '2026-08-05',
    is_temporary_operation: true,
    is_all_day_suspended: false,
    is_morning_suspended: false,
    is_afternoon_suspended: false,
    morning_trip_time: '08:30:00',
    trip_1_time: '11:30:00',
    trip_2_time: '12:30:00',
    trip_3_time: null,
    trip_4_time: null,
    trip_5_time: null,
    note: '夏期全校登校日（夏休み中・登校08:30臨時運行）',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'sts-sports-day',
    date: '2026-10-04',
    is_temporary_operation: true,
    is_all_day_suspended: false,
    is_morning_suspended: false,
    is_afternoon_suspended: false,
    morning_trip_time: '07:15:00',
    trip_1_time: '15:30:00',
    trip_2_time: '16:30:00',
    trip_3_time: null,
    trip_4_time: null,
    trip_5_time: null,
    note: '秋季体育大会（日曜日・登校07:15臨時運行）',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'sts-2',
    date: '2026-09-18',
    is_temporary_operation: false,
    is_all_day_suspended: true,
    is_morning_suspended: true,
    is_afternoon_suspended: true,
    morning_trip_time: null,
    trip_1_time: null,
    trip_2_time: null,
    trip_3_time: null,
    trip_4_time: null,
    trip_5_time: null,
    note: '体育祭準備に伴う全便運休',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

// 長期休業・学校休業期間（サンプル）
export const mockSchoolHolidays: SchoolHoliday[] = [
  {
    id: 'sh-summer-2026',
    holiday_name: '夏季休業期間（夏休み）',
    start_date: '2026-07-21',
    end_date: '2026-08-28',
    holiday_type: 'summer',
    note: '全便運休（登校日を除く）',
    created_at: new Date().toISOString()
  },
  {
    id: 'sh-closed-2026',
    holiday_name: '学校閉庁日（お盆期間）',
    start_date: '2026-08-12',
    end_date: '2026-08-16',
    holiday_type: 'closed',
    note: '学校完全閉庁（全便運休）',
    created_at: new Date().toISOString()
  },
  {
    id: 'sh-winter-2026',
    holiday_name: '冬季休業期間（冬休み）',
    start_date: '2026-12-25',
    end_date: '2027-01-07',
    holiday_type: 'winter',
    note: '全便運休',
    created_at: new Date().toISOString()
  },
  {
    id: 'sh-spring-2027',
    holiday_name: '春季休業期間（春休み）',
    start_date: '2027-03-25',
    end_date: '2027-04-06',
    holiday_type: 'spring',
    note: '新年度準備・全便運休',
    created_at: new Date().toISOString()
  }
]
