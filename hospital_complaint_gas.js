// =====================================================
// ===== Google Apps Script - Hospital Complaint Management System =====
// ===== ฐานข้อมูล Google Sheets สำหรับระบบจัดการข้อร้องเรียนโรงพยาบาล =====
// =====================================================
//
// วิธีติดตั้ง:
// 1. สร้าง Google Sheet ใหม่
// 2. ไปที่เมนู Extensions > Apps Script
// 3. ลบโค้ดเดิมทั้งหมด แล้ววางโค้ดนี้ลงไป
// 4. กด Deploy > New deployment
//    - Select type: Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 5. กด Deploy แล้วคัดลอก URL ที่ได้
// 6. นำ URL ไปใส่ในไฟล์ hospital-complaint.html ที่ CLOUD_URL
//
// หมายเหตุ: ถ้าแก้ไขโค้ดนี้ ต้อง Deploy > Manage deployments > แก้ไข Version เป็น "New version" แล้วกด Deploy ใหม่
// =====================================================

// ===== CONFIGURATION =====
// วิธีตั้งค่า LINE Messaging API:
// 1. ไปที่ https://developers.line.biz/ → สร้าง Provider + Channel (Messaging API)
// 2. ไปที่ Channel settings → Messaging API → Issue Channel Access Token (long-lived)
// 3. คัดลอก Token มาวางด้านล่าง
// 4. ได้ Group ID โดย: เชิญ Bot เข้ากลุ่ม → ใช้ Webhook หรือดูที่ LINE OA Manager
// 5. หรือใส่ User ID ของตัวเอง (ส่งแชทส่วนตัว) → ดูที่ LINE Developers → Channel → Basic settings → Your user ID
var LINE_CHANNEL_TOKEN = '';  // ← วาง LINE Channel Access Token ตรงนี้
var LINE_TARGET_ID = '';      // ← วาง Group ID หรือ User ID ตรงนี้

// ===== SHEET NAMES =====
var SHEET_COMPLAINTS = 'Complaints';
var SHEET_USERS = 'Users';
var SHEET_STAFF = 'Staff';
var SHEET_LINE_CONFIG = 'LineConfig';
var SHEET_LOG = 'ActivityLog';

// ===== HEADERS =====
var HEADERS_COMPLAINTS = [
  'ID', 'วันที่รับเรื่อง', 'ชื่อผู้ร้องเรียน', 'สถานะผู้ร้อง', 'ช่องทาง',
  'เรื่อง', 'หน่วยงานที่ถูกร้องเรียน', 'ระดับความรุนแรง', 'แผนกรับผิดชอบ',
  'ผู้รับผิดชอบ', 'สถานะ', 'วันที่สร้าง', 'สร้างโดย', 'JSON_Data'
];
var HEADERS_USERS = ['Email', 'ชื่อ', 'แผนก', 'บทบาท', 'สถานะ', 'วันที่สมัคร'];
var HEADERS_STAFF = ['ชื่อ', 'แผนก', 'ตำแหน่ง', 'Email'];
var HEADERS_LOG = ['วันเวลา', 'ผู้ใช้', 'การดำเนินการ', 'รายละเอียด'];

// =====================================================
// ===== SHEET INITIALIZATION =====
// =====================================================

function getOrCreateSheet(name, headers, options) {
  if (!name || !headers) {
    throw new Error('getOrCreateSheet ต้องเรียกผ่านฟังก์ชันเฉพาะ เช่น getComplaintsSheet(), getUsersSheet() เท่านั้น');
  }
  options = options || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground(options.color || '#1a5276')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);

    // ตั้งขนาดคอลัมน์
    if (options.widths) {
      for (var i = 0; i < options.widths.length; i++) {
        sheet.setColumnWidth(i + 1, options.widths[i]);
      }
    }

    // ซ่อนคอลัมน์ JSON_Data (คอลัมน์สุดท้ายถ้ามี)
    if (options.hideLastCol) {
      sheet.hideColumns(headers.length);
    }
  }
  return sheet;
}

function getComplaintsSheet() {
  return getOrCreateSheet(SHEET_COMPLAINTS, HEADERS_COMPLAINTS, {
    color: '#dc2626',
    widths: [140, 110, 160, 120, 140, 250, 160, 100, 160, 140, 110, 160, 180, 80],
    hideLastCol: true
  });
}

