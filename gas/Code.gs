/**
 * スクールバス運行管理システム - Google Apps Script (GAS) バックエンド完全版
 * 
 * 【スプレッドシート「運行予定カレンダー」確定列定義】
 * A列: ID（行番号から1を引いた通し番号数値。例: データ先頭行[2行目]は 1、3行目は 2...）
 * B列: 日付（YYYY/MM/DD 形式。※スラッシュ区切り）
 * C列: 生徒名（選択された生徒氏名）
 * D列: 登校ステータス（「乗る」、または空文字 ""）
 * E列: 下校ステータス（乗らない場合のみ「乗らない」、下校便に乗る場合は空文字 ""）
 * F列: 下校1便（選択時の運行時刻 例: "15:30" 等、または空文字 ""）
 * G列: 下校2便（選択時の運行時刻 例: "16:30" 等、または空文字 ""）
 * H列: 下校3便（選択時の運行時刻 例: "17:30" 等、または空文字 ""）
 * I列: 備考（備考文字列、または空文字 ""）
 * J列: 更新日時（YYYY/MM/DD HH:mm:ss）
 * K列: 保護者メールアドレス
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
        return createJsonResponse(saveReservationToSheet(params));
      case 'saveBatchSchedules':
        return createJsonResponse(saveBatchSchedulesToSheet(params.schedules || params.reservations || []));
      case 'getSchedules':
        return createJsonResponse(getSchedulesFromSheet(params.email));
      case 'getGuardianData':
        return createJsonResponse(getGuardianDataFromSheet(params.email || params.parentEmail));
      case 'saveGuardianMaster':
        return createJsonResponse(saveGuardianMasterToSheet(params));
      case 'getBusStops':
        return createJsonResponse(getBusStopsFromSheet());
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
 */
function saveReservationToSheet(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = data.sheetName || '運行予定カレンダー';
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow([
      'ID', '日付', '生徒名', '登校ステータス', '下校ステータス',
      '下校1便', '下校2便', '下校3便', '備考', '更新日時', '保護者メールアドレス'
    ]);
  }

  // B列: 日付 (YYYY/MM/DD)
  const dateStr = formatDateToSlash(data.date || data['日付'] || data.rawDate);
  const studentName = String(data.studentName || data['生徒名'] || data.studentId || '').trim();

  // D列: 登校ステータス ('乗る' または '')
  const isMorning = (
    data.morningTrip === '乗る' || data.morningTrip === '乗車' || data.morningTrip === true ||
    data.morningStatus === '乗る' || data.morningStatus === '乗車' || data.morningStatus === true ||
    data['登校ステータス'] === '乗る' || data['登校ステータス'] === '乗車'
  );
  const morningStatus = isMorning ? '乗る' : '';

  // F, G, H列: 下校1便〜3便の運行時刻
  let trip1 = String(data['下校1便'] || data.trip1 || data.trip1Time || '').trim();
  let trip2 = String(data['下校2便'] || data.trip2 || data.trip2Time || '').trim();
  let trip3 = String(data['下校3便'] || data.trip3 || data.trip3Time || '').trim();

  // 便名指定からの補完（時刻が空の場合）
  const aft = String(data.afternoonTrip || data.afternoonSchedule || data['下校ステータス'] || '').trim();
  if (!trip1 && !trip2 && !trip3 && aft && aft !== '不要' && aft !== '乗車しない' && aft !== '乗らない') {
    if (aft.includes('1便') || aft === '1') trip1 = '15:00';
    else if (aft.includes('2便') || aft === '2') trip2 = '16:00';
    else if (aft.includes('3便') || aft === '3') trip3 = '17:00';
    else trip1 = '15:00';
  }

  // E列: 下校ステータス（乗らない場合のみ '乗らない'、乗る場合は空文字 ''）
  const isAfternoonRide = (trip1 !== '' || trip2 !== '' || trip3 !== '');
  const afternoonStatus = isAfternoonRide ? '' : '乗らない';

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
    // 既存行更新: A列通し番号を維持し、B〜K列を更新
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

  const values = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  const cleanEmail = email ? String(email).trim().toLowerCase() : '';

  const results = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowEmail = String(row[10] || '').trim().toLowerCase();
    if (cleanEmail && rowEmail && rowEmail !== cleanEmail) {
      continue;
    }

    results.push({
      'ID': row[0],
      '日付': formatDateToSlash(row[1]),
      '生徒名': row[2],
      '登校ステータス': row[3],
      '下校ステータス': row[4],
      '下校1便': row[5],
      '下校2便': row[6],
      '下校3便': row[7],
      '備考': row[8],
      '更新日時': row[9],
      '保護者メールアドレス': row[10]
    });
  }

  return { status: 'success', data: results };
}

/**
 * 4. 保護者・生徒データ取得（「生徒・保護者マスター」シート）
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
          busStop: String(data[i][5] || '高山研修所前').trim(),
          memo: String(data[i][6] || '').trim(),
          defaultToSchool: String(data[i][7] || '乗る').trim(),
          defaultFromSchool: String(data[i][8] || '1便').trim(),
          '保護者メールアドレス': cleanEmail,
          '生徒名１': s1,
          '生徒名２': s2,
          '生徒名３': s3,
          '生徒名４': s4,
          '登録バス停名': String(data[i][5] || '高山研修所前').trim(),
          '備考': String(data[i][6] || '').trim(),
          '基本_登校': String(data[i][7] || '乗る').trim(),
          '基本_下校': String(data[i][8] || '1便').trim()
        }
      };
    }
  }

  return { status: 'success', found: false, message: '該当する保護者が見つかりません' };
}

/**
 * 5. 「生徒・保護者マスター」への保存・更新
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
  const busStop = String(params.busStop || params.bus_stop_name || params['登録バス停名'] || '草香会館').trim();
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
 * 6. バス停一覧取得
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
      'バス停名': values[i][0],
      '住所': values[i][1],
      '到着予定時刻（登校便）': values[i][2],
      '停車順序': values[i][3]
    });
  }
  return { status: 'success', data: results };
}

/**
 * 7. 生徒照合
 */
function verifyStudentInSheet(code, email) {
  if (email) return getGuardianDataFromSheet(email);
  return getGuardianDataFromSheet(code);
}

/**
 * 8. 全シートマスタ一括取得
 */
function getAllMasterFromSheet() {
  const guardianRes = getGuardianDataFromSheet('yagijinai@gmail.com');
  const busStopsRes = getBusStopsFromSheet();
  const schedulesRes = getSchedulesFromSheet('');
  return {
    status: 'success',
    guardianMaster: guardianRes.found ? [guardianRes.data] : [],
    busStops: busStopsRes.data || [],
    schedules: schedulesRes.data || []
  };
}
