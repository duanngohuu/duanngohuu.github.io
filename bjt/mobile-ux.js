(()=>{
  const {state}=BJT;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const lessonSort=(a,b)=>(+a.sort_order||0)-(+b.sort_order||0);
  let removeGlobalListeners=()=>{};

  function jumpTo(id){
    const target=document.getElementById(id);
    const bar=document.getElementById('studyAudioBar');
    if(!target)return;
    const offset=(bar?.getBoundingClientRect().height||0)+10;
    const top=target.getBoundingClientRect().top+window.scrollY-offset;
    window.scrollTo({top:Math.max(0,top),behavior:'smooth'});
  }

  function scheduleJump(id='contentPane'){
    requestAnimationFrame(()=>requestAnimationFrame(()=>jumpTo(id)));
  }

  function enhanceMobileWorkspace(){
    removeGlobalListeners();
    const bar=document.querySelector('.study-audio-bar');
    const content=document.getElementById('contentPane');
    const pdf=document.getElementById('pdfPane');
    const memo=document.querySelector('.memo-panel');
    if(!bar||!content||!pdf||!memo)return;

    bar.id='studyAudioBar';
    memo.id='memoPanel';
    [content,pdf,memo].forEach(x=>x.classList.add('study-anchor'));

    const book=state.books.find(x=>x.book_id===state.bookId);
    const allLessons=state.lessons.filter(x=>x.book_id===state.bookId).sort(lessonSort);
    const current=allLessons.find(x=>x.lesson_id===state.lessonId)||allLessons[0];
    if(!current)return;
    const sessions=[...new Set(allLessons.map(x=>x.part_title||'Toàn bộ').filter(Boolean))];
    const currentSession=current.part_title||'Toàn bộ';
    const sessionLessons=allLessons.filter(x=>(x.part_title||'Toàn bộ')===currentSession);
    const hasMemo=Boolean(localStorage.getItem(`bjtMemoCurrent:${current.lesson_id}`)?.trim());

    bar.insertAdjacentHTML('beforeend',`<nav class="mobile-study-dock" aria-label="Điều hướng nhanh khi học">
      <div class="mobile-quick-current"><span>Đang học</span><strong>${esc(book?.book_title||'BJT')} · ${esc(current.section_title||'')}</strong></div>
      <div class="mobile-quick-selects">
        <label><span>Session</span><select id="mobileSessionSelect" aria-label="Chọn session">${sessions.map(s=>`<option value="${esc(s)}" ${s===currentSession?'selected':''}>${esc(s)}</option>`).join('')}</select></label>
        <label><span>Bài</span><select id="mobileLessonSelect" aria-label="Chọn bài">${sessionLessons.map((l,i)=>`<option value="${esc(l.lesson_id)}" ${l.lesson_id===current.lesson_id?'selected':''}>${String(i+1).padStart(2,'0')} · ${esc(l.section_title||l.lesson_id)}</option>`).join('')}</select></label>
      </div>
      <div class="mobile-quick-jumps">
        <button class="mobile-jump active" data-target="contentPane">Bài học</button>
        <button class="mobile-jump" data-target="pdfPane">PDF</button>
        <button class="mobile-jump ${hasMemo?'has-note':''}" data-target="memoPanel">Memo</button>
      </div>
    </nav>`);

    const sessionSelect=document.getElementById('mobileSessionSelect');
    const lessonSelect=document.getElementById('mobileLessonSelect');
    sessionSelect.onchange=()=>{
      const next=allLessons.find(x=>(x.part_title||'Toàn bộ')===sessionSelect.value);
      if(!next)return;
      state.lessonId=next.lesson_id;state.questionId='';
      localStorage.setItem('bjtLastLesson',state.lessonId);
      BJT_UI.render();scheduleJump();
    };
    lessonSelect.onchange=()=>{
      state.lessonId=lessonSelect.value;state.questionId='';
      localStorage.setItem('bjtLastLesson',state.lessonId);
      BJT_UI.render();scheduleJump();
    };

    document.querySelectorAll('.mobile-jump').forEach(btn=>btn.onclick=()=>jumpTo(btn.dataset.target));

    const buttons=[...document.querySelectorAll('.mobile-jump')];
    const sections=[content,pdf,memo];
    const updateActive=()=>{
      if(!matchMedia('(max-width:900px)').matches)return;
      const offset=(bar.getBoundingClientRect().height||0)+18;
      let active=sections[0];
      for(const section of sections){
        if(section.getBoundingClientRect().top<=offset)active=section;
      }
      buttons.forEach(btn=>btn.classList.toggle('active',btn.dataset.target===active.id));
    };
    const memoInput=document.getElementById('studyMemo');
    const memoButton=buttons.find(x=>x.dataset.target==='memoPanel');
    memoInput?.addEventListener('input',()=>memoButton?.classList.toggle('has-note',Boolean(memoInput.value.trim())));
    window.addEventListener('scroll',updateActive,{passive:true});
    window.addEventListener('resize',updateActive,{passive:true});
    removeGlobalListeners=()=>{
      window.removeEventListener('scroll',updateActive);
      window.removeEventListener('resize',updateActive);
    };
    updateActive();
  }

  const baseRender=BJT_UI.render;
  BJT_UI.render=function(){
    baseRender();
    requestAnimationFrame(enhanceMobileWorkspace);
  };
  window.addEventListener('load',()=>requestAnimationFrame(enhanceMobileWorkspace),{once:true});
})();