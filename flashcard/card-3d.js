// Stable card transition: fade current content out, swap while hidden, then fade the next content in.
(() => {
  try {
    if (!window.st || !window.e) return;
    const card = () => document.querySelector('#card');
    const content = () => card()?.querySelector('.card-inner');
    const OUT_MS = 105;
    const IN_MS = 145;
    let switching = false;
    let cleanupTimer = 0;

    function clearClasses() {
      clearTimeout(cleanupTimer);
      const element = card();
      element?.classList.remove(
        'fc-card-leaving',
        'fc-card-entering',
        'fc-card-transitioning',
        'fc-animating',
        'fc-pop',
        'fc-flip',
        'fc-next',
        'fc-prev',
        'fc-tap',
        'fc-pulse'
      );
      document.body.classList.remove('card-switching');
      switching = false;
    }

    function shouldAnimate() {
      return !!card()
        && !!content()
        && !!st.session?.length
        && !st.done
        && !document.body.classList.contains('auto-card-focus')
        && !document.body.classList.contains('force-card-focus')
        && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    }

    function runChange(change) {
      try { return change?.(); }
      catch (error) {
        clearClasses();
        throw error;
      }
    }

    window.smoothCardTransition = function smoothCardTransition(change) {
      if (typeof change !== 'function') return false;
      if (switching || !shouldAnimate()) {
        runChange(change);
        return false;
      }

      const element = card();
      switching = true;
      document.body.classList.add('card-switching');
      element.classList.remove('fc-card-entering');
      element.classList.add('fc-card-transitioning', 'fc-card-leaving');

      setTimeout(() => {
        if (!switching) return;
        runChange(change);

        const nextElement = card();
        const nextContent = content();
        if (!nextElement || !nextContent) {
          clearClasses();
          return;
        }

        nextElement.classList.remove('fc-card-leaving');
        nextElement.classList.add('fc-card-entering', 'fc-card-transitioning');

        // The new content is already painted at opacity 0. Start only the fade-in next frame.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            nextElement.classList.remove('fc-card-entering');
            cleanupTimer = setTimeout(clearClasses, IN_MS + 35);
          });
        });
      }, OUT_MS);
      return true;
    };

    window.cancelSmoothCardTransition = clearClasses;
    clearClasses();
    try { if (typeof log === 'function') log('Smooth card fade loaded.'); } catch (_) {}
  } catch (error) {
    try { console.warn('[card fade disabled]', error); } catch (_) {}
  }
})();
