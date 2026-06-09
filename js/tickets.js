// ── TICKETS ──
// Trouble ticket tracker: create, view, edit, resolve, kanban + list views.

const TICKET_STATUSES  = ['Open', 'In Progress', 'Resolved'];
const TICKET_PRIORITIES = ['Low', 'Medium', 'High'];

const PRIORITY_COLOR = { Low: 'tkt-low', Medium: 'tkt-med', High: 'tkt-high' };
const STATUS_COLOR   = { Open: 'tkt-open', 'In Progress': 'tkt-inprog', Resolved: 'tkt-resolved' };

let ticketView = localStorage.getItem('hydra-ticket-view') || 'kanban'; // 'kanban' | 'list'

// ── RENDER ENTRY ──
function renderTickets() {
  updateTicketStats();
  if (ticketView === 'kanban') renderKanban();
  else renderTicketList();
  syncTicketViewToggle();
}

function syncTicketViewToggle() {
  document.getElementById('tkt-view-kanban')?.classList.toggle('active', ticketView === 'kanban');
  document.getElementById('tkt-view-list')?.classList.toggle('active', ticketView === 'list');
}

function setTicketView(v) {
  ticketView = v;
  localStorage.setItem('hydra-ticket-view', v);
  renderTickets();
}

// ── STATS BAR ──
function updateTicketStats() {
  const open     = tickets.filter(t => t.status === 'Open').length;
  const inprog   = tickets.filter(t => t.status === 'In Progress').length;
  const resolved = tickets.filter(t => t.status === 'Resolved').length;
  const high     = tickets.filter(t => t.priority === 'High' && t.status !== 'Resolved').length;
  const el = document.getElementById('ticket-stats');
  if (!el) return;
  el.innerHTML = `
    <span class="tkt-stat"><span class="tkt-stat-dot tkt-open"></span>${open} Open</span>
    <span class="tkt-stat"><span class="tkt-stat-dot tkt-inprog"></span>${inprog} In Progress</span>
    <span class="tkt-stat"><span class="tkt-stat-dot tkt-resolved"></span>${resolved} Resolved</span>
    ${high ? `<span class="tkt-stat high">⚠ ${high} High Priority</span>` : ''}`;
}

// ── KANBAN ──
function renderKanban() {
  const wrap = document.getElementById('tickets-wrap');
  if (!wrap) return;
  wrap.innerHTML = `<div class="kanban-board">
    ${TICKET_STATUSES.map(s => `
      <div class="kanban-col">
        <div class="kanban-col-header">
          <span class="kanban-col-title">${s}</span>
          <span class="kanban-col-count">${tickets.filter(t => t.status === s).length}</span>
        </div>
        <div class="kanban-col-body" id="kanban-${s.replace(' ','-')}">
          ${tickets.filter(t => t.status === s).map(t => ticketCard(t)).join('') || 
            `<div class="kanban-empty">No tickets</div>`}
        </div>
      </div>`).join('')}
  </div>`;
}

function ticketCard(t) {
  const radio = t.radio_id ? radios.find(r => r.id === t.radio_id) : null;
  const overdue = t.est_completion && t.status !== 'Resolved' && new Date(t.est_completion) < new Date();
  return `
    <div class="tkt-card" onclick="openTicketModal('${t.id}')">
      <div class="tkt-card-top">
        <span class="tkt-id">${t.id}</span>
        <span class="tkt-badge ${PRIORITY_COLOR[t.priority]}">${t.priority}</span>
      </div>
      <div class="tkt-title">${t.title}</div>
      ${radio ? `<div class="tkt-radio">📻 ${radio.id}</div>` : ''}
      <div class="tkt-card-foot">
        ${t.technician ? `<span class="tkt-tech">👤 ${t.technician}</span>` : ''}
        ${t.est_completion ? `<span class="tkt-date ${overdue ? 'overdue' : ''}">📅 ${new Date(t.est_completion).toLocaleDateString()}</span>` : ''}
      </div>
    </div>`;
}

