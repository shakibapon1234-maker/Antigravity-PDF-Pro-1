const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function main() {
    const pdfPath = 'E:/PDF editor/Antigravity-PDF-Pro-1/archive/mnt2qv3g4lzf9b/Certificate for Aviation_converted.pdf';
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjsLib.getDocument({ data });
    const doc = await loadingTask.promise;
    console.log('Total pages:', doc.numPages);
    const page = await doc.getPage(1);
    const textContent = await page.getTextContent();
    console.log('Text items count:', textContent.items.length);
    textContent.items.forEach((item, idx) => {
        console.log(`Item ${idx}: "${item.str}" at x=${item.transform[4]}, y=${item.transform[5]}, w=${item.width}, h=${item.height}`);
    });
}

main().catch(console.error);
