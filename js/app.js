let currentModalChar = null;

function init() {
  document.getElementById('stat-total').textContent = CHARACTERS.length;
  buildEquipSection();
  bindEvents();
  render();
}

function bindEvents() {
  document.getElementById('search').addEventListener('input', render);
  document.getElementById('filter-rarity').addEventListener('change', render);
  document.getElementById('filter-element').addEventListener('change', render);
  document.getElementById('filter-class').addEventListener('change', render);
  document.getElementById('filter-burst').addEventListener('change', render);
  document.getElementById('filter-manufacturer').addEventListener('change', render);
  document.getElementById('filter-owned').addEventListener('change', render);
  document.getElementById('sort-by').addEventListener('change', render);

  document.getElementById('btn-export').addEventListener('click', exportJSON);
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', handleImport);

  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-save').addEventListener('click', saveModal);

  ['modal-core', 'modal-s1', 'modal-s2', 'modal-burst'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => {
      document.getElementById(id + '-val').textContent = el.value;
    });
  });
}

function getFilteredChars() {
  const search = document.getElementById('search').value.toLowerCase().trim();
  const fRarity = document.getElementById('filter-rarity').value;
  const fElement = document.getElementById('filter-element').value;
  const fClass = document.getElementById('filter-class').value;
  const fBurst = document.getElementById('filter-burst').value;
  const fMfg = document.getElementById('filter-manufacturer').value;
  const fOwned = document.getElementById('filter-owned').value;
  const sortBy = document.getElementById('sort-by').value;

  let chars = CHARACTERS.filter(c => {
    if (search && !c.name.toLowerCase().includes(search)) return false;
    if (fRarity && c.rarity !== fRarity) return false;
    if (fElement && c.element !== fElement) return false;
    if (fClass && c.class !== fClass) return false;
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
      case 'rarity':
        return (rarityOrder[a.rarity] ?? 9) - (rarityOrder[b.rarity] ?? 9) || a.name.localeCompare(b.name);
      case 'element':
        return a.element.localeCompare(b.element) || a.name.localeCompare(b.name);
      case 'manufacturer':
        return a.manufacturer.localeCompare(b.manufacturer) || a.name.localeCompare(b.name);
      case 'owned': {
        const ao = getCharacter(a.unitId).owned ? 0 : 1;
        const bo = getCharacter(b.unitId).owned ? 0 : 1;
        return ao - bo || a.name.localeCompare(b.name);
      }
      default:
        return a.name.localeCompare(b.name);
    }
  });

  return chars;
}

function render() {
  const chars = getFilteredChars();
  const grid = document.getElementById('card-grid');
  const col = getCollection();

  if (chars.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>No characters match your filters.</p></div>';
    updateStats();
    return;
  }

  grid.innerHTML = chars.map(c => createCardHTML(c, col)).join('');

  grid.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      const id = parseInt(card.dataset.unitid);
      openModal(id);
    });
  });

  updateStats();
}

function createCardHTML(c, col) {
  const d = col[c.unitId] || defaultCharData();
  const owned = d.owned;
  const ec = ELEMENT_COLORS[c.element] || '#666';
  const rc = RARITY_COLORS[c.rarity] || '#666';
  const bc = BURST_COLORS[c.burstType] || '#666';
  const initial = c.name.charAt(0).toUpperCase();
  const starCount = c.rarity === 'SSR' ? '★★★' : c.rarity === 'SR' ? '★★' : '★';

  return `<div class="card ${owned ? '' : 'unowned'}" data-unitid="${c.unitId}">
    ${owned ? '<div class="card-owned-indicator"></div>' : ''}
    ${c.hasTreasure ? '<span class="card-treasure">[T]</span>' : ''}
    <div class="card-avatar" style="border-color: ${rc}; background: linear-gradient(135deg, ${rc}22, ${rc}08)">
      ${initial}
    </div>
    <div class="card-name">${escapeHTML(c.name)}</div>
    <div class="card-badges">
      <span class="badge badge-rarity" style="--badge-color: ${rc}">${starCount}</span>
      <span class="badge badge-element" style="--badge-color: ${ec}">${c.element}</span>
      <span class="badge badge-burst" style="--badge-color: ${bc}">${c.burstType === 'All' ? 'ALL' : c.burstType}</span>
    </div>
  </div>`;
}

