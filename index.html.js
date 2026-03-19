/**
 * ============================================
 * Google Apps Script — MCI Backend
 * ============================================
 * 
 * วิธีติดตั้ง:
 * 1. เปิด Google Sheets ใหม่
 * 2. ไปที่ Extensions > Apps Script
 * 3. วาง code นี้ทั้งหมดแทน Code.gs
 * 4. สร้าง Sheet ดังนี้:
 *    - Sheet ชื่อ "MCI_Events"
 *    - Sheet ชื่อ "Patients"  
 *    - Sheet ชื่อ "Ambulances"
 *    - Sheet ชื่อ "Hospitals"
 * 5. Deploy > New deployment > Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. คัดลอก URL ไปใส่ในไฟล์ React (ค่า GOOGLE_SCRIPT_URL)
 * 
 * Sheet Headers (แถวแรกของแต่ละ Sheet):
 * 
 * MCI_Events: id | name | location | date | status
 * Patients:   mci_id | id | scene | triage | name | hn | age | edTriage | diagnosis | status | destination | o2 | arrival | disp | blood | note
 * Ambulances: mci_id | id | vehicleName | vehicleType | plateNumber | team | arrivalTime | departureTime | fromScene | hospital | patientCount | note
 * Hospitals:  mci_id | id | name | capacity | received | redCount | yellowCount | greenCount | blackCount | contact | note
 */

// ====== CORS HEADERS ======
function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}

// ====== MAIN HANDLERS ======
function doGet(e) {
  try {
    const action = e.parameter.action;
    let result;

    switch (action) {
      case 'getAllMCI':
        result = getAllMCI();
        break;
      case 'getMCI':
        result = getMCIById(e.parameter.id);
        break;
      case 'getPatients':
        result = getPatientsByMCI(e.parameter.mci_id);
        break;
      case 'getAmbulances':
        result = getAmbulancesByMCI(e.parameter.mci_id);
        break;
      case 'getHospitals':
        result = getHospitalsByMCI(e.parameter.mci_id);
        break;
      default:
        result = { error: 'Unknown action' };
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    let result;

    switch (action) {
      case 'createMCI':
        result = createMCI(data.mci);
        break;
      case 'updateMCI':
        result = updateMCI(data.mci);
        break;
      case 'deleteMCI':
        result = deleteMCI(data.id);
        break;
      case 'savePatient':
        result = savePatient(data.mci_id, data.patient);
        break;
      case 'deletePatient':
        result = deletePatient(data.mci_id, data.patient_id);
        break;
      case 'saveAmbulance':
        result = saveAmbulance(data.mci_id, data.ambulance);
        break;
      case 'deleteAmbulance':
        result = deleteAmbulance(data.mci_id, data.ambulance_id);
        break;
      case 'saveHospital':
        result = saveHospital(data.mci_id, data.hospital);
        break;
      case 'deleteHospital':
        result = deleteHospital(data.mci_id, data.hospital_id);
        break;
      case 'saveFull':
        result = saveFullMCI(data.mci);
        break;
      default:
        result = { error: 'Unknown action' };
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ====== HELPER FUNCTIONS ======
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Add headers
    const headers = {
      'MCI_Events': ['id', 'name', 'location', 'date', 'status'],
      'Patients': ['mci_id', 'id', 'scene', 'triage', 'name', 'hn', 'age', 'edTriage', 'diagnosis', 'status', 'destination', 'o2', 'arrival', 'disp', 'blood', 'note'],
      'Ambulances': ['mci_id', 'id', 'vehicleName', 'vehicleType', 'plateNumber', 'team', 'arrivalTime', 'departureTime', 'fromScene', 'hospital', 'patientCount', 'note'],
      'Hospitals': ['mci_id', 'id', 'name', 'capacity', 'received', 'redCount', 'yellowCount', 'greenCount', 'blackCount', 'contact', 'note']
    };
    if (headers[name]) {
      sheet.appendRow(headers[name]);
      sheet.getRange(1, 1, 1, headers[name].length).setFontWeight('bold').setBackground('#f0f0f0');
    }
  }
  return sheet;
}

function sheetToArray(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function findRowIndex(sheet, colIndex, value) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colIndex]) === String(value)) return i + 1; // 1-indexed
  }
  return -1;
}

// ====== MCI EVENTS ======
function getAllMCI() {
  const sheet = getSheet('MCI_Events');
  const events = sheetToArray(sheet);
  
  // Attach patients, ambulances, hospitals to each event
  return events.map(evt => ({
    ...evt,
    patients: getPatientsByMCI(evt.id),
    ambulances: getAmbulancesByMCI(evt.id),
    hospitals: getHospitalsByMCI(evt.id),
    blood: { A: 0, B: 0, AB: 0, O: 0 },
    ventilators: { ER: { vent: 0, bird: 0 }, center: { vent: 0, bird: 0 } }
  }));
}

function getMCIById(id) {
  const sheet = getSheet('MCI_Events');
  const events = sheetToArray(sheet);
  const evt = events.find(e => String(e.id) === String(id));
  if (!evt) return { error: 'MCI not found' };
  evt.patients = getPatientsByMCI(id);
  evt.ambulances = getAmbulancesByMCI(id);
  evt.hospitals = getHospitalsByMCI(id);
  return evt;
}

