// The door in front of the Parent Dashboard, plus the hidden dev menu's code
// screen. The rules live in parentPin.js; this file only draws and wires them.
//
// First visit on a device with no PIN: a short welcome, a two-question
// grown-up check, then the grown-up makes their own PIN, typed twice.
// Every later visit: type the PIN, shown as dots so nobody watching can read
// it. "Don't know the PIN?" starts a one-day reset that the real PIN cancels.
//
// Each step is built into one layer that is thrown away before the next step,
// so exactly one keypad (and one hardware-keyboard listener) is ever alive.

import { audio } from './AudioManager.js';
import { createPinKeypad } from './pinKeypad.js';
import { createButton } from './buttonHelper.js';
import { style, menuStyle } from './textStyles.js';
import { COLORS } from './colorPalette.js';
import {
  PIN_LENGTH, PIN_GUARD_STORAGE_KEY,
  hasPin, pinMatches, setPin, pinMadeAt, isGrownUpAnswer,
  pendingReset, startReset, cancelReset, settleReset,
  pauseLeft, noteWrongTry, clearTries,
  formatWhen, formatDay, secondsLeft,
} from './parentPin.js';

const W = 1080;
const H = 1920;

// The same spots the old PIN screen used, so every step lines up with it.
const TITLE_Y = 240;
const LINE_Y = 320;
const ENTRY_Y = 460;
// Halfway between the entry dots and the keypad's top row.
const STATUS_Y = 558;
const PAD_Y = 700;
const LINK_Y = 1390;
const TEXT_TOP_Y = 380;
const PRIMARY_Y = 1100;
const SECONDARY_Y = 1250;
const NOTE_Y = 1400;
const BACK_Y = H - 130;
const TEXT_W = 900;

// A tap that lands within this long of a new step appearing is the tail of a
// double-tap on the previous step, not a choice.
const TAP_GUARD_MS = 300;
const WRONG_FLASH_MS = 500;
const RESTART_MS = 1300;

const DOT_GAP = 120;
const DOT_R = 26;

const WHITE = 0xffffff;
const hex = color => `#${color.toString(16).padStart(6, '0')}`;
const SOFT = '#cfcfe0';
const WARN = hex(COLORS.warning);
const BAD = hex(COLORS.error);
const LINK = hex(COLORS.accentTeal);
const QUIET = 0x4a4a6a;
// Button labels at menu weight. No fill, so createButton picks dark ink on the
// light teal and green faces and white on the dark gray one.
const BUTTON_TEXT = { fontStyle: '800' };

// Four rings that fill in as digits are typed. Returns { view, set(count, color) }.
export function createPinDots(scene, { x = 0, y = 0, length = PIN_LENGTH } = {}) {
  const view = scene.add.graphics();
  let filled = 0;
  let tint = WHITE;
  const draw = () => {
    view.clear();
    for (let i = 0; i < length; i++) {
      const cx = x + (i - (length - 1) / 2) * DOT_GAP;
      if (i < filled) {
        view.fillStyle(tint, 1);
        view.fillCircle(cx, y, DOT_R);
      } else {
        view.lineStyle(5, tint, 0.85);
        view.strokeCircle(cx, y, DOT_R);
      }
    }
  };
  draw();
  return {
    view,
    set(count, color = WHITE) {
      filled = count;
      tint = color;
      draw();
    },
  };
}

function addTitle(scene, layer, text) {
  layer.add(scene.add.text(W / 2, TITLE_Y, text, style('display', {
    fontSize: '64px',
    fill: '#ffffff',
    align: 'center',
    wordWrap: { width: 980, useAdvancedWrap: true },
  })).setOrigin(0.5));
}

function addLine(scene, layer, text) {
  layer.add(scene.add.text(W / 2, LINE_Y, text, menuStyle('body')).setOrigin(0.5));
}

