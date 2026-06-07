# Antigravity PDF Pro — Master Plan & Handoff Document
**Version:** 1.0 | **তৈরি:** 2026-06-07  
**উদ্দেশ্য:** যেকোনো নতুন AI session এ এই ফাইলটা upload করলেই পুরো context বোঝা যাবে এবং কাজ শুরু করা যাবে।

---

## 📌 প্রজেক্ট পরিচয়

| বিষয় | তথ্য |
|---|---|
| অ্যাপের নাম | Antigravity PDF Pro |
| ধরন | Electron Desktop App (Windows) |
| Backend | Express.js (localhost:3000) — Electron এর ভেতরে fork হয় |
| Frontend | Vanilla JS + HTML/CSS (CDN-dependent) |
| বর্তমান version | 1.0.0 |
| মালিক | Shakib (কোডিং জানেন না, AI দিয়ে সব কাজ করেন) |
| উদ্দেশ্য | Business PDF editing app |

### প্রজেক্ট স্ট্রাকচার
```
Antigravity-PDF-Pro/
├── main.js              ← Electron entry point, server fork করে
├── server.js            ← Express backend
├── index.html           ← Main UI
├── style.css
├── preload.js
├── core/
│   ├── renderer.js      ← PDF render + bg canvas cache
│   ├── state.js
│   ├── undo.js
│   └── utils.js
├── editor/
│   ├── text-editor.js   ← Text add/edit/clear
│   ├── image-toolbar.js ← Image insert
│   ├── shapes.js
│   ├── eraser.js
│   ├── init.js
│   └── save-pdf.js
├── tools/
│   ├── merge-pdf.js
│   ├── split-pdf.js
│   ├── rotate-pdf.js
│   └── watermark-pdf.js
├── converters/
│   ├── pdf-to-word.js
│   ├── pdf-to-image.js
│   ├── image-to-pdf.js
│   ├── ocr-pdf.js
│   └── ... (আরও কয়েকটা)
├── ui/
├── bin/                 ← qpdf.exe + Windows DLLs
├── assets/
├── archive/             ← কাজের ফাইল archive
└── dist/                ← Build output
```

---

## 🔴 PHASE 0 — স্ট্যাবিলাইজেশন (সবার আগে করতে হবে)

### 0-A. CDN → Local Migration [CRITICAL]

**সমস্যা:** index.html এ pdf.js, pdf-lib, lucide এবং অন্যান্য লাইব্রেরি CDN (unpkg/cdnjs) থেকে লোড হচ্ছে। ইন্টারনেট ছাড়া অ্যাপ কাজ করে না।

**কাজ:**
- `ui/libs/` ফোল্ডার তৈরি করুন
- নিচের ফাইলগুলো download করে সেখানে রাখুন:
  - `pdf.min.js` + `pdf.worker.min.js` (pdfjs-dist) — node_modules এ আছে, সেখান থেকে কপি করুন
  - `pdf-lib.min.js` — node_modules এ আছে
  - `lucide.min.js` — CDN থেকে download করুন
- `index.html` এ CDN URL গুলো `./ui/libs/` path দিয়ে replace করুন

**AI কে বলুন:**
> "Antigravity PDF Pro এর index.html এ যে CDN script tags আছে সেগুলো local files দিয়ে replace করো। node_modules থেকে pdf.js এবং pdf-lib কপি করো ui/libs/ ফোল্ডারে।"

---

### 0-B. ফিচার টেস্ট স্ট্যাটাস

নিচের প্রতিটা ফিচার manually টেস্ট করুন এবং ✅/❌ আপডেট করুন:

