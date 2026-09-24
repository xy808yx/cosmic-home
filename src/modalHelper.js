// Centered-card modal shell shared by info popups, lore cards, and confirm
// dialogs. Builds the dim overlay, rounded-rect panel, optional close hint,
// and tap-to-close handler. The caller adds children to the returned `card`
// container (coordinates are relative to the card center).

import { audio } from './AudioManager.js';
import { style } from './textStyles.js';
import { COLORS } from './colorPalette.js';

export function createModal(scene, opts = {}) {
  const {
    width = 800,
    height = 600,
    depth = 80,
    overlayAlpha = 0.80,
    overlayFadeMs = 0,
    accentColor = COLORS.accentPurple,
    radius = 28,
    strokeWidth = 3,
    showCloseHint = true,
    closeHintText = 'tap anywhere to close',
    showCloseButton = false,
    closeOnCardTap = false,
    onClose = null,
  } = opts;

  const W = scene.cameras.main.width;
  const H = scene.cameras.main.height;

  // The fill carries the dim; a fade-in tweens the object's own alpha from 0
  // to 1 on top of it (fading alpha on a zero-alpha fill never showed).
  const overlay = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, overlayAlpha)
    .setDepth(depth).setInteractive();
  if (overlayFadeMs > 0) {
    overlay.setAlpha(0);
    scene.tweens.add({ targets: overlay, alpha: 1, duration: overlayFadeMs });
  }
  const card = scene.add.container(W / 2, H / 2).setDepth(depth + 1);

  const bg = scene.add.graphics();
  bg.fillStyle(COLORS.bgPanel, 1);
  bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
  bg.lineStyle(strokeWidth, accentColor, 0.95);
  bg.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
  card.add(bg);

  // Transparent hit-rect inside the card for closeOnCardTap. Buttons added by
  // callers later sit above this in the container and stay clickable; clicks
  // that miss them fall to this rect and close. Using a Rectangle (not the
  // Graphics bg) avoids fragile hit-testing on Graphics-in-Container.
  let cardHit = null;
  if (closeOnCardTap) {
    cardHit = scene.add.rectangle(0, 0, width, height, 0x000000, 0).setInteractive();
    card.add(cardHit);
  }

  let closeHint = null;
  if (showCloseHint) {
    // Body size and bright ink: this is the only instruction for getting out
    // of the popup, and it used to be the smallest, dimmest text on screen.
    closeHint = scene.add.text(W / 2, H / 2 + height / 2 + 60, closeHintText, style('body', {
      fill: '#e0e0ef'
    })).setOrigin(0.5).setDepth(depth + 1);
  }

  // Explicit close (X) button pinned to the card's top-right corner. Built as a
  // top-level object above the card so later card children can't steal its tap.
  let closeBtn = null;
  if (showCloseButton) {
    const r = 38;
    const bx = W / 2 + width / 2 - r - 22;
    const by = H / 2 - height / 2 + r + 22;
    closeBtn = scene.add.container(bx, by).setDepth(depth + 4);
    const cg = scene.add.graphics();
    cg.fillStyle(0x000000, 0.35); cg.fillCircle(0, 3, r);
    cg.fillStyle(COLORS.bgPanel, 1); cg.fillCircle(0, 0, r);
    cg.lineStyle(3, accentColor, 0.95); cg.strokeCircle(0, 0, r);
    const k = r * 0.42;
    cg.lineStyle(5, 0xffffff, 0.95);
    cg.lineBetween(-k, -k, k, k);
    cg.lineBetween(-k, k, k, -k);
    closeBtn.add(cg);
    const chit = scene.add.circle(0, 0, r + 8, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    closeBtn.add(chit);
    chit.on('pointerdown', (p, lx, ly, ev) => { ev?.stopPropagation?.(); close(); });
    chit.on('pointerover', () => scene.tweens.add({ targets: closeBtn, scale: 1.1, duration: 110 }));
    chit.on('pointerout', () => scene.tweens.add({ targets: closeBtn, scale: 1, duration: 110 }));
  }

  let closed = false;
  let sceneCloseHandler = null;
  let deferTimer = null;

  // Drop the closeOnCardTap scene-level backup: cancel the pending registration
  // and remove the listener if it was already added. Safe to call repeatedly.
  const teardownSceneBackup = () => {
    if (deferTimer) { clearTimeout(deferTimer); deferTimer = null; }
    if (sceneCloseHandler) {
      scene.input.off('pointerdown', sceneCloseHandler);
      sceneCloseHandler = null;
    }
  };

  const close = () => {
    if (closed) return;
    closed = true;
    teardownSceneBackup();
    scene.events.off('shutdown', onSceneShutdown);
    try { audio.playClick?.(); } catch (e) { /* audio may be unavailable */ }
    overlay.destroy();
    card.destroy();
    closeHint?.destroy();
    closeBtn?.destroy();
    onClose?.();
  };

  // Scene swap / restart / quit while the modal is still open: cancel the
  // deferred registration and drop the listener so neither fires against a
  // torn-down scene (the bug this guards against — a raw setTimeout that
  // outlived its scene re-registered input on a destroyed InputPlugin).
  function onSceneShutdown() {
    closed = true;
    teardownSceneBackup();
  }

  overlay.on('pointerdown', close);
  cardHit?.on('pointerdown', close);

  // Scene-level pointerdown backup for closeOnCardTap. The camera renderList
  // sortGameObjects uses can be stale on the first frame after the modal
  // opens — overlay isn't in it yet, so a tap routes to whichever interactive
  // object underneath the modal sorts highest. Phaser emits this scene-level
  // event AFTER per-object dispatch in the same input cycle, so we defer
  // registration past the current event (a macrotask) to avoid catching the
  // tap that opened the modal. The shutdown hook cancels this timer and the
  // alive-guard re-checks the scene, so a teardown before/after it fires is safe.
  if (closeOnCardTap) {
    scene.events.once('shutdown', onSceneShutdown);
    deferTimer = setTimeout(() => {
      deferTimer = null;
      if (closed || !scene.sys || !scene.sys.isActive()) return;
      sceneCloseHandler = () => close();
      scene.input.on('pointerdown', sceneCloseHandler);
    }, 0);
  }

  return { overlay, card, close, closeHint, closeBtn, width, height };
}

