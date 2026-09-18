/**
 * スクールバス運行管理システム - Google Apps Script (GAS) バックエンド完全版
 * 
 * 【スプレッドシート「生徒・保護者マスタ」全6シート完全定義】
 * 
 * 1. シート名: 「生徒・保護者マスター」
 *    A列: 保護者メールアドレス
 *    B列: 生徒名１
 *    C列: 生徒名２
 *    D列: 生徒名３
 *    E列: 生徒名４
 *    F列: 登録バス停名
 *    G列: 備考
 *    H列: 基本_登校（「乗る」、もしくは空白）
 *    I列: 基本_下校（「1便」、「2便」、「乗らない」のいずれか）
 * 
 * 2. シート名: 「バス停マスタ」
 *    A列: バス停名
 *    B列: 住所
 *    C列: 到着予定時刻（登校便）
 *    D列: 停車順序
 * 
 * 3. シート名: 「運行予定カレンダー」
 *    A列: ID（行番号から1を引いた通し番号数値）
 *    B列: 日付（YYYY/MM/DD 形式）
 *    C列: 生徒名
 *    D列: 登校ステータス（「乗る」、もしくは空白）
 *    E列: 下校ステータス（乗らない場合のみ「乗らない」、下校便に乗る場合は空白）
 *    F列: 下校1便（選択時の時刻文字列、または空白）
 *    G列: 下校2便（選択時の時刻文字列、または空白）
 *    H列: 下校3便（選択時の時刻文字列、または空白）
 *    I列: 備考
 *    J列: 更新日時（YYYY/MM/DD HH:mm:ss）
 *    K列: 保護者メールアドレス
 * 
 * 4. シート名: 「基本設定・運休期間」
 *    A列: 設定名
 *    B列: 開始日
 *    C列: 終了日
 *    D列: 標準運行
 *    E列: 内容・時刻
 *    F列: 備考
 * 
 * 5. シート名: 「学校用時刻表」
 *    A列: 日付（YYYY/MM/DD）
 *    B列: 登校便
 *    C列: 下校1便
 *    D列: 下校2便
 *    E列: 下校3便
 *    F列: 備考
 *    G列: カレンダー表示用
 * 
 * 6. シート名: 「ユーザー権限マスタ」
 *    A列: メールアドレス
 *    B列: 指名
 *    C列: 役割（管理者 / 運転手 / 保護者 等）
 */

/**
 * =========================================================================
 * CacheService 高速化キャッシュ機構（TTL: 30分 = 1800秒）
 * =========================================================================
 */
const CACHE_TTL_SECONDS = 1800;

const CACHE_KEYS = {
  GUARDIAN_MASTER: 'sb_cache_guardian_master_v1',
  BUS_STOPS: 'sb_cache_bus_stops_v1',
  BASIC_SETTINGS: 'sb_cache_basic_settings_v1',
  SCHOOL_TIMETABLE: 'sb_cache_school_timetable_v1',
  USER_PERMISSIONS: 'sb_cache_user_permissions_v1',
  HOLIDAYS: 'sb_cache_holidays_v1',
  SCHEDULES: 'sb_cache_schedules_v1'
};

function getScriptCacheItem(key) {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn('[Cache] getScriptCacheItem failed for ' + key + ':', e);
  }
  return null;
}

function setScriptCacheItem(key, data, ttlSeconds) {
  try {
    const jsonStr = JSON.stringify(data);
    // CacheService 1エントリの上限は 100KB (安全マージンとして95000文字以内)
    if (jsonStr.length < 95000) {
      const cache = CacheService.getScriptCache();
      cache.put(key, jsonStr, ttlSeconds || CACHE_TTL_SECONDS);
    } else {
      console.warn('[Cache] Data size exceeds 95KB for ' + key + ', skipping cache.');
    }
  } catch (e) {
    console.warn('[Cache] setScriptCacheItem failed for ' + key + ':', e);
  }
}

function clearAllScriptCaches() {
  try {
    const cache = CacheService.getScriptCache();
    const keys = Object.values(CACHE_KEYS);
    cache.removeAll(keys);
    console.log('[Cache] Successfully cleared all script caches.');
  } catch (e) {
    console.warn('[Cache] clearAllScriptCaches failed:', e);
  }
}

function doGet(e) {
  return handleRequest(e ? e.parameter : {}, 'GET');
}

function doPost(e) {
  let params = {};
  if (e && e.postData && e.postData.contents) {
    try {
      params = JSON.parse(e.postData.contents);
    } catch (err) {
      params = e.parameter || {};
    }
  } else if (e && e.parameter) {
    params = e.parameter;
  }
  return handleRequest(params, 'POST');
}

