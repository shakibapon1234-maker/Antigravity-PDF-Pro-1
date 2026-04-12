document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const btnUpload = document.getElementById('btnUploadImageConv');
    const fileInput = document.getElementById('icFileInput');
    const emptyState = document.getElementById('icEmptyState');
    const workspace = document.getElementById('icWorkspace');
    const preview = document.getElementById('icPreview');
    const btnConvert = document.getElementById('btnDownloadConverted');
    const formatRadios = document.getElementsByName('icFormat');

    let uploadedImages = []; // Store file objects

    if (btnUpload) {
        btnUpload.addEventListener('click', () => {
            fileInput.click();
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', handleUpload);
    }

    if (btnConvert) {
        btnConvert.addEventListener('click', convertAndDownload);
    }

    function handleUpload(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        uploadedImages = uploadedImages.concat(files);
        
        emptyState.classList.add('d-none');
        workspace.classList.remove('d-none');
        
        renderPreviews();
        fileInput.value = "";
    }

    function renderPreviews() {
        preview.innerHTML = '';
        
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
                    emptyState.classList.remove('d-none');
                    workspace.classList.add('d-none');
                } else {
                    renderPreviews();
                }
            };
            
            previewItem.appendChild(img);
            previewItem.appendChild(label);
            previewItem.appendChild(btnRemove);
            preview.appendChild(previewItem);
            
            reader.onload = (e) => {
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    async function convertAndDownload() {
        if (uploadedImages.length === 0) return;

        let targetType = 'image/png';
        let extension = 'png';
        for (const radio of formatRadios) {
            if (radio.checked) {
                targetType = radio.value;
                extension = targetType.split('/')[1];
                if(extension === 'jpeg') extension = 'jpg';
                break;
            }
        }

        const originalBtnHtml = btnConvert.innerHTML;
        
        if (!document.getElementById('spin-keyframes')) {
            const style = document.createElement('style');
            style.id = 'spin-keyframes';
            style.innerHTML = '@keyframes spin { 100% { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }
        
        btnConvert.innerHTML = '<i class="bi bi-arrow-repeat spin" style="display:inline-block; animation: spin 2s linear infinite;"></i> Converting...';
        btnConvert.disabled = true;

        try {
            const zip = new JSZip();

            for (const file of uploadedImages) {
                const baseName = file.name.replace(/\.[^/.]+$/, "");
                const newName = `${baseName}.${extension}`;
                
                const dataUrl = await convertImage(file, targetType);
                const base64Data = dataUrl.split(',')[1];
                
                zip.file(newName, base64Data, {base64: true});
            }

            const content = await zip.generateAsync({type: "blob"});
            
            const finalName = uploadedImages.length === 1 
                ? `${uploadedImages[0].name.replace(/\.[^/.]+$/, "")}_converted.zip`
                : 'converted_images.zip';
                
            window.saveAs(content, finalName);
            
        } catch (error) {
            console.error("Error converting images:", error);
            alert("An error occurred while converting the images.");
        } finally {
            btnConvert.innerHTML = originalBtnHtml;
            btnConvert.disabled = false;
        }
    }

    function convertImage(file, mimeType) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    
                    // If target is jpeg, draw a white background first to avoid black backgrounds on transparent PNGs
                    if (mimeType === 'image/jpeg') {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }
                    
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL(mimeType, 0.9)); // 0.9 quality for webp/jpeg
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
});
