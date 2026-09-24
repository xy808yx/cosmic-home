// Shared text style presets. Use `style('headline')` or `style('body', { fill: '#f00' })`.

const FONT_STACK = '"Nunito", "ui-rounded", "Avenir Next", "Helvetica Neue", system-ui, -apple-system, Arial, sans-serif';

// The type scale, in canvas px on the 1080x1920 game. An iPhone 15 shows
// 0.364pt per px (label 13pt, body 15pt) and an iPad about 0.615pt per px, so
// sizes that read fine on the kids' iPads were too small on a phone.
export const TYPE = {
  label: 36,   // the floor: names, chips, stat labels, anything short
  body: 42,    // sentences, hints, and every button
  button: 42,
  heading: 52,
  title: 64,
  hero: 72     // big numbers
};

// Every style() size lands on the scale: 36 or less becomes 36, 37 to 45
// becomes 42, 46 to 59 becomes 52. 60 and up (titles, big numbers, brand
// lettering) is left as it is. Pass `art: true` for lettering painted on an
// object, where the words are shown legibly elsewhere; it skips the snap.
export function snapFontPx(px) {
  if (px >= 60) return px;
  if (px <= TYPE.label) return TYPE.label;
  if (px <= 45) return TYPE.body;
  return TYPE.heading;
}

// Faint grays that held up at iPad size but vanish on small phone text.
const DIM_GRAYS = new Set(['#7a7a90', '#8888a0', '#9a9aae', '#9aa0b0', '#aaaac0']);
const READABLE_GRAY = '#cfcfe0';

const PRESETS = {
  display: {
    fontFamily: FONT_STACK,
    fontSize: '52px',
    fontStyle: '900',
    fill: '#ffffff',
    stroke: '#0a0a1a',
    strokeThickness: 3
  },
  headline: {
    fontFamily: FONT_STACK,
    fontSize: '42px',
    fontStyle: '800',
    fill: '#ffffff'
  },
  subhead: {
    fontFamily: FONT_STACK,
    fontSize: '36px',
    fontStyle: '700',
    fill: '#ffffff'
  },
  body: {
    fontFamily: FONT_STACK,
    fontSize: '42px',
    fontStyle: '500',
    fill: '#cfcfe0'
  },
  caption: {
    fontFamily: FONT_STACK,
    fontSize: '36px',
    fontStyle: '500',
    fill: READABLE_GRAY
  }
};

export function style(name, overrides = {}) {
  const { art = false, ...rest } = overrides;
  const s = { ...PRESETS[name], ...rest };
  if (art) return s;
  const px = parseFloat(s.fontSize);
  if (Number.isFinite(px)) s.fontSize = `${snapFontPx(px)}px`;
  if (parseFloat(s.fontSize) < TYPE.body && DIM_GRAYS.has(String(s.fill).toLowerCase())) {
    s.fill = READABLE_GRAY;
  }
  return s;
}

// Menu copy: the same scale, with brighter body text.
const MENU_PRESETS = {
  body: { fontSize: `${TYPE.body}px`, fill: '#e0e0ef' },
  caption: { fontSize: `${TYPE.body}px`, fill: '#cfcfe0' },
  button: { fontSize: `${TYPE.button}px`, fontStyle: '800' }
};

export function menuStyle(name, overrides = {}) {
  return style(name === 'button' ? 'subhead' : name, {
    ...MENU_PRESETS[name], ...overrides
  });
}
