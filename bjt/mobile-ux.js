(()=>{
  const {state}=BJT;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const lessonSort=(a,b)=>(+a.sort_order||0)-(+b.sort_order||0);
  let dock,sheet,observer,timer;

  function jumpTo(id){const target=document.getElementById(id);if(!target)return;target.scrollIntoView({behavior:'smooth',block:'start'});}
  function changeLesson(id){if(!id||id===state.lessonId)return;state.lessonId=id;state.questionId='';localStorage.setItem('bjtLastLesson',id);closeSheet();BJT_UI.render();requestAnimationFrame(()=>jumpTo('pdfPane'));}
  function ensureDock(){if(dock&&document.body.contains(dock))return dock;dock=document.createElement('nav');dock.id='mobileFloatingDock';dock.className='mobile-floating-dock';dock.setAttribute('aria-label','Điều khiển nhanh BJT');document.body.appendChild(dock);return dock;}
  function trackNo(media,index){const n=String(media?.track_label||media?.file_name||'').match(/(\d{1,3})(?=\D*$)/)?.[1];return n?String(+n).padStart(3,'0'):String(index+1).padStart(3,'0');}

  function ensureSheet(){
    if(sheet&&document.body.contains(sheet))return sheet;
    sheet=document.createElement('div');sheet.id='mobileQuickSheet';sheet.className='mobile-quick-overlay';sheet.hidden=true;
    sheet.innerHTML='<section class="mobile-quick-sheet" role="dialog" aria-modal="true"><header><div><strong>Chọn bài học</strong><small id="quickCurrent"></small></div><button id="quickClose" type="button">×</button></header><div class="quick-field"><span>Phần</span><select id="quickSession"></select></div><div class="quick-field"><span>Bài</span><select id="quickLesson"></select></div><div class="quick-actions"><button data-go="studyAudioBar">Audio</button><button data-go="pdfPane">PDF</button><button data-open-memo>Memo</button><button data-open-sidebar>Mục lục</button></div></section>';
    document.body.appendChild(sheet);
    sheet.onclick=e=>{if(e.target===sheet)closeSheet();};
    sheet.querySelector('#quickClose').onclick=closeSheet;
    sheet.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{closeSheet();jumpTo(b.dataset.go);});
    sheet.querySelector('[data-open-memo]').onclick=()=>{closeSheet();window.BJT_MEMO?.open?.();};
    sheet.querySelector('[data-open-sidebar]').onclick=()=>{closeSheet();document.querySelector('.side-lessons')?.classList.add('open');document.querySelector('.sidebar')?.scrollIntoView({behavior:'smooth',block:'start'});};
    return sheet;
  }
  function openSheet(){
    const s=ensureSheet(),all=state.lessons.filter(x=>x.book_id===state.bookId).sort(lessonSort),current=all.find(x=>x.lesson_id===state.lessonId);if(!current)return;
    const sessions=[...new Set(all.map(x=>x.part_title||'Toàn bộ'))],session=current.part_title||'Toàn bộ';
    const sessionSelect=s.querySelector('#quickSession'),lessonSelect=s.querySelector('#quickLesson');
    sessionSelect.innerHTML=sessions.map(x=>`<option value="${esc(x)}" ${x===session?'selected':''}>${esc(x)}</option>`).join('');
    const fillLessons=value=>{const list=all.filter(x=>(x.part_title||'Toàn bộ')===value);lessonSelect.innerHTML=list.map((x,i)=>`<option value="${esc(x.lesson_id)}" ${x.lesson_id===state.lessonId?'selected':''}>${String(i+1).padStart(2,'0')} · ${esc(x.section_title)}</option>`).join('');return list;};
    fillLessons(session);
    s.querySelector('#quickCurrent').textContent=current.section_title||'';
    sessionSelect.onchange=()=>{const list=fillLessons(sessionSelect.value);if(list[0])changeLesson(list[0].lesson_id);};
    lessonSelect.onchange=()=>changeLesson(lessonSelect.value);
    const audioButton=s.querySelector('[data-go="studyAudioBar"]');audioButton.hidden=!document.getElementById('studyAudioBar')&&!document.querySelector('.study-audio-bar');
    s.hidden=false;document.body.classList.add('mobile-sheet-open');
  }
  function closeSheet(){if(!sheet)return;sheet.hidden=true;document.body.classList.remove('mobile-sheet-open');}

  function renderDock(){
    const pdf=document.getElementById('pdfPane'),lesson=state.lessons.find(x=>x.lesson_id===state.lessonId);
    if(!pdf||!lesson){if(dock)dock.classList.remove('visible');return;}
    const d=ensureDock(),audioBar=document.getElementById('studyAudioBar')||document.querySelector('.study-audio-bar'),media=window.BJT_AUDIO?.getList?.()||[],currentMedia=window.BJT_AUDIO?.getCurrent?.(),audioIndex=window.BJT_AUDIO?.getIndex?.()||0,hasMemo=Boolean(localStorage.getItem(`bjtMemoCurrent:${lesson.lesson_id}`)?.trim());
    d.innerHTML=`<button id="floatMenu" class="dock-icon" type="button" aria-label="Chọn bài">☰</button>${audioBar?`<button id="floatAudioJump" class="dock-icon" type="button" aria-label="Tới audio">♫</button><button id="floatTrackPicker" class="dock-track" type="button"><b>${esc(trackNo(currentMedia,audioIndex))}</b><small>${media.length?`${audioIndex+1}/${media.length}`:'Audio'}</small></button>`:''}<button id="floatPdf" class="dock-nav active" type="button">PDF</button><button id="floatMemo" class="dock-nav ${hasMemo?'has-note':''}" type="button">Memo</button>`;
    d.classList.toggle('no-audio',!audioBar);
    d.querySelector('#floatMenu').onclick=openSheet;
    d.querySelector('#floatAudioJump')?.addEventListener('click',()=>jumpTo('studyAudioBar'));
    d.querySelector('#floatTrackPicker')?.addEventListener('click',()=>window.BJT_AUDIO?.openPicker?.());
    d.querySelector('#floatPdf').onclick=()=>jumpTo('pdfPane');
    d.querySelector('#floatMemo').onclick=()=>window.BJT_MEMO?.open?.();
    d.classList.toggle('visible',matchMedia('(max-width:900px)').matches);
  }

  window.addEventListener('bjt-audio-state',e=>{if(!dock)return;const b=dock.querySelector('#floatTrackPicker');if(b&&e.detail.media){b.querySelector('b').textContent=trackNo(e.detail.media,e.detail.index);b.querySelector('small').textContent=`${e.detail.index+1}/${e.detail.total}`;}});
  window.addEventListener('resize',renderDock,{passive:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeSheet();window.BJT_MEMO?.close?.();}});
  window.addEventListener('DOMContentLoaded',()=>{const root=document.getElementById('lessonDetail');if(root){observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(renderDock,80);});observer.observe(root,{childList:true});}});
  window.addEventListener('load',renderDock);
})();