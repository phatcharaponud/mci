// ===== Google Apps Script สำหรับแบบสอบถาม HA Survey =====
// วิธีติดตั้ง:
// 1. สร้าง Google Sheet ใหม่
// 2. ไปที่เมนู Extensions > Apps Script
// 3. ลบโค้ดเดิมทั้งหมด แล้ววางโค้ดนี้ลงไป
// 4. กด Deploy > New deployment
//    - Select type: Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 5. กด Deploy แล้วคัดลอก URL ที่ได้
// 6. นำ URL ไปใส่ในไฟล์ survey.html ที่บรรทัด const SCRIPT_URL = '...'
// =====================================================

var SURVEY_SHEET = 'Survey_Responses';

var SURVEY_HEADERS = [
  'Timestamp', 'ResponseID',
  // ส่วนที่ 1 - ข้อมูลทั่วไป
  'เพศ', 'อายุ', 'วุฒิการศึกษา', 'ตำแหน่งงาน', 'หน่วยงาน', 'ประสบการณ์',
  // ส่วนที่ 2 - การมีส่วนร่วม (ข้อ 1-10)
  'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10',
  // ส่วนที่ 2 - ภาวะผู้นำ (ข้อ 11-21)
  'q11', 'q12', 'q13', 'q14', 'q15', 'q16', 'q17', 'q18', 'q19', 'q20', 'q21',
  // ส่วนที่ 2 - การศึกษาและการฝึกอบรม (ข้อ 22-25)
  'q22', 'q23', 'q24', 'q25',
  // ส่วนที่ 2 - พลังอำนาจและแรงจูงใจ (ข้อ 26-30)
  'q26', 'q27', 'q28', 'q29', 'q30',
  // ส่วนที่ 3 - ประโยชน์ (ข้อ 31-39)
  'q31', 'q32', 'q33', 'q34', 'q35', 'q36', 'q37', 'q38', 'q39',
  // ส่วนที่ 4 - ความคิดเห็น
  'ปัญหา_อุปสรรค', 'ข้อเสนอแนะ'
];

function getOrCreateSurveySheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SURVEY_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(SURVEY_SHEET);
    sheet.getRange(1, 1, 1, SURVEY_HEADERS.length).setValues([SURVEY_HEADERS]);
    sheet.getRange(1, 1, 1, SURVEY_HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#1a5276')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 180); // Timestamp
    sheet.setColumnWidth(2, 140); // ResponseID
  }
  return sheet;
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';

  if (action === 'stats') {
    return getStats();
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: 'HA Survey API'
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var sheet = getOrCreateSurveySheet();

    var row = [
      new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
      body.responseId || Utilities.getUuid(),
      body.gender || '',
      body.age || '',
      body.education || '',
      body.position || '',
      body.department || '',
      body.experience || ''
    ];

    // ข้อ 1-39 (Likert scale)
    for (var i = 1; i <= 39; i++) {
      row.push(body['q' + i] || '');
    }

    // ส่วนที่ 4
    row.push(body.problems || '');
    row.push(body.suggestions || '');

    sheet.appendRow(row);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      responseId: row[1]
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// สถิติพื้นฐาน
function getStats() {
  var sheet = getOrCreateSurveySheet();
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return ContentService.createTextOutput(JSON.stringify({
      totalResponses: 0
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var data = sheet.getRange(2, 1, lastRow - 1, SURVEY_HEADERS.length).getValues();
  var stats = {
    totalResponses: data.length,
    gender: {},
    age: {},
    education: {},
    position: {},
    department: {},
    experience: {}
  };

  // นับความถี่ ส่วนที่ 1
  var demoFields = ['gender', 'age', 'education', 'position', 'department', 'experience'];
  var demoIndices = [2, 3, 4, 5, 6, 7]; // column indices (0-based)

  for (var i = 0; i < data.length; i++) {
    for (var j = 0; j < demoFields.length; j++) {
      var val = data[i][demoIndices[j]] || 'ไม่ระบุ';
      if (!stats[demoFields[j]][val]) stats[demoFields[j]][val] = 0;
      stats[demoFields[j]][val]++;
    }
  }

  // ค่าเฉลี่ยและ SD ของแต่ละข้อ (ข้อ 1-39)
  var likertStart = 8; // column index 0-based for q1
  var questionStats = [];

  for (var q = 0; q < 39; q++) {
    var values = [];
    for (var r = 0; r < data.length; r++) {
      var v = parseInt(data[r][likertStart + q], 10);
      if (v >= 1 && v <= 5) values.push(v);
    }
    var mean = 0, sd = 0, n = values.length;
    if (n > 0) {
      var sum = 0;
      for (var k = 0; k < n; k++) sum += values[k];
      mean = sum / n;
      var sumSq = 0;
      for (var k = 0; k < n; k++) sumSq += Math.pow(values[k] - mean, 2);
      sd = n > 1 ? Math.sqrt(sumSq / (n - 1)) : 0;
    }
    questionStats.push({
      question: 'q' + (q + 1),
      n: n,
      mean: Math.round(mean * 100) / 100,
      sd: Math.round(sd * 100) / 100
    });
  }

  stats.questionStats = questionStats;

  return ContentService.createTextOutput(JSON.stringify(stats))
    .setMimeType(ContentService.MimeType.JSON);
}

function testSurveySetup() {
  var sheet = getOrCreateSurveySheet();
  Logger.log('Sheet "' + SURVEY_SHEET + '" ready. Rows: ' + sheet.getLastRow());
  Logger.log('Headers: ' + SURVEY_HEADERS.length + ' columns');
}
