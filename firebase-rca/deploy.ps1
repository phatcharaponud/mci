# Deploy RCA Management System -> https://rca-up-hospital.web.app
# วิธีใช้:  powershell -ExecutionPolicy Bypass -File C:\firebase-rca\deploy.ps1

$ErrorActionPreference = 'Stop'
$base = 'https://raw.githubusercontent.com/phatcharaponud/mci/claude/display-rca-code-91yTH/firebase-rca'
$root = 'C:\firebase-rca'
$nc   = Get-Random

Write-Host '== กำลังดาวน์โหลดไฟล์ล่าสุดจาก GitHub ==' -ForegroundColor Cyan

# 1) หน้าเว็บ
Invoke-WebRequest -Uri "$base/public/index.html?nocache=$nc" -OutFile "$root\public\index.html"

# 2) กฎความปลอดภัยของฐานข้อมูล  <<< สำคัญมาก
#    firebase.json ของโปรเจกต์นี้ประกาศทั้ง hosting และ firestore ไว้
#    คำสั่ง firebase deploy จึงอัปโหลด firestore.rules ในเครื่องทับกฎบน Console ทุกครั้ง
#    ถ้าไม่ดึงไฟล์นี้มาอัปเดตด้วย กฎเก่าจะทับกฎใหม่ แล้วผู้ใช้จะบันทึกไม่ได้ / มองไม่เห็นข้อมูล
Invoke-WebRequest -Uri "$base/firestore.rules?nocache=$nc" -OutFile "$root\firestore.rules"

# 3) ตรวจไฟล์ก่อน deploy - ถ้าไม่ครบให้หยุด ไม่ทับของเดิมบนเว็บ
if (-not (Select-String -Path "$root\public\index.html" -Pattern 'apiKey: "AIza' -Quiet)) {
    Write-Host 'index.html ไม่สมบูรณ์ (ไม่พบ apiKey) - ยกเลิกการ deploy' -ForegroundColor Red
    exit 1
}
if (-not (Select-String -Path "$root\firestore.rules" -Pattern 'match /rca/' -Quiet)) {
    Write-Host 'firestore.rules ไม่สมบูรณ์ - ยกเลิกการ deploy' -ForegroundColor Red
    exit 1
}

Write-Host 'ไฟล์ครบถ้วน กำลัง deploy...' -ForegroundColor Green
Set-Location $root
firebase deploy

Write-Host ''
Write-Host 'เสร็จแล้ว เปิด https://rca-up-hospital.web.app แล้วกด Ctrl+Shift+R' -ForegroundColor Green
