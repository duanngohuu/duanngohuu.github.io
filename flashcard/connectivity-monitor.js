// Real connectivity monitor: persistent offline banner + automatic reconnect sync without reload.
(() => {
  try {
    if (!window.flashcardOffline) return;
    const offline = window.flashcardOffline;
    const $ = selector => document.querySelector(selector);
    const PROBE_INTERVAL = 30000;
    const PROBE_TIMEOUT = 4500;
    let onlineState = null;
    let probeTimer = 0;
    let bannerTimer = 0;
    let syncing = false;
    let enforcingOffline = false;

    function clone(value) {
      try { return structuredClone(value); }
      catch (_) { return JSON.parse(JSON.stringify(value)); }
    }

    function ensureBanner() {
      let banner = $('#sheetSyncBanner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'sheetSyncBanner';
        banner.className = 'sheet-sync-banner hidden';
        banner.innerHTML = '<span class="sheet-sync-dot"></span><strong id="sheetSyncBannerText">Đang kiểm tra Internet…</strong>';
        document.body.appendChild(banner);
      }
      return banner;
    }

    function renderBanner(text, tone = 'loading', autoHideMs = 0) {
      const banner = ensureBanner();
      clearTimeout(bannerTimer);
      banner.classList.remove('hidden', 'is-ready', 'is-warning', 'is-error', 'network-persistent');
      if (tone === 'ready') banner.classList.add('is-ready');
      if (tone === 'warning') banner.classList.add('is-warning');
      if (tone === 'error') banner.classList.add('is-error');
      const label = banner.querySelector('#sheetSyncBannerText');
      if (label) label.textContent = text;
      if (autoHideMs > 0 && onlineState !== false) {
        bannerTimer = setTimeout(() => banner.classList.add('hidden'), autoHideMs);
      }
      return banner;
    }

    function renderOffline() {
      if (enforcingOffline) return;
      enforcingOffline = true;
      try {
        document.body.classList.add('network-offline');
        const banner = renderBanner('Đang offline · dùng dữ liệu đã lưu', 'warning', 0);
        banner.classList.add('network-persistent');
        banner.dataset.connectivityState = 'offline';
      } finally {
        enforcingOffline = false;
      }
    }

    function releaseOffline() {
      document.body.classList.remove('network-offline');
      const banner = ensureBanner();
      banner.classList.remove('network-persistent');
      banner.dataset.connectivityState = 'online';
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
      const response = await fetch(`./data/sheet-library-manifest.json?__sync=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'same-origin'
      });
      if (!response.ok) throw new Error('Không đồng bộ được menu.');
      const manifest = await response.json();
      await offline.putLibrary('sheet-manifest', manifest);
      return manifest;
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

      const cards = await window.fetchSheetLessonCardsFresh(lesson);
      if (!cards.length) throw new Error('Google Sheets trả về bài trống.');
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

    async function syncAfterReconnect() {
      if (syncing || onlineState === false) return;
      syncing = true;
      releaseOffline();
      renderBanner('Đã có mạng · đang đồng bộ dữ liệu…', 'ready', 0);
      try {
        const [manifestResult, lessonResult] = await Promise.allSettled([
          syncManifest(),
          syncCurrentLesson()
        ]);
        const lesson = lessonResult.status === 'fulfilled' ? lessonResult.value : null;
        let message = 'Có mạng · menu đã đồng bộ';
        if (lesson?.status === 'synced' && lesson.changed && lesson.applied) {
          message = `Có mạng · đã cập nhật ${lesson.count} thẻ`;
        } else if (lesson?.status === 'synced' && lesson.changed) {
          message = 'Có mạng · đã lưu bản mới cho lần mở sau';
        } else if (lesson?.status === 'synced') {
          message = 'Có mạng · dữ liệu bài hiện tại không đổi';
        } else if (manifestResult.status === 'rejected') {
          message = 'Có mạng · chưa đồng bộ được dữ liệu';
        }
        renderBanner(message, manifestResult.status === 'rejected' && lessonResult.status === 'rejected' ? 'warning' : 'ready', 3200);
      } catch (_) {
        renderBanner('Có mạng nhưng đồng bộ chưa thành công', 'warning', 3200);
      } finally {
        syncing = false;
      }
    }

    async function evaluateConnectivity(reason = 'periodic') {
      const detectedOnline = await probeInternet();
      const previous = onlineState;
      onlineState = detectedOnline;

      if (!detectedOnline) {
        renderOffline();
      } else {
        releaseOffline();
        if (previous === false || previous === null || reason === 'browser-online') {
          await syncAfterReconnect();
        }
      }

      window.dispatchEvent(new CustomEvent('flashcard-connectivity', {
        detail: { online: detectedOnline, previous, reason, checkedAt: new Date().toISOString() }
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
      renderOffline();
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

    const bannerObserver = new MutationObserver(() => {
      if (onlineState === false && !enforcingOffline) queueMicrotask(renderOffline);
    });
    bannerObserver.observe(ensureBanner(), {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true,
      characterData: true
    });

    window.flashcardConnectivity = {
      check: evaluateConnectivity,
      sync: syncAfterReconnect,
      isOnline: () => onlineState,
      renderOffline
    };

    evaluateConnectivity('initial').finally(scheduleProbe);
  } catch (error) {
    try { console.warn('[connectivity-monitor disabled]', error); } catch (_) {}
  }
})();
