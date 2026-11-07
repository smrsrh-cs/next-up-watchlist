/**
 * Next-Up: Movie & TV Show Watchlist Tracker
 * Pure Vanilla JavaScript Client
 */

let items = [];
let activeFilter = 'all';

// DOM Elements
const addForm = document.getElementById('addForm');
const titleInput = document.getElementById('titleInput');
const typeInput = document.getElementById('typeInput');
const episodeRow = document.getElementById('episodeRow');
const currentEpInput = document.getElementById('currentEpInput');
const totalEpInput = document.getElementById('totalEpInput');
const statusInput = document.getElementById('statusInput');
const watchlistContainer = document.getElementById('watchlistContainer');
const emptyState = document.getElementById('emptyState');

// Filter count elements
const countAll = document.getElementById('countAll');
const countMovie = document.getElementById('countMovie');
const countShow = document.getElementById('countShow');
const countWatching = document.getElementById('countWatching');
const countCompleted = document.getElementById('countCompleted');

// 1. Fetch Watchlist from Backend API
async function loadWatchlist() {
  try {
    const res = await fetch('/api/watchlist');
    const data = await res.json();
    if (data.success) {
      items = data.data;
      renderItems();
      updateTabCounts();
    }
  } catch (err) {
    console.error('Error loading watchlist:', err);
  }
}

// 2. Render Cards to DOM
function renderItems() {
  watchlistContainer.innerHTML = '';

  let filtered = items;
  if (activeFilter === 'movie') {
    filtered = items.filter(i => i.type === 'movie');
  } else if (activeFilter === 'show') {
    filtered = items.filter(i => i.type === 'show');
  } else if (activeFilter === 'watching') {
    filtered = items.filter(i => i.status === 'watching');
  } else if (activeFilter === 'completed') {
    filtered = items.filter(i => i.status === 'completed');
  }

  if (filtered.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  filtered.forEach(item => {
    const isShow = item.type === 'show';
    const percent = item.total_ep > 0 ? Math.min(100, Math.round((item.current_ep / item.total_ep) * 100)) : 0;

    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-info">
        <div class="item-title-row">
          <span class="item-title">${escapeHtml(item.title)}</span>
          <span class="item-tag ${isShow ? 'tag-show' : 'tag-movie'}">${isShow ? '📺 TV Show' : '🎬 Movie'}</span>
        </div>

        ${isShow ? `
          <div class="item-episodes">
            <span>Episode:</span>
            <span class="ep-count">${item.current_ep} / ${item.total_ep}</span>
            <button class="ep-btn" data-action="dec" title="Previous Episode">-</button>
            <button class="ep-btn" data-action="inc" title="Next Episode">+</button>
            <div class="ep-bar">
              <div class="ep-bar-fill" style="width: ${percent}%;"></div>
            </div>
          </div>
        ` : ''}
      </div>

      <div class="item-controls">
        <select class="status-dropdown ${item.status}" data-action="status">
          <option value="plan" ${item.status === 'plan' ? 'selected' : ''}>📌 Plan</option>
          <option value="watching" ${item.status === 'watching' ? 'selected' : ''}>🍿 Watching</option>
          <option value="completed" ${item.status === 'completed' ? 'selected' : ''}>✅ Completed</option>
        </select>
        <button class="delete-btn" data-action="delete" title="Delete title">🗑️</button>
      </div>
    `;

    // Increment Episode button
    const incBtn = card.querySelector('[data-action="inc"]');
    if (incBtn) {
      incBtn.addEventListener('click', () => updateProgress(item.id, item.current_ep + 1));
    }

    // Decrement Episode button
    const decBtn = card.querySelector('[data-action="dec"]');
    if (decBtn) {
      decBtn.addEventListener('click', () => updateProgress(item.id, item.current_ep - 1));
    }

    // Change Status dropdown
    const statusSelect = card.querySelector('[data-action="status"]');
    statusSelect.addEventListener('change', (e) => updateStatus(item.id, e.target.value));

    // Delete button
    const deleteBtn = card.querySelector('[data-action="delete"]');
    deleteBtn.addEventListener('click', () => deleteItem(item.id));

    watchlistContainer.appendChild(card);
  });
}

// 3. Add New Title (Submit Form)
addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) return;

  const type = typeInput.value;
  const status = statusInput.value;
  const current_ep = type === 'show' ? parseInt(currentEpInput.value) || 0 : 0;
  const total_ep = type === 'show' ? parseInt(totalEpInput.value) || 10 : 1;

  try {
    const res = await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, type, current_ep, total_ep, status })
    });
    const result = await res.json();
    if (result.success) {
      titleInput.value = '';
      currentEpInput.value = '0';
      await loadWatchlist();
    }
  } catch (err) {
    console.error('Failed to add title:', err);
  }
});

// Toggle episode inputs when TV Show is selected
typeInput.addEventListener('change', () => {
  episodeRow.style.display = typeInput.value === 'show' ? 'flex' : 'none';
});

// 4. Update Episode Progress
async function updateProgress(id, newEp) {
  try {
    const res = await fetch(`/api/watchlist/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_ep: newEp })
    });
    const result = await res.json();
    if (result.success) await loadWatchlist();
  } catch (err) {
    console.error(err);
  }
}

// 5. Update Status
async function updateStatus(id, status) {
  try {
    const res = await fetch(`/api/watchlist/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const result = await res.json();
    if (result.success) await loadWatchlist();
  } catch (err) {
    console.error(err);
  }
}

// 6. Delete Title
async function deleteItem(id) {
  try {
    const res = await fetch(`/api/watchlist/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) await loadWatchlist();
  } catch (err) {
    console.error(err);
  }
}

// 7. Filter Tabs Click Events
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderItems();
  });
});

// Update Badge Counts
function updateTabCounts() {
  countAll.textContent = items.length;
  countMovie.textContent = items.filter(i => i.type === 'movie').length;
  countShow.textContent = items.filter(i => i.type === 'show').length;
  countWatching.textContent = items.filter(i => i.status === 'watching').length;
  countCompleted.textContent = items.filter(i => i.status === 'completed').length;
}

// Utility: Prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', loadWatchlist);
