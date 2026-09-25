// The map road: ONE continuous glowing tube, one skin per chapter, like the
// roads on a SNES overworld map. J, 2026-09-25: no beads, dots, dashes or
// sparks ride any road, on any chapter.
//
// The road is baked once per map build with Canvas 2D into two canvas textures:
//   road: full resolution. The tube's thin darker edge, then `steps` ever
//         narrower opaque strokes from the side tint to the light core.
//   glow: half resolution (shown at 2x, it is soft anyway). Gaussian shadow
//         passes; the whole glow breathes slowly.
// Canvas antialiases, its joins and caps are truly round, and one stroke() of
// a path with many subpaths covers each pixel once, so every layer is ONE
// whole-path stroke and joins never double up. Canvas textures also survive a
// lost WebGL context (iOS drops it when the app is put away): the pixels live
// in the canvas and are sent to the GPU again on restore.
//
// Pieces are routeGeom measured pieces ({ poly, cum, length }). Branches
// (secrets and gates) are added with { branch: true, accent } and are drawn a
// bit thinner, tinted toward their own accent.
//
// The unlock reveal grows one piece out of the cleared world on a small canvas
// of its own (grower), redrawn as it lengthens; the finished piece stays on
// that small canvas until the next map build bakes it with the rest.

import Phaser from 'phaser';
import { slicePoly } from './routeGeom.js';

const W = 1080;
const H = 1920;
const GLOW_RES = 0.5;

// tube.width: full width of the main tube in px (edge included)
// tube.edge: edge thickness each side; edgeColor, body (the tube's sides),
//   core (its centre line); flat: how much of the middle is pure core
// tube.glow: Gaussian glow passes [sigma px, alpha, width x tube]
// tube.branch: secrets and gates, thinner (scale) and tinted toward their own
//   accent (tint 0 to 1)
// glowBlend: 'ADD' on the dark space maps; 'NORMAL' on paper, where ADD would
//   only bleach the cream sheet
// breathe: [low alpha, high alpha, ms] for the glow's slow breathe
export const SKINS = {
  // Chapter 1, Outer Space: a near-white tube with a cool cyan tint, a thin
  // cyan edge and a soft cyan glow. 18 px wide, picked from three takes at
  // phone size: it reads as one solid road without outshining the world art.
  space: {
    glowBlend: 'ADD',
    tube: {
      width: 18, edge: 2, steps: 8, flat: 0.4,
      edgeColor: 0x2398bc, body: 0xb4efff, core: 0xf8ffff,
      glowColor: 0x46d6ea, glow: [[4, 0.7, 1], [14, 0.45, 1.6]],
      branch: { scale: 0.72, tint: 0.5 },
    },
    breathe: [0.8, 1.0, 2600],
  },
  // Chapter 2, Inner Space: a cream to pale gold tube, a thin amber edge and a
  // soft warm gold glow.
  vessel: {
    glowBlend: 'ADD',
    tube: {
      width: 18, edge: 2, steps: 8, flat: 0.4,
      edgeColor: 0xa85a24, body: 0xffcf7a, core: 0xfff0c8,
      glowColor: 0xffb54a, glow: [[4, 0.65, 1], [14, 0.42, 1.6]],
      branch: { scale: 0.72, tint: 0.5 },
    },
    breathe: [0.8, 1.0, 3000],
  },
  // Chapter 3, the paper city: a cream tube with a thin brown edge and a soft
  // warm glow laid NORMAL on the paper.
  paper: {
    glowBlend: 'NORMAL',
    tube: {
      width: 22, edge: 3, steps: 6, flat: 0.5,
      edgeColor: 0x6b4a2f, body: 0xf7e2b8, core: 0xfff8e8,
      glowColor: 0xffc27a, glow: [[5, 0.45, 1], [16, 0.32, 1.6]],
      branch: { scale: 0.8, tint: 0.45 },
    },
    breathe: [0.85, 1.0, 3200],
  },
};

// Canvas texture keys are unique per map build.
let serial = 0;

export class RouteLayer {
  constructor(scene, skinName, { depth = 2 } = {}) {
    const skin = SKINS[skinName];
    if (!skin) throw new Error('unknown road skin ' + skinName);
    this.scene = scene;
    this.skin = skin;
    this.skinName = skinName;
    this.depth = depth;
    this.queue = [];
    this.baked = false;
    // Every piece drawn so far, as { piece, branch, accent } (the label
    // spreader keeps names off them).
    this.bakedPieces = [];
    this._keys = [];
    this._glowImages = [];
    this._growers = [];

    const n = ++serial;
    this._glowTex = this._canvas(`__mapRoadGlow${n}`, W * GLOW_RES, H * GLOW_RES);
    this._tubeTex = this._canvas(`__mapRoad${n}`, W, H);
    this.glowImage = this._glowImage(this._glowTex.key, 0, 0, depth);
    this.roadImage = scene.add.image(0, 0, this._tubeTex.key).setOrigin(0, 0).setDepth(depth);

    // Canvas textures go back to the GPU by themselves after a lost WebGL
    // context; this marks each one fresh, as the ride down does.
    this._renderer = scene.sys.game.renderer;
    this._onRestore = () => {
      for (const key of this._keys) {
        const tex = scene.textures.exists(key) && scene.textures.get(key);
        if (tex && typeof tex.refresh === 'function') tex.refresh();
      }
    };
    if (this._renderer && typeof this._renderer.on === 'function') this._renderer.on('restorewebgl', this._onRestore);
    scene.events.once('shutdown', () => this.destroy());
  }