function updateStats() {
  const col = getCollection();
  let owned = 0;
  let treasures = 0;
  CHARACTERS.forEach(c => {
    const d = col[c.unitId];
    if (d && d.owned) {
      owned++;
      if (d.hasCollectionItem) treasures++;
    }
  });
  document.getElementById('stat-owned').textContent = owned;
  document.getElementById('stat-treasures').textContent = treasures;
  document.getElementById('stat-pct').textContent =
    CHARACTERS.length ? Math.round(owned / CHARACTERS.length * 100) + '%' : '0%';
}

function buildEquipSection() {
  const section = document.getElementById('equip-section');
  section.innerHTML = EQUIPMENT_SLOTS.map(slot => `
    <div class="equip-slot" data-slot="${slot}">
      <div class="equip-slot-header">
        <span class="equip-slot-name">${slot}</span>
        <div class="radio-group">
          <label><input type="radio" name="eq-${slot}" value="none" checked> None</label>
          <label><input type="radio" name="eq-${slot}" value="standard"> Standard</label>
          <label><input type="radio" name="eq-${slot}" value="manufacturer"> Manufacturer</label>
        </div>
        <label class="equip-ol-toggle">
          OL
          <label class="toggle">
            <input type="checkbox" class="ol-toggle" data-slot="${slot}">
            <span class="toggle-slider"></span>
          </label>
        </label>
      </div>
      <div class="ol-stats-area hidden" data-ol-area="${slot}">
        ${OL_SUB_STATS.map(s => `
          <label class="ol-stat-chip" data-stat="${s}">
            <input type="checkbox" value="${s}"> ${s}
          </label>
        `).join('')}
      </div>
    </div>
  `).join('');

  section.querySelectorAll('.ol-toggle').forEach(toggle => {
    toggle.addEventListener('change', () => {
      const area = section.querySelector(`[data-ol-area="${toggle.dataset.slot}"]`);
      area.classList.toggle('hidden', !toggle.checked);
    });
  });

  section.querySelectorAll('.ol-stat-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') {
        chip.classList.toggle('active', e.target.checked);
      } else {
        const cb = chip.querySelector('input');
        cb.checked = !cb.checked;
        chip.classList.toggle('active', cb.checked);
      }
    });
  });
}

