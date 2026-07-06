(() => {
  'use strict';
  const observer=new MutationObserver(()=>{
    const frame=document.querySelector('#meet iframe');
    if(!frame||frame.dataset.loungeObserved)return;
    frame.dataset.loungeObserved='1';
    frame.addEventListener('load',()=>{
      window.setTimeout(()=>{
        const cover=document.getElementById('loadingCover');
        const sub=document.getElementById('roomSub');
        if(cover&&!cover.classList.contains('hidden')){
          cover.classList.add('hidden');
          if(sub)sub.textContent='Đang kết nối hoặc chờ được vào phòng...';
        }
      },900);
    });
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
