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
      case 'recordBoarding':
        return createJsonResponse(recordBoardingToSheet(params));
      case 'getUserPermissions':
        return createJsonResponse(getUserPermissionsFromSheet());
      case 'verifyStudent':
        return createJsonResponse(verifyStudentInSheet(params.code, params.email));
      case 'getAllMaster':
        return createJsonResponse(getAllMasterFromSheet());
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
 * 日付文字列を確実に YYYY/MM/DD 形式に変換
 */
function formatDateToSlash(val) {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = ('0' + (val.getMonth() + 1)).slice(-2);
    const d = ('0' + val.getDate()).slice(-2);
    return y + '/' + m + '/' + d;
  }
  const str = String(val).trim().replace(/-/g, '/');
  const parts = str.split('/');
  if (parts.length === 3) {
    const y = parts[0];
    const m = ('0' + parts[1]).slice(-2);
    const d = ('0' + parts[2]).slice(-2);
    return y + '/' + m + '/' + d;
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
 * 3. 運行予定カレンダー一覧取得
 */
function getSchedulesFromSheet(email) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('運行予定カレンダー');
  if (!sheet) return { status: 'success', data: [] };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'success', data: [] };

  const numCols = Math.max(sheet.getLastColumn(), 13);
  const values = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
  const cleanEmail = email ? String(email).trim().toLowerCase() : '';

  const results = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowEmail = String(row[10] || '').trim().toLowerCase();
    if (cleanEmail && rowEmail && rowEmail !== cleanEmail) {
      continue;
    }

    const morningBoarding = String(row[11] || '').trim();
    const afternoonBoarding = String(row[12] || '').trim();

    results.push({
      'ID': row[0],
      '日付': formatDateToSlash(row[1]),
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
      afternoon_boarding: afternoonBoarding
    });
  }

  return { status: 'success', data: results };
}

/**
 * 3-B. 運転手による乗車確認の記録（点呼タップ連動）
 * パラメータ: date, studentName, tripType ('登校' | '下校'), boarded (true | false), busStop
 * 運行予定カレンダーシートの12列目（登校乗車確認）または13列目（下校乗車確認）に時刻を即時保存
 */
