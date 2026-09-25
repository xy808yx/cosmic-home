// The Ride Down: the art for the game's last ending (Chapter 3, World 38).
//
// A close-up of the red cabin riding down the mountain at dusk, the pet at the
// window seat, while the city below lights up. The picture looks OUT from the
// mountain, so it faces south: west is on the RIGHT. Downtown sits centre left
// across the inlet, the big park and its long bridge to the right of it, the
// narrow creek behind downtown with the bread place just across it, the low
// leafy south side beyond with the garden and the grocery store, and the beach
// far right out on its point.
//
// Four flat paper layers move at their own speeds, back to front:
//   sky   the dusk sheet, tied to the horizon line (drawn live, a few bands)
//   far   the city across the water; it rises and grows as we come down
//   mid   the mountain's flank below the line, with the lit hiking trail
//   near  the stations, the two tall towers, the cable, the cabin and the pet
// The camera itself never moves. The near layer is one container that slides
// the other way, so anything the credits add stays in plain screen space.
//
// Speed: every detailed sheet (houses, towers, trees, the summit, the stations)
// is drawn ONCE into a canvas texture when the ride is built, then only moved,
// scaled or faded. The only things drawn live every frame are a handful of big
// flat shapes (sky bands, water, the flank), the cable, the cabin and the pet.
// Canvas textures come back by themselves after a lost WebGL context.
//
// Everything is cut paper: flat planes with a hard offset shadow, rounded
// corners, no outlines, and no gradient except the big sky. Glows are plain
// filled ellipses, lamps and stars are filled dots. Deterministic: no
// Math.random anywhere in the art.
//
// ---------------------------------------------------------------- the API
//
//   import { createRideDown, makeCaption, RIDE_BEATS, cabinAt, TOWER_T } from '../homeGround/rideDown.js';
//
//   const rd = createRideDown(scene, { petOpts, depth });
//     petOpts  extra drawCompanion options (default none, so the kid's own pet,
//              stage, accessory and aura come from the save)
//     depth    base depth (default 0). The ride uses depth to depth + 40;
//              put captions and buttons at depth + 80 or more.
//
//   rd.beats                   { summit: 0, places: 0.42, lamps: 0.6, city: 0.8, dock: 1 }
//   rd.setRide(p)              p from 0 (summit, cabin at the top dock) to 1
//                              (docked at the bottom). Moves the near layer, the
//                              parallax layers, the cabin and the dusk. Smooth
//                              for any p; it already eases in at 0 and out at 1,
//                              so tween p linearly. rd.ride is the current p.
//   rd.cabin                   the cabin container, pivoting at its carriage
//   rd.sway(amp = 1.6, period = 2800)   start a gentle sway (degrees, ms)
//   rd.settle(ms = 700)        ease the sway back to level. Promise.
//   rd.openDoor(ms = 260) / rd.closeDoor(ms = 260)   Promise
//   rd.pet                     the pet container (drawCompanion)
//   rd.board({ duration = 900 })   pet hops from the summit deck into the
//                              window seat. Promise. The door should be open.
//   rd.alight({ duration = 900 })  pet hops out onto the bottom deck. Promise.
//   rd.setPetAt(where)         'summit' | 'cabin' | 'dock', no animation
//   rd.lightPlace(id, ms = 450)    'store' | 'garden' | 'beach' | 'bread':
//                              its glow, windows, door and lamp come on. Promise.
//   rd.placeIds                ['store', 'garden', 'beach', 'bread']
//   rd.lampCount               10: tower lamps and trail lamps, top down
//   rd.lightLamp(i, ms = 320)  light lamp i (0 is the highest). Promise.
//   rd.lamps                   [{ where: 'tower1' | 'tower2' | 'trail', layer }]
//   rd.cityGroupCount          12
//   rd.lightCityGroup(i, ms = 380)  switch on one group of downtown windows,
//                              in the order the couplet should use. Promise.
//   rd.setShoreLights(a)       0 to 1: the seawall and creek lamps, the south
//                              side's house lights, the bridge's string of
//                              lights and the city's reflections in the water
//   rd.fadeShoreLights(a, ms = 1200)   the same, faded. Promise.
//   rd.lightEverything()       every place, lamp, group and shore light on now
//   rd.startIdle() / rd.stopIdle()     lamps and glows breathe, the cabin sways
//   rd.toScreen(x, y)          near-layer point to screen point
//   rd.textures                [{ key, w, h }] everything baked, and rd.textureBytes
//                              (the canvas copies only; the GPU holds one more)
//   rd.destroy()               removes every object, tween and baked texture
//
//   makeCaption(scene, text, { x = 540, y, px = 52, wrap = 960 }) returns a
//   container: the cream paper strip with dark ink and a hard offset shadow.
//
// Sounds are left to the credits timeline (soft chimes only).

import { ink, inkLine, paper, sky, ridge, treeline } from './paper.js';
import { style } from '../textStyles.js';
import { drawCompanion } from '../PetRenderer.js';
import { drawShip } from '../ShipRenderer.js';

const W = 1080;

// Palette. The World 38 anchors first, then this scene's own tints. The
// greens are lifted from the stills so the ride stays dusk, never near-black.
const DUSK = 0x4a3a80;
const MAUVE = 0x8a5f98;
const ROSE = 0xd98a7a;
const AFTERGLOW = 0xf0b489;
const INLET = 0x7a6aa8;
const WATER_B = 0x8a78bc;      // lighter violet bands, the water nearer to us
const WATER_C = 0x9684c6;
const CITY = 0x3a3868;
const TOWER = 0x403d70;
const TOWER_B = 0x4a4680;
const LAMP = 0xffe9a8;
const LAMP_OFF = 0x5a5680;
const PLACE_OFF = 0x5a5478;    // a named place's window before it lights
const DOOR_OFF = 0x6b4a34;
const DOOR_LIT = 0xffc46a;
const CITY_GLOW = 0xffd27a;
const RIDGE = 0x3f6150;        // the summit knoll
const MOUNTAIN = 0x3a5a4a;     // the rock under the summit deck
const TREE = 0x2f5040;
const TREE_B = 0x375a48;
const FLANK = 0x566a86;        // the mountain's flank far below, violet in the dusk air
const FLANK_TREE = 0x4b5e7c;
const FLANK_TREE_B = 0x62769a;
const TRAIL_CREAM = 0xe8d9ae;
const CHALET = 0x6b4a34;
const ROOF = 0x3d2b20;
const PEN = 0x5f7f4a;
const FENCE = 0xb89a72;
const RAIL = 0xd8bd93;
const BEAR = 0x6b4a2e;
const MUZZLE = 0xa8845c;
const BEAR_DARK = 0x2a1c12;
const PAW = 0x5a3d26;
const MAST = 0xe9ecf2;
const HOUSING = 0xd5d9e2;
const BLADE = 0xf5f7fa;
const CABLE = 0xc9c3e0;
const HANGER = 0x3a3a4a;
const WHEEL = 0x5a5a70;
const CABIN = 0xd94a3a;
const CABIN_ROOF = 0xb33f33;
const CABIN_TRIM = 0xf6ecd6;
const GLASS = 0xd9e7f4;
const GLASS_WARM = 0xffe7b8;
const STEEL = 0x8480ae;
const STEEL_DARK = 0x66628f;
const POST = 0x9aa0b8;
const TIMBER = 0x7a5638;
const DECK = 0x8a6a4a;
const DECK_TOP = 0xa8845c;
const CONCRETE = 0x8d88a8;
const FAR_HILLS = 0x5e4f8e;
const FAR_HILLS_B = 0x6a5a98;
const SNOW = 0xf3d9e0;
const SOUTH = 0x3f4570;
const SOUTH_TREE = 0x3b5a64;
const HOUSE = 0x565a8a;
const PARK = 0x3a6a4c;
const PARK_TREE = 0x325e44;
const BRIDGE = 0x6f9a88;
const SAND = 0xeed7a8;
const GARDEN = 0x6fa85a;
const GARDEN_TREE = 0x3f7a44;
const SHED = 0xc9a27a;
const SHOP_CREAM = 0xeadfc6;
const SHOP_TAN = 0xd99a55;
const LOAF = 0xe0a060;
const LOAF_DARK = 0xa86a30;
const PAPER_STRIP = 0xfff6e0;
const INK = '#3a2a20';

// ---------------------------------------------------------------- the cable

// The cable in near-layer coordinates. The top dock is where the cabin waits
// at the summit; the line runs down and to the right at about 30 degrees (the
// real slope) with a gentle sag between the two tall towers.
const TOP_DOCK = { x: 600, y: 860 };
const RUN = { x: 5000, y: 2750 };
/** Where the two tall towers stand on the cable, as t from 0 to 1. */
export const TOWER_T = [0.3, 0.645];
const SUPPORTS = [0, TOWER_T[0], TOWER_T[1], 1];
const SAG = [70, 60, 40];

/** Where the cabin's carriage sits on the cable at t (0 top dock, 1 bottom dock). */
export function cabinAt(t) {
  const tt = Math.max(0, Math.min(1, t));
  const p = { x: TOP_DOCK.x + RUN.x * tt, y: TOP_DOCK.y + RUN.y * tt };
  for (let i = 0; i < SUPPORTS.length - 1; i++) {
    const a = SUPPORTS[i];
    const b = SUPPORTS[i + 1];
    if (tt >= a && tt <= b) {
      const u = (tt - a) / (b - a);
      p.y += SAG[i] * 4 * u * (1 - u);
      break;
    }
  }
  return p;
}

// ---------------------------------------------------------------- the beats

// Each beat says where the carriage sits on the cable (t), where it sits on
// screen (sx, sy) and how big the cabin is (cs), where the far layer's centre
// and horizon sit and its scale (fx, fy, fs), where the flank sits (mx, my),
// and how far the dusk has deepened (night). setRide() runs a smooth curve
// through these. fy, fs, my and t only ever move one way, so nothing bobs.
const KEYS = [
  { name: 'summit', p: 0, t: 0, sx: 600, sy: 860, cs: 1, fx: 1100, fy: 1060, fs: 0.45, mx: -300, my: 1040, night: 0 },
  { name: 'places', p: 0.42, t: 0.45, sx: 330, sy: 330, cs: 0.9, fx: 330, fy: 800, fs: 0.9, mx: -60, my: 1100, night: 0.08 },
  { name: 'lamps', p: 0.6, t: 0.72, sx: 700, sy: 690, cs: 0.88, fx: 430, fy: 740, fs: 0.93, mx: -90, my: 1150, night: 0.14 },
  { name: 'city', p: 0.8, t: 0.86, sx: 720, sy: 1040, cs: 0.84, fx: 490, fy: 640, fs: 0.97, mx: -110, my: 1450, night: 0.2 },
  { name: 'dock', p: 1, t: 1, sx: 960, sy: 1150, cs: 0.78, fx: 420, fy: 540, fs: 1, mx: -130, my: 2000, night: 0.26 },
];
const CHANNELS = ['t', 'sx', 'sy', 'cs', 'fx', 'fy', 'fs', 'mx', 'my', 'night'];

