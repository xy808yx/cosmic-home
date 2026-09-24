// Per-world boss mechanic twists. Each entry registers callbacks that
// GameScene fires at well-defined points during a boss fight. Twists are
// visual/UX flavor — they should NOT meaningfully change difficulty.
//
// Hooks (all optional, called with scene + relevant args):
//   init(scene)                  — when boss mode starts
//   onSpawn(scene, asteroid)     — each problem spawn (boss reuses container)
//   onCorrect(scene, asteroid)   — player answered correctly
//   onWrong(scene, asteroid, btn)— player answered wrong (ship took damage)
//
// State held on `scene.bossTwistState` (created lazily here).
//
// Cap: each callback should be cheap. They run inside the GameScene tick.

import { audio } from './AudioManager.js';
import { style } from './textStyles.js';

export function applyBossTwist(scene, worldId) {
  scene.bossTwistState = scene.bossTwistState || {};
  const twist = BOSS_TWISTS[worldId];
  if (twist?.init) twist.init(scene);
}

export function bossTwistOn(scene, hookName, ...args) {
  const worldId = scene.world?.id;
  if (!worldId) return;
  const twist = BOSS_TWISTS[worldId];
  if (twist?.[hookName]) twist[hookName](scene, ...args);
}

const BOSS_TWISTS = {

  // 1 — Cratershade: every 3rd problem the boss "burrows" mid-fall (briefly
  //     fades), making players read the math in a wobble.
  1: {
    init(scene) {
      scene.bossTwistState.spawnCount = 0;
    },
    onSpawn(scene, asteroid) {
      scene.bossTwistState.spawnCount = (scene.bossTwistState.spawnCount || 0) + 1;
      if (scene.bossTwistState.spawnCount % 3 !== 0) return;
      if (!asteroid?.container?.active) return;
      // Fade out and back in once
      scene.time.delayedCall(700, () => {
        if (!asteroid.container?.active) return;
        scene.tweens.add({
          targets: asteroid.container, alpha: 0.15,
          duration: 600, yoyo: true, ease: 'Sine.easeInOut'
        });
      });
    }
  },

  // 2 — Boulderlord: wrong answer triggers a screen-edge shockwave —
  //     small camera shake + a red vignette pulse.
  2: {
    onWrong(scene) {
      scene.cameras.main.shake(180, 0.006);
      const W = scene.cameras.main.width;
      const H = scene.cameras.main.height;
      const vignette = scene.add.graphics().setDepth(50);
      vignette.fillStyle(0xff3b3b, 0.35);
      vignette.fillRect(0, 0, W, H);
      scene.tweens.add({
        targets: vignette, alpha: 0,
        duration: 400, ease: 'Quad.easeOut',
        onComplete: () => vignette.destroy()
      });
    }
  },

  // 3 — Shardmaw: wrong answer briefly mirrors the MC layout for the next
  //     problem (visual flip; values are unchanged).
  3: {
    init(scene) {
      scene.bossTwistState.mirrorNext = false;
    },
    onWrong(scene) {
      scene.bossTwistState.mirrorNext = true;
    },
    onSpawn(scene) {
      if (!scene.bossTwistState.mirrorNext) return;
      scene.bossTwistState.mirrorNext = false;
      const flip = (btn) => {
        if (!btn?.active) return;
        scene.tweens.add({
          targets: btn, scaleX: -1,
          duration: 350, yoyo: true, ease: 'Sine.easeInOut'
        });
      };
      (scene.mcButtons || []).forEach(flip);
    }
  },

  // 4 — Mistshroud: every 2 wrong answers, briefly grow a vine over a random
  //     MC button (visual only — button stays tappable).
  4: {
    init(scene) {
      scene.bossTwistState.wrongCount = 0;
    },
    onWrong(scene) {
      scene.bossTwistState.wrongCount = (scene.bossTwistState.wrongCount || 0) + 1;
      if (scene.bossTwistState.wrongCount % 2 !== 0) return;
      const btns = scene.mcButtons || [];
      if (!btns.length) return;
      const btn = btns[Math.floor(Math.random() * btns.length)];
      if (!btn?.active) return;
      const vine = scene.add.graphics();
      vine.lineStyle(6, 0x4f956b, 0.85);
      vine.beginPath();
      vine.moveTo(-40, 30);
      vine.lineTo(0, 0);
      vine.lineTo(30, -20);
      vine.strokePath();
      vine.fillStyle(0xff9ec7, 0.95);
      vine.fillCircle(30, -20, 6);
      btn.add(vine);
      scene.tweens.add({
        targets: vine, alpha: 0,
        duration: 1500, ease: 'Quad.easeIn',
        onComplete: () => vine.destroy()
      });
    }
  },

  // 5 — Coregrinder: cosmetic "speed surge" on correct — a brief horizontal
  //     speed-line streak across the boss.
  5: {
    onCorrect(scene, asteroid) {
      if (!asteroid?.container?.active) return;
      const lines = scene.add.graphics();
      lines.lineStyle(3, 0xfff3b8, 0.85);
      for (let i = -2; i <= 2; i++) {
        const y = i * 18;
        lines.lineBetween(-180, y, 180, y);
      }
      asteroid.container.add(lines);
      scene.tweens.add({
        targets: lines, alpha: 0,
        duration: 300, ease: 'Quad.easeOut',
        onComplete: () => lines.destroy()
      });
    }
  },

  // 6 — Eventhorror: subtle "gravity tug" — the boss faintly trembles between
  //     spawns, hinting at gravitational pull.
  6: {
    init(scene) {
      // schedule tremor every 2.5s
      const tremor = () => {
        if (scene.state === 'ended' || scene.state === 'failed') return;
        scene.cameras.main.shake(120, 0.0025);
        scene.time.delayedCall(2500, tremor);
      };
      scene.time.delayedCall(2500, tremor);
    }
  },

  // 7 — Frostfang: every 4th problem, briefly frost-over one MC button (visual
  //     overlay; still tappable).
  7: {
    init(scene) {
      scene.bossTwistState.problemCount = 0;
    },
    onSpawn(scene) {
      scene.bossTwistState.problemCount = (scene.bossTwistState.problemCount || 0) + 1;
      if (scene.bossTwistState.problemCount % 4 !== 0) return;
      const btns = scene.mcButtons || [];
      if (!btns.length) return;
      const btn = btns[Math.floor(Math.random() * btns.length)];
      if (!btn?.active) return;
      const frost = scene.add.graphics();
      frost.fillStyle(0xb6e0ff, 0.65);
      const w = btn.dimensions?.w || 320;
      const h = btn.dimensions?.h || 150;
      frost.fillRoundedRect(-w / 2, -h / 2, w, h, 26);
      // Crystal flecks
      frost.fillStyle(0xffffff, 0.85);
      for (let i = 0; i < 6; i++) {
        const fx = (Math.random() - 0.5) * w * 0.8;
        const fy = (Math.random() - 0.5) * h * 0.8;
        frost.fillCircle(fx, fy, 3);
      }
      btn.add(frost);
      scene.tweens.add({
        targets: frost, alpha: 0,
        duration: 1500, ease: 'Quad.easeIn',
        onComplete: () => frost.destroy()
      });
    }
  },

  // 8 — Pyrewraith: subtle flame embers above the boss area — pure flavor.
  8: {
    init(scene) {
      const tick = () => {
        if (scene.state === 'ended' || scene.state === 'failed') return;
        if (scene.bossContainer?.active) {
          const e = scene.add.circle(
            scene.bossContainer.x + (Math.random() - 0.5) * 200,
            scene.bossContainer.y - 220,
            3, 0xffae8a, 1
          ).setDepth(8);
          scene.tweens.add({
            targets: e, y: '-=80', alpha: 0,
            duration: 1400, ease: 'Sine.easeOut',
            onComplete: () => e.destroy()
          });
        }
        scene.time.delayedCall(450, tick);
      };
      scene.time.delayedCall(800, tick);
    }
  },

  // 9 — Corecrusher: wrong answers heal the boss by 1 HP, capped at +3 total.
  9: {
    init(scene) {
      scene.bossTwistState.healUsed = 0;
    },
    onWrong(scene) {
      const used = scene.bossTwistState.healUsed || 0;
      if (used >= 3) return;
      scene.bossTwistState.healUsed = used + 1;
      scene.bossHp = Math.min(scene.bossMaxHp || scene.bossHp || 0, (scene.bossHp || 0) + 1);
      if (scene.drawBossHp) scene.drawBossHp();
      // Gold flash
      if (scene.bossContainer?.active) {
        const flash = scene.add.circle(0, 0, 200, 0xffe07a, 0.4).setDepth(8);
        scene.bossContainer.add(flash);
        scene.tweens.add({
          targets: flash, alpha: 0, scale: 1.4,
          duration: 500, ease: 'Sine.easeOut',
          onComplete: () => flash.destroy()
        });
      }
    }
  },

  // 10 — Mirrorshade: every other problem, briefly sends ghost outlines across
  //     two MC buttons without moving the real hit areas.
  10: {
    init(scene) {
      scene.bossTwistState.problemCount = 0;
    },
    onSpawn(scene) {
      scene.bossTwistState.problemCount = (scene.bossTwistState.problemCount || 0) + 1;
      if (scene.bossTwistState.problemCount % 2 !== 0) return;
      const btns = scene.mcButtons || [];
      if (btns.length < 2) return;
      const a = btns[0]; const b = btns[1];
      if (!a?.active || !b?.active) return;
      const drawGhost = (from, to) => {
        const { w = 320, h = 150 } = from.dimensions || {};
        const ghost = scene.add.graphics().setDepth((from.depth || 10) + 1);
        ghost.x = from.x;
        ghost.y = from.y;
        ghost.fillStyle(0xa6f0e8, 0.16);
        ghost.fillRoundedRect(-w / 2, -h / 2, w, h - 6, 26);
        ghost.lineStyle(4, 0xa6f0e8, 0.65);
        ghost.strokeRoundedRect(-w / 2, -h / 2, w, h - 6, 26);
        scene.tweens.add({
          targets: ghost,
          x: to.x,
          alpha: 0,
          duration: 420,
          ease: 'Sine.easeInOut',
          onComplete: () => ghost.destroy()
        });
      };
      drawGhost(a, b);
      drawGhost(b, a);
    }
  },

  // 11 — Void Devourer: each problem, randomly applies one of the simpler
  //     prior twists.
  11: {
    init(scene) {
      scene.bossTwistState.subTwist = null;
    },
    onSpawn(scene, asteroid) {
      const choices = [1, 3, 4, 7, 10];
      const pick = choices[Math.floor(Math.random() * choices.length)];
      const sub = BOSS_TWISTS[pick];
      if (sub?.onSpawn) sub.onSpawn(scene, asteroid);
      scene.bossTwistState.subTwist = pick;
    },
    onWrong(scene, asteroid, btn) {
      const pick = scene.bossTwistState.subTwist;
      const sub = BOSS_TWISTS[pick];
      if (sub?.onWrong) sub.onWrong(scene, asteroid, btn);
    }
  },

  // 17 — King Coli (hidden hygiene superboss): "WASH TO WIN". Soap bubbles drift
  //      in from the sides every ~13–18s; tapping one SCRUBS the germ-king for a
  //      bonus hit. Reinforces hand-washing. NB: unlike the other twists this
  //      intentionally helps the player — it's King Coli's signature mechanic,
  //      and the HP (40) + clock (110s) are tuned for it. The scrub never lands
  //      the killing blow (capped at 1 HP), so the win always comes from a solved
  //      problem and the normal defeat pipeline stays intact.
  17: {
    init(scene) {
      const spawn = () => {
        if (scene.state === 'ended' || scene.state === 'failed') return;
        if (scene.state === 'playing' && (scene.bossHp || 0) > 1) {
          spawnSoapBubble(scene);
        }
        scene.time.delayedCall(13000 + Math.random() * 5000, spawn);
      };
      // First bubble well into the fight, clear of the boss intro.
      scene.time.delayedCall(9000, spawn);
    }
  }
};

