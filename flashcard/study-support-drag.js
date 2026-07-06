// Smooth draggable study-support bubble using one transform update per animation frame.
(() => {
  try {
    if (window.__studySupportDragLoaded) return;
    window.__studySupportDragLoaded = true;

    const KEY = 'fc_study_support_position_v4';
    const LEGACY_KEYS = ['fc_study_support_position_v3', 'fc_study_support_position_v2'];
    const MOVE_THRESHOLD = 6;
    const EDGE_GAP = 8;
    let active = null;
    let frame = 0;
    let restoreTimer = 0;
    let globalBound = false;
    let triggerObserver = null;

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

    function geometry(element) {
      const viewport = viewportBox();
      const rect = element.getBoundingClientRect();
      const width = rect.width || element.offsetWidth || 1;
      const height = rect.height || element.offsetHeight || 1;
      const minLeft = viewport.left + EDGE_GAP;
      const minTop = viewport.top + EDGE_GAP;
      return {
        viewport,
        width,
        height,
        minLeft,
        minTop,
        maxLeft: Math.max(minLeft, viewport.left + viewport.width - width - EDGE_GAP),
        maxTop: Math.max(minTop, viewport.top + viewport.height - height - EDGE_GAP)
      };
    }

    function clampWithBox(left, top, box) {
      return {
        left: Math.min(box.maxLeft, Math.max(box.minLeft, left)),
        top: Math.min(box.maxTop, Math.max(box.minTop, top))
      };
    }

    function persistPosition(left, top, box) {
      const horizontalSpace = Math.max(1, box.viewport.width - box.width - EDGE_GAP * 2);
      const verticalSpace = Math.max(1, box.viewport.height - box.height - EDGE_GAP * 2);
      try {
        localStorage.setItem(KEY, JSON.stringify({
          x: Math.min(1, Math.max(0, (left - box.viewport.left - EDGE_GAP) / horizontalSpace)),
          y: Math.min(1, Math.max(0, (top - box.viewport.top - EDGE_GAP) / verticalSpace))
        }));
      } catch (_) {}
    }

    function commitPosition(element, left, top, persist = false, box = geometry(element)) {
      if (!element || element.classList.contains('hidden')) return;
      const next = clampWithBox(left, top, box);
      element.style.setProperty('left', `${Math.round(next.left)}px`, 'important');
      element.style.setProperty('top', `${Math.round(next.top)}px`, 'important');
      element.style.setProperty('right', 'auto', 'important');
      element.style.setProperty('bottom', 'auto', 'important');
      element.style.setProperty('transform', 'translate3d(0,0,0)', 'important');
      element.dataset.dragPositioned = '1';
      if (persist) persistPosition(next.left, next.top, box);
    }

    function savedPosition() {
      for (const key of [KEY, ...LEGACY_KEYS]) {
        try {
          const value = JSON.parse(localStorage.getItem(key) || 'null');
          if (Number.isFinite(value?.x) && Number.isFinite(value?.y)) return value;
        } catch (_) {}
      }
      return null;
    }

    function restorePosition() {
      clearTimeout(restoreTimer);
      const element = trigger();
      if (!element || element.classList.contains('hidden') || !element.offsetWidth) {
        restoreTimer = setTimeout(restorePosition, 100);
        return;
      }
      bindTrigger(element);
      const saved = savedPosition();
      if (!saved) return;
      const box = geometry(element);
      const horizontalSpace = Math.max(1, box.viewport.width - box.width - EDGE_GAP * 2);
      const verticalSpace = Math.max(1, box.viewport.height - box.height - EDGE_GAP * 2);
      commitPosition(
        element,
        box.viewport.left + EDGE_GAP + horizontalSpace * saved.x,
        box.viewport.top + EDGE_GAP + verticalSpace * saved.y,
        false,
        box
      );
    }

    function pointFromEvent(event) {
      if (event.touches?.length) return event.touches[0];
      if (event.changedTouches?.length) return event.changedTouches[0];
      return event;
    }

    function schedulePaint() {
      if (!active || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!active || !active.moved) return;
        const next = clampWithBox(active.targetLeft, active.targetTop, active.box);
        active.finalLeft = next.left;
        active.finalTop = next.top;
        const dx = next.left - active.startLeft;
        const dy = next.top - active.startTop;
        active.element.style.setProperty('transform', `translate3d(${dx}px,${dy}px,0)`, 'important');
      });
    }

    function startDrag(element, event, kind) {
      const point = pointFromEvent(event);
      if (!point || (kind === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const rect = element.getBoundingClientRect();
      const box = geometry(element);
      active = {
        element,
        kind,
        pointerId: event.pointerId,
        touchId: point.identifier,
        startX: point.clientX,
        startY: point.clientY,
        startLeft: rect.left,
        startTop: rect.top,
        offsetX: point.clientX - rect.left,
        offsetY: point.clientY - rect.top,
        targetLeft: rect.left,
        targetTop: rect.top,
        finalLeft: rect.left,
        finalTop: rect.top,
        moved: false,
        box
      };
      element.classList.add('is-dragging');
      element.style.setProperty('will-change', 'transform', 'important');
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
      event.stopImmediatePropagation();
      active.targetLeft = point.clientX - active.offsetX;
      active.targetTop = point.clientY - active.offsetY;
      schedulePaint();
    }

    function endDrag(event, cancelled = false) {
      if (!active) return;
      if (active.kind === 'pointer' && event.pointerId !== active.pointerId) return;
      const current = active;
      active = null;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      event.preventDefault();
      event.stopImmediatePropagation();
      current.element.classList.remove('is-dragging');
      current.element.style.removeProperty('will-change');
      if (current.kind === 'pointer') {
        try { current.element.releasePointerCapture?.(current.pointerId); } catch (_) {}
      }

      if (current.moved && !cancelled) {
        const next = clampWithBox(current.targetLeft, current.targetTop, current.box);
        commitPosition(current.element, next.left, next.top, true, current.box);
        return;
      }
      current.element.style.setProperty('transform', 'translate3d(0,0,0)', 'important');
      if (!cancelled) requestAnimationFrame(() => window.studySupportMenu?.open?.());
    }

    function bindGlobalEvents() {
      if (globalBound) return;
      globalBound = true;
      if (window.PointerEvent) {
        window.addEventListener('pointermove', moveDrag, { passive: false, capture: true });
        window.addEventListener('pointerup', event => endDrag(event, false), { passive: false, capture: true });
        window.addEventListener('pointercancel', event => endDrag(event, true), { passive: false, capture: true });
      } else {
        window.addEventListener('touchmove', moveDrag, { passive: false, capture: true });
        window.addEventListener('touchend', event => endDrag(event, false), { passive: false, capture: true });
        window.addEventListener('touchcancel', event => endDrag(event, true), { passive: false, capture: true });
        window.addEventListener('mousemove', moveDrag, true);
        window.addEventListener('mouseup', event => endDrag(event, false), true);
      }
    }

    function watchTrigger(element) {
      triggerObserver?.disconnect();
      triggerObserver = new MutationObserver(() => {
        if (!element.classList.contains('hidden')) requestAnimationFrame(restorePosition);
      });
      triggerObserver.observe(element, { attributes: true, attributeFilter: ['class'] });
    }

    function bindTrigger(element) {
      if (!element) return element;
      if (element.dataset.dragBound !== '1') {
        element.dataset.dragBound = '1';
        element.addEventListener('click', event => {
          event.preventDefault();
          event.stopImmediatePropagation();
        }, true);
        if (window.PointerEvent) {
          element.addEventListener('pointerdown', event => startDrag(element, event, 'pointer'), { passive: false, capture: true });
        } else {
          element.addEventListener('touchstart', event => startDrag(element, event, 'touch'), { passive: false, capture: true });
          element.addEventListener('mousedown', event => startDrag(element, event, 'mouse'), true);
        }
      }
      watchTrigger(element);
      bindGlobalEvents();
      return element;
    }

    function keepInsideViewport() {
      const element = trigger();
      if (!element || element.classList.contains('hidden') || element.dataset.dragPositioned !== '1') return;
      const rect = element.getBoundingClientRect();
      commitPosition(element, rect.left, rect.top, true);
    }

    const treeObserver = new MutationObserver(() => {
      const element = trigger();
      if (!element || element.dataset.dragBound === '1') return;
      bindTrigger(element);
      restorePosition();
    });
    treeObserver.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('resize', keepInsideViewport, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(restorePosition, 160), { passive: true });
    window.visualViewport?.addEventListener('resize', keepInsideViewport, { passive: true });
    window.addEventListener('pageshow', () => setTimeout(restorePosition, 60));

    window.studySupportDrag = { restore: restorePosition };
    const initial = trigger();
    if (initial) bindTrigger(initial);
    restorePosition();
  } catch (error) {
    try { console.warn('[study-support-drag disabled]', error); } catch (_) {}
  }
})();