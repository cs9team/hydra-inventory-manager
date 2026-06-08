// ── DASHBOARD ──
// Stat cards refresh and activity log rendering.

// ── TIME HELPER ──
function fmtTime(iso) {
  const d = new Date(iso), now = new Date(), diff = (now - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── ACTIVITY LOG ──
function addLog(type, msg) {
  activityLog.unshift({ type, msg, ts: new Date().toISOString() });
  if (activityLog.length > 300) activityLog = activityLog.slice(0, 300);
  sb.from('activity_log').insert({ type, msg }); // [DATA LAYER]
}

function renderLogList(id, limit) {
  const el = document.getElementById(id); if (!el) return;
  const items = limit ? activityLog.slice(0, limit) : activityLog;
  if (!items.length) { el.innerHTML = '<div class="log-empty">No activity yet</div>'; return; }
  const labels = { add: 'ADD', edit: 'EDIT', delete: 'DEL', audit: 'AUDIT', settings: 'CFG' };
  el.innerHTML = items.map(e => `
    <div class="log-entry">
      <div class="log-dot ${e.type}"></div>
      <div class="log-body">
        <div class="log-msg">${e.msg} <span class="log-tag ${e.type}">${labels[e.type] || e.type.toUpperCase()}</span></div>
        <div class="log-time">${fmtTime(e.ts)}</div>
      </div>
    </div>`).join('');
}

function showFullLog() {
  const b = document.getElementById('full-log-box');
  if (b) { b.style.display = 'block'; renderLogList('log-list-full', 0); }
}

function clearLog() {
  if (!confirm('Clear the full activity log?')) return;
  activityLog = [];
  sb.from('activity_log').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // [DATA LAYER]
  renderLogList('log-list-full', 0); renderLogList('log-list-preview', 8);
}

// ── DASHBOARD STATS ──
function refreshDashboard() {
  const total = radios.length;
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const interval = (appSettings.auditInterval || 90) * 24 * 60 * 60 * 1000;
  const recent = radios.filter(r => r.lastAudited && (now - new Date(r.lastAudited).getTime()) < thirtyDays).length;
  const overdue = radios.filter(r => r.lastAudited && (now - new Date(r.lastAudited).getTime()) > interval).length;
  const never = radios.filter(r => !r.lastAudited).length;

  document.getElementById('stat-total').textContent = total || '—';
  document.getElementById('stat-op').textContent = recent || '—';
  document.getElementById('stat-maint').textContent = overdue || '—';
  document.getElementById('stat-missing').textContent = never || '—';

  renderLogList('log-list-preview', 8);
  const vlb = document.getElementById('view-full-log');
  if (vlb) vlb.style.display = activityLog.length > 8 ? 'block' : 'none';
}
