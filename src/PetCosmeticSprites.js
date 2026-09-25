// Pixel-art cosmetic overlays for pets. Each cosmetic id has a tiny pixel
// grid drawn at the matching anchor on the pet (head_top / head_eye / neck /
// chest / back). Auras orbit the pet center and animate independently.
//
// renderPetCosmetic(ctx) — ctx is:
//   { scene, parent, item, speciesId, stage, layout, pal, anchor(name) }
//
// Grids use single-character cells. Per-grid palette maps each character to
// a color (number). '.' / ' ' = transparent.

import { darken, lighten } from './colorUtils.js';

const O = 0x07071a;          // outline (very dark)
const W = 0xffffff;           // white highlight

// Generic helper — draw a grid centered at (cx, cy).
function drawSprite(scene, parent, grid, palette, cx, cy, pxSize) {
  const cols = grid[0].length;
  const rows = grid.length;
  const ox = cx - (cols / 2) * pxSize;
  const oy = cy - (rows / 2) * pxSize;
  const g = scene.add.graphics();
  for (let r = 0; r < rows; r++) {
    const line = grid[r];
    for (let c = 0; c < cols; c++) {
      const ch = line[c];
      if (!ch || ch === '.' || ch === ' ') continue;
      const color = palette[ch];
      if (color == null) continue;
      g.fillStyle(color, 1);
      g.fillRect(ox + c * pxSize, oy + r * pxSize, pxSize + 0.5, pxSize + 0.5);
    }
  }
  parent.add(g);
  return g;
}

// ============================================================================
// HATS — snacks first, then a few classics
// ============================================================================

function strawberryHat() {
  const r = 0xff5b6e, h = 0xff8b9b, s = 0x4f956b, k = W;
  return [[
    '....OssO........',
    '...OssOsO.......',
    '..OOssOO........',
    '.ORRRRRRRRO.....',
    'ORHRRkRRRRRO....',
    'ORRRRRRRRRRRO...',
    'ORHRRRRkRRRRRO..',
    '.ORRRRRRRRRRO...',
    '..ORRRRkRRRO....',
    '...ORRRRRRO.....',
    '....ORRRO.......',
    '.....OO.........'
  ], { O, R: r, H: h, s, k }];
}

function bananaHat() {
  const c = 0xffe07a, h = lighten(c, 0.30), d = darken(c, 0.40), b = 0x8b6420;
  return [[
    '............OO.',
    '...........OBO.',
    '..........OBBO.',
    '.........OBBO..',
    '.....OOOOBBO...',
    '....OcccBBOO...',
    '...OcHcccBO....',
    '..OccccccBO....',
    '..OccccccO.....',
    '...OccccO......',
    '....OOOO.......'
  ], { O, c, H: h, B: b, d }];
}

function avocadoHat() {
  const skin = 0x4f956b, flesh = 0x9be8a3, pit = 0x6b3a1a, h = lighten(flesh, 0.25);
  return [[
    '....OOOOOO....',
    '...OssssssO...',
    '..OsffffffsO..',
    '.OsffhhhhffsO.',
    'OsffhhhhhhffsO',
    'OsffhPPPPhhfsO',
    'OsffhPPPPhhfsO',
    '.OsffhhhhffsO.',
    '..OsffhhfsO...',
    '...OssssO.....',
    '....OOOO......'
  ], { O, s: skin, f: flesh, h, P: pit }];
}

function pizzaHat() {
  const crust = 0xc77a4a, cheese = 0xffd86b, sauce = 0xff5b6e, basil = 0x4f956b, p = 0xff8b3d;
  return [[
    '.......OO.......',
    '......OccO......',
    '.....OcccCO.....',
    '....OcccCcCO....',
    '...OcccPCcCcO...',
    '..OcccPccCccCO..',
    '.OccCccccPCccCO.',
    'OccCccPccccCccCO',
    'ObbbbbbbbbbbbbO',
    'OBBBBBBBBBBBBBO',
    '.OOOOOOOOOOOOO.'
  ], { O, c: cheese, C: sauce, P: p, b: crust, B: darken(crust, 0.30) }];
}

function donutHat() {
  const dough = 0xc77a4a, frost = 0xff9ec7, fh = lighten(0xff9ec7, 0.25),
        s1 = 0xfff3b8, s2 = 0xb6e0ff, s3 = 0x9be8a3;
  return [[
    '...OOOOOOOOO....',
    '..OFFFFFFFFFO...',
    '.OFsFFFsFFFsFO..',
    'OFFFsFFFsFFFsFO.',
    'OFsFOOOOOOFFFFO.',
    'OFFOddddOOFsFFO.',
    'OFFOdddddOFFsFO.',
    'OsFOddddOOFsFFO.',
    'OFsFOOOOOOFFFFO.',
    'OFFFsFFFsFFFsFO.',
    '.OFsFFFsFFFsFO..',
    '..OFFFFFFFFFO...',
    '...OOOOOOOOO....'
  ], { O, F: frost, f: fh, d: dough, s: s1 }];
}

function onigiriHat() {
  const w = 0xfafaf0, h = lighten(w, 0.10), n = 0x12122a, s = 0x4f956b;
  return [[
    '......OO......',
    '.....OWWO.....',
    '....OWHHWO....',
    '...OWHHHHWO...',
    '..OWHHHHHHWO..',
    '.OWHHHHHHHHWO.',
    'OWHHHHHHHHHHWO',
    'OWHHHHHHHHHHWO',
    'ONNNNNNNNNNNNO',
    'ONNNNssssNNNNO',
    'ONNNNNNNNNNNNO',
    'OWHHHHHHHHHHWO',
    'OOOOOOOOOOOOOO'
  ], { O, W: w, H: h, N: n, s }];
}

