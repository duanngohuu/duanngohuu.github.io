// Sync dark mode between navbar button and the display-settings popup.
(() => {
  try {
    const KEY = 'fc_vocab_theme_v2';
    const root = document.documentElement;
    const $ = s => document.querySelector(s);

    function isDark() {
      return root.classList.contains('dark');
    }
    function save(on) {
      try { localStorage.setItem(KEY, on ? 'dark' : 'light'); } catch (_) {}
    }
    function setDark(on) {
      root.classList.toggle('dark', !!on);
      save(!!on);
      sync();
    }
    function sync() {
      const input = $('#darkThemeSetting');
      if (input) input.checked = isDark();
      const nav = $('#themeToggle');
      if (nav) {
        nav.setAttribute('aria-label', isDark() ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối');
        nav.title = isDark() ? 'Chế độ sáng' : 'Chế độ tối';
      }
    }
    function build() {
      const popup = $('.display-settings-popup');
      if (!popup) return false;
      if (!$('#darkThemeSetting')) {
        const section = document.createElement('div');
        section.className = 'display-settings-general';
        section.innerHTML = `
          <label class="display-setting-row display-theme-row" for="darkThemeSetting">
            <span>Chế độ tối</span>
            <input id="darkThemeSetting" type="checkbox">
            <i></i>
          </label>`;
        const tabs = popup.querySelector('.display-settings-tabs');
        if (tabs) tabs.before(section);
        else popup.querySelector('header')?.after(section);
        const input = section.querySelector('#darkThemeSetting');
        input.onchange = () => setDark(input.checked);
      }
      sync();
      return true;
    }

    const bodyObserver = new MutationObserver(() => {
      if (build()) bodyObserver.disconnect();
    });
    if (!build()) bodyObserver.observe(document.body, { childList: true, subtree: true });

    const themeObserver = new MutationObserver(sync);
    themeObserver.observe(root, { attributes: true, attributeFilter: ['class'] });

    document.addEventListener('click', ev => {
      if (ev.target.closest('#themeToggle,#displaySettingsBtn')) setTimeout(() => { build(); sync(); }, 0);
    }, true);

    sync();
  } catch (error) {
    try { console.warn('[theme-settings disabled]', error); } catch (_) {}
  }
})();
