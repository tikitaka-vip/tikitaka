const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(process.env.DB_PATH || path.join(__dirname, 'board.db'));
db.pragma('journal_mode = WAL');

const insert = db.prepare(`
  INSERT INTO tasks (title, description, role, priority, status, blocked_by, sprint_ref)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const tasks = [
  // Builder P0
  { ref: 'B-1', title: 'Onboarding flow for new users', desc: 'First-time visitors need to understand what this is and how to play in <10 seconds. Phase 8.7.', role: 'builder', priority: 'p0' },
  { ref: 'B-2', title: 'Points breakdown per match', desc: 'Show the math: base score, stage multiplier, odds multiplier. Users will ask "why did I get X points?" Phase 4.6.', role: 'builder', priority: 'p0' },
  { ref: 'B-3', title: 'Uptime monitoring', desc: 'UptimeRobot free tier → TG alert. Cannot go down during tournament. Phase 10.1.', role: 'builder', priority: 'p0' },
  { ref: 'B-4', title: 'DB backup cron', desc: 'Daily SQLite backup to /opt/worldcup/backups/. Losing predictions = game over. Phase 10.3.', role: 'builder', priority: 'p0' },
  { ref: 'B-5', title: 'Notification badge for unpredicted matches', desc: 'Show count of matches without predictions. Drive completion rate. Phase 8.9.', role: 'builder', priority: 'p0' },

  // Builder P1
  { ref: 'B-6', title: 'Loading skeleton', desc: 'Show placeholder UI while data fetches. Phase 8.1.', role: 'builder', priority: 'p1' },
  { ref: 'B-7', title: 'Auto-fetch odds daily', desc: 'Cron job to pull odds from The Odds API. Phase 6.5.', role: 'builder', priority: 'p1' },
  { ref: 'B-8', title: 'Edit knockout team names', desc: 'Admin can update bracket as teams advance. Phase 3.10.', role: 'builder', priority: 'p1' },
  { ref: 'B-9', title: 'Graceful error pages', desc: 'Not raw JSON on 500. Phase 10.5.', role: 'builder', priority: 'p1' },
  { ref: 'B-10', title: 'Rate limiting on API endpoints', desc: 'Prevent abuse. Phase 10.4.', role: 'builder', priority: 'p1' },

  // Builder P2
  { ref: 'B-11', title: 'Animated score reveal', desc: 'Phase 8.3. Nice to have.', role: 'builder', priority: 'p2' },
  { ref: 'B-12', title: 'Confetti on exact prediction', desc: 'Phase 8.4. Nice to have.', role: 'builder', priority: 'p2' },
  { ref: 'B-13', title: 'Dark/light theme toggle', desc: 'Phase 8.6. Nice to have.', role: 'builder', priority: 'p2' },

  // Growth P0
  { ref: 'G-1', title: 'WhatsApp status + broadcast', desc: 'Broadcast to all contacts. Phase 11.1.', role: 'growth', priority: 'p0' },
  { ref: 'G-2', title: 'TG channel/group posts', desc: 'Post in personal TG channels and groups. Phase 11.2.', role: 'growth', priority: 'p0' },
  { ref: 'G-3', title: 'Reddit posts', desc: 'r/Israel, r/worldcup, r/soccer, r/football. Hebrew angle. Phase 11.6.', role: 'growth', priority: 'p0' },
  { ref: 'G-4', title: 'Facebook Israeli sports groups', desc: 'Post in major Israeli football groups. Phase 11.7.', role: 'growth', priority: 'p0' },
  { ref: 'G-5', title: 'Follow up forum registrations', desc: 'Check awaiting_admin status on bigsoccer, thefootballforum, milanworld, arsenalmania, spurscommunity, gscimbom, qiumi.', role: 'growth', priority: 'p0' },
  { ref: 'G-6', title: 'Post in all active forums', desc: 'xtratime, forumfoot, talkchelsea, villatalk, redcafe — post prediction game thread.', role: 'growth', priority: 'p0' },
  { ref: 'G-7', title: 'Check directory submissions', desc: 'Verify status of betalist, uneed, launchingnext, aivalley, saashub, ctrlaltcc submissions.', role: 'growth', priority: 'p0' },

  // Growth P1
  { ref: 'G-8', title: 'Shareable prediction card generator', desc: 'Image generator for social sharing. Needs Builder to implement the backend endpoint. Phase 11.12.', role: 'growth', priority: 'p1', blocked_by: [] },
  { ref: 'G-9', title: '"Beat the monkey" social challenge', desc: 'Copy + images for social challenge campaign. Phase 11.11.', role: 'growth', priority: 'p1' },
  { ref: 'G-10', title: 'Short video — app screen recording', desc: 'Screen recording of the app + monkey reveal. Phase 11.17.', role: 'growth', priority: 'p1' },
  { ref: 'G-11', title: 'Meme templates', desc: 'Monkey losing to humans / humans losing to monkey. Phase 11.18.', role: 'growth', priority: 'p1' },
  { ref: 'G-12', title: 'Hebrew blog post about odds system', desc: 'Explain why upset predictions earn more. Phase 11.16.', role: 'growth', priority: 'p1' },

  // Growth P1 communities
  { ref: 'G-13', title: 'Telegram channels — Israeli sports + tech', desc: 'Phase 11.8.', role: 'growth', priority: 'p1' },
  { ref: 'G-14', title: 'Discord — Israeli + football servers', desc: 'Phase 11.9.', role: 'growth', priority: 'p1' },
  { ref: 'G-15', title: 'WhatsApp communities — forward invites', desc: 'Phase 11.10.', role: 'growth', priority: 'p1' },
  { ref: 'G-16', title: 'Instagram story + reel', desc: 'Countdown + monkey hook. Phase 11.3.', role: 'growth', priority: 'p1' },
  { ref: 'G-17', title: 'Twitter/X post Hebrew + English', desc: 'Phase 11.5.', role: 'growth', priority: 'p1' },
];

const insertAll = db.transaction(() => {
  for (const t of tasks) {
    insert.run(
      t.title,
      t.desc,
      t.role,
      t.priority,
      'ready',
      JSON.stringify(t.blocked_by || []),
      t.ref
    );
  }
});

insertAll();
console.log(`Seeded ${tasks.length} tasks.`);

// Set G-8 blocked_by after we know the IDs
// Find the image generator builder task (we'll add it)
const imgTask = db.prepare("SELECT id FROM tasks WHERE sprint_ref = 'B-14'").get();
if (!imgTask) {
  const r = insert.run(
    'Build shareable prediction card API endpoint',
    'API endpoint that generates an image of a user\'s predictions for a given match day. Growth needs this for G-8.',
    'builder', 'p1', 'ready', '[]', 'B-14'
  );
  const builderId = r.lastInsertRowid;
  db.prepare("UPDATE tasks SET blocked_by = ? WHERE sprint_ref = 'G-8'").run(JSON.stringify([builderId]));
  console.log(`Added B-14 (id=${builderId}) and linked G-8 as blocked.`);
}

console.log('Done.');
