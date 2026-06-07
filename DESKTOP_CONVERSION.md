# Antigravity PDF Pro — Desktop App Conversion Guide

**তৈরি:** June 2026  
**Status:** ✅ সম্পূর্ণ — Build করার জন্য প্রস্তুত

---

## নতুন যা যোগ হয়েছে

| ফাইল | বিবরণ |
|---|---|
| `main.js` | Electron entry point — window তৈরি, server চালু, menu |
| `preload.js` | Renderer ↔ Main process সেতু (IPC) |
| `server.js` | আপডেট — packaged app এ path সঠিকভাবে কাজ করে |
| `package.json` | আপডেট — Electron + electron-builder যোগ |
| `index.html` | আপডেট — Electron bridge script inject করা হয়েছে |
| `BUILD.bat` | এক ক্লিকে installer + portable .exe বানানোর script |
| `DEV_START.bat` | Development mode এ চালানোর script |
| `assets/CREATE_ICON.md` | আইকন বানানোর নির্দেশনা |

---

## প্রথমবার সেটআপ

### Step 1 — Dependencies install করুন
```
npm install
```
এটা Electron (~100MB) এবং electron-builder ডাউনলোড করবে।

### Step 2 — Development mode এ টেস্ট করুন
```
DEV_START.bat
```
অথবা:
```
npm run dev
```
অ্যাপটা Electron window এ খুলবে। DevTools দিয়ে debug করা যাবে।

### Step 3 — Build করুন (optional)
```
BUILD.bat
```
অথবা:
```
npm run build
```

⚠️ **Build এর আগে:** `assets/icon.ico` ফাইল তৈরি করুন।  
`assets/CREATE_ICON.md` দেখুন।

---

## কী কী পরিবর্তন হয়েছে

### server.js
- Archive directory এখন `~/.antigravity-pdf-pro/archive/` (user home এ)
- qpdf.exe path packaged app এও সঠিকভাবে resolve হয়

### index.html (শেষে inject করা হয়েছে)
- `window.electronAPI` bridge:
  - File > Open PDF menu থেকে file খোলা যায়
  - Window title auto-update
  - Blob download এ native save dialog

### package.json
- `main`: `server.js` → `main.js`
- Electron 31, electron-builder 24 যোগ
- Build config: NSIS installer + Portable exe

---

## Folder Structure (after build)

```
dist/
└── win-unpacked/                          ← Unpacked app folder (run Antigravity PDF Pro.exe inside)
```

---

## Troubleshooting

### "Cannot find module 'electron'"
```
npm install
```

### Build fails — icon error
`package.json` এর `"win"` section থেকে `"icon"` line সরিয়ে দিন।

### App opens but blank white screen
- `DEV_START.bat` দিয়ে চালান
- DevTools console এ error দেখুন
- server port 3000 অন্য app ব্যবহার করছে কিনা দেখুন

### qpdf (protect/unlock) কাজ করছে না packaged app এ
`package.json` এর `extraResources` config চেক করুন — `bin/` folder include আছে কিনা দেখুন।

---

## Archive Location

Browser version: `[project]/archive/`  
Desktop version: `C:\Users\[username]\.antigravity-pdf-pro\archive\`

আগের archive data নতুন location এ copy করুন যদি transfer করতে চান।

---

*এই conversion এ existing code এর ৯৫%+ অপরিবর্তিত রয়েছে।*
