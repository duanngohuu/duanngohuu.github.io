// Persist live Sheet config/course lessons so the menu remains available offline.
(() => {
  try {
    const offline = window.flashcardOffline;
    if (!offline) return;
    const originalLoadConfig = window.loadSheetLibraryConfig;
    const originalEnsureLessons = window.ensureSheetCourseLessons;
    const COURSE_PREFIX = 'sheet-course:';
    const MANIFEST_KEY = 'sheet-manifest';

    function clone(value) {
      try { return structuredClone(value); }
      catch (_) { return JSON.parse(JSON.stringify(value)); }
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

    window.loadSheetLibraryConfig = async function offlineConfigLoader() {
      let config = null;
      let onlineError = null;
      if (typeof originalLoadConfig === 'function') {
        try {
          config = await originalLoadConfig();
          await offline.putLibrary(MANIFEST_KEY, clone(config));
        } catch (error) {
          onlineError = error;
        }
      }
      if (!config) config = await offline.getLibrary(MANIFEST_KEY);
      if (!config) throw onlineError || new Error('Chưa có menu Google Sheets trong bộ nhớ offline.');
      return hydrateCourses(clone(config));
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
      const lessons = await originalEnsureLessons(course);
      let manifestVersion = '';
      try { manifestVersion = (await window.loadSheetLibraryConfig())?.version || ''; } catch (_) {}
      await offline.putLibrary(COURSE_PREFIX + course.id, {
        courseId: course.id,
        title: course.title,
        manifestVersion,
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