// A centered paragraph whose top sits at y. Returns the y just below it.
function addParagraph(scene, layer, y, text, kind = 'body') {
  const t = scene.add.text(W / 2, y, text, menuStyle(kind, {
    align: 'center',
    lineSpacing: 8,
    wordWrap: { width: TEXT_W, useAdvancedWrap: true },
  })).setOrigin(0.5, 0);
  layer.add(t);
  return y + (t.height || 0);
}

function addStatus(scene, layer) {
  const t = scene.add.text(W / 2, STATUS_Y, '', menuStyle('caption', {
    align: 'center',
    wordWrap: { width: TEXT_W, useAdvancedWrap: true },
  })).setOrigin(0.5);
  layer.add(t);
  return {
    set(text, color = SOFT) {
      t.setText(text);
      t.setColor(color);
    },
  };
}

function pauseText(ms) {
  const s = secondsLeft(ms);
  return `Too many tries. Wait ${s} second${s === 1 ? '' : 's'}.`;
}

// Keeps the status line showing the pause countdown while one is running, and
// `idle` otherwise. Returns a function that re-checks right away.
function watchPause(scene, layer, status, { storage, now, guardKey, idle = '' }) {
  const tick = () => {
    const left = pauseLeft(storage, now(), guardKey);
    if (left > 0) status.set(pauseText(left), WARN);
    else status.set(idle);
    return left > 0;
  };
  tick();
  const timer = scene.time.addEvent({ delay: 250, loop: true, callback: tick });
  layer.once('destroy', () => timer.remove());
  return tick;
}

// Boxes (or dots) above the shared keypad. onFull runs once the last digit
// is in; input then waits until reject() or the layer is replaced.
function addEntry(scene, layer, { length, hidden, touchDelayMs, blocked = () => false, onFull }) {
  let value = '';
  let waiting = false;
  let alive = true;
  layer.once('destroy', () => { alive = false; });

  const dots = hidden ? createPinDots(scene, { x: W / 2, y: ENTRY_Y, length }) : null;
  const text = hidden ? null : scene.add.text(W / 2, ENTRY_Y, '', style('display', {
    fontSize: '96px',
    fill: '#ffffff',
  })).setOrigin(0.5);
  layer.add(dots ? dots.view : text);

  const render = (color = WHITE) => {
    if (dots) {
      dots.set(value.length, color);
    } else {
      text.setText(Array.from({ length }, (_, i) => value[i] || '_').join(' '));
      text.setColor(hex(color));
    }
  };
  render();

  layer.add(createPinKeypad(scene, {
    x: W / 2,
    y: PAD_Y,
    touchDelayMs,
    onDigit: digit => {
      if (waiting || blocked() || value.length >= length) return;
      value += digit;
      render();
      if (value.length === length) {
        waiting = true;
        onFull(value);
      }
    },
    onClear: () => {
      if (waiting) return;
      value = '';
      render();
    },
    onBackspace: () => {
      if (waiting) return;
      value = value.slice(0, -1);
      render();
    },
  }));

  return {
    // Red flash and a shake, then empty. `after` runs once it is ready again,
    // or instead of that after `holdMs` when given.
    reject(after, holdMs = WRONG_FLASH_MS) {
      render(COLORS.error);
      scene.cameras?.main?.shake(200, 0.01);
      scene.time.delayedCall(holdMs, () => {
        if (!alive) return;
        value = '';
        waiting = false;
        render();
        if (after) after();
      });
    },
  };
}

