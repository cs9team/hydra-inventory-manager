// ── FIELD DEFINITIONS & SETTINGS ──
// Manage custom inventory fields and app-level settings.

// ── FIELD DEF LIST ──
function renderFieldDefs() {
  const list = document.getElementById('field-def-list'); if (!list) return;
  const fields = visibleFields();
  if (!fields.length) {
    list.innerHTML = '<div style="color:var(--text3);font-size:12px;font-family:\'JetBrains Mono\',monospace">No custom fields yet.</div>'; return;
  }
  list.innerHTML = fields.map(f => `
    <div class="field-def-row" draggable="true" data-id="${f.id}"
      ondragstart="fdrDragStart(event)"
      ondragover="fdrDragOver(event)"
      ondragleave="fdrDragLeave(event)"
      ondrop="fdrDrop(event)"
      ondragend="fdrDragEnd(event)">
      <span class="fdr-drag" title="Drag to reorder">⠿</span>
      <span class="fdr-label">${f.label}</span>
      <span class="fdr-key">${f.key}</span>
      <span class="fdr-type">${f.type}</span>
      <span class="fdr-req">${f.required ? 'REQ' : ''}</span>
      <button class="btn btn-ghost btn-xs" onclick="openEditFieldModal('${f.id}')">Edit</button>
      <button class="btn btn-danger btn-xs" onclick="deleteField('${f.id}')">✕</button>
    </div>`).join('');
}

// ── DRAG-TO-REORDER ──
let _dragId = null;

function fdrDragStart(e) {
  _dragId = e.currentTarget.dataset.id;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function fdrDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const target = e.currentTarget;
  if (target.dataset.id === _dragId) return;
  target.classList.add('drag-over');
}

function fdrDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function fdrDragEnd(e) {
  document.querySelectorAll('.field-def-row').forEach(r => r.classList.remove('dragging', 'drag-over'));
  _dragId = null;
}

async function fdrDrop(e) {
  e.preventDefault();
  const targetId = e.currentTarget.dataset.id;
  if (!_dragId || _dragId === targetId) return;
  e.currentTarget.classList.remove('drag-over');

  // Reorder in fieldDefs array
  const fields = visibleFields();
  const fromIdx = fields.findIndex(f => f.id === _dragId);
  const toIdx   = fields.findIndex(f => f.id === targetId);
  if (fromIdx === -1 || toIdx === -1) return;
  fields.splice(toIdx, 0, fields.splice(fromIdx, 1)[0]);

  // Reassign ord values and update fieldDefs in place
  fields.forEach((f, i) => {
    const def = fieldDefs.find(d => d.id === f.id);
    if (def) def.ord = i;
  });

  renderFieldDefs();
  renderTable();

  // Persist to Supabase
  toast('Saving order…', 'syncing', 10000);
  const results = await Promise.all(
    fields.map((f, i) => sb.from('field_definitions').update({ ord: i }).eq('id', f.id)) // [DATA LAYER]
  );
  const failed = results.find(r => r.error);
  if (failed) { toast('Failed: ' + failed.error.message, 'err'); return; }
  toast('✓ Order saved', 'ok');
}
// ── FIELD MODAL ──
function openAddFieldModal() {
  document.getElementById('modal-title').textContent = 'Add Field';
  document.getElementById('modal-body').innerHTML = buildFieldForm(null);
  document.getElementById('modal-save-btn').textContent = 'Add Field';
  modalSaveFn = saveFieldModal;
  document.getElementById('modal-overlay').classList.add('open');
  toggleOptionsRow();
}

function openEditFieldModal(id) {
  const f = fieldDefs.find(x => x.id === id); if (!f) return;
  document.getElementById('modal-title').textContent = 'Edit Field — ' + f.label;
  document.getElementById('modal-body').innerHTML = buildFieldForm(f);
  document.getElementById('modal-save-btn').textContent = 'Save Field';
  modalSaveFn = () => saveFieldModal(id);
  document.getElementById('modal-overlay').classList.add('open');
  toggleOptionsRow();
}

