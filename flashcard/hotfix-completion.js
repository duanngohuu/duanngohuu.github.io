// Hotfix: custom finish popup, loop mode, safe end-of-session behavior, and nav/action button states.
(() => {
  try {
    if (!window.st || !window.e) return;
    const LOOP_KEY = 'fc_vocab_loop_v1';
    const logSafe = msg => { try { if (typeof log === 'function') log(msg); } catch (_) {} };

    function transitionCardChange(change) {
      if (typeof window.smoothCardTransition === 'function') return window.smoothCardTransition(change);
      change();
      return false;
    }

    function ensureLoopToggle() {
      let input = document.querySelector('#loopInput');
      if (!input) {
        const reading = document.querySelector('#readingInput');
        const anchor = reading?.closest('label') || document.querySelector('#shuffleInput')?.closest('label');
        if (!anchor) return;
        const label = document.createElement('label');
        label.innerHTML = '<input id="loopInput" type="checkbox"> Lặp';
        anchor.after(label);
        input = label.querySelector('input');
      }
      try { input.checked = localStorage.getItem(LOOP_KEY) === 'on'; } catch (_) {}
      st.loop = input.checked;
      if (input.dataset.loopBound === '1') return;
      input.dataset.loopBound = '1';
      input.onchange = () => {
        st.loop = input.checked;
        try { localStorage.setItem(LOOP_KEY, st.loop ? 'on' : 'off'); } catch (_) {}
        updateButtons();
        logSafe('Lặp: ' + (st.loop ? 'on' : 'off'));
      };
    }

    function ensureModal() {
      if (document.querySelector('#finishModal')) return;
      const style = document.createElement('style');
      style.textContent = `
        button:disabled{opacity:.42!important;filter:grayscale(.35);cursor:not-allowed!important;transform:none!important;box-shadow:none!important}
        .finish-modal-backdrop{position:fixed;inset:0;z-index:99990;background:rgba(15,23,42,.42);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:none;align-items:center;justify-content:center;padding:18px}
        .finish-modal-backdrop.on{display:flex}
        .finish-modal{width:min(94vw,440px);border-radius:30px;background:rgba(255,255,255,.92);box-shadow:0 24px 80px rgba(15,23,42,.28);border:1px solid rgba(255,255,255,.85);padding:22px;color:#0f172a}
        .finish-modal h2{margin:0 0 8px;font-size:1.65rem;line-height:1.1}.finish-modal p{margin:0 0 16px;color:#64748b;line-height:1.45;font-weight:750}.finish-actions{display:grid;gap:10px}.finish-actions button{width:100%;justify-content:center}.finish-actions .ghost{background:#eef4ff;color:#2563eb}.finish-actions .close{background:#f1f5f9;color:#475569}
      `;
      document.head.appendChild(style);
      const wrap = document.createElement('div');
      wrap.id = 'finishModal';
      wrap.className = 'finish-modal-backdrop';
      wrap.innerHTML = `
        <div class="finish-modal" role="dialog" aria-modal="true" aria-labelledby="finishTitle">
          <h2 id="finishTitle">🎉 Chúc mừng bạn!</h2>
          <p id="finishText">Bạn đã học xong phiên này.</p>
          <div class="finish-actions">
            <button id="finishKnownBtn" class="primary" type="button">Học thẻ đã nhớ (0)</button>
            <button id="finishAgainBtn" class="bad" type="button">Học thẻ chưa nhớ (0)</button>
            <button id="finishRestartBtn" class="secondary" type="button">Học lại từ đầu</button>
            <button id="finishCloseBtn" class="ghost close" type="button">Đóng</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      wrap.addEventListener('click', ev => { if (ev.target === wrap) hideModal(); });
      document.querySelector('#finishCloseBtn').onclick = hideModal;
      document.querySelector('#finishKnownBtn').onclick = () => startSubset('known');
      document.querySelector('#finishAgainBtn').onclick = () => startSubset('again');
      document.querySelector('#finishRestartBtn').onclick = () => restartSession();
    }

    function hideModal() { document.querySelector('#finishModal')?.classList.remove('on'); }

    function updateFinishSummary() {
      const total = st.session?.length || 0;
      const knownCount = st.known?.size || 0;
      const againCount = st.again?.size || 0;
      const title = document.querySelector('#finishTitle');
      const text = document.querySelector('#finishText');
      const knownBtn = document.querySelector('#finishKnownBtn');
      const againBtn = document.querySelector('#finishAgainBtn');
      if (title) title.textContent = '🎉 Chúc mừng bạn!';
      if (text) text.textContent = `Bạn đã học xong ${total} thẻ.`;
      if (knownBtn) {
        knownBtn.textContent = `Học thẻ đã nhớ (${knownCount})`;
        knownBtn.disabled = knownCount === 0;
      }
      if (againBtn) {
        againBtn.textContent = `Học thẻ chưa nhớ (${againCount})`;
        againBtn.disabled = againCount === 0;
      }
    }

    function showModal() {
      ensureModal();
      updateFinishSummary();
      document.querySelector('#finishModal')?.classList.add('on');
    }

    function currentCard() {
      if (!st.session?.length || st.done) return null;
      return st.session[st.i] || null;
    }

    function cardInReviewMode(card) {
      if (!card || !st.reviewMode) return true;
      if (st.reviewMode === 'known') return st.known.has(card.id);
      if (st.reviewMode === 'again') return st.again.has(card.id);
      return true;
    }

    function filterCurrentReviewSession(oldIndex) {
      if (st.reviewMode !== 'known' && st.reviewMode !== 'again') return false;
      st.session = (st.session || []).filter(cardInReviewMode);
      if (!st.session.length) {
        paintComplete();
        return true;
      }
      st.i = Math.min(oldIndex, st.session.length - 1);
      st.face = 0;
      if (typeof render === 'function') render();
      updateButtons();
      return true;
    }

    function updateButtons() {
      const has = !!st.session?.length && !st.done;
      const current = currentCard();
      const atLast = has && st.i >= st.session.length - 1;
      if (e.prev) e.prev.disabled = !has || st.i <= 0;
      if (e.next) e.next.disabled = !has || (atLast && !st.loop);
      if (e.ok) e.ok.disabled = !has || !current || st.known.has(current.id);
      if (e.bad) e.bad.disabled = !has || !current || st.again.has(current.id);
    }

    function paintComplete() {
      st.done = true;
      st.i = Math.max(0, (st.session?.length || 1) - 1);
      st.face = 0;
      if (e.title) e.title.textContent = 'Hoàn thành phiên học';
      if (e.front) e.front.textContent = '🎉 Hoàn thành';
      if (e.sub) e.sub.textContent = 'Đã học xong ' + (st.session?.length || 0) + ' thẻ.';
      if (e.hint) e.hint.textContent = 'Chọn trong popup để học thẻ đã nhớ, thẻ chưa nhớ hoặc học lại từ đầu.';
      const meta = document.querySelector('#cardMeta');
      if (meta) meta.textContent = st.lesson?.title || '';
      if (e.actions) e.actions.classList.add('hidden');
      if (e.pos) e.pos.textContent = (st.session?.length || 0) + '/' + (st.session?.length || 0);
      if (e.bar) e.bar.style.width = '100%';
      updateButtons();
      logSafe('Hoàn thành phiên học ' + (st.session?.length || 0) + ' thẻ.');
      if (!st.finishShown) {
        st.finishShown = true;
        setTimeout(showModal, 80);
      }
    }

    function moveNextNow() {
      if (!st.session?.length || st.done) return;
      if (st.i >= st.session.length - 1) {
        if (!st.loop) return;
        st.i = 0;
      } else {
        st.i += 1;
      }
      st.face = 0;
      if (typeof render === 'function') render();
      updateButtons();
    }

    function moveNext() {
      if (!st.session?.length || st.done) return;
      transitionCardChange(moveNextNow);
    }

    function markAndMove(type) {
      if (!st.session?.length || st.done) return;
      const current = st.session[st.i];
      if (!current) return;
      if (type === 'known' && st.known.has(current.id)) return;
      if (type === 'again' && st.again.has(current.id)) return;

      transitionCardChange(() => {
        const oldIndex = st.i;
        if (type === 'known') {
          st.known.add(current.id);
          st.again.delete(current.id);
        } else {
          st.again.add(current.id);
          st.known.delete(current.id);
        }
        try { if (typeof saveProgress === 'function') saveProgress(); } catch (_) {}
        if (filterCurrentReviewSession(oldIndex)) return;
        if (st.i >= st.session.length - 1 && !st.loop) paintComplete();
        else moveNextNow();
      });
    }

    function startCards(cards, label, mode = null) {
      window.cancelSmoothCardTransition?.();
      hideModal();
      st.reviewMode = mode;
      st.session = cards || [];
      st.i = 0;
      st.face = 0;
      st.done = false;
      st.finishShown = false;
      if (typeof render === 'function') render();
      updateButtons();
      logSafe(label + ': ' + st.session.length + ' thẻ.');
    }

    function startSubset(mode) {
      const base = st.cards?.length ? st.cards : st.session;
      const cards = mode === 'known'
        ? base.filter(card => st.known.has(card.id))
        : base.filter(card => st.again.has(card.id));
      startCards(cards, mode === 'known' ? 'Học thẻ đã nhớ' : 'Học thẻ chưa nhớ', mode);
    }

    function restartSession() {
      const base = st.session?.length ? st.session : (typeof buildSession === 'function' ? buildSession() : st.cards);
      startCards([...base], 'Học lại từ đầu', null);
    }

    const oldStart = window.start;
    window.start = function patchedStart() {
      window.cancelSmoothCardTransition?.();
      st.done = false;
      st.finishShown = false;
      st.reviewMode = null;
      hideModal();
      if (typeof oldStart === 'function') oldStart();
      updateButtons();
    };

    const oldRender = window.render;
    if (typeof oldRender === 'function' && !oldRender.__navHotfixWrapped) {
      window.render = function patchedRender() {
        oldRender();
        updateButtons();
      };
      window.render.__navHotfixWrapped = true;
    }

    window.finishSession = paintComplete;
    window.next = moveNext;
    window.mark = markAndMove;
    window.updateFinishSummary = updateFinishSummary;
    if (e.start) e.start.onclick = window.start;
    if (e.next) e.next.onclick = moveNext;
    if (e.ok) e.ok.onclick = () => markAndMove('known');
    if (e.bad) e.bad.onclick = () => markAndMove('again');
    if (e.prev) e.prev.onclick = () => {
      if (!st.session?.length || st.i <= 0 || st.done) return;
      transitionCardChange(() => {
        if (typeof prev === 'function') prev();
        updateButtons();
      });
    };
    ensureLoopToggle();
    ensureModal();
    updateButtons();
    logSafe('Completion modal + loop hotfix loaded.');
  } catch (error) {
    try { console.warn('[completion hotfix disabled]', error); } catch (_) {}
  }
})();
