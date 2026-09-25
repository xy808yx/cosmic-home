// Chapter 2 (Inner Space) map layout: three columns. Phaser-free data keyed by
// world id. Every world sits on x 240, 540 or 840. Same shape as layoutCh1.js:
// legs run from world centre to world centre through every bend; secrets and
// gates hang off a host. Moves from the first plan are marked NUDGE.

export const LAYOUT = {
  chapter: 2,
  order: [21, 22, 23, 24, 25, 26, 27, 28],
  nodes: {
    21: { x: 240, y: 1480 },
    22: { x: 540, y: 1480 },
    23: { x: 840, y: 1240 },
    24: { x: 540, y: 1000 },
    25: { x: 240, y: 850 },
    26: { x: 540, y: 700 },
    27: { x: 840, y: 510 },
    28: { x: 540, y: 360 },
  },
  legs: [
    { from: 21, to: 22, pts: [[240, 1480], [540, 1480]] },
    { from: 22, to: 23, pts: [[540, 1480], [540, 1240], [840, 1240]] },
    { from: 23, to: 24, pts: [[840, 1240], [840, 1000], [540, 1000]] },
    { from: 24, to: 25, pts: [[540, 1000], [540, 850], [240, 850]] },
    { from: 25, to: 26, pts: [[240, 850], [240, 700], [540, 700]] },
    { from: 26, to: 27, pts: [[540, 700], [540, 510], [840, 510]] },
    { from: 27, to: 28, pts: [[840, 510], [840, 360], [540, 360]] },
  ],
  secrets: {
    // The Royal Flush: out left from its host, then a 45 degree drop.
    // NUDGE (one 30 px step): was (210,1110) via (320,1000). There its name
    // sat on the SURFACE portal's rim; up 30 (bend now at 290) clears it.
    17: { x: 210, y: 1080, host: 24, pts: [[540, 1000], [290, 1000], [210, 1080]] },
    // Playground: out right from its host, then down.
    18: { x: 750, y: 870, host: 26, pts: [[540, 700], [750, 700], [750, 870]] },
  },
  gates: {
    // Back out to Chapter 1, always open.
    surface: {
      x: 420, y: 1290, host: 21, pts: [[240, 1480], [240, 1290], [420, 1290]],
      label: 'SURFACE', accent: 0x4ecdc4, core: 0xb5e6ff, inward: false,
      warpTo: 1, requiresCleared: null,
    },
    // On to Chapter 3, once the chapter finale (World 28) is cleared.
    // NUDGE (one 30 px step): was (240,480) via (360,360). There THE
    // SINGULARITY CELL (W28's name) ran onto the portal's rim; left 30 (bend
    // now at 330) clears it.
    homeGround: {
      x: 210, y: 480, host: 28, pts: [[540, 360], [330, 360], [210, 480]],
      label: 'HOME GROUND', accent: 0xffd27a, core: 0xfff3b8, inward: false,
      warpTo: 3, requiresCleared: 28,
    },
  },
};
