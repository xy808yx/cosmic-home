// Chapter 1 (Outer Space) map layout: the switchback. Phaser-free data keyed
// by world id, never by array index. Every leg lists its points from the "from"
// world's centre to the "to" world's centre, with every bend in between;
// routeGeom rounds each bend with the fixed 40 px corner. Every run is 0, 45
// or 90 degrees, and each leg rises first, then runs into the next world from
// the side, so the road never crosses a name.
//
// Secrets and gates hang off a host world the same way (like the side exits on
// a SNES overworld): pts start on the host's centre and end on the secret or
// gate centre. Coordinates sit on the 30 px grid; every one that moved from
// the first plan is marked NUDGE with the reason. tests/map-layout.test.mjs
// checks all of it.

export const LAYOUT = {
  chapter: 1,
  order: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  nodes: {
    1: { x: 240, y: 1480 },
    2: { x: 540, y: 1480 },
    3: { x: 900, y: 1480 },
    4: { x: 600, y: 1270 },
    5: { x: 360, y: 1060 },
    // NUDGE (one diagonal 30 px grid step): W6 and W7 were (600,850) and
    // (900,850). The Black Hole Edge ring (radius about 74) reached up under
    // GALACTIC CORE (W9's name) and SUPERNOVA (W8's name), and the label
    // spreader slid SUPERNOVA onto the 7>8 road. Down 30 clears both names;
    // right 30 keeps BLACK HOLE EDGE off Robot Station's cleared star and
    // 23 px clear of ICE COMET.
    6: { x: 630, y: 880 },
    7: { x: 930, y: 880 },
    8: { x: 720, y: 670 },
    9: { x: 420, y: 670 },
    10: { x: 780, y: 490 },
    11: { x: 540, y: 360 },
  },
  legs: [
    { from: 1, to: 2, pts: [[240, 1480], [540, 1480]] },
    { from: 2, to: 3, pts: [[540, 1480], [900, 1480]] },
    { from: 3, to: 4, pts: [[900, 1480], [900, 1270], [600, 1270]] },
    { from: 4, to: 5, pts: [[600, 1270], [600, 1060], [360, 1060]] },
    { from: 5, to: 6, pts: [[360, 1060], [360, 880], [630, 880]] },
    { from: 6, to: 7, pts: [[630, 880], [930, 880]] },
    { from: 7, to: 8, pts: [[930, 880], [930, 670], [720, 670]] },
    { from: 8, to: 9, pts: [[720, 670], [420, 670]] },
    { from: 9, to: 10, pts: [[420, 670], [420, 490], [780, 490]] },
    { from: 10, to: 11, pts: [[780, 490], [780, 360], [540, 360]] },
  ],
  secrets: {
    // Glitch World: out left from its host, then down.
    15: { x: 180, y: 1260, host: 5, pts: [[360, 1060], [180, 1060], [180, 1260]] },
    // Dad's Garage: out left from its host, then a 45 degree drop.
    16: { x: 180, y: 780, host: 9, pts: [[420, 670], [290, 670], [180, 780]] },
  },
  gates: {
    // On to Chapter 2, once the chapter finale (World 11) is cleared.
    // NUDGE (one 30 px step): was (270,480). There the INNER SPACE name sat on
    // the top of the Galactic Core rings (W9); up 30 clears them.
    innerSpace: {
      x: 270, y: 450, host: 11, pts: [[540, 360], [270, 360], [270, 450]],
      label: 'INNER SPACE', accent: 0xff7a8a, core: 0xffcf6b, inward: true,
      warpTo: 2, requiresCleared: 11,
    },
  },
};
