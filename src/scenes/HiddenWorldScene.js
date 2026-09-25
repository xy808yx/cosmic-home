// Dad's Garage exploration scene.

import Phaser from 'phaser';
import { progress, findWorld } from '../GameData.js';
import { audio } from '../AudioManager.js';
import { music } from '../MusicManager.js';
import { TransitionManager } from '../TransitionManager.js';
import { style, TYPE } from '../textStyles.js';
import { createButton } from '../buttonHelper.js';
import { createModal } from '../modalHelper.js';
import { economy } from '../EconomyManager.js';
import { drawSparkleIcon } from '../StatIcons.js';
import { companion, drawCompanion } from '../CompanionManager.js';
import { anchorXY, PET_SPRITES } from '../PetSprites.js';
import { cosmetics } from '../CosmeticManager.js';
import { GARAGE_ITEMS } from '../content/dadGarage.js';
import { HOTPOT_ITEMS } from '../content/hotPot.js';
// All three notice boards deal off one shared pool + one deck, so a kid who
// visits every room in a day reads three different notes. See dadNotes.js.
import { DAD_NOTES } from '../content/dadNotes.js';

const W = 1080;
const H = 1920;

// Shrink a Text down through `sizes` until it fits `maxH`, then, if the smallest
// size still overflows, trim whole words off the end and add an ellipsis. Used
// by the room speech bubbles, which sit in a fixed-height panel.
function fitTextToBox(textObj, message, maxH, sizes) {
  for (const size of sizes) {
    textObj.setFontSize(size);
    if (textObj.height <= maxH) return;
  }
  let words = String(message).split(' ');
  while (words.length > 4 && textObj.height > maxH) {
    words = words.slice(0, -1);
    textObj.setText(words.join(' ') + '…');
  }
}

// Object labels in every secret room share one style, at the label size on the
// type scale (13pt on a 393pt-wide iPhone; the old 20px read at about 7pt).
// Each room keeps its own ink colors.
const ROOM_LABEL_STYLE = { fontSize: `${TYPE.label}px`, fontStyle: '800', strokeThickness: 5 };

function addRoomLabel(scene, x, y, text, fill, stroke) {
  return scene.add.text(x, y, text, style('caption', { ...ROOM_LABEL_STYLE, fill, stroke }))
    .setOrigin(0.5).setDepth(8);
}

// Every secret room leaves by the same top-right button. Dark ink on the gray
// face: the old white lettering on this gray read at about 2.8:1.
function addLeaveButton(scene, onClick) {
  return createButton(scene, {
    x: W - 130, y: 100, label: 'Leave',
    width: 200, height: 80,
    color: 0x9a9aae,
    textOverrides: { fill: '#0a0a1a', fontStyle: '800' },
    onClick
  }).setDepth(15);
}

// The message box sizes itself to its text. Rooms dock it in the top strip
// (the same band the fixed box always used, so it covers nothing new there);
// the garage docks it at the bottom, in the empty floor strip under the shoe
// rack, because its top row and the pet climbing on it sit under the top strip.
// Nothing in the garage is drawn or walks below about y 1730.
const BUBBLE_DOCK_Y = { top: 420, bottom: 1828 };

// What opening a board's note pays, once per board per day.
const DAD_NOTE_STARDUST = 10;
const BUBBLE_MAX_W = 960;
const BUBBLE_MAX_H = 170;
const BUBBLE_PAD_X = 48;
const BUBBLE_PAD_Y = 24;

// Dad's note board (playground + hot pot), in the board's own coordinates:
// the ground line is y 124. Wide and tall enough for "DAD'S NOTE" at the
// label size and "Tap to read" at the body size. drawDadNotesBoard draws to
// these numbers.
const NOTES_BOARD = { halfW: 152, top: -108, bottom: 62, headerY: -66, dividerY: -38, hintY: 4 };

