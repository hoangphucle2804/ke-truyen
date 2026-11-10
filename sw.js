const CACHE='ke-truyen-v1';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET'||new URL(req.url).origin!==location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c=>{
    const hit=await c.match(req,{ignoreSearch:true}) || (req.mode==='navigate' ? await c.match('./index.html') : null);
    const net=fetch(req).then(r=>{ if(r.ok) c.put(req,r.clone()); return r; }).catch(()=>null);
    return hit || (await net) || new Response('Offline',{status:503});
  }));
});
