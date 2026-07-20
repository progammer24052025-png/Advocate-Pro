// ================================================================
// ADVOCATE PRO — Service Worker (sw.js)
// Handles PWA offline support + hearing & task notifications
// ================================================================

const CACHE_NAME = 'advocate-pro-v2';
const DB_NAME = 'AdvocateProDB';
const DB_VERSION = 3;

const PRECACHE_URLS = [
  './',
  './index.html',
  './case-library.html',
  './documents.html',
  './shared.css',
  './shared.js',
  './db.js',
  './manifest.json',
  './logo.svg',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
];

// ── Install: Cache core files (tolerate individual failures) ───
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(PRECACHE_URLS.map(url => cache.add(url)))
    ).then(() => self.skipWaiting())
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
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(response => {
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

// ── Notification Click ───────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || './case-library.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});

// ── Periodic Background Sync ─────────────────────────────────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'hearing-check') {
    event.waitUntil(checkAndNotify());
  }
});

// ── Message from main thread ─────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'check-hearings' || event.data === 'check-reminders') {
    event.waitUntil(checkAndNotify());
  }
});

// ── Check hearings & tasks, show notifications ───────────────────
async function checkAndNotify() {
  try {
    const db = await openDBInSW();
    const cases = await getAllFromStore(db, 'cases');

    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const hour = new Date().getHours();

    const todayHearings = cases.filter(c => c.nextHearing === today && c.status !== 'Disposed');
    const tomorrowHearings = cases.filter(c => c.nextHearing === tomorrow && c.status !== 'Disposed');

    const dueTodayTasks = [];
    const overdueTasks = [];
    for (const c of cases) {
      if (!c.tasks) continue;
      for (const t of c.tasks) {
        if (t.done || !t.dueDate) continue;
        if (t.dueDate === today) dueTodayTasks.push({ c, t });
        else if (t.dueDate < today) overdueTasks.push({ c, t });
      }
    }

    const icon = './logo.svg';

    if (todayHearings.length > 0) {
      const titles = todayHearings.slice(0, 3).map(c => c.caseTitle || c.caseNumber).join(', ');
      const extra = todayHearings.length > 3 ? ` +${todayHearings.length - 3} more` : '';
      await self.registration.showNotification('⚖️ Today\'s Hearings', {
        body: `${todayHearings.length} case${todayHearings.length > 1 ? 's' : ''}: ${titles}${extra}`,
        icon, badge: icon, tag: 'today-hearings', requireInteraction: true,
        data: { url: './case-library.html#calendar' },
      });
    }

    if (tomorrowHearings.length > 0 && hour >= 18) {
      const titles = tomorrowHearings.slice(0, 3).map(c => c.caseTitle || c.caseNumber).join(', ');
      const extra = tomorrowHearings.length > 3 ? ` +${tomorrowHearings.length - 3} more` : '';
      await self.registration.showNotification('📅 Tomorrow\'s Hearings', {
        body: `${tomorrowHearings.length} case${tomorrowHearings.length > 1 ? 's' : ''}: ${titles}${extra}`,
        icon, badge: icon, tag: 'tomorrow-hearings',
        data: { url: './case-library.html#calendar' },
      });
    }

    if (dueTodayTasks.length > 0) {
      const items = dueTodayTasks.slice(0, 3).map(({ c, t }) => `${t.text} (${c.caseNumber})`).join(', ');
      const extra = dueTodayTasks.length > 3 ? ` +${dueTodayTasks.length - 3} more` : '';
      await self.registration.showNotification('📌 Tasks Due Today', {
        body: `${dueTodayTasks.length} task${dueTodayTasks.length > 1 ? 's' : ''}: ${items}${extra}`,
        icon, badge: icon, tag: 'tasks-due-today',
        data: { url: './case-library.html' },
      });
    }

    if (overdueTasks.length > 0 && hour >= 9) {
      const items = overdueTasks.slice(0, 3).map(({ c, t }) => `${t.text} (${c.caseNumber})`).join(', ');
      const extra = overdueTasks.length > 3 ? ` +${overdueTasks.length - 3} more` : '';
      await self.registration.showNotification('⚠️ Overdue Tasks', {
        body: `${overdueTasks.length} overdue: ${items}${extra}`,
        icon, badge: icon, tag: 'tasks-overdue',
        data: { url: './case-library.html' },
      });
    }

    return true;
  } catch (e) {
    console.warn('[SW] Reminder check failed:', e);
    return false;
  }
}

function openDBInSW() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
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