/** The named ride positions, p from 0 to 1. */
export const RIDE_BEATS = Object.fromEntries(KEYS.map((k) => [k.name, k.p]));

// A smooth curve through the keys that never overshoots them (monotone cubic
// Hermite, the Fritsch and Carlson way). The ends are flat, so the cabin eases
// off the top dock and eases into the bottom one.
function curve(ps, vs) {
  const n = ps.length;
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((vs[i + 1] - vs[i]) / (ps[i + 1] - ps[i]));
  const m = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      m[i] = k * a * d[i];
      m[i + 1] = k * b * d[i];
    }
  }
  return (p) => {
    if (p <= ps[0]) return vs[0];
    if (p >= ps[n - 1]) return vs[n - 1];
    let i = 0;
    while (p > ps[i + 1]) i++;
    const h = ps[i + 1] - ps[i];
    const u = (p - ps[i]) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * vs[i] + (u3 - 2 * u2 + u) * h * m[i]
      + (-2 * u3 + 3 * u2) * vs[i + 1] + (u3 - u2) * h * m[i + 1];
  };
}

const CURVES = Object.fromEntries(CHANNELS.map((c) => [c, curve(KEYS.map((k) => k.p), KEYS.map((k) => k[c]))]));

function poseAt(p) {
  const o = {};
  for (const c of CHANNELS) o[c] = CURVES[c](p);
  return o;
}

// The near-layer offset at the bottom dock: the bottom station is drawn in
// dock-screen coordinates and shifted by this.
const DOCK = KEYS[KEYS.length - 1];
const DOCK_SCROLL = (() => { const c = cabinAt(1); return { x: c.x - DOCK.sx, y: c.y - DOCK.sy }; })();
const TOP_DECK_Y = TOP_DOCK.y + 480;
const BOTTOM_DECK_Y = DOCK.sy + 480 * DOCK.cs;   // in dock-screen coordinates

// ---------------------------------------------------------------- small shapes

function boxRow(g, dx, dy, color, boxes, r) {
  paper(g, dx, dy, (gg, s) => {
    ink(gg, s, color);
    for (const [x, y, w, h] of boxes) gg.fillRoundedRect(x, y, w, h, r);
  });
}

function poly(gg, pts) {
  gg.beginPath();
  gg.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) gg.lineTo(pts[i][0], pts[i][1]);
  gg.closePath();
  gg.fillPath();
}

// A filled polygon with every corner rounded: each corner is cut back by r
// along both edges and joined with a short curve sampled into straight steps.
function roundPoly(gg, pts, r) {
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[(i + n - 1) % n];
    const b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]) || 1;
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
    const ra = Math.min(r, la / 2);
    const rb = Math.min(r, lb / 2);
    const s = [p[0] + (a[0] - p[0]) / la * ra, p[1] + (a[1] - p[1]) / la * ra];
    const e = [p[0] + (b[0] - p[0]) / lb * rb, p[1] + (b[1] - p[1]) / lb * rb];
    for (let k = 0; k <= 6; k++) {
      const u = k / 6;
      const v = 1 - u;
      out.push([v * v * s[0] + 2 * v * u * p[0] + u * u * e[0], v * v * s[1] + 2 * v * u * p[1] + u * u * e[1]]);
    }
  }
  poly(gg, out);
}

function blade(gg, hx, hy, tx, ty, halfW) {
  const len = Math.hypot(tx - hx, ty - hy) || 1;
  const nx = -(ty - hy) / len * halfW;
  const ny = (tx - hx) / len * halfW;
  gg.fillTriangle(hx + nx, hy + ny, hx - nx, hy - ny, tx, ty);
}

// A thin rounded ribbon along a list of points (the trail, the bridge deck).
function ribbon(gg, pts, half) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = -(y1 - y0) / len * half;
    const ny = (x1 - x0) / len * half;
    poly(gg, [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]]);
  }
  for (const [x, y] of pts) gg.fillCircle(x, y, half);
}

// The mountain's flank top edge in mid-layer coordinates: it falls left to
// right at the line's slope, with a small deterministic wobble.
function flankEdge(x) {
  return 0.3 * x + ((Math.floor(x / 60) * 13) % 4 + 4) % 4 * 6;
}

// ---------------------------------------------------------------- summit props

// The wind turbine's mast and housing. The blades turn live on top.
function turbineMast(g, x, baseY, mastH, k) {
  const hy = baseY - mastH;
  paper(g, 4 * k, 6 * k, (gg, s) => {
    ink(gg, s, MAST);
    poly(gg, [[x - 9 * k, baseY], [x + 9 * k, baseY], [x + 4 * k, hy], [x - 4 * k, hy]]);
    ink(gg, s, HOUSING);
    gg.fillRoundedRect(x - 18 * k, hy - 9 * k, 36 * k, 18 * k, 7 * k);
  });
}

// The lit chalet: a soft glow, the body, a rounded roof, a row of lit
// windows, a door and a deck rail.
function chalet(g, x, groundY, w, h, roofH, n) {
  const top = groundY - h;
  g.fillStyle(LAMP, 0.18);
  g.fillEllipse(x, groundY - h * 0.25, w * 1.3, h * 0.9);
  boxRow(g, 5, 7, CHALET, [[x - w / 2, top, w, h]], 12);
  ridge(g, [[x - w / 2 - 18, top + 8], [x + w / 2 + 18, top + 8], [x, top - roofH]], ROOF, 5, 7, 7);
  const ww = 30;
  const gap = (w - 40 - n * ww) / (n - 1);
  g.fillStyle(LAMP, 1);
  for (let i = 0; i < n; i++) g.fillRoundedRect(x - w / 2 + 20 + i * (ww + gap), top + 22, ww, 34, 6);
  g.fillRoundedRect(x - 14, groundY - 44, 28, 44, 6);
  boxRow(g, 3, 4, TIMBER, [[x - w / 2 - 20, groundY - 6, w + 40, 12]], 5);
  g.lineStyle(4, RAIL, 1);
  g.lineBetween(x - w / 2 - 16, groundY - 26, x + w / 2 + 16, groundY - 26);
  g.fillStyle(RAIL, 1);
  for (let i = 0; i <= 8; i++) g.fillRect(x - w / 2 - 16 + i * (w + 32) / 8 - 2, groundY - 26, 4, 22);
}

function bear(g, bx, by, k, dir) {
  const hx = bx + dir * 36 * k;
  const hy = by - 23 * k;
  paper(g, 3, 4, (gg, s) => {
    ink(gg, s, BEAR);
    gg.fillEllipse(bx, by, 80 * k, 52 * k);
    gg.fillCircle(hx, hy, 19 * k);
    gg.fillCircle(hx - 11 * k, hy - 15 * k, 8 * k);
    gg.fillCircle(hx + 11 * k, hy - 15 * k, 8 * k);
  });
  g.fillStyle(MUZZLE, 1);
  g.fillEllipse(hx + dir * 10 * k, hy + 4 * k, 18 * k, 12 * k);
  g.fillStyle(BEAR_DARK, 1);
  g.fillCircle(hx + dir * 15 * k, hy + 3 * k, 3 * k);
  g.fillCircle(hx + dir * 2 * k, hy - 5 * k, 2.2 * k);
  g.fillStyle(PAW, 1);
  g.fillRoundedRect(bx - 28 * k, by + 16 * k, 15 * k, 14 * k, 4 * k);
  g.fillRoundedRect(bx + 8 * k, by + 16 * k, 15 * k, 14 * k, 4 * k);
}

// A tall steel lattice tower: two tapered legs, zigzag bracing, a cross arm
// where the cable rests, and a short lamp mast above. Returns the lamp spot.
function latticeTower(g, x, topY, footY) {
  const h = footY - topY;
  const topHalf = 34;
  const footHalf = 120;
  const legAt = (f, side) => x + side * (topHalf + (footHalf - topHalf) * f);
  paper(g, 5, 7, (gg, s) => {
    ink(gg, s, STEEL);
    for (const side of [-1, 1]) {
      poly(gg, [[legAt(0, side) - 7, topY], [legAt(0, side) + 7, topY], [legAt(1, side) + 9, footY], [legAt(1, side) - 9, footY]]);
    }
  });
  inkLine(g, false, 5, STEEL_DARK);
  const n = Math.max(4, Math.round(h / 110));
  for (let i = 0; i < n; i++) {
    const f0 = i / n;
    const f1 = (i + 1) / n;
    const y0 = topY + h * f0;
    const y1 = topY + h * f1;
    const a = i % 2 ? 1 : -1;
    g.lineBetween(legAt(f0, a), y0, legAt(f1, -a), y1);
    g.lineBetween(legAt(f1, -1), y1, legAt(f1, 1), y1);
  }
  boxRow(g, 4, 6, STEEL_DARK, [[x - 80, topY - 6, 160, 26]], 10);
  g.fillStyle(WHEEL, 1);
  g.fillCircle(x - 44, topY - 6, 13);
  g.fillCircle(x + 44, topY - 6, 13);
  boxRow(g, 3, 4, STEEL_DARK, [[x - 5, topY - 58, 10, 54], [x - 22, topY - 66, 44, 16]], 5);
  return { x, y: topY - 78 };
}

// ---------------------------------------------------------------- the four places

// The places card 3 names, in far-layer coordinates (their ground line). The
// bread place sits on the creek's south shore just across from downtown, the
// garden and the grocery store further south, the beach far west out on its
// point. Everything here is drawn half again as big as the first stills.
const K = 1.5;
const PLACES = {
  bread: { x: 660, y: 252, glow: 0.85 },
  garden: { x: 836, y: 132, glow: 1.0 },
  store: { x: 1004, y: 104, glow: 0.95 },
  beach: { x: 1214, y: 262, glow: 1.0 },
};
const PLACE_IDS = ['store', 'garden', 'beach', 'bread'];
// Each place bakes into a box this big around its ground point.
const PLACE_BOX = { dx: -200, dy: -230, w: 400, h: 260 };

// Every place is drawn twice: once unlit (the art that is always there) and
// once as just the parts that light up (windows, door, lamp), which fades in
// on top when card 3 names it.
function lampHead(g, x, y, r, lit) {
  if (lit) {
    g.fillStyle(LAMP, 0.45);
    g.fillEllipse(x, y, r * 5, r * 4);
    g.fillStyle(LAMP, 1);
  } else {
    g.fillStyle(LAMP_OFF, 1);
  }
  g.fillCircle(x, y, r);
}

