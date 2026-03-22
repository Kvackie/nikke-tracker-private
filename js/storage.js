const STORAGE_KEY = 'nikke_collection';

function getCollection() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCollection(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getCharacter(unitId) {
  const col = getCollection();
  if (col[unitId]) return col[unitId];
  return defaultCharData();
}

function saveCharacter(unitId, data) {
  const col = getCollection();
  col[unitId] = data;
  saveCollection(col);
}

function exportJSON() {
  const col = getCollection();
  const blob = new Blob([JSON.stringify(col, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'nikke_collection_' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        const col = getCollection();
        for (const [id, data] of Object.entries(imported)) {
          col[id] = data;
        }
        saveCollection(col);
        resolve(true);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function clearCollection() {
  localStorage.removeItem(STORAGE_KEY);
}
