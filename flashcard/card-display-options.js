// Extra display options: reverse study and hide Kanji without hiding Hiragana too.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    const REVERSE_KEY = 'fc_vocab_reverse_face_v1';
    const HIDE_KANJI_KEY = 'fc_vocab_hide_kanji_v1';
    const READING_KEY = 'fc_vocab_show_reading_v2';
    function currentCard() { return st.session?.[st.i] || null; }
    function on(id) { return !!$(id)?.checked; }
    function save(key, value) { try { localStorage.setItem(key, value ? 'on' : 'off'); } catch (_) {} }
    function load(key) { try { return localStorage.getItem(key) === 'on'; } catch (_) { return false; } }
    function sideClass(side) {
      if (!e.card) return;
      e.card.classList.toggle('fc-meaning-side', side === 'meaning');
      e.card.classList.toggle('fc-word-side', side === 'word');
    }
    function moveAfter(input, anchorSelector) {
      if (!input || !anchorSelector) return;
      const label = input.closest('label');
      const anchor = $(anchorSelector)?.closest('label');
      if (label && anchor && anchor.nextElementSibling !== label) anchor.after(label);
    }
    function ensureToggle(id, icon, title, key, afterSelector) {
      let input = $('#' + id);
      if (!input) {
        const label = document.createElement('label');
        label.title = title;
        label.innerHTML = `<input id="${id}" type="checkbox"> ${icon}`;
        document.querySelector('.card-options')?.appendChild(label);
        input = $('#' + id);
      }
      moveAfter(input, afterSelector);
      const label = input.closest('label');
      if (label && label.dataset.shortText !== icon) {
        label.dataset.shortText = icon;
        label.title = title;
        label.innerHTML = '';
        label.append(input, document.createTextNode(' ' + icon));
      }
      input.checked = load(key);
      if (input.dataset.displayBound !== '1') {
        input.dataset.displayBound = '1';
        input.onchange = () => {
          if (id === 'hideKanjiInput' && input.checked) forceReadingOn();
          if (id === 'readingInput' && !input.checked && on('#hideKanjiInput')) input.checked = true;
          save(key, input.checked);
          applyDisplay();
        };
      }
      return input;
    }
    function forceReadingOn() {
      const reading = $('#readingInput');
      if (!reading) return;
      reading.checked = true;
      st.showReading = true;
      save(READING_KEY, true);
    }
    function ensureToggles() {
      ensureToggle('hideKanjiInput', '漢', 'Ẩn Hán tự, bắt buộc bật Hiragana', HIDE_KANJI_KEY, '#readingInput');
      ensureToggle('reverseInput', '⇄', 'Học ngược: hiện mặt sau trước', REVERSE_KEY);
      const reading = $('#readingInput');
      if (reading && reading.dataset.displayGuard !== '1') {
        reading.dataset.displayGuard = '1';
        reading.addEventListener('change', () => {
          if (!reading.checked && on('#hideKanjiInput')) {
            reading.checked = true;
            st.showReading = true;
            save(READING_KEY, true);
          }
          applyDisplay();
        });
      }
      if (on('#hideKanjiInput')) forceReadingOn();
    }
    function wordSide(c) {
      sideClass('word');
      const hideKanji = on('#hideKanjiInput');
      const showReading = on('#readingInput') || hideKanji;
      if (hideKanji && c.reading) {
        e.front.textContent = c.reading;
        e.sub.textContent = '';
        e.hint.textContent = 'Mặt từ: Hán tự đang ẩn. Bấm lật để xem nghĩa.';
      } else {
        e.front.textContent = c.front || '';
        e.sub.textContent = showReading && c.reading ? c.reading : '';
        e.hint.textContent = showReading ? 'Mặt từ: Hán tự + Hiragana.' : 'Mặt từ: Hán tự.';
      }
      $('#cardMeta') && ($('#cardMeta').textContent = '#n2');
    }
    function meaningSide(c) {
      sideClass('meaning');
      e.front.textContent = c.meaning_vi || '';
      e.sub.textContent = [c.reading ? 'Cách đọc: ' + c.reading : '', c.han_viet ? 'Âm Hán Việt: ' + c.han_viet : ''].filter(Boolean).join('\n');
      e.hint.textContent = 'Mặt nghĩa: bấm lật để xem lại từ.';
      $('#cardMeta') && ($('#cardMeta').textContent = c.years ? 'Năm: ' + c.years : '#n2');
    }
    function applyDisplay() {
      ensureToggles();
      const c = currentCard();
      if (!c) return;
      const reverse = on('#reverseInput');
      const showMeaning = reverse ? st.face === 0 : st.face === 1;
      if (showMeaning) meaningSide(c);
      else wordSide(c);
      save(REVERSE_KEY, on('#reverseInput'));
      save(HIDE_KANJI_KEY, on('#hideKanjiInput'));
    }
    const oldRender = window.render;
    if (typeof oldRender === 'function' && !oldRender.__displayOptionsWrapped) {
      window.render = function displayOptionsRender() {
        oldRender();
        requestAnimationFrame(applyDisplay);
      };
      window.render.__displayOptionsWrapped = true;
    }
    document.addEventListener('click', ev => {
      if (ev.target.closest('#flipBtn,#card,#knownBtn,#againBtn,#prevBtn,#startBtn,.lesson-btn,#finishKnownBtn,#finishAgainBtn,#finishRestartBtn')) {
        requestAnimationFrame(applyDisplay);
        setTimeout(applyDisplay, 80);
      }
    }, true);
    document.addEventListener('change', ev => {
      if (ev.target?.closest('#reverseInput,#hideKanjiInput,#readingInput')) setTimeout(applyDisplay, 0);
    }, true);
    ensureToggles();
    applyDisplay();
    try { if (typeof log === 'function') log('Display options loaded.'); } catch (_) {}
  } catch (error) {
    try { console.warn('[display-options disabled]', error); } catch (_) {}
  }
})();
