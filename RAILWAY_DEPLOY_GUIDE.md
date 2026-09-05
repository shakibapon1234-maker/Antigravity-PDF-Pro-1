# 🚂 License Server — Railway Deploy Guide

> **লক্ষ্য:** `license-server.js` কে internet-এ live করা, যাতে কেউ app activate করলে সার্ভার কাজ করে।

---

## ধাপ ১: Railway অ্যাকাউন্ট তৈরি

1. [railway.app](https://railway.app) এ যান
2. **"Login with GitHub"** বোতামে ক্লিক করুন
3. আপনার GitHub account দিয়ে sign in করুন

---

## ধাপ ২: SQLite dependency যোগ করুন

`package.json` এ নিচের dependency আছে কিনা check করুন — না থাকলে terminal-এ run করুন:

```bash
npm install sqlite3
npm install resend
```

---

## ধাপ ৩: `railway.json` ফাইল তৈরি করুন

Project root-এ একটি নতুন ফাইল তৈরি করুন: `railway.json`

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node license-server.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## ধাপ ৪: Railway-তে Deploy করুন

### Option A — GitHub থেকে (সবচেয়ে সহজ):
1. Railway dashboard-এ **"New Project"** → **"Deploy from GitHub repo"** ক্লিক করুন
2. `SwiftPDF-Pro-1` repository select করুন
3. Railway স্বয়ংক্রিয়ভাবে build করবে

### Option B — Railway CLI দিয়ে:
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

---

## ধাপ ৫: Environment Variables সেট করুন

Railway Dashboard → আপনার project → **Variables** tab:

| Variable Name | Value | কেন দরকার |
|---|---|---|
| `ADMIN_SECRET_TOKEN` | `your-secret-password-here` | Admin panel login |
| `RESEND_API_KEY` | `re_xxxxxxxxxxxx` | Email পাঠানো |
| `FROM_EMAIL` | `noreply@swiftpdfpro.com` | Email sender |
| `PORT` | (Railway নিজেই set করে) | Server port |

⚠️ **ADMIN_SECRET_TOKEN** কখনো GitHub-এ commit করবেন না!

---

## ধাপ ৬: Resend.com Email Setup

1. [resend.com](https://resend.com) এ বিনামূল্যে account তৈরি করুন
2. **API Keys** section থেকে একটি key তৈরি করুন
3. সেই key-টি Railway-তে `RESEND_API_KEY` variable হিসেবে যোগ করুন
4. Free plan: **100 emails/day** — শুরুতে যথেষ্ট

---

## ধাপ ৭: Live URL পাওয়া

Deploy হলে Railway একটি URL দেবে যেমন:
```
https://swiftpdf-pro-production.up.railway.app
```

এই URL টি:
- `admin-panel.html` এর "License Server URL" box-এ দিন
- `tools/license-manager.js` এ SERVER_URL আপডেট করুন

---

## ✅ Test করুন

```bash
# Server চলছে কিনা check:
curl https://your-railway-url.up.railway.app/api/license/list \
  -H "Authorization: Bearer your-admin-token"

# License generate test:
curl -X POST https://your-railway-url.up.railway.app/api/license/generate \
  -H "Authorization: Bearer your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","duration_months":999}'
```

---

## 💰 খরচ

| Plan | মাসিক | কী পাবেন |
|---|---|---|
| **Free** | $0 | ৫০০ ঘণ্টা/মাস (শুরুতে যথেষ্ট) |
| **Hobby** | $5 | Unlimited hours, custom domain |
