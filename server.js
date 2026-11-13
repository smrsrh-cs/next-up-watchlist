// Express backend for Next-Up Watchlist Tracker.
const express = require('express');
const cors = require('cors');
const path = require('node:path');
const db = require('./database.js');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const statuses = new Set(['plan', 'watching', 'completed']);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function validBody(body) {
  return body !== null && typeof body === 'object' && !Array.isArray(body);
}

function badRequest(res, error) {
  return res.status(400).json({ success: false, error });
}

app.get('/api/watchlist', (req, res) => {
  const items = db.prepare('SELECT * FROM watchlist ORDER BY created_at DESC, id DESC').all();
  res.json({ success: true, data: items });
});

app.post('/api/watchlist', (req, res) => {
  if (!validBody(req.body)) return badRequest(res, 'A JSON object is required');
  const { title, type = 'movie', status = 'plan' } = req.body;
  if (typeof title !== 'string' || !title.trim()) return badRequest(res, 'Title is required');
  if (!['movie', 'show'].includes(type)) return badRequest(res, 'Type must be movie or show');
  if (!statuses.has(status)) return badRequest(res, 'Invalid status');

  let currentEp = req.body.current_ep ?? req.body.current_episode ?? 0;
  const totalEp = req.body.total_ep ?? req.body.total_episodes ?? (type === 'movie' ? 1 : 10);
  if (!Number.isSafeInteger(totalEp) || totalEp < 1 || (type === 'movie' && totalEp !== 1)) {
    return badRequest(res, 'Total episodes must be a positive integer (1 for movies)');
  }
  if (!Number.isSafeInteger(currentEp) || currentEp < 0 || currentEp > totalEp) {
    return badRequest(res, 'Current episode must be an integer between 0 and total episodes');
  }

  let nextStatus = status;
  if (status === 'completed') currentEp = totalEp;
  else if (currentEp === totalEp) nextStatus = 'completed';
  else if (currentEp > 0 && status === 'plan') nextStatus = 'watching';

  const result = db.prepare(`
    INSERT INTO watchlist (title, type, current_ep, total_ep, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(title.trim(), type, currentEp, totalEp, nextStatus);
  const item = db.prepare('SELECT * FROM watchlist WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: item });
});

app.patch('/api/watchlist/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM watchlist WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ success: false, error: 'Item not found' });
  if (!validBody(req.body)) return badRequest(res, 'A JSON object is required');
  const { status } = req.body;
  const requestedEp = req.body.current_ep ?? req.body.current_episode;
  if (requestedEp === undefined && status === undefined) return badRequest(res, 'Provide an episode or status');
  if (status !== undefined && !statuses.has(status)) return badRequest(res, 'Invalid status');
  if (requestedEp !== undefined && !Number.isSafeInteger(requestedEp)) {
    return badRequest(res, 'Current episode must be an integer');
  }

  let nextEp = item.current_ep;
  let nextStatus = item.status;
  if (requestedEp !== undefined) {
    nextEp = Math.max(0, Math.min(requestedEp, item.total_ep));
    if (nextEp === item.total_ep) nextStatus = 'completed';
    else if (nextStatus === 'completed' || (nextEp > 0 && nextStatus === 'plan')) nextStatus = 'watching';
  }
  if (status !== undefined) {
    nextStatus = status;
    if (status === 'completed') nextEp = item.total_ep;
    else if (status === 'plan') nextEp = 0;
    else if (nextEp === item.total_ep) nextEp = Math.max(0, item.total_ep - 1);
  }

  db.prepare('UPDATE watchlist SET current_ep = ?, status = ? WHERE id = ?').run(nextEp, nextStatus, item.id);
  res.json({ success: true, data: db.prepare('SELECT * FROM watchlist WHERE id = ?').get(item.id) });
});

app.delete('/api/watchlist/:id', (req, res) => {
  const result = db.prepare('DELETE FROM watchlist WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ success: false, error: 'Item not found' });
  res.json({ success: true });
});

// Return JSON for API errors so the browser can display the failure.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(err.status).json({ success: false, error: 'Invalid JSON request body' });
  }
  console.error('Request failed:', err);
  res.status(500).json({ success: false, error: 'Unable to save or load the watchlist. Please try again.' });
});

// PORT is numeric: environment variables otherwise turn fallback 3000 into "30001".
function start(port) {
  const server = app.listen(port, () => {
    console.log(`Next-Up Watchlist Tracker running at http://localhost:${server.address().port}`);
  });
  server.on('error', err => {
    if (err.code === 'EADDRINUSE' && port < 65535) {
      console.warn(`Port ${port} in use, trying ${port + 1}...`);
      start(port + 1);
    } else {
      console.error(`Unable to start server: ${err.message}`);
      process.exitCode = 1;
    }
  });
}

if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
  console.error('PORT must be a number between 0 and 65535');
  process.exitCode = 1;
} else {
  start(PORT);
}
