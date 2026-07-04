// Final multi-face renderer: wins over legacy two-face polish callbacks without flicker.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    let painting = false;

    function currentFaceData() {
      const card = st.session?.[st.i];
      const faces = card?.faces;
      if (!faces?.length) return null;
      st.multiFaceMode = true;
      st.face = Math.max(0, Math.min(st.face, faces.length - 1));
      return { card, faces, face: faces[st.face] };
    }

    function paint() {
      const data = currentFaceData();
      if (!data || painting) return;
      painting = true;
      try {
        const { card, faces, face } = data;
        const long = face.text.length > 90 || face.text.split('\n').length > 3;
        e.card?.classList.add('fc-multiface');
        e.card?.classList.toggle('fc-long-face', long);
        e.card?.classList.remove('fc-meaning-side', 'fc-word-side');

        const expectedFront = long ? (face.label || `Mặt ${st.face + 1}`) : face.text;
        const expectedSub = long ? face.text : (face.label || '');
        const expectedHint = `Mặt ${st.face + 1}/${faces.length} · ${face.label || 'Nội dung'}`;
        const shownCourse = st.lesson?.courseTitle || String(card.sourceSheet || '').replace(/^OK@(TV|NP|BUN)\s*/i, '');
        const expectedMeta = `Mặt ${st.face + 1}/${faces.length} · ${shownCourse}`;

        if (e.front?.textContent !== expectedFront) e.front.textContent = expectedFront;
        if (e.sub?.textContent !== expectedSub) e.sub.textContent = expectedSub;
        if (e.hint?.textContent !== expectedHint) e.hint.textContent = expectedHint;

        const meta = $('#cardMeta');
        if (meta) {
          if (meta.style.display !== 'inline-flex') meta.style.display = 'inline-flex';
          if (meta.textContent !== expectedMeta) meta.textContent = expectedMeta;
        }
      } finally {
        painting = false;
      }
    }

    function paintSoon() {
      queueMicrotask(paint);
      requestAnimationFrame(paint);
      setTimeout(paint, 100);
    }

    const oldRender = window.render;
    if (typeof oldRender === 'function' && !oldRender.__multiFaceFinalWrapped) {
      window.render = function multiFaceFinalRender() {
        oldRender();
        paint();
        queueMicrotask(paint);
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

    // Legacy two-face modules may repaint in requestAnimationFrame/setTimeout.
    // Restore the current dynamic face in the same microtask, before the browser paints.
    const observed = [e.front, e.sub, e.hint, $('#cardMeta')].filter(Boolean);
    if (observed.length) {
      const observer = new MutationObserver(() => {
        if (!painting && currentFaceData()) queueMicrotask(paint);
      });
      observed.forEach(node => observer.observe(node, { childList: true, characterData: true, subtree: true, attributes: node.id === 'cardMeta', attributeFilter: node.id === 'cardMeta' ? ['style'] : undefined }));
    }

    window.paintCurrentMultiFace = paint;
  } catch (error) {
    try { console.warn('[multi-face-final disabled]', error); } catch (_) {}
  }
})();
