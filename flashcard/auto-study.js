// Auto study: every visible face gets 5 seconds, then move/mark forgotten.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    const AUTO_KEY = 'fc_vocab_auto_study_v1';
    let timers = [];
    let internalFlip = false;
    let lastFocus = false;

    function save(value) { try { localStorage.setItem(AUTO_KEY, value ? 'on' : 'off'); } catch (_) {} }
    function load() { try { return localStorage.getItem(AUTO_KEY) === 'on'; } catch (_) { return false; } }
    function currentCard() { return st.session?.[st.i] || null; }
    function faceCount() { return Math.max(1, currentCard()?.faces?.length || 2); }
    function autoOn() { return !!$('#autoInput')?.checked; }
    function autoFocusOn() { return autoOn() && !!st.session?.length && !st.done; }
    function settingsOpen() {
      return document.body.classList.contains('display-settings-open')
        || document.body.classList.contains('system-settings-open');
    }
    function active() {
      return autoFocusOn()
        && !document.body.classList.contains('force-card-focus')
        && !settingsOpen();
    }
    function allowedAutoTarget(target) {
      return !!target?.closest?.([
        '.card-options',
        '.nav-actions',
        '#displaySettingsBackdrop',
        '#systemSettingsBackdrop',
        '.display-settings-backdrop',
        '.system-settings-backdrop',
        '#displaySettingsBtn',
        '#displaySettingsFloatBtn',
        '#systemSettingsBtn',
        '#themeToggle'
      ].join(','));
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
        banner.className = 'hidden';
        document.body.prepend(banner);
      }
      return banner;
    }
    function defaultAutoText() {
      const count = faceCount();
      return count > 2 ? `Tự động học · ${count} mặt × 5 giây` : 'Tự động học · mỗi mặt 5 giây';
    }
    function renderStatusBanner() {
      const banner = ensureBanner();
      const offline = document.body.classList.contains('network-offline');
      const reconnected = document.body.classList.contains('network-reconnected');
      const auto = autoFocusOn();
      let text = '';
      let tone = '';

      if (reconnected) {
        text = auto ? 'Đã có mạng · tự động học tiếp tục' : 'Đã có mạng';
        tone = 'is-online';
      } else if (offline) {
        text = auto ? 'Offline · tự động học bằng dữ liệu đã lưu' : 'Đang offline · dùng dữ liệu đã lưu';
        tone = 'is-offline';
      } else if (auto) {
        text = defaultAutoText();
        tone = 'is-auto';
      }

      banner.classList.remove('hidden', 'is-online', 'is-offline', 'is-auto');
      if (!text) {
        banner.classList.add('hidden');
        banner.textContent = '';
        return;
      }
      banner.classList.add(tone);
      if (banner.textContent !== text) banner.textContent = text;
    }
    function updateFocus(forceScroll = false) {
      const on = autoFocusOn();
      document.body.classList.toggle('auto-card-focus', on);
      renderStatusBanner();
      if (on && !settingsOpen() && (forceScroll || on !== lastFocus)) {
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

    document.addEventListener('click', event => {
      const opensSettings = event.target.closest('#displaySettingsBtn,#displaySettingsFloatBtn,#systemSettingsBtn');
      const closesSettings = event.target.closest('#displaySettingsClose,#systemSettingsClose')
        || event.target.id === 'displaySettingsBackdrop'
        || event.target.id === 'systemSettingsBackdrop';
      if (opensSettings && autoOn()) clearTimers();
      if (document.body.classList.contains('auto-card-focus') && !allowedAutoTarget(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (closesSettings && autoOn()) {
        setTimeout(() => {
          if (!settingsOpen()) scheduleAuto(true);
        }, 120);
      }
      if (autoOn() && event.target.closest('#knownBtn,#againBtn,#prevBtn,#startBtn,.lesson-btn,#finishKnownBtn,#finishAgainBtn,#finishRestartBtn,#resetBtn')) {
        setTimeout(() => scheduleAuto(true), 120);
      }
    }, true);
    document.addEventListener('touchmove', event => {
      if (document.body.classList.contains('auto-card-focus') && !allowedAutoTarget(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, { capture: true, passive: false });
    document.addEventListener('change', event => {
      if (event.target?.closest('.card-options input') && autoOn()) setTimeout(() => scheduleAuto(true), 0);
    }, true);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && autoFocusOn()) setTimeout(() => scheduleAuto(true), 140);
    });
    window.addEventListener('flashcard-connectivity', renderStatusBanner);

    window.refreshFlashcardStatusBanner = renderStatusBanner;
    ensureBanner();
    ensureToggle();
    scheduleAuto();
    try { if (typeof log === 'function') log('Auto multi-face study loaded.'); } catch (_) {}
  } catch (error) {
    try { console.warn('[auto-study disabled]', error); } catch (_) {}
  }
})();
