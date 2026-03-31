// ===== Google Apps Script สำหรับ RCA Cloud Sync =====
// วิธีติดตั้ง:
// 1. เปิด Google Sheet: https://docs.google.com/spreadsheets/d/1V-0tLZMIQLWdzRYekl_KF8lxezNbP7POqjDhI7m75A4/edit
// 2. ไปที่เมนู Extensions > Apps Script
// 3. ลบโค้ดเดิมทั้งหมด แล้ววางโค้ดนี้ลงไป
// 4. กด Deploy > New deployment
//    - Select type: Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 5. กด Deploy แล้วคัดลอก URL ที่ได้
// 6. นำ URL ไปใส่ในไฟล์ rca_app.html ที่บรรทัด const GAS_URL='...'
//
// หมายเหตุ: ถ้าแก้ไขโค้ดนี้ ต้อง Deploy > Manage deployments > แก้ไข Version เป็น "New version" แล้วกด Deploy ใหม่
// =====================================================

var SHEET_NAME = 'RCA_Data';
var HEADERS = ['ID', 'เรื่อง', 'หน่วยงาน', 'วันที่', 'ความรุนแรง', 'สถานะ', 'JSON_Data'];

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange('A1:G1').setFontWeight('bold').setBackground('#1a5276').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 280);
    sheet.setColumnWidth(3, 160);
    sheet.setColumnWidth(4, 110);
    sheet.setColumnWidth(5, 110);
    sheet.setColumnWidth(6, 110);
    sheet.setColumnWidth(7, 80);
    // ซ่อน column G (JSON_Data) เพื่อความเรียบร้อย
    sheet.hideColumns(7);
  }
  return sheet;
}

