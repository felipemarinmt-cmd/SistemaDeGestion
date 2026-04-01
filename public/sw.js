const CACHE_NAME = 'restopos-v3';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/login.html',
    '/admin.html',
    '/cocina.html',
    '/comandas.html',
    '/styles.css',
    '/admin.css',
    '/cocina.css',
    '/api.js',
    '/app.js',
    '/admin.js',
    '/cocina.js',
    '/guard.js',
    '/login.js',
    '/printer.js',
    '/reports.js',
    '/sanitize.js',
    '/state.js',
    '/ui.js',
    '/config.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Estrategia: Network First para JSON/API, Cache First para estáticos
self.addEventListener('fetch', (event) => {
    const isSupabaseCall = event.request.url.includes('supabase.co');

    if (isSupabaseCall) {
        // Para API SIEMPRE intentamos red primero, NO cacheamos DB Realtime/Rest
        // (La sincronización offline de comandas va por cuenta de localStorage en app.js)
        event.respondWith(fetch(event.request).catch(err => {
            console.warn('Network error intercepable', err);
            // Acá se podría retornar un JSON fallback si se requiere un offline completo
            throw err;
        }));
    } else {
        // Archivos estáticos: Cache First con Network Fallback
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request).then(fetchRes => {
                    return caches.open(CACHE_NAME).then(cache => {
                        // Solo cachea GET
                        if (event.request.method === 'GET') {
                            cache.put(event.request, fetchRes.clone());
                        }
                        return fetchRes;
                    });
                });
            })
        );
    }
});
