(()=>{
  'use strict';
  const state=window.BJT?.state;
  if(!state)return;
  let timer=0;

  const truthy=value=>['true','1','yes','y'].includes(String(value??'').trim().toLowerCase());
  const hasAudio=book=>Boolean(book&&(truthy(book.audio_available)||(+book.audio_track_count||0)>0));
  const currentBook=()=>state.books.find(book=>book.book_id===state.bookId);

  function syncGoogleUi(){
    const session=window.BJT_GOOGLE_SESSION;
    const valid=Boolean(session?.hasValidToken?.());
    const remembered=Boolean(session?.hasConsent?.()||session?.hasGranted?.());
    document.querySelectorAll('.audio-auth-badge').forEach(element=>{
      element.classList.toggle('connected',valid||remembered);
      element.textContent=valid?'Google đã kết nối':remembered?'Google đã nhớ':'Chưa kết nối';
    });
    document.querySelectorAll('.audio-session-note').forEach(element=>{
      element.textContent=valid
        ?'Phiên Drive đang được nhớ trên thiết bị này bằng access token ngắn hạn.'
        :remembered
          ?'Quyền Google đã được nhớ. Bấm Play để tự khôi phục bằng tài khoản Google đang đăng nhập; không cần chọn lại tài khoản nếu phiên Google còn hiệu lực.'
          :'Lần đầu cần cấp quyền đọc Drive. Ứng dụng không lưu mật khẩu hoặc cookie Google.';
    });
  }

  function decorate(){
    const books=state.books||[];
    const map=new Map(books.map(book=>[book.book_id,book]));
    document.querySelectorAll('.book-btn[data-id]').forEach(button=>{
      const book=map.get(button.dataset.id);
      const small=button.querySelector('small');
      if(!book||!small)return;
      const base=small.textContent.replace(/\s*·\s*(?:♫\s*(?:\d+|nhiều)\s*track|PDF đọc)$/i,'');
      small.textContent=hasAudio(book)
        ?`${base} · ♫ ${+book.audio_track_count||'nhiều'} track`
        :`${base} · PDF đọc`;
      button.classList.toggle('has-audio-book',hasAudio(book));
    });
    const book=currentBook();
    const badge=document.getElementById('bookBadge');
    if(book&&badge)badge.textContent=hasAudio(book)?`♫ ${+book.audio_track_count||'Audio'} track`:'PDF đọc';
    const audioCount=books.filter(hasAudio).length;
    const hero=document.querySelector('.hero p:not(.eyebrow)');
    if(hero&&books.length)hero.textContent=`Đủ ${books.length} giáo trình: ${audioCount} sách có audio, ${books.length-audioCount} sách đọc PDF.`;
    syncGoogleUi();
    window.BJT_AUDIO_FOLDER?.hydrateCachedBooks?.();
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(decorate,40);}

  const style=document.createElement('style');
  style.textContent=`
    .book-btn.has-audio-book strong::after{content:'♫';display:inline-flex;margin-left:.45rem;font-size:.78em;opacity:.8}
    .book-btn.has-audio-book small{font-weight:650}
  `;
  document.head.appendChild(style);

  window.addEventListener('bjt-audio-state',syncGoogleUi);
  window.addEventListener('bjt-audio-library-ready',schedule);
  window.addEventListener('storage',event=>{
    if(String(event.key||'').startsWith('bjtGoogleDrive')){syncGoogleUi();schedule();}
  });
  window.addEventListener('DOMContentLoaded',()=>{
    const list=document.getElementById('bookList');
    if(list)new MutationObserver(schedule).observe(list,{childList:true,subtree:true});
    const detail=document.getElementById('lessonDetail');
    if(detail)new MutationObserver(schedule).observe(detail,{childList:true,subtree:false});
    schedule();
  });
  window.addEventListener('load',schedule);
  window.BJT_AUDIO_CATALOG={decorate,syncGoogleUi};
})();