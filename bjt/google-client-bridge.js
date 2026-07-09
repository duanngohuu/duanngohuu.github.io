(()=>{
  if(window.BJT_GOOGLE_CLIENT_ID)return;
  const isClientId=v=>/^[0-9A-Za-z._-]+\.apps\.googleusercontent\.com$/.test(String(v||'').trim());
  const remember=v=>{const id=String(v||'').trim();if(!isClientId(id))return false;window.BJT_GOOGLE_CLIENT_ID=id;localStorage.setItem('bjtGoogleClientId',id);return true;};

  const rawKeys=['bjtGoogleClientId','googleOAuthClientId','oauthClientId','googleClientId','flashcardOAuthClientId','clientId'];
  for(const key of rawKeys){if(remember(localStorage.getItem(key)))return;}

  const jsonKeys=['fc_google_sheet_config_v2','fc_google_sheet_config','flashcard_google_config','googleSheetConfig'];
  for(const key of jsonKeys){
    try{
      const value=JSON.parse(localStorage.getItem(key)||'{}');
      if(remember(value.clientId||value.client_id||value.oauthClientId||value.googleClientId))return;
    }catch{}
  }

  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i),raw=key?localStorage.getItem(key)||'':'';
    if(remember(raw))return;
    try{
      const value=JSON.parse(raw);
      if(value&&typeof value==='object'&&remember(value.clientId||value.client_id||value.oauthClientId||value.googleClientId))return;
    }catch{}
  }
})();