  _canvas(key, w, h) {
    const tex = this.scene.textures.createCanvas(key, Math.ceil(w), Math.ceil(h));
    this._keys.push(key);
    return tex;
  }

  _glowImage(key, x, y, depth) {
    const img = this.scene.add.image(x, y, key).setOrigin(0, 0).setScale(1 / GLOW_RES).setDepth(depth);
    if (this.skin.glowBlend === 'ADD') img.setBlendMode(Phaser.BlendModes.ADD);
    if (this._glowAlpha != null) img.setAlpha(this._glowAlpha);
    this._glowImages.push(img);
    return img;
  }

  // Queue a piece: branches (secrets and gates) pass { branch: true, accent }.
  add(piece, { branch = false, accent = null } = {}) {
    this.queue.push({ piece, branch, accent });
  }

  // Paints everything queued since the last bake. Safe to call again for a
  // late piece (it paints on top of what is already baked).
  bake() {
    const items = this.queue.splice(0);
    this.baked = true;
    if (!items.length) return;
    drawTubeGlow(this._glowTex.getContext(), items, this.skin, GLOW_RES);
    drawTube(this._tubeTex.getContext(), items, this.skin, 1);
    this._glowTex.refresh();
    this._tubeTex.refresh();
    this.bakedPieces.push(...items);
  }

  // The slow breathe on every glow this layer owns (growers included).
  startLife() {
    const b = this.skin.breathe;
    if (!b || this._breathe) return;
    const [lo, hi, ms] = b;
    const proxy = { a: hi };
    this._glowAlpha = hi;
    this._breathe = this.scene.tweens.add({
      targets: proxy, a: { from: hi, to: lo },
      duration: ms, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      onUpdate: () => {
        this._glowAlpha = proxy.a;
        for (const img of this._glowImages) if (img.active) img.setAlpha(proxy.a);
      },
    });
  }

  // A piece that draws itself from its start, for the unlock reveal and the
  // secret-warp arrival. It lives on a small canvas pair covering the piece
  // plus the glow's reach. setLength(d) redraws the first d px; finish()
  // draws it whole. The piece counts as drawn from the moment it is made.
  grower(piece, { branch = false, accent = null } = {}) {
    const t = this.skin.tube;
    const reach = Math.max(t.width / 2, ...t.glow.map(([sigma, , wMul = 1]) => (t.width * wMul) / 2 + 3 * sigma));
    const pad = Math.ceil(reach) + 4;
    const xs = piece.poly.map(p => p[0]);
    const ys = piece.poly.map(p => p[1]);
    const x0 = Math.floor(Math.min(...xs) - pad);
    const y0 = Math.floor(Math.min(...ys) - pad);
    const w = Math.ceil(Math.max(...xs) + pad) - x0;
    const h = Math.ceil(Math.max(...ys) + pad) - y0;
    const n = ++serial;
    const glowTex = this._canvas(`__mapRoadGrowGlow${n}`, w * GLOW_RES, h * GLOW_RES);
    const tubeTex = this._canvas(`__mapRoadGrow${n}`, w, h);
    // The glow sits just under the baked road, the tube on top of it.
    const glowImg = this._glowImage(glowTex.key, x0, y0, this.depth - 0.01);
    const tubeImg = this.scene.add.image(x0, y0, tubeTex.key).setOrigin(0, 0).setDepth(this.depth);
    const item = { piece, branch, accent, upTo: 0 };
    this.bakedPieces.push({ piece, branch, accent });
    let drawnTo = -1;
    const draw = (d) => {
      const upTo = Math.max(0, Math.min(piece.length, d));
      if (Math.abs(upTo - drawnTo) < 0.5) return;
      drawnTo = upTo;
      item.upTo = upTo;
      const gctx = glowTex.getContext();
      gctx.setTransform(1, 0, 0, 1, 0, 0);
      gctx.clearRect(0, 0, glowTex.width, glowTex.height);
      gctx.translate(-x0 * GLOW_RES, -y0 * GLOW_RES);
      drawTubeGlow(gctx, [item], this.skin, GLOW_RES);
      gctx.setTransform(1, 0, 0, 1, 0, 0);
      const tctx = tubeTex.getContext();
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.clearRect(0, 0, tubeTex.width, tubeTex.height);
      tctx.translate(-x0, -y0);
      drawTube(tctx, [item], this.skin, 1);
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      glowTex.refresh();
      tubeTex.refresh();
    };
    const g = {
      piece,
      images: [glowImg, tubeImg],
      setLength: draw,
      finish: () => draw(piece.length),
    };
    this._growers.push(g);
    return g;
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this._renderer && typeof this._renderer.off === 'function') this._renderer.off('restorewebgl', this._onRestore);
    if (this._breathe) this._breathe.stop();
    for (const img of this._glowImages) img.destroy();
    this.roadImage?.destroy();
    for (const g of this._growers) for (const img of g.images) img.destroy();
    for (const key of this._keys) {
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    }
  }
}

