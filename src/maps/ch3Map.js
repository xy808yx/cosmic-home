// Chapter 3 (the paper city): what its map adds to the stock world map, as
// mapChapters.js hooks. The sheet itself is the chapter's backdrop
// (starfieldHelper.createHomeGroundBase paints src/homeGround/citySheet.js);
// the road is the stock paper tube. On top of those this adds:
//   - a small paper bridge wherever the road crosses water, however wide.
//     The tube simply carries on over it (J, 2026-09-25: no dotted or dashed
//     roads, so no boat lines): a cream plank deck under the tube whose two
//     edges are thin ink rails, with a post at each end of each rail. Every
//     bridge is painted once into its own small canvas textures;
//   - the Science Dome's small ink glyph on the creek's east tip, only while
//     the dome is still unfound. Once its node is on the map the glyph goes,
//     so there are never two domes in one spot.
// A bridge on a road that is about to draw itself (the unlock reveal, a warp
// arrival) stays hidden until the growing tube reaches that shore.
//
// Phaser-free (it only calls methods on the scene it is given), so node can
// load mapChapters.js for the layout tests. Plain shapes only.

import { waterSpans } from '../homeGround/cityGeom.js';
import { drawDomeLandmark } from '../homeGround/scienceDome.js';
import { subPiece, pointAt } from './routeGeom.js';

const INK = 0x4a3b2c;
const DECK = 0xefe2c4;
// Where the dome's glyph prints before it is found: the creek's east tip,
// under the spot its node takes once found. y is the roof line of the
// glyph's base block (see drawDomeLandmark).
const DOME_MARK = { x: 914, y: 880 };
// Bridge proportions, from the tube's own half width out: a cream plank shows
// DECK_PAD px each side of the tube, and its two long edges are the ink rails,
// with a post at each end of each rail. The deck runs SHORE_REACH px onto each
// shore so it sits on land at both ends.
const DECK_PAD = 7;
const RAIL_W = 2.5;
const POST_R = 3.5;
const SHORE_REACH = 10;
// Under the road's glow (depth 2) and over it.
const DECK_DEPTH = 1.9;
const RAIL_DEPTH = 2.2;

