(()=>{
const SID='1wqrd8M74RgcISCIeBwAXObYwocu8VHbXvXvt0NrXvX8';
const state={books:[],lessons:[],questions:[],bookId:localStorage.getItem('bjtLastBook')||'',lessonId:localStorage.getItem('bjtLastLesson')||'',query:''};
const done=new Set(JSON.parse(localStorage.getItem('bjtDoneLessons')||'[]'));
const logs=[],$=id=>document.getElementById(id),received=new Set();
function log(text){logs.push(new Date().toLocaleTimeString()+' '+text);const el=$('debugLog');if(el)el.textContent=logs.join('\n')}
function tableRows(resp){if(!resp?.table)throw Error('Phản hồi Google Sheet không có table');const head=resp.table.cols.map((c,i)=>c.label||c.id||`c${i}`);return resp.table.rows.filter(r=>r.c?.some(Boolean)).map(r=>Object.fromEntries(head.map((h,i)=>[h,r.c?.[i]?.v??''])))}
function accept(name,resp){try{const data=tableRows(resp);state[name.toLowerCase()]=data;received.add(name);log(`${name}: ${data.length} dòng qua JSONP`)}catch(e){log(`${name}: ${e.message}`)}}
window.BJT_BOOKS_CB=resp=>accept('BOOKS',resp);
window.BJT_LESSONS_CB=resp=>accept('LESSONS',resp);
window.BJT_QUESTIONS_CB=resp=>accept('QUESTIONS',resp);
function feedError(name){log(`${name}: không tải được JSONP`)}
async function init(){log('Sheet ID: '+SID);const started=Date.now();while(Date.now()-started<10000){if(received.has('BOOKS')&&received.has('LESSONS')&&received.has('QUESTIONS'))break;await new Promise(r=>setTimeout(r,80))}if(!state.books.length||!state.lessons.length)throw Error('Không đọc được BOOKS hoặc LESSONS');if(!state.books.some(b=>b.book_id===state.bookId))state.bookId=state.books[0].book_id;return state}
window.BJT={SID,state,done,$,log,init,feedError,sheetUrl:`https://docs.google.com/spreadsheets/d/${SID}/edit`};
})();