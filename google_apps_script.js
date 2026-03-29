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
// =====================================================

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('RCA_Data');
  if (!sheet) {
    return ContentService.createTextOutput('[]').setMimeType(ContentService.MimeType.JSON);
  }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return ContentService.createTextOutput('[]').setMimeType(ContentService.MimeType.JSON);
  }
  var result = [];
  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  for (var i = 0; i < data.length; i++) {
    try {
      var json = data[i][6]; // Column G = full JSON data
      if (json) result.push(JSON.parse(json));
    } catch(err) {
      // skip invalid rows
    }
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('RCA_Data');
  if (!sheet) {
    sheet = ss.insertSheet('RCA_Data');
    sheet.getRange('A1:G1').setValues([['ID', 'เรื่อง', 'หน่วยงาน', 'วันที่', 'ความรุนแรง', 'สถานะ', 'JSON_Data']]);
    sheet.getRange('A1:G1').setFontWeight('bold');
    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(2, 250);
    sheet.setColumnWidth(3, 150);
    sheet.setColumnWidth(4, 100);
    sheet.setColumnWidth(5, 100);
    sheet.setColumnWidth(6, 100);
    sheet.setColumnWidth(7, 400);
  }

  var records = JSON.parse(e.postData.contents);

  // Clear old data (keep header row)
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 7).clearContent();
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
    sheet.getRange(2, 1, rows.length, 7).setValues(rows);
  }

  return ContentService.createTextOutput(
    JSON.stringify({ status: 'ok', count: records.length })
  ).setMimeType(ContentService.MimeType.JSON);
}