export class HiddenWorldScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HiddenWorldScene' });
  }

  init(data) {
    this.hiddenWorldId = data?.worldId
      || this.registry.get('hiddenWorldId')
      || 16;
    this.world = findWorld(this.hiddenWorldId);
  }

  create() {
    audio.init();
    music.pause();

    if (!this.world || this.world.kind !== 'exploration') {
      // Defensive: this scene only handles exploration now. Anything else
      // (legacy Glitch entry, missing world) bounces back to the map.
      this.scene.start('WorldMapScene');
      return;
    }

    if (this.world.id === 19) {
      // The self-serve hot pot line — the Chapter 3 "HOT POT TIME" hidden world.
      // Falls back to the garage track (warm, intimate, already shipped) rather
      // than homeTheme until a bespoke hot-pot MP3 exists.
      this.createHotPotExploration();
      music.fadeToTrack(this, music.resolveTrack(this, 'hotPotTheme', 'dadsGarage'));
    } else if (this.world.id === 18) {
      // The neighbourhood playground and running track: the "RECESS" hidden world.
      this.createPlaygroundExploration();
      music.fadeToTrack(this, music.resolveTrack(this, 'playgroundTheme', 'homeTheme'));
    } else {
      this.createGarageExploration();
      music.fadeToTrack(this, 'dadsGarage');
    }

    new TransitionManager(this).fadeIn(300);
  }

  // ============================================================
  // DAD'S GARAGE — non-combat exploration with cameo bubbles
  // ============================================================
  createGarageExploration() {
    this.drawGarageBackdrop();

    this.add.text(W / 2, 160, "DAD'S GARAGE", style('display', {
      fontSize: '64px',
      fill: '#ffd86b',
      stroke: '#0a0a1a',
      strokeThickness: 5
    })).setOrigin(0.5).setDepth(5);

    this.createWhiteboard();

    // Bubble text lives in src/content/dadGarage.js.
    const bubbleFor = id => (GARAGE_ITEMS.find(i => i.id === id)?.bubble) || '';
    // labelDx: at the label size, "Pantry rack" and "Storage bins" meet in the
    // gap between the two, so each label leans out toward its own side.
    const items = [
      { id: 'freezer',  x: 175,    y: 580,  hitW: 240, hitH: 200, draw: drawChestFreezer, label: 'Chest freezer' },
      { id: 'rack',     x: 470,    y: 580,  hitW: 240, hitH: 320, draw: drawStorageRack,  label: 'Pantry rack', labelDx: -16 },
      { id: 'bins',     x: 690,    y: 600,  hitW: 200, hitH: 200, draw: drawStorageBins,  label: 'Storage bins', labelDx: 12 },
      { id: 'squat',    x: 940,    y: 600,  hitW: 220, hitH: 280, draw: drawSquatRack,    label: 'Squat rack' },
      { id: 'laptop',   x: 215,    y: 950,  hitW: 240, hitH: 200, draw: drawMacBook,      label: 'Laptop' },
      { id: 'printer',  x: 470,    y: 950,  hitW: 200, hitH: 200, draw: drawBambuA1,      label: '3D printer' },
      { id: 'stroller', x: 760,    y: 950,  hitW: 280, hitH: 260, draw: drawUppababyVista,label: 'Stroller' },
      { id: 'bikes',    x: 250,    y: 1280, hitW: 360, hitH: 220, draw: drawKidsBikes,    label: "Kids' bikes" },
      { id: 'ebike',    x: 760,    y: 1280, hitW: 360, hitH: 240, draw: drawRadPower,     label: 'Ebike' },
      { id: 'shoes',    x: W / 2,  y: 1560, hitW: 600, hitH: 200, draw: drawShoeRack,    label: 'Running shoes' }
    ].map(it => ({ ...it, bubble: bubbleFor(it.id) }));

    // Fresh node table every visit: a stale one would hand the pet destroyed
    // objects from the last time the room was built.
    this._garageNode = {};
    for (const item of items) {
      const node = this.add.container(item.x, item.y).setDepth(8);
      const g = this.add.graphics();
      item.draw(g);
      node.add(g);
      this._garageNode[item.id] = node;
      // Gentle "breathing" baseline so every object feels alive. The stroller
      // brings its own rocking motion instead (a scale + rock combo reads odd).
      if (item.id !== 'stroller') {
        this.tweens.add({
          targets: node,
          scale: { from: 1, to: 1.04 },
          duration: 1400 + Math.random() * 400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
      // Distinctive idle animation for select objects (freezer lid opening,
      // the 3D printer printing, the laptop glowing, …). No-op for the rest.
      this.animateGarageItem(item.id, node);

      addRoomLabel(this, item.x + (item.labelDx || 0), item.y + item.hitH / 2 + 16, item.label, '#ffd86b', '#0a0a1a');

      const hit = this.add.rectangle(item.x, item.y, item.hitW, item.hitH, 0, 0)
        .setInteractive({ useHandCursor: true }).setDepth(9);

      hit.on('pointerdown', () => {
        audio.playClick?.();
        if (item.id === 'bins' && !progress.isHiddenWorldCleared(16)) {
          this.showUnlockCelebration();
          return;
        }
        this.showBubble(item.x, item.y, item.bubble, { dock: 'bottom' });
        // The companion goes and does the thing the bubble is about.
        this.garagePetInteract(item.id);
      });
    }

    // The heat lamp is painted into the backdrop, so it gets its own tap zone
    // (the dome and bulb, clear of the whiteboard's left edge at x 260). The pet
    // only plays when tapped, so without this it would never bask under it.
    const lampHit = this.add.rectangle(180, 305, 140, 190, 0, 0)
      .setInteractive({ useHandCursor: true }).setDepth(9);
    lampHit.on('pointerdown', () => {
      audio.playClick?.();
      this.garagePetInteract('lamp');
    });

    // After the objects: the pet's routines use the node table above.
    this.createGaragePet();

    addLeaveButton(this, () => {
      // Crossfade back to the host chapter's ambient (the map re-confirms it).
      const homeKey = this.world?.chapter === 2
        ? music.resolveTrack(this, 'innerSpaceHome', 'homeTheme')
        : 'homeTheme';
      music.fadeToTrack(this, homeKey);
      this.scene.start('WorldMapScene');
    });
  }

  drawGarageBackdrop() {
    this.cameras.main.setBackgroundColor('#1a1410');

    const bg = this.add.graphics().setDepth(0);

    // Back wall — pale beige drywall with subtle vertical seam
    const wallTop = 0;
    const wallBottom = 1080;
    bg.fillStyle(0x6e6056, 1);
    bg.fillRect(0, wallTop, W, wallBottom - wallTop);
    // Vertical drywall seams
    bg.fillStyle(0x000000, 0.10);
    for (const sx of [180, 540, 900]) bg.fillRect(sx, wallTop, 2, wallBottom);
    // Subtle pegboard panel center-back
    bg.fillStyle(0x55473d, 1);
    bg.fillRoundedRect(330, 380, 420, 220, 8);
    bg.fillStyle(0x000000, 0.4);
    for (let py = 400; py < 580; py += 22) {
      for (let px = 350; px < 750; px += 22) bg.fillCircle(px, py, 2.5);
    }

    // Fluorescent strip light (top-center)
    bg.fillStyle(0xffffff, 0.95);
    bg.fillRoundedRect(W / 2 - 200, 320, 400, 22, 6);
    bg.fillStyle(0xffe6a8, 0.18);
    bg.fillEllipse(W / 2, 360, 560, 70);

    // Chicken coop heat lamp — hangs from ceiling on left, casts soft red glow
    // Hanging cord from ceiling
    bg.fillStyle(0x1a1a1f, 1);
    bg.fillRect(178, 0, 3, 220);
    // Hook clamp at top of cord
    bg.fillStyle(0x8a8a96, 1);
    bg.fillRoundedRect(166, 218, 28, 18, 4);
    bg.fillStyle(0x5a5a64, 1);
    bg.fillRect(172, 224, 16, 8);
    // Bracket arm down to dome
    bg.fillStyle(0x9a9aaa, 1);
    bg.fillRect(178, 236, 4, 32);
    // METAL DOME REFLECTOR — silver downward cone
    bg.fillStyle(0xb0b0bc, 1);
    bg.fillTriangle(118, 360, 242, 360, 180, 268);
    // Dome interior shading (darker hollow look)
    bg.fillStyle(0x4a4a52, 1);
    bg.fillTriangle(130, 355, 230, 355, 180, 280);
    // Dome rim band (thicker at the opening)
    bg.fillStyle(0x8a8a96, 1);
    bg.fillRect(118, 356, 124, 8);
    bg.fillStyle(0x5a5a64, 1);
    bg.fillRect(118, 364, 124, 4);
    // Highlight along left side of cone (3D feel)
    bg.fillStyle(0xe0e0e8, 1);
    bg.fillTriangle(118, 360, 138, 354, 180, 272);
    // RED INFRARED BULB peeking out below the dome
    bg.fillStyle(0x6a0a0a, 1);
    bg.fillCircle(180, 376, 19);
    bg.fillStyle(0xd13b3b, 1);
    bg.fillCircle(180, 374, 15);
    // Bulb hot core
    bg.fillStyle(0xff5a3a, 0.95);
    bg.fillCircle(180, 372, 9);
    bg.fillStyle(0xfff5d8, 0.85);
    bg.fillCircle(177, 369, 3.5);
    // Red glow spill on wall + nearby air
    bg.fillStyle(0xff3a2a, 0.14);
    bg.fillEllipse(180, 430, 340, 260);
    bg.fillStyle(0xff5a3a, 0.07);
    bg.fillEllipse(180, 540, 560, 480);

    // Floor — polished concrete with warm spill from the strip light above
    bg.fillStyle(0x5a5460, 1);
    bg.fillRect(0, wallBottom, W, H - wallBottom);
    // Lighter top of floor (back) fading to darker front
    bg.fillStyle(0x6a6470, 0.55);
    bg.fillRect(0, wallBottom, W, 220);
    bg.fillStyle(0x4a444d, 0.55);
    bg.fillRect(0, H - 300, W, 300);
    // Floor seam/expansion lines
    bg.lineStyle(2, 0x3a3438, 1);
    bg.lineBetween(0, wallBottom, W, wallBottom);
    bg.lineStyle(1, 0x756e7c, 0.7);
    bg.lineBetween(0, 1420, W, 1420);
    bg.lineBetween(0, 1700, W, 1700);
    // Warm lamp spill on floor center
    bg.fillStyle(0xffe6a8, 0.08);
    bg.fillEllipse(W / 2, 1280, W * 1.3, 800);
  }

  // x, y are unused: every message sits centered in its room's dock (see
  // BUBBLE_DOCK_Y). Long copy steps down a size, then trims, rather than
  // outgrowing the dock.
  showBubble(x, y, text, { dock = 'top' } = {}) {
    if (this._bubble) this._bubble.destroy();
    const bubble = this.add.container(W / 2, BUBBLE_DOCK_Y[dock]).setDepth(20);
    const t = this.add.text(0, 0, text, style('body', {
      fontSize: '42px',
      fill: '#2a1f12',
      align: 'center',
      wordWrap: { width: BUBBLE_MAX_W - BUBBLE_PAD_X * 2 }
    })).setOrigin(0.5);
    fitTextToBox(t, text, BUBBLE_MAX_H - BUBBLE_PAD_Y * 2, [TYPE.body, TYPE.label]);
    const bw = Math.min(BUBBLE_MAX_W, t.width + BUBBLE_PAD_X * 2);
    const bh = t.height + BUBBLE_PAD_Y * 2;
    const bg = this.add.graphics();
    bg.fillStyle(0xfff5d8, 0.98);
    bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 24);
    bg.lineStyle(3, 0x2a1f12, 1);
    bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 24);
    bubble.add(bg);
    bubble.add(t);
    bubble.alpha = 0;
    bubble.setScale(0.9);
    this.tweens.add({
      targets: bubble,
      alpha: 1,
      scale: 1,
      duration: 240,
      ease: 'Back.easeOut'
    });
    this._bubble = bubble;
    // Auto-fade after a while
    this.time.delayedCall(4500, () => {
      if (this._bubble === bubble) {
        this.tweens.add({
          targets: bubble,
          alpha: 0,
          duration: 400,
          onComplete: () => bubble.destroy()
        });
        this._bubble = null;
      }
    });
  }

  showUnlockCelebration() {
    progress.clearHiddenWorld(16);
    cosmetics.addAndEquip('acc_dad_glasses');
    audio.playMatch?.();

    // However the card is dismissed (Sweet, or a tap anywhere on the dim), the
    // pet puts on the freshly-equipped glasses and goes to dig through the bins
    // where they were found. The button just dismisses the card: the kid stays
    // in the garage and leaves on their own via the Leave button.
    return this.showFoundItCard({
      accent: 0xffd86b,
      ink: '#0a0a1a',
      subtitle: 'Tucked away in the storage bins.',
      unlocked: "Unlocked: Dad's Glasses",
      buttonLabel: 'Sweet',
      onClose: () => {
        this.refreshGaragePet();
        this.garagePetInteract('bins');
      }
    });
  }

  // The found-it card every secret room shows the first time its secret is
  // found, built once so the three rooms stay in step. It shows the pet
  // wearing the reward it just equipped. `onButton` runs from the button only,
  // just before the card closes; `onClose` runs however the card is dismissed.
  // `ink` is the dark tone for the title outline and the button lettering.
  showFoundItCard({ accent, ink, subtitle, unlocked, buttonLabel, onButton = null, onClose = null }) {
    const accentHex = '#' + accent.toString(16).padStart(6, '0');
    const { card, close } = createModal(this, {
      width: 880, height: 740,
      accentColor: accent,
      showCloseHint: false,
      onClose
    });
    card.add(this.add.text(0, -270, 'YOU FOUND IT!', style('display', {
      fontSize: '60px',
      fill: accentHex,
      stroke: ink,
      strokeThickness: 5
    })).setOrigin(0.5));
    card.add(this.add.text(0, -186, subtitle, style('body', {
      fill: '#e0e0ef',
      align: 'center',
      wordWrap: { width: 800 }
    })).setOrigin(0.5));

    card.add(drawCompanion(this, 0, -20, { scale: 1.4 }));

    // The reward's name, at the heading size: it names what was just found.
    card.add(this.add.text(0, 130, unlocked, style('headline', {
      fontSize: `${TYPE.heading}px`,
      fill: accentHex,
      align: 'center',
      wordWrap: { width: 800 }
    })).setOrigin(0.5));

    card.add(createButton(this, {
      x: 0, y: 250, width: 320, height: 92,
      label: buttonLabel,
      color: accent,
      textOverrides: { fill: ink, fontStyle: '900' },
      onClick: () => {
        onButton?.();
        close();
      }
    }));
    return card;
  }

  // ----------------------------------------------------------
  // GARAGE EXTRAS — whiteboard + pet companion + leave handling
  // ----------------------------------------------------------
  createWhiteboard() {
    const { message } = progress.getDailyNoteForBoard(DAD_NOTES, 'garage');

    // Whiteboard frame, mounted on the wall between the room title and the
    // pegboard; the heat lamp hangs just left of it and the Leave button sits
    // above-right.
    const bw = 560, bh = 166, by = 288;
    const wb = this.add.container(W / 2, by).setDepth(3);
    const frame = this.add.graphics();
    // Outer frame
    frame.fillStyle(0x2a2620, 1);
    frame.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 6);
    // White marker board
    frame.fillStyle(0xfafaf0, 1);
    frame.fillRoundedRect(-bw / 2 + 8, -bh / 2 + 8, bw - 16, bh - 16, 4);
    // Marker tray
    frame.fillStyle(0x4a3f30, 1);
    frame.fillRoundedRect(-bw / 2, bh / 2 - 4, bw, 8, 2);
    frame.fillStyle(0xff5b6e, 1);
    frame.fillCircle(-bw / 2 + 60, bh / 2, 5);
    frame.fillStyle(0x39ff14, 1);
    frame.fillCircle(-bw / 2 + 90, bh / 2, 5);
    wb.add(frame);

    // Lettered like the playground and hot pot boards: the board's name, a
    // divider, and "Tap to read". The note itself only opens in the popup, so
    // reading it is always the kid's choice, the same in all three rooms.
    wb.add(this.add.text(0, -32, "DAD'S NOTE", style('caption', {
      fill: '#2a1f12', fontStyle: '900'
    })).setOrigin(0.5));
    frame.fillStyle(0xd8d8cc, 1);
    frame.fillRect(-118, -4, 236, 3);
    wb.add(this.add.text(0, 34, 'Tap to read', style('body', {
      fill: '#5a4a36', fontStyle: 'italic'
    })).setOrigin(0.5));

    const hit = this.add.rectangle(W / 2, by, bw + 20, bh + 24, 0, 0)
      .setInteractive({ useHandCursor: true }).setDepth(4);
    hit.on('pointerdown', () => this.openDailyNote('garage', message));
  }

  // A tap on any of the three note boards. Opening today's note is what pays
  // that board's 10 stardust, once a day. The note shows on its own, with no
  // sticker or number on it; the stardust rises where the note was, after the
  // kid closes it. `onClose` then runs (the hot pot pet trots over to the board).
  openDailyNote(boardKey, message, onClose = null) {
    audio.playClick?.();
    const earned = progress.claimDailyNoteReward(boardKey);
    if (earned) economy.addStardust(DAD_NOTE_STARDUST);
    this.showDailyNotePopup(message, () => {
      if (earned) this.showNoteStardust(W / 2, H / 2);
      onClose?.();
    });
  }

  // "+10" and the stardust mark in the stardust purple, rising from where the
  // note was and fading, with a few small stardust sparkles drifting up around
  // it. Starting there keeps it off every board's own lettering.
  showNoteStardust(x, y) {
    audio.playStardustChime?.();
    const group = this.add.container(x, y).setDepth(40);
    const label = this.add.text(0, 0, `+${DAD_NOTE_STARDUST}`, style('display', {
      fontSize: `${TYPE.body}px`, fill: '#c77eff', stroke: '#1a0f2e', strokeThickness: 6
    })).setOrigin(0.5);
    const icon = this.add.graphics();
    const iconR = 20, gap = 10;
    drawSparkleIcon(icon, 0, 0, iconR);
    const total = label.width + gap + iconR * 2;
    label.x = -total / 2 + label.width / 2;
    icon.x = total / 2 - iconR;
    group.add([label, icon]);
    group.setScale(0.8);
    this.tweens.add({ targets: group, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: group, y: y - 120, duration: 1300, ease: 'Sine.easeOut',
      onComplete: () => group.destroy()
    });
    this.tweens.add({ targets: group, alpha: 0, delay: 850, duration: 450 });
    for (let i = 0; i < 5; i++) {
      const spark = this.add.graphics().setDepth(39);
      drawSparkleIcon(spark, 0, 0, 7 + (i % 3) * 3);
      spark.setPosition(x + (i - 2) * 46, y + 10 + (i % 2) * 18);
      this.tweens.add({
        targets: spark, y: spark.y - 90 - (i % 3) * 20, alpha: 0,
        delay: 80 * i, duration: 1100, ease: 'Sine.easeOut',
        onComplete: () => spark.destroy()
      });
    }
  }

  // `onClose` runs when the popup is dismissed (the hot pot board uses it to
  // send the pet over once the note has actually been read, not under the dim).
  showDailyNotePopup(message, onClose = null) {
    const { card } = createModal(this, {
      width: 920, height: 1000,
      accentColor: 0xffd86b,
      radius: 28, strokeWidth: 4,
      overlayAlpha: 0.85,
      closeOnCardTap: true,
      onClose
    });

    card.add(this.add.text(0, -380, "DAD'S NOTE", style('display', {
      fontSize: '52px',
      fill: '#ffd86b',
      stroke: '#0a0a1a',
      strokeThickness: 5
    })).setOrigin(0.5));

    // The board fills the card below the title; its inner panel is 736x616.
    const board = this.add.graphics();
    board.fillStyle(0x2a2620, 1);
    board.fillRoundedRect(-380, -300, 760, 640, 10);
    board.fillStyle(0xfafaf0, 1);
    board.fillRoundedRect(-368, -288, 736, 616, 6);
    card.add(board);

    // The note at the biggest size on the scale that fits the board:
    // heading size for every note in the current deck (153 characters at most),
    // stepping down to body, then the label size, only if a longer one arrives.
    const sizes = [TYPE.heading, TYPE.body, TYPE.label];
    const noteText = this.add.text(0, 20, message, style('body', {
      fontSize: sizes[0] + 'px',
      fill: '#2a1f12',
      align: 'center',
      wordWrap: { width: 680 },
      fontStyle: 'italic'
    })).setOrigin(0.5);
    for (const size of sizes) {
      noteText.setFontSize(size);
      noteText.setLineSpacing(Math.round(size * 0.26));
      if (noteText.height <= 560) break;
    }
    card.add(noteText);
  }

  // ----------------------------------------------------------
  // GARAGE PET: plays with an object only when a kid taps it.
  // ----------------------------------------------------------
  // A tap walks the pet to that object for its routine (sits in the ebike seat,
  // climbs into the stroller, watches a print...), then it stands and looks
  // around until the next tap. It never picks a stop on its own. A tap during a
  // routine is queued (the latest tap wins) and runs as soon as the routine
  // ends, so no lid is left open and no bike is left mid-roll. Every routine
  // takes a `done` callback and hands the pet back on the floor, out of any object.
  //
  // Routines that put the pet IN something move it inside that object's node
  // (_gpEnter), under the object's front piece (_gpBehind): it then breathes
  // and rocks with the object, and the front piece hides its lower half.
  createGaragePet() {
    // Reset first: these fields outlive the scene, and a stale pet, a busy flag
    // or a queued tap left over from a mid-routine exit would wedge the next visit.
    this._roomPet = null;
    this._roomPetSprite = null;
    this._gpBusy = false;
    this._gpQueued = null;
    this._gpRestTimer = null;
    this._gpIdleTween = null;
    this._gpHeld = null;
    this._gpHost = null;
    this._gpHostNode = null;
    this._gpFacing = -1;
    if (!companion.hasStarter()) return;

    const pet = this.add.container(520, 0).setDepth(11);
    this._roomPet = pet;
    this._roomPetSprite = drawCompanion(this, 0, 0, { scale: 1.1 });
    pet.add(this._roomPetSprite);
    // Starts on the open floor between the desk row and the bikes, low enough
    // that its ears stay under the "3D printer" label and left of the ebike.
    pet.y = 1255 - this._gpFoot();

    // Tap → chirp + heart particle
    const hit = this.add.rectangle(0, 0, 130, 130, 0, 0)
      .setInteractive({ useHandCursor: true });
    pet.add(hit);
    hit.on('pointerdown', () => {
      audio.playPetChirp?.();
      this._gpEmote('♥');
    });

    this._gpRest();
  }

  // Redraw the in-scene garage pet so a cosmetic equipped mid-visit (e.g. Dad's
  // Glasses from the storage bins) shows up right away instead of next visit.
  // No-op when there's no starter pet (createGaragePet bailed).
  refreshGaragePet() {
    if (!this._roomPet?.active || !this._roomPetSprite) return;
    this._roomPetSprite.destroy();
    this._roomPetSprite = drawCompanion(this, 0, 0, { scale: 1.1 });
    // addAt(…, 0) keeps the pet below the transparent tap hit-rect.
    this._roomPet.addAt(this._roomPetSprite, 0);
    this._gpFace(this._gpFacing);
  }

  // A tap on an object: that object is next. Starts right away if the pet is
  // resting; otherwise it runs as soon as the current routine finishes.
  garagePetInteract(id) {
    if (!this._roomPet?.active) return;
    this._gpQueued = id;
    if (!this._gpBusy) this._gpNext();
  }

  _gpNext() {
    const pet = this._roomPet;
    const id = this._gpQueued;
    if (!pet?.active || this._gpBusy || !id) return;
    this._gpRestTimer?.remove(false);
    this._gpRestTimer = null;
    this._gpIdleTween?.stop();
    this._gpIdleTween = null;
    pet.angle = 0;
    this._gpQueued = null;
    this._gpBusy = true;
    const routine = {
      freezer:  this.gpFreezerDive,
      rack:     this.gpRackSnack,
      bins:     this.gpBinsRummage,
      squat:    this.gpSquats,
      laptop:   this.gpLaptopType,
      printer:  this.gpWatchPrint,
      stroller: this.gpStrollerClimb,
      bikes:    this.gpBikeRide,
      ebike:    this.gpEbikeSeat,
      shoes:    this.gpShoeZoom,
      lamp:     this.gpBaskUnderLamp
    }[id];
    routine.call(this, () => this._gpRest());
  }

  // Between taps: stand and look around until a kid taps something. A tap that
  // came in during the last routine runs after a short beat.
  _gpRest() {
    const pet = this._roomPet;
    if (!pet?.active) return;
    if (this._gpHost) this._gpExit();
    this._gpDrop();
    pet.setScale(1);
    pet.angle = 0;
    this._gpBusy = false;
    if (this._gpQueued) {
      this._gpRestTimer = this.time.delayedCall(250, () => this._gpNext());
      return;
    }
    const face0 = this._gpFacing;
    const look = { p: 0 };
    this._gpIdleTween = this.tweens.add({
      targets: look, p: 1, duration: 3600, repeat: -1, repeatDelay: 1800,
      onUpdate: () => {
        const want = (look.p > 0.4 && look.p < 0.75) ? -face0 : face0;
        if (want !== this._gpFacing) this._gpFace(want);
        pet.angle = Math.sin(look.p * Math.PI * 2) * 3;
      }
    });
  }

  // ----- Garage pet helpers -----

  // Distance from the pet's origin down to its feet at a given scale. Sprites
  // differ a lot by species and stage (an egg is ~100px tall, an ember adult
  // ~150px), so every "stand on" / "sit in" spot is worked out from this.
  _gpFoot(scale = this._roomPet?.scaleY ?? 1) {
    const layout = this._roomPetSprite?.layout;
    return (layout ? layout.height / 2 : 60) * 1.1 * scale;
  }

  // How far the pet's eyes sit above its origin at a given scale (negative is
  // up), from the sprite's own head_eye anchor. Tide adults are short and wide
  // with low-set eyes, ember adults tall with high ones, so a fixed fraction of
  // the height hides some pets' eyes below a rim.
  _gpEyeY(scale = this._roomPet?.scaleY ?? 1) {
    const spr = this._roomPetSprite;
    if (!spr?.layout || !spr.species) return -this._gpFoot(scale) * 0.4;
    return anchorXY(spr.species.id, spr.stage, 'head_eye', spr.layout).y * 1.1 * scale;
  }

  // Origin y that sinks the pet into something (freezer, bin, stroller seat, shoe)
  // with its eyes just clear of the rim at `rimY`.
  _gpPeek(rimY, scale) {
    return rimY - 20 * scale - this._gpEyeY(scale);
  }

  // Half the pet's width at a given scale (for holding things at its side).
  _gpHalfW(scale = this._roomPet?.scaleX ?? 1) {
    const layout = this._roomPetSprite?.layout;
    return (layout ? layout.width / 2 : 60) * 1.1 * scale;
  }

  // Pet sprites face left by default; mirror the sprite to face right.
  _gpFace(dir) {
    this._gpFacing = dir > 0 ? 1 : -1;
    const s = this._roomPetSprite;
    if (s) s.scaleX = Math.abs(s.scaleY) * (this._gpFacing > 0 ? -1 : 1);
  }

  // A point in an object's own coordinates, in scene coordinates.
  _gpAt(host, x, y) {
    return host.getWorldTransformMatrix().transformPoint(x, y);
  }

  // Where the pet is in scene coordinates, hosted or not.
  _gpWorld() {
    const pet = this._roomPet;
    return this._gpHost ? this._gpAt(this._gpHost, pet.x, pet.y) : { x: pet.x, y: pet.y };
  }

  // A little heart or '!' floating up off the pet's head. Decorative glyphs,
  // so they keep their own size.
  _gpEmote(text, color = '#ff9ec7', size = 36) {
    const at = this._gpWorld();
    const t = this.add.text(at.x + 30, at.y - this._gpFoot() - 6, text, style('display', {
      fontSize: size + 'px', fill: color, art: true
    })).setOrigin(0.5).setDepth(20);
    this.tweens.add({
      targets: t, y: t.y - 50, alpha: 0, duration: 800,
      onComplete: () => t.destroy()
    });
  }

  // Hop-walk to a scene point, facing the way it's going. Only used while the
  // pet is in the scene (never while hosted). Always calls back on a later
  // frame, even when the pet is already there (a second tap on the same
  // object): routines declare their steps after starting the walk.
  _gpWalkTo(x, y, cb) {
    const pet = this._roomPet;
    const sx = pet.x, sy = pet.y;
    const dist = Phaser.Math.Distance.Between(sx, sy, x, y);
    if (dist < 4) { this.time.delayedCall(1, () => cb?.()); return; }
    if (Math.abs(x - sx) > 6) this._gpFace(x > sx ? 1 : -1);
    const steps = Math.max(2, Math.round(dist / 64));
    const drv = { p: 0 };
    this.tweens.add({
      targets: drv, p: 1, duration: 260 + dist * 0.9, ease: 'Sine.easeInOut',
      onUpdate: () => {
        const p = drv.p;
        pet.x = sx + (x - sx) * p;
        pet.y = sy + (y - sy) * p - Math.abs(Math.sin(p * Math.PI * steps)) * 12;
        pet.angle = Math.sin(p * Math.PI * steps) * 4;
      },
      onComplete: () => { pet.x = x; pet.y = y; pet.angle = 0; cb?.(); }
    });
  }

  // Move the pet inside `host` (an object's node, or a part of one like the
  // orange bike) keeping it where it is on screen. From here on the pet's x/y
  // are in the host's own coordinates, the same ones its art is drawn in.
  _gpEnter(host) {
    const pet = this._roomPet;
    const local = host.getWorldTransformMatrix().applyInverse(pet.x, pet.y);
    host.add(pet);
    pet.setPosition(local.x, local.y);
    this._gpHost = host;
    // Lift the whole object above its neighbours and their labels meanwhile,
    // remembering its slot so _gpExit can put it back exactly there.
    this._gpHostNode = host.parentContainer || host;
    this._gpHostSlot = this.children.getIndex(this._gpHostNode);
    this._gpHostNode.setDepth(10);
  }

  // Back out into the scene, same spot on screen, off any front piece.
  _gpExit() {
    const pet = this._roomPet;
    const host = this._gpHost;
    if (!host) return;
    const at = this._gpAt(host, pet.x, pet.y);
    host.remove(pet);
    // Container.remove leaves the add-time destroy listener on the pet; drop it
    // so a stale host never tries to un-parent the pet at scene shutdown.
    pet.off(Phaser.GameObjects.Events.DESTROY, host.onChildDestroyed, host);
    pet.setPosition(at.x, at.y);
    pet.angle = 0;
    // setDepth(8) alone would re-sort the node to the END of the depth-8 band
    // (the sort is stable), drawing it over its neighbours' labels from then on.
    this._gpHostNode.setDepth(8);
    this.children.moveTo(this._gpHostNode, this._gpHostSlot);
    this._gpHost = null;
    this._gpHostNode = null;
  }

  // Tuck the hosted pet under a front piece (and show the piece) / bring it
  // back out on top of everything in the host.
  _gpBehind(front) {
    front.setVisible(true);
    this._gpHost.moveBelow(this._roomPet, front);
  }
  _gpInFront() {
    this._gpHost.bringToTop(this._roomPet);
  }

  // Tween to (x, y) in whatever space the pet is in.
  _gpTo(x, y, dur, cb, ease = 'Quad.easeInOut') {
    this.tweens.add({
      targets: this._roomPet, x, y, duration: dur, ease,
      onComplete: () => cb?.()
    });
  }

  // Jump along an arc to (x, y), `h` px above the straight line at its peak.
  // `scale` resizes on the way (how it tucks in to fit a seat); `onMid` runs
  // once, just past the peak (used to drop in behind a front piece).
  _gpJump(x, y, h, dur, cb, { scale = null, onMid = null } = {}) {
    const pet = this._roomPet;
    const sx = pet.x, sy = pet.y, s0 = pet.scaleX;
    let mid = false;
    const drv = { p: 0 };
    this.tweens.add({
      targets: drv, p: 1, duration: dur, ease: 'Linear',
      onUpdate: () => {
        const p = drv.p;
        pet.x = sx + (x - sx) * p;
        pet.y = sy + (y - sy) * p - Math.sin(p * Math.PI) * h;
        if (scale != null) pet.setScale(s0 + (scale - s0) * p);
        if (!mid && p >= 0.6) { mid = true; onMid?.(); }
      },
      onComplete: () => {
        pet.x = x; pet.y = y;
        if (scale != null) pet.setScale(scale);
        if (!mid) onMid?.();
        cb?.();
      }
    });
  }

  // `n` quick hops in place.
  _gpHop(n, h, cb) {
    const pet = this._roomPet;
    const y0 = pet.y;
    this.tweens.add({
      targets: pet, y: y0 - h, duration: 150, yoyo: true, repeat: n - 1,
      ease: 'Sine.easeOut', onComplete: () => { pet.y = y0; cb?.(); }
    });
  }

  // Squash on landing, feet kept planted.
  _gpSquash(cb, amt = 0.16) {
    const pet = this._roomPet;
    const s = pet.scaleY, y0 = pet.y, foot = this._gpFoot(s);
    this.tweens.add({
      targets: pet, scaleX: s * (1 + amt), scaleY: s * (1 - amt), y: y0 + foot * amt,
      duration: 110, yoyo: true, ease: 'Sine.easeOut',
      onComplete: () => { pet.setScale(s); pet.y = y0; cb?.(); }
    });
  }

  // A few quick side-to-side jitters (a shiver, a scrabble, a dig).
  _gpJitter(n, dx, cb, dAngle = 0) {
    const pet = this._roomPet;
    const x0 = pet.x;
    this.tweens.add({
      targets: pet, x: x0 + dx, angle: dAngle, duration: 45, yoyo: true, repeat: n - 1,
      ease: 'Sine.easeInOut', onComplete: () => { pet.x = x0; pet.angle = 0; cb?.(); }
    });
  }

  // Carry a scene-level prop: it follows the pet (hosted or not) every frame
  // at an offset until _gpDrop(). The ticker is a tween, so it dies with the scene.
  _gpHold(obj, ox, oy) {
    this._gpDrop();
    const follow = () => {
      if (!obj.active) return;
      const at = this._gpWorld();
      obj.setPosition(at.x + ox, at.y + oy);
    };
    follow();
    this._gpHeld = this.tweens.addCounter({ from: 0, to: 1, duration: 1000, repeat: -1, onUpdate: follow });
  }
  _gpDrop() {
    this._gpHeld?.stop();
    this._gpHeld = null;
  }

  // Soft puffs at a scene point (dust off a landing, chalk, crumbs).
  _gpPuffs(x, y, color, n = 5, spread = 40, rise = 30) {
    for (let i = 0; i < n; i++) {
      const d = this.add.graphics().setDepth(12);
      d.fillStyle(color, 0.85);
      d.fillCircle(0, 0, 3 + Math.random() * 4);
      d.setPosition(x + (Math.random() - 0.5) * spread, y);
      this.tweens.add({
        targets: d,
        x: d.x + (Math.random() - 0.5) * spread,
        y: y - rise * (0.5 + Math.random()),
        alpha: 0,
        duration: 500 + Math.random() * 300,
        ease: 'Sine.easeOut',
        onComplete: () => d.destroy()
      });
    }
  }

  // ----- Garage pet routines, one per stop -----
  // Positions are in each object's own coordinates (the ones its renderer
  // draws in), worked out from the pet's size via _gpFoot so small eggs and
  // big adults both land on the seat, in the bin, under the bar.

  // Chest freezer (175,580): heave the lid up, climb in, shiver in the cold
  // with frost puffing out, pop back out with an ice pop and eat it.
  gpFreezerDive(done) {
    const node = this._garageNode?.freezer;
    const parts = node?.gParts;
    if (!parts) { done(); return; }
    const pet = this._roomPet;
    const S = 0.78;
    const f = this._gpFoot(S);
    const lift = { x: 40, y: 90 - this._gpFoot(1) };
    const stand = { x: 150, y: 90 - this._gpFoot(1) };
    const inside = { x: 0, y: this._gpPeek(-20, S) };
    const at = this._gpAt(node, lift.x, lift.y);
    this._gpWalkTo(at.x, at.y, () => {
      parts.pause();
      this._gpEnter(node);
      this._gpFace(-1);
      // A big stretch up as the lid swings open and the cold spills out.
      const y0 = pet.y;
      this.tweens.add({ targets: parts.glow, alpha: 1, duration: 360 });
      this.tweens.add({
        targets: parts.lid, y: -30, angle: -11, duration: 460, ease: 'Back.easeOut',
        onComplete: () => this._freezerFrost(node)
      });
      this.tweens.add({
        targets: pet, scaleY: 1.12, y: y0 - this._gpFoot(1) * 0.12,
        duration: 260, yoyo: true, hold: 200, ease: 'Sine.easeOut',
        onComplete: () => {
          pet.setScale(1);
          pet.y = y0;
          this._gpJump(inside.x, inside.y, 110, 520, () => this._gpSquash(shiver),
            { scale: S, onMid: () => this._gpBehind(parts.front) });
        }
      });
    });
    const shiver = () => {
      this._freezerFrost(node);
      this._gpJitter(10, 4, () => {
        this._freezerFrost(node);
        // Up it comes, holding an ice pop.
        const pop = this._gpIcePop();
        pop.setScale(0);
        this._gpHold(pop, this._gpHalfW(1) * 0.85, -f * 0.3);
        this.tweens.add({ targets: pop, scale: 1.3, duration: 220, ease: 'Back.easeOut' });
        this._gpTo(inside.x, inside.y - f * 0.5, 240, () => {
          this._gpInFront();
          parts.front.setVisible(false);
          this._gpJump(stand.x, stand.y, 70, 480, () => {
            this.tweens.add({ targets: parts.lid, y: 0, angle: 0, duration: 420, ease: 'Quad.easeIn' });
            this.tweens.add({ targets: parts.glow, alpha: 0, duration: 380 });
            this._gpExit();
            parts.resume();
            this._gpEat(pop, done);
          }, { scale: 1 });
        }, 'Back.easeOut');
      });
    };
  }

  // Heat lamp (hangs over the freezer): hop up onto the closed freezer lid right
  // under the red lamp and bask in the warm glow, swaying, very content.
  gpBaskUnderLamp(done) {
    const node = this._garageNode?.freezer;
    const parts = node?.gParts;
    if (!parts) { done(); return; }
    const pet = this._roomPet;
    const S = 0.9;
    const stand = { x: 160, y: 90 - this._gpFoot(1) };
    const perch = { x: 6, y: -64 - this._gpFoot(S) };
    const at = this._gpAt(node, stand.x, stand.y);
    this._gpWalkTo(at.x, at.y, () => {
      // The lid goes down and stays down while the pet sits on it.
      parts.pause();
      this.tweens.add({ targets: parts.lid, y: 0, angle: 0, duration: 200 });
      this.tweens.add({ targets: parts.glow, alpha: 0, duration: 200 });
      this._gpEnter(node);
      this._gpFace(-1);
      this._gpJump(perch.x, perch.y, 70, 480, () => this._gpSquash(() => {
        const w = this._gpWorld();
        const warm = this.add.graphics().setDepth(12);
        warm.fillStyle(0xff5a3a, 1);
        warm.fillEllipse(0, 0, 150, 170);
        warm.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
        warm.setPosition(w.x, w.y - 10);
        this.tweens.add({
          targets: warm, alpha: 0.22, duration: 700, yoyo: true, hold: 1400,
          onComplete: () => warm.destroy()
        });
        this.tweens.add({ targets: pet, angle: 5, duration: 700, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
        this.time.delayedCall(1300, () => this._gpEmote('♥'));
        this.time.delayedCall(2900, () => {
          pet.angle = 0;
          this._gpJump(stand.x, stand.y, 60, 480, () => {
            this._gpExit();
            parts.resume();
            done();
          }, { scale: 1 });
        });
      }), { scale: S });
    });
  }

  // Pantry rack (470,580): climb the shelves like a ladder, pull the chip bag
  // off the top shelf, munch (crumbs everywhere), put it back, jump down.
  gpRackSnack(done) {
    const node = this._garageNode?.rack;
    const parts = node?.gParts;
    if (!parts) { done(); return; }
    const pet = this._roomPet;
    const S = 0.78;
    const f = this._gpFoot(S);
    const stand = { x: 60, y: 150 - this._gpFoot(1) };
    // Standing on the bottom, third and second shelves (tops at 100, 20, -60).
    const shelves = [{ x: 30, y: 100 - f }, { x: 0, y: 20 - f }, { x: -34, y: -60 - f }];
    const at = this._gpAt(node, stand.x, stand.y);
    this._gpWalkTo(at.x, at.y, () => {
      this._gpEnter(node);
      this._gpFace(-1);
      climb(0);
    });
    const climb = (i) => {
      this._gpJump(shelves[i].x, shelves[i].y, 34, 300, () => {
        if (i + 1 < shelves.length) this.time.delayedCall(60, () => climb(i + 1));
        else this._gpSquash(grab, 0.1);
      }, i === 0 ? { scale: S } : {});
    };
    const grab = () => {
      // The bag comes off the shelf into its paws, in front of it.
      node.bringToTop(parts.bag);
      this.tweens.add({
        targets: parts.bag, x: pet.x - 16, y: pet.y - f * 0.1, angle: -14,
        duration: 320, ease: 'Back.easeOut',
        onComplete: () => munch(0)
      });
    };
    const munch = (k) => {
      this._gpSquash(() => {
        const b = this._gpAt(node, parts.bag.x, parts.bag.y - 22);
        this._gpPuffs(b.x, b.y, 0xfbd087, 4, 30, -34);
        this.tweens.add({ targets: parts.bag, angle: k % 2 ? -8 : -20, duration: 90, yoyo: true });
        if (k < 2) this.time.delayedCall(160, () => munch(k + 1));
        else this.time.delayedCall(220, putBack);
      }, 0.12);
    };
    const putBack = () => {
      this.tweens.add({
        targets: parts.bag, x: parts.home.x, y: parts.home.y, angle: 0,
        duration: 300, ease: 'Quad.easeInOut',
        onComplete: () => this._gpJump(stand.x, stand.y, 50, 520,
          () => this._gpSquash(() => { this._gpExit(); done(); }), { scale: 1 })
      });
    };
  }

  // Storage bins (690,600): jump on top, pop the lid off, hop in and dig.
  // Odds and ends fly out and drop back in, then it climbs out and the lid
  // goes back on. (Never unlocks the glasses: only a kid's tap does that.)
  gpBinsRummage(done) {
    const node = this._garageNode?.bins;
    const parts = node?.gParts;
    if (!parts) { done(); return; }
    const pet = this._roomPet;
    const S = 0.72;
    const f = this._gpFoot(S);
    const stand = { x: 160, y: 100 - this._gpFoot(1) };
    const onLid = { x: 30, y: -98 - f };
    const inBin = { x: 0, y: this._gpPeek(-90, S) };
    const at = this._gpAt(node, stand.x, stand.y);
    this._gpWalkTo(at.x, at.y, () => {
      this._gpEnter(node);
      this._gpFace(-1);
      this._gpJump(onLid.x, onLid.y, 60, 460, () => this._gpSquash(() => {
        // Pop! The lid flips off and leans against the side of the bins.
        this.tweens.add({ targets: parts.lid, x: -122, y: 6, angle: -78, duration: 420, ease: 'Quad.easeOut' });
        this._gpHop(1, 22, () => this._gpJump(inBin.x, inBin.y, 50, 380,
          () => this._gpSquash(() => dig(0)), { onMid: () => this._gpBehind(parts.front) }));
      }), { scale: S });
    });
    const junk = [
      g => { g.fillStyle(0xd13b3b, 1); g.fillCircle(0, 0, 12); g.fillStyle(0xffffff, 0.5); g.fillCircle(-4, -4, 4); },
      g => { g.fillStyle(0x4a7ad6, 1); g.fillRoundedRect(-11, -11, 22, 22, 4); },
      g => { g.fillStyle(0x4ecdc4, 1); g.fillRoundedRect(-7, -18, 14, 26, 5); g.fillRoundedRect(-7, 2, 22, 12, 5); }
    ];
    const dig = (k) => {
      this.tweens.add({ targets: node, angle: k % 2 ? 2.5 : -2.5, duration: 140, yoyo: true });
      this.tweens.add({
        targets: pet, y: inBin.y + 14, duration: 140, yoyo: true, ease: 'Sine.easeInOut',
        onYoyo: () => { if (junk[k]) this._binToss(node, parts, junk[k]); },
        onComplete: () => {
          pet.y = inBin.y;
          if (k < 3) dig(k + 1);
          else this.time.delayedCall(520, out);
        }
      });
    };
    // Climb up until its feet clear the rim (still behind the bin's front),
    // then come out on top and jump down.
    const out = () => this._gpTo(inBin.x, -90 - f - 2, 240, () => {
      this._gpInFront();
      parts.front.setVisible(false);
      this._gpJump(stand.x, stand.y, 80, 520, () => {
        this.tweens.add({
          targets: parts.lid, x: parts.home.x, y: parts.home.y, angle: 0,
          duration: 360, ease: 'Back.easeOut'
        });
        this._gpExit();
        done();
      }, { scale: 1 });
    }, 'Back.easeOut');
  }

  // One odd thing flung up out of the bin and back in (from behind the front).
  _binToss(node, parts, draw) {
    const g = this.add.graphics();
    draw(g);
    const x0 = (Math.random() - 0.5) * 70;
    const dx = (Math.random() - 0.5) * 90;
    g.setPosition(x0, -70);
    node.addAt(g, node.getIndex(parts.front));
    const drv = { p: 0 };
    this.tweens.add({
      targets: drv, p: 1, duration: 700, ease: 'Linear',
      onUpdate: () => {
        g.x = x0 + dx * drv.p;
        g.y = -70 - Math.sin(drv.p * Math.PI) * 110;
        g.angle = drv.p * 300;
      },
      onComplete: () => g.destroy()
    });
  }

  // Squat rack (940,600): step under the bar, take it on the shoulders, three
  // slow squats, rack it with a puff of chalk, step out.
  gpSquats(done) {
    const node = this._garageNode?.squat;
    const parts = node?.gParts;
    if (!parts) { done(); return; }
    const pet = this._roomPet;
    const S = 0.82;
    const f = this._gpFoot(S);
    const stand = { x: 0, y: 136 - this._gpFoot(1) };
    const under = { x: 0, y: 110 - f };                   // feet on the base plate
    // The bar's line sits 19px above the bar piece's origin; rest it just
    // under the top of the pet's head.
    const barOn = (110 - 2 * f) + 26;
    const dip = 0.4 * f;                                  // head drop at the bottom
    const at = this._gpAt(node, stand.x, stand.y);
    this._gpWalkTo(at.x, at.y, () => {
      parts.pause();
      this._gpEnter(node);
      this._gpBehind(parts.bar);
      this._gpJump(under.x, under.y, 24, 300, () => {
        this.tweens.add({
          targets: parts.bar, y: barOn, duration: 320, ease: 'Sine.easeInOut',
          onComplete: () => rep(0)
        });
      }, { scale: S });
    });
    const rep = (k) => {
      this.tweens.add({ targets: parts.bar, y: barOn + dip, duration: 460, yoyo: true, ease: 'Sine.easeInOut' });
      this.tweens.add({
        targets: pet, scaleY: S * 0.8, scaleX: S * 1.06, y: under.y + f * 0.2,
        duration: 460, yoyo: true, ease: 'Sine.easeInOut',
        onComplete: () => {
          pet.setScale(S);
          pet.y = under.y;
          if (k < 2) rep(k + 1);
          else rack();
        }
      });
    };
    const rack = () => {
      this.tweens.add({
        targets: parts.bar, y: 0, duration: 300, ease: 'Sine.easeOut',
        onComplete: () => {
          for (const hx of [-50, 50]) {
            const c = this._gpAt(node, hx, -22);
            this._gpPuffs(c.x, c.y, 0xffffff, 4, 24, 26);
          }
          this._gpHop(2, 12, () => this._gpJump(stand.x, stand.y, 30, 320, () => {
            this._gpExit();
            parts.resume();
            done();
          }, { scale: 1 }));
        }
      });
    };
  }

  // Laptop (215,950): sit at the keyboard and type. Each tap types a line of
  // "code" onto the screen; when the screen is full it flashes, the code clears
  // and a little rocket launches up the screen. Game built.
  gpLaptopType(done) {
    const node = this._garageNode?.laptop;
    const parts = node?.gParts;
    if (!parts) { done(); return; }
    const pet = this._roomPet;
    // Left of the laptop, but never off the left edge of the screen (x 215).
    const seat = { x: Math.max(-150, this._gpHalfW(1) - 205), y: 80 - this._gpFoot(1) };
    const colors = [0x7ee787, 0x79c0ff, 0xffa657, 0xd2a8ff];
    const LINES = 8;
    const at = this._gpAt(node, seat.x, seat.y);
    this._gpWalkTo(at.x, at.y, () => {
      this._gpEnter(node);
      this._gpFace(1);
      parts.code.clear();
      parts.code.setAlpha(1);
      this.tweens.add({ targets: pet, angle: 8, duration: 160, onComplete: () => tap(0, pet.y) });
    });
    const tap = (line, y0) => {
      this.tweens.add({
        targets: pet, y: y0 + 6, duration: 80, yoyo: true, ease: 'Sine.easeOut',
        onComplete: () => {
          // One indented line per tap, top to bottom, on the part of the screen
          // the pet isn't covering (screen is -90..90 x -78..44).
          const indent = [0, 12, 24, 12, 0, 12, 24, 0][line];
          const w = 28 + Math.random() * (100 - indent);
          parts.code.fillStyle(colors[line % colors.length], 0.9);
          parts.code.fillRoundedRect(-50 + indent, -68 + line * 13, w, 6, 3);
          if (line + 1 < LINES) this.time.delayedCall(90, () => tap(line + 1, y0));
          else this.time.delayedCall(220, () => this._laptopLaunch(node, parts, () => {
            pet.angle = 0;
            this._gpHop(2, 12, () => { this._gpExit(); done(); });
          }));
        }
      });
    };
  }

  // The finished game: the screen flashes, the code clears and a little rocket
  // flies up the screen.
  _laptopLaunch(node, parts, cb) {
    const flash = this.add.graphics();
    flash.fillStyle(0xffffff, 1);
    flash.fillRoundedRect(-90, -78, 180, 122, 3);
    flash.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    node.add(flash);
    this.tweens.add({ targets: flash, alpha: 0.7, duration: 120, yoyo: true, onComplete: () => flash.destroy() });
    this.tweens.add({ targets: parts.code, alpha: 0, duration: 200, delay: 120, onComplete: () => parts.code.clear() });
    const rocket = this.add.container(30, 40);
    const rg = this.add.graphics();
    drawPrintedToy(rg);
    rocket.add(rg);
    rocket.setScale(0.9).setAlpha(0);
    node.add(rocket);
    this.tweens.add({ targets: rocket, alpha: 1, duration: 120, delay: 200 });
    this.tweens.add({
      targets: rocket, y: -38, duration: 900, delay: 200, ease: 'Quad.easeIn',
      onComplete: () => this.tweens.add({
        targets: rocket, alpha: 0, duration: 200,
        onComplete: () => { rocket.destroy(); cb?.(); }
      })
    });
  }

  // 3D printer (470,950): hop up on top of the printer and watch a print from
  // above, head following the nozzle back and forth. When the rocket finishes
  // it cheers, hops down and catches the rocket as it pops off the bed.
  gpWatchPrint(done) {
    const node = this._garageNode?.printer;
    const parts = node?.gParts;
    if (!parts) { done(); return; }
    const pet = this._roomPet;
    const S = 0.8;
    const stand = { x: -140, y: 95 - this._gpFoot(1) };
    const perch = { x: 4, y: -84 - this._gpFoot(S) };
    const PRINT = 3400;
    const at = this._gpAt(node, stand.x, stand.y);
    this._gpWalkTo(at.x, at.y, () => {
      this._gpEnter(node);
      this._gpFace(1);
      this._gpJump(perch.x, perch.y, 70, 480, () => this._gpSquash(watch), { scale: S });
    });
    const watch = () => {
      const follow = this.tweens.addCounter({
        from: 0, to: 1, duration: PRINT,
        onUpdate: (tw) => {
          const hx = parts.head.x;                    // -44..44 along the gantry
          if (Math.abs(hx) > 30) this._gpFace(hx > 0 ? 1 : -1);
          pet.x = perch.x + hx * 0.25;
          pet.angle = (hx / 44) * 8;
          pet.y = perch.y + tw.getValue() * 6;        // leaning in as it grows
        }
      });
      parts.printFor(PRINT, () => {
        follow.stop();
        pet.angle = 0;
        this._gpHop(2, 14, () => {
          this._gpFace(-1);
          this._gpJump(stand.x + 30, stand.y, 60, 460, () => {
            this._gpFace(1);                          // turn back to the printer
            this._gpSquash();
            this._gpCatchRocket(node, parts, done);
          }, { scale: 1 });
        });
      });
    };
  }

  // The finished rocket pops off the bed into the pet's paws; it holds it up
  // and hops, then the printer goes back to printing on its own.
  _gpCatchRocket(node, parts, done) {
    const from = this._gpAt(node, 0, 24);
    parts.toy.alpha = 0;
    const rocket = this.add.container(from.x, from.y).setDepth(12);
    const rg = this.add.graphics();
    drawPrintedToy(rg);
    rocket.add(rg);
    const to = this._gpWorld();
    const foot = this._gpFoot();
    const ox = 8, oy = -foot + 14;                    // held up over its head
    const drv = { p: 0 };
    this.tweens.add({
      targets: drv, p: 1, duration: 440, ease: 'Linear',
      onUpdate: () => {
        const p = drv.p;
        rocket.x = from.x + (to.x + ox - from.x) * p;
        rocket.y = from.y + (to.y + oy - from.y) * p - Math.sin(p * Math.PI) * 80;
        rocket.angle = -360 * p;
      },
      onComplete: () => {
        rocket.angle = 0;
        this._gpHold(rocket, ox, oy);
        this._gpHop(3, 14, () => {
          this._gpDrop();
          this.tweens.add({
            targets: rocket, alpha: 0, y: rocket.y - 20, duration: 260,
            onComplete: () => rocket.destroy()
          });
          parts.resume();
          this._gpExit();
          done();
        });
      }
    });
  }

  // Stroller (760,950): try to climb into the toddler seat. The first go bonks
  // off the seat front, the second gets its paws over the bumper bar and slips
  // back, the third makes it: it sits up behind the bar looking out the open
  // front, and the stroller takes it for a little roll forward and back. Then
  // it hops out.
  gpStrollerClimb(done) {
    const node = this._garageNode?.stroller;
    const parts = node?.gParts;
    if (!parts) { done(); return; }
    const pet = this._roomPet;
    const R = STROLLER;
    const S0 = 0.8, S = 0.6;
    const stand = { x: 180, y: 120 - this._gpFoot(1) };
    const low = { x: 140, y: 120 - this._gpFoot(S0) };
    const bonk = { x: R.seatFrontX + 8 + this._gpHalfW(S0) * 0.7, y: -4 - this._gpFoot(S0) * 0.2 };
    const rim = { x: R.seatFrontX + this._gpHalfW(S0) * 0.5, y: R.barY - this._gpFoot(S0) * 0.55 };
    // On the cushion; a small pet sits up higher so its eyes still clear the bar.
    const seat = { x: -48, y: Math.min(R.seatY - this._gpFoot(S), this._gpPeek(R.barY, S)) };
    const slide = (cb) => this.tweens.add({
      targets: pet, x: low.x, y: low.y, angle: 10, duration: 380, ease: 'Quad.easeIn',
      onComplete: () => { pet.angle = 0; this._gpSquash(() => this._gpJitter(2, 5, cb, -8)); }
    });
    // Hold still while it climbs; the idle push comes back once it's out.
    parts.pause();
    const at = this._gpAt(node, stand.x, stand.y);
    this._gpWalkTo(at.x, at.y, () => {
      this._gpEnter(node);
      this._gpFace(-1);
      this._gpJump(bonk.x, bonk.y, 40, 380, () => slide(() => {
        this._gpJump(rim.x, rim.y, 80, 440, () => this._gpJitter(6, 4, () => slide(() => {
          this._gpJump(seat.x, seat.y, 130, 560, () => this._gpSquash(() => {
            // Face out the open front, away from the canopy.
            this._gpFace(1);
            ride();
          }), { scale: S, onMid: () => this._gpBehind(parts.front) });
        }), 6));
      }), { scale: S0 });
    });
    // Lean back as it sets off, forward as it stops.
    const lean = (a) => this.tweens.add({
      targets: pet, angle: a, duration: 300, yoyo: true, ease: 'Sine.easeOut'
    });
    const ride = () => this._gpHop(2, 10, () => {
      this._gpEmote('♥');
      lean(-7);
      parts.roll(28, 900, () => this.time.delayedCall(200, () => {
        lean(7);
        parts.roll(-16, 1100, () => parts.roll(0, 700, () => this.time.delayedCall(250, () => {
          this._gpInFront();
          parts.front.setVisible(false);
          this._gpJump(stand.x, stand.y, 90, 520, () => {
            this._gpExit();
            parts.resume();
            done();
          }, { scale: 1 });
        })));
      }));
    });
  }

  // Kids' bikes (250,1280): climb onto the orange bike, wobble forward like a
  // first ride without training wheels, roll back steady, cheer, hop off.
  gpBikeRide(done) {
    const node = this._garageNode?.bikes;
    const parts = node?.gParts;
    if (!parts) { done(); return; }
    const pet = this._roomPet;
    const bike = parts.bike;
    const S = 0.58;
    const f = this._gpFoot(S);
    const standN = { x: -70, y: 100 - this._gpFoot(1) };   // node space, floor in front
    const seat = { x: 0, y: -54 - f * 0.86 };                // bike space, astride the seat
    const at = this._gpAt(node, standN.x, standN.y);
    this._gpWalkTo(at.x, at.y, () => {
      this._gpEnter(bike);
      this._gpFace(1);
      this._gpJump(seat.x, seat.y, 60, 460, () => this._gpSquash(ride), { scale: S });
    });
    // Roll the bike to (toX, toY) in node space, wheels turning to match,
    // wobbling by up to `wobble` degrees while the pet leans against it.
    const home = { x: bike.x, y: bike.y };
    const roll = (toX, toY, dur, wobble, cb) => {
      const x0 = bike.x, y0 = bike.y;
      const drv = { p: 0 };
      this.tweens.add({
        targets: drv, p: 1, duration: dur, ease: 'Sine.easeInOut',
        onUpdate: () => {
          const p = drv.p;
          bike.x = x0 + (toX - x0) * p;
          bike.y = y0 + (toY - y0) * p;
          const turn = Phaser.Math.RadToDeg((bike.x - home.x) / 22);   // wheel radius 22
          parts.wheels.forEach(w => { w.angle = turn; });
          const wob = Math.sin(p * Math.PI * 5) * wobble * Math.sin(p * Math.PI);
          bike.angle = wob;
          pet.angle = -wob * 1.6;
        },
        onComplete: () => { bike.angle = 0; pet.angle = 0; cb?.(); }
      });
    };
    // Out onto the open floor in front of the row (so it passes in front of the
    // pink bike, not through it), then back into its spot.
    const ride = () => roll(home.x + 70, home.y + 36, 1300, 5, () => this.time.delayedCall(220, () => {
      roll(home.x, home.y, 900, 0, () => this._gpHop(2, 10, () => {
        this._gpEmote('♥');
        this._gpJump(standN.x, standN.y - bike.y, 60, 460, () => { this._gpExit(); done(); }, { scale: 1 });
      }));
    }));
  }

  // Ebike (760,1280): hop up into the orange kid seat on the back rack, wiggle
  // in behind the harness bar, flash the headlight twice, bounce, hop down.
  gpEbikeSeat(done) {
    const node = this._garageNode?.ebike;
    const parts = node?.gParts;
    if (!parts) { done(); return; }
    const pet = this._roomPet;
    const S = 0.62;
    const stand = { x: -215, y: 100 - this._gpFoot(1) };
    const seat = { x: -104, y: -38 - this._gpFoot(S) };     // bottom tucked into the cushion
    const at = this._gpAt(node, stand.x, stand.y);
    this._gpWalkTo(at.x, at.y, () => {
      this._gpEnter(node);
      this._gpFace(1);
      this._gpJump(seat.x, seat.y, 70, 480, () => this._gpSquash(() => {
        this.tweens.add({
          targets: pet, angle: { from: -6, to: 6 }, duration: 120, yoyo: true, repeat: 1,
          onComplete: () => {
            pet.angle = 0;
            this._ebikeFlash(node, () => this._gpHop(3, 8, () => this.time.delayedCall(450, () => {
              this._gpInFront();
              parts.front.setVisible(false);
              this._gpJump(stand.x, stand.y, 60, 480, () => { this._gpExit(); done(); }, { scale: 1 });
            })));
          }
        });
      }), { scale: S, onMid: () => this._gpBehind(parts.front) });
    });
  }

  // Two bright flashes of the ebike headlight (108,-10): a cone up the road.
  _ebikeFlash(node, cb) {
    const beam = this.add.graphics();
    beam.fillStyle(0xfff3a0, 0.5);
    beam.fillTriangle(112, -10, 260, -58, 260, 38);
    beam.fillStyle(0xffffff, 0.95);
    beam.fillCircle(108, -10, 9);
    beam.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    node.add(beam);
    this.tweens.add({
      targets: beam, alpha: 1, duration: 110, hold: 80, yoyo: true, repeat: 1,
      onComplete: () => { beam.destroy(); cb?.(); }
    });
  }

  // Running shoes (540,1560): hop into Dad's near racer and drive it like a go
  // kart. It revs on the rack with little puffs out of the heel, drops to the
  // floor in a wheelie, scoots out along the floor past the rack's end, skids
  // round, comes back along a far lane above the rack (a touch smaller, further
  // off), skids round again, runs back along the far lane and swings down into
  // its own spot with a skid-stop. Its partner stays on the rack.
  gpShoeZoom(done) {
    const node = this._garageNode?.shoes;
    const parts = node?.gParts;
    if (!parts) { done(); return; }
    const pet = this._roomPet;
    const shoe = parts.shoe;
    const L = parts.len;
    const home = parts.home;
    // 0.5, not smaller: the shoe is only about 40 pt long on a phone, and a
    // smaller pet peeking from the collar was a few px of face.
    const S = 0.5;
    // Node space: the floor in front of Dad's pair, clear of the label's end.
    const standN = { x: home.x + 40, y: 150 - this._gpFoot(1) };
    // Shoe space: sitting down in the collar with its feet on the insole, so
    // the head and shoulders ride above the rim (about 0.3 x len up). A small
    // pet sits up higher so its eyes still clear the rim.
    const inShoe = { x: -0.24 * L, y: Math.min(-3 - this._gpFoot(S), this._gpPeek(-0.3 * L, S)) };
    // The lap, in node space: the near lane is the open floor under Dad's end
    // of the rack, right of the label; the far lane runs above the rack, under
    // the bikes' and the ebike's labels. It never runs back along the rack's
    // front, where the pet's head would cross the kids' pairs. The ends sit
    // clear of the room's edges with the skid's drift and the pet's width included.
    const nearY = 96, farY = -30, FAR = 0.9;
    const ends = { right: 360, left: -380 };
    const at = this._gpAt(node, standN.x, standN.y);
    this._gpWalkTo(at.x, at.y, () => {
      this._gpEnter(shoe);
      this._gpFace(1);
      this._gpJump(inShoe.x, inShoe.y, 60, 440, () => this._gpSquash(rev),
        { scale: S, onMid: () => this._gpBehind(parts.body) });
    });

    // The kart: where it is, which way the toe points (face runs -1..1 through
    // a skid's flip), its size, how far it leans nose-up and how far it has
    // gone (for the scoot bump). place() puts the shoe there.
    const k = { x: home.x, y: home.y, face: 1, sz: 1, lean: 0, tilt: 0, odo: 0, bump: 0 };
    const place = () => {
      const dir = k.face < 0 ? -1 : 1;
      // Nose-up is a turn toward the toe's side; lift by the dip of the low end
      // so a wheelie pivots on the heel instead of sinking it into the floor.
      const a = -dir * k.lean + k.tilt;
      shoe.angle = a;
      shoe.x = k.x;
      shoe.y = k.y - Math.abs(Math.sin(Phaser.Math.DegToRad(a))) * 0.5 * L * k.sz
        - Math.abs(Math.sin(k.odo * 0.07)) * k.bump * k.sz;
      shoe.scaleX = k.face * k.sz;
      shoe.scaleY = k.sz;
      // The rider rocks back as it speeds up and forward as it brakes, and
      // keeps most of its width through a skid's flip so its face never thins
      // to a sliver.
      pet.angle = -k.lean * 0.5;
      pet.scaleX = S * Math.max(1, 0.6 / Math.max(Math.abs(k.face), 0.02));
    };
    const moveTo = (x, y) => {
      k.odo += Math.hypot(x - k.x, y - k.y);
      k.x = x; k.y = y;
    };
    // Dust off the heel, whichever way it faces, while it's rolling.
    const heel = (dy = -2) => this._gpAt(shoe, -0.5 * L, dy);
    let lastOdo = 0;
    const dust = () => this.time.addEvent({
      delay: 70, loop: true,
      callback: () => {
        if (k.odo - lastOdo < 3) return;
        lastOdo = k.odo;
        const h = heel();
        this._gpPuffs(h.x, h.y, 0xbdb6c4, 2, 12, 14);
      }
    });
    let dustTimer = null;

    // Straight along a lane: speed up then brake, leaning into both.
    const drive = (toX, toY, dur, lean, cb) => {
      const x0 = k.x, y0 = k.y, l0 = k.lean;
      const drv = { p: 0 };
      this.tweens.add({
        targets: drv, p: 1, duration: dur, ease: 'Sine.easeInOut',
        onUpdate: () => {
          const p = drv.p;
          moveTo(x0 + (toX - x0) * p, y0 + (toY - y0) * p);
          k.lean = l0 * (1 - p) * (1 - p) + lean * Math.sin(p * Math.PI * 2);
          place();
        },
        onComplete: () => { moveTo(toX, toY); k.lean = 0; place(); cb?.(); }
      });
    };
    // Skid round at a lane's end: the back slides out past the end, the toe
    // swings round (a quick flip), it tips as it goes and throws up dust, and
    // it comes out on the other lane at that lane's size.
    const skid = (toY, toSz, cb) => {
      const x0 = k.x, y0 = k.y, s0 = k.sz, dir = k.face < 0 ? -1 : 1;
      const drv = { p: 0 };
      let burst = false;
      this.tweens.add({
        targets: drv, p: 1, duration: 520, ease: 'Linear',
        onUpdate: () => {
          const p = drv.p;
          const e = Phaser.Math.Easing.Sine.InOut(p);
          moveTo(x0 + dir * 26 * Math.sin(p * Math.PI), y0 + (toY - y0) * e);
          k.sz = s0 + (toSz - s0) * e;
          k.face = dir * Math.cos(Math.PI * Phaser.Math.Clamp((p - 0.3) / 0.25, 0, 1));
          k.lean = -5 * Math.sin(p * Math.PI * 2);
          k.tilt = dir * 7 * Math.sin(p * Math.PI);
          if (!burst && p >= 0.3) {
            burst = true;
            const h = heel();
            this._gpPuffs(h.x, h.y, 0xbdb6c4, 7, 60, 26);
          }
          place();
        },
        onComplete: () => {
          k.x = x0; k.y = toY; k.sz = toSz; k.face = -dir; k.lean = 0; k.tilt = 0;
          place();
          cb?.();
        }
      });
    };

    // REV: a shake on the rack with a few puffs out of the heel, the rider bouncing.
    const rev = () => {
      const py = pet.y;
      const drv = { p: 0 };
      [0, 170, 340].forEach(ms => this.time.delayedCall(ms, () => {
        const h = heel(-0.08 * L);
        this._gpPuffs(h.x - 6, h.y, 0x9a94a6, 2, 8, 18);
      }));
      this.tweens.add({
        targets: drv, p: 1, duration: 500, ease: 'Linear',
        onUpdate: () => {
          const shake = Math.sin(drv.p * Math.PI * 12);
          shoe.x = home.x + shake * 2;
          shoe.angle = shake * 2;
          pet.y = py - Math.abs(Math.sin(drv.p * Math.PI * 3)) * 6;
        },
        onComplete: () => { pet.y = py; place(); launch(); }
      });
    };
    // LAUNCH: off the front of the rack onto the floor, landing in a wheelie.
    const launch = () => {
      const x0 = k.x, y0 = k.y, x1 = home.x + 24;
      const drv = { p: 0 };
      this.tweens.add({
        targets: drv, p: 1, duration: 300, ease: 'Linear',
        onUpdate: () => {
          const p = drv.p;
          k.x = x0 + (x1 - x0) * p;
          k.y = y0 + (nearY - y0) * p - Math.sin(p * Math.PI) * 20;
          k.lean = 8 * p;
          place();
        },
        onComplete: () => {
          k.x = x1; k.y = nearY;
          const h = heel();
          this._gpPuffs(h.x, h.y, 0xbdb6c4, 4, 30, 18);
          k.bump = 2.5;
          dustTimer = dust();
          lap();
        }
      });
    };
    // LAP: out, skid, back along the far lane, skid, then home.
    const lap = () => drive(ends.right, nearY, 520, 5, () =>
      skid(farY, FAR, () => drive(ends.left, farY, 1100, 6, () =>
        skid(farY, FAR, homeRun))));
    // HOME: back along the far lane, then swing down into its own spot on the
    // rack, braking nose-down. The drop starts past the kids' pairs, so it
    // never sits over them.
    const homeRun = () => {
      const x0 = k.x, y0 = k.y;
      const drv = { p: 0 };
      this.tweens.add({
        targets: drv, p: 1, duration: 1350, ease: 'Linear',
        onUpdate: () => {
          const p = drv.p;
          const e = Phaser.Math.Easing.Sine.InOut(p);
          const w = Phaser.Math.Easing.Sine.InOut(Phaser.Math.Clamp((e - 0.84) / 0.16, 0, 1));
          moveTo(x0 + (home.x - x0) * e, y0 + (home.y - y0) * w);
          k.sz = FAR + (1 - FAR) * w;
          k.lean = 6 * Math.sin(p * Math.PI * 2);
          place();
        },
        onComplete: () => { moveTo(home.x, home.y); k.sz = 1; k.lean = 0; place(); park(); }
      });
    };
    // PARK: a skid-stop (the heel kicks out, a puff of dust), a settle bounce,
    // then the rider hops out onto the floor.
    const park = () => {
      dustTimer?.remove(false);
      k.bump = 0;
      const h = heel();
      this._gpPuffs(h.x, h.y, 0xbdb6c4, 5, 40, 20);
      const drv = { p: 0 };
      this.tweens.add({
        targets: drv, p: 1, duration: 260, ease: 'Linear',
        onUpdate: () => {
          const q = Math.sin(drv.p * Math.PI);
          k.tilt = -4 * q * (1 - drv.p);
          place();
          // Settle: a squash into the shelf, feet kept planted.
          shoe.scaleY = 1 - 0.08 * q;
          shoe.scaleX = 1 + 0.05 * q;
        },
        onComplete: () => {
          shoe.setPosition(home.x, home.y);
          shoe.setAngle(0);
          shoe.setScale(1);
          pet.angle = 0;
          pet.scaleX = S;
          this._gpEmote('♥');
          this._gpInFront();
          this._gpJump(standN.x - shoe.x, standN.y - shoe.y, 60, 440, () => { this._gpExit(); done(); }, { scale: 1 });
        }
      });
    };
  }

  // A red, white and blue ice pop in three bites (top, middle, bottom) on a
  // stick. Three bands so it reads against any pet's colors.
  _gpIcePop() {
    const pop = this.add.container(0, 0).setDepth(12);
    const stick = this.add.graphics();
    stick.fillStyle(0xd9b382, 1);
    stick.fillRoundedRect(-3, 8, 6, 20, 2);
    pop.add(stick);
    const slices = [
      [-26, 13, { tl: 9, tr: 9, bl: 0, br: 0 }, 0xff4d5e],
      [-13, 13, 0, 0xfff5e6],
      [0, 12, { tl: 0, tr: 0, bl: 4, br: 4 }, 0x4d8bff]
    ];
    pop.bites = slices.map(([y, h, r, color]) => {
      const g = this.add.graphics();
      g.fillStyle(color, 1);
      if (r) g.fillRoundedRect(-11, y, 22, h, r);
      else g.fillRect(-11, y, 22, h);
      g.fillStyle(0xffffff, 0.35);
      g.fillRect(-7, y + 2, 3, h - 4);
      pop.add(g);
      return g;
    });
    return pop;
  }

  // Eat a held treat in chomps, one bite piece per chomp, then a happy hop.
  _gpEat(treat, done) {
    let bite = 0;
    const chomp = () => this._gpSquash(() => {
      treat.bites[bite]?.setVisible(false);
      bite++;
      if (bite < treat.bites.length) { this.time.delayedCall(170, chomp); return; }
      this._gpDrop();
      this.tweens.add({
        targets: treat, alpha: 0, y: treat.y + 20, duration: 300,
        onComplete: () => { treat.destroy(); this._gpHop(2, 12, done); }
      });
    }, 0.12);
    chomp();
  }

  // ----------------------------------------------------------
  // GARAGE IDLE ANIMATIONS — small bits of life on each object.
  // Routed by item id. Each one also hangs the pieces the pet plays with on
  // node.gParts (a lid, the chip bag, a bike, a front piece to hide behind).
  // Front pieces are redraws of an object's near side, hidden until the pet is
  // inside that object, so they never double up the art.
  // ----------------------------------------------------------
  animateGarageItem(id, node) {
    switch (id) {
      case 'freezer':  return this._freezerLidOpen(node);
      case 'rack':     return this._rackChipBag(node);
      case 'bins':     return this._binsLid(node);
      case 'printer':  return this._printerPrinting(node);
      case 'laptop':   return this._laptopGlow(node);
      case 'stroller': return this._strollerRock(node);
      case 'bikes':    return this._bikesOrange(node);
      case 'ebike':    return this._ebikeCharging(node);
      case 'squat':    return this._squatRackReps(node);
      case 'shoes':    return this._shoesDad(node);
    }
  }

  // A hidden copy of part of an object, drawn over the pet while it's inside.
  _garageFront(node, draw) {
    const front = this.add.graphics();
    draw(front);
    front.setVisible(false);
    node.add(front);
    return front;
  }

  // Freezer: the lid cracks open every few seconds, a cold glow spills out and
  // a little frost mist drifts up, then it settles closed again.
  //
  // The loop runs on a generation token so the pet can take the lid: pause()
  // bumps the token and stops the lid (the old loop quietly dies at its next
  // step), resume() starts a fresh loop.
  _freezerLidOpen(node) {
    // Cold interior glow — sits at the rim, hidden under the closed lid.
    const glow = this.add.graphics();
    glow.fillStyle(0xbfe9f5, 1);
    glow.fillRoundedRect(-104, -30, 208, 22, 7);
    glow.fillStyle(0xffffff, 0.7);
    glow.fillRect(-96, -26, 192, 6);
    glow.setAlpha(0);
    node.add(glow);

    // Lid as its own object so it can lift + tilt open.
    const lid = this.add.container(0, 0);
    const lg = this.add.graphics();
    drawFreezerLid(lg);
    lid.add(lg);
    node.add(lid);

    // The front piece repeats the strip of cold glow that spills over the rim
    // (it's only shown while the lid is open), so the glow doesn't shrink when
    // the pet drops in behind it.
    const front = this._garageFront(node, g => {
      drawFreezerBody(g);
      g.fillStyle(0xbfe9f5, 1);
      g.fillRoundedRect(-104, -20, 208, 12, { tl: 0, tr: 0, bl: 7, br: 7 });
    });

    let gen = 0;
    const close = (g) => {
      if (g !== gen || !node.active) return;
      this.tweens.add({ targets: glow, alpha: 0, duration: 380, ease: 'Sine.easeIn' });
      this.tweens.add({
        targets: lid, y: 0, angle: 0, duration: 560, ease: 'Quad.easeIn',
        onComplete: () => this.time.delayedCall(3200 + Math.random() * 2600, () => open(g))
      });
    };
    const open = (g) => {
      if (g !== gen || !node.active) return;
      this.tweens.add({ targets: glow, alpha: 1, duration: 460, ease: 'Sine.easeOut' });
      this.tweens.add({
        targets: lid, y: -24, angle: -9, duration: 640, ease: 'Back.easeOut',
        onComplete: () => { this._freezerFrost(node); this.time.delayedCall(1300, () => close(g)); }
      });
    };
    node.gParts = {
      lid, glow, front,
      pause: () => { gen++; this.tweens.killTweensOf([lid, glow]); },
      resume: () => { const g = ++gen; this.time.delayedCall(2600 + Math.random() * 2400, () => open(g)); }
    };
    // open(0), not open(gen): the arrow would read gen when it FIRES, so a
    // pause() before then couldn't stop this first cycle.
    this.time.delayedCall(1400 + Math.random() * 2200, () => open(0));
  }

  // A few soft frost puffs rising out of the open freezer.
  _freezerFrost(node) {
    if (!node.active) return;
    for (let i = 0; i < 6; i++) {
      const puff = this.add.graphics();
      puff.fillStyle(0xeaf7fb, 0.85);
      puff.fillCircle(0, 0, 3 + Math.random() * 3);
      puff.x = (Math.random() - 0.5) * 130;
      puff.y = -20;
      node.add(puff);
      this.tweens.add({
        targets: puff,
        y: puff.y - 56 - Math.random() * 34,
        x: puff.x + (Math.random() - 0.5) * 44,
        alpha: 0,
        duration: 900 + Math.random() * 500,
        ease: 'Sine.easeOut',
        onComplete: () => puff.destroy()
      });
    }
  }

  // Pantry rack: the chip bag on the top shelf, loose so the pet can take it.
  _rackChipBag(node) {
    const home = { x: -78, y: -165 };
    const bag = this.add.container(home.x, home.y);
    const bg = this.add.graphics();
    drawChipBag(bg);
    bag.add(bg);
    node.add(bag);
    node.gParts = { bag, home };
  }

  // Storage bins: the top lid (loose, so it can be popped off) and the top bin
  // body as a front piece to dig behind.
  _binsLid(node) {
    const home = { x: 0, y: -90 };
    const lid = this.add.container(home.x, home.y);
    const lg = this.add.graphics();
    drawBinLid(lg);
    lid.add(lg);
    node.add(lid);
    node.gParts = { lid, home, front: this._garageFront(node, drawTopBin) };
  }

  // 3D printer: the print head sweeps along the gantry while a little toy
  // slowly prints up off the bed, then ejects and starts over.
  //
  // Same generation token as the freezer: printFor() restarts a quick print
  // for the pet to watch and calls back with the rocket finished on the bed
  // (the idle loop stays parked until resume()).
  _printerPrinting(node) {
    const head = this.add.container(0, -44);
    const hg = this.add.graphics();
    drawPrinterHead(hg);
    head.add(hg);
    node.add(head);
    this.tweens.add({
      targets: head, x: { from: -44, to: 44 },
      duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    // Toy grows up from the build plate (base anchored at the bed, scaleY 0→1).
    const toy = this.add.container(0, 24);
    const tg = this.add.graphics();
    drawPrintedToy(tg);
    toy.add(tg);
    toy.scaleY = 0;
    node.add(toy);
    let gen = 0;
    const grow = (g, dur = 5200, onDone = null) => {
      if (g !== gen || !node.active) return;
      toy.scaleY = 0;
      toy.alpha = 1;
      this.tweens.add({
        targets: toy, scaleY: 1, duration: dur, ease: 'Linear',
        onComplete: () => {
          if (g !== gen) return;
          if (onDone) { onDone(); return; }
          this.time.delayedCall(1400, () => {
            if (g !== gen) return;
            this.tweens.add({
              targets: toy, alpha: 0, duration: 420,
              onComplete: () => this.time.delayedCall(700, () => grow(g))
            });
          });
        }
      });
    };
    node.gParts = {
      head, toy,
      printFor: (ms, onDone) => { const g = ++gen; this.tweens.killTweensOf(toy); grow(g, ms, onDone); },
      resume: () => {
        const g = ++gen;
        this.tweens.killTweensOf(toy);
        toy.scaleY = 0;
        this.time.delayedCall(900, () => grow(g));
      }
    };
    grow(gen);
  }

  // Laptop: the screen breathes a soft glow, Dad's game still running. The
  // empty `code` layer is where the pet types when it sits down.
  _laptopGlow(node) {
    const glow = this.add.graphics();
    glow.fillStyle(0x6fa8ff, 1);
    glow.fillRoundedRect(-90, -78, 180, 122, 3);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    glow.setAlpha(0.12);
    node.add(glow);
    this.tweens.add({
      targets: glow, alpha: { from: 0.10, to: 0.32 },
      duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
    const code = this.add.graphics();
    node.add(code);
    node.gParts = { code };
  }

  // Stroller: a gentle push back and forth, like soothing a baby. The whole
  // node rolls a few px and each wheel (its own piece) turns to match, so the
  // tyres roll on the floor instead of sliding.
  //
  // roll(dx, dur) moves it to `dx` from its spot for the pet's ride; pause()
  // parks the idle push first, resume() starts it again from the spot.
  _strollerRock(node) {
    const homeX = node.x;
    const wheels = [STROLLER.rear, STROLLER.front].map(({ x, y, r }) => {
      const w = this.add.graphics();
      drawStrollerWheel(w, r);
      w.setPosition(x, y);
      node.add(w);
      return { w, r };
    });
    const spin = () => wheels.forEach(({ w, r }) => { w.rotation = (node.x - homeX) / r; });
    const front = this._garageFront(node, drawStrollerSeatFront);
    let idle = null;
    const push = () => {
      idle = this.tweens.addCounter({
        from: 0, to: Math.PI * 2, duration: 3400, repeat: -1,
        onUpdate: t => { node.x = homeX + Math.sin(t.getValue()) * 5; spin(); }
      });
    };
    node.gParts = {
      front,
      pause: () => { idle?.stop(); idle = null; },
      resume: () => { if (!idle && node.active) push(); },
      roll: (dx, dur, cb) => this.tweens.add({
        targets: node, x: homeX + dx, duration: dur, ease: 'Sine.easeInOut',
        onUpdate: spin, onComplete: () => cb?.()
      })
    };
    push();
  }

  // Kids' bikes: the orange middle bike as its own piece so the pet can ride
  // it. Its origin is on the ground between the wheels, and each wheel is its
  // own graphic so it can turn as the bike rolls.
  _bikesOrange(node) {
    const bike = this.add.container(0, 62);
    const wheels = [-32, 32].map(wx => {
      const w = this.add.graphics();
      drawBikeWheel(w, 0, 0, 1);
      w.setPosition(wx, -22);
      bike.add(w);
      return w;
    });
    const frame = this.add.graphics();
    drawBikeFrame(frame, 0, -22, 0xff6b3d, 1);
    bike.add(frame);
    node.add(bike);
    node.gParts = { bike, wheels };
  }

  // Ebike: the battery LEDs sweep up like it's charging + the headlight twinkles.
  _ebikeCharging(node) {
    const leds = [];
    for (let i = 0; i < 4; i++) {
      const d = this.add.graphics();
      d.fillStyle(0x9dff6b, 1);
      d.fillCircle(-70 + i * 14, 19, 3.2);
      d.setAlpha(0.15);
      node.add(d);
      leds.push(d);
    }
    let lit = 0;
    this.time.addEvent({
      delay: 430, loop: true,
      callback: () => {
        leds.forEach((d, k) => this.tweens.add({
          targets: d, alpha: k <= lit ? 0.95 : 0.15, duration: 220
        }));
        lit = (lit + 1) % (leds.length + 1);
      }
    });

    const hl = this.add.graphics();
    hl.fillStyle(0xfff3a0, 1);
    hl.fillCircle(108, -10, 10);
    hl.setBlendMode(Phaser.BlendModes.ADD);
    hl.setAlpha(0.18);
    node.add(hl);
    this.tweens.add({
      targets: hl, alpha: { from: 0.16, to: 0.6 },
      duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
    node.gParts = { front: this._garageFront(node, drawEbikeSeatFront) };
  }

  // Squat rack: the loaded barbell does slow, steady reps on the J-hooks.
  // pause()/resume() park it so the pet can take the bar for its own set.
  _squatRackReps(node) {
    const bar = this.add.container(0, 0);
    const bg = this.add.graphics();
    drawSquatBar(bg);
    bar.add(bg);
    node.add(bar);
    const reps = () => this.tweens.add({
      targets: bar, y: { from: 0, to: 16 },
      duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
    reps();
    node.gParts = {
      bar,
      pause: () => this.tweens.killTweensOf(bar),
      resume: () => {
        this.tweens.killTweensOf(bar);
        this.tweens.add({ targets: bar, y: 0, duration: 300, ease: 'Sine.easeOut', onComplete: reps });
      }
    };
  }

  // Shoe rack: Dad's near racer as its own piece so the pet can ride it. Its
  // origin is the ground under the middle of the sole.
  _shoesDad(node) {
    const dad = SHOE_PAIRS.find(p => p.pal === DAD_SHOE);
    const home = { x: dad.x, y: SHOE_SHELF_Y };
    const shoe = this.add.container(home.x, home.y);
    const sg = this.add.graphics();
    drawRacerShoe(sg, 0, 0, dad.len, DAD_SHOE);
    shoe.add(sg);
    node.add(shoe);
    node.gParts = { shoe, body: sg, home, len: dad.len };
  }

  // ============================================================
  // RECESS: the neighbourhood playground hidden inside "Inner Space".
  // A nostalgic real-world running track / playground, rendered
  // straight & cute. Same delightful trick as Dad's Garage.
  // ============================================================
  createPlaygroundExploration() {
    this.drawPlaygroundBackdrop();

    this.add.text(W / 2, 150, 'PLAYGROUND', style('display', {
      fontSize: '72px',
      fill: '#7ed957',
      stroke: '#0a2a12',
      strokeThickness: 6
    })).setOrigin(0.5).setDepth(5);

    // Bubble copy lives inline: short, warm, kid-friendly.
    //
    // Every stop comes from this one table, the field and the running track
    // included, so every label is placed the same way: it hangs just under the
    // stop's ground line (`ground`, in scene y). A drawn stop's node sits
    // `foot` above its ground line (where its renderer puts the posts' feet and
    // the shadow), and the stops in a row share one ground line, so their
    // labels line up. `art` is the box a stop's renderer draws in, in its
    // node's coordinates (posts, roof, shadow), for its tap box. The field and
    // the track are painted into the backdrop: no renderer, `area` is the band
    // of the backdrop they cover (scene y, full width), `bubbleY` where their
    // bubble pops, and `ground` is just the line their label hangs from.
    const R = PG_GROUND;
    const items = [
      { id: 'field',   x: W / 2, ground: 582, area: [470, 632], bubbleY: 551, label: 'Field',
        bubble: 'Catch me if you can!' },
      // labelDx: the slide's ladder stands inside the tower's right edge, so the
      // tower's label sits a little left of center to clear it.
      { id: 'tower',   x: 250,   ground: R.row1, foot: 200, art: [-125, -210, 124, 214], draw: drawPlayStructure, label: 'Play tower',
        labelDx: -20, bubble: 'The floor is lava!' },
      // The slide's art box starts at its ladder: the top platform's lip pokes
      // 8px further left, over the tower's side, and counts as the tower's.
      { id: 'slide',   x: 470,   ground: R.row1, foot: 188, art: [-118, -210, 134, 200], draw: drawWavySlide,     label: 'Big slide',
        labelDx: 10, bubble: 'Cheeeeoooh!' },
      { id: 'bars',    x: 840,   ground: R.row1, foot: 172, art: [-161, -155, 160, 185], draw: drawMonkeyBars,    label: 'Monkey bars',
        bubble: 'Slow is smooth, smooth is fast.' },
      { id: 'wall',    x: 160,   ground: R.row2, foot: 142, art: [-93, -131, 92, 153],   draw: drawClimbingWall,  label: 'Climbing wall',
        bubble: 'Watch your step!' },
      { id: 'zipline', x: 490,   ground: R.row2, foot: 110, art: [-129, -119, 128, 121], draw: drawZipLineFrame,  label: 'Zip line',
        bubble: 'Yeeehawww!' },
      { id: 'tire',    x: 850,   ground: R.row2, foot: 182, art: [-112, -159, 110, 194], draw: drawTireSwingFrame, label: 'Tire swing',
        bubble: 'Hold on tight!!' },
      // Its label sits level with the foot of the Dad's note board.
      { id: 'spinner', x: 230,   ground: R.row3, foot: 95,  art: [-61, -44, 60, 103],    draw: drawSpinnerPost,   label: 'Spinner',
        bubble: 'Dizzy!' },
      // Label in the second lane, so it clears the Dad's note board's posts on
      // the track's edge.
      { id: 'track',   x: W / 2, ground: PG_TRACK_TOP + 42, area: [PG_TRACK_TOP - 14, H], bubbleY: (PG_TRACK_TOP + H) / 2,
        label: 'Running track', ink: ['#f4f8ff', '#173a63'], bubble: 'Super fast!' }
    ];

    // Fresh table every visit: a stale one would hand the pet destroyed nodes
    // from the last time the room was built.
    this._pgItems = {};
    const stops = [];
    for (const item of items) {
      let node = null;
      if (item.draw) {
        node = this.add.container(item.x, item.ground - item.foot).setDepth(8);
        const g = this.add.graphics();
        item.draw(g);
        node.add(g);
        // The moving parts the pet plays with (the tire on its chains, the zip
        // trolley, the spinner's disc, front rails to tuck in behind).
        this._pgRig(item.id, node);
        this.tweens.add({
          targets: node,
          scale: { from: 1, to: 1.03 },
          duration: 1500 + Math.random() * 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }

      const [fill, stroke] = item.ink || ['#ffffff', '#1a3a18'];
      const label = addRoomLabel(this, item.x + (item.labelDx || 0), item.ground + PG_LABEL_DROP, item.label, fill, stroke);

      // The art's box in scene coordinates, at the top of its breathing.
      const art = node
        ? [0, 1, 2, 3].map(i => (i % 2 ? node.y : node.x) + item.art[i] * PG_BREATHE)
        : [0, item.area[0], W, item.area[1]];
      const bubbleY = item.bubbleY ?? node.y;
      const hit = this.add.rectangle(item.x, bubbleY, 1, 1, 0, 0)
        .setInteractive({ useHandCursor: true }).setDepth(9);
      this._pgItems[item.id] = { node, hit, label };
      stops.push({ id: item.id, hit, label, art, pad: node ? PG_HIT_PAD : 0 });

      hit.on('pointerdown', () => {
        audio.playClick?.();
        // The monkey bars are the secret: until they're crossed the first
        // time, the found-it card is their message, not a bubble.
        if (item.id !== 'bars' || progress.isHiddenWorldCleared(18)) {
          this.showBubble(item.x, bubbleY, item.bubble);
        }
        this.petInteract(item.id);
      });
    }

    // Dad's note board on the woodchips, same daily mechanic as the garage
    // whiteboard (its own list + its own once-per-day stardust). Its top clears
    // the "Zip line" label in the row above. Its own tap box already covers
    // the board and posts, so that's its art here; its label is the name
    // lettered on the board.
    const board = this.createNotesBoard(PG_NOTES.x, PG_NOTES.y, { boardKey: 'playground' });
    const boardArt = board.hit.getBounds();
    stops.push({
      id: 'notes', hit: board.hit, label: board.label, pad: 0,
      art: [boardArt.x, boardArt.y, boardArt.right, boardArt.bottom]
    });
    this._pgFitHits(stops);

    // After the stops: the pet's routines use the node table above.
    this.createRecessPet();

    addLeaveButton(this, () => {
      const homeKey = this.world?.chapter === 2
        ? music.resolveTrack(this, 'innerSpaceHome', 'homeTheme')
        : 'homeTheme';
      music.fadeToTrack(this, homeKey);
      this.scene.start('WorldMapScene');
    });
  }

  // Tap boxes, fitted once every stop and label is placed. Each box covers its
  // stop's drawn art (plus a finger's margin) and its own label, then is cut
  // back so it never reaches into another stop's label: its top stops at the
  // row line just under the labels of the row above (where the next row's art
  // ends), and a neighbour's label in its row trims that side. Side-by-side
  // neighbours whose art touches (the slide's ladder leans on the tower) split
  // the strip they share at the front one's art edge: the stop made later is
  // drawn in front, so it keeps what it covers. So a tap on a label, or on the
  // art, lands on that stop and no other.
  _pgFitHits(stops) {
    const boxes = stops.map(s => ({ id: s.id, b: s.label.getBounds() }));
    const fit = stops.map(stop => {
      const own = boxes.find(o => o.id === stop.id).b;
      const [ax, ay, ar, ab] = stop.art;
      let l = Math.min(ax - stop.pad, own.x), r = Math.max(ar + stop.pad, own.right);
      let t = Math.min(ay - stop.pad, own.y), b = Math.max(ab, own.bottom);
      for (const { id, b: o } of boxes) {
        if (id !== stop.id && o.bottom <= own.y) t = Math.max(t, Math.floor(o.bottom) + 1);
      }
      for (const { id, b: o } of boxes) {
        if (id === stop.id || o.bottom <= t || o.y >= b || o.right <= l || o.x >= r) continue;
        if (o.centerX > own.centerX) r = Math.ceil(o.x) - 1;
        else l = Math.floor(o.right) + 1;
      }
      return { stop, l, t, r, b };
    });
    fit.forEach((back, i) => fit.slice(i + 1).forEach(front => {
      const [bl, bt, , bb] = back.stop.art;
      const [fl, ft, fr, fb] = front.stop.art;
      const sideBySide = Math.min(bb, fb) - Math.max(bt, ft) > Math.min(bb - bt, fb - ft) / 2;
      if (!sideBySide || back.r < front.l || front.r < back.l) return;
      if (fl > bl) { back.r = Math.min(back.r, Math.floor(fl) - 1); front.l = Math.max(front.l, Math.floor(fl)); }
      else { back.l = Math.max(back.l, Math.ceil(fr) + 1); front.r = Math.min(front.r, Math.ceil(fr)); }
    }));
    for (const { stop, l, t, r, b } of fit) {
      stop.hit.setPosition((l + r) / 2, (t + b) / 2).setSize(r - l, b - t);
      stop.hit.input?.hitArea?.setSize(r - l, b - t);
    }
  }

  drawPlaygroundBackdrop() {
    // Warm sky tone behind everything.
    this.cameras.main.setBackgroundColor('#bfe6ff');

    const bg = this.add.graphics().setDepth(0);

    // --- SKY GRADIENT (top → mid) ---
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      const r = Math.round(0x9c + (0xdf - 0x9c) * t);
      const gg = Math.round(0xd8 + (0xf2 - 0xd8) * t);
      const b = Math.round(0xf6 + (0xff - 0xf6) * t);
      bg.fillStyle((r << 16) | (gg << 8) | b, 1);
      bg.fillRect(0, i * 28, W, 30);
    }
    // A couple of soft clouds.
    bg.fillStyle(0xffffff, 0.85);
    for (const [cx, cy, s] of [[220, 120, 1], [820, 180, 0.8], [560, 90, 0.6]]) {
      bg.fillEllipse(cx, cy, 130 * s, 46 * s);
      bg.fillEllipse(cx - 50 * s, cy + 8 * s, 80 * s, 36 * s);
      bg.fillEllipse(cx + 55 * s, cy + 10 * s, 90 * s, 38 * s);
    }

    // --- BACKGROUND BAND: school + conifers, all rooted on the turf horizon ---
    // drawConifer's trunk base sits at y + 28*scale; the turf rect (drawn after,
    // starting at y=470) must overlap each trunk foot so no tree floats — so we
    // aim every base a few px BELOW 470. The conifers flank the building (which
    // spans x≈260–860) on either side.
    drawConifer(bg, 70, 448, 1.0);    // trunk base ≈ 476 (into the turf)
    drawConifer(bg, 152, 454, 0.8);   // trunk base ≈ 476
    drawConifer(bg, 940, 451, 0.9);   // trunk base ≈ 476
    drawConifer(bg, 1016, 445, 1.1);  // trunk base ≈ 477
    // Cream Collegiate-Gothic school building with a corner spire tower.
    drawSchoolTowerBack(bg, 560, 300);

    // --- GREEN TURF FIELD with a soccer goal (≈ 470–632) ---
    bg.fillStyle(0x4faa46, 1);
    bg.fillRect(0, 470, W, 162);
    bg.fillStyle(0x57b94e, 0.6);
    bg.fillRect(0, 470, W, 56);
    bg.fillStyle(0x46a03e, 0.5);
    for (let sx = -40; sx < W; sx += 120) bg.fillRect(sx, 470, 56, 162);
    bg.lineStyle(4, 0xffffff, 0.45);
    bg.lineBetween(0, 556, W, 556);
    drawGoalBack(bg, 250, 556);
    // A soccer ball out on the field, in front of the goal.
    bg.fillStyle(0xffffff, 1); bg.fillCircle(392, 590, 11);
    bg.fillStyle(0x14142a, 1); bg.fillCircle(392, 590, 3.4);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 - Math.PI / 2; bg.fillCircle(392 + Math.cos(a) * 6.6, 590 + Math.sin(a) * 6.6, 2.2); }
    bg.lineStyle(1.5, 0x9aa0aa, 0.5); bg.strokeCircle(392, 590, 11);

    // Green chain-link fence between the field and the playground.
    drawFenceStrip(bg, 634, 24);

    // --- TAN WOODCHIP PLAY AREA (down to the running track) ---
    const chipTop = 662;
    const trackTop = H - 178;
    bg.fillStyle(0xc7a06a, 1);
    bg.fillRect(0, chipTop, W, trackTop - chipTop);
    bg.fillStyle(0xd8b67e, 0.5);
    bg.fillRect(0, chipTop, W, 150);
    bg.fillStyle(0x9c7a4c, 0.30);
    bg.fillRect(0, trackTop - 120, W, 120);
    for (let i = 0; i < 240; i++) {
      const cx = Math.random() * W;
      const cy = chipTop + 8 + Math.random() * (trackTop - chipTop - 16);
      const shade = Math.random();
      bg.fillStyle(shade < 0.5 ? 0xb38a52 : (shade < 0.8 ? 0xa97f48 : 0xddc294), 0.7);
      bg.fillRect(cx, cy, 5 + Math.random() * 7, 3);
    }
    // Railway-tie timber edge where the woodchips meet the track.
    bg.fillStyle(0x6e4a28, 1); bg.fillRect(0, trackTop - 14, W, 16);
    bg.fillStyle(0x855c34, 1); bg.fillRect(0, trackTop - 14, W, 5);
    bg.fillStyle(0x4a3018, 0.6);
    for (let px = 0; px < W; px += 150) bg.fillRect(px, trackTop - 14, 4, 16);

    // --- FULL-WIDTH BLUE RUNNING TRACK along the entire bottom ---
    drawRunningTrack(bg, trackTop);
  }

  // Companion pet on the woodchips, at the edge of the running track. It only
  // plays when a kid taps a stop (see petInteract); between taps it idles in
  // place, bobbing and looking around.
  createRecessPet() {
    // Reset first: these fields outlive the scene. A busy flag, a queued tap or
    // a tag game left over from leaving mid-routine would wedge the next visit.
    this._recessPet = null;
    this._recessPetSprite = null;
    this._pgBusy = false;
    this._pgRunning = null;
    this._pgQueued = null;
    this._pgRestTimer = null;
    this._pgIdleTween = null;
    this._pgHomeWalk = null;
    this._pgRestY = null;
    this._pgTag = null;
    this._pgDashY = null;
    // The shared room-pet helpers (_gpWalkTo, _gpFoot, _gpJump, _gpEnter, ...)
    // read the pet from these two fields, and only one room runs at a time, so
    // they point at this room's pet. Their per-visit state resets here too.
    this._roomPet = null;
    this._roomPetSprite = null;
    this._gpHeld = null;
    this._gpHost = null;
    this._gpHostNode = null;
    this._gpFacing = -1;
    if (!companion.hasStarter()) return;

    const pet = this.add.container(PG_HOME.x, 0).setDepth(11);
    this._recessPet = pet;
    this._recessPetSprite = drawCompanion(this, 0, 0, { scale: 1.1 });
    pet.add(this._recessPetSprite);
    this._roomPet = pet;
    this._roomPetSprite = this._recessPetSprite;
    pet.y = PG_HOME.feet - this._gpFoot(1);

    // Tap → chirp + heart. During the field's tag game a tap on the pet is a
    // tag instead. The box grows for the game (see _pgTagHitBox).
    const hit = this.add.rectangle(0, 0, 130, 130, 0, 0)
      .setInteractive({ useHandCursor: true });
    pet.add(hit);
    this._pgPetHit = hit;
    hit.on('pointerdown', () => {
      if (this._pgTag) { this._pgTagged(); return; }
      audio.playPetChirp?.();
      this._gpEmote('♥');
    });

    this._pgRest();
  }

  // Dad's note board. Same daily mechanic as the garage whiteboard: its own
  // note for the day off the shared deck, and +10 stardust the first time
  // that note is opened each day (see openDailyNote).
  //
  // Parameterized because there are two of these (the Recess woodchips board
  // and the Hot Pot table board), differing only in deck, save key and what
  // happens after the note is read. Defaults are the Recess values.
  createNotesBoard(x, y, {
    boardKey = 'playground',
    onTap = null
  } = {}) {
    const { message } = progress.getDailyNoteForBoard(DAD_NOTES, boardKey);

    const node = this.add.container(x, y).setDepth(8);
    const g = this.add.graphics();
    drawDadNotesBoard(g);
    node.add(g);
    this.tweens.add({
      targets: node, scale: { from: 1, to: 1.03 },
      duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    // Header lettered onto the parchment at the label size; the "Tap to read"
    // instruction under it at the body size, like every other hint (the
    // parchment in drawDadNotesBoard is sized to hold them). The board names
    // itself, so it carries no second label on the ground: this lettering is
    // its label (the playground fits tap boxes to labels).
    const label = this.add.text(0, NOTES_BOARD.headerY, "DAD'S NOTE", style('caption', {
      fill: '#2a1f12', fontStyle: '900'
    })).setOrigin(0.5);
    node.add(label);
    const hint = this.add.text(0, NOTES_BOARD.hintY, 'Tap to read', style('body', {
      fill: '#5a4a36', fontStyle: 'italic'
    })).setOrigin(0.5);
    node.add(hint);

    // Board plus posts, from the frame top down to the ground line.
    const hitTop = NOTES_BOARD.top - 6, hitBottom = 128;
    const hit = this.add.rectangle(x, y + (hitTop + hitBottom) / 2, NOTES_BOARD.halfW * 2 + 16, hitBottom - hitTop, 0, 0)
      .setInteractive({ useHandCursor: true }).setDepth(9);
    hit.on('pointerdown', () => this.openDailyNote(boardKey, message, onTap));
    return { node, hit, label };
  }

  // ----- Pet play: the companion actually plays on each stop -----
  // Tap-only, like Dad's Garage: a tap on a stop sends the pet there. A tap
  // while it's busy is queued (the latest wins) and runs as soon as the
  // current routine ends. Each routine takes a `done` callback and hands the
  // pet back on the woodchips at scale 1, out of any object.
  //
  // Routines are built on the shared room-pet helpers (_gp*), in each object's
  // own node coordinates (the ones its renderer draws in), sized from the pet
  // via _gpFoot / _gpPeek so eggs and big adults both land on the rung, in the
  // tire, on the disc. Landings put the pet's feet on a ground line, never on
  // the label hanging under it.
  petInteract(id) {
    if (!this._recessPet?.active) return;
    // The field's routine is one game of tag, from the walk out to the fence
    // until the game ends: another Field tap in that time is the same game.
    // On the way back (_pgFenceBack) it queues a fresh game like any other tap.
    if (id === 'field' && this._pgRunning === 'field') return;
    this._pgQueued = id;
    // Mid tag game: the game winds down so the pet can go. On the way out
    // to the field it skips the game instead (see pgFieldTag).
    if (this._pgTag) { this._pgTagEnd(); return; }
    if (!this._pgBusy) this._pgNext();
  }

  _pgNext() {
    const pet = this._recessPet;
    const id = this._pgQueued;
    if (!pet?.active || this._pgBusy || !id) return;
    this._pgRestTimer?.remove(false);
    this._pgRestTimer = null;
    this._pgIdleTween?.stop();
    this._pgIdleTween = null;
    if (this._pgRestY != null) pet.y = this._pgRestY;
    this._pgRestY = null;
    this._pgHomeWalk?.stop();
    this._pgHomeWalk = null;
    pet.angle = 0;
    this._pgQueued = null;
    this._pgBusy = true;
    this._pgRunning = id;
    // The monkey-bar secret: the first crossing a kid asks for finds it.
    const unlock = id === 'bars' && !progress.isHiddenWorldCleared(18);
    const routine = {
      field:   this.pgFieldTag,
      tower:   this.pgTowerLava,
      slide:   this.pgSlide,
      bars:    this.pgMonkeyBars,
      wall:    this.pgClimbWall,
      zipline: this.pgZipLine,
      tire:    this.pgTireSwing,
      spinner: this.pgSpin,
      track:   this.pgRunTrack
    }[id];
    routine.call(this, () => {
      // The found-it card holds the pet, and any tap queued meanwhile, until
      // it's closed, so the next stop plays in the open room, not under the dim.
      if (unlock) { this.showRecessUnlock(() => this._pgRest()); return; }
      this._pgRest();
    });
  }

  // Between routines. A tap that came in meanwhile runs after a short beat;
  // otherwise the pet walks home to the track's edge and idles there. It isn't
  // busy on the way home, so a tap turns it around right where it is.
  _pgRest() {
    const pet = this._recessPet;
    if (!pet?.active) return;
    if (this._gpHost) this._gpExit();
    this._gpDrop();
    pet.setScale(1);
    pet.angle = 0;
    this._pgBusy = false;
    this._pgRunning = null;
    if (this._pgQueued) {
      this._pgRestTimer = this.time.delayedCall(250, () => this._pgNext());
      return;
    }
    this._pgHomeWalk = this._pgWalk(PG_HOME.x, PG_HOME.feet, () => {
      this._pgHomeWalk = null;
      this._pgIdle();
    });
  }

  // Stand and look around until a kid taps something: a small bob, and now
  // and then a glance back over its shoulder.
  _pgIdle() {
    const pet = this._recessPet;
    if (!pet?.active || this._pgBusy) return;
    const y0 = pet.y;
    this._pgRestY = y0;
    const face0 = this._gpFacing;
    const look = { p: 0 };
    this._pgIdleTween = this.tweens.add({
      targets: look, p: 1, duration: 3200, repeat: -1,
      onUpdate: () => {
        const want = (look.p > 0.45 && look.p < 0.75) ? -face0 : face0;
        if (want !== this._gpFacing) this._gpFace(want);
        pet.y = y0 - (1 - Math.cos(look.p * Math.PI * 4)) * 4;
        pet.angle = Math.sin(look.p * Math.PI * 2) * 3;
      }
    });
  }

  // ----- Playground pet helpers -----

  _pgNode(id) {
    return this._pgItems?.[id]?.node;
  }

  // A scene point in an object's own coordinates (the reverse of _gpAt).
  _pgLocal(host, x, y) {
    return host.getWorldTransformMatrix().applyInverse(x, y);
  }

  // A Graphics piece drawn into `host` (a node or one of its parts).
  _pgPiece(host, draw, visible = true) {
    const g = this.add.graphics();
    draw(g);
    g.setVisible(visible);
    host.add(g);
    return g;
  }

  // Walk the pet to a spot on the woodchips (its feet at `feetY`), hop-stepping
  // along the rows' ground lines and up or down the open gaps between them
  // (PG_WALK_Y / PG_WALK_X) rather than straight across the equipment. One
  // tween for the whole route, so a tap can stop it cleanly. Always calls back
  // on a later frame, like _gpWalkTo. Only used at scale 1, never hosted.
  _pgWalk(x, feetY, cb) {
    const pet = this._recessPet;
    const f = this._gpFoot(1);
    const L = PG_WALK_Y;
    const laneOf = (y) => L.reduce((best, ly, i) =>
      (Math.abs(y - ly) < Math.abs(y - L[best]) ? i : best), 0);
    const x0 = pet.x, y0 = pet.y + f;
    const to = laneOf(feetY);
    // Starting off every lane line: first finish the leg straight up or down
    // where it stands. Just off a stop, that's the nearest lane. In a gap
    // column (partway down it when a tap came, or out at the fence) it's the
    // lane on the target's side of it, so it never cuts across the equipment.
    let lane = laneOf(y0);
    if (Math.abs(y0 - L[lane]) > 2 && PG_WALK_X.some(cx => Math.abs(x0 - cx) < 3)) {
      const below = L.findIndex(ly => ly > y0);
      const above = (below < 0 ? L.length : below) - 1;
      if (above < 0) lane = below;
      else if (below < 0) lane = above;
      else lane = to <= above ? above : below;
    }
    const pts = [[x0, y0], [x0, L[lane]]];
    while (lane !== to) {
      const dir = to > lane ? 1 : -1;
      const colX = PG_WALK_X[dir > 0 ? lane : lane - 1];
      pts.push([colX, L[lane]]);
      lane += dir;
      pts.push([colX, L[lane]]);
    }
    pts.push([x, L[to]], [x, feetY]);
    const segs = [];
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const d = Math.hypot(bx - ax, by - ay);
      if (d < 1) continue;
      segs.push({ ax, ay, bx, by, d, at: len });
      len += d;
    }
    const steps = Math.max(2, Math.round(len / 64));
    const drv = { p: 0 };
    let seg = -1;
    return this.tweens.add({
      targets: drv, p: 1, duration: len < 4 ? 1 : 200 + len * 0.75, ease: 'Sine.easeInOut',
      onUpdate: () => {
        if (!segs.length) return;
        const dist = drv.p * len;
        let k = segs.findIndex(s => dist <= s.at + s.d);
        if (k < 0) k = segs.length - 1;
        const s = segs[k];
        if (k !== seg) {
          seg = k;
          if (Math.abs(s.bx - s.ax) > 6) this._gpFace(s.bx > s.ax ? 1 : -1);
        }
        const q = Math.min(1, (dist - s.at) / s.d);
        const bob = Math.sin(drv.p * Math.PI * steps);
        pet.x = s.ax + (s.bx - s.ax) * q;
        pet.y = s.ay + (s.by - s.ay) * q - f - Math.abs(bob) * 12;
        pet.angle = bob * 4;
      },
      onComplete: () => { pet.x = x; pet.y = feetY - f; pet.angle = 0; cb?.(); }
    });
  }

  // A quick dash in the scene at the pet's current size (on the grass, on the
  // track), little steps, facing the way it goes. `lean` tips it forward.
  _pgDash(x, feetY, dur, cb, { ease = 'Sine.easeInOut', hop = 8, lean = 0, stride = 50 } = {}) {
    const pet = this._recessPet;
    const sx = pet.x, sy = pet.y, ty = feetY - this._gpFoot(pet.scaleY);
    if (Math.abs(x - sx) > 6) this._gpFace(x > sx ? 1 : -1);
    const steps = Math.max(2, Math.round(Math.abs(x - sx) / stride));
    const drv = { p: 0 };
    return this.tweens.add({
      targets: drv, p: 1, duration: dur, ease,
      onUpdate: () => {
        // Where it would stand now without the hop, for a clean stop mid-dash.
        this._pgDashY = sy + (ty - sy) * drv.p;
        pet.x = sx + (x - sx) * drv.p;
        pet.y = this._pgDashY - Math.abs(Math.sin(drv.p * Math.PI * steps)) * hop;
        pet.angle = lean * this._gpFacing;
      },
      onComplete: () => { pet.x = x; pet.y = ty; pet.angle = 0; cb?.(); }
    });
  }

  // A filled four-point sparkle that pops and fades (never rays or a burst).
  _pgSparkle(x, y, color = 0xfff3b8, size = 16) {
    const g = this.add.graphics().setDepth(20);
    g.fillStyle(color, 1);
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 - Math.PI / 2;
      const r = i % 2 ? size * 0.3 : size;
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    g.fillPoints(pts, true);
    g.setPosition(x, y).setScale(0);
    this.tweens.add({
      targets: g, scale: 1, duration: 180, hold: 260, yoyo: true, ease: 'Back.easeOut',
      onComplete: () => g.destroy()
    });
  }

  // A few sparkles around the pet's head, one after another.
  _pgSparkles(n = 3) {
    for (let i = 0; i < n; i++) {
      this.time.delayedCall(i * 140, () => {
        if (!this._recessPet?.active) return;
        const at = this._gpWorld();
        const top = at.y - this._gpFoot();
        this._pgSparkle(at.x + (i - (n - 1) / 2) * 44, top - 10 - (i % 2) * 18);
      });
    }
  }

  // ----- Playground pet routines, one per stop -----

  // Play tower: "The floor is lava!" Up the ladder in the left bay onto the top
  // deck, peek over the railing at the lava below, edge along it, then down
  // deck by deck and a hot-foot dance on the woodchips.
  pgTowerLava(done) {
    const node = this._pgNode('tower');
    const parts = node?.pgParts;
    if (!parts) { done(); return; }
    const pet = this._recessPet;
    const S = 0.62;
    const f = this._gpFoot(S);
    const ladderX = -75;
    const steps = [128, 56, -8];                 // rung tops, below the top deck
    const peekY = this._gpPeek(-108, S);         // eyes just over the railing
    const at = this._gpAt(node, ladderX, 200);
    this._pgWalk(at.x, at.y, () => {
      this._gpEnter(node);
      this._gpFace(1);
      climb(0);
    });
    const climb = (i) => {
      if (i === steps.length) {
        this._gpJump(ladderX + 8, peekY, 30, 300, () => this.time.delayedCall(140, lookDown),
          { onMid: () => this._gpBehind(parts.front) });
        return;
      }
      this._gpJump(ladderX, steps[i] - f, 22, 240, () => this.time.delayedCall(50, () => climb(i + 1)),
        i === 0 ? { scale: S } : {});
    };
    // A long look down each side, a shiver, then a careful shuffle along.
    const lookDown = () => {
      this._gpFace(-1);
      this.time.delayedCall(360, () => {
        this._gpFace(1);
        this._gpEmote('!', '#ff7a3a');
        this._gpJitter(4, 3, () => this._gpTo(56, peekY, 620, () => this.time.delayedCall(200, down), 'Sine.easeInOut'));
      });
    };
    const down = () => {
      this._gpInFront();
      parts.front.setVisible(false);
      this._gpJump(80, 20 - f, 40, 340, () => this._gpSquash(() => {
        this._gpJump(150, 200 - this._gpFoot(1), 60, 460, () => hotFoot(4), { scale: 1 });
      }, 0.12));
    };
    // Hot, hot, hot: quick hops, turning each time, orange puffs underfoot.
    const hotFoot = (n) => {
      const w = this._gpWorld();
      this._gpPuffs(w.x, w.y + this._gpFoot(1), 0xff8a3d, 3, 34, 26);
      this._gpFace(-this._gpFacing);
      this._gpHop(1, 20, () => {
        if (n > 1) { hotFoot(n - 1); return; }
        this._gpExit();
        done();
      });
    };
  }

  // Big slide: up the ladder, sit in at the top, ride the chute down along the
  // renderer's own centreline (tilted to the slope, tucked in under the near
  // rail), then shoot off the lip onto the woodchips.
  pgSlide(done) {
    const node = this._pgNode('slide');
    const parts = node?.pgParts;
    if (!parts) { done(); return; }
    const pet = this._recessPet;
    const S = 0.62;
    const f = this._gpFoot(S);
    const ladderX = -91;
    const rungs = [130, 50, -30, -110];          // rung tops, every other one
    // The pet's bottom sits a little below the centreline, under the front
    // piece; `k` is how far its origin rides above that line.
    const k = f * 0.65;
    const seatAt = (t) => {
      const c = slideAt(t);
      const tilt = Math.min(slideAngle(t) * 0.6, Phaser.Math.DegToRad(40));
      return { x: c.x + k * Math.sin(tilt), y: c.y - k * Math.cos(tilt), tilt };
    };
    const at = this._gpAt(node, ladderX, 188);
    this._pgWalk(at.x, at.y, () => {
      this._gpEnter(node);
      this._gpFace(1);
      climb(0);
    });
    const climb = (i) => {
      if (i === rungs.length) {
        this._gpJump(-80, -198 - f, 26, 280, () => this._gpSquash(sitIn, 0.1));
        return;
      }
      this._gpJump(ladderX, rungs[i] - f, 22, 240, () => this.time.delayedCall(50, () => climb(i + 1)),
        i === 0 ? { scale: S } : {});
    };
    const sitIn = () => {
      const s0 = seatAt(0);
      this._gpJump(s0.x, s0.y, 14, 220, () => this.time.delayedCall(160, ride),
        { onMid: () => this._gpBehind(parts.front) });
    };
    const ride = () => {
      const drv = { t: 0 };
      this.tweens.add({
        targets: drv, t: 1, duration: 1000, ease: 'Quad.easeIn',
        onUpdate: () => {
          const s = seatAt(drv.t);
          pet.x = s.x;
          pet.y = s.y;
          pet.angle = Phaser.Math.RadToDeg(s.tilt);
        },
        onComplete: () => {
          pet.angle = 0;
          this._gpInFront();
          parts.front.setVisible(false);
          // Off the lip and onto the ground line, in the gap past the slide.
          this._gpJump(176, 188 - this._gpFoot(1), 34, 420, () => {
            const w = this._gpWorld();
            this._gpPuffs(w.x, w.y + this._gpFoot(1), 0xd8b67e, 6, 50, 30);
            this._gpSquash(() => this._gpHop(2, 12, () => {
              this._gpEmote('♥');
              this._gpExit();
              done();
            }));
          }, { scale: 1 });
        }
      });
    };
  }

  // Monkey bars (the room's secret): jump up and hang UNDER the bars, hands
  // behind the lower rail, and swing hand over hand along the drawn rungs,
  // the body trailing each reach. Drop at the far end. The found-it card is
  // shown by _pgNext, only for a kid's own tap.
  pgMonkeyBars(done) {
    const node = this._pgNode('bars');
    const parts = node?.pgParts;
    if (!parts) { done(); return; }
    const pet = this._recessPet;
    const S = 0.85;
    const f = this._gpFoot(S);
    const gripY = -96;                            // hands on the lower rail
    const rungs = PG_BAR_RUNGS;
    // Hang from (px, gripY), the body swung by `th` radians (positive swings
    // the feet left). The pet's top is at the grip, its body below.
    const hang = (px, th) => {
      pet.x = px - f * Math.sin(th);
      pet.y = gripY + f * Math.cos(th);
      pet.angle = Phaser.Math.RadToDeg(th);
    };
    const at = this._gpAt(node, rungs[0], 172);
    this._pgWalk(at.x, at.y, () => {
      this._gpEnter(node);
      this._gpFace(1);
      this._gpJump(rungs[0], gripY + f, 20, 380, () => this.time.delayedCall(140, () => swing(0)),
        { scale: S, onMid: () => this._gpBehind(parts.front) });
    });
    const swing = (i) => {
      if (i === rungs.length - 1) { dropOff(); return; }
      const r0 = rungs[i], r1 = rungs[i + 1];
      const drv = { p: 0 };
      this.tweens.add({
        targets: drv, p: 1, duration: 300, ease: 'Sine.easeInOut',
        onUpdate: () => hang(r0 + (r1 - r0) * drv.p, Phaser.Math.DegToRad(14) * Math.sin(drv.p * Math.PI)),
        onComplete: () => { hang(r1, 0); this.time.delayedCall(40, () => swing(i + 1)); }
      });
    };
    const dropOff = () => {
      this._gpInFront();
      parts.front.setVisible(false);
      this._gpJump(rungs[rungs.length - 1], 172 - this._gpFoot(1), 8, 360, () => {
        const w = this._gpWorld();
        this._gpPuffs(w.x, w.y + this._gpFoot(1), 0xd8b67e, 5, 44, 26);
        this._gpSquash(() => this._gpHop(2, 12, () => {
          this._gpEmote('♥');
          this._gpExit();
          done();
        }));
      }, { scale: 1 });
    };
  }

  // Climbing wall: hold to hold up the drawn holds, a slip halfway ("Watch
  // your step!"), top out and look around, then jump down the far side.
  pgClimbWall(done) {
    const node = this._pgNode('wall');
    if (!node) { done(); return; }
    const pet = this._recessPet;
    const S = 0.7;
    const f = this._gpFoot(S);
    // Bottom to top, zigzagging. Hands on the hold, body hanging below it.
    const holds = PG_WALL_HOLDS;
    const grip = ([hx, hy]) => ({ x: hx, y: hy + f * 0.4 });
    const at = this._gpAt(node, holds[0][0], 142);
    this._pgWalk(at.x, at.y, () => {
      this._gpEnter(node);
      this._gpFace(1);
      const g0 = grip(holds[0]);
      this._gpJump(g0.x, g0.y, 20, 300, () => climb(1), { scale: S });
    });
    const climb = (i) => {
      if (i === holds.length) { topOut(); return; }
      const g = grip(holds[i]);
      const x0 = pet.x;
      if (Math.abs(g.x - x0) > 6) this._gpFace(g.x > x0 ? 1 : -1);
      this._gpJump(g.x, g.y, 14, 260, () => {
        if (i === 3) { slip(g, () => climb(i + 1)); return; }
        this.time.delayedCall(60, () => climb(i + 1));
      });
    };
    const slip = (g, cb) => {
      this._gpEmote('!', '#ff7a3a');
      this._gpTo(g.x, g.y + 26, 120, () => this._gpJitter(4, 4, () => this._gpTo(g.x, g.y, 240, cb, 'Sine.easeOut')), 'Quad.easeIn');
    };
    // Sits astride the top edge (lower half hanging down the face), so a big
    // pet up there stays clear of the "Play tower" label in the row above.
    const topOut = () => {
      this._gpJump(-6, -120 - f * 0.55, 34, 340, () => this._gpSquash(() => {
        this._gpFace(-1);
        this.time.delayedCall(340, () => {
          this._gpFace(1);
          this.time.delayedCall(340, () => this._gpHop(2, 12, () => {
            this._gpJump(150, 142 - this._gpFoot(1), 70, 520, () => {
              const w = this._gpWorld();
              this._gpPuffs(w.x, w.y + this._gpFoot(1), 0xd8b67e, 5, 44, 26);
              this._gpSquash(() => { this._gpExit(); done(); });
            }, { scale: 1 });
          }));
        });
      }, 0.1));
    };
  }

  // Zip line: grab the grip under the trolley at the high end, ride it
  // downhill (right to left) with the body trailing, bounce off the stop at
  // the low end, let go. The trolley then rolls back up on its own.
  pgZipLine(done) {
    const node = this._pgNode('zipline');
    const parts = node?.pgParts;
    if (!parts) { done(); return; }
    const pet = this._recessPet;
    const trolley = parts.trolley;
    const S = 0.6;
    const f = this._gpFoot(S);
    // Grip to the pet's middle: its top tucked behind the grip, but never so
    // high that the grip (bottom edge 9px under its middle) covers the eyes.
    const r = Math.max(f - 4, 19 - this._gpEyeY(S));
    const hang = (th) => {
      pet.x = PG_ZIP.gripX - r * Math.sin(th);
      pet.y = PG_ZIP.gripY + r * Math.cos(th);
      pet.angle = Phaser.Math.RadToDeg(th);
    };
    const moveTrolley = (x) => { trolley.x = x; trolley.y = zipRailY(x); };
    // Still rolling back from the last ride: hurry it home meanwhile.
    const rollHome = (dur, delay = 0) => {
      parts.roll?.stop();
      const back = { x: trolley.x };
      parts.roll = this.tweens.add({
        targets: back, x: PG_ZIP.restX, duration: dur, delay, ease: 'Sine.easeInOut',
        onUpdate: () => moveTrolley(back.x),
        onComplete: () => { parts.roll = null; }
      });
    };
    if (trolley.x !== PG_ZIP.restX) rollHome(300);
    const at = this._gpAt(node, PG_ZIP.restX, 110);
    this._pgWalk(at.x, at.y, () => {
      parts.roll?.stop();
      parts.roll = null;
      moveTrolley(PG_ZIP.restX);
      this._gpEnter(trolley);
      this._gpFace(-1);
      this._gpJump(PG_ZIP.gripX, PG_ZIP.gripY + r, 30, 380, () => this.time.delayedCall(180, ride),
        { scale: S, onMid: () => this._gpBehind(parts.grip) });
    });
    const ride = () => {
      const drv = { p: 0 };
      this.tweens.add({
        targets: drv, p: 1, duration: 1100, ease: 'Sine.easeIn',
        onUpdate: () => {
          moveTrolley(PG_ZIP.restX + (PG_ZIP.stopX - PG_ZIP.restX) * drv.p);
          hang(-Phaser.Math.DegToRad(16) * drv.p);
        },
        onComplete: bounce
      });
    };
    // Clunk into the stop: the trolley kicks back a little, the pet swings
    // forward and back until it settles.
    const bounce = () => {
      this._gpEmote('!', '#ffd86b');
      const drv = { q: 0 };
      this.tweens.add({
        targets: drv, q: 1, duration: 1100, ease: 'Linear',
        onUpdate: () => {
          const q = drv.q;
          moveTrolley(PG_ZIP.stopX + Math.sin(Math.min(1, q * 4) * Math.PI) * 16);
          hang(-Phaser.Math.DegToRad(16) * Math.cos(q * Math.PI * 4) * Math.pow(1 - q, 1.5));
        },
        onComplete: () => { moveTrolley(PG_ZIP.stopX); hang(0); this.time.delayedCall(120, letGo); }
      });
    };
    const letGo = () => {
      this._gpInFront();
      this._gpJump(PG_ZIP.gripX, 110 - this._gpFoot(1) - trolley.y, 20, 360, () => {
        this._gpExit();
        const w = this._gpWorld();
        this._gpPuffs(w.x, w.y + this._gpFoot(1), 0xd8b67e, 5, 44, 26);
        rollHome(1400, 200);
        this._gpSquash(done);
      }, { scale: 1 });
    };
  }

  // Tire swing: hop into the tire (behind its front half) and the whole tire
  // and chains swing from the top bar, higher and then settling. Hop out.
  pgTireSwing(done) {
    const node = this._pgNode('tire');
    const parts = node?.pgParts;
    if (!parts) { done(); return; }
    const pet = this._recessPet;
    const swing = parts.swing;
    const S = 0.6;
    const seat = { x: 0, y: PG_TIRE.seatY - this._gpFoot(S) };   // swing space
    const at = this._gpAt(node, 0, 182);
    this._pgWalk(at.x, at.y, () => {
      swing.angle = 0;
      this._gpEnter(swing);
      this._gpFace(1);
      this._gpJump(seat.x, seat.y, 60, 460, () => this._gpSquash(pump, 0.1),
        { scale: S, onMid: () => this._gpBehind(parts.front) });
    });
    const pump = () => {
      const drv = { p: 0 };
      let cheered = false;
      this.tweens.add({
        targets: drv, p: 1, duration: 3000, ease: 'Linear',
        onUpdate: () => {
          const p = drv.p;
          swing.angle = 22 * Math.sin(Math.PI * p) * Math.sin(Math.PI * 2 * 2.5 * p);
          // Leaning into each swing like a kid pumping their legs.
          pet.angle = -swing.angle * 0.35;
          if (!cheered && p > 0.5) { cheered = true; this._gpEmote('♥'); }
        },
        onComplete: () => { swing.angle = 0; pet.angle = 0; this.time.delayedCall(160, hopOut); }
      });
    };
    const hopOut = () => {
      this._gpInFront();
      parts.front.setVisible(false);
      this._gpFace(-1);
      // Swing space is node space moved up to the top bar (the swing's at rest).
      this._gpJump(-100, 182 - this._gpFoot(1) - swing.y, 60, 480, () => {
        this._gpExit();
        const w = this._gpWorld();
        this._gpPuffs(w.x, w.y + this._gpFoot(1), 0xd8b67e, 5, 44, 26);
        this._gpSquash(done);
      }, { scale: 1 });
    };
  }

  // Spinner: hop up on the disc, which spins on its post (only the disc: the
  // grip dots run round its rim). The pet spins by turning, quick facing flips
  // every half turn, never cartwheeling. Then a dizzy wobble and hop off.
  pgSpin(done) {
    const node = this._pgNode('spinner');
    const parts = node?.pgParts;
    if (!parts) { done(); return; }
    const pet = this._recessPet;
    const S = 0.8;
    const top = { x: 0, y: -26 - this._gpFoot(S) };
    const at = this._gpAt(node, 110, 95);
    this._pgWalk(at.x, at.y, () => {
      this._gpEnter(node);
      this._gpFace(-1);
      this._gpJump(top.x, top.y, 70, 460, () => this._gpSquash(spin, 0.1), { scale: S });
    });
    const spin = () => {
      const drv = { a: parts.phase };
      const a0 = parts.phase;
      this.tweens.add({
        targets: drv, a: a0 + Math.PI * 7, duration: 2000, ease: 'Cubic.easeInOut',
        onUpdate: () => {
          parts.turn(drv.a);
          const want = Math.cos(drv.a - a0) >= 0 ? -1 : 1;
          if (want !== this._gpFacing) this._gpFace(want);
        },
        onComplete: dizzy
      });
    };
    const dizzy = () => {
      this._pgSparkles(3);
      this.tweens.add({
        targets: pet, angle: { from: -10, to: 10 }, duration: 220, yoyo: true, repeat: 2, ease: 'Sine.easeInOut',
        onComplete: () => {
          pet.angle = 0;
          this._gpFace(1);
          this._gpJump(110, 95 - this._gpFoot(1), 60, 460, () => this._gpSquash(() => { this._gpExit(); done(); }), { scale: 1 });
        }
      });
    };
  }

  // Running track ("Super fast!"): hop down onto the track facing right, run
  // left to right kicking up dust, off the right edge, a beat round the back
  // straight, back in from the left edge, slow down and hop home.
  pgRunTrack(done) {
    const pet = this._recessPet;
    const f = this._gpFoot(1);
    const feet = PG_TRACK_TOP + 126;               // on the third lane
    // Fully off screen: half the body plus whatever it's carrying (a held
    // cosmetic sticks out past the body). Never getBounds: the pet's Graphics
    // children make it report the whole screen.
    const out = this._gpHalfW(1) + PG_CARRY;
    const dust = () => this.time.addEvent({
      delay: 70, loop: true,
      callback: () => {
        if (pet.x < -20 || pet.x > W + 20) return;
        this._gpPuffs(pet.x - this._gpFacing * this._gpHalfW(1) * 0.5, feet, 0xcfe0f5, 2, 16, 18);
      }
    });
    const run = (x, dur, ease, cb) => {
      const d = dust();
      this._pgDash(x, feet, dur, () => { d.remove(false); cb(); }, { ease, hop: 10, lean: 8, stride: 70 });
    };
    this._pgWalk(PG_HOME.x, PG_HOME.feet, () => {
      this._gpFace(1);
      this._gpJump(PG_HOME.x + 60, feet - f, 50, 420, () => this._gpSquash(() => {
        run(W + out, 700, 'Quad.easeIn', () => this.time.delayedCall(300, () => {
          pet.x = -out;
          run(PG_HOME.x, 1300, 'Sine.easeOut', () => {
            this._gpJump(PG_HOME.x, PG_HOME.feet - f, 50, 420, () => this._gpSquash(done));
          });
        }));
      }, 0.1));
    });
  }

  // Field: a game of tag ("Catch me if you can!"). The pet hops the fence onto
  // the grass, smaller because it's farther away, and darts about. Each tap ON
  // the pet is a tag: a squeal and a dash the other way. The third tag it lets
  // itself be caught, spins for joy and comes back over the fence. No score,
  // no losing: left alone for a while, it just comes back.
  pgFieldTag(done) {
    const pet = this._recessPet;
    const S = PG_FIELD.scale;
    this._pgWalk(PG_FENCE.x, PG_FENCE.feet, () => {
      this._gpFace(1);
      this._gpJump(PG_FENCE.x + 40, PG_FIELD.feet[1] - this._gpFoot(S), 70, 560, () => {
        this._gpPuffs(pet.x, PG_FIELD.feet[1], 0x8fd46e, 5, 36, 22);
        this._gpSquash(() => {
          // Another stop was tapped on the way out: no game, straight back
          // over the fence so that stop runs next.
          if (this._pgQueued) { this._pgFenceBack(done); return; }
          const tag = { hits: 0, gen: 0, darts: 0, tw: null, timer: null, done };
          this._pgDashY = pet.y;
          this._pgTag = tag;
          this._pgTagHitBox(true);
          // A cheeky "come and get me" hop, then off it goes.
          this._gpHop(2, 12, () => { if (this._pgTag === tag) this._pgTagRun(); });
        }, 0.12);
      }, { scale: S });
    });
  }

  // Dash to a fresh spot on the grass, pause a beat to be caught, repeat.
  // `x` given = a squeal-and-dash away from a tag. A generation token drops
  // darts a tag or the end of the game cut short.
  _pgTagRun(x = null) {
    const tag = this._pgTag;
    const pet = this._recessPet;
    if (!tag || !pet?.active) return;
    const gen = ++tag.gen;
    tag.tw?.stop();
    tag.timer?.remove(false);
    const fast = x != null;
    if (x == null) {
      // Somewhere new, well away from here.
      x = PG_FIELD.x0 + Math.random() * (PG_FIELD.x1 - PG_FIELD.x0);
      if (Math.abs(x - pet.x) < 180) x = pet.x + (x < pet.x ? -180 : 180);
      x = Phaser.Math.Clamp(x, PG_FIELD.x0, PG_FIELD.x1);
    }
    // Never stop on the "Field" label: the label's half width, the pet's at
    // this size and a held cosmetic's reach, either side of it. A dash that
    // would end there carries on past it, the way it was going.
    const label = this._pgItems.field.label;
    const keep = label.width / 2 + (this._gpHalfW(1) + PG_CARRY) * PG_FIELD.scale;
    if (Math.abs(x - label.x) < keep) x = label.x + (x > pet.x ? keep : -keep);
    const [lo, hi] = PG_FIELD.feet;
    const feet = lo + Math.random() * (hi - lo);
    const dist = Math.abs(x - pet.x);
    tag.tw = this._pgDash(x, feet, (fast ? 180 : 280) + dist * (fast ? 0.5 : 0.9), () => {
      if (tag.gen !== gen || this._pgTag !== tag) return;
      // Nobody playing? After a good while it gives up and comes back.
      if (++tag.darts > 10) { this._pgTagEnd(); return; }
      tag.timer = this.time.delayedCall(380 + Math.random() * 380, () => {
        if (tag.gen === gen && this._pgTag === tag) this._pgTagRun();
      });
    }, { hop: 8, stride: 44 });
  }

  // A tap on the pet during tag.
  _pgTagged() {
    const tag = this._pgTag;
    const pet = this._recessPet;
    if (!tag || tag.caught) return;
    tag.hits++;
    tag.darts = 0;
    audio.playPetChirp?.();
    if (tag.hits < 3) {
      this._gpEmote('!', '#ff7a3a');
      // The other way from where it was heading, unless that's the edge.
      let dir = -this._gpFacing;
      const reach = 260 + Math.random() * 160;
      if (pet.x + dir * reach < PG_FIELD.x0 || pet.x + dir * reach > PG_FIELD.x1) dir = -dir;
      this._pgTagRun(Phaser.Math.Clamp(pet.x + dir * reach, PG_FIELD.x0, PG_FIELD.x1));
      return;
    }
    // Caught! A happy spin (quick turns on a hop), sparkles, then home.
    tag.caught = true;
    tag.gen++;
    tag.tw?.stop();
    tag.timer?.remove(false);
    pet.y = this._pgDashY;
    pet.angle = 0;
    this._gpEmote('♥');
    this._pgSparkles(3);
    this._gpHop(2, 18);
    let k = 0;
    const turn = () => {
      if (this._pgTag !== tag) return;
      this._gpFace(-this._gpFacing);
      if (++k < 7) this.time.delayedCall(90, turn);
      else this.time.delayedCall(360, () => this._pgTagEnd());
    };
    turn();
  }

  // The game winds down and the pet heads back (a queued stop runs next).
  _pgTagEnd() {
    const tag = this._pgTag;
    const pet = this._recessPet;
    if (!tag || !pet?.active) return;
    this._pgTag = null;
    tag.gen++;
    tag.tw?.stop();
    tag.timer?.remove(false);
    this.tweens.killTweensOf(pet);
    this._pgTagHitBox(false);
    pet.y = this._pgDashY;
    pet.angle = 0;
    this._pgFenceBack(tag.done);
  }

  // Across the grass to the fence, back over it onto the woodchips at full
  // size, then down the gap column to row 1's ground line, so the routine
  // hands the pet back on a walkway.
  _pgFenceBack(done) {
    const pet = this._recessPet;
    // The game is over, so a Field tap from here on is a new game (petInteract).
    this._pgRunning = null;
    const toX = PG_FENCE.x + 40;
    this._pgDash(toX, PG_FIELD.feet[1], 200 + Math.abs(toX - pet.x) * 0.7, () => {
      this._gpFace(1);
      this._gpJump(PG_FENCE.x, PG_FENCE.feet - this._gpFoot(1), 70, 560, () => {
        this._gpPuffs(pet.x, PG_FENCE.feet, 0xd8b67e, 5, 44, 26);
        this._gpSquash(() => this._pgWalk(PG_FENCE.x, PG_WALK_Y[0], done));
      }, { scale: 1 });
    });
  }

  // The pet's tap box grows for tag: at the field's smaller scale the usual
  // box would be a hard target for a small finger.
  _pgTagHitBox(big) {
    const hit = this._pgPetHit;
    if (!hit?.active) return;
    const s = big ? 200 : 130;
    hit.setSize(s, s);
    hit.input?.hitArea?.setSize(s, s);
  }

  // Found-it celebration: models on showUnlockCelebration. `onDone` runs once
  // the card is closed, however it's dismissed.
  showRecessUnlock(onDone = null) {
    progress.clearHiddenWorld(18);
    cosmetics.addAndEquip('acc_dried_mango');
    audio.playMatch?.();

    // However the card is dismissed, the pet shows the freshly equipped mango.
    return this.showFoundItCard({
      accent: 0x7ed957,
      ink: '#0a2a12',
      subtitle: 'You crossed the monkey bars!',
      unlocked: 'Unlocked: Dried Mango',
      buttonLabel: 'Awesome',
      onClose: () => { this.refreshRecessPet(); onDone?.(); }
    });
  }

  // Redraw the in-scene pet so the just-equipped mango shows up right away.
  refreshRecessPet() {
    if (!this._recessPet?.active || !this._recessPetSprite) return;
    this._recessPetSprite.destroy();
    this._recessPetSprite = drawCompanion(this, 0, 0, { scale: 1.1 });
    this._roomPetSprite = this._recessPetSprite;
    // addAt(…, 0) keeps the pet below the transparent tap hit-rect.
    this._recessPet.addAt(this._recessPetSprite, 0);
    this._gpFace(this._gpFacing);
  }

  // ----------------------------------------------------------
  // PLAYGROUND RIGS: the moving parts each stop's routine plays with, hung on
  // node.pgParts. Front pieces are redraws of an object's near side, hidden
  // until the pet is tucked in behind them, so they never double up the art.
  // ----------------------------------------------------------
  _pgRig(id, node) {
    switch (id) {
      case 'tower':
        node.pgParts = { front: this._pgPiece(node, drawTowerFront, false) };
        return;
      case 'slide':
        node.pgParts = { front: this._pgPiece(node, drawSlideFront, false) };
        return;
      case 'bars':
        node.pgParts = { front: this._pgPiece(node, drawMonkeyBarsFront, false) };
        return;
      case 'zipline': {
        // Trolley, ropes and grip roll along the rail as one; the grip is its
        // own piece so the pet can hang behind it.
        const trolley = this.add.container(PG_ZIP.restX, zipRailY(PG_ZIP.restX));
        this._pgPiece(trolley, drawZipRopes);
        this._pgPiece(trolley, drawZipTrolley);
        const grip = this._pgPiece(trolley, drawZipGrip);
        node.add(trolley);
        node.pgParts = { trolley, grip };
        return;
      }
      case 'tire': {
        // Chains and tire hang from the top bar and swing as one piece.
        const swing = this.add.container(0, PG_TIRE.pivotY);
        this._pgPiece(swing, drawTireSwingTire);
        const front = this._pgPiece(swing, drawTireFront, false);
        node.add(swing);
        node.pgParts = { swing, front };
        return;
      }
      case 'spinner': {
        // The disc sits on the post; its grip dots show which way it's turned.
        this._pgPiece(node, drawSpinnerDisc);
        const dots = this.add.graphics();
        node.add(dots);
        const parts = { phase: 0.5 };
        parts.turn = (a) => { parts.phase = a; drawSpinnerDots(dots, a); };
        parts.turn(parts.phase);
        node.pgParts = parts;
        return;
      }
    }
  }

  // ============================================================
  // HOT POT TIME (W19) — the Chapter 3 secret room.
  //
  // The self-serve, individual-bowl hot pot line the family actually eats at.
  // Laid out top-to-bottom in the REAL order of the place, because that order IS
  // Chapter 3's own mechanic: you walk a line collecting things, hand them over a
  // counter, take a number, and it comes back made. Pack & Go, for dinner.
  //
  // Art rules (project): warm amber palette, plain shapes only, individual round
  // bowls (never a divided shared pot), steam as soft plain ellipses — no rays,
  // no sunbursts, no spirals.
  // ============================================================
  createHotPotExploration() {
    this.drawHotPotBackdrop();

    this.add.text(W / 2, 150, 'HOT POT TIME', style('display', {
      fontSize: '68px',
      fill: '#ffb85c',
      stroke: '#2a1008',
      strokeThickness: 6
    })).setOrigin(0.5).setDepth(5);

    // Bubble copy lives in src/content/hotPot.js.
    const bubbleFor = id => (HOTPOT_ITEMS.find(i => i.id === id)?.bubble) || '';
    // Fresh node table every visit: a stale one would hand the pet destroyed
    // objects from the last time the room was built.
    this._hotPotNode = {};
    const items = [
      // Row 1 — the start of the line: grab a bowl, then walk the bins.
      { id: 'bowls', x: 150,  y: 600,  hitW: 200, hitH: 200, draw: drawBowlStack,      label: 'Empty bowls' },
      { id: 'line',  x: 650,  y: 600,  hitW: 700, hitH: 220, draw: drawIngredientLine, label: 'The line' },
      // Row 2 — the counter: weigh it, pick a broth, take your number.
      { id: 'scale', x: 180,  y: 890,  hitW: 240, hitH: 210, draw: drawCounterScale,   label: 'The scale' },
      { id: 'broth', x: 530,  y: 890,  hitW: 280, hitH: 220, draw: drawBrothStation,   label: 'Broth + spice' },
      { id: 'tag',   x: 880,  y: 890,  hitW: 210, hitH: 210, draw: drawNumberTag,      label: 'Your number' },
      // Row 3 — the wait: build your sauce, and the cone you already planned for.
      { id: 'sauce', x: 220,  y: 1180, hitW: 340, hitH: 230, draw: drawSauceBar,       label: 'Sauce bar' },
      { id: 'cone',  x: 880,  y: 1180, hitW: 240, hitH: 260, draw: drawConeMachine,    label: 'Free cones' },
      // Row 4 — the point of the whole thing.
      { id: 'table', x: W / 2, y: 1560, hitW: 800, hitH: 300, draw: drawFamilyTable,   label: 'Our table' }
    ].map(it => ({ ...it, bubble: bubbleFor(it.id) }));

    for (const item of items) {
      const node = this.add.container(item.x, item.y).setDepth(8);
      const g = this.add.graphics();
      // Drawers get the node + scene too, so the ones with moving parts (the
      // top bowl, the bin heaps and tongs, the number card, the sauce ladles)
      // can hang those parts on the node for the idle pass and the pet to use.
      // The base graphic goes in FIRST so those parts land on top of it.
      node.add(g);
      item.draw(g, node, this);
      this._hotPotNode[item.id] = node;

      // Gentle breathing baseline, same as the garage. The long ingredient line
      // and the family table sit still — scaling a full-width object reads as the
      // room lurching rather than the object being alive.
      if (item.id !== 'line' && item.id !== 'table') {
        this.tweens.add({
          targets: node,
          scale: { from: 1, to: 1.04 },
          duration: 1400 + Math.random() * 400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
      this.animateHotPotItem(item.id, node);

      addRoomLabel(this, item.x, item.y + item.hitH / 2 + 16, item.label, '#ffe0b0', '#2a1008');

      const hit = this.add.rectangle(item.x, item.y, item.hitW, item.hitH, 0, 0)
        .setInteractive({ useHandCursor: true }).setDepth(9);

      hit.on('pointerdown', () => {
        audio.playClick?.();
        // The cone machine is the room's unlock — the last stop on the real line,
        // and the part the kids actually came for. Every other object just talks.
        if (item.id === 'cone' && !progress.isHiddenWorldCleared(19)) {
          this.showHotPotUnlock();
          return;
        }
        this.showBubble(item.x, item.y, item.bubble);
        // The companion goes and does the thing the bubble is about.
        this.hotPotPetInteract(item.id);
      });
    }

    // Dad's note board: the third independent daily deck (family/sharing/
    // people), its own once-per-day claim so all three can be read in one day.
    // Mounted on the wall beside the table rather than on a stand.
    this.createNotesBoard(560, 1180, {
      boardKey: 'hotpot',
      onTap: () => this.hotPotPetInteract('board')
    });

    this.createHotPotPet();

    addLeaveButton(this, () => {
      music.fadeToTrack(this, music.resolveTrack(this, 'homeGroundHome', 'homeTheme'));
      this.scene.start('WorldMapScene');
    });
  }

  drawHotPotBackdrop() {
    this.cameras.main.setBackgroundColor('#2a1610');

    const bg = this.add.graphics().setDepth(0);
    const floorTop = 1240;

    // --- Back wall: warm plaster over a dark wainscot ---
    bg.fillStyle(0x8a5a3c, 1);
    bg.fillRect(0, 0, W, floorTop);
    // Softer, lighter band up top where the pendant lamps hang.
    bg.fillStyle(0xa06a46, 0.55);
    bg.fillRect(0, 0, W, 460);
    // Dark wainscot rail along the lower wall.
    bg.fillStyle(0x5a3524, 1);
    bg.fillRect(0, floorTop - 250, W, 250);
    bg.fillStyle(0x6e4530, 1);
    bg.fillRect(0, floorTop - 250, W, 14);

    // --- Pendant lamps: three cords with plain dome shades + warm pools ---
    for (const lx of [230, 540, 850]) {
      bg.fillStyle(0x2a1a12, 1);
      bg.fillRect(lx - 2, 0, 4, 236);
      // Plain trapezoid shade (no rays, no scallops).
      bg.fillStyle(0xd9873a, 1);
      bg.fillTriangle(lx - 62, 300, lx + 62, 300, lx, 236);
      // Bright rim along the open bottom of the shade.
      bg.fillStyle(0xffcf8a, 1);
      bg.fillRect(lx - 62, 296, 124, 8);
      // Bulb + the warm pool it throws on the wall. Plain ellipses only, stacked
      // in a soft falloff — a couple of big flat ellipses read as hard-edged
      // discs on the wall instead of light.
      bg.fillStyle(0xfff0c8, 0.95);
      bg.fillCircle(lx, 312, 11);
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        bg.fillStyle(0xffb85c, 0.030 * (1 - t * 0.55));
        bg.fillEllipse(lx, 380 + t * 300, 240 + t * 520, 220 + t * 560);
      }
    }

    // --- Floor: warm tile, darker toward the front of the room ---
    bg.fillStyle(0x6b4632, 1);
    bg.fillRect(0, floorTop, W, H - floorTop);
    bg.fillStyle(0x7a5039, 0.6);
    bg.fillRect(0, floorTop, W, 150);
    bg.fillStyle(0x4e3324, 0.5);
    bg.fillRect(0, H - 260, W, 260);
    // Tile grout — plain grid, receding rows.
    bg.lineStyle(2, 0x40291c, 0.55);
    for (let ty = floorTop; ty < H; ty += 92) bg.lineBetween(0, ty, W, ty);
    for (let tx = -60; tx < W + 120; tx += 120) {
      bg.lineBetween(tx, floorTop, tx + 90, H);
    }
    bg.lineStyle(3, 0x3a251a, 1);
    bg.lineBetween(0, floorTop, W, floorTop);

    // Warm lamp spill on the floor around the table.
    bg.fillStyle(0xffb85c, 0.09);
    bg.fillEllipse(W / 2, 1560, W * 1.2, 620);
  }

  // Companion at the family table, reaching into a bowl it should not be in.
  createHotPotPet() {
    // Reset first: these fields outlive the scene, and a stale pet or a busy
    // flag left over from a mid-action exit would wedge every later visit.
    this._hotPotPet = null;
    this._hotPotPetBusy = false;
    if (!companion.hasStarter()) return;
    this._hotPotPetHome = { x: 800, y: 1470 };
    const c = this.add.container(this._hotPotPetHome.x, this._hotPotPetHome.y).setDepth(11);
    this._hotPotPet = c;
    this._hotPotPetSprite = drawCompanion(this, 0, 0, { scale: 1.1 });
    c.add(this._hotPotPetSprite);

    this._hotPotPetBob = this.tweens.add({
      targets: c,
      y: this._hotPotPetHome.y - 8,
      duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    const hit = this.add.rectangle(0, 0, 130, 130, 0, 0)
      .setInteractive({ useHandCursor: true });
    c.add(hit);
    hit.on('pointerdown', () => {
      audio.playPetChirp?.();
      const heart = this.add.text(c.x + 40, c.y - 40, '♥', style('display', {
        fontSize: '36px', fill: '#ff9ec7'
      })).setOrigin(0.5).setDepth(20);
      this.tweens.add({
        targets: heart, y: heart.y - 50, alpha: 0, duration: 700,
        onComplete: () => heart.destroy()
      });
    });
  }

  // Redraw the table pet so a cosmetic equipped mid-visit (the Free Cone from the
  // ice cream machine) shows up right away instead of next visit.
  refreshHotPotPet() {
    if (!this._hotPotPet?.active || !this._hotPotPetSprite) return;
    this._hotPotPetSprite.destroy();
    this._hotPotPetSprite = drawCompanion(this, 0, 0, { scale: 1.1 });
    this._hotPotPet.addAt(this._hotPotPetSprite, 0);
  }

  // ----- Hot pot pet: the companion actually does each thing on the line -----
  // Same shape as the Playground pet (one shared busy-guard, move / act /
  // return home), kept separate so the two rooms stay independent. Every tap in
  // the room routes here; the busy-guard means a second tap mid-action is
  // simply ignored rather than teleporting the pet.
  _hpStart() {
    if (!this._hotPotPet?.active || this._hotPotPetBusy) return false;
    this._hotPotPetBusy = true;
    this._hotPotPetBob?.pause();
    this._hotPotPet.setScale(1);
    this._hotPotPet.angle = 0;
    return true;
  }

  // Walk time scales with distance so a trip across the room doesn't zip and a
  // short hop doesn't crawl.
  _hpMoveTo(x, y, cb, ease) {
    const pet = this._hotPotPet;
    const dist = Phaser.Math.Distance.Between(pet.x, pet.y, x, y);
    this.tweens.add({
      targets: pet, x, y, duration: 240 + dist * 0.45,
      ease: ease || 'Quad.easeInOut', onComplete: cb
    });
  }

  _hpHome(onDone) {
    const pet = this._hotPotPet;
    const home = this._hotPotPetHome;
    const dist = Phaser.Math.Distance.Between(pet.x, pet.y, home.x, home.y);
    this.tweens.add({
      targets: pet, x: home.x, y: home.y, angle: 0, scaleX: 1, scaleY: 1,
      duration: 240 + dist * 0.45, ease: 'Quad.easeInOut',
      onComplete: () => {
        pet.angle = 0; pet.setScale(1);
        this._hotPotPetBusy = false;
        this._hotPotPetBob?.resume();
        onDone?.();
      }
    });
  }

  // `n` quick hops in place. Anything in `extra` (a prop the pet is holding)
  // hops with it; each target gets its own absolute tween so nothing drifts.
  _hpHop(n, h, cb, extra = []) {
    const pet = this._hotPotPet;
    for (const t of extra) {
      this.tweens.add({ targets: t, y: t.y - h, duration: 150, yoyo: true, repeat: n - 1, ease: 'Sine.easeInOut' });
    }
    this.tweens.add({
      targets: pet, y: pet.y - h, duration: 150, yoyo: true, repeat: n - 1,
      ease: 'Sine.easeInOut', onComplete: cb
    });
  }

  // A fleck of sauce / broth thrown up from (x, y) and falling away.
  _hpSplash(x, y, color) {
    const d = this.add.graphics().setDepth(13);
    d.fillStyle(color, 1);
    d.fillCircle(0, 0, 3 + Math.random() * 3);
    d.setPosition(x + (Math.random() - 0.5) * 30, y);
    this.tweens.add({
      targets: d,
      x: d.x + (Math.random() - 0.5) * 90,
      y: y - 40 - Math.random() * 50,
      alpha: 0,
      duration: 420 + Math.random() * 220,
      ease: 'Quad.easeOut',
      onComplete: () => d.destroy()
    });
  }

  // Route an object tap to the matching pet activity (busy-guarded).
  hotPotPetInteract(id) {
    if (!this._hotPotPet?.active || this._hotPotPetBusy) return;
    switch (id) {
      case 'bowls': return this.petGrabTongs();
      case 'line':  return this.petWalkTheLine();
      case 'scale': return this.petGetWeighed();
      case 'broth': return this.petPickBroth();
      case 'tag':   return this.petHoldUpTag();
      case 'sauce': return this.petDigSauce();
      case 'cone':  return this.petEatCone();
      case 'table': return this.petStealFromBowl();
      case 'board': return this.petReadBoard();
    }
  }

  // Empty bowls (150,600): trot over, pull a pair of tongs off the cup, snap
  // them twice, pleased with itself, then bring them along home.
  petGrabTongs() {
    if (!this._hpStart()) return;
    const pet = this._hotPotPet;
    this._hpMoveTo(200, 700, () => {
      const tongs = this.add.container(pet.x + 48, pet.y - 30).setDepth(12);
      const tg = this.add.graphics();
      drawTongs(tg, 0x5c5c68);
      tongs.add(tg);
      tongs.setScale(0).setAngle(-40);
      this.tweens.add({
        targets: tongs, scale: 1.8, angle: -12, duration: 240, ease: 'Back.easeOut',
        onComplete: () => {
          // Two snaps: the V closes and opens.
          this.tweens.add({
            targets: tongs, scaleX: 0.5, duration: 110, yoyo: true, repeat: 1, ease: 'Sine.easeInOut',
            onComplete: () => this._hpHop(2, 12, () => {
              this.tweens.add({ targets: tongs, alpha: 0, y: tongs.y - 18, duration: 260, onComplete: () => tongs.destroy() });
              this._hpHome();
            }, [tongs])
          });
        }
      });
    });
  }

  // The line (650,600): peer down the whole run of bins, leaning in, and help
  // itself to a little of whatever looks good on the way (each heap jiggles and
  // its tongs clack as the pet passes).
  petWalkTheLine() {
    if (!this._hpStart()) return;
    const pet = this._hotPotPet;
    const node = this._hotPotNode?.line;
    const parts = node?.hpParts;
    const walkY = 690;
    this._hpMoveTo(330, walkY, () => {
      let last = -1;
      this.tweens.add({ targets: pet, angle: 12, duration: 180, ease: 'Sine.easeOut' });
      this.tweens.add({
        targets: pet, x: 970, duration: 2300, ease: 'Sine.easeInOut',
        onUpdate: (tw) => {
          const p = tw.progress;
          pet.y = walkY - Math.abs(Math.sin(p * Math.PI * 8)) * 12;
          if (!parts || !node.active) return;
          // Bins sit on a 78px pitch starting at x = -312 (see drawIngredientLine).
          const i = Math.floor((pet.x - node.x + 312) / 78);
          if (i !== last && i >= 0 && i < parts.heaps.length) {
            last = i;
            this._lineServe(node, i);
          }
        },
        onComplete: () => this._hpHome()
      });
    });
  }

  // The scale (180,890): hop up onto the platform and get weighed. The needle
  // swings hard and settles while the pet sits there being a number.
  petGetWeighed() {
    if (!this._hpStart()) return;
    const pet = this._hotPotPet;
    this._hpMoveTo(180, 990, () => {
      this.tweens.add({
        targets: pet, y: 906, duration: 320, ease: 'Quad.easeOut',
        onComplete: () => {
          this._hotPotScaleSwing?.(46);
          this.tweens.add({
            targets: pet, scaleY: 0.8, scaleX: 1.18, duration: 170, yoyo: true, ease: 'Sine.easeOut',
            onComplete: () => this.time.delayedCall(800, () => this._hpHome())
          });
        }
      });
    });
  }

  // Broth + spice (530,890): look up at the mild urn, look up at the spicy one,
  // then fill a bowl from the spicy one (of course). Steam off the bowl.
  petPickBroth() {
    if (!this._hpStart()) return;
    const pet = this._hotPotPet;
    const node = this._hotPotNode?.broth;
    const nx = node?.x ?? 530, ny = node?.y ?? 890;
    // Spigot tips: urns at ±52, spigot bottom at +56 (see drawBrothStation).
    const spigotL = { x: nx - 52, y: ny + 56 };
    const spigotR = { x: nx + 52, y: ny + 56 };
    const standY = 1010;
    this._hpMoveTo(spigotL.x, standY, () => {
      pet.angle = -8;                                     // peer up at mild
      this._hpHop(1, 10, () => {
        this._hpMoveTo(spigotR.x, standY, () => {
          pet.angle = 8;                                    // ... then spicy
          // A bowl held out in front, the pour, then the broth sitting in it.
          const bowl = this.add.graphics().setDepth(12);
          bowl.fillStyle(0xf7f1e6, 1); bowl.fillEllipse(0, 0, 42, 18);
          bowl.fillStyle(0xe2d9c8, 1); bowl.fillEllipse(0, -3, 32, 10);
          bowl.setPosition(pet.x + 4, pet.y + 16);
          const pour = this.add.graphics().setDepth(12);
          pour.fillStyle(0xc03a28, 0.95);
          pour.fillRect(-3, 0, 6, bowl.y - 6 - spigotR.y);
          pour.setPosition(spigotR.x, spigotR.y).setScale(1, 0);
          this.tweens.add({
            targets: pour, scaleY: 1, duration: 240, ease: 'Quad.easeIn',
            onComplete: () => {
              const fill = this.add.graphics().setDepth(13);
              fill.fillStyle(0xc03a28, 1); fill.fillEllipse(0, 0, 30, 8);
              fill.setPosition(bowl.x, bowl.y - 3).setAlpha(0);
              this.tweens.add({ targets: fill, alpha: 1, duration: 320 });
              this.time.delayedCall(520, () => {
                this.tweens.add({ targets: pour, alpha: 0, duration: 180, onComplete: () => pour.destroy() });
                this._steamPuff(null, bowl.x, bowl.y - 12, 0.6);
                this.time.delayedCall(260, () => this._steamPuff(null, bowl.x + 8, bowl.y - 12, 0.5));
                this.time.delayedCall(620, () => {
                  this.tweens.add({
                    targets: [bowl, fill], alpha: 0, duration: 240,
                    onComplete: () => { bowl.destroy(); fill.destroy(); }
                  });
                  this._hpHome();
                });
              });
            }
          });
        }, 'Sine.easeInOut');
      });
    });
  }

  // Your number (880,890): take the tag and hold it up high, hopping. It says 83.
  petHoldUpTag() {
    if (!this._hpStart()) return;
    const pet = this._hotPotPet;
    this._hpMoveTo(880, 992, () => {
      const tag = this.add.container(pet.x, pet.y).setDepth(12);
      const tg = this.add.graphics();
      tg.fillStyle(0xd9a05b, 1); tg.fillRoundedRect(-32, -25, 64, 50, 6);
      tg.fillStyle(0xf5e2b8, 1); tg.fillRoundedRect(-27, -20, 54, 40, 4);
      tag.add(tg);
      // Lettering on the tag, so it scales with it: held up at 1.3x, the 28px
      // number reads at the label size.
      tag.add(this.add.text(0, 0, '83', style('caption', {
        fontSize: '28px', fill: '#8a3a1e', fontStyle: '900', art: true
      })).setOrigin(0.5));
      tag.setScale(0.52).setAlpha(0);
      this.tweens.add({
        targets: tag, y: pet.y - 84, scale: 1.3, alpha: 1, duration: 320, ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: tag, angle: { from: -9, to: 9 }, duration: 220, yoyo: true, repeat: 2, ease: 'Sine.easeInOut'
          });
          this._hpHop(3, 12, () => {
            this.tweens.add({ targets: tag, alpha: 0, y: tag.y - 20, duration: 240, onComplete: () => tag.destroy() });
            this._hpHome();
          }, [tag]);
        }
      });
    });
  }

  // Sauce bar (220,1180): dig in. Three dips, sauce flying off the ladles.
  petDigSauce() {
    if (!this._hpStart()) return;
    const pet = this._hotPotPet;
    const node = this._hotPotNode?.sauce;
    const parts = node?.hpParts;
    const colors = parts?.sauceColors || [0x3a2a1e, 0xc9a06a, 0xc03a28, 0x5e9a45];
    this._hpMoveTo(165, 1270, () => {
      pet.angle = -6;
      let dip = 0;
      const dig = () => {
        const restY = pet.y;
        this.tweens.add({
          targets: pet, y: restY + 18, duration: 130, yoyo: true, ease: 'Quad.easeIn',
          onYoyo: () => {
            // Crocks sit on a 52px pitch from x = -118 (see drawSauceBar); dip a
            // different one each time.
            const crock = (dip * 2 + 1) % 6;
            const cx = node ? node.x - 118 + (crock % 3) * 52 : 150;
            const cy = node ? node.y - 22 + Math.floor(crock / 3) * 48 : 1160;
            for (let k = 0; k < 4; k++) this._hpSplash(cx, cy - 10, colors[(crock + k) % colors.length]);
            if (node?.active) this._sauceLadleBob(node, crock);
          },
          onComplete: () => {
            dip++;
            if (dip < 3) dig();
            else this.time.delayedCall(220, () => this._hpHome());
          }
        });
      };
      dig();
    });
  }

  // Free cones (880,1180): pull a cone from under the nozzle and eat it in
  // three bites: top scoop, bottom scoop, cone. Gone.
  petEatCone() {
    if (!this._hpStart()) return;
    const pet = this._hotPotPet;
    const node = this._hotPotNode?.cone;
    const nozzle = { x: node?.x ?? 880, y: (node?.y ?? 1180) + 62 };
    this._hpMoveTo(980, 1292, () => {
      const cone = this.add.container(nozzle.x, nozzle.y).setDepth(12).setScale(0.7);
      const mk = (draw) => { const p = this.add.graphics(); draw(p); cone.add(p); return p; };
      const wafer = mk(p => {
        p.fillStyle(0xd9a05b, 1); p.fillTriangle(-16, 4, 16, 4, 0, 42);
        p.fillStyle(0xb07a3a, 0.5); p.fillTriangle(3, 6, 16, 4, 0, 42);
      });
      const scoopLow = mk(p => { p.fillStyle(0xfff6e8, 1); p.fillEllipse(0, 2, 36, 18); });
      const scoopTop = mk(p => { p.fillStyle(0xfff6e8, 1); p.fillEllipse(0, -8, 26, 16); });
      const bites = [scoopTop, scoopLow, wafer];
      this.tweens.add({
        targets: cone, x: pet.x - 34, y: pet.y - 4, scale: 1, duration: 340, ease: 'Quad.easeInOut',
        onComplete: () => {
          let bite = 0;
          const chomp = () => {
            this.tweens.add({
              targets: pet, scaleY: 0.86, scaleX: 1.1, duration: 110, yoyo: true, ease: 'Sine.easeOut',
              // onYoyo fires once per tweened property (scaleX AND scaleY), so
              // count the bite on one key only or two bites land per chomp.
              onYoyo: (tw, target, key) => {
                if (key !== 'scaleY') return;
                bites[bite]?.setVisible(false);
                bite++;
              },
              onComplete: () => {
                if (bite < bites.length) this.time.delayedCall(170, chomp);
                else { cone.destroy(); this._hpHop(2, 12, () => this._hpHome()); }
              }
            });
          };
          chomp();
        }
      });
    });
  }

  // Our table (W/2,1560): sneak over to the fourth bowl, dip in, come up with a
  // noodle, scurry back looking innocent.
  petStealFromBowl() {
    if (!this._hpStart()) return;
    const pet = this._hotPotPet;
    // The fourth bowl along the table (seat offset +144 from centre).
    const bowlX = W / 2 + 144;
    const bowlY = 1512;
    this._hpMoveTo(bowlX, bowlY, () => {
      this.tweens.add({
        targets: pet, y: bowlY + 22, duration: 200, yoyo: true, ease: 'Sine.easeInOut',
        onComplete: () => {
          // A prop, not reading text: it keeps its own size.
          const loot = this.add.text(pet.x + 26, pet.y - 34, '🍜', style('display', {
            fontSize: '30px', art: true
          })).setOrigin(0.5).setDepth(20);
          this.tweens.add({
            targets: loot, y: loot.y - 26, alpha: 0, duration: 900,
            onComplete: () => loot.destroy()
          });
          this._hpHome();
        }
      });
    });
  }

  // Dad's note (560,1180): trot over and look up at the board while it's read.
  petReadBoard() {
    if (!this._hpStart()) return;
    const pet = this._hotPotPet;
    this._hpMoveTo(560, 1305, () => {
      this.tweens.add({
        targets: pet, angle: -12, duration: 200, ease: 'Sine.easeOut',
        onComplete: () => this._hpHop(2, 10, () => this.time.delayedCall(700, () => this._hpHome()))
      });
    });
  }

  // ----- Idle life on the hot pot objects -----
  // Every object gets something: the breathing baseline in the build loop, plus
  // one of these. Moving parts come from the drawers via node.hpParts.
  animateHotPotItem(id, node) {
    switch (id) {
      case 'bowls': return this._bowlsRestock(node);
      case 'line':  return this._lineService(node);
      case 'scale': return this._scaleSettle(node);
      case 'broth': return this._brothSteam(node);
      case 'tag':   return this._tagSetDown(node);
      case 'sauce': return this._sauceLadles(node);
      case 'cone':  return this._coneDrip(node);
      case 'table': return this._tableSteam(node);
    }
  }

  // Soft plain steam ellipses rising and dissolving. Deliberately ellipses,
  // never rays or spirals (project art rule). Pass a node to steam inside it
  // (ox, oy relative), or null for a scene-level puff at absolute (ox, oy).
  _steamPuff(node, ox, oy, scale = 1) {
    const puff = this.add.graphics();
    puff.fillStyle(0xffe8c8, 0.4);
    puff.fillEllipse(0, 0, 34 * scale, 22 * scale);
    puff.setPosition(ox, oy);
    if (node) node.add(puff);
    else puff.setDepth(13);
    this.tweens.add({
      targets: puff,
      y: oy - 90 - Math.random() * 40,
      x: ox + (Math.random() - 0.5) * 40,
      scaleX: 1.8, scaleY: 1.8,
      alpha: 0,
      duration: 2000 + Math.random() * 900,
      ease: 'Sine.easeOut',
      onComplete: () => puff.destroy()
    });
  }

  _brothSteam(node) {
    this.time.addEvent({
      delay: 900, loop: true,
      callback: () => {
        if (!node.active) return;
        this._steamPuff(node, Math.random() < 0.5 ? -52 : 52, -60, 0.9);
      }
    });
  }

  _tableSteam(node) {
    // Five bowls on the table, so steam drifts up from a few of them at a time.
    const bowlXs = [-288, -144, 0, 144, 288];
    this.time.addEvent({
      delay: 700, loop: true,
      callback: () => {
        if (!node.active) return;
        const bx = bowlXs[Math.floor(Math.random() * bowlXs.length)];
        this._steamPuff(node, bx, -42, 0.75);
      }
    });
  }

  // Bowl stack: every few seconds the top bowl lifts out of the stack and drops
  // back in (someone grabbing one, changing their mind), and the chopsticks
  // rattle in their cup as it happens.
  _bowlsRestock(node) {
    const { topBowl, chopsticks } = node.hpParts || {};
    if (!topBowl) return;
    this.time.addEvent({
      delay: 3600, loop: true,
      callback: () => {
        if (!node.active) return;
        this.tweens.add({
          targets: topBowl, y: -20, angle: -6, duration: 380, ease: 'Sine.easeOut',
          onComplete: () => this.tweens.add({ targets: topBowl, y: 0, angle: 0, duration: 560, ease: 'Bounce.easeOut' })
        });
        if (chopsticks) {
          this.tweens.add({
            targets: chopsticks, angle: { from: -4, to: 4 }, duration: 70, yoyo: true, repeat: 3,
            onComplete: () => { chopsticks.angle = 0; }
          });
        }
      }
    });
  }

  // The line: somebody is always taking a scoop from one bin or another, and a
  // soft light slides along the sneeze guard.
  _lineService(node) {
    const parts = node.hpParts;
    if (!parts) return;
    this.time.addEvent({
      delay: 1900, loop: true,
      callback: () => {
        if (!node.active) return;
        this._lineServe(node, Math.floor(Math.random() * parts.heaps.length));
      }
    });
    const sweep = () => {
      if (!node.active) return;
      parts.sheen.x = -300;
      parts.sheen.alpha = 0;
      this.tweens.add({
        targets: parts.sheen, x: 300, duration: 2600, ease: 'Sine.easeInOut',
        onUpdate: (tw) => { parts.sheen.alpha = Math.sin(tw.progress * Math.PI) * 0.22; },
        onComplete: () => this.time.delayedCall(4200, sweep)
      });
    };
    this.time.delayedCall(1200, sweep);
  }

  // One scoop from bin `i`: the tongs lift and clack back down, the heap jiggles.
  _lineServe(node, i) {
    const parts = node.hpParts;
    const tongs = parts?.tongs[i];
    const heap = parts?.heaps[i];
    if (!tongs || !heap || tongs.hpBusy) return;
    tongs.hpBusy = true;
    const y0 = tongs.y;
    this.tweens.add({
      targets: tongs, y: y0 - 16, angle: -22, duration: 180, ease: 'Quad.easeOut',
      onComplete: () => this.tweens.add({
        targets: tongs, y: y0, angle: 0, duration: 280, ease: 'Bounce.easeOut',
        onComplete: () => { tongs.hpBusy = false; }
      })
    });
    this.tweens.add({ targets: heap, scaleY: 0.88, scaleX: 1.06, duration: 120, yoyo: true, ease: 'Sine.easeOut' });
  }

  // The scale needle nudges and settles, like a bowl was just set down on it.
  // The swing is kept on the scene so the pet can give it a proper wallop.
  _scaleSettle(node) {
    const needle = this.add.graphics();
    needle.fillStyle(0xb3261e, 1);
    needle.fillRect(-2, -34, 4, 36);
    needle.setPosition(0, -6);
    node.add(needle);
    const swing = (peak = 26) => {
      if (!node.active) return;
      this.tweens.add({
        targets: needle, angle: peak, duration: 260, ease: 'Back.easeOut',
        onComplete: () => this.tweens.add({
          targets: needle, angle: 18, duration: 420, ease: 'Sine.easeInOut'
        })
      });
    };
    needle.angle = 18;
    this._hotPotScaleSwing = swing;
    this.time.addEvent({ delay: 3200, loop: true, callback: () => swing() });
  }

  // Number tag: the card rocks on its clip now and then, like it was just set down.
  _tagSetDown(node) {
    const card = node.hpParts?.card;
    if (!card) return;
    this.time.addEvent({
      delay: 3400, loop: true,
      callback: () => {
        if (!node.active) return;
        this.tweens.add({
          targets: card, angle: -5, duration: 160, ease: 'Sine.easeOut',
          onComplete: () => this.tweens.add({ targets: card, angle: 0, duration: 800, ease: 'Elastic.easeOut' })
        });
      }
    });
  }

  // Sauce bar: a ladle lifts out of one crock or another and drips back in;
  // the recipe card flutters in the kitchen draft.
  _sauceLadles(node) {
    const parts = node.hpParts;
    if (!parts) return;
    this.time.addEvent({
      delay: 2300, loop: true,
      callback: () => {
        if (!node.active) return;
        this._sauceLadleBob(node, Math.floor(Math.random() * parts.ladles.length));
      }
    });
    if (parts.recipe) {
      this.tweens.add({
        targets: parts.recipe, angle: { from: -1.5, to: 1.5 },
        duration: 2100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    }
  }

  _sauceLadleBob(node, i) {
    const parts = node.hpParts;
    const ladle = parts?.ladles[i];
    if (!ladle || ladle.hpBusy) return;
    ladle.hpBusy = true;
    const y0 = ladle.y;
    this.tweens.add({
      targets: ladle, y: y0 - 12, angle: -14, duration: 220, ease: 'Quad.easeOut',
      onComplete: () => {
        const drip = this.add.graphics();
        drip.fillStyle(parts.sauceColors[i], 1);
        drip.fillCircle(0, 0, 4);
        drip.setPosition(ladle.x + 8, ladle.y - 6);
        node.add(drip);
        this.tweens.add({
          targets: drip, y: drip.y + 22, alpha: 0.2, duration: 320, ease: 'Quad.easeIn',
          onComplete: () => drip.destroy()
        });
        this.tweens.add({
          targets: ladle, y: y0, angle: 0, duration: 380, ease: 'Bounce.easeOut',
          onComplete: () => { ladle.hpBusy = false; }
        });
      }
    });
  }

  // A slow soft-serve curl building at the machine's nozzle, then resetting.
  _coneDrip(node) {
    const drip = this.add.graphics();
    drip.fillStyle(0xfff6e8, 1);
    drip.fillCircle(0, 0, 9);
    drip.setPosition(0, 44);
    drip.setAlpha(0);
    node.add(drip);
    this.time.addEvent({
      delay: 2600, loop: true,
      callback: () => {
        if (!node.active) return;
        drip.setAlpha(1);
        drip.y = 44;
        this.tweens.add({
          targets: drip, y: 78, alpha: 0, duration: 900, ease: 'Quad.easeIn'
        });
      }
    });
  }

  showHotPotUnlock() {
    progress.clearHiddenWorld(19);
    cosmetics.addAndEquip('acc_free_cone');
    audio.playMatch?.();

    // Stay in the room after the cone: the kid keeps exploring and leaves on
    // their own, same as the garage.
    return this.showFoundItCard({
      accent: 0xffb85c,
      ink: '#2a1008',
      subtitle: 'The one at the end. On the house.',
      unlocked: 'Unlocked: Free Cone',
      buttonLabel: 'Yes!',
      onButton: () => this.refreshHotPotPet()
    });
  }
}

// ============================================================
// GLITCH PLANET HELPERS — drawn on the world map only.
// ============================================================

// Single-tint ghost sphere (used for RGB channel split).
function drawGlitchPlanetSphere(g, R, { tint, alpha, offsetX = 0 }) {
  g.fillStyle(tint, alpha);
  g.fillCircle(offsetX, 0, R);
}

// Main planet body — green/magenta continents over a dark base.
function drawGlitchPlanetBody(g, R) {
  // Base dark sphere
  g.fillStyle(0x180020, 1);
  g.fillCircle(0, 0, R);
  // Sphere shading — darker lower-right crescent
  g.fillStyle(0x000000, 0.45);
  g.fillCircle(R * 0.25, R * 0.25, R * 0.95);
  // "Continents" — irregular blobs in green
  g.fillStyle(0x39ff14, 0.92);
  for (const [bx, by, br] of [
    [-R * 0.35, -R * 0.2, R * 0.36],
    [R * 0.15, -R * 0.45, R * 0.22],
    [R * 0.05, R * 0.25, R * 0.30],
    [-R * 0.6, R * 0.1, R * 0.18]
  ]) {
    drawClippedBlob(g, bx, by, br, R);
  }
  // Magenta corruption bands (horizontal stripes within sphere)
  g.fillStyle(0xff00ff, 0.65);
  for (const by of [-R * 0.55, -R * 0.15, R * 0.18, R * 0.45]) {
    const halfW = Math.sqrt(Math.max(0, R * R - by * by));
    g.fillRect(-halfW, by, halfW * 2, 6);
  }
  // Random bright pixel noise inside sphere
  g.fillStyle(0xffffff, 0.85);
  for (let i = 0; i < 36; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * R * 0.95;
    g.fillRect(Math.cos(a) * r, Math.sin(a) * r, 2, 2);
  }
  // Sphere highlight (upper-left)
  g.fillStyle(0xffffff, 0.18);
  g.fillEllipse(-R * 0.35, -R * 0.4, R * 0.7, R * 0.35);
  // Outer ring outline
  g.lineStyle(2, 0x39ff14, 0.6);
  g.strokeCircle(0, 0, R);
}

// Draws an irregular green continent blob, clipped to fit visually inside the
// planet disc (cheap: blob made of 3 overlapping circles).
function drawClippedBlob(g, cx, cy, br, R) {
  if (Math.hypot(cx, cy) + br > R + 4) return; // skip if mostly outside
  g.fillCircle(cx, cy, br);
  g.fillCircle(cx + br * 0.5, cy + br * 0.2, br * 0.7);
  g.fillCircle(cx - br * 0.4, cy + br * 0.3, br * 0.6);
}

// Small glitch planet — used on the world map node. Returns a Phaser graphics
// container drawn at (x, y). `R` is the planet radius. Calm + stable when
// the boss has been defeated, glitchy when not.
export function drawGlitchPlanetNode(scene, x, y, R) {
  const c = scene.add.container(x, y);
  const cleared = progress.isHiddenWorldCleared(15);

  // Red + blue ghosts (much smaller offset post-clear — world has stabilized)
  const ghostOffset = cleared ? 1 : 3;
  const ghostAlpha = cleared ? 0.22 : 0.5;
  const red = scene.add.graphics();
  drawGlitchPlanetSphere(red, R, { tint: 0xff2244, alpha: ghostAlpha, offsetX: -ghostOffset });
  c.add(red);
  const blue = scene.add.graphics();
  drawGlitchPlanetSphere(blue, R, { tint: 0x2a8aff, alpha: ghostAlpha, offsetX: ghostOffset });
  c.add(blue);

  // Main body
  const body = scene.add.graphics();
  drawGlitchPlanetBody(body, R);
  c.add(body);

  // Static horizontal tear bands — fewer and dimmer when cleared
  const tears = scene.add.graphics();
  c.add(tears);
  const tearCount = cleared ? 1 : 3;
  const dotCount = cleared ? 2 : 5;
  const tearAlpha = cleared ? 0.35 : 0.7;
  const redraw = () => {
    tears.clear();
    for (let i = 0; i < tearCount; i++) {
      const ty = (Math.random() - 0.5) * R * 1.4;
      const halfW = Math.sqrt(Math.max(0, R * R - ty * ty));
      tears.fillStyle(i % 2 ? 0xff00ff : 0x39ff14, tearAlpha);
      tears.fillRect(-halfW, ty, halfW * 2, 2);
    }
    for (let i = 0; i < dotCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * R * 0.8;
      tears.fillStyle(Math.random() < 0.5 ? 0xfff700 : 0x00f0ff, 0.9);
      tears.fillRect(Math.cos(ang) * r, Math.sin(ang) * r, 4, 4);
    }
  };
  redraw();

  // Outer glow halo
  const halo = scene.add.graphics();
  if (cleared) {
    halo.fillStyle(0x39ff14, 0.20);
    halo.fillCircle(0, 0, R + 14);
    halo.fillStyle(0x39ff14, 0.10);
    halo.fillCircle(0, 0, R + 26);
  } else {
    halo.fillStyle(0x39ff14, 0.12);
    halo.fillCircle(0, 0, R + 12);
    halo.fillStyle(0xff00ff, 0.08);
    halo.fillCircle(0, 0, R + 22);
  }
  c.addAt(halo, 0);

  // Flicker tick — slow + subtle when cleared, frantic when not
  scene.time.addEvent({
    delay: cleared ? 720 : 280,
    loop: true,
    callback: () => {
      redraw();
      const jx = (Math.random() - 0.5) * (cleared ? 1.5 : 4);
      red.x = -ghostOffset + jx;
      blue.x = ghostOffset - jx;
    }
  });

  // Stabilized checkmark badge — small green check at the corner.
  if (cleared) {
    const badge = scene.add.graphics();
    badge.fillStyle(0x0a0a1a, 1);
    badge.fillCircle(R * 0.72, -R * 0.72, R * 0.28);
    badge.lineStyle(2, 0x39ff14, 1);
    badge.strokeCircle(R * 0.72, -R * 0.72, R * 0.28);
    badge.lineStyle(3, 0x39ff14, 1);
    badge.beginPath();
    badge.moveTo(R * 0.72 - R * 0.13, -R * 0.72);
    badge.lineTo(R * 0.72 - R * 0.03, -R * 0.62);
    badge.lineTo(R * 0.72 + R * 0.15, -R * 0.85);
    badge.strokePath();
    c.add(badge);
  }

  return c;
}

// Small garage-door node icon for the world map (W16 hidden world).
// White panelled door, dark frame, warm window strip at the top. Once the
// garage has been visited and completed, the window glows brighter and a
// tiny chimney wisp marks the place as "active".
export function drawGarageNode(scene, x, y, R) {
  const c = scene.add.container(x, y);
  const cleared = progress.isHiddenWorldCleared(16);

  // Soft warm halo — brighter post-clear so the garage clearly looks "lived in"
  const halo = scene.add.graphics();
  halo.fillStyle(0xffe6a8, cleared ? 0.26 : 0.14);
  halo.fillCircle(0, 0, R + (cleared ? 18 : 14));
  c.add(halo);
  // Concrete pad / floor strip
  const pad = scene.add.graphics();
  pad.fillStyle(0x2a2a30, 1);
  pad.fillRoundedRect(-R - 4, R - 8, (R + 4) * 2, 14, 4);
  c.add(pad);
  // Garage door frame (dark)
  const door = scene.add.graphics();
  door.fillStyle(0x2a2620, 1);
  door.fillRoundedRect(-R - 2, -R - 2, (R + 2) * 2, (R + 2) * 2, 6);
  // Door body — white
  door.fillStyle(0xf2efe6, 1);
  door.fillRoundedRect(-R + 4, -R + 4, (R - 4) * 2, (R - 4) * 2, 4);
  // Subtle top highlight on the door
  door.fillStyle(0xffffff, 0.45);
  door.fillRoundedRect(-R + 6, -R + 6, (R - 4) * 2 - 4, 6, 3);
  // Horizontal panel seams (light grey)
  for (let i = 1; i < 4; i++) {
    const py = -R + 4 + i * ((R - 4) * 2) / 4;
    door.lineStyle(2, 0xbab2a2, 1);
    door.lineBetween(-R + 4, py, R - 4, py);
  }
  // Vertical center seam
  door.lineStyle(2, 0xbab2a2, 0.6);
  door.lineBetween(0, -R + 4, 0, R - 4);
  // Handle
  door.fillStyle(0x2a2a30, 1);
  door.fillRoundedRect(-6, R - 12, 12, 6, 2);
  c.add(door);
  // Warm window strip at top — gives the "lit garage at night" feel
  const glow = scene.add.graphics();
  glow.fillStyle(cleared ? 0xfff3b8 : 0xffc864, cleared ? 1 : 0.85);
  glow.fillRoundedRect(-R + 12, -R + 10, (R - 12) * 2, 7, 2);
  c.add(glow);

  // Cleared: tiny smoke wisp from a chimney at top-right, gentle pulse on window
  if (cleared) {
    const wisp = scene.add.graphics();
    wisp.fillStyle(0xeaf6ff, 0.5);
    wisp.fillCircle(R * 0.55, -R - 8, 3);
    wisp.fillStyle(0xeaf6ff, 0.32);
    wisp.fillCircle(R * 0.6, -R - 16, 4);
    wisp.fillStyle(0xeaf6ff, 0.16);
    wisp.fillCircle(R * 0.5, -R - 24, 5);
    c.add(wisp);
    scene.tweens.add({
      targets: wisp,
      y: -8,
      alpha: { from: 1, to: 0.4 },
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    scene.tweens.add({
      targets: glow,
      alpha: { from: 1, to: 0.7 },
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }
  return c;
}

// ============================================================
// RECESS — playground/track draw helpers (module-level, like the garage's).
// Backdrop helpers draw on the shared `bg` graphics in absolute coords;
// item helpers draw a fresh Graphics `g` centered at (0,0).
// ============================================================

// Evergreen conifer (background band). Brown trunk + 3 stacked green tiers.
function drawConifer(bg, x, y, s = 1) {
  const w = 56 * s;
  bg.fillStyle(0x6b4a2a, 1);
  bg.fillRect(x - 5 * s, y, 10 * s, 28 * s);
  bg.fillStyle(0x2f6e36, 1);
  bg.fillTriangle(x, y + 4 * s, x - w / 2, y + 4 * s, x, y - 40 * s);
  bg.fillTriangle(x, y + 4 * s, x + w / 2, y + 4 * s, x, y - 40 * s);
  bg.fillTriangle(x, y - 16 * s, x - w * 0.42, y - 16 * s, x, y - 64 * s);
  bg.fillTriangle(x, y - 16 * s, x + w * 0.42, y - 16 * s, x, y - 64 * s);
  bg.fillStyle(0x3a8044, 1);
  bg.fillTriangle(x, y - 34 * s, x - w * 0.3, y - 34 * s, x, y - 80 * s);
  bg.fillTriangle(x, y - 34 * s, x + w * 0.3, y - 34 * s, x, y - 80 * s);
}

// Warm Art-Deco / Collegiate school (a classic city high school): warm buff stone
// with a cornice + base course, tall PAIRED windows in bays (not a factory grid),
// a projecting central entrance pavilion with a stepped Deco crown, a CLOCK, a
// grand doorway, and a FLAGPOLE + FLAG on top — the unmistakable "school" signals.
// No spire/cross (not a church), no smokestack fins (not a factory).
function drawSchoolTowerBack(bg, x, y) {
  const stone = 0xe3dac6, stoneShade = 0xd0c6ae, stoneDark = 0xbcb094, cornice = 0xf1ecdd;
  const glass = 0x6f93a8, glassDark = 0x46606e, glassHi = 0xbcd2dc, litGlass = 0xf6d98a;
  const door = 0x5b4632, surround = 0xece4d2, pole = 0x8a8f96, flagRed = 0xd14b3f;

  const base = y + 182;                                  // meets the turf line
  const bx0 = x - 322, bx1 = x + 322, roof = y + 48;     // wide main block
  const cx0 = x - 88, cx1 = x + 88, cRoof = y - 6;       // central pavilion (taller)

  // Rectangular window, warm-lit when `on`.
  const win = (cx, top, w, h, on) => {
    bg.fillStyle(glassDark, 1); bg.fillRect(cx - w / 2 - 1, top - 1, w + 2, h + 2);
    bg.fillStyle(on ? litGlass : glass, 1); bg.fillRect(cx - w / 2, top, w, h);
    bg.fillStyle(on ? 0xfff0c0 : glassHi, on ? 0.5 : 0.45); bg.fillRect(cx - w / 2 + 2, top + 2, 4, h - 4);
    bg.lineStyle(1.3, glassDark, 0.5); bg.lineBetween(cx, top, cx, top + h);
  };

  // ---- main block: warm stone, cornice, base course, raised end parapets ----
  bg.fillStyle(stone, 1); bg.fillRect(bx0, roof, bx1 - bx0, base - roof);
  bg.fillStyle(stoneDark, 1); bg.fillRect(bx0, base - 16, bx1 - bx0, 16);          // base course
  bg.fillStyle(cornice, 1); bg.fillRect(bx0 - 5, roof - 8, (bx1 - bx0) + 10, 8);   // cornice cap
  bg.fillStyle(stoneShade, 1); bg.fillRect(bx0, roof, bx1 - bx0, 3);               // under-cornice shadow
  bg.fillStyle(cornice, 1); bg.fillRect(bx0 - 2, roof - 16, 64, 10); bg.fillRect(bx1 - 62, roof - 16, 64, 10);
  bg.fillStyle(stone, 1);   bg.fillRect(bx0 + 2, roof - 8, 56, 8);  bg.fillRect(bx1 - 58, roof - 8, 56, 8);

  // ---- wing windows: tall pairs in bays, divided by slim pilasters ----
  const rows = [roof + 20, roof + 70];
  for (const [zs, ze] of [[bx0 + 14, cx0 - 14], [cx1 + 14, bx1 - 14]]) {
    const bays = 3, bw = (ze - zs) / bays;
    for (let b = 0; b <= bays; b++) { bg.fillStyle(stoneShade, 1); bg.fillRect(zs + bw * b - 3, roof, 6, (base - roof) - 16); }
    for (let b = 0; b < bays; b++) {
      const c = zs + bw * (b + 0.5);
      for (let r = 0; r < rows.length; r++) {
        const isLit = (b === 1 && r === 1);
        win(c - 13, rows[r], 18, 38, isLit);
        win(c + 13, rows[r], 18, 38, false);
      }
    }
  }

  // ---- central pavilion: projects + rises, with a stepped Deco crown ----
  bg.fillStyle(stone, 1);     bg.fillRect(cx0, cRoof, cx1 - cx0, base - cRoof);
  bg.fillStyle(0xeee6d4, 1);  bg.fillRect(cx0, cRoof, 6, base - cRoof);            // lit left edge
  bg.fillStyle(stoneShade, 1); bg.fillRect(cx1 - 6, cRoof, 6, base - cRoof);       // shaded right edge
  // stepped Art-Deco crown (flat steps — not a spire, not fins)
  bg.fillStyle(cornice, 1); bg.fillRect(cx0 + 6, cRoof - 8, (cx1 - cx0) - 12, 10);
  bg.fillStyle(stone, 1);   bg.fillRect(x - 50, cRoof - 18, 100, 12); bg.fillStyle(cornice, 1); bg.fillRect(x - 50, cRoof - 18, 100, 4);
  bg.fillStyle(stone, 1);   bg.fillRect(x - 26, cRoof - 26, 52, 10);  bg.fillStyle(cornice, 1); bg.fillRect(x - 26, cRoof - 26, 52, 4);
  // flagpole + flag (the clearest "school", never a factory)
  bg.fillStyle(pole, 1); bg.fillRect(x - 1.5, cRoof - 70, 3, 48);
  bg.fillStyle(flagRed, 1); bg.fillRect(x + 1.5, cRoof - 70, 34, 20);
  bg.fillStyle(stone, 1); bg.fillTriangle(x + 35, cRoof - 70, x + 35, cRoof - 50, x + 24, cRoof - 60); // swallowtail notch
  // clock on the pavilion face
  bg.fillStyle(0xf6f1e6, 1); bg.fillCircle(x, cRoof + 30, 17);
  bg.lineStyle(3, stoneDark, 1); bg.strokeCircle(x, cRoof + 30, 17);
  bg.lineStyle(2.5, glassDark, 1); bg.lineBetween(x, cRoof + 30, x, cRoof + 20); bg.lineBetween(x, cRoof + 30, x + 9, cRoof + 33);
  // three tall dignified windows
  for (const sx of [x - 46, x, x + 46]) win(sx, cRoof + 58, 22, 74, false);

  // ---- grand central entrance ----
  const dW = 70, dTop = base - 50;
  bg.fillStyle(surround, 1); bg.fillRect(x - dW / 2 - 7, dTop - 10, dW + 14, (base - 16) - (dTop - 10));   // stepped surround
  bg.fillStyle(stoneShade, 1); bg.fillRect(x - dW / 2 - 7, dTop - 10, dW + 14, 4);
  bg.fillStyle(door, 1); bg.fillRect(x - dW / 2, dTop, dW, (base - 16) - dTop);
  bg.fillStyle(0x4a3a2a, 1); bg.fillRect(x - 2, dTop, 4, (base - 16) - dTop);                              // double-door split
  bg.fillStyle(glassDark, 1); bg.fillRect(x - dW / 2 + 6, dTop + 5, dW - 12, 9);                           // transom
}

// Small white soccer goal sitting on the turf (background).
function drawGoalBack(bg, x, y) {
  bg.lineStyle(5, 0xffffff, 0.95);
  bg.strokeRect(x - 60, y - 56, 120, 56);
  bg.lineStyle(1.5, 0xffffff, 0.5);
  for (let gx = x - 54; gx < x + 60; gx += 14) bg.lineBetween(gx, y - 50, gx, y);
  for (let gy = y - 50; gy < y; gy += 12) bg.lineBetween(x - 56, gy, x + 56, gy);
}

// Green chain-link fence strip across the canvas at height `y`, thickness `h`.
function drawFenceStrip(bg, y, h) {
  bg.fillStyle(0x3a6b4a, 0.9);
  bg.fillRect(0, y, W, 4);
  bg.fillRect(0, y + h - 4, W, 4);
  bg.lineStyle(1.2, 0x6fa080, 0.5);
  for (let mx = -h; mx < W; mx += 16) {
    bg.lineBetween(mx, y, mx + h, y + h);
    bg.lineBetween(mx + h, y, mx, y + h);
  }
  bg.fillStyle(0x2f5a3e, 0.9);
  for (let px = 40; px < W; px += 200) bg.fillRect(px, y - 6, 6, h + 10);
}

// ----- Playground layout (scene coordinates) -----
// Ground lines for the three rows of equipment. Each object's node sits its
// renderer's `foot` above its row's line and its label hangs PG_LABEL_DROP
// under it, so the labels in a row line up. Row 3's line puts the spinner's
// label level with the foot of the Dad's note board.
const PG_GROUND = { row1: 1046, row2: 1440, row3: 1708 };
const PG_LABEL_DROP = 24;
const PG_TRACK_TOP = H - 178;
// Every stop and the notes board breathe between scale 1 and this.
const PG_BREATHE = 1.03;
// A finger's margin around each stop's drawn art in its tap box.
const PG_HIT_PAD = 16;
// Dad's note board on the woodchips (its ground line is 124 under this).
const PG_NOTES = { x: 560, y: 1600 };
// Extra off-screen room in the track wrap, for a held cosmetic poking out
// past the body: the Dried Mango reaches about 70px past an ember adult's
// side, and the run's lean and hops swing it a little further.
const PG_CARRY = 110;
// Half the widest pet's width in the room: pets are drawn in 6px cells and
// the room pet at 1.1 (the same sum as _gpHalfW(1)).
const PG_WIDEST_HALF_W = Math.max(...Object.values(PET_SPRITES)
  .flatMap(stages => Object.values(stages).map(grid => grid[0].length))) * 6 / 2 * 1.1;
// The pet's home: on the timber edge of the running track, right of the notes
// board, far enough right that the widest pet facing the board, holding a
// Dried Mango on that side, clears the board at the top of its breathing.
const PG_HOME = {
  x: Math.ceil(PG_NOTES.x + NOTES_BOARD.halfW * PG_BREATHE + PG_WIDEST_HALF_W + PG_CARRY),
  feet: 1724
};
// Walkways. The pet walks along these ground lines (row 1, row 2, the track's
// edge) and gets between them only through the open gaps: past the end of the
// big slide (x 650) and down the woodchips right of Dad's note board (x 790).
const PG_WALK_Y = [PG_GROUND.row1, PG_GROUND.row2, PG_HOME.feet];
const PG_WALK_X = [650, 790];
// Where the pet hops the fence onto the field, from the woodchips side.
const PG_FENCE = { x: 650, feet: 700 };
// The tag game: the pet's size out on the field (it reads as far away), the
// band its feet stay in (clear of the top bubble, above the fence) and its x range.
const PG_FIELD = { scale: 0.65, feet: [588, 622], x0: 90, x1: 990 };

// Composite play tower: red posts, decks, green peaked roof, yellow panel, a
// ladder up the left bay and a railing along the top deck.
function drawPlayStructure(g) {
  g.fillStyle(0x000000, 0.18); g.fillEllipse(0, 200, 240, 30);
  g.fillStyle(0xd6342b, 1);
  for (const px of [-110, -40, 40, 110]) g.fillRect(px - 7, -150, 14, 350);
  g.fillStyle(0xe85a52, 1);
  for (const ry of [164, 128, 92, 56, -8]) g.fillRect(-103, ry, 56, 8);
  g.fillStyle(0x2f6ea0, 1); g.fillRoundedRect(-120, 20, 240, 26, 6);
  g.fillStyle(0x3aa0c0, 1); g.fillRect(-120, -30, 8, 50); g.fillRect(112, -30, 8, 50);
  g.fillStyle(0x2f8a4a, 1); g.fillTriangle(0, -210, -90, -150, 90, -150);
  g.fillStyle(0x37a257, 1); g.fillTriangle(0, -196, -70, -152, 70, -152);
  g.fillStyle(0xf2c43a, 1); g.fillRoundedRect(-30, 70, 60, 84, 8);
  g.fillStyle(0x2f6ea0, 1); for (const hx of [-16, 0, 16]) g.fillCircle(hx, 112, 6);
  drawTowerFront(g);
}

// The top deck and its railing (top rail at y -110): drawn with the tower, and
// again as the front piece the pet peeks over.
function drawTowerFront(g) {
  g.fillStyle(0x3a8044, 1); g.fillRoundedRect(-120, -60, 240, 24, 6);
  g.fillStyle(0x3aa0c0, 1);
  for (let bx = -108; bx <= 108; bx += 24) g.fillRect(bx - 3, -102, 6, 42);
  g.fillRoundedRect(-124, -110, 248, 10, 4);
}

// The big slide's chute, in the slide's own coordinates: a smoothstep
// centreline from the top platform down to the run-out lip, SLIDE_HALF wide on
// each side. Shared by the renderer and the pet's ride, so the ride stays in it.
const SLIDE_HALF = 30;
function slideAt(t) {
  return { x: -70 + 168 * t, y: -176 + 330 * (t * t * (3 - 2 * t)) };
}
function slideAngle(t) {
  const a = slideAt(Math.max(0, t - 0.001)), b = slideAt(Math.min(1, t + 0.001));
  return Math.atan2(b.y - a.y, b.x - a.x);
}
// Points along the chute `off` px to its upper side (negative: the near side).
function slideEdge(off, N = 26) {
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, c = slideAt(t), a = slideAngle(t);
    pts.push([c.x + Math.sin(a) * off, c.y - Math.cos(a) * off]);
  }
  return pts;
}
function fillBetweenEdges(g, a, b, color) {
  g.fillStyle(color, 1);
  g.beginPath(); g.moveTo(a[0][0], a[0][1]);
  for (const p of a) g.lineTo(p[0], p[1]);
  for (let i = b.length - 1; i >= 0; i--) g.lineTo(b[i][0], b[i][1]);
  g.closePath(); g.fillPath();
}
function strokeEdge(g, pts) {
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts) g.lineTo(p[0], p[1]);
  g.strokePath();
}

// A nice, thick playground slide: red ladder/tower on the left, a smooth wide
// blue chute sweeping down to the right with raised side rails + a run-out lip.
function drawWavySlide(g) {
  g.fillStyle(0x000000, 0.16); g.fillEllipse(30, 188, 210, 26);
  // ladder / tower posts + rungs
  g.fillStyle(0xd6342b, 1);
  g.fillRect(-118, -176, 14, 366);
  g.fillRect(-78, -176, 14, 366);
  g.fillStyle(0xe85a52, 1);
  for (let ry = -150; ry < 170; ry += 40) g.fillRect(-118, ry, 54, 9);
  // top platform
  g.fillStyle(0x2f6ea0, 1); g.fillRoundedRect(-126, -198, 96, 22, 5);

  // smooth thick chute: the centreline offset to its upper and lower edges
  const upper = slideEdge(SLIDE_HALF), lower = slideEdge(-SLIDE_HALF), inner = slideEdge(SLIDE_HALF * 0.4);
  fillBetweenEdges(g, upper, lower, 0x2f78c8);     // bed
  fillBetweenEdges(g, upper, inner, 0x6fb3ef);     // bright top surface
  // raised side rails
  g.lineStyle(8, 0x1f5a99, 1);
  strokeEdge(g, upper);
  strokeEdge(g, lower);
  // run-out lip
  g.fillStyle(0x2f6ea0, 1); g.fillRoundedRect(70, 150, 64, 16, 6);
}

// The chute's near half and near rail, the front piece the riding pet sits
// down behind.
function drawSlideFront(g) {
  const lower = slideEdge(-SLIDE_HALF);
  fillBetweenEdges(g, slideEdge(0), lower, 0x2f78c8);
  g.lineStyle(8, 0x1f5a99, 1);
  strokeEdge(g, lower);
}

// Tire swing: a red A-frame (this renderer) with a black tire on chains
// hanging from the top bar (drawTireSwingTire, in its own swinging piece).
// PG_TIRE: the pivot on the top bar, in the frame's coordinates, and how low
// the pet sits in the tire's hole, in the swinging piece's.
const PG_TIRE = { pivotY: -146, seatY: 248 };
function drawTireSwingFrame(g) {
  g.fillStyle(0x000000, 0.16); g.fillEllipse(0, 182, 150, 24);
  g.lineStyle(14, 0xd6342b, 1);
  g.lineBetween(-104, 176, -46, -148);     // splayed legs
  g.lineBetween(104, 176, 46, -148);
  g.lineStyle(15, 0xc02d24, 1);
  g.lineBetween(-58, -150, 58, -150);       // top bar
}

// Chains from one swivel on the top bar down to the tire (hole shows woodchips).
// Origin at the pivot; the tire's center is 228 below it.
function drawTireSwingTire(g) {
  const cy = 228;
  g.lineStyle(4, 0x8a8a96, 1);
  g.lineBetween(0, 2, -22, cy - 50);
  g.lineBetween(0, 2, 22, cy - 50);
  g.lineBetween(0, 2, 0, cy - 56);
  g.fillStyle(0x6a6a74, 1); g.fillCircle(0, 2, 6);
  g.fillStyle(0x17171c, 1); g.fillCircle(0, cy, 56);        // tire
  g.fillStyle(0xc7a06a, 1); g.fillCircle(0, cy, 28);        // hole → woodchips
  g.fillStyle(0x0d0d11, 1);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillCircle(Math.cos(a) * 47, cy + Math.sin(a) * 47, 4.5); }
  g.lineStyle(3, 0x39393f, 1); g.strokeCircle(0, cy, 56); g.strokeCircle(0, cy, 28);
  g.fillStyle(0xffffff, 0.12); g.fillEllipse(-18, cy - 18, 26, 12);
}

// The tire's lower half, the front piece the pet sits down behind.
function drawTireFront(g) {
  const cy = 228;
  g.fillStyle(0x17171c, 1);
  g.beginPath();
  g.arc(0, cy, 56, 0, Math.PI, false);
  g.arc(0, cy, 28, Math.PI, 0, true);
  g.closePath(); g.fillPath();
  g.fillStyle(0x0d0d11, 1);
  for (let i = 1; i < 6; i++) { const a = i / 12 * Math.PI * 2; g.fillCircle(Math.cos(a) * 47, cy + Math.sin(a) * 47, 4.5); }
  g.lineStyle(3, 0x39393f, 1);
  g.beginPath(); g.arc(0, cy, 56, 0, Math.PI, false); g.strokePath();
  g.beginPath(); g.arc(0, cy, 28, 0, Math.PI, false); g.strokePath();
}

// Full-width blue running track band along the bottom (drawn on the backdrop).
function drawRunningTrack(bg, top) {
  const h = H - top;
  bg.fillStyle(0x2f78c8, 1); bg.fillRect(0, top, W, h);
  bg.fillStyle(0x3a86d8, 1); bg.fillRect(0, top, W, 24);
  bg.fillStyle(0x2769b0, 0.5); bg.fillRect(0, H - 38, W, 38);
  // lane lines
  bg.lineStyle(5, 0xf4f8ff, 0.9);
  for (let i = 1; i < 4; i++) bg.lineBetween(0, top + h * i / 4, W, top + h * i / 4);
  bg.lineStyle(6, 0xf4f8ff, 0.95); bg.lineBetween(0, top + 7, W, top + 7);
  // scattered autumn leaves
  for (const [lx, ly, lc] of [[260, top + 40, 0xd9772f], [620, top + 110, 0xc94f2a], [900, top + 60, 0xe0a23a], [990, top + 130, 0xd9772f], [380, top + 140, 0xe0a23a]]) {
    bg.fillStyle(lc, 0.9); bg.fillEllipse(lx, ly, 13, 8);
  }
}

// Yellow + blue wavy climbing wall with colorful holds, red frame posts.
function drawClimbingWall(g) {
  g.fillStyle(0x000000, 0.16); g.fillEllipse(0, 142, 150, 22);
  g.fillStyle(0xd6342b, 1); g.fillRect(-92, -130, 12, 272); g.fillRect(80, -130, 12, 272);
  g.fillStyle(0xf2c43a, 1); g.fillRoundedRect(-78, -120, 78, 250, 10);
  g.fillStyle(0x2f78c8, 1); g.fillRoundedRect(0, -120, 78, 250, 10);
  const holds = [[-50, -80, 0xff5b6e], [-20, -20, 0x39b54a], [-55, 40, 0x6a4ec0], [-25, 100, 0xff8b3d],
    [30, -70, 0xf2c43a], [55, -10, 0xff5b6e], [20, 60, 0xffffff], [50, 110, 0x39b54a]];
  for (const [hx, hy, hc] of holds) { g.fillStyle(hc, 1); g.fillCircle(hx, hy, 9); g.fillStyle(0xffffff, 0.5); g.fillCircle(hx - 2, hy - 2, 3); }
}

// The climbing wall's holds the pet climbs, bottom to top (hold centers from
// drawClimbingWall).
const PG_WALL_HOLDS = [[-25, 100], [20, 60], [-55, 40], [-20, -20], [55, -10], [30, -70], [-50, -80]];

// Zip line: two red end posts and the rail (this renderer), with a trolley,
// ropes and a grip bar that roll along it (the pieces below, in trolley
// coordinates, origin on the rail). The right post is taller, so the rail runs
// downhill to the left and rides go right to left: from rest at the high end
// (restX) to the stop at the low end (stopX). gripX/gripY: the grip's middle.
const PG_ZIP = { restX: 84, stopX: -84, gripX: 0, gripY: 93 };
function zipRailY(x) {
  return -76 - 32 * (x + 122) / 244;
}
function drawZipLineFrame(g) {
  g.fillStyle(0x000000, 0.16); g.fillEllipse(0, 110, 220, 22);
  g.fillStyle(0xd6342b, 1); g.fillRect(-128, -86, 14, 196); g.fillRect(114, -118, 14, 228);
  g.fillStyle(0xc02d24, 1); g.fillRect(-128, -86, 14, 30); g.fillRect(114, -118, 14, 30);
  // top rail / cable
  g.lineStyle(7, 0x7a828c, 1); g.lineBetween(-122, zipRailY(-122), 122, zipRailY(122));
  g.lineStyle(2, 0xb6bcc4, 1); g.lineBetween(-122, zipRailY(-122) - 3, 122, zipRailY(122) - 3);
}
function drawZipTrolley(g) {
  g.fillStyle(0x3a3f47, 1); g.fillRoundedRect(-28, -14, 56, 20, 5);
  g.fillStyle(0x9aa0aa, 1); g.fillCircle(-15, 4, 6); g.fillCircle(15, 4, 6);
}
function drawZipRopes(g) {
  g.lineStyle(5, 0x2f6ea0, 1); g.lineBetween(-13, 6, -16, 86); g.lineBetween(13, 6, 16, 86);
}
function drawZipGrip(g) {
  g.fillStyle(0xf2c43a, 1); g.fillRoundedRect(-30, 84, 60, 18, 9);
  g.lineStyle(3, 0xd99a1f, 1); g.strokeRoundedRect(-30, 84, 60, 18, 9);
}

// Spinner: a red post (this renderer) under a blue disc (drawSpinnerDisc). The
// disc is seen from the side, so it turns by its grip dots running round the
// rim (drawSpinnerDots), never by rotating the picture.
function drawSpinnerPost(g) {
  g.fillStyle(0x000000, 0.16); g.fillEllipse(0, 95, 90, 18);
  g.fillStyle(0xd6342b, 1); g.fillRect(-8, -10, 16, 105);
}
function drawSpinnerDisc(g) {
  g.fillStyle(0x1f5a99, 1); g.fillEllipse(0, -10, 120, 20);
  g.fillStyle(0x2f78c8, 1); g.fillEllipse(0, -22, 120, 40);
  g.fillStyle(0x3a86d8, 1); g.fillEllipse(0, -28, 110, 30);
  g.fillStyle(0xffffff, 0.4); g.fillEllipse(-24, -32, 40, 12);
}
// Three grip dots round the disc's top at turn `a` (radians); the near side's
// dots are bigger and brighter.
function drawSpinnerDots(g, a) {
  g.clear();
  for (let i = 0; i < 3; i++) {
    const b = a + i * Math.PI * 2 / 3;
    const near = Math.sin(b) > 0;
    g.fillStyle(i === 1 ? 0xf2c43a : 0xff5b6e, near ? 1 : 0.7);
    g.fillCircle(Math.cos(b) * 44, -28 + Math.sin(b) * 10, near ? 6 : 4.5);
  }
}

// Dad's note board: a parchment notice board on two wooden posts. Headers and
// the "Tap to read" affordance are added as text by createNotesBoard, at the
// NOTES_BOARD positions.
function drawDadNotesBoard(g) {
  const { halfW, top, bottom, dividerY } = NOTES_BOARD;
  const inset = 14;
  const px = -halfW + inset, pw = (halfW - inset) * 2;
  const pTop = top + inset, pBottom = bottom - inset;
  // ground shadow
  g.fillStyle(0x000000, 0.16); g.fillEllipse(0, 124, 190, 24);
  // posts
  const postH = 124 - bottom + 4;
  g.fillStyle(0x6e4a28, 1); g.fillRect(-90, bottom - 4, 16, postH); g.fillRect(74, bottom - 4, 16, postH);
  g.fillStyle(0x855c34, 1); g.fillRect(-90, bottom - 4, 5, postH); g.fillRect(74, bottom - 4, 5, postH);
  // dark wood frame
  g.fillStyle(0x5e3d22, 1); g.fillRoundedRect(-halfW, top, halfW * 2, bottom - top, 12);
  g.fillStyle(0x7a5230, 1); g.fillRoundedRect(-halfW, top, halfW * 2, 9, 6);
  // parchment surface
  g.fillStyle(0xf5ecd6, 1); g.fillRoundedRect(px, pTop, pw, pBottom - pTop, 6);
  g.fillStyle(0xe9dcbd, 1); g.fillRect(px, pBottom - 14, pw, 14);
  // divider under the header
  g.fillStyle(0xcdbf9a, 1); g.fillRect(-118, dividerY, 236, 3);
  // two red thumbtacks, pinning the lower corners (the header spans the top)
  for (const tx of [-halfW + 34, halfW - 34]) {
    g.fillStyle(0xc23a3a, 1); g.fillCircle(tx, pBottom - 24, 6);
    g.fillStyle(0xff9a9a, 0.85); g.fillCircle(tx - 2, pBottom - 26, 2.2);
  }
}

// Monkey bars: the hidden gem. Horizontal overhead ladder on tall red posts.
// The pet swings along these rungs (x) hanging from the lower rail.
const PG_BAR_RUNGS = [-140, -100, -60, -20, 20, 60, 100, 140];
function drawMonkeyBars(g) {
  g.fillStyle(0x000000, 0.18); g.fillEllipse(0, 172, 300, 28);
  g.fillStyle(0xd6342b, 1); g.fillRect(-160, -120, 16, 290); g.fillRect(144, -120, 16, 290);
  g.fillStyle(0xd6342b, 1); g.fillRect(-160, -120, 320, 14); g.fillRect(-160, -98, 320, 10);
  g.fillStyle(0xe85a52, 1);
  for (const rx of PG_BAR_RUNGS) g.fillRect(rx - 5, -118, 10, 30);
  g.fillStyle(0xfff3b8, 0.9); g.fillCircle(0, -150, 4); g.fillCircle(70, -140, 3); g.fillCircle(-80, -138, 3);
}

// The lower rail and the rungs' ends on it: the front piece the hanging pet's
// hands go behind.
function drawMonkeyBarsFront(g) {
  g.fillStyle(0xd6342b, 1); g.fillRect(-160, -98, 320, 10);
  g.fillStyle(0xe85a52, 1);
  for (const rx of PG_BAR_RUNGS) g.fillRect(rx - 5, -98, 10, 10);
}

// Small map icon for the "King Coli" germ boss — a round green germ head with
// a tiny gold crown and a smug face. Modelled on drawGarageNode's structure.
export function drawKingColiNode(scene, x, y, R) {
  const c = scene.add.container(x, y);

  // Soft sickly-green halo.
  const halo = scene.add.graphics();
  halo.fillStyle(0x8ddf5a, 0.18);
  halo.fillCircle(0, 0, R + 14);
  c.add(halo);

  const g = scene.add.graphics();
  // Germ body — round green blob with a few pseudopod bumps around the rim.
  g.fillStyle(0x5fae3a, 1);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    g.fillCircle(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9, R * 0.22);
  }
  g.fillStyle(0x6cc043, 1);
  g.fillCircle(0, 0, R * 0.92);
  // Shading crescent lower-right.
  g.fillStyle(0x3f8a28, 0.4);
  g.fillCircle(R * 0.2, R * 0.22, R * 0.85);
  // Belly highlight.
  g.fillStyle(0xa6e87a, 0.5);
  g.fillEllipse(-R * 0.3, -R * 0.32, R * 0.6, R * 0.34);
  // Little flagella tails.
  g.lineStyle(3, 0x4f9630, 1);
  g.lineBetween(-R * 0.7, R * 0.6, -R * 1.15, R * 0.95);
  g.lineBetween(R * 0.6, R * 0.7, R * 1.05, R * 1.05);
  c.add(g);

  // Smug face.
  const face = scene.add.graphics();
  face.fillStyle(0x0c2a08, 1);
  // Half-lidded eyes.
  face.fillEllipse(-R * 0.3, -R * 0.05, R * 0.22, R * 0.16);
  face.fillEllipse(R * 0.3, -R * 0.05, R * 0.22, R * 0.16);
  face.fillStyle(0x0c2a08, 1);
  face.lineStyle(3, 0x0c2a08, 1);
  // Smirk.
  face.beginPath();
  face.moveTo(-R * 0.28, R * 0.32);
  face.lineTo(R * 0.05, R * 0.42);
  face.lineTo(R * 0.34, R * 0.24);
  face.strokePath();
  c.add(face);

  // Tiny gold crown.
  const crown = scene.add.graphics();
  crown.fillStyle(0xffd24a, 1);
  const cw = R * 0.9, cy = -R * 0.78, ch = R * 0.42;
  crown.fillRect(-cw / 2, cy, cw, ch * 0.55);
  // Three points.
  crown.fillTriangle(-cw / 2, cy, -cw / 2 + cw / 3, cy, -cw / 2 + cw / 6, cy - ch * 0.7);
  crown.fillTriangle(-cw / 6, cy, cw / 6, cy, 0, cy - ch * 0.85);
  crown.fillTriangle(cw / 2 - cw / 3, cy, cw / 2, cy, cw / 2 - cw / 6, cy - ch * 0.7);
  // Jewels.
  crown.fillStyle(0xff5b6e, 1);
  crown.fillCircle(0, cy + ch * 0.28, R * 0.09);
  crown.fillStyle(0x4a90d9, 1);
  crown.fillCircle(-cw * 0.28, cy + ch * 0.28, R * 0.07);
  crown.fillCircle(cw * 0.28, cy + ch * 0.28, R * 0.07);
  // Crown shine.
  crown.fillStyle(0xfff0b0, 0.7);
  crown.fillRect(-cw / 2 + 2, cy + 2, cw - 4, 2);
  c.add(crown);

  return c;
}

// Small map icon evoking the playground / track — a blue running-track loop
// with a green infield and a tiny red slide. Returns the container.
export function drawPlaygroundNode(scene, x, y, R) {
  const c = scene.add.container(x, y);
  const cleared = progress.isHiddenWorldCleared(18);

  // Warm halo — brighter once "RECESS" has been found.
  const halo = scene.add.graphics();
  halo.fillStyle(0x7ed957, cleared ? 0.26 : 0.14);
  halo.fillCircle(0, 0, R + (cleared ? 16 : 12));
  c.add(halo);

  const g = scene.add.graphics();
  // Blue oval track.
  g.fillStyle(0x2f78c8, 1);
  g.fillEllipse(0, R * 0.12, R * 1.9, R * 1.4);
  // Green infield turf.
  g.fillStyle(0x57b94e, 1);
  g.fillEllipse(0, R * 0.12, R * 1.1, R * 0.7);
  // White lane line on the track.
  g.lineStyle(2, 0xf4f8ff, 0.9);
  g.strokeEllipse(0, R * 0.12, R * 1.5, R * 1.05);
  c.add(g);

  // A tiny red slide rising from the infield.
  const slide = scene.add.graphics();
  // Ladder posts.
  slide.fillStyle(0xe23b3b, 1);
  slide.fillRect(R * 0.45, -R * 0.55, R * 0.12, R * 0.85);
  slide.fillRect(R * 0.7, -R * 0.55, R * 0.12, R * 0.85);
  // Rungs.
  slide.fillStyle(0xc62f2f, 1);
  for (let i = 0; i < 3; i++) slide.fillRect(R * 0.45, -R * 0.4 + i * R * 0.22, R * 0.37, R * 0.06);
  // Blue slide chute curving down-left.
  slide.fillStyle(0x3a86d8, 1);
  slide.beginPath();
  slide.moveTo(R * 0.5, -R * 0.5);
  slide.lineTo(R * 0.62, -R * 0.5);
  slide.lineTo(-R * 0.5, R * 0.35);
  slide.lineTo(-R * 0.66, R * 0.22);
  slide.closePath();
  slide.fillPath();
  // Slide lip highlight.
  slide.fillStyle(0x9fd0ff, 0.8);
  slide.fillRect(-R * 0.66, R * 0.18, R * 0.18, R * 0.06);
  c.add(slide);

  // Cleared: small green check badge at the corner.
  if (cleared) {
    const badge = scene.add.graphics();
    badge.fillStyle(0x0a2a12, 1);
    badge.fillCircle(R * 0.78, -R * 0.78, R * 0.3);
    badge.lineStyle(3, 0x7ed957, 1);
    badge.beginPath();
    badge.moveTo(R * 0.78 - R * 0.14, -R * 0.78);
    badge.lineTo(R * 0.78 - R * 0.03, -R * 0.67);
    badge.lineTo(R * 0.78 + R * 0.16, -R * 0.92);
    badge.strokePath();
    c.add(badge);
  }

  return c;
}

// ============================================================
// HOT POT TIME — map node + item renderers (W19).
// Item helpers draw a fresh Graphics `g` centered at (0,0), same contract as
// the garage and playground renderers above. Plain shapes only: individual
// round bowls, straight-edged stations, no divided pot, no radial art.
// ============================================================

// Map node: a single round bowl of broth under a warm halo, steam curling off.
// Once the room has been found (the free cone claimed) the broth glows and a
// little number tag leans against the bowl.
export function drawHotPotNode(scene, x, y, R) {
  const c = scene.add.container(x, y);
  const cleared = progress.isHiddenWorldCleared(19);

  // Warm halo — brighter once the room has been cleared.
  const halo = scene.add.graphics();
  halo.fillStyle(0xffb85c, cleared ? 0.28 : 0.14);
  halo.fillCircle(0, 0, R + (cleared ? 18 : 13));
  c.add(halo);

  const g = scene.add.graphics();
  // Placemat / tabletop disc under the bowl.
  g.fillStyle(0x6b4632, 1);
  g.fillEllipse(0, R * 0.5, R * 1.9, R * 0.7);
  // Bowl body — a plain round bowl, tapering to a foot.
  g.fillStyle(0xf2ece0, 1);
  g.fillEllipse(0, R * 0.1, R * 1.6, R * 1.25);
  g.fillStyle(0xd8cfbe, 1);
  g.fillRect(-R * 0.28, R * 0.55, R * 0.56, R * 0.22);
  // Broth surface.
  g.fillStyle(cleared ? 0xd4552e : 0xa8452a, 1);
  g.fillEllipse(0, -R * 0.28, R * 1.32, R * 0.5);
  g.fillStyle(0xffb85c, cleared ? 0.55 : 0.35);
  g.fillEllipse(-R * 0.2, -R * 0.34, R * 0.5, R * 0.18);
  // A couple of things floating in it (corn, greens) — plain dots and ovals.
  g.fillStyle(0xffd86b, 1);
  g.fillCircle(R * 0.28, -R * 0.26, R * 0.09);
  g.fillCircle(R * 0.44, -R * 0.32, R * 0.07);
  g.fillStyle(0x5e9a45, 1);
  g.fillEllipse(-R * 0.36, -R * 0.2, R * 0.3, R * 0.13);
  // Bowl rim.
  g.lineStyle(3, 0xb9ae9a, 1);
  g.strokeEllipse(0, -R * 0.28, R * 1.32, R * 0.5);
  c.add(g);

  // Steam — two soft plain ellipses drifting up (never rays or spirals).
  const steam = scene.add.graphics();
  steam.fillStyle(0xffe8c8, 0.42);
  steam.fillEllipse(-R * 0.22, -R * 0.75, R * 0.42, R * 0.24);
  steam.fillStyle(0xffe8c8, 0.26);
  steam.fillEllipse(R * 0.2, -R * 1.05, R * 0.52, R * 0.28);
  c.add(steam);
  scene.tweens.add({
    targets: steam,
    y: -R * 0.35,
    alpha: { from: 1, to: 0.25 },
    duration: 2600,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });

  // Cleared: the table number tag leans against the bowl.
  if (cleared) {
    const tag = scene.add.graphics();
    tag.fillStyle(0xf5e2b8, 1);
    // Wide enough for two digits (the number is 83).
    tag.fillRoundedRect(R * 0.5, -R * 0.05, R * 0.74, R * 0.62, 4);
    tag.lineStyle(2, 0x8a5a3c, 1);
    tag.strokeRoundedRect(R * 0.5, -R * 0.05, R * 0.74, R * 0.62, 4);
    c.add(tag);
    // Lettering on a tiny prop (the room itself shows 83 large): art, sized to
    // the tag rather than to the type floor, which would burst it.
    c.add(scene.add.text(R * 0.87, R * 0.26, '83', style('caption', {
      fontSize: Math.round(R * 0.38) + 'px', fill: '#8a3a1e', fontStyle: '900', art: true
    })).setOrigin(0.5));
  }

  return c;
}

// 1. The stack of empty bowls at the door: four nested plain round bowls. The
// top bowl and the chopsticks are their own pieces so the idle pass can lift
// one out of the stack and rattle the sticks.
function drawBowlStack(g, node, scene) {
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(6, 78, 190, 34);
  const bowl = (gg, oy, w, tone) => {
    gg.fillStyle(tone, 1);
    gg.fillEllipse(0, oy, w, 58);
    gg.fillStyle(0xd3c9b6, 1);
    gg.fillEllipse(0, oy - 14, w - 18, 30);
    gg.lineStyle(2, 0xb9ae9a, 0.9);
    gg.strokeEllipse(0, oy - 14, w - 18, 30);
  };
  // Bottom three, lowest painted last so each rim sits in front of the bowl above.
  for (let i = 2; i >= 0; i--) bowl(g, 46 - i * 26, 168 - i * 6, i % 2 ? 0xece4d6 : 0xf7f1e6);
  // Chopstick cup beside the stack.
  g.fillStyle(0x7a4a30, 1);
  g.fillRoundedRect(74, -6, 44, 74, 6);

  if (!scene) return;
  // Top bowl goes UNDER the base graphic (index 0) so, lifted, it rises out
  // from behind the rim of the bowl below instead of floating over it.
  const topBowl = scene.add.graphics();
  bowl(topBowl, -32, 150, 0xece4d6);
  node.addAt(topBowl, 0);
  // Chopsticks pivot at the cup mouth (100, 10) so a wiggle reads as a rattle.
  const chopsticks = scene.add.graphics();
  chopsticks.fillStyle(0xd9b382, 1);
  for (let i = 0; i < 3; i++) chopsticks.fillRect(-18 + i * 12, -56, 5, 46);
  chopsticks.setPosition(100, 10);
  node.add(chopsticks);
  node.hpParts = { topBowl, chopsticks };
}

// A pair of serving tongs, hinge at the top, open V, drawn centred on (0,0).
function drawTongs(g, color = 0xd0d0d8) {
  g.lineStyle(4, color, 1);
  g.lineBetween(0, -16, -9, 14);
  g.lineBetween(0, -16, 9, 14);
  g.fillStyle(color, 1);
  g.fillCircle(0, -16, 4);
  g.fillRect(-13, 12, 8, 4);
  g.fillRect(5, 12, 8, 4);
}

// 2. The long ingredient line, the signature object of the room. A stainless
// self-serve counter: steel pans sunk into the top, each heaped with one thing,
// tongs resting on every pan, a sneeze guard over the lot. Eight bins on a 78px
// pitch from x = -312; the heaps and tongs are separate pieces so the idle pass
// (and the pet walking the line) can serve from them.
function drawIngredientLine(g, node, scene) {
  const w = 660;
  // Ground shadow, then the counter: brushed top rail, panelled front, kick plate.
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(-w / 2 + 8, -46, w, 140, 12);
  g.fillStyle(0x8e8e9a, 1);
  g.fillRoundedRect(-w / 2, -62, w, 148, 12);
  g.fillStyle(0xb9b9c4, 1);
  g.fillRect(-w / 2, -62, w, 20);
  g.fillStyle(0xd6d6de, 1);
  g.fillRect(-w / 2, -62, w, 5);
  g.fillStyle(0x9d9daa, 1);
  for (let i = 0; i < 4; i++) g.fillRoundedRect(-w / 2 + 14 + i * 160, -30, 140, 96, 6);
  g.fillStyle(0x5c5c68, 1);
  for (let i = 0; i < 4; i++) g.fillRoundedRect(-w / 2 + 70 + i * 160, 12, 28, 6, 3);
  g.fillStyle(0x3d3d48, 1);
  g.fillRect(-w / 2, 76, w, 10);

  // Sneeze guard: two posts, a top rail, a pane of glass over the bins.
  g.fillStyle(0xb9b9c4, 1);
  g.fillRect(-w / 2 + 2, -116, 7, 60);
  g.fillRect(w / 2 - 9, -116, 7, 60);
  g.fillRoundedRect(-w / 2 - 4, -120, w + 8, 8, 3);
  g.fillStyle(0xe6f6ff, 0.14);
  g.fillRect(-w / 2 + 9, -112, w - 18, 52);
  g.fillStyle(0xffffff, 0.35);
  g.fillRect(-w / 2 + 9, -112, w - 18, 3);

  const heapDrawers = [
    drawHeapGreens, drawHeapMushrooms, drawHeapFishballs, drawHeapMeatRolls,
    drawHeapTofu, drawHeapNoodles, drawHeapCorn, drawHeapAssorted
  ];
  const heaps = [], tongs = [];
  heapDrawers.forEach((drawHeap, i) => {
    const bx = -273 + i * 78;
    // Steel pan: rim, then the dark interior the food sits in.
    g.fillStyle(0xd0d0d8, 1);
    g.fillRoundedRect(bx - 38, -56, 76, 62, 6);
    g.fillStyle(0x3a3a46, 1);
    g.fillRoundedRect(bx - 34, -52, 68, 54, 5);
    // Little label card on the glass above each pan.
    g.fillStyle(0xfff8ea, 0.9);
    g.fillRoundedRect(bx - 17, -98, 34, 14, 3);
    g.fillStyle(0x6a5a44, 0.8);
    g.fillRect(bx - 12, -92, 24, 2);

    if (!scene) { drawHeap(g, bx, 2); return; }
    // Heap origin at the pan floor so a jiggle squashes down into the pan.
    const heap = scene.add.graphics();
    heap.setPosition(bx, 2);
    drawHeap(heap, 0, 0);
    node.add(heap);
    heaps.push(heap);
    // Tongs resting over the front rim.
    const t = scene.add.graphics();
    drawTongs(t, 0x5c5c68);
    t.setPosition(bx + 22, -6).setScale(0.8);
    node.add(t);
    tongs.push(t);
  });
  if (!scene) return;

  // The light that slides along the glass (driven by _lineService).
  const sheen = scene.add.graphics();
  sheen.fillStyle(0xffffff, 1);
  sheen.fillRect(-16, -112, 32, 52);
  sheen.setPosition(-300, 0).setAlpha(0);
  node.add(sheen);

  node.hpParts = { heaps, tongs, sheen };
}

// Bin contents. Each mound is drawn around (x, y - 30): the pan floor is at
// (x, y), the pan's back rim ~18px above that, so the food heaps up over it.
// Plain shapes only: ellipses, circles, rects, a few straight strokes.
function drawHeapGreens(g, x, y) {
  g.translateCanvas(x, y - 30);
  g.fillStyle(0x3f7a2e, 1);
  g.fillEllipse(0, 8, 66, 40);
  const leaves = [
    [-20, -2, 26, 20, 0x5fa542], [14, -8, 28, 22, 0x6db54d], [-4, -20, 26, 18, 0x86cc5e],
    [22, 8, 22, 16, 0x4f9137], [-24, 12, 22, 14, 0x5fa542], [2, 0, 22, 16, 0x86cc5e],
    [12, 16, 24, 14, 0x6db54d]
  ];
  for (const [lx, ly, lw, lh, c] of leaves) { g.fillStyle(c, 1); g.fillEllipse(lx, ly, lw, lh); }
  g.fillStyle(0xdcefc2, 1);
  g.fillRect(-12, -14, 4, 14);
  g.fillRect(6, -4, 4, 12);
  g.fillRect(-2, 10, 4, 10);
  g.translateCanvas(-x, -(y - 30));
}

function drawHeapMushrooms(g, x, y) {
  g.translateCanvas(x, y - 30);
  // Enoki: a tight bundle of thin stems with tiny caps, banded at the base.
  g.fillStyle(0xf3ead6, 1);
  for (let i = 0; i < 7; i++) g.fillRect(-32 + i * 4, -14 + (i % 3) * 3, 3, 34);
  g.fillStyle(0xfbf5e8, 1);
  for (let i = 0; i < 7; i++) g.fillCircle(-30.5 + i * 4, -15 + (i % 3) * 3, 3);
  g.fillStyle(0xd9c9a8, 1);
  g.fillRect(-34, 8, 30, 5);
  // Shiitake: three brown caps, plus one turned over showing its pale underside.
  const cap = (cx, cy, cw, ch) => {
    g.fillStyle(0x6f4a30, 1); g.fillEllipse(cx, cy, cw, ch);
    g.fillStyle(0x8c6244, 1); g.fillEllipse(cx - 2, cy - 3, cw * 0.6, ch * 0.5);
  };
  cap(12, 2, 30, 20);
  cap(24, 14, 26, 18);
  cap(4, 16, 24, 16);
  g.fillStyle(0xe8dcc4, 1);
  g.fillEllipse(20, -12, 22, 14);
  g.fillStyle(0xcdbb9a, 1);
  g.fillEllipse(20, -12, 8, 5);
  g.translateCanvas(-x, -(y - 30));
}

function drawHeapFishballs(g, x, y) {
  g.translateCanvas(x, y - 30);
  const rows = [[14, [-27, -9, 9, 27]], [2, [-18, 0, 18]], [-10, [-9, 9]], [-22, [0]]];
  for (const [ry, xs] of rows) {
    for (const bx of xs) {
      g.fillStyle(0xd9d0bf, 1); g.fillCircle(bx + 2, ry + 2, 9);
      g.fillStyle(0xf4eee2, 1); g.fillCircle(bx, ry, 9);
      g.fillStyle(0xffffff, 0.8); g.fillCircle(bx - 3, ry - 3, 2.5);
    }
  }
  g.translateCanvas(-x, -(y - 30));
}

function drawHeapMeatRolls(g, x, y) {
  g.translateCanvas(x, y - 30);
  // Rolled slices seen from the side: a pink log with a fat streak and the
  // rolled end showing as a lighter ring.
  const roll = (rx, ry) => {
    g.fillStyle(0xe27c73, 1); g.fillRoundedRect(rx - 13, ry - 7, 26, 14, 6);
    g.fillStyle(0xf9d6cf, 1); g.fillRect(rx - 9, ry - 2, 18, 3);
    g.fillStyle(0xf2a49a, 1); g.fillCircle(rx + 13, ry, 7);
    g.fillStyle(0xfae2dd, 1); g.fillCircle(rx + 13, ry, 3);
  };
  // Bottom row sits left so the right-hand end cap stays inside the pan.
  roll(-24, 14); roll(-2, 14); roll(18, 14);
  roll(-11, 2); roll(11, 2);
  roll(0, -10);
  g.translateCanvas(-x, -(y - 30));
}

function drawHeapTofu(g, x, y) {
  g.translateCanvas(x, y - 30);
  const cube = (cx, cy) => {
    g.fillStyle(0xd4c9b2, 1); g.fillRect(cx - 11, cy - 11, 22, 22);
    g.fillStyle(0xf6efe0, 1); g.fillRect(cx - 11, cy - 11, 19, 19);
  };
  cube(-24, 12); cube(0, 12); cube(24, 12);
  cube(-12, -8); cube(12, -8);
  cube(0, -26);
  g.translateCanvas(-x, -(y - 30));
}

function drawHeapNoodles(g, x, y) {
  g.translateCanvas(x, y - 30);
  // Nests: a pale mound with two nested rings (concentric, not a spiral) and a
  // strand or two hanging over the edge.
  const nest = (nx, ny) => {
    g.fillStyle(0xf0d99a, 1); g.fillEllipse(nx, ny, 32, 20);
    g.lineStyle(2, 0xd4b46a, 1);
    g.strokeEllipse(nx, ny, 24, 13);
    g.strokeEllipse(nx, ny, 13, 7);
    g.lineBetween(nx - 14, ny + 2, nx - 20, ny + 10);
    g.lineBetween(nx + 12, ny + 4, nx + 18, ny + 11);
  };
  nest(-17, 10); nest(17, 10); nest(0, -8);
  g.translateCanvas(-x, -(y - 30));
}

function drawHeapCorn(g, x, y) {
  g.translateCanvas(x, y - 30);
  const cob = (cx, cy) => {
    g.fillStyle(0xf7c948, 1); g.fillRoundedRect(cx - 8, cy - 18, 16, 36, 6);
    g.fillStyle(0xe0aa2a, 1);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) g.fillCircle(cx - 5 + c * 5, cy - 13 + r * 6.5, 1.6);
    g.fillStyle(0xfbe08a, 1); g.fillEllipse(cx, cy - 18, 12, 6);
  };
  cob(-20, 6); cob(0, -2); cob(20, 8);
  g.fillStyle(0xf7c948, 1);
  g.fillCircle(-30, 24, 3); g.fillCircle(30, 22, 3); g.fillCircle(8, 26, 3);
  g.translateCanvas(-x, -(y - 30));
}

function drawHeapAssorted(g, x, y) {
  g.translateCanvas(x, y - 30);
  // Lotus root slice with its holes.
  g.fillStyle(0xf2e8d2, 1); g.fillCircle(-16, 6, 12);
  g.fillStyle(0xd9cdb2, 1);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    g.fillCircle(-16 + Math.cos(a) * 6.5, 6 + Math.sin(a) * 6.5, 2);
  }
  g.fillCircle(-16, 6, 2);
  // Quail eggs, speckled.
  for (const [ex, ey] of [[14, -16], [26, -2]]) {
    g.fillStyle(0xf7f0e0, 1); g.fillEllipse(ex, ey, 11, 14);
    g.fillStyle(0xa88b6a, 1);
    g.fillCircle(ex - 2, ey - 3, 1.2); g.fillCircle(ex + 2, ey + 2, 1.2); g.fillCircle(ex - 1, ey + 4, 1);
  }
  // A dumpling, crimped along the top.
  g.fillStyle(0xf3e6cf, 1); g.fillEllipse(12, 16, 26, 14);
  g.fillStyle(0xe2d1b3, 1);
  for (let k = 0; k < 4; k++) g.fillCircle(3 + k * 6, 11, 2.2);
  // A red chili with a green stem.
  g.fillStyle(0xd83a2a, 1); g.fillEllipse(-4, -14, 20, 7);
  g.fillStyle(0x5e9a45, 1); g.fillRect(5, -16, 6, 4);
  // A chunk of pumpkin.
  g.fillStyle(0xf0a23a, 1); g.fillRoundedRect(-32, -10, 18, 13, 4);
  g.fillStyle(0xf8c67a, 1); g.fillRect(-29, -8, 12, 3);
  g.translateCanvas(-x, -(y - 30));
}

// 3. The cashier scale — you pay by weight. A platform, a post, and a dial.
// (The needle itself is added live by _scaleSettle so it can swing.)
function drawCounterScale(g) {
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(6, 92, 190, 30);
  // Base + platform.
  g.fillStyle(0x5a5a64, 1);
  g.fillRoundedRect(-88, 52, 176, 34, 8);
  g.fillStyle(0xc9c3bb, 1);
  g.fillRoundedRect(-96, 34, 192, 24, 8);
  // A bowl sitting on the platform, waiting to be weighed.
  g.fillStyle(0xf7f1e6, 1);
  g.fillEllipse(0, 16, 122, 44);
  g.fillStyle(0xc85a4a, 1);
  g.fillEllipse(0, 4, 100, 24);
  g.lineStyle(2, 0xb9ae9a, 1);
  g.strokeEllipse(0, 4, 100, 24);
  // Post + round dial face (plain circle + tick marks, not a sunburst).
  g.fillStyle(0x5a5a64, 1);
  g.fillRect(-8, -34, 16, 60);
  g.fillStyle(0x3a3a44, 1);
  g.fillCircle(0, -62, 52);
  g.fillStyle(0xf7f1e6, 1);
  g.fillCircle(0, -62, 44);
  g.fillStyle(0x8a8a96, 1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    g.fillCircle(Math.cos(a) * 34, -62 + Math.sin(a) * 34, 2.5);
  }
  g.fillStyle(0x3a3a44, 1);
  g.fillCircle(0, -62, 5);
}

// 4. Broth + spice level — two INDIVIDUAL urns (never one divided pot), plus a
// mild-to-spicy dial. Individual bowls is the format, so no S-curve divider.
function drawBrothStation(g) {
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(-124, 66, 260, 26, 10);
  // Counter.
  g.fillStyle(0x8d6a4a, 1);
  g.fillRoundedRect(-130, 46, 260, 40, 10);
  g.fillStyle(0xa8815c, 1);
  g.fillRect(-130, 46, 260, 10);

  // Two urns side by side: clear broth on the left, spicy on the right.
  const urn = (ox, body, lid) => {
    g.fillStyle(0x8f8f9c, 1);
    g.fillRoundedRect(ox - 46, -52, 92, 100, 10);
    g.fillStyle(body, 1);
    g.fillRoundedRect(ox - 38, -30, 76, 70, 8);
    g.fillStyle(lid, 1);
    g.fillRoundedRect(ox - 52, -66, 104, 18, 8);
    g.fillStyle(0x5a5a64, 1);
    g.fillRoundedRect(ox - 8, -78, 16, 14, 4);
    // Spigot.
    g.fillStyle(0x8f8f9c, 1);
    g.fillRect(ox - 5, 40, 10, 16);
  };
  urn(-52, 0xd9b070, 0xc9c3bb);   // clear / bone broth
  urn(52, 0xc03a28, 0xc9c3bb);    // spicy

  // Spice-level dial: four dots getting redder, left to right. It sits on the
  // counter's front face, under the spigots, so nothing hangs down into the
  // "Broth + spice" label.
  g.fillStyle(0x3f2a1c, 1);
  g.fillRoundedRect(-56, 58, 112, 24, 8);
  const heat = [0xf3ecdc, 0xf6c368, 0xe8763f, 0xc03a28];
  heat.forEach((h, i) => {
    g.fillStyle(h, 1);
    g.fillCircle(-38 + i * 25, 70, 7);
  });
}

// 5. The table number tag: take your number, go sit down, it comes. The card
// is its own piece (with real text, so 83 reads as 83) so it can rock on its clip.
function drawNumberTag(g, node, scene) {
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(6, 76, 130, 26);
  // Weighted base + stem.
  g.fillStyle(0x5a5a64, 1);
  g.fillEllipse(0, 62, 116, 26);
  g.fillRect(-6, -6, 12, 66);
  if (!scene) return;
  const card = scene.add.container(0, 2);
  const cg = scene.add.graphics();
  cg.fillStyle(0xd9a05b, 1);
  cg.fillRoundedRect(-62, -94, 124, 96, 8);
  cg.fillStyle(0xf5e2b8, 1);
  cg.fillRoundedRect(-54, -86, 108, 80, 6);
  card.add(cg);
  // The number is 83, the family's number. Lettering on the card: art, so it
  // keeps the size that fills the card (the snap would take it down to 52).
  card.add(scene.add.text(0, -46, '83', style('caption', {
    fontSize: '58px', fill: '#8a3a1e', fontStyle: '900', art: true
  })).setOrigin(0.5));
  node.add(card);
  node.hpParts = { card };
}

// 6. The DIY sauce bar: a row of small crocks with ladles, and a recipe card.
// Ladles and the card are their own pieces so the idle pass can dip and flutter.
function drawSauceBar(g, node, scene) {
  const w = 300, h = 116;
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(-w / 2 + 8, -h / 2 + 16, w, h, 10);
  g.fillStyle(0x8d6a4a, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
  g.fillStyle(0xa8815c, 1);
  g.fillRect(-w / 2, -h / 2, w, 12);

  // Six little crocks: soy, sesame, chili oil, garlic, scallion, vinegar.
  // Crocks sit on a 52px pitch from x = -118, two rows 48px apart.
  const sauces = [0x3a2a1e, 0xc9a06a, 0xc03a28, 0xf3ecdc, 0x5e9a45, 0x8a5a3c];
  const ladles = [];
  sauces.forEach((s, i) => {
    const cx = -w / 2 + 32 + (i % 3) * 52;
    const cy = -h / 2 + 36 + Math.floor(i / 3) * 48;
    g.fillStyle(0xe8e0d2, 1);
    g.fillCircle(cx, cy, 21);
    g.fillStyle(s, 1);
    g.fillCircle(cx, cy, 15);
    g.lineStyle(2, 0xb9ae9a, 1);
    g.strokeCircle(cx, cy, 21);
    if (!scene) {
      g.fillStyle(0xc9c3bb, 1);
      g.fillRect(cx + 12, cy - 30, 5, 26);
      return;
    }
    // Ladle: handle sticking up out of the crock, pivoting at the crock centre.
    const ladle = scene.add.graphics();
    ladle.fillStyle(0xc9c3bb, 1);
    ladle.fillRect(12, -30, 5, 26);
    ladle.fillCircle(14.5, -30, 4);
    ladle.setPosition(cx, cy);
    node.add(ladle);
    ladles.push(ladle);
  });

  // Recipe card propped at the right end.
  const drawCard = (cg, ox, oy) => {
    cg.fillStyle(0xf5e2b8, 1);
    cg.fillRoundedRect(ox - 42, oy - 48, 84, 96, 6);
    cg.lineStyle(2, 0x8a5a3c, 1);
    cg.strokeRoundedRect(ox - 42, oy - 48, 84, 96, 6);
    cg.fillStyle(0xb0906a, 1);
    for (let i = 0; i < 5; i++) cg.fillRect(ox - 32, oy - 30 + i * 15, 64, 4);
  };
  if (!scene) { drawCard(g, w / 2 - 54, -h / 2 + 38); return; }
  const recipe = scene.add.graphics();
  drawCard(recipe, 0, 0);
  recipe.setPosition(w / 2 - 54, -h / 2 + 38);
  node.add(recipe);
  node.hpParts = { ladles, recipe, sauceColors: sauces };
}

// 7. The family table — five seats, five individual bowls. The whole point, so
// it's drawn at full weight: a real table you could sit five people at, not a
// bench. Everything else in the room is a station; this is the destination.
function drawFamilyTable(g) {
  const w = 760;
  const seatXs = [-288, -144, 0, 144, 288];

  // Five chairs behind the table — only their backs show above the tabletop,
  // which is what you actually see looking at a set table. (Drawn as stool seats
  // they read as discs floating over the food.)
  for (const sx of seatXs) {
    g.fillStyle(0x6b4632, 1);
    g.fillRoundedRect(sx - 40, -128, 80, 96, 12);
    g.fillStyle(0x8a5a3c, 1);
    g.fillRoundedRect(sx - 33, -121, 66, 82, 9);
    // Two slats so the back reads as a chair, not a block.
    g.fillStyle(0x6b4632, 1);
    g.fillRect(sx - 33, -100, 66, 9);
    g.fillRect(sx - 33, -76, 66, 9);
  }

  // Tabletop — chunky slab with a lit front edge.
  g.fillStyle(0x000000, 0.38);
  g.fillRoundedRect(-w / 2 + 12, -20, w, 56, 14);
  g.fillStyle(0x9a6b45, 1);
  g.fillRoundedRect(-w / 2, -46, w, 92, 16);
  g.fillStyle(0xb5804f, 1);
  g.fillRect(-w / 2 + 8, -40, w - 16, 16);
  g.fillStyle(0x000000, 0.22);
  g.fillRect(-w / 2 + 8, 20, w - 16, 20);
  // Plank seams across the top.
  g.fillStyle(0x83593a, 0.7);
  for (let i = 1; i < 5; i++) g.fillRect(-w / 2 + i * (w / 5), -46, 3, 92);

  // Legs.
  g.fillStyle(0x6b4632, 1);
  g.fillRect(-w / 2 + 46, 46, 28, 78);
  g.fillRect(w / 2 - 74, 46, 28, 78);
  g.fillStyle(0x5a3524, 1);
  g.fillRect(-w / 2 + 46, 116, 28, 10);
  g.fillRect(w / 2 - 74, 116, 28, 10);

  // Five individual bowls, one per seat, each with its own broth. Individual
  // bowls is the whole format — there is no shared pot to divide.
  const broths = [0xc85a4a, 0xd9b070, 0xc85a4a, 0xc03a28, 0xd9b070];
  broths.forEach((b, i) => {
    const bx = seatXs[i];
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(bx + 4, 2, 128, 34);
    g.fillStyle(0xf7f1e6, 1);
    g.fillEllipse(bx, -10, 132, 58);
    g.fillStyle(0xe2d9c8, 1);
    g.fillEllipse(bx, 4, 96, 26);
    g.fillStyle(b, 1);
    g.fillEllipse(bx, -24, 110, 36);
    g.lineStyle(3, 0xb9ae9a, 1);
    g.strokeEllipse(bx, -24, 110, 36);
    // Something floating in each bowl so no two look identical.
    g.fillStyle(i % 2 ? 0xffd15c : 0x5e9a45, 1);
    g.fillEllipse(bx + (i % 2 ? 20 : -20), -26, 26, 13);
    // A pair of chopsticks resting across the rim.
    g.fillStyle(0xd9b382, 1);
    g.fillRect(bx - 48, -40, 96, 4);
    g.fillRect(bx - 48, -32, 96, 4);
  });
}

// 8. The free ice cream machine — the last stop, and the best part.
function drawConeMachine(g) {
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(-66, 108, 140, 26, 8);
  // Machine body.
  g.fillStyle(0xc9c3bb, 1);
  g.fillRoundedRect(-72, -104, 144, 214, 14);
  g.fillStyle(0xe4dfd6, 1);
  g.fillRoundedRect(-64, -96, 128, 76, 10);
  // Flavour placard — a little cone pictured on it, so it reads as ice cream
  // rather than a blank white panel.
  g.fillStyle(0xd9a05b, 1);
  g.fillRoundedRect(-52, -84, 104, 46, 6);
  g.fillStyle(0x8a5a3c, 1);
  g.fillTriangle(-12, -62, 12, -62, 0, -42);
  g.fillStyle(0xfff6e8, 1);
  g.fillEllipse(0, -66, 30, 18);
  g.fillEllipse(0, -74, 20, 14);
  // Dispensing nozzle + lever.
  g.fillStyle(0x8f8f9c, 1);
  g.fillRoundedRect(-22, -14, 44, 34, 6);
  g.fillRect(-4, 20, 8, 22);
  g.fillStyle(0x5a5a64, 1);
  g.fillRoundedRect(26, -10, 12, 46, 5);
  // A cone waiting under the nozzle, already half-filled.
  g.fillStyle(0xd9a05b, 1);
  g.fillTriangle(-24, 56, 24, 56, 0, 106);
  g.fillStyle(0xb07a3a, 0.5);
  g.fillTriangle(4, 60, 24, 56, 0, 106);
  g.fillStyle(0xfff6e8, 1);
  g.fillEllipse(0, 52, 54, 26);
  g.fillEllipse(0, 38, 38, 22);
  // A short stack of spare cones beside it.
  g.fillStyle(0xd9a05b, 1);
  g.fillTriangle(52, 62, 74, 62, 63, 104);
  g.fillTriangle(46, 68, 68, 68, 57, 110);
}

// ============================================================
// GARAGE ITEM RENDERERS — each draws centered on (0,0)
// ============================================================

// 1. Chest freezer — wide white horizontal box with raised lid + handle.
function drawChestFreezer(g) {
  // Ground shadow
  g.fillStyle(0x000000, 0.45);
  g.fillEllipse(0, 90, 250, 18);
  drawFreezerBody(g);
}

// Freezer body without its ground shadow. Also redrawn as the front piece the
// pet sinks behind when it climbs in (see _freezerLidOpen).
function drawFreezerBody(g) {
  // Body (lower box)
  g.fillStyle(0xeae6db, 1);
  g.fillRoundedRect(-115, -20, 230, 110, 8);
  // Body bottom shadow band (depth)
  g.fillStyle(0xb8b0a0, 1);
  g.fillRect(-115, 80, 230, 12);
  // NOTE: the lid is drawn separately (drawFreezerLid) so _freezerLidOpen can
  // lift it; the cold glow in the gap is built by the animator too.
  // Snowflake badge on body
  g.fillStyle(0x6db4d0, 1);
  const sx = 0, sy = 30;
  g.fillRect(sx - 14, sy - 1, 28, 2);
  g.fillRect(sx - 1, sy - 14, 2, 28);
  g.lineStyle(2, 0x6db4d0, 1);
  g.lineBetween(sx - 10, sy - 10, sx + 10, sy + 10);
  g.lineBetween(sx - 10, sy + 10, sx + 10, sy - 10);
  // Brand strip
  g.fillStyle(0x4a4a4a, 1);
  g.fillRoundedRect(-26, 58, 52, 8, 2);
  // Side vents (right end)
  g.lineStyle(1, 0xb8b0a0, 0.9);
  for (let i = 0; i < 4; i++) g.lineBetween(85, 30 + i * 8, 105, 30 + i * 8);
}

// Freezer lid — its own piece so _freezerLidOpen can lift + tilt it open.
function drawFreezerLid(g) {
  // Lid slab
  g.fillStyle(0xfbf8ee, 1);
  g.fillRoundedRect(-118, -68, 236, 56, 8);
  // Lid front face (light shadow under lid)
  g.fillStyle(0x000000, 0.18);
  g.fillRect(-115, -16, 230, 6);
  // Lid top highlight
  g.fillStyle(0xffffff, 0.4);
  g.fillRoundedRect(-110, -66, 220, 10, 6);
  // Lid handle — full-width bar
  g.fillStyle(0xc0b8a8, 1);
  g.fillRoundedRect(-70, -32, 140, 12, 6);
  g.fillStyle(0x9a9080, 1);
  g.fillRoundedRect(-66, -28, 132, 4, 2);
}

// 2. Wire pantry rack — vertical 4-shelf with boxes/cans/bottles.
function drawStorageRack(g) {
  g.fillStyle(0x000000, 0.5);
  g.fillEllipse(0, 150, 230, 14);
  // Frame uprights
  g.fillStyle(0x2a2a30, 1);
  g.fillRect(-110, -140, 8, 290);
  g.fillRect(102, -140, 8, 290);
  // 4 wire shelves
  const shelfYs = [-140, -60, 20, 100];
  for (const y of shelfYs) {
    g.fillStyle(0x2a2a30, 1);
    g.fillRect(-110, y, 220, 6);
    // Wire crosshatch hint
    g.lineStyle(1, 0x444450, 1);
    for (let x = -100; x < 100; x += 14) g.lineBetween(x, y, x, y + 6);
  }
  // Top shelf: SNACKS (chip bag, cookie box, cracker box, granola bar box).
  // The chip bag is its own piece (drawChipBag) so the pet can pull it down.
  // Cookie box (blue with cookie circle)
  g.fillStyle(0x4a7ad6, 1);
  g.fillRoundedRect(-50, -140 - 44, 40, 44, 3);
  g.fillStyle(0xc88a52, 1);
  g.fillCircle(-30, -140 - 30, 10);
  g.fillStyle(0x6e4a28, 1);
  g.fillCircle(-32, -140 - 32, 1.5);
  g.fillCircle(-26, -140 - 28, 1.5);
  g.fillCircle(-29, -140 - 26, 1.5);
  g.fillStyle(0xffd84a, 1);
  g.fillRect(-48, -140 - 14, 36, 5);
  // Cracker box (red with cracker peek)
  g.fillStyle(0xd13b3b, 1);
  g.fillRoundedRect(0, -140 - 50, 42, 50, 3);
  g.fillStyle(0xfbd087, 1);
  g.fillRoundedRect(8, -140 - 38, 28, 14, 3);
  g.fillStyle(0x8a4a1c, 0.6);
  for (let i = 0; i < 4; i++) g.fillCircle(12 + i * 6, -140 - 31, 1.2);
  g.fillStyle(0xfff5d8, 1);
  g.fillRect(4, -140 - 16, 34, 6);
  // Granola/snack bar box (teal with bars visible)
  g.fillStyle(0x4ecdc4, 1);
  g.fillRoundedRect(50, -140 - 46, 50, 46, 3);
  g.fillStyle(0xfff5d8, 1);
  g.fillRect(54, -140 - 44, 42, 6);
  g.fillStyle(0xc48a3c, 1);
  g.fillRoundedRect(56, -140 - 34, 38, 6, 2);
  g.fillRoundedRect(56, -140 - 24, 38, 6, 2);
  g.fillRoundedRect(56, -140 - 14, 38, 6, 2);
  // Bar oat speckles
  g.fillStyle(0x6e4a28, 0.8);
  for (let i = 0; i < 4; i++) {
    g.fillCircle(60 + i * 9, -140 - 31, 0.9);
    g.fillCircle(60 + i * 9, -140 - 21, 0.9);
  }
  // 2nd shelf: cans
  for (let i = 0; i < 6; i++) {
    g.fillStyle(i % 2 === 0 ? 0xd13b3b : 0x4a90c2, 1);
    g.fillRoundedRect(-100 + i * 32, -60 - 38, 26, 38, 3);
    g.fillStyle(0xffffff, 0.5);
    g.fillRect(-100 + i * 32, -60 - 24, 26, 4);
  }
  // 3rd shelf: pretzel bag + laundry pods jug + detergent bottle
  // Pretzel bag (yellow w/ pretzel shapes)
  g.fillStyle(0xfbd34a, 1);
  g.fillRoundedRect(-100, 20 - 60, 48, 60, 6);
  g.fillStyle(0xb47020, 1);
  g.fillCircle(-86, 20 - 32, 6);
  g.fillCircle(-72, 20 - 36, 5);
  g.fillCircle(-78, 20 - 22, 5);
  // Pretzel bag label
  g.fillStyle(0xd13b3b, 1);
  g.fillRect(-96, 20 - 52, 40, 8);
  // Laundry pods
  g.fillStyle(0xff8ec7, 1);
  g.fillRoundedRect(-44, 20 - 50, 44, 50, 6);
  g.fillStyle(0xffffff, 0.7);
  g.fillRoundedRect(-40, 20 - 38, 36, 12, 3);
  // Detergent
  g.fillStyle(0x4a7ad6, 1);
  g.fillRoundedRect(8, 20 - 64, 42, 64, 6);
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(14, 20 - 58, 30, 12, 3);
  // 4th shelf: paper towels roll + bin
  g.fillStyle(0xfff5d8, 1);
  g.fillRoundedRect(-95, 100 - 50, 50, 50, 8);
  g.lineStyle(1, 0xd0c8b0, 1);
  for (let i = 0; i < 5; i++) g.strokeRoundedRect(-95 + i * 2, 100 - 50, 50, 50, 8);
  g.fillStyle(0x5a5a64, 1);
  g.fillRoundedRect(-10, 100 - 44, 70, 44, 4);
}

// Chip bag (orange mylar with crimp top), centered on its own origin. It sits
// on the rack's top shelf at (-78, -165) until the pet takes it.
function drawChipBag(g) {
  g.fillStyle(0xff8a3d, 1);
  g.fillRoundedRect(-22, -25, 44, 50, 4);
  g.fillStyle(0xc25a20, 1);
  g.fillRect(-22, -25, 44, 5);
  g.fillRect(-22, 17, 44, 5);
  // Chip oval label
  g.fillStyle(0xfff5d8, 1);
  g.fillEllipse(0, 0, 28, 14);
  g.fillStyle(0xd13b3b, 1);
  g.fillRect(-12, -3, 24, 4);
  // Tiny chip visual
  g.fillStyle(0xfbd087, 1);
  g.fillTriangle(-4, 5, 4, 5, 0, 11);
}

// 3. Black storage bins with yellow lids — stacked 2-high.
function drawStorageBins(g) {
  g.fillStyle(0x000000, 0.5);
  g.fillEllipse(0, 100, 240, 14);
  // Bottom bin
  g.fillStyle(0x1a1a1f, 1);
  g.fillRoundedRect(-100, 0, 200, 100, 8);
  // Bottom bin lid
  g.fillStyle(0xffd84a, 1);
  g.fillRoundedRect(-104, -8, 208, 18, 6);
  g.fillStyle(0xc9a830, 1);
  g.fillRect(-104, 8, 208, 4);
  // Bottom bin handle/label
  g.fillStyle(0x3a3a44, 1);
  g.fillRoundedRect(-30, 40, 60, 24, 4);
  // Top bin. Its lid is its own piece (drawBinLid) so the pet can pop it off.
  drawTopBin(g);
}

// Top storage bin body. Also redrawn as the front piece the pet digs behind.
function drawTopBin(g) {
  g.fillStyle(0x1a1a1f, 1);
  g.fillRoundedRect(-90, -90, 180, 80, 8);
}

// Top bin's yellow lid, centered on its own origin; it sits at (0, -90).
function drawBinLid(g) {
  g.fillStyle(0xffd84a, 1);
  g.fillRoundedRect(-94, -8, 188, 16, 6);
  g.fillStyle(0xc9a830, 1);
  g.fillRect(-94, 6, 188, 4);
  // Lid latches
  g.fillStyle(0x1a1a1f, 1);
  g.fillRect(-80, -6, 10, 10);
  g.fillRect(70, -6, 10, 10);
}

// 4. Black squat rack — uprights + barbell + plates + safeties.
function drawSquatRack(g) {
  g.fillStyle(0x000000, 0.5);
  g.fillEllipse(0, 130, 180, 14);
  // Base
  g.fillStyle(0x14141a, 1);
  g.fillRect(-70, 110, 140, 16);
  // Uprights
  g.fillStyle(0x14141a, 1);
  g.fillRect(-60, -130, 18, 240);
  g.fillRect(42, -130, 18, 240);
  // J-hooks
  g.fillStyle(0x222230, 1);
  g.fillRect(-66, -30, 22, 8);
  g.fillRect(44, -30, 22, 8);
  // Cross-brace
  g.fillStyle(0x14141a, 1);
  g.fillRect(-60, -130, 120, 12);
  // NOTE: the loaded barbell is drawn separately (drawSquatBar) so
  // _squatRackReps can rep it up and down on the J-hooks.
  // Safety pin
  g.fillStyle(0x222230, 1);
  g.fillRect(-60, 60, 120, 6);
}

// Loaded barbell for the squat rack — its own piece so it can do slow reps.
function drawSquatBar(g) {
  // Bar
  g.fillStyle(0x6a6a76, 1);
  g.fillRect(-90, -22, 180, 6);
  // Sleeve collars
  g.fillStyle(0x9a9aaa, 1);
  g.fillRect(-92, -24, 12, 10);
  g.fillRect(80, -24, 12, 10);
  // Plates: red 25kg both sides
  g.fillStyle(0xd13b3b, 1);
  g.fillCircle(-92, -19, 30);
  g.fillCircle(92, -19, 30);
  g.fillStyle(0x0a0a1a, 1);
  g.fillCircle(-92, -19, 7);
  g.fillCircle(92, -19, 7);
  // Plate edge highlight
  g.lineStyle(2, 0xffffff, 0.25);
  g.strokeCircle(-92, -19, 30);
  g.strokeCircle(92, -19, 30);
}

// 5. Silver MacBook Pro — open laptop, glowing apple.
function drawMacBook(g) {
  g.fillStyle(0x000000, 0.45);
  g.fillEllipse(0, 80, 220, 14);
  // Base (closed half)
  g.fillStyle(0xb8b8c0, 1);
  g.fillRoundedRect(-110, 50, 220, 18, 6);
  g.fillStyle(0x8a8a90, 1);
  g.fillRect(-110, 62, 220, 6);
  // Lid (back, taller portion)
  g.fillStyle(0xcdcdd4, 1);
  g.fillRoundedRect(-104, -90, 208, 145, 8);
  // Screen bezel
  g.fillStyle(0x14141a, 1);
  g.fillRoundedRect(-94, -82, 188, 130, 4);
  // Wallpaper — soft starfield gradient
  g.fillStyle(0x1d2c54, 1);
  g.fillRoundedRect(-90, -78, 180, 122, 3);
  g.fillStyle(0x4a3a8c, 0.6);
  g.fillCircle(-30, -10, 80);
  g.fillStyle(0xffffff, 0.85);
  for (const [sx, sy, sr] of [[-60, -50, 1.6], [40, -30, 1.4], [60, 20, 1.2], [-30, 30, 1], [10, -60, 1.4]]) {
    g.fillCircle(sx, sy, sr);
  }
  // Hinge shadow line
  g.fillStyle(0x000000, 0.3);
  g.fillRect(-104, 50, 208, 3);
  // Apple logo (glowing)
  g.fillStyle(0xffffff, 0.85);
  const ax = 0, ay = -20;
  g.fillCircle(ax, ay, 8);
  g.fillCircle(ax + 4, ay - 4, 5);
  g.fillStyle(0x14141a, 1);
  g.fillRect(ax + 1, ay - 12, 4, 4);
}

// 6. Bambu Lab A1 mini — small white cuboid printer with bed + gantry.
function drawBambuA1(g) {
  g.fillStyle(0x000000, 0.45);
  g.fillEllipse(0, 95, 160, 12);
  // Base / housing
  g.fillStyle(0xf2f2f2, 1);
  g.fillRoundedRect(-78, -90, 156, 180, 8);
  // Base plinth (darker)
  g.fillStyle(0x1f1f24, 1);
  g.fillRoundedRect(-80, 50, 160, 40, 6);
  // LCD touchscreen on plinth
  g.fillStyle(0x3aa7ff, 1);
  g.fillRoundedRect(-30, 58, 60, 26, 3);
  g.fillStyle(0xffffff, 0.9);
  g.fillRect(-22, 64, 24, 3);
  g.fillRect(-22, 70, 38, 3);
  g.fillRect(-22, 76, 18, 3);
  // Build plate
  g.fillStyle(0x4a90c2, 1);
  g.fillRoundedRect(-58, 26, 116, 16, 3);
  // Print bed grid hint
  g.lineStyle(1, 0xffffff, 0.4);
  for (let i = 0; i < 4; i++) g.lineBetween(-58 + i * 30, 26, -58 + i * 30, 42);
  // Gantry rails (top horizontal)
  g.fillStyle(0x2a2a30, 1);
  g.fillRect(-70, -64, 140, 6);
  // Vertical gantry rail (Z-axis on right)
  g.fillRect(58, -64, 6, 90);
  // NOTE: the print head + the toy on the bed are drawn separately
  // (drawPrinterHead / drawPrintedToy) so _printerPrinting can sweep + grow them.
  // Filament spool (top-left small)
  g.fillStyle(0x2a2a30, 1);
  g.fillCircle(-50, -80, 14);
  g.fillStyle(0xff6b3d, 1);
  g.fillCircle(-50, -80, 10);
  g.fillStyle(0x2a2a30, 1);
  g.fillCircle(-50, -80, 3);
  // Brand mark
  g.fillStyle(0x39c97d, 1);
  g.fillCircle(-58, 80, 5);
}

// Print head block + nozzle, centered on its own origin so it can sweep the
// gantry. (Origin placed at gantry height by _printerPrinting.)
function drawPrinterHead(g) {
  g.fillStyle(0xfbbf24, 1);
  g.fillRoundedRect(-20, -14, 40, 28, 3);
  // Nozzle tip
  g.fillStyle(0x14141a, 1);
  g.fillTriangle(-2, 14, 2, 14, 0, 22);
}

// A little rocket toy, printed bottom-up: base sits at local y=0, nose at
// y=-40, so _printerPrinting can grow it with scaleY 0→1 off the bed.
function drawPrintedToy(g) {
  // Body
  g.fillStyle(0x4ecdc4, 1);
  g.fillRoundedRect(-9, -28, 18, 28, 5);
  // Nose cone
  g.fillStyle(0xff6b3d, 1);
  g.fillTriangle(-9, -26, 9, -26, 0, -40);
  // Window
  g.fillStyle(0xfff5d8, 1);
  g.fillCircle(0, -18, 4);
  // Fins
  g.fillStyle(0xff6b3d, 1);
  g.fillTriangle(-9, -6, -9, -18, -16, -2);
  g.fillTriangle(9, -6, 9, -18, 16, -2);
}

// 7. All-black full-size stroller with the toddler seat, side profile. Handle
// and canopy on the left, open front on the right. A lambda frame: one long
// straight tube from the rear axle up and back to the telescoping handlebar,
// and a shorter front leg from the small front wheel up to the fold hub. The
// seat sits on the hub facing forward, the big basket hangs between the legs.
// The ground line is y 120. The wheels are drawn by _strollerRock (their own
// pieces, so they turn when the stroller rolls).
const STROLLER = {
  rear: { x: -72, y: 88, r: 32 },     // 1.4x the front wheel, like the real one
  front: { x: 98, y: 97, r: 23 },
  handle: { x: -116, y: -148 },       // top of the rear tube, under y 790 in the room
  hub: { x: -90, y: -12 },            // fold hub, about 42% of the way up the tube
  seatY: -12,                         // top of the seat cushion
  barY: -54,                          // bumper bar
  seatFrontX: -6
};
const STROLLER_FRAME = 0x1a1b1f;      // carbon, near black
const STROLLER_FABRIC = 0x34353c;     // charcoal black, a touch lighter than the frame
const STROLLER_LEATHER = 0x0d0d0f;

function drawUppababyVista(g) {
  const S = STROLLER;
  // Ground shadow
  g.fillStyle(0x000000, 0.45);
  g.fillEllipse(8, 120, 250, 16);

  // BASKET: big, black, slung under the seat between the legs.
  g.fillStyle(0x1f2024, 1);
  g.fillPoints([
    { x: -66, y: 24 }, { x: 52, y: 24 }, { x: 44, y: 80 },
    { x: 36, y: 86 }, { x: -50, y: 86 }, { x: -58, y: 80 }
  ], true);
  g.fillStyle(0x2c2d33, 1);
  g.fillRoundedRect(-68, 20, 122, 8, 3);
  // Fabric seams, so it reads as a soft bin and not a box
  g.lineStyle(2, 0x2c2d33, 1);
  g.lineBetween(-56, 50, 46, 50);
  g.lineBetween(-20, 28, -18, 84);
  g.lineBetween(16, 28, 14, 84);
  // Strap up to the seat frame
  g.lineStyle(3, STROLLER_FRAME, 1);
  g.lineBetween(-62, 22, -80, -6);

  // FRONT LEG: front axle up to the fold hub.
  g.lineStyle(9, STROLLER_FRAME, 1);
  g.lineBetween(S.front.x, S.front.y, S.hub.x, S.hub.y);
  g.lineStyle(2, 0x4b4d57, 0.8);
  g.lineBetween(S.front.x - 4, S.front.y - 6, S.hub.x + 6, S.hub.y - 4);

  // SEAT BACK: reclines a little, under the canopy.
  g.fillStyle(0x2a2b31, 1);
  g.fillPoints([
    { x: -80, y: -14 }, { x: -98, y: -8 }, { x: -114, y: -94 }, { x: -98, y: -100 }
  ], true);
  // Seat cushion
  g.fillStyle(STROLLER_FABRIC, 1);
  g.fillRoundedRect(-92, -22, 88, 14, 6);

  // CANOPY: the big hood arching over the seat back, open to the front.
  const cx = -68, cy = -54, cr = 66;
  g.fillStyle(0x303137, 1);
  g.beginPath();
  g.arc(cx, cy, cr, Phaser.Math.DegToRad(188), Phaser.Math.DegToRad(335), false);
  g.lineTo(-78, -52);
  g.closePath();
  g.fillPath();
  // Pop-out visor along the front edge
  g.lineStyle(6, 0x26272c, 1);
  g.lineBetween(cx + Math.cos(Phaser.Math.DegToRad(335)) * cr, cy + Math.sin(Phaser.Math.DegToRad(335)) * cr, -78, -52);
  // One soft highlight on the dome
  g.lineStyle(6, 0xffffff, 0.12);
  g.beginPath();
  g.arc(cx, cy, cr - 10, Phaser.Math.DegToRad(222), Phaser.Math.DegToRad(292), false);
  g.strokePath();
  // Mesh peekaboo window on top
  g.fillStyle(0x56606a, 0.85);
  g.fillRoundedRect(-84, -116, 24, 7, 3);

  drawStrollerSeatFront(g);

  // REAR LEG + HANDLEBAR: one straight tube from the rear axle to the top.
  const tube = t => ({ x: S.rear.x + (S.handle.x - S.rear.x) * t, y: S.rear.y + (S.handle.y - S.rear.y) * t });
  const collar = tube(0.76), wrap = tube(0.9);
  g.lineStyle(10, STROLLER_FRAME, 1);
  g.lineBetween(S.rear.x, S.rear.y, collar.x, collar.y);
  // Telescoping top section, a shade lighter, with its adjuster collar
  g.lineStyle(8, 0x26272d, 1);
  g.lineBetween(collar.x, collar.y, S.handle.x, S.handle.y);
  g.fillStyle(0x3a3c44, 1);
  g.fillCircle(collar.x, collar.y, 7);
  g.lineStyle(2, 0x4b4d57, 0.8);
  g.lineBetween(S.rear.x - 5, S.rear.y - 8, collar.x - 4, collar.y + 2);
  // Black leather wrap and the grip, seen end on
  g.lineStyle(13, STROLLER_LEATHER, 1);
  g.lineBetween(wrap.x, wrap.y, S.handle.x, S.handle.y);
  g.fillStyle(STROLLER_LEATHER, 1);
  g.fillCircle(S.handle.x, S.handle.y, 9);
  g.lineStyle(1.5, 0x55555c, 0.9);
  g.lineBetween(wrap.x - 3, wrap.y, S.handle.x - 4, S.handle.y + 2);
  g.fillStyle(0xffffff, 0.18);
  g.fillCircle(S.handle.x - 2, S.handle.y - 3, 3);

  // Fold hub where the legs meet
  g.fillStyle(0x3a3c44, 1);
  g.fillCircle(S.hub.x, S.hub.y, 10);
  g.fillStyle(0x6d6f78, 1);
  g.fillCircle(S.hub.x, S.hub.y, 5);
}

// The toddler seat's near side, footrest and leather bumper bar. Also redrawn
// as the front piece the pet sits up behind (see _strollerRock), so its head
// and shoulders show over the bar.
function drawStrollerSeatFront(g) {
  const S = STROLLER;
  // Footrest, angled down and forward under the seat front
  g.fillStyle(0x26272c, 1);
  g.fillPoints([
    { x: S.seatFrontX - 8, y: -10 }, { x: S.seatFrontX + 4, y: -12 },
    { x: S.seatFrontX + 24, y: 20 }, { x: S.seatFrontX + 12, y: 25 }
  ], true);
  // Seat side panel
  g.fillStyle(STROLLER_FABRIC, 1);
  g.fillRoundedRect(-92, -44, S.seatFrontX + 92, 38, { tl: 6, tr: 10, bl: 8, br: 14 });
  g.fillStyle(0xffffff, 0.08);
  g.fillRoundedRect(-86, -40, S.seatFrontX + 76, 5, 2);
  // Bumper bar: the arm down to the seat frame, then the bar across the front
  g.lineStyle(5, STROLLER_FRAME, 1);
  g.lineBetween(-80, S.barY + 4, -86, -24);
  g.lineStyle(9, STROLLER_LEATHER, 1);
  g.lineBetween(-80, S.barY + 4, S.seatFrontX, S.barY);
  g.fillStyle(STROLLER_LEATHER, 1);
  g.fillCircle(S.seatFrontX, S.barY, 6);
  g.lineStyle(1.5, 0x55555c, 0.9);
  g.lineBetween(-74, S.barY + 2, S.seatFrontX - 4, S.barY - 1);
}

// One stroller wheel centred on (0, 0): black foam tyre, black rim, grey hub.
// Five grey spokes so the turn shows when it rolls.
function drawStrollerWheel(g, r) {
  g.fillStyle(0x141416, 1);
  g.fillCircle(0, 0, r);
  g.lineStyle(3, 0x2d2d33, 1);
  g.strokeCircle(0, 0, r - 4);
  g.fillStyle(0x222328, 1);
  g.fillCircle(0, 0, r * 0.66);
  g.lineStyle(r * 0.11, 0x6d6f78, 1);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.lineBetween(0, 0, Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
  }
  g.fillStyle(0x9a9ca5, 1);
  g.fillCircle(0, 0, r * 0.26);
  g.fillStyle(0x2a2b30, 1);
  g.fillCircle(0, 0, r * 0.1);
}

// 8. Three kids' bicycles, scaled and tilted slightly.
// The orange middle bike (0, 40) is drawn separately by _bikesOrange so the pet
// can ride it.
function drawKidsBikes(g) {
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(0, 100, 320, 14);
  drawSmallBike(g, -120, 30, 0x4ecdc4, 0.85);
  drawSmallBike(g, 130, 50, 0xf0abfc, 1.15);
}

function drawSmallBike(g, ox, oy, color, scale) {
  const s = scale;
  drawBikeWheel(g, ox - 32 * s, oy, s);
  drawBikeWheel(g, ox + 32 * s, oy, s);
  drawBikeFrame(g, ox, oy, color, s);
}

// One kid's-bike wheel: tire, hub and spokes, centered on (ox, oy).
function drawBikeWheel(g, ox, oy, s) {
  g.fillStyle(0x14141a, 1);
  g.fillCircle(ox, oy, 22 * s);
  g.fillStyle(0x6a6a76, 1);
  g.fillCircle(ox, oy, 6 * s);
  // Spokes (cheap radial)
  g.lineStyle(1, 0x9a9aaa, 0.9);
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    g.lineBetween(ox, oy, ox + Math.cos(ang) * 18 * s, oy + Math.sin(ang) * 18 * s);
  }
}

// Kid's-bike frame, seat and bars; (ox, oy) is the midpoint between the hubs.
function drawBikeFrame(g, ox, oy, color, scale) {
  const s = scale;
  // Frame — triangle + seat post
  g.lineStyle(6 * s, color, 1);
  g.lineBetween(ox - 32 * s, oy, ox, oy - 26 * s);
  g.lineBetween(ox, oy - 26 * s, ox + 32 * s, oy);
  g.lineBetween(ox, oy - 26 * s, ox - 14 * s, oy - 4 * s);
  g.lineBetween(ox - 14 * s, oy - 4 * s, ox - 32 * s, oy);
  // Seat
  g.fillStyle(0x14141a, 1);
  g.fillRoundedRect(ox - 10 * s, oy - 32 * s, 22 * s, 6 * s, 2);
  // Handlebars
  g.lineStyle(4 * s, 0x14141a, 1);
  g.lineBetween(ox + 24 * s, oy - 20 * s, ox + 40 * s, oy - 26 * s);
  // Training wheel for smallest
  if (scale < 0.9) {
    g.fillStyle(0xfbbf24, 1);
    g.fillCircle(ox + 36 * s, oy + 18 * s, 10 * s);
  }
}

// 9. Fat-tire ebike with rear-mounted orange child seat — side profile.
function drawRadPower(g) {
  g.fillStyle(0x000000, 0.45);
  g.fillEllipse(0, 100, 340, 14);
  // Wheels — fat tires
  g.fillStyle(0x14141a, 1);
  g.fillCircle(-110, 50, 50);
  g.fillCircle(110, 50, 50);
  // Tread ring (lighter)
  g.lineStyle(3, 0x3a3a44, 1);
  g.strokeCircle(-110, 50, 50);
  g.strokeCircle(110, 50, 50);
  // Rims
  g.fillStyle(0x6a6a76, 1);
  g.fillCircle(-110, 50, 30);
  g.fillCircle(110, 50, 30);
  g.fillStyle(0x14141a, 1);
  g.fillCircle(-110, 50, 6);
  g.fillCircle(110, 50, 6);
  // Spokes
  g.lineStyle(2, 0x9a9aaa, 0.9);
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    g.lineBetween(-110, 50, -110 + Math.cos(ang) * 28, 50 + Math.sin(ang) * 28);
    g.lineBetween(110, 50, 110 + Math.cos(ang) * 28, 50 + Math.sin(ang) * 28);
  }
  // Frame — step-through-ish with battery in downtube
  g.lineStyle(14, 0x1f1f26, 1);
  g.lineBetween(-110, 50, -40, -10);   // seat tube
  g.lineBetween(-110, 50, 80, 0);      // downtube
  g.lineBetween(80, 0, 110, 50);       // chainstay
  g.lineBetween(-40, -10, 80, 0);      // top tube
  // Battery slab
  g.fillStyle(0x2a2a32, 1);
  g.fillRoundedRect(-95, 8, 150, 22, 4);
  // Battery LEDs
  g.fillStyle(0x39ff14, 1);
  for (let i = 0; i < 4; i++) g.fillCircle(-70 + i * 14, 19, 2.5);
  // Seat
  g.fillStyle(0x14141a, 1);
  g.fillRoundedRect(-58, -22, 38, 8, 3);
  // Handlebars + stem
  g.lineStyle(8, 0x14141a, 1);
  g.lineBetween(80, 0, 100, -40);
  g.lineBetween(85, -42, 125, -32);
  // Headlight
  g.fillStyle(0xfff3a0, 1);
  g.fillCircle(108, -10, 6);
  // Orange accent plate on downtube
  g.fillStyle(0xff6b00, 1);
  g.fillRoundedRect(-10, 12, 28, 14, 3);

  // ===== REAR RACK + ORANGE INFANT SEAT =====
  // Rack tube frame (black) — top rail above rear wheel, two support arms
  g.lineStyle(5, 0x14141a, 1);
  g.lineBetween(-48, -30, -152, -30);   // top rail
  g.lineBetween(-50, -28, -58, -20);    // front arm (to seat post)
  g.lineBetween(-148, -28, -110, 30);   // rear arm (to wheel hub)
  g.lineBetween(-130, -30, -110, 30);   // secondary diagonal brace

  // Cushion base
  g.fillStyle(0xff8a3d, 1);
  g.fillRoundedRect(-150, -52, 84, 24, 9);
  // Cushion top highlight
  g.fillStyle(0xffaf68, 0.8);
  g.fillRoundedRect(-146, -50, 74, 5, 3);
  // Cushion bottom shadow
  g.fillStyle(0x000000, 0.22);
  g.fillRoundedRect(-148, -32, 80, 4, 2);

  // High backrest (rear of seat)
  g.fillStyle(0xff8a3d, 1);
  g.fillRoundedRect(-152, -94, 26, 46, 11);
  // Headrest cap (slightly flared top)
  g.fillRoundedRect(-156, -98, 34, 12, 7);
  // Backrest highlight
  g.fillStyle(0xffaf68, 0.85);
  g.fillRoundedRect(-150, -92, 8, 40, 4);
  // Backrest shadow on the right edge (depth)
  g.fillStyle(0x000000, 0.18);
  g.fillRoundedRect(-132, -90, 4, 40, 2);

  // Side wing (visible side bolster)
  g.fillStyle(0xff7020, 1);
  g.fillRoundedRect(-148, -50, 10, 22, 4);
  g.fillRoundedRect(-78, -50, 10, 22, 4);

  // Safety harness bar (U-shape arching over child)
  g.lineStyle(4, 0x14141a, 1);
  g.lineBetween(-150, -42, -138, -60);
  g.lineBetween(-138, -60, -82, -60);
  g.lineBetween(-82, -60, -70, -42);
  // Buckle in center
  g.fillStyle(0xfbbf24, 1);
  g.fillRoundedRect(-115, -64, 16, 9, 2);
  g.fillStyle(0x14141a, 1);
  g.fillCircle(-107, -59, 2);

  // Small footrest peg hanging below seat
  g.fillStyle(0x14141a, 1);
  g.fillRoundedRect(-92, -10, 14, 5, 2);
}

// The parts of the ebike's orange seat that sit in front of a rider: the lower
// half of the cushion, both side bolsters and the harness bar with its buckle.
// Redrawn over the pet while it rides (see _ebikeCharging); matches drawRadPower.
function drawEbikeSeatFront(g) {
  g.fillStyle(0xff8a3d, 1);
  g.fillRoundedRect(-150, -42, 84, 14, { tl: 0, tr: 0, bl: 9, br: 9 });
  g.fillStyle(0x000000, 0.22);
  g.fillRoundedRect(-148, -32, 80, 4, 2);
  g.fillStyle(0xff7020, 1);
  g.fillRoundedRect(-148, -50, 10, 22, 4);
  g.fillRoundedRect(-78, -50, 10, 22, 4);
  g.lineStyle(4, 0x14141a, 1);
  g.lineBetween(-150, -42, -138, -60);
  g.lineBetween(-138, -60, -82, -60);
  g.lineBetween(-82, -60, -70, -42);
  g.fillStyle(0xfbbf24, 1);
  g.fillRoundedRect(-115, -64, 16, 9, 2);
  g.fillStyle(0x14141a, 1);
  g.fillCircle(-107, -59, 2);
}

// 10. Shoe rack: Dad's racers and the three kids' pairs, at the room's scale
// (the kids' bikes are 92 to 124 px, so a grown-up shoe is about 110 px).
// Kids' pairs are graded small to big like the bikes, Dad's pair on the right.
// Each pair is two side views, the far shoe a shade darker, set back on the
// shelf top. Dad's near shoe is drawn separately by _shoesDad so the pet can
// ride it; its partner stays here on the rack.
const DAD_SHOE = {
  upper: 0xf1e9d8, shade: 0xd8ccb3, mid: 0xffffff, sole: 0x2b2b30,
  accent: 0xff6a1a, lace: 0xbfb39a, lining: 0x3a3a40, band: true
};
const KID_SHOE = {
  upper: 0xffffff, shade: 0xe6e0ea, mid: 0xffd6e8, sole: 0xff5fa2,
  accent: 0xff7eb6, lace: 0xff7eb6, lining: 0xb8467a, band: false
};
// Near shoe x (node space) and length for each pair, left to right.
const SHOE_PAIRS = [
  { x: -230, len: 65, pal: KID_SHOE },
  { x: -105, len: 78, pal: KID_SHOE },
  { x: 34, len: 90, pal: KID_SHOE },
  { x: 191, len: 110, pal: DAD_SHOE }
];
const SHOE_SHELF_Y = 38;     // near shoes stand on the shelf's front edge
const SHOE_BACK_Y = 32;      // far shoes stand further back on the shelf top

function drawShoeRack(g) {
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(0, 78, 580, 12);
  // Shelf: the top face the far shoes stand on, then the front edge
  g.fillStyle(0x4a3c2e, 1);
  g.fillRoundedRect(-280, 26, 560, 14, 4);
  g.fillStyle(0x3a2f24, 1);
  g.fillRoundedRect(-280, SHOE_SHELF_Y, 560, 18, 4);
  g.fillStyle(0x2a2218, 1);
  g.fillRect(-280, 52, 560, 4);
  for (const p of SHOE_PAIRS) {
    const back = shadeShoePalette(p.pal, 0.8);
    drawRacerShoe(g, p.x + Math.round(p.len * 0.14), SHOE_BACK_Y, p.len, back);
    if (p.pal !== DAD_SHOE) drawRacerShoe(g, p.x, SHOE_SHELF_Y, p.len, p.pal);
  }
}

// A palette one shade darker, for the far shoe of a pair.
function shadeShoePalette(pal, f) {
  const dim = c => {
    const r = Math.round(((c >> 16) & 255) * f);
    const gr = Math.round(((c >> 8) & 255) * f);
    const b = Math.round((c & 255) * f);
    return (r << 16) | (gr << 8) | b;
  };
  const out = { ...pal };
  for (const k of ['upper', 'shade', 'mid', 'sole', 'accent', 'lace', 'lining']) out[k] = dim(pal[k]);
  return out;
}

// Side view of a low racing shoe, toe to the right. (ox, oy) is the ground
// under the middle of the sole and `len` its length toe to heel. Thin sole,
// low foam midsole with a little toe spring, a snug sock-like upper with the
// collar about 0.3 x len up. Dad's palette adds the curved side accent.
function drawRacerShoe(g, ox, oy, len, pal) {
  const u = len / 100;
  const P = pts => pts.map(([x, y]) => ({ x: ox + x * u, y: oy + y * u }));

  // Outsole
  g.fillStyle(pal.sole, 1);
  g.fillPoints(P([[-49, 0], [28, 0], [40, -1.5], [48, -4.5], [50, -7.5], [46, -8], [38, -5],
    [28, -3.5], [-49, -3.5], [-51, -1.5]]), true);
  // Midsole foam
  g.fillStyle(pal.mid, 1);
  g.fillPoints(P([[-49, -3.5], [-51, -8], [-50, -13], [-30, -13], [0, -11.5], [25, -10],
    [42, -9.5], [49, -9.5], [50, -7.5], [46, -6], [38, -4.5], [28, -3.5]]), true);

  // Upper
  g.fillStyle(pal.upper, 1);
  g.fillPoints(P([[-50, -12.5], [-51, -21], [-50, -29], [-47, -35], [-41, -33.5], [-35, -30],
    [-26, -30], [-19, -34], [-14, -33], [-8, -28.5], [5, -23.5], [20, -19.5], [33, -16.5],
    [42, -13.5], [48, -10.5], [49, -9.5], [42, -9.5], [25, -10], [0, -11.5], [-30, -13]]), true);
  // Shade along the bottom of the upper, where it meets the foam
  g.fillStyle(pal.shade, 1);
  g.fillPoints(P([[-50, -12.5], [-50, -16], [-30, -16.5], [0, -14.5], [25, -12.5], [42, -11.5],
    [48, -10.5], [49, -9.5], [42, -9.5], [25, -10], [0, -11.5], [-30, -13]]), true);
  // Collar lining, the dark rim of the opening
  g.fillStyle(pal.lining, 1);
  g.fillPoints(P([[-46, -34], [-41, -33.5], [-35, -30], [-26, -30], [-21, -32.5], [-22, -30],
    [-27, -28], [-35, -28], [-41, -31]]), true);
  // Heel counter
  g.fillStyle(pal.accent, 1);
  g.fillPoints(P([[-50, -13], [-51, -21], [-50, -29], [-47, -35], [-43, -34.5], [-44, -27],
    [-44, -13]]), true);

  if (pal.band) {
    // Curved side accent: an even band from the midfoot up to the heel.
    const A = [12, -13.5], C = [-14, -11.5], B = [-42, -25], T = 3.6;
    const lo = [], hi = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, m = 1 - t;
      const x = m * m * A[0] + 2 * m * t * C[0] + t * t * B[0];
      const y = m * m * A[1] + 2 * m * t * C[1] + t * t * B[1];
      lo.push([x, y]);
      hi.unshift([x, y - T]);
    }
    g.fillStyle(pal.accent, 1);
    g.fillPoints(P(lo.concat(hi)), true);
  }

  // Centred lacing: short ties down the throat
  g.lineStyle(Math.max(1.5, 2 * u), pal.lace, 1);
  for (let i = 0; i < 4; i++) {
    const x = -13 + i * 6, y = -31 + i * 2.2;
    g.lineBetween(ox + (x - 2) * u, oy + (y - 1.5) * u, ox + (x + 2) * u, oy + (y + 1.5) * u);
  }
  // Soft highlight along the top of the foot
  g.lineStyle(Math.max(1, 1.6 * u), 0xffffff, 0.5);
  g.lineBetween(ox - 6 * u, oy - 27 * u, ox + 20 * u, oy - 18.5 * u);
}
