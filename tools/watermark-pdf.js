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
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file || file.type !== 'application/pdf') return alert('Please select a valid PDF.');
        const reader = new FileReader();
        reader.onload = function() {
            currentFileData = new Uint8Array(this.result);
            watermarkedPdfBytes = null;
            if (downloadBtn) downloadBtn.disabled = true;
            emptyState.classList.add('d-none');
            workspace.classList.remove('d-none');
            workspace.style.display = 'flex';
            updatePreview();
        };
        reader.readAsArrayBuffer(file);
    });

    if (wmImageInput) {
        wmImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function() {
                pushWmState();
                currentWatermarkImage = new Uint8Array(this.result);
                updatePreview();
            };
            reader.readAsArrayBuffer(file);
        });
    }

    // Event listeners for all controls
    [wmText, wmSize, wmColor, wmOpacity, wmRotation, wmPosX, wmPosY, wmScale, wmFont].forEach(el => {
        if (el) {
            el.addEventListener('input', updatePreview);
            el.addEventListener('change', pushWmState);
        }
    });

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
                    previewContainer.innerHTML = '';
                    previewContainer.appendChild(canvas);
                };
                img.src = URL.createObjectURL(new Blob([currentWatermarkImage]));
                return;
            }
            ctx.restore();
            previewContainer.innerHTML = '';
            previewContainer.appendChild(canvas);
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
                const rad = (-rot * Math.PI) / 180;

                if (watermarkType === 'text' && wmText.value) {
                    const fSize = parseInt(wmSize.value) * scaleVal;
                    const tw = font.widthOfTextAtSize(wmText.value, fSize);
                    // Offset so text center is at (xCtr, yCtr)
                    const offX = (tw / 2) * Math.cos(rad);
                    const offY = (tw / 2) * Math.sin(rad);

                    page.drawText(wmText.value, {
                        x: xCtr - offX,
                        y: yCtr - offY,
                        size: fSize,
                        font,
                        color: hexToRgbLib(wmColor.value, rgb),
                        opacity,
                        rotate: pdfRot,
                    });
                } else if (wmImg) {
                    const imgDims = wmImg.scale(0.5 * scaleVal);
                    const iw = imgDims.width;
                    const ih = imgDims.height;
                    const sX = xCtr - (iw / 2 * Math.cos(rad) - ih / 2 * Math.sin(rad));
                    const sY = yCtr - (iw / 2 * Math.sin(rad) + ih / 2 * Math.cos(rad));
                    page.drawImage(wmImg, {
                        x: sX, y: sY,
                        width: iw, height: ih,
                        opacity,
                        rotate: pdfRot,
                    });
                }
            }

            watermarkedPdfBytes = await pdfDoc.save({ useObjectStreams: false });

            applyBtn.innerHTML = '<i data-lucide="check-circle"></i> Done!';
            if (downloadBtn) downloadBtn.disabled = false;

            setTimeout(() => {
                applyBtn.innerHTML = '<i data-lucide="zap"></i> Apply Watermark';
                if (window.lucide) lucide.createIcons();
            }, 1500);

        } catch (err) {
            console.error('Watermark error:', err);
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