function taiyakiHat() {
  const c = 0xc77a4a, h = lighten(c, 0.30), e = 0x12122a;
  return [[
    '......OO........',
    '.....OBBO.......',
    '....OBBBBOOOO...',
    '...OBHBBBBBBBO..',
    '..OBHBBBBBBBBBO.',
    '.OBHBBeBBBBBBBO.',
    'OBHBBBBBBBBBBBO.',
    'OBHBBBBBBBBBBO..',
    '.OBBBBBBBBBBO...',
    '..OBBBBBBBBO....',
    '...OOOOOOOOOO...'
  ], { O, B: c, H: h, e }];
}

function sushiHat() {
  const rice = 0xfafaf0, riceH = lighten(rice, 0.10), salmon = 0xff8b3d,
        salmonH = lighten(0xff8b3d, 0.30), seaweed = 0x12122a;
  return [[
    '..OOOOOOOOOO....',
    '.OSSSSSSSSSO....',
    'OSHSHSHSHSSO....',
    'OSSSSSSSSSSO....',
    'OnnnnnnnnnnnO...',
    '.OWHHHHHHHHWO...',
    'OWHHHHHHHHHWO...',
    'OWHHHHHHHHHWO...',
    '.OOOOOOOOOOO....'
  ], { O, S: salmon, H: salmonH, n: seaweed, W: rice, h: riceH }];
}

// ============================================================================
// ACCESSORIES
// ============================================================================

function shades(item) {
  const c = item.color, h = 0xffffff;
  return [[
    'OOOOOOOOOOOOOOOO',
    'OBBBBBOOOBBBBBBO',
    'OBHBBBOOOBHBBBBO',
    'OBBBBBOOOBBBBBBO',
    'OOOOOOO.OOOOOOOO'
  ], { O, B: c, H: h }];
}

function dadGlasses() {
  const lens = 0xfff170;
  return [[
    '.OOOOOOOOOOOOOO.',
    'OyyyyyyOOyyyyyyO',
    'OyyyyyyOOyyyyyyO',
    'OyyyyyyyyyyyyyyO',
    'OyyyyyyyyyyyyyyO',
    '.yyyyyyyyyyyyyy.',
    '..yyyyyyyyyyyy..'
  ], { O, y: lens }];
}

function bobaTea(item) {
  const cup = lighten(item.color, 0.30), tea = item.color, lid = 0xfafaf0,
        straw = 0xff5b6e, pearl = 0x12122a;
  return [[
    '..OOOOOOO...',
    '..OLLLLLO...',
    '..OLLLLLO...',
    '..OOOOOOO.OO',
    '.OcTTTTTcOSO',
    'OcTTPTTTTcSO',
    'OcTPPTPPTcOO',
    'OcTTTPTTTcO.',
    'OcTPTTPTTcO.',
    '.OcTTTTTcO..',
    '..OcccccO...',
    '...OOOOO....'
  ], { O, L: lid, c: cup, T: tea, P: pearl, S: straw }];
}

function pockyStick(item) {
  const stick = 0xfafaf0, dip = item.color, dipH = lighten(item.color, 0.30);
  return [[
    'OOOOOOOOOOOOOOOO',
    'OssssssssssDDDDO',
    'OssssssssssDHDDO',
    'OssssssssssDDDDO',
    'OOOOOOOOOOOOOOOO'
  ], { O, s: stick, D: dip, H: dipH }];
}

function cookie(item) {
  const c = item.color, h = lighten(c, 0.20), chip = 0x4a2a1a;
  return [[
    '...OOOOOOOO....',
    '..OBHBBBBHBO...',
    '.OBHBBCBBBBBO..',
    'OBBBCCCBBHBBBO.',
    'OBBHBBBBBCCBBO.',
    'OBBBBHBCCCBBHO.',
    'OBHBCCBBHBBBBO.',
    '.OBBBBBBHBBBO..',
    '..OBHBBBBBBO...',
    '...OOOOOOOO....'
  ], { O, B: c, H: h, C: chip }];
}

function dangoSkewer(item) {
  const stick = 0x8b6420, p = item.color, g = 0x9be8a3, w = 0xfafaf0;
  return [[
    '...OOO..OOO..OOO',
    '..OPPPOOGGGOOWWWO',
    '.OPHPPOGHGGOWHWWO',
    '.OPPPOGGGGGOWWWWO',
    '..OPPOGGGGOWWWWO',
    '...OOOO..OOO..OO',
    'sssssssssssssss.',
    'sssssssssssssss.'
  ], { O, P: p, H: lighten(p, 0.30), G: g, W: w, s: stick }];
}

// ---- TROPICAL FRUITS ----

function pineapple() {
  const y = 0xffd86b, h = 0xfff3b8, d = 0xc88a3a, g = 0x4f956b, G = 0x9be8a3;
  return [[
    '....g.G.g....',
    '...gGgGgGg...',
    '..gGgGGgGgg..',
    '...gGgGggg...',
    '....OOOOO....',
    '...OyhYhYyO..',
    '..OyhYhYhYhO.',
    '.OyhYdyhYhYyO',
    '.OYhyhYhdyhYO',
    '.OyhYhYdyhYhO',
    '.OYhydYhyhYhO',
    '..OYhYhYhYyO.',
    '...OYhyhYhO..',
    '....OOOOO....'
  ], { O, y, Y: y, h, d, g, G }];
}

function mango() {
  const o = 0xff8b3d, h = 0xffd86b, d = 0xc77a4a, g = 0x4f956b;
  return [[
    '.....g.....',
    '....gGg....',
    '....OO.....',
    '...OhhhO...',
    '..OhhhhhhO.',
    '.OhhhHHhhhO',
    '.OhHHhhhhhO',
    '.OhHhhhhhhO',
    '.OohhhhhhhO',
    '.OohhhhhhhO',
    '.OohhhhhhoO',
    '..OohhhohO.',
    '...OoooooO.',
    '....OOOOO..'
  ], { O, o, h, H: 0xfff3b8, d, g, G: 0x9be8a3 }];
}

