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
      type: 'FARAGATI',     label: 'ફરગતી (Release Deed)',
      keywords: ['release deed', 'faragati', 'releasor', 'releasee', 'no claim', 'relinquish'],
    },
    {
      type: 'VAKALATNAMA',  label: 'વકાલતનામું (Vakalatnama)',
      keywords: ['vakalatnama', 'vakalat', 'appoint advocate', 'enrollment', 'client hereby appoints'],
    },
    {
      type: 'PLAINT',       label: 'પ્લેઇન્ટ (Plaint / Civil Suit)',
      keywords: ['plaint', 'civil suit', 'plaintiff', 'defendant', 'cause of action', 'relief claimed', 'jurisdiction'],
    },
    {
      type: 'WRITTEN_STATEMENT', label: 'લિખિત જવાબ (Written Statement)',
      keywords: ['written statement', 'paragraphs denied', 'paragraphs admitted', 'preliminary objection', 'defence'],
    },
    {
      type: 'BAIL_APPLICATION', label: 'જામીન અરજી (Bail Application)',
      keywords: ['bail application', 'anticipatory bail', 'regular bail', 'sec 483', 'bnss', 'applicant seeks bail'],
    },
    {
      type: 'CRIMINAL_COMPLAINT', label: 'ફોજદારી ફરિયાદ (Criminal Complaint)',
      keywords: ['criminal complaint', 'complainant', 'accused', 'offence', 'sec 200', 'private complaint'],
    },
    {
      type: 'WILL',         label: 'વસિયતનામું (Will / Testament)',
      keywords: ['last will', 'testament', 'testator', 'executor', 'bequeath', 'codicil', 'succession act'],
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
      const s = [c.caseNumber,c.caseTitle,c.clientName,c.judgeName,c.courtNo,c.courtName,c.caseType,c.opposingAdvocate,c.notes,(c.tags||[]).join(' ')].join(' ').toLowerCase();
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
  if (type === 'case') {
    if (window.location.pathname.includes('case-library') && typeof viewCase === 'function') {
      viewCase(id);
    } else {
      window.location.href = `case-library.html#case-${id}`;
    }
  } else {
    if (window.location.pathname.includes('documents') && typeof viewSavedDoc === 'function') {
      viewSavedDoc(id);
    } else {
      window.location.href = `documents.html#view-${id}`;
    }
  }
}

