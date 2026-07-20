// ================================================================
// ADVOCATE PRO — IndexedDB Database Layer (db.js)
// Shared by all pages. Handles all persistent storage.
// ================================================================

const DB_NAME = 'AdvocateProDB';
const DB_VERSION = 3;

const STORES = {
  CASES:     'cases',
  FEES:      'fees',
  PAYMENTS:  'payments',
  TEMPLATES: 'templates',
  DOCUMENTS: 'documents',
};

let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) { resolve(_db); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      const oldVersion = e.oldVersion;

      // Cases store
      if (!d.objectStoreNames.contains(STORES.CASES)) {
        const s = d.createObjectStore(STORES.CASES, { keyPath: 'id', autoIncrement: true });
        s.createIndex('caseNumber',  'caseNumber',  { unique: false });
        s.createIndex('clientName',  'clientName',  { unique: false });
        s.createIndex('judgeName',   'judgeName',   { unique: false });
        s.createIndex('courtNo',     'courtNo',     { unique: false });
        s.createIndex('status',      'status',      { unique: false });
        s.createIndex('nextHearing', 'nextHearing', { unique: false });
        s.createIndex('caseType',    'caseType',    { unique: false });
      }

      // Version 3: Add tags index for case filtering
      if (oldVersion < 3) {
        const caseStore = d.transaction.objectStore
          ? d.transaction.objectStore(STORES.CASES)
          : e.target.transaction.objectStore(STORES.CASES);
        if (!caseStore.indexNames.contains('tags')) {
          caseStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        }
      }

      // Fees store (one per case — agreed amount)
      if (!d.objectStoreNames.contains(STORES.FEES)) {
        const s = d.createObjectStore(STORES.FEES, { keyPath: 'id', autoIncrement: true });
        s.createIndex('caseId', 'caseId', { unique: true });
      }

      // Payments store (multiple receipts per case)
      if (!d.objectStoreNames.contains(STORES.PAYMENTS)) {
        const s = d.createObjectStore(STORES.PAYMENTS, { keyPath: 'id', autoIncrement: true });
        s.createIndex('caseId', 'caseId', { unique: false });
      }

      // Templates store (built-in + custom uploaded)
      if (!d.objectStoreNames.contains(STORES.TEMPLATES)) {
        d.createObjectStore(STORES.TEMPLATES, { keyPath: 'id', autoIncrement: true });
      }

      // Documents store (generated / saved drafts)
      if (!d.objectStoreNames.contains(STORES.DOCUMENTS)) {
        d.createObjectStore(STORES.DOCUMENTS, { keyPath: 'id', autoIncrement: true });
      }
    };

    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function dbGetAll(store) {
  const d = await openDB();
  return new Promise((res, rej) => {
    const req = d.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

async function dbGet(store, id) {
  const d = await openDB();
  return new Promise((res, rej) => {
    const req = d.transaction(store, 'readonly').objectStore(store).get(id);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

async function dbAdd(store, data) {
  const d = await openDB();
  return new Promise((res, rej) => {
    const req = d.transaction(store, 'readwrite').objectStore(store)
      .add({ ...data, createdAt: new Date().toISOString() });
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

async function dbPut(store, data) {
  const d = await openDB();
  return new Promise((res, rej) => {
    const req = d.transaction(store, 'readwrite').objectStore(store)
      .put({ ...data, updatedAt: new Date().toISOString() });
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

async function dbDelete(store, id) {
  const d = await openDB();
  return new Promise((res, rej) => {
    const req = d.transaction(store, 'readwrite').objectStore(store).delete(id);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
}

async function dbGetByIndex(store, indexName, value) {
  const d = await openDB();
  return new Promise((res, rej) => {
    const req = d.transaction(store, 'readonly').objectStore(store).index(indexName).getAll(value);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

// ── Backup / Restore ──────────────────────────────────────────
async function exportBackup() {
  const backup = {};
  for (const s of Object.values(STORES)) backup[s] = await dbGetAll(s);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `AdvocatePro_Backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importBackup(file) {
  const text   = await file.text();
  const backup = JSON.parse(text);
  for (const [store, records] of Object.entries(backup)) {
    if (Object.values(STORES).includes(store)) {
      for (const r of records) await dbPut(store, r);
    }
  }
}

// ── Helper: sum payments for a case ──────────────────────────
async function getCaseFeeSummary(caseId) {
  const fees     = await dbGetByIndex(STORES.FEES,     'caseId', caseId);
  const payments = await dbGetByIndex(STORES.PAYMENTS, 'caseId', caseId);
  const agreed   = fees.length ? (fees[0].agreedAmount || 0) : 0;
  const received = payments.reduce((s, p) => s + (p.amount || 0), 0);
  return { agreed, received, pending: Math.max(0, agreed - received), feesId: fees.length ? fees[0].id : null };
}
