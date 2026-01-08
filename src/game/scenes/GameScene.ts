import Phaser from 'phaser';
import { EventBus } from '../../services/EventBus';
import { MathGenerator } from '../../math/MathGenerator';
import type { MathProblem } from '../../math/types';
import { getEvolutionByStage } from '../../models/Evolution';

interface EnemyData {
  container: Phaser.GameObjects.Container;
  answerValue: number;
  isCorrect: boolean;
}

interface MothershipData {
  container: Phaser.GameObjects.Container;
  equationText: Phaser.GameObjects.Text;
}

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private enemies: EnemyData[] = [];
  private bullets: Phaser.GameObjects.Container[] = [];
  private stars: Phaser.GameObjects.Arc[] = [];
  private mothership: MothershipData | null = null;
  private soundEnabled: boolean = true;
  private musicEnabled: boolean = true;
  private audioContext: AudioContext | null = null;
  private backgroundMusicTimer: Phaser.Time.TimerEvent | null = null;
  private backgroundMusicOscillators: OscillatorNode[] = [];
  private backgroundMusicGain: GainNode | null = null;
  private backgroundMusicLeadGain: GainNode | null = null;
  private backgroundMusicBassGain: GainNode | null = null;
  private backgroundMusicPadGain: GainNode | null = null;
  private backgroundMusicStep: number = 0;
  private jetNoise: AudioBufferSourceNode | null = null;
  private jetFilter: BiquadFilterNode | null = null;
  private jetGain: GainNode | null = null;

  private mathGenerator!: MathGenerator;
  private currentProblem: MathProblem | null = null;
  private gameMode: 'shoot' | 'type' = 'shoot';
  private difficulty: number = 1;
  private evolutionStage: number = 1;

  private score: number = 0;
  private streak: number = 0;
  private bestStreak: number = 0;
  private correctAnswers: number = 0;
  private xpEarned: number = 0;
  private problemStartTime: number = 0;

  private isGameOver: boolean = false;
  private isPaused: boolean = false;
  private playerLives: number = 5;

  private lastFireTime: number = 0;
  private fireDelay: number = 250;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { mode: 'shoot' | 'type'; difficulty: number; evolutionStage: number; soundEnabled?: boolean; musicEnabled?: boolean }): void {
    this.gameMode = data.mode || 'shoot';
    this.difficulty = data.difficulty || 1;
    this.evolutionStage = data.evolutionStage || 1;
    this.soundEnabled = data.soundEnabled ?? true;
    this.musicEnabled = data.musicEnabled ?? true;
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.correctAnswers = 0;
    this.xpEarned = 0;
    this.isGameOver = false;
    this.isPaused = false;
    this.playerLives = 5;
    this.currentProblem = null;
    this.enemies = [];
    this.bullets = [];
    this.stars = [];
    this.mothership = null;
    this.emitLivesUpdate();
  }

  private getAudioContext(options?: { allowWithoutSound?: boolean }): AudioContext | null {
    if (!options?.allowWithoutSound && !this.soundEnabled) return null;
    if (!this.audioContext) {
      const AudioContextConstructor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) return null;
      this.audioContext = new AudioContextConstructor();
    }
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
    return this.audioContext;
  }

  private playTone(frequency: number, durationMs: number, type: OscillatorType, volume: number): void {
    const context = this.getAudioContext();
    if (!context) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(volume, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + durationMs / 1000);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + durationMs / 1000);
  }

  private playSfx(kind: 'shoot' | 'correct' | 'wrong' | 'explode' | 'gameover'): void {
    if (!this.soundEnabled) return;
    switch (kind) {
      case 'shoot':
        this.playTone(640, 90, 'square', 0.08);
        break;
      case 'correct':
        this.playTone(880, 140, 'triangle', 0.12);
        break;
      case 'wrong':
        this.playTone(220, 180, 'sawtooth', 0.12);
        break;
      case 'explode':
        this.playTone(140, 140, 'sawtooth', 0.1);
        break;
      case 'gameover':
        this.playTone(120, 320, 'triangle', 0.1);
        break;
    }
  }

  private startBackgroundMusic(): void {
    if (!this.musicEnabled || this.backgroundMusicGain) return;
    const context = this.getAudioContext({ allowWithoutSound: true });
    if (!context) return;

    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.linearRampToValueAtTime(0.12, context.currentTime + 0.6);
    master.connect(context.destination);

    const leadGain = context.createGain();
    leadGain.gain.setValueAtTime(0.0001, context.currentTime);
    leadGain.connect(master);

    const bassGain = context.createGain();
    bassGain.gain.setValueAtTime(0.25, context.currentTime);
    bassGain.connect(master);

    const padGain = context.createGain();
    padGain.gain.setValueAtTime(0.18, context.currentTime);
    padGain.connect(master);

    const lead = context.createOscillator();
    const bass = context.createOscillator();
    const pad = context.createOscillator();
    lead.type = 'square';
    bass.type = 'triangle';
    pad.type = 'sawtooth';
    lead.connect(leadGain);
    bass.connect(bassGain);
    pad.connect(padGain);
    lead.start();
    bass.start();
    pad.start();

    this.backgroundMusicGain = master;
    this.backgroundMusicLeadGain = leadGain;
    this.backgroundMusicBassGain = bassGain;
    this.backgroundMusicPadGain = padGain;
    this.backgroundMusicOscillators = [lead, bass, pad];
    this.backgroundMusicStep = 0;
    this.advanceBackgroundMusic();
    this.backgroundMusicTimer = this.time.addEvent({
      delay: 180,
      loop: true,
      callback: () => this.advanceBackgroundMusic(),
    });
  }

  private noteFrequency(base: number, semitoneOffset: number): number {
    return base * Math.pow(2, semitoneOffset / 12);
  }

  private advanceBackgroundMusic(): void {
    if (!this.backgroundMusicGain || this.backgroundMusicOscillators.length < 3) return;
    const context = this.getAudioContext({ allowWithoutSound: true });
    if (!context) return;

    const now = context.currentTime;
    const step = this.backgroundMusicStep;
    const lead = this.backgroundMusicOscillators[0];
    const bass = this.backgroundMusicOscillators[1];
    const pad = this.backgroundMusicOscillators[2];

    const leadPattern = [0, 7, 10, 12, 10, 7, 5, 3, 0, 7, 12, 15, 12, 10, 7, 5];
    const bassPattern = [0, 0, -5, -5, -7, -7, -10, -10];
    const padChords = [
      [0, 7, 10],
      [-5, 0, 7],
      [-7, -3, 5],
      [-10, -5, 2],
    ];

    const leadNote = leadPattern[step % leadPattern.length];
    const bassNote = bassPattern[Math.floor(step / 2) % bassPattern.length];
    const chord = padChords[Math.floor(step / 4) % padChords.length];

    lead.frequency.setValueAtTime(this.noteFrequency(220, leadNote), now);
    bass.frequency.setValueAtTime(this.noteFrequency(110, bassNote), now);

    const padPitch = this.noteFrequency(174.61, chord[step % chord.length]);
    pad.frequency.setValueAtTime(padPitch, now);

    if (this.backgroundMusicLeadGain) {
      this.backgroundMusicLeadGain.gain.cancelScheduledValues(now);
      this.backgroundMusicLeadGain.gain.setValueAtTime(0.0001, now);
      this.backgroundMusicLeadGain.gain.linearRampToValueAtTime(0.25, now + 0.02);
      this.backgroundMusicLeadGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    }

    this.backgroundMusicStep += 1;
  }

  private stopBackgroundMusic(): void {
    this.backgroundMusicTimer?.remove(false);
    this.backgroundMusicTimer = null;

    if (this.backgroundMusicGain && this.audioContext) {
      this.backgroundMusicGain.gain.cancelScheduledValues(this.audioContext.currentTime);
      this.backgroundMusicGain.gain.linearRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.2);
    }

    this.backgroundMusicOscillators.forEach((osc) => {
      try {
        osc.stop();
      } catch {
        // Oscillator may already be stopped.
      }
      osc.disconnect();
    });
    this.backgroundMusicOscillators = [];

    this.backgroundMusicLeadGain?.disconnect();
    this.backgroundMusicBassGain?.disconnect();
    this.backgroundMusicPadGain?.disconnect();
    this.backgroundMusicLeadGain = null;
    this.backgroundMusicBassGain = null;
    this.backgroundMusicPadGain = null;
    this.backgroundMusicGain?.disconnect();
    this.backgroundMusicGain = null;
  }

  private initJetSound(): void {
    if (!this.soundEnabled || this.jetGain) return;
    const context = this.getAudioContext();
    if (!context) return;

    const bufferSize = context.sampleRate * 2;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, context.currentTime);
    filter.Q.setValueAtTime(0.7, context.currentTime);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.connect(context.destination);

    noise.connect(filter);
    filter.connect(gain);
    noise.start();

    this.jetGain = gain;
    this.jetNoise = noise;
    this.jetFilter = filter;
  }

  private setJetThrust(active: boolean): void {
    if (!this.soundEnabled || !this.jetGain || !this.audioContext) return;
    const now = this.audioContext.currentTime;
    this.jetGain.gain.cancelScheduledValues(now);
    this.jetGain.gain.setTargetAtTime(active ? 0.07 : 0.0001, now, 0.08);
    if (this.jetFilter) {
      this.jetFilter.frequency.setTargetAtTime(active ? 1400 : 300, now, 0.12);
    }
  }

  private stopJetSound(): void {
    if (this.jetGain && this.audioContext) {
      this.jetGain.gain.cancelScheduledValues(this.audioContext.currentTime);
      this.jetGain.gain.setValueAtTime(0.0001, this.audioContext.currentTime);
    }
    if (this.jetNoise) {
      try {
        this.jetNoise.stop();
      } catch {
        // Oscillator may already be stopped.
      }
      this.jetNoise.disconnect();
      this.jetNoise = null;
    }
    this.jetFilter?.disconnect();
    this.jetFilter = null;
    this.jetGain?.disconnect();
    this.jetGain = null;
  }

  create(): void {
    this.mathGenerator = new MathGenerator(this.difficulty);

    // Create starfield background
    this.createStarfield();

    // Create player
    this.createPlayer();

    // Setup input
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
    }

    this.startBackgroundMusic();
    this.initJetSound();

    // Setup event listeners
    this.setupEventListeners();

    // Generate first problem after a short delay
    this.time.delayedCall(500, () => {
      this.generateNewProblem();
    });
  }

  private createStarfield(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Create bright, visible stars
    for (let i = 0; i < 200; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const size = Phaser.Math.Between(2, 4);
      const star = this.add.circle(x, y, size, 0xffffff);
      star.setAlpha(Phaser.Math.FloatBetween(0.6, 1));
      star.setDepth(1); // Above background but below game objects
      this.stars.push(star);
    }
  }

  private getEvolutionEmoji(): string {
    return getEvolutionByStage(this.evolutionStage).emoji;
  }

  private getShipStyle(): {
    glow: number;
    body: number;
    detail: number;
    cockpit: number;
    cockpitCore: number;
    outline: number;
    fin: number;
    flame: number;
  } {
    const styles = [
      {
        glow: 0x22d3ee,
        body: 0x06b6d4,
        detail: 0x0891b2,
        cockpit: 0xfbbf24,
        cockpitCore: 0xfef3c7,
        outline: 0x22d3ee,
        fin: 0x0ea5e9,
        flame: 0xfbbf24,
      },
      {
        glow: 0x38bdf8,
        body: 0x0ea5e9,
        detail: 0x0284c7,
        cockpit: 0xfbbf24,
        cockpitCore: 0xfef3c7,
        outline: 0x38bdf8,
        fin: 0x0ea5e9,
        flame: 0xf97316,
      },
      {
        glow: 0x4ade80,
        body: 0x22c55e,
        detail: 0x15803d,
        cockpit: 0xfacc15,
        cockpitCore: 0xfef9c3,
        outline: 0x4ade80,
        fin: 0x16a34a,
        flame: 0xf59e0b,
      },
      {
        glow: 0xf97316,
        body: 0xea580c,
        detail: 0xc2410c,
        cockpit: 0x38bdf8,
        cockpitCore: 0xe0f2fe,
        outline: 0xfb923c,
        fin: 0xf97316,
        flame: 0xfbbf24,
      },
      {
        glow: 0xa78bfa,
        body: 0x8b5cf6,
        detail: 0x6d28d9,
        cockpit: 0xfacc15,
        cockpitCore: 0xfef9c3,
        outline: 0xc4b5fd,
        fin: 0x8b5cf6,
        flame: 0xf97316,
      },
      {
        glow: 0xfacc15,
        body: 0xf59e0b,
        detail: 0xb45309,
        cockpit: 0x22d3ee,
        cockpitCore: 0xe0f2fe,
        outline: 0xfcd34d,
        fin: 0xf59e0b,
        flame: 0xf43f5e,
      },
      {
        glow: 0x38bdf8,
        body: 0x0f172a,
        detail: 0x1e293b,
        cockpit: 0xfacc15,
        cockpitCore: 0xfef9c3,
        outline: 0x38bdf8,
        fin: 0x22d3ee,
        flame: 0xf59e0b,
      },
    ];

    return styles[Math.min(this.evolutionStage, styles.length) - 1];
  }

  private createPlayer(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Create player container - position at bottom center
    const playerY = height - 120;
    this.player = this.add.container(width / 2, playerY);

    const style = this.getShipStyle();

    // Create a visible ship shape
    const ship = this.add.graphics();

    // Outer glow
    ship.fillStyle(style.glow, 0.3);
    ship.fillCircle(0, 0, 55);

    // Main body - cyan colored ship pointing up
    ship.fillStyle(style.body);
    ship.beginPath();
    ship.moveTo(0, -40);      // Top point
    ship.lineTo(35, 35);      // Bottom right
    ship.lineTo(-35, 35);     // Bottom left
    ship.closePath();
    ship.fillPath();

    // Inner detail
    ship.fillStyle(style.detail);
    ship.beginPath();
    ship.moveTo(0, -25);
    ship.lineTo(20, 25);
    ship.lineTo(-20, 25);
    ship.closePath();
    ship.fillPath();

    if (this.evolutionStage >= 3) {
      ship.fillStyle(style.fin);
      ship.fillTriangle(-35, 10, -60, 35, -20, 30);
      ship.fillTriangle(35, 10, 60, 35, 20, 30);
    }

    // Cockpit
    ship.fillStyle(style.cockpit);
    ship.fillCircle(0, 5, 12);
    ship.fillStyle(style.cockpitCore);
    ship.fillCircle(0, 5, 6);

    if (this.evolutionStage >= 5) {
      ship.fillStyle(style.flame);
      ship.fillTriangle(0, 40, -8, 58, 8, 58);
    }

    if (this.evolutionStage >= 6) {
      ship.fillStyle(style.flame);
      ship.fillTriangle(-20, 35, -30, 52, -10, 50);
      ship.fillTriangle(20, 35, 30, 52, 10, 50);
    }

    // Glow outline
    ship.lineStyle(3, style.outline, 1);
    ship.beginPath();
    ship.moveTo(0, -40);
    ship.lineTo(35, 35);
    ship.lineTo(-35, 35);
    ship.closePath();
    ship.strokePath();

    this.player.add(ship);

    // Add evolution label below ship
    const evoEmoji = this.getEvolutionEmoji();
    const label = this.add.text(0, 55, evoEmoji, {
      fontSize: '32px',
    });
    label.setOrigin(0.5);
    this.player.add(label);

    // Ensure player is visible above other elements
    this.player.setDepth(50);

    // Setup physics
    this.physics.add.existing(this.player);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(70, 80);
    body.setCollideWorldBounds(true);
  }

  private createMothership(equation: string): void {
    // Destroy existing mothership if any
    if (this.mothership) {
      this.mothership.container.destroy();
      this.mothership = null;
    }

    const width = this.cameras.main.width;
    const container = this.add.container(width / 2, 70);

    // Draw alien mothership - monster head silhouette
    const ship = this.add.graphics();

    // Aura glow
    ship.fillStyle(0x22c55e, 0.18);
    ship.fillCircle(0, 0, 70);

    // Main head
    ship.fillStyle(0x14532d);
    ship.fillEllipse(0, 0, 170, 90);

    // Forehead ridge
    ship.fillStyle(0x166534);
    ship.fillEllipse(0, -12, 140, 45);

    // Horns
    ship.fillStyle(0x0f172a);
    ship.beginPath();
    ship.moveTo(-55, -35);
    ship.lineTo(-85, -70);
    ship.lineTo(-35, -50);
    ship.closePath();
    ship.fillPath();
    ship.beginPath();
    ship.moveTo(55, -35);
    ship.lineTo(85, -70);
    ship.lineTo(35, -50);
    ship.closePath();
    ship.fillPath();

    // Eyes
    ship.fillStyle(0xf97316);
    ship.fillEllipse(-35, -5, 26, 18);
    ship.fillEllipse(35, -5, 26, 18);
    ship.fillStyle(0x111827);
    ship.fillCircle(-35, -5, 6);
    ship.fillCircle(35, -5, 6);
    ship.fillStyle(0xfef3c7);
    ship.fillCircle(-32, -8, 3);
    ship.fillCircle(38, -8, 3);

    // Mouth
    ship.fillStyle(0x7f1d1d);
    ship.fillRoundedRect(-40, 20, 80, 20, 8);
    ship.fillStyle(0xf8fafc);
    ship.fillTriangle(-30, 20, -24, 34, -18, 20);
    ship.fillTriangle(-6, 20, 0, 34, 6, 20);
    ship.fillTriangle(18, 20, 24, 34, 30, 20);

    // Outline
    ship.lineStyle(2, 0x4ade80, 0.7);
    ship.strokeEllipse(0, 0, 170, 90);

    container.add(ship);

    // Add equation text below mothership
    const text = this.add.text(0, 50, equation, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    });
    text.setOrigin(0.5);
    container.add(text);

    this.mothership = {
      container,
      equationText: text,
    };
  }

  private setupEventListeners(): void {
    // Listen for answer submissions from Alpine (type mode)
    EventBus.on('answer:submit', (data) => {
      if (this.gameMode === 'type' && !this.isGameOver && !this.isPaused) {
        this.checkTypedAnswer(data.answer);
      }
    });

    // Listen for pause/resume
    EventBus.on('game:pause', () => {
      this.isPaused = true;
      this.setJetThrust(false);
      this.stopBackgroundMusic();
      this.scene.pause();
    });

    EventBus.on('game:resume', () => {
      this.isPaused = false;
      this.startBackgroundMusic();
      this.initJetSound();
      this.scene.resume();
    });

    EventBus.on('game:quit', () => {
      this.cleanup();
      this.scene.stop();
    });
  }

  private generateNewProblem(): void {
    if (this.isGameOver) return;

    this.currentProblem = this.mathGenerator.generate();
    this.problemStartTime = Date.now();

    // Clear existing enemies
    this.clearEnemies();

    // Create mothership with the equation
    this.createMothership(this.currentProblem.equation);

    if (this.gameMode === 'shoot') {
      // Generate wrong answers
      const wrongAnswers = this.mathGenerator.generateWrongAnswers(this.currentProblem.answer, 3);

      // Emit the new problem event
      EventBus.emit('problem:new', {
        equation: this.currentProblem.equation,
        answer: this.currentProblem.answer,
        wrongAnswers,
      });

      // Spawn enemies with answers
      this.spawnAnswerEnemies(this.currentProblem.answer, wrongAnswers);
    } else {
      // Type mode - spawn single enemy with equation
      EventBus.emit('problem:new', {
        equation: this.currentProblem.equation,
        answer: this.currentProblem.answer,
      });

      this.spawnTypeEnemy();
    }
  }

  private clearEnemies(): void {
    this.enemies.forEach(e => e.container.destroy());
    this.enemies = [];
  }

  private spawnAnswerEnemies(correctAnswer: number, wrongAnswers: number[]): void {
    const width = this.cameras.main.width;
    const answers = [correctAnswer, ...wrongAnswers];

    // Shuffle answers
    for (let i = answers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [answers[i], answers[j]] = [answers[j], answers[i]];
    }

    const spacing = width / (answers.length + 1);

    answers.forEach((answer, index) => {
      const x = spacing * (index + 1);
      const y = 160; // Start below the mothership

      const enemyData = this.createEnemy(x, y, answer, answer === correctAnswer);
      this.enemies.push(enemyData);
    });
  }

  private spawnTypeEnemy(): void {
    const width = this.cameras.main.width;
    const x = width / 2;
    const y = 160; // Start below the mothership

    const enemyData = this.createEnemy(x, y, 0, true, true);
    this.enemies.push(enemyData);
  }

  private createEnemy(x: number, y: number, answer: number, isCorrect: boolean, isTypeMode: boolean = false): EnemyData {
    const container = this.add.container(x, y);

    // Draw enemy spaceship (inverted triangle pointing down)
    const ship = this.add.graphics();

    // Main body - red/orange enemy color
    ship.fillStyle(0xdc2626); // Red
    ship.beginPath();
    ship.moveTo(0, 30);       // Bottom point (pointing down)
    ship.lineTo(-25, -20);    // Top left
    ship.lineTo(25, -20);     // Top right
    ship.closePath();
    ship.fillPath();

    // Inner detail - darker red
    ship.fillStyle(0x991b1b);
    ship.beginPath();
    ship.moveTo(0, 20);
    ship.lineTo(-15, -10);
    ship.lineTo(15, -10);
    ship.closePath();
    ship.fillPath();

    // Cockpit/eye - yellow glow
    ship.fillStyle(0xfbbf24);
    ship.fillCircle(0, -5, 8);
    ship.fillStyle(0xfef3c7);
    ship.fillCircle(0, -5, 4);

    // Wing tips
    ship.fillStyle(0x7f1d1d);
    ship.fillRect(-30, -20, 10, 8);
    ship.fillRect(20, -20, 10, 8);

    // Glow outline
    ship.lineStyle(2, 0xf87171, 0.8);
    ship.beginPath();
    ship.moveTo(0, 30);
    ship.lineTo(-25, -20);
    ship.lineTo(25, -20);
    ship.closePath();
    ship.strokePath();

    container.add(ship);

    // Add text (answer number or ? for type mode) above the ship
    const displayText = isTypeMode ? '?' : answer.toString();
    const text = this.add.text(0, -35, displayText, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    });
    text.setOrigin(0.5);
    container.add(text);

    // Setup physics
    this.physics.add.existing(container);
    const body = container.body as Phaser.Physics.Arcade.Body;
    body.setSize(50, 50);
    body.setVelocityY(30 + this.difficulty * 10); // Slower enemies for better visibility

    return {
      container,
      answerValue: answer,
      isCorrect,
    };
  }

  private fire(): void {
    const now = Date.now();
    if (now - this.lastFireTime < this.fireDelay) return;
    this.lastFireTime = now;
    this.playSfx('shoot');

    const bullet = this.add.container(this.player.x, this.player.y - 30);

    // Draw bullet
    const bulletGraphic = this.add.graphics();
    bulletGraphic.fillStyle(0xfbbf24);
    bulletGraphic.fillCircle(0, 0, 5);
    bulletGraphic.lineStyle(2, 0xffffff, 0.5);
    bulletGraphic.strokeCircle(0, 0, 5);
    bullet.add(bulletGraphic);

    // Add trail effect
    const trail = this.add.graphics();
    trail.fillStyle(0xfbbf24, 0.5);
    trail.fillCircle(0, 8, 3);
    bullet.add(trail);

    this.physics.add.existing(bullet);
    (bullet.body as Phaser.Physics.Arcade.Body).setSize(10, 10);
    (bullet.body as Phaser.Physics.Arcade.Body).setVelocityY(-400);
    this.bullets.push(bullet);
  }

  private checkBulletEnemyCollision(): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      const bulletBody = bullet.body as Phaser.Physics.Arcade.Body;

      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const enemy = this.enemies[j];
        const enemyBody = enemy.container.body as Phaser.Physics.Arcade.Body;

        // Simple collision check
        const dx = bullet.x - enemy.container.x;
        const dy = bullet.y - enemy.container.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 35) {
          // Collision!
          this.createExplosion(enemy.container.x, enemy.container.y);
          bullet.destroy();
          this.bullets.splice(i, 1);

          if (this.gameMode === 'shoot') {
            if (enemy.answerValue === this.currentProblem?.answer) {
              this.handleCorrectAnswer();
            } else {
              this.handleWrongAnswer();
            }
          }

          enemy.container.destroy();
          this.enemies.splice(j, 1);
          break;
        }
      }
    }
  }

  private checkTypedAnswer(answer: number): void {
    if (!this.currentProblem) return;

    if (answer === this.currentProblem.answer) {
      // Fire visual bullet at enemy
      if (this.enemies.length > 0) {
        this.createExplosion(this.enemies[0].container.x, this.enemies[0].container.y);
        this.enemies[0].container.destroy();
        this.enemies = [];
      }
      this.handleCorrectAnswer();
    } else {
      this.handleWrongAnswer();
    }
  }

  private handleCorrectAnswer(): void {
    this.correctAnswers++;
    this.streak++;
    if (this.streak > this.bestStreak) {
      this.bestStreak = this.streak;
    }

    // Calculate XP
    const timeBonus = Date.now() - this.problemStartTime < 3000 ? 5 : 0;
    const streakBonus = Math.min(20, this.streak * 2);
    const xp = 10 + timeBonus + streakBonus;
    this.xpEarned += xp;
    this.score += 100 + streakBonus * 5;

    EventBus.emit('answer:correct', { xp, streak: this.streak });
    EventBus.emit('score:update', { score: this.score, streak: this.streak });
    this.playSfx('correct');

    // Generate new problem after delay
    this.time.delayedCall(800, () => {
      if (!this.isGameOver) {
        this.generateNewProblem();
      }
    });
  }

  private handleWrongAnswer(): void {
    this.streak = 0;
    this.playerLives--;
    this.emitLivesUpdate();

    EventBus.emit('answer:wrong', undefined);
    EventBus.emit('score:update', { score: this.score, streak: this.streak });
    this.playSfx('wrong');

    // Flash screen red
    this.cameras.main.flash(300, 255, 50, 50);

    if (this.playerLives <= 0) {
      this.gameOver();
    }
  }

  private createExplosion(x: number, y: number): void {
    this.playSfx('explode');
    // Create particle explosion effect
    for (let i = 0; i < 12; i++) {
      const particle = this.add.circle(x, y, 4, 0xfbbf24);
      const angle = (i / 12) * Math.PI * 2;
      const speed = Phaser.Math.Between(100, 200);

      this.physics.add.existing(particle);
      const body = particle.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

      this.tweens.add({
        targets: particle,
        alpha: 0,
        scale: 0,
        duration: 400,
        onComplete: () => particle.destroy(),
      });
    }
  }

  private gameOver(): void {
    this.isGameOver = true;
    this.stopBackgroundMusic();
    this.setJetThrust(false);
    this.playSfx('gameover');

    EventBus.emit('game:over', {
      score: this.score,
      correct: this.correctAnswers,
      xpEarned: this.xpEarned,
      bestStreak: this.bestStreak,
    });
  }

  private cleanup(): void {
    this.clearEnemies();
    this.bullets.forEach(b => b.destroy());
    this.bullets = [];
    this.stopBackgroundMusic();
    this.stopJetSound();
  }

  private emitLivesUpdate(): void {
    EventBus.emit('player:lives', { lives: this.playerLives });
  }

  update(): void {
    if (this.isGameOver || this.isPaused) return;

    // Player movement
    if (this.cursors) {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const speed = 350;
      const isMoving = this.cursors.left.isDown || this.cursors.right.isDown;

      if (this.cursors.left.isDown) {
        body.setVelocityX(-speed);
      } else if (this.cursors.right.isDown) {
        body.setVelocityX(speed);
      } else {
        body.setVelocityX(0);
      }
      this.setJetThrust(isMoving);

      // Fire with space (shoot mode only)
      if (this.gameMode === 'shoot' && this.cursors.space?.isDown) {
        this.fire();
      }
    }

    // Check bullet-enemy collisions
    this.checkBulletEnemyCollision();

    // Clean up off-screen bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      if (this.bullets[i].y < -20) {
        this.bullets[i].destroy();
        this.bullets.splice(i, 1);
      }
    }

    // Check if enemies reached bottom (missed)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.container.y > this.cameras.main.height + 50) {
        if (enemy.isCorrect || this.gameMode === 'type') {
          // Missed the correct answer
          this.handleWrongAnswer();
        }
        enemy.container.destroy();
        this.enemies.splice(i, 1);

        // Generate new problem if all enemies gone
        if (this.enemies.length === 0 && !this.isGameOver) {
          this.time.delayedCall(500, () => {
            if (!this.isGameOver) {
              this.generateNewProblem();
            }
          });
        }
      }
    }

    // Parallax star movement
    const height = this.cameras.main.height;
    this.stars.forEach((star) => {
      star.y += 0.5;
      if (star.y > height) {
        star.y = 0;
        star.x = Phaser.Math.Between(0, this.cameras.main.width);
      }
    });
  }
}
