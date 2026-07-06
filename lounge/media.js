(() => {
  'use strict';
  let stream=null;
  function stop(){if(stream){stream.getTracks().forEach(track=>track.stop());stream=null;}}
  async function check(onNotice){
    const preview=document.getElementById('preview');
    const title=document.getElementById('permissionTitle');
    const text=document.getElementById('permissionText');
    const button=document.getElementById('permissionBtn');
    if(!navigator.mediaDevices?.getUserMedia){
      title.textContent='Trình duyệt không hỗ trợ kiểm tra';
      text.textContent='Bạn vẫn có thể chọn thiết bị sau khi vào phòng.';
      return false;
    }
    try{
      stop();
      stream=await navigator.mediaDevices.getUserMedia({audio:true,video:true});
      const video=document.createElement('video');
      video.autoplay=true;video.muted=true;video.playsInline=true;video.srcObject=stream;
      preview.replaceChildren(video);
      title.textContent='Camera & micro hoạt động';
      text.textContent='Video xem trước chỉ hiển thị trên thiết bị của bạn.';
      button.textContent='Kiểm tra lại';
      onNotice?.('Đã nhận quyền camera và micro.');
      return true;
    }catch(error){
      title.textContent='Chưa có quyền thiết bị';
      text.textContent='Bạn vẫn có thể vào phòng rồi cấp quyền trong cài đặt trình duyệt.';
      onNotice?.('Không mở được camera/micro: '+(error?.name||'Permission denied'));
      return false;
    }
  }
  window.LoungeMedia={check,stop};
})();
