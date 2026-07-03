// 3D card motion controller. Pure class toggles, no observers/intervals.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    const CARD_CLASSES = ['fc-pop','fc-flip','fc-next','fc-prev','fc-tap'];
    let lastPos = '0/0';
    function card() { return $('#card'); }
    function running() { return !!(st.session && st.session.length && !st.done); }
    function clearFx(el) {
      if (!el) return;
      el.classList.remove('fc-animating', ...CARD_CLASSES);
    }
    function fx(name, ms = 430) {
      const el = card();
      if (!el) return;
      clearFx(el);
      void el.offsetWidth;
      el.classList.add('fc-animating', name);
      window.setTimeout(() => {
        el.classList.remove(name, 'fc-animating');
        updateIdle();
      }, ms);
    }
    function flipFx() { fx('fc-flip', 540); }
    function updateIdle() {
      const el = card();
      if (!el) return;
      const idle = !running() || !st.lesson;
      el.classList.toggle('fc-idle', idle);
    }
    function maybeAnimateByPosition() {
      const pos = e.pos?.textContent || '0/0';
      if (pos !== lastPos && running()) {
        const [now] = pos.split('/').map(n => parseInt(n, 10) || 0);
        const [old] = lastPos.split('/').map(n => parseInt(n, 10) || 0);
        if (now > old || (old > 1 && now === 1)) fx('fc-next', 430);
        else if (now < old) fx('fc-prev', 430);
      }
      lastPos = pos;
      updateIdle();
    }
    const oldRender = window.render;
    if (typeof oldRender === 'function' && !oldRender.__card3dWrapped) {
      window.render = function card3dRender() {
        oldRender();
        requestAnimationFrame(maybeAnimateByPosition);
      };
      window.render.__card3dWrapped = true;
    }
    const oldFlip = window.flip;
    if (typeof oldFlip === 'function' && !oldFlip.__card3dWrapped) {
      window.flip = function card3dFlip() {
        flipFx();
        setTimeout(() => oldFlip(), 115);
      };
      window.flip.__card3dWrapped = true;
      if (e.flip) e.flip.onclick = window.flip;
      if (e.card) e.card.onclick = window.flip;
    }
    window.addEventListener('click', ev => {
      if (ev.target.closest('#startBtn,#finishRestartBtn,#finishKnownBtn,#finishAgainBtn')) {
        setTimeout(() => fx('fc-pop', 430), 20);
        return;
      }
      if (ev.target.closest('#prevBtn')) {
        fx('fc-prev', 430);
        return;
      }
      if (ev.target.closest('#knownBtn,#againBtn')) {
        fx('fc-next', 430);
        return;
      }
      if (ev.target.closest('#flipBtn')) {
        flipFx();
        return;
      }
      if (ev.target.closest('#card')) {
        if (!running()) fx(st.lesson ? 'fc-pop' : 'fc-tap', st.lesson ? 430 : 260);
        else flipFx();
      }
    }, true);
    document.addEventListener('click', ev => {
      if (ev.target.closest('.lesson-btn')) setTimeout(() => fx('fc-pop', 430), 180);
    }, true);
    updateIdle();
    try { if (typeof log === 'function') log('3D card motion loaded.'); } catch (_) {}
  } catch (error) {
    try { console.warn('[card-3d disabled]', error); } catch (_) {}
  }
})();
