// Auto study: pause for menus/settings and switch lessons without exposing the main screen.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = selector => document.querySelector(selector);
    const AUTO_KEY = 'fc_vocab_auto_study_v1';
    const LESSON_WAIT_MS = 30000;
    let timers = [];
    let internalFlip = false;
    let lastFocus = false;
    let resumeTimer = 0;
    let lessonSwitch = null;
    let lessonSwitchToken = 0;
    let menuSnapshot = null;

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
    function switchingLesson() { return !!lessonSwitch; }
    function active() {
      return autoFocusOn()
        && !switchingLesson()
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
      const auto = autoFocusOn() || switchingLesson();
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
      const on = autoFocusOn() && !switchingLesson() && !menuOpen() && !settingsOpen();
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
          if (!input.checked) cancelLessonSwitch(false);
          updateFocus(input.checked);
          if (input.checked) scheduleAuto(true);
        };
      }
      $('#autoLessonMenuDock')?.remove();
      return input;
    }
    function takeMenuSnapshot() {
      if (!autoFocusOn()) return;
      menuSnapshot = {
        lesson: st.lesson,
        cards: st.cards,
        session: st.session,
        i: st.i,
        face: st.face,
        done: st.done,
        finishShown: st.finishShown,
        reviewMode: st.reviewMode
      };
    }
    function restoreMenuSnapshot() {
      if (!menuSnapshot || switchingLesson()) return false;
      st.lesson = menuSnapshot.lesson;
      st.cards = menuSnapshot.cards;
      st.session = menuSnapshot.session;
      st.i = menuSnapshot.i;
      st.face = menuSnapshot.face;
      st.done = menuSnapshot.done;
      st.finishShown = menuSnapshot.finishShown;
      st.reviewMode = menuSnapshot.reviewMode;
      menuSnapshot = null;
      window.render?.();
      scheduleAuto(true);
      return true;
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
    function cardsReadyForSwitch(switchState) {
      return switchState
        && st.lesson?.id === switchState.lessonId
        && Array.isArray(st.cards)
        && st.cards.length > 0
        && st.cards !== switchState.previousCards;
    }
    function closeSheetLoadingUi() {
      $('#sheetLoadOverlay')?.classList.add('hidden');
      document.body.classList.remove('sheet-loading-open');
    }
    function cancelLessonSwitch(restore = true) {
      lessonSwitchToken += 1;
      lessonSwitch = null;
      document.body.classList.remove('auto-lesson-switching');
      closeSheetLoadingUi();
      renderStatusBanner();
      if (restore) restoreMenuSnapshot();
    }
    function startSelectedLessonSession(switchState) {
      if (!cardsReadyForSwitch(switchState) || switchState.token !== lessonSwitchToken) return false;

      closeSheetLoadingUi();
      document.querySelector('#finishModal')?.classList.remove('on');
      document.body.classList.remove('library-open');
      st.reviewMode = null;
      st.done = false;
      st.finishShown = false;
      st.face = 0;

      // Use the app's normal start chain so range, quantity, shuffle and batch logic stay identical.
      window.start?.();
      if (!st.session?.length && typeof window.buildSession === 'function') {
        st.session = window.buildSession();
        st.i = 0;
        st.face = 0;
        window.render?.();
      }
      if (!st.session?.length) return false;

      menuSnapshot = null;
      lessonSwitch = null;
      document.body.classList.remove('auto-lesson-switching');
      document.body.classList.add('auto-card-focus');
      renderStatusBanner();
      clearTimers();
      requestAnimationFrame(() => scheduleAuto(true));
      return true;
    }
    async function watchSelectedLesson(switchState) {
      const deadline = Date.now() + LESSON_WAIT_MS;
      while (Date.now() < deadline && switchState.token === lessonSwitchToken) {
        if (startSelectedLessonSession(switchState)) return;
        await wait(50);
      }
      if (switchState.token === lessonSwitchToken) cancelLessonSwitch(true);
    }
    function beginLessonSwitch(lessonId) {
      if (!autoOn() || !lessonId) return null;
      if (lessonSwitch?.lessonId === lessonId) return lessonSwitch;

      clearTimers();
      const switchState = {
        lessonId,
        previousCards: st.cards,
        token: ++lessonSwitchToken
      };
      lessonSwitch = switchState;
      document.body.classList.add('auto-lesson-switching');
      document.body.classList.remove('auto-card-focus');
      renderStatusBanner();
      watchSelectedLesson(switchState);
      return switchState;
    }
    function installFinalLessonWrapper() {
      const finalSelectLesson = window.selectLesson;
      if (typeof finalSelectLesson !== 'function' || finalSelectLesson.__autoDirectWrapped) return;
      window.selectLesson = async function autoDirectSelectLesson(id) {
        const shouldSwitch = autoOn() && (menuOpen() || switchingLesson());
        if (shouldSwitch) beginLessonSwitch(id);
        const result = await finalSelectLesson(id);
        if (shouldSwitch && !switchingLesson()) beginLessonSwitch(id);
        return result;
      };
      window.selectLesson.__autoDirectWrapped = true;
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
        if (!switchingLesson()) requestAnimationFrame(scheduleAuto);
      };
      window.render.__autoMultiFaceWrapped = true;
    }

    document.addEventListener('click', event => {
      const lessonButton = event.target.closest('.library-panel .lesson-btn[data-lesson-id]');
      if (lessonButton && autoOn() && menuOpen()) beginLessonSwitch(lessonButton.dataset.lessonId);

      const opensSettings = event.target.closest('#displaySettingsBtn,#displaySettingsFloatBtn,#systemSettingsBtn');
      const closesSettings = event.target.closest('#displaySettingsClose,#systemSettingsClose')
        || event.target.id === 'displaySettingsBackdrop'
        || event.target.id === 'systemSettingsBackdrop';

      if (event.target.closest('#bottomLessonBtn') && autoOn()) {
        takeMenuSnapshot();
        clearTimers();
        installFinalLessonWrapper();
      }
      if (opensSettings && autoOn()) clearTimers();

      if (document.body.classList.contains('auto-card-focus') && !allowedAutoTarget(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      if (event.target.id === 'drawerBackdrop' && autoOn()) {
        clearTimeout(resumeTimer);
        resumeTimer = setTimeout(() => {
          if (!restoreMenuSnapshot()) scheduleAuto(true);
        }, 80);
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
      refresh: updateFocus,
      beginLessonSwitch
    };

    ensureBanner();
    ensureToggle();
    scheduleAuto();
    setTimeout(installFinalLessonWrapper, 0);
  } catch (error) {
    try { console.warn('[auto-study disabled]', error); } catch (_) {}
  }
})();
