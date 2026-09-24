// Dad's Garage exploration scene.

import Phaser from 'phaser';
import { progress, findWorld } from '../GameData.js';
import { audio } from '../AudioManager.js';
import { music } from '../MusicManager.js';
import { TransitionManager } from '../TransitionManager.js';
import { style } from '../textStyles.js';
import { createButton } from '../buttonHelper.js';
import { createModal } from '../modalHelper.js';
import { companion, drawCompanion } from '../CompanionManager.js';
import { anchorXY } from '../PetSprites.js';
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
// by the garage whiteboard, which letters its note onto a fixed-height panel:
// the shared note pool contains everything from one-liners to short stories, and
// an unbounded note would run off the board. The full text is always one tap
// away in showDailyNotePopup, so a trimmed teaser loses nothing.
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

// Object labels in every secret room share one style. 32px keeps them near
// 11pt on a 393pt-wide iPhone; the old 20px read at about 7pt. Each room keeps
// its own ink colors.
const ROOM_LABEL_STYLE = { fontSize: '32px', fontStyle: '800', strokeThickness: 5 };

function addRoomLabel(scene, x, y, text, fill, stroke) {
  return scene.add.text(x, y, text, style('caption', { ...ROOM_LABEL_STYLE, fill, stroke }))
    .setOrigin(0.5).setDepth(8);
}

