const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'board.db');
const PORT = process.env.PORT || 3001;

const AGENT_KEYS = {
  po: process.env.KEY_PO || 'po-key',
  builder: process.env.KEY_BUILDER || 'builder-key',
  growth: process.env.KEY_GROWTH || 'growth-key',
  standup: process.env.KEY_STANDUP || 'standup-key',
};

const VALID_STATUSES = ['backlog', 'ready', 'in_progress', 'review', 'done', 'blocked', 'stale'];
const VALID_PRIORITIES = ['p0', 'p1', 'p2'];
const VALID_ROLES = ['po', 'builder', 'growth', 'growth-content', 'growth-browser', 'unassigned'];
const VALID_COMMENT_TYPES = ['order', 'progress', 'blocker', 'standup', 'system'];

// --- DB setup ---

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    role TEXT DEFAULT 'unassigned',
    priority TEXT DEFAULT 'p1',
    status TEXT DEFAULT 'backlog',
    blocked_by TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    heartbeat_at TEXT DEFAULT NULL,
    sprint_ref TEXT DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id),
    role TEXT NOT NULL,
    type TEXT DEFAULT 'progress',
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER REFERENCES tasks(id),
    version INTEGER DEFAULT 1,
    lang TEXT DEFAULT 'he',
    body_md TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    status TEXT DEFAULT 'draft',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_role_status ON tasks(role, status);
  CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);
  CREATE INDEX IF NOT EXISTS idx_drafts_task ON drafts(task_id);
`);

// --- Auth middleware ---

function authAgent(req, res, next) {
  // Check Bearer token first (agents)
  const authHeader = req.headers.authorization || '';
  const key = authHeader.replace('Bearer ', '');
  const role = Object.entries(AGENT_KEYS).find(([, v]) => v === key);
  if (role) { req.agentRole = role[0]; return next(); }

  // Fall back to cookie auth (operator via UI)
  const cookie = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith('board_auth='));
  if (cookie && cookie.split('=')[1] === makeToken()) {
    req.agentRole = 'po';
    return next();
  }

  return res.status(401).json({ error: 'Invalid API key' });
}

// --- Auto-block enforcement ---

function enforceBlocks() {
  const tasks = db.prepare('SELECT id, blocked_by, status FROM tasks WHERE status != ?').all('done');
  const doneIds = new Set(db.prepare("SELECT id FROM tasks WHERE status = 'done'").pluck().all());

  for (const t of tasks) {
    const deps = JSON.parse(t.blocked_by || '[]');
    if (deps.length === 0) continue;
    const allDone = deps.every(id => doneIds.has(id));
    if (!allDone && t.status !== 'blocked') {
      db.prepare("UPDATE tasks SET status = 'blocked', updated_at = datetime('now') WHERE id = ?").run(t.id);
    } else if (allDone && t.status === 'blocked') {
      db.prepare("UPDATE tasks SET status = 'ready', updated_at = datetime('now') WHERE id = ?").run(t.id);
    }
  }
}

// --- API routes ---

// List tasks (filterable)
app.get('/api/tasks', authAgent, (req, res) => {
  enforceBlocks();
  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];
  if (req.query.role) { sql += ' AND role = ?'; params.push(req.query.role); }
  if (req.query.status) { sql += ' AND status = ?'; params.push(req.query.status); }
  if (req.query.priority) { sql += ' AND priority = ?'; params.push(req.query.priority); }
  sql += " ORDER BY CASE priority WHEN 'p0' THEN 0 WHEN 'p1' THEN 1 WHEN 'p2' THEN 2 END, id";

  const tasks = db.prepare(sql).all(...params);

  // If agent prefers markdown (Accept: text/markdown)
  if (req.headers.accept === 'text/markdown') {
    const md = tasks.map(t => {
      const deps = JSON.parse(t.blocked_by || '[]');
      const depStr = deps.length ? ` | Blocked by: ${deps.join(', ')}` : '';
      return `- **#${t.id}** [${t.status.toUpperCase()}] [${t.priority.toUpperCase()}] ${t.title}${depStr}`;
    }).join('\n');
    return res.type('text/markdown').send(md || 'No tasks found.');
  }

  res.json(tasks);
});

