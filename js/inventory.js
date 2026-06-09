// ── INVENTORY ──
// Inventory table rendering, sorting, and radio add/edit/delete.

// ── SORT ──
function sortBy(field) {
  if (sortField === field) sortDir *= -1; else { sortField = field; sortDir = 1; }
  renderTable();
}

// ── MULTI-FIELD FILTER ──
// activeFilters: { fieldKey: Set(values) }
let activeFilters = {};

function getFilterableFields() {
  // All select-type fields from fieldDefs
  return fieldDefs.filter(f => f.type === 'select' && f.options && f.options.length);
}

function toggleFilterPanel() {
  const existing = document.getElementById('filter-overlay');
  if (existing) { closeFilterPanel(); return; }
  openFilterPanel();
}

function openFilterPanel() {
  // Position relative to the filter button
  const btn = document.getElementById('filter-toggle-btn');
  const rect = btn.getBoundingClientRect();

  const overlay = document.createElement('div');
  overlay.id = 'filter-overlay';
  overlay.className = 'filter-overlay';
  overlay.style.top = (rect.bottom + window.scrollY + 6) + 'px';
  overlay.style.right = (window.innerWidth - rect.right) + 'px';

  const fields = getFilterableFields();
  overlay.innerHTML = `
    <div class="filter-panel-header">
      <span class="filter-panel-title">Filters</span>
      <button class="filter-clear-all" onclick="clearAllFilters()">Clear all</button>
    </div>
    <div class="filter-panel-body">
      ${fields.length
        ? fields.map(f => buildFilterGroup(f)).join('')
        : '<div class="filter-panel-empty">No filterable fields — add a Dropdown field in Settings.</div>'
      }
    </div>`;

  document.body.appendChild(overlay);
  // Close on outside click
  setTimeout(() => document.addEventListener('click', onFilterOutsideClick), 0);
}

function closeFilterPanel() {
  document.getElementById('filter-overlay')?.remove();
  document.removeEventListener('click', onFilterOutsideClick);
}

function onFilterOutsideClick(e) {
  const overlay = document.getElementById('filter-overlay');
  const btn = document.getElementById('filter-toggle-btn');
  if (overlay && !overlay.contains(e.target) && !btn.contains(e.target)) {
    closeFilterPanel();
  }
}

function buildFilterPanel() {
  // Rebuilds content inside existing overlay (called after toggle)
  const overlay = document.getElementById('filter-overlay');
  if (!overlay) return;
  const fields = getFilterableFields();
  const body = overlay.querySelector('.filter-panel-body');
  if (body) body.innerHTML = fields.length
    ? fields.map(f => buildFilterGroup(f)).join('')
    : '<div class="filter-panel-empty">No filterable fields — add a Dropdown field in Settings.</div>';
}

function buildFilterGroup(f) {
  const active = activeFilters[f.key] || new Set();
  return `
    <div class="filter-group">
      <div class="filter-group-label">${f.label}</div>
      <div class="filter-group-options">
        ${f.options.map(o => `
          <label class="filter-option ${active.has(o) ? 'active' : ''}" onclick="toggleFilterValue('${f.key}','${o.replace(/'/g,"\'")}',this)">
            <span class="filter-option-check">${active.has(o) ? '✓' : ''}</span>
            <span>${o}</span>
          </label>`).join('')}
      </div>
    </div>`;
}

function toggleFilterValue(key, value, el) {
  if (!activeFilters[key]) activeFilters[key] = new Set();
  const set = activeFilters[key];
  if (set.has(value)) set.delete(value);
  else set.add(value);
  if (!set.size) delete activeFilters[key];
  // Update just this option visually in place
  const isActive = (activeFilters[key] || new Set()).has(value);
  el.classList.toggle('active', isActive);
  el.querySelector('.filter-option-check').textContent = isActive ? '✓' : '';
  updateFilterBtnLabel();
  renderFilterPills();
  renderTable();
}

function clearAllFilters() {
  activeFilters = {};
  buildFilterPanel();
  updateFilterBtnLabel();
  renderFilterPills();
  renderTable();
}

function clearFieldFilter(key) {
  delete activeFilters[key];
  buildFilterPanel();
  updateFilterBtnLabel();
  renderFilterPills();
  renderTable();
}

function removeFilterValue(key, value) {
  if (!activeFilters[key]) return;
  activeFilters[key].delete(value);
  if (!activeFilters[key].size) delete activeFilters[key];
  buildFilterPanel();
  updateFilterBtnLabel();
  renderFilterPills();
  renderTable();
}

