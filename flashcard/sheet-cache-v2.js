// Cache-first lesson loading: open IndexedDB immediately, then sync Google Sheets in background.
(() => {
  try {
    if (!window.st || !window.e || !window.flashcardOffline) return;
    const offline = window.flashcardOffline;
    const $ = selector => document.querySelector(selector);
    const oldSelectLesson = window.selectLesson;
    const PARSER_VERSION = 'sheet-parser-2026.07.04-v2';
    const OVERLAY_DELAY = 650;
    let activeToken = 0;
    let bannerTimer = 0;
    let selectedHira = null;
    let selectedKata = null;
    let score = 0;
    let roundPairs = [];

    const KANA = [
      ['あ','ア'],['い','イ'],['う','ウ'],['え','エ'],['お','オ'],
      ['か','カ'],['き','キ'],['く','ク'],['け','ケ'],['こ','コ'],
      ['さ','サ'],['し','シ'],['す','ス'],['せ','セ'],['そ','ソ'],
      ['た','タ'],['ち','チ'],['つ','ツ'],['て','テ'],['と','ト'],
      ['な','ナ'],['に','ニ'],['ぬ','ヌ'],['ね','ネ'],['の','ノ'],
      ['は','ハ'],['ひ','ヒ'],['ふ','フ'],['へ','ヘ'],['ほ','ホ'],
      ['ま','マ'],['み','ミ'],['む','ム'],['め','メ'],['も','モ'],
      ['や','ヤ'],['ゆ','ユ'],['よ','ヨ'],['ら','ラ'],['り','リ'],
      ['る','ル'],['れ','レ'],['ろ','ロ'],['わ','ワ'],['を','ヲ'],['ん','ン']
    ];

    function clone(value) {
      try { return structuredClone(value); }
      catch (_) { return JSON.parse(JSON.stringify(value)); }
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

    function ensureUi() {
      let banner = $('#sheetSyncBanner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'sheetSyncBanner';
        banner.className = 'sheet-sync-banner hidden';
        banner.innerHTML = '<span class="sheet-sync-dot"></span><strong id="sheetSyncBannerText">Đang kiểm tra dữ liệu…</strong>';
        document.body.appendChild(banner);
      }

      let overlay = $('#sheetLoadOverlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sheetLoadOverlay';
        overlay.className = 'sheet-load-overlay hidden';
        overlay.innerHTML = `
          <section class="sheet-load-card" role="dialog" aria-modal="true" aria-label="Đang tải bài học">
            <p class="sheet-load-kicker">GOOGLE SHEETS · OFFLINE CACHE</p>
            <h2 id="sheetLoadTitle">Đang chuẩn bị bài học</h2>
            <p id="sheetLoadStatus" class="sheet-load-status">Đang đọc dữ liệu…</p>
            <div class="kana-game">
              <div class="kana-game-head">
                <div><strong>Nối Hiragana ↔ Katakana</strong><small>Chạm một chữ bên trái rồi chọn chữ tương ứng bên phải.</small></div>
                <span id="kanaScore">0 điểm</span>
              </div>
              <div class="kana-board">
                <div id="kanaHiraColumn" class="kana-column"></div>
                <div class="kana-link-mark">⇄</div>
                <div id="kanaKataColumn" class="kana-column"></div>
              </div>
              <p id="kanaFeedback" class="kana-feedback">Chọn một cặp để bắt đầu.</p>
            </div>
            <button id="sheetLoadContinue" class="primary sheet-load-continue hidden" type="button">Mở bài học</button>
          </section>`;
        document.body.appendChild(overlay);
      }

      const continueButton = $('#sheetLoadContinue');
      if (continueButton && continueButton.dataset.bound !== '1') {
        continueButton.dataset.bound = '1';
        continueButton.onclick = closeLoading;
      }
    }

    function showBanner(text, tone = 'loading', autoHideMs = 0) {
      ensureUi();
      clearTimeout(bannerTimer);
      const banner = $('#sheetSyncBanner');
      banner.classList.remove('hidden', 'is-ready', 'is-warning', 'is-error');
      if (tone === 'ready') banner.classList.add('is-ready');
      if (tone === 'warning') banner.classList.add('is-warning');
      if (tone === 'error') banner.classList.add('is-error');
      const label = $('#sheetSyncBannerText');
      if (label) label.textContent = text;
      if (autoHideMs > 0) {
        bannerTimer = setTimeout(() => banner.classList.add('hidden'), autoHideMs);
      }
    }

    function openLoading(title) {
      ensureUi();
      document.body.classList.add('sheet-loading-open');
      $('#sheetLoadOverlay')?.classList.remove('hidden');
      $('#sheetLoadContinue')?.classList.add('hidden');
      const heading = $('#sheetLoadTitle');
      if (heading) heading.textContent = title || 'Đang chuẩn bị bài học';
      const status = $('#sheetLoadStatus');
      if (status) status.textContent = 'Đang tải dữ liệu từ Google Sheets…';
      if (!roundPairs.length) newKanaRound();
    }

    function closeLoading() {
      $('#sheetLoadOverlay')?.classList.add('hidden');
      document.body.classList.remove('sheet-loading-open');
      requestAnimationFrame(() => window.paintCurrentMultiFace?.());
    }

    function setLoadStatus(text) {
      const status = $('#sheetLoadStatus');
      if (status) status.textContent = text;
    }

    function overlayReady(text, tone = 'ready', buttonText = 'Mở bài học') {
      setLoadStatus(text);
      showBanner(text, tone);
      const button = $('#sheetLoadContinue');
      if (button) {
        button.textContent = buttonText;
        button.classList.remove('hidden');
      }
    }

    const shuffled = values => [...values].sort(() => Math.random() - 0.5);

    function newKanaRound() {
      roundPairs = shuffled(KANA).slice(0, 4).map((pair, index) => ({
        id: `${Date.now()}-${index}`,
        hira: pair[0],
        kata: pair[1]
      }));
      selectedHira = null;
      selectedKata = null;
      const hira = $('#kanaHiraColumn');
      const kata = $('#kanaKataColumn');
      if (!hira || !kata) return;
      hira.innerHTML = roundPairs.map(pair => `<button type="button" class="kana-tile" data-kana-side="hira" data-kana-id="${pair.id}">${pair.hira}</button>`).join('');
      kata.innerHTML = shuffled(roundPairs).map(pair => `<button type="button" class="kana-tile" data-kana-side="kata" data-kana-id="${pair.id}">${pair.kata}</button>`).join('');
      const feedback = $('#kanaFeedback');
      if (feedback) feedback.textContent = 'Chọn một cặp để bắt đầu.';
    }

    function chooseKana(button) {
      if (!button || button.disabled) return;
      const side = button.dataset.kanaSide;
      document.querySelectorAll(`.kana-tile[data-kana-side="${side}"]`).forEach(tile => tile.classList.remove('selected'));
      button.classList.add('selected');
      if (side === 'hira') selectedHira = button;
      else selectedKata = button;
      if (!selectedHira || !selectedKata) return;

      const correct = selectedHira.dataset.kanaId === selectedKata.dataset.kanaId;
      const feedback = $('#kanaFeedback');
      if (correct) {
        [selectedHira, selectedKata].forEach(tile => {
          tile.classList.remove('selected');
          tile.classList.add('matched');
          tile.disabled = true;
        });
        score += 1;
        if ($('#kanaScore')) $('#kanaScore').textContent = `${score} điểm`;
        if (feedback) feedback.textContent = 'Đúng rồi! ✨';
        selectedHira = null;
        selectedKata = null;
        if ([...document.querySelectorAll('.kana-tile[data-kana-side="hira"]')].every(tile => tile.disabled)) {
          setTimeout(newKanaRound, 650);
        }
      } else {
        const wrong = [selectedHira, selectedKata];
        wrong.forEach(tile => tile.classList.add('wrong'));
        if (feedback) feedback.textContent = 'Chưa đúng, thử lại nhé.';
        selectedHira = null;
        selectedKata = null;
        setTimeout(() => wrong.forEach(tile => tile.classList.remove('selected', 'wrong')), 420);
      }
    }

    document.addEventListener('click', event => {
      const tile = event.target.closest('.kana-tile');
      if (tile) chooseKana(tile);
    }, true);

    function selectedLesson(id) {
      return (st.lessons || []).find(item => item.id === id) || null;
    }

    function applyCards(lesson, cards) {
      st.lesson = lesson;
      document.body.classList.remove('library-open');
      document.querySelectorAll('.lesson-btn').forEach(button => button.classList.toggle('active', button.dataset.lessonId === lesson.id));
      st.cards = clone(cards || []);
      st.cards.forEach((card, index) => card.no = index + 1);
      if (e.from) e.from.value = 1;
      if (e.to) e.to.value = st.cards.length;
      if (e.meta) e.meta.textContent = `${lesson.title} · ${st.cards.length} thẻ`;
      st.session = [];
      st.i = 0;
      st.face = 0;
      st.done = false;
      st.finishShown = false;
      st.multiFaceMode = true;
      try { if (typeof loadProgress === 'function') loadProgress(); } catch (_) {}
      try { if (typeof saveLast === 'function') saveLast(); } catch (_) {}
      if (typeof render === 'function') render();
      offline.putLibrary('last-selected-lesson', {
        id: lesson.id,
        courseId: lesson.courseId,
        title: lesson.title
      }).catch(() => {});
    }

    async function saveOnlineRecord(lesson, cards, previous) {
      const contentHash = await hashCards(cards);
      const changed = !previous || previous.parserVersion !== PARSER_VERSION || previous.contentHash !== contentHash;
      const now = new Date().toISOString();
      await offline.putLesson({
        lessonId: lesson.id,
        courseId: lesson.courseId,
        sheet: lesson.sheet,
        range: lesson.range,
        parserVersion: PARSER_VERSION,
        contentHash,
        checkedAt: now,
        updatedAt: changed ? now : (previous?.updatedAt || now),
        cards: clone(cards)
      });
      return { changed, contentHash };
    }

    async function syncCachedLesson(lesson, cached, token) {
      try {
        if (typeof window.fetchSheetLessonCardsFresh !== 'function') throw new Error('Bộ đọc Google Sheets chưa sẵn sàng.');
        const onlineCards = await window.fetchSheetLessonCardsFresh(lesson);
        if (token !== activeToken) return;
        if (!onlineCards.length) throw new Error('Google Sheets trả về bài trống.');
        const result = await saveOnlineRecord(lesson, onlineCards, cached);
        if (token !== activeToken) return;

        const sameLesson = st.lesson?.id === lesson.id;
        const sessionRunning = !!st.session?.length && !st.done;
        if (result.changed && sameLesson && !sessionRunning) applyCards(lesson, onlineCards);

        if (result.changed) {
          showBanner(
            sessionRunning
              ? 'Đã lưu bản mới · áp dụng lần mở bài sau'
              : `Đã cập nhật ${onlineCards.length} thẻ mới`,
            'ready',
            3200
          );
        } else {
          showBanner('Dữ liệu không đổi · đang dùng bản local', 'ready', 2200);
        }
      } catch (error) {
        if (token !== activeToken) return;
        showBanner(
          navigator.onLine === false ? 'Đang offline · dùng bản đã lưu' : 'Không kiểm tra được cập nhật · dùng bản đã lưu',
          'warning',
          3000
        );
      }
    }

    async function loadWithoutCache(lesson, staleCached, token) {
      let overlayShown = false;
      const overlayTimer = setTimeout(() => {
        if (token !== activeToken) return;
        overlayShown = true;
        openLoading(lesson.title);
      }, OVERLAY_DELAY);

      try {
        if (typeof window.fetchSheetLessonCardsFresh !== 'function') throw new Error('Bộ đọc Google Sheets chưa sẵn sàng.');
        const onlineCards = await window.fetchSheetLessonCardsFresh(lesson);
        if (token !== activeToken) return;
        if (!onlineCards.length) throw new Error('Google Sheets trả về bài trống.');
        clearTimeout(overlayTimer);
        await saveOnlineRecord(lesson, onlineCards, staleCached);
        applyCards(lesson, onlineCards);

        if (overlayShown) {
          overlayReady(`Đã tải và lưu ${onlineCards.length} thẻ trên thiết bị.`, 'ready');
        } else {
          closeLoading();
          showBanner(`Đã tải ${onlineCards.length} thẻ`, 'ready', 1800);
        }
      } catch (error) {
        if (token !== activeToken) return;
        clearTimeout(overlayTimer);
        if (staleCached?.cards?.length) {
          applyCards(lesson, staleCached.cards);
          closeLoading();
          showBanner('Không cập nhật được · dùng bản cache cũ', 'warning', 3000);
          return;
        }
        if (!overlayShown) openLoading(lesson.title);
        overlayReady(error?.message || 'Không tải được dữ liệu bài học.', 'error', 'Đóng');
      }
    }

    async function selectCacheFirst(id) {
      const lesson = selectedLesson(id);
      if (!lesson || lesson.source !== 'google-sheet') return oldSelectLesson?.(id);
      const token = ++activeToken;
      closeLoading();
      showBanner('Đang kiểm tra bản lưu trên thiết bị…');

      let cached = null;
      try { cached = await offline.getLesson(lesson.id); } catch (_) {}
      if (token !== activeToken) return;

      const validCache = cached?.parserVersion === PARSER_VERSION && Array.isArray(cached.cards) && cached.cards.length > 0;
      if (validCache) {
        applyCards(lesson, cached.cards);
        showBanner('Đã mở bản local · đang kiểm tra cập nhật…');
        syncCachedLesson(lesson, cached, token);
        return;
      }

      showBanner('Chưa có cache · đang tải Google Sheets…');
      loadWithoutCache(lesson, cached, token);
    }

    window.selectLesson = selectCacheFirst;
    window.sheetLessonCache = {
      get: offline.getLesson,
      put: offline.putLesson,
      parserVersion: PARSER_VERSION
    };
    ensureUi();
  } catch (error) {
    try { console.warn('[sheet-cache-v2 disabled]', error); } catch (_) {}
  }
})();
