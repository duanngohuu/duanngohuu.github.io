// Category loader hotfix: load extra lesson manifests without touching core.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    const logSafe = msg => { try { if (typeof log === 'function') log(msg); } catch (_) {} };
    async function loadCategory(manifestPath, label) {
      const text = await getText(manifestPath + '?v=' + Date.now());
      const m = JSON.parse(text);
      st.lessons = (m.courses || []).flatMap(c => (c.lessons || []).map(l => ({...l, courseTitle: c.title})));
      st.lesson = null;
      st.cards = [];
      st.session = [];
      st.i = 0;
      st.face = 0;
      st.done = false;
      st.finishShown = false;
      if (e.list) e.list.style.display = 'grid';
      const empty = $('.empty-tab');
      if (empty) empty.style.display = 'none';
      const summary = $('.library-summary');
      if (summary) summary.textContent = label;
      if (e.meta) e.meta.textContent = 'Đang tải';
      if (typeof renderMenu === 'function') renderMenu();
      if (typeof render === 'function') render();
      logSafe('Loaded category: ' + label + ' · ' + st.lessons.length + ' bài');
    }
    document.addEventListener('click', ev => {
      const btn = ev.target.closest('.library-tab');
      if (!btn) return;
      if (btn.dataset.tab === 'grammar') {
        setTimeout(() => loadCategory('./data/n2-grammar-manifest.json', 'N2 Grammar 130 · batch nhập từ ảnh hôm qua.').catch(err => logSafe('Grammar load error: ' + err.message)), 0);
      }
      if (btn.dataset.tab === 'kanji') {
        const summary = $('.library-summary');
        if (summary) summary.textContent = 'Kanji N2 sẽ nhập theo batch sau khi tách TSV từ ảnh để tránh sai chữ.';
      }
    });
    logSafe('Category loader loaded.');
  } catch (error) {
    try { console.warn('[category loader disabled]', error); } catch (_) {}
  }
})();
