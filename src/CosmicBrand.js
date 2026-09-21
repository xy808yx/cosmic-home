// Shared Homeward Glow lettering for the opening screen and map header.
const DISPLAY_FONT = '"Cosmic Lilita", "Arial Rounded MT Bold", sans-serif';
const CAPTION_FONT = '"Cosmic Fredoka", "Arial Rounded MT Bold", sans-serif';

let fontLoads;

export async function loadBrandFonts() {
  if (!document.fonts) return;
  fontLoads ||= {
    display: document.fonts.load('151px "Cosmic Lilita"').catch(() => []),
    caption: document.fonts.load('500 42px "Cosmic Fredoka"').catch(() => []),
  };
  // A slow or unavailable font must never block the game. Existing brand text
  // refreshes below if the font finishes after this short startup allowance.
  let timeout;
  await Promise.race([
    Promise.all(Object.values(fontLoads)),
    new Promise(resolve => { timeout = setTimeout(resolve, 2000); }),
  ]);
  clearTimeout(timeout);
}

export function createBrandText(scene, x, y, copy, options = {}) {
  const { caption = false, maxWidth, ...overrides } = options;
  const title = scene.add.text(x, y, copy, {
    fontFamily: caption ? CAPTION_FONT : DISPLAY_FONT,
    fontSize: '62px',
    fontStyle: caption ? '500' : 'normal',
    color: '#ffe1a0',
    padding: { left: 6, right: 6, top: 6, bottom: 6 },
    ...overrides,
  }).setOrigin(0.5);
  const fit = () => {
    if (maxWidth) title.setScale(Math.min(1, maxWidth / title.width));
  };
  fit();
  const ready = fontLoads?.[caption ? 'caption' : 'display'];
  ready?.then(() => {
    if (!title.scene) return;
    title.style.update(true);
    fit();
  });
  return title;
}

export function createCompactTitle(scene, x, y, maxWidth) {
  return createBrandText(scene, x, y, 'COSMIC HOME', {
    maxWidth,
    shadow: { offsetX: 0, offsetY: 3, color: '#765b40', blur: 0, fill: true },
  });
}
