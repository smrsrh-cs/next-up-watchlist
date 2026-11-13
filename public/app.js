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

const errorMessage = document.getElementById('errorMessage');
let saving = false;

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

async function apiRequest(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error('Cannot reach the server. Check that npm start is running, then retry.');
  }
  const result = await res.json();
  if (!res.ok || !result.success) throw new Error(result.error || 'The request failed. Please retry.');
  return result;
}

// 1. Fetch Watchlist from Backend API
async function loadWatchlist() {
  try {
    const result = await apiRequest('/api/watchlist');
    items = result.data;
    renderItems();
    updateTabCounts();
    errorMessage.hidden = true;
  } catch (err) {
    showError(err.message);
  }
}

document.getElementById('retryButton').addEventListener('click', loadWatchlist);

// Prevent duplicate submissions and stale episode changes while a save is pending.
async function saveChange(url, method, body) {
  if (saving) return false;
  saving = true;
  const controls = document.querySelectorAll('#addForm input, #addForm select, #addForm button, .item-controls select, .item-controls button, .ep-btn');
  const previouslyDisabled = Array.from(controls, control => control.disabled);
  controls.forEach(control => { control.disabled = true; });
  try {
    await apiRequest(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    await loadWatchlist();
    return true;
  } catch (err) {
    renderItems();
    showError(err.message);
    return false;
  } finally {
    controls.forEach((control, index) => { control.disabled = previouslyDisabled[index]; });
    saving = false;
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
          <span class="item-tag ${isShow ? 'tag-show' : 'tag-movie'}">${isShow ? 'TV Show' : 'Movie'}</span>
        </div>

        ${isShow ? `
          <div class="item-episodes">
            <span>Episode:</span>
            <span class="ep-count">${item.current_ep} / ${item.total_ep}</span>
            <button class="ep-btn" data-action="dec" title="Previous Episode" ${item.current_ep <= 0 ? 'disabled' : ''}>-</button>
            <button class="ep-btn" data-action="inc" title="Next Episode" ${item.current_ep >= item.total_ep ? 'disabled' : ''}>+</button>
            <div class="ep-bar">
              <div class="ep-bar-fill" style="width: ${percent}%;"></div>
            </div>
          </div>
        ` : ''}
      </div>

      <div class="item-controls">
        <select class="status-dropdown ${item.status}" data-action="status" aria-label="Status for ${escapeHtml(item.title)}">
          <option value="plan" ${item.status === 'plan' ? 'selected' : ''}>Plan</option>
          <option value="watching" ${item.status === 'watching' ? 'selected' : ''}>Watching</option>
          <option value="completed" ${item.status === 'completed' ? 'selected' : ''}>Completed</option>
        </select>
        <button class="delete-btn" data-action="delete" title="Delete title">Delete</button>
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
  const current_ep = type === 'show' ? Number(currentEpInput.value) : 0;
  const total_ep = type === 'show' ? Number(totalEpInput.value) : 1;

  if (current_ep > total_ep) {
    showError('Current episode cannot be greater than total episodes.');
    return;
  }
  if (await saveChange('/api/watchlist', 'POST', { title, type, current_ep, total_ep, status })) {
    titleInput.value = '';
    currentEpInput.value = '0';
  }
});

// Toggle episode inputs when TV Show is selected. Hidden movie fields must not block submission.
function updateEpisodeInputs() {
  const isShow = typeInput.value === 'show';
  episodeRow.style.display = isShow ? 'flex' : 'none';
  currentEpInput.disabled = !isShow;
  totalEpInput.disabled = !isShow;
  currentEpInput.required = isShow;
  totalEpInput.required = isShow;
}
typeInput.addEventListener('change', updateEpisodeInputs);
updateEpisodeInputs();

function updateProgress(id, newEp) {
  return saveChange(`/api/watchlist/${id}`, 'PATCH', { current_ep: newEp });
}

function updateStatus(id, status) {
  return saveChange(`/api/watchlist/${id}`, 'PATCH', { status });
}

function deleteItem(id) {
  return saveChange(`/api/watchlist/${id}`, 'DELETE');
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