function getUsersSheet() {
  return getOrCreateSheet(SHEET_USERS, HEADERS_USERS, {
    color: '#6366f1',
    widths: [220, 160, 180, 100, 100, 160]
  });
}

function getStaffSheet() {
  return getOrCreateSheet(SHEET_STAFF, HEADERS_STAFF, {
    color: '#059669',
    widths: [160, 180, 160, 220]
  });
}

function getLogSheet() {
  return getOrCreateSheet(SHEET_LOG, HEADERS_LOG, {
    color: '#64748b',
    widths: [180, 180, 140, 400]
  });
}

// =====================================================
// ===== HELPER FUNCTIONS =====
// =====================================================

function getAutoStatus(c) {
  if (c.res && (c.res.actions || c.res.result)) return 'resolved';
  if (c.inv && (c.inv.facts || c.inv.root || c.inv.sol)) return 'in_progress';
  return 'investigating';
}

function getSeverityLabel(level) {
  var labels = { 1: 'ระดับ 1', 2: 'ระดับ 2', 3: 'ระดับ 3' };
  return labels[level] || '';
}

function fmtDateThai(d) {
  if (!d) return '-';
  var p = d.split('-');
  if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0];
  return d;
}

function jsonResp(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function addLog(user, action, detail) {
  try {
    var sheet = getLogSheet();
    sheet.appendRow([new Date().toISOString(), user || '-', action, detail || '']);
  } catch (e) { /* ignore log errors */ }
}

// =====================================================
// ===== COMPLAINTS CRUD =====
// =====================================================

function getAllComplaints() {
  var sheet = getComplaintsSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, HEADERS_COMPLAINTS.length).getValues();
  var result = [];
  for (var i = 0; i < data.length; i++) {
    try {
      var json = data[i][HEADERS_COMPLAINTS.length - 1]; // JSON_Data column
      if (json) result.push(JSON.parse(json));
    } catch (e) { /* skip invalid rows */ }
  }
  return result;
}

function saveComplaint(complaint) {
  var sheet = getComplaintsSheet();
  var status = getAutoStatus(complaint);
  var statusLabels = {
    investigating: 'กำลังตรวจสอบ',
    in_progress: 'กำลังดำเนินการ',
    resolved: 'แก้ไขแล้ว'
  };

  var row = [
    complaint.id || '',
    complaint.date || '',
    complaint.name || '',
    complaint.cStatus || '',
    complaint.channel || '',
    complaint.subject || '',
    complaint.unit || '',
    getSeverityLabel(complaint.severity),
    complaint.dept || '',
    complaint.responsible || '',
    statusLabels[status] || status,
    complaint.createdAt || new Date().toISOString(),
    complaint.by || '',
    JSON.stringify(complaint)
  ];

  // หา row ที่มี ID ซ้ำ (update)
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2 && complaint.id) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === complaint.id) {
        sheet.getRange(i + 2, 1, 1, HEADERS_COMPLAINTS.length).setValues([row]);
        return { status: 'updated', id: complaint.id };
      }
    }
  }

  // ถ้าไม่เจอ = insert ใหม่
  sheet.appendRow(row);
  return { status: 'created', id: complaint.id };
}

function deleteComplaint(id) {
  var sheet = getComplaintsSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'not_found' };

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) {
      sheet.deleteRow(i + 2);
      return { status: 'deleted', id: id };
    }
  }
  return { status: 'not_found' };
}

