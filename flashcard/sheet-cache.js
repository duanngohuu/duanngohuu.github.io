// IndexedDB lesson cache + online hash check + kana matching game while syncing Google Sheets.
(() => {
  try {
    if (!window.st || !window.e) return;

    const DB_NAME = 'fc-sheet-library';
    const DB_VERSION = 1;
    const STORE = 'lessons';
    const PARSER_VERSION = 'sheet-parser-2026.07.04-v1';
    const $ = selector => document.querySelector(selector);
    const oldSelectLesson = window.selectLesson;
    let dbPromise = null;
    let activeToken = 0;
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

    function openDb() {
      if (dbPromise) return dbPromise;
      dbPromise = new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) return reject(new Error('Trình duyệt không hỗ trợ IndexedDB.'));
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE)) {
            const store = db.createObjectStore(STORE, { keyPath: 'lessonId' });
            store.createIndex('courseId', 'courseId', { unique: false });
            store.createIndex('checkedAt', 'checkedAt', { unique: false });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Không mở được IndexedDB.'));
      });
      return dbPromise;
    }

    async function dbGet(lessonId) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(lessonId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    }

    async function dbPut(record) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(record);
        request.onsuccess = () => resolve(record);
        request.onerror = () => reject(request.error);
      });
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
      for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
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
        banner.innerHTML = '<span class="sheet-sync-dot"></span><strong id="sheetSyncBannerText">Đang tải dữ liệu…</strong>';
        document.body.appendChild(banner);
      }

      let overlay = $('#sheetLoadOverlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sheetLoadOverlay';
        overlay.className = 'sheet-load-overlay hidden';
        overlay.innerHTML = `
          <section class="sheet-load-card" role="dialog" aria-modal="true" aria-label="Đang tải bài học">
            <p class="sheet-load-kicker">GOOGLE SHEETS · INDEXEDDB</p>
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
      return { banner, overlay };
    }

    function setBanner(text, tone = 'loading') {
      ensureUi();
      const banner = $('#sheetSyncBanner');
      banner.classList.remove('hidden', 'is-ready', 'is-warning', 'is-error');
      if (tone === 'ready') banner.classList.add('is-ready');
      if (tone === 'warning') banner.classList.add('is-warning');
      if (tone === 'error') banner.classList.add('is-error');
      const label = $('#sheetSyncBannerText');
      if (label) label.textContent = text;
    }

    function openLoading(title) {
      ensureUi();
      document.body.classList.add('sheet-loading-open');
      $('#sheetLoadOverlay')?.classList.remove('hidden');
      $('#sheetLoadContinue')?.classList.add('hidden');
      const heading = $('#sheetLoadTitle');
      if (heading) heading.textContent = title || 'Đang chuẩn bị bài học';
      const status = $('#sheetLoadStatus');
      if (status) status.textContent = 'Đang kiểm tra bộ nhớ trên thiết bị…';
      setBanner('Đang kiểm tra dữ liệu bài học…');
      if (!roundPairs.length) newKanaRound();
    }

    function closeLoading() {
      $('#sheetLoadOverlay')?.classList.add('hidden');
      $('#sheetSyncBanner')?.classList.add('hidden');
      document.body.classList.remove('sheet-loading-open');
      requestAnimationFrame(() => window.paintCurrentMultiFace?.());
    }

    function setLoadStatus(text) {
      const status = $('#sheetLoadStatus');
      if (status) status.textContent = text;
    }

    function ready(text, tone = 'ready', buttonText = 'Mở bài học') {
      setLoadStatus(text);
      setBanner(text, tone);
      const button = $('#sheetLoadContinue');
      if (button) {
        button.textContent = buttonText;
        button.classList.remove('hidden');
      }
    }

    function shuffled(values) {
      return [...values].sort(() => Math.random() - 0.5);
    }

    function newKanaRound() {
      roundPairs = shuffled(KANA).slice(0, 4).map((pair, index) => ({ id: `${Date.now()}-${index}`, hira: pair[0], kata: pair[1] }));
      selectedHira = null;
      selectedKata = null;
      renderKanaColumns();
      const feedback = $('#kanaFeedback');
      if (feedback) feedback.textContent = 'Chọn một cặp để bắt đầu.';
    }

    function renderKanaColumns() {
      const hiraColumn = $('#kanaHiraColumn');
      const kataColumn = $('#kanaKataColumn');
      if (!hiraColumn || !kataColumn) return;
      hiraColumn.innerHTML = roundPairs.map(pair => `<button type="button" class="kana-tile" data-kana-side="hira" data-kana-id="${pair.id}">${pair.hira}</button>`).join('');
      kataColumn.innerHTML = shuffled(roundPairs).map(pair => `<button type="button" class="kana-tile" data-kana-side="kata" data-kana-id="${pair.id}">${pair.kata}</button>`).join('');
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
        const scoreNode = $('#kanaScore');
        if (scoreNode) scoreNode.textContent = `${score} điểm`;
        if (feedback) feedback.textContent = 'Đúng rồi! ✨';
        selectedHira = null;
        selectedKata = null;
        if ([...document.querySelectorAll('.kana-tile[data-kana-side="hira"]')].every(tile => tile.disabled)) {
          setTimeout(newKanaRound, 650);
        }
      } else {
        const wrongHira = selectedHira;
        const wrongKata = selectedKata;
        [wrongHira, wrongKata].forEach(tile => tile.classList.add('wrong'));
        if (feedback) feedback.textContent = 'Chưa đúng, thử lại nhé.';
        selectedHira = null;
        selectedKata = null;
        setTimeout(() => {
          [wrongHira, wrongKata].forEach(tile => tile.classList.remove('selected', 'wrong'));
        }, 420);
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
    }

    async function selectWithCache(id) {
      const lesson = selectedLesson(id);
      if (!lesson || lesson.source !== 'google-sheet') return oldSelectLesson?.(id);

      const token = ++activeToken;
      openLoading(lesson.title);
      let cached = null;
      let cachedCards = null;

      try {
        cached = await dbGet(lesson.id);
        if (token !== activeToken) return;
        if (cached?.parserVersion === PARSER_VERSION && Array.isArray(cached.cards) && cached.cards.length) {
          cachedCards = clone(cached.cards);
          applyCards(lesson, cachedCards);
          setLoadStatus(`Đã nạp ${cachedCards.length} thẻ từ máy. Đang kiểm tra Google Sheets…`);
          setBanner('Đã nạp bản lưu · đang kiểm tra cập nhật…');
        } else {
          setLoadStatus('Chưa có bản lưu. Đang tải dữ liệu từ Google Sheets…');
          setBanner('Đang tải dữ liệu mới từ Google Sheets…');
        }
      } catch (_) {
        setLoadStatus('Không đọc được bộ nhớ cục bộ. Đang tải Google Sheets…');
        setBanner('Đang tải Google Sheets…', 'warning');
      }

      const course = window.getSheetLibraryCourse?.(lesson.courseId);
      if (!course) {
        if (cachedCards) {
          applyCards(lesson, cachedCards);
          ready('Không tìm thấy cấu hình online · đang dùng bản đã lưu.', 'warning');
        } else {
          ready('Không tìm thấy cấu hình của bài học.', 'error', 'Đóng');
        }
        return;
      }

      const originalRange = course.usedRange;
      course.usedRange = lesson.range;
      course._rows = null;
      let onlineOk = false;

      try {
        await oldSelectLesson(id);
        onlineOk = course._rows instanceof Map && Array.isArray(st.cards) && st.cards.length > 0;
        if (token !== activeToken) return;

        if (onlineOk) {
          const onlineCards = clone(st.cards);
          const onlineHash = await hashCards(onlineCards);
          const changed = !cached || cached.parserVersion !== PARSER_VERSION || cached.contentHash !== onlineHash;
          const now = new Date().toISOString();
          await dbPut({
            lessonId: lesson.id,
            courseId: lesson.courseId,
            sheet: lesson.sheet,
            range: lesson.range,
            parserVersion: PARSER_VERSION,
            contentHash: onlineHash,
            checkedAt: now,
            updatedAt: changed ? now : (cached?.updatedAt || now),
            cards: onlineCards
          });
          applyCards(lesson, onlineCards);
          if (changed) ready(`Đã cập nhật ${onlineCards.length} thẻ mới từ Google Sheets.`, 'ready');
          else ready(`Dữ liệu không đổi · dùng bản đã lưu (${onlineCards.length} thẻ).`, 'ready');
        } else if (cachedCards) {
          applyCards(lesson, cachedCards);
          ready(`Không kết nối được Google Sheets · dùng ${cachedCards.length} thẻ đã lưu.`, 'warning');
        } else {
          ready('Không tải được bài học và chưa có bản lưu trên máy.', 'error', 'Đóng');
        }
      } catch (error) {
        if (token !== activeToken) return;
        if (cachedCards) {
          applyCards(lesson, cachedCards);
          ready(`Mạng lỗi · dùng ${cachedCards.length} thẻ đã lưu.`, 'warning');
        } else {
          ready(error?.message || 'Không tải được dữ liệu bài học.', 'error', 'Đóng');
        }
      } finally {
        course.usedRange = originalRange;
      }
    }

    window.selectLesson = selectWithCache;
    window.sheetLessonCache = {
      get: dbGet,
      put: dbPut,
      parserVersion: PARSER_VERSION
    };
    ensureUi();
  } catch (error) {
    try { console.warn('[sheet-cache disabled]', error); } catch (_) {}
  }
})();
