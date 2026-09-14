const cache="sous-lescalier-v7";
self.addEventListener("install",event=>event.waitUntil(caches.open(cache).then(store=>store.addAll(["/","/manifest.webmanifest","/icon-192.png","/icon-512.png"]))));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==cache).map(key=>caches.delete(key))))));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET"||new URL(event.request.url).pathname.startsWith("/api/"))return;event.respondWith(caches.match(event.request).then(found=>found||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(cache).then(store=>store.put(event.request,copy))}return response}))) });