function watermelon() {
  const r = 0xff5b6e, p = 0xffb3c1, g = 0x4f956b, G = 0x6fb88c, w = 0xfafaf0, s = 0x121225;
  return [[
    '.....OOO.....',
    '....OrprO....',
    '...OrprprO...',
    '..OrprsprpO..',
    '..OprsrprprO.',
    '.OrprprprsrpO',
    '.OprprsprprpO',
    'OrprsprprprprO',  // overshoot will get clamped to row chars
    'OprprprspsrprO',
    '.OwwwwwwwwwwO',
    '.OGgGgGgGgGgO',
    '..OOOOOOOOOO.'
  ], { O, r, p, g, G, w, s }];
}

function coconut() {
  const b = 0x8b6420, h = 0xc77a4a, w = 0xfafaf0, d = 0x4a2a1a, wh = 0xfff3e0;
  return [[
    '....OOOOOO....',
    '..OBdHBBHdBO..',
    '.OBdBHBBHBdBO.',
    '.OBHOOOOOOHBO.',
    '.OBHOwhwwhwOBO',
    '.OBdOwwwhwwOHO',
    '.OBHOwhwwhwOBO',
    '.OBdOwwwhwhOBO',
    '.OBHOOOOOOHBO.',
    '..OBdHBBHdBO..',
    '...OOOOOOOO...'
  ], { O, B: b, H: h, d, w, wh }];
}

// ---- MORE SNACKS ----

function lollipop() {
  const c = 0xff5b6e, p = 0xff9ec7, w = 0xfafaf0, s = 0xc88a3a, sd = 0x8b6420;
  return [[
    '...OOOOO...',
    '..OcpcpcpO.',
    '.OpcwwwcpcO',
    '.OcwcccpwcO',
    'OpwccwcpcwpO',
    'OpcpccpccwcO',
    'OcwccccpcwpO',
    '.OcpwcccwcO.',
    '.OpcpcwcpcO.',
    '..OcpcpcpO..',
    '...OOOOO...',
    '....OsO....',
    '....OsO....',
    '....OsO....',
    '....OOO....'
  ], { O, c, p, w, s, sd }];
}

function icecream() {
  const p = 0xff9ec7, pH = 0xffd6e1, m = 0xfff3b8, ch = 0x4a2a1a, cone = 0xc88a3a, coneH = 0xffd86b;
  return [[
    '....OOOO....',
    '...OmpmpmO..',
    '..OpHpHpHpO.',
    '.OpHpHHHpHpO',
    '.OpHHpHpHHpO',
    '.OmHcHHcHpHO',  // chocolate drips
    '.OpHcccccHpO',
    '..OpHpHpHpO.',
    '...OOOOOO...',
    '...OchchOO..',
    '...OhchhO...',
    '....OchO....',
    '....OhO.....',
    '.....O......'
  ], { O, p, H: pH, m, c: ch, h: coneH }];
}

function popsicle() {
  const b = 0x6ec6ff, h = 0xb6e0ff, d = 0x4a90c2, w = 0xfafaf0, s = 0xc88a3a, sd = 0x8b6420;
  return [[
    '..OOOOOOO..',
    '.ObhbhbhbhO',
    '.OhbhwwwhbO',
    '.ObhwwwwhbO',
    '.OhbhwwwhbO',
    '.ObhbhbhbhO',
    '.OhbhbhbhbO',
    '.ObhbhbhbhO',
    '.OhbhbhbhbO',
    '.ObdbdbdbdO',
    '..OOOOOOO..',
    '....OsO....',
    '....OsO....',
    '....OsO....',
    '....OOO....'
  ], { O, b, h, d, w, s, sd }];
}

function chocolate() {
  const b = 0x7a4a1a, h = 0xc77a4a, hi = 0xe1a878, d = 0x4a2a0a;
  return [[
    '.OOOOOOOOOOOOO.',
    'OdhhhhdhhhhdhdO',
    'OhBBBhBBBhBBBhO',
    'OhBhBhBhBhBhBhO',
    'OhBBBhBBBhBBBhO',
    'OdhhhhdhhhhdhdO',
    'OhBBBhBBBhBBBhO',
    'OhBhBhBhBhBhBhO',
    'OhBBBhBBBhBBBhO',
    'OdhhhhdhhhhdhdO',
    '.OOOOOOOOOOOOO.'
  ], { O, B: b, h, d, hi }];
}

// ---- SPORTS ----

function basketball() {
  const o = 0xff8b3d, h = 0xffae8a, d = 0x121225, dk = 0x8b3d1a;
  return [[
    '....OOOO....',
    '...OohhhoO..',
    '..OhdhhhhdO.',
    '.OhhdhhhhdhO',
    '.OohhhdhdhoO',
    'Ohhddhhhhhdhd',
    'Odhhhhhdhhhho',  // line through middle
    '.OhhdhhhhhdhO',
    '.OohhhhhhhhoO',
    '..OohdhhhdoO.',
    '...OOOOOOOO.',
    '....OOOO....'
  ], { O, o, h, d, dk }];
}

function soccerBall() {
  const w = 0xfafaf0, b = 0x121225, h = 0xd6d6e0;
  return [[
    '....OOOO....',
    '..OwwhhhhwO.',
    '.OwhbbbbbbhO',
    'OwhbwwwwwwbhO',
    'OwhwhbbbbbhwhO',
    'OhwwbhhhhbwhwO',
    'OwhhbhhhhbhwhO',
    'OwhbwwbbwwwbhO',
    '.OwhbbwwwwbbhO',
    '..OwwhbbbbhwO',
    '...OwwhhhwO.',
    '....OOOOO...'
  ], { O, w, b, h }];
}

