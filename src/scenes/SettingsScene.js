// Settings, reached from the gear on the WorldMap top bar. Kid-facing Sound +
// Music toggles, kept one tap away, plus a Grown-ups button into
// ParentDashboardScene, which asks for the PIN on the way in.

import Phaser from 'phaser';
import { audio } from '../AudioManager.js';
import { music } from '../MusicManager.js';
import { TransitionManager } from '../TransitionManager.js';
import { createStarfield } from '../starfieldHelper.js';
import { createIconButton, createButton } from '../buttonHelper.js';
import { style, menuStyle } from '../textStyles.js';
import { drawArrowLeftIcon } from '../StatIcons.js';
import { COLORS } from '../colorPalette.js';

const W = 1080;
const H = 1920;

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SettingsScene' });
  }

  create() {
    audio.init();
    music.ensurePlaying(this);
    createStarfield(this, { width: W, height: H, accentStrength: 0 });

    // Header
    const bg = this.add.graphics().setDepth(10);
    bg.fillStyle(COLORS.bgDark, 0.95);
    bg.fillRect(0, 0, W, 160);

    createIconButton(this, {
      x: 90, y: 80, radius: 38,
      accentColor: COLORS.accentTeal,
      drawIcon: (g, size) => drawArrowLeftIcon(g, 0, 0, size),
      onClick: () => {
        new TransitionManager(this).fadeToScene('WorldMapScene');
      }
    }).setDepth(15);

    this.add.text(W / 2, 80, 'SETTINGS', style('display', {
      fontSize: '54px',
      fill: '#b6e0ff'
    })).setOrigin(0.5).setDepth(14);

    // Card panel housing the toggles
    const cardX = W / 2;
    const cardY = H / 2 - 100;
    const cardW = 760;
    const cardH = 540;
    const card = this.add.graphics().setDepth(11);
    card.fillStyle(COLORS.bgPanel, 0.95);
    card.fillRoundedRect(cardX - cardW / 2, cardY - cardH / 2, cardW, cardH, 24);
    card.lineStyle(3, 0xb6e0ff, 0.7);
    card.strokeRoundedRect(cardX - cardW / 2, cardY - cardH / 2, cardW, cardH, 24);

    this.add.text(cardX, cardY - cardH / 2 + 60, 'AUDIO', menuStyle('button', {
      fill: '#ffffff',
      fontStyle: '900'
    })).setOrigin(0.5).setDepth(12);

    this.soundBtn = null;
    this.musicBtn = null;
    this.renderToggles(cardX, cardY);

    // Hint about per-game pause menu — kids should know that's there too.
    this.add.text(W / 2, cardY + cardH / 2 + 100, 'You can also toggle these from the pause button during a level.', menuStyle('caption', {
      align: 'center',
      wordWrap: { width: 800 }
    })).setOrigin(0.5).setDepth(11);

    // Grown-ups: the Parent Dashboard used to be its own gear on the map. It
    // lives here now, quieter than the toggles, behind the same PIN gate.
    createButton(this, {
      x: cardX, y: cardY + cardH / 2 + 300,
      width: 540, height: 110,
      label: 'Grown-ups',
      color: 0x2b3a4a,
      textOverrides: menuStyle('button', { fill: '#81ecec', fontStyle: '900' }),
      onClick: () => new TransitionManager(this).fadeToScene('ParentDashboardScene')
    }).setDepth(13);

    new TransitionManager(this).fadeIn(280);
  }

  renderToggles(cardX, cardY) {
    const toggles = [
      { key: 'soundBtn', label: 'Sound', manager: audio, y: cardY - 40, color: 0xb6e0ff },
      { key: 'musicBtn', label: 'Music', manager: music, y: cardY + 100, color: 0xc77eff }
    ];
    toggles.forEach(({ key, label, manager, y, color }) => {
      this[key]?.destroy();
      this[key] = createButton(this, {
        x: cardX, y,
        width: 540, height: 130,
        label: `${label}: ${manager.enabled ? 'ON' : 'OFF'}`,
        color: manager.enabled ? color : 0x4a4a5a,
        textOverrides: menuStyle('button', {
          fill: manager.enabled ? '#0a0a1a' : '#ffffff', fontStyle: '900'
        }),
        onClick: () => {
          manager.setEnabled(!manager.enabled);
          this.renderToggles(cardX, cardY);
        }
      }).setDepth(13);
    });
  }
}
