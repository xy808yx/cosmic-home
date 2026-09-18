// Parent dashboard — clean, consistent space-themed layout. 8px spacing grid,
// dark base + cyan/coral/mint accents. Includes a Reset Progress button.

import Phaser from 'phaser';
import { progress, findWorld, CHAPTER1_FINAL_ID, getChapterWorlds, getActiveWorlds } from '../GameData.js';
import { records } from '../RecordsManager.js';
import { audio } from '../AudioManager.js';
import { music } from '../MusicManager.js';
import { companion, drawCompanion } from '../CompanionManager.js';
import { style, menuStyle } from '../textStyles.js';
import { createIconButton, createButton } from '../buttonHelper.js';
import { createStarfield } from '../starfieldHelper.js';
import { drawArrowLeftIcon, drawSoundIcon } from '../StatIcons.js';
import { COLORS } from '../colorPalette.js';
import { createPinKeypad } from '../pinKeypad.js';

const W = 1080;
const H = 1920;

const ACCENT = COLORS.accentTeal;
const WARN = COLORS.error;
const SUCCESS = COLORS.success;
const GOLD = 0xffd86b;       // automatic (fast + accurate)
const SLOW_GREEN = 0x4f956b; // accurate but not yet fast — the automaticity gap

const DEFAULT_PIN = '8888';

