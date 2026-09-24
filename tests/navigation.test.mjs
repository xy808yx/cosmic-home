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
    this.destroyed = true;
    this.emit('destroy');
    this.list.forEach(child => child.destroy());
    this.list = [];
    this.removeAllListeners();
  }
}
for (const method of [
  'setDepth', 'setOrigin', 'setInteractive', 'setAlpha', 'setScale',
  'setColor', 'clear', 'fillStyle', 'lineStyle', 'fillRoundedRect',
  'strokeRoundedRect', 'fillRect', 'fillCircle', 'strokeCircle', 'setVisible',
]) DisplayObject.prototype[method] = function () { return this; };

const COLORS = { bgPanel: 0, accentTeal: 1, error: 2, success: 3, warning: 4 };
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

// A display scene with a hand-cranked clock: advance(ms) moves time.now and
// runs any timers that fall due.
function timedScene() {
  const scene = displayScene();
  const timers = [];
  scene.time = {
    now: 0,
    addEvent: ({ callback }) => {
      const timer = { callback, loop: true, remove() { this.removed = true; } };
      timers.push(timer);
      return timer;
    },
    delayedCall: (delay, callback) => timers.push({ at: scene.time.now + delay, callback }),
  };
  scene.advance = ms => {
    scene.time.now += ms;
    for (const timer of [...timers]) {
      if (timer.loop) {
        if (!timer.removed) timer.callback();
      } else if (!timer.done && timer.at <= scene.time.now) {
        timer.done = true;
        timer.callback();
      }
    }
  };
  return scene;
}

const live = (scene, kind) => scene.objects.filter(object => object.kind === kind && !object.destroyed);
const liveTexts = scene => live(scene, 'text').map(object => object.text);
const liveKeypad = scene => live(scene, 'container').findLast(object => object.list.length === 12);
// Finds the live keypad for every digit, since a step can end mid-string.
function press(scene, digits) {
  for (const digit of digits) {
    liveKeypad(scene).list[digit === '0' ? 10 : Number(digit) - 1].list.at(-1).emit('pointerdown');
  }
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

function memoryStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    map,
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
  };
}

const parentPin = await import('../src/parentPin.js');
const gateButtons = [];
const gate = await loadSubject('../src/parentGate.js', '{ ParentGate, createPinDots, showCodeGate }', {
  createPinKeypad,
  ...parentPin,
  createButton: (_scene, options) => {
    const button = new DisplayObject('button');
    button.options = options;
    gateButtons.push(button);
    return button;
  },
});
function clickButton(label) {
  const button = gateButtons.findLast(b => !b.destroyed && b.options.label === label);
  assert.ok(button, `no live button "${label}"`);
  button.options.onClick();
}

test('Change PIN asks twice, shows dots, and saves only a match', async () => {
  const storage = memoryStorage();
  const buttons = [];
  const ParentDashboardScene = await loadSubject('../src/scenes/ParentDashboardScene.js', 'ParentDashboardScene', {
    createPinKeypad,
    createPinDots: gate.createPinDots,
    setPin: parentPin.setPin,
    deviceStorage: () => storage,
    createButton: (_scene, options) => {
      buttons.push(options);
      return new DisplayObject('button');
    },
  });
  const scene = Object.assign(new ParentDashboardScene(), displayScene());
  scene.flashMessage = () => {};
  const go = () => buttons.findLast(button => button.label === 'Next').onClick();
  scene.showChangePinDialog();
  const card = scene.objects.find(object => object.kind === 'container' && object.y === 960);
  const pad = card.list.find(object => object.kind === 'container' && object.list.length === 12);
  pad.list[0].list.at(-1).emit('pointerdown');
  go();
  assert.equal(storage.map.size, 0);
  buttons.find(button => button.label === 'Cancel').onClick();
  assert.equal(storage.map.size, 0);
  assert.equal(scene.input.keyboard.listenerCount('keydown'), 0);

  scene.showChangePinDialog();
  const typed = keys => {
    for (const key of keys) scene.input.keyboard.emit('keydown', { key, preventDefault() {} });
  };
  typed('1234');
  go();
  typed('1235');
  go();
  assert.equal(storage.map.size, 0);
  assert.ok(liveTexts(scene).includes('Those didn\'t match. Try again.'));
  typed('1234');
  go();
  typed('1234');
  go();
  assert.equal(storage.getItem('cosmicMathParentPin'), '1234');
  assert.ok(storage.getItem('cosmicMathParentPinInfo'));
  assert.equal(scene.input.keyboard.listenerCount('keydown'), 0);
  // Digits never appear on screen, only dots.
  assert.ok(!scene.objects.some(object => object.kind === 'text' && /1\s*2\s*3/.test(object.text)));
});

