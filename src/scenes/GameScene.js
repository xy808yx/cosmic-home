import Phaser from 'phaser';
import { audio } from '../AudioManager.js';
import { music } from '../MusicManager.js';
import {
  MODES,
  BOSS_CONFIG,
  UPPER_LEVEL_CONFIG,
  getProblemForWorld,
  getReviewProblem,
  getTwistedProblem,
  getGlitchProblem,
  getDistractors,
  getProblemSecondsForWorldAndMode,
  getAdaptiveProblemSeconds,
  getComfortableProblemSeconds,
  getAsteroidCountForWorld,
  getBossHpForWorld,
  getBossDurationForWorld,
  isFinalVisibleWorld,
  isFinaleWorld,
  findWorld,
  getHiddenWorldForHost,
  getWorldMusicRate,
  progress
} from '../GameData.js';
import { TransitionManager } from '../TransitionManager.js';
import { createStarfield } from '../starfieldHelper.js';
import { getWorldBackground } from '../WorldBackgrounds.js';
import { createButton } from '../buttonHelper.js';
import { createModal } from '../modalHelper.js';
import { style } from '../textStyles.js';
import { companion, drawCompanion } from '../CompanionManager.js';
import { drawShip } from '../ShipRenderer.js';
import { economy, claimDailyBonusIfDue } from '../EconomyManager.js';
import { records } from '../RecordsManager.js';
import { drawStarIcon, drawHeartIcon, drawSparkleIcon } from '../StatIcons.js';
import { drawQuestionBody, drawBossBody as drawWorldBoss, drawDatamoshBlob, drawStardustHalo, drawTwistOverlay, drawMiniBossPips } from '../QuestionObjectArt.js';
import { ship } from '../ShipManager.js';
import { applyBossTwist, bossTwistOn } from '../BossMechanics.js';
import { darken, lighten } from '../colorUtils.js';
import { COLORS } from '../colorPalette.js';
import { createTopBar, drawTimeBar } from '../GameTopBar.js';
import { showArcadeResults } from '../ArcadeRun.js';
import { calculateRoundResult } from '../RoundResults.js';

const W = 1080;
const H = 1920;

const SHIP_HP_MAX = 5;
// Boss Rush uses a lighter HP pool per boss than the campaign — five full-length
// boss fights on a single shared ship would otherwise drag. Tunable.
const ARCADE_BOSS_HP = 8;

// New layout (1080×1920):
//   0–340  : top bar (two rows of stats + HP + time bar)
//   340–1500: asteroid play area
//   1300   : ship Y (with pet in cockpit)
//   1450–1900: answer button area
const TOP_BAR_H = 340;
const ASTEROID_TOP_Y = TOP_BAR_H + 60;
const ASTEROID_IMPACT_Y = 1240;
const SHIP_Y = 1370;
const ASTEROID_RADIUS = 110;
const IMPACT_GRACE_MS = 120;

