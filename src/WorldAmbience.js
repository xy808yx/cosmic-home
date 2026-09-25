// Map ambience layers: starfield, drifting nebulae, shooting stars, and
// per-world themed particles. Designed for the WorldMapScene. The starfield
// helper already provides the map base; this module adds animated layers
// on top of (but behind) the world nodes. Chapter 1 gets the cosmic set,
// Chapter 2 the living-vessel set, and Chapter 3 "Home Ground" a summer-day
// set whose per-world emitters come from src/homeGround.
//
// All emission respects a scene-wide cap to keep mid-tier phones at 60fps.

import { HOME_GROUND_WORLDS } from './homeGround/index.js';

const SCENE_CAP = 60;
const PER_WORLD_CAP = 4;

// Build all ambience layers for the map.
// `nodePositions` is an array of {x, y} in path order, and `furthestUnlocked`
// is the highest world index that should emit theme particles.
export function createMapAmbience(scene, opts) {
  const {
    width, height, nodePositions, furthestUnlocked, accentColors,
    chapter = 1, worldIds
  } = opts;

  const state = {
    activeParticles: 0,
    layers: scene.add.container(0, 0).setDepth(1)
  };

  if (chapter === 2) {
    // Inner Space: a warm living-vessel ambience — pulsing capillary walls,
    // drifting translucent cells, and rising convection motes. No white stars,
    // no shooting stars (those are the cosmic-only cues for Outer Space).
    buildCapillaryArcs(scene, state, width, height);
    for (let i = 0; i < 18; i++) buildDriftCell(scene, state, width, height);
    scheduleConvectionMote(scene, state, width, height);
    buildVignette(scene, width, height);
  } else if (chapter === 3) {
    // Home Ground: summer-day air over the family's city, drifting cream and
    // sky-blue motes and slow motes rising in the daylight. No white stars, no
    // shooting stars, and no edge vignette: on the light paper its dark bars
    // read as hard grey stripes, and the paper names carry their own halo.
    for (let i = 0; i < 16; i++) buildDriftMote(scene, state, width, height);
    scheduleWarmMote(scene, state, width, height);
  } else {
    // Outer Space: the cosmic starfield ambience.
    buildTwinkleStars(scene, state, width, height);
    buildNebulaClouds(scene, state, width, height, accentColors);
    scheduleShootingStar(scene, state, width, height);
  }

  // Theme particles per unlocked world (every chapter). Use the REAL world id at
  // each node: Chapter 2's nodes are worlds 21-28 and Chapter 3's are 31-38, so
  // the old `i + 1` silently gave them Chapter 1's emitters.
  for (let i = 0; i <= furthestUnlocked; i++) {
    const pos = nodePositions[i];
    if (!pos) continue;
    const worldId = worldIds && worldIds[i] != null ? worldIds[i] : i + 1;
    buildWorldEmitter(scene, state, worldId, pos.x, pos.y);
  }

  return state;
}

// ── Chapter 2 "Inner Space" ambience builders ──────────────────────────────

