// The Chapter 3 paper map sheet: the family's city on its real (stretched,
// smoothed) coast, in the Paper Cutout style J picked. Background only: no
// route, no stops, no landmarks that come and go. The road is the map's own
// paper tube (src/maps/routeRender.js), and the dome's small ink glyph is laid
// on top by src/maps/ch3Map.js until the dome is found.
//
// The whole sheet is painted ONCE with the Canvas 2D API into one canvas
// texture and shown as a single Image at depth -10, so it costs one quad a
// frame. The texture is kept between map builds (it never changes), and a
// canvas texture goes back to the GPU by itself after a lost WebGL context.
// Every translucent layer is first drawn opaque on a scratch canvas and then
// laid down in one pass at its own alpha, so nothing inside a layer
// double-darkens where its shapes overlap (the water is one fill, the parks
// are one fill, the grid is one fill).
//
// Style, as chosen: paper 0xf6ecd6 with two soft darker patches; water
// 0x3a8fb5 at MAP_INK x 1.1; the land's hard offset shadow falling a few px
// south onto the water at 0.22; one soft light wave line about 7 px inside
// every shore; a 3.5 px printed ink coastline; rounded park blobs; the range
// standing right behind the north bank (far wall lighter, tallest peak under
// the last stop at x 860, nothing above y 262, where the map header has faded
// out); downtown blocks between the harbour and the creek; a thin street grid
// (square on the south side, 45 degrees downtown) with a few slightly stronger
// main roads; the river at the foot. Plain shapes only: no rays, no spirals,
// no star shapes.
//
// Map data © OpenStreetMap contributors, heavily stylised (see cityGeom.js).

import { WATER_RINGS, PARK_RINGS, shoreRuns } from './cityGeom.js';

const PAPER = 0xf6ecd6;      // the sheet
const MAP_INK = 0.34;       // the headline ink alpha the owner chose; every layer scales off it
const INK = 0x4a3b2c;
const WATER = 0x3a8fb5;
const PARK = 0x6fae5a;
const W = 1080;

// The last stop's x, which the tallest peak stands under. A drawing constant:
// the sheet never reads the stop table, so moving a stop never folds the range.
const TALL_X = 860;

// ------------------------------------------------------------ the range
// Apex lines run west to east. The wall's foot is not listed: each range is
// closed along a line through the harbour water and then trimmed to the land,
// so its foot sits exactly on the new north bank whatever the coast does.
// Vertices are rounded (radius RANGE_R) the way cut paper rounds a peak.
const RANGE_R = 7;
const FAR_APEX = [
  [-12, 332], [30, 314], [66, 324], [104, 306], [146, 320], [188, 304], [228, 316],
  [270, 302], [318, 314], [360, 300], [404, 312], [446, 298], [492, 312], [536, 296],
  [580, 310], [622, 298], [664, 314], [706, 300], [748, 312], [790, 296], [832, 308],
  [872, 300], [912, 314], [954, 298], [998, 312], [1040, 298], [1094, 310],
];
// The near range keeps today's weight: peaks about 110 to 170 px above the
// shore, valleys dipping to within about 35 px of it, the pair of horns to
// the west and the one tall peak standing proud under the last stop.
const NEAR_APEX = [
  [-12, 420], [18, 384], [46, 356], [72, 340], [94, 348], [120, 372], [148, 404], [172, 424],
  [198, 388], [222, 352], [246, 322],
  [264, 294], [281, 322], [298, 292], [315, 320],          // the pair of horns
  [334, 364], [354, 410], [372, 440],                       // the first valley
  [394, 404], [418, 366], [442, 340], [464, 346], [486, 366],
  [510, 340], [534, 318], [554, 310], [576, 328],           // the west massif
  [602, 368], [628, 412], [654, 448], [676, 468],           // the second valley
  [698, 440], [718, 408], [738, 422], [762, 380], [784, 394], [808, 352], [830, 334], [846, 302],
  [TALL_X, 256],                                            // the tallest, under the last stop
  [874, 284], [890, 318], [908, 356], [930, 396], [952, 430],
  [976, 396], [1002, 362], [1028, 336], [1052, 354], [1074, 332], [1094, 346],
];
// Through the harbour, between the north bank and the far shore (east to west).
const RANGE_FOOT = [
  [1094, 528], [980, 522], [880, 524], [780, 540], [700, 540], [620, 520], [560, 505],
  [500, 517], [440, 515], [380, 506], [330, 492], [290, 483], [240, 488], [100, 488], [-12, 488],
];

