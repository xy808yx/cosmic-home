import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test, { beforeEach } from 'node:test';

// All persistence stays inside this Node process. The real save manager and
// pet catalog are used, without touching any browser save.
const saved = new Map();
globalThis.localStorage = {
  getItem: key => (saved.has(key) ? saved.get(key) : null),
  setItem: (key, value) => saved.set(key, String(value)),
  removeItem: key => saved.delete(key),
};
const gameData = await import('../src/GameData.js');
const { SPECIES, companion } = await import('../src/CompanionManager.js');
const transfer = await import('../src/saveTransfer.js');
const {
  TRANSFER_KEYS, NOT_TRANSFERRED, TRANSFER_BACKUP_KEY, TRANSFER_MESSAGES, BLOCK_BEGIN, BLOCK_END,
  MAX_TRANSFER_CHARS, buildTransferCode, parseTransferCode, describeSave, applyTransfer, readBackup,
  undoLastImport, sameSaves, transferFileName, fnv1a32, hasMoreProgress,
} = transfer;
const { progress } = gameData;

const catalog = { worlds: gameData.getActiveWorlds(), species: SPECIES };
const NOW = Date.parse('2026-09-23T19:41:07.000Z');

function makeStorage(entries = {}, { failSetOn = null, failRemoveOn = null } = {}) {
  const map = new Map(Object.entries(entries));
  return {
    map,
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem(key, value) {
      if (failSetOn && failSetOn(key)) throw new Error('QuotaExceededError');
      map.set(key, String(value));
    },
    removeItem(key) {
      if (failRemoveOn && failRemoveOn(key)) throw new Error('blocked');
      map.delete(key);
    },
  };
}

// Builds a transfer text from an arbitrary envelope, for the rejection cases.
function encodeEnvelope(envelope, { frame = true } = {}) {
  const bytes = new TextEncoder().encode(JSON.stringify(envelope));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  return frame ? `${BLOCK_BEGIN}\n${b64}\n${BLOCK_END}\n` : b64;
}

function envelopeFor(keys, overrides = {}) {
  return {
    app: 'cosmic-home',
    kind: 'save-transfer',
    format: 1,
    exportedAt: new Date(NOW).toISOString(),
    check: fnv1a32(JSON.stringify(keys)),
    keys,
    ...overrides,
  };
}

const PROGRESS_OK = JSON.stringify({
  worldProgress: { 1: { unlocked: true, levelsCompleted: 1, starsEarned: 3, levelStars: { 1: 3 }, levelMastered: { 1: true } } },
  factMastery: { '3x7': { correct: 4, total: 5 } },
  totalStars: 3,
  companion: { speciesId: 'ember', stage: 'baby' },
});

beforeEach(() => {
  saved.clear();
  progress.reset();
});

test('round trip is byte-exact for every transferred key, including odd characters', () => {
  const big = 'x'.repeat(50_000);
  const entries = {
    cosmicMathProgress: JSON.stringify({
      companion: { speciesId: 'tide', stage: 'teen' },
      note: 'emoji 🐙 "quotes" \\ back\r\nCRLF   line-sep \uD800 lone surrogate',
      big,
    }),
    cosmicMathRecords: JSON.stringify({ fastestPerFact: { '3x7': 812 }, note: 'üñî 🎉' }),
    cosmicMathParentPin: '4321',
    cosmicMathMusicEnabled: '0',
    cosmicMathSfxEnabled: '1',
    conveyorInputMode: 'recognition',
  };
  const source = makeStorage(entries);
  const { text } = buildTransferCode(source, { now: NOW, catalog });
  const parsed = parseTransferCode(text);
  assert.equal(parsed.ok, true);
  const target = makeStorage();
  assert.equal(applyTransfer(target, parsed.keys, { now: NOW }).ok, true);
  for (const key of TRANSFER_KEYS) assert.equal(target.getItem(key), entries[key], key);
});

test('absent keys stay absent after a round trip', () => {
  const source = makeStorage({ cosmicMathProgress: PROGRESS_OK });
  const parsed = parseTransferCode(buildTransferCode(source, { now: NOW, catalog }).text);
  assert.deepEqual(Object.keys(parsed.keys), ['cosmicMathProgress']);
  const target = makeStorage({ cosmicMathParentPin: '9999', cosmicMathMusicEnabled: '0' });
  applyTransfer(target, parsed.keys, { now: NOW });
  assert.equal(target.getItem('cosmicMathParentPin'), null);
  assert.equal(target.getItem('cosmicMathMusicEnabled'), null);
  assert.equal(target.getItem('cosmicMathProgress'), PROGRESS_OK);
});