function handleRequest(params, method) {
  const action = params.action;
  try {
    switch (action) {
      case 'saveReservation':
      case 'saveSchedule':
        return createJsonResponse(saveReservationToSheet(params));
      case 'saveBatchSchedules':
        return createJsonResponse(saveBatchSchedulesToSheet(params.schedules || params.reservations || []));
      case 'getSchedules':
        return createJsonResponse(getSchedulesFromSheet(params.email));
      case 'getGuardianData':
        return createJsonResponse(getGuardianDataFromSheet(params.email || params.parentEmail));
      case 'getGuardianMaster':
        return createJsonResponse(getGuardianMasterFromSheet());
      case 'saveGuardianMaster':
        return createJsonResponse(saveGuardianMasterToSheet(params));
      case 'deleteGuardianMaster':
        return createJsonResponse(deleteGuardianMasterFromSheet(params));
      case 'registerNewStudentWithCode':
        return createJsonResponse(registerNewStudentWithCodeToSheet(params));
      case 'linkStudentWithCode':
        return createJsonResponse(linkStudentWithCodeToSheet(params));
      case 'getBusStops':
        return createJsonResponse(getBusStopsFromSheet());
      case 'saveBusStop':
        return createJsonResponse(saveBusStopToSheet(params));
      case 'deleteBusStop':
        return createJsonResponse(deleteBusStopFromSheet(params.name || params.bus_stop_name));
      case 'getBasicSettings':
        return createJsonResponse(getBasicSettingsFromSheet());
      case 'saveBasicSetting':
        return createJsonResponse(saveBasicSettingToSheet(params));
      case 'saveMonthPublishStatus':
        return createJsonResponse(saveMonthPublishStatusToSheet(params));
      case 'getMonthPublishStatus':
        return createJsonResponse(getMonthPublishStatusFromSheet(params));
      case 'getSchoolTimetable':
        return createJsonResponse(getSchoolTimetableFromSheet());
      case 'saveSchoolTimetable':
        return createJsonResponse(saveSchoolTimetableToSheet(params));
      case 'saveBatchSchoolTimetable':
        return createJsonResponse(saveBatchSchoolTimetableToSheet(params));
      case 'updateRollCall':
      case 'recordBoarding':
        return createJsonResponse(recordBoardingToSheet(params));
      case 'getUserPermissions':
        return createJsonResponse(getUserPermissionsFromSheet());
      case 'verifyStudent':
        return createJsonResponse(verifyStudentInSheet(params.code, params.email));
      case 'getAllMaster':
        return createJsonResponse(getAllMasterFromSheet(params));
      case 'clearCache':
        clearAllScriptCaches();
        return createJsonResponse({ status: 'success', message: 'ScriptCacheをクリアしました' });
      case 'getHolidays':
        return createJsonResponse({ status: 'success', holidays: getGoogleOfficialHolidays(params.year) });
      default:
        return createJsonResponse({
          status: 'success',
          message: 'スクールバス運行管理APIは正常に稼働しています',
          action: action
        });
    }
  } catch (error) {
    return createJsonResponse({
      status: 'error',
      message: error.toString()
    });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 日付文字列を確実に YYYY/MM/DD または MM/DD 形式に変換
 */
function formatDateToSlash(val) {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = ('0' + (val.getMonth() + 1)).slice(-2);
    const d = ('0' + val.getDate()).slice(-2);
    return y + '/' + m + '/' + d;
  }
  let str = String(val).trim().replace(/^'+/, '').replace(/-/g, '/');
  const parts = str.split('/');
  if (parts.length === 3) {
    const y = parts[0];
    const m = ('0' + parts[1]).slice(-2);
    const d = ('0' + parts[2]).slice(-2);
    return y + '/' + m + '/' + d;
  }
  if (parts.length === 2) {
    const m = ('0' + parts[0]).slice(-2);
    const d = ('0' + parts[1]).slice(-2);
    return m + '/' + d;
  }
  return str;
}

/**
 * 時刻文字列を確実に「HH:mm」形式（日付部分を完全排除）に変換
 */
function formatTimeToHHmmGAS(val) {
  if (!val && val !== 0) return '';
  if (val instanceof Date) {
    const hh = ('0' + val.getHours()).slice(-2);
    const mm = ('0' + val.getMinutes()).slice(-2);
    return hh + ':' + mm;
  }
  const str = String(val).trim();
  if (!str || str === '-' || str === '--:--' || str === 'なし' || str === '運休') return '';

  const match = str.match(/(?:^|\s|T|[^\d:])(\d{1,2}):(\d{2})(?::\d{2})?(?:$|\s|[^\d:])/i) || str.match(/\b(\d{1,2}:\d{2})\b/);
  if (match) {
    const parts = match[0].match(/(\d{1,2}):(\d{2})/);
    if (parts) {
      const hh = ('0' + parts[1]).slice(-2);
      const mm = ('0' + parts[2]).slice(-2);
      return hh + ':' + mm;
    }
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const hh = ('0' + d.getHours()).slice(-2);
    const mm = ('0' + d.getMinutes()).slice(-2);
    return hh + ':' + mm;
  }

  if (/^\d{1,2}:\d{2}$/.test(str)) {
    const p = str.split(':');
    return ('0' + p[0]).slice(-2) + ':' + ('0' + p[1]).slice(-2);
  }

  return '';
}

/**
 * 現在日時を YYYY/MM/DD HH:mm:ss 形式で取得
 */
function formatCurrentDateTimeJ() {
  const d = new Date();
  const y = d.getFullYear();
  const m = ('0' + (d.getMonth() + 1)).slice(-2);
  const date = ('0' + d.getDate()).slice(-2);
  const hh = ('0' + d.getHours()).slice(-2);
  const mm = ('0' + d.getMinutes()).slice(-2);
  const ss = ('0' + d.getSeconds()).slice(-2);
  return y + '/' + m + '/' + date + ' ' + hh + ':' + mm + ':' + ss;
}

/**
 * 1. 予約・スケジュールの単一保存（「運行予定カレンダー」確定仕様完全合致）
 * 
 * 便と列のマッピング厳格化ルール:
 * - 下校1便選択時 ➔ F列に時刻、G・H列は空白、E列は空白
 * - 下校2便選択時 ➔ G列に時刻、F・H列は空白、E列は空白
 * - 下校3便選択時 ➔ H列に時刻、F・G列は空白、E列は空白
 * - 下校しない場合 ➔ E列に「乗らない」、F・G・H列は空白
 * - 下校便に乗る場合 ➔ E列は空白
 */
function saveReservationToSheet(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = '運行予定カレンダー';
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow([
      'ID', '日付', '生徒名', '登校ステータス', '下校ステータス',
      '下校1便', '下校2便', '下校3便', '備考', '更新日時', '保護者メールアドレス',
      '登校乗車確認', '下校乗車確認'
    ]);
  } else {
    // 12列目・13列目のヘッダーが存在しない場合は補完
    if (sheet.getLastColumn() < 12 || !sheet.getRange(1, 12).getValue()) {
      sheet.getRange(1, 12).setValue('登校乗車確認');
    }
    if (sheet.getLastColumn() < 13 || !sheet.getRange(1, 13).getValue()) {
      sheet.getRange(1, 13).setValue('下校乗車確認');
    }
  }

  // B列: 日付 (YYYY/MM/DD)
  const dateStr = formatDateToSlash(data.date || data['日付'] || data.rawDate);
  const studentName = String(data.student_name || data.studentName || data['生徒名'] || data.studentId || '').trim();

  // D列: 登校ステータス ('乗る' または '')
  // 初期値保証: 未指定やユーザー無操作時でも初期値「乗る」を確実に反映
  let isMorning = true;
  if (data.morning_status !== undefined && data.morning_status !== null) {
    isMorning = (data.morning_status === '乗る' || data.morning_status === '乗車' || data.morning_status === true || data.morning_status === 'true');
  } else if (data.morningTrip !== undefined && data.morningTrip !== null) {
    isMorning = (data.morningTrip === '乗る' || data.morningTrip === '乗車' || data.morningTrip === true || data.morningTrip === 'true');
  } else if (data.morningStatus !== undefined && data.morningStatus !== null) {
    isMorning = (data.morningStatus === '乗る' || data.morningStatus === '乗車' || data.morningStatus === true || data.morningStatus === 'true');
  } else if (data['登校ステータス'] !== undefined && data['登校ステータス'] !== null) {
    isMorning = (data['登校ステータス'] === '乗る' || data['登校ステータス'] === '乗車' || data['登校ステータス'] === true || data['登校ステータス'] === 'true');
  }
  const morningStatus = isMorning ? '乗る' : '';

  // 下校便と列のマッピング厳格化
  // 便指定の判定
  const aftTripText = String(data.afternoonTrip || data.afternoonSchedule || data['下校便'] || '').trim();
  const aftStatusInput = String(data.afternoonStatus || data['下校ステータス'] || '').trim();

  let trip1 = '';
  let trip2 = '';
  let trip3 = '';
  let afternoonStatus = '';

  const isNotRidingAfternoon = (
    aftStatusInput === '乗らない' ||
    aftTripText === '乗らない' ||
    aftTripText === '不要' ||
    aftTripText === '乗車しない' ||
    (data.afternoonTrip === null && !data['下校1便'] && !data['下校2便'] && !data['下校3便'])
  );

  if (isNotRidingAfternoon) {
    // 下校しない場合 ➔ E列に「乗らない」、F・G・H列は空白
    afternoonStatus = '乗らない';
    trip1 = '';
    trip2 = '';
    trip3 = '';
  } else {
    // 下校便に乗る場合 ➔ E列は空白
    afternoonStatus = '';

    // 送信された明示的な時刻
    const rawTrip1 = String(data['下校1便'] || data.trip1 || data.trip1Time || '').trim();
    const rawTrip2 = String(data['下校2便'] || data.trip2 || data.trip2Time || '').trim();
    const rawTrip3 = String(data['下校3便'] || data.trip3 || data.trip3Time || '').trim();

    if (aftTripText.includes('1便') || aftTripText === '1' || rawTrip1) {
      // 下校1便選択時 ➔ F列に時刻、G・H列は空白
      trip1 = rawTrip1 || '15:00';
      trip2 = '';
      trip3 = '';
    } else if (aftTripText.includes('2便') || aftTripText === '2' || rawTrip2) {
      // 下校2便選択時 ➔ G列に時刻、F・H列は空白
      trip1 = '';
      trip2 = rawTrip2 || '16:00';
      trip3 = '';
    } else if (aftTripText.includes('3便') || aftTripText === '3' || rawTrip3) {
      // 下校3便選択時 ➔ H列に時刻、F・G列は空白
      trip1 = '';
      trip2 = '';
      trip3 = rawTrip3 || '17:00';
    } else if (rawTrip1) {
      trip1 = rawTrip1;
      trip2 = '';
      trip3 = '';
    } else if (rawTrip2) {
      trip1 = '';
      trip2 = rawTrip2;
      trip3 = '';
    } else if (rawTrip3) {
      trip1 = '';
      trip2 = '';
      trip3 = rawTrip3;
    } else {
      // 便選択があるが不明な場合は下校1便をデフォルト
      trip1 = '15:00';
      trip2 = '';
      trip3 = '';
    }
  }

  // I列: 備考
  const note = String(data['備考'] || data.note || '').trim();

  // J列: 更新日時 (YYYY/MM/DD HH:mm:ss)
  const updatedAt = formatCurrentDateTimeJ();

  // K列: 保護者メールアドレス
  const parentEmail = String(data['保護者メールアドレス'] || data.parentEmail || data.guardianEmail || '').trim().toLowerCase();

  const lastRow = sheet.getLastRow();
  let targetRow = -1;
  let currentId = null;

  // 既存行検索: 2行目以降の B列(日付: YYYY/MM/DD) と C列(生徒名) を走査
  if (lastRow >= 2) {
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 3);
    const rows = dataRange.getValues();
    for (let i = 0; i < rows.length; i++) {
      const rowId = rows[i][0];
      const rowDate = formatDateToSlash(rows[i][1]);
      const rowStudent = String(rows[i][2]).trim();

      if (rowDate === dateStr && rowStudent === studentName) {
        targetRow = i + 2;
        currentId = rowId;
        break;
      }
    }
  }

  if (targetRow > 0) {
    // 既存行更新: A列通し番号数値を維持し、B〜K列を更新
    const rowValues = [
      [currentId, dateStr, studentName, morningStatus, afternoonStatus, trip1, trip2, trip3, note, updatedAt, parentEmail]
    ];
    sheet.getRange(targetRow, 1, 1, 11).setValues(rowValues);
    clearAllScriptCaches();
    return {
      status: 'success',
      action: 'updated',
      row: targetRow,
      id: currentId,
      date: dateStr,
      studentName: studentName,
      message: '予約データを更新しました（行: ' + targetRow + ' / ID: ' + currentId + '）'
    };
  } else {
    // 新規行追加: 行番号から1を引いた通し番号（数値）
    const newRow = lastRow + 1;
    let newId = newRow - 1;
    if (lastRow >= 2) {
      const lastAValue = sheet.getRange(lastRow, 1).getValue();
      if (!isNaN(lastAValue) && Number(lastAValue) > 0) {
        newId = Number(lastAValue) + 1;
      }
    }
    const rowValues = [
      [newId, dateStr, studentName, morningStatus, afternoonStatus, trip1, trip2, trip3, note, updatedAt, parentEmail]
    ];
    sheet.getRange(newRow, 1, 1, 11).setValues(rowValues);
    clearAllScriptCaches();
    return {
      status: 'success',
      action: 'inserted',
      row: newRow,
      id: newId,
      date: dateStr,
      studentName: studentName,
      message: '新規予約を追加しました（行: ' + newRow + ' / ID: ' + newId + '）'
    };
  }
}

