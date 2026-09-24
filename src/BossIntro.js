// Comic-book impact reveal for boss fights. Replaces the older Borderlands-style
// card. Beat sheet (driven by delayedCalls so tap-to-skip can short-circuit):
//
//   0–240ms    dark overlay fades to ~0.9, camera zooms 1.00 → 1.04
//   200–500ms  three diagonal impact bars sweep across the screen
//   400–700ms  boss silhouette pops at center via Back.easeOut(1.4)
//   700–900ms  boss epithet text slides in from the left at full height
//   900–2400ms hold; faint distortion ripple over the silhouette
//   2400–2800ms overlay fades out and onDone fires
//
// Tap-to-skip jumps to frame 2400 (overlay fade-out) so the boss fight always
// starts from the same exit state, not an abrupt cut.

import { findWorld } from './GameData.js';
import { audio } from './AudioManager.js';
import { style } from './textStyles.js';
import { drawBossBody } from './QuestionObjectArt.js';
import { MOTION } from './motionConstants.js';

const W = 1080;
const H = 1920;

// All tuning lives here so the cinematic stays inspectable without spelunking.
const BOSS_INTRO_CONFIG = {
  overlay: { color: 0x0a0010, alpha: 0.92, enterMs: MOTION.cinematic.intro },
  camera: { zoomFrom: 1.0, zoomTo: 1.04, zoomMs: 700 },
  bars: {
    count: 3,
    bandHeight: 220,
    sweepStartX: -W * 1.4,
    sweepMs: 300,
    delayBase: 200,
    delayStagger: 60,
  },
  silhouette: {
    radius: 180,
    appearAt: 400,
    appearMs: 300,
    scaleFrom: 0.6,
    scaleTo: 1.0,
  },
  epithet: {
    appearAt: 700,
    appearMs: 220,
    fontSize: '52px',
    startX: -W * 0.5,
    endX: W / 2,
    // Top edge, relative to screen center: below the boss art's feet, legs
    // and rays, and below the last impact bar.
    yOffset: 262,
  },
  name: {
    fontSize: '170px',
    yOffset: -360, // relative to screen center
  },
  hold: { from: 900, to: 2400 },
  exit: { at: 2400, ms: MOTION.cinematic.outro },
  skipJumpsTo: 2400, // tap-skip lands on the exit beat
};

const BOSS_EPITHETS = {
  1: 'THE BURROWING TERROR',
  2: 'TYRANT OF THE RUBBLE',
  3: 'THE SHATTERED MAW',
  4: 'VEIL OF LOST SUNS',
  5: 'GRINDER OF THE CORE',
  6: 'WHO EATS THE HORIZON',
  7: 'JAW OF ENDLESS WINTER',
  8: 'THE DYING-STAR REVENANT',
  9: 'CRUSHER OF GALAXIES',
  10: 'YOUR REFLECTION, ARMED',
  11: 'WHEN ALL LIGHT ENDS',
  21: 'THE SNIFFLY SUPER-GERM',
  22: 'THE GOOEY GERM',
  23: 'CAPTAIN CODE-SCRAMBLER',
  24: 'THE ZAPPY SNEEZE-SPARK',
  25: 'THE CRUSTY CRUNCHER',
  26: 'SWARM MOTHER, QUEEN OF THE WIGGLY SNIFFLES',
  27: 'THE ENERGY GULPER',
  28: 'THE FIRST SNIFFLE OF ALL TIME',
  15: 'CORRUPTOR OF FACTS',
  17: 'TYRANT OF THE PORCELAIN THRONE',
};