test('a real save moved to a fresh store loads back identically', () => {
  progress.devClearAllWorlds();
  for (let a = 1; a <= 12; a++) {
    for (let b = a; b <= 12; b++) progress.recordFactAttempt(a, b, true, 900);
  }
  companion.pickStarter('tide');
  progress.companion.stage = 'adult';
  progress.save();
  const snapshot = {
    worldProgress: structuredClone(progress.worldProgress),
    factMastery: structuredClone(progress.factMastery),
    totalStars: progress.totalStars,
    companion: structuredClone(progress.companion),
  };
  const rawBefore = saved.get('cosmicMathProgress');
  const { text, summary } = buildTransferCode(localStorage, { now: NOW, catalog });
  assert.equal(summary.petName, 'Tidalord');
  assert.equal(summary.factsPracticed, 78);

  // "New iPad": empty store, then import, then the game's own loader.
  saved.clear();
  progress.reset();
  const parsed = parseTransferCode(text);
  assert.equal(parsed.ok, true);
  assert.equal(applyTransfer(localStorage, parsed.keys, { now: NOW }).ok, true);
  assert.equal(saved.get('cosmicMathProgress'), rawBefore);
  progress.load();
  assert.deepEqual(progress.worldProgress, snapshot.worldProgress);
  assert.deepEqual(progress.factMastery, snapshot.factMastery);
  assert.equal(progress.totalStars, snapshot.totalStars);
  assert.deepEqual(progress.companion, snapshot.companion);
});

test('an old save without ch3OrderRev imports byte-exact and migrates only on load', () => {
  progress.devClearAllWorlds();
  const data = JSON.parse(saved.get('cosmicMathProgress'));
  delete data.ch3OrderRev;
  const raw = JSON.stringify(data);
  const source = makeStorage({ cosmicMathProgress: raw });
  const parsed = parseTransferCode(buildTransferCode(source, { now: NOW, catalog }).text);
  saved.clear();
  applyTransfer(localStorage, parsed.keys, { now: NOW });
  assert.equal(saved.get('cosmicMathProgress'), raw);
  progress.load();
  assert.equal(progress.ch3OrderRev, 2);
  assert.equal(JSON.parse(saved.get('cosmicMathProgress')).ch3OrderRev, 2);
});

test('parsing tolerates wrapping, CRLF, surrounding text, URL-safe letters and bare codes', () => {
  const source = makeStorage({ cosmicMathProgress: PROGRESS_OK, cosmicMathParentPin: '1234' });
  const { text } = buildTransferCode(source, { now: NOW, catalog });
  const begin = text.indexOf(BLOCK_BEGIN) + BLOCK_BEGIN.length;
  const code = text.slice(begin, text.indexOf(BLOCK_END)).replace(/\s+/g, '');
  const variants = [
    text.replace(/\n/g, '\r\n'),
    `${BLOCK_BEGIN}\n${code.match(/.{1,40}/g).join('\n')}\n${BLOCK_END}`,
    `Hi! Here is the save.\n\n${text}\nLove, Dad`,
    `${BLOCK_BEGIN}${code.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}${BLOCK_END}`,
    code,
    `  ${code.match(/.{1,50}/g).join(' \n ')}  `,
  ];
  for (const variant of variants) {
    const parsed = parseTransferCode(variant);
    assert.equal(parsed.ok, true, variant.slice(0, 60));
    assert.equal(parsed.keys.cosmicMathParentPin, '1234');
    assert.equal(parsed.exportedAt, NOW);
  }
});

