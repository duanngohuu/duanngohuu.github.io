// Show which course lists and lessons are already available offline.
(() => {
  try {
    const $ = selector => document.querySelector(selector);
    const COURSE_PREFIX = window.sheetOfflineKeys?.coursePrefix || 'sheet-course:';
    let refreshQueued = false;
    let initialized = false;

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

    function setBadge(badge, text, tone) {
      if (!badge) return;
      if (badge.textContent !== text) badge.textContent = text;
      badge.classList.remove('is-downloaded', 'is-not-downloaded', 'is-local');
      if (tone) badge.classList.add(tone);
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
      if (downloaded) {
        setLabel(label, `Đã tải · ${cached.lessons.length} bài`);
      } else if (info.course._lessonsReady && info.course.lessons?.length) {
        setLabel(label, `Đang dùng · ${info.course.lessons.length} bài`);
      } else {
        setLabel(label, 'Chạm để tải');
      }
    }

    async function refreshCourseButtons() {
      const blocks = [...document.querySelectorAll('#lessonList .course-block[data-course-id]')];
      await Promise.all(blocks.map(refreshCourseButton));
    }

    async function refreshLessonButton(button) {
      const lessonId = button.dataset.lessonId || '';
      if (!lessonId) return;
      const block = button.closest('.course-block');
      const info = findLesson(lessonId, block?.dataset.courseId || '');
      const badge = ensureLessonBadge(button);
      if (!badge || !info) return;

      const isSheetLesson = info.tab === 'sheet' || info.lesson.source === 'google-sheet';
      if (!isSheetLesson) {
        setBadge(badge, 'Có sẵn', 'is-local');
        return;
      }

      let cached = null;
      try { cached = await window.flashcardOffline?.getLesson?.(lessonId); }
      catch (_) {}
      if (!button.isConnected || button.dataset.lessonId !== lessonId) return;
      if (Array.isArray(cached?.cards) && cached.cards.length > 0) {
        setBadge(badge, 'Đã tải', 'is-downloaded');
      } else {
        setBadge(badge, 'Chưa tải', 'is-not-downloaded');
      }
    }

    async function refreshAll() {
      const buttons = [...document.querySelectorAll('#lessonList .lesson-btn[data-lesson-id]')];
      await Promise.all([
        refreshCourseButtons(),
        ...buttons.map(refreshLessonButton)
      ]);
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
      wrapOfflineWrites();

      const list = $('#lessonList');
      if (list) {
        new MutationObserver(() => queueRefresh()).observe(list, { childList: true, subtree: true });
      }

      document.addEventListener('click', event => {
        if (event.target.closest('.course-btn,.library-tab,.lesson-btn')) {
          queueRefresh(80);
          setTimeout(() => queueRefresh(), 700);
        }
      }, true);
      window.addEventListener('sheet-config-updated', () => queueRefresh(100));
      window.addEventListener('online', () => queueRefresh(100));
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) queueRefresh(50);
      });

      window.refreshFlashcardDownloadStatus = () => queueRefresh();
      queueRefresh();
    }

    init();
  } catch (error) {
    try { console.warn('[download-status disabled]', error); } catch (_) {}
  }
})();
