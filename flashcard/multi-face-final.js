// Final multi-face renderer: wins over legacy two-face polish callbacks.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    function paint() {
      const card = st.session?.[st.i];
      const faces = card?.faces;
      if (!faces?.length) return;
      st.multiFaceMode = true;
      st.face = Math.max(0, Math.min(st.face, faces.length - 1));
      const face = faces[st.face];
      const long = face.text.length > 90 || face.text.split('\n').length > 3;
      e.card?.classList.add('fc-multiface');
      e.card?.classList.toggle('fc-long-face', long);
      e.card?.classList.remove('fc-meaning-side', 'fc-word-side');
      if (long) {
        e.front.textContent = face.label || `Mặt ${st.face + 1}`;
        e.sub.textContent = face.text;
      } else {
        e.front.textContent = face.text;
        e.sub.textContent = face.label || '';
      }
      if (e.hint) e.hint.textContent = `Mặt ${st.face + 1}/${faces.length} · ${face.label || 'Nội dung'}`;
      const meta = $('#cardMeta');
      if (meta) {
        meta.style.display = 'inline-flex';
        meta.textContent = `Mặt ${st.face + 1}/${faces.length} · ${card.sourceSheet || st.lesson?.courseTitle || ''}`;
      }
    }
    function paintSoon() {
      requestAnimationFrame(paint);
      setTimeout(paint, 100);
    }
    const oldRender = window.render;
    if (typeof oldRender === 'function' && !oldRender.__multiFaceFinalWrapped) {
      window.render = function multiFaceFinalRender() {
        oldRender();
        paint();
        setTimeout(paint, 100);
      };
      window.render.__multiFaceFinalWrapped = true;
    }
    const legacyFlip = window.flip;
    window.flip = function finalMultiFaceFlip() {
      const card = st.session?.[st.i];
      if (!card?.faces?.length) return legacyFlip?.();
      st.face = (st.face + 1) % card.faces.length;
      render();
    };
    if (e.flip) e.flip.onclick = window.flip;
    if (e.card) e.card.onclick = window.flip;
    document.addEventListener('click', event => {
      if (event.target.closest('#card,#flipBtn,#knownBtn,#againBtn,#prevBtn,#startBtn,#posText,#knownText,#againText,#reviewBtn,.lesson-btn')) paintSoon();
    }, true);
    window.paintCurrentMultiFace = paint;
  } catch (error) {
    try { console.warn('[multi-face-final disabled]', error); } catch (_) {}
  }
})();