// GET = อ่านข้อมูลทั้งหมด
function doGet(e) {
  try {
    var sheet = getOrCreateSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return ContentService.createTextOutput('[]').setMimeType(ContentService.MimeType.JSON);
    }
    var data = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    var result = [];
    for (var i = 0; i < data.length; i++) {
      try {
        var json = data[i][6]; // Column G = full JSON data
        if (json) result.push(JSON.parse(json));
      } catch(err) {
        // skip invalid rows
      }
    }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({error: err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}

// POST = บันทึกข้อมูลทั้งหมด
function doPost(e) {
  try {
    var sheet = getOrCreateSheet();
    var body = e.postData.contents;
    var records = JSON.parse(body);

    // Clear old data (keep header row)
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, HEADERS.length).clearContent();
    }

    // Write all records as rows
    if (records.length > 0) {
      var rows = records.map(function(r) {
        return [
          r.id || '',
          r.title || '',
          r.department || '',
          r.date || '',
          (r.sevL || '') + '/' + (r.sevN || ''),
          r.followUpStatus === 'completed' ? 'เสร็จ' : r.followUpStatus === 'in_progress' ? 'ดำเนินการ' : 'รอ',
          JSON.stringify(r)
        ];
      });
      sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
    }

    return ContentService.createTextOutput(
      JSON.stringify({ status: 'ok', count: records.length })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: err.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// ฟังก์ชันทดสอบ - รันจาก Apps Script Editor เพื่อเช็คว่า Sheet ทำงานปกติ
function testSetup() {
  var sheet = getOrCreateSheet();
  Logger.log('Sheet "' + SHEET_NAME + '" ready. Rows: ' + sheet.getLastRow());
  Logger.log('Test passed!');
}

// =====================================================
// ===== Line OA Notification สำหรับปฏิทิน RCA =====
// =====================================================
// วิธีตั้งค่า:
// 1. สร้าง Line Official Account ที่ https://developers.line.biz/
// 2. เปิด Messaging API แล้วคัดลอก Channel Access Token
// 3. ใส่ Token ด้านล่าง
// 4. สร้าง Sheet ชื่อ "RCA_Schedule" (หรือจะสร้างอัตโนมัติจากฟังก์ชัน)
// 5. ตั้ง Trigger: Apps Script > Triggers > Add Trigger
//    - Function: checkAndNotify
//    - Event source: Time-driven
//    - Type: Day timer
//    - Time: 08:00 - 09:00
// =====================================================

var LINE_TOKEN = ''; // ← ใส่ Line Messaging API Channel Access Token
var LINE_GROUP_ID = ''; // ← ใส่ Group ID หรือ User ID ที่ต้องการแจ้งเตือน
var SCHEDULE_SHEET = 'RCA_Schedule';

function getOrCreateScheduleSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SCHEDULE_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(SCHEDULE_SHEET);
    sheet.getRange('A1:G1').setValues([['ID', 'เรื่อง', 'หน่วยงาน', 'วันที่', 'เวลา', 'สถานที่', 'แจ้งเตือนแล้ว']]);
    sheet.getRange('A1:G1').setFontWeight('bold').setBackground('#e67e22').setFontColor('#fff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ส่งข้อความผ่าน Line OA
function sendLineMessage(message) {
  if (!LINE_TOKEN) {
    Logger.log('LINE_TOKEN not set');
    return;
  }
  var url = 'https://api.line.me/v2/bot/message/push';
  var payload = {
    to: LINE_GROUP_ID,
    messages: [{ type: 'text', text: message }]
  };
  UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + LINE_TOKEN
    },
    payload: JSON.stringify(payload)
  });
  Logger.log('Line message sent: ' + message.substring(0, 50));
}

// ฟังก์ชันหลัก - เรียกจาก Daily Trigger
function checkAndNotify() {
  var sheet = getOrCreateScheduleSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  for (var i = 0; i < data.length; i++) {
    var id = data[i][0];
    var title = data[i][1];
    var dept = data[i][2];
    var dateStr = data[i][3];
    var time = data[i][4];
    var location = data[i][5];
    var notified = data[i][6] || '';

    if (!dateStr) continue;
    var rcaDate = new Date(dateStr);
    rcaDate.setHours(0, 0, 0, 0);

    var diffDays = Math.round((rcaDate - today) / (1000 * 60 * 60 * 24));

    // แจ้งเตือน 3 วันก่อนทำ RCA
    if (diffDays === 3 && notified.indexOf('3d') < 0) {
      var msg = '📅 แจ้งเตือน: กำหนดทำ RCA อีก 3 วัน\n\n'
        + '📋 เรื่อง: ' + title + '\n'
        + '🏥 หน่วยงาน: ' + dept + '\n'
        + '📆 วันที่: ' + dateStr + '\n'
        + (time ? '⏰ เวลา: ' + time + '\n' : '')
        + (location ? '📍 สถานที่: ' + location + '\n' : '')
        + '\nกรุณาเตรียมข้อมูลและผู้เข้าร่วมให้พร้อม';
      sendLineMessage(msg);
      sheet.getRange(i + 2, 7).setValue(notified + '3d,');
    }

    // แจ้งเตือน 7 วันหลังทำ RCA
    if (diffDays === -7 && notified.indexOf('7d') < 0) {
      var msg2 = '📝 แจ้งเตือน: ครบ 7 วันหลังทำ RCA\n\n'
        + '📋 เรื่อง: ' + title + '\n'
        + '🏥 หน่วยงาน: ' + dept + '\n\n'
        + '✅ กรุณาดำเนินการ:\n'
        + '1. บันทึกรายงาน RCA ฉบับสมบูรณ์\n'
        + '2. บันทึกการแก้ไขในระบบ HRMS';
      sendLineMessage(msg2);
      sheet.getRange(i + 2, 7).setValue(notified + '7d,');
    }
  }
}

// บันทึกกำหนดการจากหน้าเว็บ (เรียกผ่าน POST ?action=schedule)
function saveSchedule(schedules) {
  var sheet = getOrCreateScheduleSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 7).clearContent();
  if (schedules.length > 0) {
    var rows = schedules.map(function(s) {
      return [s.id || '', s.title || '', s.department || '', s.rcaDate || '', s.rcaTime || '', s.location || '', ''];
    });
    sheet.getRange(2, 1, rows.length, 7).setValues(rows);
  }
}

// ทดสอบส่ง Line
function testLineNotification() {
  sendLineMessage('🔔 ทดสอบแจ้งเตือน RCA Management System\nระบบแจ้งเตือนทำงานปกติ');
}
