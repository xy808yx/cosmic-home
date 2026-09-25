import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync, statSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { MusicManager } from '../src/MusicManager.js';
import { MUSIC_ASSETS } from '../src/MusicAssets.js';

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function audioParam(value) {
  return {
    value,
    ramps: [],
    cancelScheduledValues() {},
    setValueAtTime(next) { this.value = next; },
    linearRampToValueAtTime(next, at) { this.ramps.push({ value: next, at }); }
  };
}

function mockTrack(key, config, webAudio) {
  const context = { currentTime: 10 };
  return {
    key,
    isPlaying: false,
    isPaused: false,
    rate: 1,
    volume: config.volume,
    mute: false,
    currentConfig: { ...config },
    stops: 0,
    ...(webAudio ? {
      volumeNode: { context, gain: audioParam(config.volume) },
      muteNode: { gain: audioParam(1) },
      source: { context, playbackRate: audioParam(1) }
    } : {}),
    play() { this.isPlaying = true; this.isPaused = false; },
    pause() { this.isPlaying = false; this.isPaused = true; },
    resume() { this.isPlaying = true; this.isPaused = false; },
    stop() { this.isPlaying = false; this.isPaused = false; this.stops++; },
    setRate(value) { this.rate = value; },
    setVolume(value) { this.volume = value; this.currentConfig.volume = value; },
    setMute(value) { this.mute = value; }
  };
}

function fixture({ cached = ['homeTheme'], webAudio = true } = {}) {
  const cachedKeys = new Set(cached);
  const cache = { audio: { exists: key => cachedKeys.has(key) } };
  const tracks = {};
  const sound = { add(key, config) {
    assert.ok(cache.audio.exists(key), `Sound ${key} must be decoded first`);
    return tracks[key] = mockTrack(key, config, webAudio);
  } };
  const downloads = [];
  const jobs = new Set();
  const loader = new EventEmitter();
  let loading = false;
  loader.audio = (key, url) => { downloads.push({ key, url }); jobs.add(key); };
  loader.isLoading = () => loading;
  loader.start = () => { loading = true; };
  const game = { cache, events: new EventEmitter(), pendingDestroy: false };
  let loaderScene;
  let loaderScenes = 0;
  game.scene = { add(key, config, autoStart) {
    assert.equal(autoStart, true);
    loaderScenes++;
    // Phaser may defer SceneManager.add until its current update completes.
    queueMicrotask(() => {
      loaderScene = {
        load: loader,
        input: { enabled: true },
        sys: { setVisible(visible) { assert.equal(visible, false); } }
      };
      config.create.call(loaderScene);
    });
    return null;
  } };
  const scene = () => ({
    cache, sound, sys: { game },
    load: { audio() { assert.fail('A gameplay scene must not own music loads'); } },
    time: { delayedCall() { assert.fail('A gameplay scene must not own fade cleanup'); } }
  });
  const finish = (key, outcome = 'success') => {
    assert.ok(jobs.delete(key), `Download ${key} must be pending`);
    if (outcome === 'success') {
      cachedKeys.add(key);
      loader.emit('filecomplete', key, 'audio');
    } else if (outcome === 'missing') {
      loader.emit('loaderror', { key });
    }
    // A decode failure emits no filecomplete/loaderror; the queue still ends.
    if (!jobs.size) { loading = false; loader.emit('complete'); }
  };
  return {
    scene, game, tracks, downloads, finish, loader, cachedKeys,
    get loaderScenes() { return loaderScenes; },
    get loaderScene() { return loaderScene; }
  };
}

test('uncached chapter music stays preferred and plays with the requested settings', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  const m = new MusicManager();
  const s = f.scene();
  await m.ensurePlaying(s);
  const key = m.resolveTrack(s, 'innerSpaceLevel', 'levelTheme');
  assert.equal(key, 'innerSpaceLevel');
  const request = m.fadeToTrack(s, key);
  m.setPlaybackRate(0.9, 600);
  m.setVolume(0.4);
  m.setEnabled(false);
  await flush();
  assert.equal(f.tracks.homeTheme.isPlaying, true);
  assert.equal(f.tracks.homeTheme.rate, 1);
  assert.deepEqual(f.downloads, [{ key, url: MUSIC_ASSETS[key] }]);
  assert.equal(f.loaderScene.input.enabled, false);
  f.finish(key);
  assert.equal(await request, true);
  assert.equal(m.currentKey, key);
  assert.equal(f.tracks[key].rate, 0.9);
  assert.equal(f.tracks[key].mute, true);
  assert.equal(f.tracks[key].muteNode.gain.value, 0);
  assert.equal(f.tracks[key].currentConfig.volume, 0.35 * 0.4);
  m.setEnabled(true);
  assert.equal(f.tracks[key].muteNode.gain.value, 1);
  t.mock.timers.tick(540);
  assert.equal(f.tracks.homeTheme.isPlaying, false);
});

