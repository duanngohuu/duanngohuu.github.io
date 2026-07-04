// System settings UI.
(() => {
  try {
    const $ = selector => document.querySelector(selector);
    const HISTORY_PATTERNS = [/^fc_vocab_progress/i,/^fc_vocab_last/i,/^fc_library_recent/i,/^fc_library_resume/i];
    let pending = '';
    let busy = false;

    function ensureUi() {
      const trigger = $('#systemSettingsBtn');
      if (!trigger) return null;
      let backdrop = $('#systemSettingsBackdrop');
      if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'systemSettingsBackdrop';
        backdrop.className = 'system-settings-backdrop hidden';
        backdrop.innerHTML = `<section class="system-settings-popup" role="dialog" aria-modal="true"><header><div><small>CÀI ĐẶT</small><strong>Hệ thống</strong></div><button id="systemSettingsClose" type="button">×</button></header><div class="system-settings-list"><button type="button" data-system-action="offline"><span>⌫</span><span><strong>Xóa toàn bộ dữ liệu offline</strong><small>Xóa bài đã tải, menu cache và bộ nhớ dùng khi mất mạng.</small></span><em>›</em></button><button type="button" data-system-action="history"><span>↺</span><span><strong>Xóa lịch sử học</strong><small>Xóa bài gần đây, tiếp tục học, Đã nhớ và Chưa nhớ.</small></span><em>›</em></button></div><div id="systemSettingsConfirm" class="system-settings-confirm hidden"><strong id="systemConfirmTitle"></strong><p id="systemConfirmText"></p><div><button id="systemConfirmCancel" class="secondary" type="button">Hủy</button><button id="systemConfirmRun" class="system-confirm-danger" type="button">Xác nhận xóa</button></div></div><p id="systemSettingsStatus" class="system-settings-status"></p></section>`;
        document.body.appendChild(backdrop);
      }
      trigger.onclick = open;
      $('#systemSettingsClose').onclick = close;
      $('#systemConfirmCancel').onclick = cancel;
      $('#systemConfirmRun').onclick = run;
      backdrop.onclick = event => {
        if (event.target === backdrop) close();
        const action = event.target.closest('[data-system-action]');
        if (action) ask(action.dataset.systemAction);
      };
      return backdrop;
    }

    function status(text='', tone='') {
      const node = $('#systemSettingsStatus');
      if (!node) return;
      node.textContent = text;
      node.className = `system-settings-status${tone ? ` is-${tone}` : ''}`;
    }
    function open() { ensureUi()?.classList.remove('hidden'); document.body.classList.add('system-settings-open'); cancel(); status(); }
    function close() { if (busy) return; $('#systemSettingsBackdrop')?.classList.add('hidden'); document.body.classList.remove('system-settings-open'); pending=''; }
    function cancel() { pending=''; $('#systemSettingsConfirm')?.classList.add('hidden'); }
    function ask(action) {
      if (busy) return;
      pending = action;
      $('#systemConfirmTitle').textContent = action === 'offline' ? 'Xóa toàn bộ dữ liệu offline?' : 'Xóa toàn bộ lịch sử học?';
      $('#systemConfirmText').textContent = action === 'offline' ? 'Bài đã tải, IndexedDB và cache ứng dụng sẽ bị xóa. Google Sheets và lịch sử học không bị xóa.' : 'Bài gần đây, vị trí tiếp tục, Đã nhớ và Chưa nhớ của mọi bài sẽ trở về 0.';
      $('#systemSettingsConfirm').classList.remove('hidden');
    }
    function setBusy(value) {
      busy = value;
      $('#systemSettingsBackdrop')?.classList.toggle('is-busy', value);
      const button = $('#systemConfirmRun');
      if (button) { button.disabled=value; button.textContent=value?'Đang xử lý…':'Xác nhận xóa'; }
    }

    function clearHistoryKeys() {
      const keys=[];
      for (let i=0;i<localStorage.length;i++) {
        const key=localStorage.key(i);
        if (key && HISTORY_PATTERNS.some(pattern=>pattern.test(key))) keys.push(key);
      }
      keys.forEach(key=>localStorage.removeItem(key));
      return keys.length;
    }
    function resetLearningState() {
      if (!window.st) return;
      st.known=new Set(); st.again=new Set(); st.session=[]; st.cards=[]; st.lesson=null; st.i=0; st.face=0; st.done=false; st.finishShown=false; st.featureFilter='all';
      window.render?.();
      window.refreshLessonProgressBadges?.();
    }
    async function run() {
      if (!pending || busy) return;
      const action=pending;
      setBusy(true);
      status(action==='offline'?'Đang xóa bộ nhớ offline…':'Đang xóa lịch sử học…');
      try {
        if (action==='offline') {
          const result=await window.flashcardOffline?.clearOfflineData?.();
          if (!result) throw new Error('Bộ quản lý offline chưa sẵn sàng.');
          cancel(); status(`Đã xóa dữ liệu offline và ${result.cacheCount||0} vùng cache.`, 'success');
        } else {
          const count=clearHistoryKeys();
          resetLearningState();
          setTimeout(()=>{ clearHistoryKeys(); window.flashcardLibraryTools?.render?.(); },500);
          cancel(); status(`Đã xóa lịch sử học và tiến độ (${count} mục lưu).`,'success');
        }
      } catch (error) { status(error?.message||'Không thể xử lý dữ liệu.','error'); }
      finally { setBusy(false); }
    }
    document.addEventListener('keydown', event=>{ if(event.key==='Escape') close(); });
    ensureUi();
    window.systemSettings={open,close};
  } catch (error) { console.warn('[system-settings disabled]',error); }
})();