| # | ফিচার | ফাইল | টেস্ট স্ট্যাটাস | নোট |
|---|---|---|---|---|
| 1 | PDF আপলোড ও লোড | core/renderer.js | ⬜ অজানা | |
| 2 | টেক্সট ক্লিক করে এডিট | editor/text-editor.js | ⬜ অজানা | |
| 3 | নতুন টেক্সট যোগ | editor/text-editor.js | ✅ v4 তে fix | double-write bug ঠিক হয়েছে |
| 4 | Font/Size/Color টুলবার | editor/init.js | ⬜ অজানা | |
| 5 | Bold/Italic/Underline | core/utils.js | ⬜ অজানা | |
| 6 | Undo / Redo | core/undo.js | ⬜ অজানা | |
| 7 | Shapes আঁকা | editor/shapes.js | ⬜ অজানা | |
| 8 | Image insert | editor/image-toolbar.js | ✅ v4 তে fix | |
| 9 | Eyedropper / Eraser | editor/eraser.js | ⬜ অজানা | |
| 10 | ClearText (gradient bg) | editor/text-editor.js | ✅ v4 তে fix | pixel-accurate inpainting |
| 11 | White Eraser button color | index.html | ✅ v4 তে fix | |
| 12 | PDF Save (Download) | editor/save-pdf.js | ✅ সম্পন্ন | saved with auto-backup in Phase 1-D |
| 13 | Archive save/restore | server.js + save-pdf.js | ⬜ অজানা | |
| 14 | Merge PDF | tools/merge-pdf.js | ⬜ অজানা | |
| 15 | Split PDF | tools/split-pdf.js | ⬜ অজানা | |
| 16 | Rotate PDF | tools/rotate-pdf.js | ⬜ অজানা | |
| 17 | Watermark | tools/watermark-pdf.js | ⬜ অজানা | |
| 18 | PDF to Word | converters/pdf-to-word.js | ⬜ অজানা | |
| 19 | PDF to Image | converters/pdf-to-image.js | ⬜ অজানা | |
| 20 | Image to PDF | converters/image-to-pdf.js | ⬜ অজানা | |
| 21 | OCR (PDF to Text) | converters/ocr-pdf.js | ✅ implemented | |
| 22 | Page Numbers | ui/page-numbers.js | ⬜ অজানা | |
| 23 | Page change bg cache | core/renderer.js | ✅ v4 তে fix | |

### 0-C. Error Logging যোগ করুন

**কাজ:** `electron-log` package যোগ করুন যাতে ক্র্যাশ বা error হলে log file তৈরি হয়।

**AI কে বলুন:**
> "Antigravity PDF Pro এর main.js এ electron-log যোগ করো। Unhandled exception এবং server crash গুলো log file এ লিখবে। Log file location হবে userData/.logs/ ফোল্ডারে।"

---

## 🟡 PHASE 1 — UX ইমপ্রুভমেন্ট (Phase 0 শেষে)

### 1-A. Dark Mode

**বিবরণ:** Light/Dark toggle button, system preference অনুযায়ী default।

**AI কে বলুন:**
> "Antigravity PDF Pro এ Dark Mode যোগ করো। CSS variables দিয়ে করো যাতে সব color একজায়গা থেকে control হয়। Header এ একটা toggle button রাখো। User এর choice electron-store দিয়ে save করো যাতে পরবর্তীতে অ্যাপ খুললে মনে থাকে।"

---

### 1-B. Recent Files (File History)

**বিবরণ:** Dashboard এ সম্প্রতি খোলা ফাইলগুলো দেখাবে, click করলে সরাসরি খুলবে।

**AI কে বলুন:**
> "Antigravity PDF Pro এ Recent Files ফিচার যোগ করো। electron-store দিয়ে সর্বশেষ ১০টা opened file এর path ও নাম save করো। Dashboard এ এগুলো list হিসেবে দেখাবে। localStorage ব্যবহার করো না, electron-store ব্যবহার করো।"

---

### 1-C. Drag & Drop

**বিবরণ:** Dashboard এ যেকোনো জায়গায় PDF ফাইল drag করে drop করলে সরাসরি খুলবে।

**AI কে বলুন:**
> "Antigravity PDF Pro এর dashboard এ Drag & Drop support যোগ করো। User যদি PDF file drag করে window এর উপরে drop করে, তাহলে সেই file automatically open হবে। একটা visual overlay দেখাবে dragging এর সময়।"

---

### 1-D. Auto-Backup System

**বিবরণ:** প্রতিবার PDF save করার সময় `userData/.backups/` তে একটা timestamp যুক্ত backup copy রাখবে। সর্বশেষ ৫টা backup রাখবে, পুরনো delete হবে।

