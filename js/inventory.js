// ── INVENTORY ──
// Inventory table rendering, sorting, and radio add/edit/delete.

// ── SORT ──
function sortBy(field) {
  if (sortField === field) sortDir *= -1; else { sortField = field; sortDir = 1; }
  renderTable();
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
  document.getElementById('modal-body').innerHTML = buildRadioForm(null);
  document.getElementById('modal-save-btn').textContent = 'Add Radio';
  document.getElementById('modal-overlay').classList.add('open');
}

function openEditModal(id) {
  const r = radios.find(x => x.id === id); if (!r) return;
  editingId = id; modalSaveFn = saveModal;
  document.getElementById('modal-title').textContent = 'Edit Radio — ' + id;
  document.getElementById('modal-body').innerHTML = buildRadioForm(r);
  document.getElementById('modal-save-btn').textContent = 'Save Changes';
  document.getElementById('modal-overlay').classList.add('open');
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
