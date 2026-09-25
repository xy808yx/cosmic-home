import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAP_CHAPTERS, checkLayoutOrder } from '../src/maps/mapChapters.js';
import {
  buildRoute, routePointAt, validateAngles, pieceSpacing, CORNER_R,
} from '../src/maps/routeGeom.js';

// The chapter map layouts (src/maps), checked without a browser: road
// geometry, spacing, tap targets, the safe band, the ship's landing spots,
// and that every layout agrees with the world table.

// GameData loads in node; give it a storage that keeps nothing, so it never
// touches a real save and stays quiet.
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { getChapterWorlds, HIDDEN_WORLDS } = await import('../src/GameData.js');

const W = 1080;
const GUTTER = 24;
const BAND = [260, 1700];
// Tap circles: every world, secret and gate is tapped within 90 px of its
// centre, and no two may overlap.
const TAP_R = 90;
// How far a node's art reaches from its centre (WorldMapScene NODE_DISC_R).
const NODE_ART_R = 66;
// A gate's halo: the 76 px portal plus its 34 px breathing glow.
const GATE_HALO_R = 110;
// Two pieces of road that do not share a node keep at least this far apart
// (true segment to segment distance, not sampled).
const MIN_PIECE_GAP = 80;
// Label size. Names print at 36 px, weight 900, in the game's label font,
// upper case, with a 3 px stroke (6 px on paper). Measured in the browser
// (2026-09-25) across all 36 map names: the widest per character was HOME
// GROUND at 27.2 px a character (average about 24), and one line is 45 px
// tall (48 on paper). So a name is estimated at 28 px per character of its
// longest line, 48 px a line (a second line adds 42: line spacing is -6).
const LABEL_CHAR_W = 28;
const LABEL_LINE_H = 48;
const LABEL_EXTRA_LINE_H = 42;
// Where names and star rows print, from the node centre (WorldMapScene).
const NODE_LABEL_DY = 90;
const SECRET_LABEL_DY = 88;
const SECRET_STARS_DY = 138;
const GATE_LABEL_DY = 100;
const STAR_GAP = 46;
const STAR_R = 20;

const chapters = Object.keys(MAP_CHAPTERS).map(Number);

function labelRect(x, y, name) {
  const lines = name.toUpperCase().split('\n');
  const w = Math.max(...lines.map(l => l.length)) * LABEL_CHAR_W;
  const h = LABEL_LINE_H + (lines.length - 1) * LABEL_EXTRA_LINE_H;
  // The game clamps every name's centre so the whole name stays inside the
  // edge gutter (WorldMapScene.clampToGutter).
  const cx = Math.min(Math.max(x, GUTTER + w / 2), W - GUTTER - w / 2);
  return { name, x: cx - w / 2, y: y - h / 2, w, h };
}

function insideBand(r) {
  return r.x >= GUTTER - 1e-6 && r.x + r.w <= W - GUTTER + 1e-6 && r.y >= BAND[0] && r.y + r.h <= BAND[1];
}

// Everything each chapter map can show, with its tap circle and bounds.
function mapThings(chapter) {
  const { layout } = MAP_CHAPTERS[chapter];
  const worlds = getChapterWorlds(chapter);
  const byId = Object.fromEntries(HIDDEN_WORLDS.map(h => [h.id, h]));
  const taps = [];
  const boxes = [];
  for (const w of worlds) {
    const n = layout.nodes[w.id];
    taps.push({ key: 'w' + w.id, x: n.x, y: n.y });
    boxes.push({ name: `world ${w.id} art`, x: n.x - NODE_ART_R, y: n.y - NODE_ART_R, w: 2 * NODE_ART_R, h: 2 * NODE_ART_R });
    boxes.push(labelRect(n.x, n.y + (n.labelDy ?? NODE_LABEL_DY), w.name));
  }
  for (const [id, s] of Object.entries(layout.secrets || {})) {
    const h = byId[id];
    taps.push({ key: 'h' + id, x: s.x, y: s.y });
    boxes.push({ name: `secret ${id} art`, x: s.x - NODE_ART_R, y: s.y - NODE_ART_R, w: 2 * NODE_ART_R, h: 2 * NODE_ART_R });
    boxes.push(labelRect(s.x, s.y + (s.labelDy ?? SECRET_LABEL_DY), s.name ?? h?.name ?? String(id)));
    if (h?.kind === 'gauntlet') {
      const sy = s.y + (s.starsDy ?? SECRET_STARS_DY);
      boxes.push({ name: `secret ${id} stars`, x: s.x - STAR_GAP - STAR_R, y: sy - STAR_R, w: 2 * (STAR_GAP + STAR_R), h: 2 * STAR_R });
    }
  }
  for (const [k, g] of Object.entries(layout.gates || {})) {
    taps.push({ key: 'g' + k, x: g.x, y: g.y });
    boxes.push({ name: `gate ${k} halo`, x: g.x - GATE_HALO_R, y: g.y - GATE_HALO_R, w: 2 * GATE_HALO_R, h: 2 * GATE_HALO_R });
    boxes.push(labelRect(g.x, g.y + (g.labelDy ?? GATE_LABEL_DY), g.label));
  }
  return { layout, taps, boxes };
}