function baseball() {
  const w = 0xfafaf0, r = 0xd5394a, h = 0xe6e6f0;
  return [[
    '....OOOO....',
    '...OwwhwwO..',
    '..OwrrwwrrwO',
    '.Owrhwwwwhrwo',
    '.OwhwwhhwwhwO',
    '.OwhwwwhwwhwO',
    '.OwrhwwwwhrwO',
    '..OwrrwwrrwO.',
    '...OwwhwwwO.',
    '....OOOOO...'
  ], { O, w, r, h, o: r }];
}

function tennisBall() {
  const c = 0xceee44, h = 0xeefa6e, w = 0xfafaf0, d = 0xa3bc28;
  return [[
    '....OOOO....',
    '..OchchhhcO.',
    '.OchhwwwhhcO',
    'OchhwhhhwhcO',
    'OcchwhhhwhccO',
    'OchwwhhhwhhcO',
    'Ochhwhhhwhhdc',
    '.OchwwhwwhhcO',
    '..OcchhhhccO.',
    '....OOOO....'
  ], { O, c, h, w, d }];
}

// ---- LEGENDARY ----

function starWand() {
  const y = 0xffd86b, h = 0xfff3b8, k = 0xffffff, s = 0xc88a3a, sd = 0x8b6420;
  return [[
    '......k......',
    '......y......',
    '.....kyk.....',
    '....yhyhy....',
    '..k yhkhy k..',
    '.kyhyhkhyhyk.',
    '..yhhykyhhy..',
    '...yhykyhy...',
    '..yhh.k.hhy..',
    '.yhy.....yhy.',
    '..k..s.s..k..',
    '.....s.s.....',
    '.....s.s.....',
    '.....s.s.....',
    '.....OsO.....',
    '.....OsO.....',
    '.....OOO.....'
  ], { O, y, h, k, s, sd }];
}

function trophy() {
  const g = 0xffd86b, h = 0xfff3b8, d = 0x8b6420, b = 0xc88a3a, k = 0xffffff;
  return [[
    'OO..........OO',
    'OgOOO...OOO gO',
    'OghhOOOOOO hgO',
    '.OghhhhhhhhhO.',
    '.OghhhgghhgggO',  // 'k' star highlight inside cup
    '.OghhghhhhhhgO',
    '.OghkhhgghhhhO',
    '.OghhgghhhhhgO',
    '.OghhhhhggghgO',
    '..OghhhhhhhgO.',
    '...OghhhhhgO..',
    '....OgggggO...',
    '.....OdgdO....',
    '.....OdgdO....',
    '...OddddddO...',
    '..OdbbbbbbdO..',
    '..OOOOOOOOOO..'
  ], { O, g, h, d, b, k }];
}

function cosmicOrb() {
  const p = 0xc77eff, h = 0xf3d6ff, c = 0x4ecdc4, k = 0xffffff, d = 0x4a2a55, g = 0xffd86b;
  return [[
    '....OOOOO....',
    '...OphhhhpO..',
    '..OphkhhhkphO',
    '.OphkckhhkckpO',
    'OphkkckhckkhphO',
    'OphhckkkkkkckhpO',  // body brightness peak
    'Ophkkckkkkckhph',
    'OphkkckhhhckkhpO',
    '.OphkhhhhhhkphO',
    '..OphkhhhhkphO.',
    '...OphhhhhpO...',
    '....OOOOOOO...',
    '.....ddOdd....',
    '....OdOOdO....',
    '...OdgOgOdO...',
    '..OdgOOggOdO..',
    '..OOOOOOOOOO..'
  ], { O, p, h, c, k, d, g }];
}

// Dried Mango — a plump amber slice with darker wrinkles + a sugary sheen.
// Earned by crossing the monkey bars in the hidden "Recess" playground (W18).
function driedMango() {
  const m = 0xf2a13a, d = 0xcf7a1c, h = 0xffce82;
  return [[
    '...OOOOOO...',
    '..OmmhhmmO..',
    '.OmhhmmhhmO.',
    'OmmmmddmmmmO',
    'OmmddmmddmmO',
    'OmmmmddmmmmO',
    'OdmmmmmmmmdO',
    '.OdmmmmmmdO.',
    '..OdmmmmdO..',
    '...OdddO....',
    '....OOO.....'
  ], { O, m, d, h }];
}

// Free Cone — a soft-serve vanilla swirl in a plain cake cone. Earned at the
// ice cream machine on the way out of the hidden "Hot Pot Time" line (W19).
// Deliberately distinct from the shop's `acc_icecream` (a pink scoop with
// chocolate drips): this one is the tall white swirl you get for free.
function freeCone() {
  const s = 0xfff6e8, h = 0xffffff, m = 0xe8d5bb, c = 0xd9a05b, k = 0xb07a3a;
  return [[
    '.....OO.....',
    '....OshO....',
    '....OsshO...',
    '...OsshhO...',
    '...OssshhO..',
    '..OsssshhO..',
    '..OmsssshO..',
    '.OmsssssshO.',
    '.OmmssssshO.',
    '..OOOOOOOO..',
    '..OccccckO..',
    '...OcccckO..',
    '....OcckO...',
    '.....OckO...',
    '.....OkO....',
    '......O.....'
  ], { O, s, h, m, c, k }];
}

// Night Noodles — a cup of instant noodles, lid off, still steaming. The trophy
// for clearing the old hidden Night Shift (W20, retired; the Science Dome took
// its place). Kids who won it keep it. Tapered cup so it reads as the
// styrofoam cup rather than the shop's takeout box, and the noodle mound sits
// proud of the rim so it's legible at pet scale.
function nightNoodles() {
  const n = 0xf2d98a, c = 0xf7f2e6, b = 0xc8402e, w = 0xffffff, l = 0xfaeec0;
  return [[
    '............',
    '...OnnnnO...',
    '..OnnlnnlO..',
    '..OnnnnnnO..',
    '.OOOOOOOOOO.',
    '.OccccccccO.',
    '.OccccccccO.',
    '.ObbbbbbbbO.',
    '.ObbwwwwbbO.',
    '.ObbbbbbbbO.',
    '.OccccccccO.',
    '..OccccccO..',
    '..OccccccO..',
    '...OccccO...',
    '...OOOOOO...',
    '............'
  ], { O, n, c, b, w, l }];
}

