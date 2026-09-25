import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

// The Chapter 3 homecoming (The Ride Down) run in plain node: the scene's own
// source with its imports swapped for small fakes, and a fake clock that fires
// the scene's timers and update listeners in order. No Phaser, no browser.

// Every fixed line of the ending, word for word.
const FIXED = [
  'CHAPTER 3 COMPLETE',
  'You made it!',
  'You got to the very top!',
  'You journeyed to the edge of the cosmos. Then into the smallest cell.',
  'And now the long way around brings you somewhere new: home.',
  'A whole Saturday of it. The store, the garden, the beach, the bread place.',
  'You walked all the way up. The lights came on for the ride down.',
  'The mountain is lit for the ride down.\nBelow you, one by one,\nthe city lights come on.',
  '小宇', '新宇', '星宇',
  '爸爸爱你',
  'Home'
];
const flat = text => text.replace(/\s+/g, ' ').trim();

// A stand-in game object: any method returns the object itself, so chained
// calls like setOrigin(0.5).setDepth(80).setAlpha(0) all work.
function stub(props = {}) {
  const target = { width: 300, height: 60, x: 0, y: 0, alpha: 1, active: true, ...props };
  const proxy = new Proxy(target, {
    get(t, key) {
      if (key in t) return t[key];
      if (key === 'then') return undefined;
      return () => proxy;
    },
    set(t, key, value) { t[key] = value; return true; }
  });
  return proxy;
}

function loadCredits(bindings) {
  const source = readFileSync(new URL('../src/scenes/CreditsScene.js', import.meta.url), 'utf8')
    .replace(/^import .+ from .+;\n/gm, '')
    .replace('export class CreditsScene', 'class CreditsScene');
  const context = vm.createContext({ Phaser: { Scene: class {} }, Math, Promise, ...bindings });
  vm.runInContext(`${source}\nglobalThis.CreditsScene = CreditsScene;`, context);
  return context.CreditsScene;
}

function rig({ songCached = true, musicOn = true } = {}) {
  const log = [];            // everything that happened, in order
  const shown = [];          // every string put on screen
  const buttons = [];
  const sounds = [];
  const timers = [];
  const listeners = { update: [], shutdown: [], destroy: [] };
  let now = 0;

  const ride = {
    lampCount: 10,
    cityGroupCount: 12,
    cabin: { x: 0 },
    destroyed: 0
  };
  for (const name of ['setRide', 'setPetAt', 'openDoor', 'closeDoor', 'board', 'alight', 'sway', 'settle',
    'lightPlace', 'lightLamp', 'lightCityGroup', 'fadeShoreLights', 'quietPlaces', 'startIdle']) {
    ride[name] = (...args) => { if (name !== 'setRide') log.push([name, ...args]); return Promise.resolve(); };
  }
  ride.destroy = () => { ride.destroyed++; };

  const song = {
    isPlaying: false,
    handlers: {},
    play() { this.isPlaying = true; },
    stop() { this.isPlaying = false; },
    destroy() { this.pendingRemove = true; this.destroyed = (this.destroyed || 0) + 1; },
    once(event, fn) { this.handlers[event] = fn; },
    off(event, fn) { if (this.handlers[event] === fn) delete this.handlers[event]; }
  };
  const progress = {
    marks: 0,
    markFinale3Seen() { this.marks++; log.push(['markFinale3Seen']); },
    markEndingSeen() {}, markFinaleSeen() {},
    consumeJustClearedWorld() {}, setCurrentChapter(ch) { log.push(['chapter', ch]); }
  };
  const music = {
    enabled: musicOn,
    pause() {},
    resolveTrack: (scene, key) => key,
    fadeToTrack: (scene, key) => log.push(['music', key])
  };

  const Scene = loadCredits({
    audio: new Proxy({}, { get: (t, name) => () => sounds.push(name) }),
    music,
    progress,
    MUSIC_ASSETS: {},
    style: () => ({}),
    TYPE: { title: 72, body: 42, heading: 52 },
    COLORS: {},
    companion: {}, drawCompanion: () => stub(),
    createStarfield: () => {},
    createButton: (scene, opts) => { buttons.push(opts); shown.push(opts.label); return stub(); },
    TransitionManager: class {
      fadeIn() {}
      fadeToScene(key) { log.push(['go', key]); }
    },
    createRideDown: () => ride,
    makeCaption: (scene, text) => { shown.push(text); return stub(); },
    cabinAt: t => ({ x: 1000 + t * 5000 }),
    TOWER_T: [0.3, 0.645],
    paper: (g, dx, dy, fn) => { fn(g, true); fn(g, false); },
    ink: () => {}
  });

  const scene = new Scene();
  const registry = new Map([['creditsMode', 'homecoming']]);
  Object.assign(scene, {
    registry: { get: k => registry.get(k), set: (k, v) => registry.set(k, v) },
    cache: { audio: { exists: key => songCached && key === 'creditsSong' } },
    sound: { add: () => song },
    add: {
      text: (x, y, text) => { shown.push(text); return stub(); },
      graphics: () => stub()
    },
    tweens: { add: cfg => stub({ cfg }), killTweensOf() {} },
    time: {
      delayedCall: (delay, fn) => { const t = { at: now + delay, fn, remove() { this.gone = true; } }; timers.push(t); return t; }
    },
    events: {
      on: (event, fn) => listeners[event].push(fn),
      once: (event, fn) => listeners[event].push(fn),
      off: (event, fn) => { listeners[event] = listeners[event].filter(f => f !== fn); }
    }
  });

  // Steps the fake clock in 16 ms frames: due timers first, then update.
  const advance = (ms) => {
    const end = now + ms;
    while (now < end) {
      now += 16;
      for (;;) {
        const due = timers.filter(t => !t.gone && t.at <= now).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        due.gone = true;
        due.fn();
      }
      for (const fn of [...listeners.update]) fn(now, 16);
    }
  };
  const shutdown = () => { for (const fn of [...listeners.shutdown]) fn(); };

  scene.create();
  return { scene, ride, song, log, shown, buttons, sounds, listeners, advance, shutdown, progress, get now() { return now; } };
}

