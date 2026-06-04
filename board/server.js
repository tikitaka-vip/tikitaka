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
const VALID_ROLES = ['po', 'builder', 'growth', 'unassigned'];
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

  CREATE INDEX IF NOT EXISTS idx_tasks_role_status ON tasks(role, status);
  CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);
`);

// --- Auth middleware ---

function authAgent(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const key = authHeader.replace('Bearer ', '');
  const role = Object.entries(AGENT_KEYS).find(([, v]) => v === key);
  if (!role) return res.status(401).json({ error: 'Invalid API key' });
  req.agentRole = role[0];
  next();
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
  if (role === 'growth' && task.role !== 'growth' && !req.body.heartbeat_at) {
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

app.get('/', (req, res) => {
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

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TikiTaka Sprint Board</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 16px; }
  h1 { font-size: 1.5rem; margin-bottom: 4px; }
  .subtitle { color: #94a3b8; font-size: 0.85rem; margin-bottom: 16px; }
  .board { display: flex; gap: 12px; overflow-x: auto; min-height: 60vh; }
  .column { background: #1e293b; border-radius: 8px; min-width: 220px; flex: 1; padding: 8px; }
  .column-header { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 8px; border-radius: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; }
  .card { background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 10px; margin-bottom: 8px; cursor: pointer; transition: border-color 0.15s; }
  .card:hover { border-color: #64748b; }
  .card-id { font-size: 0.7rem; color: #64748b; }
  .card-title { font-size: 0.85rem; font-weight: 500; margin: 4px 0; }
  .card-meta { display: flex; gap: 6px; flex-wrap: wrap; }
  .badge { font-size: 0.65rem; padding: 2px 6px; border-radius: 3px; font-weight: 600; }
  .priority-controls { display: flex; gap: 2px; margin-top: 6px; }
  .priority-controls button { background: #334155; border: none; color: #94a3b8; padding: 2px 8px; border-radius: 3px; cursor: pointer; font-size: 0.75rem; }
  .priority-controls button:hover { background: #475569; color: #e2e8f0; }
  .priority-controls select { background: #334155; border: none; color: #e2e8f0; padding: 2px 4px; border-radius: 3px; font-size: 0.7rem; }
  .modal-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 100; justify-content: center; align-items: flex-start; padding-top: 10vh; }
  .modal-overlay.active { display: flex; }
  .modal { background: #1e293b; border-radius: 12px; padding: 20px; width: 90%; max-width: 600px; max-height: 80vh; overflow-y: auto; }
  .modal h2 { font-size: 1.1rem; margin-bottom: 12px; }
  .modal .desc { color: #94a3b8; font-size: 0.85rem; margin-bottom: 12px; white-space: pre-wrap; }
  .comment { border-left: 3px solid #334155; padding: 6px 10px; margin: 6px 0; font-size: 0.8rem; }
  .comment .meta { color: #64748b; font-size: 0.7rem; }
  .stats { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
  .stat { background: #1e293b; padding: 8px 14px; border-radius: 6px; }
  .stat-val { font-size: 1.2rem; font-weight: 700; }
  .stat-label { font-size: 0.7rem; color: #94a3b8; }
</style>
</head><body>
<h1>TikiTaka Sprint Board</h1>
<div class="subtitle">World Cup 2026 — ${Math.ceil((new Date('2026-06-11') - new Date()) / 86400000)} days to kickoff</div>

<div class="stats">
  ${Object.entries(statusGroups).map(([s, ts]) => ts.length ? `<div class="stat"><div class="stat-val" style="color:${statusColors[s]}">${ts.length}</div><div class="stat-label">${s}</div></div>` : '').join('')}
</div>

<div class="board">
${['ready', 'in_progress', 'review', 'blocked', 'stale', 'backlog', 'done'].map(status => `
  <div class="column">
    <div class="column-header" style="background:${statusColors[status]}22; color:${statusColors[status]}">
      <span>${status.replace('_', ' ')}</span>
      <span>${statusGroups[status]?.length || 0}</span>
    </div>
    ${(statusGroups[status] || []).map(t => `
      <div class="card" onclick="openTask(${t.id})">
        <div class="card-id">#${t.id} ${t.sprint_ref || ''}</div>
        <div class="card-title">${t.title}</div>
        <div class="card-meta">
          <span class="badge" style="background:${roleColors[t.role]}33; color:${roleColors[t.role]}">${t.role}</span>
          <span class="badge" style="background:${t.priority === 'p0' ? '#ef444433' : '#33415533'}; color:${t.priority === 'p0' ? '#ef4444' : '#94a3b8'}">${t.priority}</span>
        </div>
        <div class="priority-controls">
          <select onchange="updateTask(${t.id}, 'priority', this.value); event.stopPropagation()">
            ${VALID_PRIORITIES.map(p => `<option value="${p}" ${p === t.priority ? 'selected' : ''}>${p.toUpperCase()}</option>`).join('')}
          </select>
          <select onchange="updateTask(${t.id}, 'status', this.value); event.stopPropagation()">
            ${VALID_STATUSES.map(s => `<option value="${s}" ${s === t.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
    `).join('')}
  </div>
`).join('')}
</div>

<div class="modal-overlay" id="modal" onclick="if(event.target===this)closeModal()">
  <div class="modal" id="modal-content"></div>
</div>

<script>
const API_KEY = new URLSearchParams(location.search).get('key') || '';

async function apiFetch(url, opts = {}) {
  return fetch(url, { ...opts, headers: { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json', ...opts.headers }});
}

async function openTask(id) {
  const res = await apiFetch('/api/tasks/' + id);
  const t = await res.json();
  const deps = JSON.parse(t.blocked_by || '[]');
  document.getElementById('modal-content').innerHTML = \`
    <h2>#\${t.id}: \${t.title}</h2>
    <div class="card-meta" style="margin-bottom:12px">
      <span class="badge" style="background:#3b82f633;color:#3b82f6">\${t.role}</span>
      <span class="badge" style="background:#f59e0b33;color:#f59e0b">\${t.status}</span>
      <span class="badge">\${t.priority}</span>
    </div>
    \${deps.length ? '<p style="color:#ef4444;font-size:0.8rem">Blocked by: ' + deps.join(', ') + '</p>' : ''}
    <div class="desc">\${t.description || 'No description'}</div>
    <h3 style="font-size:0.9rem;margin:12px 0 6px">Activity</h3>
    \${(t.comments || []).reverse().map(c => \`
      <div class="comment" style="border-color:\${c.type==='blocker'?'#ef4444':c.type==='order'?'#f59e0b':'#334155'}">
        <div class="meta">\${c.type} · \${c.role} · \${c.created_at}</div>
        \${c.content}
      </div>
    \`).join('') || '<p style="color:#64748b;font-size:0.8rem">No activity yet</p>'}
  \`;
  document.getElementById('modal').classList.add('active');
}

function closeModal() { document.getElementById('modal').classList.remove('active'); }

async function updateTask(id, field, value) {
  await apiFetch('/api/tasks/' + id, { method: 'PATCH', body: JSON.stringify({ [field]: value }) });
  location.reload();
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
</script>
</body></html>`;

  res.type('html').send(html);
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Board running on http://127.0.0.1:${PORT}`);
});
