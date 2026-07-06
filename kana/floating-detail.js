(()=>{
  const MOBILE='(max-width:680px)';
  const STORAGE_KEY='kanaFloatingDetailPositionV1';
  const card=document.querySelector('.detail-card');
  if(!card)return;

  const handle=document.createElement('div');
  handle.className='kana-float-handle';
  handle.innerHTML='<span class="kana-float-grip">•••</span><strong class="kana-float-title">Gợi ý chữ · kéo để di chuyển</strong><button class="kana-float-toggle" type="button" aria-label="Thu gọn phần gợi ý" aria-expanded="true">⌄</button>';
  card.prepend(handle);

  const toggle=handle.querySelector('.kana-float-toggle');
  const title=handle.querySelector('.kana-float-title');
  let dragging=false;
  let pointerId=null;
  let startX=0,startY=0,startLeft=0,startTop=0;

  const isMobile=()=>window.matchMedia(MOBILE).matches;
  const clamp=(value,min,max)=>Math.min(Math.max(value,min),Math.max(min,max));

  function cardBounds(left,top){
    const rect=card.getBoundingClientRect();
    const margin=6;
    return{
      left:clamp(left,margin,window.innerWidth-rect.width-margin),
      top:clamp(top,margin,window.innerHeight-rect.height-margin)
    };
  }

  function applySavedPosition(){
    if(!isMobile()){
      card.style.left='';card.style.top='';card.style.right='';card.style.bottom='';
      return;
    }
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(!saved||!Number.isFinite(saved.left)||!Number.isFinite(saved.top))return;
      card.style.right='auto';card.style.bottom='auto';
      requestAnimationFrame(()=>{
        const pos=cardBounds(saved.left,saved.top);
        card.style.left=pos.left+'px';
        card.style.top=pos.top+'px';
      });
    }catch{}
  }

  function savePosition(){
    if(!isMobile())return;
    const rect=card.getBoundingClientRect();
    localStorage.setItem(STORAGE_KEY,JSON.stringify({left:Math.round(rect.left),top:Math.round(rect.top)}));
  }

  function keepInsideViewport(){
    if(!isMobile()||!card.style.left)return;
    requestAnimationFrame(()=>{
      const rect=card.getBoundingClientRect();
      const pos=cardBounds(rect.left,rect.top);
      card.style.left=pos.left+'px';
      card.style.top=pos.top+'px';
      savePosition();
    });
  }

  function setCollapsed(collapsed){
    card.classList.toggle('is-collapsed',collapsed);
    toggle.textContent=collapsed?'⌃':'⌄';
    toggle.setAttribute('aria-expanded',String(!collapsed));
    toggle.setAttribute('aria-label',collapsed?'Mở phần gợi ý':'Thu gọn phần gợi ý');
    keepInsideViewport();
  }

  toggle.addEventListener('click',e=>{
    e.stopPropagation();
    setCollapsed(!card.classList.contains('is-collapsed'));
  });

  handle.addEventListener('pointerdown',e=>{
    if(!isMobile()||e.target.closest('button'))return;
    e.preventDefault();
    const rect=card.getBoundingClientRect();
    dragging=true;pointerId=e.pointerId;
    startX=e.clientX;startY=e.clientY;startLeft=rect.left;startTop=rect.top;
    card.style.right='auto';card.style.bottom='auto';
    card.style.left=rect.left+'px';card.style.top=rect.top+'px';
    handle.setPointerCapture?.(pointerId);
  });

  handle.addEventListener('pointermove',e=>{
    if(!dragging||e.pointerId!==pointerId)return;
    e.preventDefault();
    const pos=cardBounds(startLeft+(e.clientX-startX),startTop+(e.clientY-startY));
    card.style.left=pos.left+'px';
    card.style.top=pos.top+'px';
  });

  function finishDrag(e){
    if(!dragging||e.pointerId!==pointerId)return;
    dragging=false;
    try{handle.releasePointerCapture?.(pointerId)}catch{}
    pointerId=null;
    savePosition();
  }
  handle.addEventListener('pointerup',finishDrag);
  handle.addEventListener('pointercancel',finishDrag);

  document.addEventListener('click',e=>{
    const cell=e.target.closest('.kana-cell');
    if(!cell||!isMobile())return;
    setCollapsed(false);
    title.textContent='Gợi ý chữ · kéo để di chuyển';
    card.classList.remove('kana-float-pulse');
    void card.offsetWidth;
    card.classList.add('kana-float-pulse');
    setTimeout(()=>card.classList.remove('kana-float-pulse'),380);
  },true);

  const viewButtons=document.querySelectorAll('.mode-btn');
  viewButtons.forEach(btn=>btn.addEventListener('click',()=>{
    if(btn.dataset.view==='table')setTimeout(keepInsideViewport,30);
  }));

  window.addEventListener('resize',keepInsideViewport);
  window.addEventListener('orientationchange',()=>setTimeout(keepInsideViewport,180));
  applySavedPosition();
})();

(()=>{
  if(!document.querySelector('link[data-beginner-helper]')){
    const css=document.createElement('link');
    css.rel='stylesheet';
    css.href='./beginner-helper.css?v=8c0173e';
    css.dataset.beginnerHelper='true';
    document.head.appendChild(css);
  }
  if(!document.querySelector('script[data-beginner-helper]')){
    const script=document.createElement('script');
    script.src='./beginner-helper.js?v=ad57f50';
    script.defer=true;
    script.dataset.beginnerHelper='true';
    document.body.appendChild(script);
  }
})();
