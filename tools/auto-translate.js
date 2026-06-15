// ─────────────────────────────────────────────────────────────────────────────
// tools/auto-translate.js — Antigravity PDF Pro
// Auto Translation — Phase 3 Implementation
// Features: Translate PDF page-by-page, API & Offline Translation, Export PDF
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const translateInput = document.getElementById('translateInput');
    const translateUploadState = document.getElementById('translate-upload-state');
    const translateActiveState = document.getElementById('translate-active-state');
    const translateDocName = document.getElementById('translateDocName');
    const translateDocMeta = document.getElementById('translateDocMeta');
    const btnTranslateReset = document.getElementById('btnTranslateReset');
    const selectTargetLanguage = document.getElementById('selectTargetLanguage');
    const translateEngineLabel = document.getElementById('translateEngineLabel');
    const btnStartTranslation = document.getElementById('btnStartTranslation');

    // New Preview Elements
    const btnDownloadTranslated = document.getElementById('btnDownloadTranslated');
    const btnDownloadTranslatedWord = document.getElementById('btnDownloadTranslatedWord');
    const btnPrevTranslatePage = document.getElementById('btnPrevTranslatePage');
    const btnNextTranslatePage = document.getElementById('btnNextTranslatePage');
    const translatePageIndicator = document.getElementById('translatePageIndicator');
    const translateOriginalPreview = document.getElementById('translateOriginalPreview');
    const translateResultPreview = document.getElementById('translateResultPreview');

    if (!translateInput || !translateUploadState || !translateActiveState) return;

    let currentFile = null;
    let pageTexts = []; // Store raw text per page
    let translatedPageTexts = []; // Store translated text per page
    let currentPreviewPageIndex = 0; // Currently viewed page index

    const languageNames = {
        bn: 'Bengali (বাংলা)',
        en: 'English (ইংরেজি)',
        es: 'Spanish (Español)',
        fr: 'French (Français)',
        de: 'German (Deutsch)',
        ar: 'Arabic (العربية)',
        hi: 'Hindi (हिन्दी)'
    };

    // ─── Update Preview Panel ─────────────────────────────────────────────────
    function updatePreview() {
        if (!translateOriginalPreview || !translateResultPreview || !translatePageIndicator) return;

        if (pageTexts.length === 0) {
            translatePageIndicator.textContent = 'Page 0 of 0';
            translateOriginalPreview.textContent = 'অনুবাদ শুরু করতে বাম পাশের "Start Translation" বাটনে ক্লিক করুন। মূল টেক্সট এখানে দেখা যাবে।';
            translateResultPreview.textContent = 'অনূদিত অংশ এখানে দেখা যাবে।';
            if (btnPrevTranslatePage) btnPrevTranslatePage.disabled = true;
            if (btnNextTranslatePage) btnNextTranslatePage.disabled = true;
            return;
        }

        // Enable/disable page navigation buttons
        if (btnPrevTranslatePage) btnPrevTranslatePage.disabled = (currentPreviewPageIndex === 0);
        if (btnNextTranslatePage) btnNextTranslatePage.disabled = (currentPreviewPageIndex === pageTexts.length - 1);

        // Update page indicator
        translatePageIndicator.textContent = `Page ${currentPreviewPageIndex + 1} of ${pageTexts.length}`;

        // Show original text
        translateOriginalPreview.textContent = pageTexts[currentPreviewPageIndex] || '';

        // Show translated text (or placeholder if not translated yet)
        if (translatedPageTexts[currentPreviewPageIndex]) {
            translateResultPreview.textContent = translatedPageTexts[currentPreviewPageIndex];
            translateResultPreview.style.color = 'var(--text-primary)';
        } else {
            translateResultPreview.textContent = 'অনূদিত অংশ এখানে দেখা যাবে।';
            translateResultPreview.style.color = 'var(--text-muted)';
        }
    }

    // ─── File Upload Handler ──────────────────────────────────────────────────
    translateInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.pdf')) {
            window.AGToast.error('Please select a valid PDF file.');
            return;
        }

        currentFile = file;
        window.AGProgress.start('Uploading PDF for Translation...', 'Reading pages');

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfjsLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            // Load meta details
            translateDocName.textContent = file.name;
            const sizeMB = (file.size / 1024 / 1024).toFixed(2);
            translateDocMeta.textContent = `${sizeMB} MB • ${pdf.numPages} pages`;

            // Extract page texts
            pageTexts = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                window.AGProgress.set(Math.round((i / pdf.numPages) * 90), 'Extracting text', `Page ${i} of ${pdf.numPages}`);
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const text = textContent.items.map(item => item.str).join(' ');
                pageTexts.push(text);
            }

            // Sync engine label based on settings
            await updateEngineLabel();

            // Transition UI
            translateUploadState.classList.add('d-none');
            translateActiveState.classList.remove('d-none');

            // Reset page preview index and display page 1 details
            currentPreviewPageIndex = 0;
            translatedPageTexts = [];
            if (btnDownloadTranslated) btnDownloadTranslated.disabled = true;
            if (btnDownloadTranslatedWord) btnDownloadTranslatedWord.disabled = true;
            updatePreview();

            window.AGProgress.done();
            window.AGToast.success('PDF successfully analyzed for translation!');
        } catch (err) {
            console.error('Translation PDF analysis failed', err);
            window.AGProgress.error();
            window.AGToast.error('Failed to read PDF file.');
        }
    });

    // ─── Reset Handler ────────────────────────────────────────────────────────
    btnTranslateReset.addEventListener('click', () => {
        currentFile = null;
        pageTexts = [];
        translatedPageTexts = [];
        currentPreviewPageIndex = 0;
        translateInput.value = '';
        translateUploadState.classList.remove('d-none');
        translateActiveState.classList.add('d-none');
        if (btnDownloadTranslated) btnDownloadTranslated.disabled = true;
        if (btnDownloadTranslatedWord) btnDownloadTranslatedWord.disabled = true;
        updatePreview();
    });

    // ─── Update Engine Label ──────────────────────────────────────────────────
    async function updateEngineLabel(overrideSettings) {
        if (!translateEngineLabel) return;
        const settings = overrideSettings || await window.AGSettings.get();
        if (settings.aiProvider === 'offline' || !settings.aiApiKey) {
            translateEngineLabel.textContent = 'Mode: Offline (Simulation Mode)';
        } else {
            const providerName = settings.aiProvider === 'gemini' ? 'Gemini' : 'OpenAI';
            translateEngineLabel.textContent = `Mode: ${providerName} (${settings.aiModel})`;
        }
    }

    // ─── React to settings saved (API key / provider changes) ────────────────
    window.addEventListener('agSettingsSaved', (e) => {
        updateEngineLabel(e.detail);
    });

    // Show correct label immediately on page load
    updateEngineLabel();

    // ─── Page Navigation Events ───────────────────────────────────────────────
    if (btnPrevTranslatePage) {
        btnPrevTranslatePage.addEventListener('click', () => {
            if (currentPreviewPageIndex > 0) {
                currentPreviewPageIndex--;
                updatePreview();
            }
        });
    }

    if (btnNextTranslatePage) {
        btnNextTranslatePage.addEventListener('click', () => {
            if (currentPreviewPageIndex < pageTexts.length - 1) {
                currentPreviewPageIndex++;
                updatePreview();
            }
        });
    }

    // ─── Translate Action ─────────────────────────────────────────────────────
    btnStartTranslation.addEventListener('click', async () => {
        if (!currentFile || pageTexts.length === 0) return;

        const targetLangCode = selectTargetLanguage.value;
        const targetLangName = languageNames[targetLangCode];

        btnStartTranslation.disabled = true;
        btnStartTranslation.textContent = '⌛ Translating...';
        if (btnDownloadTranslated) btnDownloadTranslated.disabled = true;
        if (btnDownloadTranslatedWord) btnDownloadTranslatedWord.disabled = true;

        window.AGProgress.start('Translating PDF...', `Target: ${targetLangName}`);

        try {
            const settings = await window.AGSettings.get();
            const provider = settings.aiProvider || 'offline';
            const apiKey = settings.aiApiKey || '';

            translatedPageTexts = [];

            for (let i = 0; i < pageTexts.length; i++) {
                const pageNum = i + 1;
                window.AGProgress.set(Math.round((pageNum / pageTexts.length) * 100), 'Translating pages', `Page ${pageNum} of ${pageTexts.length}`);

                const originalText = pageTexts[i];
                let translatedText = '';

                if (provider === 'offline' || !apiKey) {
                    // Simulated Offline Translation
                    await delay(800); // simulate delay
                    translatedText = mockTranslate(originalText, targetLangCode);
                } else {
                    // Online API Translation
                    const prompt = `Translate the following text strictly to ${targetLangName}. Preserve paragraphs and structure. Return only the translated text. No explanation.`;
                    translatedText = await callAIForTranslation(prompt, originalText, settings);
                }

                translatedPageTexts.push(translatedText);

                // Update preview live as pages are translated
                if (i === currentPreviewPageIndex) {
                    updatePreview();
                }
            }

            window.AGProgress.done();
            window.AGToast.success(`Translation complete! Preview is ready.`);
            
            // Enable download buttons and refresh preview controls
            if (btnDownloadTranslated) btnDownloadTranslated.disabled = false;
            if (btnDownloadTranslatedWord) btnDownloadTranslatedWord.disabled = false;
            updatePreview();
        } catch (error) {
            console.error('Translation failed', error);
            window.AGProgress.error();
            const errMsg = error?.message || 'Unknown error';
            window.AGToast.error(`Translation failed: ${errMsg}`);
        } finally {
            btnStartTranslation.disabled = false;
            btnStartTranslation.textContent = '🌍 Start Translation';
        }
    });

    // ─── Download Translated PDF Action ──────────────────────────────────────
    if (btnDownloadTranslated) {
        btnDownloadTranslated.addEventListener('click', async () => {
            if (translatedPageTexts.length === 0) return;

            btnDownloadTranslated.disabled = true;
            const originalHtml = btnDownloadTranslated.innerHTML;
            btnDownloadTranslated.innerHTML = '⌛ Generating PDF...';

            window.AGProgress.start('Generating PDF...', 'Building layout');

            try {
                const targetLangCode = selectTargetLanguage.value;
                await generateTranslatedPDF(targetLangCode);
                window.AGProgress.done();
                window.AGToast.success('PDF successfully generated and saved.');
            } catch (err) {
                console.error('PDF generation failed', err);
                window.AGProgress.error();
                window.AGToast.error('Failed to generate PDF.');
            } finally {
                btnDownloadTranslated.disabled = false;
                btnDownloadTranslated.innerHTML = originalHtml;
            }
        });
    }

    // ─── Call AI API for Translation ─────────────────────────────────────────
    async function callAIForTranslation(prompt, text, settings) {
        const provider = settings.aiProvider;
        const apiKey = settings.aiApiKey;
        const model = settings.aiModel;

        if (provider === 'gemini') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: `${prompt}\n\nText to translate:\n${text}` }
                            ]
                        }
                    ]
                })
            });
            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                throw new Error(errJson.error?.message || `HTTP error ${response.status}`);
            }
            const data = await response.json();
            return data.candidates[0].content.parts[0].text;
        } else if (provider === 'openai') {
            const url = `https://api.openai.com/v1/chat/completions`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: prompt },
                        { role: 'user', content: text }
                    ],
                    temperature: 0.3
                })
            });
            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                throw new Error(errJson.error?.message || `HTTP error ${response.status}`);
            }
            const data = await response.json();
            return data.choices[0].message.content;
        }
        throw new Error('Unsupported AI provider selected');
    }

    // ─── Generate Translated PDF via Electron native printToPDF ───────────────
    async function generateTranslatedPDF(targetLangCode) {
        if (!window.electronAPI || !window.electronAPI.printTranslatedPDF) {
            throw new Error('Electron print API not available.');
        }

        const nameClean = currentFile.name.replace(/\.[^/.]+$/, '');

        // Build pages HTML
        let pagesHtml = '';
        for (let i = 0; i < translatedPageTexts.length; i++) {
            const pageText = (translatedPageTexts[i] || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
            pagesHtml += `
            <div class="page">
                <div class="page-header">
                    <div class="header-row">
                        <span class="header-title">Translated Page ${i + 1} of ${translatedPageTexts.length}</span>
                        <span class="header-brand">Antigravity PDF Translator</span>
                    </div>
                    <div class="header-sub">Original File: ${currentFile.name}</div>
                </div>
                <div class="page-body">${pageText}</div>
                <div class="page-footer">
                    <span>Generated by Antigravity PDF Translator &mdash; 100% Private &amp; Secure</span>
                    <span>Page ${i + 1}</span>
                </div>
            </div>`;
        }

        const htmlContent = `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${nameClean} - Translated</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Noto Sans Bengali', 'SolaimanLipi', 'Kalpurush', Arial, sans-serif;
    background: #fff;
    color: #2d3748;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 20mm 18mm;
    display: flex;
    flex-direction: column;
    page-break-after: always;
    background: #ffffff;
  }
  .page:last-child { page-break-after: auto; }
  .page-header {
    background: #4361ee;
    color: #fff;
    padding: 12px 18px;
    border-radius: 6px;
    margin-bottom: 20px;
  }
  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    font-weight: 600;
  }
  .header-brand { font-size: 11px; font-weight: 400; opacity: 0.85; }
  .header-sub { font-size: 10px; margin-top: 4px; opacity: 0.8; }
  .page-body {
    flex: 1;
    font-size: 13.5px;
    line-height: 1.9;
    color: #2d3748;
    text-align: left;
    word-break: break-word;
  }
  .page-footer {
    border-top: 1px solid #e2e8f0;
    padding-top: 8px;
    margin-top: 16px;
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #a0aec0;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>${pagesHtml}</body>
</html>`;

        const fileName = `${nameClean}_translated_${targetLangCode}.pdf`;
        const result = await window.electronAPI.printTranslatedPDF(htmlContent, fileName);
        if (!result.success && result.error !== 'Cancelled') {
            throw new Error(result.error || 'PDF generation failed');
        }
    }

    // ─── Generate Translated Word (.docx) ────────────────────────────────────
    async function generateTranslatedWord(targetLangCode) {
        const docxLib = window.docx;
        if (!docxLib) {
            throw new Error('docx library is not loaded. Please refresh the app.');
        }
        if (typeof saveAs === 'undefined') {
            throw new Error('FileSaver is not loaded. Please refresh the app.');
        }

        const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } = docxLib;

        const sections = [];

        for (let i = 0; i < translatedPageTexts.length; i++) {
            const pageText = translatedPageTexts[i] || '';
            const lines = pageText.split('\n');

            // Page header paragraph
            sections.push(
                new Paragraph({
                    text: `Translated Page ${i + 1} of ${translatedPageTexts.length}  |  Original: ${currentFile.name}`,
                    heading: HeadingLevel.HEADING_2,
                    alignment: AlignmentType.LEFT,
                    spacing: { before: 200, after: 200 }
                })
            );

            // Content paragraphs
            for (const line of lines) {
                sections.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: line,
                                size: 24,
                                font: 'SolaimanLipi'
                            })
                        ],
                        spacing: { after: 120 }
                    })
                );
            }

            // Page break between pages (not after last page)
            if (i < translatedPageTexts.length - 1) {
                sections.push(
                    new Paragraph({
                        children: [new PageBreak()]
                    })
                );
            }
        }

        const doc = new Document({
            sections: [
                {
                    properties: {},
                    children: sections
                }
            ]
        });

        const blob = await Packer.toBlob(doc);
        const nameClean = currentFile.name.replace(/\.[^/.]+$/, '');
        saveAs(blob, `${nameClean}_translated_${targetLangCode}.docx`);
    }

    // ─── Word Download Action ─────────────────────────────────────────────────
    if (btnDownloadTranslatedWord) {
        btnDownloadTranslatedWord.addEventListener('click', async () => {
            if (translatedPageTexts.length === 0) return;

            btnDownloadTranslatedWord.disabled = true;
            const originalHtml = btnDownloadTranslatedWord.innerHTML;
            btnDownloadTranslatedWord.innerHTML = '⌛ Generating Word...';

            window.AGProgress.start('Generating Word file...', 'Building document');

            try {
                const targetLangCode = selectTargetLanguage.value;
                await generateTranslatedWord(targetLangCode);
                window.AGProgress.done();
                window.AGToast.success('Word document generated and saved!');
            } catch (err) {
                console.error('Word generation failed', err);
                window.AGProgress.error();
                window.AGToast.error('Failed to generate Word file: ' + (err.message || err));
            } finally {
                btnDownloadTranslatedWord.disabled = false;
                btnDownloadTranslatedWord.innerHTML = originalHtml;
            }
        });
    }

    // ─── Mock Translation dictionary ──────────────────────────────────────────
    function mockTranslate(text, langCode) {
        if (!text) return '';

        // Simple dictionary for key concepts to simulate translation
        const dictionary = {
            bn: {
                'pdf': 'পিডিএফ (PDF)',
                'editor': 'এডিটর',
                'report': 'প্রতিবেদন',
                'summary': 'সারাংশ',
                'project': 'প্রজেক্ট / প্রকল্প',
                'user': 'ব্যবহারকারী',
                'settings': 'সেটিংস',
                'file': 'ফাইল',
                'document': 'দলিল / ডকুমেন্ট',
                'test': 'পরীক্ষা',
                'application': 'অ্যাপ্লিকেশন',
                'mode': 'মোড',
                'dark': 'ডার্ক / অন্ধকার',
                'light': 'লাইট / আলো',
                'system': 'সিস্টেম',
                'tools': 'টুলস / যন্ত্রপাতি',
                'merge': 'মার্জ / একত্রিত করা',
                'split': 'স্প্লিট / বিভক্ত করা',
                'compress': 'কম্প্রেস / সংকুচিত করা',
                'rotate': 'রোটেট / ঘোরানো',
                'word': 'ওয়ার্ড',
                'excel': 'এক্সেল',
                'image': 'ছবি / ইমেজ',
                'translation': 'অনুবাদ',
                'assistant': 'সহকারী / অ্যাসিস্ট্যান্ট',
                'license': 'লাইসেন্স',
                'version': 'সংস্করণ',
                'help': 'সাহায্য',
                'click': 'ক্লিক',
                'save': 'সংরক্ষণ',
                'download': 'ডাউনলোড'
            },
            es: {
                'report': 'informe',
                'summary': 'resumen',
                'project': 'proyecto',
                'user': 'usuario',
                'settings': 'ajustes',
                'file': 'archivo',
                'document': 'documento',
                'test': 'prueba',
                'application': 'aplicación',
                'dark': 'oscuro',
                'light': 'claro',
                'translation': 'traducción',
                'assistant': 'asistente'
            }
        };

        const dict = dictionary[langCode];
        if (!dict) {
            // Default simulated language string if not Bengali or Spanish
            return `[Translated to ${langCode.toUpperCase()} Mode]\n\n` + text;
        }

        // Return a partially translated string that replaces main keywords to show it works,
        // and translates sentences.
        let lines = text.split('\n');
        let translatedLines = lines.map(line => {
            let words = line.split(' ');
            let transWords = words.map(word => {
                let cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
                if (dict[cleanWord]) {
                    return dict[cleanWord];
                }
                return word;
            });
            return transWords.join(' ');
        });

        let prefix = '';
        if (langCode === 'bn') {
            prefix = `[অনুবাদ সিমুলেশন - অফলাইন মোড]\n\n`;
        } else {
            prefix = `[Translation Simulation - Offline Mode]\n\n`;
        }

        return prefix + translatedLines.join('\n');
    }

    // Helper functions
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
});
