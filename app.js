// TimeFlow - Activity Dashboard
// ===================================

// Default category configuration - Tokyo Night colors
const DEFAULT_CATEGORIES = {
  'Writing': {
    color: '#9ece6a',  // Tokyo Night Green
    apps: ['Ulysses', 'iA Writer', 'Scrivener', 'iA Writer.app'],
    isFocused: true
  },
  'Music Creation': {
    color: '#bb9af7',  // Tokyo Night Purple
    apps: ['Logic Pro', 'Logic Pro X', 'Kontakt 7', 'Kontakt 8', 'Native Access', 'Ableton Live', 'GarageBand', 'Spitfire Audio', 'Crow Hill App', 'Audio MIDI Setup', 'MainStage'],
    isFocused: true
  },
  'Browsing': {
    color: '#e0af68',  // Tokyo Night Yellow
    apps: ['Safari', 'Google Chrome', 'Firefox', 'Arc', 'Brave Browser', 'Microsoft Edge'],
    isFocused: false
  },
  'Productivity': {
    color: '#7aa2f7',  // Tokyo Night Blue
    apps: ['Bear.app', 'Bear', 'Obsidian.app', 'Obsidian', 'Notion', 'Logseq.app', 'Logseq', 'Notes.app', 'Notes', 'Drafts.app', 'Drafts', 'Things', 'Reminders', 'Calendar', 'Fantastical', 'OmniFocus'],
    isFocused: false
  },
  'Messaging': {
    color: '#f7768e',  // Tokyo Night Red/Pink
    apps: ['Messages.app', 'Messages', 'Discord', 'Slack', 'Telegram', 'WhatsApp', 'Microsoft Teams'],
    isFocused: false
  },
  'Code': {
    color: '#73daca',  // Tokyo Night Cyan
    apps: ['Sublime Text.app', 'Sublime Text', 'Visual Studio Code', 'Xcode', 'iTerm2', 'Terminal', 'GitHub Desktop', 'Tower', 'Cursor'],
    isFocused: false
  },
  'Email': {
    color: '#f7768e',  // Tokyo Night Red
    apps: ['Mail', 'Spark', 'Airmail', 'Outlook', 'Gmail'],
    isFocused: false
  },
  'Journaling': {
    color: '#9ece6a',  // Tokyo Night Green
    apps: ['Day One.app', 'Day One', 'Journey'],
    isFocused: false
  },
  'Utility': {
    color: '#565f89',  // Tokyo Night Comment
    apps: ['Finder', 'System Settings', 'System Preferences', 'Spotlight', 'Alfred', 'Raycast', 'Shortcuts.app', 'Shortcuts', 'App Store', 'Passwords', 'Keychain Access', '1Password'],
    isFocused: false
  },
  'Entertainment': {
    color: '#ff9e64',  // Tokyo Night Orange
    apps: ['Music', 'Spotify', 'Apple TV', 'Netflix', 'YouTube', 'Podcasts', 'Books'],
    isFocused: false
  },
  'Miscellaneous': {
    color: '#787c99',  // Tokyo Night Muted
    apps: ['JuxtaText', 'Fizzy', 'Breveto.app', 'Preview', 'Photos', 'QuickTime Player'],
    isFocused: false
  }
};

// State
let state = {
  timeSinkData: [],
  balanceData: [],
  categories: {},
  currentPeriod: 'day',
  currentDate: new Date(),
  appToCategory: {},
  selectedCategory: null,  // For filtering by category
  showFocusOverlay: false,  // For showing focus session counts on histogram
  showBreakOverlay: false   // For showing break counts on histogram
};

// IndexedDB Storage
const DB_NAME = 'timeflow_db';
const DB_VERSION = 1;
const STORE_NAME = 'timeflow_store';
const STORAGE_KEY = 'timeflow_data';

let dbPromise = null;

function getDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

async function idbGet(key) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbSet(key, value) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function idbDelete(key) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadFromStorage();
  setupEventListeners();
  updateView();
});

// Storage
function applyStoredData(parsed) {
  if (parsed) {
    // Convert date strings back to Date objects
    state.timeSinkData = (parsed.timeSinkData || []).map(entry => ({
      ...entry,
      start: entry.start ? new Date(entry.start) : null,
      end: entry.end ? new Date(entry.end) : null
    }));
    state.balanceData = (parsed.balanceData || []).map(session => ({
      ...session,
      start: session.start ? new Date(session.start) : null,
      end: session.end ? new Date(session.end) : null
    }));
    state.categories = parsed.categories || { ...DEFAULT_CATEGORIES };
    state.appToCategory = parsed.appToCategory || {};
  } else {
    state.categories = { ...DEFAULT_CATEGORIES };
  }
  buildAppToCategoryMap();
}

async function loadFromStorage() {
  let stored = null;
  let usedLegacyStorage = false;

  try {
    stored = await idbGet(STORAGE_KEY);
  } catch (err) {
    console.warn('IndexedDB unavailable, falling back to localStorage', err);
  }

  if (!stored) {
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (legacy) {
      try {
        stored = JSON.parse(legacy);
        usedLegacyStorage = true;
      } catch (err) {
        console.warn('Failed to parse legacy localStorage data', err);
      }
    }
  }

  if (typeof stored === 'string') {
    try {
      stored = JSON.parse(stored);
    } catch (err) {
      console.warn('Failed to parse stored data', err);
      stored = null;
    }
  }

  applyStoredData(stored);

  if (usedLegacyStorage && stored) {
    try {
      await idbSet(STORAGE_KEY, stored);
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('Failed to migrate legacy storage to IndexedDB', err);
    }
  }
}

async function saveToStorage() {
  const payload = {
    timeSinkData: state.timeSinkData,
    balanceData: state.balanceData,
    categories: state.categories,
    appToCategory: state.appToCategory
  };

  try {
    await idbSet(STORAGE_KEY, payload);
  } catch (err) {
    console.warn('Failed to save to IndexedDB', err);
  }
}

function buildAppToCategoryMap() {
  state.appToCategory = {};
  for (const [category, data] of Object.entries(state.categories)) {
    for (const app of data.apps) {
      state.appToCategory[app] = category;
    }
  }
}

