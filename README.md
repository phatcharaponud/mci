# ระบบจัดการข้อร้องเรียน (CM-UPH)

Hospital Complaint Management System — โรงพยาบาลมหาวิทยาลัยพะเยา

**Production:** https://cm-uph.web.app

## โครงสร้างไฟล์

| ไฟล์ | หน้าที่ |
|------|---------|
| `index.html` | เว็บแอปหลัก (React SPA ไฟล์เดียว) — แก้ไขไฟล์นี้โดยตรง |
| `hospital_complaint_gas.js` | Google Apps Script — ฐานข้อมูล Google Sheets + LINE แจ้งเตือน |
| `firebase.json` | ค่าตั้ง Firebase Hosting + Firestore rules |
| `firestore.rules` | กฎความปลอดภัย Firestore (production) |
| `user-manual.html` | คู่มือการใช้งาน (เปิดที่ /user-manual.html) |

## สถาปัตยกรรม

- **Frontend:** React 18 + Babel Standalone (CDN) ไฟล์ HTML เดียว
- **Auth:** Firebase Authentication (Google OAuth เฉพาะ @up.ac.th) + PIN 4-6 หลัก (SHA-256 + salt)
- **ฐานข้อมูลผู้ใช้:** Cloud Firestore (collection `users`)
- **ฐานข้อมูลข้อร้องเรียน:** localStorage + sync ไป Google Sheets ผ่าน Apps Script
- **แจ้งเตือน:** LINE Messaging API (ผ่าน Apps Script)
- **Hosting:** Firebase Hosting

## Database Schema

### Firestore — collection `users` (doc id = Firebase UID)
```
email, fullName, firstName, lastName, department,
status: pending|approved|rejected, role: user|crm|admin,
pinHash, pinSalt, pinFailCount, pinLockUntil,
createdAt, approvedAt
```

### localStorage `hcms_db_v1` (sync ไป Google Sheets)
```
complaints[]: id, date, name, cStatus, channel, subject, detail,
              unit, severity(1-3), centerAction, recorder,
              tagDepts[], tagStaff[], by, createdAt,
              inv{facts,root,sol,resp,invDate}, res{actions,result,preventive,done}
meetings[]:   id, title, date, time, location, createdBy, createdAt
```

### Google Sheets (สร้างอัตโนมัติโดย GAS)
`Complaints` / `Users` / `Staff` / `LineConfig` / `ActivityLog`

## การ Deploy

```bash
firebase deploy --only hosting          # ขึ้นเว็บ
firebase deploy --only firestore:rules  # อัปเดตกฎ Firestore
```

## ค่าที่ตั้งไว้ใน index.html

- `firebaseConfig` — โปรเจกต์ cm-uph
- `ADMIN_EMAIL` — admin หลัก (auto-approve)
- `CLOUD_URL` — URL ของ Google Apps Script Web App

## การอัปเดต Google Apps Script

1. เปิด Google Sheet → Extensions → Apps Script
2. วางโค้ดจาก `hospital_complaint_gas.js` (คงค่า `LINE_CHANNEL_TOKEN` / `LINE_TARGET_ID` เดิมไว้)
3. Deploy → Manage deployments → New version → Deploy

---
ริเริ่มระบบด้วย phatcharapon ud