test('late downloads cannot override a newer music request', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  const m = new MusicManager();
  await m.ensurePlaying(f.scene());
  const stale = m.fadeToTrack(f.scene(), 'levelTheme');
  const newest = m.fadeToTrack(f.scene(), 'bossTheme');
  await flush();
  assert.equal(f.loaderScenes, 1);
  f.finish('bossTheme');
  await newest;
  f.finish('levelTheme');
  assert.equal(await stale, false);
  assert.equal(m.currentKey, 'bossTheme');
  assert.equal(f.tracks.levelTheme, undefined);
  t.mock.timers.tick(540);
  assert.deepEqual(Object.values(f.tracks).filter(track => track.isPlaying).map(track => track.key), ['bossTheme']);
});

test('same-track requests share a download and keep the latest rate and volume', async () => {
  const f = fixture();
  const m = new MusicManager();
  const first = m.ensurePlaying(f.scene(), 'levelTheme');
  m.setPlaybackRate(0.9);
  const second = m.ensurePlaying(f.scene(), 'levelTheme');
  m.setPlaybackRate(1.05);
  m.fadeVolume(0.5, 200);
  await flush();
  assert.equal(f.downloads.length, 1);
  f.finish('levelTheme');
  assert.equal(await first, false);
  assert.equal(await second, true);
  assert.equal(f.tracks.levelTheme.rate, 1.05);
  assert.equal(f.tracks.levelTheme.volume, 0.175);
});

test('destroying the requesting scene does not cancel a download or its fallback', async () => {
  const f = fixture();
  const m = new MusicManager();
  const s = f.scene();
  await m.ensurePlaying(s);
  const key = m.resolveTrack(s, 'hotPotTheme', 'dadsGarage');
  const request = m.ensurePlaying(s, key);
  await flush();
  s.sys.game = null;
  s.cache = null;
  s.sound = null;
  f.finish('hotPotTheme', 'missing');
  await flush();
  assert.equal(f.tracks.homeTheme.isPlaying, true);
  assert.equal(f.downloads.at(-1).key, 'dadsGarage');
  f.finish('dadsGarage');
  assert.equal(await request, true);
  assert.equal(m.currentKey, 'dadsGarage');
  assert.equal(f.tracks.homeTheme.isPlaying, false);
});

test('decode failure falls back and a later request retries the preferred asset', async () => {
  const f = fixture();
  const m = new MusicManager();
  const s = f.scene();
  await m.ensurePlaying(s);
  const key = m.resolveTrack(s, 'homeGroundHome', 'homeTheme');
  const first = m.ensurePlaying(s, key);
  await flush();
  f.finish(key, 'decode-error');
  assert.equal(await first, true);
  assert.equal(m.currentKey, 'homeTheme');
  assert.equal(f.loader.listenerCount('complete'), 0);
  assert.equal(f.loader.listenerCount('loaderror'), 0);
  const retry = m.ensurePlaying(s, key);
  await flush();
  assert.equal(f.downloads.filter(d => d.key === key).length, 2);
  f.finish(key);
  await retry;
  assert.equal(m.currentKey, key);
});

test('missing preferred and fallback assets leave the current track playing', async () => {
  const f = fixture({ cached: ['levelTheme'] });
  const m = new MusicManager();
  const s = f.scene();
  await m.ensurePlaying(s, 'levelTheme');
  const request = m.ensurePlaying(s, m.resolveTrack(s, 'homeGroundHome', 'homeTheme'));
  await flush();
  f.finish('homeGroundHome', 'missing');
  await flush();
  f.finish('homeTheme', 'missing');
  assert.equal(await request, false);
  assert.equal(m.currentKey, 'levelTheme');
  assert.equal(f.tracks.levelTheme.isPlaying, true);
});

test('pausing prevents a pending download from restarting music', async () => {
  const f = fixture();
  const m = new MusicManager();
  await m.ensurePlaying(f.scene());
  const request = m.ensurePlaying(f.scene(), 'bossTheme');
  await flush();
  m.pause();
  f.finish('bossTheme');
  assert.equal(await request, false);
  assert.equal(f.tracks.homeTheme.isPaused, true);
  assert.equal(f.tracks.bossTheme, undefined);
  await m.ensurePlaying(f.scene(), 'bossTheme');
  assert.equal(m.currentKey, 'bossTheme');
});

test('fade cleanup survives a scene exit and never stops a reused outgoing track', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture({ cached: ['homeTheme', 'levelTheme'] });
  const m = new MusicManager();
  await m.ensurePlaying(f.scene());
  const departing = f.scene();
  await m.fadeToTrack(departing, 'levelTheme', 500);
  departing.time = null;
  t.mock.timers.tick(200);
  await m.fadeToTrack(f.scene(), 'homeTheme', 500);
  t.mock.timers.tick(340);
  assert.equal(f.tracks.homeTheme.isPlaying, true);
  t.mock.timers.tick(200);
  assert.equal(f.tracks.homeTheme.isPlaying, true);
  assert.equal(f.tracks.levelTheme.isPlaying, false);
  assert.equal(m._fadeOutTrack, null);
});

