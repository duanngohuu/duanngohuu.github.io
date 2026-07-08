(()=>{
  const {state}=BJT;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const lessonSort=(a,b)=>(+a.sort_order||0)-(+b.sort_order||0);
  let dock,observer,timer,removeScroll=()=>{};

  function jumpTo(id){
    const target=document.getElementById(id);if(!target)return;
    const offset=(dock?.getBoundingClientRect().height||0)+10;
    window.scrollTo({top:Math.max(0,target.getBoundingClientRect().top+window.scrollY-offset),behavior:'smooth'});
  }
  function changeLesson(id){
    if(!id||id===state.lessonId)return;
    state.lessonId=id;state.questionId='';localStorage.setItem('bjtLastLesson',id);BJT_UI.render();
    requestAnimationFrame(()=>requestAnimationFrame(()=>jumpTo('contentPane')));
  }
  function ensureDock(){
    if(dock&&document.body.contains(dock))return dock;
    dock=document.createElement('nav');dock.id='mobileFloatingDock';dock.className='mobile-floating-dock';dock.setAttribute('aria-label','Điều khiển nổi khi học BJT');document.body.appendChild(dock);return dock;
  }
  function audioLabel(media,index,total){
    if(!media)return'Chọn audio';
    const no=String(media.file_name||media.track_label||'').match(/(\d{1,3})(?=\D*$)/)?.[1];
    return `${no?String(+no).padStart(3,'0'):String(index+1).padStart(3,'0')} · ${index+1}/${total}`;
  }

  function renderDock(){
    removeScroll();
    const audioBar=document.getElementById('studyAudioBar')||document.querySelector('.study-audio-bar');
    const content=document.getElementById('contentPane'),pdf=document.getElementById('pdfPane'),memo=document.querySelector('.memo-panel');
    const lesson=state.lessons.find(x=>x.lesson_id===state.lessonId);
    if(!audioBar||!content||!pdf||!memo||!lesson){if(dock)dock.classList.remove('visible');return;}
    memo.id='memoPanel';[content,pdf,memo].forEach(x=>x.classList.add('study-anchor'));
    const d=ensureDock(),all=state.lessons.filter(x=>x.book_id===state.bookId).sort(lessonSort);
    const sessions=[...new Set(all.map(x=>x.part_title||'Toàn bộ'))],session=lesson.part_title||'Toàn bộ';
    const lessonList=all.filter(x=>(x.part_title||'Toàn bộ')===session);
    const media=window.BJT_AUDIO?.getList?.()||[],currentMedia=window.BJT_AUDIO?.getCurrent?.(),audioIndex=window.BJT_AUDIO?.getIndex?.()||0;
    const pdfPage=window.BJT_PDF?.getPage?.()||+(lesson.pdf_page_start||lesson.page_start||1);
    const hasMemo=Boolean(localStorage.getItem(`bjtMemoCurrent:${lesson.lesson_id}`)?.trim());
    d.innerHTML=`<div class="float-audio-row"><button id="floatPlay" class="float-play" type="button">▶</button><button id="floatTrackPicker" class="float-track-picker" type="button"><b>${esc(audioLabel(currentMedia,audioIndex,media.length))}</b><small>${esc(currentMedia?.track_label||currentMedia?.file_name||'Mở danh sách track')}</small></button><button class="float-step" data-step="-1" type="button">‹</button><button class="float-step" data-step="1" type="button">›</button></div><div class="float-select-row"><select id="floatSession" aria-label="Chọn session">${sessions.map(s=>`<option value="${esc(s)}" ${s===session?'selected':''}>${esc(s)}</option>`).join('')}</select><select id="floatLesson" aria-label="Chọn bài">${lessonList.map((l,i)=>`<option value="${esc(l.lesson_id)}" ${l.lesson_id===lesson.lesson_id?'selected':''}>${String(i+1).padStart(2,'0')} · ${esc(l.section_title)}</option>`).join('')}</select></div><div class="float-jump-row"><button data-jump="contentPane" class="active">Bài</button><button data-jump="pdfPane">PDF</button><button id="floatPagePicker" type="button">Tr.${pdfPage}</button><button data-jump="memoPanel" class="${hasMemo?'has-note':''}">Memo</button><button data-jump="lessonGroups">Mục lục</button></div>`;
    d.querySelector('#floatPlay').onclick=()=>window.BJT_AUDIO?.toggle?.();
    d.querySelector('#floatTrackPicker').onclick=()=>window.BJT_AUDIO?.openPicker?.();
    d.querySelectorAll('.float-step').forEach(b=>b.onclick=()=>window.BJT_AUDIO?.step?.(+b.dataset.step));
    d.querySelector('#floatPagePicker').onclick=()=>window.BJT_PDF?.openPicker?.();
    d.querySelector('#floatSession').onchange=e=>{const next=all.find(x=>(x.part_title||'Toàn bộ')===e.target.value);if(next)changeLesson(next.lesson_id);};
    d.querySelector('#floatLesson').onchange=e=>changeLesson(e.target.value);
    d.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>jumpTo(b.dataset.jump));

    const update=()=>{
      if(!matchMedia('(max-width:900px)').matches){d.classList.remove('visible');return;}
      const a=audioBar.getBoundingClientRect(),workspace=document.querySelector('.study-workspace')?.getBoundingClientRect();
      const show=a.bottom<8&&workspace&&workspace.bottom>100;d.classList.toggle('visible',Boolean(show));
      const line=(show?d.getBoundingClientRect().height:0)+14;let active='contentPane';
      for(const el of [content,pdf,memo])if(el.getBoundingClientRect().top<=line)active=el.id;
      d.querySelectorAll('[data-jump]').forEach(b=>b.classList.toggle('active',b.dataset.jump===active));
    };
    window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update,{passive:true});
    removeScroll=()=>{window.removeEventListener('scroll',update);window.removeEventListener('resize',update);};update();
  }

  window.addEventListener('bjt-audio-state',e=>{
    if(!dock)return;
    const play=dock.querySelector('#floatPlay');if(play)play.textContent=e.detail.playing?'❚❚':'▶';
    const button=dock.querySelector('#floatTrackPicker');if(button&&e.detail.media){const b=button.querySelector('b'),s=button.querySelector('small');if(b)b.textContent=audioLabel(e.detail.media,e.detail.index,e.detail.total);if(s)s.textContent=e.detail.media.track_label||e.detail.media.file_name;}
  });
  window.addEventListener('bjt-pdf-state',e=>{const b=dock?.querySelector('#floatPagePicker');if(b)b.textContent=`Tr.${e.detail.page}`;});
  window.addEventListener('DOMContentLoaded',()=>{const root=document.getElementById('lessonDetail');if(root){observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(renderDock,50);});observer.observe(root,{childList:true,subtree:true});}});
  window.addEventListener('load',renderDock);
})();