function buildFieldForm(f) {
  const opts = f && f.options ? f.options.join(', ') : '';
  return `
    <div class="field"><label>Label (display name)</label><input id="ff-label" type="text" value="${f ? f.label : ''}" placeholder="e.g. Division"></div>
    <div class="field"><label>Key (internal, no spaces)</label><input id="ff-key" type="text" value="${f ? f.key : ''}" placeholder="e.g. division" ${f ? 'readonly' : ''}></div>
    <div class="field"><label>Type</label>
      <select id="ff-type" onchange="toggleOptionsRow()">
        <option value="text" ${(!f || f.type === 'text') ? 'selected' : ''}>Text</option>
        <option value="select" ${f && f.type === 'select' ? 'selected' : ''}>Dropdown (select)</option>
        <option value="date" ${f && f.type === 'date' ? 'selected' : ''}>Date</option>
        <option value="number" ${f && f.type === 'number' ? 'selected' : ''}>Number</option>
        <option value="textarea" ${f && f.type === 'textarea' ? 'selected' : ''}>Textarea</option>
      </select>
    </div>
    <div class="field" id="ff-options-row" style="display:none">
      <label>Options (comma-separated)</label>
      <input id="ff-options" type="text" value="${opts}" placeholder="e.g. IN, OUT, PENDING">
    </div>
    <div class="field">
      <label><input type="checkbox" id="ff-required" ${f && f.required ? 'checked' : ''} style="width:auto;margin-right:6px">Required field</label>
    </div>`;
}

function toggleOptionsRow() {
  const t = document.getElementById('ff-type')?.value;
  const row = document.getElementById('ff-options-row');
  if (row) row.style.display = t === 'select' ? 'block' : 'none';
}

async function saveFieldModal(editId) {
  const label = (document.getElementById('ff-label')?.value || '').trim();
  let key = (document.getElementById('ff-key')?.value || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const type = document.getElementById('ff-type')?.value || 'text';
  const optsRaw = (document.getElementById('ff-options')?.value || '');
  const options = type === 'select' ? optsRaw.split(',').map(s => s.trim()).filter(Boolean) : null;
  const required = document.getElementById('ff-required')?.checked || false;
  if (!label) { alert('Label is required.'); return; }
  if (!key) { alert('Key is required.'); return; }
  toast('Saving field…', 'syncing', 10000);
  if (editId) {
    const { error } = await sb.from('field_definitions').update({ label, type, options, required }).eq('id', editId); // [DATA LAYER]
    if (error) { toast('Failed: ' + error.message, 'err'); return; }
    const idx = fieldDefs.findIndex(f => f.id === editId);
    if (idx > -1) fieldDefs[idx] = { ...fieldDefs[idx], label, type, options, required };
  } else {
    if (fieldDefs.find(f => f.key === key)) { alert('A field with that key already exists.'); return; }
    const ord = fieldDefs.length;
    const { data, error } = await sb.from('field_definitions').insert({ key, label, type, options, required, ord }).select().single(); // [DATA LAYER]
    if (error) { toast('Failed: ' + error.message, 'err'); return; }
    fieldDefs.push(data);
  }
  addLog('settings', editId ? `Field updated: <strong>${label}</strong>` : `Field added: <strong>${label}</strong>`);
  toast('✓ Field saved', 'ok');
  closeModal(); renderFieldDefs(); renderTable();
}

async function deleteField(id) {
  const f = fieldDefs.find(x => x.id === id); if (!f) return;
  if (!confirm(`Delete field "${f.label}"? This removes it from all radios.`)) return;
  toast('Deleting…', 'syncing', 10000);
  const { error } = await sb.from('field_definitions').delete().eq('id', id); // [DATA LAYER]
  if (error) { toast('Failed: ' + error.message, 'err'); return; }
  fieldDefs = fieldDefs.filter(x => x.id !== id);
  addLog('settings', `Field deleted: <strong>${f.label}</strong>`);
  toast('✓ Field deleted', 'ok');
  renderFieldDefs(); renderTable();
}

// ── APP SETTINGS ──
async function applySettings() {
  appSettings.auditInterval = parseInt(document.getElementById('audit-interval').value) || 90;
  appSettings.unitName = document.getElementById('unit-name').value.trim();
  const { error } = await sb.from('app_settings').update({ audit_interval: appSettings.auditInterval, unit_name: appSettings.unitName }).eq('id', 1); // [DATA LAYER]
  if (error) { toast('Failed: ' + error.message, 'err'); return; }
  addLog('settings', `Settings applied — audit interval: <strong>${appSettings.auditInterval}d</strong>`);
  toast('✓ Settings saved', 'ok');
}

async function confirmClearData() {
  if (!confirm('Erase ALL radios? This cannot be undone.')) return;
  if (!confirm('Second confirmation — this is permanent.')) return;
  toast('Clearing…', 'syncing', 10000);
  await sb.from('radios').delete().neq('id', '__none__'); // [DATA LAYER]
  radios = []; toast('✓ Cleared', 'ok'); renderTable(); refreshDashboard();
}
