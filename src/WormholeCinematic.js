// Wormhole travel cinematic — "The Ring-Tunnel Dive".
//
// A self-contained ~3.4s full-screen sequence that plays every time the player
// crosses the chapter wormhole, replacing the old flat fade-to-black. The
// wormhole is a RECEDING RING TUNNEL (nested squashed ellipse outlines streaming
// past a bright breathing lens core) with hyperspace STREAKS, the kid's real
// SHIP + PET as the hero, and a climax SHOCKWAVE — never a spiral, swirl, swept
// arc, or ray-burst (per the project's no-spiral / no-sigil art policy).
//
//   playWormholeCinematic(scene, 'in',  onDone): Ch1 to Ch2, the ship dives
//       INWARD, big to swallowed by the core; cold cosmic (indigo/teal/gold)
//       morphs to warm living (violet/rose); ends on a low heartbeat thump.
//   playWormholeCinematic(scene, 'out', onDone): Ch2 to Ch1, the ship BURSTS
//       OUTWARD from the core toward the viewer, small to large; warm morphs back
//       to cold; ends on a bright chime.
//   playWormholeCinematic(scene, 'out', onDone, { palette: 'homecoming' }):
//       Ch2 to Ch3 (Home Ground), the same outward burst recoloured as a morning:
//       the body's warm end surfaces into pale blue, cream and soft warm yellow,
//       because the dive lands on a Saturday morning at the grocery store.
//       Leaving Ch3 back toward the body plays the default 'in' bridge.
//
// Every route shows the SAME ship+pet (their customization) as the clear hero,
// driven by the single master clock so it can never desync from the visuals.
//
// Handoff contract: onDone() (setCurrentChapter + scene.restart) is invoked
// while the screen is held opaque at 0x0a0a1a — the exact colour the rebuilt
// map's TransitionManager.fadeIn() starts from — so the swap is seamless.

import Phaser from 'phaser';
import { audio } from './AudioManager.js';
import { drawShip } from './ShipRenderer.js';
import { ship } from './ShipManager.js';
import { companion, drawCompanion } from './CompanionManager.js';
import { style } from './textStyles.js';
import { lerpHex } from './colorUtils.js';

const W = 1080;
const H = 1920;
const CX = 540;
const CY = 760;            // core sits in the upper visual third (room for ship)
const TAU = Math.PI * 2;
const SQUASH = 0.82;       // ellipse foreshortening shared by every radial layer

// Hyperspace streak field geometry: REACH = rim radius, CURVE = depth-spacing
// exponent (matched to the ring tunnel's feel).
const STREAK_REACH = 760;
const STREAK_CURVE = 1.6;
// Ship travel anchors (canvas-space Y): IN starts just off the bottom and dives
// up into the core; OUT rests in the lower third after bursting out toward us.
const SHIP_DIVE_START_Y = 1470;
const SHIP_SURFACE_REST_Y = 1250;
const SHOCK_MAX_R = 1500;  // shockwave rings expand to here at the climax

// Canonical cold → warm bridge gradient. Teal (0x4ecdc4) is the deliberate
// centre pivot: the one hue living in BOTH the cosmic and the body palettes, so
// the eye never sees a hard seam.
const GRAD_COSMIC = [0x4a4a8c, 0x6e7bd6, 0x4ecdc4, 0xfff3b8, 0xc77eff, 0xff7a8a];
// Chapter 3 "homecoming" (Ch2 to Ch3, Home Ground): a MORNING bridge. Index 0 is
// the arrival end (the 'out' dive runs this gradient from the last stop back to
// the first): pale morning blue, then cream, then a soft warm yellow, with the
// same teal pivot at the far end so surfacing out of the body reads as "coming
// up into the light" of a Saturday morning at the store (still the vetted ring
// tunnel, no spiral).
const GRAD_HOMECOMING = [0x9fd6ff, 0xbfe6ff, 0xfff8e7, 0xffe9a8, 0xffd66b, 0x4ecdc4];

