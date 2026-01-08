import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    // No assets to preload - we'll use graphics directly
  }

  create(): void {
    // Scene ready - stop and wait for GameScene to be started by Alpine
    this.scene.stop();
  }
}
