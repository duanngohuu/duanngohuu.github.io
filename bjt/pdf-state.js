(()=>{
  const {state}=BJT;
  let removeListeners=()=>{},currentLesson=null;

  function toast(text){if(window.BJT_UI?.toast)BJT_UI.toast(text);else alert(text);}
  function unwrapLegacy(frame){
    const stage=frame?.closest('.pdf-zoom-stage');
    const viewport=frame?.closest('.pdf-zoom-viewport');
    if(viewport&&stage){
      viewport.parentNode.insertBefore(frame,viewport);
      viewport.remove();
    }
    if(frame){
      frame.style.transform='';
      frame.style.width='100%';
      frame.style.height='100%';
      frame.style.minHeight='0';
      frame.style.display='block';
      frame.style.touchAction='pan-x pan-y';
      frame.setAttribute('scrolling','yes');
    }
  }
  function updateLabels(){
    const status=document.getElementById('pdfLoadStatus');
    if(status)status.textContent='Google Drive PDF · cuộn trực tiếp trong khung';
  }
  function setZoom(){toast('Dùng nút − / + ngay trong thanh công cụ của Google Drive PDF.');}
  async function toggleFullscreen(){
    const pane=document.getElementById('pdfPane');if(!pane)return;
    try{
      if(document.fullscreenElement){await document.exitFullscreen();return;}
      if(pane.requestFullscreen){await pane.requestFullscreen();return;}
    }catch{}
    pane.classList.toggle('pdf-focus-mode');
    document.body.classList.toggle('pdf-focus-open',pane.classList.contains('pdf-focus-mode'));
    const button=document.getElementById('pdfFullscreen');
    if(button)button.textContent=pane.classList.contains('pdf-focus-mode')?'Thu nhỏ':'⛶';
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
    }catch(e){if(e?.name!=='NotAllowedError')toast('Không chụp được màn hình');}
    finally{stream?.getTracks().forEach(t=>t.stop());}
  }

  function enhancePdfState(){
    removeListeners();
    const frame=document.getElementById('pdfFrame'),pane=document.getElementById('pdfPane'),head=pane?.querySelector('.study-pane-head');
    const lesson=state.lessons.find(x=>x.lesson_id===state.lessonId);
    if(!frame||!head||!lesson)return;
    currentLesson=lesson;
    unwrapLegacy(frame);
    document.getElementById('pdfPageTools')?.remove();
    const tools=document.createElement('div');tools.id='pdfPageTools';tools.className='pdf-page-tools';
    tools.innerHTML='<button id="pdfReload" class="mini-btn" type="button">↻</button><button id="pdfFullscreen" class="mini-btn" type="button">⛶</button><button id="pdfCapture" class="mini-btn" type="button">Chụp</button>';
    head.appendChild(tools);
    document.getElementById('pdfReload').onclick=()=>window.BJT_NATIVE_PDF?.reload?.();
    document.getElementById('pdfFullscreen').onclick=toggleFullscreen;
    document.getElementById('pdfCapture').onclick=captureScreen;
    const reload=document.getElementById('reloadPdf');if(reload)reload.onclick=()=>window.BJT_NATIVE_PDF?.reload?.();
    frame.addEventListener('load',updateLabels);
    const onPageShow=()=>{unwrapLegacy(frame);updateLabels();};
    window.addEventListener('pageshow',onPageShow);
    removeListeners=()=>window.removeEventListener('pageshow',onPageShow);
    window.BJT_NATIVE_PDF?.restore?.();
    updateLabels();
  }

  const baseRender=BJT_UI.render;
  BJT_UI.render=function(){baseRender();requestAnimationFrame(enhancePdfState);};
  window.addEventListener('load',()=>requestAnimationFrame(enhancePdfState),{once:true});
  window.addEventListener('bjt-pdf-native',()=>requestAnimationFrame(enhancePdfState));
  window.BJT_PDF={setZoom,toggleFullscreen,captureScreen,reload:()=>window.BJT_NATIVE_PDF?.reload?.(),getPage:()=>null,getZoom:()=>1};
})();