function lampPost(g, x, groundY, h) {
  boxRow(g, 2, 3, POST, [[x - 3, groundY - h, 6, h]], 3);
}

function drawStore(g, x, y, lit) {
  const win = [[x - 50 * K, y - 30 * K, 38 * K, 24 * K], [x + 12 * K, y - 30 * K, 38 * K, 24 * K]];
  const door = [x - 8 * K, y - 32 * K, 16 * K, 32 * K];
  const lamp = [x + 76 * K, y - 64 * K];
  if (!lit) {
    paper(g, 4, 6, (gg, s) => {
      ink(gg, s, SHOP_CREAM);
      gg.fillRoundedRect(x - 62 * K, y - 66 * K, 124 * K, 66 * K, 10);
      ink(gg, s, CABIN);
      gg.fillRoundedRect(x - 40 * K, y - 84 * K, 80 * K, 20 * K, 8);
    });
    for (let i = 0; i < 6; i++) {
      g.fillStyle(i % 2 ? PAPER_STRIP : CABIN, 1);
      g.fillRect(x - 60 * K + i * 20 * K, y - 54 * K, 20 * K, 14 * K);
    }
    g.fillStyle(PLACE_OFF, 1);
    for (const [wx, wy, ww, wh] of win) g.fillRoundedRect(wx, wy, ww, wh, 5);
    g.fillStyle(DOOR_OFF, 1);
    g.fillRoundedRect(door[0], door[1], door[2], door[3], 4);
    lampPost(g, lamp[0], y, 64 * K);
    lampHead(g, lamp[0], lamp[1], 7, false);
    return;
  }
  g.fillStyle(LAMP, 1);
  for (const [wx, wy, ww, wh] of win) g.fillRoundedRect(wx, wy, ww, wh, 5);
  g.fillStyle(DOOR_LIT, 1);
  g.fillRoundedRect(door[0], door[1], door[2], door[3], 4);
  lampHead(g, lamp[0], lamp[1], 7, true);
}

function drawGarden(g, x, y, lit) {
  const win = [x - 62 * K, y - 36 * K, 14 * K, 11 * K];
  const door = [x - 44 * K, y - 36 * K, 12 * K, 22 * K];
  const lamp = [x + 70 * K, y - 58 * K];
  if (!lit) {
    paper(g, 3, 5, (gg, s) => {
      ink(gg, s, GARDEN);
      gg.fillRoundedRect(x - 80 * K, y - 26 * K, 160 * K, 40 * K, 18);
    });
    g.fillStyle(INLET, 1);
    g.fillEllipse(x + 30 * K, y - 4 * K, 42 * K, 16 * K);
    g.fillStyle(0xffffff, 0.35);
    g.fillRoundedRect(x + 20 * K, y - 8 * K, 16 * K, 4, 2);
    // The little potting shed on the lawn, with its window and door.
    paper(g, 3, 4, (gg, s) => {
      ink(gg, s, SHED);
      gg.fillRoundedRect(x - 68 * K, y - 44 * K, 42 * K, 30 * K, 5);
      ink(gg, s, ROOF);
      gg.fillTriangle(x - 74 * K, y - 42 * K, x - 20 * K, y - 42 * K, x - 47 * K, y - 60 * K);
    });
    g.fillStyle(PLACE_OFF, 1);
    g.fillRoundedRect(win[0], win[1], win[2], win[3], 3);
    g.fillStyle(DOOR_OFF, 1);
    g.fillRoundedRect(door[0], door[1], door[2], door[3], 3);
    paper(g, 3, 4, (gg, s) => {
      ink(gg, s, GARDEN_TREE);
      gg.fillCircle(x - 6 * K, y - 36 * K, 20 * K);
      gg.fillCircle(x + 20 * K, y - 44 * K, 24 * K);
      gg.fillCircle(x + 60 * K, y - 28 * K, 16 * K);
    });
    const beds = [0xff9ec0, 0xffe08a, 0xff9ec0, 0xffe08a, 0xffffff, 0xff9ec0];
    beds.forEach((col, i) => { g.fillStyle(col, 1); g.fillCircle(x - 20 * K + i * 12 * K, y + 6 * K - (i % 2) * 6 * K, 4 * K); });
    lampPost(g, lamp[0], y, 58 * K);
    lampHead(g, lamp[0], lamp[1], 7, false);
    return;
  }
  g.fillStyle(LAMP, 1);
  g.fillRoundedRect(win[0], win[1], win[2], win[3], 3);
  g.fillStyle(DOOR_LIT, 1);
  g.fillRoundedRect(door[0], door[1], door[2], door[3], 3);
  lampHead(g, lamp[0], lamp[1], 7, true);
}

function drawBeach(g, x, y, lit) {
  // The snack hut on short stilts, with a window, a door and a lamp on its roof.
  const hx = x + 30 * K;
  const win = [hx - 16 * K, y - 50 * K, 18 * K, 14 * K];
  const door = [hx + 6 * K, y - 52 * K, 12 * K, 22 * K];
  const lamp = [hx, y - 80 * K];
  if (!lit) {
    paper(g, 3, 5, (gg, s) => {
      ink(gg, s, SAND);
      gg.fillEllipse(x, y - 4, 170 * K, 40 * K);
    });
    g.fillStyle(0x8a6a4a, 1);
    g.fillRoundedRect(x - 60 * K, y - 10 * K, 40 * K, 8 * K, 4);
    // A striped umbrella: pole and a flat triangle canopy.
    g.fillStyle(0x6b4a34, 1);
    g.fillRect(x - 36 * K, y - 54 * K, 4 * K, 50 * K);
    paper(g, 3, 4, (gg, s) => {
      ink(gg, s, CABIN);
      gg.fillTriangle(x - 70 * K, y - 46 * K, x + 2 * K, y - 46 * K, x - 34 * K, y - 70 * K);
    });
    g.fillStyle(PAPER_STRIP, 1);
    g.fillTriangle(x - 46 * K, y - 46 * K, x - 22 * K, y - 46 * K, x - 34 * K, y - 70 * K);
    paper(g, 3, 4, (gg, s) => {
      ink(gg, s, 0xc9b58a);
      gg.fillRect(hx - 18 * K, y - 28 * K, 4 * K, 26 * K);
      gg.fillRect(hx + 14 * K, y - 28 * K, 4 * K, 26 * K);
      ink(gg, s, PAPER_STRIP);
      gg.fillRoundedRect(hx - 22 * K, y - 58 * K, 44 * K, 32 * K, 6);
      ink(gg, s, CABIN);
      gg.fillRoundedRect(hx - 26 * K, y - 70 * K, 52 * K, 14 * K, 6);
    });
    g.fillStyle(PLACE_OFF, 1);
    g.fillRoundedRect(win[0], win[1], win[2], win[3], 3);
    g.fillStyle(DOOR_OFF, 1);
    g.fillRoundedRect(door[0], door[1], door[2], door[3], 3);
    lampHead(g, lamp[0], lamp[1], 6, false);
    return;
  }
  g.fillStyle(LAMP, 1);
  g.fillRoundedRect(win[0], win[1], win[2], win[3], 3);
  g.fillStyle(DOOR_LIT, 1);
  g.fillRoundedRect(door[0], door[1], door[2], door[3], 3);
  lampHead(g, lamp[0], lamp[1], 6, true);
}

function drawBread(g, x, y, lit) {
  const win = [x - 40 * K, y - 40 * K, 44 * K, 28 * K];
  const door = [x + 14 * K, y - 40 * K, 22 * K, 40 * K];
  const lamp = [x - 62 * K, y - 52 * K];
  if (!lit) {
    paper(g, 4, 5, (gg, s) => {
      ink(gg, s, SHOP_TAN);
      gg.fillRoundedRect(x - 50 * K, y - 58 * K, 100 * K, 58 * K, 10);
      ink(gg, s, LOAF);
      gg.fillEllipse(x, y - 72 * K, 96 * K, 42 * K);
    });
    g.lineStyle(5, LOAF_DARK, 1);
    for (const dx of [-22, 0, 22]) g.lineBetween(x + (dx - 6) * K, y - 80 * K, x + (dx + 6) * K, y - 66 * K);
    g.fillStyle(PLACE_OFF, 1);
    g.fillRoundedRect(win[0], win[1], win[2], win[3], 6);
    g.fillStyle(DOOR_OFF, 1);
    g.fillRoundedRect(door[0], door[1], door[2], door[3], 5);
    lampPost(g, lamp[0], y, 52 * K);
    lampHead(g, lamp[0], lamp[1], 7, false);
    return;
  }
  g.fillStyle(LAMP, 1);
  g.fillRoundedRect(win[0], win[1], win[2], win[3], 6);
  g.fillStyle(DOOR_LIT, 1);
  g.fillRoundedRect(door[0], door[1], door[2], door[3], 5);
  lampHead(g, lamp[0], lamp[1], 7, true);
}

const PLACE_ART = { store: drawStore, garden: drawGarden, beach: drawBeach, bread: drawBread };

// ---------------------------------------------------------------- the city

// Downtown's towers, [x, w, h] on the base line; tallest centre left, low
// rise toward the park on the right, so the bread place across the creek
// stands clear of them.
const DOWNTOWN = [
  [-60, 50, 150], [-4, 46, 196], [50, 56, 252], [112, 44, 212], [162, 62, 322], [230, 50, 278],
  [286, 64, 342], [356, 48, 268], [410, 58, 226], [474, 44, 170], [524, 50, 128], [580, 42, 98],
];
const TOWER_BASE = 400;
const CREEK_Y = 258;           // the south side's shore
const PENINSULA_Y = 284;       // downtown's shore across the creek
const SEAWALL_Y = 410;         // downtown's front edge on the inlet
// The order the tower windows come on during the couplet: scattered, not a wipe.
const GROUP_ORDER = [6, 2, 9, 4, 0, 11, 7, 3, 10, 1, 8, 5];

function windowCells(ti, fn) {
  const [x, w, h] = DOWNTOWN[ti];
  const cols = Math.max(2, Math.floor((w - 10) / 14));
  const rows = Math.floor((h - 24) / 18);
  const gx = x + (w - (cols * 7 + (cols - 1) * 7)) / 2;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) fn(i, j, gx + i * 14, TOWER_BASE - h + 14 + j * 18);
  }
}

// Places keep the south side's houses and trees off their plots.
function onPlot(hx, hy) {
  return PLACE_IDS.some((id) => {
    const p = PLACES[id];
    return hx > p.x - 150 && hx < p.x + 150 && hy > p.y - 150 && hy < p.y + 30;
  });
}

// The south side's houses: a loose deterministic scatter, not a grid.
function southHouses() {
  const out = [];
  for (let i = 0; i < 120; i++) {
    const hx = -340 + ((i * 131) % 1500);
    const hy = 24 + ((i * 71) % 220);
    if (hx > 1180 - hy * 0.3) continue;
    if (onPlot(hx, hy)) continue;
    out.push([hx, hy]);
  }
  return out;
}

