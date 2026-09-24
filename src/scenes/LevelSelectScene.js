// Mission Briefing — the world's biome art fills the background, four mission
// cards in front (×, ÷, mixed, boss). Locked modes show a lock icon.

import Phaser from 'phaser';
import { WORLDS, MODES, progress, findWorld, getWorldMusicRate, getNextVisibleWorldId, usesConveyorScene } from '../GameData.js';
import { CONVEYOR_CHAPTER } from './ConveyorScene.js';
import { audio } from '../AudioManager.js';
import { music } from '../MusicManager.js';
import { TransitionManager } from '../TransitionManager.js';
import { createStarfield } from '../starfieldHelper.js';
import { getWorldBackground } from '../WorldBackgrounds.js';
import { createIconButton, createProgressBar } from '../buttonHelper.js';
import { style } from '../textStyles.js';
import { drawWorldNode } from '../WorldNodeArt.js';
import {
  drawArrowLeftIcon, drawSoundIcon, drawSkullIcon,
  drawStarIcon, drawLockIcon
} from '../StatIcons.js';
import { COLORS } from '../colorPalette.js';
import { hexStr } from '../colorUtils.js';

const W = 1080;
const H = 1920;

const LEVEL_MODES = ['mult', 'div', 'mixed', 'boss'];

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LevelSelectScene' });
  }

  create() {
    // Defense-in-depth: LevelSelect is a campaign / free-play entry, never an
    // arcade one. Clear any arcadeMode left over so a level tapped here can't
    // accidentally launch GameScene in arcade mode.
    this.registry.set('arcadeMode', null);
    this.registry.set('arcadeState', null);
    const worldId = this.registry.get('selectedWorld') || 1;
    this.world = findWorld(worldId) || WORLDS[0];
    this.worldProgress = progress.getWorldProgress(worldId);

    // The mission briefing plays THIS world's song (its level theme), so it's
    // not silent and it carries seamlessly into GameScene — which fades to the
    // same track and just re-applies the per-world pitch. Chapter 2 prefers its
    // bespoke Inner Space level track, falling back to the Ch1 theme if missing.
    // The chapter's level theme comes from the single CONVEYOR_CHAPTER source (also
    // read by the belt), so this briefing track and the belt handoff can't desync.
    // Ch1 resolves to 'levelTheme'; Ch2/Ch3 to their bespoke tracks (falling back to
    // the Ch1 theme until those MP3s ship).
    const trackKey = CONVEYOR_CHAPTER[this.world.chapter]?.levelTrack;
    const worldSong = trackKey ? music.resolveTrack(this, trackKey, 'levelTheme') : 'levelTheme';
    music.fadeToTrack(this, worldSong);
    music.setPlaybackRate(getWorldMusicRate(this.world.id), 600);

    this.events.on('wake', this.onSceneWake, this);
    this.events.on('resume', this.onSceneWake, this);
    this.events.once('shutdown', () => {
      this.events.off('wake', this.onSceneWake, this);
      this.events.off('resume', this.onSceneWake, this);
    });

    // Backdrop: Chapters 1 and 2 brief under the cosmic starfield, shooting
    // stars and all. Chapter 3 "Home Ground" is one Saturday around the city, so
    // its briefing shows that world's own sky instead: the bgTop to bgBottom pair
    // from WorldBackgrounds (the same sky the belt and the map use), no stars.
    // The world-accent glow along the bottom edge is kept in both branches.
    if (this.world.chapter === 3) {
      const sky = getWorldBackground(this.world.id);
      const bg = this.add.graphics().setDepth(-10);
      bg.fillGradientStyle(sky.bgTop, sky.bgTop, sky.bgBottom, sky.bgBottom, 1);
      bg.fillRect(0, 0, W, H);
      const glow = this.add.graphics().setDepth(-9);
      glow.fillStyle(this.world.accentColor, 0.20);
      glow.fillEllipse(W / 2, H + H * 0.3, W * 1.4, H * 0.85);
    } else {
      createStarfield(this, {
        width: W, height: H,
        accentColor: this.world.accentColor,
        accentStrength: 0.20
      });
    }

    this.createTopBar();
    this.createWorldHero();
    this.createMissionCards();
    this.createMasteryFooter();

    new TransitionManager(this).fadeIn(280);
  }

  createTopBar() {
    const bg = this.add.graphics().setDepth(4);
    bg.fillStyle(COLORS.bgDark, 0.92);
    bg.fillRect(0, 0, W, 220);

    createIconButton(this, {
      x: 80, y: 110, radius: 44,
      accentColor: this.world.accentColor,
      drawIcon: (g, size) => drawArrowLeftIcon(g, 0, 0, size),
      onClick: () => new TransitionManager(this).fadeToScene('WorldMapScene')
    }).setDepth(15);

    this.add.text(W / 2, 70, 'MISSION BRIEFING', style('headline', {
      fill: '#cfcfe0',
      fontStyle: '900'
    })).setOrigin(0.5).setDepth(15);

    this.add.text(W / 2, 145, this.world.name, style('display', {
      fontSize: '76px',
      fill: hexStr(this.world.accentColor)
    })).setOrigin(0.5).setDepth(15);

    const soundBtn = createIconButton(this, {
      x: W - 80, y: 110, radius: 44,
      accentColor: this.world.accentColor,
      drawIcon: (g, size) => drawSoundIcon(g, 0, 0, size, 0xffffff, audio.enabled),
      onClick: () => { audio.toggleEnabled(); soundBtn.redrawIcon(); }
    });
    soundBtn.setDepth(15);
  }

  createWorldHero() {
    const hero = drawWorldNode(this, W / 2, 530, this.world.id, { scale: 3.0 });
    hero.setDepth(5).setAlpha(0.75);
    this.tweens.add({
      targets: hero,
      y: 520,
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const desc = this.add.text(W / 2, 800, this.world.description, style('subhead', {
      fontSize: '42px',
      fill: '#e8e8f0',
      align: 'center',
      wordWrap: { width: W - 120 }
    })).setOrigin(0.5).setDepth(8);
    this.inkForSky(desc);
  }

  // Home Ground briefings sit on the world's own sky, which runs from pale
  // morning cream to dusk violet. The pale text the starfield chapters use
  // washes out on the light skies, so Chapter 3 text gets a dark stroke that
  // reads on every step of the day arc. No-op for Chapters 1 and 2.
  inkForSky(t) {
    if (this.world.chapter === 3) t.setStroke('#1c2733', 6);
    return t;
  }

  createMissionCards() {
    const startY = 900;
    const cardW = 480;
    const cardH = 220;
    const gapX = 28;
    const gapY = 36;
    const cols = 2;
    const rowWidth = cols * cardW + (cols - 1) * gapX;
    const startX = W / 2 - rowWidth / 2 + cardW / 2;

    LEVEL_MODES.forEach((modeKey, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY) + cardH / 2;
      const levelNum = i + 1;
      const isBoss = modeKey === 'boss';
      const stars = this.worldProgress.levelStars[levelNum] || 0;
      const mastered = progress.isLevelMastered(this.world.id, levelNum);

      // The boss now opens only once the 3 practice missions are MASTERED — so
      // beating the boss is always the move that truly clears the world. Legacy
      // exception: a world already fully cleared under the old (touch-to-clear)
      // rules keeps its boss unlocked, so revisiting never re-locks it.
      const practiceMastered = [1, 2, 3].every(n => progress.isLevelMastered(this.world.id, n));
      const isLocked = isBoss && !practiceMastered && !progress.isWorldFullyCleared(this.world.id);

      this.createMissionCard(x, y, cardW, cardH, levelNum, modeKey, stars, isBoss, isLocked, mastered);
    });
  }

  createMissionCard(x, y, w, h, levelNum, modeKey, stars, isBoss, isLocked, mastered = false) {
    const c = this.add.container(x, y).setDepth(10);
    const accent = isBoss ? COLORS.error : this.world.accentColor;
    // This is a PILOT belt level — the Ch1/Ch2 "mixed" level rerouted into the
    // Conveyor by the owner flag (NOT a Ch3 'sort' world, which is natively a belt
    // and needs no surprise-signal). Used to label the card so it's not a surprise.
    const isPilotBelt = !isBoss && this.world.kind !== 'sort' && usesConveyorScene(this.world, modeKey);
    // A card with a 36px line under its title (the boss's villain name, or the
    // pilot belt verb) lifts its title and rule so that line clears the stars.
    const hasSubline = isBoss || isPilotBelt;
    const ruleY = hasSubline ? -18 : 6;

    // Drop shadow
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.5);
    shadow.fillRoundedRect(-w / 2 + 2, -h / 2 + 8, w, h, 24);
    c.add(shadow);

    // Card body
    const card = this.add.graphics();
    card.fillStyle(COLORS.bgPanel, 0.96);
    card.fillRoundedRect(-w / 2, -h / 2, w, h, 24);
    card.lineStyle(3, accent, isLocked ? 0.4 : 0.9);
    card.strokeRoundedRect(-w / 2, -h / 2, w, h, 24);
    c.add(card);

    // Polish: faint accent wash in the upper section, ending just above the rule
    const accentWash = this.add.graphics();
    accentWash.fillStyle(accent, isLocked ? 0.04 : 0.10);
    accentWash.fillRoundedRect(-w / 2 + 10, -h / 2 + 10, w - 20, ruleY - 5 + h / 2 - 10, 16);
    c.add(accentWash);

    // Polish: thin accent rule under the title block
    const ruleG = this.add.graphics();
    ruleG.fillStyle(accent, isLocked ? 0.25 : 0.55);
    ruleG.fillRect(-w / 2 + 60, ruleY, w - 120, 2);
    c.add(ruleG);

    // ---- Title row: icon + label, centered as a unit ------------------------
    const titleY = hasSubline ? -h / 4 - 9 : -h / 4 + 8;
    const labelStr = isBoss ? 'BOSS' : MODES[modeKey].label.toUpperCase();
    const iconBoxW = 64;
    const gap = 18;

    const labelObj = this.add.text(0, 0, labelStr, style('display', {
      fontSize: '52px',
      fill: '#ffffff',
      fontStyle: '900'
    })).setOrigin(0, 0.5);

    const groupW = iconBoxW + gap + labelObj.width;
    const groupLeft = -groupW / 2;

    const iconG = this.add.graphics();
    iconG.x = groupLeft + iconBoxW / 2;
    iconG.y = titleY;
    if (isBoss) {
      drawSkullIcon(iconG, 0, 0, 34);
    } else {
      this.drawModeGlyph(iconG, modeKey, accent);
    }
    c.add(iconG);

    labelObj.x = groupLeft + iconBoxW + gap;
    labelObj.y = titleY;
    c.add(labelObj);

    const sublineY = 14;
    let villainText = null;
    if (isBoss) {
      villainText = this.add.text(0, sublineY, this.world.villain || 'BOSS', style('subhead', {
        fontSize: '36px',
        fill: '#ff8b8b',
        fontStyle: '900'
      })).setOrigin(0.5);
      c.add(villainText);
    }

    // Pilot signal (Ch1/Ch2 only — on Ch3 every level is already a belt): show the
    // chapter's sort verb so tapping "MIXED" → a conveyor isn't a silent surprise.
    if (isPilotBelt) {
      const verb = CONVEYOR_CHAPTER[this.world.chapter || 1]?.copy.title || 'SORT & SHIP';
      c.add(this.add.text(0, sublineY, verb, style('subhead', {
        fontSize: '36px', fill: hexStr(accent), fontStyle: '900'
      })).setOrigin(0.5));
    }

    // ---- Stars row: centered along the bottom -------------------------------
    const starY = h / 2 - 38;
    const starGap = 64;
    for (let s = 0; s < 3; s++) {
      const earned = s < stars;
      if (earned) {
        const glow = this.add.graphics();
        glow.fillStyle(COLORS.warning, 0.22);
        glow.fillCircle((s - 1) * starGap, starY, 22);
        c.add(glow);
      }
      const starG = this.add.graphics();
      drawStarIcon(starG, 0, 0, 26, earned ? COLORS.warning : 0x3a3a50);
      starG.x = (s - 1) * starGap;
      starG.y = starY;
      c.add(starG);
    }

    // Gold "mastered" badge (top-left) — the mark that this mission counts
    // toward unlocking the next world. Distinct from the star row, which just
    // shows the best result.
    if (mastered && !isLocked) {
      // Tucked into the corner so it stays clear of the 52px title's glyph.
      const bx = -w / 2 + 32;
      const by = -h / 2 + 32;
      const badge = this.add.graphics();
      badge.fillStyle(COLORS.warning, 1);
      badge.fillCircle(bx, by, 24);
      badge.lineStyle(3, 0xffffff, 0.9);
      badge.strokeCircle(bx, by, 24);
      badge.lineStyle(5, COLORS.bgDark, 1);
      badge.beginPath();
      badge.moveTo(bx - 11, by + 1);
      badge.lineTo(bx - 3, by + 10);
      badge.lineTo(bx + 12, by - 10);
      badge.strokePath();
      c.add(badge);
    }

    if (isLocked) {
      const lockBg = this.add.graphics();
      lockBg.fillStyle(COLORS.bgDark, 0.85);
      lockBg.fillCircle(w / 2 - 40, -h / 2 + 40, 28);
      lockBg.lineStyle(2, accent, 0.5);
      lockBg.strokeCircle(w / 2 - 40, -h / 2 + 40, 28);
      c.add(lockBg);
      const lockG = this.add.graphics();
      drawLockIcon(lockG, 0, 0, 24);
      lockG.x = w / 2 - 40;
      lockG.y = -h / 2 + 38;
      c.add(lockG);
      const overlay = this.add.graphics();
      overlay.fillStyle(0x000000, 0.5);
      overlay.fillRoundedRect(-w / 2, -h / 2, w, h, 24);
      c.add(overlay);
      // The villain's name stays readable over the lock shade: it sits above
      // the overlay, only slightly dimmed, instead of at half strength.
      if (villainText) {
        c.bringToTop(villainText);
        villainText.setAlpha(0.8);
      }
    }

    if (!isLocked) {
      const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
      c.add(hit);
      hit.on('pointerover', () => this.tweens.add({ targets: c, scaleX: 1.04, scaleY: 1.04, duration: 110 }));
      hit.on('pointerout', () => this.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 110 }));
      hit.on('pointerdown', () => {
        audio.playClick();
        this.startLevel(levelNum, modeKey);
      });
    }
  }

  drawModeGlyph(g, modeKey, color) {
    if (modeKey === 'mult') {
      // Bold ×
      g.lineStyle(9, color, 1);
      g.lineBetween(-22, -22, 22, 22);
      g.lineBetween(22, -22, -22, 22);
    } else if (modeKey === 'div') {
      // Bold ÷
      g.lineStyle(9, color, 1);
      g.lineBetween(-26, 0, 26, 0);
      g.fillStyle(color, 1);
      g.fillCircle(0, -16, 6);
      g.fillCircle(0, 16, 6);
    } else if (modeKey === 'mixed') {
      // × on the left, ÷ on the right — both readable at a glance
      const dx = 18;
      const sym = 13;
      // ×
      g.lineStyle(7, color, 1);
      g.lineBetween(-dx - sym, -sym, -dx + sym, sym);
      g.lineBetween(-dx + sym, -sym, -dx - sym, sym);
      // ÷
      g.lineStyle(7, color, 1);
      g.lineBetween(dx - sym, 0, dx + sym, 0);
      g.fillStyle(color, 1);
      g.fillCircle(dx, -sym + 1, 4.5);
      g.fillCircle(dx, sym - 1, 4.5);
    }
  }

  // The footer starts higher than it used to (1496, was 1560) so the 52px
  // heading, the 64px bar and the 42px lines below it all end above the bottom
  // edge, even when the course hint wraps to two lines.
  createMasteryFooter() {
    const y = 1496;
    let masterySum = 0;
    let count = 0;
    for (let t = 1; t <= 12; t++) {
      const m = progress.getTableMastery(t);
      if (m > 0) {
        masterySum += m;
        count++;
      }
    }
    const avg = count > 0 ? Math.round(masterySum / count) : 0;

    this.inkForSky(this.add.text(W / 2, y, 'FACT MASTERY', style('subhead', {
      fontSize: '52px',
      fill: '#cfcfe0',
      fontStyle: '900'
    })).setOrigin(0.5).setDepth(11));

    // 64px tall so the 42px percent label sits inside the bar.
    const barW = 820;
    const barH = 64;
    const barY = y + 84;
    const fillColor = avg >= 70 ? COLORS.success : avg >= 40 ? this.world.accentColor : COLORS.error;

    createProgressBar(this, {
      x: W / 2,
      y: barY,
      width: barW,
      height: barH,
      ratio: avg / 100,
      color: fillColor,
      label: `${avg}%`,
      labelOverrides: { fontSize: '42px' },
      depth: 11
    });

    const totalStars = Object.values(this.worldProgress.levelStars).reduce((s, v) => s + v, 0);
    this.inkForSky(this.add.text(W / 2, barY + barH / 2 + 48, `${totalStars} / 12 stars in ${this.world.name}`, style('subhead', {
      fontSize: '42px',
      fill: '#cfcfe0',
      align: 'center',
      wordWrap: { width: W - 120 }
    })).setOrigin(0.5).setDepth(11));

    // Advance status — the brake made visible. While the next world is still
    // locked, show how many missions are mastered and what mastering them all
    // opens, so a gated next world is never a mystery. Hidden once unlocked
    // (no nagging) and on worlds with no sequential successor.
    const nextId = getNextVisibleWorldId(this.world.id);
    const nextWorld = nextId ? findWorld(nextId) : null;
    if (nextWorld && !progress.isWorldUnlocked(nextId)) {
      const mastered = progress.getMasteredLevelCount(this.world.id);
      const need = this.world.levelsRequired;
      // The hint hangs from the line above it (origin top), so when a long
      // world name wraps it to a 2nd line it grows down, still above 1920.
      // Non-breaking spaces keep the destination's name whole when it wraps
      // ("...a course to" / "The Big Garden", not "...to The" / "Big Garden").
      const ay = barY + barH / 2 + 112;
      const nextName = nextWorld.name.replace(/ /g, ' ');
      const masteredLine = this.inkForSky(this.add.text(W / 2, ay, `${mastered} / ${need} missions mastered`, style('subhead', {
        fontSize: '42px',
        fill: mastered >= need ? '#9affc0' : '#ffd479',
        fontStyle: '900'
      })).setOrigin(0.5).setDepth(11));
      this.inkForSky(this.add.text(W / 2, ay + masteredLine.height / 2 + 6,
        `Master every mission to chart a course to ${nextName}`,
        style('subhead', {
          fontSize: '42px', fill: '#cfcfe0', align: 'center',
          wordWrap: { width: W - 120 }
        })).setOrigin(0.5, 0).setDepth(11));
    }
  }

  startLevel(levelNum, modeKey) {
    this.registry.set('currentWorldId', this.world.id);
    this.registry.set('currentLevel', levelNum);
    this.registry.set('levelMode', modeKey);
    this.input.enabled = false;
    // Chapter 3 ("Home Ground", kind: 'sort') runs the Conveyor / Pack & Go
    // scene for every level. As an owner-gated pilot, the Ch1/Ch2 "mixed" level
    // can also route there (reskinned to its chapter), see usesConveyorScene.
    const sceneKey = usesConveyorScene(this.world, modeKey) ? 'ConveyorScene' : 'GameScene';
    new TransitionManager(this).fadeToScene(sceneKey);
  }

  onSceneWake() {
    this.scene.restart();
  }
}
