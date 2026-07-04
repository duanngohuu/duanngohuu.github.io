// Action flow: forgotten cards reveal every remaining face for 5 seconds each.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    let forcedWait = false;
    let releasingFocus = false;
    let waitTimer = 0;
    let releaseTimer = 0;
    let unlockTimer = 0;

    function loopOn() { return !!(st.loop || $('#loopInput')?.checked); }
    function currentCard() { return st.session?.[st.i] || null; }
    function currentFaceCount() { return Math.max(1, currentCard()?.faces?.length || 2); }
    function focusPanel() { return e.card?.closest('.panel'); }
    function setReviewMode(mode) { st.reviewMode = mode || 'all'; }
    function isKnownCard() {
      const card = currentCard();
      return !!(card && st.known?.has(card.id) && st.session?.length && !st.done);
    }
    function isAgainCard() {
      const card = currentCard();
      return !!(card && st.again?.has(card.id) && st.session?.length && !st.done);
    }
    function transitionCardChange(change) {
      if (typeof window.smoothCardTransition === 'function') return window.smoothCardTransition(change);
      change();
      return false;
    }
    function disableButtons(on) {
      [e.prev, e.flip, e.ok, e.bad].forEach(button => { if (button) button.disabled = !!on; });
    }
    function lockButtons(on) {
      forcedWait = !!on;
      if (!on) releasingFocus = false;
      document.body.classList.toggle('force-card-focus', !!on);
      focusPanel()?.classList.toggle('fc-focus-panel', !!on);
      disableButtons(on);
    }
    function releaseFocusVisual() {
      releasingFocus = true;
      document.body.classList.remove('force-card-focus');
      focusPanel()?.classList.remove('fc-focus-panel');
      disableButtons(true);
    }
    function clearFlowTimers() {
      clearTimeout(waitTimer);
      clearTimeout(releaseTimer);
      clearTimeout(unlockTimer);
    }
    function waitHint(face, count) {
      if (!e.hint) return;
      e.hint.textContent = count > 2
        ? `Đang xem mặt ${face + 1}/${count} · mỗi mặt 5 giây.`
        : 'Cưỡng chế xem mặt sau 5 giây. Tập trung nhớ lại trước khi qua thẻ tiếp theo.';
    }
    function finishFocusedReview(callback) {
      releaseFocusVisual();
      releaseTimer = setTimeout(() => {
        callback();
        unlockTimer = setTimeout(() => {
          lockButtons(false);
          requestAnimationFrame(polishActions);
        }, 300);
      }, 220);
    }
    function showBackThen(callback) {
      if (forcedWait || !st.session?.length || st.done) return;
      clearFlowTimers();
      lockButtons(true);
      const count = currentFaceCount();
      let face = count > 1 ? 1 : 0;
      st.face = face;
      if (typeof render === 'function') render();
      waitHint(face, count);

      const advance = () => {
        waitTimer = setTimeout(() => {
          face += 1;
          if (face < count) {
            st.face = face;
            if (typeof render === 'function') render();
            waitHint(face, count);
            advance();
          } else {
            finishFocusedReview(callback);
          }
        }, 5000);
      };
      advance();
    }
    function moveForwardNow() {
      if (!st.session?.length || st.done) return;
      if (st.i >= st.session.length - 1) {
        if (!loopOn()) return;
        st.i = 0;
      } else st.i += 1;
      st.face = 0;
      if (typeof render === 'function') render();
    }
    function continueOrFinishNow() {
      if (!st.session?.length || st.done) return;
      if (st.i >= st.session.length - 1 && !loopOn()) {
        if (typeof window.finishSession === 'function') window.finishSession();
        return;
      }
      moveForwardNow();
    }
    function continueOrFinish() {
      if (!st.session?.length || st.done) return;
      transitionCardChange(continueOrFinishNow);
    }
    function markAgainThenMove() {
      if (typeof window.mark === 'function') window.mark('again');
      else continueOrFinish();
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
      if (isKnownCard() && e.ok) {
        e.ok.textContent = 'Tiếp tục';
        e.ok.disabled = false;
        e.ok.classList.remove('ok');
        e.ok.classList.add('primary');
      } else if (e.ok) {
        if (e.ok.textContent.trim() === 'Tiếp tục') e.ok.textContent = 'Đã nhớ';
        e.ok.classList.remove('primary');
        e.ok.classList.add('ok');
      }
      if (isAgainCard() && e.bad) {
        e.bad.textContent = 'Tiếp tục';
        e.bad.disabled = false;
        e.bad.classList.remove('bad');
        e.bad.classList.add('primary');
      } else if (e.bad) {
        if (e.bad.textContent.trim() === 'Tiếp tục') e.bad.textContent = 'Chưa nhớ';
        e.bad.classList.remove('primary');
        e.bad.classList.add('bad');
      }
      if (forcedWait) {
        disableButtons(true);
        if (!releasingFocus) {
          document.body.classList.add('force-card-focus');
          focusPanel()?.classList.add('fc-focus-panel');
        }
      }
    }

    const oldRender = window.render;
    if (typeof oldRender === 'function' && !oldRender.__actionMultiFaceWrapped) {
      window.render = function actionMultiFaceRender() {
        oldRender();
        requestAnimationFrame(polishActions);
      };
      window.render.__actionMultiFaceWrapped = true;
    }

    document.addEventListener('touchmove', event => {
      if (forcedWait) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, { capture: true, passive: false });
    document.addEventListener('wheel', event => {
      if (forcedWait) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, { capture: true, passive: false });
    document.addEventListener('click', event => {
      if (forcedWait) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (event.target.closest('#startBtn,#finishRestartBtn')) setReviewMode('all');
      if (event.target.closest('#finishKnownBtn,#knownText')) setReviewMode('known');
      if (event.target.closest('#finishAgainBtn,#againText,#reviewBtn')) setReviewMode('again');

      const ok = event.target.closest('#knownBtn');
      if (ok && isKnownCard()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        continueOrFinish();
        requestAnimationFrame(polishActions);
        return;
      }

      const bad = event.target.closest('#againBtn');
      if (bad) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (isAgainCard()) showBackThen(continueOrFinish);
        else showBackThen(markAgainThenMove);
        return;
      }

      if (event.target.closest('#knownBtn,#againBtn,#flipBtn,#prevBtn,#loopInput,#finishKnownBtn,#finishAgainBtn,#knownText,#againText,#reviewBtn')) {
        requestAnimationFrame(polishActions);
      }
    }, true);
    document.addEventListener('change', event => {
      if (event.target?.id === 'loopInput') setTimeout(polishActions, 0);
    }, true);

    setReviewMode('all');
    polishActions();
    try { if (typeof log === 'function') log('Action multi-face flow loaded.'); } catch (_) {}
  } catch (error) {
    try { console.warn('[action-flow disabled]', error); } catch (_) {}
  }
})();
