// The Science Dome (the Chapter 3 hard secret, world 39): all of its art.
//
// What the real building looks like: a full geodesic ball of silver triangular
// panels (not a half dome) on a ring of splayed white struts, on top of a low,
// wide base building (cream walls, red trim, warm windows) that stands on a
// pier right at the water, so the ball is mirrored in the water in front. At
// dusk its lights come on: a dot of light at the panel corners.
//
// The lights are WARM GOLD AND WHITE ONLY: dots at the panel corners plus a
// soft plain glow. Never bands of different colours.
//
// Art rule: plain shapes only. The panels are filled triangles in latitude
// rows (no line lattice, so no star shapes can form, and no fan of panels
// meets at the top: the top is one plain cap). Light is dots and plain
// ellipse glows: no spikes, rays, sunbursts or tendrils.
//
// What lives here:
//   drawScienceDomeNode     the map node (found: lights off; won: lights on)
//   drawDomeLandmark        the small ink glyph on the paper map before it is found
//   createDomeRaceBackdrop  the race: the dome at dusk from the seawall
//   createDomeQuotaMeter    the quota strip, one panel lit per correct crate
//   drawDomeCrateSticker    the round sticker on the discovery crate
//
// Everything static is painted once into a cached texture (keys start with
// "scienceDome"); only the light dots are live. The module imports nothing
// but paper.js, so its geometry also runs in plain node.

import { ink, inkLine, paper, sky, stars } from './paper.js';

// The dusk, shared with the finale node so the chapter's sky arc holds.
const DUSK = 0x4a3a80;
const MAUVE = 0x8a5f98;
const ROSE = 0xd98a7a;
const AFTERGLOW = 0xf0b489;
const STAR = 0xfff3d6;
const TOWER = 0x3a3566;       // the towers behind, dark against the dusk
const LAMP = 0xffe9a8;        // warm windows
const LAMP_DIM = 0xe9c98a;
const STEEL_LO = 0x585c86;    // the ball's panels in shade, picking up the dusk
const STEEL_HI = 0xe4e6f0;    // the ball's panels catching the last light
const RIM = 0x4e527a;         // the ball behind its panels (shows at the edge)
const FRAME = 0xf6f3ec;       // the white struts
const BASE = 0xece5d8;        // the base building's walls
const BASE_SHADE = 0xd6cdbd;
const RED = 0xe8594a;         // the chapter's red, the base trim and the collar
const WATER = 0x5a67a6;       // the water at dusk
const WATER_HI = 0x8190c8;

// The lights. Gold and white, nothing else.
const GOLD = 0xffd98a;
const GOLD_PALE = 0xffe9b0;
const WHITE = 0xfffaf0;

const D = Math.PI / 180;
const TILT = -10 * D;                  // seen from a little below, as from the seawall
const LIGHT = norm([-0.45, 0.62, 0.64]);

// The panels. Row boundaries in degrees of latitude; above the first is the
// plain cap and below the last is hidden by the collar and the base. `segs`
// is the panel corners across the front at the equator.
//   NODE: the approved map node (bigger panels, reads at map size).
//   RACE: the full-screen ball, finer. With these rows exactly 48 corners
//   face the viewer above the collar, so every crate of the 48 lights one.
const NODE_BALL = { lat: [64, 42, 21, 0, -21, -42, -64], segs: 7 };
const RACE_BALL = { lat: [66, 50, 34, 18, 2, -14, -30, -46, -62], segs: 12 };

// Which corners carry a light: facing us, off the very edge, above the collar.
const NODE_DOTS = { lamMax: 84, zMin: 0.3, maxY: 0.55 };
const RACE_DOTS = { lamMax: 86, zMin: 0.25, maxY: 0.55 };

function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function mix(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * k) << 16) | (Math.round(ag + (bg - ag) * k) << 8) | Math.round(ab + (bb - ab) * k);
}

// ── The ball ────────────────────────────────────────────────────────────────

// A point on the ball (latitude phi, longitude lam, degrees) on screen, with
// its facing (x right, up, toward the viewer) for the shading.
function project(cx, cy, r, phi, lam) {
  const p = phi * D, l = lam * D;
  const x = Math.cos(p) * Math.sin(l);
  const y = Math.sin(p);
  const z = Math.cos(p) * Math.cos(l);
  const up = y * Math.cos(TILT) - z * Math.sin(TILT);
  const depth = y * Math.sin(TILT) + z * Math.cos(TILT);
  return { x: cx + r * x, y: cy - r * up, n: [x, up, depth], lam };
}

// The corners along one row boundary, left edge to right edge. Fewer corners
// toward the top (the panels stay about the same size on the ball), and every
// other boundary is staggered by half a panel so the rows make triangles.
function boundary(geom, b, cx, cy, r) {
  const phi = geom.lat[b];
  const n = Math.max(2, Math.round(geom.segs * Math.cos(phi * D)));
  const step = 180 / n;
  const off = b % 2 ? 0.5 : 0;
  const lams = [-90];
  for (let j = 1; j <= n; j++) {
    const l = -90 + (j - off) * step;
    if (l > -89.5 && l < 89.5) lams.push(l);
  }
  lams.push(90);
  return lams.map(l => project(cx, cy, r, phi, l));
}

function ballRows(geom, cx, cy, r) {
  return geom.lat.map((_, b) => boundary(geom, b, cx, cy, r));
}

// Zips two boundaries into one row of triangles.
function strip(A, B) {
  const tris = [];
  let i = 0, j = 0;
  while (i < A.length - 1 || j < B.length - 1) {
    const takeA = j >= B.length - 1 || (i < A.length - 1 && A[i + 1].lam <= B[j + 1].lam);
    if (takeA) { tris.push([A[i], A[i + 1], B[j]]); i++; }
    else { tris.push([A[i], B[j + 1], B[j]]); j++; }
  }
  return tris;
}

