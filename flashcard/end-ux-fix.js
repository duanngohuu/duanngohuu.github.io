(() => {
  function bootEndUxFix() {
    if (typeof state === 'undefined' || typeof el === 'undefined') return setTimeout(bootEndUxFix, 120);

    let meta = document.querySelector('#cardMeta');
    if (!meta) {
      meta = document.createElement('p');
      meta.id = 'cardMeta';
      meta.className = 'card-meta';
      document.querySelector('#cardHint')?.after(meta);
    }

    const cleanNote = (note = '') => String(note).replace(/^Năm xuất hiện:\s*/i, '').trim();
    const tagText = (c) => (c?.tags || []).length ? '#' + c.tags.join(' #') : '';
    const setMeta = (text) => { meta.textContent = text || ''; };

    renderCard = function renderCardFixed() {
      const c = current();
      if (!c) {
        el.title.textContent = state.currentLesson ? 'Chọn range rồi bấm Bắt đầu học' : 'Chọn bài học';
        el.front.textContent = state.currentLesson ? 'Sẵn sàng' : 'Chưa có bài';
        el.sub.textContent = state.currentLesson ? `${state.cards.length} thẻ trong bài này. Có thể học 10 từ/lần trong 50 từ.` : 'Data sẽ được đọc từ file GitHub.';
        el.hint.textContent = 'Bấm bài học bên trái, chọn số lượng, rồi bắt đầu.';
        setMeta('');
        el.actions.classList.add('hidden');
        updateStats();
        return;
      }

      el.actions.classList.remove('hidden');
      el.title.textContent = state.currentLesson.title;
      el.pos.textContent = `${state.index + 1}/${state.session.length}`;
      const hasEx = !!(c.example_jp || c.example_vi);
      const maxFace = hasEx ? 3 : 2;
      if (state.face >= maxFace) state.face = 0;

      if (state.face === 0) {
        el.front.textContent = c.front || '';
        el.sub.textContent = state.showReading ? (c.reading || '') : '';
        el.hint.textContent = state.showReading ? 'Mặt 1/2: từ + cách đọc. Bấm để xem nghĩa.' : 'Mặt 1/2: từ. Cách đọc đang ẩn, bấm để kiểm tra.';
        setMeta(tagText(c));
      } else if (state.face === 1) {
        el.front.textContent = c.meaning_vi || c.meaning || '';
        el.sub.textContent = [c.reading ? `Cách đọc: ${c.reading}` : '', c.meaning_jp ? `Âm Hán Việt: ${c.meaning_jp}` : ''].filter(Boolean).join('\n');
        el.hint.textContent = hasEx ? 'Mặt 2/3: nghĩa. Bấm để xem ví dụ.' : 'Mặt 2/2: nghĩa + cách đọc. Bấm để quay lại từ.';
        const year = cleanNote(c.note);
        setMeta(year ? `Năm xuất hiện: ${year}` : tagText(c));
      } else {
        el.front.textContent = c.example_jp || '';
        el.sub.textContent = c.example_vi || '';
        el.hint.textContent = 'Mặt 3/3: ví dụ. Bấm để quay lại từ.';
        setMeta(tagText(c));
      }
      updateStats();
    };

    function resetToFirst() {
      state.index = 0;
      state.face = 0;
      state.completed = false;
      document.querySelector('.firework-layer')?.remove();
      document.querySelector('.complete-panel')?.remove();
      renderCard();
    }

    function showCompletePanel() {
      document.querySelector('.complete-panel')?.remove();
      const panel = document.createElement('div');
      panel.className = 'complete-panel';
      panel.innerHTML = '<strong>🎉 Xong phiên học!</strong><p>Đã học hết flashcard trong phiên này.</p><button id="restartSessionBtn" type="button">Học lại từ đầu</button>';
      document.body.appendChild(panel);
      panel.querySelector('#restartSessionBtn')?.addEventListener('click', resetToFirst);
    }

    function fireworkBurst() {
      document.querySelector('.firework-layer')?.remove();
      const layer = document.createElement('div');
      layer.className = 'firework-layer';
      document.body.appendChild(layer);
      for (let burst = 0; burst < 5; burst++) {
        const cx = 20 + Math.random() * 60;
        const cy = 18 + Math.random() * 48;
        for (let i = 0; i < 28; i++) {
          const dot = document.createElement('span');
          const angle = Math.PI * 2 * i / 28;
          const dist = 60 + Math.random() * 92;
          dot.className = 'firework-dot';
          dot.style.setProperty('--x', cx + 'vw');
          dot.style.setProperty('--y', cy + 'vh');
          dot.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
          dot.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
          dot.style.setProperty('--hue', String(Math.floor(Math.random() * 360)));
          dot.style.animationDelay = (burst * .12) + 's';
          layer.appendChild(dot);
        }
      }
      setTimeout(() => layer.remove(), 2400);
    }

    completeSession = function completeSessionFixed() {
      if (state.completed) return;
      state.completed = true;
      fireworkBurst();
      showCompletePanel();
      log('Hết phiên học. Bấm Học lại từ đầu để quay về thẻ 1.');
    };

    next = function nextFixed() {
      if (!state.session.length) return;
      if (state.index >= state.session.length - 1) return completeSession();
      state.index += 1;
      state.face = 0;
      renderCard();
    };

    el.next.onclick = next;
    renderCard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootEndUxFix);
  } else {
    bootEndUxFix();
  }
})();
