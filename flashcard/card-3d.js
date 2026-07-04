// Card changes are immediate. No fade, slide, scale, brightness, or delayed swap.
(() => {
  try {
    function clearLegacyMotion() {
      const card = document.querySelector('#card');
      card?.classList.remove(
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
    }

    window.smoothCardTransition = function immediateCardChange(change) {
      clearLegacyMotion();
      if (typeof change === 'function') change();
      clearLegacyMotion();
      return false;
    };

    window.cancelSmoothCardTransition = clearLegacyMotion;
    clearLegacyMotion();
    try { if (typeof log === 'function') log('Card motion disabled.'); } catch (_) {}
  } catch (error) {
    try { console.warn('[card motion disable failed]', error); } catch (_) {}
  }
})();
