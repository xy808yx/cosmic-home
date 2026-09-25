// World 31, The Grocery Store. Home Ground's first stop.
//
// Time of day: nine in the morning, bright flat light through the front
// windows. The sky pair is pale morning blue over cream, the start of the
// chapter's one-day arc.
//
// Wave 2 line: the checkout belt. A paper grocery bag rides it with the fact
// on its side label, the cart's slots are the bins, and the pet bags.
//
// Cues, in plain words: the flower buckets by the front door, the cart with
// the wobbly wheel, the stack of red baskets, the take-a-number ticket at the
// deli, the fridge cases glowing, and aisle shelves full of colourful boxes.
//
// Paper Cutout style: every prop goes through paper() so it gets the hard
// offset shadow; rounded corners, no outlines, no gradients. Anything round
// here (flower heads, the fridge glow, the awning scallops) is plain shapes
// only, no spirals or sunbursts, no rays.

import { W, ink, paper, ridge, haze, wall, shelf, windowPane } from './paper.js';

// Palette for this place. Kept mid-tone where the belt will recolour from it.
const STEEL = 0xa9bcc8;      // cart basket and fridge frames
const STEEL_DARK = 0x5f6f78; // cart legs and door handles
const WHEEL = 0x2a2f36;
const RED = 0xe8594a;        // baskets, cart handle, ticket box, awning
const CREAM = 0xfff8e7;      // paper: the ticket tongue, the bag label
const KRAFT = 0xd9a466;      // the paper grocery bag
const GREEN = 0x6fbf5a;      // stems and leaves
const FRIDGE_PANE = 0xeefcff; // the lit case, the brightest plane on the wall
const FRIDGE_GLOW = 0xbfefff;
const GOODS = [0xe8594a, 0xffd35c, 0x3a8fb5, 0x6fbf5a, 0xff8a5c, 0xfff8e7];

// One paper pass over a list of rounded rects: [[color, x, y, w, h, radius], ...].
// Every item's shadow lands first, then the items, so a stack or a row never
// shadows its own neighbours.
function cuts(g, list, dx = 4, dy = 6) {
  paper(g, dx, dy, (gg, shadow) => {
    for (const [color, x, y, w, h, r] of list) {
      ink(gg, shadow, color);
      gg.fillRoundedRect(x, y, w, h, r);
    }
  });
}

// Same idea for circles: [[color, cx, cy, r], ...]. Plain discs only.
function dots(g, list, dx = 4, dy = 6) {
  paper(g, dx, dy, (gg, shadow) => {
    for (const [color, cx, cy, r] of list) {
      ink(gg, shadow, color);
      gg.fillCircle(cx, cy, r);
    }
  });
}

// Three buckets of cut flowers: a dark bucket, a green tuft, three round heads.
function flowerBuckets(g, xs, b) {
  const buckets = [], tufts = [], heads = [];
  xs.forEach((x, i) => {
    buckets.push([0x3f4a52, x, b - 60, 32, 46, 6]);
    tufts.push([GREEN, x + 4, b - 86, 24, 32, 10]);
    const [a, c, d] = [[0xffb3c7, 0xffd35c, 0xff8a5c], [0xffd35c, 0xfff8e7, 0xffb3c7], [0xff8a5c, 0xffb3c7, 0xffd35c]][i % 3];
    heads.push([a, x + 8, b - 76, 8], [c, x + 23, b - 82, 9], [d, x + 14, b - 94, 8]);
  });
  cuts(g, tufts);
  cuts(g, buckets);
  dots(g, heads);
}

