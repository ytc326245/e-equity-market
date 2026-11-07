'use strict';
(function(){
  const $=s=>document.querySelector(s);
  const installed=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  let dismissed=false;try{dismissed=localStorage.getItem('equity-install-dismissed')==='yes';}catch{}
  $('#install-hint').hidden=installed||dismissed;
  $('#install-dismiss').onclick=()=>{$('#install-hint').hidden=true;try{localStorage.setItem('equity-install-dismissed','yes');}catch{}};
  $('#mobile-search').onclick=()=>$('#search-open').click();
  document.addEventListener('equity-page',event=>{$('#mobile-trade-shortcuts').hidden=event.detail.page!=='terminal';});
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.page)$('#mobile-trade-shortcuts').hidden=button.dataset.page!=='terminal';
    if(button.hasAttribute('data-jump-order'))$('.order-panel').scrollIntoView({behavior:'smooth',block:'start'});
  });
  function download(text,type,name){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  document.addEventListener('click',async event=>{
    const a=event.target.closest('a[download]');if(!a)return;const route=new URL(a.href).pathname;if(!['/api/export','/api/trades.csv'].includes(route))return;
    event.preventDefault();event.stopPropagation();
    try{
      const data=await EquityMobileAPI.request('/api/export');
      if(route==='/api/export')download(JSON.stringify(data,null,2),'application/json',`E-Equity-iPhone-${new Date().toISOString().slice(0,10)}.json`);
      else{const rows=[['Time UTC','Symbol','Side','Shares','Price USD','Amount USD','Data Provider','Quote time (provider)','Quote fetched UTC'],...data.account.trades.map(t=>[t.timestamp,t.symbol,t.side,t.quantity,t.price,(t.amountCents/100).toFixed(2),t.provider,t.quoteAsOf||'',t.quoteFetchedAt||''])];const csv=rows.map(r=>r.map(v=>{let s=String(v);if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');download('\uFEFF'+csv,'text/csv;charset=utf-8','E-Equity-trades.csv');}
    }catch(e){const toast=$('#toast');toast.textContent=e.message;toast.hidden=false;setTimeout(()=>toast.hidden=true,5000);}
  },true);
  if('serviceWorker' in navigator&&window.isSecureContext){
    const alreadyControlled=!!navigator.serviceWorker.controller;let refreshing=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(alreadyControlled&&!refreshing){refreshing=true;window.location.reload();}});
    navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>{});
  }
  window.addEventListener('online',()=>{if(typeof loadState==='function')loadState().catch(()=>{});});
})();