// The long bridge from the park's west tip down to the headland on our side
// of the inlet: a flat deck, two thin towers and the main cable drooping
// between them.
const BRIDGE_A = [950, 362];
const BRIDGE_B = [1252, 546];
function bridgeAt(f) {
  return [BRIDGE_A[0] + (BRIDGE_B[0] - BRIDGE_A[0]) * f, BRIDGE_A[1] + (BRIDGE_B[1] - BRIDGE_A[1]) * f];
}
function bridgeCableAt(f) {
  const [x, y] = bridgeAt(f);
  const TOP = 70;
  let lift;
  if (f < 0.25) lift = TOP * (f / 0.25) ** 1.4;
  else if (f > 0.75) lift = TOP * ((1 - f) / 0.25) ** 1.4;
  else { const u = (f - 0.25) / 0.5; lift = TOP - (TOP - 12) * 4 * u * (1 - u); }
  return [x, y - 6 - lift];
}

// ---------------------------------------------------------------- the mid layer

// The trail the kid walked up, in mid-layer coordinates: a cream zigzag from
// the bottom right up the flank toward the summit, a lamp at every bend.
// Listed from the top down, the order the lamps light.
const TRAIL = [[760, 282], [930, 332], [740, 352], [1060, 422], [720, 472], [1100, 532], [700, 600], [1140, 652]];

// ---------------------------------------------------------------- the cabin

// The big red cabin, drawn around its carriage at (0, 0): two wheels on the
// cable, a hanger arm with a small lamp, a railed domed roof, a gondola body
// that is a rounded trapezoid, one big window split by a mullion, and a door
// with a tall window at the left end. The pet sits between the glass and the
// sill, so its feet hide behind the sill.
const CABIN_BODY = [[-250, 96], [250, 96], [270, 300], [235, 470], [-235, 470], [-270, 300]];
// The window seat: the pet's left edge and top, its size at the summit
// (maxScale, maxH), and the most it may grow on the way down (fitH) while its
// feet stay above the bottom of the front sheet (feet).
const SEAT = { x: -24, top: 176, maxScale: 2.3, maxH: 250, fitH: 300, feet: 452 };
// The hop's height in cabin units: low enough to pass under the roof.
const HOP_LIFT = 50;

function cabinBack(g) {
  g.lineStyle(5, RAIL, 1);
  g.lineBetween(-190, 50, 190, 50);
  g.fillStyle(RAIL, 1);
  for (let i = 0; i <= 8; i++) g.fillRect(-192 + i * 47.5, 50, 5, 18);
  paper(g, 5, 7, (gg, s) => {
    ink(gg, s, HANGER);
    gg.fillRoundedRect(-66, -10, 132, 26, 12);
    poly(gg, [[-14, 12], [14, 12], [20, 76], [-20, 76]]);
    ink(gg, s, WHEEL);
    gg.fillCircle(-40, -8, 15);
    gg.fillCircle(40, -8, 15);
    ink(gg, s, CABIN);
    roundPoly(gg, CABIN_BODY, 34);
    ink(gg, s, CABIN_ROOF);
    gg.fillRoundedRect(-240, 60, 480, 56, 28);
  });
  g.fillStyle(HANGER, 1);
  g.fillCircle(-40, -8, 5);
  g.fillCircle(40, -8, 5);
  g.fillStyle(CABIN_TRIM, 1);
  g.fillRoundedRect(-236, 404, 472, 14, 7);
  g.fillStyle(GLASS, 1);
  g.fillRoundedRect(-150, 130, 386, 240, 28);
  g.fillStyle(GLASS_WARM, 0.8);
  g.fillRoundedRect(-150, 262, 386, 108, { tl: 0, tr: 0, bl: 28, br: 28 });
  g.fillStyle(CABIN_ROOF, 1);
  g.fillRoundedRect(182, 130, 16, 240, 6);
}

function cabinDoorClosed(g) {
  g.fillStyle(CABIN_ROOF, 1);
  g.fillRoundedRect(-240, 128, 76, 300, 16);
  g.fillStyle(GLASS, 1);
  g.fillRoundedRect(-230, 150, 56, 150, 14);
}

function cabinDoorOpen(g) {
  g.fillStyle(LAMP, 1);
  g.fillRoundedRect(-240, 128, 76, 300, 16);
  g.fillStyle(GLASS_WARM, 1);
  g.fillRoundedRect(-232, 136, 60, 284, 12);
  paper(g, 4, 6, (gg, s) => {
    ink(gg, s, CABIN_ROOF);
    poly(gg, [[-240, 128], [-286, 152], [-286, 404], [-240, 428]]);
  });
  g.fillStyle(GLASS, 0.9);
  poly(g, [[-248, 164], [-278, 178], [-278, 300], [-248, 296]]);
}

// The roof band again, drawn in front of the pet so a hop in or out ducks
// under the roof instead of passing over it. No shadow: the back sheet's
// roof already casts it.
function cabinRoof(g) {
  g.fillStyle(CABIN_ROOF, 1);
  g.fillRoundedRect(-240, 60, 480, 56, 28);
}

function cabinFront(g) {
  g.fillStyle(0xffffff, 0.45);
  poly(g, [[206, 142], [226, 142], [214, 196], [206, 196]]);
  poly(g, [[140, 142], [160, 142], [128, 190], [120, 190]]);
  // The cabin's lower body, from the sill down, drawn again in front of the
  // pet so a tall pet's feet and shadow stay hidden below the sill. It stops
  // right of the door, whose own sheet covers that end.
  g.fillStyle(CABIN, 1);
  roundPoly(g, [[-162, 380], [254, 380], [235, 470], [-162, 470]], 30);
  g.fillStyle(CABIN_TRIM, 1);
  g.fillRoundedRect(-162, 404, 398, 14, { tl: 0, bl: 0, tr: 7, br: 7 });
  paper(g, 0, 6, (gg, s) => {
    ink(gg, s, CABIN_ROOF);
    gg.fillRoundedRect(-160, 350, 406, 34, 14);
  });
}

// ---------------------------------------------------------------- captions

/**
 * A caption: a cream paper strip with dark ink and a hard offset shadow,
 * centred on (x, y). Returns a container; the caller sets its depth.
 */
export function makeCaption(scene, text, opts = {}) {
  const x = opts.x ?? W / 2;
  const y = opts.y ?? 1660;
  const px = opts.px ?? 52;
  const t = scene.add.text(0, 0, text, style('display', {
    fontSize: `${px}px`, fill: INK, stroke: '#fff6e0', strokeThickness: 0,
    align: 'center', wordWrap: { width: opts.wrap ?? 960 }, lineSpacing: 4,
  })).setOrigin(0.5);
  const w = Math.min(W - 48, t.width + 72);
  const h = t.height + 44;
  const g = scene.add.graphics();
  paper(g, 8, 10, (gg, s) => {
    ink(gg, s, PAPER_STRIP);
    gg.fillRoundedRect(-w / 2, -h / 2, w, h, 20);
  });
  // A thin darker line along the strip's foot, like a paper fold.
  g.fillStyle(0xe8dcc0, 1);
  g.fillRoundedRect(-w / 2 + 20, h / 2 - 10, w - 40, 4, 2);
  const c = scene.add.container(x, y, [g, t]);
  c.text = t;
  c.stripW = w;
  c.stripH = h;
  return c;
}

// ---------------------------------------------------------------- build

let RUN_COUNTER = 0;

/**
 * Builds The Ride Down in the scene and returns its controls (see the API at
 * the top of this file). Call destroy() when the scene shuts down.
 */
