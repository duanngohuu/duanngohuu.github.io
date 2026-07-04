// Category/course menu: approved live Sheet library + local vocab/grammar/kanji data.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    const logSafe = msg => { try { if (typeof log === 'function') log(msg); } catch (_) {} };
    const PROGRESS_KEY = 'fc_vocab_progress_v2';
    const SHEET_PREFIX = /^OK@(TV|NP|BUN)\s*/i;
    const SHEET_GROUPS = {
      TV: { label: 'Từ vựng', order: 1 },
      NP: { label: 'Ngữ pháp', order: 2 },
      BUN: { label: 'Văn mẫu', order: 3 }
    };
    const categoryState = {
      sheet: { loaded: false, courses: [], summary: 'Chỉ hiện các sheet đã duyệt bằng prefix OK@.' },
      vocab: { loaded: false, courses: [], summary: 'Từ vựng Đọc hiểu các năm JLPT.' },
      grammar: { loaded: false, courses: [], summary: 'Ngữ pháp N2 các năm JLPT.' },
      kanji: { loaded: true, courses: [{ title: 'Kanji N2 2010-2025', lessons: [], note: 'Đang nhập data Kanji từ ảnh. Chưa có TSV nên chưa bật bài nhỏ.' }], summary: 'Kanji N2 2010-2025.' }
    };
    let activeTab = 'sheet';

    function normalizeSheetCourse(course) {
      const rawTitle = String(course?.title || '').trim();
      const match = rawTitle.match(SHEET_PREFIX);
      if (!match) return null;
      const group = match[1].toUpperCase();
      const displayTitle = String(course.displayTitle || rawTitle.replace(SHEET_PREFIX, '')).trim() || 'Untitled';
      const groupLabel = course.sheetGroupLabel || SHEET_GROUPS[group]?.label || group;
      return {
        ...course,
        title: rawTitle,
        displayTitle,
        sheetGroup: group,
        sheetGroupLabel: groupLabel,
        lessons: (course.lessons || []).map(lesson => ({
          ...lesson,
          courseTitle: displayTitle,
          sheetGroup: group,
          sheetGroupLabel: groupLabel
        }))
      };
    }

    function flatten(manifest, tab = '') {
      if (tab === 'sheet') {
        return (manifest.courses || [])
          .map(normalizeSheetCourse)
          .filter(Boolean)
          .sort((a, b) => {
            const groupDiff = (SHEET_GROUPS[a.sheetGroup]?.order || 99) - (SHEET_GROUPS[b.sheetGroup]?.order || 99);
            return groupDiff || String(a.displayTitle).localeCompare(String(b.displayTitle), 'ja');
          });
      }
      return (manifest.courses || []).map(course => ({
        ...course,
        title: course.title || 'Untitled',
        displayTitle: course.displayTitle || course.title || 'Untitled',
        lessons: (course.lessons || []).map(lesson => ({ ...lesson, courseTitle: course.displayTitle || course.title || 'Untitled' }))
      }));
    }

    function readProgress(lessonId) {
      try {
        const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
        const progress = all[lessonId] || {};
        return { known: (progress.known || []).length, again: (progress.again || []).length };
      } catch (_) { return { known: 0, again: 0 }; }
    }

    function lessonMetaHtml(lesson) {
      const progress = readProgress(lesson.id);
      const count = lesson.count || 0;
      return `<span>${count} thẻ</span><span>Đã nhớ: ${progress.known}</span><span>Chưa nhớ: ${progress.again}</span>`;
    }

    function allLessons() {
      return Object.values(categoryState).flatMap(data => data.courses || []).flatMap(course => course.lessons || []);
    }

    function refreshLessonProgressBadges() {
      const lessons = allLessons();
      document.querySelectorAll('.lesson-btn[data-lesson-id]').forEach(button => {
        const lesson = lessons.find(item => item.id === button.dataset.lessonId);
        const meta = button.querySelector('.lesson-progress-line');
        if (lesson && meta) meta.innerHTML = lessonMetaHtml(lesson);
      });
    }

    function sheetSummary(courses) {
      const counts = courses.reduce((result, course) => {
        result[course.sheetGroup] = (result[course.sheetGroup] || 0) + 1;
        return result;
      }, {});
      return `Chỉ sheet đã duyệt · Từ vựng ${counts.TV || 0} · Ngữ pháp ${counts.NP || 0} · Văn mẫu ${counts.BUN || 0}.`;
    }

    async function fetchCourses(tab) {
      if (categoryState[tab]?.loaded) return categoryState[tab].courses;
      if (tab === 'sheet') {
        let config;
        if (typeof window.loadSheetLibraryConfig === 'function') config = await window.loadSheetLibraryConfig();
        else config = JSON.parse(await getText('./data/sheet-library-manifest.json?v=' + Date.now()));
        categoryState.sheet.courses = flatten(config, 'sheet');
        categoryState.sheet.loaded = true;
        categoryState.sheet.summary = sheetSummary(categoryState.sheet.courses);
        return categoryState.sheet.courses;
      }
      const path = tab === 'grammar' ? './data/n2-grammar-manifest.json' : './data/manifest.json';
      const text = await getText(path + '?v=' + Date.now());
      const manifest = JSON.parse(text);
      categoryState[tab].courses = flatten(manifest, tab);
      categoryState[tab].loaded = true;
      return categoryState[tab].courses;
    }

    function clearStudy() {
      st.lesson = null;
      st.cards = [];
      st.session = [];
      st.i = 0;
      st.face = 0;
      st.done = false;
      st.finishShown = false;
      st.multiFaceMode = false;
      if (typeof render === 'function') render();
    }

    function closeCourseBoxes() {
      if (!e.list) return;
      e.list.querySelectorAll('.course-block').forEach(block => {
        block.classList.remove('open');
        const lessons = block.querySelector('.course-lessons');
        if (lessons) lessons.style.display = 'none';
      });
    }

    function setSheetGroupOpen(group = '', scroll = true) {
      if (!e.list) return;
      closeCourseBoxes();
      e.list.querySelectorAll('.sheet-group-heading').forEach(heading => {
        const open = !!group && heading.dataset.sheetGroup === group;
        heading.classList.toggle('open', open);
        heading.setAttribute('aria-expanded', String(open));
      });
      e.list.querySelectorAll('.course-block[data-sheet-group]').forEach(block => {
        block.classList.toggle('sheet-group-visible', !!group && block.dataset.sheetGroup === group);
      });
      if (group && scroll) {
        const heading = e.list.querySelector(`.sheet-group-heading[data-sheet-group="${group}"]`);
        setTimeout(() => heading?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
      }
    }

    function toggleSheetGroup(group) {
      const heading = e.list?.querySelector(`.sheet-group-heading[data-sheet-group="${group}"]`);
      const willOpen = !heading?.classList.contains('open');
      setSheetGroupOpen(willOpen ? group : '', willOpen);
    }

    function appendSheetGroupHeading(course, courses) {
      const heading = document.createElement('button');
      heading.type = 'button';
      heading.className = `sheet-group-heading sheet-group-${String(course.sheetGroup || '').toLowerCase()}`;
      heading.dataset.sheetGroup = course.sheetGroup;
      heading.setAttribute('aria-expanded', 'false');
      const count = courses.filter(item => item.sheetGroup === course.sheetGroup).length;
      heading.innerHTML = `<div><span>Kho học</span><strong>${course.sheetGroupLabel}</strong></div><small>${count} bộ</small><i class="sheet-group-chevron" aria-hidden="true">⌄</i>`;
      heading.onclick = () => toggleSheetGroup(course.sheetGroup);
      e.list.appendChild(heading);
    }

    function renderCategory(tab, openIndex = null) {
      activeTab = tab;
      const data = categoryState[tab];
      if (!e.list || !data) return;
      e.list.style.display = 'grid';
      e.list.classList.toggle('sheet-group-mode', tab === 'sheet');
      e.list.innerHTML = '';
      const empty = $('.empty-tab');
      if (empty) empty.style.display = 'none';
      const summary = $('.library-summary');
      if (summary) summary.textContent = data.summary;
      if (e.meta) {
        if (tab === 'kanji') e.meta.textContent = 'Chưa có data';
        else if (tab === 'sheet') e.meta.textContent = data.courses.length + ' bộ đã duyệt';
        else e.meta.textContent = data.courses.reduce((count, course) => count + (course.lessons?.length || 0), 0) + ' mục';
      }

      let previousGroup = '';
      data.courses.forEach((course, index) => {
        if (tab === 'sheet' && course.sheetGroup !== previousGroup) {
          appendSheetGroupHeading(course, data.courses);
          previousGroup = course.sheetGroup;
        }

        const box = document.createElement('div');
        box.className = 'course-block';
        box.dataset.courseId = course.id || '';
        if (course.sheetGroup) box.dataset.sheetGroup = course.sheetGroup;
        const ready = tab !== 'sheet' || course._lessonsReady;
        const countText = ready
          ? (course.lessons?.length ? course.lessons.length + ' bài nhỏ' : 'Chưa có bài')
          : 'Chạm để tải';
        const shownTitle = course.displayTitle || course.title;
        box.innerHTML = `<button class="course-btn" type="button"><strong>${shownTitle}</strong><span>${countText}</span></button><div class="course-lessons"></div>`;
        const button = box.querySelector('.course-btn');
        const lessonsBox = box.querySelector('.course-lessons');
        const open = openIndex === index || (tab !== 'sheet' && data.courses.length === 1 && course.lessons?.length > 0);
        box.classList.toggle('open', open);
        lessonsBox.style.display = open ? 'grid' : 'none';

        if (!ready) {
          lessonsBox.innerHTML = '<div class="empty-tab">Chạm vào tên bộ để đọc danh sách bài từ Google Sheets.</div>';
        } else if (!course.lessons?.length) {
          lessonsBox.innerHTML = `<div class="empty-tab">${course.note || 'Chưa có dữ liệu bài học.'}</div>`;
        } else {
          course.lessons.forEach(lesson => {
            lesson.courseTitle = shownTitle;
            lesson.sheetGroup = course.sheetGroup;
            lesson.sheetGroupLabel = course.sheetGroupLabel;
            const lessonButton = document.createElement('button');
            lessonButton.className = 'lesson-btn lesson-btn-grid';
            lessonButton.type = 'button';
            lessonButton.dataset.lessonId = lesson.id;
            lessonButton.innerHTML = `<strong>${lesson.title}</strong><span class="lesson-progress-line">${lessonMetaHtml(lesson)}</span>`;
            lessonButton.onclick = () => {
              st.lessons = course.lessons;
              if (typeof selectLesson === 'function') selectLesson(lesson.id);
            };
            lessonsBox.appendChild(lessonButton);
          });
        }

        button.onclick = async () => {
          if (tab === 'sheet') setSheetGroupOpen(course.sheetGroup, false);
          if (tab === 'sheet' && !course._lessonsReady) {
            button.classList.add('is-loading');
            button.querySelector('span').textContent = 'Đang đọc sheet';
            try {
              if (typeof window.ensureSheetCourseLessons !== 'function') throw new Error('Sheet loader chưa sẵn sàng.');
              await window.ensureSheetCourseLessons(course);
              renderCategory(tab, index);
            } catch (error) {
              button.classList.remove('is-loading');
              button.querySelector('span').textContent = 'Lỗi tải';
              logSafe('Sheet course error: ' + error.message);
            }
            return;
          }
          const willOpen = !box.classList.contains('open');
          closeCourseBoxes();
          box.classList.toggle('open', willOpen);
          lessonsBox.style.display = willOpen ? 'grid' : 'none';
          if (willOpen) setTimeout(() => box.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
          refreshLessonProgressBadges();
        };
        e.list.appendChild(box);
      });

      if (tab === 'sheet' && openIndex !== null && data.courses[openIndex]) {
        const targetCourse = data.courses[openIndex];
        setSheetGroupOpen(targetCourse.sheetGroup, false);
        const targetBox = e.list.querySelector(`.course-block[data-course-id="${targetCourse.id}"]`);
        if (targetBox) {
          targetBox.classList.add('open');
          const lessons = targetBox.querySelector('.course-lessons');
          if (lessons) lessons.style.display = 'grid';
          setTimeout(() => targetBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
        }
      }

      if (tab === 'sheet' && !data.courses.length) {
        const notice = document.createElement('div');
        notice.className = 'empty-tab';
        notice.textContent = 'Không có sheet đã duyệt. Chỉ sheet bắt đầu bằng OK@TV, OK@NP hoặc OK@BUN mới được đưa lên app.';
        e.list.appendChild(notice);
      }

      clearStudy();
      refreshLessonProgressBadges();
      logSafe('Render category: ' + tab);
    }

    async function switchCategory(tab) {
      activeTab = tab;
      document.querySelectorAll('.library-tab').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
      await fetchCourses(tab);
      renderCategory(tab);
      document.querySelector(`.library-tab[data-tab="${tab}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    document.addEventListener('click', event => {
      const button = event.target.closest('.library-tab');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      switchCategory(button.dataset.tab).catch(error => logSafe('Category load error: ' + error.message));
    }, true);

    document.addEventListener('click', event => {
      if (event.target.closest('#knownBtn,#againBtn,#resetBtn,#finishKnownBtn,#finishAgainBtn,#finishRestartBtn')) {
        setTimeout(refreshLessonProgressBadges, 120);
      }
    }, true);

    setTimeout(() => switchCategory('sheet').catch(error => logSafe('Sheet category error: ' + error.message)), 0);
    window.switchFlashcardCategory = switchCategory;
    window.refreshLessonProgressBadges = refreshLessonProgressBadges;
    window.getFlashcardCategoryState = () => categoryState;
    window.openSheetStudyGroup = (group, scroll = true) => setSheetGroupOpen(group, scroll);
    window.closeSheetStudyGroups = () => setSheetGroupOpen('', false);
    logSafe('Approved Sheet category loader loaded.');
  } catch (error) {
    try { console.warn('[category loader disabled]', error); } catch (_) {}
  }
})();
