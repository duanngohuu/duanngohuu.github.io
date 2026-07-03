// Category/course menu hotfix: tabs keep their own category data and show course -> lesson hierarchy.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    const logSafe = msg => { try { if (typeof log === 'function') log(msg); } catch (_) {} };
    const PROGRESS_KEY = 'fc_vocab_progress_v2';
    const categoryState = {
      vocab: { loaded: false, courses: [], summary: 'Từ vựng Đọc hiểu các năm JLPT.' },
      grammar: { loaded: false, courses: [], summary: 'Ngữ pháp N2 các năm JLPT.' },
      kanji: { loaded: true, courses: [{ title: 'Kanji N2 2010-2025', lessons: [], note: 'Đang nhập data Kanji từ ảnh. Chưa có TSV nên chưa bật bài nhỏ.' }], summary: 'Kanji N2 2010-2025.' }
    };

    function flatten(m) {
      return (m.courses || []).map(c => ({
        title: c.title || 'Untitled',
        lessons: (c.lessons || []).map(l => ({...l, courseTitle: c.title || 'Untitled'}))
      }));
    }

    function readProgress(lessonId) {
      try {
        const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
        const p = all[lessonId] || {};
        return { known: (p.known || []).length, again: (p.again || []).length };
      } catch (_) {
        return { known: 0, again: 0 };
      }
    }

    function lessonMetaHtml(l) {
      const p = readProgress(l.id);
      const count = l.count || 0;
      return `<span>${count} thẻ</span><span>Đã nhớ: ${p.known}</span><span>Chưa nhớ: ${p.again}</span>`;
    }

    function refreshLessonProgressBadges() {
      document.querySelectorAll('.lesson-btn[data-lesson-id]').forEach(btn => {
        const lesson = categoryState.vocab.courses.concat(categoryState.grammar.courses)
          .flatMap(c => c.lessons || [])
          .find(l => l.id === btn.dataset.lessonId);
        const meta = btn.querySelector('.lesson-progress-line');
        if (lesson && meta) meta.innerHTML = lessonMetaHtml(lesson);
      });
    }

    async function fetchCourses(tab) {
      if (categoryState[tab]?.loaded) return categoryState[tab].courses;
      const path = tab === 'grammar' ? './data/n2-grammar-manifest.json' : './data/manifest.json';
      const text = await getText(path + '?v=' + Date.now());
      const m = JSON.parse(text);
      categoryState[tab].courses = flatten(m);
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
      if (typeof render === 'function') render();
    }

    function renderCategory(tab, openIndex = null) {
      const data = categoryState[tab];
      if (!e.list || !data) return;
      e.list.style.display = 'grid';
      e.list.innerHTML = '';
      const empty = $('.empty-tab');
      if (empty) empty.style.display = 'none';
      const summary = $('.library-summary');
      if (summary) summary.textContent = data.summary;
      if (e.meta) e.meta.textContent = tab === 'kanji' ? 'Chưa có data' : data.courses.reduce((n, c) => n + c.lessons.length, 0) + ' mục';

      data.courses.forEach((course, index) => {
        const box = document.createElement('div');
        box.className = 'course-block';
        const countText = course.lessons.length ? course.lessons.length + ' bài nhỏ' : 'Chưa có bài';
        box.innerHTML = `<button class="course-btn" type="button"><strong>${course.title}</strong><span>${countText}</span></button><div class="course-lessons"></div>`;
        const btn = box.querySelector('.course-btn');
        const lessonsBox = box.querySelector('.course-lessons');
        const open = openIndex === index || (data.courses.length === 1 && course.lessons.length > 0);
        box.classList.toggle('open', open);
        lessonsBox.style.display = open ? 'grid' : 'none';
        if (!course.lessons.length) {
          lessonsBox.innerHTML = `<div class="empty-tab">${course.note || 'Chưa có TSV sạch trong repo.'}</div>`;
        } else {
          course.lessons.forEach(l => {
            const b = document.createElement('button');
            b.className = 'lesson-btn lesson-btn-grid';
            b.type = 'button';
            b.dataset.lessonId = l.id;
            b.innerHTML = `<strong>${l.title}</strong><span class="lesson-progress-line">${lessonMetaHtml(l)}</span>`;
            b.onclick = () => {
              st.lessons = course.lessons;
              if (typeof selectLesson === 'function') selectLesson(l.id);
            };
            lessonsBox.appendChild(b);
          });
        }
        btn.onclick = () => {
          const willOpen = !box.classList.contains('open');
          e.list.querySelectorAll('.course-block').forEach(x => {
            x.classList.remove('open');
            const lx = x.querySelector('.course-lessons');
            if (lx) lx.style.display = 'none';
          });
          box.classList.toggle('open', willOpen);
          lessonsBox.style.display = willOpen ? 'grid' : 'none';
          refreshLessonProgressBadges();
        };
        e.list.appendChild(box);
      });
      clearStudy();
      refreshLessonProgressBadges();
      logSafe('Render category: ' + tab);
    }

    async function switchCategory(tab) {
      document.querySelectorAll('.library-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
      await fetchCourses(tab);
      renderCategory(tab);
    }

    document.addEventListener('click', ev => {
      const btn = ev.target.closest('.library-tab');
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      switchCategory(btn.dataset.tab).catch(err => logSafe('Category load error: ' + err.message));
    }, true);

    document.addEventListener('click', ev => {
      if (ev.target.closest('#knownBtn,#againBtn,#resetBtn,#finishKnownBtn,#finishAgainBtn,#finishRestartBtn')) {
        setTimeout(refreshLessonProgressBadges, 120);
      }
    }, true);

    setTimeout(() => switchCategory('vocab').catch(err => logSafe('Vocab category error: ' + err.message)), 0);
    window.switchFlashcardCategory = switchCategory;
    window.refreshLessonProgressBadges = refreshLessonProgressBadges;
    logSafe('Course category loader loaded.');
  } catch (error) {
    try { console.warn('[category loader disabled]', error); } catch (_) {}
  }
})();
