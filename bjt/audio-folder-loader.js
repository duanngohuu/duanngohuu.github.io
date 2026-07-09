(()=>{
  const {state}=BJT;
  const cache=new Map();
  const loading=new Map();
  const CACHE_PREFIX='bjtDriveFolderCacheV3:';
  const CACHE_TTL=30*60*1000;
  const folderId=url=>String(url||'').match(/\/folders\/([^/?#]+)/)?.[1]||'';
  const pad2=n=>String(+n||0).padStart(2,'0');
  const status=text=>{const el=document.getElementById('audioStatus');if(el)el.textContent=text;};
  const natural=(a,b)=>String(a.name||'').localeCompare(String(b.name||''),undefined,{numeric:true,sensitivity:'base'});
  const isAudio=f=>/^audio\//i.test(f.mimeType||'')||/\.(?:mp3|m4a|aac|wav|ogg|wma)$/i.test(f.name||'');
  const isMp3=f=>/audio\/mpeg/i.test(f.mimeType||'')||/\.mp3$/i.test(f.name||'');
  const lessonById=id=>state.lessons.find(l=>l.lesson_id===id);
  const lessonsForBook=id=>state.lessons.filter(l=>l.book_id===id);

  function cacheRead(bookId){
    if(cache.has(bookId))return cache.get(bookId);
    try{
      const saved=JSON.parse(localStorage.getItem(CACHE_PREFIX+bookId)||'null');
      if(saved&&Date.now()-saved.time<CACHE_TTL&&Array.isArray(saved.files)){
        cache.set(bookId,saved.files);return saved.files;
      }
    }catch{}
    return null;
  }
  function cacheWrite(bookId,files){
    cache.set(bookId,files);
    try{localStorage.setItem(CACHE_PREFIX+bookId,JSON.stringify({time:Date.now(),files}));}catch{}
  }

  async function listFolder(token,id){
    const files=[];let pageToken='';
    do{
      const params=new URLSearchParams({
        q:`'${id}' in parents and trashed = false`,
        pageSize:'1000',
        fields:'nextPageToken,files(id,name,mimeType,size)',
        orderBy:'name',
        supportsAllDrives:'true',
        includeItemsFromAllDrives:'true'
      });
      if(pageToken)params.set('pageToken',pageToken);
      const res=await fetch(`https://www.googleapis.com/drive/v3/files?${params}`,{headers:{Authorization:`Bearer ${token}`}});
      if(!res.ok){
        let message='';try{message=(await res.json())?.error?.message||'';}catch{}
        throw new Error(message||`Không đọc được thư mục audio (${res.status}).`);
      }
      const data=await res.json();files.push(...(data.files||[]));pageToken=data.nextPageToken||'';
    }while(pageToken);
    return files.filter(isAudio).sort(natural);
  }

  function dedupe(files){
    const groups=new Map();
    for(const file of files){
      const key=String(file.name||'').replace(/\.(?:mp3|wma|m4a|aac|wav|ogg)$/i,'').toLowerCase();
      const previous=groups.get(key);
      if(!previous||(!isMp3(previous)&&isMp3(file)))groups.set(key,file);
    }
    return [...groups.values()].sort(natural);
  }
  function yellowInfo(name){const m=String(name).match(/CD\s*(\d+)\D+(\d+)\.(?:mp3|m4a|aac|wav|ogg)$/i);return m?{disc:+m[1],track:+m[2]}:null;}
  function rangeInfo(value){const m=String(value||'').match(/CD\s*(\d+)\D+(\d+)/i);return m?{disc:+m[1],track:+m[2]}:null;}
  function plainTrack(name){const m=String(name||'').match(/(?:^|\D)(\d{1,3})(?=\D*(?:\.(?:mp3|wma|m4a|aac|wav|ogg))?$)/i)||String(name||'').match(/Track\s*0*(\d+)/i);return m?+m[1]:0;}

  function targetsFor(book,file){
    const id=book.book_id,ls=lessonsForBook(id),n=plainTrack(file.name);
    if(id==='BJT-YELLOW'){
      const info=yellowInfo(file.name);if(!info)return[];
      return ls.filter(l=>{const s=rangeInfo(l.audio_track_start),e=rangeInfo(l.audio_track_end);return s&&e&&info.disc===s.disc&&info.disc===e.disc&&info.track>=s.track&&info.track<=e.track;});
    }
    if(id==='BJT-RED'){
      const ranges={
        'BJT-RED-P1S1':[1,13],
        'BJT-RED-P1S2':[14,25],
        'BJT-RED-P1S3':[26,43],
        'BJT-RED-P2S1':[44,59],
        'BJT-RED-P2S2':[60,76]
      };
      return ls.filter(l=>ranges[l.lesson_id]&&n>=ranges[l.lesson_id][0]&&n<=ranges[l.lesson_id][1]);
    }
    if(id==='BUSINESS-BLUE'){
      if(n>=1&&n<=45){const l=lessonById(`BUSINESS-BLUE-U${pad2(n)}`);return l?[l]:[];}
      const appendix=lessonById('BUSINESS-BLUE-EXP');return appendix?[appendix]:[];
    }
    if(id==='BUSINESS-30H'){
      return ls.filter(l=>/^BUSINESS-30H-C\d{2}$/.test(l.lesson_id));
    }
    return[];
  }

  function labelFor(book,file){
    if(book.book_id==='BJT-YELLOW'){
      const x=yellowInfo(file.name);if(x)return`CD${x.disc}-${pad2(x.track)}`;
    }
    const n=plainTrack(file.name);return n?`Track ${pad2(n)}`:file.name;
  }
  function inject(book,files){
    const rows=[];
    for(const file of dedupe(files)){
      const targets=targetsFor(book,file);
      for(const lesson of targets){
        const n=plainTrack(file.name);
        rows.push({
          media_id:`${book.book_id}-DRIVE-${lesson.lesson_id}-${file.id}`,
          book_id:book.book_id,
          lesson_id:lesson.lesson_id,
          media_type:'audio',
          track_label:labelFor(book,file),
          file_name:file.name,
          mime_type:file.mimeType||(/\.wma$/i.test(file.name)?'audio/x-ms-wma':'audio/mpeg'),
          drive_file_id:file.id,
          file_url:`https://drive.google.com/file/d/${file.id}/view`,
          sort_order:n||rows.length+1,
          verification_status:'runtime_drive_folder',
          notes:'Loaded from restricted Drive folder at runtime',
          runtime_folder:true
        });
      }
    }
    state.media=state.media.filter(m=>m.book_id!==book.book_id||!m.runtime_folder&&!['BJT-YELLOW','BJT-RED','BUSINESS-BLUE','BUSINESS-30H'].includes(book.book_id));
    state.media.push(...rows);
    return rows;
  }
  function refresh(){
    const bar=document.querySelector('.study-audio-bar');
    if(bar)delete bar.dataset.audioEnhanced;
    window.BJT_AUDIO?.enhance?.();
  }

  async function ensureCurrentLesson(token){
    const book=state.books.find(b=>b.book_id===state.bookId);
    if(!book)return{loaded:false,count:0};
    if(book.book_id==='BJT-MOCK')return{loaded:false,count:state.media.filter(m=>m.book_id===book.book_id).length};
    const id=folderId(book.source_folder_url);
    if(!id)return{loaded:false,count:0};
    if(loading.has(book.book_id))return loading.get(book.book_id);
    const job=(async()=>{
      status(`Đang đọc toàn bộ audio của ${book.book_title}…`);
      let files=cacheRead(book.book_id);
      if(!files){files=await listFolder(token,id);cacheWrite(book.book_id,files);}
      if(!files.length)throw new Error('Không tìm thấy file audio trong thư mục của sách này.');
      const rows=inject(book,files);refresh();
      const unique=new Set(rows.map(r=>r.drive_file_id)).size;
      const wma=files.filter(f=>/\.wma$/i.test(f.name)||/x-ms-wma/i.test(f.mimeType||'')).length;
      status(`${unique} track đã nạp${wma?` · ${wma} file WMA cần bản MP3 để phát trên iPhone`:''}`);
      return{loaded:true,count:unique,wma};
    })().finally(()=>loading.delete(book.book_id));
    loading.set(book.book_id,job);return job;
  }

  window.BJT_AUDIO_FOLDER={ensureCurrentLesson,clearCache:bookId=>{cache.delete(bookId);try{localStorage.removeItem(CACHE_PREFIX+bookId);}catch{}}};
})();