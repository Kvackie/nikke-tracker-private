let selectMode = false;
let selectedIds = new Set();

function init() {
  document.getElementById('stat-total').textContent = CHARACTERS.length;
  bindEvents();
  render();
}

function bindEvents() {
  document.getElementById('search').addEventListener('input', render);
  document.getElementById('filter-rarity').addEventListener('change', render);
  document.getElementById('filter-element').addEventListener('change', render);
  document.getElementById('filter-burst').addEventListener('change', render);
  document.getElementById('filter-manufacturer').addEventListener('change', render);
  document.getElementById('filter-tier').addEventListener('change', render);
  document.getElementById('filter-owned').addEventListener('change', render);
  document.getElementById('sort-by').addEventListener('change', render);

  document.getElementById('btn-export').addEventListener('click', exportJSON);
  document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', handleImport);
  document.getElementById('btn-select').addEventListener('click', toggleSelectMode);
  document.getElementById('btn-report').addEventListener('click', openReport);
  document.getElementById('report-close').addEventListener('click', closeReport);
  document.getElementById('report-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeReport(); });

  document.getElementById('bulk-select-all').addEventListener('click', selectAll);
  document.getElementById('bulk-owned').addEventListener('click', () => bulkSetOwned(true));
  document.getElementById('bulk-unowned').addEventListener('click', () => bulkSetOwned(false));
  document.getElementById('bulk-clear').addEventListener('click', clearSelection);
}

function getFilteredChars() {
  const search = document.getElementById('search').value.toLowerCase().trim();
  const fRarity = document.getElementById('filter-rarity').value;
  const fElement = document.getElementById('filter-element').value;
  const fTier = document.getElementById('filter-tier').value;
  const fBurst = document.getElementById('filter-burst').value;
  const fMfg = document.getElementById('filter-manufacturer').value;
  const fOwned = document.getElementById('filter-owned').value;
  const sortBy = document.getElementById('sort-by').value;

  let chars = CHARACTERS.filter(c => {
    if (search && !c.name.toLowerCase().includes(search)) return false;
    if (fRarity && c.rarity !== fRarity) return false;
    if (fElement && c.element !== fElement) return false;
    if (fTier && c.tierBossing !== fTier) return false;
    if (fBurst && c.burstType !== fBurst) return false;
    if (fMfg && c.manufacturer !== fMfg) return false;
    if (fOwned) {
      const owned = getCharacter(c.unitId).owned;
      if (fOwned === 'owned' && !owned) return false;
      if (fOwned === 'unowned' && owned) return false;
    }
    return true;
  });

  const rarityOrder = { SSR: 0, SR: 1, R: 2 };
  chars.sort((a, b) => {
    switch (sortBy) {
      case 'rarity': return (rarityOrder[a.rarity] ?? 9) - (rarityOrder[b.rarity] ?? 9) || a.name.localeCompare(b.name);
      case 'element': return a.element.localeCompare(b.element) || a.name.localeCompare(b.name);
      case 'manufacturer': return a.manufacturer.localeCompare(b.manufacturer) || a.name.localeCompare(b.name);
      case 'owned': {
        const ao = getCharacter(a.unitId).owned ? 0 : 1;
        const bo = getCharacter(b.unitId).owned ? 0 : 1;
        return ao - bo || a.name.localeCompare(b.name);
      }
      default: return a.name.localeCompare(b.name);
    }
  });
  return chars;
}

function render() {
  const chars = getFilteredChars();
  const grid = document.getElementById('card-grid');
  const col = getCollection();
  grid.classList.toggle('select-mode', selectMode);

  if (chars.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>No characters match your filters.</p></div>';
    updateStats();
    return;
  }

  grid.innerHTML = chars.map(c => createCardHTML(c, col)).join('');
  bindCardEvents(grid);
  updateStats();
}

function createCardHTML(c, col) {
  const d = col[c.unitId] || defaultCharData();
  const owned = d.owned;
  const checked = selectedIds.has(c.unitId) ? 'checked' : '';
  const burstIcon = BURST_ICONS[c.burstType] || BURST_ICONS['3'];
  const eleIcon = ELEMENT_ICONS[c.element] || '';

  const imgHTML = c.icon
    ? `<img src="${c.icon}" alt="${escapeHTML(c.name)}" loading="lazy">`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--text-muted);font-size:1.5rem">${c.name.charAt(0)}</div>`;

  const tierChips = [];
  if (c.tierStory) tierChips.push(`<span class="tier-chip tier-${c.tierStory}">S</span>`);
  if (c.tierBossing) tierChips.push(`<span class="tier-chip tier-${c.tierBossing}">B</span>`);

  const equipSlots = EQUIPMENT_SLOTS.map(slot => {
    const eq = d.equipment[slot] || { equipped: 'none', overloaded: false, olSubStats: [] };
    let stateClass = '';
    let stateLabel = 'None';
    if (eq.overloaded) { stateClass = 'eq-ol'; stateLabel = 'OL'; }
    else if (eq.equipped === 'manufacturer') { stateClass = 'eq-standard'; stateLabel = 'MFG'; }
    else if (eq.equipped === 'standard') { stateClass = 'eq-standard'; stateLabel = 'STD'; }

    const olStatsHTML = OL_SUB_STATS.map(s => {
      const active = eq.olSubStats.includes(s) ? 'active' : '';
      return `<span class="ol-stat ${active}" data-slot="${slot}" data-stat="${s}">${s}</span>`;
    }).join('');

    return `<div class="equip-slot-group">
      <div class="equip-btn ${stateClass}" data-slot="${slot}" data-unitid="${c.unitId}">
        <span class="equip-btn-label">${slot.charAt(0)}${slot.charAt(1)}</span>
        <span class="equip-btn-state">${stateLabel}</span>
      </div>
      <div class="ol-stats ${eq.overloaded ? '' : 'hidden'}">${olStatsHTML}</div>
    </div>`;
  }).join('');

  const collectHTML = `<div class="card-collect-line ${d.hasCollectionItem ? 'active' : ''}" data-unitid="${c.unitId}">
    <span>${d.hasCollectionItem ? '\u2713 Collection' : 'Collection'}</span>
  </div>`;

  return `<div class="card ${owned ? '' : 'unowned'} card-rarity-${c.rarity.toLowerCase()}" data-unitid="${c.unitId}">
    <div class="card-checkbox"><input type="checkbox" id="sel-${c.unitId}" ${checked}><label for="sel-${c.unitId}"></label></div>
    <div class="card-header">
      ${imgHTML}
      <div class="card-overlay">
        <div class="card-owned ${owned ? 'active' : ''}" data-unitid="${c.unitId}">${owned ? '\u2713' : ''}</div>
      </div>
    </div>
    <div class="card-info">
      <div class="card-name">${escapeHTML(c.name)}</div>
      <div class="card-tier">${tierChips.join('')}</div>
    </div>
    <div class="card-meta">
      ${eleIcon ? `<img src="${eleIcon}" alt="${c.element}">` : ''}
      <img src="${burstIcon}" alt="B${c.burstType}">
      ${collectHTML}
    </div>
    <div class="card-equip ${owned ? '' : 'hidden'}">
      <div class="equip-slots">${equipSlots}</div>
    </div>
  </div>`;
}