**গুরুত্বপূর্ণ technical note:** `app.getPath('userData')` দিয়ে path নিতে হবে, hardcode করা যাবে না।

**AI কে বলুন:**
> "Antigravity PDF Pro এ Auto-Backup যোগ করো। প্রতিবার user PDF save করলে app.getPath('userData') এর ভেতরে .backups ফোল্ডারে একটা timestamp যুক্ত copy সেভ হবে। সর্বশেষ ৫টা রাখবে, বাকি পুরনোগুলো delete করবে।"

---

### 1-E. Keyboard Shortcuts

**বিবরণ:** Common shortcuts যোগ করা।

| Shortcut | কাজ |
|---|---|
| Ctrl+O | File Open |
| Ctrl+S | Save |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Escape | Active tool বন্ধ করো |

**AI কে বলুন:**
> "Antigravity PDF Pro এ Keyboard Shortcuts যোগ করো: Ctrl+O (open), Ctrl+S (save), Ctrl+Z (undo), Ctrl+Y (redo), Escape (active tool cancel)। Electron এর globalShortcut অথবা renderer এর keydown event দিয়ে করো।"

---

## 🟠 PHASE 2 — অ্যাডভান্সড ফিচার (Phase 1 শেষে)

### 2-A. Progress Bar / Loading Indicator

**বিবরণ:** বড় PDF process করার সময় user বোঝে না কী হচ্ছে। একটা progress indicator দরকার।

**AI কে বলুন:**
> "Antigravity PDF Pro এ Processing Progress Bar যোগ করো। যখন PDF load, merge, convert বা অন্য কোনো heavy operation চলে, তখন একটা progress bar বা spinner দেখাবে। Operation শেষ হলে success toast notification দেখাবে।"

---

### 2-B. Settings Panel

**বিবরণ:** User preferences সেভ করার জায়গা।

**Settings গুলো:**
- Default output folder (save করার জায়গা)
- Theme (Light/Dark)
- Language (ভবিষ্যতের জন্য)
- Auto-backup on/off

**AI কে বলুন:**
> "Antigravity PDF Pro এ Settings panel যোগ করো। একটা gear icon বা menu থেকে Settings window খুলবে। electron-store দিয়ে সব preference save হবে: default output folder, theme, auto-backup toggle।"

---

### 2-C. Batch Processing

**বিবরণ:** একসাথে একাধিক PDF merge, split বা convert করা।

**AI কে বলুন:**
> "Antigravity PDF Pro এ Batch Processing যোগ করো। User একসাথে multiple PDF select করতে পারবে এবং batch merge বা batch convert করতে পারবে। Each file এর progress আলাদা দেখাবে।"

---

### 2-D. Local OCR উন্নতি (Offline Tesseract)

**বিস্তারিত:** বর্তমানে OCR implemented আছে কিন্তু CDN-dependent হতে পারে। Tesseract.js locally bundle করতে হবে।

**AI কে বলুন:**
> "Antigravity PDF Pro এর OCR (converters/ocr-pdf.js) check করো যে Tesseract.js CDN থেকে লোড হচ্ছে কিনা। যদি হয়, locally bundle করো যাতে offline কাজ করে।"

---

### 2-E. License/Activation System [বিজনেসের জন্য গুরুত্বপূর্ণ]

