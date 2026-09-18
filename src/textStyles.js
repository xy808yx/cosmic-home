// Shared text style presets. Use `style('headline')` or `style('body', { fill: '#f00' })`.

const FONT_STACK = '"Nunito", "ui-rounded", "Avenir Next", "Helvetica Neue", system-ui, -apple-system, Arial, sans-serif';

const PRESETS = {
  display: {
    fontFamily: FONT_STACK,
    fontSize: '54px',
    fontStyle: '900',
    fill: '#ffffff',
    stroke: '#0a0a1a',
    strokeThickness: 3
  },
  headline: {
    fontFamily: FONT_STACK,
    fontSize: '40px',
    fontStyle: '800',
    fill: '#ffffff'
  },
  subhead: {
    fontFamily: FONT_STACK,
    fontSize: '34px',
    fontStyle: '700',
    fill: '#ffffff'
  },
  body: {
    fontFamily: FONT_STACK,
    fontSize: '28px',
    fontStyle: '500',
    fill: '#cfcfe0'
  },
  caption: {
    fontFamily: FONT_STACK,
    fontSize: '22px',
    fontStyle: '500',
    fill: '#8888a0'
  }
};

export function style(name, overrides = {}) {
  return { ...PRESETS[name], ...overrides };
}

// Menu copy is drawn on a 1080px canvas. At the minimum 360px phone width,
// these sizes keep body text at 14px and supporting text above 13px.
const MENU_PRESETS = {
  body: { fontSize: '42px', fill: '#e0e0ef' },
  caption: { fontSize: '40px', fill: '#cfcfe0' },
  button: { fontSize: '44px', fontStyle: '800' }
};

export function menuStyle(name, overrides = {}) {
  return style(name === 'button' ? 'subhead' : name, {
    ...MENU_PRESETS[name], ...overrides
  });
}
