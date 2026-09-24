// Arcade hub — unlocked after the endgame (progress.endingSeen === true).
// Two buttons route to the arcade modes. Campaign replays live on the world
// map (tap any cleared world), so there's no separate free-play picker here.

import Phaser from 'phaser';
import { progress } from '../GameData.js';
import { audio } from '../AudioManager.js';
import { music } from '../MusicManager.js';
import { TransitionManager } from '../TransitionManager.js';
import { createStarfield } from '../starfieldHelper.js';
import { style, TYPE } from '../textStyles.js';
import { COLORS } from '../colorPalette.js';
import { createButton } from '../buttonHelper.js';

const W = 1080;
const H = 1920;

export class ArcadeMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ArcadeMenuScene' });
  }

  create() {
    audio.init();
    music.ensurePlaying(this);
    createStarfield(this, { width: W, height: H, accentColor: 0xfbbf24, accentStrength: 0.18 });

    this.add.text(W / 2, 220, 'COSMIC ARCADE', style('display', {
      fontSize: '78px',
      fill: '#fbbf24',
      stroke: '#0a0a1a',
      strokeThickness: 5
    })).setOrigin(0.5);
    this.add.text(W / 2, 315, 'Pick a mode, pilot.', style('body', {
      fill: '#cfcfe0'
    })).setOrigin(0.5);

    const bestEndless = progress.arcade?.endlessBest ?? 0;
    const bestRush = progress.arcade?.bossRushBest;

    const cy0 = 900;
    const gap = 340;

    this.makeModeCard(W / 2, cy0, {
      title: 'ENDLESS',
      subtitle: 'Asteroids never stop',
      detail: `Best score: ${bestEndless}`,
      accent: 0x4ecdc4,
      onClick: () => new TransitionManager(this).fadeToScene('EndlessScene')
    });

    this.makeModeCard(W / 2, cy0 + gap, {
      title: 'BOSS RUSH',
      subtitle: '5 boss fights, one ship',
      detail: bestRush
        ? `Best: ${Math.round(bestRush.accuracy * 100)}% in ${(bestRush.timeMs / 1000).toFixed(1)}s`
        : 'No runs yet',
      accent: 0xc44b5e,
      onClick: () => new TransitionManager(this).fadeToScene('BossRushScene')
    });

    // Back arrow
    createButton(this, {
      x: 130, y: 100, label: '← MAP',
      width: 220, height: 76,
      color: COLORS.bgPanel,
      textOverrides: { fontSize: `${TYPE.button}px`, fill: '#fbbf24', fontStyle: '900' },
      onClick: () => new TransitionManager(this).fadeToScene('WorldMapScene')
    });

    new TransitionManager(this).fadeIn(300);
  }

  makeModeCard(x, y, opts) {
    // Tall enough for a 52px title, a 42px line and a 36px stat line.
    const cw = 820;
    const ch = 280;
    const c = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.bgPanel, 0.95);
    bg.fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 28);
    bg.lineStyle(4, opts.accent, 0.95);
    bg.strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, 28);
    c.add(bg);

    c.add(this.add.text(-cw / 2 + 40, -66, opts.title, style('display', {
      fontSize: `${TYPE.heading}px`,
      fill: '#ffffff'
    })).setOrigin(0, 0.5));

    c.add(this.add.text(-cw / 2 + 40, 6, opts.subtitle, style('subhead', {
      fontSize: `${TYPE.body}px`,
      fill: '#' + opts.accent.toString(16).padStart(6, '0')
    })).setOrigin(0, 0.5));

    c.add(this.add.text(-cw / 2 + 40, 72, opts.detail, style('caption', {
      fontSize: `${TYPE.label}px`,
      fill: '#cfcfe0'
    })).setOrigin(0, 0.5));

    const hit = this.add.rectangle(x, y, cw, ch, 0, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => this.tweens.add({ targets: c, scale: 1.03, duration: 120 }));
    hit.on('pointerout', () => this.tweens.add({ targets: c, scale: 1, duration: 120 }));
    hit.on('pointerdown', () => { audio.playClick?.(); opts.onClick(); });
    return c;
  }
}
