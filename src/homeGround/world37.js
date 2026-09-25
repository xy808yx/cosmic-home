// World 37, The Seawall. The seventh stop of the Saturday, golden hour, half
// past seven in the evening. The sky pair is golden-hour gold over the water's
// teal, one step before the finale's dusk violet.
//
// Wave 2 line: the little ferries. A little passenger ferry rides the line
// with the fact on its roof, the docks across the water are the bins, and the
// pet is the dock hand. This is also the world where the Science Dome's crate
// (the one with the dome sticker) rides; it is drawn in ConveyorScene, not here.
//
// Cues, in plain words: the little rainbow-striped ferries crossing the water,
// the seawall path with its rail, two parked bikes and a stroller, the big
// round dome across the water with the towers beside it, the bridge off to
// the left, the long paddling boats tied up at the boathouse dock, the two
// giant bird sculptures standing on the plaza, and the little sandy cove
// tucked under the wall. The sun sits low over the far mountains and lays a
// gold path across the water.
//
// Paper Cutout style: every prop goes through paper() so it gets the hard
// offset shadow; rounded corners, no outlines, no gradients, thin strokes only
// for the bridge cables, the rail, the stroller handle and the bike frames.
// The sun is a soft ellipse glow under a plain disc and the dome is a plain
// half disc: plain shapes only, no spirals or sunbursts, no rays. The paddling
// boats have plain rounded prows and no carved heads (no cultural carvings
// anywhere in the chapter).

import { W, ink, inkLine, paper, haze, ridge, waterBand, sunDisc } from './paper.js';

// Palette for this stop. Water sits between the chapter's water anchor and
// this world's own teal; the gold is this world's accent.
const WATER = 0x3a8fa8;
const GOLD = 0xffcf7a;
const SUN = 0xffe08a;
const FAR_RIDGE = 0x8e8ab8;   // hazy lavender mountains across the water
const NEAR_RIDGE = 0x5c6a8a;  // the closer, darker slope on the right
const SHORE = 0x3f5a4a;
const TOWER = 0xd8c4b0;       // far towers catching the low sun
const TOWER_DARK = 0xc4b0a0;
const SILVER = 0xe6e8ec;      // the dome and the bridge cables
const STEEL = 0x7a8898;       // bridge deck and towers
const CREAM = 0xfff8e7;       // ferry hulls and cabins
const WINDOW = 0xbfe3f5;
const RAINBOW = [0xe8594a, 0xffcf7a, 0x6fbf5a, 0x3a8fb5];
const RED = 0xe8594a;
const STONE = 0x8a949c;       // the seawall face
const COPING = 0xd9d2c4;      // the pale stone along the top of the wall
const PATH = 0xd6cbb8;        // the paved path, warm in the evening light
const SAND = 0xefe0b0;
const WET = 0xd8c493;
const RAIL = 0x5a6068;
const DARK = 0x2a2f36;        // wheels
const DOCK = 0xd9c8a8;
const BIRD = 0xf2f2ee;
const BEAK = 0xe8a33a;

// One paper pass over a list of rounded rects: [[color, x, y, w, h, radius], ...].
// Every shadow lands first, then the shapes, so a row never shadows its neighbours.
function cuts(g, list, dx = 4, dy = 6) {
  paper(g, dx, dy, (gg, shadow) => {
    for (const [color, x, y, w, h, r] of list) {
      ink(gg, shadow, color);
      gg.fillRoundedRect(x, y, w, h, r);
    }
  });
}

// A little passenger ferry, side on, heading right: a cream hull with the
// rainbow band, a cabin with one long window strip, and a flat pale roof (the
// fact rides there in wave 2). cx is the hull centre, wy the waterline.
function ferry(g, cx, wy, s) {
  paper(g, 4, 6, (gg, shadow) => {
    ink(gg, shadow, CREAM);
    gg.fillRoundedRect(cx - 30 * s, wy - 18 * s, 60 * s, 18 * s, 6 * s);
    gg.fillRoundedRect(cx - 20 * s, wy - 31 * s, 40 * s, 15 * s, 5 * s);
    gg.fillRoundedRect(cx - 23 * s, wy - 35 * s, 46 * s, 6 * s, 3 * s);
    RAINBOW.forEach((color, i) => {
      ink(gg, shadow, color);
      gg.fillRect(cx - 28 * s, wy - 14 * s + i * 2.5 * s, 56 * s, 2.5 * s);
    });
    ink(gg, shadow, WINDOW);
    gg.fillRoundedRect(cx - 16 * s, wy - 28 * s, 32 * s, 7 * s, 2 * s);
  });
}

