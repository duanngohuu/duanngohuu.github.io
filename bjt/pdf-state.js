(()=>{
  const {state}=BJT;
  const start=l=>Math.max(1,+(l?.pdf_page_start||l?.page_start||1));
  const maxPage=b=>Math.max(1,+(b?.pages||9999));
  const pageKey=id=>`bjtPdfPage:${id}`;
  const lastLessonKey=id=>`bjtPdfLastLesson:${id}`;
  const lastBookPageKey=id=>`bjtPdfLastPage:${id}`;
  let removeListeners=()=>{};

  function clampPage(book,page){
    const n=Math.round(Number(page)||1);
    return Math.min(maxPage(book),Math.max(1,n));
  }

  function storedPage(book,lesson){
    const own=Number(localStorage.getItem(pageKey(lesson.lesson_id)));
    if(Number.isFinite(own)&&own>0)return clampPage(book,own);
    return start(lesson);
  }

  function basePdfSrc(frame){
    if(frame.dataset.basePdfSrc)return frame.dataset.basePdfSrc;
    const src=String(frame.getAttribute('src')||frame.src||'').split('#')[0];
    frame.dataset.basePdfSrc=src;
    return src;
  }

  function updateLabels(page,lesson){
    const input=document.getElementById('pdfPageInput');
    if(input&&document.activeElement!==input)input.value=page;
    const status=document.getElementById('pdfLoadStatus');
    if(status)status.textContent=`Trang ${page} · bài bắt đầu từ trang ${start(lesson)}`;
    const jump=document.querySelector('.mobile-jump[data-target="pdfPane"]');
    if(jump)jump.textContent=`PDF · tr.${page}`;
  }

  function setPdfPage(book,lesson,page,{force=false}={}){
    const frame=document.getElementById('pdfFrame');
    if(!frame)return;
    const nextPage=clampPage(book,page);
    localStorage.setItem(pageKey(lesson.lesson_id),String(nextPage));
    localStorage.setItem(lastBookPageKey(book.book_id),String(nextPage));
    localStorage.setItem(lastLessonKey(book.book_id),lesson.lesson_id);
    const base=basePdfSrc(frame);
    const next=`${base}#page=${nextPage}`;
    const current=String(frame.getAttribute('src')||'');
    if(force||current!==next)frame.setAttribute('src',next);
    updateLabels(nextPage,lesson);
  }

  function enhancePdfState(){
    removeListeners();
    const frame=document.getElementById('pdfFrame');
    const pane=document.getElementById('pdfPane');
    const head=pane?.querySelector('.study-pane-head');
    const book=state.books.find(x=>x.book_id===state.bookId);
    const lesson=state.lessons.find(x=>x.lesson_id===state.lessonId);
    if(!frame||!head||!book||!lesson)return;

    const previousLesson=localStorage.getItem(lastLessonKey(book.book_id));
    const lessonChanged=previousLesson!==lesson.lesson_id;
    const initialPage=lessonChanged?start(lesson):storedPage(book,lesson);
    if(lessonChanged){
      localStorage.setItem(pageKey(lesson.lesson_id),String(initialPage));
      localStorage.setItem(lastLessonKey(book.book_id),lesson.lesson_id);
    }

    if(!document.getElementById('pdfPageTools')){
      const tools=document.createElement('div');
      tools.id='pdfPageTools';
      tools.className='pdf-page-tools';
      tools.innerHTML=`
        <button id="pdfPrevPage" class="mini-btn" type="button" aria-label="Trang trước">‹</button>
        <label class="pdf-page-box"><span>Trang</span><input id="pdfPageInput" class="pdf-page-input" type="number" min="1" max="${maxPage(book)}" inputmode="numeric" value="${initialPage}"></label>
        <button id="pdfNextPage" class="mini-btn" type="button" aria-label="Trang sau">›</button>
        <button id="pdfLessonStart" class="mini-btn" type="button">Đầu bài</button>
        <span class="pdf-page-note">Chọn session/bài sẽ mở đúng trang bắt đầu. Trang nhập ở đây được ghi nhớ riêng cho từng bài.</span>`;
      head.appendChild(tools);
    }

    const input=document.getElementById('pdfPageInput');
    const go=page=>setPdfPage(book,lesson,page,{force:true});
    document.getElementById('pdfPrevPage').onclick=()=>go(storedPage(book,lesson)-1);
    document.getElementById('pdfNextPage').onclick=()=>go(storedPage(book,lesson)+1);
    document.getElementById('pdfLessonStart').onclick=()=>go(start(lesson));
    input.onchange=()=>go(input.value);
    input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();go(input.value);input.blur();}};

    const onPageShow=()=>updateLabels(storedPage(book,lesson),lesson);
    window.addEventListener('pageshow',onPageShow);
    removeListeners=()=>window.removeEventListener('pageshow',onPageShow);
    setPdfPage(book,lesson,initialPage,{force:lessonChanged||!String(frame.getAttribute('src')||'').includes('#page=')});
  }

  const baseRender=BJT_UI.render;
  BJT_UI.render=function(){
    baseRender();
    requestAnimationFrame(enhancePdfState);
  };
  window.addEventListener('load',()=>requestAnimationFrame(enhancePdfState),{once:true});
})();