// Sync ข้อมูลทั้งหมด (overwrite ทุก row)
function syncAllComplaints(complaints) {
  var sheet = getComplaintsSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, HEADERS_COMPLAINTS.length).clearContent();
  }

  if (!complaints || complaints.length === 0) return { status: 'ok', count: 0 };

  var statusLabels = {
    investigating: 'กำลังตรวจสอบ',
    in_progress: 'กำลังดำเนินการ',
    resolved: 'แก้ไขแล้ว'
  };

  var rows = complaints.map(function (c) {
    var status = getAutoStatus(c);
    return [
      c.id || '',
      c.date || '',
      c.name || '',
      c.cStatus || '',
      c.channel || '',
      c.subject || '',
      c.unit || '',
      getSeverityLabel(c.severity),
      c.dept || '',
      c.responsible || '',
      statusLabels[status] || status,
      c.createdAt || '',
      c.by || '',
      JSON.stringify(c)
    ];
  });

  sheet.getRange(2, 1, rows.length, HEADERS_COMPLAINTS.length).setValues(rows);

  // จัดรูปแบบสีตามระดับความรุนแรง
  for (var i = 0; i < rows.length; i++) {
    var sevCell = sheet.getRange(i + 2, 8); // Column H = severity
    var sev = complaints[i].severity;
    if (sev === 1) sevCell.setBackground('#dcfce7').setFontColor('#166534');
    else if (sev === 2) sevCell.setBackground('#fef3c7').setFontColor('#92400e');
    else if (sev === 3) sevCell.setBackground('#fecaca').setFontColor('#991b1b');

    // สีสถานะ
    var stsCell = sheet.getRange(i + 2, 11); // Column K = status
    var status = getAutoStatus(complaints[i]);
    if (status === 'resolved') stsCell.setBackground('#dcfce7').setFontColor('#166534');
    else if (status === 'in_progress') stsCell.setBackground('#f3e8ff').setFontColor('#7c3aed');
    else stsCell.setBackground('#fef3c7').setFontColor('#92400e');
  }

  return { status: 'ok', count: complaints.length };
}

// =====================================================
// ===== USERS CRUD =====
// =====================================================

function getAllUsers() {
  var sheet = getUsersSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, HEADERS_USERS.length).getValues();
  return data.map(function (row) {
    return {
      email: row[0],
      name: row[1],
      dept: row[2],
      role: row[3],
      status: row[4]
    };
  });
}

function saveUser(user) {
  var sheet = getUsersSheet();
  var lastRow = sheet.getLastRow();

  // เช็คซ้ำ
  if (lastRow >= 2) {
    var emails = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < emails.length; i++) {
      if (emails[i][0] === user.email) {
        // Update existing
        sheet.getRange(i + 2, 1, 1, HEADERS_USERS.length).setValues([[
          user.email, user.name || '', user.dept || '', user.role || 'user', user.status || 'pending',
          sheet.getRange(i + 2, 6).getValue() // keep original date
        ]]);
        return { status: 'updated', email: user.email };
      }
    }
  }

  // Insert new
  sheet.appendRow([
    user.email, user.name || '', user.dept || '', user.role || 'user',
    user.status || 'pending', new Date().toISOString()
  ]);
  return { status: 'created', email: user.email };
}

function deleteUser(email) {
  var sheet = getUsersSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'not_found' };

  var emails = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < emails.length; i++) {
    if (emails[i][0] === email) {
      sheet.deleteRow(i + 2);
      return { status: 'deleted', email: email };
    }
  }
  return { status: 'not_found' };
}

function syncAllUsers(users) {
  var sheet = getUsersSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, HEADERS_USERS.length).clearContent();
  }
  if (!users || users.length === 0) return { status: 'ok', count: 0 };

  var rows = users.map(function (u) {
    return [u.email || '', u.name || '', u.dept || '', u.role || 'user', u.status || 'pending', u.createdAt || new Date().toISOString()];
  });
  sheet.getRange(2, 1, rows.length, HEADERS_USERS.length).setValues(rows);
  return { status: 'ok', count: users.length };
}

// =====================================================
// ===== STAFF CRUD =====
// =====================================================

function getAllStaff() {
  var sheet = getStaffSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, HEADERS_STAFF.length).getValues();
  return data.map(function (row) {
    return { name: row[0], dept: row[1], position: row[2], email: row[3] };
  });
}

function syncAllStaff(staff) {
  var sheet = getStaffSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, HEADERS_STAFF.length).clearContent();
  }
  if (!staff || staff.length === 0) return { status: 'ok', count: 0 };

  var rows = staff.map(function (s) {
    return [s.name || '', s.dept || '', s.position || '', s.email || ''];
  });
  sheet.getRange(2, 1, rows.length, HEADERS_STAFF.length).setValues(rows);
  return { status: 'ok', count: staff.length };
}

// =====================================================
// ===== LINE CONFIG =====
// =====================================================

