// Continue a limited study range in sequential batches without resetting the range start.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = selector => document.querySelector(selector);
    let initialized = false;

    function normalizeBounds() {
      let from = Math.max(1, Number(e.from?.value) || 1);
      let to = Math.min(st.cards?.length || Number.MAX_SAFE_INTEGER, Number(e.to?.value) || st.cards?.length || from);
      if (from > to) [from, to] = [to, from];
      return { from, to };
    }

    function selectedLimit() {
      if (e.limit?.value === 'all') return null;
      const value = Number(e.limit?.value);
      return Number.isFinite(value) && value > 0 ? value : null;
    }

    function captureBatch() {
      if (!st.session?.length) return null;
      const { from, to } = normalizeBounds();
      const limit = selectedLimit();
      const snapshot = {
        from,
        to,
        limit,
        size: st.session.length,
        lessonId: st.lesson?.id || '',
        cardIds: st.session.map(card => card.id),
        capturedAt: Date.now()
      };
      st.batchProgress = snapshot;
      return snapshot;
    }

    function currentBatch() {
      const saved = st.batchProgress;
      if (saved && saved.lessonId === (st.lesson?.id || '') && saved.size === (st.session?.length || 0)) return saved;
      return captureBatch();
    }

    function batchInfo() {
      if (!st.session?.length) return { hasMore: false };
      if (st.reviewMode === 'known' || st.reviewMode === 'again') return { hasMore: false };
      const batch = currentBatch();
      if (!batch?.limit) return { hasMore: false, batch };
      const nextFrom = batch.from + batch.size;
      const hasMore = nextFrom <= batch.to;
      const nextTo = hasMore ? Math.min(batch.to, nextFrom + batch.limit - 1) : batch.to;
      return { hasMore, batch, nextFrom, nextTo };
    }

    function ensureContinueButton() {
      const actions = $('#finishModal .finish-actions');
      if (!actions) return null;
      let button = $('#finishContinueBtn');
      if (!button) {
        button = document.createElement('button');
        button.id = 'finishContinueBtn';
        button.className = 'primary hidden';
        button.type = 'button';
        const knownButton = $('#finishKnownBtn');
        if (knownButton) actions.insertBefore(button, knownButton);
        else actions.prepend(button);
        button.onclick = continueBatch;
      }
      return button;
    }

    function refreshModal() {
      const continueButton = ensureContinueButton();
      const restartButton = $('#finishRestartBtn');
      if (!continueButton) return;

      const info = batchInfo();
      continueButton.classList.toggle('hidden', !info.hasMore);
      continueButton.disabled = !info.hasMore;
      if (info.hasMore) continueButton.textContent = `Học tiếp · ${info.nextFrom}–${info.nextTo}`;

      if (restartButton && st.session?.length) {
        restartButton.textContent = `Học lại ${st.session.length} thẻ này`;
      }
    }

    function continueBatch() {
      const info = batchInfo();
      if (!info.hasMore) return;

      e.from.value = String(info.nextFrom);
      e.to.value = String(info.batch.to);
      st.reviewMode = null;
      st.batchProgress = null;
      $('#finishModal')?.classList.remove('on');

      try { window.saveLast?.(); } catch (_) {}
      window.start?.();
      captureBatch();
      try { window.flashcardLibraryTools?.save?.(); } catch (_) {}
      setTimeout(() => window.flashcardAutoStudy?.resume?.(), 0);
    }

    function wrapStart() {
      const originalStart = window.start;
      if (typeof originalStart !== 'function' || originalStart.__batchProgressWrapped) return;
      window.start = function batchProgressStart(...args) {
        st.batchProgress = null;
        const result = originalStart.apply(this, args);
        captureBatch();
        return result;
      };
      window.start.__batchProgressWrapped = true;
      if (e.start) e.start.onclick = window.start;
    }

    function observeModal() {
      const modal = $('#finishModal');
      if (!modal || modal.__batchProgressObserved) return false;
      modal.__batchProgressObserved = true;
      new MutationObserver(() => {
        if (modal.classList.contains('on')) refreshModal();
      }).observe(modal, { attributes: true, attributeFilter: ['class'] });
      return true;
    }

    function init() {
      if (initialized) return;
      if (!$('#finishModal')) {
        setTimeout(init, 80);
        return;
      }
      initialized = true;
      wrapStart();
      ensureContinueButton();
      observeModal();
      document.addEventListener('click', event => {
        if (event.target.closest('#finishRestartBtn')) setTimeout(captureBatch, 0);
      }, true);
      window.refreshFlashcardBatchProgress = refreshModal;
    }

    init();
  } catch (error) {
    try { console.warn('[batch-progress disabled]', error); } catch (_) {}
  }
})();
