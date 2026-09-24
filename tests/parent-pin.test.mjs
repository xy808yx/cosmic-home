import assert from 'node:assert/strict';
import test from 'node:test';

// The grown-up PIN rules, driven with a Map-backed storage. No browser save
// or real PIN is ever touched.
const pin = await import('../src/parentPin.js');
const {
  PIN_STORAGE_KEY, PIN_INFO_STORAGE_KEY, PIN_RESET_STORAGE_KEY, PIN_GUARD_STORAGE_KEY,
  DEV_MENU_GUARD_STORAGE_KEY, RESET_DELAY_MS, PAUSE_MS, TRIES_BEFORE_PAUSE,
  getPin, hasPin, pinMatches, setPin, pinMadeAt, isGrownUpAnswer,
  pendingReset, startReset, cancelReset, settleReset,
  pauseLeft, noteWrongTry, clearTries, formatWhen, formatDay,
} = pin;

const NOW = Date.parse('2026-09-23T19:41:07.000Z');
const HOUR = 60 * 60 * 1000;

function makeStorage(entries = {}, { failSet = false } = {}) {
  const map = new Map(Object.entries(entries));
  return {
    map,
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem(key, value) {
      if (failSet) throw new Error('QuotaExceededError');
      map.set(key, String(value));
    },
    removeItem: key => map.delete(key),
  };
}

test('there is no built-in PIN, and only four digits count as one', () => {
  assert.equal(hasPin(makeStorage()), false);
  assert.equal(pinMatches(makeStorage(), '8888'), false);
  for (const bad of ['', '123', '12345', '12a4', ' 1234']) {
    assert.equal(getPin(makeStorage({ [PIN_STORAGE_KEY]: bad })), null, bad);
  }
  const store = makeStorage({ [PIN_STORAGE_KEY]: '0420' });
  assert.equal(getPin(store), '0420');
  assert.equal(pinMatches(store, '0420'), true);
  assert.equal(pinMatches(store, '8888'), false);
});

test('setting a PIN records its date, clears a waiting reset and wrong tries', () => {
  const store = makeStorage();
  assert.equal(setPin(store, '2468', NOW), true);
  assert.equal(pinMadeAt(store), NOW);
  startReset(store, NOW);
  noteWrongTry(store, NOW);
  assert.equal(setPin(store, '1357', NOW + HOUR), true);
  assert.equal(getPin(store), '1357');
  assert.equal(pinMadeAt(store), NOW + HOUR);
  assert.equal(store.getItem(PIN_RESET_STORAGE_KEY), null);
  assert.equal(store.getItem(PIN_GUARD_STORAGE_KEY), null);
  // The record never holds the PIN itself.
  assert.ok(!store.getItem(PIN_INFO_STORAGE_KEY).includes('1357'));

  // A PIN brought over by Move to a New Device has no known date here.
  store.setItem(PIN_STORAGE_KEY, '9753');
  assert.equal(pinMadeAt(store), null);

  assert.equal(setPin(store, '12a4', NOW), false);
  assert.equal(setPin(makeStorage({}, { failSet: true }), '1234', NOW), false);
});

test('the grown-up check: birth year plus age must land on this year or last', () => {
  assert.equal(isGrownUpAnswer('1988', '38', NOW), true);
  assert.equal(isGrownUpAnswer('1988', '37', NOW), true); // birthday still to come
  assert.equal(isGrownUpAnswer('1988', '39', NOW), false);
  assert.equal(isGrownUpAnswer('2008', '18', NOW), true);
  assert.equal(isGrownUpAnswer('2009', '17', NOW), false);
  assert.equal(isGrownUpAnswer('1927', '99', NOW), true);
  assert.equal(isGrownUpAnswer('1990', '40', NOW), false);
  assert.equal(isGrownUpAnswer('19a8', '38', NOW), false);

  // Every honest answer from a child of 5 to 17 fails.
  const thisYear = new Date(NOW).getFullYear();
  for (let age = 5; age <= 17; age++) {
    for (const born of [thisYear - age, thisYear - age - 1]) {
      assert.equal(isGrownUpAnswer(String(born), String(age).padStart(2, '0'), NOW), false, `${born} ${age}`);
    }
  }

  // A made-up pair almost never lands: about 2 in 100 of every possible pair.
  let pass = 0;
  let total = 0;
  for (let year = 1900; year <= thisYear; year++) {
    for (let age = 0; age <= 99; age++) {
      total++;
      if (isGrownUpAnswer(String(year), String(age), NOW)) pass++;
    }
  }
  assert.ok(pass / total < 0.02, `${pass}/${total}`);
});