function updateFilterBtnLabel() {
  const btn = document.getElementById('filter-btn-label');
  if (!btn) return;
  const total = Object.values(activeFilters).reduce((n, s) => n + s.size, 0);
  btn.textContent = total ? `⚡ Filter (${total})` : '⚡ Filter';
  document.getElementById('filter-toggle-btn')?.classList.toggle('btn-accent', total > 0);
  document.getElementById('filter-toggle-btn')?.classList.toggle('btn-ghost', total === 0);
}

function renderFilterPills() {
  const row = document.getElementById('filter-pills-row');
  if (!row) return;
  const entries = [];
  Object.entries(activeFilters).forEach(([key, vals]) => {
    const field = fieldDefs.find(f => f.key === key);
    const label = field ? field.label : key;
    vals.forEach(v => entries.push({ key, label, value: v }));
  });
  if (!entries.length) {
    row.style.display = 'none';
    row.innerHTML = '';
    return;
  }
  row.style.display = 'flex';
  row.innerHTML = entries.map(e =>
    `<span class="dept-pill"><span style="opacity:.6;margin-right:4px">${e.label}:</span>${e.value}<button class="dept-pill-x" onclick="removeFilterValue('${e.key}','${e.value.replace(/'/g,"\'")}')">✕</button></span>`
  ).join('') + `<button class="dept-pill-clear" onclick="clearAllFilters()">Clear all</button>`;
}

function hasActiveFilters() {
  return Object.values(activeFilters).some(s => s.size > 0);
}

// ── TABLE ──
function buildTableHeader(theadId, includeActions) {
  const thead = document.getElementById(theadId); if (!thead) return;
  const fields = visibleFields();
  let html = `<th onclick="sortBy('id')" style="cursor:pointer">ID <span class="sort-arrow" id="sa-id"></span></th>`;
  fields.forEach(f => {
    html += `<th onclick="sortBy('cf_${f.key}')" style="cursor:pointer">${f.label} <span class="sort-arrow" id="sa-cf_${f.key}"></span></th>`;
  });
  html += `<th onclick="sortBy('lastAudited')" style="cursor:pointer">Last Audited <span class="sort-arrow" id="sa-lastAudited"></span></th>`;
  if (includeActions) html += '<th></th>';
  thead.innerHTML = html;
}

function renderTable() {
  buildTableHeader('inv-thead', true);
  const q = (document.getElementById('search-input')?.value || '').toLowerCase();
  let rows = radios.filter(r => {
    // Apply active filters — all field filters must match (AND logic)
    for (const [key, vals] of Object.entries(activeFilters)) {
      if (vals.size && !vals.has(r.custom_fields?.[key] || '')) return false;
    }
    if (!q) return true;
    if ((r.id || '').toLowerCase().includes(q)) return true;
    if ((r.lid || '').toLowerCase().includes(q)) return true;
    return Object.values(r.custom_fields || {}).some(v => String(v || '').toLowerCase().includes(q));
  });
  rows.sort((a, b) => {
    let av, bv;
    if (sortField === 'id') { av = a.id || ''; bv = b.id || ''; }
    else if (sortField === 'lastAudited') { av = a.lastAudited || ''; bv = b.lastAudited || ''; }
    else if (sortField.startsWith('cf_')) {
      const k = sortField.slice(3);
      av = (a.custom_fields && a.custom_fields[k]) || ''; bv = (b.custom_fields && b.custom_fields[k]) || '';
    } else { av = ''; bv = ''; }
    return av < bv ? -sortDir : av > bv ? sortDir : 0;
  });

  // update sort arrows
  document.querySelectorAll('.sort-arrow').forEach(el => el.textContent = '');
  document.querySelectorAll('thead th').forEach(th => th.classList.remove('sorted'));
  const arrowEl = document.getElementById('sa-' + sortField);
  if (arrowEl) { arrowEl.textContent = sortDir === 1 ? '▲' : '▼'; arrowEl.closest('th')?.classList.add('sorted'); }

  const tbody = document.getElementById('inv-tbody'); if (!tbody) return;
  const fields = visibleFields();
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="${fields.length + 3}" style="text-align:center;padding:30px;color:var(--text3);font-family:'JetBrains Mono',monospace;font-size:12px">No radios found</td></tr>`;
  } else {
    tbody.innerHTML = rows.map(r => {
      let tds = `<td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--accent)">${r.id || ''}</td>`;
      fields.forEach(f => {
        const v = (r.custom_fields && r.custom_fields[f.key]) || '';
        tds += `<td style="color:var(--text2)">${v || '—'}</td>`;
      });
      tds += `<td style="color:var(--text2);font-family:'JetBrains Mono',monospace;font-size:11px">${r.lastAudited ? new Date(r.lastAudited).toLocaleDateString() : '<span style="color:var(--text3)">Never</span>'}</td>`;
      tds += `<td><button class="btn btn-danger btn-xs" onclick="event.stopPropagation();deleteRadio('${r.id}')">Delete</button></td>`;
      return `<tr onclick="openEditModal('${r.id}')">${tds}</tr>`;
    }).join('');
  }
  document.getElementById('table-count').textContent = rows.length + ' of ' + radios.length + ' radios';
}