function shade(pts, parity) {
  const n = norm([0, 1, 2].map(k => pts.reduce((s, p) => s + p.n[k], 0)));
  const d = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
  return Math.max(0, Math.min(1, 0.14 + 0.9 * Math.max(0, d) + (parity ? -0.06 : 0.06)));
}

// How squarely a panel faces the viewer (0 at the edge, 1 dead ahead).
function facing(pts) {
  return Math.max(0, norm([0, 1, 2].map(k => pts.reduce((s, p) => s + p.n[k], 0)))[2]);
}

// Panel colour for a shading value t (0 shade, 1 lit side) and facing f
// (0 edge, 1 front), per look.
//   dark: dusk silver, the approved lights-off node.
//   lit:  later in the evening: a deeper silver, warmed by its own gold
//         lights, so the lights are the brightest thing on the ball.
//   race: a calmer, deeper silver for the full-screen backdrop, so white
//         type and the lights both stand out against it.
const TONES = {
  dark: t => mix(STEEL_LO, STEEL_HI, t),
  lit: (t, f) => mix(mix(0x363463, 0xaeacc6, t), GOLD, 0.08 + 0.12 * t + 0.16 * f * f),
  race: t => mix(0x3a3d6a, 0xa3a7c6, t),
  // The race ball once its lights are on (faded in as the crates are solved).
  raceLit: (t, f) => mix(mix(0x3a3d6a, 0xa3a7c6, t), GOLD, 0.12 + 0.1 * t + 0.24 * f * f)
};
const HIGHLIGHT = { dark: 0.26, lit: 0.16, race: 0.12, raceLit: 0.12 };

// The ball: rim disc, plain cap, rows of shaded triangles, one highlight.
// Drawn through paper() so it carries the cutout shadow, unless it is an
// overlay laid on a ball that already has one.
function paintBall(g, cx, cy, r, geom, look, castShadow = true) {
  const rows = ballRows(geom, cx, cy, r);
  const tone = TONES[look];
  const draw = (gg, shadow) => {
    ink(gg, shadow, RIM).fillCircle(cx, cy, r);
    if (shadow) return;
    // The cap: the part of the ball above the first boundary, one plain plane.
    const top = rows[0];
    const a0 = Math.atan2(top[top.length - 1].y - cy, top[top.length - 1].x - cx);
    const a1 = Math.atan2(top[0].y - cy, top[0].x - cx);
    const cap = top.map(p => ({ x: p.x, y: p.y }));
    let sweep = a1 - a0;
    if (sweep > 0) sweep -= Math.PI * 2;
    for (let k = 1; k < 24; k++) {
      const a = a0 + sweep * (k / 24);
      cap.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    const capPt = [project(cx, cy, r, 78, -20)];
    ink(gg, false, tone(shade(capPt, 0), facing(capPt)));
    gg.fillPoints(cap, true, true);
    // The rows of panels.
    for (let b = 0; b < rows.length - 1; b++) {
      strip(rows[b], rows[b + 1]).forEach((tri, i) => {
        ink(gg, false, tone(shade(tri, i % 2), facing(tri)));
        gg.fillTriangle(tri[0].x, tri[0].y, tri[1].x, tri[1].y, tri[2].x, tri[2].y);
      });
    }
    // One soft highlight on the upper left, where the last light lands.
    gg.fillStyle(0xffffff, HIGHLIGHT[look]);
    gg.fillEllipse(cx - r * 0.4, cy - r * 0.46, r * 0.56, r * 0.3);
  };
  if (castShadow) paper(g, 4 * r / 40, 6 * r / 40, draw);
  else draw(g, false);
}

// The panel corners that carry a light, with the row they sit on (0 is the
// top boundary). Pure geometry, no drawing.
function cornerDots(geom, cx, cy, r, rule) {
  const dots = [];
  ballRows(geom, cx, cy, r).forEach((row, b) => {
    for (const p of row) {
      if (Math.abs(p.lam) > rule.lamMax || p.n[2] < rule.zMin || p.y - cy > rule.maxY * r) continue;
      dots.push({ x: p.x, y: p.y, row: b, z: p.n[2] });
    }
  });
  return dots;
}

// One warm light: a soft gold halo with a pale core and a white centre.
// Sized to still read as a warm speckle at map size on a phone.
function paintLight(g, x, y, u) {
  g.fillStyle(GOLD, 0.38);
  g.fillCircle(x, y, 4.4 * u);
  g.fillStyle(GOLD_PALE, 1);
  g.fillCircle(x, y, 2.3 * u);
  g.fillStyle(WHITE, 1);
  g.fillCircle(x, y, 1.1 * u);
}

// Paints into a cached texture once, then hands back an Image of it.
// (x0, y0) is where the texture's top left lands in the caller's space; the
// paint callback draws in that same space.
function bakeImage(scene, key, x0, y0, w, h, paint) {
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.translateCanvas(-x0, -y0);
    paint(g);
    g.generateTexture(key, Math.ceil(w), Math.ceil(h));
    g.destroy();
  }
  return scene.add.image(x0, y0, key).setOrigin(0, 0);
}

// ── The map node ────────────────────────────────────────────────────────────

// The whole node in local units (u = R / 62), centred on (0, 0). The ball
// sits wholly inside the dusk card so its round outline is always bright on
// dark, the way the real one stands against the evening sky.
const BALL_Y = -16;
const BALL_R = 44;

