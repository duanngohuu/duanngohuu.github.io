(()=>{
  const preparedBooks=new Set();
  const setStatus=text=>{const el=document.getElementById('audioStatus');if(el&&el.textContent!==text)el.textContent=text;};
  const hideAuthRow=()=>{
    document.querySelectorAll('.audio-auth-row').forEach(el=>{if(el.style.display!=='none')el.style.display='none';});
    document.querySelectorAll('.audio-auth-badge').forEach(el=>{
      if(!el.classList.contains('connected')&&el.textContent!=='Google session')el.textContent='Google session';
    });
  };
  const busy=(button,on)=>{
    if(!button)return;
    button.disabled=on;
    if(on&&!button.dataset.originalText)button.dataset.originalText=button.textContent;
    button.textContent=on?'Đang kết nối…':(button.dataset.originalText||'▶');
  };
  const authorizeThen=async(button,action)=>{
    busy(button,true);
    setStatus('Đang dùng tài khoản Google hiện tại để đọc kho audio…');
    try{
      const token=await window.BJT_AUDIO.authorizeGoogle();
      const bookId=window.BJT?.state?.bookId||'';
      if(bookId&&!preparedBooks.has(bookId)){
        if(bookId==='BUSINESS-BLUE')window.BJT_AUDIO_FOLDER?.clearCache?.(bookId);
        await window.BJT_AUDIO_FOLDER?.ensureCurrentLesson?.(token);
        preparedBooks.add(bookId);
      }
      await action();
    }catch(error){
      setStatus(error?.message||'Không kết nối được Google Drive.');
    }finally{
      busy(button,false);
      hideAuthRow();
    }
  };

  document.addEventListener('click',event=>{
    const play=event.target.closest('[data-audio-play]');
    if(play){
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      authorizeThen(play,()=>window.BJT_AUDIO.toggle());
      return;
    }

    const loop=event.target.closest('[data-audio-loop]');
    if(loop){
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const enable=!loop.classList.contains('active');
      if(!enable){window.BJT_AUDIO.setLoop(false,false);return;}
      authorizeThen(loop,()=>window.BJT_AUDIO.setLoop(true,true));
    }
  },true);

  window.addEventListener('bjt-audio-state',hideAuthRow);
  window.addEventListener('DOMContentLoaded',hideAuthRow);
  window.addEventListener('load',hideAuthRow);
})();