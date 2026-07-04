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

    function hideLegacyDisplayToggles() {
      if (!$('#legacyDisplayTogglePolicy')) {
        const style = document.createElement('style');
        style.id = 'legacyDisplayTogglePolicy';
        style.textContent = `
          .card-options>label:has(#readingInput),
          .card-options>label:has(#hideKanjiInput){display:none!important}`;
        document.head.appendChild(style);
      }

      const apply = () => {
        ['readingInput', 'hideKanjiInput'].forEach(id => {
          const label = document.getElementById(id)?.closest('label');
          if (!label) return;
          label.classList.add('display-option-hidden');
          label.hidden = true;
          label.style.setProperty('display', 'none', 'important');
          label.setAttribute('aria-hidden', 'true');
        });
      };

      apply();
      const options = document.querySelector('.card-options');
      if (options && options.dataset.legacyDisplayToggleObserved !== '1') {
        options.dataset.legacyDisplayToggleObserved = '1';
        new MutationObserver(apply).observe(options, { childList: true, subtree: true });
      }
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
      const version = '20260704-download2';
      let link = document.querySelector('link[data-download-status-style]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'stylesheet';
        link.dataset.downloadStatusStyle = '1';
        document.head.appendChild(link);
      }
      const cssHref = `./download-status.css?v=${version}`;
      if (!link.href.includes(version)) link.href = cssHref;

      let script = document.querySelector('script[data-download-status-script]');
      if (script && script.dataset.downloadStatusVersion !== version) {
        script.remove();
        script = null;
      }
      if (!script) {
        script = document.createElement('script');
        script.src = `./download-status.js?v=${version}`;
        script.dataset.downloadStatusScript = '1';
        script.dataset.downloadStatusVersion = version;
        document.body.appendChild(script);
      }
    }

    function loadBatchProgress() {
      const version = '20260704-batch1';
      let script = document.querySelector('script[data-batch-progress-script]');
      if (script && script.dataset.batchProgressVersion !== version) {
        script.remove();
        script = null;
      }
      if (!script) {
        script = document.createElement('script');
        script.src = `./batch-progress.js?v=${version}`;
        script.dataset.batchProgressScript = '1';
        script.dataset.batchProgressVersion = version;
        document.body.appendChild(script);
      }
    }

    function loadStartupUnlock() {
      const version = '20260704-unlock1';
      let script = document.querySelector('script[data-startup-unlock-script]');
      if (script && script.dataset.startupUnlockVersion !== version) {
        script.remove();
        script = null;
      }
      if (!script) {
        script = document.createElement('script');
        script.src = `./startup-unlock.js?v=${version}`;
        script.dataset.startupUnlockScript = '1';
        script.dataset.startupUnlockVersion = version;
        document.body.appendChild(script);
      }
    }

    function loadLocalMultiface() {
      const version = '20260705-localfaces1';
      let script = document.querySelector('script[data-local-multiface-script]');
      if (script && script.dataset.localMultifaceVersion !== version) {
        script.remove();
        script = null;
      }
      if (!script) {
        script = document.createElement('script');
        script.src = `./local-multiface.js?v=${version}`;
        script.dataset.localMultifaceScript = '1';
        script.dataset.localMultifaceVersion = version;
        document.body.appendChild(script);
      }
    }

    const bodyObserver = new MutationObserver(() => {
      hideLegacyDisplayToggles();
      if (build()) bodyObserver.disconnect();
    });
    if (!build()) bodyObserver.observe(document.body, { childList: true, subtree: true });

    const themeObserver = new MutationObserver(sync);
    themeObserver.observe(root, { attributes: true, attributeFilter: ['class'] });

    document.addEventListener('click', ev => {
      if (ev.target.closest('#themeToggle,#displaySettingsBtn')) setTimeout(() => { build(); sync(); }, 0);
    }, true);

    hideLegacyDisplayToggles();
    loadStartupUnlock();
    loadSystemSettings();
    loadDownloadStatus();
    loadBatchProgress();
    loadLocalMultiface();
    sync();
  } catch (error) {
    try { console.warn('[theme-settings disabled]', error); } catch (_) {}
  }
})();
