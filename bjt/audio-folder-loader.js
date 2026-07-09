(()=>{
  const {state}=BJT;
  const cache=new Map();
  const loading=new Map();
  const CACHE_PREFIX='bjtDriveFolderCacheV7:';
  const CACHE_TTL=24*60*60*1000;
  const FOLDER_MIME='application/vnd.google-apps.folder';
  const folderId=url=>String(url||'').match(/\/folders\/([^/?#]+)/)?.[1]||'';
  const pad2=n=>String(+n||0).padStart(2,'0');
  const status=text=>{const el=document.getElementById('audioStatus');if(el)el.textContent=text;};
  const natural=(a,b)=>String(a.name||'').localeCompare(String(b.name||''),undefined,{numeric:true,sensitivity:'base'});
  const isAudio=f=>/^audio\//i.test(f.mimeType||'')||/\.(?:mp3|m4a|aac|wav|ogg|wma)$/i.test(f.name||'');
  const isMp3=f=>/audio\/mpeg/i.test(f.mimeType||'')||/\.mp3$/i.test(f.name||'');
  const isAudioBook=book=>{
    const value=String(book?.audio_available??'').toLowerCase();
    return value==='true'||value==='1'||value==='yes'||(+book?.audio_track_count||0)>0;
  };
  const lessonsForBook=id=>state.lessons.filter(l=>l.book_id===id).sort((a,b)=>(+a.sort_order||0)-(+b.sort_order||0));
  const lessonById=id=>state.lessons.find(l=>l.lesson_id===id);
  const bookById=id=>state.books.find(b=>b.book_id===id);

  function cacheRead(bookId){
    if(cache.has(bookId))return cache.get(bookId);
    try{
      const saved=JSON.parse(localStorage.getItem(CACHE_PREFIX+bookId)||'null');
      if(saved&&Date.now()-saved.time<CACHE_TTL&&Array.isArray(saved.files)){
        cache.set(bookId,saved.files);
        return saved.files;
      }
    }catch{}
    return null;
  }
  function cacheWrite(bookId,files){
    cache.set(bookId,files);
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
      const res=await fetch(`https://www.googleapis.com/drive/v3/files?${params}`,{headers:{Authorization:`Bearer ${token}`}});
      if(!res.ok){
        let message='';
        try{message=(await res.json())?.error?.message||'';}catch{}
        throw new Error(message||`Không đọc được thư mục audio (${res.status}).`);
      }
      const data=await res.json();
      files.push(...(data.files||[]));
      pageToken=data.nextPageToken||'';
    }while(pageToken);
    return files;
  }

  async function listFolderTree(token,rootId){
    const queue=[rootId],seen=new Set(),audio=[];
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
      const key=String(file.name||'').replace(/\.(?:mp3|wma|m4a|aac|wav|ogg)$/i,'').replace(/\s+/g,' ').trim().toLowerCase();
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
  const inRange=(n,a,b)=>n>=a&&n<=b;

  function explicitTargets(book,file){
    const lessons=lessonsForBook(book.book_id),info=fileInfo(file.name),n=info.track;
    const byLessonRange=lessons.filter(lesson=>{
      const start=rangeInfo(lesson.audio_track_start),end=rangeInfo(lesson.audio_track_end);
      if(!start||!end)return false;
      if(start.disc&&info.disc!==start.disc)return false;
      if(end.disc&&info.disc!==end.disc)return false;
      return inRange(n,start.track,end.track);
    });
    if(byLessonRange.length)return byLessonRange;

    if(book.book_id==='BJT-MOCK'){
      const ranges={
        'BJT-MOCK-P1S1':[4,13],
        'BJT-MOCK-P1S2':[16,25],
        'BJT-MOCK-P1S3':[28,43],
        'BJT-MOCK-P2S1':[44,58],
        'BJT-MOCK-P2S2':[61,75]
      };
      return lessons.filter(l=>ranges[l.lesson_id]&&inRange(n,...ranges[l.lesson_id]));
    }
    if(book.book_id==='BJT-RED'){
      const ranges={
        'BJT-RED-P1S1':[1,13],
        'BJT-RED-P1S2':[14,25],
        'BJT-RED-P1S3':[26,43],
        'BJT-RED-P2S1':[44,59],
        'BJT-RED-P2S2':[60,76]
      };
      return lessons.filter(l=>ranges[l.lesson_id]&&inRange(n,...ranges[l.lesson_id]));
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
    if(book.book_id==='BJT-MOCK'&&info.track)return info.track<=43?`CD1-Track${pad2(info.track)}`:`CD2-Track${pad2(info.track-43)}`;
    return info.track?`Track ${pad2(info.track)}`:file.name;
  }
  function rowFor(book,lesson,file,index,fallback=false){
    const info=fileInfo(file.name);
    return{
      media_id:`${book.book_id}-DRIVE-${lesson.lesson_id}-${file.id}${fallback?'-LIB':''}`,
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
      notes:fallback?'Toàn bộ audio của sách được mở tại mục này':'Mapped from restricted Drive folder',
      runtime_folder:true
    };
  }

  function inject(book,rawFiles){
    const files=dedupe(rawFiles),lessons=lessonsForBook(book.book_id),rows=[];
    const counts=new Map(lessons.map(l=>[l.lesson_id,0]));
    files.forEach((file,index)=>{
      for(const lesson of explicitTargets(book,file)){
        rows.push(rowFor(book,lesson,file,index,false));
        counts.set(lesson.lesson_id,(counts.get(lesson.lesson_id)||0)+1);
      }
    });
    for(const lesson of lessons){
      if((counts.get(lesson.lesson_id)||0)>0)continue;
      files.forEach((file,index)=>rows.push(rowFor(book,lesson,file,index,true)));
    }
    state.media=state.media.filter(m=>!(m.book_id===book.book_id&&m.media_type==='audio'));
    state.media.push(...rows);
    return{rows,files};
  }

  function refresh(bookId){
    if(bookId!==state.bookId)return;
    const bar=document.querySelector('.study-audio-bar');
    if(bar)delete bar.dataset.audioEnhanced;
    window.BJT_AUDIO?.enhance?.();
    window.BJT_AUDIO_REPLAY?.sync?.();
  }

  function hydrateCachedBooks(){
    if(!state.books.length||!state.lessons.length)return false;
    for(const book of state.books.filter(isAudioBook)){
      const files=cacheRead(book.book_id);
      if(files?.length)inject(book,files);
    }
    refresh(state.bookId);
    return true;
  }

  async function ensureBook(token,bookId,{force=false}={}){
    const book=bookById(bookId);
    if(!book||!isAudioBook(book))return{loaded:false,count:0};
    const id=folderId(book.source_folder_url);
    if(!id)return{loaded:false,count:0};
    if(loading.has(bookId))return loading.get(bookId);
    const job=(async()=>{
      if(bookId===state.bookId)status(`Đang nạp kho audio của ${book.book_title}…`);
      let files=force?null:cacheRead(bookId);
      if(!files){files=await listFolderTree(token,id);cacheWrite(bookId,files);}
      if(!files.length)throw new Error(`Không tìm thấy audio của ${book.book_title}.`);
      const result=inject(book,files);
      refresh(bookId);
      const wma=result.files.filter(f=>/\.wma$/i.test(f.name)||/x-ms-wma/i.test(f.mimeType||'')).length;
      if(bookId===state.bookId)status(`${result.files.length} track đã nạp cho ${book.book_title}${wma?` · ${wma} WMA chưa có MP3`:''}`);
      window.dispatchEvent(new CustomEvent('bjt-audio-library-ready',{detail:{bookId,count:result.files.length,wma}}));
      return{loaded:true,bookId,count:result.files.length,wma};
    })().finally(()=>loading.delete(bookId));
    loading.set(bookId,job);
    return job;
  }

  async function ensureCurrentLesson(token,options={}){
    return ensureBook(token,state.bookId,options);
  }

  async function ensureAll(token,{skipBookId=''}={}){
    const results=[];
    for(const book of state.books.filter(isAudioBook)){
      if(book.book_id===skipBookId)continue;
      try{results.push(await ensureBook(token,book.book_id));}
      catch(error){results.push({loaded:false,bookId:book.book_id,error:error?.message||String(error)});}
    }
    return results;
  }

  let hydrateTries=0;
  const hydrateTimer=setInterval(()=>{
    hydrateTries++;
    if(hydrateCachedBooks()||hydrateTries>100)clearInterval(hydrateTimer);
  },100);

  window.BJT_AUDIO_FOLDER={
    ensureBook,
    ensureCurrentLesson,
    ensureAll,
    hydrateCachedBooks,
    clearCache:bookId=>{cache.delete(bookId);try{localStorage.removeItem(CACHE_PREFIX+bookId);}catch{}},
    hasCached:bookId=>Boolean(cacheRead(bookId))
  };
})();