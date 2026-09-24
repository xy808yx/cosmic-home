// Parent / dev menu. Hidden behind a long-press on the world map title (see
// WorldMapScene), then a fixed code. Lets Dad: max the pet and shop, replay any
// chapter finale, flip the conveyor pilot, open every world (with or without
// stars), and wipe progress. Kept to one flat stack that fits a phone screen.

import Phaser from 'phaser';
import { progress, HIDDEN_WORLDS } from '../GameData.js';
import { audio } from '../AudioManager.js';
import { TransitionManager } from '../TransitionManager.js';
import { createStarfield } from '../starfieldHelper.js';
import { style } from '../textStyles.js';
import { createButton } from '../buttonHelper.js';
import { createModal } from '../modalHelper.js';
import { PET_COSMETICS } from '../CosmeticManager.js';
import { SHIP_PARTS } from '../ShipManager.js';
import { showCodeGate } from '../parentGate.js';
import { DEV_MENU_GUARD_STORAGE_KEY, deviceStorage } from '../parentPin.js';

const W = 1080;
const H = 1920;

// Separate from the grown-up PIN, which each family now makes for itself.
// Asked for on every visit; never shown on screen.
const DEV_MENU_CODE = '8888';

export class DevMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DevMenuScene' });
  }

  // data.unlocked: the menu restarting itself (to refresh a label) skips the code.
  create(data = {}) {
    audio.init();
    createStarfield(this, { width: W, height: H, accentColor: 0xff00ff, accentStrength: 0.18 });
    new TransitionManager(this).fadeIn(260);
    if (data.unlocked) {
      this.showMenu(0);
      return;
    }
    showCodeGate(this, {
      code: DEV_MENU_CODE,
      storage: deviceStorage(),
      guardKey: DEV_MENU_GUARD_STORAGE_KEY,
      // The last digit's key sits where a menu button appears, so a quick
      // extra tap must not press it.
      onUnlock: () => this.showMenu(400),
      onBack: () => new TransitionManager(this).fadeToScene('WorldMapScene'),
    });
  }

  showMenu(tapGuardMs) {
    const readyAt = this.time.now + tapGuardMs;
    this.add.text(W / 2, 140, "DAD'S MENU", style('display', {
      fontSize: '60px',
      fill: '#ff00ff',
      stroke: '#0a0a1a',
      strokeThickness: 4
    })).setOrigin(0.5);

    this.add.text(W / 2, 220, '(shh, kids can\'t see this)', style('body', {
      fill: '#cfcfe0'
    })).setOrigin(0.5);

    const buttons = [
      {
        label: 'JUICE',
        color: 0xff00ff,
        onClick: () => this.juiceItUp()
      },
      {
        label: 'Replay Ch.1 cliffhanger',
        color: 0xff7a8a,
        onClick: () => {
          progress.resetEndingSeen();
          this.registry.set('creditsMode', 'cliffhanger');
          new TransitionManager(this).fadeToScene('CreditsScene');
        }
      },
      {
        label: 'Replay Ch.2 grand finale',
        color: 0xfbbf24,
        onClick: () => {
          progress.resetFinaleSeen();
          this.registry.set('creditsMode', 'finale');
          new TransitionManager(this).fadeToScene('CreditsScene');
        }
      },
      {
        label: 'Replay Ch.3 homecoming',
        color: 0xffd27a,
        onClick: () => {
          progress.resetFinale3Seen();
          this.registry.set('creditsMode', 'homecoming');
          new TransitionManager(this).fadeToScene('CreditsScene');
        }
      },
      {
        // Owner-only pilot: route the Ch1/Ch2 "mixed" (×÷) level into the Conveyor
        // "Stamp & Ship" mode, reskinned to its chapter. OFF by default; per-browser.
        // Restart refreshes the ON/OFF label.
        label: `Conveyor "mixed" pilot (Ch1-2): ${progress.conveyorMixedEnabled ? 'ON' : 'OFF'}`,
        color: 0xffb142,
        onClick: () => {
          progress.setConveyorMixedEnabled(!progress.conveyorMixedEnabled);
          this.scene.restart({ unlocked: true });
        }
      },
      {
        // One button for "let me see everything": every visible world unlocked
        // and every secret room revealed, with no stars awarded, so nothing is
        // spoiled for the kid. Clearing levels (below) is the stronger step.
        label: 'Unlock every world (+secrets)',
        color: 0x10b981,
        onClick: () => {
          progress.unlockAllVisibleWorlds();
          for (const h of HIDDEN_WORLDS) progress.discoverHiddenWorld(h.id);
          this.flashToast('Every world unlocked, secrets revealed.');
        }
      },
      {
        label: 'Clear ALL levels (every chapter)',
        color: 0x7dffd0,
        onClick: () => {
          progress.devClearAllWorlds();
          this.flashToast('All levels cleared. Every chapter open.');
        }
      },
      {
        label: 'Reset progress (confirm)',
        color: 0xc44b5e,
        onClick: () => this.confirmReset()
      },
      {
        label: 'Back to map',
        color: 0x4a4a6a,
        // Dark ink is unreadable on this gray.
        ink: '#ffffff',
        onClick: () => new TransitionManager(this).fadeToScene('WorldMapScene')
      }
    ];

    // 900 wide so the longest label (the conveyor pilot line) fits at button
    // size and every button in the stack stays the same width.
    const startY = 380;
    const gap = 130;
    buttons.forEach((b, i) => {
      createButton(this, {
        x: W / 2, y: startY + i * gap,
        label: b.label,
        width: 900, height: 100,
        color: b.color,
        textOverrides: { fontSize: '42px', fill: b.ink || '#0a0a1a', fontStyle: '900' },
        onClick: () => {
          if (this.time.now < readyAt) return;
          audio.playClick?.();
          b.onClick();
        }
      });
    });
  }

  juiceItUp() {
    // Default to Ember if no species picked; needed for 'adult' stage to render.
    if (!progress.companion.speciesId) {
      progress.companion.speciesId = 'ember';
    }
    progress.companion.stage = 'adult';

    for (const item of PET_COSMETICS) {
      if (!progress.cosmetics.ownedIds.includes(item.id)) {
        progress.cosmetics.ownedIds.push(item.id);
      }
    }
    for (const part of SHIP_PARTS) {
      if (!progress.ship.ownedParts.includes(part.id)) {
        progress.ship.ownedParts.push(part.id);
      }
    }

    // Not 8888: that is the menu's code, and stardust shows on the map.
    progress.economy.stardust = 9999;
    progress.save();
    this.flashToast('Juiced. Pet maxed, all unlocked, 9999 ⭐');
  }

  flashToast(text) {
    const toast = this.add.container(W / 2, H - 200).setDepth(70);
    const label = this.add.text(0, 0, text, style('subhead', {
      fontSize: '42px',
      fill: '#ff00ff',
      align: 'center',
      wordWrap: { width: 940, useAdvancedWrap: true }
    })).setOrigin(0.5);
    // The box is sized from the text, so a long message never spills out.
    const bw = Math.ceil(label.width) + 64;
    const bh = Math.ceil(label.height) + 32;
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 0.95);
    bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 16);
    bg.lineStyle(2, 0xff00ff, 0.95);
    bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 16);
    toast.add([bg, label]);
    toast.alpha = 0;
    this.tweens.add({ targets: toast, alpha: 1, duration: 200 });
    this.time.delayedCall(1500, () => {
      this.tweens.add({
        targets: toast,
        alpha: 0,
        duration: 400,
        onComplete: () => toast.destroy()
      });
    });
  }

  confirmReset() {
    const w = 720;
    // Measured first so the card can be sized to fit them.
    const title = this.add.text(0, 0, 'Wipe ALL progress?', style('display', {
      fontSize: '52px',
      fill: '#ffffff'
    })).setOrigin(0.5, 0);
    const body = this.add.text(0, 0, 'Stars, worlds, pet, ship, cosmetics. All gone.', style('body', {
      fill: '#cfcfe0',
      align: 'center',
      wordWrap: { width: w - 100, useAdvancedWrap: true }
    })).setOrigin(0.5, 0);
    const btnH = 88;
    const h = 44 + title.height + 20 + body.height + 40 + btnH + 44;
    const { card, close } = createModal(this, {
      width: w, height: h,
      accentColor: 0xc44b5e,
      showCloseHint: false
    });
    title.y = -h / 2 + 44;
    body.y = title.y + title.height + 20;
    card.add([title, body]);
    const btnY = h / 2 - 44 - btnH / 2;
    card.add(createButton(this, {
      x: -140, y: btnY, label: 'Cancel',
      width: 240, height: btnH,
      color: 0x4a4a6a,
      onClick: close
    }));
    card.add(createButton(this, {
      x: 140, y: btnY, label: 'WIPE',
      width: 240, height: btnH,
      color: 0xc44b5e,
      onClick: () => {
        progress.resetAll();
        close();
        this.flashToast('Progress wiped.');
        this.time.delayedCall(800, () => {
          new TransitionManager(this).fadeToScene('BootScene');
        });
      }
    }));
  }
}
