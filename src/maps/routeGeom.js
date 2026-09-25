// Route path math for the chapter maps. Phaser-free, so node can load it for
// the layout tests (tests/map-layout.test.mjs).
//
// A leg is a list of waypoints: both end nodes and every bend in between. Each
// bend is rounded with a true circular arc of fixed radius (CORNER_R); the runs
// between bends stay straight at 0, 45 or 90 degrees, like the roads on a SNES
// overworld map. The rounded leg is kept as a sparse polyline (2 points per
// straight run, an arc sampled every ARC_STEP px) with cumulative lengths, so
// pointAt(distance) is exact on the runs and within a hair on the arcs, and the
// ship can fly the route at a constant speed and land exactly on its node.

export const CORNER_R = 40;
export const ARC_STEP = 3;

const EPS = 1e-6;

function norm(dx, dy) {
  const l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
}

// Rounds every interior bend of pts with a circular arc of the given radius.
// Returns [[x, y], ...] from the first point to the last.
export function roundedPolyline(pts, radius = CORNER_R, arcStep = ARC_STEP) {
  const out = [];
  const push = (x, y) => {
    const l = out[out.length - 1];
    if (!l || Math.hypot(x - l[0], y - l[1]) > EPS) out.push([x, y]);
  };
  push(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i + 1];
    const d1 = norm(px - ax, py - ay);
    const d2 = norm(bx - px, by - py);
    const cos = Math.max(-1, Math.min(1, d1[0] * d2[0] + d1[1] * d2[1]));
    const turn = Math.acos(cos);
    if (turn < EPS) continue; // a waypoint on a straight line, nothing to round
    const cross = d1[0] * d2[1] - d1[1] * d2[0];
    const sgn = cross > 0 ? 1 : -1;
    const t = radius * Math.tan(turn / 2);
    const tx = px - d1[0] * t, ty = py - d1[1] * t; // where the arc starts
    const cx = tx + sgn * -d1[1] * radius;          // the arc's centre
    const cy = ty + sgn * d1[0] * radius;
    push(tx, ty);
    const a0 = Math.atan2(ty - cy, tx - cx);
    const n = Math.max(2, Math.ceil((radius * turn) / arcStep));
    for (let k = 1; k <= n; k++) {
      const a = a0 + sgn * turn * (k / n);
      push(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    }
  }
  const last = pts[pts.length - 1];
  push(last[0], last[1]);
  return out;
}

function cumulative(poly) {
  const cum = [0];
  for (let i = 1; i < poly.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
  }
  return cum;
}

// One measured piece of route: a leg, a secret branch or a gate branch.
export function measure(pts, radius = CORNER_R) {
  const poly = roundedPolyline(pts, radius);
  const cum = cumulative(poly);
  return { pts, poly, cum, length: cum[cum.length - 1] };
}

// Point and heading (radians) at distance d along a measured piece.
export function pointAt(piece, d) {
  const { poly, cum, length } = piece;
  const s = Math.max(0, Math.min(length, d));
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid; else hi = mid;
  }
  const seg = cum[hi] - cum[lo] || 1;
  const f = (s - cum[lo]) / seg;
  const [ax, ay] = poly[lo];
  const [bx, by] = poly[hi];
  return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f, angle: Math.atan2(by - ay, bx - ax) };
}

// The first d px of a measured piece as a polyline (the unlock reveal draws a
// leg growing out of the cleared world with this).
export function slicePoly(piece, d) {
  const { poly, cum, length } = piece;
  if (d >= length) return poly;
  if (d <= 0) return [poly[0]];
  const out = [poly[0]];
  let i = 1;
  while (i < poly.length && cum[i] <= d) out.push(poly[i++]);
  const p = pointAt(piece, d);
  out.push([p.x, p.y]);
  return out;
}

