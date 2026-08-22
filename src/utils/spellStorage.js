const ARCHIVE_KEY = "spellCrafter.archive.v1";
const DRAFT_KEY = "spellCrafter.draft.v1";

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_error) {
    return fallback;
  }
}

export function loadDraft() {
  return safeParse(localStorage.getItem(DRAFT_KEY), null);
}

export function saveDraft(spell) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(spell));
}

export function loadArchive() {
  return safeParse(localStorage.getItem(ARCHIVE_KEY), []);
}

export function saveArchive(spells) {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(spells));
}

export function upsertArchivedSpell(spell) {
  const archive = loadArchive();
  const id = spell.id || crypto.randomUUID();
  const entry = { ...spell, id, updatedAt: new Date().toISOString() };
  const existingIndex = archive.findIndex((candidate) => candidate.id === id);
  if (existingIndex >= 0) archive[existingIndex] = entry;
  else archive.unshift(entry);
  saveArchive(archive);
  return archive;
}

export function deleteArchivedSpell(id) {
  const archive = loadArchive().filter((spell) => spell.id !== id);
  saveArchive(archive);
  return archive;
}

export function exportJson(spell) {
  const clean = JSON.stringify(spell, null, 2);
  const blob = new Blob([clean], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${spell.name || "spell"}.json`.replace(/[^a-z0-9_.-]+/gi, "_");
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
