// Mario-style world map. All 11 worlds share a single non-scrolling 1080×1920
// screen, connected by an S-curve path. Locked worlds stay hidden; the path
// reveals progressively. The ship+pet sit on the active world; tapping an
// unlocked next world animates the ship along the path to it.

import Phaser from 'phaser';
import {
  WORLDS, HIDDEN_WORLDS, findWorld,
  progress, getNextVisibleWorldId, getChapterWorlds, CHAPTER1_FINAL_ID, CHAPTER2_FINAL_ID
} from '../GameData.js';
import { audio } from '../AudioManager.js';
import { music } from '../MusicManager.js';
import { TransitionManager } from '../TransitionManager.js';
import { createStarfield, createInnerSpaceBase, createHomeGroundBase } from '../starfieldHelper.js';
import { playWormholeCinematic } from '../WormholeCinematic.js';
import { createIconButton, createPetPortraitButton, createButton, createProgressBar } from '../buttonHelper.js';
import { style } from '../textStyles.js';
import { createCompactTitle } from '../CosmicBrand.js';
import { companion, drawCompanion, CAROUSEL_STAGE_ORDER, SPECIES } from '../CompanionManager.js';
import { economy } from '../EconomyManager.js';
import { ship } from '../ShipManager.js';
import { drawShip } from '../ShipRenderer.js';
import {
  buildMapPath, getNodePositions, drawPath, tForNodeIndex,
  MAP_HEADER_H, MAP_HEADER_FADE_END,
  HIDDEN_NODE_POSITIONS, HIDDEN_HOST_INDEX,
  hiddenBranchControlPoint, sampleHiddenBranch
} from '../MapPath.js';
import { drawWorldNode } from '../WorldNodeArt.js';
import { drawGlitchPlanetNode, drawGarageNode, drawKingColiNode, drawPlaygroundNode, drawHotPotNode, drawNightShiftNode } from './HiddenWorldScene.js';
import { createMapAmbience } from '../WorldAmbience.js';
import { drawMasteryWall } from '../MasteryWall.js';
import { paper, ink } from '../homeGround/paper.js';
import {
  drawSparkleIcon, drawStarIcon,
  drawGearIcon, drawShoppingBagIcon, drawHelmetIcon
} from '../StatIcons.js';
import { COLORS } from '../colorPalette.js';
import { hexStr } from '../colorUtils.js';
import { createModal } from '../modalHelper.js';

const W = 1080;
const H = 1920;

const HEADER_LAYOUT = {
  leftButtons: [90, 186],
  rightButtons: [W - 186, W - 90],
  buttonY: 88,
  buttonRadius: 38,
  buttonGlow: 4,
  titleY: 90,
  titleGutter: 24
};

const PORTRAIT_SCALE_BY_STAGE = { egg: 2.4, baby: 2.4, teen: 2.0, adult: 2.0, cosmic: 2.6 };

// Map text layout. Every name on the map is label size (36px); labels stay
// inside a 24px gutter from the canvas edge. NODE_LABEL_DY is the gap from a
// world node's centre to the centre of its name; NODE_DISC_R is roughly how
// far a node's art reaches, used to keep labels and floating pills off it.
const MAP_LABEL_PX = 36;
const MAP_EDGE_GUTTER = 24;
const NODE_LABEL_DY = 90;
const NODE_DISC_R = 66;
// The bottom world panel is at least this tall; a two-line description grows it
// upward (createBottomChrome).
const BOTTOM_CHROME_MIN_H = 220;
// On the Chapter 3 paper map the pale accent names vanish, so names there print
// in dark ink with a paper-white halo.
const PAPER_LABEL_INK = '#2b2016';
const PAPER_LABEL_HALO = '#fff8e7';