function getLineConfig() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_LINE_CONFIG);
  if (!sheet) return { token: '', notif: { newComplaint: true, statusChange: true, meeting: true, overdue: true } };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { token: '', notif: { newComplaint: true, statusChange: true, meeting: true, overdue: true } };

  try {
    var json = sheet.getRange(2, 2).getValue();
    return JSON.parse(json);
  } catch (e) {
    return { token: '', notif: { newComplaint: true, statusChange: true, meeting: true, overdue: true } };
  }
}

function saveLineConfig(config) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_LINE_CONFIG);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_LINE_CONFIG);
    sheet.getRange('A1:B1').setValues([['Key', 'Value']]);
    sheet.getRange('A1:B1').setFontWeight('bold').setBackground('#06c755').setFontColor('#fff');
    sheet.setFrozenRows(1);
  }

  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, 1, 2).setValues([['lineConfig', JSON.stringify(config)]]);
  } else {
    sheet.appendRow(['lineConfig', JSON.stringify(config)]);
  }
  return { status: 'ok' };
}

// =====================================================
// ===== DASHBOARD STATISTICS =====
// =====================================================

function getDashboardStats() {
  var complaints = getAllComplaints();
  var total = complaints.length;
  var resolved = 0;
  var sev1 = 0, sev2 = 0, sev3 = 0;
  var deptCount = {};
  var monthlyCount = {};

  for (var i = 0; i < complaints.length; i++) {
    var c = complaints[i];
    if (getAutoStatus(c) === 'resolved') resolved++;
    if (c.severity === 1) sev1++;
    else if (c.severity === 2) sev2++;
    else if (c.severity === 3) sev3++;

    // นับตามแผนก
    var dept = c.dept || 'ไม่ระบุ';
    deptCount[dept] = (deptCount[dept] || 0) + 1;

    // นับตามเดือน
    if (c.date) {
      var monthKey = c.date.substring(0, 7); // YYYY-MM
      monthlyCount[monthKey] = (monthlyCount[monthKey] || 0) + 1;
    }
  }

  return {
    total: total,
    resolved: resolved,
    pending: total - resolved,
    severity: { level1: sev1, level2: sev2, level3: sev3 },
    byDept: deptCount,
    byMonth: monthlyCount
  };
}

// =====================================================
// ===== WEB APP ENDPOINTS =====
// =====================================================

