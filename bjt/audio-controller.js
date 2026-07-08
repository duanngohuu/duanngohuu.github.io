(()=>{
  const {state}=BJT;
  const driveId=url=>String(url||'').match(/\/d\/([^/?#]+)/)?.[1]||String(url||'').match(/[?&]id=([^&#]+)/)?.[1]||'';
  const direct=url=>{const id=driveId(url);return id?`https://drive.google.com/uc?export=download&id=${id}`:''};
  const preview=url=>{const id=driveId(url);return id?`https://drive.google.com/file/d/${id}/preview`:''};
  const norm=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const selectedKey=id=>`bjtAudioSelected:${id}`;
  const modeKey=id=>`bjtAudioMode:${id}`;
  let mediaList=[],currentIndex=0,currentLessonId='',observer,enhanceTimer;

  function lesson(){return state.lessons.find(x=>x.lesson_id===state.lessonId);}
  function selectedQuestion(){return state.questions.find(x=>x.question_id===state.questionId);}
  function listForLesson(l){return state.media.filter(m=>m.media_type==='audio'&&m.lesson_id===l.lesson_id).sort((a,b)=>(+a.sort_order||0)-(+b.sort_order||0));}
  function requestedIndex(list,l){
    const mode=localStorage.getItem(modeKey(l.lesson_id))||'question';
    if(mode==='question'){
      const label=selectedQuestion()?.audio_track;
      const byQuestion=list.findIndex(m=>norm(m.track_label)===norm(label));
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
  function renderMedia(index,{autoplay=false}={}){
    if(!mediaList.length)return;
    currentIndex=Math.min(mediaList.length-1,Math.max(0,index));
    const m=mediaList[currentIndex];
    localStorage.setItem(selectedKey(currentLessonId),m.media_id);
    const host=document.getElementById('audioPlayerHost');
    if(!host)return;
    if(isMp3(m)){
      host.innerHTML=`<audio id="bjtAudioPlayer" class="audio-native" controls preload="metadata" playsinline src="${direct(m.file_url)}"></audio>`;
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
      host.innerHTML=`<iframe id="bjtAudioFrame" src="${preview(m.file_url)}" allow="autoplay" title="Audio Google Drive"></iframe>`;
    }
    document.querySelectorAll('[data-audio-select]').forEach(s=>s.value=m.media_id);
    setStatus(`${m.track_label||m.file_name} · ${currentIndex+1}/${mediaList.length}`);
    emit();
  }
  function selectMedia(id,{autoplay=false}={}){const i=mediaList.findIndex(m=>m.media_id===id);if(i>=0)renderMedia(i,{autoplay});}
  function toggle(){const p=player();if(p){p.paused?p.play().catch(()=>{}):p.pause();}else document.getElementById('studyAudioBar')?.scrollIntoView({behavior:'smooth',block:'start'});}
  function step(delta){if(!mediaList.length)return;renderMedia((currentIndex+delta+mediaList.length)%mediaList.length,{autoplay:!player()?.paused});}
  function setMode(mode){
    if(!currentLessonId)return;
    localStorage.setItem(modeKey(currentLessonId),mode);
    document.querySelectorAll('[data-audio-mode]').forEach(b=>b.classList.toggle('active',b.dataset.audioMode===mode));
    const l=lesson();
    if(mode==='question')renderMedia(requestedIndex(mediaList,l),{autoplay:false});
    if(mode==='full')renderMedia(0,{autoplay:true});
    emit();
  }

  function enhance(){
    clearTimeout(enhanceTimer);
    const bar=document.querySelector('.study-audio-bar'),l=lesson();
    if(!bar||!l)return;
    if(bar.dataset.audioEnhanced===l.lesson_id)return;
    mediaList=listForLesson(l);currentLessonId=l.lesson_id;currentIndex=requestedIndex(mediaList,l);
    const mode=localStorage.getItem(modeKey(l.lesson_id))||'question';
    bar.id='studyAudioBar';bar.dataset.audioEnhanced=l.lesson_id;
    bar.innerHTML=`<div class="audio-controller-head"><div class="audio-info"><strong>♫ Audio luyện nghe</strong><small id="audioStatus">${mediaList.length?`${mediaList.length} track trong bài`:'Bài này chưa có track được map'}</small></div><div class="audio-mode"><button type="button" data-audio-mode="question" class="${mode==='question'?'active':''}">Theo câu</button><button type="button" data-audio-mode="full" class="${mode==='full'?'active':''}">Full bài</button></div></div><div class="audio-controller-row"><button id="audioPrev" class="audio-icon" type="button">‹</button><select id="audioTrackSelect" data-audio-select aria-label="Chọn track audio">${mediaList.length?mediaList.map((m,i)=>`<option value="${m.media_id}">${String(i+1).padStart(2,'0')} · ${m.track_label||m.file_name}</option>`).join(''):'<option>Chưa có track</option>'}</select><button id="audioNext" class="audio-icon" type="button">›</button></div><div id="audioPlayerHost" class="audio-player-host">${mediaList.length?'':'<div class="audio-empty">Chưa có link audio cụ thể trong tab MEDIA.</div>'}</div>`;
    bar.querySelectorAll('[data-audio-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.audioMode));
    const select=document.getElementById('audioTrackSelect');if(select)select.onchange=()=>selectMedia(select.value,{autoplay:true});
    document.getElementById('audioPrev').onclick=()=>step(-1);document.getElementById('audioNext').onclick=()=>step(1);
    if(mediaList.length)renderMedia(currentIndex,{autoplay:sessionStorage.getItem('bjtAudioAutoPlay')==='1'});
    sessionStorage.removeItem('bjtAudioAutoPlay');
  }

  document.addEventListener('click',e=>{if(e.target.closest('.question-chip[data-id]'))sessionStorage.setItem('bjtAudioAutoPlay','1');},true);
  observer=new MutationObserver(()=>{clearTimeout(enhanceTimer);enhanceTimer=setTimeout(enhance,30);});
  window.addEventListener('DOMContentLoaded',()=>{const root=document.getElementById('lessonDetail');if(root)observer.observe(root,{childList:true,subtree:true});});
  window.addEventListener('load',enhance);
  window.BJT_AUDIO={toggle,step,selectMedia,setMode,getList:()=>mediaList.slice(),getCurrent:()=>mediaList[currentIndex],enhance};
})();