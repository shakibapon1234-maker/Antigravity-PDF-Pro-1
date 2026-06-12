// ─────────────────────────────────────────────
// editor/save-pdf.js — Antigravity PDF Pro
// PDF সেভ ও এক্সপোর্ট লজিক
// নির্ভর করে: core/state.js, core/utils.js
// ─────────────────────────────────────────────

async function savePdfChanges() {
    if (!currentPdfFile) { alert('No PDF loaded.'); return; }
    try {
        if (typeof window.finalizeTables === 'function') await window.finalizeTables();
        if (typeof finalizeMoveArea === 'function') finalizeMoveArea();
        document.querySelectorAll('.floating-editor').forEach(ae => {
            if (ae._commit) ae._commit();
        });
        const arrayBuffer = await currentPdfFile.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

        if (window.fontkit) pdfDoc.registerFontkit(window.fontkit);

        const pages = pdfDoc.getPages();

        function getFontVariant(family, bold, italic) {
            if (family === 'Times-Roman')
                return italic ? (bold ? StandardFonts.TimesRomanBoldItalic  : StandardFonts.TimesRomanItalic)
                              : (bold ? StandardFonts.TimesRomanBold         : StandardFonts.TimesRoman);
            if (family === 'Courier')
                return italic ? (bold ? StandardFonts.CourierBoldOblique    : StandardFonts.CourierOblique)
                              : (bold ? StandardFonts.CourierBold            : StandardFonts.Courier);
            return italic ? (bold ? StandardFonts.HelveticaBoldOblique : StandardFonts.HelveticaOblique)
                          : (bold ? StandardFonts.HelveticaBold         : StandardFonts.Helvetica);
        }

        // ── Clear stroke সেভ ────────────────────────────────────────────
        for (const stroke of clearStrokes) {
            const pg = pages[stroke.page - 1];
            if (!pg) continue;
            const cropBox = pg.getCropBox() || { x: 0, y: 0 };
            const cropX = cropBox.x || 0;
            const cropY = cropBox.y || 0;
            for (const r of stroke.rects) {
                if (r.patch && r.patch.startsWith('data:')) {
                    try {
                        const imgFormat = r.patch.split(';')[0].replace('data:', '');
                        const embeddedPatch = imgFormat.includes('png')
                            ? await pdfDoc.embedPng(r.patch)
                            : await pdfDoc.embedJpg(r.patch);
                        pg.drawImage(embeddedPatch, { x: r.x + cropX, y: r.y + cropY, width: r.w, height: r.h });
                        continue;
                    } catch (e) {}
                }
                pg.drawRectangle({
                    x: r.x + cropX, y: r.y + cropY, width: r.w, height: r.h,
                    color: rgb(r.r ?? 1, r.g ?? 1, r.b ?? 1)
                });
            }
        }

        // ── Image এডিট সেভ ─────────────────────────────────────────────
        for (const img of imageEdits) {
            const pg = pages[img.page - 1];
            if (!pg) continue;
            try {
                // Convert any format (JPEG/WebP/PNG) → PNG via canvas
                const pngDataUrl = await new Promise((res, rej) => {
                    const cvs   = document.createElement('canvas');
                    const image = new Image();
                    image.onload = () => {
                        cvs.width  = image.naturalWidth  || 200;
                        cvs.height = image.naturalHeight || 200;
                        cvs.getContext('2d').drawImage(image, 0, 0);
                        res(cvs.toDataURL('image/png'));
                    };
                    image.onerror = rej;
                    image.src = img.dataUrl;
                });
                const embeddedImg = await pdfDoc.embedPng(pngDataUrl);
                const cropBox = pg.getCropBox() || { x: 0, y: 0 };
                const cropX = cropBox.x || 0;
                const cropY = cropBox.y || 0;
                const drawOpts = {
                    x: img.x + cropX, y: img.y + cropY,
                    width: img.width, height: img.height,
                    opacity: img.opacity ?? 1
                };
                if (img.rotation && img.rotation !== 0) {
                    drawOpts.rotate = PDFLib.degrees(img.rotation);
                }
                pg.drawImage(embeddedImg, drawOpts);
            } catch (e) {
                console.error('Image embed error:', e);
            }
        }

        // ── Shape এডিট সেভ ─────────────────────────────────────────────
        for (const edit of shapeEdits) {
            const pg = pages[edit.page - 1];
            if (!pg) continue;
            const colorHex = edit.bgHex || edit.color || '#7c3aed';
            if (colorHex === 'transparent') continue;
            const color = hexToRgb(colorHex);
            const rot   = edit.rotation ? PDFLib.degrees(edit.rotation) : PDFLib.degrees(0);
            
            const cropBox = pg.getCropBox() || { x: 0, y: 0 };
            const cropX = cropBox.x || 0;
            const cropY = cropBox.y || 0;
            
            const cx    = edit.x + cropX + edit.width  / 2;
            const cy    = edit.y + cropY + edit.height / 2;

            if (edit.type === 'highlight') {
                const width = edit.w || edit.width || 0;
                const height = edit.h || edit.height || 0;
                pg.drawRectangle({
                    x: edit.x + cropX, y: edit.y + cropY, width: width, height: height,
                    color: rgb(color.r, color.g, color.b),
                    rotate: rot,
                    opacity: edit.opacity ?? 0.35
                });
            } else if (edit.type === 'rect' || edit.type === 'round-rect') {
                pg.drawRectangle({
                    x: edit.x + cropX, y: edit.y + cropY, width: edit.width, height: edit.height,
                    color: rgb(color.r, color.g, color.b),
                    rotate: rot,
                    opacity: edit.opacity ?? 1,
                    borderRadius: edit.type === 'round-rect' ? 8 : 0
                });
            } else if (edit.type === 'circle') {
                pg.drawEllipse({
                    x: cx, y: cy,
                    xScale: edit.width  / 2,
                    yScale: edit.height / 2,
                    color: rgb(color.r, color.g, color.b),
                    rotate: rot,
                    opacity: edit.opacity ?? 1
                });
            } else {
                const left = edit.x + cropX, bottomY = edit.y + cropY, w = edit.width, h = edit.height;
                let pts = [];
                if (edit.type === 'triangle') pts = [[0.5,1],[1,0],[0,0]];
                else if (edit.type === 'star') pts = [[0.5,1],[0.61,0.65],[0.98,0.65],[0.68,0.43],[0.79,0.09],[0.5,0.3],[0.21,0.09],[0.32,0.43],[0.02,0.65],[0.39,0.65]];
                else if (edit.type === 'line') pts = [[0,0.45],[1,0.45],[1,0.55],[0,0.55]];

                if (pts.length > 0) {
                    const rad     = (edit.rotation || 0) * Math.PI / 180;
                    const rotated = pts.map(p => {
                        const px = left + w * p[0] - cx;
                        const py = bottomY + h * p[1] - cy;
                        return [
                            cx + px * Math.cos(rad) - py * Math.sin(rad),
                            cy + px * Math.sin(rad) + py * Math.cos(rad)
                        ];
                    });
                    const pathStr = 'M ' + rotated.map(p => `${p[0].toFixed(2)} ${(-p[1]).toFixed(2)}`).join(' L ') + ' Z';
                    pg.drawSvgPath(pathStr, {
                        color: rgb(color.r, color.g, color.b),
                        opacity: edit.opacity ?? 1
                    });
                }
            }
        }

        // ── টেক্সট এডিট সেভ ────────────────────────────────────────────
        for (const edit of textEdits) {
            const pg = pages[edit.page - 1];
            if (!pg) continue;

            // Embed font first so we can measure text width accurately
            let font;
            const CUSTOM_FONTS = {
                'Hind Siliguri':    'https://raw.githubusercontent.com/google/fonts/main/ofl/hindsiliguri/HindSiliguri-Regular.ttf',
                'Noto Sans Bengali': 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosansbengali/NotoSansBengali-Regular.ttf'
            };

            if (edit.text && edit.text.trim()) {
                if (CUSTOM_FONTS[edit.font]) {
                    if (!window._cachedCustomFonts) window._cachedCustomFonts = {};
                    if (!window._cachedCustomFonts[edit.font]) {
                        try {
                            const fontRes = await fetch(CUSTOM_FONTS[edit.font]);
                            window._cachedCustomFonts[edit.font] = await fontRes.arrayBuffer();
                        } catch (e) {
                            console.error(`Custom font load failed (${edit.font}):`, e);
                        }
                    }
                    font = window._cachedCustomFonts[edit.font]
                        ? await pdfDoc.embedFont(window._cachedCustomFonts[edit.font])
                        : await pdfDoc.embedFont(getFontVariant('Helvetica', edit.isBold, edit.isItalic));
                } else {
                    font = await pdfDoc.embedFont(getFontVariant(edit.font, edit.isBold, edit.isItalic));
                }
            }

            const cropBox = pg.getCropBox() || { x: 0, y: 0 };
            const cropX = cropBox.x || 0;
            const cropY = cropBox.y || 0;

            // 1. Draw background cover rectangle or image patch at the ORIGINAL position for edited original text
            if (!edit.isNew) {
                let drewPatch = false;
                if (edit.patch && edit.patch.startsWith('data:')) {
                    try {
                        const imgFormat = edit.patch.split(';')[0].replace('data:', '');
                        const embeddedPatch = imgFormat.includes('png')
                            ? await pdfDoc.embedPng(edit.patch)
                            : await pdfDoc.embedJpg(edit.patch);
                        const coverHeight = edit.originalHeight || edit.height || edit.size;
                        const coverWidth = edit.originalWidth || edit.width || 40;
                        pg.drawImage(embeddedPatch, {
                            x: edit.originalX,
                            y: edit.originalY,
                            width: coverWidth,
                            height: coverHeight
                        });
                        drewPatch = true;
                    } catch (e) {
                        console.error('Failed to draw edit background patch in PDF:', e);
                    }
                }
                
                if (!drewPatch) {
                    const coverBgHex = edit.coverBgHex || ((edit.bgHex && edit.bgHex !== 'transparent') ? edit.bgHex : '#ffffff');
                    const bgColor = hexToRgb(coverBgHex);
                    const descent = edit.size * 0.25;
                    const coverHeight = Math.max(edit.originalHeight || edit.height || edit.size, edit.size + descent + 2);
                    const coverWidth = edit.originalWidth || edit.width || 40;
                    const padding = 2;
                    pg.drawRectangle({
                        x: edit.originalX - padding,
                        y: edit.originalY - descent - padding,
                        width: coverWidth + padding * 2,
                        height: coverHeight + padding * 2,
                        color: rgb(bgColor.r, bgColor.g, bgColor.b)
                    });
                }
            }

            // 2. Draw background cover rectangle at the NEW position (only if background color is set)
            if (edit.bgHex && edit.bgHex !== 'transparent') {
                const bgColor = hexToRgb(edit.bgHex);
                // Calculate accurate text width from font metrics when possible
                let coverWidth = edit.width || 10;
                if (font && edit.text && edit.text.trim()) {
                    try {
                        const measuredWidth = font.widthOfTextAtSize(edit.text, edit.size);
                        coverWidth = Math.max(coverWidth, measuredWidth + 4);
                    } catch(e) {}
                }
                // descent ≈ 25% of font size, ascent ≈ font size
                const descent = edit.size * 0.25;
                const coverHeight = Math.max(edit.height || edit.size, edit.size + descent + 2);
                const padding = 2;
                pg.drawRectangle({
                    x: edit.x - padding + (edit.isNew ? cropX : 0),
                    y: edit.y - descent - padding + (edit.isNew ? cropY : 0),
                    width: coverWidth + padding * 2,
                    height: coverHeight + padding * 2,
                    color: rgb(bgColor.r, bgColor.g, bgColor.b)
                });
            }

            // Draw text on top of background
            if (font && edit.text && edit.text.trim()) {
                const color = hexToRgb(edit.color);
                pg.drawText(edit.text, {
                    x: edit.x + (edit.isNew ? cropX : 0),
                    y: edit.y + (edit.isNew ? cropY : 0),
                    size: edit.size,
                    font, color: rgb(color.r, color.g, color.b)
                });

                if (edit.isUnderline) {
                    const tw = font.widthOfTextAtSize(edit.text, edit.size);
                    pg.drawLine({
                        start: { x: edit.x + (edit.isNew ? cropX : 0),      y: edit.y + (edit.isNew ? cropY : 0) - 2 },
                        end:   { x: edit.x + (edit.isNew ? cropX : 0) + tw,  y: edit.y + (edit.isNew ? cropY : 0) - 2 },
                        thickness: 1,
                        color: rgb(color.r, color.g, color.b)
                    });
                }
            }
        }

        

        // ── Form fields integration ────────────────────────────────────
        if (window.formFields && window.formFields.length > 0) {
            const form = pdfDoc.getForm();
            const radioGroups = {};

            for (const f of window.formFields) {
                const pg = pages[f.page - 1];
                if (!pg) continue;

                const cropBox = pg.getCropBox() || { x: 0, y: 0 };
                const cropX = cropBox.x || 0;
                const cropY = cropBox.y || 0;

                const x = f.x + cropX;
                const y = pg.getHeight() - f.y - f.h + cropY;
                const width = f.w;
                const height = f.h;

                if (f.type === 'text') {
                    const textField = form.createTextField(f.name);
                    textField.addToPage(pg, { x, y, width, height });
                    if (f.required) textField.enableRequired();
                } else if (f.type === 'checkbox') {
                    const checkBox = form.createCheckBox(f.name);
                    checkBox.addToPage(pg, { x, y, width, height });
                    if (f.required) checkBox.enableRequired();
                } else if (f.type === 'radio') {
                    if (!radioGroups[f.name]) {
                        radioGroups[f.name] = form.createRadioGroup(f.name);
                        if (f.required) radioGroups[f.name].enableRequired();
                    }
                    const optionVal = f.value || 'Choice';
                    try {
                        radioGroups[f.name].addOptionToPage(optionVal, pg, { x, y, width, height });
                    } catch (e) {
                        console.error('Failed to add radio option:', e);
                    }
                } else if (f.type === 'dropdown') {
                    const dropdown = form.createDropdown(f.name);
                    dropdown.addToPage(pg, { x, y, width, height });
                    if (f.options && f.options.length > 0) {
                        dropdown.setOptions(f.options);
                    }
                    if (f.required) dropdown.enableRequired();
                } else if (f.type === 'signature') {
                    const sigButton = form.createButton(f.name);
                    sigButton.addToPage(pg, { x, y, width, height });
                }
            }
        }

        // ── Hyperlinks integration ────────────────────────────────────
        if (window.hyperlinks && window.hyperlinks.length > 0) {
            for (const link of window.hyperlinks) {
                const pg = pages[link.page - 1];
                if (!pg) continue;

                const cropBox = pg.getCropBox() || { x: 0, y: 0 };
                const cropX = cropBox.x || 0;
                const cropY = cropBox.y || 0;

                const x1 = link.x + cropX;
                const y1 = pg.getHeight() - link.y - link.h + cropY;
                const x2 = link.x + link.w + cropX;
                const y2 = pg.getHeight() - link.y + cropY;

                const linkAnnot = pdfDoc.context.obj({
                    Type: 'Annot',
                    Subtype: 'Link',
                    Rect: [x1, y1, x2, y2],
                    Border: [0, 0, 0], // invisible border
                    A: {
                        Type: 'Action',
                        S: 'URI',
                        URI: PDFLib.PDFString.of(link.url)
                    }
                });
                const linkAnnotRef = pdfDoc.context.register(linkAnnot);
                
                const existingAnnots = pg.node.get('Annots');
                const annotsArray = existingAnnots ? pdfDoc.context.lookup(existingAnnots) : null;
                if (annotsArray) {
                    annotsArray.push(linkAnnotRef);
                } else {
                    pg.node.set('Annots', pdfDoc.context.newArray([linkAnnotRef]));
                }
            }
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        saveAs(blob, 'edited_' + currentPdfFile.name);

        // ── Auto-Backup (Phase 1-D) ──────────────────────────────────────
        if (window.electronAPI?.saveBackup) {
          try {
            await window.electronAPI.saveBackup(currentPdfFile.name, pdfBytes);
            console.log('[SavePDF] Backup saved successfully.');
          } catch (backupErr) {
            console.warn('[SavePDF] Backup failed (non-critical):', backupErr);
          }
        }

    } catch (err) {
        console.error(err);
        alert('Failed to save PDF: ' + err.message);
    }
}

// ── Archive আপলোড ──────────────────────────────────────────────────────────
async function archiveUpload(fileLike, name, sourceTool) {
    try {
        const fd = new FormData();
        fd.append('file', fileLike, name || 'file');
        if (sourceTool) fd.append('tool', sourceTool);
        const res = await fetch('/archive', { method: 'POST', body: fd });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        return await res.json();
    } catch (e) {
        console.warn('Archive upload failed:', e);
        return null;
    }
}
