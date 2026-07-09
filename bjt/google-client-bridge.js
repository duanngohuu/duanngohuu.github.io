(()=>{
  if(window.BJT_GOOGLE_CLIENT_ID)return;
  const preferred=['bjtGoogleClientId','googleOAuthClientId','oauthClientId','googleClientId','flashcardOAuthClientId','clientId'];
  for(const key of preferred){
    const value=localStorage.getItem(key)||'';
    if(/^[0-9A-Za-z._-]+\.apps\.googleusercontent\.com$/.test(value)){window.BJT_GOOGLE_CLIENT_ID=value;localStorage.setItem('bjtGoogleClientId',value);return;}
  }
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i),value=key?localStorage.getItem(key)||'':'';
    if(/^[0-9A-Za-z._-]+\.apps\.googleusercontent\.com$/.test(value)){window.BJT_GOOGLE_CLIENT_ID=value;localStorage.setItem('bjtGoogleClientId',value);return;}
  }
})();