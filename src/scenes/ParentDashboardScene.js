// Parent dashboard: clean, consistent space-themed layout. 8px spacing grid,
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
import { ParentGate, createPinDots } from '../parentGate.js';
import { setPin, deviceStorage } from '../parentPin.js';
import { openTransferSheet } from '../transferSheet.js';

const W = 1080;
const H = 1920;

const ACCENT = COLORS.accentTeal;
const WARN = COLORS.error;
const SUCCESS = COLORS.success;
// Button labels at menu weight. No fill, so createButton picks dark ink on the
// light teal and green faces and white on the dark ones.
const BUTTON_TEXT = { fontStyle: '800' };
const GOLD = 0xffd86b;       // automatic (fast + accurate)
const SLOW_GREEN = 0x4f956b; // accurate but not yet fast, the automaticity gap
// Joins words so a wrapped line never splits them.
const NBSP = ' ';
const keepTogether = text => text.replace(/ /g, NBSP);

export class ParentDashboardScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ParentDashboardScene' });
  }

  create() {
    music.ensurePlaying(this);
    createStarfield(this, { width: W, height: H, accentStrength: 0 });
    this.add.rectangle(W / 2, H / 2, W, H, COLORS.bgDark, 0.65).setDepth(0);

    if (this.registry.get('parentPinVerified')) {
      this.showDashboard();
      return;
    }
    new ParentGate(this, {
      storage: deviceStorage(),
      onUnlock: notice => {
        this.registry.set('parentPinVerified', true);
        this.registry.set('parentGateNotice', notice);
        this.scene.restart();
      },
      onBack: () => this.scene.start('WorldMapScene'),
    }).start();
  }

  // ============================================================
  // DASHBOARD
  // ============================================================
  showDashboard() {
    this.currentTab = 'summary';
    // Leaving the dashboard locks it again, so a child handed the device
    // straight after cannot walk back in and change the PIN.
    this.events.once('shutdown', () => this.registry.set('parentPinVerified', false));

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
      fontSize: '64px',
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

    const notice = this.registry.get('parentGateNotice');
    if (notice) {
      this.registry.set('parentGateNotice', null);
      this.flashMessage(notice, SUCCESS);
    }
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

    const gap = 10;
    // Fit the tab row to the canvas: 240 wide when there's room, about 198
    // once the optional Conveyor tab pushes the count to 5. The labels stay at
    // the label size either way; "Analytics" and "Pack & Go" still fit.
    const tabWidth = Math.min(240, Math.floor((W - 48 - (tabs.length - 1) * gap) / tabs.length));
    const tabHeight = 72;
    const totalW = tabs.length * tabWidth + (tabs.length - 1) * gap;
    const startX = W / 2 - totalW / 2 + tabWidth / 2;
    const tabY = 220;

    this.tabButtons = {};

    tabs.forEach((tab, i) => {
      const x = startX + i * (tabWidth + gap);
      const c = this.add.container(x, tabY).setDepth(12);
      const bg = this.add.graphics();
      c.add(bg);
      const text = this.add.text(0, 0, tab.label, style('subhead')).setOrigin(0.5);
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
    const gap = 24;
    let y = 296;
    y = this.addStatCard(y, 'Total Stars', `${stats.totalStars}`, COLORS.warning) + gap;
    y = this.addStatCard(y, 'Levels Completed', `${stats.levelsCompleted}`, ACCENT) + gap;
    y = this.addStatCard(y, 'Current World', stats.currentWorld, 0xa29bfe) + gap;
    const accColor = stats.overallAccuracy >= 80 ? SUCCESS : stats.overallAccuracy >= 60 ? COLORS.warning : WARN;
    this.addStatCard(y, 'Overall Accuracy', `${stats.overallAccuracy}%`, accColor);
  }

  // Card whose top sits at `top`; returns the y just below it. The label sits
  // above the value, so a long world name never runs into it.
  addStatCard(top, label, value, accentColor) {
    const w = 880;
    const padX = 32;
    const padY = 22;
    const c = this.add.container(W / 2, top);
    const bg = this.add.graphics();
    c.add(bg);
    const labelText = this.add.text(-w / 2 + padX, padY, label, style('caption', {
      fill: '#cfcfe0',
      fontStyle: '900'
    }));
    const valueText = this.add.text(-w / 2 + padX, padY + labelText.height + 2, value, style('display', {
      fontSize: '52px',
      fill: '#ffffff',
      wordWrap: { width: w - padX * 2, useAdvancedWrap: true }
    }));
    c.add([labelText, valueText]);
    const h = valueText.y + valueText.height + padY - 4;
    bg.fillStyle(COLORS.bgPanel, 0.95);
    bg.fillRoundedRect(-w / 2, 0, w, h, 18);
    bg.lineStyle(3, accentColor, 0.85);
    bg.strokeRoundedRect(-w / 2, 0, w, h, 18);
    this.contentContainer.add(c);
    return top + h;
  }

  // ----- COMPANION -----
  showCompanionTab() {
    if (!companion.hasStarter()) {
      const msg = this.add.text(W / 2, H / 2, 'No companion picked yet.\nYour child will choose one\nthe next time they open the game.', style('body', {
        fill: '#cfcfe0',
        align: 'center',
        lineSpacing: 8,
        wordWrap: { width: 860, useAdvancedWrap: true }
      })).setOrigin(0.5);
      this.contentContainer.add(msg);
      return;
    }
    const sp = companion.getSpecies();
    // The card's top sits at y 300 and it grows to fit its lines.
    const card = this.add.container(W / 2, 300);
    const w = 880;
    const pad = 32;
    const textX = -w / 2 + 320;
    const wrap = { width: w / 2 - pad - textX, useAdvancedWrap: true };
    const bg = this.add.graphics();
    card.add(bg);
    let ty = pad;
    const addLine = (text, lineStyle, gapAfter = 6) => {
      const t = this.add.text(textX, ty, text, lineStyle);
      card.add(t);
      ty += t.height + gapAfter;
    };
    addLine(sp.name, style('display', { fontSize: '52px', fill: '#ffffff', wordWrap: wrap }), 4);
    addLine(`Stage: ${companion.getStage()}`, style('subhead', {
      fontSize: '42px',
      fill: '#' + sp.accent.toString(16).padStart(6, '0'),
      wordWrap: wrap
    }));
    const lineStyle = style('body', { fill: '#cfcfe0', wordWrap: wrap });
    addLine(`Pellets fed: ${companion.getTotalPellets()}`, lineStyle);
    const stats = companion.getEvolutionStats();
    // Denominator = worlds the player can actually reach. Chapter 2 stays hidden
    // until World 11 is cleared, so before that the total is just Chapter 1 (11).
    // Counting all 19 would read as un-completable and spoil the hidden worlds.
    const ch2Unlocked = progress.isWorldFullyCleared(CHAPTER1_FINAL_ID);
    const reachableWorlds = ch2Unlocked
      ? getActiveWorlds().length
      : getChapterWorlds(1).length;
    addLine(`Worlds cleared: ${stats.worldsCleared} / ${reachableWorlds}`, lineStyle);
    addLine(`Lifetime correct: ${stats.lifetimeCorrect}`, lineStyle, 0);
    const h = Math.max(320, ty + pad);
    bg.fillStyle(COLORS.bgPanel, 0.95);
    bg.fillRoundedRect(-w / 2, 0, w, h, 18);
    bg.lineStyle(3, sp.color, 0.85);
    bg.strokeRoundedRect(-w / 2, 0, w, h, 18);
    card.addAt(drawCompanion(this, -w / 2 + 160, h / 2, { scale: 1.1 }), 1);
    this.contentContainer.add(card);
  }

  // ----- ANALYTICS -----
  // The goal is AUTOMATICITY (instant recall), not just correctness, so the
  // grid is colored by recall status, and the lists separate the two kinds of
  // work: facts that are slow (need speed) vs. facts that are missed (need
  // accuracy). Gold = automatic, green = accurate-but-slow, amber/red = missed.
  showAnalyticsTab() {
    let y = 280;
    const heading = this.add.text(W / 2, y, 'Recall Speed & Mastery', style('subhead', {
      fontSize: '52px',
      fill: '#ffd86b'
    })).setOrigin(0.5, 0);
    this.contentContainer.add(heading);
    y += heading.height + 4;

    const stats = progress.getAutomaticityStats();
    const pace = records.getPaceMs();
    const summary = stats.attempted === 0
      ? 'No data yet. Keep playing!'
      : `${stats.automatic} of ${stats.totalFacts} facts automatic`
        + (pace > 0 ? `\ntypical recall ${(pace / 1000).toFixed(1)}s` : '');
    const summaryText = this.add.text(W / 2, y, summary, style('body', {
      fill: '#cfcfe0', align: 'center', wordWrap: { width: 960, useAdvancedWrap: true }
    })).setOrigin(0.5, 0);
    this.contentContainer.add(summaryText);
    y += summaryText.height + 20;

    y = this.createMasteryGrid(y) + 24;
    y = this.createMasteryLegend(y) + 36;

    // Two lists side by side: facts that are slow (need speed) and facts that
    // are missed (need accuracy). With nothing missed, the slow list is alone.
    // In a narrow column a heading wraps before its bracket, never inside it.
    const slow = progress.getSlowFacts(4);
    const missed = progress.getMostMissedFacts(4);
    const lists = [{
      // Accurate-but-slow: the actionable automaticity gap.
      heading: `Not automatic yet ${keepTogether('(accurate but slow)')}`,
      color: '#7ee08a',
      rows: slow.map(f => [`${f.a} × ${f.b} = ${f.a * f.b}`, `(~${(f.recentMs / 1000).toFixed(1)}s)`, '#cfcfe0']),
      empty: stats.attempted ? 'Nothing slow right now. Nice!' : '–',
    }];
    if (missed.length > 0) {
      // Most missed: accuracy, not speed.
      lists.push({
        heading: `Most missed ${keepTogether('(needs accuracy)')}`,
        color: '#ff6b6b',
        rows: missed.map(f => [`${f.a} × ${f.b} = ${f.a * f.b}`, `(${f.accuracy}%)`, f.accuracy < 50 ? '#ff6b6b' : '#f7dc6f']),
      });
    }
    const colGap = 40;
    const colW = lists.length === 2 ? (W - 80 - colGap) / 2 : 640;
    const headingW = lists.length === 2 ? colW : W - 80;
    const firstX = W / 2 - (lists.length * colW + (lists.length - 1) * colGap) / 2;
    const headings = lists.map((list, i) => {
      const t = this.add.text(firstX + i * (colW + colGap) + colW / 2, y, list.heading, style('subhead', {
        fontSize: '42px', fill: list.color, align: 'center',
        wordWrap: { width: headingW, useAdvancedWrap: true }
      })).setOrigin(0.5, 0);
      this.contentContainer.add(t);
      return t;
    });
    const rowsTop = y + Math.max(...headings.map(t => t.height)) + 12;
    const rowPitch = 56;
    lists.forEach((list, i) => {
      const left = firstX + i * (colW + colGap);
      if (list.rows.length === 0) {
        this.contentContainer.add(this.add.text(left + colW / 2, rowsTop, list.empty, style('body', {
          fill: '#cfcfe0', align: 'center', wordWrap: { width: colW, useAdvancedWrap: true }
        })).setOrigin(0.5, 0));
        return;
      }
      // Fact on the left, its time or accuracy on the right of the column.
      list.rows.forEach(([fact, detail, fill], r) => {
        const rowY = rowsTop + r * rowPitch;
        this.contentContainer.add(this.add.text(left + 8, rowY, fact, style('body', { fill })));
        this.contentContainer.add(this.add.text(left + colW - 8, rowY, detail, style('body', { fill })).setOrigin(1, 0));
      });
    });
  }

  // Grid whose top sits at startY; returns the y just below it. The 1 to 12
  // axis numbers are art-sized (32) so the grid and both lists fit the screen.
  createMasteryGrid(startY) {
    const cellSize = 56;
    const headerH = 40;
    const startX = W / 2 - 6 * cellSize;
    const axisStyle = style('caption', { fontSize: '32px', fill: '#cfcfe0', art: true });
    for (let i = 1; i <= 12; i++) {
      this.contentContainer.add(this.add.text(startX + (i - 0.5) * cellSize, startY + headerH / 2 - 2, i.toString(), axisStyle).setOrigin(0.5));
    }
    for (let r = 1; r <= 12; r++) {
      const rowY = startY + headerH + (r - 1) * cellSize;
      this.contentContainer.add(this.add.text(startX - 14, rowY + cellSize / 2, r.toString(), axisStyle).setOrigin(1, 0.5));
      for (let col = 1; col <= 12; col++) {
        const color = this.factStatusColor(r, col);
        const cell = this.add.graphics();
        cell.fillStyle(color, 1);
        cell.fillRoundedRect(startX + (col - 1) * cellSize + 2, rowY + 2, cellSize - 4, cellSize - 4, 4);
        this.contentContainer.add(cell);
      }
    }
    return startY + headerH + 12 * cellSize;
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

  // Two rows of two swatch+label pairs, centered, with the top at `top`.
  // Returns the y just below it.
  createMasteryLegend(top) {
    const items = [
      [GOLD, 'Automatic'],
      [SLOW_GREEN, 'Accurate, slow'],
      [0xffb142, 'Missed'],
      [0x2d2d44, 'Unseen'],
    ];
    const sw = 30;
    const swGap = 14;
    const colGap = 64;
    const rowH = 52;
    const labels = items.map(([, label]) => this.add.text(0, 0, label, style('caption', {
      fill: '#cfcfe0'
    })).setOrigin(0, 0.5));
    const colW = [0, 1].map(col => sw + swGap + Math.max(labels[col].width, labels[col + 2].width));
    const left = W / 2 - (colW[0] + colGap + colW[1]) / 2;
    items.forEach(([color], i) => {
      const x = left + (i % 2) * (colW[0] + colGap);
      const cy = top + Math.floor(i / 2) * rowH + rowH / 2;
      const g = this.add.graphics();
      g.fillStyle(color, 1);
      g.fillRoundedRect(x, cy - sw / 2, sw, sw, 5);
      this.contentContainer.add(g);
      labels[i].setPosition(x + sw + swGap, cy);
      this.contentContainer.add(labels[i]);
    });
    return top + 2 * rowH;
  }

  // ----- PACK & GO (Conveyor timing) -----
  // Surfaces the Chapter-3 instrumentation so the owner can resolve the
  // production-vs-recognition A/B and check that fast times reflect real recall
  // (not a position-guessing shortcut). One panel per input mode: the
  // correct-answer recall-time distribution (bucketed) + recognition's
  // dock-position-repeat rate (should sit near chance if randomization holds).
  showConveyorTab() {
    const cs = records.getConveyorStats();
    let y = 280;
    const heading = this.add.text(W / 2, y, 'Pack & Go: Recall Timing', style('subhead', {
      fontSize: '52px', fill: '#ffd86b'
    })).setOrigin(0.5, 0);
    this.contentContainer.add(heading);
    y += heading.height + 8;
    const explainer = this.add.text(W / 2, y,
      'Production = recall first (no options).\nRecognition = pick from 4.\nFast times in production reflect real recall; in recognition, many very-fast taps + a high dock-repeat can mean guessing by position.',
      style('body', {
        fill: '#cfcfe0', align: 'center', lineSpacing: 6,
        wordWrap: { width: 960, useAdvancedWrap: true }
      })).setOrigin(0.5, 0);
    this.contentContainer.add(explainer);
    y += explainer.height + 28;

    y = this.drawTimingPanel(y, 'Production (recall)', cs.production, cs.bucketLabels, false);
    y += 26;
    this.drawTimingPanel(y, 'Recognition (pick)', cs.recognition, cs.bucketLabels, true);
  }

  // Draws one mode's timing card with its top at yTop, laid out top-down so
  // the card grows to fit its text; returns the y just below it.
  drawTimingPanel(yTop, title, m, bucketLabels, isRecognition) {
    const w = 880;
    const pad = 28;
    const innerW = w - pad * 2;
    const hasData = m.count > 0;
    const accent = isRecognition ? ACCENT : GOLD;
    const bucketColors = [GOLD, SUCCESS, SLOW_GREEN, 0xffb142, WARN];

    const card = this.add.container(W / 2, yTop);
    const bg = this.add.graphics();
    card.add(bg);
    const finish = panelH => {
      bg.fillStyle(COLORS.bgPanel, 0.95);
      bg.fillRoundedRect(-w / 2, 0, w, panelH, 18);
      bg.lineStyle(3, accent, 0.85);
      bg.strokeRoundedRect(-w / 2, 0, w, panelH, 18);
      this.contentContainer.add(card);
      return yTop + panelH;
    };

    // Title, then the stats on their own row: side by side they overran the card.
    let y = 20;
    const titleText = this.add.text(-w / 2 + pad, y, title, style('subhead', {
      fontSize: '52px', fill: '#ffffff'
    }));
    card.add(titleText);
    y += titleText.height + 4;
    // A long line breaks between its parts, so "under 2.5s" never ends up alone.
    const parts = hasData
      ? [`${m.count} packed`, `avg ${(m.avgMs / 1000).toFixed(1)}s`, `${m.fastPct}% under 2.5s`]
      : ['no rounds yet'];
    const statsText = this.add.text(-w / 2 + pad, y, '', style('body', { fill: '#cfcfe0' }));
    const statLines = [];
    parts.forEach(part => {
      const joined = statLines.length ? `${statLines[statLines.length - 1]} · ${part}` : part;
      statsText.setText(joined);
      if (statLines.length && statsText.width <= innerW) statLines[statLines.length - 1] = joined;
      else statLines.push(part);
    });
    statsText.setText(statLines.join('\n'));
    card.add(statsText);
    y += statsText.height + 20;

    if (!hasData) {
      const empty = this.add.text(0, y, isRecognition ? 'Recognition mode not used yet.' : 'No production rounds recorded yet.', style('body', {
        fill: '#cfcfe0', align: 'center', wordWrap: { width: innerW, useAdvancedWrap: true }
      })).setOrigin(0.5, 0);
      card.add(empty);
      return finish(y + empty.height + 28);
    }

    // Stacked recall-time distribution bar.
    const barW = innerW;
    const barH = 56;
    const barX = -barW / 2;
    const barY = y;
    let cx = barX;
    const segG = this.add.graphics();
    card.add(segG);
    m.buckets.forEach((cnt, i) => {
      const segW = (cnt / m.count) * barW;
      if (segW > 0.5) {
        segG.fillStyle(bucketColors[i], 1);
        segG.fillRect(cx, barY, segW, barH);
        // The count only goes in when it fits inside its segment.
        const count = this.add.text(cx + segW / 2, barY + barH / 2, String(cnt), style('caption', {
          fill: '#0a0a18', fontStyle: '900'
        })).setOrigin(0.5);
        if (count.width + 12 <= segW) card.add(count);
        else count.destroy();
      }
      cx += segW;
    });
    const outline = this.add.graphics();
    outline.lineStyle(2, 0x3a3a55, 1);
    outline.strokeRect(barX, barY, barW, barH);
    card.add(outline);
    y = barY + barH + 18;

    // Bucket legend (swatch + label per bin, spread across the bar).
    const legendH = 44;
    const legendY = y + legendH / 2;
    const cellW = barW / bucketLabels.length;
    bucketLabels.forEach((lab, i) => {
      const lx = barX + cellW * i + 10;
      const sw = this.add.graphics();
      sw.fillStyle(bucketColors[i], 1);
      sw.fillRoundedRect(lx, legendY - 13, 26, 26, 4);
      card.add(sw);
      card.add(this.add.text(lx + 36, legendY, lab, style('caption', {
        fill: '#cfcfe0'
      })).setOrigin(0, 0.5));
    });
    y += legendH + 20;

    // Recognition: dock-position-repeat vs chance (4 docks ⇒ ~25%).
    if (isRecognition) {
      const chance = 25;
      const col = m.posTotal === 0 ? '#cfcfe0'
        : Math.abs(m.posRepeatPct - chance) <= 12 ? '#7ee08a'
        : m.posRepeatPct > chance ? '#ff6b6b' : '#f7dc6f';
      const txt = m.posTotal === 0
        ? 'Dock-position repeat: not yet\n(need more crates)'
        : `Dock-position repeat: ${m.posRepeatPct}%\n(random ≈ ${chance}%)`;
      const repeat = this.add.text(0, y, txt, style('body', {
        fill: col, align: 'center', wordWrap: { width: innerW, useAdvancedWrap: true }
      })).setOrigin(0.5, 0);
      card.add(repeat);
      y += repeat.height + 20;
    }

    return finish(y + 8);
  }

  // ----- SETTINGS -----
  showSettingsTab() {
    // Reset sits last, behind a wider gap, so the destructive button is kept
    // apart from Move to a New Device.
    let y = 360;
    this.addSettingButton(y, 'Move to a New Device', () => openTransferSheet(this), ACCENT); y += 130;
    this.addSettingButton(y, 'Change PIN', () => this.showChangePinDialog(), ACCENT); y += 130;
    this.addSettingButton(y, 'Lock Dashboard', () => {
      this.registry.set('parentPinVerified', false);
      this.scene.restart();
    }, 0x8888a0); y += 160;
    this.addSettingButton(y, 'Reset All Progress', () => this.showResetConfirmation(), WARN); y += 160;

    const heading = this.add.text(W / 2, y, 'About difficulty', style('subhead', {
      fontSize: '52px',
      fill: '#ffd86b'
    })).setOrigin(0.5, 0);
    this.contentContainer.add(heading);
    y += heading.height + 12;
    const about = this.add.text(W / 2, y,
      'The game adapts to your child automatically: facts they miss resurface more often, and timing scales with the world they\'re in.',
      style('body', {
        fill: '#cfcfe0',
        align: 'center',
        lineSpacing: 8,
        wordWrap: { width: 900, useAdvancedWrap: true }
      })).setOrigin(0.5, 0);
    this.contentContainer.add(about);
    y += about.height + 64;

    // The Chapter 3 city map is traced from OpenStreetMap data, which asks
    // for this credit. Kept to one quiet line at the label size.
    this.contentContainer.add(this.add.text(W / 2, y, 'Map data © OpenStreetMap contributors', style('caption', {
      align: 'center'
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
      fontSize: '42px',
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

  // Two steps, new PIN then the same again, so one typo can't lock anyone
  // out. No old PIN is asked for: only someone already inside gets here.
  showChangePinDialog() {
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.85).setDepth(50).setInteractive();
    const c = this.add.container(W / 2, H / 2).setDepth(51);
    // Wide enough that the error notes stay on one line above the keypad.
    const w = 840;
    const h = 1240;
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.bgPanel, 0.98);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 22);
    bg.lineStyle(3, ACCENT, 0.9);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 22);
    c.add(bg);
    c.add(this.add.text(0, -h / 2 + 85, 'Change PIN', style('display', {
      fontSize: '52px',
      fill: '#ffd86b'
    })).setOrigin(0.5));
    const prompt = this.add.text(0, -h / 2 + 155, 'Enter a new 4-digit PIN', menuStyle('body'))
      .setOrigin(0.5);
    c.add(prompt);

    let first = null;
    let digits = '';
    const dots = createPinDots(this, { y: -h / 2 + 270 });
    c.add(dots.view);
    const note = this.add.text(0, -h / 2 + 350, '', menuStyle('caption', {
      fill: '#ff6b6b', align: 'center', wordWrap: { width: w - 80, useAdvancedWrap: true },
    })).setOrigin(0.5);
    c.add(note);

    c.add(createPinKeypad(this, {
      y: -150,
      onDigit: digit => {
        if (digits.length >= 4) return;
        digits += digit;
        dots.set(digits.length);
      },
      onClear: () => {
        digits = '';
        dots.set(0);
      },
      onBackspace: () => {
        digits = digits.slice(0, -1);
        dots.set(digits.length);
      },
    }));

    const cleanup = () => {
      overlay.destroy();
      c.destroy();
    };
    let go = null;
    const setGoLabel = text => go?.list.find(o => o.type === 'Text')?.setText(text);
    const startOver = message => {
      first = null;
      digits = '';
      dots.set(0);
      prompt.setText('Enter a new 4-digit PIN');
      setGoLabel('Next');
      note.setText(message);
    };

    c.add(createButton(this, {
      x: -150, y: h / 2 - 100, label: 'Cancel',
      width: 270, height: 100, color: 0x4a4a6a,
      textOverrides: BUTTON_TEXT,
      onClick: cleanup
    }));
    // One button: Next on the first step, Save on the second.
    go = createButton(this, {
      x: 150, y: h / 2 - 100, label: 'Next',
      width: 270, height: 100, color: SUCCESS,
      textOverrides: BUTTON_TEXT,
      onClick: () => {
        if (digits.length !== 4) return;
        if (first === null) {
          first = digits;
          digits = '';
          dots.set(0);
          note.setText('');
          prompt.setText('Type it again to be sure');
          setGoLabel('Save');
        } else if (digits !== first) {
          startOver('Those didn\'t match. Try again.');
        } else if (!setPin(deviceStorage(), digits, Date.now())) {
          startOver('This device could not save the PIN.');
        } else {
          cleanup();
          this.flashMessage('PIN updated', SUCCESS);
        }
      }
    });
    c.add(go);
  }

  showResetConfirmation() {
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.85).setDepth(50).setInteractive();
    const c = this.add.container(W / 2, H / 2).setDepth(51);
    // Wide enough for the warning's own line breaks at body size.
    const w = 900;
    const bg = this.add.graphics();
    c.add(bg);
    const title = this.add.text(0, 0, 'Reset All Progress?', style('display', {
      fontSize: '52px',
      fill: '#ff6b6b'
    })).setOrigin(0.5, 0);
    const warning = this.add.text(0, 0,
      'This will delete ALL game progress:\nlevels, stars, pet, ship, and learning data.\n\nThis cannot be undone.',
      style('body', {
        fill: '#cfcfe0',
        align: 'center',
        lineSpacing: 8,
        wordWrap: { width: w - 80, useAdvancedWrap: true }
      })).setOrigin(0.5, 0);
    c.add([title, warning]);
    // The card grows to fit the warning: title, warning, then the buttons.
    const btnH = 88;
    const h = 48 + title.height + 28 + warning.height + 44 + btnH + 44;
    title.y = -h / 2 + 48;
    warning.y = title.y + title.height + 28;
    const btnY = h / 2 - 44 - btnH / 2;
    bg.fillStyle(COLORS.bgPanel, 0.98);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 22);
    bg.lineStyle(3, WARN, 0.9);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 22);

    const cleanup = () => {
      overlay.destroy();
      c.destroy();
    };

    c.add(createButton(this, {
      x: -150, y: btnY, label: 'Cancel',
      width: 260, height: btnH, color: ACCENT,
      textOverrides: BUTTON_TEXT,
      onClick: cleanup
    }));
    // Dark ink: white on this light coral is only about 3:1.
    c.add(createButton(this, {
      x: 150, y: btnY, label: 'Reset',
      width: 260, height: btnH, color: WARN,
      textOverrides: { ...BUTTON_TEXT, fill: '#0a0a1a' },
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
      fontSize: '42px',
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
