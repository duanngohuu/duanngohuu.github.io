// Hierarchical textbook library: Book -> Level -> Subject -> Lessons.
(() => {
  try {
    if (window.__flashcardBookLibraryLoaded) return;
    window.__flashcardBookLibraryLoaded = true;
    if (!window.st || !window.e) return;
    const $ = selector => document.querySelector(selector);
    const MANIFEST_PATH = './data/books-manifest.json';
    const BOOK_TAB = 'books';
    const state = { manifest: null, dataByPath: new Map(), active: false, openKeys: new Set(['library:soumatome']), scrollTop: 0 };
    let manifestPromise = null;
    const originalSelectLesson = window.selectLesson;
    const originalSwitchCategory = window.switchFlashcardCategory;
    const originalGetCategoryState = window.getFlashcardCategoryState;
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const clean = value => String(value ?? '').trim();
    const escapeHtml = value => clean(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

    async function fetchJson(path) {
      const response = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Không tải được ${path}: ${response.status}`);
      return response.json();
    }
    function subjectEntries(manifest) {
      return (manifest?.libraries || []).flatMap(library => (library.levels || []).flatMap(level => (level.subjects || []).map(subject => ({ library, level, subject }))));
    }
    function enrichLesson(entry, lesson) {
      return { ...lesson, source: 'book-json', category: BOOK_TAB, courseId: `${entry.library.id}-${entry.level.id}-${entry.subject.id}`, courseTitle: `${entry.library.title} · ${entry.level.title} · ${entry.subject.title}`, bookId: entry.library.id, levelId: entry.level.id, subjectId: entry.subject.id, dataPath: lesson.dataPath || entry.subject.dataPath };
    }
    function flatCourses(manifest) {
      return subjectEntries(manifest).map(entry => ({ id: `${entry.library.id}-${entry.level.id}-${entry.subject.id}`, title: `${entry.library.title} · ${entry.level.title} · ${entry.subject.title}`, displayTitle: `${entry.library.title} · ${entry.level.title} · ${entry.subject.title}`, description: entry.subject.description || '', source: 'book-json', lessons: (entry.subject.lessons || []).map(lesson => enrichLesson(entry, lesson)) }));
    }
    async function loadManifest() {
      if (!manifestPromise) manifestPromise = fetchJson(MANIFEST_PATH).then(manifest => { state.manifest = manifest; return manifest; }).catch(error => { manifestPromise = null; throw error; });
      return manifestPromise;
    }
    async function loadSubjectData(path) {
      if (state.dataByPath.has(path)) return state.dataByPath.get(path);
      const data = await fetchJson(path);
      state.dataByPath.set(path, data);
      return data;
    }
    function ensureTab() {
      const tabs = $('.library-tabs');
      if (!tabs) return null;
      let button = $('.book-library-tab');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'book-library-tab';
        button.dataset.tab = BOOK_TAB;
        button.textContent = 'Sách';
        button.setAttribute('aria-label', 'Kho giáo trình');
        tabs.appendChild(button);
        button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); showBooks().catch(reportError); });
      }
      return button;
    }
    function setBookActive(active) {
      state.active = !!active;
      ensureTab()?.classList.toggle('active', state.active);
      if (state.active) document.querySelectorAll('.library-tab').forEach(tab => tab.classList.remove('active'));
    }
    function reportError(error) {
      try { window.err?.(error); } catch (_) {}
      const list = $('#lessonList');
      if (list && state.active) list.innerHTML = `<div class="book-library-error">${escapeHtml(error?.message || 'Không tải được kho giáo trình.')}</div>`;
    }
    function nodeButton({ key, eyebrow, title, meta, depth }) {
      const open = state.openKeys.has(key);
      return `<button class="book-node-toggle book-depth-${depth}" type="button" data-book-key="${escapeHtml(key)}" aria-expanded="${String(open)}"><span><small>${escapeHtml(eyebrow)}</small><strong>${escapeHtml(title)}</strong></span><em>${escapeHtml(meta)}</em><i aria-hidden="true">⌄</i></button>`;
    }
    function lessonHtml(lesson) {
      const active = st.lesson?.id === lesson.id;
      return `<button class="lesson-btn lesson-btn-grid book-lesson${active ? ' active' : ''}" type="button" data-book-lesson-id="${escapeHtml(lesson.id)}"><strong>${escapeHtml(lesson.title)}</strong><span class="lesson-progress-line"><span>${Number(lesson.count || 0)} thẻ</span><span>Tuần ${Number(lesson.week || 0)}</span><span>Ngày ${Number(lesson.day || 0)}</span></span></button>`;
    }
    function bindNodeToggles(list) {
      list.querySelectorAll('.book-node-toggle').forEach(button => button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const key = button.dataset.bookKey;
        const open = !state.openKeys.has(key);
        if (open) state.openKeys.add(key); else state.openKeys.delete(key);
        button.setAttribute('aria-expanded', String(open));
        const children = button.nextElementSibling;
        if (children) children.hidden = !open;
        state.scrollTop = $('.library-panel')?.scrollTop || 0;
        window.flashcardMenuSession?.capture?.();
      }));
    }
    function renderBooks() {
      const list = $('#lessonList');
      if (!list || !state.manifest) return;
      const savedTop = state.scrollTop;
      list.className = 'lesson-list book-library-list';
      list.innerHTML = '';
      const summary = $('.library-summary');
      if (summary) summary.textContent = 'Giáo trình → cấp độ → môn → bài học.';
      if (e.meta) e.meta.textContent = `${subjectEntries(state.manifest).reduce((sum, entry) => sum + (entry.subject.lessons?.length || 0), 0)} bài`;
      const empty = $('.empty-tab');
      if (empty) empty.style.display = 'none';
      (state.manifest.libraries || []).forEach(library => {
        const libraryKey = `library:${library.id}`;
        const libraryWrap = document.createElement('section');
        libraryWrap.className = 'book-tree-node book-library-node';
        const subjectCount = (library.levels || []).reduce((sum, level) => sum + (level.subjects?.length || 0), 0);
        libraryWrap.innerHTML = nodeButton({ key: libraryKey, eyebrow: 'Sách', title: library.title, meta: `${subjectCount} môn`, depth: 1 });
        const libraryChildren = document.createElement('div');
        libraryChildren.className = 'book-tree-children';
        libraryChildren.hidden = !state.openKeys.has(libraryKey);
        (library.levels || []).forEach(level => {
          const levelKey = `level:${library.id}:${level.id}`;
          const levelWrap = document.createElement('section');
          levelWrap.className = 'book-tree-node book-level-node';
          levelWrap.innerHTML = nodeButton({ key: levelKey, eyebrow: 'Cấp độ', title: level.title, meta: `${level.subjects?.length || 0} môn`, depth: 2 });
          const levelChildren = document.createElement('div');
          levelChildren.className = 'book-tree-children';
          levelChildren.hidden = !state.openKeys.has(levelKey);
          (level.subjects || []).forEach(subject => {
            const entry = { library, level, subject };
            const subjectKey = `subject:${library.id}:${level.id}:${subject.id}`;
            const subjectWrap = document.createElement('section');
            subjectWrap.className = 'book-tree-node book-subject-node';
            subjectWrap.innerHTML = nodeButton({ key: subjectKey, eyebrow: 'Môn', title: subject.title, meta: `${subject.lessons?.length || 0} bài`, depth: 3 });
            const lessons = document.createElement('div');
            lessons.className = 'book-tree-lessons';
            lessons.hidden = !state.openKeys.has(subjectKey);
            lessons.innerHTML = `<div class="book-quality-note"><strong>Soumatome N2</strong><span>Chọn JP–VI hoặc JP–EN trong màn hình học.</span></div>`;
            (subject.lessons || []).forEach(lesson => {
              const holder = document.createElement('div');
              holder.innerHTML = lessonHtml(lesson);
              const lessonButton = holder.firstElementChild;
              lessonButton.addEventListener('click', () => selectBookLesson(enrichLesson(entry, lesson)).catch(reportError));
              lessons.appendChild(lessonButton);
            });
            subjectWrap.appendChild(lessons);
            levelChildren.appendChild(subjectWrap);
          });
          levelWrap.appendChild(levelChildren);
          libraryChildren.appendChild(levelWrap);
        });
        libraryWrap.appendChild(libraryChildren);
        list.appendChild(libraryWrap);
      });
      bindNodeToggles(list);
      const panel = $('.library-panel');
      if (panel) { panel.scrollTop = savedTop; requestAnimationFrame(() => { panel.scrollTop = savedTop; }); }
      window.flashcardMenuSession?.capture?.();
    }
    async function showBooks() {
      ensureTab();
      const panel = $('.library-panel');
      if (state.active && panel) state.scrollTop = panel.scrollTop;
      await loadManifest();
      setBookActive(true);
      renderBooks();
      return flatCourses(state.manifest);
    }
    function deactivateBooks() {
      if (state.active) { const panel = $('.library-panel'); if (panel) state.scrollTop = panel.scrollTop; }
      setBookActive(false);
    }
    function findBookLesson(id) {
      if (!state.manifest) return null;
      for (const entry of subjectEntries(state.manifest)) {
        const lesson = (entry.subject.lessons || []).find(item => item.id === id);
        if (lesson) return { entry, lesson: enrichLesson(entry, lesson) };
      }
      return null;
    }
    async function selectBookLesson(lessonInput) {
      const lessonId = typeof lessonInput === 'string' ? lessonInput : lessonInput?.id;
      await loadManifest();
      const found = findBookLesson(lessonId);
      if (!found) throw new Error('Không tìm thấy bài trong kho giáo trình.');
      const { entry, lesson } = found;
      const data = await loadSubjectData(lesson.dataPath);
      const payloadLesson = (data.lessons || []).find(item => item.id === lesson.id);
      if (!payloadLesson) throw new Error('Không tìm thấy dữ liệu thẻ của bài này.');
      st.lessons = (entry.subject.lessons || []).map(item => enrichLesson(entry, item));
      st.lesson = { ...lesson, title: payloadLesson.title || lesson.title, count: payloadLesson.cards?.length || lesson.count || 0 };
      st.cards = (payloadLesson.cards || []).map((card, index) => ({ ...card, no: Number(card.no || index + 1), id: card.id || `${lesson.id}-${index + 1}`, faces: (card.faces || []).filter(face => clean(face?.text)) }));
      st.session = []; st.i = 0; st.face = 0; st.done = false; st.finishShown = false; st.multiFaceMode = true;
      if (e.from) e.from.value = 1;
      if (e.to) e.to.value = st.cards.length;
      if (e.meta) e.meta.textContent = `${st.lesson.title} · ${st.cards.length} thẻ`;
      document.querySelectorAll('.lesson-btn').forEach(button => { const id = button.dataset.bookLessonId || button.dataset.lessonId; button.classList.toggle('active', id === lesson.id); });
      try { await window.flashcardBookStudy?.enrichLesson?.(st.cards, st.lesson); } catch (_) {}
      try { window.loadProgress?.(); } catch (_) {}
      try { window.saveLast?.(); } catch (_) {}
      try { window.render?.(); } catch (_) {}
      document.body.classList.remove('library-open');
      state.scrollTop = $('.library-panel')?.scrollTop || state.scrollTop;
      return st.lesson;
    }
    window.switchFlashcardCategory = async function switchCategoryWithBooks(tab) { if (tab === BOOK_TAB) return showBooks(); deactivateBooks(); return originalSwitchCategory?.(tab); };
    window.getFlashcardCategoryState = function categoryStateWithBooks() { const original = originalGetCategoryState?.() || {}; return { ...original, books: { loaded: !!state.manifest, courses: state.manifest ? flatCourses(state.manifest) : [], summary: 'Kho giáo trình theo Sách → Cấp độ → Môn → Bài.' } }; };
    window.selectLesson = async function selectLessonWithBooks(id) { await loadManifest().catch(() => null); if (findBookLesson(id)) return selectBookLesson(id); return originalSelectLesson?.(id); };
    document.addEventListener('click', event => { if (event.target.closest('.library-tab')) deactivateBooks(); }, true);
    const panel = $('.library-panel');
    panel?.addEventListener('scroll', () => { if (state.active) state.scrollTop = panel.scrollTop; }, { passive: true });
    async function boot() {
      for (let attempt = 0; attempt < 200; attempt += 1) {
        if ($('.library-tabs') && $('#lessonList')) {
          ensureTab();
          loadManifest().catch(() => {});
          window.flashcardBookLibrary = { version: 3, show: showBooks, selectLesson: selectBookLesson, state, loadManifest };
          return;
        }
        await wait(25);
      }
    }
    boot();
  } catch (error) {
    try { console.warn('[book-library disabled]', error); } catch (_) {}
  }
})();