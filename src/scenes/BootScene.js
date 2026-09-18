import Phaser from 'phaser';
import { style } from '../textStyles.js';
import { companion } from '../CompanionManager.js';
import { createStarfield } from '../starfieldHelper.js';
import { audio } from '../AudioManager.js';
import { music } from '../MusicManager.js';
import { MUSIC_ASSETS } from '../MusicAssets.js';
import { TransitionManager } from '../TransitionManager.js';
import { drawShip } from '../ShipRenderer.js';
import { progress } from '../GameData.js';

const W = 1080;
const H = 1920;

// Cosmic dust boot intro. Plays automatically on cold start; tap anywhere
// skips to the end state and triggers the same scene transition.
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Only the intro's song blocks boot. Other themes load when first requested.
    this.load.audio('homeTheme', MUSIC_ASSETS.homeTheme);
    this.load.on('loaderror', (file) => {
      console.info(`[boot] audio "${file?.key}" unavailable, skipped`);
    });

    // Only visible if preload runs long; create() destroys it on entry.
    this.loadingText = this.add.text(W / 2, H / 2, 'Loading…', style('headline', {
      fontSize: '54px',
      fill: '#cfcfe0'
    })).setOrigin(0.5);
  }

  create() {
    if (this.loadingText) {
      this.loadingText.destroy();
      this.loadingText = null;
    }

    this.cameras.main.setBackgroundColor('#000000');
    this._introDone = false;
    this._timers = [];

    const starfieldRoot = this.add.container(0, 0).setDepth(-10).setAlpha(0);
    createStarfield(this, { width: W, height: H, accentStrength: 0.15, parent: starfieldRoot });
    this.tweens.add({
      targets: starfieldRoot,
      alpha: 1,
      duration: 500,
      ease: 'Quad.easeOut',
    });

    const shipX = W / 2;
    const shipY = H / 2 + 60;
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2 + Math.random() * 0.3;
      const startDist = 480 + Math.random() * 240;
      const startX = shipX + Math.cos(angle) * startDist;
      const startY = shipY + Math.sin(angle) * startDist;

      const streak = this.add.graphics();
      streak.fillStyle(0xfff3b8, 0.85);
      streak.fillCircle(0, 0, 3 + Math.random() * 2);
      streak.setPosition(startX, startY);
      streak.setAlpha(0);

      this.tweens.add({
        targets: streak,
        alpha: { from: 0.85, to: 0 },
        x: shipX + (Math.random() - 0.5) * 80,
        y: shipY + (Math.random() - 0.5) * 80,
        duration: 700,
        delay: 50 + Math.random() * 200,
        ease: 'Cubic.easeIn',
        onComplete: () => streak.destroy(),
      });
    }

    this._timers.push(this.time.delayedCall(600, () => {
      if (this._introDone) return;
      const ship = drawShip(this, shipX, shipY, {
        scale: 2.0,
        parts: progress.ship?.parts,
      });
      ship.setScale(0.4);
      ship.setAlpha(0);
      this.tweens.add({
        targets: ship,
        alpha: 1,
        scale: 2.0,
        duration: 400,
        ease: 'Back.easeOut',
      });
      this.tweens.add({
        targets: ship,
        y: shipY - 14,
        duration: 1600,
        delay: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }));

    this._timers.push(this.time.delayedCall(900, () => {
      if (this._introDone) return;
      const logo = this.add.text(W / 2, shipY + 280, 'COSMIC MATH', style('display', {
        fontSize: '108px',
        fill: '#ffffff',
        stroke: '#0a0a1a',
        strokeThickness: 6,
      })).setOrigin(0.5);
      const tagline = this.add.text(W / 2, shipY + 360, 'A space adventure for the cosmic crew', style('caption', {
        fontSize: '28px',
        fill: '#a7f3d0',
      })).setOrigin(0.5);
      logo.setAlpha(0);
      tagline.setAlpha(0);
      this.tweens.add({ targets: [logo, tagline], alpha: 1, duration: 400, ease: 'Quad.easeOut' });
    }));

    // Settle on a tap-to-begin prompt; the kid drives the transition so they
    // can breathe with the title.
    this._timers.push(this.time.delayedCall(1500, () => {
      if (this._introDone) return;
      this._showStartPrompt();
    }));

    const hit = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this._finish());

    // Start music intimate; _finish ramps to full on exit. setVolume no-ops
    // until the audio context unlocks on the first tap.
    music.ensurePlaying(this);
    music.setVolume(0.3);
  }

  _showStartPrompt() {
    const prompt = this.add.text(W / 2, H / 2 + 540, 'Tap anywhere to begin', style('subhead', {
      fontSize: '46px',
      fill: '#fbbf24',
      stroke: '#0a0a1a',
      strokeThickness: 3,
    })).setOrigin(0.5);
    prompt.setAlpha(0);
    this.tweens.add({
      targets: prompt,
      alpha: 1,
      duration: 280,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: prompt,
          alpha: { from: 1, to: 0.45 },
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });
    this._startPrompt = prompt;
  }

  _finish() {
    if (this._introDone) return;
    this._introDone = true;
    this._timers.forEach(t => t.remove(false));

    // Audio.init() needs a user gesture; calling without one is a harmless no-op.
    audio.init();
    audio.playClick?.();
    music.fadeVolume(1.0, 240);

    const target = companion.hasStarter() ? 'WorldMapScene' : 'StarterPickerScene';
    new TransitionManager(this).fadeToScene(target);
  }
}
