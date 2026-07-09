(()=>{
  const TOKEN_KEY='bjtGoogleDriveTokenV1';
  const GRANTED_KEY='bjtGoogleDriveGrantedV1';
  const MIN_REMAINING=90*1000;

  function read(){
    try{
      const saved=JSON.parse(localStorage.getItem(TOKEN_KEY)||'null');
      if(saved?.access_token&&Number(saved.expires_at)>Date.now()+MIN_REMAINING)return saved;
    }catch{}
    return null;
  }
  function save(response){
    if(!response?.access_token)return;
    const expiresAt=Date.now()+(Number(response.expires_in||3600)*1000);
    try{
      localStorage.setItem(TOKEN_KEY,JSON.stringify({
        access_token:response.access_token,
        expires_at:expiresAt,
        scope:response.scope||'https://www.googleapis.com/auth/drive.readonly',
        token_type:response.token_type||'Bearer'
      }));
      localStorage.setItem(GRANTED_KEY,'1');
    }catch{}
  }
  function clear(){try{localStorage.removeItem(TOKEN_KEY);}catch{}}
  function getToken(){return read()?.access_token||'';}

  const oauth=window.google?.accounts?.oauth2;
  const originalInit=oauth?.initTokenClient?.bind(oauth);
  if(originalInit){
    oauth.initTokenClient=config=>{
      const originalCallback=config.callback;
      const wrappedConfig={...config,callback:response=>{
        if(response?.access_token)save(response);
        else if(response?.error==='invalid_token'||response?.error==='invalid_grant')clear();
        originalCallback?.(response);
      }};
      const client=originalInit(wrappedConfig);
      const originalRequest=client.requestAccessToken.bind(client);
      client.requestAccessToken=(options={})=>{
        const saved=read();
        if(saved){
          queueMicrotask(()=>wrappedConfig.callback({
            access_token:saved.access_token,
            expires_in:Math.max(1,Math.floor((saved.expires_at-Date.now())/1000)),
            scope:saved.scope,
            token_type:saved.token_type
          }));
          return;
        }
        const granted=localStorage.getItem(GRANTED_KEY)==='1';
        originalRequest({...options,prompt:options.prompt??(granted?'':'consent')});
      };
      return client;
    };
  }

  window.BJT_GOOGLE_SESSION={
    getToken,
    hasValidToken:()=>Boolean(read()),
    clear,
    forget:()=>{clear();try{localStorage.removeItem(GRANTED_KEY);}catch{}},
    storage:'localStorage',
    note:'Chỉ lưu access token ngắn hạn và thời điểm hết hạn; không lưu mật khẩu hay cookie Google.'
  };
})();