export class ParentDashboardScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ParentDashboardScene' });
  }

  create() {
    music.ensurePlaying(this);
    createStarfield(this, { width: W, height: H, accentStrength: 0 });
    this.add.rectangle(W / 2, H / 2, W, H, COLORS.bgDark, 0.65).setDepth(0);

    const pinVerified = this.registry.get('parentPinVerified');
    if (!pinVerified) {
      this.showPinEntry();
    } else {
      this.showDashboard();
    }
  }

  showPinEntry() {
    this.add.text(W / 2, 240, 'Parent Dashboard', style('display', {
      fontSize: '64px',
      fill: '#ffffff'
    })).setOrigin(0.5).setDepth(10);

    this.add.text(W / 2, 320, 'Enter PIN to continue', menuStyle('body'))
      .setOrigin(0.5).setDepth(10);

    this.pinDigits = ['', '', '', ''];
    this.currentPinIndex = 0;
    this.pinDisplay = this.add.text(W / 2, 460, '_ _ _ _', style('display', {
      fontSize: '96px',
      fill: '#ffffff'
    })).setOrigin(0.5).setDepth(10);

    this.createNumberPad();

    const back = createButton(this, {
      x: W / 2, y: H - 130, label: '< Back to Game',
      width: 360, height: 80, color: 0x4a4a6a,
      onClick: () => this.scene.start('WorldMapScene')
    });
    back.setDepth(10);
  }

  createNumberPad() {
    createPinKeypad(this, {
      x: W / 2, y: 700,
      onDigit: digit => this.enterDigit(digit),
      onClear: () => this.clearPin(),
      onBackspace: () => this.backspace(),
    }).setDepth(10);
  }

  enterDigit(digit) {
    if (this.currentPinIndex >= 4) return;
    this.pinDigits[this.currentPinIndex] = digit;
    this.currentPinIndex++;
    this.updatePinDisplay();
    if (this.currentPinIndex === 4) this.verifyPin();
  }

  backspace() {
    if (this.currentPinIndex > 0) {
      this.currentPinIndex--;
      this.pinDigits[this.currentPinIndex] = '';
      this.updatePinDisplay();
    }
  }

  clearPin() {
    this.pinDigits = ['', '', '', ''];
    this.currentPinIndex = 0;
    this.updatePinDisplay();
  }

  updatePinDisplay() {
    this.pinDisplay.setText(this.pinDigits.map(d => d || '_').join(' '));
  }

  verifyPin() {
    const enteredPin = this.pinDigits.join('');
    const savedPin = localStorage.getItem('cosmicMathParentPin') || DEFAULT_PIN;
    if (enteredPin === savedPin) {
      this.registry.set('parentPinVerified', true);
      this.scene.restart();
    } else {
      this.cameras.main.shake(200, 0.01);
      this.pinDisplay.setColor('#ff6b6b');
      this.time.delayedCall(500, () => {
        this.pinDisplay.setColor('#ffffff');
        this.clearPin();
      });
    }
  }

  // ============================================================
  // DASHBOARD
  // ============================================================
  showDashboard() {
    this.currentTab = 'summary';

    const headerBg = this.add.graphics().setDepth(10);
    headerBg.fillStyle(COLORS.bgDark, 0.92);
    headerBg.fillRect(0, 0, W, 160);

    createIconButton(this, {
      x: 80, y: 80, radius: 36,
      accentColor: ACCENT,
      drawIcon: (g, size) => drawArrowLeftIcon(g, 0, 0, size),
      onClick: () => this.scene.start('WorldMapScene')
    }).setDepth(15);

    this.add.text(W / 2, 80, 'Parent Dashboard', style('display', {
      fontSize: '54px',
      fill: '#ffffff'
    })).setOrigin(0.5).setDepth(15);

    const soundBtn = createIconButton(this, {
      x: W - 80, y: 80, radius: 36,
      accentColor: ACCENT,
      drawIcon: (g, size) => drawSoundIcon(g, 0, 0, size, 0xffffff, audio.enabled),
      onClick: () => { audio.toggleEnabled(); soundBtn.redrawIcon(); }
    });
    soundBtn.setDepth(15);

    this.contentContainer = this.add.container(0, 0).setDepth(11);
    this.createTabs();
    this.showSummaryTab();
  }

  createTabs() {
    const tabs = [
      { id: 'summary', label: 'Summary' },
      { id: 'companion', label: 'Pet' },
      { id: 'analytics', label: 'Analytics' },
      { id: 'settings', label: 'Settings' }
    ];
    // Pack & Go (Conveyor) timing tab, only shown once Chapter 3 has been
    // played, so the dashboard stays uncluttered for players who haven't reached
    // it. Inserted before Settings.
    const cs = records.getConveyorStats();
    if (cs.production.count + cs.recognition.count > 0) {
      tabs.splice(3, 0, { id: 'conveyor', label: 'Pack & Go' });
    }

    const gap = 16;
    // Fit the tab row to the canvas: 240 wide when there's room, narrower (with
    // smaller text) once the optional Conveyor tab pushes the count to 5.
    const tabWidth = Math.min(240, Math.floor((W - 80 - (tabs.length - 1) * gap) / tabs.length));
    const tabFontSize = tabWidth < 215 ? '20px' : '24px';
    const tabHeight = 64;
    const totalW = tabs.length * tabWidth + (tabs.length - 1) * gap;
    const startX = W / 2 - totalW / 2 + tabWidth / 2;
    const tabY = 220;

    this.tabButtons = {};

    tabs.forEach((tab, i) => {
      const x = startX + i * (tabWidth + gap);
      const c = this.add.container(x, tabY).setDepth(12);
      const bg = this.add.graphics();
      c.add(bg);
      const text = this.add.text(0, 0, tab.label, style('subhead', {
        fontSize: tabFontSize
      })).setOrigin(0.5);
      c.add(text);
      const hit = this.add.rectangle(0, 0, tabWidth, tabHeight, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      c.add(hit);
      hit.on('pointerdown', () => {
        audio.playClick();
        this.switchTab(tab.id);
      });

      c.bg = bg;
      c.text = text;
      c.tabId = tab.id;
      c.tabW = tabWidth;
      c.tabH = tabHeight;
      this.tabButtons[tab.id] = c;
    });
    this.refreshTabs();
  }

  refreshTabs() {
    Object.values(this.tabButtons).forEach(c => {
      const isActive = c.tabId === this.currentTab;
      c.bg.clear();
      c.bg.fillStyle(isActive ? ACCENT : 0x1a1a30, 0.95);
      c.bg.fillRoundedRect(-c.tabW / 2, -c.tabH / 2, c.tabW, c.tabH, 16);
      c.bg.lineStyle(2, ACCENT, isActive ? 1 : 0.5);
      c.bg.strokeRoundedRect(-c.tabW / 2, -c.tabH / 2, c.tabW, c.tabH, 16);
      c.text.setColor(isActive ? '#0a0a1a' : '#ffffff');
    });
  }

  switchTab(tabId) {
    this.currentTab = tabId;
    this.refreshTabs();
    this.contentContainer.removeAll(true);
    if (tabId === 'summary') this.showSummaryTab();
    else if (tabId === 'companion') this.showCompanionTab();
    else if (tabId === 'analytics') this.showAnalyticsTab();
    else if (tabId === 'conveyor') this.showConveyorTab();
    else this.showSettingsTab();
  }

  // ----- SUMMARY -----
  showSummaryTab() {
    const stats = this.calculateStats();
    let y = 360;
    this.addStatCard(y, 'Total Stars', `${stats.totalStars}`, COLORS.warning); y += 152;
    this.addStatCard(y, 'Levels Completed', `${stats.levelsCompleted}`, ACCENT); y += 152;
    this.addStatCard(y, 'Current World', stats.currentWorld, 0xa29bfe); y += 152;
    const accColor = stats.overallAccuracy >= 80 ? SUCCESS : stats.overallAccuracy >= 60 ? COLORS.warning : WARN;
    this.addStatCard(y, 'Overall Accuracy', `${stats.overallAccuracy}%`, accColor);
  }

  addStatCard(y, label, value, accentColor) {
    const w = 880;
    const c = this.add.container(W / 2, y);
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.bgPanel, 0.95);
    bg.fillRoundedRect(-w / 2, -64, w, 128, 18);
    bg.lineStyle(3, accentColor, 0.85);
    bg.strokeRoundedRect(-w / 2, -64, w, 128, 18);
    c.add(bg);
    c.add(this.add.text(-w / 2 + 32, -16, label, style('caption', {
      fontSize: '24px',
      fill: '#cfcfe0',
      fontStyle: '900'
    })).setOrigin(0, 0.5));
    c.add(this.add.text(w / 2 - 32, 0, value, style('display', {
      fontSize: '54px',
      fill: '#ffffff'
    })).setOrigin(1, 0.5));
    this.contentContainer.add(c);
  }

  // ----- COMPANION -----
  showCompanionTab() {
    if (!companion.hasStarter()) {
      const msg = this.add.text(W / 2, H / 2, 'No companion picked yet.\nYour child will choose one\nthe next time they open the game.', style('body', {
        fontSize: '28px',
        fill: '#cfcfe0',
        align: 'center'
      })).setOrigin(0.5);
      this.contentContainer.add(msg);
      return;
    }
    const sp = companion.getSpecies();
    const card = this.add.container(W / 2, 460);
    const w = 880;
    const h = 320;
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.bgPanel, 0.95);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    bg.lineStyle(3, sp.color, 0.85);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
    card.add(bg);
    const pet = drawCompanion(this, -w / 2 + 160, 0, { scale: 1.1 });
    card.add(pet);
    card.add(this.add.text(-w / 2 + 320, -80, sp.name, style('display', {
      fontSize: '46px',
      fill: '#ffffff'
    })).setOrigin(0, 0.5));
    card.add(this.add.text(-w / 2 + 320, -28, `Stage: ${companion.getStage()}`, style('subhead', {
      fontSize: '28px',
      fill: '#' + sp.accent.toString(16).padStart(6, '0')
    })).setOrigin(0, 0.5));
    card.add(this.add.text(-w / 2 + 320, 22, `Pellets fed: ${companion.getTotalPellets()}`, style('body', {
      fontSize: '22px',
      fill: '#cfcfe0'
    })).setOrigin(0, 0.5));
    const stats = companion.getEvolutionStats();
    // Denominator = worlds the player can actually reach. Chapter 2 stays hidden
    // until World 11 is cleared, so before that the total is just Chapter 1 (11)
    // — counting all 19 would read as un-completable and spoil the hidden worlds.
    const ch2Unlocked = progress.isWorldFullyCleared(CHAPTER1_FINAL_ID);
    const reachableWorlds = ch2Unlocked
      ? getActiveWorlds().length
      : getChapterWorlds(1).length;
    card.add(this.add.text(-w / 2 + 320, 70, `Worlds cleared: ${stats.worldsCleared} / ${reachableWorlds}`, style('body', {
      fontSize: '22px',
      fill: '#cfcfe0'
    })).setOrigin(0, 0.5));
    card.add(this.add.text(-w / 2 + 320, 112, `Lifetime correct: ${stats.lifetimeCorrect}`, style('body', {
      fontSize: '22px',
      fill: '#cfcfe0'
    })).setOrigin(0, 0.5));
    this.contentContainer.add(card);
  }

  // ----- ANALYTICS -----
  // The goal is AUTOMATICITY (instant recall), not just correctness — so the
  // grid is colored by recall status, and the lists separate the two kinds of
  // work: facts that are slow (need speed) vs. facts that are missed (need
  // accuracy). Gold = automatic, green = accurate-but-slow, amber/red = missed.
  showAnalyticsTab() {
    const startY = 300;
    this.contentContainer.add(this.add.text(W / 2, startY, 'Recall Speed & Mastery', style('subhead', {
      fontSize: '32px',
      fill: '#ffd86b'
    })).setOrigin(0.5));

    const stats = progress.getAutomaticityStats();
    const pace = records.getPaceMs();
    const summary = stats.attempted === 0
      ? 'No data yet. Keep playing!'
      : `${stats.automatic} of ${stats.totalFacts} facts automatic`
        + (pace > 0 ? `   ·   typical recall ${(pace / 1000).toFixed(1)}s` : '');
    this.contentContainer.add(this.add.text(W / 2, startY + 46, summary, style('body', {
      fontSize: '24px', fill: '#cfcfe0'
    })).setOrigin(0.5));

    const gridY = startY + 108;
    this.createMasteryGrid(gridY);
    const legendY = gridY + 24 + 12 * 64 + 22;
    this.createMasteryLegend(legendY);

    let y = legendY + 64;

    // Accurate-but-slow — the actionable automaticity gap.
    this.contentContainer.add(this.add.text(W / 2, y, 'Not automatic yet (accurate but slow)', style('subhead', {
      fontSize: '26px', fill: '#7ee08a'
    })).setOrigin(0.5));
    y += 42;
    const slow = progress.getSlowFacts(4);
    if (slow.length === 0) {
      this.contentContainer.add(this.add.text(W / 2, y, stats.attempted ? 'Nothing slow right now. Nice!' : '–', style('caption', {
        fontSize: '22px', fill: '#7a7a90'
      })).setOrigin(0.5));
      y += 40;
    } else {
      slow.forEach((f, i) => {
        this.contentContainer.add(this.add.text(W / 2, y + i * 42,
          `${f.a} × ${f.b} = ${f.a * f.b}   (~${(f.recentMs / 1000).toFixed(1)}s)`,
          style('body', { fontSize: '24px', fill: '#cfcfe0' })).setOrigin(0.5));
      });
      y += slow.length * 42 + 14;
    }

    // Most missed — accuracy, not speed.
    const missed = progress.getMostMissedFacts(4);
    if (missed.length > 0) {
      y += 18;
      this.contentContainer.add(this.add.text(W / 2, y, 'Most missed (needs accuracy)', style('subhead', {
        fontSize: '26px', fill: '#ff6b6b'
      })).setOrigin(0.5));
      y += 42;
      missed.forEach((fact, i) => {
        this.contentContainer.add(this.add.text(W / 2, y + i * 42,
          `${fact.a} × ${fact.b} = ${fact.a * fact.b}   (${fact.accuracy}%)`,
          style('body', { fontSize: '24px', fill: fact.accuracy < 50 ? '#ff6b6b' : '#f7dc6f' })).setOrigin(0.5));
      });
    }
  }

  createMasteryGrid(startY) {
    const cellSize = 64;
    const startX = W / 2 - 6 * cellSize;
    for (let i = 1; i <= 12; i++) {
      this.contentContainer.add(this.add.text(startX + (i - 0.5) * cellSize, startY, i.toString(), style('caption', {
        fontSize: '16px', fill: '#7a7a90'
      })).setOrigin(0.5));
    }
    for (let r = 1; r <= 12; r++) {
      const rowY = startY + 24 + (r - 1) * cellSize;
      this.contentContainer.add(this.add.text(startX - 16, rowY + cellSize / 2, r.toString(), style('caption', {
        fontSize: '16px', fill: '#7a7a90'
      })).setOrigin(1, 0.5));
      for (let col = 1; col <= 12; col++) {
        const color = this.factStatusColor(r, col);
        const cell = this.add.graphics();
        cell.fillStyle(color, 1);
        cell.fillRoundedRect(startX + (col - 1) * cellSize + 2, rowY + 2, cellSize - 4, cellSize - 4, 4);
        this.contentContainer.add(cell);
      }
    }
  }

  // Cell color by automaticity status. Inaccurate facts split amber/red by
  // accuracy so the parent can see how far off they are.
  factStatusColor(a, b) {
    const status = progress.getFactStatus(a, b);
    if (status === 'unseen') return 0x2d2d44;
    if (status === 'automatic') return GOLD;
    if (status === 'slow') return SLOW_GREEN;
    return progress.getFactMastery(a, b) >= 50 ? 0xffb142 : WARN; // inaccurate
  }

  createMasteryLegend(y) {
    const items = [
      [GOLD, 'Automatic'],
      [SLOW_GREEN, 'Accurate, slow'],
      [0xffb142, 'Missed'],
      [0x2d2d44, 'Unseen'],
    ];
    // Lay the four swatch+label pairs out centered across the width.
    const colW = 240;
    const totalW = colW * items.length;
    let x = W / 2 - totalW / 2 + 20;
    for (const [color, label] of items) {
      const sw = this.add.graphics();
      sw.fillStyle(color, 1);
      sw.fillRoundedRect(x, y - 12, 22, 22, 4);
      this.contentContainer.add(sw);
      this.contentContainer.add(this.add.text(x + 32, y, label, style('caption', {
        fontSize: '20px', fill: '#cfcfe0'
      })).setOrigin(0, 0.5));
      x += colW;
    }
  }

  // ----- PACK & GO (Conveyor timing) -----
  // Surfaces the Chapter-3 instrumentation so the owner can resolve the
  // production-vs-recognition A/B and check that fast times reflect real recall
  // (not a position-guessing shortcut). One panel per input mode: the
  // correct-answer recall-time distribution (bucketed) + recognition's
  // dock-position-repeat rate (should sit near chance if randomization holds).
  showConveyorTab() {
    const cs = records.getConveyorStats();
    let y = 296;
    this.contentContainer.add(this.add.text(W / 2, y, 'Pack & Go: Recall Timing', style('subhead', {
      fontSize: '32px', fill: '#ffd86b'
    })).setOrigin(0.5));
    y += 46;
    this.contentContainer.add(this.add.text(W / 2, y,
      'Production = recall first (no options). Recognition = pick from 4.\nFast times in production reflect real recall; in recognition, many\nvery-fast taps + a high dock-repeat can mean guessing by position.',
      style('body', { fontSize: '22px', fill: '#cfcfe0', align: 'center', lineSpacing: 6 })).setOrigin(0.5, 0));
    y += 132;

    y = this.drawTimingPanel(y, 'Production (recall)', cs.production, cs.bucketLabels, false);
    y += 26;
    this.drawTimingPanel(y, 'Recognition (pick)', cs.recognition, cs.bucketLabels, true);
  }

  // Draws one mode's timing card at yTop; returns the y just below it.
  drawTimingPanel(yTop, title, m, bucketLabels, isRecognition) {
    const w = 880;
    const panelH = isRecognition ? 300 : 248;
    const hasData = m.count > 0;
    const accent = isRecognition ? ACCENT : GOLD;
    const bucketColors = [GOLD, SUCCESS, SLOW_GREEN, 0xffb142, WARN];

    const card = this.add.container(W / 2, yTop + panelH / 2);
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.bgPanel, 0.95);
    bg.fillRoundedRect(-w / 2, -panelH / 2, w, panelH, 18);
    bg.lineStyle(3, accent, 0.85);
    bg.strokeRoundedRect(-w / 2, -panelH / 2, w, panelH, 18);
    card.add(bg);

    card.add(this.add.text(-w / 2 + 28, -panelH / 2 + 34, title, style('subhead', {
      fontSize: '28px', fill: '#ffffff'
    })).setOrigin(0, 0.5));
    card.add(this.add.text(w / 2 - 28, -panelH / 2 + 34,
      hasData ? `${m.count} packed · avg ${(m.avgMs / 1000).toFixed(1)}s · ${m.fastPct}% under 2.5s` : 'no rounds yet',
      style('caption', { fontSize: '22px', fill: '#cfcfe0' })).setOrigin(1, 0.5));

    if (!hasData) {
      card.add(this.add.text(0, 6, isRecognition ? 'Recognition mode not used yet.' : 'No production rounds recorded yet.', style('caption', {
        fontSize: '22px', fill: '#7a7a90'
      })).setOrigin(0.5));
      this.contentContainer.add(card);
      return yTop + panelH;
    }

    // Stacked recall-time distribution bar.
    const barW = w - 56;
    const barH = 56;
    const barX = -barW / 2;
    const barY = -panelH / 2 + 92;
    let cx = barX;
    const segG = this.add.graphics();
    card.add(segG);
    m.buckets.forEach((cnt, i) => {
      const segW = (cnt / m.count) * barW;
      if (segW > 0.5) {
        segG.fillStyle(bucketColors[i], 1);
        segG.fillRect(cx, barY, segW, barH);
        if (segW > 40) {
          card.add(this.add.text(cx + segW / 2, barY + barH / 2, String(cnt), style('caption', {
            fontSize: '20px', fill: '#0a0a18', fontStyle: '900'
          })).setOrigin(0.5));
        }
      }
      cx += segW;
    });
    const outline = this.add.graphics();
    outline.lineStyle(2, 0x3a3a55, 1);
    outline.strokeRect(barX, barY, barW, barH);
    card.add(outline);

    // Bucket legend (swatch + label per bin, spread across the bar).
    const legendY = barY + barH + 30;
    const cellW = barW / bucketLabels.length;
    bucketLabels.forEach((lab, i) => {
      const lx = barX + cellW * i + 14;
      const sw = this.add.graphics();
      sw.fillStyle(bucketColors[i], 1);
      sw.fillRoundedRect(lx, legendY - 9, 16, 16, 3);
      card.add(sw);
      card.add(this.add.text(lx + 24, legendY, lab, style('caption', {
        fontSize: '18px', fill: '#cfcfe0'
      })).setOrigin(0, 0.5));
    });

    // Recognition: dock-position-repeat vs chance (4 docks ⇒ ~25%).
    if (isRecognition) {
      const chance = 25;
      const repeatY = legendY + 48;
      const col = m.posTotal === 0 ? '#7a7a90'
        : Math.abs(m.posRepeatPct - chance) <= 12 ? '#7ee08a'
        : m.posRepeatPct > chance ? '#ff6b6b' : '#f7dc6f';
      const txt = m.posTotal === 0
        ? 'Dock-position repeat: not yet (need more crates)'
        : `Dock-position repeat: ${m.posRepeatPct}%  (random ≈ ${chance}%)`;
      card.add(this.add.text(0, repeatY, txt, style('body', { fontSize: '22px', fill: col })).setOrigin(0.5));
    }

    this.contentContainer.add(card);
    return yTop + panelH;
  }

  // ----- SETTINGS -----
  showSettingsTab() {
    let y = 360;
    this.addSettingButton(y, 'Change PIN', () => this.showChangePinDialog(), ACCENT); y += 130;
    this.addSettingButton(y, 'Reset All Progress', () => this.showResetConfirmation(), WARN); y += 130;
    this.addSettingButton(y, 'Lock Dashboard', () => {
      this.registry.set('parentPinVerified', false);
      this.scene.restart();
    }, 0x8888a0); y += 160;

    this.contentContainer.add(this.add.text(W / 2, y, 'About difficulty', style('subhead', {
      fontSize: '28px',
      fill: '#ffd86b'
    })).setOrigin(0.5));
    y += 50;
    this.contentContainer.add(this.add.text(W / 2, y,
      'The game adapts to your child automatically: facts they miss\nresurface more often, and timing scales with the world they\'re in.',
      style('body', {
        fontSize: '22px',
        fill: '#cfcfe0',
        align: 'center',
        lineSpacing: 8
      })).setOrigin(0.5, 0));
  }

  addSettingButton(y, label, callback, color = ACCENT) {
    const w = 700;
    const c = this.add.container(W / 2, y);
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.bgPanel, 0.95);
    bg.fillRoundedRect(-w / 2, -52, w, 104, 18);
    bg.lineStyle(3, color, 0.85);
    bg.strokeRoundedRect(-w / 2, -52, w, 104, 18);
    c.add(bg);
    c.add(this.add.text(0, 0, label, style('subhead', {
      fontSize: '32px',
      fill: '#ffffff'
    })).setOrigin(0.5));
    const hit = this.add.rectangle(0, 0, w, 104, 0x000000, 0).setInteractive({ useHandCursor: true });
    c.add(hit);
    hit.on('pointerdown', () => {
      audio.playClick();
      callback();
    });
    this.contentContainer.add(c);
  }

  showChangePinDialog() {
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.85).setDepth(50).setInteractive();
    const c = this.add.container(W / 2, H / 2).setDepth(51);
    const w = 720;
    const h = 1240;
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.bgPanel, 0.98);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 22);
    bg.lineStyle(3, ACCENT, 0.9);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 22);
    c.add(bg);
    c.add(this.add.text(0, -h / 2 + 85, 'Change PIN', style('display', {
      fontSize: '48px',
      fill: '#ffd86b'
    })).setOrigin(0.5));
    c.add(this.add.text(0, -h / 2 + 155, 'Enter new 4-digit PIN', menuStyle('body'))
      .setOrigin(0.5));

    const newPin = ['', '', '', ''];
    let idx = 0;
    const pinDisplay = this.add.text(0, -h / 2 + 270, '_ _ _ _', style('display', {
      fontSize: '80px',
      fill: '#ffffff'
    })).setOrigin(0.5);
    c.add(pinDisplay);

    const updateDisplay = () => pinDisplay.setText(newPin.map(d => d || '_').join(' '));
    c.add(createPinKeypad(this, {
      y: -150,
      onDigit: digit => {
        if (idx >= 4) return;
        newPin[idx++] = digit;
        updateDisplay();
      },
      onClear: () => {
        newPin.fill('');
        idx = 0;
        updateDisplay();
      },
      onBackspace: () => {
        if (idx === 0) return;
        newPin[--idx] = '';
        updateDisplay();
      },
    }));

    const cleanup = () => {
      overlay.destroy();
      c.destroy();
    };

    c.add(createButton(this, {
      x: -150, y: h / 2 - 100, label: 'Cancel',
      width: 270, height: 100, color: 0x4a4a6a,
      textOverrides: menuStyle('button'),
      onClick: cleanup
    }));
    c.add(createButton(this, {
      x: 150, y: h / 2 - 100, label: 'Save',
      width: 270, height: 100, color: SUCCESS,
      textOverrides: menuStyle('button'),
      onClick: () => {
        if (idx === 4) {
          localStorage.setItem('cosmicMathParentPin', newPin.join(''));
          cleanup();
          this.flashMessage('PIN updated', SUCCESS);
        }
      }
    }));
  }

  showResetConfirmation() {
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.85).setDepth(50).setInteractive();
    const c = this.add.container(W / 2, H / 2).setDepth(51);
    const w = 760;
    const h = 540;
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.bgPanel, 0.98);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 22);
    bg.lineStyle(3, WARN, 0.9);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 22);
    c.add(bg);
    c.add(this.add.text(0, -h / 2 + 70, 'Reset All Progress?', style('display', {
      fontSize: '44px',
      fill: '#ff6b6b'
    })).setOrigin(0.5));
    c.add(this.add.text(0, 0,
      'This will delete ALL game progress:\nlevels, stars, pet, ship, and learning data.\n\nThis cannot be undone.',
      style('body', {
        fontSize: '24px',
        fill: '#cfcfe0',
        align: 'center',
        lineSpacing: 8
      })).setOrigin(0.5));

    const cleanup = () => {
      overlay.destroy();
      c.destroy();
    };

    c.add(createButton(this, {
      x: -130, y: h / 2 - 80, label: 'Cancel',
      width: 240, height: 80, color: ACCENT,
      onClick: cleanup
    }));
    c.add(createButton(this, {
      x: 130, y: h / 2 - 80, label: 'Reset',
      width: 240, height: 80, color: WARN,
      onClick: () => {
        progress.resetAll();
        records.reset();
        cleanup();
        this.flashMessage('Progress reset', WARN);
        this.time.delayedCall(900, () => {
          this.registry.set('parentPinVerified', false);
          this.scene.start('BootScene');
        });
      }
    }));
  }

  flashMessage(text, color) {
    const msg = this.add.text(W / 2, H - 220, text, style('display', {
      fontSize: '40px',
      fill: '#' + color.toString(16).padStart(6, '0')
    })).setOrigin(0.5).setDepth(70);
    this.tweens.add({
      targets: msg,
      alpha: 0,
      delay: 1200,
      duration: 600,
      onComplete: () => msg.destroy()
    });
  }

  calculateStats() {
    let totalStars = progress.totalStars || 0;
    let levelsCompleted = 0;
    let currentWorldId = 1;
    for (const world of getActiveWorlds()) {
      const wp = progress.getWorldProgress(world.id);
      levelsCompleted += wp?.levelsCompleted || 0;
      if (progress.isWorldUnlocked(world.id)) currentWorldId = world.id;
    }
    const currentWorld = findWorld(currentWorldId)?.name || 'Moon Base';
    const accStats = records.getOverallStats();
    const overallAccuracy = accStats.totalAttempts > 0
      ? Math.round((accStats.totalCorrect / accStats.totalAttempts) * 100)
      : 0;
    return { totalStars, levelsCompleted, currentWorld, overallAccuracy };
  }
}
