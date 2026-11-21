/* مركز قشور الضاهر - Service Worker (يعمل بدون إنترنت) */
var CACHE = "qushoor-v15";
var LOCAL = ["./", "./index.html", "./manifest.json",
  "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png",
  "./keys.js", "./lib/xlsx.full.min.js", "./lib/jspdf.umd.min.js"];
var CDN = ["https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"];

/* كل ملف يُخزَّن لوحده: غياب ملف (مثل أيقونة) لا يُفشل التثبيت كله */
function put(cache, url, opts){
  return fetch(new Request(url, opts || {})).then(function(res){
    if (res && (res.ok || res.type === "opaque")) return cache.put(url, res);
  }).catch(function(){});
}
self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(
      LOCAL.map(function(u){ return put(c, u, { cache: "reload" }); })
        .concat(CDN.map(function(u){ return put(c, u, { mode: "no-cors" }); }))
    );
  }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

/* من الكاش أولاً (فوراً، حتى مع إنترنت ضعيف)، وتحديث الكاش بالخلفية عند توفر الإنترنت */
self.addEventListener("fetch", function(e){
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;
  var isCdn = CDN.indexOf(req.url) >= 0;
  if (!sameOrigin && !isCdn) return; /* واتساب وغيره: مباشرة */

  /* ملفات إضافات الزبائن: من الشبكة أولاً (لتصل التحديثات فوراً) ثم الكاش للعمل بدون إنترنت */
  if (sameOrigin && url.pathname.indexOf("/customers/") >= 0) {
    e.respondWith(fetch(req).then(function(res){
      if (res && res.ok) { var cp = res.clone(); caches.open(CACHE).then(function(c){ c.put(req, cp); }).catch(function(){}); }
      return res;
    }).catch(function(){ return caches.match(req).then(function(m){ return m || new Response("", { status: 504 }); }); }));
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function(hit){
      var net = fetch(req).then(function(res){
        if (res && (res.ok || res.type === "opaque")) {
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); }).catch(function(){});
        }
        return res;
      }).catch(function(){ return null; });
      if (hit) { e.waitUntil(net); return hit; }
      return net.then(function(res){
        if (res) return res;
        if (req.mode === "navigate") return caches.match("./index.html");
        return new Response("", { status: 504, statusText: "offline" });
      });
    })
  );
});
