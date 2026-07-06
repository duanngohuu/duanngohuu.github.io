// Keep the textbook tree visible and expand compact textbook JSON into flashcards.
(() => {
  try {
    const originalJson = Response.prototype.json;
    if (!originalJson.__bookCompactWrapped) {
      const wrappedJson = async function bookCompactJson() {
        const data = await originalJson.call(this);
        if (!this.url.includes('/data/books/soumatome-n2-kanji-week-') || !Array.isArray(data?.lessons)) return data;
        data.lessons.forEach(lesson => {
          lesson.cards = (lesson.cards || []).map((raw, index) => {
            if (!Array.isArray(raw)) return raw;
            const [front = '', reading = '', vocabulary = '', meaning = ''] = raw;
            const faces = [
              front && { label: 'Kanji', text: front },
              reading && { label: 'Cách đọc', text: reading },
              vocabulary && { label: 'Từ vựng', text: vocabulary },
              meaning && { label: 'Nghĩa', text: meaning }
            ].filter(Boolean);
            return {
              id: `${lesson.id}-${String(index + 1).padStart(3, '0')}`,
              no: index + 1,
              front,
              reading,
              vocabulary,
              meaning_en: meaning,
              meaning_vi: '',
              faces
            };
          });
        });
        return data;
      };
      wrappedJson.__bookCompactWrapped = true;
      Response.prototype.json = wrappedJson;
    }

    let wasOpen = document.body.classList.contains('library-open');
    let repaintTimer = 0;

    function repaintBooks() {
      const books = window.flashcardBookLibrary;
      if (!books?.state?.active || typeof books.show !== 'function') return;
      clearTimeout(repaintTimer);
      repaintTimer = setTimeout(() => {
        books.show().catch(error => {
          try { window.err?.(error); } catch (_) {}
        });
      }, 0);
    }

    new MutationObserver(() => {
      const open = document.body.classList.contains('library-open');
      if (open && !wasOpen) {
        repaintBooks();
        setTimeout(repaintBooks, 120);
      }
      wasOpen = open;
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

    window.addEventListener('pageshow', () => {
      if (document.body.classList.contains('library-open')) repaintBooks();
    });
  } catch (error) {
    try { console.warn('[book-library-state-fix disabled]', error); } catch (_) {}
  }
})();