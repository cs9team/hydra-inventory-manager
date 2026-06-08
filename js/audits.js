// ── AUDITS ──
// Full audit lifecycle: create, scan, close, view history, delete, export.

// ── CREATE ──
function startNewAudit() {
  const defaultName = 'Audit ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  document.getElementById('modal-title').textContent = 'Create New Audit';
  document.getElementById('modal-body').innerHTML = `
    <div class="field"><label>Audit Name</label><input id="f-audit-name" type="text" value="${defaultName}" autofocus></div>
    <div class="field"><label>Notes (optional)</label><textarea id="f-audit-notes" style="min-height:60px"></textarea></div>`;
  document.getElementById('modal-save-btn').textContent = 'Start Audit';
  modalSaveFn = confirmCreateAudit;
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => { const i = document.getElementById('f-audit-name'); if (i) { i.focus(); i.select(); } }, 80);
}

async function confirmCreateAudit() {
  const name = (document.getElementById('f-audit-name')?.value || '').trim();
  if (!name) { alert('Please enter an audit name.'); return; }
  closeModal();
  const id = 'AUD-' + Date.now();
  toast('Creating audit…', 'syncing', 10000);
  const { error } = await sb.from('audits').insert({ id, name, is_active: true }); // [DATA LAYER]
  if (error) { toast('Failed: ' + error.message, 'err'); return; }
  activeAudit = { id, name, startedAt: new Date().toISOString(), closedAt: null, items: [] };
  addLog('audit', `Audit started: <strong>${name}</strong>`);
  toast('✓ Audit created', 'ok');
  openAuditSession();
}

// ── SESSION ──
function openAuditSession() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-audit-session').classList.add('active');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.nav-item')[2]?.classList.add('active');
  document.getElementById('session-title').textContent = activeAudit.name;
  document.getElementById('session-subtitle').textContent = 'Started ' + fmtTime(activeAudit.startedAt);
  const msg = document.getElementById('scan-msg');
  if (msg) { msg.textContent = 'Ready — scan or type a serial number and press Enter'; msg.style.color = 'var(--text3)'; }
  buildAuditTableHeaders();
  renderAuditTable();
  setTimeout(() => document.getElementById('scan-input')?.focus(), 150);
}

function buildAuditTableHeaders() {
  const fields = visibleFields();
  let html = '<th>ID</th>';
  fields.forEach(f => html += `<th>${f.label}</th>`);
  html += '<th>Verified At</th>';
  ['av-thead', 'dv-thead'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = html;
  });
}

