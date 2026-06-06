// ═══════════════════════════════════════════════════════════════
//  Antigravity PDF Pro — Excel to PDF Converter (v4 Fixed)
//  ✔ Page border overlay (A4/Letter/Legal dashed rectangle)
//  ✔ Portrait/Landscape orientation border updates live
//  ✔ Selection content always goes on A4/Letter/Legal page
//  ✔ Mouse drag + manual range input area selection
//  ✔ Clear selection button
//  ✔ Gridlines toggle
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

    const fileInput         = document.getElementById('excelFileInput');
    const uploadBtn         = document.getElementById('btnUploadExcel');
    const convertBtn        = document.getElementById('btnConvertExcelToPdf');
    const workspace         = document.getElementById('excelWorkspace');
    const emptyState        = document.getElementById('excelEmptyState');
    const previewContainer  = document.getElementById('excelPreview');
    const orientationSelect = document.getElementById('excelOrientation');
    const pageSizeSelect    = document.getElementById('excelPageSize');
    const areaSelectInput   = document.getElementById('excelAreaSelect');
    const showGridlinesInput= document.getElementById('excelShowGridlines');

    if (!fileInput) return;

    let currentFile      = null;
    let currentWorksheet = null;
    let currentWorkbook  = null;
    let colsConfig       = [];
    let trueRange        = null;
    let selStart         = null;
    let selEnd           = null;
    let isDragging       = false;

    window.loadExcelToPdf = (file) => { if (file) handleExcelFile(file); };

    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) handleExcelFile(e.target.files[0]);
    });

    // ── Page sizes (mm) at 96dpi ─────────────────────────────────
    const PAGE_MM = { a4:{w:210,h:297}, letter:{w:215.9,h:279.4}, legal:{w:215.9,h:355.6} };
    const MARGIN  = 10; // mm each side
    const MM2PX   = 96 / 25.4;

    function getPrintablePx() {
        const sz = pageSizeSelect ? pageSizeSelect.value : 'a4';
        if (sz === 'fit') return null;
        const or = orientationSelect ? orientationSelect.value : 'portrait';
        const d  = PAGE_MM[sz] || PAGE_MM.a4;
        const pw = or === 'landscape' ? d.h : d.w;
        const ph = or === 'landscape' ? d.w : d.h;
        return { w:(pw - MARGIN*2)*MM2PX, h:(ph - MARGIN*2)*MM2PX };
    }

    function colLetter(n) {
        let s=''; while(n>=0){s=String.fromCharCode((n%26)+65)+s;n=Math.floor(n/26)-1;} return s;
    }

    function computeTrueRange(ws) {
        let maxR=0,maxC=0,minR=Infinity,minC=Infinity,hasData=false;
        for(const k in ws){
            if(k[0]==='!')continue; const c=ws[k];
            if(c.v===undefined&&c.w===undefined)continue;
            if(c.v===''&&c.w==='')continue; hasData=true;
            try{const a=XLSX.utils.decode_cell(k);
                if(a.r>maxR)maxR=a.r;if(a.c>maxC)maxC=a.c;
                if(a.r<minR)minR=a.r;if(a.c<minC)minC=a.c;}catch(_){}
        }
        return hasData?{s:{r:minR,c:minC},e:{r:maxR,c:maxC}}:{s:{r:0,c:0},e:{r:0,c:0}};
    }

    function cw(c){return Math.max(45,colsConfig[c]?(colsConfig[c].wpx||80):80);}

    function handleExcelFile(file) {
        // Handle files from archive that may not have correct type
        const isExcel = file.name && (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls') || file.name.toLowerCase().endsWith('.csv'));
        const fileType = file.type || (isExcel ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : null);
        if (!file || (file.type && !file.type.includes('sheet') && !file.type.includes('excel') && !file.type.includes('csv')) && !fileType) {
            alert('Please select a valid Excel file.');
            return;
        }
        currentFile=file;
        const reader=new FileReader();
        reader.onload=(e)=>{
            const data=new Uint8Array(e.target.result);
            currentWorkbook=XLSX.read(data,{type:'array'});
            const sn=currentWorkbook.SheetNames[0];
            currentWorksheet=currentWorkbook.Sheets[sn];
            trueRange=computeTrueRange(currentWorksheet);
            colsConfig=currentWorksheet['!cols']||[];
            selStart=null;selEnd=null;
            if(areaSelectInput)areaSelectInput.value='';
            renderTablePreview();
            emptyState.classList.add('d-none');
            workspace.classList.remove('d-none');
        };
        reader.readAsArrayBuffer(file);
    }

    // ── Render preview ───────────────────────────────────────────
    function renderTablePreview(){
        if(!currentWorksheet)return;
        const r=trueRange;

        let html=`
        <div id="pdfNotice" style="margin-bottom:5px;font-size:12px;min-height:18px;"></div>
        <div style="margin-bottom:8px;font-size:12px;color:#90caf9;background:rgba(0,120,215,0.1);
             padding:7px 12px;border-radius:6px;border-left:3px solid #0078d7;
             display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
          <span>📌 <strong>এরিয়া সিলেক্ট করুন:</strong>
            মাউস দিয়ে ড্র্যাগ করুন বা রেঞ্জ টাইপ করুন।
            সিলেক্ট করা অংশ A4 পেপারে প্রিন্ট হবে।</span>
          <button id="btnClearPdfSel" style="background:rgba(255,77,77,0.15);border:1px solid #ff4d4d;
            color:#ff7070;padding:3px 10px;border-radius:5px;cursor:pointer;font-size:12px;">
            ✕ সিলেকশন মুছুন</button>
        </div>
        <div style="position:relative;display:inline-block;">
          <div id="pdfBorder" style="position:absolute;pointer-events:none;z-index:10;
               border:2.5px dashed #ff5500;display:none;box-shadow:0 0 0 1px rgba(255,85,0,0.2);
               background:rgba(255,85,0,0.03);"></div>`;

        html+=`<table id="excel-table-preview"
            style="width:max-content;border-collapse:collapse;background:#fff!important;
                   color:#000!important;font-family:Calibri,Arial,sans-serif;
                   user-select:none;table-layout:fixed;">`;

        // col headers
        html+='<tr>';
        html+=`<th id="ep-corner" style="background:#e6e6e6;border:1px solid #b0b0b0;width:38px;min-width:38px;
                position:sticky;top:0;left:0;z-index:3;font-size:11px;color:#777;text-align:center;">✂</th>`;
        for(let C=r.s.c;C<=r.e.c;++C){
            const w=cw(C);
            html+=`<th data-ch="${C}" style="background:#e6e6e6;border:1px solid #b0b0b0;font-weight:400;
                   font-size:12px;text-align:center;min-width:${w}px;max-width:${w}px;overflow:hidden;
                   position:sticky;top:0;z-index:2;cursor:pointer;padding:2px 4px;">${colLetter(C)}</th>`;
        }
        html+='</tr>';

        // data rows
        for(let R=r.s.r;R<=r.e.r;++R){
            html+='<tr>';
            html+=`<th data-rh="${R}" style="background:#e6e6e6;border:1px solid #b0b0b0;font-weight:400;
                   font-size:12px;text-align:center;position:sticky;left:0;z-index:2;cursor:pointer;padding:2px 6px;">${R+1}</th>`;
            for(let C=r.s.c;C<=r.e.c;++C){
                const addr=XLSX.utils.encode_cell({c:C,r:R});
                const cell=currentWorksheet[addr];
                let txt=(cell&&cell.v!==undefined)?XLSX.utils.format_cell(cell):'';
                txt=txt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
                const w=cw(C);
                html+=`<td data-row="${R}" data-col="${C}" class="ep-cell"
                    style="border:1px solid #d0d0d0;padding:2px 5px;min-width:${w}px;max-width:${w}px;
                           font-size:13px;overflow:hidden;white-space:nowrap;cursor:crosshair;
                           vertical-align:bottom;background:#fff;">${txt}</td>`;
            }
            html+='</tr>';
        }
        html+=`</table></div>`;

        previewContainer.innerHTML=html;
        previewContainer.style.cssText='background:#d0d0d0;padding:0;overflow:auto;max-height:520px;';

        attachEvents();
        document.getElementById('btnClearPdfSel').addEventListener('click',()=>{
            selStart=null;selEnd=null;
            if(areaSelectInput)areaSelectInput.value='';
            paintSel();updateBorder();
        });
        updateBorder();
    }

    // ── Page border overlay ───────────────────────────────────────
    // Positioned relative to the table's data area (after corner + row-header)
    function updateBorder(){
        const overlay=document.getElementById('pdfBorder');
        const notice=document.getElementById('pdfNotice');
        if(!overlay)return;

        const printable=getPrintablePx();
        if(!printable||!currentWorksheet){
            overlay.style.display='none';
            if(notice)notice.innerHTML='';
            return;
        }

        // Measure the header row height and corner cell width for offset
        const cornerEl=document.getElementById('ep-corner');
        const firstRh=previewContainer.querySelector('th[data-rh]');
        const firstCh=previewContainer.querySelector('th[data-ch]');
        const cornerW=cornerEl?cornerEl.offsetWidth:38;
        const headerH=firstCh?firstCh.offsetHeight:25;

        // Total data area dimensions
        const table=previewContainer.querySelector('table');
        if(!table){overlay.style.display='none';return;}
        const dataW=table.scrollWidth - cornerW;
        const dataH=table.scrollHeight - headerH;

        const bW=Math.min(printable.w, dataW);
        const bH=Math.min(printable.h, dataH);

        overlay.style.display='block';
        overlay.style.left  =cornerW+'px';
        overlay.style.top   =headerH+'px';
        overlay.style.width =Math.round(bW)+'px';
        overlay.style.height=Math.round(bH)+'px';

        const overflows=dataW>printable.w||dataH>printable.h;
        if(notice){
            const szLabel=(pageSizeSelect?pageSizeSelect.value.toUpperCase():'A4');
            const orLabel=(orientationSelect?orientationSelect.value:'portrait');
            if(overflows){
                notice.innerHTML=`<span style="color:#ff7744;">⚠ বর্তমান পেজ (${szLabel} ${orLabel}) -এর বাইরে কনটেন্ট আছে। কম এরিয়া সিলেক্ট করুন বা Landscape ব্যবহার করুন।</span>`;
            } else {
                notice.innerHTML=`<span style="color:#66cc88;">✔ সব কনটেন্ট ${szLabel} (${orLabel}) পেজে ফিট হবে।</span>`;
            }
        }
    }

    if(pageSizeSelect)    pageSizeSelect.addEventListener('change',   ()=>{paintSel();updateBorder();});
    if(orientationSelect) orientationSelect.addEventListener('change',()=>{paintSel();updateBorder();});

    // ── Table interaction ────────────────────────────────────────
    function attachEvents(){
        const table=previewContainer.querySelector('table');
        if(!table)return;

        const cellOf=e=>{
            const td=e.target.closest('td.ep-cell');
            if(!td)return null;
            return{r:parseInt(td.dataset.row),c:parseInt(td.dataset.col)};
        };

        table.addEventListener('mousedown',e=>{
            const coord=cellOf(e); if(!coord)return;
            e.preventDefault();isDragging=true;selStart=coord;selEnd=coord;
            paintSel();
        });
        table.addEventListener('mousemove',e=>{
            if(!isDragging)return;
            const coord=cellOf(e);if(!coord)return;
            selEnd=coord;paintSel();
        });
        table.addEventListener('click',e=>{
            const th=e.target.closest('th[data-ch]');
            if(th){
                const C=parseInt(th.dataset.ch);
                selStart={r:trueRange.s.r,c:C};selEnd={r:trueRange.e.r,c:C};
                syncInput();paintSel();updateBorder();return;
            }
            const rh=e.target.closest('th[data-rh]');
            if(rh){
                const R=parseInt(rh.dataset.rh);
                selStart={r:R,c:trueRange.s.c};selEnd={r:R,c:trueRange.e.c};
                syncInput();paintSel();updateBorder();
            }
        });
        window.addEventListener('mouseup',()=>{
            if(isDragging){isDragging=false;syncInput();updateBorder();}
        });
        if(areaSelectInput){
            areaSelectInput.addEventListener('input',()=>{
                const v=areaSelectInput.value.trim().toUpperCase();
                if(!v){selStart=null;selEnd=null;paintSel();updateBorder();return;}
                try{
                    const p=XLSX.utils.decode_range(v);
                    selStart={r:p.s.r,c:p.s.c};selEnd={r:p.e.r,c:p.e.c};
                    paintSel();updateBorder();
                }catch(_){}
            });
        }
    }

    function syncInput(){
        if(!areaSelectInput||!selStart||!selEnd)return;
        const minR=Math.min(selStart.r,selEnd.r),maxR=Math.max(selStart.r,selEnd.r);
        const minC=Math.min(selStart.c,selEnd.c),maxC=Math.max(selStart.c,selEnd.c);
        areaSelectInput.value=XLSX.utils.encode_cell({c:minC,r:minR})+':'+XLSX.utils.encode_cell({c:maxC,r:maxR});
    }

    function paintSel(){
        const cells=previewContainer.querySelectorAll('td.ep-cell');
        cells.forEach(td=>{
            td.style.background='#fff';
            td.style.borderTop=td.style.borderBottom=td.style.borderLeft=td.style.borderRight='1px solid #d0d0d0';
        });
        previewContainer.querySelectorAll('th[data-ch]').forEach(th=>{
            th.style.background='#e6e6e6';th.style.color='#333';th.style.fontWeight='400';
        });
        previewContainer.querySelectorAll('th[data-rh]').forEach(th=>{
            th.style.background='#e6e6e6';th.style.color='#333';th.style.fontWeight='400';
        });
        if(!selStart||!selEnd)return;
        const minR=Math.min(selStart.r,selEnd.r),maxR=Math.max(selStart.r,selEnd.r);
        const minC=Math.min(selStart.c,selEnd.c),maxC=Math.max(selStart.c,selEnd.c);
        cells.forEach(td=>{
            const r=parseInt(td.dataset.row),c=parseInt(td.dataset.col);
            if(r<minR||r>maxR||c<minC||c>maxC)return;
            td.style.background='rgba(0,120,215,0.18)';
            td.style.borderTop   =(r===minR)?'2px solid #0078d7':'1px solid rgba(0,120,215,0.3)';
            td.style.borderBottom=(r===maxR)?'2px solid #0078d7':'1px solid rgba(0,120,215,0.3)';
            td.style.borderLeft  =(c===minC)?'2px solid #0078d7':'1px solid rgba(0,120,215,0.3)';
            td.style.borderRight =(c===maxC)?'2px solid #0078d7':'1px solid rgba(0,120,215,0.3)';
        });
        previewContainer.querySelectorAll('th[data-ch]').forEach(th=>{
            const C=parseInt(th.dataset.ch);
            if(C>=minC&&C<=maxC){th.style.background='#b8d9f5';th.style.color='#003c7a';th.style.fontWeight='600';}
        });
        previewContainer.querySelectorAll('th[data-rh]').forEach(th=>{
            const R=parseInt(th.dataset.rh);
            if(R>=minR&&R<=maxR){th.style.background='#b8d9f5';th.style.color='#003c7a';th.style.fontWeight='600';}
        });
    }

    // ── Convert & Download PDF ───────────────────────────────────
    convertBtn.addEventListener('click', async()=>{
        if(!currentWorksheet){alert('প্রথমে একটি Excel ফাইল আপলোড করুন।');return;}
        convertBtn.disabled=true;
        convertBtn.innerHTML='<i data-lucide="loader-2" class="spin"></i> Converting...';
        if(window.lucide)lucide.createIcons();

        try{
            // Determine export range
            let exportRange;
            const iv=areaSelectInput?areaSelectInput.value.trim().toUpperCase():'';
            if(iv){try{exportRange=XLSX.utils.decode_range(iv);}catch(_){exportRange=trueRange;}}
            else if(selStart&&selEnd){
                exportRange={
                    s:{r:Math.min(selStart.r,selEnd.r),c:Math.min(selStart.c,selEnd.c)},
                    e:{r:Math.max(selStart.r,selEnd.r),c:Math.max(selStart.c,selEnd.c)}
                };
            } else exportRange=trueRange;

            const showGridlines=showGridlinesInput?showGridlinesInput.checked:true;
            const borderStyle  =showGridlines?'1px solid #b0b0b0':'none';
            const orientation  =orientationSelect?orientationSelect.value:'portrait';
            const pageSize     =pageSizeSelect?pageSizeSelect.value:'a4';

            // Build table HTML — NO row/col headers, width:100% to fill the page
            let tbl=`<table style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;
                color:#000;font-size:11px;table-layout:auto;width:100%;word-break:break-word;">`;
            for(let R=exportRange.s.r;R<=exportRange.e.r;++R){
                tbl+='<tr>';
                for(let C=exportRange.s.c;C<=exportRange.e.c;++C){
                    const addr=XLSX.utils.encode_cell({c:C,r:R});
                    const cell=currentWorksheet[addr];
                    let txt=(cell&&cell.v!==undefined)?XLSX.utils.format_cell(cell):'';
                    txt=txt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
                    const align=(cell&&(cell.t==='n'||cell.t==='d'))?'right':'left';
                    tbl+=`<td style="border:${borderStyle};padding:3px 5px;text-align:${align};
                          vertical-align:bottom;overflow:hidden;">${txt}</td>`;
                }
                tbl+='</tr>';
            }
            tbl+='</table>';

            // Page format
            let pdfFormat;
            if(pageSize==='fit'){
                // Dynamic: page exactly matches content
                const px2mm=0.264583;
                let w=0;for(let C=exportRange.s.c;C<=exportRange.e.c;++C)w+=cw(C)+10;
                const h=(exportRange.e.r-exportRange.s.r+1)*22;
                pdfFormat=[Math.max(80,w*px2mm+20),Math.max(40,h*px2mm+20)];
            } else {
                pdfFormat=pageSize; // fixed: 'a4','letter','legal'
            }

            // Content wrapped in page-width div with margins
            const content=`<div style="background:#fff;width:100%;padding:10mm;box-sizing:border-box;">${tbl}</div>`;

            const opt={
                margin:      0,
                filename:    currentFile.name.replace(/\.[^/.]+$/,'')+'.pdf',
                image:       {type:'jpeg',quality:1.0},
                html2canvas: {scale:2,useCORS:true,logging:false,backgroundColor:'#ffffff'},
                jsPDF:       {unit:'mm',format:pdfFormat,orientation,compress:true}
            };

            await html2pdf().set(opt).from(content).save();

        }catch(err){
            console.error(err);
            alert('PDF তৈরিতে সমস্যা: '+err.message);
        }finally{
            convertBtn.disabled=false;
            convertBtn.innerHTML='<i data-lucide="file-check"></i> Convert & Download PDF';
            if(window.lucide)lucide.createIcons();
        }
    });

    // ── Dropzone ─────────────────────────────────────────────────
    if(emptyState){
        emptyState.style.cursor='pointer';
        emptyState.addEventListener('click',()=>fileInput.click());
        emptyState.addEventListener('dragover', e=>{e.preventDefault();emptyState.style.borderColor='var(--primary)';});
        emptyState.addEventListener('dragleave',()=>{emptyState.style.borderColor='';});
        emptyState.addEventListener('drop',e=>{
            e.preventDefault();emptyState.style.borderColor='';
            if(e.dataTransfer.files[0])handleExcelFile(e.dataTransfer.files[0]);
        });
    }

});