test('a forgotten PIN comes off a day after the reset starts, not before', () => {
  const store = makeStorage();
  setPin(store, '2468', NOW - HOUR);
  assert.equal(startReset(makeStorage(), NOW), null); // no PIN, nothing to reset
  assert.deepEqual(startReset(store, NOW), { readyAt: NOW + RESET_DELAY_MS });
  // Asking again does not push the day back.
  assert.deepEqual(startReset(store, NOW + HOUR), { readyAt: NOW + RESET_DELAY_MS });

  assert.equal(settleReset(store, NOW + RESET_DELAY_MS - 1), false);
  assert.equal(getPin(store), '2468');
  assert.equal(settleReset(store, NOW + RESET_DELAY_MS), true);
  assert.equal(hasPin(store), false);
  for (const key of [PIN_INFO_STORAGE_KEY, PIN_RESET_STORAGE_KEY, PIN_GUARD_STORAGE_KEY]) {
    assert.equal(store.getItem(key), null, key);
  }
  assert.equal(settleReset(store, NOW + 2 * RESET_DELAY_MS), false);
});

test('typing the real PIN cancels a reset, and a changed PIN drops it', () => {
  const store = makeStorage();
  setPin(store, '2468', NOW);
  startReset(store, NOW);
  assert.equal(cancelReset(store, NOW + HOUR), true);
  assert.equal(cancelReset(store, NOW + HOUR), false);
  assert.equal(settleReset(store, NOW + 2 * RESET_DELAY_MS), false);
  assert.equal(getPin(store), '2468');

  // Move to a New Device brought a different PIN: the old reset is not for it.
  startReset(store, NOW);
  store.setItem(PIN_STORAGE_KEY, '1111');
  assert.equal(pendingReset(store, NOW), null);
  assert.equal(store.getItem(PIN_RESET_STORAGE_KEY), null);
  assert.equal(settleReset(store, NOW + 2 * RESET_DELAY_MS), false);
  assert.equal(getPin(store), '1111');
});

test('a clock set back during a reset never makes it wait more than a day', () => {
  const store = makeStorage();
  setPin(store, '2468', NOW);
  startReset(store, NOW);
  const back = NOW - 30 * 24 * HOUR;
  assert.deepEqual(pendingReset(store, back), { readyAt: back + RESET_DELAY_MS });
  assert.equal(settleReset(store, back + RESET_DELAY_MS), true);
});

test('five wrong tries in a row start a 30 second pause', () => {
  const store = makeStorage();
  for (let i = 1; i < TRIES_BEFORE_PAUSE; i++) assert.equal(noteWrongTry(store, NOW), 0);
  assert.equal(pauseLeft(store, NOW), 0);
  assert.equal(noteWrongTry(store, NOW), PAUSE_MS);
  assert.equal(pauseLeft(store, NOW + 10_000), PAUSE_MS - 10_000);
  assert.equal(pauseLeft(store, NOW + PAUSE_MS), 0);
  // The count starts over after a pause.
  assert.equal(noteWrongTry(store, NOW + PAUSE_MS), 0);
  clearTries(store);
  assert.equal(store.getItem(PIN_GUARD_STORAGE_KEY), null);

  // A clock set back mid-pause never waits more than one pause.
  for (let i = 0; i < TRIES_BEFORE_PAUSE; i++) noteWrongTry(store, NOW);
  assert.equal(pauseLeft(store, NOW - HOUR), PAUSE_MS);

  // The dev menu keeps its own count.
  const dev = makeStorage();
  for (let i = 0; i < TRIES_BEFORE_PAUSE; i++) noteWrongTry(dev, NOW, DEV_MENU_GUARD_STORAGE_KEY);
  assert.equal(pauseLeft(dev, NOW, DEV_MENU_GUARD_STORAGE_KEY), PAUSE_MS);
  assert.equal(pauseLeft(dev, NOW), 0);
});

test('dates read the way the screens say them', () => {
  const when = formatWhen(NOW + RESET_DELAY_MS);
  // No-break spaces keep "September 24" and "at 4:10 PM" whole when wrapped.
  assert.match(when, /^[A-Z][a-z]+day, [A-Z][a-z]+\u00a0\d{1,2} at\u00a0\d{1,2}:\d{2}\u00a0[AP]M$/);
  assert.match(formatDay(NOW), /^[A-Z][a-z]+\u00a0\d{1,2}, 2026$/);
});
