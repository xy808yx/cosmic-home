import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { beforeEach } from 'node:test';
import vm from 'node:vm';
import * as roundResults from '../src/RoundResults.js';

// All persistence stays inside this Node process. The real progression manager
// is used to check unlocks without reading or changing a browser save.
const saved = new Map();
globalThis.localStorage = {
  getItem: key => saved.get(key) ?? null,
  setItem: (key, value) => saved.set(key, value),
  removeItem: key => saved.delete(key)
};
const gameData = await import('../src/GameData.js');
const { progress } = gameData;
const noop = () => {};

// Run the source scene methods with only their rendering/audio imports stubbed.
// Phaser needs a DOM to import, but the gameplay methods need no browser here.
async function loadScene(name) {
  const filename = new URL(`../src/scenes/${name}.js`, import.meta.url);
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
    companion: { feed: noop, checkEvolutionEligibility: noop, unlockCosmic: noop },
    economy: { addStardust: noop },
    claimDailyBonusIfDue: () => 0,
    records: { getPaceMs: () => 0, recordAnswer: noop, recordLevelComplete: noop },
    bossTwistOn: noop,
    drawTimeBar: noop,
    showArcadeResults: (scene, result) => scene.arcadeResults.push(result)
  });
  vm.runInContext(`${source}\nglobalThis.SceneUnderTest = ${name};`, context, {
    filename: filename.pathname
  });
  return context.SceneUnderTest;
}

const GameScene = await loadScene('GameScene');
const ConveyorScene = await loadScene('ConveyorScene');

beforeEach(() => {
  saved.clear();
  progress.reset();
});

function attachSceneSystems(scene) {
  scene.pendingTimers = [];
  scene.summaries = [];
  scene.arcadeResults = [];
  scene.destinations = [];
  scene.time = {
    now: 0,
    delayedCall: (delay, callback) => {
      const timer = { delay, callback, remove: noop };
      scene.pendingTimers.push(timer);
      return timer;
    },
    removeEvent: noop
  };
  scene.runTimer = delay => {
    const index = scene.pendingTimers.findIndex(timer => timer.delay === delay);
    assert.notEqual(index, -1, `Expected a ${delay}ms callback`);
    scene.pendingTimers.splice(index, 1)[0].callback();
  };
  scene.scene = {
    isActive: () => true,
    start: name => scene.destinations.push(name),
    restart: noop
  };
  scene.tweens = { killTweensOf: noop, add: () => ({ stop: noop }) };
  scene.cameras = { main: { shake: noop } };
  scene.showSummary = result => scene.summaries.push(result);
  scene.showWorldClearBanner = callback => callback();
  return scene;
}

function makeGameScene({ worldId = 8, mode = 'mult', arcadeMode = null } = {}) {
  const scene = new GameScene();
  scene.registry = new Map([
    ['currentWorldId', worldId],
    ['currentLevel', mode === 'boss' ? 4 : 1],
    ['levelMode', mode],
    ['arcadeMode', arcadeMode]
  ]);
  scene.init();
  attachSceneSystems(scene);
  Object.assign(scene, {
    state: 'playing',
    hpIcons: [],
    mcButtons: [{ value: 6 }],
    scoreText: { setText: noop },
    timeText: { setText: noop },
    _refreshMcButtonsDim: noop,
    flashMcButton: noop,
    fireLaserAt: noop,
    drawBossHp: noop,
    recoilBoss: noop,
    damageShip: noop,
    bossAttackBack: noop,
    refreshMcButtons: noop,
    _startAsteroidFall: noop
  });
  return scene;
}

function addAsteroid(scene, properties = {}) {
  const asteroid = {
    phase: 'falling',
    isBoss: scene.isBoss,
    container: { active: true, destroy() { this.active = false; } },
    fallTween: { stop: noop },
    problem: { a: 2, b: 3, answer: 6, display: '2 × 3' },
    startedAtMs: performance.now(),
    ...properties
  };
  scene.activeAsteroids.push(asteroid);
  scene.targetedAsteroid = asteroid;
  return asteroid;
}

