# Antigravity PDF Pro — Build Guide
**Version:** 1.0.0

---

## 🔧 Build করার আগে Prerequisites

### ১. Node.js ইনস্টল করুন
- Node.js 18+ লাগবে: https://nodejs.org/

### ২. Dependencies ইনস্টল করুন
```bash
npm install
```

### ৩. আইকন নিশ্চিত করুন
`assets/icon.ico` ফাইল থাকতে হবে (এখন আছে ✅)

---

## 🚀 Build Commands

### সব ফরম্যাট একসাথে (NSIS + MSI + Portable):
```bash
npm run build-all
```

### শুধু MSI Installer:
```bash
npm run build-msi
```

### শুধু NSIS Installer (সাধারণ .exe setup):
```bash
npm run build-nsis
```

### শুধু Portable (.exe, install ছাড়া):
```bash
npm run build-portable
```

---

## 📦 Output Files (dist/ ফোল্ডারে)

| ফাইল | ধরন | ব্যবহার |
|---|---|---|
| `Antigravity-PDF-Pro-Setup-1.0.0.exe` | NSIS Installer | সাধারণ ব্যবহারকারীর জন্য |
| `Antigravity-PDF-Pro-1.0.0-x64.msi` | MSI Installer | IT/Enterprise deployment |
| `Antigravity-PDF-Pro-1.0.0-Portable.exe` | Portable | ইনস্টল ছাড়া চালানো |

---

## 🔍 MSI vs NSIS পার্থক্য

| বিষয় | NSIS (.exe) | MSI |
|---|---|---|
| সাধারণ ব্যবহারকারী | ✅ সহজ | ❌ কম পরিচিত |
| IT/Enterprise | ❌ | ✅ Group Policy দিয়ে deploy |
| Silent install | `setup.exe /S` | `msiexec /i file.msi /quiet` |
| Uninstall | Control Panel | Control Panel |
| File association | ✅ (installer.nsh) | ✅ |

---

## ⚠️ সমস্যা হলে

### Error: "NSIS not found"
```bash
npm install --save-dev electron-builder
```

### Error: "icon.ico not found"
`assets/icon.ico` ফাইল আছে কিনা দেখুন।

### MSI build failed on non-Windows
MSI build শুধু Windows এ কাজ করে। Linux/Mac এ শুধু NSIS portable তৈরি হবে।

---

## 📝 Code Signing (ভবিষ্যতের জন্য)

Windows SmartScreen warning এড়াতে Code Signing Certificate লাগবে:
- **Comodo/Sectigo:** ~$100/year
- **DigiCert:** ~$500/year  
- **প্রক্রিয়া:** Certificate কিনুন → `package.json` এ `"certificateFile"` যোগ করুন

এখনকে জন্য `"signAndEditExecutable": false` রাখা হয়েছে।
