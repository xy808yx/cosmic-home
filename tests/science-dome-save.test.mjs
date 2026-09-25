import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

// The Science Dome (hidden world 39) took over the hard Chapter 3 secret from
// The Night Shift (the retired world 20). These checks load old saves through
// the real progress manager and make sure nothing a kid earned is lost. All
// persistence stays inside this Node process; no browser save is touched.
const saved = new Map();
globalThis.localStorage = {
  getItem: key => (saved.has(key) ? saved.get(key) : null),
  setItem: (key, value) => saved.set(key, String(value)),
  removeItem: key => saved.delete(key),
};
const gameData = await import('../src/GameData.js');
const {
  progress, WORLDS, HIDDEN_WORLDS, VISIBLE_WORLDS, RETIRED_WORLD_IDS, findWorld,
  getConveyorSecretForHost, getBossHpForWorld, getBossDurationForWorld,
  usesConveyorScene, getInverseProblem, getChapterWorlds,
} = gameData;

const KEY = 'cosmicMathProgress';
const NIGHT_SHIFT = 20;
const DOME = 39;
// What a Night Shift clear wrote under the old code: the boss round's best
// result on its single level, and its unlocked flag from discovery.
const NIGHT_SHIFT_PROGRESS = {
  unlocked: true, levelsCompleted: 1, starsEarned: 3, levelStars: { 1: 3 }, levelMastered: { 1: true },
};

beforeEach(() => {
  saved.clear();
  progress.reset();
});

// Builds a save the way the old game wrote it: play with the real manager,
// then give it the old shape (no world 39 anywhere) plus a Night Shift the kid
// found, cleared, got stars on, and won Night Noodles from. The unlock check
// runs first because every app open runs it, so a save already carries its
// result (a secret room found this session is unlocked by the next one).
function oldSave(play) {
  progress.reset();
  play();
  progress.checkWorldUnlock(null);
  progress.save();
  const data = JSON.parse(saved.get(KEY));
  delete data.worldProgress[DOME];
  delete data.hiddenWorldDiscovered[DOME];
  delete data.hiddenWorldCleared[DOME];
  data.worldProgress[NIGHT_SHIFT] = structuredClone(NIGHT_SHIFT_PROGRESS);
  data.hiddenWorldDiscovered[NIGHT_SHIFT] = true;
  data.hiddenWorldCleared[NIGHT_SHIFT] = true;
  data.totalStars += NIGHT_SHIFT_PROGRESS.starsEarned;
  data.cosmetics.ownedIds.push('acc_noodles');
  data.cosmetics.pet.accessory = 'acc_noodles';
  return data;
}

function loadRaw(data) {
  saved.set(KEY, JSON.stringify(data));
  progress.load();
}

// Masters every level of a world through the same call a round end makes.
function masterWorld(id, stars = 3) {
  const world = findWorld(id);
  for (let lvl = 1; lvl <= world.levelsRequired; lvl++) progress.completeLevel(id, lvl, stars, true);
}

function findAndClear(id) {
  progress.discoverHiddenWorld(id);
  if (findWorld(id).kind === 'gauntlet') progress.completeLevel(id, 1, 3, true);
  progress.clearHiddenWorld(id);
}

// Three stages of play, so the before-and-after check covers a frontier in
// every chapter as well as a finished game.
const SAVES = {
  'early Chapter 1': () => {
    masterWorld(1);
    masterWorld(2);
    progress.completeLevel(3, 1, 2, true);
  },
  'mid Chapter 3': () => {
    for (const ch of [1, 2]) for (const w of getChapterWorlds(ch)) masterWorld(w.id);
    for (const w of getChapterWorlds(3).slice(0, 4)) masterWorld(w.id, 2);
    for (const id of [15, 16, 17, 18]) findAndClear(id);
    progress.discoverHiddenWorld(19);
  },
  'finished game': () => {
    progress.devClearAllWorlds();
    for (const id of [15, 16, 17, 18, 19]) findAndClear(id);
  },
};

// The per-world sets the map and the unlock chain read, from a raw save and
// from the loaded manager. Every world except the two this change touches.
function rawSets(data, ids) {
  const wp = data.worldProgress;
  return {
    unlocked: ids.filter(id => !!wp[id]?.unlocked),
    cleared: ids.filter(id => Object.keys(wp[id]?.levelStars || {}).length >= findWorld(id).levelsRequired),
    mastered: ids.filter(id => Object.keys(wp[id]?.levelMastered || {}).length >= findWorld(id).levelsRequired),
    discovered: ids.filter(id => !!data.hiddenWorldDiscovered?.[id]),
    secretsCleared: ids.filter(id => !!data.hiddenWorldCleared?.[id]),
  };
}

function loadedSets(ids) {
  return {
    unlocked: ids.filter(id => progress.isWorldUnlocked(id)),
    cleared: ids.filter(id => progress.isWorldFullyCleared(id)),
    mastered: ids.filter(id => progress.isWorldMastered(id)),
    discovered: ids.filter(id => progress.isHiddenWorldDiscovered(id)),
    secretsCleared: ids.filter(id => progress.isHiddenWorldCleared(id)),
  };
}

const OTHER_IDS = WORLDS.map(w => w.id).filter(id => id !== DOME);

