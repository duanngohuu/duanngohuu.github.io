(() => {
  function bootSidebar() {
    const library = document.querySelector('aside.panel.glass');
    if (!library) return;
    library.classList.add('library-panel');

    const titleBox = library.querySelector('.title-row');
    if (titleBox && !library.querySelector('.library-type')) {
      const type = document.createElement('div');
      type.className = 'library-type';
      type.textContent = '📚 Từ vựng';
      titleBox.after(type);
    }

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'open-library-btn';
    openBtn.textContent = '☰ Bài học';
    document.body.appendChild(openBtn);

    const backdrop = document.createElement('div');
    backdrop.className = 'drawer-backdrop';
    document.body.appendChild(backdrop);

    const open = () => document.body.classList.add('library-open');
    const close = () => document.body.classList.remove('library-open');

    openBtn.addEventListener('click', open);
    backdrop.addEventListener('click', close);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
    document.addEventListener('click', (event) => {
      if (event.target.closest('.lesson-btn')) close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootSidebar);
  } else {
    bootSidebar();
  }
})();
