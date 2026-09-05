# 💳 Gumroad Product Setup Guide

> **লক্ষ্য:** Gumroad-এ Antigravity PDF Pro-এর product তৈরি করা যাতে আন্তর্জাতিক কাস্টমাররা card/PayPal দিয়ে কিনতে পারে।

---

## ধাপ ১: Gumroad Account তৈরি

1. [gumroad.com](https://gumroad.com) এ যান → **"Start selling"**
2. Email ও password দিয়ে account তৈরি করুন
3. Profile settings-এ আপনার নাম ও বিবরণ দিন

---

## ধাপ ২: Product তৈরি করুন

**Dashboard → Products → New Product → Digital Product**

### Product Details:
| Field | Value |
|---|---|
| **Product Name** | Antigravity PDF Pro — Lifetime License |
| **Price** | $9.99 |
| **Summary** | Premium 100% Offline PDF Editor for Windows. One-time payment. No subscriptions. |
| **Description** | (নিচে দেওয়া text copy করুন) |

### Description (copy করুন):
```
✅ 100% Offline — Your files never leave your PC
✅ 25+ Professional PDF Tools
✅ Offline OCR, Measurement, Bates Numbering, Auto-Redact
✅ Lifetime License — Pay once, own forever
✅ Activate on 1 Windows PC
✅ Free lifetime updates

--- HOW TO ACTIVATE ---
After purchase, you'll receive a license key (AGP-XXXX-XXXX-XXXX) via email.
Download the app from GitHub, install it, and paste your key on first launch.

Download Link: https://github.com/shakibapon1234-maker/Antigravity-PDF-Pro-1/releases/latest
```

---

## ধাপ ৩: Gumroad Webhook সংযোগ (স্বয়ংক্রিয় email-এর জন্য)

এটি করলে কেউ Gumroad-এ কিনলে স্বয়ংক্রিয়ভাবে license key তৈরি হবে এবং email যাবে।

1. Gumroad Dashboard → **Settings → Advanced → Webhooks**
2. Webhook URL দিন:
   ```
   https://your-railway-url.up.railway.app/api/checkout/webhook/stripe
   ```
3. Event: **"Sale"** select করুন

---

## ধাপ ৪: Landing Page-এ Gumroad Button যোগ করুন

`landing.html` এ এই লাইনগুলো খুঁজুন:
```html
href="https://gumroad.com/l/antigravity-pdf-pro"
```

Gumroad product তৈরি হলে আপনি একটি URL পাবেন যেমন:
```
https://shakibapon.gumroad.com/l/pdf-pro
```

এই URL দিয়ে সব `gumroad.com/l/antigravity-pdf-pro` replace করুন।

---

## ধাপ ৫: Payout Setup (টাকা তোলার জন্য)

Gumroad Dashboard → **Settings → Payments:**
- **PayPal Email** যোগ করুন — বাংলাদেশ থেকে PayPal দিয়ে withdraw করা যায়
- Minimum payout: $10

---

## ✅ Test Purchase করুন

Product publish করার পর নিজেই একটি test purchase করুন (discount code দিয়ে $0 করে) যাতে পুরো flow test হয়।
