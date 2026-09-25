// Chapter 3 (the paper city) map layout. Phaser-free data keyed by world id,
// the same shape as layoutCh1.js: legs run from world centre to world centre
// through every bend (0, 45 or 90 degree runs; routeGeom rounds each bend with
// the fixed 40 px corner); secrets and gates hang off a host.
//
// Play order is 31, 32, 33, 37, 36, 34, 35, 38 (the world table's order).
// Extra keys this chapter uses (WorldMapScene reads them for every chapter):
//   nodes[id].labelDy     where the name prints, from the node centre
//                         (default +90, under the node; negative = above)
//   secrets[id].name      the name printed on the map when it differs from
//                         the world table ('\n' splits it onto two lines)
//   secrets[id].art       which node art to draw ('scienceDome')
//   secrets[id].labelDy   name offset (default +88); starsDy the gauntlet
//                         star row (default +138)
//   secrets[id].drawFrom  px along the branch where its drawn road starts.
//                         The ship still flies the whole branch from the
//                         host; the first part runs along a main leg, so it
//                         is not drawn twice (a fork, as on a SNES overworld)
//   secrets[id].accent    branch tint (defaults to the world's accent)
//   gates[k].labelDy      gate name offset (default +100, under the portal)
//   gates[k].branchAccent branch tint (defaults to the portal's accent)
// Every coordinate that differs from the first plan is marked NUDGE with the
// reason.

export const LAYOUT = {
  chapter: 3,
  order: [31, 32, 33, 37, 36, 34, 35, 38],
  nodes: {
    // J, 2026-09-25: the bottom row moves right so INNER SPACE can hang off
    // The Grocery Store again, in the bottom left corner (it had moved up off
    // The Beach, the sixth stop, so a new arrival saw its road run out of a
    // locked world), and the garden and the mall spread out to fill the
    // empty right side. The garden sits on the flat top between the store
    // and the mall, so its name prints above; it sits low enough that its name
    // stays well clear of THE SEAWALL's (closer, the two read as one name).
    31: { x: 360, y: 1480 },
    32: { x: 660, y: 1340, labelDy: -100 },
    33: { x: 960, y: 1480 },
    37: { x: 830, y: 1040 },
    // Name above the node, over the water: below it, THE BREAD PLACE sat 12 px
    // over THE BIG GARDEN (the two read as one two-line name) and the Hot Pot
    // branch clipped its corner. Above, it is also clear of THE SEAWALL.
    36: { x: 530, y: 1040, labelDy: -96 },
    34: { x: 250, y: 960 },
    // J, 2026-09-25: The Big Store moves four grid steps left, toward the
    // corner INNER SPACE left empty. Its road from The Beach keeps its 45
    // degree run (straight up from The Beach would cross the whole bay on
    // one long bridge), and the road on to The Mountain crosses the inlet in
    // one span (at x 510 it crossed twice, two bridges back to back).
    35: { x: 570, y: 720 },
    38: { x: 860, y: 380 },
  },
  legs: [
    { from: 31, to: 32, pts: [[360, 1480], [500, 1340], [660, 1340]] },
    { from: 32, to: 33, pts: [[660, 1340], [820, 1340], [960, 1480]] },
    // Up the east side, then in to The Seawall from the lower right.
    { from: 33, to: 37, pts: [[960, 1480], [960, 1170], [830, 1040]] },
    { from: 37, to: 36, pts: [[830, 1040], [530, 1040]] },
    { from: 36, to: 34, pts: [[530, 1040], [330, 1040], [250, 960]] },
    { from: 34, to: 35, pts: [[250, 960], [490, 720], [570, 720]] },
    // Up across the water and then into The Mountain from the side, so the
    // road never runs under THE MOUNTAIN's name.
    { from: 35, to: 38, pts: [[570, 720], [570, 380], [860, 380]] },
  ],
  secrets: {
    // Hot Pot Time, found on The Bread Place's belt. Its branch forks off the
    // leg to The Beach at x 400, so it is not drawn twice.
    19: {
      x: 250, y: 1190, host: 36,
      pts: [[530, 1040], [400, 1040], [250, 1190]],
      drawFrom: 100,
    },
    // The Science Dome (hidden world 39), found on The Seawall's belt: out
    // right from its host, then up to the east tip of the water. Its name
    // (two lines) and gauntlet star row print ABOVE the node: below it they
    // would land on The Seawall art and on the branch.
    39: {
      x: 930, y: 860, host: 37, pts: [[830, 1040], [930, 1040], [930, 860]],
      name: 'The Science\nDome', art: 'scienceDome',
      labelDy: -112, starsDy: -190,
    },
  },
  gates: {
    // Back to Chapter 2, always open: out left from The Grocery Store into
    // the bottom left corner, name above the portal (below it would run into
    // THE GROCERY STORE).
    innerSpace: {
      x: 150, y: 1480, host: 31, pts: [[360, 1480], [150, 1480]],
      label: 'INNER SPACE', accent: 0xff7a8a, core: 0xffcf6b, inward: true,
      warpTo: 2, requiresCleared: null, labelDy: -100,
    },
  },
};