// Event Listeners
function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      switchView(view);
    });
  });

  // Period tabs
  document.querySelectorAll('.period-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.currentPeriod = tab.dataset.period;
      updateDashboard();
    });
  });

  // Date navigation
  document.getElementById('prevPeriod').addEventListener('click', () => navigatePeriod(-1));
  document.getElementById('nextPeriod').addEventListener('click', () => navigatePeriod(1));
  document.getElementById('todayBtn').addEventListener('click', () => {
    state.currentDate = new Date();
    updateDashboard();
  });

  // Import buttons
  document.getElementById('goToImportBtn')?.addEventListener('click', () => switchView('import'));
  document.getElementById('viewDashboardBtn')?.addEventListener('click', () => switchView('dashboard'));

  // File uploads
  setupFileUpload('timesinkDropZone', 'timesinkFile', 'timesink');
  setupFileUpload('balanceDropZone', 'balanceFile', 'balance');

  // Clear data
  document.getElementById('clearDataBtn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      await idbDelete(STORAGE_KEY);
      state.timeSinkData = [];
      state.balanceData = [];
      state.categories = { ...DEFAULT_CATEGORIES };
      buildAppToCategoryMap();
      updateView();
    }
  });

  // Category management
  document.getElementById('addCategoryBtn')?.addEventListener('click', () => {
    document.getElementById('newCategoryModal').classList.remove('hidden');
  });

  document.getElementById('closeNewCategoryModal')?.addEventListener('click', () => {
    document.getElementById('newCategoryModal').classList.add('hidden');
  });

  document.getElementById('createCategoryBtn')?.addEventListener('click', createNewCategory);

  document.getElementById('saveCategoriesBtn')?.addEventListener('click', () => {
    saveToStorage();
    alert('Categories saved!');
  });

  document.getElementById('closeCategoryModal')?.addEventListener('click', () => {
    document.getElementById('categoryModal').classList.add('hidden');
  });

  // Export
  document.getElementById('exportJSON')?.addEventListener('click', exportJSON);
  document.getElementById('exportCSV')?.addEventListener('click', exportCSV);
  document.getElementById('exportHTML')?.addEventListener('click', exportHTML);

  // Session overlay toggle
  document.getElementById('focusSessionsCount')?.addEventListener('click', () => {
    state.showFocusOverlay = !state.showFocusOverlay;
    if (state.showFocusOverlay) state.showBreakOverlay = false; // Only one at a time
    document.getElementById('focusSessionsCount').classList.toggle('active', state.showFocusOverlay);
    document.getElementById('breakSessionsCount').classList.remove('active');
    updateDashboard();
  });
  
  document.getElementById('breakSessionsCount')?.addEventListener('click', () => {
    state.showBreakOverlay = !state.showBreakOverlay;
    if (state.showBreakOverlay) state.showFocusOverlay = false; // Only one at a time
    document.getElementById('breakSessionsCount').classList.toggle('active', state.showBreakOverlay);
    document.getElementById('focusSessionsCount').classList.remove('active');
    updateDashboard();
  });
}

function setupFileUpload(dropZoneId, inputId, type) {
  const dropZone = document.getElementById(dropZoneId);
  const input = document.getElementById(inputId);

  if (!dropZone || !input) return;

  dropZone.addEventListener('click', () => input.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file, type);
  });

  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file, type);
  });
}

function handleFile(file, type) {
  const statusEl = document.getElementById(`${type}Status`);
  const dropZone = document.getElementById(`${type}DropZone`);

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target.result;
      if (type === 'timesink') {
        state.timeSinkData = parseTimeSinkCSV(content);
        statusEl.textContent = `✓ Loaded ${state.timeSinkData.length} entries`;
      } else {
        state.balanceData = parseBalanceCSV(content);
        statusEl.textContent = `✓ Loaded ${state.balanceData.length} sessions`;
      }
      statusEl.className = 'import-status success';
      dropZone.classList.add('success');
      saveToStorage();
      updateImportSummary();
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
      statusEl.className = 'import-status error';
    }
  };
  reader.readAsText(file);
}

// CSV Parsing
function parseTimeSinkCSV(content) {
  const lines = content.trim().split('\n');
  const entries = [];
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Parse CSV with comma handling
    const values = parseCSVLine(line);
    
    const [pool, app, window, fgBegin, fgEnd, totalBegin, totalEnd] = values;
    
    // Skip entries without foreground time or without app name
    if (!app || !fgBegin || fgBegin === '0,00' || fgBegin === '0.00') continue;
    
    // Parse European number format timestamps
    const startTs = parseEuropeanNumber(fgBegin);
    const endTs = parseEuropeanNumber(fgEnd);
    
    if (startTs && endTs && startTs > 0 && endTs > 0) {
      entries.push({
        app: app.replace('.app', '').trim(),
        start: new Date(startTs * 1000),
        end: new Date(endTs * 1000),
        duration: (endTs - startTs) * 1000 // in ms
      });
    }
  }
  
  // Sort by start time
  entries.sort((a, b) => a.start - b.start);
  
  // Deduplicate entries with same app and overlapping times
  const deduped = [];
  for (const entry of entries) {
    const last = deduped[deduped.length - 1];
    if (last && last.app === entry.app && 
        Math.abs(last.start.getTime() - entry.start.getTime()) < 1000) {
      // Skip duplicate
      continue;
    }
    deduped.push(entry);
  }
  
  return deduped;
}

function parseBalanceCSV(content) {
  const lines = content.trim().split('\n');
  const sessions = [];
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const values = parseCSVLine(line);
    const [start, end, workspace, category, tags, notes, isFocus, duration, activeDuration] = values;
    
    if (!start || !end) continue;
    
    sessions.push({
      start: parseEuropeanDate(start),
      end: parseEuropeanDate(end),
      workspace: workspace || '',
      category: category || '',
      tags: tags || '',
      notes: notes || '',
      isFocus: isFocus === 'Y',
      duration: parseDuration(duration),
      activeDuration: parseDuration(activeDuration)
    });
  }
  
  return sessions;
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  
  return values;
}

function parseEuropeanNumber(str) {
  if (!str) return null;
  // Convert "1.768.378.261,44" to 1768378261.44
  const cleaned = str.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned);
}

function parseEuropeanDate(str) {
  if (!str) return null;
  // Parse "14.1.2026, 10:42"
  const match = str.match(/(\d+)\.(\d+)\.(\d+),?\s*(\d+):(\d+)/);
  if (!match) return null;
  
  const [, day, month, year, hour, minute] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
}

