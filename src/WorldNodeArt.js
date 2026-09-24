// Procedural map-node icons, one per world, keyed by world id.
// drawWorldNode returns a Container drawn at (x, y) (the position is set on
// the container, drawing offsets are local). Sized to about 140 to 180px on
// the longest axis at default scale. Pass `scale` to resize. The same icon is
// shown at 0.95x on the map, 3x as the level-select hero and, for the finale
// world 38, 2.4x in the credits.
//
// Chapters 1 and 2 are drawn inline below. Chapter 3 "Home Ground" (worlds 31
// to 38) lives in src/homeGround and is registered at the bottom of this file.

import { style } from './textStyles.js';
import { HOME_GROUND_WORLDS } from './homeGround/index.js';

export function drawWorldNode(scene, x, y, worldId, opts = {}) {
  const scale = opts.scale ?? 1;
  const container = scene.add.container(x, y);
  if (opts.silhouette) {
    drawSilhouette(scene, container);
  } else {
    const renderer = NODE_RENDERERS[worldId] || NODE_RENDERERS[1];
    renderer(scene, container, scale);
  }
  container.setScale(scale);
  container.worldId = worldId;
  return container;
}

// Generic locked-world silhouette: dark blob + ? glyph.
function drawSilhouette(scene, c) {
  const g = scene.add.graphics();
  // Drop shadow
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(0, 56, 130, 22);
  // Main silhouette body — soft rounded blob
  g.fillStyle(0x12122a, 0.92);
  g.fillCircle(0, 0, 60);
  g.fillCircle(-22, -10, 32);
  g.fillCircle(28, -6, 28);
  g.fillCircle(-10, 30, 24);
  // Subtle accent edge
  g.lineStyle(3, 0x2a2a44, 1);
  g.strokeCircle(0, 0, 62);
  c.add(g);
  // A decorative glyph painted on the locked blob, deliberately dim (it marks
  // "not yet", nothing to read), so it is exempt from the text floor.
  const q = scene.add.text(0, 4, '?', style('display', {
    fontSize: '64px',
    fill: '#3a3a4a',
    strokeThickness: 4,
    art: true
  })).setOrigin(0.5);
  c.add(q);
}

const NODE_RENDERERS = {};

// 1 — Moon Base: pale periwinkle moon with mint highlights and candy flag
NODE_RENDERERS[1] = function drawMoonBase(scene, c, _s) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(0, 50, 130, 24);
  // Base body — shadow band first, then mid, then bright top
  g.fillStyle(0x8b9bd6, 1);
  g.fillCircle(0, 0, 60);
  g.fillStyle(0xc7d2ff, 1);
  g.fillCircle(-4, -6, 54);
  g.fillStyle(0xe8efff, 1);
  g.fillEllipse(-20, -22, 44, 28);
  // Cratery details
  g.fillStyle(0x6f7ec4, 0.9);
  g.fillCircle(20, 14, 9);
  g.fillCircle(-12, 26, 7);
  g.fillCircle(34, -14, 6);
  g.fillStyle(0xb5e6ff, 0.7);
  g.fillCircle(20, 12, 4);
  // Candy-stripe flag pole
  g.lineStyle(3, 0xfff3b8, 1);
  g.lineBetween(-5, -58, -5, -22);
  g.fillStyle(0xff9ec7, 1);
  g.fillTriangle(-5, -58, -5, -44, 22, -52);
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(-5, -52, -5, -46, 14, -49);
  c.add(g);
};

