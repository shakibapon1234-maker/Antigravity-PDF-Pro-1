// ─────────────────────────────────────────────
// core/state.js — Antigravity PDF Pro
// সমস্ত গ্লোবাল স্টেট এক জায়গায়
// অন্য কোনো ফাইল থেকে সরাসরি এই ভ্যারিয়েবলগুলো
// পড়া ও লেখা যাবে (global scope, browser)
// ─────────────────────────────────────────────

// ── PDF Library destructure ──────────────────
const { PDFDocument, rgb, StandardFonts } = PDFLib;

// ── PDF Core State ───────────────────────────
let currentPdfFile   = null;   // আপলোড করা File অবজেক্ট
let currentPdfObj    = null;   // pdf.js দিয়ে লোড হওয়া PDF ডকুমেন্ট
let pdfScale         = 1.5;   // রেন্ডার স্কেল
let currentPageNum   = 1;     // বর্তমান পেজ নম্বর
let totalPages       = 0;     // মোট পেজ সংখ্যা

// ── Edit Data ────────────────────────────────
let textEdits        = [];    // [{ page, x, y, text, style, ... }]
let shapeEdits       = [];    // [{ page, type, x, y, w, h, color, ... }]
let imageEdits       = [];    // [{ page, x, y, w, h, dataUrl, ... }]
let clearStrokes     = [];    // ইরেজার স্ট্রোক ডেটা

// ── Tool State ───────────────────────────────
let activeTool       = 'text';  // 'text' | 'shape' | 'image' | 'eraser'

// ── Drag State ───────────────────────────────
let isDragging       = false;
let dragTarget       = null;
let dragStartX       = 0;
let dragStartY       = 0;

// ── Selection State ──────────────────────────
let isSelecting      = false;
let selectedTextItem = null;

// ── Eraser State (brush / rect) ──────────────
let eraserMode           = 'rect'; // 'brush' | 'rect'
let brushSize            = 28;
let activeClearContainer = null;
let eraserRectEl         = null;
let eraserRectStart      = { x: 0, y: 0 };

// ── Clear-Text Eraser State ──────────────────
let clearTextRectEl        = null;
let clearTextRectStart     = { x: 0, y: 0 };
let clearTextContainer     = null;
let _clearTextDocMouseMove = null;
let _clearTextDocMouseUp   = null;

// ── Undo/Redo History ────────────────────────
const UNDO_LIMIT = 10;
const REDO_LIMIT = 10;
let undoHistory  = [];   // { description, textEdits, shapeEdits, clearStrokes }
let redoHistory  = [];   // একই স্ট্রাকচার

// ── Current Editor Style ─────────────────────
let currentStyle = {
    fontFamily:  'Helvetica',
    fontSize:    14,
    color:       '#000000',
    bgColor:     '#ffffff',
    isBold:      false,
    isItalic:    false,
    isUnderline: false
};

// ── Merge Tool State ─────────────────────────
let mergeFiles   = [];   // File অবজেক্টের অ্যারে

// ── Split Tool State ─────────────────────────
let splitPdfFile     = null;
let splitPdfDoc      = null;
let splitTotalPages  = 0;
let selectedPageNumbers = new Set();

// ── Compress Tool State ──────────────────────
let compressPdfFile  = null;
let compressPdfDoc   = null;

// ── Rotate Tool State ────────────────────────
let rotatePdfFile    = null;
let rotatePdfDoc     = null;
let rotateTotalPages = 0;

// ── Drag-Reorder State (merge list) ──────────
let draggedItem  = null;
let draggedIndex = null;

// ── Z-Index Counters ─────────────────────────
let _shapeZCounter = 60;  // shapes.js ব্যবহার করে
let _imgZCounter   = 65;  // image-toolbar.js ব্যবহার করে

// ── Eyedropper State ────────────────────────
let _eyeMode          = 'idle';   // 'idle' | 'picking' | 'picked'
let _eyePickedColor   = null;
let _eyeTarget        = 'text';   // 'text' | 'bg'
let _eyeMoveListener  = null;
let _eyeClickListener = null;
let _eyeKeyListener   = null;
let _eyePasteClickListener = null;
let _eyePasteKeyListener   = null;

// ── White Eraser State ───────────────────────
let whiteEraserActive = false;
let _weIsDrawing      = false;
let _weStartX         = 0;
let _weStartY         = 0;
let _weContainer      = null;
let _weRectEl         = null;