test('HTML audio applies volume, playback rate and mute without Web Audio nodes', async () => {
  const f = fixture({ webAudio: false });
  const m = new MusicManager();
  m.setEnabled(false);
  const request = m.ensurePlaying(f.scene(), 'levelTheme');
  m.setPlaybackRate(1.1);
  m.setVolume(0.3);
  await flush();
  f.finish('levelTheme');
  await request;
  const track = f.tracks.levelTheme;
  assert.equal(track.mute, true);
  assert.equal(track.rate, 1.1);
  assert.equal(track.volume, 0.105);
  m.fadeVolume(0.5);
  assert.equal(track.volume, 0.175);
  m.setEnabled(true);
  assert.equal(track.mute, false);
});

test('requesting the destination song again preserves an in-flight crossfade', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture({ cached: ['homeTheme', 'dadsGarage'] });
  const m = new MusicManager();
  await m.ensurePlaying(f.scene(), 'dadsGarage');
  await m.fadeToTrack(f.scene(), 'homeTheme', 500);
  const rampCount = f.tracks.homeTheme.volumeNode.gain.ramps.length;
  await m.fadeToTrack(f.scene(), 'homeTheme', 500);
  assert.equal(f.tracks.dadsGarage.isPlaying, true);
  assert.equal(f.tracks.homeTheme.volumeNode.gain.ramps.length, rampCount);
  assert.equal(f.tracks.homeTheme.volumeNode.gain.value, 0);
  t.mock.timers.tick(540);
  assert.equal(f.tracks.dadsGarage.isPlaying, false);
  assert.equal(f.tracks.homeTheme.isPlaying, true);
});

test('destroying the game settles pending loads and removes loader listeners', async () => {
  const f = fixture();
  const m = new MusicManager();
  const request = m.ensurePlaying(f.scene(), 'levelTheme');
  await flush();
  f.game.pendingDestroy = true;
  f.game.events.emit('destroy');
  assert.equal(await request, false);
  assert.equal(f.loader.listenerCount('filecomplete'), 0);
  assert.equal(f.loader.listenerCount('loaderror'), 0);
  assert.equal(f.tracks.levelTheme, undefined);
});

function sceneClass(name, bindings = {}) {
  const source = readFileSync(new URL(`../src/scenes/${name}.js`, import.meta.url), 'utf8')
    .replace(/^import .+ from .+;\n/gm, '')
    .replace(`export class ${name}`, `class ${name}`);
  const context = vm.createContext({ Phaser: { Scene: class {} }, MUSIC_ASSETS, ...bindings });
  vm.runInContext(`${source}\nglobalThis.sceneClass = ${name};`, context);
  return context.sceneClass;
}

test('boot preloads only home music, about 0.8 MB, instead of the whole soundtrack', () => {
  const Scene = sceneClass('BootScene', { style: () => ({}) });
  const queued = [];
  Scene.prototype.preload.call({
    load: { audio: (key, url) => queued.push({ key, url }), on() {} },
    add: { text: () => ({ setOrigin() {} }) }
  });
  assert.deepEqual(queued, [{ key: 'homeTheme', url: MUSIC_ASSETS.homeTheme }]);
  const bytes = statSync(new URL(`../public/${queued[0].url}`, import.meta.url)).size;
  assert.ok(bytes < 900_000);
  const allBytes = Object.values(MUSIC_ASSETS).reduce((sum, url) => sum + statSync(new URL(`../public/${url}`, import.meta.url)).size, 0);
  assert.ok(bytes / allBytes < 0.05);
});

test('credits load their own song and preserve nonlooping direct playback and mute', () => {
  const afterSound = new Error('Reached credits artwork');
  const m = { enabled: true, pause() {} };
  const Scene = sceneClass('CreditsScene', {
    music: m, audio: { init() {} },
    createStarfield() { throw afterSound; }
  });
  const queued = [];
  Scene.prototype.preload.call({
    cache: { audio: { exists: () => false } },
    load: { audio: (key, url) => queued.push({ key, url }) }
  });
  assert.deepEqual(queued, [{ key: 'creditsSong', url: MUSIC_ASSETS.creditsSong }]);
  let plays = 0;
  const context = {
    registry: { get: () => 'cliffhanger' },
    events: { once() {}, off() {} },
    cache: { audio: { exists: key => key === 'creditsSong' } },
    sound: { add(key, config) {
      assert.equal(key, 'creditsSong');
      assert.equal(config.loop, false);
      assert.equal(config.volume, 0.5);
      return { play() { plays++; } };
    } }
  };
  assert.throws(() => Scene.prototype.create.call(context), err => err === afterSound);
  assert.equal(plays, 1);
  m.enabled = false;
  assert.throws(() => Scene.prototype.create.call(context), err => err === afterSound);
  assert.equal(plays, 1);
});
