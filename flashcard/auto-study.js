// Auto study: 5s first side, 5s back side, then continue/mark forgotten.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    const AUTO_KEY = 'fc_vocab_auto_study_v1';
    let tFlip = 0;
    let tMove = 0;
    let internalFlip = false;
    function save(v) { try { localStorage.setItem(AUTO_KEY, v ? 'on' : 'off'); } catch (_) {} }
    function load() { try { return localStorage.getItem(AUTO_KEY) === 'on'; } catch (_) { return false; } }
    function currentCard() { return st.session?.[st.i] || null; }
    function autoOn() { return !!$('#autoInput')?.checked; }
    function active() {
      return autoOn() && !!st.session?.length && !st.done && !document.body.classList.contains('force-card-focus');
    }
    function clearTimers() {
      clearTimeout(tFlip);
      clearTimeout(tMove);
      tFlip = 0;
      tMove = 0;
    }
    function ensureToggle() {
      let input = $('#autoInput');
      if (!input) {
        const label = document.createElement('label');
        label.title = 'Auto: 5s mặt đầu, 5s mặt sau, rồi tự chuyển';
        label.innerHTML = '<input id="autoInput" type="checkbox"> ▶';
        document.querySelector('.card-options')?.appendChild(label);
        input = $('#autoInput');
      }
      input.checked = load();
      if (input.dataset.autoBound !== '1') {
        input.dataset.autoBound = '1';
        input.onchange = () => {
          save(input.checked);
          if (input.checked) scheduleAuto();
          else clearTimers();
        };
      }
      return input;
    }
    function moveDirect() {
      if (!st.session?.length || st.done) return;
      if (st.i >= st.session.length - 1) {
        if (st.loop || $('#loopInput')?.checked) st.i = 0;
        else {
          if (typeof window.finishSession === 'function') window.finishSession();
          else { st.done = true; if (typeof render === 'function') render(); }
          return;
        }
      } else st.i += 1;
      st.face = 0;
      if (typeof render === 'function') render();
    }
    function autoMove() {
      if (!active()) return;
      const c = currentCard();
      if (!c) return;
      if (st.known?.has(c.id) || st.again?.has(c.id)) moveDirect();
      else if (typeof window.mark === 'function') window.mark('again');
      else moveDirect();
    }
    function scheduleAuto() {
      ensureToggle();
      clearTimers();
      if (!active()) return;
      if (e.hint) e.hint.textContent = (e.hint.textContent || '') + '  Auto: 5s/mặt.';
      tFlip = setTimeout(() => {
        if (!active()) return;
        internalFlip = true;
        st.face = 1;
        if (typeof render === 'function') render();
        if (e.hint) e.hint.textContent = 'Auto: đang xem mặt sau 5 giây.';
      }, 5000);
      tMove = setTimeout(() => {
        if (!active()) return;
        autoMove();
      }, 10000);
    }
    const oldRender = window.render;
    if (typeof oldRender === 'function' && !oldRender.__autoStudyWrapped) {
      window.render = function autoStudyRender() {
        oldRender();
        if (internalFlip) {
          internalFlip = false;
          return;
        }
        requestAnimationFrame(scheduleAuto);
      };
      window.render.__autoStudyWrapped = true;
    }
    document.addEventListener('click', ev => {
      if (ev.target.closest('#knownBtn,#againBtn,#prevBtn,#startBtn,.lesson-btn,#finishKnownBtn,#finishAgainBtn,#finishRestartBtn,#resetBtn')) {
        setTimeout(scheduleAuto, 120);
      }
    }, true);
    document.addEventListener('change', ev => {
      if (ev.target?.closest('#autoInput,#loopInput')) setTimeout(scheduleAuto, 0);
    }, true);
    ensureToggle();
    scheduleAuto();
    try { if (typeof log === 'function') log('Auto study loaded.'); } catch (_) {}
  } catch (error) {
    try { console.warn('[auto-study disabled]', error); } catch (_) {}
  }
})();
