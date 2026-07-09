(()=>{
  const {state}=BJT;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const lessonSort=(a,b)=>(+a.sort_order||0)-(+b.sort_order||0);
  let dock,sheet,observer,timer,removeScroll=()=>{};

  function jumpTo(id){
    const target=document.getElementById(id);if(!target)return;
    const offset=(dock?.classList.contains('visible')?dock.getBoundingClientRect().height:0)+8;
    window.scrollTo({top:Math.max(0,target.getBoundingClientRect().top+window.scrollY-offset),behavior:'smooth'});
  }
  function changeLesson(id){
    if(!id||id===state.lessonId)return;
    state.lessonId=id;state.questionId='';localStorage.setItem('bjtLastLesson',id);closeSheet();BJT_UI.render();
    requestAnimationFrame(()=>requestAnimationFrame(()=>jumpTo('contentPane')));
  }
  function ensureDock(){
    if(dock&&document.body.contains(dock))return dock;
    dock=document.createElement('nav');dock.id='mobileFloatingDock';dock.className='mobile-floating-dock';dock.setAttribute('aria-label','Điều khiển nhanh BJT');document.body.appendChild(dock);return dock;
  }
  function trackNo(media,index){
    const n=String(media?.track_label||media?.file_name||'').match(/(\d{1,3})(?=\D*$)/)?.[1];
    return n?String(+n).padStart(3,'0'):String(index+1).padStart(3,'0');
  }
  function ensureSheet(){
    if(sheet&&document.body.contains(sheet))return sheet;
    sheet=document.createElement('div');sheet.id='mobileQuickSheet';sheet.className='mobile-quick-overlay';sheet.hidden=true;
    sheet.innerHTML='<section class="mobile-quick-sheet" role="dialog" aria-modal="true"><header><div><strong>Chọn nhanh</strong><small id="quickCurrent"></small></div><button id="quickClose" type="button">×</button></header><div class="quick-field"><span>Session</span><select id="quickSession"></select></div><div class="quick-field"><span>Bài</span><select id="quickLesson"></select></div><div class="quick-actions"><button data-go="studyAudioBar">Audio</button><button data-go="contentPane">Bài học</button><button data-go="pdfPane">PDF</button><button data-go="memoPanel">Memo</button><button data-go="lessonGroups">Mục lục</button></div></section>';
    document.body.appendChild(sheet);
    sheet.onclick=e=>{if(e.target===sheet)closeSheet();};sheet.querySelector('#quickClose').onclick=closeSheet;
    sheet.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{closeSheet();jumpTo(b.dataset.go);});
    return sheet;
  }
  function openSheet(){
    const s=ensureSheet(),all=state.lessons.filter(x=>x.book_id===state.bookId).sort(lessonSort),current=all.find(x=>x.lesson_id===state.lessonId);if(!current)return;
    const sessions=[...new Set(all.map(x=>x.part_title||'Toàn bộ'))],session=current.part_title||'Toàn bộ';
    const sessionSelect=s.querySelector('#quickSession'),lessonSelect=s.querySelector('#quickLesson');
    sessionSelect.innerHTML=sessions.map(x=>`<option value="${esc(x)}" ${x===session?'selected':''}>${esc(x)}</option>`).join('');
    const fillLessons=value=>{const list=all.filter(x=>(x.part_title||'Toàn bộ')===value);lessonSelect.innerHTML=list.map((x,i)=>`<option value="${esc(x.lesson_id)}" ${x.lesson_id===state.lessonId?'selected':''}>${String(i+1).padStart(2,'0')} · ${esc(x.section_title)}</option>`).join('');return list;};
    fillLessons(session);s.querySelector('#quickCurrent').textContent=current.section_title||'';
    sessionSelect.onchange=()=>{const list=fillLessons(sessionSelect.value);if(list[0])changeLesson(list[0].lesson_id);};
    lessonSelect.onchange=()=>changeLesson(lessonSelect.value);
    s.hidden=false;document.body.classList.add('mobile-sheet-open');
  }
  function closeSheet(){if(!sheet)return;sheet.hidden=true;document.body.classList.remove('mobile-sheet-open');}

  function renderDock(){
    removeScroll();
    const audioBar=document.getElementById('studyAudioBar')||document.querySelector('.study-audio-bar');
    const content=document.getElementById('contentPane'),pdf=document.getElementById('pdfPane'),memo=document.querySelector('.memo-panel');
    const lesson=state.lessons.find(x=>x.lesson_id===state.lessonId);
    if(!audioBar||!content||!pdf||!memo||!lesson){if(dock)dock.classList.remove('visible');return;}
    memo.id='memoPanel';[content,pdf,memo].forEach(x=>x.classList.add('study-anchor'));
    const d=ensureDock(),media=window.BJT_AUDIO?.getList?.()||[],currentMedia=window.BJT_AUDIO?.getCurrent?.(),audioIndex=window.BJT_AUDIO?.getIndex?.()||0;
    const pdfPage=window.BJT_PDF?.getPage?.()||+(lesson.pdf_page_start||lesson.page_start||1),hasMemo=Boolean(localStorage.getItem(`bjtMemoCurrent:${lesson.lesson_id}`)?.trim());
    d.innerHTML=`<button id="floatAudioJump" class="dock-icon" type="button" aria-label="Phát hoặc dừng audio">♫</button><button id="floatTrackPicker" class="dock-track" type="button"><b>${esc(trackNo(currentMedia,audioIndex))}</b><small>${media.length?`${audioIndex+1}/${media.length}`:'—'}</small></button><button data-jump="contentPane" class="dock-nav active" type="button">Bài</button><button data-jump="pdfPane" class="dock-nav" type="button">PDF</button><button id="floatPagePicker" class="dock-page" type="button">${pdfPage}</button><button data-jump="memoPanel" class="dock-nav ${hasMemo?'has-note':''}" type="button">Memo</button><button id="floatMenu" class="dock-icon" type="button" aria-label="Chọn session và bài">☰</button>`;
    d.querySelector('#floatAudioJump').onclick=()=>window.BJT_AUDIO?.toggle?.();
    d.querySelector('#floatTrackPicker').onclick=()=>window.BJT_AUDIO?.openPicker?.();
    d.querySelector('#floatPagePicker').onclick=()=>window.BJT_PDF?.openPicker?.();
    d.querySelector('#floatMenu').onclick=openSheet;
    d.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>jumpTo(b.dataset.jump));
    const update=()=>{
      if(!matchMedia('(max-width:900px)').matches){d.classList.remove('visible');return;}
      const a=audioBar.getBoundingClientRect(),workspace=document.querySelector('.study-workspace')?.getBoundingClientRect();
      const show=a.bottom<4&&workspace&&workspace.bottom>90;d.classList.toggle('visible',Boolean(show));
      const line=(show?d.getBoundingClientRect().height:0)+12;let active='contentPane';
      for(const el of [content,pdf,memo])if(el.getBoundingClientRect().top<=line)active=el.id;
      d.querySelectorAll('[data-jump]').forEach(b=>b.classList.toggle('active',b.dataset.jump===active));
    };
    window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update,{passive:true});
    removeScroll=()=>{window.removeEventListener('scroll',update);window.removeEventListener('resize',update);};update();
  }
  window.addEventListener('bjt-audio-state',e=>{if(!dock)return;const play=dock.querySelector('#floatAudioJump');if(play)play.textContent=e.detail.playing?'❚❚':'♫';const b=dock.querySelector('#floatTrackPicker');if(b&&e.detail.media){b.querySelector('b').textContent=trackNo(e.detail.media,e.detail.index);b.querySelector('small').textContent=`${e.detail.index+1}/${e.detail.total}`;}});
  window.addEventListener('bjt-pdf-state',e=>{const b=dock?.querySelector('#floatPagePicker');if(b)b.textContent=e.detail.page;});
  window.addEventListener('DOMContentLoaded',()=>{const root=document.getElementById('lessonDetail');if(root){observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(renderDock,50);});observer.observe(root,{childList:true,subtree:true});}});
  window.addEventListener('load',renderDock);
})();