// Gradient sample over `grad` (allocation-free; called every frame).
function sampleGrad(grad, p) {
  const c = p < 0 ? 0 : p > 1 ? 1 : p;
  const n = grad.length - 1;
  const x = c * n;
  const i = Math.min(n - 1, Math.floor(x));
  return lerpHex(grad[i], grad[i + 1], x - i);
}

export function playWormholeCinematic(scene, direction, onDone, opts = {}) {
  const dirIn = direction !== 'out';
  const CLOCK_MS = 3400;

  // Palette: 'homecoming' (entering Home Ground) recolors the whole dive as a
  // morning; otherwise the default cosmic/body bridge. Structure is identical,
  // only the colours change.
  const homecoming = opts.palette === 'homecoming';
  const GRAD = homecoming ? GRAD_HOMECOMING : GRAD_COSMIC;

  const root = scene.add.container(0, 0).setDepth(2000).setScrollFactor(0);

  // --- BACKDROP (normal blend, opaque from frame 0 so the live map is hidden) ---
  // COLD_BG/WARM_BG are the two ends of the bg morph. COLD_BG is the outer end:
  // deep space by default, or a mid morning blue for the homecoming (the dive
  // surfaces from the body's warm maroon up into the morning; kept mid-tone so
  // the additive rings and streaks still read on top of it). COVER_BG is the
  // handoff colour, ALWAYS 0x0a0a1a so the rebuilt map's fadeIn (which starts
  // there) is seamless.
  const COLD_BG = homecoming ? 0x2f5a80 : 0x0a0a1a;
  const WARM_BG = 0x2a0a14;
  const COVER_BG = 0x0a0a1a;
  const backdrop = scene.add.graphics();
  root.add(backdrop);

  // --- RING TUNNEL (the hero structure) ---
  const tunnel = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  root.add(tunnel);
  const RINGS = 14;
  const ringWob = [];
  for (let i = 0; i < RINGS; i++) ringWob.push((i * 0.7) % TAU);

  // --- STREAKS (hyperspace speed-lines toward/away from the core) ---
  const streaks = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  root.add(streaks);
  const STREAKS = 26;
  // Each streak's angle is fixed for its lifetime, so bake cos/sin (pre-squashed)
  // once at setup — exactly like ringWob — instead of recomputing per frame.
  const stkT0 = [], stkSpd = [], stkCos = [], stkSin = [];
  for (let m = 0; m < STREAKS; m++) {
    const ang = (m / STREAKS) * TAU + (m % 4) * 0.5;
    stkCos.push(Math.cos(ang));
    stkSin.push(Math.sin(ang) * SQUASH);
    stkT0.push((m * 0.137) % 1);
    stkSpd.push(0.9 + (m % 5) * 0.2);
  }

  // --- CORE LENS (bright breathing pupil) + orbiting sparks ---
  const core = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  root.add(core);

  // --- SHOCKWAVE layer (climax burst; drawn behind the ship) ---
  const shock = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  root.add(shock);

  // --- SHIP — the kid's REAL ship + companion, matching the parked map ship, so
  // the showcase keeps their customization (parts read is synchronous &
  // warp-safe; falls back to defaults if unavailable). The container TRANSFORM
  // (position/scale/alpha/rotation) is driven by the master clock in redraw();
  // the engine-trail particles and pet flourishes keep their own ambient tweens. ---
  let parts;
  try { parts = ship.getCurrentParts(); } catch (e) { parts = undefined; }
  // The ship GEOMETRY is baked at the hero size; the warp then animates the
  // CONTAINER scale (0.2 = tiny/swallowed … 1.0 = full hero) — NOT drawShip's
  // `scale` (that bakes into the geometry; double-driving it left the old 'out'
  // ship microscopic, so only the pet read). Pet rides in the porthole and so
  // scales with the ship.
  const HERO_BAKE = 1.0;
  const shipG = drawShip(scene, CX, CY, { scale: HERO_BAKE, showTrail: true, parts });
  shipG.setScrollFactor(0);
  try {
    if (companion.hasStarter?.() && shipG.portholeCenter) {
      const pc = shipG.portholeCenter;
      shipG.add(drawCompanion(scene, pc.x, pc.y, { scale: 0.70 }));
    }
  } catch (e) { /* pet is optional */ }
  root.add(shipG);

  // --- FLASH (ADD) for the mid wink + climax bloom ---
  const flash = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  flash.fillStyle(0xffffff, 1);
  flash.fillRect(0, 0, W, H);
  flash.setAlpha(0);
  root.add(flash);

  // --- DARK COVER (normal) — seamless handoff to the rebuilt map's black fade ---
  const cover = scene.add.rectangle(CX, 960, W, H, COVER_BG, 1).setAlpha(0);
  root.add(cover);

  let winkFired = false;
  let punched = false;
  let done = false;
  let shockTween = null;
  const timers = [];

  // --- TAP-TO-SKIP (invisible full-screen surface + a gentle late-fading hint) ---
  const hit = scene.add.rectangle(CX, 960, W, H, 0x000000, 0.001).setInteractive();
  root.add(hit);
  // Body size, light ink and a dark outline so it reads over the bright
  // passing rings and the pale homecoming sky.
  const skipHint = scene.add.text(CX, H - 150, 'tap to skip', style('body', {
    fontSize: '42px', fill: '#e0e0ef', fontStyle: '700',
    stroke: '#0a0a1a', strokeThickness: 5
  })).setOrigin(0.5).setAlpha(0);
  root.add(skipHint);
  timers.push(scene.time.delayedCall(1000, () => {
    scene.tweens.add({ targets: skipHint, alpha: 0.85, duration: 500, ease: 'Sine.easeOut' });
  }));

  function redraw() {
    const p = clock.p;
    // mix: 0 = the outer end (deep space, or the morning street for the
    // homecoming palette), 1 = the body's warm end.
    const mix = dirIn ? p : 1 - p;

    // Backdrop: morph cold↔warm, fully opaque.
    backdrop.clear();
    backdrop.fillStyle(lerpHex(COLD_BG, WARM_BG, mix), 1);
    backdrop.fillRect(0, 0, W, H);

    // Ring tunnel: concentric squashed ellipses, quadratic depth spacing.
    tunnel.clear();
    for (let i = 0; i < RINGS; i++) {
      let t = ((i / RINGS) + p * 2.2 * (dirIn ? 1 : -1)) % 1;
      if (t < 0) t += 1;
      const sc = Math.pow(t, 1.9);
      const rw = 30 + sc * 1340;
      const squash = 0.74 + 0.06 * Math.sin(ringWob[i] + p * TAU);
      const rh = rw * squash;
      const offX = Math.sin(ringWob[i] * 0.7 + p * 3) * 16 * sc;
      const offY = Math.cos(ringWob[i] * 0.5) * 9 * sc;
      const a = Math.min(0.66, 0.12 + 0.66 * (1 - Math.min(1, Math.abs(t - 0.5) * 1.4)));
      const col = sampleGrad(GRAD, Math.max(0, Math.min(1, mix + (t - 0.5) * 0.22)));
      tunnel.lineStyle(2 + sc * 8, col, a);
      tunnel.strokeEllipse(CX + offX, CY + offY, rw, rh);
    }

    // Hyperspace streaks: short radial speed-lines accelerating toward/away.
    streaks.clear();
    const speedUp = 1 + 1.6 * mix;                   // streaks get longer/faster mid-dive
    const streakCol = sampleGrad(GRAD, mix);         // loop-invariant — sample once per frame
    for (let m = 0; m < STREAKS; m++) {
      let u = (stkT0[m] + p * stkSpd[m] * 1.5) % 1;
      if (u < 0) u += 1;
      const rp = dirIn ? 1 - u : u;                   // 0 = core, 1 = rim
      const r1 = Math.pow(rp, STREAK_CURVE) * STREAK_REACH;
      const r2 = Math.pow(Math.max(0, rp - 0.05 * speedUp), STREAK_CURVE) * STREAK_REACH;
      const a = (dirIn ? (0.12 + 0.8 * rp) : (0.12 + 0.8 * (1 - rp))) * 0.9;
      const ca = stkCos[m], sa = stkSin[m];           // fixed per streak (pre-squashed)
      streaks.lineStyle(1.6 + rp * 3, streakCol, a);
      streaks.lineBetween(CX + ca * r2, CY + sa * r2, CX + ca * r1, CY + sa * r1);
    }

    // Core lens: stacked filled ellipses + hot pupil + orbiting sparks. The
    // default core goes cream at the cosmos end to rose at the body end; the
    // homecoming core goes soft morning yellow at the arrival end to cream at
    // the body end, so the light you surface into is the morning sun.
    const accent = homecoming
      ? lerpHex(0xffd66b, 0xfff3b8, mix)
      : lerpHex(0xfff3b8, 0xff7a8a, mix);
    const baseScale = (dirIn ? 0.35 + 0.95 * p : 1.30 - 0.95 * p) * (1 + 0.07 * Math.sin(p * 20));
    const cs = Math.max(0.12, baseScale);
    core.clear();
    core.fillStyle(accent, 0.16); core.fillEllipse(CX, CY, 240 * cs, 240 * cs * SQUASH);
    core.fillStyle(accent, 0.30); core.fillEllipse(CX, CY, 150 * cs, 150 * cs * SQUASH);
    core.fillStyle(accent, 0.55); core.fillEllipse(CX, CY, 90 * cs, 90 * cs * SQUASH);
    core.fillStyle(0xffffff, 0.95); core.fillEllipse(CX, CY, 46 * cs, 46 * cs * SQUASH);
    for (let s = 0; s < 6; s++) {
      const sa2 = s / 6 * TAU + p * TAU * (dirIn ? 1.4 : -1.4);
      const sr = (120 + 60 * Math.sin(p * 12 + s)) * cs;
      core.fillStyle(0xffffff, 0.5 + 0.4 * Math.sin(p * 16 + s));
      core.fillCircle(CX + Math.cos(sa2) * sr, CY + Math.sin(sa2) * sr * SQUASH, 2.5 + 2 * cs);
    }

    // Ship hero — clock-driven. `csc` is the CONTAINER zoom (0.2 tiny … 1.0 full
    // hero); effective ship size is HERO_BAKE × csc. IN: full-size hero at the
    // bottom accelerates up and shrinks into the core. OUT: bursts from the core
    // and grows toward the viewer (front-loaded easeOut so it reads as the hero
    // almost immediately, not just at the very end).
    const srot = Math.sin(p * Math.PI) * 0.06;   // gentle roll, identical both ways
    let sy, csc, sal;
    if (dirIn) {
      const k = Math.min(1, p / 0.94); const ke = k * k;     // easeIn accelerate
      sy = SHIP_DIVE_START_Y + (CY - SHIP_DIVE_START_Y) * ke;
      csc = 1.0 - 0.8 * ke;
      sal = p < 0.74 ? 1 : Math.max(0.08, 1 - (p - 0.74) / 0.26 * 0.92);
    } else {
      const eo = 1 - (1 - p) * (1 - p);                       // easeOut, front-loaded
      sy = CY + (SHIP_SURFACE_REST_Y - CY) * eo;
      csc = 0.2 + 0.8 * eo;
      sal = Math.min(1, p / 0.16);
    }
    shipG.setPosition(CX, sy);
    shipG.setScale(csc);
    shipG.setAlpha(sal);
    shipG.setRotation(srot);

    // Membrane-crossing wink at the teal pivot (p ≈ 0.5).
    if (!winkFired && p >= 0.5) {
      winkFired = true;
      scene.tweens.add({
        targets: flash, alpha: { from: 0, to: 0.28 },
        duration: 160, yoyo: true, ease: 'Sine.easeOut',
      });
      scene.cameras.main.flash(140, 255, 240, 210);
      audio.playTone?.(523, 0.12, 'sine', 0.18);
    }
  }

  // Expanding shockwave rings from the core at the climax. ALL rings are drawn
  // from ONE tween + one onUpdate (clear once, then stroke every live ring) so
  // the three rings can never erase each other. (The old version gave each ring
  // its own tween sharing this `shock` graphics; every onUpdate's clear() wiped
  // the others, so only the last-updated ring ever survived a frame.) Tracked in
  // `shockTween` so finish() can kill it, and the onUpdate no-ops if `shock` was
  // already torn down by the scene swap.
  function fireShockwave() {
    // Homecoming rings burst in morning colours: soft warm yellow when surfacing
    // into Home Ground, pale blue on the (unused today) inward variant.
    const tint = homecoming ? (dirIn ? 0x9fd6ff : 0xffd66b) : (dirIn ? 0xff9ec7 : 0xbcd4ff);
    const RING_MS = 460, GAP_MS = 90, N = 3;
    const total = RING_MS + GAP_MS * (N - 1);   // last ring still expanding here
    const wave = { ms: 0 };
    shockTween = scene.tweens.add({
      targets: wave, ms: total,
      duration: total, ease: 'Linear',
      onUpdate: () => {
        if (!shock.scene) return;               // graphics destroyed — bail
        shock.clear();
        for (let r = 0; r < N; r++) {
          const local = (wave.ms - r * GAP_MS) / RING_MS;   // this ring's 0→1
          if (local <= 0 || local >= 1) continue;
          const eased = 1 - Math.pow(1 - local, 3);         // Cubic.easeOut
          const rad = 30 + (SHOCK_MAX_R - 30) * eased;
          const a = 0.85 * (1 - eased);
          shock.lineStyle(3 + 12 * a, r === 0 ? 0xffffff : tint, a);
          shock.strokeEllipse(CX, CY, rad, rad * 0.82);
        }
      },
      onComplete: () => { if (shock.scene) shock.clear(); },
    });
  }

  function punchOut() {
    if (punched) return;
    punched = true;
    skipHint.setAlpha(0);
    fireShockwave();
    // Bright bloom + a harder kick.
    scene.tweens.add({ targets: flash, alpha: 1, duration: 220, ease: 'Cubic.easeIn' });
    scene.cameras.main.flash(220, 255, 255, 255);
    scene.cameras.main.shake(220, 0.012);
    if (dirIn) audio.playTone?.(180, 0.22, 'sine', 0.24);     // low heartbeat thump
    else       audio.playTone?.(880, 0.22, 'triangle', 0.24); // bright starlight chime
    // Settle to opaque 0x0a0a1a, then hand off under the cover.
    timers.push(scene.time.delayedCall(200, () => {
      scene.tweens.add({
        targets: cover, alpha: 1, duration: 300, ease: 'Cubic.easeIn',
        onComplete: finish,
      });
    }));
  }

  function finish() {
    if (done) return;
    done = true;
    timers.forEach(t => t.remove?.());
    scene.tweens.killTweensOf(clock);
    shockTween?.stop();   // shockwave can outlive the swap; kill it before teardown
    // The opaque `cover` must stay up until the scene ACTUALLY swaps. onDone()
    // restarts the scene, but Phaser defers the restart to the next step — so
    // destroying root synchronously here would pull the cover and flash the old
    // map for a frame. Tear root down on the scene's shutdown instead (fired by
    // the restart, in the same step the new scene takes over), so there's no gap.
    scene.events.once('shutdown', () => { try { root.destroy(); } catch (e) { /* already torn down */ } });
    try { onDone?.(); } catch (e) { /* scene swap in flight */ }
  }

  function skip() {
    if (punched || done) return;
    scene.tweens.killTweensOf(clock);
    clock.p = 1;
    // Jump straight to the climax: suppress the mid-cross wink so it can't fire
    // its camera-flash + tone in the same frame as punchOut's bloom (double kick).
    winkFired = true;
    redraw();
    punchOut();
  }
  hit.on('pointerdown', skip);

  // Master clock — the single frame loop.
  const clock = { p: 0 };
  scene.tweens.add({
    targets: clock, p: 1,
    duration: CLOCK_MS, ease: 'Sine.easeInOut',
    onUpdate: redraw, onComplete: punchOut,
  });

  // Warp whoosh (the rising sawtooth maps onto the accelerating dive).
  audio.playWarp?.();
  redraw();

  return { skip };
}