// 2 — Asteroid Belt: peach + clay rocks with bright rim light
NODE_RENDERERS[2] = function drawAsteroidBelt(scene, c, _s) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(0, 60, 150, 22);
  const rocks = [
    [-30, -10, 28, 0xd49774, 0xffd0a6],
    [25, 5, 35, 0xc77a4a, 0xffb38a],
    [10, -30, 22, 0xe2a884, 0xffe0c2],
    [-50, 18, 18, 0xb56a3e, 0xffa37a],
    [45, -22, 16, 0xd49774, 0xffd0a6]
  ];
  for (const [rx, ry, r, base, rim] of rocks) {
    g.fillStyle(base, 1);
    g.fillCircle(rx, ry, r);
    // Bright rim light on the upper-left
    g.fillStyle(rim, 1);
    g.fillCircle(rx - r * 0.35, ry - r * 0.4, r * 0.55);
    // Soft shadow pool on the bottom-right
    g.fillStyle(0x6b3a1a, 0.45);
    g.fillCircle(rx + r * 0.3, ry + r * 0.25, r * 0.32);
  }
  // A few stardust speckles
  g.fillStyle(0xfff3b8, 1);
  g.fillCircle(60, 30, 2);
  g.fillCircle(-40, -28, 1.5);
  c.add(g);
};

// 3 — Crystal Planet: faceted lavender + rose with rainbow glints
NODE_RENDERERS[3] = function drawCrystalPlanet(scene, c, _s) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(0, 60, 140, 22);
  // Big central crystal — back/dark face
  g.fillStyle(0x9d6bff, 1);
  g.beginPath();
  g.moveTo(0, -58);
  g.lineTo(40, 12);
  g.lineTo(0, 52);
  g.lineTo(-40, 12);
  g.closePath();
  g.fillPath();
  // Mid face
  g.fillStyle(0xd5a6ff, 1);
  g.beginPath();
  g.moveTo(0, -58);
  g.lineTo(18, 0);
  g.lineTo(0, 36);
  g.lineTo(-18, 0);
  g.closePath();
  g.fillPath();
  // Bright front facet
  g.fillStyle(0xfce7ff, 1);
  g.beginPath();
  g.moveTo(0, -58);
  g.lineTo(8, -20);
  g.lineTo(0, 16);
  g.lineTo(-8, -20);
  g.closePath();
  g.fillPath();
  // Side crystals
  g.fillStyle(0xff9ec7, 1);
  g.fillTriangle(48, 12, 62, 52, 30, 52);
  g.fillStyle(0xffd0e5, 1);
  g.fillTriangle(38, 18, 48, 50, 30, 50);
  g.fillStyle(0xb6e0ff, 1);
  g.fillTriangle(-48, 12, -62, 52, -30, 52);
  g.fillStyle(0xe2f0ff, 1);
  g.fillTriangle(-38, 18, -48, 50, -30, 50);
  // Rainbow glints (small but bright)
  g.fillStyle(0xfff3b8, 1);
  g.fillCircle(-5, -22, 3);
  g.fillStyle(0x9be8a3, 1);
  g.fillCircle(22, -8, 2);
  g.fillStyle(0xff9ec7, 1);
  g.fillCircle(-26, 18, 2);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(0, -40, 4);
  c.add(g);
};

// 4 — Nebula Gardens: mint green + lavender swirl with candy blossoms
NODE_RENDERERS[4] = function drawNebulaGardens(scene, c, _s) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(0, 60, 140, 22);
  // Hill — three layers from dark to bright
  g.fillStyle(0x3a7a52, 1);
  g.fillEllipse(0, 32, 124, 84);
  g.fillStyle(0x9be8a3, 1);
  g.fillEllipse(0, 26, 112, 62);
  g.fillStyle(0xd6f5d0, 0.85);
  g.fillEllipse(-18, 6, 56, 32);
  // Lavender nebula swirl drifting across
  g.fillStyle(0xd5a6ff, 0.45);
  g.fillEllipse(20, -6, 50, 22);
  g.fillStyle(0xfce7ff, 0.55);
  g.fillEllipse(8, -16, 30, 14);
  // Vine arch
  g.lineStyle(4, 0x4f956b, 1);
  g.beginPath();
  g.arc(0, 12, 24, Math.PI, 0);
  g.strokePath();
  // Blossoms
  g.fillStyle(0xff9ec7, 1);
  g.fillCircle(-24, 12, 7);
  g.fillCircle(24, 12, 7);
  g.fillStyle(0xfff3b8, 1);
  g.fillCircle(-24, 12, 3);
  g.fillCircle(24, 12, 3);
  g.fillStyle(0xffe07a, 1);
  g.fillCircle(0, -22, 6);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(0, -22, 2.5);
  c.add(g);
};

