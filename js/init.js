// ── INIT ──
// Loads all data from Supabase on startup and wires up initial UI state.
// This is the only file that knows the Supabase table schema.
// To switch to JSON mode: replace the Promise.all block with a fetch() of radios.json
// and map the response into the same state variables (radios, fieldDefs, appSettings, etc.)

async function init() {
  setStatus('syncing', 'Connecting…');
  try {
    const [radiosRes, settingsRes, logRes, auditsRes, auditItemsRes, fieldsRes, ticketsRes] = await Promise.all([
      sb.from('radios').select('*').order('id'),
      sb.from('app_settings').select('*').eq('id', 1).single(),
      sb.from('activity_log').select('*').gte('ts', new Date(Date.now() - 30*24*60*60*1000).toISOString()).order('ts', { ascending: false }),
      sb.from('audits').select('*').order('started_at', { ascending: false }),
      sb.from('audit_items').select('*').order('ts', { ascending: false }),
      sb.from('field_definitions').select('*').order('ord'),
      sb.from('tickets').select('*').order('created_at', { ascending: false })
    ]);

    if (radiosRes.error) throw radiosRes.error;
    if (settingsRes.error) throw settingsRes.error;
    if (fieldsRes.error) throw fieldsRes.error;

    // Map DB rows → app state
    fieldDefs = fieldsRes.data || [];
    radios = (radiosRes.data || []).map(r => ({
      id: r.id, lid: r.lid || '', lastAudited: r.last_audited || null,
      custom_fields: r.custom_fields || {}
    }));

    const s = settingsRes.data;
    appSettings = { auditInterval: s.audit_interval || 90, unitName: s.unit_name || '' };

    // Populate settings inputs
    const aiEl = document.getElementById('audit-interval');
    const unEl = document.getElementById('unit-name');
    if (aiEl) aiEl.value = appSettings.auditInterval;
    if (unEl) unEl.value = appSettings.unitName;

    activityLog = (logRes.data || []).map(r => ({ type: r.type, msg: r.msg, ts: r.ts }));

    const allItems = auditItemsRes.data || [];
    audits = (auditsRes.data || []).filter(a => !a.is_active).map(a => ({
      id: a.id, name: a.name, startedAt: a.started_at, closedAt: a.closed_at,
      items: allItems.filter(i => i.audit_id === a.id).map(i => ({ id: i.radio_id, custom_fields: i.custom_fields || {}, ts: i.ts }))
    }));

    const open = (auditsRes.data || []).find(a => a.is_active);
    if (open) activeAudit = {
      id: open.id, name: open.name, startedAt: open.started_at, closedAt: null,
      items: allItems.filter(i => i.audit_id === open.id).map(i => ({ id: i.radio_id, custom_fields: i.custom_fields || {}, ts: i.ts }))
    };

    tickets = (ticketsRes.data || []);

    // Purge log entries older than 30 days
    sb.from('activity_log').delete().lt('ts', new Date(Date.now() - 30*24*60*60*1000).toISOString()); // [DATA LAYER]

    setStatus('connected', `● Live — ${radios.length} radios`);
    renderTable(); renderFieldDefs(); refreshDashboard();
    toast(`✓ Loaded ${radios.length} radios`, 'ok');

  } catch (err) {
    setStatus('error', '✗ Connection failed');
    toast('DB error: ' + err.message, 'err', 6000);
    console.error(err);
  }
}

init();
