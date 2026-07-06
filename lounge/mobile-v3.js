(() => {
  'use strict';
  const media=window.matchMedia('(max-width:980px)');
  let initialized=false;

  function setup(){
    if(initialized||!media.matches)return;
    const room=document.getElementById('roomScreen');
    const side=document.querySelector('.side-card');
    if(!room||!side){window.setTimeout(setup,50);return;}
    initialized=true;
    document.body.classList.add('mobile-lounge');

    const backdrop=document.createElement('button');
    backdrop.type='button';
    backdrop.className='mobile-sheet-backdrop';
    backdrop.setAttribute('aria-label','Đóng bảng');

    const close=document.createElement('button');
    close.type='button';
    close.className='mobile-sheet-close';
    close.textContent='×';
    close.setAttribute('aria-label','Đóng');
    side.appendChild(close);

    const dock=document.createElement('div');
    dock.className='mobile-room-dock';
    dock.hidden=true;
    dock.innerHTML=`
      <button type="button" class="mobile-dock-btn" data-mobile-tab="people">👥 Người</button>
      <button type="button" class="mobile-dock-btn" data-mobile-tab="chat">💬 Chat</button>
      <button type="button" class="mobile-dock-btn" data-mobile-tab="reaction">✨ Biểu cảm</button>`;
    document.body.append(backdrop,dock);

    function activate(tab){
      const tabButton=document.querySelector(`.tab-btn[data-tab="${tab}"]`);
      tabButton?.click();
      side.classList.add('mobile-open');
      backdrop.classList.add('show');
      dock.querySelectorAll('[data-mobile-tab]').forEach(btn=>btn.classList.toggle('active',btn.dataset.mobileTab===tab));
      if(tab==='chat')window.setTimeout(()=>document.getElementById('chatInput')?.focus(),260);
    }
    function closeSheet(){
      side.classList.remove('mobile-open');
      backdrop.classList.remove('show');
      dock.querySelectorAll('[data-mobile-tab]').forEach(btn=>btn.classList.remove('active'));
    }
    function sync(){
      const inRoom=!room.classList.contains('hidden');
      dock.hidden=!inRoom;
      if(!inRoom)closeSheet();
    }

    dock.querySelectorAll('[data-mobile-tab]').forEach(btn=>btn.addEventListener('click',()=>activate(btn.dataset.mobileTab)));
    backdrop.addEventListener('click',closeSheet);
    close.addEventListener('click',closeSheet);
    document.addEventListener('keydown',event=>{if(event.key==='Escape')closeSheet();});
    new MutationObserver(sync).observe(room,{attributes:true,attributeFilter:['class']});
    sync();
  }

  setup();
  media.addEventListener?.('change',()=>{if(media.matches)setup();});
})();
