import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { beforeEach } from 'node:test';
import vm from 'node:vm';
import * as roundResults from '../src/RoundResults.js';

// The Science Dome race (hidden world 39) on the belt: the keepsake its first
// win grants, the order its win plays in, what its quota counts, and its
// words. Runs the real ConveyorScene source with drawing and audio stubbed,
// the way round-results.mjs does, so no browser and no browser save are used.
const saved = new Map();
globalThis.localStorage = {
  getItem: key => saved.get(key) ?? null,
  setItem: (key, value) => saved.set(key, value),
  removeItem: key => saved.delete(key)
};
const gameData = await import('../src/GameData.js');
const { progress, findWorld } = gameData;
const noop = () => {};
const DOME = 39;

// Every keepsake the scene hands out lands here.
const equipped = [];

async function loadConveyor() {
  const filename = new URL('../src/scenes/ConveyorScene.js', import.meta.url);
  const source = (await readFile(filename, 'utf8'))
    .replace(/^import\s[\s\S]*?;\n/gm, '')
    .replace(/^export /gm, '');
  const context = vm.createContext({
    ...gameData,
    ...roundResults,
    Phaser: { Scene: class {} },
    performance,
    console,
    audio: {},
    music: {},
    COLORS: {},
    companion: { checkEvolutionEligibility: noop },
    cosmetics: { addAndEquip: id => equipped.push(id) },
    economy: { addStardust: noop },
    claimDailyBonusIfDue: () => 0,
    records: { getPaceMs: () => 0, recordAnswer: noop, recordLevelComplete: noop }
  });
  vm.runInContext(
    `${source}\nglobalThis.SceneUnderTest = ConveyorScene;\nglobalThis.SCIENCE_DOME = SCIENCE_DOME;`,
    context, { filename: filename.pathname }
  );
  return { ConveyorScene: context.SceneUnderTest, SCIENCE_DOME: context.SCIENCE_DOME };
}

const { ConveyorScene, SCIENCE_DOME } = await loadConveyor();

beforeEach(() => {
  saved.clear();
  equipped.length = 0;
  progress.reset();
  progress.discoverHiddenWorld(DOME);
});

// A dome race at its end: 48 crates, won or not, with the backdrop's light
// show and the win beat recorded in the order they run.
function makeDomeRace({ bossWon }) {
  const scene = new ConveyorScene();
  const order = [];
  const race = { order, showDone: null };
  Object.assign(scene, {
    worldId: DOME, world: findWorld(DOME), currentLevel: 1,
    isBoss: true, isScienceDome: true, bossWon,
    bossQuota: bossWon ? 48 : 30, bossMaxQuota: 48,
    score: bossWon ? 48 : 30, attempts: 52, scoreThreshold: 48,
    duration: 130, roundEndsAt: 130000,
    bestStreak: 20, stardustEarned: 0,
    registry: new Map(),
    summaries: [], destinations: [],
    time: { now: bossWon ? 90000 : 130001, delayedCall: () => ({ remove: noop }), removeEvent: noop },
    tweens: { killTweensOf: noop, add: () => ({ stop: noop }) },
    scene: { start: name => scene.destinations.push(name), restart: noop },
    dropCrateTimer: noop, setDocksEnabled: noop,
    showSummary: result => scene.summaries.push(result),
    showWorldClearBanner: done => { order.push('banner'); done(); },
    playOrderCompleteCinematic: done => { order.push('beat'); done(); },
    domeBackdrop: {
      playWinShow: done => { order.push('show'); race.showDone = done; }
    }
  });
  return { scene, race };
}

test('the dome race is the belt secret, and its crates ask for a missing factor', () => {
  const dome = findWorld(DOME);
  assert.equal(dome.belt, true);
  assert.equal(dome.hidden, true);
  assert.match(gameData.getInverseProblem(DOME).display, /\?/);
});

