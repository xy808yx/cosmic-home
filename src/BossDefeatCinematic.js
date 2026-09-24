// Boss-defeat cinematic. Four beats: freeze + crack → shatter → pet loop →
// "WORLD CLEARED" title card. ~2.8s total. Plays AFTER round data has been
// committed so an early tab-close inside the cinematic can't lose progress.
// Tap-to-skip jumps to the title card; the cinematic always calls onComplete.

import Phaser from 'phaser';
import { audio } from './AudioManager.js';
import { music } from './MusicManager.js';
import { style } from './textStyles.js';
import { drawCompanion, companion } from './CompanionManager.js';
import { darken } from './colorUtils.js';
import { COLORS } from './colorPalette.js';
import { MOTION } from './motionConstants.js';

const W = 1080;
const H = 1920;

export function playBossDefeatCinematic(scene, asteroid, onComplete) {
  const x = asteroid.container?.x ?? W / 2;
  const y = asteroid.container?.y ?? H / 2;
  const worldId = scene.worldId;
  const worldName = scene.world?.name || `WORLD ${worldId}`;
  const accent = scene.world?.accentColor ?? COLORS.accentPurple;

  music.fadeVolume(0.4, MOTION.gameplay.normal);

  let done = false;
  let cardShown = false;
  const timers = [];
  const finish = () => {
    if (done) return;
    done = true;
    timers.forEach(t => t.remove(false));
    music.fadeVolume(1.0, MOTION.cinematic.intro);
    onComplete?.();
  };

  // Beat 1: chromatic-aberration cyan/red copies of the boss + a crack line
  // drawn across in 200ms.
  const cyan = scene.add.graphics().setDepth(11);
  const red = scene.add.graphics().setDepth(11);
  cyan.fillStyle(0x00ffe0, 0.6);
  red.fillStyle(0xff2255, 0.6);
  const r = (asteroid.container?.list?.[0]?.radius) || 130;
  cyan.fillCircle(0, 0, r);
  red.fillCircle(0, 0, r);
  cyan.setPosition(x - 4, y);
  red.setPosition(x + 4, y);
  cyan.setBlendMode(Phaser.BlendModes.ADD);
  red.setBlendMode(Phaser.BlendModes.ADD);

  const crack = scene.add.graphics().setDepth(12);
  crack.x = x;
  crack.y = y;
  let crackProgress = 0;
  const crackTween = scene.tweens.add({
    targets: { v: 0 },
    v: 1,
    duration: 200,
    ease: 'Cubic.easeOut',
    onUpdate: (_tw, tgt) => {
      crackProgress = tgt.v;
      crack.clear();
      crack.lineStyle(5, 0xffffff, 1);
      const len = r * 1.4 * crackProgress;
      crack.beginPath();
      crack.moveTo(-len, -r * 0.3);
      crack.lineTo(-len * 0.4, r * 0.1);
      crack.lineTo(0, -r * 0.05);
      crack.lineTo(len * 0.4, r * 0.15);
      crack.lineTo(len, -r * 0.1);
      crack.strokePath();
    },
  });

  // Snap SFX
  audio.playTone?.(2400, 0.08, 'triangle', 0.18);

  // ── Beat 2: Shatter (300–900ms) ──────────────────────────────────────────
  timers.push(scene.time.delayedCall(300, () => {
    if (done) return;
    crack.destroy();
    cyan.destroy();
    red.destroy();
    if (asteroid.container?.active) asteroid.container.destroy();

    // White flash at impact.
    const flash = scene.add.graphics().setDepth(11);
    flash.fillStyle(0xffffff, 1);
    flash.fillCircle(0, 0, r * 1.8);
    flash.setPosition(x, y);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: flash, alpha: 0, duration: 60, ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });

    // 12 themed chunks tumbling outward with gravity bias.
    const chunkColor = darken(accent, 0.18);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 260 + Math.random() * 200;
      const size = 22 + Math.random() * 12;
      const half = size / 2;
      const chunk = scene.add.graphics().setDepth(10);
      chunk.fillStyle(chunkColor, 1);
      chunk.fillTriangle(-half, -half * 0.6, half, -half * 0.4, half * 0.3, half * 0.7);
      chunk.fillTriangle(-half, -half * 0.6, half * 0.3, half * 0.7, -half * 0.4, half * 0.5);
      chunk.setPosition(x, y);
      chunk.setAngle(Math.random() * 360);
      scene.tweens.add({
        targets: chunk,
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist + 140, // gravity bias
        angle: chunk.angle + (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 360),
        alpha: 0,
        duration: 600,
        ease: 'Cubic.easeOut',
        onComplete: () => chunk.destroy(),
      });
    }

    // 40 shards in world-accent colors.
    const shardColors = [accent, 0xffffff, 0xf7dc6f, 0xff8b3d];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2 + Math.random() * 0.25;
      const dist = 180 + Math.random() * 140;
      const shard = scene.add.graphics().setDepth(10);
      shard.fillStyle(shardColors[i % shardColors.length], 1);
      shard.fillCircle(0, 0, 5 + Math.random() * 5);
      shard.setPosition(x, y);
      scene.tweens.add({
        targets: shard,
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist,
        alpha: 0,
        duration: 540 + Math.random() * 180,
        ease: 'Quad.easeOut',
        onComplete: () => shard.destroy(),
      });
    }

    scene.cameras.main.shake(280, 0.014);
    audio.playAsteroidBoom?.();
  }));

  // ── Beat 3: Pet rocketBoost loop (900–2100ms) ────────────────────────────
  timers.push(scene.time.delayedCall(900, () => {
    if (done) return;
    if (!companion.hasStarter()) return;

    scene.cockpitPet?.setVisible(false);
    const startX = scene.shipContainer?.x ?? W / 2;
    const startY = scene.shipContainer?.y ?? H - 400;
    const pet = drawCompanion(scene, startX, startY - 80, { scale: 1.4 }).setDepth(20);
    pet.setScale(0);
    scene.tweens.add({
      targets: pet, scale: 1.4, duration: 220, ease: 'Back.easeOut',
    });

    // Loop path — wide rectangle traversal with a brief comet-tail trail.
    const path = [
      { x: W / 2, y: H * 0.3 },
      { x: W * 0.18, y: H * 0.5 },
      { x: W / 2, y: H * 0.7 },
      { x: W * 0.82, y: H * 0.5 },
      { x: W / 2, y: H * 0.45 },
    ];
    let i = 0;
    const step = () => {
      if (done || !pet.active || i >= path.length) return;
      const target = path[i++];
      scene.tweens.add({
        targets: pet,
        x: target.x, y: target.y,
        duration: 240,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          // Cheap comet trail: drop a fading dot every few frames.
          if (Math.random() < 0.5) {
            const trail = scene.add.graphics().setDepth(19);
            trail.fillStyle(accent, 0.7);
            trail.fillCircle(0, 0, 6);
            trail.setPosition(pet.x, pet.y);
            scene.tweens.add({
              targets: trail, alpha: 0, scale: 0.5,
              duration: 360, ease: 'Quad.easeOut',
              onComplete: () => trail.destroy(),
            });
          }
        },
        onComplete: step,
      });
    };
    step();

    // Triumphant 3-note arpeggio (E5–G#5–C6).
    audio.playTone?.(659, 0.18, 'sine', 0.30);
    audio.playTone?.(831, 0.18, 'sine', 0.30, 0.08);
    audio.playTone?.(1047, 0.30, 'sine', 0.30, 0.16);

    // Tuck the pet back at end of loop so beat 4 starts with a clean stage.
    timers.push(scene.time.delayedCall(1180, () => {
      if (pet.active) {
        scene.tweens.add({
          targets: pet, alpha: 0, scale: 0.6, duration: 200,
          onComplete: () => pet.destroy(),
        });
      }
    }));
  }));

  // ── Beat 4: "WORLD CLEARED" title card (2100–2800ms) ─────────────────────
  const showCard = () => {
    if (cardShown) return;
    cardShown = true;

    // A world line too long for one row breaks after "WORLD N:" so the
    // name stays whole on its own line, and the card grows to fit it.
    const cardW = 920;
    const heading = scene.add.text(0, 0, `WORLD ${worldId}: ${worldName.toUpperCase()}`, style('display', {
      fontSize: '52px', fill: '#ffffff', fontStyle: '900', align: 'center'
    })).setOrigin(0.5, 0);
    if (heading.width > cardW - 80) {
      heading.setText(`WORLD ${worldId}:\n${worldName.toUpperCase()}`);
      heading.setWordWrapWidth(cardW - 80);
    }
    const cleared = scene.add.text(0, 0, 'CLEARED!', style('display', {
      fontSize: '76px', fill: '#' + accent.toString(16).padStart(6, '0'),
      fontStyle: '900', stroke: '#0a0a18', strokeThickness: 5,
    })).setOrigin(0.5, 0);
    const lineGap = 14;
    const contentH = heading.height + lineGap + cleared.height;
    const cardH = Math.max(320, Math.ceil(contentH) + 120);
    heading.y = -contentH / 2;
    cleared.y = heading.y + heading.height + lineGap;
    const overlay = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(70).setInteractive();
    scene.tweens.add({ targets: overlay, fillAlpha: 0.65, duration: 200 });

    const card = scene.add.container(W / 2, H / 2).setDepth(71);
    card.setScale(0.96);
    card.setAlpha(0);
    const bg = scene.add.graphics();
    bg.fillStyle(COLORS.bgPanel, 0.98);
    bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 36);
    bg.lineStyle(4, accent, 0.9);
    bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 36);
    card.add(bg);
    card.add(heading);
    card.add(cleared);

    scene.tweens.add({
      targets: card, alpha: 1, scale: 1, duration: 240, ease: 'Quad.easeOut',
    });

    audio.playWorldClearFanfare?.();

    let cardDismissed = false;
    const dismissCard = () => {
      if (cardDismissed) return;
      cardDismissed = true;
      scene.tweens.add({
        targets: [overlay, card], alpha: 0, duration: 180, ease: 'Quad.easeIn',
        onComplete: () => { overlay.destroy(); card.destroy(); finish(); },
      });
    };
    overlay.on('pointerdown', dismissCard);
    timers.push(scene.time.delayedCall(2000, dismissCard));
  };

  timers.push(scene.time.delayedCall(2100, showCard));

  // Tap-to-skip on beats 1–3 → jump straight to the title card.
  const hit = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.001)
    .setDepth(69)
    .setInteractive();
  hit.on('pointerdown', () => {
    if (cardShown) return;
    hit.destroy();
    showCard();
  });
  timers.push(scene.time.delayedCall(2050, () => hit?.destroy()));
}
