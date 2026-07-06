(() => {
  'use strict';
  const KEY='duanLearning.nihongoLounge.profile.v1';
  const levels=['Mới bắt đầu','N5','N4','N3','N2','N1','Business Japanese'];
  const normalizeNick=value=>String(value||'').trim().replace(/^@+/, '');
  function markup(){
    return `<section id="joinScreen" class="join-layout">
      <article class="hero glass">
        <div><div class="eyebrow">Duan Learning · Community beta</div><h1>Vào phòng.<br>Nói tiếng Nhật.</h1><p>Một phòng chung để bật camera, trò chuyện tự do, luyện phản xạ và làm quen với người học tiếng Nhật khác. Không cần tạo tài khoản Duan Learning.</p></div>
        <div class="feature-row"><span class="feature">🎥 Video real-time</span><span class="feature">💬 Chat chung & riêng</span><span class="feature">✨ Emoji reaction</span><span class="feature">👥 Tối đa 100 người</span><span class="feature">🚪 Có phòng chờ</span></div>
        <div class="room-summary"><div class="summary-box"><strong>1</strong><span>Kênh duy nhất</span></div><div class="summary-box"><strong>100</strong><span>Người tối đa</span></div><div class="summary-box"><strong>0</strong><span>Tài khoản bắt buộc</span></div></div>
      </article>
      <aside class="join-card glass">
        <div class="eyebrow">Hồ sơ vào phòng</div><h2>はじめまして 👋</h2><p>Thông tin được lưu trên thiết bị này để lần sau kết nối nhanh hơn. Email không hiển thị công khai.</p>
        <form id="joinForm" class="form-grid" novalidate>
          <div class="field"><label for="nickname">Nickname <small>Dùng để @chat riêng</small></label><input id="nickname" class="input" maxlength="24" autocomplete="nickname" placeholder="Ví dụ: Duan99" required></div>
          <div class="field"><label for="email">Địa chỉ email <small>Chỉ lưu cục bộ</small></label><input id="email" class="input" type="email" maxlength="120" autocomplete="email" placeholder="you@example.com" required></div>
          <div class="field"><label for="level">Trình độ hiện tại</label><select id="level" class="select">${levels.map(x=>`<option value="${x}">${x}</option>`).join('')}</select></div>
          <div class="field"><label for="message">Lời chào khi Connect</label><textarea id="message" class="textarea" maxlength="180" placeholder="こんにちは！N2を勉強しています。気軽に話しかけてください。" required></textarea></div>
          <div class="permission"><div id="preview" class="preview"><span>Camera preview</span></div><div class="permission-info"><strong id="permissionTitle">Kiểm tra camera & micro</strong><p id="permissionText">Trình duyệt sẽ hỏi quyền sử dụng thiết bị. Bạn có thể tắt lại trong phòng.</p><button id="permissionBtn" type="button" class="mini-btn">Cho phép & kiểm tra</button></div></div>
          <div class="privacy">Hãy giữ lịch sự, không quấy rối và không ghi âm hoặc ghi hình người khác khi chưa được đồng ý.</div>
          <div id="formError" class="form-error"></div>
          <button id="joinBtn" class="join-btn" type="submit">Vào phòng chung →</button>
        </form>
      </aside>
    </section>`;
  }
  function load(){
    try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch(_){return null;}
  }
  function fill(saved){
    if(!saved)return;
    const map={nickname:saved.nickname,email:saved.email,level:saved.level,message:saved.message};
    Object.entries(map).forEach(([id,value])=>{const el=document.getElementById(id);if(el&&value!=null)el.value=value;});
  }
  function read(){
    return {nickname:normalizeNick(document.getElementById('nickname')?.value),email:String(document.getElementById('email')?.value||'').trim(),level:document.getElementById('level')?.value||levels[0],message:String(document.getElementById('message')?.value||'').trim()};
  }
  function validate(p){
    if(!/^[\p{L}\p{N}_-]{2,24}$/u.test(p.nickname))return 'Nickname dài 2–24 ký tự, không có khoảng trắng; có thể dùng chữ, số, _ hoặc -.';
    if(!/^\S+@\S+\.\S+$/.test(p.email))return 'Địa chỉ email chưa đúng định dạng.';
    if(p.message.length<2)return 'Hãy nhập một lời chào ngắn khi Connect.';
    return '';
  }
  function save(p){localStorage.setItem(KEY,JSON.stringify({...p,savedAt:new Date().toISOString()}));}
  window.LoungeProfile={markup,load,fill,read,validate,save,normalizeNick};
})();
