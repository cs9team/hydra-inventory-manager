// ── DATA LAYER CONFIG ──
// To switch from Supabase to JSON file mode in the future:
// 1. Replace SUPA_URL / SUPA_KEY / sb with a JSON adapter in this file
// 2. Update init.js to call your JSON loader instead of Supabase queries
// 3. Update each write call (insert/update/delete) in the module files
//    All write calls are tagged with: // [DATA LAYER]

const SUPA_URL = 'https://vndrawpdsoqrcibsvtea.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZuZHJhd3Bkc29xcmNpYnN2dGVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3ODYyNjMsImV4cCI6MjA5NjM2MjI2M30.F55VsuJ9BjtW7dNE4wT_qS5i_5dzChU9WBsOgP0RBZk';
const sb = supabase.createClient(SUPA_URL, SUPA_KEY);

// ── APP STATE ──
// All mutable state lives here so every module can read/write it.
// Modules should not declare their own top-level state variables.

let radios = [];          // [{id, lid, lastAudited, custom_fields:{...}}]
let fieldDefs = [];       // [{id, key, label, type, options, required, ord}]
let appSettings = { auditInterval: 90, unitName: '' };
let activityLog = [];
let audits = [];
let activeAudit = null;
let viewingAuditId = null;
let sortField = 'id', sortDir = 1;
let editingId = null;
let modalSaveFn = null;
let pendingImport = null; // parsed CSV rows awaiting confirmation