function createMCI(mci) {
  const sheet = getSheet('MCI_Events');
  sheet.appendRow([mci.id, mci.name, mci.location, mci.date, mci.status || 'open']);
  return { success: true, id: mci.id };
}

function updateMCI(mci) {
  const sheet = getSheet('MCI_Events');
  const row = findRowIndex(sheet, 0, mci.id);
  if (row === -1) return createMCI(mci);
  sheet.getRange(row, 1, 1, 5).setValues([[mci.id, mci.name, mci.location, mci.date, mci.status]]);
  return { success: true };
}

function deleteMCI(id) {
  const sheet = getSheet('MCI_Events');
  const row = findRowIndex(sheet, 0, id);
  if (row > 0) sheet.deleteRow(row);
  
  // Also delete related data
  deleteByMCIId('Patients', id);
  deleteByMCIId('Ambulances', id);
  deleteByMCIId('Hospitals', id);
  return { success: true };
}

function deleteByMCIId(sheetName, mciId) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(mciId)) sheet.deleteRow(i + 1);
  }
}

// ====== PATIENTS ======
function getPatientsByMCI(mciId) {
  const sheet = getSheet('Patients');
  return sheetToArray(sheet).filter(p => String(p.mci_id) === String(mciId));
}

function savePatient(mciId, patient) {
  const sheet = getSheet('Patients');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = findRowByTwo(sheet, 0, mciId, 1, patient.id);
  const rowData = headers.map(h => {
    if (h === 'mci_id') return mciId;
    return patient[h] !== undefined ? patient[h] : '';
  });
  
  if (row > 0) {
    sheet.getRange(row, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  return { success: true };
}

function deletePatient(mciId, patientId) {
  const sheet = getSheet('Patients');
  const row = findRowByTwo(sheet, 0, mciId, 1, patientId);
  if (row > 0) sheet.deleteRow(row);
  return { success: true };
}

// ====== AMBULANCES ======
function getAmbulancesByMCI(mciId) {
  const sheet = getSheet('Ambulances');
  return sheetToArray(sheet).filter(a => String(a.mci_id) === String(mciId));
}

function saveAmbulance(mciId, ambulance) {
  const sheet = getSheet('Ambulances');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = findRowByTwo(sheet, 0, mciId, 1, ambulance.id);
  const rowData = headers.map(h => {
    if (h === 'mci_id') return mciId;
    return ambulance[h] !== undefined ? ambulance[h] : '';
  });
  
  if (row > 0) {
    sheet.getRange(row, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  return { success: true };
}

function deleteAmbulance(mciId, ambulanceId) {
  const sheet = getSheet('Ambulances');
  const row = findRowByTwo(sheet, 0, mciId, 1, ambulanceId);
  if (row > 0) sheet.deleteRow(row);
  return { success: true };
}

// ====== HOSPITALS ======
function getHospitalsByMCI(mciId) {
  const sheet = getSheet('Hospitals');
  return sheetToArray(sheet).filter(h => String(h.mci_id) === String(mciId));
}

function saveHospital(mciId, hospital) {
  const sheet = getSheet('Hospitals');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = findRowByTwo(sheet, 0, mciId, 1, hospital.id);
  const rowData = headers.map(h => {
    if (h === 'mci_id') return mciId;
    return hospital[h] !== undefined ? hospital[h] : '';
  });
  
  if (row > 0) {
    sheet.getRange(row, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  return { success: true };
}

function deleteHospital(mciId, hospitalId) {
  const sheet = getSheet('Hospitals');
  const row = findRowByTwo(sheet, 0, mciId, 1, hospitalId);
  if (row > 0) sheet.deleteRow(row);
  return { success: true };
}

// ====== FULL SAVE (Save entire MCI state at once) ======
function saveFullMCI(mci) {
  // Save MCI event
  updateMCI(mci);
  
  // Clear and re-save all patients
  deleteByMCIId('Patients', mci.id);
  if (mci.patients && mci.patients.length > 0) {
    mci.patients.forEach(p => savePatient(mci.id, p));
  }
  
  // Clear and re-save all ambulances
  deleteByMCIId('Ambulances', mci.id);
  if (mci.ambulances && mci.ambulances.length > 0) {
    mci.ambulances.forEach(a => saveAmbulance(mci.id, a));
  }
  
  // Clear and re-save all hospitals
  deleteByMCIId('Hospitals', mci.id);
  if (mci.hospitals && mci.hospitals.length > 0) {
    mci.hospitals.forEach(h => saveHospital(mci.id, h));
  }
  
  return { success: true, id: mci.id };
}

// ====== UTILITY ======
function findRowByTwo(sheet, col1, val1, col2, val2) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][col1]) === String(val1) && String(data[i][col2]) === String(val2)) return i + 1;
  }
  return -1;
}

// ====== SETUP FUNCTION (run once) ======
function setupSheets() {
  getSheet('MCI_Events');
  getSheet('Patients');
  getSheet('Ambulances');
  getSheet('Hospitals');
  Logger.log('All sheets created successfully!');
}
