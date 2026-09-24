import Phaser from 'phaser';
import { audio } from './AudioManager.js';
import { style, TYPE } from './textStyles.js';
import { COLORS } from './colorPalette.js';

// Pick whichever lettering, near-black or white, has more contrast against the
// button face (WCAG contrast ratio), so a label is never white on a pastel or
// mid-bright accent like orange.
function inkFor(color) {
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = hex => 0.2126 * lin((hex >> 16) & 0xff) + 0.7152 * lin((hex >> 8) & 0xff) + 0.0722 * lin(hex & 0xff);
  const face = lum(color);
  const vsWhite = 1.05 / (face + 0.05);
  const vsDark = (face + 0.05) / (lum(0x0a0a1a) + 0.05);
  return vsDark > vsWhite ? '#0a0a1a' : '#ffffff';
}

// Standard rounded-rect button. Returns the container.
// onClick fires on pointerdown.
// Every label is at least TYPE.button, and the button grows to fit its label
// rather than letting the label shrink. Callers still set the fill if they
// want a particular ink.
export function createButton(scene, opts) {
  const {
    x = 0,
    y = 0,
    label = '',
    color = COLORS.accentTeal,
    textStyle = 'subhead',
    textOverrides = {},
    onClick = () => {},
    enabled = true,
    radius = 18
  } = opts;
  let { width = 280, height = 80 } = opts;

  const container = scene.add.container(x, y);

  const labelStyle = style(textStyle, {
    ...(textOverrides.fill ? {} : { fill: enabled ? inkFor(color) : '#ffffff' }),
    ...textOverrides
  });
  if (parseFloat(labelStyle.fontSize) < TYPE.button) labelStyle.fontSize = `${TYPE.button}px`;
  const text = scene.add.text(0, 0, label, labelStyle).setOrigin(0.5);
  width = Math.min(1040, Math.max(width, Math.ceil(text.width) + 64));
  height = Math.max(height, Math.ceil(text.height) + 24);

  const shadow = scene.add.graphics();
  shadow.fillStyle(0x000000, 0.45);
  shadow.fillRoundedRect(-width / 2 + 2, -height / 2 + 5, width, height, radius);
  container.add(shadow);

  const bg = scene.add.graphics();
  drawButtonFace(bg, width, height, radius, color, enabled);
  container.add(bg);

  if (!enabled) text.setAlpha(0.5);
  container.add(text);

  const hit = scene.add.rectangle(0, 0, width, height, 0x000000, 0).setInteractive({ useHandCursor: enabled });
  container.add(hit);

  if (enabled) {
    hit.on('pointerover', () => {
      scene.tweens.add({ targets: container, scaleX: 1.04, scaleY: 1.04, duration: 100, ease: 'Quad.easeOut' });
    });
    hit.on('pointerout', () => {
      scene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 100, ease: 'Quad.easeOut' });
    });
    hit.on('pointerdown', () => {
      scene.tweens.add({ targets: container, scaleX: 0.94, scaleY: 0.94, duration: 70, ease: 'Quad.easeOut', yoyo: true });
      audio.playClick();
      onClick();
    });
  }

  return container;
}

function drawButtonFace(graphics, width, height, radius, color, enabled) {
  const baseColor = enabled ? color : 0x3a3a4a;
  const highlightColor = enabled
    ? Phaser.Display.Color.ValueToColor(color).lighten(20).color
    : 0x4a4a5a;
  const shadowColor = enabled
    ? Phaser.Display.Color.ValueToColor(color).darken(25).color
    : 0x2a2a3a;

  // Bottom shadow band (for depth)
  graphics.fillStyle(shadowColor, 1);
  graphics.fillRoundedRect(-width / 2, -height / 2 + 4, width, height - 4, radius);

  // Main face
  graphics.fillStyle(baseColor, 1);
  graphics.fillRoundedRect(-width / 2, -height / 2, width, height - 6, radius);

  // Top highlight gloss
  graphics.fillStyle(highlightColor, 0.55);
  graphics.fillRoundedRect(
    -width / 2 + 4,
    -height / 2 + 3,
    width - 8,
    (height - 6) / 2.2,
    { tl: radius - 2, tr: radius - 2, bl: 4, br: 4 }
  );
}

// Compact icon-style circular button
export function createIconButton(scene, opts) {
  const {
    x = 0,
    y = 0,
    radius = 28,
    color = COLORS.bgTrack,
    accentColor = COLORS.accentTeal,
    drawIcon, // function(graphics, size) — caller draws into graphics
    onClick = () => {}
  } = opts;

  const container = scene.add.container(x, y);

  const glow = scene.add.circle(0, 0, radius + 4, accentColor, 0.2);
  container.add(glow);

  const bg = scene.add.circle(0, 0, radius, color, 0.85);
  bg.setStrokeStyle(2, accentColor, 0.7);
  container.add(bg);

  if (drawIcon) {
    const icon = scene.add.graphics();
    drawIcon(icon, radius * 0.7);
    container.add(icon);
    // Expose a redraw so callers can refresh a stateful icon (e.g. a speaker
    // that flips mute on tap) without rebuilding the button. drawIcon reads its
    // state at call time, so this picks up the new value.
    container.redrawIcon = () => {
      icon.clear();
      drawIcon(icon, radius * 0.7);
    };
  }

  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerover', () => {
    scene.tweens.add({ targets: container, scaleX: 1.12, scaleY: 1.12, duration: 100 });
    glow.setAlpha(0.4);
  });
  bg.on('pointerout', () => {
    scene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 100 });
    glow.setAlpha(0.2);
  });
  bg.on('pointerdown', () => {
    audio.playClick();
    onClick();
  });

  return container;
}

