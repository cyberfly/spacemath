import Phaser from 'phaser';
import { EventBus } from '../../services/EventBus';
import { MathGenerator } from '../../math/MathGenerator';
import type { MathProblem } from '../../math/types';

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
  private playerLives: number = 3;

  private lastFireTime: number = 0;
  private fireDelay: number = 250;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { mode: 'shoot' | 'type'; difficulty: number; evolutionStage: number }): void {
    this.gameMode = data.mode || 'shoot';
    this.difficulty = data.difficulty || 1;
    this.evolutionStage = data.evolutionStage || 1;
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.correctAnswers = 0;
    this.xpEarned = 0;
    this.isGameOver = false;
    this.isPaused = false;
    this.playerLives = 3;
    this.currentProblem = null;
    this.enemies = [];
    this.bullets = [];
    this.stars = [];
    this.mothership = null;
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
    const emojis: { [key: number]: string } = {
      1: '🥚',      // Egg
      2: '🐣',      // Hatchling
      3: '🐉',      // Baby Dragon
      4: '🔥',      // Young Dragon
      5: '🐲',      // Dragon
      6: '☄️',      // Fire Dragon
      7: '⭐',      // Star Dragon
    };
    return emojis[this.evolutionStage] || '🥚';
  }

  private createPlayer(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Create player container - position at bottom center
    const playerY = height - 120;
    this.player = this.add.container(width / 2, playerY);

    // Create a visible ship shape
    const ship = this.add.graphics();

    // Outer glow
    ship.fillStyle(0x22d3ee, 0.3);
    ship.fillCircle(0, 0, 55);

    // Main body - cyan colored ship pointing up
    ship.fillStyle(0x06b6d4);
    ship.beginPath();
    ship.moveTo(0, -40);      // Top point
    ship.lineTo(35, 35);      // Bottom right
    ship.lineTo(-35, 35);     // Bottom left
    ship.closePath();
    ship.fillPath();

    // Inner detail
    ship.fillStyle(0x0891b2);
    ship.beginPath();
    ship.moveTo(0, -25);
    ship.lineTo(20, 25);
    ship.lineTo(-20, 25);
    ship.closePath();
    ship.fillPath();

    // Cockpit
    ship.fillStyle(0xfbbf24);
    ship.fillCircle(0, 5, 12);
    ship.fillStyle(0xfef3c7);
    ship.fillCircle(0, 5, 6);

    // Glow outline
    ship.lineStyle(3, 0x22d3ee, 1);
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

    // Draw mothership body - large hexagonal shape
    const ship = this.add.graphics();

    // Main body - dark purple/red
    ship.fillStyle(0x8b0000); // Dark red
    ship.beginPath();
    ship.moveTo(-80, 0);      // Left point
    ship.lineTo(-50, -30);    // Upper left
    ship.lineTo(50, -30);     // Upper right
    ship.lineTo(80, 0);       // Right point
    ship.lineTo(50, 30);      // Lower right
    ship.lineTo(-50, 30);     // Lower left
    ship.closePath();
    ship.fillPath();

    // Inner detail - darker
    ship.fillStyle(0x4a0000);
    ship.beginPath();
    ship.moveTo(-60, 0);
    ship.lineTo(-35, -20);
    ship.lineTo(35, -20);
    ship.lineTo(60, 0);
    ship.lineTo(35, 20);
    ship.lineTo(-35, 20);
    ship.closePath();
    ship.fillPath();

    // Cockpit area
    ship.fillStyle(0xff4444);
    ship.fillCircle(0, 0, 15);
    ship.fillStyle(0xffff00);
    ship.fillCircle(0, 0, 8);

    // Side cannons
    ship.fillStyle(0x666666);
    ship.fillRect(-90, -8, 20, 16);
    ship.fillRect(70, -8, 20, 16);

    // Glow outline
    ship.lineStyle(2, 0xff0000, 0.8);
    ship.beginPath();
    ship.moveTo(-80, 0);
    ship.lineTo(-50, -30);
    ship.lineTo(50, -30);
    ship.lineTo(80, 0);
    ship.lineTo(50, 30);
    ship.lineTo(-50, 30);
    ship.closePath();
    ship.strokePath();

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
      this.scene.pause();
    });

    EventBus.on('game:resume', () => {
      this.isPaused = false;
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

    EventBus.emit('answer:wrong', undefined);
    EventBus.emit('score:update', { score: this.score, streak: this.streak });

    // Flash screen red
    this.cameras.main.flash(300, 255, 50, 50);

    if (this.playerLives <= 0) {
      this.gameOver();
    }
  }

  private createExplosion(x: number, y: number): void {
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
  }

  update(): void {
    if (this.isGameOver || this.isPaused) return;

    // Player movement
    if (this.cursors) {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const speed = 350;

      if (this.cursors.left.isDown) {
        body.setVelocityX(-speed);
      } else if (this.cursors.right.isDown) {
        body.setVelocityX(speed);
      } else {
        body.setVelocityX(0);
      }

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
