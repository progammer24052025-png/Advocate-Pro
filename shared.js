// ================================================================
// ADVOCATE PRO — Shared Utilities (shared.js)
// Mic permission manager, voice input, Excel export helpers
// ================================================================

// ── Mic Permission Manager ──────────────────────────────────────
// Requests mic permission ONCE per session and caches result.
// All pages import this file and use MicManager.ensurePermission()
const MicManager = (() => {
  const STORAGE_KEY = 'advpro_mic_status';
  let _status  = localStorage.getItem(STORAGE_KEY) || 'unknown';
  let _stream  = null;

  async function requestOnce() {
    if (_status === 'granted') return true;
    if (_status === 'denied')  return false;

    try {
      _stream  = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      _status  = 'granted';
      localStorage.setItem(STORAGE_KEY, 'granted');
      return true;
    } catch (err) {
      _status = (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
                  ? 'denied' : 'error';
      localStorage.setItem(STORAGE_KEY, _status);
      return false;
    }
  }

  return {
    get status()  { return _status; },
    get stream()  { return _stream; },
    ensurePermission: requestOnce,
    reset() { _status = 'unknown'; localStorage.removeItem(STORAGE_KEY); },
  };
})();

// ── Voice Input Engine ──────────────────────────────────────────
// Single shared recognition instance. Prevents "already running" errors.
const VoiceEngine = (() => {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let _rec      = null;
  let _activeId = null;       // field ID currently recording
  let _langPref = 'gu-IN';   // default language

  function _clearActiveBtn() {
    document.querySelectorAll('.voice-btn.recording').forEach(b => b.classList.remove('recording'));
    _activeId = null;
  }

  async function startFor(fieldId, onResult, onStatusChange) {
    if (!SpeechRec) {
      if (onStatusChange) onStatusChange('❌ Voice recognition not supported. Please use Chrome.', 'error');
      return;
    }

    // Stop any in-progress recognition
    if (_rec) {
      _rec.onend = null;
      _rec.stop();
      _rec = null;
      _clearActiveBtn();
      if (_activeId === fieldId) return; // toggle off
    }

    // Ensure mic permission
    const granted = await MicManager.ensurePermission();
    if (!granted) {
      if (onStatusChange) onStatusChange('❌ Microphone permission denied. Please allow mic in browser settings.', 'error');
      showAdvToast('Microphone permission denied. Click the mic icon in your browser address bar to allow.', 'error');
      return;
    }

    _activeId = fieldId;
    const btn = document.querySelector(`[data-voice-for="${fieldId}"]`);
    if (btn) btn.classList.add('recording');
    if (onStatusChange) onStatusChange('🎤 Listening… speak in Gujarati or English', 'info');

    _rec = new SpeechRec();
    _rec.lang             = _langPref;
    _rec.interimResults   = false;
    _rec.maxAlternatives  = 1;
    _rec.continuous       = false;

    _rec.onresult = (e) => {
      const text = Array.from(e.results).map(r => r[0].transcript).join(' ').trim();
      if (text && onResult) onResult(fieldId, text);
      if (onStatusChange) onStatusChange(`✅ Got: "${text.substring(0,60)}${text.length>60?'…':''}"`, 'success');
      setTimeout(() => { if (onStatusChange) onStatusChange('', ''); }, 3000);
    };

    _rec.onerror = (e) => {
      const msgs = { 'no-speech':'No speech detected — try again.', 'audio-capture':'Microphone not found.', 'network':'Network error.' };
      if (onStatusChange) onStatusChange('⚠️ ' + (msgs[e.error] || e.error), 'warning');
      _clearActiveBtn(); _rec = null;
    };

    _rec.onend = () => { _clearActiveBtn(); _rec = null; };

    try { _rec.start(); }
    catch (err) {
      _clearActiveBtn(); _rec = null;
      if (onStatusChange) onStatusChange('⚠️ Could not start mic. Refresh and try again.', 'error');
    }
  }

  function setLanguage(lang) { _langPref = lang; }
  function isRecording()     { return _rec !== null; }

  return { startFor, setLanguage, isRecording };
})();

// ── Shared Toast ────────────────────────────────────────────────
function showAdvToast(msg, type = 'info', duration = 4000) {
  const icons  = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const cont   = document.getElementById('toastContainer');
  if (!cont) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span style="flex-shrink:0;">${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  cont.prepend(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, duration);
}

// ── Document Type Auto-Detector ─────────────────────────────────
const DocTypeDetector = (() => {
  const SIGNATURES = [
    {
      type: 'BHADA_KARAR',  label: 'ભ-ઇ-ઇ-ઇ (Rent / Lease Agreement)',
      keywords: ['ભ-ઇ-ઇ-ઇ', 'bhad', 'rent', 'tenant', 'landlord', 'licensee', 'licensor', 'tenancy', 'deposit', 'monthly'],
    },
    {
      type: 'VECHAN_KHAT',  label: 'ઇ-ઇ-ઇ-ઇ-ઇ (Sale Deed)',
      keywords: ['sale deed', 'vechan', 'seller', 'buyer', 'purchaser', 'vendor', 'stamp duty', 'possession'],
    },
    {
      type: 'MUKHTYARNAMU', label: 'ઇ-ઇ-ઇ-ઇ-ઇ-ઇ-ઇ (Power of Attorney)',
      keywords: ['power of attorney', 'mukhtyar', 'principal', 'attorney', 'agent', 'authorize', 'appoint'],
    },
    {
      type: 'BHAGIDARI',    label: 'ઇ-ઇ-ઇ-ઇ-ઇ-ઇ ઇ-ઇ-ઇ-ઇ-ઇ (Partnership Deed)',
      keywords: ['partnership', 'bhagidari', 'partners', 'firm', 'profit sharing', 'capital contribution'],
    },
    {
      type: 'HALFNAMU',     label: 'ઇ-ઇ-ઇ-ઇ-ઇ-ઇ (Affidavit)',
      keywords: ['affidavit', 'halfnam', 'solemnly', 'sworn', 'deponent', 'oath', 'notary'],
    },
    {
      type: 'LEGAL_NOTICE', label: 'ઇ-ઇ-ઇ-ઇ-ઇ-ઇ ઇ-ઇ-ઇ-ઇ-ઇ (Legal Notice)',
      keywords: ['legal notice', 'notice', 'advocate', 'client', 'demand', 'failing which', 'proceedings'],
    },
    {
      type: 'FARAGATI',     label: 'ઇ-ઇ-ઇ-ઇ-ઇ-ઇ (Release Deed)',
      keywords: ['release deed', 'faragati', 'releasor', 'releasee', 'no claim', 'relinquish'],
    },
  ];

  function detect(text) {
    const lower = (text || '').toLowerCase();
    let best = null; let bestScore = 0;
    for (const sig of SIGNATURES) {
      const score = sig.keywords.filter(k => lower.includes(k.toLowerCase())).length;
      if (score > bestScore) { bestScore = score; best = sig; }
    }
    return bestScore >= 1 ? best : { type: 'CUSTOM', label: 'Custom Legal Document' };
  }

  return { detect };
})();

// ── Smart Field Builder ─────────────────────────────────────────
// Converts raw placeholder IDs like "LANDLORD_NAME" into smart field defs
const SmartFields = (() => {
  const TYPE_RULES = [
    { pattern: /(DATE|DOB|DOD)$/,        type: 'date',     hint: 'Select date' },
    { pattern: /AMOUNT|FEES|SALARY|RENT|PRICE|VALUE|COST|DEPOSIT|CAPITAL/,
                                          type: 'number',   hint: 'Enter amount in ₹' },
    { pattern: /AGE|YEARS|YEAR$/,         type: 'number',   hint: 'Enter age' },
    { pattern: /PHONE|MOBILE|CONTACT|FAX/,type: 'tel',      hint: 'Enter phone number' },
    { pattern: /ADDRESS|ADDR|RESIDENCE|LOCATION|PLACE/,
                                          type: 'textarea', hint: 'Enter full address' },
    { pattern: /DESCRIPTION|DESC|FACTS|STATEMENT|DETAILS|CONTENT|POWERS|TERMS|NOTES|REASON|DEMAND/,
                                          type: 'textarea', hint: 'Enter details…' },
    { pattern: /WORDS$/,                  type: 'text',     hint: 'Amount in words' },
    { pattern: /SHARE|RATIO|PERCENT|PCT/, type: 'number',   hint: 'e.g. 50 (for 50%)' },
    { pattern: /CITY|VILLAGE|DISTRICT|STATE|COUNTRY|TALUKA/,
                                          type: 'text',     hint: 'Enter place name' },
  ];

  // Human-readable label from placeholder ID
  function toLabel(id) {
    return id.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  function build(placeholders) {
    return placeholders.map(id => {
      let type = 'text'; let hint = '';
      for (const r of TYPE_RULES) {
        if (r.pattern.test(id)) { type = r.type; hint = r.hint; break; }
      }
      const label   = toLabel(id);
      const required = !/(WITNESS|REMARK|NOTE|STAMP|FAX|PHONE2|MOBILE2|CONTACT2)$/.test(id);
      return { id, label, type, placeholder: hint, required };
    });
  }

  return { build, toLabel };
})();

// ── Excel Utilities (requires SheetJS / xlsx CDN on page) ───────
const ExcelUtils = {
  // Export an array of objects to .xlsx
  exportXLSX(rows, headers, sheetName, fileName) {
    if (typeof XLSX === 'undefined') {
      showAdvToast('Excel library not loaded. Check internet connection.', 'error'); return;
    }
    const data = [headers, ...rows.map(r => headers.map(h => r[h] ?? ''))];
    const ws   = XLSX.utils.aoa_to_sheet(data);
    // Column widths
    ws['!cols'] = headers.map(() => ({ wch: 22 }));
    // Bold header row
    headers.forEach((h, i) => {
      const cell = ws[XLSX.utils.encode_cell({ r:0, c:i })];
      if (cell) cell.s = { font: { bold: true } };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);
  },

  // Export multi-sheet workbook: [ { sheetName, headers, rows } ]
  exportMultiSheet(sheets, fileName) {
    if (typeof XLSX === 'undefined') {
      showAdvToast('Excel library not loaded.', 'error'); return;
    }
    const wb = XLSX.utils.book_new();
    for (const { sheetName, headers, rows } of sheets) {
      const data = [headers, ...rows.map(r => headers.map(h => r[h] ?? ''))];
      const ws   = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = headers.map(() => ({ wch: 22 }));
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
    XLSX.writeFile(wb, fileName);
  },

  // Parse first sheet of .xlsx/.xls file, returns array of row objects
  parseXLSX(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb   = XLSX.read(data, { type: 'array', cellDates: true });
          const ws   = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
          resolve(json);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  },
};

// ── Word / Print Export ─────────────────────────────────────────
const WordExporter = {
  generate(content, title, advocateName = '') {
    const lines  = (content || '').split('\n');
    const body   = lines
      .map(l => `<p style="margin:0 0 4pt 0;">${l.replace(/ /g,'&nbsp;').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') || '&nbsp;'}</p>`)
      .join('\n');

    return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <meta name="ProgId" content="Word.Document">
  <meta name="Generator" content="Advocate Pro">
  <title>${title}</title>
  <!--[if gte mso 9]>
  <xml><w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument></xml>
  <![endif]-->
  <style>
    @page {
      size: 8.5in 11in;
      margin: 1.2in 1.3in 1.0in 1.3in;
      mso-header-margin: 0.5in;
      mso-footer-margin: 0.5in;
    }
    body {
      font-family: "Noto Sans Gujarati", "Lohit Gujarati", "Arial Unicode MS", "Times New Roman", serif;
      font-size: 12pt;
      line-height: 1.85;
      color: #1a1a1a;
    }
    .doc-title {
      text-align: center;
      font-size: 15pt;
      font-weight: bold;
      margin-bottom: 20pt;
      text-decoration: underline;
      letter-spacing: 0.05em;
    }
    .doc-body { font-size: 12pt; white-space: pre-wrap; }
    .doc-footer {
      margin-top: 28pt;
      padding-top: 8pt;
      border-top: 1pt solid #888;
      font-size: 9pt;
      color: #555;
      text-align: center;
    }
    p { margin: 0 0 4pt 0; }
  </style>
</head>
<body>
  <div class="doc-body">${body}</div>
  <div class="doc-footer">
    Generated by Advocate Pro &nbsp;|&nbsp; ${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}
    ${advocateName ? ' &nbsp;|&nbsp; ' + advocateName : ''}
  </div>
</body>
</html>`;
  },

  download(content, title, advocateName = '') {
    const html  = this.generate(content, title, advocateName);
    const blob  = new Blob(['\uFEFF', html], { type: 'application/msword' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    const safe  = (title || 'Document').replace(/[^a-zA-Z0-9\u0A80-\u0AFF\s\-_]/g, '_').trim();
    a.href      = url;
    a.download  = `${safe}_${new Date().toISOString().slice(0,10)}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    showAdvToast('Word document downloaded!', 'success');
  },

  // Open browser print dialog with a clean printable view
  print(content, title) {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Gujarati:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body {
      font-family:'Noto Sans Gujarati','Times New Roman',serif;
      font-size:12pt; line-height:1.9; color:#111;
      padding:72pt 80pt;
    }
    .title { text-align:center; font-size:15pt; font-weight:bold; margin-bottom:24pt; text-decoration:underline; }
    pre { white-space:pre-wrap; font-family:inherit; font-size:12pt; }
    .footer { margin-top:28pt; padding-top:8pt; border-top:1pt solid #aaa; font-size:9pt; color:#666; text-align:center; }
    @page { size:A4; margin:2.5cm; }
    @media print { body { padding:0; } }
  </style>
</head>
<body>
  <pre>${(content||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>
  <div class="footer">Generated by Advocate Pro · ${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</div>
  <script>window.onload=()=>{ window.print(); window.onafterprint=()=>window.close(); }<\/script>
</body>
</html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
    else showAdvToast('Allow pop-ups in your browser to print.', 'warning');
  },
};

// ── .docx Text Extractor ────────────────────────────────────────
// Uses mammoth.js (must be loaded on page) or falls back to raw read
const DocxReader = {
  async extractText(file) {
    if (typeof mammoth === 'undefined') return null;
    try {
      const buffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      return result.value;
    } catch (e) {
      console.warn('mammoth failed:', e);
      return null;
    }
  },
};

// ── Init: request mic permission once on page load ──────────────
// Pages call this to warm up permissions without blocking UX.
function warmMicPermission() {
  // Do this silently; if browser hasn't stored it, we'll ask on first use
  if (MicManager.status === 'granted') return;
  // Don't auto-request — only request when user explicitly clicks mic
  // But show a helpful banner if status is 'denied'
  if (MicManager.status === 'denied') {
    console.warn('[MicManager] Mic access was previously denied. Voice features will not work.');
  }
}
warmMicPermission();

// ── Global Search (Ctrl+K) ──────────────────────────────────────
(function initGlobalSearch() {
  const modalHTML = `
    <div class="modal-overlay" id="globalSearchModal" style="z-index:10000;">
      <div class="modal" style="max-width:600px;">
        <div class="modal-header">
          <h2 class="modal-title">🔍 Global Search</h2>
          <button class="modal-close" onclick="closeGlobalSearch()">✕</button>
        </div>
        <div class="form-group" style="margin-bottom:16px;">
          <input type="text" class="form-control" id="globalSearchInput" placeholder="Search cases, documents, clients…" oninput="runGlobalSearch()" autofocus>
        </div>
        <div id="globalSearchResults" style="max-height:400px;overflow-y:auto;"></div>
        <div class="modal-footer">
          <span class="text-xs text-muted">Press <kbd style="background:var(--bg-secondary);padding:2px 6px;border-radius:4px;">Ctrl+K</kbd> to open</span>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openGlobalSearch();
    }
    if (e.key === 'Escape') closeGlobalSearch();
  });
})();

function openGlobalSearch() {
  const modal = document.getElementById('globalSearchModal');
  if (modal) {
    modal.classList.add('active');
    setTimeout(() => document.getElementById('globalSearchInput')?.focus(), 100);
  }
}

function closeGlobalSearch() {
  const modal = document.getElementById('globalSearchModal');
  if (modal) modal.classList.remove('active');
  const input = document.getElementById('globalSearchInput');
  if (input) input.value = '';
  const results = document.getElementById('globalSearchResults');
  if (results) results.innerHTML = '';
}

async function runGlobalSearch() {
  const q = (document.getElementById('globalSearchInput').value||'').toLowerCase().trim();
  const resultsEl = document.getElementById('globalSearchResults');
  if (!q) { resultsEl.innerHTML = '<div class="text-muted text-sm text-center" style="padding:20px;">Type to search…</div>'; return; }

  const results = [];
  try {
    const cases = await dbGetAll(STORES.CASES);
    for (const c of cases) {
      const s = [c.caseNumber,c.caseTitle,c.clientName,c.judgeName,c.courtNo,c.courtName,c.caseType,c.opposingAdvocate,c.notes].join(' ').toLowerCase();
      if (s.includes(q)) results.push({ type:'case', id:c.id, title:c.caseTitle||c.caseNumber, sub:`Case ${c.caseNumber} · ${c.clientName||''}`, status:c.status });
    }
  } catch(e) {}
  try {
    const docs = await dbGetAll(STORES.DOCUMENTS);
    for (const d of docs) {
      const s = [d.name,d.templateName,d.content].join(' ').toLowerCase();
      if (s.includes(q)) results.push({ type:'doc', id:d.id, title:d.name, sub:`${d.templateName||''} · ${new Date(d.createdAt).toLocaleDateString('en-IN')}` });
    }
  } catch(e) {}

  if (!results.length) { resultsEl.innerHTML = '<div class="text-muted text-sm text-center" style="padding:20px;">No results found.</div>'; return; }
  resultsEl.innerHTML = results.slice(0,20).map(r => `
    <div style="padding:12px;border-radius:8px;cursor:pointer;border:1px solid var(--border);margin-bottom:8px;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'" onclick="navigateToResult('${r.type}',${r.id})">
      <div class="font-bold text-sm">${r.type==='case'?'📁':'📄'} ${r.title}</div>
      <div class="text-xs text-muted mt-1">${r.sub}</div>
      ${r.status?`<span class="badge badge-${(r.status||'').toLowerCase()}" style="margin-top:6px;">${r.status}</span>`:''}
    </div>
  `).join('');
}

function navigateToResult(type, id) {
  closeGlobalSearch();
  if (type==='case') {
    if (window.location.pathname.includes('case-library')) { viewCase(id); }
    else { window.location.href = 'case-library.html'; }
  } else {
    if (window.location.pathname.includes('documents')) { viewSavedDoc(id); }
    else { window.location.href = 'documents.html'; }
  }
}
