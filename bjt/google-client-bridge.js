(()=>{
  const clientId='652357383361-30kpcig6f8gsp4mie4d6as5uhjhphen6.apps.googleusercontent.com';
  const TOKEN_KEY='bjtGoogleDriveSessionTokenV1';
  const EXPIRY_KEY='bjtGoogleDriveSessionExpiryV1';
  const CONSENT_KEY='bjtGoogleDriveConsentGrantedV1';
  const SKEW=90*1000;

  function clear(){
    try{sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(EXPIRY_KEY);}catch{}
  }
  function getToken(){
    try{
      const token=sessionStorage.getItem(TOKEN_KEY)||'';
      const expiry=Number(sessionStorage.getItem(EXPIRY_KEY)||0);
      if(!token||Date.now()>=expiry-SKEW){clear();return'';}
      return token;
    }catch{return'';}
  }
  function getExpiry(){try{return Number(sessionStorage.getItem(EXPIRY_KEY)||0);}catch{return 0;}}
  function save(token,expiresIn=3600){
    if(!token)return;
    const expiry=Date.now()+Math.max(60,Number(expiresIn)||3600)*1000;
    try{
      sessionStorage.setItem(TOKEN_KEY,token);
      sessionStorage.setItem(EXPIRY_KEY,String(expiry));
      localStorage.setItem(CONSENT_KEY,'1');
    }catch{}
  }
  function hasConsent(){try{return localStorage.getItem(CONSENT_KEY)==='1';}catch{return false;}}
  function forget(){clear();try{localStorage.removeItem(CONSENT_KEY);}catch{}}

  window.BJT_GOOGLE_CLIENT_ID=clientId;
  window.BJT_GOOGLE_SESSION={
    getToken,
    getExpiry,
    hasValidToken:()=>Boolean(getToken()),
    hasConsent,
    save,
    clear,
    forget
  };
  try{localStorage.setItem('bjtGoogleClientId',clientId);}catch{}

  function patchGoogleIdentity(){
    const oauth2=window.google?.accounts?.oauth2;
    if(!oauth2?.initTokenClient||oauth2.initTokenClient.__bjtPatched)return false;
    const original=oauth2.initTokenClient.bind(oauth2);
    const patched=config=>{
      let usedSilent=false;
      const userCallback=config.callback;
      const wrappedConfig={...config,callback:response=>{
        if(response?.access_token){
          save(response.access_token,response.expires_in);
        }else if(response?.error&&usedSilent){
          clear();
          try{localStorage.removeItem(CONSENT_KEY);}catch{}
        }
        userCallback?.(response);
      }};
      const client=original(wrappedConfig);
      const request=client.requestAccessToken.bind(client);
      client.requestAccessToken=options=>{
        const cached=getToken();
        if(cached){
          const expires=Math.max(60,Math.floor((getExpiry()-Date.now())/1000));
          queueMicrotask(()=>wrappedConfig.callback({access_token:cached,expires_in:expires,scope:config.scope||''}));
          return;
        }
        const opts={...(options||{})};
        if(opts.prompt==null){
          usedSilent=hasConsent();
          opts.prompt=usedSilent?'':'consent';
        }else usedSilent=opts.prompt==='';
        request(opts);
      };
      return client;
    };
    patched.__bjtPatched=true;
    oauth2.initTokenClient=patched;
    return true;
  }

  if(!patchGoogleIdentity()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(patchGoogleIdentity()||tries>100)clearInterval(timer);},50);
  }
})();