/**
 * 2. 複数予約の一括保存
 */
function saveBatchSchedulesToSheet(schedules) {
  if (!Array.isArray(schedules) || schedules.length === 0) {
    return { status: 'success', count: 0, message: '対象データがありません' };
  }

  let updatedCount = 0;
  let insertedCount = 0;

  for (let i = 0; i < schedules.length; i++) {
    const res = saveReservationToSheet(schedules[i]);
    if (res.action === 'updated') updatedCount++;
    else if (res.action === 'inserted') insertedCount++;
  }

  return {
    status: 'success',
    total: schedules.length,
    updatedCount: updatedCount,
    insertedCount: insertedCount,
    message: schedules.length + '件の予約を保存しました（更新: ' + updatedCount + '件、新規: ' + insertedCount + '件）'
  };
}

/**
 * 3. 運行予定カレンダー一覧取得（前月・当月・翌月の必要最小限に自動絞り込み）
 */
function getSchedulesFromSheet(email, options) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('運行予定カレンダー');
  if (!sheet) return { status: 'success', data: [] };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'success', data: [] };

  const numCols = Math.max(sheet.getLastColumn(), 13);
  const values = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
  const cleanEmail = email ? String(email).trim().toLowerCase() : '';

  // 期間絞り込み：全行探索ではなく「前月・当月・翌月（3ヶ月分）」に限定してペイロードと処理時間を極小化
  // options.all === true の場合のみ全期間を取得
  let targetMonths = null;
  if (!options || !options.all) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const prevM = new Date(y, m - 1, 1);
    const currM = new Date(y, m, 1);
    const nextM = new Date(y, m + 1, 1);
    const fmt = d => d.getFullYear() + '/' + ('0' + (d.getMonth() + 1)).slice(-2);
    targetMonths = new Set([fmt(prevM), fmt(currM), fmt(nextM)]);
  }

  const results = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowEmail = String(row[10] || '').trim().toLowerCase();
    if (cleanEmail && rowEmail && rowEmail !== cleanEmail) {
      continue;
    }

    const rowDate = formatDateToSlash(row[1]);
    if (!rowDate) continue;

    // 前月・当月・翌月以外の過去・未来データは除外（通信量とパース負荷を劇的削減）
    if (targetMonths) {
      const ym = rowDate.slice(0, 7);
      if (!targetMonths.has(ym)) {
        continue;
      }
    }

    const morningBoarding = String(row[11] || '').trim();
    const afternoonBoarding = String(row[12] || '').trim();

    results.push({
      'ID': row[0],
      '日付': rowDate,
      '生徒名': String(row[2] || '').trim(),
      '登校ステータス': String(row[3] || '').trim(),
      '下校ステータス': String(row[4] || '').trim(),
      '下校1便': String(row[5] || '').trim(),
      '下校2便': String(row[6] || '').trim(),
      '下校3便': String(row[7] || '').trim(),
      '備考': String(row[8] || '').trim(),
      '更新日時': String(row[9] || '').trim(),
      '保護者メールアドレス': rowEmail,
      '登校乗車確認': morningBoarding,
      '下校乗車確認': afternoonBoarding,
      '乗車時刻': morningBoarding,
      '降車時刻': afternoonBoarding,
      // 英名エイリアス互換
      id: row[0],
      date: formatDateToSlash(row[1]),
      student_name: String(row[2] || '').trim(),
      morning_status: String(row[3] || '').trim(),
      afternoon_status: String(row[4] || '').trim(),
      trip_1: String(row[5] || '').trim(),
      trip_2: String(row[6] || '').trim(),
      trip_3: String(row[7] || '').trim(),
      note: String(row[8] || '').trim(),
      updated_at: String(row[9] || '').trim(),
      guardian_email: rowEmail,
      morning_boarding: morningBoarding,
      afternoon_boarding: afternoonBoarding,
      boarded_at: morningBoarding,
      alighted_at: afternoonBoarding
    });
  }

  return { status: 'success', data: results };
}

/**
/**
 * 3-B. 運転手による乗車・降車点呼の記録（点呼タップ連動: action: "updateRollCall" / "recordBoarding"）
 * パラメータ: date, studentName, tripType ('登校' | '下校'), boarded (true | false), busStop, status
 * 対象シート: 「運行予定カレンダー」または「バス予約データ」「運行記録」
 * 対象列: 「乗車時刻」（boarded_at / 登校乗車確認）および「降車時刻」（alighted_at / 下校乗車確認）
 */
function recordBoardingToSheet(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. 対象シートの柔軟な解決（運行予定カレンダー / バス予約データ / 運行記録）
  const candidateSheetNames = ['運行予定カレンダー', 'バス予約データ', '運行記録'];
  let sheet = null;
  let matchedSheetName = '';
  for (let i = 0; i < candidateSheetNames.length; i++) {
    const s = ss.getSheetByName(candidateSheetNames[i]);
    if (s) {
      sheet = s;
      matchedSheetName = candidateSheetNames[i];
      break;
    }
  }

  if (!sheet) {
    matchedSheetName = '運行予定カレンダー';
    sheet = ss.insertSheet(matchedSheetName);
    sheet.appendRow([
      'ID', '日付', '生徒名', '登校ステータス', '下校ステータス',
      '下校1便', '下校2便', '下校3便', '備考', '更新日時', '保護者メールアドレス',
      '乗車時刻', '降車時刻'
    ]);
  }

  // 2. ヘッダー行（1行目）の動的解析
  const lastCol = Math.max(sheet.getLastColumn(), 13);
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  let dateCol = 2; // B列
  let studentCol = 3; // C列
  let morningStatusCol = 4; // D列
  let afternoonStatusCol = 5; // E列
  let updatedAtCol = 10; // J列
  let parentEmailCol = 11; // K列
  let morningBoardingCol = -1; // 乗車時刻（登校）
  let afternoonBoardingCol = -1; // 降車時刻（下校）

  for (let c = 0; c < headerRow.length; c++) {
    const h = String(headerRow[c] || '').trim();
    if (!h) continue;
    const hLower = h.toLowerCase();
    if (h === '日付' || hLower === 'date') dateCol = c + 1;
    if (h === '生徒名' || hLower === 'student_name' || hLower === 'studentname') studentCol = c + 1;
    if (h === '登校ステータス' || hLower === 'morning_status') morningStatusCol = c + 1;
    if (h === '下校ステータス' || hLower === 'afternoon_status') afternoonStatusCol = c + 1;
    if (h === '更新日時' || hLower === 'updated_at') updatedAtCol = c + 1;
    if (h === '保護者メールアドレス' || hLower === 'parent_email') parentEmailCol = c + 1;
    
    // 乗車時刻列判定
    if (h === '乗車時刻' || h === '登校乗車確認' || h === '登校乗車時刻' || hLower === 'boarded_at' || hLower === 'morning_boarding') {
      morningBoardingCol = c + 1;
    }
    // 降車時刻列判定
    if (h === '降車時刻' || h === '下校乗車確認' || h === '下校降車時刻' || hLower === 'alighted_at' || hLower === 'afternoon_boarding') {
      afternoonBoardingCol = c + 1;
    }
  }

  // 未検出の場合は列を追加またはデフォルト列を設定
  if (morningBoardingCol === -1) {
    morningBoardingCol = 12;
    sheet.getRange(1, 12).setValue('乗車時刻');
  }
  if (afternoonBoardingCol === -1) {
    afternoonBoardingCol = 13;
    sheet.getRange(1, 13).setValue('降車時刻');
  }

  const dateStr = formatDateToSlash(params.date || params.rawDate);
  const studentName = String(params.studentName || params.student_name || params['生徒名'] || '').trim();
  const tripType = String(params.tripType || params.trip_type || params['便種別'] || '').trim();
  const isMorning = (tripType === '登校' || tripType === 'morning');
  const rollCallType = String(params.rollCallType || params.roll_call_type || (isMorning ? 'boarded' : (params.isSchool ? 'boarded' : 'alighted'))).trim();
  const targetCol = (isMorning || rollCallType === 'boarded') ? morningBoardingCol : afternoonBoardingCol;

  const isBoarded = (params.boarded === true || params.boarded === 'true' || params.boarded === 1 || params.boarded === '1');
  const busStop = String(params.busStop || params.bus_stop || params['バス停'] || '').trim();

  // 時刻打刻値の生成（HH:mm）
  let boardingValue = '';
  if (isBoarded) {
    if (params.timeStr && /^\d{1,2}:\d{2}$/.test(String(params.timeStr).trim())) {
      boardingValue = String(params.timeStr).trim();
    } else {
      const d = new Date();
      const hh = ('0' + d.getHours()).slice(-2);
      const mm = ('0' + d.getMinutes()).slice(-2);
      boardingValue = hh + ':' + mm;
    }
  }

  const lastRow = sheet.getLastRow();
  let targetRow = -1;
  let currentId = null;

  // 既存行検索: 日付列 と 生徒名列
  if (lastRow >= 2) {
    const scanCols = Math.max(dateCol, studentCol);
    const dataRange = sheet.getRange(2, 1, lastRow - 1, scanCols);
    const rows = dataRange.getValues();
    for (let i = 0; i < rows.length; i++) {
      const rowDate = formatDateToSlash(rows[i][dateCol - 1]);
      const rowStudent = String(rows[i][studentCol - 1]).trim();
      if (rowDate === dateStr && rowStudent === studentName) {
        targetRow = i + 2;
        currentId = rows[i][0];
        break;
      }
    }
  }

  const currentDateTime = formatCurrentDateTimeJ();

  if (targetRow > 0) {
    // 既存行の該当乗車/降車時刻列を更新
    sheet.getRange(targetRow, targetCol).setValue(boardingValue);
    if (updatedAtCol > 0) {
      sheet.getRange(targetRow, updatedAtCol).setValue(currentDateTime);
    }

    clearAllScriptCaches();
    return {
      status: 'success',
      action: 'updated',
      sheet: matchedSheetName,
      row: targetRow,
      id: currentId,
      date: dateStr,
      studentName: studentName,
      tripType: isMorning ? '登校' : '下校',
      boarded: isBoarded,
      boardingValue: boardingValue,
      boarded_at: (isMorning || rollCallType === 'boarded') ? boardingValue : '',
      alighted_at: (!isMorning && rollCallType === 'alighted') ? boardingValue : '',
      rollCallType: rollCallType,
      message: isBoarded 
        ? (((isMorning || rollCallType === 'boarded') ? '乗車' : '降車') + '確認を記録しました: ' + boardingValue)
        : (((isMorning || rollCallType === 'boarded') ? '乗車' : '降車') + '確認を取り消しました')
    };
  } else {
    // 該当行がない場合（未予約日の臨時乗降時）
    const newRow = lastRow + 1;
    let newId = newRow - 1;
    if (lastRow >= 2) {
      const lastAValue = sheet.getRange(lastRow, 1).getValue();
      if (!isNaN(lastAValue) && Number(lastAValue) > 0) {
        newId = Number(lastAValue) + 1;
      }
    }

    // 保護者メールアドレスの自動補完検索
    let parentEmail = '';
    try {
      const gSheet = ss.getSheetByName('生徒・保護者マスター');
      if (gSheet && gSheet.getLastRow() >= 2) {
        const gData = gSheet.getRange(2, 1, gSheet.getLastRow() - 1, 5).getValues();
        for (let gi = 0; gi < gData.length; gi++) {
          const names = [gData[gi][1], gData[gi][2], gData[gi][3], gData[gi][4]].map(s => String(s || '').trim());
          if (names.includes(studentName)) {
            parentEmail = String(gData[gi][0] || '').trim().toLowerCase();
            break;
          }
        }
      }
    } catch (e) {}

    const maxColCount = Math.max(lastCol, morningBoardingCol, afternoonBoardingCol);
    const newRowData = new Array(maxColCount).fill('');
    newRowData[0] = newId;
    newRowData[dateCol - 1] = dateStr;
    newRowData[studentCol - 1] = studentName;
    newRowData[morningStatusCol - 1] = isMorning ? '乗る' : '';
    newRowData[8] = '運転手点呼自動作成'; // 備考
    if (updatedAtCol > 0) newRowData[updatedAtCol - 1] = currentDateTime;
    if (parentEmailCol > 0) newRowData[parentEmailCol - 1] = parentEmail;
    newRowData[targetCol - 1] = boardingValue;

    sheet.getRange(newRow, 1, 1, maxColCount).setValues([newRowData]);
    clearAllScriptCaches();

    return {
      status: 'success',
      action: 'inserted',
      sheet: matchedSheetName,
      row: newRow,
      id: newId,
      date: dateStr,
      studentName: studentName,
      tripType: isMorning ? '登校' : '下校',
      boarded: isBoarded,
      boardingValue: boardingValue,
      boarded_at: (isMorning || rollCallType === 'boarded') ? boardingValue : '',
      alighted_at: (!isMorning && rollCallType === 'alighted') ? boardingValue : '',
      rollCallType: rollCallType,
      message: isBoarded 
        ? (((isMorning || rollCallType === 'boarded') ? '乗車' : '降車') + '確認（新規作成）を記録しました: ' + boardingValue)
        : (((isMorning || rollCallType === 'boarded') ? '乗車' : '降車') + '確認を取り消しました')
    };
  }
}