// A parked bike, side on. x is the frame centre, fy where the wheels touch.
// The frame is the classic diamond in thin strokes (allowed for spars).
function bike(g, x, fy, color, s = 1) {
  const hub = fy - 12 * s;
  const seat = [x - 8 * s, fy - 38 * s], head = [x + 16 * s, fy - 36 * s], pedal = [x + 2 * s, fy - 16 * s];
  paper(g, 4, 6, (gg, shadow) => {
    ink(gg, shadow, DARK);
    gg.fillCircle(x - 22 * s, hub, 12 * s);
    gg.fillCircle(x + 22 * s, hub, 12 * s);
    inkLine(gg, shadow, 3 * s, color);
    gg.lineBetween(x - 22 * s, hub, seat[0], seat[1]);
    gg.lineBetween(seat[0], seat[1], head[0], head[1]);
    gg.lineBetween(head[0], head[1], x + 22 * s, hub);
    gg.lineBetween(seat[0], seat[1], pedal[0], pedal[1]);
    gg.lineBetween(pedal[0], pedal[1], head[0], head[1]);
    gg.lineBetween(x - 22 * s, hub, pedal[0], pedal[1]);
    ink(gg, shadow, DARK);
    gg.fillRoundedRect(x - 15 * s, fy - 43 * s, 14 * s, 5 * s, 2 * s);
    gg.fillRoundedRect(x + 12 * s, fy - 41 * s, 12 * s, 4 * s, 2 * s);
  });
  g.fillStyle(0xd7e3ea, 1);
  g.fillCircle(x - 22 * s, hub, 3 * s);
  g.fillCircle(x + 22 * s, hub, 3 * s);
}

// A parked stroller, side on: a round hood over a boxy seat, two small
// wheels, and a handle rising off the back (one thin stroke with a knob).
function stroller(g, x, fy) {
  paper(g, 4, 6, (gg, shadow) => {
    ink(gg, shadow, 0x6a6fa8);
    gg.fillCircle(x - 8, fy - 34, 17);
    ink(gg, shadow, 0x4a4f6a);
    gg.fillRoundedRect(x - 22, fy - 34, 44, 20, 8);
    ink(gg, shadow, DARK);
    gg.fillCircle(x - 13, fy - 7, 7);
    gg.fillCircle(x + 13, fy - 7, 7);
    gg.fillCircle(x + 32, fy - 55, 4);
    inkLine(gg, shadow, 4, DARK);
    gg.lineBetween(x + 18, fy - 30, x + 32, fy - 54);
  });
}

// One of the giant bird sculptures: a chunky rounded bird standing tall on
// two thick legs, all plain shapes. x is where it stands, fy the ground line.
function bird(g, x, fy, s) {
  paper(g, 4, 6, (gg, shadow) => {
    ink(gg, shadow, BIRD);
    gg.fillRoundedRect(x - 12 * s, fy - 26 * s, 6 * s, 26 * s, 3 * s);
    gg.fillRoundedRect(x + 2 * s, fy - 26 * s, 6 * s, 26 * s, 3 * s);
    gg.fillEllipse(x - 2 * s, fy - 40 * s, 48 * s, 30 * s);
    gg.fillTriangle(x - 24 * s, fy - 44 * s, x - 38 * s, fy - 60 * s, x - 18 * s, fy - 52 * s);
    gg.fillRoundedRect(x + 10 * s, fy - 76 * s, 11 * s, 40 * s, 5 * s);
    gg.fillCircle(x + 16 * s, fy - 78 * s, 10 * s);
    ink(gg, shadow, BEAK);
    gg.fillTriangle(x + 24 * s, fy - 82 * s, x + 24 * s, fy - 74 * s, x + 38 * s, fy - 78 * s);
  });
}

