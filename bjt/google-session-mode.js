(()=>{
  const KEY='bjtGoogleGrantRemembered';
  const TIME_KEY='bjtGoogleGrantRememberedAt';
  let attempts=0;

  function patch(){
    const oauth=window.google?.accounts?.oauth2;
    if(!oauth||oauth.__bjtSessionPatched)return Boolean(oauth?.__bjtSessionPatched);
    const originalInit=oauth.initTokenClient.bind(oauth);
    oauth.initTokenClient=config=>{
      const originalCallback=config?.callback;
      const client=originalInit({
        ...config,
        prompt:'',
        callback:response=>{
          if(response?.access_token){
            try{
              localStorage.setItem(KEY,'1');
              localStorage.setItem(TIME_KEY,String(Date.now()));
            }catch{}
          }
          originalCallback?.(response);
        }
      });
      const originalRequest=client.requestAccessToken.bind(client);
      client.requestAccessToken=override=>originalRequest({...override,prompt:''});
      return client;
    };
    oauth.__bjtSessionPatched=true;
    return true;
  }

  function wait(){
    if(patch())return;
    if(++attempts<100)setTimeout(wait,50);
  }

  wait();
  window.BJT_GOOGLE_SESSION={
    isRemembered:()=>{try{return localStorage.getItem(KEY)==='1';}catch{return false;}},
    clear:()=>{try{localStorage.removeItem(KEY);localStorage.removeItem(TIME_KEY);}catch{}}
  };
})();