import Phaser from 'phaser';
import { audio } from '../AudioManager.js';
import { music } from '../MusicManager.js';
import { SPECIES, companion, drawCompanion } from '../CompanionManager.js';
import { TransitionManager } from '../TransitionManager.js';
import { createStarfield } from '../starfieldHelper.js';
import { createButton } from '../buttonHelper.js';
import { style, menuStyle } from '../textStyles.js';
import { COLORS } from '../colorPalette.js';

const W = 1080;
const H = 1920;

export class StarterPickerScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StarterPickerScene' });
  }

  create() {
    audio.init();
    music.ensurePlaying(this);
    createStarfield(this, { width: W, height: H, accentStrength: 0 });

    this.add.text(W / 2, 180, 'Pick Your Companion', style('display', {
      fontSize: '72px'
    })).setOrigin(0.5).setDepth(10);

    this.add.text(W / 2, 270, 'Three cosmic eggs await. Choose one to hatch.', menuStyle('body', {
      align: 'center',
      wordWrap: { width: 940 }
    })).setOrigin(0.5).setDepth(10);

    this.selectedId = null;
    this.cards = {};

    const ids = ['ember', 'tide', 'sprout'];
    const cardW = 960;
    const cardH = 430;
    const gap = 15;

    ids.forEach((id, i) => {
      const cy = 580 + i * (cardH + gap);
      this.cards[id] = this.createCard(id, W / 2, cy, cardW, cardH);
    });

    this.confirmBtn = createButton(this, {
      x: W / 2,
      y: 1780,
      label: 'Hatch your egg',
      width: 480,
      height: 130,
      color: 0x4a4a6a,
      textOverrides: menuStyle('button'),
      enabled: false,
      onClick: () => this.confirm()
    });
    this.confirmBtn.setDepth(20);

    new TransitionManager(this).fadeIn(280);
  }

  createCard(id, cx, cy, cw, ch) {
    const sp = SPECIES[id];
    const card = this.add.container(cx, cy).setDepth(8);

    const glow = this.add.graphics();
    glow.fillStyle(sp.color, 0.18);
    glow.fillRoundedRect(-cw / 2 - 8, -ch / 2 - 8, cw + 16, ch + 16, 26);
    card.add(glow);

    const bg = this.add.graphics();
    bg.fillStyle(COLORS.bgPanel, 0.95);
    bg.fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 22);
    bg.lineStyle(3, sp.color, 0.6);
    bg.strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, 22);
    card.add(bg);
    card.bg = bg;
    card.glow = glow;
    card.cw = cw;
    card.ch = ch;
    card.color = sp.color;

    const pet = drawCompanion(this, -345, 20, {
      speciesId: id,
      stage: 'egg',
      preview: true,
      scale: 1.4
    });
    card.add(pet);

    const textX = -200;
    const textWidth = 640;
    card.add(this.add.text(textX, -175, sp.name, style('display', {
      fontSize: '52px',
      fill: '#' + sp.color.toString(16).padStart(6, '0')
    })).setOrigin(0, 0));

    card.add(this.add.text(textX, -105, sp.tagline, menuStyle('caption', {
      wordWrap: { width: textWidth }
    })).setOrigin(0, 0));

    const lore = sp.stages.egg.lore;
    card.add(this.add.text(textX, 0, lore, menuStyle('body', {
      wordWrap: { width: textWidth }
    })).setOrigin(0, 0));

    const hit = this.add.rectangle(0, 0, cw, ch, 0x000000, 0).setInteractive({ useHandCursor: true });
    card.add(hit);
    hit.on('pointerover', () => this.tweens.add({ targets: card, scaleX: 1.015, scaleY: 1.015, duration: 120 }));
    hit.on('pointerout', () => {
      if (this.selectedId !== id) {
        this.tweens.add({ targets: card, scaleX: 1, scaleY: 1, duration: 120 });
      }
    });
    hit.on('pointerdown', () => {
      audio.playClick();
      this.select(id);
    });
    return card;
  }

  select(id) {
    this.selectedId = id;
    Object.entries(this.cards).forEach(([cid, card]) => {
      const isSelected = cid === id;
      card.bg.clear();
      card.bg.fillStyle(COLORS.bgPanel, 0.95);
      card.bg.fillRoundedRect(-card.cw / 2, -card.ch / 2, card.cw, card.ch, 22);
      card.bg.lineStyle(isSelected ? 5 : 3, card.color, isSelected ? 1 : 0.6);
      card.bg.strokeRoundedRect(-card.cw / 2, -card.ch / 2, card.cw, card.ch, 22);
      this.tweens.add({
        targets: card,
        scaleX: isSelected ? 1.02 : 1,
        scaleY: isSelected ? 1.02 : 1,
        duration: 160,
        ease: 'Back.easeOut'
      });
    });

    this.confirmBtn.destroy();
    this.confirmBtn = createButton(this, {
      x: W / 2,
      y: 1780,
      label: `Pick ${SPECIES[id].name}`,
      width: 480,
      height: 130,
      color: SPECIES[id].color,
      textOverrides: menuStyle('button'),
      onClick: () => this.confirm()
    });
    this.confirmBtn.setDepth(20);
  }

  confirm() {
    if (!this.selectedId) return;
    audio.playLevelComplete?.();
    companion.pickStarter(this.selectedId);
    new TransitionManager(this).fadeToScene('WorldMapScene', {}, 400);
  }
}
