(()=>{
  const {state}=BJT;
  const norm=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const driveId=url=>String(url||'').match(/\/d\/([^/?#]+)/)?.[1]||String(url||'').match(/[?&]id=([^&#]+)/)?.[1]||'';
  const preview=url=>{const id=driveId(url);return id?`https://drive.google.com/file/d/${id}/preview`:''};
  const selectedKey=id=>`bjtAudioSelected:${id}`;
  const modeKey=id=>`bjtAudioMode:${id}`;
  const loopKey=id=>`bjtAudioLoop:${id}`;
  let mediaList=[],currentIndex=0,currentLessonId='',observer,timer,picker,scriptSheet,floatBar;
  let audio=null,sourceList=[],sourceIndex=0,nativeReady=false,playIntent=false,loopEnabled=false,sourceToken=0;

  const lesson=()=>state.lessons.find(x=>x.lesson_id===state.lessonId);
  const currentMedia=()=>mediaList[currentIndex];
  const selectedQuestion=()=>state.questions.find(x=>x.question_id===state.questionId);
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
  function fmt(v){if(!Number.isFinite(v)||v<0)v=0;return `${String(Math.floor(v/60)).padStart(2,'0')}:${String(Math.floor(v%60)).padStart(2,'0')}`;}
  function setStatus(text){const e=document.getElementById('audioStatus');if(e)e.textContent=text;}
  function emit(){window.dispatchEvent(new CustomEvent('bjt-audio-state',{detail:{lessonId:currentLessonId,index:currentIndex,total:mediaList.length,media:currentMedia(),playing:Boolean(audio&&!audio.paused),time:audio?.currentTime||0,duration:audio?.duration||0,loop:loopEnabled,secure:true,native:nativeReady}}));}

  function directSources(m){
    const id=m?.drive_file_id||driveId(m?.file_url);if(!id)return[];
    const urls=[
      `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}&confirm=t`,
      `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`,
      `https://drive.google.com/uc?export=open&id=${encodeURIComponent(id)}`
    ];
    for(let i=0;i<5;i++)urls.push(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&authuser=${i}&confirm=t`);
    return [...new Set(urls)];
  }
  function updateControls(){
    const playing=Boolean(audio&&!audio.paused),now=audio?.currentTime||0,dur=audio?.duration||0;
    document.querySelectorAll('[data-audio-play]').forEach(b=>b.textContent=playing?'❚❚':'▶');
    document.querySelectorAll('[data-audio-time]').forEach(e=>e.textContent=`${fmt(now)} / ${fmt(dur)}`);
    document.querySelectorAll('[data-audio-seek]').forEach(r=>{r.max=dur||0;r.value=now;});
    document.querySelectorAll('[data-audio-loop]').forEach(b=>{b.classList.toggle('active',loopEnabled);b.textContent=loopEnabled?'↻ Đang lặp':'↻ Lặp';});
    const m=currentMedia();
    if(floatBar&&m){floatBar.querySelector('.float-audio-track').textContent=`${trackNo(m,currentIndex)} · ${m.track_label||m.file_name}`;}
  }
  function showFloat(show){
    const f=ensureFloat();f.hidden=!show;
    document.body.classList.toggle('audio-is-playing',show);
    updateControls();
  }
  function resetNative(){
    sourceToken++;playIntent=false;nativeReady=false;
    if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio=null;}
    showFloat(false);
  }
  function bindAudio(el){
    el.loop=loopEnabled;
    el.addEventListener('loadedmetadata',()=>{nativeReady=true;setStatus(`${currentMedia()?.track_label||currentMedia()?.file_name} · dùng Google session của trình duyệt`);updateControls();emit();});
    el.addEventListener('canplay',()=>{nativeReady=true;if(playIntent&&el.paused)el.play().catch(()=>{});updateControls();});
    el.addEventListener('play',()=>{showFloat(true);updateControls();emit();});
    el.addEventListener('pause',()=>{showFloat(false);updateControls();emit();});
    el.addEventListener('timeupdate',()=>{updateControls();emit();});
    el.addEventListener('ended',async()=>{
      if(loopEnabled){el.currentTime=0;await el.play().catch(()=>{});return;}
      const mode=localStorage.getItem(modeKey(currentLessonId))||'question';
      if(mode==='full'&&currentIndex<mediaList.length-1)renderMedia(currentIndex+1,{autoplay:true});
    });
    el.addEventListener('error',()=>{
      if(sourceIndex+1<sourceList.length){sourceIndex++;setStatus(`Đang thử kết nối Google session ${sourceIndex+1}/${sourceList.length}…`);applySource(playIntent);return;}
      nativeReady=false;setStatus('Không phát được bằng thẻ audio. Mở player Drive bên dưới để kiểm tra đúng tài khoản Google.');
      const details=document.querySelector('.audio-drive-fallback');if(details)details.open=true;
      updateControls();emit();
    });
  }
  function applySource(autoplay=false){
    if(!audio||!sourceList[sourceIndex])return;
    const token=++sourceToken;playIntent=autoplay;
    audio.src=sourceList[sourceIndex];audio.loop=loopEnabled;audio.load();
    if(autoplay){const p=audio.play();if(p?.catch)p.catch(()=>{if(token===sourceToken)setStatus('Đã tải audio. Bấm Play thêm một lần nếu Safari chặn tự phát.');});}
  }
  function ensureNativePlayer(){
    if(audio)return audio;
    const host=document.getElementById('audioPlayerHost');if(!host)return null;
    const m=currentMedia();
    host.innerHTML=`<div class="native-audio-shell"><audio id="bjtNativeAudio" playsinline preload="metadata"></audio><div class="native-audio-controls"><button data-audio-play class="native-play" type="button">▶</button><input data-audio-seek type="range" min="0" max="0" step="0.05" value="0"><span data-audio-time>00:00 / 00:00</span><button data-audio-loop class="native-loop ${loopEnabled?'active':''}" type="button">${loopEnabled?'↻ Đang lặp':'↻ Lặp'}</button></div><div class="audio-session-note">Audio dùng URL Drive trực tiếp và phiên Google đang đăng nhập trong trình duyệt. Không nhập Client ID, không đăng nhập lại.</div></div><details class="audio-drive-fallback"><summary>Player Drive dự phòng</summary><iframe src="${esc(preview(m?.file_url))}" allow="autoplay; encrypted-media" referrerpolicy="strict-origin-when-cross-origin" title="Audio Google Drive"></iframe></details>`;
    audio=host.querySelector('#bjtNativeAudio');bindAudio(audio);
    host.querySelectorAll('[data-audio-play]').forEach(b=>b.onclick=toggle);
    host.querySelectorAll('[data-audio-loop]').forEach(b=>b.onclick=()=>setLoop(!loopEnabled,true));
    host.querySelectorAll('[data-audio-seek]').forEach(r=>r.oninput=e=>{if(audio&&Number.isFinite(audio.duration))audio.currentTime=Math.max(0,Math.min(audio.duration,+e.target.value||0));});
    sourceList=directSources(m);sourceIndex=0;updateControls();return audio;
  }
  async function startNative(autoplay=true){
    const el=ensureNativePlayer();if(!el)return;
    if(!el.src){sourceList=directSources(currentMedia());sourceIndex=0;applySource(autoplay);return;}
    playIntent=autoplay;
    if(autoplay&&el.paused)await el.play().catch(()=>setStatus('Bấm Play thêm một lần nếu Safari chặn tự phát.'));
  }
  async function toggle(){
    const el=ensureNativePlayer();if(!el)return;
    if(!el.src){await startNative(true);return;}
    if(el.paused){playIntent=true;await el.play().catch(()=>setStatus('Bấm Play thêm một lần nếu Safari chặn tự phát.'));}else el.pause();
  }
  async function setLoop(enabled,startNow=false){
    loopEnabled=Boolean(enabled);localStorage.setItem(loopKey(currentLessonId),loopEnabled?'1':'0');
    const el=ensureNativePlayer();if(el)el.loop=loopEnabled;updateControls();emit();
    if(loopEnabled&&startNow)await startNative(true);
  }

  function questionForMedia(m=currentMedia()){
    if(!m)return null;
    const exact=state.questions.find(q=>q.book_id===state.bookId&&norm(q.audio_track)===norm(m.track_label));
    if(exact)return exact;
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
    resetNative();currentIndex=Math.min(mediaList.length-1,Math.max(0,index));
    const m=currentMedia();localStorage.setItem(selectedKey(currentLessonId),m.media_id);
    const host=document.getElementById('audioPlayerHost');if(host)host.innerHTML='';
    const button=document.getElementById('audioOpenPicker');if(button)button.innerHTML=`<span>${trackNo(m,currentIndex)}</span><b>${esc(m.track_label||m.file_name)}</b><i>${currentIndex+1}/${mediaList.length}</i>`;
    setStatus(`${m.track_label||m.file_name} · ${currentIndex+1}/${mediaList.length} · sẵn sàng`);updateScriptButton();syncPicker();emit();ensureNativePlayer();if(autoplay)startNative(true);
  }
  function selectMedia(id,{close=true}={}){const i=mediaList.findIndex(m=>m.media_id===id);if(i>=0){renderMedia(i);if(close)closePicker();}}
  function step(delta){if(!mediaList.length)return;const next=Math.min(mediaList.length-1,Math.max(0,currentIndex+delta));if(next!==currentIndex)renderMedia(next,{autoplay:Boolean(audio&&!audio.paused)});}
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
    resetNative();mediaList=listForLesson(l);currentLessonId=l.lesson_id;currentIndex=requestedIndex(mediaList,l);loopEnabled=localStorage.getItem(loopKey(currentLessonId))==='1';
    const mode=localStorage.getItem(modeKey(l.lesson_id))||'question',m=currentMedia();bar.id='studyAudioBar';bar.dataset.audioEnhanced=l.lesson_id;
    bar.innerHTML=`<div class="audio-controller-head"><div class="audio-info"><strong>♫ Audio luyện nghe <span class="audio-auth-badge">Google session</span></strong><small id="audioStatus">${mediaList.length?`${mediaList.length} track trong bài`:'Bài này chưa có track'}</small></div><div class="audio-mode"><button type="button" data-audio-mode="question" class="${mode==='question'?'active':''}">Theo câu</button><button type="button" data-audio-mode="full" class="${mode==='full'?'active':''}">Từ đầu bài</button></div></div><div class="audio-controller-row"><button id="audioPrev" class="audio-icon" type="button">‹</button><button id="audioOpenPicker" class="audio-track-button" type="button">${m?`<span>${trackNo(m,currentIndex)}</span><b>${esc(m.track_label||m.file_name)}</b><i>${currentIndex+1}/${mediaList.length}</i>`:'<b>Chưa có audio</b>'}</button><button id="audioNext" class="audio-icon" type="button">›</button></div><div class="audio-action-row"><button data-audio-play class="audio-main-play" type="button">▶</button><button data-audio-loop class="audio-main-loop ${loopEnabled?'active':''}" type="button">${loopEnabled?'↻ Đang lặp':'↻ Lặp'}</button><button data-script-open class="audio-script-btn" type="button">Script</button><span data-audio-time class="audio-main-time">00:00 / 00:00</span></div><div id="audioPlayerHost" class="audio-player-host"></div>`;
    bar.querySelectorAll('[data-audio-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.audioMode));document.getElementById('audioOpenPicker').onclick=openPicker;document.getElementById('audioPrev').onclick=()=>step(-1);document.getElementById('audioNext').onclick=()=>step(1);bar.querySelector('[data-audio-play]').onclick=toggle;bar.querySelector('[data-audio-loop]').onclick=()=>setLoop(!loopEnabled,true);bar.querySelector('[data-script-open]').onclick=openScript;
    ensureFloat();if(mediaList.length)renderMedia(currentIndex);closePicker();closeScript();updateControls();
  }

  observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enhance,40);});
  window.addEventListener('DOMContentLoaded',()=>{const root=document.getElementById('lessonDetail');if(root)observer.observe(root,{childList:true,subtree:true});});
  window.addEventListener('load',enhance);
  window.BJT_AUDIO={toggle,step,selectMedia,setMode,setLoop,openPicker,closePicker,openScript,closeScript,getList:()=>mediaList.slice(),getCurrent:currentMedia,getIndex:()=>currentIndex,getAudio:()=>audio,enhance};
})();