// The message box sizes itself to its text. Rooms dock it in the top strip
// (the same band the fixed box always used, so it covers nothing new there);
// the garage docks it at the bottom, in the empty floor strip under the shoe
// rack, because its top row and the pet climbing on it sit under the top strip.
// Nothing in the garage is drawn or walks below about y 1730.
const BUBBLE_DOCK_Y = { top: 420, bottom: 1828 };
const BUBBLE_MAX_W = 960;
const BUBBLE_MAX_H = 170;
const BUBBLE_PAD_X = 48;
const BUBBLE_PAD_Y = 24;

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
      // Quilchena playground / Point Grey track — the "RECESS" hidden world.
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
    const items = [
      { id: 'freezer',  x: 175,    y: 580,  hitW: 240, hitH: 200, draw: drawChestFreezer, label: 'Chest freezer' },
      { id: 'rack',     x: 470,    y: 580,  hitW: 240, hitH: 320, draw: drawStorageRack,  label: 'Pantry rack' },
      { id: 'bins',     x: 690,    y: 600,  hitW: 200, hitH: 200, draw: drawStorageBins,  label: 'Storage bins' },
      { id: 'squat',    x: 940,    y: 600,  hitW: 220, hitH: 280, draw: drawSquatRack,    label: 'Squat rack' },
      { id: 'laptop',   x: 215,    y: 950,  hitW: 240, hitH: 200, draw: drawMacBook,      label: 'Laptop' },
      { id: 'printer',  x: 470,    y: 950,  hitW: 200, hitH: 200, draw: drawBambuA1,      label: '3D printer' },
      { id: 'stroller', x: 760,    y: 950,  hitW: 280, hitH: 260, draw: drawUppababyVista,label: 'Stroller' },
      { id: 'bikes',    x: 250,    y: 1280, hitW: 360, hitH: 220, draw: drawKidsBikes,    label: "Kids' bikes" },
      { id: 'ebike',    x: 760,    y: 1280, hitW: 360, hitH: 240, draw: drawRadPower,     label: 'Ebike' },
      { id: 'shoes',    x: W / 2,  y: 1560, hitW: 760, hitH: 200, draw: drawShoeRack,     label: 'Running shoes' }
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

      addRoomLabel(this, item.x, item.y + item.hitH / 2 + 16, item.label, '#ffd86b', '#0a0a1a');

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

    // After the objects: the pet's routines use the node table above.
    this.createGaragePet();

    const leaveBtn = createButton(this, {
      x: W - 130, y: 100, label: 'Leave',
      width: 200, height: 80,
      color: 0x9a9aae,
      textOverrides: { fontSize: '24px', fill: '#ffffff' },
      onClick: () => {
        // Crossfade back to the host chapter's ambient (the map re-confirms it).
        const homeKey = this.world?.chapter === 2
          ? music.resolveTrack(this, 'innerSpaceHome', 'homeTheme')
          : 'homeTheme';
        music.fadeToTrack(this, homeKey);
        this.scene.start('WorldMapScene');
      }
    });
    leaveBtn.setDepth(15);
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
    fitTextToBox(t, text, BUBBLE_MAX_H - BUBBLE_PAD_Y * 2, [42, 38, 34, 30]);
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
    // where they were found.
    const { card, close } = createModal(this, {
      width: 880, height: 660,
      accentColor: 0xffd86b,
      showCloseHint: false,
      onClose: () => {
        this.refreshGaragePet();
        this.garagePetInteract('bins');
      }
    });
    card.add(this.add.text(0, -220, 'YOU FOUND IT!', style('display', {
      fontSize: '60px',
      fill: '#ffd86b',
      stroke: '#0a0a1a',
      strokeThickness: 5
    })).setOrigin(0.5));
    card.add(this.add.text(0, -130, 'Tucked away in the storage bins.', style('caption', {
      fontSize: '24px',
      fill: '#cfcfe0',
      align: 'center'
    })).setOrigin(0.5));

    // Show the pet wearing the freshly-equipped glasses.
    const previewPet = drawCompanion(this, 0, 20, { scale: 1.4 });
    card.add(previewPet);

    card.add(this.add.text(0, 150, "Unlocked: Dad's Glasses", style('subhead', {
      fontSize: '32px',
      fill: '#ffd86b',
      align: 'center'
    })).setOrigin(0.5));

    card.add(createButton(this, {
      x: 0, y: 240, width: 320, height: 92,
      label: 'Sweet',
      color: 0xffd86b,
      textOverrides: { fontSize: '28px', fill: '#0a0a1a', fontStyle: '900' },
      // Stay in the garage after finding the glasses — just dismiss the card.
      // The kid keeps exploring and leaves on their own via the Leave button.
      onClick: () => close()
    }));
    return card;
  }

  // ----------------------------------------------------------
  // GARAGE EXTRAS — whiteboard + pet companion + leave handling
  // ----------------------------------------------------------
  createWhiteboard() {
    // Pull today's note; mark as claimed if it's a new day.
    const { isNewDay, message } = progress.claimDailyNoteForBoard(DAD_NOTES, 'garage');
    let stardustAwarded = false;
    if (isNewDay) {
      progress.economy.stardust = (progress.economy.stardust || 0) + 10;
      progress.save();
      stardustAwarded = true;
    }

    // Whiteboard frame, mounted on the wall above the pegboard.
    const wb = this.add.container(W / 2, 268).setDepth(3);
    const frame = this.add.graphics();
    // Outer frame
    frame.fillStyle(0x2a2620, 1);
    frame.fillRoundedRect(-220, -60, 440, 120, 6);
    // White marker board
    frame.fillStyle(0xfafaf0, 1);
    frame.fillRoundedRect(-212, -52, 424, 104, 4);
    // Marker tray
    frame.fillStyle(0x4a3f30, 1);
    frame.fillRoundedRect(-220, 56, 440, 8, 2);
    frame.fillStyle(0xff5b6e, 1);
    frame.fillCircle(-160, 60, 5);
    frame.fillStyle(0x39ff14, 1);
    frame.fillCircle(-130, 60, 5);
    wb.add(frame);

    // The day's message, hand-lettered feel. This board shows the note INLINE on
    // a fixed 424x104 panel, and the shared pool holds some long notes, so shrink
    // to fit and fall back to a trimmed teaser — tapping opens the full text.
    const noteText = this.add.text(0, 0, message, style('body', {
      fontSize: '20px',
      fill: '#2a1f12',
      align: 'center',
      wordWrap: { width: 400 },
      fontStyle: 'italic'
    })).setOrigin(0.5);
    fitTextToBox(noteText, message, 96, [20, 18, 16, 14, 13]);
    wb.add(noteText);

    // "NEW +10 ✨" badge if this is a fresh claim — fades on tap.
    let badge = null;
    if (stardustAwarded) {
      badge = this.add.container(208, -52);
      const badgeBg = this.add.graphics();
      badgeBg.fillStyle(0xffd86b, 1);
      badgeBg.fillRoundedRect(-44, -22, 88, 44, 8);
      badgeBg.lineStyle(2, 0x2a1f12, 1);
      badgeBg.strokeRoundedRect(-44, -22, 88, 44, 8);
      badge.add(badgeBg);
      badge.add(this.add.text(0, -4, 'NEW', style('caption', {
        fontSize: '14px',
        fill: '#2a1f12',
        fontStyle: '900'
      })).setOrigin(0.5));
      badge.add(this.add.text(0, 10, '+10 ✨', style('caption', {
        fontSize: '12px',
        fill: '#2a1f12'
      })).setOrigin(0.5));
      wb.add(badge);
      this.tweens.add({
        targets: badge,
        scale: { from: 1, to: 1.08 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    const hit = this.add.rectangle(W / 2, 268, 460, 130, 0, 0)
      .setInteractive({ useHandCursor: true }).setDepth(4);
    hit.on('pointerdown', () => {
      audio.playClick?.();
      if (badge) {
        const fading = badge;
        badge = null;
        this.tweens.add({
          targets: fading,
          alpha: 0, scale: 0.6, duration: 350,
          onComplete: () => fading.destroy()
        });
      }
      this.showDailyNotePopup(message);
    });
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

    const board = this.add.graphics();
    board.fillStyle(0x2a2620, 1);
    board.fillRoundedRect(-380, -280, 760, 560, 10);
    board.fillStyle(0xfafaf0, 1);
    board.fillRoundedRect(-368, -268, 736, 536, 6);
    card.add(board);

    // Scale the type to the note length so long recess notes still fit the board
    // while short garage notes stay big and bold.
    const len = message ? message.length : 0;
    const fontSize = len > 190 ? 34 : len > 150 ? 38 : len > 110 ? 42 : len > 70 ? 48 : 52;
    card.add(this.add.text(0, 0, message, style('body', {
      fontSize: fontSize + 'px',
      fill: '#2a1f12',
      align: 'center',
      wordWrap: { width: 680 },
      fontStyle: 'italic',
      lineSpacing: Math.round(fontSize * 0.26)
    })).setOrigin(0.5));
  }

  // ----------------------------------------------------------
  // GARAGE PET: roams the garage and uses each object in turn.
  // ----------------------------------------------------------
  // It walks to an object, does that object's routine (sits in the ebike seat,
  // climbs into the stroller, watches a print...), rests a moment, then takes
  // the next stop off a shuffled deck. Tapping an object queues that object
  // next: a tap cuts a rest short but never a routine in progress, so no lid is
  // left open and no bike is left mid-roll. Every routine takes a `done`
  // callback and hands the pet back on the floor, out of any object.
  //
  // Routines that put the pet IN something move it inside that object's node
  // (_gpEnter), under the object's front piece (_gpBehind): it then breathes
  // and rocks with the object, and the front piece hides its lower half.
  createGaragePet() {
    // Reset first: these fields outlive the scene, and a stale pet, a busy flag
    // or a queued tap left over from a mid-routine exit would wedge the next visit.
    this._garagePetContainer = null;
    this._garagePetSprite = null;
    this._gpBusy = false;
    this._gpQueued = null;
    this._gpRestTimer = null;
    this._gpIdleTween = null;
    this._gpHeld = null;
    this._gpHost = null;
    this._gpHostNode = null;
    this._gpDeck = [];
    this._gpLast = null;
    this._gpFacing = -1;
    if (!companion.hasStarter()) return;

    const pet = this.add.container(540, 0).setDepth(11);
    this._garagePetContainer = pet;
    this._garagePetSprite = drawCompanion(this, 0, 0, { scale: 1.1 });
    pet.add(this._garagePetSprite);
    // Starts on the open floor between the desk row and the bikes.
    pet.y = 1180 - this._gpFoot();

    // Tap → chirp + heart particle
    const hit = this.add.rectangle(0, 0, 130, 130, 0, 0)
      .setInteractive({ useHandCursor: true });
    pet.add(hit);
    hit.on('pointerdown', () => {
      audio.playPetChirp?.();
      this._gpEmote('♥');
    });

    this._gpRest(1200);
  }

  // Redraw the in-scene garage pet so a cosmetic equipped mid-visit (e.g. Dad's
  // Glasses from the storage bins) shows up right away instead of next visit.
  // No-op when there's no starter pet (createGaragePet bailed).
  refreshGaragePet() {
    if (!this._garagePetContainer?.active || !this._garagePetSprite) return;
    this._garagePetSprite.destroy();
    this._garagePetSprite = drawCompanion(this, 0, 0, { scale: 1.1 });
    // addAt(…, 0) keeps the pet below the transparent tap hit-rect.
    this._garagePetContainer.addAt(this._garagePetSprite, 0);
    this._gpFace(this._gpFacing);
  }

  // A tap on an object: that object is next. Starts right away if the pet is
  // resting; otherwise it runs as soon as the current routine finishes.
  garagePetInteract(id) {
    if (!this._garagePetContainer?.active) return;
    this._gpQueued = id;
    if (!this._gpBusy) this._gpNext();
  }

  _gpNext() {
    const pet = this._garagePetContainer;
    if (!pet?.active || this._gpBusy) return;
    this._gpRestTimer?.remove(false);
    this._gpRestTimer = null;
    this._gpIdleTween?.stop();
    this._gpIdleTween = null;
    pet.angle = 0;
    const queued = this._gpQueued;
    const id = queued || this._gpDraw();
    this._gpQueued = null;
    // A tapped stop comes off this round's deck, so it can't come straight
    // back as the next random pick.
    if (queued) {
      const i = this._gpDeck.indexOf(queued);
      if (i >= 0) this._gpDeck.splice(i, 1);
    }
    this._gpLast = id;
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

  // Every stop once per shuffled round, never the same one twice in a row.
  _gpDraw() {
    if (!this._gpDeck.length) {
      const ids = ['freezer', 'rack', 'bins', 'squat', 'laptop', 'printer',
        'stroller', 'bikes', 'ebike', 'shoes', 'lamp'];
      Phaser.Utils.Array.Shuffle(ids);
      if (ids[0] === this._gpLast) ids.push(ids.shift());
      this._gpDeck = ids;
    }
    return this._gpDeck.shift();
  }

  // Between routines: stand and look around, then go. A queued tap keeps the
  // pause short.
  _gpRest(ms) {
    const pet = this._garagePetContainer;
    if (!pet?.active) return;
    if (this._gpHost) this._gpExit();
    this._gpDrop();
    pet.setScale(1);
    pet.angle = 0;
    this._gpBusy = false;
    if (ms == null) ms = this._gpQueued ? 250 : 2200 + Math.random() * 2400;
    const face0 = this._gpFacing;
    const look = { p: 0 };
    this._gpIdleTween = this.tweens.add({
      targets: look, p: 1, duration: ms,
      onUpdate: () => {
        if (ms > 900) {
          const want = (look.p > 0.4 && look.p < 0.75) ? -face0 : face0;
          if (want !== this._gpFacing) this._gpFace(want);
        }
        pet.angle = Math.sin(look.p * Math.PI * 2) * 3;
      }
    });
    this._gpRestTimer = this.time.delayedCall(ms, () => this._gpNext());
  }

  // ----- Garage pet helpers -----

  // Distance from the pet's origin down to its feet at a given scale. Sprites
  // differ a lot by species and stage (an egg is ~100px tall, an ember adult
  // ~150px), so every "stand on" / "sit in" spot is worked out from this.
  _gpFoot(scale = this._garagePetContainer?.scaleY ?? 1) {
    const layout = this._garagePetSprite?.layout;
    return (layout ? layout.height / 2 : 60) * 1.1 * scale;
  }

  // How far the pet's eyes sit above its origin at a given scale (negative is
  // up), from the sprite's own head_eye anchor. Tide adults are short and wide
  // with low-set eyes, ember adults tall with high ones, so a fixed fraction of
  // the height hides some pets' eyes below a rim.
  _gpEyeY(scale = this._garagePetContainer?.scaleY ?? 1) {
    const spr = this._garagePetSprite;
    if (!spr?.layout || !spr.species) return -this._gpFoot(scale) * 0.4;
    return anchorXY(spr.species.id, spr.stage, 'head_eye', spr.layout).y * 1.1 * scale;
  }

  // Origin y that sinks the pet into something (freezer, bin, bassinet, shoe)
  // with its eyes just clear of the rim at `rimY`.
  _gpPeek(rimY, scale) {
    return rimY - 20 * scale - this._gpEyeY(scale);
  }

  // Half the pet's width at a given scale (for holding things at its side).
  _gpHalfW(scale = this._garagePetContainer?.scaleX ?? 1) {
    const layout = this._garagePetSprite?.layout;
    return (layout ? layout.width / 2 : 60) * 1.1 * scale;
  }

  // Pet sprites face left by default; mirror the sprite to face right.
  _gpFace(dir) {
    this._gpFacing = dir > 0 ? 1 : -1;
    const s = this._garagePetSprite;
    if (s) s.scaleX = Math.abs(s.scaleY) * (this._gpFacing > 0 ? -1 : 1);
  }

  // A point in an object's own coordinates, in scene coordinates.
  _gpAt(host, x, y) {
    return host.getWorldTransformMatrix().transformPoint(x, y);
  }

  // Where the pet is in scene coordinates, hosted or not.
  _gpWorld() {
    const pet = this._garagePetContainer;
    return this._gpHost ? this._gpAt(this._gpHost, pet.x, pet.y) : { x: pet.x, y: pet.y };
  }

  // A little heart / letter floating up off the pet's head.
  _gpEmote(text, color = '#ff9ec7', size = 36) {
    const at = this._gpWorld();
    const t = this.add.text(at.x + 30, at.y - this._gpFoot() - 6, text, style('display', {
      fontSize: size + 'px', fill: color
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
    const pet = this._garagePetContainer;
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
    const pet = this._garagePetContainer;
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
    const pet = this._garagePetContainer;
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
    this._gpHost.moveBelow(this._garagePetContainer, front);
  }
  _gpInFront() {
    this._gpHost.bringToTop(this._garagePetContainer);
  }

  // Tween to (x, y) in whatever space the pet is in.
  _gpTo(x, y, dur, cb, ease = 'Quad.easeInOut') {
    this.tweens.add({
      targets: this._garagePetContainer, x, y, duration: dur, ease,
      onComplete: () => cb?.()
    });
  }

  // Jump along an arc to (x, y), `h` px above the straight line at its peak.
  // `scale` resizes on the way (how it tucks in to fit a seat); `onMid` runs
  // once, just past the peak (used to drop in behind a front piece).
  _gpJump(x, y, h, dur, cb, { scale = null, onMid = null } = {}) {
    const pet = this._garagePetContainer;
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
    const pet = this._garagePetContainer;
    const y0 = pet.y;
    this.tweens.add({
      targets: pet, y: y0 - h, duration: 150, yoyo: true, repeat: n - 1,
      ease: 'Sine.easeOut', onComplete: () => { pet.y = y0; cb?.(); }
    });
  }

  // Squash on landing, feet kept planted.
  _gpSquash(cb, amt = 0.16) {
    const pet = this._garagePetContainer;
    const s = pet.scaleY, y0 = pet.y, foot = this._gpFoot(s);
    this.tweens.add({
      targets: pet, scaleX: s * (1 + amt), scaleY: s * (1 - amt), y: y0 + foot * amt,
      duration: 110, yoyo: true, ease: 'Sine.easeOut',
      onComplete: () => { pet.setScale(s); pet.y = y0; cb?.(); }
    });
  }

  // A few quick side-to-side jitters (a shiver, a scrabble, a dig).
  _gpJitter(n, dx, cb, dAngle = 0) {
    const pet = this._garagePetContainer;
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
    const pet = this._garagePetContainer;
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
    const pet = this._garagePetContainer;
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
    const pet = this._garagePetContainer;
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
    const pet = this._garagePetContainer;
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
    const pet = this._garagePetContainer;
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
    const pet = this._garagePetContainer;
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
    const pet = this._garagePetContainer;
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

  // Stroller (760,950): try to climb into the bassinet. The first go bonks off
  // the side, the second gets its paws over the rim and slips back, the third
  // makes it: it snuggles down under the hood and rocks along with the stroller.
  gpStrollerClimb(done) {
    const node = this._garageNode?.stroller;
    const parts = node?.gParts;
    if (!parts) { done(); return; }
    const pet = this._garagePetContainer;
    const S0 = 0.8, S = 0.6;
    const stand = { x: 180, y: 120 - this._gpFoot(1) };
    const low = { x: 132, y: 120 - this._gpFoot(S0) };
    const bonk = { x: 88, y: -26 - this._gpFoot(S0) * 0.2 };
    const rim = { x: 70, y: -54 - this._gpFoot(S0) * 0.55 };
    const inside = { x: 26, y: this._gpPeek(-54, S) };
    const slide = (cb) => this.tweens.add({
      targets: pet, x: low.x, y: low.y, angle: 10, duration: 380, ease: 'Quad.easeIn',
      onComplete: () => { pet.angle = 0; this._gpSquash(() => this._gpJitter(2, 5, cb, -8)); }
    });
    const at = this._gpAt(node, stand.x, stand.y);
    this._gpWalkTo(at.x, at.y, () => {
      this._gpEnter(node);
      this._gpFace(-1);
      this._gpJump(bonk.x, bonk.y, 40, 380, () => slide(() => {
        this._gpJump(rim.x, rim.y, 80, 440, () => this._gpJitter(6, 4, () => slide(() => {
          this._gpJump(inside.x, inside.y, 130, 560, () => this._gpSquash(() => {
            // Face out the open front, eyes away from the hood.
            this._gpFace(1);
            this._gpSnooze(3, () => {
              this._gpInFront();
              parts.front.setVisible(false);
              this._gpJump(stand.x, stand.y, 90, 520, () => { this._gpExit(); done(); }, { scale: 1 });
            });
          }), { scale: S, onMid: () => this._gpBehind(parts.front) });
        }), 6));
      }), { scale: S0 });
    });
  }

  // Settle in for a nap: slow breaths and a few z's drifting up.
  _gpSnooze(n, cb) {
    const pet = this._garagePetContainer;
    const s = pet.scaleY, y0 = pet.y;
    let k = 0;
    const breathe = () => {
      this._gpEmote('z', '#cfe3ff', 28 + k * 6);
      this.tweens.add({
        targets: pet, scaleY: s * 0.92, y: y0 + this._gpFoot(s) * 0.08,
        duration: 420, yoyo: true, ease: 'Sine.easeInOut',
        onComplete: () => {
          pet.setScale(s);
          pet.y = y0;
          if (++k < n) breathe();
          else cb?.();
        }
      });
    };
    breathe();
  }

  // Kids' bikes (250,1280): climb onto the orange bike, wobble forward like a
  // first ride without training wheels, roll back steady, cheer, hop off.
  gpBikeRide(done) {
    const node = this._garageNode?.bikes;
    const parts = node?.gParts;
    if (!parts) { done(); return; }
    const pet = this._garagePetContainer;
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
    const pet = this._garagePetContainer;
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

  // Running shoes (540,1560): hop into the teal runner, which hops off the rack
  // and zooms across the floor and back, kicking up dust, then hops home.
  gpShoeZoom(done) {
    const node = this._garageNode?.shoes;
    const parts = node?.gParts;
    if (!parts) { done(); return; }
    const shoe = parts.shoe;
    const S = 0.55;
    const f = this._gpFoot(S);
    const standN = { x: -40, y: 150 - this._gpFoot(1) };   // node space, floor below the rack
    const inShoe = { x: -14, y: this._gpPeek(-32, S) };      // shoe space, down in the opening
    const floorY = 110;                                      // node space: open floor under the rack
    const at = this._gpAt(node, standN.x, standN.y);
    this._gpWalkTo(at.x, at.y, () => {
      this._gpEnter(shoe);
      this._gpFace(1);
      this._gpJump(inShoe.x, inShoe.y, 70, 460, () => this._gpSquash(go),
        { scale: S, onMid: () => this._gpBehind(parts.body) });
    });
    const hop = (toY, cb) => {
      const y0 = shoe.y;
      const drv = { p: 0 };
      this.tweens.add({
        targets: drv, p: 1, duration: 360, ease: 'Linear',
        onUpdate: () => { shoe.y = y0 + (toY - y0) * drv.p - Math.sin(drv.p * Math.PI) * 40; },
        onComplete: () => { shoe.y = toY; cb?.(); }
      });
    };
    const zoom = (toX, dur, cb) => {
      const dust = this.time.addEvent({
        delay: 70, loop: true,
        callback: () => {
          const h = this._gpAt(shoe, -80, 22);             // the heel, whichever way it faces
          this._gpPuffs(h.x, h.y, 0xbdb6c4, 2, 16, 18);
        }
      });
      this.tweens.add({
        targets: shoe, x: toX, duration: dur, ease: 'Sine.easeInOut',
        onComplete: () => { dust.remove(false); cb?.(); }
      });
    };
    const turn = (cb) => this.tweens.add({
      targets: shoe, scaleX: -shoe.scaleX, duration: 160, ease: 'Sine.easeInOut', onComplete: cb
    });
    const go = () => this.tweens.add({
      targets: shoe, angle: { from: -6, to: 6 }, duration: 110, yoyo: true, repeat: 1,
      onComplete: () => {
        shoe.angle = 0;
        hop(floorY, () => zoom(360, 560, () => turn(() => zoom(-360, 900, () => turn(() =>
          zoom(0, 560, () => hop(parts.home.y, () => {
            this._gpInFront();
            this._gpJump(standN.x - shoe.x, standN.y - shoe.y, 70, 460, () => { this._gpExit(); done(); }, { scale: 1 });
          })))))));
      }
    });
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
      case 'shoes':    return this._shoesTeal(node);
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

  // Stroller: a gentle rock, like soothing a baby. (Pivots near the wheels.)
  _strollerRock(node) {
    this.tweens.add({
      targets: node, angle: { from: -2.4, to: 2.4 },
      duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
    node.gParts = { front: this._garageFront(node, drawStrollerBassinet) };
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

  // Shoe rack: the teal middle runner as its own piece so the pet can ride it.
  _shoesTeal(node) {
    const home = { x: 0, y: 14 };
    const shoe = this.add.container(home.x, home.y);
    const sg = this.add.graphics();
    drawCuteShoe(sg, 0, 0, 0xfff5e6, 0x4ecdc4);
    shoe.add(sg);
    node.add(shoe);
    node.gParts = { shoe, body: sg, home };
  }

  // ============================================================
  // RECESS — Quilchena playground hidden inside "Inner Space".
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

    // Companion pet standing on the woodchips, kept for the monkey-bar swing.
    this.createRecessPet();

    // Bubble copy lives inline — short, warm, kid-friendly.
    // Roomy 3-row layout across the woodchips; the running track is a separate
    // full-width band along the very bottom (added after this loop).
    const items = [
      // labelDx: the slide's ladder stands inside the tower's right edge, so the
      // tower's label sits a little left of center to clear it.
      { id: 'tower',   x: 250,  y: 900,  hitW: 320, hitH: 420, draw: drawPlayStructure, label: 'Play tower',
        labelDx: -20, bubble: "You can't catch me!" },
      { id: 'slide',   x: 470,  y: 980,  hitW: 270, hitH: 400, draw: drawWavySlide,     label: 'Big slide',
        bubble: 'Cheeeeoooh!' },
      { id: 'bars',    x: 840,  y: 920,  hitW: 360, hitH: 360, draw: drawMonkeyBars,    label: 'Monkey bars',
        bubble: 'Slow is smooth, smooth is fast.' },
      { id: 'wall',    x: 160,  y: 1330, hitW: 220, hitH: 280, draw: drawClimbingWall,  label: 'Climbing wall',
        bubble: 'Watch your step!' },
      { id: 'zipline', x: 490,  y: 1330, hitW: 280, hitH: 240, draw: drawZipLine,       label: 'Zip line',
        bubble: 'Yeeehawww!' },
      { id: 'tire',    x: 850,  y: 1330, hitW: 250, hitH: 380, draw: drawTireSwing,     label: 'Tire swing',
        bubble: 'Hold on tight!!' },
      { id: 'spinner', x: 230,  y: 1580, hitW: 170, hitH: 200, draw: drawSpinnerSeat,   label: 'Spinner',
        bubble: 'Dizzy!' }
    ];
    // (The soccer goal now lives on the turf field at the top, not the woodchips;
    //  the bottom row pairs the spinner with Dad's notes board.)

    for (const item of items) {
      const node = this.add.container(item.x, item.y).setDepth(8);
      const g = this.add.graphics();
      item.draw(g);
      node.add(g);
      // Stash each node so the spinner tap can rotate its own disc.
      this['_recessNode_' + item.id] = node;
      this.tweens.add({
        targets: node,
        scale: { from: 1, to: 1.03 },
        duration: 1500 + Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      addRoomLabel(this, item.x + (item.labelDx || 0), item.y + item.hitH / 2 + 14, item.label, '#ffffff', '#1a3a18');

      const hit = this.add.rectangle(item.x, item.y, item.hitW, item.hitH, 0, 0)
        .setInteractive({ useHandCursor: true }).setDepth(9);

      hit.on('pointerdown', () => {
        audio.playClick?.();
        // The bars run their own unlock messaging; everyone else gets a bubble.
        if (item.id !== 'bars') this.showBubble(item.x, item.y, item.bubble);
        this.petInteract(item.id);
      });
    }

    // Dad's notes board on the woodchips — same daily mechanic as the garage
    // whiteboard (its own list + its own once-per-day stardust). Sits low enough
    // that it never overlaps the "Zip line" label in the row above.
    this.createNotesBoard(560, 1592, { boardKey: 'playground' });

    // The running track spans the entire bottom of the screen (drawn in the
    // backdrop). One full-width hit zone lets the pet dash a lap.
    const trackTop = H - 178;
    // Second lane, so the full-size label clears "Dad's notes" standing on the
    // track's edge above it.
    addRoomLabel(this, W / 2, trackTop + 66, 'RUNNING TRACK', '#f4f8ff', '#173a63').setDepth(9);
    const trackHit = this.add.rectangle(W / 2, (trackTop + H) / 2, W, H - trackTop, 0, 0)
      .setInteractive({ useHandCursor: true }).setDepth(9);
    trackHit.on('pointerdown', () => {
      audio.playClick?.();
      this.showBubble(W / 2, trackTop + 40, 'Super fast!');
      this.petRunTrack();
    });

    const leaveBtn = createButton(this, {
      x: W - 130, y: 100, label: 'Leave',
      width: 200, height: 80,
      color: 0x9a9aae,
      textOverrides: { fontSize: '24px', fill: '#ffffff' },
      onClick: () => {
        const homeKey = this.world?.chapter === 2
          ? music.resolveTrack(this, 'innerSpaceHome', 'homeTheme')
          : 'homeTheme';
        music.fadeToTrack(this, homeKey);
        this.scene.start('WorldMapScene');
      }
    });
    leaveBtn.setDepth(15);
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
    // Cream Collegiate-Gothic Point Grey building with a corner spire tower.
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

  // Companion pet on the woodchips; kept as `this._recessPet` for the swing.
  createRecessPet() {
    if (!companion.hasStarter()) return;
    this._recessPetHome = { x: 770, y: 1650 };
    const c = this.add.container(this._recessPetHome.x, this._recessPetHome.y).setDepth(11);
    this._recessPet = c;
    this._recessPetSprite = drawCompanion(this, 0, 0, { scale: 1.1 });
    c.add(this._recessPetSprite);

    this._recessPetBob = this.tweens.add({
      targets: c,
      y: this._recessPetHome.y - 8,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
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

  // Dad's notes board. Same daily mechanic as the garage whiteboard, but its own
  // note list and its own once-per-day claim: one note per real day off a
  // separate shuffled deck, +10 stardust the first time it's tapped each day. A
  // "NEW +10 ✨" badge marks a fresh claim.
  //
  // Parameterized because there are now two of these (the Recess woodchips board
  // and the Hot Pot table board), differing only in deck, save key and the
  // ground-label stroke that keeps it readable against its own backdrop. Defaults
  // are the Recess values, so the playground call site reads exactly as before.
  createNotesBoard(x, y, {
    boardKey = 'playground',
    labelStroke = '#1a3a18',
    onTap = null
  } = {}) {
    const { isNewDay, message } = progress.claimDailyNoteForBoard(DAD_NOTES, boardKey);
    let awarded = false;
    if (isNewDay) {
      progress.economy.stardust = (progress.economy.stardust || 0) + 10;
      progress.save();
      awarded = true;
    }

    const node = this.add.container(x, y).setDepth(8);
    const g = this.add.graphics();
    drawDadNotesBoard(g);
    node.add(g);
    this.tweens.add({
      targets: node, scale: { from: 1, to: 1.03 },
      duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    // Header + affordance lettered onto the parchment.
    node.add(this.add.text(0, -46, "DAD'S NOTES", style('caption', {
      fontSize: '22px', fill: '#2a1f12', fontStyle: '900'
    })).setOrigin(0.5));
    node.add(this.add.text(0, 8, 'Tap to read', style('caption', {
      fontSize: '18px', fill: '#6a5a44', fontStyle: 'italic'
    })).setOrigin(0.5));

    // Ground label, matching the other equipment.
    addRoomLabel(this, x, y + 132, "Dad's notes", '#ffffff', labelStroke);

    // NEW +10 ✨ badge on a fresh day; fades + stops bobbing on tap.
    let badge = null;
    let badgeTween = null;
    if (awarded) {
      badge = this.add.container(120, -72);
      const bg = this.add.graphics();
      bg.fillStyle(0xffd86b, 1); bg.fillRoundedRect(-50, -24, 100, 48, 9);
      bg.lineStyle(2, 0x2a1f12, 1); bg.strokeRoundedRect(-50, -24, 100, 48, 9);
      badge.add(bg);
      badge.add(this.add.text(0, -6, 'NEW', style('caption', { fontSize: '15px', fill: '#2a1f12', fontStyle: '900' })).setOrigin(0.5));
      badge.add(this.add.text(0, 11, '+10 ✨', style('caption', { fontSize: '13px', fill: '#2a1f12' })).setOrigin(0.5));
      node.add(badge);
      badgeTween = this.tweens.add({
        targets: badge, scale: { from: 1, to: 1.1 },
        duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    }

    const hit = this.add.rectangle(x, y, 244, 230, 0, 0)
      .setInteractive({ useHandCursor: true }).setDepth(9);
    hit.on('pointerdown', () => {
      audio.playClick?.();
      if (badge) {
        const fading = badge; badge = null;
        badgeTween?.stop();
        this.tweens.add({ targets: fading, alpha: 0, scale: 0.6, duration: 350, onComplete: () => fading.destroy() });
      }
      // The reaction waits for the popup to close, so it plays in the open
      // room rather than hidden behind the modal dim.
      this.showDailyNotePopup(message, onTap);
    });
  }

  // ----- Pet interactions: the companion actually plays on each piece -----
  // One shared busy-guard so taps can't overlap mid-animation.
  _startPetAction() {
    if (this._petActive || !this._recessPet) return false;
    this._petActive = true;
    this._recessPetBob?.pause();
    this._recessPet.setScale(1);
    this._recessPet.angle = 0;
    return true;
  }

  _returnPetHome(onDone) {
    const pet = this._recessPet;
    const home = this._recessPetHome;
    this.tweens.add({
      targets: pet, x: home.x, y: home.y, angle: 0, duration: 440, ease: 'Quad.easeInOut',
      onComplete: () => {
        pet.angle = 0; pet.setScale(1);
        this._petActive = false;
        this._recessPetBob?.resume();
        onDone?.();
      }
    });
  }

  _petMoveTo(x, y, dur, cb, ease) {
    this.tweens.add({ targets: this._recessPet, x, y, duration: dur, ease: ease || 'Quad.easeInOut', onComplete: cb });
  }

  // Route an equipment tap to the matching pet activity (busy-guarded).
  petInteract(id) {
    if (!this._recessPet || this._petActive) return;
    switch (id) {
      case 'tower':   return this.petClimbTower();
      case 'slide':   return this.petSlide();
      case 'bars':    return this.handleMonkeyBars();
      case 'wall':    return this.petClimbWall();
      case 'zipline': return this.petZipLine();
      case 'tire':    return this.petTireSwing();
      case 'spinner': return this.petSpin();
    }
  }

  // Play tower (250,900): climb to the top deck, happy hop, climb down.
  petClimbTower() {
    if (!this._startPetAction()) return;
    const pet = this._recessPet;
    this._petMoveTo(262, 1120, 360, () => {
      this._petMoveTo(262, 778, 640, () => {
        this.tweens.add({ targets: pet, y: 752, duration: 220, yoyo: true, repeat: 1, ease: 'Sine.easeInOut',
          onComplete: () => this._returnPetHome() });
      }, 'Sine.easeInOut');
    });
  }

  // Big slide (470,980): climb the ladder, then ride the chute down.
  petSlide() {
    if (!this._startPetAction()) return;
    const pet = this._recessPet;
    this._petMoveTo(388, 1160, 320, () => {
      this._petMoveTo(402, 800, 520, () => {
        this.tweens.add({ targets: pet, x: 590, duration: 640, ease: 'Quad.easeIn',
          onUpdate: (tw) => { const p = tw.progress; pet.y = 805 + 318 * (p * p * (3 - 2 * p)); pet.angle = 12 * Math.sin(p * Math.PI); },
          onComplete: () => this._returnPetHome() });
      }, 'Sine.easeInOut');
    });
  }

  // Climbing wall (160,1330): scoot up the holds with a little side-to-side.
  petClimbWall() {
    if (!this._startPetAction()) return;
    const pet = this._recessPet;
    this._petMoveTo(160, 1478, 340, () => {
      this.tweens.add({ targets: pet, y: 1208, duration: 900, ease: 'Sine.easeInOut',
        onUpdate: (tw) => { pet.x = 160 + Math.sin(tw.progress * Math.PI * 5) * 12; },
        onComplete: () => this._returnPetHome() });
    });
  }

  // Zip line (490,1330): grab the handle and zoom along the rail.
  petZipLine() {
    if (!this._startPetAction()) return;
    const pet = this._recessPet;
    this._petMoveTo(380, 1300, 340, () => {
      this.tweens.add({ targets: pet, x: 604, duration: 950, ease: 'Sine.easeIn',
        onUpdate: (tw) => { const p = tw.progress; pet.y = 1300 + Math.sin(p * Math.PI) * 10; pet.angle = 6 * Math.sin(p * Math.PI * 3); },
        onComplete: () => this._returnPetHome() });
    });
  }

  // Tire swing (850,1330): hop in and swing back and forth.
  petTireSwing() {
    if (!this._startPetAction()) return;
    const pet = this._recessPet;
    this._petMoveTo(850, 1405, 360, () => {
      const drv = { p: 0 };
      this.tweens.add({ targets: drv, p: 1, duration: 1600, ease: 'Linear',
        onUpdate: () => { const s = Math.sin(drv.p * Math.PI * 4); pet.x = 850 + s * 80; pet.angle = s * 14; },
        onComplete: () => this._returnPetHome() });
    });
  }

  // Spinner (230,1580): stand on the seat and spin (the disc spins too).
  petSpin() {
    if (!this._startPetAction()) return;
    const pet = this._recessPet;
    const disc = this._recessNode_spinner;
    this._petMoveTo(230, 1542, 340, () => {
      if (disc) this.tweens.add({ targets: disc, angle: '+=720', duration: 900, ease: 'Cubic.easeOut' });
      this.tweens.add({ targets: pet, angle: '+=720', duration: 900, ease: 'Cubic.easeOut',
        onComplete: () => this._returnPetHome() });
    });
  }

  // Running track: a wide lap along the full-width band at the bottom.
  petRunTrack() {
    if (!this._startPetAction()) return;
    const pet = this._recessPet;
    const trackY = H - 84;
    const drv = { p: 0 };
    this.tweens.add({
      targets: drv, p: 1, duration: 1700, ease: 'Sine.easeInOut',
      onUpdate: () => {
        const a = drv.p * Math.PI * 2;
        pet.x = W / 2 + Math.cos(a - Math.PI / 2) * 400;
        pet.y = trackY + Math.sin(a - Math.PI / 2) * 26;
      },
      onComplete: () => this._returnPetHome()
    });
  }

  // Monkey bars (840,920) — the hidden gem. Pet swings across; first clear
  // pops the unlock, replays just say "Again!".
  handleMonkeyBars() {
    if (!this._startPetAction()) return;
    const firstTime = !progress.isHiddenWorldCleared(18);
    this._petMoveTo(700, 870, 360, () => {
      this.playMonkeyBarSwing(() => {
        this._returnPetHome(() => {
          if (firstTime) this.showRecessUnlock();
          else this.showBubble(840, 1110, 'Slow is smooth, smooth is fast.');
        });
      });
    });
  }

  // Hand-over-hand left→right along the bars (pet already at the start rung).
  playMonkeyBarSwing(onDone) {
    const pet = this._recessPet;
    const barY = 870, startX = 700, endX = 980, rungs = 6;
    pet.y = barY; pet.setScale(1);
    let i = 0;
    const stepX = (endX - startX) / rungs;
    const swingNext = () => {
      if (i >= rungs) { onDone?.(); return; }
      const nx = startX + stepX * (i + 1);
      this.tweens.add({
        targets: pet, x: nx, angle: { from: -8, to: 8 }, duration: 280, ease: 'Sine.easeInOut',
        onUpdate: (tw) => { pet.y = barY - Math.sin(tw.progress * Math.PI) * 26; },
        onComplete: () => { pet.angle = 0; i++; swingNext(); }
      });
    };
    swingNext();
  }

  // Found-it celebration — models on showUnlockCelebration.
  showRecessUnlock() {
    progress.clearHiddenWorld(18);
    cosmetics.addAndEquip('acc_dried_mango');
    audio.playMatch?.();

    const { card, close } = createModal(this, {
      width: 880, height: 660,
      accentColor: 0x7ed957,
      showCloseHint: false
    });
    card.add(this.add.text(0, -220, 'YOU FOUND IT!', style('display', {
      fontSize: '60px',
      fill: '#7ed957',
      stroke: '#0a2a12',
      strokeThickness: 5
    })).setOrigin(0.5));
    card.add(this.add.text(0, -130, 'You crossed the monkey bars!', style('caption', {
      fontSize: '24px',
      fill: '#cfcfe0',
      align: 'center'
    })).setOrigin(0.5));

    // Pet preview holding the freshly-equipped dried mango.
    const previewPet = drawCompanion(this, 0, 20, { scale: 1.4 });
    card.add(previewPet);

    card.add(this.add.text(0, 150, 'Unlocked: Dried Mango', style('subhead', {
      fontSize: '32px',
      fill: '#7ed957',
      align: 'center'
    })).setOrigin(0.5));

    card.add(createButton(this, {
      x: 0, y: 240, width: 320, height: 92,
      label: 'Awesome',
      color: 0x7ed957,
      textOverrides: { fontSize: '28px', fill: '#0a2a12', fontStyle: '900' },
      onClick: () => {
        this.refreshRecessPet();
        close();
      }
    }));
    return card;
  }

  // Redraw the in-scene pet so the just-equipped medal shows up immediately.
  refreshRecessPet() {
    if (!this._recessPet?.active || !this._recessPetSprite) return;
    this._recessPetSprite.destroy();
    this._recessPetSprite = drawCompanion(this, 0, 0, { scale: 1.1 });
    this._recessPet.addAt(this._recessPetSprite, 0);
  }


  // Woodchips tap → a few chips scatter up and settle back.
  scatterWoodchips(cx, cy) {
    for (let i = 0; i < 7; i++) {
      const chip = this.add.graphics().setDepth(10);
      const tone = Math.random() < 0.5 ? 0xb38a52 : 0xddc294;
      chip.fillStyle(tone, 1);
      chip.fillRect(-5, -2, 10, 4);
      chip.setPosition(cx + (Math.random() - 0.5) * 40, cy);
      chip.rotation = Math.random() * Math.PI;
      const dx = (Math.random() - 0.5) * 120;
      const up = 40 + Math.random() * 50;
      this.tweens.add({
        targets: chip,
        x: chip.x + dx,
        duration: 520,
        ease: 'Quad.easeOut',
        onUpdate: (tw) => {
          const p = tw.progress;
          chip.y = cy - Math.sin(p * Math.PI) * up;
          chip.rotation += 0.12;
        },
        onComplete: () => chip.destroy()
      });
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

    // Dad's notes board — the third independent daily deck (family/sharing/
    // people), its own once-per-day claim so all three can be read in one day.
    // Mounted on the wall beside the table rather than on a stand.
    this.createNotesBoard(560, 1180, {
      boardKey: 'hotpot',
      labelStroke: '#2a1008',
      onTap: () => this.hotPotPetInteract('board')
    });

    this.createHotPotPet();

    const leaveBtn = createButton(this, {
      x: W - 130, y: 100, label: 'Leave',
      width: 200, height: 80,
      color: 0x9a9aae,
      textOverrides: { fontSize: '24px', fill: '#ffffff' },
      onClick: () => {
        music.fadeToTrack(this, music.resolveTrack(this, 'homeGroundHome', 'homeTheme'));
        this.scene.start('WorldMapScene');
      }
    });
    leaveBtn.setDepth(15);
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
      tag.add(this.add.text(0, 0, '83', style('caption', {
        fontSize: '28px', fill: '#8a3a1e', fontStyle: '900'
      })).setOrigin(0.5));
      tag.setScale(0.4).setAlpha(0);
      this.tweens.add({
        targets: tag, y: pet.y - 76, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut',
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
          const loot = this.add.text(pet.x + 26, pet.y - 34, '🍜', style('display', {
            fontSize: '30px'
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

  // Dad's notes (560,1180): trot over and look up at the board while it's read.
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

    const { card, close } = createModal(this, {
      width: 880, height: 660,
      accentColor: 0xffb85c,
      showCloseHint: false
    });
    card.add(this.add.text(0, -220, 'YOU FOUND IT!', style('display', {
      fontSize: '60px',
      fill: '#ffb85c',
      stroke: '#2a1008',
      strokeThickness: 5
    })).setOrigin(0.5));
    card.add(this.add.text(0, -130, 'The one at the end. On the house.', style('caption', {
      fontSize: '24px',
      fill: '#cfcfe0',
      align: 'center'
    })).setOrigin(0.5));

    const previewPet = drawCompanion(this, 0, 20, { scale: 1.4 });
    card.add(previewPet);

    card.add(this.add.text(0, 150, 'Unlocked: Free Cone', style('subhead', {
      fontSize: '32px',
      fill: '#ffb85c',
      align: 'center'
    })).setOrigin(0.5));

    card.add(createButton(this, {
      x: 0, y: 240, width: 320, height: 92,
      label: 'Yes!',
      color: 0xffb85c,
      textOverrides: { fontSize: '28px', fill: '#2a1008', fontStyle: '900' },
      // Stay in the room after the cone — the kid keeps exploring and leaves on
      // their own, same as the garage.
      onClick: () => {
        this.refreshHotPotPet();
        close();
      }
    }));
    return card;
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

// Warm Art-Deco / Collegiate school (Point Grey Secondary feel): warm buff stone
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

// Composite play tower — red posts, decks, green peaked roof, yellow panel.
function drawPlayStructure(g) {
  g.fillStyle(0x000000, 0.18); g.fillEllipse(0, 200, 240, 30);
  g.fillStyle(0xd6342b, 1);
  for (const px of [-110, -40, 40, 110]) g.fillRect(px - 7, -150, 14, 350);
  g.fillStyle(0x2f6ea0, 1); g.fillRoundedRect(-120, 20, 240, 26, 6);
  g.fillStyle(0x3a8044, 1); g.fillRoundedRect(-120, -60, 240, 24, 6);
  g.fillStyle(0x3aa0c0, 1); g.fillRect(-120, -30, 8, 50); g.fillRect(112, -30, 8, 50);
  g.fillStyle(0x2f8a4a, 1); g.fillTriangle(0, -210, -90, -150, 90, -150);
  g.fillStyle(0x37a257, 1); g.fillTriangle(0, -196, -70, -152, 70, -152);
  g.fillStyle(0xf2c43a, 1); g.fillRoundedRect(-30, 70, 60, 84, 8);
  g.fillStyle(0x2f6ea0, 1); for (const hx of [-16, 0, 16]) g.fillCircle(hx, 112, 6);
}

// A nice, thick playground slide — red ladder/tower on the left, a smooth wide
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

  // smooth thick chute: parametric centerline → offset upper/lower edges
  const N = 26, half = 30;
  const cx = (t) => -70 + 168 * t;
  const cy = (t) => -176 + 330 * (t * t * (3 - 2 * t));      // smoothstep down
  const ang = (t) => Math.atan2(
    cy(Math.min(1, t + 0.001)) - cy(Math.max(0, t - 0.001)),
    cx(Math.min(1, t + 0.001)) - cx(Math.max(0, t - 0.001)));
  const edge = (off) => {
    const pts = [];
    for (let i = 0; i <= N; i++) { const t = i / N, a = ang(t); pts.push([cx(t) + Math.sin(a) * off, cy(t) - Math.cos(a) * off]); }
    return pts;
  };
  const upper = edge(half), lower = edge(-half), inner = edge(half * 0.4);
  const fillBetween = (a, b, color) => {
    g.fillStyle(color, 1);
    g.beginPath(); g.moveTo(a[0][0], a[0][1]);
    for (const p of a) g.lineTo(p[0], p[1]);
    for (let i = b.length - 1; i >= 0; i--) g.lineTo(b[i][0], b[i][1]);
    g.closePath(); g.fillPath();
  };
  fillBetween(upper, lower, 0x2f78c8);     // bed
  fillBetween(upper, inner, 0x6fb3ef);     // bright top surface
  // raised side rails
  g.lineStyle(8, 0x1f5a99, 1);
  g.beginPath(); g.moveTo(upper[0][0], upper[0][1]); for (const p of upper) g.lineTo(p[0], p[1]); g.strokePath();
  g.beginPath(); g.moveTo(lower[0][0], lower[0][1]); for (const p of lower) g.lineTo(p[0], p[1]); g.strokePath();
  // run-out lip
  g.fillStyle(0x2f6ea0, 1); g.fillRoundedRect(70, 150, 64, 16, 6);
}

// Tire swing — red A-frame with a black tire on chains (hole shows woodchips).
function drawTireSwing(g) {
  g.fillStyle(0x000000, 0.16); g.fillEllipse(0, 182, 150, 24);
  g.lineStyle(14, 0xd6342b, 1);
  g.lineBetween(-104, 176, -46, -148);     // splayed legs
  g.lineBetween(104, 176, 46, -148);
  g.lineStyle(15, 0xc02d24, 1);
  g.lineBetween(-58, -150, 58, -150);       // top bar
  g.lineStyle(4, 0x8a8a96, 1);              // chains
  g.lineBetween(-20, -146, -20, 34);
  g.lineBetween(20, -146, 20, 34);
  g.lineBetween(0, -146, 0, 30);
  g.fillStyle(0x17171c, 1); g.fillCircle(0, 82, 56);       // tire
  g.fillStyle(0xc7a06a, 1); g.fillCircle(0, 82, 28);       // hole → woodchips
  g.fillStyle(0x0d0d11, 1);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillCircle(Math.cos(a) * 47, 82 + Math.sin(a) * 47, 4.5); }
  g.lineStyle(3, 0x39393f, 1); g.strokeCircle(0, 82, 56); g.strokeCircle(0, 82, 28);
  g.fillStyle(0xffffff, 0.12); g.fillEllipse(-18, 64, 26, 12);
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

// Zip line / track ride — an overhead rail with a rolling trolley + a handle
// the kids grab and slide across.
function drawZipLine(g) {
  g.fillStyle(0x000000, 0.16); g.fillEllipse(0, 110, 220, 22);
  // two red end posts (right slightly taller — the cable rides downhill)
  g.fillStyle(0xd6342b, 1); g.fillRect(-128, -96, 14, 206); g.fillRect(114, -110, 14, 220);
  g.fillStyle(0xc02d24, 1); g.fillRect(-128, -96, 14, 30); g.fillRect(114, -110, 14, 30);
  // top rail / cable
  g.lineStyle(7, 0x7a828c, 1); g.lineBetween(-122, -86, 122, -100);
  g.lineStyle(2, 0xb6bcc4, 1); g.lineBetween(-122, -89, 122, -103);
  // trolley on the rail
  g.fillStyle(0x3a3f47, 1); g.fillRoundedRect(-28, -102, 56, 20, 5);
  g.fillStyle(0x9aa0aa, 1); g.fillCircle(-15, -84, 6); g.fillCircle(15, -84, 6);
  // ropes down to a grip handle
  g.lineStyle(5, 0x2f6ea0, 1); g.lineBetween(-13, -82, -16, 18); g.lineBetween(13, -82, 16, 18);
  // yellow grip bar
  g.fillStyle(0xf2c43a, 1); g.fillRoundedRect(-30, 14, 60, 18, 9);
  g.lineStyle(3, 0xd99a1f, 1); g.strokeRoundedRect(-30, 14, 60, 18, 9);
}

// Blue disc spinner-seat on a red post.
function drawSpinnerSeat(g) {
  g.fillStyle(0x000000, 0.16); g.fillEllipse(0, 95, 90, 18);
  g.fillStyle(0xd6342b, 1); g.fillRect(-8, -10, 16, 105);
  g.fillStyle(0x1f5a99, 1); g.fillEllipse(0, -10, 120, 20);
  g.fillStyle(0x2f78c8, 1); g.fillEllipse(0, -22, 120, 40);
  g.fillStyle(0x3a86d8, 1); g.fillEllipse(0, -28, 110, 30);
  g.fillStyle(0xffffff, 0.4); g.fillEllipse(-24, -32, 40, 12);
}

// Dad's notes board — a parchment notice board on two wooden posts. Headers and
// the "Tap to read" affordance are added as text by createRecessNoteBoard.
function drawDadNotesBoard(g) {
  // ground shadow
  g.fillStyle(0x000000, 0.16); g.fillEllipse(0, 124, 150, 22);
  // posts
  g.fillStyle(0x6e4a28, 1); g.fillRect(-70, 38, 15, 86); g.fillRect(55, 38, 15, 86);
  g.fillStyle(0x855c34, 1); g.fillRect(-70, 38, 5, 86); g.fillRect(55, 38, 5, 86);
  // dark wood frame
  g.fillStyle(0x5e3d22, 1); g.fillRoundedRect(-118, -96, 236, 146, 12);
  g.fillStyle(0x7a5230, 1); g.fillRoundedRect(-118, -96, 236, 9, 6);
  // parchment surface
  g.fillStyle(0xf5ecd6, 1); g.fillRoundedRect(-104, -82, 208, 118, 6);
  g.fillStyle(0xe9dcbd, 1); g.fillRect(-104, 22, 208, 14);
  // divider under the header
  g.fillStyle(0xcdbf9a, 1); g.fillRect(-84, -26, 168, 3);
  // two red thumbtacks
  for (const tx of [-84, 84]) {
    g.fillStyle(0xc23a3a, 1); g.fillCircle(tx, -68, 6);
    g.fillStyle(0xff9a9a, 0.85); g.fillCircle(tx - 2, -70, 2.2);
  }
}

// Monkey bars — the hidden gem. Horizontal overhead ladder on tall red posts.
function drawMonkeyBars(g) {
  g.fillStyle(0x000000, 0.18); g.fillEllipse(0, 172, 300, 28);
  g.fillStyle(0xd6342b, 1); g.fillRect(-160, -120, 16, 290); g.fillRect(144, -120, 16, 290);
  g.fillStyle(0xd6342b, 1); g.fillRect(-160, -120, 320, 14); g.fillRect(-160, -98, 320, 10);
  g.fillStyle(0xe85a52, 1);
  for (let rx = -140; rx <= 140; rx += 40) g.fillRect(rx - 5, -118, 10, 30);
  g.fillStyle(0xfff3b8, 0.9); g.fillCircle(0, -150, 4); g.fillCircle(70, -140, 3); g.fillCircle(-80, -138, 3);
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
    c.add(scene.add.text(R * 0.87, R * 0.26, '83', style('caption', {
      fontSize: Math.round(R * 0.38) + 'px', fill: '#8a3a1e', fontStyle: '900'
    })).setOrigin(0.5));
  }

  return c;
}

// The Night Shift map node (W20): the grocery store (world 31) seen from outside
// after closing. A dark storefront with exactly one window still lit. Reads at
// node scale because it's one bright square in a dark block, and it says the
// thing the room is about without a symbol: somebody is still in there
// restocking.
export function drawNightShiftNode(scene, x, y, R) {
  const c = scene.add.container(x, y);
  const cleared = progress.isHiddenWorldCleared(20);

  // Cool halo — the night around the building, brighter once it's been cleared.
  const halo = scene.add.graphics();
  halo.fillStyle(0x8fd0ff, cleared ? 0.24 : 0.12);
  halo.fillCircle(0, 0, R + (cleared ? 18 : 13));
  c.add(halo);

  const g = scene.add.graphics();
  // Ground shadow, then the dark shop block.
  g.fillStyle(0x05070f, 0.5);
  g.fillEllipse(0, R * 0.72, R * 1.9, R * 0.4);
  g.fillStyle(0x151d2e, 1);
  g.fillRoundedRect(-R * 0.85, -R * 0.5, R * 1.7, R * 1.25, 6);
  // Flat roof lip, catching a little of the night sky.
  g.fillStyle(0x223049, 1);
  g.fillRect(-R * 0.95, -R * 0.62, R * 1.9, R * 0.16);
  c.add(g);

  // Three windows. Two dark, one lit — the shift that stayed.
  const dark = scene.add.graphics();
  dark.fillStyle(0x0b1120, 1);
  dark.fillRect(-R * 0.62, -R * 0.28, R * 0.34, R * 0.34);
  dark.fillRect(-R * 0.14, -R * 0.28, R * 0.34, R * 0.34);
  c.add(dark);

  const lit = scene.add.graphics();
  // Soft spill first (plain ellipse, no rays), then the window itself.
  lit.fillStyle(0xffd98a, 0.22);
  lit.fillEllipse(R * 0.51, -R * 0.11, R * 1.05, R * 0.8);
  lit.fillStyle(cleared ? 0xffe6ad : 0xf5c46a, 1);
  lit.fillRect(R * 0.34, -R * 0.28, R * 0.34, R * 0.34);
  // Window bar, so it reads as a pane rather than a glowing tile.
  lit.fillStyle(0x8a6a30, 1);
  lit.fillRect(R * 0.34, -R * 0.13, R * 0.34, R * 0.04);
  c.add(lit);
  scene.tweens.add({
    targets: lit,
    alpha: { from: 1, to: 0.72 },
    duration: 2200,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });

  // Door, always dark — she's inside, not coming out.
  const door = scene.add.graphics();
  door.fillStyle(0x0b1120, 1);
  door.fillRoundedRect(-R * 0.2, R * 0.24, R * 0.4, R * 0.51, 3);
  c.add(door);

  // Cleared: the last crate, placed and squared up by the door on the way out.
  if (cleared) {
    const crate = scene.add.graphics();
    crate.fillStyle(0x6b7a99, 1);
    crate.fillRoundedRect(R * 0.36, R * 0.42, R * 0.36, R * 0.33, 3);
    crate.lineStyle(2, 0x2b3852, 1);
    crate.strokeRoundedRect(R * 0.36, R * 0.42, R * 0.36, R * 0.33, 3);
    c.add(crate);
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
  // The number is 83, the family's number.
  card.add(scene.add.text(0, -46, '83', style('caption', {
    fontSize: '58px', fill: '#8a3a1e', fontStyle: '900'
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

// 7. Premium bassinet stroller — side profile. Tan bassinet with black hood,
// chrome-accent A-frame, big rear wheel + smaller front wheel.
function drawUppababyVista(g) {
  // Ground shadow
  g.fillStyle(0x000000, 0.45);
  g.fillEllipse(0, 120, 290, 16);

  // FRAME — rear-tilted A with chrome highlights
  g.lineStyle(9, 0x14141a, 1);
  g.lineBetween(-100, 100, -10, -50);   // rear strut
  g.lineBetween(90, 95, 30, -50);       // front strut
  g.lineBetween(-100, 100, 90, 95);     // lower cross brace
  // Chrome sheen on each tube
  g.lineStyle(2, 0xb0b0bc, 0.6);
  g.lineBetween(-95, 95, -8, -46);
  g.lineBetween(87, 92, 32, -46);
  // Frame joint pivots (silver pucks)
  g.fillStyle(0xcdcdd4, 1);
  g.fillCircle(-10, -50, 6);
  g.fillCircle(30, -50, 6);
  g.fillStyle(0x2a2a32, 1);
  g.fillCircle(-10, -50, 2.5);
  g.fillCircle(30, -50, 2.5);

  // Handle bar diagonal — extends up-back from rear strut top
  g.lineStyle(10, 0x14141a, 1);
  g.lineBetween(-10, -50, -55, -90);
  // Leather grip wrap (UPPAbaby signature)
  g.fillStyle(0x6e4a28, 1);
  g.fillRoundedRect(-78, -98, 36, 14, 6);
  // Stitching detail on grip
  g.lineStyle(1, 0xc09060, 0.8);
  g.lineBetween(-75, -94, -45, -94);
  g.lineBetween(-75, -90, -45, -90);

  drawStrollerBassinet(g);

  // WHEELS: big rear, smaller front, with chrome rims
  // Rear wheel
  g.fillStyle(0x14141a, 1);
  g.fillCircle(-100, 100, 28);
  g.lineStyle(2, 0x3a3a44, 1);
  g.strokeCircle(-100, 100, 28);
  // Chrome rim ring
  g.fillStyle(0xcdcdd4, 1);
  g.fillCircle(-100, 100, 11);
  g.fillStyle(0x14141a, 1);
  g.fillCircle(-100, 100, 3.5);
  // Spokes (chrome)
  g.lineStyle(2, 0xcdcdd4, 0.95);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.lineBetween(-100, 100, -100 + Math.cos(a) * 24, 100 + Math.sin(a) * 24);
  }
  // Front wheel
  g.fillStyle(0x14141a, 1);
  g.fillCircle(90, 95, 22);
  g.lineStyle(2, 0x3a3a44, 1);
  g.strokeCircle(90, 95, 22);
  g.fillStyle(0xcdcdd4, 1);
  g.fillCircle(90, 95, 9);
  g.fillStyle(0x14141a, 1);
  g.fillCircle(90, 95, 3);
  g.lineStyle(2, 0xcdcdd4, 0.95);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.lineBetween(90, 95, 90 + Math.cos(a) * 18, 95 + Math.sin(a) * 18);
  }
}

// Stroller bassinet + hood. Also redrawn as the front piece the pet snuggles
// down behind (see _strollerRock), so only its head shows over the rim.
function drawStrollerBassinet(g) {
  // BASSINET — tan curved pod with leather accent strip
  // Body
  g.fillStyle(0xb88f5c, 1);
  g.fillRoundedRect(-70, -50, 130, 50, 16);
  // Soften bottom curve (subtle wider ellipse blends into rounded rect)
  g.fillEllipse(-5, -2, 130, 14);
  // Top rim (lighter cream band)
  g.fillStyle(0xd4b58a, 1);
  g.fillRoundedRect(-70, -54, 130, 12, 8);
  // Rim top highlight
  g.fillStyle(0xefd1a8, 0.85);
  g.fillRoundedRect(-66, -52, 122, 3, 2);
  // Leather accent strip (signature horizontal band)
  g.fillStyle(0x4a3018, 1);
  g.fillRoundedRect(-58, -18, 110, 8, 3);
  // Strip stitching
  g.lineStyle(1, 0xc09060, 0.7);
  g.lineBetween(-54, -14, 48, -14);
  // Small leather label patch
  g.fillStyle(0x8a5828, 1);
  g.fillRoundedRect(20, -8, 22, 6, 2);

  // HOOD — smooth black dome over rear half of bassinet
  g.fillStyle(0x14141a, 1);
  g.beginPath();
  g.arc(-30, -50, 48, Math.PI, Math.PI * 2);
  g.fillPath();
  // Hood rib stitches (concentric arcs)
  g.lineStyle(2, 0x2a2a32, 1);
  for (const r of [40, 30, 20]) {
    g.beginPath();
    g.arc(-30, -50, r, Math.PI, Math.PI * 2);
    g.strokePath();
  }
  // Hood subtle top sheen
  g.fillStyle(0xffffff, 0.10);
  g.fillEllipse(-30, -90, 40, 6);
  // Peek-a-boo window (small mesh panel at top)
  g.fillStyle(0x4a6a7a, 0.8);
  g.fillRoundedRect(-40, -94, 20, 7, 2);
  g.lineStyle(1, 0x8a9aa6, 0.5);
  g.lineBetween(-38, -91, -22, -91);
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

// 10. Shoe rack with three chunky cute runners side-by-side.
function drawShoeRack(g) {
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(0, 78, 700, 12);
  // Rack shelf
  g.fillStyle(0x3a2f24, 1);
  g.fillRoundedRect(-340, 38, 680, 18, 4);
  g.fillStyle(0x2a2218, 1);
  g.fillRect(-340, 52, 680, 4);
  // Three runners: cream upper with different accent pops. The teal middle
  // one (0, 14) is drawn separately by _shoesTeal so the pet can ride it.
  drawCuteShoe(g, -210, 14, 0xfff5e6, 0xff66aa); // pink
  drawCuteShoe(g, 210, 14, 0xfff5e6, 0xff8a3d);  // orange
}

// Side-profile chunky runner: stacked sole, puffy upper, big toe box,
// tongue + heel pull, lace bow. Designed to read as cute, not technical.
function drawCuteShoe(g, ox, oy, upperColor, accent) {
  // Soft ground shadow
  g.fillStyle(0x000000, 0.28);
  g.fillEllipse(ox + 4, oy + 28, 160, 10);

  // OUTSOLE — rubber, slightly tan
  g.fillStyle(0xd0c8b6, 1);
  g.fillRoundedRect(ox - 75, oy + 12, 162, 14, 7);
  // Toe rocker bump
  g.fillCircle(ox + 82, oy + 16, 10);

  // MIDSOLE — chunky white foam
  g.fillStyle(0xfdfaf2, 1);
  g.fillRoundedRect(ox - 75, oy - 4, 162, 20, 12);
  // Toe spring (curls up)
  g.fillCircle(ox + 82, oy + 6, 14);
  // Heel block (taller wedge)
  g.fillRoundedRect(ox - 78, oy - 14, 40, 30, 12);

  // Midsole top sheen
  g.fillStyle(0xffffff, 0.8);
  g.fillRoundedRect(ox - 70, oy - 3, 152, 3, 2);
  // Midsole bottom shadow
  g.fillStyle(0x000000, 0.12);
  g.fillRoundedRect(ox - 70, oy + 13, 152, 3, 2);

  // Plate accent stripe through sole
  g.fillStyle(accent, 1);
  g.fillRoundedRect(ox - 75, oy + 8, 162, 5, 2);

  // UPPER — puffy rounded mound
  g.fillStyle(upperColor, 1);
  // Main body ellipse
  g.fillEllipse(ox - 6, oy - 18, 138, 38);
  // Toe dome (round, cute)
  g.fillCircle(ox + 58, oy - 8, 22);
  // Heel cup
  g.fillCircle(ox - 62, oy - 12, 18);

  // Upper bottom shadow band (where it meets sole)
  g.fillStyle(0x000000, 0.15);
  g.fillEllipse(ox - 6, oy - 2, 134, 5);
  // Upper top highlight
  g.fillStyle(0xffffff, 0.45);
  g.fillEllipse(ox - 10, oy - 30, 92, 6);

  // Tongue (poking up at ankle)
  g.fillStyle(upperColor, 1);
  g.fillRoundedRect(ox - 24, oy - 40, 28, 20, 9);
  // Tongue base shadow
  g.fillStyle(0x000000, 0.18);
  g.fillRoundedRect(ox - 24, oy - 24, 28, 4, 2);
  // Tongue logo tab
  g.fillStyle(accent, 1);
  g.fillRoundedRect(ox - 18, oy - 36, 16, 7, 2);

  // Curved side swoosh
  g.lineStyle(8, accent, 1);
  g.beginPath();
  g.moveTo(ox - 38, oy - 4);
  g.lineTo(ox + 18, oy - 18);
  g.lineTo(ox + 48, oy - 10);
  g.strokePath();
  // Swoosh inner sheen
  g.lineStyle(2.5, 0xffffff, 0.55);
  g.beginPath();
  g.moveTo(ox - 32, oy - 8);
  g.lineTo(ox + 14, oy - 18);
  g.strokePath();

  // Eyelets
  g.fillStyle(0x14141a, 0.9);
  for (let i = 0; i < 4; i++) g.fillCircle(ox - 8 + i * 9, oy - 30, 1.8);
  // Short lace runs between eyelets
  g.lineStyle(2.2, 0xfff8e0, 1);
  for (let i = 0; i < 3; i++) {
    g.lineBetween(ox - 8 + i * 9, oy - 30, ox + 1 + i * 9, oy - 28);
  }
  // Cute lace bow loops
  g.fillStyle(0xfff8e0, 1);
  g.fillCircle(ox - 11, oy - 40, 3.5);
  g.fillCircle(ox - 3, oy - 40, 3.5);
  g.fillStyle(accent, 0.6);
  g.fillCircle(ox - 11, oy - 40, 1.4);
  g.fillCircle(ox - 3, oy - 40, 1.4);

  // Heel pull tab
  g.fillStyle(accent, 1);
  g.fillRoundedRect(ox - 84, oy - 26, 10, 14, 3);
}
