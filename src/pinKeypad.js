import { audio } from './AudioManager.js';
import { style } from './textStyles.js';
import { COLORS } from './colorPalette.js';

// Shared touch and hardware keyboard input for the parent PIN screens.
// x/y locate the center key in the first row, relative to any parent container.
export function createPinKeypad(scene, {
  x = 0, y = 0, size = 140, spacing = 168,
  onDigit, onClear, onBackspace,
} = {}) {
  const pad = scene.add.container(x, y);
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
