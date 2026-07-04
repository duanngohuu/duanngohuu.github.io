// Add dynamic faces for local TSV lessons that contain extra study columns.
(() => {
  try {
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
