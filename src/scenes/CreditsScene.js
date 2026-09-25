// Endgame cinematic. Runs in one of three modes (registry 'creditsMode'):
//
//   'cliffhanger' (Chapter 1 / World 11): cards, then the pet evolves to Cosmic,
//      then a light teaser outro pointing at the warp gate. Keeps endingSeen
//      (Cosmic pet + Arcade unlock). NO hero card, that plays at the homecoming
//      (World 38).
//   'finale' (Chapter 2 / World 28): cards, then (evolve only if not already
//      Cosmic) a short homeward coda that names the Nanocraft reward and points
//      at the gate into Chapter 3. Sets finaleSeen. The hero card used to play
//      here; it now closes the whole game at World 38 instead.
//   'homecoming' (Chapter 3 / World 38, Home Ground): The Ride Down. One
//      continuous dusk scene in the paper-cutout style: the summit lines, the
//      pet hops into the red cabin, the four recap cards ride down with it while
//      the places, the trail lamps and the city light up below, then the cabin
//      docks, the pet steps out, and the three names and the message close the
//      game over the lit city. No pet evolution beat (the pet is already Cosmic)
//      and no skip. Sets finale3Seen.
//
// On exit, returns to WorldMapScene parked on the chapter's final world and
// clears justClearedWorld so the auto-advance doesn't run on top of the finale.

import Phaser from 'phaser';
import { progress } from '../GameData.js';
import { audio } from '../AudioManager.js';
import { music } from '../MusicManager.js';
import { MUSIC_ASSETS } from '../MusicAssets.js';
import { TransitionManager } from '../TransitionManager.js';
import { createStarfield } from '../starfieldHelper.js';
import { style, TYPE } from '../textStyles.js';
import { COLORS } from '../colorPalette.js';
import { companion, drawCompanion } from '../CompanionManager.js';
import { createButton } from '../buttonHelper.js';
import { createRideDown, makeCaption, cabinAt, TOWER_T } from '../homeGround/rideDown.js';
import { paper, ink } from '../homeGround/paper.js';

const W = 1080;
const H = 1920;

// The personal hero card text. Hardcoded per the user's request.
const HERO_NAMES = '小宇  新宇  星宇';
const HERO_MESSAGE = '爸爸爱你';

// One continuous arc across both chapters. Chapter 1 ends with the Void NOT
// gone but SHRUNK into a scale you can't see (the cliffhanger); Chapter 2 ends
// with the last shadow letting go inside the smallest cell, healing outward.
const CLIFFHANGER_CARDS = [
  'The Void Devourer dims… then folds inward. Smaller, and smaller.',
  'Across the galaxy, worlds remember what light feels like.',
  'But the dark did not leave. It SHRANK.',
  'Something is wrong now, at a scale far too small to see…'
];

const FINALE_CARDS = [
  'Patient Zero, the very first germ of all, goes still.',
  'Deep inside the smallest cell, the last shadow lets go.',
  'From the bloodstream to the stars, every world breathes easy.',
  'You did it, pilot. Outer space AND inner space are yours.'
];

// Chapter 3 (World 38, The Mountain): the homecoming. The scale arc lands at
// human scale: one Saturday around the family's own city, morning to dusk, and
// the last stop is the climb up the mountain on your own legs and the ride back
// down as the city lights come on. No void.
// Card four and the World 38 description are near-twins on purpose.
// Each card is kept as its lines: the words are fixed, only the breaks are
// chosen (for balance on the paper strip). y is the strip's centre; show and
// hide are ms from the start of the credits. Cards one to three sit low on the
// screen; card four and the couplet sit high so the lamps and the city below
// them stay in view.
const HOMECOMING_CARDS = [
  { lines: ['You journeyed to', 'the edge of the cosmos.', 'Then into the smallest cell.'], y: 1660, show: 10300, hide: 13700 },
  { lines: ['And now the long way around', 'brings you somewhere new: home.'], y: 1660, show: 14200, hide: 17500 },
  { lines: ['A whole Saturday of it.', 'The store, the garden,', 'the beach, the bread place.'], y: 1660, show: 17900, hide: 22000 },
  { lines: ['You walked all the way up.', 'The lights came on', 'for the ride down.'], y: 222, show: 22400, hide: 25900 },
  { lines: ['The mountain is lit', 'for the ride down.', 'Below you, one by one,', 'the city lights come on.'], y: 290, show: 26300, hide: 33800 },
];

// The summit lines, said at the top where they are literally true.
const SUMMIT_TITLE = 'CHAPTER 3 COMPLETE';
const SUMMIT_LINES = ['You made it!', 'You got to the very top!'];