function paintNode(g, u, lit) {
  const s = (v) => v * u;
  const cuts = (list, dx = 4, dy = 6) => paper(g, s(dx), s(dy), (gg, shadow) => {
    for (const [color, x, y, w, h, rad] of list) { ink(gg, shadow, color); gg.fillRoundedRect(s(x), s(y), s(w), s(h), s(rad)); }
  });

  // The ground shadow.
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(0, s(54), s(136), s(18));

  // The dusk card, a little dusk sky on it, a few plain dot stars.
  cuts([[DUSK, -64, -64, 128, 108, 18]]);
  sky(g, s(-64), s(-40), s(128), s(76), [[0, DUSK], [0.4, MAUVE], [0.78, ROSE], [1, AFTERGLOW]]);
  stars(g, [[s(-52), s(-50), s(1.7), 0.9], [s(53), s(-52), s(1.5), 0.85], [s(-55), s(-28), s(1.2), 0.6], [s(52), s(-34), s(1.1), 0.6]], STAR);

  // A slim tower either side behind the base, a few windows on.
  cuts([[TOWER, 48, -20, 10, 38, 2], [TOWER, -59, -8, 10, 26, 2]], 2, 3);
  g.fillStyle(LAMP, 0.9);
  for (const [x, y] of [[50, -14], [54, -8], [50, 0], [-57, -2], [-53, 6]]) g.fillRect(s(x), s(y), s(2), s(2.5));

  // Lit: a soft warm glow behind the ball, plain ellipses.
  if (lit) {
    g.fillStyle(GOLD, 0.3);
    g.fillEllipse(0, s(BALL_Y), s(126), s(96));
    g.fillStyle(GOLD_PALE, 0.26);
    g.fillEllipse(0, s(BALL_Y), s(108), s(94));
  }

  // The ball.
  paintBall(g, 0, s(BALL_Y), s(BALL_R), NODE_BALL, lit ? 'lit' : 'dark');

  // The splayed white struts, from the ball's lower flanks down to the roof.
  paper(g, s(2), s(3), (gg, shadow) => {
    inkLine(gg, shadow, s(2.6), FRAME);
    for (const k of [-1, 1]) {
      gg.lineBetween(s(38 * k), s(6), s(62 * k), s(16));
      gg.lineBetween(s(38 * k), s(6), s(49 * k), s(16));
    }
  });

  // The collar the ball sits on, then the low base building with its red trim
  // and a row of warm windows.
  cuts([[RED, -22, 9, 44, 10, 4]]);
  cuts([[BASE, -62, 15, 124, 21, 5]]);
  cuts([[BASE_SHADE, -62, 15, 124, 4, 2], [RED, -62, 29, 124, 7, 3]], 0, 2);
  g.fillStyle(lit ? LAMP : LAMP_DIM, 1);
  for (const x of [-54, -43, -32, -21, 14, 25, 36, 47]) g.fillRoundedRect(s(x), s(21), s(7), s(5), s(1.5));
  g.fillRoundedRect(s(-7), s(20), s(14), s(9), s(2));

  // The water along the front, overhanging the card.
  paper(g, 0, s(5), (gg, shadow) => { ink(gg, shadow, WATER); gg.fillRoundedRect(s(-70), s(34), s(140), s(18), s(9)); });
  g.fillStyle(WATER_HI, 0.8);
  g.fillRoundedRect(s(-64), s(36.5), s(128), s(1.8), s(0.9));
  // The reflection. Lit: the dome's lights again as broken warm streaks,
  // gold and white. Dark: a faint silver smudge.
  if (lit) {
    const streaks = [
      [-30, 26, GOLD, 0.95], [2, 26, WHITE, 0.85],
      [-24, 18, GOLD_PALE, 0.8], [0, 20, GOLD, 0.8],
      [-18, 14, GOLD, 0.65], [2, 12, WHITE, 0.6],
      [-10, 18, GOLD_PALE, 0.5]
    ];
    streaks.forEach(([x, w, color, a], i) => {
      g.fillStyle(color, a);
      g.fillRoundedRect(s(x), s(39.5 + Math.floor(i / 2) * 2.4), s(w), s(1.5), s(0.75));
    });
  } else {
    g.fillStyle(0xc9cce0, 0.32);
    g.fillEllipse(0, s(43), s(64), s(8));
  }
  // The windows' warm glints.
  g.fillStyle(LAMP, lit ? 0.75 : 0.55);
  for (const [x, y, w] of [[-54, 40, 14], [-40, 46, 9], [34, 40, 14], [44, 46, 10]]) g.fillRoundedRect(s(x), s(y), s(w), s(1.8), s(0.9));
}

/**
 * The Science Dome on the map: the silver ball on its base on a dusk card,
 * the water along the front. Found = lights off (dusk silver); won = lights
 * on (warm gold and white dots at the panel corners, a soft warm glow and
 * warm streaks in the water). About 140 by 120 px at R 62, the same box as
 * the other secret nodes; no round halo (a circle behind a round ball blurs
 * the one outline that has to read). All drawing scales with R / 62, so
 * R 186 is a crisp 3x.
 * The static art is baked once per state and size into a cached texture;
 * only the lit dots layer is live (a slow breathe).
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 * @param {number} [R=62] node radius (NODE_R on the map)
 * @param {{lit?: boolean}} [opts] lit once the race is won
 * @returns {Phaser.GameObjects.Container}
 */