// GET Requests
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || 'complaints';

    switch (action) {
      case 'complaints':
        return jsonResp({ status: 'ok', data: getAllComplaints() });

      case 'users':
        return jsonResp({ status: 'ok', data: getAllUsers() });

      case 'staff':
        return jsonResp({ status: 'ok', data: getAllStaff() });

      case 'lineConfig':
        return jsonResp({ status: 'ok', data: getLineConfig() });

      case 'stats':
        return jsonResp({ status: 'ok', data: getDashboardStats() });

      case 'all':
        // ดึงทุกอย่างรวมกัน (สำหรับ initial load)
        return jsonResp({
          status: 'ok',
          data: {
            complaints: getAllComplaints(),
            users: getAllUsers(),
            staff: getAllStaff(),
            lineConfig: getLineConfig()
          }
        });

      case 'ping':
        return jsonResp({ status: 'ok', message: 'HCMS API is running', timestamp: new Date().toISOString() });

      default:
        return jsonResp({ status: 'error', message: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResp({ status: 'error', message: err.message });
  }
}

// POST Requests
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action || '';
    var data = body.data;
    var user = body.user || '';

    switch (action) {
      // ----- Complaints -----
      case 'saveComplaint':
        var result = saveComplaint(data);
        addLog(user, 'บันทึกเรื่องร้องเรียน', data.id + ' - ' + data.subject);
        // ส่ง LINE แจ้งเตือนเรื่องใหม่
        if (result.status === 'created') {
          notifyNewComplaint(data);
        }
        return jsonResp({ status: 'ok', result: result });

      case 'deleteComplaint':
        var delResult = deleteComplaint(data.id);
        addLog(user, 'ลบเรื่องร้องเรียน', data.id);
        return jsonResp({ status: 'ok', result: delResult });

      case 'syncComplaints':
        var syncResult = syncAllComplaints(data);
        addLog(user, 'Sync เรื่องร้องเรียน', syncResult.count + ' รายการ');
        return jsonResp({ status: 'ok', result: syncResult });

      case 'updateComplaint':
        var upResult = saveComplaint(data);
        addLog(user, 'อัปเดตเรื่องร้องเรียน', data.id + ' - ' + (data.subject || ''));
        // แจ้งเตือนเปลี่ยนสถานะ
        notifyStatusChange(data);
        return jsonResp({ status: 'ok', result: upResult });

      // ----- Users -----
      case 'saveUser':
        var userResult = saveUser(data);
        addLog(user, 'บันทึกผู้ใช้', data.email);
        return jsonResp({ status: 'ok', result: userResult });

      case 'deleteUser':
        var delUserResult = deleteUser(data.email);
        addLog(user, 'ลบผู้ใช้', data.email);
        return jsonResp({ status: 'ok', result: delUserResult });

      case 'syncUsers':
        var syncUserResult = syncAllUsers(data);
        addLog(user, 'Sync ผู้ใช้', syncUserResult.count + ' คน');
        return jsonResp({ status: 'ok', result: syncUserResult });

      // ----- Staff -----
      case 'syncStaff':
        var syncStaffResult = syncAllStaff(data);
        addLog(user, 'Sync บุคลากร', syncStaffResult.count + ' คน');
        return jsonResp({ status: 'ok', result: syncStaffResult });

      // ----- LINE Config -----
      case 'saveLineConfig':
        var lineResult = saveLineConfig(data);
        addLog(user, 'บันทึกการตั้งค่า LINE', '');
        return jsonResp({ status: 'ok', result: lineResult });

      // ----- Meeting -----
      case 'saveMeeting':
        addLog(user, 'นัดประชุม', data.title + ' - ' + data.date);
        notifyNewMeeting(data);
        return jsonResp({ status: 'ok', result: 'meeting saved' });

      // ----- Full Sync (ส่งข้อมูลทั้งหมดจาก localStorage ไป Sheets) -----
      case 'fullSync':
        var results = {};
        if (data.complaints) results.complaints = syncAllComplaints(data.complaints);
        if (data.users) results.users = syncAllUsers(data.users);
        if (data.staff) results.staff = syncAllStaff(data.staff);
        if (data.lineConfig) results.lineConfig = saveLineConfig(data.lineConfig);
        addLog(user, 'Full Sync', JSON.stringify(results));
        return jsonResp({ status: 'ok', results: results });

      default:
        return jsonResp({ status: 'error', message: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResp({ status: 'error', message: err.message });
  }
}

// =====================================================
// ===== LINE NOTIFICATION =====
// =====================================================

function sendLineMessage(message) {
  if (!LINE_CHANNEL_TOKEN || !LINE_TARGET_ID) return;
  try {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + LINE_CHANNEL_TOKEN
      },
      payload: JSON.stringify({
        to: LINE_TARGET_ID,
        messages: [{ type: 'text', text: message }]
      })
    });
    Logger.log('LINE message sent: ' + message.substring(0, 50));
  } catch (e) {
    Logger.log('LINE send error: ' + e.message);
  }
}

function notifyNewComplaint(c) {
  if (!LINE_CHANNEL_TOKEN) return;
  var sevDesc = { 1: 'ระดับ 1 (บ่น/เสนอแนะ)', 2: 'ระดับ 2 (ตำหนิ/ร้องทุกข์)', 3: 'ระดับ 3 (รุนแรง)' };
  var msg = '\n🚨 เรื่องร้องเรียนใหม่\n\n'
    + '📋 ID: ' + (c.id || '-') + '\n'
    + '📝 เรื่อง: ' + (c.subject || '-') + '\n'
    + '🏥 หน่วยงาน: ' + (c.unit || c.dept || '-') + '\n'
    + '⚠️ ความรุนแรง: ' + (sevDesc[c.severity] || '-') + '\n'
    + '📅 วันที่: ' + fmtDateThai(c.date) + '\n'
    + '👤 บันทึกโดย: ' + (c.by || '-');
  sendLineMessage(msg);
}