function masterPracticeLevels(worldId) {
  for (const level of [1, 2, 3]) progress.completeLevel(worldId, level, 3, true);
}

test('special asteroid points do not inflate correct answers or accuracy', () => {
  for (const variant of ['stardust', 'miniBoss', 'flare']) {
    const scene = makeGameScene();
    const asteroid = addAsteroid(scene);
    if (variant === 'stardust') asteroid._isStardust = true;
    if (variant === 'miniBoss') Object.assign(asteroid, { _isMiniBoss: true, _miniHp: 1 });
    if (variant === 'flare') asteroid.problem.twistKind = 'flare';
    scene.handleMcChoice(0);
    scene.endRound();
    assert.ok(scene.score > 1, `${variant} should still award bonus points`);
    assert.equal(scene.correctAnswers, 1);
    assert.equal(scene.attempts, 1);
    assert.equal(scene.summaries[0].accuracy, 100);
    assert.equal(progress.isLevelMastered(8, 1), false);
  }
});

test('bonus points can reward stars but cannot supply missing mastery volume', () => {
  const result = roundResults.calculateRoundResult({
    score: 18, correctAnswers: 8, attempts: 10, scoreThreshold: 18
  });
  assert.deepEqual(result, { accuracy: 80, stars: 2, mastered: false });
  assert.equal(roundResults.calculateRoundResult({
    score: 18, correctAnswers: 9, attempts: 10, scoreThreshold: 18
  }).mastered, true);
  assert.equal(roundResults.getRoundAccuracy(0, 0), 0);
});

test('a timed-out boss grants no stars and cannot unlock a new world or chapter', () => {
  for (const [worldId, nextWorld] of [[1, 2], [11, 21], [28, 31]]) {
    progress.reset();
    masterPracticeLevels(worldId);
    const scene = makeGameScene({ worldId, mode: 'boss' });
    Object.assign(scene, { score: 1, correctAnswers: 1, attempts: 1, timeLeft: 1 });
    addAsteroid(scene);
    scene.update(0, 2);
    assert.equal(scene.summaries[0].stars, 0);
    assert.equal(scene.summaries[0].bossWin, false);
    assert.equal(progress.isLevelMastered(worldId, 4), false);
    assert.equal(progress.isWorldFullyCleared(worldId), false);
    assert.equal(progress.isWorldUnlocked(nextWorld), false);
  }
});

test('a boss loss preserves an existing earned save and its unlocked chapter', () => {
  masterPracticeLevels(11);
  progress.completeLevel(11, 4, 3, true);
  const scene = makeGameScene({ worldId: 11, mode: 'boss' });
  Object.assign(scene, { score: 1, correctAnswers: 1, attempts: 1 });
  scene.endRound();
  assert.equal(scene.summaries[0].stars, 0);
  assert.equal(progress.worldProgress[11].levelStars[4], 3);
  assert.equal(progress.isLevelMastered(11, 4), true);
  assert.equal(progress.isWorldUnlocked(21), true);
  progress.load();
  assert.equal(progress.worldProgress[11].levelStars[4], 3);
  assert.equal(progress.isWorldUnlocked(21), true);
});

test('a final boss answer before the buzzer wins after its impact animation', () => {
  masterPracticeLevels(11);
  const scene = makeGameScene({ worldId: 11, mode: 'boss' });
  Object.assign(scene, { bossHp: 1, timeLeft: 100 });
  addAsteroid(scene);
  scene.handleMcChoice(0);
  scene.update(0, 150);
  assert.equal(scene.state, 'feedback');
  assert.equal(scene.bossHp, 0);
  assert.equal(scene.timeLeft, 100);
  scene.runTimer(360);
  assert.equal(scene.state, 'ended');
  assert.equal(progress.isLevelMastered(11, 4), true);
  assert.equal(progress.worldProgress[11].levelStars[4], 3);
  assert.equal(progress.isWorldUnlocked(21), true);
  assert.deepEqual(scene.destinations, ['CreditsScene']);
});