// Polished progress bar — pill-shaped track with a glossy fill, optional
// percentage label, and a soft drop shadow for depth.
//
// Returns a container holding the bar. Anchor is the bar's center.
//
// opts:
//   color            fill color (defaults to teal)
//   trackColor       dark track color
//   borderColor      inner outline color
//   label            string drawn over the bar (e.g. "73%"). null hides it.
//   labelOverrides   text style overrides
//   showShadow       drop shadow behind the bar (default true)
//   gradient         { from, to } — when set, fill blends from→to across width
export function createProgressBar(scene, opts) {
  const {
    x = 0,
    y = 0,
    width = 600,
    height = 54,
    ratio = 0,
    color = COLORS.accentTeal,
    trackColor = COLORS.bgTrack,
    borderColor = 0x3a3a55,
    label = null,
    labelOverrides = {},
    depth = 0,
    showShadow = true
  } = opts;

  const container = scene.add.container(x, y).setDepth(depth);
  const w = width;
  const h = height;
  const radius = h / 2;
  const safeRatio = Math.max(0, Math.min(1, ratio));

  if (showShadow) {
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.45);
    shadow.fillRoundedRect(-w / 2 + 1, -h / 2 + 5, w, h, radius);
    container.add(shadow);
  }

  // Track — pill with subtle inner depth band
  const track = scene.add.graphics();
  track.fillStyle(trackColor, 1);
  track.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
  // Inner top shadow stripe (makes the bar feel inset)
  track.fillStyle(COLORS.bgDark, 0.55);
  track.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.30, {
    tl: radius - 2, tr: radius - 2, bl: 6, br: 6
  });
  // Outline
  track.lineStyle(2, borderColor, 1);
  track.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
  container.add(track);

  // Fill — only when ratio > 0
  if (safeRatio > 0) {
    const fillW = Math.max(1, Math.round(w * safeRatio));
    const fillRadius = Math.min(radius, fillW / 2);
    const darken = Phaser.Display.Color.ValueToColor(color).darken(25).color;
    const lighten = Phaser.Display.Color.ValueToColor(color).lighten(35).color;

    const fillContainer = scene.add.container(0, 0);
    container.add(fillContainer);

    const fillG = scene.add.graphics();
    // Base gradient — solid color, then a darker bottom band for depth
    fillG.fillStyle(color, 1);
    fillG.fillRoundedRect(-w / 2, -h / 2, fillW, h, fillRadius);
    fillG.fillStyle(darken, 0.55);
    fillG.fillRoundedRect(-w / 2, -h / 2 + h * 0.55, fillW, h * 0.45, {
      tl: 0, tr: 0, bl: fillRadius, br: fillRadius
    });
    // Top highlight gloss
    const glossW = Math.max(0, fillW - 8);
    if (glossW > 0) {
      fillG.fillStyle(lighten, 0.55);
      fillG.fillRoundedRect(-w / 2 + 4, -h / 2 + 4, glossW, h * 0.38, {
        tl: Math.min(radius - 2, glossW / 2),
        tr: Math.min(radius - 2, glossW / 2),
        bl: 4,
        br: 4
      });
    }
    fillContainer.add(fillG);

    // End-cap shimmer — a soft bright dot at the leading edge of the fill
    if (safeRatio < 1) {
      const cap = scene.add.graphics();
      cap.fillStyle(lighten, 0.85);
      cap.fillCircle(-w / 2 + fillW - 2, 0, h * 0.18);
      cap.fillStyle(0xffffff, 0.55);
      cap.fillCircle(-w / 2 + fillW - 2, -h * 0.10, h * 0.10);
      fillContainer.add(cap);
    }
  }

  if (label != null) {
    const text = scene.add.text(0, 0, label, style('subhead', {
      fontSize: `${Math.round(h * 0.5)}px`,
      fill: '#ffffff',
      fontStyle: '900',
      stroke: '#07071a',
      strokeThickness: Math.max(3, Math.round(h * 0.10)),
      ...labelOverrides
    })).setOrigin(0.5);
    container.add(text);
  }

  return container;
}

// Circular pet portrait button — clips a drawCompanion render into a circle.
// `drawPet(scene, x, y, opts)` is called to render the pet inside the button.
export function createPetPortraitButton(scene, opts) {
  const {
    x = 0,
    y = 0,
    radius = 38,
    accentColor = COLORS.accentWarm,
    drawPet, // function(scene, x, y, opts) → container
    onClick = () => {}
  } = opts;

  const container = scene.add.container(x, y);

  const glow = scene.add.circle(0, 0, radius + 4, accentColor, 0.2);
  container.add(glow);

  const bg = scene.add.circle(0, 0, radius, COLORS.bgTrack, 0.85);
  container.add(bg);

  if (drawPet) {
    // Pet container, scaled to fit inside the circle.
    const pet = drawPet(scene, 0, 0, { scale: radius / 90, preview: true });
    container.add(pet);

    // Mask the pet to a circle.
    const maskShape = scene.make.graphics();
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillCircle(x, y, radius - 2);
    const mask = maskShape.createGeometryMask();
    pet.setMask(mask);
  }

  // Ring on top so it crisply outlines the portrait.
  const ring = scene.add.circle(0, 0, radius, 0x000000, 0);
  ring.setStrokeStyle(3, accentColor, 1);
  container.add(ring);

  ring.setInteractive({ useHandCursor: true });
  ring.on('pointerover', () => {
    scene.tweens.add({ targets: container, scaleX: 1.12, scaleY: 1.12, duration: 100 });
    glow.setAlpha(0.4);
  });
  ring.on('pointerout', () => {
    scene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 100 });
    glow.setAlpha(0.2);
  });
  ring.on('pointerdown', () => {
    audio.playClick();
    onClick();
  });

  return container;
}
