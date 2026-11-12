// Kệ Truyện – service worker.
// Trang chính (index.html): luôn lấy bản mới nhất từ mạng (bỏ qua mọi lớp lưu tạm); mất mạng hoặc mạng quá chậm thì dùng bản đã lưu.
// Ảnh/icon/manifest: dùng bản đã lưu cho nhanh, đồng thời cập nhật ngầm.
const CACHE='ke-truyen-v42';
const PAGE='./index.html';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
const WAIT_NET=3500; // quá thời gian này mà mạng chưa trả lời thì mở bản đã lưu

self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});

self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET'||new URL(req.url).origin!==location.origin) return;
  const isPage=req.mode==='navigate'||/\/(index\.html)?$/.test(new URL(req.url).pathname);
  e.respondWith(isPage?pageFirst():assetFirst(req));
});
// App đang mở hỏi "có bản mới chưa?"
self.addEventListener('message',e=>{ if(e.data==='check-update') e.waitUntil(checkUpdate()); });

// Thêm tham số thời gian vào địa chỉ để máy chủ (GitHub Pages giữ bản cũ tới 10 phút) buộc phải trả bản mới nhất.
const freshPage=()=>fetch(PAGE+'?_='+Date.now(),{cache:'no-store'});
const notify=async()=>{ for(const cl of await self.clients.matchAll({type:'window'})) cl.postMessage('update-ready'); };
const textOf=async r=>r?r.clone().text():'';

// Lấy bản mới, lưu lại; trả về {res, changed}
async function refresh(c){
  const r=await freshPage(); if(!r.ok) return {res:null,changed:false};
  const changed=(await textOf(r))!==(await textOf(await c.match(PAGE)));
  if(changed) await c.put(PAGE,r.clone());
  return {res:r,changed};
}
async function checkUpdate(){
  try{ const c=await caches.open(CACHE); if((await refresh(c)).changed) await notify(); }catch{}
}
// Trang chính: mạng trước; lỗi/chậm thì dùng bản cũ, và báo cho app khi bản mới về tới.
async function pageFirst(){
  const c=await caches.open(CACHE);
  let late=false;
  const net=refresh(c).then(x=>{ if(late&&x.changed) notify(); return x.res; }).catch(()=>null);
  const r=await Promise.race([net,new Promise(res=>setTimeout(()=>res(null),WAIT_NET))]);
  if(r) return r;
  late=true;
  const old=await c.match(PAGE);
  return old || (await net) || new Response('Offline',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
}
// Tài nguyên khác: bản đã lưu trước, cập nhật ngầm.
async function assetFirst(req){
  const c=await caches.open(CACHE);
  const hit=await c.match(req,{ignoreSearch:true});
  const net=fetch(req).then(r=>{ if(r.ok) c.put(req,r.clone()); return r; }).catch(()=>null);
  return hit || (await net) || new Response('Offline',{status:503});
}
