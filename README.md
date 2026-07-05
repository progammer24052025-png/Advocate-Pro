# ⚖️ Advocate Pro — Legal Management Platform

A professional, offline-first legal management platform for Gujarati advocates. Manage cases, fees, hearings, and legal documents with voice support and PWA capabilities.

<<<<<<< HEAD
##  Quick Start
=======
## 🚀 Quick Start
>>>>>>> 774ce407dd557885f4b919de4c76c9fdcf235ccd

1. **Open** `index.html` in Chrome, Edge, or Safari
2. **Install as PWA** — Click "Install App" in browser menu for native-app experience
3. **Start managing cases** — No server or internet required after first load

## ✨ Features

### Core Case Management
- 📁 **Case Library** — Full CRUD for cases with 25+ fields
- 🔍 **Global Search** — Press `Ctrl+K` to search across cases & documents
- 👥 **Client Linking** — Click any client name to see all their cases
- 📊 **Dashboard** — Stats, activity feed, status breakdown widget
- 📅 **Hearing Calendar** — Monthly view with hearing tracking
- 💰 **Fees Tracker** — Agreed/received/pending with payment history
- 🧾 **Receipt Generator** — Print-ready A5 fee receipts
- 📌 **Tasks & Reminders** — Dated to-do items per case
- 📋 **Duplicate Case** — Quick clone for similar cases
- 🖨️ **Case Brief** — Formatted A4 printable case summary

### Documents
<<<<<<< HEAD
- 📜 **13 Legal Templates** — Official court formats from Gujarat High Court, CPC, BNSS 2023
  - Vakalatnama, Plaint, Written Statement, Bail Application
  - Criminal Complaint, Affidavit, Legal Notice, Power of Attorney
  - Rent Agreement, Sale Deed, Partnership Deed, Release Deed, Will
- 📝 **Wizard Builder** — Step-by-step document creation with live preview
- 👁️ **Preview Before Save** — Full document preview before saving
- 💾 **Auto-Save Drafts** — Never lose work, drafts persist in localStorage
- 📥 **Word Export** — Download any document as .doc (new or saved)
- 🖨️ **Print Ready** — Formatted for A4 printing

### Voice & Navigation
-  **Gujarati Voice Input** — Speak field values in Gujarati
- 🗣️ **Voice Navigation** — Floating mic button for voice commands
- ️ **Keyboard Shortcuts** — `Ctrl+K` search, `Escape` close modals
=======
- 📜 **Legal Templates** — 12 pre-built Gujarati legal document templates
- ️ **Wizard Builder** — Step-by-step document creation
- 💾 **Auto-Save Drafts** — Never lose work, drafts persist in localStorage
- 📄 **Save & Export** — Save to IndexedDB, export as .docx

### Voice & Navigation
- 🎤 **Gujarati Voice Input** — Speak field values in Gujarati
- 🗣️ **Voice Navigation** — Floating mic button for voice commands
- ⌨️ **Keyboard Shortcuts** — `Ctrl+K` search, `Escape` close modals
>>>>>>> 774ce407dd557885f4b919de4c76c9fdcf235ccd

### Data & Export
- 📊 **Excel Export/Import** — Full case data as .xlsx
-  **JSON Backup/Restore** — Complete data backup
- 🖨️ **Print Lists** — Case list, calendar, individual cases

### PWA & Offline
- 📱 **Installable** — Add to home screen on mobile/desktop
- 🔔 **Push Notifications** — Hearing reminders via browser notifications
- 🌐 **Offline Support** — Service worker caches all assets
<<<<<<< HEAD
-  **Dark/Light Theme** — Toggle with persistence
=======
- 🌓 **Dark/Light Theme** — Toggle with persistence
>>>>>>> 774ce407dd557885f4b919de4c76c9fdcf235ccd

## 🛠️ Tech Stack

- **Frontend**: Pure HTML/CSS/JavaScript (no frameworks)
- **Database**: IndexedDB (5 stores: cases, fees, payments, templates, documents)
- **PWA**: Service Worker + Web App Manifest
- **Fonts**: Noto Sans Gujarati, Inter, Playfair Display
- **Voice**: Web Speech API (gu-IN locale)
- **Export**: SheetJS (Excel), custom DOCX generator

## 📂 Project Structure

```
Advocate-Pro/
├── index.html          # Landing page
├── case-library.html   # Main case management
├── documents.html      # Legal document templates
├── shared.css          # Design system & themes
├── shared.js           # Voice engine, utilities, global search
├── db.js               # IndexedDB wrapper
├── sw.js               # Service worker (offline + notifications)
├── manifest.json       # PWA manifest
└── logo.png            # App icon & favicon
```

<<<<<<< HEAD
##  Usage Tips

### Voice Commands
Click the  button (bottom-right) and say:
=======
## 🎯 Usage Tips

### Voice Commands
Click the 🎤 button (bottom-right) and say:
>>>>>>> 774ce407dd557885f4b919de4c76c9fdcf235ccd
- "Open cases" / "Show fees" / "Calendar"
- "Add case" / "Search" / "Export"

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Open global search |
| `Escape` | Close any modal |
| `Ctrl+Enter` | Start/stop voice recording |

### Data Backup
1. Click "Full JSON Backup" in sidebar
2. Store the downloaded file safely
3. Use "Restore JSON Backup" to recover

## 🌐 Browser Support

- ✅ Chrome / Edge (Recommended)
- ✅ Safari (macOS/iOS)
- ️ Firefox (Limited voice support)

<<<<<<< HEAD
## 🔒 Privacy
=======
##  Privacy
>>>>>>> 774ce407dd557885f4b919de4c76c9fdcf235ccd

- **100% local** — All data stored in browser IndexedDB
- **No server** — Nothing sent to external services
- **No tracking** — No analytics or cookies
- **Offline-first** — Works without internet after first load

## 📝 License

Free to use and modify for personal practice.