function openGate(storage, now) {
  const scene = timedScene();
  const unlocked = [];
  const left = [];
  const door = new gate.ParentGate(scene, {
    storage,
    now: () => now.value,
    onUnlock: notice => unlocked.push(notice),
    onBack: () => left.push(true),
  });
  door.start();
  return { scene, door, unlocked, left };
}

// Local noon, so the dates on screen are the same in every timezone.
const NOW = new Date(2026, 8, 23, 12, 0, 0).getTime();
const DAY = 24 * 60 * 60 * 1000;

test('first visit: welcome, grown-up check, PIN typed twice, then the dashboard', () => {
  const storage = memoryStorage();
  const { scene, door, unlocked } = openGate(storage, { value: NOW });
  assert.equal(door.step, 'welcome');
  assert.ok(liveTexts(scene).includes('Grown-ups only'));
  assert.equal(liveKeypad(scene), undefined);

  scene.advance(400);
  clickButton('Make my PIN');
  assert.equal(door.step, 'year');
  scene.advance(400);
  press(scene, '1988');
  assert.equal(door.step, 'age');
  press(scene, '38');
  assert.equal(door.step, 'make');
  press(scene, '4321');
  assert.equal(door.step, 'confirm');
  press(scene, '4321');
  assert.equal(door.step, 'saved');
  assert.equal(storage.getItem('cosmicMathParentPin'), '4321');
  assert.ok(!scene.objects.some(object => object.kind === 'text' && /4\s*3\s*2\s*1/.test(object.text)));
  // One keypad and one keyboard listener at a time, the whole way through.
  assert.equal(scene.input.keyboard.listenerCount('keydown'), 0);

  scene.advance(400);
  clickButton('Open Dashboard');
  assert.deepEqual(unlocked, [null]);
});

test('a key press Phaser hands over again counts once, even on the next screen', () => {
  const storage = memoryStorage();
  const { scene, door } = openGate(storage, { value: NOW });
  scene.advance(400);
  clickButton('Make my PIN');
  scene.advance(400);
  // Phaser 3.90 re-runs its key queue on each new key event in a frame.
  const sent = [];
  const key = k => {
    const event = { key: k, preventDefault() {} };
    sent.push(event);
    for (const again of sent) scene.input.keyboard.emit('keydown', again);
  };
  for (const k of '198838') key(k);
  assert.equal(door.step, 'make');
  for (const k of '2580') key(k);
  assert.equal(door.step, 'confirm');
  for (const k of '2580') key(k);
  assert.equal(door.step, 'saved');
  assert.equal(storage.getItem('cosmicMathParentPin'), '2580');
});

test('a PIN typed differently the second time starts over, and nothing is saved', () => {
  const storage = memoryStorage();
  const { scene, door } = openGate(storage, { value: NOW });
  scene.advance(400);
  clickButton('Make my PIN');
  scene.advance(400);
  press(scene, '198838');
  press(scene, '1111');
  press(scene, '2222');
  assert.ok(liveTexts(scene).includes('Those didn\'t match. Let\'s start over.'));
  scene.advance(2000);
  assert.equal(door.step, 'make');
  assert.equal(storage.getItem('cosmicMathParentPin'), null);
});

