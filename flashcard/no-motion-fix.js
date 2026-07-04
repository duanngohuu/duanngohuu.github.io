// Final guard: no card motion and no competing multi-face hint text.
(() => {
  try {
    const card = document.querySelector('#card');
    const hint = window.e?.hint || document.querySelector('#cardHint');
    const motionClasses = [
      'fc-card-leaving', 'fc-card-entering', 'fc-card-transitioning',
      'fc-animating', 'fc-pop', 'fc-flip', 'fc-next', 'fc-prev', 'fc-tap', 'fc-pulse'
    ];

    function clearMotion() {
      card?.classList.remove(...motionClasses);
      document.body.classList.remove('card-switching');
    }

    function isMultiFaceRunning() {
      const current = window.st?.session?.[window.st?.i];
      return !!current?.faces?.length;
    }

    if (hint && !hint.__multiFaceHintGuarded) {
      const descriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
      if (descriptor?.get && descriptor?.set) {
        Object.defineProperty(hint, 'textContent', {
          configurable: true,
          enumerable: true,
          get() { return descriptor.get.call(this); },
          set(value) {
            const text = String(value ?? '');
            const legacyHint = /^(Mặt trước:|Mặt sau:|Đang xem mặt|Cưỡng chế xem)/.test(text);
            if (isMultiFaceRunning() && legacyHint) return;
            descriptor.set.call(this, text);
          }
        });
        hint.__multiFaceHintGuarded = true;
      }
    }

    window.smoothCardTransition = function immediateCardChange(change) {
      clearMotion();
      if (typeof change === 'function') change();
      clearMotion();
      return false;
    };
    window.cancelSmoothCardTransition = clearMotion;

    const oldRender = window.render;
    if (typeof oldRender === 'function' && !oldRender.__noMotionFinalWrapped) {
      window.render = function noMotionFinalRender() {
        clearMotion();
        const result = oldRender();
        clearMotion();
        return result;
      };
      window.render.__noMotionFinalWrapped = true;
    }

    clearMotion();
  } catch (error) {
    try { console.warn('[no-motion-fix disabled]', error); } catch (_) {}
  }
})();
