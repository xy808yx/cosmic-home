// Arcade run results — shared end screen for the arcade modes that run on the
// real GameScene engine (Endless, Boss Rush). GameScene short-circuits its
// campaign endRound/failLevel into here when this.arcadeMode is set, so none of
// the campaign progression (stars, stardust, evolution) runs for arcade play.
//
// Retry restarts the launcher scene (fresh gauntlet / fresh run); Done returns
// to the arcade hub.

import { progress } from './GameData.js';
import { style, TYPE } from './textStyles.js';
import { COLORS } from './colorPalette.js';
import { createButton } from './buttonHelper.js';
import { TransitionManager } from './TransitionManager.js';

const W = 1080;
const H = 1920;

export function showArcadeResults(scene, opts) {
  const { mode } = opts;

  let title, accent, lines, launcherKey;
  let doneScene = 'ArcadeMenuScene';
  let wasBest = false;

  if (mode === 'bossRush') {
    const { won, correct, attempts, timeMs } = opts;
    wasBest = progress.recordBossRushResult({ won, timeMs, correct, total: attempts });
    title = won ? 'GAUNTLET CLEARED' : 'OVERWHELMED';
    accent = won ? 0xfbbf24 : 0xc44b5e;
    const acc = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
    lines = [`Accuracy: ${acc}%`, `Time: ${(timeMs / 1000).toFixed(1)}s`];
    launcherKey = 'BossRushScene';
  } else if (mode === 'review') {
    // Tune-Up: spaced-repetition refresh. No best/score tracking — the reward is
    // the rusty-fact count dropping as freshly-answered facts get their review
    // dates pushed back out. Done returns to the map (not the arcade hub).
    const { score } = opts;
    const rustyLeft = progress.getRustyFactCount();
    title = 'TUNE-UP DONE!';
    accent = 0xfbbf24;
    lines = [
      `Facts refreshed: ${score}`,
      rustyLeft > 0 ? `${rustyLeft} still need a tune-up` : 'All facts fresh. Nice!'
    ];
    launcherKey = 'ReviewScene';
    doneScene = 'WorldMapScene';
  } else {
    // Endless ends only on ship death — score is how many you crunched.
    const { score } = opts;
    wasBest = progress.recordEndlessScore(score);
    title = 'GOOD RUN!';
    accent = 0x4ecdc4;
    lines = [`Score: ${score}`, `Best: ${progress.arcade?.endlessBest || 0}`];
    launcherKey = 'EndlessScene';
  }

  const overlay = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(70).setInteractive();
  scene.tweens.add({ targets: overlay, fillAlpha: 0.78, duration: 320 });

  // Sized for the 64px title and 52/42px stat lines (the longest title,
  // GAUNTLET CLEARED, is about 670px wide at 64).
  const panelW = 860;
  const panelH = 620;
  const panel = scene.add.container(W / 2, H + panelH / 2).setDepth(71);

  const bg = scene.add.graphics();
  bg.fillStyle(COLORS.bgPanel, 0.98);
  bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 28);
  bg.lineStyle(4, accent, 0.95);
  bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 28);
  panel.add(bg);

  panel.add(scene.add.text(0, -panelH / 2 + 90, title, style('display', {
    fontSize: `${TYPE.title}px`,
    fill: '#' + accent.toString(16).padStart(6, '0')
  })).setOrigin(0.5));

  // The headline stat on the heading tier, the second line as body text.
  lines.forEach((t, i) => {
    panel.add(scene.add.text(0, -panelH / 2 + 200 + i * 80, t, style('subhead', {
      fontSize: `${i === 0 ? TYPE.heading : TYPE.body}px`,
      fill: i === 0 ? '#ffffff' : '#cfcfe0'
    })).setOrigin(0.5));
  });

  if (wasBest) {
    panel.add(scene.add.text(0, -panelH / 2 + 370, 'NEW BEST!', style('subhead', {
      fontSize: `${TYPE.body}px`,
      fill: '#fbbf24'
    })).setOrigin(0.5));
  }

  // Two 270-wide buttons with a 40px gap between them, so a kid's thumb
  // lands on the one it meant.
  const btnY = panelH / 2 - 95;
  panel.add(createButton(scene, {
    x: -155, y: btnY, label: 'Retry',
    width: 270, height: 88,
    color: 0x4a4a6a,
    onClick: () => scene.scene.start(launcherKey)
  }));
  panel.add(createButton(scene, {
    x: 155, y: btnY, label: 'Done',
    width: 270, height: 88,
    color: accent,
    onClick: () => new TransitionManager(scene).fadeToScene(doneScene)
  }));

  scene.tweens.add({ targets: panel, y: H / 2, duration: 480, ease: 'Back.easeOut' });
}