// ── LIST VIEW ──
function renderTicketList() {
  const wrap = document.getElementById('tickets-wrap');
  if (!wrap) return;
  const sorted = [...tickets].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  wrap.innerHTML = `
    <div class="tkt-list-wrap">
      <table>
        <thead><tr>
          <th>ID</th><th>Title</th><th>Status</th><th>Priority</th>
          <th>Radio</th><th>Technician</th><th>Est. Date</th><th>Created</th>
        </tr></thead>
        <tbody>
          ${sorted.length ? sorted.map(t => {
            const overdue = t.est_completion && t.status !== 'Resolved' && new Date(t.est_completion) < new Date();
            return `<tr onclick="openTicketModal('${t.id}')" style="cursor:pointer">
              <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--accent)">${t.id}</td>
              <td>${t.title}</td>
              <td><span class="tkt-badge ${STATUS_COLOR[t.status]}">${t.status}</span></td>
              <td><span class="tkt-badge ${PRIORITY_COLOR[t.priority]}">${t.priority}</span></td>
              <td style="font-family:'JetBrains Mono',monospace;font-size:11px">${t.radio_id || '—'}</td>
              <td>${t.technician || '—'}</td>
              <td class="${overdue ? 'tkt-overdue-cell' : ''}">${t.est_completion ? new Date(t.est_completion).toLocaleDateString() : '—'}</td>
              <td style="font-size:11px;color:var(--text3)">${fmtTime(t.created_at)}</td>
            </tr>`;
          }).join('') : `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text3);font-size:12px;font-family:'JetBrains Mono',monospace">No tickets yet</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

// ── TICKET ID GENERATOR ──
async function generateTicketId() {
  const { data, error } = await sb.rpc('next_ticket_id'); // [DATA LAYER]
  if (error || !data) {
    // Fallback: derive from existing tickets
    const nums = tickets.map(t => parseInt(t.id.replace('TKT-', '')) || 0);
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return 'TKT-' + String(next).padStart(3, '0');
  }
  return 'TKT-' + String(data).padStart(3, '0');
}

// ── CREATE MODAL ──
async function openNewTicketModal() {
  document.getElementById('modal-title').textContent = 'New Ticket';
  document.getElementById('modal-save-btn').style.display = '';
  document.getElementById('modal-save-btn').textContent = 'Create Ticket';
  document.getElementById('modal-body').innerHTML = buildTicketForm(null);
  modalSaveFn = saveTicket;
  document.getElementById('modal-overlay').classList.add('open');
}

// ── VIEW / EDIT MODAL ──
function openTicketModal(id) {
  const t = tickets.find(x => x.id === id); if (!t) return;
  document.getElementById('modal-title').textContent = t.id;
  document.getElementById('modal-save-btn').style.display = 'none';
  document.getElementById('modal-body').innerHTML = buildTicketCard(t);
  modalSaveFn = null;
  document.getElementById('modal-overlay').classList.add('open');
}

function switchToTicketEdit(id) {
  const t = tickets.find(x => x.id === id); if (!t) return;
  document.getElementById('modal-title').textContent = 'Edit — ' + id;
  document.getElementById('modal-save-btn').style.display = '';
  document.getElementById('modal-save-btn').textContent = 'Save Changes';
  document.getElementById('modal-body').innerHTML = buildTicketForm(t);
  modalSaveFn = () => saveTicket(id);
}

// ── TICKET CARD (view mode) ──
function buildTicketCard(t) {
  const radio = t.radio_id ? radios.find(r => r.id === t.radio_id) : null;
  const overdue = t.est_completion && t.status !== 'Resolved' && new Date(t.est_completion) < new Date();
  return `
    <div class="tkt-view-card">
      <div class="rc-topbar">
        <span class="tkt-badge ${STATUS_COLOR[t.status]}" style="margin-right:6px">${t.status}</span>
        <span class="tkt-badge ${PRIORITY_COLOR[t.priority]}">${t.priority} Priority</span>
        <span style="margin-left:auto;display:flex;gap:8px">
          <button class="btn btn-accent btn-sm" onclick="switchToTicketEdit('${t.id}')">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="closeModal();deleteTicket('${t.id}')">Delete</button>
        </span>
      </div>
      <div class="tkt-view-title">${t.title}</div>
      ${t.description ? `<div class="tkt-view-desc">${t.description}</div>` : ''}
      <div class="rc-fields">
        <div class="rc-field">
          <div class="rc-field-label">Radio</div>
          <div class="rc-field-divider"></div>
          <div class="rc-field-value">${radio ? radio.id : '<span class="rc-empty">—</span>'}</div>
        </div>
        <div class="rc-field">
          <div class="rc-field-label">Technician</div>
          <div class="rc-field-divider"></div>
          <div class="rc-field-value">${t.technician || '<span class="rc-empty">—</span>'}</div>
        </div>
        <div class="rc-field">
          <div class="rc-field-label">Est. Completion</div>
          <div class="rc-field-divider"></div>
          <div class="rc-field-value ${overdue ? 'tkt-overdue-cell' : ''}">${t.est_completion ? new Date(t.est_completion).toLocaleDateString() : '<span class="rc-empty">—</span>'}</div>
        </div>
        <div class="rc-field">
          <div class="rc-field-label">Created</div>
          <div class="rc-field-divider"></div>
          <div class="rc-field-value">${new Date(t.created_at).toLocaleString()}</div>
        </div>
        <div class="rc-field">
          <div class="rc-field-label">Last Updated</div>
          <div class="rc-field-divider"></div>
          <div class="rc-field-value">${fmtTime(t.updated_at)}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
        ${TICKET_STATUSES.filter(s => s !== t.status).map(s =>
          `<button class="btn btn-ghost btn-sm" onclick="quickSetStatus('${t.id}','${s}')">→ ${s}</button>`
        ).join('')}
      </div>
    </div>`;
}