function backToAudits() {
  if (activeAudit && !activeAudit.closedAt) {
    if (!confirm('Leave active audit? It will remain open.')) return;
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-audits').classList.add('active');
  renderAuditCards();
}

async function closeAudit() {
  if (!activeAudit) return;
  if (!activeAudit.items.length && !confirm('No verified radios. Close anyway?')) return;
  const closedAt = new Date().toISOString();
  toast('Closing audit…', 'syncing', 10000);
  const { error } = await sb.from('audits').update({ closed_at: closedAt, is_active: false }).eq('id', activeAudit.id); // [DATA LAYER]
  if (error) { toast('Failed: ' + error.message, 'err'); return; }
  activeAudit.closedAt = closedAt;
  audits.unshift({ ...activeAudit });
  addLog('audit', `Audit closed: <strong>${activeAudit.name}</strong> — ${activeAudit.items.length} radios verified`);
  activeAudit = null;
  toast('✓ Audit saved', 'ok');
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-audits').classList.add('active');
  renderAuditCards();
}

// ── DETAIL VIEW ──
function openAuditDetail(id) {
  const a = audits.find(x => x.id === id); if (!a) return;
  viewingAuditId = id;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-audit-detail').classList.add('active');
  document.getElementById('detail-title').textContent = a.name;
  document.getElementById('detail-subtitle').textContent =
    (a.closedAt ? 'Closed ' + new Date(a.closedAt).toLocaleString() : 'Open') + ' · Started ' + new Date(a.startedAt).toLocaleString();
  document.getElementById('detail-count').textContent = a.items.length;
  buildAuditTableHeaders();
  renderDetailTable();
}

// ── DELETE ──
async function deleteAudit(id, name) {
  document.getElementById('modal-title').textContent = 'Delete Audit';
  document.getElementById('modal-body').innerHTML = `
    <p style="color:var(--text2);font-size:13px;margin-bottom:16px">
      This will permanently delete the audit and all its scan records. This cannot be undone.
    </p>
    <div class="field">
      <label>Type the audit name to confirm</label>
      <input id="f-confirm-name" type="text" placeholder="${name}" autocomplete="off">
      <div id="f-confirm-error" style="color:var(--red);font-size:11px;font-family:'JetBrains Mono',monospace;margin-top:5px;display:none">Name doesn't match — try again</div>
    </div>`;
  document.getElementById('modal-save-btn').textContent = 'Delete Audit';
  document.getElementById('modal-save-btn').className = 'btn btn-danger';
  modalSaveFn = async () => {
    const typed = (document.getElementById('f-confirm-name')?.value || '').trim();
    if (typed !== name) {
      document.getElementById('f-confirm-error').style.display = 'block';
      return;
    }
    closeModal();
    toast('Deleting audit…', 'syncing', 10000);
    const { error } = await sb.from('audits').delete().eq('id', id); // [DATA LAYER]
    if (error) { toast('Delete failed: ' + error.message, 'err'); return; }
    audits = audits.filter(a => a.id !== id);
    addLog('audit', `Audit deleted: <strong>${name}</strong>`);
    toast('✓ Audit deleted', 'ok');
    document.getElementById('modal-save-btn').className = 'btn btn-accent';
    renderAuditCards();
  };
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('f-confirm-name')?.focus(), 80);
}

// ── AUDIT CARDS ──
function renderAuditCards() {
  const container = document.getElementById('audit-cards');
  const empty = document.getElementById('audit-cards-empty');
  const all = activeAudit ? [{ ...activeAudit, _active: true }, ...audits] : [...audits];
  if (!all.length) { container.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  container.innerHTML = all.map(a => `
    <div class="audit-card" onclick="${a._active ? 'openAuditSession()' : `openAuditDetail('${a.id}')`}">
      <div class="ac-header">
        <div class="ac-name">${a.name}</div>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="ac-badge ${a._active || !a.closedAt ? 'open' : 'closed'}">${a._active ? 'ACTIVE' : 'CLOSED'}</span>
          ${!a._active ? `<button class="btn btn-danger btn-xs" onclick="event.stopPropagation();deleteAudit('${a.id}','${a.name.replace(/'/g, "\\'")}')">Delete</button>` : ''}
        </div>
      </div>
      <div class="ac-meta"><div class="ac-stat"><span>${a.items.length}</span> verified</div></div>
      <div class="ac-date">Started ${new Date(a.startedAt).toLocaleString()}${a.closedAt ? ' · Closed ' + new Date(a.closedAt).toLocaleString() : ''}</div>
    </div>`).join('');
}

// ── SCANNER ──
function handleScan(e) { if (e.key === 'Enter') processScan(); }

async function processScan() {
  if (!activeAudit) return;
  const inp = document.getElementById('scan-input');
  const id = inp.value.trim().toUpperCase(); inp.value = ''; inp.focus();
  const msg = document.getElementById('scan-msg'); if (!id) return;
  const radio = radios.find(r => r.id.toUpperCase() === id);
  if (!radio) {
    msg.style.color = 'var(--red)'; msg.textContent = '✗ ' + id + ' — not found in inventory';
    addLog('audit', `Scan <strong>${id}</strong> — NOT FOUND`); return;
  }
  if (activeAudit.items.find(s => s.id === radio.id)) {
    msg.style.color = 'var(--yellow)'; msg.textContent = '⚠ ' + id + ' — already verified in this audit'; return;
  }
  const ts = new Date().toISOString();
  const item = { id: radio.id, custom_fields: { ...(radio.custom_fields || {}) }, ts };
  const [iRes, rRes] = await Promise.all([
    sb.from('audit_items').insert({ audit_id: activeAudit.id, radio_id: radio.id, custom_fields: radio.custom_fields || {} }), // [DATA LAYER]
    sb.from('radios').update({ last_audited: ts }).eq('id', radio.id) // [DATA LAYER]
  ]);
  if (iRes.error) { msg.style.color = 'var(--red)'; msg.textContent = '✗ DB error: ' + iRes.error.message; return; }
  activeAudit.items.unshift(item); radio.lastAudited = ts;
  msg.style.color = 'var(--green)'; msg.textContent = '✓ ' + radio.id + ' verified';
  addLog('audit', `<strong>${radio.id}</strong> verified`);
  document.getElementById('verified-count').textContent = activeAudit.items.length;
  renderAuditTable();
}

// ── AUDIT TABLES ──
function auditItemRow(i) {
  const fields = visibleFields();
  let tds = `<td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--accent)">${i.id}</td>`;
  fields.forEach(f => { tds += `<td style="color:var(--text2)">${(i.custom_fields && i.custom_fields[f.key]) || '—'}</td>`; });
  tds += `<td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text2)">${new Date(i.ts).toLocaleString()}</td>`;
  return `<tr>${tds}</tr>`;
}

