// Small study UX layer. No MutationObserver, no interval.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    function isRunning() { return !!(st.session && st.session.length && !st.done); }
    function setStudy(on) { document.body.classList.toggle('study-active', !!on); }
    function ensureSelectedLessonLabel() {
      const controls = document.querySelector('.controls');
      if (!controls) return null;
      let box = $('#selectedLessonBox');
      if (!box) {
        box = document.createElement('div');
        box.id = 'selectedLessonBox';
        box.className = 'selected-lesson-box';
        box.innerHTML = '<span>Bài đã chọn</span><strong id="selectedLessonText">Chưa chọn bài</strong>';
        controls.prepend(box);
      }
      return box;
    }
    function updateSelectedLessonLabel() {
      const box = ensureSelectedLessonLabel();
      const text = $('#selectedLessonText');
      if (!box || !text) return;
      text.textContent = st.lesson?.title || 'Chưa chọn bài';
      box.classList.toggle('has-lesson', !!st.lesson);
    }
    function normalizeFlashcardTitle() {
      if (!e.title) return;
      if (!st.lesson) e.title.textContent = 'Chọn bài học';
      else if (!st.session?.length) e.title.textContent = 'Sẵn sàng học';
      else if (st.done) e.title.textContent = 'Hoàn thành phiên học';
      else e.title.textContent = 'Thẻ hiện tại';
    }
    function renameLabels() {
      const shuffle = $('#shuffleInput');
      const shuffleLabel = shuffle?.closest('label');
      if (shuffle && shuffleLabel && !shuffleLabel.textContent.includes('Ngẫu nhiên')) {
        shuffleLabel.innerHTML = '';
        shuffleLabel.append(shuffle, document.createTextNode(' Ngẫu nhiên'));
      }
      if (e.known) e.known.textContent = e.known.textContent.replace(/^Biết:/, 'Đã nhớ:');
      if (e.ok && e.ok.textContent.trim() === 'Biết rồi') e.ok.textContent = 'Đã nhớ';
    }
    function paintActiveStats(mode) {
      st.featureFilter = mode || st.featureFilter || 'all';
      e.pos?.classList.toggle('status-active', st.featureFilter === 'all');
      e.known?.classList.toggle('status-active', st.featureFilter === 'known');
      e.again?.classList.toggle('status-active', st.featureFilter === 'again');
    }
    function polishModal() {
      const modal = $('#finishModal');
      if (!modal) return;
      const on = modal.classList.contains('on');
      if (on) setStudy(false);
      const title = $('#finishTitle');
      const text = $('#finishText');
      if (title) title.textContent = '🎉 Chúc mừng bạn!';
      if (text && on) {
        const total = st.session?.length || 0;
        text.innerHTML = `Bạn đã học xong <strong>${total}</strong> thẻ.<div class="finish-stat"><span>Đã nhớ: ${st.known.size}</span><span>Chưa nhớ: ${st.again.size}</span></div>`;
      }
      const knownBtn = $('#finishKnownBtn');
      if (knownBtn) knownBtn.textContent = 'Học thẻ đã nhớ';
    }
    function refresh(mode) {
      updateSelectedLessonLabel();
      normalizeFlashcardTitle();
      renameLabels();
      paintActiveStats(mode);
      polishModal();
      if (isRunning()) setStudy(true);
    }
    function refreshSoon(mode) {
      requestAnimationFrame(() => refresh(mode));
      setTimeout(() => refresh(mode), 80);
    }
    const oldStart = window.start;
    if (typeof oldStart === 'function' && !oldStart.__studySmallWrapped) {
      window.start = function studySmallStart() {
        setStudy(true);
        oldStart();
        refreshSoon('all');
        setTimeout(() => document.querySelector('.panel .study-head')?.scrollIntoView({behavior:'smooth',block:'start'}), 60);
      };
      window.start.__studySmallWrapped = true;
      if (e.start) e.start.onclick = window.start;
    }
    const oldRender = window.render;
    if (typeof oldRender === 'function' && !oldRender.__studySmallWrapped) {
      window.render = function studySmallRender() {
        oldRender();
        refreshSoon();
      };
      window.render.__studySmallWrapped = true;
    }
    const oldSelectLesson = window.selectLesson;
    if (typeof oldSelectLesson === 'function' && !oldSelectLesson.__studySmallWrapped) {
      window.selectLesson = async function studySmallSelectLesson(id) {
        const res = await oldSelectLesson(id);
        refreshSoon('all');
        return res;
      };
      window.selectLesson.__studySmallWrapped = true;
    }
    document.addEventListener('click', ev => {
      if (ev.target.closest('#startBtn,#finishRestartBtn,#finishKnownBtn,#finishAgainBtn')) {
        setStudy(true);
        refreshSoon('all');
      }
      if (ev.target.closest('#finishCloseBtn')) {
        setStudy(false);
        refreshSoon();
      }
      if (ev.target.closest('#posText')) refreshSoon('all');
      if (ev.target.closest('#knownText')) refreshSoon('known');
      if (ev.target.closest('#againText,#reviewBtn')) refreshSoon('again');
      if (ev.target.closest('#knownBtn,#againBtn,#nextBtn,#prevBtn,#flipBtn,.lesson-btn,.course-btn')) {
        refreshSoon();
        setTimeout(() => { if (st.done) { setStudy(false); polishModal(); } }, 150);
      }
    }, true);
    refresh('all');
    try { if (typeof log === 'function') log('Study mode small loaded.'); } catch (_) {}
  } catch (error) {
    try { console.warn('[study-mode small disabled]', error); } catch (_) {}
  }
})();