test('an expired boss problem cannot be answered while its correction is pending', () => {
  const scene = makeGameScene({ worldId: 1, mode: 'boss' });
  const asteroid = addAsteroid(scene);
  scene.onAsteroidImpact(asteroid);
  assert.equal(asteroid.phase, 'impactGrace');
  scene.runTimer(120);
  assert.equal(scene.attempts, 1);
  assert.equal(scene.shipHp, 4);
  assert.equal(scene.isAnswerableAsteroid(asteroid), false);
  scene.handleMcChoice(0);
  scene.onKeyDown({ key: '1' });
  assert.equal(scene.attempts, 1);
  assert.equal(scene.correctAnswers, 0);
  assert.equal(scene.pendingTimers.filter(timer => timer.delay === 220).length, 1);
  assert.equal(scene.pendingTimers.some(timer => timer.delay === 360), false);
  scene.cycleBossProblem(asteroid);
  assert.equal(scene.isAnswerableAsteroid(asteroid), true);
});

test('the impact grace window still accepts a timely answer only once', () => {
  const scene = makeGameScene({ worldId: 1, mode: 'boss' });
  const asteroid = addAsteroid(scene);
  scene.onAsteroidImpact(asteroid);
  scene.handleMcChoice(0);
  scene.handleMcChoice(0);
  scene.runTimer(120);
  assert.equal(scene.attempts, 1);
  assert.equal(scene.correctAnswers, 1);
  assert.equal(scene.shipHp, 5);
  assert.equal(scene.pendingTimers.some(timer => timer.delay === 220), false);
});

test('paused keyboard and button paths cannot answer until resumed', () => {
  const scene = makeGameScene();
  addAsteroid(scene);
  scene._pauseOpen = true;
  assert.equal(scene._buttonsActive(), false);
  scene.onKeyDown({ key: '1' });
  scene.handleMcChoice(0);
  assert.equal(scene.attempts, 0);
  scene._pauseOpen = false;
  scene.onKeyDown({ key: '1' });
  assert.equal(scene.attempts, 1);
  assert.equal(scene.correctAnswers, 1);
});

test('arcade result counts stay separate from Endless points', () => {
  for (const mode of ['bossRush', 'review', 'endless']) {
    const scene = makeGameScene({ arcadeMode: mode });
    Object.assign(scene, {
      state: 'feedback',
      score: 12, correctAnswers: 8, attempts: 10,
      arcadeState: { correct: 4, attempts: 5, startMs: Date.now() }
    });
    scene._arcadeShipDeath();
    scene.runTimer(600);
    const result = scene.arcadeResults[0];
    assert.equal(result.correct, mode === 'bossRush' ? 12 : 8);
    assert.equal(result.score, mode === 'review' ? 8 : 12);
  }
});

test('Boss Rush banks correct answers across boss wins', () => {
  const scene = makeGameScene({ mode: 'boss', arcadeMode: 'bossRush' });
  Object.assign(scene, {
    state: 'feedback', score: 12, correctAnswers: 8, attempts: 10,
    arcadeState: { queue: [8], index: 0, correct: 4, attempts: 5, startMs: Date.now() }
  });
  scene.endRound({ bossWin: true });
  assert.equal(scene.arcadeResults[0].won, true);
  assert.equal(scene.arcadeResults[0].correct, 12);
  assert.equal(scene.arcadeResults[0].attempts, 15);
});

test('Conveyor uses the same failed-boss result and retains a completed quota win', () => {
  for (const bossWon of [false, true]) {
    progress.reset();
    const scene = attachSceneSystems(new ConveyorScene());
    Object.assign(scene, {
      worldId: 31, currentLevel: 4, isBoss: true, bossWon,
      score: 14, attempts: 14, scoreThreshold: 14,
      duration: 60, roundEndsAt: 60000,
      bestStreak: 14, stardustEarned: 0,
      dropCrateTimer: noop, setDocksEnabled: noop,
      playOrderCompleteCinematic: callback => callback()
    });
    scene.time.now = 60001;
    scene.finishRound();
    assert.equal(scene.summaries[0].accuracy, 100);
    assert.equal(scene.summaries[0].stars, bossWon ? 2 : 0);
    assert.equal(progress.isLevelMastered(31, 4), bossWon);
  }
});
