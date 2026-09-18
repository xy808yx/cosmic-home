import { MUSIC_ASSETS } from './MusicAssets.js';

const loaders = new WeakMap();
const LOADER_SCENE_KEY = '__musicLoader';

// This empty scene belongs to the game, so stopping the requesting gameplay
// scene cannot cancel a download. Phaser still handles decoding and HTML audio.
function getLoader(game) {
  let state = loaders.get(game);
  if (state) return state;

  state = { pending: new Map(), ready: null, destroyed: false };
  loaders.set(game, state);
  state.ready = new Promise(resolve => {
    game.events.once('destroy', () => {
      state.destroyed = true;
      resolve(null);
      for (const entry of state.pending.values()) entry.finish(false);
      loaders.delete(game);
    });
    game.scene.add(LOADER_SCENE_KEY, {
      create() {
        this.input.enabled = false;
        this.sys.setVisible(false);
        resolve(this.load);
      }
    }, true);
  });
  return state;
}

export function loadMusic(scene, key) {
  const game = scene.sys.game;
  const cache = game.cache.audio;
  if (game.pendingDestroy) return Promise.resolve(false);
  if (cache.exists(key)) return Promise.resolve(true);
  if (!MUSIC_ASSETS[key]) return Promise.resolve(false);

  const state = getLoader(game);
  const existing = state.pending.get(key);
  if (existing) return existing.promise;

  let finish;
  const promise = new Promise(resolve => { finish = resolve; });
  const entry = { promise, finish };
  state.pending.set(key, entry);

  state.ready.then(loader => {
    if (!loader || state.destroyed) { finish(false); return; }
    if (cache.exists(key)) { finish(true); return; }

    const complete = loadedKey => { if (loadedKey === key) done(cache.exists(key)); };
    const failed = file => { if (file.key === key) done(false); };
    // Decode errors and unsupported audio types also end here, even when no
    // filecomplete event was emitted. A later request can retry a failed file.
    const drained = () => done(cache.exists(key));
    const done = ok => {
      loader.off('filecomplete', complete);
      loader.off('loaderror', failed);
      loader.off('complete', drained);
      finish(ok);
    };
    entry.finish = done;
    loader.on('filecomplete', complete);
    loader.on('loaderror', failed);
    loader.on('complete', drained);
    try {
      loader.audio(key, MUSIC_ASSETS[key]);
      if (!loader.isLoading()) loader.start();
    } catch (_) { done(false); }
  }).catch(() => finish(false));

  promise.then(() => {
    if (state.pending.get(key) === entry) state.pending.delete(key);
  });
  return promise;
}
