(()=>{
  'use strict';

  const BJT=window.BJT;
  if(!BJT?.state)return;
  const {state}=BJT;
  const TOKEN_KEY='bjtGoogleDriveTokenV1';
  const GRANTED_KEY='bjtGoogleDriveGrantedV1';
  const CACHE_PREFIX='bjtDriveFolderCacheV7:';
  const CACHE_TTL=24*60*60*1000;
  const FOLDER_MIME='application/vnd.google-apps.folder';
  const loading=new Map();
  const memoryCache=new Map();
  let preloadJob=null;
  let decorateTimer=0;

  const truthy=value=>['true','1','yes','y'].includes(String(value??'').trim().toLowerCase());
  const bookHasAudio=book=>Boolean(book&&(truthy(book.audio_available)||(+book.audio_track_count||0)>0)&&folderId(book.source_folder_url));
  const folderId=url=>String(url||'').match(/\/folders\/([^/?#]+)/)?.[1]||'';
  const natural=(a,b)=>String(a.name||'').localeCompare(String(b.name||''),undefined,{numeric:true,sensitivity:'base'});
  const isAudio=file=>/^audio\//i.test(file.mimeType||'')||/\.(?:mp3|m4a|aac|wav|ogg|wma)$/i.test(file.name||'');
  const isMp3=file=>/audio\/mpeg/i.test(file.mimeType||'')||/\.mp3$/i.test(file.name||'');
  const pad2=n=>String(+n||0).padStart(2,'0');
  const inRange=(n,a,b)=>n>=a&&n<=b;
  const lessonsForBook=id=>state.lessons.filter(x=>x.book_id===id).sort((a,b)=>(+a.sort_order||0)-(+b.sort_order||0));
  const lessonById=id=>state.lessons.find(x=>x.lesson_id===id);
  const currentBook=()=>state.books.find(x=>x.book_id===state.bookId);

  function readSession(){
    try{
      const value=JSON.parse(localStorage.getItem(TOKEN_KEY)||'null');
      if(value?.access_token&&Number(value.expires_at)>Date.now()+60_000)return value;
    }catch{}
    return null;
  }
  function hasGranted(){
    try{return localStorage.getItem(GRANTED_KEY)==='1';}catch{return false;}
  }
  function clearToken(){
    try{localStorage.removeItem(TOKEN_KEY);}catch{}
  }

  const previousSession=window.BJT_GOOGLE_SESSION||{};
  window.BJT_GOOGLE_SESSION={
    ...previousSession,
    getSession:readSession,
    getToken:()=>readSession()?.access_token||'',
    hasValidToken:()=>Boolean(readSession()),
    hasGranted,
    clear:()=>{clearToken();previousSession.clear?.();},
    forget:()=>{
      clearToken();
      try{localStorage.removeItem(GRANTED_KEY);}catch{}
      previousSession.forget?.();
      syncRememberedUi();
    },
    storage:'localStorage',
    note:'Lưu access token ngắn hạn và trạng thái đã cấp quyền trên thiết bị; không lưu mật khẩu hay cookie Google.'
  };

  function cacheRead(bookId){
    if(memoryCache.has(bookId))return memoryCache.get(bookId);
    try{
      const saved=JSON.parse(localStorage.getItem(CACHE_PREFIX+bookId)||'null');
      if(saved&&Date.now()-saved.time<CACHE_TTL&&Array.isArray(saved.files)){
        memoryCache.set(bookId,saved.files);
        return saved.files;
      }
    }catch{}
    return null;
  }
  function cacheWrite(bookId,files){
    memoryCache.set(bookId,files);
    try{localStorage.setItem(CACHE_PREFIX+bookId,JSON.stringify({time:Date.now(),files}));}catch{}
  }

  async function listChildren(token,parentId){
    const files=[];
    let pageToken='';
    do{
      const params=new URLSearchParams({
        q:`'${parentId}' in parents and trashed = false`,
        pageSize:'1000',
        fields:'nextPageToken,files(id,name,mimeType,size)',
        orderBy:'name',
        supportsAllDrives:'true',
        includeItemsFromAllDrives:'true'
      });
      if(pageToken)params.set('pageToken',pageToken);
      const response=await fetch(`https://www.googleapis.com/drive/v3/files?${params}`,{
        headers:{Authorization:`Bearer ${token}`}
      });
      if(response.status===401){
        clearToken();
        throw new Error('Phiên Google đã hết hạn. Bấm Play để khôi phục quyền đã nhớ.');
      }
      if(!response.ok){
        let message='';
        try{message=(await response.json())?.error?.message||'';}catch{}
        throw new Error(message||`Không đọc được thư mục audio (${response.status}).`);
      }
      const data=await response.json();
      files.push(...(data.files||[]));
      pageToken=data.nextPageToken||'';
    }while(pageToken);
    return files;
  }

  async function listFolderTree(token,rootId){
    const queue=[rootId];
    const seen=new Set();
    const audio=[];
    while(queue.length){
      const id=queue.shift();
      if(!id||seen.has(id))continue;
      seen.add(id);
      const children=await listChildren(token,id);
      for(const file of children){
        if(file.mimeType===FOLDER_MIME)queue.push(file.id);
        else if(isAudio(file))audio.push(file);
      }
    }
    return audio.sort(natural);
  }

  function dedupe(files){
    const groups=new Map();
    for(const file of files){
      const key=String(file.name||'')
        .replace(/\.(?:mp3|wma|m4a|aac|wav|ogg)$/i,'')
        .replace(/\s+/g,' ')
        .trim()
        .toLowerCase();
      const previous=groups.get(key);
      if(!previous||(!isMp3(previous)&&isMp3(file)))groups.set(key,file);
    }
    return [...groups.values()].sort(natural);
  }

  function fileInfo(name){
    const value=String(name||'');
    const cd=value.match(/CD\s*0*(\d+)\D+0*(\d+)(?=\D*\.(?:mp3|wma|m4a|aac|wav|ogg)$)/i);
    if(cd)return{disc:+cd[1],track:+cd[2]};
    const track=value.match(/Track\s*0*(\d+)/i)||value.match(/(?:^|\D)0*(\d{1,3})(?=\D*\.(?:mp3|wma|m4a|aac|wav|ogg)$)/i);
    return{disc:0,track:track?+track[1]:0};
  }
  function rangeInfo(value){
    const text=String(value||'');
    const cd=text.match(/CD\s*0*(\d+)\D+0*(\d+)/i);
    if(cd)return{disc:+cd[1],track:+cd[2]};
    const track=text.match(/(?:Track\s*)?0*(\d{1,3})/i);
    return track?{disc:0,track:+track[1]}:null;
  }

  function targetsFor(book,file){
    const lessons=lessonsForBook(book.book_id);
    const info=fileInfo(file.name);
    const n=info.track;
    const byRange=lessons.filter(item=>{
      const start=rangeInfo(item.audio_track_start);
      const end=rangeInfo(item.audio_track_end);
      if(!start||!end)return false;
      if(start.disc&&info.disc!==start.disc)return false;
      if(end.disc&&info.disc!==end.disc)return false;
      return inRange(n,start.track,end.track);
    });
    if(byRange.length)return byRange;

    if(book.book_id==='BJT-MOCK'){
      const ranges={
        'BJT-MOCK-P1S1':[1,13],
        'BJT-MOCK-P1S2':[14,25],
        'BJT-MOCK-P1S3':[26,49],
        'BJT-MOCK-P2S1':[50,68],
        'BJT-MOCK-P2S2':[69,79]
      };
      return lessons.filter(item=>ranges[item.lesson_id]&&inRange(n,...ranges[item.lesson_id]));
    }
    if(book.book_id==='BJT-RED'){
      const ranges={
        'BJT-RED-P1S1':[1,13],
        'BJT-RED-P1S2':[14,25],
        'BJT-RED-P1S3':[26,43],
        'BJT-RED-P2S1':[44,59],
        'BJT-RED-P2S2':[60,76]
      };
      return lessons.filter(item=>ranges[item.lesson_id]&&inRange(n,...ranges[item.lesson_id]));
    }
    if(book.book_id==='BUSINESS-BLUE'){
      if(inRange(n,1,45))return [lessonById(`BUSINESS-BLUE-U${pad2(n)}`)].filter(Boolean);
      if(inRange(n,46,51)){
        const pair=n-45;
        return [lessonById(`BUSINESS-BLUE-R${pad2(pair*2-1)}`),lessonById(`BUSINESS-BLUE-R${pad2(pair*2)}`)].filter(Boolean);
      }
    }
    if(book.book_id==='BUSINESS-30H'){
      const chapter=Math.min(8,Math.max(1,Math.ceil(n/7)));
      return [lessonById(`BUSINESS-30H-C${pad2(chapter)}`)].filter(Boolean);
    }
    return [];
  }

  function labelFor(book,file){
    const info=fileInfo(file.name);
    if(info.disc)return`CD${info.disc}-${pad2(info.track)}`;
    if(book.book_id==='BJT-MOCK'&&info.track)return info.track<=49?`CD1-Track${pad2(info.track)}`:`CD2-Track${pad2(info.track-49)}`;
    return info.track?`Track ${pad2(info.track)}`:file.name;
  }

  function mediaRow(book,lesson,file,index,fallback=false){
    const info=fileInfo(file.name);
    return{
      media_id:`${book.book_id}-ALL-${lesson.lesson_id}-${file.id}${fallback?'-LIB':''}`,
      book_id:book.book_id,
      lesson_id:lesson.lesson_id,
      media_type:'audio',
      track_label:labelFor(book,file),
      file_name:file.name,
      mime_type:file.mimeType||(/\.wma$/i.test(file.name)?'audio/x-ms-wma':'audio/mpeg'),
      drive_file_id:file.id,
      file_url:`https://drive.google.com/file/d/${file.id}/view`,
      sort_order:(info.disc||0)*1000+(info.track||index+1),
      verification_status:fallback?'runtime_book_library':'runtime_drive_folder',
      notes:fallback?'Toàn bộ audio của sách':'Mapped từ thư mục Google Drive',
      runtime_folder:true
    };
  }

  function injectBook(book,rawFiles){
    const files=dedupe(rawFiles);
    const lessons=lessonsForBook(book.book_id);
    const rows=[];
    const counts=new Map(lessons.map(item=>[item.lesson_id,0]));
    files.forEach((file,index)=>{
      for(const lesson of targetsFor(book,file)){
        rows.push(mediaRow(book,lesson,file,index,false));
        counts.set(lesson.lesson_id,(counts.get(lesson.lesson_id)||0)+1);
      }
    });
    for(const lesson of lessons){
      const hasDeclaredRange=Boolean(rangeInfo(lesson.audio_track_start)&&rangeInfo(lesson.audio_track_end));
      if((counts.get(lesson.lesson_id)||0)>0||!hasDeclaredRange)continue;
      files.forEach((file,index)=>rows.push(mediaRow(book,lesson,file,index,true)));
    }
    state.media=state.media.filter(item=>!(item.book_id===book.book_id&&item.media_type==='audio'));
    state.media.push(...rows);
    return{files,rows};
  }

  function refreshCurrent(bookId){
    if(state.bookId!==bookId)return;
    const bar=document.querySelector('.study-audio-bar');
    if(bar)delete bar.dataset.audioEnhanced;
    window.BJT_AUDIO?.enhance?.();
    window.BJT_AUDIO_REPLAY?.sync?.();
  }

  function setCurrentStatus(bookId,text){
    if(state.bookId!==bookId)return;
    const element=document.getElementById('audioStatus');
    if(element)element.textContent=text;
  }

  async function ensureBook(token,bookId,{force=false}={}){
    const book=state.books.find(item=>item.book_id===bookId);
    if(!bookHasAudio(book))return{loaded:false,count:0,bookId};
    if(loading.has(bookId))return loading.get(bookId);
    const job=(async()=>{
      setCurrentStatus(bookId,`Đang nạp kho audio của ${book.book_title}…`);
      let files=force?null:cacheRead(bookId);
      if(!files){
        files=await listFolderTree(token,folderId(book.source_folder_url));
        cacheWrite(bookId,files);
      }
      if(!files.length)throw new Error(`Không tìm thấy audio của ${book.book_title}.`);
      const result=injectBook(book,files);
      refreshCurrent(bookId);
      const wma=result.files.filter(file=>/\.wma$/i.test(file.name)||/x-ms-wma/i.test(file.mimeType||'')).length;
      setCurrentStatus(bookId,`${result.files.length} track đã nạp${wma?` · ${wma} WMA`:''}`);
      window.dispatchEvent(new CustomEvent('bjt-audio-library-ready',{detail:{bookId,count:result.files.length,wma}}));
      scheduleDecorate();
      return{loaded:true,bookId,count:result.files.length,wma};
    })().finally(()=>loading.delete(bookId));
    loading.set(bookId,job);
    return job;
  }

  async function preloadAll(token,{force=false}={}){
    if(!token)return{loaded:0,failed:0,results:[]};
    if(preloadJob&&!force)return preloadJob;
    const books=state.books.filter(bookHasAudio);
    preloadJob=(async()=>{
      const results=[];
      for(let index=0;index<books.length;index+=2){
        const batch=books.slice(index,index+2);
        const settled=await Promise.allSettled(batch.map(book=>ensureBook(token,book.book_id,{force})));
        settled.forEach((result,i)=>results.push({bookId:batch[i].book_id,...result}));
      }
      const loaded=results.filter(item=>item.status==='fulfilled').length;
      const failed=results.length-loaded;
      window.dispatchEvent(new CustomEvent('bjt-all-audio-ready',{detail:{loaded,failed,total:books.length}}));
      scheduleDecorate();
      return{loaded,failed,results};
    })().finally(()=>{preloadJob=null;});
    return preloadJob;
  }

  const previousFolder=window.BJT_AUDIO_FOLDER||{};
  window.BJT_AUDIO_FOLDER={
    ...previousFolder,
    ensureBook,
    ensureCurrentLesson:(token,options={})=>ensureBook(token,state.bookId,options),
    preloadAll,
    clearCache:bookId=>{
      if(bookId){
        memoryCache.delete(bookId);
        try{localStorage.removeItem(CACHE_PREFIX+bookId);}catch{}
      }else{
        state.books.forEach(book=>{
          memoryCache.delete(book.book_id);
          try{localStorage.removeItem(CACHE_PREFIX+book.book_id);}catch{}
        });
      }
      previousFolder.clearCache?.(bookId);
    },
    hasCached:bookId=>Boolean(cacheRead(bookId)||previousFolder.hasCached?.(bookId))
  };

  const previousAuthorize=window.BJT_AUDIO?.authorizeGoogle?.bind(window.BJT_AUDIO);
  if(previousAuthorize){
    window.BJT_AUDIO.authorizeGoogle=async(...args)=>{
      const token=await previousAuthorize(...args);
      if(token)preloadAll(token).catch(()=>{});
      return token;
    };
  }

  async function connectFromAuthButton(button){
    if(!previousAuthorize)return;
    button.disabled=true;
    const oldText=button.textContent;
    button.textContent=hasGranted()?'Đang khôi phục…':'Đang kết nối…';
    try{
      const token=await window.BJT_AUDIO.authorizeGoogle();
      await ensureBook(token,state.bookId);
      window.BJT_AUDIO?.enhance?.();
    }catch(error){
      const status=document.getElementById('audioStatus');
      if(status)status.textContent=error?.message||'Không kết nối được Google Drive.';
    }finally{
      button.disabled=false;
      button.textContent=oldText;
      syncRememberedUi();
    }
  }

  function syncRememberedUi(){
    const valid=Boolean(readSession());
    const remembered=hasGranted();
    document.querySelectorAll('.audio-auth-badge').forEach(element=>{
      element.classList.toggle('connected',valid||remembered);
      element.textContent=valid?'Google đã kết nối':remembered?'Google đã nhớ':'Chưa đăng nhập';
    });
    document.querySelectorAll('.audio-session-note').forEach(element=>{
      element.textContent=valid
        ?'Quyền Drive đang được khôi phục từ localStorage trên thiết bị này.'
        :remembered
          ?'Quyền Google đã được nhớ. Bấm Play để tự khôi phục phiên, không cần chọn lại tài khoản khi Google vẫn đang đăng nhập.'
          :'Lần đầu cần cấp quyền đọc Drive. Ứng dụng không lưu mật khẩu hay cookie Google.';
    });
    document.querySelectorAll('[data-google-auth]').forEach(button=>{
      if(button.disabled)return;
      button.classList.toggle('connected',valid||remembered);
      button.textContent=valid?'✓ Google đã kết nối':remembered?'↻ Khôi phục Google':'G Kết nối Google';
    });
  }

  function decorateCatalog(){
    const audioBooks=state.books.filter(bookHasAudio);
    const bookMap=new Map(state.books.map(book=>[book.book_id,book]));
    document.querySelectorAll('.book-btn[data-id]').forEach(button=>{
      const book=bookMap.get(button.dataset.id);
      if(!book)return;
      const small=button.querySelector('small');
      if(!small)return;
      const base=small.textContent.replace(/\s*·\s*(?:♫\s*\d+\s*track|PDF đọc)$/i,'');
      small.textContent=bookHasAudio(book)
        ?`${base} · ♫ ${+book.audio_track_count||'nhiều'} track`
        :`${base} · PDF đọc`;
      button.classList.toggle('has-audio-book',bookHasAudio(book));
      button.dataset.audioTracks=bookHasAudio(book)?String(+book.audio_track_count||''):'';
    });
    const book=currentBook();
    const badge=document.getElementById('bookBadge');
    if(book&&badge)badge.textContent=bookHasAudio(book)?`♫ ${+book.audio_track_count||'Audio'} track`:'PDF đọc';
    const hero=document.querySelector('.hero p:not(.eyebrow)');
    if(hero)hero.textContent=`Đủ ${state.books.length} giáo trình: ${audioBooks.length} sách có audio, ${state.books.length-audioBooks.length} sách đọc PDF.`;
    syncRememberedUi();

    const token=readSession()?.access_token;
    if(token&&bookHasAudio(book))ensureBook(token,book.book_id).catch(()=>{});
  }
  function scheduleDecorate(){
    clearTimeout(decorateTimer);
    decorateTimer=setTimeout(decorateCatalog,40);
  }

  const style=document.createElement('style');
  style.textContent=`
    .book-btn.has-audio-book strong::after{content:'♫';display:inline-flex;margin-left:.45rem;font-size:.78em;opacity:.8}
    .book-btn.has-audio-book small{font-weight:650}
    .book-btn[data-audio-tracks]:not([data-audio-tracks='']){border-inline-start:3px solid color-mix(in srgb,currentColor 38%,transparent)}
  `;
  document.head.appendChild(style);

  document.addEventListener('click',event=>{
    const auth=event.target.closest('[data-google-auth]');
    if(!auth)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    connectFromAuthButton(auth);
  },true);

  window.addEventListener('bjt-audio-state',syncRememberedUi);
  window.addEventListener('bjt-audio-library-ready',scheduleDecorate);
  window.addEventListener('bjt-all-audio-ready',scheduleDecorate);
  window.addEventListener('storage',event=>{
    if(event.key===TOKEN_KEY||event.key===GRANTED_KEY){syncRememberedUi();scheduleDecorate();}
  });
  window.addEventListener('DOMContentLoaded',()=>{
    const bookList=document.getElementById('bookList');
    if(bookList)new MutationObserver(scheduleDecorate).observe(bookList,{childList:true,subtree:true});
    const detail=document.getElementById('lessonDetail');
    if(detail)new MutationObserver(scheduleDecorate).observe(detail,{childList:true,subtree:false});
    scheduleDecorate();
  });
  window.addEventListener('load',()=>{
    scheduleDecorate();
    const token=readSession()?.access_token;
    if(token)preloadAll(token).catch(()=>{});
  });

  window.BJT_AUDIO_RELIABILITY={ensureBook,preloadAll,decorateCatalog,hasGranted,getSession:readSession};
})();