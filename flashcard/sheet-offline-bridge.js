// Cache-first live Sheet config/course lessons so the menu never waits forever.
(() => {
  try {
    const offline = window.flashcardOffline;
    if (!offline) return;
    const originalLoadConfig = window.loadSheetLibraryConfig;
    const originalEnsureLessons = window.ensureSheetCourseLessons;
    const COURSE_PREFIX = 'sheet-course:';
    const MANIFEST_KEY = 'sheet-manifest';
    const CONFIG_WAIT_MS = 6200;
    let refreshInFlight = null;

    function clone(value) {
      try { return structuredClone(value); }
      catch (_) { return JSON.parse(JSON.stringify(value)); }
    }

    function withTimeout(promise, ms, message) {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
      ]);
    }

    function courseSignature(course) {
      const source = JSON.stringify({
        title: course.title,
        usedRange: course.usedRange,
        kind: course.kind,
        chunkSize: course.chunkSize,
        primaryCol: course.primaryCol,
        groupCol: course.groupCol,
        parser: course.parser,
        mergeContinuation: course.mergeContinuation,
        warningAfter: course.warningAfter,
        lessonTitle: course.lessonTitle,
        fields: course.fields,
        ordinary: course.ordinary,
        sections: course.sections,
        titleRegex: course.titleRegex,
        titleRows: course.titleRows
      });
      let hash = 2166136261;
      for (let index = 0; index < source.length; index++) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(16).padStart(8, '0');
    }

    async function hydrateCourses(config) {
      if (!config?.courses?.length) return config;
      await Promise.all(config.courses.map(async course => {
        try {
          const cached = await offline.getLibrary(COURSE_PREFIX + course.id);
          if (!cached?.lessons?.length) return;
          const currentSignature = courseSignature(course);
          if (cached.courseSignature && cached.courseSignature !== currentSignature) return;
          course.lessons = clone(cached.lessons);
          course._lessonsReady = true;
          course._offlineHydrated = true;
        } catch (_) {}
      }));
      return config;
    }

    function notifyFreshConfig(previous, next) {
      const changed = !previous?.configHash || previous.configHash !== next?.configHash;
      if (!changed) return;
      window.invalidateSheetCategory?.();
      window.dispatchEvent(new CustomEvent('sheet-config-updated', { detail: { config: clone(next) } }));
      setTimeout(() => {
        const active = document.querySelector('.library-tab.active')?.dataset.tab;
        if (active === 'sheet') window.switchFlashcardCategory?.('sheet').catch?.(() => {});
      }, 0);
    }

    function refreshOnlineInBackground(previousConfig = null) {
      if (refreshInFlight || typeof originalLoadConfig !== 'function' || navigator.onLine === false) return refreshInFlight;
      refreshInFlight = originalLoadConfig()
        .then(async config => {
          if (!config?.courses?.length) return config;
          await offline.putLibrary(MANIFEST_KEY, clone(config));
          notifyFreshConfig(previousConfig, config);
          return config;
        })
        .catch(() => null)
        .finally(() => { refreshInFlight = null; });
      return refreshInFlight;
    }

    async function readBootstrap() {
      try {
        const response = await fetch(`./data/sheet-library-manifest.json?fallback=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return null;
        return await response.json();
      } catch (_) {
        return null;
      }
    }

    window.loadSheetLibraryConfig = async function cacheFirstConfigLoader() {
      const cached = await offline.getLibrary(MANIFEST_KEY).catch(() => null);
      if (cached?.courses?.length) {
        refreshOnlineInBackground(cached);
        return hydrateCourses(clone(cached));
      }

      if (typeof originalLoadConfig === 'function' && navigator.onLine !== false) {
        try {
          const online = await withTimeout(
            originalLoadConfig(),
            CONFIG_WAIT_MS,
            'Không chờ thêm Google Sheets; app tiếp tục bằng dữ liệu local.'
          );
          if (online?.courses?.length) {
            await offline.putLibrary(MANIFEST_KEY, clone(online));
            return hydrateCourses(clone(online));
          }
        } catch (_) {
          refreshOnlineInBackground(null);
        }
      }

      const fallback = await readBootstrap();
      return hydrateCourses(clone(fallback || { courses: [], summary: 'Chưa tải được menu Kho học.' }));
    };

    window.ensureSheetCourseLessons = async function offlineCourseLessons(course) {
      if (course?._lessonsReady && course.lessons?.length) return course.lessons;
      const cached = await offline.getLibrary(COURSE_PREFIX + course.id).catch(() => null);
      const currentSignature = courseSignature(course);
      if (cached?.lessons?.length && (!cached.courseSignature || cached.courseSignature === currentSignature)) {
        course.lessons = clone(cached.lessons);
        course._lessonsReady = true;
        course._offlineHydrated = true;
        return course.lessons;
      }
      if (navigator.onLine === false) {
        throw new Error('Bộ này chưa được mở khi có mạng nên chưa có menu offline.');
      }
      if (typeof originalEnsureLessons !== 'function') throw new Error('Không có bộ phân tích danh sách bài.');
      const lessons = await withTimeout(
        originalEnsureLessons(course),
        8000,
        'Google Sheets phản hồi quá chậm. Hãy thử lại.'
      );
      await offline.putLibrary(COURSE_PREFIX + course.id, {
        courseId: course.id,
        title: course.title,
        courseSignature: currentSignature,
        lessons: clone(lessons)
      });
      return lessons;
    };

    window.sheetOfflineKeys = { manifest: MANIFEST_KEY, coursePrefix: COURSE_PREFIX };
    window.sheetCourseConfigSignature = courseSignature;
  } catch (error) {
    try { console.warn('[sheet-offline-bridge disabled]', error); } catch (_) {}
  }
})();