// ── CSV EXPORT ──
function exportCSV() {
  if (!radios.length) { alert('No radios to export.'); return; }
  const fields = visibleFields();
  const headers = ['ID', ...fields.map(f => f.label), 'Last Audited'];
  const lines = [headers.join(',')];
  radios.forEach(r => {
    const row = [r.id, ...fields.map(f => (r.custom_fields && r.custom_fields[f.key]) || ''), r.lastAudited || ''];
    lines.push(row.map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(','));
  });
  dlFile('radios_export_' + new Date().toISOString().slice(0, 10) + '.csv', lines.join('\n'));
  addLog('settings', `CSV exported — ${radios.length} radios`);
}

function dlFile(name, content) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'application/octet-stream' }));
  a.download = name; a.click();
}

// ── MODAL: ADD/EDIT RADIO ──
function buildRadioForm(r) {
  const fields = visibleFields();
  let html = `<div class="field"><label>Serial # <span style="color:var(--red)">*</span></label><input id="f-id" type="text" value="${r ? r.id : ''}" ${r ? 'readonly' : ''} placeholder="e.g. SER-0042"></div>`;
  fields.forEach(f => {
    const val = r && r.custom_fields ? (r.custom_fields[f.key] || '') : '';
    if (f.type === 'select' && f.options && f.options.length) {
      const opts = f.options.map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('');
      html += `<div class="field"><label>${f.label}${f.required ? ' <span style="color:var(--red)">*</span>' : ''}</label><select id="f-${f.key}"><option value="">—</option>${opts}</select></div>`;
    } else if (f.type === 'date') {
      html += `<div class="field"><label>${f.label}${f.required ? ' <span style="color:var(--red)">*</span>' : ''}</label><input id="f-${f.key}" type="date" value="${val}"></div>`;
    } else if (f.type === 'textarea') {
      html += `<div class="field"><label>${f.label}</label><textarea id="f-${f.key}">${val}</textarea></div>`;
    } else {
      html += `<div class="field"><label>${f.label}${f.required ? ' <span style="color:var(--red)">*</span>' : ''}</label><input id="f-${f.key}" type="text" value="${val}" placeholder="${f.label}"></div>`;
    }
  });
  return html;
}

function openAddModal() {
  editingId = null; modalSaveFn = saveModal;
  document.getElementById('modal-title').textContent = 'Add Radio';
  document.getElementById('modal-save-btn').style.display = '';
  document.getElementById('modal-save-btn').textContent = 'Add Radio';
  document.getElementById('modal-body').innerHTML = buildRadioForm(null);
  document.getElementById('modal-overlay').classList.add('open');
}

function openEditModal(id) {
  const r = radios.find(x => x.id === id); if (!r) return;
  openRadioCard(r);
}

function openRadioCard(r) {
  editingId = null; modalSaveFn = null;
  document.getElementById('modal-title').textContent = r.id;
  document.getElementById('modal-save-btn').style.display = 'none';
  document.getElementById('modal-body').innerHTML = buildRadioCard(r);
  document.getElementById('modal-overlay').classList.add('open');
}

function switchToEditMode(id) {
  const r = radios.find(x => x.id === id); if (!r) return;
  editingId = id; modalSaveFn = saveModal;
  document.getElementById('modal-title').textContent = 'Edit — ' + id;
  document.getElementById('modal-save-btn').style.display = '';
  document.getElementById('modal-save-btn').textContent = 'Save Changes';
  document.getElementById('modal-body').innerHTML = buildRadioForm(r);
}

