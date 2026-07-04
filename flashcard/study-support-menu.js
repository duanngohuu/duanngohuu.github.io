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
      return `https://chatgpt.com/?q=${encodeURIComponent(query)}`;
    }

    function maziiUrl(word) {
      return `https://mazii.net/vi-VN/search/word/javi/${encodeURIComponent(word)}`;
    }

    function promptFor(type, word) {
      const target = `「${word}」`;
      if (type === 'reading') {
        return [
          'Hãy phân tích cách đọc của nội dung tiếng Nhật sau cho người Việt đang học tiếng Nhật.',
          `Nội dung: ${target}`,
          'Yêu cầu:',
          '1. Viết cách đọc bằng hiragana.',
          '2. Viết romaji.',
          '3. Nếu là câu hoặc cụm dài, hãy tách từng từ và ghi cách đọc của từng phần.',
          '4. Giải thích ngắn nghĩa tiếng Việt và lưu ý cách phát âm nếu cần.'
        ].join('\n');
      }
      if (type === 'examples') {
        return [
          'Hãy tạo ví dụ tự nhiên cho nội dung tiếng Nhật sau.',
          `Nội dung: ${target}`,
          'Yêu cầu:',
          '1. Cho 5 câu ví dụ thường dùng trong đời sống hoặc công việc.',
          '2. Mỗi ví dụ gồm: câu tiếng Nhật, dòng hiragana và nghĩa tiếng Việt.',
          '3. Giải thích ngắn sắc thái hoặc tình huống sử dụng.',
          '4. Không dùng ví dụ quá sách vở.'
        ].join('\n');
      }
      if (type === 'relations') {
        return [
          'Hãy phân tích các từ liên quan đến nội dung tiếng Nhật sau.',
          `Nội dung: ${target}`,
          'Yêu cầu:',
          '1. Liệt kê từ đồng nghĩa.',
          '2. Liệt kê từ gần nghĩa và giải thích điểm khác nhau.',
          '3. Liệt kê từ trái nghĩa nếu có.',
          '4. Cho ví dụ ngắn để thấy rõ sắc thái sử dụng.',
          '5. Giải thích bằng tiếng Việt.'
        ].join('\n');
      }
      return [
        'Hãy phân tích nội dung tiếng Nhật sau cho người Việt đang học tiếng Nhật.',
        `Nội dung: ${target}`,
        'Yêu cầu:',
        '1. Dịch nghĩa tự nhiên sang tiếng Việt.',
        '2. Giải thích từ loại hoặc cấu trúc ngữ pháp.',
        '3. Nêu sắc thái, ngữ cảnh và cách dùng thực tế.',
        '4. Chỉ ra điểm dễ nhầm nếu có.',
        '5. Cho ít nhất 2 câu ví dụ tự nhiên kèm nghĩa tiếng Việt.'
      ].join('\n');
    }

    function ensureStyle() {
      if (document.querySelector('link[data-study-support-fix]')) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './study-support-fix.css?v=20260704-support2';
      link.dataset.studySupportFix = '1';
      document.head.appendChild(link);
    }

    function ensureRoot() {
      let root = $('#studySupportRoot');
      if (!root) {
        root = document.createElement('div');
        root.id = 'studySupportRoot';
        root.className = 'study-support-root card-options';
        document.body.appendChild(root);
      }
      return root;
    }

    function ensureUi() {
      ensureStyle();
      const root = ensureRoot();
      const existing = [$('#studySupportTrigger'), $('#studySupportBackdrop'), $('#studySupportPanel')].filter(Boolean);
      if (existing.length) {
        existing.forEach(node => {
          if (node.parentNode !== root) root.appendChild(node);
        });
        return;
      }

      const trigger = document.createElement('button');
      trigger.id = 'studySupportTrigger';
      trigger.className = 'study-support-trigger hidden';
      trigger.type = 'button';
      trigger.setAttribute('aria-label', 'Mở hỗ trợ từ đang học');
      trigger.innerHTML = '<span>✦</span><strong>Hỗ trợ</strong>';
      root.appendChild(trigger);

      const backdrop = document.createElement('button');
      backdrop.id = 'studySupportBackdrop';
      backdrop.className = 'study-support-backdrop hidden';
      backdrop.type = 'button';
      backdrop.setAttribute('aria-label', 'Đóng menu hỗ trợ');
      root.appendChild(backdrop);

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
          <button id="studySupportClose" class="study-support-close" type="button" aria-label="Đóng">×</button>
        </header>
        <section class="study-support-current">
          <span>Nội dung tiếng Nhật</span>
          <strong id="studySupportWord">Chưa có nội dung</strong>
        </section>
        <div class="study-support-actions">
          <button class="study-support-action" type="button" data-support-action="chat">
            <span>ChatGPT</span><strong>Tìm nội dung này</strong><i>↗</i>
          </button>
          <button class="study-support-action" type="button" data-support-action="reading">
            <span>ChatGPT</span><strong>Cách đọc từ này</strong><i>↗</i>
          </button>
          <button class="study-support-action" type="button" data-support-action="examples">
            <span>ChatGPT</span><strong>Thêm câu ví dụ</strong><i>↗</i>
          </button>
          <button class="study-support-action" type="button" data-support-action="relations">
            <span>ChatGPT</span><strong>Đồng nghĩa · gần nghĩa · trái nghĩa</strong><i>↗</i>
          </button>
          <button class="study-support-action is-mazii" type="button" data-support-action="mazii">
            <span>Từ điển</span><strong>Tra trên Mazii</strong><i>↗</i>
          </button>
        </div>
        <p id="studySupportEmpty" class="study-support-empty hidden">Chưa có nội dung tiếng Nhật trong thẻ hiện tại.</p>`;
      root.appendChild(panel);

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
