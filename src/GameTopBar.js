// Game-screen top bar: world name, mode label, streak/score/time stats,
// HP hearts, and the time-bar at the bottom. Mutates the scene to expose
// the references the rest of GameScene needs (streakHUD, scoreText, etc.).

import { createIconButton } from './buttonHelper.js';
import { style } from './textStyles.js';
import {
  drawFlameIcon, drawStarIcon, drawHourglassIcon,
  drawHeartIcon, drawSkullIcon, drawArrowLeftIcon, drawPauseIcon
} from './StatIcons.js';
import { COLORS } from './colorPalette.js';
import { createStreakHUD } from './StreakHUD.js';

const W = 1080;
const SHIP_HP_MAX = 5;

export function createTopBar(scene, topBarH) {
  const bg = scene.add.graphics().setDepth(4);
  bg.fillStyle(COLORS.bgDark, 0.92);
  bg.fillRect(0, 0, W, topBarH);

  // Back button
  createIconButton(scene, {
    x: 80, y: 70, radius: 36,
    accentColor: scene.world.accentColor,
    drawIcon: (g, size) => drawArrowLeftIcon(g, 0, 0, size),
    onClick: () => scene.exitToLevelSelect()
  }).setDepth(15);

  // World name + mode in upper-right area
  const titleX = W / 2;
  scene.add.text(titleX, 50, scene.world.name, style('subhead', {
    fontSize: '36px',
    fill: '#' + scene.world.accentColor.toString(16).padStart(6, '0')
  })).setOrigin(0.5).setDepth(15);

  const modeRow = scene.add.container(titleX, 100).setDepth(15);
  const modeText = scene.add.text(0, 0, scene.modeConfig.label.toUpperCase(), style('caption', {
    fontSize: '36px',
    fill: '#cfcfe0',
    fontStyle: '900'
  })).setOrigin(0.5);
  if (scene.isBoss) {
    // The skull sits just left of the villain name, placed from its width so
    // a long name never runs over it. The pair stays centered as a group.
    const skullW = 26;
    const skullGap = 14;
    modeText.x = (skullW + skullGap) / 2;
    const skullG = scene.add.graphics();
    drawSkullIcon(skullG, modeText.x - modeText.width / 2 - skullGap - skullW / 2, 0, 16);
    modeRow.add(skullG);
  }
  modeRow.add(modeText);

  // Pause (top-right) — opens a modal with Resume / Sound / Music / Quit.
  createIconButton(scene, {
    x: W - 80, y: 70, radius: 36,
    accentColor: scene.world.accentColor,
    drawIcon: (g, size) => drawPauseIcon(g, 0, 0, size),
    onClick: () => scene.openPauseMenu?.()
  }).setDepth(15);

  // Row 1: STREAK / SCORE / TIME with pixel icons. The labels sit on their
  // own line under the digits (labelY), with the hearts a row lower, so the
  // 36px labels clear both.
  const row1Y = 158;
  const labelY = row1Y + 62;
  scene.streakIcon = scene.add.graphics().setDepth(10);
  drawFlameIcon(scene.streakIcon, 0, 0, 18);
  scene.streakIcon.x = W * 0.18 - 60;
  scene.streakIcon.y = row1Y;
  scene.streakHUD = createStreakHUD(scene, {
    x: W * 0.18, y: row1Y, depth: 10,
    textStyle: { fontSize: '52px', fill: '#ff8b3d' },
  });
  scene.add.text(W * 0.18 - 60, labelY, 'STREAK', style('caption', {
    fontSize: '36px',
    fontStyle: '900'
  })).setOrigin(0, 0.5).setDepth(10);

  // Score is hidden during gameplay; the scene fades scoreGroup back in at
  // the summary so the kid sees the digit ticking up at the end of a round.
  scene.scoreIcon = scene.add.graphics().setDepth(10);
  drawStarIcon(scene.scoreIcon, 0, 0, 18);
  scene.scoreIcon.x = W * 0.50 - 60;
  scene.scoreIcon.y = row1Y;
  scene.scoreText = scene.add.text(W * 0.50, row1Y, '0', style('display', {
    fontSize: '52px',
    fill: '#ffffff'
  })).setOrigin(0, 0.5).setDepth(10);
  const scoreLabel = scene.add.text(W * 0.50 - 60, labelY, 'SCORE', style('caption', {
    fontSize: '36px',
    fontStyle: '900'
  })).setOrigin(0, 0.5).setDepth(10);
  scene.scoreGroup = [scene.scoreIcon, scene.scoreText, scoreLabel];
  scene.scoreGroup.forEach(o => o.setAlpha(0));

  scene.timeIcon = scene.add.graphics().setDepth(10);
  drawHourglassIcon(scene.timeIcon, 0, 0, 16);
  scene.timeIcon.x = W * 0.78 - 60;
  scene.timeIcon.y = row1Y;
  scene.timeText = scene.add.text(W * 0.78, row1Y, scene.formatTime(scene.timeLeft), style('display', {
    fontSize: '52px',
    fill: '#' + scene.world.accentColor.toString(16).padStart(6, '0')
  })).setOrigin(0, 0.5).setDepth(10);
  scene.add.text(W * 0.78 - 60, labelY, 'TIME', style('caption', {
    fontSize: '36px',
    fontStyle: '900'
  })).setOrigin(0, 0.5).setDepth(10);

  // Row 2: HP hearts (5), below the stat labels and above the time bar.
  const row2Y = 274;
  const hpStartX = W / 2 - 4 * 60;
  scene.hpIcons = [];
  for (let i = 0; i < SHIP_HP_MAX; i++) {
    const ix = hpStartX + i * 120;
    const c = scene.add.container(ix, row2Y).setDepth(20);
    const heart = scene.add.graphics();
    drawHeartIcon(heart, 0, 0, 28, true);
    c.add(heart);
    c.fullColor = true;
    c.heart = heart;
    scene.hpIcons.push(c);
  }

  // Time bar at very bottom of the top bar
  scene.timeBarBg = scene.add.graphics().setDepth(5);
  scene.timeBarBg.fillStyle(COLORS.bgTrack, 0.85);
  scene.timeBarBg.fillRect(0, topBarH - 12, W, 12);
  scene.timeBar = scene.add.graphics().setDepth(6);
  drawTimeBar(scene, topBarH, 1);
}

export function drawTimeBar(scene, topBarH, pct) {
  const fillW = Math.max(0, Math.floor(W * pct));
  const color = pct > 0.4 ? scene.world.accentColor : pct > 0.2 ? COLORS.warning : COLORS.error;
  if (fillW === scene._lastTimeBarW && color === scene._lastTimeBarColor) return;
  scene._lastTimeBarW = fillW;
  scene._lastTimeBarColor = color;
  scene.timeBar.clear();
  scene.timeBar.fillStyle(color, 1);
  scene.timeBar.fillRect(0, topBarH - 12, fillW, 12);
}