test('a first dome win grants the Little Dome, then lights the dome before the win beat', () => {
  const { scene, race } = makeDomeRace({ bossWon: true });
  scene.finishRound({ bossWin: true });

  assert.deepEqual(equipped, ['acc_little_dome']);
  assert.equal(progress.isHiddenWorldCleared(DOME), true);
  // The light show runs alone first; nothing is laid over it yet.
  assert.deepEqual(race.order, ['show']);
  assert.deepEqual(scene.summaries, []);

  race.showDone();
  // A secret is off the road: no WORLD CLEARED banner and no ship to fly on,
  // the same as the secrets that run in GameScene.
  assert.deepEqual(race.order, ['show', 'beat']);
  assert.equal(progress.justClearedWorld, null);
  assert.equal(scene.summaries.length, 1);
  assert.equal(scene.summaries[0].bossWin, true);
});

test('a dome replay does not re-equip the keepsake over her own choice', () => {
  progress.clearHiddenWorld(DOME);
  const { scene, race } = makeDomeRace({ bossWon: true });
  scene.finishRound({ bossWin: true });
  race.showDone();
  assert.deepEqual(equipped, []);
  assert.equal(scene.summaries[0].bossWin, true);
});

test('a dome loss grants nothing, plays no light show, and Continue goes to the map', () => {
  const { scene, race } = makeDomeRace({ bossWon: false });
  scene.finishRound();
  assert.deepEqual(equipped, []);
  assert.equal(progress.isHiddenWorldCleared(DOME), false);
  assert.deepEqual(race.order, []);
  assert.equal(scene.summaries[0].bossWin, false);

  // A secret has no mission briefing, so it always leaves to the map.
  scene.exitToMap();
  assert.deepEqual(scene.destinations, ['WorldMapScene']);
});

test('each correct dome crate lights one meter panel and one dome light', () => {
  const scene = new ConveyorScene();
  const counts = [];
  const fracs = [];
  Object.assign(scene, {
    bossQuota: 12, bossMaxQuota: 48,
    domeMeter: { setCount: n => counts.push(n) },
    domeBackdrop: { setProgress: f => fracs.push(f) }
  });
  scene.drawQuotaBar();
  scene.bossQuota = 13;
  scene.drawQuotaBar();
  assert.deepEqual(counts, [12, 13]);
  assert.deepEqual(fracs, [12 / 48, 13 / 48]);
  // One crate is exactly one of the dome's 48 lights.
  assert.equal(Math.round(fracs[1] * 48) - Math.round(fracs[0] * 48), 1);
});

test('the dome words are the drafts, with no long dashes', () => {
  const { copy, discoveryLine } = SCIENCE_DOME;
  assert.equal(copy.bossHeadline, 'LIGHT IT UP');
  assert.equal(copy.stamp, 'LIT');
  assert.equal(copy.summaryWin, 'Dome Lit Up!');
  assert.equal(copy.bossDone.replace('\n', ' '), 'Dome Lit Up!');
  assert.equal(copy.bossMiss, 'Lights Still Off');
  assert.equal(copy.bossStat, 'LIGHTS');
  assert.equal(copy.quotaLine(48), 'Light all 48 before closing.');
  assert.equal(discoveryLine.replace('\n', ' '), 'This crate is headed for the dome. Solve its puzzle to get in.');
  const all = [...Object.values(copy).filter(v => typeof v === 'string'), copy.quotaLine(48), discoveryLine,
    findWorld(DOME).bossBrief, findWorld(DOME).flavorText];
  for (const words of all) assert.ok(!/[\u2013\u2014]/.test(words), words);
});

test('the dome win beat is warm gold and white only, never a spread of colours', () => {
  const { win, headline } = SCIENCE_DOME.skin;
  const hex = c => (typeof c === 'string' ? parseInt(c.slice(1), 16) : c);
  // Warm gold or white: red at least green at least blue, and bright.
  for (const c of [...win.sparkles, win.title, win.flavor, headline].map(hex)) {
    const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    assert.ok(r >= g && g >= b && r >= 0xf0, c.toString(16));
  }
});
