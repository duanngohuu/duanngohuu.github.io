(() => {
  function simplifyLibrary() {
    const panel = document.querySelector('aside.panel.glass');
    const list = document.querySelector('#lessonList');
    if (!panel || !list) return setTimeout(simplifyLibrary, 120);

    if (!panel.querySelector('.library-tabs')) {
      const tabs = document.createElement('div');
      tabs.className = 'library-tabs';
      tabs.innerHTML = '<button class="library-tab active" type="button">Từ vựng</button><button class="library-tab soon" type="button">Ngữ pháp</button><button class="library-tab soon" type="button">Kanji</button>';
      panel.querySelector('.library-type')?.after(tabs);
      tabs.querySelectorAll('.soon').forEach(btn => btn.onclick = () => alert('Phần này để thêm tài nguyên sau.'));
    }

    if (!panel.querySelector('.library-summary')) {
      const summary = document.createElement('div');
      summary.className = 'library-summary';
      summary.innerHTML = '<strong>400 từ vựng N2 - Trường văn</strong>8 bài, mỗi bài 50 từ. Chọn bài rồi học theo từng block 10 từ.';
      panel.querySelector('.library-tabs')?.after(summary);
    }

    list.querySelectorAll('.lesson-btn').forEach(btn => {
      const strong = btn.querySelector('strong');
      const span = btn.querySelector('span');
      const title = strong?.textContent || '';
      const m = title.match(/Bài\s+(\d+)\s+·\s+STT\s+(\d+)-(.+)/);
      if (m) {
        strong.textContent = `Bài ${m[1]} · STT ${m[2]}-${m[3]}`;
        if (span) span.textContent = '50 từ';
      }
    });
  }

  const mo = new MutationObserver(simplifyLibrary);
  document.addEventListener('DOMContentLoaded', () => {
    simplifyLibrary();
    const list = document.querySelector('#lessonList');
    if (list) mo.observe(list, { childList: true, subtree: true });
  });
  if (document.readyState !== 'loading') simplifyLibrary();
})();
