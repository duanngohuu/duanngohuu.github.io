// Draggable study-support bubble for touch, pointer and mouse devices.
(() => {
  try {
    const KEY = 'fc_study_support_position_v2';
    const MOVE_THRESHOLD = 7;
    const EDGE_GAP = 8;
    let active = null;
    let restoreTimer = 0;

    function viewportBox() {
      const viewport = window.visualViewport;
      return {
        left: viewport?.offsetLeft || 0,
        top: viewport?.offsetTop || 0,
        width: viewport?.width || window.innerWidth,
        height: viewport?.height || window.innerHeight
      };
    }

    function trigger() {
      return document.querySelector('#studySupportTrigger');
    }

    function clamp(left, top, element) {
      const viewport = viewportBox();
      const width = element.offsetWidth || element.getBoundingClientRect().width || 1;
      const height = element.offsetHeight || element.getBoundingClientRect().height || 1;
      const minLeft = viewport.left + EDGE_GAP;
      const minTop = viewport.top + EDGE_GAP;
      const maxLeft = Math.max(minLeft, viewport.left + viewport.width - width - EDGE_GAP);
      const maxTop = Math.max(minTop, viewport.top + viewport.height - height - EDGE_GAP);
      return {
        left: Math.min(maxLeft, Math.max(minLeft, left)),
        top: Math.min(maxTop, Math.max(minTop, top)),
        viewport,
        width,
        height
      };
    }

    function applyPosition(element, left, top, persist = false) {
      if (!element || element.classList.contains('hidden')) return;
      const position = clamp(left, top, element);
      element.style.setProperty('left', `${Math.round(position.left)}px`, 'important');
      element.style.setProperty('top', `${Math.round(position.top)}px`, 'important');
      element.style.setProperty('right', 'auto', 'important');
      element.style.setProperty('bottom', 'auto', 'important');
      element.dataset.dragPositioned = '1';

      if (!persist) return;
      const horizontalSpace = Math.max(1, position.viewport.width - position.width - EDGE_GAP * 2);
      const verticalSpace = Math.max(1, position.viewport.height - position.height - EDGE_GAP * 2);
      try {
        localStorage.setItem(KEY, JSON.stringify({
          x: Math.min(1, Math.max(0, (position.left - position.viewport.left - EDGE_GAP) / horizontalSpace)),
          y: Math.min(1, Math.max(0, (position.top - position.viewport.top - EDGE_GAP) / verticalSpace))
        }));
      } catch (_) {}
    }

    function savedPosition() {
      try {
        const value = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (Number.isFinite(value?.x) && Number.isFinite(value?.y)) return value;
      } catch (_) {}
      return null;
    }

    function restorePosition() {
      clearTimeout(restoreTimer);
      const element = trigger();
      if (!element || element.classList.contains('hidden') || !element.offsetWidth) {
        restoreTimer = setTimeout(restorePosition, 120);
        return;
      }
      bindTrigger(element);
      const saved = savedPosition();
      if (!saved) return;
      const viewport = viewportBox();
      const width = element.offsetWidth || 1;
      const height = element.offsetHeight || 1;
      const horizontalSpace = Math.max(1, viewport.width - width - EDGE_GAP * 2);
      const verticalSpace = Math.max(1, viewport.height - height - EDGE_GAP * 2);
      applyPosition(
        element,
        viewport.left + EDGE_GAP + horizontalSpace * saved.x,
        viewport.top + EDGE_GAP + verticalSpace * saved.y,
        false
      );
    }

    function pointFromEvent(event) {
      if (event.touches?.length) return event.touches[0];
      if (event.changedTouches?.length) return event.changedTouches[0];
      return event;
    }

    function startDrag(element, event, kind) {
      const point = pointFromEvent(event);
      if (!point || (kind === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = element.getBoundingClientRect();
      active = {
        element,
        kind,
        pointerId: event.pointerId,
        touchId: point.identifier,
        startX: point.clientX,
        startY: point.clientY,
        offsetX: point.clientX - rect.left,
        offsetY: point.clientY - rect.top,
        moved: false
      };
      element.classList.add('is-dragging');
      if (kind === 'pointer') {
        try { element.setPointerCapture?.(event.pointerId); } catch (_) {}
      }
    }

    function moveDrag(event) {
      if (!active) return;
      if (active.kind === 'pointer' && event.pointerId !== active.pointerId) return;
      const point = pointFromEvent(event);
      if (!point) return;
      if (active.kind === 'touch' && active.touchId != null && point.identifier !== active.touchId) return;

      const dx = point.clientX - active.startX;
      const dy = point.clientY - active.startY;
      if (!active.moved && Math.hypot(dx, dy) >= MOVE_THRESHOLD) active.moved = true;
      if (!active.moved) return;

      event.preventDefault();
      event.stopPropagation();
      applyPosition(active.element, point.clientX - active.offsetX, point.clientY - active.offsetY, false);
    }

    function endDrag(event, cancelled = false) {
      if (!active) return;
      if (active.kind === 'pointer' && event.pointerId !== active.pointerId) return;
      const current = active;
      active = null;
      event.preventDefault();
      event.stopPropagation();
      current.element.classList.remove('is-dragging');
      if (current.kind === 'pointer') {
        try { current.element.releasePointerCapture?.(current.pointerId); } catch (_) {}
      }

      if (current.moved && !cancelled) {
        const rect = current.element.getBoundingClientRect();
        applyPosition(current.element, rect.left, rect.top, true);
      } else if (!cancelled) {
        window.studySupportMenu?.open?.();
      }
    }

    function bindTrigger(original) {
      if (!original || original.dataset.dragBound === '1') return original;

      // Replace the original node to remove the old pointerdown handler that opened the menu before dragging.
      const element = original.cloneNode(true);
      element.dataset.dragBound = '1';
      element.style.cssText = original.style.cssText;
      original.replaceWith(element);

      element.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
      }, true);

      if (window.PointerEvent) {
        element.addEventListener('pointerdown', event => startDrag(element, event, 'pointer'), { passive: false });
        window.addEventListener('pointermove', moveDrag, { passive: false, capture: true });
        window.addEventListener('pointerup', event => endDrag(event, false), { passive: false, capture: true });
        window.addEventListener('pointercancel', event => endDrag(event, true), { passive: false, capture: true });
      } else {
        element.addEventListener('touchstart', event => startDrag(element, event, 'touch'), { passive: false });
        window.addEventListener('touchmove', moveDrag, { passive: false, capture: true });
        window.addEventListener('touchend', event => endDrag(event, false), { passive: false, capture: true });
        window.addEventListener('touchcancel', event => endDrag(event, true), { passive: false, capture: true });
        element.addEventListener('mousedown', event => startDrag(element, event, 'mouse'));
        window.addEventListener('mousemove', moveDrag, true);
        window.addEventListener('mouseup', event => endDrag(event, false), true);
      }
      return element;
    }

    function keepInsideViewport() {
      const element = trigger();
      if (!element || element.classList.contains('hidden') || element.dataset.dragPositioned !== '1') return;
      const rect = element.getBoundingClientRect();
      applyPosition(element, rect.left, rect.top, true);
    }

    const observer = new MutationObserver(() => {
      const element = trigger();
      if (!element) return;
      bindTrigger(element);
      if (!element.classList.contains('hidden')) restorePosition();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    window.addEventListener('resize', keepInsideViewport);
    window.addEventListener('orientationchange', () => setTimeout(restorePosition, 180));
    window.visualViewport?.addEventListener('resize', keepInsideViewport);
    window.addEventListener('pageshow', () => setTimeout(restorePosition, 80));

    window.studySupportDrag = { restore: restorePosition };
    const initial = trigger();
    if (initial) bindTrigger(initial);
    restorePosition();
  } catch (error) {
    try { console.warn('[study-support-drag disabled]', error); } catch (_) {}
  }
})();