/**
 * 4. 保護者・生徒データ取得（「生徒・保護者マスター」シート）
 * B〜E列（生徒名１〜４）から空でない生徒名を順次抽出
 */
function getGuardianDataFromSheet(email) {
  if (!email) {
    return { status: 'error', message: 'メールアドレスが指定されていません', found: false };
  }
  const cleanEmail = String(email).trim().toLowerCase();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('生徒・保護者マスター');
  if (!sheet) {
    return { status: 'error', message: '「生徒・保護者マスター」シートが見つかりません', found: false };
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { status: 'success', found: false, message: 'マスターにデータがありません' };
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  for (let i = 0; i < data.length; i++) {
    const rowEmail = String(data[i][0] || '').trim().toLowerCase();
    if (rowEmail === cleanEmail) {
      const s1 = String(data[i][1] || '').trim();
      const s2 = String(data[i][2] || '').trim();
      const s3 = String(data[i][3] || '').trim();
      const s4 = String(data[i][4] || '').trim();
      const students = [s1, s2, s3, s4].filter(s => s.length > 0);

      const busStop = String(data[i][5] || '高山研修所前').trim();
      const memo = String(data[i][6] || '').trim();
      const defaultToSchool = String(data[i][7] || '乗る').trim();
      const defaultFromSchool = String(data[i][8] || '1便').trim();

      return {
        status: 'success',
        found: true,
        data: {
          parentEmail: cleanEmail,
          students: students,
          student1: s1,
          student2: s2,
          student3: s3,
          student4: s4,
          busStop: busStop,
          memo: memo,
          defaultToSchool: defaultToSchool,
          defaultFromSchool: defaultFromSchool,
          '保護者メールアドレス': cleanEmail,
          '生徒名１': s1,
          '生徒名２': s2,
          '生徒名３': s3,
          '生徒名４': s4,
          '登録バス停名': busStop,
          '備考': memo,
          '基本_登校': defaultToSchool,
          '基本_下校': defaultFromSchool
        }
      };
    }
  }

  return { status: 'success', found: false, message: '該当する保護者が見つかりません' };
}

/**
 * 5. 「生徒・保護者マスター」全行一覧取得
 */
function getGuardianMasterFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('生徒・保護者マスター');
  if (!sheet) return { status: 'success', data: [] };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'success', data: [] };

  const numCols = Math.max(sheet.getLastColumn(), 10);
  const data = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
  const results = [];
  for (let i = 0; i < data.length; i++) {
    const email = String(data[i][0] || '').trim().toLowerCase();
    const s1 = String(data[i][1] || '').trim();
    const s2 = String(data[i][2] || '').trim();
    const s3 = String(data[i][3] || '').trim();
    const s4 = String(data[i][4] || '').trim();
    const busStop = String(data[i][5] || '').trim();
    const memo = String(data[i][6] || '').trim();
    const toSchool = String(data[i][7] || '').trim();
    const fromSchool = String(data[i][8] || '').trim();
    const authCode = String(data[i][9] || '').trim();

    const names = [s1, s2, s3, s4].filter(Boolean);

    results.push({
      email: email,
      parent_email: email,
      student_names: names,
      student_name_1: s1,
      student_name_2: s2 || null,
      student_name_3: s3 || null,
      student_name_4: s4 || null,
      bus_stop_name: busStop,
      note: memo || null,
      default_morning: toSchool,
      default_afternoon: fromSchool,
      auth_code: authCode,
      '保護者メールアドレス': email,
      '生徒名１': s1,
      '生徒名２': s2,
      '生徒名３': s3,
      '生徒名４': s4,
      '登録バス停名': busStop,
      '備考': memo,
      '基本_登校': toSchool,
      '基本_下校': fromSchool,
      '認証コード': authCode
    });
  }
  return { status: 'success', data: results };
}

/**
 * 6. 「生徒・保護者マスター」への保存・更新
 */
