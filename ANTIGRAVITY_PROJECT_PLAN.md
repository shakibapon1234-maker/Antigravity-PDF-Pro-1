# Antigravity PDF Pro — রিফ্যাক্টরিং প্রজেক্ট ট্র্যাকার

**শেষ আপডেট:** ২০২৬-০৪-১৩ (v4)
**স্ট্যাটাস:** 🟢 Console errors শূন্য + Text Editor major fixes

---

## প্রজেক্ট সারসংক্ষেপ

| বিষয় | বিবরণ |
|---|---|
| প্রজেক্ট নাম | Antigravity PDF Pro |
| ধরন | Browser-based PDF Editor (Vanilla JS + Node.js server) |
| বর্তমান ZIP | Antigravity-PDF-Pro-v4.zip |
| স্ট্যাটাস | Text Editor 4টি critical bug fix সম্পন্ন |

---

## কীভাবে রান করবেন

```
npm install → start.bat ডাবল ক্লিক → http://localhost:3000
```

---

## v4 তে ঠিক করা Critical Bugs

| # | সমস্যা | ফাইল | সমাধান |
|---|---|---|---|
| 1 | Image upload কাজ করত না | editor/image-toolbar.js | `addImageToPdf()` function সম্পূর্ণ নতুন লেখা হয়েছে (ছিলই না!) |
| 2 | ClearText শুধু `.editable-text-unit` খুঁজত, PDF native text layer spans ধরত না | editor/text-editor.js | `.textLayer span, .text-layer span` ও select করে invisible করে |
| 3 | Text mode এ click করলে আগের editor commit না হয়েই নতুন editor বসত (double write) | editor/text-editor.js | open editor থাকলে নতুন addNewText block করা হয়েছে |
| 4 | White Eraser বাটনের text/icon দেখা যেত না (সাদার উপর সাদা) | index.html | color `#1a1a2e` করা হয়েছে, stroke explicit |
| 5 | Page change করলে bg canvas cache clear হত না | core/renderer.js | `renderPage()` এ `invalidateBgCanvas()` call যোগ |

---

## ফিচার-ওয়াইজ টেস্ট স্ট্যাটাস

| ফিচার | ফাইল | স্ট্যাটাস |
|---|---|---|
| PDF আপলোড ও লোড | core/renderer.js | ⬜ |
| টেক্সট ক্লিক করে এডিট | editor/text-editor.js | ⬜ |
| নতুন টেক্সট যোগ (double-write fix) | editor/text-editor.js | ✅ fixed v4 |
| Font/Size/Color টুলবার | editor/init.js | ⬜ |
| Bold/Italic/Underline | core/utils.js | ⬜ |
| Undo / Redo | core/undo.js | ⬜ |
| Shapes আঁকা | editor/shapes.js | ⬜ |
| Image insert | editor/image-toolbar.js | ✅ fixed v4 |
| Eyedropper / Eraser | editor/eraser.js | ⬜ |
| ClearText (gradient bg সহ) | editor/text-editor.js | ✅ fixed v4 |
| White Eraser বাটন color | index.html | ✅ fixed v4 |
| PDF Save (Download) | editor/save-pdf.js | ⬜ |
| Archive save/restore | server.js + save-pdf.js | ⬜ |
| Merge PDF | tools/merge-pdf.js | ⬜ |
| Split PDF | tools/split-pdf.js | ⬜ |
| Rotate PDF | tools/rotate-pdf.js | ⬜ |
| Watermark | tools/watermark-pdf.js | ⬜ |
| PDF to Word | converters/pdf-to-word.js | ⬜ |
| Page Numbers | ui/page-numbers.js | ⬜ |

---

## ClearText — কীভাবে কাজ করে (v4)

1. CLEAR TEXT বাটন চাপুন
2. PDF এর উপরে drag করে rectangle আঁকুন
3. Rectangle এর মধ্যে যা আছে:
   - PDF native text (`.textLayer span`) → invisible হয়
   - আমাদের যোগ করা text (`.editable-text-unit`) → clear হয়
4. Background canvas থেকে সেই area এর pixel-perfect patch নেওয়া হয়
5. Gradient/complex background → inpainted patch দিয়ে perfectly match করে
6. Escape চাপলে সব tool বন্ধ হয়

---
*এই ফাইলটি প্রতিটি সেশনের শেষে আপডেট করা হয়।*
