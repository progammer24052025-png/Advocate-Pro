# eCourts Case Sync — Plan

Goal: keep each case's status, next date, judge/court, hearing history and orders
up to date from eCourts (district courts) and the Gujarat High Court, without the
advocate retyping anything — and without ever silently overwriting their own notes.

## Constraints

- **No official public eCourts API.** services.ecourts.gov.in case-status pages are
  CAPTCHA-gated. Commercial providers (e.g. ecourtsindia.com, Surepass) sell CNR
  lookups; their accuracy and terms must be checked before relying on them.
- **The app is static (GitHub Pages).** The browser cannot call eCourts or a paid API
  directly (CORS, and API keys must not ship in client code). Real background sync
  needs a small backend.
- **No CAPTCHA bypassing.** Automated CAPTCHA solving likely breaks portal terms and
  risks the advocate's access. Assisted flows keep the human solving it.

## Phases

### Phase 1 — Foundation (done)
- Separate `cnr` field on cases, normalized and validated (4 letters + 12 digits,
  e.g. `GJAH010012342023`). Excel import maps a `CNR` column to it.
- `hearings[]` history on each case. Changing the next hearing date records the old
  date (purpose, judge, court, outcome from the order field) as a history entry.
- Editing a case now merges into the stored record, so tasks, hearings, `createdAt`
  and sync metadata survive (previously an edit wiped tasks).
- `sync.js`: provider interface, `diffCase()` and `applySyncChanges()`.
- Case view: hearing history table and a **Sync from eCourts** dialog that shows a
  per-field diff and applies only the changes the advocate ticks. Sync never touches
  notes, tasks, client details or fees. `sync.lastSyncedAt` / `sync.lastRemote` are
  stored on the case.
- Two providers: **Sync server** (`GET {endpoint}/case/{cnr}`) and **Paste JSON**
  (for the extension, or manual testing).

### Phase 2 — Sync server
A Cloudflare Worker (or small Node service) that:
1. Exposes `GET /case/:cnr` returning the `NormalizedCase` shape (see `sync.js`).
2. Calls a licensed data provider with a server-held key; caches responses (~6h).
3. Authenticates the app with a per-advocate token.
4. Later: holds the advocate's CNR list and runs a daily cron, sending Web Push when
   a next date, stage or new order appears.

Decision needed: which data provider (cost per lookup vs. coverage of Gujarat
district courts and the High Court).

### Phase 3 — Browser extension (assisted, free)
The advocate opens their case on eCourts / Gujarat HC and solves the CAPTCHA as usual.
The extension reads the rendered case-status page, converts it to `NormalizedCase`
JSON, and hands it to Advocate Pro (clipboard → Paste provider first; later
`postMessage` to an open Advocate Pro tab).

### Phase 4 — Cause list import
Parse the public daily cause-list PDFs (Gujarat HC, district courts), match entries to
cases by CNR / case number, and fill in item no., court room and date for tomorrow.

### Phase 5 — Bulk and background
- Bulk "sync all cases with a CNR" with a summary of what changed.
- Bulk onboarding: paste a list of CNRs to create cases.
- Conflict surfacing on the dashboard ("3 cases have updates from eCourts").

## NormalizedCase shape

```json
{
  "cnr": "GJAH010012342023",
  "caseNumber": "RCS/123/2023",
  "caseType": "Civil",
  "status": "Pending",
  "stage": "Evidence",
  "filingDate": "2023-03-14",
  "nextHearing": "2026-12-12",
  "courtNo": "5",
  "courtName": "Civil Court, Ahmedabad (Rural)",
  "judgeName": "…",
  "petitioners": ["…"],
  "respondents": ["…"],
  "hearings": [{ "date": "2026-11-04", "purpose": "Evidence", "judge": "…", "outcome": "Adjourned" }],
  "orders":   [{ "date": "2026-11-04", "title": "Interim order", "url": "https://…" }],
  "fetchedAt": "2026-11-21T10:00:00Z"
}
```