// The hidden dev menu's door: a fixed code, the same dots and keypad, and its
// own wrong-try pause. Nothing on screen says what the code is.
export function showCodeGate(scene, { code, storage, guardKey, now = () => Date.now(), onUnlock, onBack }) {
  const layer = scene.add.container(0, 0).setDepth(10);
  addTitle(scene, layer, 'Grown-ups only');
  addLine(scene, layer, 'Enter the code');
  const status = addStatus(scene, layer);
  const recheck = watchPause(scene, layer, status, { storage, now, guardKey });
  const entry = addEntry(scene, layer, {
    length: code.length,
    hidden: true,
    touchDelayMs: TAP_GUARD_MS,
    blocked: recheck,
    onFull: value => {
      if (value === code) {
        clearTries(storage, guardKey);
        layer.destroy();
        onUnlock();
        return;
      }
      noteWrongTry(storage, now(), guardKey);
      recheck();
      entry.reject();
    },
  });
  layer.add(createButton(scene, {
    x: W / 2, y: BACK_Y, label: '< Back to Game',
    width: 440, height: 100, color: QUIET,
    textOverrides: BUTTON_TEXT,
    onClick: onBack,
  }));
  return layer;
}

export class ParentGate {
  // onUnlock(notice) opens the dashboard; notice is a short line to flash
  // there, or null. onBack leaves for the map.
  constructor(scene, { storage, onUnlock, onBack, now = () => Date.now() }) {
    this.scene = scene;
    this.storage = storage;
    this.onUnlock = onUnlock;
    this.onBack = onBack;
    this.now = now;
    this.layer = null;
    this.step = null;
    this.shownAt = 0;
  }

  start() {
    const removed = settleReset(this.storage, this.now());
    this.show(hasPin(this.storage) ? 'enter' : 'welcome', { removed });
  }

  clock() {
    return this.scene.time ? this.scene.time.now : 0;
  }

  // fromKeypad: the step before ended on its last digit, so the next keypad
  // takes taps at once (a grown-up typing a PIN twice keeps going).
  show(step, data = {}, { fromKeypad = false } = {}) {
    if (this.layer) this.layer.destroy();
    this.layer = this.scene.add.container(0, 0).setDepth(10);
    this.step = step;
    this.shownAt = this.clock();
    this.touchDelayMs = fromKeypad ? 0 : TAP_GUARD_MS;
    const build = {
      welcome: this.welcomeStep,
      year: this.yearStep,
      age: this.ageStep,
      failed: this.failedStep,
      make: this.makeStep,
      confirm: this.confirmStep,
      saved: this.savedStep,
      enter: this.enterStep,
      forgot: this.forgotStep,
      resetStarted: this.resetStartedStep,
    }[step];
    build.call(this, this.layer, data);
  }

  // Runs fn unless the tap is the tail of a double-tap on the previous step.
  guarded(fn) {
    return () => {
      if (this.clock() - this.shownAt < TAP_GUARD_MS) return;
      fn();
    };
  }

  button(layer, y, label, onClick, color = COLORS.success) {
    layer.add(createButton(this.scene, {
      x: W / 2, y, label,
      width: 600, height: 110, color,
      textOverrides: BUTTON_TEXT,
      onClick: this.guarded(onClick),
    }));
  }

  backButton(layer) {
    layer.add(createButton(this.scene, {
      x: W / 2, y: BACK_Y, label: '< Back to Game',
      width: 440, height: 100, color: QUIET,
      textOverrides: BUTTON_TEXT,
      onClick: this.guarded(this.onBack),
    }));
  }

  // Status line plus pause countdown, for the steps where wrong answers count.
  guardedEntry(layer, { length, hidden, idle = '', onFull }) {
    const { scene, storage, now } = this;
    const status = addStatus(scene, layer);
    const recheck = watchPause(scene, layer, status, { storage, now, guardKey: PIN_GUARD_STORAGE_KEY, idle });
    const entry = addEntry(scene, layer, {
      length, hidden, touchDelayMs: this.touchDelayMs, blocked: recheck, onFull: value => onFull(value, entry, recheck),
    });
    return entry;
  }

