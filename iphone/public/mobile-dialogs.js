'use strict';
(function(){
  const dialog=document.querySelector('#search-dialog');
  if(!dialog)return;
  function fit(){
    const viewport=window.visualViewport;
    dialog.style.setProperty('--search-viewport-height',`${viewport?.height||window.innerHeight}px`);
    dialog.style.setProperty('--search-viewport-top',`${viewport?.offsetTop||0}px`);
  }
  function dismiss(){
    if(dialog.contains(document.activeElement))document.activeElement.blur();
    if(dialog.open)dialog.close();
  }
  for(const button of dialog.querySelectorAll('[data-close="search-dialog"]')){
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();dismiss();});
  }
  let startedOutside=false;
  function outside(event){const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;}
  dialog.addEventListener('pointerdown',event=>{startedOutside=event.target===dialog&&outside(event);});
  dialog.addEventListener('click',event=>{if(startedOutside&&event.target===dialog&&outside(event))dismiss();startedOutside=false;});
  dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
  new MutationObserver(fit).observe(dialog,{attributes:true,attributeFilter:['open']});
  window.addEventListener('resize',fit);
  window.visualViewport?.addEventListener('resize',fit);
  window.visualViewport?.addEventListener('scroll',fit);
  fit();
})();
