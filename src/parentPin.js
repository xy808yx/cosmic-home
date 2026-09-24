// Grown-up PIN rules for the Parent Dashboard. Pure logic only: no Phaser, no
// imports, and no DOM beyond deviceStorage(), so tests can drive it with a
// Map-backed storage. The screens that use it live in parentGate.js.
//
// There is no built-in PIN. A device with no saved PIN has none yet, and the
// first grown-up to open the Parent Dashboard makes one after a two-question
// grown-up check. A forgotten PIN comes off one day after a grown-up asks, and
// typing the real PIN before then cancels that. No answer a child could
// overhear ever replaces a PIN that is already set.
//
// Only this app's named keys are read or written. The storage area is shared
// with every other app on the same GitHub Pages address.

export const PIN_STORAGE_KEY = 'cosmicMathParentPin';
// When this device's PIN was made, tied to that PIN so a changed or imported
// PIN never shows someone else's date.
export const PIN_INFO_STORAGE_KEY = 'cosmicMathParentPinInfo';
// A waiting one-day reset, tied to the PIN it will remove.
export const PIN_RESET_STORAGE_KEY = 'cosmicMathPinReset';
// Wrong tries in a row at the Parent Dashboard door, and the pause they earned.
export const PIN_GUARD_STORAGE_KEY = 'cosmicMathPinGuard';
// The same, for the hidden dev menu's code.
export const DEV_MENU_GUARD_STORAGE_KEY = 'cosmicMathDevMenuGuard';

export const PIN_LENGTH = 4;
export const RESET_DELAY_MS = 24 * 60 * 60 * 1000;
export const TRIES_BEFORE_PAUSE = 5;
export const PAUSE_MS = 30 * 1000;
export const GROWN_UP_MIN_AGE = 18;
export const GROWN_UP_MAX_AGE = 99;