export function playBossIntro(scene, worldId, onDone) {
  const world = findWorld(worldId);
  const villainName = (world?.villain || 'Boss').toUpperCase();
  const epithet = BOSS_EPITHETS[worldId] || '';
  const accent = world?.accentColor ?? 0xff2236;

  const root = scene.add.container(0, 0).setDepth(1000).setScrollFactor(0);
  const timers = [];

  // Race-safe dismiss — idempotent regardless of how many sources fire close.
  let dismissed = false;
  let skipped = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    timers.forEach(t => t.remove(false));
    // Restore camera zoom in case we tore down mid-zoom.
    scene.tweens.killTweensOf(scene.cameras.main);
    scene.cameras.main.setZoom(1.0);
    scene.tweens.add({
      targets: root,
      alpha: 0,
      duration: BOSS_INTRO_CONFIG.exit.ms,
      onComplete: () => {
        root.destroy();
        if (typeof onDone === 'function') onDone();
      },
    });
  };

  // ── Layer: dark overlay ──────────────────────────────────────────────────
  const overlay = scene.add.graphics();
  overlay.fillStyle(BOSS_INTRO_CONFIG.overlay.color, 1);
  overlay.fillRect(0, 0, W, H);
  overlay.alpha = 0;
  root.add(overlay);
  scene.tweens.add({
    targets: overlay,
    alpha: BOSS_INTRO_CONFIG.overlay.alpha,
    duration: BOSS_INTRO_CONFIG.overlay.enterMs,
    ease: 'Quad.easeOut',
  });

  // Gentle camera zoom for menace.
  scene.tweens.add({
    targets: scene.cameras.main,
    zoom: BOSS_INTRO_CONFIG.camera.zoomTo,
    duration: BOSS_INTRO_CONFIG.camera.zoomMs,
    ease: 'Cubic.easeOut',
  });

  // ── Layer: 3 diagonal impact bars sweep across ───────────────────────────
  const bars = [];
  for (let i = 0; i < BOSS_INTRO_CONFIG.bars.count; i++) {
    const bar = scene.add.graphics();
    const cy = H * 0.32 + i * BOSS_INTRO_CONFIG.bars.bandHeight;
    // Each bar is a black trapezoid (top edge slightly higher than bottom),
    // with a thin accent stripe inside that shifts color through the sweep.
    bar.fillStyle(0x000000, 1);
    bar.fillTriangle(-200, cy + 40, W + 200, cy - 60, W + 200, cy + 120);
    bar.lineStyle(6, accent, 1);
    bar.lineBetween(-200, cy + 80, W + 200, cy - 20);
    bar.x = BOSS_INTRO_CONFIG.bars.sweepStartX;
    bar.alpha = 0.97;
    root.add(bar);
    bars.push(bar);
    scene.tweens.add({
      targets: bar,
      x: 0,
      duration: BOSS_INTRO_CONFIG.bars.sweepMs,
      delay: BOSS_INTRO_CONFIG.bars.delayBase + i * BOSS_INTRO_CONFIG.bars.delayStagger,
      ease: 'Quad.easeOut',
    });
  }

  // ── Layer: boss silhouette ───────────────────────────────────────────────
  let silhouette = null;
  timers.push(scene.time.delayedCall(BOSS_INTRO_CONFIG.silhouette.appearAt, () => {
    if (dismissed || skipped) return;
    silhouette = scene.add.container(W / 2, H / 2);
    const body = scene.add.graphics();
    drawBossBody(body, worldId, accent, BOSS_INTRO_CONFIG.silhouette.radius);
    silhouette.add(body);
    silhouette.setScale(BOSS_INTRO_CONFIG.silhouette.scaleFrom);
    silhouette.setAlpha(0);
    // Slot the art in under the name and epithet (added earlier) so a boss's
    // feet, teeth or rays never draw over its title lines.
    root.addAt(silhouette, root.getIndex(nameShadow));
    scene.tweens.add({
      targets: silhouette,
      alpha: 1,
      scale: BOSS_INTRO_CONFIG.silhouette.scaleTo,
      duration: BOSS_INTRO_CONFIG.silhouette.appearMs,
      ease: 'Back.easeOut(1.4)',
    });
    audio.playBossIntroSlam?.();
    scene.cameras.main.shake(280, 0.012);
  }));

  // ── Layer: boss name (full-height, slammed in with the silhouette) ───────
  const nameY = H / 2 + BOSS_INTRO_CONFIG.name.yOffset;
  const nameShadow = scene.add.text(W / 2 + 8, nameY + 8, villainName, style('display', {
    fontSize: BOSS_INTRO_CONFIG.name.fontSize, fill: '#a40015', fontStyle: '900',
  })).setOrigin(0.5);
  nameShadow.alpha = 0;
  root.add(nameShadow);
  const nameText = scene.add.text(W / 2, nameY, villainName, style('display', {
    fontSize: BOSS_INTRO_CONFIG.name.fontSize, fill: '#ffffff', fontStyle: '900',
    stroke: '#0a0000', strokeThickness: 8,
  })).setOrigin(0.5);
  nameText.alpha = 0;
  root.add(nameText);

  // Long names auto-shrink horizontally to fit the canvas, full vertical height.
  const maxNameWidth = W - 80;
  const nameScale = Math.min(1, maxNameWidth / nameText.width);
  nameText.scaleX = nameScale;
  nameShadow.scaleX = nameScale;

  timers.push(scene.time.delayedCall(BOSS_INTRO_CONFIG.silhouette.appearAt + 80, () => {
    if (dismissed) return;
    scene.tweens.add({
      targets: [nameText, nameShadow],
      alpha: 1,
      duration: 220,
      ease: 'Back.easeOut',
    });
  }));

  // ── Layer: epithet slides in from the left ───────────────────────────────
  // Top-anchored under the silhouette so a wrapped second line grows
  // downward, away from the boss art.
  const epithetText = scene.add.text(BOSS_INTRO_CONFIG.epithet.startX, H / 2 + BOSS_INTRO_CONFIG.epithet.yOffset, epithet, style('subhead', {
    fontSize: BOSS_INTRO_CONFIG.epithet.fontSize, fill: '#ff2236', fontStyle: '900',
    stroke: '#0a0000', strokeThickness: 4, letterSpacing: 4,
    align: 'center', wordWrap: { width: W - 120 },
  })).setOrigin(0.5, 0);
  epithetText.alpha = 0;
  root.add(epithetText);

  // Long epithets (some Chapter 2 ones, e.g. W26 "SWARM MOTHER, QUEEN OF THE
  // WIGGLY SNIFFLES") wrap to a second line at full size instead of being
  // squeezed. If a line still runs wide, shrink horizontally to fit the
  // canvas as a last resort. The slide-in tween only animates x/alpha, so
  // this scaleX persists.
  epithetText.scaleX = Math.min(1, (W - 80) / epithetText.width);

  timers.push(scene.time.delayedCall(BOSS_INTRO_CONFIG.epithet.appearAt, () => {
    if (dismissed) return;
    scene.tweens.add({
      targets: epithetText,
      x: BOSS_INTRO_CONFIG.epithet.endX,
      alpha: 1,
      duration: BOSS_INTRO_CONFIG.epithet.appearMs,
      ease: 'Quad.easeOut',
    });
  }));

  // ── Hold beat: faint distortion ripple over silhouette ───────────────────
  timers.push(scene.time.delayedCall(BOSS_INTRO_CONFIG.hold.from, () => {
    if (dismissed || !silhouette) return;
    scene.tweens.add({
      targets: silhouette,
      scaleX: { from: 1, to: 1.03 },
      scaleY: { from: 1, to: 0.97 },
      duration: 200,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
    });
  }));

  // ── Exit beat: overlay fade-out + onDone ─────────────────────────────────
  timers.push(scene.time.delayedCall(BOSS_INTRO_CONFIG.exit.at, dismiss));

  // ── Tap-to-skip — short-circuit straight to the exit beat ────────────────
  const hit = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.001)
    .setDepth(1001)
    .setScrollFactor(0)
    .setInteractive();
  root.add(hit);
  hit.on('pointerdown', () => {
    skipped = true;
    dismiss();
  });
}
