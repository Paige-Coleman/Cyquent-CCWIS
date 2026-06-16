# CYQUENT CCWIS — Sandbox Demo Environment

GitHub Pages deployment for the CYQUENT CCWIS demo suite.  
**No backend. No database. No auth infrastructure.**  
State persists in the reviewer's browser via `localStorage`.

---

## Repo Structure

```
cyquent-demo/
├── index.html                        ← Landing page (session status + links)
├── CCWIS_Agent_Demo.html             ← CRM desktop demo (you add this)
├── CCWIS_Mobile_Investigation.html   ← Mobile field demo (you add this)
├── js/
│   └── cyquent-persist.js            ← Persistence module (drop-in)
└── README.md
```

---

## Deploy in ~15 Minutes

### Step 1 — Create the GitHub Repo

1. Go to [github.com/new](https://github.com/new)
2. Name: `cyquent-demo` (or `cyquent-sandbox`)
3. Set to **Private** (you control who gets the URL)
4. Initialize with README: ✓
5. Click **Create repository**

### Step 2 — Upload Files

Option A (GitHub web UI — no Git needed):
1. In your new repo, click **Add file → Upload files**
2. Drag in:
   - `index.html`
   - `CCWIS_Agent_Demo.html`
   - `CCWIS_Mobile_Investigation.html`
3. Create a `js/` folder: click **Add file → Create new file**, type `js/cyquent-persist.js`, paste the contents
4. Click **Commit changes**

Option B (Git CLI):
```bash
git clone https://github.com/YOUR-ORG/cyquent-demo.git
cd cyquent-demo
# Copy your HTML files here
cp /path/to/CCWIS_Agent_Demo.html .
cp /path/to/CCWIS_Mobile_Investigation.html .
mkdir js && cp /path/to/cyquent-persist.js js/
git add .
git commit -m "Initial sandbox deploy"
git push
```

### Step 3 — Enable GitHub Pages

1. In your repo: **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / `master` · Folder: `/ (root)`
4. Click **Save**
5. Wait ~60 seconds → GitHub shows your URL:
   `https://YOUR-ORG.github.io/cyquent-demo/`

### Step 4 — Add the Persistence Script to Your Demo HTMLs

Inside **each** HTML file (`CCWIS_Agent_Demo.html` and `CCWIS_Mobile_Investigation.html`), paste this line just before `</body>`:

```html
<script src="js/cyquent-persist.js"></script>
```

That's it. The toolbar appears automatically. Auto-save fires on every input.

---

## Wiring Dynamic App State (Optional but Recommended)

The persist module handles standard `<input>`, `<textarea>`, `<select>` automatically.  
For **dynamic lists** (task queue, drug test log, significant events), add two calls:

### Save dynamic data

```javascript
// Call this whenever your list changes
CyquentPersist.saveAppState('taskQueue', allTasks);
CyquentPersist.saveAppState('drugTestLog', drugTestEntries);
CyquentPersist.saveAppState('significantEvents', eventsArray);
CyquentPersist.saveAppState('collateralContacts', contactsList);
CyquentPersist.saveAppState('supervisorApprovals', approvalState);
```

### Restore dynamic data

```javascript
// Add this once, near your existing DOMContentLoaded logic
window.addEventListener('cyquent:restored', function(e) {
  const state = e.detail.appState;

  if (state.taskQueue)          renderTaskQueue(state.taskQueue);
  if (state.drugTestLog)        renderDrugTestLog(state.drugTestLog);
  if (state.significantEvents)  renderSignificantEvents(state.significantEvents);
  if (state.collateralContacts) renderCollateralContacts(state.collateralContacts);
  if (state.supervisorApprovals) restoreApprovalState(state.supervisorApprovals);
});
```

---

## What Gets Saved Automatically (No Code Changes)

| Data | Auto-saved? |
|---|---|
| All `<input>` values (text, date, number) | ✅ |
| All `<textarea>` values | ✅ |
| All `<select>` values | ✅ |
| Checkboxes and radio buttons | ✅ |
| Active tab / panel | ✅ |
| Selected case (by `data-case-id`) | ✅ |
| Mobile screen index | ✅ |
| Task queue (dynamic) | Via `saveAppState()` |
| Drug test log (dynamic) | Via `saveAppState()` |
| Significant events (dynamic) | Via `saveAppState()` |
| AI chat history | ❌ (excluded by design) |

---

## Sharing a Session with Another Reviewer

1. Reviewer A finishes demo work → clicks **⬇ Export** → downloads `cyquent-session-CYQ-ABC123-....json`
2. Emails the JSON to Reviewer B
3. Reviewer B opens the demo URL → clicks **⬆ Import** → selects the JSON
4. Exact state loads — same case selected, same forms filled

---

## Giving Reviewers the URL

For a **private repo**, GitHub Pages is only accessible to logged-in GitHub users with repo access.

Two options:
- **Keep private + add collaborators:** Settings → Collaborators → add reviewer GitHub accounts
- **Make repo public:** Anyone with the URL can access (no login). Safe for demo content with no real PHI.

Recommended: **Public repo** for RFP reviewers — they just get a URL, no GitHub account needed.

---

## Limitations (and When to Upgrade to Option 2)

| Limitation | Impact |
|---|---|
| Browser-only storage | Reviewer must use same browser/device to return |
| ~5 MB localStorage cap | ~500 pages of form data — not a real constraint for demos |
| No cross-device sync | If reviewer switches laptop, use Export/Import |
| No real auth | Anyone with the URL can load the page |

**Upgrade to Option 2 (mini-server on Railway)** when: a reviewer needs to start on one machine and continue on another without the Export/Import step.

---

## Updating the Demos

Just upload new HTML files to the repo. GitHub Pages auto-deploys in ~60 seconds.

```bash
# CLI update
cp /path/to/updated/CCWIS_Agent_Demo.html .
git add CCWIS_Agent_Demo.html
git commit -m "Update CRM demo v2"
git push
```

---

*CYQUENT CCWIS Sandbox — Internal Use Only — No PHI*
