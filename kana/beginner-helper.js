(()=>{
  const KEY='kanaBeginnerPlanV1';
  const BASE_HIRA=[
    ['a','i','u','e','o','ka','ki','ku','ke','ko'],
    ['sa','shi','su','se','so','ta','chi','tsu','te','to'],
    ['na','ni','nu','ne','no','ha','hi','fu','he','ho'],
    ['ma','mi','mu','me','mo','ya','yu','yo','wa','wo','n'],
    ['ra','ri','ru','re','ro']
  ];
  const DAYS=[
    {title:'Hiragana 1',desc:'Nguyên âm và hàng K',script:'hiragana',ids:BASE_HIRA[0],steps:['Nhìn 10 chữ','Nghe từng âm','Tự đọc không nhìn romaji']},
    {title:'Hiragana 2',desc:'Hàng S và hàng T',script:'hiragana',ids:BASE_HIRA[1],steps:['Chú ý し・ち・つ','Nghe từng âm','Ôn lại 10 chữ hôm qua']},
    {title:'Hiragana 3',desc:'Hàng N và hàng H',script:'hiragana',ids:BASE_HIRA[2],steps:['Chú ý âm ふ','Nhìn và đọc nhanh','Viết thử 5 chữ']},
    {title:'Hiragana 4',desc:'Hàng M, Y, W và ん',script:'hiragana',ids:BASE_HIRA[3],steps:['Học chữ mới','Phân biệt を và お','Nghe âm ん trong từ']},
    {title:'Hiragana 5',desc:'Hàng R và ôn toàn bảng',script:'hiragana',ids:BASE_HIRA[4],steps:['Nghe hàng ら','Ôn chữ dễ nhầm','Đọc toàn bộ 46 chữ']},
    {title:'Ôn Hiragana',desc:'Trộn toàn bộ 46 chữ',script:'hiragana',ids:'basic',steps:['Xáo trộn thẻ','Đọc trong 1 giây','Đánh dấu chữ chưa nhớ']},
    {title:'Viết Hiragana',desc:'Luyện viết những chữ còn yếu',script:'hiragana',mode:'write',steps:['Viết theo mẫu','Ẩn mẫu viết lại','Mục tiêu từ 70 điểm']},
    {title:'Katakana 1',desc:'Nguyên âm và hàng K',script:'katakana',ids:BASE_HIRA[0],steps:['Nhìn 10 chữ','So sánh với Hiragana','Nghe từng âm']},
    {title:'Katakana 2',desc:'Hàng S và hàng T',script:'katakana',ids:BASE_HIRA[1],steps:['Phân biệt シ・ツ','Nghe từng âm','Ôn lại 10 chữ hôm qua']},
    {title:'Katakana 3',desc:'Hàng N và hàng H',script:'katakana',ids:BASE_HIRA[2],steps:['Nhìn và đọc nhanh','Viết thử 5 chữ','Ôn theo cặp âm']},
    {title:'Katakana 4',desc:'Hàng M, Y, R, W và ン',script:'katakana',ids:[...BASE_HIRA[3],...BASE_HIRA[4]],steps:['Học nhóm cuối','Phân biệt ソ・ン','Đọc toàn bảng']},
    {title:'Ôn Katakana',desc:'Trộn toàn bộ 46 chữ',script:'katakana',ids:'basic',steps:['Xáo trộn thẻ','Đọc trong 1 giây','Đánh dấu chữ chưa nhớ']},
    {title:'Chữ dễ nhầm',desc:'さ/き, ぬ/め, シ/ツ, ソ/ン',script:'mixed',mode:'confuse',steps:['Nhìn hướng nét','Nghe và chọn','Làm lại chữ trả lời sai']},
    {title:'Kiểm tra tổng hợp',desc:'Trộn Hiragana và Katakana',script:'mixed',mode:'final',steps:['Luyện thẻ trộn','Game nối cặp','Ôn riêng chữ chưa nhớ']}
  ];

  function loadPlan(){
    try{return {...{startDate:null,completed:[]},...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return{startDate:null,completed:[]}}
  }
  let plan=loadPlan();
  const save=()=>localStorage.setItem(KEY,JSON.stringify(plan));
  const esc=s=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const todayISO=()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate()).toISOString().slice(0,10)};
  function currentDay(){
    if(!plan.startDate)return 1;
    const start=new Date(plan.startDate+'T00:00:00');
    const now=new Date();
    const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    return Math.max(1,Math.min(14,Math.floor((today-start)/86400000)+1));
  }
  function learnedCount(){
    try{return basicItems.reduce((n,i)=>n+(learned.has('h:'+i.id)?1:0)+(learned.has('k:'+i.id)?1:0),0)}catch{return 0}
  }
  function itemList(ids){
    if(ids==='basic')return basicItems;
    return ids.map(id=>findItem(id)).filter(Boolean);
  }

  const launcher=document.createElement('button');
  launcher.className='beginner-launcher';
  launcher.type='button';
  launcher.innerHTML='<span class="spark">✨</span><span class="label">Trợ lý người mới</span>';

  const backdrop=document.createElement('div');
  backdrop.className='beginner-backdrop';
  const sheet=document.createElement('section');
  sheet.className='beginner-sheet';
  sheet.setAttribute('role','dialog');
  sheet.setAttribute('aria-modal','true');
  sheet.innerHTML='<header class="beginner-sheet-head"><div><h2>Trợ lý người mới</h2><p>Học từng phần nhỏ, biết rõ hôm nay nên làm gì.</p></div><button class="beginner-close" type="button" aria-label="Đóng">×</button></header><div class="beginner-body"></div>';
  document.body.append(launcher,backdrop,sheet);
  const body=sheet.querySelector('.beginner-body');

  const banner=document.createElement('div');
  banner.className='beginner-mini-banner';
  banner.innerHTML='<div><strong>Chưa biết bắt đầu từ đâu?</strong><span>Mở lộ trình 14 ngày dành cho người mới học Kana.</span></div><button class="beginner-mini-open" type="button">Xem lộ trình</button>';
  const content=document.querySelector('.content');
  if(content)content.prepend(banner);

  function open(){render();backdrop.classList.add('open');sheet.classList.add('open');document.body.style.overflow='hidden'}
  function close(){backdrop.classList.remove('open');sheet.classList.remove('open');document.body.style.overflow=''}
  launcher.onclick=open;banner.querySelector('button').onclick=open;backdrop.onclick=close;sheet.querySelector('.beginner-close').onclick=close;

  function render(){
    const day=currentDay(),today=DAYS[day-1],done=plan.completed.includes(day),count=learnedCount(),pct=Math.round(count/92*100);
    body.innerHTML=`
      <div class="beginner-welcome">
        <div><h3>${plan.startDate?'Tiếp tục lộ trình của bạn':'Bắt đầu từ Hiragana trước'}</h3><p>${plan.startDate?`Bạn đang ở ngày ${day}/14. Không cần học nhiều một lúc; 10–15 phút tập trung là đủ.`:'Hệ thống sẽ chia bảng chữ cái thành từng nhóm nhỏ và ghi nhớ tiến độ ngay trên điện thoại.'}</p><div class="beginner-progress"><div style="width:${pct}%"></div></div><p>Đã ghi nhớ ${count}/92 mặt chữ cơ bản (${pct}%).</p></div>
        <div class="beginner-day-badge"><div><strong>${day}</strong><span>NGÀY HIỆN TẠI</span></div></div>
      </div>
      <section class="beginner-section">
        <div class="beginner-section-title"><h3>Bài nên học hôm nay</h3><span>${done?'Đã hoàn thành ✓':'Khoảng 10–15 phút'}</span></div>
        <div class="today-card"><span class="tag">Ngày ${day}</span><h3>${esc(today.title)}</h3><p>${esc(today.desc)}</p><div class="today-steps">${today.steps.map((s,i)=>`<div class="today-step"><strong>Bước ${i+1}</strong>${esc(s)}</div>`).join('')}</div>
          <div class="beginner-actions"><button class="beginner-action primary" data-action="today">▶ Học bài hôm nay</button><button class="beginner-action good" data-action="complete">${done?'✓ Đã hoàn thành':'Đánh dấu hoàn thành'}</button></div>
        </div>
      </section>
      <section class="beginner-section"><div class="beginner-section-title"><h3>Ôn nhanh theo tình trạng của bạn</h3><span>Tự chọn nội dung cần luyện</span></div><div class="beginner-actions">
        <button class="beginner-action" data-action="unlearned">Ôn chữ chưa nhớ</button><button class="beginner-action" data-action="confuse">Luyện chữ dễ nhầm</button><button class="beginner-action" data-action="sounds">Nghe các âm khó</button><button class="beginner-action warn" data-action="restart">Bắt đầu lại lộ trình</button>
      </div></section>
      <section class="beginner-section"><div class="beginner-section-title"><h3>Lộ trình 14 ngày</h3><span>Chạm vào ngày để mở bài</span></div><div class="plan-grid">${DAYS.map((d,i)=>{const n=i+1;return`<button class="plan-day ${n===day?'current':''} ${plan.completed.includes(n)?'done':''}" data-day="${n}"><strong>${plan.completed.includes(n)?'✓ ':''}Ngày ${n}</strong><span>${esc(d.title)}</span></button>`}).join('')}</div></section>
      <section class="beginner-section"><div class="beginner-section-title"><h3>Mẹo quan trọng cho người mới</h3></div><div class="beginner-tip-grid"><article class="beginner-tip"><strong>Không phụ thuộc romaji</strong><p>Romaji chỉ dùng để bắt đầu. Sau vài ngày, hãy nhìn chữ và đọc âm trực tiếp.</p></article><article class="beginner-tip"><strong>Học bằng cả mắt, tai và tay</strong><p>Mỗi chữ nên được nhìn, nghe và viết. Ba kênh cùng lúc giúp nhớ chắc hơn.</p></article><article class="beginner-tip"><strong>Ôn chữ sai nhiều hơn</strong><p>Không cần lặp đều mọi chữ. Hãy dành phần lớn thời gian cho chữ còn nhầm.</p></article><article class="beginner-tip"><strong>Đọc theo một nhịp</strong><p>Mỗi kana cơ bản thường tương ứng một mora. Không kéo dài hoặc thêm âm cuối tiếng Việt.</p></article></div></section>
      <div class="beginner-footer-note">Gợi ý âm tiếng Việt chỉ để hỗ trợ bước đầu. Hãy luôn bấm nghe âm Nhật và bắt chước lại.</div>`;
    body.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>handleAction(b.dataset.action,day));
    body.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>openDay(+b.dataset.day));
  }

  function beginPlan(){if(!plan.startDate){plan.startDate=todayISO();save()}}
  function loadCards(ids,script){
    beginPlan();
    const list=itemList(ids);
    state.cardList=list.map((item,index)=>({item,script:script==='mixed'?(index%2?'katakana':'hiragana'):script}));
    state.cardList=shuffle(state.cardList);
    state.cardIndex=0;
    switchView('cards');
    renderCard();
    close();
    window.scrollTo({top:document.querySelector('#view-cards')?.offsetTop||0,behavior:'smooth'});
  }
  function openWrite(script){
    beginPlan();
    switchView('write');
    document.querySelector('#writeScript').value=script;
    state.writeIndex=0;
    renderWriteTarget();
    close();
  }
  function openConfusion(){
    beginPlan();
    const ids=['ki','sa','nu','me','re','ne','shi','tsu','so','n'];
    const pool=ids.map(findItem).filter(Boolean);
    state.game={mode:'kana-romaji',pairs:pool.map(i=>i.id),left:shuffle(pool.map((i,n)=>({item:i,type:'kana'}))),right:shuffle(pool.map(i=>({item:i,type:'roma'}))),selectedL:null,selectedR:null,matched:new Set(),score:0,correct:0,mistakes:0,streak:0,lastSound:null,script:'mixed'};
    switchView('game');
    renderGame();
    const msg=document.querySelector('#gameMessage');
    if(msg)msg.textContent='Nhóm chữ dễ nhầm: nhìn thật kỹ hình dáng rồi nối với âm đúng.';
    close();
  }
  function openFinal(){
    document.querySelector('#gameMode').value='hira-kata';
    document.querySelector('#gameScript').value='mixed';
    document.querySelector('#pairCount').value='8';
    document.querySelector('#gameGroup').value='basic';
    switchView('game');startGame();close();
  }
  function openDay(n){
    beginPlan();
    const d=DAYS[n-1];
    if(d.mode==='write')return openWrite(d.script);
    if(d.mode==='confuse')return openConfusion();
    if(d.mode==='final')return openFinal();
    loadCards(d.ids,d.script);
  }
  function handleAction(action,day){
    if(action==='today')return openDay(day);
    if(action==='complete'){
      beginPlan();
      plan.completed=plan.completed.includes(day)?plan.completed.filter(x=>x!==day):[...plan.completed,day].sort((a,b)=>a-b);
      save();render();return;
    }
    if(action==='unlearned'){
      const pool=[];
      basicItems.forEach(i=>{if(!learned.has('h:'+i.id))pool.push({item:i,script:'hiragana'});if(!learned.has('k:'+i.id))pool.push({item:i,script:'katakana'})});
      state.cardList=shuffle(pool.length?pool:basicItems.map(i=>({item:i,script:'mixed'})));
      state.cardIndex=0;switchView('cards');renderCard();close();return;
    }
    if(action==='confuse')return openConfusion();
    if(action==='sounds')return loadCards(['shi','chi','tsu','fu','ra','ri','ru','re','ro'],'hiragana');
    if(action==='restart'){
      if(confirm('Bắt đầu lại lộ trình 14 ngày? Dấu “đã nhớ” của từng chữ vẫn được giữ.')){plan={startDate:todayISO(),completed:[]};save();render()}
    }
  }

  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sheet.classList.contains('open'))close()});
})();
