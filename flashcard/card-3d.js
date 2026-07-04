// 3D card motion controller. Animate from rendered state only to avoid duplicate click + render effects.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    const FX = ['fc-pop','fc-flip','fc-next','fc-prev','fc-tap','fc-pulse'];
    let lastPos = e.pos?.textContent || '0/0';
    let lastFace = Number(st.face || 0);
    let motionTimer = 0;
    let clearTimer = 0;

    function card() { return $('#card'); }
    function running() { return !!(st.session && st.session.length && !st.done); }
    function clear(el) { if (el) el.classList.remove('fc-animating', ...FX); }

    function play(name, ms = 520) {
      const el = card();
      if (!el) return;
      clearTimeout(motionTimer);
      clearTimeout(clearTimer);
      clear(el);
      requestAnimationFrame(() => {
        clear(el);
        void el.offsetWidth;
        el.classList.add('fc-animating', name);
        clearTimer = setTimeout(() => {
          el.classList.remove(name, 'fc-animating');
          idle();
        }, ms);
      });
    }

    function schedule(name, ms = 520) {
      clearTimeout(motionTimer);
      motionTimer = setTimeout(() => play(name, ms), 35);
    }

    function idle() {
      const el = card();
      if (!el) return;
      el.classList.toggle('fc-idle', !running() || !st.lesson);
    }

    function syncMotion() {
      const pos = e.pos?.textContent || '0/0';
      const face = Number(st.face || 0);
      const posChanged = pos !== lastPos;
      const faceChanged = face !== lastFace;

      if (running()) {
        if (posChanged) {
          const now = parseInt(pos, 10) || 0;
          const old = parseInt(lastPos, 10) || 0;
          if (old === 0) schedule('fc-pop', 460);
          else if (now > old || (old > 1 && now === 1)) schedule('fc-next', 520);
          else if (now < old) schedule('fc-prev', 520);
        } else if (faceChanged) {
          schedule('fc-flip', 520);
        }
      }

      lastPos = pos;
      lastFace = face;
      idle();
    }

    const oldRender = window.render;
    if (typeof oldRender === 'function' && !oldRender.__card3dStateWrapped) {
      window.render = function card3dStateRender() {
        oldRender();
        requestAnimationFrame(syncMotion);
      };
      window.render.__card3dStateWrapped = true;
    }

    // Non-state taps only. Card flips and navigation are animated by syncMotion after render.
    window.addEventListener('click', ev => {
      if (ev.target.closest('#resetBtn')) schedule('fc-tap', 170);
    }, true);

    document.addEventListener('click', ev => {
      if (ev.target.closest('.lesson-btn')) setTimeout(() => play('fc-pop', 460), 180);
    }, true);

    idle();
    try { if (typeof log === 'function') log('3D card state motion loaded.'); } catch (_) {}
  } catch (error) {
    try { console.warn('[card-3d disabled]', error); } catch (_) {}
  }
})();