function parseDuration(str) {
  if (!str) return 0;
  // Parse "1:21" format
  const match = str.match(/(\d+):(\d+)/);
  if (!match) return 0;
  
  return (parseInt(match[1]) * 60 + parseInt(match[2])) * 60 * 1000; // ms
}

// View Management
function switchView(view) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view);
  });
  
  document.querySelectorAll('.view-section').forEach(section => {
    section.classList.add('hidden');
  });
  
  const viewMap = {
    'dashboard': 'dashboardView',
    'categories': 'categoriesView',
    'import': 'importView',
    'export': 'exportView'
  };
  
  document.getElementById(viewMap[view])?.classList.remove('hidden');
  
  if (view === 'dashboard') updateDashboard();
  if (view === 'categories') updateCategoriesEditor();
  if (view === 'import') updateImportSummary();
}

function updateView() {
  const hasData = state.timeSinkData.length > 0 || state.balanceData.length > 0;
  
  document.getElementById('noDataState').style.display = hasData ? 'none' : 'flex';
  document.getElementById('dashboardContent').style.display = hasData ? 'block' : 'none';
  
  if (hasData) {
    updateDashboard();
  }
}

// Dashboard
function updateDashboard() {
  const { start, end, label } = getPeriodRange();
  document.getElementById('dateDisplay').textContent = label;
  
  // Filter data for current period (with null checks)
  const filteredData = state.timeSinkData.filter(entry => 
    entry.start && entry.start >= start && entry.start < end
  );
  
  const filteredProjects = state.balanceData.filter(session =>
    session.start && session.start >= start && session.start < end
  );
  
  // Count focus sessions and breaks from Balance
  const focusSessions = filteredProjects.filter(s => s.isFocus);
  const breakSessions = filteredProjects.filter(s => !s.isFocus);
  
  // Aggregate by app
  const appTotals = {};
  const categoryTotals = {};
  let totalTime = 0;
  let focusedTime = 0;
  
  for (const entry of filteredData) {
    const app = entry.app;
    const duration = entry.duration;
    
    appTotals[app] = (appTotals[app] || 0) + duration;
    totalTime += duration;
    
    const category = getAppCategory(app);
    categoryTotals[category] = (categoryTotals[category] || 0) + duration;
    
    if (state.categories[category]?.isFocused) {
      focusedTime += duration;
    }
  }
  
  // Update timeline/histogram
  updateChart(filteredData, filteredProjects, start, end);
  
  // Update pie chart
  updatePieChart(categoryTotals, totalTime, focusedTime);
  
  // Update session counts
  updateSessionCounts(focusSessions.length, breakSessions.length);
  
  // Update category list
  updateCategoryList(categoryTotals, totalTime);
  
  // Update app list
  updateAppList(appTotals, totalTime);
  
  // Update projects section
  updateProjectsList(filteredProjects);
}

function updateSessionCounts(focusCount, breakCount) {
  const focusEl = document.querySelector('#focusSessionsCount .session-number');
  const breakEl = document.querySelector('#breakSessionsCount .session-number');
  
  if (focusEl) focusEl.textContent = focusCount;
  if (breakEl) breakEl.textContent = breakCount;
  
  // Show/hide session counts section based on whether we have Balance data
  const sessionCountsEl = document.getElementById('sessionCounts');
  if (sessionCountsEl) {
    sessionCountsEl.style.display = (focusCount > 0 || breakCount > 0) ? 'flex' : 'none';
  }
}

