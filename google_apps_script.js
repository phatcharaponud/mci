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
