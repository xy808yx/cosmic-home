// Mastery Wall: the Chapter 3 "Home Ground" garden.
//
// The runner-up "Grid Gardens" mode contributed exactly one asset to the build:
// a persistent, at-a-glance display of which multiplication facts the kid has
// made AUTOMATIC. Here it's re-themed as a warm 12×12 garden of blooms. It reads
// the SAME per-fact status the parent dashboard grid does (progress.getFactStatus)
// plus the spaced-repetition rust signal (progress.getRustyFacts), so it never
// invents its own pedagogy:
//   • automatic  → a bright open BLOOM (gold)        means fast + accurate
//   • slow       → a green SPROUT (two leaves)       means accurate but not yet fast
//   • inaccurate → a small BUD (amber / red)         means still being learned
//   • unseen     → bare SOIL                         means not planted yet
//   • rusty      → a wilted, dimmed bloom            means automatic but overdue for review
//
// Non-interactive. Plain shapes only (4 cardinal petals, no radial mandala /
// spiral / sunburst), per the project content rule. Returns a Container centred
// on (x, y); the caller positions and depths it.

import { progress } from './GameData.js';
import { style } from './textStyles.js';

const BLOOM  = 0xffd166;  // automatic
const SPROUT = 0x6fbf4a;  // accurate but slow
const BUD    = 0xffb142;  // inaccurate, ≥50%
const WILT   = 0xff6b6b;  // inaccurate, <50%
const SOIL   = 0x2a2238;  // unseen
const PETAL_DIM = 0x8a7a52; // rusty bloom desaturated cast

function factKey(a, b) {
  return `${Math.min(a, b)}x${Math.max(a, b)}`;
}

// Draw one garden tile centred at (cx, cy) inside graphics `g`.
// `kind` ∈ unseen|slow|inaccurate|automatic; `poor` only matters for inaccurate;
// `rusty` only matters for automatic.
function drawTile(g, cx, cy, cell, kind, poor, rusty) {
  const r = cell / 2 - 3;
  // Soil bed.
  g.fillStyle(0x000000, 0.25);
  g.fillRoundedRect(cx - r, cy - r + 3, r * 2, r * 2, 8);
  g.fillStyle(SOIL, 1);
  g.fillRoundedRect(cx - r, cy - r, r * 2, r * 2, 8);

  if (kind === 'unseen') {
    // A single faint seed dot.
    g.fillStyle(0x4a4060, 1);
    g.fillCircle(cx, cy, 3);
    return;
  }

  if (kind === 'slow') {
    // Sprout: two leaves + a stem.
    g.lineStyle(3, 0x3a7a3a, 1);
    g.lineBetween(cx, cy + r * 0.5, cx, cy - r * 0.2);
    g.fillStyle(SPROUT, 1);
    g.fillEllipse(cx - r * 0.32, cy - r * 0.1, r * 0.7, r * 0.4);
    g.fillEllipse(cx + r * 0.32, cy - r * 0.25, r * 0.66, r * 0.38);
    return;
  }

  if (kind === 'inaccurate') {
    // A small closed bud, colour-graded by how far off it is.
    g.fillStyle(0x3a7a3a, 1);
    g.fillRect(cx - 2, cy - 2, 4, r * 0.7);
    g.fillStyle(poor ? WILT : BUD, 1);
    g.fillCircle(cx, cy - r * 0.18, r * 0.42);
    return;
  }

  // automatic → an open bloom (centre + four cardinal petals).
  const petal = rusty ? PETAL_DIM : BLOOM;
  const a = rusty ? 0.5 : 1;
  const pr = r * 0.5;
  g.fillStyle(petal, a);
  g.fillEllipse(cx, cy - pr * 0.9, pr, pr * 1.3);
  g.fillEllipse(cx, cy + pr * 0.9, pr, pr * 1.3);
  g.fillEllipse(cx - pr * 0.9, cy, pr * 1.3, pr);
  g.fillEllipse(cx + pr * 0.9, cy, pr * 1.3, pr);
  g.fillStyle(rusty ? 0x6a5a3a : 0xfff0c2, a);
  g.fillCircle(cx, cy, pr * 0.7);
  if (rusty) {
    // A faint "needs water" mark so a wilted bloom reads as tend-me, not broken.
    g.fillStyle(0x6fc2e0, 0.6);
    g.fillCircle(cx + r * 0.55, cy - r * 0.55, 3);
  }
}

// Per-fact status + an accuracy band flag for inaccurate tiles.
function tileStatus(a, b) {
  const kind = progress.getFactStatus(a, b);
  return { kind, poor: kind === 'inaccurate' && progress.getFactMastery(a, b) < 50 };
}

