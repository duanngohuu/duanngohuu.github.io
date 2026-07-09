(()=>{
  let observer,timer;
  function enhance(){
    const pane=document.getElementById('pdfPane'),frame=document.getElementById('pdfFrame');
    if(!pane||!frame)return;
    frame.setAttribute('scrolling','yes');
    frame.setAttribute('allowfullscreen','');
    frame.setAttribute('webkitallowfullscreen','');
    frame.style.touchAction='pan-x pan-y';
    const actions=pane.querySelector('.pdf-primary-actions');
    if(actions&&!actions.querySelector('[data-pdf-fullscreen]')){
      const button=document.createElement('button');
      button.type='button';
      button.className='mini-btn pdf-fullscreen-btn';
      button.dataset.pdfFullscreen='';
      button.textContent='⛶ Toàn màn hình';
      button.onclick=()=>{
        const src=frame.getAttribute('src')||frame.src;
        const opened=window.open(src,'_blank','noopener,noreferrer');
        if(!opened)frame.requestFullscreen?.().catch(()=>{});
      };
      actions.appendChild(button);
    }
  }
  window.addEventListener('DOMContentLoaded',()=>{
    const root=document.getElementById('lessonDetail');
    if(root){observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enhance,40);});observer.observe(root,{childList:true,subtree:true});}
    enhance();
  });
  window.addEventListener('load',enhance);
})();