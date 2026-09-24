// Save transfer: moves one child's progress from one device to another as a
// small text file (or a pasted code). Pure logic only: no Phaser, no DOM, no
// imports, so tests can drive it with a Map-backed storage. The screen that
// uses it lives in transferSheet.js.
//
// Only the keys in TRANSFER_KEYS are ever read or written. The storage area is
// shared with every other app on the same GitHub Pages address, so this module
// never lists, dumps or clears the whole store.

export const TRANSFER_KEYS = Object.freeze([
  'cosmicMathProgress',
  'cosmicMathRecords',
  'cosmicMathParentPin',
  'cosmicMathMusicEnabled',
  'cosmicMathSfxEnabled',
  'conveyorInputMode',
]);

// Keys the game knows about but deliberately leaves behind. The PIN's made-on
// date, a waiting one-day reset and the wrong-try pause belong to this device
// (see parentPin.js).
export const NOT_TRANSFERRED = Object.freeze([
  'cosmicMathAchievements',
  'cosmicMathParentPinInfo',
  'cosmicMathPinReset',
  'cosmicMathPinGuard',
  'cosmicMathDevMenuGuard',
]);

// A file without a PIN leaves this device's PIN alone (see writeKeys).
const PIN_KEY = 'cosmicMathParentPin';

// One copy of whatever this device had before the last import, for Undo.
export const TRANSFER_BACKUP_KEY = 'cosmicMathTransferBackup';

export const TRANSFER_FORMAT = 1;
export const MAX_TRANSFER_CHARS = 1_000_000;
export const BLOCK_BEGIN = '[COSMIC-HOME-SAVE]';
export const BLOCK_END = '[END COSMIC-HOME-SAVE]';
export const TOTAL_FACTS = 78; // every a x b with 1 <= a <= b <= 12

const APP = 'cosmic-home';
const KIND = 'save-transfer';
const BACKUP_KIND = 'transfer-backup';
const LINE_WIDTH = 76;

export const TRANSFER_MESSAGES = Object.freeze({
  empty: 'Nothing to read yet. Choose the save file, or paste the save code.',
  tooBig: 'That file is too big to be a Cosmic Home save. Check that you picked the right file.',
  notASave: 'That is not a Cosmic Home save. Look for the file named "Cosmic Home save".',
  damaged: 'This save is damaged or cut off. Send it again from the old device.',
  tooNew: 'This save came from a newer version of Cosmic Home. Close the game completely, open it again, then try again.',
  noProgress: 'This save has no game progress in it. Send it again from the old device.',
  storageFailed: 'This device could not store the progress, so nothing was changed.',
  noBackup: 'There is no import to undo.',
});

