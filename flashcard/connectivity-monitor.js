// Real connectivity monitor: silent background sync + one shared user-facing status bar.
(() => {
  try {
    if (!window.flashcardOffline) return;
    const offline = window.flashcardOffline;
    const PROBE_INTERVAL = 30000;
    const PROBE_TIMEOUT = 4500;
    const SYNC_TIMEOUT = 6500;
    const RECONNECTED_MS = 30000;
    let onlineState = null;
    let probeTimer = 0;
    let reconnectTimer = 0;
    let syncing = false;

    function clone(value) {
      try { return structuredClone(value); }
      catch (_) { return JSON.parse(JSON.stringify(value)); }
    }

    function withTimeout(promise, ms, message) {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
      ]);
    }

    function refreshSharedBanner() {
      try { window.refreshFlashcardStatusBanner?.(); } catch (_) {}
    }

    function setOffline() {
      clearTimeout(reconnectTimer);
      document.body.classList.remove('network-reconnected');
      document.body.classList.add('network-offline');
      refreshSharedBanner();
    }

    function setOnlineSilently() {
      document.body.classList.remove('network-offline');
      refreshSharedBanner();
    }

    function showReconnected() {
      clearTimeout(reconnectTimer);
      document.body.classList.remove('network-offline');
      document.body.classList.add('network-reconnected');
      refreshSharedBanner();
      reconnectTimer = setTimeout(() => {
        document.body.classList.remove('network-reconnected');
        refreshSharedBanner();
      }, RECONNECTED_MS);
    }

    async function probeInternet() {
      if (navigator.onLine === false) return false;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT);
      try {
        const response = await fetch(`./index.html?__network_probe=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
          headers: { 'Cache-Control': 'no-cache' }
        });
        return response.ok;
      } catch (_) {
        return false;
      } finally {
        clearTimeout(timeout);
      }
    }

    function stableCards(cards) {
      return (cards || []).map(card => ({
        id: card.id,
        no: card.no,
        sourceRow: card.sourceRow,
        faces: (card.faces || []).map(face => ({ label: face.label || '', text: face.text || '' }))
      }));
    }

    async function hashCards(cards) {
      const text = JSON.stringify(stableCards(cards));
      if (crypto?.subtle && window.TextEncoder) {
        const bytes = new TextEncoder().encode(text);
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
      }
      let hash = 2166136261;
      for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(16).padStart(8, '0');
    }

    async function syncManifest() {
      if (typeof window.refreshSheetLibraryConfig === 'function') {
        return withTimeout(window.refreshSheetLibraryConfig(), SYNC_TIMEOUT, 'Menu sync timeout.');
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SYNC_TIMEOUT);
      try {
        const response = await fetch(`./data/sheet-library-manifest.json?__sync=${Date.now()}`, {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal
        });
        if (!response.ok) throw new Error('Menu sync failed.');
        const manifest = await response.json();
        if (manifest?.courses?.length) await offline.putLibrary('sheet-manifest', manifest);
        return manifest;
      } finally {
        clearTimeout(timeout);
      }
    }

    function applyCardsWhenIdle(lesson, cards) {
      if (!window.st || !window.e) return false;
      if (st.lesson?.id !== lesson.id || st.session?.length) return false;
      st.cards = clone(cards);
      st.cards.forEach((card, index) => card.no = index + 1);
      if (e.from) e.from.value = 1;
      if (e.to) e.to.value = st.cards.length;
      if (e.meta) e.meta.textContent = `${lesson.title} · ${st.cards.length} thẻ`;
      st.face = 0;
      st.done = false;
      st.multiFaceMode = true;
      try { if (typeof loadProgress === 'function') loadProgress(); } catch (_) {}
      if (typeof render === 'function') render();
      return true;
    }

    async function syncCurrentLesson() {
      const lesson = window.st?.lesson;
      if (!lesson || lesson.source !== 'google-sheet') return { status: 'no-lesson' };
      if (typeof window.fetchSheetLessonCardsFresh !== 'function') return { status: 'reader-missing' };

      const cards = await withTimeout(
        window.fetchSheetLessonCardsFresh(lesson),
        SYNC_TIMEOUT,
        'Current lesson sync timeout.'
      );
      if (!cards.length) throw new Error('Empty lesson.');
      const previous = await offline.getLesson(lesson.id).catch(() => null);
      const parserVersion = window.sheetLessonCache?.parserVersion || 'sheet-parser-2026.07.04-v2';
      const contentHash = await hashCards(cards);
      const changed = !previous || previous.parserVersion !== parserVersion || previous.contentHash !== contentHash;
      const now = new Date().toISOString();

      await offline.putLesson({
        lessonId: lesson.id,
        courseId: lesson.courseId,
        sheet: lesson.sheet,
        range: lesson.range,
        parserVersion,
        contentHash,
        checkedAt: now,
        updatedAt: changed ? now : (previous?.updatedAt || now),
        cards: clone(cards)
      });

      const applied = changed ? applyCardsWhenIdle(lesson, cards) : false;
      return { status: 'synced', changed, applied, count: cards.length };
    }

    async function syncInBackground() {
      if (syncing || onlineState === false) return;
      syncing = true;
      try {
        await withTimeout(
          Promise.allSettled([syncManifest(), syncCurrentLesson()]),
          SYNC_TIMEOUT + 300,
          'Background sync timeout.'
        );
      } catch (_) {
        // Silent by design: this is internal maintenance, not a user notification.
      } finally {
        syncing = false;
      }
    }

    async function evaluateConnectivity(reason = 'periodic') {
      const detectedOnline = await probeInternet();
      const previous = onlineState;
      onlineState = detectedOnline;

      if (!detectedOnline) {
        setOffline();
      } else if (previous === false) {
        showReconnected();
        syncInBackground();
      } else {
        setOnlineSilently();
        if (previous === null) syncInBackground();
      }

      window.dispatchEvent(new CustomEvent('flashcard-connectivity', {
        detail: {
          online: detectedOnline,
          previous,
          reconnected: detectedOnline && previous === false,
          reason,
          checkedAt: new Date().toISOString()
        }
      }));
      return detectedOnline;
    }

    function scheduleProbe(delay = PROBE_INTERVAL) {
      clearTimeout(probeTimer);
      probeTimer = setTimeout(async () => {
        await evaluateConnectivity('periodic');
        scheduleProbe();
      }, delay);
    }

    window.addEventListener('offline', () => {
      onlineState = false;
      setOffline();
      scheduleProbe(5000);
    });
    window.addEventListener('online', async () => {
      await evaluateConnectivity('browser-online');
      scheduleProbe();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') evaluateConnectivity('visible');
    });
    window.addEventListener('focus', () => evaluateConnectivity('focus'));

    window.flashcardConnectivity = {
      check: evaluateConnectivity,
      sync: syncInBackground,
      isOnline: () => onlineState,
      renderOffline: setOffline
    };

    evaluateConnectivity('initial').finally(scheduleProbe);
  } catch (error) {
    try { console.warn('[connectivity-monitor disabled]', error); } catch (_) {}
  }
})();