// Two soft capillary walls hugging the screen edges (open sine-sampled bulges,
// never closed rings). They throb gently out of phase like a heartbeat.
function buildCapillaryArcs(scene, state, W, H) {
  for (const dir of [-1, 1]) {
    const g = scene.add.graphics();
    const stroke = (w, color, alpha) => {
      g.lineStyle(w, color, alpha);
      g.beginPath();
      for (let y = 80; y <= H - 140; y += 40) {
        const x = dir < 0
          ? -20 + Math.sin(y * 0.004) * 70
          : W + 20 - Math.sin(y * 0.004) * 70;
        if (y === 80) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.strokePath();
    };
    stroke(40, 0xc23a4a, 0.22);   // vessel wall
    stroke(10, 0xff7a8a, 0.30);   // inner highlight
    state.layers.add(g);
    scene.tweens.add({
      targets: g,
      alpha: { from: 0.7, to: 1.0 }, scaleX: 1.03,
      duration: 3600 + Math.random() * 800, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut', delay: dir < 0 ? 0 : 900,
    });
  }
}

// One drifting translucent cell — the star replacement. Bobs and drifts
// laterally on a current (never falls); near cells (high depth factor) are
// larger / faster, far cells smaller / slower → parallax depth.
function buildDriftCell(scene, state, W, H) {
  const f = Math.random();
  const g = scene.add.graphics();
  const roll = Math.random();
  if (roll < 0.5) {
    // red blood cell — two discs with a paler dimple
    const r = 14 + f * 16;
    g.fillStyle(0xc23a4a, 0.5); g.fillEllipse(0, 0, r * 2, r * 1.4);
    g.fillStyle(0xff7a8a, 0.65); g.fillEllipse(0, 0, r * 1.2, r * 0.8);
  } else if (roll < 0.8) {
    // plasma vesicle — a glassy bubble
    const r = 10 + f * 12;
    g.fillStyle(0xff9ec7, 0.30); g.fillCircle(0, 0, r);
    g.lineStyle(2, 0xffc2d2, 0.4); g.strokeCircle(0, 0, r);
  } else {
    // teal cell — ties the cell-teal palette together
    const r = 12 + f * 12;
    g.fillStyle(0x4ecdc4, 0.22); g.fillCircle(0, 0, r);
    g.fillStyle(0xbafff6, 0.4); g.fillCircle(0, 0, r * 0.5);
  }
  // Bias x out of the centre node/label spine so labels never lose contrast.
  const left = Math.random() < 0.5;
  g.x = left ? 40 + Math.random() * (W * 0.30) : W * 0.66 + Math.random() * (W * 0.30);
  g.y = 160 + Math.random() * (H - 360);
  state.layers.add(g);
  const dir = Math.random() < 0.5 ? -1 : 1;
  scene.tweens.add({
    targets: g, x: '+=' + (dir * (60 + 120 * f)),
    duration: 14000 + Math.random() * 12000, yoyo: true, repeat: -1,
    ease: 'Sine.easeInOut', delay: Math.random() * 4000,
  });
  scene.tweens.add({
    targets: g, y: '+=' + (10 + 18 * f),
    duration: 3000 + Math.random() * 2000, yoyo: true, repeat: -1,
    ease: 'Sine.easeInOut', delay: Math.random() * 1000,
  });
  scene.tweens.add({
    targets: g, scaleX: 1.08, scaleY: 0.94,
    duration: 2600 + Math.random() * 1400, yoyo: true, repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

// Slow upward convection motes — the organic replacement for shooting stars.
// Self-rescheduling, capped against SCENE_CAP exactly like scheduleShootingStar.
function scheduleConvectionMote(scene, state, W, H) {
  const colors = [0xff7a8a, 0xffc2d2, 0xffcf6b];
  const fire = () => {
    if (state.activeParticles >= SCENE_CAP) {
      scene.time.delayedCall(2000, fire);
      return;
    }
    const mote = scene.add.circle(
      Math.random() * W, H - 120 + Math.random() * 80,
      2 + Math.random() * 2, colors[Math.floor(Math.random() * colors.length)], 0.7
    );
    state.layers.add(mote);
    state.activeParticles++;
    scene.tweens.add({
      targets: mote, y: '-=' + (380 + Math.random() * 260), alpha: 0,
      duration: 3200 + Math.random() * 1400, ease: 'Sine.easeOut',
      onComplete: () => { mote.destroy(); state.activeParticles--; },
    });
    scene.tweens.add({
      targets: mote, x: '+=' + ((Math.random() - 0.5) * 70),
      duration: 3200, yoyo: true, repeat: 1, ease: 'Sine.easeInOut',
    });
    scene.time.delayedCall(1400 + Math.random() * 1200, fire);
  };
  scene.time.delayedCall(2000 + Math.random() * 4000, fire);
}

// ── Chapter 3 "Home Ground" ambience builders ──────────────────────────────

// One drifting summer-day mote, the Home Ground replacement for stars/cells:
// soft cream, pale sky blue, leaf green and warm sand, like seed fluff and
// pollen on a Saturday. Bobs and drifts laterally (never falls); biased out of
// the centre label spine.
function buildDriftMote(scene, state, W, H) {
  const f = Math.random();
  const colors = [0xfff4dc, 0xbfe3f7, 0x9ccf7a, 0xe6cfa0];
  const r = 2 + f * 3;
  const g = scene.add.circle(0, 0, r, colors[Math.floor(Math.random() * colors.length)], 0.5);
  const left = Math.random() < 0.5;
  g.x = left ? 40 + Math.random() * (W * 0.30) : W * 0.66 + Math.random() * (W * 0.30);
  g.y = 160 + Math.random() * (H - 360);
  state.layers.add(g);
  const dir = Math.random() < 0.5 ? -1 : 1;
  scene.tweens.add({
    targets: g, x: '+=' + (dir * (50 + 100 * f)),
    duration: 12000 + Math.random() * 10000, yoyo: true, repeat: -1,
    ease: 'Sine.easeInOut', delay: Math.random() * 4000,
  });
  scene.tweens.add({
    targets: g, y: '+=' + (8 + 14 * f),
    duration: 2600 + Math.random() * 1600, yoyo: true, repeat: -1,
    ease: 'Sine.easeInOut', delay: Math.random() * 1000,
  });
  scene.tweens.add({
    targets: g, alpha: 0.15,
    duration: 2200 + Math.random() * 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
  });
}

// Slow motes rising in the daylight, the Home Ground replacement for shooting
// stars: cream, pale sky blue and warm sand. Self-rescheduling, capped against
// SCENE_CAP.
function scheduleWarmMote(scene, state, W, H) {
  const colors = [0xfff4dc, 0xbfe3f7, 0xe6cfa0];
  const fire = () => {
    if (state.activeParticles >= SCENE_CAP) {
      scene.time.delayedCall(2000, fire);
      return;
    }
    const mote = scene.add.circle(
      Math.random() * W, H - 120 + Math.random() * 80,
      1.5 + Math.random() * 2, colors[Math.floor(Math.random() * colors.length)], 0.6
    );
    state.layers.add(mote);
    state.activeParticles++;
    scene.tweens.add({
      targets: mote, y: '-=' + (360 + Math.random() * 240), alpha: 0,
      duration: 3400 + Math.random() * 1600, ease: 'Sine.easeOut',
      onComplete: () => { mote.destroy(); state.activeParticles--; },
    });
    scene.tweens.add({
      targets: mote, x: '+=' + ((Math.random() - 0.5) * 60),
      duration: 3400, yoyo: true, repeat: 1, ease: 'Sine.easeInOut',
    });
    scene.time.delayedCall(1400 + Math.random() * 1200, fire);
  };
  scene.time.delayedCall(2000 + Math.random() * 4000, fire);
}

// Subtle peripheral vignette (depth 4, between ambience and nodes) so node
// labels near the screen edges always stay readable. Inner Space only.
function buildVignette(scene, W, H) {
  const v = scene.add.graphics().setDepth(4);
  v.fillStyle(0x000000, 0.18);
  v.fillRect(0, 0, W, 90);
  v.fillRect(0, H - 90, W, 90);
  v.fillRect(0, 0, 90, H);
  v.fillRect(W - 90, 0, 90, H);
}

// 80 small dots; ~30% of them gently twinkle.
function buildTwinkleStars(scene, state, W, H) {
  const stars = [];
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * W;
    const y = 240 + Math.random() * (H - 460);
    const r = Math.random() < 0.15 ? 2 : 1;
    const dot = scene.add.circle(x, y, r, 0xffffff, 0.6 + Math.random() * 0.3);
    state.layers.add(dot);
    stars.push(dot);

    if (Math.random() < 0.3) {
      scene.tweens.add({
        targets: dot,
        alpha: 0.3,
        duration: 1500 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 2000
      });
    }
  }
  state.stars = stars;
}

// Three large soft pastel ellipses that slowly translate.
function buildNebulaClouds(scene, state, W, H, accentColors) {
  const palette = accentColors && accentColors.length
    ? accentColors
    : [0xb5e6ff, 0xff9ec7, 0xffe07a];
  for (let i = 0; i < 3; i++) {
    const color = palette[i % palette.length];
    const cloud = scene.add.graphics();
    cloud.fillStyle(color, 0.10);
    const w = 600 + Math.random() * 240;
    const h = 320 + Math.random() * 120;
    cloud.fillEllipse(0, 0, w, h);
    cloud.x = Math.random() * W;
    cloud.y = 320 + Math.random() * (H - 640);
    state.layers.add(cloud);

    const dir = i % 2 === 0 ? 1 : -1;
    const span = W + 800;
    scene.tweens.add({
      targets: cloud,
      x: cloud.x + dir * span,
      duration: 38000 + Math.random() * 20000,
      repeat: -1,
      onRepeat: () => {
        cloud.x = dir > 0 ? -400 : W + 400;
      }
    });
  }
}

// One shooting star every ~10s; randomized angle + length.
function scheduleShootingStar(scene, state, W, H) {
  const fire = () => {
    if (state.activeParticles >= SCENE_CAP) {
      scene.time.delayedCall(2000, fire);
      return;
    }
    const startX = Math.random() * W * 0.6;
    const startY = 280 + Math.random() * 400;
    const dx = 320 + Math.random() * 400;
    const dy = 220 + Math.random() * 280;

    const head = scene.add.circle(startX, startY, 3, 0xffffff, 1);
    state.layers.add(head);
    state.activeParticles++;

    const trail = scene.add.graphics();
    trail.lineStyle(3, 0xffffff, 0.55);
    trail.lineBetween(0, 0, -dx * 0.18, -dy * 0.18);
    trail.x = startX;
    trail.y = startY;
    state.layers.add(trail);
    state.activeParticles++;

    const dur = 800 + Math.random() * 400;
    scene.tweens.add({
      targets: [head, trail],
      x: '+=' + dx,
      y: '+=' + dy,
      alpha: 0,
      duration: dur,
      ease: 'Quad.easeIn',
      onComplete: () => {
        head.destroy();
        trail.destroy();
        state.activeParticles -= 2;
      }
    });

    scene.time.delayedCall(8000 + Math.random() * 6000, fire);
  };
  scene.time.delayedCall(2000 + Math.random() * 4000, fire);
}

// Per-world themed emitter. Each world contributes up to PER_WORLD_CAP active
// particles. Uses simple Phaser Graphics + tweens (cheap) rather than the full
// particle system so we have tight control over the cap.
function buildWorldEmitter(scene, state, worldId, cx, cy) {
  const themeFn = THEME_EMITTERS[worldId];
  if (!themeFn) return;

  let activeForWorld = 0;
  const tick = () => {
    if (state.activeParticles >= SCENE_CAP || activeForWorld >= PER_WORLD_CAP) {
      scene.time.delayedCall(700, tick);
      return;
    }
    const obj = themeFn(scene, state, cx, cy);
    if (obj) {
      activeForWorld++;
      state.activeParticles++;
      obj.once('destroy', () => {
        activeForWorld--;
        state.activeParticles--;
      });
    }
    const next = 600 + Math.random() * 800;
    scene.time.delayedCall(next, tick);
  };
  scene.time.delayedCall(500 + Math.random() * 1500, tick);
}

const THEME_EMITTERS = {
  // 1 — Moon Base: rising dust puffs (sky mint)
  1: (scene, state, cx, cy) => {
    const p = scene.add.circle(cx + (Math.random() - 0.5) * 50, cy + 20, 3, 0xb5e6ff, 0.9);
    state.layers.add(p);
    scene.tweens.add({
      targets: p, y: '-=40', alpha: 0,
      duration: 1800, ease: 'Sine.easeOut',
      onComplete: () => p.destroy()
    });
    return p;
  },
  // 2 — Asteroid Belt: small rock orbiting the node
  2: (scene, state, cx, cy) => {
    const radius = 70;
    const startA = Math.random() * Math.PI * 2;
    const p = scene.add.circle(cx + Math.cos(startA) * radius, cy + Math.sin(startA) * radius, 3, 0xc77a4a, 1);
    state.layers.add(p);
    const tween = { a: startA };
    scene.tweens.add({
      targets: tween, a: startA + Math.PI * 2,
      duration: 4000, ease: 'Linear',
      onUpdate: () => {
        p.x = cx + Math.cos(tween.a) * radius;
        p.y = cy + Math.sin(tween.a) * radius;
      },
      onComplete: () => p.destroy()
    });
    return p;
  },
  // 3 — Crystal Planet: lavender twinkle bursting outward
  3: (scene, state, cx, cy) => {
    const a = Math.random() * Math.PI * 2;
    const p = scene.add.circle(cx, cy, 2.5, 0xd5a6ff, 1);
    state.layers.add(p);
    scene.tweens.add({
      targets: p,
      x: cx + Math.cos(a) * 80, y: cy + Math.sin(a) * 80,
      alpha: 0, duration: 1200, ease: 'Quad.easeOut',
      onComplete: () => p.destroy()
    });
    return p;
  },
  // 4 — Nebula Gardens: pollen orbs drifting up
  4: (scene, state, cx, cy) => {
    const colors = [0xff9ec7, 0xfff3b8, 0xd5a6ff];
    const p = scene.add.circle(
      cx + (Math.random() - 0.5) * 70, cy + 30,
      3, colors[Math.floor(Math.random() * colors.length)], 0.85
    );
    state.layers.add(p);
    scene.tweens.add({
      targets: p, y: '-=70', alpha: 0,
      duration: 2400, ease: 'Sine.easeOut',
      onComplete: () => p.destroy()
    });
    return p;
  },
  // 5 — Robot Station: small electrical sparks
  5: (scene, state, cx, cy) => {
    const a = Math.random() * Math.PI * 2;
    const r = 50 + Math.random() * 20;
    const p = scene.add.rectangle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2, 6, 0xfff3b8);
    p.rotation = a;
    state.layers.add(p);
    scene.tweens.add({
      targets: p, alpha: 0,
      duration: 400, ease: 'Quad.easeIn',
      onComplete: () => p.destroy()
    });
    return p;
  },
  // 6 — Black Hole Edge: dots being pulled inward
  6: (scene, state, cx, cy) => {
    const a = Math.random() * Math.PI * 2;
    const startR = 120;
    const sx = cx + Math.cos(a) * startR;
    const sy = cy + Math.sin(a) * startR;
    const p = scene.add.circle(sx, sy, 2.5, 0xff9ec7, 1);
    state.layers.add(p);
    scene.tweens.add({
      targets: p, x: cx, y: cy, alpha: 0,
      duration: 1600, ease: 'Cubic.easeIn',
      onComplete: () => p.destroy()
    });
    return p;
  },
  // 7 — Ice Comet: snowflake glints
  7: (scene, state, cx, cy) => {
    const p = scene.add.circle(
      cx + (Math.random() - 0.5) * 100, cy + (Math.random() - 0.5) * 60,
      2, 0xffffff, 1
    );
    state.layers.add(p);
    scene.tweens.add({
      targets: p, alpha: 0, scale: 1.6,
      duration: 1500, ease: 'Sine.easeOut',
      onComplete: () => p.destroy()
    });
    return p;
  },
  // 8 — Supernova: orange sparks shooting outward
  8: (scene, state, cx, cy) => {
    const a = Math.random() * Math.PI * 2;
    const colors = [0xffae8a, 0xffe07a, 0xfff3b8];
    const p = scene.add.circle(cx, cy, 3, colors[Math.floor(Math.random() * colors.length)], 1);
    state.layers.add(p);
    scene.tweens.add({
      targets: p,
      x: cx + Math.cos(a) * 90, y: cy + Math.sin(a) * 90,
      alpha: 0, duration: 900, ease: 'Quad.easeOut',
      onComplete: () => p.destroy()
    });
    return p;
  },
  // 9 — Galactic Core: gold star bursts
  9: (scene, state, cx, cy) => {
    const a = Math.random() * Math.PI * 2;
    const r = 70 + Math.random() * 20;
    const p = scene.add.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3, 0xffe07a, 1);
    state.layers.add(p);
    scene.tweens.add({
      targets: p, alpha: 0, scale: 1.8,
      duration: 1200, ease: 'Sine.easeOut',
      onComplete: () => p.destroy()
    });
    return p;
  },
  // 10 — Parallel Dimension: mirror-flicker outline pulses
  10: (scene, state, cx, cy) => {
    const ring = scene.add.circle(cx, cy, 60, 0x000000, 0);
    ring.setStrokeStyle(2, 0xa6f0e8, 1);
    state.layers.add(ring);
    scene.tweens.add({
      targets: ring, scale: 1.4, alpha: 0,
      duration: 1400, ease: 'Quad.easeOut',
      onComplete: () => ring.destroy()
    });
    return ring;
  },
  // 11 — Universe's End: faint cosmic-ray streaks
  11: (scene, state, cx, cy) => {
    const a = Math.random() * Math.PI * 2;
    const len = 80;
    const sx = cx + Math.cos(a) * 40;
    const sy = cy + Math.sin(a) * 40;
    const ex = cx + Math.cos(a) * (40 + len);
    const ey = cy + Math.sin(a) * (40 + len);
    const ray = scene.add.line(0, 0, sx, sy, ex, ey, 0xfff3b8, 0.7);
    ray.setLineWidth(1.5);
    state.layers.add(ray);
    scene.tweens.add({
      targets: ray, alpha: 0,
      duration: 1100, ease: 'Quad.easeIn',
      onComplete: () => ray.destroy()
    });
    return ray;
  },
  21: (scene, state, cx, cy) => {
  const colors = [0xff7a8a, 0xff9ec7, 0xc23a4a];
  const p = scene.add.circle(
    cx + (Math.random() - 0.5) * 80, cy + 30,
    3, colors[Math.floor(Math.random() * colors.length)], 0.85
  );
  state.layers.add(p);
  scene.tweens.add({
    targets: p, y: '-=60', alpha: 0,
    duration: 2200, ease: 'Sine.easeOut',
    onComplete: () => p.destroy()
  });
  return p;
},
  22: (scene, state, cx, cy) => {
  const p = scene.add.circle(cx + (Math.random() - 0.5) * 80, cy + 30, 3, 0x4ecdc4, 0.85);
  state.layers.add(p);
  scene.tweens.add({
    targets: p, y: '-=60', alpha: 0, scale: 1.4,
    duration: 2200, ease: 'Sine.easeOut',
    onComplete: () => p.destroy()
  });
  return p;
},
  23: (scene, state, cx, cy) => {
  const p = scene.add.circle(cx + (Math.random() - 0.5) * 80, cy + 30, 3, 0xc77eff, 0.9);
  state.layers.add(p);
  scene.tweens.add({
    targets: p, y: '-=60', alpha: 0, scale: 1.4,
    duration: 2000, ease: 'Sine.easeOut',
    onComplete: () => p.destroy()
  });
  return p;
},
  24: (scene, state, cx, cy) => {
  const a = Math.random() * Math.PI * 2;
  const r = 50 + Math.random() * 24;
  const p = scene.add.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3, 0x7fb8ff, 1);
  state.layers.add(p);
  scene.tweens.add({
    targets: p,
    x: cx + Math.cos(a) * (r + 30), y: cy + Math.sin(a) * (r + 30),
    alpha: 0, scale: 1.6,
    duration: 1100, ease: 'Sine.easeOut',
    onComplete: () => p.destroy()
  });
  return p;
},
  25: (scene, state, cx, cy) => {
  const p = scene.add.circle(cx + (Math.random() - 0.5) * 60, cy + 26, 3, 0xffcf6b, 0.9);
  state.layers.add(p);
  scene.tweens.add({
    targets: p, y: '-=60', alpha: 0, scale: 1.5,
    duration: 2200, ease: 'Sine.easeOut',
    onComplete: () => p.destroy()
  });
  return p;
},
  26: (scene, state, cx, cy) => {
    const p = scene.add.circle(cx + (Math.random() - 0.5) * 90, cy + 30, 3, 0x9be86b, 0.85);
    state.layers.add(p);
    scene.tweens.add({
      targets: p, y: '-=60', alpha: 0, scale: 1.4,
      duration: 2200, ease: 'Sine.easeOut',
      onComplete: () => p.destroy()
    });
    return p;
  },
  27: (scene, state, cx, cy) => {
  const a = Math.random() * Math.PI * 2;
  const colors = [0xff9b4a, 0xffc77a, 0xffe07a];
  const p = scene.add.circle(cx, cy, 3, colors[Math.floor(Math.random() * colors.length)], 1);
  state.layers.add(p);
  scene.tweens.add({
    targets: p,
    x: cx + Math.cos(a) * 80, y: cy + Math.sin(a) * 80,
    alpha: 0, duration: 1100, ease: 'Quad.easeOut',
    onComplete: () => p.destroy()
  });
  return p;
},
  28: (scene, state, cx, cy) => {
  const a = Math.random() * Math.PI * 2;
  const r = 72 + Math.random() * 18;
  const p = scene.add.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3, 0xfff3b8, 1);
  state.layers.add(p);
  scene.tweens.add({
    targets: p, alpha: 0, scale: 1.8,
    duration: 1400, ease: 'Sine.easeOut',
    onComplete: () => p.destroy()
  });
  return p;
},
};

// Chapter 3 "Home Ground": the eight per-world emitters (worlds 31 to 38) are
// written by the world modules in src/homeGround and registered here so
// buildWorldEmitter keeps counting and capping them exactly as before.
for (const id of Object.keys(HOME_GROUND_WORLDS)) {
  const world = HOME_GROUND_WORLDS[id];
  THEME_EMITTERS[id] = (scene, state, cx, cy) => world.emit(scene, state, cx, cy);
}
