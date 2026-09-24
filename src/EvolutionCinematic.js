// Full-screen evolution cinematic. Triggered when a pet stage advances.
// Plays a Chrono-Trigger-grade sequence: dim the world, glow, slow build,
// white flash, reveal the new form, hold on a title card with lore, then
// resolve. Skippable on tap. Calls onDone() when finished.

import { audio } from './AudioManager.js';
import { drawCompanion } from './PetRenderer.js';
import { companion, STAGE_ORDER } from './CompanionManager.js';
import { style } from './textStyles.js';

const W = 1080;
const H = 1920;

function previousStage(newStage) {
  const idx = STAGE_ORDER.indexOf(newStage);
  return idx > 0 ? STAGE_ORDER[idx - 1] : 'egg';
}

export function playEvolutionCinematic(scene, newStage, onDone) {
  const species = companion.getSpecies();
  if (!species) {
    if (typeof onDone === 'function') onDone();
    return;
  }

  const prevStage = previousStage(newStage);
  const newLore = species.stages?.[newStage] || {};
  const newName = newLore.name || newStage.toUpperCase();
  const loreText = newLore.lore || '';

  const root = scene.add.container(0, 0).setDepth(2000).setScrollFactor(0);

  // Full-screen overlay
  const overlay = scene.add.graphics();
  overlay.fillStyle(0x0a0010, 1);
  overlay.fillRect(0, 0, W, H);
  overlay.alpha = 0;
  root.add(overlay);

  // Render the OLD pet form, large in screen center
  const oldPet = drawCompanion(scene, W / 2, H / 2 - 100, {
    stage: prevStage,
    scale: 2.0
  });
  oldPet.setScrollFactor(0).setDepth(2001);
  oldPet.alpha = 0;
  root.add(oldPet);

  // Halo of light rays radiating outward (24 thin triangles)
  const rays = scene.add.graphics();
  rays.x = W / 2;
  rays.y = H / 2 - 100;
  rays.alpha = 0;
  rays.setScrollFactor(0).setDepth(2002);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const len = 700;
    const w = 0.06;
    const cx1 = Math.cos(a - w) * len;
    const cy1 = Math.sin(a - w) * len;
    const cx2 = Math.cos(a + w) * len;
    const cy2 = Math.sin(a + w) * len;
    rays.fillStyle(species.accent, 0.55);
    rays.fillTriangle(0, 0, cx1, cy1, cx2, cy2);
  }
  root.add(rays);

  // Bright soft glow disc behind the pet
  const disc = scene.add.graphics();
  disc.x = W / 2;
  disc.y = H / 2 - 100;
  disc.fillStyle(0xffffff, 0.0);
  disc.fillCircle(0, 0, 320);
  disc.alpha = 0;
  disc.setScrollFactor(0).setDepth(2002);
  root.add(disc);

  // Flash overlay (white)
  const flash = scene.add.graphics();
  flash.fillStyle(0xffffff, 1);
  flash.fillRect(0, 0, W, H);
  flash.alpha = 0;
  flash.setScrollFactor(0).setDepth(2010);
  root.add(flash);

  // New pet (revealed after the flash)
  const newPet = drawCompanion(scene, W / 2, H / 2 - 100, {
    stage: newStage,
    scale: 2.0
  });
  newPet.setScrollFactor(0).setDepth(2003);
  newPet.alpha = 0;
  root.add(newPet);

  // Title card: stage name + lore (revealed at the end). The lines are
  // measured and stacked, and the card grows upward from a fixed bottom edge
  // to fit them, so a long lore paragraph never runs into the name or the
  // tap hint.
  const cardW = 920;
  const cardBottom = H - 160;
  const padY = 36;
  const gap = 18;
  const innerW = cardW - 80;

  const evolvedTag = scene.add.text(0, 0, 'EVOLVED', style('caption', {
    fontSize: '36px', fill: '#cfcfe0', fontStyle: '900',
    letterSpacing: 8
  })).setOrigin(0.5, 0);

  const nameText = scene.add.text(0, 0, newName.toUpperCase(), style('display', {
    fontSize: '78px',
    fill: '#' + species.accent.toString(16).padStart(6, '0'),
    fontStyle: '900',
    stroke: '#0a0010', strokeThickness: 4
  })).setOrigin(0.5, 0);
  if (nameText.width > innerW) nameText.setScale(innerW / nameText.width);

  const loreObj = loreText
    ? scene.add.text(0, 0, loreText, style('body', {
      fontSize: '42px', fill: '#e0e0ef', align: 'center',
      wordWrap: { width: innerW }
    })).setOrigin(0.5, 0)
    : null;

  // An instruction, so it sits on the body size like the other tap hints.
  const tapText = scene.add.text(0, 0, 'TAP TO CONTINUE', style('caption', {
    fontSize: '42px', fill: '#cfcfe0', fontStyle: '900',
    letterSpacing: 4
  })).setOrigin(0.5, 0);

  const stack = [evolvedTag, nameText, loreObj, tapText].filter(Boolean);
  const contentH = stack.reduce((sum, t) => sum + t.height * t.scaleY, 0) + gap * (stack.length - 1);
  // A little extra air above the tap hint so it reads as its own line.
  const tapGapExtra = 12;
  const cardH = Math.ceil(contentH + tapGapExtra + padY * 2);

  const cardContainer = scene.add.container(W / 2, cardBottom - cardH / 2);
  cardContainer.setScrollFactor(0).setDepth(2004);
  cardContainer.alpha = 0;
  root.add(cardContainer);

  const cardBg = scene.add.graphics();
  cardBg.fillStyle(0x12122a, 0.95);
  cardBg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 28);
  cardBg.lineStyle(3, species.accent, 0.95);
  cardBg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 28);
  cardContainer.add(cardBg);

  let y = -cardH / 2 + padY;
  stack.forEach(t => {
    if (t === tapText) y += tapGapExtra;
    t.y = y;
    y += t.height * t.scaleY + gap;
    cardContainer.add(t);
  });

  let dismissed = false;
  let titleShown = false;
  const timers = [];

  function finish() {
    if (dismissed) return;
    dismissed = true;
    timers.forEach(t => t.remove?.());
    scene.tweens.add({
      targets: root,
      alpha: 0,
      duration: 380,
      onComplete: () => {
        root.destroy();
        if (typeof onDone === 'function') onDone();
      }
    });
  }

  // Sequence (timing in ms):
  // 0    - dim overlay fades in, soft chime
  // 400  - old pet fades in
  // 900  - rays + disc build, drone
  // 1400 - bright sting + white flash
  // 1700 - flash fades, new pet revealed with sparkles
  // 2300 - title card fades in
  // 2800 - tap-to-continue (no auto-finish; require interaction)

  scene.tweens.add({ targets: overlay, alpha: 0.92, duration: 400, ease: 'Sine.easeOut' });
  audio.playEvolutionBuildup?.();

  timers.push(scene.time.delayedCall(400, () => {
    if (dismissed) return;
    scene.tweens.add({
      targets: oldPet, alpha: 1,
      duration: 320, ease: 'Sine.easeOut'
    });
    scene.tweens.add({
      targets: oldPet, scale: { from: 1.6, to: 2.2 },
      duration: 1000, yoyo: true, repeat: 0, ease: 'Sine.easeInOut'
    });
  }));

  timers.push(scene.time.delayedCall(900, () => {
    if (dismissed) return;
    scene.tweens.add({
      targets: [rays, disc],
      alpha: 1,
      duration: 400, ease: 'Sine.easeOut'
    });
    scene.tweens.add({
      targets: rays,
      angle: 90,
      duration: 800, ease: 'Linear'
    });
  }));

  timers.push(scene.time.delayedCall(1400, () => {
    if (dismissed) return;
    audio.playEvolutionFlash?.();
    scene.tweens.add({
      targets: flash, alpha: 1,
      duration: 200, ease: 'Cubic.easeIn',
      onComplete: () => {
        // Hide old pet, reveal new pet.
        oldPet.alpha = 0;
        rays.alpha = 0.6;
        disc.alpha = 0.6;
        newPet.alpha = 1;
        scene.tweens.add({
          targets: flash, alpha: 0, duration: 360, ease: 'Cubic.easeOut'
        });
        // Sparkle pulse on new pet
        scene.tweens.add({
          targets: newPet,
          scale: { from: 1.7, to: 2.0 },
          duration: 380, ease: 'Back.easeOut'
        });
        scene.cameras.main.flash(160, 255, 255, 255);
      }
    });
  }));

  timers.push(scene.time.delayedCall(2300, () => {
    if (dismissed) return;
    titleShown = true;
    audio.playEvolutionResolve?.();
    scene.tweens.add({
      targets: cardContainer, alpha: 1,
      duration: 400, ease: 'Sine.easeOut'
    });
    // Slow rays rotation lingers
    scene.tweens.add({
      targets: [rays, disc],
      alpha: 0.35,
      duration: 1200, ease: 'Sine.easeInOut'
    });
    scene.tweens.add({
      targets: rays,
      angle: rays.angle + 360,
      duration: 6000, repeat: -1, ease: 'Linear'
    });
  }));

  // Tap to skip / continue. Before title shows, taps skip the buildup.
  // After title shows, taps dismiss the cinematic.
  const hit = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.001)
    .setDepth(2020)
    .setScrollFactor(0)
    .setInteractive();
  root.add(hit);
  hit.on('pointerdown', () => {
    if (titleShown) {
      finish();
    } else {
      // Skip to the title-card reveal immediately
      timers.forEach(t => t.remove?.());
      oldPet.alpha = 0;
      newPet.alpha = 1;
      flash.alpha = 0;
      cardContainer.alpha = 1;
      titleShown = true;
      audio.playEvolutionResolve?.();
    }
  });
}