function getPeriodRange() {
  const date = state.currentDate;
  let start, end, label;
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  switch (state.currentPeriod) {
    case 'day':
      start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      label = `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
      break;
      
    case 'week':
      const dayOfWeek = date.getDay();
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - dayOfWeek);
      weekStart.setHours(0, 0, 0, 0);
      start = weekStart;
      end = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      const weekNum = getWeekNumber(date);
      label = `Week ${weekNum} - ${monthNames[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`;
      break;
      
    case 'month':
      start = new Date(date.getFullYear(), date.getMonth(), 1);
      end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      label = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      break;
      
    case 'year':
      start = new Date(date.getFullYear(), 0, 1);
      end = new Date(date.getFullYear() + 1, 0, 1);
      label = `${date.getFullYear()}`;
      break;
  }
  
  return { start, end, label };
}

function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function navigatePeriod(direction) {
  const date = state.currentDate;
  
  switch (state.currentPeriod) {
    case 'day':
      date.setDate(date.getDate() + direction);
      break;
    case 'week':
      date.setDate(date.getDate() + direction * 7);
      break;
    case 'month':
      date.setMonth(date.getMonth() + direction);
      break;
    case 'year':
      date.setFullYear(date.getFullYear() + direction);
      break;
  }
  
  state.currentDate = date;
  updateDashboard();
}

function getAppCategory(app) {
  // Check direct mapping first
  if (state.appToCategory[app]) {
    return state.appToCategory[app];
  }
  
  // Check if app (with or without .app) is in any category
  for (const [category, data] of Object.entries(state.categories)) {
    if (data.apps.includes(app) || data.apps.includes(app + '.app')) {
      return category;
    }
  }
  
  return 'Miscellaneous';
}

// Chart Updates
function updateChart(data, balanceSessions, start, end) {
  const timelineContainer = document.getElementById('timelineContainer');
  const histogramContainer = document.getElementById('histogramContainer');
  const focusTrackContainer = document.getElementById('focusTrackContainer');
  const chartTitle = document.getElementById('chartTitle');
  
  const filterLabel = state.selectedCategory ? ` — ${state.selectedCategory}` : '';
  
  if (state.currentPeriod === 'day') {
    timelineContainer.style.display = 'block';
    histogramContainer.style.display = 'none';
    focusTrackContainer.style.display = balanceSessions.length > 0 ? 'flex' : 'none';
    chartTitle.textContent = 'Timeline' + filterLabel;
    
    // Calculate shared time range for both tracks
    const timeRange = calculateDayTimeRange(data, balanceSessions, start);
    updateFocusTrack(balanceSessions, timeRange);
    updateTimeline(data, start, end, timeRange);
  } else {
    timelineContainer.style.display = 'none';
    histogramContainer.style.display = 'block';
    focusTrackContainer.style.display = 'none';
    chartTitle.textContent = 'Activity' + filterLabel;
    updateHistogram(data, balanceSessions, start, end);
  }
}

// Calculate shared time range for day view
function calculateDayTimeRange(timeSinkData, balanceSessions, dayStart) {
  let minHour = 24, maxHour = 0;
  
  // Check TimeSink entries
  for (const entry of timeSinkData) {
    if (!entry.start) continue;
    const startHour = entry.start.getHours();
    const endHour = entry.end.getHours() + (entry.end.getMinutes() > 0 ? 1 : 0);
    minHour = Math.min(minHour, startHour);
    maxHour = Math.max(maxHour, endHour);
  }
  
  // Check Balance sessions
  for (const session of balanceSessions) {
    if (!session.start || !session.end) continue;
    const startHour = session.start.getHours();
    const endHour = session.end.getHours() + (session.end.getMinutes() > 0 ? 1 : 0);
    minHour = Math.min(minHour, startHour);
    maxHour = Math.max(maxHour, endHour);
  }
  
  // Default to 9am-6pm if no data
  if (minHour > maxHour) {
    minHour = 9;
    maxHour = 18;
  }
  
  // Add padding
  minHour = Math.max(0, minHour - 1);
  maxHour = Math.min(24, maxHour + 1);
  
  const startTime = new Date(dayStart);
  startTime.setHours(minHour, 0, 0, 0);
  const endTime = new Date(dayStart);
  endTime.setHours(maxHour, 0, 0, 0);
  
  return { startTime, endTime, totalMs: endTime - startTime, minHour, maxHour };
}

// Focus track for day view (Balance sessions)
function updateFocusTrack(sessions, timeRange) {
  const track = document.getElementById('focusTrack');
  track.innerHTML = '';
  
  if (sessions.length === 0) return;
  
  const { startTime, endTime, totalMs } = timeRange;
  
  // Add session segments
  for (const session of sessions) {
    if (!session.start || !session.end) continue;
    
    // Skip sessions outside the time range
    if (session.end < startTime || session.start >= endTime) continue;
    
    // Clamp session to time range
    const segmentStart = Math.max(session.start.getTime(), startTime.getTime());
    const segmentEnd = Math.min(session.end.getTime(), endTime.getTime());
    
    if (segmentEnd <= segmentStart) continue;
    
    const left = ((segmentStart - startTime.getTime()) / totalMs) * 100;
    const width = Math.max(0.5, ((segmentEnd - segmentStart) / totalMs) * 100);
    
    const segment = document.createElement('div');
    segment.className = 'focus-segment ' + (session.isFocus ? 'focus' : 'break');
    segment.style.left = `${Math.max(0, left)}%`;
    segment.style.width = `${Math.min(100 - left, width)}%`;
    segment.title = `${session.isFocus ? 'Focus' : 'Break'}: ${formatDuration(session.duration || 0)}${session.notes ? ' - ' + session.notes : ''}`;
    
    track.appendChild(segment);
  }
}

function updateTimeline(data, dayStart, dayEnd, timeRange) {
  const track = document.getElementById('timelineTrack');
  const labels = document.getElementById('timelineLabels');
  
  // Use shared time range
  const { startTime, endTime, totalMs, minHour, maxHour } = timeRange;
  const totalHours = maxHour - minHour;
  
  // Clear existing
  track.innerHTML = '';
  labels.innerHTML = '';
  
  // Add segments
  for (const entry of data) {
    if (entry.start < startTime || entry.start >= endTime) continue;
    
    const left = ((entry.start - startTime) / totalMs) * 100;
    const width = Math.max(0.5, (entry.duration / totalMs) * 100);
    
    const category = getAppCategory(entry.app);
    const color = state.categories[category]?.color || '#9CA3AF';
    
    // Dim segments that don't match selected category
    const isSelected = !state.selectedCategory || state.selectedCategory === category;
    
    const segment = document.createElement('div');
    segment.className = 'timeline-segment' + (isSelected ? '' : ' dimmed');
    segment.style.left = `${left}%`;
    segment.style.width = `${width}%`;
    segment.style.backgroundColor = color;
    segment.style.opacity = isSelected ? '1' : '0.15';
    segment.title = `${entry.app}: ${formatDuration(entry.duration)}`;
    
    // Click to filter by this category
    segment.addEventListener('click', () => {
      if (state.selectedCategory === category) {
        state.selectedCategory = null;
      } else {
        state.selectedCategory = category;
      }
      updateDashboard();
    });
    
    track.appendChild(segment);
  }
  
  // Add time labels
  for (let h = minHour; h <= maxHour; h += Math.ceil(totalHours / 8)) {
    const label = document.createElement('span');
    label.className = 'timeline-label';
    label.textContent = `${h.toString().padStart(2, '0')}:00`;
    labels.appendChild(label);
  }
}

function updateHistogram(data, balanceSessions, start, end) {
  const canvas = document.getElementById('histogramCanvas');
  const ctx = canvas.getContext('2d');
  
  // Set canvas size
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * 2;
  canvas.height = rect.height * 2;
  ctx.scale(2, 2);
  
  const width = rect.width;
  const height = rect.height;
  
  // Year view uses aggregated stacked bars, week/month use vertical timeline
  if (state.currentPeriod === 'year') {
    drawYearlyAggregatedChart(ctx, data, balanceSessions, start, width, height);
  } else {
    drawVerticalTimeline(ctx, data, balanceSessions, start, width, height);
  }
}

function drawYearlyAggregatedChart(ctx, data, balanceSessions, start, width, height) {
  const padding = { top: 30, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const columnKeys = [];
  const labels = [];
  
  for (let i = 0; i < 12; i++) {
    columnKeys.push(`${start.getFullYear()}-${(i + 1).toString().padStart(2, '0')}`);
    labels.push(monthNames[i]);
  }
  
  // Aggregate by month and category
  const buckets = {};
  const sessionBuckets = {};
  
  for (const key of columnKeys) {
    buckets[key] = {};
    sessionBuckets[key] = { focus: 0, breaks: 0 };
  }
  
  for (const entry of data) {
    if (!entry.start) continue;
    const category = getAppCategory(entry.app);
    if (state.selectedCategory && category !== state.selectedCategory) continue;
    
    const key = `${entry.start.getFullYear()}-${(entry.start.getMonth() + 1).toString().padStart(2, '0')}`;
    if (buckets[key]) {
      buckets[key][category] = (buckets[key][category] || 0) + entry.duration / (1000 * 60 * 60);
    }
  }
  
  for (const session of balanceSessions) {
    if (!session.start) continue;
    const key = `${session.start.getFullYear()}-${(session.start.getMonth() + 1).toString().padStart(2, '0')}`;
    if (sessionBuckets[key]) {
      if (session.isFocus) sessionBuckets[key].focus += 1;
      else sessionBuckets[key].breaks += 1;
    }
  }
  
  // Calculate totals
  const totals = columnKeys.map(key => Object.values(buckets[key]).reduce((sum, v) => sum + v, 0));
  const maxValue = Math.max(...totals, 1);
  
  // Get sorted categories
  const categoryTotals = {};
  for (const key of columnKeys) {
    for (const [cat, hours] of Object.entries(buckets[key])) {
      categoryTotals[cat] = (categoryTotals[cat] || 0) + hours;
    }
  }
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([cat]) => cat);
  
  // Clear and draw grid
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = '#292e42';
  ctx.lineWidth = 0.5;
  
  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartHeight / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    
    ctx.fillStyle = '#565f89';
    ctx.font = '10px JetBrains Mono';
    ctx.textAlign = 'right';
    const value = maxValue - (maxValue / gridLines) * i;
    ctx.fillText(value.toFixed(0) + 'h', padding.left - 6, y + 4);
  }
  
  // Draw stacked bars
  const columnWidth = chartWidth / 12;
  const barWidth = columnWidth * 0.7;
  const barOffset = (columnWidth - barWidth) / 2;
  
  columnKeys.forEach((key, i) => {
    const x = padding.left + i * columnWidth + barOffset;
    const bucketData = buckets[key];
    const total = totals[i];
    
    // Draw stacked segments from bottom to top
    let currentY = padding.top + chartHeight;
    
    for (const category of sortedCategories) {
      const hours = bucketData[category] || 0;
      if (hours === 0) continue;
      
      const segmentHeight = (hours / maxValue) * chartHeight;
      const color = state.categories[category]?.color || '#7aa2f7';
      
      currentY -= segmentHeight;
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, currentY, barWidth, segmentHeight, 3);
      ctx.fill();
    }
    
    // Session overlays
    const sessionData = sessionBuckets[key];
    const barTop = padding.top + chartHeight - (total / maxValue) * chartHeight;
    
    if (state.showFocusOverlay && sessionData?.focus > 0) {
      ctx.fillStyle = '#9ece6a';
      ctx.beginPath();
      ctx.roundRect(x + barWidth / 2 - 12, barTop - 18, 24, 14, 3);
      ctx.fill();
      ctx.fillStyle = '#1a1b26';
      ctx.font = 'bold 9px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.fillText(sessionData.focus.toString(), x + barWidth / 2, barTop - 8);
    }
    
    if (state.showBreakOverlay && sessionData?.breaks > 0) {
      ctx.fillStyle = '#565f89';
      ctx.beginPath();
      ctx.roundRect(x + barWidth / 2 - 12, barTop - 18, 24, 14, 3);
      ctx.fill();
      ctx.fillStyle = '#c0caf5';
      ctx.font = 'bold 9px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.fillText(sessionData.breaks.toString(), x + barWidth / 2, barTop - 8);
    }
    
    // X-axis labels
    ctx.fillStyle = '#565f89';
    ctx.font = '10px Instrument Sans';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x + barWidth / 2, height - padding.bottom + 15);
  });
  
  // Y-axis label
  ctx.save();
  ctx.translate(12, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#565f89';
  ctx.font = '10px Instrument Sans';
  ctx.textAlign = 'center';
  ctx.fillText('Hours', 0, 0);
  ctx.restore();
}

function drawVerticalTimeline(ctx, data, balanceSessions, start, width, height) {
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // Build column keys and labels
  let columnKeys = [];
  let labels = [];
  
  if (state.currentPeriod === 'week') {
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      columnKeys.push(d.toISOString().split('T')[0]);
      labels.push(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]);
    }
  } else if (state.currentPeriod === 'month') {
    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), i);
      columnKeys.push(d.toISOString().split('T')[0]);
      labels.push(i.toString());
    }
  }
  
  // Group entries by column
  const columnData = {};
  const sessionBuckets = {};
  
  for (const key of columnKeys) {
    columnData[key] = [];
    sessionBuckets[key] = { focus: 0, breaks: 0 };
  }
  
  for (const entry of data) {
    if (!entry.start || !entry.end) continue;
    const category = getAppCategory(entry.app);
    if (state.selectedCategory && category !== state.selectedCategory) continue;
    
    const key = entry.start.toISOString().split('T')[0];
    if (columnData[key]) {
      columnData[key].push({
        startHour: entry.start.getHours() + entry.start.getMinutes() / 60,
        endHour: entry.end.getHours() + entry.end.getMinutes() / 60,
        color: state.categories[category]?.color || '#7aa2f7'
      });
    }
  }
  
  for (const session of balanceSessions) {
    if (!session.start) continue;
    const key = session.start.toISOString().split('T')[0];
    if (sessionBuckets[key]) {
      if (session.isFocus) sessionBuckets[key].focus += 1;
      else sessionBuckets[key].breaks += 1;
    }
  }
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Timeline range: 07:00 - 22:00 (inverted)
  const startHour = 7;
  const endHour = 22;
  const hoursToShow = endHour - startHour;
  
  // Draw hour grid lines
  ctx.strokeStyle = '#292e42';
  ctx.lineWidth = 0.5;
  
  for (let h = startHour; h <= endHour; h += 3) {
    const y = padding.top + ((endHour - h) / hoursToShow) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    
    ctx.fillStyle = '#565f89';
    ctx.font = '9px JetBrains Mono';
    ctx.textAlign = 'right';
    ctx.fillText(`${h.toString().padStart(2, '0')}:00`, padding.left - 4, y + 3);
  }
  
  // Draw columns
  const columnWidth = chartWidth / columnKeys.length;
  const barWidth = columnWidth * 0.8;
  const barOffset = (columnWidth - barWidth) / 2;
  
  columnKeys.forEach((key, i) => {
    const x = padding.left + i * columnWidth + barOffset;
    const entries = columnData[key];
    
    // Background track
    ctx.fillStyle = '#24283b';
    ctx.beginPath();
    ctx.roundRect(x, padding.top, barWidth, chartHeight, 3);
    ctx.fill();
    
    // Time segments
    for (const entry of entries) {
      const clampedStart = Math.max(startHour, Math.min(endHour, entry.startHour));
      const clampedEnd = Math.max(startHour, Math.min(endHour, entry.endHour));
      if (clampedStart >= clampedEnd) continue;
      
      const startY = padding.top + ((endHour - clampedEnd) / hoursToShow) * chartHeight;
      const endY = padding.top + ((endHour - clampedStart) / hoursToShow) * chartHeight;
      const segmentHeight = Math.max(1, endY - startY);
      
      ctx.fillStyle = entry.color;
      ctx.beginPath();
      ctx.roundRect(x, startY, barWidth, segmentHeight, 2);
      ctx.fill();
    }
    
    // Session overlays
    const sessionData = sessionBuckets[key];
    
    if (state.showFocusOverlay && sessionData?.focus > 0) {
      ctx.fillStyle = '#9ece6a';
      ctx.beginPath();
      ctx.roundRect(x + barWidth / 2 - 10, padding.top - 16, 20, 14, 3);
      ctx.fill();
      ctx.fillStyle = '#1a1b26';
      ctx.font = 'bold 9px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.fillText(sessionData.focus.toString(), x + barWidth / 2, padding.top - 6);
    }
    
    if (state.showBreakOverlay && sessionData?.breaks > 0) {
      ctx.fillStyle = '#565f89';
      ctx.beginPath();
      ctx.roundRect(x + barWidth / 2 - 10, padding.top - 16, 20, 14, 3);
      ctx.fill();
      ctx.fillStyle = '#c0caf5';
      ctx.font = 'bold 9px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.fillText(sessionData.breaks.toString(), x + barWidth / 2, padding.top - 6);
    }
    
    // X-axis labels
    ctx.fillStyle = '#565f89';
    ctx.font = '9px Instrument Sans';
    ctx.textAlign = 'center';
    
    if (state.currentPeriod === 'month' && columnKeys.length > 15 && i % 5 !== 0 && i !== columnKeys.length - 1) return;
    
    ctx.fillText(labels[i], x + barWidth / 2, height - padding.bottom + 15);
  });
}

// Pie Chart
function updatePieChart(categoryTotals, totalTime, focusedTime) {
  const canvas = document.getElementById('pieChart');
  const ctx = canvas.getContext('2d');
  
  // Set canvas size for retina
  canvas.width = 400;
  canvas.height = 400;
  ctx.scale(2, 2);
  
  const centerX = 100;
  const centerY = 100;
  const outerRadius = 90;
  const innerRadius = 60;
  
  ctx.clearRect(0, 0, 200, 200);
  
  if (totalTime === 0) {
    // Draw empty state
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
    ctx.arc(centerX, centerY, innerRadius, Math.PI * 2, 0, true);
    ctx.fillStyle = '#2A2A32';
    ctx.fill();
    
    document.getElementById('pieTotal').textContent = '0h 0m';
    document.getElementById('pieLabel').textContent = 'No Data';
    return;
  }
  
  // Sort categories by time
  const sorted = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .filter(([_, time]) => time > 0);
  
  let startAngle = -Math.PI / 2;
  
  for (const [category, time] of sorted) {
    const angle = (time / totalTime) * Math.PI * 2;
    const color = state.categories[category]?.color || '#9CA3AF';
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, startAngle, startAngle + angle);
    ctx.arc(centerX, centerY, innerRadius, startAngle + angle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    
    startAngle += angle;
  }
  
  // Update center text
  document.getElementById('pieTotal').textContent = formatDuration(totalTime);
  document.getElementById('pieLabel').textContent = sorted[0]?.[0] || 'Total';
  
  // Update focus bar
  const focusPercent = totalTime > 0 ? (focusedTime / totalTime) * 100 : 0;
  document.getElementById('focusFill').style.width = `${focusPercent}%`;
  document.getElementById('focusedTime').textContent = formatDuration(focusedTime);
  document.getElementById('otherTime').textContent = formatDuration(totalTime - focusedTime);
}

// Category and App Lists
function updateCategoryList(categoryTotals, totalTime) {
  const container = document.getElementById('categoryList');
  container.innerHTML = '';
  
  const sorted = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .filter(([_, time]) => time > 0);
  
  for (const [category, time] of sorted) {
    const percent = totalTime > 0 ? (time / totalTime) * 100 : 0;
    const color = state.categories[category]?.color || '#9CA3AF';
    const isSelected = state.selectedCategory === category;
    
    const item = document.createElement('div');
    item.className = 'category-item' + (isSelected ? ' selected' : '');
    item.innerHTML = `
      <span class="item-percent">${percent < 1 ? '<1' : Math.round(percent)}%</span>
      <div class="item-info">
        <span class="item-name">${category}</span>
        <div class="item-bar">
          <div class="item-bar-fill" style="width: ${percent}%; background-color: ${color}"></div>
        </div>
      </div>
      <span class="item-time">${formatDuration(time)}</span>
    `;
    
    item.addEventListener('click', () => {
      // Toggle selection
      if (state.selectedCategory === category) {
        state.selectedCategory = null;
      } else {
        state.selectedCategory = category;
      }
      updateDashboard();
    });
    
    container.appendChild(item);
  }
  
  // Add "Show All" option if a category is selected
  if (state.selectedCategory) {
    const showAll = document.createElement('div');
    showAll.className = 'category-item show-all';
    showAll.innerHTML = `
      <span class="item-percent">←</span>
      <div class="item-info">
        <span class="item-name">Show All Categories</span>
      </div>
      <span class="item-time"></span>
    `;
    showAll.addEventListener('click', () => {
      state.selectedCategory = null;
      updateDashboard();
    });
    container.insertBefore(showAll, container.firstChild);
  }
}

function updateAppList(appTotals, totalTime) {
  const container = document.getElementById('appList');
  container.innerHTML = '';
  
  const sorted = Object.entries(appTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  
  for (const [app, time] of sorted) {
    const percent = totalTime > 0 ? (time / totalTime) * 100 : 0;
    const category = getAppCategory(app);
    const color = state.categories[category]?.color || '#9CA3AF';
    
    const item = document.createElement('div');
    item.className = 'app-item';
    item.innerHTML = `
      <span class="item-percent">${percent < 1 ? '<1' : Math.round(percent)}%</span>
      <div class="item-info">
        <span class="item-name">${app}</span>
        <div class="item-bar">
          <div class="item-bar-fill" style="width: ${percent}%; background-color: ${color}"></div>
        </div>
      </div>
      <span class="item-time">${formatDuration(time)}</span>
    `;
    
    container.appendChild(item);
  }
}

function updateProjectsList(projects) {
  const container = document.getElementById('projectsList');
  const section = document.getElementById('projectsSection');
  
  // Filter out projects with invalid dates
  const validProjects = projects.filter(p => p.start && p.end);
  
  if (validProjects.length === 0) {
    section.style.display = 'none';
    return;
  }
  
  section.style.display = 'block';
  container.innerHTML = '';
  
  // Aggregate sessions by category (project)
  const aggregated = {};
  
  for (const session of validProjects) {
    const key = session.category || 'Uncategorized';
    
    if (!aggregated[key]) {
      aggregated[key] = {
        category: key,
        totalDuration: 0,
        sessionCount: 0,
        focusSessionCount: 0,
        notes: new Set(),
        tags: new Set()
      };
    }
    
    aggregated[key].totalDuration += session.duration || 0;
    aggregated[key].sessionCount += 1;
    
    if (session.isFocus) {
      aggregated[key].focusSessionCount += 1;
    }
    
    if (session.notes) {
      aggregated[key].notes.add(session.notes);
    }
    
    if (session.tags) {
      aggregated[key].tags.add(session.tags);
    }
  }
  
  // Sort by total duration descending
  const sorted = Object.values(aggregated).sort((a, b) => b.totalDuration - a.totalDuration);
  
  for (const project of sorted) {
    const card = document.createElement('div');
    card.className = 'project-card';
    
    // Show up to 3 notes as "chapters/tasks worked on"
    const notesList = Array.from(project.notes).slice(0, 3);
    const notesHtml = notesList.length > 0 
      ? `<div class="project-notes">${notesList.join(' · ')}${project.notes.size > 3 ? ` +${project.notes.size - 3} more` : ''}</div>`
      : '';
    
    card.innerHTML = `
      <div class="project-name">${project.category}</div>
      <div class="project-time">${formatDuration(project.totalDuration)}</div>
      <div class="project-meta">
        <span>${project.sessionCount} session${project.sessionCount !== 1 ? 's' : ''}</span>
        ${project.focusSessionCount > 0 ? `<span class="project-pomodoros">${project.focusSessionCount} 🍅</span>` : ''}
      </div>
      ${notesHtml}
    `;
    
    container.appendChild(card);
  }
}

// Categories Editor
function updateCategoriesEditor() {
  const grid = document.getElementById('categoriesGrid');
  grid.innerHTML = '';
  
  for (const [name, data] of Object.entries(state.categories)) {
    const card = document.createElement('div');
    card.className = 'category-card';
    
    const focusBadge = data.isFocused ? '<span class="category-badge">Focused</span>' : '';
    
    card.innerHTML = `
      <div class="category-header">
        <div class="category-header-left">
          <div class="category-color" style="background-color: ${data.color}"></div>
          <span class="category-title">${name}</span>
        </div>
        ${focusBadge}
      </div>
      <div class="category-apps" data-category="${name}"></div>
    `;
    
    const appsContainer = card.querySelector('.category-apps');
    
    // Add app tags with proper event handlers
    for (const app of data.apps) {
      const tag = createAppTag(app, name);
      appsContainer.appendChild(tag);
    }
    
    // Setup drop zone
    setupDropZone(appsContainer, name);
    
    grid.appendChild(card);
  }
  
  // Update uncategorized apps
  updateUncategorizedApps();
}

function createAppTag(app, category) {
  const tag = document.createElement('span');
  tag.className = 'app-tag';
  tag.draggable = true;
  tag.dataset.app = app;
  tag.innerHTML = `${app}<span class="remove">&times;</span>`;
  
  // Drag start
  tag.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ app, fromCategory: category }));
    tag.classList.add('dragging');
  });
  
  tag.addEventListener('dragend', () => {
    tag.classList.remove('dragging');
  });
  
  // Remove button
  tag.querySelector('.remove').addEventListener('click', (e) => {
    e.stopPropagation();
    removeAppFromCategory(app, category);
  });
  
  return tag;
}

function setupDropZone(container, category) {
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    container.classList.add('drag-over');
  });
  
  container.addEventListener('dragleave', (e) => {
    if (!container.contains(e.relatedTarget)) {
      container.classList.remove('drag-over');
    }
  });
  
  container.addEventListener('drop', (e) => {
    e.preventDefault();
    container.classList.remove('drag-over');
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const { app, fromCategory } = data;
      
      if (fromCategory !== category) {
        moveAppToCategory(app, fromCategory, category);
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  });
}

function moveAppToCategory(app, fromCategory, toCategory) {
  // Remove from old category if it exists
  if (fromCategory && state.categories[fromCategory]) {
    const index = state.categories[fromCategory].apps.indexOf(app);
    if (index !== -1) {
      state.categories[fromCategory].apps.splice(index, 1);
    }
  }
  
  // Add to new category
  if (!state.categories[toCategory].apps.includes(app)) {
    state.categories[toCategory].apps.push(app);
  }
  
  buildAppToCategoryMap();
  saveToStorage();
  updateCategoriesEditor();
}

function removeAppFromCategory(app, category) {
  const index = state.categories[category].apps.indexOf(app);
  if (index !== -1) {
    state.categories[category].apps.splice(index, 1);
  }
  
  buildAppToCategoryMap();
  saveToStorage();
  updateCategoriesEditor();
}

function updateUncategorizedApps() {
  const container = document.getElementById('uncategorizedApps');
  container.innerHTML = '';
  
  // Get all apps from data
  const allApps = new Set();
  for (const entry of state.timeSinkData) {
    allApps.add(entry.app);
  }
  
  // Find uncategorized
  const categorizedApps = new Set();
  for (const data of Object.values(state.categories)) {
    for (const app of data.apps) {
      categorizedApps.add(app);
      categorizedApps.add(app.replace('.app', ''));
    }
  }
  
  const uncategorized = [];
  for (const app of allApps) {
    if (!categorizedApps.has(app)) {
      uncategorized.push(app);
    }
  }
  
  for (const app of uncategorized) {
    const el = document.createElement('span');
    el.className = 'uncategorized-app';
    el.textContent = app;
    el.draggable = true;
    
    // Click to assign via modal
    el.addEventListener('click', () => showCategoryModal(app));
    
    // Drag to category
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ app, fromCategory: null }));
      el.classList.add('dragging');
    });
    
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
    });
    
    container.appendChild(el);
  }
  
  if (uncategorized.length === 0) {
    container.innerHTML = '<span style="color: var(--text-tertiary)">All apps are categorized!</span>';
  }
  
  // Make uncategorized section a drop zone (to remove from categories)
  const section = document.querySelector('.uncategorized-section');
  if (section) {
    section.addEventListener('dragover', (e) => {
      e.preventDefault();
      container.classList.add('drag-over');
    });
    
    section.addEventListener('dragleave', (e) => {
      if (!section.contains(e.relatedTarget)) {
        container.classList.remove('drag-over');
      }
    });
    
    section.addEventListener('drop', (e) => {
      e.preventDefault();
      container.classList.remove('drag-over');
      
      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const { app, fromCategory } = data;
        
        if (fromCategory) {
          removeAppFromCategory(app, fromCategory);
        }
      } catch (err) {
        console.error('Drop error:', err);
      }
    });
  }
}

function showCategoryModal(app) {
  const modal = document.getElementById('categoryModal');
  const options = document.getElementById('categoryOptions');
  document.getElementById('appToAssign').textContent = app;
  
  options.innerHTML = '';
  for (const [name, data] of Object.entries(state.categories)) {
    const option = document.createElement('div');
    option.className = 'category-option';
    option.innerHTML = `
      <div class="category-option-color" style="background-color: ${data.color}"></div>
      <span class="category-option-name">${name}</span>
    `;
    option.onclick = () => {
      assignAppToCategory(app, name);
      modal.classList.add('hidden');
    };
    options.appendChild(option);
  }
  
  modal.classList.remove('hidden');
}

function assignAppToCategory(app, category) {
  // Remove from other categories first
  for (const data of Object.values(state.categories)) {
    const index = data.apps.indexOf(app);
    if (index !== -1) {
      data.apps.splice(index, 1);
    }
  }
  
  // Add to new category
  state.categories[category].apps.push(app);
  buildAppToCategoryMap();
  saveToStorage();
  updateCategoriesEditor();
}

function createNewCategory() {
  const name = document.getElementById('newCategoryName').value.trim();
  const color = document.getElementById('newCategoryColor').value;
  const isFocused = document.getElementById('newCategoryFocused').checked;
  
  if (!name) {
    alert('Please enter a category name');
    return;
  }
  
  if (state.categories[name]) {
    alert('Category already exists');
    return;
  }
  
  state.categories[name] = {
    color,
    apps: [],
    isFocused
  };
  
  saveToStorage();
  updateCategoriesEditor();
  document.getElementById('newCategoryModal').classList.add('hidden');
  document.getElementById('newCategoryName').value = '';
}

// Import Summary
function updateImportSummary() {
  const hasData = state.timeSinkData.length > 0 || state.balanceData.length > 0;
  const summary = document.getElementById('importSummary');
  
  if (!hasData) {
    summary.style.display = 'none';
    return;
  }
  
  summary.style.display = 'block';
  
  // Calculate stats
  const days = new Set();
  let totalHours = 0;
  const apps = new Set();
  
  for (const entry of state.timeSinkData) {
    if (entry.start && entry.start instanceof Date && !isNaN(entry.start)) {
      days.add(entry.start.toISOString().split('T')[0]);
    }
    totalHours += entry.duration / (1000 * 60 * 60);
    apps.add(entry.app);
  }
  
  for (const session of state.balanceData) {
    if (session.start && session.start instanceof Date && !isNaN(session.start)) {
      days.add(session.start.toISOString().split('T')[0]);
    }
  }
  
  const projects = new Set(state.balanceData.map(s => s.category).filter(Boolean));
  
  document.getElementById('totalDays').textContent = days.size;
  document.getElementById('totalApps').textContent = apps.size;
  document.getElementById('totalHours').textContent = totalHours.toFixed(1);
  document.getElementById('totalProjects').textContent = projects.size;
}

// Export Functions
function exportJSON() {
  const data = {
    exportDate: new Date().toISOString(),
    timeSinkData: state.timeSinkData,
    balanceData: state.balanceData,
    categories: state.categories
  };
  
  downloadFile(JSON.stringify(data, null, 2), 'timeflow-export.json', 'application/json');
}

function exportCSV() {
  // Aggregate daily data
  const dailyData = {};
  
  for (const entry of state.timeSinkData) {
    const date = entry.start.toISOString().split('T')[0];
    const category = getAppCategory(entry.app);
    
    if (!dailyData[date]) {
      dailyData[date] = { total: 0, focused: 0, categories: {} };
    }
    
    dailyData[date].total += entry.duration;
    dailyData[date].categories[category] = (dailyData[date].categories[category] || 0) + entry.duration;
    
    if (state.categories[category]?.isFocused) {
      dailyData[date].focused += entry.duration;
    }
  }
  
  // Build CSV
  const allCategories = Object.keys(state.categories);
  let csv = 'Date,Total Hours,Focused Hours,' + allCategories.join(',') + '\n';
  
  for (const [date, data] of Object.entries(dailyData).sort()) {
    const row = [
      date,
      (data.total / 3600000).toFixed(2),
      (data.focused / 3600000).toFixed(2),
      ...allCategories.map(cat => ((data.categories[cat] || 0) / 3600000).toFixed(2))
    ];
    csv += row.join(',') + '\n';
  }
  
  downloadFile(csv, 'timeflow-summary.csv', 'text/csv');
}

function exportHTML() {
  alert('HTML export coming soon!');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Utilities
function adjustColor(hex, amount) {
  // Darken or lighten a hex color
  let color = hex.replace('#', '');
  if (color.length === 3) {
    color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
  }
  const num = parseInt(color, 16);
  let r = (num >> 16) + amount;
  let g = ((num >> 8) & 0x00FF) + amount;
  let b = (num & 0x0000FF) + amount;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}

function formatDuration(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}
