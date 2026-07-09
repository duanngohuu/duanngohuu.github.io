(()=>{
  const {state}=BJT;
  const driveId=url=>String(url||'').match(/\/d\/([^/?#]+)/)?.[1]||String(url||'').match(/[?&]id=([^&#]+)/)?.[1]||'';
  const lessonStart=()=>{
    const l=state.lessons.find(x=>x.lesson_id===state.lessonId);
    return Math.max(1,+(l?.pdf_page_start||l?.page_start||1));
  };
  let observer,timer;

  function enhance(){
    const frame=document.getElementById('pdfFrame');
    if(!frame||frame.dataset.nativePdf==='1')return;
    const id=driveId(frame.getAttribute('src')||frame.src);
    if(!id)return;
    const page=lessonStart();
    const base=`https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`;
    frame.dataset.nativePdf='1';
    frame.dataset.basePdfSrc=base;
    frame.setAttribute('src',`${base}&bjtPage=${page}&t=${Date.now()}#page=${page}&zoom=page-width`);
    frame.setAttribute('title','PDF sách - trình xem của trình duyệt');
  }

  window.addEventListener('DOMContentLoaded',()=>{
    const root=document.getElementById('lessonDetail');
    if(root){
      observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enhance,10);});
      observer.observe(root,{childList:true,subtree:true});
    }
  });
  window.addEventListener('load',enhance);
  window.BJT_NATIVE_PDF={enhance};
})();