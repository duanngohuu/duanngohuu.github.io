(()=>{
  const {state}=BJT;
  let observer,timer,busy=false;
  const isAudioBook=book=>{
    const value=String(book?.audio_available??'').toLowerCase();
    return value==='true'||value==='1'||value==='yes'||(+book?.audio_track_count||0)>0;
  };
  const current=()=>({
    book:state.books.find(x=>x.book_id===state.bookId),
    lesson:state.lessons.find(x=>x.lesson_id===state.lessonId)
  });
  const bookAudio=bookId=>state.media.filter(m=>m.media_type==='audio'&&m.book_id===bookId&&!m.runtime_audio_alias);
  const lessonAudio=lessonId=>state.media.filter(m=>m.media_type==='audio'&&m.lesson_id===lessonId);

  function addAliases(book,lesson){
    if(!book||!lesson||lessonAudio(lesson.lesson_id).length)return false;
    const source=bookAudio(book.book_id);
    if(!source.length)return false;
    state.media.push(...source.map((m,index)=>({
      ...m,
      media_id:`${m.media_id||m.drive_file_id||index}-ALIAS-${lesson.lesson_id}`,
      lesson_id:lesson.lesson_id,
      runtime_audio_alias:true,
      notes:`Audio toàn sách dùng tại ${lesson.lesson_id}`
    })));
    return true;
  }

  function ensureBar(book){
    let bar=document.querySelector('.study-audio-bar');
    if(!isAudioBook(book)){
      bar?.remove();
      const audio=window.BJT_AUDIO?.getAudio?.();
      if(audio&&!audio.paused)audio.pause();
      document.querySelectorAll('.audio-floating-player').forEach(el=>el.hidden=true);
      document.body.classList.remove('audio-is-playing');
      return null;
    }
    if(!bar){
      const pdf=document.getElementById('pdfPane');
      if(!pdf)return null;
      bar=document.createElement('section');
      bar.className='study-audio-bar';
      bar.innerHTML='<div class="audio-info"><strong>♫ Audio luyện nghe</strong><small id="audioStatus">Đang chuẩn bị audio…</small></div>';
      pdf.parentNode.insertBefore(bar,pdf);
    }
    return bar;
  }

  async function replay(){
    const audio=window.BJT_AUDIO?.getAudio?.();
    if(audio?.src){
      try{audio.currentTime=0;await audio.play();}catch{}
      return;
    }
    document.querySelector('.study-audio-bar [data-audio-play]')?.click();
  }

  function makeReplay(className){
    const button=document.createElement('button');
    button.type='button';
    button.className=className;
    button.dataset.audioReplay='';
    button.textContent='↺ Nghe lại';
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();replay();});
    return button;
  }

  function ensureReplayButtons(){
    const action=document.querySelector('.study-audio-bar .audio-action-row');
    if(action&&!action.querySelector('[data-audio-replay]')){
      const loop=action.querySelector('[data-audio-loop]');
      action.insertBefore(makeReplay('audio-replay-btn'),loop||action.children[1]||null);
    }
    const native=document.querySelector('.study-audio-bar .native-audio-controls');
    if(native&&!native.querySelector('[data-audio-replay]')){
      const loop=native.querySelector('[data-audio-loop]');
      native.insertBefore(makeReplay('native-replay'),loop||null);
    }
    const floating=document.querySelector('.audio-floating-player');
    if(floating&&!floating.querySelector('[data-audio-replay]')){
      const loop=floating.querySelector('[data-audio-loop]');
      floating.insertBefore(makeReplay('float-audio-replay'),loop||null);
    }
  }

  function sync(){
    if(busy)return;
    busy=true;
    try{
      const {book,lesson}=current();
      if(!book||!lesson)return;
      const bar=ensureBar(book);
      if(!bar)return;
      const aliasAdded=addAliases(book,lesson);
      if(aliasAdded||bar.dataset.audioEnhanced!==lesson.lesson_id){
        delete bar.dataset.audioEnhanced;
        window.BJT_AUDIO?.enhance?.();
      }
      ensureReplayButtons();
    }finally{busy=false;}
  }

  window.addEventListener('bjt-audio-state',()=>{clearTimeout(timer);timer=setTimeout(ensureReplayButtons,25);});
  window.addEventListener('DOMContentLoaded',()=>{
    const root=document.getElementById('lessonDetail');
    if(root){observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(sync,35);});observer.observe(root,{childList:true,subtree:true});}
    sync();
  });
  window.addEventListener('load',sync);
  window.BJT_AUDIO_REPLAY={replay,sync};
})();