export function drawMasteryWall(scene, x, y, opts = {}) {
  // Callers may still pass the old 46px cell. 52 is the smallest cell that
  // holds a readable "12" axis number, so a smaller request is lifted to it.
  const cell = Math.max(opts.cell ?? 52, 52);
  const title = opts.title ?? 'Mastery Garden';
  const accent = opts.accent ?? 0xffd27a;

  const gridW = 12 * cell;
  const padX = 64;           // room for the row numbers left of the grid
  const panelW = gridW + padX * 2 + 28;
  const textW = panelW - 48; // widest a header line may run inside the border

  const cont = scene.add.container(x, y);

  // Panel. Added first so it sits under everything; drawn once the measured
  // text below has set the panel height.
  const bg = scene.add.graphics();
  cont.add(bg);

  // Count automatic / rusty for the subtitle.
  const rustyList = progress.getRustyFacts();
  const rustySet = new Set(rustyList.map(f => factKey(f.a, f.b)));
  const stats = progress.getAutomaticityStats();

  const titleText = scene.add.text(0, 0, title, style('display', {
    fill: '#ffe6b0'
  })).setOrigin(0.5, 0);
  const sub = stats.attempted === 0
    ? 'Plant your first bloom. Keep playing!'
    : `${stats.automatic} ${stats.automatic === 1 ? 'bloom' : 'blooms'} open`
      + (rustySet.size ? `  ·  ${rustySet.size} ${rustySet.size === 1 ? 'needs' : 'need'} water` : '');
  const subText = scene.add.text(0, 0, sub, style('body', {
    fill: '#cfcfe0', align: 'center'
  })).setOrigin(0.5, 0);
  if (subText.width > textW) {
    // Too wide for one line: break between its two parts, never mid-phrase,
    // then wrap as a last resort.
    subText.setText(sub.replace(/\.\s+/, '.\n').replace(/\s+·\s+/, '\n'));
    subText.setWordWrapWidth(textW);
  }
  cont.add([titleText, subText]);

  // Column + row numbers: the grid's axis, lettered at 32px (art) like the
  // fact grids elsewhere, in the readable gray.
  const axisStyle = style('caption', { fontSize: '32px', fill: '#cfcfe0', art: true });
  const colNums = [];
  const rowNums = [];
  for (let i = 1; i <= 12; i++) {
    colNums.push(scene.add.text(0, 0, i.toString(), axisStyle).setOrigin(0.5));
    rowNums.push(scene.add.text(0, 0, i.toString(), axisStyle).setOrigin(0.5));
  }
  cont.add(colNums);
  cont.add(rowNums);

  // Legend labels, measured so the 2x2 legend can be sized to them. Each key
  // is the tile it names (kind, rusty), so the bloom and the bud read apart by
  // shape on a phone, not only by their close gold and orange.
  const items = [
    ['automatic', false, 'Automatic'],
    ['slow', false, 'Almost'],
    ['inaccurate', false, 'Learning'],
    ['automatic', true, 'Needs water']
  ];
  const legendTexts = items.map(([, , label]) => scene.add.text(0, 0, label, style('caption', {
    fill: '#cfcfe0'
  })).setOrigin(0, 0.5));
  cont.add(legendTexts);

  // Vertical rhythm, all from the measured text heights. The subtitle hugs the
  // title; a wider gap under it keeps it from reading as part of the axis row.
  const padTop = 30;
  const axisH = colNums[0].height;
  const titleY = padTop;
  const subY = titleY + titleText.height + 6;
  const headTop = subY + subText.height + 24 + axisH + 4; // top of the grid
  const legendPitch = Math.max(...legendTexts.map(t => t.height)) + 14;
  const legendTop = headTop + gridW + 28;
  const panelH = legendTop + legendPitch * 2 + 24;

  bg.fillStyle(0x000000, 0.45);
  bg.fillRoundedRect(-panelW / 2 + 4, -panelH / 2 + 6, panelW, panelH, 26);
  bg.fillStyle(0x1d1830, 0.98);
  bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 26);
  bg.lineStyle(3, accent, 0.85);
  bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 26);

  titleText.setY(-panelH / 2 + titleY);
  subText.setY(-panelH / 2 + subY);

  // Grid origin (top-left of the first cell centre row/col).
  const gridLeft = -gridW / 2;
  const gridTop = -panelH / 2 + headTop;

  // Column numbers sit just above the grid; row numbers centre in the left gutter.
  const rowNumX = gridLeft - (padX + 14) / 2 + 4;
  for (let i = 1; i <= 12; i++) {
    colNums[i - 1].setPosition(gridLeft + (i - 0.5) * cell, gridTop - 4 - axisH / 2);
    rowNums[i - 1].setPosition(rowNumX, gridTop + (i - 0.5) * cell);
  }

  // The garden itself.
  const g = scene.add.graphics();
  for (let row = 1; row <= 12; row++) {
    for (let col = 1; col <= 12; col++) {
      const st = tileStatus(row, col);
      const cx = gridLeft + (col - 0.5) * cell;
      const cy = gridTop + (row - 0.5) * cell;
      const rusty = st.kind === 'automatic' && rustySet.has(factKey(row, col));
      drawTile(g, cx, cy, cell, st.kind, st.poor, rusty);
    }
  }
  cont.add(g);

  // Legend: two rows of two, read left to right. Each column is as wide as its
  // longest label, and the pair is centred under the grid.
  const keyCell = 46;              // key tile size, a touch smaller than the legend row
  const keyGap = 14;               // key tile edge to label
  const colGap = 64;               // between the two legend columns
  const colWidth = c => keyCell + keyGap + Math.max(legendTexts[c].width, legendTexts[c + 2].width);
  const colX = [0, colWidth(0) + colGap];
  const legendLeft = -(colX[1] + colWidth(1)) / 2;
  const keys = scene.add.graphics(); // one batched draw for all four key tiles
  cont.addAt(keys, cont.getIndex(legendTexts[0]));
  items.forEach(([kind, rusty], i) => {
    const lx = legendLeft + colX[i % 2];
    const ly = -panelH / 2 + legendTop + legendPitch * (Math.floor(i / 2) + 0.5);
    drawTile(keys, lx + keyCell / 2, ly, keyCell, kind, false, rusty);
    legendTexts[i].setPosition(lx + keyCell + keyGap, ly);
  });

  cont.panelW = panelW;
  cont.panelH = panelH;
  return cont;
}