// How far down the cable the ride is (0 at the summit, 1 docked at the bottom)
// at each moment, in ms from the start. It slows through the places while card
// three names them, and passes the trail while card four lights its lamps.
// The ride module already eases off the top dock and into the bottom one.
const RIDE_PACE = [[9800, 0], [18200, 0.37], [22000, 0.47], [25900, 0.64], [33800, 0.96], [34400, 1]];

// A smooth, never-overshooting curve through the pace keys (monotone cubic,
// the Fritsch and Carlson way). The ends keep their own slope, so the ride
// sets off and arrives at the pace the ride module's own easing expects.
function paceCurve(keys) {
  const n = keys.length;
  const xs = keys.map(k => k[0]);
  const ys = keys.map(k => k[1]);
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const u = (x - xs[i]) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i]
      + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1];
  };
}

// Stops the credits song and removes it from the game's sound manager, once.
function releaseSong(song) {
  if (song && !song.pendingRemove) {
    song.stop();
    song.destroy();
  }
}

// The pale window of the little gondola cabin in the Chapter 2 coda.
const DUSK_LOW = 0xffe9a8;

// A small paper-cutout red gondola cabin, the Home Ground stand-in for the old
// lamp glyph. Like every cutout it is drawn twice: first the same shapes in
// black at alpha 0.22, offset (+4, +6), then in colour on top. Origin (0, 0) is
// the wheel on the cable, so a sway tween pivots where a real cabin hangs from.
// Rounded rect body, darker roof cap, one pale window, a thin hanger arm up to
// a plain wheel disc. Plain shapes only, no spirals or sunbursts, no rays.
const CABIN_RED = 0xe8594a;
const CABIN_ROOF = 0xb33f33;
const CABIN_DARK = 0x3a2a50;
function drawGondolaCabin(g) {
  [{ dx: 4, dy: 6, shadow: true }, { dx: 0, dy: 0, shadow: false }].forEach(({ dx, dy, shadow }) => {
    const ink = (color, alpha = 1) => g.fillStyle(shadow ? 0x000000 : color, shadow ? 0.22 : alpha);
    // Wheel on the cable, then the hanger arm down to the roof.
    ink(CABIN_DARK); g.fillCircle(dx, dy, 7);
    g.lineStyle(4, shadow ? 0x000000 : CABIN_DARK, shadow ? 0.22 : 0.95);
    g.lineBetween(dx, 6 + dy, dx, 24 + dy);
    // Roof cap, a shade darker than the body.
    ink(CABIN_ROOF); g.fillRoundedRect(-30 + dx, 22 + dy, 60, 14, 6);
    // Body.
    ink(CABIN_RED); g.fillRoundedRect(-26 + dx, 32 + dy, 52, 46, 10);
    // Pale window.
    ink(DUSK_LOW); g.fillRoundedRect(-16 + dx, 40 + dy, 32, 20, 6);
  });
  return g;
}

