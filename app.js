const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const STORAGE_KEY = 'calorie_tracker_data';
const GOALS_KEY = 'calorie_tracker_goals';

let currentDate = todayStr();
let swipedEntry = null;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(dateStr) {
  const today = todayStr();
  const yesterday = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadData() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadGoals() {
  try { return JSON.parse(localStorage.getItem(GOALS_KEY)) || { calories: 2000, protein: 150 }; }
  catch { return { calories: 2000, protein: 150 }; }
}

function saveGoals(goals) {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

function getEntries(dateStr) {
  const data = loadData();
  return data[dateStr] || [];
}

function addEntry(dateStr, entry) {
  const data = loadData();
  if (!data[dateStr]) data[dateStr] = [];
  entry.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  entry.time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  data[dateStr].push(entry);
  saveData(data);
  saveToRecents(entry);
}

function deleteEntry(dateStr, id) {
  const data = loadData();
  if (data[dateStr]) {
    data[dateStr] = data[dateStr].filter(e => e.id !== id);
    if (data[dateStr].length === 0) delete data[dateStr];
    saveData(data);
  }
}

function saveToRecents(entry) {
  const key = 'calorie_tracker_recents';
  let recents = [];
  try { recents = JSON.parse(localStorage.getItem(key)) || []; } catch {}
  recents = recents.filter(r => r.name.toLowerCase() !== entry.name.toLowerCase());
  recents.unshift({ name: entry.name, calories: entry.calories, protein: entry.protein });
  recents = recents.slice(0, 10);
  localStorage.setItem(key, JSON.stringify(recents));
}

function getRecents() {
  try { return JSON.parse(localStorage.getItem('calorie_tracker_recents')) || []; }
  catch { return []; }
}

function render() {
  const entries = getEntries(currentDate);
  const goals = loadGoals();
  const totalCal = entries.reduce((s, e) => s + e.calories, 0);
  const totalPro = entries.reduce((s, e) => s + e.protein, 0);
  const calPct = Math.min(100, (totalCal / goals.calories) * 100);
  const proPct = Math.min(100, (totalPro / goals.protein) * 100);

  $('#date-label').textContent = formatDate(currentDate);
  $('#total-cal').textContent = totalCal.toLocaleString();
  $('#total-pro').textContent = totalPro + 'g';
  $('#cal-fill').style.width = calPct + '%';
  $('#pro-fill').style.width = proPct + '%';
  $('#cal-fill').style.background = totalCal > goals.calories ? 'var(--orange)' : '';
  $('#cal-goal').textContent = `${totalCal.toLocaleString()} / ${goals.calories.toLocaleString()}`;
  $('#pro-goal').textContent = `${totalPro}g / ${goals.protein}g`;

  const canGoForward = currentDate < todayStr();
  $('#btn-next').style.visibility = canGoForward ? 'visible' : 'hidden';

  const list = $('#entries-list');
  if (entries.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="icon">🍽</div>
        <p>No food logged yet.<br>Tap + to add your first entry.</p>
      </div>`;
    return;
  }

  list.innerHTML = `<div class="section-label">Food Log</div>` +
    entries.slice().reverse().map(e => `
      <div class="entry" data-id="${e.id}">
        <div class="entry-info">
          <div class="entry-name">${esc(e.name)}</div>
          <div class="entry-time">${e.time || ''}</div>
        </div>
        <div class="entry-macros">
          <div class="macro cal">
            <div class="macro-value">${e.calories}</div>
            <div class="macro-label">cal</div>
          </div>
          <div class="macro pro">
            <div class="macro-value">${e.protein}g</div>
            <div class="macro-label">pro</div>
          </div>
        </div>
        <div class="entry-delete">Delete</div>
      </div>
    `).join('');
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function openModal() {
  const overlay = $('#modal-overlay');
  overlay.classList.add('open');
  renderQuickAdds();
  setTimeout(() => $('#input-name').focus(), 300);
}

function closeModal() {
  $('#modal-overlay').classList.remove('open');
  $('#input-name').value = '';
  $('#input-cal').value = '';
  $('#input-pro').value = '';
}

function renderQuickAdds() {
  const recents = getRecents();
  const container = $('#quick-adds');
  if (recents.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';
  container.innerHTML = recents.map(r =>
    `<div class="quick-add" data-name="${esc(r.name)}" data-cal="${r.calories}" data-pro="${r.protein}">
      ${esc(r.name)} <span style="color:var(--text2)">${r.calories}cal</span>
    </div>`
  ).join('');
}

function handleSave() {
  const name = $('#input-name').value.trim();
  const cal = parseInt($('#input-cal').value) || 0;
  const pro = parseInt($('#input-pro').value) || 0;
  if (!name) { $('#input-name').focus(); return; }
  if (cal === 0 && pro === 0) { $('#input-cal').focus(); return; }
  addEntry(currentDate, { name, calories: cal, protein: pro });
  closeModal();
  render();
}

function openGoals() {
  const goals = loadGoals();
  const overlay = $('#goals-overlay');
  $('#goal-cal').value = goals.calories;
  $('#goal-pro').value = goals.protein;
  overlay.classList.add('open');
  setTimeout(() => $('#goal-cal').focus(), 300);
}

function closeGoals() {
  $('#goals-overlay').classList.remove('open');
}

function handleSaveGoals() {
  const cal = parseInt($('#goal-cal').value) || 2000;
  const pro = parseInt($('#goal-pro').value) || 150;
  saveGoals({ calories: cal, protein: pro });
  closeGoals();
  render();
}

// Swipe to delete
let touchStartX = 0;
let touchCurrentX = 0;
let activeEntry = null;

function handleTouchStart(e) {
  const entry = e.target.closest('.entry');
  if (!entry) return;
  if (swipedEntry && swipedEntry !== entry) {
    swipedEntry.classList.remove('swiped');
    swipedEntry = null;
  }
  touchStartX = e.touches[0].clientX;
  activeEntry = entry;
}

function handleTouchMove(e) {
  if (!activeEntry) return;
  touchCurrentX = e.touches[0].clientX;
  const dx = touchStartX - touchCurrentX;
  if (dx > 40) {
    activeEntry.classList.add('swiped');
    swipedEntry = activeEntry;
  } else if (dx < -20 && activeEntry.classList.contains('swiped')) {
    activeEntry.classList.remove('swiped');
    swipedEntry = null;
  }
}

function handleTouchEnd() {
  activeEntry = null;
}

document.addEventListener('DOMContentLoaded', () => {
  render();

  // Navigation
  $('#btn-prev').addEventListener('click', () => { currentDate = shiftDate(currentDate, -1); render(); });
  $('#btn-next').addEventListener('click', () => {
    if (currentDate < todayStr()) { currentDate = shiftDate(currentDate, 1); render(); }
  });

  // Add entry
  $('#add-btn').addEventListener('click', openModal);
  $('#btn-save').addEventListener('click', handleSave);
  $('#btn-cancel').addEventListener('click', closeModal);
  $('#modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });

  // Quick adds
  $('#quick-adds').addEventListener('click', e => {
    const qa = e.target.closest('.quick-add');
    if (!qa) return;
    $('#input-name').value = qa.dataset.name;
    $('#input-cal').value = qa.dataset.cal;
    $('#input-pro').value = qa.dataset.pro;
  });

  // Goals
  $('#goals-btn').addEventListener('click', openGoals);
  $('#btn-save-goals').addEventListener('click', handleSaveGoals);
  $('#btn-cancel-goals').addEventListener('click', closeGoals);
  $('#goals-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeGoals(); });

  // Swipe to delete
  const entriesList = $('#entries-list');
  entriesList.addEventListener('touchstart', handleTouchStart, { passive: true });
  entriesList.addEventListener('touchmove', handleTouchMove, { passive: true });
  entriesList.addEventListener('touchend', handleTouchEnd);

  entriesList.addEventListener('click', e => {
    const delBtn = e.target.closest('.entry-delete');
    if (!delBtn) return;
    const entry = delBtn.closest('.entry');
    const id = entry.dataset.id;
    entry.classList.add('removing');
    setTimeout(() => { deleteEntry(currentDate, id); render(); }, 200);
  });

  // Enter key submits
  $$('#input-name, #input-cal, #input-pro').forEach(input => {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') handleSave(); });
  });

  $$('#goal-cal, #goal-pro').forEach(input => {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') handleSaveGoals(); });
  });

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
