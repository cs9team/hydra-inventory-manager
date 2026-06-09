// ── UI UTILITIES ──
// Toast notifications, status bar, modal open/close, screen navigation, theme toggle.
// Also contains shared field helpers used across modules.

// ── AUTH ──
function checkAuth() {
  if (DEV_MODE) {
    currentUser = DEV_USER;
    showApp();
    return;
  }
  if (currentUser) {
    showApp();
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('main').style.display = 'none';
    setTimeout(() => document.getElementById('login-name')?.focus(), 100);
  }
}

function submitLogin() {
  const name = (document.getElementById('login-name')?.value || '').trim();
  const pass = (document.getElementById('login-pass')?.value || '').trim();
  const errEl = document.getElementById('login-error');

  if (!name) {
    document.getElementById('login-name').focus();
    document.getElementById('login-name').style.borderColor = 'var(--red)';
    return;
  }
  if (pass !== UNIT_PASSWORD) {
    errEl.style.display = 'block';
    document.getElementById('login-pass').value = '';
    document.getElementById('login-pass').focus();
    document.getElementById('login-pass').style.borderColor = 'var(--red)';
    return;
  }

  currentUser = name;
  sessionStorage.setItem('hydra-user', name);
  showApp();
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main').style.display = '';

  // Show user in sidebar
  const sbUser = document.getElementById('sb-user');
  const sbName = document.getElementById('sb-user-name');
  if (sbUser) sbUser.style.display = 'flex';
  if (sbName) sbName.textContent = currentUser;
}

function logout() {
  currentUser = null;
  sessionStorage.removeItem('hydra-user');
  document.getElementById('login-name').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('login-name').style.borderColor = '';
  document.getElementById('login-pass').style.borderColor = '';
  document.getElementById('sb-user').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('main').style.display = 'none';
  setTimeout(() => document.getElementById('login-name')?.focus(), 100);
}

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

// ── FIELD VALUE PILLS ──
function strToHue(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function fieldPill(value, field) {
  if (!value) return '<span class="fv-empty">—</span>';
  if (!field || field.type !== 'select') return value;
  const hue = strToHue(String(value));
  return `<span class="fv-pill" style="--ph:${hue}">${value}</span>`;
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
  document.getElementById('actlog-btn')?.classList.toggle('active', name === 'actlog');
  if (name === 'dashboard') refreshDashboard();
  if (name === 'inventory') renderTable();
  if (name === 'settings') renderFieldDefs();
  if (name === 'audits') renderAuditCards();
  if (name === 'tickets') renderTickets();
  if (name === 'actlog') renderActivityLog();
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
