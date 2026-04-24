// ═══════════════════════════════════════════════════════════════
//  Antigravity PDF Pro — Excel to Word Converter (v4 Fixed)
//  ✔ Page border overlay (A4/Letter/Legal dashed rectangle)
//  ✔ Portrait/Landscape orientation border updates live
//  ✔ Selection content placed on proper A4/Letter page
//  ✔ Mouse drag + manual range input area selection
//  ✔ Clear selection button
//  ✔ Gridlines toggle
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

    const fileInput         = document.getElementById('e2wFileInput');
    const uploadBtn         = document.getElementById('btnUploadExcelToWord');
    const convertBtn        = document.getElementById('btnConvertExcelToWord');
    const workspace         = document.getElementById('e2wWorkspace');
    const emptyState        = document.getElementById('e2wEmptyState');
    const previewContainer  = document.getElementById('e2wPreview');
    const orientationSelect = document.getElementById('e2wOrientation');
    const pageSizeSelect    = document.getElementById('e2wPageSize');
    const areaSelectInput   = document.getElementById('e2wAreaSelect');
    const showGridlinesInput= document.getElementById('e2wShowGridlines');

    if(!fileInput)return;

    let currentFile      = null;
    let currentWorksheet = null;
    let currentWorkbook  = null;
    let colsConfig       = [];
    let trueRange        = null;
    let selStart         = null;
    let selEnd           = null;
    let isDragging       = false;

    uploadBtn.addEventListener('click',()=>fileInput.click());
    fileInput.addEventListener('change',e=>{if(e.target.files[0])handleExcelFile(e.target.files[0]);});

    // ── Page sizes (mm) ──────────────────────────────────────────
    const PAGE_MM={a4:{w:210,h:297},letter:{w:215.9,h:279.4},legal:{w:215.9,h:355.6}};
    const MARGIN=10;
    const MM2PX=96/25.4;

    function getPrintablePx(){
        const sz=pageSizeSelect?pageSizeSelect.value:'a4';
        if(sz==='fit')return null;
        const or=orientationSelect?orientationSelect.value:'portrait';
        const d=PAGE_MM[sz]||PAGE_MM.a4;
        const pw=or==='landscape'?d.h:d.w;
        const ph=or==='landscape'?d.w:d.h;
        return{w:(pw-MARGIN*2)*MM2PX, h:(ph-MARGIN*2)*MM2PX};
    }

    function colLetter(n){
        let s='';while(n>=0){s=String.fromCharCode((n%26)+65)+s;n=Math.floor(n/26)-1;}return s;
    }

    function computeTrueRange(ws){
        let maxR=0,maxC=0,minR=Infinity,minC=Infinity,hasData=false;
        for(const k in ws){
            if(k[0]==='!')continue;const c=ws[k];
            if(c.v===undefined&&c.w===undefined)continue;
            if(c.v===''&&c.w==='')continue;hasData=true;
            try{const a=XLSX.utils.decode_cell(k);
                if(a.r>maxR)maxR=a.r;if(a.c>maxC)maxC=a.c;
                if(a.r<minR)minR=a.r;if(a.c<minC)minC=a.c;}catch(_){}
        }
        return hasData?{s:{r:minR,c:minC},e:{r:maxR,c:maxC}}:{s:{r:0,c:0},e:{r:0,c:0}};
    }

    // Content-aware column width: analyze actual cell text lengths
    let contentWidths = {};
    function computeContentWidths() {
        if (!currentWorksheet || !trueRange) return;
        contentWidths = {};
        for (let C = trueRange.s.c; C <= trueRange.e.c; C++) {
            let maxLen = 3; // minimum
            for (let R = trueRange.s.r; R <= trueRange.e.r; R++) {
                const addr = XLSX.utils.encode_cell({c: C, r: R});
                const cell = currentWorksheet[addr];
                if (cell && cell.v !== undefined) {
                    const txt = XLSX.utils.format_cell(cell);
                    maxLen = Math.max(maxLen, txt.length);
                }
            }
            // Width in px: ~7px per char, min 40, max 300
            contentWidths[C] = Math.max(40, Math.min(300, maxLen * 7 + 10));
        }
    }
    function cw(c) {
        // Priority: Excel config > content-based > default
        if (colsConfig[c] && colsConfig[c].wpx && colsConfig[c].wpx > 20) return colsConfig[c].wpx;
        if (contentWidths[c]) return contentWidths[c];
        return 80;
    }

    function handleExcelFile(file){
        currentFile=file;
        const reader=new FileReader();
        reader.onload=e=>{
            const data=new Uint8Array(e.target.result);
            currentWorkbook=XLSX.read(data,{type:'array'});
            const sn=currentWorkbook.SheetNames[0];
            currentWorksheet=currentWorkbook.Sheets[sn];
            trueRange=computeTrueRange(currentWorksheet);
            colsConfig=currentWorksheet['!cols']||[];
            computeContentWidths();
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
        <div id="e2wNotice" style="margin-bottom:5px;font-size:12px;min-height:18px;"></div>
        <div style="margin-bottom:8px;font-size:12px;color:#90caf9;background:rgba(0,120,215,0.1);
             padding:7px 12px;border-radius:6px;border-left:3px solid #0078d7;
             display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
          <span>📌 <strong>এরিয়া সিলেক্ট করুন:</strong>
            মাউস দিয়ে ড্র্যাগ করুন বা রেঞ্জ টাইপ করুন।
            সিলেক্ট করা অংশ A4 পেপারে Word ডকুমেন্ট হবে।</span>
          <button id="btnClearE2wSel" style="background:rgba(255,77,77,0.15);border:1px solid #ff4d4d;
            color:#ff7070;padding:3px 10px;border-radius:5px;cursor:pointer;font-size:12px;">
            ✕ সিলেকশন মুছুন</button>
        </div>
        <div style="position:relative;display:inline-block;">
          <div id="e2wBorder" style="position:absolute;pointer-events:none;z-index:10;
               border:2.5px dashed #ff5500;display:none;box-shadow:0 0 0 1px rgba(255,85,0,0.2);
               background:rgba(255,85,0,0.03);"></div>`;

        html+=`<table id="e2w-table-preview"
            style="width:max-content;border-collapse:collapse;background:#fff!important;
                   color:#000!important;font-family:Calibri,Arial,sans-serif;
                   user-select:none;table-layout:fixed;">`;

        html+='<tr>';
        html+=`<th id="e2w-corner" style="background:#e6e6e6;border:1px solid #b0b0b0;width:38px;min-width:38px;
                position:sticky;top:0;left:0;z-index:3;font-size:11px;color:#777;text-align:center;">✂</th>`;
        for(let C=r.s.c;C<=r.e.c;++C){
            const w=cw(C);
            html+=`<th data-ch="${C}" style="background:#e6e6e6;border:1px solid #b0b0b0;font-weight:400;
                   font-size:12px;text-align:center;min-width:${w}px;max-width:${w}px;overflow:hidden;
                   position:sticky;top:0;z-index:2;cursor:pointer;padding:2px 4px;">${colLetter(C)}</th>`;
        }
        html+='</tr>';

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
                html+=`<td data-row="${R}" data-col="${C}" class="e2w-cell"
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
        document.getElementById('btnClearE2wSel').addEventListener('click',()=>{
            selStart=null;selEnd=null;
            if(areaSelectInput)areaSelectInput.value='';
            paintSel();updateBorder();
        });
        updateBorder();
    }

    // ── Page border overlay ───────────────────────────────────────
    function updateBorder(){
        const overlay=document.getElementById('e2wBorder');
        const notice=document.getElementById('e2wNotice');
        if(!overlay)return;

        const printable=getPrintablePx();
        if(!printable||!currentWorksheet){
            overlay.style.display='none';
            if(notice)notice.innerHTML='';
            return;
        }

        const cornerEl=document.getElementById('e2w-corner');
        const firstCh=previewContainer.querySelector('th[data-ch]');
        const cornerW=cornerEl?cornerEl.offsetWidth:38;
        const headerH=firstCh?firstCh.offsetHeight:25;

        const table=previewContainer.querySelector('table');
        if(!table){overlay.style.display='none';return;}
        const dataW=table.scrollWidth-cornerW;
        const dataH=table.scrollHeight-headerH;

        const bW=Math.min(printable.w,dataW);
        const bH=Math.min(printable.h,dataH);

        overlay.style.display='block';
        overlay.style.left  =cornerW+'px';
        overlay.style.top   =headerH+'px';
        overlay.style.width =Math.round(bW)+'px';
        overlay.style.height=Math.round(bH)+'px';

        const overflows=dataW>printable.w||dataH>printable.h;
        if(notice){
            const szLabel=pageSizeSelect?pageSizeSelect.value.toUpperCase():'A4';
            const orLabel=orientationSelect?orientationSelect.value:'portrait';
            if(overflows){
                notice.innerHTML=`<span style="color:#ff7744;">⚠ বর্তমান পেজ (${szLabel} ${orLabel}) -এর বাইরে কনটেন্ট আছে। কম এরিয়া সিলেক্ট করুন বা Landscape ব্যবহার করুন।</span>`;
            }else{
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
            const td=e.target.closest('td.e2w-cell');
            if(!td)return null;
            return{r:parseInt(td.dataset.row),c:parseInt(td.dataset.col)};
        };

        table.addEventListener('mousedown',e=>{
            const coord=cellOf(e);if(!coord)return;
            e.preventDefault();isDragging=true;selStart=coord;selEnd=coord;paintSel();
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
        const cells=previewContainer.querySelectorAll('td.e2w-cell');
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

    // ── Convert & Download Word ───────────────────────────────────
    convertBtn.addEventListener('click', async()=>{
        if(!currentWorksheet){alert('প্রথমে একটি Excel ফাইল আপলোড করুন।');return;}
        const origBtn=convertBtn.innerHTML;
        convertBtn.disabled=true;
        convertBtn.innerHTML='<i data-lucide="loader-2" class="spin"></i> Converting...';
        if(window.lucide)lucide.createIcons();

        try{
            const showGridlines=showGridlinesInput?showGridlinesInput.checked:true;
            let isLandscape  =orientationSelect&&orientationSelect.value==='landscape';
            const pageSz       =pageSizeSelect?pageSizeSelect.value:'a4';

            // Page dimensions in twips
            let outW,outH;
            if     (pageSz==='letter'){outW=12240;outH=15840;}
            else if(pageSz==='legal') {outW=12240;outH=20160;}
            else                      {outW=11906;outH=16838;}

            if(isLandscape&&pageSz!=='fit')[outW,outH]=[outH,outW];

            // Dynamic margins
            const numColsTotal = trueRange.e.c - trueRange.s.c + 1;
            let marginTwips = numColsTotal > 10 ? 360 : numColsTotal > 6 ? 540 : 720;
            let availTwips=outW-marginTwips*2;

            // Determine export range
            let exportRange;
            const iv=areaSelectInput?areaSelectInput.value.trim().toUpperCase():'';
            if(iv){
                try{exportRange=XLSX.utils.decode_range(iv);}catch(_){exportRange=trueRange;}
            } else if(selStart&&selEnd){
                exportRange={
                    s:{r:Math.min(selStart.r,selEnd.r),c:Math.min(selStart.c,selEnd.c)},
                    e:{r:Math.max(selStart.r,selEnd.r),c:Math.max(selStart.c,selEnd.c)}
                };
            } else {
                // === AUTO-CLIP: only export columns that fit within the page border ===
                if(pageSz !== 'fit') {
                    let cumWidth = 0;
                    let maxCol = trueRange.s.c;
                    for(let C = trueRange.s.c; C <= trueRange.e.c; C++) {
                        cumWidth += cw(C) * 15; // twips
                        if(cumWidth > availTwips) break;
                        maxCol = C;
                    }
                    exportRange = {
                        s: { r: trueRange.s.r, c: trueRange.s.c },
                        e: { r: trueRange.e.r, c: maxCol }
                    };
                } else {
                    exportRange = trueRange;
                }
            }

            // Word col limit
            if(exportRange.e.c-exportRange.s.c+1>63){
                alert('Word-এ সর্বোচ্চ ৬৩টি কলাম। বাকিগুলো বাদ দেওয়া হচ্ছে।');
                exportRange.e.c=exportRange.s.c+62;
            }

            const numCols = exportRange.e.c - exportRange.s.c + 1;
            marginTwips = numCols > 10 ? 360 : numCols > 6 ? 540 : 720;
            availTwips = outW - marginTwips*2;

            // Column widths in twips
            let rawTwips=0;
            for(let C=exportRange.s.c;C<=exportRange.e.c;++C)rawTwips+=cw(C)*15;

            let scale=1.0;

            if(pageSz==='fit'){
                outW=Math.max(outW,rawTwips+marginTwips*2);
                availTwips=rawTwips;
            } else if(rawTwips>availTwips){
                scale=availTwips/rawTwips;
            }

            // Minimum readable font: 7pt = 14 half-points (was 3pt which is unreadable)
            const fontSize  =Math.max(14, Math.round(24*scale));
            const padTB     =Math.max(20, Math.floor(60*scale));
            const padLR     =Math.max(30, Math.floor(80*scale));

            // Build table rows — NO row/col headers
            const tRows=[];
            for(let R=exportRange.s.r;R<=exportRange.e.r;++R){
                const tCells=[];
                for(let C=exportRange.s.c;C<=exportRange.e.c;++C){
                    const addr=XLSX.utils.encode_cell({c:C,r:R});
                    const cell=currentWorksheet[addr];
                    let txt=(cell&&cell.v!==undefined)?XLSX.utils.format_cell(cell):'';
                    if(!txt)txt=' ';

                    const cellTwips=Math.round(cw(C)*15*scale);

                    const bd=showGridlines
                        ?{style:docx.BorderStyle.SINGLE,size:1,color:'000000'}
                        :{style:docx.BorderStyle.NONE,  size:0,color:'auto'  };

                    tCells.push(new docx.TableCell({
                        width:   {size:cellTwips,type:docx.WidthType.DXA},
                        margins: {top:padTB,bottom:padTB,left:padLR,right:padLR},
                        borders: {top:bd,bottom:bd,left:bd,right:bd},
                        children:[new docx.Paragraph({
                            children:[new docx.TextRun({text:txt,size:fontSize})],
                            spacing:{before:0,after:0,line:240,lineRule:docx.LineRuleType.AUTO}
                        })]
                    }));
                }
                tRows.push(new docx.TableRow({children:tCells}));
            }

            const tblBd=showGridlines
                ?{style:docx.BorderStyle.SINGLE,size:1,color:'000000'}
                :{style:docx.BorderStyle.NONE};

            const docTable=new docx.Table({
                rows:   tRows,
                width:  {size:Math.round(availTwips),type:docx.WidthType.DXA},
                layout: docx.TableLayoutType.FIXED,
                borders:{top:tblBd,bottom:tblBd,left:tblBd,right:tblBd,
                         insideHorizontal:tblBd,insideVertical:tblBd}
            });

            const doc=new docx.Document({
                sections:[{
                    properties:{
                        page:{
                            size:{width:outW,height:outH,
                                  orientation:isLandscape?docx.PageOrientation.LANDSCAPE:docx.PageOrientation.PORTRAIT},
                            margin:{top:marginTwips,bottom:marginTwips,left:marginTwips,right:marginTwips}
                        }
                    },
                    children:[docTable]
                }]
            });

            const blob=await docx.Packer.toBlob(doc);
            saveAs(blob,currentFile.name.replace(/\.[^/.]+$/,'')+'_Word.docx');

        }catch(err){
            console.error(err);
            alert('Word তৈরিতে সমস্যা: '+err.message);
        }finally{
            convertBtn.disabled=false;
            convertBtn.innerHTML=origBtn;
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