// The shopping cart, side on, with the front wheel gone wobbly. cx is the
// basket's centre, floorY where the wheels touch. Same drawing on the wall
// and on the map node, at two sizes.
function cart(g, cx, floorY, s) {
  const top = floorY - 82 * s, bottom = floorY - 30 * s;
  ridge(g, [[cx - 58 * s, top], [cx + 52 * s, top], [cx + 42 * s, bottom], [cx - 48 * s, bottom]], STEEL, 4, 6, 6 * s);
  // Two thin wire lines across the basket (rails, the one stroke the style allows).
  g.lineStyle(2, 0xd7e3ea, 1);
  g.lineBetween(cx - 52 * s, top + 16 * s, cx + 46 * s, top + 16 * s);
  g.lineBetween(cx - 50 * s, top + 30 * s, cx + 44 * s, top + 30 * s);
  cuts(g, [
    [RED, cx + 44 * s, top - 26 * s, 12 * s, 30 * s, 5 * s],     // handle post
    [RED, cx + 34 * s, top - 32 * s, 48 * s, 12 * s, 6 * s],     // handle bar
    [STEEL_DARK, cx - 34 * s, bottom, 7 * s, 16 * s, 2 * s],     // back leg
    [STEEL_DARK, cx + 24 * s, bottom, 7 * s, 16 * s, 2 * s],     // front leg
  ]);
  dots(g, [[WHEEL, cx - 30 * s, floorY - 10 * s, 10 * s]]);
  // The wobbly wheel: an ellipse a touch off its leg, so it reads tilted.
  paper(g, 4, 6, (gg, shadow) => {
    ink(gg, shadow, WHEEL);
    gg.fillEllipse(cx + 32 * s, floorY - 8 * s, 22 * s, 16 * s);
  });
  g.fillStyle(STEEL, 1);
  g.fillCircle(cx - 30 * s, floorY - 10 * s, 3.5 * s);
  g.fillCircle(cx + 32 * s, floorY - 8 * s, 3.5 * s);
}

