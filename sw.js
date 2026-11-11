// Kệ Truyện – service worker.
// Trang chính (index.html): lấy bản mới nhất từ mạng trước; mất mạng hoặc mạng quá chậm thì dùng bản đã lưu.
// Ảnh/icon/manifest: dùng bản đã lưu cho nhanh, đồng thời cập nhật ngầm.
const CACHE='ke-truyen-v13';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
const WAIT_NET=3500; // quá thời gian này mà mạng chưa trả lời thì mở bản đã lưu

self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});

self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET'||new URL(req.url).origin!==location.origin) return;
  const isPage=req.mode==='navigate'||/\/(index\.html)?$/.test(new URL(req.url).pathname);
  e.respondWith(isPage?pageFirst(req):assetFirst(req));
});

// Trang chính: mạng trước (bỏ qua bộ nhớ đệm HTTP), lưu lại bản mới; lỗi/chậm thì dùng bản cũ.
async function pageFirst(req){
  const c=await caches.open(CACHE);
  const net=fetch(req,{cache:'no-cache'}).then(r=>{ if(r.ok) c.put('./index.html',r.clone()); return r; }).catch(()=>null);
  const timeout=new Promise(res=>setTimeout(()=>res(null),WAIT_NET));
  const r=await Promise.race([net,timeout]);
  if(r) return r;
  const old=await c.match('./index.html');
  return old || (await net) || new Response('Offline',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
}
// Tài nguyên khác: bản đã lưu trước, cập nhật ngầm.
async function assetFirst(req){
  const c=await caches.open(CACHE);
  const hit=await c.match(req,{ignoreSearch:true});
  const net=fetch(req).then(r=>{ if(r.ok) c.put(req,r.clone()); return r; }).catch(()=>null);
  return hit || (await net) || new Response('Offline',{status:503});
}
