(()=>{
  const preparedBooks=new Set();
  const preparing=new Map();
  let observer,timer,allPreloadStarted=false;
  const setStatus=text=>{const el=document.getElementById('audioStatus');if(el&&el.textContent!==text)el.textContent=text;};
  const currentBook=()=>window.BJT?.state?.books?.find(b=>b.book_id===window.BJT?.state?.bookId);
  const hasAudio=book=>{
    const value=String(book?.audio_available??'').toLowerCase();
    return value==='true'||value==='1'||value==='yes'||(+book?.audio_track_count||0)>0;
  };
  const hideAuthRow=()=>{
    const connected=window.BJT_GOOGLE_SESSION?.hasValidToken?.();
    document.querySelectorAll('.audio-auth-row').forEach(el=>{if(el.style.display!=='none')el.style.display='none';});
    document.querySelectorAll('.audio-auth-badge').forEach(el=>{
      el.classList.toggle('connected',Boolean(connected));
      el.textContent=connected?'Google đã kết nối':'Google session';
    });
    document.querySelectorAll('.audio-session-note').forEach(el=>{
      el.textContent=connected
        ?'Phiên Drive đang được giữ trong tab này. Lần mở sau ứng dụng dùng lại phiên Google hiện có và không hỏi lại nếu Google cho phép.'
        :'Bấm Play một lần. Sau khi đã cấp quyền, lần sau ứng dụng sẽ thử kết nối lại tự động bằng phiên Google hiện có.';
    });
  };
  const busy=(button,on)=>{
    if(!button)return;
    button.disabled=on;
    if(on&&!button.dataset.originalText)button.dataset.originalText=button.textContent;
    button.textContent=on?'Đang nạp…':(button.dataset.originalText||'▶');
  };

  async function prepareBook(token,bookId=currentBook()?.book_id,force=false){
    const book=window.BJT?.state?.books?.find(b=>b.book_id===bookId);
    if(!hasAudio(book))return{loaded:false,count:0};
    if(preparedBooks.has(bookId)&&!force)return{loaded:true,cached:true,bookId};
    if(preparing.has(bookId))return preparing.get(bookId);
    const job=(async()=>{
      const result=await window.BJT_AUDIO_FOLDER?.ensureBook?.(token,bookId,{force});
      if(result?.loaded){preparedBooks.add(bookId);if(bookId===window.BJT?.state?.bookId)window.BJT_AUDIO_REPLAY?.sync?.();}
      return result;
    })().finally(()=>preparing.delete(bookId));
    preparing.set(bookId,job);
    return job;
  }

  function preloadAllBooks(token,currentId){
    if(allPreloadStarted||!token)return;
    allPreloadStarted=true;
    setTimeout(async()=>{
      try{
        const results=await window.BJT_AUDIO_FOLDER?.ensureAll?.(token,{skipBookId:currentId})||[];
        results.filter(x=>x?.loaded).forEach(x=>preparedBooks.add(x.bookId));
      }catch{}
    },120);
  }

  const authorizeThen=async(button,action)=>{
    busy(button,true);
    setStatus(window.BJT_GOOGLE_SESSION?.hasConsent?.()?'Đang khôi phục phiên Google Drive…':'Đang kết nối Google Drive…');
    try{
      const token=await window.BJT_AUDIO.authorizeGoogle();
      const bookId=currentBook()?.book_id||'';
      await prepareBook(token,bookId);
      preloadAllBooks(token,bookId);
      await action();
    }catch(error){
      setStatus(error?.message||'Không kết nối được Google Drive.');
    }finally{
      busy(button,false);
      hideAuthRow();
    }
  };

  async function preloadFromSavedToken(){
    window.BJT_AUDIO_FOLDER?.hydrateCachedBooks?.();
    const token=window.BJT_GOOGLE_SESSION?.getToken?.();
    const book=currentBook();
    if(!token||!hasAudio(book)||preparedBooks.has(book.book_id))return;
    try{
      setStatus('Đang khôi phục audio đã kết nối…');
      await prepareBook(token,book.book_id);
      preloadAllBooks(token,book.book_id);
    }catch(error){
      window.BJT_GOOGLE_SESSION?.clear?.();
      setStatus('Phiên ngắn hạn đã hết. Bấm Play để ứng dụng kết nối lại bằng tài khoản Google hiện có.');
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