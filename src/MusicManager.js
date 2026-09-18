import { MUSIC_ASSETS } from './MusicAssets.js';
import { loadMusic } from './MusicLoader.js';

// Looping music lives on the global sound manager. Downloads and fade cleanup
// also outlive gameplay scenes, so changing screens cannot strand a transition.
export class MusicManager {
  constructor() {
    this.tracks = {};
    this.enabled = true;
    try {
      const saved = localStorage.getItem('cosmicMathMusicEnabled');
      if (saved !== null) this.enabled = saved === '1';
    } catch (_) { /* Storage unavailable; default on. */ }
    this.volume = 0.35;
    this.volumeMultiplier = 1;
    this.currentKey = null;
    this._activeMultiplier = 1;
    this._request = null;
    this._requestId = 0;
    this._fallbacks = new Map();
    this._fadeOutTrack = null;
    this._fadeTimer = null;
  }

  ensurePlaying(scene, key = 'homeTheme') {
    return this._requestTrack(scene, key, 0);
  }

  // A known preferred track can be available on disk without being cached yet.
  // Keep that preference until its download fails, then try the fallback.
  resolveTrack(scene, preferred, fallback = 'homeTheme') {
    if (preferred !== fallback) this._fallbacks.set(preferred, fallback);
    return MUSIC_ASSETS[preferred] || scene.cache.audio.exists(preferred) ? preferred : fallback;
  }

  fadeToTrack(scene, key = 'homeTheme', durationMs = 500) {
    return this._requestTrack(scene, key, durationMs);
  }

  _requestTrack(scene, key, durationMs) {
    const previous = this._request;
    const sameRequest = previous?.key === key;
    const request = {
      id: ++this._requestId,
      key,
      rate: sameRequest ? previous.rate : 1,
      multiplier: sameRequest ? previous.multiplier : 1,
      durationMs: Math.max(0, durationMs),
      sound: scene.sound,
      cache: scene.cache.audio,
      resolvedKey: null
    };
    this._request = request;
    this.volumeMultiplier = request.multiplier;

    // Cached music still switches synchronously, matching existing callers.
    if (request.cache.exists(key)) {
      return Promise.resolve(this._activate(request, key));
    }
    // Keep game-owned references only. The original scene can be destroyed
    // before a failed preferred asset needs to start its fallback download.
    const loaderContext = { sys: { game: scene.sys.game } };
    return this._loadRequestedTrack(loaderContext, request, key, new Set());
  }

  async _loadRequestedTrack(scene, request, key, tried) {
    if (request.id !== this._requestId || tried.has(key)) return false;
    tried.add(key);
    const loaded = await loadMusic(scene, key);
    if (request.id !== this._requestId) return false;
    if (loaded) return this._activate(request, key);

    const fallback = this._fallbacks.get(key) || (key !== 'homeTheme' ? 'homeTheme' : null);
    if (fallback && !tried.has(fallback)) {
      return this._loadRequestedTrack(scene, request, fallback, tried);
    }
    // Keep the existing soundtrack when neither requested asset is available.
    return false;
  }

