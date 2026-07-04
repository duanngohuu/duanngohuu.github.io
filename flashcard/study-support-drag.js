// Make the study-support trigger draggable like a chat bubble and remember its position.
(() => {
  try {
    const KEY = 'fc_study_support_position_v1';
    const MOVE_THRESHOLD = 6;
    const EDGE_GAP = 8;
    let drag = null;
    let restoreTimer = 0;

    const trigger = () => document.querySelector('#studySupportTrigger');

    function viewportBox() {
      const viewport = window.visualViewport;
      return {
        left: viewport?.offsetLeft || 0,
        top: viewport?.offsetTop || 0,
        width: viewport?.width || window.innerWidth,
        height: viewport?.height || window.innerHeight
      };
    }

    function clampPosition(left, top, element) {
      const viewport = viewportBox();
      const rect = element.getBoundingClientRect();
      const minLeft = viewport.left + EDGE_GAP;
      const minTop = viewport.top + EDGE_GAP;
      const maxLeft = Math.max(minLeft, viewport.left + viewport.width - rect.width - EDGE_GAP);
      const maxTop = Math.max(minTop, viewport.top + viewport.height - rect.height - EDGE_GAP);
      return {
        left: Math.min(maxLeft, Math.max(minLeft, left)),
        top: Math.min(maxTop, Math.max(minTop, top)),
        viewport,
        rect
      };
    }

    function setPosition(left, top, persist = false) {
      const element = trigger();
      if (!element || element.classList.contains('hidden')) return false;
      const position = clampPosition(left, top, element);
      element.style.setProperty('left', `${Math.round(position.left)}px`, 'important');
      element.style.setProperty('top', `${Math.round(position.top)}px`, 'important');
      element.style.setProperty('right', 'auto', 'important');
      element.style.setProperty('bottom', 'auto', 'important');
      element.dataset.dragPositioned = '1';

      if (persist) {
        const horizontalSpace = Math.max(1, position.viewport.width - position.rect.width - EDGE_GAP * 2);
        const verticalSpace = Math.max(1, position.viewport.height - position.rect.height - EDGE_GAP * 2);
        const x = (position.left - position.viewport.left - EDGE_GAP) / horizontalSpace;
        const y = (position.top - position.viewport.top - EDGE_GAP) / verticalSpace;
        try {
          localStorage.setItem(KEY, JSON.stringify({
            x: Math.min(1, Math.max(0, x)),
            y: Math.min(1, Math.max(0, y))
          }));
        } catch (_) {}
      }
      return true;
    }

    function restorePosition() {
      clearTimeout(restoreTimer);
      const element = trigger();
      if (!element || element.classList.contains('hidden') || !element.offsetWidth) {
        restoreTimer = setTimeout(restorePosition, 120);
        return;
      }

      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
      if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return;

      const viewport = viewportBox();
      const rect = element.getBoundingClientRect();
      const horizontalSpace = Math.max(1, viewport.width - rect.width - EDGE_GAP * 2);
      const verticalSpace = Math.max(1, viewport.height - rect.height - EDGE_GAP * 2);
      setPosition(
        viewport.left + EDGE_GAP + horizontalSpace * saved.x,
        viewport.top + EDGE_GAP + verticalSpace * saved.y,
        false
      );
    }

    function finishDrag(event, cancelled = false) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const element = trigger();
      event.preventDefault();
      event.stopImmediatePropagation();

      try { element?.releasePointerCapture?.(drag.pointerId); } catch (_) {}
      element?.classList.remove('is-dragging');
      const moved = drag.moved;
      drag = null;

      if (moved && !cancelled && element) {
        const rect = element.getBoundingClientRect();
        setPosition(rect.left, rect.top, true);
      } else if (!moved && !cancelled) {
        setTimeout(() => window.studySupportMenu?.open?.(), 0);
      }
    }

    document.addEventListener('pointerdown', event => {
      const element = event.target.closest?.('#studySupportTrigger');
      if (!element || event.button > 0) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      const rect = element.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        moved: false
      };
      element.classList.add('is-dragging');
      try { element.setPointerCapture?.(event.pointerId); } catch (_) {}
    }, true);

    document.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const distanceX = event.clientX - drag.startX;
      const distanceY = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(distanceX, distanceY) >= MOVE_THRESHOLD) drag.moved = true;
      if (!drag.moved) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      setPosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY, false);
    }, { capture: true, passive: false });

    document.addEventListener('pointerup', event => finishDrag(event, false), true);
    document.addEventListener('pointercancel', event => finishDrag(event, true), true);

    document.addEventListener('click', event => {
      if (!event.target.closest?.('#studySupportTrigger')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.detail === 0) window.studySupportMenu?.open?.();
    }, true);

    const observer = new MutationObserver(() => {
      const element = trigger();
      if (element && !element.classList.contains('hidden')) restorePosition();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    const keepInsideViewport = () => {
      const element = trigger();
      if (!element || element.classList.contains('hidden') || element.dataset.dragPositioned !== '1') return;
      const rect = element.getBoundingClientRect();
      setPosition(rect.left, rect.top, true);
    };

    window.addEventListener('resize', keepInsideViewport);
    window.addEventListener('orientationchange', () => setTimeout(restorePosition, 180));
    window.visualViewport?.addEventListener('resize', keepInsideViewport);
    window.visualViewport?.addEventListener('scroll', keepInsideViewport);
    window.addEventListener('pageshow', () => setTimeout(restorePosition, 80));

    restorePosition();
  } catch (error) {
    try { console.warn('[study-support-drag disabled]', error); } catch (_) {}
  }
})();
