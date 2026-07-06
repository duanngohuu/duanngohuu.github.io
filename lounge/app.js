(() => {
  'use strict';
  const root=document.getElementById('app');
  let currentProfile=null;
  let toastTimer=null;
  const escapeHtml=value=>String(value||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const $=id=>document.getElementById(id);

  root.innerHTML=`<div class="app">
    <header class="topbar glass">
      <a class="brand" href="/"><span class="brand-mark">話</span><span class="brand-text"><strong>Nihongo Lounge</strong><small>Tám gẫu tiếng Nhật · một phòng chung</small></span></a>
      <div class="top-actions"><span id="globalStatus" class="status-dot"></span><span id="globalText" class="top-btn hide-mobile">Chưa kết nối</span><a class="top-btn" href="/">Trang chủ</a></div>
    </header>
    <main class="shell">
      ${window.LoungeProfile.markup()}
      <section id="roomScreen" class="room-layout hidden">
        <article class="meeting-card glass">
          <div class="meeting-head"><div class="meeting-title"><strong>日本語で話そう！ · Main Lounge</strong><small id="roomSub">Đang chuẩn bị kết nối...</small></div><span id="roomCount" class="count-pill">0 / 100</span></div>
          <div id="meet"><div id="loadingCover" class="loading-cover"><div><div class="spinner"></div><strong>Đang kết nối phòng chung</strong><p>Hệ thống đang kiểm tra nickname, số người trong phòng và quyền thiết bị.</p></div></div></div>
        </article>
        <aside class="side-card glass">
          <div class="side-tabs"><button class="tab-btn active" data-tab="people">Mọi người</button><button class="tab-btn" data-tab="chat">Chat</button><button class="tab-btn" data-tab="reaction">Biểu cảm</button></div>
          <section id="tab-people" class="tab-panel active"><div class="people-head"><strong>Người đang online</strong><span id="peopleCount" class="count-pill">0</span></div><div id="peopleList" class="people-list"></div></section>
          <section id="tab-chat" class="tab-panel"><div id="chatLog" class="chat-log"><div class="system-msg">Dùng <b>@nickname nội_dung</b> để gửi riêng tư.</div></div><div class="chat-compose"><div class="chat-hint">Ví dụ: @Duan99 はじめまして！</div><div class="compose-row"><textarea id="chatInput" class="chat-input" maxlength="600" placeholder="Nhập tin nhắn..."></textarea><button id="sendBtn" class="send-btn">➤</button></div></div></section>
          <section id="tab-reaction" class="tab-panel"><div class="reaction-grid">${['👏','👍','❤️','😂','🎉','🤔','🙇','すごい'].map(x=>`<button class="reaction-btn">${x}</button>`).join('')}</div><p class="reaction-copy">Biểu cảm sẽ nổi trên màn hình của mọi người. Jitsi cũng có reaction riêng trong thanh công cụ.</p><div class="profile-box"><div class="profile-line"><span>Nickname hiện tại</span><strong id="profileNick">-</strong></div><div class="profile-line"><span>Trình độ</span><strong id="profileLevel">-</strong></div><div class="profile-line"><span>Lời chào</span><strong id="profileMessage">-</strong></div></div><button id="leaveBtn" class="danger-btn">Rời phòng</button></section>
        </aside>
      </section>
      <section id="exitScreen" class="exit-screen glass hidden"><div id="exitIcon" class="big">👋</div><h2 id="exitTitle">Đã rời phòng</h2><p id="exitText">Hẹn gặp lại trong lần luyện nói tiếp theo.</p><div class="exit-actions"><button id="retryBtn" class="primary">Kết nối lại</button><button id="editBtn">Đổi hồ sơ</button><a href="/">Trang chủ</a></div></section>
    </main>
  </div><div id="toast" class="toast"></div>`;

  function notice(text){
    const el=$('toast');el.textContent=text;el.classList.add('show');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3000);
  }
  function status(type,text){$('globalStatus').className='status-dot'+(type?' '+type:'');$('globalText').textContent=text;}
  function showOnly(id){['joinScreen','roomScreen','exitScreen'].forEach(x=>$(x).classList.toggle('hidden',x!==id));window.scrollTo({top:0,behavior:'instant'});}
  function showRoom(profile){
    showOnly('roomScreen');$('loadingCover').classList.remove('hidden');$('roomSub').textContent='Đang chuẩn bị kết nối...';
    $('profileNick').textContent=profile.nickname;$('profileLevel').textContent=profile.level;$('profileMessage').textContent=profile.message;
  }
  function showExit(kind,title,text){
    const icons={full:'⏳',duplicate:'🪪',left:'👋',error:'⚠️'};
    $('exitIcon').textContent=icons[kind]||'👋';$('exitTitle').textContent=title;$('exitText').textContent=text;showOnly('exitScreen');status('',title);
  }
  function showJoin(){window.LoungeConference.dispose();showOnly('joinScreen');status('','Chưa kết nối');}
  function count(value,limit){$('roomCount').textContent=`${value} / ${limit}`;$('peopleCount').textContent=String(value);$('roomCount').classList.toggle('full',value>=limit);}
  function participants(list,localId){
    const box=$('peopleList');
    box.innerHTML=list.map(p=>{const self=p.id===localId;const initial=escapeHtml(p.displayName.slice(0,2).toUpperCase());return `<div class="person-row"><div class="avatar">${initial}</div><div class="person-meta"><strong>${escapeHtml(p.displayName)}${self?' (Bạn)':''}</strong><small>${p.role==='moderator'?'Điều phối phòng':'Đang online'}</small></div>${self?'':`<button class="mention" data-name="${escapeHtml(p.displayName)}">@chat</button>`}</div>`;}).join('')||'<div class="system-msg">Đang tải danh sách...</div>';
    box.querySelectorAll('[data-name]').forEach(button=>button.addEventListener('click',()=>{activateTab('chat');$('chatInput').value='@'+button.dataset.name+' ';$('chatInput').focus();}));
  }
  function appendMessage(data){
    if(!data.message)return;
    const wrap=document.createElement('div');wrap.className='msg'+(data.mine?' mine':'')+(data.privateMessage?' private':'');
    const head=document.createElement('div');head.className='msg-head';head.textContent=(data.privateMessage?'🔒 ':'')+(data.mine?'Bạn':data.nick)+(data.privateMessage?' · riêng tư':'');
    const bubble=document.createElement('div');bubble.className='msg-bubble';bubble.textContent=data.message;
    wrap.append(head,bubble);$('chatLog').appendChild(wrap);$('chatLog').scrollTop=$('chatLog').scrollHeight;
  }
  function reaction(emoji,nick){
    const el=document.createElement('div');el.className='reaction-float';el.textContent=emoji;el.title=nick||'';el.style.left=(35+Math.random()*30)+'%';document.body.appendChild(el);setTimeout(()=>el.remove(),2300);
  }
  function activateTab(name,scroll=true){
    document.querySelectorAll('.tab-btn').forEach(x=>x.classList.toggle('active',x.dataset.tab===name));
    document.querySelectorAll('.tab-panel').forEach(x=>x.classList.toggle('active',x.id==='tab-'+name));
    if(scroll&&innerWidth<981)document.querySelector('.side-card')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function connect(profile){
    currentProfile=profile;window.LoungeProfile.save(profile);window.LoungeMedia.stop();showRoom(profile);
    try{
      window.LoungeConference.start({profile,mount:$('meet'),callbacks:{
        onStatus:status,onCount:count,onParticipants:participants,onMessage:appendMessage,onReaction:reaction,onNotice:notice,
        onReady:()=>{$('loadingCover').classList.add('hidden');$('roomSub').textContent='Đã vào phòng · mic đang tắt để tránh ồn';},
        onExit:showExit
      }});
    }catch(error){showExit('error','Không thể mở phòng',error.message||'Vui lòng kiểm tra kết nối rồi thử lại.');}
  }

  window.LoungeProfile.fill(window.LoungeProfile.load());
  status('','Chưa kết nối');
  $('permissionBtn').addEventListener('click',()=>window.LoungeMedia.check(notice));
  $('joinForm').addEventListener('submit',event=>{
    event.preventDefault();const profile=window.LoungeProfile.read();const error=window.LoungeProfile.validate(profile);$('formError').textContent=error;if(error)return;connect(profile);
  });
  document.querySelectorAll('.tab-btn').forEach(button=>button.addEventListener('click',()=>activateTab(button.dataset.tab)));
  $('sendBtn').addEventListener('click',async()=>{const result=await window.LoungeConference.sendChat($('chatInput').value);if(result.ok)$('chatInput').value='';else if(result.error)notice(result.error);});
  $('chatInput').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();$('sendBtn').click();}});
  document.querySelectorAll('.reaction-btn').forEach(button=>button.addEventListener('click',()=>window.LoungeConference.react(button.textContent.trim())));
  $('leaveBtn').addEventListener('click',()=>window.LoungeConference.leave());
  $('retryBtn').addEventListener('click',()=>connect(currentProfile||window.LoungeProfile.read()));
  $('editBtn').addEventListener('click',showJoin);
  addEventListener('beforeunload',()=>{window.LoungeMedia.stop();window.LoungeConference.dispose();});
})();
