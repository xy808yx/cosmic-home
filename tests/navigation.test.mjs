import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

// Exercise real scene handlers with lightweight display objects, without a
// browser, audio device, or access to the player's saved progress or PIN.
class DisplayObject extends EventEmitter {
  constructor(kind, x = 0, y = 0, text = '') {
    super();
    Object.assign(this, { kind, x, y, text, list: [], width: 100 });
  }
  add(child) { this.list.push(child); return this; }
  setText(value) { this.text = value; return this; }
  destroy() {
    this.emit('destroy');
    this.list.forEach(child => child.destroy());
    this.list = [];
    this.removeAllListeners();
  }
}
for (const method of [
  'setDepth', 'setOrigin', 'setInteractive', 'setAlpha', 'setScale',
  'setColor', 'clear', 'fillStyle', 'lineStyle', 'fillRoundedRect',
  'strokeRoundedRect', 'fillRect', 'fillCircle',
]) DisplayObject.prototype[method] = function () { return this; };

const COLORS = { bgPanel: 0, accentTeal: 1, error: 2, success: 3 };
const audio = { playClick() {} };
const style = (_name, overrides) => overrides || {};

function displayScene() {
  const objects = [];
  const make = (kind, x, y, text) => {
    const object = new DisplayObject(kind, x, y, text);
    objects.push(object);
    return object;
  };
  return {
    objects,
    add: {
      container: (x, y) => make('container', x, y),
      graphics: () => make('graphics'),
      text: (x, y, value) => make('text', x, y, value),
      rectangle: (x, y) => make('rectangle', x, y),
    },
    tweens: { add() {} },
    input: { keyboard: new EventEmitter() },
    events: new EventEmitter(),
  };
}

async function loadSubject(path, name, dependencies = {}) {
  const source = (await readFile(new URL(path, import.meta.url), 'utf8'))
    .replace(/^import\s[\s\S]*?;\n/gm, '')
    .replace(/^export /gm, '');
  const context = vm.createContext({
    Phaser: { Scene: class {}, Math: { Clamp: (v, min, max) => Math.min(max, Math.max(min, v)) } },
    COLORS, audio, style, menuStyle: style, ...dependencies,
  });
  vm.runInContext(`${source}\nglobalThis.subject = ${name};`, context);
  return context.subject;
}

const createPinKeypad = await loadSubject('../src/pinKeypad.js', 'createPinKeypad');
const ShopScene = await loadSubject('../src/scenes/ShopScene.js', 'ShopScene', {
  ship: { ownsPart: () => false, getCurrentParts: () => ({}) },
  economy: { canAfford: () => true },
  rarityOf: () => 'common', RARITY_COLOR: { common: 0 }, RARITY_LABEL: { common: 'Common' },
  drawShip: () => new DisplayObject('ship'),
});

test('shop cards ignore hidden areas, drags, and unmatched releases', () => {
  const scene = Object.assign(new ShopScene(), displayScene(), { scrollTop: 360, scrollBottom: 1780 });
  let selected = 0;
  scene.handleTap = () => selected++;
  const card = scene.makeShopCard({ id: 'test', name: 'Test', slot: 'paint', price: 1 }, 'paint', 320, 380);
  const hit = card.list.at(-1);
  const pointer = y => ({ id: 1, x: 540, y });
  const tap = (downY, upY = downY) => {
    hit.emit('pointerdown', pointer(downY));
    hit.emit('pointerup', pointer(upY));
  };
  tap(1860);
  tap(340);
  tap(1700, 1860);
  tap(1860, 1700);
  hit.emit('pointerup', pointer(1000));
  assert.equal(selected, 0);

  scene.dragMoved = true;
  tap(1000);
  assert.equal(selected, 0);
  scene.dragMoved = false;
  tap(1000);
  assert.equal(selected, 1);
});