// Little Dome: a tiny silver geodesic ball on its base, the trophy for lighting
// up the hidden Science Dome (W39). Silver shaded from the top left, a few warm
// gold lights set out in staggered rows like the real panel corners (single
// pixels, gold only), on a red collar and a cream base with two lit windows and
// red trim, the way the real building sits.
function littleDome() {
  const h = 0xe4e6f0, s = 0xb3b7d0, m = 0x8c90b4, d = 0x646892, g = 0xffd98a,
        w = 0xffe9b0, r = 0xe8594a, b = 0xece5d8;
  return [[
    '....OOOO....',
    '..OOhhhsOO..',
    '.OhhhhsssmO.',
    '.OhgsssgsmO.',
    'OhhssssmmmdO',
    'OhsssgmmmgdO',
    'OssssmmmmmdO',
    'OssgmmmgmddO',
    '.OsmmmmmmdO.',
    '.OmmmgmmddO.',
    '..OOmmddOO..',
    '...OrrrrO...',
    '.ObbbbbbbbO.',
    '.ObwbbbbwbO.',
    '.OrrrrrrrrO.',
    '.OOOOOOOOOO.'
  ], { O, h, s, m, d, g, w, r, b }];
}

// `hat_*` drawer ids are preserved because they're what player saves reference.
const ACC_DRAWERS = {
  acc_shades: shades,
  acc_dad_glasses: dadGlasses,
  acc_dried_mango: driedMango,
  acc_free_cone: freeCone,
  acc_noodles: nightNoodles,
  acc_little_dome: littleDome,
  hat_strawberry: strawberryHat,
  hat_banana: bananaHat,
  hat_avocado: avocadoHat,
  hat_pizza: pizzaHat,
  hat_donut: donutHat,
  hat_onigiri: onigiriHat,
  hat_taiyaki: taiyakiHat,
  hat_sushi: sushiHat,
  acc_boba: bobaTea,
  acc_pocky: pockyStick,
  acc_cookie: cookie,
  acc_dango: dangoSkewer,
  acc_pineapple: pineapple,
  acc_mango: mango,
  acc_watermelon: watermelon,
  acc_coconut: coconut,
  acc_lollipop: lollipop,
  acc_icecream: icecream,
  acc_popsicle: popsicle,
  acc_chocolate: chocolate,
  acc_basketball: basketball,
  acc_soccer: soccerBall,
  acc_baseball: baseball,
  acc_tennis: tennisBall,
  acc_star_wand: starWand,
  acc_trophy: trophy,
  acc_cosmic_orb: cosmicOrb
};

const FACE_ACCESSORIES = {
  acc_shades:      'head_eye',
  acc_dad_glasses: 'head_eye'
};

// ============================================================================
// AURAS
// ============================================================================

function drawAura(item, ctx) {
  if (item.id === 'aura_none') return;

  const aura = ctx.scene.add.container(0, 0);
  ctx.parent.add(aura);

  // Built-in aura specs — the big ones get bespoke handlers so each aura feels
  // distinct rather than re-skinned versions of the same orbit.
  if (item.id === 'aura_hearts')    return auraHearts(item, ctx, aura);
  if (item.id === 'aura_orbit')     return auraStarOrbit(item, ctx, aura);
  if (item.id === 'aura_sparkle')   return auraSparkle(item, ctx, aura);
  if (item.id === 'aura_rainbow')   return auraRainbow(item, ctx, aura);
  if (item.id === 'aura_legendary') return auraLegendary(item, ctx, aura);
  if (item.id === 'aura_bubbles')   return auraBubbles(item, ctx, aura);
  if (item.id === 'aura_petals')    return auraPetals(item, ctx, aura);
  if (item.id === 'aura_flame')     return auraFlame(item, ctx, aura);
  if (item.id === 'aura_snow')      return auraSnow(item, ctx, aura);
  if (item.id === 'aura_lightning') return auraLightning(item, ctx, aura);
  if (item.id === 'aura_planets')   return auraPlanets(item, ctx, aura);
  if (item.id === 'aura_galaxy')    return auraGalaxy(item, ctx, aura);
  if (item.id === 'aura_embers')    return auraEmbers(item, ctx, aura);
  if (item.id === 'aura_constellation') return auraConstellation(item, ctx, aura);
  if (item.id === 'aura_microbes')  return auraMicrobes(item, ctx, aura);
  if (item.id === 'aura_bioluminescent') return auraBioluminescent(item, ctx, aura);
}

