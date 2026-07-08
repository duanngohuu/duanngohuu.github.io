(()=>{
  const {state}=BJT;
  const start=l=>Math.max(1,+(l?.pdf_page_start||l?.page_start||1));
  const end=l=>Math.max(start(l),+(l?.pdf_page_end||l?.page_end||start(l)));
  const maxPage=b=>Math.max(1,+(b?.pages||9999));
  const pageKey=id=>`bjtPdfPage:${id}`;
  const zoomKey=id=>`bjtPdfZoom:${id}`;
  const lastLessonKey=id=>`bjtPdfLastLesson:${id}`;
  const lastBookPageKey=id=>`bjtPdfLastPage:${id}`;
  let removeListeners=()=>{},picker,currentBook,currentLesson,currentPage=1,currentZoom=1;

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function clampPage(book,page){const n=Math.round(Number(page)||1);return Math.min(maxPage(book),Math.max(1,n));}
  function clampZoom(value){const n=Number(value)||1;return Math.min(2.5,Math.max(.6,Math.round(n*10)/10));}
  function storedPage(book,lesson){const own=Number(localStorage.getItem(pageKey(lesson.lesson_id)));return Number.isFinite(own)&&own>0?clampPage(book,own):start(lesson);}
  function storedZoom(lesson){const z=Number(localStorage.getItem(zoomKey(lesson.lesson_id)));return Number.isFinite(z)&&z>0?clampZoom(z):1;}
  function toast(text){if(window.BJT_UI?.toast)BJT_UI.toast(text);else alert(text);}

  function basePdfSrc(frame){
    if(frame.dataset.basePdfSrc)return frame.dataset.basePdfSrc;
    const src=String(frame.getAttribute('src')||frame.src||'').split('#')[0];
    frame.dataset.basePdfSrc=src;return src;
  }
  function ensureViewport(frame){
    let viewport=frame.closest('.pdf-zoom-viewport');
    if(viewport)return{viewport,stage:frame.parentElement};
    viewport=document.createElement('div');viewport.className='pdf-zoom-viewport';
    const stage=document.createElement('div');stage.className='pdf-zoom-stage';
    frame.parentNode.insertBefore(viewport,frame);viewport.appendChild(stage);stage.appendChild(frame);
    return{viewport,stage};
  }
  function emit(){
    window.dispatchEvent(new CustomEvent('bjt-pdf-state',{detail:{bookId:currentBook?.book_id,lessonId:currentLesson?.lesson_id,page:currentPage,zoom:currentZoom,max:currentBook?maxPage(currentBook):0}}));
  }
  function updateLabels(){
    const input=document.getElementById('pdfPageInput');if(input&&document.activeElement!==input)input.value=currentPage;
    const button=document.getElementById('pdfOpenPagePicker');if(button)button.textContent=`Trang ${currentPage}`;
    const zoom=document.getElementById('pdfZoomLabel');if(zoom)zoom.textContent=`${Math.round(currentZoom*100)}%`;
    const status=document.getElementById('pdfLoadStatus');if(status&&currentLesson)status.textContent=`Trang ${currentPage} · bài ${start(currentLesson)}–${end(currentLesson)}`;
    syncPicker();emit();
  }
  function setPdfPage(book,lesson,page,{force=false}={}){
    const frame=document.getElementById('pdfFrame');if(!frame)return;
    currentBook=book;currentLesson=lesson;currentPage=clampPage(book,page);
    localStorage.setItem(pageKey(lesson.lesson_id),String(currentPage));
    localStorage.setItem(lastBookPageKey(book.book_id),String(currentPage));
    localStorage.setItem(lastLessonKey(book.book_id),lesson.lesson_id);
    const next=`${basePdfSrc(frame)}#page=${currentPage}`;
    if(force||String(frame.getAttribute('src')||'')!==next)frame.setAttribute('src',next);
    updateLabels();
  }
  function setZoom(value){
    const frame=document.getElementById('pdfFrame'),lesson=currentLesson;if(!frame||!lesson)return;
    const {viewport,stage}=ensureViewport(frame),old=currentZoom,next=clampZoom(value);
    const centerX=(viewport.scrollLeft+viewport.clientWidth/2)/old;
    const centerY=(viewport.scrollTop+viewport.clientHeight/2)/old;
    currentZoom=next;localStorage.setItem(zoomKey(lesson.lesson_id),String(next));
    stage.style.transform=`scale(${next})`;
    stage.style.width=`${100/next}%`;
    stage.style.minHeight=`${100/next}%`;
    requestAnimationFrame(()=>{viewport.scrollLeft=Math.max(0,centerX*next-viewport.clientWidth/2);viewport.scrollTop=Math.max(0,centerY*next-viewport.clientHeight/2);});
    updateLabels();
  }

  function ensurePicker(){
    if(picker&&document.body.contains(picker))return picker;
    picker=document.createElement('div');picker.id='pdfPagePicker';picker.className='pdf-picker-overlay';picker.hidden=true;
    picker.innerHTML=`<section class="pdf-picker-sheet" role="dialog" aria-modal="true" aria-label="Điều khiển PDF"><header><div><strong>Điều khiển PDF</strong><small id="pdfPickerMeta"></small></div><button id="pdfPickerClose" type="button">×</button></header><div class="pdf-picker-main"><div class="pdf-jump-box"><label>Nhảy tới trang<input id="pdfPickerInput" type="number" min="1" inputmode="numeric"></label><button id="pdfPickerGo" type="button">Đi</button></div><input id="pdfPageRange" class="pdf-page-range" type="range" min="1" step="1"><div class="pdf-picker-actions"><button id="pdfStartPage" type="button">Đầu bài</button><button id="pdfEndPage" type="button">Cuối bài</button><button id="pdfZoomOutSheet" type="button">− Zoom</button><button id="pdfZoomResetSheet" type="button">100%</button><button id="pdfZoomInSheet" type="button">+ Zoom</button><button id="pdfFullscreenSheet" type="button">Toàn màn hình</button><button id="pdfCaptureSheet" type="button">Chụp màn hình</button></div><section><h3>Trang gần đây / mốc nhanh</h3><div id="pdfPageChips" class="pdf-page-chips"></div></section></div></section>`;
    document.body.appendChild(picker);
    picker.onclick=e=>{if(e.target===picker)closePicker();};
    picker.querySelector('#pdfPickerClose').onclick=closePicker;
    picker.querySelector('#pdfPickerGo').onclick=()=>{setPdfPage(currentBook,currentLesson,picker.querySelector('#pdfPickerInput').value,{force:true});closePicker();};
    picker.querySelector('#pdfPickerInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();picker.querySelector('#pdfPickerGo').click();}};
    picker.querySelector('#pdfPageRange').oninput=e=>picker.querySelector('#pdfPickerInput').value=e.target.value;
    picker.querySelector('#pdfPageRange').onchange=e=>setPdfPage(currentBook,currentLesson,e.target.value,{force:true});
    picker.querySelector('#pdfStartPage').onclick=()=>setPdfPage(currentBook,currentLesson,start(currentLesson),{force:true});
    picker.querySelector('#pdfEndPage').onclick=()=>setPdfPage(currentBook,currentLesson,end(currentLesson),{force:true});
    picker.querySelector('#pdfZoomOutSheet').onclick=()=>setZoom(currentZoom-.2);
    picker.querySelector('#pdfZoomResetSheet').onclick=()=>setZoom(1);
    picker.querySelector('#pdfZoomInSheet').onclick=()=>setZoom(currentZoom+.2);
    picker.querySelector('#pdfFullscreenSheet').onclick=toggleFullscreen;
    picker.querySelector('#pdfCaptureSheet').onclick=captureScreen;
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!picker.hidden)closePicker();});
    return picker;
  }
  function quickPages(){
    if(!currentBook||!currentLesson)return[];
    const max=maxPage(currentBook),values=new Set([1,start(currentLesson),end(currentLesson),currentPage-10,currentPage-5,currentPage-1,currentPage,currentPage+1,currentPage+5,currentPage+10,max]);
    for(let p=10;p<max;p+=10)values.add(p);
    return [...values].map(p=>clampPage(currentBook,p)).sort((a,b)=>a-b);
  }
  function syncPicker(){
    if(!picker||picker.hidden||!currentBook||!currentLesson)return;
    picker.querySelector('#pdfPickerMeta').textContent=`Trang ${currentPage}/${maxPage(currentBook)} · zoom ${Math.round(currentZoom*100)}%`;
    const input=picker.querySelector('#pdfPickerInput');if(document.activeElement!==input)input.value=currentPage;input.max=maxPage(currentBook);
    const range=picker.querySelector('#pdfPageRange');range.max=maxPage(currentBook);range.value=currentPage;
    const chips=picker.querySelector('#pdfPageChips');chips.innerHTML=quickPages().map(p=>`<button type="button" data-page="${p}" class="${p===currentPage?'active':''}">${p}</button>`).join('');
    chips.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{setPdfPage(currentBook,currentLesson,b.dataset.page,{force:true});closePicker();});
  }
  function openPicker(){const p=ensurePicker();p.hidden=false;document.body.classList.add('picker-open');syncPicker();setTimeout(()=>p.querySelector('#pdfPickerInput').select(),60);}
  function closePicker(){if(!picker)return;picker.hidden=true;document.body.classList.remove('picker-open');}

  async function toggleFullscreen(){
    const pane=document.getElementById('pdfPane');if(!pane)return;
    try{
      if(document.fullscreenElement){await document.exitFullscreen();return;}
      if(pane.requestFullscreen){await pane.requestFullscreen();return;}
    }catch{}
    pane.classList.toggle('pdf-focus-mode');document.body.classList.toggle('pdf-focus-open',pane.classList.contains('pdf-focus-mode'));
    const button=document.getElementById('pdfFullscreen');if(button)button.textContent=pane.classList.contains('pdf-focus-mode')?'Thu nhỏ':'⛶';
  }

  async function captureScreen(){
    closePicker();
    if(!navigator.mediaDevices?.getDisplayMedia){
      alert('Trình duyệt này không cho website tự chụp màn hình. Trên iPhone: bấm đồng thời nút nguồn + tăng âm lượng. Trên máy tính, mở bằng Chrome/Safari mới để dùng nút Chụp.');
      return;
    }
    let stream;
    try{
      stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:1},audio:false});
      const video=document.createElement('video');video.srcObject=stream;video.muted=true;video.playsInline=true;await video.play();
      await new Promise(r=>setTimeout(r,180));
      const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
      canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
      const blob=await new Promise(r=>canvas.toBlob(r,'image/png',1));
      const file=new File([blob],`BJT-${currentLesson?.lesson_id||'PDF'}-page-${currentPage}.png`,{type:'image/png'});
      if(navigator.share&&navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:`BJT trang ${currentPage}`});
      else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
      toast('Đã chụp màn hình');
    }catch(e){if(e?.name!=='NotAllowedError')toast('Không chụp được màn hình');}
    finally{stream?.getTracks().forEach(t=>t.stop());}
  }

  function enhancePdfState(){
    removeListeners();
    const frame=document.getElementById('pdfFrame'),pane=document.getElementById('pdfPane'),head=pane?.querySelector('.study-pane-head');
    const book=state.books.find(x=>x.book_id===state.bookId),lesson=state.lessons.find(x=>x.lesson_id===state.lessonId);
    if(!frame||!head||!book||!lesson)return;
    currentBook=book;currentLesson=lesson;
    const previousLesson=localStorage.getItem(lastLessonKey(book.book_id)),lessonChanged=previousLesson!==lesson.lesson_id;
    currentPage=lessonChanged?start(lesson):storedPage(book,lesson);currentZoom=storedZoom(lesson);
    if(lessonChanged){localStorage.setItem(pageKey(lesson.lesson_id),String(currentPage));localStorage.setItem(lastLessonKey(book.book_id),lesson.lesson_id);}
    ensureViewport(frame);
    if(!document.getElementById('pdfPageTools')){
      const tools=document.createElement('div');tools.id='pdfPageTools';tools.className='pdf-page-tools';
      tools.innerHTML=`<button id="pdfPrevPage" class="mini-btn" type="button" aria-label="Trang trước">‹</button><button id="pdfOpenPagePicker" class="pdf-page-button" type="button">Trang ${currentPage}</button><button id="pdfNextPage" class="mini-btn" type="button" aria-label="Trang sau">›</button><button id="pdfZoomOut" class="mini-btn" type="button" aria-label="Thu nhỏ">−</button><button id="pdfZoomLabel" class="pdf-zoom-label" type="button">${Math.round(currentZoom*100)}%</button><button id="pdfZoomIn" class="mini-btn" type="button" aria-label="Phóng to">＋</button><button id="pdfFullscreen" class="mini-btn" type="button" aria-label="Toàn màn hình">⛶</button><button id="pdfCapture" class="mini-btn" type="button">Chụp</button>`;
      head.appendChild(tools);
    }
    document.getElementById('pdfPrevPage').onclick=()=>setPdfPage(book,lesson,currentPage-1,{force:true});
    document.getElementById('pdfNextPage').onclick=()=>setPdfPage(book,lesson,currentPage+1,{force:true});
    document.getElementById('pdfOpenPagePicker').onclick=openPicker;
    document.getElementById('pdfZoomOut').onclick=()=>setZoom(currentZoom-.2);
    document.getElementById('pdfZoomIn').onclick=()=>setZoom(currentZoom+.2);
    document.getElementById('pdfZoomLabel').onclick=()=>setZoom(1);
    document.getElementById('pdfFullscreen').onclick=toggleFullscreen;
    document.getElementById('pdfCapture').onclick=captureScreen;
    frame.addEventListener('load',updateLabels);
    const onPageShow=updateLabels;window.addEventListener('pageshow',onPageShow);
    removeListeners=()=>window.removeEventListener('pageshow',onPageShow);
    setPdfPage(book,lesson,currentPage,{force:lessonChanged||!String(frame.getAttribute('src')||'').includes('#page=')});setZoom(currentZoom);
  }

  const baseRender=BJT_UI.render;
  BJT_UI.render=function(){baseRender();requestAnimationFrame(enhancePdfState);};
  window.addEventListener('load',()=>requestAnimationFrame(enhancePdfState),{once:true});
  window.BJT_PDF={openPicker,closePicker,setPage:p=>currentBook&&currentLesson&&setPdfPage(currentBook,currentLesson,p,{force:true}),setZoom,toggleFullscreen,captureScreen,getPage:()=>currentPage,getZoom:()=>currentZoom};
})();