test('every bad input is refused with its exact message', () => {
  const good = { cosmicMathProgress: PROGRESS_OK };
  const withKeys = keys => encodeEnvelope(envelopeFor(keys));
  const cases = [
    ['blank', '', 'empty'],
    ['spaces', '   \n ', 'empty'],
    ['not a string', null, 'empty'],
    ['oversize', 'A'.repeat(MAX_TRANSFER_CHARS + 1), 'tooBig'],
    ['random prose', 'Remember to buy milk and eggs!', 'notASave'],
    ['begin without end', `${BLOCK_BEGIN}\nabcd`, 'damaged'],
    ['truncated code', withKeys(good).replace(/(\n)([A-Za-z0-9+/=]{20})[A-Za-z0-9+/=]*\n/, '$1$2\n'), 'damaged'],
    ['base64 of non-JSON', `${BLOCK_BEGIN}\n${btoa('hello there, not json')}\n${BLOCK_END}`, 'damaged'],
    ['other app', encodeEnvelope(envelopeFor(good, { app: 'star-jar' })), 'notASave'],
    ['wrong kind', encodeEnvelope(envelopeFor(good, { kind: 'transfer-backup' })), 'notASave'],
    ['newer format', encodeEnvelope(envelopeFor(good, { format: 2 })), 'tooNew'],
    ['string format', encodeEnvelope(envelopeFor(good, { format: '1' })), 'damaged'],
    ['zero format', encodeEnvelope(envelopeFor(good, { format: 0 })), 'damaged'],
    ['keys not an object', encodeEnvelope(envelopeFor(good, { keys: ['x'] })), 'damaged'],
    ['wrong check', encodeEnvelope(envelopeFor(good, { check: '00000000' })), 'damaged'],
    ['no progress', withKeys({ cosmicMathParentPin: '1234' }), 'noProgress'],
    ['progress null', withKeys({ cosmicMathProgress: 'null' }), 'damaged'],
    ['progress array', withKeys({ cosmicMathProgress: '[]' }), 'damaged'],
    ['progress not JSON', withKeys({ cosmicMathProgress: '{oops' }), 'damaged'],
    ['progress no fields', withKeys({ cosmicMathProgress: '{"totalStars":3}' }), 'damaged'],
    ['progress bad field', withKeys({ cosmicMathProgress: '{"worldProgress":"x"}' }), 'damaged'],
    ['progress bad stars', withKeys({ cosmicMathProgress: '{"factMastery":{},"totalStars":-1}' }), 'damaged'],
    ['non-string value', withKeys({ cosmicMathProgress: PROGRESS_OK, cosmicMathSfxEnabled: 1 }), 'damaged'],
    ['long PIN', withKeys({ ...good, cosmicMathParentPin: '12345' }), 'damaged'],
    ['letter PIN', withKeys({ ...good, cosmicMathParentPin: '12a4' }), 'damaged'],
    ['music yes', withKeys({ ...good, cosmicMathMusicEnabled: 'yes' }), 'damaged'],
    ['records not JSON', withKeys({ ...good, cosmicMathRecords: 'nope' }), 'damaged'],
    ['records array', withKeys({ ...good, cosmicMathRecords: '[1]' }), 'damaged'],
    ['long conveyor mode', withKeys({ ...good, conveyorInputMode: 'r'.repeat(33) }), 'damaged'],
  ];
  for (const [label, input, error] of cases) {
    const started = performance.now();
    const result = parseTransferCode(input);
    assert.equal(result.ok, false, label);
    assert.equal(result.error, error, label);
    assert.equal(result.message, TRANSFER_MESSAGES[error], label);
    assert.ok(performance.now() - started < 500, `${label} answered quickly`);
  }
});

test('keys that are not ours are ignored and never written', () => {
  const keys = { cosmicMathProgress: PROGRESS_OK, otherAppSave: 'x', [TRANSFER_BACKUP_KEY]: '{}' };
  const parsed = parseTransferCode(encodeEnvelope(envelopeFor(keys)));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.ignoredKeys.sort(), ['cosmicMathTransferBackup', 'otherAppSave']);
  const target = makeStorage();
  applyTransfer(target, parsed.keys, { now: NOW });
  assert.equal(target.getItem('otherAppSave'), null);
  assert.deepEqual(readBackup(target), { savedAt: NOW, keys: {} });
});

test('replace rule: file keys set, missing keys removed, other apps untouched', () => {
  const target = makeStorage({
    cosmicMathProgress: '{"factMastery":{}}',
    cosmicMathRecords: '{}',
    cosmicMathParentPin: '1111',
    cosmicMathMusicEnabled: '1',
    cosmicMathSfxEnabled: '1',
    conveyorInputMode: 'recognition',
    starJarState: 'keep me',
  });
  const keys = { cosmicMathProgress: PROGRESS_OK, cosmicMathParentPin: '2222', cosmicMathSfxEnabled: '0' };
  assert.equal(applyTransfer(target, keys, { now: NOW }).ok, true);
  assert.equal(target.getItem('cosmicMathProgress'), PROGRESS_OK);
  assert.equal(target.getItem('cosmicMathParentPin'), '2222');
  assert.equal(target.getItem('cosmicMathSfxEnabled'), '0');
  assert.equal(target.getItem('cosmicMathRecords'), null);
  assert.equal(target.getItem('cosmicMathMusicEnabled'), null);
  assert.equal(target.getItem('conveyorInputMode'), null);
  assert.equal(target.getItem('starJarState'), 'keep me');
});