function saveGuardianMasterToSheet(params) {
  const email = String(params.parentEmail || params.email || params['保護者メールアドレス'] || '').trim().toLowerCase();
  const authCode = String(params.auth_code || params.code || params['認証コード'] || '').trim();

  if (!email && !authCode) {
    return { status: 'error', success: false, message: 'メールアドレスまたは認証コードが必要です' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('生徒・保護者マスター');
  if (!sheet) {
    sheet = ss.insertSheet('生徒・保護者マスター');
    sheet.appendRow([
      '保護者メールアドレス', '生徒名１', '生徒名２', '生徒名３', '生徒名４',
      '登録バス停名', '備考', '基本_登校', '基本_下校', '認証コード'
    ]);
  }

  const s1 = String(params.student1 || params.student_name_1 || params['生徒名１'] || '').trim();
  const s2 = String(params.student2 || params.student_name_2 || params['生徒名２'] || '').trim();
  const s3 = String(params.student3 || params.student_name_3 || params['生徒名３'] || '').trim();
  const s4 = String(params.student4 || params.student_name_4 || params['生徒名４'] || '').trim();
  const busStop = String(params.busStop || params.bus_stop_name || params['登録バス停名'] || '高山研修所前').trim();
  const memo = String(params.memo || params.note || params['備考'] || '').trim();
  const toSchool = String(params.defaultToSchool || params.default_morning || params['基本_登校'] || '乗る').trim();
  const fromSchool = String(params.defaultFromSchool || params.default_afternoon || params['基本_下校'] || '1便').trim();

  const lastRow = sheet.getLastRow();
  let targetRow = -1;

  if (lastRow >= 2) {
    const numCols = Math.max(sheet.getLastColumn(), 10);
    const data = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
    for (let i = 0; i < data.length; i++) {
      const rowEmail = String(data[i][0] || '').trim().toLowerCase();
      const rowCode = String(data[i][9] || '').trim();
      if (email && rowEmail === email) {
        targetRow = i + 2;
        break;
      } else if (!email && authCode && rowCode.toUpperCase() === authCode.toUpperCase()) {
        targetRow = i + 2;
        break;
      }
    }
  }

  if (targetRow > 0) {
    let existingCode = '';
    if (sheet.getLastColumn() >= 10) {
      existingCode = String(sheet.getRange(targetRow, 10).getValue() || '').trim();
    }
    const finalCode = authCode || existingCode;

    sheet.getRange(targetRow, 1, 1, 10).setValues([[
      email, s1, s2, s3, s4, busStop, memo, toSchool, fromSchool, finalCode
    ]]);
    SpreadsheetApp.flush();
    clearAllScriptCaches();
    return { status: 'success', success: true, action: 'updated', row: targetRow, message: '保護者マスターを更新しました' };
  } else {
    sheet.appendRow([email, s1, s2, s3, s4, busStop, memo, toSchool, fromSchool, authCode]);
    SpreadsheetApp.flush();
    clearAllScriptCaches();
    return { status: 'success', success: true, action: 'inserted', row: sheet.getLastRow(), message: '保護者マスターに新規登録しました' };
  }
}

/**
 * 6-2. 新入生・新規生徒の事前登録＆認証コード発行（管理者限定 action: "registerNewStudentWithCode"）
 */
function registerNewStudentWithCodeToSheet(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('生徒・保護者マスター');
  if (!sheet) {
    sheet = ss.insertSheet('生徒・保護者マスター');
    sheet.appendRow([
      '保護者メールアドレス', '生徒名１', '生徒名２', '生徒名３', '生徒名４',
      '登録バス停名', '備考', '基本_登校', '基本_下校', '認証コード'
    ]);
  }

  const s1 = String(params.student_name || params.student_name_1 || params['生徒名１'] || '').trim();
  if (!s1) {
    return { status: 'error', success: false, message: '生徒名（第1子）が必要です' };
  }
  const s2 = String(params.student_name_2 || params['生徒名２'] || '').trim();
  const s3 = String(params.student_name_3 || params['生徒名３'] || '').trim();
  const s4 = String(params.student_name_4 || params['生徒名４'] || '').trim();
  const busStop = String(params.bus_stop_name || params.busStop || '高山研修所前').trim();
  const note = String(params.note || params.memo || '').trim();
  const defMorning = String(params.default_morning || params.defaultToSchool || '乗る').trim();
  const defAfternoon = String(params.default_afternoon || params.defaultFromSchool || '1便').trim();

  // ランダムな認証コード生成（例: SB-XXXX）
  const randNum = Math.floor(1000 + Math.random() * 9000);
  const authCode = `SB-${randNum}`;

  sheet.appendRow(['', s1, s2, s3, s4, busStop, note, defMorning, defAfternoon, authCode]);
  SpreadsheetApp.flush();
  clearAllScriptCaches();

  return {
    status: 'success',
    success: true,
    code: authCode,
    auth_code: authCode,
    student_name: s1,
    message: `新入生「${s1}」を事前登録し、認証コード【${authCode}】を発行しました`
  };
}

/**
 * 6-3. 保護者アカウントと生徒の認証コード連携・兄弟追加統合（action: "linkStudentWithCode"）
 * 
 * 1. 認証コード（code）に一致する行（ソース行）を「生徒・保護者マスター」から検索
 * 2. ソース行から生徒名（B列、または未連携の全生徒名）を取得
 * 3. 保護者メール（email）に一致するターゲット世帯行を検索
 * 4. ターゲット行の空いている列（C列、D列、E列）の順に生徒名を追加
 * 5. ソース行がターゲット行と異なる独立行の場合、ソース行を自動削除（マージ統合）
 * 6. 更新後の生徒名配列 student_names、追加された生徒名 student_name を返却
 */
function linkStudentWithCodeToSheet(params) {
  const email = String(params.email || params.parent_email || params.parentEmail || '').trim().toLowerCase();
  const rawCode = String(params.code || params.auth_code || params.authCode || '').trim();

  if (!rawCode) {
    return { status: 'error', success: false, message: '認証コードが指定されていません' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('生徒・保護者マスター');
  if (!sheet) {
    return { status: 'error', success: false, message: '「生徒・保護者マスター」シートが見つかりません' };
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { status: 'error', success: false, message: 'マスターにデータがありません' };
  }

  const numCols = Math.max(sheet.getLastColumn(), 10);
  const data = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();

  const normalizeCode = function(c) { return String(c || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase(); };
  const targetCodeNorm = normalizeCode(rawCode);

  let sourceRowIdx = -1;
  let sourceStudentNames = [];

  for (let i = 0; i < data.length; i++) {
    const rowCode = String(data[i][9] || '').trim();
    if (rowCode && (rowCode.toUpperCase() === rawCode.toUpperCase() || normalizeCode(rowCode) === targetCodeNorm)) {
      sourceRowIdx = i + 2;
      const s1 = String(data[i][1] || '').trim();
      const s2 = String(data[i][2] || '').trim();
      const s3 = String(data[i][3] || '').trim();
      const s4 = String(data[i][4] || '').trim();
      sourceStudentNames = [s1, s2, s3, s4].filter(Boolean);
      break;
    }
  }

  if (sourceRowIdx < 0 || sourceStudentNames.length === 0) {
    return { status: 'error', success: false, message: '指定された認証コードのお子様が見つかりませんでした' };
  }

  const studentNameToAdd = sourceStudentNames[0];

  // メールアドレスが指定されている場合、既存の保護者世帯行を検索
  let targetRowIdx = -1;
  if (email) {
    for (let i = 0; i < data.length; i++) {
      const rowEmail = String(data[i][0] || '').trim().toLowerCase();
      if (rowEmail === email) {
        targetRowIdx = i + 2;
        break;
      }
    }
  }

  // もしターゲット行が見つからない場合、またはソース行自身の場合（初回ログイン連携）
  if (targetRowIdx < 0 || targetRowIdx === sourceRowIdx) {
    if (email) {
      sheet.getRange(sourceRowIdx, 1).setValue(email);
    }
    SpreadsheetApp.flush();
    return {
      status: 'success',
      success: true,
      action: 'linked_primary',
      student_name: studentNameToAdd,
      student_names: sourceStudentNames,
      message: 'お子様「' + studentNameToAdd + '」を保護者アカウントに連携しました'
    };
  }

  // ターゲット世帯行が存在する場合（兄弟追加統合）
  const targetDataRow = sheet.getRange(targetRowIdx, 1, 1, 9).getValues()[0];
  let curS1 = String(targetDataRow[1] || '').trim();
  let curS2 = String(targetDataRow[2] || '').trim();
  let curS3 = String(targetDataRow[3] || '').trim();
  let curS4 = String(targetDataRow[4] || '').trim();

  const currentNames = [curS1, curS2, curS3, curS4].filter(Boolean);

  // 既に登録済みかチェック
  if (currentNames.includes(studentNameToAdd)) {
    return {
      status: 'success',
      success: true,
      action: 'already_exists',
      student_name: studentNameToAdd,
      student_names: currentNames,
      message: 'お子様「' + studentNameToAdd + '」は既に登録されています'
    };
  }

  // 空いている列（C列=列3, D列=列4, E列=列5）の順に配置
  if (!curS2) {
    curS2 = studentNameToAdd;
  } else if (!curS3) {
    curS3 = studentNameToAdd;
  } else if (!curS4) {
    curS4 = studentNameToAdd;
  } else {
    return { status: 'error', success: false, message: '兄弟は最大4名までしか登録できません' };
  }

  // ターゲット行の生徒列（B〜E列）を更新
  sheet.getRange(targetRowIdx, 2, 1, 4).setValues([[curS1, curS2, curS3, curS4]]);

  // ソース行を削除（統合元の独立行が存在する場合）
  if (sourceRowIdx > 0 && sourceRowIdx !== targetRowIdx) {
    sheet.deleteRow(sourceRowIdx);
  }

  SpreadsheetApp.flush();
  clearAllScriptCaches();

  const updatedNames = [curS1, curS2, curS3, curS4].filter(Boolean);
  return {
    status: 'success',
    success: true,
    action: 'merged_sibling',
    student_name: studentNameToAdd,
    student_names: updatedNames,
    message: 'ご兄弟「' + studentNameToAdd + '」を同一世帯に統合しました'
  };
}

/**
 * 6-4. 生徒・保護者マスターの行削除（action: "deleteGuardianMaster"）
 */
function deleteGuardianMasterFromSheet(params) {
  const email = String(params.parent_email || params.email || params.parentEmail || '').trim().toLowerCase();
  const code = String(params.auth_code || params.code || '').trim();
  const studentName = String(params.student_name || '').trim();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('生徒・保護者マスター');
  if (!sheet) return { status: 'error', success: false, message: '「生徒・保護者マスター」シートが存在しません' };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'error', success: false, message: '削除対象のデータがありません' };

  const numCols = Math.max(sheet.getLastColumn(), 10);
  const data = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();

  for (let i = 0; i < data.length; i++) {
    const rowEmail = String(data[i][0] || '').trim().toLowerCase();
    const rowCode = String(data[i][9] || '').trim();
    const s1 = String(data[i][1] || '').trim();
    const s2 = String(data[i][2] || '').trim();
    const s3 = String(data[i][3] || '').trim();
    const s4 = String(data[i][4] || '').trim();
    const names = [s1, s2, s3, s4].filter(Boolean);

    let match = false;
    if (email && rowEmail === email) match = true;
    else if (code && rowCode.toUpperCase() === code.toUpperCase()) match = true;
    else if (studentName && names.includes(studentName)) match = true;

    if (match) {
      sheet.deleteRow(i + 2);
      SpreadsheetApp.flush();
      clearAllScriptCaches();
      return {
        status: 'success',
        success: true,
        message: '世帯データを削除しました'
      };
    }
  }

  return { status: 'error', success: false, message: '削除対象の世帯データが見つかりませんでした' };
}


/**
 * 7. バス停一覧取得（「バス停マスタ」）
 */
function getBusStopsFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('バス停マスタ');
  if (!sheet) return { status: 'success', data: [] };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'success', data: [] };

  const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  const results = [];
  for (let i = 0; i < values.length; i++) {
    results.push({
      stop_name: String(values[i][0] || '').trim(),
      address: String(values[i][1] || '').trim(),
      arrival_time_morning: formatTimeToHHmmGAS(values[i][2]),
      order_index: Number(values[i][3] || i + 1),
      'バス停名': String(values[i][0] || '').trim(),
      '住所': String(values[i][1] || '').trim(),
      '到着予定時刻（登校便）': formatTimeToHHmmGAS(values[i][2]),
      '停車順序': values[i][3]
    });
  }
  return { status: 'success', data: results };
}

/**
 * シート名「基本設定・運休期間」または「基本・運休期間」の安全な取得
 */
function getBasicSettingsSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName('基本設定・運休期間') || ss.getSheetByName('基本・運休期間');
}

/**
 * Google公式カレンダーから日本の国民の祝日・振替休日を自動取得
 */
function getGoogleOfficialHolidays(targetYear) {
  const holidays = [];
  try {
    const calendar = CalendarApp.getCalendarById('japanese__ja@holiday.calendar.google.com');
    if (!calendar) return holidays;

    const baseYear = Number(targetYear) || new Date().getFullYear();
    // 前年・当年・翌年の3年分を網羅して取得
    const startDate = new Date(baseYear - 1, 0, 1);
    const endDate = new Date(baseYear + 2, 0, 1);

    const events = calendar.getEvents(startDate, endDate);
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const d = ev.getStartTime();
      const yyyy = d.getFullYear();
      const mm = ('0' + (d.getMonth() + 1)).slice(-2);
      const dd = ('0' + d.getDate()).slice(-2);
      const dateIso = yyyy + '-' + mm + '-' + dd;
      const dateSlash = yyyy + '/' + mm + '/' + dd;
      holidays.push({
        date: dateIso,
        date_slash: dateSlash,
        title: ev.getTitle()
      });
    }
  } catch (e) {
    Logger.log('Google祝日カレンダー取得エラー: ' + e.toString());
  }
  return holidays;
}

