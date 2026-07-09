(()=>{
  let timer;
  function sync(){
    const hasBar=Boolean(document.querySelector('.study-audio-bar'));
    if(hasBar)return;
    const audio=window.BJT_AUDIO?.getAudio?.();
    if(audio&&!audio.paused)audio.pause();
    document.querySelectorAll('.audio-floating-player').forEach(el=>el.hidden=true);
    document.body.classList.remove('audio-is-playing');
    window.BJT_AUDIO?.closePicker?.();
    window.BJT_AUDIO?.closeScript?.();
  }
  window.addEventListener('DOMContentLoaded',()=>{
    const root=document.getElementById('lessonDetail');
    if(!root)return;
    new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(sync,30);}).observe(root,{childList:true});
    sync();
  });
  window.addEventListener('load',sync);
})();