function fail(error) {
  return { ok: false, error, message: TRANSFER_MESSAGES[error] };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

// FNV-1a over UTF-16 code units. Not security, just a tripwire for a code that
// still decodes but had a character changed along the way.
export function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function base64ToUtf8(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function wrapLines(str, width) {
  const lines = [];
  for (let i = 0; i < str.length; i += width) lines.push(str.slice(i, i + width));
  return lines.join('\n');
}

function localDate(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readKeys(storage) {
  const keys = {};
  for (const key of TRANSFER_KEYS) {
    const value = storage.getItem(key);
    if (value !== null && value !== undefined) keys[key] = value;
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Save preview
// ---------------------------------------------------------------------------

const STAGE_ORDER = ['egg', 'baby', 'teen', 'adult'];

// Mirrors CompanionManager.isStageUnlocked / getActiveStage, but over raw save
// data instead of the live singleton. A test keeps the two in step.
function stageUnlocked(cmp, stage) {
  if (stage === 'cosmic') return !!cmp.cosmicForm;
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx < 0) return false;
  return STAGE_ORDER.indexOf(cmp.stage || 'egg') >= idx;
}

function activeStage(cmp) {
  if (cmp.displayStage && stageUnlocked(cmp, cmp.displayStage)) return cmp.displayStage;
  if (cmp.cosmicForm && cmp.stage === 'adult') return 'cosmic';
  return cmp.stage || 'egg';
}

function emptySummary() {
  return {
    readable: true,
    isEmpty: true,
    speciesId: null,
    petName: null,
    unknownPet: false,
    stars: 0,
    worldsCleared: 0,
    furthestWorld: null,
    factsPracticed: 0,
    factsTotal: TOTAL_FACTS,
    answers: 0,
    levelsMastered: 0,
  };
}

// catalog = { worlds: getActiveWorlds(), species: SPECIES }
export function describeSave(progressRaw, catalog) {
  const summary = emptySummary();
  if (progressRaw === null || progressRaw === undefined) return summary;
  let data;
  try {
    data = JSON.parse(progressRaw);
  } catch (e) {
    return { ...summary, readable: false };
  }
  if (!isPlainObject(data)) return { ...summary, readable: false };

  const cmp = isPlainObject(data.companion) ? data.companion : {};
  const speciesId = typeof cmp.speciesId === 'string' && cmp.speciesId ? cmp.speciesId : null;
  const species = speciesId && hasOwn(catalog.species, speciesId) ? catalog.species[speciesId] : null;
  summary.speciesId = speciesId;
  summary.unknownPet = !!speciesId && !species;
  if (species) {
    const stage = activeStage(cmp);
    summary.petName = species.stages?.[stage]?.name || species.stages?.egg?.name || species.name;
  }

  summary.stars = Number.isFinite(data.totalStars) && data.totalStars > 0 ? data.totalStars : 0;

  // Furthest world is judged by stars actually earned, not by `unlocked`: old
  // Chapter 3 saves can carry unlocked-but-unplayed stops that the loader
  // re-locks (migrateChapter3Order).
  const worldProgress = isPlainObject(data.worldProgress) ? data.worldProgress : {};
  let anyWorldStars = false;
  for (const world of catalog.worlds) {
    const wp = worldProgress[world.id];
    const levelStars = isPlainObject(wp?.levelStars) ? wp.levelStars : {};
    if (Object.keys(levelStars).length >= world.levelsRequired) summary.worldsCleared++;
    // Old saves have no levelMastered; the loader counts starred levels as
    // mastered for them (GameData mergeWorldProgress), so do the same here.
    summary.levelsMastered += isPlainObject(wp?.levelMastered)
      ? Object.values(wp.levelMastered).filter(Boolean).length
      : Object.values(levelStars).filter(v => v > 0).length;
    if (Object.values(levelStars).some(v => v > 0)) {
      summary.furthestWorld = world.name;
      anyWorldStars = true;
    }
  }

  const facts = isPlainObject(data.factMastery) ? data.factMastery : {};
  for (const [key, fact] of Object.entries(facts)) {
    const m = /^(\d+)x(\d+)$/.exec(key);
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a < 1 || a > 12 || b < 1 || b > 12) continue;
    if (isPlainObject(fact) && Number.isFinite(fact.total) && fact.total > 0) {
      summary.factsPracticed++;
      summary.answers += fact.total;
    }
  }

  // The pet is ignored on purpose: a fresh device has to pick a pet before the
  // parent dashboard can be reached, and that alone is not progress.
  summary.isEmpty = summary.stars === 0 && summary.factsPracticed === 0 && !anyWorldStars;
  return summary;
}

// True when `summary` is ahead of `other` on anything a kid earns by playing.
// Stars, facts and cleared worlds stop growing late in the game, so mastered
// levels (which unlock worlds) and total answers are compared too.
export function hasMoreProgress(summary, other) {
  return summary.stars > other.stars
    || summary.factsPracticed > other.factsPracticed
    || summary.worldsCleared > other.worldsCleared
    || summary.levelsMastered > other.levelsMastered
    || summary.answers > other.answers;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function transferFileName(summary, now) {
  const parts = ['Cosmic Home save'];
  if (summary.petName) parts.push(summary.petName);
  parts.push(localDate(now));
  return `${parts.join(' - ').replace(/[\\/:*?"<>|]/g, '')}.txt`;
}

function transferHeader(summary, now) {
  const lines = ['Cosmic Home save file'];
  if (summary.petName) lines.push(`Pet: ${summary.petName}`);
  lines.push(`Stars: ${summary.stars}`);
  lines.push(`Saved: ${localDate(now)}`);
  lines.push('This file moves a child\'s progress to another device.');
  lines.push('On the new device, open Cosmic Home. If it asks you to pick a pet,');
  lines.push('pick any one: the old pet comes back after the move.');
  lines.push('Then tap the gear. If it asks you to make a grown-up PIN, make one.');
  lines.push('Then go to Settings, Move to a New Device, Receive progress.');
  lines.push('After the move, the grown-up PIN is the one from the old device.');
  return lines.join('\n');
}

// Reads only. Returns the text that goes into the file (and the clipboard),
// the file name, and a summary for the screen.
export function buildTransferCode(storage, { now = Date.now(), catalog }) {
  const keys = readKeys(storage);
  const summary = describeSave(hasOwn(keys, 'cosmicMathProgress') ? keys.cosmicMathProgress : null, catalog);
  const envelope = {
    app: APP,
    kind: KIND,
    format: TRANSFER_FORMAT,
    exportedAt: new Date(now).toISOString(),
    check: fnv1a32(JSON.stringify(keys)),
    keys,
  };
  const code = wrapLines(utf8ToBase64(JSON.stringify(envelope)), LINE_WIDTH);
  const text = `${transferHeader(summary, now)}\n\n${BLOCK_BEGIN}\n${code}\n${BLOCK_END}\n`;
  return { text, fileName: transferFileName(summary, now), summary };
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

function validateProgress(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return false;
  }
  if (!isPlainObject(data)) return false;
  const fields = ['worldProgress', 'factMastery', 'companion'];
  if (!fields.some(f => hasOwn(data, f))) return false;
  for (const f of fields) {
    if (data[f] !== undefined && data[f] !== null && !isPlainObject(data[f])) return false;
  }
  if (data.totalStars !== undefined && !(Number.isFinite(data.totalStars) && data.totalStars >= 0)) return false;
  return true;
}

function validateKeyValue(key, value) {
  switch (key) {
    case 'cosmicMathRecords': {
      try {
        return isPlainObject(JSON.parse(value));
      } catch (e) {
        return false;
      }
    }
    case 'cosmicMathParentPin':
      // Anything but four digits would lock the dashboard for good.
      return /^\d{4}$/.test(value);
    case 'cosmicMathMusicEnabled':
    case 'cosmicMathSfxEnabled':
      return value === '0' || value === '1';
    case 'conveyorInputMode':
      return value.length <= 32;
    default:
      return true;
  }
}

// Returns { ok: true, keys, exportedAt, ignoredKeys } or { ok: false, error, message }.
// Tolerates wrapped lines, CRLF, text around the block and a bare code.
export function parseTransferCode(text) {
  if (typeof text !== 'string' || !text.trim()) return fail('empty');
  if (text.length > MAX_TRANSFER_CHARS) return fail('tooBig');

  let body = text;
  let framed = false;
  const begin = text.indexOf(BLOCK_BEGIN);
  if (begin >= 0) {
    const end = text.indexOf(BLOCK_END, begin + BLOCK_BEGIN.length);
    if (end < 0) return fail('damaged');
    body = text.slice(begin + BLOCK_BEGIN.length, end);
    framed = true;
  }
  // A bare paste that fails to decode is most likely not ours at all.
  const decodeError = framed ? 'damaged' : 'notASave';

  let b64 = body.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  if (!b64 || !/^[A-Za-z0-9+/]+$/.test(b64) || b64.length % 4 === 1) return fail(decodeError);
  while (b64.length % 4) b64 += '=';

  let envelope;
  try {
    envelope = JSON.parse(base64ToUtf8(b64));
  } catch (e) {
    return fail(decodeError);
  }
  if (!isPlainObject(envelope) || envelope.app !== APP || envelope.kind !== KIND) return fail('notASave');
  if (!Number.isInteger(envelope.format) || envelope.format < 1) return fail('damaged');
  if (envelope.format > TRANSFER_FORMAT) return fail('tooNew');
  if (!isPlainObject(envelope.keys)) return fail('damaged');
  if (envelope.check !== fnv1a32(JSON.stringify(envelope.keys))) return fail('damaged');

  const keys = {};
  const ignoredKeys = [];
  for (const [key, value] of Object.entries(envelope.keys)) {
    if (!TRANSFER_KEYS.includes(key)) {
      ignoredKeys.push(key);
      continue;
    }
    if (typeof value !== 'string') return fail('damaged');
    keys[key] = value;
  }

  if (!hasOwn(keys, 'cosmicMathProgress')) return fail('noProgress');
  if (!validateProgress(keys.cosmicMathProgress)) return fail('damaged');
  for (const [key, value] of Object.entries(keys)) {
    if (!validateKeyValue(key, value)) return fail('damaged');
  }

  const exportedAtMs = typeof envelope.exportedAt === 'string' ? Date.parse(envelope.exportedAt) : NaN;
  return {
    ok: true,
    keys,
    exportedAt: Number.isFinite(exportedAtMs) ? exportedAtMs : null,
    ignoredKeys,
  };
}

// True when the file brings its own grown-up PIN along.
export function carriesPin(keys) {
  return isPlainObject(keys) && hasOwn(keys, PIN_KEY);
}

// True when importing these values would change nothing here (absent ==
// absent, except that a file without a PIN keeps this device's PIN).
export function sameSaves(keys, storage) {
  return TRANSFER_KEYS.every(key => {
    if (key === PIN_KEY && !carriesPin(keys)) return true;
    const incoming = hasOwn(keys, key) ? keys[key] : null;
    return incoming === storage.getItem(key);
  });
}

function snapshot(storage, list) {
  const out = {};
  for (const key of list) out[key] = storage.getItem(key);
  return out;
}

function restoreSnapshot(storage, snap) {
  for (const [key, value] of Object.entries(snap)) {
    try {
      if (value === null || value === undefined) storage.removeItem(key);
      else storage.setItem(key, value);
    } catch (e) { /* best effort */ }
  }
}

// Replace rule: every transfer key the file has is set, every one it lacks is
// removed, nothing else is touched. The one exception is the grown-up PIN: a
// file (or Undo copy) without one leaves this device's PIN alone. Removing it
// would leave the device with no PIN, open to whoever taps the gear next.
function writeKeys(storage, keys) {
  for (const key of TRANSFER_KEYS) {
    if (hasOwn(keys, key)) storage.setItem(key, keys[key]);
    else if (key !== PIN_KEY) storage.removeItem(key);
  }
}

// Saves the current values as the Undo copy, then writes the file's values.
// Any failed write puts everything back the way it was.
export function applyTransfer(storage, keys, { now = Date.now() } = {}) {
  if (!isPlainObject(keys) || !Object.values(keys).every(v => typeof v === 'string')) return fail('damaged');
  const before = snapshot(storage, [...TRANSFER_KEYS, TRANSFER_BACKUP_KEY]);
  const backupKeys = {};
  for (const key of TRANSFER_KEYS) {
    if (before[key] !== null && before[key] !== undefined) backupKeys[key] = before[key];
  }
  const backup = {
    app: APP,
    kind: BACKUP_KIND,
    format: TRANSFER_FORMAT,
    savedAt: new Date(now).toISOString(),
    keys: backupKeys,
  };
  try {
    storage.setItem(TRANSFER_BACKUP_KEY, JSON.stringify(backup));
    writeKeys(storage, keys);
  } catch (e) {
    // Free the new Undo copy first: it holds a full duplicate of the old
    // values, so without it every old value is sure to fit back in. The
    // snapshot lists the old Undo copy last, so it is restored after them.
    try { storage.removeItem(TRANSFER_BACKUP_KEY); } catch (e2) { /* best effort */ }
    restoreSnapshot(storage, before);
    return fail('storageFailed');
  }
  return { ok: true };
}

// Returns { savedAt, keys } or null when there is no usable Undo copy.
export function readBackup(storage) {
  const raw = storage.getItem(TRANSFER_BACKUP_KEY);
  if (raw === null || raw === undefined) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  if (!isPlainObject(data) || data.app !== APP || data.kind !== BACKUP_KIND || !isPlainObject(data.keys)) return null;
  const keys = {};
  for (const [key, value] of Object.entries(data.keys)) {
    if (!TRANSFER_KEYS.includes(key) || typeof value !== 'string') return null;
    keys[key] = value;
  }
  const savedAt = typeof data.savedAt === 'string' ? Date.parse(data.savedAt) : NaN;
  return { savedAt: Number.isFinite(savedAt) ? savedAt : null, keys };
}

// Puts back what this device had before the last import, then drops the Undo copy.
export function undoLastImport(storage) {
  const backup = readBackup(storage);
  if (!backup) return fail('noBackup');
  const before = snapshot(storage, [...TRANSFER_KEYS, TRANSFER_BACKUP_KEY]);
  try {
    writeKeys(storage, backup.keys);
    storage.removeItem(TRANSFER_BACKUP_KEY);
  } catch (e) {
    restoreSnapshot(storage, before);
    return fail('storageFailed');
  }
  return { ok: true };
}
