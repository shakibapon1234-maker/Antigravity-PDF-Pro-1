// Antigravity PDF - Measurement Tools
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('measureInput');
    const emptyState = document.getElementById('measureEmptyState');
    const workspace = document.getElementById('measureWorkspace');
    const scaleSelect = document.getElementById('measureScaleSelect');
    const pageNumDisplay = document.getElementById('measurePageNum');
    const prevBtn = document.getElementById('btnMeasurePrev');
    const nextBtn = document.getElementById('btnMeasureNext');
    const measureOutput = document.getElementById('measureOutput');
    const canvas = document.getElementById('measureCanvas');
    const overlayCanvas = document.getElementById('measureOverlayCanvas');

    if (!fileInput) return;

    let pdfDoc = null;
    let currentPageNum = 1;
    let isMeasuring = false;
    let startPoint = { x: 0, y: 0 };
    const renderScale = 1.5; // Render scale for screen layout

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) handleMeasureFile(file);
    };

    if (emptyState) {
        emptyState.onclick = () => fileInput.click();
    }

    async function handleMeasureFile(file) {
        if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
            alert('Please select a valid PDF file.');
            return;
        }

        if (typeof pdfjsLib === 'undefined') {
            alert('PDF.js library not loaded. Please refresh the page.');
            return;
        }

        emptyState.classList.add('d-none');
        workspace.classList.remove('d-none');

        try {
            const arrayBuffer = await file.arrayBuffer();
            pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            currentPageNum = 1;
            await renderPage(currentPageNum);
        } catch (err) {
            console.error('Error loading PDF for measurement:', err);
            alert('Failed to load PDF: ' + err.message);
            resetMeasurement();
        }
    }

    async function renderPage(pageNum) {
        if (!pdfDoc) return;

        try {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: renderScale });

            canvas.width = viewport.width;
            canvas.height = viewport.height;
            overlayCanvas.width = viewport.width;
            overlayCanvas.height = viewport.height;

            const ctx = canvas.getContext('2d');
            // Fill background white
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            await page.render({ canvasContext: ctx, viewport }).promise;

            pageNumDisplay.textContent = `Page ${pageNum} / ${pdfDoc.numPages}`;
            prevBtn.disabled = pageNum <= 1;
            nextBtn.disabled = pageNum >= pdfDoc.numPages;

            // Clear any old drawings on overlay
            const overlayCtx = overlayCanvas.getContext('2d');
            overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
            measureOutput.textContent = '0.00 units';

        } catch (err) {
            console.error('Error rendering page:', err);
        }
    }

    // --- Page Navigation ---
    if (prevBtn) {
        prevBtn.onclick = () => {
            if (currentPageNum > 1) {
                currentPageNum--;
                renderPage(currentPageNum);
            }
        };
    }

    if (nextBtn) {
        nextBtn.onclick = () => {
            if (pdfDoc && currentPageNum < pdfDoc.numPages) {
                currentPageNum++;
                renderPage(currentPageNum);
            }
        };
    }

    function resetMeasurement() {
        pdfDoc = null;
        currentPageNum = 1;
        workspace.classList.add('d-none');
        emptyState.classList.remove('d-none');
    }

    // --- Measurement Math Helpers ---
    function getScaleParams() {
        const scaleVal = scaleSelect.value;
        let multiplier = 1;
        let suffix = 'pt';

        switch (scaleVal) {
            case '1':
                multiplier = 1;
                suffix = 'pt';
                break;
            case '10':
                // 1 inch = 72 points -> 10 feet. So 1 point = 10/72 feet
                multiplier = 10 / 72;
                suffix = 'ft';
                break;
            case '20':
                multiplier = 20 / 72;
                suffix = 'ft';
                break;
            case '50':
                multiplier = 50 / 72;
                suffix = 'ft';
                break;
            case '0.01':
                // 1 point = 0.352778 mm -> 1 mm = 1 cm, so 1 point = 3.52778 cm
                multiplier = 0.352778 * 10;
                suffix = 'cm';
                break;
            case '0.1':
                // 1 point = 0.352778 mm -> 1 mm = 1 meter, so 1 point = 0.352778 meters
                multiplier = 0.352778;
                suffix = 'm';
                break;
        }
        return { multiplier, suffix };
    }

    // --- Mouse Listeners for Measurement ---
    overlayCanvas.addEventListener('mousedown', (e) => {
        isMeasuring = true;
        const rect = overlayCanvas.getBoundingClientRect();
        startPoint = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    });

    overlayCanvas.addEventListener('mousemove', (e) => {
        if (!isMeasuring) return;

        const rect = overlayCanvas.getBoundingClientRect();
        const currentPoint = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        const dx = currentPoint.x - startPoint.x;
        const dy = currentPoint.y - startPoint.y;
        const pixelDist = Math.sqrt(dx * dx + dy * dy);

        // Convert pixels to points (renderScale adjusts the canvas scale on screen)
        const pointsDist = pixelDist / renderScale;
        const { multiplier, suffix } = getScaleParams();
        const measuredValue = pointsDist * multiplier;

        measureOutput.textContent = `${measuredValue.toFixed(2)} ${suffix}`;

        // Draw overlay line and label
        const overlayCtx = overlayCanvas.getContext('2d');
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

        // Draw line
        overlayCtx.beginPath();
        overlayCtx.setLineDash([6, 4]);
        overlayCtx.moveTo(startPoint.x, startPoint.y);
        overlayCtx.lineTo(currentPoint.x, currentPoint.y);
        overlayCtx.strokeStyle = '#00d4ff';
        overlayCtx.lineWidth = 2.5;
        overlayCtx.stroke();

        // Draw start/end points
        overlayCtx.setLineDash([]);
        overlayCtx.fillStyle = '#ff8a00';
        overlayCtx.beginPath();
        overlayCtx.arc(startPoint.x, startPoint.y, 5, 0, Math.PI * 2);
        overlayCtx.arc(currentPoint.x, currentPoint.y, 5, 0, Math.PI * 2);
        overlayCtx.fill();

        // Draw measurement text label on canvas
        const midX = (startPoint.x + currentPoint.x) / 2;
        const midY = (startPoint.y + currentPoint.y) / 2;
        overlayCtx.fillStyle = 'rgba(10,10,18,0.8)';
        overlayCtx.fillRect(midX - 45, midY - 24, 90, 20);

        overlayCtx.fillStyle = '#ffffff';
        overlayCtx.font = '11px sans-serif';
        overlayCtx.textAlign = 'center';
        overlayCtx.fillText(`${measuredValue.toFixed(2)} ${suffix}`, midX, midY - 10);
    });

    overlayCanvas.addEventListener('mouseup', () => {
        isMeasuring = false;
    });

    overlayCanvas.addEventListener('mouseleave', () => {
        isMeasuring = false;
    });
});
