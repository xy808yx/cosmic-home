import Phaser from 'phaser';
import { loadBrandFonts } from './CosmicBrand.js';
import { BootScene } from './scenes/BootScene.js';
import { WorldMapScene } from './scenes/WorldMapScene.js';
import { LevelSelectScene } from './scenes/LevelSelectScene.js';
import { GameScene } from './scenes/GameScene.js';
import { ParentDashboardScene } from './scenes/ParentDashboardScene.js';
import { StarterPickerScene } from './scenes/StarterPickerScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { RecordsScene } from './scenes/RecordsScene.js';
import { CreditsScene } from './scenes/CreditsScene.js';
import { HiddenWorldScene } from './scenes/HiddenWorldScene.js';
import { ArcadeMenuScene } from './scenes/ArcadeMenuScene.js';
import { EndlessScene } from './scenes/EndlessScene.js';
import { ReviewScene } from './scenes/ReviewScene.js';
import { BossRushScene } from './scenes/BossRushScene.js';
import { DevMenuScene } from './scenes/DevMenuScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';
import { ConveyorScene } from './scenes/ConveyorScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1080,
  height: 1920,
  backgroundColor: '#12121f',
  antialias: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'game-container',
    expandParent: true,
    min: {
      width: 360,
      height: 640
    },
    max: {
      width: 1080,
      height: 1920
    }
  },
  scene: [
    BootScene, StarterPickerScene, WorldMapScene, LevelSelectScene, GameScene,
    ShopScene, RecordsScene, ParentDashboardScene,
    CreditsScene, HiddenWorldScene,
    ArcadeMenuScene, EndlessScene, ReviewScene, BossRushScene, DevMenuScene, SettingsScene,
    ConveyorScene
  ]
};

loadBrandFonts().finally(() => {
  document.getElementById('boot-loading')?.remove();
  window.game = new Phaser.Game(config);
});