// Get single task with recent comments
app.get('/api/tasks/:id', authAgent, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const comments = db.prepare(
    'SELECT * FROM comments WHERE task_id = ? ORDER BY created_at DESC LIMIT 5'
  ).all(req.params.id);

  if (req.headers.accept === 'text/markdown') {
    const deps = JSON.parse(task.blocked_by || '[]');
    let md = `# Task #${task.id}: ${task.title}\n`;
    md += `Status: ${task.status} | Priority: ${task.priority} | Role: ${task.role}\n`;
    if (deps.length) md += `Blocked by: ${deps.join(', ')}\n`;
    md += `\n${task.description}\n`;
    if (comments.length) {
      md += `\n## Recent activity\n`;
      comments.reverse().forEach(c => {
        md += `- [${c.type}] (${c.role}, ${c.created_at}): ${c.content}\n`;
      });
    }
    return res.type('text/markdown').send(md);
  }

  res.json({ ...task, comments });
});

// Create task (human-seeded, or PO drafts)
app.post('/api/tasks', authAgent, (req, res) => {
  const { title, description, role, priority, status, blocked_by, sprint_ref } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  const effectiveStatus = req.agentRole === 'po' ? 'backlog' : (status || 'backlog');

  const result = db.prepare(`
    INSERT INTO tasks (title, description, role, priority, status, blocked_by, sprint_ref)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    title,
    description || '',
    role || 'unassigned',
    priority || 'p1',
    effectiveStatus,
    JSON.stringify(blocked_by || []),
    sprint_ref || null
  );

  res.status(201).json({ id: result.lastInsertRowid });
});

// Update task
app.patch('/api/tasks/:id', authAgent, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // Role-based restrictions
  const role = req.agentRole;
  if (role === 'builder' && task.role !== 'builder' && !req.body.heartbeat_at) {
    return res.status(403).json({ error: 'Builder can only update builder tasks' });
  }
  if (role === 'growth' && !task.role.startsWith('growth') && !req.body.heartbeat_at) {
    return res.status(403).json({ error: 'Growth can only update growth tasks' });
  }

  const updates = [];
  const params = [];
  const allowed = ['title', 'description', 'role', 'priority', 'status', 'blocked_by', 'heartbeat_at'];

  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      if (field === 'status' && !VALID_STATUSES.includes(req.body[field])) {
        return res.status(400).json({ error: `Invalid status: ${req.body[field]}` });
      }
      if (field === 'blocked_by') {
        updates.push(`${field} = ?`);
        params.push(JSON.stringify(req.body[field]));
      } else {
        updates.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    }
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);

  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  enforceBlocks();

  res.json({ ok: true });
});

// Heartbeat (lightweight)
app.post('/api/tasks/:id/heartbeat', authAgent, (req, res) => {
  db.prepare("UPDATE tasks SET heartbeat_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Add comment
app.post('/api/tasks/:id/comments', authAgent, (req, res) => {
  const { content, type } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });
  const commentType = VALID_COMMENT_TYPES.includes(type) ? type : 'progress';

  db.prepare(`
    INSERT INTO comments (task_id, role, type, content) VALUES (?, ?, ?, ?)
  `).run(req.params.id, req.agentRole, commentType, content);

  res.status(201).json({ ok: true });
});

// Get comments for a task
app.get('/api/tasks/:id/comments', authAgent, (req, res) => {
  const typeFilter = req.query.type;
  let sql = 'SELECT * FROM comments WHERE task_id = ?';
  const params = [req.params.id];
  if (typeFilter) { sql += ' AND type = ?'; params.push(typeFilter); }
  sql += ' ORDER BY created_at DESC LIMIT 20';

  res.json(db.prepare(sql).all(...params));
});

// --- Drafts API ---

app.post('/api/drafts', authAgent, (req, res) => {
  const { task_id, body_md, lang, metadata } = req.body;
  if (!task_id || !body_md) return res.status(400).json({ error: 'task_id and body_md required' });
  const maxVersion = db.prepare('SELECT MAX(version) as v FROM drafts WHERE task_id = ?').get(task_id);
  const version = (maxVersion?.v || 0) + 1;
  const result = db.prepare(`
    INSERT INTO drafts (task_id, version, lang, body_md, metadata, status) VALUES (?, ?, ?, ?, ?, 'draft')
  `).run(task_id, version, lang || 'he', body_md, JSON.stringify(metadata || {}));
  db.prepare("INSERT INTO comments (task_id, role, type, content) VALUES (?, ?, 'progress', ?)").run(
    task_id, req.agentRole, `Draft v${version} ready (draft_id=${result.lastInsertRowid}, lang=${lang || 'he'})`
  );
  res.status(201).json({ draft_id: result.lastInsertRowid, version });
});

app.get('/api/drafts/:id', authAgent, (req, res) => {
  const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(req.params.id);
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  res.json(draft);
});

app.get('/api/tasks/:id/drafts', authAgent, (req, res) => {
  const drafts = db.prepare('SELECT * FROM drafts WHERE task_id = ? ORDER BY version DESC').all(req.params.id);
  res.json(drafts);
});

app.patch('/api/drafts/:id', authAgent, (req, res) => {
  const { status } = req.body;
  if (status) db.prepare("UPDATE drafts SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, req.params.id);
  res.json({ ok: true });
});

// Summary endpoint for standup digest
app.get('/api/summary', authAgent, (req, res) => {
  enforceBlocks();

  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM tasks GROUP BY status
  `).all();

  const byRole = db.prepare(`
    SELECT role, status, COUNT(*) as count FROM tasks GROUP BY role, status
  `).all();

  const stale = db.prepare(`
    SELECT id, title, role, heartbeat_at FROM tasks
    WHERE status = 'in_progress'
    AND heartbeat_at IS NOT NULL
    AND heartbeat_at < datetime('now', '-45 minutes')
  `).all();

  const blocked = db.prepare(`
    SELECT id, title, role, blocked_by FROM tasks WHERE status = 'blocked'
  `).all();

  const recentComments = db.prepare(`
    SELECT c.*, t.title as task_title FROM comments c
    JOIN tasks t ON c.task_id = t.id
    WHERE c.type IN ('blocker', 'progress')
    ORDER BY c.created_at DESC LIMIT 10
  `).all();

  // Mark stale tasks
  for (const s of stale) {
    db.prepare("UPDATE tasks SET status = 'stale', updated_at = datetime('now') WHERE id = ?").run(s.id);
    db.prepare(`
      INSERT INTO comments (task_id, role, type, content)
      VALUES (?, 'system', 'system', 'Task marked stale — no heartbeat for 45+ minutes. Next session should resume or rollback.')
    `).run(s.id);
  }

  if (req.headers.accept === 'text/markdown') {
    let md = '# Board Summary\n\n';
    md += '## Status counts\n';
    byStatus.forEach(r => { md += `- ${r.status}: ${r.count}\n`; });
    md += '\n## By role\n';
    byRole.forEach(r => { md += `- ${r.role}/${r.status}: ${r.count}\n`; });
    if (blocked.length) {
      md += '\n## Blocked tasks\n';
      blocked.forEach(b => { md += `- #${b.id} ${b.title} (${b.role}) — blocked by: ${b.blocked_by}\n`; });
    }
    if (stale.length) {
      md += '\n## STALE tasks (crashed?)\n';
      stale.forEach(s => { md += `- #${s.id} ${s.title} (${s.role}) — last heartbeat: ${s.heartbeat_at}\n`; });
    }
    return res.type('text/markdown').send(md);
  }

  res.json({ byStatus, byRole, stale, blocked, recentComments });
});

