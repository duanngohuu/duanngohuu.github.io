// Right-side study support menu using the Japanese content of the current card.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = selector => document.querySelector(selector);
    const JAPANESE = /[ぁ-ゖァ-ヺ一-龯々〆ヵヶ]/;
    let currentJapanese = '';
    let waitingForReturn = false;

    function cleanText(value) {
      return String(value || '')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, 500);
    }

    function japaneseText() {
      const card = st.session?.[st.i] || null;
      const faces = Array.isArray(card?.faces) ? card.faces : [];
      const candidates = [
        faces[st.face]?.text,
        ...faces.map(face => face?.text),
        e.front?.textContent,
        e.sub?.textContent
      ];
      for (const value of candidates) {
        const text = cleanText(value);
        if (text && JAPANESE.test(text)) return text;
      }
      return '';
    }

    function chatUrl(query) {
      return `https://chat.com/?q=${encodeURIComponent(query)}`;
    }

    function maziiUrl(word) {
      return `https://mazii.net/vi-VN/search/word/javi/${encodeURIComponent(word)}`;
    }

    function promptFor(type, word) {
      if (type === 'reading') {
        return `Hãy cho tôi cách đọc của từ hoặc câu tiếng Nhật sau bằng hiragana và romaji, sau đó giải thích ngắn bằng tiếng Việt: 「${word}」`;
      }
      if (type === 'examples') {
        return `Hãy cho tôi 5 câu ví dụ tự nhiên sử dụng từ hoặc mẫu câu tiếng Nhật sau. Mỗi câu gồm tiếng Nhật, hiragana và nghĩa tiếng Việt: 「${word}」`;
      }
      if (type === 'relations') {
        return `Hãy liệt kê các từ đồng nghĩa, gần nghĩa và trái nghĩa của từ hoặc câu tiếng Nhật sau. Giải thích sắc thái khác nhau và cho ví dụ ngắn bằng tiếng Việt: 「${word}」`;
      }
      return word;
    }

    function ensureUi() {
      if ($('#studySupportTrigger')) return;

      const trigger = document.createElement('button');
      trigger.id = 'studySupportTrigger';
      trigger.className = 'study-support-trigger card-options hidden';
      trigger.type = 'button';
      trigger.setAttribute('aria-label', 'Mở hỗ trợ từ đang học');
      trigger.innerHTML = '<span>✦</span><strong>Hỗ trợ</strong>';
      document.body.appendChild(trigger);

      const backdrop = document.createElement('button');
      backdrop.id = 'studySupportBackdrop';
      backdrop.className = 'study-support-backdrop card-options hidden';
      backdrop.type = 'button';
      backdrop.setAttribute('aria-label', 'Đóng menu hỗ trợ');
      document.body.appendChild(backdrop);

      const panel = document.createElement('aside');
      panel.id = 'studySupportPanel';
      panel.className = 'study-support-panel hidden';
      panel.setAttribute('aria-hidden', 'true');
      panel.innerHTML = `
        <header>
          <div>
            <small>HỖ TRỢ TỪ ĐANG HỌC</small>
            <h2>Tra cứu nhanh</h2>
          </div>
          <button id="studySupportClose" class="study-support-close card-options" type="button" aria-label="Đóng">×</button>
        </header>
        <section class="study-support-current">
          <span>Nội dung tiếng Nhật</span>
          <strong id="studySupportWord">Chưa có nội dung</strong>
        </section>
        <div class="study-support-actions">
          <button class="study-support-action card-options" type="button" data-support-action="chat">
            <span>ChatGPT</span><strong>Tìm nội dung này</strong><i>↗</i>
          </button>
          <button class="study-support-action card-options" type="button" data-support-action="reading">
            <span>ChatGPT</span><strong>Cách đọc từ này</strong><i>↗</i>
          </button>
          <button class="study-support-action card-options" type="button" data-support-action="examples">
            <span>ChatGPT</span><strong>Thêm câu ví dụ</strong><i>↗</i>
          </button>
          <button class="study-support-action card-options" type="button" data-support-action="relations">
            <span>ChatGPT</span><strong>Đồng nghĩa · gần nghĩa · trái nghĩa</strong><i>↗</i>
          </button>
          <button class="study-support-action is-maz ii card-options" type="button" data-support-action="mazii">
            <span>Từ điển</span><strong>Tra trên Mazii</strong><i>↗</i>
          </button>
        </div>
        <p id="studySupportEmpty" class="study-support-empty hidden">Chưa có nội dung tiếng Nhật trong thẻ hiện tại.</p>`;
      document.body.appendChild(panel);

      trigger.addEventListener('pointerdown', event => {
        event.preventDefault();
        openMenu();
      });
      trigger.addEventListener('click', event => {
        event.preventDefault();
        openMenu();
      });
      backdrop.addEventListener('click', () => closeMenu(true));
      $('#studySupportClose')?.addEventListener('click', () => closeMenu(true));
      panel.addEventListener('click', event => {
        const button = event.target.closest('[data-support-action]');
        if (!button || button.disabled) return;
        openAction(button.dataset.supportAction);
      });
    }

    function syncUi() {
      ensureUi();
      currentJapanese = japaneseText();
      const trigger = $('#studySupportTrigger');
      const word = $('#studySupportWord');
      const empty = $('#studySupportEmpty');
      const actions = [...document.querySelectorAll('.study-support-action')];
      const hasWord = !!currentJapanese;

      trigger?.classList.toggle('hidden', !st.session?.length);
      if (word) word.textContent = currentJapanese || 'Chưa có nội dung';
      empty?.classList.toggle('hidden', hasWord);
      actions.forEach(button => { button.disabled = !hasWord; });
    }

    function openMenu() {
      syncUi();
      if (!st.session?.length) return;
      window.flashcardAutoStudy?.pause?.();
      document.body.classList.add('study-support-open');
      $('#studySupportBackdrop')?.classList.remove('hidden');
      const panel = $('#studySupportPanel');
      panel?.classList.remove('hidden');
      panel?.setAttribute('aria-hidden', 'false');
    }

    function closeMenu(resumeAuto = true) {
      document.body.classList.remove('study-support-open');
      $('#studySupportBackdrop')?.classList.add('hidden');
      const panel = $('#studySupportPanel');
      panel?.classList.add('hidden');
      panel?.setAttribute('aria-hidden', 'true');
      if (resumeAuto && $('#autoInput')?.checked) {
        setTimeout(() => window.flashcardAutoStudy?.resume?.(), 80);
      }
    }

    function openExternal(url) {
      waitingForReturn = !!$('#autoInput')?.checked;
      closeMenu(false);
      window.open(url, '_blank', 'noopener,noreferrer');
      if (waitingForReturn && document.visibilityState === 'visible') {
        setTimeout(() => {
          if (document.visibilityState === 'visible' && waitingForReturn) {
            waitingForReturn = false;
            window.flashcardAutoStudy?.resume?.();
          }
        }, 700);
      }
    }

    function openAction(type) {
      const word = japaneseText();
      if (!word) return;
      if (type === 'mazii') {
        openExternal(maziiUrl(word));
        return;
      }
      openExternal(chatUrl(promptFor(type, word)));
    }

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.body.classList.contains('study-support-open')) closeMenu(true);
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && waitingForReturn) {
        waitingForReturn = false;
        setTimeout(() => window.flashcardAutoStudy?.resume?.(), 80);
      }
    });

    const observed = [e.front, e.sub].filter(Boolean);
    if (observed.length) {
      const observer = new MutationObserver(syncUi);
      observed.forEach(node => observer.observe(node, { childList: true, characterData: true, subtree: true }));
    }

    window.studySupportMenu = {
      open: openMenu,
      close: closeMenu,
      currentJapanese: japaneseText
    };

    ensureUi();
    syncUi();
  } catch (error) {
    try { console.warn('[study-support-menu disabled]', error); } catch (_) {}
  }
})();