test('a child answering honestly never gets to make a PIN, and grinding pauses', () => {
  const storage = memoryStorage();
  const now = { value: NOW };
  const { scene, door } = openGate(storage, now);
  for (let round = 0; round < 5; round++) {
    scene.advance(400);
    clickButton(round === 0 ? 'Make my PIN' : 'Try again');
    scene.advance(400);
    press(scene, '201709');
    assert.equal(door.step, 'failed');
    assert.ok(liveTexts(scene).includes('This part is for grown-ups.'));
  }
  assert.equal(storage.getItem('cosmicMathParentPin'), null);

  // The fifth miss earned a pause: the next try ignores every key.
  scene.advance(400);
  clickButton('Try again');
  scene.advance(400);
  assert.ok(liveTexts(scene).some(text => /^Too many tries\. Wait \d+ seconds\.$/.test(text)));
  press(scene, '1988');
  assert.equal(door.step, 'year');
  now.value += 31_000;
  scene.advance(300);
  press(scene, '1988');
  assert.equal(door.step, 'age');
});

test('a double-tap on a button cannot type into the keypad it opens', () => {
  const { scene, door } = openGate(memoryStorage(), { value: NOW });
  scene.advance(400);
  clickButton('Make my PIN');
  press(scene, '1');
  assert.ok(liveTexts(scene).includes('_ _ _ _'));
  scene.advance(400);
  press(scene, '1');
  assert.ok(liveTexts(scene).includes('1 _ _ _'));
  assert.equal(door.step, 'year');

  // And a button tapped straight after a step appears does nothing.
  const fresh = openGate(memoryStorage(), { value: NOW });
  clickButton('Make my PIN');
  assert.equal(fresh.door.step, 'welcome');
});

test('later visits: wrong PIN is refused, right PIN opens and cancels a waiting reset', () => {
  const storage = memoryStorage();
  parentPin.setPin(storage, '2468', NOW - DAY);
  parentPin.startReset(storage, NOW);
  const { scene, door, unlocked } = openGate(storage, { value: NOW + 60_000 });
  assert.equal(door.step, 'enter');
  assert.ok(liveTexts(scene).includes('A PIN reset is waiting.'));
  scene.advance(400);
  press(scene, '1111');
  assert.deepEqual(unlocked, []);
  scene.advance(600);
  press(scene, '2468');
  assert.deepEqual(unlocked, ['PIN reset cancelled']);
  assert.equal(parentPin.pendingReset(storage, NOW), null);
  assert.equal(storage.getItem('cosmicMathPinGuard'), null);
});

test('forgot the PIN: a one-day reset, then the door asks for a new PIN', () => {
  const storage = memoryStorage();
  parentPin.setPin(storage, '2468', NOW - DAY);
  const { scene, door } = openGate(storage, { value: NOW });
  scene.advance(400);
  live(scene, 'rectangle').findLast(object => object.y === 1390).emit('pointerdown');
  assert.equal(door.step, 'forgot');
  assert.ok(liveTexts(scene).some(text => text.startsWith('This PIN was made on September\u00a022, 2026. Not you?')));
  scene.advance(400);
  clickButton('Start 1-day reset');
  assert.equal(door.step, 'resetStarted');
  assert.ok(liveTexts(scene).some(text => /^The old PIN comes off Thursday, September\u00a024 at\u00a0/.test(text)));
  assert.equal(storage.getItem('cosmicMathParentPin'), '2468');

  const early = openGate(storage, { value: NOW + DAY - 60_000 });
  assert.equal(early.door.step, 'enter');
  assert.equal(storage.getItem('cosmicMathParentPin'), '2468');

  const later = openGate(storage, { value: NOW + DAY });
  assert.equal(later.door.step, 'welcome');
  assert.ok(liveTexts(later.scene).includes('The old PIN was removed. Make a new grown-up PIN.'));
  assert.equal(storage.getItem('cosmicMathParentPin'), null);
});

