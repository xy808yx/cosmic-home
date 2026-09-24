// Full-screen tabbed shop. Tabs: Style (pet hats+accessories), Auras, Engine
// Trails, Paint, Ship Parts. Each tab renders a 2-column grid of item cards
// with live preview.

import Phaser from 'phaser';
import { audio } from '../AudioManager.js';
import { music } from '../MusicManager.js';
import { TransitionManager } from '../TransitionManager.js';
import { createStarfield } from '../starfieldHelper.js';
import { createIconButton } from '../buttonHelper.js';
import { style } from '../textStyles.js';
import { economy } from '../EconomyManager.js';
import { ship, SHIP_PARTS } from '../ShipManager.js';
import { drawShip } from '../ShipRenderer.js';
import { cosmetics, PET_COSMETICS } from '../CosmeticManager.js';
import { drawCompanion } from '../PetRenderer.js';
import { companion } from '../CompanionManager.js';
import { createButton } from '../buttonHelper.js';
import {
  drawArrowLeftIcon, drawSparkleIcon, drawCheckIcon
} from '../StatIcons.js';
import { RARITY_COLOR, RARITY_LABEL, rarityOf, compareForShop } from '../Rarity.js';
import { COLORS } from '../colorPalette.js';
import { createModal } from '../modalHelper.js';

const W = 1080;
const H = 1920;
// A shop row is never shorter than this, even when its cards need less.
const CARD_MIN_H = 380;

const TABS = [
  { id: 'style',   label: 'TOYS',   accent: 0xffd86b, kind: 'pet' },
  { id: 'aura',    label: 'AURAS',  accent: 0xb6e0ff, kind: 'pet' },
  { id: 'trail',   label: 'TRAILS', accent: 0xff8b3d, kind: 'ship' },
  { id: 'paint',   label: 'PAINT',  accent: 0xff5b6e, kind: 'ship' },
  { id: 'parts',   label: 'PARTS',  accent: 0x4ecdc4, kind: 'ship' }
];

const TAB_BY_ID = Object.fromEntries(TABS.map(t => [t.id, t]));

// Generic flavor line shown when an item has no explicit `desc` field.
function rarityFlavor(rarity) {
  switch (rarity) {
    case 'legendary': return 'A true cosmic rarity.';
    case 'rare':      return 'Catches the eye.';
    case 'common':
    default:          return 'A reliable choice.';
  }
}