  // ----- First visit ---------------------------------------------------
  welcomeStep(layer, { removed }) {
    const { scene } = this;
    addTitle(scene, layer, 'Grown-ups only');
    let y = TEXT_TOP_Y;
    y = addParagraph(scene, layer, y, 'This is where grown-ups see how your child is doing and change settings.') + 40;
    y = addParagraph(scene, layer, y, removed
      ? 'The old PIN was removed. Make a new grown-up PIN.'
      : 'First time on this device? Make your own grown-up PIN.') + 40;
    addParagraph(scene, layer, y, 'First, two quick questions to keep kids out. Your answers are not saved.', 'caption');
    this.button(layer, PRIMARY_Y, 'Make my PIN', () => this.show('year'));
    this.backButton(layer);
  }

  yearStep(layer) {
    addTitle(this.scene, layer, 'What year were you born?');
    addLine(this.scene, layer, 'Question 1 of 2');
    this.guardedEntry(layer, {
      length: 4,
      hidden: false,
      onFull: year => this.show('age', { year }, { fromKeypad: true }),
    });
    this.backButton(layer);
  }

  ageStep(layer, { year }) {
    addTitle(this.scene, layer, 'How old are you?');
    addLine(this.scene, layer, 'Question 2 of 2');
    this.guardedEntry(layer, {
      length: 2,
      hidden: false,
      onFull: age => {
        // One verdict for the pair, never which answer was off.
        if (isGrownUpAnswer(year, age, this.now())) {
          clearTries(this.storage);
          this.show('make', {}, { fromKeypad: true });
        } else {
          noteWrongTry(this.storage, this.now());
          this.show('failed');
        }
      },
    });
    this.backButton(layer);
  }

  failedStep(layer) {
    const { scene } = this;
    addTitle(scene, layer, 'That didn\'t work');
    let y = TEXT_TOP_Y;
    y = addParagraph(scene, layer, y, 'This part is for grown-ups.') + 40;
    addParagraph(scene, layer, y, 'Grown-ups: check your answers and try again.', 'caption');
    this.button(layer, PRIMARY_Y, 'Try again', () => this.show('year'), COLORS.accentTeal);
    this.backButton(layer);
  }

  makeStep(layer) {
    addTitle(this.scene, layer, 'Make your PIN');
    addLine(this.scene, layer, 'Pick 4 numbers you\'ll remember.');
    addEntry(this.scene, layer, {
      length: PIN_LENGTH,
      hidden: true,
      touchDelayMs: this.touchDelayMs,
      onFull: first => this.show('confirm', { first }, { fromKeypad: true }),
    });
    this.backButton(layer);
  }

  confirmStep(layer, { first }) {
    const { scene } = this;
    addTitle(scene, layer, 'Type it again');
    addLine(scene, layer, 'Type the same 4 numbers to be sure.');
    const status = addStatus(scene, layer);
    const entry = addEntry(scene, layer, {
      length: PIN_LENGTH,
      hidden: true,
      touchDelayMs: this.touchDelayMs,
      onFull: second => {
        if (second !== first) {
          status.set('Those didn\'t match. Let\'s start over.', BAD);
          entry.reject(() => this.show('make', {}, { fromKeypad: true }), RESTART_MS);
        } else if (!setPin(this.storage, second, this.now())) {
          // Storage is full or blocked. The grown-up check was passed, so let
          // them in this once; nothing is saved and the next visit asks again.
          status.set('This device could not save your PIN.', BAD);
          entry.reject(() => this.onUnlock('PIN not saved on this device'), RESTART_MS);
        } else {
          this.show('saved');
        }
      },
    });
    this.backButton(layer);
  }

  savedStep(layer) {
    const { scene } = this;
    addTitle(scene, layer, 'Your PIN is set');
    let y = TEXT_TOP_Y;
    y = addParagraph(scene, layer, y, 'Next time, tap the gear and type your PIN.') + 40;
    y = addParagraph(scene, layer, y, 'It works on this device only.') + 40;
    addParagraph(scene, layer, y, 'If you ever forget it, tap "Don\'t know the PIN?" under the keypad.', 'caption');
    this.button(layer, PRIMARY_Y, 'Open Dashboard', () => this.onUnlock(null));
    this.backButton(layer);
  }