  _activate(request, key) {
    if (request.id !== this._requestId) return false;
    const oldTrack = this.tracks[this.currentKey];
    let track = this.tracks[key];
    try {
      // The destination scene often requests the same song again immediately
      // after an exit starts a crossfade. Keep that fade and its cleanup alive.
      if (this.currentKey === key && track?.isPlaying) {
        request.resolvedKey = key;
        if (request.rate !== track.rate) this._setTrackRate(track, request.rate);
        if (request.multiplier !== this._activeMultiplier) {
          this._activeMultiplier = request.multiplier;
          this._setTrackVolume(track, this.volume * request.multiplier);
        }
        return true;
      }
      if (!track) {
        track = request.sound.add(key, { loop: true, volume: this.volume });
        this.tracks[key] = track;
      }
      this._clearFadeOut();
      const switched = this.currentKey !== key;
      const crossfade = switched && request.durationMs > 0 && oldTrack?.isPlaying;
      const targetVolume = this.volume * request.multiplier;
      // Set volume before play/resume, including HTML audio, to avoid a loud
      // first frame. Apply mute after play too because Phaser reapplies config.
      this._setTrackVolume(track, crossfade ? 0 : targetVolume);
      this._applyMuteToTrack(track);
      if (track.isPaused) track.resume();
      else if (!track.isPlaying) track.play();
      this._applyMuteToTrack(track);
      this._setTrackRate(track, request.rate);
      this.currentKey = key;
      this._activeMultiplier = request.multiplier;
      request.resolvedKey = key;

      if (crossfade) {
        this._rampGain(track, 0, targetVolume, request.durationMs);
        this._rampGain(oldTrack, null, 0, request.durationMs);
        this._fadeOutTrack = oldTrack;
        // Scene timers disappear on shutdown. A wall-clock timer owns this
        // cleanup, and is canceled before a fading track can be reused.
        this._fadeTimer = setTimeout(() => {
          this._fadeTimer = null;
          if (this._fadeOutTrack === oldTrack) {
            this._stopTrack(oldTrack);
            this._fadeOutTrack = null;
          }
        }, request.durationMs + 40);
      } else if (switched && oldTrack) {
        this._stopTrack(oldTrack);
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  _setTrackVolume(track, value) {
    if (typeof track.setVolume === 'function') track.setVolume(value);
    else track.volume = value;
    const node = track.volumeNode;
    if (node?.gain && node.context) {
      const now = node.context.currentTime;
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(value, now);
    }
  }

  _rampGain(track, fromVal, toVal, durationMs) {
    if (!track) return;
    const node = track.volumeNode;
    if (!node?.gain || !node.context || durationMs <= 0) {
      this._setTrackVolume(track, toVal);
      return;
    }
    try {
      const now = node.context.currentTime;
      const from = fromVal == null ? node.gain.value : fromVal;
      // Keep Phaser's resume configuration in step with the final gain.
      if (track.currentConfig) track.currentConfig.volume = toVal;
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(from, now);
      node.gain.linearRampToValueAtTime(toVal, now + durationMs / 1000);
    } catch (_) { this._setTrackVolume(track, toVal); }
  }

  _clearFadeOut() {
    if (this._fadeTimer !== null) clearTimeout(this._fadeTimer);
    this._fadeTimer = null;
    if (this._fadeOutTrack) this._stopTrack(this._fadeOutTrack);
    this._fadeOutTrack = null;
  }

  _stopTrack(track) {
    try { track.stop(); } catch (_) { /* Already destroyed. */ }
  }

  pause() {
    // Invalidate pending downloads so a late response cannot undo this pause.
    this._requestId++;
    this._clearFadeOut();
    const track = this.tracks[this.currentKey];
    if (track?.isPlaying) track.pause();
  }

  _setTrackRate(track, rate, durationMs = 0) {
    const source = track.source;
    const previous = source?.playbackRate?.value;
    if (typeof track.setRate === 'function') track.setRate(rate);
    else track.rate = rate;
    if (!source?.playbackRate || !source.context || durationMs <= 0) return;
    try {
      const now = source.context.currentTime;
      source.playbackRate.cancelScheduledValues(now);
      source.playbackRate.setValueAtTime(previous, now);
      source.playbackRate.linearRampToValueAtTime(rate, now + durationMs / 1000);
    } catch (_) { /* The immediate rate is already applied. */ }
  }

  setPlaybackRate(rate, durationMs = 0) {
    if (!Number.isFinite(rate) || rate <= 0) return;
    if (this._request) this._request.rate = rate;
    const track = this._requestedActiveTrack();
    if (track) this._setTrackRate(track, rate, durationMs);
  }

  // While a new song downloads, volume/rate calls configure that request.
  // They should not pitch or fade the old song that is bridging the download.
  _requestedActiveTrack() {
    if (this._request?.resolvedKey !== this.currentKey) return null;
    return this.tracks[this.currentKey];
  }

  setVolume(multiplier = 1) {
    if (!Number.isFinite(multiplier) || multiplier < 0) return;
    this.volumeMultiplier = multiplier;
    if (this._request) this._request.multiplier = multiplier;
    const track = this._requestedActiveTrack();
    if (track) {
      this._activeMultiplier = multiplier;
      this._setTrackVolume(track, this.volume * multiplier);
    }
  }

  fadeVolume(multiplier = 1, durationMs = 400) {
    if (!Number.isFinite(multiplier) || multiplier < 0) return;
    this.volumeMultiplier = multiplier;
    if (this._request) this._request.multiplier = multiplier;
    const track = this._requestedActiveTrack();
    if (track) {
      this._activeMultiplier = multiplier;
      this._rampGain(track, null, this.volume * multiplier, durationMs);
    }
  }

  musicDuck(amount = 0.25, durationMs = 150) {
    const track = this.tracks[this.currentKey];
    if (!track || (!track.isPlaying && !track.isPaused)) return;
    const node = track.volumeNode;
    if (!node?.gain || !node.context) return;
    const now = node.context.currentTime;
    const baseVol = this.volume * this._activeMultiplier;
    const duckedVol = Math.max(0, baseVol * (1 - amount));
    const rampS = 0.04;
    const holdS = Math.max(0, durationMs / 1000 - rampS * 2);
    try {
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(node.gain.value, now);
      node.gain.linearRampToValueAtTime(duckedVol, now + rampS);
      node.gain.setValueAtTime(duckedVol, now + rampS + holdS);
      node.gain.linearRampToValueAtTime(baseVol, now + rampS + holdS + rampS);
    } catch (_) { /* Unsupported audio implementation. */ }
  }

  _stopCurrent() {
    this._requestId++;
    this._clearFadeOut();
    const track = this.tracks[this.currentKey];
    if (track) this._stopTrack(track);
  }

  setEnabled(bool) {
    this.enabled = !!bool;
    try { localStorage.setItem('cosmicMathMusicEnabled', bool ? '1' : '0'); } catch (_) { /* Storage unavailable. */ }
    for (const track of Object.values(this.tracks)) this._applyMuteToTrack(track);
  }

  _applyMuteToTrack(track) {
    if (typeof track.setMute === 'function') track.setMute(!this.enabled);
    else track.mute = !this.enabled;
    // Phaser schedules mute at audio time zero. Write the live node as well
    // so toggling still works after the context has started running.
    if (track.muteNode?.gain) track.muteNode.gain.value = this.enabled ? 1 : 0;
  }
}

export const music = new MusicManager();
