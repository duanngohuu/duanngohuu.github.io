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

    function loadSystemSettings() {
      const navActions = $('.nav-actions');
      const themeButton = $('#themeToggle');
      if (navActions && !$('#systemSettingsBtn')) {
        const button = document.createElement('button');
        button.id = 'systemSettingsBtn';
        button.className = 'icon-btn system-settings-nav-btn';
        button.type = 'button';
        button.title = 'Cài đặt hệ thống';
        button.setAttribute('aria-label', 'Cài đặt hệ thống');
        button.textContent = '⚙';
        if (themeButton) navActions.insertBefore(button, themeButton);
        else navActions.appendChild(button);
      }
      if (!document.querySelector('link[data-system-settings-style]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = './system-settings.css?v=20260704-system1';
        link.dataset.systemSettingsStyle = '1';
        document.head.appendChild(link);
      }
      if (!document.querySelector('script[data-system-settings-script]')) {
        const script = document.createElement('script');
        script.src = './system-settings.js?v=20260704-system1';
        script.dataset.systemSettingsScript = '1';
        document.body.appendChild(script);
      }
    }

    function loadDownloadStatus() {
      if (!document.querySelector('link[data-download-status-style]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = './download-status.css?v=20260704-download1';
        link.dataset.downloadStatusStyle = '1';
        document.head.appendChild(link);
      }
      if (!document.querySelector('script[data-download-status-script]')) {
        const script = document.createElement('script');
        script.src = './download-status.js?v=20260704-download1';
        script.dataset.downloadStatusScript = '1';
        document.body.appendChild(script);
      }
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

    loadSystemSettings();
    loadDownloadStatus();
    sync();
  } catch (error) {
    try { console.warn('[theme-settings disabled]', error); } catch (_) {}
  }
})();
