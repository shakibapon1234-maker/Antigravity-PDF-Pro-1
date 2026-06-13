const { PDFDocument, rgb, degrees, StandardFonts } = require('./ui/libs/pdf-lib.min.js');
const fs = require('fs');

async function test() {
    console.log('Creating PDF...');
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const xCtr = 300;
    const yCtr = 400;
    const wmText = "CONFIDENTIAL";
    const fSize = 50;
    const tw = font.widthOfTextAtSize(wmText, fSize);
    
    const r = parseInt('#ff0000'.slice(1, 3), 16) / 255;
    const g = parseInt('#ff0000'.slice(3, 5), 16) / 255;
    const b = parseInt('#ff0000'.slice(5, 7), 16) / 255;

    console.log('Drawing text...');
    page.drawText(wmText, {
        x: xCtr - tw / 2,
        y: yCtr,
        size: fSize,
        font,
        color: rgb(r, g, b),
        opacity: 0.5,
        rotate: degrees(-45),
    });
    
    console.log('Saving...');
    const bytes = await pdfDoc.save();
    fs.writeFileSync('test_watermark.pdf', bytes);
    console.log('Saved to test_watermark.pdf');
}

test().catch(console.error);