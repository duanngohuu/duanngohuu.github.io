(()=>{
  const {state}=BJT;
  const norm=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const driveId=url=>String(url||'').match(/\/d\/([^/?#]+)/)?.[1]||String(url||'').match(/[?&]id=([^&#]+)/)?.[1]||'';
  const preview=url=>{const id=driveId(url);return id?`https://drive.google.com/file/d/${id}/preview`:''};
  const selectedKey=id=>`bjtAudioSelected:${id}`;
  const modeKey=id=>`bjtAudioMode:${id}`;
  const loopKey=id=>`bjtAudioLoop:${id}`;
  const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.readonly';

  let mediaList=[],currentIndex=0,currentLessonId='',observer,timer,picker,scriptSheet,floatBar;
  let audio=null,objectUrl='',accessToken='',tokenExpiresAt=0,tokenClient=null,loadingPromise=null,loadSeq=0;
  let loopEnabled=false,playIntent=false;

  const lesson=()=>state.lessons.find(x=>x.lesson_id===state.lessonId);
  const currentMedia=()=>mediaList[currentIndex];
  const selectedQuestion=()=>state.questions.find(x=>x.question_id===state.questionId);
  const listForLesson=l=>state.media.filter(m=>m.media_type==='audio'&&m.lesson_id===l.lesson_id).sort((a,b)=>(+a.sort_order||0)-(+b.sort_order||0));
  const clientId=()=>window.BJT_GOOGLE_CLIENT_ID||localStorage.getItem('bjtGoogleClientId')||'';

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
  function fmt(v){if(!Number.isFinite(v)||v<0)v=0;return `${String(Math.floor(v/60)).padStart(2,'0')}:${String(Math.floor(v%60)).padStart(2,'0')}`;}
  function setStatus(text){const e=document.getElementById('audioStatus');if(e)e.textContent=text;}
  function emit(){window.dispatchEvent(new CustomEvent('bjt-audio-state',{detail:{lessonId:currentLessonId,index:currentIndex,total:mediaList.length,media:currentMedia(),playing:Boolean(audio&&!audio.paused),time:audio?.currentTime||0,duration:audio?.duration||0,loop:loopEnabled,secure:true,native:Boolean(objectUrl)}}));}

  function clearObjectUrl(){if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl='';}}
  function resetAudio(){
    loadSeq++;loadingPromise=null;playIntent=false;
    if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio=null;}
    clearObjectUrl();showFloat(false);
  }
  function updateControls(){
    const playing=Boolean(audio&&!audio.paused),now=audio?.currentTime||0,dur=audio?.duration||0;
    document.querySelectorAll('[data-audio-play]').forEach(b=>b.textContent=playing?'❚❚':'▶');
    document.querySelectorAll('[data-audio-time]').forEach(e=>e.textContent=`${fmt(now)} / ${fmt(dur)}`);
    document.querySelectorAll('[data-audio-seek]').forEach(r=>{r.max=dur||0;r.value=now;});
    document.querySelectorAll('[data-audio-loop]').forEach(b=>{b.classList.toggle('active',loopEnabled);b.textContent=loopEnabled?'↻ Đang lặp':'↻ Lặp';b.disabled=false;});
    const m=currentMedia();if(floatBar&&m)floatBar.querySelector('.float-audio-track').textContent=`${trackNo(m,currentIndex)} · ${m.track_label||m.file_name}`;
  }
  function showFloat(show){const f=ensureFloat();f.hidden=!show;document.body.classList.toggle('audio-is-playing',show);updateControls();}
  function setBusy(busy,text=''){
    document.querySelectorAll('[data-audio-loop],[data-audio-play]').forEach(b=>b.disabled=busy);
    document.querySelectorAll('[data-audio-loop]').forEach(b=>{if(busy)b.textContent='Đang tải…';});
    if(text)setStatus(text);
  }

  function waitForGIS(){
    return new Promise((resolve,reject)=>{
      const started=Date.now();
      const check=()=>{
        if(window.google?.accounts?.oauth2)return resolve();
        if(Date.now()-started>10000)return reject(new Error('Không tải được Google Identity Services.'));
        setTimeout(check,100);
      };check();
    });
  }
  async function requestToken(){
    if(accessToken&&Date.now()<tokenExpiresAt-60000)return accessToken;
    const id=clientId();
    if(!id)throw new Error('Không tìm thấy cấu hình Google của app Flashcard trên trình duyệt này.');
    await waitForGIS();
    return new Promise((resolve,reject)=>{
      tokenClient=google.accounts.oauth2.initTokenClient({
        client_id:id,
        scope:DRIVE_SCOPE,
        callback:r=>{
          if(r.error){reject(new Error(r.error_description||r.error));return;}
          accessToken=r.access_token;tokenExpiresAt=Date.now()+(+(r.expires_in||3600))*1000;resolve(accessToken);
        },
        error_callback:e=>reject(new Error(e?.message||'Google không cấp quyền đọc Drive.'))
      });
      tokenClient.requestAccessToken({prompt:''});
    });
  }
  async function fetchCurrentBlob(seq){
    const m=currentMedia(),id=m?.drive_file_id||driveId(m?.file_url);if(!id)throw new Error('Track này chưa có Drive file ID.');
    let token=await requestToken();
    let res=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`,{headers:{Authorization:`Bearer ${token}`}});
    if(res.status===401){accessToken='';tokenExpiresAt=0;token=await requestToken();res=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`,{headers:{Authorization:`Bearer ${token}`}});}
    if(seq!==loadSeq)throw new DOMException('Track changed','AbortError');
    if(!res.ok){
      if(res.status===403)throw new Error('Google account hiện tại chưa có quyền file hoặc Drive API chưa được bật.');
      throw new Error(`Không tải được audio từ Drive (${res.status}).`);
    }
    return res.blob();
  }

  function bindAudio(el){
    el.loop=loopEnabled;
    el.addEventListener('loadedmetadata',()=>{setStatus(`${currentMedia()?.track_label||currentMedia()?.file_name} · đã sẵn sàng`);updateControls();emit();});
    el.addEventListener('canplay',()=>{if(playIntent&&el.paused)el.play().catch(()=>setStatus('Safari chặn tự phát. Bấm Play một lần.'));updateControls();});
    el.addEventListener('play',()=>{showFloat(true);updateControls();emit();});
    el.addEventListener('pause',()=>{showFloat(false);updateControls();emit();});
    el.addEventListener('timeupdate',()=>{updateControls();emit();});
    el.addEventListener('ended',()=>{
      if(loopEnabled){el.currentTime=0;el.play().catch(()=>{});return;}
      const mode=localStorage.getItem(modeKey(currentLessonId))||'question';
      if(mode==='full'&&currentIndex<mediaList.length-1)renderMedia(currentIndex+1,{autoplay:true});
    });
    el.addEventListener('error',()=>{setStatus('Trình duyệt không đọc được file audio đã tải.');updateControls();});
  }
  function ensurePlayerShell(){
    if(audio)return audio;
    const host=document.getElementById('audioPlayerHost');if(!host)return null;
    const m=currentMedia();
    host.innerHTML=`<div class="native-audio-shell"><audio id="bjtNativeAudio" playsinline preload="metadata"></audio><div class="native-audio-controls"><button data-audio-play class="native-play" type="button">▶</button><input data-audio-seek type="range" min="0" max="0" step="0.05" value="0"><span data-audio-time>00:00 / 00:00</span><button data-audio-loop class="native-loop ${loopEnabled?'active':''}" type="button">${loopEnabled?'↻ Đang lặp':'↻ Lặp'}</button></div><div class="audio-session-note">Dùng Google session và OAuth Client ID đã lưu sẵn bởi app Flashcard. Không nhập lại Client ID.</div></div><details class="audio-drive-fallback"><summary>Player Drive dự phòng</summary><iframe src="${esc(preview(m?.file_url))}" allow="autoplay; encrypted-media" title="Audio Google Drive"></iframe></details>`;
    audio=host.querySelector('#bjtNativeAudio');bindAudio(audio);
    host.querySelectorAll('[data-audio-play]').forEach(b=>b.onclick=toggle);
    host.querySelectorAll('[data-audio-loop]').forEach(b=>b.onclick=()=>setLoop(!loopEnabled,true));
    host.querySelectorAll('[data-audio-seek]').forEach(r=>r.oninput=e=>{if(audio&&Number.isFinite(audio.duration))audio.currentTime=Math.max(0,Math.min(audio.duration,+e.target.value||0));});
    updateControls();return audio;
  }
  async function loadCurrentAudio({autoplay=false}={}){
    const el=ensurePlayerShell();if(!el)return null;
    if(objectUrl&&el.src){if(autoplay)await el.play().catch(()=>setStatus('Safari chặn tự phát. Bấm Play một lần.'));return el;}
    if(loadingPromise){await loadingPromise;if(autoplay&&audio?.paused)await audio.play().catch(()=>{});return audio;}
    const seq=++loadSeq;playIntent=autoplay;setBusy(true,'Đang dùng Google session để tải audio…');
    loadingPromise=(async()=>{
      try{
        const blob=await fetchCurrentBlob(seq);if(seq!==loadSeq)return null;
        clearObjectUrl();objectUrl=URL.createObjectURL(blob);el.src=objectUrl;el.loop=loopEnabled;el.load();
        if(autoplay)await el.play().catch(()=>setStatus('Đã tải audio. Bấm Play thêm một lần nếu Safari chặn tự phát.'));
        return el;
      }catch(e){
        if(e?.name!=='AbortError'){
          setStatus(e.message);
          const d=document.querySelector('.audio-drive-fallback');if(d)d.open=true;
        }
        return null;
      }finally{if(seq===loadSeq){loadingPromise=null;setBusy(false);updateControls();emit();}}
    })();
    return loadingPromise;
  }
  async function toggle(){
    const el=ensurePlayerShell();if(!el)return;
    if(!objectUrl){await loadCurrentAudio({autoplay:true});return;}
    if(el.paused)await el.play().catch(()=>setStatus('Safari chặn tự phát. Bấm Play một lần.'));else el.pause();
  }
  async function setLoop(enabled,startNow=false){
    loopEnabled=Boolean(enabled);localStorage.setItem(loopKey(currentLessonId),loopEnabled?'1':'0');
    const el=ensurePlayerShell();if(el)el.loop=loopEnabled;updateControls();emit();
    if(loopEnabled&&startNow)await loadCurrentAudio({autoplay:true});
  }

  function questionForMedia(m=currentMedia()){
    if(!m)return null;
    const exact=state.questions.find(q=>q.book_id===state.bookId&&norm(q.audio_track)===norm(m.track_label));if(exact)return exact;
    const n=String(m.track_label||m.file_name||'').match(/(\d{1,3})(?=\D*$)/)?.[1];
    return n?state.questions.find(q=>q.book_id===state.bookId&&String(q.audio_track||'').match(/(\d{1,3})(?=\D*$)/)?.[1]===n):null;
  }
  function ensureScriptSheet(){
    if(scriptSheet&&document.body.contains(scriptSheet))return scriptSheet;
    scriptSheet=document.createElement('div');scriptSheet.className='script-overlay';scriptSheet.hidden=true;
    scriptSheet.innerHTML='<section class="script-sheet" role="dialog" aria-modal="true"><header><div><strong id="scriptTitle">Script nghe</strong><small id="scriptMeta"></small></div><button id="scriptClose" type="button">×</button></header><article id="scriptContent"></article><footer><span>Script lấy từ dữ liệu đã chuyển vào Google Sheet.</span><button id="scriptPdf" type="button">Tới PDF</button></footer></section>';
    document.body.appendChild(scriptSheet);scriptSheet.onclick=e=>{if(e.target===scriptSheet)closeScript();};scriptSheet.querySelector('#scriptClose').onclick=closeScript;scriptSheet.querySelector('#scriptPdf').onclick=()=>{closeScript();document.getElementById('pdfPane')?.scrollIntoView({behavior:'smooth',block:'start'});};return scriptSheet;
  }
  function fillScript(){
    const s=ensureScriptSheet(),q=questionForMedia(),m=currentMedia();s.querySelector('#scriptTitle').textContent=q?`Q${q.question_no} · ${q.section_title}`:'Chưa có script cho track này';s.querySelector('#scriptMeta').textContent=m?`${m.track_label||m.file_name}${q?` · PDF trang ${q.pdf_page}`:''}`:'';
    const host=s.querySelector('#scriptContent');if(!q){host.innerHTML='<div class="script-empty">Track này chưa được map với một câu nghe.</div>';return;}
    host.innerHTML=`<div class="script-prompt">${esc(q.prompt_jp||'')}</div>${q.script_jp?`<div class="script-body">${esc(q.script_jp)}</div>`:`<div class="script-options"><small>Phần lựa chọn</small>${[q.option_1_z,q.option_2_x,q.option_3_c,q.option_4_v].filter(Boolean).map((x,i)=>`<p><b>${i+1}</b>${esc(x)}</p>`).join('')}</div>`}`;
  }
  function openScript(){const s=ensureScriptSheet();fillScript();s.hidden=false;document.body.classList.add('audio-sheet-open');}
  function closeScript(){if(!scriptSheet)return;scriptSheet.hidden=true;document.body.classList.remove('audio-sheet-open');}
  function updateScriptButton(){const ok=Boolean(questionForMedia());document.querySelectorAll('[data-script-open]').forEach(b=>{b.disabled=!ok;b.classList.toggle('available',ok);});if(scriptSheet&&!scriptSheet.hidden)fillScript();}

  function renderMedia(index,{autoplay=false}={}){
    if(!mediaList.length)return;
    resetAudio();currentIndex=Math.min(mediaList.length-1,Math.max(0,index));
    const m=currentMedia();localStorage.setItem(selectedKey(currentLessonId),m.media_id);
    const host=document.getElementById('audioPlayerHost');if(host)host.innerHTML='';
    const button=document.getElementById('audioOpenPicker');if(button)button.innerHTML=`<span>${trackNo(m,currentIndex)}</span><b>${esc(m.track_label||m.file_name)}</b><i>${currentIndex+1}/${mediaList.length}</i>`;
    setStatus(`${m.track_label||m.file_name} · ${currentIndex+1}/${mediaList.length} · sẵn sàng`);updateScriptButton();syncPicker();emit();ensurePlayerShell();if(autoplay)loadCurrentAudio({autoplay:true});
  }
  function selectMedia(id,{close=true}={}){const i=mediaList.findIndex(m=>m.media_id===id);if(i>=0){renderMedia(i);if(close)closePicker();}}
  function step(delta){if(!mediaList.length)return;const wasPlaying=Boolean(audio&&!audio.paused);const next=Math.min(mediaList.length-1,Math.max(0,currentIndex+delta));if(next!==currentIndex)renderMedia(next,{autoplay:wasPlaying});}
  function setMode(mode){if(!currentLessonId)return;localStorage.setItem(modeKey(currentLessonId),mode);document.querySelectorAll('[data-audio-mode]').forEach(b=>b.classList.toggle('active',b.dataset.audioMode===mode));if(mode==='question')renderMedia(requestedIndex(mediaList,lesson()));if(mode==='full')renderMedia(0);syncPicker();}

  function ensureFloat(){
    if(floatBar&&document.body.contains(floatBar))return floatBar;
    floatBar=document.createElement('div');floatBar.className='audio-floating-player';floatBar.hidden=true;
    floatBar.innerHTML='<button data-audio-play class="float-audio-play" type="button">▶</button><div class="float-audio-main"><strong class="float-audio-track">Audio</strong><input data-audio-seek type="range" min="0" max="0" step="0.05" value="0"></div><span data-audio-time class="float-audio-time">00:00 / 00:00</span><button data-audio-loop class="float-audio-loop" type="button">↻ Lặp</button><button data-script-open class="float-audio-script" type="button">Script</button>';
    document.body.appendChild(floatBar);floatBar.querySelector('[data-audio-play]').onclick=toggle;floatBar.querySelector('[data-audio-loop]').onclick=()=>setLoop(!loopEnabled,true);floatBar.querySelector('[data-script-open]').onclick=openScript;floatBar.querySelector('[data-audio-seek]').oninput=e=>{if(audio&&Number.isFinite(audio.duration))audio.currentTime=Math.max(0,Math.min(audio.duration,+e.target.value||0));};return floatBar;
  }
  function ensurePicker(){
    if(picker&&document.body.contains(picker))return picker;
    picker=document.createElement('div');picker.className='audio-picker-overlay';picker.hidden=true;
    picker.innerHTML='<section class="audio-picker-sheet" role="dialog" aria-modal="true"><header><div><strong>Chọn track audio</strong><small id="audioPickerMeta"></small></div><button id="audioPickerClose" type="button">×</button></header><div class="audio-picker-tools"><label>⌕ <input id="audioPickerSearch" placeholder="Nhập số track hoặc tên file" inputmode="search"></label><div class="audio-picker-mode"><button type="button" data-picker-mode="question">Theo câu</button><button type="button" data-picker-mode="full">Từ đầu bài</button></div></div><div id="audioPickerList" class="audio-picker-list"></div></section>';
    document.body.appendChild(picker);picker.onclick=e=>{if(e.target===picker)closePicker();};picker.querySelector('#audioPickerClose').onclick=closePicker;picker.querySelector('#audioPickerSearch').oninput=renderPickerList;picker.querySelectorAll('[data-picker-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.pickerMode));return picker;
  }
  function renderPickerList(){const p=ensurePicker(),q=norm(p.querySelector('#audioPickerSearch').value);const visible=mediaList.map((m,i)=>({m,i})).filter(({m})=>!q||norm(`${m.track_label} ${m.file_name} ${trackNo(m,0)}`).includes(q));const groups=visible.reduce((a,x)=>((a[groupName(x.m)]??=[]).push(x),a),{}),host=p.querySelector('#audioPickerList');host.innerHTML=visible.length?Object.entries(groups).map(([g,items])=>`<section class="audio-picker-group"><h3>${esc(g)} <span>${items.length}</span></h3><div class="audio-track-grid">${items.map(({m,i})=>`<button type="button" data-track-id="${esc(m.media_id)}" class="${i===currentIndex?'active':''}"><b>${trackNo(m,i)}</b><small>${esc(m.track_label||m.file_name)}</small></button>`).join('')}</div></section>`).join(''):'<div class="audio-picker-empty">Không tìm thấy track.</div>';host.querySelectorAll('[data-track-id]').forEach(b=>b.onclick=()=>selectMedia(b.dataset.trackId,{close:true}));}
  function syncPicker(){if(!picker||picker.hidden)return;const mode=localStorage.getItem(modeKey(currentLessonId))||'question';picker.querySelector('#audioPickerMeta').textContent=`${mediaList.length} track · đang chọn ${currentIndex+1}`;picker.querySelectorAll('[data-picker-mode]').forEach(b=>b.classList.toggle('active',b.dataset.pickerMode===mode));renderPickerList();}
  function openPicker(){const p=ensurePicker();p.hidden=false;document.body.classList.add('audio-sheet-open');p.querySelector('#audioPickerSearch').value='';syncPicker();setTimeout(()=>p.querySelector('#audioPickerSearch').focus({preventScroll:true}),60);}
  function closePicker(){if(!picker)return;picker.hidden=true;document.body.classList.remove('audio-sheet-open');}

  function enhance(){
    clearTimeout(timer);const bar=document.querySelector('.study-audio-bar'),l=lesson();if(!bar||!l)return;if(bar.dataset.audioEnhanced===l.lesson_id)return;
    resetAudio();mediaList=listForLesson(l);currentLessonId=l.lesson_id;currentIndex=requestedIndex(mediaList,l);loopEnabled=localStorage.getItem(loopKey(currentLessonId))==='1';
    const mode=localStorage.getItem(modeKey(l.lesson_id))||'question',m=currentMedia();bar.id='studyAudioBar';bar.dataset.audioEnhanced=l.lesson_id;
    bar.innerHTML=`<div class="audio-controller-head"><div class="audio-info"><strong>♫ Audio luyện nghe <span class="audio-auth-badge">Google session</span></strong><small id="audioStatus">${mediaList.length?`${mediaList.length} track trong bài`:'Bài này chưa có track'}</small></div><div class="audio-mode"><button type="button" data-audio-mode="question" class="${mode==='question'?'active':''}">Theo câu</button><button type="button" data-audio-mode="full" class="${mode==='full'?'active':''}">Từ đầu bài</button></div></div><div class="audio-controller-row"><button id="audioPrev" class="audio-icon" type="button">‹</button><button id="audioOpenPicker" class="audio-track-button" type="button">${m?`<span>${trackNo(m,currentIndex)}</span><b>${esc(m.track_label||m.file_name)}</b><i>${currentIndex+1}/${mediaList.length}</i>`:'<b>Chưa có audio</b>'}</button><button id="audioNext" class="audio-icon" type="button">›</button></div><div class="audio-action-row"><button data-audio-play class="audio-main-play" type="button">▶</button><button data-audio-loop class="audio-main-loop ${loopEnabled?'active':''}" type="button">${loopEnabled?'↻ Đang lặp':'↻ Lặp'}</button><button data-script-open class="audio-script-btn" type="button">Script</button><span data-audio-time class="audio-main-time">00:00 / 00:00</span></div><div id="audioPlayerHost" class="audio-player-host"></div>`;
    bar.querySelectorAll('[data-audio-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.audioMode));document.getElementById('audioOpenPicker').onclick=openPicker;document.getElementById('audioPrev').onclick=()=>step(-1);document.getElementById('audioNext').onclick=()=>step(1);bar.querySelector('[data-audio-play]').onclick=toggle;bar.querySelector('[data-audio-loop]').onclick=()=>setLoop(!loopEnabled,true);bar.querySelector('[data-script-open]').onclick=openScript;
    ensureFloat();if(mediaList.length)renderMedia(currentIndex);closePicker();closeScript();updateControls();
  }

  observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enhance,40);});
  window.addEventListener('DOMContentLoaded',()=>{const root=document.getElementById('lessonDetail');if(root)observer.observe(root,{childList:true,subtree:true});});
  window.addEventListener('load',enhance);window.addEventListener('beforeunload',clearObjectUrl);
  window.BJT_AUDIO={toggle,step,selectMedia,setMode,setLoop,openPicker,closePicker,openScript,closeScript,getList:()=>mediaList.slice(),getCurrent:currentMedia,getIndex:()=>currentIndex,getAudio:()=>audio,enhance};
})();