// ── TICKET FORM (create/edit) ──
function buildTicketForm(t) {
  const linkedRadio = t?.radio_id ? radios.find(r => r.id === t.radio_id) : null;
  const linkedLabel = linkedRadio
    ? linkedRadio.id + (linkedRadio.custom_fields?.radio_name ? ' — ' + linkedRadio.custom_fields.radio_name : '')
    : '';

  return `
    <div class="field"><label>Title <span style="color:var(--red)">*</span></label>
      <input id="tf-title" type="text" value="${t ? t.title : ''}" placeholder="e.g. Broken antenna, needs replacement"></div>
    <div class="field"><label>Description</label>
      <textarea id="tf-desc" style="min-height:70px">${t ? (t.description || '') : ''}</textarea></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="field"><label>Status</label>
        <select id="tf-status">
          ${TICKET_STATUSES.map(s => `<option ${t?.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select></div>
      <div class="field"><label>Priority</label>
        <select id="tf-priority">
          ${TICKET_PRIORITIES.map(p => `<option ${(t?.priority || 'Medium') === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select></div>
    </div>
    <div class="field">
      <label>Linked Radio (optional)</label>
      <div class="radio-search-wrap" id="radio-search-wrap">
        <input id="tf-radio-search" type="text" 
          placeholder="Scan barcode or type serial / last 4 digits…"
          value="${linkedLabel}"
          autocomplete="off" spellcheck="false"
          oninput="radioSearchInput()"
          onkeydown="radioSearchKeydown(event)">
        <input type="hidden" id="tf-radio" value="${t?.radio_id || ''}">
        ${linkedLabel ? `<button class="radio-search-clear" onclick="clearRadioSearch()" title="Clear">✕</button>` : ''}
      </div>
      <div class="radio-search-results" id="radio-search-results" style="display:none"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="field"><label>Technician</label>
        <input id="tf-tech" type="text" value="${t?.technician || ''}" placeholder="Name or callsign"></div>
      <div class="field"><label>Est. Completion</label>
        <input id="tf-date" type="date" value="${t?.est_completion || ''}"></div>
    </div>`;
}

// ── RADIO SEARCH LOGIC ──
let _radioSearchSelected = false;

function radioSearchInput() {
  _radioSearchSelected = false;
  document.getElementById('tf-radio').value = '';
  const q = (document.getElementById('tf-radio-search')?.value || '').trim().toLowerCase();
  const resultsEl = document.getElementById('radio-search-results');
  const clearBtn = document.querySelector('.radio-search-clear');
  if (clearBtn) clearBtn.style.display = q ? '' : 'none';
  if (!q) { resultsEl.style.display = 'none'; return; }

  const matches = radios.filter(r => {
    const id = r.id.toLowerCase();
    const name = (r.custom_fields?.radio_name || '').toLowerCase();
    return id.includes(q) || id.endsWith(q) || name.includes(q);
  }).slice(0, 8);

  if (!matches.length) {
    resultsEl.innerHTML = '<div class="rsr-empty">No radios found</div>';
    resultsEl.style.display = 'block';
    return;
  }
  resultsEl.innerHTML = matches.map((r, i) => {
    const name = r.custom_fields?.radio_name || '';
    const dept = r.custom_fields?.department || '';
    return `<div class="rsr-item" data-id="${r.id}" data-idx="${i}"
      onclick="selectRadioResult('${r.id}')"
      onmouseenter="highlightRadioResult(${i})">
      <span class="rsr-id">${r.id}</span>
      <span class="rsr-meta">${[name, dept].filter(Boolean).join(' · ') || '—'}</span>
    </div>`;
  }).join('');
  resultsEl.style.display = 'block';
}

function radioSearchKeydown(e) {
  const results = document.getElementById('radio-search-results');
  if (results.style.display === 'none') return;
  const items = results.querySelectorAll('.rsr-item');
  const cur = results.querySelector('.rsr-item.highlighted');
  let idx = cur ? parseInt(cur.dataset.idx) : -1;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    highlightRadioResult(Math.min(idx + 1, items.length - 1));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    highlightRadioResult(Math.max(idx - 1, 0));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const highlighted = results.querySelector('.rsr-item.highlighted');
    if (highlighted) selectRadioResult(highlighted.dataset.id);
    // If only one result, select it directly
    else if (items.length === 1) selectRadioResult(items[0].dataset.id);
  } else if (e.key === 'Escape') {
    results.style.display = 'none';
  }
}

function highlightRadioResult(idx) {
  const results = document.getElementById('radio-search-results');
  results.querySelectorAll('.rsr-item').forEach(el => el.classList.remove('highlighted'));
  const target = results.querySelector(`.rsr-item[data-idx="${idx}"]`);
  if (target) target.classList.add('highlighted');
}

function selectRadioResult(id) {
  const r = radios.find(x => x.id === id); if (!r) return;
  const name = r.custom_fields?.radio_name || '';
  document.getElementById('tf-radio').value = id;
  document.getElementById('tf-radio-search').value = id + (name ? ' — ' + name : '');
  document.getElementById('radio-search-results').style.display = 'none';
  const wrap = document.getElementById('radio-search-wrap');
  let clearBtn = wrap.querySelector('.radio-search-clear');
  if (!clearBtn) {
    clearBtn = document.createElement('button');
    clearBtn.className = 'radio-search-clear';
    clearBtn.title = 'Clear';
    clearBtn.textContent = '✕';
    clearBtn.onclick = clearRadioSearch;
    wrap.appendChild(clearBtn);
  }
  clearBtn.style.display = '';
  _radioSearchSelected = true;
}

function clearRadioSearch() {
  document.getElementById('tf-radio').value = '';
  document.getElementById('tf-radio-search').value = '';
  document.getElementById('radio-search-results').style.display = 'none';
  const clearBtn = document.querySelector('.radio-search-clear');
  if (clearBtn) clearBtn.style.display = 'none';
  document.getElementById('tf-radio-search')?.focus();
}

// ── SAVE ──
async function saveTicket(editId) {
  const title = document.getElementById('tf-title')?.value.trim();
  if (!title) { alert('Title is required.'); return; }
  const record = {
    title,
    description:    document.getElementById('tf-desc')?.value.trim() || null,
    status:         document.getElementById('tf-status')?.value,
    priority:       document.getElementById('tf-priority')?.value,
    radio_id:       document.getElementById('tf-radio')?.value || null,
    technician:     document.getElementById('tf-tech')?.value.trim() || null,
    est_completion: document.getElementById('tf-date')?.value || null,
  };
  toast('Saving…', 'syncing', 10000);
  if (editId) {
    const { error } = await sb.from('tickets').update(record).eq('id', editId); // [DATA LAYER]
    if (error) { toast('Save failed: ' + error.message, 'err'); return; }
    const idx = tickets.findIndex(t => t.id === editId);
    if (idx > -1) tickets[idx] = { ...tickets[idx], ...record, updated_at: new Date().toISOString() };
    addLog('edit', `Ticket <strong>${editId}</strong> updated`);
    toast('✓ Saved', 'ok');
  } else {
    const id = await generateTicketId();
    const { error } = await sb.from('tickets').insert({ id, ...record }); // [DATA LAYER]
    if (error) { toast('Create failed: ' + error.message, 'err'); return; }
    tickets.unshift({ id, ...record, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    addLog('add', `Ticket <strong>${id}</strong> created — ${title}`);
    toast('✓ Ticket created', 'ok');
  }
  closeModal();
  renderTickets();
}

// ── QUICK STATUS ──
async function quickSetStatus(id, status) {
  const { error } = await sb.from('tickets').update({ status }).eq('id', id); // [DATA LAYER]
  if (error) { toast('Failed: ' + error.message, 'err'); return; }
  const t = tickets.find(x => x.id === id);
  if (t) { t.status = status; t.updated_at = new Date().toISOString(); }
  addLog('edit', `Ticket <strong>${id}</strong> → ${status}`);
  toast('✓ ' + status, 'ok');
  closeModal();
  renderTickets();
}

// ── DELETE ──
async function deleteTicket(id) {
  if (!confirm(`Delete ticket ${id}? This cannot be undone.`)) return;
  toast('Deleting…', 'syncing', 10000);
  const { error } = await sb.from('tickets').delete().eq('id', id); // [DATA LAYER]
  if (error) { toast('Delete failed: ' + error.message, 'err'); return; }
  tickets = tickets.filter(t => t.id !== id);
  addLog('delete', `Ticket <strong>${id}</strong> deleted`);
  toast('✓ Deleted', 'ok');
  renderTickets();
}