test('the hidden roster swaps the Night Shift for the Science Dome', () => {
  assert.deepEqual(HIDDEN_WORLDS.map(w => w.id), [15, 16, 17, 18, 19, 39]);
  assert.equal(findWorld(NIGHT_SHIFT), null);
  assert.deepEqual(RETIRED_WORLD_IDS, [20]);
  assert.equal(new Set(WORLDS.map(w => w.id)).size, WORLDS.length);
  assert.ok(!VISIBLE_WORLDS.some(w => w.id === DOME));

  const dome = findWorld(DOME);
  assert.equal(dome.name, 'The Science Dome');
  assert.equal(dome.chapter, 3);
  assert.equal(dome.kind, 'gauntlet');
  assert.equal(dome.hidden, true);
  assert.equal(dome.belt, true);
  assert.equal(dome.levelsRequired, 1);
  assert.deepEqual(dome.discoveredFromCrate, { worldId: 37 });
  for (const field of ['name', 'description', 'flavorText', 'bossBrief']) {
    assert.ok(!dome[field].includes('\u2014'), `no em dash in ${field}`);
  }
});

test('the Seawall crate leads to the dome, which runs the 48 crate race on the belt', () => {
  assert.equal(getConveyorSecretForHost(37)?.id, DOME);
  assert.equal(getConveyorSecretForHost(36)?.id, 19);
  assert.equal(getBossHpForWorld(DOME), 48);
  assert.equal(getBossDurationForWorld(DOME), 130);
  assert.equal(usesConveyorScene(findWorld(DOME), 'boss'), true);
  for (let i = 0; i < 40; i++) {
    const p = getInverseProblem(DOME);
    assert.equal(p.inverse, true);
    assert.ok(p.display.includes('?'));
    assert.ok(Number.isInteger(p.answer) && p.answer >= 1 && p.answer <= 12);
  }
});

test('a new save starts with the dome hidden and every hidden flag seeded', () => {
  for (const flags of [progress.hiddenWorldDiscovered, progress.hiddenWorldCleared]) {
    assert.deepEqual(Object.keys(flags).map(Number), [15, 16, 17, 18, 19, 20, 39]);
    assert.ok(Object.values(flags).every(v => v === false));
  }
  assert.equal(progress.worldProgress[DOME].unlocked, false);
  assert.equal(progress.worldProgress[NIGHT_SHIFT], undefined);
});

test('a Night Shift save keeps its world, its stars and its noodles, and the dome starts hidden', () => {
  // Nine stars on World 1 plus three on the Night Shift: twelve in all.
  const data = oldSave(() => {
    for (let lvl = 1; lvl <= 3; lvl++) progress.completeLevel(1, lvl, 3, true);
  });
  assert.equal(data.totalStars, 12);
  loadRaw(data);

  assert.deepEqual(progress.worldProgress[NIGHT_SHIFT], NIGHT_SHIFT_PROGRESS);
  assert.equal(progress.isHiddenWorldDiscovered(NIGHT_SHIFT), true);
  assert.equal(progress.isHiddenWorldCleared(NIGHT_SHIFT), true);
  assert.equal(progress.totalStars, 12);
  assert.ok(progress.cosmetics.ownedIds.includes('acc_noodles'));
  assert.equal(progress.cosmetics.pet.accessory, 'acc_noodles');

  assert.equal(progress.isHiddenWorldDiscovered(DOME), false);
  assert.equal(progress.isHiddenWorldCleared(DOME), false);
  assert.equal(progress.isWorldUnlocked(DOME), false);
  assert.deepEqual(progress.worldProgress[DOME].levelStars, {});
});

test('loading then saving an old save writes the Night Shift back unchanged', () => {
  const data = oldSave(SAVES['finished game']);
  loadRaw(data);
  progress.save();
  const again = JSON.parse(saved.get(KEY));
  assert.deepEqual(again.worldProgress[NIGHT_SHIFT], data.worldProgress[NIGHT_SHIFT]);
  assert.equal(again.hiddenWorldDiscovered[NIGHT_SHIFT], true);
  assert.equal(again.hiddenWorldCleared[NIGHT_SHIFT], true);
  assert.equal(again.totalStars, data.totalStars);
  assert.equal(again.hiddenWorldDiscovered[DOME], false);
  assert.equal(again.hiddenWorldCleared[DOME], false);

  // A second load of what was just written changes nothing further.
  progress.load();
  progress.save();
  assert.equal(saved.get(KEY), JSON.stringify(again));
});

test('the dev star recount still counts the Night Shift stars', () => {
  loadRaw(oldSave(SAVES['finished game']));
  progress.devClearAllWorlds();
  assert.deepEqual(progress.worldProgress[NIGHT_SHIFT], NIGHT_SHIFT_PROGRESS);
  const sum = Object.values(progress.worldProgress).reduce((s, wp) => s + (wp.starsEarned || 0), 0);
  assert.equal(progress.totalStars, sum);
});

for (const [name, play] of Object.entries(SAVES)) {
  test(`${name}: every other world keeps its unlocked, cleared and discovered sets on load`, () => {
    const data = oldSave(play);
    const before = rawSets(data, OTHER_IDS);
    loadRaw(data);
    assert.deepEqual(loadedSets(OTHER_IDS), before);
    assert.equal(progress.totalStars, data.totalStars);
    assert.equal(progress.isHiddenWorldDiscovered(DOME), false);
  });
}

test('finding and clearing the dome leaves the Night Shift alone', () => {
  loadRaw(oldSave(SAVES['finished game']));
  const starsBefore = progress.totalStars;
  assert.equal(progress.discoverHiddenWorld(DOME), true);
  progress.completeLevel(DOME, 1, 2, true);
  assert.equal(progress.isWorldUnlocked(DOME), true);
  progress.clearHiddenWorld(DOME);
  assert.equal(progress.isHiddenWorldCleared(DOME), true);
  assert.equal(progress.totalStars, starsBefore + 2);
  assert.deepEqual(progress.worldProgress[NIGHT_SHIFT], NIGHT_SHIFT_PROGRESS);
  assert.equal(progress.isHiddenWorldCleared(NIGHT_SHIFT), true);
});
