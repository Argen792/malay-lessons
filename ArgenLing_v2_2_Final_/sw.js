const CACHE_NAME = 'argenling-pwa-2-2-v3-completion-fix';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
const APP_URL = new URL('./index.html', self.registration.scope).href;
async function warmCore() {
  const cache = await caches.open(CACHE_NAME);
  for (const url of CORE) {
    const res = await fetch(url, {cache:'reload'});
    if (!res.ok) throw new Error('Cannot cache ' + url + ': ' + res.status);
    await cache.put(url, res);
  }
}
self.addEventListener('install', e => {
  e.waitUntil(warmCore().then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(n=>n.startsWith('argenling-pwa-')&&n!==CACHE_NAME).map(n=>caches.delete(n)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', e => {
  if (e.data?.type === 'CACHE_CORE') e.waitUntil((async()=>{
    try { await warmCore(); e.source?.postMessage({type:'CACHE_READY'}); }
    catch(err) { e.source?.postMessage({type:'CACHE_FAILED'}); }
  })());
});
self.addEventListener('fetch', e => {
  if(e.request.method!=='GET') return;
  const url = new URL(e.request.url);
  if(e.request.mode === 'navigate') {
    e.respondWith((async()=>{
      try { const fresh = await fetch(e.request); if(fresh.ok) return fresh; throw new Error('Failed'); }
      catch(e) { return await caches.match(e.request) || await caches.match(APP_URL) || Response.error(); }
    })());
    return;
  }
  e.respondWith((async()=>{
    const cache = await caches.open(CACHE_NAME);
    const saved = await cache.match(e.request);
    if(saved) return saved;
    try {
      const fresh = await fetch(e.request);
      if (fresh.ok || fresh.type === 'opaque') {
        try { await cache.put(e.request, fresh.clone()); } catch(err) {}
      }
      return fresh;
    } catch(err) { return saved || Response.error(); }
  })());
});
