// "Move to a New Device" screen. A plain HTML sheet laid over the game canvas,
// opened from the Parent Dashboard's Settings tab.
//
// Why HTML and not Phaser buttons: game buttons fire on finger-down, and iPadOS
// only lets a finger-lift (a real click) open the Share sheet or the Files
// picker. Real <button> and <label> elements get that for free.
//
// Why input is switched off underneath: Phaser listens for touches on the whole
// window, so without it a tap on this sheet would also press whatever game
// button sits under the finger (Reset All Progress is on the same tab).

import { SPECIES } from './CompanionManager.js';
import { getActiveWorlds } from './GameData.js';
import { COLORS } from './colorPalette.js';
import {
  applyTransfer,
  buildTransferCode,
  carriesPin,
  describeSave,
  hasMoreProgress,
  MAX_TRANSFER_CHARS,
  parseTransferCode,
  readBackup,
  sameSaves,
  TRANSFER_MESSAGES,
  undoLastImport,
} from './saveTransfer.js';

const STYLE_ID = 'cht-styles';
const OPEN_GUARD_MS = 300;
const BLOCKED_EVENTS = [
  'touchstart', 'touchend', 'touchcancel', 'mousedown', 'pointerdown', 'wheel', 'keydown', 'keyup',
];

const hex = color => `#${color.toString(16).padStart(6, '0')}`;
const TEAL = hex(COLORS.accentTeal);
const GOLD = hex(COLORS.accentWarm);
const RED = hex(COLORS.error);
const GREEN = hex(COLORS.success);
const CAUTION = hex(COLORS.warning);
const PANEL = hex(COLORS.bgPanel);
const TRACK = hex(COLORS.bgTrack);
const INK = '#0a0a1a';
const SOFT = '#cfcfe0';
const QUIET_EDGE = '#8888a0';
const DISPLAY_FONT = '"Cosmic Lilita", "Arial Rounded MT Bold", sans-serif';
const BODY_FONT = '"Cosmic Fredoka", "Arial Rounded MT Bold", system-ui, sans-serif';

// Three type sizes only: title 30, body 20, fine print 17 (16+ keeps iOS from
// zooming into the text box).
// Summary cards sit side by side only when each can be 310px wide: the longest
// row ("Furthest world" + "The Singularity Cell") needs about 309px.
const CSS = `
.cht-root{position:fixed;left:0;right:0;top:0;height:100%;z-index:1000;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));background:rgba(7,7,26,0.92);outline:none;-webkit-text-size-adjust:100%;text-size-adjust:100%;font-family:${BODY_FONT};color:#fff}
.cht-root *{box-sizing:border-box}
.cht-root [hidden]{display:none !important}
.cht-panel{position:relative;width:min(720px,100%);max-height:100%;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;background:${PANEL};border:3px solid ${TEAL};border-radius:22px;padding:24px;outline:none}
.cht-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 20px}
.cht-title{font-family:${DISPLAY_FONT};font-weight:400;font-size:30px;line-height:1.15;color:${GOLD};margin:0}
.cht-h{font-size:20px;font-weight:600;line-height:1.3;color:${GOLD};margin:0 0 12px;outline:none}
.cht-p{font-size:20px;font-weight:500;line-height:1.4;margin:0 0 16px;color:#fff}
.cht-fine{font-size:17px;font-weight:500;line-height:1.4;margin:0 0 16px;color:${SOFT}}
.cht-btn{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:100%;min-height:56px;margin:0 0 12px;padding:12px 16px;border:0;border-radius:16px;font-family:${BODY_FONT};font-size:20px;font-weight:600;line-height:1.25;text-align:center;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
.cht-btn:focus-visible{outline:3px solid ${GOLD};outline-offset:3px}
label.cht-btn:has(.cht-file:focus-visible){outline:3px solid ${GOLD};outline-offset:3px}
.cht-btn:disabled{opacity:0.5;cursor:default}
.cht-primary{background:${TEAL};color:${INK}}
.cht-danger{background:${RED};color:${INK}}
.cht-quiet{background:transparent;color:#fff;border:2px solid ${QUIET_EDGE}}
.cht-sub{font-size:17px;font-weight:500}
.cht-close{width:auto;min-width:96px;margin:0;flex:none}
.cht-file{position:absolute;left:0;top:0;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none}
.cht-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:12px;margin:0 0 16px}
.cht-card{background:${TRACK};border:2px solid #2a2a48;border-radius:16px;padding:14px;margin:0 0 16px}
.cht-cards .cht-card{margin:0}
.cht-card-title{font-size:17px;font-weight:600;color:${GOLD};margin:0 0 8px}
.cht-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:17px;line-height:1.5;color:${SOFT}}
.cht-row b{color:#fff;font-weight:600;text-align:right}
.cht-warn{font-size:17px;font-weight:500;line-height:1.4;color:#fff;margin:0 0 16px;padding:10px 14px;border-left:4px solid ${CAUTION};border-radius:8px;background:rgba(247,220,111,0.08)}
.cht-status{font-size:17px;font-weight:500;line-height:1.4;min-height:1.4em;margin:0 0 16px;color:${SOFT}}
.cht-status:empty{min-height:0;margin:0}
.cht-status.cht-bad{color:${RED}}
.cht-status.cht-good{color:${GREEN}}
.cht-text{display:block;width:100%;min-height:132px;margin:0 0 16px;padding:12px;border:2px solid ${QUIET_EDGE};border-radius:12px;background:#0d0d20;color:#fff;font-family:${BODY_FONT};font-size:17px;line-height:1.4;resize:none;-webkit-user-select:text;user-select:text;touch-action:pan-y}
.cht-text:focus{outline:3px solid ${GOLD};outline-offset:2px}
.cht-rule{border:0;border-top:2px solid #2a2a48;margin:8px 0 20px}
@media (max-width: 480px){.cht-panel{padding:18px}}
@media (prefers-reduced-motion: no-preference){.cht-panel{animation:cht-in 150ms ease-out}@keyframes cht-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}}
`;