// 5 — Robot Station: sky blue + steel modules with cheerful lights
NODE_RENDERERS[5] = function drawRobotStation(scene, c, _s) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(0, 60, 130, 22);
  // Lower module (bright sky)
  g.fillStyle(0x9bd4ff, 1);
  g.fillRoundedRect(-44, 10, 88, 42, 10);
  g.fillStyle(0xd6ecff, 1);
  g.fillRoundedRect(-44, 10, 88, 12, 10);
  // Upper module (steel)
  g.fillStyle(0x4c7ab5, 1);
  g.fillRoundedRect(-32, -28, 64, 32, 8);
  g.fillStyle(0x82a8d8, 1);
  g.fillRoundedRect(-32, -28, 64, 8, 8);
  // Antenna with sparkle
  g.fillStyle(0xb6e0ff, 1);
  g.fillRect(-2, -58, 4, 30);
  g.fillStyle(0xfff3b8, 1);
  g.fillCircle(0, -60, 5);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(0, -60, 2);
  // Lights
  g.fillStyle(0xff9ec7, 1);
  g.fillCircle(-15, -12, 5);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(-15, -12, 1.5);
  g.fillStyle(0x9be8a3, 1);
  g.fillCircle(15, -12, 5);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(15, -12, 1.5);
  // Window glow
  g.fillStyle(0xffe07a, 1);
  g.fillRoundedRect(-24, 26, 14, 14, 2);
  g.fillRoundedRect(10, 26, 14, 14, 2);
  g.fillStyle(0xffffff, 0.6);
  g.fillRect(-22, 28, 4, 4);
  g.fillRect(12, 28, 4, 4);
  c.add(g);
};

// 6 — Black Hole Edge: rose accretion ring around a black void
NODE_RENDERERS[6] = function drawBlackHoleEdge(scene, c, _s) {
  const g = scene.add.graphics();
  // Soft outer halo
  g.fillStyle(0xff9ec7, 0.30);
  g.fillCircle(0, 0, 78);
  g.fillStyle(0xffd0e5, 0.45);
  g.fillCircle(0, 0, 60);
  // Mid pink ring
  g.fillStyle(0xff9ec7, 0.85);
  g.fillCircle(0, 0, 46);
  g.fillStyle(0xffd0e5, 1);
  g.fillCircle(0, 0, 36);
  // Dark inner zone with absolute void
  g.fillStyle(0x4a2a55, 1);
  g.fillCircle(0, 0, 28);
  g.fillStyle(0x07071a, 1);
  g.fillCircle(0, 0, 18);
  // Bright accretion arc on top, bending light
  g.lineStyle(4, 0xfff3b8, 0.9);
  g.beginPath();
  g.arc(0, 0, 54, Math.PI * 0.85, Math.PI * 0.15, true);
  g.strokePath();
  g.lineStyle(2, 0xff9ec7, 0.85);
  g.beginPath();
  g.arc(0, 0, 42, Math.PI, Math.PI * 1.6);
  g.strokePath();
  // Speck stars getting pulled in
  g.fillStyle(0xffffff, 1);
  g.fillCircle(46, -22, 2.5);
  g.fillCircle(-38, 28, 2);
  g.fillCircle(36, 36, 1.5);
  c.add(g);
};

// 7 — Ice Comet: frosty shard streaking with bright trail
NODE_RENDERERS[7] = function drawIceComet(scene, c, _s) {
  const g = scene.add.graphics();
  // Trail — three layers of frost blue
  g.fillStyle(0xb6e0ff, 0.30);
  g.fillTriangle(-15, 0, -85, -34, -85, 34);
  g.fillStyle(0xd6ecff, 0.55);
  g.fillTriangle(-10, 0, -60, -20, -60, 20);
  g.fillStyle(0xffffff, 0.75);
  g.fillTriangle(-5, 0, -40, -12, -40, 12);
  // Comet body
  g.fillStyle(0xb6e0ff, 1);
  g.fillCircle(15, 0, 30);
  g.fillStyle(0xe2f4ff, 1);
  g.fillCircle(15, 0, 22);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(8, -10, 14);
  // Sharp icicle facet line
  g.lineStyle(2, 0x6e95c2, 1);
  g.lineBetween(22, -10, 30, 6);
  g.lineBetween(8, 14, 16, 22);
  // Sparkles in the trail
  g.fillStyle(0xfff3b8, 1);
  g.fillCircle(-50, -5, 3);
  g.fillCircle(-65, 8, 2);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(-32, -16, 2);
  c.add(g);
};