for (const chapter of chapters) {
  const { layout } = MAP_CHAPTERS[chapter];
  const route = buildRoute(layout);

  test(`chapter ${chapter}: every run is a multiple of 45 degrees and every bend fits its ${CORNER_R} px corner`, () => {
    assert.deepEqual(validateAngles(layout), []);
  });

  test(`chapter ${chapter}: pieces of road that share no node keep ${MIN_PIECE_GAP} px apart`, () => {
    const close = pieceSpacing(route).filter(p => p.dist < MIN_PIECE_GAP);
    assert.deepEqual(close, [], `too close: ${close.map(p => `${p.a} / ${p.b} ${p.dist} px`).join('; ')}`);
  });

  test(`chapter ${chapter}: tap circles (r ${TAP_R}) never overlap`, () => {
    const { taps } = mapThings(chapter);
    const clashes = [];
    for (let i = 0; i < taps.length; i++) {
      for (let j = i + 1; j < taps.length; j++) {
        const d = Math.hypot(taps[i].x - taps[j].x, taps[i].y - taps[j].y);
        if (d < 2 * TAP_R) clashes.push(`${taps[i].key}/${taps[j].key} ${d.toFixed(0)} px`);
      }
    }
    assert.deepEqual(clashes, []);
  });

  test(`chapter ${chapter}: nodes, names, star rows and gate halos stay inside the ${GUTTER} px gutter and y ${BAND[0]} to ${BAND[1]}`, () => {
    const { boxes } = mapThings(chapter);
    const out = boxes.filter(b => !insideBand(b)).map(b =>
      `${b.name}: x ${b.x.toFixed(0)} to ${(b.x + b.w).toFixed(0)}, y ${b.y.toFixed(0)} to ${(b.y + b.h).toFixed(0)}`);
    assert.deepEqual(out, []);
  });

  test(`chapter ${chapter}: the constant-speed ship lands within 1 px of every world`, () => {
    for (const id of layout.order) {
      const p = routePointAt(route, route.nodeDist[id]);
      const n = layout.nodes[id];
      assert.ok(Math.hypot(p.x - n.x, p.y - n.y) <= 1, `world ${id}: lands at (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
    }
    // Legs run in play order and join end to end.
    layout.legs.forEach((l, k) => {
      assert.equal(l.from, layout.order[k]);
      assert.equal(l.to, layout.order[k + 1]);
    });
    assert.equal(layout.legs.length, layout.order.length - 1);
  });

  test(`chapter ${chapter}: every secret and gate hangs off a host in this chapter`, () => {
    for (const [id, s] of Object.entries(layout.secrets || {})) {
      assert.ok(layout.order.includes(s.host), `secret ${id}: host ${s.host}`);
      assert.deepEqual(s.pts[0], [layout.nodes[s.host].x, layout.nodes[s.host].y]);
      assert.deepEqual(s.pts[s.pts.length - 1], [s.x, s.y]);
    }
    for (const [k, g] of Object.entries(layout.gates || {})) {
      assert.ok(layout.order.includes(g.host), `gate ${k}: host ${g.host}`);
      assert.ok(g.requiresCleared == null || layout.order.includes(g.requiresCleared), `gate ${k}: unlock world`);
      assert.ok([1, 2, 3].includes(g.warpTo) && g.warpTo !== chapter, `gate ${k}: warps to ${g.warpTo}`);
    }
  });

  test(`chapter ${chapter}: the layout lists the world table's worlds and secrets`, () => {
    const ids = getChapterWorlds(chapter).map(w => w.id);
    assert.deepEqual(layout.order, ids);
    assert.doesNotThrow(() => checkLayoutOrder(chapter, ids));
    const hidden = HIDDEN_WORLDS.filter(h => (h.chapter || 1) === chapter).map(h => h.id).sort((a, b) => a - b);
    const secrets = Object.keys(layout.secrets || {}).map(Number).sort((a, b) => a - b);
    assert.deepEqual(secrets, hidden);
  });
}

test('a layout that does not match the world table fails loudly', () => {
  assert.throws(() => checkLayoutOrder(1, [1, 2, 3]), /Chapter 1 map layout does not match/);
  assert.throws(() => checkLayoutOrder(3, [31, 32, 33, 36, 37, 34, 35, 38]), /does not match/);
});
