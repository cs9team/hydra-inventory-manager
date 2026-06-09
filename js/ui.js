// ── UI UTILITIES ──
// Toast notifications, status bar, modal open/close, screen navigation, theme toggle.
// Also contains shared field helpers used across modules.

// ── TOAST / STATUS ──
function toast(msg, type = 'ok', ms = 2500) {
  const el = document.getElementById('sync-toast');
  el.textContent = msg; el.className = 'show ' + type;
  clearTimeout(el._t); el._t = setTimeout(() => el.className = '', ms);
}

function setStatus(cls, msg) {
  const el = document.getElementById('data-status');
  if (!el) return; el.className = cls; el.textContent = msg;
}

// ── FIELD HELPERS ──
function visibleFields() {
  return [...fieldDefs].sort((a, b) => a.ord - b.ord);
}

function getFieldVal(radio, key) {
  if (key === 'id') return radio.id || '';
  if (key === 'lid') return radio.lid || '';
  if (key === 'lastAudited') return radio.lastAudited ? new Date(radio.lastAudited).toLocaleDateString() : '';
  return (radio.custom_fields && radio.custom_fields[key]) || '';
}

// ── MODAL CORE ──
function modalSaveDispatch() { if (modalSaveFn) modalSaveFn(); }

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  editingId = null; modalSaveFn = null;
  const btn = document.getElementById('modal-save-btn');
  btn.className = 'btn btn-accent';
  btn.style.display = '';
}

// ── SCREEN NAV ──
function showScreen(name, btn) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (name === 'dashboard') refreshDashboard();
  if (name === 'inventory') renderTable();
  if (name === 'settings') renderFieldDefs();
  if (name === 'audits') renderAuditCards();
  if (name === 'tickets') renderTickets();
}

// ── THEME ──
function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  document.getElementById('theme-toggle').textContent = isLight ? '☀️' : '🌙';
  localStorage.setItem('hydra-theme', isLight ? 'light' : 'dark');
}

// Apply saved theme on load
(function () {
  try {
    if (localStorage.getItem('hydra-theme') === 'light') {
      document.body.classList.add('light');
      document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('theme-toggle');
        if (btn) btn.textContent = '☀️';
      });
    }
  } catch (e) { }
})();