// The part of a measured piece between distances d0 and d1, measured again.
// A secret whose branch forks off a main leg draws only from its fork, and a
// chapter's hooks can cut a leg at a shore with it.
export function subPiece(piece, d0, d1) {
  const { poly, cum } = piece;
  const at = (d) => { const p = pointAt(piece, d); return [p.x, p.y]; };
  const out = [at(d0)];
  for (let i = 0; i < poly.length; i++) if (cum[i] > d0 + EPS && cum[i] < d1 - EPS) out.push(poly[i]);
  out.push(at(d1));
  const c = cumulative(out);
  return { ...piece, poly: out, cum: c, length: c[c.length - 1] };
}

// Measures a whole layout. Legs come back in play order; secrets and gates come
// back keyed like the layout. A secret with drawFrom also gets `drawn`, the
// part of its branch past the fork (the ship still flies the whole branch).
// nodeDist[id] is how far along the joined main route each world sits, for a
// constant-speed ship.
export function buildRoute(layout, opts = {}) {
  const radius = opts.radius ?? CORNER_R;
  const legs = layout.legs.map(l => ({ ...measure(l.pts, radius), from: l.from, to: l.to }));
  const secrets = {};
  for (const [id, s] of Object.entries(layout.secrets || {})) {
    const piece = { ...measure(s.pts, radius), id: +id, host: s.host };
    piece.drawn = s.drawFrom ? subPiece(piece, s.drawFrom, piece.length) : piece;
    secrets[id] = piece;
  }
  const gates = {};
  for (const [k, g] of Object.entries(layout.gates || {})) {
    const piece = { ...measure(g.pts, radius), key: k, host: g.host };
    piece.drawn = piece;
    gates[k] = piece;
  }
  const nodeDist = { [layout.order[0]]: 0 };
  let acc = 0;
  for (const l of legs) { acc += l.length; nodeDist[l.to] = acc; }
  return { layout, legs, secrets, gates, nodeDist, totalLength: acc };
}

// Point along the joined main route at distance d.
export function routePointAt(route, d) {
  let s = Math.max(0, Math.min(route.totalLength, d));
  for (const l of route.legs) {
    if (s <= l.length) return pointAt(l, s);
    s -= l.length;
  }
  const last = route.legs[route.legs.length - 1];
  return pointAt(last, last.length);
}

// ----------------------------------------------------------------- checks
// Used by the layout tests; cheap enough to run in the game too.

function ptSegDist(p, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const l2 = vx * vx + vy * vy;
  let t = l2 ? ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + vx * t), p[1] - (a[1] + vy * t));
}

function segmentsIntersect(a, b, c, d) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  return (o1 * o2 < 0) && (o3 * o4 < 0);
}

// Minimum distance between segments ab and cd.
function segSegDist(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(ptSegDist(a, c, d), ptSegDist(b, c, d), ptSegDist(c, a, b), ptSegDist(d, a, b));
}

// True minimum distance between two polylines (segment to segment, not sampled).
export function polyDist(p, q) {
  let best = Infinity;
  for (let i = 1; i < p.length; i++) {
    for (let j = 1; j < q.length; j++) {
      const d = segSegDist(p[i - 1], p[i], q[j - 1], q[j]);
      if (d < best) best = d;
    }
  }
  return best;
}

// Distance from a polyline to an axis-aligned rect {x, y, w, h} (0 if it enters).
export function polyRectDist(poly, r) {
  const corners = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
  const edges = [[corners[0], corners[1]], [corners[1], corners[2]], [corners[2], corners[3]], [corners[3], corners[0]]];
  const inRect = (p) => p[0] >= r.x && p[0] <= r.x + r.w && p[1] >= r.y && p[1] <= r.y + r.h;
  let best = Infinity;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1], b = poly[i];
    if (inRect(a) || inRect(b)) return 0;
    for (const [c, d] of edges) best = Math.min(best, segSegDist(a, b, c, d));
  }
  return best;
}