test('import keeps an Undo copy, and Undo puts back exactly what was there', () => {
  const before = {
    cosmicMathProgress: '{"factMastery":{"2x2":{"total":1}}}',
    cosmicMathParentPin: '7777',
  };
  const target = makeStorage({ ...before, starJarState: 'keep me' });
  applyTransfer(target, { cosmicMathProgress: PROGRESS_OK, cosmicMathRecords: '{}', cosmicMathMusicEnabled: '0' }, { now: NOW });
  const backup = readBackup(target);
  assert.deepEqual(backup, { savedAt: NOW, keys: before });
  assert.equal(undoLastImport(target).ok, true);
  for (const key of TRANSFER_KEYS) assert.equal(target.getItem(key), before[key] ?? null, key);
  assert.equal(target.getItem(TRANSFER_BACKUP_KEY), null);
  assert.equal(target.getItem('starJarState'), 'keep me');
  const again = undoLastImport(target);
  assert.equal(again.ok, false);
  assert.equal(again.message, TRANSFER_MESSAGES.noBackup);
});

test('a broken Undo copy is treated as no Undo', () => {
  for (const raw of ['nope', '{}', JSON.stringify({ app: 'cosmic-home', kind: 'transfer-backup', keys: { cosmicMathProgress: 5 } })]) {
    const target = makeStorage({ [TRANSFER_BACKUP_KEY]: raw });
    assert.equal(readBackup(target), null);
    assert.equal(undoLastImport(target).error, 'noBackup');
  }
});

test('a failed write mid-import puts every key back, including the old Undo copy', () => {
  const entries = {
    cosmicMathProgress: '{"factMastery":{}}',
    cosmicMathRecords: '{"totalCorrect":5}',
    cosmicMathParentPin: '1111',
    [TRANSFER_BACKUP_KEY]: JSON.stringify({ app: 'cosmic-home', kind: 'transfer-backup', format: 1, savedAt: 'x', keys: {} }),
  };
  let armed = true;
  const target = makeStorage(entries, { failSetOn: key => armed && key === 'cosmicMathRecords' });
  const result = applyTransfer(target, { cosmicMathProgress: PROGRESS_OK, cosmicMathRecords: '{}' }, { now: NOW });
  armed = false;
  assert.equal(result.ok, false);
  assert.equal(result.message, TRANSFER_MESSAGES.storageFailed);
  for (const [key, value] of Object.entries(entries)) assert.equal(target.getItem(key), value, key);
});

test('a failed Undo copy write changes nothing', () => {
  const entries = { cosmicMathProgress: '{"factMastery":{}}' };
  const target = makeStorage(entries, { failSetOn: key => key === TRANSFER_BACKUP_KEY });
  const result = applyTransfer(target, { cosmicMathProgress: PROGRESS_OK }, { now: NOW });
  assert.equal(result.error, 'storageFailed');
  assert.deepEqual(Object.fromEntries(target.map), entries);
});

test('export only reads', () => {
  const store = makeStorage({ cosmicMathProgress: PROGRESS_OK }, { failSetOn: () => true, failRemoveOn: () => true });
  const { text } = buildTransferCode(store, { now: NOW, catalog });
  assert.ok(text.includes(BLOCK_BEGIN));
  assert.deepEqual(Object.fromEntries(store.map), { cosmicMathProgress: PROGRESS_OK });
});

test('sameSaves spots a save that is already here', () => {
  const store = makeStorage({ cosmicMathProgress: PROGRESS_OK, cosmicMathParentPin: '1234' });
  assert.equal(sameSaves({ cosmicMathProgress: PROGRESS_OK, cosmicMathParentPin: '1234' }, store), true);
  assert.equal(sameSaves({ cosmicMathProgress: PROGRESS_OK }, store), false);
  assert.equal(sameSaves({ cosmicMathProgress: PROGRESS_OK, cosmicMathParentPin: '1234', cosmicMathSfxEnabled: '0' }, store), false);
});

