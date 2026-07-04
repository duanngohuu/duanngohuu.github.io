// Search, recent lessons, and exact continue/resume for every library source.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = selector => document.querySelector(selector);
    const RECENT_KEY = 'fc_library_recent_v1';
    const RESUME_KEY = 'fc_library_resume_v1';
    const MAX_RECENT = 8;
    let saveTimer = 0;
    let renderingTools = false;

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
      .replace(/\s+/g, ' ')
      .trim();
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    function getState() {
      return window.getFlashcardCategoryState?.() || {};
    }

    function currentTab() {
      return $('.library-tab.active')?.dataset.tab || 'sheet';
    }

    function allCourses() {
      const state = getState();
      return Object.entries(state).flatMap(([tab, data]) => (data.courses || []).map(course => ({ tab, course })));
    }

    function findCourse(courseId, tabHint = '') {
      const courses = allCourses();
      return courses.find(item => item.course.id === courseId && (!tabHint || item.tab === tabHint))
        || courses.find(item => item.course.id === courseId)
        || null;
    }

    function findLesson(lessonId) {
      for (const item of allCourses()) {
        const lesson = (item.course.lessons || []).find(candidate => candidate.id === lessonId);
        if (lesson) return { ...item, lesson };
      }
      return null;
    }

    function safeLessonSnapshot(lesson) {
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
        lesson: safeLessonSnapshot(st.lesson),
        from: e.from?.value || '1',
        to: e.to?.value || String(st.cards.length),
        limit: e.limit?.value || '10',
        shuffle: !!e.shuffle?.checked,
        sessionCardIds: (st.session || []).map(card => card.id),
        sessionNos: (st.session || []).map(card => card.no),
        currentCardId: currentCard?.id || '',
        index: st.i || 0,
        face: st.face || 0,
        featureFilter: st.featureFilter || 'all',
        started: !!st.session?.length,
        totalCards: st.cards.length,
        savedAt: new Date().toISOString()
      };
    }

    function recentEntries() {
      return readJson(RECENT_KEY, []).filter(item => item?.lessonId && item?.lesson);
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
      const snapshot = resumeSnapshot();
      if (!snapshot) return;
      writeJson(RESUME_KEY, snapshot);
      updateRecent(snapshot);
      renderTools();
    }

    function scheduleSave(delay = 180) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveCurrentState, delay);
    }

    function ensureUi() {
      const panel = $('.library-panel');
      const summary = panel?.querySelector('.library-summary');
      if (!panel || !summary) return null;
      let tools = $('#libraryTools');
      if (!tools) {
        tools = document.createElement('section');
        tools.id = 'libraryTools';
        tools.className = 'library-tools';
        tools.innerHTML = `
          <button id="continueLastBtn" class="continue-last hidden" type="button">
            <span class="continue-icon">▶</span>
            <span class="continue-copy"><strong>Tiếp tục học</strong><small id="continueLastText"></small></span>
            <span class="continue-arrow">→</span>
          </button>
          <div class="library-search-box">
            <span aria-hidden="true">⌕</span>
            <input id="librarySearchInput" type="search" autocomplete="off" placeholder="Tìm bộ hoặc bài học…" aria-label="Tìm bài học">
            <button id="librarySearchClear" class="hidden" type="button" aria-label="Xóa tìm kiếm">×</button>
          </div>
          <div id="librarySearchResults" class="library-search-results hidden"></div>
          <div id="recentLessonsWrap" class="recent-lessons-wrap hidden">
            <div class="recent-lessons-head"><strong>Học gần đây</strong><button id="clearRecentLessons" type="button">Xóa</button></div>
            <div id="recentLessons" class="recent-lessons"></div>
          </div>`;
        summary.after(tools);

        $('#librarySearchInput').addEventListener('input', event => renderSearch(event.target.value));
        $('#librarySearchClear').onclick = () => {
          const input = $('#librarySearchInput');
          input.value = '';
          renderSearch('');
          input.focus();
        };
        $('#continueLastBtn').onclick = continueLast;
        $('#clearRecentLessons').onclick = () => {
          writeJson(RECENT_KEY, []);
          renderTools();
        };
      }
      return tools;
    }

    function labelFor(tab, course, lesson) {
      if (tab === 'sheet') return lesson?.sheetGroupLabel || course?.sheetGroupLabel || 'Kho học';
      if (tab === 'vocab') return 'Từ vựng';
      if (tab === 'grammar') return 'Ngữ pháp';
      if (tab === 'kanji') return 'Kanji';
      return 'Bài học';
    }

    function collectSearchIndex() {
      const output = [];
      const lessonIds = new Set();
      for (const { tab, course } of allCourses()) {
        const courseTitle = course.displayTitle || course.title || '';
        output.push({ type: 'course', tab, courseId: course.id, title: courseTitle, subtitle: labelFor(tab, course), search: normalize(`${courseTitle} ${course.sheetGroupLabel || ''}`) });
        for (const lesson of course.lessons || []) {
          lessonIds.add(lesson.id);
          output.push({
            type: 'lesson', tab, courseId: course.id, lessonId: lesson.id,
            title: lesson.title || '', subtitle: courseTitle, label: labelFor(tab, course, lesson), lesson,
            search: normalize(`${lesson.title} ${courseTitle} ${lesson.sheetGroupLabel || course.sheetGroupLabel || ''}`)
          });
        }
      }
      for (const recent of recentEntries()) {
        if (lessonIds.has(recent.lessonId)) continue;
        output.push({
          type: 'lesson', tab: recent.tab, courseId: recent.courseId, lessonId: recent.lessonId,
          title: recent.title, subtitle: recent.courseTitle, label: 'Gần đây', lesson: recent.lesson,
          search: normalize(`${recent.title} ${recent.courseTitle}`)
        });
      }
      return output;
    }

    function renderSearch(query) {
      ensureUi();
      const results = $('#librarySearchResults');
      const clear = $('#librarySearchClear');
      const normalized = normalize(query);
      clear?.classList.toggle('hidden', !normalized);
      if (!normalized) {
        results?.classList.add('hidden');
        if (results) results.innerHTML = '';
        return;
      }
      const matches = collectSearchIndex()
        .filter(item => item.search.includes(normalized))
        .sort((a, b) => (a.type === 'lesson' ? 0 : 1) - (b.type === 'lesson' ? 0 : 1))
        .slice(0, 14);
      results.classList.remove('hidden');
      results.innerHTML = matches.length ? '' : '<div class="library-search-empty">Không tìm thấy bài phù hợp.</div>';
      matches.forEach(item => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'library-search-result';
        button.innerHTML = `<span><strong>${item.title}</strong><small>${item.subtitle || item.label || ''}</small></span><em>${item.type === 'course' ? 'Bộ' : item.label || 'Bài'}</em>`;
        button.onclick = async () => {
          if (item.type === 'course') await openCourse(item.tab, item.courseId);
          else await openLesson(item);
          const input = $('#librarySearchInput');
          if (input) input.value = '';
          renderSearch('');
        };
        results.appendChild(button);
      });
    }

    function tagCourseBlocks() {
      const tab = currentTab();
      const courses = getState()?.[tab]?.courses || [];
      document.querySelectorAll('.library-panel .course-block').forEach((block, index) => {
        const course = courses[index];
        if (!course) return;
        block.dataset.courseId = course.id || '';
        block.dataset.courseTab = tab;
      });
    }

    async function openCourse(tab, courseId) {
      if (typeof window.switchFlashcardCategory === 'function') await window.switchFlashcardCategory(tab);
      await wait(0);
      tagCourseBlocks();
      const block = [...document.querySelectorAll('.library-panel .course-block')].find(item => item.dataset.courseId === courseId);
      block?.querySelector('.course-btn')?.click();
    }

    async function ensureLessonAvailable(item) {
      let found = findLesson(item.lessonId);
      if (found) return found.lesson;
      const courseInfo = findCourse(item.courseId, item.tab);
      if (courseInfo) {
        const { course } = courseInfo;
        if (!course._lessonsReady && item.tab === 'sheet' && typeof window.ensureSheetCourseLessons === 'function') {
          await window.ensureSheetCourseLessons(course);
        }
        const lesson = (course.lessons || []).find(candidate => candidate.id === item.lessonId);
        if (lesson) return lesson;
      }
      return item.lesson || null;
    }

    async function openLesson(item) {
      const lesson = await ensureLessonAvailable(item);
      if (!lesson) return;
      const courseInfo = findCourse(item.courseId, item.tab);
      st.lessons = courseInfo?.course?.lessons?.length ? courseInfo.course.lessons : [lesson];
      await window.selectLesson?.(lesson.id);
      document.body.classList.remove('library-open');
    }

    async function waitForCards(lessonId, timeoutMs = 8000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (st.lesson?.id === lessonId && st.cards?.length) return true;
        await wait(80);
      }
      return false;
    }

    async function continueLast() {
      const resume = readJson(RESUME_KEY, null);
      if (!resume?.lessonId || !resume.lesson) return;
      const button = $('#continueLastBtn');
      button?.classList.add('is-loading');
      try {
        if (typeof window.switchFlashcardCategory === 'function') {
          await window.switchFlashcardCategory(resume.tab || 'sheet').catch(() => {});
        }
        const item = {
          type: 'lesson', tab: resume.tab || 'sheet', courseId: resume.courseId,
          lessonId: resume.lessonId, lesson: resume.lesson
        };
        await openLesson(item);
        const ready = await waitForCards(resume.lessonId);
        if (!ready) throw new Error('Không tải được bài để tiếp tục.');

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
          st.i = Math.max(0, Math.min(currentIndex >= 0 ? currentIndex : Number(resume.index) || 0, session.length - 1));
          const faceCount = session[st.i]?.faces?.length || 2;
          st.face = Math.max(0, Math.min(Number(resume.face) || 0, faceCount - 1));
          st.done = false;
          st.featureFilter = resume.featureFilter || 'all';
          window.render?.();
        }
        scheduleSave(0);
      } catch (error) {
        try { window.err?.(error); } catch (_) {}
      } finally {
        button?.classList.remove('is-loading');
      }
    }

    function renderRecent() {
      const wrap = $('#recentLessonsWrap');
      const list = $('#recentLessons');
      if (!wrap || !list) return;
      const recent = recentEntries().slice(0, 5);
      wrap.classList.toggle('hidden', !recent.length);
      list.innerHTML = '';
      recent.forEach(item => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'recent-lesson';
        const progress = item.sessionLength ? `Thẻ ${Math.min((item.lastIndex || 0) + 1, item.sessionLength)}/${item.sessionLength}` : `${item.totalCards || 0} thẻ`;
        button.innerHTML = `<span><strong>${item.title}</strong><small>${item.courseTitle || 'Bài học'}</small></span><em>${progress}</em>`;
        button.onclick = () => openLesson({ type: 'lesson', tab: item.tab, courseId: item.courseId, lessonId: item.lessonId, lesson: item.lesson });
        list.appendChild(button);
      });
    }

    function renderContinue() {
      const button = $('#continueLastBtn');
      const copy = $('#continueLastText');
      if (!button || !copy) return;
      const resume = readJson(RESUME_KEY, null);
      button.classList.toggle('hidden', !resume?.lessonId);
      if (!resume?.lessonId) return;
      const progress = resume.sessionCardIds?.length
        ? ` · thẻ ${Math.min((resume.index || 0) + 1, resume.sessionCardIds.length)}/${resume.sessionCardIds.length}`
        : '';
      copy.textContent = `${resume.title || 'Bài gần nhất'}${progress}`;
    }

    function renderTools() {
      if (renderingTools) return;
      renderingTools = true;
      try {
        if (!ensureUi()) return;
        renderContinue();
        renderRecent();
        tagCourseBlocks();
      } finally {
        renderingTools = false;
      }
    }

    window.invalidateSheetCategory = function invalidateSheetCategory() {
      const state = getState();
      if (state.sheet) {
        state.sheet.loaded = false;
        state.sheet.courses = [];
      }
    };

    const baseSelectLesson = window.selectLesson;
    if (typeof baseSelectLesson === 'function' && !baseSelectLesson.__libraryToolsWrapped) {
      window.selectLesson = async function trackedSelectLesson(id) {
        const result = await baseSelectLesson(id);
        scheduleSave(80);
        setTimeout(() => scheduleSave(0), 700);
        return result;
      };
      window.selectLesson.__libraryToolsWrapped = true;
    }

    const baseRender = window.render;
    if (typeof baseRender === 'function' && !baseRender.__libraryToolsWrapped) {
      window.render = function trackedRender() {
        const result = baseRender();
        scheduleSave();
        return result;
      };
      window.render.__libraryToolsWrapped = true;
    }

    document.addEventListener('change', event => {
      if (event.target.closest('#fromInput,#toInput,#limitSelect,#shuffleInput')) scheduleSave(0);
    }, true);
    document.addEventListener('click', event => {
      if (event.target.closest('#startBtn,#knownBtn,#againBtn,#prevBtn,#flipBtn,#card,.lesson-btn')) scheduleSave(260);
    }, true);

    const menuObserver = new MutationObserver(() => renderTools());
    if (e.list) menuObserver.observe(e.list, { childList: true, subtree: true });
    ensureUi();
    renderTools();
    window.flashcardLibraryTools = { continueLast, render: renderTools, recent: recentEntries, search: renderSearch };
  } catch (error) {
    try { console.warn('[library-tools disabled]', error); } catch (_) {}
  }
})();
