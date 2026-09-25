// ConveyorScene: Chapter 3 "Home Ground" mode, PACK & GO (Conveyor Sort).
//
// The mode of play for Chapter 3: instead of falling asteroids you tap to
// destroy, math-labelled crates ride a calm belt and you route each one to the
// dock whose label matches its answer. No falling threat, no ship to defend,
// just a stamp on every correct crate and a growing tally. Each chapter's copy
// table names its own stamp word (PACKED is Chapter 3's). The whole pedagogy
// engine is reused untouched (getProblemForWorld / getDistractors /
// recordFactAttempt); only the presentation + interaction layer is new.
//
// CORE LOOP (Phase 1):
//   • Exactly ONE crate is readable/answerable at a time — non-negotiable for a
//     clean timing signal. The fact is hidden while the crate slides in, and
//     `startedAtMs` is set only when it parks in the active zone and the input
//     opens (mirrors GameScene's "readable → committed" measure). This kills
//     the "pre-read the next crate" exploit.
//   • Correct answer → the crate is stamped and packed off, the tally ticks,
//     recordFactAttempt(a, b, true, elapsedMs) where elapsed measures the
//     readable→first-correct window. Wrong
//     answer → gentle "return to sender" wobble, recordFactAttempt(a, b, false)
//     with NO timing (only correct answers carry recall-speed signal — identical
//     to GameScene's protocol), and the crate stays so the kid can retry.
//   • A crate that rides off the end requeues that exact fact (no record — a
//     non-answer isn't a wrong answer) so the kid sees it again next.
//   • Round-end shares GameScene's result rules, then records campaign progress
//     and rewards through completeLevel / addStardust.
//
// PHASE 2 (the pedagogy win): two interchangeable input modes behind the
// `conveyorInputMode` localStorage flag — the engine can't tell them apart
// (both call commit() → recordFactAttempt identically), so the A/B is purely a
// UX/volume question resolved later from real timing data (Phase 6):
//   • `production` (DEFAULT): free recall — the crate shows the fact and a big
//     number keypad lets the kid punch the answer they RETRIEVED (no options to
//     pick from). This is the form that builds durable fast recall.
//   • `recognition`: 4 labeled docks ([answer, ...getDistractors]), relabelled
//     AND repositioned (truly shuffled into a random slot) every crate; one tap.
//   Belt window = max(getAdaptiveProblemSeconds, getComfortableProblemSeconds) —
//   pace-floored so a slow kid never races and a fast kid can't drop below the
//   adaptive FLOOR (a sub-2.5s belt would manufacture taps the engine wrongly
//   stamps "automatic"). The streak/combo is gated on CORRECT answers, never on
//   belt velocity; the belt itself never accelerates. Per-fact recall times +
//   the dock-position-repeat rate are instrumented (records.recordConveyor*) and
//   surfaced in ParentDashboardScene.
//
// PHASE 3 (boss = "Rush Order"): the level-4 boss runs the SAME core loop with
// levelMode==='boss' (the engine then serves 100% weak facts). Instead of a
// fixed-time round scored on accuracy, it's a QUOTA race: pack a big rush
// (getBossHpForWorld crates) before the clock (getBossDurationForWorld) runs out.
// A WIN is the mastery demonstration (isRoundMastered({isBoss:true,bossWin})),
// and clearing the boss masters the world → unlocks the next. Tonally it's a
// "get everything packed before the place closes" rush, NO monster, no enemy
// (Home Ground has no combat), so the GameScene boss INTRO/DEFEAT cinematics
// (monster silhouette + shatter, coupled to a boss asteroid + ship HP that don't
// exist here) are deliberately NOT reused; a calm rush-order intro + an
// all-packed beat stand in. Boss stars use a Conveyor metric (accuracy + time to
// spare) since there is no ship HP for GameScene.calculateBossStars to read.
//
// Chapter 3 is "Home Ground": one family Saturday around the city, eight real
// places drawn in plain shapes with no real names anywhere in copy or code.
// Wave 1 reskins the copy, palettes and backdrops; wave 2 lands each place's own
// line and item (the belt, the pet's station and the crate below are the shared
// stand-ins until then).
// See /Users/j/.claude/plans/cosmic-crunch-i-want-purring-dawn.md.

import Phaser from 'phaser';
import {
  MODES,
  WORLDS,
  findWorld,
  getProblemForWorld,
  getInverseProblem,
  getDistractors,
  getAdaptiveProblemSeconds,
  getComfortableProblemSeconds,
  getBossHpForWorld,
  getBossDurationForWorld,
  getConveyorSecretForHost,
  getWorldMusicRate,
  isChapter3FinaleWorld,
  progress
} from '../GameData.js';
import { music } from '../MusicManager.js';
import { audio } from '../AudioManager.js';
import { getWorldBackground } from '../WorldBackgrounds.js';
import { darken, lighten, hexStr } from '../colorUtils.js';
import { TransitionManager } from '../TransitionManager.js';
import { createButton, createIconButton } from '../buttonHelper.js';
import { style, TYPE } from '../textStyles.js';
import { COLORS } from '../colorPalette.js';
import { companion, drawCompanion } from '../CompanionManager.js';
import { cosmetics } from '../CosmeticManager.js';
import { economy, claimDailyBonusIfDue } from '../EconomyManager.js';
import { records } from '../RecordsManager.js';
import { calculateRoundResult, getRoundAccuracy } from '../RoundResults.js';
import { drawStarIcon, drawSparkleIcon } from '../StatIcons.js';
import { drawMasteryWall } from '../MasteryWall.js';

const W = 1080;
const H = 1920;

// Belt + crate geometry (portrait 1080×1920).
const BELT_Y = 820;          // vertical center of the conveyor band
const BELT_H = 250;          // belt band height
const ACTIVE_X = W / 2;      // where a crate parks while readable
const CRATE_SIZE = 250;      // crate body width/height
const ARRIVAL_MS = 440;      // slide-in (fact HIDDEN — not part of the timed window)
const SHIP_MS = 460;         // arc-to-dock on a correct route
const RESOLVE_GAP_MS = 260;  // calm beat between crates

// Dock row (the labeled answer bins).
const DOCK_COUNT = 4;
const DOCK_Y = 1500;
const DOCK_MARGIN = 46;
const DOCK_GAP = 22;
const DOCK_W = Math.round((W - 2 * DOCK_MARGIN - (DOCK_COUNT - 1) * DOCK_GAP) / DOCK_COUNT);
const DOCK_H = 240;

// Production keypad (the free-recall stamp pad). 3-column grid: 1-9, then ⌫ 0 ✓.
const KEYPAD_BTN_W = 210;
const KEYPAD_BTN_H = 124;
const KEYPAD_GAP_X = 24;
const KEYPAD_GAP_Y = 22;
const KEYPAD_TOP = 1248;          // y of the first (top) keypad row's center
const KEYPAD_COL0 = W / 2 - (KEYPAD_BTN_W + KEYPAD_GAP_X); // center x of left column
const ENTRY_Y = 1090;             // recalled-answer readout, between belt and pad
const ENTRY_PLATE_H = 120;        // readout plate height (kept clear of the top keypad row)
const MAX_ANSWER_DIGITS = 3;      // products top out at 12×12 = 144
// Keypad entry hold: once the first digit of an answer is punched, the crate's
// ride-off clock pauses so the belt never tips a crate into the chute under a
// half-typed number. The hold is capped at this much of actual hold time per
// crate (see holdBelt), after which the clock runs again even mid-entry, so a
// stalled entry still resolves.
const ENTRY_HOLD_MS = 4000;

// Status bars (the round's time bar, and under it the rush quota bar). The
// stack is anchored at BAR_TOP_Y and each chapter's skin says how it looks, so
// the two bars can never drift apart and a chapter restyles them by swapping
// tokens rather than by adding a branch to buildStatusBars.
const BAR_W = 760;
const BAR_TOP_Y = 379;            // top edge of the first bar

// Chapters 1 and 2 (and the Night Shift) play against dark backdrops, where a
// near-black track and a bare capsule read fine.
const BARS_DARK = {
  height: 26,
  gap: 40,                        // center-to-center between the two bars
  track: COLORS.bgTrack,
  trackAlpha: 1,
  plate: null,
  outline: null
};

// Home Ground plays in daylight, and the dark treatment failed there twice
// over: every Chapter 3 accent is a pastel, so the fill washed out against a
// pale sky, and the near-black track read as a slab dropped on the art. The
// bars are pinned to a paper label instead, the same cutout idiom as the
// chapter's own scenery and its tourist map. The ink outline is what keeps a
// pale fill legible whatever colour the place happens to use, and the track is
// a warm mid-brown so the boundary between spent and remaining stays obvious
// against every one of those pastels.
const BARS_PAPER = {
  height: 32,
  gap: 42,
  track: 0xa8977a,
  trackAlpha: 1,
  plate: { fill: 0xf6ecd6, radius: 18, padX: 18, padY: 20, shadow: { dx: 5, dy: 7, alpha: 0.18 } },
  outline: { color: 0x2c2418, width: 4 }
};

// HUD lettering that sits straight on the backdrop (mode title, world name,
// counter, stamp label, streak, chute sign). The dark chapters keep their bare
// pale type, which reads fine on a night backdrop. Home Ground's skies run from
// pale blue through orange to dusk purple, so no one fill reads on all of them:
// its HUD type takes the bars' ink as a heavy outline instead, which holds on
// every one of those skies. `ink` null means no outline beyond the preset's.
const HUD_DARK = { label: '#cfcfe0', ink: null };
const HUD_DAYLIGHT = { label: '#ffffff', ink: '#2c2418' };

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Single per-chapter Conveyor presentation. The mode runs in every chapter now
// (Ch3 for all levels; the Ch1/Ch2 "mixed" level as an owner-gated pilot), so the
// look + sort-fiction are parameterized rather than hardcoded to Home Ground:
//   skin:       palette lift, back-wall glow, halo, floor/belt darkening. Ch3 lifts
//               toward daylight (a Saturday around town) and adds the bright accent
//               halo (the place's own light); Ch1/Ch2 keep their own dark void /
//               bloodstream gradient + a faint cool/red glow (a cold salvage line /
//               cell sorter).
//   copy:       the verb set; the mechanic is identical, only the fantasy changes.
//               Boss rounds read from the same table so no boss string is hardcoded
//               in the scene: bossHeadline (HUD label + summary mode line),
//               bossIncoming (intro card headline), bossMiss (summary title on a
//               loss), bossStat (summary stat label), bossDone (the win banner) and
//               quotaLine(n, world) (the deadline sentence on the intro card). A boss
//               WIN's summary title is summaryWin. The Night Shift table below
//               follows the same shape.
//   levelTrack: the chapter's level theme. resolveTrack falls back to the Ch1 themes
//               until the bespoke MP3s exist, so the chapter is never silent.
// Crate/belt/dock colors already derive from the world palette, so once the daytime
// lift is gated they reskin per chapter for free. Exported so the level-select
// mission card can label the pilot belt with the same verb the scene will use.
export const CONVEYOR_CHAPTER = {
  1: {
    levelTrack: 'levelTheme',
    skin: { liftTop: 0.0,  liftBottom: 0.0,  pool: { tint: 0x6f7ec4, alpha: 0.06 }, halo: false, floorDarken: 0.55, beltBody: 0.62, beltSlat: 0.40, bars: BARS_DARK, hud: HUD_DARK }, // cold metal salvage
    copy: {
      title: 'SORT & SHIP', stamp: 'SALVAGED', chute: 'recheck', summaryWin: 'Cargo Sorted!',
      // Boss strings exactly as the pilot belt has always shown them. A Ch1/Ch2 boss
      // never actually runs on the belt (usesConveyorScene excludes it), so these
      // only matter as the shape every chapter table shares.
      bossHeadline: 'RUSH ORDER', bossIncoming: 'BIG ORDER INCOMING', bossMiss: 'Order Unfinished',
      bossStat: 'ORDER', bossDone: 'BIG ORDER\nSHIPPED!',
      quotaLine: n => `Pack ${n} crates before the truck leaves!`
    }
  },
  2: {
    levelTrack: 'innerSpaceLevel',
    skin: { liftTop: 0.0,  liftBottom: 0.04, pool: { tint: 0xff7a8a, alpha: 0.10 }, halo: false, floorDarken: 0.42, beltBody: 0.55, beltSlat: 0.34, bars: BARS_DARK, hud: HUD_DARK }, // warm-red membrane
    copy: {
      title: 'SORT & SEND', stamp: 'ABSORBED', chute: 'reflux',  summaryWin: 'Nutrients Sent!',
      bossHeadline: 'RUSH ORDER', bossIncoming: 'BIG ORDER INCOMING', bossMiss: 'Order Unfinished',
      bossStat: 'ORDER', bossDone: 'BIG ORDER\nSHIPPED!',
      quotaLine: n => `Pack ${n} crates before the truck leaves!`
    }
  },
  3: {
    levelTrack: 'homeGroundLevel',
    skin: { liftTop: 0.10, liftBottom: 0.28, pool: { tint: null,     alpha: 0.16 }, halo: true,  floorDarken: 0.45, beltBody: 0.62, beltSlat: 0.40, bars: BARS_PAPER, hud: HUD_DAYLIGHT }, // daylight around town
    copy: {
      title: 'PACK & GO', stamp: 'PACKED', chute: 'recheck', summaryWin: 'All Packed!',
      bossHeadline: 'RUSH ORDER', bossIncoming: 'BIG RUSH INCOMING', bossMiss: 'Rush Unfinished',
      bossStat: 'RUSH', bossDone: 'BIG RUSH\nPACKED!',
      // Each place names its own deadline: world.rushLine is a lowercase tail with
      // no period ("before the cart rolls", "before dark"). Read it off the world
      // passed in, never a captured one, so the sentence always matches the belt
      // that is actually running.
      quotaLine: (n, world) => `Pack all ${n} ${world?.rushLine || 'before the truck leaves'}.`
    }
  }
};

