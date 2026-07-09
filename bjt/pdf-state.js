(()=>{
  const {state}=BJT;
  const zoomKey=id=>`bjtPdfZoom:${id}`;
  let removeListeners=()=>{},currentLesson=null,currentZoom=1;

  function clampZoom(value){const n=Number(value)||1;return Math.min(2.5,Math.max(.6,Math.round(n*10)/10));}
  function storedZoom(lesson){const z=Number(localStorage.getItem(zoomKey(lesson.lesson_id)));return Number.isFinite(z)&&z>0?clampZoom(z):1;}
  function toast(text){if(window.BJT_UI?.toast)BJT_UI.toast(text);else alert(text);}
  function ensureViewport(frame){
    let viewport=frame.closest('.pdf-zoom-viewport');if(viewport)return{viewport,stage:frame.parentElement};
    viewport=document.createElement('div');viewport.className='pdf-zoom-viewport';
    const stage=document.createElement('div');stage.className='pdf-zoom-stage';
    frame.parentNode.insertBefore(viewport,frame);viewport.appendChild(stage);stage.appendChild(frame);return{viewport,stage};
  }
  function updateLabels(){
    const zoom=document.getElementById('pdfZoomLabel');if(zoom)zoom.textContent=`${Math.round(currentZoom*100)}%`;
    const status=document.getElementById('pdfLoadStatus');if(status)status.textContent='Google Drive Preview · dùng tài khoản Google đang đăng nhập · Drive tự quản lý vị trí đang đọc';
  }
  function setZoom(value){
    const frame=document.getElementById('pdfFrame');if(!frame||!currentLesson)return;
    const {viewport,stage}=ensureViewport(frame),old=currentZoom,next=clampZoom(value);
    const centerX=(viewport.scrollLeft+viewport.clientWidth/2)/old,centerY=(viewport.scrollTop+viewport.clientHeight/2)/old;
    currentZoom=next;localStorage.setItem(zoomKey(currentLesson.lesson_id),String(next));
    stage.style.transform=`scale(${next})`;stage.style.width='100%';stage.style.minHeight='100%';
    requestAnimationFrame(()=>{viewport.scrollLeft=Math.max(0,centerX*next-viewport.clientWidth/2);viewport.scrollTop=Math.max(0,centerY*next-viewport.clientHeight/2);});updateLabels();
  }
  async function toggleFullscreen(){
    const pane=document.getElementById('pdfPane');if(!pane)return;
    try{if(document.fullscreenElement){await document.exitFullscreen();return;}if(pane.requestFullscreen){await pane.requestFullscreen();return;}}catch{}
    pane.classList.toggle('pdf-focus-mode');document.body.classList.toggle('pdf-focus-open',pane.classList.contains('pdf-focus-mode'));
    const button=document.getElementById('pdfFullscreen');if(button)button.textContent=pane.classList.contains('pdf-focus-mode')?'Thu nhỏ':'⛶';
  }
  async function captureScreen(){
    if(!navigator.mediaDevices?.getDisplayMedia){alert('Trên iPhone, dùng nút nguồn + tăng âm lượng để chụp màn hình.');return;}
    let stream;
    try{
      stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:1},audio:false});
      const video=document.createElement('video');video.srcObject=stream;video.muted=true;video.playsInline=true;await video.play();await new Promise(r=>setTimeout(r,180));
      const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
      const blob=await new Promise(r=>canvas.toBlob(r,'image/png',1));const file=new File([blob],`BJT-${currentLesson?.lesson_id||'PDF'}.png`,{type:'image/png'});
      if(navigator.share&&navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'BJT PDF'});else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}toast('Đã chụp màn hình');
    }catch(e){if(e?.name!=='NotAllowedError')toast('Không chụp được màn hình');}finally{stream?.getTracks().forEach(t=>t.stop());}
  }

  function enhancePdfState(){
    removeListeners();
    const frame=document.getElementById('pdfFrame'),pane=document.getElementById('pdfPane'),head=pane?.querySelector('.study-pane-head');
    const lesson=state.lessons.find(x=>x.lesson_id===state.lessonId);
    if(!frame||!head||!lesson)return;
    currentLesson=lesson;currentZoom=storedZoom(lesson);ensureViewport(frame);
    if(!document.getElementById('pdfPageTools')){
      const tools=document.createElement('div');tools.id='pdfPageTools';tools.className='pdf-page-tools';
      tools.innerHTML=`<button id="pdfReload" class="mini-btn" type="button">↻</button><button id="pdfZoomOut" class="mini-btn" type="button">−</button><button id="pdfZoomLabel" class="pdf-zoom-label" type="button">${Math.round(currentZoom*100)}%</button><button id="pdfZoomIn" class="mini-btn" type="button">＋</button><button id="pdfFullscreen" class="mini-btn" type="button">⛶</button><button id="pdfCapture" class="mini-btn" type="button">Chụp</button>`;
      head.appendChild(tools);
    }
    document.getElementById('pdfReload').onclick=()=>window.BJT_NATIVE_PDF?.reload?.();
    document.getElementById('pdfZoomOut').onclick=()=>setZoom(currentZoom-.2);document.getElementById('pdfZoomIn').onclick=()=>setZoom(currentZoom+.2);document.getElementById('pdfZoomLabel').onclick=()=>setZoom(1);document.getElementById('pdfFullscreen').onclick=toggleFullscreen;document.getElementById('pdfCapture').onclick=captureScreen;
    const reload=document.getElementById('reloadPdf');if(reload)reload.onclick=()=>window.BJT_NATIVE_PDF?.reload?.();
    frame.addEventListener('load',updateLabels);const onPageShow=updateLabels;window.addEventListener('pageshow',onPageShow);removeListeners=()=>window.removeEventListener('pageshow',onPageShow);
    window.BJT_NATIVE_PDF?.restore?.();setZoom(currentZoom);updateLabels();
  }

  const baseRender=BJT_UI.render;BJT_UI.render=function(){baseRender();requestAnimationFrame(enhancePdfState);};
  window.addEventListener('load',()=>requestAnimationFrame(enhancePdfState),{once:true});
  window.addEventListener('bjt-pdf-native',updateLabels);
  window.BJT_PDF={setZoom,toggleFullscreen,captureScreen,reload:()=>window.BJT_NATIVE_PDF?.reload?.(),getPage:()=>null,getZoom:()=>currentZoom};
})();