// ── Keyboard Shortcuts Panel (?) ─────────────────────────────────
(function initShortcutsPanel() {
  const shortcutsHTML = `
    <div class="modal-overlay" id="shortcutsModal" style="z-index:10001;">
      <div class="modal" style="max-width:500px;">
        <div class="modal-header">
          <h2 class="modal-title">⌨️ Keyboard Shortcuts</h2>
          <button class="modal-close" onclick="closeShortcutsModal()">✕</button>
        </div>
        <div style="max-height:60vh;overflow-y:auto;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:2px solid var(--border);">
                <th style="text-align:left;padding:10px 12px;font-size:.85rem;color:var(--text-muted);">Shortcut</th>
                <th style="text-align:left;padding:10px 12px;font-size:.85rem;color:var(--text-muted);">Action</th>
              </tr>
            </thead>
            <tbody id="shortcutsTableBody"></tbody>
          </table>
        </div>
        <div class="modal-footer">
          <span class="text-xs text-muted">Press <kbd style="background:var(--bg-secondary);padding:2px 6px;border-radius:4px;">?</kbd> anytime to see this</span>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', shortcutsHTML);

  // Define shortcuts
  const shortcuts = [
    { key: 'Ctrl + K', action: 'Open global search' },
    { key: 'Escape', action: 'Close any modal / panel' },
    { key: 'Ctrl + Enter', action: 'Start / stop voice recording' },
    { key: '?', action: 'Show this shortcuts help' },
  ];

  // Add page-specific shortcuts
  if (window.location.pathname.includes('case-library')) {
    shortcuts.push(
      { key: 'N', action: 'Add new case' },
      { key: 'E', action: 'Export to Excel' },
      { key: 'B', action: 'Full JSON backup' }
    );
  }
  if (window.location.pathname.includes('documents')) {
    shortcuts.push(
      { key: 'N', action: 'New document from template' },
      { key: 'S', action: 'Save current document' }
    );
  }

  // Populate table
  const tbody = document.getElementById('shortcutsTableBody');
  if (tbody) {
    tbody.innerHTML = shortcuts.map(s => `
      <tr style="border-bottom:1px solid var(--border);">
        <td style="padding:12px;"><kbd style="background:var(--bg-secondary);padding:4px 10px;border-radius:6px;font-family:monospace;font-size:.85rem;border:1px solid var(--border);">${s.key}</kbd></td>
        <td style="padding:12px;font-size:.9rem;">${s.action}</td>
      </tr>
    `).join('');
  }

  // Listen for ? key (only when not in input/textarea)
  document.addEventListener('keydown', (e) => {
    // Don't trigger if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      openShortcutsModal();
    }
  });
})();

function openShortcutsModal() {
  const modal = document.getElementById('shortcutsModal');
  if (modal) modal.classList.add('active');
}

function closeShortcutsModal() {
  const modal = document.getElementById('shortcutsModal');
  if (modal) modal.classList.remove('active');
}

// Add Escape handler for shortcuts modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeShortcutsModal();
});

// ── Keyboard shortcut actions ────────────────────────────────────
function _isTypingTarget(el) {
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

function _toggleVoiceForFocusedField() {
  const active = document.activeElement;
  if (active && active.id) {
    const btn = document.querySelector(`[data-voice-for="${active.id}"]`);
    if (btn) { btn.click(); return; }
    if (typeof fieldVoice === 'function') { fieldVoice(active.id); return; }
  }
  const recording = document.querySelector('.voice-btn.recording');
  if (recording) { recording.click(); return; }
  const first = document.querySelector('.voice-btn');
  if (first) first.click();
}

function _runPageShortcut(key) {
  const onCaseLib = window.location.pathname.includes('case-library');
  const onDocs    = window.location.pathname.includes('documents');

  if (key === 'n') {
    if (onCaseLib && typeof openAddCaseModal === 'function') { openAddCaseModal(); return true; }
    if (onDocs && typeof showTab === 'function') { showTab('templates'); return true; }
  }
  if (key === 'e' && onCaseLib && typeof exportCasesExcel === 'function') {
    exportCasesExcel(); return true;
  }
  if (key === 'b' && onCaseLib && typeof exportBackup === 'function') {
    exportBackup(); return true;
  }
  if (key === 's' && onDocs && typeof saveCurrentDoc === 'function') {
    const wiz = document.getElementById('tab-wizard');
    if (wiz && wiz.classList.contains('active')) { saveCurrentDoc(); return true; }
  }
  return false;
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    _toggleVoiceForFocusedField();
    return;
  }
  if (_isTypingTarget(e.target)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const k = e.key.toLowerCase();
  if (k === 'n' || k === 'e' || k === 'b' || k === 's') {
    if (_runPageShortcut(k)) e.preventDefault();
  }
});

// ── Voice Navigation (all pages) ────────────────────────────────
const VoiceNav = (() => {
  let active = false;
  let rec    = null;

  function injectUI() {
    if (document.getElementById('voiceNavBtn')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <button id="voiceNavBtn" onclick="VoiceNav.toggle()" title="Voice Navigation"
        style="position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:var(--gold);color:#000;border:none;cursor:pointer;box-shadow:0 4px 16px rgba(201,162,39,.4);z-index:999;display:flex;align-items:center;justify-content:center;font-size:1.5rem;transition:var(--transition);">🎤</button>
      <div id="voiceNavStatus" style="position:fixed;bottom:90px;right:24px;background:var(--bg-card);color:var(--text-primary);padding:8px 16px;border-radius:8px;box-shadow:var(--shadow);font-size:.875rem;z-index:998;display:none;max-width:250px;text-align:center;"></div>`);
  }

  function setStatus(msg, recording) {
    const btn = document.getElementById('voiceNavBtn');
    const status = document.getElementById('voiceNavStatus');
    if (status) { status.textContent = msg; status.style.display = msg ? 'block' : 'none'; }
    if (btn) {
      btn.style.background = recording ? 'var(--danger)' : 'var(--gold)';
      btn.style.animation  = recording ? 'pulse 1s infinite' : '';
    }
  }

  function stop() {
    active = false;
    if (rec) { try { rec.stop(); } catch (_) {} rec = null; }
    setStatus('', false);
    setTimeout(() => { const s = document.getElementById('voiceNavStatus'); if (s) s.style.display = 'none'; }, 1500);
  }

  function processCommand(text) {
    const t = text.toLowerCase();
    let action = '';

    if (window.location.pathname.includes('documents')) {
      if (t.includes('template') || t.includes('library')) { action = 'Templates'; showTab('templates'); }
      else if (t.includes('document') || t.includes('saved') || t.includes('my doc')) { action = 'My Documents'; showTab('mydocs'); }
      else if (t.includes('upload')) { action = 'Upload'; showTab('upload'); }
      else if (t.includes('save')) { action = 'Save'; if (typeof saveCurrentDoc === 'function') saveCurrentDoc(); }
      else if (t.includes('case')) { action = 'Cases'; window.location.href = 'case-library.html'; }
      else if (t.includes('home')) { action = 'Home'; window.location.href = 'index.html'; }
      else if (t.includes('search')) { action = 'Search'; openGlobalSearch(); }
      else { setStatus('Try: "Templates", "Save", "Open cases"', false); return; }
    } else if (!window.location.pathname.includes('case-library')) {
      if (t.includes('case')) { action = 'Cases'; window.location.href = 'case-library.html'; }
      else if (t.includes('document')) { action = 'Documents'; window.location.href = 'documents.html'; }
      else if (t.includes('search')) { action = 'Search'; openGlobalSearch(); }
      else if (t.includes('home')) { action = 'Home'; window.location.href = 'index.html'; }
      else { setStatus('Try: "Open cases", "Documents", "Search"', false); return; }
    } else {
      if (t.includes('dashboard') || t.includes('home')) { action = 'Dashboard'; showTab('dashboard'); }
      else if (t.includes('case') && (t.includes('open') || t.includes('show') || t.includes('go') || t.includes('all'))) { action = 'Cases'; showTab('cases'); }
      else if (t.includes('fee') || t.includes('payment')) { action = 'Fees'; showTab('fees'); }
      else if (t.includes('calendar') || t.includes('hearing')) { action = 'Calendar'; showTab('calendar'); }
      else if (t.includes('document')) { action = 'Documents'; window.location.href = 'documents.html'; }
      else if (t.includes('add') || t.includes('new case') || t.includes('create')) { action = 'Add Case'; openAddCaseModal(); }
      else if (t.includes('search') || t.includes('find')) { action = 'Search'; openGlobalSearch(); }
      else if (t.includes('export') || t.includes('excel')) { action = 'Export'; exportCasesExcel(); }
      else if (t.includes('print')) { action = 'Print'; printCaseList(); }
      else if (t.includes('backup')) { action = 'Backup'; exportBackup(); }
      else { setStatus('Try: "Open cases", "Add case", "Show fees"', false); return; }
    }

    showAdvToast(`Voice command: ${action}`, 'success');
    stop();
  }

  function start() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showAdvToast('Voice navigation not supported in this browser.', 'error');
      return;
    }
    rec = new SpeechRecognition();
    rec.lang = 'gu-IN';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onstart = () => { active = true; setStatus('🎤 Listening… Say a command', true); };
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript.toLowerCase().trim();
      setStatus(`Heard: "${transcript}"`, true);
      processCommand(transcript);
    };
    rec.onerror = () => { setStatus('Could not hear command.', false); stop(); };
    rec.onend = () => { if (active) setTimeout(stop, 1500); };
    rec.start();
  }

  function toggle() {
    if (active) stop();
    else start();
  }

  injectUI();
  return { toggle, start, stop };
})();

// ── PWA / Service Worker registration (all pages) ───────────────
const AdvProPWA = {
  register() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }
        const ping = () => reg.active && reg.active.postMessage('check-reminders');
        if ('Notification' in window && Notification.permission === 'granted') ping();
        if ('periodicSync' in reg) {
          reg.periodicSync.register('hearing-check', { minInterval: 30 * 60 * 1000 }).catch(() => {});
        }
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && Notification.permission === 'granted') ping();
        });
        // Periodic check while app is open
        setInterval(() => {
          if (Notification.permission === 'granted') ping();
        }, 30 * 60 * 1000);
      })
      .catch(err => console.warn('[SW] Registration failed:', err));
  },
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AdvProPWA.register());
} else {
  AdvProPWA.register();
}
