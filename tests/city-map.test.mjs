import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAP_CHAPTERS } from '../src/maps/mapChapters.js';
import { buildRoute } from '../src/maps/routeGeom.js';
import { pointInWater, waterSpans, discWetness, shoreRuns, WATER_RINGS } from '../src/homeGround/cityGeom.js';

// The Chapter 3 paper city map, checked without a browser: the stops sit on
// the new coast's land, every water crossing gets a bridge whose ends stand on
// land, and the chapter's hooks (src/maps/ch3Map.js) draw bridges and the
// dome's glyph at the right times. The hooks are run against a stub scene that
// records what they add and ignores all drawing.

const row = MAP_CHAPTERS[3];
const { layout } = row;
const route = buildRoute(layout);
const SKIN_TUBE = { width: 22, branch: { scale: 0.8 } };
// The wettest a stop's 60 px art disc may be (The Grocery Store sits by the
// river at about 14%).
const MAX_WET = 0.15;

test('chapter 3: every stop and secret stands on land, its art mostly dry', () => {
  const spots = [
    ...layout.order.map(id => ['world ' + id, layout.nodes[id]]),
    ...Object.entries(layout.secrets).map(([id, s]) => ['secret ' + id, s]),
  ];
  for (const [name, p] of spots) {
    assert.equal(pointInWater(p.x, p.y), false, `${name} is in the water`);
    const wet = discWetness(p.x, p.y, 60, 4);
    assert.ok(wet <= MAX_WET, `${name}: ${(wet * 100).toFixed(0)}% of its art is over water`);
  }
});

test('chapter 3: every water crossing is bounded by land a bridge can stand on', () => {
  const pieces = [
    ...route.legs.map(l => [`leg ${l.from}>${l.to}`, l]),
    ...Object.values(route.secrets).map(s => [`secret ${s.id}`, s.drawn]),
    ...Object.values(route.gates).map(g => [`gate ${g.key}`, g.drawn]),
  ];
  let crossings = 0;
  for (const [name, piece] of pieces) {
    for (const sp of waterSpans(piece.poly).spans) {
      crossings++;
      // A crossing starts on a shore (never at the start of a road, which is
      // always a world on land) and ends on the far shore, unless the road
      // ends at a gate floating in the bay.
      assert.ok(sp.s0 > 0, `${name}: starts in the water`);
      const endsAtGate = name.startsWith('gate') && sp.s1 >= piece.length - 1;
      if (!endsAtGate) assert.ok(sp.s1 < piece.length, `${name}: ends in the water`);
    }
  }
  assert.ok(crossings > 0, 'the city has water to cross');
});

test('chapter 3: the coast has shore lines to ink and no ring is left open', () => {
  for (const ring of WATER_RINGS) {
    assert.equal(ring.length % 2, 0);
    assert.ok(shoreRuns(ring).length >= 1);
  }
});

// ------------------------------------------------------------ the hooks

// A stub scene: textures and display objects that record, a context that
// accepts any drawing call, a road layer with a grower() like the real one.
function stubScene({ reserved = [], arriving = null } = {}) {
  const added = [];
  const obstacles = [];
  const anyCtx = new Proxy({}, { get: () => () => {}, set: () => true });
  const obj = (type) => {
    const o = {
      type, visible: true, alpha: 1, active: true, depth: 0,
      setDepth(d) { o.depth = d; return this; }, setOrigin() { return this; },
      setAlpha(a) { o.alpha = a; return this; }, setVisible(v) { o.visible = v; return this; },
    };
    added.push(o);
    return o;
  };
  const growers = [];
  const layer = {
    skin: { tube: SKIN_TUBE },
    grower(piece) {
      const g = { piece, drawnTo: 0, setLength(d) { g.drawnTo = d; }, finish() { g.drawnTo = piece.length; } };
      growers.push(g);
      return g;
    },
  };
  const scene = {
    _mapLayout: layout, _mapRoute: route, _routeLayer: layer, _roadReserved: reserved,
    _arrivalBranch: arriving ? { piece: arriving } : null,
    textures: { createCanvas: () => ({ getContext: () => anyCtx, refresh() {} }), exists: () => false, remove() {} },
    events: { once() {} },
    add: { image: () => obj('Image') },
    tweens: { add: ({ targets, alpha }) => { targets.alpha = alpha; } },
    addObstacle: (r) => obstacles.push(r),
  };
  // drawDomeLandmark calls Graphics methods; accept them all.
  scene.add.graphics = () => new Proxy(obj('Graphics'), {
    get: (t, k) => (k in t ? t[k] : () => {}),
  });
  return { scene, added, obstacles, growers };
}