function openModal(unitId) {
  const c = CHARACTERS.find(x => x.unitId === unitId);
  if (!c) return;
  currentModalChar = c;

  const d = getCharacter(unitId);
  const rc = RARITY_COLORS[c.rarity] || '#666';
  const ec = ELEMENT_COLORS[c.element] || '#666';
  const mc = MANUFACTURER_COLORS[c.manufacturer] || '#666';
  const bc = BURST_COLORS[c.burstType] || '#666';
  const initial = c.name.charAt(0).toUpperCase();

  document.getElementById('modal-avatar').textContent = initial;
  document.getElementById('modal-avatar').style.borderColor = rc;
  document.getElementById('modal-avatar').style.background =
    `linear-gradient(135deg, ${rc}22, ${rc}08)`;
  document.getElementById('modal-name').textContent = c.name;

  const starCount = c.rarity === 'SSR' ? '★★★' : c.rarity === 'SR' ? '★★' : '★';
  document.getElementById('modal-meta').innerHTML = `
    <span class="badge badge-rarity" style="--badge-color: ${rc}">${starCount}</span>
    <span class="badge badge-element" style="--badge-color: ${ec}">${c.element}</span>
    <span class="badge badge-burst" style="--badge-color: ${bc}">${c.burstType === 'All' ? 'ALL' : c.burstType}</span>
    <span class="badge" style="--badge-color: ${mc}; background: none; color: ${mc}">${c.manufacturer}</span>
    <span class="badge" style="background: none; color: var(--text-muted)">${c.weapon}</span>
    <span class="badge" style="background: none; color: var(--text-muted)">${c.class}</span>
    ${c.hasTreasure ? '<span class="badge" style="--badge-color: #f1c40f; background: none; color: #f1c40f">[Treasure]</span>' : ''}
  `;

  document.getElementById('modal-owned').checked = d.owned;
  document.getElementById('modal-core').value = d.coreLevel;
  document.getElementById('modal-core-val').textContent = d.coreLevel;
  document.getElementById('modal-s1').value = d.skill1;
  document.getElementById('modal-s1-val').textContent = d.skill1;
  document.getElementById('modal-s2').value = d.skill2;
  document.getElementById('modal-s2-val').textContent = d.skill2;
  document.getElementById('modal-burst').value = d.burstSkill;
  document.getElementById('modal-burst-val').textContent = d.burstSkill;

  const ciGroup = document.getElementById('collection-item-group');
  ciGroup.style.display = c.hasTreasure ? '' : 'none';
  document.getElementById('modal-collection-item').checked = d.hasCollectionItem;

  document.getElementById('modal-tier-story').value = d.tierStory || '';
  document.getElementById('modal-tier-bossing').value = d.tierBossing || '';
  document.getElementById('modal-tier-pvp').value = d.tierPvp || '';

  EQUIPMENT_SLOTS.forEach(slot => {
    const eq = d.equipment[slot] || { equipped: 'none', overloaded: false, olSubStats: [] };
    const slotEl = document.querySelector(`.equip-slot[data-slot="${slot}"]`);
    slotEl.querySelector(`input[name="eq-${slot}"][value="${eq.equipped}"]`).checked = true;

    const olToggle = slotEl.querySelector('.ol-toggle');
    olToggle.checked = eq.overloaded;
    const olArea = slotEl.querySelector(`[data-ol-area="${slot}"]`);
    olArea.classList.toggle('hidden', !eq.overloaded);

    slotEl.querySelectorAll('.ol-stat-chip').forEach(chip => {
      const cb = chip.querySelector('input');
      const stat = cb.value;
      cb.checked = eq.olSubStats.includes(stat);
      chip.classList.toggle('active', cb.checked);
    });
  });

  document.getElementById('modal-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.body.style.overflow = '';
  currentModalChar = null;
}

function saveModal() {
  if (!currentModalChar) return;
  const c = currentModalChar;

  const equipment = {};
  EQUIPMENT_SLOTS.forEach(slot => {
    const slotEl = document.querySelector(`.equip-slot[data-slot="${slot}"]`);
    const equipped = slotEl.querySelector(`input[name="eq-${slot}"]:checked`).value;
    const overloaded = slotEl.querySelector('.ol-toggle').checked;
    const olSubStats = [];
    if (overloaded) {
      slotEl.querySelectorAll('.ol-stat-chip input:checked').forEach(cb => {
        olSubStats.push(cb.value);
      });
    }
    equipment[slot] = { equipped, overloaded, olSubStats };
  });

  const data = {
    owned: document.getElementById('modal-owned').checked,
    coreLevel: parseInt(document.getElementById('modal-core').value),
    skill1: parseInt(document.getElementById('modal-s1').value),
    skill2: parseInt(document.getElementById('modal-s2').value),
    burstSkill: parseInt(document.getElementById('modal-burst').value),
    hasCollectionItem: document.getElementById('modal-collection-item').checked,
    tierStory: document.getElementById('modal-tier-story').value || null,
    tierBossing: document.getElementById('modal-tier-bossing').value || null,
    tierPvp: document.getElementById('modal-tier-pvp').value || null,
    equipment
  };

  saveCharacter(c.unitId, data);
  closeModal();
  render();
  showToast('Saved');
}

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  importJSON(file).then(() => {
    render();
    showToast('Import successful');
  }).catch(err => {
    showToast('Import failed: ' + err.message);
  });
  e.target.value = '';
}

function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', init);