/**
 * 8. 基本設定・運休期間一覧取得
 */
function getBasicSettingsFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getBasicSettingsSheet(ss);
  if (!sheet) return { status: 'success', data: [] };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'success', data: [] };

  const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  const results = [];
  for (let i = 0; i < values.length; i++) {
    results.push({
      setting_name: String(values[i][0] || '').trim(),
      start_date: formatDateToSlash(values[i][1]),
      end_date: formatDateToSlash(values[i][2]),
      standard_operation: String(values[i][3] || '').trim(),
      content_time: String(values[i][4] || '').trim(),
      note: String(values[i][5] || '').trim(),
      '設定名': String(values[i][0] || '').trim(),
      '開始日': formatDateToSlash(values[i][1]),
      '終了日': formatDateToSlash(values[i][2]),
      '標準運行': String(values[i][3] || '').trim(),
      '内容・時刻': String(values[i][4] || '').trim(),
      '備考': String(values[i][5] || '').trim()
    });
  }
  return { status: 'success', data: results };
}

/**
 * 9. 学校用時刻表一覧取得
 */
function getSchoolTimetableFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('学校用時刻表');
  if (!sheet) return { status: 'success', data: [] };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'success', data: [] };

  const values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  const results = [];
  for (let i = 0; i < values.length; i++) {
    const morningTrip = formatTimeToHHmmGAS(values[i][1]);
    const trip1 = formatTimeToHHmmGAS(values[i][2]);
    const trip2 = formatTimeToHHmmGAS(values[i][3]);
    const trip3 = formatTimeToHHmmGAS(values[i][4]);
    const note = String(values[i][5] || '').trim();
    const calDisplay = String(values[i][6] || '').trim();
    const dateFormatted = formatDateToSlash(values[i][0]);

    results.push({
      date: dateFormatted,
      morning_trip: morningTrip,
      trip_1: trip1,
      trip_2: trip2,
      trip_3: trip3,
      note: note,
      calendar_display: calDisplay,
      '日付': dateFormatted,
      '登校便': morningTrip,
      '下校1便': trip1,
      '下校2便': trip2,
      '下校3便': trip3,
      '備考': note,
      'カレンダー表示用': calDisplay
    });
  }
  return { status: 'success', data: results };
}

/**
 * 10. ユーザー権限マスタ一覧取得
 */
function getUserPermissionsFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('ユーザー権限マスタ');
  if (!sheet) return { status: 'success', data: [] };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'success', data: [] };

  const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  const results = [];
  for (let i = 0; i < values.length; i++) {
    results.push({
      email: String(values[i][0] || '').trim().toLowerCase(),
      name: String(values[i][1] || '').trim(),
      role: String(values[i][2] || '').trim(),
      'メールアドレス': String(values[i][0] || '').trim().toLowerCase(),
      '指名': String(values[i][1] || '').trim(),
      '役割': String(values[i][2] || '').trim()
    });
  }
  return { status: 'success', data: results };
}

/**
 * 11. 生徒照合
 */
function verifyStudentInSheet(code, email) {
  if (email) return getGuardianDataFromSheet(email);
  return getGuardianDataFromSheet(code);
}

/**
 * 12. 全6シートマスタ一括完全取得（Google公式祝日も自動同梱 ＆ CacheService高速化対応）
 * params.force === 'true' の場合は ScriptCache を全消去してスプレッドシートから強制最新取得
 */