// 8 — Supernova: warm coral burst with cherry rays
NODE_RENDERERS[8] = function drawSupernova(scene, c, _s) {
  const g = scene.add.graphics();
  const rays = 12;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const long = i % 2 === 0;
    const r = long ? 70 : 50;
    g.fillStyle(long ? 0xc44b5e : 0xffae8a, long ? 0.7 : 0.85);
    g.beginPath();
    g.moveTo(Math.cos(a - 0.12) * 18, Math.sin(a - 0.12) * 18);
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    g.lineTo(Math.cos(a + 0.12) * 18, Math.sin(a + 0.12) * 18);
    g.closePath();
    g.fillPath();
  }
  // Outer halo
  g.fillStyle(0xff9ec7, 0.45);
  g.fillCircle(0, 0, 36);
  // Coral mid
  g.fillStyle(0xffae8a, 1);
  g.fillCircle(0, 0, 28);
  // Bright butter core
  g.fillStyle(0xffe07a, 1);
  g.fillCircle(0, 0, 20);
  // Hot white center
  g.fillStyle(0xffffff, 1);
  g.fillCircle(0, 0, 11);
  c.add(g);
};

// 9 — Galactic Core: butter gold core with amber spiral arms
NODE_RENDERERS[9] = function drawGalacticCore(scene, c, _s) {
  const g = scene.add.graphics();
  // Soft outer halo
  g.fillStyle(0xffe07a, 0.30);
  g.fillCircle(0, 0, 72);
  g.fillStyle(0xfff3b8, 0.45);
  g.fillCircle(0, 0, 54);
  // Spiral arm rings
  g.lineStyle(5, 0xc88a3a, 0.85);
  g.strokeEllipse(0, 0, 138, 56);
  g.lineStyle(4, 0xffe07a, 0.85);
  g.strokeEllipse(-6, -2, 110, 42);
  g.lineStyle(3, 0xfff3b8, 0.7);
  g.strokeEllipse(4, 4, 86, 30);
  // Core
  g.fillStyle(0xffe07a, 1);
  g.fillCircle(0, 0, 24);
  g.fillStyle(0xfff3b8, 1);
  g.fillCircle(0, 0, 16);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(0, 0, 9);
  // Star sparkles around the core
  g.fillStyle(0xfff3b8, 1);
  g.fillCircle(-50, -10, 2.5);
  g.fillCircle(45, 12, 2.5);
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(-25, -22, 1.5);
  g.fillCircle(28, -28, 1.5);
  g.fillCircle(58, 4, 1.5);
  c.add(g);
};

// 10 — Parallel Dimension: mint teal triple-offset orbs with glitch shimmer
NODE_RENDERERS[10] = function drawParallelDimension(scene, c, _s) {
  const g = scene.add.graphics();
  // Three offset rings — mint, rose, cream
  g.lineStyle(5, 0xa6f0e8, 1);
  g.strokeCircle(0, 0, 50);
  g.lineStyle(4, 0xff9ec7, 0.7);
  g.strokeCircle(-7, -4, 50);
  g.lineStyle(4, 0xfff3b8, 0.7);
  g.strokeCircle(7, 4, 50);
  // Inner sphere
  g.fillStyle(0x55858a, 1);
  g.fillCircle(0, 0, 34);
  g.fillStyle(0xa6f0e8, 0.6);
  g.fillEllipse(-6, -6, 26, 14);
  g.fillStyle(0xfce7ff, 0.45);
  g.fillEllipse(6, 6, 22, 10);
  // Compass-point sparkle stars
  const sparkles = [[40, 0], [-40, 0], [0, 40], [0, -40]];
  for (const [px, py] of sparkles) {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(px, py, 3);
    g.fillStyle(0xff9ec7, 0.8);
    g.fillCircle(px + 3, py + 1, 1.5);
  }
  c.add(g);
};