let current = null;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

// Small element builder. All text goes in through textContent, never markup.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function button(label, kind, sub) {
  const b = el('button', `cht-btn cht-${kind}`);
  b.type = 'button';
  b.appendChild(el('span', null, label));
  if (sub) b.appendChild(el('span', 'cht-sub', sub));
  return b;
}

function isStandalone() {
  try {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
  } catch (e) { /* older engines */ }
  return window.navigator.standalone === true;
}

function formatDate(ms) {
  if (!Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch (e) {
    return new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
  }
}

function summaryCard(title, summary, extraLine) {
  const card = el('div', 'cht-card');
  card.appendChild(el('p', 'cht-card-title', title));
  if (extraLine) card.appendChild(el('p', 'cht-fine', extraLine));
  if (summary.isEmpty) {
    card.appendChild(el('p', 'cht-p', 'No progress yet'));
    return card;
  }
  const rows = [
    ['Pet', summary.petName || 'No pet yet'],
    ['Stars', summary.stars.toLocaleString()],
    ['Worlds cleared', String(summary.worldsCleared)],
    ['Furthest world', summary.furthestWorld || 'None yet'],
    ['Facts practiced', `${summary.factsPracticed} of ${summary.factsTotal}`],
  ];
  for (const [label, value] of rows) {
    const row = el('div', 'cht-row');
    row.appendChild(el('span', null, label));
    row.appendChild(el('b', null, value));
    card.appendChild(row);
  }
  return card;
}

export function openTransferSheet(scene, {
  storage = window.localStorage,
  reload = () => window.location.reload(),
} = {}) {
  if (current) return current;

  ensureStyles();
  const catalog = { worlds: getActiveWorlds(), species: SPECIES };
  let guardUntil = performance.now() + OPEN_GUARD_MS;
  const gameContainer = document.getElementById('game-container');
  const previousFocus = document.activeElement;
  const previousInput = scene.input ? scene.input.enabled : undefined;
  let busy = false;
  let closed = false;
  let pasteTimer = null;

  const root = el('div', 'cht-root');
  root.setAttribute('role', 'dialog');
  // Focusable so a tap on the dimmed backdrop keeps focus inside the sheet
  // (Escape and the Tab trap only see keys that start inside it).
  root.tabIndex = -1;
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'cht-title');
  const panel = el('div', 'cht-panel');
  panel.tabIndex = -1;
  const top = el('div', 'cht-top');
  const title = el('h2', 'cht-title', 'Move to a New Device');
  title.id = 'cht-title';
  const closeBtn = button('Close', 'quiet');
  closeBtn.classList.add('cht-close');
  top.append(title, closeBtn);
  const body = el('div');
  panel.append(top, body);
  root.appendChild(panel);

  // Keep every touch, click and key that starts on the sheet away from
  // Phaser's window-level listeners. Mouseup is let through so a desktop click
  // that opened the sheet still releases Phaser's pointer.
  const stop = event => event.stopPropagation();
  for (const type of BLOCKED_EVENTS) root.addEventListener(type, stop);

  // Clicks in the first moment after opening, or after any view change, are
  // ignored, so a double tap can never land on a button that just appeared
  // under the finger (for example "Put it back" after "Undo the last import").
  // The tap that changes the view is not affected: this check runs first.
  root.addEventListener('click', event => {
    if (performance.now() < guardUntil) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !busy) {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      trapTab(event);
    }
  });

  function trapTab(event) {
    const focusables = [...panel.querySelectorAll('button, textarea, input, [tabindex="0"]')]
      .filter(node => !node.disabled && node.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel || document.activeElement === root)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // Shrink the sheet to the part of the screen the on-screen keyboard leaves.
  const vv = window.visualViewport;
  function fitViewport() {
    if (!vv) return;
    root.style.height = `${vv.height}px`;
    root.style.top = `${vv.offsetTop}px`;
  }
  if (vv) {
    vv.addEventListener('resize', fitViewport);
    vv.addEventListener('scroll', fitViewport);
  }

  closeBtn.addEventListener('click', () => { if (!busy) close(); });

  function setBusy(on) {
    busy = on;
    for (const node of panel.querySelectorAll('button, textarea, input')) node.disabled = on;
  }

  function status(node, text, tone) {
    node.textContent = text || '';
    node.classList.toggle('cht-bad', tone === 'bad');
    node.classList.toggle('cht-good', tone === 'good');
  }

  function statusLine() {
    const node = el('p', 'cht-status');
    node.setAttribute('aria-live', 'polite');
    return node;
  }

  function showView(build) {
    guardUntil = performance.now() + OPEN_GUARD_MS;
    clearTimeout(pasteTimer);
    body.replaceChildren();
    const heading = build();
    panel.scrollTop = 0;
    if (heading) heading.focus({ preventScroll: true });
  }

  function heading(text) {
    const h = el('h3', 'cht-h', text);
    h.tabIndex = -1;
    body.appendChild(h);
    return h;
  }

  function hereSummary() {
    return describeSave(storage.getItem('cosmicMathProgress'), catalog);
  }

  // Runs a storage change, then restarts the game so every manager reloads
  // from the new values. The game loop is paused first so nothing can save
  // the old in-memory state over the new one.
  function commit(statusNode, action) {
    setBusy(true);
    status(statusNode, 'Moving progress. Cosmic Home will restart.', 'good');
    const loop = scene.game && scene.game.loop;
    if (loop && typeof loop.sleep === 'function') loop.sleep();
    try {
      if (navigator.storage && typeof navigator.storage.persist === 'function') {
        navigator.storage.persist().catch(() => {});
      }
    } catch (e) { /* optional */ }
    setTimeout(() => {
      let result;
      try {
        result = action();
      } catch (e) {
        result = { ok: false, message: TRANSFER_MESSAGES.storageFailed };
      }
      if (result.ok) {
        reload();
        return;
      }
      if (loop && typeof loop.wake === 'function') loop.wake();
      setBusy(false);
      // Disabling the focused button dropped focus to the page; bring it back.
      if (!root.contains(document.activeElement)) panel.focus({ preventScroll: true });
      status(statusNode, result.message, 'bad');
    }, 50);
  }

  // ----- Home -----------------------------------------------------------
  function homeView() {
    const h = heading('Two steps, once for each device');
    body.appendChild(el('p', 'cht-p', 'Bring your child\'s pet, stars, and worlds to a new device.'));
    body.appendChild(el('p', 'cht-fine',
      'The Home Screen icon and Safari keep separate progress. On both devices, open the game the same way your child plays it.'));
    body.appendChild(el('p', 'cht-fine',
      `Right now you are in: ${isStandalone() ? 'the Home Screen app' : 'a browser tab'}.`));

    const send = button('Send this device\'s progress', 'primary', 'On the old device');
    send.addEventListener('click', () => showView(sendView));
    const receive = button('Receive progress', 'primary', 'On the new device');
    receive.addEventListener('click', () => showView(receiveView));
    body.append(send, receive);

    const backup = readBackup(storage);
    if (backup) {
      const when = formatDate(backup.savedAt);
      const undo = button('Undo the last import', 'quiet', when ? `From ${when}` : null);
      undo.addEventListener('click', () => showView(undoView));
      body.appendChild(undo);
    }
    return h;
  }

  // ----- Send -----------------------------------------------------------
  function sendView() {
    const h = heading('Send this device\'s progress');
    let transfer;
    try {
      transfer = buildTransferCode(storage, { now: Date.now(), catalog });
    } catch (e) {
      body.appendChild(el('p', 'cht-p', 'This device\'s progress could not be read.'));
      body.appendChild(backButton());
      return h;
    }
    body.appendChild(summaryCard('On this device', transfer.summary));

    if (transfer.summary.isEmpty) {
      body.appendChild(el('p', 'cht-warn',
        isStandalone()
          ? 'There is no progress here to send. If your child plays in Safari, close this and open the game in Safari.'
          : 'There is no progress here to send. If your child plays from a Home Screen icon, close this and open the game from that icon.'));
      body.appendChild(backButton());
      return h;
    }

    const file = makeFile(transfer);
    const canShareFile = !!(file && navigator.share && navigator.canShare && safeCanShare(file));
    const line = statusLine();
    const box = el('textarea', 'cht-text');
    box.readOnly = true;
    box.value = transfer.text;
    box.setAttribute('aria-label', 'Save code');
    box.hidden = true;

    const copy = button(canShareFile ? 'Copy as text instead' : 'Copy the save code', canShareFile ? 'quiet' : 'primary');
    copy.addEventListener('click', () => copyCode(box, line, transfer.text));

    if (canShareFile) {
      const share = button('Share the save file', 'primary');
      share.addEventListener('click', () => shareFile(file, box, line));
      body.appendChild(share);
      body.appendChild(el('p', 'cht-fine',
        'Pick AirDrop and choose the new device. You can also save it to Files or send it to yourself in Messages. Keep a copy until the move is done.'));
      body.appendChild(copy);
    } else {
      body.appendChild(el('p', 'cht-fine',
        'This device cannot share a file from here. Copy the code, paste it into Messages or Notes, and send it to yourself or to the new device.'));
      body.appendChild(copy);
      box.hidden = false;
    }
    body.append(line, box);
    body.appendChild(el('p', 'cht-fine', 'Nothing on this device changes.'));
    body.appendChild(backButton());
    return h;
  }

  function makeFile(transfer) {
    try {
      return new File([transfer.text], transfer.fileName, { type: 'text/plain' });
    } catch (e) {
      return null;
    }
  }

  function safeCanShare(file) {
    try {
      return navigator.canShare({ files: [file] });
    } catch (e) {
      return false;
    }
  }

  // Called straight from the click, with nothing awaited first, so the device
  // still counts it as a tap. The screen never waits on the promise.
  function shareFile(file, box, line) {
    let request;
    try {
      request = navigator.share({ files: [file] });
    } catch (e) {
      showCopyFallback(box, line);
      return;
    }
    status(line, 'Opening the share sheet.');
    Promise.resolve(request).then(() => {
      status(line, 'Done. On the new device, open Cosmic Home and pick any pet if it asks. Tap the gear and make a grown-up PIN if it asks, then go to Settings, Move to a New Device, Receive progress. After the move, the grown-up PIN is the same as on this device.', 'good');
    }, err => {
      const name = err && err.name;
      if (name === 'AbortError') {
        status(line, 'The share sheet closed. If the file did not go through, tap Share the save file again.');
      } else if (name === 'NotAllowedError') {
        status(line, 'This device did not allow that tap. Tap Share the save file again.', 'bad');
      } else if (name === 'InvalidStateError') {
        status(line, 'The share sheet is already open.');
      } else {
        showCopyFallback(box, line);
      }
    });
  }

  function showCopyFallback(box, line) {
    box.hidden = false;
    status(line, 'Sharing did not work here. Use Copy as text instead.', 'bad');
  }

  function selectAll(box) {
    box.hidden = false;
    try {
      box.focus({ preventScroll: true });
      box.setSelectionRange(0, box.value.length);
    } catch (e) { /* selection is a convenience */ }
  }

  function copyCode(box, line, text) {
    box.hidden = false;
    let request = null;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        request = navigator.clipboard.writeText(text);
      }
    } catch (e) {
      request = null;
    }
    const manual = () => {
      selectAll(box);
      status(line, 'Tap and hold the text, then tap Select All and Copy.');
    };
    if (!request) {
      manual();
      return;
    }
    Promise.resolve(request).then(() => {
      status(line, 'Copied. Paste it into Messages or Notes and send it to yourself or to the new device.', 'good');
    }, manual);
  }

  // ----- Receive --------------------------------------------------------
  function receiveView() {
    const h = heading('Receive progress');
    body.appendChild(el('p', 'cht-fine',
      'Do this the same way your child will open the game: from the Home Screen icon if they use one, or in Safari if not. The icon and Safari keep separate progress.'));
    if (!isStandalone()) {
      body.appendChild(el('p', 'cht-warn',
        'You are in a browser tab. If your child plays from a Home Screen icon, add the icon first and do this inside it.'));
    }

    const line = statusLine();

    // A real label wrapped round a rendered (but invisible) file input: the
    // tap on the label is a genuine tap, so the Files picker is allowed to open.
    // A fresh input each time this view opens avoids stuck pickers.
    const pick = el('label', 'cht-btn cht-primary');
    pick.appendChild(el('span', null, 'Choose the save file'));
    const input = el('input', 'cht-file');
    input.type = 'file';
    input.accept = '.txt,text/plain';
    pick.appendChild(input);
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (file) readFile(file, line);
    });
    body.appendChild(pick);
    body.appendChild(el('p', 'cht-fine', 'The file is usually in Recents, or in the Downloads folder.'));

    body.appendChild(el('hr', 'cht-rule'));
    body.appendChild(el('p', 'cht-fine', 'Or paste the save code:'));
    const box = el('textarea', 'cht-text');
    box.placeholder = 'Tap and hold here, then tap Paste.';
    box.setAttribute('aria-label', 'Save code');
    box.setAttribute('autocomplete', 'off');
    box.setAttribute('autocorrect', 'off');
    box.setAttribute('autocapitalize', 'off');
    box.spellcheck = false;
    box.addEventListener('input', () => {
      clearTimeout(pasteTimer);
      pasteTimer = setTimeout(() => {
        if (!box.value.trim()) {
          status(line, '');
          return;
        }
        handleCode(box.value, line, box);
      }, 150);
    });
    body.append(box, line);
    body.appendChild(backButton());
    return h;
  }

  function readFile(file, line) {
    if (file.size > MAX_TRANSFER_CHARS) {
      status(line, TRANSFER_MESSAGES.tooBig, 'bad');
      return;
    }
    status(line, 'Reading the file.');
    const onText = text => handleCode(text, line, null);
    const onError = () => status(line, 'That file could not be opened. Save it to Files first, then choose it again.', 'bad');
    if (typeof file.text === 'function') {
      file.text().then(onText, onError);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onText(String(reader.result || ''));
    reader.onerror = onError;
    reader.readAsText(file);
  }

  function handleCode(text, line, box) {
    if (closed) return;
    const parsed = parseTransferCode(text);
    if (!parsed.ok) {
      status(line, parsed.message, 'bad');
      return;
    }
    const fileSummary = describeSave(parsed.keys.cosmicMathProgress, catalog);
    if (!fileSummary.readable || fileSummary.unknownPet) {
      status(line, TRANSFER_MESSAGES.damaged, 'bad');
      return;
    }
    if (box) {
      box.blur();
      window.scrollTo(0, 0);
    }
    showView(() => compareView(parsed, fileSummary));
  }

  // ----- Compare --------------------------------------------------------
  function compareView(parsed, fileSummary) {
    const h = heading('Check before replacing');
    const here = hereSummary();
    const when = formatDate(parsed.exportedAt);
    const cards = el('div', 'cht-cards');
    cards.append(
      summaryCard('From the file', fileSummary, when ? `Saved: ${when}` : null),
      summaryCard('On this device now', here),
    );
    body.appendChild(cards);

    if (fileSummary.isEmpty) {
      body.appendChild(el('p', 'cht-warn',
        'This file has no progress in it: no stars and no facts practiced. On the old device, open the game the way your child plays it, then send it again.'));
      body.appendChild(backButton('Back', () => showView(receiveView)));
      return h;
    }
    if (sameSaves(parsed.keys, storage)) {
      body.appendChild(el('p', 'cht-warn', 'This device already has exactly this progress. There is nothing to move.'));
      body.appendChild(backButton('Back', () => showView(receiveView)));
      return h;
    }

    if (!here.isEmpty && hasMoreProgress(here, fileSummary)) {
      body.appendChild(el('p', 'cht-warn',
        'This device has more progress than the file. Replacing it will remove that progress.'));
    }
    if (!here.isEmpty && here.speciesId && fileSummary.speciesId && here.speciesId !== fileSummary.speciesId) {
      body.appendChild(el('p', 'cht-warn',
        'The pet in the file is not the pet on this device. Make sure this is the right child\'s file.'));
    }
    body.appendChild(el('p', 'cht-fine',
      `This erases the progress on this device and puts the file's progress in its place. ${carriesPin(parsed.keys)
        ? 'The grown-up PIN becomes the one from the old device.'
        : 'This device keeps its grown-up PIN.'} You can undo this later from this screen.`));

    const line = statusLine();
    const replace = button('Replace this device\'s progress', 'danger');
    replace.addEventListener('click', () => commit(line, () => applyTransfer(storage, parsed.keys)));
    const cancel = button('Cancel', 'quiet');
    cancel.addEventListener('click', () => showView(receiveView));
    body.append(replace, line, cancel);
    return h;
  }

  // ----- Undo -----------------------------------------------------------
  function undoView() {
    const h = heading('Undo the last import');
    const backup = readBackup(storage);
    if (!backup) {
      body.appendChild(el('p', 'cht-p', TRANSFER_MESSAGES.noBackup));
      body.appendChild(backButton());
      return h;
    }
    const when = formatDate(backup.savedAt);
    const before = describeSave(
      Object.prototype.hasOwnProperty.call(backup.keys, 'cosmicMathProgress') ? backup.keys.cosmicMathProgress : null,
      catalog,
    );
    const cards = el('div', 'cht-cards');
    cards.append(
      summaryCard('Before the import', before, when ? `From ${when}` : null),
      summaryCard('On this device now', hereSummary()),
    );
    body.appendChild(cards);
    body.appendChild(el('p', 'cht-fine',
      `This puts back what this device had before the import${when ? ` on ${when}` : ''}. Anything played since then is lost. ${carriesPin(backup.keys)
        ? 'The grown-up PIN goes back to what it was before the import.'
        : 'The grown-up PIN stays as it is.'}`));
    const line = statusLine();
    const restore = button('Put it back', 'danger');
    restore.addEventListener('click', () => commit(line, () => undoLastImport(storage)));
    const cancel = button('Cancel', 'quiet');
    cancel.addEventListener('click', () => showView(homeView));
    body.append(restore, line, cancel);
    return h;
  }

  function backButton(label = 'Back', onClick = () => showView(homeView)) {
    const b = button(label, 'quiet');
    b.addEventListener('click', onClick);
    return b;
  }

  // ----- Open / close ---------------------------------------------------
  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(pasteTimer);
    if (vv) {
      vv.removeEventListener('resize', fitViewport);
      vv.removeEventListener('scroll', fitViewport);
    }
    root.remove();
    if (gameContainer) gameContainer.removeAttribute('aria-hidden');
    if (scene.input && previousInput !== undefined) scene.input.enabled = previousInput;
    if (scene.events) {
      scene.events.off('shutdown', close);
      scene.events.off('destroy', close);
    }
    window.scrollTo(0, 0);
    if (previousFocus && typeof previousFocus.focus === 'function') {
      try { previousFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
    current = null;
  }

  if (scene.input) scene.input.enabled = false;
  if (scene.events) {
    scene.events.once('shutdown', close);
    scene.events.once('destroy', close);
  }
  if (gameContainer) gameContainer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(root);
  fitViewport();
  showView(homeView);

  current = { close };
  return current;
}
