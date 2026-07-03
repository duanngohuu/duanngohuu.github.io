// 3D card motion controller. Pure class toggles, no observers/intervals.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    const FX = ['fc-pop','fc-flip','fc-next','fc-prev','fc-tap','fc-pulse'];
    let lastPos = '0/0';
    let queued = null;
    function card() { return $('#card'); }
    function running() { return !!(st.session && st.session.length && !st.done); }
    function clear(el) { if (el) el.classList.remove('fc-animating', ...FX); }
    function play(name, ms = 520) {
      const el = card();
      if (!el) return;
      clear(el);
      requestAnimationFrame(() => {
        clear(el);
        void el.offsetWidth;
        el.classList.add('fc-animating', name);
        setTimeout(() => { el.classList.remove(name, 'fc-animating'); idle(); }, ms);
      });
    }
    function afterRender(name, ms = 520) {
      queued = { name, ms };
      setTimeout(() => { const q = queued; queued = null; if (q) play(q.name, q.ms); }, 45);
    }
    function idle() {
      const el = card();
      if (!el) return;
      el.classList.toggle('fc-idle', !running() || !st.lesson);
    }
    function byPos() {
      const pos = e.pos?.textContent || '0/0';
      if (pos !== lastPos && running() && !queued) {
        const now = parseInt(pos, 10) || 0;
        const old = parseInt(lastPos, 10) || 0;
        if (now > old || (old > 1 && now === 1)) afterRender('fc-next', 520);
        else if (now < old) afterRender('fc-prev', 520);
      }
      lastPos = pos;
      idle();
    }
    const oldRender = window.render;
    if (typeof oldRender === 'function' && !oldRender.__card3dWrapped) {
      window.render = function card3dRender() {
        oldRender();
        requestAnimationFrame(byPos);
      };
      window.render.__card3dWrapped = true;
    }
    window.addEventListener('click', ev => {
      if (ev.target.closest('#startBtn,#finishRestartBtn,#finishKnownBtn,#finishAgainBtn')) return afterRender('fc-pop', 460);
      if (ev.target.closest('#prevBtn')) return afterRender('fc-prev', 520);
      if (ev.target.closest('#knownBtn,#againBtn')) return afterRender('fc-next', 520);
      if (ev.target.closest('#flipBtn')) return afterRender('fc-flip', 520);
      if (ev.target.closest('#card')) return afterRender(running() ? 'fc-flip' : (st.lesson ? 'fc-pop' : 'fc-tap'), running() ? 520 : 460);
    }, true);
    document.addEventListener('click', ev => { if (ev.target.closest('.lesson-btn')) setTimeout(() => play('fc-pop', 460), 180); }, true);
    idle();
    try { if (typeof log === 'function') log('3D card motion loaded.'); } catch (_) {}
  } catch (error) {
    try { console.warn('[card-3d disabled]', error); } catch (_) {}
  }
})();
