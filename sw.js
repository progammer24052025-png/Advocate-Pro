// ================================================================
// ADVOCATE PRO — Service Worker (sw.js)
// Handles PWA offline support + hearing notifications
// ================================================================

const CACHE_NAME = 'advocate-pro-v1';
const CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

// Files to cache for offline use
const PRECACHE_URLS = [
  './',
  './index.html',
  './case-library.html',
  './documents.html',
  './shared.css',
  './shared.js',
  './db.js',
  './style.css',
  './script.js'
];

// ── Install: Cache core files ──────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: Clean old caches ─────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: Serve from cache, fallback to network ───────────────
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(response => {
        // Update cache with fresh copy
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      
      return cached || fetchPromise;
    })
  );
});

// ── Notification Click: Open app to case library ───────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Focus existing window if open
      for (const client of list) {
        if (client.url.includes('case-library') && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow('./case-library.html');
      }
    })
  );
});

// ── Periodic Background Sync: Check hearings ──────────────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'hearing-check') {
    event.waitUntil(checkAndNotifyHearings());
  }
});

// ── Message from main thread: Check hearings now ───────────────
self.addEventListener('message', (event) => {
  if (event.data === 'check-hearings') {
    event.waitUntil(checkAndNotifyHearings());
  }
});

// ── Check hearings and show notifications ──────────────────────
async function checkAndNotifyHearings() {
  try {
    // Read IndexedDB from service worker
    const db = await openDBInSW();
    const cases = await getAllFromStore(db, 'cases');
    
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    
    // Find today's hearings
    const todayHearings = cases.filter(c => c.nextHearing === today && c.status !== 'Disposed');
    
    // Find tomorrow's hearings
    const tomorrowHearings = cases.filter(c => c.nextHearing === tomorrow && c.status !== 'Disposed');
    
    // Show today's hearings notification
    if (todayHearings.length > 0) {
      const titles = todayHearings.slice(0, 3).map(c => c.caseTitle || c.caseNumber).join(', ');
      const extra = todayHearings.length > 3 ? ` +${todayHearings.length - 3} more` : '';
      
      await self.registration.showNotification('⚖️ Today\'s Hearings', {
        body: `${todayHearings.length} case${todayHearings.length > 1 ? 's' : ''}: ${titles}${extra}`,
        icon: './logo.png',
        badge: './logo.png',
        tag: 'today-hearings',
        requireInteraction: true,
        data: { type: 'today', count: todayHearings.length }
      });
    }
    
    // Show tomorrow's hearings notification (evening reminder)
    const hour = new Date().getHours();
    if (tomorrowHearings.length > 0 && hour >= 18) {
      const titles = tomorrowHearings.slice(0, 3).map(c => c.caseTitle || c.caseNumber).join(', ');
      const extra = tomorrowHearings.length > 3 ? ` +${tomorrowHearings.length - 3} more` : '';
      
      await self.registration.showNotification('📅 Tomorrow\'s Hearings', {
        body: `${tomorrowHearings.length} case${tomorrowHearings.length > 1 ? 's' : ''}: ${titles}${extra}`,
        icon: './logo.png',
        badge: './logo.png',
        tag: 'tomorrow-hearings',
        data: { type: 'tomorrow', count: tomorrowHearings.length }
      });
    }
    
    return true;
  } catch (e) {
    console.warn('[SW] Hearing check failed:', e);
    return false;
  }
}

// ── IndexedDB helpers for service worker ───────────────────────
function openDBInSW() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('AdvocateProDB', 2);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllFromStore(db, store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