test('shop refresh keeps the browsing position, clamps shorter lists, and resets new tabs', () => {
  const scene = Object.assign(new ShopScene(), displayScene(), {
    activeTab: 'style', cardObjects: [], scrollLayer: new DisplayObject('container'),
    scrollTop: 360, scrollBottom: 1780, scrollOffset: 0,
  });
  let count = 24;
  scene.itemsForTab = () => Array.from({ length: count }, () => ({}));
  scene.makeShopCard = () => new DisplayObject('card');
  scene.refreshTabBar = () => {};
  scene.renderActiveTab();
  scene.applyScroll(500);
  scene.renderActiveTab();
  assert.equal(scene.scrollOffset, 500);
  assert.equal(scene.scrollLayer.y, -500);
  scene.switchTab('aura');
  assert.equal(scene.scrollOffset, 0);
  scene.applyScroll(500);
  count = 6;
  scene.renderActiveTab();
  assert.equal(scene.scrollOffset, 0);
  assert.equal(scene.scrollMaxOffset, 0);
});

test('shared PIN keypad supports touch and keyboard and cleans up both lifecycle paths', () => {
  const scene = displayScene();
  let value = '';
  const opts = {
    onDigit: digit => { value += digit; },
    onClear: () => { value = ''; },
    onBackspace: () => { value = value.slice(0, -1); },
  };
  const pad = createPinKeypad(scene, opts);
  pad.list[0].list.at(-1).emit('pointerdown');
  scene.input.keyboard.emit('keydown', { key: '2', preventDefault() {} });
  assert.equal(value, '12');
  pad.list[11].list.at(-1).emit('pointerdown');
  assert.equal(value, '1');
  pad.list[9].list.at(-1).emit('pointerdown');
  assert.equal(value, '');
  pad.destroy();
  assert.equal(scene.input.keyboard.listenerCount('keydown'), 0);
  assert.equal(scene.events.listenerCount('shutdown'), 0);

  const nextPad = createPinKeypad(scene, opts);
  scene.events.emit('shutdown');
  assert.equal(scene.input.keyboard.listenerCount('keydown'), 0);
  assert.equal(nextPad.listenerCount('destroy'), 0);
  nextPad.destroy();
});

test('Change PIN touch input requires four digits and cancel discards changes', async () => {
  const saved = new Map();
  const buttons = [];
  const ParentDashboardScene = await loadSubject('../src/scenes/ParentDashboardScene.js', 'ParentDashboardScene', {
    createPinKeypad,
    localStorage: { setItem: (key, value) => saved.set(key, value) },
    createButton: (_scene, options) => {
      buttons.push(options);
      return new DisplayObject('button');
    },
  });
  const scene = Object.assign(new ParentDashboardScene(), displayScene());
  scene.flashMessage = () => {};
  scene.showChangePinDialog();
  const card = scene.objects.find(object => object.kind === 'container' && object.y === 960);
  const pad = card.list.find(object => object.kind === 'container' && object.list.length === 12);
  const display = card.list.find(object => object.kind === 'text' && object.text === '_ _ _ _');
  pad.list[0].list.at(-1).emit('pointerdown');
  buttons.find(button => button.label === 'Save').onClick();
  assert.equal(saved.size, 0);
  assert.equal(display.text, '1 _ _ _');
  buttons.find(button => button.label === 'Cancel').onClick();
  assert.equal(saved.size, 0);
  assert.equal(scene.input.keyboard.listenerCount('keydown'), 0);

  buttons.length = 0;
  scene.showChangePinDialog();
  const nextCard = scene.objects.findLast(object => object.kind === 'container' && object.y === 960);
  const nextPad = nextCard.list.find(object => object.kind === 'container' && object.list.length === 12);
  for (const keyIndex of [0, 1, 2, 3, 4]) nextPad.list[keyIndex].list.at(-1).emit('pointerdown');
  buttons.find(button => button.label === 'Save').onClick();
  assert.equal(saved.get('cosmicMathParentPin'), '1234');
  assert.equal(scene.input.keyboard.listenerCount('keydown'), 0);
});