// Round-flow state machine. `this.state` is one of these phases; the only
// legal way to change it is setState(), which validates against this table.
// Edges encode the REAL per-round flow (see ROUND_FLOW_REFACTOR_SPEC §2a) —
// tightened to exactly the transitions the code performs:
//   ready      → game just booted; → intro (boss) or → playing (normal)
//   intro      → boss intro cinematic running; → playing when it finishes
//   playing    → an asteroid is live; → feedback (answer/impact) or → ended (timer)
//   feedback   → answer landed; → playing (next/cycle), correction (boss card),
//                warp (gateway solved), failed (ship dead), or ended (timer/boss win)
//   correction → boss correction card up (timer paused); → playing on dismiss
//   warp/failed/ended → terminal; only a scene change leaves them
// An illegal edge means a caller is wrong — setState logs it (without crashing).
const ROUND_TRANSITIONS = {
  ready:      ['intro', 'playing'],
  intro:      ['playing'],
  playing:    ['feedback', 'ended'],
  feedback:   ['playing', 'correction', 'warp', 'failed', 'ended'],
  correction: ['playing'],
  warp:       [],
  failed:     [],
  ended:      [],
};

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init() {
    this.worldId = this.registry.get('currentWorldId') || 1;
    this.currentLevel = this.registry.get('currentLevel') || 1;
    this.mode = this.registry.get('levelMode') || 'mult';
    this.world = findWorld(this.worldId);
    this.isBoss = this.mode === 'boss';
    // The DATAMOSH visuals/math belong to Glitch World (id 15) ONLY. Other
    // 'gauntlet'-kind hidden worlds (e.g. King Coli, id 17) are normal-art boss
    // fights — they must NOT inherit the glitch corruption/colors/problems.
    this.isGlitchBoss = this.isBoss && this.worldId === 15;
    this.freePlay = !!this.registry.get('freePlay');

    // Arcade modes (Endless, Boss Rush) run on THIS engine. The launcher scenes
    // set arcadeMode + arcadeState in the registry. Treat arcade like free play
    // (no warp asteroids, no progression writes), then short-circuit the
    // campaign endRound/failLevel into the arcade handlers below. arcadeState
    // carries cumulative run data across the per-boss scene.restart()s.
    this.arcadeMode = this.registry.get('arcadeMode') || null;
    this.arcadeState = this.registry.get('arcadeState') || null;
    if (this.arcadeMode) this.freePlay = true;
    // The Tune-Up (spaced-repetition review) rides the arcade short-circuit so no
    // campaign progression runs; it only differs in fact selection (100% due/rusty
    // facts) and its results copy. Untimed, ends on ship loss like Endless.
    this.reviewMode = this.arcadeMode === 'review';

    // Hidden-world warp asteroid: when the kid plays a host level (e.g. W5
    // div) for the first time, a warp asteroid will spawn ~30-45s in. State
    // moves null → 'pending' → 'ready' → 'spawned'. Suppressed for boss,
    // free-play, hidden-world replays, and already-discovered hosts.
    this.warpTargetId = null;
    this.warpState = null;
    if (!this.isBoss && !this.freePlay && !this.world?.hidden) {
      const hidden = getHiddenWorldForHost(this.worldId, this.mode);
      if (hidden && !progress.isHiddenWorldDiscovered(hidden.id)) {
        this.warpTargetId = hidden.id;
        this.warpState = 'pending';
      }
    }
    this.bossMaxHp = getBossHpForWorld(this.worldId);
    if (this.arcadeMode === 'bossRush') this.bossMaxHp = ARCADE_BOSS_HP;

    this.modeConfig = this.isBoss
      ? { label: this.world.villain || 'Boss', symbol: this.isGlitchBoss ? 'glitch' : 'skull', duration: getBossDurationForWorld(this.worldId), scoreThreshold: this.bossMaxHp }
      : MODES[this.mode];

    this.duration = this.modeConfig.duration;
    this.scoreThreshold = this.modeConfig.scoreThreshold;
    this.timeLeft = this.duration * 1000;
    // Adaptive fall speed: Chapter 2 worlds + Arcade self-level to the kid's
    // measured pace (pushes ~10% faster than comfort). Chapter 1 keeps its
    // original hand-designed speed curve.
    if (this.world?.chapter === 2 || this.arcadeMode) {
      this.problemSeconds = getAdaptiveProblemSeconds(this.worldId, this.mode, records.getPaceMs());
    } else {
      // Chapter 1 keeps its hand-tuned curve for capable kids, but never gives a
      // SLOWER kid a fall window shorter than their measured recall — otherwise
      // the fast fixed windows (W9-11: 4.0/3.5/3.0s) time out every problem and
      // the mastery gate becomes unreachable. getComfortableProblemSeconds returns
      // 0 at cold start and stays below the designed window for fast kids, so the
      // original curve is unchanged for them; it only ever ADDS time for a slow kid.
      this.problemSeconds = Math.max(
        getProblemSecondsForWorldAndMode(this.worldId, this.mode),
        getComfortableProblemSeconds(this.worldId, this.mode, records.getPaceMs())
      );
    }

    this.score = 0;
    this.correctAnswers = 0;
    this.attempts = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.stardustEarned = 0;
    this.history = [];
    this.pendingEvolution = null;

    // Boss Rush carries one ship's HP across the whole 5-boss gauntlet.
    this.shipHp = (this.arcadeMode === 'bossRush' && this.arcadeState)
      ? (this.arcadeState.shipHp ?? SHIP_HP_MAX)
      : SHIP_HP_MAX;
    this.asteroidSlots = this.isBoss ? 1 : getAsteroidCountForWorld(this.worldId);

    this.bossHp = this.bossMaxHp;
    this.bossDefeated = false;

    this.activeAsteroids = [];
    this.targetedAsteroid = null;

    // Seed the state machine directly (not via setState): init() is the reset
    // point, and on a Phaser scene restart `this.state` still holds the prior
    // run's terminal value — routing that through setState would warn on a
    // (terminal → ready) "transition" that is really a fresh start.
    this.state = 'ready';
  }

  // The ONLY way to change round phase. Validates against ROUND_TRANSITIONS and
  // logs (without crashing) any edge the table doesn't allow — an illegal
  // transition firing means a caller is wrong, so fix the caller, not the table.
  setState(next) {
    const from = this.state;
    if (from === next) return;
    if (!ROUND_TRANSITIONS[from]?.includes(next)) {
      console.warn(`[GameScene] illegal round transition ${from} -> ${next}`);
    }
    this.state = next;
  }

  create() {
    audio.init();
    // Chapter 2 prefers its bespoke Inner Space tracks; resolveTrack falls back
    // to the Chapter 1 themes until those MP3s ship, so the chapter is never
    // silent. Crossfade in so map→level→boss transitions don't hard-cut.
    const isCh2 = this.world?.chapter === 2;
    const musicKey = this.isBoss
      ? (isCh2 ? music.resolveTrack(this, 'innerSpaceBoss', 'bossTheme') : 'bossTheme')
      : (isCh2 ? music.resolveTrack(this, 'innerSpaceLevel', 'levelTheme') : 'levelTheme');
    music.fadeToTrack(this, musicKey);
    this._bossEscalated = false;
    // Pitch the level theme per-world; boss theme stays unmodified so boss
    // fights read distinctly regardless of world.
    if (!this.isBoss) {
      const rate = getWorldMusicRate(this.worldId);
      music.setPlaybackRate(rate, 600);
    } else {
      music.setPlaybackRate(1.0, 0);
    }
    if (this.isGlitchBoss) this.startGlitchAmbientLoop();
    const wb = getWorldBackground(this.worldId);
    createStarfield(this, {
      width: W, height: H,
      bgTopColor: wb.bgTop,
      bgBottomColor: wb.bgBottom,
      accentColor: this.world.accentColor,
      accentStrength: 0.18
    });

    createTopBar(this, TOP_BAR_H);
    this.createPlayArea();
    this.createMcButtons();

    if (this.arcadeMode) this._setupArcadeHud();

    this._onKeyDown = this.onKeyDown.bind(this);
    this.input.keyboard?.on('keydown', this._onKeyDown);
    this.events.once('shutdown', () => {
      this.input.keyboard?.off('keydown', this._onKeyDown);
      // If we tear down while the pause menu still has the clock/tweens/physics
      // paused (any exit path that bypasses the Resume handler), restore them so
      // the next scene reusing this instance doesn't inherit a frozen clock —
      // Phaser's Clock.start() does NOT reset `paused` on restart.
      this._resumePausedSystems();
    });

    new TransitionManager(this).fadeIn(280);

    if (this.isBoss) {
      this.setState('intro');
      applyBossTwist(this, this.world.id);
      import('../BossIntro.js').then(({ playBossIntro }) => {
        playBossIntro(this, this.world.id, () => {
          if (!this.scene.isActive()) return;
          audio.playBossRumble?.();
          this.cameras.main.flash(280, 90, 0, 0);
          this.cameras.main.shake(420, 0.008);
          this.setState('playing');
          this.spawnAsteroid();
        });
      });
    } else {
      this.setState('playing');
      this.time.delayedCall(0, () => {
        if (this._isOver()) return;
        this.spawnAsteroid();
      });

      if (this.warpState === 'pending') {
        const delay = 28000 + Math.floor(Math.random() * 12000);
        this.time.delayedCall(delay, () => {
          if (this._isOver()) return;
          if (this.warpState === 'pending') this.warpState = 'ready';
        });
      }

      // First-time-player nudge: short hint near the answer buttons.
      // Auto-dismisses on the first correct answer. Skipped in arcade modes
      // (only reachable post-game, so the tutorial is long done).
      if (!progress.tutorialSeen && !this.arcadeMode) {
        this.time.delayedCall(900, () => {
          if (this._isOver()) return;
          this.showTutorialHint();
        });
      }
    }
  }

  showTutorialHint() {
    if (this._tutorialHint) return;
    // Two body-size lines in a box sized from the text. The box sits over the
    // ship and its bottom (with the 5% pulse) stays clear of the answer grid.
    const c = this.add.container(W / 2, H - 574).setDepth(50);
    const line1 = this.add.text(0, 0, 'Tap the matching answer', style('subhead', {
      fontSize: '42px',
      fill: '#ffd86b',
      fontStyle: '900'
    })).setOrigin(0.5);
    const line2 = this.add.text(0, 0, 'to crunch the asteroid', style('body', {
      fontSize: '42px',
      fill: '#e0e0ef'
    })).setOrigin(0.5);
    const padX = 48;
    const padY = 16;
    const boxW = Math.ceil(Math.max(line1.width, line2.width)) + padX * 2;
    const boxH = Math.ceil(line1.height + line2.height) + padY * 2;
    line1.y = -boxH / 2 + padY + line1.height / 2;
    line2.y = line1.y + line1.height / 2 + line2.height / 2;
    const bg = this.add.graphics();
    bg.fillStyle(0x12122a, 0.92);
    bg.fillRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 18);
    bg.lineStyle(3, 0xffd86b, 1);
    bg.strokeRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 18);
    c.add(bg);
    c.add(line1);
    c.add(line2);
    // Gentle pulse to draw the eye.
    this.tweens.add({
      targets: c,
      scale: { from: 1, to: 1.05 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    this._tutorialHint = c;
  }

  dismissTutorialHint() {
    if (!this._tutorialHint) return;
    const c = this._tutorialHint;
    this._tutorialHint = null;
    progress.markTutorialSeen();
    this.tweens.add({
      targets: c,
      alpha: 0, scale: 0.9,
      duration: 300,
      onComplete: () => c.destroy()
    });
  }

  setHp(newHp) {
    this.shipHp = Math.max(0, newHp);
    this.hpIcons.forEach((icon, i) => {
      const filled = i < this.shipHp;
      if (icon.fullColor !== filled) {
        icon.fullColor = filled;
        icon.heart.clear();
        drawHeartIcon(icon.heart, 0, 0, 28, filled);
        if (!filled) {
          this.tweens.add({
            targets: icon,
            scale: { from: 1.5, to: 1 },
            duration: 250,
            ease: 'Back.easeOut'
          });
        }
      }
    });
  }

  formatTime(ms) {
    const totalS = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalS / 60);
    const s = totalS % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ============================================================
  // PLAY AREA — ship at bottom, asteroids drifting in
  // ============================================================
  createPlayArea() {
    // Per-world horizon silhouette behind asteroids/ship.
    const wb = getWorldBackground(this.worldId);
    wb.drawHorizon(this, { width: W, y: ASTEROID_IMPACT_Y + 24, world: this.world });

    this.shipContainer = this.add.container(W / 2, SHIP_Y).setDepth(8);
    this.shipG = drawShip(this, 0, 0, {
      scale: 1.8,
      parts: progress.ship?.parts
    });
    this.shipContainer.add(this.shipG);

    if (companion.hasStarter()) {
      const pc = this.shipG.portholeCenter;
      this.cockpitPet = drawCompanion(this, pc.x, pc.y, { scale: 0.7 });
      this.shipG.add(this.cockpitPet);
    }

    this.startShipBob();
    this.initExplosionPool();
  }

  // Pre-allocate graphics for explosion shards/chunks/flashes so we never
  // construct mid-frame during the celebration. _freeFxIndexes is a stack of
  // pool indices ready for reuse; if it empties the pool lazily extends.
  initExplosionPool() {
    this._explosionPool = [];
    this._freeFxIndexes = [];
    for (let i = 0; i < 48; i++) {
      const g = this.add.graphics().setDepth(9);
      g.setActive(false).setVisible(false);
      g._poolIndex = i;
      this._explosionPool.push(g);
      this._freeFxIndexes.push(i);
    }
  }

  _acquireFxGraphic() {
    const free = this._freeFxIndexes;
    if (free && free.length) {
      const g = this._explosionPool[free.pop()];
      if (g.scene) {
        g.setActive(true).setVisible(true);
        g.clear();
        g.setAlpha(1);
        g.setScale(1);
        g.setAngle(0);
        g.setPosition(0, 0);
        g.setBlendMode(Phaser.BlendModes.NORMAL);
        return g;
      }
    }
    const g = this.add.graphics().setDepth(9);
    if (this._explosionPool) {
      g._poolIndex = this._explosionPool.length;
      this._explosionPool.push(g);
    }
    return g;
  }

  _releaseFxGraphic(g) {
    if (!g || !g.scene) return;
    g.setActive(false).setVisible(false);
    if (this._freeFxIndexes && g._poolIndex !== undefined) {
      this._freeFxIndexes.push(g._poolIndex);
    }
  }

  // ============================================================
  // ASTEROIDS
  // ============================================================
  // Shared falling-asteroid tween: every spawn/cycle path drops the asteroid to
  // `targetY` over `durationMs` and fires the impact on arrival. Centralizing the
  // ease + onComplete wiring keeps the four call sites from drifting apart.
  _startAsteroidFall(asteroid, targetY, durationMs) {
    asteroid.fallTween = this.tweens.add({
      targets: asteroid.container,
      y: targetY,
      duration: durationMs,
      ease: 'Linear',
      onComplete: () => this.onAsteroidImpact(asteroid)
    });
  }

  spawnAsteroid() {
    if (this._isOver()) return;
    if (this.bossDefeated) return;
    if (this.activeAsteroids.length >= this.asteroidSlots) return;

    if (this.warpState === 'ready') {
      this.warpState = 'spawned';
      this.spawnWarpAsteroid();
      return;
    }

    // Decide variants up front so the rest of the function reads top-down.
    // Mini-boss and stardust share the "special spawn" slot — never both on
    // the same asteroid. Boss spawns and warp spawns are excluded entirely.
    // A Tune-Up (review mode) is a clean, focused field of plain review asteroids —
    // no mini-boss/stardust variants, so "Facts refreshed" reflects facts answered.
    let isMiniBoss = false;
    let isStardust = false;
    if (!this.isBoss && !this.reviewMode) {
      if (this.worldId >= UPPER_LEVEL_CONFIG.miniBoss.minWorldId) {
        this._miniBossCounter = (this._miniBossCounter || 0) + 1;
        if (this._miniBossCounter % UPPER_LEVEL_CONFIG.miniBoss.oneIn === 0) {
          isMiniBoss = true;
        }
      }
      if (!isMiniBoss && this.worldId >= UPPER_LEVEL_CONFIG.stardust.minWorldId) {
        this._stardustCounter = (this._stardustCounter || 0) + 1;
        if (this._stardustCounter % UPPER_LEVEL_CONFIG.stardust.oneIn === 0) {
          isStardust = true;
        }
      }
    }

    // Mini-boss / stardust use the untwisted problem so the special visual
    // marker isn't competing with a twist overlay. Regular upper-world spawns
    // roll for a twist via getTwistedProblem.
    const problem = this.reviewMode
      ? getReviewProblem(this.worldId, this.mode)
      : this.isGlitchBoss
        ? getGlitchProblem()
        : (this.isBoss || isMiniBoss || isStardust)
          ? getProblemForWorld(this.worldId, this.mode)
          : getTwistedProblem(this.worldId, this.mode);

    const radius = isMiniBoss ? ASTEROID_RADIUS * 1.6 : ASTEROID_RADIUS;

    const xLane = W / 2 + Phaser.Math.Between(-60, 60);
    const container = this.add.container(xLane, ASTEROID_TOP_Y).setDepth(7);

    // Stardust halo + orbiting sparkles sit behind the body so the gold ring
    // frames the question instead of obscuring it.
    let stardustParts = null;
    if (isStardust) {
      stardustParts = this._attachStardustHalo(container, radius);
    }

    if (this.isBoss) {
      this.drawBossBody(container);
    } else {
      this.drawAsteroidBody(container, radius);
    }

    // Twist overlay sits in front of the body but behind text. Flare pulses.
    if (problem?.twistKind) {
      const overlay = this.add.graphics();
      drawTwistOverlay(overlay, problem.twistKind, radius);
      container.add(overlay);
      if (problem.twistKind === 'flare') {
        this.tweens.add({
          targets: overlay,
          alpha: { from: 0.6, to: 1 },
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      } else if (problem.twistKind === 'mirror') {
        // Subtle shimmer cycle on the cyan seam.
        this.tweens.add({
          targets: overlay,
          alpha: { from: 0.7, to: 1 },
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }

    const fontSize = this.isGlitchBoss
      ? '80px'
      : this.isBoss
        ? '92px'
        : isMiniBoss
          ? '82px'
          : '70px';
    const text = this.add.text(0, 0, problem.display, style('display', {
      fontSize,
      fill: '#ffffff',
      stroke: this.isGlitchBoss ? '#ff00ff' : '#000000',
      strokeThickness: this.isGlitchBoss ? 8 : 7
    })).setOrigin(0.5);
    container.add(text);

    // Mini-boss HP pips sit ABOVE the asteroid so the kid sees the fight
    // state at a glance.
    let miniBossPips = null;
    if (isMiniBoss) {
      miniBossPips = this.add.graphics();
      drawMiniBossPips(miniBossPips, UPPER_LEVEL_CONFIG.miniBoss.hp, UPPER_LEVEL_CONFIG.miniBoss.hp, radius);
      container.add(miniBossPips);
    }

    this.tweens.add({
      targets: container,
      angle: this.isBoss ? Phaser.Math.Between(-3, 3) : Phaser.Math.Between(-6, 6),
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const asteroid = {
      container,
      text,
      problem,
      // Per-asteroid lifecycle: falling → impactGrace → resolving → gone.
      // Answerable iff phase ∈ {falling, impactGrace}. Single source of truth —
      // replaces the old lockedOut/impactPending flag soup (see spec §2c).
      phase: 'falling',
      fallTween: null,
      startedAtMs: performance.now(),
      isBoss: this.isBoss,
      _isStardust: isStardust,
      _isMiniBoss: isMiniBoss,
      _miniHp: isMiniBoss ? UPPER_LEVEL_CONFIG.miniBoss.hp : 0,
      _miniBossPips: miniBossPips,
      _radius: radius,
    };

    const fallSeconds = isMiniBoss
      ? this.problemSeconds * UPPER_LEVEL_CONFIG.miniBoss.fallMultiplier
      : this.problemSeconds;
    this._startAsteroidFall(asteroid, this.isBoss ? ASTEROID_IMPACT_Y - 80 : ASTEROID_IMPACT_Y, fallSeconds * 1000);

    if (this.isBoss) {
      this.attachBossHpBar(container);
      bossTwistOn(this, 'onSpawn', asteroid);
    }

    this.activeAsteroids.push(asteroid);
    this.targetAsteroid(asteroid);
  }

  // Gold halo + 6 orbiting sparkles behind a stardust asteroid. Returns the
  // created parts so removeAsteroid can stop the orbital tweens cleanly.
  _attachStardustHalo(container, radius) {
    const halo = this.add.graphics();
    drawStardustHalo(halo, radius);
    container.add(halo);
    this.tweens.add({
      targets: halo,
      angle: 360,
      duration: 6000,
      repeat: -1,
      ease: 'Linear',
    });

    const sparkles = [];
    const sparkleCount = 6;
    const orbitR = radius * 1.30;
    for (let i = 0; i < sparkleCount; i++) {
      const sp = this.add.graphics();
      sp.fillStyle(0xfff3b8, 1);
      sp.fillCircle(0, 0, 5);
      const a = (i / sparkleCount) * Math.PI * 2;
      sp.x = Math.cos(a) * orbitR;
      sp.y = Math.sin(a) * orbitR;
      container.add(sp);
      sparkles.push(sp);
      this.tweens.add({
        targets: sp,
        alpha: { from: 0.4, to: 1 },
        duration: 500 + i * 80,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    return { halo, sparkles };
  }

  drawBossBody(container) {
    const radius = ASTEROID_RADIUS * BOSS_CONFIG.asteroidScale;
    if (this.isGlitchBoss) {
      const g = this.add.graphics();
      container.add(g);
      this.datamoshG = g;
      this.datamoshRadius = radius;
      this.datamoshSeed = 0;
      this.redrawDatamoshBlob(this.bossHp / this.bossMaxHp);
      this.datamoshJitter = this.time.addEvent({
        delay: 220, loop: true,
        callback: () => {
          if (!this.datamoshG?.active || this.bossDefeated) {
            this.datamoshJitter?.remove();
            this.datamoshJitter = null;
            return;
          }
          this.datamoshSeed = (this.datamoshSeed + 1) % 16;
          this.redrawDatamoshBlob(this.bossHp / this.bossMaxHp);
        }
      });
      this.events.once('shutdown', () => this.datamoshJitter?.remove());
      return;
    }
    const g = this.add.graphics();
    drawWorldBoss(g, this.world.id, this.world.accentColor, radius);
    container.add(g);
  }

  redrawDatamoshBlob(hpRatio) {
    if (!this.datamoshG?.active) return;
    this.datamoshG.clear();
    drawDatamoshBlob(this.datamoshG, hpRatio, this.datamoshRadius, this.datamoshSeed);
  }

  attachBossHpBar(bossContainer) {
    const bar = this.add.container(bossContainer.x, bossContainer.y - ASTEROID_RADIUS * BOSS_CONFIG.asteroidScale - 70)
      .setDepth(8);
    const w = 520;
    const h = 38;
    const radius = h / 2;

    // Soft drop shadow
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.5);
    shadow.fillRoundedRect(-w / 2 + 1, -h / 2 + 5, w, h, radius);
    bar.add(shadow);

    // Track with inset depth
    const track = this.add.graphics();
    track.fillStyle(0x1a0a18, 1);
    track.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    track.fillStyle(COLORS.bgDark, 0.7);
    track.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.32, {
      tl: radius - 2, tr: radius - 2, bl: 6, br: 6
    });
    track.lineStyle(2, 0xff8080, 0.85);
    track.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
    bar.add(track);

    const fill = this.add.graphics();
    bar.add(fill);
    bar.fillG = fill;
    bar.barW = w;
    bar.barH = h;
    bar.barRadius = radius;

    // Outlined so the name holds up over any world backdrop. update() keeps
    // it hidden while the bar is still under the top bar.
    bar.nameText = this.add.text(0, -h / 2 - 8, (this.world.villain || 'BOSS').toUpperCase(), style('caption', {
      fontSize: '36px', fill: '#ff8080', fontStyle: '900',
      stroke: '#0a0a1a', strokeThickness: 5
    })).setOrigin(0.5, 1);
    bar.add(bar.nameText);

    this.bossHpBar = bar;
    this.bossContainer = bossContainer;
    this.drawBossHp();
  }

  drawBossHp() {
    if (!this.bossHpBar) return;
    const { fillG, barW, barH, barRadius } = this.bossHpBar;
    fillG.clear();
    const pct = Math.max(0, this.bossHp / this.bossMaxHp);
    if (pct <= 0) return;
    const fillW = Math.max(barH, Math.floor(barW * pct));
    const color = pct > 0.5 ? COLORS.error : pct > 0.25 ? 0xffaa44 : 0xff3030;
    const lighten = Phaser.Display.Color.ValueToColor(color).lighten(35).color;
    const darken = Phaser.Display.Color.ValueToColor(color).darken(25).color;

    // Body
    fillG.fillStyle(color, 1);
    fillG.fillRoundedRect(-barW / 2, -barH / 2, Math.min(fillW, barW), barH, barRadius);
    // Bottom shadow band
    fillG.fillStyle(darken, 0.5);
    fillG.fillRoundedRect(-barW / 2, -barH / 2 + barH * 0.55, Math.min(fillW, barW), barH * 0.45, {
      tl: 0, tr: 0, bl: barRadius, br: barRadius
    });
    // Top gloss
    fillG.fillStyle(lighten, 0.55);
    fillG.fillRoundedRect(-barW / 2 + 4, -barH / 2 + 4, Math.max(0, Math.min(fillW, barW) - 8), barH * 0.38, {
      tl: barRadius - 2, tr: barRadius - 2, bl: 4, br: 4
    });
    // Quartile dividers — readable regardless of total HP.
    fillG.lineStyle(2, COLORS.bgDark, 0.55);
    for (let i = 1; i < 4; i++) {
      const x = -barW / 2 + (barW / 4) * i;
      if (x - (-barW / 2) <= fillW) {
        fillG.lineBetween(x, -barH / 2 + 4, x, barH / 2 - 4);
      }
    }
  }

  drawAsteroidBody(container, radius = ASTEROID_RADIUS) {
    const g = this.add.graphics();
    drawQuestionBody(g, this.world.id, radius);
    container.add(g);
  }

  isAnswerableAsteroid(asteroid) {
    return !!(
      asteroid &&
      this.activeAsteroids.includes(asteroid) &&
      (asteroid.phase === 'falling' || asteroid.phase === 'impactGrace') &&
      asteroid.container?.active
    );
  }

  getAnswerableAsteroid() {
    return this.activeAsteroids.find(a => this.isAnswerableAsteroid(a)) || null;
  }

  targetAsteroid(asteroid) {
    if (!this.isAnswerableAsteroid(asteroid)) return;
    this.targetedAsteroid = asteroid;
    this.refreshMcButtons(asteroid.problem);
  }

  // ============================================================
  // MC BUTTONS — 4 for normal, 6 for boss
  // ============================================================
  createMcButtons() {
    const buttonCount = this.isBoss ? BOSS_CONFIG.buttonCount : 4;
    const cols = this.isBoss ? 3 : 2;
    const rows = Math.ceil(buttonCount / cols);
    const cellW = this.isBoss ? 320 : 480;
    const cellH = this.isBoss ? 150 : 170;
    const gap = 24;
    const totalW = cols * cellW + (cols - 1) * gap;
    const totalH = rows * cellH + (rows - 1) * gap;
    const startX = (W - totalW) / 2 + cellW / 2;
    const startY = H - 60 - totalH;

    this.mcButtons = [];
    for (let i = 0; i < buttonCount; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = startX + c * (cellW + gap);
      const y = startY + r * (cellH + gap) + cellH / 2;
      this.mcButtons.push(this.makeMcButton(x, y, cellW, cellH, i));
    }
  }

  makeMcButton(x, y, w, h, index) {
    const c = this.add.container(x, y).setDepth(10);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.5);
    shadow.fillRoundedRect(-w / 2 + 2, -h / 2 + 8, w, h, 28);
    c.add(shadow);

    const bg = this.add.graphics();
    c.add(bg);

    const label = this.add.text(0, 0, '', style('display', {
      fontSize: '72px',
      fill: '#ffffff'
    })).setOrigin(0.5);
    c.add(label);

    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
    c.add(hit);
    hit.on('pointerover', () => {
      if (!this._buttonsActive()) return;
      this.tweens.add({ targets: c, scale: 1.04, duration: 110 });
    });
    hit.on('pointerout', () => {
      this.tweens.add({ targets: c, scale: 1, duration: 110 });
    });
    hit.on('pointerdown', () => {
      // Two-tier gate: state must permit input AND there must actually be an
      // asteroid to answer right now. Without the second check, the kid can
      // tap during the 220ms post-correct gap (state still 'feedback', asteroid
      // locked, no fresh spawn yet) and see the press animation play with no
      // game response — which reads exactly as "unclickable answers".
      if (!this._buttonsActive()) return;
      this.tweens.add({ targets: c, scaleX: 0.94, scaleY: 0.94, duration: 70, yoyo: true });
      this.handleMcChoice(index);
    });

    c.bg = bg;
    c.label = label;
    c.dimensions = { w, h };
    c.value = null;
    this.drawMcFace(c, this.isBoss ? 0x3a1a2a : 0x2a2a44);
    return c;
  }

  drawMcFace(container, color) {
    const { w, h } = container.dimensions;
    const radius = 26;
    const lighter = lighten(color, 0.18);
    const darker = darken(color, 0.20);

    container.bg.clear();
    container.bg.fillStyle(darker, 1);
    container.bg.fillRoundedRect(-w / 2, -h / 2 + 4, w, h - 4, radius);
    container.bg.fillStyle(color, 1);
    container.bg.fillRoundedRect(-w / 2, -h / 2, w, h - 6, radius);
    container.bg.fillStyle(lighter, 0.45);
    container.bg.fillRoundedRect(-w / 2 + 4, -h / 2 + 3, w - 8, (h - 6) / 2.4,
      { tl: radius - 2, tr: radius - 2, bl: 4, br: 4 });
    container.bg.lineStyle(2, 0x000000, 0.25);
    container.bg.strokeRoundedRect(-w / 2, -h / 2, w, h - 6, radius);
  }

  refreshMcButtons(problem) {
    const want = this.mcButtons.length;
    let choices;
    if (problem.glitchChoices) {
      // Glitch boss with a pre-built choice pool (hidden-digit / hidden-operand).
      choices = [...problem.glitchChoices];
      while (choices.length < want) choices.push((choices[choices.length - 1] ?? 0) + 1);
      choices = choices.slice(0, want);
    } else if (problem.twistDistractors) {
      // Gravity-twist (`? × N = product`) — answer is the missing factor;
      // distractors are pre-built factor-aware (other factors of the product,
      // off-by-one slips, the visible factor as a kid-trap).
      choices = [problem.answer, ...problem.twistDistractors].slice(0, want);
      while (choices.length < want) choices.push(problem.answer + choices.length);
      choices.sort((a, b) => a - b);
    } else {
      const distractors = getDistractors(problem, want - 1);
      choices = [problem.answer, ...distractors].slice(0, want);
      while (choices.length < want) choices.push(problem.answer + choices.length);
      choices.sort((a, b) => a - b);
    }

    const seen = new Set();
    choices = choices.filter(v => Number.isFinite(v) && !seen.has(v) && seen.add(v));
    if (!choices.includes(problem.answer)) choices.unshift(problem.answer);
    let pad = 1;
    while (choices.length < want) {
      const candidate = problem.answer + pad;
      if (candidate > 0 && !choices.includes(candidate)) choices.push(candidate);
      pad = pad > 0 ? -pad : -pad + 1;
    }
    choices = choices.slice(0, want);
    if (!choices.includes(problem.answer)) choices[want - 1] = problem.answer;
    choices.sort((a, b) => a - b);

    const faceColor = this.isGlitchBoss ? 0x1a3a14 : this.isBoss ? 0x3a1a2a : 0x2a2a44;
    this.mcButtons.forEach((btn, i) => {
      btn.value = choices[i];
      btn.label.setText(choices[i].toString());
      btn.label.setColor('#ffffff');
      this.drawMcFace(btn, faceColor);
      btn.setAlpha(1);
    });
  }

  flashMcButton(btn, color) {
    const { w, h } = btn.dimensions;
    const flash = this.add.graphics();
    flash.fillStyle(color, 0.7);
    flash.fillRoundedRect(-w / 2, -h / 2, w, h - 6, 26);
    btn.add(flash);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 320,
      onComplete: () => flash.destroy()
    });
  }

  // ============================================================
  // INPUT
  // ============================================================
  // Input is allowed during 'playing' and 'feedback'; the 'feedback' window
  // is the 220+180ms after a correct answer where the previous asteroid is
  // still exploding. In multi-slot worlds the kid needs to keep tapping the
  // remaining asteroids during that window — the just-answered one is already
  // in phase 'resolving' (not answerable), which prevents double-credit.
  _inputUnlocked() {
    return !this._pauseOpen && (this.state === 'playing' || this.state === 'feedback');
  }

  // True when MC buttons should respond. Distinct from _inputUnlocked: even
  // when state allows input, there must be a live asteroid the kid can actually
  // answer. This is the gate the per-button pointerdown checks so taps during
  // the post-correct cleanup window read as "wait" rather than "broken".
  _buttonsActive() {
    return this._inputUnlocked() && !!this.getAnswerableAsteroid();
  }

  // Visually dim MC buttons when no asteroid is answerable. Called from
  // update() — the kid sees the buttons fade slightly during the post-correct
  // / correction cleanup window so the lack of response is obviously
  // intentional, not a tap that got dropped.
  _refreshMcButtonsDim() {
    const active = this._buttonsActive();
    if (this._mcButtonsActiveCache === active) return;
    this._mcButtonsActiveCache = active;
    const targetAlpha = active ? 1 : 0.45;
    this.mcButtons?.forEach(btn => {
      if (btn?.active) btn.setAlpha(targetAlpha);
    });
  }

  onKeyDown(event) {
    if (!this._inputUnlocked()) return;
    const map = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5 };
    const idx = map[event.key];
    if (idx !== undefined && idx < this.mcButtons.length) {
      this.handleMcChoice(idx);
    }
  }

  handleMcChoice(index) {
    if (!this._inputUnlocked()) return;
    const btn = this.mcButtons[index];
    if (!btn || btn.value === null) return;
    let asteroid = this.targetedAsteroid;
    if (!this.isAnswerableAsteroid(asteroid)) {
      asteroid = this.getAnswerableAsteroid();
      if (!asteroid) return;
      this.targetAsteroid(asteroid);
    }

    const correct = btn.value === asteroid.problem.answer;
    if (correct) {
      this.handleCorrect(asteroid, btn);
    } else {
      this.handleWrong(asteroid, btn);
    }
  }

  // ============================================================
  // ANSWER FLOW
  // ============================================================
  handleCorrect(asteroid, btn) {
    asteroid.phase = 'resolving';
    if (asteroid.fallTween) asteroid.fallTween.stop();
    this.setState('feedback');
    this.attempts++;
    if (this._tutorialHint) this.dismissTutorialHint();
    const elapsed = performance.now() - asteroid.startedAtMs;
    this.history.push({ problem: asteroid.problem, userAnswer: btn.value, correct: true });
    progress.recordFactAttempt(asteroid.problem.a, asteroid.problem.b, true, elapsed);
    records.recordAnswer(asteroid.problem, true, elapsed);

    this.score++;
    this.correctAnswers++;
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.scoreText.setText(this.score.toString());
    this.streakHUD?.setStreak(this.streak);

    this.flashMcButton(btn, COLORS.success);

    this.cockpitPet?.bounceHappy?.();
    const evolvedTo = companion.feed();
    if (evolvedTo && !this.pendingEvolution) {
      this.pendingEvolution = evolvedTo;
    }
    if (this.streak === 3 || this.streak === 7 || this.streak % 10 === 0) {
      audio.playPetChirp?.();
    }

    audio.playLaser?.();
    this.fireLaserAt(asteroid);

    if (asteroid._isWarp) {
      // Successful warp: tear down the gateway asteroid without re-arming
      // (rearmWarp:false — we consumed it) and without spawning a replacement;
      // triggerWarp owns the scene swap and sets state='warp'. No ordering
      // trick: the re-arm decision is explicit intent, not a state read.
      this.teardownAsteroid(asteroid, { rearmWarp: false });
      this.triggerWarp(asteroid);
      return;
    }

    if (asteroid.isBoss) {
      this.bossHp = Math.max(0, this.bossHp - 1);
      // Commit the win on the final answer. The impact animation must not let
      // the countdown turn an already defeated boss into a timeout.
      if (this.bossHp === 0) this.bossDefeated = true;
      this.drawBossHp();
      // Big-fight panic: speed the boss theme up once for the final third of HP.
      // Reserved for the grand finale (Patient Zero, W28) and the King Coli
      // superboss (W17) so smaller fights stay steady.
      if ((this.worldId === 28 || this.worldId === 17) && !this._bossEscalated
        && this.bossHp > 0 && this.bossHp <= this.bossMaxHp / 3) {
        this._bossEscalated = true;
        music.setPlaybackRate(1.06, 1500);
      }
      audio.playBossImpact?.();
      this.recoilBoss(asteroid);
      if (this.isGlitchBoss) {
        this.redrawDatamoshBlob(this.bossHp / this.bossMaxHp);
      }
      bossTwistOn(this, 'onCorrect', asteroid);

      this.time.delayedCall(360, () => {
        if (this._isOver()) return;
        if (this.bossHp <= 0) {
          this.defeatBoss(asteroid);
        } else {
          this.cycleBossProblem(asteroid);
          this.setState('playing');
        }
      });
      return;
    }

    // Mini-boss persistence: not the final hit — knock off a pip, shrink,
    // and cycle to a new problem instead of removing the asteroid.
    if (asteroid._isMiniBoss && asteroid._miniHp > 1) {
      asteroid._miniHp -= 1;
      if (asteroid._miniBossPips) {
        drawMiniBossPips(asteroid._miniBossPips, asteroid._miniHp, UPPER_LEVEL_CONFIG.miniBoss.hp, asteroid._radius);
      }
      this.cameras.main.shake(120, 0.005);
      this.tweens.add({
        targets: asteroid.container,
        scaleX: { from: 1, to: 0.92 },
        scaleY: { from: 1, to: 0.92 },
        duration: 200,
        yoyo: true,
        ease: 'Sine.easeInOut',
      });
      this.time.delayedCall(320, () => {
        if (this._isOver()) return;
        this.cycleAsteroidProblem(asteroid);
      });
      return;
    }

    // Bonus scoring for special asteroids' final-kill / flare hits. Stardust
    // and final-hit mini-boss BOTH count as the same payout slot; flare is a
    // separate tiny bonus that can stack with everything.
    if (asteroid._isStardust) {
      this.score += UPPER_LEVEL_CONFIG.stardust.bonusScore;
      this.streak += UPPER_LEVEL_CONFIG.stardust.bonusStreak;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.scoreText.setText(this.score.toString());
      this.streakHUD?.setStreak(this.streak);
      audio.playPetChirp?.();
    }
    if (asteroid._isMiniBoss) {
      this.score += UPPER_LEVEL_CONFIG.miniBoss.bonusScore;
      this.scoreText.setText(this.score.toString());
      this.cameras.main.shake(250, 0.012);
    }
    if (asteroid.problem?.twistKind === 'flare') {
      this.score += 1;
      this.scoreText.setText(this.score.toString());
    }

    this.time.delayedCall(220, () => {
      audio.playAsteroidBoom?.();
      this.explodeAsteroid(asteroid, { big: true });
      this.teardownAsteroid(asteroid, { thenSpawn: true });
    });
  }

  // Mini-boss problem cycle. Resumes the fall from the asteroid's current Y
  // (does NOT teleport to top), swaps in a fresh problem, and re-targets so
  // the answer buttons reflect the new value. Subsequent problems on a
  // mini-boss are untwisted to keep the HP-pip story uncluttered.
  cycleAsteroidProblem(asteroid) {
    if (!asteroid?.container?.active) return;
    if (this._isOver()) return;
    if (asteroid.fallTween) asteroid.fallTween.stop();
    asteroid.phase = 'falling';

    const newProblem = this.reviewMode
      ? getReviewProblem(this.worldId, this.mode)
      : getProblemForWorld(this.worldId, this.mode);
    asteroid.problem = newProblem;
    asteroid.startedAtMs = performance.now();
    asteroid.text?.setText(newProblem.display);

    const fallSeconds = this.problemSeconds * (asteroid._isMiniBoss ? UPPER_LEVEL_CONFIG.miniBoss.fallMultiplier : 1);
    const fullFall = ASTEROID_IMPACT_Y - ASTEROID_TOP_Y;
    const remainingFall = Math.max(40, ASTEROID_IMPACT_Y - asteroid.container.y);
    const remainingMs = Math.max(800, fallSeconds * 1000 * (remainingFall / fullFall));
    this._startAsteroidFall(asteroid, ASTEROID_IMPACT_Y, remainingMs);

    this.refreshMcButtons(newProblem);
    this.setState('playing');
    this.targetAsteroid(asteroid);
  }

  // Wrong answer on a normal asteroid → instant impact (no retry on the same
  // asteroid). Boss problems instead cost ship HP and let the boss counter-attack.
  handleWrong(asteroid, btn) {
    const pickedValue = btn.value;
    asteroid.phase = 'resolving';
    this.setState('feedback');
    this.flashMcButton(btn, COLORS.error);
    audio.playWrong?.();

    this.streak = 0;
    this.streakHUD?.setStreak(0);

    if (asteroid.isBoss) {
      this.attempts++;
      this.history.push({ problem: asteroid.problem, userAnswer: pickedValue, correct: false });
      progress.recordFactAttempt(asteroid.problem.a, asteroid.problem.b, false);
      records.recordAnswer(asteroid.problem, false, performance.now() - asteroid.startedAtMs);

      this.bossMockLaugh(asteroid);
      this.damageShip();
      this.cockpitPet?.slumpSad?.();
      audio.playShipDamage?.();
      this.setHp(this.shipHp - 1);
      bossTwistOn(this, 'onWrong', asteroid, btn);
      if (this.shipHp <= 0) {
        this.failLevel();
        return;
      }
      const correctionProblem = asteroid.problem;
      this.time.delayedCall(700, () => {
        if (this._isOver()) return;
        this.showCorrectionFlash(correctionProblem, () => {
          if (this._isOver()) return;
          this.cycleBossProblem(asteroid);
        });
      });
      return;
    }

    // Mini-boss: take a ship hit but the asteroid SURVIVES — kid keeps fighting.
    // No correction modal (would interrupt the level cadence too much); just
    // damage + cycle to a new problem after a beat.
    if (asteroid._isMiniBoss) {
      this.attempts++;
      this.history.push({ problem: asteroid.problem, userAnswer: pickedValue, correct: false });
      progress.recordFactAttempt(asteroid.problem.a, asteroid.problem.b, false);
      records.recordAnswer(asteroid.problem, false, performance.now() - asteroid.startedAtMs);
      this.damageShip();
      this.cockpitPet?.slumpSad?.();
      audio.playShipDamage?.();
      this.setHp(this.shipHp - 1);
      if (this.shipHp <= 0) {
        this.failLevel();
        return;
      }
      this.time.delayedCall(600, () => {
        if (this._isOver()) return;
        this.cycleAsteroidProblem(asteroid);
      });
      return;
    }

    // Normal level: instant crash on the targeted asteroid
    this.onAsteroidImpact(asteroid, { fromWrongAnswer: true, userAnswer: pickedValue });
  }

  onAsteroidImpact(asteroid, opts = {}) {
    if (this._isOver()) return;
    if (asteroid.phase === 'resolving' && !opts.fromWrongAnswer) return;

    if (!opts.fromWrongAnswer && !opts.afterGrace) {
      if (asteroid.phase === 'impactGrace') return;
      // Reached the ship line; open the 120ms still-answerable grace window.
      asteroid.phase = 'impactGrace';
      this.time.delayedCall(IMPACT_GRACE_MS, () => {
        // Only land the hit if the kid didn't answer (→ resolving) or the
        // asteroid wasn't removed (→ gone) during the grace window.
        if (asteroid.phase !== 'impactGrace' || !asteroid.container?.active) return;
        this.onAsteroidImpact(asteroid, { ...opts, afterGrace: true });
      });
      return;
    }

    // handleWrong already moved the asteroid to 'resolving'; re-entering with
    // fromWrongAnswer is a continuation of the same answer flow, not a retap.
    asteroid.phase = 'resolving';
    this.setState('feedback');

    this.attempts++;
    this.history.push({
      problem: asteroid.problem,
      userAnswer: opts.userAnswer ?? null,
      correct: false
    });
    progress.recordFactAttempt(asteroid.problem.a, asteroid.problem.b, false);
    records.recordAnswer(asteroid.problem, false, performance.now() - asteroid.startedAtMs);

    this.streak = 0;
    this.streakHUD?.setStreak(0);

    this.damageShip();
    this.cockpitPet?.slumpSad?.();
    // Wrong-answer taps stay soft — the "oof" from playWrong is all the
    // audio feedback we want for a miss. Real impacts (asteroid timed out
    // and hit the ship) still get the metallic clang.
    if (!opts.fromWrongAnswer) audio.playShipDamage?.();

    this.setHp(this.shipHp - 1);

    if (asteroid.isBoss) {
      // Keep this expired problem closed through the counter-attack and
      // correction. cycleBossProblem opens input for the next problem.
      if (this.shipHp <= 0) {
        this.failLevel();
        return;
      }
      this.setState('feedback');
      this.bossAttackBack(asteroid);
      const correctionProblem = asteroid.problem;
      this.time.delayedCall(220, () => {
        if (this._isOver()) return;
        this.showCorrectionFlash(correctionProblem, () => {
          if (this._isOver()) return;
          this.cycleBossProblem(asteroid);
        });
      });
      return;
    }

    // Non-boss path: always snap-back into play after the glance. The smart
    // correction card was creating deadlocks (paused fall-tweens not resuming,
    // dismiss handlers missing the tap in multi-slot worlds) — boss combat
    // still uses it where the kid genuinely needs the answer flashed.
    //
    // Wrong-answer taps (and timeouts) glance off the shield and drift past
    // instead of yanking down to the ship; pass-through impacts on the ship
    // (asteroid timed out) still play the crash visual. Each exit routes
    // through teardownAsteroid, which brings on the next asteroid exactly once
    // (thenSpawn only when the ship survived — a fatal hit ends the round).
    if (opts.fromWrongAnswer) {
      this.playGlanceMiss(asteroid, () => this.teardownAsteroid(asteroid, { thenSpawn: this.shipHp > 0 }));
    } else if (asteroid.container?.active) {
      if (asteroid.fallTween) asteroid.fallTween.stop();
      this.tweens.add({
        targets: asteroid.container,
        y: SHIP_Y - 80,
        duration: 220,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.explodeAsteroid(asteroid, { onShip: true });
          this.teardownAsteroid(asteroid, { thenSpawn: this.shipHp > 0 });
        }
      });
    } else {
      this.explodeAsteroid(asteroid, { onShip: true });
      this.teardownAsteroid(asteroid, { thenSpawn: this.shipHp > 0 });
    }

    if (this.shipHp <= 0) {
      this.failLevel();
      return;
    }
  }

  // Wrong-answer glance: small spark where the asteroid would have hit the
  // shield, then the asteroid drifts past the ship (downward + outward,
  // fading) instead of crashing into it. Ship gets a 16px recoil. `onExit`
  // fires once the drift finishes and owns the teardown (it calls
  // teardownAsteroid, which removes this asteroid and brings on the next).
  playGlanceMiss(asteroid, onExit) {
    if (asteroid.fallTween) asteroid.fallTween.stop();

    const ax = asteroid.container?.x ?? W / 2;
    const sparkY = SHIP_Y - 100;
    const spark = this.add.graphics().setDepth(11);
    spark.fillStyle(0xfff3b8, 0.95);
    spark.fillCircle(0, 0, 18);
    spark.setBlendMode(Phaser.BlendModes.ADD);
    spark.x = ax;
    spark.y = sparkY;
    spark.setScale(0.6);
    this.tweens.add({
      targets: spark,
      alpha: 0,
      scale: 1.4,
      duration: 120,
      ease: 'Quad.easeOut',
      onComplete: () => spark.destroy()
    });

    if (asteroid.container?.active) {
      const driftX = ax > W / 2 ? 80 : -80;
      this.tweens.add({
        targets: asteroid.container,
        y: H + 200,
        x: ax + driftX,
        alpha: 0,
        duration: 400,
        ease: 'Quad.easeIn',
        onComplete: () => onExit?.()
      });
    } else {
      onExit?.();
    }

    this.recoilShip();
  }

  recoilShip() {
    if (!this.shipContainer?.active) return;
    this.tweens.killTweensOf(this.shipContainer);
    this.tweens.add({
      targets: this.shipContainer,
      y: SHIP_Y + 16,
      duration: 100,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: this.shipContainer,
          y: SHIP_Y - 8,
          duration: 220,
          ease: 'Sine.easeInOut',
          onComplete: () => this.startShipBob()
        });
      }
    });
  }

  // Resumes the gentle vertical bob the ship runs while idle. Safe to call
  // multiple times — kills any prior bob tween first.
  startShipBob() {
    if (!this.shipContainer?.active) return;
    this.tweens.killTweensOf(this.shipContainer);
    this.tweens.add({
      targets: this.shipContainer,
      y: SHIP_Y - 8,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  recoilBoss(asteroid) {
    if (!asteroid?.container?.active) return;
    if (asteroid.fallTween) asteroid.fallTween.stop();
    this.tweens.add({
      targets: asteroid.container,
      y: ASTEROID_TOP_Y - 30,
      duration: 280,
      ease: 'Quad.easeOut'
    });
    const flash = this.add.graphics();
    flash.fillStyle(0xffffff, 0.5);
    flash.fillCircle(0, 0, ASTEROID_RADIUS * BOSS_CONFIG.asteroidScale * 0.9);
    asteroid.container.add(flash);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 320,
      onComplete: () => flash.destroy()
    });
  }

  bossAttackBack(asteroid) {
    if (!asteroid?.container?.active) return;
    const origY = asteroid.container.y;
    this.tweens.add({
      targets: asteroid.container,
      y: origY + 60,
      duration: 140,
      yoyo: true,
      ease: 'Quad.easeIn'
    });
  }

  // Halts the fall so cycleBossProblem can reset cleanly.
  bossMockLaugh(asteroid) {
    if (!asteroid?.container?.active) return;
    if (asteroid.fallTween) asteroid.fallTween.stop();

    const vignette = this.add.graphics().setDepth(50);
    vignette.fillStyle(0xff3b3b, 0.30);
    vignette.fillRect(0, 0, W, H);
    this.tweens.add({
      targets: vignette,
      alpha: 0,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => vignette.destroy()
    });

    if (this.isGlitchBoss) {
      this.glitchScreenCorrupt();
    }

    const c = asteroid.container;
    const baseScaleX = c.scaleX;
    const baseScaleY = c.scaleY;
    this.tweens.add({
      targets: c,
      scaleX: baseScaleX * 1.12,
      scaleY: baseScaleY * 1.12,
      duration: 180,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!c.active) return;
        c.scaleX = baseScaleX;
        c.scaleY = baseScaleY;
      }
    });
    this.tweens.add({
      targets: c,
      rotation: { from: -0.12, to: 0.12 },
      duration: 180,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!c.active) return;
        c.rotation = 0;
      }
    });
  }

  startGlitchAmbientLoop() {
    const scheduleNext = () => {
      if (!this.scene.isActive()) return;
      const delay = 4000 + Math.random() * 2000;
      this._glitchAmbientTimer = this.time.delayedCall(delay, () => {
        if (this._isOver()) return;
        audio.playGlitchStatic?.({ duration: 0.16 + Math.random() * 0.10, peakGain: 0.08 });
        scheduleNext();
      });
    };
    scheduleNext();
    this.events.once('shutdown', () => {
      this._glitchAmbientTimer?.remove?.();
    });
  }

  glitchScreenCorrupt() {
    const aberration = this.add.graphics().setDepth(55);
    aberration.fillStyle(0xff00ff, 0.18);
    aberration.fillRect(-12, 0, W + 24, H);
    aberration.fillStyle(0x39ff14, 0.18);
    aberration.fillRect(12, 0, W + 24, H);
    this.tweens.add({
      targets: aberration,
      alpha: 0,
      duration: 360,
      ease: 'Quad.easeOut',
      onComplete: () => aberration.destroy()
    });

    const tearCount = 5;
    for (let i = 0; i < tearCount; i++) {
      const tear = this.add.graphics().setDepth(56);
      const tearY = 340 + Math.random() * (H - 600);
      const tearH = 4 + Math.random() * 12;
      tear.fillStyle(i % 2 === 0 ? 0xff00ff : 0x39ff14, 0.85);
      tear.fillRect(0, tearY, W, tearH);
      this.tweens.add({
        targets: tear,
        alpha: 0,
        duration: 220 + Math.random() * 160,
        ease: 'Quad.easeOut',
        onComplete: () => tear.destroy()
      });
    }

    this.cameras.main.shake(220, 0.012);
    audio.playGlitchStatic?.({ duration: 0.22, peakGain: 0.14 });
  }

  cycleBossProblem(asteroid) {
    if (!asteroid?.container?.active || this.bossDefeated) return;
    if (asteroid.fallTween) asteroid.fallTween.stop();

    asteroid.phase = 'falling';
    const newProblem = this.isGlitchBoss
      ? getGlitchProblem()
      : getProblemForWorld(this.worldId, this.mode);
    asteroid.problem = newProblem;
    asteroid.startedAtMs = performance.now();
    asteroid.text?.setText(newProblem.display);

    asteroid.container.y = ASTEROID_TOP_Y;
    this._startAsteroidFall(asteroid, ASTEROID_IMPACT_Y - 80, this.problemSeconds * 1000);

    this.refreshMcButtons(newProblem);
    bossTwistOn(this, 'onSpawn', asteroid);
  }

  // Pause-and-show overlay after a wrong answer or asteroid impact: displays
  // the full equation with the correct answer and waits for a tap before
  // calling onContinue. State flips to 'correction', which the timer/update
  // loop already treats as paused, and active asteroid falls are paused too
  // so a second slot can't crash mid-read.
  showCorrectionFlash(problem, onContinue) {
    if (!problem) { onContinue?.(); return; }
    this.setState('correction');

    const pausedTweens = [];
    this.activeAsteroids.forEach(a => {
      if (a.fallTween && a.fallTween.isPlaying?.()) {
        a.fallTween.pause();
        pausedTweens.push(a.fallTween);
      }
    });

    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0)
      .setDepth(65).setInteractive();
    this.tweens.add({ targets: overlay, fillAlpha: 0.72, duration: 220 });

    const cardW = 880;
    const cardH = 360;
    const card = this.add.container(W / 2, H / 2 - 40).setDepth(66);
    card.setAlpha(0);

    // Fully opaque so the asteroid's problem behind the card never ghosts
    // through next to the corrected equation.
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.bgPanel, 1);
    bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 32);
    bg.lineStyle(3, this.world.accentColor, 0.85);
    bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 32);
    card.add(bg);

    // Card-level hit so a tap directly on the panel dismisses, even if
    // something above mis-routes the overlay tap.
    const cardHit = this.add.rectangle(0, 0, cardW, cardH, 0x000000, 0).setInteractive();
    card.add(cardHit);

    // Glitch-boss problems already bake the full equation into `display` with a
    // blanked digit (▓) or operand (?); fill the blank with the answer instead
    // of appending a second "= answer" (which rendered "7 × 8 = 5▓ = 6").
    // Normal problems have a bare "a × b" and get the "= answer" suffix.
    let equation;
    if (problem.display.includes('▓')) {
      equation = problem.display.replace('▓', problem.answer);
    } else if (problem.display.includes('?')) {
      equation = problem.display.replace('?', problem.answer);
    } else {
      equation = `${problem.display} = ${problem.answer}`;
    }
    const eqText = this.add.text(0, -30, equation, style('display', {
      fontSize: '108px',
      fill: '#ffffff'
    })).setOrigin(0.5);
    card.add(eqText);

    const hint = this.add.text(0, cardH / 2 - 56, 'Tap to continue', style('body', {
      fontSize: '42px',
      fill: '#e0e0ef'
    })).setOrigin(0.5);
    card.add(hint);

    this.tweens.add({
      targets: card,
      alpha: 1,
      y: H / 2 - 80,
      duration: 260,
      ease: 'Back.easeOut'
    });
    // The pulse never dips below 0.8 so the hint stays readable.
    this.tweens.add({
      targets: hint,
      alpha: { from: 0.8, to: 1 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    let dismissed = false;
    let sceneHandler = null;
    const sceneAlive = () => this.scene && this.scene.isActive?.() !== false && !!this.sys?.displayList;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      // The scene may have shut down before this fires (warp scene-swap,
      // pause-quit, route change). Without this guard the tween/input calls
      // below crash on torn-down systems.
      if (!sceneAlive()) {
        try { onContinue?.(); } catch (_) { /* downstream may also touch dead scene */ }
        return;
      }
      try { overlay.disableInteractive(); } catch (_) {}
      try { cardHit.disableInteractive(); } catch (_) {}
      if (sceneHandler) {
        try { this.input.off('pointerdown', sceneHandler); } catch (_) {}
      }
      audio.playClick?.();
      pausedTweens.forEach(t => { try { t.resume?.(); } catch (_) {} });
      this.tweens.add({
        targets: [overlay, card],
        alpha: 0,
        duration: 160,
        onComplete: () => {
          if (overlay?.active) overlay.destroy();
          if (card?.active) card.destroy();
        }
      });
      this.setState('playing');
      onContinue?.();
    };

    overlay.on('pointerdown', dismiss);
    cardHit.on('pointerdown', dismiss);
    // Belt and braces:
    //   * 50ms after open, register a scene-level pointerdown as a final tap
    //     catcher (in case the overlay/card-hit miss the event).
    //   * 3.5s hard cap so the kid can't get stranded reading the card.
    // Both timers go through scene.time so a scene shutdown (warp swap, quit,
    // restart) cleans them up automatically — the previous setTimeout-based
    // version fired after shutdown and crashed dismiss.
    this.time.delayedCall(50, () => {
      if (dismissed || !sceneAlive()) return;
      sceneHandler = () => dismiss();
      this.input.on('pointerdown', sceneHandler);
    });
    this.time.delayedCall(3500, dismiss);
  }

  defeatBoss(asteroid) {
    this.bossDefeated = true;
    this.setState('feedback');
    if (asteroid.fallTween) asteroid.fallTween.stop();
    this.tweens.killTweensOf(asteroid.container);

    // Pass the boss asteroid through so endRound can hand it to the 4-beat
    // cinematic AFTER all stardust/completion data has been committed. The
    // cinematic can't safely run before the data writes — a tab-close
    // mid-cinematic would otherwise lose progress.
    if (this.bossHpBar?.active) this.bossHpBar.destroy();
    this.bossHpBar = null;
    this.endRound({ bossWin: true, bossAsteroid: asteroid });
  }

  // Auto-dismissing world-clear banner: slides down from top, sits 2.5s, slides out.
  // Calls onComplete when fully dismissed.
  showWorldClearBanner(onComplete) {
    const bannerW = 960;
    const accent = this.world.accentColor;
    const hasPet = companion.hasStarter();

    // The title fills the space left of the pet and wraps to a second line
    // for long world names; the banner grows to fit it.
    const textLeft = -bannerW / 2 + 36;
    const textRight = hasPet ? bannerW / 2 - 150 : bannerW / 2 - 36;
    const textW = textRight - textLeft;
    // Same ink rule as the buttons: dark lettering on the light pastel faces
    // (white there only read through its outline), white on dark faces.
    const faceLum = (0.299 * ((accent >> 16) & 0xff) + 0.587 * ((accent >> 8) & 0xff) + 0.114 * (accent & 0xff)) / 255;
    const lightFace = faceLum > 0.6;
    const title = this.add.text((textLeft + textRight) / 2, 0, `${this.world.name.toUpperCase()} CLEARED!`, style('display', {
      fontSize: '64px',
      fill: lightFace ? '#0a0a1a' : '#ffffff',
      stroke: '#0a0a1a',
      strokeThickness: lightFace ? 0 : 5,
      fontStyle: '900',
      align: 'center',
      wordWrap: { width: textW }
    })).setOrigin(0.5);
    if (title.width > textW) title.setScale(textW / title.width);
    const bannerH = Math.max(160, Math.ceil(title.height * title.scaleY) + 40);
    const startY = -bannerH / 2 - 20;
    const restY = Math.max(220, bannerH / 2 + 30);

    const banner = this.add.container(W / 2, startY).setDepth(70);

    // Fully opaque so the top bar's stat labels never ghost through the title.
    const bg = this.add.graphics();
    bg.fillStyle(accent, 1);
    bg.fillRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 26);
    bg.lineStyle(4, 0x0a0a1a, 1);
    bg.strokeRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 26);
    banner.add(bg);
    banner.add(title);

    // Drop + pop: ease in, then briefly scale 1.0 → 1.08 → 1.0 for impact.
    banner.setScale(0.9);
    this.tweens.add({
      targets: banner,
      y: restY,
      scale: 1,
      duration: 380,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: banner,
          scale: 1.08,
          duration: 130,
          yoyo: true,
          ease: 'Sine.easeInOut'
        });
      }
    });

    // Pet bounces in beside the banner — happy victory hop loop.
    let petContainer = null;
    if (hasPet) {
      const petX = bannerW / 2 - 70;
      petContainer = this.add.container(petX, 0);
      banner.add(petContainer);
      const pet = drawCompanion(this, 0, 0, { scale: 0.95 });
      petContainer.add(pet);
      pet.setScale(0);
      this.time.delayedCall(280, () => {
        this.tweens.add({
          targets: pet,
          scale: 1,
          duration: 240,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.tweens.add({
              targets: petContainer,
              y: -22,
              duration: 220,
              yoyo: true,
              repeat: 2,
              ease: 'Sine.easeInOut'
            });
          }
        });
      });
    }

    // Triple-burst chord matches the first-mastery banner pattern in showSummary.
    audio.playStar?.();
    this.time.delayedCall(180, () => audio.playStar?.());
    this.time.delayedCall(360, () => audio.playStar?.());

    this.time.delayedCall(380 + 2700, () => {
      this.tweens.add({
        targets: banner,
        y: startY,
        duration: 350,
        ease: 'Back.easeIn',
        onComplete: () => {
          banner.destroy();
          onComplete?.();
        }
      });
    });
  }

  fireLaserAt(asteroid) {
    if (!asteroid?.container?.active) return;
    const startX = this.shipContainer.x;
    const startY = this.shipContainer.y - 60;
    const targetX = asteroid.container.x;
    const targetY = asteroid.container.y;

    const laser = this.add.graphics().setDepth(9);
    laser.lineStyle(10, 0x81ecec, 1);
    laser.lineBetween(startX, startY, targetX, targetY);
    laser.lineStyle(4, 0xffffff, 1);
    laser.lineBetween(startX, startY, targetX, targetY);
    this.tweens.add({
      targets: laser,
      alpha: 0,
      duration: 220,
      ease: 'Quad.easeOut',
      onComplete: () => laser.destroy()
    });

    this.tweens.add({
      targets: this.shipContainer,
      y: SHIP_Y - 24,
      duration: 100,
      yoyo: true,
      ease: 'Quad.easeOut'
    });
  }

  explodeAsteroid(asteroid, opts = {}) {
    let x, y;
    if (asteroid?.container?.active) {
      x = asteroid.container.x;
      y = asteroid.container.y;
    } else if (typeof asteroid?.x === 'number') {
      x = asteroid.x;
      y = asteroid.y;
    } else {
      return;
    }

    if (opts.big) {
      this._explodeBig(x, y);
      return;
    }

    const colors = opts.onShip
      ? [0xff6b6b, 0xff8b3d, 0xffd86b]
      : [0xf7dc6f, 0xff8b3d, 0xffffff];

    const shardCount = 14;
    for (let i = 0; i < shardCount; i++) {
      const angle = (i / shardCount) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 80 + Math.random() * 100;
      const shard = this.add.graphics().setDepth(9);
      shard.fillStyle(colors[i % colors.length], 1);
      shard.fillCircle(0, 0, 5 + Math.random() * 5);
      shard.x = x;
      shard.y = y;
      this.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        duration: 500 + Math.random() * 200,
        ease: 'Quad.easeOut',
        onComplete: () => shard.destroy()
      });
    }

    const ring = this.add.graphics().setDepth(9);
    ring.lineStyle(7, 0xffffff, 1);
    ring.strokeCircle(0, 0, 40);
    ring.x = x;
    ring.y = y;
    this.tweens.add({
      targets: ring,
      scale: 4,
      alpha: 0,
      duration: 380,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy()
    });
  }

  // Layered correct-answer explosion. Four overlapping passes:
  //   * 0–40ms   white impact flash (radius ≈ asteroid radius × 1.4)
  //   * 40–240ms ~30 shards in 3 size tiers radiate to 140–280px (Quad.easeOut)
  //   * 80–360ms 7 debris chunks (world-accent triangles) tumble to 220–380px
  //               with a full 360–720° rotation (Cubic.easeOut)
  //   * 0–600ms  soft dust cloud (single circle, world-accent at 0.18 alpha)
  //               scales 0.5 → 1.4 and fades out
  // Camera wobble fires only on streak ≥ 10 (gentler than the damageShip shake).
  // All shards/chunks come from the pre-allocated pool so we never construct
  // mid-frame during the back-to-back explosions of fast worlds.
  _explodeBig(x, y) {
    const accent = this.world.accentColor;
    const shardColors = [accent, 0xffffff, 0xf7dc6f, 0xff8b3d];

    // ── Layer 1: white impact flash (0–40ms) ──────────────────────────────
    const flash = this._acquireFxGraphic();
    flash.fillStyle(0xffffff, 1);
    flash.fillCircle(0, 0, ASTEROID_RADIUS * 1.4);
    flash.setPosition(x, y);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 40,
      ease: 'Quad.easeOut',
      onComplete: () => this._releaseFxGraphic(flash),
    });

    // ── Layer 2: ~30 shards in 3 size tiers (40–240ms) ────────────────────
    const tiers = [
      { count: 12, sizeMin: 4, sizeSpan: 2, distMin: 140, distSpan: 60 },
      { count: 10, sizeMin: 7, sizeSpan: 3, distMin: 180, distSpan: 60 },
      { count: 8,  sizeMin: 11, sizeSpan: 3, distMin: 220, distSpan: 60 },
    ];
    let shardIndex = 0;
    const totalShards = tiers.reduce((s, t) => s + t.count, 0);
    for (const tier of tiers) {
      for (let i = 0; i < tier.count; i++) {
        const angle = (shardIndex / totalShards) * Math.PI * 2 + Math.random() * 0.35;
        shardIndex++;
        const dist = tier.distMin + Math.random() * tier.distSpan;
        const size = tier.sizeMin + Math.random() * tier.sizeSpan;
        const color = shardColors[Math.floor(Math.random() * shardColors.length)];
        const shard = this._acquireFxGraphic();
        shard.fillStyle(color, 1);
        shard.fillCircle(0, 0, size);
        shard.setPosition(x, y);
        const targetX = x + Math.cos(angle) * dist;
        const targetY = y + Math.sin(angle) * dist;
        this.tweens.add({
          targets: shard,
          x: targetX,
          y: targetY,
          alpha: 0,
          angle: (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 240),
          delay: 40,
          duration: 200,
          ease: 'Quad.easeOut',
          onComplete: () => this._releaseFxGraphic(shard),
        });
      }
    }

    // ── Layer 3: 7 debris chunks (80–360ms) ───────────────────────────────
    const chunkColor = darken(accent, 0.18);
    const chunkCount = 7;
    for (let i = 0; i < chunkCount; i++) {
      const angle = (i / chunkCount) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 220 + Math.random() * 160;
      const size = 18 + Math.random() * 8;
      const half = size / 2;
      const chunk = this._acquireFxGraphic();
      chunk.fillStyle(chunkColor, 1);
      chunk.fillTriangle(-half, -half * 0.6, half, -half * 0.4, half * 0.3, half * 0.7);
      chunk.fillTriangle(-half, -half * 0.6, half * 0.3, half * 0.7, -half * 0.4, half * 0.5);
      chunk.setPosition(x, y);
      chunk.setAngle(Math.random() * 360);
      const rotSign = Math.random() < 0.5 ? -1 : 1;
      this.tweens.add({
        targets: chunk,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist + 80, // gravity-ish bias downward
        angle: chunk.angle + rotSign * (360 + Math.random() * 360),
        alpha: 0,
        delay: 80,
        duration: 280,
        ease: 'Cubic.easeOut',
        onComplete: () => this._releaseFxGraphic(chunk),
      });
    }

    // ── Layer 4: soft dust cloud (0–600ms) ────────────────────────────────
    const dust = this.add.graphics().setDepth(8);
    dust.fillStyle(accent, 0.18);
    dust.fillCircle(0, 0, ASTEROID_RADIUS * 0.9);
    dust.setPosition(x, y);
    dust.setScale(0.5);
    this.tweens.add({
      targets: dust,
      scale: 1.4,
      alpha: 0,
      duration: 600,
      ease: 'Sine.easeOut',
      onComplete: () => dust.destroy(),
    });

    // Streak shake: only on hot streaks. Gentler than damageShip's 280/0.012.
    if (this.streak >= 10) {
      this.cameras.main.shake(120, 0.004);
    }
  }

  // The single asteroid exit. Every way an asteroid finishes (correct explode,
  // wrong glance, timeout crash, warp) routes through here so "remove this one,
  // then bring on exactly the next" lives in ONE place and cannot be
  // half-implemented (the freeze / double-spawn bug class — spec §2b).
  //   thenSpawn — refill the slot with the next asteroid once this one is gone.
  //   rearmWarp — if this was a LIVE warp asteroid, restore the gateway so it
  //     respawns. Defaults true; the warp-SUCCESS path opts out (rearmWarp:false)
  //     because it consumed the gateway. This is the single source of truth for
  //     warp liveness (spec §2d) — re-arm is decided by explicit caller intent,
  //     NEVER by reading this.state.
  // The respawn is gated exactly like spawnAsteroid's own guards (not over, not
  // warping, a slot is free) and flips the round back to 'playing'.
  teardownAsteroid(asteroid, { thenSpawn = false, rearmWarp = true } = {}) {
    const rearm = rearmWarp && asteroid._isWarp && this.warpState === 'spawned';
    this.removeAsteroid(asteroid);
    // Re-arm BEFORE the respawn below, so spawnAsteroid sees warpState 'ready'
    // and brings the warp asteroid back instead of a normal one.
    if (rearm) this.warpState = 'ready';
    if (thenSpawn && !this._isOver() && this.state !== 'warp'
        && this.activeAsteroids.length < this.asteroidSlots) {
      this.setState('playing');
      this.spawnAsteroid();
    }
  }

  removeAsteroid(asteroid) {
    asteroid.phase = 'gone';
    if (asteroid.fallTween) asteroid.fallTween.stop();
    if (asteroid.container?.active) {
      // Kill any other tweens still acting on the container (the
      // playGlanceMiss drift, the snap-to-ship tween, the sway, etc.).
      // Otherwise they keep animating the soon-to-be-destroyed container
      // while a NEW asteroid spawns, leaving a "ghost" question floating
      // past the play area until its tween finally ends.
      this.tweens.killTweensOf(asteroid.container);
      this.tweens.add({
        targets: asteroid.container,
        scale: 0,
        alpha: 0,
        duration: 200,
        ease: 'Back.easeIn',
        onComplete: () => {
          if (asteroid.container?.active) asteroid.container.destroy();
        }
      });
    }
    this.activeAsteroids = this.activeAsteroids.filter(a => a !== asteroid);
    if (this.targetedAsteroid === asteroid) {
      this.targetedAsteroid = null;
      const next = this.getAnswerableAsteroid();
      if (next) this.targetAsteroid(next);
    }
    // (Warp-gateway re-arm lives in teardownAsteroid now, decided by explicit
    // caller intent rather than by reading this.state — see spec §2d.)
  }

  damageShip() {
    const flash = this.add.graphics().setDepth(10);
    flash.fillStyle(COLORS.error, 0.6);
    flash.fillCircle(0, 0, 110);
    this.shipContainer.add(flash);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 380,
      onComplete: () => flash.destroy()
    });
    this.cameras.main.shake(280, 0.012);
  }

  // True once the round has reached a terminal state — used by the many
  // deferred callbacks that must bail if the level already failed or ended.
  _isOver() {
    return this.state === 'failed' || this.state === 'ended';
  }

  // ============================================================
  // UPDATE
  // ============================================================
  update(_time, delta) {
    // While the pause menu is open the clock/tweens/physics are paused, but
    // update() itself still runs every frame — gate the whole loop so the
    // countdown doesn't keep ticking (timeLeft -= delta) and the empty-field
    // backstop doesn't spawn an asteroid behind the modal.
    if (this._pauseOpen) return;

    // Tap-feedback runs in ALL states (including 'intro', 'correction',
    // 'warp', 'ended') so the buttons always reflect whether they would do
    // anything if tapped — no "looks enabled, behaves dead" frames.
    this._refreshMcButtonsDim();

    if (this.state !== 'playing' && this.state !== 'feedback') return;

    // Single safety backstop (replaces the old _stuckMs / _emptySlotMs /
    // _bossStuckMs trio). teardownAsteroid now owns the one asteroid exit and
    // refills the slot the instant an asteroid resolves, so in normal play the
    // field is never empty for more than a frame — this should NEVER fire.
    //
    // It exists only to self-heal the one catastrophic state: an EMPTY field
    // with nothing scheduled to refill it, which can only happen if an async
    // exit callback (an explode/glance/snap tween onComplete, or a delayedCall)
    // throws before its teardownAsteroid runs. A live kids' game must never
    // hard-freeze. Unlike the old _stuckMs watchdog it only ADDS an asteroid
    // when the field is genuinely empty — it never wipes anything, so it cannot
    // nuke an in-progress mini-boss, and spawnAsteroid self-guards against a
    // double-spawn. Boss rounds are excluded: the boss asteroid cycles in place
    // and is never removed mid-fight, so a boss field cannot go empty.
    const fieldEmpty = !this.isBoss
      && !this.bossDefeated
      && this.asteroidSlots > 0
      && this.activeAsteroids.length === 0
      && this.state !== 'warp';
    if (fieldEmpty) {
      this._emptyFieldMs = (this._emptyFieldMs || 0) + delta;
      if (this._emptyFieldMs > 1000) {
        this._emptyFieldMs = 0;
        this.setState('playing');
        this.spawnAsteroid();
      }
    } else {
      this._emptyFieldMs = 0;
    }

    if (this.bossHpBar?.active && this.bossContainer?.active) {
      this.bossHpBar.x = this.bossContainer.x;
      this.bossHpBar.y = this.bossContainer.y - ASTEROID_RADIUS * BOSS_CONFIG.asteroidScale - 60;
      // Each new problem drops the boss in from the top, so the bar slides
      // out from under the top bar. The villain name on it stays hidden until
      // it clears the top bar (and the Boss Rush counter), then fades in, so
      // it never lands on the stat labels. The top bar already shows the name.
      const nameText = this.bossHpBar.nameText;
      if (nameText?.active) {
        const nameTop = this.bossHpBar.y + nameText.y - nameText.height;
        const clearY = this._bossRushCounter?.active
          ? this._bossRushCounter.y + this._bossRushCounter.height + 8
          : TOP_BAR_H + 8;
        nameText.setAlpha(Phaser.Math.Clamp((nameTop - clearY) / 40, 0, 1));
      }
    }

    // Arcade modes have no round timer — Boss Rush ends on boss defeat / ship
    // death, Endless runs until the ship is lost. The time bar stays static.
    if (!this.arcadeMode && !this.bossDefeated) {
      this.timeLeft -= delta;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.endRound();
        return;
      }

      const pct = this.timeLeft / (this.duration * 1000);
      drawTimeBar(this, TOP_BAR_H, pct);
      this.timeText.setText(this.formatTime(this.timeLeft));

      if (this.timeLeft <= 5000) {
        const sec = Math.ceil(this.timeLeft / 1000);
        if (sec !== this.lastTickSec) {
          this.lastTickSec = sec;
          audio.playTick?.();
          this.tweens.add({
            targets: this.timeText,
            scale: { from: 1.3, to: 1 },
            duration: 250,
            ease: 'Quad.easeOut'
          });
        }
      }
    }
  }

  // ============================================================
  // FAIL
  // ============================================================
  failLevel() {
    if (this.arcadeMode) { this._arcadeShipDeath(); return; }
    this.setState('failed');
    audio.playLevelFailed?.();

    this.activeAsteroids.forEach(a => {
      if (a.fallTween) a.fallTween.stop();
      if (a.container?.active) a.container.destroy();
    });
    this.activeAsteroids = [];

    this.cameras.main.shake(600, 0.025);

    this.time.delayedCall(700, () => this.showFailScreen());
  }

  showFailScreen() {
    if (this.scoreGroup) {
      this.scoreGroup.forEach(o => this.tweens.add({
        targets: o, alpha: 1, duration: 240, ease: 'Quad.easeOut'
      }));
    }

    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(50).setInteractive();
    this.tweens.add({ targets: overlay, fillAlpha: 0.8, duration: 350 });

    // Laid out top-down from the measured caption, then the panel is sized
    // to fit, so a two-line caption pushes the missed facts and buttons down
    // instead of running into them.
    const panelW = 820;
    const hasPet = companion.hasStarter();
    const missed = this.getWeakFactsFromHistory().slice(0, 3);
    const caption = missed.length > 0
      ? 'These were tricky! Try again to crush them.'
      : 'So close! One more run.';

    const titleY = 84;
    const petY = hasPet ? 250 : null;
    const captionTop = hasPet ? 330 : 160;
    const captionText = this.add.text(0, 0, caption, style('body', {
      fontSize: '42px', fill: '#e0e0ef', align: 'center',
      wordWrap: { width: 620 }
    })).setOrigin(0.5, 0);
    const listPitch = 64;
    const listTop = captionTop + captionText.height + 44;
    const contentBottom = missed.length > 0
      ? listTop + (missed.length - 1) * listPitch + 30
      : captionTop + captionText.height;
    const btnH = 90;
    const panelH = Math.ceil(contentBottom + 44 + btnH + 44);
    const top = -panelH / 2;

    const panel = this.add.container(W / 2, H + panelH / 2).setDepth(60);

    const bg = this.add.graphics();
    bg.fillStyle(COLORS.bgPanel, 0.98);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 32);
    bg.lineStyle(3, COLORS.error, 0.85);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 32);
    panel.add(bg);

    // Softer headline than the old "Ship Destroyed": the fail screen leads
    // with encouragement, not punishment.
    panel.add(this.add.text(0, top + titleY, 'Mission incomplete', style('display', {
      fontSize: '64px',
      fill: '#ff9a9a',
    })).setOrigin(0.5));

    // Pet rallies on the fail screen: brief slumpSad, then bounceHappy.
    if (hasPet) {
      const pet = drawCompanion(this, 0, top + petY, { scale: 1.2 });
      panel.add(pet);
      pet.setScale(0);
      this.tweens.add({
        targets: pet,
        scale: 1.2,
        duration: 280,
        delay: 280,
        ease: 'Back.easeOut',
        onComplete: () => {
          pet.slumpSad?.();
          this.time.delayedCall(520, () => pet.bounceHappy?.());
          // Gentle idle breath afterwards.
          this.tweens.add({
            targets: pet,
            scale: { from: 1.2, to: 1.2 * 1.03 },
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 900,
          });
        },
      });
    }

    // Caption sits below the pet; the missed-facts log pivots the copy.
    captionText.y = top + captionTop;
    panel.add(captionText);

    // 1 to 3 missed equations in display font. Empty list (timeout with no
    // misses) just shows the caption above.
    missed.forEach((m, i) => {
      panel.add(this.add.text(0, top + listTop + i * listPitch, `${m.display} = ${m.answer}`, style('display', {
        fontSize: '42px',
        fill: '#f7dc6f',
      })).setOrigin(0.5));
    });

    const btnY = panelH / 2 - 44 - btnH / 2;
    panel.add(createButton(this, {
      x: -175, y: btnY, label: 'Try again',
      width: 320, height: btnH,
      color: this.world.accentColor,
      onClick: () => this.scene.restart(),
    }));
    panel.add(createButton(this, {
      x: 175, y: btnY, label: 'Back to map',
      width: 320, height: btnH,
      color: 0x4a4a6a,
      onClick: () => this.exitToLevelSelect(),
    }));

    this.tweens.add({
      targets: panel,
      y: H / 2,
      duration: 500,
      ease: 'Back.easeOut'
    });
  }

  // ============================================================
  // END OF ROUND
  // ============================================================
  // ============================================================
  // ARCADE (Endless / Boss Rush) — runs on this engine instead of the campaign
  // round flow. All entered only when this.arcadeMode is set.
  // ============================================================
  _setupArcadeHud() {
    // Sync the HP hearts to the carried ship HP (Boss Rush) and kill the timer
    // readout (arcade has no round clock).
    this.setHp(this.shipHp);
    if (this.timeText) this.timeText.setText('∞');
    if (this.arcadeMode === 'bossRush' && this.arcadeState) {
      const n = (this.arcadeState.index ?? 0) + 1;
      const total = this.arcadeState.queue?.length ?? 5;
      this._bossRushCounter = this.add.text(W / 2, TOP_BAR_H + 4, `BOSS ${n}/${total}`, style('caption', {
        fontSize: '36px', fill: '#ff8b8b', fontStyle: '900',
        stroke: '#0a0a1a', strokeThickness: 5
      })).setOrigin(0.5, 0).setDepth(45);
    }
  }

  // Boss defeated in arcade Boss Rush → bank stats, run the real defeat
  // cinematic, then advance to the next boss (fresh scene) or the results.
  _arcadeRoundEnd({ bossWin, bossAsteroid } = {}) {
    if (this.arcadeMode !== 'bossRush') return; // Endless never ends a round here
    this.setState('ended');

    const st = this.arcadeState || {
      queue: [this.worldId], index: 0, correct: 0, attempts: 0, startMs: Date.now()
    };
    st.correct += this.correctAnswers;
    st.attempts += this.attempts;
    st.shipHp = this.shipHp;
    st.index += 1;

    const advance = () => {
      if (!this.scene.isActive()) return;
      if (st.index >= st.queue.length) {
        showArcadeResults(this, {
          mode: 'bossRush', won: true,
          correct: st.correct, attempts: st.attempts,
          timeMs: Date.now() - st.startMs
        });
      } else {
        this.registry.set('arcadeState', st);
        this.registry.set('currentWorldId', st.queue[st.index]);
        this.registry.set('levelMode', 'boss');
        this.scene.restart();
      }
    };

    if (bossWin && bossAsteroid) {
      import('../BossDefeatCinematic.js').then(({ playBossDefeatCinematic }) => {
        playBossDefeatCinematic(this, bossAsteroid, advance);
      });
    } else {
      advance();
    }
  }

  // Ship lost in arcade → end the run and show results.
  _arcadeShipDeath() {
    this.setState('failed');
    audio.playLevelFailed?.();
    this.activeAsteroids.forEach(a => {
      if (a.fallTween) a.fallTween.stop();
      if (a.container?.active) a.container.destroy();
    });
    this.activeAsteroids = [];
    this.cameras.main.shake(500, 0.02);

    const st = this.arcadeState;
    let correct = this.correctAnswers;
    let attempts = this.attempts;
    if (this.arcadeMode === 'bossRush' && st) {
      correct = st.correct + this.correctAnswers;
      attempts = st.attempts + this.attempts;
    }
    const timeMs = st?.startMs ? Date.now() - st.startMs : 0;

    this.time.delayedCall(600, () => {
      showArcadeResults(this, {
        mode: this.arcadeMode, won: false,
        correct, attempts, timeMs,
        score: this.reviewMode ? this.correctAnswers : this.score
      });
    });
  }

  endRound({ bossWin = false, bossAsteroid } = {}) {
    if (this._isOver()) return;
    bossWin = this.isBoss && (bossWin || this.bossDefeated);
    if (this.arcadeMode) { this._arcadeRoundEnd({ bossWin, bossAsteroid }); return; }
    this.setState('ended');
    audio.playRoundComplete?.();

    this.activeAsteroids.forEach(a => {
      if (a.fallTween) a.fallTween.stop();
    });

    const { accuracy, stars, mastered } = calculateRoundResult({
      score: this.score,
      correctAnswers: this.correctAnswers,
      attempts: this.attempts,
      scoreThreshold: this.scoreThreshold,
      isBoss: this.isBoss,
      bossWin,
      bossStars: bossWin ? this.calculateBossStars() : 0
    });

    const prevBestStars = progress.worldProgress[this.worldId]?.levelStars?.[this.currentLevel] || 0;
    const firstMastery = stars === 3 && prevBestStars < 3;

    // Capture pre-completion mastery so we can tell when THIS run was the one
    // that completed the world (all 4 mastered) and thus unlocked the next.
    const wasMastered = progress.isWorldMastered(this.worldId);

    progress.completeLevel(this.worldId, this.currentLevel, stars, mastered);

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

    let glitchUnlocked = false;
    let glitchBonus = 0;
    if (bossWin && this.isGlitchBoss && !progress.isHiddenWorldCleared(this.worldId)) {
      glitchUnlocked = true;
      glitchBonus = 750;
      progress.clearHiddenWorld(this.worldId);
      ship.addAndEquip('addon_glitch_module');
      economy.addStardust(glitchBonus);
      this.stardustEarned += glitchBonus;
    }

    // King Coli (W17) — the hidden hygiene superboss. First win clears the world
    // (which grants the exclusive Aegis hull via grantSecretReward), pays a big
    // stardust bonus, and flags the summary banner.
    let kingColiUnlocked = false;
    let kingColiBonus = 0;
    if (bossWin && this.worldId === 17 && !progress.isHiddenWorldCleared(17)) {
      kingColiUnlocked = true;
      kingColiBonus = 1000;
      progress.clearHiddenWorld(17);
      economy.addStardust(kingColiBonus);
      this.stardustEarned += kingColiBonus;
    }

    const dailyBonus = claimDailyBonusIfDue();
    this.stardustEarned += dailyBonus;

    records.recordLevelComplete(this.bestStreak);

    // Evolution can become eligible mid-round from lifetime-correct gates, or
    // after completeLevel unlocks a world-clear gate. Preserve either case.
    const evolvedTo = this.pendingEvolution || companion.checkEvolutionEligibility();

    const worldFullyCleared = progress.isWorldFullyCleared(this.worldId);
    // The "World Cleared!" banner + map ship auto-advance now fire when the world
    // becomes fully MASTERED — which is also exactly when the next world unlocks,
    // so the ship never flies toward a still-locked node. With the boss gated
    // behind mastering the 3 practice levels (see LevelSelectScene), beating the
    // boss is normally the move that completes mastery; a world cleared long ago
    // under the old rules just behaves like a replay (worldJustMastered=false).
    // The next world unlocks the moment the world is fully mastered (via
    // completeLevel→checkWorldUnlock), independent of this flag. The celebratory
    // banner + ship auto-advance stay tied to a BOSS defeat (the world's climax),
    // so a legacy save that happens to complete its 4th mastery on a practice
    // replay still advances but doesn't fire the boss-payoff banner mid-practice.
    const worldJustMastered = !wasMastered && progress.isWorldMastered(this.worldId);
    const clearedThisRun = worldJustMastered && (this.isBoss || bossWin);

    const summaryArgs = { stars, accuracy, bossWin, evolvedTo, firstMastery, baseBonus, masteryBonus, dailyBonus, glitchUnlocked, glitchBonus, kingColiUnlocked, kingColiBonus };

    const proceedToSummary = () => {
      if (evolvedTo) {
        // Evolution gets a full-screen cinematic before the summary.
        import('../EvolutionCinematic.js').then(({ playEvolutionCinematic }) => {
          playEvolutionCinematic(this, evolvedTo, () => this.showSummary(summaryArgs));
        });
      } else {
        this.showSummary(summaryArgs);
      }
    };

    // Beating the Chapter 1 final boss (W11 Void Devourer) permanently grants
    // the pet's Cosmic form, independent of the numeric evolution gates.
    // Idempotent + runs on EVERY win (including replays), so the pet never
    // "snaps back" to a lower stage.
    if (bossWin && isFinalVisibleWorld(this.worldId)) {
      companion.unlockCosmic();
    }

    // Chapter 1 finale (W11): first clear triggers the CLIFFHANGER cinematic —
    // it keeps the Cosmic form + Arcade unlock (via endingSeen) but reframes the
    // ending as a teaser pointing at the warp gate. After that, replays skip to
    // the summary. Persist endingSeen NOW, before the long credits roll, so
    // closing the tab mid-credits can't leave it unset (Arcade would relock).
    if (bossWin && isFinalVisibleWorld(this.worldId) && worldFullyCleared && !progress.endingSeen) {
      progress.markEndingSeen();
      this.registry.set('currentWorldId', this.worldId);
      this.registry.set('creditsMode', 'cliffhanger');
      this.scene.start('CreditsScene');
      return;
    }

    // Chapter 2 finale (W28 The Singularity Cell): first clear triggers the
    // GRAND finale: credits, the homeward coda and the Nanocraft reward banner.
    // The personalized hero card plays at the Chapter 3 homecoming (World 38).
    // markFinaleSeen persists the flag AND grants the rewards early (atomic), so
    // closing the tab mid-credits can't strand the trophy.
    if (bossWin && isFinaleWorld(this.worldId) && worldFullyCleared && !progress.finaleSeen) {
      progress.markFinaleSeen();
      // Beating the grand finale must also guarantee the Arcade unlock. Normally
      // W11 sets endingSeen first, but a player who reaches W28 another way (e.g.
      // dev "clear all worlds", which leaves the narrative flags untouched) would
      // otherwise finish the whole game with Arcade still locked. Idempotent.
      progress.markEndingSeen();
      this.registry.set('currentWorldId', this.worldId);
      this.registry.set('creditsMode', 'finale');
      this.scene.start('CreditsScene');
      return;
    }

    // Boss-win path runs the 4-beat defeat cinematic between the data writes
    // above and the summary surface below. Non-boss rounds skip straight to
    // the post-round flow.
    const afterCinematic = () => {
      if (clearedThisRun && !this.freePlay && !this.world?.hidden) {
        progress.setJustClearedWorld(this.worldId);
        this.showWorldClearBanner(() => proceedToSummary());
      } else {
        proceedToSummary();
      }
    };

    if (bossWin && bossAsteroid) {
      import('../BossDefeatCinematic.js').then(({ playBossDefeatCinematic }) => {
        playBossDefeatCinematic(this, bossAsteroid, afterCinematic);
      });
    } else {
      afterCinematic();
    }
  }

  calculateBossStars() {
    const lost = SHIP_HP_MAX - this.shipHp;
    // The Glitch boss (Datamosh) is a 22-hit gauntlet of visually corrupted
    // problems (5.5s each). A zero-damage run is effectively impossible for a
    // kid, so give it a small 3-star damage budget — you can slip up to twice
    // and still earn 3 stars. Normal bosses are shorter, so they keep the
    // flawless-run requirement for 3 stars.
    if (this.isGlitchBoss || this.worldId === 17) {
      // King Coli (17) is a ~40-hit superboss like the Glitch gauntlet — a
      // flawless run is unrealistic, so allow a small mistake budget for 3 stars.
      if (lost <= 2) return 3;
      if (lost <= 3) return 2;
      return 1;
    }
    if (lost === 0) return 3;
    if (lost <= 2) return 2;
    return 1;
  }

  showSummary({ stars, accuracy, bossWin, evolvedTo, firstMastery, baseBonus = 0, masteryBonus = 0, dailyBonus = 0, glitchUnlocked = false, glitchBonus = 0, kingColiUnlocked = false, kingColiBonus = 0 }) {
    if (this.scoreGroup) {
      this.scoreGroup.forEach(o => this.tweens.add({
        targets: o, alpha: 1, duration: 240, ease: 'Quad.easeOut'
      }));
    }

    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(50).setInteractive();
    this.tweens.add({ targets: overlay, fillAlpha: 0.7, duration: 350 });

    // Reward banners (evolved / unlocked / first mastery) stack in their own
    // lane at the top of the card, each pill sized from its text, and the
    // card grows by the lane's height so nothing covers the title.
    const banners = [];
    if (evolvedTo) {
      const sp = companion.getSpecies();
      const lore = sp.stages[evolvedTo];
      banners.push({ kind: 'evolved', banner: this._makeResultsBanner({
        text: `EVOLVED: ${lore.name.toUpperCase()}!`,
        fill: COLORS.accentPurple, ink: '#1a0a26'
      }) });
    }
    if (glitchUnlocked) {
      banners.push({ kind: 'glitch', banner: this._makeResultsBanner({
        text: `UNLOCKED: GLITCH MODULE\n+ ${glitchBonus} STARDUST`,
        fill: 0x39ff14, stroke: 0xff00ff, ink: '#0a0a1a'
      }) });
    }
    if (kingColiUnlocked) {
      banners.push({ kind: 'kingColi', banner: this._makeResultsBanner({
        text: `UNLOCKED: AEGIS HULL\n+ ${kingColiBonus} STARDUST`,
        fill: 0x6b8f3a, stroke: 0xeed25a, ink: '#0a0a1a'
      }) });
    }
    if (firstMastery) {
      banners.push({ kind: 'mastery', banner: this._makeResultsBanner({
        text: 'FIRST MASTERY! +5 STARDUST',
        fill: COLORS.warning, stroke: 0xffae3a, ink: '#1a1208',
        icon: (g, x) => drawStarIcon(g, x, 0, 16, COLORS.bgPanel, 0xffffff)
      }) });
    }
    const bannerGap = 12;
    let laneH = 0;
    if (banners.length) {
      laneH = 28 + banners.reduce((sum, b) => sum + b.banner.bannerH, 0) + bannerGap * (banners.length - 1) + 4;
    }

    const panelW = 880;
    const panelH = 980 + laneH;
    // Tall cards (several banners) slide a little lower so they clear the top bar.
    const panelRestY = Math.max(H / 2, TOP_BAR_H + 20 + panelH / 2);
    const top = -panelH / 2 + laneH;
    const panel = this.add.container(W / 2, H + panelH / 2).setDepth(60);

    const bg = this.add.graphics();
    bg.fillStyle(COLORS.bgPanel, 0.98);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 32);
    bg.lineStyle(3, bossWin ? COLORS.error : this.world.accentColor, 0.9);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 32);
    panel.add(bg);

    panel.add(this.add.text(0, top + 80, bossWin ? 'Boss Defeated!' : "Time's Up!", style('display', {
      fontSize: '60px'
    })).setOrigin(0.5));

    panel.add(this.add.text(0, top + 148, this.modeConfig.label.toUpperCase(), style('caption', {
      fill: '#cfcfe0', fontSize: '36px', fontStyle: '800'
    })).setOrigin(0.5));

    const starY = top + 260;
    for (let i = 0; i < 3; i++) {
      const filled = i < stars;
      const star = this.makeStarShape(filled);
      star.x = -160 + i * 160;
      star.y = starY;
      star.setScale(0);
      panel.add(star);
      this.tweens.add({
        targets: star,
        scale: 1.2,
        duration: 250,
        delay: 700 + i * 200,
        ease: 'Back.easeOut',
        onStart: () => filled && audio.playStar()
      });
    }

    // Stat columns sit 270 apart so the 36px labels (BEST STREAK is the
    // widest) keep clear air between them.
    const statY = starY + 220;
    const statColX = 270;
    const statLabelY = statY + 72;
    const statLabelStyle = style('caption', { fontSize: '36px', fill: '#cfcfe0', fontStyle: '800' });
    panel.add(this.add.text(-statColX, statY, this.correctAnswers.toString(), style('display', {
      fontSize: '78px',
      fill: '#ffffff'
    })).setOrigin(0.5));
    panel.add(this.add.text(-statColX, statLabelY, 'CORRECT', statLabelStyle).setOrigin(0.5));

    panel.add(this.add.text(0, statY, `${accuracy}%`, style('display', {
      fontSize: '78px',
      fill: '#' + this.world.accentColor.toString(16).padStart(6, '0')
    })).setOrigin(0.5));
    panel.add(this.add.text(0, statLabelY, 'ACCURACY', statLabelStyle).setOrigin(0.5));

    panel.add(this.add.text(statColX, statY, this.bestStreak.toString(), style('display', {
      fontSize: '78px',
      fill: '#ff8b3d'
    })).setOrigin(0.5));
    panel.add(this.add.text(statColX, statLabelY, 'BEST STREAK', statLabelStyle).setOrigin(0.5));

    // Summary pet — confetti moment + gentle happy idle. Three-star clears
    // get a rotating star halo behind the pet for extra ceremony.
    if (companion.hasStarter()) {
      const petX = 320;
      const petY = top + 230;
      const petScale = 1.6;

      // Halo: 8-pointed star shape behind the pet, only on 3-star clears.
      let halo = null;
      if (stars >= 3) {
        halo = this.add.graphics();
        const N = 8;
        const innerR = 36;
        const outerR = 92;
        halo.fillStyle(this.world.accentColor, 0.25);
        for (let i = 0; i < N * 2; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const a = (i / (N * 2)) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (i === 0) halo.moveTo(x, y);
          else halo.lineTo(x, y);
        }
        halo.closePath();
        halo.fillPath();
        halo.setPosition(petX, petY);
        halo.setAlpha(0);
        panel.add(halo);
        this.tweens.add({
          targets: halo, alpha: 0.25, duration: 400, delay: 700,
        });
        this.tweens.add({
          targets: halo, angle: 360, duration: 12000,
          repeat: -1, ease: 'Linear',
        });
      }

      const pet = drawCompanion(this, petX, petY, { scale: petScale });
      panel.add(pet);
      pet.setScale(0);
      this.tweens.add({
        targets: pet,
        scale: petScale,
        duration: 320,
        delay: 600,
        ease: 'Back.easeOut',
        onComplete: () => {
          pet.bounceHappy?.();

          // Confetti burst: 14 particles (20 on 3-star) in pet accent + gold +
          // white, radiating outward over 800ms with Cubic.easeOut.
          const accent = pet.species?.accent ?? 0xff8b3d;
          const colors = [accent, 0xf7dc6f, 0xffffff];
          const count = stars >= 3 ? 20 : 14;
          for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
            const dist = 90 + Math.random() * 90;
            const p = this.add.graphics();
            p.fillStyle(colors[i % colors.length], 1);
            p.fillCircle(0, 0, 4 + Math.random() * 3);
            p.setPosition(petX, petY);
            panel.add(p);
            this.tweens.add({
              targets: p,
              x: petX + Math.cos(angle) * dist,
              y: petY + Math.sin(angle) * dist,
              alpha: 0,
              duration: 800,
              ease: 'Cubic.easeOut',
              onComplete: () => p.destroy(),
            });
          }

          // Gentle happy idle — 3% scale breathe, 1.6s loop. Replaces the
          // periodic bounceHappy ping from the legacy summary.
          this.tweens.add({
            targets: pet,
            scale: { from: petScale, to: petScale * 1.03 },
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
      });
    }

    let laneY = -panelH / 2 + 28;
    banners.forEach(({ kind, banner }) => {
      banner.y = laneY + banner.bannerH / 2;
      laneY += banner.bannerH + bannerGap;
      panel.add(banner);
      if (kind === 'evolved') return;
      this.tweens.add({
        targets: banner, scale: { from: 0.6, to: 1 },
        duration: 320, ease: 'Back.easeOut'
      });
      if (kind === 'glitch') {
        audio.playGlitchStatic?.({ duration: 0.28, peakGain: 0.15 });
      } else if (kind === 'kingColi') {
        audio.playStardustChime?.();
      } else if (kind === 'mastery') {
        audio.playStar?.();
        this.time.delayedCall(180, () => audio.playStar?.());
        this.time.delayedCall(360, () => audio.playStar?.());
      }
    });

    const btnY = panelH / 2 - 110;

    // Stardust earned — pill chip with animated counter.
    if (this.stardustEarned > 0) {
      const dustY = btnY - 214;
      const total = this.stardustEarned;

      // Width is sized for the final value so the chip doesn't reflow mid-tween.
      const finalLabel = this.add.text(0, 0, `+${total} STARDUST`, style('subhead', {
        fontSize: '36px', fill: '#ffffff', fontStyle: '900',
        stroke: '#0a0a18', strokeThickness: 3
      })).setOrigin(0, 0.5);
      const finalLabelW = finalLabel.width;
      finalLabel.destroy();

      const iconBoxW = 50;
      const gap = 14;
      const totalW = iconBoxW + gap + finalLabelW;
      const chipW = Math.max(360, totalW + 70);
      const chipH = 76;
      const r = chipH / 2;
      const groupLeft = -totalW / 2;

      const chip = this.add.container(0, dustY);

      const halo = this.add.graphics();
      halo.fillStyle(COLORS.accentPurple, 0.20);
      halo.fillRoundedRect(-chipW / 2 - 8, -chipH / 2 - 4, chipW + 16, chipH + 8, r + 4);
      chip.add(halo);

      const pill = this.add.graphics();
      pill.fillStyle(COLORS.bgTrack, 1);
      pill.fillRoundedRect(-chipW / 2, -chipH / 2, chipW, chipH, r);
      pill.fillStyle(0xffffff, 0.06);
      pill.fillRoundedRect(-chipW / 2 + 4, -chipH / 2 + 3, chipW - 8, chipH * 0.30, {
        tl: r - 2, tr: r - 2, bl: 6, br: 6
      });
      pill.fillStyle(COLORS.bgDark, 0.40);
      pill.fillRoundedRect(-chipW / 2 + 4, chipH / 2 - chipH * 0.30 - 3, chipW - 8, chipH * 0.30, {
        tl: 6, tr: 6, bl: r - 2, br: r - 2
      });
      pill.lineStyle(2, COLORS.accentPurple, 0.85);
      pill.strokeRoundedRect(-chipW / 2, -chipH / 2, chipW, chipH, r);
      chip.add(pill);

      const iconG = this.add.graphics();
      iconG.x = groupLeft + iconBoxW / 2;
      drawSparkleIcon(iconG, 0, 0, 22, COLORS.accentPurple);
      chip.add(iconG);

      const labelObj = this.add.text(groupLeft + iconBoxW + gap, 0, `+0 STARDUST`, style('subhead', {
        fontSize: '36px', fill: '#ffffff', fontStyle: '900',
        stroke: '#0a0a18', strokeThickness: 3
      })).setOrigin(0, 0.5);
      chip.add(labelObj);

      // Bonus breakdown lines below the chip (briefly visible)
      const bonusLines = [];
      if (masteryBonus > 0) bonusLines.push({ text: `+${masteryBonus} first mastery`, color: '#f7dc6f' });
      if (dailyBonus > 0)   bonusLines.push({ text: `+${dailyBonus} welcome back!`,   color: '#9be8a3' });
      const bonusContainer = this.add.container(0, chipH / 2 + 30);
      bonusLines.forEach((bl, i) => {
        const t = this.add.text(0, i * 46, bl.text, style('caption', {
          fontSize: '36px', fill: bl.color, fontStyle: '900'
        })).setOrigin(0.5);
        t.alpha = 0;
        bonusContainer.add(t);
        this.tweens.add({
          targets: t,
          alpha: { from: 0, to: 1 },
          duration: 300,
          delay: 1700 + i * 200,
          ease: 'Sine.easeOut'
        });
      });
      chip.add(bonusContainer);

      panel.add(chip);

      // Counter ticks up from 0 to total. The chip animates with the panel
      // sliding in; the count animation conveys the reward.
      let lastTickAt = 0;
      this.tweens.addCounter({
        from: 0, to: total,
        duration: Math.min(900, 300 + total * 30),
        ease: 'Cubic.easeOut',
        onUpdate: (tw) => {
          const v = Math.round(tw.getValue());
          labelObj.setText(`+${v} STARDUST`);
          const now = this.time.now;
          if (v < total && now - lastTickAt > 80) {
            lastTickAt = now;
            audio.playStardustTick?.();
          }
        },
        onComplete: () => {
          labelObj.setText(`+${total} STARDUST`);
          audio.playStardustChime?.();
        }
      });
    }

    panel.add(createButton(this, {
      x: -160, y: btnY, label: 'Retry',
      width: 280, height: 92,
      color: 0x4a4a6a,
      onClick: () => this.scene.restart()
    }));
    panel.add(createButton(this, {
      x: 160, y: btnY, label: 'Continue',
      width: 280, height: 92,
      color: this.world.accentColor,
      onClick: () => this.exitToLevelSelect()
    }));

    this.tweens.add({
      targets: panel,
      y: panelRestY,
      duration: 500,
      ease: 'Back.easeOut'
    });
  }

  // A results reward pill sized from its text: up to 800 wide, wrapping to
  // more lines when needed. `icon(g, x)` draws an optional glyph left of the
  // text. Returns the container with its height on `bannerH`.
  _makeResultsBanner({ text, fill, stroke = null, ink, icon = null }) {
    const maxW = 800;
    const padX = 36;
    const padY = 14;
    const iconW = icon ? 48 : 0;
    const label = this.add.text(0, 0, text, style('subhead', {
      fontSize: '36px', fill: ink, fontStyle: '900', align: 'center',
      wordWrap: { width: maxW - padX * 2 - iconW }
    })).setOrigin(0, 0.5);
    const contentW = iconW + Math.ceil(label.width);
    const w = Math.min(maxW, contentW + padX * 2);
    const h = Math.ceil(label.height) + padY * 2;
    const r = Math.min(34, h / 2);
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(fill, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    if (stroke !== null) {
      g.lineStyle(3, stroke, 1);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    }
    c.add(g);
    const left = -contentW / 2;
    if (icon) {
      const ig = this.add.graphics();
      icon(ig, left + 18);
      c.add(ig);
    }
    label.x = left + iconW;
    c.add(label);
    c.bannerH = h;
    return c;
  }

  makeStarShape(filled) {
    const g = this.add.graphics();
    drawStarIcon(g, 0, 0, 44, filled ? COLORS.warning : 0x6a6a80, 0xffffff);
    if (!filled) {
      g.clear();
      g.lineStyle(3, 0x6a6a80, 1);
      const points = 5;
      const outerR = 44;
      const innerR = 18;
      g.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.strokePath();
    }
    return g;
  }

  getWeakFactsFromHistory() {
    const stats = new Map();
    for (const h of this.history) {
      const key = h.problem.display;
      const e = stats.get(key) || { display: h.problem.display, answer: h.problem.answer, correct: 0, total: 0 };
      e.total++;
      if (h.correct) e.correct++;
      stats.set(key, e);
    }
    return [...stats.values()]
      .filter(e => e.total >= 1 && e.correct < e.total)
      .sort((a, b) => (a.correct / a.total) - (b.correct / b.total));
  }

  showFinalCinematic() {
    const cards = [
      'The Void Devourer cracks. Light leaks through.',
      'Across the galaxy, dark worlds flicker awake.',
      'Stars relight. Old constellations remember their names.',
      'You did it, pilot. The universe is yours again.'
    ];

    const backdrop = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0)
      .setDepth(40).setInteractive();
    this.tweens.add({ targets: backdrop, alpha: 0.95, duration: 700 });

    const starLayer = this.add.container(0, 0).setDepth(45);
    for (let i = 0; i < 80; i++) {
      const sx = Math.random() * W;
      const sy = Math.random() * (H - 200) + 80;
      const r = Math.random() * 2 + 1.2;
      const star = this.add.graphics();
      star.fillStyle(0xffffff, 1);
      star.fillCircle(sx, sy, r);
      star.alpha = 0;
      starLayer.add(star);
      this.tweens.add({
        targets: star,
        alpha: 1,
        duration: 600 + Math.random() * 1200,
        delay: 400 + Math.random() * 2400,
        ease: 'Quad.easeOut'
      });
    }

    let cardIdx = 0;
    const cardContainer = this.add.container(W / 2, H / 2).setDepth(60);

    const showCard = (text, last) => {
      const cardW = 880;
      const cardH = 280;
      const card = this.add.container(0, 30);
      const bg = this.add.graphics();
      bg.fillStyle(COLORS.bgPanel, 0.92);
      bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 28);
      bg.lineStyle(3, 0xffeaa7, 0.95);
      bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 28);
      card.add(bg);
      card.add(this.add.text(0, 0, text, style('subhead', {
        fontSize: '34px',
        fill: '#ffeaa7',
        align: 'center',
        wordWrap: { width: cardW - 80 }
      })).setOrigin(0.5));
      card.alpha = 0;
      cardContainer.add(card);
      this.tweens.add({
        targets: card,
        alpha: 1,
        y: 0,
        duration: 500,
        ease: 'Quad.easeOut'
      });

      const advance = () => {
        this.tweens.add({
          targets: card,
          alpha: 0,
          y: -30,
          duration: 400,
          onComplete: () => {
            card.destroy();
            cardIdx++;
            if (cardIdx < cards.length) {
              showCard(cards[cardIdx], cardIdx === cards.length - 1);
            }
          }
        });
      };

      if (last) {
        this.time.delayedCall(900, () => {
          const pet = drawCompanion(this, 0, cardH / 2 + 120, { scale: 1.2 });
          cardContainer.add(pet);
          this.tweens.add({
            targets: pet,
            y: cardH / 2 + 90,
            scaleX: 1.2,
            scaleY: 1.0,
            duration: 280,
            yoyo: true,
            repeat: 3,
            ease: 'Sine.easeInOut'
          });
          cardContainer.add(createButton(this, {
            x: 0, y: cardH / 2 + 280, label: 'Onward',
            width: 320, height: 92,
            color: 0xffeaa7,
            onClick: () => this.exitToLevelSelect()
          }));
        });
      } else {
        this.time.delayedCall(2400, advance);
      }
    };

    this.time.delayedCall(900, () => showCard(cards[0], false));
  }

  exitToLevelSelect() {
    // Ignore the top-bar back arrow mid-warp — the warp animation owns the
    // scene transition, so a stray tap here would abort it and skip the payoff.
    if (this.state === 'warp') return;
    // Arcade runs (Endless / Boss Rush) live outside the campaign — back/quit
    // returns to the arcade hub, not the world's level select.
    if (this.arcadeMode) {
      new TransitionManager(this).fadeToScene('ArcadeMenuScene');
      return;
    }
    // If a world clear is pending auto-advance, jump straight to the map
    // so the ship animates to the next world. Secret challenges have no
    // mission briefing of their own, so they always go back to the map.
    if (progress.justClearedWorld || this.world?.hidden) {
      this.scene.start('WorldMapScene');
    } else {
      this.scene.start('LevelSelectScene');
    }
  }

  // Inverse of the pause applied in openPauseMenu: resume the shared
  // clock/tweens/physics and clear the flag. Self-guards on _pauseOpen so it's
  // safe to call from the Resume button, overlay tap, or shutdown teardown.
  _resumePausedSystems() {
    if (!this._pauseOpen) return;
    this.tweens.resumeAll();
    this.time.paused = false;
    if (this.physics?.world) this.physics.world.resume();
    this._pauseOpen = false;
  }

  openPauseMenu() {
    if (this._pauseOpen) return;
    this._pauseOpen = true;
    audio.playClick?.();
    // Pause timers + physics so the asteroid clock stops.
    this.tweens.pauseAll();
    this.time.paused = true;
    if (this.physics?.world) this.physics.world.pause();

    // Idempotent: safe to call from any close path. The modal's overlay-tap
    // dismiss routes through onClose below, so a kid who taps outside the
    // panel also resumes the game instead of stranding tweens/time paused.
    const resumeAll = () => this._resumePausedSystems();

    const { card, close } = createModal(this, {
      width: 760, height: 760,
      depth: 100,
      overlayAlpha: 0.7,
      accentColor: this.world.accentColor,
      showCloseHint: false,
      onClose: resumeAll
    });

    card.add(this.add.text(0, -300, 'PAUSED', style('display', {
      fontSize: '64px',
      fill: '#ffffff'
    })).setOrigin(0.5));

    card.add(createButton(this, {
      x: 0, y: -160, width: 420, height: 88,
      label: 'Resume',
      color: 0x39ff14,
      textOverrides: { fontSize: '42px', fill: '#0a0a1a', fontStyle: '900' },
      onClick: () => close()
    }));

    // Sound + Music toggles — render once, redraw on tap.
    let soundBtn = null, musicBtn = null;
    const labelFor = (on, kind) => `${kind}: ${on ? 'ON' : 'OFF'}`;
    const rebuild = () => {
      if (soundBtn) soundBtn.destroy();
      if (musicBtn) musicBtn.destroy();
      soundBtn = createButton(this, {
        x: 0, y: -52, width: 420, height: 88,
        label: labelFor(audio.enabled, 'Sound'),
        color: audio.enabled ? 0xb6e0ff : 0x4a4a5a,
        // No fill: createButton picks dark ink on the light ON face and white
        // on the gray OFF face, so both states stay readable.
        textOverrides: { fontSize: '42px', fontStyle: '900' },
        onClick: () => {
          audio.setEnabled?.(!audio.enabled);
          rebuild();
        }
      });
      musicBtn = createButton(this, {
        x: 0, y: 56, width: 420, height: 88,
        label: labelFor(music.enabled, 'Music'),
        color: music.enabled ? 0xc77eff : 0x4a4a5a,
        textOverrides: { fontSize: '42px', fontStyle: '900' },
        onClick: () => {
          music.setEnabled?.(!music.enabled);
          rebuild();
        }
      });
      card.add(soundBtn);
      card.add(musicBtn);
    };
    rebuild();

    card.add(createButton(this, {
      x: 0, y: 180, width: 420, height: 88,
      label: 'Quit to Map',
      color: 0xff5b6e,
      textOverrides: { fontSize: '42px', fill: '#ffffff', fontStyle: '900' },
      onClick: () => {
        resumeAll();
        close();
        this.scene.start('WorldMapScene');
      }
    }));
  }

  // ============================================================
  // WARP ASTEROID — discovery gateway to hidden worlds.
  // Spawns once per session when the kid plays a host level (W5 div or
  // W9 mixed) and the hidden world isn't yet discovered.
  // ============================================================
  spawnWarpAsteroid() {
    const problem = getProblemForWorld(this.worldId, this.mode);

    // Centered chonky asteroid, falls slower.
    const xLane = W / 2;
    const container = this.add.container(xLane, ASTEROID_TOP_Y).setDepth(7);

    // Body: bigger purple-magenta gradient blob with floating "?" glyphs.
    const body = this.add.graphics();
    body.fillStyle(0x7c3aed, 1);
    body.fillCircle(0, 0, ASTEROID_RADIUS * 1.5);
    body.fillStyle(0xf0abfc, 0.4);
    body.fillCircle(-30, -28, ASTEROID_RADIUS * 0.8);
    body.lineStyle(6, 0xff00ff, 0.95);
    body.strokeCircle(0, 0, ASTEROID_RADIUS * 1.5);
    container.add(body);

    // Sparkles
    for (let i = 0; i < 8; i++) {
      const sp = this.add.graphics();
      sp.fillStyle(0xffffff, 1);
      sp.fillCircle(0, 0, 4);
      const a = (i / 8) * Math.PI * 2;
      sp.x = Math.cos(a) * (ASTEROID_RADIUS * 1.55);
      sp.y = Math.sin(a) * (ASTEROID_RADIUS * 1.55);
      container.add(sp);
      this.tweens.add({
        targets: sp,
        alpha: { from: 0.3, to: 1 },
        duration: 600 + i * 80,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    // Floating "?" glyphs orbiting
    for (let i = 0; i < 3; i++) {
      const q = this.add.text(0, 0, '?', style('display', {
        fontSize: '54px',
        art: true,
        fill: '#ff00ff',
        stroke: '#0a0a1a',
        strokeThickness: 4
      })).setOrigin(0.5);
      const baseAngle = (i / 3) * Math.PI * 2;
      const r = ASTEROID_RADIUS * 1.85;
      q.x = Math.cos(baseAngle) * r;
      q.y = Math.sin(baseAngle) * r;
      container.add(q);
      this.tweens.add({
        targets: q,
        scale: { from: 0.9, to: 1.15 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    // The equation text
    const text = this.add.text(0, 0, problem.display, style('display', {
      fontSize: '70px',
      fill: '#ffffff',
      stroke: '#0a0a1a',
      strokeThickness: 7
    })).setOrigin(0.5);
    container.add(text);

    // Slow rotational sway for the whole asteroid
    this.tweens.add({
      targets: container,
      angle: 4,
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const fallSeconds = this.problemSeconds * 2.4; // Falls much slower.
    const asteroid = {
      container, text, problem,
      phase: 'falling',
      fallTween: null,
      startedAtMs: performance.now(),
      isBoss: false,
      _isWarp: true
    };
    this._startAsteroidFall(asteroid, ASTEROID_IMPACT_Y, fallSeconds * 1000);
    this.activeAsteroids.push(asteroid);
    this.targetAsteroid(asteroid);
    // Belt + braces: if a delayed callback or correction card left state in
    // a non-playing mode, the warp's arrival is the moment to unlock input.
    // setState self-guards on from===next, so the bare call is a no-op when
    // already 'playing'.
    this.setState('playing');

    this.playPetFreakout();
  }

  playPetFreakout() {
    if (!this.cockpitPet) return;
    const sp = companion.getSpecies();
    const accent = sp?.accent || 0xff00ff;

    if (this.shipContainer) {
      const halo = this.add.graphics().setDepth(7);
      halo.fillStyle(accent, 0.7);
      halo.fillCircle(0, 0, 60);
      halo.x = this.shipContainer.x + (this.shipG?.portholeCenter?.x || 0);
      halo.y = this.shipContainer.y + (this.shipG?.portholeCenter?.y || -120);
      halo.alpha = 0;
      halo.setScale(0.3);
      this.tweens.add({
        targets: halo,
        alpha: { from: 0.6, to: 0 },
        scale: 2.5,
        duration: 900,
        ease: 'Quad.easeOut',
        onComplete: () => halo.destroy()
      });
    }

    this.tweens.add({
      targets: this.cockpitPet,
      scaleX: 0.85,
      scaleY: 0.85,
      duration: 140,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut'
    });

    const exclaim = this.add.text(this.shipContainer.x, this.shipContainer.y - 200, '!', style('display', {
      fontSize: '80px',
      fill: '#ff00ff',
      stroke: '#0a0a1a',
      strokeThickness: 6
    })).setOrigin(0.5).setDepth(20);
    exclaim.setScale(0);
    this.tweens.add({
      targets: exclaim,
      scale: 1.4,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(900, () => {
          this.tweens.add({
            targets: exclaim,
            alpha: 0,
            y: exclaim.y - 30,
            duration: 400,
            onComplete: () => exclaim.destroy()
          });
        });
      }
    });

    audio.playPetChirp?.();
  }

  triggerWarp(asteroid) {
    // Lock the scene and play a hyperspace warp animation, then load the
    // hidden world. Marks discovery so it doesn't re-spawn here next time.
    this.setState('warp');
    if (this.warpTargetId) {
      progress.discoverHiddenWorld(this.warpTargetId);
    }

    const hiddenId = this.warpTargetId;
    const dest = findWorld(hiddenId);
    const destName = dest?.name?.toUpperCase() || 'HIDDEN WORLD';

    // Audio kicks in the instant the answer lands — long whoosh that runs
    // through the streak phase and resolves just before the scene swap.
    audio.playWarp?.();
    // Quick magenta flash + a held camera shake sells the "engine kick".
    this.cameras.main.flash(220, 180, 0, 200);
    this.cameras.main.shake(1400, 0.010);

    // Pull the ship "into hyperspace" — it lifts off, shrinks, and fades
    // the same way a ship leaving a node on the world map would feel.
    if (this.shipContainer) {
      this.tweens.add({
        targets: this.shipContainer,
        y: this.shipContainer.y - 220,
        scale: 0.2,
        alpha: 0,
        duration: 700,
        ease: 'Quad.easeIn'
      });
    }

    const streak = this.add.graphics().setDepth(80);
    streak.fillStyle(0x000010, 1);
    streak.fillRect(0, 0, W, H);
    streak.alpha = 0;
    this.tweens.add({
      targets: streak,
      alpha: 1,
      duration: 600,
      ease: 'Quad.easeIn'
    });

    const streakLayer = this.add.container(W / 2, H / 2).setDepth(82);
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r0 = 80 + Math.random() * 460;
      const star = this.add.graphics();
      star.fillStyle(0xffffff, 1);
      star.fillRect(-2, -2, 4, 60);
      star.rotation = angle + Math.PI / 2;
      star.x = Math.cos(angle) * r0;
      star.y = Math.sin(angle) * r0;
      streakLayer.add(star);
      this.tweens.add({
        targets: star,
        x: Math.cos(angle) * (r0 * 3.4),
        y: Math.sin(angle) * (r0 * 3.4),
        scaleY: 8,
        alpha: 0,
        duration: 950 + Math.random() * 350,
        ease: 'Quad.easeIn'
      });
    }

    // Concentric portal rings rushing outward — a "tunnel" feel that
    // reinforces the moving-into-the-world animation.
    for (let i = 0; i < 4; i++) {
      const ring = this.add.graphics().setDepth(81);
      ring.lineStyle(6, 0xff00ff, 0.85);
      ring.strokeCircle(0, 0, 30);
      ring.x = W / 2; ring.y = H / 2;
      ring.alpha = 0;
      this.tweens.add({
        targets: ring,
        scale: 24,
        alpha: { from: 0.9, to: 0 },
        duration: 1100,
        delay: i * 180,
        ease: 'Quad.easeOut',
        onComplete: () => ring.destroy()
      });
    }

    this.time.delayedCall(600, () => {
      const banner = this.add.container(W / 2, H / 2).setDepth(85);
      const bg = this.add.graphics();
      bg.fillStyle(0x0a0a1a, 0.95);
      bg.fillRoundedRect(-440, -120, 880, 240, 24);
      bg.lineStyle(5, 0xff00ff, 1);
      bg.strokeRoundedRect(-440, -120, 880, 240, 24);
      banner.add(bg);
      banner.add(this.add.text(0, -42, 'WARP ACTIVATED', style('display', {
        fontSize: '64px',
        fill: '#ff00ff',
        stroke: '#0a0a1a',
        strokeThickness: 5
      })).setOrigin(0.5));
      banner.add(this.add.text(0, 46, `→  ${destName}`, style('subhead', {
        fontSize: '42px',
        fill: '#ffffff'
      })).setOrigin(0.5));
      banner.setScale(0.5);
      banner.alpha = 0;
      this.tweens.add({
        targets: banner,
        scale: 1,
        alpha: 1,
        duration: 380,
        ease: 'Back.easeOut'
      });
      audio.playBossIntroSlam?.();
    });

    this.time.delayedCall(2200, () => {
      // Hand off to the world map. It picks up these flags in tryWarpArrival,
      // animates the ship along the dashed branch from the host world to the
      // newly discovered hidden world, then starts the destination scene.
      this.registry.set('hiddenWorldId', hiddenId);
      this.registry.set('warpArrivalHiddenId', hiddenId);
      this.registry.set('warpArrivalFromWorldId', this.worldId);
      this.scene.start('WorldMapScene');
    });
  }
}
