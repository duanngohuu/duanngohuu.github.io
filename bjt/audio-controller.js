(()=>{
  const {state}=BJT;
  const norm=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const driveId=url=>String(url||'').match(/\/d\/([^/?#]+)/)?.[1]||String(url||'').match(/[?&]id=([^&#]+)/)?.[1]||'';
  const preview=url=>{const id=driveId(url);return id?`https://drive.google.com/file/d/${id}/preview`:''};
  const selectedKey=id=>`bjtAudioSelected:${id}`;
  const modeKey=id=>`bjtAudioMode:${id}`;
  const loopKey=id=>`bjtAudioLoop:${id}`;
  const abKey=id=>`bjtAudioAB:${id}`;
  const clientIdKey='bjtGoogleClientId';
  const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.readonly';

  let mediaList=[],currentIndex=0,currentLessonId='',observer,enhanceTimer,picker,scriptSheet,authSheet,floatBar;
  let audio=null,objectUrl='',accessToken='',tokenExpiresAt=0,tokenClient=null,authResolver=null,loadSeq=0;
  let loopMode='off',pointA=0,pointB=0,wasPlaying=false;

  const lesson=()=>state.lessons.find(x=>x.lesson_id===state.lessonId);
  const selectedQuestion=()=>state.questions.find(x=>x.question_id===state.questionId);
  const currentMedia=()=>mediaList[currentIndex];
  const clientId=()=>window.BJT_GOOGLE_CLIENT_ID||localStorage.getItem(clientIdKey)||'';
  const listForLesson=l=>state.media.filter(m=>m.media_type==='audio'&&m.lesson_id===l.lesson_id).sort((a,b)=>(+a.sort_order||0)-(+b.sort_order||0));

  function requestedIndex(list,l){
    const mode=localStorage.getItem(modeKey(l.lesson_id))||'question';
    if(mode==='question'){
      const label=selectedQuestion()?.audio_track;
      const i=list.findIndex(m=>norm(m.track_label)===norm(label)||norm(m.file_name)===norm(label));
      if(i>=0)return i;
    }
    const saved=localStorage.getItem(selectedKey(l.lesson_id));
    const i=list.findIndex(m=>m.media_id===saved);
    return i>=0?i:0;
  }
  function trackNo(m,i){const n=String(m?.track_label||m?.file_name||'').match(/(\d{1,3})(?=\D*$)/)?.[1];return n?String(+n).padStart(3,'0'):String(i+1).padStart(3,'0');}
  function groupName(m){return String(m?.track_label||m?.file_name||'Audio').match(/CD\s*\d+/i)?.[0]?.toUpperCase()||'TRACK';}
  function fmt(v,decimal=false){
    if(!Number.isFinite(v)||v<0)v=0;
    const min=Math.floor(v/60),sec=v-min*60;
    return `${String(min).padStart(2,'0')}:${decimal?sec.toFixed(1).padStart(4,'0'):String(Math.floor(sec)).padStart(2,'0')}`;
  }
  function parseTime(v){
    const s=String(v||'').trim().replace(',','.');
    if(!s)return 0;
    if(s.includes(':')){const a=s.split(':').map(Number);return Math.max(0,(a.length===2?a[0]*60+a[1]:a[0]*3600+a[1]*60+a[2])||0);}
    return Math.max(0,Number(s)||0);
  }
  function setStatus(text){const e=document.getElementById('audioStatus');if(e)e.textContent=text;}
  function emit(){
    const m=currentMedia();
    window.dispatchEvent(new CustomEvent('bjt-audio-state',{detail:{lessonId:currentLessonId,index:currentIndex,total:mediaList.length,media:m,playing:Boolean(audio&&!audio.paused),time:audio?.currentTime||0,duration:audio?.duration||0,loopMode,pointA,pointB,secure:true,mode:localStorage.getItem(modeKey(currentLessonId))||'question'}}));
  }

  function loadLoopState(){
    loopMode=localStorage.getItem(loopKey(currentLessonId))||'off';
    try{const p=JSON.parse(localStorage.getItem(abKey(currentLessonId))||'{}');pointA=+p.a||0;pointB=+p.b||0;}catch{pointA=0;pointB=0;}
  }
  function saveAB(){localStorage.setItem(abKey(currentLessonId),JSON.stringify({a:pointA,b:pointB}));}
  function setLoop(mode){
    loopMode=['off','track','ab'].includes(mode)?mode:'off';
    localStorage.setItem(loopKey(currentLessonId),loopMode);
    if(audio)audio.loop=loopMode==='track';
    document.querySelectorAll('[data-loop-mode]').forEach(b=>b.classList.toggle('active',b.dataset.loopMode===loopMode));
    const ab=document.getElementById('audioABControls');if(ab)ab.hidden=loopMode!=='ab';
    updateControls();emit();
  }

  function waitForGIS(){
    return new Promise((resolve,reject)=>{
      const started=Date.now();
      const check=()=>{
        if(window.google?.accounts?.oauth2)return resolve();
        if(Date.now()-started>10000)return reject(new Error('Google Identity Services chưa tải được.'));
        setTimeout(check,100);
      };check();
    });
  }
  async function requestToken(){
    if(accessToken&&Date.now()<tokenExpiresAt-60000)return accessToken;
    const id=clientId();
    if(!id){openAuthSheet();throw new Error('Chưa cấu hình OAuth Client ID.');}
    await waitForGIS();
    return new Promise((resolve,reject)=>{
      authResolver={resolve,reject};
      tokenClient=google.accounts.oauth2.initTokenClient({
        client_id:id,scope:DRIVE_SCOPE,
        callback:r=>{
          if(r.error){authResolver=null;reject(new Error(r.error_description||r.error));return;}
          accessToken=r.access_token;tokenExpiresAt=Date.now()+(+(r.expires_in||3600))*1000;authResolver=null;closeAuthSheet();updateAuthUI();resolve(accessToken);
        },
        error_callback:e=>{authResolver=null;reject(new Error(e?.message||'Không đăng nhập được Google Drive.'));}
      });
      tokenClient.requestAccessToken({prompt:accessToken?'':'select_account'});
    });
  }
  function clearBlob(){if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl='';}}
  async function fetchAudioBlob(media,retry=true){
    const id=driveId(media?.file_url);if(!id)throw new Error('Không tìm thấy Drive file ID.');
    const token=await requestToken();
    const res=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`,{headers:{Authorization:`Bearer ${token}`}});
    if(res.status===401&&retry){accessToken='';tokenExpiresAt=0;return fetchAudioBlob(media,false);}
    if(!res.ok)throw new Error(res.status===403?'Email Google này chưa được cấp quyền file audio.':`Không tải được audio (${res.status}).`);
    return res.blob();
  }

  function createAudio(){
    audio=document.createElement('audio');audio.id='bjtNativeAudio';audio.preload='metadata';audio.playsInline=true;
    audio.addEventListener('loadedmetadata',()=>{
      if(!pointB||pointB>audio.duration)pointB=audio.duration||0;
      if(pointA>=pointB)pointA=0;
      audio.loop=loopMode==='track';saveAB();updateControls();emit();
    });
    audio.addEventListener('timeupdate',()=>{
      if(loopMode==='ab'&&pointB>pointA&&audio.currentTime>=pointB-.035){audio.currentTime=pointA;audio.play().catch(()=>{});}
      updateControls();emit();
    });
    audio.addEventListener('play',()=>{document.body.classList.add('audio-is-playing');showFloat(true);updateControls();emit();});
    audio.addEventListener('pause',()=>{document.body.classList.remove('audio-is-playing');showFloat(false);updateControls();emit();});
    audio.addEventListener('ended',async()=>{
      if(loopMode!=='off')return;
      const mode=localStorage.getItem(modeKey(currentLessonId))||'question';
      if(mode==='full'&&currentIndex<mediaList.length-1)await renderMedia(currentIndex+1,{autoplay:true});
    });
    audio.addEventListener('error',()=>{setStatus('Không đọc được audio đã tải.');updateControls();});
    document.getElementById('audioPlayerHost')?.appendChild(audio);
    return audio;
  }

  async function renderMedia(index,{autoplay=false}={}){
    if(!mediaList.length)return;
    const seq=++loadSeq;
    wasPlaying=autoplay||Boolean(audio&&!audio.paused);
    currentIndex=Math.min(mediaList.length-1,Math.max(0,index));
    const m=currentMedia();localStorage.setItem(selectedKey(currentLessonId),m.media_id);
    const host=document.getElementById('audioPlayerHost');if(!host)return;
    audio?.pause();clearBlob();
    host.innerHTML=`<div class="audio-loading"><span></span><b>${esc(m.track_label||m.file_name)}</b><small>Nhấn Play hoặc Kết nối Drive để tải audio có quyền.</small></div><details class="audio-preview-fallback"><summary>Phát tạm bằng Drive Preview</summary><iframe src="${esc(preview(m.file_url))}" allow="autoplay; encrypted-media" title="Audio Google Drive"></iframe></details>`;
    audio=null;updateTrackLabels();updateScriptButton();setStatus(`${m.track_label||m.file_name} · ${currentIndex+1}/${mediaList.length}`);syncPicker();emit();
    if(!autoplay&&!(accessToken&&Date.now()<tokenExpiresAt-60000))return;
    try{
      setStatus(`Đang tải ${m.track_label||m.file_name} từ Drive…`);
      const blob=await fetchAudioBlob(m);if(seq!==loadSeq)return;
      objectUrl=URL.createObjectURL(blob);host.innerHTML='';createAudio();audio.src=objectUrl;audio.load();
      setStatus(`${m.track_label||m.file_name} · đã sẵn sàng`);
      if(wasPlaying)await audio.play().catch(()=>{});
    }catch(e){if(seq!==loadSeq)return;setStatus(e.message);host.querySelector('.audio-loading small').textContent=e.message;updateAuthUI();}
  }
  async function ensureLoaded({autoplay=false}={}){
    if(audio?.src){if(autoplay)await audio.play();return audio;}
    await renderMedia(currentIndex,{autoplay});return audio;
  }
  async function toggle(){
    try{
      if(!audio){await ensureLoaded({autoplay:true});return;}
      if(audio.paused)await audio.play();else audio.pause();
    }catch(e){setStatus(e.message);}
  }
  async function step(delta){
    if(!mediaList.length)return;
    const autoplay=Boolean(audio&&!audio.paused)||wasPlaying;
    const next=Math.min(mediaList.length-1,Math.max(0,currentIndex+delta));
    if(next===currentIndex)return;
    await renderMedia(next,{autoplay});
  }
  async function selectMedia(id,{close=true,autoplay=false}={}){
    const i=mediaList.findIndex(m=>m.media_id===id);if(i<0)return;
    await renderMedia(i,{autoplay});if(close)closePicker();
  }
  async function connectDrive(){
    try{await requestToken();await renderMedia(currentIndex,{autoplay:false});setStatus('Đã kết nối Google Drive · có thể lặp A–B.');}
    catch(e){setStatus(e.message);}
  }
  function seek(v){if(!audio||!Number.isFinite(audio.duration))return;audio.currentTime=Math.max(0,Math.min(audio.duration,+v||0));updateControls();}
  function setPoint(which,value){
    const n=Math.max(0,parseTime(value));
    if(which==='a')pointA=Math.min(n,Math.max(0,(audio?.duration||n)-.1));
    else pointB=Math.min(n,audio?.duration||n);
    if(pointB&&pointA>=pointB){if(which==='a')pointB=Math.min(audio?.duration||pointA+.5,pointA+.5);else pointA=Math.max(0,pointB-.5);}
    saveAB();updateControls();emit();
  }

  function setMode(mode){
    if(!currentLessonId)return;
    localStorage.setItem(modeKey(currentLessonId),mode);
    document.querySelectorAll('[data-audio-mode]').forEach(b=>b.classList.toggle('active',b.dataset.audioMode===mode));
    if(mode==='question')renderMedia(requestedIndex(mediaList,lesson()),{autoplay:false});
    if(mode==='full')renderMedia(0,{autoplay:false});
    syncPicker();emit();
  }
  function updateTrackLabels(){
    const m=currentMedia();
    const button=document.getElementById('audioOpenPicker');
    if(button&&m)button.innerHTML=`<span>${trackNo(m,currentIndex)}</span><b>${esc(m.track_label||m.file_name)}</b><i>${currentIndex+1}/${mediaList.length}</i>`;
    if(floatBar&&m){floatBar.querySelector('.float-audio-track').textContent=`${trackNo(m,currentIndex)} · ${m.track_label||m.file_name}`;}
  }
  function updateAuthUI(){
    const b=document.getElementById('audioConnectDrive');if(!b)return;
    b.textContent=accessToken&&Date.now()<tokenExpiresAt-60000?'✓ Drive':'Kết nối Drive';
    b.classList.toggle('connected',Boolean(accessToken&&Date.now()<tokenExpiresAt-60000));
  }
  function updateControls(){
    const now=audio?.currentTime||0,dur=audio?.duration||0,playing=Boolean(audio&&!audio.paused);
    document.querySelectorAll('[data-audio-play]').forEach(b=>b.textContent=playing?'❚❚':'▶');
    document.querySelectorAll('[data-audio-time]').forEach(e=>e.textContent=`${fmt(now)} / ${fmt(dur)}`);
    document.querySelectorAll('[data-audio-seek]').forEach(r=>{r.max=dur||0;r.value=now;});
    const a=document.getElementById('audioPointA'),b=document.getElementById('audioPointB');
    if(a&&document.activeElement!==a)a.value=fmt(pointA,true);if(b&&document.activeElement!==b)b.value=fmt(pointB,true);
    const loopLabel=loopMode==='track'?'Lặp track':loopMode==='ab'?`A–B ${fmt(pointA)}–${fmt(pointB)}`:'Không lặp';
    document.querySelectorAll('[data-loop-label]').forEach(e=>e.textContent=loopLabel);
    document.querySelectorAll('[data-loop-mode]').forEach(x=>x.classList.toggle('active',x.dataset.loopMode===loopMode));
  }

  function questionForMedia(m=currentMedia()){
    if(!m)return null;
    const exact=state.questions.find(q=>q.book_id===state.bookId&&norm(q.audio_track)===norm(m.track_label));
    if(exact)return exact;
    const n=String(m.track_label||m.file_name||'').match(/(\d{1,3})(?=\D*$)/)?.[1];
    return n?state.questions.find(q=>q.book_id===state.bookId&&String(q.audio_track||'').match(/(\d{1,3})(?=\D*$)/)?.[1]===n):null;
  }
  function scriptText(q){
    if(!q)return'';
    const options=[q.option_1_z,q.option_2_x,q.option_3_c,q.option_4_v].filter(Boolean).map((x,i)=>`${i+1}. ${x}`).join('\n');
    return [q.prompt_jp,q.script_jp||options].filter(Boolean).join('\n\n');
  }
  function ensureScriptSheet(){
    if(scriptSheet&&document.body.contains(scriptSheet))return scriptSheet;
    scriptSheet=document.createElement('div');scriptSheet.className='script-overlay';scriptSheet.hidden=true;
    scriptSheet.innerHTML='<section class="script-sheet" role="dialog" aria-modal="true"><header><div><strong id="scriptTitle">Script nghe</strong><small id="scriptMeta"></small></div><button id="scriptClose" type="button">×</button></header><div class="script-toolbar"><button id="scriptPlay" type="button">▶ Nghe</button><button id="scriptSetA" type="button">A = hiện tại</button><button id="scriptSetB" type="button">B = hiện tại</button></div><article id="scriptContent"></article><footer><span>Dữ liệu lấy từ tab SCRIPT/QUESTIONS của Google Sheet.</span><button id="scriptPdf" type="button">Tới PDF</button></footer></section>';
    document.body.appendChild(scriptSheet);
    scriptSheet.onclick=e=>{if(e.target===scriptSheet)closeScript();};
    scriptSheet.querySelector('#scriptClose').onclick=closeScript;
    scriptSheet.querySelector('#scriptPlay').onclick=toggle;
    scriptSheet.querySelector('#scriptSetA').onclick=()=>setPoint('a',audio?.currentTime||0);
    scriptSheet.querySelector('#scriptSetB').onclick=()=>setPoint('b',audio?.currentTime||0);
    scriptSheet.querySelector('#scriptPdf').onclick=()=>{closeScript();document.getElementById('pdfPane')?.scrollIntoView({behavior:'smooth',block:'start'});};
    return scriptSheet;
  }
  function updateScriptButton(){
    const q=questionForMedia();
    document.querySelectorAll('[data-script-open]').forEach(b=>{b.disabled=!q;b.classList.toggle('available',Boolean(q));});
    if(scriptSheet&&!scriptSheet.hidden)fillScript();
  }
  function fillScript(){
    const s=ensureScriptSheet(),q=questionForMedia(),m=currentMedia();
    s.querySelector('#scriptTitle').textContent=q?`Q${q.question_no} · ${q.section_title}`:'Chưa có script cho track này';
    s.querySelector('#scriptMeta').textContent=m?`${m.track_label||m.file_name} · ${q?`PDF trang ${q.pdf_page}`:'intro/track phụ'}`:'';
    const content=s.querySelector('#scriptContent');
    if(!q){content.innerHTML='<div class="script-empty">Track này chưa có dòng tương ứng trong dữ liệu câu hỏi.</div>';return;}
    const text=scriptText(q);content.innerHTML=`<div class="script-prompt">${esc(q.prompt_jp||'')}</div>${q.script_jp?`<div class="script-body">${esc(q.script_jp)}</div>`:`<div class="script-options"><small>Phần được đọc / lựa chọn</small>${[q.option_1_z,q.option_2_x,q.option_3_c,q.option_4_v].filter(Boolean).map((x,i)=>`<p><b>${i+1}</b>${esc(x)}</p>`).join('')}</div>`}`;
  }
  function openScript(){const s=ensureScriptSheet();fillScript();s.hidden=false;document.body.classList.add('audio-sheet-open');}
  function closeScript(){if(!scriptSheet)return;scriptSheet.hidden=true;document.body.classList.remove('audio-sheet-open');}

  function ensureAuthSheet(){
    if(authSheet&&document.body.contains(authSheet))return authSheet;
    authSheet=document.createElement('div');authSheet.className='audio-auth-overlay';authSheet.hidden=true;
    authSheet.innerHTML='<section class="audio-auth-sheet" role="dialog" aria-modal="true"><header><strong>Kết nối Google Drive</strong><button id="authClose" type="button">×</button></header><p>Để hiện thời gian và lặp A–B với file Drive Restricted, web phải đọc file bằng Google OAuth. Access token chỉ giữ trong bộ nhớ tab.</p><label>OAuth Web Client ID<input id="authClientId" placeholder="...apps.googleusercontent.com"></label><small>Authorized JavaScript origin: <b>https://duanngohuu.github.io</b></small><div><button id="authSave" type="button">Lưu và đăng nhập Google</button><button id="authClear" type="button">Xoá cấu hình</button></div></section>';
    document.body.appendChild(authSheet);
    authSheet.onclick=e=>{if(e.target===authSheet)closeAuthSheet();};authSheet.querySelector('#authClose').onclick=closeAuthSheet;
    authSheet.querySelector('#authSave').onclick=async()=>{
      const value=authSheet.querySelector('#authClientId').value.trim();
      if(!/\.apps\.googleusercontent\.com$/.test(value)){authSheet.querySelector('p').textContent='Client ID không đúng định dạng ...apps.googleusercontent.com';return;}
      localStorage.setItem(clientIdKey,value);tokenClient=null;accessToken='';tokenExpiresAt=0;
      try{await connectDrive();}catch{}
    };
    authSheet.querySelector('#authClear').onclick=()=>{localStorage.removeItem(clientIdKey);accessToken='';tokenExpiresAt=0;tokenClient=null;authSheet.querySelector('#authClientId').value='';updateAuthUI();};
    return authSheet;
  }
  function openAuthSheet(){const s=ensureAuthSheet();s.querySelector('#authClientId').value=clientId();s.hidden=false;document.body.classList.add('audio-sheet-open');}
  function closeAuthSheet(){if(!authSheet)return;authSheet.hidden=true;document.body.classList.remove('audio-sheet-open');}

  function ensureFloat(){
    if(floatBar&&document.body.contains(floatBar))return floatBar;
    floatBar=document.createElement('div');floatBar.id='audioFloatingPlayer';floatBar.className='audio-floating-player';floatBar.hidden=true;
    floatBar.innerHTML='<button class="float-audio-play" data-audio-play type="button">▶</button><div class="float-audio-main"><strong class="float-audio-track">Audio</strong><input data-audio-seek type="range" min="0" max="0" step="0.05" value="0"></div><button class="float-audio-time" data-audio-time type="button">00:00 / 00:00</button><button class="float-audio-loop" data-loop-label type="button">Không lặp</button><button class="float-audio-script" data-script-open type="button">Script</button>';
    document.body.appendChild(floatBar);
    floatBar.querySelector('[data-audio-play]').onclick=toggle;
    floatBar.querySelector('[data-audio-seek]').oninput=e=>seek(e.target.value);
    floatBar.querySelector('[data-audio-time]').onclick=()=>document.getElementById('studyAudioBar')?.scrollIntoView({behavior:'smooth',block:'start'});
    floatBar.querySelector('[data-loop-label]').onclick=()=>setLoop(loopMode==='off'?'track':loopMode==='track'?'ab':'off');
    floatBar.querySelector('[data-script-open]').onclick=openScript;
    return floatBar;
  }
  function showFloat(show){const f=ensureFloat();f.hidden=!show;updateTrackLabels();updateScriptButton();updateControls();}

  function ensurePicker(){
    if(picker&&document.body.contains(picker))return picker;
    picker=document.createElement('div');picker.id='audioTrackPicker';picker.className='audio-picker-overlay';picker.hidden=true;
    picker.innerHTML='<section class="audio-picker-sheet" role="dialog" aria-modal="true"><header><div><strong>Chọn track audio</strong><small id="audioPickerMeta"></small></div><button id="audioPickerClose" type="button">×</button></header><div class="audio-picker-tools"><label>⌕ <input id="audioPickerSearch" placeholder="Nhập 26, CD1-26, tên file…" inputmode="search"></label><div class="audio-picker-mode"><button type="button" data-picker-mode="question">Theo câu</button><button type="button" data-picker-mode="full">Từ đầu bài</button></div></div><div id="audioPickerList" class="audio-picker-list"></div></section>';
    document.body.appendChild(picker);picker.onclick=e=>{if(e.target===picker)closePicker();};picker.querySelector('#audioPickerClose').onclick=closePicker;picker.querySelector('#audioPickerSearch').oninput=renderPickerList;picker.querySelectorAll('[data-picker-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.pickerMode));return picker;
  }
  function renderPickerList(){
    const p=ensurePicker(),q=norm(p.querySelector('#audioPickerSearch').value);
    const visible=mediaList.map((m,i)=>({m,i})).filter(({m})=>!q||norm(`${m.track_label} ${m.file_name} ${trackNo(m,0)}`).includes(q));
    const groups=visible.reduce((a,x)=>((a[groupName(x.m)]??=[]).push(x),a),{}),host=p.querySelector('#audioPickerList');
    host.innerHTML=visible.length?Object.entries(groups).map(([g,items])=>`<section class="audio-picker-group"><h3>${esc(g)} <span>${items.length}</span></h3><div class="audio-track-grid">${items.map(({m,i})=>`<button type="button" data-track-id="${esc(m.media_id)}" class="${i===currentIndex?'active':''}"><b>${trackNo(m,i)}</b><small>${esc(m.track_label||m.file_name)}</small></button>`).join('')}</div></section>`).join(''):'<div class="audio-picker-empty">Không tìm thấy track.</div>';
    host.querySelectorAll('[data-track-id]').forEach(b=>b.onclick=()=>selectMedia(b.dataset.trackId,{close:true,autoplay:false}));
  }
  function syncPicker(){if(!picker||picker.hidden)return;const mode=localStorage.getItem(modeKey(currentLessonId))||'question';picker.querySelector('#audioPickerMeta').textContent=`${mediaList.length} track · đang chọn ${currentIndex+1}`;picker.querySelectorAll('[data-picker-mode]').forEach(b=>b.classList.toggle('active',b.dataset.pickerMode===mode));renderPickerList();}
  function openPicker(){const p=ensurePicker();p.hidden=false;document.body.classList.add('audio-sheet-open');p.querySelector('#audioPickerSearch').value='';syncPicker();setTimeout(()=>p.querySelector('#audioPickerSearch').focus({preventScroll:true}),80);}
  function closePicker(){if(!picker)return;picker.hidden=true;document.body.classList.remove('audio-sheet-open');}

  function bindMainControls(){
    document.querySelectorAll('[data-audio-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.audioMode));
    document.querySelectorAll('[data-loop-mode]').forEach(b=>b.onclick=()=>setLoop(b.dataset.loopMode));
    document.getElementById('audioOpenPicker').onclick=openPicker;
    document.getElementById('audioPrev').onclick=()=>step(-1);document.getElementById('audioNext').onclick=()=>step(1);
    document.getElementById('audioConnectDrive').onclick=()=>clientId()?connectDrive():openAuthSheet();
    document.getElementById('audioAuthSettings').onclick=openAuthSheet;
    document.querySelectorAll('[data-audio-play]').forEach(b=>b.onclick=toggle);
    document.querySelectorAll('[data-audio-seek]').forEach(r=>r.oninput=e=>seek(e.target.value));
    document.querySelectorAll('[data-script-open]').forEach(b=>b.onclick=openScript);
    document.getElementById('audioSetA').onclick=()=>setPoint('a',audio?.currentTime||0);
    document.getElementById('audioSetB').onclick=()=>setPoint('b',audio?.currentTime||0);
    document.getElementById('audioPointA').onchange=e=>setPoint('a',e.target.value);
    document.getElementById('audioPointB').onchange=e=>setPoint('b',e.target.value);
  }

  function enhance(){
    clearTimeout(enhanceTimer);
    const bar=document.querySelector('.study-audio-bar'),l=lesson();if(!bar||!l)return;
    if(bar.dataset.audioEnhanced===l.lesson_id)return;
    audio?.pause();clearBlob();audio=null;document.body.classList.remove('audio-is-playing');showFloat(false);
    mediaList=listForLesson(l);currentLessonId=l.lesson_id;currentIndex=requestedIndex(mediaList,l);loadLoopState();
    const mode=localStorage.getItem(modeKey(l.lesson_id))||'question',m=currentMedia();
    bar.id='studyAudioBar';bar.dataset.audioEnhanced=l.lesson_id;
    bar.innerHTML=`<div class="audio-controller-head"><div class="audio-info"><strong>♫ Audio luyện nghe <span class="audio-auth-badge">Drive Restricted</span></strong><small id="audioStatus">${mediaList.length?`${mediaList.length} track trong bài`:'Bài này chưa có track được map'}</small></div><div class="audio-mode"><button type="button" data-audio-mode="question" class="${mode==='question'?'active':''}">Theo câu</button><button type="button" data-audio-mode="full" class="${mode==='full'?'active':''}">Từ đầu bài</button></div></div><div class="audio-controller-row"><button id="audioPrev" class="audio-icon" type="button">‹</button><button id="audioOpenPicker" class="audio-track-button" type="button">${m?`<span>${trackNo(m,currentIndex)}</span><b>${esc(m.track_label||m.file_name)}</b><i>${currentIndex+1}/${mediaList.length}</i>`:'<b>Chưa có audio</b>'}</button><button id="audioNext" class="audio-icon" type="button">›</button></div><div class="audio-play-row"><button class="audio-play-main" data-audio-play type="button">▶</button><input class="audio-seek" data-audio-seek type="range" min="0" max="0" step="0.05" value="0"><span class="audio-time" data-audio-time>00:00 / 00:00</span><button class="audio-script-btn" data-script-open type="button">Script</button></div><div class="audio-loop-row"><div class="audio-loop-modes"><button data-loop-mode="off" type="button">Không lặp</button><button data-loop-mode="track" type="button">Lặp track</button><button data-loop-mode="ab" type="button">Lặp A–B</button></div><div id="audioABControls" class="audio-ab-controls" ${loopMode==='ab'?'':'hidden'}><label>A <input id="audioPointA" value="${fmt(pointA,true)}" inputmode="decimal"></label><button id="audioSetA" type="button">Đặt A</button><label>B <input id="audioPointB" value="${fmt(pointB,true)}" inputmode="decimal"></label><button id="audioSetB" type="button">Đặt B</button></div><div class="audio-auth-actions"><button id="audioConnectDrive" type="button">Kết nối Drive</button><button id="audioAuthSettings" type="button" aria-label="Cấu hình OAuth">⚙</button></div></div><div id="audioPlayerHost" class="audio-player-host">${mediaList.length?'':'<div class="audio-empty">Chưa có audio trong MEDIA.</div>'}</div>`;
    bindMainControls();ensureFloat();
    if(mediaList.length)renderMedia(currentIndex,{autoplay:false});
    updateAuthUI();updateControls();updateScriptButton();closePicker();closeScript();
  }

  observer=new MutationObserver(()=>{clearTimeout(enhanceTimer);enhanceTimer=setTimeout(enhance,40);});
  window.addEventListener('DOMContentLoaded',()=>{const root=document.getElementById('lessonDetail');if(root)observer.observe(root,{childList:true,subtree:true});});
  window.addEventListener('load',enhance);
  window.addEventListener('beforeunload',clearBlob);
  window.BJT_AUDIO={toggle,step,selectMedia,setMode,setLoop,openPicker,closePicker,openScript,closeScript,connectDrive,openAuthSheet,getList:()=>mediaList.slice(),getCurrent:currentMedia,getIndex:()=>currentIndex,getAudio:()=>audio,enhance};
})();