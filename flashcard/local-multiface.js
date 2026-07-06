// Add dynamic faces for local TSV lessons that contain extra study columns.
(() => {
  try {
    if (window.__flashcardLocalMultifaceLoaded) return;
    window.__flashcardLocalMultifaceLoaded = true;

    function loadBookLibrary() {
      const version = '20260706-books3';
      let link = document.querySelector('link[data-book-library-style]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'stylesheet';
        link.dataset.bookLibraryStyle = '1';
        document.head.appendChild(link);
      }
      if (!link.href.includes(version)) link.href = `./book-library.css?v=${version}`;

      const scripts = [
        { src: './book-library-state-fix.js', attr: 'data-book-library-state-fix' },
        { src: './book-library.js', attr: 'data-book-library-script' },
        { src: './book-study-enrichment.js', attr: 'data-book-study-enrichment' }
      ];
      scripts.forEach(({ src, attr }) => {
        let script = document.querySelector(`script[${attr}]`);
        if (script && script.dataset.version !== version) {
          script.remove();
          script = null;
        }
        if (!script) {
          script = document.createElement('script');
          script.async = false;
          script.src = `${src}?v=${version}`;
          script.setAttribute(attr, '1');
          script.dataset.version = version;
          document.body.appendChild(script);
        }
      });
    }

    function loadMenuSessionState() {
      const version = '20260705-menustate1';
      let script = document.querySelector('script[data-menu-session-state]');
      if (script && script.dataset.menuSessionStateVersion !== version) {
        script.remove();
        script = null;
      }
      if (!script) {
        script = document.createElement('script');
        script.src = `./menu-session-state.js?v=${version}`;
        script.dataset.menuSessionState = '1';
        script.dataset.menuSessionStateVersion = version;
        document.body.appendChild(script);
      }
    }

    function parseRows(text) {
      const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) return [];
      const headers = lines.shift().split('\t').map(value => value.trim());
      return lines.map(line => {
        const values = line.split('\t');
        const row = {};
        headers.forEach((header, index) => { row[header] = values[index] || ''; });
        return row;
      });
    }

    function face(label, text) {
      const value = String(text || '').trim();
      return value ? { label, text: value } : null;
    }

    async function applyLocalFaces() {
      const lesson = window.st?.lesson;
      if (!lesson?.path || Number(lesson.faces || 0) < 3 || lesson.source === 'google-sheet') return;
      const separator = lesson.path.includes('?') ? '&' : '?';
      const response = await fetch(`${lesson.path}${separator}faces=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Không tải được dữ liệu nhiều mặt: ${response.status}`);
      const rows = parseRows(await response.text());
      if (!rows.length) return;

      st.cards.forEach((card, index) => {
        const row = rows[index] || {};
        card.usage = row.usage || row.example || row.note || '';
        card.faces = [
          face('Từ vựng', row.front || card.front),
          face('Cách đọc', row.reading || card.reading),
          face('Ý nghĩa', row.meaning_vi || card.meaning_vi),
          face('Cụm từ đi kèm', card.usage)
        ].filter(Boolean);
      });
      st.multiFaceMode = st.cards.some(card => card.faces?.length > 2);
      st.face = 0;
      window.render?.();
      window.paintCurrentMultiFace?.();
    }

    function install() {
      if (!window.st || !window.flashcardLibraryTools || typeof window.selectLesson !== 'function') return false;
      const baseSelectLesson = window.selectLesson;
      if (baseSelectLesson.__localMultifaceWrapped) return true;

      window.selectLesson = async function localMultifaceSelectLesson(id) {
        const result = await baseSelectLesson(id);
        try {
          await applyLocalFaces();
        } catch (error) {
          try { window.err?.(error); } catch (_) {}
        }
        return result;
      };
      window.selectLesson.__localMultifaceWrapped = true;
      window.selectLesson.__localMultifaceBase = baseSelectLesson;
      return true;
    }

    loadBookLibrary();
    loadMenuSessionState();
    if (!install()) {
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        if (install() || attempts > 400) clearInterval(timer);
      }, 25);
    }
  } catch (error) {
    try { console.warn('[local-multiface disabled]', error); } catch (_) {}
  }
})();