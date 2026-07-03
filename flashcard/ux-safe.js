// Safe UX layer. No MutationObserver, no setInterval.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    const later = fn => requestAnimationFrame(() => { try { fn(); } catch (_) {} });
    function cardKind() {
      const t = ((st.lesson?.id || '') + ' ' + (st.lesson?.title || '') + ' ' + (st.lesson?.courseTitle || '')).toLowerCase();
      if (t.includes('grammar') || t.includes('ngữ pháp')) return 'ngữ pháp';
      if (t.includes('kanji')) return 'kanji';
      return 'từ vựng';
    }
    function setStudyMode(on) {
      document.body.classList.toggle('is-studying', !!on);
      later(alignFab);
    }
    function renameShuffle() {
      const input = $('#shuffleInput');
      const label = input?.closest('label');
      if (!input || !label) return;
      if (label.textContent.trim() === 'Ngẫu nhiên') return;
      label.innerHTML = '';
      label.append(input, document.createTextNode(' Ngẫu nhiên'));
    }
    function polishStats() {
      if (e.known) e.known.textContent = e.known.textContent.replace(/^Biết:/, 'Đã nhớ:');
    }
    function polishHint() {
      if (!e.hint) return;
      const kind = cardKind();
      if (!st.session?.length) {
        e.hint.innerHTML = 'Bấm thẻ để lật.';
        return;
      }
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
      const meta = $('#cardMeta');
      let top = Math.round(window.innerHeight * 0.46);
      if (meta && meta.offsetParent !== null && meta.textContent.trim()) {
        const r = meta.getBoundingClientRect();
        top = Math.round(r.top + r.height / 2);
      }
      top = Math.max(96, Math.min(window.innerHeight - 150, top));
      document.documentElement.style.setProperty('--fab-top', top + 'px');
    }
    function polishModal() {
      const title = $('#finishTitle');
      const text = $('#finishText');
      if (title) title.textContent = '🎉 Chúc mừng bạn!';
      if (text) {
        const total = st.session?.length || 0;
        text.innerHTML = `Bạn đã học xong <strong>${total}</strong> thẻ.<div class="finish-stat"><span>Đã nhớ: ${st.known.size}</span><span>Chưa nhớ: ${st.again.size}</span></div>`;
      }
      const knownBtn = $('#finishKnownBtn');
      if (knownBtn) knownBtn.textContent = 'Học thẻ đã nhớ';
    }
    function afterRender() {
      renameShuffle();
      polishStats();
      polishHint();
      ensureMenuClose();
      alignFab();
      if ($('#finishModal')?.classList.contains('on')) {
        setStudyMode(false);
        polishModal();
      }
      if (st.done) setStudyMode(false);
    }
    function runLater() {
      later(afterRender);
      setTimeout(afterRender, 80);
      setTimeout(afterRender, 180);
    }
    const oldRender = window.render;
    if (typeof oldRender === 'function' && !oldRender.__uxSafeWrapped) {
      window.render = function uxSafeRender() {
        oldRender();
        runLater();
      };
      window.render.__uxSafeWrapped = true;
    }
    const oldStart = window.start;
    if (typeof oldStart === 'function' && !oldStart.__uxSafeWrapped) {
      window.start = function uxSafeStart() {
        setStudyMode(true);
        oldStart();
        runLater();
      };
      window.start.__uxSafeWrapped = true;
      if (e.start) e.start.onclick = window.start;
    }
    const oldNext = window.next;
    if (typeof oldNext === 'function' && !oldNext.__uxSafeWrapped) {
      window.next = function uxSafeNext() { oldNext(); runLater(); };
      window.next.__uxSafeWrapped = true;
      if (e.next) e.next.onclick = window.next;
    }
    const oldMark = window.mark;
    if (typeof oldMark === 'function' && !oldMark.__uxSafeWrapped) {
      window.mark = function uxSafeMark(type) { oldMark(type); runLater(); };
      window.mark.__uxSafeWrapped = true;
      if (e.ok) e.ok.onclick = () => window.mark('known');
      if (e.bad) e.bad.onclick = () => window.mark('again');
    }
    document.addEventListener('click', ev => {
      if (ev.target.closest('#startBtn,#finishRestartBtn,#finishKnownBtn,#finishAgainBtn')) setStudyMode(true);
      if (ev.target.closest('#finishCloseBtn')) setStudyMode(false);
      if (ev.target.closest('button,.card,.stats span')) runLater();
    }, true);
    window.addEventListener('resize', () => later(alignFab), {passive:true});
    window.addEventListener('scroll', () => later(alignFab), {passive:true});
    runLater();
    try { if (typeof log === 'function') log('UX safe v2 loaded.'); } catch (_) {}
  } catch (error) {
    try { console.warn('[ux-safe disabled]', error); } catch (_) {}
  }
})();