// Chapter 2 "Inner Space" auras ------------------------------------------------
function auraBioluminescent(item, ctx, aura) {
  // Soft glowing specks orbiting the pet, each gently pulsing in brightness.
  const { rx, ry } = orbitRadii(ctx.layout);
  for (let i = 0; i < 10; i++) {
    const dot = ctx.scene.add.graphics();
    dot.fillStyle(item.color, 0.35);
    dot.fillCircle(0, 0, 6);
    dot.fillStyle(item.color, 1);
    dot.fillCircle(0, 0, 3);
    placeOrbit(dot, i, 10, rx, ry);
    aura.add(dot);
    ctx.scene.tweens.add({
      targets: dot, alpha: { from: 0.4, to: 1 },
      duration: 700 + i * 60, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
  }
  spinAura(ctx.scene, aura, 7000);
}

function auraMicrobes(item, ctx, aura) {
  // Little microbe specks drifting up from the pet's feet, wobbling + fading.
  const baseY = ctx.layout.height * 0.5;
  const spread = ctx.layout.width * 0.6;
  for (let i = 0; i < 6; i++) {
    const launch = () => {
      const m = ctx.scene.add.graphics();
      const r = 3 + Math.random() * 3;
      m.fillStyle(item.color, 0.9);
      m.fillCircle(0, 0, r);
      m.fillStyle(lighten(item.color, 0.3), 1);
      m.fillCircle(-r * 0.3, -r * 0.3, r * 0.4);
      m.x = (Math.random() - 0.5) * spread;
      m.y = baseY;
      aura.add(m);
      ctx.scene.tweens.add({
        targets: m,
        y: -ctx.layout.height * 0.55,
        x: m.x + (Math.random() - 0.5) * 50,
        alpha: 0,
        duration: 2400 + Math.random() * 900,
        ease: 'Sine.easeOut',
        onComplete: () => { m.destroy(); launch(); }
      });
    };
    ctx.scene.time.delayedCall(i * 380, launch);
  }
}

function orbitRadii(layout) {
  return { rx: layout.width * 0.65, ry: layout.height * 0.55 };
}

function placeOrbit(g, i, count, rx, ry, phase = 0) {
  const a = (i / count) * Math.PI * 2 + phase;
  g.x = Math.cos(a) * rx;
  g.y = Math.sin(a) * ry;
}

function spinAura(scene, aura, durationMs, dir = 1) {
  scene.tweens.add({
    targets: aura, angle: 360 * dir,
    duration: durationMs, repeat: -1, ease: 'Linear'
  });
}

function auraSparkle(item, ctx, aura) {
  const { rx, ry } = orbitRadii(ctx.layout);
  const grid = ['..A..', '.AAA.', 'AAAAA', '.AAA.', '..A..'];
  for (let i = 0; i < 7; i++) {
    const dot = ctx.scene.add.graphics();
    drawPixelArt(dot, grid, { A: item.color }, 2);
    placeOrbit(dot, i, 7, rx, ry);
    aura.add(dot);
  }
  spinAura(ctx.scene, aura, 6000);
}

function auraStarOrbit(item, ctx, aura) {
  const { rx, ry } = orbitRadii(ctx.layout);
  const grid = ['..A..', '.AAA.', 'AAAAA', '.A.A.', 'A...A'];
  for (let i = 0; i < 4; i++) {
    const dot = ctx.scene.add.graphics();
    drawPixelArt(dot, grid, { A: item.color }, 2);
    placeOrbit(dot, i, 4, rx, ry);
    aura.add(dot);
  }
  spinAura(ctx.scene, aura, 3000);
}

function auraHearts(item, ctx, aura) {
  const { rx, ry } = orbitRadii(ctx.layout);
  const palette = [0xff9ec7, 0xff5b6e];
  const heart = ['.OO.OO.', 'OBBBBBO', 'OBBBBBO', '.OBBBO.', '..OBO..', '...O...'];
  for (let i = 0; i < 7; i++) {
    const dot = ctx.scene.add.graphics();
    drawPixelArt(dot, heart, { O, B: palette[i % palette.length] }, 2);
    placeOrbit(dot, i, 7, rx, ry);
    aura.add(dot);
  }
  spinAura(ctx.scene, aura, 6000);
}

function auraRainbow(item, ctx, aura) {
  const { rx, ry } = orbitRadii(ctx.layout);
  const palette = [0xff9ec7, 0xffe07a, 0x9be8a3, 0xb6e0ff, 0xc77eff];
  const grid = ['..A..', '.AAA.', 'AAAAA', '.AAA.', '..A..'];
  for (let i = 0; i < 7; i++) {
    const dot = ctx.scene.add.graphics();
    drawPixelArt(dot, grid, { A: palette[i % palette.length] }, 2);
    placeOrbit(dot, i, 7, rx, ry);
    aura.add(dot);
  }
  spinAura(ctx.scene, aura, 6000);
}

function auraLegendary(item, ctx, aura) {
  const palette = [0xfff3b8, 0xffe07a, 0xff9ec7];
  const { rx, ry } = orbitRadii(ctx.layout);
  const grid = ['..A..', '.AAA.', 'AAAAA', '.AAA.', '..A..'];
  for (let i = 0; i < 7; i++) {
    const dot = ctx.scene.add.graphics();
    drawPixelArt(dot, grid, { A: palette[i % palette.length] }, 2);
    placeOrbit(dot, i, 7, rx, ry);
    aura.add(dot);
  }
  spinAura(ctx.scene, aura, 6000);
  ctx.scene.tweens.add({
    targets: aura, scale: { from: 1, to: 1.18 },
    duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
  });
}

function auraBubbles(item, ctx, aura) {
  // Bubbles drift up from the pet's feet and fade. Re-spawn with delays.
  const baseY = ctx.layout.height * 0.5;
  const spread = ctx.layout.width * 0.55;
  const count = 6;
  for (let i = 0; i < count; i++) {
    const launch = () => {
      const bub = ctx.scene.add.graphics();
      const r = 4 + Math.random() * 4;
      bub.lineStyle(1.5, item.color, 1);
      bub.strokeCircle(0, 0, r);
      bub.fillStyle(W, 0.4);
      bub.fillCircle(-r * 0.3, -r * 0.3, r * 0.35);
      bub.x = (Math.random() - 0.5) * spread;
      bub.y = baseY;
      aura.add(bub);
      ctx.scene.tweens.add({
        targets: bub,
        y: -ctx.layout.height * 0.55,
        x: bub.x + (Math.random() - 0.5) * 30,
        alpha: 0,
        duration: 2200 + Math.random() * 800,
        ease: 'Sine.easeOut',
        onComplete: () => { bub.destroy(); launch(); }
      });
    };
    ctx.scene.time.delayedCall(i * 350, launch);
  }
}

function auraPetals(item, ctx, aura) {
  // Drifting petals — each tween loops and respawns from above.
  const spread = ctx.layout.width * 0.6;
  const top = -ctx.layout.height * 0.55;
  const bottom = ctx.layout.height * 0.55;
  const palette = [0xff9ec7, 0xffd6e1, 0xffb6c8];
  const petalGrid = ['.OOO.', 'OPPPO', 'OPHPO', 'OPPPO', '.OOO.'];
  for (let i = 0; i < 7; i++) {
    const launch = () => {
      const petal = ctx.scene.add.graphics();
      const c = palette[Math.floor(Math.random() * palette.length)];
      drawPixelArt(petal, petalGrid, { O, P: c, H: lighten(c, 0.30) }, 1.5);
      petal.x = (Math.random() - 0.5) * spread;
      petal.y = top;
      petal.angle = Math.random() * 360;
      aura.add(petal);
      ctx.scene.tweens.add({
        targets: petal,
        y: bottom,
        x: petal.x + (Math.random() - 0.5) * 40,
        angle: petal.angle + 180,
        duration: 3000 + Math.random() * 1500,
        ease: 'Sine.easeIn',
        onComplete: () => { petal.destroy(); launch(); }
      });
    };
    ctx.scene.time.delayedCall(i * 400, launch);
  }
}

function auraFlame(item, ctx, aura) {
  // Ring of flickering flame pixels at the base.
  const { rx } = orbitRadii(ctx.layout);
  const baseY = ctx.layout.height * 0.45;
  const flameColors = [0xff5b6e, 0xff8b3d, 0xffd86b];
  for (let i = 0; i < 9; i++) {
    const flame = ctx.scene.add.graphics();
    const ang = (i / 9) * Math.PI - Math.PI / 2;
    flame.x = Math.cos(ang) * rx * 0.85;
    flame.y = baseY + Math.sin(ang) * 6;
    const grid = ['..A..', '.ABA.', 'ABCBA', 'ABCBA', '.ACA.'];
    drawPixelArt(flame, grid, { A: flameColors[0], B: flameColors[1], C: flameColors[2] }, 2);
    aura.add(flame);
    ctx.scene.tweens.add({
      targets: flame,
      scaleY: { from: 1, to: 1.4 },
      alpha: { from: 0.85, to: 1 },
      duration: 250 + Math.random() * 250,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      delay: Math.random() * 200
    });
  }
}

function auraSnow(item, ctx, aura) {
  // Snowflakes orbit slowly while gently drifting.
  const { rx, ry } = orbitRadii(ctx.layout);
  const flake = ['.OAO.', 'OAAAO', 'AAAAA', 'OAAAO', '.OAO.'];
  for (let i = 0; i < 9; i++) {
    const dot = ctx.scene.add.graphics();
    drawPixelArt(dot, flake, { O: lighten(item.color, 0.20), A: W }, 1.5);
    placeOrbit(dot, i, 9, rx, ry * 0.9);
    aura.add(dot);
    ctx.scene.tweens.add({
      targets: dot, scale: { from: 0.8, to: 1.1 },
      duration: 1200 + Math.random() * 600,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
  }
  spinAura(ctx.scene, aura, 9000);
}

function auraLightning(item, ctx, aura) {
  // Three lightning bolts crackle around the pet, blinking on/off.
  const { rx, ry } = orbitRadii(ctx.layout);
  const bolt = [
    '...AA',
    '..AA.',
    '.AAAA',
    '..AA.',
    '.AA..',
    'AA...'
  ];
  for (let i = 0; i < 4; i++) {
    const z = ctx.scene.add.graphics();
    drawPixelArt(z, bolt, { A: item.color }, 2);
    placeOrbit(z, i, 4, rx, ry, Math.PI / 4);
    z.alpha = 0;
    aura.add(z);
    ctx.scene.tweens.add({
      targets: z, alpha: { from: 0, to: 1 },
      duration: 100, hold: 80, yoyo: true,
      repeat: -1, repeatDelay: 400 + Math.random() * 600,
      delay: i * 220, ease: 'Linear'
    });
  }
}

function auraPlanets(item, ctx, aura) {
  // Three tiny planets orbiting at different radii and speeds.
  const baseRx = ctx.layout.width * 0.58;
  const baseRy = ctx.layout.height * 0.46;
  const planets = [
    { color: 0xff5b6e, r: 4, scale: 0.85, speed: 4200 },
    { color: 0x9be8a3, r: 3, scale: 1.05, speed: 5600 },
    { color: 0xb6e0ff, r: 5, scale: 1.20, speed: 7200 }
  ];
  planets.forEach((p, i) => {
    const orbit = ctx.scene.add.container(0, 0);
    const dot = ctx.scene.add.graphics();
    dot.fillStyle(p.color, 1);
    dot.fillCircle(0, 0, p.r);
    dot.fillStyle(lighten(p.color, 0.40), 1);
    dot.fillCircle(-p.r * 0.3, -p.r * 0.3, p.r * 0.4);
    dot.x = baseRx * p.scale;
    dot.y = 0;
    orbit.add(dot);
    orbit.angle = (i / planets.length) * 360;
    orbit.scaleY = baseRy / baseRx;
    aura.add(orbit);
    ctx.scene.tweens.add({
      targets: orbit, angle: orbit.angle + 360,
      duration: p.speed, repeat: -1, ease: 'Linear'
    });
  });
}

function auraGalaxy(item, ctx, aura) {
  // Concentric rings of stars around a bright core — a star cluster, not a
  // swirling spiral/vortex (each dot's angle is independent of its radius).
  const { rx, ry } = orbitRadii(ctx.layout);
  const palette = [0xfff3b8, 0xffd86b, 0xc77eff, 0xb6e0ff];
  const rings = [
    { rad: 0.42, count: 6, dot: 3 },
    { rad: 0.72, count: 9, dot: 2.5 },
    { rad: 1.00, count: 12, dot: 2 },
  ];
  rings.forEach((ring, ri) => {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * Math.PI * 2 + ri * 0.4;
      const dot = ctx.scene.add.graphics();
      dot.fillStyle(palette[(i + ri) % palette.length], 0.9);
      dot.fillCircle(0, 0, ring.dot);
      dot.x = Math.cos(angle) * rx * ring.rad;
      dot.y = Math.sin(angle) * ry * ring.rad;
      aura.add(dot);
    }
  });
  // Bright center
  const core = ctx.scene.add.graphics();
  core.fillStyle(0xfff3b8, 0.9);
  core.fillCircle(0, 0, 4);
  core.fillStyle(W, 1);
  core.fillCircle(0, 0, 2);
  aura.add(core);
  spinAura(ctx.scene, aura, 9000);
  ctx.scene.tweens.add({
    targets: core, scale: { from: 0.9, to: 1.4 },
    duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
  });
}

// Rising embers — chunky pixel sparks float up from the pet's feet, fade out.
function auraEmbers(item, ctx, aura) {
  const spread = ctx.layout.width * 0.55;
  const baseY = ctx.layout.height * 0.5;
  const top = -ctx.layout.height * 0.55;
  const palette = [0xff5b3d, 0xff8b3d, 0xffd86b, 0xfff3b8];
  const sparkGrid = ['.A.', 'AKA', '.A.'];
  for (let i = 0; i < 8; i++) {
    const launch = () => {
      const ember = ctx.scene.add.graphics();
      const c = palette[Math.floor(Math.random() * palette.length)];
      drawPixelArt(ember, sparkGrid, { A: c, K: lighten(c, 0.45) }, 1.4 + Math.random() * 1.0);
      ember.x = (Math.random() - 0.5) * spread;
      ember.y = baseY;
      aura.add(ember);
      ctx.scene.tweens.add({
        targets: ember,
        y: top + Math.random() * 30,
        x: ember.x + (Math.random() - 0.5) * 50,
        alpha: { from: 1, to: 0 },
        scale: { from: 1, to: 0.5 },
        duration: 1500 + Math.random() * 900,
        ease: 'Quad.easeOut',
        onComplete: () => { ember.destroy(); launch(); }
      });
    };
    ctx.scene.time.delayedCall(i * 240, launch);
  }
}

// Constellation — five stars connected by faint lines, slowly rotating.
function auraConstellation(item, ctx, aura) {
  const { rx, ry } = orbitRadii(ctx.layout);
  const palette = [0xfff3b8, 0xb6e0ff, 0xffe07a, 0xffffff, 0xc77eff];
  // An irregular "W" asterism (Cassiopeia-like) rather than 5 evenly-spaced
  // points. Joining evenly-spaced points every-other-vertex traced a pentagram;
  // a scattered cluster linked by an OPEN star-chart line reads as a real
  // constellation and never closes into a star or polygon.
  const shape = [
    { x: -1.00, y: -0.25 },
    { x: -0.50, y:  0.45 },
    { x:  0.00, y: -0.15 },
    { x:  0.50, y:  0.55 },
    { x:  1.00, y: -0.35 },
  ];
  const positions = shape.map((s) => ({ x: s.x * rx, y: s.y * ry }));
  // Faint connecting lines (drawn first, behind stars) — an open trace through
  // the points in order, never closing the path.
  const links = ctx.scene.add.graphics();
  links.lineStyle(1, item.color, 0.55);
  for (let i = 0; i < positions.length - 1; i++) {
    links.lineBetween(positions[i].x, positions[i].y, positions[i + 1].x, positions[i + 1].y);
  }
  aura.add(links);
  const grid = ['..A..', '.AAA.', 'AAAAA', '.A.A.', 'A...A'];
  positions.forEach((pos, i) => {
    const star = ctx.scene.add.graphics();
    drawPixelArt(star, grid, { A: palette[i % palette.length] }, 2);
    star.x = pos.x;
    star.y = pos.y;
    aura.add(star);
    ctx.scene.tweens.add({
      targets: star,
      scale: { from: 0.85, to: 1.15 },
      alpha: { from: 0.75, to: 1 },
      duration: 900 + i * 160,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
  });
  spinAura(ctx.scene, aura, 9000);
}

function drawPixelArt(g, grid, palette, px) {
  const cols = grid[0].length;
  const rows = grid.length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = grid[r][c];
      if (!ch || ch === '.' || ch === ' ') continue;
      const color = palette[ch];
      if (color == null) continue;
      g.fillStyle(color, 1);
      g.fillRect((c - cols / 2) * px, (r - rows / 2) * px, px + 0.5, px + 0.5);
    }
  }
}

// ============================================================================
// Public dispatcher
// ============================================================================

export function renderPetCosmetic(ctx) {
  const id = ctx.item.id;
  const layout = ctx.layout;
  // REF_ROWS is adult body height; smaller stages shrink cosmetics proportionally.
  const REF_ROWS = 18;
  const sizeRatio = Math.min(1, layout.rows / REF_ROWS);
  const px = layout.pixelSize * 0.95 * sizeRatio;

  if (id === 'aura_none') return;

  if (id.startsWith('aura_')) {
    drawAura(ctx.item, ctx);
    return;
  }

  if (ACC_DRAWERS[id]) {
    const data = ACC_DRAWERS[id](ctx.item);
    if (!data) return;
    const [grid, palette] = data;
    const faceAnchor = FACE_ACCESSORIES[id];
    let pos;
    if (faceAnchor) {
      const a = ctx.anchor(faceAnchor);
      pos = { x: a.x, y: a.y };
    } else {
      const a = ctx.anchor('neck');
      const gridCols = grid[0].length;
      pos = { x: ctx.layout.width / 2 + (gridCols / 2) * px - px, y: a.y };
    }
    drawSprite(ctx.scene, ctx.parent, grid, palette, pos.x, pos.y, px);
    return;
  }
}