// 11 — Universe's End: deep violet void with cream constellation + final star
NODE_RENDERERS[11] = function drawUniverseEnd(scene, c, _s) {
  const g = scene.add.graphics();
  // Outer halo of cream light
  g.fillStyle(0xfff3b8, 0.18);
  g.fillCircle(0, 0, 70);
  // Deep violet sphere
  g.fillStyle(0x4a4a8c, 1);
  g.fillCircle(0, 0, 60);
  g.fillStyle(0x6b6bb3, 0.6);
  g.fillCircle(-6, -10, 48);
  // Constellation
  const points = [
    [-25, -20], [10, -28], [28, 10], [4, 22], [-22, 18], [-32, -2]
  ];
  g.lineStyle(2, 0xfff3b8, 0.55);
  g.beginPath();
  g.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
  g.lineTo(points[0][0], points[0][1]);
  g.strokePath();
  g.fillStyle(0xfff3b8, 1);
  for (const [px, py] of points) {
    g.fillCircle(px, py, 3);
  }
  // Big star at the center
  const s = 16;
  g.fillStyle(0xfff3b8, 0.5);
  g.fillCircle(0, 0, s + 4);
  g.fillStyle(0xffffff, 1);
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? s : s * 0.4;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fillPath();
  c.add(g);
};

// ── Chapter 2 "Inner Space" node renderers ────────────────────────────────
NODE_RENDERERS[21] = function drawBloodstream(scene, c, _s) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(0, 54, 140, 22);
  // Two smaller companion cells drifting behind.
  g.fillStyle(0xa02838, 1);
  g.fillEllipse(-44, 22, 44, 30);
  g.fillStyle(0xff7a8a, 0.9);
  g.fillEllipse(-44, 22, 24, 16);
  g.fillStyle(0xa02838, 1);
  g.fillEllipse(46, -20, 40, 28);
  g.fillStyle(0xff7a8a, 0.9);
  g.fillEllipse(46, -20, 22, 14);
  // Main red blood cell — rounded disc, mid tone then bright rim light.
  g.fillStyle(0xc23a4a, 1);
  g.fillEllipse(0, 0, 120, 84);
  g.fillStyle(0xe0586a, 1);
  g.fillEllipse(-6, -8, 100, 64);
  // Paler dimpled center.
  g.fillStyle(0xff7a8a, 1);
  g.fillEllipse(0, 2, 64, 40);
  g.fillStyle(0xffb0bc, 1);
  g.fillEllipse(0, 2, 36, 22);
  // Bright glossy highlight on the upper-left.
  g.fillStyle(0xffffff, 0.7);
  g.fillEllipse(-26, -18, 26, 14);
  // Friendly little face dots so the cell reads as cute.
  g.fillStyle(0xc23a4a, 1);
  g.fillCircle(-12, -2, 4);
  g.fillCircle(12, -2, 4);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(-13, -3, 1.5);
  g.fillCircle(11, -3, 1.5);
  c.add(g);
};

