(()=>{
  const driveId=url=>String(url||'').match(/\/d\/([^/?#]+)/)?.[1]||String(url||'').match(/[?&]id=([^&#]+)/)?.[1]||'';
  const clientIdKey='bjtGoogleClientId';
  const scope='https://www.googleapis.com/auth/drive.readonly';
  let observer,timer,frame,fileId='',objectUrl='',accessToken='',tokenExpiresAt=0,loading=null;

  const clientId=()=>window.BJT_GOOGLE_CLIENT_ID||localStorage.getItem(clientIdKey)||'';
  const preview=(id,page=1)=>`https://drive.google.com/file/d/${encodeURIComponent(id)}/preview#page=${Math.max(1,Math.round(+page||1))}`;
  const nativeSrc=page=>`${objectUrl}#page=${Math.max(1,Math.round(+page||1))}&zoom=page-width`;
  const emit=(status,message='')=>window.dispatchEvent(new CustomEvent('bjt-pdf-native',{detail:{status,message,native:Boolean(objectUrl),fileId}}));

  function currentFrame(){return document.getElementById('pdfFrame');}
  function detect(){
    frame=currentFrame();if(!frame)return false;
    fileId=frame.dataset.driveFileId||driveId(frame.getAttribute('src')||frame.src);
    if(!fileId)return false;
    frame.dataset.driveFileId=fileId;
    frame.dataset.previewPdfSrc=preview(fileId,1);
    frame.setAttribute('title','PDF sách trên Google Drive');
    return true;
  }
  function waitForGIS(){
    return new Promise((resolve,reject)=>{
      const started=Date.now();
      const check=()=>{
        if(window.google?.accounts?.oauth2)return resolve();
        if(Date.now()-started>10000)return reject(new Error('Google Identity Services chưa tải được.'));
        setTimeout(check,100);
      };check();
    });
  }
  async function requestToken(){
    if(accessToken&&Date.now()<tokenExpiresAt-60000)return accessToken;
    const id=clientId();
    if(!id){window.BJT_AUDIO?.openAuthSheet?.();throw new Error('Chưa cấu hình OAuth Client ID để điều khiển trang PDF.');}
    await waitForGIS();
    return new Promise((resolve,reject)=>{
      const tokenClient=google.accounts.oauth2.initTokenClient({
        client_id:id,scope,
        callback:r=>{
          if(r.error){reject(new Error(r.error_description||r.error));return;}
          accessToken=r.access_token;tokenExpiresAt=Date.now()+(+(r.expires_in||3600))*1000;resolve(accessToken);
        },
        error_callback:e=>reject(new Error(e?.message||'Không đăng nhập được Google Drive.'))
      });
      tokenClient.requestAccessToken({prompt:accessToken?'':'select_account'});
    });
  }
  function clearBlob(){if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl='';}}
  function setFallback(page=1){
    if(!detect())return false;
    const src=preview(fileId,page);
    if(frame.getAttribute('src')!==src)frame.setAttribute('src',src);
    emit('preview','Đang dùng Google Drive Preview');
    return true;
  }
  function setNativePage(page=1){
    if(!objectUrl||!detect())return false;
    const src=nativeSrc(page);
    if(frame.getAttribute('src')!==src)frame.setAttribute('src',src);
    emit('ready','PDF native đã sẵn sàng');
    return true;
  }
  async function ensureNative({page=1,interactive=false,force=false}={}){
    if(!detect())throw new Error('Không tìm thấy file PDF.');
    if(objectUrl&&!force){setNativePage(page);return true;}
    if(!interactive&&!accessToken){setFallback(page);return false;}
    if(loading)return loading;
    loading=(async()=>{
      try{
        emit('loading','Đang tải PDF có quyền từ Google Drive…');
        const token=await requestToken();
        const res=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,{headers:{Authorization:`Bearer ${token}`}});
        if(res.status===401){accessToken='';tokenExpiresAt=0;throw new Error('Phiên Google đã hết hạn. Bấm lại để đăng nhập.');}
        if(!res.ok)throw new Error(res.status===403?'Email Google này chưa được cấp quyền file PDF.':`Không tải được PDF (${res.status}).`);
        const blob=await res.blob();
        clearBlob();objectUrl=URL.createObjectURL(blob);setNativePage(page);return true;
      }catch(e){setFallback(page);emit('error',e.message);throw e;}
      finally{loading=null;}
    })();
    return loading;
  }
  function setPage(page,{interactive=false}={}){
    if(objectUrl)return Promise.resolve(setNativePage(page));
    setFallback(page);
    if(!interactive)return Promise.resolve(false);
    return ensureNative({page,interactive:true}).catch(()=>false);
  }
  function reload(page=1,{interactive=false}={}){
    if(objectUrl){const src=nativeSrc(page);frame.setAttribute('src','about:blank');setTimeout(()=>frame?.setAttribute('src',src),80);return Promise.resolve(true);}
    if(interactive)return ensureNative({page,interactive:true,force:true}).catch(()=>false);
    setFallback(page);return Promise.resolve(false);
  }
  function enhance(){if(detect())setFallback(window.BJT_PDF?.getPage?.()||1);}

  window.addEventListener('DOMContentLoaded',()=>{
    const root=document.getElementById('lessonDetail');
    if(root){observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enhance,20);});observer.observe(root,{childList:true,subtree:true});}
  });
  window.addEventListener('load',enhance);
  window.addEventListener('beforeunload',clearBlob);
  window.BJT_NATIVE_PDF={enhance,setPage,reload,ensureNative,isNative:()=>Boolean(objectUrl),getFileId:()=>fileId};
})();