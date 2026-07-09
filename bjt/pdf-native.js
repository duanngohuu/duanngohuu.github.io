(()=>{
  const driveId=url=>String(url||'').match(/\/d\/([^/?#]+)/)?.[1]||String(url||'').match(/[?&]id=([^&#]+)/)?.[1]||'';
  let observer,timer,frame,fileId='';

  const preview=id=>`https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
  const emit=(status,message='')=>window.dispatchEvent(new CustomEvent('bjt-pdf-native',{detail:{status,message,native:false,fileId}}));

  function detect(){
    frame=document.getElementById('pdfFrame');if(!frame)return false;
    const id=frame.dataset.driveFileId||driveId(frame.getAttribute('src')||frame.src);if(!id)return false;
    fileId=id;frame.dataset.driveFileId=id;frame.setAttribute('title','PDF sách trên Google Drive');return true;
  }
  function restore(){
    if(!detect())return false;
    const src=preview(fileId);
    if(frame.getAttribute('src')!==src)frame.setAttribute('src',src);
    emit('preview','Drive Preview dùng tài khoản Google đang đăng nhập trong trình duyệt.');
    return true;
  }
  function reload(){
    if(!detect())return false;
    const src=preview(fileId);frame.setAttribute('src','about:blank');setTimeout(()=>frame?.setAttribute('src',src),80);return true;
  }
  function enhance(){restore();}

  window.addEventListener('DOMContentLoaded',()=>{const root=document.getElementById('lessonDetail');if(root){observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enhance,30);});observer.observe(root,{childList:true,subtree:true});}});
  window.addEventListener('load',enhance);
  window.BJT_NATIVE_PDF={enhance,reload,restore,isNative:()=>false,getFileId:()=>fileId};
})();