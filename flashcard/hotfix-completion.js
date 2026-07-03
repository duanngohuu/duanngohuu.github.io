// Hotfix: finish dialog and safe end-of-session behavior. Does not replace core.
(() => {
  try {
    if (!window.st || !window.e) return;
    const logSafe = msg => { try { if (typeof log === 'function') log(msg); } catch (_) {} };
    function paintComplete() {
      st.done = true;
      st.i = Math.max(0, (st.session?.length || 1) - 1);
      st.face = 0;
      if (e.title) e.title.textContent = 'Hoàn thành phiên học';
      if (e.front) e.front.textContent = 'Hoàn thành';
      if (e.sub) e.sub.textContent = 'Đã học xong ' + (st.session?.length || 0) + ' thẻ.\nBiết: ' + st.known.size + ' · Chưa nhớ: ' + st.again.size;
      if (e.hint) e.hint.textContent = 'Bấm Ôn thẻ chưa nhớ hoặc Bắt đầu học để học lại.';
      const meta = document.querySelector('#cardMeta');
      if (meta) meta.textContent = st.lesson?.title || '';
      if (e.actions) e.actions.classList.add('hidden');
      if (e.pos) e.pos.textContent = (st.session?.length || 0) + '/' + (st.session?.length || 0);
      if (e.bar) e.bar.style.width = '100%';
      logSafe('Hoàn thành phiên học ' + (st.session?.length || 0) + ' thẻ.');
      if (!st.finishShown) {
        st.finishShown = true;
        setTimeout(() => alert('Chúc mừng! Bạn đã học xong phiên này.'), 80);
      }
    }
    function finishOrNext() {
      if (!st.session?.length) return;
      if (st.done) return;
      if (st.i >= st.session.length - 1) paintComplete();
      else {
        st.i += 1;
        st.face = 0;
        if (typeof render === 'function') render();
      }
    }
    function markAndMove(type) {
      if (!st.session?.length || st.done) return;
      const c = st.session[st.i];
      if (!c) return;
      if (type === 'known') {
        st.known.add(c.id);
        st.again.delete(c.id);
      } else {
        st.again.add(c.id);
        st.known.delete(c.id);
      }
      try { if (typeof saveProgress === 'function') saveProgress(); } catch (_) {}
      finishOrNext();
    }
    const oldStart = window.start;
    window.start = function patchedStart() {
      st.done = false;
      st.finishShown = false;
      if (typeof oldStart === 'function') oldStart();
    };
    window.finishSession = paintComplete;
    window.next = finishOrNext;
    window.mark = markAndMove;
    if (e.start) e.start.onclick = window.start;
    if (e.next) e.next.onclick = finishOrNext;
    if (e.ok) e.ok.onclick = () => markAndMove('known');
    if (e.bad) e.bad.onclick = () => markAndMove('again');
    if (e.prev) e.prev.onclick = () => {
      if (st.done) {
        st.done = false;
        st.i = Math.max(0, (st.session?.length || 1) - 1);
        st.face = 0;
        if (typeof render === 'function') render();
        return;
      }
      if (typeof prev === 'function') prev();
    };
    logSafe('Completion hotfix loaded.');
  } catch (error) {
    try { console.warn('[completion hotfix disabled]', error); } catch (_) {}
  }
})();
