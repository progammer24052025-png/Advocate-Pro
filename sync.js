// ================================================================
// ADVOCATE PRO — Case Sync Layer (sync.js)
// CNR helpers, hearing-history merge, and a pluggable provider
// interface for pulling case data from eCourts-style sources.
// See docs/ecourts-sync-plan.md for the design.
// ================================================================

// ── CNR (Case Number Record) ──────────────────────────────────────
// 16 chars, e.g. GJAH010012342023:
//   GJ     state code (2 letters)
//   AH     district code (2 letters)
//   01     establishment / court complex (2 digits)
//   001234 case serial (6 digits)
//   2023   filing year (4 digits)
const CNR = {
  normalize(raw) {
    return String(raw || '').toUpperCase().replace(/[\s\-\/]/g, '');
  },
  isValid(raw) {
    const v = CNR.normalize(raw);
    if (!/^[A-Z]{4}\d{12}$/.test(v)) return false;
    const year = parseInt(v.slice(-4), 10);
    return year >= 1950 && year <= new Date().getFullYear() + 1;
  },
  parse(raw) {
    const v = CNR.normalize(raw);
    if (!CNR.isValid(v)) return null;
    return {
      cnr: v,
      stateCode: v.slice(0, 2),
      establishment: v.slice(0, 6),
      serial: v.slice(6, 12),
      year: v.slice(12, 16),
    };
  },
};

// ── Hearing history ───────────────────────────────────────────────
// Each case carries hearings: [{ date, purpose, judge, courtNo, outcome, source, recordedAt }]
// Called on save: when nextHearing moves, the old date becomes a history entry.
function mergeHearingHistory(existing, updated) {
  const hearings = Array.isArray(existing?.hearings) ? [...existing.hearings] : [];
  const oldDate = existing?.nextHearing;
  if (oldDate && oldDate !== updated.nextHearing && !hearings.some(h => h.date === oldDate)) {
    hearings.push({
      date: oldDate,
      purpose: existing.hearingType || '',
      judge: existing.judgeName || '',
      courtNo: existing.courtNo || '',
      outcome: updated.prevOrder && updated.prevOrder !== existing.prevOrder ? updated.prevOrder : '',
      source: 'manual',
      recordedAt: new Date().toISOString(),
    });
  }
  hearings.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  return hearings;
}

// ── Provider interface ────────────────────────────────────────────
// A provider implements:
//   id, label
//   isConfigured(): boolean
//   fetchCase(cnr): Promise<NormalizedCase>
// NormalizedCase = {
//   cnr, caseNumber, caseType, status, stage, filingDate,
//   nextHearing, courtNo, courtName, judgeName,
//   petitioners: [], respondents: [],
//   hearings: [{ date, purpose, judge, outcome }],
//   orders:   [{ date, title, url }],
//   fetchedAt
// }
const SYNC_SETTINGS_KEY = 'advpro_sync_settings';

const SyncSettings = {
  get() {
    try { return JSON.parse(localStorage.getItem(SYNC_SETTINGS_KEY)) || {}; }
    catch { return {}; }
  },
  set(patch) {
    const next = { ...SyncSettings.get(), ...patch };
    localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(next));
    return next;
  },
};

// Backend proxy provider: the app never talks to eCourts directly (CORS,
// CAPTCHA, API keys). It calls a small backend you deploy, which calls a
// licensed data provider and returns a NormalizedCase.
//   GET {endpoint}/case/{cnr}   →  NormalizedCase JSON
const BackendProvider = {
  id: 'backend',
  label: 'Sync server',
  isConfigured() { return !!SyncSettings.get().endpoint; },
  async fetchCase(cnr) {
    const { endpoint, token } = SyncSettings.get();
    const res = await fetch(`${endpoint.replace(/\/$/, '')}/case/${encodeURIComponent(cnr)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Sync server returned ${res.status}`);
    return res.json();
  },
};

// Paste/import provider: the advocate pastes JSON produced by the browser
// extension (or exported from a provider). Works with no server at all.
const PasteProvider = {
  id: 'paste',
  label: 'Paste data',
  isConfigured() { return true; },
  async fetchCase(cnr, raw) {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || CNR.normalize(data.cnr) !== CNR.normalize(cnr)) {
      throw new Error('Pasted data is for a different CNR');
    }
    return data;
  },
};

const SyncProviders = { backend: BackendProvider, paste: PasteProvider };

// ── Diff: what would a sync change? ───────────────────────────────
// Returns [{ field, label, from, to }] for fields the remote value differs on.
// Hearings/orders are reported as counts of new entries.
const SYNC_FIELDS = {
  status: 'Status', nextHearing: 'Next hearing', courtNo: 'Court no.',
  courtName: 'Court', judgeName: 'Judge', filingDate: 'Filing date',
  caseType: 'Case type', stage: 'Stage',
};

function diffCase(local, remote) {
  const changes = [];
  for (const [field, label] of Object.entries(SYNC_FIELDS)) {
    const to = remote[field];
    if (to == null || to === '') continue;
    const from = local[field] || '';
    if (String(from) !== String(to)) changes.push({ field, label, from, to });
  }
  const knownDates = new Set((local.hearings || []).map(h => h.date));
  const newHearings = (remote.hearings || []).filter(h => h.date && !knownDates.has(h.date));
  if (newHearings.length) changes.push({ field: 'hearings', label: 'New hearing entries', from: '', to: newHearings });
  const knownOrders = new Set((local.orders || []).map(o => o.url || o.date + o.title));
  const newOrders = (remote.orders || []).filter(o => !knownOrders.has(o.url || o.date + o.title));
  if (newOrders.length) changes.push({ field: 'orders', label: 'New orders', from: '', to: newOrders });
  return changes;
}

// Apply only the changes the user accepted. Never touches notes, tasks,
// client details or anything else the advocate typed.
function applySyncChanges(local, remote, acceptedFields) {
  const out = { ...local };
  for (const ch of diffCase(local, remote)) {
    if (!acceptedFields.includes(ch.field)) continue;
    if (ch.field === 'hearings') {
      out.hearings = [...(local.hearings || []), ...ch.to.map(h => ({ ...h, source: 'sync' }))]
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    } else if (ch.field === 'orders') {
      out.orders = [...(local.orders || []), ...ch.to];
    } else {
      out[ch.field] = ch.to;
    }
  }
  out.sync = { lastSyncedAt: new Date().toISOString(), lastRemote: remote };
  return out;
}