function getAllMasterFromSheet(params) {
  const isForce = params && (params.force === 'true' || params.force === true);
  if (isForce) {
    console.log('[getAllMaster] Force refresh requested. Clearing all script caches...');
    clearAllScriptCaches();
  }

  // 1. 生徒・保護者マスター
  let guardianMaster = !isForce ? getScriptCacheItem(CACHE_KEYS.GUARDIAN_MASTER) : null;
  if (!guardianMaster) {
    const res = getGuardianMasterFromSheet();
    guardianMaster = res.data || [];
    setScriptCacheItem(CACHE_KEYS.GUARDIAN_MASTER, guardianMaster);
  }

  // 2. バス停マスタ
  let busStops = !isForce ? getScriptCacheItem(CACHE_KEYS.BUS_STOPS) : null;
  if (!busStops) {
    const res = getBusStopsFromSheet();
    busStops = res.data || [];
    setScriptCacheItem(CACHE_KEYS.BUS_STOPS, busStops);
  }

  // 3. 運行予定カレンダー（前月・当月・翌月の3ヶ月に絞り込み取得）
  let schedules = !isForce ? getScriptCacheItem(CACHE_KEYS.SCHEDULES) : null;
  if (!schedules) {
    const res = getSchedulesFromSheet('', { all: false });
    schedules = res.data || [];
    setScriptCacheItem(CACHE_KEYS.SCHEDULES, schedules);
  }

  // 4. 基本設定・運休期間
  let basicSettings = !isForce ? getScriptCacheItem(CACHE_KEYS.BASIC_SETTINGS) : null;
  if (!basicSettings) {
    const res = getBasicSettingsFromSheet();
    basicSettings = res.data || [];
    setScriptCacheItem(CACHE_KEYS.BASIC_SETTINGS, basicSettings);
  }

  // 5. 学校用時刻表
  let schoolTimetable = !isForce ? getScriptCacheItem(CACHE_KEYS.SCHOOL_TIMETABLE) : null;
  if (!schoolTimetable) {
    const res = getSchoolTimetableFromSheet();
    schoolTimetable = res.data || [];
    setScriptCacheItem(CACHE_KEYS.SCHOOL_TIMETABLE, schoolTimetable);
  }

  // 6. ユーザー権限マスタ
  let userPermissions = !isForce ? getScriptCacheItem(CACHE_KEYS.USER_PERMISSIONS) : null;
  if (!userPermissions) {
    const res = getUserPermissionsFromSheet();
    userPermissions = res.data || [];
    setScriptCacheItem(CACHE_KEYS.USER_PERMISSIONS, userPermissions);
  }

  // 7. Google公式祝日（キャッシュ期間: 24時間）
  const currentYear = new Date().getFullYear();
  const holidaysKey = CACHE_KEYS.HOLIDAYS + '_' + currentYear;
  let holidays = !isForce ? getScriptCacheItem(holidaysKey) : null;
  if (!holidays) {
    holidays = getGoogleOfficialHolidays(currentYear);
    setScriptCacheItem(holidaysKey, holidays, 86400);
  }

  return {
    status: 'success',
    guardianMaster: guardianMaster,
    busStops: busStops,
    schedules: schedules,
    basicSettings: basicSettings,
    schoolTimetable: schoolTimetable,
    userPermissions: userPermissions,
    holidays: holidays,
    // 日本語キー互換
    '生徒・保護者マスター': guardianMaster,
    'バス停マスタ': busStops,
    '運行予定カレンダー': schedules,
    '基本設定・運休期間': basicSettings,
    '基本・運休期間': basicSettings,
    '学校用時刻表': schoolTimetable,
    'ユーザー権限マスタ': userPermissions
  };
}

/**
 * 13. 基本設定・運休期間の保存・更新（管理者限定）
 * A列（設定名）をキーに検索し、B〜F列（開始日、終了日、標準運行、内容・時刻、備考）を上書き更新
 */