// ------------------------------------------------------------ on the land
// Downtown blocks: [x, baseY, w, h] rounded bars standing on the peninsula
// between the harbour and the creek, in two clusters either side of the big
// store's footprint (kept clear of the stop disc and the route along y 720).
const BLOCKS = [
  [508, 692, 20, 42], [532, 692, 24, 58], [560, 692, 18, 44], [582, 692, 22, 52],
  [780, 690, 20, 44], [804, 690, 26, 64], [834, 690, 18, 48], [856, 690, 24, 72], [884, 690, 18, 42],
];
// Where the grid turns 45 degrees: the downtown peninsula (its outline only
// matters on land; the water and parks are cut out of the grid anyway).
const DOWNTOWN = [
  [250, 690], [380, 600], [600, 556], [910, 556], [910, 900], [700, 930],
  [530, 930], [420, 905], [330, 800],
];
const GRID_STEP = 96;
const GRID_ORIGIN = 48;
const GRID_TOP = 526;      // the north bank sits under the range; no grid there
const DIAG_STEP = 68;      // the 45 degree lattice, about the same density
// Main roads, a touch stronger: two on the square grid, one across downtown.
const MAIN_ROADS = [
  [[624, 960], [624, 1640]],
  [[0, 1104], [1080, 1104]],
  [[400, 640], [640, 880]],
];
// The one big bridge, over the narrows between the park's tip and the north bank.
const BIG_BRIDGE = { x: 298, y0: 452, y1: 514 };

// ------------------------------------------------------------ helpers
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

function scratch(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function ringPath(ctx, ring) {
  ctx.moveTo(ring[0], ring[1]);
  for (let i = 2; i < ring.length; i += 2) ctx.lineTo(ring[i], ring[i + 1]);
  ctx.closePath();
}

function waterPath(ctx) {
  ctx.beginPath();
  for (const r of WATER_RINGS) ringPath(ctx, r);
}

function landPath(ctx, h, dy = 0) {
  ctx.beginPath();
  ctx.rect(-40, -40 + dy, W + 80, h + 80);
  for (const r of WATER_RINGS) {
    ctx.moveTo(r[0], r[1] + dy);
    for (let i = 2; i < r.length; i += 2) ctx.lineTo(r[i], r[i + 1] + dy);
    ctx.closePath();
  }
}

function shorePath(ctx) {
  ctx.beginPath();
  for (const r of WATER_RINGS) {
    for (const run of shoreRuns(r)) {
      ctx.moveTo(run[0], run[1]);
      for (let i = 2; i < run.length; i += 2) ctx.lineTo(run[i], run[i + 1]);
    }
  }
}

function polyPath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

// A closed polygon with every corner rounded to radius r (clamped to fit).
function roundedPolyPath(ctx, pts, r) {
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  ctx.beginPath();
  const m0 = mid(pts[n - 1], pts[0]);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const m = mid(p, q);
    ctx.arcTo(p[0], p[1], m[0], m[1], r);
  }
  ctx.closePath();
}

/**
 * Paint the whole sheet into a 2D context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ink?: number, height?: number}} [opts]
 */
