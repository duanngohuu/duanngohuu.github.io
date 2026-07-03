// Small study UX layer. No MutationObserver, no interval.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    const MIX_KEY = 'fc_vocab_mix_pick_v1';
    function isRunning() { return !!(st.session && st.session.length && !st.done); }
    function setStudy(on) { document.body.classList.toggle('study-active', !!on); }
    function setLessonSelected() { document.body.classList.toggle('has-selected-lesson', !!st.lesson); }
    function openLessonMenu() { document.body.classList.add('library-open'); }
    function shuffleCopy(arr) { return [...arr].sort(() => Math.random() - 0.5); }
    function ensureMixToggle() {
      let input = $('#mixInput');
      if (!input) {
        const loopLabel = $('#loopInput')?.closest('label');
        const label = document.createElement('label');
        label.title = 'Trộn từ trong range';
        label.innerHTML = '<input id="mixInput" type="checkbox"> 🎲 Từ';
        if (loopLabel) loopLabel.after(label);
        else document.querySelector('.card-options')?.appendChild(label);
        input = $('#mixInput');
      }
      if (!input || input.dataset.bound === '1') return input;
      input.dataset.bound = '1';
      try { input.checked = localStorage.getItem(MIX_KEY) === 'on'; } catch (_) { input.checked = false; }
      input.onchange = () => {
        try { localStorage.setItem(MIX_KEY, input.checked ? 'on' : 'off'); } catch (_) {}
      };
      return input;
    }
    function shouldMixPick() { return !!$('#mixInput')?.checked; }
    function buildMixedSession() {
      let a = Math.max(1, +e.from.value || 1);
      let b = Math.min(st.cards.length, +e.to.value || st.cards.length);
      if (a > b) [a, b] = [b, a];
      let arr = st.cards.filter(c => c.no >= a && c.no <= b);
      arr = shuffleCopy(arr);
      if (e.limit.value !== 'all') arr = arr.slice(0, +e.limit.value);
      return arr;
    }
    function ensureSelectedLessonLabel() {
      const controls = document.querySelector('.controls');
      if (!controls) return null;
      let box = $('#selectedLessonBox');
      if (!box) {
        box = document.createElement('button');
        box.id = 'selectedLessonBox';
        box.type = 'button';
        box.className = 'selected-lesson-box';
        box.innerHTML = '<span>Bài đã chọn</span><strong id="selectedLessonText">Chưa chọn bài</strong><em>Đổi bài</em>';
        box.onclick = openLessonMenu;
        controls.prepend(box);
      }
      return box;
    }
    function ensureBottomLessonButton() {
      let btn = $('#bottomLessonBtn');
      if (btn) return btn;
      const actionGroups = document.querySelectorAll('.panel.glass .actions');
      const bottom = actionGroups[actionGroups.length - 1];
      if (!bottom) return null;
      btn = document.createElement('button');
      btn.id = 'bottomLessonBtn';
      btn.type = 'button';
      btn.className = 'secondary';
      btn.textContent = '☰ Bài học';
      btn.onclick = openLessonMenu;
      bottom.appendChild(btn);
      return btn;
    }
    function updateSelectedLessonLabel() {
      const box = ensureSelectedLessonLabel();
      const text = $('#selectedLessonText');
      if (!box || !text) return;
      text.textContent = st.lesson?.title || 'Chưa chọn bài';
      box.classList.toggle('has-lesson', !!st.lesson);
      setLessonSelected();
    }
    function normalizeFlashcardTitle() {
      if (!e.title) return;
      const hide = !!st.lesson;
      e.title.textContent = st.lesson ? '' : 'Chọn bài học';
      e.title.closest('div')?.classList.toggle('title-empty', hide);
    }
    function polishHintText() {
      if (!e.hint) return;
      if (!st.session?.length) {
        e.hint.textContent = st.lesson ? 'Chọn số lượng rồi bấm Bắt đầu học.' : 'Đang tải menu bài học.';
        return;
      }
      if (st.face === 0) e.hint.textContent = 'Mặt trước: xem thẻ cần nhớ.';
      else e.hint.textContent = 'Mặt sau: xem nghĩa, cách đọc và ghi chú.';
    }
    function setLabel(inputSelector, text, title) {
      const input = $(inputSelector);
      const label = input?.closest('label');
      if (!input || !label || label.dataset.shortText === text) return;
      label.dataset.shortText = text;
      if (title) label.title = title;
      label.innerHTML = '';
      label.append(input, document.createTextNode(' ' + text));
    }
    function renameLabels() {
      ensureMixToggle();
      setLabel('#shuffleInput', '🔀', 'Trộn thứ tự thẻ');
      setLabel('#readingInput', 'あ', 'Hiện Hiragana/cách đọc ở mặt trước');
      setLabel('#loopInput', '🔁', 'Lặp lại từ sau khi hết phiên');
      setLabel('#mixInput', '🎲', 'Trộn từ trong range trước khi lấy số lượng học');
      if (e.known) e.known.textContent = e.known.textContent.replace(/^Biết:/, 'Đã nhớ:');
      if (e.ok && e.ok.textContent.trim() === 'Biết rồi') e.ok.textContent = 'Đã nhớ';
      if (e.flip && e.flip.textContent.trim() === 'Lật') e.flip.textContent = 'Lật thẻ';
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
      ensureBottomLessonButton();
      updateSelectedLessonLabel();
      normalizeFlashcardTitle();
      renameLabels();
      polishHintText();
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
        if (shouldMixPick()) {
          if (!st.cards.length) return;
          document.querySelector('#finishModal')?.classList.remove('on');
          st.done = false;
          st.finishShown = false;
          st.session = buildMixedSession();
          st.i = 0;
          st.face = 0;
          if (typeof saveLast === 'function') saveLast();
          if (typeof render === 'function') render();
          try { if (typeof log === 'function') log('Bắt đầu học trộn ' + st.session.length + ' thẻ.'); } catch (_) {}
        } else {
          oldStart();
        }
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
    const oldFlip = window.flip;
    if (typeof oldFlip === 'function' && !oldFlip.__studySmallWrapped) {
      window.flip = function studySmallFlip() {
        oldFlip();
        refreshSoon();
      };
      window.flip.__studySmallWrapped = true;
      if (e.flip) e.flip.onclick = window.flip;
      if (e.card) e.card.onclick = window.flip;
    }
    const oldSelectLesson = window.selectLesson;
    if (typeof oldSelectLesson === 'function' && !oldSelectLesson.__studySmallWrapped) {
      window.selectLesson = async function studySmallSelectLesson(id) {
        const res = await oldSelectLesson(id);
        setLessonSelected();
        refreshSoon('all');
        return res;
      };
      window.selectLesson.__studySmallWrapped = true;
    }
    document.addEventListener('click', ev => {
      if (ev.target.closest('#selectedLessonBox,#bottomLessonBtn')) openLessonMenu();
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
      if (ev.target.closest('#knownBtn,#againBtn,#nextBtn,#prevBtn,#flipBtn,.lesson-btn,.course-btn,.card')) {
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