export function createRideDown(scene, opts = {}) {
  const base = opts.depth ?? 0;
  const prefix = `rideDown_${Date.now().toString(36)}_${++RUN_COUNTER}_`;
  const baked = [];
  const tweens = new Set();
  const pending = new Set();
  let destroyed = false;

  // Draws paint(g) once into a canvas texture covering (bx, by, bw, bh) in
  // the painter's coordinates, and returns an Image placed back at (bx, by)
  // plus (ox, oy) inside parent.
  const bake = (name, bx, by, bw, bh, paint) => {
    const key = prefix + name;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.translateCanvas(-bx, -by);
    paint(g);
    g.generateTexture(key, Math.ceil(bw), Math.ceil(bh));
    g.destroy();
    // A canvas texture also keeps a blank copy of its pixels for reading
    // back. The ride only ever draws the canvas, so that copy is dropped.
    const tex = scene.textures.get(key);
    if (tex) { tex.imageData = null; tex.data = null; tex.pixels = null; tex.buffer = null; }
    baked.push({ key, w: Math.ceil(bw), h: Math.ceil(bh) });
    return key;
  };
  const image = (parent, key, x, y) => {
    const im = scene.add.image(x, y, key).setOrigin(0, 0);
    parent.add(im);
    return im;
  };
  const sheet = (parent, name, bx, by, bw, bh, paint, ox = 0, oy = 0) => {
    const key = bake(name, bx, by, bw, bh, paint);
    return image(parent, key, bx + ox, by + oy);
  };
  const track = (cfg) => {
    const tw = scene.tweens.add(cfg);
    tweens.add(tw);
    tw.once('complete', () => tweens.delete(tw));
    tw.once('stop', () => tweens.delete(tw));
    return tw;
  };
  // A tween as a Promise. Anything still waiting when the ride is destroyed
  // resolves then, so an awaiting timeline never hangs.
  const tweenP = (cfg) => new Promise((resolve) => {
    if (destroyed) { resolve(); return; }
    pending.add(resolve);
    track({ ...cfg, onComplete: () => { pending.delete(resolve); resolve(); } });
  });

  // Shared lamp textures: a lit lamp (warm glow ellipses under a filled dot)
  // and a waiting one (a dim dot). Radius 12, scaled per lamp.
  const LAMP_ON = bake('lampOn', -48, -40, 96, 80, (g) => {
    g.fillStyle(LAMP, 0.28);
    g.fillEllipse(0, 0, 84, 66);
    g.fillStyle(LAMP, 0.45);
    g.fillEllipse(0, 0, 43, 36);
    g.fillStyle(LAMP, 1);
    g.fillCircle(0, 0, 12);
  });
  const LAMP_DARK = bake('lampOff', -14, -14, 28, 28, (g) => {
    g.fillStyle(LAMP_OFF, 1);
    g.fillCircle(0, 0, 12);
  });
  // The glow behind a named place: three stacked plain ellipses, a warm
  // orange pool, a bright yellow one and a near-white core low at the ground.
  // The outer ring is strong and saturated so the violet under it cannot pull
  // it toward khaki: it has to read as light on a phone, not as a tan plate.
  // The beach gets a pinker coral ring so its glow never looks like its sand.
  const glowSheet = (name, outer) => bake(name, -160, -95, 320, 190, (g) => {
    g.fillStyle(outer, 0.9);
    g.fillEllipse(0, 0, 316, 180);
    g.fillStyle(0xffcf6e, 1);
    g.fillEllipse(0, 18, 240, 128);
    g.fillStyle(0xfff4cc, 1);
    g.fillEllipse(0, 48, 160, 56);
  });
  const GLOW = glowSheet('placeGlow', 0xf5a55a);
  const GLOW_BEACH = glowSheet('placeGlowBeach', 0xff9a78);

  const makeLamp = (parent, x, y, r, lit) => {
    const k = r / 12;
    const off = scene.add.image(x, y, LAMP_DARK).setScale(k).setVisible(!lit);
    const on = scene.add.image(x, y, LAMP_ON).setScale(k).setAlpha(lit ? 1 : 0);
    parent.add([off, on]);
    return { off, on, lit, x, y };
  };

  // ---------------------------------------------------------- sky (live)

  // Tied to the horizon: the layer's y is the horizon line; the sheet runs
  // 3000 px up from it and 700 below (hidden behind the water).
  const skyG = scene.add.graphics().setDepth(base);
  skyG.fillStyle(DUSK, 1);
  skyG.fillRect(0, -3400, W, 800);
  sky(skyG, 0, -2600, W, 3300, [[0, DUSK], [0.55, DUSK], [0.7, MAUVE], [0.76, ROSE], [0.8, AFTERGLOW], [1, AFTERGLOW]]);
  // The sun went down in the west, low on the right: a warm glow there.
  skyG.fillStyle(AFTERGLOW, 0.4);
  skyG.fillEllipse(900, 0, 900, 260);
  skyG.fillStyle(0xfff0cc, 0.3);
  skyG.fillEllipse(940, 10, 420, 90);
  // Early evening: a plain violet wash over the upper sky, faded in by p.
  const nightG = scene.add.graphics().setDepth(base + 1);
  nightG.fillStyle(DUSK, 1);
  nightG.fillRect(0, -3400, W, 2400);
  nightG.fillGradientStyle(DUSK, DUSK, DUSK, DUSK, 1, 1, 0, 0);
  nightG.fillRect(0, -1000, W, 1000);
  // Stars: one small baked dot, placed as images (cheaper than live circles).
  const STAR = bake('star', -4, -4, 8, 8, (g) => { g.fillStyle(0xe8e4ff, 1); g.fillCircle(0, 0, 3); });
  const starG = scene.add.container(0, 0).setDepth(base + 2);
  for (const [sx, sy, r, a] of [
    [90, -700, 3, 0.8], [230, -820, 2.5, 0.7], [400, -640, 2, 0.6], [640, -780, 3, 0.8], [820, -690, 2.5, 0.7],
    [980, -840, 2, 0.6], [150, -520, 2, 0.5], [760, -560, 2, 0.5], [540, -900, 2.5, 0.7], [320, -980, 2, 0.6],
    [900, -980, 3, 0.8], [60, -1000, 2, 0.5], [470, -470, 2, 0.45], [1010, -430, 2, 0.45], [260, -380, 2, 0.4],
    [700, -1150, 2.5, 0.7], [120, -1250, 2, 0.6], [880, -1300, 2.5, 0.7], [420, -1380, 2, 0.6],
  ]) starG.add(scene.add.image(sx, sy, STAR).setScale(r / 3).setAlpha(a));

  // ---------------------------------------------------------- far layer

  // All far drawing is in far-local coordinates: x across, y 0 at the
  // horizon. The container's origin is far-local x 540, so it scales about
  // the middle of the city.
  const far = scene.add.container(0, 0).setDepth(base + 10);
  const farIn = scene.add.container(-540, 0);
  far.add(farIn);

  // Live, and only plain rectangles (cheap): the water with its dusk bands,
  // and the flat edges of the hills, the south side and downtown, which run
  // on past the baked sheets for the frames that see that far.
  const farLive = scene.add.graphics();
  farIn.add(farLive);
  farLive.fillStyle(ROSE, 0.14);
  farLive.fillRect(-3000, -130, 6600, 128);
  farLive.fillStyle(FAR_HILLS_B, 1);
  farLive.fillRect(-3000, -10, 2640, 12);
  farLive.fillStyle(FAR_HILLS, 1);
  farLive.fillRect(1540, -10, 2060, 12);
  farLive.fillStyle(INLET, 1);
  farLive.fillRect(-3000, 0, 6600, 3000);
  farLive.fillStyle(AFTERGLOW, 0.5);
  farLive.fillRect(1240, 4, 2000, 5);
  // Dusk bands on the water, lighter toward us: rose and peach catching the
  // afterglow, and wide lighter violet bands between them.
  const bands = [
    [440, 8, AFTERGLOW, 0.4], [470, 30, WATER_B, 1], [522, 8, ROSE, 0.5], [560, 44, WATER_B, 1],
    [636, 10, AFTERGLOW, 0.4], [680, 60, WATER_C, 1], [770, 10, ROSE, 0.5], [806, 90, WATER_C, 1],
    [930, 12, AFTERGLOW, 0.45], [980, 2000, 0xa08ecc, 1],
  ];
  for (const [by, bh, col, a] of bands) {
    farLive.fillStyle(col, a);
    farLive.fillRect(-3000, by, 6600, bh);
  }
  farLive.fillStyle(SOUTH, 1);
  farLive.fillRect(-3000, 0, 2641, CREEK_Y);
  farLive.fillStyle(CITY, 1);
  farLive.fillRect(-3000, PENINSULA_Y, 2641, SEAWALL_Y - PENINSULA_Y);
  farLive.fillStyle(0x000000, 0.22);
  farLive.fillRect(-3000, SEAWALL_Y, 2641, 8);
  // The headland on our side of the inlet where the bridge comes down. Its
  // shore slopes away to the right as it comes toward us, so from the dock
  // only its tip shows at the frame's edge, never a straight wall.
  paper(farLive, 0, 8, (gg, s) => {
    ink(gg, s, FLANK);
    poly(gg, [[1170, 610], [1216, 566], [1300, 534], [1440, 518], [3600, 514], [3600, 1300], [1640, 1300], [1400, 1040], [1250, 820], [1182, 690]]);
  });

  // The back sheet, baked: the far hills and the snowy peak, the south side
  // with its houses and trees, the peach glints on the bay.
  sheet(farIn, 'farBack', -360, -130, 1900, 420, (g) => {
    ridge(g, [[-360, 2], [-360, -10], [-300, -12], [-40, 2], [80, -34], [160, -112], [240, -34], [380, -20], [460, 2]], FAR_HILLS_B, 0, 0, 5);
    g.fillStyle(SNOW, 1);
    poly(g, [[134, -84], [186, -84], [160, -112]]);
    g.fillCircle(160, -104, 10);
    ridge(g, [[560, 2], [660, -46], [760, -30], [880, -84], [1000, -40], [1120, -62], [1300, -30], [1500, -54], [1540, -10], [1540, 2]], FAR_HILLS, 0, 0, 6);
    g.fillStyle(AFTERGLOW, 0.55);
    for (const [gx, gy, gw] of [[1300, 60, 120], [1420, 140, 80], [1360, 220, 60]]) g.fillRoundedRect(gx, gy, gw, 5, 2);
    // The south side: low and leafy, from the horizon to the creek, ending on
    // the right in a point out into the water where the beach is.
    paper(g, 0, 6, (gg, s) => {
      ink(gg, s, SOUTH);
      poly(gg, [[-360, 0], [1240, 0], [1296, 60], [1350, 150], [1384, 232], [1340, 272], [1214, 280], [1080, 266], [1000, CREEK_Y], [-360, CREEK_Y]]);
    });
    const houses = southHouses();
    paper(g, 2, 3, (gg, s) => {
      ink(gg, s, HOUSE);
      for (const [hx, hy] of houses) {
        gg.fillRoundedRect(hx - 10, hy - 10, 20, 12, 2);
        gg.fillTriangle(hx - 13, hy - 9, hx + 13, hy - 9, hx, hy - 20);
      }
    });
    paper(g, 2, 3, (gg, s) => {
      ink(gg, s, SOUTH_TREE);
      for (let i = 0; i < 80; i++) {
        const tx = -340 + ((i * 97) % 1500);
        const ty = 12 + ((i * 53) % 230);
        if (tx > 1170 - ty * 0.3) continue;
        if (onPlot(tx, ty)) continue;
        gg.fillCircle(tx, ty, 11 + (i % 3) * 3);
      }
    });
    // The mall, low and wide, south centre.
    boxRow(g, 3, 4, HOUSE, [[300, 18, 150, 30]], 8);
  });

  // The four places: every glow first (behind), then the places, then their
  // lights on top, so no glow ever covers a neighbouring place.
  const places = {};
  for (const id of PLACE_IDS) {
    const p = PLACES[id];
    const glow = scene.add.image(p.x, p.y - 44, id === 'beach' ? GLOW_BEACH : GLOW).setScale(p.glow).setAlpha(0);
    farIn.add(glow);
    places[id] = { glow, on: false };
  }
  for (const id of PLACE_IDS) {
    const p = PLACES[id];
    places[id].art = sheet(farIn, 'place_' + id, p.x + PLACE_BOX.dx, p.y + PLACE_BOX.dy, PLACE_BOX.w, PLACE_BOX.h, (g) => PLACE_ART[id](g, p.x, p.y, false));
  }
  for (const id of PLACE_IDS) {
    const p = PLACES[id];
    places[id].lit = sheet(farIn, 'placeLit_' + id, p.x + PLACE_BOX.dx, p.y + PLACE_BOX.dy, PLACE_BOX.w, PLACE_BOX.h, (g) => PLACE_ART[id](g, p.x, p.y, true));
    places[id].lit.setAlpha(0);
  }

  // The front sheet: downtown's peninsula across the creek, the park, the
  // bridge, and the towers with their windows still dark.
  sheet(farIn, 'farFront', -360, 40, 1660, 540, (g) => {
    paper(g, 0, 8, (gg, s) => {
      ink(gg, s, CITY);
      gg.fillRoundedRect(-420, PENINSULA_Y, 1110, SEAWALL_Y - PENINSULA_Y, 40);
    });
    paper(g, 0, 8, (gg, s) => {
      ink(gg, s, PARK);
      gg.fillRoundedRect(626, PENINSULA_Y + 4, 336, 124, 60);
    });
    paper(g, 3, 4, (gg, s) => {
      ink(gg, s, PARK_TREE);
      for (let i = 0; i < 10; i++) gg.fillCircle(664 + i * 30, 306 + (i % 2) * 16, 18 + (i % 3) * 3);
      for (let i = 0; i < 8; i++) gg.fillCircle(680 + i * 32, 352 + (i % 2) * 12, 16 + (i % 2) * 4);
    });
    paper(g, 3, 4, (gg, s) => {
      ink(gg, s, BRIDGE);
      ribbon(gg, [BRIDGE_A, BRIDGE_B], 4);
      for (const f of [0.25, 0.75]) {
        const [tx, ty] = bridgeAt(f);
        gg.fillRoundedRect(tx - 4, ty - 80, 8, 88, 3);
      }
      const top = [];
      const bot = [];
      for (let k = 0; k <= 40; k++) {
        const [cx, cy] = bridgeCableAt(k / 40);
        top.push([cx, cy - 3]);
        bot.push([cx, cy + 3]);
      }
      poly(gg, [...top, ...bot.reverse()]);
    });
    DOWNTOWN.forEach(([x, w, h], i) => boxRow(g, 4, 6, i % 2 ? TOWER_B : TOWER, [[x, TOWER_BASE - h, w, h]], 6));
    g.fillStyle(LAMP_OFF, 1);
    DOWNTOWN.forEach((d, ti) => windowCells(ti, (i, j, wx, wy) => g.fillRoundedRect(wx, wy, 7, 9, 2)));
  });

  // The city's window groups, one small baked sheet per tower.
  const groups = GROUP_ORDER.map((ti) => {
    const [x, w, h] = DOWNTOWN[ti];
    const im = sheet(farIn, 'windows' + ti, x, TOWER_BASE - h, w, h, (g) => {
      g.fillStyle(LAMP, 1);
      windowCells(ti, (i, j, wx, wy) => { if ((ti * 5 + i * 7 + j * 3) % 6 < 4) g.fillRoundedRect(wx, wy, 7, 9, 2); });
    });
    im.setAlpha(0);
    return im;
  });

  // Shore lights: the seawall and creek lamps, the south side's lit houses,
  // the bridge's string of lights, and the city's warm reflections.
  const shore = sheet(farIn, 'shoreLights', -360, -10, 1760, 620, (g) => {
    g.fillStyle(LAMP, 1);
    southHouses().forEach(([hx, hy], k) => { if (k % 3 !== 1) g.fillRect(hx - 3, hy - 7, 6, 6); });
    g.fillStyle(0xffd9a0, 1);
    for (let x = -350; x < 640; x += 26) g.fillCircle(x, SEAWALL_Y - 3, 3.5);
    for (let x = -350; x < 600; x += 30) g.fillCircle(x, CREEK_Y - 4, 3);
    g.fillStyle(LAMP, 1);
    for (let k = 0; k <= 20; k++) {
      const [bx, by] = bridgeCableAt(k / 20);
      g.fillCircle(bx, by, 3.5);
    }
    // Reflections: short upright warm streaks under the towers and the bridge.
    g.fillStyle(CITY_GLOW, 0.6);
    DOWNTOWN.forEach(([x, w, h], ti) => {
      const n = 1 + Math.round(h / 120);
      for (let k = 0; k < n; k++) {
        const sx = x + 4 + ((ti * 23 + k * 37) % Math.max(8, w - 14));
        const sy = SEAWALL_Y + 16 + ((ti * 17 + k * 29) % 40) + k * 20;
        g.fillRoundedRect(sx, sy, 6, 30, 3);
      }
    });
    for (let k = 1; k < 10; k++) {
      const [bx, by] = bridgeAt(k / 10);
      g.fillRoundedRect(bx - 2, by + 14, 5, 22, 2);
    }
  });
  shore.setAlpha(0);

  // ---------------------------------------------------------- mid layer

  // The mountain's flank far below the line: one big live plane whose top
  // edge falls left to right, with baked rows of firs and the lit trail.
  const mid = scene.add.container(0, 0).setDepth(base + 20);
  const flankG = scene.add.graphics();
  flankG.fillStyle(FLANK, 1);
  flankG.fillRect(-700, 760, 2700, 1700);
  mid.add(flankG);
  sheet(mid, 'flank', -160, -80, 1600, 860, (g) => {
    const edgePts = [];
    for (let x = -160; x <= 1440; x += 60) edgePts.push([x, flankEdge(x)]);
    ridge(g, [...edgePts, [1440, 780], [-160, 780]], FLANK, 0, 8, 0);

    const row = (dy, w0, h0, step, off, col) => {
      const list = [];
      for (let x = -160 + off; x < 1440; x += step) {
        const i = Math.round(x / step);
        list.push([x, flankEdge(x) + dy, w0, h0 + ((i * 17) % 40 + 40) % 40]);
      }
      treeline(g, list, col);
    };
    row(26, 52, 70, 54, 0, FLANK_TREE);
    row(150, 60, 80, 54, 26, FLANK_TREE_B);
    row(320, 56, 72, 90, 40, FLANK_TREE);
    row(500, 60, 80, 110, 10, FLANK_TREE_B);
    // The trail: a cream ribbon with a round cap at each bend, and a thin
    // post under each lamp.
    paper(g, 3, 4, (gg, s) => {
      ink(gg, s, TRAIL_CREAM);
      ribbon(gg, TRAIL, 7);
    });
    boxRow(g, 2, 3, POST, TRAIL.map(([x, y]) => [x - 3, y - 30, 6, 30]), 3);
  });

  // ---------------------------------------------------------- near layer

  const near = scene.add.container(0, 0).setDepth(base + 30);
  const tiles = [];
  const tile = (name, bx, by, bw, bh, paint, ox = 0, oy = 0) => {
    const im = sheet(near, name, bx, by, bw, bh, paint, ox, oy);
    tiles.push({ im, x: bx + ox, y: by + oy, w: bw, h: bh });
    return im;
  };

  // The summit: the knoll with the turbine, the chalet and the ship's pad,
  // the top station and its deck, and under the deck the bears' pen on a
  // ledge, with the flank far below showing past it.
  const summitTile = tile('summit', -80, 380, 1260, 1620, (g) => {
    ridge(g, [[-80, TOP_DECK_Y], [-80, 690], [60, 662], [300, 668], [560, 690], [760, 730], [860, 820], [910, 1000], [960, TOP_DECK_Y]], RIDGE, 6, 8, 16);
    turbineMast(g, 150, 672, 246, 1.36);
    treeline(g, [[150, 680, 56, 84], [770, 740, 60, 96], [850, 830, 64, 100], [900, 1000, 70, 110]], TREE);
    chalet(g, 350, 690, 300, 130, 80, 6);
    // The ship's pad on the knoll's shoulder: a flat paper ellipse with two
    // small landing lights.
    paper(g, 3, 5, (gg, s) => {
      ink(gg, s, CONCRETE);
      gg.fillEllipse(646, 708, 150, 26);
    });
    g.fillStyle(LAMP, 1);
    for (const lx of [584, 708]) g.fillCircle(lx, 708, 5);
    // The top station: a timber housing where the cable comes out.
    boxRow(g, 5, 7, TIMBER, [[-40, 770, 300, TOP_DECK_Y - 770]], 16);
    ridge(g, [[-60, 786], [290, 786], [260, 730], [-40, 730]], ROOF, 5, 7, 8);
    g.fillStyle(0x2a1c30, 1);
    g.fillRoundedRect(196, 820, 64, 80, 14);
    g.fillStyle(LAMP, 1);
    g.fillRoundedRect(30, 900, 60, 56, 8);
    g.fillRoundedRect(110, 900, 60, 56, 8);
    // The mountain's shoulder under it all, in the flank's own dusk violet:
    // it runs from right under the deck's end down past the bottom of the
    // sheet, so as the summit slides away the deck never hangs over open sky,
    // and it melts into the flank below instead of adding more dark green.
    ridge(g, [[-80, 1480], [1150, 1390], [1164, 1560], [1120, 1800], [1080, 2000], [-80, 2000]], FLANK, 6, 8, 20);
    treeline(g, [
      [820, 1640, 60, 84], [900, 1600, 56, 78], [980, 1560, 60, 90], [1060, 1520, 56, 80],
      [760, 1880, 70, 100], [860, 1840, 64, 92], [960, 1800, 70, 104], [1040, 1760, 60, 88],
      [120, 1930, 64, 90], [300, 1960, 70, 100], [480, 1940, 64, 92], [640, 1960, 70, 100],
    ], FLANK_TREE);
    // The rock under the deck, stepping back to a ledge that holds the pen.
    ridge(g,[[-80, TOP_DECK_Y + 40], [1130, TOP_DECK_Y + 40], [1080, 1470], [900, 1580], [780, 1730], [-80, 1760]], MOUNTAIN, 6, 8, 20);
    // The deck: plank top, darker face, a rounded end and one post under it.
    boxRow(g, 4, 6, TIMBER, [[1060, TOP_DECK_Y + 50, 20, 150]], 5);
    paper(g, 0, 8, (gg, s) => {
      ink(gg, s, DECK);
      gg.fillRoundedRect(-80, TOP_DECK_Y, 1230, 64, { tl: 0, bl: 0, tr: 26, br: 26 });
    });
    g.fillStyle(DECK_TOP, 1);
    g.fillRoundedRect(-80, TOP_DECK_Y, 1230, 16, { tl: 0, bl: 0, tr: 8, br: 0 });
    // The platform lamp's post by the deck's end.
    boxRow(g, 3, 4, STEEL_DARK, [[1010, TOP_DECK_Y - 120, 10, 120]], 4);
    // The bears' pen: grass, a pond, two bears, a post-and-rail fence, and a
    // lamp at each end of its path.
    boxRow(g, 4, 6, PEN, [[40, 1470, 640, 250]], 30);
    g.fillStyle(INLET, 1);
    g.fillEllipse(520, 1600, 220, 70);
    g.fillStyle(0xffffff, 0.35);
    g.fillRoundedRect(470, 1584, 60, 6, 3);
    bear(g, 220, 1590, 2, 1);
    bear(g, 530, 1596, 1.4, -1);
    boxRow(g, 2, 3, FENCE, [50, 130, 210, 290, 370, 450, 530, 610, 668].map((x) => [x, 1650, 10, 70]), 3);
    g.lineStyle(6, RAIL, 1);
    g.lineBetween(50, 1670, 678, 1670);
    g.lineBetween(50, 1700, 678, 1700);
    boxRow(g, 3, 4, STEEL_DARK, [[66, 1600, 10, 130], [690, 1600, 10, 130]], 4);
    treeline(g, [[760, 1660, 90, 140], [860, 1570, 90, 150], [-10, 1790, 110, 150]], TREE_B);
  });

  // The two tall towers, each on its own sheet, their feet in a stand of firs
  // the colour of the flank below.
  const towerLamps = [];
  TOWER_T.forEach((t, i) => {
    const p = cabinAt(t);
    const foot = p.y + (i === 0 ? 1500 : 1400);
    let lamp = null;
    tile('tower' + (i + 1), p.x - 180, p.y - 100, 360, foot - p.y + 130, (g) => {
      lamp = latticeTower(g, p.x, p.y, foot);
      treeline(g, [[p.x - 120, foot + 14, 100, 150], [p.x + 116, foot + 18, 100, 140], [p.x - 10, foot + 26, 120, 170]], FLANK_TREE);
    });
    towerLamps.push(lamp);
  });

  // The bottom station, drawn in dock-screen coordinates: a timber bay roof
  // on two posts that the cabin docks under, and a pier deck over the water
  // that the pet steps out onto, with its posts standing in the inlet.
  const ds = DOCK_SCROLL;
  const D = BOTTOM_DECK_Y;
  const CX = DOCK.sx;
  tile('bottom', 150, 1020, 1180, 720, (g) => {
    boxRow(g, 4, 6, TIMBER, [[CX - 262, 1090, 18, D - 1090], [CX + 250, 1090, 18, D - 1090]], 6);
    paper(g, 5, 8, (gg, s) => {
      ink(gg, s, TIMBER);
      gg.fillRoundedRect(CX - 290, 1070, 600, 30, 12);
      ink(gg, s, ROOF);
      gg.fillRoundedRect(CX - 310, 1046, 640, 30, 14);
    });
    // Pier posts standing in the water, with a small glint beside each.
    boxRow(g, 3, 4, TIMBER, [230, 470, 710, 950, 1190].map((x) => [x, D + 60, 20, 96]), 5);
    g.fillStyle(0xffffff, 0.3);
    for (const x of [230, 470, 710, 950, 1190]) g.fillRoundedRect(x - 14, D + 162, 48, 5, 2);
    paper(g, 0, 8, (gg, s) => {
      ink(gg, s, DECK);
      gg.fillRoundedRect(170, D, 1160, 70, { tl: 24, bl: 24, tr: 0, br: 0 });
    });
    g.fillStyle(DECK_TOP, 1);
    g.fillRoundedRect(170, D, 1160, 16, { tl: 8, bl: 0, tr: 0, br: 0 });
    boxRow(g, 3, 4, STEEL_DARK, [[220, D - 150, 10, 150]], 4);
  }, ds.x, ds.y);

  // The cable, top dock to bottom dock, drawn live as two thin lines that
  // meet at CABLE_SPLIT: the long run up the mountain, and the last stretch
  // into the bottom station. Once we dock, the uphill run is far away behind
  // us and fades into the dusk, so it no longer cuts across the lit city; the
  // stretch the cabin hangs from stays solid.
  const CABLE_SPLIT = 0.93;
  const cableLine = (from, to, lead, tail) => {
    const g = scene.add.graphics();
    near.add(g);
    g.lineStyle(6, CABLE, 1);
    g.beginPath();
    const n = Math.max(2, Math.round((to - from) * 160));
    const p0 = cabinAt(from);
    const start = lead || p0;
    g.moveTo(start.x, start.y);
    if (lead) g.lineTo(p0.x, p0.y);
    for (let k = 1; k <= n; k++) {
      const p = cabinAt(from + (to - from) * k / n);
      g.lineTo(p.x, p.y);
    }
    if (tail) g.lineTo(tail.x, tail.y);
    g.strokePath();
    return g;
  };
  const bottomDock = cabinAt(1);
  const cableUp = cableLine(0, CABLE_SPLIT, { x: -60, y: TOP_DOCK.y }, null);
  cableLine(CABLE_SPLIT, 1, null, { x: bottomDock.x + 600, y: bottomDock.y });

  // Station lamps, always on: the summit platform, the pen, the bottom bay
  // and the pier's end.
  const stationLamps = [
    [1015, TOP_DECK_Y - 130], [71, 1590], [695, 1590],
    [CX - 200 + ds.x, 1122 + ds.y], [CX + 200 + ds.x, 1122 + ds.y], [225 + ds.x, D - 160 + ds.y],
  ].map(([x, y]) => makeLamp(near, x, y, 12, true));

  // The numbered lamps: the two tower lamps, then the trail from the top down.
  const lamps = [];
  towerLamps.forEach((l, i) => lamps.push({ ...makeLamp(near, l.x, l.y, 15, false), where: 'tower' + (i + 1), layer: 'near' }));
  TRAIL.forEach(([x, y]) => lamps.push({ ...makeLamp(mid, x, y - 36, 8, false), where: 'trail', layer: 'mid' }));

  // The turbine's blades turn slowly on their hub; its red light blinks.
  const HUB = { x: 150, y: 672 - 246, k: 1.36 };
  const blades = scene.add.graphics();
  paper(blades, 4 * HUB.k, 6 * HUB.k, (gg, s) => {
    ink(gg, s, BLADE);
    const L = 128;
    blade(gg, 0, 0, 0, -L, 6 * HUB.k);
    blade(gg, 0, 0, L * 0.866, L * 0.5, 6 * HUB.k);
    blade(gg, 0, 0, -L * 0.866, L * 0.5, 6 * HUB.k);
  });
  blades.fillStyle(0xffffff, 1);
  blades.fillCircle(0, 0, 9 * HUB.k);
  blades.setPosition(HUB.x, HUB.y);
  const redLight = scene.add.graphics();
  redLight.fillStyle(0xff5a4a, 0.35);
  redLight.fillEllipse(0, 0, 30, 24);
  redLight.fillStyle(0xff5a4a, 1);
  redLight.fillCircle(0, 0, 5.5);
  redLight.setPosition(HUB.x + 16, HUB.y - 16);
  near.add([blades, redLight]);
  const summitTweens = [
    track({ targets: blades, angle: 360, duration: 16000, repeat: -1 }),
    track({ targets: redLight, alpha: 0.35, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
  ];

  // The ship, the Nanocraft hull, parked on its pad by the chalet as a quiet
  // callback; a small pad plate in front of its foot.
  const ship = drawShip(scene, 646, 682, {
    scale: 0.9, showTrail: false,
    parts: { hull: 'hull_nanocraft', wings: 'wings_default', paint: 'paint_default', addon: null, pattern: 'pattern_none', trail: 'trail_default_flame' },
  });
  const plate = scene.add.graphics();
  plate.fillStyle(CONCRETE, 1);
  plate.fillRoundedRect(624, 708, 44, 24, 8);
  near.add([ship, plate]);
  const summitProps = [ship, plate, blades, redLight];
  let summitShown = true;

  // The cabin: baked pieces in a container pivoting at the carriage, so it
  // can sway, with the pet between the glass and the sill.
  const cabin = scene.add.container(TOP_DOCK.x, TOP_DOCK.y);
  sheet(cabin, 'cabinBack', -300, -30, 600, 520, cabinBack);
  const doorShut = sheet(cabin, 'doorShut', -300, 120, 150, 320, cabinDoorClosed);
  const doorOpen = sheet(cabin, 'doorOpen', -300, 120, 150, 320, cabinDoorOpen);
  doorOpen.setAlpha(0);
  const cabinLamp = scene.add.image(0, 30, LAMP_ON).setScale(0.75);
  cabin.add(cabinLamp);
  const cabinFrontG = sheet(cabin, 'cabinFront', -170, 130, 440, 350, cabinFront);
  sheet(cabin, 'cabinRoof', -244, 56, 488, 64, cabinRoof);
  near.add(cabin);

  // The pet: the kid's own, from the save unless petOpts says otherwise.
  const petOpts = opts.petOpts || {};
  const pet = drawCompanion(scene, 150, TOP_DECK_Y - 100, { scale: 2.4, ...petOpts });
  near.add(pet);
  const petH = (pet.layout && pet.layout.height) || 120;
  const petW = (pet.layout && pet.layout.width) || petH;
  // drawCompanion adds its soft glow first and the drop shadow second. The
  // shadow is hidden while the pet is in the air, so it never hangs there.
  const petShadow = pet.list && pet.list[1];
  const setShadow = (on) => { if (petShadow && petShadow.setAlpha) petShadow.setAlpha(on ? 1 : 0); };
  // Scale in the window seat: at the summit, as big as fits between the sill
  // and the roof. The cabin shrinks on screen as it rides down, so the pet
  // grows in its seat to stay about the same size on screen, as far as the
  // window allows. Its left edge stays put and its feet stay behind the sill.
  const seatBase = Math.min(SEAT.maxScale, SEAT.maxH / petH);
  const seatPose = (cs) => {
    const s = Math.min(seatBase / cs, Math.max(seatBase, SEAT.fitH / petH));
    const h = petH * s;
    const top = Math.min(SEAT.top, SEAT.feet - h);
    return { x: SEAT.x + petW * (s - seatBase) / 2, y: top + h / 2, s };
  };
  // On the decks the pet is bigger again, but never more than 1.4 times its
  // size in the seat at the dock, so stepping out never looks like a jump in size.
  const DECK_SCALE = { summit: 2.4, dock: Math.min(2.8, seatPose(DOCK.cs).s * DOCK.cs * 1.4) };
  const standY = (deckY, s) => deckY - (petH / 2 + 2) * s;
  const deckSpot = {
    summit: { x: 150, y: standY(TOP_DECK_Y, DECK_SCALE.summit), s: DECK_SCALE.summit },
    dock: { x: 470 + ds.x, y: standY(D + ds.y, DECK_SCALE.dock), s: DECK_SCALE.dock },
  };
  let petWhere = 'summit';
  pet.setPosition(deckSpot.summit.x, deckSpot.summit.y).setScale(deckSpot.summit.s);

  // Where a point in the cabin lands in the near layer right now.
  const cabinToNear = (lx, ly) => {
    const a = cabin.rotation;
    const s = cabin.scaleX;
    return {
      x: cabin.x + s * (lx * Math.cos(a) - ly * Math.sin(a)),
      y: cabin.y + s * (lx * Math.sin(a) + ly * Math.cos(a)),
    };
  };

  // And the other way: a near-layer point in the cabin's own coordinates.
  const nearToCabin = (x, y) => {
    const a = -cabin.rotation;
    const s = cabin.scaleX;
    const dx = (x - cabin.x) / s;
    const dy = (y - cabin.y) / s;
    return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
  };

  // Moves the pet into the cabin, just behind the sill, keeping where it
  // shows on screen; with seat true it snaps to the window seat.
  const toCabin = (seat = true) => {
    if (pet.parentContainer !== cabin) {
      const l = nearToCabin(pet.x, pet.y);
      const s = pet.scaleX / cabin.scaleX;
      near.remove(pet);
      cabin.addAt(pet, cabin.getIndex(cabinFrontG));
      pet.setPosition(l.x, l.y).setScale(s).setAngle(0);
    }
    if (seat) {
      const sp = seatPose(cabin.scaleX);
      pet.setPosition(sp.x, sp.y).setScale(sp.s).setAngle(0);
      setShadow(true);
      petWhere = 'cabin';
    }
  };
  const toNear = () => {
    if (pet.parentContainer === cabin) {
      const w = cabinToNear(pet.x, pet.y);
      const s = pet.scaleX * cabin.scaleX;
      cabin.remove(pet);
      near.add(pet);
      pet.setPosition(w.x, w.y).setScale(s);
    }
  };

  // A hop along a low arc from where the pet is to a target point, read
  // every frame so it follows a swaying cabin. Both hops run inside the
  // cabin's own coordinates, so the sill covers the pet's feet as it lands
  // in the seat and as it rises out of it, and the arc stays under the roof:
  // the pet goes in and out through the open door. Its shadow waits on the
  // ground until it lands.
  const hop = (target, duration) => {
    const from = { x: pet.x, y: pet.y, s: pet.scaleX };
    const state = { u: 0 };
    setShadow(false);
    return tweenP({
      targets: state, u: 1, duration, ease: 'Sine.easeInOut',
      onUpdate: () => {
        const to = target();
        const u = state.u;
        const lift = HOP_LIFT * 4 * u * (1 - u);
        pet.setPosition(from.x + (to.x - from.x) * u, from.y + (to.y - from.y) * u - lift);
        pet.setScale(from.s + (to.s - from.s) * u);
      },
    });
  };

  // ---------------------------------------------------------- the ride

  let rideP = 0;
  let scroll = { x: 0, y: 0 };
  const setRide = (p) => {
    rideP = Math.max(0, Math.min(1, p));
    const k = poseAt(rideP);
    const car = cabinAt(k.t);
    scroll = { x: car.x - k.sx, y: car.y - k.sy };
    near.setPosition(-scroll.x, -scroll.y);
    cabin.setPosition(car.x, car.y).setScale(k.cs);
    if (petWhere === 'cabin') {
      const sp = seatPose(k.cs);
      pet.setPosition(sp.x, sp.y).setScale(sp.s);
    }
    far.setPosition(k.fx, k.fy).setScale(k.fs);
    skyG.setPosition(0, k.fy);
    nightG.setPosition(0, k.fy).setAlpha(k.night);
    starG.setPosition(0, k.fy).setAlpha(Math.min(1, 0.35 + k.night * 2.5));
    mid.setPosition(k.mx, k.my);
    // Only the near sheets that touch the screen are drawn.
    for (const t of tiles) {
      const sx = t.x - scroll.x;
      const sy = t.y - scroll.y;
      t.im.setVisible(sx < W + 40 && sx + t.w > -40 && sy < 1960 && sy + t.h > -40);
    }
    // The summit's live pieces (the ship, its pad plate, the turning blades
    // and the red light) come and go with the summit sheet, and their endless
    // tweens rest while they are off screen.
    const summitOn = summitTile.visible;
    if (summitOn !== summitShown) {
      summitShown = summitOn;
      for (const o of summitProps) o.setVisible(summitOn);
      for (const tw of summitTweens) { if (summitOn) tw.resume(); else tw.pause(); }
    }
    // The uphill cable fades into the dusk over the last stretch to the dock.
    const u = Math.max(0, Math.min(1, (rideP - 0.9) / 0.1));
    cableUp.setAlpha(1 - 0.85 * u * u * (3 - 2 * u));
    return rd;
  };

  // ---------------------------------------------------------- lights

  const fadeIn = (target, ms, to = 1) => tweenP({ targets: target, alpha: to, duration: ms, ease: 'Sine.easeOut' });

  const lightPlace = (id, ms = 450) => {
    const pl = places[id];
    if (!pl || pl.on) return Promise.resolve();
    pl.on = true;
    const base0 = PLACES[id].glow;
    pl.glow.setScale(base0 * 0.8);
    return Promise.all([
      tweenP({ targets: pl.glow, alpha: 1, scale: base0, duration: ms, ease: 'Sine.easeOut' }),
      fadeIn(pl.lit, ms),
    ]);
  };

  const lightLamp = (i, ms = 320) => {
    const l = lamps[i];
    if (!l || l.lit) return Promise.resolve();
    l.lit = true;
    l.off.setVisible(false);
    const s = l.on.scaleX;
    l.on.setScale(s * 0.6);
    return tweenP({ targets: l.on, alpha: 1, scale: s, duration: ms, ease: 'Back.easeOut' });
  };

  const lightCityGroup = (i, ms = 380) => {
    const g = groups[i];
    if (!g || g.alpha >= 1) return Promise.resolve();
    return fadeIn(g, ms);
  };

  const setShoreLights = (a) => { shore.setAlpha(Math.max(0, Math.min(1, a))); return rd; };
  const fadeShoreLights = (a, ms = 1200) => fadeIn(shore, ms, a);

  const lightEverything = () => {
    for (const id of PLACE_IDS) {
      const pl = places[id];
      pl.on = true;
      pl.glow.setAlpha(1).setScale(PLACES[id].glow);
      pl.lit.setAlpha(1);
    }
    for (const l of lamps) { l.lit = true; l.off.setVisible(false); l.on.setAlpha(1); }
    groups.forEach((g) => g.setAlpha(1));
    shore.setAlpha(1);
    return rd;
  };

  // ---------------------------------------------------------- idle

  let idle = [];
  let swayTween = null;
  const sway = (amp = 1.6, period = 2800) => {
    if (swayTween) swayTween.stop();
    // Ease out to one side first, then swing side to side, so it never jumps.
    const first = track({
      targets: cabin, angle: amp, duration: period / 4, ease: 'Sine.easeOut',
      onComplete: () => {
        if (swayTween !== first || destroyed) return;
        swayTween = track({ targets: cabin, angle: -amp, duration: period / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      },
    });
    swayTween = first;
    return first;
  };
  const settle = (ms = 700) => {
    if (swayTween) { swayTween.stop(); swayTween = null; }
    return tweenP({ targets: cabin, angle: 0, duration: ms, ease: 'Sine.easeOut' });
  };
  const startIdle = () => {
    if (idle.length) return;
    const lit = [...stationLamps, ...lamps.filter((l) => l.lit)];
    lit.forEach((l, i) => {
      idle.push(track({ targets: l.on, alpha: 0.72, duration: 1500 + (i % 5) * 230, delay: (i * 170) % 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    });
    // The place glows breathe by size, not by fading: a fainter glow over the
    // violet would turn tan again.
    PLACE_IDS.forEach((id, i) => {
      const pl = places[id];
      if (pl.on) idle.push(track({ targets: pl.glow, scale: PLACES[id].glow * 1.06, duration: 1900 + i * 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    });
    sway(1.2, 3600);
  };
  const stopIdle = () => {
    idle.forEach((tw) => tw.stop());
    idle = [];
    for (const l of [...stationLamps, ...lamps]) if (l.lit) l.on.setAlpha(1);
    for (const id of PLACE_IDS) if (places[id].on) places[id].glow.setAlpha(1).setScale(PLACES[id].glow);
    return settle(500);
  };

  // ---------------------------------------------------------- context restore

  // Canvas textures re-upload by themselves after a lost WebGL context; this
  // just makes sure each one is marked fresh.
  const renderer = scene.sys.game.renderer;
  const onRestore = () => {
    for (const b of baked) {
      const tex = scene.textures.get(b.key);
      if (tex && typeof tex.refresh === 'function') tex.refresh();
    }
  };
  if (renderer && typeof renderer.on === 'function') renderer.on('restorewebgl', onRestore);
  // Clean up with the scene too, in case the credits forget: Dad's Menu can
  // replay the ending in the same scene, and every baked texture must go.
  const onShutdown = () => destroy();
  scene.events.once('shutdown', onShutdown);
  scene.events.once('destroy', onShutdown);

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    for (const tw of tweens) tw.stop();
    tweens.clear();
    for (const r of pending) r();
    pending.clear();
    for (const o of [skyG, nightG, starG, far, mid, near]) o.destroy();
    for (const b of baked) if (scene.textures.exists(b.key)) scene.textures.remove(b.key);
    if (renderer && typeof renderer.off === 'function') renderer.off('restorewebgl', onRestore);
    scene.events.off('shutdown', onShutdown);
    scene.events.off('destroy', onShutdown);
  };

  const rd = {
    beats: { ...RIDE_BEATS },
    setRide,
    get ride() { return rideP; },
    cabin,
    sway,
    settle,
    openDoor: (ms = 260) => Promise.all([fadeIn(doorOpen, ms), fadeIn(doorShut, ms, 0)]),
    closeDoor: (ms = 260) => Promise.all([fadeIn(doorOpen, ms, 0), fadeIn(doorShut, ms)]),
    pet,
    get petWhere() { return petWhere; },
    board: ({ duration = 900 } = {}) => {
      if (petWhere === 'cabin') return Promise.resolve();
      toCabin(false);
      petWhere = 'hopping';
      return hop(() => seatPose(cabin.scaleX), duration)
        .then(() => { if (!destroyed) toCabin(true); });
    },
    alight: ({ duration = 900 } = {}) => {
      if (petWhere === 'dock') return Promise.resolve();
      toCabin(pet.parentContainer !== cabin);
      petWhere = 'hopping';
      const d = deckSpot.dock;
      return hop(() => ({ ...nearToCabin(d.x, d.y), s: d.s / cabin.scaleX }), duration).then(() => {
        if (destroyed) return;
        toNear();
        near.bringToTop(pet);
        pet.setPosition(d.x, d.y).setScale(d.s).setAngle(0);
        setShadow(true);
        petWhere = 'dock';
      });
    },
    setPetAt: (where) => {
      if (where === 'cabin') {
        toCabin(true);
      } else {
        toNear();
        near.bringToTop(pet);
        const d = deckSpot[where] || deckSpot.summit;
        pet.setPosition(d.x, d.y).setScale(d.s).setAngle(0);
        setShadow(true);
        petWhere = where;
      }
      return rd;
    },
    placeIds: [...PLACE_IDS],
    lightPlace,
    lampCount: lamps.length,
    lamps: lamps.map((l) => ({ where: l.where, layer: l.layer })),
    lightLamp,
    cityGroupCount: groups.length,
    lightCityGroup,
    setShoreLights,
    fadeShoreLights,
    lightEverything,
    startIdle,
    stopIdle,
    toScreen: (x, y) => ({ x: x - scroll.x, y: y - scroll.y }),
    layers: { sky: skyG, night: nightG, stars: starG, far, mid, near },
    textures: baked.map((b) => ({ ...b })),
    textureBytes: baked.reduce((s, b) => s + b.w * b.h * 4, 0),
    destroy,
  };
  setRide(0);
  return rd;
}
