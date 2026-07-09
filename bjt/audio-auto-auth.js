(()=>{
  const preparedBooks=new Set();
  const preparing=new Map();
  let observer,timer;
  const setStatus=text=>{const el=document.getElementById('audioStatus');if(el&&el.textContent!==text)el.textContent=text;};
  const currentBook=()=>window.BJT?.state?.books?.find(b=>b.book_id===window.BJT?.state?.bookId);
  const hasAudio=book=>{
    const value=String(book?.audio_available??'').toLowerCase();
    return value==='true'||value==='1'||value==='yes'||(+book?.audio_track_count||0)>0;
  };
  const hideAuthRow=()=>{
    document.querySelectorAll('.audio-auth-row').forEach(el=>{if(el.style.display!=='none')el.style.display='none';});
    document.querySelectorAll('.audio-auth-badge').forEach(el=>{
      const connected=window.BJT_GOOGLE_SESSION?.hasValidToken?.();
      el.classList.toggle('connected',Boolean(connected));
      el.textContent=connected?'Google đã nhớ':'Google session';
    });
  };
  const busy=(button,on)=>{
    if(!button)return;
    button.disabled=on;
    if(on&&!button.dataset.originalText)button.dataset.originalText=button.textContent;
    button.textContent=on?'Đang nạp…':(button.dataset.originalText||'▶');
  };

  async function prepareBook(token,force=false){
    const book=currentBook();
    if(!hasAudio(book))return{loaded:false,count:0};
    const bookId=book.book_id;
    if(preparedBooks.has(bookId)&&!force)return{loaded:true,cached:true};
    if(preparing.has(bookId))return preparing.get(bookId);
    const job=(async()=>{
      const result=await window.BJT_AUDIO_FOLDER?.ensureCurrentLesson?.(token,{force});
      if(result?.loaded){preparedBooks.add(bookId);window.BJT_AUDIO_REPLAY?.sync?.();}
      return result;
    })().finally(()=>preparing.delete(bookId));
    preparing.set(bookId,job);
    return job;
  }

  const authorizeThen=async(button,action)=>{
    busy(button,true);
    setStatus('Đang dùng quyền Google Drive đã lưu…');
    try{
      const token=await window.BJT_AUDIO.authorizeGoogle();
      await prepareBook(token);
      await action();
    }catch(error){
      setStatus(error?.message||'Không kết nối được Google Drive.');
    }finally{
      busy(button,false);
      hideAuthRow();
    }
  };

  async function preloadFromSavedToken(){
    const token=window.BJT_GOOGLE_SESSION?.getToken?.();
    const book=currentBook();
    if(!token||!hasAudio(book)||preparedBooks.has(book.book_id))return;
    try{
      setStatus('Đang khôi phục audio đã kết nối…');
      await prepareBook(token);
    }catch(error){
      window.BJT_GOOGLE_SESSION?.clear?.();
      setStatus('Phiên Google đã hết hạn. Bấm Play để kết nối lại tự động.');
    }finally{hideAuthRow();}
  }

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
  window.addEventListener('bjt-audio-library-ready',hideAuthRow);
  window.addEventListener('DOMContentLoaded',()=>{
    hideAuthRow();
    const root=document.getElementById('lessonDetail');
    if(root){
      observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(preloadFromSavedToken,80);});
      observer.observe(root,{childList:true,subtree:false});
    }
    setTimeout(preloadFromSavedToken,200);
  });
  window.addEventListener('load',()=>{hideAuthRow();setTimeout(preloadFromSavedToken,120);});
  window.BJT_AUDIO_AUTH={prepareBook,preloadFromSavedToken,forget:()=>window.BJT_GOOGLE_SESSION?.forget?.()};
})();