**বিবরণ:** Pro version বিক্রি করতে হলে একটা উন্নত License Key system দরকার যা অফলাইন এবং অনলাইন কন্ট্রোল নিশ্চিত করবে।
- **প্রথমবার অ্যাক্টিভেশন:** অ্যাপ প্রথমবার খুললে লাইসেন্স কি দেওয়ার স্ক্রিন দেখাবে। এটি যাচাই করতে একবার ইন্টারনেট লাগবে। অ্যাক্টিভ হলে লাইসেন্স তথ্য পিসিতে এনক্রিপ্টেড ফাইল হিসেবে সেভ হবে।
- **ব্যাকগ্রাউন্ড রিমোট চেক:** পিসি যখনই ইন্টারনেটের সাথে যুক্ত হবে, অ্যাপটি ব্যাকগ্রাউন্ডে নিঃশব্দে সার্ভার থেকে লাইসেন্স কি-টি বৈধ (Active) নাকি বাতিল (Cancelled) তা যাচাই করবে। আপনি মাদার প্যানেল থেকে লাইসেন্স বাতিল করলে অ্যাপটি রিমোটলি লক হয়ে যাবে।
- **অফলাইন গ্রেস পিরিয়ড (Grace Period):** ব্যবহারকারী যাতে ইন্টারনেট বন্ধ করে আজীবন অ্যাপ ব্যবহার করতে না পারে, সেজন্য একটি অফলাইন লিমিট (যেমন ৩০ দিন) থাকবে। টানা ৩০ দিন ইন্টারনেট কানেক্ট না হলে অ্যাপটি একবার ইন্টারনেটে কানেক্ট হয়ে লাইসেন্স রি-ভেরিফাই করার জন্য অনুরোধ করবে।

**AI কে বলুন:**
> "Antigravity PDF Pro এ একটি Hybrid License Key system যোগ করো। এটি প্রথম অ্যাক্টিভেশনের সময় অনলাইন ভেরিফিকেশন করবে, ব্যাকগ্রাউন্ডে পিসি ইন্টারনেট পাওয়া মাত্র লাইসেন্স স্ট্যাটাস চেক করবে এবং অফলাইনে ৩০ দিনের গ্রেস পিরিয়ড লিমিট থাকবে যার পরে ইন্টারনেট সংযোগ ছাড়া অ্যাপ লক হয়ে যাবে।"

---

## 🟢 PHASE 3 — ডিস্ট্রিবিউশন ও বিজনেস (Phase 2 শেষে)

### 3-A. Auto-Updater

**AI কে বলুন:**
> "Antigravity PDF Pro এ electron-updater যোগ করো। App start হলে automatically নতুন version আছে কিনা check করবে। থাকলে user কে notify করবে এবং option দেবে 'Update Now' বা 'Later'।"

---

### 3-B. MSI Installer + Code Signing

**AI কে বলুন:**
> "Antigravity PDF Pro এর package.json এর build config এ MSI target যোগ করো। electron-builder দিয়ে .msi installer তৈরি হবে যাতে Windows এ properly install/uninstall করা যায়।"

---

### 3-C. Crash Reporter

**বিবরণ:** Unexpected crash হলে user-friendly error message এবং log export option।

**AI কে বলুন:**
> "Antigravity PDF Pro এ Crash Reporter যোগ করো। App crash হলে একটা dialog দেখাবে: 'Something went wrong' message সহ 'Export Log File' button। User log file save করে support এ পাঠাতে পারবে।"

---

### 3-D. Landing Page Website

Electron app release এর সাথে একটা simple HTML landing page বানান যেখানে:
- Features দেখাবে
- Download button থাকবে
- Pricing (Free vs Pro) দেখাবে

**AI কে বলুন:**
> "Antigravity PDF Pro এর জন্য একটা modern landing page বানাও। Dark theme, hero section, features grid, pricing table (Free vs Pro), এবং download button সহ। Single HTML file হবে।"

---

## 🛠️ বিজনেস মডেল (পরিকল্পনা)

| Version | দাম | Features |
|---|---|---|
| Free | বিনামূল্যে | Basic edit, single file |
| Pro | $9.99/month বা $49.99/year | Batch processing, Cloud sync, OCR, Priority support |
| Enterprise | Custom pricing | Custom branding, Volume license |

---

## ⚠️ Known Technical Issues (গুরুত্বপূর্ণ notes)

### Issue #1 — CDN Dependency
- **ফাইল:** index.html
- **সমস্যা:** pdf.js, pdf-lib, lucide CDN থেকে লোড হচ্ছে
- **Risk:** Internet ছাড়া app কাজ করে না
- **Fix:** Phase 0-A তে করতে হবে

### Issue #2 — electron-store নেই
- **সমস্যা:** package.json এ `electron-store` নেই, কিন্তু Phase 1 এর অনেক ফিচারে লাগবে
- **Fix:** যখনই electron-store ব্যবহার করবেন, আগে `npm install electron-store` করতে হবে
- **AI কে বলুন:** "electron-store install করো এবং import করো"