test('the preview reads the save the way the game does', () => {
  // Fresh save: empty, even once a pet is picked.
  assert.equal(describeSave(saved.get('cosmicMathProgress'), catalog).isEmpty, true);
  companion.pickStarter('sprout');
  const picked = describeSave(saved.get('cosmicMathProgress'), catalog);
  assert.equal(picked.isEmpty, true);
  assert.equal(picked.petName, 'Pod');

  assert.equal(describeSave(null, catalog).isEmpty, true);
  assert.equal(describeSave('{oops', catalog).readable, false);
  assert.equal(describeSave('{"companion":{"speciesId":"dragon"}}', catalog).unknownPet, true);

  // Facts count only 1..12, and only when practised.
  const facts = describeSave(JSON.stringify({
    factMastery: { '3x7': { total: 2 }, '0x5': { total: 9 }, '12x13': { total: 1 }, '4x4': { total: 0 }, junk: {} },
  }), catalog);
  assert.equal(facts.factsPracticed, 1);
  assert.equal(facts.isEmpty, false);

  // Furthest world follows earned stars, not the unlocked flag.
  const worlds = catalog.worlds;
  const wp = {
    [worlds[0].id]: { unlocked: true, levelStars: { 1: 3, 2: 2, 3: 1, 4: 1 } },
    [worlds[1].id]: { unlocked: true, levelStars: { 1: 2 } },
    [worlds[5].id]: { unlocked: true, levelStars: {} },
  };
  const played = describeSave(JSON.stringify({ worldProgress: wp, totalStars: 9 }), catalog);
  assert.equal(played.furthestWorld, worlds[1].name);
  assert.equal(played.worldsCleared, 1);
  assert.equal(played.stars, 9);
  // Ahead on any one number counts: replacing would lose that progress.
  assert.equal(hasMoreProgress(played, facts), true);
  assert.equal(hasMoreProgress(facts, played), true);
  const empty = describeSave(null, catalog);
  assert.equal(hasMoreProgress(empty, played), false);
  assert.equal(hasMoreProgress(played, empty), true);
});

test('pet names match the live companion for every stage setup', () => {
  const setups = [
    { stage: 'egg' },
    { stage: 'teen' },
    { stage: 'adult' },
    { stage: 'adult', cosmicForm: true },
    { stage: 'adult', cosmicForm: true, displayStage: 'baby' },
    { stage: 'teen', displayStage: 'adult' },
    { stage: 'adult', displayStage: 'cosmic' },
    { stage: null },
  ];
  for (const speciesId of Object.keys(SPECIES)) {
    for (const setup of setups) {
      progress.companion = { ...progress.getDefaultCompanion(), speciesId, cosmicForm: false, displayStage: null, ...setup };
      progress.save();
      const expected = SPECIES[speciesId].stages[companion.getActiveStage()].name;
      const summary = describeSave(saved.get('cosmicMathProgress'), catalog);
      assert.equal(summary.petName, expected, `${speciesId} ${JSON.stringify(setup)}`);
    }
  }
});

test('file name and header show the pet and date but never the PIN', () => {
  const store = makeStorage({
    cosmicMathProgress: JSON.stringify({ companion: { speciesId: 'tide', stage: 'adult' }, totalStars: 12 }),
    cosmicMathParentPin: '4321',
  });
  const { text, fileName } = buildTransferCode(store, { now: NOW, catalog });
  const localDay = new Date(NOW);
  const day = `${localDay.getFullYear()}-${String(localDay.getMonth() + 1).padStart(2, '0')}-${String(localDay.getDate()).padStart(2, '0')}`;
  assert.equal(fileName, `Cosmic Home save - Tidalord - ${day}.txt`);
  const header = text.slice(0, text.indexOf(BLOCK_BEGIN));
  assert.ok(header.includes('Pet: Tidalord'));
  assert.ok(!text.includes('4321'));
  for (const key of TRANSFER_KEYS) assert.ok(!text.includes(key), key);
  assert.ok(!text.includes('\u2014'));
  assert.equal(transferFileName({ petName: null }, NOW), `Cosmic Home save - ${day}.txt`);
  assert.equal(transferFileName({ petName: 'A/B:C?' }, NOW), `Cosmic Home save - ABC - ${day}.txt`);
});