// A tappable soap bubble for King Coli's "wash to win" mechanic. Floats in the
// left/right margin (clear of the centre problem and the bottom answer buttons),
// bobs invitingly, and auto-pops after a few seconds if ignored.
function spawnSoapBubble(scene) {
  const W = scene.cameras.main.width;
  const onLeft = Math.random() < 0.5;
  const startX = onLeft ? 120 + Math.random() * 160 : W - 280 + Math.random() * 160;
  const startY = 380 + Math.random() * 140;

  const bubble = scene.add.container(startX, startY).setDepth(40);
  const g = scene.add.graphics();
  g.fillStyle(0xbfe9ff, 0.30); g.fillCircle(0, 0, 46);          // bubble body
  g.lineStyle(4, 0xffffff, 0.85); g.strokeCircle(0, 0, 46);      // rim
  g.fillStyle(0xffffff, 0.7); g.fillEllipse(-16, -18, 18, 12);   // sheen
  g.fillStyle(0xfff3b8, 0.95); g.fillRoundedRect(-18, 6, 36, 18, 6); // soap bar
  g.lineStyle(2, 0xffffff, 0.9); g.strokeRoundedRect(-18, 6, 36, 18, 6);
  bubble.add(g);

  scene.tweens.add({ targets: bubble, scale: { from: 0.85, to: 1 }, duration: 300, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: bubble, y: bubble.y - 28, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  const hit = scene.add.circle(0, 0, 52, 0, 0).setInteractive({ useHandCursor: true });
  bubble.add(hit);

  let popped = false;
  const expire = scene.time.delayedCall(4200, () => {
    if (popped) return;
    popped = true;
    scene.tweens.add({ targets: bubble, alpha: 0, scale: 0.6, duration: 300, onComplete: () => bubble.destroy() });
  });

  hit.on('pointerdown', () => {
    if (popped) return;
    popped = true;
    expire.remove(false);
    if (scene.state === 'playing' && (scene.bossHp || 0) > 1) {
      scene.bossHp = Math.max(1, scene.bossHp - 1);
      if (scene.drawBossHp) scene.drawBossHp();
    }
    audio.playStardustChime?.();
    popSoap(scene, bubble.x, bubble.y);
    bubble.destroy();
  });
}

// Soap-suds burst + a "SCRUB!" pop when a bubble is tapped.
function popSoap(scene, x, y) {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const sud = scene.add.circle(x, y, 5 + Math.random() * 4, 0xffffff, 0.9).setDepth(41);
    scene.tweens.add({
      targets: sud,
      x: x + Math.cos(a) * (50 + Math.random() * 30),
      y: y + Math.sin(a) * (50 + Math.random() * 30),
      alpha: 0, scale: 0.4,
      duration: 500, ease: 'Quad.easeOut',
      onComplete: () => sud.destroy()
    });
  }
  const txt = scene.add.text(x, y - 10, 'SCRUB!', style('display', {
    fontSize: '42px', fill: '#bfe9ff', stroke: '#0a2a3a', strokeThickness: 5
  })).setOrigin(0.5).setDepth(42);
  scene.tweens.add({
    targets: txt, y: y - 70, alpha: 0, scale: 1.3,
    duration: 700, ease: 'Quad.easeOut',
    onComplete: () => txt.destroy()
  });
}
