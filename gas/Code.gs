/**
 * スクールバス運行管理システム - Google Apps Script (GAS) バックエンド
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
  let result = { status: 'error', message: '不明なアクションです: ' + action };

  try {
    if (action === 'saveReservation') {
      result = saveReservationToSheet(params);
    } else if (action === 'saveBatchSchedules') {
      result = saveBatchSchedulesToSheet(params.schedules || params.reservations || []);
    } else if (action === 'getSchedules') {
      result = getSchedulesFromSheet(params.email);
    } else {
      result = { status: 'success', message: 'Action received', action: action };
    }
  } catch (error) {
    result = { status: 'error', message: error.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
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
 * 予約・スケジュールの単一保存
 */
function saveReservationToSheet(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = data.sheetName || '運行予定カレンダー';
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('シート「' + sheetName + '」が見つかりません。');
  }

  // 1. 日付フォーマット変換（B列）: 確実に YYYY/MM/DD
  const dateStr = formatDateToSlash(data.date || data['日付']);
  const studentName = String(data.studentName || data['生徒名'] || '').trim();

  // 2. 登校ステータス（D列）: 「乗る」または空文字 ""
  const isMorningRide = data.morningTrip === '乗る' || data.morningTrip === '乗車' || data.morningStatus === '乗る' || data['登校ステータス'] === '乗る';
  const morningStatus = isMorningRide ? '乗る' : '';

  // 3. 下校便の各時刻（F, G, H列）
  const trip1 = data['下校1便'] || data.trip1 || data.trip1Time || '';
  const trip2 = data['下校2便'] || data.trip2 || data.trip2Time || '';
  const trip3 = data['下校3便'] || data.trip3 || data.trip3Time || '';

  // 4. 下校ステータス（E列）: 乗らない場合のみ「乗らない」、乗る場合は空文字 ""
  const isAfternoonRide = (trip1 !== '' || trip2 !== '' || trip3 !== '');
  const afternoonStatus = isAfternoonRide ? '' : '乗らない';

  // 5. 備考（I列）、更新日時（J列）、保護者メールアドレス（K列）
  const note = String(data['備考'] || data.note || '').trim();
  const updatedAt = formatCurrentDateTimeJ();
  const parentEmail = String(data['保護者メールアドレス'] || data.parentEmail || data.guardianEmail || '').trim().toLowerCase();

  const lastRow = sheet.getLastRow();
  let targetRow = -1;
  let currentId = null;

  // 6. A列通し番号ハンドリング:
  // 既存行の更新の場合は、B列（日付: YYYY/MM/DD）と C列（生徒名）が一致する行を検索して該当行を更新し、A列の通し番号は維持
  if (lastRow >= 2) {
    const range = sheet.getRange(2, 1, lastRow - 1, 3); // A〜C列
    const values = range.getValues();
    for (let i = 0; i < values.length; i++) {
      const rowId = values[i][0];
      const rowDate = formatDateToSlash(values[i][1]);
      const rowStudent = String(values[i][2]).trim();

      if (rowDate === dateStr && rowStudent === studentName) {
        targetRow = i + 2; // 実スプレッドシート行番号
        currentId = rowId;
        break;
      }
    }
  }

  if (targetRow > 0) {
    // 既存行更新: A列の通し番号は維持し、B列〜K列を更新
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
      message: '既存予約を更新しました (行: ' + targetRow + ', ID: ' + currentId + ')'
    };
  } else {
    // 新規行追加: 行番号から1を引いた通し番号（数値。例: データ先頭行[2行目]は 1、3行目は 2...）
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
      message: '新規予約を追加しました (行: ' + newRow + ', ID: ' + newId + ')'
    };
  }
}

/**
 * 複数予約の一括保存
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
    message: schedules.length + '件の予約を保存しました (更新: ' + updatedCount + ', 新規: ' + insertedCount + ')'
  };
}

/**
 * 運行予定カレンダー一覧取得
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
