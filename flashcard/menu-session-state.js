// Preserve the lesson drawer state during one page session.
// A real reload starts from the first visible tab again.
(() => {
  try {
    const $ = selector => document.querySelector(selector);
    const OPEN_TRIGGERS = '#selectedLessonBox,#bottomLessonBtn,.library-fab,#openMenu';
    const view = {
      initialized: false,
      tab: '',
      panelTop: 0,
      tabsLeft: 0,
      openCourseIds: [],
      openSheetGroup: '',
      searchValue: ''
    };
    let restoring = false;
    let bound = false;
    let lastDrawerOpen = document.body.classList.contains('library-open');

    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    function elements() {
      const panel = $('.library-panel');
      return {
        panel,
        tabs: panel?.querySelector('.library-tabs') || null,
        list: $('#lessonList')
      };
    }

    function capture() {
      if (restoring) return;
      const { panel, tabs, list } = elements();
      if (!panel || !tabs) return;
      view.tab = tabs.querySelector('.library-tab.active')?.dataset.tab || view.tab;
      view.panelTop = panel.scrollTop;
      view.tabsLeft = tabs.scrollLeft;
      view.searchValue = $('#librarySearchInput')?.value || '';
      view.openCourseIds = [...(list?.querySelectorAll('.course-block.open[data-course-id]') || [])]
        .map(node => node.dataset.courseId)
        .filter(Boolean);
      view.openSheetGroup = list?.querySelector('.sheet-group-heading.open[data-sheet-group]')?.dataset.sheetGroup || '';
    }

    function restoreCourseState() {
      const { list } = elements();
      if (!list || list.classList.contains('recent-tab-list')) return;

      if (view.openSheetGroup && typeof window.openSheetStudyGroup === 'function') {
        window.openSheetStudyGroup(view.openSheetGroup, false);
      }

      const wanted = new Set(view.openCourseIds);
      list.querySelectorAll('.course-block[data-course-id]').forEach(block => {
        const open = wanted.has(block.dataset.courseId);
        block.classList.toggle('open', open);
        const lessons = block.querySelector('.course-lessons');
        if (lessons) lessons.style.display = open ? 'grid' : 'none';
      });
    }

    function restoreScroll() {
      const { panel, tabs } = elements();
      if (!panel || !tabs) return;
      panel.scrollTop = view.panelTop;
      tabs.scrollLeft = view.tabsLeft;
    }

    async function restore() {
      const { panel, tabs } = elements();
      if (!panel || !tabs || !view.initialized) return;
      restoring = true;
      try {
        window.flashcardLibraryTools?.arrange?.();
        await wait(0);

        const active = tabs.querySelector('.library-tab.active');
        const target = view.tab ? tabs.querySelector(`.library-tab[data-tab="${view.tab}"]`) : null;

        // Normally the drawer DOM never changes while hidden, so no tab click is needed.
        // Only repair a missing active tab when no study session is running; switching a tab
        // during study would clear the current flashcard session in the legacy category loader.
        if ((!active || active.dataset.tab !== view.tab) && target && !window.st?.session?.length) {
          target.click();
          await wait(90);
        } else if (target && active !== target) {
          tabs.querySelectorAll('.library-tab').forEach(button =>
            button.classList.toggle('active', button === target)
          );
        }

        const search = $('#librarySearchInput');
        if (search && search.value !== view.searchValue) search.value = view.searchValue;
        restoreCourseState();
        restoreScroll();
        requestAnimationFrame(restoreScroll);
        setTimeout(restoreScroll, 80);
      } finally {
        setTimeout(() => { restoring = false; }, 100);
      }
    }

    async function activateFirstTabOnce() {
      if (view.initialized) return true;
      const { panel, tabs } = elements();
      if (!panel || !tabs || !window.flashcardLibraryTools) return false;
      window.flashcardLibraryTools.arrange?.();
      await wait(0);
      const firstTab = tabs.querySelector('.library-tab');
      if (!firstTab) return false;

      restoring = true;
      try {
        firstTab.click();
        await wait(100);
        panel.scrollTop = 0;
        tabs.scrollLeft = 0;
        view.initialized = true;
        view.tab = firstTab.dataset.tab || '';
        view.panelTop = 0;
        view.tabsLeft = 0;
        capture();
      } finally {
        restoring = false;
      }
      return true;
    }

    async function openMenu() {
      document.body.classList.add('library-open');
      if (!view.initialized) await activateFirstTabOnce();
      else await restore();
    }

    function bind() {
      if (bound) return;
      const { panel, tabs } = elements();
      if (!panel || !tabs) return;
      bound = true;

      panel.addEventListener('scroll', capture, { passive: true });
      tabs.addEventListener('scroll', capture, { passive: true });

      // Run at window capture phase so the old study-mode onclick cannot reset the
      // tab and scroll position before this session-state handler runs.
      window.addEventListener('click', event => {
        const trigger = event.target.closest?.(OPEN_TRIGGERS);
        if (!trigger) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        openMenu();
      }, true);

      document.addEventListener('click', event => {
        if (event.target.closest('.library-tab,.course-btn,.sheet-group-heading,.lesson-btn,#drawerBackdrop')) {
          capture();
          setTimeout(capture, 140);
        }
      }, true);

      new MutationObserver(() => {
        const open = document.body.classList.contains('library-open');
        if (lastDrawerOpen && !open) capture();
        lastDrawerOpen = open;
      }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    async function boot() {
      for (let attempt = 0; attempt < 400; attempt += 1) {
        if (elements().tabs && window.flashcardLibraryTools) {
          bind();
          await activateFirstTabOnce();
          capture();
          window.flashcardMenuSession = { capture, restore, open: openMenu, state: view };
          return;
        }
        await wait(25);
      }
    }

    boot();
  } catch (error) {
    try { console.warn('[menu-session-state disabled]', error); } catch (_) {}
  }
})();
