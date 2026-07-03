// Card tap flow: empty card opens lesson menu; ready card starts study; active card keeps flipping.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    function hasActiveSession() {
      return !!(st.session && st.session.length && !st.done);
    }
    function openLessonMenu() {
      document.body.classList.add('library-open');
    }
    function startStudy() {
      if (typeof window.start === 'function') window.start();
      else document.querySelector('#startBtn')?.click();
    }
    function polishReadyHint() {
      if (!e.hint) return;
      if (!st.lesson) e.hint.textContent = 'Bấm thẻ để chọn bài học.';
      else if (!hasActiveSession()) e.hint.textContent = 'Sẵn sàng. Bấm thẻ để bắt đầu học.';
    }
    document.addEventListener('click', ev => {
      const card = ev.target.closest('#card');
      if (!card) return;
      if (!st.lesson) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        openLessonMenu();
        polishReadyHint();
        return;
      }
      if (!hasActiveSession()) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        startStudy();
        return;
      }
    }, true);
    document.addEventListener('click', ev => {
      if (ev.target.closest('.lesson-btn,#startBtn,#finishCloseBtn,#finishRestartBtn,#finishKnownBtn,#finishAgainBtn')) {
        requestAnimationFrame(polishReadyHint);
        setTimeout(polishReadyHint, 100);
      }
    }, true);
    const oldRender = window.render;
    if (typeof oldRender === 'function' && !oldRender.__cardTapFlowWrapped) {
      window.render = function cardTapFlowRender() {
        oldRender();
        requestAnimationFrame(polishReadyHint);
      };
      window.render.__cardTapFlowWrapped = true;
    }
    polishReadyHint();
    try { if (typeof log === 'function') log('Card tap flow loaded.'); } catch (_) {}
  } catch (error) {
    try { console.warn('[card-tap-flow disabled]', error); } catch (_) {}
  }
})();
