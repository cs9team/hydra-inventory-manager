// ── CSV IMPORT ──
// Drag-and-drop and file-picker CSV import with preview and field auto-creation.

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0]; if (file) readCSVFile(file);
}

function handleCSVFile(e) { const file = e.target.files[0]; if (file) readCSVFile(file); e.target.value = ''; }

function readCSVFile(file) {
  const reader = new FileReader();
  reader.onload = ev => parseCSVPreview(ev.target.result, file.name);
  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  const rows = lines.slice(1).map(line => {
    const cells = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { cells.push(cur); cur = ''; }
      else cur += c;
    }
    cells.push(cur);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (cells[i] || '').trim(); });
    return obj;
  }).filter(r => Object.values(r).some(v => v));
  return { headers, rows };
}

function parseCSVPreview(text, filename) {
  const { headers, rows } = parseCSV(text);
  if (!headers.length || !rows.length) { alert('Could not parse CSV or file is empty.'); return; }
  const idCol = headers[0];
  const otherCols = headers.slice(1);
  const existingKeys = new Set(fieldDefs.map(f => f.key));
  const normalize = s => s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const newCols = otherCols.filter(c => !existingKeys.has(normalize(c)));
  pendingImport = { headers, rows, idCol, otherCols, newCols, filename };

  const previewEl = document.getElementById('import-preview');
  const summaryEl = document.getElementById('import-summary');
  const actionsEl = document.getElementById('import-actions');
  let html = `<div style="margin-bottom:8px;color:var(--text)"><strong>${rows.length}</strong> rows · <strong>${headers.length}</strong> columns · ID column: <span style="color:var(--accent)">${idCol}</span></div>`;
  if (newCols.length) html += `<div style="color:var(--yellow);margin-bottom:8px">⚠ New fields will be created: ${newCols.map(c => `<strong>${c}</strong>`).join(', ')}</div>`;
  html += `<div style="color:var(--text3)">Columns: ${headers.join(' · ')}</div>`;
  html += `<div style="margin-top:8px;color:var(--text3)">First 3 rows:</div>`;
  rows.slice(0, 3).forEach(r => {
    html += `<div style="margin-top:4px;padding:4px 0;border-top:1px solid var(--border)">${headers.map(h => `<span>${h}: <span style="color:var(--text)">${r[h] || '—'}</span></span>`).join(' · ')}</div>`;
  });
  previewEl.innerHTML = html; previewEl.style.display = 'block';
  summaryEl.textContent = `${rows.length} radios · ${newCols.length} new fields`;
  actionsEl.style.display = 'flex';
}

async function confirmImport() {
  if (!pendingImport) return;
  const { headers, rows, idCol, otherCols, newCols } = pendingImport;
  const normalize = s => s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  toast('Importing…', 'syncing', 30000);

  // 1. Create any new field definitions
  for (const col of newCols) {
    const key = normalize(col);
    if (fieldDefs.find(f => f.key === key)) continue;
    const ord = fieldDefs.length;
    const { data, error } = await sb.from('field_definitions').insert({ key, label: col, type: 'text', required: false, ord }).select().single(); // [DATA LAYER]
    if (error) { toast('Field create failed: ' + error.message, 'err'); return; }
    fieldDefs.push(data);
  }

  // 2. Upsert all radios in chunks of 100
  const records = rows.map(r => {
    const id = (r[idCol] || '').trim(); if (!id) return null;
    const custom_fields = {};
    otherCols.forEach(col => { const v = (r[col] || '').trim(); if (v) custom_fields[normalize(col)] = v; });
    return { id, custom_fields };
  }).filter(Boolean);

  let imported = 0;
  for (let i = 0; i < records.length; i += 100) {
    const chunk = records.slice(i, i + 100);
    const { error } = await sb.from('radios').upsert(chunk, { onConflict: 'id' }); // [DATA LAYER]
    if (error) { toast('Import error: ' + error.message, 'err'); return; }
    imported += chunk.length;
  }

  // Update local state
  records.forEach(rec => {
    const idx = radios.findIndex(r => r.id === rec.id);
    if (idx > -1) radios[idx] = { ...radios[idx], ...rec };
    else radios.push({ ...rec, lastAudited: null });
  });

  addLog('settings', `CSV imported — <strong>${imported}</strong> radios, <strong>${newCols.length}</strong> new fields`);
  toast(`✓ Imported ${imported} radios`, 'ok', 4000);
  cancelImport(); renderFieldDefs(); renderTable(); refreshDashboard();
}

function cancelImport() {
  pendingImport = null;
  document.getElementById('import-preview').style.display = 'none';
  document.getElementById('import-actions').style.display = 'none';
}
