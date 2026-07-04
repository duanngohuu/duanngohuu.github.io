// Auto study: every visible face gets 5 seconds, then move/mark forgotten.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    const AUTO_KEY = 'fc_vocab_auto_study_v1';
    let timers = [];
    let internalFlip = false;
    let lastFocus = false;
    function save(v) { try { localStorage.setItem(AUTO_KEY, v ? 'on' : 'off'); } catch (_) {} }
    function load() { try { return localStorage.getItem(AUTO_KEY) === 'on'; } catch (_) { return false; } }
    function currentCard() { return st.session?.[st.i] || null; }
    function faceCount() { return Math.max(1, currentCard()?.faces?.length || 2); }
    function autoOn() { return !!$('#autoInput')?.checked; }
    function autoFocusOn() { return autoOn() && !!st.session?.length && !st.done; }
    function active() {
      return autoFocusOn()
        && !document.body.classList.contains('force-card-focus')
        && !document.body.classList.contains('display-settings-open');
    }
    function clearTimers() {
      timers.forEach(clearTimeout);
      timers = [];
    }
    function scrollToCard() {
      try { e.card?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
    }
    function ensureBanner() {
      let banner = $('#autoStudyBanner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'autoStudyBanner';
        document.body.prepend(banner);
      }
      const count = faceCount();
      banner.textContent = count > 2 ? `Đang tự động học · ${count} mặt × 5 giây` : 'Đang tự động lật thẻ';
      return banner;
    }
    function updateFocus(forceScroll = false) {
      ensureBanner();
      const on = autoFocusOn();
      document.body.classList.toggle('auto-card-focus', on);
      if (on && (forceScroll || on !== lastFocus)) {
        requestAnimationFrame(scrollToCard);
        setTimeout(scrollToCard, 80);
        setTimeout(scrollToCard, 260);
      }
      lastFocus = on;
    }
    function ensureToggle() {
      let input = $('#autoInput');
      if (!input) {
        const label = document.createElement('label');
        label.title = 'Auto: mỗi mặt 5 giây rồi tự chuyển thẻ';
        label.innerHTML = '<input id="autoInput" type="checkbox"> ▶';
        document.querySelector('.card-options')?.appendChild(label);
        input = $('#autoInput');
      }
      input.checked = load();
      if (input.dataset.autoBound !== '1') {
        input.dataset.autoBound = '1';
        input.onchange = () => {
          save(input.checked);
          if (!input.checked) clearTimers();
          updateFocus(input.checked);
          if (input.checked) scheduleAuto(true);
        };
      }
      updateFocus();
      return input;
    }
    function moveDirect() {
      if (!st.session?.length || st.done) return;
      if (st.i >= st.session.length - 1) {
        if (st.loop || $('#loopInput')?.checked) st.i = 0;
        else {
          if (typeof window.finishSession === 'function') window.finishSession();
          else { st.done = true; if (typeof render === 'function') render(); }
          updateFocus(true);
          return;
        }
      } else st.i += 1;
      st.face = 0;
      if (typeof render === 'function') render();
      updateFocus(true);
    }
    function autoMove() {
      if (!active()) return;
      const card = currentCard();
      if (!card) return;
      if (st.known?.has(card.id) || st.again?.has(card.id)) moveDirect();
      else if (typeof window.mark === 'function') window.mark('again');
      else moveDirect();
      updateFocus(true);
    }
    function scheduleAuto(forceScroll = false) {
      ensureToggle();
      updateFocus(forceScroll);
      clearTimers();
      if (!active()) return;
      const count = faceCount();
      for (let face = 1; face < count; face++) {
        timers.push(setTimeout(() => {
          if (!active()) return;
          internalFlip = true;
          st.face = face;
          if (typeof render === 'function') render();
          updateFocus(true);
        }, face * 5000));
      }
      timers.push(setTimeout(() => {
        if (!active()) return;
        autoMove();
      }, count * 5000));
    }
    const oldRender = window.render;
    if (typeof oldRender === 'function' && !oldRender.__autoMultiFaceWrapped) {
      window.render = function autoMultiFaceRender() {
        oldRender();
        updateFocus();
        if (internalFlip) {
          internalFlip = false;
          return;
        }
        requestAnimationFrame(scheduleAuto);
      };
      window.render.__autoMultiFaceWrapped = true;
    }
    document.addEventListener('click', ev => {
      const openDisplay = ev.target.closest('#displaySettingsBtn,#displaySettingsFloatBtn');
      const closeDisplay = ev.target.closest('#displaySettingsClose') || ev.target.id === 'displaySettingsBackdrop';
      const displayUi = ev.target.closest('#displaySettingsBtn,#displaySettingsFloatBtn,#displaySettingsBackdrop');
      if (openDisplay && autoOn()) clearTimers();
      if (closeDisplay && autoOn()) setTimeout(() => scheduleAuto(true), 100);
      if (document.body.classList.contains('auto-card-focus') && !ev.target.closest('.card-options,#autoInput') && !displayUi) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        return;
      }
      if (autoOn() && ev.target.closest('#knownBtn,#againBtn,#prevBtn,#startBtn,.lesson-btn,#finishKnownBtn,#finishAgainBtn,#finishRestartBtn,#resetBtn')) {
        setTimeout(() => scheduleAuto(true), 120);
      }
    }, true);
    document.addEventListener('touchmove', ev => {
      const displayUi = ev.target.closest('#displaySettingsBackdrop');
      if (document.body.classList.contains('auto-card-focus') && !ev.target.closest('.card-options') && !displayUi) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
      }
    }, { capture: true, passive: false });
    document.addEventListener('change', ev => {
      if (ev.target?.closest('#autoInput,#loopInput') && autoOn()) setTimeout(() => scheduleAuto(true), 0);
    }, true);
    document.addEventListener('keydown', ev => {
      if (ev.key === 'Escape' && autoFocusOn()) setTimeout(() => scheduleAuto(true), 100);
    });
    ensureBanner();
    ensureToggle();
    scheduleAuto();
    try { if (typeof log === 'function') log('Auto multi-face study loaded.'); } catch (_) {}
  } catch (error) {
    try { console.warn('[auto-study disabled]', error); } catch (_) {}
  }
})();