// ------------------------------------------------------------ tube drawing
// Pure Canvas 2D. items are { piece, branch, accent } plus an optional upTo
// (px along the piece) to draw only the start of it. s scales every
// coordinate and width (1 for the tube, GLOW_RES for the glow).

const rgbOf = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
function mixColor(a, b, t) {
  const A = rgbOf(a), B = rgbOf(b);
  const ch = (i) => Math.round(A[i] + (B[i] - A[i]) * t);
  return (ch(0) << 16) | (ch(1) << 8) | ch(2);
}
const cssColor = (c, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

// The main route is one group; every branch is its own group, thinner and
// tinted toward its accent. Branches come first so the main tube sits on top.
function tubeGroups(items, t) {
  const groups = [];
  for (const it of items) {
    if (!it.branch) continue;
    const acc = it.accent != null ? it.accent : t.glowColor;
    const k = it.accent != null ? t.branch.tint : 0;
    groups.push({
      items: [it], width: t.width * t.branch.scale, edge: Math.max(1.25, t.edge * t.branch.scale),
      edgeColor: mixColor(t.edgeColor, acc, k), body: mixColor(t.body, acc, k),
      core: mixColor(t.core, acc, k * 0.35), glow: mixColor(t.glowColor, acc, Math.min(1, k * 1.6)),
    });
  }
  const main = items.filter(it => !it.branch);
  if (main.length) groups.push({ items: main, width: t.width, edge: t.edge, edgeColor: t.edgeColor, body: t.body, core: t.core, glow: t.glowColor });
  return groups;
}

// One path for the whole group: one subpath per piece, shifted dx px (the
// glow draws its casting stroke off the canvas).
function traceGroup(ctx, items, s, dx = 0) {
  ctx.beginPath();
  for (const it of items) {
    const poly = it.upTo != null ? slicePoly(it.piece, it.upTo) : it.piece.poly;
    if (poly.length < 2) continue;
    ctx.moveTo(poly[0][0] * s + dx, poly[0][1] * s);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0] * s + dx, poly[i][1] * s);
  }
}

// The tube: the edge, then `steps` ever narrower strokes from the side tint to
// the core colour. Every stroke is opaque and covers the whole group at once.
export function drawTube(ctx, items, skin, s = 1) {
  const t = skin.tube;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const g of tubeGroups(items, t)) {
    traceGroup(ctx, g.items, s);
    ctx.strokeStyle = cssColor(g.edgeColor);
    ctx.lineWidth = g.width * s;
    ctx.stroke();
    const inner = g.width - 2 * g.edge;
    for (let k = 0; k < t.steps; k++) {
      const r = 1 - k / t.steps; // share of the inner width, 1 down to 1/steps
      ctx.strokeStyle = cssColor(mixColor(g.core, g.body, smooth((r - t.flat) / (1 - t.flat))));
      ctx.lineWidth = inner * r * s;
      ctx.stroke();
    }
  }
}

// The glow: per group, one Gaussian shadow pass per [sigma, alpha, width]
// (width as a multiple of the tube's). The casting stroke is drawn OFF the
// canvas and only its shadow is shifted back on, so a pass can be as wide and
// strong as it likes without a hard band. Shadows ignore the transform, so the
// context may be translated but never scaled.
const GLOW_OFF = 8192;
export function drawTubeGlow(ctx, items, skin, s = GLOW_RES) {
  const t = skin.tube;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const g of tubeGroups(items, t)) {
    traceGroup(ctx, g.items, s, -GLOW_OFF);
    for (const [sigma, a, wMul = 1] of t.glow) {
      ctx.save();
      ctx.shadowColor = cssColor(g.glow, a);
      ctx.shadowBlur = 2 * sigma * s; // canvas shadowBlur is twice the sigma
      ctx.shadowOffsetX = GLOW_OFF;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = g.width * wMul * s;
      ctx.stroke();
      ctx.restore();
    }
  }
}
