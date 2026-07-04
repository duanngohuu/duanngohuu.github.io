// Unified learning navigation: exact resume, recent tab and search across every library source.
(() => {
  try {
    if (!window.st || !window.e) return;

    const $ = selector => document.querySelector(selector);
    const RECENT_KEY = 'fc_library_recent_v1';
    const RESUME_KEY = 'fc_library_resume_v1';
    const MAX_RECENT = 8;
    const COURSE_CACHE_PREFIX = window.sheetOfflineKeys?.coursePrefix || 'sheet-course:';

    let saveTimer = 0;
    let menuSearchTimer = 0;
    let mainSearchTimer = 0;
    let menuSearchToken = 0;
    let mainSearchToken = 0;
    let catalogPromise = null;
    let arranging = false;
    let restoring = false;
    let recentRendering = false;

    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const clone = value => {
      try { return structuredClone(value); }
      catch (_) { return JSON.parse(JSON.stringify(value)); }
    };
    const readJson = (key, fallback) => {
      try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
      catch (_) { return fallback; }
    };
    const writeJson = (key, value) => {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
    };
    const normalize = value => String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/ok@(tv|np|bun)/gi, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const cleanCourseTitle = course => String(course?.displayTitle || course?.title || '')
      .replace(/^OK@(TV|NP|BUN)\s*/i, '')
      .trim();

    function getState() {
      try { return window.getFlashcardCategoryState?.() || {}; }
      catch (_) { return {}; }
    }

    function stateCourses() {
      return Object.entries(getState()).flatMap(([tab, data]) =>
        (data?.courses || []).map(course => ({ tab, course }))
      );
    }

    function currentTab() {
      const active = $('.library-tab.active')?.dataset.tab;
      if (active && active !== 'recent') return active;
      if (st.lesson?.source === 'google-sheet') return 'sheet';
      return st.lesson?.category || 'vocab';
    }

    function findCourse(courseId, tabHint = '') {
      const all = stateCourses();
      return all.find(item => item.course.id === courseId && (!tabHint || item.tab === tabHint))
        || all.find(item => item.course.id === courseId)
        || null;
    }

    function findLesson(lessonId, courseId = '', tabHint = '') {
      for (const item of stateCourses()) {
        if (tabHint && item.tab !== tabHint) continue;
        if (courseId && item.course.id !== courseId) continue;
        const lesson = (item.course.lessons || []).find(candidate => candidate.id === lessonId);
        if (lesson) return { ...item, lesson };
      }
      for (const item of stateCourses()) {
        const lesson = (item.course.lessons || []).find(candidate => candidate.id === lessonId);
        if (lesson) return { ...item, lesson };
      }
      return null;
    }

    function lessonSnapshot(lesson) {
      if (!lesson) return null;
      const snapshot = clone(lesson);
      delete snapshot._rows;
      delete snapshot._lessonsReady;
      return snapshot;
    }

    function resumeSnapshot() {
      if (!st.lesson || !st.cards?.length) return null;
      const currentCard = st.session?.[st.i];
      return {
        lessonId: st.lesson.id,
        courseId: st.lesson.courseId || '',
        courseTitle: st.lesson.courseTitle || st.lesson.sheetGroupLabel || '',
        title: st.lesson.title || '',
        tab: st.lesson.source === 'google-sheet' ? 'sheet' : currentTab(),
        source: st.lesson.source || 'local',
        lesson: lessonSnapshot(st.lesson),
        from: e.from?.value || '1',
        to: e.to?.value || String(st.cards.length),
        limit: e.limit?.value || '10',
        shuffle: !!e.shuffle?.checked,
        sessionCardIds: (st.session || []).map(card => card.id),
        sessionNos: (st.session || []).map(card => card.no),
        currentCardId: currentCard?.id || '',
        index: Number(st.i) || 0,
        face: Number(st.face) || 0,
        featureFilter: st.featureFilter || 'all',
        started: !!st.session?.length,
        totalCards: st.cards.length,
        savedAt: new Date().toISOString()
      };
    }

    function recentEntries() {
      return readJson(RECENT_KEY, [])
        .filter(item => item?.lessonId && item?.lesson)
        .slice(0, MAX_RECENT);
    }

    function updateRecent(snapshot) {
      if (!snapshot?.lessonId) return;
      const entry = {
        lessonId: snapshot.lessonId,
        courseId: snapshot.courseId,
        courseTitle: snapshot.courseTitle,
        title: snapshot.title,
        tab: snapshot.tab,
        source: snapshot.source,
        lesson: snapshot.lesson,
        totalCards: snapshot.totalCards,
        lastIndex: snapshot.index,
        sessionLength: snapshot.sessionCardIds?.length || 0,
        openedAt: snapshot.savedAt
      };
      const next = [entry, ...recentEntries().filter(item => item.lessonId !== entry.lessonId)].slice(0, MAX_RECENT);
      writeJson(RECENT_KEY, next);
    }

    function saveCurrentState() {
      if (restoring) return;
      const snapshot = resumeSnapshot();
      if (!snapshot) return;
      writeJson(RESUME_KEY, snapshot);
      updateRecent(snapshot);
      renderContinueButton();
      if ($('.library-tab[data-tab="recent"].active')) renderRecentTab();
    }

    function scheduleSave(delay = 160) {
      if (restoring) return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveCurrentState, delay);
    }

    function ensureRecentTab() {
      const tabs = $('.library-tabs');
      if (!tabs) return null;
      let button = tabs.querySelector('.library-tab[data-tab="recent"]');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'library-tab';
        button.dataset.tab = 'recent';
        button.textContent = 'Gần đây';
      }
      const sheet = tabs.querySelector('.library-tab[data-tab="sheet"]');
      if (sheet && button.nextElementSibling !== sheet) tabs.insertBefore(button, sheet);
      else if (!sheet && button.parentElement !== tabs) tabs.prepend(button);
      return button;
    }

    function ensureMenuUi() {
      const panel = $('.library-panel');
      const tabs = panel?.querySelector('.library-tabs');
      if (!panel || !tabs) return false;
      ensureRecentTab();

      let continueButton = $('#continueLastBtn');
      if (!continueButton) {
        continueButton = document.createElement('button');
        continueButton.id = 'continueLastBtn';
        continueButton.className = 'continue-last hidden';
        continueButton.type = 'button';
        continueButton.innerHTML = '<span class="continue-icon">▶</span><span class="continue-copy"><strong>Tiếp tục học</strong><small id="continueLastText"></small></span><span class="continue-arrow">→</span>';
        continueButton.onclick = continueLast;
      }

      let searchBox = $('#librarySearchInput')?.closest('.library-search-box');
      if (!searchBox) {
        searchBox = document.createElement('div');
        searchBox.className = 'library-search-box';
        searchBox.innerHTML = '<span aria-hidden="true">⌕</span><input id="librarySearchInput" type="search" autocomplete="off" placeholder="Tìm bộ hoặc bài học…" aria-label="Tìm bài học"><button id="librarySearchClear" class="hidden" type="button" aria-label="Xóa tìm kiếm">×</button>';
        searchBox.querySelector('input').addEventListener('input', event => {
          clearTimeout(menuSearchTimer);
          menuSearchTimer = setTimeout(() => renderMenuSearch(event.target.value), 100);
        });
        searchBox.querySelector('button').onclick = () => {
          const input = $('#librarySearchInput');
          if (input) input.value = '';
          renderMenuSearch('');
          input?.focus();
        };
      }

      let results = $('#librarySearchResults');
      if (!results) {
        results = document.createElement('div');
        results.id = 'librarySearchResults';
        results.className = 'library-search-results hidden';
      }

      const oldTools = $('#libraryTools');
      const oldRecent = $('#recentLessonsWrap');
      oldRecent?.remove();

      if (continueButton.nextElementSibling !== searchBox) panel.insertBefore(continueButton, tabs);
      if (searchBox.nextElementSibling !== results) panel.insertBefore(searchBox, tabs);
      if (results.nextElementSibling !== tabs) panel.insertBefore(results, tabs);
      if (oldTools && !oldTools.children.length) oldTools.remove();

      renderContinueButton();
      return true;
    }

    function ensureMainSearchUi() {
      const setupPanel = $('#startBtn')?.closest('.panel');
      const titleRow = setupPanel?.querySelector('.title-row');
      if (!setupPanel || !titleRow) return false;
      let root = $('#mainQuickSearch');
      if (root) return true;

      root = document.createElement('section');
      root.id = 'mainQuickSearch';
      root.className = 'main-quick-search';
      root.innerHTML = '<label><span aria-hidden="true">⌕</span><input id="mainQuickSearchInput" type="search" autocomplete="off" placeholder="Tìm bài và học ngay…" aria-label="Tìm nhanh bài học"><button id="mainQuickSearchClear" class="hidden" type="button" aria-label="Xóa tìm kiếm">×</button></label><div id="mainQuickSearchResults" class="main-quick-results hidden"></div>';
      titleRow.after(root);

      $('#mainQuickSearchInput').addEventListener('input', event => {
        clearTimeout(mainSearchTimer);
        mainSearchTimer = setTimeout(() => renderMainSearch(event.target.value), 100);
      });
      $('#mainQuickSearchClear').onclick = () => {
        const input = $('#mainQuickSearchInput');
        if (input) input.value = '';
        renderMainSearch('');
        input?.focus();
      };
      return true;
    }

    function arrangeUi() {
      if (arranging) return;
      arranging = true;
      try {
        ensureMenuUi();
        ensureMainSearchUi();
      } finally {
        arranging = false;
      }
    }

    function renderContinueButton() {
      const button = $('#continueLastBtn');
      const text = $('#continueLastText');
      if (!button || !text) return;
      const resume = readJson(RESUME_KEY, null);
      button.classList.toggle('hidden', !resume?.lessonId);
      if (!resume?.lessonId) return;
      const length = resume.sessionCardIds?.length || 0;
      const progress = length ? ` · thẻ ${Math.min((resume.index || 0) + 1, length)}/${length}` : '';
      text.textContent = `${resume.title || 'Bài gần nhất'}${progress}`;
    }

    async function loadManifestCourses(path, tab) {
      try {
        const response = await fetch(`${path}?catalog=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return [];
        const manifest = await response.json();
        return (manifest.courses || []).map(course => ({ tab, course }));
      } catch (_) {
        return [];
      }
    }

    async function loadSheetCatalogFallback() {
      try {
        const config = await window.loadSheetLibraryConfig?.();
        return (config?.courses || []).map(course => ({ tab: 'sheet', course }));
      } catch (_) {
        return [];
      }
    }

    async function hydrateCachedSheetLessons(items) {
      const offline = window.flashcardOffline;
      if (!offline?.getLibrary) return items;
      await Promise.all(items.map(async item => {
        if (item.tab !== 'sheet' || item.course.lessons?.length || !item.course.id) return;
        try {
          const cached = await offline.getLibrary(COURSE_CACHE_PREFIX + item.course.id);
          if (cached?.lessons?.length) item.course.lessons = clone(cached.lessons);
        } catch (_) {}
      }));
      return items;
    }

    async function buildCatalog(force = false) {
      if (catalogPromise && !force) return catalogPromise;
      catalogPromise = (async () => {
        const [vocab, grammar, sheetFallback] = await Promise.all([
          loadManifestCourses('./data/manifest.json', 'vocab'),
          loadManifestCourses('./data/n2-grammar-manifest.json', 'grammar'),
          loadSheetCatalogFallback()
        ]);
        const candidates = await hydrateCachedSheetLessons([
          ...stateCourses(),
          ...sheetFallback,
          ...vocab,
          ...grammar
        ]);
        const map = new Map();
        candidates.forEach(item => {
          const id = `${item.tab}:${item.course.id || item.course.title}`;
          const previous = map.get(id);
          if (!previous || (item.course.lessons?.length || 0) > (previous.course.lessons?.length || 0)) map.set(id, item);
        });
        return [...map.values()];
      })();
      return catalogPromise;
    }

    function labelFor(tab, course, lesson) {
      if (tab === 'sheet') return lesson?.sheetGroupLabel || course?.sheetGroupLabel || 'Kho học';
      if (tab === 'vocab') return 'Từ vựng';
      if (tab === 'grammar') return 'Ngữ pháp';
      if (tab === 'kanji') return 'Kanji';
      return 'Bài học';
    }

    async function searchCatalog(query) {
      const needle = normalize(query);
      if (!needle) return [];
      const courses = await buildCatalog();
      const results = [];
      const lessonIds = new Set();

      recentEntries().forEach(item => {
        if (!normalize(`${item.title} ${item.courseTitle} gần đây`).includes(needle)) return;
        lessonIds.add(item.lessonId);
        results.push({
          type: 'lesson', tab: item.tab || 'sheet', courseId: item.courseId,
          courseTitle: item.courseTitle, title: item.title, lessonId: item.lessonId,
          lesson: item.lesson, label: 'Gần đây', recent: true
        });
      });

      courses.forEach(({ tab, course }) => {
        const title = cleanCourseTitle(course);
        const group = labelFor(tab, course);
        if (normalize(`${title} ${group}`).includes(needle)) {
          results.push({ type: 'course', tab, courseId: course.id, courseTitle: title, title, course, label: group });
        }
        (course.lessons || []).forEach(lesson => {
          if (lessonIds.has(lesson.id)) return;
          if (!normalize(`${lesson.title} ${title} ${group}`).includes(needle)) return;
          lessonIds.add(lesson.id);
          results.push({
            type: 'lesson', tab, courseId: course.id, courseTitle: title,
            title: lesson.title, lessonId: lesson.id, lesson, course,
            label: labelFor(tab, course, lesson)
          });
        });
      });

      return results
        .sort((a, b) => (a.type === 'lesson' ? 0 : 1) - (b.type === 'lesson' ? 0 : 1))
        .slice(0, 18);
    }

    function createResultButton(item, actionText, className) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = className;
      const copy = document.createElement('span');
      const strong = document.createElement('strong');
      const small = document.createElement('small');
      const action = document.createElement('em');
      strong.textContent = item.title || 'Bài học';
      small.textContent = item.courseTitle || item.label || 'Bài học';
      action.textContent = actionText;
      copy.append(strong, small);
      button.append(copy, action);
      return button;
    }

    async function ensureCourse(item) {
      const tab = item.tab || 'sheet';
      if (tab === 'recent') return null;
      if (typeof window.switchFlashcardCategory === 'function') await window.switchFlashcardCategory(tab);
      await wait(0);
      return findCourse(item.courseId, tab)?.course || item.course || null;
    }

    async function ensureCourseLessons(item) {
      const course = await ensureCourse(item);
      if (!course) return item.lesson ? [item.lesson] : [];
      if (course.lessons?.length) return course.lessons;
      if (item.tab === 'sheet' && typeof window.ensureSheetCourseLessons === 'function') {
        const lessons = await window.ensureSheetCourseLessons(course);
        course.lessons = lessons || [];
        course._lessonsReady = !!course.lessons.length;
        catalogPromise = null;
        return course.lessons;
      }
      return [];
    }

    async function waitForCards(lessonId, timeoutMs = 10000) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        if (st.lesson?.id === lessonId && st.cards?.length) return true;
        await wait(80);
      }
      return false;
    }

    async function selectLessonItem(item, { startNow = false, closeMenu = true } = {}) {
      const lessons = await ensureCourseLessons(item);
      const lesson = lessons.find(candidate => candidate.id === (item.lessonId || item.lesson?.id))
        || item.lesson
        || lessons[0];
      if (!lesson) throw new Error('Không tìm thấy bài học.');
      st.lessons = lessons.length ? lessons : [lesson];
      await window.selectLesson?.(lesson.id);
      if (!await waitForCards(lesson.id)) throw new Error('Không tải được nội dung bài học.');
      if (startNow) e.start?.click();
      if (closeMenu) document.body.classList.remove('library-open');
      scheduleSave(0);
      return lesson;
    }

    async function openCourse(item) {
      const course = await ensureCourse(item);
      if (!course) throw new Error('Không tìm thấy bộ học.');
      await wait(0);
      const block = [...document.querySelectorAll('#lessonList .course-block')]
        .find(node => node.dataset.courseId === course.id);
      if (!block) return;
      const button = block.querySelector(':scope > .course-btn');
      button?.click();
    }

    async function renderMenuSearch(query) {
      arrangeUi();
      const results = $('#librarySearchResults');
      const clear = $('#librarySearchClear');
      const needle = normalize(query);
      const token = ++menuSearchToken;
      clear?.classList.toggle('hidden', !needle);
      if (!needle) {
        results?.classList.add('hidden');
        if (results) results.innerHTML = '';
        return;
      }
      results?.classList.remove('hidden');
      if (results) results.innerHTML = '<div class="library-search-empty">Đang tìm…</div>';
      const matches = await searchCatalog(query);
      if (token !== menuSearchToken || normalize($('#librarySearchInput')?.value) !== needle) return;
      results.innerHTML = '';
      if (!matches.length) {
        results.innerHTML = '<div class="library-search-empty">Không tìm thấy bài phù hợp.</div>';
        return;
      }
      matches.forEach(item => {
        const actionText = item.type === 'lesson' ? 'Học ngay' : 'Chọn bài';
        const button = createResultButton(item, actionText, 'library-search-result');
        button.onclick = async () => {
          button.classList.add('is-loading');
          try {
            if (item.type === 'lesson') await selectLessonItem(item, { startNow: true });
            else await openCourse(item);
            const input = $('#librarySearchInput');
            if (input) input.value = '';
            renderMenuSearch('');
          } catch (error) {
            try { window.err?.(error); } catch (_) {}
          } finally {
            button.classList.remove('is-loading');
          }
        };
        results.appendChild(button);
      });
    }

    async function showMainCourseLessons(item, container, sourceButton) {
      sourceButton?.classList.add('is-loading');
      try {
        const lessons = await ensureCourseLessons(item);
        container.innerHTML = '';
        if (!lessons.length) {
          container.innerHTML = '<div class="main-quick-empty">Bộ này chưa có bài học.</div>';
          return;
        }
        const heading = document.createElement('div');
        heading.className = 'main-quick-course-head';
        heading.textContent = `Chọn bài trong ${item.courseTitle || item.title}`;
        container.appendChild(heading);
        lessons.slice(0, 60).forEach(lesson => {
          const lessonItem = { ...item, type: 'lesson', lessonId: lesson.id, lesson, title: lesson.title };
          const button = createResultButton(lessonItem, 'Học ngay', 'main-quick-result');
          button.onclick = async () => {
            button.classList.add('is-loading');
            try {
              await selectLessonItem(lessonItem, { startNow: true });
              clearMainSearch();
            } catch (error) {
              try { window.err?.(error); } catch (_) {}
            } finally {
              button.classList.remove('is-loading');
            }
          };
          container.appendChild(button);
        });
      } catch (error) {
        container.innerHTML = `<div class="main-quick-empty">${error?.message || 'Không tải được danh sách bài.'}</div>`;
      } finally {
        sourceButton?.classList.remove('is-loading');
      }
    }

    function clearMainSearch() {
      const input = $('#mainQuickSearchInput');
      const results = $('#mainQuickSearchResults');
      if (input) input.value = '';
      $('#mainQuickSearchClear')?.classList.add('hidden');
      results?.classList.add('hidden');
      if (results) results.innerHTML = '';
    }

    async function renderMainSearch(query) {
      ensureMainSearchUi();
      const results = $('#mainQuickSearchResults');
      const clear = $('#mainQuickSearchClear');
      const needle = normalize(query);
      const token = ++mainSearchToken;
      clear?.classList.toggle('hidden', !needle);
      if (!needle) {
        results?.classList.add('hidden');
        if (results) results.innerHTML = '';
        return;
      }
      results?.classList.remove('hidden');
      if (results) results.innerHTML = '<div class="main-quick-empty">Đang tìm…</div>';
      const matches = await searchCatalog(query);
      if (token !== mainSearchToken || normalize($('#mainQuickSearchInput')?.value) !== needle) return;
      results.innerHTML = '';
      if (!matches.length) {
        results.innerHTML = '<div class="main-quick-empty">Không tìm thấy bài phù hợp.</div>';
        return;
      }
      matches.forEach(item => {
        const button = createResultButton(item, item.type === 'lesson' ? 'Học ngay' : 'Chọn bài', 'main-quick-result');
        button.onclick = async () => {
          if (item.type === 'course') {
            await showMainCourseLessons(item, results, button);
            return;
          }
          button.classList.add('is-loading');
          try {
            await selectLessonItem(item, { startNow: true });
            clearMainSearch();
          } catch (error) {
            try { window.err?.(error); } catch (_) {}
          } finally {
            button.classList.remove('is-loading');
          }
        };
        results.appendChild(button);
      });
    }

    function renderRecentTab() {
      if (recentRendering) return;
      recentRendering = true;
      try {
        arrangeUi();
        document.querySelectorAll('.library-tab').forEach(button =>
          button.classList.toggle('active', button.dataset.tab === 'recent')
        );
        const list = e.list || $('#lessonList');
        if (!list) return;
        const recent = recentEntries();
        list.className = 'lesson-list recent-tab-list';
        list.style.display = 'grid';
        list.innerHTML = '';
        const summary = $('.library-summary');
        if (summary) summary.textContent = 'Các bài vừa học, mới nhất ở trên.';
        if (e.meta) e.meta.textContent = `${recent.length} bài`;
        if (!recent.length) {
          list.innerHTML = '<div class="recent-tab-empty"><strong>Chưa có bài gần đây</strong><span>Mở một bài học để bắt đầu lưu lịch sử.</span></div>';
          return;
        }
        recent.forEach(item => {
          const total = item.sessionLength || item.totalCards || 0;
          const current = item.sessionLength ? Math.min((item.lastIndex || 0) + 1, item.sessionLength) : 0;
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'recent-tab-item';
          const copy = document.createElement('span');
          const strong = document.createElement('strong');
          const small = document.createElement('small');
          const progress = document.createElement('em');
          strong.textContent = item.title || 'Bài học';
          small.textContent = item.courseTitle || 'Bài học';
          progress.textContent = item.sessionLength ? `Thẻ ${current}/${total}` : `${total} thẻ`;
          copy.append(strong, small);
          button.append(copy, progress);
          button.onclick = async () => {
            button.classList.add('is-loading');
            try {
              await selectLessonItem({
                type: 'lesson', tab: item.tab || 'sheet', courseId: item.courseId,
                lessonId: item.lessonId, lesson: item.lesson, courseTitle: item.courseTitle
              }, { startNow: true });
            } catch (error) {
              try { window.err?.(error); } catch (_) {}
            } finally {
              button.classList.remove('is-loading');
            }
          };
          list.appendChild(button);
        });
      } finally {
        recentRendering = false;
      }
    }

    async function continueLast() {
      const resume = readJson(RESUME_KEY, null);
      if (!resume?.lessonId || !resume.lesson) return;
      const button = $('#continueLastBtn');
      button?.classList.add('is-loading');
      restoring = true;
      try {
        await selectLessonItem({
          type: 'lesson', tab: resume.tab || 'sheet', courseId: resume.courseId,
          lessonId: resume.lessonId, lesson: resume.lesson, courseTitle: resume.courseTitle
        }, { startNow: false, closeMenu: false });

        if (e.from) e.from.value = resume.from || 1;
        if (e.to) e.to.value = resume.to || st.cards.length;
        if (e.limit) e.limit.value = resume.limit || '10';
        if (e.shuffle) e.shuffle.checked = !!resume.shuffle;

        if (resume.started) {
          const byId = new Map(st.cards.map(card => [card.id, card]));
          const byNo = new Map(st.cards.map(card => [String(card.no), card]));
          let session = (resume.sessionCardIds || []).map(id => byId.get(id)).filter(Boolean);
          if (!session.length) session = (resume.sessionNos || []).map(no => byNo.get(String(no))).filter(Boolean);
          if (!session.length) session = typeof window.buildSession === 'function' ? window.buildSession() : st.cards.slice(0, 10);
          st.session = session;
          const currentIndex = resume.currentCardId ? session.findIndex(card => card.id === resume.currentCardId) : -1;
          st.i = Math.max(0, Math.min(currentIndex >= 0 ? currentIndex : Number(resume.index) || 0, Math.max(0, session.length - 1)));
          const faceCount = session[st.i]?.faces?.length || 2;
          st.face = Math.max(0, Math.min(Number(resume.face) || 0, faceCount - 1));
          st.featureFilter = resume.featureFilter || 'all';
          st.done = false;
          st.finishShown = false;
          window.render?.();
        }
        document.body.classList.remove('library-open');
      } catch (error) {
        try { window.err?.(error); } catch (_) {}
      } finally {
        restoring = false;
        button?.classList.remove('is-loading');
        scheduleSave(0);
      }
    }

    function bindTracking() {
      const baseSelectLesson = window.selectLesson;
      if (typeof baseSelectLesson === 'function' && !baseSelectLesson.__libraryExperienceWrapped) {
        window.selectLesson = async function trackedSelectLesson(id) {
          const result = await baseSelectLesson(id);
          scheduleSave(100);
          setTimeout(() => scheduleSave(0), 850);
          return result;
        };
        window.selectLesson.__libraryExperienceWrapped = true;
      }

      const baseRender = window.render;
      if (typeof baseRender === 'function' && !baseRender.__libraryExperienceWrapped) {
        window.render = function trackedRender() {
          const result = baseRender();
          scheduleSave();
          return result;
        };
        window.render.__libraryExperienceWrapped = true;
      }

      document.addEventListener('change', event => {
        if (event.target.closest('#fromInput,#toInput,#limitSelect,#shuffleInput')) scheduleSave(0);
      }, true);
      document.addEventListener('click', event => {
        if (event.target.closest('#startBtn,#knownBtn,#againBtn,#prevBtn,#nextBtn,#flipBtn,#card,#posText,#knownText,#againText,.lesson-btn')) scheduleSave(220);
      }, true);
    }

    // Window capture runs before the category loader's document capture listener.
    window.addEventListener('click', event => {
      const recentTab = event.target.closest?.('.library-tab[data-tab="recent"]');
      if (!recentTab) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      renderRecentTab();
    }, true);

    document.addEventListener('click', event => {
      const tab = event.target.closest?.('.library-tab:not([data-tab="recent"])');
      if (!tab) return;
      e.list?.classList.remove('recent-tab-list');
      setTimeout(arrangeUi, 0);
    }, true);

    const panel = $('.library-panel');
    if (panel) {
      new MutationObserver(() => requestAnimationFrame(arrangeUi))
        .observe(panel, { childList: true, subtree: true });
    }

    window.addEventListener('sheet-config-updated', () => {
      catalogPromise = null;
      arrangeUi();
    });

    arrangeUi();
    bindTracking();
    renderContinueButton();

    window.flashcardLibraryTools = {
      continueLast,
      recent: recentEntries,
      renderRecent: renderRecentTab,
      searchMenu: renderMenuSearch,
      searchMain: renderMainSearch,
      refreshCatalog: () => { catalogPromise = null; return buildCatalog(true); },
      save: saveCurrentState,
      arrange: arrangeUi
    };
  } catch (error) {
    try { console.warn('[library-tools disabled]', error); } catch (_) {}
  }
})();