// The Night Shift (hidden W20): the grocery store (W31) after closing. The same
// store the kid packed bags in that morning, now on a restocking night. It is
// NOT a fourth chapter skin: it overrides whichever chapter skin would otherwise
// apply, because the room's whole point is that it is a place she already knows
// with the lights off.
//
// `bgTop`/`bgBottom` are absolute rather than a lift, because the chapter lifts
// are all POSITIVE (lighten toward daylight) and lighten() has no negative clamp:
// feeding it a negative amount would roll the channel below zero and corrupt
// the color. An explicit night sky is both safer and easier to read.
//
// bgWorldId borrows the grocery store's (W31) back wall: the chapter's first
// stop, and the one whose fridge cases and lit exit sign still make sense with
// everything else dark. The scrim in drawBackdrop was tuned against the old
// wall and needs a retune pass once the new W31 art is in.
const NIGHT_SHIFT = {
  bgWorldId: 31,
  skin: {
    bgTop: 0x070b14, bgBottom: 0x16223a,
    liftTop: 0, liftBottom: 0,
    pool: { tint: 0x8fd0ff, alpha: 0.05 },
    halo: true,             // one cool night light left on over the belt
    floorDarken: 0.72, beltBody: 0.72, beltSlat: 0.52,
    // The lights are off: the paper label would glow. Back to the dark bars,
    // and the dark HUD type with them.
    bars: BARS_DARK,
    hud: HUD_DARK
  },
  copy: {
    title: 'NIGHT SHIFT',
    stamp: 'PLACED',
    chute: 'restack',
    summaryWin: 'Floor Cleared!',
    // Names the STATE, not the world — the world's own name is printed directly
    // beneath it on both the HUD and the intro card, and "RUSH ORDER" sets the
    // pattern: what kind of shift this is, then where you are.
    bossHeadline: 'AFTER HOURS',
    quotaLine: n => `Place all ${n} before morning.`
  }
};

// The Night Shift table above is frozen and predates the newer boss keys, so the
// scene fills bossMiss / bossStat / bossDone with the strings the room has always
// shown and lets its own words win everywhere it has them (see create()).
// bossIncoming is left out on purpose: AFTER HOURS does double duty on the HUD
// and at the head of the intro card, as it always has.
const NIGHT_SHIFT_FILL = { bossMiss: 'Order Unfinished', bossStat: 'ORDER', bossDone: 'BIG ORDER\nSHIPPED!' };