function saveBasicSettingToSheet(params) {
  const settingName = String(params.setting_name || params.settingName || params['設定名'] || '').trim();
  if (!settingName) {
    return { status: 'error', message: '設定名（A列）が指定されていません' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = getBasicSettingsSheet(ss);
  if (!sheet) {
    sheet = ss.insertSheet('基本設定・運休期間');
    sheet.appendRow(['設定名', '開始日', '終了日', '標準運行', '内容・時刻', '備考']);
  }

  const startDate = formatDateToSlash(params.start_date || params.startDate || params['開始日'] || '');
  const endDate = formatDateToSlash(params.end_date || params.endDate || params['終了日'] || '');
  const standardOperation = String(params.standard_operation || params.standardOperation || params['標準運行'] || '').trim();
  const contentTime = String(params.content_time || params.contentTime || params['内容・時刻'] || '').trim();
  const note = String(params.note || params['備考'] || '').trim();

  // MM/DD 形式（年なし）の場合はスプレッドシートが勝手に今年日付へ自動変換するのを防ぐため、文字列として格納
  const writeStart = startDate.split('/').length === 2 ? "'" + startDate : startDate;
  const writeEnd = endDate.split('/').length === 2 ? "'" + endDate : endDate;

  const lastRow = sheet.getLastRow();
  let targetRow = -1;

  if (lastRow >= 2) {
    const names = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < names.length; i++) {
      if (String(names[i][0]).trim() === settingName) {
        targetRow = i + 2;
        break;
      }
    }
  }

  if (targetRow > 0) {
    // B列〜F列（列2〜6）の5項目を上書き更新
    sheet.getRange(targetRow, 2, 1, 5).setValues([[
      writeStart,
      writeEnd,
      standardOperation,
      contentTime,
      note
    ]]);
    SpreadsheetApp.flush();
    clearAllScriptCaches();
    return {
      status: 'success',
      message: '基本設定を更新しました',
      action: 'updated',
      row: targetRow,
      setting_name: settingName
    };
  } else {
    // 存在しない場合は新規追加
    sheet.appendRow([settingName, writeStart, writeEnd, standardOperation, contentTime, note]);
    SpreadsheetApp.flush();
    clearAllScriptCaches();
    return {
      status: 'success',
      message: '基本設定を新規追加しました',
      action: 'inserted',
      row: sheet.getLastRow(),
      setting_name: settingName
    };
  }
}

/**
 * 13-2. 月間時刻表の確定・公開ステータス保存（管理者限定）
 * A列（設定名）に「時刻表公開_YYYY/MM」および「PUBLISH_YYYY/MM」として保存
 */
function saveMonthPublishStatusToSheet(params) {
  const ymRaw = String(params.yearMonth || params.year_month || params.month || '').trim().replace(/-/g, '/');
  if (!ymRaw) {
    return { status: 'error', message: '対象年月（yearMonth）が指定されていません' };
  }
  const parts = ymRaw.split('/');
  if (parts.length < 2) {
    return { status: 'error', message: '対象年月形式が不正です（例: 2026/09）' };
  }
  const year = parts[0];
  const month = ('0' + parts[1]).slice(-2);
  const yearMonth = year + '/' + month;
  const settingName = '時刻表公開_' + yearMonth;
  const publishKey = 'PUBLISH_' + yearMonth;

  const isPublished = (params.isPublished === true || params.isPublished === 'true' || params.published === true || params.published === 'true');
  const standardOperation = isPublished ? '公開' : '非公開';
  const contentTime = isPublished ? '確定済' : '未確定';
  const note = isPublished ? '予約受付中' : '時刻表調整中・ロック';
  const startDate = yearMonth + '/01';
  const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
  const endDate = yearMonth + '/' + ('0' + daysInMonth).slice(-2);

  // 時刻表公開_YYYY/MM を保存/更新
  const res1 = saveBasicSettingToSheet({
    setting_name: settingName,
    start_date: startDate,
    end_date: endDate,
    standard_operation: standardOperation,
    content_time: contentTime,
    note: note
  });

  // PUBLISH_YYYY/MM も保存/更新して互換性を完全保証
  saveBasicSettingToSheet({
    setting_name: publishKey,
    start_date: startDate,
    end_date: endDate,
    standard_operation: standardOperation,
    content_time: contentTime,
    note: note
  });

  SpreadsheetApp.flush();

  return {
    status: res1.status,
    message: isPublished ? `${yearMonth} の時刻表を「確定・公開（予約受付中）」に設定しました` : `${yearMonth} の時刻表を「未確定（予約ロック）」に戻しました`,
    yearMonth: yearMonth,
    isPublished: isPublished
  };
}

/**
 * 13-3. 月間時刻表の確定・公開ステータス取得
 */
function getMonthPublishStatusFromSheet(params) {
  const res = getBasicSettingsFromSheet();
  const settings = res.data || [];
  const ymRaw = String(params && (params.yearMonth || params.year_month || params.month || '')).trim().replace(/-/g, '/');
  
  if (ymRaw) {
    const parts = ymRaw.split('/');
    const yearMonth = parts[0] + '/' + ('0' + parts[1]).slice(-2);
    const targetKey1 = '時刻表公開_' + yearMonth;
    const targetKey2 = 'PUBLISH_' + yearMonth;
    const found = settings.find(function(b) {
      return b.setting_name === targetKey1 || b.setting_name === targetKey2;
    });
    const isPub = !!(found && (
      found.standard_operation === '公開' ||
      found.standard_operation === 'publish' ||
      found.content_time === '確定済' ||
      found.content_time === '確定' ||
      (found.note && found.note.indexOf('予約受付中') !== -1)
    ));
    return {
      status: 'success',
      yearMonth: yearMonth,
      isPublished: isPub,
      setting: found || null
    };
  }

  const map = {};
  for (let i = 0; i < settings.length; i++) {
    const s = settings[i];
    if (!s || !s.setting_name) continue;
    let ym = '';
    if (s.setting_name.indexOf('時刻表公開_') === 0) {
      ym = s.setting_name.replace('時刻表公開_', '');
    } else if (s.setting_name.indexOf('PUBLISH_') === 0) {
      ym = s.setting_name.replace('PUBLISH_', '');
    }
    if (ym) {
      const isPub = (
        s.standard_operation === '公開' ||
        s.standard_operation === 'publish' ||
        s.content_time === '確定済' ||
        s.content_time === '確定' ||
        (s.note && s.note.indexOf('予約受付中') !== -1)
      );
      map[ym] = isPub;
    }
  }
  return { status: 'success', publishStatuses: map };
}

/**
 * 14. 学校用時刻表の保存・更新（管理者限定）
 * A列（日付: YYYY/MM/DD）をキーに検索し、B〜G列（登校便、下校1〜3便、備考、カレンダー表示用）を上書き更新
 */
function saveSchoolTimetableToSheet(params) {
  const dateStr = formatDateToSlash(params.date || params['日付'] || '');
  if (!dateStr) {
    return { status: 'error', message: '日付（A列）が指定されていません' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('学校用時刻表');
  if (!sheet) {
    sheet = ss.insertSheet('学校用時刻表');
    sheet.appendRow(['日付', '登校便', '下校1便', '下校2便', '下校3便', '備考', 'カレンダー表示用']);
  }

  const morningTrip = String(params.morning_trip || params['登校便'] || '').trim();
  const trip1 = String(params.afternoon_trip_1 || params.trip_1 || params['下校1便'] || '').trim();
  const trip2 = String(params.afternoon_trip_2 || params.trip_2 || params['下校2便'] || '').trim();
  const trip3 = String(params.afternoon_trip_3 || params.trip_3 || params['下校3便'] || '').trim();
  const note = String(params.note || params['備考'] || '').trim();
  const calendarDisplay = String(params.calendar_label || params.calendar_display || params['カレンダー表示用'] || '').trim();

  const lastRow = sheet.getLastRow();
  let targetRow = -1;

  if (lastRow >= 2) {
    const dates = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < dates.length; i++) {
      if (formatDateToSlash(dates[i][0]) === dateStr) {
        targetRow = i + 2;
        break;
      }
    }
  }

  if (targetRow > 0) {
    sheet.getRange(targetRow, 2, 1, 6).setValues([[
      morningTrip,
      trip1,
      trip2,
      trip3,
      note,
      calendarDisplay
    ]]);
    clearAllScriptCaches();
    return {
      status: 'success',
      message: '学校用時刻表を更新しました',
      action: 'updated',
      row: targetRow,
      date: dateStr
    };
  } else {
    sheet.appendRow([dateStr, morningTrip, trip1, trip2, trip3, note, calendarDisplay]);
    clearAllScriptCaches();
    return {
      status: 'success',
      message: '学校用時刻表に新規追加しました',
      action: 'inserted',
      row: sheet.getLastRow(),
      date: dateStr
    };
  }
}

/**
 * 14-2. 学校用時刻表の月間一括保存・更新（管理者限定）
 * A列（日付: YYYY/MM/DD）をキーに既存行を更新、未存在行は新規追加
 */
function saveBatchSchoolTimetableToSheet(params) {
  const timetables = params.timetables || params.entries || params.data || (Array.isArray(params) ? params : []);
  if (!Array.isArray(timetables) || timetables.length === 0) {
    return { status: 'success', count: 0, message: '更新対象のデータがありません' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('学校用時刻表');
  if (!sheet) {
    sheet = ss.insertSheet('学校用時刻表');
    sheet.appendRow(['日付', '登校便', '下校1便', '下校2便', '下校3便', '備考', 'カレンダー表示用']);
  }

  const lastRow = sheet.getLastRow();
  // 既存データ（A列の日付）をインデックス化
  const existingMap = new Map();
  if (lastRow >= 2) {
    const dates = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < dates.length; i++) {
      const dStr = formatDateToSlash(dates[i][0]);
      if (dStr) {
        existingMap.set(dStr, i + 2); // 1-based 行番号
      }
    }
  }

  let updatedCount = 0;
  let insertedCount = 0;

  if (lastRow >= 2) {
    const fullRange = sheet.getRange(2, 1, lastRow - 1, 7);
    const fullValues = fullRange.getValues();
    const rowsToAdd = [];

    for (let i = 0; i < timetables.length; i++) {
      const item = timetables[i];
      const dateStr = formatDateToSlash(item.date || item['日付'] || '');
      if (!dateStr) continue;

      const morningTrip = formatTimeToHHmmGAS(item.morning_trip || item['登校便'] || '');
      const trip1 = formatTimeToHHmmGAS(item.afternoon_trip_1 || item.trip_1 || item['下校1便'] || '');
      const trip2 = formatTimeToHHmmGAS(item.afternoon_trip_2 || item.trip_2 || item['下校2便'] || '');
      const trip3 = formatTimeToHHmmGAS(item.afternoon_trip_3 || item.trip_3 || item['下校3便'] || '');
      const note = String(item.note || item['備考'] || '').trim();
      const calendarDisplay = String(item.calendar_label || item.calendar_display || item['カレンダー表示用'] || '').trim();

      const rowIndex = existingMap.get(dateStr);
      if (rowIndex !== undefined) {
        const idx = rowIndex - 2;
        fullValues[idx][1] = morningTrip;
        fullValues[idx][2] = trip1;
        fullValues[idx][3] = trip2;
        fullValues[idx][4] = trip3;
        fullValues[idx][5] = note;
        fullValues[idx][6] = calendarDisplay;
        updatedCount++;
      } else {
        rowsToAdd.push([dateStr, morningTrip, trip1, trip2, trip3, note, calendarDisplay]);
        existingMap.set(dateStr, lastRow + rowsToAdd.length);
        insertedCount++;
      }
    }

    fullRange.setValues(fullValues);
    if (rowsToAdd.length > 0) {
      sheet.getRange(lastRow + 1, 1, rowsToAdd.length, 7).setValues(rowsToAdd);
    }
  } else {
    const rowsToAdd = [];
    for (let i = 0; i < timetables.length; i++) {
      const item = timetables[i];
      const dateStr = formatDateToSlash(item.date || item['日付'] || '');
      if (!dateStr) continue;

      const morningTrip = formatTimeToHHmmGAS(item.morning_trip || item['登校便'] || '');
      const trip1 = formatTimeToHHmmGAS(item.afternoon_trip_1 || item.trip_1 || item['下校1便'] || '');
      const trip2 = formatTimeToHHmmGAS(item.afternoon_trip_2 || item.trip_2 || item['下校2便'] || '');
      const trip3 = formatTimeToHHmmGAS(item.afternoon_trip_3 || item.trip_3 || item['下校3便'] || '');
      const note = String(item.note || item['備考'] || '').trim();
      const calendarDisplay = String(item.calendar_label || item.calendar_display || item['カレンダー表示用'] || '').trim();

      rowsToAdd.push([dateStr, morningTrip, trip1, trip2, trip3, note, calendarDisplay]);
      insertedCount++;
    }
    if (rowsToAdd.length > 0) {
      sheet.getRange(2, 1, rowsToAdd.length, 7).setValues(rowsToAdd);
    }
  }

  SpreadsheetApp.flush();
  clearAllScriptCaches();

  const total = updatedCount + insertedCount;
  return {
    status: 'success',
    message: `${total}日分の時刻表を一括反映しました（更新: ${updatedCount}件, 新規: ${insertedCount}件）`,
    count: total,
    updatedCount: updatedCount,
    insertedCount: insertedCount
  };
}

/**
 * 15. バス停マスタの保存・更新・追加（管理者限定）
 * A列（バス停名）をキーに検索し、更新または新規追加
 */
function saveBusStopToSheet(params) {
  const name = String(params.name || params.bus_stop_name || params['バス停名'] || '').trim();
  const oldName = String(params.old_name || params.oldName || name).trim();
  if (!name) {
    return { status: 'error', message: 'バス停名（A列）が指定されていません' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('バス停マスタ');
  if (!sheet) {
    sheet = ss.insertSheet('バス停マスタ');
    sheet.appendRow(['バス停名', '住所', '到着予定時刻（登校便）', '停車順序']);
  }

  const address = String(params.address || params['住所'] || '').trim();
  const arrivalTime = formatTimeToHHmmGAS(params.arrival_time_morning || params.arrivalTime || params['到着予定時刻（登校便）'] || '');
  const order = Number(params.order || params.order_index || params['停車順序'] || 0);

  const lastRow = sheet.getLastRow();
  let targetRow = -1;

  if (lastRow >= 2) {
    const names = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < names.length; i++) {
      const rowName = String(names[i][0]).trim();
      if (rowName === oldName || rowName === name) {
        targetRow = i + 2;
        break;
      }
    }
  }

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, 4).setValues([[
      name,
      address,
      arrivalTime,
      order || (targetRow - 1)
    ]]);
    SpreadsheetApp.flush();
    clearAllScriptCaches();
    return {
      status: 'success',
      message: 'バス停マスタを更新しました',
      action: 'updated',
      row: targetRow,
      name: name
    };
  } else {
    const newOrder = order || (lastRow >= 2 ? lastRow : 1);
    sheet.appendRow([name, address, arrivalTime, newOrder]);
    SpreadsheetApp.flush();
    clearAllScriptCaches();
    return {
      status: 'success',
      message: 'バス停マスタに新規追加しました',
      action: 'inserted',
      row: sheet.getLastRow(),
      name: name
    };
  }
}

/**
 * 16. バス停マスタの削除（管理者限定）
 */
function deleteBusStopFromSheet(stopName) {
  const targetName = String(stopName || '').trim();
  if (!targetName) {
    return { status: 'error', message: '削除対象のバス停名が指定されていません' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('バス停マスタ');
  if (!sheet) return { status: 'error', message: 'バス停マスタシートが存在しません' };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'error', message: '削除対象のデータがありません' };

  const names = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < names.length; i++) {
    if (String(names[i][0]).trim() === targetName) {
      sheet.deleteRow(i + 2);
      SpreadsheetApp.flush();
      clearAllScriptCaches();
      return {
        status: 'success',
        message: `バス停「${targetName}」を削除しました`,
        name: targetName
      };
    }
  }

  return { status: 'error', message: `バス停「${targetName}」が見つかりませんでした` };
}


