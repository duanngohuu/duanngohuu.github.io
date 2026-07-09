(()=>{
  const setStatus=text=>{const el=document.getElementById('audioStatus');if(el)el.textContent=text;};
  const hideAuthRow=()=>{
    document.querySelectorAll('.audio-auth-row').forEach(el=>el.style.display='none');
    document.querySelectorAll('.audio-auth-badge').forEach(el=>{if(!el.classList.contains('connected'))el.textContent='Google session';});
  };
  const busy=(button,on)=>{
    if(!button)return;
    button.disabled=on;
    if(on)button.dataset.originalText=button.textContent;
    button.textContent=on?'Đang kết nối…':(button.dataset.originalText||button.textContent);
  };
  const authorizeThen=async(button,action)=>{
    busy(button,true);
    setStatus('Đang dùng tài khoản Google đã đăng nhập để xin quyền đọc Drive…');
    try{
      await window.BJT_AUDIO.authorizeGoogle();
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

  new MutationObserver(hideAuthRow).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',hideAuthRow);
})();