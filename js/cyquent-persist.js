/**
 * CYQUENT Sandbox Persistence Layer
 * Option 1: GitHub Pages + localStorage
 *
 * Drop this script into CCWIS_Agent_Demo.html and CCWIS_Mobile_Investigation.html
 * before the closing </body> tag:
 *   <script src="js/cyquent-persist.js"></script>
 *
 * Or inline the entire block inside <script> tags.
 *
 * What it does:
 *   - Auto-saves all form inputs, textareas, selects every 30 seconds
 *   - Auto-saves on every meaningful user input (debounced 2s)
 *   - Restores state on page load
 *   - Tracks active tab/screen/panel
 *   - Stores custom app state objects (task queue, logs, approvals)
 *   - Renders a persistent Save/Restore/Reset toolbar in the corner
 *   - Generates a shareable "session code" for support/handoff
 *   - Exports session state as downloadable JSON
 */

(function () {
  'use strict';

  // ─── CONFIG ────────────────────────────────────────────────────────────────
  const CONFIG = {
    storageKey:    'cyquent_demo_state',
    autoSaveMs:    30000,   // 30-second auto-save interval
    debounceMs:    2000,    // debounce on input events
    appId:         detectApp(),  // 'crm' or 'mobile'
    version:       '1.0.0',
  };

  // Fields to SKIP (sensitive or ephemeral)
  const SKIP_SELECTORS = [
    '[type="password"]',
    '[data-no-persist]',
    '.ai-panel-input',       // live AI chat inputs — don't restore mid-conversation
  ];

  // ─── APP DETECTION ─────────────────────────────────────────────────────────
  function detectApp() {
    const title = document.title || '';
    const path  = window.location.pathname || '';
    if (path.includes('Mobile') || title.includes('Mobile') || title.includes('Investigation')) {
      return 'mobile';
    }
    return 'crm';
  }

  // ─── SESSION ID ────────────────────────────────────────────────────────────
  function getSessionId() {
    let sid = localStorage.getItem('cyquent_session_id');
    if (!sid) {
      // 6-char alphanumeric — easy to read aloud / share in email
      sid = 'CYQ-' + Math.random().toString(36).substr(2, 6).toUpperCase();
      localStorage.setItem('cyquent_session_id', sid);
    }
    return sid;
  }

  // ─── STATE SCHEMA ──────────────────────────────────────────────────────────
  function blankState() {
    return {
      version:    CONFIG.version,
      appId:      CONFIG.appId,
      sessionId:  getSessionId(),
      savedAt:    null,
      fields:     {},   // input/textarea/select values keyed by element id or name
      activeTab:  null, // last visible tab/panel
      activeCase: null, // selected case id
      mobileScreen: 0,  // mobile: current screen index
      appState:   {},   // arbitrary objects pushed by the host page via CyquentPersist.save()
    };
  }

  // ─── STORAGE HELPERS ───────────────────────────────────────────────────────
  function loadState() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      if (!raw) return blankState();
      const parsed = JSON.parse(raw);
      // Version guard — wipe if schema changed
      if (parsed.version !== CONFIG.version || parsed.appId !== CONFIG.appId) {
        return blankState();
      }
      return parsed;
    } catch (e) {
      console.warn('[CyquentPersist] Could not load state:', e);
      return blankState();
    }
  }

  function saveState(state) {
    try {
      state.savedAt = new Date().toISOString();
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('[CyquentPersist] Could not save state:', e);
      return false;
    }
  }

  // ─── FIELD SERIALIZATION ───────────────────────────────────────────────────
  function collectFields() {
    const fields = {};
    const skipSet = new Set(
      SKIP_SELECTORS.flatMap(sel => Array.from(document.querySelectorAll(sel)))
    );

    document.querySelectorAll('input, textarea, select').forEach(el => {
      if (skipSet.has(el)) return;
      const key = el.id || el.name || el.getAttribute('data-field');
      if (!key) return;

      if (el.type === 'checkbox' || el.type === 'radio') {
        fields[key] = el.checked;
      } else {
        fields[key] = el.value;
      }
    });
    return fields;
  }

  function restoreFields(fields) {
    if (!fields || typeof fields !== 'object') return;
    Object.entries(fields).forEach(([key, value]) => {
      // Try id first, then name, then data-field
      let el = document.getElementById(key)
            || document.querySelector(`[name="${key}"]`)
            || document.querySelector(`[data-field="${key}"]`);
      if (!el) return;

      if (el.type === 'checkbox' || el.type === 'radio') {
        el.checked = !!value;
      } else {
        el.value = value ?? '';
      }
      // Fire a change event so any listeners update UI
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  // ─── ACTIVE TAB DETECTION ──────────────────────────────────────────────────
  function detectActiveTab() {
    // Guardian/D365-style: data-tab-id, data-panel, or aria-selected
    const active = document.querySelector(
      '[data-tab-id].active, [data-panel].active, [aria-selected="true"], .nav-tab.active, .tab-btn.active'
    );
    return active ? (active.dataset.tabId || active.dataset.panel || active.getAttribute('data-target') || active.id) : null;
  }

  function restoreActiveTab(tabId) {
    if (!tabId) return;
    const tab = document.getElementById(tabId)
              || document.querySelector(`[data-tab-id="${tabId}"]`)
              || document.querySelector(`[data-panel="${tabId}"]`)
              || document.querySelector(`[data-target="${tabId}"]`);
    if (tab) {
      tab.click();
    }
  }

  // ─── ACTIVE CASE DETECTION ─────────────────────────────────────────────────
  function detectActiveCase() {
    // Look for data-case-id on the main case header or sidebar item
    const caseEl = document.querySelector('[data-case-id].active, .case-row.selected, #case-header[data-case-id]');
    return caseEl ? caseEl.dataset.caseId : null;
  }

  function restoreActiveCase(caseId) {
    if (!caseId) return;
    const caseEl = document.querySelector(`[data-case-id="${caseId}"]`);
    if (caseEl) caseEl.click();
  }

  // ─── MOBILE SCREEN DETECTION ───────────────────────────────────────────────
  function detectMobileScreen() {
    // CCWIS_Mobile_Investigation.html uses currentScreen variable or data-screen
    if (typeof window.currentScreen === 'number') return window.currentScreen;
    const screenEl = document.querySelector('.screen.active[data-screen]');
    return screenEl ? parseInt(screenEl.dataset.screen, 10) : 0;
  }

  function restoreMobileScreen(screenIndex) {
    if (typeof screenIndex !== 'number') return;
    // If the host page exposes showScreen(), call it
    if (typeof window.showScreen === 'function') {
      window.showScreen(screenIndex);
    } else {
      // Fallback: click the nth screen nav button
      const btns = document.querySelectorAll('.screen-nav-btn, [data-screen-target]');
      if (btns[screenIndex]) btns[screenIndex].click();
    }
  }

  // ─── CORE SAVE ─────────────────────────────────────────────────────────────
  function performSave(label) {
    const state = loadState();
    state.fields       = collectFields();
    state.activeTab    = detectActiveTab();
    state.activeCase   = detectActiveCase();
    if (CONFIG.appId === 'mobile') {
      state.mobileScreen = detectMobileScreen();
    }
    // Merge any app state pushed via CyquentPersist.saveAppState()
    // (already in state.appState from loadState)
    const ok = saveState(state);
    updateToolbarStatus(ok ? `Saved ${label ? '(' + label + ')' : ''}` : 'Save failed', ok ? 'success' : 'error');
    return ok;
  }

  // ─── CORE RESTORE ──────────────────────────────────────────────────────────
  function performRestore() {
    const state = loadState();
    if (!state.savedAt) {
      updateToolbarStatus('Nothing saved yet', 'warn');
      return;
    }
    restoreFields(state.fields);
    // Small delay so DOM is ready after any tab switch
    setTimeout(() => {
      restoreActiveCase(state.activeCase);
      restoreActiveTab(state.activeTab);
      if (CONFIG.appId === 'mobile') {
        restoreMobileScreen(state.mobileScreen);
      }
    }, 150);

    const when = new Date(state.savedAt).toLocaleTimeString();
    updateToolbarStatus(`Restored (saved ${when})`, 'success');

    // Dispatch restore event so host page can re-render dynamic content
    window.dispatchEvent(new CustomEvent('cyquent:restored', { detail: state }));
  }

  // ─── RESET ─────────────────────────────────────────────────────────────────
  function performReset() {
    if (!confirm('Clear all saved demo data for this session? This cannot be undone.')) return;
    localStorage.removeItem(CONFIG.storageKey);
    updateToolbarStatus('Session cleared — refresh to start fresh', 'warn');
    setTimeout(() => window.location.reload(), 1200);
  }

  // ─── EXPORT ────────────────────────────────────────────────────────────────
  function performExport() {
    const state = loadState();
    const blob  = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = `cyquent-session-${state.sessionId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    updateToolbarStatus('Session exported', 'success');
  }

  // ─── IMPORT ────────────────────────────────────────────────────────────────
  function performImport() {
    const input = document.createElement('input');
    input.type  = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file   = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target.result);
          // Stamp with current session id but load the fields
          imported.sessionId = getSessionId();
          saveState(imported);
          performRestore();
          updateToolbarStatus('Session imported', 'success');
        } catch (err) {
          updateToolbarStatus('Import failed — invalid file', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // ─── TOOLBAR UI ────────────────────────────────────────────────────────────
  function buildToolbar() {
    const sid = getSessionId();
    const bar = document.createElement('div');
    bar.id    = 'cyquent-persist-bar';
    bar.innerHTML = `
      <style>
        #cyquent-persist-bar {
          position: fixed;
          bottom: 18px;
          right: 18px;
          z-index: 99999;
          display: flex;
          align-items: center;
          gap: 6px;
          background: #1a1f2e;
          border: 1px solid #2e3a52;
          border-radius: 10px;
          padding: 8px 12px;
          font-family: 'Segoe UI', system-ui, sans-serif;
          font-size: 11px;
          color: #c8d3e8;
          box-shadow: 0 4px 20px rgba(0,0,0,0.45);
          user-select: none;
          transition: opacity 0.2s;
        }
        #cyquent-persist-bar:hover { opacity: 1 !important; }
        #cyquent-persist-bar .cp-logo {
          font-weight: 700;
          color: #4f8ef7;
          letter-spacing: 0.04em;
          margin-right: 4px;
        }
        #cyquent-persist-bar .cp-sid {
          background: #2a3550;
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 10px;
          color: #7a9fd4;
          cursor: pointer;
          title: "Click to copy session ID";
        }
        #cyquent-persist-bar button {
          background: #2e3d5e;
          border: 1px solid #3d5282;
          border-radius: 5px;
          color: #c8d3e8;
          font-size: 11px;
          padding: 3px 9px;
          cursor: pointer;
          transition: background 0.15s;
        }
        #cyquent-persist-bar button:hover { background: #3a4f7a; }
        #cyquent-persist-bar button.primary {
          background: #1a4fa8;
          border-color: #2a63cc;
          color: #fff;
          font-weight: 600;
        }
        #cyquent-persist-bar button.primary:hover { background: #2255bc; }
        #cyquent-persist-bar .cp-status {
          font-size: 10px;
          padding: 2px 7px;
          border-radius: 4px;
          display: none;
          font-weight: 500;
        }
        #cyquent-persist-bar .cp-status.success { background:#1a3d28; color:#4caf78; display:inline-block; }
        #cyquent-persist-bar .cp-status.error   { background:#3d1a1a; color:#e05757; display:inline-block; }
        #cyquent-persist-bar .cp-status.warn    { background:#3d2e10; color:#e0a040; display:inline-block; }
        #cyquent-persist-bar .cp-divider { width:1px; height:16px; background:#2e3a52; margin:0 2px; }
        #cyquent-persist-bar .cp-collapse { cursor:pointer; color:#5a7ab0; font-size:13px; padding: 0 4px; }
      </style>
      <span class="cp-logo">⬡ CYQUENT</span>
      <span class="cp-divider"></span>
      <span class="cp-sid" id="cp-sid" title="Click to copy Session ID">${sid}</span>
      <span class="cp-divider"></span>
      <button class="primary" id="cp-save">💾 Save</button>
      <button id="cp-restore">↩ Restore</button>
      <button id="cp-export">⬇ Export</button>
      <button id="cp-import">⬆ Import</button>
      <button id="cp-reset" style="color:#e05757">✕ Clear</button>
      <span class="cp-status" id="cp-status"></span>
      <span class="cp-collapse" id="cp-collapse" title="Minimize">_</span>
    `;
    document.body.appendChild(bar);

    // Wire buttons
    document.getElementById('cp-save').onclick    = () => performSave('manual');
    document.getElementById('cp-restore').onclick = () => performRestore();
    document.getElementById('cp-export').onclick  = () => performExport();
    document.getElementById('cp-import').onclick  = () => performImport();
    document.getElementById('cp-reset').onclick   = () => performReset();

    // Copy session ID
    document.getElementById('cp-sid').onclick = () => {
      navigator.clipboard.writeText(sid).then(() => {
        updateToolbarStatus('Session ID copied!', 'success');
      });
    };

    // Collapse/expand
    let collapsed = false;
    document.getElementById('cp-collapse').onclick = () => {
      collapsed = !collapsed;
      const inner = bar.querySelectorAll('button, .cp-divider, .cp-sid, .cp-status, .cp-logo');
      inner.forEach(el => { if (el.id !== 'cp-collapse') el.style.display = collapsed ? 'none' : ''; });
      document.getElementById('cp-collapse').textContent = collapsed ? '+' : '_';
    };

    // Fade slightly when idle
    setTimeout(() => { bar.style.opacity = '0.75'; }, 3000);
    bar.onmouseenter = () => { bar.style.opacity = '1'; };
  }

  let statusTimer = null;
  function updateToolbarStatus(msg, type) {
    const el = document.getElementById('cp-status');
    if (!el) return;
    el.textContent  = msg;
    el.className    = `cp-status ${type}`;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { el.className = 'cp-status'; }, 3500);
  }

  // ─── AUTO-SAVE ─────────────────────────────────────────────────────────────
  let debounceTimer = null;

  function setupAutoSave() {
    // Interval save
    setInterval(() => performSave('auto'), CONFIG.autoSaveMs);

    // Debounced save on any input
    document.addEventListener('input',  onUserInput, { passive: true });
    document.addEventListener('change', onUserInput, { passive: true });

    // Save on tab switch clicks (common in CRM shell)
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (t.matches('.nav-tab, .tab-btn, [data-tab-id], [data-panel], [data-case-id], [data-screen-target]')) {
        setTimeout(() => performSave('tab-switch'), 400);
      }
    }, { passive: true });

    // Save before page unload
    window.addEventListener('beforeunload', () => performSave('unload'));
  }

  function onUserInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => performSave('input'), CONFIG.debounceMs);
  }

  // ─── PUBLIC API ────────────────────────────────────────────────────────────
  /**
   * Host page can push arbitrary app state:
   *   CyquentPersist.saveAppState('taskQueue', [...tasks]);
   *   CyquentPersist.saveAppState('drugTestLog', [...entries]);
   *
   * And restore it on the cyquent:restored event:
   *   window.addEventListener('cyquent:restored', (e) => {
   *     const tasks = e.detail.appState.taskQueue || [];
   *     renderTaskQueue(tasks);
   *   });
   */
  window.CyquentPersist = {
    save: performSave,
    restore: performRestore,
    reset: performReset,
    export: performExport,
    import: performImport,
    getSessionId,

    saveAppState(key, value) {
      const state = loadState();
      state.appState[key] = value;
      saveState(state);
    },

    loadAppState(key) {
      const state = loadState();
      return state.appState[key] ?? null;
    },

    // Convenience: get everything
    getState: loadState,
  };

  // ─── INIT ──────────────────────────────────────────────────────────────────
  function init() {
    buildToolbar();
    setupAutoSave();

    // Auto-restore on load if prior session exists
    const state = loadState();
    if (state.savedAt) {
      // Short delay to let the host page finish rendering
      setTimeout(() => {
        performRestore();
        const when = new Date(state.savedAt).toLocaleTimeString();
        updateToolbarStatus(`Auto-restored (${when})`, 'success');
      }, 600);
    }

    console.info(`[CyquentPersist] Ready | App: ${CONFIG.appId} | Session: ${getSessionId()}`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
