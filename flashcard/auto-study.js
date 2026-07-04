// Auto study: pause for menus/settings and resume directly in focused study mode.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = selector => document.querySelector(selector);
    const AUTO_KEY = 'fc_vocab_auto_study_v1';
    let timers = [];
    let internalFlip = false;
    let lastFocus = false;
    let resumeTimer = 0;

    function save(value) { try { localStorage.setItem(AUTO_KEY, value ? 'on' : 'off'); } catch (_) {} }
    function load() { try { return localStorage.getItem(AUTO_KEY) === 'on'; } catch (_) { return false; } }
    function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
    function currentCard() { return st.session?.[st.i] || null; }
    function faceCount() { return Math.max(1, currentCard()?.faces?.length || 2); }
    function autoOn() { return !!$('#autoInput')?.checked; }
    function autoFocusOn() { return autoOn() && !!st.session?.length && !st.done; }
    function menuOpen() { return document.body.classList.contains('library-open'); }
    function settingsOpen() {
      return document.body.classList.contains('display-settings-open')
        || document.body.classList.contains('system-settings-open');
    }
    function active() {
      return autoFocusOn()
        && !document.body.classList.contains('force-card-focus')
        && !settingsOpen()
        && !menuOpen();
    }
    function allowedAutoTarget(target) {
      return !!target?.closest?.([
        '.card-options',
        '#bottomLessonBtn',
        '.library-panel',
        '#drawerBackdrop',
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
      clearTimeout(resumeTimer);
    }
    function scrollToCard() {
      try { e.card?.scrollIntoView({ behavior: 'auto', block: 'center' }); } catch (_) {}
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
        text = 'Đang tự động học';
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
      const on = autoFocusOn() && !menuOpen() && !settingsOpen();
      document.body.classList.toggle('auto-card-focus', on);
      renderStatusBanner();
      if (on && (forceScroll || on !== lastFocus)) {
        requestAnimationFrame(scrollToCard);
        setTimeout(scrollToCard, 70);
      }
      lastFocus = on;
    }
    function ensureToggle() {
      let input = $('#autoInput');
      if (!input) {
        const label = document.createElement('label');
        label.title = 'Bật hoặc tắt tự động học';
        label.innerHTML = '<input id="autoInput" type="checkbox"> ▶';
        document.querySelector('.card-options')?.appendChild(label);
        input = $('#autoInput');
      }
      input.checked = load();
      if (input.dataset.autoBound !== '1') {
        input.dataset.autoBound = '1';
        input.onchange = () => {
          save(input.checked);
          clearTimers();
          updateFocus(input.checked);
          if (input.checked) scheduleAuto(true);
        };
      }
      $('#autoLessonMenuDock')?.remove();
      return input;
    }
    function moveDirect() {
      if (!st.session?.length || st.done) return;
      if (st.i >= st.session.length - 1) {
        if (st.loop || $('#loopInput')?.checked) st.i = 0;
        else {
          if (typeof window.finishSession === 'function') window.finishSession();
          else { st.done = true; window.render?.(); }
          updateFocus(true);
          return;
        }
      } else st.i += 1;
      st.face = 0;
      window.render?.();
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
      const startFace = Math.max(0, Math.min(Number(st.face) || 0, count - 1));
      for (let face = startFace + 1; face < count; face++) {
        timers.push(setTimeout(() => {
          if (!active()) return;
          internalFlip = true;
          st.face = face;
          window.render?.();
          updateFocus(true);
        }, (face - startFace) * 5000));
      }
      timers.push(setTimeout(() => {
        if (active()) autoMove();
      }, (count - startFace) * 5000));
    }
    function buildFreshSession() {
      let from = Math.max(1, Number(e.from?.value) || 1);
      let to = Math.min(st.cards.length, Number(e.to?.value) || st.cards.length);
      if (from > to) [from, to] = [to, from];
      let cards = st.cards.filter(card => card.no >= from && card.no <= to);
      if (e.shuffle?.checked) cards = [...cards].sort(() => Math.random() - 0.5);
      if (e.limit?.value !== 'all') cards = cards.slice(0, Number(e.limit?.value) || 10);
      return cards;
    }
    async function enterSelectedLesson(lessonId) {
      for (let attempt = 0; attempt < 160; attempt++) {
        if (st.lesson?.id === lessonId && st.cards?.length) break;
        await wait(50);
      }
      if (st.lesson?.id !== lessonId || !st.cards?.length) return;

      document.querySelector('#finishModal')?.classList.remove('on');
      st.reviewMode = 'all';
      st.session = buildFreshSession();
      st.i = 0;
      st.face = 0;
      st.done = false;
      st.finishShown = false;
      try { window.saveLast?.(); } catch (_) {}
      window.render?.();

      document.body.classList.add('auto-card-focus');
      document.body.classList.remove('library-open');
      renderStatusBanner();
      requestAnimationFrame(() => scheduleAuto(true));
    }
    function installFinalLessonWrapper() {
      const finalSelectLesson = window.selectLesson;
      if (typeof finalSelectLesson !== 'function' || finalSelectLesson.__autoFinalWrapped) return;
      window.selectLesson = async function autoFinalSelectLesson(id) {
        const selectedFromAutoMenu = autoOn() && menuOpen();
        if (selectedFromAutoMenu) clearTimers();
        const result = await finalSelectLesson(id);
        if (selectedFromAutoMenu) await enterSelectedLesson(id);
        return result;
      };
      window.selectLesson.__autoFinalWrapped = true;
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

      if (event.target.closest('#bottomLessonBtn') && autoOn()) clearTimers();
      if (opensSettings && autoOn()) clearTimers();

      if (document.body.classList.contains('auto-card-focus') && !allowedAutoTarget(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      if (event.target.id === 'drawerBackdrop' && autoOn()) {
        clearTimeout(resumeTimer);
        resumeTimer = setTimeout(() => scheduleAuto(true), 80);
      }
      if (closesSettings && autoOn()) {
        setTimeout(() => {
          if (!settingsOpen()) scheduleAuto(true);
        }, 100);
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

    window.addEventListener('flashcard-connectivity', renderStatusBanner);

    new MutationObserver(() => {
      if (!autoOn()) return;
      if (menuOpen()) {
        clearTimers();
        updateFocus(false);
      }
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

    window.refreshFlashcardStatusBanner = renderStatusBanner;
    window.flashcardAutoStudy = {
      pause: clearTimers,
      resume: () => scheduleAuto(true),
      refresh: updateFocus
    };

    ensureBanner();
    ensureToggle();
    scheduleAuto();
    setTimeout(installFinalLessonWrapper, 0);
  } catch (error) {
    try { console.warn('[auto-study disabled]', error); } catch (_) {}
  }
})();