export class ShopScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ShopScene' });
  }

  create() {
    audio.init();
    music.ensurePlaying(this);
    createStarfield(this, { width: W, height: H, accentStrength: 0 });

    this.activeTab = 'style';
    this.cardObjects = [];

    this.createHeader();
    this.createScrollViewport();
    this.createTabBar();
    this.createBalanceFooter();
    this.renderActiveTab();
    this.installScrollControls();

    new TransitionManager(this).fadeIn(280);
  }

  // Scrollable area lives between the tab bar and the balance footer.
  // Cards render into `scrollLayer`; `scrollMask` clips so cards never
  // visually punch through the tabs (which sit on a higher depth + opaque bg).
  createScrollViewport() {
    this.scrollTop = 360;
    this.scrollBottom = 1780;
    this.scrollLayer = this.add.container(0, 0).setDepth(11);

    const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRect(0, this.scrollTop, W, this.scrollBottom - this.scrollTop);
    this.scrollLayer.setMask(maskShape.createGeometryMask());

    this.scrollOffset = 0;
    this.scrollMaxOffset = 0;
  }

  createHeader() {
    const bg = this.add.graphics().setDepth(10);
    bg.fillStyle(COLORS.bgDark, 0.95);
    bg.fillRect(0, 0, W, 240);

    createIconButton(this, {
      x: 90, y: 90, radius: 38,
      accentColor: COLORS.accentPurple,
      drawIcon: (g, size) => drawArrowLeftIcon(g, 0, 0, size),
      onClick: () => {
        audio.playClick();
        new TransitionManager(this).fadeToScene('WorldMapScene');
      }
    }).setDepth(15);

    this.add.text(W / 2, 90, 'SHOP', style('display', {
      fontSize: '64px',
      fill: '#ffffff'
    })).setOrigin(0.5).setDepth(14);

    this.createPlayerAvatar();
  }

  // Side-by-side preview of currently-equipped pet and ship, top-right.
  // Separate badges so the player can clearly read each layer of cosmetics
  // they have equipped: no need to squint at the porthole.
  createPlayerAvatar() {
    const radius = 65;
    // Sits high enough that the PET / SHIP captions clear the badge halo and
    // still end above the tab strip at y=240.
    const cy = 112;
    const petCx = W - 230;
    const shipCx = W - 90;

    this.petBadge = this.makeAvatarBadge(petCx, cy, radius, COLORS.accentWarm, 'PET');
    this.shipBadge = this.makeAvatarBadge(shipCx, cy, radius, COLORS.accentPurple, 'SHIP');

    this.refreshPlayerAvatar();
  }

  makeAvatarBadge(cx, cy, radius, accent, label) {
    const container = this.add.container(cx, cy).setDepth(15);

    const halo = this.add.graphics();
    halo.fillStyle(accent, 0.22);
    halo.fillCircle(0, 0, radius + 8);
    container.add(halo);

    const bgCircle = this.add.graphics();
    bgCircle.fillStyle(COLORS.bgDark, 0.95);
    bgCircle.fillCircle(0, 0, radius);
    bgCircle.lineStyle(3, accent, 0.9);
    bgCircle.strokeCircle(0, 0, radius);
    container.add(bgCircle);

    const preview = this.add.container(0, 0);
    container.add(preview);

    const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillCircle(cx, cy, radius - 4);
    preview.setMask(maskShape.createGeometryMask());

    container.preview = preview;
    container.accent = accent;

    // Caption strip just below the badge (label tier, clear of the halo)
    container.add(this.add.text(0, radius + 30, label, style('caption', {
      fontSize: '36px',
      fill: '#ffffff',
      fontStyle: '900',
      stroke: '#0a0a18',
      strokeThickness: 3
    })).setOrigin(0.5));

    return container;
  }

  refreshPlayerAvatar() {
    // Pet: show as it would appear in the world, with all equipped cosmetics
    if (this.petBadge) {
      this.petBadge.preview.removeAll(true);
      if (companion.hasStarter()) {
        const pet = drawCompanion(this, 0, 8, {
          scale: 0.85,
          preview: true,
          cosmeticsOverride: cosmetics.getEquipped()
        });
        this.petBadge.preview.add(pet);
      }
    }

    // Ship: equipped parts, no trail, no pet inside the porthole (this is
    // about the ship loadout itself, not the composite portrait).
    if (this.shipBadge) {
      this.shipBadge.preview.removeAll(true);
      const shipG = drawShip(this, 0, 8, {
        scale: 0.85,
        parts: ship.getCurrentParts(),
        showTrail: false
      });
      this.shipBadge.preview.add(shipG);
    }
  }

  createTabBar() {
    const tabY = 280;
    const tabH = 80;
    const gap = 8;

    // Solid backing strip behind tabs so scrolling cards never bleed through.
    const backing = this.add.graphics().setDepth(28);
    backing.fillStyle(COLORS.bgDark, 1);
    backing.fillRect(0, 240, W, 110);
    backing.fillStyle(COLORS.bgDark, 0.6);
    backing.fillRect(0, 350, W, 12);

    // Tab labels are button labels (42). Every tab takes the width of the
    // widest label plus padding, capped so all five fit inside a 16px gutter.
    // If a wider device font still can't fit, the labels drop to the 36 floor.
    const labels = TABS.map(tab => this.add.text(0, 0, tab.label, style('caption', {
      fontSize: '42px',
      fill: '#ffffff',
      fontStyle: '900'
    })).setOrigin(0.5));
    const widest = () => Math.max(...labels.map(l => l.width));
    const maxTabW = Math.floor((W - 32 - (TABS.length - 1) * gap) / TABS.length);
    const tabW = Math.min(maxTabW, Math.max(180, Math.ceil(widest()) + 48));
    if (widest() + 24 > tabW) labels.forEach(l => l.setFontSize('36px'));
    const totalW = TABS.length * tabW + (TABS.length - 1) * gap;
    const startX = W / 2 - totalW / 2 + tabW / 2;

    this.tabContainers = {};
    TABS.forEach((tab, i) => {
      const x = startX + i * (tabW + gap);
      const c = this.add.container(x, tabY).setDepth(30);

      const bg = this.add.graphics();
      c.add(bg);
      const label = labels[i];
      c.add(label);

      const hit = this.add.rectangle(0, 0, tabW, tabH, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      c.add(hit);
      hit.on('pointerdown', () => this.switchTab(tab.id));

      c.bg = bg;
      c.label = label;
      c.tab = tab;
      c.tabW = tabW;
      c.tabH = tabH;
      this.tabContainers[tab.id] = c;
    });

    this.refreshTabBar();
  }

  refreshTabBar() {
    Object.values(this.tabContainers).forEach(c => {
      const isActive = c.tab.id === this.activeTab;
      c.bg.clear();
      c.bg.fillStyle(isActive ? c.tab.accent : 0x1a1a30, isActive ? 0.95 : 0.85);
      c.bg.fillRoundedRect(-c.tabW / 2, -c.tabH / 2, c.tabW, c.tabH, 16);
      c.bg.lineStyle(2, c.tab.accent, isActive ? 1 : 0.5);
      c.bg.strokeRoundedRect(-c.tabW / 2, -c.tabH / 2, c.tabW, c.tabH, 16);
      c.label.setColor(isActive ? '#0a0a1a' : '#ffffff');
    });
  }

  switchTab(tabId) {
    if (this.activeTab === tabId) return;
    audio.playClick();
    this.activeTab = tabId;
    this.refreshTabBar();
    this.renderActiveTab({ resetScroll: true });
  }

  installScrollControls() {
    // Mouse wheel: works regardless of cursor position
    this.input.on('wheel', (_pointer, _objs, _dx, dy) => {
      this.applyScroll(dy);
    });

    // Touch / mouse drag: listen scene-wide so drag works even when the
    // pointer starts ON a card. Cards check `this.dragMoved` before firing
    // their tap, so a swipe scrolls instead of triggering buy/equip.
    this.dragMoved = false;
    let dragging = false;
    let startY = 0;
    let lastY = 0;
    const DRAG_THRESHOLD = 6;

    this.input.on('pointerdown', (p) => {
      if (!this.isPointerInScrollViewport(p)) {
        dragging = false;
        return;
      }
      dragging = true;
      startY = p.y;
      lastY = p.y;
      this.dragMoved = false;
    });

    this.input.on('pointermove', (p) => {
      if (!dragging) return;
      const dy = lastY - p.y;
      lastY = p.y;
      if (Math.abs(p.y - startY) > DRAG_THRESHOLD) {
        this.dragMoved = true;
      }
      if (this.dragMoved) this.applyScroll(dy);
    });

    const release = () => {
      dragging = false;
      // Reset next tick so card pointerup handlers can still read dragMoved
      this.time.delayedCall(0, () => { this.dragMoved = false; });
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  applyScroll(dy) {
    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset + dy, 0, this.scrollMaxOffset);
    this.scrollLayer.y = -this.scrollOffset;
  }

  isPointerInScrollViewport(pointer) {
    return pointer.x >= 0 && pointer.x <= W
      && pointer.y >= this.scrollTop && pointer.y <= this.scrollBottom;
  }

  // ============================================================
  // GRID RENDERING
  // ============================================================
  renderActiveTab({ resetScroll = false } = {}) {
    // Wipe existing cards
    this.cardObjects.forEach(o => o.destroy());
    this.cardObjects = [];

    const items = this.itemsForTab(this.activeTab);

    // Two wide cards per row so names, flavor lines and price pills can read
    // at full size. Card height follows the text: each row is as tall as its
    // tallest card, and both cards in a row share that height.
    const cols = 2;
    const cardW = 496;
    const gapX = 24;
    const gapY = 28;
    const startX = W / 2 - (cols * cardW + (cols - 1) * gapX) / 2 + cardW / 2;
    // Place the first row just inside the scroll viewport.
    let rowTop = this.scrollTop + 20;

    const cards = items.map(item => this.makeShopCard(item, this.activeTab, cardW));
    for (let r = 0; r < cards.length; r += cols) {
      const row = cards.slice(r, r + cols);
      const rowH = Math.ceil(Math.max(CARD_MIN_H, ...row.map(card => card.minH || 0)));
      row.forEach((card, col) => {
        card.layoutTo?.(rowH);
        card.x = startX + col * (cardW + gapX);
        card.y = rowTop + rowH / 2;
        this.scrollLayer.add(card);
        this.cardObjects.push(card);
      });
      rowTop += rowH + gapY;
    }

    // Compute scroll bounds: total content extent minus visible viewport.
    const contentBottom = rowTop - gapY;
    this.scrollMaxOffset = Math.max(0, contentBottom - this.scrollBottom + 40);
    this.scrollOffset = resetScroll ? 0 : this.scrollOffset;
    this.applyScroll(0);
  }

  itemsForTab(tabId) {
    const items = (() => {
      switch (tabId) {
        case 'trail': return SHIP_PARTS.filter(p => p.slot === 'trail');
        case 'paint': return SHIP_PARTS.filter(p => p.slot === 'paint');
        case 'parts': return SHIP_PARTS.filter(p =>
          (p.slot === 'hull' || p.slot === 'wings' || p.slot === 'addon') && !p.isDefault);
        case 'aura':  return PET_COSMETICS.filter(p => p.slot === 'aura');
        case 'style': return PET_COSMETICS.filter(p => p.slot === 'hat' || p.slot === 'accessory');
        default:      return [];
      }
    })();
    // Sort by ownership status first (equipped → owned → affordable → locked),
    // then by rarity within each group. Keeps the most actionable items at top.
    const isPetTab = TAB_BY_ID[tabId]?.kind === 'pet';
    const equippedMap = isPetTab ? cosmetics.getEquipped() : ship.getCurrentParts();
    const ownsFn = isPetTab ? id => cosmetics.ownsItem(id) : id => ship.ownsPart(id);
    // Unlock-only items stay hidden from the shop until earned in-game.
    const visibleItems = items.filter(it => !it.unlock_only || ownsFn(it.id));
    const ranked = visibleItems.map(item => {
      let rank = 3;
      if (equippedMap[item.slot] === item.id) rank = 0;
      else if (ownsFn(item.id)) rank = 1;
      else if (economy.canAfford(item.price)) rank = 2;
      return { item, rank };
    });
    ranked.sort((a, b) => a.rank - b.rank || compareForShop(a.item, b.item));
    return ranked.map(r => r.item);
  }

  // Builds a card at width `w`. Its text is measured here and `minH` is the
  // height it needs; the grid then calls `layoutTo(h)` with the row height,
  // which draws the panel and places everything top-down (pill pinned to the
  // bottom) so both cards in a row line up.
  makeShopCard(item, tabId, w) {
    const c = this.add.container(0, 0).setDepth(12);

    const isPetItem = TAB_BY_ID[tabId]?.kind === 'pet';
    const isShipItem = !isPetItem;
    const owned = isShipItem ? ship.ownsPart(item.id) : cosmetics.ownsItem(item.id);
    const equipped = isShipItem
      ? ship.getCurrentParts()[item.slot] === item.id
      : cosmetics.getEquipped()[item.slot] === item.id;
    const canAfford = economy.canAfford(item.price);
    const rarity = rarityOf(item);
    const rarityColor = RARITY_COLOR[rarity];

    let borderColor = rarityColor;
    if (equipped) borderColor = COLORS.success;
    else if (owned) borderColor = COLORS.accentTeal;

    const PAD = 16;          // panel edge to chip / pill
    const TEXT_W = w - 48;   // wrap width for the name and flavor line
    const ART_H = 200;       // band under the chip that holds the preview

    // Panel layers come first so the art and text stay on top of them. They
    // are drawn in layoutTo() once the row height is known.
    let halo = null;
    if (rarity === 'legendary') {
      halo = this.add.graphics();
      c.add(halo);
      this.tweens.add({
        targets: halo, alpha: { from: 0.18, to: 0.45 },
        duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    }

    const bg = this.add.graphics();
    c.add(bg);

    // Status wash so equipped vs owned reads at a glance, not just on the border.
    const wash = (equipped || owned) ? this.add.graphics() : null;
    if (wash) c.add(wash);

    // Rare items pulse the border
    if (rarity === 'rare' && !equipped && !owned) {
      this.tweens.add({
        targets: bg, alpha: { from: 0.7, to: 1 },
        duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    }

    // Rarity chip top-left, sized from its label
    const chip = this.add.graphics();
    c.add(chip);
    const chipLabel = this.add.text(0, 0, RARITY_LABEL[rarity], style('caption', {
      fontSize: '36px', fill: '#0a0a1a', fontStyle: '900'
    })).setOrigin(0.5);
    c.add(chipLabel);
    const chipW = Math.ceil(chipLabel.width) + 32;
    const chipH = Math.ceil(chipLabel.height) + 10;

    // Preview area: actually render the cosmetic ON the pet (or ship) so the
    // card shows what you'd be buying, not just a base pet next to a color dot.
    // Scaled up with the wider 2-column card so the art still fills its band.
    let preview;
    if (isPetItem) {
      const previewCosmetics = { ...cosmetics.getEquipped(), [item.slot]: item.id };
      preview = drawCompanion(this, 0, 0, {
        scale: 0.9,
        preview: true,
        cosmeticsOverride: previewCosmetics
      });
    } else {
      const previewParts = { ...ship.getCurrentParts(), [item.slot]: item.id };
      preview = drawShip(this, 0, 0, { scale: 1.05, parts: previewParts, showTrail: tabId === 'trail' });
    }
    c.add(preview);

    // Name (a name inside a card: heading tier)
    const nameText = this.add.text(0, 0, item.name, style('subhead', {
      fontSize: '52px',
      fill: '#ffffff',
      align: 'center',
      wordWrap: { width: TEXT_W }
    })).setOrigin(0.5, 0);
    c.add(nameText);

    // Flavor line under the name (falls back to a generic line by rarity).
    const descText = this.add.text(0, 0, item.desc || rarityFlavor(rarity), style('body', {
      fill: '#cfcfe0',
      align: 'center',
      wordWrap: { width: TEXT_W },
      fontStyle: 'italic'
    })).setOrigin(0.5, 0);
    c.add(descText);

    // Status / price pill, sized from its label. It is the card's action, so
    // it reads at button size.
    let badgeText = '';
    let badgeColor = COLORS.accentTeal;
    let badgeFill = '#0a0a1a';
    const lockedFill = '#cfcfe0';
    // Default items can't be "unequipped": they ARE the unequipped state.
    const isDefault = !!item.isDefault;
    if (equipped && isDefault) { badgeText = 'EQUIPPED'; badgeColor = COLORS.success; }
    else if (equipped) { badgeText = 'TAP TO UNEQUIP'; badgeColor = COLORS.success; }
    else if (owned) { badgeText = 'TAP TO EQUIP'; badgeColor = COLORS.accentTeal; }
    else if (item.unlock_only) { badgeText = '??? · UNLOCK BY PLAYING'; badgeColor = 0x3a3a4a; badgeFill = lockedFill; }
    else if (item.price === 0) { badgeText = 'FREE'; badgeColor = COLORS.accentPurple; }
    else { badgeText = `${item.price} STARDUST`; badgeColor = canAfford ? COLORS.accentPurple : 0x3a3a4a; if (!canAfford) badgeFill = lockedFill; }

    const badge = this.add.graphics();
    c.add(badge);
    const pillMaxW = w - PAD * 2;
    const badgeLabel = this.add.text(0, 0, badgeText, style('caption', {
      fontSize: '42px',
      fill: badgeFill,
      fontStyle: '900',
      align: 'center',
      wordWrap: { width: pillMaxW - 40 }
    })).setOrigin(0.5);
    c.add(badgeLabel);
    const pillW = Math.min(pillMaxW, Math.ceil(badgeLabel.width) + 56);
    const pillH = Math.ceil(badgeLabel.height) + 22;

    let checkG = null;
    if (equipped) {
      checkG = this.add.graphics();
      drawCheckIcon(checkG, 0, 0, 22);
      c.add(checkG);
    }

    c.minH = PAD + chipH + ART_H
      + nameText.height + 6 + descText.height
      + 20 + pillH + PAD;

    c.layoutTo = (h) => {
      const top = -h / 2;

      if (halo) {
        halo.fillStyle(rarityColor, 0.18);
        halo.fillRoundedRect(-w / 2 - 12, -h / 2 - 12, w + 24, h + 24, 22);
      }

      bg.fillStyle(COLORS.bgPanel, 0.95);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
      bg.lineStyle(equipped || owned ? 4 : 3, borderColor, owned || canAfford ? 1 : 0.7);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);

      if (wash) {
        wash.fillStyle(equipped ? COLORS.success : COLORS.accentTeal, equipped ? 0.12 : 0.08);
        wash.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
      }

      chip.fillStyle(rarityColor, 0.95);
      chip.fillRoundedRect(-w / 2 + PAD, top + PAD, chipW, chipH, chipH / 2);
      chipLabel.setPosition(-w / 2 + PAD + chipW / 2, top + PAD + chipH / 2);
      if (checkG) {
        checkG.x = w / 2 - 36;
        checkG.y = top + PAD + chipH / 2;
      }

      const artTop = top + PAD + chipH;
      // Trails stream down from the ship, so the ship rides high in the band
      // and its trail fades out above the name instead of running through it.
      preview.y = artTop + (tabId === 'trail' ? 66 : ART_H / 2);

      nameText.y = artTop + ART_H;
      descText.y = nameText.y + nameText.height + 6;

      const badgeY = h / 2 - PAD - pillH / 2;
      badge.fillStyle(badgeColor, 0.95);
      badge.fillRoundedRect(-pillW / 2, badgeY - pillH / 2, pillW, pillH, Math.min(pillH / 2, 36));
      badgeLabel.y = badgeY;

      hit.setSize(w, h);
      if (hit.input) hit.input.hitArea.setTo(0, 0, w, h);
    };

    // Locked items (unowned + can't afford OR unlock-only) dim their artwork
    // only. The name, flavor line and price stay at full strength so they
    // can still be read.
    if ((!owned && !canAfford && item.price > 0) || (!owned && item.unlock_only)) {
      preview.setAlpha(0.55);
    }

    // The tap area is the card's last child, sized to minH until the grid
    // calls layoutTo() with the row height.
    const hit = this.add.rectangle(0, 0, w, c.minH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    c.add(hit);
    // Fire only on a complete down→up on the same card. Without the pressed
    // gate, a phantom pointerup landing on a freshly-rendered card after a
    // purchase rebuild would trigger another handleTap. The scene-wide drag
    // tracker still suppresses taps that turn into a swipe.
    // Geometry masks clip the artwork, so input also checks the visible area.
    let pressedPointer = null;
    hit.on('pointerdown', pointer => {
      pressedPointer = this.isPointerInScrollViewport(pointer) ? pointer.id : null;
    });
    hit.on('pointerup', pointer => {
      const wasPressed = pressedPointer !== null && pressedPointer === pointer.id;
      pressedPointer = null;
      if (this.dragMoved || !wasPressed || !this.isPointerInScrollViewport(pointer)) return;
      this.handleTap(item, tabId, owned, equipped, canAfford);
    });
    hit.on('pointerover', pointer => {
      if (this.isPointerInScrollViewport(pointer)) {
        this.tweens.add({ targets: c, scale: 1.03, duration: 100 });
      }
    });
    hit.on('pointerout', () => {
      pressedPointer = null;
      this.tweens.add({ targets: c, scale: 1, duration: 100 });
    });

    return c;
  }

  handleTap(item, tabId, owned, equipped, canAfford) {
    const isPetItem = TAB_BY_ID[tabId]?.kind === 'pet';
    const isShipItem = !isPetItem;

    // Tap an equipped non-default item → unequip (resets to default or null).
    if (equipped) {
      audio.playClick();
      if (item.isDefault) return; // already at default; nothing to unequip
      if (isShipItem) ship.unequipSlot(item.slot);
      else cosmetics.unequipSlot(item.slot);
      this.refreshBalance();
      this.renderActiveTab();
      this.refreshPlayerAvatar();
      return;
    }

    if (owned) {
      audio.playClick();
      if (isShipItem) ship.equipPart(item.id);
      else cosmetics.equipItem(item.id);
      this.refreshBalance();
      this.renderActiveTab();
      this.refreshPlayerAvatar();
      return;
    }
    if (item.price > 0 && !canAfford) {
      audio.playClick();
      return;
    }

    // Unlock-only items: can't be bought, can't be claimed. Just acknowledge.
    if (item.unlock_only) {
      audio.playClick();
      return;
    }

    // Free items (price 0, but not isDefault): claim instantly, no confirm.
    if (item.price === 0) {
      audio.playClick();
      if (isShipItem) ship.addAndEquip(item.id);
      else cosmetics.addAndEquip(item.id);
      this.refreshBalance();
      this.renderActiveTab();
      this.refreshPlayerAvatar();
      return;
    }

    // Paid purchase: confirm before spending.
    audio.playClick();
    this.showPurchaseConfirm(item, tabId);
  }

  showPurchaseConfirm(item, tabId) {
    const mw = 760;

    // Text is built first and measured, so the card grows to fit it and the
    // buttons always sit below the balance line. The question is the moment's
    // title (64), a step above the item name (52) under it.
    const title = this.add.text(0, 0, 'Buy this item?', style('display', {
      fontSize: '64px', fill: '#ffffff',
      align: 'center', wordWrap: { width: mw - 80 }
    })).setOrigin(0.5, 0);

    const nameText = this.add.text(0, 0, item.name, style('subhead', {
      fontSize: '52px', fill: '#cfcfe0', fontStyle: '900',
      align: 'center', wordWrap: { width: mw - 80 }
    })).setOrigin(0.5, 0);

    // Stardust price chip, same visual language as the summary chip.
    const priceLabel = this.add.text(0, 0, `${item.price} STARDUST`, style('subhead', {
      fontSize: '42px', fill: '#ffffff', fontStyle: '900',
      stroke: '#0a0a18', strokeThickness: 3
    })).setOrigin(0, 0.5);

    // Balance after purchase
    const remaining = economy.getStardust() - item.price;
    const balanceText = this.add.text(0, 0, `Balance after: ${remaining}`, style('body', {
      fill: '#cfcfe0'
    })).setOrigin(0.5, 0);

    const iconBoxW = 50;
    const gap = 14;
    const totalW = iconBoxW + gap + priceLabel.width;
    const groupLeft = -totalW / 2;
    const chipW = Math.max(360, totalW + 80);
    const chipH = Math.max(80, Math.ceil(priceLabel.height) + 24);
    const r = chipH / 2;
    const btnH = 92;

    const mh = Math.ceil(48 + title.height + 20 + nameText.height + 36
      + chipH + 28 + balanceText.height + 44 + btnH + 44);

    const { card: modal, overlay, close } = createModal(this, {
      width: mw, height: mh,
      depth: 80,
      overlayAlpha: 0.7,
      accentColor: COLORS.accentPurple,
      showCloseHint: false,
    });
    // Dim the shop behind the popup so the popup reads on its own. The fade
    // runs on the fill, so the backdrop blocks taps from the first frame.
    overlay.fillAlpha = 0;
    this.tweens.add({ targets: overlay, fillAlpha: 0.7, duration: 200 });

    title.y = -mh / 2 + 48;
    modal.add(title);

    nameText.y = title.y + title.height + 20;
    modal.add(nameText);

    const chipY = nameText.y + nameText.height + 36 + chipH / 2;

    const chipHalo = this.add.graphics();
    chipHalo.fillStyle(COLORS.accentPurple, 0.20);
    chipHalo.fillRoundedRect(-chipW / 2 - 8, chipY - chipH / 2 - 4, chipW + 16, chipH + 8, r + 4);
    modal.add(chipHalo);

    const chipBg = this.add.graphics();
    chipBg.fillStyle(COLORS.bgTrack, 1);
    chipBg.fillRoundedRect(-chipW / 2, chipY - chipH / 2, chipW, chipH, r);
    chipBg.fillStyle(0xffffff, 0.06);
    chipBg.fillRoundedRect(-chipW / 2 + 4, chipY - chipH / 2 + 3, chipW - 8, chipH * 0.30, {
      tl: r - 2, tr: r - 2, bl: 6, br: 6
    });
    chipBg.lineStyle(2, COLORS.accentPurple, 0.85);
    chipBg.strokeRoundedRect(-chipW / 2, chipY - chipH / 2, chipW, chipH, r);
    modal.add(chipBg);

    const sparkle = this.add.graphics();
    drawSparkleIcon(sparkle, 0, 0, 26, COLORS.accentPurple);
    sparkle.x = groupLeft + iconBoxW / 2;
    sparkle.y = chipY;
    modal.add(sparkle);

    priceLabel.x = groupLeft + iconBoxW + gap;
    priceLabel.y = chipY;
    modal.add(priceLabel);

    balanceText.y = chipY + chipH / 2 + 28;
    modal.add(balanceText);

    const btnY = mh / 2 - 44 - btnH / 2;
    modal.add(createButton(this, {
      x: -160, y: btnY, width: 280, height: btnH,
      label: 'Cancel',
      color: 0x4a4a6a,
      onClick: close
    }));

    modal.add(createButton(this, {
      x: 160, y: btnY, width: 280, height: btnH,
      label: 'Buy',
      color: COLORS.accentPurple,
      onClick: () => {
        close();
        if (!economy.spendStardust(item.price)) return;
        const isPetItem = TAB_BY_ID[tabId]?.kind === 'pet';
        if (isPetItem) cosmetics.addAndEquip(item.id);
        else ship.addAndEquip(item.id);
        audio.playLevelComplete?.();
        this.refreshBalance();
        this.renderActiveTab();
        this.refreshPlayerAvatar();
      }
    }));

    modal.setScale(0);
    this.tweens.add({ targets: modal, scale: 1, duration: 250, ease: 'Back.easeOut' });
  }

  // ============================================================
  // BALANCE FOOTER
  // ============================================================
  createBalanceFooter() {
    const bg = this.add.graphics().setDepth(15);
    bg.fillStyle(COLORS.bgDark, 0.92);
    bg.fillRect(0, H - 110, W, 110);

    const c = this.add.container(W / 2, H - 55).setDepth(16);
    this.balanceSparkle = this.add.graphics();
    drawSparkleIcon(this.balanceSparkle, 0, 0, 22);
    c.add(this.balanceSparkle);

    this.balanceText = this.add.text(0, 0, '', style('subhead', {
      fontSize: '42px',
      fill: '#c77eff',
      fontStyle: '900'
    })).setOrigin(0, 0.5);
    c.add(this.balanceText);
    this.refreshBalance();
  }

  // The sparkle and the amount are centered as one group, so the icon keeps
  // its spacing however wide the number gets.
  refreshBalance() {
    if (!this.balanceText) return;
    this.balanceText.setText(`${economy.getStardust()} STARDUST`);
    const iconW = 28;
    const gap = 14;
    const left = -(iconW + gap + this.balanceText.width) / 2;
    this.balanceSparkle.x = left + iconW / 2;
    this.balanceText.x = left + iconW + gap;
  }
}
