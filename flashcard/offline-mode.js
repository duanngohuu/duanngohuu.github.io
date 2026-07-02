(() => {
  const KEY = 'fc_offline_recent_lessons_v1';
  const MAX = 10;

  function getSaved() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
  }
  function setSaved(list) { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); }

  function upsertLesson(lesson, cards) {
    if (!lesson || !cards?.length) return;
    const item = { id: lesson.id, title: lesson.title, count: cards.length, savedAt: Date.now(), cards };
    const list = [item, ...getSaved().filter(x => x.id !== lesson.id)].slice(0, MAX);
    setSaved(list);
  }

  function buildUi() {
    if (!document.querySelector('#offlineBar')) {
      const bar = document.createElement('div');
      bar.id = 'offlineBar';
      bar.innerHTML = '<div><strong>Offline mode</strong><span> · dùng 10 bài đã lưu local</span></div><button type="button" id="offlineReloadBtn">Reload</button>';
      document.querySelector('.shell')?.prepend(bar);
      bar.querySelector('#offlineReloadBtn').onclick = () => location.reload();
    }
    if (!document.querySelector('#offlineMenu')) {
      const menu = document.createElement('section');
      menu.id = 'offlineMenu';
      menu.className = 'offline-menu';
      menu.innerHTML = '<h3>Offline lessons</h3><div id="offlineLessonList" class="offline-list"></div>';
      document.querySelector('main')?.prepend(menu);
    }
  }

  function renderOfflineList() {
    const box = document.querySelector('#offlineLessonList');
    if (!box) return;
    const list = getSaved();
    box.innerHTML = '';
    if (!list.length) {
      box.innerHTML = '<p class="card-note">Chưa có bài offline. Mở bài học khi có mạng trước để lưu local.</p>';
      return;
    }
    list.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'offline-lesson-btn';
      btn.innerHTML = `<strong>${item.title}</strong><span>${item.count} thẻ · đã lưu local</span>`;
      btn.onclick = () => loadOfflineLesson(item.id);
      box.appendChild(btn);
    });
  }

  function setOfflineMode(on) {
    document.body.classList.toggle('offline-mode', on);
    if (on) renderOfflineList();
  }

  function loadOfflineLesson(id) {
    const item = getSaved().find(x => x.id === id);
    if (!item || typeof st === 'undefined') return;
    st.lesson = { id: item.id, title: item.title, count: item.count, offline: true };
    st.cards = item.cards;
    st.session = [];
    st.i = 0;
    st.face = 0;
    st.done = false;
    if (e?.from) e.from.value = '1';
    if (e?.to) e.to.value = String(item.cards.length);
    if (e?.meta) e.meta.textContent = `${item.title} · offline · ${item.count} thẻ`;
    if (typeof loadProgress === 'function') loadProgress();
    if (typeof render === 'function') render();
    if (typeof log === 'function') log(`Offline lesson: ${item.title}`);
  }

  function hookApp() {
    if (typeof selectLesson === 'undefined' || typeof st === 'undefined') return setTimeout(hookApp, 160);
    const oldSelectLesson = selectLesson;
    selectLesson = async function selectLessonOfflineAware(id) {
      if (!navigator.onLine) return loadOfflineLesson(id);
      await oldSelectLesson(id);
      upsertLesson(st.lesson, st.cards);
      renderOfflineList();
    };

    const oldStart = start;
    start = function startOfflineAware() {
      if (st.lesson && st.cards?.length) upsertLesson(st.lesson, st.cards);
      return oldStart();
    };
    if (e?.start) e.start.onclick = start;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    setOfflineMode(!navigator.onLine);
    renderOfflineList();
  }

  buildUi();
  window.addEventListener('online', () => setOfflineMode(false));
  window.addEventListener('offline', () => setOfflineMode(true));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { buildUi(); hookApp(); });
  else hookApp();
})();
