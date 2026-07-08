(()=>{
  const {state}=BJT;
  const driveId=url=>String(url||'').match(/\/d\/([^/?#]+)/)?.[1]||String(url||'').match(/[?&]id=([^&#]+)/)?.[1]||'';
  const direct=url=>{const id=driveId(url);return id?`https://drive.google.com/uc?export=download&id=${id}`:''};
  const preview=url=>{const id=driveId(url);return id?`https://drive.google.com/file/d/${id}/preview`:''};
  const norm=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const selectedKey=id=>`bjtAudioSelected:${id}`;
  const modeKey=id=>`bjtAudioMode:${id}`;
  let mediaList=[],currentIndex=0,currentLessonId='',observer,enhanceTimer,picker;

  function lesson(){return state.lessons.find(x=>x.lesson_id===state.lessonId);}
  function selectedQuestion(){return state.questions.find(x=>x.question_id===state.questionId);}
  function listForLesson(l){return state.media.filter(m=>m.media_type==='audio'&&m.lesson_id===l.lesson_id).sort((a,b)=>(+a.sort_order||0)-(+b.sort_order||0));}
  function requestedIndex(list,l){
    const mode=localStorage.getItem(modeKey(l.lesson_id))||'question';
    if(mode==='question'){
      const label=selectedQuestion()?.audio_track;
      const byQuestion=list.findIndex(m=>norm(m.track_label)===norm(label)||norm(m.file_name)===norm(label));
      if(byQuestion>=0)return byQuestion;
    }
    const saved=localStorage.getItem(selectedKey(l.lesson_id));
    const bySaved=list.findIndex(m=>m.media_id===saved);
    return bySaved>=0?bySaved:0;
  }
  function isMp3(m){return /audio\/mpeg/i.test(m?.mime_type)||/\.mp3$/i.test(m?.file_name||'');}
  function player(){return document.getElementById('bjtAudioPlayer');}
  function emit(){
    const m=mediaList[currentIndex];
    window.dispatchEvent(new CustomEvent('bjt-audio-state',{detail:{lessonId:currentLessonId,index:currentIndex,total:mediaList.length,media:m,playing:!player()?.paused,mode:localStorage.getItem(modeKey(currentLessonId))||'question'}}));
  }
  function setStatus(text){const e=document.getElementById('audioStatus');if(e)e.textContent=text;}
  function trackNo(m,i){const n=String(m?.file_name||m?.track_label||'').match(/(\d{1,3})(?=\D*$)/)?.[1];return n?String(+n).padStart(3,'0'):String(i+1).padStart(3,'0');}
  function groupName(m){return String(m?.track_label||m?.file_name||'Audio').match(/CD\s*\d+/i)?.[0]?.toUpperCase()||'TRACK';}

  function renderMedia(index,{autoplay=false}={}){
    if(!mediaList.length)return;
    currentIndex=Math.min(mediaList.length-1,Math.max(0,index));
    const m=mediaList[currentIndex];
    localStorage.setItem(selectedKey(currentLessonId),m.media_id);
    const host=document.getElementById('audioPlayerHost');
    if(!host)return;
    if(isMp3(m)){
      host.innerHTML=`<audio id="bjtAudioPlayer" class="audio-native" controls preload="metadata" playsinline src="${esc(direct(m.file_url))}"></audio>`;
      const p=player();
      p.addEventListener('play',emit);p.addEventListener('pause',emit);
      p.addEventListener('error',()=>setStatus('Không tải được file. Kiểm tra quyền share của track này.'));
      p.addEventListener('ended',()=>{
        const mode=localStorage.getItem(modeKey(currentLessonId))||'question';
        if(mode==='full'&&currentIndex<mediaList.length-1)renderMedia(currentIndex+1,{autoplay:true});
        else emit();
      });
      if(autoplay)p.play().catch(()=>{});
    }else{
      host.innerHTML=`<iframe id="bjtAudioFrame" src="${esc(preview(m.file_url))}" allow="autoplay" title="Audio Google Drive"></iframe>`;
    }
    const button=document.getElementById('audioOpenPicker');
    if(button)button.innerHTML=`<span>${trackNo(m,currentIndex)}</span><b>${esc(m.track_label||m.file_name)}</b><i>${currentIndex+1}/${mediaList.length}</i>`;
    setStatus(`${m.track_label||m.file_name} · ${currentIndex+1}/${mediaList.length}`);
    syncPicker();emit();
  }
  function selectMedia(id,{autoplay=false,close=true}={}){const i=mediaList.findIndex(m=>m.media_id===id);if(i>=0){renderMedia(i,{autoplay});if(close)closePicker();}}
  function toggle(){const p=player();if(p){p.paused?p.play().catch(()=>{}):p.pause();}else document.getElementById('studyAudioBar')?.scrollIntoView({behavior:'smooth',block:'start'});}
  function step(delta){if(!mediaList.length)return;renderMedia((currentIndex+delta+mediaList.length)%mediaList.length,{autoplay:!player()?.paused});}
  function setMode(mode){
    if(!currentLessonId)return;
    localStorage.setItem(modeKey(currentLessonId),mode);
    document.querySelectorAll('[data-audio-mode]').forEach(b=>b.classList.toggle('active',b.dataset.audioMode===mode));
    const l=lesson();
    if(mode==='question')renderMedia(requestedIndex(mediaList,l),{autoplay:false});
    if(mode==='full')renderMedia(0,{autoplay:true});
    syncPicker();emit();
  }

  function ensurePicker(){
    if(picker&&document.body.contains(picker))return picker;
    picker=document.createElement('div');
    picker.id='audioTrackPicker';picker.className='audio-picker-overlay';picker.hidden=true;
    picker.innerHTML=`<section class="audio-picker-sheet" role="dialog" aria-modal="true" aria-label="Chọn audio"><header><div><strong>Chọn track audio</strong><small id="audioPickerMeta"></small></div><button id="audioPickerClose" type="button">×</button></header><div class="audio-picker-tools"><label>⌕ <input id="audioPickerSearch" placeholder="Nhập 26, CD1-26, tên file…" inputmode="search"></label><div class="audio-picker-mode"><button type="button" data-picker-mode="question">Theo câu</button><button type="button" data-picker-mode="full">Full bài</button></div></div><div id="audioPickerList" class="audio-picker-list"></div></section>`;
    document.body.appendChild(picker);
    picker.addEventListener('click',e=>{if(e.target===picker)closePicker();});
    picker.querySelector('#audioPickerClose').onclick=closePicker;
    picker.querySelector('#audioPickerSearch').oninput=renderPickerList;
    picker.querySelectorAll('[data-picker-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.pickerMode));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!picker.hidden)closePicker();});
    return picker;
  }
  function renderPickerList(){
    const p=ensurePicker(),q=norm(p.querySelector('#audioPickerSearch').value);
    const visible=mediaList.map((m,i)=>({m,i})).filter(({m})=>!q||norm(`${m.track_label} ${m.file_name} ${trackNo(m,0)}`).includes(q));
    const groups=visible.reduce((a,x)=>((a[groupName(x.m)]??=[]).push(x),a),{});
    const host=p.querySelector('#audioPickerList');
    host.innerHTML=visible.length?Object.entries(groups).map(([g,items])=>`<section class="audio-picker-group"><h3>${esc(g)} <span>${items.length}</span></h3><div class="audio-track-grid">${items.map(({m,i})=>`<button type="button" data-track-id="${esc(m.media_id)}" class="${i===currentIndex?'active':''}"><b>${trackNo(m,i)}</b><small>${esc(m.track_label||m.file_name)}</small></button>`).join('')}</div></section>`).join(''):'<div class="audio-picker-empty">Không tìm thấy track.</div>';
    host.querySelectorAll('[data-track-id]').forEach(b=>b.onclick=()=>selectMedia(b.dataset.trackId,{autoplay:true,close:true}));
  }
  function syncPicker(){
    if(!picker||picker.hidden)return;
    const mode=localStorage.getItem(modeKey(currentLessonId))||'question';
    picker.querySelector('#audioPickerMeta').textContent=`${mediaList.length} track · đang chọn ${currentIndex+1}`;
    picker.querySelectorAll('[data-picker-mode]').forEach(b=>b.classList.toggle('active',b.dataset.pickerMode===mode));
    renderPickerList();
  }
  function openPicker(){
    const p=ensurePicker();
    p.hidden=false;document.body.classList.add('picker-open');
    p.querySelector('#audioPickerSearch').value='';syncPicker();
    setTimeout(()=>p.querySelector('#audioPickerSearch').focus({preventScroll:true}),80);
  }
  function closePicker(){if(!picker)return;picker.hidden=true;document.body.classList.remove('picker-open');}

  function enhance(){
    clearTimeout(enhanceTimer);
    const bar=document.querySelector('.study-audio-bar'),l=lesson();
    if(!bar||!l)return;
    if(bar.dataset.audioEnhanced===l.lesson_id)return;
    mediaList=listForLesson(l);currentLessonId=l.lesson_id;currentIndex=requestedIndex(mediaList,l);
    const mode=localStorage.getItem(modeKey(l.lesson_id))||'question';
    bar.id='studyAudioBar';bar.dataset.audioEnhanced=l.lesson_id;
    const current=mediaList[currentIndex];
    bar.innerHTML=`<div class="audio-controller-head"><div class="audio-info"><strong>♫ Audio luyện nghe</strong><small id="audioStatus">${mediaList.length?`${mediaList.length} track trong bài`:'Bài này chưa có track được map'}</small></div><div class="audio-mode"><button type="button" data-audio-mode="question" class="${mode==='question'?'active':''}">Theo câu</button><button type="button" data-audio-mode="full" class="${mode==='full'?'active':''}">Full bài</button></div></div><div class="audio-controller-row"><button id="audioPrev" class="audio-icon" type="button" aria-label="Track trước">‹</button><button id="audioOpenPicker" class="audio-track-button" type="button">${current?`<span>${trackNo(current,currentIndex)}</span><b>${esc(current.track_label||current.file_name)}</b><i>${currentIndex+1}/${mediaList.length}</i>`:'<b>Chưa có audio</b>'}</button><button id="audioNext" class="audio-icon" type="button" aria-label="Track sau">›</button></div><div id="audioPlayerHost" class="audio-player-host">${mediaList.length?'':'<div class="audio-empty">Chưa có link audio cụ thể trong tab MEDIA.</div>'}</div>`;
    bar.querySelectorAll('[data-audio-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.audioMode));
    document.getElementById('audioOpenPicker').onclick=openPicker;
    document.getElementById('audioPrev').onclick=()=>step(-1);document.getElementById('audioNext').onclick=()=>step(1);
    if(mediaList.length)renderMedia(currentIndex,{autoplay:sessionStorage.getItem('bjtAudioAutoPlay')==='1'});
    sessionStorage.removeItem('bjtAudioAutoPlay');closePicker();
  }

  document.addEventListener('click',e=>{if(e.target.closest('.question-chip[data-id]'))sessionStorage.setItem('bjtAudioAutoPlay','1');},true);
  observer=new MutationObserver(()=>{clearTimeout(enhanceTimer);enhanceTimer=setTimeout(enhance,30);});
  window.addEventListener('DOMContentLoaded',()=>{const root=document.getElementById('lessonDetail');if(root)observer.observe(root,{childList:true,subtree:true});});
  window.addEventListener('load',enhance);
  window.BJT_AUDIO={toggle,step,selectMedia,setMode,openPicker,closePicker,getList:()=>mediaList.slice(),getCurrent:()=>mediaList[currentIndex],getIndex:()=>currentIndex,enhance};
})();