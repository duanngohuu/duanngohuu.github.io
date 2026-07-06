// Move the Soumatome JP–VI / JP–EN selector out of the study toolbar and into display settings.
(() => {
  try {
    if (window.__bookLanguageSettingsLoaded) return;
    window.__bookLanguageSettingsLoaded = true;

    let scheduled = false;
    let observer = null;

    function placeControls() {
      scheduled = false;
      const controls = document.querySelector('#bookLanguageMode');
      const popup = document.querySelector('.display-settings-popup');
      if (!controls || !popup) return false;

      controls.classList.add('book-language-in-settings');
      const title = controls.querySelector(':scope > span');
      if (title) title.textContent = 'Ngôn ngữ nghĩa';

      const tabs = popup.querySelector('.display-settings-tabs');
      const general = popup.querySelector('.display-settings-general');
      const anchor = general || popup.querySelector('header');
      if (controls.parentElement !== popup) {
        if (tabs) popup.insertBefore(controls, tabs);
        else if (anchor) anchor.after(controls);
        else popup.appendChild(controls);
      } else if (tabs && controls.nextElementSibling !== tabs) {
        popup.insertBefore(controls, tabs);
      }
      return true;
    }

    function schedule() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(placeControls);
    }

    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('click', event => {
      if (event.target.closest('#displaySettingsBtn,.book-lesson,.lesson-btn,#startBtn')) {
        schedule();
        setTimeout(placeControls, 80);
      }
    }, true);

    window.addEventListener('pageshow', schedule);
    schedule();
  } catch (error) {
    try { console.warn('[book-language-settings disabled]', error); } catch (_) {}
  }
})();