export const world37 = {
  id: 37,
  bgTop: 0xf2b65e,    // golden-hour gold
  bgBottom: 0x5aa0a4, // the water's teal, soft

  drawHorizon(scene, opts) {
    const g = scene.add.graphics().setDepth(2);
    const b = opts.y;
    const wl = b - 150; // the waterline: everything across the water stands on it
    // Golden-hour glow low in the sky, translucent so the scene's own sky shows through.
    haze(g, b - 240, 96, GOLD, 0.26);
    // The sun, low over the far mountains: a soft glow under a plain disc, no rays.
    sunDisc(g, 300, b - 266, 36, SUN);
    // Mountains across the water: a hazy far ridge leaning left, a nearer darker slope on the right.
    ridge(g, [[0, b - 190], [120, b - 236], [260, b - 206], [430, b - 250], [600, b - 214], [760, b - 244],
      [900, b - 206], [W, b - 232], [W, wl], [0, wl]], FAR_RIDGE, -6, 8, 14);
    ridge(g, [[600, wl], [780, b - 198], [900, b - 178], [1000, b - 206], [W, b - 188], [W, wl]], NEAR_RIDGE, 6, 8, 12);
    // The far shore, a thin dark strip along the waterline.
    cuts(g, [[SHORE, -10, wl - 4, W + 20, 8, 4]], 0, 4);
    // The bridge off to the left: a deck on two rounded towers, thin cables slung between them.
    cuts(g, [[STEEL, 20, b - 174, 320, 8, 4], [STEEL, 115, b - 222, 10, 62, 4], [STEEL, 235, b - 222, 10, 62, 4]]);
    paper(g, 4, 6, (gg, shadow) => {
      inkLine(gg, shadow, 2, SILVER);
      for (const [x0, y0, x1, y1] of [[20, -172, 120, -220], [120, -220, 180, -188], [180, -188, 240, -220], [240, -220, 340, -172]]) {
        gg.lineBetween(x0, b + y0, x1, b + y1);
      }
    });
    // The big round dome on the far shore (a plain half disc: the water covers its lower half)
    // and the cluster of towers beside it, pale where the low sun catches them.
    paper(g, 4, 6, (gg, shadow) => { ink(gg, shadow, SILVER).fillCircle(470, wl + 2, 42); });
    cuts(g, [[600, 22, 62], [632, 28, 92], [668, 20, 70], [700, 30, 112], [740, 24, 82], [772, 26, 98], [806, 18, 58]]
      .map(([x, w, h], i) => [i % 2 ? TOWER_DARK : TOWER, x - w / 2, wl + 4 - h, w, h, Math.min(8, w / 3)]));
    // The water: one teal sheet laid over the far shore, the sun's gold path down the left,
    // and rows of gold glints where the low light hits it.
    waterBand(g, wl, 112, WATER);
    g.fillStyle(GOLD, 0.28).fillEllipse(300, wl + 34, 220, 48);
    g.fillStyle(GOLD, 0.7);
    for (const [x, y, w] of [[60, 10, 70], [250, 8, 120], [420, 22, 80], [520, 12, 60], [780, 18, 90], [960, 10, 70],
      [150, 40, 90], [640, 44, 110], [880, 50, 70], [340, 70, 100], [720, 76, 80]]) g.fillRoundedRect(x, wl + y, w, 4, 2);
    // The boathouse dock on the right with two long paddling boats tied up, plain rounded prows.
    cuts(g, [[RED, 730, wl + 50, 180, 12, 6], [DOCK, 720, wl + 68, 220, 9, 4], [GOLD, 750, wl + 82, 180, 12, 6]]);
    g.fillStyle(CREAM, 0.8);
    for (const [x, y] of [[744, wl + 54], [764, wl + 86]]) g.fillRoundedRect(x, y, 152, 3, 1.5);
    // Three little rainbow ferries crossing, the nearest the biggest.
    for (const [x, y, s] of [[400, wl + 30, 0.75], [600, wl + 52, 0.9], [190, wl + 66, 1.1]]) ferry(g, x, y, s);
    // The boathouse at the water's edge, far right: a pale shed with a red roof, a window and a door.
    cuts(g, [[0xe9e2d2, 960, b - 104, 110, 58, 8], [RED, 950, b - 114, 130, 16, 8],
      [WINDOW, 976, b - 92, 30, 20, 4], [0x8a6a48, 1026, b - 82, 22, 36, 4]]);
    // The little sandy cove tucked under the wall at the left: a wet strip along its edge, two rocks.
    paper(g, 0, 6, (gg, shadow) => {
      ink(gg, shadow, WET).fillRoundedRect(-30, b - 76, 280, 40, 20);
      ink(gg, shadow, SAND).fillRoundedRect(-30, b - 68, 280, 32, 16);
      ink(gg, shadow, 0x6e6a66).fillEllipse(60, b - 62, 34, 16);
      gg.fillEllipse(180, b - 70, 26, 12);
    });
    // The paved path is the floor sheet (no shadow of its own), with a thin stripe of low sun on it.
    g.fillStyle(PATH, 1).fillRect(0, b - 8, W, 68);
    g.fillStyle(GOLD, 0.16).fillRect(0, b - 8, W, 6);
    // The seawall: the stone face with its shadow falling on the path, then the pale coping stone.
    cuts(g, [[STONE, -20, b - 44, W + 40, 40, 10]], 0, 8);
    g.fillStyle(COPING, 1).fillRoundedRect(-20, b - 48, W + 40, 8, 4);
    // The rail along the top of the wall: posts every so often and one thin top rail (none over the cove).
    paper(g, 3, 4, (gg, shadow) => {
      ink(gg, shadow, RAIL);
      for (let x = 300; x < W; x += 90) gg.fillRoundedRect(x - 3, b - 74, 6, 28, 3);
      inkLine(gg, shadow, 3, RAIL).lineBetween(280, b - 72, W, b - 72);
    });
    // Parked along the path: two bikes leaning on the rail, a stroller, and the two giant birds.
    bike(g, 540, b + 6, RED);
    bike(g, 630, b + 6, 0x3a8fb5, 0.9);
    stroller(g, 730, b + 6);
    bird(g, 850, b + 6, 0.8);
    bird(g, 908, b + 6, 0.66);
    return g;
  },

  // Map node: a big rainbow ferry crossing gold water in front of the dome and
  // the towers, the low sun top left, the seawall and its rail along the front
  // with a bike leaning on it. Local coordinates, centred on the container.
  drawNode(scene, c, _scale) {
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(0, 56, 130, 22);
    // Sky card: the golden-hour back sheet.
    cuts(g, [[0xf4c070, -75, -60, 150, 120, 18]]);
    // The low sun at the top left: a soft glow under a plain disc, no rays.
    g.fillStyle(SUN, 0.3);
    g.fillEllipse(-46, -34, 64, 46);
    paper(g, 4, 6, (gg, shadow) => { ink(gg, shadow, SUN); gg.fillCircle(-46, -34, 14); });
    // Hazy far mountains leaning left, then the dome and the towers standing on the waterline.
    paper(g, -4, 6, (gg, shadow) => {
      ink(gg, shadow, FAR_RIDGE);
      gg.fillEllipse(-28, 2, 94, 46);
      gg.fillEllipse(36, -4, 78, 44);
    });
    paper(g, 4, 6, (gg, shadow) => {
      ink(gg, shadow, SILVER); gg.fillCircle(-2, 8, 18);
      ink(gg, shadow, TOWER); gg.fillRoundedRect(18, -22, 10, 30, 3); gg.fillRoundedRect(48, -16, 9, 24, 3);
      ink(gg, shadow, TOWER_DARK); gg.fillRoundedRect(32, -32, 12, 40, 3);
    });
    // The water sheet with the sun's gold path and a few gold glints.
    paper(g, 0, 8, (gg, shadow) => { ink(gg, shadow, WATER); gg.fillRect(-75, 8, 150, 40); });
    g.fillStyle(GOLD, 0.3);
    g.fillEllipse(-46, 16, 56, 14);
    g.fillStyle(GOLD, 0.75);
    for (const [x, y, w] of [[-70, 12, 22], [-24, 26, 24], [-58, 32, 16]]) g.fillRoundedRect(x, y, w, 3, 1.5);
    // The rainbow ferry, big and heading right, overhanging the card's right edge.
    ferry(g, 38, 38, 1.35);
    // The seawall along the front, its coping, and a short run of rail on the left.
    cuts(g, [[STONE, -82, 40, 164, 20, 8]], 0, 6);
    g.fillStyle(COPING, 1);
    g.fillRoundedRect(-82, 38, 164, 6, 3);
    paper(g, 2, 3, (gg, shadow) => {
      ink(gg, shadow, RAIL);
      for (const x of [-76, -54, -32, -10]) gg.fillRoundedRect(x - 2, 26, 4, 14, 2);
      inkLine(gg, shadow, 2, RAIL);
      gg.lineBetween(-80, 27, -6, 27);
    });
    // A bike leaning on the rail.
    bike(g, -44, 58, RED, 0.55);
    // One white highlight: the glint on the ferry's window strip.
    g.fillStyle(0xffffff, 0.85);
    g.fillRoundedRect(18, 3, 18, 3, 1.5);
    c.add(g);
  },

  // Map ambience: gold glints on the water, slow. A short gold sliver appears
  // on the node's water, stretches a little as the light catches it, and
  // fades. Math.random is allowed here, and only here.
  emit(scene, state, cx, cy) {
    const colors = [GOLD, SUN, 0xfff0b8];
    const p = scene.add.ellipse(
      cx + (Math.random() - 0.5) * 130, cy + 8 + Math.random() * 26,
      10, 4, colors[Math.floor(Math.random() * colors.length)], 0.9
    );
    state.layers.add(p);
    scene.tweens.add({
      targets: p, scaleX: 2.2, alpha: 0,
      duration: 2000 + Math.random() * 800, ease: 'Sine.easeOut', onComplete: () => p.destroy()
    });
    return p;
  },
};