export function paintCitySheet(ctx, opts = {}) {
  const a = opts.ink ?? MAP_INK;
  const h = opts.height ?? 1920;
  const L = scratch(W, h);
  const lc = L.getContext('2d');
  const begin = () => {
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    lc.globalAlpha = 1;
    lc.clearRect(0, 0, W, h);
    lc.lineJoin = 'round';
    lc.lineCap = 'round';
  };
  const lay = (alpha) => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(L, 0, 0);
    ctx.restore();
  };

  // The sheet, with two soft darker patches so it reads as paper, not a fill.
  ctx.save();
  ctx.fillStyle = hex(PAPER);
  ctx.fillRect(0, 0, W, h);
  ctx.globalAlpha = 0.035;
  ctx.fillStyle = hex(INK);
  ctx.beginPath(); ctx.ellipse(W * 0.78, h * 0.30, W * 0.55, h * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(W * 0.2, h * 0.82, W * 0.45, h * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // All the water in ONE pass.
  begin();
  lc.fillStyle = hex(WATER);
  waterPath(lc); lc.fill('evenodd');
  lay(a * 1.1);

  // The land's hard offset shadow, falling 8 px south onto the water.
  begin();
  lc.fillStyle = '#000000';
  landPath(lc, h, 8); lc.fill('evenodd');
  lc.globalCompositeOperation = 'destination-in';
  waterPath(lc); lc.fill('evenodd');
  lay(0.22);

  // One soft light wave line, 7.5 to 11 px inside every shore.
  begin();
  lc.strokeStyle = '#ffffff';
  shorePath(lc); lc.lineWidth = 22; lc.stroke();
  lc.globalCompositeOperation = 'destination-out';
  shorePath(lc); lc.lineWidth = 15; lc.stroke();
  lc.globalCompositeOperation = 'destination-in';
  waterPath(lc); lc.fill('evenodd');
  lay(0.5);

  // Parks: rounded blobs, one fill, trimmed at the shore.
  begin();
  lc.fillStyle = hex(PARK);
  lc.beginPath();
  for (const r of PARK_RINGS) ringPath(lc, r);
  lc.fill('nonzero');
  lc.globalCompositeOperation = 'destination-out';
  waterPath(lc); lc.fill('evenodd');
  lay(a * 1.0);

  // The street grid: square on the south side, 45 degrees downtown. Water
  // and parks are cut out of it afterwards.
  begin();
  lc.strokeStyle = hex(INK);
  lc.lineWidth = 2;
  lc.lineCap = 'butt';
  lc.save();
  lc.beginPath();
  lc.rect(0, GRID_TOP, W, h - GRID_TOP);
  lc.moveTo(DOWNTOWN[0][0], DOWNTOWN[0][1]);
  for (const [x, y] of DOWNTOWN.slice(1)) lc.lineTo(x, y);
  lc.closePath();
  lc.clip('evenodd');
  lc.beginPath();
  for (let x = GRID_ORIGIN; x < W; x += GRID_STEP) { lc.moveTo(x, GRID_TOP); lc.lineTo(x, h); }
  for (let y = GRID_ORIGIN + Math.ceil((GRID_TOP - GRID_ORIGIN) / GRID_STEP) * GRID_STEP; y < h; y += GRID_STEP) {
    lc.moveTo(0, y); lc.lineTo(W, y);
  }
  lc.stroke();
  lc.restore();
  lc.save();
  polyPath(lc, DOWNTOWN); lc.clip();
  lc.beginPath();
  for (let c = -2000; c < 3000; c += DIAG_STEP) {
    lc.moveTo(c, 0); lc.lineTo(c + 2000, 2000);        // running south-east
    lc.moveTo(c, 2000); lc.lineTo(c + 2000, 0);        // running north-east
  }
  lc.stroke();
  lc.restore();
  lc.globalCompositeOperation = 'destination-out';
  waterPath(lc); lc.fill('evenodd');
  lc.beginPath();
  for (const r of PARK_RINGS) ringPath(lc, r);
  lc.fill('nonzero');
  lay(a * 0.45);

  // Main roads, slightly stronger, stopping at the water and the parks.
  begin();
  lc.strokeStyle = hex(INK);
  lc.lineWidth = 4;
  lc.lineCap = 'butt';
  lc.beginPath();
  for (const [[x0, y0], [x1, y1]] of MAIN_ROADS) { lc.moveTo(x0, y0); lc.lineTo(x1, y1); }
  lc.stroke();
  lc.globalCompositeOperation = 'destination-out';
  waterPath(lc); lc.fill('evenodd');
  lc.beginPath();
  for (const r of PARK_RINGS) ringPath(lc, r);
  lc.fill('nonzero');
  lay(a * 0.7);

  // Downtown blocks.
  begin();
  lc.fillStyle = hex(INK);
  lc.beginPath();
  for (const [x, baseY, bw, bh] of BLOCKS) lc.roundRect(x, baseY - bh, bw, bh, 4);
  lc.fill();
  lay(a * 1.0);

  // The range: far wall first and lighter, then the near range. Each is
  // trimmed to the land so its foot is the north bank.
  for (const [apex, alpha] of [[FAR_APEX, 0.6], [NEAR_APEX, 1.0]]) {
    begin();
    lc.fillStyle = hex(INK);
    roundedPolyPath(lc, [...apex, ...RANGE_FOOT], RANGE_R);
    lc.fill();
    lc.globalCompositeOperation = 'destination-out';
    waterPath(lc); lc.fill('evenodd');
    lay(a * alpha);
  }

  // The printed ink coastline over everything, so the range's foot and the
  // shore share one crisp line.
  begin();
  lc.strokeStyle = hex(INK);
  lc.lineWidth = 3.5;
  shorePath(lc); lc.stroke();
  lay(a * 1.5);

  // The big bridge over the narrows: a deck and two rails.
  ctx.save();
  ctx.globalAlpha = a * 1.3;
  ctx.fillStyle = hex(INK);
  ctx.beginPath();
  ctx.roundRect(BIG_BRIDGE.x - 8, BIG_BRIDGE.y0, 16, BIG_BRIDGE.y1 - BIG_BRIDGE.y0, 6);
  ctx.fill();
  ctx.strokeStyle = hex(INK);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(BIG_BRIDGE.x - 13, BIG_BRIDGE.y0 + 4); ctx.lineTo(BIG_BRIDGE.x - 13, BIG_BRIDGE.y1 - 4);
  ctx.moveTo(BIG_BRIDGE.x + 13, BIG_BRIDGE.y0 + 4); ctx.lineTo(BIG_BRIDGE.x + 13, BIG_BRIDGE.y1 - 4);
  ctx.stroke();
  ctx.restore();
}

/**
 * Show the sheet: one Image at depth -10. The canvas texture is painted the
 * first time and kept for every later map build.
 * @param {Phaser.Scene} scene
 * @param {{height?: number, depth?: number}} [opts]
 * @returns {Phaser.GameObjects.Image} with bakeMs, the paint time (0 when the
 *   texture was already there)
 */
export function drawCitySheet(scene, opts = {}) {
  const h = opts.height ?? 1920;
  const key = `citySheet_${h}`;
  let bakeMs = 0;
  if (!scene.textures.exists(key)) {
    const t0 = performance.now();
    const tex = scene.textures.createCanvas(key, W, h);
    paintCitySheet(tex.getContext(), { height: h });
    tex.refresh();
    bakeMs = +(performance.now() - t0).toFixed(1);
  }
  const img = scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(opts.depth ?? -10);
  img.bakeMs = bakeMs;
  return img;
}