// The browser's storage, or null when it is blocked (reading the property
// itself throws then). Every rule below treats null as "nothing saved", so the
// door still works, it just cannot remember anything.
export function deviceStorage() {
  try {
    return window.localStorage;
  } catch (e) {
    return null;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// FNV-1a, so the info and reset records can say which PIN they belong to
// without holding a second copy of it.
function pinTag(pin) {
  let h = 0x811c9dc5;
  for (let i = 0; i < pin.length; i++) {
    h ^= pin.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function readRecord(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (raw === null || raw === undefined) return null;
    const value = JSON.parse(raw);
    return isPlainObject(value) ? value : null;
  } catch (e) {
    return null;
  }
}

function writeRecord(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

function forget(storage, key) {
  try { storage.removeItem(key); } catch (e) { /* best effort */ }
}

export function isValidPin(value) {
  return typeof value === 'string' && /^\d{4}$/.test(value);
}

// Anything but four digits counts as no PIN, so a damaged value can never lock
// a grown-up out for good.
export function getPin(storage) {
  try {
    const value = storage.getItem(PIN_STORAGE_KEY);
    return isValidPin(value) ? value : null;
  } catch (e) {
    return null;
  }
}

export function hasPin(storage) {
  return getPin(storage) !== null;
}

export function pinMatches(storage, entered) {
  const pin = getPin(storage);
  return pin !== null && entered === pin;
}

// Saves a new PIN and starts it fresh: no waiting reset, no wrong tries.
// Returns true only when the PIN really stuck.
export function setPin(storage, pin, now) {
  if (!isValidPin(pin)) return false;
  try {
    storage.setItem(PIN_STORAGE_KEY, pin);
  } catch (e) {
    return false;
  }
  if (getPin(storage) !== pin) return false;
  writeRecord(storage, PIN_INFO_STORAGE_KEY, { madeAt: now, pin: pinTag(pin) });
  forget(storage, PIN_RESET_STORAGE_KEY);
  forget(storage, PIN_GUARD_STORAGE_KEY);
  return true;
}

// When the current PIN was made on this device, or null when that is unknown
// (made before this record existed, or brought over by Move to a New Device).
export function pinMadeAt(storage) {
  const pin = getPin(storage);
  const info = readRecord(storage, PIN_INFO_STORAGE_KEY);
  if (!pin || !info || info.pin !== pinTag(pin) || !Number.isFinite(info.madeAt)) return null;
  return info.madeAt;
}

// ---------------------------------------------------------------------------
// Grown-up check
// ---------------------------------------------------------------------------

// Birth year plus age has to land on this year, or last year for someone whose
// birthday has not come yet. Nothing is shown to add up, and a child who
// answers honestly, or makes up a pair, almost always misses.
export function isGrownUpAnswer(year, age, now) {
  const y = Number(year);
  const a = Number(age);
  if (!Number.isInteger(y) || !Number.isInteger(a)) return false;
  if (a < GROWN_UP_MIN_AGE || a > GROWN_UP_MAX_AGE) return false;
  const thisYear = new Date(now).getFullYear();
  return y + a === thisYear || y + a === thisYear - 1;
}

// ---------------------------------------------------------------------------
// One-day reset
// ---------------------------------------------------------------------------

// Returns { readyAt } or null. A reset that belongs to an older PIN (changed,
// imported or undone since) is dropped.
export function pendingReset(storage, now) {
  const record = readRecord(storage, PIN_RESET_STORAGE_KEY);
  if (!record) return null;
  const pin = getPin(storage);
  if (!pin || record.pin !== pinTag(pin) || !Number.isFinite(record.readyAt)) {
    forget(storage, PIN_RESET_STORAGE_KEY);
    return null;
  }
  // The clock went back since the reset started. Never wait more than a day.
  if (record.readyAt - now > RESET_DELAY_MS) {
    const readyAt = now + RESET_DELAY_MS;
    writeRecord(storage, PIN_RESET_STORAGE_KEY, { readyAt, pin: record.pin });
    return { readyAt };
  }
  return { readyAt: record.readyAt };
}

// Starts the one-day reset, or returns the one already waiting.
export function startReset(storage, now) {
  const pin = getPin(storage);
  if (!pin) return null;
  const waiting = pendingReset(storage, now);
  if (waiting) return waiting;
  const readyAt = now + RESET_DELAY_MS;
  if (!writeRecord(storage, PIN_RESET_STORAGE_KEY, { readyAt, pin: pinTag(pin) })) return null;
  return { readyAt };
}

// Returns true when there was a reset to cancel.
export function cancelReset(storage, now) {
  const waiting = pendingReset(storage, now);
  forget(storage, PIN_RESET_STORAGE_KEY);
  return !!waiting;
}

// Run when the Parent Dashboard door opens. Once a reset is due, the PIN comes
// off and the device is back to having none. Returns true when that happened.
export function settleReset(storage, now) {
  const waiting = pendingReset(storage, now);
  if (!waiting || now < waiting.readyAt) return false;
  try {
    storage.removeItem(PIN_STORAGE_KEY);
  } catch (e) {
    return false;
  }
  forget(storage, PIN_INFO_STORAGE_KEY);
  forget(storage, PIN_RESET_STORAGE_KEY);
  forget(storage, PIN_GUARD_STORAGE_KEY);
  return true;
}

// ---------------------------------------------------------------------------
// Wrong tries
// ---------------------------------------------------------------------------

// Milliseconds left in the pause, 0 when there is none.
export function pauseLeft(storage, now, key = PIN_GUARD_STORAGE_KEY) {
  const record = readRecord(storage, key);
  if (!record || !Number.isFinite(record.pausedUntil)) return 0;
  const left = record.pausedUntil - now;
  if (left <= 0) return 0;
  // The clock went back during a pause. Never wait more than one pause.
  if (left > PAUSE_MS) {
    writeRecord(storage, key, { fails: 0, pausedUntil: now + PAUSE_MS });
    return PAUSE_MS;
  }
  return left;
}

// Counts one wrong try. Every fifth one in a row starts a pause. Returns the
// pause left afterwards.
export function noteWrongTry(storage, now, key = PIN_GUARD_STORAGE_KEY) {
  const record = readRecord(storage, key) || {};
  const fails = (Number.isInteger(record.fails) && record.fails > 0 ? record.fails : 0) + 1;
  if (fails >= TRIES_BEFORE_PAUSE) {
    writeRecord(storage, key, { fails: 0, pausedUntil: now + PAUSE_MS });
    return PAUSE_MS;
  }
  writeRecord(storage, key, { fails });
  return 0;
}

export function clearTries(storage, key = PIN_GUARD_STORAGE_KEY) {
  forget(storage, key);
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

// "Thursday, September 24 at 4:10 PM". The date and the time each keep their
// words together (no-break spaces), so a wrapped line never splits them.
const NBSP = '\u00a0';

export function formatWhen(ms) {
  const d = new Date(ms);
  try {
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
    const day = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${weekday}, ${day.replace(/\s/g, NBSP)} at${NBSP}${time.replace(/\s/g, NBSP)}`;
  } catch (e) {
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
}

// "September 23, 2026"
export function formatDay(ms) {
  const d = new Date(ms);
  try {
    const day = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    return `${day.replace(/\s/g, NBSP)}, ${d.getFullYear()}`;
  } catch (e) {
    return d.toISOString().slice(0, 10);
  }
}

export function secondsLeft(ms) {
  return Math.max(1, Math.ceil(ms / 1000));
}
