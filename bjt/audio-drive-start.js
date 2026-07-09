(()=>{
  const driveId=url=>String(url||'').match(/\/d\/([^/?#]+)/)?.[1]||String(url||'').match(/[?&]id=([^&#]+)/)?.[1]||'';
  const autoplaySrc=id=>`https://drive.google.com/file/d/${encodeURIComponent(id)}/preview?autoplay=1&rm=minimal&t=${Date.now()}`;

  function setStatus(text){const el=document.getElementById('audioStatus');if(el)el.textContent=text;}
  function nativeIsReady(){
    const audio=window.BJT_AUDIO?.getAudio?.();
    return Boolean(audio&&audio.src&&audio.src.startsWith('blob:')&&audio.readyState>0);
  }
  function currentMedia(){return window.BJT_AUDIO?.getCurrent?.();}
  function startDrivePreview(){
    const media=currentMedia(),id=media?.drive_file_id||driveId(media?.file_url);
    if(!id){setStatus('Track này chưa có Drive file ID.');return false;}
    const host=document.getElementById('audioPlayerHost');if(!host)return false;
    let details=host.querySelector('.audio-drive-fallback');
    if(!details){
      details=document.createElement('details');details.className='audio-drive-fallback';
      details.innerHTML='<summary>Google Drive Player</summary><iframe allow="autoplay; encrypted-media" referrerpolicy="strict-origin-when-cross-origin" title="Audio Google Drive"></iframe>';
      host.appendChild(details);
    }
    details.open=true;
    const frame=details.querySelector('iframe');
    frame.setAttribute('allow','autoplay; encrypted-media');
    frame.src='about:blank';
    requestAnimationFrame(()=>{frame.src=autoplaySrc(id);});
    setStatus(`${media.track_label||media.file_name} · đang phát bằng Google session của trình duyệt`);
    document.querySelectorAll('[data-audio-play]').forEach(b=>{b.disabled=false;b.textContent='▶ Drive';});
    setTimeout(()=>frame.focus(),250);
    return true;
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-audio-play]');
    if(!button||nativeIsReady())return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    startDrivePreview();
  },true);

  window.BJT_DRIVE_START={start:startDrivePreview};
})();