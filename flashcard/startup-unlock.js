// Clear focus/loading overlays that Safari may restore from bfcache without their timers/state.
(() => {
  try {
    const body = document.body;
    if (!body) return;

    function hasLiveAutoSession() {
      const autoInput = document.querySelector('#autoInput');
      return !!(autoInput?.checked && window.st?.session?.length && !window.st?.done);
    }

    function clearOrphanedOverlays({ restoreAuto = false } = {}) {
      // These temporary states can never survive a real page restore safely.
      body.classList.remove(
        'auto-lesson-switching',
        'force-card-focus',
        'card-switching',
        'sheet-loading-open'
      );

      document.querySelector('#sheetLoadOverlay')?.classList.add('hidden');
      window.cancelSmoothCardTransition?.();

      if (!hasLiveAutoSession()) {
        body.classList.remove('auto-card-focus');
      } else if (restoreAuto) {
        window.flashcardAutoStudy?.resume?.();
      }
    }

    clearOrphanedOverlays();
    requestAnimationFrame(() => clearOrphanedOverlays());
    setTimeout(() => clearOrphanedOverlays(), 80);
    setTimeout(() => clearOrphanedOverlays(), 350);

    window.addEventListener('pageshow', event => {
      clearOrphanedOverlays({ restoreAuto: !!event.persisted });
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && body.classList.contains('auto-lesson-switching')) {
        clearOrphanedOverlays({ restoreAuto: true });
      }
    });

    window.unlockFlashcardUi = clearOrphanedOverlays;
  } catch (error) {
    try { console.warn('[startup-unlock disabled]', error); } catch (_) {}
  }
})();