### Issue #3 — No Error Logging
- **সমস্যা:** App ক্র্যাশ করলে কোনো log নেই, bug ধরা কঠিন
- **Fix:** Phase 0-C তে করতে হবে

### Issue #4 — 15টা ফিচার Untested
- **সমস্যা:** টেস্ট স্ট্যাটাস table এ ১৫টা ফিচার `⬜ অজানা`
- **Risk:** Production-এ যাওয়ার আগে এগুলো test করা দরকার
- **Fix:** Phase 0 এ manually test করুন এবং এই table update করুন

### Issue #5 — asar: false
- **সমস্যা:** `package.json` এ `"asar": false` — মানে সব source code unpacked থাকে
- **Risk:** ব্যবহারকারী সহজে code দেখতে পাবে
- **Note:** License system যোগ করার পরে asar: true করুন

---

## 📋 Session শুরু করার নির্দেশনা

### নতুন AI session এ এই ফাইল upload করে বলুন:

**Phase 0 শুরু করতে:**
> "এই ANTIGRAVITY_MASTER_PLAN.md ফাইলটা পড়ো এবং Phase 0-A (CDN to Local migration) থেকে কাজ শুরু করো। আমার কাছে Antigravity-PDF-Pro-1.zip আছে।"

**Phase 1 শুরু করতে:**
> "এই ANTIGRAVITY_MASTER_PLAN.md ফাইলটা পড়ো। Phase 0 সম্পন্ন হয়েছে। এখন Phase 1-A (Dark Mode) থেকে শুরু করো।"

**নির্দিষ্ট ফিচারে:**
> "এই ANTIGRAVITY_MASTER_PLAN.md পড়ো এবং Phase 2-E (License System) implement করো।"

---

## ✅ কমপ্লিশন ট্র্যাকার

| Phase | Task | স্ট্যাটাস |
|---|---|---|
| 0 | CDN → Local migration | ✅ সম্পন্ন (2026-06-07) |
| 0 | Feature testing (সব ⬜ items) | ⬜ |
| 0 | Error logging (electron-log) | ✅ সম্পন্ন (2026-06-07) |
| 1 | Dark Mode | ✅ সম্পন্ন (2026-06-07) |
| 1 | Recent Files | ✅ সম্পন্ন (2026-06-07) |
| 1 | Drag & Drop | ✅ সম্পন্ন (2026-06-07) |
| 1 | Auto-Backup | ✅ সম্পন্ন (2026-06-07) |
| 1 | Keyboard Shortcuts | ✅ সম্পন্ন (2026-06-07) |
| 2 | Progress Bar | ⬜ |
| 2 | Settings Panel | ⬜ |
| 2 | Batch Processing | ⬜ |
| 2 | OCR (offline) | ⬜ |
| 2 | License/Activation | ⬜ |
| 3 | Auto-Updater | ⬜ |
| 3 | MSI Installer | ⬜ |
| 3 | Crash Reporter | ⬜ |
| 3 | Landing Page | ⬜ |

---

## 📝 Session লগ

| তারিখ | কাজ | স্ট্যাটাস |
|---|---|---|
| 2026-06-07 | Phase 0-A: CDN → Local migration | ✅ সম্পন্ন |
| 2026-06-07 | Phase 0-C: Error logging (electron-log) | ✅ সম্পন্ন |
| 2026-06-07 | Phase 1-A: Theme Toggle (Light/Dark Mode) | ✅ সম্পন্ন |
| 2026-06-07 | Phase 1-B: Recent Files (File History) | ✅ সম্পন্ন |
| 2026-06-07 | Phase 1-C: Drag & Drop support | ✅ সম্পন্ন |
| 2026-06-07 | Phase 1-D: Auto-Backup System | ✅ সম্পন্ন |
| 2026-06-07 | Phase 1-E: Keyboard Shortcuts | ✅ সম্পন্ন |

---

*এই ফাইলটা প্রতিটা session শেষে update করুন — completed task গুলো ✅ করুন এবং নতুন bug পেলে যোগ করুন।*
