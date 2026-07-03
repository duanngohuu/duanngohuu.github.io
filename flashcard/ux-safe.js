// Safe UX layer. No MutationObserver, no setInterval.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    const schedule = fn => requestAnimationFrame(() => { try { fn(); } catch (_) {} });
    function cardKind() {
      const t = ((st.lesson?.id || '') + ' ' + (st.lesson?.title || '') + ' ' + (st.lesson?.courseTitle || '')).toLowerCase();
      if (t.includes('grammar') || t.includes('ngữ pháp')) return 'ngữ pháp';
      if (t.includes('kanji')) return 'kanji';
      return 'từ vựng';
    }
    function setStudyMode(on) {
      document.body.classList.toggle('is-studying', !!on);
      schedule(alignFab);
    }
    function renameShuffle() {
      const label = $('#shuffleInput')?.closest('label');
      if (!label || label.dataset.uxRenamed === '1') return;
      label.dataset.uxRenamed = '1';
      const input = $('#shuffleInput');
      label.textContent = ' Ngẫu nhiên';
      label.prepend(input);
    }
    function polishStats() {
      if (e.known) e.known.textContent = e.known.textContent.replace(/^Biết:/, 'Đã nhớ:');
    }
    function polishHint() {
      if (!st.session?.length || !e.hint) return;
      const kind = cardKind();
      if (st.face === 0) e.hint.innerHTML = `<strong>Mặt 1/2:</strong> ${kind}.`;
      else if (kind === 'ngữ pháp') e.hint.innerHTML = '<strong>Mặt 2/2:</strong> nghĩa + cách dùng.';
      else if (kind === 'kanji') e.hint.innerHTML = '<strong>Mặt 2/2:</strong> cách đọc + nghĩa.';
      else e.hint.innerHTML = '<strong>Mặt 2/2:</strong> nghĩa + cách đọc + Hán Việt.';
    }
    function ensureMenuClose() {
      const panel = $('.library-panel');
      if (!panel || panel.querySelector('.library-close')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'library-close';
      btn.textContent = '× Đóng';
      btn.onclick = () => document.body.classList.remove('library-open');
      panel.prepend(btn);
    }
    function alignFab() {
      const fab = $('.library-fab');
      if (!fab) return;
      const meta = $('#cardMeta');
      let top = Math.round(window.innerHeight * 0.46);
      if (meta && meta.offsetParent !== null && meta.textContent.trim()) {
        const r = meta.getBoundingClientRect();
        top = Math.round(r.top + r.height / 2);
      }
      const min = document.body.classList.contains('is-studying') ? 90 : 116;
      const max = window.innerHeight - 168;
      top = Math.max(min, Math.min(max, top));
      document.documentElement.style.setProperty('--fab-top', top + 'px');
    }
    function polishModal() {
      const modal = $('#finishModal');
      if (!modal) return;
      const title = $('#finishTitle');
      const text = $('#finishText');
      if (title) title.textContent = '🎉 Chúc mừng bạn!';
      if (text) {
        const total = st.session?.length || 0;
        text.innerHTML = `Bạn đã học xong <strong>${total}</strong> thẻ.<div class="finish-stat"><span>Đã nhớ: ${st.known.size}</span><span>Chưa nhớ: ${st.again.size}</span></div>`;
      }
    }
    function afterRender() {
      renameShuffle();
      polishStats();
      polishHint();
      ensureMenuClose();
      polishModal();
      alignFab();
      if (st.done) setStudyMode(false);
    }
    const oldRender = window.render;
    if (typeof oldRender === 'function' && !oldRender.__uxSafeWrapped) {
      window.render = function uxSafeRender() {
        oldRender();
        schedule(afterRender);
      };
      window.render.__uxSafeWrapped = true;
    }
    const oldStart = window.start;
    if (typeof oldStart === 'function' && !oldStart.__uxSafeWrapped) {
      window.start = function uxSafeStart() {
        setStudyMode(true);
        oldStart();
        schedule(afterRender);
      };
      window.start.__uxSafeWrapped = true;
      if (e.start) e.start.onclick = window.start;
    }
    document.addEventListener('click', ev => {
      if (ev.target.closest('#startBtn,#finishRestartBtn,#finishKnownBtn,#finishAgainBtn')) setStudyMode(true);
      if (ev.target.closest('#finishCloseBtn')) setStudyMode(false);
      if (ev.target.closest('#knownBtn,#againBtn,#nextBtn,#prevBtn,#flipBtn,.stats span')) {
        requestAnimationFrame(() => requestAnimationFrame(afterRender));
        setTimeout(() => { if (st.done) { setStudyMode(false); polishModal(); } }, 120);
      }
    }, true);
    window.addEventListener('resize', () => schedule(alignFab), {passive:true});
    window.addEventListener('scroll', () => schedule(alignFab), {passive:true});
    afterRender();
    try { if (typeof log === 'function') log('UX safe loaded.'); } catch (_) {}
  } catch (error) {
    try { console.warn('[ux-safe disabled]', error); } catch (_) {}
  }
})();