export function drawScienceDomeNode(scene, x, y, R = 62, { lit = false } = {}) {
  const u = R / 62;
  const half = Math.ceil(76 * u);
  const tag = `${lit ? 'lit' : 'dark'}_${Math.round(R)}`;
  const c = scene.add.container(x, y);
  c.add(bakeImage(scene, 'scienceDomeNode_' + tag, -half, -half, half * 2, half * 2, (g) => paintNode(g, u, lit)));
  if (lit) {
    const dots = cornerDots(NODE_BALL, 0, BALL_Y * u, BALL_R * u, NODE_DOTS);
    const layer = bakeImage(scene, 'scienceDomeNodeDots_' + tag, -half, -half, half * 2, half * 2, (g) => {
      for (const d of dots) paintLight(g, d.x, d.y, u);
    });
    c.add(layer);
    const breathe = scene.tweens.add({
      targets: layer,
      alpha: { from: 1, to: 0.6 },
      duration: 1700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    c.once('destroy', () => breathe.remove());
  }
  return c;
}

// ── The paper map glyph ─────────────────────────────────────────────────────

/**
 * The flat ink glyph the paper map shows before the dome is found: the ball,
 * its bottom cut flat just above the roof, on a low base block (a block, not
 * thin lines, so it never reads as a sun on the horizon, and no struts,
 * which at glyph size float free of the ball like short rays). The two
 * pieces do not overlap, so the ink never doubles up. Same ink and alpha as
 * the sheet's other glyphs.
 * @param {Phaser.GameObjects.Graphics} g
 * @param {number} x centre
 * @param {number} y the roof line (top of the base block)
 * @param {{r?: number, color?: number, alpha?: number}} [opts]
 * @returns {Phaser.GameObjects.Graphics}
 */
export function drawDomeLandmark(g, x, y, opts = {}) {
  const r = opts.r ?? 14;
  const color = opts.color ?? 0x4a3b2c;
  const alpha = opts.alpha ?? 0.34;
  const cut = 0.6;                         // the flat bottom, as a share of r below the centre
  const gap = Math.max(1.5, r * 0.12);
  const cy = y - gap - r * cut;
  const a = Math.asin(cut);
  ink(g, false, color, alpha);
  g.beginPath();
  g.arc(x, cy, r, a, Math.PI - a, true);
  g.closePath();
  g.fillPath();
  g.fillRoundedRect(x - r * 1.6, y, r * 3.2, r * 0.66, Math.min(3, r * 0.2));
  return g;
}

// ── The race backdrop ───────────────────────────────────────────────────────

// Laid out on the 1080 by 1920 canvas around the belt scene's HUD: the mode
// title, place name, counter and stamp label sit in the dark sky up top, the
// time bar and the quota meter stack under them (to about y 500), and the
// belt runs y 695 to 945. The dome stands whole in the band between, across
// the water, with a strip of water in front of it above the belt.
// Below the belt: the water with the dome's reflection stretched down it, the
// seawall railing and a dark promenade, kept calm for the keypad and the bins.
const RACE = {
  cx: 540, cy: 572, r: 78,      // the ball
  shore: 670,                   // the far shore line and the pier's waterline
  railTop: 1000,                // the seawall railing in the foreground
  wallTop: 1060,                // the seawall's cap stone; promenade below
  reflectR: 170                 // the reflection's height: stretched by the ripples
};

// The ball's proportions follow the node (ball r 44 there): k is px per node unit.
function raceParts() {
  const { cx, cy, r } = RACE;
  const k = r / BALL_R;
  return {
    k,
    collar: { x: cx - 22 * k, y: cy + 25 * k, w: 44 * k, h: 10 * k },
    base: { x: cx - 62 * k, y: cy + 31 * k, w: 124 * k, h: 21 * k }
  };
}

// The sky, the far shore and its towers: everything behind the dome's glow.
function paintRaceBack(g) {
  const W = 1080;
  // A smooth dusk from deep violet overhead to a warm afterglow on the far
  // shore, as many thin flat bands (a baked texture has no gradients).
  const stops = [[0, 0x1b1738], [0.4, 0x2a2358], [0.64, 0x3f3474], [0.8, 0x5a4486], [0.91, 0x8a5c86], [1, 0xbf7c74]];
  const H = RACE.shore + 10;
  const step = 6;
  for (let y = 0; y < H; y += step) {
    const t = y / H;
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    g.fillStyle(mix(c0, c1, (t - t0) / (t1 - t0)), 1);
    g.fillRect(0, y, W, step + 1);
  }
  // A few plain dot stars, kept out to the sides.
  stars(g, [
    [70, 170, 3, 0.8], [180, 300, 2.4, 0.6], [120, 420, 2, 0.45], [260, 90, 2.2, 0.55],
    [930, 150, 3, 0.8], [1010, 280, 2.2, 0.6], [860, 380, 2, 0.45], [820, 70, 2.4, 0.55],
    [400, 250, 1.8, 0.35], [690, 330, 1.8, 0.35]
  ], STAR);
  // The afterglow low on the far shore, a plain wide ellipse.
  g.fillStyle(AFTERGLOW, 0.14);
  g.fillEllipse(540, RACE.shore - 20, 1400, 260);

  // The towers across the water, dark against the dusk, a few windows on.
  const towers = [
    // [centre x, width, top y, colour]
    [40, 84, 478, 0x2c2757], [128, 70, 548, 0x332d62], [214, 86, 508, 0x2c2757], [300, 62, 594, 0x352f66],
    [790, 60, 598, 0x352f66], [868, 84, 513, 0x2c2757], [952, 68, 460, 0x332d62], [1040, 90, 538, 0x2c2757]
  ];
  paper(g, 3, 4, (gg, shadow) => {
    for (const [x, w, top, color] of towers) {
      ink(gg, shadow, color);
      gg.fillRoundedRect(x - w / 2, top, w, RACE.shore - top + 6, 6);
    }
  });
  g.fillStyle(LAMP, 0.7);
  towers.forEach(([x, w, top], ti) => {
    for (let row = 0; top + 22 + row * 30 < RACE.shore - 16; row++) {
      for (let col = 0; col < 3; col++) {
        if ((ti * 5 + row * 3 + col * 7) % 9 > 1) continue;
        g.fillRect(x - w / 2 + 12 + col * ((w - 30) / 2), top + 22 + row * 30, 7, 9);
      }
    }
  });
  // The far shore itself, a low dark strip the towers stand on.
  g.fillStyle(0x221d46, 1);
  g.fillRect(0, RACE.shore - 8, W, 22);
}

// The dome's warm glow, shown as the lights come on (alpha follows progress):
// one plain ellipse that fades smoothly to nothing at its edge, painted as a
// real gradient on a canvas so no rings show.
const GLOW_W = RACE.r * 4.4, GLOW_H = RACE.r * 3.6;
function glowTexture(scene, key) {
  if (!scene.textures.exists(key)) {
    const w = Math.ceil(GLOW_W), h = Math.ceil(GLOW_H);
    const tex = scene.textures.createCanvas(key, w, h);
    const ctx = tex.getContext();
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1, h / w);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
    grad.addColorStop(0, 'rgba(255, 233, 176, 0.55)');
    grad.addColorStop(0.45, 'rgba(255, 217, 138, 0.3)');
    grad.addColorStop(1, 'rgba(255, 217, 138, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-w / 2, -w / 2, w, w);
    ctx.restore();
    tex.refresh();
  }
  return key;
}

// Water rows under the dome: y and half width of the stretched reflection.
function reflectionRows(pitch, inset) {
  const { cx, r, shore, reflectR } = RACE;
  const rows = [];
  for (let y = shore + 8; y < shore + reflectR * 2; y += pitch) {
    const dy = (y - (shore + reflectR)) / reflectR;
    if (Math.abs(dy) >= 1) continue;
    rows.push({ y, half: r * Math.sqrt(1 - dy * dy) * inset, dy, cx });
  }
  return rows;
}

// Back half of the dome: the water with the dome's silver reflection, the
// pier, and the ball with its unlit bulbs (dark sockets, so the kid can see
// where the lights will go).
function paintRaceDome(g, dots) {
  const { cx, cy, r, shore } = RACE;
  const { base } = raceParts();
  const W = 1080;

  // The water, deepening toward the seawall, and a few pale glints.
  const waterBot = RACE.wallTop + 6;
  const bands = 18;
  for (let i = 0; i < bands; i++) {
    const y0 = shore + (waterBot - shore) * (i / bands);
    const y1 = shore + (waterBot - shore) * ((i + 1) / bands);
    g.fillStyle(mix(0x3b4178, 0x1c1c40, i / (bands - 1)), 1);
    g.fillRect(0, y0, W, y1 - y0 + 1);
  }
  // The dome in the water: a faint silver column in broken strips.
  g.fillStyle(0xa3a7c6, 0.1);
  for (const row of reflectionRows(22, 0.9)) g.fillRoundedRect(row.cx - row.half, row.y, row.half * 2, 9, 4.5);
  g.fillStyle(0x8f93b8, 0.14);
  for (const [x, y, w] of [[90, 690, 120], [300, 960, 90], [760, 980, 110], [930, 684, 90], [120, 1020, 80], [950, 1030, 100], [480, 1044, 70]]) {
    g.fillRoundedRect(x, y, w, 5, 2.5);
  }

  // The pier the base stands on.
  paper(g, 0, 6, (gg, shadow) => {
    ink(gg, shadow, 0x2e2952);
    gg.fillRoundedRect(base.x - 22, shore - 6, base.w + 44, 16, 6);
  });

  paintBall(g, cx, cy, r, RACE_BALL, 'race');
  paintSockets(g, dots);
}

function paintSockets(g, dots) {
  g.fillStyle(0x24204a, 0.55);
  for (const d of dots) g.fillCircle(d.x, d.y, 3);
}

// Front half of the dome: struts, collar and base building, as on the node.
function paintRaceBase(g) {
  const { cx, cy, shore } = RACE;
  const { k, collar, base } = raceParts();
  paper(g, 2 * k, 3 * k, (gg, shadow) => {
    inkLine(gg, shadow, 2.6 * k, 0xd9d5e6);
    for (const s of [-1, 1]) {
      gg.lineBetween(cx + 38 * k * s, cy + 22 * k, cx + 62 * k * s, cy + 32 * k);
      gg.lineBetween(cx + 38 * k * s, cy + 22 * k, cx + 49 * k * s, cy + 32 * k);
    }
  });
  const cuts = (list, dx = 4 * k / 3, dy = 6 * k / 3) => paper(g, dx, dy, (gg, shadow) => {
    for (const [color, x, y, w, h, rad] of list) { ink(gg, shadow, color); gg.fillRoundedRect(x, y, w, h, rad); }
  });
  // At dusk the cream walls sit in shade: the node's colours, a step darker.
  cuts([[0xb8413a, collar.x, collar.y, collar.w, collar.h, 4 * k]]);
  cuts([[0xb9b1ab, base.x, base.y, base.w, base.h, 5 * k]]);
  cuts([[0xa39b98, base.x, base.y, base.w, 4 * k, 2 * k], [0xb8413a, base.x, base.y + 14 * k, base.w, 7 * k, 3 * k]], 0, 2 * k / 3);
  g.fillStyle(LAMP, 0.9);
  for (const x of [-54, -43, -32, -21, 14, 25, 36, 47]) g.fillRoundedRect(cx + x * k, base.y + 6 * k, 7 * k, 5 * k, 1.5 * k);
  g.fillRoundedRect(cx - 7 * k, base.y + 5 * k, 14 * k, 9 * k, 2 * k);
  // The windows' warm glints on the water beside the pier.
  g.fillStyle(LAMP, 0.4);
  for (const [x, w] of [[-100, 22], [-72, 12], [78, 22], [100, 14]]) g.fillRoundedRect(cx + x * k, shore + 12, w * k, 4, 2);
}

// The dome's lights in the water, broken warm streaks down the reflection
// (alpha follows progress).
function paintRaceStreaks(g) {
  const colors = [GOLD, GOLD_PALE, GOLD, WHITE];
  reflectionRows(15, 0.78).forEach((row, i) => {
    // Two or three pieces per line, deterministic, so it reads as water.
    const pieces = 2 + (i % 2);
    for (let p = 0; p < pieces; p++) {
      const a = -row.half + (2 * row.half) * (p / pieces) + ((i * 37 + p * 23) % 16);
      const w = (2 * row.half) / pieces - 14 - ((i * 13 + p * 7) % 14);
      if (w < 8) continue;
      g.fillStyle(colors[(i + p) % colors.length], 0.3 + 0.35 * (1 - Math.abs(row.dy)));
      g.fillRoundedRect(row.cx + a, row.y, w, 5, 2.5);
    }
  });
}

// The seawall in the foreground: railing, cap stone, the promenade.
function paintRaceFront(g) {
  const W = 1080;
  const { railTop, wallTop } = RACE;
  const RAIL = 0x15122c;
  // The promenade: plain dark paving with faint seams.
  g.fillStyle(0x1f1a3a, 1);
  g.fillRect(0, wallTop, W, 1920 - wallTop);
  g.fillStyle(0x000000, 0.14);
  for (let y = wallTop + 90; y < 1920; y += 140) g.fillRect(0, y, W, 3);
  // The cap stone along the wall's top.
  paper(g, 0, 8, (gg, shadow) => {
    ink(gg, shadow, 0x3a3460);
    gg.fillRect(0, wallTop, W, 24);
  });
  g.fillStyle(0x5a5384, 1);
  g.fillRect(0, wallTop, W, 4);
  // The railing: two rails and a post every 120 px, one plain silhouette.
  paper(g, 3, 4, (gg, shadow) => {
    ink(gg, shadow, RAIL);
    gg.fillRoundedRect(-10, railTop, W + 20, 10, 5);
    gg.fillRoundedRect(-10, railTop + 34, W + 20, 7, 3.5);
    for (let x = 40; x < W; x += 120) gg.fillRoundedRect(x - 5, railTop - 4, 10, wallTop - railTop + 6, 4);
  });
}

// The light textures (44 px, drawn smaller on the ball): a soft warm light,
// and a white one for the win show.
const LIGHT_PX = 44;
function lightTexture(scene, key, halo, core) {
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(halo, 0.16); g.fillCircle(22, 22, 21);
    g.fillStyle(halo, 0.3); g.fillCircle(22, 22, 13);
    g.fillStyle(core, 1); g.fillCircle(22, 22, 7.5);
    g.fillStyle(WHITE, 1); g.fillCircle(22, 22, 3.6);
    g.generateTexture(key, LIGHT_PX, LIGHT_PX);
    g.destroy();
  }
  return key;
}

/**
 * The race backdrop: the dome at dusk seen from the seawall across the
 * water. Violet dusk sky with a warm afterglow, a few quiet towers, the full
 * silver ball on its base on a pier, the water with the dome's reflection,
 * and the seawall railing and a dark promenade in the foreground. Opaque and
 * full screen: it replaces the belt scene's own gradient, light pool, back
 * wall, night scrim and plank floor.
 * Laid out for 1080 by 1920 around the belt HUD: the ball is centred at
 * (540, 572), r 78, so the whole dome stands between a quota meter placed
 * right below the time bar (plate bottom about y 500) and the belt (y 695).
 * Another size scales the whole picture to cover.
 *
 * setProgress(frac) lights the dome's 48 corner lights warm gold, bottom row
 * up and each row from the middle out, so with 48 crates each crate lights
 * one; the panels warm up, the glow and the gold streaks in the water rise
 * with it. One to three new lights pop in; a bigger jump sets them at once.
 * playWinShow(onDone) runs a short gold and white light show on the dome
 * only (about 3 s, smaller than the W38 finale), then calls onDone.
 * destroy() removes everything (a pending show's onDone is dropped).
 * @param {Phaser.Scene} scene
 * @param {{width?: number, height?: number, depth?: number}} [opts]
 * @returns {{objects: Phaser.GameObjects.GameObject[], setProgress: (frac: number) => void,
 *   playWinShow: (onDone?: () => void) => void, destroy: () => void,
 *   dome: {x: number, y: number, r: number}}}
 */
export function createDomeRaceBackdrop(scene, { width = 1080, height = 1920, depth = -10 } = {}) {
  const root = scene.add.container(0, 0).setDepth(depth);
  const scale = Math.max(width / 1080, height / 1920);
  root.setScale(scale);
  root.x = (width - 1080 * scale) / 2;
  root.y = (height - 1920 * scale) / 2;

  const { cx, cy, r } = RACE;
  // The 48 lights in lighting order: bottom row first, each row from the
  // middle out, left before right.
  const dots = cornerDots(RACE_BALL, cx, cy, r, RACE_DOTS)
    .sort((a, b) => (b.row - a.row) || (Math.abs(a.x - cx) - Math.abs(b.x - cx)) || (a.x - b.x));
  const lightScale = (r * 0.3) / LIGHT_PX;

  const ballBox = [cx - r - 20, cy - r - 20, (r + 20) * 2, (r + 20) * 2];
  const back = bakeImage(scene, 'scienceDomeRaceBack', 0, 0, 1080, RACE.shore + 14, paintRaceBack);
  const glow = scene.add.image(cx, cy, glowTexture(scene, 'scienceDomeRaceGlow')).setAlpha(0);
  const domeTop = cy - r - 20;
  const dome = bakeImage(scene, 'scienceDomeRaceDome', 0, domeTop, 1080, RACE.wallTop + 10 - domeTop, (g) => paintRaceDome(g, dots));
  const warm = bakeImage(scene, 'scienceDomeRaceWarm', ...ballBox, (g) => {
    paintBall(g, cx, cy, r, RACE_BALL, 'raceLit', false);
    paintSockets(g, dots);
  }).setAlpha(0);
  const streakTop = RACE.shore + 6;
  const streaks = bakeImage(scene, 'scienceDomeRaceStreaks', cx - r, streakTop, r * 2, RACE.reflectR * 2 + 4, paintRaceStreaks).setAlpha(0);
  const baseImg = bakeImage(scene, 'scienceDomeRaceBase', cx - r * 2.4, cy, r * 4.8, RACE.shore + 20 - cy, paintRaceBase);
  const goldKey = lightTexture(scene, 'scienceDomeLightGold', GOLD, GOLD_PALE);
  const whiteKey = lightTexture(scene, 'scienceDomeLightWhite', WHITE, WHITE);
  const lights = dots.map(d => scene.add.image(d.x, d.y, goldKey).setScale(lightScale).setAlpha(0));
  const flashes = dots.map(d => scene.add.image(d.x, d.y, whiteKey).setScale(lightScale).setAlpha(0));
  const front = bakeImage(scene, 'scienceDomeRaceFront', 0, RACE.railTop - 10, 1080, 1920 - (RACE.railTop - 10), paintRaceFront);
  root.add([back, glow, dome, warm, streaks, baseImg, ...lights, ...flashes, front]);

  let lit = 0;
  let showTimer = null;
  const settle = (n) => {
    lights.forEach((img, i) => {
      scene.tweens.killTweensOf(img);
      img.setAlpha(i < n ? 1 : 0).setScale(lightScale);
    });
  };
  const setAmbient = (frac) => {
    glow.setAlpha(Math.min(1, frac * 1.1));
    warm.setAlpha(Math.min(1, frac));
    streaks.setAlpha(Math.min(1, frac));
  };

  return {
    objects: [root],
    dome: { x: root.x + cx * scale, y: root.y + cy * scale, r: r * scale },

    setProgress(frac) {
      const f = Math.max(0, Math.min(1, Number(frac) || 0));
      const n = Math.round(f * lights.length);
      if (n === lit) return;
      if (n > lit && n - lit <= 3) {
        for (let i = lit; i < n; i++) {
          const img = lights[i];
          scene.tweens.killTweensOf(img);
          img.setAlpha(0).setScale(lightScale * 2.2);
          scene.tweens.add({ targets: img, alpha: 1, scale: lightScale, duration: 320, ease: 'Back.easeOut' });
        }
      } else {
        settle(n);
      }
      lit = n;
      setAmbient(f);
    },

    playWinShow(onDone) {
      if (showTimer) return;
      lit = lights.length;
      settle(lit);
      setAmbient(1);
      const rows = dots.map(d => d.row);
      const lo = Math.min(...rows), hi = Math.max(...rows);
      // Two white waves through the lights: up from the bottom row, then back
      // down from the top. Each light flares white and settles gold. Each
      // beat starts only once the one before has finished with every light.
      const STEP = 80, FLARE = 240, HOLD = 100;
      const span = (hi - lo) * STEP + FLARE * 2 + HOLD;
      const wave = (startMs, upward) => flashes.forEach((img, i) => {
        const step = upward ? hi - dots[i].row : dots[i].row - lo;
        scene.tweens.add({
          targets: img,
          alpha: { from: 0, to: 1 },
          scale: { from: lightScale * 1.7, to: lightScale },
          delay: startMs + step * STEP,
          duration: FLARE,
          yoyo: true,
          hold: HOLD,
          ease: 'Sine.easeOut'
        });
      });
      const down = span + 60;
      const together = down + span + 60;
      wave(0, true);
      wave(down, false);
      // Last beat: every light flares white together, then warm gold stays on.
      flashes.forEach((img) => scene.tweens.add({
        targets: img, alpha: { from: 0, to: 0.9 }, scale: lightScale * 1.25, delay: together, duration: 220, yoyo: true, hold: 80, ease: 'Sine.easeOut'
      }));
      // The glow swells once and settles; the water streaks shimmer with it.
      glow.setScale(1);
      scene.tweens.add({ targets: glow, scale: 1.12, duration: together / 2, yoyo: true, ease: 'Sine.easeInOut' });
      scene.tweens.add({ targets: streaks, alpha: { from: 1, to: 0.55 }, duration: together / 4, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
      showTimer = scene.time.delayedCall(together + 600, () => {
        showTimer = null;
        if (onDone) onDone();
      });
    },

    destroy() {
      if (showTimer) { showTimer.remove(false); showTimer = null; }
      for (const obj of [glow, streaks, ...lights, ...flashes]) scene.tweens.killTweensOf(obj);
      root.destroy();
    }
  };
}

// ── The quota meter ─────────────────────────────────────────────────────────

/**
 * The quota strip: `total` small triangles in two interlocking rows, like a
 * band of the dome's panels, on a dark plate. Dusk silver until lit; each
 * correct crate lights the next one warm gold with a small pop. Fills left to
 * right, bottom and top of each column in turn. (x, y) is the centre;
 * width and height are the panel band (the plate adds a little margin).
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 * @param {{total?: number, width?: number, height?: number, depth?: number}} [opts]
 * @returns {{container: Phaser.GameObjects.Container,
 *   setCount: (n: number, opts?: {animate?: boolean}) => void, destroy: () => void}}
 */
export function createDomeQuotaMeter(scene, x, y, { total = 48, width = 600, height = 80, depth = 20 } = {}) {
  const container = scene.add.container(x, y).setDepth(depth);
  const cols = Math.ceil(total / 2);
  const b = width / ((cols + 1) / 2);          // one panel's base
  const rowH = height / 2;
  const left = -width / 2;
  const inset = Math.max(1.5, b * 0.07);

  // The panels in lighting order. Column k holds a bottom and a top panel
  // over the same span; they point opposite ways, so the band interlocks.
  const tris = [];
  for (let k = 0; k < cols; k++) {
    const x0 = left + k * b / 2;
    for (const row of [1, 0]) {                // bottom first, then top
      if (tris.length >= total) break;
      const yTop = row === 0 ? -rowH : 0;
      const pointsUp = (k % 2 === 0) === (row === 1);
      const pts = pointsUp
        ? [[x0, yTop + rowH], [x0 + b, yTop + rowH], [x0 + b / 2, yTop]]
        : [[x0, yTop], [x0 + b, yTop], [x0 + b / 2, yTop + rowH]];
      const c = [(pts[0][0] + pts[1][0] + pts[2][0]) / 3, (pts[0][1] + pts[1][1] + pts[2][1]) / 3];
      tris.push({ c, row, pts });
    }
  }
  // A triangle shrunk toward its centre (the gap between panels), relative to
  // `origin` so the pop can be drawn around its own centre.
  const shrunk = (t, by, origin = [0, 0]) => t.pts.map(([px, py]) => {
    const dx = px - t.c[0], dy = py - t.c[1];
    const len = Math.hypot(dx, dy) || 1;
    const s = Math.max(0, (len - by) / len);
    return [t.c[0] + dx * s - origin[0], t.c[1] + dy * s - origin[1]];
  });
  const fill = (g, p) => g.fillTriangle(p[0][0], p[0][1], p[1][0], p[1][1], p[2][0], p[2][1]);

  // The plate, with the cutout shadow, so the strip reads over any backdrop.
  const plate = scene.add.graphics();
  const padX = Math.max(12, b * 0.4), padY = Math.max(10, rowH * 0.3);
  plate.fillStyle(0x000000, 0.22);
  plate.fillRoundedRect(-width / 2 - padX + 4, -height / 2 - padY + 6, width + padX * 2, height + padY * 2, 18);
  plate.fillStyle(0x1d1940, 0.9);
  plate.fillRoundedRect(-width / 2 - padX, -height / 2 - padY, width + padX * 2, height + padY * 2, 18);

  // The unlit panels, dusk silver, the top row a touch lighter like the ball.
  const unlit = scene.add.graphics();
  for (const t of tris) {
    unlit.fillStyle(t.row === 0 ? 0x6e72a0 : 0x5b5f8e, 1);
    fill(unlit, shrunk(t, inset));
  }
  const litLayer = scene.add.graphics();
  container.add([plate, unlit, litLayer]);

  let count = 0;
  const pops = [];
  const drawLit = () => {
    litLayer.clear();
    for (let i = 0; i < count; i++) {
      const t = tris[i];
      litLayer.fillStyle(GOLD, 1);
      fill(litLayer, shrunk(t, inset));
      // A small pale centre, so it reads as a light that is on.
      litLayer.fillStyle(GOLD_PALE, 1);
      fill(litLayer, shrunk(t, inset + Math.min(b, rowH) * 0.36));
    }
  };

  const pop = (t) => {
    const g = scene.add.graphics();
    g.fillStyle(GOLD_PALE, 0.5);
    g.fillEllipse(0, 0, b * 1.3, rowH * 1.3);
    g.fillStyle(WHITE, 1);
    fill(g, shrunk(t, inset, t.c));
    g.setPosition(t.c[0], t.c[1]).setScale(1.9).setAlpha(1);
    container.add(g);
    pops.push(g);
    scene.tweens.add({
      targets: g, scale: 1, alpha: 0, duration: 340, ease: 'Quad.easeOut',
      onComplete: () => { pops.splice(pops.indexOf(g), 1); g.destroy(); }
    });
  };

  return {
    container,
    setCount(n, { animate = true } = {}) {
      const next = Math.max(0, Math.min(total, Math.floor(Number(n) || 0)));
      const prev = count;
      count = next;
      drawLit();
      if (animate && next > prev) for (let i = Math.max(prev, next - 3); i < next; i++) pop(tris[i]);
    },
    destroy() {
      for (const g of pops) scene.tweens.killTweensOf(g);
      container.destroy();
    }
  };
}

// ── The discovery crate's sticker ───────────────────────────────────────────

/**
 * A small round sticker with the dome on it, for the discovery crate on The
 * Seawall's belt: a cream paper disc with a dusk sky, the silver ball on its
 * collar and base, and a strip of water. Lights off (it is found, not won).
 * @param {Phaser.GameObjects.Graphics} g
 * @param {number} x centre
 * @param {number} y centre
 * @param {number} size the sticker's diameter in px (about 100 on a crate)
 * @returns {Phaser.GameObjects.Graphics}
 */
export function drawDomeCrateSticker(g, x, y, size) {
  const R = size / 2;
  const inner = R * 0.84;
  // The sticker: a cream paper disc with the cutout shadow and a thin edge.
  g.fillStyle(0x000000, 0.22);
  g.fillCircle(x + R * 0.06, y + R * 0.1, R);
  g.fillStyle(0xb99f7a, 1);
  g.fillCircle(x, y, R);
  g.fillStyle(0xfff8e7, 1);
  g.fillCircle(x, y, R - Math.max(1.5, R * 0.05));
  // The dusk behind the dome.
  g.fillStyle(DUSK, 1);
  g.fillCircle(x, y, inner);
  g.fillStyle(MAUVE, 1);
  g.beginPath();
  const skyCut = Math.asin(0.05);
  g.arc(x, y, inner, skyCut, Math.PI - skyCut, false);
  g.closePath();
  g.fillPath();
  // The ball, its struts, collar and base, in node proportions.
  const br = R * 0.42;
  const bcy = y - R * 0.1;
  const k = br / BALL_R;
  paintBall(g, x, bcy, br, NODE_BALL, 'dark');
  g.lineStyle(Math.max(1, 2.6 * k), FRAME, 1);
  for (const s of [-1, 1]) {
    g.lineBetween(x + 38 * k * s, bcy + 22 * k, x + 58 * k * s, bcy + 32 * k);
    g.lineBetween(x + 38 * k * s, bcy + 22 * k, x + 49 * k * s, bcy + 32 * k);
  }
  g.fillStyle(RED, 1);
  g.fillRoundedRect(x - 22 * k, bcy + 25 * k, 44 * k, 10 * k, 3 * k);
  g.fillStyle(BASE, 1);
  g.fillRoundedRect(x - 58 * k, bcy + 31 * k, 116 * k, 21 * k, 4 * k);
  g.fillStyle(RED, 1);
  g.fillRoundedRect(x - 58 * k, bcy + 45 * k, 116 * k, 7 * k, 2 * k);
  g.fillStyle(LAMP_DIM, 1);
  for (const wx of [-48, -34, -20, 13, 27, 41]) g.fillRect(x + wx * k, bcy + 36 * k, 7 * k, 5 * k);
  // The water: the bottom of the dusk disc, cut straight across.
  const wy = bcy + 52 * k;
  const a = Math.asin(Math.min(0.99, (wy - y) / inner));
  g.fillStyle(WATER, 1);
  g.beginPath();
  g.arc(x, y, inner, a, Math.PI - a, false);
  g.closePath();
  g.fillPath();
  g.fillStyle(WATER_HI, 0.9);
  g.fillRoundedRect(x - inner * 0.5, wy + R * 0.08, inner, Math.max(1.5, R * 0.04), R * 0.02);
  return g;
}
