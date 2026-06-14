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

### সব ফরম্যাট একসাথে (Installer + Portable):
```bash
npm run build-all
```

### শুধু Installer:
```bash
npm run build-nsis
```

### শুধু Portable (ইনস্টল ছাড়া চালানোর জন্য):
```bash
npm run build-portable
```

---

## 📦 Output Files (dist/ ফোল্ডারে)

| ফাইল | ধরন | ব্যবহার |
|---|---|---|
| `Install App.exe` | NSIS Installer | পিসিতে ইনস্টল করার জন্য (সাধারণ ব্যবহারকারীর জন্য) |
| `Start with double click.exe` | Portable | ইনস্টল ছাড়া সরাসরি ডাবল ক্লিক করে চালানোর জন্য |

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

### CI/CD (GitHub Actions) এ অটোমেটেড সাইনিং করার প্রক্রিয়া:
১. একটি `.pfx` বা `.p12` সার্টিফিকেট সংগ্রহ করুন।
২. সার্টিফিকেট ফাইলটিকে Base64 এ কনভার্ট করুন:
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("your_cert.pfx"))
   ```
৩. গিটহাব রিপোজিটরির **Settings > Secrets and variables > Actions** এ গিয়ে ২টি Secret যুক্ত করুন:
   - `CSC_LINK`: আপনার কনভার্ট করা Base64 টেক্সট।
   - `CSC_KEY_PASSWORD`: সার্টিফিকেটের পাসওয়ার্ড।
৪. `electron-builder` বিল্ড করার সময় এই Environment Variable গুলো স্বয়ংক্রিয়ভাবে ডিটেক্ট করবে এবং জেনারেট হওয়া `.exe` ফাইলগুলোকে সাইন করে দেবে।

বর্তমানে লোকাল বিল্ডের জন্য `package.json` এ `"signAndEditExecutable": false` রাখা হয়েছে।
