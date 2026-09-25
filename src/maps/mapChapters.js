// One row per chapter map: its layout (world spots, legs, secrets, gates), the
// road skin it is drawn in (see routeRender.js SKINS), how far the label
// spreader keeps names off the road, and optional hooks a chapter module can
// add without touching WorldMapScene. Phaser-free, so the tests can load it.
//
// HOOKS. Every hook is optional; a chapter with none gets the stock map.
// Chapter 3's (the paper city: bridges, the dome's glyph) live in ch3Map.js
// and are listed in its row below; registerChapterHooks(chapter, { ... }) adds
// or replaces hooks at run time.
//   backdrop(scene, oldBackdrop)
//       Runs once, right after the stock backdrop is painted and before
//       anything else is built. oldBackdrop is every display object that
//       existed at that moment (the stock backdrop). Hide or destroy what it
//       replaces and paint its own (depth -10 / -9 like the stock one).
//   ambience(scene, opts)
//       Replaces createMapAmbience(scene, opts) for this chapter (same opts).
//   piecesToDraw(scene, piece, { branch }) -> [piece, ...]
//       What of each leg or branch the road layer draws (a leg can be cut at
//       a shore, for example). Pieces are routeGeom measured pieces; cut them
//       with subPiece. A secret with drawFrom is already cut at its fork.
//       Default: [piece].
//   afterBake(scene)
//       Runs once the road is baked (bridges and the like). Pieces held back
//       to draw themselves later are in scene._roadReserved.
//   beforeHiddenNodes(scene)
//       Runs right before the secrets are drawn (a landmark that a secret
//       replaces once it is found, for example).
// scene._mapRoute is the measured route (routeGeom.buildRoute) and
// scene._mapChapter this row, for any hook that needs them.

import { LAYOUT as LAYOUT_CH1 } from './layoutCh1.js';
import { LAYOUT as LAYOUT_CH2 } from './layoutCh2.js';
import { LAYOUT as LAYOUT_CH3 } from './layoutCh3.js';
import { CH3_HOOKS } from './ch3Map.js';

export const MAP_CHAPTERS = {
  // Outer Space: a near-white tube with a cool cyan glow.
  1: { layout: LAYOUT_CH1, skin: 'space', routeClear: 16, hooks: {} },
  // Inner Space: a cream to pale gold tube with a warm gold glow.
  2: { layout: LAYOUT_CH2, skin: 'vessel', routeClear: 16, hooks: {} },
  // The paper city: a cream tube with a thin brown edge; it is wider, so
  // names keep further off it. Bridges over the water and the dome's glyph
  // come from ch3Map.js.
  3: { layout: LAYOUT_CH3, skin: 'paper', routeClear: 22, hooks: { ...CH3_HOOKS } },
};

export function getMapChapter(chapter) {
  return MAP_CHAPTERS[chapter] || null;
}

// Adds (or replaces) hooks for one chapter. Returns the chapter's row.
export function registerChapterHooks(chapter, hooks) {
  const row = MAP_CHAPTERS[chapter];
  if (!row) throw new Error(`no map for chapter ${chapter}`);
  Object.assign(row.hooks, hooks);
  return row;
}

// The layout's world order must match the world table's order for the
// chapter (ids, in play order). Throws a clear error when it does not, so a
// world added to the table without a spot on the map fails loudly.
export function checkLayoutOrder(chapter, worldIds) {
  const row = MAP_CHAPTERS[chapter];
  if (!row) throw new Error(`no map for chapter ${chapter}`);
  const { layout } = row;
  const missing = worldIds.filter(id => !layout.nodes[id]);
  if (missing.length || worldIds.join() !== layout.order.join()) {
    throw new Error(
      `Chapter ${chapter} map layout does not match its worlds: the world table has ` +
      `[${worldIds.join(', ')}], the layout has [${layout.order.join(', ')}]` +
      (missing.length ? `; no spot for ${missing.join(', ')}` : '')
    );
  }
  return row;
}
