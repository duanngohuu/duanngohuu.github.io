(()=>{
  const {state,$,init,log}=BJT;
  function fail(e){
    log(e.message);
    $('statusDot').className='status-dot error';
    $('statusTitle').textContent='Lỗi nguồn dữ liệu';
    $('statusText').textContent=e.message;
    $('lessonGroups').innerHTML='<div class="empty">Không đọc được Google Sheet.<br>Hãy mở Debug hoặc kiểm tra quyền chia sẻ.</div>';
  }
  init().then(()=>{
    $('statusDot').className='status-dot ok';
    $('statusTitle').textContent='Đã kết nối Google Sheet';
    $('statusText').textContent=`BOOKS ${state.books.length} · LESSONS ${state.lessons.length} · QUESTIONS ${state.questions.length} · CONTENT ${state.content.length} · MEDIA ${state.media.length}`;
    $('bookCount').textContent=state.books.length;
    $('lessonCount').textContent=state.lessons.length;
    BJT_UI.render();
    $('searchInput').oninput=e=>{state.query=e.target.value.trim();BJT_UI.render();};
  }).catch(fail);
})();