function notifyStatusChange(c) {
  if (!LINE_CHANNEL_TOKEN) return;
  var status = getAutoStatus(c);
  var statusLabels = {
    investigating: 'กำลังตรวจสอบ',
    in_progress: 'กำลังดำเนินการ',
    resolved: 'แก้ไขแล้ว ✅'
  };

  var msg = '\n🔄 อัปเดตสถานะเรื่องร้องเรียน\n\n'
    + '📋 ID: ' + (c.id || '-') + '\n'
    + '📝 เรื่อง: ' + (c.subject || '-') + '\n'
    + '📊 สถานะ: ' + (statusLabels[status] || status) + '\n'
    + '🏥 หน่วยงาน: ' + (c.unit || c.dept || '-');
  sendLineMessage(msg);
}

// =====================================================
// ===== OVERDUE CHECK (ตั้ง Daily Trigger) =====
// =====================================================
// วิธีตั้ง: Apps Script > Triggers > Add Trigger
//   - Function: checkOverdueComplaints
//   - Event source: Time-driven
//   - Type: Day timer / Hour timer
//   - Time: ตามต้องการ

function checkOverdueComplaints() {
  var config = getLineConfig();
  if (!config.notif || !config.notif.overdue) return;

  var complaints = getAllComplaints();
  var now = new Date();
  var overdueList = [];

  for (var i = 0; i < complaints.length; i++) {
    var c = complaints[i];
    if (getAutoStatus(c) === 'resolved') continue;

    var created = new Date(c.createdAt || c.date);
    var diffHours = (now - created) / (1000 * 60 * 60);

    var isOverdue = false;
    if (c.severity === 3 && diffHours > 6) isOverdue = true;
    else if (c.severity === 2 && diffHours > 72) isOverdue = true;
    else if (c.severity === 1 && diffHours > 72) isOverdue = true; // 3 วันทำการ ≈ 72 ชม.

    if (isOverdue) {
      overdueList.push(c);
    }
  }

  if (overdueList.length > 0) {
    var msg = '⏰ แจ้งเตือน: เรื่องร้องเรียนเกินกำหนด ' + overdueList.length + ' เรื่อง\n\n';
    for (var j = 0; j < Math.min(overdueList.length, 5); j++) {
      var oc = overdueList[j];
      msg += '• ' + oc.id + ' - ' + oc.subject + ' (ระดับ ' + oc.severity + ')\n';
    }
    if (overdueList.length > 5) {
      msg += '\n...และอีก ' + (overdueList.length - 5) + ' เรื่อง';
    }
    sendLineMessage(msg);
  }
}

// =====================================================
// ===== TEST FUNCTIONS =====
// =====================================================

function testSetup() {
  var cs = getComplaintsSheet();
  var us = getUsersSheet();
  var ss = getStaffSheet();
  var ls = getLogSheet();
  Logger.log('✅ Sheets created successfully:');
  Logger.log('  - ' + SHEET_COMPLAINTS + ': ' + cs.getLastRow() + ' rows');
  Logger.log('  - ' + SHEET_USERS + ': ' + us.getLastRow() + ' rows');
  Logger.log('  - ' + SHEET_STAFF + ': ' + ss.getLastRow() + ' rows');
  Logger.log('  - ' + SHEET_LOG + ': ' + ls.getLastRow() + ' rows');
  Logger.log('Test passed!');
}

function testInsertSampleData() {
  // ข้อมูลทดสอบ 1 เรื่อง
  var sample = {
    id: 'CMP-2569-001',
    date: '2026-04-05',
    name: 'ทดสอบ ระบบ',
    cStatus: 'ผู้ป่วยหรือผู้รับบริการ',
    channel: 'โทรศัพท์',
    subject: 'ทดสอบระบบร้องเรียน',
    detail: 'นี่คือข้อมูลทดสอบ',
    unit: 'แผนกผู้ป่วยนอก (OPD)',
    severity: 1,
    dept: 'แผนกผู้ป่วยนอก (OPD)',
    responsible: 'Admin',
    by: 'admin@up.ac.th',
    createdAt: new Date().toISOString(),
    centerAction: '',
    tagDepts: [],
    tagStaff: [],
    inv: null,
    res: null
  };
  var result = saveComplaint(sample);
  Logger.log('Insert result: ' + JSON.stringify(result));

  // ข้อมูลผู้ใช้ทดสอบ
  var sampleUser = {
    email: 'admin@up.ac.th',
    name: 'Admin ทดสอบ',
    dept: 'แผนกเทคโนโลยีสารสนเทศ (IT)',
    role: 'admin',
    status: 'approved'
  };
  var userResult = saveUser(sampleUser);
  Logger.log('User result: ' + JSON.stringify(userResult));

  addLog('admin@up.ac.th', 'ทดสอบระบบ', 'เพิ่มข้อมูลทดสอบ');
  Logger.log('✅ Sample data inserted!');
}

