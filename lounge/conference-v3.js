(() => {
  'use strict';
  const DOMAIN='fairmeeting.net';
  const ROOM='DuanLearning-Nihongo-Lounge-Main-2026';
  const LIMIT=100;
  const state={api:null,profile:null,localId:'',people:new Map(),reason:'',greeted:false,cb:{}};
  const key=value=>String(value||'').trim().replace(/^@+/,'').toLocaleLowerCase('vi');
  function mainPeople(result){const room=(result?.rooms||[]).find(x=>x.isMainRoom)||(result?.rooms||[])[0];return room?.participants||[];}
  async function refresh(){
    if(!state.api)return [];
    try{const result=await state.api.getRoomsInfo();state.people.clear();mainPeople(result).forEach(p=>state.people.set(p.id,{id:p.id,displayName:p.displayName||'Ẩn danh',role:p.role||'participant'}));}catch(_){ }
    const list=[...state.people.values()].sort((a,b)=>a.displayName.localeCompare(b.displayName,'ja'));
    state.cb.onParticipants?.(list,state.localId);state.cb.onCount?.(list.length||state.api.getNumberOfParticipants?.()||0,LIMIT);return list;
  }
  function duplicateLocal(){const same=[...state.people.values()].filter(p=>key(p.displayName)===key(state.profile.nickname));if(same.length<=1)return false;return state.localId!==same.map(p=>p.id).sort()[0];}
  function greeting(){if(!state.api||state.greeted||!state.profile.message)return;state.greeted=true;const text=`${state.profile.message} 〔${state.profile.level}〕`;state.api.executeCommand('sendChatMessage',text);state.cb.onMessage?.({nick:state.profile.nickname,message:text,privateMessage:false,mine:true});}
  function bind(){
    const api=state.api;
    api.addListener('videoConferenceJoined',async event=>{state.localId=event.id;state.cb.onStatus?.('live','Đã kết nối');await refresh();if(api.getNumberOfParticipants()>LIMIT){state.reason='full';api.executeCommand('hangup');return;}if(duplicateLocal()){state.reason='duplicate';api.executeCommand('hangup');return;}state.cb.onReady?.();setTimeout(greeting,800);});
    api.addListener('participantJoined',async()=>{await refresh();if(api.getNumberOfParticipants()>LIMIT){state.reason='full';api.executeCommand('hangup');}});
    api.addListener('participantLeft',refresh);
    api.addListener('displayNameChange',async()=>{await refresh();if(duplicateLocal()){state.reason='duplicate';api.executeCommand('hangup');}});
    api.addListener('incomingMessage',event=>state.cb.onMessage?.({nick:event.nick||'Ẩn danh',message:event.message,privateMessage:!!event.privateMessage,mine:false}));
    api.addListener('endpointTextMessageReceived',event=>{try{const data=JSON.parse(event.eventData.text);if(data.type==='duan-reaction'&&data.emoji)state.cb.onReaction?.(data.emoji,data.nick||'');}catch(_){ }});
    api.addListener('videoConferenceLeft',()=>{const reason=state.reason;state.reason='';dispose();if(reason==='full')state.cb.onExit?.('full','Phòng đã đủ 100 người','Phòng hiện đã đủ chỗ. Hãy thử kết nối lại khi có người rời phòng.');else if(reason==='duplicate')state.cb.onExit?.('duplicate','Nickname đang được sử dụng','Mỗi nickname chỉ được tồn tại một lần trong danh sách online. Hãy đổi nickname rồi kết nối lại.');else state.cb.onExit?.('left','Đã rời phòng','Hẹn gặp lại trong lần luyện nói tiếp theo.');});
    api.addListener('readyToClose',()=>api.executeCommand('hangup'));
    api.addListener('errorOccurred',event=>{if(event?.isFatal)state.cb.onNotice?.('Lỗi kết nối: '+(event.message||event.name||'Unknown'));});
  }
  function start({profile,mount,callbacks={}}){
    dispose();if(!window.JitsiMeetExternalAPI)throw new Error('Không tải được dịch vụ gọi video');state.profile=profile;state.cb=callbacks;state.greeted=false;state.reason='';state.cb.onStatus?.('wait','Đang kết nối');
    state.api=new JitsiMeetExternalAPI(DOMAIN,{roomName:ROOM,parentNode:mount,width:'100%',height:'100%',lang:'ja',userInfo:{displayName:profile.nickname},configOverwrite:{prejoinPageEnabled:false,prejoinConfig:{enabled:false,hideDisplayName:true,hideExtraJoinButtons:['no-audio','by-phone']},requireDisplayName:false,disableDeepLinking:true,startWithAudioMuted:true,startWithVideoMuted:false,enableWelcomePage:false,enableClosePage:false,disableInviteFunctions:true,subject:'日本語で話そう！ · Duan Learning',toolbarButtons:['microphone','camera','desktop','chat','participants-pane','raisehand','reactions','tileview','settings','hangup','fullscreen','select-background','videoquality','filmstrip','shortcuts','closedcaptions']},interfaceConfigOverwrite:{MOBILE_APP_PROMO:false,SHOW_JITSI_WATERMARK:false,SHOW_BRAND_WATERMARK:false,TILE_VIEW_MAX_COLUMNS:5,TOOLBAR_ALWAYS_VISIBLE:false}});bind();
  }
  async function sendChat(raw){
    const text=String(raw||'').trim();if(!text||!state.api)return {ok:false};const match=text.match(/^@([^\s]+)\s+([\s\S]+)$/u);
    if(match){await refresh();const target=[...state.people.values()].find(p=>key(p.displayName)===key(match[1])&&p.id!==state.localId);if(!target)return {ok:false,error:'Không tìm thấy @'+match[1]+' trong người đang online.'};state.api.executeCommand('sendChatMessage',match[2].trim(),target.id,true);state.cb.onMessage?.({nick:'@'+target.displayName,message:match[2].trim(),privateMessage:true,mine:true});return {ok:true};}
    state.api.executeCommand('sendChatMessage',text);state.cb.onMessage?.({nick:state.profile.nickname,message:text,privateMessage:false,mine:true});return {ok:true};
  }
  async function react(emoji){if(!state.api)return;state.cb.onReaction?.(emoji,state.profile.nickname);await refresh();const payload=JSON.stringify({type:'duan-reaction',emoji,nick:state.profile.nickname,at:Date.now()});[...state.people.values()].filter(p=>p.id!==state.localId).forEach(p=>state.api.executeCommand('sendEndpointTextMessage',p.id,payload));}
  function leave(){if(state.api){state.reason='';state.api.executeCommand('hangup');}}
  function dispose(){if(state.api){try{state.api.dispose();}catch(_){ }}state.api=null;state.localId='';state.people.clear();state.greeted=false;}
  window.LoungeConference={start,sendChat,react,leave,dispose,LIMIT};
})();
