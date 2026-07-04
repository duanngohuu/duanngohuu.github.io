// Stable feature layer. Wrapped so the emergency core keeps working if this file fails.
(() => {
  try {
    const $ = s => document.querySelector(s);
    const logSafe = msg => { try { if (typeof log === 'function') log(msg); } catch (_) {} };

    function addTapFeedback() {
      document.addEventListener('click', ev => {
        // Keep tap feedback on controls only. The flashcard has its own state flow;
        // scaling/dimming it here caused a second animation on every flip.
        const target = ev.target.closest('button,.lesson-btn,.stats span');
        if (!target) return;
        target.classList.remove('tap-pop');
        void target.offsetWidth;
        target.classList.add('tap-pop');
      }, { passive: true });
    }

    function renameEmergencyBrand() {
      document.title = 'Flashcard · Vocab Library';
      const small = document.querySelector('.brand small');
      if (small) small.textContent = 'Vocab Library';
    }

    function addLibraryTabs() {
      const panel = $('.library-panel');
      const titleRow = panel?.querySelector('.title-row');
      if (!panel || !titleRow || panel.querySelector('.library-tabs')) return;

      const tabs = document.createElement('div');
      tabs.className = 'library-tabs';
      tabs.innerHTML = [
        '<button class="library-tab active" type="button" data-tab="vocab">Từ vựng</button>',
        '<button class="library-tab" type="button" data-tab="grammar">Ngữ pháp</button>',
        '<button class="library-tab" type="button" data-tab="kanji">Kanji</button>'
      ].join('');

      const summary = document.createElement('p');
      summary.className = 'library-summary';
      summary.textContent = '400 từ vựng N2 hay gặp trong bài trường văn. Chọn bài rồi học theo block 10 từ.';

      const empty = document.createElement('div');
      empty.className = 'empty-tab';
      empty.style.display = 'none';

      titleRow.after(tabs, summary, empty);

      function setTab(tab) {
        tabs.querySelectorAll('.library-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
        if (tab === 'vocab') {
          if (typeof e !== 'undefined' && e.list) e.list.style.display = 'grid';
          empty.style.display = 'none';
          summary.textContent = '400 từ vựng N2 hay gặp trong bài trường văn. Chọn bài rồi học theo block 10 từ.';
          if (typeof e !== 'undefined' && e.meta && typeof st !== 'undefined' && st.cards?.length) e.meta.textContent = st.cards.length + ' thẻ';
          return;
        }
        if (typeof e !== 'undefined' && e.list) e.list.style.display = 'none';
        empty.style.display = 'block';
        const name = tab === 'grammar' ? 'Ngữ pháp N2' : 'Kanji N2';
        summary.textContent = name + ' sẽ dùng cùng layout flashcard 4 mặt sau khi import TSV chuẩn.';
        empty.textContent = 'Chưa có TSV sạch trong repo nên tab này chỉ bật khung, không tạo data giả để tránh sai chữ Nhật.';
        if (typeof e !== 'undefined' && e.meta) e.meta.textContent = 'Chưa có data';
        logSafe('Tab ' + name + ': chưa có data TSV.');
      }

      tabs.addEventListener('click', ev => {
        const btn = ev.target.closest('.library-tab');
        if (btn) setTab(btn.dataset.tab);
      });
    }

    function moveYearMetaNearCard() {
      const meta = document.querySelector('#cardMeta');
      const card = document.querySelector('#card');
      if (meta && card && card.parentNode && meta.nextElementSibling !== card) {
        card.parentNode.insertBefore(meta, card);
      }
    }

    function currentYearText() {
      try {
        const c = st?.session?.[st.i];
        return c?.years ? 'Năm: ' + c.years : '';
      } catch (_) {
        return '';
      }
    }

    function updateYearMeta() {
      const meta = document.querySelector('#cardMeta');
      if (!meta) return;
      const text = currentYearText();
      meta.textContent = text || '';
      meta.style.display = text ? 'inline-flex' : 'none';
    }

    function addStatusFilter() {
      if (typeof st === 'undefined' || typeof e === 'undefined') return;
      st.featureFilter = st.featureFilter || 'all';

      function filtered(mode) {
        if (typeof buildSession !== 'function') return [];
        let arr = buildSession();
        if (mode === 'known') arr = arr.filter(c => st.known?.has(c.id));
        if (mode === 'again') arr = arr.filter(c => st.again?.has(c.id));
        return arr;
      }

      function paintCard() {
        if (!e.card) return;
        const c = st.session?.[st.i];
        e.card.classList.remove('status-known', 'status-again');
        if (!c) return;
        if (st.known?.has(c.id)) e.card.classList.add('status-known');
        if (st.again?.has(c.id)) e.card.classList.add('status-again');
      }

      function updateActive() {
        e.pos?.classList.toggle('status-active', st.featureFilter === 'all');
        e.known?.classList.toggle('status-active', st.featureFilter === 'known');
        e.again?.classList.toggle('status-active', st.featureFilter === 'again');
        paintCard();
        updateYearMeta();
      }

      function apply(mode) {
        if (!st.cards?.length) return;
        st.featureFilter = mode;
        st.session = filtered(mode);
        st.i = 0;
        st.face = 0;
        st.done = false;
        st.finishShown = false;
        if (typeof render === 'function') render();
        updateActive();
        logSafe('Filter: ' + (mode === 'all' ? 'All' : mode === 'known' ? 'Biết' : 'Chưa nhớ') + ' · ' + st.session.length + ' thẻ');
      }

      window.applyStatusFilter = apply;
      e.pos?.addEventListener('click', () => apply('all'));
      e.known?.addEventListener('click', () => apply('known'));
      e.again?.addEventListener('click', () => apply('again'));
      if (e.review) e.review.onclick = () => apply('again');

      try {
        if (typeof render === 'function' && !render.__featureWrapped) {
          const coreRender = render;
          render = function featureRenderWrapper() {
            coreRender();
            updateActive();
          };
          render.__featureWrapped = true;
        }
      } catch (_) {}

      updateActive();
    }

    addTapFeedback();
    renameEmergencyBrand();
    addLibraryTabs();
    moveYearMetaNearCard();
    addStatusFilter();
    logSafe('Stable features loaded.');
  } catch (error) {
    try { console.warn('[flashcard features disabled]', error); } catch (_) {}
  }
})();