// Every straight run is a multiple of 45 degrees, no bend is sharper than a
// right angle, every bend has room for its corner (the two tangent lengths fit
// inside each run), and every piece ends on the nodes it names. Returns a list
// of problems (empty when the layout is sound).
export function validateAngles(layout, radius = CORNER_R) {
  const problems = [];
  const pieces = [
    ...layout.legs.map(l => ({ name: `leg ${l.from}>${l.to}`, pts: l.pts })),
    ...Object.entries(layout.secrets || {}).map(([id, s]) => ({ name: `secret ${id}`, pts: s.pts })),
    ...Object.entries(layout.gates || {}).map(([k, g]) => ({ name: `gate ${k}`, pts: g.pts })),
  ];
  for (const { name, pts } of pieces) {
    const tangents = [];
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
      const deg = Math.atan2(dy, dx) * 180 / Math.PI;
      if (Math.abs(deg / 45 - Math.round(deg / 45)) > 1e-6) problems.push(`${name}: run ${i} at ${deg.toFixed(1)} degrees`);
    }
    for (let i = 1; i < pts.length - 1; i++) {
      const d1 = norm(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const d2 = norm(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      const turn = Math.acos(Math.max(-1, Math.min(1, d1[0] * d2[0] + d1[1] * d2[1])));
      tangents[i] = radius * Math.tan(turn / 2);
      if (turn > Math.PI / 2 + 1e-6) problems.push(`${name}: hairpin of ${(turn * 180 / Math.PI).toFixed(0)} degrees at bend ${i}`);
    }
    for (let i = 1; i < pts.length; i++) {
      const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const need = (tangents[i - 1] || 0) + (tangents[i] || 0);
      if (need > len + 1e-6) problems.push(`${name}: run ${i} is ${len.toFixed(0)} px, corners need ${need.toFixed(0)}`);
    }
  }
  const ends = (pts) => [pts[0], pts[pts.length - 1]];
  for (const l of layout.legs) {
    const [a, b] = ends(l.pts);
    const na = layout.nodes[l.from], nb = layout.nodes[l.to];
    if (!na || !nb || a[0] !== na.x || a[1] !== na.y || b[0] !== nb.x || b[1] !== nb.y) problems.push(`leg ${l.from}>${l.to}: ends do not sit on its worlds`);
  }
  for (const [id, s] of Object.entries(layout.secrets || {})) {
    const h = layout.nodes[s.host];
    const [a, b] = ends(s.pts);
    if (!h) problems.push(`secret ${id}: host ${s.host} is not in this chapter`);
    else if (a[0] !== h.x || a[1] !== h.y || b[0] !== s.x || b[1] !== s.y) problems.push(`secret ${id}: branch ends do not sit on host and secret`);
  }
  for (const [k, g] of Object.entries(layout.gates || {})) {
    const h = layout.nodes[g.host];
    const [a, b] = ends(g.pts);
    if (!h) problems.push(`gate ${k}: host ${g.host} is not in this chapter`);
    else if (a[0] !== h.x || a[1] !== h.y || b[0] !== g.x || b[1] !== g.y) problems.push(`gate ${k}: branch ends do not sit on host and gate`);
  }
  return problems;
}

// Every piece of route as { name, nodes, poly }: legs, then secret branches,
// then gate branches. nodes names the ends ('w5', 'h15', 'g innerSpace').
export function allPieces(route) {
  return [
    ...route.legs.map(l => ({ name: `leg ${l.from}>${l.to}`, nodes: ['w' + l.from, 'w' + l.to], poly: l.poly })),
    ...Object.values(route.secrets).map(s => ({ name: `secret ${s.id}`, nodes: ['w' + s.host, 'h' + s.id], poly: s.poly })),
    ...Object.values(route.gates).map(g => ({ name: `gate ${g.key}`, nodes: ['w' + g.host, 'g' + g.key], poly: g.poly })),
  ];
}

// Minimum distance between every pair of pieces that do not share a node.
// Returns [{ a, b, dist }] sorted closest first.
export function pieceSpacing(route) {
  const pieces = allPieces(route);
  const out = [];
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i], b = pieces[j];
      if (a.nodes.some(n => b.nodes.includes(n))) continue;
      out.push({ a: a.name, b: b.name, dist: +polyDist(a.poly, b.poly).toFixed(1) });
    }
  }
  return out.sort((x, y) => x.dist - y.dist);
}
