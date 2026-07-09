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
  const drivePreview=url=>{const id=driveId(url);return id?`https://drive.google.com/file/d/${id}/preview`:''};
  const memoCurrentKey=id=>`bjtMemoCurrent:${id}`;
  const memoHistoryKey=id=>`bjtMemoHistory:${id}`;
  const audioKey=id=>`bjtAudioLink:${id}`;

  function lessonHasAudio(b,l){
    if(!b||!l||String(b.audio_available).toLowerCase()==='false')return false;
    const id=l.lesson_id;
    if(b.book_id==='BJT-MOCK')return /^BJT-MOCK-P[12]S/.test(id);
    if(b.book_id==='BJT-RED')return /^BJT-RED-P[12]S/.test(id);
    if(b.book_id==='BJT-YELLOW')return /^BJT-YELLOW-P[12]S/.test(id);
    if(b.book_id==='BUSINESS-BLUE')return /^BUSINESS-BLUE-(U\d{2}|R\d{2})$/.test(id);
    if(b.book_id==='BUSINESS-30H')return /^BUSINESS-30H-C0[1-8]$/.test(id);
    return false;
  }

  function books(){
    const q=state.query.toLowerCase();
    $('bookList').innerHTML=state.books.filter(b=>!q||String(b.book_title).toLowerCase().includes(q)||lessons(b.book_id).some(l=>(l.part_title+' '+l.section_title).toLowerCase().includes(q))).map(b=>{
      const ls=lessons(b.book_id),n=ls.filter(l=>done.has(l.lesson_id)).length,p=ls.length?Math.round(n/ls.length*100):0;
      return `<button class="book-btn ${b.book_id===state.bookId?'active':''}" data-id="${esc(b.book_id)}"><strong>${esc(b.book_title)}</strong><small>${esc(b.pages||'?')} trang · ${ls.length} mục</small><div class="book-progress"><div style="width:${p}%"></div></div></button>`;
    }).join('');
    document.querySelectorAll('.book-btn').forEach(x=>x.onclick=()=>{state.bookId=x.dataset.id;state.lessonId='';state.questionId='';localStorage.setItem('bjtLastBook',state.bookId);document.querySelector('.side-lessons')?.classList.add('open');render();});
  }

  function lessonMenu(){
    const b=state.books.find(x=>x.book_id===state.bookId);if(!b)return;
    let ls=lessons(b.book_id);
    if(state.query){const q=state.query.toLowerCase();ls=ls.filter(l=>(l.part_title+' '+l.section_title).toLowerCase().includes(q));}
    $('bookTitle').textContent=b.book_title;
    $('bookInfo').textContent=`${b.pages||'?'} trang · ${b.lesson_count||ls.length} bài/section`;
    $('bookBadge').textContent=ready(b)?'Đã sẵn sàng':'Đang xử lý';
    if(!ls.length){$('lessonGroups').innerHTML='<div class="empty">Sách này chưa có bài đã xác minh.</div>';state.lessonId='';return;}
    if(!state.lessonId||!ls.some(x=>x.lesson_id===state.lessonId)){state.lessonId=ls[0].lesson_id;state.questionId='';localStorage.setItem('bjtLastLesson',state.lessonId);}
    const groups=ls.reduce((a,x)=>((a[x.part_title||b.book_title]??=[]).push(x),a),{});
    $('lessonGroups').innerHTML=Object.entries(groups).map(([g,a])=>`<section class="lesson-group"><div class="group-head"><strong>${esc(g)}</strong><span>${a.length}</span></div><div class="lesson-list">${a.map((l,i)=>`<button class="lesson-card ${l.lesson_id===state.lessonId?'active':''} ${done.has(l.lesson_id)?'done':''}" data-id="${esc(l.lesson_id)}"><div class="top"><span>${done.has(l.lesson_id)?'✓':String(i+1).padStart(2,'0')}</span><span>${lessonHasAudio(b,l)?'♫ ':''}tr. ${start(l)}-${end(l)}</span></div><strong>${esc(l.section_title)}</strong><small>${count(l)?count(l)+' câu/mục · ':''}${esc(l.content_type||'bài học')}</small></button>`).join('')}</div></section>`).join('');
    document.querySelectorAll('.lesson-card').forEach(x=>x.onclick=()=>{state.lessonId=x.dataset.id;state.questionId='';localStorage.setItem('bjtLastLesson',state.lessonId);if(matchMedia('(max-width:900px)').matches)document.querySelector('.side-lessons')?.classList.remove('open');render();requestAnimationFrame(()=>document.getElementById('pdfPane')?.scrollIntoView({behavior:'smooth',block:'start'}));});
  }

  function selectedMedia(l){
    const saved=localStorage.getItem(audioKey(l.lesson_id));
    if(saved)return{file_url:saved,file_name:'Link audio riêng',mime_type:/\.wma(?:$|\?)/i.test(saved)?'audio/x-ms-wma':'audio/mpeg',track_label:'Tuỳ chỉnh'};
    return state.media.filter(m=>m.media_type==='audio'&&m.lesson_id===l.lesson_id).sort((a,b)=>(+a.sort_order||0)-(+b.sort_order||0))[0]||null;
  }

  function memoHistory(id){try{return JSON.parse(localStorage.getItem(memoHistoryKey(id))||'[]');}catch{return[];}}
  function saveMemoSnapshot(id,text,force=false){const clean=String(text||'');if(!clean.trim())return;const history=memoHistory(id);if(!force&&history[0]?.text===clean)return;history.unshift({time:Date.now(),text:clean});localStorage.setItem(memoHistoryKey(id),JSON.stringify(history.slice(0,30)));}

  function bindWorkspace(b,l,hasAudio){
    if(hasAudio){
      const editor=$('audioLinkEditor'),audioInput=$('audioLinkInput');
      if($('toggleAudioLink'))$('toggleAudioLink').onclick=()=>editor?.classList.toggle('show');
      if($('loadAudioLink'))$('loadAudioLink').onclick=()=>{const url=audioInput?.value.trim();if(!url)return;localStorage.setItem(audioKey(l.lesson_id),url);toast('Đã nạp audio');render();};
      if($('clearAudioLink'))$('clearAudioLink').onclick=()=>{localStorage.removeItem(audioKey(l.lesson_id));toast('Đã dùng lại audio của sách');render();};
      document.querySelectorAll('.question-chip[data-id]').forEach(x=>x.onclick=()=>{state.questionId=x.dataset.id;document.querySelectorAll('.question-chip').forEach(b=>b.classList.toggle('active',b===x));const bar=document.querySelector('.study-audio-bar');if(bar)delete bar.dataset.audioEnhanced;window.BJT_AUDIO?.enhance?.();});
    }

    const pdfFrame=$('pdfFrame');if(pdfFrame)pdfFrame.addEventListener('load',()=>{const s=$('pdfLoadStatus');if(s)s.textContent=`PDF đã tải · trang ${start(l)}-${end(l)}`;});
    if($('reloadPdf'))$('reloadPdf').onclick=()=>window.BJT_NATIVE_PDF?.reload?.();
    if($('toggleDone'))$('toggleDone').onclick=()=>{done.has(l.lesson_id)?done.delete(l.lesson_id):done.add(l.lesson_id);localStorage.setItem('bjtDoneLessons',JSON.stringify([...done]));toast(done.has(l.lesson_id)?'Đã hoàn thành bài':'Đã bỏ hoàn thành');render();};

    const memo=$('studyMemo'),memoStatus=$('memoStatus'),historySelect=$('memoHistory'),overlay=$('memoOverlay'),sheet=$('memoPanel'),countEl=$('memoCharCount');
    let timer,closeTimer;
    const refreshHistory=()=>{const h=memoHistory(l.lesson_id);historySelect.innerHTML='<option value="">Lịch sử ghi chú</option>'+h.map((x,i)=>`<option value="${i}">${new Date(x.time).toLocaleString('vi-VN')}</option>`).join('');};
    const persist=label=>{localStorage.setItem(memoCurrentKey(l.lesson_id),memo.value);memoStatus.textContent=label||'Đã tự lưu';if(countEl)countEl.textContent=`${memo.value.length} ký tự`;};
    const openMemo=()=>{
      clearTimeout(closeTimer);
      document.getElementById('pdfPane')?.scrollIntoView({behavior:'smooth',block:'start'});
      overlay.hidden=false;
      requestAnimationFrame(()=>overlay.classList.add('open'));
      document.body.classList.add('memo-open');
      setTimeout(()=>memo.focus({preventScroll:true}),220);
    };
    const closeMemo=()=>{
      persist('Đã lưu');
      saveMemoSnapshot(l.lesson_id,memo.value);
      refreshHistory();
      overlay.classList.remove('open');
      document.body.classList.remove('memo-open');
      closeTimer=setTimeout(()=>{overlay.hidden=true;sheet.classList.remove('expanded');},180);
    };
    window.BJT_MEMO={open:openMemo,close:closeMemo,toggle:()=>overlay.hidden?openMemo():closeMemo};

    memo.addEventListener('input',()=>{clearTimeout(timer);memoStatus.textContent='Đang lưu…';if(countEl)countEl.textContent=`${memo.value.length} ký tự`;timer=setTimeout(()=>persist('Đã tự lưu'),260);});
    memo.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();persist('Đã lưu một mốc');saveMemoSnapshot(l.lesson_id,memo.value,true);refreshHistory();}});
    $('openMemo').onclick=openMemo;
    $('memoFab').onclick=openMemo;
    $('memoClose').onclick=closeMemo;
    overlay.onclick=e=>{if(e.target===overlay)closeMemo();};
    $('memoExpand').onclick=()=>{sheet.classList.toggle('expanded');$('memoExpand').textContent=sheet.classList.contains('expanded')?'Thu nhỏ':'Mở rộng';};
    $('saveMemoSnapshot').onclick=()=>{persist('Đã lưu một mốc');saveMemoSnapshot(l.lesson_id,memo.value,true);refreshHistory();};
    $('restoreMemo').onclick=()=>{const i=+historySelect.value,h=memoHistory(l.lesson_id);if(!Number.isInteger(i)||!h[i])return;memo.value=h[i].text;persist('Đã khôi phục');};
    $('copyMemo').onclick=async()=>{try{await navigator.clipboard.writeText(memo.value);memoStatus.textContent='Đã sao chép';}catch{memo.select();document.execCommand('copy');memoStatus.textContent='Đã sao chép';}};
    $('clearMemo').onclick=()=>{if(!confirm('Xoá ghi chú hiện tại của bài này?'))return;memo.value='';localStorage.removeItem(memoCurrentKey(l.lesson_id));persist('Đã xoá');};
    document.querySelectorAll('[data-memo-insert]').forEach(button=>button.onclick=()=>{const text=button.dataset.memoInsert+' ';const a=memo.selectionStart??memo.value.length,z=memo.selectionEnd??a;memo.setRangeText(text,a,z,'end');memo.dispatchEvent(new Event('input'));memo.focus();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)closeMemo();},{once:false});
    refreshHistory();persist('Tự lưu trên thiết bị');
  }

  function detail(){
    const b=state.books.find(x=>x.book_id===state.bookId),l=state.lessons.find(x=>x.lesson_id===state.lessonId);
    if(!b||!l){$('lessonStatus').textContent='Chưa chọn';$('lessonDetail').className='empty';$('lessonDetail').innerHTML='Chọn một bài trong mục lục bên trái.';return;}
    const hasAudio=lessonHasAudio(b,l),media=selectedMedia(l),pdfPreview=drivePreview(b.pdf_url),memo=localStorage.getItem(memoCurrentKey(l.lesson_id))||'';
    const qs=state.questions.filter(q=>q.book_id===l.book_id&&String(q.part_title||'').includes(String(l.part_title||''))&&String(q.section_title||'').includes(String(l.section_title||'')));
    const selected=qs.find(q=>q.question_id===state.questionId)||qs[0];state.questionId=selected?.question_id||'';
    const questionNav=hasAudio&&qs.length?`<div class="audio-question-nav"><span>Chọn câu</span>${qs.map(q=>`<button class="question-chip ${q.question_id===state.questionId?'active':''}" data-id="${esc(q.question_id)}">Q${esc(q.question_no)}</button>`).join('')}</div>`:'';
    $('lessonStatus').textContent=done.has(l.lesson_id)?'Đã hoàn thành':'Đang học';
    const title=document.getElementById('workspaceTitle');if(title)title.textContent=hasAudio?'Audio · PDF · Ghi chú':'PDF · Ghi chú';
    $('lessonDetail').className='workspace-wrap';
    $('lessonDetail').innerHTML=`<div class="study-workspace ${hasAudio?'has-audio':'no-audio'}">
      ${hasAudio?`<section class="study-audio-bar">
        <div class="audio-info"><strong>♫ Audio luyện nghe</strong><small id="audioStatus">${media?`${esc(media.track_label||'')} · ${esc(media.file_name||'Google Drive')}`:'Bấm Start để nạp audio của bài'}</small></div>
        <div class="audio-tools"><button id="toggleAudioLink" class="mini-btn" type="button">Đổi link</button></div>
        <div id="audioLinkEditor" class="audio-link-editor"><input id="audioLinkInput" value="${esc(media?.file_url||'')}" placeholder="Dán link file audio Google Drive"><button id="loadAudioLink" class="mini-btn" type="button">Nạp</button><button id="clearAudioLink" class="mini-btn" type="button">Mặc định</button></div>
        ${questionNav}
      </section>`:''}
      <section id="pdfPane" class="study-pane pdf-pane study-anchor">
        <div class="study-pane-head"><div class="pdf-title"><strong>${esc(l.section_title)}</strong><span id="pdfLoadStatus">PDF · trang ${start(l)}-${end(l)}</span></div><div class="pdf-primary-actions"><button id="toggleDone" class="mini-btn ${done.has(l.lesson_id)?'done':''}" type="button">${done.has(l.lesson_id)?'✓ Đã xong':'✓ Hoàn thành'}</button><button id="openMemo" class="mini-btn memo-open-btn" type="button">✎ Ghi chú</button><button id="reloadPdf" class="mini-btn" type="button">↻</button></div></div>
        ${pdfPreview?`<iframe id="pdfFrame" src="${esc(pdfPreview)}" title="PDF sách trên Google Drive"></iframe>`:'<div class="empty">Không tìm thấy PDF.</div>'}
      </section>
      <button id="memoFab" class="memo-fab ${memo.trim()?'has-note':''}" type="button" aria-label="Mở ghi chú">✎<span>Memo</span></button>
      <div id="memoOverlay" class="memo-overlay" hidden>
        <section id="memoPanel" class="memo-sheet" role="dialog" aria-modal="true" aria-label="Ghi chú bài học">
          <div class="memo-handle"></div>
          <header class="memo-head"><div><strong>Ghi chú · ${esc(l.section_title)}</strong><span id="memoStatus">Tự lưu trên thiết bị</span></div><div><button id="memoExpand" class="mini-btn" type="button">Mở rộng</button><button id="memoClose" class="memo-close" type="button">×</button></div></header>
          <div class="memo-quick"><button data-memo-insert="【Từ mới】" type="button">Từ mới</button><button data-memo-insert="【Nghe lại】" type="button">Nghe lại</button><button data-memo-insert="【Sai vì】" type="button">Sai vì</button><button data-memo-insert="【Cần hỏi】" type="button">Cần hỏi</button></div>
          <textarea id="studyMemo" placeholder="Ghi từ mới, lý do chọn sai, thời điểm cần nghe lại…">${esc(memo)}</textarea>
          <footer class="memo-footer"><span id="memoCharCount">${memo.length} ký tự</span><div class="memo-history"><select id="memoHistory"><option value="">Lịch sử ghi chú</option></select><button id="restoreMemo" class="mini-btn" type="button">Khôi phục</button></div><div class="memo-actions"><button id="copyMemo" class="mini-btn" type="button">Sao chép</button><button id="saveMemoSnapshot" class="mini-btn" type="button">Lưu mốc</button><button id="clearMemo" class="mini-btn danger" type="button">Xoá</button></div></footer>
        </section>
      </div>
    </div>`;
    bindWorkspace(b,l,hasAudio);
  }

  function bindSideMenu(){
    const toggle=$('toggleLessonNav');if(!toggle)return;
    toggle.onclick=()=>document.querySelector('.side-lessons')?.classList.toggle('open');
  }
  function toast(t){const e=$('toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1500);}
  function render(){if(!state.books.some(x=>x.bookId===state.bookId)&&!state.books.some(x=>x.book_id===state.bookId))state.bookId=state.books[0]?.book_id||'';books();lessonMenu();detail();bindSideMenu();$('doneCount').textContent=done.size;}
  window.BJT_UI={render,toast,lessonHasAudio};
})();