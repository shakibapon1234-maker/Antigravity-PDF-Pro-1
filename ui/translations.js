// ─────────────────────────────────────────────────────────────
// ui/translations.js — Antigravity PDF Pro
// Translation dictionary and language toggling logic
// ─────────────────────────────────────────────────────────────

const appTranslations = {
    en: {
        // Sidebar Nav
        nav_dashboard: "Dashboard",
        nav_editor: "Text Editor",
        nav_converter: "PDF to Word",
        nav_merge: "Merge PDF",
        nav_batch: "Batch Processing",
        nav_split: "Split PDF",
        nav_compress: "Compress PDF",
        nav_rotate: "Rotate PDF Pages",
        nav_pdf_to_image: "PDF to Image",
        nav_image_to_pdf: "Image to PDF",
        nav_image_converter: "Image Converter",
        nav_image_to_word: "Image to Word",
        nav_organize_pdf: "Organize PDF",
        nav_crop_pdf: "Crop PDF",
        nav_excel_to_word: "Excel to Word",
        nav_word_to_excel: "Word to Excel",
        nav_excel_to_pdf: "Excel to PDF",
        nav_unlock_pdf: "Unlock PDF",
        nav_watermark_pdf: "Add Watermark",
        nav_page_numbers_pdf: "Page Numbers",
        nav_html_to_pdf: "HTML to PDF",
        nav_protect_pdf: "Protect PDF",
        nav_ocr_pdf: "OCR — PDF to Text",
        nav_compare_pdf: "Compare PDF",
        nav_metadata_editor: "Metadata Editor",

        // Dashboard Greetings & Banners
        dashboard_greeting: "Hello! 👋",
        dashboard_subtitle: "What would you like to do with your PDF today?",
        dashboard_premium_msg: "Experience premium PDF tools — 100% offline, fast & secure. Your files never leave your device.",

        // Status Card
        status_local_mode: "Local Mode",
        status_secure: "100% Private & Secure",

        // Card Titles
        card_title_editor: "Edit Text",
        card_title_converter: "PDF to Word",
        card_title_merge: "Merge Files",
        card_title_split: "Split PDF",
        card_title_compress: "Compress PDF",
        card_title_rotate: "Rotate Pages",
        card_title_pdf_to_image: "PDF to Image",
        card_title_image_to_pdf: "Image to PDF",
        card_title_image_to_word: "Image to Word",
        card_title_organize_pdf: "Organize PDF",
        card_title_crop_pdf: "Crop PDF",
        card_title_excel_to_pdf: "Excel to PDF",
        card_title_unlock_pdf: "Unlock PDF",
        card_title_watermark_pdf: "Add Watermark",
        card_title_protect_pdf: "Protect PDF",
        card_title_ocr_pdf: "OCR — PDF to Text",
        card_title_compare_pdf: "Compare PDF",
        card_title_metadata_editor: "Metadata Editor",

        // Card Descriptions
        card_desc_editor: "Modify existing content directly inside your PDF.",
        card_desc_converter: "Convert PDF documents to editable DOCX format.",
        card_desc_merge: "Combine multiple PDFs into one document.",
        card_desc_split: "Extract specific pages from your PDF file.",
        card_desc_compress: "Reduce PDF file size without losing quality.",
        card_desc_rotate: "Rotate pages and save them permanently.",
        card_desc_pdf_to_image: "Convert PDF pages to JPEG or PNG images.",
        card_desc_image_to_pdf: "Convert photos or scanned images into PDF.",
        card_desc_image_to_word: "Extract and convert images to Word documents.",
        card_desc_organize_pdf: "Reorder, delete, or add pages inside PDF.",
        card_desc_crop_pdf: "Crop page margins to fit specific sizes.",
        card_desc_excel_to_pdf: "Convert Excel spreadsheets to PDF pages.",
        card_desc_unlock_pdf: "Remove password protections from PDF files.",
        card_desc_watermark_pdf: "Add text/image watermark overlay on pages.",
        card_desc_protect_pdf: "Add password encryption to secure your PDF.",
        card_desc_ocr_pdf: "Convert scanned PDFs into searchable text format.",
        card_desc_compare_pdf: "Compare two PDFs side by side to see edits.",
        card_desc_metadata_editor: "Edit PDF properties (Title, Author, Subject).",

        // Header Button Tooltips
        title_archive: "Open Archive",
        title_lang: "ভাষা পরিবর্তন করুন (Switch to Bangla)",
        title_theme: "Toggle Theme",
        title_settings: "Settings"
    },
    bn: {
        // Sidebar Nav
        nav_dashboard: "ড্যাশবোর্ড",
        nav_editor: "পিডিএফ এডিটর",
        nav_converter: "পিডিএফ টু ওয়ার্ড",
        nav_merge: "পিডিএফ মার্জ",
        nav_batch: "ব্যাচ প্রসেসিং",
        nav_split: "পিডিএফ স্প্লিট",
        nav_compress: "পিডিএফ কমপ্রেস",
        nav_rotate: "পেজ রোটেট",
        nav_pdf_to_image: "পিডিএফ টু ইমেজ",
        nav_image_to_pdf: "ইমেজ টু পিডিএফ",
        nav_image_converter: "ইমেজ কনভার্টার",
        nav_image_to_word: "ইমেজ টু ওয়ার্ড",
        nav_organize_pdf: "পিডিএফ সাজান",
        nav_crop_pdf: "পিডিএফ ক্রপ",
        nav_excel_to_word: "এক্সেল টু ওয়ার্ড",
        nav_word_to_excel: "ওয়ার্ড টু এক্সেল",
        nav_excel_to_pdf: "এক্সেল টু পিডিএফ",
        nav_unlock_pdf: "পিডিএফ আনলক",
        nav_watermark_pdf: "ওয়াটারমার্ক যোগ",
        nav_page_numbers_pdf: "পেজ নম্বর",
        nav_html_to_pdf: "এইচটিএমএল টু পিডিএফ",
        nav_protect_pdf: "পিডিএফ লক করুন",
        nav_ocr_pdf: "ওসিআর — টেক্সট কনভার্ট",
        nav_compare_pdf: "পিডিএফ তুলনা",
        nav_metadata_editor: "মেটাডেটা এডিটর",

        // Dashboard Greetings & Banners
        dashboard_greeting: "হ্যালো! 👋",
        dashboard_subtitle: "আজ আপনি পিডিএফ নিয়ে কী করতে চান?",
        dashboard_premium_msg: "১০০% অফলাইন, দ্রুত ও নিরাপদ প্রিমিয়াম পিডিএফ টুলস। আপনার ফাইল আপনার ডিভাইসেই সুরক্ষিত থাকে।",

        // Status Card
        status_local_mode: "লোকাল মোড",
        status_secure: "১০০% নিরাপদ ও ব্যক্তিগত",

        // Card Titles
        card_title_editor: "টেক্সট এডিট",
        card_title_converter: "পিডিএফ টু ওয়ার্ড",
        card_title_merge: "মার্জ ফাইল",
        card_title_split: "পিডিএফ স্প্লিট",
        card_title_compress: "পিডিএফ কমপ্রেস",
        card_title_rotate: "পেজ রোটেট",
        card_title_pdf_to_image: "পিডিএফ টু ইমেজ",
        card_title_image_to_pdf: "ইমেজ টু পিডিএফ",
        card_title_image_to_word: "ইমেজ টু ওয়ার্ড",
        card_title_organize_pdf: "পিডিএফ সাজান",
        card_title_crop_pdf: "পিডিএফ ক্রপ",
        card_title_excel_to_pdf: "এক্সেল টু পিডিএফ",
        card_title_unlock_pdf: "পিডিএফ আনলক",
        card_title_watermark_pdf: "ওয়াটারমার্ক যোগ",
        card_title_protect_pdf: "পিডিএফ লক",
        card_title_ocr_pdf: "ওসিআর — টেক্সট কনভার্ট",
        card_title_compare_pdf: "পিডিএফ তুলনা",
        card_title_metadata_editor: "মেটাডেটা এডিটর",

        // Card Descriptions
        card_desc_editor: "সরাসরি পিডিএফ-এর ভেতরের টেক্সট ও উপাদান পরিবর্তন করুন।",
        card_desc_converter: "পিডিএফ ডকুমেন্টকে এডিটেবল ওয়ার্ড ফরম্যাটে কনভার্ট করুন।",
        card_desc_merge: "একাধিক পিডিএফ ফাইল একত্রিত করে একটি ফাইল তৈরি করুন।",
        card_desc_split: "পিডিএফ থেকে নির্দিষ্ট পেজগুলো আলাদা করে নিন।",
        card_desc_compress: "কোয়ালিটি ঠিক রেখে পিডিএফ ফাইলের সাইজ ছোট করুন।",
        card_desc_rotate: "পেজগুলো ঘুরিয়ে স্থায়ীভাবে সংরক্ষণ করুন।",
        card_desc_pdf_to_image: "পিডিএফ পেজগুলোকে জেপিজি বা পিএনজি ইমেজে কনভার্ট করুন।",
        card_desc_image_to_pdf: "ছবি বা স্ক্যান করা ফাইল থেকে পিডিএফ তৈরি করুন।",
        card_desc_image_to_word: "ছবি থেকে টেক্সট এক্সট্র্যাক্ট করে ওয়ার্ডে রূপান্তর করুন।",
        card_desc_organize_pdf: "পিডিএফ-এর পেজ রী-অর্ডার করুন, ডিলিট করুন বা নতুন পেজ যোগ করুন।",
        card_desc_crop_pdf: "পেজের অপ্রয়োজনীয় মার্জিন কেটে নির্দিষ্ট সাইজ করুন।",
        card_desc_excel_to_pdf: "এক্সেল স্প্রেডশীট ফাইলকে পিডিএফ পেজে রূপান্তর করুন।",
        card_desc_unlock_pdf: "পিডিএফ ফাইল থেকে পাসওয়ার্ড লক সরিয়ে ফেলুন।",
        card_desc_watermark_pdf: "পেজের ওপরে নিজস্ব ওয়াটারমার্ক লেখা বা লোগো বসান।",
        card_desc_protect_pdf: "পাসওয়ার্ড দিয়ে পিডিএফ ফাইল সুরক্ষিত করুন।",
        card_desc_ocr_pdf: "স্ক্যান করা ইমেজ পিডিএফ থেকে সার্চযোগ্য টেক্সট তৈরি করুন।",
        card_desc_compare_pdf: "দুইটি পিডিএফ পাশাপাশি রেখে পার্থক্য পরীক্ষা করুন।",
        card_desc_metadata_editor: "পিডিএফ ফাইলের টাইটেল, অথর এবং কী-ওয়ার্ড এডিট করুন।",

        // Header Button Tooltips
        title_archive: "আর্কাইভ ওপেন করুন",
        title_lang: "Switch to English (ইংরেজি করুন)",
        title_theme: "থিম পরিবর্তন করুন",
        title_settings: "সেটিংস"
    }
};

