// Kệ Truyện – service worker.
// Trang chính (index.html): mở NGAY bằng bản đã lưu (không chờ mạng), đồng thời tải bản mới ở nền;
// có bản mới thì báo cho app, app tự làm mới khi bạn đang ở kệ (đang đọc thì chờ về kệ).
// Ảnh/icon/manifest: dùng bản đã lưu cho nhanh, đồng thời cập nhật ngầm.
const CACHE='ke-truyen-v57';
const PAGE='./index.html';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];

self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});

self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET'||new URL(req.url).origin!==location.origin) return;
  const isPage=req.mode==='navigate'||/\/(index\.html)?$/.test(new URL(req.url).pathname);
  e.respondWith(isPage?pageFirst(e):assetFirst(req));
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
// Trang chính: bản đã lưu trước (mở tức thì), kiểm tra bản mới ở nền. Chưa có bản lưu (lần đầu) thì lấy từ mạng.
async function pageFirst(e){
  const c=await caches.open(CACHE);
  const old=await c.match(PAGE);
  if(old){ e.waitUntil(checkUpdate()); return old; }
  try{ const {res}=await refresh(c); if(res) return res; }catch{}
  return (await c.match('./')) || new Response('Offline',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
}
// Tài nguyên khác: bản đã lưu trước, cập nhật ngầm.
async function assetFirst(req){
  const c=await caches.open(CACHE);
  const hit=await c.match(req,{ignoreSearch:true});
  const net=fetch(req).then(r=>{ if(r.ok) c.put(req,r.clone()); return r; }).catch(()=>null);
  return hit || (await net) || new Response('Offline',{status:503});
}
