// Show study status for every lesson; keep course cache state internal.
(() => {
  try {
    const $ = selector => document.querySelector(selector);
    const COURSE_PREFIX = window.sheetOfflineKeys?.coursePrefix || 'sheet-course:';
    const PROGRESS_KEY = 'fc_vocab_progress_v2';
    let refreshQueued = false;
    let initialized = false;

    function ensureStyle() {
      if (document.getElementById('lessonStudyStatusStyle')) return;
      const style = document.createElement('style');
      style.id = 'lessonStudyStatusStyle';
      style.textContent = `
        .lesson-btn-grid>.lesson-download-state.is-study-idle{color:#1d4ed8!important;background:#dbeafe!important;border-color:#93c5fd!important}
        .lesson-btn-grid>.lesson-download-state.is-study-progress{color:#9a3412!important;background:#ffedd5!important;border-color:#fdba74!important}
        .lesson-btn-grid>.lesson-download-state.is-study-complete{color:#166534!important;background:#dcfce7!important;border-color:#86efac!important}
        .lesson-btn.active>.lesson-download-state.is-study-idle{color:#dbeafe!important;background:rgba(37,99,235,.48)!important;border-color:rgba(191,219,254,.7)!important}
        .lesson-btn.active>.lesson-download-state.is-study-progress{color:#fff7ed!important;background:rgba(234,88,12,.62)!important;border-color:rgba(254,215,170,.75)!important}
        .lesson-btn.active>.lesson-download-state.is-study-complete{color:#ecfdf5!important;background:rgba(22,163,74,.6)!important;border-color:rgba(187,247,208,.7)!important}
        .dark .lesson-btn-grid>.lesson-download-state.is-study-idle{color:#bfdbfe!important;background:rgba(30,64,175,.32)!important;border-color:rgba(96,165,250,.55)!important}
        .dark .lesson-btn-grid>.lesson-download-state.is-study-progress{color:#fed7aa!important;background:rgba(154,52,18,.35)!important;border-color:rgba(251,146,60,.58)!important}
        .dark .lesson-btn-grid>.lesson-download-state.is-study-complete{color:#bbf7d0!important;background:rgba(22,101,52,.38)!important;border-color:rgba(74,222,128,.55)!important}`;
      document.head.appendChild(style);
    }

    function getState() {
      try { return window.getFlashcardCategoryState?.() || {}; }
      catch (_) { return {}; }
    }

    function findCourse(courseId) {
      const state = getState();
      for (const [tab, data] of Object.entries(state)) {
        const course = (data?.courses || []).find(item => item.id === courseId);
        if (course) return { tab, course };
      }
      return null;
    }

    function findLesson(lessonId, courseId = '') {
      const state = getState();
      for (const [tab, data] of Object.entries(state)) {
        for (const course of data?.courses || []) {
          if (courseId && course.id !== courseId) continue;
          const lesson = (course.lessons || []).find(item => item.id === lessonId);
          if (lesson) return { tab, course, lesson };
        }
      }
      return null;
    }

    function readProgress(lessonId) {
      try {
        const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
        const value = all?.[lessonId] || {};
        return {
          known: new Set(Array.isArray(value.known) ? value.known : []).size,
          again: new Set(Array.isArray(value.again) ? value.again : []).size
        };
      } catch (_) {
        return { known: 0, again: 0 };
      }
    }

    function studyStatus(info) {
      const lessonId = info?.lesson?.id || '';
      const count = Math.max(0, Number(info?.lesson?.count || 0));
      const progress = readProgress(lessonId);
      const isCurrent = window.st?.lesson?.id === lessonId;
      const hasActiveSession = isCurrent && Array.isArray(window.st?.session) && window.st.session.length > 0 && !window.st?.done;

      if (count > 0 && progress.known >= count) {
        return { text: 'Hoàn thành', tone: 'is-study-complete', title: `Đã nhớ ${progress.known}/${count} thẻ` };
      }
      if (progress.known > 0 || progress.again > 0 || hasActiveSession) {
        return { text: 'Đang học', tone: 'is-study-progress', title: `Đã nhớ ${progress.known}/${count || '?'} · Chưa nhớ ${progress.again}` };
      }
      return { text: 'Có sẵn', tone: 'is-study-idle', title: 'Chưa bắt đầu học' };
    }

    function ensureLessonBadge(button) {
      const line = button.querySelector('.lesson-progress-line');
      if (!line) return null;
      line.classList.remove('has-download-state');

      let badge = button.querySelector(':scope > .lesson-download-state')
        || line.querySelector('.lesson-download-state');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'lesson-download-state';
      }
      if (badge.parentElement !== button) button.insertBefore(badge, line);
      return badge;
    }

    function setBadge(badge, status) {
      if (!badge || !status) return;
      if (badge.textContent !== status.text) badge.textContent = status.text;
      badge.classList.remove(
        'is-downloaded', 'is-not-downloaded', 'is-local',
        'is-study-idle', 'is-study-progress', 'is-study-complete'
      );
      badge.classList.add(status.tone);
      badge.title = status.title || status.text;
      badge.setAttribute('aria-label', status.title || status.text);
    }

    function setLabel(label, text) {
      if (label && label.textContent !== text) label.textContent = text;
    }

    async function refreshCourseButton(block) {
      const courseId = block.dataset.courseId || '';
      const info = findCourse(courseId);
      const button = block.querySelector(':scope > .course-btn');
      const label = button?.querySelector('span');
      if (!info || !button || !label || info.tab !== 'sheet') return;
      if (button.classList.contains('is-loading')) return;

      let cached = null;
      try { cached = await window.flashcardOffline?.getLibrary?.(COURSE_PREFIX + courseId); }
      catch (_) {}
      if (!block.isConnected || block.dataset.courseId !== courseId) return;

      const downloaded = Array.isArray(cached?.lessons) && cached.lessons.length > 0;
      button.classList.toggle('is-downloaded', downloaded);
      if (downloaded) setLabel(label, `${cached.lessons.length} bài nhỏ`);
      else if (info.course._lessonsReady && info.course.lessons?.length) setLabel(label, `${info.course.lessons.length} bài nhỏ`);
      else setLabel(label, 'Chạm để tải');
    }

    async function refreshCourseButtons() {
      const blocks = [...document.querySelectorAll('#lessonList .course-block[data-course-id]')];
      await Promise.all(blocks.map(refreshCourseButton));
    }

    function refreshLessonButton(button) {
      const lessonId = button.dataset.lessonId || '';
      if (!lessonId) return;
      const block = button.closest('.course-block');
      const info = findLesson(lessonId, block?.dataset.courseId || '');
      const badge = ensureLessonBadge(button);
      if (!badge || !info) return;
      setBadge(badge, studyStatus(info));
    }

    async function refreshAll() {
      const buttons = [...document.querySelectorAll('#lessonList .lesson-btn[data-lesson-id]')];
      await refreshCourseButtons();
      buttons.forEach(refreshLessonButton);
    }

    function queueRefresh(delay = 0) {
      if (refreshQueued) return;
      refreshQueued = true;
      setTimeout(() => {
        refreshQueued = false;
        refreshAll().catch(() => {});
      }, delay);
    }

    function wrapOfflineWrites() {
      const offline = window.flashcardOffline;
      if (!offline || offline.__downloadStatusWrapped) return;
      offline.__downloadStatusWrapped = true;

      if (typeof offline.putLesson === 'function') {
        const originalPutLesson = offline.putLesson.bind(offline);
        offline.putLesson = async function putLessonWithStatus(...args) {
          const result = await originalPutLesson(...args);
          queueRefresh();
          return result;
        };
      }

      if (typeof offline.putLibrary === 'function') {
        const originalPutLibrary = offline.putLibrary.bind(offline);
        offline.putLibrary = async function putLibraryWithStatus(...args) {
          const result = await originalPutLibrary(...args);
          const key = String(args[0] || '');
          if (key.startsWith(COURSE_PREFIX)) queueRefresh();
          return result;
        };
      }

      if (typeof offline.clearOfflineData === 'function') {
        const originalClearOfflineData = offline.clearOfflineData.bind(offline);
        offline.clearOfflineData = async function clearOfflineDataWithStatus(...args) {
          const result = await originalClearOfflineData(...args);
          queueRefresh(80);
          return result;
        };
      }
    }

    function init() {
      if (initialized) return;
      if (!window.flashcardOffline || typeof window.getFlashcardCategoryState !== 'function') {
        setTimeout(init, 120);
        return;
      }
      initialized = true;
      ensureStyle();
      wrapOfflineWrites();

      const list = $('#lessonList');
      if (list) new MutationObserver(() => queueRefresh()).observe(list, { childList: true, subtree: true });

      document.addEventListener('click', event => {
        if (event.target.closest('.course-btn,.library-tab,.lesson-btn')) {
          queueRefresh(80);
          setTimeout(() => queueRefresh(), 700);
        }
        if (event.target.closest('#startBtn,#knownBtn,#againBtn,#resetBtn,#finishKnownBtn,#finishAgainBtn,#finishRestartBtn,#finishContinueBtn')) {
          queueRefresh(100);
          setTimeout(() => queueRefresh(), 350);
        }
      }, true);

      window.addEventListener('storage', event => {
        if (event.key === PROGRESS_KEY) queueRefresh(20);
      });
      window.addEventListener('sheet-config-updated', () => queueRefresh(100));
      window.addEventListener('online', () => queueRefresh(100));
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) queueRefresh(50);
      });

      window.refreshFlashcardDownloadStatus = () => queueRefresh();
      window.refreshFlashcardStudyStatus = () => queueRefresh();
      queueRefresh();
    }

    init();
  } catch (error) {
    try { console.warn('[download-status disabled]', error); } catch (_) {}
  }
})();