  // ----- Every later visit -----------------------------------------------
  enterStep(layer) {
    const { scene, storage } = this;
    addTitle(scene, layer, 'Parent Dashboard');
    addLine(scene, layer, 'Enter your grown-up PIN');
    this.guardedEntry(layer, {
      length: PIN_LENGTH,
      hidden: true,
      idle: pendingReset(storage, this.now()) ? 'A PIN reset is waiting.' : '',
      onFull: (value, entry, recheck) => {
        if (pinMatches(storage, value)) {
          clearTries(storage);
          const cancelled = cancelReset(storage, this.now());
          this.onUnlock(cancelled ? 'PIN reset cancelled' : null);
          return;
        }
        noteWrongTry(storage, this.now());
        recheck();
        entry.reject();
      },
    });

    const link = scene.add.text(W / 2, LINK_Y, 'Don\'t know the PIN?', menuStyle('body', { fill: LINK })).setOrigin(0.5);
    const hit = scene.add.rectangle(W / 2, LINK_Y, 640, 110, 0x000000, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', this.guarded(() => {
      audio.playClick();
      this.show('forgot');
    }));
    layer.add(link);
    layer.add(hit);
    this.backButton(layer);
  }

  forgotStep(layer) {
    const { scene, storage } = this;
    const waiting = pendingReset(storage, this.now());
    // This PIN screen was left open past the reset time: settle it now.
    if (waiting && this.now() >= waiting.readyAt) {
      this.start();
      return;
    }
    addTitle(scene, layer, 'Forgot the PIN?');
    let y = TEXT_TOP_Y;
    if (waiting) {
      y = addParagraph(scene, layer, y, `A reset is already waiting. The old PIN comes off ${formatWhen(waiting.readyAt)}.`) + 40;
      addParagraph(scene, layer, y, 'Come back then and tap the gear to make a new PIN. Typing the old PIN before then cancels the reset.', 'caption');
      this.button(layer, PRIMARY_Y, 'Back', () => this.show('enter'), QUIET);
    } else {
      y = addParagraph(scene, layer, y, 'No problem. Start a reset and the old PIN comes off in one day. Your child\'s progress is not touched.') + 40;
      y = addParagraph(scene, layer, y, 'Typing the old PIN before then cancels the reset.', 'caption') + 40;
      const madeAt = pinMadeAt(storage);
      if (madeAt !== null) {
        addParagraph(scene, layer, y,
          `This PIN was made on ${formatDay(madeAt)}. Not you? A child may have made it. Ask them.`, 'caption');
      }
      const problem = scene.add.text(W / 2, NOTE_Y, '', menuStyle('caption', {
        fill: BAD,
        align: 'center',
        wordWrap: { width: TEXT_W, useAdvancedWrap: true },
      })).setOrigin(0.5);
      layer.add(problem);
      this.button(layer, PRIMARY_Y, 'Start 1-day reset', () => {
        const started = startReset(storage, this.now());
        if (started) this.show('resetStarted', started);
        else problem.setText('This device could not start the reset. Try again.');
      }, COLORS.accentTeal);
      this.button(layer, SECONDARY_Y, 'Cancel', () => this.show('enter'), QUIET);
    }
    this.backButton(layer);
  }

  resetStartedStep(layer, { readyAt }) {
    const { scene } = this;
    addTitle(scene, layer, 'Reset started');
    let y = TEXT_TOP_Y;
    y = addParagraph(scene, layer, y, `The old PIN comes off ${formatWhen(readyAt)}.`) + 40;
    y = addParagraph(scene, layer, y, 'Then tap the gear to make a new PIN. Your child can keep playing until then.') + 40;
    addParagraph(scene, layer, y, 'Typing the old PIN before then cancels the reset.', 'caption');
    this.backButton(layer);
  }
}