test('the Ride Down puts every fixed line on screen exactly once, word for word', () => {
  const r = rig();
  r.advance(60000);
  const seen = r.shown.map(flat);
  for (const line of FIXED) {
    assert.equal(seen.filter(s => s === flat(line)).length, 1, `"${flat(line)}" should show exactly once`);
  }
  assert.equal(seen.length, FIXED.length, `unexpected extra text: ${seen.filter(s => !FIXED.map(flat).includes(s))}`);
});

test('the Ride Down plays its beats in order and uses only soft chimes', () => {
  const r = rig();
  r.advance(60000);
  const names = r.log.map(e => e[0]);
  const first = name => names.indexOf(name);
  assert.ok(first('board') < first('closeDoor'));
  assert.ok(first('closeDoor') < first('lightPlace'));
  assert.deepEqual(r.log.filter(e => e[0] === 'lightPlace').map(e => e[1]), ['store', 'garden', 'beach', 'bread']);
  assert.deepEqual(r.log.filter(e => e[0] === 'lightLamp').map(e => e[1]), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(r.log.filter(e => e[0] === 'lightCityGroup').map(e => e[1]), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.ok(names.lastIndexOf('lightCityGroup') < first('alight'));
  assert.ok(first('settle') < first('alight'));
  assert.ok(first('alight') < first('startIdle'));
  // The places quiet down once the pet is home, before any name shows.
  assert.equal(names.filter(n => n === 'quietPlaces').length, 1);
  assert.ok(names.lastIndexOf('lightPlace') < first('quietPlaces'));
  assert.ok(first('alight') <= first('quietPlaces') && first('quietPlaces') < first('startIdle'));
  assert.equal(names.filter(n => n === 'board').length, 1);
  assert.equal(names.filter(n => n === 'alight').length, 1);
  // No correct-answer ding anywhere in the ending.
  assert.equal(r.sounds.includes('playMatch'), false);
  for (const s of r.sounds) assert.ok(['init', 'playStar', 'playPetChirp', 'playStardustChime'].includes(s), s);
  // Nothing forces an exit: after a long idle the scene is still waiting.
  r.advance(120000);
  assert.equal(r.log.some(e => e[0] === 'go'), false);
});

test('Home leaves once, however many times it is tapped', () => {
  const r = rig();
  r.advance(52000);
  assert.equal(r.buttons.length, 1);
  assert.equal(r.buttons[0].label, 'Home');
  r.buttons[0].onClick();
  r.buttons[0].onClick();
  assert.equal(r.log.filter(e => e[0] === 'go').length, 1);
  assert.deepEqual(r.log.find(e => e[0] === 'go'), ['go', 'WorldMapScene']);
  assert.equal(r.progress.marks, 1);
  assert.deepEqual(r.log.find(e => e[0] === 'chapter'), ['chapter', 3]);
});

test('the map theme takes over once when the credits song ends', () => {
  const r = rig();
  r.advance(52000);
  assert.equal(r.log.some(e => e[0] === 'music'), false);
  r.song.handlers.complete();
  r.advance(10000);
  assert.deepEqual(r.log.filter(e => e[0] === 'music'), [['music', 'homeGroundHome']]);
});

test('the map theme still takes over if the song end is never reported', () => {
  const r = rig();
  r.advance(60000);
  assert.deepEqual(r.log.filter(e => e[0] === 'music'), [['music', 'homeGroundHome']]);
});

test('with the music off or the song missing, the map theme is asked for at once', () => {
  for (const opts of [{ musicOn: false }, { songCached: false }]) {
    const r = rig(opts);
    assert.deepEqual(r.log.filter(e => e[0] === 'music'), [['music', 'homeGroundHome']]);
    r.advance(60000);
    assert.equal(r.log.filter(e => e[0] === 'music').length, 1);
  }
});

test('shutting the scene down tears the ride and its listeners down', () => {
  const r = rig();
  r.advance(20000);
  assert.equal(r.listeners.update.length, 1);
  r.shutdown();
  assert.equal(r.ride.destroyed, 1);
  assert.equal(r.listeners.update.length, 0);
  assert.equal(r.listeners.shutdown.length, 0);
  assert.equal(r.song.handlers.complete, undefined);
  // The song is stopped and removed from the sound manager, once.
  assert.equal(r.song.isPlaying, false);
  assert.equal(r.song.destroyed, 1);
  r.shutdown();
  assert.equal(r.song.destroyed, 1);
});
