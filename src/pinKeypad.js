import { audio } from './AudioManager.js';
import { style } from './textStyles.js';
import { COLORS } from './colorPalette.js';

// Phaser 3.90 re-runs its whole key queue on every key event until the frame
// ends, so a fast typist (or a slow frame) sees the same keydown handed over
// two or three times. Each real key press is used once, by whichever pad sees
// it first, even when that pad has just been replaced by the next step's pad.
const usedKeyEvents = new WeakSet();

// Shared touch and hardware keyboard input for the parent PIN screens.
// x/y locate the center key in the first row, relative to any parent container.
// touchDelayMs ignores taps for a moment after the pad appears, so the second
// tap of a double-tap on the button that opened it cannot type a digit. Keys
// on a hardware keyboard are never delayed.
export function createPinKeypad(scene, {
  x = 0, y = 0, size = 140, spacing = 168,
  onDigit, onClear, onBackspace, touchDelayMs = 0,
} = {}) {
  const pad = scene.add.container(x, y);
  const clock = () => (scene.time ? scene.time.now : 0);
  const touchReadyAt = clock() + touchDelayMs;
  const keys = [
    ...Array.from({ length: 9 }, (_, i) => String(i + 1)),
    'C', '0', '<',
  ];

  const activate = key => {
    if (key === 'C') onClear();
    else if (key === '<') onBackspace();
    else onDigit(key);
  };

  keys.forEach((key, i) => {
    const color = key === 'C' ? COLORS.error : key === '<' ? 0xffb142 : COLORS.accentTeal;
    const button = scene.add.container((i % 3 - 1) * spacing, Math.floor(i / 3) * spacing);
    const bg = scene.add.graphics();
    const draw = hovered => {
      bg.clear();
      bg.fillStyle(hovered ? 0x1a1a30 : COLORS.bgPanel, 0.95);
      bg.fillRoundedRect(-size / 2, -size / 2, size, size, 16);
      bg.lineStyle(hovered ? 4 : 3, color, hovered ? 1 : 0.8);
      bg.strokeRoundedRect(-size / 2, -size / 2, size, size, 16);
    };
    draw(false);
    button.add(bg);
    button.add(scene.add.text(0, 0, key, style('display', {
      fontSize: '56px', fill: '#ffffff',
    })).setOrigin(0.5));
    const hit = scene.add.rectangle(0, 0, size, size, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      if (clock() < touchReadyAt) return;
      audio.playClick();
      activate(key);
    });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    button.add(hit);
    pad.add(button);
  });

  const keyboard = scene.input.keyboard;
  const onKey = event => {
    if (usedKeyEvents.has(event)) return;
    usedKeyEvents.add(event);
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    const key = /^[0-9]$/.test(event.key) ? event.key
      : event.key === 'Backspace' ? '<'
      : event.key === 'Delete' ? 'C' : null;
    if (key === null) return;
    event.preventDefault();
    activate(key);
  };
  const cleanup = () => {
    keyboard?.off('keydown', onKey);
    scene.events.off('shutdown', cleanup);
    pad.off('destroy', cleanup);
  };
  keyboard?.on('keydown', onKey);
  pad.once('destroy', cleanup);
  scene.events.once('shutdown', cleanup);

  return pad;
}