function renderAuditTable() {
  if (!activeAudit) return;
  const q = (document.getElementById('av-search')?.value || '').toLowerCase();
  const sort = document.getElementById('av-sort')?.value || 'ts-desc';
  let items = [...activeAudit.items];
  if (q) items = items.filter(i => (i.id + JSON.stringify(i.custom_fields || {})).toLowerCase().includes(q));
  items.sort((a, b) => sort === 'ts-asc' ? new Date(a.ts) - new Date(b.ts) : sort === 'id-asc' ? a.id.localeCompare(b.id) : new Date(b.ts) - new Date(a.ts));
  document.getElementById('verified-count').textContent = activeAudit.items.length;
  const tbody = document.getElementById('av-tbody'); if (!tbody) return;
  tbody.innerHTML = items.length ? items.map(auditItemRow).join('') : `<tr><td colspan="99" style="text-align:center;padding:24px;color:var(--text3);font-size:12px;font-family:'JetBrains Mono',monospace">No results</td></tr>`;
}

function renderDetailTable() {
  const a = audits.find(x => x.id === viewingAuditId); if (!a) return;
  const q = (document.getElementById('dv-search')?.value || '').toLowerCase();
  let items = [...a.items];
  if (q) items = items.filter(i => (i.id + JSON.stringify(i.custom_fields || {})).toLowerCase().includes(q));
  items.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  document.getElementById('detail-count').textContent = a.items.length;
  const tbody = document.getElementById('dv-tbody'); if (!tbody) return;
  tbody.innerHTML = items.length ? items.map(auditItemRow).join('') : `<tr><td colspan="99" style="text-align:center;padding:24px;color:var(--text3);font-size:12px;font-family:'JetBrains Mono',monospace">No results</td></tr>`;
}

// ── EXPORT ──
function exportCurrentAudit() { if (!activeAudit?.items.length) { alert('No items yet.'); return; } exportAuditToCSV(activeAudit); }
function exportDetailAudit() { const a = audits.find(x => x.id === viewingAuditId); if (a) exportAuditToCSV(a); }

function exportAuditToCSV(a) {
  const fields = visibleFields();
  const headers = ['ID', ...fields.map(f => f.label), 'Verified At'];
  const lines = [headers.join(',')];
  a.items.forEach(i => {
    const row = [i.id, ...fields.map(f => (i.custom_fields && i.custom_fields[f.key]) || ''), i.ts];
    lines.push(row.map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(','));
  });
  dlFile(a.name.replace(/[^a-z0-9]/gi, '_') + '_audit.csv', lines.join('\n'));
  addLog('audit', `Audit exported: <strong>${a.name}</strong>`);
}
