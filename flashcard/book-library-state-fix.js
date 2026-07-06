// Keep the textbook tree visible when reopening the lesson drawer in the same page session.
(() => {
  try {
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