const CACHE='e-equity-iphone-v1.1.1';
const SHELL=['/','/app.js','/styles.css','/mobile.css','/account-core.js','/calendar.js','/quote-policy.js','/mobile-api.js','/mobile-shell.js','/mobile-dialogs.js','/icon.png','/icon.svg','/manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil((async()=>{const c=await caches.open(CACHE);await Promise.all(SHELL.map(async p=>{try{const r=await fetch(p,{cache:'reload'});if(r.ok&&!r.redirected)await c.put(p,r);}catch{}}));await self.skipWaiting();})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('e-equity-iphone-')&&k!==CACHE)await caches.delete(k);await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
  const u=new URL(event.request.url);if(u.origin!==self.location.origin||event.request.method!=='GET'||u.pathname.startsWith('/api/')||!SHELL.includes(u.pathname))return;
  event.respondWith((async()=>{try{const r=await fetch(event.request);if(r.ok&&!r.redirected){const c=await caches.open(CACHE);await c.put(u.pathname,r.clone());}return r;}catch{return(await caches.match(u.pathname))||new Response('请联网后重新打开纸上美股。',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});}})());
});