function recordBoardingToSheet(params) {
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
    if (sheet.getLastColumn() < 12 || !sheet.getRange(1, 12).getValue()) {
      sheet.getRange(1, 12).setValue('登校乗車確認');
    }
    if (sheet.getLastColumn() < 13 || !sheet.getRange(1, 13).getValue()) {
      sheet.getRange(1, 13).setValue('下校乗車確認');
    }
  }

  const dateStr = formatDateToSlash(params.date || params.rawDate);
  const studentName = String(params.studentName || params.student_name || params['生徒名'] || '').trim();
  const tripType = String(params.tripType || params.trip_type || params['便種別'] || '').trim();
  const isMorning = (tripType === '登校' || tripType === 'morning');
  const targetCol = isMorning ? 12 : 13; // 12: 登校乗車確認, 13: 下校乗車確認

  const isBoarded = (params.boarded === true || params.boarded === 'true' || params.boarded === 1 || params.boarded === '1');
  const busStop = String(params.busStop || params.bus_stop || params['バス停'] || '').trim();

  // 乗車時刻値の生成（HH:mm）
  let boardingValue = '';
  if (isBoarded) {
    const d = new Date();
    const hh = ('0' + d.getHours()).slice(-2);
    const mm = ('0' + d.getMinutes()).slice(-2);
    const timeStr = hh + ':' + mm;
    boardingValue = busStop ? (timeStr + ' (' + busStop + ')') : timeStr;
  }

  const lastRow = sheet.getLastRow();
  let targetRow = -1;
  let currentId = null;

  // 既存行検索: B列(日付) と C列(生徒名)
  if (lastRow >= 2) {
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 3);
    const rows = dataRange.getValues();
    for (let i = 0; i < rows.length; i++) {
      const rowDate = formatDateToSlash(rows[i][1]);
      const rowStudent = String(rows[i][2]).trim();
      if (rowDate === dateStr && rowStudent === studentName) {
        targetRow = i + 2;
        currentId = rows[i][0];
        break;
      }
    }
  }

  const currentDateTime = formatCurrentDateTimeJ();

  if (targetRow > 0) {
    // 既存行の該当乗車確認列をピンポイント更新
    sheet.getRange(targetRow, targetCol).setValue(boardingValue);
    sheet.getRange(targetRow, 10).setValue(currentDateTime); // J列: 更新日時

    return {
      status: 'success',
      action: 'updated',
      row: targetRow,
      id: currentId,
      date: dateStr,
      studentName: studentName,
      tripType: isMorning ? '登校' : '下校',
      boarded: isBoarded,
      boardingValue: boardingValue,
      message: isBoarded ? ('乗車確認を記録しました: ' + boardingValue) : '乗車確認を取り消しました'
    };
  } else {
    // 該当行がない場合（事前予約なしの当日臨時乗車等の安全策）
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

    const rowValues = [
      [
        newId,
        dateStr,
        studentName,
        isMorning ? '乗る' : '',
        '',
        '', '', '',
        '運転手点呼自動作成',
        currentDateTime,
        parentEmail,
        isMorning ? boardingValue : '',
        !isMorning ? boardingValue : ''
      ]
    ];
    sheet.getRange(newRow, 1, 1, 13).setValues(rowValues);

    return {
      status: 'success',
      action: 'inserted',
      row: newRow,
      id: newId,
      date: dateStr,
      studentName: studentName,
      tripType: isMorning ? '登校' : '下校',
      boarded: isBoarded,
      boardingValue: boardingValue,
      message: isBoarded ? ('乗車確認（新規作成）を記録しました: ' + boardingValue) : '乗車確認を取り消しました'
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
  if (!email) return { status: 'error', message: 'メールアドレスが必要です' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('生徒・保護者マスター');
  if (!sheet) {
    sheet = ss.insertSheet('生徒・保護者マスター');
    sheet.appendRow([
      '保護者メールアドレス', '生徒名１', '生徒名２', '生徒名３', '生徒名４',
      '登録バス停名', '備考', '基本_登校', '基本_下校'
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
    const emails = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < emails.length; i++) {
      if (String(emails[i][0]).trim().toLowerCase() === email) {
        targetRow = i + 2;
        break;
      }
    }
  }

  const rowValues = [[email, s1, s2, s3, s4, busStop, memo, toSchool, fromSchool]];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, 9).setValues(rowValues);
    return { status: 'success', action: 'updated', row: targetRow, message: '保護者マスターを更新しました' };
  } else {
    sheet.appendRow(rowValues[0]);
    return { status: 'success', action: 'inserted', row: sheet.getLastRow(), message: '保護者マスターに新規登録しました' };
  }
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
 * 8. 基本設定・運休期間一覧取得
 */
function getBasicSettingsFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('基本設定・運休期間');
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
 * 12. 全6シートマスタ一括完全取得
 */
function getAllMasterFromSheet() {
  const guardianMasterRes = getGuardianMasterFromSheet();
  const busStopsRes = getBusStopsFromSheet();
  const schedulesRes = getSchedulesFromSheet('');
  const basicSettingsRes = getBasicSettingsFromSheet();
  const schoolTimetableRes = getSchoolTimetableFromSheet();
  const userPermissionsRes = getUserPermissionsFromSheet();

  return {
    status: 'success',
    guardianMaster: guardianMasterRes.data || [],
    busStops: busStopsRes.data || [],
    schedules: schedulesRes.data || [],
    basicSettings: basicSettingsRes.data || [],
    schoolTimetable: schoolTimetableRes.data || [],
    userPermissions: userPermissionsRes.data || [],
    // 日本語キー互換
    '生徒・保護者マスター': guardianMasterRes.data || [],
    'バス停マスタ': busStopsRes.data || [],
    '運行予定カレンダー': schedulesRes.data || [],
    '基本設定・運休期間': basicSettingsRes.data || [],
    '学校用時刻表': schoolTimetableRes.data || [],
    'ユーザー権限マスタ': userPermissionsRes.data || []
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
  let sheet = ss.getSheetByName('基本設定・運休期間');
  if (!sheet) {
    sheet = ss.insertSheet('基本設定・運休期間');
    sheet.appendRow(['設定名', '開始日', '終了日', '標準運行', '内容・時刻', '備考']);
  }

  const startDate = formatDateToSlash(params.start_date || params.startDate || params['開始日'] || '');
  const endDate = formatDateToSlash(params.end_date || params.endDate || params['終了日'] || '');
  const standardOperation = String(params.standard_operation || params.standardOperation || params['標準運行'] || '').trim();
  const contentTime = String(params.content_time || params.contentTime || params['内容・時刻'] || '').trim();
  const note = String(params.note || params['備考'] || '').trim();

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
      startDate,
      endDate,
      standardOperation,
      contentTime,
      note
    ]]);
    SpreadsheetApp.flush();
    return {
      status: 'success',
      message: '基本設定を更新しました',
      action: 'updated',
      row: targetRow,
      setting_name: settingName
    };
  } else {
    // 存在しない場合は新規追加
    sheet.appendRow([settingName, startDate, endDate, standardOperation, contentTime, note]);
    SpreadsheetApp.flush();
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
    return {
      status: 'success',
      message: '学校用時刻表を更新しました',
      action: 'updated',
      row: targetRow,
      date: dateStr
    };
  } else {
    sheet.appendRow([dateStr, morningTrip, trip1, trip2, trip3, note, calendarDisplay]);
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
      return {
        status: 'success',
        message: `バス停「${targetName}」を削除しました`,
        name: targetName
      };
    }
  }

  return { status: 'error', message: `バス停「${targetName}」が見つかりませんでした` };
}


