import Phaser from 'phaser';
import { style } from '../textStyles.js';
import { createBrandText } from '../CosmicBrand.js';
import { companion } from '../CompanionManager.js';
import { audio } from '../AudioManager.js';
import { music } from '../MusicManager.js';
import { MUSIC_ASSETS } from '../MusicAssets.js';
import { TransitionManager } from '../TransitionManager.js';
import { drawShip } from '../ShipRenderer.js';
import { drawWorldNode } from '../WorldNodeArt.js';
import { drawStarIcon } from '../StatIcons.js';
import { progress } from '../GameData.js';

const W = 1080;
const H = 1920;
const ORBIT = { x: W / 2, y: 956, radiusX: 433, radiusY: 344 };

// Homeward Glow: the ship, a guiding star, and a little light waiting at home.
// The opening can be skipped immediately by tapping anywhere.
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

    this.loadingText = this.add.text(W / 2, H / 2, 'Loading…', style('headline', {
      fontSize: '54px',
      fill: '#cfcfe0'
    })).setOrigin(0.5);
  }

  create() {
    this.loadingText?.destroy();
    this.loadingText = null;
    this._introDone = false;
    this._reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.cameras.main.setBackgroundColor('#0c1328');
    this.drawSky();
    this.drawOrbit();

    const ship = drawShip(this, W / 2, 510, {
      scale: 2.05,
      parts: progress.ship?.parts,
    });
    ship.setName('homeward-ship');

    const cosmic = createBrandText(this, W / 2, 820, 'COSMIC', {
      fontSize: '151px',
      color: '#fff9e8',
      maxWidth: 900,
      stroke: '#182438',
      strokeThickness: 9,
      shadow: { offsetX: 0, offsetY: 9, color: '#080e21', blur: 0, fill: true },
    });
    const home = createBrandText(this, W / 2, 1021, 'HOME', {
      fontSize: '267px',
      color: '#ffdc7f',
      maxWidth: 900,
      stroke: '#182438',
      strokeThickness: 10,
      shadow: { offsetX: 0, offsetY: 13, color: '#8a613c', blur: 0, fill: true },
    });
    createBrandText(this, W / 2, 1210, 'Math Adventure', {
      caption: true, fontSize: '42px', color: '#c9dedc',
    });
    drawWorldNode(this, W / 2, 1485, 38, { scale: 2.25 });
    this.drawStar(180, 704, 17, 0xa7d9d4);
    this.drawStar(882, 1124, 12, 0xffda79);
    this._showStartPrompt();

    if (this._reducedMotion) {
      // Ship trails and some equipped addons create their own looping tweens.
      this.tweens.killAll();
    } else {
      this.tweens.add({
        targets: ship, y: 494, duration: 2400,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      this.revealTitle(cosmic, 70);
      this.revealTitle(home, 200);
    }

    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0)
      .setDepth(100).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this._finish());

    const onKey = (event) => {
      if (event.code === 'Enter' || event.code === 'Space') this._finish();
    };
    this.input.keyboard?.on('keydown', onKey);
    this.events.once('shutdown', () => {
      this._introDone = true;
      this.input.keyboard?.off('keydown', onKey);
    });

    music.ensurePlaying(this);
    music.setVolume(0.3);
  }

  drawSky() {
    const bg = this.add.graphics();
    bg.fillStyle(0x0c1328);
    bg.fillGradientStyle(0x0c1328, 0x0c1328, 0x202642, 0x202642, 1);
    bg.fillRect(0, 0, W, H);

    // A quiet, repeatable sky leaves room for the guiding star and floating ship.
    let seed = 8421;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 85; i++) {
      const x = 40 + random() * 1000;
      const y = 60 + random() * 1750;
      const radius = 1 + random() * 2.6;
      this.add.circle(x, y, radius, 0xe3edff, 0.14 + random() * 0.48);
    }
  }

  drawStar(x, y, radius, color) {
    const star = this.add.graphics().setPosition(x, y);
    drawStarIcon(star, 0, 0, radius, color, color);
    return star;
  }

  drawOrbit() {
    const { x, y, radiusX, radiusY } = ORBIT;
    const orbit = this.add.graphics();
    orbit.lineStyle(3, 0x435774, 0.8);
    orbit.beginPath();
    for (let i = 0; i <= 120; i++) {
      const angle = 0.12 + (Math.PI * 1.95 - 0.12) * i / 120;
      const px = x + Math.cos(angle) * radiusX;
      const py = y + Math.sin(angle) * radiusY;
      if (i === 0) orbit.moveTo(px, py);
      else orbit.lineTo(px, py);
    }
    orbit.strokePath();

    const star = this.drawStar(x + radiusX, y, 17, 0xffda79);
    star.setName('homeward-guide');
    if (this._reducedMotion) {
      star.setPosition(x, y + radiusY);
      return;
    }
    const path = { angle: 0 };
    this.tweens.add({
      targets: path, angle: Math.PI * 2, duration: 9500, repeat: -1,
      onUpdate: () => star.setPosition(
        x + Math.cos(path.angle) * radiusX,
        y + Math.sin(path.angle) * radiusY,
      ),
    });
  }

  revealTitle(title, delay) {
    const y = title.y;
    title.setAlpha(0).setY(y + 25);
    this.tweens.add({
      targets: title, y, alpha: 1, delay, duration: 750, ease: 'Cubic.easeOut',
    });
  }

  _showStartPrompt() {
    const border = this.add.graphics();
    border.lineStyle(2, 0xffda79, 0.32);
    border.strokeRoundedRect(290, 1732, 500, 112, 56);
    this._startPrompt = createBrandText(this, W / 2, 1784, 'Tap to begin', {
      caption: true, fontSize: '48px', color: '#fff9e8',
    });
  }

  _finish() {
    if (this._introDone) return;
    this._introDone = true;
    // Stop the intro before creating the scene-transition tween.
    this.tweens.killAll();
    audio.init();
    audio.playClick?.();
    music.fadeVolume(1.0, 240);

    const target = companion.hasStarter() ? 'WorldMapScene' : 'StarterPickerScene';
    new TransitionManager(this).fadeToScene(target, {}, this._reducedMotion ? 100 : 400);
  }
}