test('a device that cannot save still lets the grown-up in, just this once', () => {
  // null is what deviceStorage() gives when the browser blocks storage.
  for (const storage of [null, { getItem: () => null, setItem() { throw new Error('QuotaExceededError'); }, removeItem() {} }]) {
    const { scene, door, unlocked } = openGate(storage, { value: NOW });
    assert.equal(door.step, 'welcome');
    scene.advance(400);
    clickButton('Make my PIN');
    scene.advance(400);
    press(scene, '198838');
    press(scene, '2580');
    press(scene, '2580');
    assert.ok(liveTexts(scene).includes('This device could not save your PIN.'));
    scene.advance(2000);
    assert.deepEqual(unlocked, ['PIN not saved on this device']);
  }
});

test('a PIN screen left open past the reset time settles it instead of showing an old time', () => {
  const storage = memoryStorage();
  parentPin.setPin(storage, '2468', NOW - DAY);
  parentPin.startReset(storage, NOW - DAY + 60_000);
  const now = { value: NOW };
  const { scene, door } = openGate(storage, now);
  assert.equal(door.step, 'enter');
  now.value = NOW + 120_000;
  scene.advance(400);
  live(scene, 'rectangle').findLast(object => object.y === 1390).emit('pointerdown');
  assert.equal(door.step, 'welcome');
  assert.ok(liveTexts(scene).includes('The old PIN was removed. Make a new grown-up PIN.'));
  assert.equal(storage.getItem('cosmicMathParentPin'), null);
});

test('dev menu code: 8888 opens it, wrong codes pause, and the code is never shown', async () => {
  const source = await readFile(new URL('../src/scenes/DevMenuScene.js', import.meta.url), 'utf8');
  assert.match(source, /const DEV_MENU_CODE = '8888';/);

  const storage = memoryStorage();
  const now = { value: NOW };
  const scene = timedScene();
  let opened = 0;
  gate.showCodeGate(scene, {
    code: '8888', storage, guardKey: parentPin.DEV_MENU_GUARD_STORAGE_KEY,
    now: () => now.value, onUnlock: () => opened++, onBack: () => {},
  });
  scene.advance(400);
  for (let i = 0; i < 5; i++) {
    press(scene, '1234');
    scene.advance(600);
  }
  assert.ok(liveTexts(scene).some(text => text.startsWith('Too many tries.')));
  press(scene, '8888');
  assert.equal(opened, 0);
  now.value += 31_000;
  scene.advance(300);
  press(scene, '8888');
  assert.equal(opened, 1);
  assert.ok(!scene.objects.some(object => object.kind === 'text' && /8\s*8\s*8\s*8/.test(object.text)));
  // The parent PIN's own count is untouched.
  assert.equal(storage.getItem('cosmicMathPinGuard'), null);
});

test('Settings tab puts Move to a New Device first and Reset last, and Move opens the sheet', async () => {
  const opened = [];
  const ParentDashboardScene = await loadSubject('../src/scenes/ParentDashboardScene.js', 'ParentDashboardScene', {
    openTransferSheet: scene => opened.push(scene),
  });
  const scene = Object.assign(new ParentDashboardScene(), displayScene());
  scene.contentContainer = scene.add.container(0, 0);
  scene.registry = { set() {} };
  scene.showSettingsTab();
  const rows = scene.contentContainer.list.filter(object => object.kind === 'container').map(c => ({
    label: c.list.find(object => object.kind === 'text')?.text,
    y: c.y,
    hit: c.list.at(-1),
  }));
  assert.deepEqual(rows.map(row => [row.label, row.y]), [
    ['Move to a New Device', 360],
    ['Change PIN', 490],
    ['Lock Dashboard', 620],
    ['Reset All Progress', 780],
  ]);
  const about = scene.contentContainer.list.find(object => object.kind === 'text' && object.text === 'About difficulty');
  assert.equal(about.y, 940);
  rows[0].hit.emit('pointerdown');
  assert.equal(opened.length, 1);
  assert.equal(opened[0], scene);
});