export class CreditsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CreditsScene' });
  }

  preload() {
    if (!this.cache.audio.exists('creditsSong')) {
      this.load.audio('creditsSong', MUSIC_ASSETS.creditsSong);
    }
  }

  create() {
    audio.init();
    music.pause();

    // 'cliffhanger' (World 11), 'finale' (World 28) or 'homecoming' (World 38).
    // Default to the HARMLESS cliffhanger path: the finale path grants the
    // Nanocraft trophy + marks the finale seen, so a flagless/accidental entry
    // must never land there. Every real finale launch sets creditsMode explicitly.
    this.mode = this.registry.get('creditsMode') || 'cliffhanger';
    this.cards = this.mode === 'cliffhanger' ? CLIFFHANGER_CARDS : FINALE_CARDS;

    // Credits soundtrack: plays once (not looped) under whichever beats the
    // mode runs (the cards, then the mode's outro; at the homecoming, the whole
    // Ride Down). Falls back silently if the file is missing.
    // Respect the Music toggle: creditsSong is played directly (not via
    // MusicManager), so it must check music.enabled itself or it would play
    // through a muted setting. Cleared first so a replay never inherits the
    // last run's song.
    this._creditsSong = null;
    if (music.enabled && this.cache.audio.exists('creditsSong')) {
      this._creditsSong = this.sound.add('creditsSong', { volume: 0.5, loop: false });
      this._creditsSong.play();
      // The song is let go with the scene, in every mode: each run adds a
      // fresh one to the game's sound manager, so the old one must not stay
      // behind, and a fade cut short by the scene ending can never leave it
      // playing.
      const song = this._creditsSong;
      const letGo = () => {
        this.events.off('shutdown', letGo);
        this.events.off('destroy', letGo);
        releaseSong(song);
      };
      this.events.once('shutdown', letGo);
      this.events.once('destroy', letGo);
    }

    if (this.mode === 'homecoming') {
      // Home Ground: The Ride Down plays from the first frame, built (and all
      // its art baked) before the fade in lifts, so the build never shows.
      this.playRideDown();
      new TransitionManager(this).fadeIn(400);
      return;
    }

    createStarfield(this, { width: W, height: H, accentStrength: 0 });

    // Deep velvet backdrop on top of the starfield for cinematic mood.
    this.backdrop = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1).setDepth(5);
    this.backdrop.alpha = 0;
    this.tweens.add({ targets: this.backdrop, alpha: 0.6, duration: 800 });

    // Sprinkle 80 twinkly stars (same as the original finale).
    this.starLayer = this.add.container(0, 0).setDepth(8);
    for (let i = 0; i < 80; i++) {
      const sx = Math.random() * W;
      const sy = Math.random() * (H - 100) + 50;
      const r = Math.random() * 2 + 1.2;
      const star = this.add.graphics();
      star.fillStyle(0xffffff, 1);
      star.fillCircle(sx, sy, r);
      star.alpha = 0;
      this.starLayer.add(star);
      this.tweens.add({
        targets: star,
        alpha: 1,
        duration: 600 + Math.random() * 1200,
        delay: 200 + Math.random() * 2200,
        ease: 'Quad.easeOut'
      });
    }

    new TransitionManager(this).fadeIn(400);

    // Begin the cinematic sequence.
    this.time.delayedCall(900, () => this.playCinematicCards());
  }

  // ============================================================
  // PART A — 4-card cinematic
  // ============================================================
  playCinematicCards() {
    const cards = this.cards;
    let i = 0;
    const showCard = (text, last) => {
      const cardW = 880;
      const cardH = 260;
      const card = this.add.container(W / 2, H / 2).setDepth(20);
      const bg = this.add.graphics();
      bg.fillStyle(COLORS.bgPanel, 0.92);
      bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 28);
      bg.lineStyle(3, 0xfbbf24, 0.95);
      bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 28);
      card.add(bg);
      card.add(this.add.text(0, 0, text, style('subhead', {
        fontSize: `${TYPE.body}px`,
        fill: '#ffeaa7',
        align: 'center',
        wordWrap: { width: cardW - 80 }
      })).setOrigin(0.5));

      card.alpha = 0;
      card.y = H / 2 + 20;
      this.tweens.add({
        targets: card,
        alpha: 1,
        y: H / 2,
        duration: 500,
        ease: 'Quad.easeOut'
      });

      const advance = () => {
        this.tweens.add({
          targets: card,
          alpha: 0,
          y: H / 2 - 20,
          duration: 450,
          onComplete: () => {
            card.destroy();
            i++;
            if (i < cards.length) {
              showCard(cards[i], i === cards.length - 1);
            } else {
              this.afterCards();
            }
          }
        });
      };

      this.time.delayedCall(last ? 2800 : 2400, advance);
    };
    showCard(cards[0], false);
  }

  // Route past the cards depending on mode. The pet's Cosmic evolution beat is
  // the Chapter 1 (cliffhanger) payoff; in the finale the pet is already Cosmic
  // (unless a player skipped World 11 entirely, then show it once here too).
  afterCards() {
    if (this.mode === 'cliffhanger') {
      this.playPetEvolutionMoment(() => this.showCliffhangerOutro());
    } else {
      // Chapter 2 finale: straight to the homeward coda (which also names the
      // Nanocraft reward). The names and the message moved to the homecoming.
      if (companion.hasStarter() && !progress.companion?.cosmicForm) {
        this.playPetEvolutionMoment(() => this.showHomewardOutro());
      } else {
        this.showHomewardOutro();
      }
    }
  }

  // ============================================================
  // PART B: Pet evolution moment (cosmic-tier glow)
  // Calls `done` when the beat is over (straight away without a pet).
  // ============================================================
  playPetEvolutionMoment(done) {
    if (!companion.hasStarter()) {
      done();
      return;
    }

    const sp = companion.getSpecies();
    const accent = sp?.accent || 0xfbbf24;

    const cx = W / 2;
    const cy = H / 2;

    // Halo pulse
    const halo = this.add.graphics().setDepth(15);
    halo.fillStyle(accent, 1);
    halo.fillCircle(cx, cy, 100);
    halo.alpha = 0;
    halo.setScale(0.3);
    this.tweens.add({
      targets: halo,
      alpha: { from: 0, to: 0.55 },
      scale: 3.2,
      duration: 1400,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: halo,
          alpha: 0,
          duration: 500,
          onComplete: () => halo.destroy()
        });
      }
    });

    // Pet appears as ADULT (the player's current form) and scales up.
    let pet = drawCompanion(this, cx, cy, { stage: 'adult', scale: 1.6 }).setDepth(16);
    pet.setScale(0);
    audio.playEvolutionBuildup?.();
    this.tweens.add({
      targets: pet,
      scale: 1.6,
      duration: 700,
      ease: 'Back.easeOut',
      onComplete: () => {
        audio.playEvolutionFlash?.();
        // A brighter inner ring "cosmic" effect
        const ring = this.add.graphics().setDepth(17);
        ring.lineStyle(8, 0xffffff, 1);
        ring.strokeCircle(cx, cy, 80);
        ring.alpha = 1;
        this.tweens.add({
          targets: ring,
          scale: 4,
          alpha: 0,
          duration: 700,
          ease: 'Quad.easeOut',
          onComplete: () => ring.destroy()
        });

        // Grant + persist the Cosmic form (idempotent). Decoupled from the old
        // stage==='adult' gate so the saved state always matches this cinematic.
        companion.unlockCosmic();
        pet.destroy();
        pet = drawCompanion(this, cx, cy, { stage: 'cosmic', scale: 1.6 }).setDepth(16);

        // Pet scales briefly larger then settles
        this.tweens.add({
          targets: pet,
          scaleX: 1.9,
          scaleY: 1.9,
          duration: 250,
          yoyo: true,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            audio.playEvolutionResolve?.();
            // Quick title card under the pet
            const tag = this.add.text(cx, cy + 200, 'COSMIC FORM', style('display', {
              fontSize: `${TYPE.title}px`,
              fill: '#fbbf24',
              stroke: '#0a0a1a',
              strokeThickness: 4
            })).setOrigin(0.5).setDepth(18);
            tag.alpha = 0;
            this.tweens.add({
              targets: tag,
              alpha: 1,
              duration: 400,
              ease: 'Quad.easeOut'
            });

            this.time.delayedCall(1700, () => {
              this.tweens.add({
                targets: [pet, tag],
                alpha: 0,
                duration: 600,
                onComplete: () => {
                  pet.destroy();
                  tag.destroy();
                  done();
                }
              });
            });
          }
        });
      }
    });
  }

  // ============================================================
  // CLIFFHANGER OUTRO (Chapter 1) — a light teaser, not the hero card.
  // Points the player at the warp gate that now sits beside Universe's End
  // (World 11, the finale node), which is where it opens after the boss falls.
  // ============================================================
  showCliffhangerOutro() {
    const wash = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1).setDepth(60);
    wash.alpha = 0;
    this.tweens.add({ targets: wash, alpha: 0.9, duration: 1500, ease: 'Quad.easeIn' });

    const lines = [
      { t: 'CHAPTER 1 COMPLETE', size: TYPE.title, fill: '#fbbf24', y: 0.30, delay: 600 },
      { t: 'The galaxy is bright again…', size: TYPE.body, fill: '#ffeaa7', y: 0.40, delay: 2200 },
      { t: 'but something stirs at a scale\nyou cannot see.', size: TYPE.heading, fill: '#ff7a8a', y: 0.52, delay: 4200 },
      { t: 'Find the WARP GATE\nbeside UNIVERSE\'S END\nand dive into INNER SPACE.', size: TYPE.body, fill: '#b5e6ff', y: 0.70, delay: 7000 }
    ];
    lines.forEach(l => {
      const txt = this.add.text(W / 2, H * l.y, l.t, style('display', {
        fontSize: `${l.size}px`, fill: l.fill, align: 'center',
        stroke: '#0a0a1a', strokeThickness: 4, wordWrap: { width: W - 120 }
      })).setOrigin(0.5).setDepth(70);
      txt.alpha = 0; txt.setScale(0.9);
      this.time.delayedCall(l.delay, () => {
        audio.playMatch?.();
        this.tweens.add({ targets: txt, alpha: 1, scale: 1, duration: 800, ease: 'Back.easeOut' });
      });
    });

    // A small inward portal glyph (membrane rings — no spiral/sigil).
    this.time.delayedCall(5400, () => {
      const g = this.add.graphics().setDepth(69);
      g.x = W / 2; g.y = H * 0.60;
      g.lineStyle(4, 0xff7a8a, 0.9); g.strokeCircle(0, 0, 34);
      g.lineStyle(3, 0xff7a8a, 0.55); g.strokeCircle(0, 0, 22);
      g.fillStyle(0xff7a8a, 0.9); g.fillCircle(0, 0, 6);
      g.alpha = 0;
      this.tweens.add({ targets: g, alpha: 1, duration: 600 });
      this.tweens.add({
        targets: g, scale: { from: 1, to: 1.4 }, alpha: { from: 0.9, to: 0.35 },
        duration: 1600, repeat: -1, yoyo: true, ease: 'Sine.easeInOut'
      });
    });

    this.time.delayedCall(9500, () => {
      const btn = createButton(this, {
        x: W / 2, y: H - 200, label: 'Onward',
        width: 360, height: 100, color: 0xff7a8a,
        onClick: () => this.exitFinale()
      });
      btn.setDepth(75); btn.alpha = 0;
      this.tweens.add({ targets: btn, alpha: 1, duration: 800 });
    });
  }

  // ============================================================
  // HOMEWARD OUTRO (the Chapter 2 finale's closing beat): the on-ramp into
  // Chapter 3, Home Ground. Plays unconditionally now that the chapter is
  // always on.
  //
  // This is deliberately NOT a cliffhanger. Chapter 1 ended by opening a threat
  // ("the dark did not leave. It SHRANK") because Chapter 2 was more story. The
  // story is DONE here: Patient Zero is beaten and the last shadow let go. So
  // this coda closes the conflict out loud ("nothing left to fight") and opens
  // a DOOR instead of a wound: the journey home. Home Ground is where you've
  // stopped fighting, not where you fight next. The two payoff lines below stay
  // exactly as shipped; they still fit. The Nanocraft reward banner lands here
  // too (the hull itself was granted by markFinaleSeen in GameScene), since the
  // hero card that used to name it now plays at the end of Chapter 3.
  // ============================================================
  showHomewardOutro() {
    const wash = this.add.rectangle(W / 2, H / 2, W, H, 0x1a1208, 1).setDepth(80);
    wash.alpha = 0;
    this.tweens.add({ targets: wash, alpha: 0.94, duration: 1400, ease: 'Quad.easeIn' });

    const lines = [
      { t: 'And that was the last of it.', size: TYPE.heading, fill: '#fff3b8', y: 0.19, delay: 700 },
      { t: 'Nothing left to fight.\nNot out in the stars.\nNot down in the smallest cell.', size: TYPE.body, fill: '#ffe0a0', y: 0.29, delay: 2600 },
      { t: 'But you are a long way from home,\nand the light you switched back on\nis waiting for you there.', size: TYPE.body, fill: '#ffd27a', y: 0.41, delay: 5000 },
      { t: 'Find the WARP GATE\nbeside THE SINGULARITY CELL\nand take the long way home\nto HOME GROUND.', size: TYPE.body, fill: '#9be86b', y: 0.615, delay: 7800 }
    ];
    lines.forEach(l => {
      const txt = this.add.text(W / 2, H * l.y, l.t, style('display', {
        fontSize: `${l.size}px`, fill: l.fill, align: 'center',
        stroke: '#0a0a1a', strokeThickness: 4, wordWrap: { width: W - 120 }
      })).setOrigin(0.5).setDepth(85);
      txt.alpha = 0; txt.setScale(0.92);
      this.time.delayedCall(l.delay, () => {
        audio.playMatch?.();
        this.tweens.add({ targets: txt, alpha: 1, scale: 1, duration: 800, ease: 'Back.easeOut' });
      });
    });

    // A small red gondola cabin on its cable (paper cutout, plain shapes, no
    // rays / spiral / sigil): the first glimpse of the ride down the mountain that
    // ends the chapter, and the daylight answer to the cliffhanger outro's cold
    // portal rings. The cable is its own static graphic so the cabin can sway
    // from the wheel without dragging the cable with it.
    this.time.delayedCall(6200, () => {
      const cx = W / 2, cy = H * 0.49;
      const cable = this.add.graphics().setDepth(83);
      cable.lineStyle(3, 0x000000, 0.22); cable.lineBetween(cx - 90 + 4, cy + 6, cx + 90 + 4, cy + 6);
      cable.lineStyle(3, CABIN_DARK, 0.9);  cable.lineBetween(cx - 90, cy, cx + 90, cy);
      const g = drawGondolaCabin(this.add.graphics().setDepth(84));
      g.x = cx; g.y = cy;
      cable.alpha = 0; g.alpha = 0;
      this.tweens.add({ targets: [cable, g], alpha: 1, duration: 600 });
      this.tweens.add({
        targets: g, rotation: { from: -0.05, to: 0.05 },
        duration: 1800, repeat: -1, yoyo: true, ease: 'Sine.easeInOut'
      });
    });

    // Nanocraft reward reveal: the hull is already equipped, this banner just
    // names the trophy. Sits between the last line and the button.
    this.time.delayedCall(9000, () => this.showNanocraftBanner(H * 0.772, 86));

    this.time.delayedCall(10200, () => {
      const btn = createButton(this, {
        x: W / 2, y: H - 180, label: 'Head home',
        width: 380, height: 100, color: 0xffd27a,
        onClick: () => this.exitFinale()
      });
      btn.setDepth(88); btn.alpha = 0;
      this.tweens.add({ targets: btn, alpha: 1, duration: 800 });
    });
  }

  // The "★ NANOCRAFT HULL UNLOCKED ★" banner (Chapter 2 finale reward).
  // The box is sized from the two measured lines plus padding.
  showNanocraftBanner(y, depth) {
    const rc = this.add.container(W / 2, y).setDepth(depth);
    const rg = this.add.graphics();
    const head = this.add.text(0, 0, '★ NANOCRAFT HULL UNLOCKED ★', style('caption', {
      fontSize: `${TYPE.body}px`, fill: '#4ecdc4', fontStyle: '900'
    })).setOrigin(0.5);
    const sub = this.add.text(0, 0, 'Equipped! Build out the rest in the Shop.', style('body', {
      fill: '#cfcfe0', align: 'center', wordWrap: { width: W - 200 }
    })).setOrigin(0.5);
    const padX = 44, padY = 22, gap = 6;
    const bw = Math.min(W - 60, Math.ceil(Math.max(head.width, sub.width)) + padX * 2);
    const bh = Math.ceil(head.height + gap + sub.height) + padY * 2;
    head.y = -bh / 2 + padY + head.height / 2;
    sub.y = bh / 2 - padY - sub.height / 2;
    rg.fillStyle(0x0a0a1a, 0.92); rg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 18);
    rg.lineStyle(3, 0x4ecdc4, 1); rg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 18);
    rc.add([rg, head, sub]);
    rc.alpha = 0;
    audio.playStardustChime?.();
    this.tweens.add({ targets: rc, alpha: 1, duration: 700, ease: 'Quad.easeOut' });
    return rc;
  }

  // ============================================================
  // THE RIDE DOWN (Chapter 3 / World 38): the end of the whole game. One
  // continuous, auto-playing dusk scene under the credits song, about 50 s:
  //   0 s     the summit at dusk, the cabin waiting with its door open, the
  //           pet on the deck; CHAPTER 3 COMPLETE and the two summit lines
  //   8.4 s   the pet hops into the window seat and the door shuts
  //   9.8 s   the ride: the four recap cards on paper strips while the places,
  //           the trail lamps and then the city light up below
  //   34.4 s  the cabin docks, the door opens, the pet steps out
  //   37.8 s  the three names one at a time, then the message, then Home
  // Everything the ride puts on stage lives in this closure, so a Dad's Menu
  // replay (the same scene instance) always starts clean. The ride's art is
  // baked into textures once (see rideDown.js); per frame, only positions,
  // scales and fades change.
  // ============================================================
  playRideDown() {
    const rd = createRideDown(this, { depth: 0 });
    const UI = 80;
    const INK = '#3a2a20';
    const at = (ms, fn) => this.time.delayedCall(ms, fn);
    const fadeTo = (targets, alpha, duration, more = {}) => this.tweens.add({
      targets, alpha, duration, ease: alpha > 0 ? 'Sine.easeOut' : 'Sine.easeIn', ...more
    });
    const fadeOut = (obj, ms = 320) => fadeTo(obj, 0, ms, { onComplete: () => obj.destroy() });
    const bigText = (x, y, text, px, fill, stroke, thick) => this.add.text(x, y, text, style('display', {
      fontSize: `${px}px`, fill, stroke, strokeThickness: thick, align: 'center'
    })).setOrigin(0.5).setDepth(UI + 2).setAlpha(0);

    // The summit: the cabin waits with its door open, the pet on the deck.
    rd.setRide(0);
    rd.setPetAt('summit');
    rd.openDoor(1);

    // CHAPTER 3 COMPLETE, cream on a dusk stroke over the violet sky.
    const title = bigText(W / 2, 196, SUMMIT_TITLE, 72, '#ffe9a8', '#3a2a50', 8);
    at(900, () => {
      audio.playStar?.();
      title.setScale(0.92);
      fadeTo(title, 1, 700, { scale: 1, ease: 'Back.easeOut' });
    });

    // One cream strip holds both summit lines, the first set bigger and red.
    // "You made it!" arrives alone, centred on the strip; the second line
    // joins it as the first steps up.
    const madeIt = bigText(W / 2, 352, SUMMIT_LINES[0], 64, '#c44b3a', '#fff6e0', 0);
    const veryTop = bigText(W / 2, 394, SUMMIT_LINES[1], 52, INK, '#fff6e0', 0);
    const stripW = Math.min(W - 48, Math.ceil(Math.max(madeIt.width, veryTop.width)) + 140);
    const strip = this.add.graphics().setDepth(UI).setAlpha(0);
    paper(strip, 8, 10, (gg, s) => {
      ink(gg, s, 0xfff6e0);
      gg.fillRoundedRect(W / 2 - stripW / 2, 268, stripW, 168, 20);
    });
    strip.fillStyle(0xe8dcc0, 1);
    strip.fillRoundedRect(W / 2 - stripW / 2 + 20, 426, stripW - 40, 4, 2);
    at(2600, () => {
      audio.playStardustChime?.();
      fadeTo([strip, madeIt], 1, 500);
    });
    at(4400, () => {
      audio.playStardustChime?.();
      this.tweens.add({ targets: madeIt, y: 318, duration: 500, ease: 'Sine.easeInOut' });
      veryTop.y = 406;
      fadeTo(veryTop, 1, 500, { y: 394 });
    });
    at(8200, () => [title, strip, madeIt, veryTop].forEach(o => fadeOut(o, 400)));

    // The pet hops into the window seat and the door shuts behind it.
    at(8400, () => {
      audio.playPetChirp?.();
      rd.board({ duration: 900 });
    });
    at(9350, () => rd.closeDoor(260));

    // The recap cards and the couplet: cream paper strips, built now so none
    // of them costs a frame mid-ride, each faded in and out on its own beat.
    HOMECOMING_CARDS.forEach(({ lines, y, show, hide }) => {
      const cap = makeCaption(this, lines.join('\n'), { y, px: 52 }).setDepth(UI).setAlpha(0);
      at(show, () => { cap.y = y + 14; fadeTo(cap, 1, 300, { y }); });
      at(hide, () => fadeOut(cap, 300));
    });

    // Card three names the places, and each one lights as it is named.
    ['store', 'garden', 'beach', 'bread'].forEach((id, i) => at(18500 + i * 800, () => {
      audio.playStar?.();
      rd.lightPlace(id, 450);
    }));

    // Card four: the lamps light one by one from the top down. Tower 1's lamp
    // is already behind us by now; the rest are in view under the card.
    for (let i = 0; i < rd.lampCount; i++) {
      at(i === 0 ? 22500 : i === 1 ? 22900 : 23200 + (i - 2) * 280, () => rd.lightLamp(i, 320));
    }

    // The couplet: the city's windows come on one group at a time, and the
    // shore, the bridge and their reflections fade up under them.
    for (let i = 0; i < rd.cityGroupCount; i++) at(26900 + i * 550, () => rd.lightCityGroup(i, 380));
    at(28000, () => rd.fadeShoreLights(1, 5000));

    // The ride itself follows the scene clock (the same clock the cues above
    // run on), so the framing and the words can never drift apart. A gentle
    // pendulum sway the whole way, with a small lurch at each tower.
    const pace = paceCurve(RIDE_PACE);
    const rideEnd = RIDE_PACE[RIDE_PACE.length - 1][0];
    const towerX = TOWER_T.map(t => cabinAt(t).x);
    let clock = 0;
    let passed = 0;
    let docked = false;
    const lurch = () => {
      rd.sway(3, 760);
      this.time.delayedCall(200, () => { if (!docked) rd.sway(1.6, 2800); });
    };
    const onUpdate = (time, delta) => {
      clock += delta;
      if (docked || clock < RIDE_PACE[0][0]) return;
      rd.setRide(pace(clock));
      if (passed < towerX.length && rd.cabin.x >= towerX[passed]) { passed++; lurch(); }
      if (clock >= rideEnd) docked = true;
    };
    at(9800, () => rd.sway(1.6, 2800));

    // Docked: the sway settles, the door opens and the pet steps out onto
    // the pier over the lit city.
    at(rideEnd, () => { docked = true; rd.setRide(1); rd.settle(900); });
    at(36000, () => rd.openDoor(260));
    at(36400, () => {
      audio.playPetChirp?.();
      rd.alight({ duration: 1000 });
    });

    // The three names, one at a time, then the message, once, as the last beat.
    const names = HERO_NAMES.split(/\s+/).filter(Boolean);
    names.forEach((name, i) => {
      const t = bigText(W / 2 + (i - (names.length - 1) / 2) * 300, 250, name, 120, '#ffd27a', '#3a2a50', 10);
      at(37800 + i * 2200, () => {
        audio.playStardustChime?.();
        t.setScale(0.7);
        fadeTo(t, 1, 900, { scale: 1, ease: 'Back.easeOut' });
      });
    });
    const love = bigText(W / 2, 420, HERO_MESSAGE, 128, '#fff6e0', '#c44b3a', 10);
    at(44800, () => {
      audio.playStar?.();
      love.setScale(0.85);
      fadeTo(love, 1, 1400, {
        scale: 1, ease: 'Back.easeOut',
        // Two slow heartbeats.
        onComplete: () => this.tweens.add({
          targets: love, scaleX: 1.08, scaleY: 1.08,
          duration: 700, yoyo: true, repeat: 1, ease: 'Sine.easeInOut'
        })
      })
    });

    // Home, back to the finished map. Then the lit city idles for as long as
    // the kid likes; nothing moves on until Home is tapped.
    let leaving = false;
    let handedOff = false;
    at(49500, () => {
      const btn = createButton(this, {
        x: W / 2, y: 1798, label: 'Home',
        width: 340, height: 96, color: 0x4f8a3a,
        onClick: () => {
          if (leaving) return;   // createButton fires onClick on every pointerdown
          leaving = true;
          handedOff = true;      // exitFinale takes the song from here
          this.exitFinale();
        }
      });
      btn.setDepth(UI + 5).setAlpha(0);
      fadeTo(btn, 1, 800);
      rd.startIdle();
    });

    // When the credits song ends, the Home Ground map theme carries the idle
    // (WorldMapScene asks for the same track, so it plays straight through).
    // With the music off or the song missing it hands off straight away, and a
    // late timer covers a song whose end never gets reported.
    const song = this._creditsSong;
    const toMapTheme = () => {
      if (handedOff) return;
      handedOff = true;
      this.handOffToMapTheme();
    };
    if (song) {
      song.once('complete', toMapTheme);
      at(((song.duration || 52.8) + 2) * 1000, toMapTheme);
    } else {
      toMapTheme();
    }

    // Tear down with the scene: the ride (and its baked textures) and every
    // listener, so the next replay starts clean.
    const cleanup = () => {
      this.events.off('update', onUpdate);
      this.events.off('shutdown', cleanup);
      this.events.off('destroy', cleanup);
      if (song) song.off('complete', toMapTheme);
      rd.destroy();
    };
    this.events.on('update', onUpdate);
    this.events.once('shutdown', cleanup);
    this.events.once('destroy', cleanup);
  }

  // The credits song plays once and runs out a few seconds after the Ride
  // Down's Home button arrives, which would leave the idle over the lit city
  // in silence. Fade it out and bring the Home Ground map theme up instead;
  // WorldMapScene asks for the same track on the way out, so the music
  // carries straight through.
  handOffToMapTheme() {
    const song = this._creditsSong;
    this._creditsSong = null;
    if (song && song.isPlaying) {
      this.tweens.add({ targets: song, volume: 0, duration: 1200, onComplete: () => releaseSong(song) });
    }
    music.fadeToTrack(this, music.resolveTrack(this, 'homeGroundHome'), 1500);
  }

  exitFinale() {
    // Persist the right flag for the mode (both idempotent; GameScene already
    // set them early, this is the belt-and-suspenders on the "Onward" path).
    if (this.mode === 'cliffhanger') {
      progress.markEndingSeen();
    } else if (this.mode === 'homecoming') {
      progress.markFinale3Seen();
    } else {
      progress.markFinaleSeen();
    }
    progress.consumeJustClearedWorld(); // Clear any stale flag.

    const song = this._creditsSong;
    if (song && song.isPlaying) {
      this.tweens.add({
        targets: song,
        volume: 0,
        duration: 400,
        onComplete: () => releaseSong(song)
      });
    }

    // Open the map on the chapter that actually contains the parked world, and
    // park the ship on that chapter's final world. Without setting the chapter,
    // a replay launched from the "wrong" chapter (e.g. dev-menu finale replay
    // while viewing Chapter 1) would rebuild the wrong map and park on a node id
    // that doesn't exist there. setCurrentChapter is idempotent.
    // Each credits mode parks on its chapter's final world; default is the
    // grand finale (Chapter 2, World 28).
    const MODE_TARGET = {
      cliffhanger: { chapter: 1, world: 11 },
      homecoming: { chapter: 3, world: 38 }
    };
    const target = MODE_TARGET[this.mode] || { chapter: 2, world: 28 };
    progress.setCurrentChapter(target.chapter);
    this.registry.set('shipParkedWorldId', target.world);
    this.registry.set('freePlay', false);
    this.registry.set('creditsMode', null); // consume so a stray relaunch defaults cleanly

    new TransitionManager(this).fadeToScene('WorldMapScene');
  }
}