// Health check (no auth)
app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// --- Web UI ---

const OPERATOR_PASS = process.env.OPERATOR_PASS || 'changeme';
const COOKIE_SECRET = crypto.randomBytes(32).toString('hex');

function makeToken() {
  return crypto.createHmac('sha256', COOKIE_SECRET).update(OPERATOR_PASS).digest('hex');
}

function authUI(req, res, next) {
  const cookie = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith('board_auth='));
  if (cookie && cookie.split('=')[1] === makeToken()) return next();
  return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Login</title><style>body{background:#0f172a;color:#e2e8f0;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}
form{background:#1e293b;padding:24px;border-radius:8px;text-align:center}input{padding:8px 12px;border-radius:4px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-size:1rem;margin:8px 0}
button{padding:8px 20px;border-radius:4px;border:none;background:#3b82f6;color:#fff;font-size:1rem;cursor:pointer}</style></head>
<body><form method="POST" action="/board/login"><h2>Sprint Board</h2><br><input type="password" name="pass" placeholder="Password" autofocus><br><button>Login</button></form></body></html>`);
}

app.post('/login', (req, res) => {
  if (req.body.pass === OPERATOR_PASS) {
    res.setHeader('Set-Cookie', `board_auth=${makeToken()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
    return res.redirect('/board/');
  }
  res.status(401).send('Wrong password. <a href="/board/">Try again</a>');
});

app.get('/', authUI, (req, res) => {
  enforceBlocks();
  const tasks = db.prepare(`
    SELECT * FROM tasks
    ORDER BY CASE priority WHEN 'p0' THEN 0 WHEN 'p1' THEN 1 WHEN 'p2' THEN 2 END, id
  `).all();

  const statusGroups = {};
  for (const s of VALID_STATUSES) statusGroups[s] = [];
  tasks.forEach(t => {
    if (statusGroups[t.status]) statusGroups[t.status].push(t);
    else statusGroups.backlog.push(t);
  });

  const roleColors = { builder: '#3b82f6', growth: '#10b981', po: '#f59e0b', unassigned: '#6b7280' };
  const statusColors = {
    backlog: '#6b7280', ready: '#3b82f6', in_progress: '#f59e0b',
    review: '#8b5cf6', done: '#10b981', blocked: '#ef4444', stale: '#f97316'
  };

  const allComments = {};
  const commentRows = db.prepare('SELECT * FROM comments ORDER BY created_at DESC').all();
  commentRows.forEach(c => {
    if (!allComments[c.task_id]) allComments[c.task_id] = [];
    allComments[c.task_id].push(c);
  });

  const commentTypeColors = { blocker: '#ef4444', order: '#f59e0b', progress: '#3b82f6', standup: '#8b5cf6', system: '#6b7280' };

  const daysToKickoff = Math.ceil((new Date('2026-06-11') - new Date()) / 86400000);

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TikiTaka Sprint Board</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 12px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 1.3rem; margin-bottom: 2px; }
  .subtitle { color: #94a3b8; font-size: 0.8rem; margin-bottom: 12px; }
  .stats { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
  .stat { background: #1e293b; padding: 6px 10px; border-radius: 6px; text-align: center; }
  .stat-val { font-size: 1.1rem; font-weight: 700; }
  .stat-label { font-size: 0.65rem; color: #94a3b8; }
  .filters { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
  .filter-btn { background: #1e293b; border: 1px solid #334155; color: #94a3b8; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; }
  .filter-btn.active { background: #334155; color: #e2e8f0; border-color: #64748b; }
  .section { margin-bottom: 16px; }
  .section-header { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 0; color: #94a3b8; border-bottom: 1px solid #1e293b; margin-bottom: 6px; display: flex; justify-content: space-between; }
  .task { background: #1e293b; border: 1px solid #334155; border-radius: 8px; margin-bottom: 6px; overflow: hidden; }
  .task-header { padding: 10px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; }
  .task-header:active { background: #334155; }
  .task-id { font-size: 0.7rem; color: #64748b; min-width: 28px; }
  .task-title { font-size: 0.85rem; font-weight: 500; flex: 1; }
  .badge { font-size: 0.6rem; padding: 2px 5px; border-radius: 3px; font-weight: 600; white-space: nowrap; }
  .task-body { display: none; padding: 0 12px 12px; border-top: 1px solid #334155; }
  .task-body.open { display: block; padding-top: 10px; }
  .desc { color: #94a3b8; font-size: 0.8rem; margin-bottom: 10px; white-space: pre-wrap; line-height: 1.4; }
  .controls { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
  .controls select { background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 4px 6px; border-radius: 4px; font-size: 0.75rem; }
  .deps { color: #ef4444; font-size: 0.75rem; margin-bottom: 8px; }
  .comment { border-left: 3px solid #334155; padding: 4px 8px; margin: 4px 0; font-size: 0.78rem; line-height: 1.3; }
  .comment .meta { color: #64748b; font-size: 0.65rem; margin-bottom: 2px; }
  .comment-form { display: flex; gap: 6px; margin-top: 8px; }
  .comment-form textarea { flex: 1; background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 6px 8px; border-radius: 4px; font-size: 0.8rem; font-family: inherit; resize: vertical; min-height: 36px; }
  .comment-form button { background: #3b82f6; border: none; color: #fff; padding: 6px 12px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; white-space: nowrap; }
  .comment-form button:active { background: #2563eb; }
  .no-comments { color: #475569; font-size: 0.75rem; font-style: italic; }
</style>
</head><body>
<h1>TikiTaka Sprint</h1>
<div class="subtitle">${daysToKickoff} days to World Cup kickoff</div>

<div class="stats">
  ${Object.entries(statusGroups).map(([s, ts]) => ts.length ? `<div class="stat"><div class="stat-val" style="color:${statusColors[s]}">${ts.length}</div><div class="stat-label">${s}</div></div>` : '').join('')}
</div>

<div class="filters">
  <button class="filter-btn active" onclick="filterTasks('all')">All</button>
  <button class="filter-btn" onclick="filterTasks('builder')" style="color:#3b82f6">Builder</button>
  <button class="filter-btn" onclick="filterTasks('growth')" style="color:#10b981">Growth</button>
  <button class="filter-btn" onclick="filterTasks('p0')" style="color:#ef4444">P0 only</button>
</div>

${['in_progress', 'blocked', 'stale', 'ready', 'review', 'backlog', 'done'].map(status => {
    const sectionTasks = statusGroups[status] || [];
    if (!sectionTasks.length) return '';
    return `
<div class="section" data-status="${status}">
  <div class="section-header">
    <span style="color:${statusColors[status]}">${status.replace('_', ' ')} (${sectionTasks.length})</span>
  </div>
  ${sectionTasks.map(t => {
    const deps = JSON.parse(t.blocked_by || '[]');
    const tc = (allComments[t.id] || []).slice(0, 10);
    return `
  <div class="task" data-role="${t.role}" data-priority="${t.priority}" data-id="${t.id}">
    <div class="task-header" onclick="toggleTask(${t.id})">
      <span class="task-id">#${t.id}</span>
      <span class="task-title">${t.title}</span>
      <span class="badge" style="background:${roleColors[t.role]}33;color:${roleColors[t.role]}">${t.role}</span>
      <span class="badge" style="background:${t.priority === 'p0' ? '#ef444433' : '#33415533'};color:${t.priority === 'p0' ? '#ef4444' : '#94a3b8'}">${t.priority}</span>
    </div>
    <div class="task-body" id="body-${t.id}">
      <div class="desc">${t.description || 'No description.'}</div>
      ${deps.length ? `<div class="deps">Blocked by: ${deps.map(d => '#' + d).join(', ')}</div>` : ''}
      <div class="controls">
        <select onchange="updateTask(${t.id},'priority',this.value)">
          ${VALID_PRIORITIES.map(p => `<option value="${p}" ${p === t.priority ? 'selected' : ''}>${p.toUpperCase()}</option>`).join('')}
        </select>
        <select onchange="updateTask(${t.id},'status',this.value)">
          ${VALID_STATUSES.map(s => `<option value="${s}" ${s === t.status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div id="comments-${t.id}">
        ${tc.length ? tc.map(c => `
        <div class="comment" style="border-color:${commentTypeColors[c.type] || '#334155'}">
          <div class="meta">${c.type} · ${c.role} · ${c.created_at}</div>
          ${c.content}
        </div>`).join('') : '<p class="no-comments">No activity yet</p>'}
      </div>
      <div class="comment-form">
        <textarea id="input-${t.id}" placeholder="Add a comment..." rows="1"></textarea>
        <button onclick="addComment(${t.id})">Send</button>
      </div>
    </div>
  </div>`;
  }).join('')}
</div>`;
  }).join('')}

<script>
function toggleTask(id) {
  const body = document.getElementById('body-' + id);
  body.classList.toggle('open');
}

async function apiFetch(url, opts = {}) {
  return fetch(url, { ...opts, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...opts.headers }});
}

async function updateTask(id, field, value) {
  await apiFetch('/api/tasks/' + id, { method: 'PATCH', body: JSON.stringify({ [field]: value }) });
  location.reload();
}

async function addComment(id) {
  const input = document.getElementById('input-' + id);
  const text = input.value.trim();
  if (!text) return;
  input.disabled = true;
  await apiFetch('/api/tasks/' + id + '/comments', {
    method: 'POST',
    body: JSON.stringify({ type: 'order', content: text })
  });
  location.reload();
}

function filterTasks(filter) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  document.querySelectorAll('.task').forEach(t => {
    const role = t.dataset.role;
    const pri = t.dataset.priority;
    if (filter === 'all') t.style.display = '';
    else if (filter === 'p0') t.style.display = pri === 'p0' ? '' : 'none';
    else t.style.display = role === filter ? '' : 'none';
  });
}
</script>
</body></html>`;

  res.type('html').send(html);
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Board running on http://127.0.0.1:${PORT}`);
});
