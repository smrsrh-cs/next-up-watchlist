// server.js - Simple Express backend for Next-Up Watchlist Tracker
const express = require('express');
const cors = require('cors');
const path = require('node:path');
const db = require('./database.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// GET: Fetch all watchlist items
app.get('/api/watchlist', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM watchlist ORDER BY created_at DESC').all();
    const items = rows.map(r => ({
      ...r,
      current_ep: r.current_episode !== undefined ? r.current_episode : (r.current_ep || 0),
      total_ep: r.total_episodes !== undefined ? r.total_episodes : (r.total_ep || 1)
    }));
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST: Add new movie or TV show
app.post('/api/watchlist', (req, res) => {
  try {
    const { title, type = 'movie', current_ep, current_episode, total_ep, total_episodes, status = 'plan' } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const curEp = parseInt(current_ep !== undefined ? current_ep : current_episode) || 0;
    const totEp = parseInt(total_ep !== undefined ? total_ep : total_episodes) || (type === 'movie' ? 1 : 10);

    const stmt = db.prepare(`
      INSERT INTO watchlist (title, type, current_episode, total_episodes, status)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(title.trim(), type, curEp, totEp, status);
    const newItem = db.prepare('SELECT * FROM watchlist WHERE id = ?').get(result.lastInsertRowid);
    newItem.current_ep = newItem.current_episode;
    newItem.total_ep = newItem.total_episodes;

    res.status(201).json({ success: true, data: newItem });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH: Update episode progress or status
app.patch('/api/watchlist/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { current_ep, current_episode, status } = req.body;
    const item = db.prepare('SELECT * FROM watchlist WHERE id = ?').get(id);

    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    let nextEp = item.current_episode || 0;
    let nextStatus = item.status;

    const requestedEp = current_ep !== undefined ? current_ep : current_episode;
    if (typeof requestedEp === 'number') {
      const maxEp = item.total_episodes || 1;
      nextEp = Math.max(0, Math.min(requestedEp, maxEp));
      if (nextEp >= maxEp && maxEp > 0) {
        nextStatus = 'completed';
      } else if (nextEp > 0 && nextStatus === 'plan') {
        nextStatus = 'watching';
      }
    }

    if (status) {
      nextStatus = status;
      if (status === 'completed') nextEp = item.total_episodes || 1;
    }

    db.prepare(`
      UPDATE watchlist SET current_episode = ?, status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(nextEp, nextStatus, id);

    const updated = db.prepare('SELECT * FROM watchlist WHERE id = ?').get(id);
    updated.current_ep = updated.current_episode;
    updated.total_ep = updated.total_episodes;

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE: Remove item from watchlist
app.delete('/api/watchlist/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM watchlist WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start server with port fallback if port is in use
function start(port) {
  const server = app.listen(port, () => {
    console.log(`\n===============================================`);
    console.log(`🎬 Next-Up Watchlist Tracker running at http://localhost:${port}`);
    console.log(`===============================================\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} in use, trying ${port + 1}...`);
      start(port + 1);
    }
  });
}

start(PORT);
