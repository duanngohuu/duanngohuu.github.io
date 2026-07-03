// Action flow: learn by marking known/unknown. Next button is not part of the flow.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    function loopOn() {
      return !!(st.loop || $('#loopInput')?.checked);
    }
    function currentCard() {
      return st.session?.[st.i] || null;
    }
    function setReviewMode(mode) {
      st.reviewMode = mode || 'all';
    }
    function isKnownReview() {
      return st.reviewMode === 'known' && !!st.session?.length && !st.done;
    }
    function moveForwardWithLoop() {
      if (!st.session?.length || st.done) return;
      if (st.i >= st.session.length - 1) {
        if (!loopOn()) return;
        st.i = 0;
      } else {
        st.i += 1;
      }
      st.face = 0;
      if (typeof render === 'function') render();
    }
    function continueOrFinish() {
      if (!st.session?.length || st.done) return;
      if (st.i >= st.session.length - 1 && !loopOn()) {
        if (typeof window.finishSession === 'function') window.finishSession();
        return;
      }
      moveForwardWithLoop();
    }
    function polishActions() {
      if (e.next) {
        e.next.disabled = true;
        e.next.setAttribute('aria-hidden', 'true');
      }
      if (e.flip) {
        e.flip.textContent = 'Lật thẻ';
        e.flip.classList.remove('secondary');
        e.flip.classList.add('primary');
      }
      const c = currentCard();
      if (isKnownReview() && e.ok && c && st.known?.has(c.id)) {
        e.ok.textContent = 'Tiếp tục';
        e.ok.disabled = false;
        e.ok.classList.remove('ok');
        e.ok.classList.add('primary');
      } else if (e.ok) {
        if (e.ok.textContent.trim() === 'Tiếp tục') e.ok.textContent = 'Đã nhớ';
        e.ok.classList.add('ok');
      }
      if (loopOn() && e.bad && c && st.again?.has(c.id) && !st.done) {
        e.bad.disabled = false;
      }
    }
    const oldRender = window.render;
    if (typeof oldRender === 'function' && !oldRender.__actionFlowWrapped) {
      window.render = function actionFlowRender() {
        oldRender();
        requestAnimationFrame(polishActions);
      };
      window.render.__actionFlowWrapped = true;
    }
    document.addEventListener('click', ev => {
      if (ev.target.closest('#startBtn,#finishRestartBtn')) setReviewMode('all');
      if (ev.target.closest('#finishKnownBtn,#knownText')) setReviewMode('known');
      if (ev.target.closest('#finishAgainBtn,#againText,#reviewBtn')) setReviewMode('again');
      const ok = ev.target.closest('#knownBtn');
      if (ok) {
        const c = currentCard();
        if (isKnownReview() && c && st.known?.has(c.id)) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          continueOrFinish();
          requestAnimationFrame(polishActions);
          return;
        }
      }
      const bad = ev.target.closest('#againBtn');
      if (bad) {
        const c = currentCard();
        if (loopOn() && c && st.again?.has(c.id) && !st.done) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          moveForwardWithLoop();
          requestAnimationFrame(polishActions);
          return;
        }
      }
      if (ev.target.closest('#knownBtn,#againBtn,#flipBtn,#prevBtn,#loopInput,#finishKnownBtn,#knownText')) {
        requestAnimationFrame(polishActions);
        setTimeout(polishActions, 80);
      }
    }, true);
    document.addEventListener('change', ev => {
      if (ev.target && ev.target.id === 'loopInput') setTimeout(polishActions, 0);
    }, true);
    setReviewMode('all');
    polishActions();
    try { if (typeof log === 'function') log('Action flow loaded.'); } catch (_) {}
  } catch (error) {
    try { console.warn('[action-flow disabled]', error); } catch (_) {}
  }
})();
