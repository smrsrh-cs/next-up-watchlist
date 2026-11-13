// SQLite database setup and sample data.
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const dbPath = path.join(__dirname, 'watchlist.db');
const db = new DatabaseSync(dbPath);

// Seed only when first creating the table; an intentionally emptied list stays empty.
const existingTable = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'watchlist'").get();

// Create the watchlist table
db.exec(`
  CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'movie', -- 'movie' or 'show'
    current_ep INTEGER DEFAULT 0,
    total_ep INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'plan', -- 'plan', 'watching', 'completed'
    ai_tag TEXT DEFAULT 'Recommended',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Seed a new database with sample titles.
if (!existingTable) {
  const insert = db.prepare(`
    INSERT INTO watchlist (title, type, current_ep, total_ep, status, ai_tag)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insert.run('Inception', 'movie', 1, 1, 'completed', 'Mind-Bending');
  insert.run('Stranger Things', 'show', 7, 9, 'watching', 'Trending Sci-Fi');
  insert.run('Dune: Part Two', 'movie', 0, 1, 'plan', 'Epic Sci-Fi');
  insert.run('The Bear', 'show', 4, 10, 'watching', 'Award Winner');
}

module.exports = db;