async function sourceFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
    if (entry.isDirectory()) out.push(...await sourceFiles(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

test('every storage key the game uses is either moved or knowingly left behind', async () => {
  const found = new Set();
  for (const file of await sourceFiles(new URL('../src/', import.meta.url))) {
    const source = await readFile(file, 'utf8');
    for (const m of source.matchAll(/(?:get|set|remove)Item\(\s*['"]([^'"]+)['"]/g)) found.add(m[1]);
    for (const m of source.matchAll(/STORAGE_KEY\s*=\s*['"]([^'"]+)['"]/g)) found.add(m[1]);
  }
  const known = new Set([...TRANSFER_KEYS, ...NOT_TRANSFERRED, TRANSFER_BACKUP_KEY]);
  for (const key of found) assert.ok(known.has(key), `storage key "${key}" is not in TRANSFER_KEYS or NOT_TRANSFERRED`);
  for (const key of TRANSFER_KEYS) assert.ok(found.has(key), `TRANSFER_KEYS lists "${key}" but src never uses it`);
});

test('no em dashes in the transfer code or its copy', async () => {
  for (const name of ['saveTransfer.js', 'transferSheet.js']) {
    const source = await readFile(new URL(`../src/${name}`, import.meta.url), 'utf8');
    assert.ok(!source.includes('\u2014'), name);
  }
});

test('newer play that adds no stars or facts still counts as more progress', () => {
  const worlds = catalog.worlds;
  const facts = {};
  for (let a = 1; a <= 12; a++) for (let b = a; b <= 12; b++) facts[`${a}x${b}`] = { total: 3, correct: 3 };
  const levelStars = { 1: 2, 2: 2, 3: 2, 4: 2 };
  const older = {
    worldProgress: { [worlds[0].id]: { levelStars, levelMastered: { 1: true, 2: true } } },
    factMastery: facts,
    totalStars: 8,
  };
  const newer = structuredClone(older);
  newer.worldProgress[worlds[0].id].levelMastered = { 1: true, 2: true, 3: true, 4: true };
  const olderSummary = describeSave(JSON.stringify(older), catalog);
  const masteredOnly = describeSave(JSON.stringify(newer), catalog);
  assert.equal(masteredOnly.stars, olderSummary.stars);
  assert.equal(masteredOnly.factsPracticed, olderSummary.factsPracticed);
  assert.equal(masteredOnly.worldsCleared, olderSummary.worldsCleared);
  assert.equal(hasMoreProgress(masteredOnly, olderSummary), true);
  assert.equal(hasMoreProgress(olderSummary, masteredOnly), false);

  const moreAnswers = structuredClone(older);
  moreAnswers.factMastery['7x8'].total = 40;
  assert.equal(hasMoreProgress(describeSave(JSON.stringify(moreAnswers), catalog), olderSummary), true);

  // Saves from before levelMastered existed count starred levels as mastered.
  const legacy = describeSave(JSON.stringify({ worldProgress: { [worlds[0].id]: { levelStars: { 1: 3, 2: 0 } } } }), catalog);
  assert.equal(legacy.levelsMastered, 1);
});

test('a failed import on a nearly full iPad leaves every key and the old Undo copy as they were', () => {
  const oldBackup = JSON.stringify({ app: 'cosmic-home', kind: 'transfer-backup', format: 1, savedAt: 'x', keys: {} });
  const entries = {
    cosmicMathProgress: JSON.stringify({ factMastery: {}, pad: 'p'.repeat(1000) }),
    cosmicMathRecords: '{"totalCorrect":5}',
    [TRANSFER_BACKUP_KEY]: oldBackup,
  };
  const used = map => [...map].reduce((n, [k, v]) => n + k.length + v.length, 0);
  // Sized so the old rollback order (restore before freeing the new Undo
  // copy) left a half-imported save behind.
  const limit = used(new Map(Object.entries(entries))) + 1605;
  const store = makeStorage(entries);
  const setItem = store.setItem.bind(store);
  store.setItem = (key, value) => {
    const next = new Map(store.map);
    next.set(key, String(value));
    if (used(next) > limit) throw new Error('QuotaExceededError');
    setItem(key, value);
  };
  const incoming = {
    cosmicMathProgress: JSON.stringify({ factMastery: {} }),
    cosmicMathRecords: JSON.stringify({ pad: 'r'.repeat(1500) }),
    cosmicMathParentPin: '1234',
  };
  const result = applyTransfer(store, incoming, { now: NOW });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'storageFailed');
  assert.deepEqual(Object.fromEntries(store.map), entries);
});
