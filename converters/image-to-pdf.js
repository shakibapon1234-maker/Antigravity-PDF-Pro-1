document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const btnUploadItp = document.getElementById('btnUploadImageToPdf');
    const itpFileInput = document.getElementById('itpFileInput');
    const itpEmptyState = document.getElementById('itpEmptyState');
    const itpWorkspace = document.getElementById('itpWorkspace');
    const itpPreview = document.getElementById('itpPreview');
    const btnConvertItp = document.getElementById('btnConvertImageToPdf');
    const itpFitRadios = document.getElementsByName('itpFit');

    let uploadedImages = []; // Store file objects

    // Initialize pdf-lib mapping
    const { PDFDocument } = PDFLib;

    if (btnUploadItp) {
        btnUploadItp.addEventListener('click', () => {
            itpFileInput.click();
        });
    }

    if (itpFileInput) {
        itpFileInput.addEventListener('change', handleImagesUpload);
    }

    if (btnConvertItp) {
        btnConvertItp.addEventListener('click', generatePDFFromImages);
    }

    function handleImagesUpload(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        uploadedImages = uploadedImages.concat(files);
        
        itpEmptyState.classList.add('d-none');
        itpWorkspace.classList.remove('d-none');
        
        renderImagePreviews();
        itpFileInput.value = "";
    }

    function renderImagePreviews() {
        itpPreview.innerHTML = '';
        
        uploadedImages.forEach((file, index) => {
            const reader = new FileReader();
            
            const previewItem = document.createElement('div');
            previewItem.style.cssText = 'background: #1e1e1e; padding: 10px; border-radius: 6px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); position: relative; display: flex; flex-direction: column; align-items: center;';
            
            const img = document.createElement('img');
            img.style.cssText = 'max-width: 100%; height: 120px; object-fit: contain; border-radius: 4px; background: #2a2a2a; margin-bottom: 8px;';
            
            const label = document.createElement('span');
            label.style.cssText = 'font-size: 0.8rem; color: #aaa; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; display: block;';
            label.textContent = file.name;
            
            const btnRemove = document.createElement('button');
            btnRemove.innerHTML = '&times;';
            btnRemove.title = "Remove image";
            btnRemove.style.cssText = 'position: absolute; top: -5px; right: -5px; background: #ff4d4d; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px;';
            btnRemove.onclick = () => {
                uploadedImages.splice(index, 1);
                if (uploadedImages.length === 0) {
                    itpEmptyState.classList.remove('d-none');
                    itpWorkspace.classList.add('d-none');
                } else {
                    renderImagePreviews();
                }
            };
            
            previewItem.appendChild(img);
            previewItem.appendChild(label);
            previewItem.appendChild(btnRemove);
            itpPreview.appendChild(previewItem);
            
            reader.onload = (e) => {
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    async function generatePDFFromImages() {
        if (uploadedImages.length === 0) return;

        let fitMode = 'original';
        for (const radio of itpFitRadios) {
            if (radio.checked) {
                fitMode = radio.value;
                break;
            }
        }

        const originalBtnHtml = btnConvertItp.innerHTML;
        
        if (!document.getElementById('spin-keyframes')) {
            const style = document.createElement('style');
            style.id = 'spin-keyframes';
            style.innerHTML = '@keyframes spin { 100% { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }
        
        btnConvertItp.innerHTML = '<i class="bi bi-arrow-repeat spin" style="display:inline-block; animation: spin 2s linear infinite;"></i> Creating PDF...';
        btnConvertItp.disabled = true;

        try {
            const pdfDoc = await PDFDocument.create();
            
            for (const file of uploadedImages) {
                const arrayBuffer = await file.arrayBuffer();
                let pdfImage;
                
                const name = file.name ? file.name.toLowerCase() : '';
                const isJpg = name.endsWith('.jpg') || name.endsWith('.jpeg');
                const isPng = name.endsWith('.png');
                const fileType = file.type || (isJpg ? 'image/jpeg' : isPng ? 'image/png' : null);
                
                if (file.type === 'image/jpeg' || file.type === 'image/jpg' || fileType === 'image/jpeg') {
                    pdfImage = await pdfDoc.embedJpg(arrayBuffer);
                } else if (file.type === 'image/png' || fileType === 'image/png') {
                    pdfImage = await pdfDoc.embedPng(arrayBuffer);
                } else {
                    console.warn("Unsupported image type:", file.type);
                    continue;
                }

                const imgWidth = pdfImage.width;
                const imgHeight = pdfImage.height;
                
                let page;
                if (fitMode === 'a4') {
                    const a4Width = 595.28;
                    const a4Height = 841.89;
                    page = pdfDoc.addPage([a4Width, a4Height]);
                    
                    const scale = Math.min(a4Width / imgWidth, a4Height / imgHeight);
                    const scaledWidth = imgWidth * scale;
                    const scaledHeight = imgHeight * scale;
                    
                    const x = (a4Width - scaledWidth) / 2;
                    const y = (a4Height - scaledHeight) / 2;
                    
                    page.drawImage(pdfImage, {
                        x: x,
                        y: y,
                        width: scaledWidth,
                        height: scaledHeight,
                    });
                } else {
                    page = pdfDoc.addPage([imgWidth, imgHeight]);
                    page.drawImage(pdfImage, {
                        x: 0,
                        y: 0,
                        width: imgWidth,
                        height: imgHeight,
                    });
                }
            }

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            
            const finalName = uploadedImages.length === 1 
                ? `${uploadedImages[0].name.replace(/\.[^/.]+$/, "")}_converted.pdf`
                : 'merged_images.pdf';
                
            window.saveAs(blob, finalName);
            
        } catch (error) {
            console.error("Error creating PDF:", error);
            alert("An error occurred while generating the PDF.");
        } finally {
            btnConvertItp.innerHTML = originalBtnHtml;
            btnConvertItp.disabled = false;
        }
    }

    window.loadImageToPdf = function(file) {
        if (file) {
            const fileList = Array.isArray(file) ? file : [file];
            const validFiles = fileList.filter(f => {
                const name = f.name ? f.name.toLowerCase() : '';
                return f.type && f.type.startsWith('image/') || name.match(/\.(png|jpg|jpeg|gif|bmp|webp)$/);
            });
            if (validFiles.length > 0) {
                uploadedImages = uploadedImages.concat(validFiles);
                itpEmptyState.classList.add('d-none');
                itpWorkspace.classList.remove('d-none');
                renderImagePreviews();
            }
        }
    };
});