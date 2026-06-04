const { PDFDocument, PDFArray, PDFRawStream, PDFName } = require('./node_modules/pdf-lib');
const { decodePDFRawStream } = require('./node_modules/pdf-lib/cjs/core/streams/decode');
const fs = require('fs');

async function main() {
    const pdfPath = 'C:/Users/intel/.gemini/antigravity/brain/68882043-ab08-4cea-b728-db06108af75f/scratch/edited2.pdf';
    const doc = await PDFDocument.load(fs.readFileSync(pdfPath));
    const page = doc.getPages()[0];
    const contentsRef = page.node.get(PDFName.of('Contents'));
    const contents = page.node.context.lookup(contentsRef);
    
    for (let i = 0; i < contents.size(); i++) {
        const ref = contents.get(i);
        const obj = page.node.context.lookup(ref);
        console.log(`\nIndex ${i} (Ref: ${ref.toString()}): ${obj.constructor.name}`);
        if (obj instanceof PDFRawStream) {
            try {
                const decoded = decodePDFRawStream(obj);
                const text = Buffer.from(decoded.getBytes()).toString('latin1');
                console.log(`  Length: ${text.length}`);
                console.log(`  Content snippet (first 150 chars):`);
                console.log(text.substring(0, 150).replace(/\n/g, ' '));
            } catch (err) {
                console.log(`  Decoding error: ${err.message}`);
            }
        }
    }
}

main().catch(console.error);
