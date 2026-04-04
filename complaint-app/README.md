# ระบบจัดการข้อร้องเรียน - โรงพยาบาลมหาวิทยาลัยพะเยา

Hospital Complaint Management System powered by Firebase

## การติดตั้ง

### 1. ตั้งค่า Firebase Project

1. ไปที่ [Firebase Console](https://console.firebase.google.com/)
2. สร้าง Project ใหม่
3. เปิดใช้งาน **Authentication** > **Email/Password**
4. เปิดใช้งาน **Cloud Firestore** (เลือก production mode)
5. ไปที่ Project Settings > General > Your apps > เพิ่ม Web App
6. คัดลอก Firebase config

### 2. ตั้งค่า Environment Variables

```bash
cp .env.example .env.local
```

แก้ไข `.env.local` ใส่ค่าจาก Firebase Console:

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 3. ติดตั้ง Dependencies

```bash
npm install
```

### 4. สร้างบัญชีผู้ใช้ทดสอบ

ไปที่ Firebase Console > Authentication > Users > Add user:
- `admin@up.ac.th` / รหัสผ่านที่ต้องการ (จะได้สิทธิ์ Admin อัตโนมัติ)
- `user@up.ac.th` / รหัสผ่านที่ต้องการ

### 5. Deploy Firestore Rules

```bash
npx firebase deploy --only firestore:rules
```

### 6. รันโปรเจกต์

```bash
npm run dev
```

เปิด http://localhost:5173

## การ Deploy

```bash
npm run build
npx firebase deploy --only hosting
```

## โครงสร้างโปรเจกต์

```
complaint-app/
├── src/
│   ├── App.jsx              # Main application component
│   ├── main.jsx             # React entry point
│   ├── firebase.js          # Firebase configuration
│   └── hooks/
│       ├── useAuth.js       # Firebase Authentication hook
│       └── useComplaints.js # Firestore CRUD hook
├── firebase.json            # Firebase Hosting config
├── firestore.rules          # Firestore security rules
├── .env.example             # Environment variables template
└── package.json
```

## เทคโนโลยี

- **Frontend**: React 18 + Vite
- **Backend**: Firebase (Auth + Firestore)
- **Hosting**: Firebase Hosting
- **Charts**: Recharts
- **UI**: Inline styles (no CSS framework)
