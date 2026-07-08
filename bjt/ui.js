(()=>{
  const {state,done,$}=BJT;
  const lessons=id=>state.lessons.filter(x=>x.book_id===id).sort((a,b)=>(+a.sort_order||0)-(+b.sort_order||0));
  const start=l=>+(l.pdf_page_start||l.page_start||0);
  const end=l=>+(l.pdf_page_end||l.page_end||start(l));
  const count=l=>+(l.question_count||l.item_count||0);
  const status=b=>b.verification_status||b.extraction_status||b.data_status||'';
  const ready=b=>/complete|verified/.test(status(b));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const driveId=url=>String(url||'').match(/\/d\/([^/?#]+)/)?.[1]||String(url||'').match(/[?&]id=([^&#]+)/)?.[1]||'';
  const folderId=url=>String(url||'').match(/\/folders\/([^/?#]+)/)?.[1]||'';
  const drivePreview=url=>{const id=driveId(url);return id?`https://drive.google.com/file/d/${id}/preview`:''};
  const directMedia=url=>{const id=driveId(url);return id?`https://drive.google.com/uc?export=download&id=${id}`:''};
  const norm=s=>String(s||'').replace(/^Phần \d+\s*-\s*/,'').replace(/^Section \d+\s*-\s*/,'').trim();
  const memoCurrentKey=id=>`bjtMemoCurrent:${id}`;
  const memoHistoryKey=id=>`bjtMemoHistory:${id}`;
  const audioKey=id=>`bjtAudioLink:${id}`;

  function books(){
    const q=state.query.toLowerCase();
    $('bookList').innerHTML=state.books.filter(b=>!q||String(b.book_title).toLowerCase().includes(q)||lessons(b.book_id).some(l=>(l.part_title+' '+l.section_title).toLowerCase().includes(q))).map(b=>{
      const ls=lessons(b.book_id),n=ls.filter(l=>done.has(l.lesson_id)).length,p=ls.length?Math.round(n/ls.length*100):0;
      return `<button class="book-btn ${b.book_id===state.bookId?'active':''}" data-id="${esc(b.book_id)}"><strong>${esc(b.book_title)}</strong><small>${esc(b.pages||'?')} trang · ${ls.length} bài · ${esc(b.question_inventory_count||b.question_count||0)} câu/mục</small><div class="book-progress"><div style="width:${p}%"></div></div></button>`;
    }).join('');
    document.querySelectorAll('.book-btn').forEach(x=>x.onclick=()=>{state.bookId=x.dataset.id;state.lessonId='';state.questionId='';localStorage.setItem('bjtLastBook',state.bookId);render();});
  }

  function lessonMenu(){
    const b=state.books.find(x=>x.book_id===state.bookId);if(!b)return;
    let ls=lessons(b.book_id);
    if(state.query){const q=state.query.toLowerCase();ls=ls.filter(l=>(l.part_title+' '+l.section_title).toLowerCase().includes(q));}
    $('bookTitle').textContent=b.book_title;
    $('bookInfo').textContent=`${b.pages||'?'} trang · ${b.lesson_count||ls.length} bài/section · ${b.page_indexed_count||b.pages||0} trang đã lập chỉ mục`;
    $('bookBadge').textContent=ready(b)?'Đã lập chỉ mục':'Đang xử lý';
    if(!ls.length){$('lessonGroups').innerHTML='<div class="empty">Sách này chưa có bài đã xác minh.</div>';state.lessonId='';return;}
    const groups=ls.reduce((a,x)=>((a[x.part_title||b.book_title]??=[]).push(x),a),{});
    $('lessonGroups').innerHTML=Object.entries(groups).map(([g,a])=>`<section class="lesson-group"><div class="group-head"><strong>${esc(g)}</strong><span>${a.length} mục</span></div><div class="lesson-list">${a.map((l,i)=>`<button class="lesson-card ${l.lesson_id===state.lessonId?'active':''} ${done.has(l.lesson_id)?'done':''}" data-id="${esc(l.lesson_id)}"><div class="top"><span>${done.has(l.lesson_id)?'✓':String(i+1).padStart(2,'0')}</span><span>tr. ${start(l)}-${end(l)}</span></div><strong>${esc(l.section_title)}</strong><small>${count(l)?count(l)+' câu/mục · ':''}${esc(l.verification_status||'indexed')}</small></button>`).join('')}</div></section>`).join('');
    document.querySelectorAll('.lesson-card').forEach(x=>x.onclick=()=>{state.lessonId=x.dataset.id;state.questionId='';localStorage.setItem('bjtLastLesson',state.lessonId);render();});
    if(!state.lessonId||!ls.some(x=>x.lesson_id===state.lessonId)){state.lessonId=ls[0].lesson_id;state.questionId='';localStorage.setItem('bjtLastLesson',state.lessonId);}
  }

  function questionView(q){
    if(!q)return'<div class="empty">Nội dung chi tiết của bài này đang được chuyển đổi.</div>';
    const visual=q.content_mode==='visual_page';
    const opts=[q.option_1_z,q.option_2_x,q.option_3_c,q.option_4_v],symbols=['z','x','c','v'];
    const options=visual?'':`<div class="q-options">${opts.map((o,i)=>`<button class="q-option"><b>${symbols[i]}</b>${esc(o)}</button>`).join('')}</div>`;
    const script=q.script_jp?`<details class="q-script"><summary>Script / nội dung nghe</summary>${esc(q.script_jp)}</details>`:'';
    return `<div class="q-view"><div class="q-head"><strong>Q${esc(q.question_no)}</strong><span>${esc(q.audio_track||'Không có audio')} · trang ${esc(q.pdf_page)}</span></div><p class="q-prompt">${esc(q.prompt_jp)}</p>${script}${options}<div class="q-tools"><button id="revealAnswer" class="action">Hiện 正答</button></div><div id="answerBox" class="q-answer"><b>正答 ${esc(q.answer_symbol)} / ${esc(q.answer_no)}:</b> ${esc(q.answer_text||`Lựa chọn số ${q.answer_no}`)}</div></div>`;
  }

  function convertedView(rows){
    if(!rows.length)return'<div class="empty">Nội dung chi tiết của bài này đang được chuyển đổi.</div>';
    const dialogues=rows.filter(r=>r.content_type==='dialogue'),question=rows.find(r=>r.content_type==='question'),vocab=rows.filter(r=>r.content_type==='vocabulary'),notes=rows.filter(r=>r.content_type==='note');
    return `<div class="q-view"><div class="q-head"><strong>Nội dung đã chuyển đổi</strong><span>${rows.length} dòng data</span></div>${dialogues.map(r=>`<div class="converted-dialogue"><b>${esc(r.speaker||'')}</b><div class="jp">${esc(r.japanese)}</div>${r.reading?`<div class="reading">${esc(r.reading)}</div>`:''}${r.meaning_vi?`<div class="vi">${esc(r.meaning_vi)}</div>`:''}</div>`).join('')}${question?`<div class="q-options"><p class="q-prompt">${esc(question.question_jp)}</p>${[1,2,3,4].map(i=>`<button class="q-option"><b>${i}</b>${esc(question['option_'+i])}</button>`).join('')}<div class="q-answer show"><b>正答 ${esc(question.answer_no)}:</b> ${esc(question.answer_text)}</div></div>`:''}${vocab.length?`<details class="q-script" open><summary>Từ vựng</summary>${vocab.map(v=>`<div><b>${esc(v.vocabulary_jp)}</b> (${esc(v.vocabulary_reading)}) — ${esc(v.vocabulary_meaning_vi)}</div>`).join('')}</details>`:''}${notes.length?`<details class="q-script"><summary>Giải thích mẫu câu</summary>${notes.map(n=>`<div><b>${esc(n.japanese)}</b><br>${esc(n.grammar_note_vi||n.meaning_vi)}</div>`).join('<hr>')}</details>`:''}</div>`;
  }

  function selectedMedia(b,l){
    const saved=localStorage.getItem(audioKey(l.lesson_id));
    if(saved)return{file_url:saved,file_name:'Link audio riêng',mime_type:/\.wma(?:$|\?)/i.test(saved)?'audio/x-ms-wma':'audio/mpeg',track_label:'Tuỳ chỉnh'};
    const exact=state.media.filter(m=>m.media_type==='audio'&&m.lesson_id===l.lesson_id).sort((a,b)=>(+a.sort_order||0)-(+b.sort_order||0));
    if(exact.length)return exact[0];
    return state.media.filter(m=>m.media_type==='audio'&&m.book_id===b.book_id).sort((a,b)=>(+a.sort_order||0)-(+b.sort_order||0))[0]||null;
  }

  function audioMarkup(media){
    if(!media?.file_url)return'<div class="audio-empty">Chưa gắn track cụ thể. Mở “Danh sách audio đã share” ngay bên dưới để chọn file.</div>';
    const isMp3=/audio\/mpeg/i.test(media.mime_type)||/\.mp3(?:$|\?)/i.test(media.file_name||media.file_url);
    if(isMp3)return `<audio id="audioPlayer" class="audio-native" controls preload="metadata" playsinline src="${esc(directMedia(media.file_url))}"></audio>`;
    return `<iframe id="audioFrame" src="${esc(drivePreview(media.file_url))}" allow="autoplay" title="Audio Google Drive"></iframe>`;
  }

  function memoHistory(id){try{return JSON.parse(localStorage.getItem(memoHistoryKey(id))||'[]');}catch{return[];}}
  function saveMemoSnapshot(id,text,force=false){const clean=String(text||'');if(!clean.trim())return;const history=memoHistory(id);if(!force&&history[0]?.text===clean)return;history.unshift({time:Date.now(),text:clean});localStorage.setItem(memoHistoryKey(id),JSON.stringify(history.slice(0,30)));}

  function bindWorkspace(b,l){
    const editor=$('audioLinkEditor'),audioInput=$('audioLinkInput');
    $('toggleAudioLink').onclick=()=>editor.classList.toggle('show');
    $('loadAudioLink').onclick=()=>{const url=audioInput.value.trim();if(!url)return;localStorage.setItem(audioKey(l.lesson_id),url);toast('Đã nạp audio');render();};
    $('clearAudioLink').onclick=()=>{localStorage.removeItem(audioKey(l.lesson_id));toast('Đã trả về audio từ Google Sheet');render();};
    const audioPlayer=$('audioPlayer');if(audioPlayer)audioPlayer.addEventListener('error',()=>{$('audioStatus').textContent='Không phát được trực tiếp; mở danh sách Drive bên dưới.';});
    const pdfFrame=$('pdfFrame');if(pdfFrame)pdfFrame.addEventListener('load',()=>{const s=$('pdfLoadStatus');if(s)s.textContent=`Đã tải PDF · xem trang ${start(l)}-${end(l)}`;});

    const memo=$('studyMemo'),memoStatus=$('memoStatus'),historySelect=$('memoHistory');let timer;
    const refreshHistory=()=>{const h=memoHistory(l.lesson_id);historySelect.innerHTML='<option value="">Lịch sử memo</option>'+h.map((x,i)=>`<option value="${i}">${new Date(x.time).toLocaleString('vi-VN')}</option>`).join('');};
    memo.addEventListener('input',()=>{clearTimeout(timer);memoStatus.textContent='Đang lưu…';timer=setTimeout(()=>{localStorage.setItem(memoCurrentKey(l.lesson_id),memo.value);memoStatus.textContent='Đã tự lưu';},350);});
    memo.addEventListener('blur',()=>{localStorage.setItem(memoCurrentKey(l.lesson_id),memo.value);saveMemoSnapshot(l.lesson_id,memo.value);refreshHistory();});
    $('saveMemoSnapshot').onclick=()=>{localStorage.setItem(memoCurrentKey(l.lesson_id),memo.value);saveMemoSnapshot(l.lesson_id,memo.value,true);refreshHistory();memoStatus.textContent='Đã lưu một mốc';};
    $('restoreMemo').onclick=()=>{const i=+historySelect.value,h=memoHistory(l.lesson_id);if(!Number.isInteger(i)||!h[i])return;memo.value=h[i].text;localStorage.setItem(memoCurrentKey(l.lesson_id),memo.value);memoStatus.textContent='Đã khôi phục';};
    $('clearMemo').onclick=()=>{if(!confirm('Xoá memo hiện tại của bài này?'))return;memo.value='';localStorage.removeItem(memoCurrentKey(l.lesson_id));memoStatus.textContent='Đã xoá memo hiện tại';};
    refreshHistory();
    $('toggleDone').onclick=()=>{done.has(l.lesson_id)?done.delete(l.lesson_id):done.add(l.lesson_id);localStorage.setItem('bjtDoneLessons',JSON.stringify([...done]));toast(done.has(l.lesson_id)?'Đã hoàn thành bài':'Đã bỏ hoàn thành');render();};
    $('reloadPdf').onclick=()=>{const f=$('pdfFrame'),src=f.src;f.src='about:blank';setTimeout(()=>f.src=src,80);};
    if($('revealAnswer'))$('revealAnswer').onclick=()=>$('answerBox').classList.toggle('show');
    document.querySelectorAll('.question-chip[data-id]').forEach(x=>x.onclick=()=>{state.questionId=x.dataset.id;render();});
  }

  function detail(){
    const b=state.books.find(x=>x.book_id===state.bookId),l=state.lessons.find(x=>x.lesson_id===state.lessonId);
    if(!b||!l){$('lessonStatus').textContent='Chưa chọn';$('lessonDetail').className='empty';$('lessonDetail').innerHTML='Chọn một bài trong menu.';return;}
    const cs=state.content.filter(r=>r.lesson_id===l.lesson_id).sort((a,b)=>(+a.content_order||0)-(+b.content_order||0));
    const qs=state.questions.filter(q=>q.book_id===l.book_id&&norm(q.part_title)===norm(l.part_title)&&norm(q.section_title)===norm(l.section_title));
    const selected=qs.find(q=>q.question_id===state.questionId)||qs[0];state.questionId=selected?.question_id||'';
    const media=selectedMedia(b,l),pdfPreview=drivePreview(b.pdf_url),fid=folderId(b.source_folder_url),folderPreview=fid?`https://drive.google.com/embeddedfolderview?id=${fid}#list`:'';
    const memo=localStorage.getItem(memoCurrentKey(l.lesson_id))||'';
    const questionNav=qs.length?`<div class="question-list">${qs.map(q=>`<button class="question-chip ${q.question_id===selected?.question_id?'active':''}" data-id="${esc(q.question_id)}">Q${esc(q.question_no)}</button>`).join('')}</div>`:'';
    $('lessonStatus').textContent=done.has(l.lesson_id)?'Đã hoàn thành':'Đang học';
    $('lessonDetail').className='workspace-wrap';
    $('lessonDetail').innerHTML=`<div class="study-workspace">
      <section class="study-audio-bar">
        <div class="audio-info"><strong>♫ Audio luyện nghe</strong><small id="audioStatus">${media?`${esc(media.track_label||'')} · ${esc(media.file_name||'Google Drive')}`:'Chọn file trong thư mục audio đã share'}</small></div>
        <div class="audio-embed">${audioMarkup(media)}</div>
        <div class="audio-tools"><button id="toggleAudioLink" class="mini-btn">Đổi link</button></div>
        <div id="audioLinkEditor" class="audio-link-editor"><input id="audioLinkInput" value="${esc(media?.file_url||'')}" placeholder="Dán link file audio Google Drive"><button id="loadAudioLink" class="mini-btn">Nạp</button><button id="clearAudioLink" class="mini-btn">Dùng link Sheet</button></div>
        ${folderPreview?`<details class="audio-folder"><summary>Danh sách audio đã share trên Drive</summary><iframe src="${esc(folderPreview)}" title="Danh sách audio Google Drive"></iframe></details>`:''}
      </section>
      <div class="study-split">
        <section id="contentPane" class="study-pane content-pane"><div class="study-pane-head"><div><strong>${esc(l.section_title)}</strong><span> · trang ${start(l)}-${end(l)}</span></div><button id="toggleDone" class="mini-btn">${done.has(l.lesson_id)?'Bỏ hoàn thành':'✓ Hoàn thành'}</button></div><div class="study-content-scroll">${questionNav}${cs.length?convertedView(cs):questionView(selected)}</div></section>
        <section id="pdfPane" class="study-pane pdf-pane"><div class="study-pane-head"><div><strong>PDF sách</strong><span id="pdfLoadStatus">Đang tải từ Drive · cần xem trang ${start(l)}-${end(l)}</span></div><button id="reloadPdf" class="mini-btn">Tải lại</button></div>${pdfPreview?`<iframe id="pdfFrame" src="${esc(pdfPreview)}" title="PDF sách trên Google Drive"></iframe>`:'<div class="empty">Không tìm thấy link PDF trong BOOKS.pdf_url.</div>'}</section>
      </div>
      <section class="memo-panel"><div class="memo-head"><strong>Memo luyện thi</strong><span id="memoStatus" class="memo-status">Tự lưu bằng LocalStorage</span></div><textarea id="studyMemo" placeholder="Ghi từ mới, lý do chọn sai, điểm cần nghe lại…">${esc(memo)}</textarea><div class="memo-tools"><button id="saveMemoSnapshot" class="mini-btn">Lưu mốc</button><select id="memoHistory"><option value="">Lịch sử memo</option></select><button id="restoreMemo" class="mini-btn">Khôi phục</button><button id="clearMemo" class="mini-btn">Xoá memo</button></div><p class="memo-hint">Memo tự lưu và giữ tối đa 30 phiên bản cho từng bài.</p></section>
    </div>`;
    bindWorkspace(b,l);
  }

  function toast(t){const e=$('toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1500);}
  function render(){if(!state.books.some(x=>x.book_id===state.bookId))state.bookId=state.books[0]?.book_id||'';books();lessonMenu();detail();$('doneCount').textContent=done.size;}
  window.BJT_UI={render,toast};
})();