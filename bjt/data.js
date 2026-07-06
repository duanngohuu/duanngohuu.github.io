(()=>{
const SID='1wqrd8M74RgcISCIeBwAXObYwocu8VHbXvXvt0NrXvX8';
const state={books:[],lessons:[],questions:[],bookId:localStorage.getItem('bjtLastBook')||'',lessonId:localStorage.getItem('bjtLastLesson')||'',query:''};
const done=new Set(JSON.parse(localStorage.getItem('bjtDoneLessons')||'[]'));
const logs=[],$=id=>document.getElementById(id);
function log(text){logs.push(new Date().toLocaleTimeString()+' '+text);const el=$('debugLog');if(el)el.textContent=logs.join('\n')}
function parseCSV(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];if(ch==='"'&&quoted&&next==='"'){cell+='"';i++}else if(ch==='"'){quoted=!quoted}else if(ch===','&&!quoted){row.push(cell);cell=''}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell=''}else cell+=ch}if(cell||row.length){row.push(cell);rows.push(row)}const head=rows.shift()||[];return rows.map(r=>Object.fromEntries(head.map((h,i)=>[h,r[i]??''])))}
async function load(name){const url=`https://docs.google.com/spreadsheets/d/${SID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw Error(`${name}: HTTP ${res.status}`);return parseCSV(await res.text())}
async function init(){log('Sheet ID: '+SID);for(const name of ['BOOKS','LESSONS','QUESTIONS']){try{const data=await load(name);state[name.toLowerCase()]=data;log(`${name}: ${data.length} dòng`)}catch(e){log(e.message)}}if(!state.books.length||!state.lessons.length)throw Error('Không đọc được BOOKS hoặc LESSONS');if(!state.books.some(b=>b.book_id===state.bookId))state.bookId=state.books[0].book_id;return state}
window.BJT={SID,state,done,$,log,init,sheetUrl:`https://docs.google.com/spreadsheets/d/${SID}/edit`};
})();