export class ConveyorScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ConveyorScene' });
  }

  create() {
    this.worldId = this.registry.get('currentWorldId') || 31;
    this.currentLevel = this.registry.get('currentLevel') || 1;
    this.levelMode = this.registry.get('levelMode') || 'mult';
    this.world = findWorld(this.worldId) || WORLDS[0];
    this.accent = this.world.accentColor;
    this.isBoss = this.levelMode === 'boss';

    // Chapter-native skin + sort fiction: the mode now runs in Ch1/Ch2 too (the
    // owner-gated "mixed" pilot), so the belt reskins to its chapter (see
    // CONVEYOR_CHAPTER) instead of always reading as Home Ground.
    const chapter = this.world.chapter || 1;
    const chapterCfg = CONVEYOR_CHAPTER[chapter] || CONVEYOR_CHAPTER[3];
    this.skin = chapterCfg.skin;
    this.copy = chapterCfg.copy;

    // The Night Shift overrides the chapter skin entirely (see NIGHT_SHIFT), and
    // serves INVERSE facts instead of forward ones. Keyed off the world's `belt`
    // flag rather than a bare id so the routing, the look and the math all read
    // from the same switch.
    this.isNightShift = !!this.world.belt;
    if (this.isNightShift) {
      this.skin = NIGHT_SHIFT.skin;
      this.copy = { ...NIGHT_SHIFT_FILL, ...NIGHT_SHIFT.copy };
    }
    // The production-vs-recognition A/B is a Chapter-3-only instrument; the Ch1/Ch2
    // pilot must not pollute that cohort, so every A/B record gates on this one flag.
    // The Night Shift is excluded even though it IS Chapter 3: it asks a different
    // question (find the missing factor, not recall the product), so folding its
    // timings into the production-vs-recognition cohort would compare two
    // different tasks and quietly poison the result.
    this.instrumentAB = chapter === 3 && !this.isNightShift;

    // Input mode A/B (see header). Production = free-recall keypad (default);
    // recognition = labeled docks. Anything other than the explicit
    // 'recognition' opt-in defaults to production. Applies to boss too — the
    // boss only changes which FACTS are served (100% weak), not the input.
    this.inputMode = localStorage.getItem('conveyorInputMode') === 'recognition'
      ? 'recognition'
      : 'production';

    // Phaser reuses the scene instance across scene.start, so reset every field
    // update()/finishRound() guard on at the TOP of create() — otherwise a stale
    // (now-destroyed) timeBarFill/quotaBar from a prior round could slip past the
    // guard and update() would .clear() a dead graphics object.
    this.ended = false;
    this.timeBarFill = null;
    this.quotaBarFill = null;
    this.roundEndsAt = null;
    this.roundTimer = null;
    this.docks = [];
    this.keypad = null;
    this.entry = '';
    this.lastCorrectDockIndex = null;
    this.bossQuota = 0;
    this.bossWon = false;
    this.shakeTweenX = null;
    this.shakeTweenAngle = null;
    this.foodCrate = null;
    this.secretTargetId = null;
    this.cratesUntilSecret = null;

    audio.init?.();

    // Music: each chapter keeps its OWN level theme (see CONVEYOR_CHAPTER.levelTrack)
    // so the briefing→belt handoff is seamless and re-pitches per world; the boss
    // keeps the Home Ground boss theme (boss is Ch3-only in scope). resolveTrack
    // falls back to the Chapter-1 themes until the bespoke MP3s exist, so it's
    // never silent.
    const trackKey = this.isBoss
      ? music.resolveTrack(this, 'homeGroundBoss', 'bossTheme')
      : music.resolveTrack(this, chapterCfg.levelTrack, 'levelTheme');
    music.fadeToTrack(this, trackKey);
    music.setPlaybackRate(getWorldMusicRate(this.worldId), 600);

    this.drawBackdrop();

    // ── Round state (mirrors GameScene's campaign run) ──────────────────────
    this.score = 0;        // crates correctly packed off
    this.attempts = 0;     // every committed answer (correct + wrong) → accuracy
    this.shipped = 0;      // the stamp tally (== score; drives the HUD hero counter)
    this.streak = 0;
    this.bestStreak = 0;
    this.stardustEarned = 0;
    this.acceptingInput = false;
    this.requeuedFact = null;   // {a,b} of a crate that rode off the end
    this.activeProblem = null;
    this.crate = null;

    if (this.isBoss) {
      // The boss is a QUOTA race, not an accuracy-scored fixed round. 100% weak
      // facts come for free from getProblemForWorld(..., 'boss').
      this.bossMaxQuota = getBossHpForWorld(this.worldId);
      this.scoreThreshold = this.bossMaxQuota;   // parity w/ GameScene boss
      this.duration = getBossDurationForWorld(this.worldId);
    } else {
      this.scoreThreshold = MODES[this.levelMode].scoreThreshold;
      this.duration = MODES[this.levelMode].duration;
    }

    // Adaptive belt window: how long a parked crate waits before it rides off
    // into the recheck chute. Take the SLOWER (max) of the pushy adaptive window
    // and the comfortable floor so a slow kid never races; on cold start (no pace
    // data) both fall back to the world's calm designed seconds. The adaptive
    // FLOOR (2s) also keeps even a fast kid above the sub-2.5s zone where a belt
    // would manufacture taps the engine wrongly certifies "automatic". Boss mode
    // gets its +1s accuracy cushion baked into both helpers.
    const paceMs = records.getPaceMs();
    this.problemSeconds = Math.max(
      getAdaptiveProblemSeconds(this.worldId, this.levelMode, paceMs),
      getComfortableProblemSeconds(this.worldId, this.levelMode, paceMs)
    );

    // Hidden-world FOOD CRATE — the conveyor-native answer to GameScene's warp
    // asteroid. Chapter 3 has no falling rocks to warp off, so on a host world
    // (see GameData.discoveredFromCrate) one crate a few in comes down the belt
    // carrying dinner instead of a math fact. Tap it and it opens the secret
    // room. Suppressed on the boss (a rush order should never be interrupted)
    // and on already-discovered hosts. Armed by CRATE COUNT rather than a clock
    // so it always lands inside a round the kid actually plays through.
    if (!this.isBoss && !this.world?.hidden) {
      const secret = getConveyorSecretForHost(this.worldId);
      if (secret && !progress.isHiddenWorldDiscovered(secret.id)) {
        this.secretTargetId = secret.id;
        this.cratesUntilSecret = 3 + Math.floor(Math.random() * 3);
      }
    }

    this.buildHud();
    this.buildBelt();
    if (this.inputMode === 'production') this.buildKeypad();
    this.buildPet();

    this.events.once('shutdown', () => this.teardown());

    new TransitionManager(this).fadeIn(280);

    // The boss opens with a calm "rush incoming" card; the round clock only
    // starts once it's dismissed so the intro doesn't eat the timer. Practice
    // levels just roll the first crate in.
    if (this.isBoss) {
      this.playRushOrderIntro(() => this.startRound());
    } else {
      this.time.delayedCall(360, () => this.startRound());
    }
  }

  // Starts the round clock and rolls the first crate. Split out so the boss can
  // defer it until after the Rush Order intro (the timer must not tick early).
  startRound() {
    if (this.ended || !this.scene.isActive()) return;
    this.roundEndsAt = this.time.now + this.duration * 1000;
    this.roundTimer = this.time.delayedCall(this.duration * 1000, () => this.finishRound());
    this.spawnCrate();
  }

  update() {
    if (this.ended || !this.timeBarFill || !this.roundEndsAt) return;
    const remaining = Math.max(0, this.roundEndsAt - this.time.now);
    const ratio = this.duration > 0 ? remaining / (this.duration * 1000) : 0;
    this.drawTimeBar(ratio);
  }

  // ── Static chrome ─────────────────────────────────────────────────────────

  drawBackdrop() {
    // The per-world palette + back-wall scene come from the shared WorldBackgrounds
    // table (the same source GameScene uses), so each world reads as its own place.
    // The mode runs in all three chapters now, so the look is chapter-skinned (see
    // CONVEYOR_CHAPTER): Ch3 lifts the palette toward daylight (a Saturday around
    // town); Ch1/Ch2 keep their own dark void / bloodstream gradient (a cold
    // salvage line / a warm cell sorter).
    // The Night Shift has no back wall of its own. It borrows the grocery store's
    // (W31), which is the point: same store, after closing.
    const wb = getWorldBackground(this.isNightShift ? NIGHT_SHIFT.bgWorldId : this.worldId);
    const top = this.skin.bgTop ?? lighten(wb.bgTop, this.skin.liftTop);
    const bottom = this.skin.bgBottom ?? lighten(wb.bgBottom, this.skin.liftBottom);
    const g = this.add.graphics().setDepth(-2);
    g.fillGradientStyle(top, top, bottom, bottom, 1);
    g.fillRect(0, 0, W, H);

    // A soft pool of light on the back wall so the scene reads lit, not dim (no
    // rays, content rule). Ch3 is daylight; Ch1/Ch2 get a fainter cool/red-tinted
    // glow. The brighter accent halo (the place's own light: a store window, open
    // sky over the sand) is Ch3 only.
    const day = this.add.graphics().setDepth(-2);
    day.fillStyle(this.skin.pool.tint ?? lighten(this.world.color, 0.45), this.skin.pool.alpha);
    day.fillEllipse(W / 2, BELT_Y - 150, W * 1.1, 560);
    if (this.skin.halo) {
      day.fillStyle(lighten(this.accent, 0.2), 0.10);
      day.fillEllipse(W / 2, BELT_Y - 220, W * 0.7, 360);
    }

    // The world's back-wall scene, anchored just behind the belt (its shallow
    // floor tucks under the belt band; its props rise on the wall above).
    const hz = wb.drawHorizon(this, { width: W, y: BELT_Y - 110, world: this.world });
    hz?.setDepth(-1);

    // The back wall is borrowed art and draws its own DAYTIME palette, which the
    // skin's gradient never touches, so without this the Night Shift reads as the
    // store at nine in the morning standing on a blue floor. A cold scrim sits
    // above the wall (-1) and below the floor/belt (1), knocking the daylit aisles
    // back to night while leaving the fridge cases and the lit exit sign as the
    // brightest things left on. The 0.62 alpha was tuned against the old wall and
    // needs a retune pass once the new W31 art lands (keep the cases and the sign
    // readable, everything else dark).
    if (this.isNightShift) {
      const dusk = this.add.graphics().setDepth(-0.5);
      dusk.fillStyle(0x070b14, 0.62);
      dusk.fillRect(0, 0, W, BELT_Y + BELT_H);
    }

    // Plank floor under the belt to ground the scene (darkness per chapter). Wave 2
    // reskins it per place along with the line.
    const floor = this.add.graphics().setDepth(1);
    floor.fillStyle(darken(this.world.color, this.skin.floorDarken), 1);
    floor.fillRect(0, BELT_Y + BELT_H - 40, W, H - (BELT_Y + BELT_H) + 40);
    floor.fillStyle(0x000000, 0.16);
    for (let x = 60; x < W; x += 150) floor.fillRect(x, BELT_Y + BELT_H - 40, 4, H);
    floor.fillStyle(lighten(this.world.color, 0.05), 0.25);
    floor.fillRect(0, BELT_Y + BELT_H - 40, W, 6);
  }

  buildHud() {
    // Back — abandons the round (no progress written) and returns to the world's
    // level grid.
    createIconButton(this, {
      x: 90, y: 110, radius: 44,
      accentColor: this.accent,
      drawIcon: (gr, size) => {
        gr.lineStyle(8, 0xffffff, 1);
        gr.beginPath();
        gr.moveTo(size * 0.35, -size * 0.5);
        gr.lineTo(-size * 0.35, 0);
        gr.lineTo(size * 0.35, size * 0.5);
        gr.strokePath();
      },
      onClick: () => this.abandonRound(this.world?.hidden ? 'WorldMapScene' : 'LevelSelectScene')
    }).setDepth(20);

    // The stack runs mode title, world name, counter, stamp label, and has to end
    // clear of the bar plate (its top edge is BAR_TOP_Y minus the plate padding).
    // The stamp label is the one line that says what the counter counts (in a
    // rush it carries the quota), so it gets full label size and the counter sits
    // a little higher to make room for it.
    this.add.text(W / 2, 58, this.isBoss ? this.copy.bossHeadline : this.copy.title, style('caption', {
      fill: this.isBoss ? '#ffb142' : this.skin.hud.label, fontStyle: '900',
      ...this.hudInk(6)
    })).setOrigin(0.5).setDepth(20);

    this.add.text(W / 2, 118, this.world.name, style('display', {
      fontSize: '52px',
      fill: hexStr(this.accent),
      ...this.hudInk(8)
    })).setOrigin(0.5).setDepth(20);

    // Hero counter: crates packed (== quota progress in a rush). The label under it
    // is the chapter's own stamp word, so a rush reads "OF 44 PACKED".
    this.shippedText = this.add.text(W / 2, 230, '0', style('display', {
      fontSize: '92px', fill: '#ffffff',
      ...this.hudInk(10)
    })).setOrigin(0.5).setDepth(20);
    this.add.text(W / 2, 314, this.isBoss ? `OF ${this.bossMaxQuota} ${this.copy.stamp}` : this.copy.stamp, style('caption', {
      fill: this.skin.hud.label, fontStyle: '900',
      ...this.hudInk(6)
    })).setOrigin(0.5).setDepth(20);

    // Streak chip (top-right), level with the counter.
    this.streakText = this.add.text(W - 70, 230, '', style('subhead', {
      fontSize: '42px', fill: '#ff8b3d', fontStyle: '900',
      ...this.hudInk(6)
    })).setOrigin(1, 0.5).setDepth(20);

    // Status bars: the time bar, and under it the rush quota bar. Both are
    // built and drawn through one skin-driven path (see BARS_DARK / BARS_PAPER),
    // so a chapter changes their look by changing its tokens, not by growing a
    // second copy of this code.
    this.buildStatusBars();
  }

  // The skin's ink outline for type that sits straight on the backdrop, as
  // style() overrides. Empty on the dark skins, so their HUD keeps the look it
  // has always had (see HUD_DARK / HUD_DAYLIGHT).
  hudInk(thickness) {
    const ink = this.skin.hud?.ink;
    return ink ? { stroke: ink, strokeThickness: thickness } : {};
  }

  // Narrow a wrapped sentence to the smallest wrap width that still gives the
  // same number of lines, so centred copy splits into even lines instead of
  // leaving one word stranded on the last. Line count and height are unchanged,
  // so anything laid out from the text's measured height stays where it was.
  balanceWrap(text, maxWidth) {
    const lines = text.getWrappedText().length;
    if (lines < 2) return;
    let lo = 0;
    let hi = maxWidth;
    while (hi - lo > 8) {
      const mid = Math.round((lo + hi) / 2);
      text.setWordWrapWidth(mid);
      if (text.getWrappedText().length > lines) lo = mid;
      else hi = mid;
    }
    text.setWordWrapWidth(hi);
  }

  // Lay out the bar stack and paint everything static about it: the plate the
  // bars sit on (if the skin uses one), each bar's empty track, and each bar's
  // outline. Only the fills redraw during play.
  buildStatusBars() {
    const bars = this.skin.bars || BARS_DARK;
    const h = bars.height;
    const r = h / 2;
    const x0 = W / 2 - BAR_W / 2;

    this.barStyle = bars;
    this.timeBarH = h;
    this.timeBarY = BAR_TOP_Y + h / 2;
    if (this.isBoss) this.quotaBarY = this.timeBarY + bars.gap;

    const ys = this.isBoss ? [this.timeBarY, this.quotaBarY] : [this.timeBarY];

    // The plate. Home Ground pins its bars to a paper label so they stop
    // competing with a bright sky; the dark chapters skip it.
    if (bars.plate) {
      const p = bars.plate;
      const top = ys[0] - h / 2 - p.padY;
      const ph = ys[ys.length - 1] + h / 2 + p.padY - top;
      const g = this.add.graphics().setDepth(18);
      if (p.shadow) {
        g.fillStyle(0x000000, p.shadow.alpha);
        g.fillRoundedRect(x0 - p.padX + p.shadow.dx, top + p.shadow.dy, BAR_W + p.padX * 2, ph, p.radius);
      }
      g.fillStyle(p.fill, 1);
      g.fillRoundedRect(x0 - p.padX, top, BAR_W + p.padX * 2, ph, p.radius);
    }

    const track = this.add.graphics().setDepth(19);
    track.fillStyle(bars.track, bars.trackAlpha);
    for (const y of ys) track.fillRoundedRect(x0, y - h / 2, BAR_W, h, r);

    this.timeBarFill = this.add.graphics().setDepth(20);
    if (this.isBoss) this.quotaBarFill = this.add.graphics().setDepth(20);

    // The outline rides ABOVE the fills so a pale fill on a pale ground still
    // reads as a bar with an edge, whatever colour it is that second.
    if (bars.outline) {
      const o = this.add.graphics().setDepth(21);
      o.lineStyle(bars.outline.width, bars.outline.color, 1);
      for (const y of ys) o.strokeRoundedRect(x0, y - h / 2, BAR_W, h, r);
    }

    this.drawTimeBar(1);
    if (this.isBoss) this.drawQuotaBar();
  }

  // Paint one bar's fill to `ratio` of its width. Shared by both bars: the only
  // difference between them is the colour and how the ratio is worked out.
  drawBarFill(g, y, ratio, color) {
    if (!g) return;
    const h = this.timeBarH;
    const fw = Math.max(0, Math.round(BAR_W * Math.max(0, Math.min(1, ratio))));
    g.clear();
    if (fw <= 2) return;
    g.fillStyle(color, 1);
    g.fillRoundedRect(W / 2 - BAR_W / 2, y - h / 2, fw, h, h / 2);
  }

  drawQuotaBar() {
    if (!this.quotaBarFill) return;
    const r = this.bossMaxQuota > 0 ? this.bossQuota / this.bossMaxQuota : 0;
    this.drawBarFill(this.quotaBarFill, this.quotaBarY, r, COLORS.success);
  }

  drawTimeBar(ratio) {
    const r = Math.max(0, Math.min(1, ratio));
    const color = r > 0.35 ? this.accent : (r > 0.15 ? COLORS.warning : COLORS.error);
    this.drawBarFill(this.timeBarFill, this.timeBarY, r, color);
  }

  buildBelt() {
    const g = this.add.graphics().setDepth(2);
    const left = 40;
    const right = W - 40;
    const top = BELT_Y - BELT_H / 2;

    // Belt tones derived from the world palette + chapter skin (each place's own
    // colour for Ch3; cold metal / warm membrane for Ch1/Ch2). This shared plank
    // belt is the wave 1 stand-in; wave 2 replaces it with each place's own line.
    const beltBody = darken(this.world.color, this.skin.beltBody);
    const beltSlat = darken(this.world.color, this.skin.beltSlat);
    const roller = this.accent;
    const rollerCore = lighten(this.world.color, 0.1);

    // Side frame rails (the bench the belt rides on).
    g.fillStyle(darken(this.world.color, 0.7), 1);
    g.fillRoundedRect(left - 8, top - 10, right - left + 16, BELT_H + 20, 30);

    // Belt body.
    g.fillStyle(beltBody, 1);
    g.fillRoundedRect(left, top, right - left, BELT_H, 26);
    g.fillStyle(0x000000, 0.30);
    g.fillRoundedRect(left, top + BELT_H * 0.62, right - left, BELT_H * 0.38, { tl: 0, tr: 0, bl: 26, br: 26 });

    // Belt slats (the "moving treads" read) — warm raised bars.
    for (let x = left + 50; x < right; x += 70) {
      g.fillStyle(beltSlat, 0.9);
      g.fillRoundedRect(x - 5, top + 14, 10, BELT_H - 28, 5);
      g.fillStyle(lighten(this.world.color, 0.08), 0.25);
      g.fillRect(x - 5, top + 14, 3, BELT_H - 28);
    }

    // Rollers at each end, in the accent colour.
    g.fillStyle(darken(this.accent, 0.35), 1);
    g.fillCircle(left + 4, BELT_Y, BELT_H / 2 - 6);
    g.fillCircle(right - 4, BELT_Y, BELT_H / 2 - 6);
    g.fillStyle(roller, 1);
    g.fillCircle(left + 4, BELT_Y, BELT_H / 2 - 16);
    g.fillCircle(right - 4, BELT_Y, BELT_H / 2 - 16);
    g.fillStyle(rollerCore, 1);
    g.fillCircle(left + 4, BELT_Y, BELT_H / 2 - 30);
    g.fillCircle(right - 4, BELT_Y, BELT_H / 2 - 30);

    // Active-zone bracket — a soft highlight where the readable crate parks.
    const az = this.add.graphics().setDepth(3);
    az.lineStyle(5, this.accent, 0.85);
    const azW = CRATE_SIZE + 60;
    const azH = CRATE_SIZE + 60;
    const azX = ACTIVE_X - azW / 2;
    const azY = BELT_Y - azH / 2;
    const corner = 30;
    // Four corner brackets (not a full box) so it reads as a "target zone".
    const seg = 46;
    const drawCorner = (cx, cy, dx, dy) => {
      az.beginPath();
      az.moveTo(cx + dx * seg, cy);
      az.lineTo(cx, cy);
      az.lineTo(cx, cy + dy * seg);
      az.strokePath();
    };
    drawCorner(azX + corner, azY + corner, 1, 1);
    drawCorner(azX + azW - corner, azY + corner, -1, 1);
    drawCorner(azX + corner, azY + azH - corner, 1, -1);
    drawCorner(azX + azW - corner, azY + azH - corner, -1, -1);
    this.activeZoneGfx = az;

    // Recheck chute hint at the right end (where unanswered crates tip off). The
    // sign is a word the kid reads, so it sits at label size on the floor just
    // under the belt's right end, right-aligned to the belt, rather than on the
    // roller where there is no room for it. The dark skins have no HUD ink, but
    // their floors can be light (the gold marrow floor), so the sign always
    // carries a dark outline of its own.
    const chute = this.add.graphics().setDepth(2);
    chute.fillStyle(0x000000, 0.35);
    chute.fillRoundedRect(right - 70, BELT_Y - 30, 90, 120, 16);
    this.chuteText = this.add.text(right, BELT_Y + BELT_H / 2 + 44, this.copy.chute, style('caption', {
      fill: this.skin.hud.label, fontStyle: '800',
      ...(this.skin.hud?.ink ? this.hudInk(6) : { stroke: '#0a0a1a', strokeThickness: 6 })
    })).setOrigin(1, 0.5).setDepth(2);
  }

  buildPet() {
    if (!companion.hasStarter?.()) return;
    const px = W - 200;
    const py = BELT_Y - BELT_H / 2 - 120;

    // The pet's loading station, reskinned per place in wave 2 (bagging at the
    // checkout, the tray window, the gondola platform). Today it is a wooden mast +
    // jib reaching over the belt with a pulley and hook. Cosmetic; sits behind the
    // pet so the companion reads as the one working it.
    const crane = this.add.graphics().setDepth(3);
    const wood = darken(this.world.color, 0.5);
    const woodLite = lighten(this.world.color, 0.06);
    const mastX = px + 40;
    const mastTop = py - 70;
    const mastBot = BELT_Y - BELT_H / 2 - 6;
    crane.fillStyle(wood, 1);
    crane.fillRoundedRect(mastX - 12, mastTop, 24, mastBot - mastTop, 8);            // mast
    crane.fillRoundedRect(mastX - 150, mastTop, 162, 20, 8);                          // jib arm
    crane.fillStyle(woodLite, 0.5);
    crane.fillRect(mastX - 150, mastTop, 162, 5);
    crane.lineStyle(5, wood, 1);
    crane.lineBetween(mastX, mastTop + 20, mastX - 120, mastTop);                     // brace
    crane.fillStyle(this.accent, 1);
    crane.fillCircle(mastX - 140, mastTop + 28, 12);                                  // pulley
    crane.fillStyle(darken(this.accent, 0.4), 1);
    crane.fillCircle(mastX - 140, mastTop + 28, 5);
    crane.lineStyle(3, 0x2a1c0c, 1);
    crane.lineBetween(mastX - 140, mastTop + 40, mastX - 140, mastTop + 78);          // cable
    crane.fillStyle(0x2a1c0c, 1);                                                     // hook
    crane.beginPath();
    crane.arc(mastX - 140, mastTop + 86, 9, Math.PI * 0.1, Math.PI * 1.1);
    crane.strokePath();
    this.crane = crane;

    // The pet works the line: a warm anchor beside the belt. Cosmetic only.
    this.pet = drawCompanion(this, px, py, { scale: 1.0 });
    this.pet.setDepth(4);
    this.petTween = this.tweens.add({
      targets: this.pet,
      y: this.pet.y - 14,
      duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
  }

  // ── Core loop ─────────────────────────────────────────────────────────────

  spawnCrate() {
    if (this.ended) return;

    // The hidden-world food crate takes this slot when its countdown runs out.
    // It carries no fact, so nothing about the timing/pedagogy loop runs for it.
    // A null countdown means "already delivered" — note that `null <= 0` is true
    // in JS, so the null check has to come first or it would respawn forever.
    if (this.secretTargetId && this.cratesUntilSecret != null) {
      if (this.cratesUntilSecret <= 0) {
        this.spawnFoodCrate();
        return;
      }
      this.cratesUntilSecret--;
    }

    // Pull the next fact (a requeued miss takes priority so the kid re-sees it).
    // The Night Shift's crates arrive backwards (`? × 8 = 56`); everywhere else
    // they arrive forwards. Both paths honour a requeued miss, so a crate that
    // rode off the end comes back in the same form it left in.
    const problem = this.isNightShift
      ? getInverseProblem(this.worldId, this.requeuedFact)
      : getProblemForWorld(this.worldId, this.levelMode, this.requeuedFact);
    this.requeuedFact = null;
    this.activeProblem = problem;

    this.crate = this.buildCrate();
    this.crate.x = -CRATE_SIZE;
    this.crate.y = BELT_Y;

    // Slide in with the fact HIDDEN — no pre-read, so the timed window starts
    // clean only when it parks and the docks light up.
    this.arrivalTween = this.tweens.add({
      targets: this.crate,
      x: ACTIVE_X,
      duration: ARRIVAL_MS,
      ease: 'Sine.easeOut',
      onComplete: () => this.makeReadable()
    });
  }

  makeReadable() {
    if (this.ended || !this.crate) return;

    // Reveal the fact + open the input. THIS is when the kid can first read and
    // answer, so the timing signal starts here (identical for both input modes).
    this.crate.reveal(this.activeProblem.display);
    this.startedAtMs = performance.now();
    this.acceptingInput = true;

    if (this.inputMode === 'recognition') {
      // Inverse crates carry their own FACTOR distractors (near-miss factors, not
      // near-miss products) — without them the docks would offer one plausible
      // number beside three absurd ones and the choice would make itself.
      const distractors = this.activeProblem.distractors
        || getDistractors(this.activeProblem, DOCK_COUNT - 1);
      const labels = shuffle([this.activeProblem.answer, ...distractors]).slice(0, DOCK_COUNT);
      this.buildDocks(labels);

      // Instrument randomization quality: how often the correct answer's dock
      // lands in the same slot as the previous crate. The shuffle above puts the
      // answer in a truly random slot, so this should sit near chance
      // (1/DOCK_COUNT). The first crate of a round has no previous slot (null).
      const correctIdx = labels.indexOf(this.activeProblem.answer);
      const repeated = this.lastCorrectDockIndex === null
        ? null
        : correctIdx === this.lastCorrectDockIndex;
      // A/B instrument is the Chapter-3 production-vs-recognition question only —
      // don't let the Ch1/Ch2 pilot pollute the cohort (see this.instrumentAB).
      if (this.instrumentAB) records.recordConveyorDockPosition(repeated);
      this.lastCorrectDockIndex = correctIdx;
    } else {
      // Production: clear the recalled-answer entry and open the keypad.
      this.entry = '';
      this.updateEntry();
      this.setKeypadEnabled(true);
    }

    // Gentle bob so the parked crate feels alive without moving the number.
    this.bobTween = this.tweens.add({
      targets: this.crate,
      y: BELT_Y - 12,
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    // Ride-off-the-end timer: unanswered → requeue (no record).
    this.crateTimer = this.time.delayedCall(this.problemSeconds * 1000, () => this.timeoutCrate());
    this.dropEntryHold();   // a fresh entry-hold budget for this crate (see holdBelt)
  }

  // Pause the crate's ride-off clock while an answer is being typed. Called on
  // every digit (a no-op once the hold is on); releaseBelt() lets the clock run
  // again when the entry empties (backspace, or a wrong answer clearing it).
  // The hold budget is a second timer that only runs while the belt is held:
  // it pauses on every release and resumes on the next hold, so a crate can be
  // held for at most ENTRY_HOLD_MS of actual hold time no matter how the kid
  // types, deletes and retypes. Once it has fired (hasDispatched) the clock
  // runs even mid-entry, so a stalled entry still resolves. Response time is
  // measured from reveal to submit (startedAtMs), so none of this touches the
  // recorded timing.
  holdBelt() {
    if (!this.crateTimer || this.entryHoldTimer?.hasDispatched) return;
    this.crateTimer.paused = true;
    if (this.entryHoldTimer) this.entryHoldTimer.paused = false;
    else this.entryHoldTimer = this.time.delayedCall(ENTRY_HOLD_MS, () => this.releaseBelt());
  }

  releaseBelt() {
    if (this.crateTimer) this.crateTimer.paused = false;
    if (this.entryHoldTimer) this.entryHoldTimer.paused = true;
  }

  // Take the crate clock (and its hold budget) out of the scene clock for good.
  // TimerEvent.remove() only flags the event and relies on the next Clock
  // update to drop it, and that update skips paused events, so a timer removed
  // while held would sit in the clock's active list until the scene shuts
  // down. removeEvent splices it out directly, paused or not.
  dropCrateTimer() {
    this.dropEntryHold();
    if (!this.crateTimer) return;
    this.time.removeEvent(this.crateTimer);
    this.crateTimer = null;
  }

  // The hold budget can be paused too (see releaseBelt), so it leaves the same
  // way. Every path that ends a crate goes through here, via dropCrateTimer or
  // directly (spawnCrate, timeoutCrate).
  dropEntryHold() {
    if (!this.entryHoldTimer) return;
    this.time.removeEvent(this.entryHoldTimer);
    this.entryHoldTimer = null;
  }

  // The single resolution path for BOTH input modes — the only difference is
  // who calls it (a dock tap with its index, or the keypad with dockIndex=null)
  // and how the crate routes out. The engine writes are byte-identical, which is
  // exactly what makes the production-vs-recognition A/B clean.
  commit(value, dockIndex = null) {
    if (!this.acceptingInput || this.ended) return;
    const p = this.activeProblem;
    const correct = value === p.answer;

    if (correct) {
      this.acceptingInput = false;
      this.dropCrateTimer();
      this.bobTween?.stop();
      // Kill any in-flight crate tween (e.g. a lingering shakeCrate from a wrong
      // retry on THIS crate) before the ship tween, so its onComplete can't snap
      // the now-shipping crate back to belt center. Reset the tilt too — a shake
      // killed mid-wobble would otherwise ship the crate at a stray angle (the
      // recognition route doesn't re-set angle on its way to the dock).
      this.tweens.killTweensOf(this.crate);
      this.crate.angle = 0;

      const elapsed = performance.now() - this.startedAtMs;
      progress.recordFactAttempt(p.a, p.b, true, elapsed);
      records.recordAnswer(p, true, elapsed);
      // Conveyor A/B timing is a Chapter-3-only instrument (see this.instrumentAB) —
      // gate it so the Ch1/Ch2 pilot doesn't conflate cohorts. The general fact
      // timing above (recordFactAttempt/recordAnswer) still records every chapter.
      if (this.instrumentAB) records.recordConveyorTiming(this.inputMode, elapsed);

      this.score++;
      this.attempts++;
      this.shipped++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      if (this.isBoss) {
        this.bossQuota++;
        this.drawQuotaBar();
        if (this.bossQuota >= this.bossMaxQuota) {
          this.bossWon = true;
          // Quota filled: disarm the round clock NOW. The win isn't banked until
          // afterResolve() fires (after the ~460ms pack-off animation); without this,
          // a buzzer-beater final crate lets the round timer fire finishRound()
          // (a LOSS) first, set ended=true, and swallow the real win.
          this.roundTimer?.remove();
          this.roundTimer = null;
        }
      }
      this.updateHud();
      this.pulseShippedCounter();
      audio.playMatch?.();

      if (this.inputMode === 'recognition') {
        this.setDocksEnabled(false);
        this.shipCrateToDock(dockIndex);
      } else {
        // Flash the recalled answer green + confirmed before it clears, so a
        // correct punch is acknowledged on the pad as well as on the crate.
        if (this.keypad?.entryText) {
          this.keypad.entryText.setColor('#58d68d');
          this.keypad.entryText.setText('= ' + p.answer + '  ✓');
        }
        this.setKeypadEnabled(false);
        this.shipCrateToOutput();
      }
    } else {
      // Return to sender: the crate STAYS (retry allowed), the clock keeps
      // running. Each wrong answer is a real attempt + de-certifies the fact.
      this.attempts++;
      this.streak = 0;
      progress.recordFactAttempt(p.a, p.b, false);
      records.recordAnswer(p, false, performance.now() - this.startedAtMs);
      audio.playWrong?.();
      this.updateHud();
      if (this.inputMode === 'recognition') {
        this.rejectDock(dockIndex);
      } else {
        // Clear the wrong entry so the kid can re-punch; keypad stays open. The
        // entry is empty again, so the belt clock runs until the next digit.
        this.entry = '';
        this.updateEntry();
        this.flashEntryWrong();
        this.releaseBelt();
      }
      this.crate?.flashWrong();
      if (this.crate) this.burstReject(this.crate.x, this.crate.y);
      this.shakeCrate();
    }
  }

  timeoutCrate() {
    if (this.ended || !this.acceptingInput) return;
    this.acceptingInput = false;
    this.dropEntryHold();
    // A stalled partial answer must not ride through the tip-off and the next
    // crate's slide-in on the readout: clear it the way a wrong answer does.
    this.entry = '';
    this.updateEntry();
    this.bobTween?.stop();
    this.tweens.killTweensOf(this.crate); // drop any lingering shake before the tip-off
    this.setDocksEnabled(false);
    if (this.keypad) this.setKeypadEnabled(false);

    // Requeue the exact fact so it returns next — a non-answer is not a wrong
    // answer, so nothing is recorded (the engine still resurfaces weak facts).
    this.requeuedFact = { a: this.activeProblem.a, b: this.activeProblem.b };

    // Tip off the right end into the recheck chute.
    this.tweens.add({
      targets: this.crate,
      x: W + CRATE_SIZE,
      angle: 18,
      alpha: 0.25,
      duration: 520,
      ease: 'Quad.easeIn',
      onComplete: () => this.afterResolve()
    });
  }

  shipCrateToDock(dockIndex) {
    const dock = this.docks[dockIndex];
    const targetX = dock ? dock.cx : ACTIVE_X;
    const targetY = DOCK_Y - 30;
    const sx = this.crate.x, sy = this.crate.y;

    // The stamp pops + a green burst at the crate; the dock thunks green.
    this.crate.stamp();
    this.burstSuccess(sx, sy);
    if (dock) this.thunkDock(dockIndex, true);

    // A quick anticipation squash ("pack it down"), then the routed crate flies
    // to its dock.
    this.tweens.add({
      targets: this.crate, scaleX: 1.12, scaleY: 0.86, duration: 80, yoyo: true, ease: 'Quad.easeOut',
      onComplete: () => {
        if (!this.crate) return;
        this.tweens.add({
          targets: this.crate,
          x: targetX, y: targetY, scaleX: 0.62, scaleY: 0.62,
          duration: SHIP_MS, ease: 'Quad.easeIn',
          onComplete: () => this.afterResolve()
        });
      }
    });

    // Little celebratory hop from the pet.
    this.pet?.bounceHappy?.();
  }

  // Production has no dock row (the keypad lives there), so a packed crate is
  // "loaded out": the pet's station lifts it up-and-off toward the pet/output.
  shipCrateToOutput() {
    const sx = this.crate.x, sy = this.crate.y;
    this.crate.stamp();
    this.burstSuccess(sx, sy);

    // Anticipation squash, then the station lifts the stamped crate up-and-off.
    this.tweens.add({
      targets: this.crate, scaleX: 1.12, scaleY: 0.86, duration: 80, yoyo: true, ease: 'Quad.easeOut',
      onComplete: () => {
        if (!this.crate) return;
        this.tweens.add({
          targets: this.crate,
          x: W + CRATE_SIZE, y: BELT_Y - 280, scaleX: 0.5, scaleY: 0.5, angle: -8,
          duration: SHIP_MS, ease: 'Quad.easeIn',
          onComplete: () => this.afterResolve()
        });
      }
    });
    this.pet?.bounceHappy?.();
  }

  afterResolve() {
    if (this.ended) return;
    this.crate?.destroy();
    this.crate = null;
    this.clearDocks();

    // Boss quota filled → win immediately (don't wait for the clock).
    if (this.isBoss && this.bossWon) {
      this.finishRound({ bossWin: true });
    } else if (this.time.now >= this.roundEndsAt) {
      this.finishRound();
    } else {
      this.time.delayedCall(RESOLVE_GAP_MS, () => this.spawnCrate());
    }
  }

  // ── Hidden world: the FOOD CRATE ──────────────────────────────────────────
  //
  // The Chapter 3 equivalent of GameScene's warp asteroid. One crate rides the
  // belt with no math on it at all — just somebody's dinner, steaming, with a
  // number tag tied to the handle. Tapping it opens the secret room.
  //
  // It writes NOTHING to the pedagogy engine: no activeProblem, no startedAtMs,
  // no recordFactAttempt, no attempts/score/quota. It is purely an interruption,
  // which is what keeps the timing data honest.

  spawnFoodCrate() {
    if (this.ended || this.foodCrate) return;
    // Consume the countdown the moment it's delivered, so a stray spawnCrate()
    // while this one is still on the belt can't orphan it behind a second crate.
    // foodCrateRidesOff() re-arms it with a fresh number if it goes unclaimed.
    this.cratesUntilSecret = null;
    this.acceptingInput = false;
    // Close the input for the duration — there is nothing to answer here, and a
    // live keypad would let a stray punch land on the previous crate's problem.
    if (this.keypad) this.setKeypadEnabled(false);
    this.setDocksEnabled(false);

    // Which secret is riding in decides what the crate IS. Hot Pot Time arrives
    // as dinner; The Night Shift arrives as the one crate whose label wore off.
    this.foodCrate = findWorld(this.secretTargetId)?.belt
      ? this.buildUnlabeledCrate()
      : this.buildFoodCrate();
    this.foodCrate.x = -CRATE_SIZE;
    this.foodCrate.y = BELT_Y;

    this.arrivalTween = this.tweens.add({
      targets: this.foodCrate,
      x: ACTIVE_X,
      duration: ARRIVAL_MS,
      ease: 'Sine.easeOut',
      onComplete: () => this.makeFoodCrateTappable()
    });
  }

  makeFoodCrateTappable() {
    if (this.ended || !this.foodCrate) return;

    this.bobTween = this.tweens.add({
      targets: this.foodCrate,
      y: BELT_Y - 12,
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    const hit = this.add.rectangle(ACTIVE_X, BELT_Y, CRATE_SIZE + 40, CRATE_SIZE + 40, 0, 0)
      .setInteractive({ useHandCursor: true }).setDepth(9);
    this.foodCrateHit = hit;
    hit.on('pointerdown', () => this.openSecretRoom());

    // Generous window — this is a surprise, not a test. If it rides off anyway,
    // re-arm so it comes back in a few crates instead of being lost forever.
    this.crateTimer = this.time.delayedCall(this.problemSeconds * 1600, () => this.foodCrateRidesOff());
  }

  foodCrateRidesOff() {
    if (this.ended || !this.foodCrate) return;
    this.bobTween?.stop();
    this.foodCrateHit?.destroy();
    this.foodCrateHit = null;
    // Re-arm: a missed delivery comes back around.
    this.cratesUntilSecret = 2 + Math.floor(Math.random() * 3);

    this.tweens.add({
      targets: this.foodCrate,
      x: W + CRATE_SIZE,
      angle: 10,
      alpha: 0.25,
      duration: 560,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.foodCrate?.destroy();
        this.foodCrate = null;
        this.afterResolve();
      }
    });
  }

  // Tapped. Bank the discovery, then a warm steam wash into the room. The round
  // is abandoned (no progress written) exactly like a GameScene warp — the kid
  // replays the level afterwards, and the discovery is already saved.
  openSecretRoom() {
    if (this.ended || !this.foodCrate) return;
    this.ended = true;
    this.acceptingInput = false;
    this.foodCrateHit?.destroy();
    this.foodCrateHit = null;
    this.teardown();

    const targetId = this.secretTargetId;
    progress.discoverHiddenWorld(targetId);
    audio.playMatch?.();

    // The crate opens toward the kid instead of being packed off.
    this.tweens.killTweensOf(this.foodCrate);
    this.tweens.add({
      targets: this.foodCrate,
      y: BELT_Y - 70, scaleX: 1.25, scaleY: 1.25,
      duration: 520, ease: 'Back.easeOut'
    });

    // Belt secrets (The Night Shift) get their own cold arrival and drop straight
    // into the round, exactly as a gauntlet warp does from GameScene.
    if (findWorld(targetId)?.belt) {
      this.enterNightShift(targetId);
      return;
    }

    // Steam swallows the screen, Home Ground's answer to the hyperspace
    // streaks. Plain expanding ellipses only (project art rule: no rays).
    const steam = this.add.container(ACTIVE_X, BELT_Y).setDepth(80);
    for (let i = 0; i < 26; i++) {
      const puff = this.add.graphics();
      puff.fillStyle(0xffe8c8, 0.5);
      puff.fillEllipse(0, 0, 90, 60);
      const a = Math.random() * Math.PI * 2;
      const r0 = 40 + Math.random() * 120;
      puff.x = Math.cos(a) * r0;
      puff.y = Math.sin(a) * r0 * 0.6;
      steam.add(puff);
      this.tweens.add({
        targets: puff,
        x: Math.cos(a) * (r0 + 900),
        y: Math.sin(a) * (r0 + 900) * 0.8,
        scaleX: 7, scaleY: 7,
        alpha: 0,
        duration: 1000 + Math.random() * 500,
        ease: 'Quad.easeOut'
      });
    }

    const wash = this.add.rectangle(W / 2, H / 2, W, H, 0xffe8c8, 0).setDepth(81);
    this.tweens.add({ targets: wash, fillAlpha: 0.92, duration: 700, ease: 'Quad.easeIn' });

    const line = this.add.text(W / 2, H / 2, 'Everyone else got their order.\nThis one is yours.', style('display', {
      fontSize: '52px', fill: '#8a3a1e', align: 'center', fontStyle: '900',
      lineSpacing: 14
    })).setOrigin(0.5).setDepth(82).setAlpha(0);
    this.tweens.add({ targets: line, alpha: 1, duration: 420, delay: 480 });

    this.registry.set('selectedWorld', targetId);
    this.registry.set('hiddenWorldId', targetId);
    this.time.delayedCall(2100, () => {
      new TransitionManager(this).fadeToScene('HiddenWorldScene');
    });
  }

  // The lights go down instead of steam going up, and the kid lands straight in
  // the round — the same "warp drops you into the fight" beat the Glitch World and
  // King Coli already use, so the hardest secret in the game doesn't announce
  // itself with a menu. The map node is banked either way (discoverHiddenWorld
  // above), so a loss just means she walks back in from the map.
  enterNightShift(targetId) {
    this.tweens.killTweensOf(this.foodCrate);
    this.tweens.add({
      targets: this.foodCrate,
      y: BELT_Y - 40, scaleX: 1.12, scaleY: 1.12,
      duration: 520, ease: 'Back.easeOut'
    });

    // The room goes dark from the edges in: plain expanding ellipses again, but
    // opaque and cold, so it reads as the lights being switched off one bank at a
    // time rather than as fog rolling in.
    const dark = this.add.container(ACTIVE_X, BELT_Y).setDepth(80);
    for (let i = 0; i < 22; i++) {
      const blot = this.add.graphics();
      blot.fillStyle(0x070b14, 0.6);
      blot.fillEllipse(0, 0, 120, 80);
      const a = Math.random() * Math.PI * 2;
      const r0 = 260 + Math.random() * 220;
      blot.x = Math.cos(a) * r0;
      blot.y = Math.sin(a) * r0 * 0.7;
      dark.add(blot);
      this.tweens.add({
        targets: blot,
        x: Math.cos(a) * 40,
        y: Math.sin(a) * 40,
        scaleX: 6, scaleY: 6,
        duration: 900 + Math.random() * 400,
        ease: 'Quad.easeIn'
      });
    }

    const wash = this.add.rectangle(W / 2, H / 2, W, H, 0x070b14, 0).setDepth(81);
    this.tweens.add({ targets: wash, fillAlpha: 0.96, duration: 900, ease: 'Quad.easeIn' });

    const line = this.add.text(W / 2, H / 2, 'The label wore off this one.\nWork out where it goes.', style('display', {
      fontSize: '52px', fill: '#8fd0ff', align: 'center', fontStyle: '900',
      lineSpacing: 14
    })).setOrigin(0.5).setDepth(82).setAlpha(0);
    this.tweens.add({ targets: line, alpha: 1, duration: 420, delay: 620 });

    // Registry shape mirrors WorldMapScene._enterHiddenDestination's gauntlet path
    // so entering from the crate and entering from the map node are the same round.
    this.registry.set('selectedWorld', targetId);
    this.registry.set('hiddenWorldId', targetId);
    this.registry.set('currentWorldId', targetId);
    this.registry.set('currentLevel', 1);
    this.registry.set('levelMode', 'boss');
    this.time.delayedCall(2300, () => {
      new TransitionManager(this).fadeToScene('ConveyorScene');
    });
  }

  // The crate whose label wore off. Same wood as the world's own crates (it IS
  // one of the order — that's why it's unsettling), but scuffed, with nothing
  // left on the label plate except a torn corner of paper. No question mark: the
  // blank is the message, and a drawn "?" would do the kid's noticing for her.
  buildUnlabeledCrate() {
    const c = this.add.container(0, 0).setDepth(6);
    const s = CRATE_SIZE;
    const wood = Phaser.Display.Color.ValueToColor(this.world.color).lighten(4).color;
    const woodDark = Phaser.Display.Color.ValueToColor(this.world.color).darken(38).color;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.45);
    shadow.fillRoundedRect(-s / 2 + 6, -s / 2 + 10, s, s, 22);
    c.add(shadow);

    const body = this.add.graphics();
    body.fillStyle(wood, 1);
    body.fillRoundedRect(-s / 2, -s / 2, s, s, 22);
    // Plank seams + a dusty top edge, so it reads as stock that's been sitting.
    body.fillStyle(woodDark, 0.5);
    body.fillRect(-s / 2 + 8, -s / 2 + 76, s - 16, 5);
    body.fillRect(-s / 2 + 8, -s / 2 + 158, s - 16, 5);
    body.fillStyle(0x9fb4cc, 0.16);
    body.fillRect(-s / 2 + 10, -s / 2 + 12, s - 20, 10);
    body.lineStyle(8, woodDark, 1);
    body.strokeRoundedRect(-s / 2, -s / 2, s, s, 22);
    c.add(body);

    // The label plate: a pale rectangle, empty. One ragged corner of the old
    // label still clings on, drawn as plain triangles (no rays, no symbols).
    const plate = this.add.graphics();
    plate.fillStyle(0xe9e2d2, 0.9);
    plate.fillRoundedRect(-78, -34, 156, 84, 8);
    plate.lineStyle(4, 0xb7ad99, 1);
    plate.strokeRoundedRect(-78, -34, 156, 84, 8);
    // Torn strip along the top of the plate — the label that used to be there.
    plate.fillStyle(0xd8cdb4, 1);
    for (let i = 0; i < 6; i++) {
      const x = -78 + i * 26;
      plate.fillTriangle(x, -34, x + 26, -34, x + 13, -34 + (i % 2 ? 16 : 9));
    }
    // A single surviving shred hanging off the corner.
    plate.fillStyle(0xf3ecdb, 1);
    plate.fillTriangle(78, -34, 96, -22, 74, -8);
    plate.lineStyle(3, 0xb7ad99, 1);
    plate.strokeTriangle(78, -34, 96, -22, 74, -8);
    c.add(plate);

    // Cool halo: the same invitation the food crate makes, but in the Night Shift's
    // own cold light, so it reads as an after-hours light catching it rather than
    // something warm arriving.
    const halo = this.add.graphics();
    for (let i = 0; i < 4; i++) {
      const pad = 12 + i * 13;
      halo.lineStyle(10, 0x8fd0ff, 0.26 - i * 0.05);
      halo.strokeRoundedRect(-s / 2 - pad, -s / 2 - pad, s + pad * 2, s + pad * 2, 26 + pad);
    }
    c.addAt(halo, 0);
    this.tweens.add({
      targets: halo,
      alpha: { from: 0.4, to: 1 },
      scaleX: { from: 1, to: 1.06 },
      scaleY: { from: 1, to: 1.06 },
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    return c;
  }

  // A warm takeout crate: open-topped, a bowl of steaming broth inside, and a
  // paper number tag on the side. Deliberately reads as FOOD, not cargo — the
  // one crate on the belt that clearly isn't part of the order.
  buildFoodCrate() {
    const c = this.add.container(0, 0).setDepth(6);
    const s = CRATE_SIZE;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.4);
    shadow.fillRoundedRect(-s / 2 + 6, -s / 2 + 10, s, s, 22);
    c.add(shadow);

    // Body — pale kraft-paper takeout box rather than the world's crate wood.
    const body = this.add.graphics();
    body.fillStyle(0xe8c98a, 1);
    body.fillRoundedRect(-s / 2, -s / 2, s, s, 22);
    body.fillStyle(0xd9a05b, 0.55);
    body.fillRect(-s / 2 + 10, -s / 2 + 18, s - 20, 5);
    body.lineStyle(8, 0xa8743a, 1);
    body.strokeRoundedRect(-s / 2, -s / 2, s, s, 22);
    // Folded-open flaps at the top.
    body.fillStyle(0xf3e0bc, 1);
    body.fillTriangle(-s / 2, -s / 2 + 6, -s / 2 + 74, -s / 2 + 6, -s / 2 + 20, -s / 2 - 44);
    body.fillTriangle(s / 2, -s / 2 + 6, s / 2 - 74, -s / 2 + 6, s / 2 - 20, -s / 2 - 44);
    c.add(body);

    // A single round bowl of broth inside — individual bowl, never a divided pot.
    const bowl = this.add.graphics();
    bowl.fillStyle(0xf7f1e6, 1);
    bowl.fillEllipse(0, 18, 150, 76);
    bowl.fillStyle(0xc85a4a, 1);
    bowl.fillEllipse(0, -2, 126, 44);
    bowl.fillStyle(0xffd15c, 1);
    bowl.fillCircle(30, -4, 8);
    bowl.fillCircle(46, -12, 6);
    bowl.fillStyle(0x5e9a45, 1);
    bowl.fillEllipse(-34, 2, 34, 14);
    bowl.lineStyle(3, 0xb9ae9a, 1);
    bowl.strokeEllipse(0, -2, 126, 44);
    c.add(bowl);

    // Paper number tag on the corner — take your number, it comes.
    const tag = this.add.graphics();
    tag.fillStyle(0xf5e2b8, 1);
    tag.fillRoundedRect(s / 2 - 74, s / 2 - 78, 62, 62, 8);
    tag.lineStyle(3, 0xa8743a, 1);
    tag.strokeRoundedRect(s / 2 - 74, s / 2 - 78, 62, 62, 8);
    c.add(tag);
    // The tag number is lettering painted on the prop (art), not a word to read.
    c.add(this.add.text(s / 2 - 43, s / 2 - 47, '83', style('display', {
      fontSize: '36px', fill: '#8a3a1e', fontStyle: '900', art: true
    })).setOrigin(0.5));

    // Steam — plain soft ellipses rising OUT of the open flaps (project art rule:
    // ellipses, never rays or spirals). Starts at the rim so it reads as steam
    // leaving the box rather than fog sitting inside it.
    for (let i = 0; i < 3; i++) {
      const puff = this.add.graphics();
      puff.fillStyle(0xffe8c8, 0.55);
      puff.fillEllipse(0, 0, 44, 26);
      puff.setPosition(-40 + i * 40, -s / 2 - 30);
      c.add(puff);
      this.tweens.add({
        targets: puff,
        y: -s / 2 - 170,
        scaleX: 2.1, scaleY: 2.1,
        alpha: 0,
        duration: 1900,
        delay: i * 480,
        repeat: -1,
        ease: 'Sine.easeOut'
      });
    }

    // A warm halo so it clearly reads as "not one of the order" and invites a tap
    // without a flashing arrow. Nested strokes, so the glow shows AROUND the box
    // instead of being hidden behind it the way a filled plate would be.
    const halo = this.add.graphics();
    for (let i = 0; i < 4; i++) {
      const pad = 12 + i * 13;
      halo.lineStyle(10, 0xffb85c, 0.30 - i * 0.06);
      halo.strokeRoundedRect(-s / 2 - pad, -s / 2 - pad, s + pad * 2, s + pad * 2, 26 + pad);
    }
    c.addAt(halo, 0);
    this.tweens.add({
      targets: halo,
      alpha: { from: 0.45, to: 1 },
      scaleX: { from: 1, to: 1.06 },
      scaleY: { from: 1, to: 1.06 },
      duration: 780, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    return c;
  }

  // ── Crate + dock art ──────────────────────────────────────────────────────

  buildCrate() {
    const c = this.add.container(0, 0).setDepth(6);
    const wood = Phaser.Display.Color.ValueToColor(this.world.color).lighten(8).color;
    const woodDark = Phaser.Display.Color.ValueToColor(this.world.color).darken(28).color;
    const s = CRATE_SIZE;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.4);
    shadow.fillRoundedRect(-s / 2 + 6, -s / 2 + 10, s, s, 22);
    c.add(shadow);

    const body = this.add.graphics();
    body.fillStyle(wood, 1);
    body.fillRoundedRect(-s / 2, -s / 2, s, s, 22);
    // Horizontal plank slats: a plain crate (no diagonal cross). This shared crate
    // is the wave 1 stand-in; wave 2 swaps it for each place's own item (a grocery
    // bag, a bread box, a gondola cabin) with the fact where the label plate sits.
    body.fillStyle(lighten(this.world.color, 0.14), 0.5);
    for (let i = 0; i < 4; i++) {
      body.fillRect(-s / 2 + 10, -s / 2 + 18 + i * (s - 36) / 4, s - 20, 5);
    }
    // Edge frame + corner bolts in the accent colour.
    body.lineStyle(8, woodDark, 1);
    body.strokeRoundedRect(-s / 2, -s / 2, s, s, 22);
    body.fillStyle(this.accent, 0.9);
    for (const [bx, by] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      body.fillCircle(bx * (s / 2 - 26), by * (s / 2 - 26), 7);
    }
    c.add(body);

    // Label plate where the fact prints. The Night Shift's facts are equations
    // rather than expressions, so they print on two lines and the plate is taller
    // to match (see c.reveal below).
    const plateH = this.isNightShift ? 132 : 104;
    const plate = this.add.graphics();
    plate.fillStyle(0xf3ead7, 1);
    plate.fillRoundedRect(-s / 2 + 26, -plateH / 2, s - 52, plateH, 14);
    plate.lineStyle(4, woodDark, 0.6);
    plate.strokeRoundedRect(-s / 2 + 26, -plateH / 2, s - 52, plateH, 14);
    c.add(plate);

    // Wrong-answer wash — a red overlay on the plate, hidden at rest. Sits UNDER
    // the fact text so the number stays legible while it pulses.
    const plateFlash = this.add.graphics();
    plateFlash.fillStyle(COLORS.error, 1);
    plateFlash.fillRoundedRect(-s / 2 + 26, -plateH / 2, s - 52, plateH, 14);
    plateFlash.setAlpha(0);
    c.add(plateFlash);

    const factText = this.add.text(0, 0, '', style('display', {
      fontSize: '58px', fill: '#2c2336', stroke: '#2c2336', strokeThickness: 1,
      align: 'center', lineSpacing: -6
    })).setOrigin(0.5);
    c.add(factText);
    // Usable box inside the label plate, minus a little breathing room.
    const plateInnerW = (s - 52) - 26;
    const plateInnerH = plateH - 18;

    // The stamp (copy.stamp: PACKED in Chapter 3), hidden until a correct route.
    // The word is inked with a dark green outline so it reads over both the cream
    // plate and the dark fact beneath it, and the frame is sized from the word so
    // the longest chapter stamp ("ABSORBED"/"SALVAGED") always sits inside it.
    const stamp = this.add.container(0, 0);
    const stampG = this.add.graphics();
    const stampText = this.add.text(0, 0, this.copy.stamp, style('subhead', {
      fontSize: '42px', fill: '#58d68d', fontStyle: '900',
      stroke: '#0f3d22', strokeThickness: 6
    })).setOrigin(0.5);
    const stampW = Math.max(260, Math.ceil(stampText.width) + 44);
    const stampH = Math.max(68, Math.ceil(stampText.height) + 16);
    stampG.lineStyle(6, COLORS.success, 1);
    stampG.strokeRoundedRect(-stampW / 2, -stampH / 2, stampW, stampH, 10);
    stamp.add(stampG);
    stamp.add(stampText);
    stamp.setAngle(-12);
    stamp.setScale(0);
    stamp.setAlpha(0);
    c.add(stamp);

    // Print the fact on the plate at the largest size that fits.
    //
    // A forward fact ("7 × 8") is five characters and has always fit at 58px. An
    // inverse one ("? × 12 = 144") is more than twice as wide and ran off the wood.
    // Shrinking it to fit one line cost more than half the type size — unacceptable
    // for the single most important element on screen — so an equation BREAKS at
    // the "=" instead and prints as two big lines:
    //
    //     ? × 12
    //     = 144
    //
    // which also reads the way the question is actually asked. The shrink loop
    // stays as a backstop so any future display string is clipped-proof, but it
    // now has to do almost no work, and it never goes below the label floor.
    c.reveal = (display) => {
      const text = display.includes(' = ') ? display.replace(' = ', '\n= ') : display;
      let size = 58;
      factText.setFontSize(size);
      factText.setText(text);
      while ((factText.width > plateInnerW || factText.height > plateInnerH) && size > TYPE.label) {
        size -= 2;
        factText.setFontSize(size);
      }
    };

    c.stamp = () => {
      // Punch the stamp in with an overshoot + settle, plus a quick white flare
      // behind it: a correct route should land as a satisfying "ka-CHUNK", not a
      // gentle fade-in.
      stamp.setAlpha(1);
      stamp.setScale(0);
      stamp.setAngle(-28);
      const flare = this.add.graphics();
      flare.fillStyle(0xffffff, 0.9);
      flare.fillRoundedRect(-stampW / 2 + 2, -stampH / 2 - 8, stampW - 4, stampH + 16, 12);
      stamp.addAt(flare, 0);
      this.tweens.add({
        targets: stamp, scale: 1.18, angle: -12, duration: 200, ease: 'Back.easeOut',
        onComplete: () => this.tweens.add({ targets: stamp, scale: 1, duration: 130, ease: 'Sine.easeOut' })
      });
      this.tweens.add({
        targets: flare, alpha: 0, duration: 300, ease: 'Quad.easeOut',
        onComplete: () => { if (flare.active) flare.destroy(); }
      });
    };

    let wrongResetTimer = null;
    c.flashWrong = () => {
      // One firm red pulse over the plate + the fact text briefly reddening, so a
      // miss reads instantly without relying on the buzzer alone. Restart cleanly
      // on a rapid second miss: kill the prior pulse + reset timer so the colours
      // don't flicker back early.
      this.tweens.killTweensOf(plateFlash);
      plateFlash.setAlpha(0);
      this.tweens.add({ targets: plateFlash, alpha: 0.5, duration: 90, yoyo: true, repeat: 1 });
      factText.setColor('#b3261e');
      wrongResetTimer?.remove();
      wrongResetTimer = this.time.delayedCall(380, () => { if (factText.active) factText.setColor('#2c2336'); });
    };

    return c;
  }

  buildDocks(labels) {
    this.clearDocks();
    this.docks = labels.map((value, i) => {
      const cx = DOCK_MARGIN + DOCK_W / 2 + i * (DOCK_W + DOCK_GAP);
      const cont = this.add.container(cx, DOCK_Y).setDepth(5);

      const bg = this.add.graphics();
      this.paintDock(bg, COLORS.bgPanel, this.accent);
      cont.add(bg);

      const numText = this.add.text(0, 4, value.toString(), style('display', {
        fontSize: '72px', fill: '#ffffff'
      })).setOrigin(0.5);
      cont.add(numText);

      const hit = this.add.rectangle(0, 0, DOCK_W, DOCK_H, 0x000000, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => this.tweens.add({ targets: cont, scaleX: 1.04, scaleY: 1.04, duration: 100 }));
      hit.on('pointerout', () => this.tweens.add({ targets: cont, scaleX: 1, scaleY: 1, duration: 100 }));
      hit.on('pointerdown', () => this.commit(value, i));
      cont.add(hit);

      return { cont, bg, numText, hit, value, cx };
    });
  }

  paintDock(bg, fill, accent) {
    bg.clear();
    bg.fillStyle(0x000000, 0.4);
    bg.fillRoundedRect(-DOCK_W / 2 + 3, -DOCK_H / 2 + 6, DOCK_W, DOCK_H, 22);
    bg.fillStyle(fill, 1);
    bg.fillRoundedRect(-DOCK_W / 2, -DOCK_H / 2, DOCK_W, DOCK_H, 22);
    // Open-bin lip.
    bg.fillStyle(accent, 0.22);
    bg.fillRoundedRect(-DOCK_W / 2, -DOCK_H / 2, DOCK_W, 42, { tl: 22, tr: 22, bl: 4, br: 4 });
    bg.lineStyle(4, accent, 0.85);
    bg.strokeRoundedRect(-DOCK_W / 2, -DOCK_H / 2, DOCK_W, DOCK_H, 22);
  }

  setDocksEnabled(enabled) {
    this.docks.forEach(d => {
      if (enabled) d.hit.setInteractive({ useHandCursor: true });
      else d.hit.disableInteractive();
    });
  }

  clearDocks() {
    this.docks.forEach(d => d.cont.destroy());
    this.docks = [];
  }

  rejectDock(i) {
    const d = this.docks[i];
    if (!d) return;
    this.paintDock(d.bg, COLORS.bgPanel, COLORS.error);
    this.tweens.add({
      targets: d.cont, x: d.cx - 14, duration: 60, yoyo: true, repeat: 3,
      onComplete: () => {
        // The dock can be cleared between rounds before this settles — guard
        // against touching a destroyed container.
        if (!d.cont?.active) return;
        d.cont.x = d.cx;
        this.paintDock(d.bg, COLORS.bgPanel, this.accent);
      }
    });
  }

  thunkDock(i, success) {
    const d = this.docks[i];
    if (!d) return;
    if (success) this.paintDock(d.bg, COLORS.bgPanel, COLORS.success);
    this.tweens.add({
      targets: d.cont, scaleX: 1.1, scaleY: 0.9, duration: 120, yoyo: true, ease: 'Quad.easeOut'
    });
  }

  // ── Production keypad (free-recall stamp pad) ──────────────────────────────

  buildKeypad() {
    const cont = this.add.container(0, 0).setDepth(5);
    // The readout has its own container so it stays at full strength when the
    // keys dim between crates: the green "= 56 ✓" confirmation is shown at
    // exactly that moment and has to read.
    const readout = this.add.container(0, 0).setDepth(5);
    this.keypad = { cont, readout, buttons: [], enabled: false, entryText: null };

    // Recalled-answer readout, between the belt and the pad.
    const plateW = 520;
    const plateH = ENTRY_PLATE_H;
    const plate = this.add.graphics();
    plate.fillStyle(0x000000, 0.35);
    plate.fillRoundedRect(W / 2 - plateW / 2 + 2, ENTRY_Y - plateH / 2 + 4, plateW, plateH, 18);
    plate.fillStyle(COLORS.bgPanel, 0.96);
    plate.fillRoundedRect(W / 2 - plateW / 2, ENTRY_Y - plateH / 2, plateW, plateH, 18);
    plate.lineStyle(4, this.accent, 0.7);
    plate.strokeRoundedRect(W / 2 - plateW / 2, ENTRY_Y - plateH / 2, plateW, plateH, 18);
    readout.add(plate);
    this.keypad.entryText = this.add.text(W / 2, ENTRY_Y, '= –', style('display', {
      fontSize: '76px', fill: '#ffffff'
    })).setOrigin(0.5);
    readout.add(this.keypad.entryText);

    const layout = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['⌫', '0', '✓']
    ];
    layout.forEach((cols, row) => cols.forEach((label, col) => {
      const x = KEYPAD_COL0 + col * (KEYPAD_BTN_W + KEYPAD_GAP_X);
      const y = KEYPAD_TOP + row * (KEYPAD_BTN_H + KEYPAD_GAP_Y);
      const kind = label === '⌫' ? 'back' : label === '✓' ? 'submit' : 'digit';
      const accent = kind === 'submit' ? COLORS.success : kind === 'back' ? COLORS.warning : this.accent;
      const fill = kind === 'submit' ? COLORS.success : COLORS.bgPanel;

      const btn = this.add.container(x, y);
      const bg = this.add.graphics();
      this.paintKeypadButton(bg, fill, accent, kind === 'submit');
      btn.add(bg);
      btn.add(this.add.text(0, 0, label, style('display', {
        fontSize: '62px', fill: kind === 'submit' ? '#0a0a18' : '#ffffff'
      })).setOrigin(0.5));

      const hit = this.add.rectangle(0, 0, KEYPAD_BTN_W, KEYPAD_BTN_H, 0x000000, 0);
      btn.add(hit);
      hit.on('pointerover', () => this.tweens.add({ targets: btn, scaleX: 1.04, scaleY: 1.04, duration: 80 }));
      hit.on('pointerout', () => this.tweens.add({ targets: btn, scaleX: 1, scaleY: 1, duration: 80 }));
      hit.on('pointerdown', () => {
        if (kind === 'digit') this.pressDigit(label);
        else if (kind === 'back') this.pressBackspace();
        else this.submitProduction();
      });
      cont.add(btn);
      this.keypad.buttons.push({ btn, hit });
    }));

    this.setKeypadEnabled(false);
  }

  paintKeypadButton(bg, fill, accent, isSubmit) {
    bg.clear();
    bg.fillStyle(0x000000, 0.35);
    bg.fillRoundedRect(-KEYPAD_BTN_W / 2 + 2, -KEYPAD_BTN_H / 2 + 4, KEYPAD_BTN_W, KEYPAD_BTN_H, 18);
    bg.fillStyle(fill, isSubmit ? 1 : 0.95);
    bg.fillRoundedRect(-KEYPAD_BTN_W / 2, -KEYPAD_BTN_H / 2, KEYPAD_BTN_W, KEYPAD_BTN_H, 18);
    bg.lineStyle(4, accent, 0.9);
    bg.strokeRoundedRect(-KEYPAD_BTN_W / 2, -KEYPAD_BTN_H / 2, KEYPAD_BTN_W, KEYPAD_BTN_H, 18);
  }

  setKeypadEnabled(enabled) {
    if (!this.keypad) return;
    this.keypad.enabled = enabled;
    this.keypad.buttons.forEach(b => {
      if (enabled) b.hit.setInteractive({ useHandCursor: true });
      else b.hit.disableInteractive();
    });
    this.keypad.cont.setAlpha(enabled ? 1 : 0.45);
    // The readout stays bright between crates (it is showing the verdict on the
    // last one) and only steps back with the keys once the round is over, so it
    // does not sit bright behind the win beat and the results.
    this.keypad.readout.setAlpha(enabled || !this.ended ? 1 : 0.45);
  }

  pressDigit(d) {
    if (!this.acceptingInput || this.ended) return;
    if (this.entry.length >= MAX_ANSWER_DIGITS) return;
    this.entry += d;
    this.updateEntry();
    audio.playClick?.();
    // The belt waits while the answer is being typed (capped, see holdBelt).
    this.holdBelt();
    // Auto-submit only at the universal max digit count (no more digits are
    // possible) — never at the answer's own length, which would leak it.
    if (this.entry.length >= MAX_ANSWER_DIGITS) this.submitProduction();
  }

  pressBackspace() {
    if (!this.acceptingInput || this.ended || !this.entry.length) return;
    this.entry = this.entry.slice(0, -1);
    this.updateEntry();
    audio.playClick?.();
    // Deleted back to nothing: no longer mid-entry, so the belt clock runs.
    if (!this.entry.length) this.releaseBelt();
  }

  submitProduction() {
    if (!this.acceptingInput || this.ended || !this.entry.length) return;
    this.commit(parseInt(this.entry, 10), null);
  }

  updateEntry() {
    if (!this.keypad?.entryText) return;
    this.keypad.entryText.setColor('#ffffff');
    this.keypad.entryText.setText('= ' + (this.entry.length ? this.entry : '–'));
  }

  flashEntryWrong() {
    if (!this.keypad?.entryText) return;
    this.keypad.entryText.setColor('#ff6b6b');
    this.keypad.entryText.setText('= ✗');
    this.time.delayedCall(360, () => {
      if (!this.ended) this.updateEntry();
    });
  }

  shakeCrate() {
    if (!this.crate) return;
    // Restart the wobble cleanly from the parked pose. A parked crate always sits
    // at ACTIVE_X with angle 0 (the bob tween owns Y), so a rapid second wrong
    // answer can't stack offset shakes: stop ONLY the prior shake's own x/angle
    // tweens (never the bob), snap back to center, then re-wobble. The correct and
    // timeout paths still recover via their own killTweensOf + angle reset.
    this.shakeTweenX?.stop();
    this.shakeTweenAngle?.stop();
    this.crate.x = ACTIVE_X;
    this.crate.angle = 0;
    this.shakeTweenX = this.tweens.add({
      targets: this.crate, x: ACTIVE_X - 18, duration: 50, yoyo: true, repeat: 3,
      onComplete: () => { if (this.crate && this.acceptingInput) this.crate.x = ACTIVE_X; }
    });
    this.shakeTweenAngle = this.tweens.add({
      targets: this.crate, angle: { from: -5, to: 5 }, duration: 66, yoyo: true, repeat: 2,
      onComplete: () => { if (this.crate && this.acceptingInput) this.crate.angle = 0; }
    });
  }

  // ── Shared answer-feedback juice (both input modes call these) ──────────────

  // Green success burst at a world point: an expanding ring + a scatter of
  // neutral 4-point sparkles. Content-safe (a ring and star sparkles, no
  // spirals/sigils). So a correct answer always lands with the same pop whether
  // the kid punched the keypad or tapped a dock.
  burstSuccess(x, y) {
    const ring = this.add.graphics().setDepth(9).setPosition(x, y);
    ring.lineStyle(10, COLORS.success, 0.9);
    ring.strokeCircle(0, 0, 50);
    this.tweens.add({
      targets: ring, scale: { from: 0.4, to: 2.6 }, alpha: { from: 0.9, to: 0 },
      duration: 460, ease: 'Quad.easeOut', onComplete: () => ring.destroy()
    });
    for (let i = 0; i < 8; i++) {
      const ang = (Math.PI * 2 * i) / 8 + 0.3;
      const dist = 110 + Math.random() * 70;
      const sg = this.add.graphics().setDepth(9).setPosition(x, y);
      drawSparkleIcon(sg, 0, 0, 14 + Math.random() * 8, [COLORS.success, COLORS.warning, 0xffffff][i % 3]);
      this.tweens.add({
        targets: sg, x: x + Math.cos(ang) * dist, y: y + Math.sin(ang) * dist,
        scale: { from: 1, to: 0 }, alpha: { from: 1, to: 0 },
        duration: 520 + Math.random() * 220, ease: 'Quad.easeOut', onComplete: () => sg.destroy()
      });
    }
  }

  // A small dust-puff "cough" under the crate on a wrong answer — muted, earthy,
  // deliberately un-celebratory so it never reads like success.
  burstReject(x, y) {
    for (let i = 0; i < 5; i++) {
      const p = this.add.circle(x + (Math.random() - 0.5) * 50, y + 70, 6 + Math.random() * 6, 0x6b5d4a, 0.7).setDepth(9);
      this.tweens.add({
        targets: p, y: p.y + 28 + Math.random() * 30, x: p.x + (Math.random() - 0.5) * 50,
        alpha: 0, scale: { from: 1, to: 0.4 }, duration: 420 + Math.random() * 200,
        ease: 'Quad.easeOut', onComplete: () => p.destroy()
      });
    }
  }

  // Bump the stamp tally so a correct answer visibly ticks the hero counter.
  pulseShippedCounter() {
    if (!this.shippedText) return;
    this.tweens.killTweensOf(this.shippedText);
    this.shippedText.setScale(1);
    this.tweens.add({ targets: this.shippedText, scale: 1.32, duration: 130, yoyo: true, ease: 'Quad.easeOut' });
  }

  updateHud() {
    this.shippedText?.setText(this.shipped.toString());
    this.streakText?.setText(this.streak >= 2 ? `🔥${this.streak}` : '');
  }

  // ── Round end (mirrors GameScene's campaign endRound branch) ───────────────

  finishRound({ bossWin = false } = {}) {
    if (this.ended) return;
    this.ended = true;
    this.acceptingInput = false;
    this.dropCrateTimer();
    this.roundTimer?.remove();
    this.bobTween?.stop();
    // Settle the belt pet to its rest pose so it doesn't keep bobbing behind the
    // summary panel (the summary draws its own celebratory pet).
    this.petTween?.stop();
    if (this.crate) this.tweens.killTweensOf(this.crate);
    // Settle the hero counter: a correct-answer pulse mid-flight could otherwise
    // freeze it scaled-up behind the summary panel.
    if (this.shippedText) { this.tweens.killTweensOf(this.shippedText); this.shippedText.setScale(1); }
    // A food crate parked on the belt when the clock ran out: drop its tap target
    // and settle it, so an invisible hit-rect can't sit over the summary panel.
    this.foodCrateHit?.destroy();
    this.foodCrateHit = null;
    if (this.foodCrate) this.tweens.killTweensOf(this.foodCrate);
    this.setDocksEnabled(false);
    if (this.keypad) this.setKeypadEnabled(false);
    audio.playRoundComplete?.();

    const accuracy = getRoundAccuracy(this.score, this.attempts);
    const remaining = this.roundEndsAt ? Math.max(0, this.roundEndsAt - this.time.now) : 0;
    const timeLeftRatio = this.duration > 0 ? remaining / (this.duration * 1000) : 0;

    // The quota is filled iff bossWon, regardless of WHICH callback reached here
    // first: if the round clock fires finishRound() (bossWin defaults false)
    // during the quota crate's pack-off animation, the filled quota must still
    // score as a win. bossWon is the source of truth.
    const isWin = bossWin || (this.isBoss && this.bossWon);

    // Belt score counts correct crates, so it has no separate bonus points.
    const { stars, mastered } = calculateRoundResult({
      score: this.score,
      correctAnswers: this.score,
      attempts: this.attempts,
      scoreThreshold: this.scoreThreshold,
      isBoss: this.isBoss,
      bossWin: isWin,
      bossStars: isWin ? this.calculateConveyorBossStars(accuracy, timeLeftRatio) : 0
    });

    const prevBestStars = progress.worldProgress[this.worldId]?.levelStars?.[this.currentLevel] || 0;
    const firstMastery = stars === 3 && prevBestStars < 3;

    const wasMastered = progress.isWorldMastered(this.worldId);
    progress.completeLevel(this.worldId, this.currentLevel, stars, mastered);

    // The Night Shift's trophy, granted once on the first clear: the cup of
    // instant noodles you eat when you're the only one left in the store. Guarded
    // on the cleared flag rather than on clearHiddenWorld's return (it returns
    // nothing) so a replay can't silently re-equip over her chosen accessory.
    if (this.isNightShift && isWin && !progress.isHiddenWorldCleared(this.worldId)) {
      progress.clearHiddenWorld(this.worldId);
      cosmetics.addAndEquip('acc_noodles');
    }

    // Stardust — identical reward tiers to GameScene.
    let baseBonus = 0;
    if (stars > 0) {
      baseBonus = stars === 3 ? 10 : stars === 2 ? 5 : 2;
      economy.addStardust(baseBonus);
      this.stardustEarned += baseBonus;
    }
    let masteryBonus = 0;
    if (firstMastery) {
      masteryBonus = 5;
      economy.addStardust(masteryBonus);
      this.stardustEarned += masteryBonus;
    }
    const dailyBonus = claimDailyBonusIfDue();
    this.stardustEarned += dailyBonus;

    records.recordLevelComplete(this.bestStreak);

    // Evolution can become eligible mid-round from lifetime-correct gates (the
    // Conveyor records the same factMastery the rest of the game does), so keep
    // the pet progressing here too.
    const evolvedTo = companion.checkEvolutionEligibility?.();

    const worldJustMastered = !wasMastered && progress.isWorldMastered(this.worldId);
    // The "world cleared" celebration — this persisted flag (→ WorldMap ship
    // auto-advance) and the banner in the boss-win branch below — stays tied to the
    // boss climax, mirroring GameScene (see clearedThisRun there). Mastering the
    // world on a practice belt level (a Ch1/Ch2 mixed pilot round, or a Ch3 practice
    // replay that happens to land the 4th mastery) advances SILENTLY instead of
    // firing the boss payoff mid-practice. Unlock is independent (completeLevel →
    // checkWorldUnlock), so this only gates the cosmetic celebration.
    if (worldJustMastered && this.isBoss && isWin) progress.setJustClearedWorld(this.worldId);

    // Chapter 3 grand finale (W38, the mountain at dusk): the first boss win that
    // completes the world triggers the "homecoming" cinematic + credits (the lights
    // coming on for the ride down) instead of the normal summary, mirroring how
    // GameScene routes the W11/W28 finales. markFinale3Seen persists the flag
    // EARLY (atomic) so a tab close
    // mid-credits can't strand it; replays fall through to the normal boss flow.
    // The kid still gets the "All Packed!" win and its line first; the credits
    // start once it ends (or is tapped away), exactly once, behind a short fade.
    if (isWin && isChapter3FinaleWorld(this.worldId)
        && progress.isWorldFullyCleared(this.worldId) && !progress.finale3Seen) {
      progress.markFinale3Seen();
      this.registry.set('currentWorldId', this.worldId);
      this.registry.set('creditsMode', 'homecoming');
      let rolling = false;
      this.playOrderCompleteCinematic(() => {
        if (rolling) return;
        rolling = true;
        const cam = this.cameras.main;
        cam.once('camerafadeoutcomplete', () => this.scene.start('CreditsScene'));
        cam.fadeOut(400, 10, 10, 26);
      });
      return;
    }

    const summaryArgs = { stars, accuracy, firstMastery, masteryBonus, dailyBonus, bossWin: isWin };

    const proceed = () => this.showSummary(summaryArgs);
    const afterEvolve = () => {
      if (evolvedTo) {
        import('../EvolutionCinematic.js')
          .then(({ playEvolutionCinematic }) => playEvolutionCinematic(this, evolvedTo, proceed))
          .catch(() => proceed());
      } else {
        proceed();
      }
    };

    // A boss WIN earns the Home Ground "all packed" beat, then (if this run was
    // the one that mastered the whole world) the world-cleared banner, before the
    // summary. Everything else goes straight to the post-round flow.
    if (this.isBoss && isWin) {
      this.playOrderCompleteCinematic(() => {
        if (worldJustMastered) this.showWorldClearBanner(afterEvolve);
        else afterEvolve();
      });
    } else {
      afterEvolve();
    }
  }

  // Boss-win stars for the Conveyor. GameScene.calculateBossStars is damage-based
  // (ship HP), which Home Ground has no analog for: a filled quota is already
  // 100%, so stars grade how cleanly (accuracy) and how fast (time to spare) the
  // kid packed it.
  calculateConveyorBossStars(accuracy, timeLeftRatio) {
    if (accuracy >= 90 && timeLeftRatio >= 0.2) return 3;
    if (accuracy >= 75 || timeLeftRatio >= 0.15) return 2;
    return 1;
  }

  showSummary({ stars, accuracy, firstMastery, masteryBonus, dailyBonus, bossWin = false }) {
    // The backdrop dims behind the panel so the HUD and the keys step back. It
    // has to tween fillAlpha: the rectangle is made with a fill alpha of 0, so
    // tweening its alpha alone never showed any dim at all. The chute sign
    // pokes out past the panel's right edge as a word fragment, so it goes.
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(50).setInteractive();
    this.tweens.add({ targets: overlay, fillAlpha: 0.7, duration: 350 });
    if (this.chuteText) this.tweens.add({ targets: this.chuteText, alpha: 0, duration: 350 });

    const panelW = 880;
    const panelH = 980;
    const panel = this.add.container(W / 2, H + panelH / 2).setDepth(60);

    // Opaque, so the parked crate's fact never ghosts through behind the stars.
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.bgPanel, 1);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 32);
    bg.lineStyle(3, this.accent, 0.9);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 32);
    panel.add(bg);

    // Every boss string comes from the chapter's copy table (see CONVEYOR_CHAPTER).
    const title = this.isBoss
      ? (bossWin ? this.copy.summaryWin : this.copy.bossMiss)
      : (stars > 0 ? this.copy.summaryWin : "Time's Up!");
    const modeLabel = this.isBoss ? this.copy.bossHeadline : (MODES[this.levelMode]?.label || 'Mixed').toUpperCase();
    panel.add(this.add.text(0, -panelH / 2 + 80, title, style('display', {
      fontSize: '60px'
    })).setOrigin(0.5));
    panel.add(this.add.text(0, -panelH / 2 + 148, `${this.world.name.toUpperCase()} · ${modeLabel}`, style('caption', {
      fill: '#cfcfe0', fontStyle: '700'
    })).setOrigin(0.5));

    // Stars.
    const starY = -panelH / 2 + 260;
    for (let i = 0; i < 3; i++) {
      const filled = i < stars;
      const g = this.add.graphics();
      drawStarIcon(g, 0, 0, 44, filled ? COLORS.warning : 0x4a4a5e, 0xffffff);
      g.x = -160 + i * 160;
      g.y = starY;
      g.setScale(0);
      panel.add(g);
      this.tweens.add({
        targets: g, scale: 1.2, duration: 250, delay: 600 + i * 180, ease: 'Back.easeOut',
        onStart: () => filled && audio.playStar?.()
      });
    }

    // Stats. Three columns 280 apart, so a label as long as BEST STREAK has its
    // own lane at label size, with the label hung clear under its number.
    const statY = starY + 220;
    const statGap = 280;
    const stat = (x, value, label, color) => {
      panel.add(this.add.text(x, statY, value, style('display', { fontSize: '74px', fill: color })).setOrigin(0.5));
      panel.add(this.add.text(x, statY + 72, label, style('caption', { fontStyle: '700' })).setOrigin(0.5));
    };
    stat(-statGap, this.isBoss ? `${this.bossQuota}/${this.bossMaxQuota}` : this.shipped.toString(), this.isBoss ? this.copy.bossStat : this.copy.stamp, '#ffffff');
    stat(0, `${accuracy}%`, 'ACCURACY', hexStr(this.accent));
    stat(statGap, this.bestStreak.toString(), 'BEST STREAK', '#ff8b3d');

    // First-mastery banner: a pill sized from its words, riding the panel's top
    // edge and lifted clear of the title under it.
    if (firstMastery) {
      const bannerText = this.add.text(0, 0, 'FIRST MASTERY! +5 STARDUST', style('subhead', {
        fill: '#1a1208', fontStyle: '900'
      })).setOrigin(0.5);
      const pillW = Math.ceil(bannerText.width) + 80;
      const pillH = Math.ceil(bannerText.height) + 26;
      const banner = this.add.container(0, -panelH / 2 - 12);
      const bg2 = this.add.graphics();
      bg2.fillStyle(COLORS.warning, 1);
      bg2.fillRoundedRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2);
      banner.add(bg2);
      banner.add(bannerText);
      panel.add(banner);
      this.tweens.add({ targets: banner, scale: { from: 0.6, to: 1 }, duration: 320, ease: 'Back.easeOut' });
    }

    // Stardust chip: the sparkle and the words are laid out as one centred row
    // and the chip is sized around them, so a longer total never runs into the
    // sparkle.
    if (this.stardustEarned > 0) {
      const chip = this.add.container(0, statY + 160);
      const chipText = this.add.text(0, 0, `+${this.stardustEarned} STARDUST`, style('subhead', {
        fill: '#ffffff', fontStyle: '900', stroke: '#0a0a18', strokeThickness: 3
      })).setOrigin(0, 0.5);
      const iconSize = 22;                          // drawSparkleIcon: half-height
      const iconHalfW = Math.ceil(iconSize * 0.45); // and its half-width
      const iconGap = 18;
      const rowW = iconHalfW * 2 + iconGap + Math.ceil(chipText.width);
      const chipW = Math.max(400, rowW + 88);
      const chipH = Math.max(80, Math.ceil(chipText.height) + 28);
      const cg = this.add.graphics();
      cg.fillStyle(COLORS.bgTrack, 1);
      cg.fillRoundedRect(-chipW / 2, -chipH / 2, chipW, chipH, chipH / 2);
      cg.lineStyle(2, COLORS.accentPurple, 0.85);
      cg.strokeRoundedRect(-chipW / 2, -chipH / 2, chipW, chipH, chipH / 2);
      chip.add(cg);
      const icon = this.add.graphics();
      drawSparkleIcon(icon, -rowW / 2 + iconHalfW, 0, iconSize, COLORS.accentPurple);
      chip.add(icon);
      chipText.x = -rowW / 2 + iconHalfW * 2 + iconGap;
      chip.add(chipText);
      panel.add(chip);
    }

    // Summary pet, to the right of the stars and low enough that its ears stay
    // clear of the subtitle line above.
    if (companion.hasStarter?.()) {
      const pet = drawCompanion(this, 322, -196, { scale: 1.4 });
      pet.setScale(0);
      panel.add(pet);
      this.tweens.add({
        targets: pet, scale: 1.4, duration: 320, delay: 500, ease: 'Back.easeOut',
        onComplete: () => pet.bounceHappy?.()
      });
    }

    // Between rounds, peek at the Mastery Garden — the persistent bloom display
    // of which facts are now automatic (and which have gone rusty).
    const gardenY = panelH / 2 - 224;
    panel.add(createButton(this, {
      x: 0, y: gardenY, label: '🌱  Mastery Garden', width: 600, height: 84,
      color: 0x2f6e3a, onClick: () => this.showMasteryWall()
    }));

    const btnY = panelH / 2 - 110;
    panel.add(createButton(this, {
      x: -160, y: btnY, label: 'Retry', width: 280, height: 92,
      color: 0x4a4a6a, onClick: () => this.scene.restart()
    }));
    panel.add(createButton(this, {
      x: 160, y: btnY, label: 'Continue', width: 280, height: 92,
      color: this.accent, onClick: () => this.exitToMap()
    }));

    this.tweens.add({ targets: panel, y: H / 2, duration: 500, ease: 'Back.easeOut' });
  }

  // The Mastery Garden as a between-rounds overlay (above the summary).
  showMasteryWall() {
    audio.playClick?.();
    const root = this.add.container(0, 0).setDepth(70);
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setInteractive();
    root.add(dim);
    this.tweens.add({ targets: dim, fillAlpha: 0.8, duration: 220 });

    // Fade in at full scale (no scale-pop): the Done button below is positioned
    // against the wall's full panelH, so a scaling wall would make it snap.
    const wall = drawMasteryWall(this, W / 2, H / 2 - 50, { cell: 46, accent: this.accent });
    wall.setAlpha(0);
    root.add(wall);
    this.tweens.add({ targets: wall, alpha: 1, duration: 240, ease: 'Quad.easeOut' });

    const closeY = H / 2 - 50 + wall.panelH / 2 + 70;
    root.add(createButton(this, {
      x: W / 2, y: closeY, label: 'Done', width: 280, height: 88,
      color: this.accent, onClick: () => {
        this.tweens.add({ targets: root, alpha: 0, duration: 180, onComplete: () => root.destroy() });
      }
    }));
    // Tapping the dim backdrop also closes.
    dim.on('pointerdown', () => {
      this.tweens.add({ targets: root, alpha: 0, duration: 180, onComplete: () => root.destroy() });
    });
  }

  exitToMap() {
    // A just-mastered world auto-advances on the map; otherwise back to the grid.
    // Secret challenges have no mission briefing of their own, so they always
    // go back to the map.
    if (progress.justClearedWorld || this.world?.hidden) {
      this.scene.start('WorldMapScene');
    } else {
      this.scene.start('LevelSelectScene');
    }
  }

  // Abandon the round and leave — write NO progress. The fade keeps the scene
  // alive ~400ms, so we must end the round + tear timers down NOW; otherwise the
  // round clock could fire finishRound() mid-fade and silently bank progress.
  abandonRound(sceneKey) {
    if (this.ended) return;
    this.ended = true;
    this.acceptingInput = false;
    this.teardown();
    new TransitionManager(this).fadeToScene(sceneKey);
  }

  // ── Boss "Rush Order" framing (Home Ground native; NOT the GameScene monster intro) ──

  // Calm "a rush just came in" card. No monster, no red flash, a warm brief that
  // sets the quota + clock, then rolls the belt. Tap to skip.
  playRushOrderIntro(onDone) {
    const root = this.add.container(0, 0).setDepth(80);
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x1a1208, 0).setInteractive();
    root.add(overlay);
    // A brief adds several lines, which would otherwise run down over the keypad;
    // deepen the wash so the extra copy stays legible against the busy belt art.
    const brief = this.world.bossBrief;
    this.tweens.add({ targets: overlay, fillAlpha: brief ? 0.95 : 0.84, duration: 260 });

    // With a brief the card is centred on the screen from its measured height
    // once everything is on it (see below), since the brief's length varies by
    // place. Without one (Ch1/Ch2 conveyor pilot) the card sits exactly where it
    // always has.
    const card = this.add.container(W / 2, H / 2 - 60);
    card.setScale(0.6);
    card.setAlpha(0);
    root.add(card);

    // A neat stack of crates (plain rounded squares, no symbols).
    const stack = this.add.graphics();
    const cs = 64;
    const place = [[-cs, 20], [cs, 20], [0, -44]];
    place.forEach(([dx, dy]) => {
      stack.fillStyle(Phaser.Display.Color.ValueToColor(this.world.color).lighten(8).color, 1);
      stack.fillRoundedRect(dx - cs / 2, dy - cs / 2 - 130, cs, cs, 10);
      stack.lineStyle(5, Phaser.Display.Color.ValueToColor(this.world.color).darken(28).color, 1);
      stack.strokeRoundedRect(dx - cs / 2, dy - cs / 2 - 130, cs, cs, 10);
    });
    card.add(stack);

    // The headline is the chapter's bossIncoming. A room whose single headline does
    // double duty (the Night Shift's AFTER HOURS) has none and shows bossHeadline
    // instead, at the same title size.
    const incoming = this.copy.bossIncoming || this.copy.bossHeadline;
    card.add(this.add.text(0, 10, incoming, style('display', {
      fontSize: `${TYPE.title}px`,
      fill: this.isNightShift ? '#8fd0ff' : '#ffb142', fontStyle: '900'
    })).setOrigin(0.5));
    card.add(this.add.text(0, 96, this.world.name, style('subhead', {
      fontSize: `${TYPE.heading}px`, fontStyle: '800', fill: hexStr(this.accent)
    })).setOrigin(0.5));
    // Chapter 3 worlds carry a `bossBrief`: what this rush is FIXING. It's how the
    // authored `villain` finally surfaces in Home Ground: as an everyday mess at
    // the place (the tide over the towels, a tipped pallet), never a creature to
    // fight. Ch1/Ch2 pilot worlds have no brief, so the card falls back to exactly
    // the copy it always showed.
    // Flow top-down from under the world name. These are centre-origin by default,
    // which made a tall multi-line brief grow UPWARDS over the name, so anchor the
    // brief by its TOP edge and derive the next line from its measured height.
    let briefY = 158;
    if (brief) {
      const bt = this.add.text(0, briefY, brief, style('body', {
        fill: '#ffe6b0', align: 'center',
        stroke: '#170f06', strokeThickness: 4,
        lineSpacing: 10, wordWrap: { width: W - 160 }
      })).setOrigin(0.5, 0);
      this.balanceWrap(bt, W - 160);
      card.add(bt);
      briefY += bt.height + 30;
    }
    // The deadline sentence. Chapter 3 reads each place's own rushLine off the world
    // ("Pack all 44 before dark."); the pilots and the Night Shift ignore the world.
    const quotaLine = this.copy.quotaLine(this.bossMaxQuota, this.world);
    const qt = this.add.text(0, briefY, quotaLine, style('body', {
      fill: '#e8e8f0', align: 'center', wordWrap: { width: W - 160 }
    })).setOrigin(0.5, 0);
    this.balanceWrap(qt, W - 160);
    card.add(qt);

    // Centre the whole card (crate stack top to goal line bottom) on the screen,
    // so a long brief grows the card both ways instead of running down into the
    // keypad.
    if (brief) {
      const blockTop = -44 - 130 - cs / 2;
      const blockBottom = briefY + qt.height;
      card.y = Math.round(H / 2 - (blockTop + blockBottom) / 2);
    }

    this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });
    audio.playRoundComplete?.();

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      this.tweens.add({
        targets: root, alpha: 0, duration: 240,
        onComplete: () => { root.destroy(); if (typeof onDone === 'function') onDone(); }
      });
    };
    // Hold longer when there's a brief to actually read (W38's runs four short lines).
    const t = this.time.delayedCall(brief ? 4200 : 2100, finish);
    overlay.on('pointerdown', () => { t.remove(); finish(); });
  }

  // Warm "all packed" beat on a boss WIN (replaces the GameScene shatter
  // cinematic: nothing is destroyed; the rush is simply done). Tap to skip.
  playOrderCompleteCinematic(onDone) {
    const root = this.add.container(0, 0).setDepth(80);
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x0c2a14, 0).setInteractive();
    root.add(overlay);
    this.tweens.add({ targets: overlay, fillAlpha: 0.6, duration: 220 });

    // The victory line hangs where the top key row is and the pet stands over
    // the chute sign, so the keys, the readout and the sign step out for the
    // beat instead of showing through behind the words.
    const behind = [this.keypad?.cont, this.keypad?.readout, this.chuteText].filter(Boolean);
    if (behind.length) this.tweens.add({ targets: behind, alpha: 0, duration: 220 });

    const txt = this.add.text(W / 2, H / 2 - 40, this.copy.bossDone, style('display', {
      fontSize: '88px', fill: '#58d68d', align: 'center', fontStyle: '900', stroke: '#07120a', strokeThickness: 6
    })).setOrigin(0.5);
    txt.setScale(0);
    root.add(txt);
    this.tweens.add({ targets: txt, scale: 1, duration: 380, ease: 'Back.easeOut' });

    // The world's authored victory beat (flavorText). Chapter 3 has no combat
    // drama, so these warm lines ARE its emotional payoff; this is the moment they
    // land, once per rush cleared.
    // Hung by its top edge below the headline and the celebrating pet (which
    // stands to the right of the headline), so a two-line flavour grows down,
    // away from both.
    const flavor = this.world.flavorText;
    if (flavor) {
      const ft = this.add.text(W / 2, H / 2 + 190, flavor, style('body', {
        fill: '#d8f5c8', align: 'center',
        stroke: '#07120a', strokeThickness: 5,
        lineSpacing: 10, wordWrap: { width: W - 180 }
      })).setOrigin(0.5, 0);
      this.balanceWrap(ft, W - 180);
      ft.alpha = 0;
      root.add(ft);
      this.tweens.add({ targets: ft, alpha: 1, duration: 700, delay: 520, ease: 'Quad.easeOut' });
    }

    // A scatter of neutral sparkles (4-point) — celebratory, no spirals/sigils.
    for (let i = 0; i < 14; i++) {
      const sg = this.add.graphics();
      const sx = W / 2 + (Math.random() - 0.5) * 760;
      const sy = H / 2 + (Math.random() - 0.5) * 520;
      drawSparkleIcon(sg, sx, sy, 14 + Math.random() * 12, [COLORS.success, COLORS.warning, 0xffffff][i % 3]);
      sg.setScale(0);
      root.add(sg);
      this.tweens.add({
        targets: sg, scale: 1, alpha: { from: 1, to: 0 },
        duration: 700 + Math.random() * 500, delay: 120 + Math.random() * 500, ease: 'Quad.easeOut'
      });
    }

    if (companion.hasStarter?.()) {
      const pet = drawCompanion(this, W / 2 + 320, H / 2 + 40, { scale: 1.4 }).setDepth(81);
      pet.setScale(0);
      root.add(pet);
      this.tweens.add({
        targets: pet, scale: 1.4, duration: 300, ease: 'Back.easeOut',
        onComplete: () => pet.bounceHappy?.()
      });
    }
    audio.playWorldClearFanfare?.();

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      this.tweens.add({
        targets: root, alpha: 0, duration: 260,
        onComplete: () => { root.destroy(); if (typeof onDone === 'function') onDone(); }
      });
    };
    // Hold long enough to read the victory line when there is one.
    const t = this.time.delayedCall(flavor ? 3600 : 1700, finish);
    overlay.on('pointerdown', () => { t.remove(); finish(); });
  }

  // Slide-in "WORLD CLEARED" banner shown when the boss win masters the world.
  showWorldClearBanner(onComplete) {
    // Two lines, the place's name over WORLD CLEARED!, with the banner sized
    // from their measured heights so neither ever touches the edge.
    const bannerW = 960;
    const padY = 26;
    const lineGap = 8;
    const nameText = this.add.text(0, 0, this.world.name.toUpperCase(), style('subhead', {
      fill: '#cfcfe0', fontStyle: '800'
    })).setOrigin(0.5, 0);
    const clearedText = this.add.text(0, 0, 'WORLD CLEARED!', style('display', {
      fontSize: `${TYPE.title}px`, fill: hexStr(this.accent)
    })).setOrigin(0.5, 0);
    const bannerH = Math.max(160, padY * 2 + Math.ceil(nameText.height) + lineGap + Math.ceil(clearedText.height));
    nameText.y = -bannerH / 2 + padY;
    clearedText.y = nameText.y + nameText.height + lineGap;
    // It lands centred in the gap between the HUD's place name (bottom about
    // y 152) and the bar plate (top y 359), so its edge never cuts the name.
    const bannerY = 256;
    const banner = this.add.container(W / 2, -bannerH).setDepth(85);
    // Opaque, so the HUD counter under it does not ghost through the words.
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.bgPanel, 1);
    bg.fillRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 28);
    bg.lineStyle(4, this.accent, 0.9);
    bg.strokeRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 28);
    banner.add(bg);
    banner.add(nameText);
    banner.add(clearedText);

    let done = false;
    const finish = () => { if (done) return; done = true; if (typeof onComplete === 'function') onComplete(); };
    this.tweens.add({
      targets: banner, y: bannerY, duration: 420, ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(1600, () => {
          this.tweens.add({
            targets: banner, y: -bannerH, duration: 300, ease: 'Quad.easeIn',
            onComplete: () => { banner.destroy(); finish(); }
          });
        });
      }
    });
  }

  teardown() {
    this.dropCrateTimer();
    this.roundTimer?.remove();
    this.bobTween?.stop();
    this.arrivalTween?.stop();
    this.petTween?.stop();
    this.foodCrateHit?.destroy();
    this.foodCrateHit = null;
  }
}
