// Collapsible Google Sheet groups: closed by default, one group/course open at a time.
(() => {
  try {
    if (!window.e?.list) return;
    const list = e.list;
    let openGroup = '';
    let openCourseId = '';
    let decorating = false;
    let scrollTimer = 0;

    function isSheetTab() {
      return document.querySelector('.library-tab.active')?.dataset.tab === 'sheet';
    }

    function courses() {
      return window.getFlashcardCategoryState?.()?.sheet?.courses || [];
    }

    function smoothScroll(node, delay = 80) {
      if (!node) return;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        try { node.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' }); } catch (_) {}
      }, delay);
    }

    function collapseCourse(block) {
      block.classList.remove('open');
      block.querySelector('.course-lessons')?.style.setProperty('display', 'none');
      block.querySelector('.course-btn')?.setAttribute('aria-expanded', 'false');
    }

    function expandCourse(block, shouldScroll = true) {
      if (!block) return;
      list.querySelectorAll('.course-block').forEach(item => {
        if (item !== block) collapseCourse(item);
      });
      block.classList.add('open');
      block.querySelector('.course-lessons')?.style.setProperty('display', 'grid');
      block.querySelector('.course-btn')?.setAttribute('aria-expanded', 'true');
      openCourseId = block.dataset.courseId || '';
      const group = block.dataset.sheetGroup || '';
      if (group) openGroup = group;
      applyVisibility();
      if (shouldScroll) smoothScroll(block, 120);
    }

    function applyVisibility() {
      if (!isSheetTab()) return;
      list.querySelectorAll('.sheet-group-heading').forEach(heading => {
        const group = heading.dataset.sheetGroup || '';
        const expanded = !!group && group === openGroup;
        heading.classList.toggle('open', expanded);
        heading.setAttribute('aria-expanded', String(expanded));
        const chevron = heading.querySelector('.sheet-group-chevron');
        if (chevron) chevron.textContent = expanded ? '⌃' : '⌄';
      });
      list.querySelectorAll('.course-block').forEach(block => {
        const visible = !!openGroup && block.dataset.sheetGroup === openGroup;
        block.classList.toggle('sheet-group-visible', visible);
        block.style.display = visible ? 'grid' : 'none';
        if (!visible) collapseCourse(block);
      });
    }

    function toggleGroup(heading) {
      const group = heading.dataset.sheetGroup || '';
      const willOpen = openGroup !== group;
      list.querySelectorAll('.course-block').forEach(collapseCourse);
      openCourseId = '';
      openGroup = willOpen ? group : '';
      applyVisibility();
      if (willOpen) smoothScroll(heading, 70);
    }

    function decorate() {
      if (decorating || !isSheetTab()) return;
      decorating = true;
      try {
        const courseList = courses();
        const blocks = [...list.querySelectorAll('.course-block')];
        blocks.forEach((block, index) => {
          const course = courseList[index];
          if (course) {
            block.dataset.courseId = course.id || '';
            block.dataset.sheetGroup = course.sheetGroup || block.dataset.sheetGroup || '';
          }
          const button = block.querySelector('.course-btn');
          if (button) button.setAttribute('aria-expanded', String(block.classList.contains('open')));
        });

        list.querySelectorAll('.sheet-group-heading').forEach(heading => {
          const groupClass = [...heading.classList].find(name => /^sheet-group-(tv|np|bun)$/i.test(name));
          const group = groupClass ? groupClass.replace('sheet-group-', '').toUpperCase() : '';
          heading.dataset.sheetGroup = group;
          heading.setAttribute('role', 'button');
          heading.setAttribute('tabindex', '0');
          if (!heading.querySelector('.sheet-group-chevron')) {
            const chevron = document.createElement('b');
            chevron.className = 'sheet-group-chevron';
            chevron.setAttribute('aria-hidden', 'true');
            chevron.textContent = '⌄';
            heading.appendChild(chevron);
          }
        });

        const explicitlyOpen = blocks.find(block => block.classList.contains('open'));
        if (explicitlyOpen) {
          openGroup = explicitlyOpen.dataset.sheetGroup || openGroup;
          openCourseId = explicitlyOpen.dataset.courseId || openCourseId;
        }

        // Initial render is fully collapsed. A rerender caused by loading an explicitly
        // selected course keeps only that course and its parent group open.
        if (openCourseId) {
          const active = blocks.find(block => block.dataset.courseId === openCourseId);
          if (active) expandCourse(active, false);
          else applyVisibility();
        } else {
          applyVisibility();
        }
      } finally {
        decorating = false;
      }
    }

    function revealCurrentLesson() {
      if (!isSheetTab() || st.lesson?.source !== 'google-sheet') return;
      const courseId = st.lesson.courseId || '';
      const block = [...list.querySelectorAll('.course-block')].find(item => item.dataset.courseId === courseId);
      if (!block) return;
      openGroup = block.dataset.sheetGroup || '';
      openCourseId = courseId;
      expandCourse(block, false);
      const lessonButton = block.querySelector(`.lesson-btn[data-lesson-id="${CSS.escape(st.lesson.id)}"]`);
      smoothScroll(lessonButton || block, 120);
    }

    list.addEventListener('click', event => {
      const heading = event.target.closest('.sheet-group-heading');
      if (heading) {
        event.preventDefault();
        event.stopPropagation();
        toggleGroup(heading);
        return;
      }

      const courseButton = event.target.closest('.course-btn');
      if (courseButton && isSheetTab()) {
        const block = courseButton.closest('.course-block');
        if (!block) return;
        openGroup = block.dataset.sheetGroup || openGroup;
        openCourseId = block.dataset.courseId || openCourseId;
        list.querySelectorAll('.course-block').forEach(item => {
          if (item !== block) collapseCourse(item);
        });
        applyVisibility();
        setTimeout(() => {
          if (block.isConnected && block.classList.contains('open')) smoothScroll(block, 40);
        }, 40);
      }

      const lessonButton = event.target.closest('.lesson-btn');
      if (lessonButton && isSheetTab()) {
        const block = lessonButton.closest('.course-block');
        if (block) {
          openGroup = block.dataset.sheetGroup || openGroup;
          openCourseId = block.dataset.courseId || openCourseId;
        }
      }
    }, true);

    list.addEventListener('keydown', event => {
      const heading = event.target.closest('.sheet-group-heading');
      if (!heading || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      toggleGroup(heading);
    });

    document.addEventListener('click', event => {
      if (event.target.closest('.library-tab[data-tab="sheet"]')) {
        openGroup = '';
        openCourseId = '';
        setTimeout(decorate, 0);
      }
      if (event.target.closest('.library-fab')) {
        setTimeout(() => {
          decorate();
          revealCurrentLesson();
        }, 80);
      }
    }, true);

    const observer = new MutationObserver(() => {
      if (!decorating) queueMicrotask(decorate);
    });
    observer.observe(list, { childList: true, subtree: true });

    window.sheetGroupCollapse = {
      closeAll() {
        openGroup = '';
        openCourseId = '';
        list.querySelectorAll('.course-block').forEach(collapseCourse);
        applyVisibility();
      },
      revealCurrent: revealCurrentLesson,
      refresh: decorate
    };

    decorate();
  } catch (error) {
    try { console.warn('[sheet-group-collapse disabled]', error); } catch (_) {}
  }
})();