function bindCardEvents(grid) {
  // Owned toggles
  grid.querySelectorAll('.card-owned').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (selectMode) return;
      const uid = parseInt(btn.dataset.unitid);
      const d = getCharacter(uid);
      d.owned = !d.owned;
      saveCharacter(uid, d);
      render();
    });
  });

  // Select mode checkboxes
  grid.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', e => {
      if (!selectMode) return;
      if (e.target.closest('.equip-btn') || e.target.closest('.ol-stat') || e.target.closest('.card-collect-line') || e.target.closest('.card-owned')) return;
      const uid = parseInt(card.dataset.unitid);
      const cb = card.querySelector('.card-checkbox input');
      cb.checked = !cb.checked;
      if (cb.checked) selectedIds.add(uid); else selectedIds.delete(uid);
      updateBulkBar();
    });
  });

  // Equipment buttons
  grid.querySelectorAll('.equip-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const uid = parseInt(btn.dataset.unitid);
      const slot = btn.dataset.slot;
      const d = getCharacter(uid);
      const eq = d.equipment[slot];

      // Cycle: none → standard → OL (manufacturer) → none
      if (eq.equipped === 'none') {
        eq.equipped = 'standard';
        eq.overloaded = false;
      } else if (eq.equipped === 'standard' && !eq.overloaded) {
        eq.equipped = 'manufacturer';
        eq.overloaded = true;
      } else {
        eq.equipped = 'none';
        eq.overloaded = false;
        eq.olSubStats = [];
      }
      saveCharacter(uid, d);
      render();
    });
  });

  // OL sub-stat chips
  grid.querySelectorAll('.ol-stat').forEach(chip => {
    chip.addEventListener('click', e => {
      e.stopPropagation();
      const uid = parseInt(chip.closest('.card').dataset.unitid);
      const slot = chip.dataset.slot;
      const stat = chip.dataset.stat;
      const d = getCharacter(uid);
      const eq = d.equipment[slot];
      const idx = eq.olSubStats.indexOf(stat);
      if (idx >= 0) eq.olSubStats.splice(idx, 1); else eq.olSubStats.push(stat);
      saveCharacter(uid, d);
      render();
    });
  });

  // Collection item toggles
  grid.querySelectorAll('.card-collect-line').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const uid = parseInt(el.dataset.unitid);
      const d = getCharacter(uid);
      d.hasCollectionItem = !d.hasCollectionItem;
      saveCharacter(uid, d);
      render();
    });
  });
}