function buildRadioCard(r) {
  const fields = visibleFields();

  const fieldRows = fields.map(f => {
    const val = (r.custom_fields && r.custom_fields[f.key]) || '';
    return `<div class="rc-field">
      <div class="rc-field-label">${f.label}</div>
      <div class="rc-field-value">${val || '<span style="color:var(--text3)">—</span>'}</div>
    </div>`;
  }).join('');

  // Build history from audit data
  const history = [];
  const allAudits = activeAudit ? [activeAudit, ...audits] : [...audits];
  allAudits.forEach(a => {
    a.items.forEach(item => {
      if (item.id === r.id) {
        history.push({ type: 'audit', label: 'Verified in audit', detail: a.name, ts: item.ts });
      }
    });
  });
  if (!history.length && r.lastAudited) {
    history.push({ type: 'audit', label: 'Last verified', detail: '', ts: r.lastAudited });
  }
  history.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  history.push({ type: 'add', label: 'Added to inventory', detail: '', ts: null });

  const icons = { audit: '🔍', add: '➕', edit: '✏️' };
  const historyRows = history.map((h, i) => `
    <div class="rc-hist-item ${i === history.length - 1 ? 'last' : ''}">
      <div class="rc-hist-dot ${h.type}"></div>
      <div class="rc-hist-body">
        <div class="rc-hist-label">${icons[h.type] || '•'} ${h.label}${h.detail ? ` <span class="rc-hist-detail">${h.detail}</span>` : ''}</div>
        <div class="rc-hist-time">${h.ts ? fmtTime(h.ts) : 'Unknown date'}</div>
      </div>
    </div>`).join('');

  const badge = r.lastAudited
    ? `<span class="rc-badge audited">✓ Audited ${fmtTime(r.lastAudited)}</span>`
    : `<span class="rc-badge never">Never audited</span>`;

  return `<div class="radio-card">
    <div class="rc-topbar">
      ${badge}
      <button class="btn btn-accent btn-sm" onclick="switchToEditMode('${r.id}')">✏️ Edit</button>
      <button class="btn btn-danger btn-sm" onclick="closeModal();deleteRadio('${r.id}')">Delete</button>
    </div>
    <div class="rc-fields">${fieldRows}</div>
    <div class="rc-history">
      <div class="rc-hist-title">History</div>
      ${historyRows || '<div style="color:var(--text3);font-size:12px">No history yet</div>'}
    </div>
  </div>`;
}

async function saveModal() {
  const id = document.getElementById('f-id')?.value.trim();
  if (!id) { alert('Serial # is required.'); return; }
  const fields = visibleFields();
  for (const f of fields) {
    if (f.required) {
      const v = document.getElementById('f-' + f.key)?.value.trim();
      if (!v) { alert(f.label + ' is required.'); return; }
    }
  }
  const custom_fields = {};
  fields.forEach(f => {
    const v = document.getElementById('f-' + f.key)?.value.trim();
    if (v) custom_fields[f.key] = v;
  });
  const record = { id, custom_fields };
  toast('Saving…', 'syncing', 10000);
  if (editingId) {
    const { error } = await sb.from('radios').update(record).eq('id', editingId); // [DATA LAYER]
    if (error) { toast('Save failed: ' + error.message, 'err'); return; }
    const idx = radios.findIndex(r => r.id === editingId);
    if (idx > -1) radios[idx] = { ...radios[idx], ...record };
    addLog('edit', `<strong>${id}</strong> updated`);
    toast('✓ Saved', 'ok');
  } else {
    if (radios.find(r => r.id === id)) { alert('A radio with that ID already exists.'); toast('', 'ok', 1); return; }
    const { error } = await sb.from('radios').insert(record); // [DATA LAYER]
    if (error) { toast('Save failed: ' + error.message, 'err'); return; }
    radios.push({ ...record, lastAudited: null });
    addLog('add', `<strong>${id}</strong> added`);
    toast('✓ Added', 'ok');
  }
  closeModal(); renderTable(); refreshDashboard();
}

async function deleteRadio(id) {
  const r = radios.find(x => x.id === id); if (!r) return;
  if (!confirm(`Delete radio ${id}? This cannot be undone.`)) return;
  toast('Deleting…', 'syncing', 10000);
  const { error } = await sb.from('radios').delete().eq('id', id); // [DATA LAYER]
  if (error) { toast('Delete failed: ' + error.message, 'err'); return; }
  radios = radios.filter(x => x.id !== id);
  addLog('delete', `<strong>${id}</strong> deleted`);
  toast('✓ Deleted', 'ok'); renderTable(); refreshDashboard();
}