export class WorldMapScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WorldMapScene' });
  }

  create() {
    audio.init();
    // Map ambient is chosen per chapter below, once currentChapter is resolved.

    // Returning to the map always ends a free-play / arcade session, so the next
    // normal tap into a level plays for progression as usual.
    this.registry.set('freePlay', false);
    this.registry.set('arcadeMode', null);
    this.registry.set('arcadeState', null);

    // Heal saves bitten by the old cosmic-unlock bug: a pet that beat the final
    // boss but never got the permanent Cosmic form is always sitting at 'adult',
    // so grant it now — runs before the pet badge is drawn so it renders cosmic.
    // Gate on 'adult' so a deliberately fresh post-game pet (hatched via "raise a
    // brand-new pet") starts as an egg and grows instead of snapping to cosmic;
    // once it reaches adult through play, this same pass blossoms it next visit.
    if (progress.endingSeen && companion.hasStarter()
      && progress.companion?.stage === 'adult' && !progress.companion?.cosmicForm) {
      companion.unlockCosmic();
    }

    // Which chapter map are we viewing? (1 = Outer Space, 2 = Inner Space.)
    // Driven by the warp gate / return gate. Hidden-world warp arrivals always
    // land on the Chapter 1 map — that's where their host worlds + branch
    // geometry live. Resolved BEFORE the backdrop so each chapter paints its own.
    this.currentChapter = progress.currentChapter || 1;
    // A fresh warp arrival lands on the host's chapter map (where the hidden
    // world's branch geometry lives) — Ch1 secrets on the Ch1 map, Ch2 secrets
    // (King Coli, Recess) on the Ch2 map.
    const arrivalId = this.registry.get('warpArrivalHiddenId');
    if (arrivalId) this.currentChapter = findWorld(arrivalId)?.chapter || 1;
    this.chapterWorlds = getChapterWorlds(this.currentChapter);

    // Chapter 2 gets its own warm "Inner Space" ambient (falls back to the
    // Chapter 1 home theme until that MP3 ships). Crossfade so chapter swaps
    // and returns from levels glide rather than hard-cut.
    let mapMusic = 'homeTheme';
    if (this.currentChapter === 2) mapMusic = music.resolveTrack(this, 'innerSpaceHome', 'homeTheme');
    else if (this.currentChapter === 3) mapMusic = music.resolveTrack(this, 'homeGroundHome', 'homeTheme');
    music.fadeToTrack(this, mapMusic);

    // Backdrop: cold cosmic starfield for Outer Space, warm breathing living
    // interior for Inner Space, a summer Saturday sky for Home Ground, so no two
    // chapters ever look alike.
    if (this.currentChapter === 2) {
      createInnerSpaceBase(this, { width: W, height: H });
    } else if (this.currentChapter === 3) {
      createHomeGroundBase(this, { width: W, height: H });
    } else {
      createStarfield(this, { width: W, height: H, accentStrength: 0 });
    }
    this._warping = false; // reset across scene.restart() (instance is reused)

    this.path = buildMapPath(this.currentChapter);
    this.nodePositions = getNodePositions(this.currentChapter);
    this.currentWorldIndex = this.findCurrentWorldIndex();
    this.furthestUnlockedIndex = this.findFurthestUnlockedIndex();
    this._mapFootprint = this.computeMapFootprint();

    // Map text and art the floating pills (YOU ARE HERE, the arcade chip) must
    // not cover. Filled in as the map builds; see placeFloatingChips.
    this._mapLabels = [];
    this._nodeDiscs = [];
    this._obstacles = [];

    this.createHeader();
    this.createMap();
    this.createHiddenNodes();
    this.createChapterGates();
    this.spreadMapLabels();
    this.createShipOnActiveWorld();
    this.createBottomChrome();
    this.createTuneUpNudge();
    this.placeFloatingChips();
    this.maybeShowHomeGroundWelcome();

    // Warp arrival (from the warp asteroid) takes precedence over the
    // normal auto-advance flow. If a warp arrival is in flight, still
    // consume any stale clear-world flag so it doesn't replay later.
    const warpArrived = this.tryWarpArrival();
    if (warpArrived) {
      progress.consumeJustClearedWorld();
    } else {
      this.tryAutoAdvance();
    }

    this.events.on('wake', this.onSceneWake, this);
    this.events.on('resume', this.onSceneWake, this);
    this.events.once('shutdown', () => {
      this.events.off('wake', this.onSceneWake, this);
      this.events.off('resume', this.onSceneWake, this);
    });

    // One-time nudge after the pet reaches its Cosmic form: point kids at the
    // pet badge (top-right), which now opens the form picker where they can
    // choose & keep ANY unlocked form. Fires once (healed or freshly earned).
    if (progress.companion?.cosmicForm && !progress.cosmicHintSeen) {
      progress.markCosmicHintSeen();
      this.showToast('Your pet went Cosmic! Tap it ↗ to pick its look');
      if (this.petBadge) {
        this.tweens.add({
          targets: this.petBadge,
          scale: { from: 1, to: 1.18 },
          duration: 420, yoyo: true, repeat: 3, ease: 'Sine.easeInOut',
        });
      }
    }

    new TransitionManager(this).fadeIn(300);
  }

  // ============================================================
  // HEADER
  // ============================================================
  createHeader() {
    const bg = this.add.graphics().setDepth(10);
    // Layered gradient strip, three bands of decreasing opacity for depth. The
    // bar's height and the end of its fade are shared with the Home Ground
    // tourist map, which keeps its peaks below them (MapPath.js).
    bg.fillStyle(COLORS.bgPanel, 0.96);
    bg.fillRect(0, 0, W, MAP_HEADER_H);
    bg.fillStyle(COLORS.bgDark, 0.45);
    bg.fillRect(0, 0, W, MAP_HEADER_H);
    // Soft top accent glow
    bg.fillStyle(COLORS.accentTeal, 0.05);
    bg.fillRect(0, 0, W, 90);
    // Bottom hairline
    bg.fillStyle(COLORS.accentTeal, 0.30);
    bg.fillRect(0, MAP_HEADER_H - 2, W, 2);
    // Soft fade below the bar
    const fadeSplit = MAP_HEADER_H + 24;
    bg.fillStyle(COLORS.bgDark, 0.50);
    bg.fillRect(0, MAP_HEADER_H, W, fadeSplit - MAP_HEADER_H);
    bg.fillStyle(COLORS.bgDark, 0.20);
    bg.fillRect(0, fadeSplit, W, MAP_HEADER_FADE_END - fadeSplit);

    // Center the title in the space between the button groups. With two a
    // side that is the screen center, so it lines up with the chips below.
    const { leftButtons, rightButtons, buttonY, buttonRadius, buttonGlow, titleY, titleGutter } = HEADER_LAYOUT;
    const titleLeft = Math.max(...leftButtons) + buttonRadius + buttonGlow;
    const titleRight = Math.min(...rightButtons) - buttonRadius - buttonGlow;
    const titleMaxWidth = titleRight - titleLeft - titleGutter * 2;
    const title = createCompactTitle(this, (titleLeft + titleRight) / 2, titleY, titleMaxWidth)
      .setDepth(14).setInteractive({ useHandCursor: true });

    // Hidden dev-menu trigger: long-press (~1.5s) on the title opens the
    // parent menu. Kids tapping briefly do nothing.
    let pressTimer = null;
    title.on('pointerdown', () => {
      pressTimer = this.time.delayedCall(1500, () => {
        audio.playClick?.();
        new TransitionManager(this).fadeToScene('DevMenuScene');
      });
    });
    const cancelPress = () => {
      if (pressTimer) { pressTimer.remove(); pressTimer = null; }
    };
    title.on('pointerup', cancelPress);
    title.on('pointerout', cancelPress);

    this.createChipRow();

    // The Cosmic Arcade chip is placed once the map is built, so it can find a
    // spot clear of the nodes and labels (see placeFloatingChips).

    // Top-left cluster: Settings (gear) | Logbook. Sound, Music and the
    // PIN-locked Grown-ups dashboard all live inside Settings.
    createIconButton(this, {
      x: leftButtons[0], y: buttonY, radius: buttonRadius,
      accentColor: COLORS.accentTeal,
      drawIcon: (g, size) => drawGearIcon(g, 0, 0, size),
      onClick: () => {
        audio.playClick();
        new TransitionManager(this).fadeToScene('SettingsScene');
      }
    }).setDepth(15);

    createIconButton(this, {
      x: leftButtons[1], y: buttonY, radius: buttonRadius,
      accentColor: COLORS.accentWarm,
      drawIcon: (g, size) => drawHelmetIcon(g, 0, 0, size),
      onClick: () => {
        audio.playClick();
        new TransitionManager(this).fadeToScene('RecordsScene');
      }
    }).setDepth(15);

    // Top-right cluster: Pet | Shop
    this._petBadgeX = rightButtons[0];
    this._petBadgeY = buttonY;
    this._petBadgeRadius = buttonRadius;
    this.buildPetBadge();

    createIconButton(this, {
      x: rightButtons[1], y: buttonY, radius: buttonRadius,
      accentColor: COLORS.accentPurple,
      drawIcon: (g, size) => drawShoppingBagIcon(g, 0, 0, size),
      onClick: () => {
        audio.playClick();
        new TransitionManager(this).fadeToScene('ShopScene');
      }
    }).setDepth(15);
  }

  createChipRow() {
    const cy = 175;
    const chipW = 240;
    const gap = 32;

    // Chapter 3 "Home Ground" adds a Mastery Garden chip: the persistent bloom
    // display of automatic facts (the Grid Gardens graft), reachable from the
    // map as well as between rounds. The garden name stays even though world 32
    // is a real garden now; it is a metaphor the kid already knows.
    const chips = [
      {
        field: 'starsChip',
        icon: g => drawStarIcon(g, 0, 0, 18),
        accent: COLORS.warning,
        value: () => `${progress.totalStars}`,
        onClick: () => this.showInfoPopup({
          accent: COLORS.warning,
          drawIcon: (g, size) => drawStarIcon(g, 0, 0, size),
          title: 'STARS',
          body: 'You earn up to 3 stars on every mission: more answers right, more stars. They track how well you\'re mastering each math fact.'
        })
      },
      {
        field: 'stardustChip',
        icon: g => drawSparkleIcon(g, 0, 0, 18),
        accent: COLORS.accentPurple,
        value: () => `${economy.getStardust()}`,
        onClick: () => this.showInfoPopup({
          accent: COLORS.accentPurple,
          drawIcon: (g, size) => drawSparkleIcon(g, 0, 0, size),
          title: 'STARDUST',
          body: 'Stardust is your space money. You earn it from missions and your daily login bonus, then spend it in the Shop on hats, ship parts, and other cosmetics.'
        })
      }
    ];
    if (this.currentChapter === 3) {
      chips.push({
        field: 'gardenChip',
        icon: g => this.drawBloomIcon(g, 0, 0, 9),
        accent: 0xffd166,
        value: () => `${progress.getAutomaticityStats().automatic}`,
        onClick: () => this.showMasteryGardenOverlay()
      });
    }

    const totalW = chipW * chips.length + gap * (chips.length - 1);
    let x = W / 2 - totalW / 2 + chipW / 2;
    for (const cfg of chips) {
      this[cfg.field] = this.makeChip(x, cy, chipW, cfg);
      x += chipW + gap;
    }
  }

  // A tiny four-petal bloom for the Mastery Garden chip icon (plain — no
  // radial/mandala motif, per the content rule).
  drawBloomIcon(g, cx, cy, pr) {
    g.fillStyle(0xffd166, 1);
    g.fillEllipse(cx, cy - pr, pr * 0.82, pr * 1.15);
    g.fillEllipse(cx, cy + pr, pr * 0.82, pr * 1.15);
    g.fillEllipse(cx - pr, cy, pr * 1.15, pr * 0.82);
    g.fillEllipse(cx + pr, cy, pr * 1.15, pr * 0.82);
    g.fillStyle(0xfff0c2, 1);
    g.fillCircle(cx, cy, pr * 0.7);
  }

  // The Mastery Garden as a map overlay (Chapter 3).
  showMasteryGardenOverlay() {
    audio.playClick?.();
    const root = this.add.container(0, 0).setDepth(120);
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setInteractive();
    root.add(dim);
    this.tweens.add({ targets: dim, fillAlpha: 0.8, duration: 220 });

    const accent = this.chapterWorlds[this.currentWorldIndex]?.accentColor ?? 0xffd27a;
    // Fade in at full scale (no scale-pop) so the Done button — positioned against
    // the wall's full panelH below — doesn't snap as the wall grows.
    const wall = drawMasteryWall(this, W / 2, H / 2 - 50, { cell: 46, accent });
    wall.setAlpha(0);
    root.add(wall);
    this.tweens.add({ targets: wall, alpha: 1, duration: 240, ease: 'Quad.easeOut' });

    const close = () => this.tweens.add({ targets: root, alpha: 0, duration: 180, onComplete: () => root.destroy() });
    root.add(createButton(this, {
      x: W / 2, y: H / 2 - 50 + wall.panelH / 2 + 70, label: 'Done', width: 280, height: 88,
      color: accent, onClick: close
    }));
    dim.on('pointerdown', close);
  }

  makeChip(x, y, width, opts) {
    const c = this.add.container(x, y).setDepth(14);
    const h = 60;
    const r = h / 2;

    // Drop shadow for depth
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.45);
    shadow.fillRoundedRect(-width / 2 + 1, -h / 2 + 4, width, h, r);
    c.add(shadow);

    // Track — pill body with inset highlight + bottom shadow
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.bgTrack, 1);
    bg.fillRoundedRect(-width / 2, -h / 2, width, h, r);
    bg.fillStyle(0xffffff, 0.06);
    bg.fillRoundedRect(-width / 2 + 4, -h / 2 + 3, width - 8, h * 0.32, {
      tl: r - 2, tr: r - 2, bl: 6, br: 6
    });
    bg.fillStyle(COLORS.bgDark, 0.40);
    bg.fillRoundedRect(-width / 2 + 4, h / 2 - h * 0.32 - 3, width - 8, h * 0.32, {
      tl: 6, tr: 6, bl: r - 2, br: r - 2
    });
    bg.lineStyle(2, opts.accent, 0.85);
    bg.strokeRoundedRect(-width / 2, -h / 2, width, h, r);
    c.add(bg);

    // Icon badge — accent-tinted disc with soft glow halo
    const badgeR = h * 0.34;
    const badgeX = -width / 2 + r;
    const halo = this.add.graphics();
    halo.fillStyle(opts.accent, 0.25);
    halo.fillCircle(badgeX, 0, badgeR + 6);
    c.add(halo);
    const badge = this.add.graphics();
    badge.fillStyle(COLORS.bgDark, 1);
    badge.fillCircle(badgeX, 0, badgeR);
    badge.lineStyle(2, opts.accent, 0.9);
    badge.strokeCircle(badgeX, 0, badgeR);
    c.add(badge);

    const iconG = this.add.graphics();
    iconG.x = badgeX;
    opts.icon(iconG);
    c.add(iconG);

    // Value text: bright white with stroke for readability on any backdrop
    const text = this.add.text(width / 2 - 22, 0, opts.value(), style('subhead', {
      fontSize: `${MAP_LABEL_PX}px`,
      fill: '#ffffff',
      fontStyle: '900',
      stroke: '#0a0a18',
      strokeThickness: 3
    })).setOrigin(1, 0.5);
    c.add(text);
    c.text = text;
    c.refresh = () => text.setText(opts.value());

    if (opts.onClick) {
      const hit = this.add.rectangle(0, 0, width, h, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      c.add(hit);
      hit.on('pointerover', () => {
        this.tweens.add({ targets: c, scaleX: 1.04, scaleY: 1.04, duration: 100 });
      });
      hit.on('pointerout', () => {
        this.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 100 });
      });
      hit.on('pointerdown', () => {
        audio.playClick();
        opts.onClick();
      });
    }

    return c;
  }

  // ============================================================
  // INFO POPUP (chip tooltips)
  // ============================================================
  showInfoPopup({ accent, drawIcon, title, body }) {
    const cw = 840;
    // Body text first, so the card can grow to fit it: the icon and title take
    // the top 310px, then the body, then 60px of margin.
    const bodyText = this.add.text(0, 0, body, style('body', {
      fontSize: '42px',
      fill: '#cfcfe0',
      align: 'center',
      wordWrap: { width: cw - 100 },
      lineSpacing: 8
    })).setOrigin(0.5, 0);
    const ch = Math.max(520, 310 + Math.ceil(bodyText.height) + 60);
    const { card } = createModal(this, {
      width: cw, height: ch, accentColor: accent, radius: 24, strokeWidth: 4
    });

    // Icon badge with halo
    const iconY = -ch / 2 + 110;
    const halo = this.add.graphics();
    halo.fillStyle(accent, 0.22);
    halo.fillCircle(0, iconY, 76);
    halo.fillStyle(accent, 0.10);
    halo.fillCircle(0, iconY, 100);
    card.add(halo);

    const badge = this.add.graphics();
    badge.fillStyle(COLORS.bgDark, 1);
    badge.fillCircle(0, iconY, 56);
    badge.lineStyle(3, accent, 0.95);
    badge.strokeCircle(0, iconY, 56);
    card.add(badge);

    const iconG = this.add.graphics();
    iconG.y = iconY;
    drawIcon(iconG, 56);
    card.add(iconG);

    card.add(this.add.text(0, iconY + 110, title, style('display', {
      fontSize: '52px',
      fill: '#ffffff',
      stroke: '#0a0a1a',
      strokeThickness: 3
    })).setOrigin(0.5));

    bodyText.setPosition(0, iconY + 200);
    card.add(bodyText);
  }

  // ============================================================
  // MAP
  // ============================================================
  createMap() {
    // Subtle accent bloom behind the map for visual interest
    const bloom = this.add.graphics().setDepth(0);
    bloom.fillStyle(COLORS.accentTeal, 0.04);
    bloom.fillEllipse(W / 2, H * 0.55, W * 1.4, H * 0.55);

    // Layered ambience: stars, drifting nebulae, shooting stars, theme particles
    createMapAmbience(this, {
      width: W,
      height: H,
      chapter: this.currentChapter,
      nodePositions: this.nodePositions,
      worldIds: this.chapterWorlds.map(w => w.id),
      furthestUnlocked: this.furthestUnlockedIndex,
      accentColors: this.chapterWorlds.map(w => w.accentColor)
    });

    // Path — only segments up to (and including) the current world segment
    // are visible; locked tail is hidden.
    const visibleSegments = this.furthestUnlockedIndex; // segments equals (idx) since 0-based
    drawPath(this, this.path, visibleSegments, COLORS.accentTeal, this.currentChapter).setDepth(2);

    // Nodes — unlocked render in full color, locked render as silhouette+?.
    this.nodeContainers = {};
    for (let i = 0; i < this.chapterWorlds.length; i++) {
      const world = this.chapterWorlds[i];
      const pos = this.nodePositions[i];
      const isLocked = i > this.furthestUnlockedIndex;

      this._nodeDiscs.push({ x: pos.x, y: pos.y, r: NODE_DISC_R, key: `w${world.id}` });

      if (isLocked) {
        // Render silhouette only: no label, no hit, no animation.
        const sil = drawWorldNode(this, pos.x, pos.y, world.id, { scale: 0.95, silhouette: true });
        sil.setDepth(5);
        sil.setAlpha(0.85);
        continue;
      }

      const isCurrent = i === this.currentWorldIndex;
      const isCleared = progress.isWorldFullyCleared(world.id);
      const node = drawWorldNode(this, pos.x, pos.y, world.id, { scale: 0.95 });
      node.setDepth(5);
      this.nodeContainers[world.id] = node;

      // Idle gentle bob
      this.tweens.add({
        targets: node,
        y: pos.y - 6,
        duration: 1800 + i * 80,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      // Cleared badge: small star
      if (isCleared) {
        const badge = this.add.graphics().setDepth(6);
        badge.x = pos.x + 60;
        badge.y = pos.y - 60;
        drawStarIcon(badge, 0, 0, 18);
        this._nodeDiscs.push({ x: badge.x, y: badge.y, r: 20, key: `w${world.id}`, soft: true });
        this.tweens.add({
          targets: badge,
          scale: { from: 0.9, to: 1.1 },
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }

      // World label, kept inside the edge gutter ("PARALLEL DIMENSION" at x=880
      // would otherwise run off the right edge). spreadMapLabels nudges it
      // sideways later if it lands on a neighbour.
      this.addMapLabel(pos.x, pos.y + NODE_LABEL_DY, world.name, world.accentColor, `w${world.id}`);

      // Tap hit area
      const hit = this.add.circle(pos.x, pos.y, 90, 0x000000, 0)
        .setInteractive({ useHandCursor: true })
        .setDepth(7);
      hit.on('pointerdown', () => this.handleNodeTap(i));
      hit.on('pointerover', () => {
        this.tweens.add({ targets: node, scale: 1.06, duration: 120 });
      });
      hit.on('pointerout', () => {
        this.tweens.add({ targets: node, scale: 0.95, duration: 120 });
      });

      // Soft static halo for the current world. Its YOU ARE HERE pill is
      // placed once the whole map is built (placeFloatingChips).
      if (isCurrent) {
        const halo = this.add.graphics().setDepth(3);
        halo.fillStyle(world.accentColor, 0.18);
        halo.fillCircle(pos.x, pos.y, 90);
        halo.fillStyle(world.accentColor, 0.10);
        halo.fillCircle(pos.x, pos.y, 130);
        halo.fillStyle(world.accentColor, 0.05);
        halo.fillCircle(pos.x, pos.y, 170);
      }
    }
  }

  // A name printed on the map under a world, gate or secret. Label size, kept
  // inside the edge gutter. On the Chapter 3 paper map the pale accent fills
  // vanish, so names there are dark ink with a paper-white halo.
  addMapLabel(x, y, name, accent, key) {
    const onPaper = this.currentChapter === 3;
    const label = this.add.text(x, y, name.toUpperCase(), style('caption', {
      fontSize: `${MAP_LABEL_PX}px`,
      fill: onPaper ? PAPER_LABEL_INK : hexStr(accent),
      fontStyle: '900',
      stroke: onPaper ? PAPER_LABEL_HALO : '#0a0a1a',
      strokeThickness: onPaper ? 6 : 3
    })).setOrigin(0.5).setDepth(6);
    label.x = this.clampToGutter(x, label.width);
    this._mapLabels.push({ text: label, key });
    return label;
  }

  clampToGutter(x, width) {
    const half = width / 2;
    return Math.min(Math.max(x, MAP_EDGE_GUTTER + half), W - MAP_EDGE_GUTTER - half);
  }

  // Labels are 36px now, so a few land on a neighbouring label or node (THE
  // SEAWALL on THE BREAD PLACE, DAD'S GARAGE on the Galactic Core). Slide each
  // one sideways, up to 96px, only as far as it takes to clear (or to cover
  // less), and leave it where it was when nothing helps. Nodes never move.
  spreadMapLabels() {
    const rectOf = (t) => t.getBounds();
    const { RectangleToRectangle, CircleToRectangle } = Phaser.Geom.Intersects;
    // The ship parks on the current world and draws over everything near it.
    const here = this.nodePositions[this.currentWorldIndex];
    const shipRect = here ? new Phaser.Geom.Rectangle(here.x - 60, here.y - 96, 120, 130) : null;
    // Other labels, node art and the ship must be cleared; the little
    // cleared-world stars (soft) are only avoided when a shift can manage it.
    const cost = (lab) => {
      const b = rectOf(lab.text);
      let hard = 0;
      let soft = 0;
      for (const o of this._mapLabels) if (o !== lab && RectangleToRectangle(b, rectOf(o.text))) hard++;
      for (const d of this._nodeDiscs) {
        if (d.key === lab.key || !CircleToRectangle(new Phaser.Geom.Circle(d.x, d.y, d.r * 0.88), b)) continue;
        if (d.soft) soft++; else hard++;
      }
      if (shipRect && RectangleToRectangle(b, shipRect)) hard++;
      return hard * 100 + soft;
    };
    // Slide sideways by the smallest step that lowers the cost. A gate name
    // that is still blocked (the ship parked on the world under the SURFACE
    // gate) tries the same above its portal.
    const search = (lab) => {
      const home = lab.text.x;
      let best = { x: home, c: cost(lab) };
      for (let step = 8; step <= 96 && best.c > 0; step += 8) {
        for (const dir of [-1, 1]) {
          lab.text.x = this.clampToGutter(home + dir * step, lab.text.width);
          const c = cost(lab);
          if (c < best.c) best = { x: lab.text.x, c };
        }
      }
      lab.text.x = home;
      return best;
    };
    for (const lab of this._mapLabels) {
      const homeY = lab.text.y;
      let best = { ...search(lab), y: homeY };
      if (best.c >= 100 && lab.altY != null) {
        lab.text.y = lab.altY;
        const alt = search(lab);
        if (alt.c < best.c) best = { ...alt, y: lab.altY };
      }
      // Only move for a real gain: clear of every label, node and the ship, or
      // fewer stars.
      lab.text.setPosition(best.x, best.y);
      // Where the parked ship still sits on a neighbour's name (NEBULA GARDENS
      // while parked on the Crystal Planet), print that name above the ship
      // (depth 20) so it stays readable.
      if (shipRect && RectangleToRectangle(rectOf(lab.text), shipRect)) lab.text.setDepth(21);
    }
    // Obstacles for the floating pills, weighted by how bad covering them is:
    // names most, node art (the middle of each disc) less, the little stars
    // least. Chrome, the ship and the Tune-Up pill are added later, weighted
    // so a pill never sits on them.
    for (const lab of this._mapLabels) this.addObstacle(rectOf(lab.text), 6, 4);
    for (const d of this._nodeDiscs) {
      const r = d.r * 0.8;
      this.addObstacle(new Phaser.Geom.Rectangle(d.x - r, d.y - r, r * 2, r * 2), 0, d.soft ? 0.5 : 1);
    }

    // Where the lowest world's name ends, whether or not it is unlocked yet
    // (the first world always is, and every chapter's lowest node is its first).
    const lowestY = Math.max(...this.nodePositions.map(p => p.y));
    const labelH = this._mapLabels[0]?.text.height ?? MAP_LABEL_PX * 1.25;
    this._lowestLabelBottom = lowestY + NODE_LABEL_DY + labelH / 2;
  }

  addObstacle(rect, pad = 0, weight = 1) {
    const r = new Phaser.Geom.Rectangle(
      rect.x - pad, rect.y - pad, rect.width + pad * 2, rect.height + pad * 2
    );
    r.weight = weight;
    this._obstacles.push(r);
  }

  // How badly a w by h box centred at (x, y) covers the map's obstacles: the
  // covered area of each, times its weight. 0 means clear.
  coveredCost(x, y, w, h) {
    const r = new Phaser.Geom.Rectangle(x - w / 2, y - h / 2, w, h);
    let cost = 0;
    for (const o of this._obstacles) {
      const i = Phaser.Geom.Rectangle.Intersection(r, o);
      cost += i.width * i.height * o.weight;
    }
    return cost;
  }

  // First candidate spot (kept inside the edge gutter) where a w by h box
  // covers nothing; failing that, the one that covers least.
  pickFreeSpot(w, h, candidates) {
    let best = null;
    for (const c of candidates) {
      const x = this.clampToGutter(c.x, w);
      const cost = this.coveredCost(x, c.y, w, h);
      if (cost === 0) return { x, y: c.y };
      if (!best || cost < best.cost) best = { x, y: c.y, cost };
    }
    return best;
  }

  // A spot for a w by h pill that belongs to the node at pos: the preferred
  // spots first, when one is clear; otherwise the best spot within about 90px
  // of the node, trading what it covers against how far it drifts.
  pickSpotNearNode(w, h, pos, preferred) {
    for (const c of preferred) {
      const x = this.clampToGutter(c.x, w);
      if (this.coveredCost(x, c.y, w, h) === 0) return { x, y: c.y };
    }
    let best = null;
    for (let dy = -240; dy <= 200; dy += 12) {
      for (let dx = -320; dx <= 320; dx += 16) {
        const x = this.clampToGutter(pos.x + dx, w);
        const y = pos.y + dy;
        const nx = Math.max(x - w / 2, Math.min(pos.x, x + w / 2));
        const ny = Math.max(y - h / 2, Math.min(pos.y, y + h / 2));
        const drift = Math.hypot(nx - pos.x, ny - pos.y) - NODE_DISC_R;
        if (drift > 90) continue;
        const score = this.coveredCost(x, y, w, h) + 40 * Math.max(0, drift - 24);
        if (!best || score < best.score) best = { x, y, score };
      }
    }
    return best || { x: this.clampToGutter(preferred[0].x, w), y: preferred[0].y };
  }

  // The two pills that float over the map: YOU ARE HERE beside the current
  // world, and (after the ending) the Cosmic Arcade chip. Both are sized from
  // their text, so they are placed last, clear of every node, label, gate,
  // secret, the ship, the Tune-Up pill, the header and the bottom panel.
  placeFloatingChips() {
    this.addObstacle(new Phaser.Geom.Rectangle(0, 0, W, MAP_HEADER_H), 10, 20);
    this.addObstacle(new Phaser.Geom.Rectangle(0, this._bottomChromeTop, W, H - this._bottomChromeTop), 10, 20);
    if (this._tuneUpRect) this.addObstacle(this._tuneUpRect, 10, 20);

    const world = this.chapterWorlds[this.currentWorldIndex];
    const pos = this.nodePositions[this.currentWorldIndex];
    if (world && pos) {
      // The parked ship covers the node from about 100px above its centre.
      const shipRect = new Phaser.Geom.Rectangle(pos.x - 64, pos.y - 100, 128, 136);
      this.addObstacle(shipRect, 6, 20);

      const chip = this.add.container(0, 0).setDepth(16);
      const chipText = this.add.text(0, 0, 'YOU ARE HERE', style('caption', {
        fontSize: `${MAP_LABEL_PX}px`,
        fill: '#0a0a1a',
        fontStyle: '900'
      })).setOrigin(0.5);
      const cw = Math.ceil(chipText.width) + 44;
      const ch = Math.ceil(chipText.height) + 14;
      const chipBg = this.add.graphics();
      chipBg.fillStyle(world.accentColor, 0.95);
      chipBg.fillRoundedRect(-cw / 2, -ch / 2, cw, ch, ch / 2);
      chipBg.lineStyle(2, 0x0a0a1a, 0.4);
      chipBg.strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, ch / 2);
      chip.add(chipBg);
      chip.add(chipText);

      // Above the ship first (the old spot), then beside the node, then under
      // its name. Near the top of the map the header rules out "above", and
      // under the name would sit on the next world down, so it goes beside.
      // Where the map is crowded (the Seawall, Supernova) it takes the nearby
      // spot that covers the least.
      const labelBottom = pos.y + NODE_LABEL_DY + ch / 2;
      const beside = NODE_DISC_R + 30 + cw / 2;
      const spot = this.pickSpotNearNode(cw, ch, pos, [
        { x: pos.x, y: shipRect.y - 12 - ch / 2 },
        { x: pos.x + beside, y: pos.y - 20 },
        { x: pos.x - beside, y: pos.y - 20 },
        { x: pos.x, y: labelBottom + 12 + ch / 2 }
      ]);
      chip.setPosition(spot.x, spot.y);
      this.addObstacle(new Phaser.Geom.Rectangle(spot.x - cw / 2, spot.y - ch / 2, cw, ch), 8, 20);
      this.tweens.add({
        targets: chip,
        y: spot.y - 4,
        duration: 2400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    if (progress.endingSeen) this.createArcadeChip();
  }

  // Cosmic Arcade chip: appears only after the kid has seen the endgame. Its
  // home is the bottom-right corner, in the band above the world panel; when
  // the Tune-Up pill has that band it moves up under the header instead.
  createArcadeChip() {
    const label = this.add.text(0, 0, '★ COSMIC ARCADE ★', style('caption', {
      fontSize: `${MAP_LABEL_PX}px`,
      fill: '#fbbf24',
      fontStyle: '900'
    })).setOrigin(0.5);
    const aw = Math.ceil(label.width) + 48;
    const ah = Math.ceil(label.height) + 18;
    const band = (this._lowestLabelBottom + this._bottomChromeTop) / 2;
    const right = W - MAP_EDGE_GUTTER - aw / 2;
    const left = MAP_EDGE_GUTTER + aw / 2;
    const underHeader = MAP_HEADER_H + 22 + ah / 2;
    const candidates = [{ x: right, y: band }, { x: left, y: band }];
    if (this._tuneUpRect) candidates.push({ x: right, y: this._tuneUpRect.y - 12 - ah / 2 });
    candidates.push({ x: right, y: underHeader }, { x: left, y: underHeader });
    for (let y = band - 40; y > underHeader; y -= 20) {
      candidates.push({ x: right, y }, { x: left, y });
    }
    const { x: ax, y: ay } = this.pickFreeSpot(aw, ah, candidates);

    const arcade = this.add.container(ax, ay).setDepth(18);
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 0.95);
    bg.fillRoundedRect(-aw / 2, -ah / 2, aw, ah, 18);
    bg.lineStyle(3, 0xfbbf24, 1);
    bg.strokeRoundedRect(-aw / 2, -ah / 2, aw, ah, 18);
    arcade.add(bg);
    arcade.add(label);
    this.tweens.add({
      targets: arcade,
      scale: { from: 1, to: 1.06 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    const hit = this.add.rectangle(ax, ay, aw, ah, 0, 0)
      .setInteractive({ useHandCursor: true }).setDepth(19);
    hit.on('pointerdown', () => {
      audio.playClick();
      new TransitionManager(this).fadeToScene('ArcadeMenuScene');
    });
  }

  // ============================================================
  // SHIP + PET ON ACTIVE WORLD
  // ============================================================
  createShipOnActiveWorld() {
    const pos = this.nodePositions[this.currentWorldIndex];
    this.shipPet = this.add.container(pos.x, pos.y - 30).setDepth(20);

    const shipG = drawShip(this, 0, 0, {
      scale: 1.2,
      parts: ship.getCurrentParts()
    });
    this.shipPet.add(shipG);
    this.shipPet.shipG = shipG;

    if (companion.hasStarter()) {
      const pc = shipG.portholeCenter;
      const pet = drawCompanion(this, pc.x, pc.y, { scale: 0.42 });
      shipG.add(pet);
      this.shipPet.pet = pet;
    }

    this._startShipBob();
  }

  _startShipBob() {
    if (this._bobTween) {
      this._bobTween.stop();
      this._bobTween = null;
    }
    const baseY = this.shipPet.y;
    this._bobTween = this.tweens.add({
      targets: this.shipPet,
      y: baseY - 8,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  // ============================================================
  // BOTTOM CHROME
  // ============================================================
  createBottomChrome() {
    // Subtle starfield band hint at bottom
    const fade = this.add.graphics().setDepth(0);

    const world = this.chapterWorlds[this.currentWorldIndex];
    const wp = progress.getWorldProgress(world.id);
    const fullyCleared = progress.isWorldFullyCleared(world.id);

    // Three rows: the world's name (heading), its description (body, and most
    // Chapter 3 descriptions wrap to two lines) and the missions count (label).
    // Built first so the band can be sized to them.
    const nameText = this.add.text(W / 2, 0, world.name, style('display', {
      fontSize: '52px',
      fill: '#ffffff'
    })).setOrigin(0.5).setDepth(11);

    const subtitle = fullyCleared
      ? 'World cleared. Replay any mission'
      : world.description;
    const subText = this.add.text(W / 2, 0, subtitle, style('body', {
      fontSize: '42px',
      fontStyle: '600',
      fill: '#' + world.accentColor.toString(16).padStart(6, '0'),
      align: 'center',
      wordWrap: { width: W - 160 }
    })).setOrigin(0.5).setDepth(11);

    const missionsText = this.add.text(W / 2, 0, `${wp.levelsCompleted}/${world.levelsRequired} missions complete`, style('caption', {
      fontSize: '36px',
      fill: '#cfcfe0'
    })).setOrigin(0.5).setDepth(11);

    // The band is at least BOTTOM_CHROME_MIN_H tall and grows upward when the
    // rows need more (a two-line description), with the spare height shared
    // evenly above, between and below the rows.
    const rows = [nameText, subText, missionsText];
    const contentH = rows.reduce((sum, t) => sum + t.height, 0);
    const bandH = Math.max(BOTTOM_CHROME_MIN_H, Math.ceil(contentH + 4 * 8));
    const top = H - bandH;
    const gap = (bandH - contentH) / 4;
    let y = top + gap;
    for (const t of rows) {
      t.y = y + t.height / 2;
      y += t.height + gap;
    }
    this._bottomChromeTop = top;

    // The Chapter 3 paper map is light and busy, so the band is more solid
    // there to keep the pale description and missions text readable.
    fade.fillStyle(COLORS.bgDark, this.currentChapter === 3 ? 0.88 : 0.7);
    fade.fillRect(0, top, W, bandH);

    // Top hairline tinted to the current world's accent: frames the chrome
    // the way the header's teal hairline frames the top.
    const hairline = this.add.graphics().setDepth(11);
    hairline.fillStyle(world.accentColor, 0.30);
    hairline.fillRect(0, top, W, 2);

    this.tweens.add({
      targets: nameText,
      y: nameText.y - 2,
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  // Tune-Up nudge — the resurfacing call-to-action. Appears only once the kid has
  // facts going "rusty" (mastered facts now overdue for spaced-repetition review),
  // so beginners never see it. Tapping launches the Tune-Up (ReviewScene), which
  // drills exactly those facts. As facts get refreshed the count falls and the
  // pill quietly disappears — a finite map that keeps calling kids back.
  createTuneUpNudge() {
    const rusty = progress.getRustyFactCount();
    if (rusty <= 0) return;

    // Centered in the clear band between the lowest node's on-map label and the
    // bottom world-info chrome, so it crowds neither, in EVERY chapter. The
    // lowest node sits at y 1480 on every map (MapPath.js), so its label bottom
    // (spreadMapLabels works it out, about 1593) is the band's top; the chrome's
    // top hairline (createBottomChrome, 1686 to 1700) is its floor. The pill is
    // a button, so its label is button size (42px): about 73px tall in a band
    // of 93 to 107px.
    // (Keep the pill OUT of the top of the map: there its wide hit area stole taps
    // from the center finale node.)
    const label = `${rusty} fact${rusty === 1 ? '' : 's'} getting rusty · Tune-Up ↻`;
    const txt = this.add.text(0, 0, label, style('subhead', {
      fontSize: '42px', fill: '#1a1a2e', fontStyle: '900'
    })).setOrigin(0.5);

    const w = txt.width + 70;
    const h = txt.height + 24;
    const y = Math.round((this._lowestLabelBottom + this._bottomChromeTop) / 2);
    this._tuneUpRect = new Phaser.Geom.Rectangle(W / 2 - w / 2, y - h / 2, w, h);
    const c = this.add.container(W / 2, y).setDepth(40);

    const bg = this.add.graphics();
    bg.fillStyle(COLORS.warning, 0.97);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    bg.lineStyle(3, 0xffffff, 0.7);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    c.add(bg);
    c.add(txt);

    const hit = this.add.rectangle(0, 0, w, h, 0, 0).setInteractive({ useHandCursor: true });
    c.add(hit);
    hit.on('pointerdown', () => {
      audio.playClick();
      new TransitionManager(this).fadeToScene('ReviewScene');
    });

    // Gentle breathing pulse to draw the eye without nagging. Kept small so the
    // peak scale doesn't eat the clearance to the chrome/label.
    this.tweens.add({
      targets: c, scale: { from: 1, to: 1.03 },
      duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
  }

  // ============================================================
  // INTERACTION
  // ============================================================
  handleNodeTap(targetIndex) {
    audio.playClick();
    if (targetIndex > this.furthestUnlockedIndex) return;

    if (targetIndex === this.currentWorldIndex) {
      // Already there — go to mission briefing
      this.enterWorld(targetIndex);
      return;
    }

    // Animate ship along path to the new world
    this.travelTo(targetIndex, () => this.enterWorld(targetIndex));
  }

  travelTo(targetIndex, onArrive) {
    if (this._traveling) return;
    this._traveling = true;
    this.input.enabled = false;

    if (this._bobTween) {
      this._bobTween.stop();
      this._bobTween = null;
    }

    const startT = tForNodeIndex(this.currentWorldIndex, this.currentChapter);
    const endT = tForNodeIndex(targetIndex, this.currentChapter);

    audio.playLaser?.();

    const tween = { t: startT };
    return this.tweens.add({
      targets: tween,
      t: endT,
      duration: 1500,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const pt = this.path.getPoint(tween.t);
        this.shipPet.x = pt.x;
        this.shipPet.y = pt.y - 30;
        // Tilt the ship in the direction of travel
        const ahead = this.path.getPoint(Math.min(1, tween.t + 0.02));
        const dx = ahead.x - pt.x;
        const dy = ahead.y - pt.y;
        const angle = Math.atan2(dy, dx) - Math.PI / 2;
        this.shipPet.rotation = angle * 0.3;
      },
      onComplete: () => {
        this.shipPet.rotation = 0;
        this.currentWorldIndex = targetIndex;
        this._traveling = false;
        this.input.enabled = true;
        this._startShipBob();
        this.cameras.main.shake(180, 0.004);
        if (onArrive) {
          this.time.delayedCall(180, onArrive);
        }
      }
    });
  }

  enterWorld(idx) {
    const world = this.chapterWorlds[idx];
    this.registry.set('selectedWorld', world.id);
    this.registry.set('shipParkedWorldId', world.id);
    new TransitionManager(this).fadeToScene('LevelSelectScene');
  }

  // ============================================================
  // CHAPTER WARP GATES
  //
  // A glowing wormhole "warp gate" bridges the chapters. On the Chapter 1 map it
  // tears open right beside "Universe's End" (World 11) once that finale boss is
  // beaten — the Void cracks open and pulls you inward — and dives INTO Inner
  // Space (Chapter 2). On the Chapter 2 map it surfaces back OUT to Chapter 1.
  // ============================================================
  createChapterGates() {
    if (this.currentChapter === 1) {
      // Entry wormhole → Chapter 2, beside Universe's End (the top-center node),
      // gated on the Chapter 1 finale being beaten (matches Bloodstream unlock).
      if (!progress.isWorldFullyCleared(CHAPTER1_FINAL_ID)) return;
      const host = this.nodePositions[this.nodePositions.length - 1]; // World 11
      const gate = { x: 220, y: 470 };
      this.drawHiddenBranch(host, gate, 0xff7a8a);
      this.buildGateNode(gate, {
        accent: 0xff7a8a, core: 0xffcf6b, inward: true, label: 'INNER SPACE',
        onTap: () => this.warpToChapter(2)
      });
    } else if (this.currentChapter === 2) {
      // Return wormhole → Chapter 1 (the surface), beside the first inner world.
      const back = this.nodePositions[0];
      if (back) {
        const gate = { x: 180, y: 1300 };
        this.drawHiddenBranch(back, gate, 0x4ecdc4);
        this.buildGateNode(gate, {
          accent: 0x4ecdc4, core: 0xb5e6ff, inward: false, label: 'SURFACE',
          onTap: () => this.warpToChapter(1)
        });
      }
      // Forward gate → Chapter 3 (Home Ground), beside the Singularity Cell (the
      // top-center node), gated on the grand finale (World 28) being cleared.
      // Surfacing back OUT from the smallest speck to human scale, coming home
      // to one Saturday around the family's own city. Keeps the chapter's gold.
      if (progress.isWorldFullyCleared(CHAPTER2_FINAL_ID)) {
        const host = this.nodePositions[this.nodePositions.length - 1]; // World 28
        const gate = { x: 220, y: 470 };
        this.drawHiddenBranch(host, gate, 0xffd27a);
        this.buildGateNode(gate, {
          accent: 0xffd27a, core: 0xfff3b8, inward: false, label: 'HOME GROUND',
          onTap: () => this.warpToChapter(3)
        });
      }
    } else {
      // Chapter 3 (Home Ground): return gate → Chapter 2 (back inward to the body).
      const back = this.nodePositions[0];
      if (!back) return;
      // Sits in the bottom-left pocket above The Grocery Store. The paper-cutout
      // node is taller than the old lantern, and the ship's YOU ARE HERE pill
      // parks about 105px above the node, so the gate and its label live at
      // y 1195 (label near 1295) to clear both, and below The Big Store's label.
      const gate = { x: 150, y: 1195 };
      this.drawHiddenBranch(back, gate, 0xff7a8a);
      this.buildGateNode(gate, {
        accent: 0xff7a8a, core: 0xffcf6b, inward: true, label: 'INNER SPACE',
        onTap: () => this.warpToChapter(2)
      });
    }
  }

  // Draws a gorgeous animated wormhole — the "iris gate". Layers (back to front):
  // a breathing halo, a dark glassy membrane dome with a gradient core well, a
  // receding RING TUNNEL pulling toward a hot pinhole, and motes streaking
  // inward (entry / dive) or outward (return / surface). Direction is the ONLY
  // thing that flips between the two variants. Purely concentric rings + radial
  // motes + breathing halos — never a spiral / swirl / sigil.
  buildGateNode(pos, { accent, core = accent, inward, label, onTap }) {
    const R = 76;
    const dir = inward ? 1 : -1;
    const node = this.add.container(pos.x, pos.y).setDepth(5);

    // Static: breathing halo + membrane dome + glassy sheen + gradient core well.
    const g = this.add.graphics();
    g.fillStyle(accent, 0.07); g.fillCircle(0, 0, R + 34);
    g.fillStyle(accent, 0.12); g.fillCircle(0, 0, R + 20);
    g.fillStyle(accent, 0.18); g.fillCircle(0, 0, R + 8);
    g.fillStyle(0x0a0a1a, 0.94); g.fillCircle(0, 0, R);
    g.fillStyle(0xffffff, 0.06); g.fillEllipse(0, -R * 0.22, R * 1.5, R * 0.95);
    // Core well: stacked translucent discs (a dark throat warming to a glow at the
    // centre). Stacked solids render identically on WebGL + Canvas, unlike
    // fillGradientStyle, which is WebGL-only on circles.
    g.fillStyle(0x0a0a1a, 0.6); g.fillCircle(0, 0, R * 0.30);
    g.fillStyle(core, 0.30); g.fillCircle(0, 0, R * 0.22);
    g.fillStyle(core, 0.55); g.fillCircle(0, 0, R * 0.13);
    node.add(g);

    // Dynamic hero layers, redrawn each frame from a single phase.
    const tunnel = this.add.graphics(); node.add(tunnel);
    const motes = this.add.graphics(); node.add(motes);

    // Bright pulsing pinhole core (the tap beacon).
    const coreG = this.add.graphics();
    coreG.fillStyle(core, 0.9); coreG.fillCircle(0, 0, 10);
    coreG.fillStyle(0xffffff, 0.85); coreG.fillCircle(0, 0, 6);
    coreG.fillStyle(0xffffff, 1); coreG.fillCircle(0, 0, 3);
    node.add(coreG);

    // ONE per-frame handler (delta-based) drives both dynamic layers. Removed on
    // shutdown — warpToChapter restarts the scene, reusing this instance, so a
    // forgotten off() would stack a handler every warp.
    let phase = 0;
    const onFrame = (_, delta) => {
      phase = (phase + delta / 4200) % 1;
      const s = g.scaleX; // inhale with the breathing dome so the whole gate pulses as one
      tunnel.clear();
      for (let i = 0; i < 7; i++) {
        const p = (((i / 7) + phase * dir) % 1 + 1) % 1;
        const edge = Math.min(p / 0.12, (1 - p) / 0.12, 1); // fade in at rim, out at core
        if (edge <= 0) continue;
        tunnel.lineStyle(1 + 4 * p, accent, (0.25 + 0.55 * p) * Math.max(0, edge));
        tunnel.strokeCircle(0, 0, R * s * p * p); // quadratic spacing → tunnel depth
      }
      motes.clear();
      for (let m = 0; m < 6; m++) {
        const f = ((phase + m / 6) % 1 + 1) % 1;
        const t = dir > 0 ? 1 - f : f; // entry: rim→core, return: core→rim
        const rad = (R * 0.06 + R * 0.89 * t) * s;
        const ang = m * (Math.PI * 2 / 6) + 0.4;
        motes.fillStyle(accent, Math.max(0, dir > 0 ? 1 - f : f) * 0.95);
        motes.fillCircle(Math.cos(ang) * rad, Math.sin(ang) * rad, 2.5);
      }
    };
    this.events.on('update', onFrame);
    this.events.once('shutdown', () => this.events.off('update', onFrame));

    // Breathing tweens with deliberately non-harmonic periods (halo 1900 / core
    // 1400) so the gate never visibly loops — it reads as alive.
    this.tweens.add({
      targets: g, scale: { from: 1.0, to: 1.06 },
      duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
    this.tweens.add({
      targets: coreG, scale: { from: 0.88, to: 1.16 }, alpha: { from: 0.8, to: 1.0 },
      duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    // Gate name: the same label as a world, clamped inside the edge gutter
    // (the Chapter 3 gate sits at x=150).
    const key = `g${pos.x},${pos.y}`;
    this._nodeDiscs.push({ x: pos.x, y: pos.y, r: R + 12, key });
    this.addMapLabel(pos.x, pos.y + R + 24, label, accent, key);
    this._mapLabels[this._mapLabels.length - 1].altY = pos.y - R - 24;
    const hit = this.add.circle(pos.x, pos.y, R + 12, 0, 0)
      .setInteractive({ useHandCursor: true }).setDepth(7);
    hit.on('pointerdown', onTap);
    hit.on('pointerover', () => this.tweens.add({ targets: node, scale: 1.06, duration: 120 }));
    hit.on('pointerout', () => this.tweens.add({ targets: node, scale: 1, duration: 120 }));
    return node;
  }

  // Warp the map between chapters: launch the ship into the wormhole, play the
  // travel cinematic, then persist the new chapter and restart the scene so it
  // rebuilds on the other map. The cinematic owns the warp sound + the seamless
  // hold-to-black handoff; we just kick off the ship and hand it the restart.
  warpToChapter(target) {
    if (this._warping) return;
    this._warping = true;
    // NOTE: do NOT disable this.input here. The cinematic's own opaque backdrop
    // + full-screen hit rect (depth 2000) already shield the map nodes from
    // stray taps. The dive has no skip: it always plays in full.
    if (this.shipPet) {
      this.tweens.killTweensOf(this.shipPet);
      this.tweens.add({
        targets: this.shipPet,
        y: this.shipPet.y - 50, scale: 0.5, alpha: 0.15,
        duration: 700, ease: 'Quad.easeIn'
      });
    }
    // Park the ship where the player should land. Entering a NEW chapter parks at
    // its first world; surfacing/returning parks at the finale gate they left
    // from (not all the way back at the chapter's start).
    let parkId;
    if (target === 3) parkId = getChapterWorlds(3)[0]?.id;            // → Home Ground start
    else if (target === 2) parkId = this.currentChapter === 3
      ? CHAPTER2_FINAL_ID                                             // back from Home Ground → the finale gate
      : getChapterWorlds(2)[0]?.id;                                   // in from Outer → Inner Space start
    else parkId = CHAPTER1_FINAL_ID;                                  // back to the surface (World 11 gate)
    if (parkId != null) this.registry.set('shipParkedWorldId', parkId);

    // Direction by scale: Inner Space (2) is the innermost, Outer (1) the
    // outermost, Home Ground (3) human-scale in between. Diving toward a more-inward
    // chapter plays 'in'; surfacing toward a more-outward one plays 'out'. The
    // cinematic restarts the scene under its opaque hold, so the rebuilt map
    // fades in seamlessly.
    const inwardRank = { 1: 0, 3: 1, 2: 2 };
    const dir = inwardRank[target] > inwardRank[this.currentChapter] ? 'in' : 'out';
    // Entering Home Ground (Chapter 3) is the homecoming: recolor the dive warm
    // daylight. Leaving it (back toward the body) keeps the default cosmic↔body bridge.
    const opts = target === 3 ? { palette: 'homecoming' } : {};
    playWormholeCinematic(this, dir, () => {
      progress.setCurrentChapter(target);
      this.scene.restart();
    }, opts);
  }

  // ============================================================
  // HOME GROUND ARRIVAL CARD: the premise beat for Chapter 3.
  //
  // The Ch1→Ch2 seam is loud (the Void cracks open and pulls you inward). The
  // Ch2→Ch3 seam was silent: the homecoming dive played, the map recoloured, and
  // the mode quietly changed from dodging asteroids to a calm line with no
  // explanation. A kid reads an unexplained genre change as "different game",
  // not "next chapter". This card is the missing sentence: the fighting is
  // over, this is one Saturday around home, and that is WHY the line is calm.
  //
  // Fires once ever (progress.homeGroundWelcomeSeen), on the first Chapter 3
  // map build after the Home Ground rework. The older makerWelcomeSeen flag is
  // left in saves untouched, so a kid who saw the old card sees this one once
  // as well. The body copy is a narrator placeholder until J writes
  // his own lines.
  // ============================================================
  maybeShowHomeGroundWelcome() {
    if (this.currentChapter !== 3) return;
    if (progress.homeGroundWelcomeSeen) return;

    progress.markHomeGroundWelcomeSeen();

    const root = this.add.container(0, 0).setDepth(400);
    // Deep, near-opaque so the map behind never competes with the type (the map's
    // own world labels are bright and sit right under this card's headline).
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x0b1608, 0)
      .setInteractive().setScrollFactor(0);
    root.add(overlay);
    this.tweens.add({ targets: overlay, fillAlpha: 0.97, duration: 400 });

    const card = this.add.container(W / 2, H / 2 - 40).setScrollFactor(0);
    card.setScale(0.7); card.alpha = 0;
    root.add(card);

    // Paper-cutout gondola cabin hanging from a short wire: the chapter's one
    // big image (the ride down the mountain at dusk) in plain shapes. A rounded
    // rect body in awning red, a darker roof cap, a pale window strip, and the
    // same shapes drawn first in black at 0.22, pushed down and right, for the
    // hard paper shadow. Plain shapes only, no rays, no spiral.
    const cabin = this.add.graphics();
    const CY = -300;
    // The wire is a thin stroke, the one kind of line the cutout style allows.
    cabin.lineStyle(4, 0xe8dcc4, 0.9);
    cabin.lineBetween(-120, CY - 92, 120, CY - 92);
    paper(cabin, 4, 6, (g, shadow) => {
      ink(g, shadow, 0x9c2f26); g.fillRoundedRect(-16, CY - 102, 32, 18, 6);   // grip on the wire
      ink(g, shadow, 0x9c2f26); g.fillRoundedRect(-6, CY - 92, 12, 48, 4);     // hanger arm
      ink(g, shadow, 0xe8594a); g.fillRoundedRect(-50, CY - 44, 100, 78, 16);  // cabin body
      ink(g, shadow, 0xb8392e); g.fillRoundedRect(-56, CY - 50, 112, 20, 8);   // roof cap
      ink(g, shadow, 0xfff8e7); g.fillRoundedRect(-36, CY - 22, 72, 24, 7);    // window strip
      ink(g, shadow, 0xe8594a); g.fillRect(-3, CY - 22, 6, 24);                // window post
    });
    // One white highlight, a glint along the roof cap.
    cabin.fillStyle(0xffffff, 0.5);
    cabin.fillRoundedRect(-46, CY - 47, 26, 5, 2);
    card.add(cabin);

    // Stacked top down from under the cabin, each block placed by its measured
    // height so the body-size lines never crowd the headline.
    const title = this.add.text(0, 0, 'HOME GROUND', style('display', {
      fontSize: '72px', fill: '#ffd27a', fontStyle: '900',
      stroke: '#1a1208', strokeThickness: 5
    })).setOrigin(0.5, 0);
    const tagline = this.add.text(0, 0, 'You made it home.', style('subhead', {
      fontSize: '42px', fill: '#9be86b'
    })).setOrigin(0.5, 0);
    // The owner's own words. Three short lines, each under 40 characters so
    // nothing wraps at 42px inside 860px. This is the whole point of the card:
    // it names the change of genre out loud (no more fighting) before she meets
    // the first calm belt, so the quiet reads as the story and not as a bug.
    const story = this.add.text(0, 0,
      'Time to relax. Time to enjoy.\nNo more fighting, no more dark.\nJust exploring the city together.',
      style('body', {
        fontSize: '42px', fill: '#fff3b8', align: 'center',
        lineSpacing: 12, wordWrap: { width: W - 220 }
      })).setOrigin(0.5, 0);
    const calm = this.add.text(0, 0, 'Take your time.\nNothing here is chasing you.', style('body', {
      fontSize: '42px', fill: '#e8e8d0', align: 'center', lineSpacing: 10
    })).setOrigin(0.5, 0);
    let ty = CY + 50;
    for (const [t, gapBelow] of [[title, 4], [tagline, 28], [story, 32], [calm, 0]]) {
      t.y = ty;
      ty += t.height + gapBelow;
      card.add(t);
    }

    this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 420, ease: 'Back.easeOut' });
    audio.playStar?.();

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      this.tweens.add({
        targets: root, alpha: 0, duration: 320,
        onComplete: () => root.destroy()
      });
    };
    this.time.delayedCall(1200, () => {
      const btn = createButton(this, {
        x: W / 2, y: H - 300, label: "Let's go",
        width: 380, height: 100, color: 0x4f8a3a,
        onClick: finish
      });
      btn.setScrollFactor(0);
      root.add(btn);
      btn.alpha = 0;
      this.tweens.add({ targets: btn, alpha: 1, duration: 500 });
    });
  }

  // ============================================================
  // HIDDEN WORLD NODES
  // ============================================================
  createHiddenNodes() {
    // Each hidden world branches off a host in its OWN chapter, so only draw the
    // ones belonging to the map currently being viewed (Ch1 secrets on the Ch1
    // map, Ch2 secrets — King Coli / Recess — on the Ch2 map).
    for (const h of HIDDEN_WORLDS) {
      if ((h.chapter || 1) !== this.currentChapter) continue;
      if (!progress.isHiddenWorldDiscovered(h.id)) continue;
      const pos = HIDDEN_NODE_POSITIONS[h.id];
      if (!pos) continue;

      // Dashed branch path from host visible world → hidden world. Read as a
      // "side route" that branches off the main S-curve.
      const hostIdx = HIDDEN_HOST_INDEX[h.id];
      if (hostIdx != null) {
        const host = this.nodePositions[hostIdx];
        if (host) this.drawHiddenBranch(host, pos, h.accentColor);
      }

      const node = this.add.container(pos.x, pos.y).setDepth(5);
      const NODE_R = 62;

      if (h.id === 15) {
        const planet = drawGlitchPlanetNode(this, 0, 0, NODE_R);
        node.add(planet);
        this.tweens.add({
          targets: node,
          x: pos.x + 3,
          duration: 110,
          yoyo: true,
          repeat: -1,
          ease: 'Linear'
        });
      } else if (h.id === 16) {
        const garage = drawGarageNode(this, 0, 0, NODE_R);
        node.add(garage);
        this.tweens.add({
          targets: node,
          y: pos.y - 6,
          duration: 1800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      } else if (h.id === 17) {
        node.add(drawKingColiNode(this, 0, 0, NODE_R));
        this.tweens.add({
          targets: node,
          y: pos.y - 6,
          duration: 1500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      } else if (h.id === 18) {
        node.add(drawPlaygroundNode(this, 0, 0, NODE_R));
        this.tweens.add({
          targets: node,
          y: pos.y - 6,
          duration: 1900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      } else if (h.id === 19) {
        node.add(drawHotPotNode(this, 0, 0, NODE_R));
        this.tweens.add({
          targets: node,
          y: pos.y - 6,
          duration: 2100,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      } else if (h.id === 20) {
        node.add(drawNightShiftNode(this, 0, 0, NODE_R));
        // Barely moves — a building, not a vessel. The drift is there so it
        // doesn't sit dead next to the bobbing nodes around it.
        this.tweens.add({
          targets: node,
          y: pos.y - 3,
          duration: 3200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }

      // Label: sits below the larger node.
      //
      // Hidden nodes sit in the map's edge pockets by design, so a long secret
      // name centred on the node can run off the canvas ("THE NIGHT SHIFT" at
      // x=975 overflowed the right edge by 2px). addMapLabel clamps the label's
      // CENTRE so the whole string stays inside the 24px gutter; the node itself
      // stays where the layout put it, and the label slides only as far as it
      // must. Applies to every secret, so a future long name can't reintroduce
      // the same bug.
      this._nodeDiscs.push({ x: pos.x, y: pos.y, r: NODE_R + 4, key: `h${h.id}` });
      this.addMapLabel(pos.x, pos.y + NODE_R + 26, h.name, h.accentColor, `h${h.id}`);

      // Gauntlet secrets (Glitch World, King Coli) have no Level Select screen
      // to surface their rating, so show the boss star score (levelStars[1], 0-3)
      // right under the node label; otherwise a 3-star win records but never
      // displays anywhere. Exploration secrets (Garage, Recess) have no stars.
      if (h.kind === 'gauntlet') {
        const best = progress.worldProgress[h.id]?.levelStars?.[1] || 0;
        const starGap = 46;
        const starY = pos.y + NODE_R + 76;
        this._nodeDiscs.push({ x: pos.x, y: starY, r: 20, key: `h${h.id}` });
        this._nodeDiscs.push({ x: pos.x - starGap, y: starY, r: 20, key: `h${h.id}` });
        this._nodeDiscs.push({ x: pos.x + starGap, y: starY, r: 20, key: `h${h.id}` });
        for (let s = 0; s < 3; s++) {
          const sg = this.add.graphics().setDepth(6);
          if (s < best) drawStarIcon(sg, 0, 0, 16);
          else drawStarIcon(sg, 0, 0, 16, 0x3a3a50);
          sg.x = pos.x + (s - 1) * starGap;
          sg.y = starY;
        }
      }

      const hit = this.add.circle(pos.x, pos.y, NODE_R + 8, 0, 0)
        .setInteractive({ useHandCursor: true }).setDepth(7);
      hit.on('pointerdown', () => {
        audio.playClick();
        this.registry.set('selectedWorld', h.id);
        this.registry.set('hiddenWorldId', h.id);
        if (h.kind === 'gauntlet') {
          this.registry.set('currentWorldId', h.id);
          this.registry.set('currentLevel', 1);
          this.registry.set('levelMode', 'boss');
          // Chapter 3's gauntlet is the belt, not the asteroid field: The Night
          // Shift is flagged `belt` and runs its quota race in the Conveyor.
          new TransitionManager(this).fadeToScene(h.belt ? 'ConveyorScene' : 'GameScene');
        } else {
          new TransitionManager(this).fadeToScene('HiddenWorldScene');
        }
      });
    }
  }

  drawHiddenBranch(host, dest, accent) {
    // Sampled dashed line with a midpoint pull so the branch arcs slightly.
    // Shares the control-point math with the ship-travel tween so the ship
    // visibly follows this same curve.
    const control = hiddenBranchControlPoint(host, dest);
    const g = this.add.graphics().setDepth(2);
    const samples = 60;
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      pts.push(sampleHiddenBranch(host, dest, i / samples, control));
    }
    // Dark underlay
    g.lineStyle(6, 0x121225, 0.85);
    for (let i = 1; i < pts.length; i++) {
      g.lineBetween(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    }
    // Dashed accent on top
    g.lineStyle(3, accent, 0.85);
    for (let i = 1; i < pts.length; i += 2) {
      g.lineBetween(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    }
    // Sparkles along the branch
    g.fillStyle(0xffffff, 0.55);
    for (let i = 4; i < pts.length; i += 10) {
      g.fillCircle(pts[i].x, pts[i].y, 2);
    }
  }

  // ============================================================
  // WARP ARRIVAL (after the warp asteroid is solved)
  //
  // GameScene.triggerWarp hands off here via registry flags so the player
  // sees the ship physically traveling from the host world to the freshly
  // discovered hidden world before the destination scene loads.
  // ============================================================
  tryWarpArrival() {
    const hiddenId = this.registry.get('warpArrivalHiddenId');
    if (!hiddenId) return false;

    const hostIdx = HIDDEN_HOST_INDEX[hiddenId];
    const hiddenPos = HIDDEN_NODE_POSITIONS[hiddenId];
    const hostPos = hostIdx != null ? this.nodePositions[hostIdx] : null;

    // Validate BEFORE clearing flags. If anything is missing the kid still
    // ended up on the map (triggerWarp already did discoverHiddenWorld) — drop
    // them straight into the destination so the warp isn't silently dropped.
    if (hostIdx == null || !hiddenPos || !hostPos) {
      this.registry.set('warpArrivalHiddenId', null);
      this.registry.set('warpArrivalFromWorldId', null);
      this._enterHiddenDestination(hiddenId);
      return true;
    }

    this.registry.set('warpArrivalHiddenId', null);
    this.registry.set('warpArrivalFromWorldId', null);

    // Snap the ship to the host world so the journey starts where the
    // player was actually playing. Stop the idle bob so it doesn't fight
    // the travel tween.
    this.currentWorldIndex = hostIdx;
    if (this._bobTween) {
      this._bobTween.stop();
      this._bobTween = null;
    }
    this.shipPet.x = hostPos.x;
    this.shipPet.y = hostPos.y - 30;
    this.shipPet.rotation = 0;
    // NB: scene input stays ENABLED. The full-screen shield below (depth 900)
    // swallows taps so no map node can start a level mid-warp. The flight has
    // no skip: it always plays in full.

    // Gauntlet path (Glitch, King Coli): GameScene swaps to the boss theme on
    // arrival. Pause the map ambient here so the brief travel beat isn't backed
    // by the wrong music. (Exploration arrivals fade to their own theme.)
    if (findWorld(hiddenId)?.kind === 'gauntlet') {
      music.pause();
    }

    let arrived = false;
    // Invisible tap shield with no handler. It stays up through the flight and
    // the arrival dwell so a stray tap can't hit a map node and race the scene
    // swap below; scene.start in _enterHiddenDestination tears it down.
    this.add.rectangle(W / 2, H / 2, W, H, 0, 0)
      .setInteractive().setDepth(900);

    const finishArrival = () => {
      if (arrived) return;
      arrived = true;
      this._showArrivalTooltip(this._arrivalTooltipConfig(hiddenId, hiddenPos));
      this.time.delayedCall(1600, () => this._enterHiddenDestination(hiddenId));
    };

    // Brief settle so the warp cinematic's fade has fully cleared before
    // the ship animates off.
    this.time.delayedCall(450, () => {
      this._travelAlongBranch(hostPos, hiddenPos, finishArrival);
    });

    return true;
  }

  _arrivalTooltipConfig(hiddenId, pos) {
    if (hiddenId === 16) {
      // Dad's Garage — warm single-line, "you found it" framing.
      return {
        x: pos.x,
        y: pos.y,
        label: "YOU FOUND DAD'S GARAGE",
        accent: 0xffd86b,
        sound: 'playStardustChime'
      };
    }
    if (hiddenId === 18) {
      // Recess — warm single-line, like the garage.
      return {
        x: pos.x,
        y: pos.y,
        label: 'YOU FOUND THE PLAYGROUND',
        accent: 0x7ed957,
        sound: 'playStardustChime'
      };
    }
    if (hiddenId === 17) {
      // King Coli — celebratory two-line secret-boss reveal.
      return {
        x: pos.x,
        y: pos.y,
        label: 'SECRET BOSS DISCOVERED',
        subtitle: 'THE ROYAL FLUSH',
        accent: 0xfbbf24,
        subtitleColor: '#eed25a',
        sound: 'playStar'
      };
    }
    // Glitch — celebratory two-line: gold "SECRET WORLD DISCOVERED" +
    // magenta "GLITCH WORLD" subtitle.
    return {
      x: pos.x,
      y: pos.y,
      label: 'SECRET WORLD DISCOVERED',
      subtitle: 'GLITCH WORLD',
      accent: 0xfbbf24,
      subtitleColor: '#ff5cf2',
      sound: 'playStar'
    };
  }

  _travelAlongBranch(host, dest, onArrive) {
    const control = hiddenBranchControlPoint(host, dest);
    audio.playLaser?.();
    const tween = { t: 0 };
    return this.tweens.add({
      targets: tween,
      t: 1,
      duration: 1500,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const pt = sampleHiddenBranch(host, dest, tween.t, control);
        this.shipPet.x = pt.x;
        this.shipPet.y = pt.y - 30;
        const ahead = sampleHiddenBranch(host, dest, Math.min(1, tween.t + 0.02), control);
        const angle = Math.atan2(ahead.y - pt.y, ahead.x - pt.x) - Math.PI / 2;
        this.shipPet.rotation = angle * 0.3;
      },
      onComplete: () => {
        this.shipPet.rotation = 0;
        this.cameras.main.shake(180, 0.004);
        onArrive?.();
      }
    });
  }

  _enterHiddenDestination(hiddenId) {
    // Gauntlet secrets (Glitch, King Coli) drop into a GameScene boss fight; the
    // belt-flagged one (The Night Shift) runs its quota race in the Conveyor;
    // exploration secrets (Garage, Recess) open their HiddenWorldScene.
    const hidden = findWorld(hiddenId);
    if (hidden?.kind === 'gauntlet') {
      this.registry.set('currentWorldId', hiddenId);
      this.registry.set('currentLevel', 1);
      this.registry.set('levelMode', 'boss');
      this.scene.start(hidden.belt ? 'ConveyorScene' : 'GameScene');
    } else {
      this.scene.start('HiddenWorldScene', { worldId: hiddenId });
    }
  }

  // ============================================================
  // AUTO-ADVANCE SHIP (after a world is cleared)
  // ============================================================
  tryAutoAdvance() {
    const cleared = progress.justClearedWorld;
    if (!cleared) return;

    const nextId = getNextVisibleWorldId(cleared);
    if (!nextId) {
      // Just cleared the final world — credits handle the flow, nothing to do.
      progress.consumeJustClearedWorld();
      return;
    }

    const clearedIdx = this.chapterWorlds.findIndex(w => w.id === cleared);
    const nextIdx = this.chapterWorlds.findIndex(w => w.id === nextId);

    if (clearedIdx < 0 || nextIdx < 0) {
      progress.consumeJustClearedWorld();
      return;
    }

    // Position ship at cleared world, animate to next.
    this.currentWorldIndex = clearedIdx;
    const startPos = this.nodePositions[clearedIdx];
    this.shipPet.x = startPos.x;
    this.shipPet.y = startPos.y - 30;

    progress.consumeJustClearedWorld();

    // Allow a tap to skip the animation.
    const skipHit = this.add.rectangle(W / 2, H / 2, W, H, 0, 0)
      .setInteractive().setDepth(50);
    let skipped = false;
    let travelTween = null;
    const skip = () => {
      if (skipped) return;
      skipped = true;
      if (travelTween) travelTween.stop();
      const dest = this.nodePositions[nextIdx];
      this.shipPet.x = dest.x;
      this.shipPet.y = dest.y - 30;
      this.shipPet.rotation = 0;
      this.currentWorldIndex = nextIdx;
      this._traveling = false;
      this._startShipBob();
      skipHit.destroy();
      this.input.enabled = true;
      this.showNewWorldTooltip(nextIdx);
    };
    skipHit.on('pointerdown', skip);

    // 600ms hold on the cleared world so the kid registers "you cleared this,"
    // then ship walks the path toward the freshly-unlocked node.
    this.time.delayedCall(600, () => {
      if (skipped) return;
      travelTween = this.travelTo(nextIdx, () => {
        skipHit.destroy();
        this.showNewWorldTooltip(nextIdx);
      });
    });
  }

  showNewWorldTooltip(nextIdx) {
    const pos = this.nodePositions[nextIdx];
    if (!pos) return;
    const world = this.chapterWorlds[nextIdx];
    // Pulse the freshly-unlocked node — three cycles, scale 1.0 → 1.15 → 1.0.
    // Signals "this is the new spot you can play now" before the tooltip fires.
    const node = this.nodeContainers?.[world?.id];
    if (node) {
      this.tweens.add({
        targets: node,
        scale: { from: 1, to: 1.15 },
        duration: 320,
        yoyo: true,
        repeat: 2,
        ease: 'Sine.easeInOut',
      });
    }
    this._showArrivalTooltip({ x: pos.x, y: pos.y });
  }

  _showArrivalTooltip({
    x, y,
    label = 'NEW WORLD UNLOCKED',
    subtitle = null,
    accent = 0xfbbf24,
    subtitleColor = '#ffffff',
    sound = null
  }) {
    const accentHex = '#' + accent.toString(16).padStart(6, '0');

    // Build the text(s) first so we can size the pill to fit any label. The
    // headline is body size (it has to read in the 2.2s it shows); the secret
    // world's name under it is label size.
    const labelText = this.add.text(0, 0, label, style('caption', {
      fontSize: '42px',
      fill: accentHex,
      fontStyle: '900'
    })).setOrigin(0.5);
    let subtitleText = null;
    if (subtitle) {
      subtitleText = this.add.text(0, 0, subtitle, style('caption', {
        fontSize: '36px',
        fill: subtitleColor,
        fontStyle: '900'
      })).setOrigin(0.5);
    }

    const padX = 28;
    const padY = 12;
    const widestText = subtitleText
      ? Math.max(labelText.width, subtitleText.width)
      : labelText.width;
    const halfW = Math.max(140, Math.ceil(widestText / 2) + padX);
    const contentH = labelText.height + (subtitleText ? subtitleText.height : 0);
    const halfH = Math.ceil(contentH / 2) + padY;
    labelText.y = -contentH / 2 + labelText.height / 2;
    if (subtitleText) subtitleText.y = contentH / 2 - subtitleText.height / 2;

    // Keep the pill on-screen even when the target node sits near the canvas
    // edge (Glitch lives at x=970, only ~110px from the right edge).
    const margin = 12;
    const clampedX = Math.max(halfW + margin, Math.min(W - halfW - margin, x));

    // Above the ship (which reaches about 95px above the node), rising 10px as
    // it fades in. A world near the top of the map would push it into the
    // header, so there it drops under the node's name instead.
    let tipY = y - 104 - halfH;
    if (tipY - 10 - halfH < MAP_HEADER_H + 10) tipY = y + NODE_LABEL_DY + 40 + halfH;
    const tip = this.add.container(clampedX, tipY).setDepth(18);
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 0.92);
    bg.fillRoundedRect(-halfW, -halfH, halfW * 2, halfH * 2, 12);
    bg.lineStyle(2, accent, 0.95);
    bg.strokeRoundedRect(-halfW, -halfH, halfW * 2, halfH * 2, 12);
    tip.add(bg);
    tip.add(labelText);
    if (subtitleText) tip.add(subtitleText);

    tip.alpha = 0;
    this.tweens.add({
      targets: tip,
      alpha: 1,
      y: tip.y - 10,
      duration: 300,
      ease: 'Quad.easeOut'
    });
    if (sound && typeof audio[sound] === 'function') {
      audio[sound]();
    }
    this.time.delayedCall(2200, () => {
      this.tweens.add({
        targets: tip,
        alpha: 0,
        duration: 400,
        onComplete: () => tip.destroy()
      });
    });
  }

  // ============================================================
  // PET BADGE (top-right pet button)
  // ============================================================
  buildPetBadge() {
    const sp = companion.getSpecies();
    const petAccent = sp ? sp.accent : COLORS.accentPurple;
    this.petBadge = createPetPortraitButton(this, {
      x: this._petBadgeX, y: this._petBadgeY, radius: this._petBadgeRadius,
      accentColor: petAccent,
      drawPet: (scene, x, y, opts) => drawCompanion(scene, x, y, opts),
      onClick: () => this.showLoreCard()
    }).setDepth(15);
  }

  refreshPetBadge() {
    if (this.petBadge) this.petBadge.destroy();
    this.buildPetBadge();
  }

  // ============================================================
  // TOAST (fading status text bottom-of-screen)
  // ============================================================
  // y, when given, is where the toast rests (a toast fired from inside a card
  // sits under the card instead of on its buttons).
  showToast(message, { y } = {}) {
    const toast = this.add.container(W / 2, 0).setDepth(120);
    // Body size; the box is sized from the text. A message too long for one
    // line splits into two lines of about equal length rather than leaving
    // one word on its own.
    const txt = this.add.text(0, 0, message, style('subhead', {
      fontSize: '42px',
      fill: '#ffeaa7',
      fontStyle: '900',
      align: 'center'
    })).setOrigin(0.5);
    const maxW = W - 180;
    if (txt.width > maxW) {
      const lines = Math.ceil(txt.width / maxW);
      txt.setWordWrapWidth(Math.min(maxW, Math.ceil(txt.width / lines) + 60));
    }
    const bw = Math.ceil(txt.width) + 80;
    const bh = Math.ceil(txt.height) + 32;
    const bg = this.add.graphics();
    // Opaque, so nothing under it (a card's close hint) shows through.
    bg.fillStyle(0x0a0a1a, 1);
    bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 20);
    bg.lineStyle(2, 0xfbbf24, 0.95);
    bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 20);
    toast.add(bg);
    toast.add(txt);
    // Rests 20px above the bottom world panel (which grows for a two-line
    // description), rising 50px as it fades in.
    const panelTop = this._bottomChromeTop ?? H - BOTTOM_CHROME_MIN_H;
    const restY = y ?? Math.min(H - 290, panelTop - 20 - bh / 2);
    toast.y = restY + 50;
    toast.alpha = 0;
    this.tweens.add({
      targets: toast, alpha: 1, y: restY,
      duration: 240, ease: 'Quad.easeOut'
    });
    this.time.delayedCall(1800, () => {
      this.tweens.add({
        targets: toast, alpha: 0, y: restY + 50,
        duration: 360,
        onComplete: () => toast.destroy()
      });
    });
  }

  showLoreCard() {
    audio.playClick();
    if (progress.endingSeen) {
      // Post-game: the badge opens the companion gallery (switch pet + form,
      // or raise a brand-new one). Pre-ending kids keep the single-pet flow.
      this.showCompanionCollection();
    } else if (progress.companion?.cosmicForm) {
      this.showStageCarousel();
    } else {
      this.showEvolutionLoreCard();
    }
  }

  // Post-game pet gallery. Shows all three companions (each at its grown cosmic
  // form). Tapping one makes it the active pet and chains into the form picker
  // (showStageCarousel) so the kid can choose its exact stage. A "raise a
  // brand-new pet" button drops into the normal egg-hatch flow.
  showCompanionCollection() {
    const ids = ['ember', 'tide', 'sprout'];
    const cw = 980;
    const ch = 1320;
    const { card, close } = createModal(this, {
      width: cw, height: ch,
      accentColor: COLORS.accentWarm,
      radius: 28, strokeWidth: 4,
      overlayAlpha: 0.85,
      showCloseButton: true,
      showCloseHint: false, // the X button is the close affordance; no redundant hint
    });

    card.add(this.add.text(0, -ch / 2 + 95, 'YOUR COMPANIONS', style('display', {
      fontSize: '60px',
      fill: '#ffffff',
    })).setOrigin(0.5));
    // Body-size hint, two lines, hung from under the title.
    card.add(this.add.text(0, -ch / 2 + 140, 'Tap a friend to bring them out, then pick their form.', style('body', {
      fontSize: '42px',
      fill: '#cfcfe0',
      align: 'center',
      wordWrap: { width: cw - 120 },
    })).setOrigin(0.5, 0));

    const activeId = progress.companion?.speciesId;
    // Cards are a little wider than before so a body-size tagline keeps its
    // longest word ("Liquid-metal") inside the card, and taller so up to four
    // tagline lines clear the ACTIVE pill.
    const cardW = 296;
    const cardH = 800;
    const gap = 24;
    const totalW = cardW * 3 + gap * 2;
    const startX = -totalW / 2 + cardW / 2;
    const rowY = -ch / 2 + 270 + cardH / 2;

    ids.forEach((id, i) => {
      const sp = SPECIES[id];
      const x = startX + i * (cardW + gap);
      const isActive = id === activeId;
      const sub = this.add.container(x, rowY);

      const bg = this.add.graphics();
      bg.fillStyle(COLORS.bgDark, 0.55);
      bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 20);
      bg.lineStyle(isActive ? 5 : 3, sp.color, isActive ? 1 : 0.55);
      bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 20);
      sub.add(bg);

      // Clean species art (no equipped cosmetics) so the gallery reads as a
      // species picker, not the active pet wearing the same hat three times.
      const portrait = drawCompanion(this, 0, -cardH / 2 + 210, {
        speciesId: id, stage: 'cosmic', scale: 1.2, cosmeticsOverride: {},
      });
      sub.add(portrait);

      sub.add(this.add.text(0, -cardH / 2 + 420, sp.name, style('display', {
        fontSize: '52px',
        fill: '#' + sp.color.toString(16).padStart(6, '0'),
      })).setOrigin(0.5));

      // Tagline hangs from under the name so extra lines grow downward.
      sub.add(this.add.text(0, -cardH / 2 + 462, sp.tagline, style('body', {
        fontSize: '42px',
        fill: '#cfcfe0',
        align: 'center',
        lineSpacing: 4,
        wordWrap: { width: cardW - 28 },
      })).setOrigin(0.5, 0));

      if (isActive) {
        this.addActivePill(sub, 0, cardH / 2 - 56);
      } else {
        sub.add(this.add.text(0, cardH / 2 - 56, 'Tap to choose', style('body', {
          fontSize: '42px', fill: '#cfcfe0',
        })).setOrigin(0.5));
      }

      const hit = this.add.rectangle(0, 0, cardW, cardH, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      sub.add(hit);
      hit.on('pointerover', () => this.tweens.add({ targets: sub, scaleX: 1.04, scaleY: 1.04, duration: 120 }));
      hit.on('pointerout', () => this.tweens.add({ targets: sub, scaleX: 1, scaleY: 1, duration: 120 }));
      hit.on('pointerdown', () => {
        audio.playClick();
        companion.setActiveSpecies(id);
        this.refreshPetBadge();
        close();
        this.showStageCarousel();
      });

      card.add(sub);
    });

    card.add(createButton(this, {
      x: 0, y: ch / 2 - 95,
      width: 580, height: 96,
      label: '🥚 RAISE A BRAND-NEW PET',
      color: COLORS.accentWarm,
      textStyle: 'subhead',
      textOverrides: { fontSize: '42px', fill: '#0a0a1a', fontStyle: '900' },
      onClick: () => {
        close();
        this.scene.start('StarterPickerScene');
      },
    }));
  }

  // Green "✓ ACTIVE" pill (label size), sized from its text, added to parent.
  addActivePill(parent, x, y) {
    const chip = this.add.container(x, y);
    const txt = this.add.text(0, 0, '✓ ACTIVE', style('subhead', {
      fontSize: `${MAP_LABEL_PX}px`, fill: '#0a0a1a', fontStyle: '900',
    })).setOrigin(0.5);
    const pw = Math.ceil(txt.width) + 56;
    const ph = Math.ceil(txt.height) + 14;
    const cbg = this.add.graphics();
    cbg.fillStyle(0x58d68d, 0.95);
    cbg.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, ph / 2);
    chip.add(cbg);
    chip.add(txt);
    parent.add(chip);
    return chip;
  }

  showStageCarousel() {
    const sp = companion.getSpecies();
    if (!sp) return;

    const cw = 920;
    const ch = 1440;
    const { card } = createModal(this, {
      width: cw, height: ch,
      accentColor: sp.accent,
      radius: 28, strokeWidth: 4,
      overlayAlpha: 0.85,
    });

    const stages = CAROUSEL_STAGE_ORDER;
    let viewIdx = Math.max(0, stages.indexOf(progress.companion.displayStage || companion.getActiveStage()));

    // Chrome (arrows + dots) lives in the outer container so it persists
    // across stage swaps; the per-stage content lives in `slidePane` so we
    // can slide between stages without rebuilding the chrome.
    const chrome = this.add.container(0, 0);
    card.add(chrome);

    let slidePane = null;
    const topY = -ch / 2 + 100;

    const arrowLeft = this.add.text(-cw / 2 + 80, topY, '◀', style('display', {
      fontSize: '54px', fill: '#ffffff',
      stroke: '#0a0a1a', strokeThickness: 4,
    })).setOrigin(0.5).setInteractive({ useHandCursor: true });
    arrowLeft.on('pointerdown', () => slideTo(-1));
    chrome.add(arrowLeft);

    const arrowRight = this.add.text(cw / 2 - 80, topY, '▶', style('display', {
      fontSize: '54px', fill: '#ffffff',
      stroke: '#0a0a1a', strokeThickness: 4,
    })).setOrigin(0.5).setInteractive({ useHandCursor: true });
    arrowRight.on('pointerdown', () => slideTo(1));
    chrome.add(arrowRight);

    const dotSpacing = 58;
    const dotsStartX = -(stages.length - 1) * dotSpacing / 2;
    const dotG = this.add.graphics();
    chrome.add(dotG);

    const renderDots = () => {
      dotG.clear();
      stages.forEach((s, i) => {
        const x = dotsStartX + i * dotSpacing;
        const unlocked = companion.isStageUnlocked(s);
        const isSel = (i === viewIdx);
        if (unlocked) {
          const dotColor = isSel ? sp.accent : 0xcfcfe0;
          dotG.fillStyle(dotColor, 1);
          dotG.fillCircle(x, topY, isSel ? 14 : 10);
        } else {
          dotG.lineStyle(3, 0xcfcfe0, 0.7);
          dotG.strokeCircle(x, topY, 10);
        }
      });
    };

    // Build the per-stage content into a fresh sub-container (so old + new
    // can co-exist mid-slide). Returns the container.
    const buildStagePane = (idx) => {
      const pane = this.add.container(0, 0);
      const stage = stages[idx];
      const isLocked = !companion.isStageUnlocked(stage);
      const stageLore = sp.stages[stage] || {};
      const isActive = stage === companion.getActiveStage();

      const portraitY = -ch / 2 + 480;
      if (isLocked) {
        // Locked stages: silhouette of the actual pet sprite + "???" overlay.
        // Far more evocative than a generic "?" — kid sees the SHAPE coming.
        const portraitScale = PORTRAIT_SCALE_BY_STAGE[stage] ?? 2.0;
        const silhouette = drawCompanion(this, 0, portraitY, { scale: portraitScale, stage });
        silhouette.setAlpha(0.35);
        pane.add(silhouette);
        pane.add(this.add.text(0, portraitY, '???', style('display', {
          fontSize: '120px',
          fill: '#ffffff',
          stroke: '#0a0a1a',
          strokeThickness: 6,
        })).setOrigin(0.5));
      } else {
        const portraitScale = PORTRAIT_SCALE_BY_STAGE[stage] ?? 2.0;
        const portrait = drawCompanion(this, 0, portraitY, { scale: portraitScale, stage });
        pane.add(portrait);
      }

      const nameY = -ch / 2 + 820;
      const displayName = isLocked ? '???' : (stageLore.name || '').toUpperCase();
      const nameText = this.add.text(0, nameY, displayName, style('display', {
        fontSize: '64px',
        fill: '#ffffff',
      })).setOrigin(0.5);
      pane.add(nameText);

      // Stage tag and lore stack under the name by their measured heights, so
      // the label-size tag never touches the name. The longest lore is three
      // lines, which still clears the button below.
      const tagText = this.add.text(0, 0, `· ${stage.toUpperCase()} ·`, style('caption', {
        fontSize: '36px',
        fill: '#' + sp.accent.toString(16).padStart(6, '0'),
      })).setOrigin(0.5, 0);
      tagText.y = nameY + nameText.height / 2 + 8;
      pane.add(tagText);

      // Body-size lore. Locked text stays the readable gray.
      const loreText = isLocked
        ? 'Keep playing to unlock this form.'
        : (stageLore.lore || '');
      pane.add(this.add.text(0, tagText.y + tagText.height + 16, loreText, style('body', {
        fontSize: '42px',
        fill: '#cfcfe0',
        align: 'center',
        wordWrap: { width: cw - 100 },
        lineSpacing: 8,
      })).setOrigin(0.5, 0));

      const btnY = ch / 2 - 260;
      if (!isLocked && !isActive) {
        pane.add(createButton(this, {
          x: 0, y: btnY,
          width: 520, height: 96,
          label: 'Set as my pet',
          color: sp.accent,
          textStyle: 'subhead',
          textOverrides: { fontSize: '42px', fill: '#0a0a1a', fontStyle: '900' },
          onClick: () => {
            companion.setDisplayStage(stage);
            this.refreshPetBadge();
            // Under the card, over its close hint, clear of both buttons.
            this.showToast(`Now showing: ${stageLore.name}`, { y: H / 2 + ch / 2 + 60 });
            // Replace the current pane so the button flips to "✓ ACTIVE".
            const fresh = buildStagePane(idx);
            card.add(fresh);
            slidePane.destroy();
            slidePane = fresh;
            renderDots();
          },
        }));
      } else if (!isLocked && isActive) {
        this.addActivePill(pane, 0, btnY);
      }

      if (companion.isFullyEvolved()) {
        pane.add(createButton(this, {
          x: 0, y: ch / 2 - 140,
          width: 580, height: 84,
          label: 'RAISE ANOTHER COMPANION',
          color: COLORS.accentWarm,
          textStyle: 'subhead',
          textOverrides: { fontSize: '42px', fill: '#0a0a1a', fontStyle: '900' },
          onClick: () => this.confirmRaiseAnother(),
        }));
      }

      return pane;
    };

    let sliding = false;
    const slideTo = (dir) => {
      if (sliding) return;
      audio.playClick?.();
      const nextIdx = (viewIdx + dir + stages.length) % stages.length;
      const outX = dir * -cw;
      const inFromX = dir * cw;

      const newPane = buildStagePane(nextIdx);
      newPane.x = inFromX;
      card.add(newPane);

      const oldPane = slidePane;
      sliding = true;
      this.tweens.add({
        targets: oldPane, x: outX, duration: 250, ease: 'Quad.easeOut',
        onComplete: () => oldPane.destroy(),
      });
      this.tweens.add({
        targets: newPane, x: 0, duration: 250, ease: 'Quad.easeOut',
        onComplete: () => { sliding = false; },
      });

      viewIdx = nextIdx;
      slidePane = newPane;
      renderDots();
    };

    slidePane = buildStagePane(viewIdx);
    card.add(slidePane);
    renderDots();
  }

  confirmRaiseAnother() {
    const sp = companion.getSpecies();
    // Heading and body built first; the card is sized to them: 70px margin,
    // heading, 40px, body, 60px, the 92px button row, 70px margin.
    const cw = 900;
    const heading = this.add.text(0, 0, 'RAISE A NEW COMPANION?', style('display', {
      fontSize: '52px',
      fill: '#ffd86b',
      stroke: '#0a0a1a',
      strokeThickness: 5,
      align: 'center',
      wordWrap: { width: cw - 80 }
    })).setOrigin(0.5, 0);
    const body = this.add.text(0, 0, `${sp?.stages?.adult?.name || 'Your pet'} will retire to your trophy shelf.\nYou'll pick a brand-new starter and raise it from an egg.\n\nYour cosmetics and ship stay with you.`, style('body', {
      fontSize: '42px',
      fill: '#cfcfe0',
      align: 'center',
      wordWrap: { width: cw - 100 },
      lineSpacing: 8
    })).setOrigin(0.5, 0);
    const btnH = 92;
    const ch = Math.max(700, Math.ceil(70 + heading.height + 40 + body.height + 60 + btnH + 70));
    const { card, close } = createModal(this, {
      width: cw, height: ch,
      accentColor: COLORS.accentWarm,
      radius: 24, strokeWidth: 4,
      overlayAlpha: 0.92,
      closeOnCardTap: false,
      showCloseHint: false
    });
    heading.y = -ch / 2 + 70;
    body.y = heading.y + heading.height + 40;
    card.add(heading);
    card.add(body);
    const btnY = ch / 2 - 70 - btnH / 2;

    card.add(createButton(this, {
      x: -180, y: btnY, width: 280, height: btnH,
      label: 'CANCEL',
      color: 0x6a6a8e,
      // White reads better than dark ink on this mid-gray face.
      textOverrides: { fontSize: '42px', fill: '#ffffff', fontStyle: '900' },
      onClick: () => close()
    }));
    card.add(createButton(this, {
      x: 180, y: btnY, width: 320, height: btnH,
      label: "LET'S DO IT",
      color: COLORS.accentWarm,
      textOverrides: { fontSize: '42px', fill: '#0a0a1a', fontStyle: '900' },
      onClick: () => {
        companion.retireAndStartNew();
        close();
        this.scene.start('StarterPickerScene');
      }
    }));
  }

  showEvolutionLoreCard() {
    const sp = companion.getSpecies();
    const lore = companion.getCurrentLore();
    if (!sp || !lore) return;

    const cw = 920;
    const ch = 1440;
    const { card, close } = createModal(this, {
      width: cw, height: ch,
      accentColor: sp.accent,
      radius: 28, strokeWidth: 4,
      overlayAlpha: 0.85,
      closeOnCardTap: true,
    });

    // Portrait
    const portrait = drawCompanion(this, 0, -ch / 2 + 240, { scale: 1.8 });
    card.add(portrait);

    // Name (much bigger)
    const nameY = -ch / 2 + 500;
    const nameText = this.add.text(0, nameY, lore.name.toUpperCase(), style('display', {
      fontSize: '68px',
      fill: '#ffffff'
    })).setOrigin(0.5);
    card.add(nameText);
    // Type tag, hung from under the name by its measured height so the two
    // never touch.
    const typeText = this.add.text(0, nameY + nameText.height / 2 + 8, lore.type, style('caption', {
      fontSize: '36px',
      fill: '#' + sp.accent.toString(16).padStart(6, '0')
    })).setOrigin(0.5, 0);
    card.add(typeText);
    // Lore description: body size, hung from under the type tag so its three
    // lines grow down into the gap above "Next stage".
    card.add(this.add.text(0, typeText.y + typeText.height + 16, lore.lore, style('body', {
      fontSize: '42px',
      fill: '#cfcfe0',
      align: 'center',
      wordWrap: { width: cw - 100 },
      lineSpacing: 8
    })).setOrigin(0.5, 0));

    // Evolution progress block: sits in lower third of card
    const prog = companion.getStageProgress();
    const py = ch / 2 - 600;
    if (prog.nextStage) {
      const nextLore = sp.stages[prog.nextStage];
      card.add(this.add.text(0, py, `Next stage: ${nextLore.name}`, style('subhead', {
        fontSize: '42px',
        fill: '#ffffff'
      })).setOrigin(0.5));

      // Silhouette of next stage (use alpha; .setTint doesn't apply to Graphics)
      const sil = drawCompanion(this, 0, py + 130, { scale: 0.9, stage: prog.nextStage });
      sil.setAlpha(0.35);
      card.add(sil);

      // Sub-goals
      const goals = [
        `${prog.worldsCleared.current}/${prog.worldsCleared.target} worlds cleared`,
        `${prog.lifetimeCorrect.current}/${prog.lifetimeCorrect.target} correct answers`,
        `${prog.accuracy.current}%/${prog.accuracy.target}% accuracy`
      ];
      const goalsStartY = py + 290;
      goals.forEach((g, i) => {
        const gy = goalsStartY + i * 56;
        card.add(this.add.text(0, gy, g, style('caption', {
          fontSize: '36px',
          fill: '#cfcfe0'
        })).setOrigin(0.5));
      });

      // Overall progress bar: sits with its own band, well above card edge.
      // 56px tall so its label-size percent (36px) fits inside the bar.
      const barW = cw - 200;
      const barH = 56;
      const barY = goalsStartY + 3 * 56 + 20 + barH / 2;
      const pct = Math.round(Math.min(1, prog.ratio) * 100);
      const bar = createProgressBar(this, {
        x: 0, y: barY,
        width: barW,
        height: barH,
        ratio: prog.ratio,
        color: sp.accent,
        label: `${pct}%`
      });
      card.add(bar);
    } else {
      // Adult — show trophy count + "Raise another companion" CTA
      card.add(this.add.text(0, py, 'FULLY EVOLVED', style('subhead', {
        fontSize: '52px',
        fill: '#ffd86b'
      })).setOrigin(0.5));

      const completedCount = companion.getCompletedPets().length;
      if (completedCount > 0) {
        card.add(this.add.text(0, py + 70, `Trophy shelf: ${completedCount}`, style('caption', {
          fontSize: '36px',
          fill: '#cfcfe0'
        })).setOrigin(0.5));
      }

      // CTA button: uses createButton for consistency
      const btn = createButton(this, {
        x: 0, y: py + 200, width: 580, height: 96,
        label: 'RAISE ANOTHER COMPANION',
        color: COLORS.accentWarm,
        textStyle: 'subhead',
        textOverrides: { fontSize: '42px', fill: '#0a0a1a', fontStyle: '900' },
        onClick: () => {
          companion.retireAndStartNew();
          close();
          this.scene.start('StarterPickerScene');
        }
      });
      card.add(btn);
    }
  }

  // ============================================================
  // PROGRESS HELPERS
  // ============================================================
  findCurrentWorldIndex() {
    const worlds = this.chapterWorlds;
    const parkedId = this.registry.get('shipParkedWorldId');
    if (parkedId) {
      const parkedIdx = worlds.findIndex(w => w.id === parkedId);
      if (parkedIdx >= 0 && progress.isWorldUnlocked(worlds[parkedIdx].id)) {
        return parkedIdx;
      }
    }
    for (let i = 0; i < worlds.length; i++) {
      const w = worlds[i];
      if (!progress.isWorldUnlocked(w.id)) return Math.max(0, i - 1);
      const wp = progress.getWorldProgress(w.id);
      if (wp.levelsCompleted < w.levelsRequired) return i;
    }
    return worlds.length - 1;
  }

  findFurthestUnlockedIndex() {
    // Seed -1 ("nothing unlocked") so a locked first world isn't mistaken for an
    // unlocked one — otherwise `isLocked = i > furthestUnlockedIndex` would treat
    // index 0 as playable and let a tap bypass the gate. In practice the displayed
    // chapter's first world is always unlocked, so this is purely defensive.
    let idx = -1;
    for (let i = 0; i < this.chapterWorlds.length; i++) {
      if (progress.isWorldUnlocked(this.chapterWorlds[i].id)) idx = i;
    }
    return idx;
  }

  onSceneWake() {
    // Restart only if the map's unlock/clear footprint changed; otherwise
    // refresh the live chips in place. Avoids tearing down + rebuilding all
    // node graphics on every back-from-shop / back-from-records.
    const newFootprint = this.computeMapFootprint();
    if (newFootprint !== this._mapFootprint) {
      this.scene.restart();
      return;
    }
    this.starsChip?.refresh();
    this.stardustChip?.refresh();
  }

  computeMapFootprint() {
    let s = '';
    for (const w of WORLDS) {
      const wp = progress.getWorldProgress(w.id);
      s += `${wp?.unlocked ? '1' : '0'}${wp?.levelsCompleted || 0};`;
    }
    return s;
  }
}