const css = (c, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
let serial = 0;

// ------------------------------------------------------------ hooks

// Fresh state for this build (the scene instance is reused across restarts).
function backdrop(scene) {
  scene._ch3 = { crossings: [], domeOnMap: false, images: [] };
}

// Nothing is cut: the tube carries on over the water. Each piece's water
// crossings are noted for afterBake, and the dome's branch tells us its node
// is on the map.
function piecesToDraw(scene, piece, { branch = false } = {}) {
  const st = scene._ch3;
  if (piece === domeBranch(scene)) st.domeOnMap = true;
  st.crossings.push(...crossingsOf(piece, branch));
  return [piece];
}

function afterBake(scene) {
  const st = scene._ch3;
  const tube = scene._routeLayer.skin.tube;
  const halfOf = (branch) => (tube.width * (branch ? tube.branch.scale : 1)) / 2;

  // Pieces held back to draw themselves later (their bridges wait for them).
  const arriving = scene._arrivalBranch?.piece;
  const waiting = [];
  for (const piece of scene._roadReserved || []) {
    if (piece === domeBranch(scene)) st.domeOnMap = true;
    waiting.push(...crossingsOf(piece, piece === arriving));
  }

  for (const c of st.crossings) addBridge(scene, c, halfOf(c.branch));
  const pending = waiting.map(c => ({ ...c, images: addBridge(scene, c, halfOf(c.branch), false) }));
  if (pending.length) revealWithGrowth(scene, pending);

  if (!st.domeOnMap) {
    const g = scene.add.graphics().setDepth(-9.5);
    drawDomeLandmark(g, DOME_MARK.x, DOME_MARK.y);
    st.images.push(g);
  }
}

export const CH3_HOOKS = { backdrop, piecesToDraw, afterBake };

// ------------------------------------------------------------ helpers

// The drawn branch of the chapter's dome secret (the layout marks it with
// art 'scienceDome'), or null.
function domeBranch(scene) {
  const secrets = scene._mapLayout?.secrets || {};
  const id = Object.keys(secrets).find(k => secrets[k].art === 'scienceDome');
  return id != null ? scene._mapRoute?.secrets?.[id]?.drawn ?? null : null;
}

// A stretch of water shorter than this is the road clipping a nick of
// shoreline, not a crossing: the tube simply covers it, with no bridge.
const MIN_BRIDGE = 12;

// Every stretch of the piece over water, as { piece, branch, s0, s1 }
// (distances along the piece).
function crossingsOf(piece, branch) {
  return waterSpans(piece.poly).spans
    .filter(sp => sp.s1 - sp.s0 >= MIN_BRIDGE)
    .map(sp => ({ piece, branch, s0: sp.s0, s1: sp.s1 }));
}

// Paints one bridge into two small canvas textures (the deck under the tube,
// the rails and posts over it) and shows them. Returns the two images.
function addBridge(scene, c, half, visible = true) {
  const { piece } = c;
  const d0 = Math.max(0, c.s0 - SHORE_REACH);
  const d1 = Math.min(piece.length, c.s1 + SHORE_REACH);
  const span = subPiece(piece, d0, d1);
  const deckHalf = half + DECK_PAD;

  // The ends of each rail, off the span's two ends along its normals.
  const ends = [pointAt(piece, d0), pointAt(piece, d1)].map(p => {
    const nx = -Math.sin(p.angle), ny = Math.cos(p.angle);
    return [-1, 1].map(side => [p.x + nx * side * deckHalf, p.y + ny * side * deckHalf]);
  }).flat();

  const reach = deckHalf + Math.max(RAIL_W, POST_R) + 2;
  const xs = span.poly.map(p => p[0]), ys = span.poly.map(p => p[1]);
  const x0 = Math.floor(Math.min(...xs) - reach), y0 = Math.floor(Math.min(...ys) - reach);
  const w = Math.ceil(Math.max(...xs) + reach) - x0, h = Math.ceil(Math.max(...ys) + reach) - y0;

  // The plank, square at both ends.
  const deck = bakeImage(scene, x0, y0, w, h, DECK_DEPTH, (ctx) => {
    ctx.lineCap = 'butt';
    trace(ctx, span.poly);
    ctx.strokeStyle = css(DECK);
    ctx.lineWidth = 2 * deckHalf;
    ctx.stroke();
  });

  // Both rails at once: a wide ink stroke with its middle cut away, so they
  // follow any bend in the span. Then a post at each end of each rail.
  const rails = bakeImage(scene, x0, y0, w, h, RAIL_DEPTH, (ctx) => {
    ctx.lineCap = 'butt';
    trace(ctx, span.poly);
    ctx.strokeStyle = css(INK);
    ctx.lineWidth = 2 * deckHalf + RAIL_W;
    ctx.stroke();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 2 * deckHalf - RAIL_W;
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = css(INK);
    for (const [x, y] of ends) {
      ctx.beginPath();
      ctx.arc(x, y, POST_R, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 0.85);

  // The floating pills (YOU ARE HERE) keep off the bridge as they do the
  // road: a box every 16 px along it, weighted like the road.
  const box = 2 * (deckHalf + POST_R);
  for (let d = d0; d <= d1 + 0.5; d += 16) {
    const p = pointAt(piece, Math.min(d, d1));
    scene.addObstacle({ x: p.x - box / 2, y: p.y - box / 2, width: box, height: box }, 0, 1);
  }

  const images = [deck, rails];
  if (!visible) for (const img of images) img.setVisible(false);
  scene._ch3.images.push(...images);
  return images;
}

function trace(ctx, poly) {
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
}

// A small canvas texture covering [x0, y0, w, h], painted once and freed with
// the scene. A canvas texture goes back to the GPU by itself after a lost
// WebGL context.
function bakeImage(scene, x0, y0, w, h, depth, paint, alpha = 1) {
  const key = `__ch3Bridge${++serial}`;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  ctx.save();
  ctx.translate(-x0, -y0);
  paint(ctx);
  ctx.restore();
  tex.refresh();
  scene.events.once('shutdown', () => { if (scene.textures.exists(key)) scene.textures.remove(key); });
  return scene.add.image(x0, y0, key).setOrigin(0, 0).setDepth(depth).setAlpha(alpha);
}

// Bridges on a road that draws itself later come in as its tube reaches
// them. The map asks its road layer for a grower when that road starts to
// draw; this wraps that one layer's grower() so each grower on a waiting
// piece shows the piece's bridges once it is drawn up to their near shore
// (or all at once when it is finished, a tap-to-skip).
function revealWithGrowth(scene, pending) {
  const layer = scene._routeLayer;
  const makeGrower = layer.grower.bind(layer);
  layer.grower = (piece, opts) => {
    const grower = makeGrower(piece, opts);
    const mine = pending.filter(b => b.piece === piece);
    if (!mine.length) return grower;
    const reach = (d) => {
      for (const b of mine) {
        if (b.shown || d < b.s0 - SHORE_REACH) continue;
        b.shown = true;
        for (const img of b.images) {
          if (!img.active) continue;
          const alpha = img.alpha;
          img.setAlpha(0).setVisible(true);
          scene.tweens.add({ targets: img, alpha, duration: 160 });
        }
      }
    };
    const { setLength, finish } = grower;
    grower.setLength = (d) => { setLength(d); reach(d); };
    grower.finish = () => { finish(); reach(Infinity); };
    return grower;
  };
}
