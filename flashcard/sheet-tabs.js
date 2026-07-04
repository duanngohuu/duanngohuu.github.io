// Insert the live Google Sheets library as the first horizontally scrollable tab.
(() => {
  try {
    const tabs = document.querySelector('.library-tabs');
    if (!tabs || tabs.querySelector('[data-tab="sheet"]')) return;
    const button = document.createElement('button');
    button.className = 'library-tab active';
    button.type = 'button';
    button.dataset.tab = 'sheet';
    button.textContent = 'Kho học';
    tabs.querySelectorAll('.library-tab').forEach(item => item.classList.remove('active'));
    tabs.prepend(button);
  } catch (error) {
    try { console.warn('[sheet-tabs disabled]', error); } catch (_) {}
  }
})();