NODE_RENDERERS[22] = function drawCellCity(scene, c, _s) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(0, 56, 140, 24);
  // Cell membrane — round glowing body
  g.fillStyle(0x4ecdc4, 0.30);
  g.fillCircle(0, 0, 64);
  g.fillStyle(0x2f8f86, 1);
  g.fillCircle(0, 0, 56);
  g.fillStyle(0x3faea4, 1);
  g.fillCircle(-4, -6, 48);
  // Organelle "buildings" rising inside
  g.fillStyle(0x176e64, 1);
  g.fillRoundedRect(-34, -8, 20, 44, 6);
  g.fillRoundedRect(-8, -26, 18, 62, 6);
  g.fillRoundedRect(16, -2, 22, 38, 6);
  // Bright front faces
  g.fillStyle(0x4ecdc4, 1);
  g.fillRoundedRect(-32, -6, 16, 12, 4);
  g.fillRoundedRect(-6, -24, 14, 12, 4);
  g.fillRoundedRect(18, 0, 18, 12, 4);
  // Window vesicles
  g.fillStyle(0xbafff6, 0.9);
  g.fillCircle(-24, 16, 3);
  g.fillCircle(1, 4, 3);
  g.fillCircle(27, 18, 3);
  // Nucleus — big round organelle, cute centerpiece
  g.fillStyle(0xbafff6, 1);
  g.fillCircle(8, -8, 14);
  g.fillStyle(0x2f8f86, 1);
  g.fillCircle(8, -8, 7);
  // Membrane highlight glint
  g.fillStyle(0xeafffb, 0.7);
  g.fillEllipse(-22, -28, 22, 12);
  c.add(g);
};

NODE_RENDERERS[23] = function drawNucleusVault(scene, c, _s) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(0, 56, 140, 22);
  // Soft outer membrane halo
  g.fillStyle(0xc77eff, 0.25);
  g.fillCircle(0, 0, 72);
  // Nucleus body — violet sphere with brighter dome
  g.fillStyle(0x6a3fa0, 1);
  g.fillCircle(0, 0, 60);
  g.fillStyle(0x8455c4, 1);
  g.fillCircle(-4, -6, 52);
  g.fillStyle(0xc77eff, 0.6);
  g.fillEllipse(-18, -20, 44, 26);
  // Glowing nucleolus core
  g.fillStyle(0xc77eff, 1);
  g.fillCircle(6, 8, 18);
  g.fillStyle(0xe3bcff, 1);
  g.fillCircle(2, 4, 10);
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(-1, 1, 4);
  // X-shaped chromosome pair, upper left
  g.fillStyle(0xe3bcff, 1);
  g.fillRoundedRect(-34, -34, 7, 26, 3.5);
  g.fillStyle(0xe3bcff, 1);
  g.beginPath();
  g.moveTo(-44, -36);
  g.lineTo(-38, -38);
  g.lineTo(-20, -10);
  g.lineTo(-26, -8);
  g.closePath();
  g.fillPath();
  g.beginPath();
  g.moveTo(-20, -38);
  g.lineTo(-26, -36);
  g.lineTo(-38, -10);
  g.lineTo(-44, -12);
  g.closePath();
  g.fillPath();
  g.fillStyle(0xfce7ff, 0.9);
  g.fillCircle(-32, -24, 4);
  // Small chromosome rod, lower right
  g.fillStyle(0xe3bcff, 1);
  g.fillRoundedRect(26, 18, 7, 24, 3.5);
  g.fillRoundedRect(20, 26, 24, 7, 3.5);
  // DNA thread squiggle drifting across the top
  g.lineStyle(3, 0xfce7ff, 0.9);
  g.beginPath();
  g.moveTo(-18, -46);
  g.lineTo(-6, -52);
  g.lineTo(8, -44);
  g.lineTo(22, -50);
  g.strokePath();
  g.fillStyle(0xfff3b8, 1);
  g.fillCircle(-6, -52, 3);
  g.fillCircle(22, -50, 2.5);
  c.add(g);
};

