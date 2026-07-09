(()=>{
  'use strict';
  const app=window.BJT;
  if(!app?.state||!window.BJT_UI)return;
  const {state}=app;
  let backdrop=null,toggle=null,observer=null,timer=0;

  const mobile=()=>matchMedia('(max-width:900px)').matches;
  const sidebar=()=>document.querySelector('.sidebar');

  function stickyOffset(){
    const topbar=document.querySelector('.topbar');
    const workspaceHead=document.querySelector('.workspace-panel>.panel-head');
    let value=8;
    if(topbar&&getComputedStyle(topbar).position==='sticky')value+=topbar.getBoundingClientRect().height;
    if(workspaceHead&&getComputedStyle(workspaceHead).position==='sticky')value+=workspaceHead.getBoundingClientRect().height+5;
    return Math.min(value,150);
  }

  function jumpToElement(element,{behavior='smooth'}={}){
    if(!element)return;
    const top=Math.max(0,window.scrollY+element.getBoundingClientRect().top-stickyOffset());
    window.scrollTo({top,behavior});
  }
  function jumpPdf(options){
    const pane=document.getElementById('pdfPane');
    if(!pane)return;
    jumpToElement(pane,options);
  }

  function ensureBackdrop(){
    if(backdrop&&document.body.contains(backdrop))return backdrop;
    backdrop=document.createElement('button');
    backdrop.type='button';
    backdrop.className='study-drawer-backdrop';
    backdrop.setAttribute('aria-label','Đóng mục lục');
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click',closeDrawer);
    return backdrop;
  }

  function ensureToggle(){
    const head=document.querySelector('.workspace-panel>.panel-head');
    if(!head)return null;
    toggle=document.getElementById('openStudyDrawer');
    if(!toggle){
      toggle=document.createElement('button');
      toggle.id='openStudyDrawer';
      toggle.type='button';
      toggle.className='study-drawer-toggle';
      toggle.innerHTML='▤ <span>Mục lục</span>';
      toggle.setAttribute('aria-label','Mở mục lục sách và bài học');
      head.insertBefore(toggle,head.firstChild);
    }
    toggle.onclick=event=>{event.preventDefault();event.stopPropagation();openDrawer();};
    return toggle;
  }

  function openDrawer(){
    if(!mobile())return;
    const side=sidebar();if(!side)return;
    ensureBackdrop();ensureToggle();
    side.classList.add('study-drawer-open');
    backdrop.classList.add('open');
    document.body.classList.add('study-drawer-open');
    toggle?.setAttribute('aria-expanded','true');
    const active=side.querySelector('.lesson-card.active,.book-btn.active');
    setTimeout(()=>active?.scrollIntoView({block:'nearest'}),80);
  }
  function closeDrawer(){
    sidebar()?.classList.remove('study-drawer-open');
    backdrop?.classList.remove('open');
    document.body.classList.remove('study-drawer-open');
    toggle?.setAttribute('aria-expanded','false');
  }

  function openMemoFallback(){
    const overlay=document.getElementById('memoOverlay');
    const memo=document.getElementById('studyMemo');
    if(!overlay)return;
    jumpPdf();
    overlay.hidden=false;
    requestAnimationFrame(()=>overlay.classList.add('open'));
    document.body.classList.add('memo-open');
    setTimeout(()=>memo?.focus({preventScroll:true}),220);
  }
  function openMemo(){
    closeDrawer();
    const action=window.BJT_MEMO?.open;
    if(typeof action==='function')action();else openMemoFallback();
    setTimeout(()=>jumpPdf({behavior:'auto'}),40);
  }

  function repairStaleLayers(){
    const memo=document.getElementById('memoOverlay');
    if(memo&&!memo.hidden&&!memo.classList.contains('open'))memo.hidden=true;
    document.querySelectorAll('.mobile-quick-overlay[hidden],.audio-picker-overlay[hidden],.script-overlay[hidden]').forEach(element=>{
      element.style.pointerEvents='none';
    });
    if(!document.querySelector('.memo-overlay.open'))document.body.classList.remove('memo-open');
    if(!document.querySelector('.mobile-quick-overlay:not([hidden])'))document.body.classList.remove('mobile-sheet-open');
    if(!document.querySelector('.audio-picker-overlay:not([hidden]),.script-overlay:not([hidden])'))document.body.classList.remove('audio-sheet-open');
  }

  function ensureUi(){
    ensureBackdrop();ensureToggle();repairStaleLayers();
    if(!mobile())closeDrawer();
  }

  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;
    if(!target)return;

    if(target.closest('#openStudyDrawer')){
      event.preventDefault();event.stopImmediatePropagation();openDrawer();return;
    }
    if(target.closest('#openMemo,#memoFab,#floatMemo,[data-open-memo]')){
      event.preventDefault();event.stopImmediatePropagation();openMemo();return;
    }
    if(target.closest('#floatPdf,[data-go="pdfPane"]')){
      event.preventDefault();event.stopImmediatePropagation();closeDrawer();jumpPdf();return;
    }
    if(target.closest('.lesson-card')){
      setTimeout(()=>{closeDrawer();jumpPdf({behavior:'auto'});},40);return;
    }
    if(target.closest('.book-btn')){
      setTimeout(()=>{
        const side=sidebar();
        side?.querySelector('.lesson-card.active')?.scrollIntoView({block:'nearest'});
      },60);
    }
  },true);

  document.addEventListener('keydown',event=>{
    if(event.key==='Escape')closeDrawer();
  });
  window.addEventListener('resize',ensureUi,{passive:true});
  window.addEventListener('pageshow',()=>{repairStaleLayers();ensureUi();});

  window.addEventListener('DOMContentLoaded',()=>{
    ensureUi();
    const root=document.getElementById('lessonDetail');
    if(root){
      observer=new MutationObserver(()=>{
        clearTimeout(timer);
        timer=setTimeout(ensureUi,50);
      });
      observer.observe(root,{childList:true,subtree:false});
    }
  });
  window.addEventListener('load',ensureUi);

  window.BJT_NAV={openDrawer,closeDrawer,jumpPdf,openMemo,repairStaleLayers};
})();
