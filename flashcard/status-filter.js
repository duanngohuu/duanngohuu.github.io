(() => {
  function bootStatusFilter() {
    if (typeof st === 'undefined' || typeof e === 'undefined' || typeof buildSession === 'undefined') {
      return setTimeout(bootStatusFilter, 120);
    }

    st.filterMode = st.filterMode || 'all';

    e.pos.setAttribute('role', 'button');
    e.known.setAttribute('role', 'button');
    e.again.setAttribute('role', 'button');
    e.pos.title = 'Học tất cả trong range hiện tại';
    e.known.title = 'Chỉ học các thẻ đã biết';
    e.again.title = 'Chỉ học các thẻ chưa nhớ';

    function baseCards() {
      let a = Math.max(1, +e.from.value || 1);
      let b = Math.min(st.cards.length, +e.to.value || st.cards.length);
      if (a > b) [a, b] = [b, a];
      let arr = st.cards.filter(c => c.no >= a && c.no <= b);
      if (e.limit.value !== 'all') arr = arr.slice(0, +e.limit.value);
      return arr;
    }

    function filteredCards() {
      let arr = baseCards();
      if (st.filterMode === 'known') arr = arr.filter(c => st.known.has(c.id));
      if (st.filterMode === 'again') arr = arr.filter(c => st.again.has(c.id));
      if (e.shuffle.checked) arr = shuffle(arr);
      return arr;
    }

    function paintCard() {
      const c = current?.();
      e.card.classList.toggle('status-known', !!c && st.known.has(c.id));
      e.card.classList.toggle('status-again', !!c && st.again.has(c.id));
    }

    const oldRender = render;
    render = function renderWithStatus() {
      oldRender();
      paintCard();
      stats();
    };

    stats = function statsWithFilters() {
      const base = baseCards();
      const knownCount = base.filter(c => st.known.has(c.id)).length;
      const againCount = base.filter(c => st.again.has(c.id)).length;
      e.pos.textContent = `All: ${base.length}`;
      e.known.textContent = `Biết: ${knownCount}`;
      e.again.textContent = `Chưa nhớ: ${againCount}`;
      e.pos.classList.toggle('status-active', st.filterMode === 'all');
      e.known.classList.toggle('status-active', st.filterMode === 'known');
      e.again.classList.toggle('status-active', st.filterMode === 'again');
      const pct = st.session.length ? ((st.i + 1) / st.session.length * 100) : 0;
      e.bar.style.width = pct + '%';
    };

    function applyFilter(mode) {
      st.filterMode = mode;
      st.session = filteredCards();
      st.i = 0;
      st.face = 0;
      st.done = false;
      document.querySelector('.complete-panel')?.remove();
      render();
      if (mode === 'all') log(`Đang học tất cả ${st.session.length} thẻ trong range.`);
      if (mode === 'known') log(`Đang lọc thẻ đã biết: ${st.session.length} thẻ.`);
      if (mode === 'again') log(`Đang lọc thẻ chưa nhớ: ${st.session.length} thẻ.`);
    }

    e.pos.onclick = () => applyFilter('all');
    e.known.onclick = () => applyFilter('known');
    e.again.onclick = () => applyFilter('again');

    start = function startWithFilter() {
      if (!st.cards.length) return;
      st.session = filteredCards();
      st.i = 0;
      st.face = 0;
      st.done = false;
      document.querySelector('.complete-panel')?.remove();
      saveLast();
      render();
      log(`Bắt đầu học ${st.session.length} thẻ (${st.filterMode}).`);
    };
    e.start.onclick = start;

    mark = function markWithFilter(type) {
      const c = current();
      if (!c) return;
      if (type === 'known') {
        st.known.add(c.id);
        st.again.delete(c.id);
        log('Đánh dấu biết rồi.');
      } else {
        st.again.add(c.id);
        st.known.delete(c.id);
        log('Đánh dấu chưa nhớ.');
      }
      saveProgress();
      if (st.filterMode === 'all') return next();
      const oldIndex = st.i;
      st.session = filteredCards();
      if (!st.session.length) return complete();
      st.i = Math.min(oldIndex, st.session.length - 1);
      st.face = 0;
      render();
    };
    e.bad.onclick = () => mark('again');
    e.ok.onclick = () => mark('known');

    next = function nextWithStatus() {
      if (!st.session.length) return;
      if (st.i >= st.session.length - 1) return complete();
      st.i++;
      st.face = 0;
      render();
    };
    e.next.onclick = next;

    prev = function prevWithStatus() {
      if (!st.session.length) return;
      st.i = Math.max(0, st.i - 1);
      st.face = 0;
      render();
    };
    e.prev.onclick = prev;

    stats();
    paintCard();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootStatusFilter);
  else bootStatusFilter();
})();