NODE_RENDERERS[24] = function drawNeuronForest(scene, c, _s) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(0, 56, 140, 22);
  // Soft glow behind the cell
  g.fillStyle(0x7fb8ff, 0.18);
  g.fillCircle(0, 0, 70);
  // Dendrite branches radiating out from the soma (rounded rods)
  const tips = [
    [-58, -34], [-30, -62], [18, -64], [54, -38], [60, 14], [30, 56], [-26, 58], [-60, 20]
  ];
  g.lineStyle(7, 0x2c4a82, 1);
  for (const [tx, ty] of tips) g.lineBetween(0, 0, tx, ty);
  g.lineStyle(4, 0x3a5fa0, 1);
  for (const [tx, ty] of tips) g.lineBetween(0, 0, tx, ty);
  // Cell body (soma)
  g.fillStyle(0x3a5fa0, 1);
  g.fillCircle(0, 0, 40);
  g.fillStyle(0x4f78c0, 1);
  g.fillCircle(-4, -6, 32);
  g.fillStyle(0x7fb8ff, 0.85);
  g.fillEllipse(-12, -14, 22, 14);
  // Nucleus
  g.fillStyle(0x2c4a82, 1);
  g.fillCircle(4, 6, 12);
  g.fillStyle(0xbfe0ff, 0.7);
  g.fillCircle(1, 3, 5);
  // Glowing synapse tips at the ends of the branches
  for (const [tx, ty] of tips) {
    g.fillStyle(0x7fb8ff, 0.4);
    g.fillCircle(tx, ty, 8);
    g.fillStyle(0x7fb8ff, 1);
    g.fillCircle(tx, ty, 4);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(tx - 1, ty - 1, 1.5);
  }
  // Little electric sparks arcing in the gaps
  g.fillStyle(0xeaf4ff, 1);
  g.fillCircle(-40, 30, 2);
  g.fillCircle(38, -24, 2);
  g.fillCircle(20, 40, 1.5);
  c.add(g);
};

NODE_RENDERERS[25] = function drawMarrowCaverns(scene, c, _s) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(0, 56, 140, 24);
  // Warm amber cavern dome — shadow band, mid, bright top.
  g.fillStyle(0x6e4f18, 1);
  g.fillCircle(0, 0, 60);
  g.fillStyle(0xb5863a, 1);
  g.fillCircle(-4, -6, 54);
  g.fillStyle(0xd6a85a, 0.9);
  g.fillEllipse(-18, -22, 46, 30);
  // Hollow cavern mouth opening into the warm marrow.
  g.fillStyle(0x4a3410, 1);
  g.fillEllipse(2, 14, 52, 40);
  g.fillStyle(0x7a5820, 1);
  g.fillEllipse(2, 18, 40, 28);
  // Brand-new cells budding up like glowing bubbles.
  const cells = [[-14, 8, 9], [12, 16, 7], [0, -2, 6], [22, 4, 5]];
  for (const [bx, by, r] of cells) {
    g.fillStyle(0xffcf6b, 0.85);
    g.fillCircle(bx, by, r);
    g.fillStyle(0xffe6ac, 1);
    g.fillCircle(bx - r * 0.3, by - r * 0.3, r * 0.45);
  }
  // Rising spark above the cavern.
  g.fillStyle(0xffcf6b, 0.5);
  g.fillCircle(0, -40, 7);
  g.fillStyle(0xffe6ac, 1);
  g.fillCircle(0, -40, 4);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(-1, -42, 1.5);
  c.add(g);
};

NODE_RENDERERS[26] = function drawImmuneFront(scene, c, _s) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(0, 56, 140, 24);
  // Big friendly white blood cell — lumpy pale-green sphere.
  g.fillStyle(0x6fae4a, 1);
  g.fillCircle(0, 0, 60);
  // Lumpy bumps around the rim
  g.fillCircle(-46, 16, 22);
  g.fillCircle(44, 10, 24);
  g.fillCircle(-18, -48, 20);
  g.fillCircle(28, 46, 18);
  // Bright top body
  g.fillStyle(0x9be86b, 1);
  g.fillCircle(-4, -6, 50);
  // Soft inner glow / nucleus pool
  g.fillStyle(0xc7f5a8, 0.85);
  g.fillEllipse(-18, -20, 44, 30);
  // Friendly face
  g.fillStyle(0x2a5418, 1);
  g.fillCircle(-16, -2, 6);
  g.fillCircle(16, -2, 6);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(-14, -4, 2);
  g.fillCircle(18, -4, 2);
  // Happy smile
  g.lineStyle(4, 0x2a5418, 1);
  g.beginPath();
  g.arc(0, 8, 18, 0.15 * Math.PI, 0.85 * Math.PI);
  g.strokePath();
  // Two little Y-shaped antibody defenders patrolling nearby.
  g.lineStyle(4, 0x9be86b, 1);
  // Left antibody
  g.lineBetween(-66, -34, -66, -16);
  g.lineBetween(-66, -34, -76, -46);
  g.lineBetween(-66, -34, -56, -46);
  // Right antibody
  g.lineBetween(64, -30, 64, -12);
  g.lineBetween(64, -30, 54, -42);
  g.lineBetween(64, -30, 74, -42);
  g.fillStyle(0xc7f5a8, 1);
  g.fillCircle(-66, -16, 3);
  g.fillCircle(64, -12, 3);
  c.add(g);
};