// Runs a map build's hook sequence: backdrop, one piecesToDraw per queued
// piece, afterBake.
function build(stub, queued) {
  const { hooks } = row;
  hooks.backdrop(stub.scene, []);
  const drawn = queued.flatMap(([piece, branch]) => hooks.piecesToDraw(stub.scene, piece, { branch }));
  hooks.afterBake(stub.scene);
  return drawn;
}

const dome = route.secrets[39].drawn;
const legsAll = route.legs.map(l => [l, false]);
const bridgesIn = (added) => added.filter(o => o.type === 'Image');

test('chapter 3 hooks: the road is never cut, it carries on over bridges', () => {
  const stub = stubScene();
  const drawn = build(stub, legsAll);
  assert.deepEqual(drawn, route.legs, 'every leg comes back whole');
  const crossings = route.legs.reduce((n, l) => n + waterSpans(l.poly).spans.length, 0);
  // Two images a bridge: the deck under the tube, the rails over it.
  assert.equal(bridgesIn(stub.added).length, 2 * crossings);
  for (const img of bridgesIn(stub.added)) assert.equal(img.visible, true);
  assert.ok(stub.obstacles.length > 0, 'the pills keep off the bridges');
});

test('chapter 3 hooks: the dome glyph shows only while the dome is unfound', () => {
  const unfound = stubScene();
  build(unfound, legsAll);
  assert.equal(unfound.added.filter(o => o.type === 'Graphics').length, 1, 'glyph on the sheet');

  const found = stubScene();
  build(found, [...legsAll, [dome, true]]);
  assert.equal(found.added.filter(o => o.type === 'Graphics').length, 0, 'never two domes in one spot');

  // Arriving at the dome by warp: its branch is held back, its node draws.
  const arriving = stubScene({ reserved: [dome], arriving: dome });
  build(arriving, legsAll);
  assert.equal(arriving.added.filter(o => o.type === 'Graphics').length, 0);
});

test('chapter 3 hooks: a bridge on the reveal leg waits for the growing tube', () => {
  // The last leg (to the mountain) crosses the harbour; hold it back as the
  // unlock reveal does.
  const leg = route.legs[route.legs.length - 1];
  const [span] = waterSpans(leg.poly).spans;
  assert.ok(span, 'the leg to the mountain crosses water');
  const stub = stubScene({ reserved: [leg] });
  build(stub, route.legs.slice(0, -1).map(l => [l, false]));
  const before = bridgesIn(stub.added);
  const waiting = before.filter(o => !o.visible);
  assert.equal(waiting.length, 2, 'its deck and rails are hidden');

  const grower = stub.scene._routeLayer.grower(leg);
  grower.setLength(span.s0 - 40);
  assert.ok(waiting.every(o => !o.visible), 'still hidden short of the shore');
  grower.setLength(span.s0);
  assert.ok(waiting.every(o => o.visible), 'shown as the tube reaches the shore');
  assert.deepEqual(waiting.map(o => o.alpha), [1, 0.85]);

  // Tap-to-skip finishes the grower in one go.
  const skip = stubScene({ reserved: [leg] });
  build(skip, route.legs.slice(0, -1).map(l => [l, false]));
  skip.scene._routeLayer.grower(leg).finish();
  assert.ok(bridgesIn(skip.added).every(o => o.visible));
});
