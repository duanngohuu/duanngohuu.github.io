// Card display settings: compact gear button with front/back visibility tabs.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    const REVERSE_KEY = 'fc_vocab_reverse_face_v1';
    const HIDE_KANJI_KEY = 'fc_vocab_hide_kanji_v1';
    const READING_KEY = 'fc_vocab_show_reading_v2';
    const BACK_MEANING_KEY = 'fc_vocab_back_meaning_v1';
    const BACK_HANVIET_KEY = 'fc_vocab_back_hanviet_v1';
    const BACK_READING_KEY = 'fc_vocab_back_reading_v1';

    function currentCard() { return st.session?.[st.i] || null; }
    function on(selector) { return !!$(selector)?.checked; }
    function save(key, value) { try { localStorage.setItem(key, value ? 'on' : 'off'); } catch (_) {} }
    function load(key, fallback = false) {
      try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : value === 'on';
      } catch (_) { return fallback; }
    }
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
    function ensureLegacyToggle(id, icon, title, key, afterSelector) {
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
          save(key, input.checked);
          syncPopupFromInputs();
          applyDisplay();
        };
      }
      return input;
    }

    function makeSwitch(id, label, checked) {
      return `<label class="display-setting-row" for="${id}"><span>${label}</span><input id="${id}" type="checkbox" ${checked ? 'checked' : ''}><i></i></label>`;
    }

    function ensurePopup() {
      const options = document.querySelector('.card-options');
      if (!options) return;
      let gear = $('#displaySettingsBtn');
      if (!gear) {
        gear = document.createElement('button');
        gear.id = 'displaySettingsBtn';
        gear.type = 'button';
        gear.className = 'display-settings-btn';
        gear.title = 'Tùy chỉnh mặt trước và mặt sau';
        gear.setAttribute('aria-label', 'Cài đặt hiển thị thẻ');
        gear.innerHTML = '<span>⚙</span>';
        const reverseLabel = $('#reverseInput')?.closest('label');
        if (reverseLabel) reverseLabel.after(gear);
        else options.appendChild(gear);
      }

      let backdrop = $('#displaySettingsBackdrop');
      if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'displaySettingsBackdrop';
        backdrop.className = 'display-settings-backdrop hidden';
        backdrop.innerHTML = `
          <section class="display-settings-popup" role="dialog" aria-modal="true" aria-label="Cài đặt hiển thị thẻ">
            <header><strong>Hiển thị thẻ</strong><button id="displaySettingsClose" type="button" aria-label="Đóng">×</button></header>
            <nav class="display-settings-tabs">
              <button class="active" type="button" data-display-tab="front">Mặt trước</button>
              <button type="button" data-display-tab="back">Mặt sau</button>
            </nav>
            <div class="display-settings-panel active" data-display-panel="front">
              ${makeSwitch('frontKanjiSetting', 'Hán tự', !load(HIDE_KANJI_KEY))}
              ${makeSwitch('frontReadingSetting', 'Hiragana', load(READING_KEY))}
            </div>
            <div class="display-settings-panel" data-display-panel="back">
              ${makeSwitch('backMeaningSetting', 'Nghĩa', load(BACK_MEANING_KEY, true))}
              ${makeSwitch('backHanVietSetting', 'Âm Hán Việt', load(BACK_HANVIET_KEY, true))}
              ${makeSwitch('backReadingSetting', 'Hiragana', load(BACK_READING_KEY, true))}
            </div>
          </section>`;
        options.appendChild(backdrop);
      }

      if (gear.dataset.settingsBound !== '1') {
        gear.dataset.settingsBound = '1';
        gear.onclick = ev => {
          ev.preventDefault();
          ev.stopPropagation();
          syncPopupFromInputs();
          backdrop.classList.remove('hidden');
          document.body.classList.add('display-settings-open');
        };
      }

      backdrop.querySelector('#displaySettingsClose').onclick = closePopup;
      backdrop.addEventListener('click', ev => { if (ev.target === backdrop) closePopup(); });
      backdrop.querySelectorAll('[data-display-tab]').forEach(btn => {
        btn.onclick = () => setPopupTab(btn.dataset.displayTab);
      });
      bindPopupSwitches();
    }

    function closePopup() {
      $('#displaySettingsBackdrop')?.classList.add('hidden');
      document.body.classList.remove('display-settings-open');
    }
    function setPopupTab(tab) {
      document.querySelectorAll('[data-display-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.displayTab === tab));
      document.querySelectorAll('[data-display-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.displayPanel === tab));
    }
    function syncPopupFromInputs() {
      const frontKanji = $('#frontKanjiSetting');
      const frontReading = $('#frontReadingSetting');
      if (frontKanji) frontKanji.checked = !on('#hideKanjiInput');
      if (frontReading) frontReading.checked = on('#readingInput');
      const backMeaning = $('#backMeaningSetting');
      const backHanViet = $('#backHanVietSetting');
      const backReading = $('#backReadingSetting');
      if (backMeaning) backMeaning.checked = load(BACK_MEANING_KEY, true);
      if (backHanViet) backHanViet.checked = load(BACK_HANVIET_KEY, true);
      if (backReading) backReading.checked = load(BACK_READING_KEY, true);
    }
    function bindPopupSwitches() {
      const frontKanji = $('#frontKanjiSetting');
      const frontReading = $('#frontReadingSetting');
      const backMeaning = $('#backMeaningSetting');
      const backHanViet = $('#backHanVietSetting');
      const backReading = $('#backReadingSetting');
      if (!frontKanji || frontKanji.dataset.bound === '1') return;
      [frontKanji, frontReading, backMeaning, backHanViet, backReading].forEach(input => input.dataset.bound = '1');

      frontKanji.onchange = () => {
        const hideKanji = $('#hideKanjiInput');
        if (hideKanji) hideKanji.checked = !frontKanji.checked;
        if (!frontKanji.checked && !frontReading.checked) frontReading.checked = true;
        syncFrontInputs(frontKanji, frontReading);
      };
      frontReading.onchange = () => {
        if (!frontReading.checked && !frontKanji.checked) frontKanji.checked = true;
        syncFrontInputs(frontKanji, frontReading);
      };
      backMeaning.onchange = () => { save(BACK_MEANING_KEY, backMeaning.checked); applyDisplay(); };
      backHanViet.onchange = () => { save(BACK_HANVIET_KEY, backHanViet.checked); applyDisplay(); };
      backReading.onchange = () => { save(BACK_READING_KEY, backReading.checked); applyDisplay(); };
    }
    function syncFrontInputs(frontKanji, frontReading) {
      const hideKanji = $('#hideKanjiInput');
      const reading = $('#readingInput');
      if (hideKanji) hideKanji.checked = !frontKanji.checked;
      if (reading) reading.checked = frontReading.checked;
      st.showReading = frontReading.checked;
      save(HIDE_KANJI_KEY, !frontKanji.checked);
      save(READING_KEY, frontReading.checked);
      applyDisplay();
    }

    function ensureControls() {
      ensureLegacyToggle('hideKanjiInput', '漢', 'Ẩn Hán tự', HIDE_KANJI_KEY, '#readingInput');
      ensureLegacyToggle('reverseInput', '⇄', 'Học ngược: hiện mặt sau trước', REVERSE_KEY);
      const reading = $('#readingInput');
      const hideKanji = $('#hideKanjiInput');
      reading?.closest('label')?.classList.add('display-option-hidden');
      hideKanji?.closest('label')?.classList.add('display-option-hidden');
      if (reading) {
        reading.checked = load(READING_KEY);
        st.showReading = reading.checked;
      }
      if (hideKanji) hideKanji.checked = load(HIDE_KANJI_KEY);
      ensurePopup();
    }

    function wordSide(c) {
      sideClass('word');
      const showKanji = !on('#hideKanjiInput');
      const showReading = on('#readingInput');
      e.front.textContent = showKanji ? (c.front || '') : (showReading ? (c.reading || '') : '');
      e.sub.textContent = showKanji && showReading && c.reading ? c.reading : '';
      e.hint.textContent = showKanji
        ? (showReading ? 'Mặt trước: Hán tự + Hiragana.' : 'Mặt trước: Hán tự.')
        : 'Mặt trước: chỉ hiện Hiragana.';
      $('#cardMeta') && ($('#cardMeta').textContent = '#n2');
    }
    function meaningSide(c) {
      sideClass('meaning');
      const showMeaning = load(BACK_MEANING_KEY, true);
      const showHanViet = load(BACK_HANVIET_KEY, true);
      const showReading = load(BACK_READING_KEY, true);
      e.front.textContent = showMeaning ? (c.meaning_vi || '') : '';
      e.sub.textContent = [
        showReading && c.reading ? c.reading : '',
        showHanViet && c.han_viet ? c.han_viet : ''
      ].filter(Boolean).join('\n');
      e.hint.textContent = 'Mặt sau: tùy chỉnh nội dung bằng nút ⚙.';
      $('#cardMeta') && ($('#cardMeta').textContent = c.years ? 'Năm: ' + c.years : '#n2');
    }
    function applyDisplay() {
      ensureControls();
      const c = currentCard();
      if (!c) return;
      const reverse = on('#reverseInput');
      const showMeaningSide = reverse ? st.face === 0 : st.face === 1;
      if (showMeaningSide) meaningSide(c);
      else wordSide(c);
      save(REVERSE_KEY, on('#reverseInput'));
    }

    const oldRender = window.render;
    if (typeof oldRender === 'function' && !oldRender.__displaySettingsWrapped) {
      window.render = function displaySettingsRender() {
        oldRender();
        requestAnimationFrame(applyDisplay);
      };
      window.render.__displaySettingsWrapped = true;
    }

    document.addEventListener('click', ev => {
      if (ev.target.closest('#flipBtn,#card,#knownBtn,#againBtn,#prevBtn,#startBtn,.lesson-btn,#finishKnownBtn,#finishAgainBtn,#finishRestartBtn')) {
        requestAnimationFrame(applyDisplay);
      }
    }, true);
    document.addEventListener('change', ev => {
      if (ev.target?.closest('#reverseInput')) setTimeout(applyDisplay, 0);
    }, true);
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closePopup(); });

    ensureControls();
    applyDisplay();
    try { if (typeof log === 'function') log('Display settings popup loaded.'); } catch (_) {}
  } catch (error) {
    try { console.warn('[display-settings disabled]', error); } catch (_) {}
  }
})();