// แจ้งเตือนนัดประชุมใหม่
function notifyNewMeeting(m) {
  if (!LINE_CHANNEL_TOKEN) return;
  var msg = '📅 นัดประชุมใหม่\n\n'
    + '📋 เรื่อง: ' + (m.title || '-') + '\n'
    + '📆 วันที่: ' + fmtDateThai(m.date) + '\n'
    + (m.time ? '⏰ เวลา: ' + m.time + ' น.\n' : '')
    + (m.location ? '📍 สถานที่: ' + m.location + '\n' : '')
    + '\nกรุณาเตรียมข้อมูลและผู้เข้าร่วมให้พร้อม';
  sendLineMessage(msg);
}

// ตรวจสอบประชุมที่จะมาถึงใน 2 วัน (ตั้ง Daily Trigger)
// วิธีตั้ง: Apps Script > Triggers > Add Trigger
//   - Function: checkUpcomingMeetings
//   - Event source: Time-driven
//   - Type: Day timer
//   - Time: 08:00 - 09:00
function checkUpcomingMeetings() {
  if (!LINE_CHANNEL_TOKEN) return;
  // อ่าน meetings จาก Complaints sheet (JSON_Data)
  var complaints = getAllComplaints();
  var now = new Date();
  now.setHours(0, 0, 0, 0);

  // เช็คข้อร้องเรียนที่เกินกำหนด
  var overdueList = [];
  for (var i = 0; i < complaints.length; i++) {
    var c = complaints[i];
    if (getAutoStatus(c) === 'resolved') continue;
    var created = new Date(c.createdAt || c.date);
    var diffHours = (now - created) / (1000 * 60 * 60);
    var isOverdue = false;
    if (c.severity === 3 && diffHours > 6) isOverdue = true;
    else if (c.severity === 2 && diffHours > 72) isOverdue = true;
    else if (c.severity === 1 && diffHours > 72) isOverdue = true;
    if (isOverdue) overdueList.push(c);
  }

  if (overdueList.length > 0) {
    var msg = '⏰ เรื่องร้องเรียนเกินกำหนด ' + overdueList.length + ' เรื่อง\n\n';
    for (var j = 0; j < Math.min(overdueList.length, 5); j++) {
      msg += '• ' + overdueList[j].id + ' - ' + overdueList[j].subject + ' (ระดับ ' + overdueList[j].severity + ')\n';
    }
    if (overdueList.length > 5) msg += '...และอีก ' + (overdueList.length - 5) + ' เรื่อง';
    sendLineMessage(msg);
  }

  // หมายเหตุ: ข้อมูล meetings เก็บใน localStorage/Firestore ของ frontend
  // ถ้าต้องการแจ้งเตือนประชุม 2 วันล่วงหน้า
  // ให้ frontend ส่ง meetings มาพร้อม fullSync หรือ saveMeeting
  // แล้ว GAS จะตรวจสอบจาก Sheet
  Logger.log('Daily check completed. Overdue: ' + overdueList.length);
}

function testLineNotification() {
  if (!LINE_CHANNEL_TOKEN) { Logger.log('กรุณาใส่ LINE_CHANNEL_TOKEN ก่อน'); return; }
  sendLineMessage('🔔 ทดสอบแจ้งเตือน\nระบบจัดการข้อร้องเรียน รพ.มหาวิทยาลัยพะเยา\nระบบแจ้งเตือนทำงานปกติ ✅');
  Logger.log('LINE message sent - check LINE app');
}

function testDashboardStats() {
  var stats = getDashboardStats();
  Logger.log('Dashboard Stats: ' + JSON.stringify(stats, null, 2));
}
