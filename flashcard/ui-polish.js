// UI polish: study mode, text labels, floating button alignment, fullscreen menu close, finish modal copy.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    const typeLabel = () => {
      const t = ((st.lesson?.id || '') + ' ' + (st.lesson?.title || '') + ' ' + (st.lesson?.courseTitle || '')).toLowerCase();
      if (t.includes('grammar') || t.includes('ngữ pháp')) return 'ngữ pháp';
      if (t.includes('kanji')) return 'kanji';
      return 'từ vựng';
    };
    function setStudyMode(on) {
      document.body.classList.toggle('is-studying', !!on);
      setTimeout(alignFab, 40);
    }
    function polishHint() {
      const c = st.session?.[st.i];
      if (!c || !e.hint) return;
      const kind = typeLabel();
      if (st.face === 0) e.hint.innerHTML = `<strong>Mặt 1/2:</strong> ${kind}.`;
      else if (kind === 'ngữ pháp') e.hint.innerHTML = '<strong>Mặt 2/2:</strong> nghĩa + cách dùng.';
      else if (kind === 'kanji') e.hint.innerHTML = '<strong>Mặt 2/2:</strong> cách đọc + nghĩa.';
      else e.hint.innerHTML = '<strong>Mặt 2/2:</strong> nghĩa + cách đọc + Hán Việt.';
    }
    function polishStats() {
      if (e.known) e.known.textContent = e.known.textContent.replace(/^Biết:/, 'Đã nhớ:');
    }
    function polishToggles() {
      const input = $('#shuffleInput');
      const label = input?.closest('label');
      if (!label || label.dataset.renamed === '1') return;
      label.dataset.renamed = '1';
      label.lastChild.textContent = ' Ngẫu nhiên';
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
      const min = document.body.classList.contains('is-studying') ? 92 : 118;
      const max = window.innerHeight - 168;
      top = Math.max(min, Math.min(max, top));
      document.documentElement.style.setProperty('--fab-top', top + 'px');
    }
    function ensureMenuClose() {
      const panel = $('.library-panel');
      if (!panel || panel.querySelector('.library-close')) return;
      const btn = document.createElement('button');
      btn.className = 'library-close';
      btn.type = 'button';
      btn.textContent = '× Đóng';
      btn.onclick = () => document.body.classList.remove('library-open');
      panel.prepend(btn);
    }
    function polishFinishModal() {
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
    function run() {
      polishHint();
      polishStats();
      polishToggles();
      alignFab();
      ensureMenuClose();
      polishFinishModal();
    }
    const oldStart = window.start;
    if (typeof oldStart === 'function' && !oldStart.__studyModeWrapped) {
      window.start = function studyModeStart() {
        setStudyMode(true);
        oldStart();
        run();
      };
      window.start.__studyModeWrapped = true;
      if (e.start) e.start.onclick = window.start;
    }
    const oldFinish = window.finishSession;
    if (typeof oldFinish === 'function' && !oldFinish.__studyModeWrapped) {
      window.finishSession = function studyModeFinish() {
        setStudyMode(false);
        oldFinish();
        setTimeout(run, 100);
      };
      window.finishSession.__studyModeWrapped = true;
    }
    const oldRender = window.render;
    if (typeof oldRender === 'function' && !oldRender.__uiPolishWrapped) {
      window.render = function uiPolishRender() {
        oldRender();
        if (st.done) setStudyMode(false);
        setTimeout(run, 0);
      };
      window.render.__uiPolishWrapped = true;
    }
    document.addEventListener('click', ev => {
      if (ev.target.closest('#finishRestartBtn')) setTimeout(() => setStudyMode(true), 0);
      if (ev.target.closest('#finishKnownBtn,#finishAgainBtn')) setTimeout(() => setStudyMode(true), 0);
      if (ev.target.closest('#finishCloseBtn')) setTimeout(() => setStudyMode(false), 0);
    }, true);
    const mo = new MutationObserver(run);
    mo.observe(document.body, {subtree:true, childList:true, attributes:true, attributeFilter:['class']});
    window.addEventListener('resize', alignFab, {passive:true});
    window.addEventListener('scroll', alignFab, {passive:true});
    setInterval(alignFab, 800);
    run();
    try { if (typeof log === 'function') log('UI polish loaded.'); } catch (_) {}
  } catch (error) {
    try { console.warn('[ui polish disabled]', error); } catch (_) {}
  }
})();
