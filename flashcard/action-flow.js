// Action flow: learn by marking known/unknown. Next button is not part of the flow.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    let forcedWait = false;
    let releasingFocus = false;
    let waitTimer = 0;
    let releaseTimer = 0;
    let unlockTimer = 0;

    function loopOn() {
      return !!(st.loop || $('#loopInput')?.checked);
    }
    function currentCard() {
      return st.session?.[st.i] || null;
    }
    function focusPanel() {
      return e.card?.closest('.panel');
    }
    function setReviewMode(mode) {
      st.reviewMode = mode || 'all';
    }
    function isKnownCard() {
      const c = currentCard();
      return !!(c && st.known?.has(c.id) && !!st.session?.length && !st.done);
    }
    function isAgainCard() {
      const c = currentCard();
      return !!(c && st.again?.has(c.id) && !!st.session?.length && !st.done);
    }
    function disableButtons(on) {
      [e.prev, e.flip, e.ok, e.bad].forEach(btn => { if (btn) btn.disabled = !!on; });
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
    function showBackThen(callback) {
      if (forcedWait || !st.session?.length || st.done) return;
      clearFlowTimers();
      lockButtons(true);
      if (st.face !== 1) {
        st.face = 1;
        if (typeof render === 'function') render();
      }
      if (e.hint) e.hint.textContent = 'Cưỡng chế xem mặt sau 5 giây. Tập trung nhớ lại trước khi qua thẻ tiếp theo.';

      waitTimer = setTimeout(() => {
        // First return the current card to normal view.
        releaseFocusVisual();

        // Only after the focus layer has visibly gone away do we replace the card.
        releaseTimer = setTimeout(() => {
          callback();

          // Keep controls locked until the new card transition has settled.
          unlockTimer = setTimeout(() => {
            lockButtons(false);
            requestAnimationFrame(polishActions);
          }, 260);
        }, 220);
      }, 5000);
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
    if (typeof oldRender === 'function' && !oldRender.__actionFlowReleaseWrapped) {
      window.render = function actionFlowReleaseRender() {
        oldRender();
        requestAnimationFrame(polishActions);
      };
      window.render.__actionFlowReleaseWrapped = true;
    }

    document.addEventListener('touchmove', ev => {
      if (forcedWait) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
      }
    }, {capture:true, passive:false});
    document.addEventListener('wheel', ev => {
      if (forcedWait) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
      }
    }, {capture:true, passive:false});
    document.addEventListener('click', ev => {
      if (forcedWait) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        return;
      }
      if (ev.target.closest('#startBtn,#finishRestartBtn')) setReviewMode('all');
      if (ev.target.closest('#finishKnownBtn,#knownText')) setReviewMode('known');
      if (ev.target.closest('#finishAgainBtn,#againText,#reviewBtn')) setReviewMode('again');

      const ok = ev.target.closest('#knownBtn');
      if (ok && isKnownCard()) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        continueOrFinish();
        requestAnimationFrame(polishActions);
        return;
      }

      const bad = ev.target.closest('#againBtn');
      if (bad) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        if (isAgainCard()) showBackThen(continueOrFinish);
        else showBackThen(markAgainThenMove);
        return;
      }

      if (ev.target.closest('#knownBtn,#againBtn,#flipBtn,#prevBtn,#loopInput,#finishKnownBtn,#finishAgainBtn,#knownText,#againText,#reviewBtn')) {
        requestAnimationFrame(polishActions);
      }
    }, true);
    document.addEventListener('change', ev => {
      if (ev.target && ev.target.id === 'loopInput') setTimeout(polishActions, 0);
    }, true);

    setReviewMode('all');
    polishActions();
    try { if (typeof log === 'function') log('Action flow release-first loaded.'); } catch (_) {}
  } catch (error) {
    try { console.warn('[action-flow disabled]', error); } catch (_) {}
  }
})();