export const world31 = {
  id: 31,
  bgTop: 0x8cc0e4,    // pale morning blue
  bgBottom: 0xece0c2, // cream, the light on the store floor

  drawHorizon(scene, opts) {
    const g = scene.add.graphics().setDepth(2);
    const b = opts.y;
    // Morning light: a thin cream haze high on the wall, then the pale store wall.
    haze(g, b - 250, 80, 0xfff3c2, 0.14);
    wall(g, b, 0xe4efe6, 0.5);
    // Glow on the wall behind the fridge cases: a soft ellipse, no rays.
    g.fillStyle(FRIDGE_GLOW, 0.22);
    g.fillEllipse(968, b - 130, 300, 240);
    // Front window and the door beside it, both full of bright morning.
    windowPane(g, b, 170, 250, 176, 0x5f7f8c, 0xfff1c8, 0.55);
    windowPane(g, b, 340, 84, 176, 0x5f7f8c, 0xfff1c8, 0.55);
    // Lit exit sign over the door: green with a pale bar, self-lit for the night.
    cuts(g, [[0x2fbf6f, 306, b - 246, 68, 26, 8], [0xd8ffe8, 318, b - 238, 44, 10, 5]]);
    // Aisle-end shelving: a pale unit, three boards, rows of colourful boxes.
    cuts(g, [[0xf2efe4, 620, b - 226, 170, 190, 12]]);
    const boards = [b - 170, b - 116, b - 62];
    cuts(g, boards.map((y) => [0xc9c2b0, 620, y, 170, 8, 3]));
    const boxes = [];
    boards.forEach((y, k) => {
      for (let i = 0; i < 6; i++) boxes.push([GOODS[(i + k * 2) % GOODS.length], 628 + i * 27, y - 36, 22, 36, 4]);
    });
    cuts(g, boxes);
    // Two fridge cases: steel frame, lit pane, three shelves of cartons and bottles.
    for (const x of [884, 976]) {
      cuts(g, [[STEEL, x, b - 228, 80, 212, 12]]);
      g.fillStyle(FRIDGE_PANE, 1);
      g.fillRoundedRect(x + 8, b - 220, 64, 196, 8);
      g.fillStyle(0xa8c4cc, 1);
      for (const sy of [b - 168, b - 116, b - 64]) g.fillRect(x + 8, sy, 64, 3);
      [b - 168, b - 116, b - 64].forEach((sy, k) => {
        for (let i = 0; i < 4; i++) {
          g.fillStyle([0xffffff, 0xff9a3c, GREEN, 0x3a8fb5][(i + k) % 4], 1);
          g.fillRoundedRect(x + 12 + i * 15, sy - 24, 11, 24, 3);
        }
      });
      g.fillStyle(STEEL_DARK, 1);
      g.fillRoundedRect(x + 70, b - 150, 4, 60, 2);
    }
    // The deli: a now-serving board with its red panel, and the take-a-number
    // ticket box on a post with one paper tongue hanging out.
    cuts(g, [
      [0x33404a, 806, b - 214, 60, 40, 8], [0xff5a4a, 816, b - 203, 40, 18, 4],
      [0x8fa0aa, 833, b - 76, 6, 62, 2], [RED, 814, b - 100, 44, 34, 8], [CREAM, 827, b - 68, 18, 16, 3],
    ]);
    // Flower buckets by the front door.
    flowerBuckets(g, [402, 442, 482], b);
    // A stack of red baskets, each one nested a little smaller than the last.
    const stack = [0, 1, 2, 3].map((i) => [RED, 522 + i * 2, b - 34 - i * 14, 84 - i * 4, 20, 6]);
    cuts(g, [...stack, [0x8a2e24, 536, b - 92, 6, 14, 3], [0x8a2e24, 594, b - 92, 6, 14, 3]]);
    // The cart, parked in front of the shelving.
    cart(g, 700, b - 12, 1);
    // Counter ledge at the line, then a shallow tiled floor with the fridge glow on it.
    shelf(g, b, 0x5f8f7a);
    g.fillStyle(0xd8dcd2, 1);
    g.fillRect(0, b + 18, W, 42);
    g.fillStyle(0xc9cfc4, 1);
    for (let x = 0; x < W; x += 120) g.fillRect(x, b + 18, 60, 42);
    g.fillStyle(FRIDGE_GLOW, 0.3);
    g.fillEllipse(968, b + 40, 280, 34);
    return g;
  },

  // Map node: a cart with a paper bag and a bunch of flowers in it, under a
  // red and cream awning. Local coordinates, centred on the container.
  drawNode(scene, c, _scale) {
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(0, 58, 130, 22);
    // Sky card: the morning blue back sheet.
    cuts(g, [[0xa9d4ee, -75, -60, 150, 120, 18]]);
    // Awning across the top, overhanging the card, with a row of scallops.
    cuts(g, [[RED, -78, -52, 156, 18, 6]]);
    const scallops = [];
    for (let i = 0; i < 9; i++) scallops.push([i % 2 ? RED : 0xfff6e0, -72 + i * 18, -34, 8]);
    dots(g, scallops);
    // The paper bag and the flowers poke up out of the basket, so they go first.
    cuts(g, [[KRAFT, -30, -44, 44, 52, 6], [CREAM, -22, -30, 28, 16, 4], [GREEN, 6, -52, 12, 26, 6]]);
    dots(g, [[0xffb3c7, 12, -60, 9], [0xffd35c, 25, -52, 8]]);
    cart(g, -4, 62, 1);
    // One white highlight, a glint on the bag's shoulder.
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(-22, -40, 4);
    c.add(g);
  },

  // Map ambience: slow cream and pale-green motes drifting across the store,
  // and now and then a receipt-paper fleck (a tiny white slip) tumbling down
  // near the lanes. Math.random is allowed here, and only here.
  emit(scene, state, cx, cy) {
    if (Math.random() < 0.3) {
      const p = scene.add.rectangle(cx + (Math.random() - 0.5) * 80, cy - 10 - Math.random() * 30, 4, 7, 0xffffff, 0.9);
      state.layers.add(p);
      scene.tweens.add({
        targets: p, y: '+=56', x: '+=' + ((Math.random() - 0.5) * 30), angle: 180, alpha: 0,
        duration: 1900, ease: 'Sine.easeIn', onComplete: () => p.destroy()
      });
      return p;
    }
    const colors = [0xfff8e7, 0xb8f0c8, 0xe0f5e4];
    const side = Math.random() < 0.5 ? -1 : 1;
    const p = scene.add.circle(cx - side * 50, cy + (Math.random() - 0.5) * 60, 3, colors[Math.floor(Math.random() * colors.length)], 0.8);
    state.layers.add(p);
    scene.tweens.add({
      targets: p, x: cx + side * 60, y: '-=10', alpha: 0,
      duration: 2600, ease: 'Sine.easeOut', onComplete: () => p.destroy()
    });
    return p;
  },
};