function updateStats() {
  const col = getCollection();
  let owned = 0;
  CHARACTERS.forEach(c => { if (col[c.unitId] && col[c.unitId].owned) owned++; });
  document.getElementById('stat-owned').textContent = owned;
  document.getElementById('stat-pct').textContent = CHARACTERS.length ? Math.round(owned / CHARACTERS.length * 100) + '%' : '0%';
}

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  importJSON(file).then(() => { render(); showToast('Import successful'); }).catch(err => showToast('Import failed: ' + err.message));
  e.target.value = '';
}

function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function toggleSelectMode() {
  selectMode = !selectMode;
  const btn = document.getElementById('btn-select');
  btn.classList.toggle('btn-select-active', selectMode);
  btn.textContent = selectMode ? 'Selecting...' : 'Select';
  if (!selectMode) { selectedIds.clear(); document.getElementById('bulk-bar').classList.add('hidden'); }
  render();
}

function updateBulkBar() {
  const bar = document.getElementById('bulk-bar');
  const count = selectedIds.size;
  if (count > 0) {
    bar.classList.remove('hidden');
    document.getElementById('bulk-count').textContent = count + ' selected';
  } else {
    bar.classList.add('hidden');
  }
}

function bulkSetOwned(owned) {
  const col = getCollection();
  selectedIds.forEach(id => {
    const d = col[id] || defaultCharData();
    d.owned = owned;
    col[id] = d;
  });
  saveCollection(col);
  showToast(`${selectedIds.size} set to ${owned ? 'owned' : 'not owned'}`);
  selectedIds.clear();
  updateBulkBar();
  render();
}

function selectAll() {
  getFilteredChars().forEach(c => selectedIds.add(c.unitId));
  updateBulkBar();
  render();
}

function clearSelection() {
  selectedIds.clear();
  updateBulkBar();
  render();
}

function openReport() {
  const col = getCollection();
  const issues = [];
  CHARACTERS.forEach(c => {
    const d = col[c.unitId];
    if (!d || !d.owned) return;
    const problems = [];
    EQUIPMENT_SLOTS.forEach(slot => {
      const eq = d.equipment[slot];
      if (!eq || eq.equipped === 'none') problems.push(slot + ': Empty');
      else if (eq.equipped === 'standard') problems.push(slot + ': Standard');
    });
    if (problems.length > 0) issues.push({ name: c.name, problems });
  });

  const summary = document.getElementById('report-summary');
  const list = document.getElementById('report-list');
  if (issues.length === 0) {
    summary.textContent = 'All owned characters have full manufacturer equipment!';
    list.innerHTML = '';
  } else {
    summary.textContent = `${issues.length} owned character${issues.length > 1 ? 's' : ''} with missing or standard equipment:`;
    list.innerHTML = issues.map(i => `<div class="report-row"><span class="report-name">${escapeHTML(i.name)}</span><span class="report-issues">${i.problems.join(', ')}</span></div>`).join('');
  }
  document.getElementById('report-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeReport() {
  document.getElementById('report-overlay').classList.add('hidden');
  document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', init);
