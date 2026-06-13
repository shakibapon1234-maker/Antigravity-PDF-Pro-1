/**
 * Antigravity PDF - Watermark Logic (FIXED: Direct PDF annotation, no nuclear flattening)
 * - Text watermark → direct PDF-lib drawText on each page (text stays searchable)
 * - Image watermark → embed image directly into PDF layer
 * - Bengali font loaded from local embedded base64 or Helvetica fallback
 */
document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const fileInput = document.getElementById('watermarkFileInput');
    const uploadBtn = document.getElementById('btnUploadWatermark');
    const applyBtn = document.getElementById('btnApplyWatermark');
    const downloadBtn = document.getElementById('btnDownloadWatermark');
    const workspace = document.getElementById('watermarkWorkspace');
    const emptyState = document.getElementById('watermarkEmptyState');
    const previewContainer = document.getElementById('watermarkPreview');

    // Control Elements
    const wmText = document.getElementById('wmText');
    const wmSize = document.getElementById('wmSize');
    const wmColor = document.getElementById('wmColor');
    const wmOpacity = document.getElementById('wmOpacity');
    const wmRotation = document.getElementById('wmRotation');
    const wmImageInput = document.getElementById('wmImageInput');
    const imgOptions = document.getElementById('imgWatermarkOptions');
    const txtOptions = document.getElementById('txtWatermarkOptions');
    const wmPosX = document.getElementById('wmPosX');
    const wmPosY = document.getElementById('wmPosY');
    const wmScale = document.getElementById('wmScale');
    const wmFont = document.getElementById('wmFont');

    // State
    let currentFileData = null;
    let watermarkedPdfBytes = null;
    let watermarkType = 'text';
    let currentWatermarkImage = null;

    // History State
    let wmHistory = [];
    let isUndoing = false;
    const btnResetWatermark = document.getElementById('btnResetWatermark');
    const btnUndoWatermark = document.getElementById('btnUndoWatermark');

    function getWmState() {
        return {
            type: watermarkType,
            text: wmText ? wmText.value : '',
            size: wmSize ? wmSize.value : 50,
            color: wmColor ? wmColor.value : '#ff0000',
            opacity: wmOpacity ? wmOpacity.value : 0.5,
            rotation: wmRotation ? wmRotation.value : 45,
            posX: wmPosX ? wmPosX.value : 50,
            posY: wmPosY ? wmPosY.value : 50,
            scale: wmScale ? wmScale.value : 1.0,
            font: wmFont ? wmFont.value : 'Helvetica-Bold',
            image: currentWatermarkImage
        };
    }

    function applyWmState(state) {
        if (!state) return;
        isUndoing = true;
        if (state.type !== watermarkType) window.toggleWatermarkType(state.type);
        if (wmText) wmText.value = state.text;
        if (wmSize) wmSize.value = state.size;
        if (wmColor) wmColor.value = state.color;
        if (wmOpacity) wmOpacity.value = state.opacity;
        if (wmRotation) wmRotation.value = state.rotation;
        if (wmPosX) wmPosX.value = state.posX;
        if (wmPosY) wmPosY.value = state.posY;
        if (wmScale) wmScale.value = state.scale;
        if (wmFont) wmFont.value = state.font;
        currentWatermarkImage = state.image;
        updatePreview();
        isUndoing = false;
    }

    function pushWmState() {
        if (isUndoing) return;
        wmHistory.push(getWmState());
        if (wmHistory.length > 20) wmHistory.shift();
        if (btnUndoWatermark) btnUndoWatermark.disabled = false;
    }

    let defaultWmState = null;
    setTimeout(() => { if (wmText) defaultWmState = getWmState(); }, 500);

    if (btnResetWatermark) {
        btnResetWatermark.addEventListener('click', () => {
            if (!defaultWmState) return;
            pushWmState();
            applyWmState(defaultWmState);
        });
    }

    if (btnUndoWatermark) {
        btnUndoWatermark.addEventListener('click', () => {
            if (wmHistory.length > 0) {
                applyWmState(wmHistory.pop());
                if (wmHistory.length === 0) btnUndoWatermark.disabled = true;
            }
        });
    }

    if (!fileInput) return;

    // --- Tab Switching ---
    window.toggleWatermarkType = (type) => {
        watermarkType = type;
        const tabs = document.querySelectorAll('#watermarkWorkspace .tabs .btn');
        tabs.forEach(btn => btn.classList.remove('active'));
        if (type === 'text') {
            if (txtOptions) txtOptions.style.display = 'block';
            if (imgOptions) imgOptions.style.display = 'none';
            if (tabs[0]) tabs[0].classList.add('active');
            const wmFontOpt = document.getElementById('wmFontOption');
            if (wmFontOpt) wmFontOpt.style.display = 'block';
        } else {
            if (txtOptions) txtOptions.style.display = 'none';
            if (imgOptions) imgOptions.style.display = 'block';
            if (tabs[1]) tabs[1].classList.add('active');
            const wmFontOpt = document.getElementById('wmFontOption');
            if (wmFontOpt) wmFontOpt.style.display = 'none';
        }
        updatePreview();
    };

    // --- File Loading ---
uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) handleWatermarkFile(file);
    });

    window.loadWatermarkPdf = function(file) {
        if (!file) return;
        handleWatermarkFile(file);
    };

    function handleWatermarkFile(file) {
        if (!file) return;
        const fileType = file.type || (file.name && file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : null);
        if (fileType !== 'application/pdf') {
            alert('Please select a valid PDF.');
            return;
        }
        const reader = new FileReader();
        reader.onload = function() {
            currentFileData = new Uint8Array(this.result);
            watermarkedPdfBytes = null;
            if (downloadBtn) downloadBtn.disabled = true;
            if (emptyState) emptyState.classList.add('d-none');
            if (workspace) { workspace.classList.remove('d-none'); workspace.style.display = 'flex'; }
            if (previewContainer) previewContainer.style.cursor = 'grab';

            // Feed thumbnails sidebar
            if (window.ThumbnailSidebar && window.pdfjsLib) {
                pdfjsLib.getDocument({ data: currentFileData.slice(0) }).promise
                    .then(doc => ThumbnailSidebar.loadDocument(doc))
                    .catch(()=>{});
            }

            updatePreview();
        };
        reader.readAsArrayBuffer(file);
    }

    // Event listeners for all controls
    [wmText, wmSize, wmColor, wmOpacity, wmRotation, wmPosX, wmPosY, wmScale, wmFont].forEach(el => {
        if (el) {
            el.addEventListener('input', updatePreview);
            el.addEventListener('change', pushWmState);
        }
    });

    if (wmImageInput) {
        wmImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) {
                currentWatermarkImage = null;
                updatePreview();
                pushWmState();
                return;
            }
            const reader = new FileReader();
            reader.onload = function() {
                currentWatermarkImage = new Uint8Array(this.result);
                updatePreview();
                pushWmState();
            };
            reader.readAsArrayBuffer(file);
        });
    }

    // --- Drag-to-move watermark on preview canvas ---
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let dragStartPosX = 50, dragStartPosY = 50;
    let dragHintFaded = false;

    function getCanvasFromPreview() {
        return previewContainer.querySelector('canvas');
    }

    previewContainer.addEventListener('mousedown', (e) => {
        const canvas = getCanvasFromPreview();
        if (!canvas || !currentFileData) return;
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragStartPosX = parseFloat(wmPosX.value);
        dragStartPosY = parseFloat(wmPosY.value);
        previewContainer.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const canvas = getCanvasFromPreview();
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;

        // Convert pixel delta → percentage of canvas size
        const newX = Math.min(100, Math.max(0, dragStartPosX + (dx / rect.width) * 100));
        // Y axis: canvas top = 0%, bottom = 100% but PDF Y is inverted → handle in updatePreview already
        const newY = Math.min(100, Math.max(0, dragStartPosY - (dy / rect.height) * 100));

        wmPosX.value = Math.round(newX);
        wmPosY.value = Math.round(newY);
        updatePreview();

        // Fade hint after first drag
        if (!dragHintFaded) {
            dragHintFaded = true;
            const hint = document.getElementById('wmDragHint');
            if (hint) {
                hint.style.opacity = '0';
                setTimeout(() => hint.style.display = 'none', 500);
            }
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            previewContainer.style.cursor = 'grab';
            pushWmState();
        }
    });

    // Touch support for mobile
    previewContainer.addEventListener('touchstart', (e) => {
        const canvas = getCanvasFromPreview();
        if (!canvas || !currentFileData) return;
        const touch = e.touches[0];
        isDragging = true;
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
        dragStartPosX = parseFloat(wmPosX.value);
        dragStartPosY = parseFloat(wmPosY.value);
        e.preventDefault();
    }, { passive: false });

    previewContainer.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const canvas = getCanvasFromPreview();
        if (!canvas) return;
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const dx = touch.clientX - dragStartX;
        const dy = touch.clientY - dragStartY;
        const newX = Math.min(100, Math.max(0, dragStartPosX + (dx / rect.width) * 100));
        const newY = Math.min(100, Math.max(0, dragStartPosY - (dy / rect.height) * 100));
        wmPosX.value = Math.round(newX);
        wmPosY.value = Math.round(newY);
        updatePreview();
        if (!dragHintFaded) {
            dragHintFaded = true;
            const hint = document.getElementById('wmDragHint');
            if (hint) { hint.style.opacity = '0'; setTimeout(() => hint.style.display = 'none', 500); }
        }
        e.preventDefault();
    }, { passive: false });

    previewContainer.addEventListener('touchend', () => {
        if (isDragging) { isDragging = false; pushWmState(); }
    });


    function setPreviewCanvas(canvas) {
        // Remove old canvas but keep other elements like the drag hint
        const old = previewContainer.querySelector('canvas');
        if (old) old.remove();
        previewContainer.appendChild(canvas);
    }

    // --- Preview Logic (canvas overlay preview) ---
    async function updatePreview() {
        if (!currentFileData) return;
        try {
            const pdf = await pdfjsLib.getDocument({ data: currentFileData.slice(0) }).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 0.8 });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.display = 'block';

            // Fill white background to support transparent PDF pages and avoid black-on-black invisibility
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            await page.render({ canvasContext: ctx, viewport }).promise;

            ctx.save();
            const x = canvas.width * (parseFloat(wmPosX.value) / 100);
            const y = canvas.height * (1 - (parseFloat(wmPosY.value) / 100));
            const scale = parseFloat(wmScale.value);
            const rotationRad = (parseInt(wmRotation.value) * Math.PI) / 180;

            ctx.translate(x, y);
            ctx.rotate(rotationRad);
            ctx.globalAlpha = parseFloat(wmOpacity.value);

            if (watermarkType === 'text') {
                const fontSize = parseInt(wmSize.value) * scale * 0.8;
                ctx.font = `bold ${fontSize}px Outfit, sans-serif`;
                ctx.fillStyle = wmColor.value;
                ctx.textAlign = 'center';
                ctx.fillText(wmText.value, 0, 0);
            } else if (currentWatermarkImage) {
                const img = new Image();
                img.onload = () => {
                    const baseSize = 250;
                    const imgScale = (baseSize / Math.max(img.width, img.height)) * scale;
                    ctx.drawImage(img, -img.width * imgScale / 2, -img.height * imgScale / 2, img.width * imgScale, img.height * imgScale);
                    ctx.restore();
                    setPreviewCanvas(canvas);
                };
                img.src = URL.createObjectURL(new Blob([currentWatermarkImage]));
                return;
            }
            ctx.restore();
            setPreviewCanvas(canvas);
        } catch (e) { console.error('Preview error', e); }
    }

    // --- Apply Logic (FIXED: Direct PDF annotation, no flattening) ---
    applyBtn.addEventListener('click', async () => {
        if (!currentFileData) return;
        applyBtn.disabled = true;
        applyBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Processing...';
        if (window.lucide) lucide.createIcons();

        try {
            const { PDFDocument, rgb, degrees, StandardFonts } = PDFLib;

            // Load the ORIGINAL PDF directly (no nuclear flattening)
            const pdfDoc = await PDFDocument.load(currentFileData.slice(0), { ignoreEncryption: true });
            pdfDoc.registerFontkit(fontkit);

            // Embed font
            let font;
            const isNonHelvetica = wmFont && wmFont.value !== 'Helvetica-Bold';
            if (watermarkType === 'text' && isNonHelvetica) {
                try {
                    // Try to fetch the Noto Sans Bengali font
                    const fontUrl = 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansBengali/NotoSansBengali-Regular.ttf';
                    const res = await fetch(fontUrl);
                    if (!res.ok) throw new Error('Font fetch failed');
                    const fontBytes = await res.arrayBuffer();
                    font = await pdfDoc.embedFont(fontBytes);
                } catch (fontErr) {
                    console.warn('Could not load Bengali font, falling back to Helvetica:', fontErr);
                    font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
                }
            } else {
                font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            }

            // Embed image if needed
            let wmImg = null;
            if (watermarkType === 'image' && currentWatermarkImage) {
                const head = currentWatermarkImage.slice(0, 4);
                const isPng = head[0] === 0x89 && head[1] === 0x50;
                try {
                    wmImg = isPng
                        ? await pdfDoc.embedPng(currentWatermarkImage)
                        : await pdfDoc.embedJpg(currentWatermarkImage);
                } catch (imgErr) {
                    // Try the other format
                    wmImg = isPng
                        ? await pdfDoc.embedJpg(currentWatermarkImage)
                        : await pdfDoc.embedPng(currentWatermarkImage);
                }
            }

            const pages = pdfDoc.getPages();
            const totalPages = pages.length;

            for (let i = 0; i < totalPages; i++) {
                applyBtn.innerHTML = `Processing ${i + 1}/${totalPages}...`;
                const page = pages[i];
                const { width, height } = page.getSize();

                const opacity = parseFloat(wmOpacity.value);
                const rot = parseInt(wmRotation.value);
                const scaleVal = parseFloat(wmScale.value);

                // PDF coordinate system: origin = bottom-left
                // wmPosX/Y are 0-100% sliders
                const xCtr = width * (parseFloat(wmPosX.value) / 100);
                const yCtr = height * (parseFloat(wmPosY.value) / 100);
                const pdfRot = degrees(-rot);

                if (watermarkType === 'text' && wmText.value) {
                    const fSize = parseInt(wmSize.value) * scaleVal;
                    const tw = font.widthOfTextAtSize(wmText.value, fSize);

                    // Simple centering: just offset by half text width
                    // PDF-lib rotates around the (x,y) point, so position at center
                    page.drawText(wmText.value, {
                        x: xCtr - tw / 2,
                        y: yCtr,
                        size: fSize,
                        font,
                        color: hexToRgbLib(wmColor.value, rgb),
                        opacity,
                        rotate: pdfRot,
                    });
                } else if (wmImg) {
                    // Calculate target size relative to PAGE, not native image resolution
                    // Preview uses baseSize=250 at 0.8 scale = 312.5 PDF points base
                    const baseSize = 312.5; // matches preview's 250px / 0.8
                    const nativeW = wmImg.width;
                    const nativeH = wmImg.height;
                    const imgFitScale = baseSize / Math.max(nativeW, nativeH);
                    const iw = nativeW * imgFitScale * scaleVal;
                    const ih = nativeH * imgFitScale * scaleVal;

                    // Center image at (xCtr, yCtr)
                    page.drawImage(wmImg, {
                        x: xCtr - iw / 2,
                        y: yCtr - ih / 2,
                        width: iw, height: ih,
                        opacity,
                        rotate: pdfRot,
                    });
                }
            }

            watermarkedPdfBytes = await pdfDoc.save({ useObjectStreams: false });

            // Hide the global progress spinner
            if (window.AGProgress) AGProgress.done();

            applyBtn.innerHTML = '<i data-lucide="check-circle"></i> Done!';
            if (downloadBtn) downloadBtn.disabled = false;

            setTimeout(() => {
                applyBtn.innerHTML = '<i data-lucide="zap"></i> Apply Watermark';
                if (window.lucide) lucide.createIcons();
            }, 1500);

        } catch (err) {
            console.error('Watermark error:', err);
            if (window.AGProgress) AGProgress.error();
            alert('Error applying watermark: ' + err.message);
            applyBtn.innerHTML = '<i data-lucide="zap"></i> Apply Watermark';
        } finally {
            applyBtn.disabled = false;
            if (window.lucide) lucide.createIcons();
        }
    });

    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            if (!watermarkedPdfBytes) return;
            const blob = new Blob([watermarkedPdfBytes], { type: 'application/pdf' });
            const name = (fileInput.files[0] ? fileInput.files[0].name.replace('.pdf', '') : 'result') + '_watermarked.pdf';
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = name;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    function hexToRgbLib(hex, rgbFunc) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return rgbFunc(r, g, b);
    }
});