function applyLanguage(lang) {
    localStorage.setItem('appLanguage', lang);
    const dictionary = appTranslations[lang] || appTranslations.en;

    // Apply values to elements with [data-i18n]
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translation = dictionary[key];
        if (translation) {
            // Keep icons/SVGs intact
            const icon = el.querySelector('i[data-lucide], svg');
            const span = el.querySelector('span');
            if (icon) {
                if (span) {
                    span.textContent = translation;
                } else {
                    // Update only text nodes inside the element
                    Array.from(el.childNodes).forEach(node => {
                        if (node.nodeType === Node.TEXT_NODE) {
                            node.textContent = translation;
                        }
                    });
                }
            } else {
                el.textContent = translation;
            }
        }
    });

    // Apply tooltips / titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        const translation = dictionary[key];
        if (translation) {
            el.setAttribute('title', translation);
        }
    });

    // Customize document title
    document.title = lang === 'bn' ? 'অ্যান্টিগ্র্যাভিটি পিডিএফ প্রো' : 'Antigravity PDF Pro';
    
    // Dispatch translation change event for custom tools to listen to
    document.dispatchEvent(new CustomEvent('app:languageChanged', { detail: { language: lang } }));
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Sidebar Nav
    document.querySelectorAll('.nav-menu .nav-item').forEach(btn => {
        const tab = btn.getAttribute('data-tab');
        if (tab) {
            const span = btn.querySelector('span');
            if (span) span.setAttribute('data-i18n', `nav_${tab.replace(/-/g, '_')}`);
        }
    });

    // 2. Dashboard Greeting & Subtitle
    const greeting = document.getElementById('dashboardGreeting');
    if (greeting) greeting.setAttribute('data-i18n', 'dashboard_greeting');

    const bannerTextDiv = document.querySelector('.banner-text');
    if (bannerTextDiv) {
        const p = bannerTextDiv.querySelector('p');
        if (p) p.setAttribute('data-i18n', 'dashboard_subtitle');
        const span = bannerTextDiv.querySelector('span');
        if (span) span.setAttribute('data-i18n', 'dashboard_premium_msg');
    }

    // 3. Sidebar Footer Status
    const statusCard = document.querySelector('.sidebar-footer .status-card');
    if (statusCard) {
        const p = statusCard.querySelector('p');
        if (p) p.setAttribute('data-i18n', 'status_local_mode');
        const small = statusCard.querySelector('small');
        if (small) small.setAttribute('data-i18n', 'status_secure');
    }

    // 4. Quick Tools Cards
    document.querySelectorAll('.quick-tools-grid .tool-card').forEach(card => {
        const clickAttr = card.getAttribute('onclick') || '';
        const match = clickAttr.match(/switchTab\('([^']+)'\)/);
        if (match && match[1]) {
            const tab = match[1];
            const h3 = card.querySelector('h3');
            if (h3) h3.setAttribute('data-i18n', `card_title_${tab.replace(/-/g, '_')}`);
            const p = card.querySelector('p');
            if (p) p.setAttribute('data-i18n', `card_desc_${tab.replace(/-/g, '_')}`);
        }
    });

    // 5. Header Action Button Tooltips
    const btnOpenArchive = document.getElementById('btnOpenArchive');
    if (btnOpenArchive) btnOpenArchive.setAttribute('data-i18n-title', 'title_archive');

    const btnToggleLang = document.getElementById('btnToggleLang');
    if (btnToggleLang) btnToggleLang.setAttribute('data-i18n-title', 'title_lang');

    const btnToggleTheme = document.getElementById('btnToggleTheme');
    if (btnToggleTheme) btnToggleTheme.setAttribute('data-i18n-title', 'title_theme');

    const btnSettings = document.getElementById('agSettingsBtn');
    if (btnSettings) btnSettings.setAttribute('data-i18n-title', 'title_settings');

    // 6. Init and Load Saved Language
    const savedLang = localStorage.getItem('appLanguage') || 'en';
    applyLanguage(savedLang);

    // 7. Toggle click listener
    if (btnToggleLang) {
        btnToggleLang.addEventListener('click', () => {
            const currentLang = localStorage.getItem('appLanguage') || 'en';
            const nextLang = currentLang === 'en' ? 'bn' : 'en';
            applyLanguage(nextLang);
        });
    }
});