NODE_RENDERERS[27] = function drawMitochondriaCore(scene, c, _s) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(0, 52, 140, 24);
  // Soft warm outer glow.
  g.fillStyle(0xff9b4a, 0.28);
  g.fillEllipse(0, 0, 156, 116);
  // Bean-shaped outer membrane.
  g.fillStyle(0xc4622a, 1);
  g.fillEllipse(0, 0, 130, 88);
  g.fillStyle(0xa84e1e, 1);
  g.fillEllipse(8, 10, 110, 64);
  // Bright inner matrix.
  g.fillStyle(0xff9b4a, 1);
  g.fillEllipse(-4, -4, 104, 64);
  g.fillStyle(0xffc77a, 1);
  g.fillEllipse(-12, -12, 60, 32);
  // Glowing cristae folds (rounded inner rods).
  g.fillStyle(0xc4622a, 0.95);
  for (let i = -2; i <= 2; i++) {
    g.fillRoundedRect(i * 20 - 6, -26, 12, 52, 6);
  }
  // Hot cristae highlights.
  g.fillStyle(0xffe0b0, 0.9);
  for (let i = -2; i <= 2; i++) {
    g.fillRoundedRect(i * 20 - 4, -24, 4, 48, 2);
  }
  // Pulsing energy sparks.
  g.fillStyle(0xffe07a, 1);
  g.fillCircle(-40, -28, 3);
  g.fillCircle(44, 22, 3);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(-40, -28, 1.5);
  g.fillCircle(44, 22, 1.5);
  g.fillCircle(0, -34, 2);
  c.add(g);
};

NODE_RENDERERS[28] = function drawTheSingularityCell(scene, c, _s) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(0, 56, 130, 22);
  // Soft outer glow of golden light
  g.fillStyle(0xfff3b8, 0.18);
  g.fillCircle(0, 0, 78);
  g.fillStyle(0xfff3b8, 0.30);
  g.fillCircle(0, 0, 60);
  // Ring of soft light around the cell
  g.lineStyle(5, 0xfff3b8, 0.85);
  g.strokeCircle(0, 0, 64);
  g.lineStyle(2, 0xffffff, 0.6);
  g.strokeCircle(0, 0, 70);
  // Luminous cell body — periwinkle membrane fading to gold-white core
  g.fillStyle(0x6a6ab0, 1);
  g.fillCircle(0, 0, 52);
  g.fillStyle(0x9a9ad8, 1);
  g.fillCircle(-3, -4, 44);
  g.fillStyle(0xfff3b8, 1);
  g.fillCircle(-2, -3, 30);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(-6, -8, 16);
  // Tiny nucleus motes orbiting inside
  g.fillStyle(0xfff3b8, 0.9);
  g.fillCircle(22, 16, 5);
  g.fillCircle(-20, 22, 4);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(22, 15, 2);
  // Sparkle motes around the halo
  g.fillStyle(0xfff3b8, 1);
  g.fillCircle(-52, -16, 2.5);
  g.fillCircle(50, 10, 2.5);
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(-30, -40, 1.5);
  g.fillCircle(34, -32, 1.5);
  c.add(g);
};

// ── Chapter 3 "Home Ground" node renderers ────────────────────────────────
// Eight places on one family Saturday, in the Paper Cutout style. The icons
// are drawn by the world modules in src/homeGround; plain shapes only (no
// spirals/sunbursts).
for (const id of Object.keys(HOME_GROUND_WORLDS)) {
  const world = HOME_GROUND_WORLDS[id];
  NODE_RENDERERS[id] = (scene, c, s) => world.drawNode(scene, c, s);
}
