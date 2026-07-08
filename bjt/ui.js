(()=>{
  const {state,done,$}=BJT;
  const DEFAULT_AUDIO={
    'BUSINESS-BLUE-U01':'https://drive.google.com/file/d/1lBx7X9JcTFOVVSS4cgPa6XDiPmviceDm/view'
  };
  const lessons=id=>state.lessons.filter(x=>x.book_id===id).sort((a,b)=>(+a.sort_order||0)-(+b.sort_order||0));
  const start=l=>+(l.pdf_page_start||l.page_start||0);
  const end=l=>+(l.pdf_page_end||l.page_end||start(l));
  const count=l=>+(l.question_count||l.item_count||0);
  const status=b=>b.verification_status||b.extraction_status||b.data_status||'';
  const ready=b=>/complete|verified/.test(status(b));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const driveId=url=>String(url||'').match(/\/d\/([^/?#]+)/)?.[1]||String(url||'').match(/[?&]id=([^&#]+)/)?.[1]||'';
  const preview=(url,page)=>{const id=driveId(url);return id?`https://drive.google.com/file/d/${id}/preview${page?`#page=${page}`:''}`:''};
  const norm=s=>String(s||'').replace(/^Phần \d+\s*-\s*/,'').replace(/^Section \d+\s*-\s*/,'').trim();
  const memoCurrentKey=id=>`bjtMemoCurrent:${id}`;
  const memoHistoryKey=id=>`bjtMemoHistory:${id}`;
  const audioKey=id=>`bjtAudioLink:${id}`;

  function books(){
    const q=state.query.toLowerCase();
    $('bookList').innerHTML=state.books
      .filter(b=>!q||String(b.book_title).toLowerCase().includes(q)||lessons(b.book_id).some(l=>(l.part_title+' '+l.section_title).toLowerCase().includes(q)))
      .map(b=>{
        const ls=lessons(b.book_id),n=ls.filter(l=>done.has(l.lesson_id)).length,p=ls.length?Math.round(n/ls.length*100):0;
        return `<button class="book-btn ${b.book_id===state.bookId?'active':''}" data-id="${esc(b.book_id)}"><strong>${esc(b.book_title)}</strong><small>${esc(b.pages||'?')} trang · ${ls.length} bài · ${esc(b.question_inventory_count||b.question_count||0)} câu/mục</small><div class="book-progress"><div style="width:${p}%"></div></div></button>`;
      }).join('');
    document.querySelectorAll('.book-btn').forEach(x=>x.onclick=()=>{
      state.bookId=x.dataset.id;state.lessonId='';state.questionId='';
      localStorage.setItem('bjtLastBook',state.bookId);render();
    });
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
    document.querySelectorAll('.lesson-card').forEach(x=>x.onclick=()=>{
      state.lessonId=x.dataset.id;state.questionId='';
      localStorage.setItem('bjtLastLesson',state.lessonId);render();
    });
    if(!state.lessonId||!ls.some(x=>x.lesson_id===state.lessonId)){
      state.lessonId=ls[0].lesson_id;state.questionId='';
      localStorage.setItem('bjtLastLesson',state.lessonId);
    }
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
    const dialogues=rows.filter(r=>r.content_type==='dialogue');
    const question=rows.find(r=>r.content_type==='question');
    const vocab=rows.filter(r=>r.content_type==='vocabulary');
    const notes=rows.filter(r=>r.content_type==='note');
    return `<div class="q-view"><div class="q-head"><strong>Nội dung đã chuyển đổi</strong><span>${rows.length} dòng data</span></div>
      ${dialogues.map(r=>`<div class="converted-dialogue"><b>${esc(r.speaker||'')}</b><div class="jp">${esc(r.japanese)}</div>${r.reading?`<div class="reading">${esc(r.reading)}</div>`:''}${r.meaning_vi?`<div class="vi">${esc(r.meaning_vi)}</div>`:''}</div>`).join('')}
      ${question?`<div class="q-options"><p class="q-prompt">${esc(question.question_jp)}</p>${[1,2,3,4].map(i=>`<button class="q-option"><b>${i}</b>${esc(question['option_'+i])}</button>`).join('')}<div class="q-answer show"><b>正答 ${esc(question.answer_no)}:</b> ${esc(question.answer_text)}</div></div>`:''}
      ${vocab.length?`<details class="q-script" open><summary>Từ vựng</summary>${vocab.map(v=>`<div><b>${esc(v.vocabulary_jp)}</b> (${esc(v.vocabulary_reading)}) — ${esc(v.vocabulary_meaning_vi)}</div>`).join('')}</details>`:''}
      ${notes.length?`<details class="q-script"><summary>Giải thích mẫu câu</summary>${notes.map(n=>`<div><b>${esc(n.japanese)}</b><br>${esc(n.grammar_note_vi||n.meaning_vi)}</div>`).join('<hr>')}</details>`:''}
    </div>`;
  }

  function audioSource(l,contentRows,selectedQuestion){
    const saved=localStorage.getItem(audioKey(l.lesson_id));
    if(saved)return saved;
    const row=contentRows.find(r=>/^https?:\/\//.test(String(r.audio_track||'')));
    if(row)return row.audio_track;
    if(/^https?:\/\//.test(String(selectedQuestion?.audio_track||'')))return selectedQuestion.audio_track;
    return DEFAULT_AUDIO[l.lesson_id]||'';
  }

  function memoHistory(id){
    try{return JSON.parse(localStorage.getItem(memoHistoryKey(id))||'[]');}catch{return[];}
  }

  function saveMemoSnapshot(id,text,force=false){
    const clean=String(text||'');if(!clean.trim())return;
    const history=memoHistory(id);
    if(!force&&history[0]?.text===clean)return;
    history.unshift({time:Date.now(),text:clean});
    localStorage.setItem(memoHistoryKey(id),JSON.stringify(history.slice(0,30)));
  }

  function bindWorkspace(b,l,selectedQuestion){
    const contentPane=$('contentPane'),pdfPane=$('pdfPane');
    const active=localStorage.getItem('bjtWorkspaceTab')||'content';
    const setTab=tab=>{
      localStorage.setItem('bjtWorkspaceTab',tab);
      document.querySelectorAll('.study-tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));
      contentPane?.classList.toggle('mobile-active',tab==='content');
      pdfPane?.classList.toggle('mobile-active',tab==='pdf');
    };
    document.querySelectorAll('.study-tab').forEach(x=>x.onclick=()=>setTab(x.dataset.tab));
    setTab(active);

    const editor=$('audioLinkEditor'),audioInput=$('audioLinkInput'),audioFrame=$('audioFrame'),audioEmpty=$('audioEmpty');
    $('toggleAudioLink').onclick=()=>editor.classList.toggle('show');
    $('loadAudioLink').onclick=()=>{
      const url=audioInput.value.trim();
      if(!url)return;
      localStorage.setItem(audioKey(l.lesson_id),url);
      const src=preview(url);
      if(audioFrame){audioFrame.src=src;audioFrame.hidden=false;}
      if(audioEmpty)audioEmpty.hidden=true;
      editor.classList.remove('show');toast('Đã nạp audio vào khu vực phát');
    };
    $('clearAudioLink').onclick=()=>{
      localStorage.removeItem(audioKey(l.lesson_id));audioInput.value='';
      if(audioFrame){audioFrame.src='about:blank';audioFrame.hidden=true;}
      if(audioEmpty)audioEmpty.hidden=false;
      toast('Đã xoá link audio riêng của bài');
    };

    const memo=$('studyMemo'),memoStatus=$('memoStatus'),historySelect=$('memoHistory');
    let timer;
    const refreshHistory=()=>{
      const h=memoHistory(l.lesson_id);
      historySelect.innerHTML='<option value="">Lịch sử memo</option>'+h.map((x,i)=>`<option value="${i}">${new Date(x.time).toLocaleString('vi-VN')}</option>`).join('');
    };
    memo.addEventListener('input',()=>{
      clearTimeout(timer);memoStatus.textContent='Đang lưu…';
      timer=setTimeout(()=>{localStorage.setItem(memoCurrentKey(l.lesson_id),memo.value);memoStatus.textContent='Đã tự lưu';},350);
    });
    memo.addEventListener('blur',()=>{localStorage.setItem(memoCurrentKey(l.lesson_id),memo.value);saveMemoSnapshot(l.lesson_id,memo.value);refreshHistory();});
    $('saveMemoSnapshot').onclick=()=>{localStorage.setItem(memoCurrentKey(l.lesson_id),memo.value);saveMemoSnapshot(l.lesson_id,memo.value,true);refreshHistory();memoStatus.textContent='Đã lưu một mốc';};
    $('restoreMemo').onclick=()=>{const i=+historySelect.value,h=memoHistory(l.lesson_id);if(!Number.isInteger(i)||!h[i])return;memo.value=h[i].text;localStorage.setItem(memoCurrentKey(l.lesson_id),memo.value);memoStatus.textContent='Đã khôi phục';};
    $('clearMemo').onclick=()=>{if(!confirm('Xoá memo hiện tại của bài này?'))return;memo.value='';localStorage.removeItem(memoCurrentKey(l.lesson_id));memoStatus.textContent='Đã xoá memo hiện tại';};
    refreshHistory();

    $('toggleDone').onclick=()=>{
      done.has(l.lesson_id)?done.delete(l.lesson_id):done.add(l.lesson_id);
      localStorage.setItem('bjtDoneLessons',JSON.stringify([...done]));toast(done.has(l.lesson_id)?'Đã hoàn thành bài':'Đã bỏ hoàn thành');render();
    };
    $('reloadPdf').onclick=()=>{const f=$('pdfFrame'),src=f.src;f.src='about:blank';setTimeout(()=>f.src=src,50);};
    if($('revealAnswer'))$('revealAnswer').onclick=()=>$('answerBox').classList.toggle('show');
    document.querySelectorAll('.question-chip[data-id]').forEach(x=>x.onclick=()=>{state.questionId=x.dataset.id;render();});
  }

  function detail(){
    const b=state.books.find(x=>x.book_id===state.bookId),l=state.lessons.find(x=>x.lesson_id===state.lessonId);
    if(!b||!l){$('lessonStatus').textContent='Chưa chọn';$('lessonDetail').className='empty';$('lessonDetail').innerHTML='Chọn một bài trong menu.';return;}
    const cs=state.content.filter(r=>r.lesson_id===l.lesson_id).sort((a,b)=>(+a.content_order||0)-(+b.content_order||0));
    const qs=state.questions.filter(q=>q.book_id===l.book_id&&norm(q.part_title)===norm(l.part_title)&&norm(q.section_title)===norm(l.section_title));
    const selected=qs.find(q=>q.question_id===state.questionId)||qs[0];state.questionId=selected?.question_id||'';
    const audio=audioSource(l,cs,selected),audioPreview=preview(audio),pdfPreview=preview(b.pdf_url,start(l));
    const memo=localStorage.getItem(memoCurrentKey(l.lesson_id))||'';
    const questionNav=qs.length?`<div class="question-list">${qs.map(q=>`<button class="question-chip ${q.question_id===selected?.question_id?'active':''}" data-id="${esc(q.question_id)}">Q${esc(q.question_no)}</button>`).join('')}</div>`:'';
    $('lessonStatus').textContent=done.has(l.lesson_id)?'Đã hoàn thành':'Đang học';
    $('lessonDetail').className='workspace-wrap';
    $('lessonDetail').innerHTML=`<div class="study-workspace">
      <section class="study-audio-bar">
        <div class="audio-info"><strong>♫ Audio luyện nghe</strong><small>${audio?'Đang phát từ Google Drive':'Chưa gắn link audio cho bài này'}</small></div>
        <div class="audio-embed">${audioPreview?`<iframe id="audioFrame" src="${esc(audioPreview)}" allow="autoplay" title="Audio Drive"></iframe><div id="audioEmpty" class="audio-empty" hidden></div>`:`<iframe id="audioFrame" src="about:blank" allow="autoplay" title="Audio Drive" hidden></iframe><div id="audioEmpty" class="audio-empty">Bấm “Đổi link” và dán link file audio trên Drive. Audio sẽ phát ngay trong trang.</div>`}</div>
        <div class="audio-tools"><button id="toggleAudioLink" class="mini-btn">Đổi link</button></div>
        <div id="audioLinkEditor" class="audio-link-editor"><input id="audioLinkInput" value="${esc(audio)}" placeholder="Dán link file audio Google Drive"><button id="loadAudioLink" class="mini-btn">Nạp</button><button id="clearAudioLink" class="mini-btn">Xoá</button></div>
      </section>
      <div class="study-mobile-tabs"><button class="study-tab" data-tab="content">Nội dung học</button><button class="study-tab" data-tab="pdf">PDF sách</button></div>
      <div class="study-split">
        <section id="contentPane" class="study-pane content-pane mobile-active"><div class="study-pane-head"><div><strong>${esc(l.section_title)}</strong><span> · trang ${start(l)}-${end(l)}</span></div><button id="toggleDone" class="mini-btn">${done.has(l.lesson_id)?'Bỏ hoàn thành':'✓ Hoàn thành'}</button></div><div class="study-content-scroll">${questionNav}${cs.length?convertedView(cs):questionView(selected)}</div></section>
        <section id="pdfPane" class="study-pane pdf-pane"><div class="study-pane-head"><strong>PDF mở trực tiếp trong web</strong><button id="reloadPdf" class="mini-btn">Tải lại</button></div>${pdfPreview?`<iframe id="pdfFrame" src="${esc(pdfPreview)}" title="PDF sách trên Google Drive" allow="autoplay"></iframe>`:'<div class="empty">Không tìm thấy link PDF của sách.</div>'}</section>
      </div>
      <section class="memo-panel"><div class="memo-head"><strong>Memo luyện thi</strong><span id="memoStatus" class="memo-status">Tự lưu bằng LocalStorage</span></div><textarea id="studyMemo" placeholder="Ghi từ mới, lý do chọn sai, điểm cần nghe lại…">${esc(memo)}</textarea><div class="memo-tools"><button id="saveMemoSnapshot" class="mini-btn">Lưu mốc</button><select id="memoHistory"><option value="">Lịch sử memo</option></select><button id="restoreMemo" class="mini-btn">Khôi phục</button><button id="clearMemo" class="mini-btn">Xoá memo</button></div><p class="memo-hint">Memo hiện tại được tự lưu. Mỗi lần rời ô nhập hoặc bấm “Lưu mốc”, hệ thống giữ một phiên bản lịch sử, tối đa 30 bản cho từng bài.</p></section>
    </div>`;
    bindWorkspace(b,l,selected);
  }

  function toast(t){const e=$('toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1500);}
  function render(){if(!state.books.some(x=>x.book_id===state.bookId))state.bookId=state.books[0]?.book_id||'';books();lessonMenu();detail();$('doneCount').textContent=done.size;}
  window.BJT_UI={render,toast};
})();