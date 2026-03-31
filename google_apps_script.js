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

// POST = บันทึกข้อมูล RCA
function doPost(e) {
  try {
    var body = e.postData.contents;
    var parsed = JSON.parse(body);

    // ถ้าเป็น Line Webhook event ให้ข้ามไป (GAS ไม่รองรับ Webhook 200 OK)
    if (parsed.events && Array.isArray(parsed.events)) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
    }

    // ปกติ = บันทึกข้อมูล RCA
    var sheet = getOrCreateSheet();
    var records = parsed;

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

// ===== Line Webhook Handler =====
// หมายเหตุ: Google Apps Script Web App ตอบ 302 redirect ซึ่ง Line Webhook
// ต้องการ 200 OK ตรงๆ ดังนั้น Webhook verify จะ error
// แต่ Line ยังส่ง event มาได้ (แค่ verify ไม่ผ่าน)
// ถ้าต้องการ Webhook ที่ verify ผ่าน ใช้ Cloud Functions หรือ Heroku แทน
//
// === วิธีรับ Group ID แบบไม่ต้องใช้ Webhook ===
// 1. ใส่ LINE_TOKEN ด้านล่าง
// 2. เชิญ Bot เข้ากลุ่ม Line
// 3. รันฟังก์ชัน getGroupIdFromRecentChats() จาก Apps Script Editor
// 4. ดูผลที่ Sheet "Line_IDs"

// ดึง Group ID จาก Bot ที่เข้าร่วมกลุ่มอยู่
function getGroupIdFromRecentChats() {
  if (!LINE_TOKEN) {
    Logger.log('ERROR: กรุณาใส่ LINE_TOKEN ก่อน');
    return;
  }

  // ใช้ Line Get Bot Info API เพื่อตรวจว่า Bot ทำงานได้
  try {
    var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', {
      headers: { 'Authorization': 'Bearer ' + LINE_TOKEN }
    });
    var botInfo = JSON.parse(res.getContentText());
    Logger.log('Bot: ' + botInfo.displayName + ' (userId: ' + botInfo.userId + ')');
  } catch(err) {
    Logger.log('ERROR: LINE_TOKEN ไม่ถูกต้อง - ' + err.message);
    return;
  }

  Logger.log('');
  Logger.log('=== วิธีรับ Group ID ===');
  Logger.log('1. เชิญ Bot เข้ากลุ่ม Line ที่ต้องการ');
  Logger.log('2. ในกลุ่ม เปิด URL นี้ในเบราว์เซอร์มือถือ:');
  Logger.log('   line://nv/chat');
  Logger.log('3. หรือใช้วิธีดังนี้:');
  Logger.log('');
  Logger.log('วิธีง่ายที่สุด: ใส่ Group ID ด้วยตนเอง');
  Logger.log('- เปิด LINE Official Account Manager (manager.line.biz)');
  Logger.log('- ไปที่ Chat > เลือกกลุ่ม > ดู URL จะมี Group ID');
  Logger.log('');
  Logger.log('หรือ: ใช้ LIFF URL ด้านล่างเปิดในกลุ่ม แล้วกรอก Group ID ด้วยตนเอง');
  Logger.log('');
  Logger.log('Bot User ID ของคุณ: ' + botInfo.userId);
  Logger.log('นำ User ID นี้ไปใส่ LINE_GROUP_ID ได้ ถ้าต้องการแจ้งเตือนแชทส่วนตัว');

  // บันทึก Bot User ID ลง Sheet
  saveLineId('user', botInfo.userId, botInfo.displayName + ' (Bot)');
}

// บันทึก Group ID ด้วยตนเอง - รันจาก Apps Script แล้วแก้ ID
function saveGroupIdManually() {
  // ===== แก้ไข Group ID ตรงนี้ =====
  var groupId = '';  // ← ใส่ Group ID ที่ได้จาก LINE OA Manager
  var groupName = 'ทีม RCA'; // ← ใส่ชื่อกลุ่ม
  // ==================================

  if (!groupId) {
    Logger.log('กรุณาใส่ groupId ในฟังก์ชัน saveGroupIdManually() ก่อนรัน');
    return;
  }
  saveLineId('group', groupId, groupName);
  Logger.log('บันทึก Group ID เรียบร้อย: ' + groupId);
  Logger.log('นำ ID นี้ไปใส่ที่ LINE_GROUP_ID ด้านบน');
}

function saveLineId(type, id, label) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Line_IDs');
  if (!sheet) {
    sheet = ss.insertSheet('Line_IDs');
    sheet.getRange('A1:D1').setValues([['ประเภท', 'ID', 'ชื่อ', 'วันที่บันทึก']]);
    sheet.getRange('A1:D1').setFontWeight('bold').setBackground('#06c755').setFontColor('#fff');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(2, 350);
  }
  // เช็คซ้ำ
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var existing = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    for (var i = 0; i < existing.length; i++) {
      if (existing[i][0] === id) { Logger.log('ID นี้มีอยู่แล้ว'); return; }
    }
  }
  sheet.appendRow([type, id, label, new Date().toISOString()]);
}

// ส่งข้อความทดสอบหา User ID ของตัวเอง (แชทส่วนตัว)
function testSendToMyself() {
  if (!LINE_TOKEN) { Logger.log('ใส่ LINE_TOKEN ก่อน'); return; }
  try {
    var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', {
      headers: { 'Authorization': 'Bearer ' + LINE_TOKEN }
    });
    var botInfo = JSON.parse(res.getContentText());
    Logger.log('Bot OK: ' + botInfo.displayName);
  } catch(err) {
    Logger.log('LINE_TOKEN ผิด: ' + err.message);
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
