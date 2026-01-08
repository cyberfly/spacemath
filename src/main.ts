import Alpine from 'alpinejs';
import Phaser from 'phaser';
import { createGameConfig } from './game/config';
import { StorageService } from './services/StorageService';
import { EventBus } from './services/EventBus';
import type { Profile, GameMode } from './models/Profile';
import { DEFAULT_AVATAR } from './models/Profile';
import {
  getEvolutionStage,
  getEvolutionByStage,
  getXPToNextEvolution as getXPToNext,
  getEvolutionProgress as getEvoProgress,
} from './models/Evolution';

// Extend Alpine types
declare global {
  interface Window {
    Alpine: typeof Alpine;
    game: Phaser.Game | null;
  }
}

// Initialize the app store
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    // State
    screen: 'profiles' as string,
    profiles: [] as Profile[],
    currentProfile: null as Profile | null,
    newProfileName: '',
    availableAvatars: ['🧑‍🚀', '👩‍🚀', '👨‍🚀', '🧑‍✈️', '🧑‍🔬', '🧑‍🚒'],
    selectedAvatar: DEFAULT_AVATAR,
    gameMode: 'shoot' as GameMode,
    selectedDifficulty: 1,
    evolutionData: { from: 1, to: 2 },

    // Game state (synced from Phaser)
    gameState: {
      score: 0,
      streak: 0,
      bestStreak: 0,
      correct: 0,
      xpEarned: 0,
      currentEquation: '',
      typedAnswer: '',
      lives: 5,
      maxLives: 5,
    },

    // Phaser game instance
    game: null as Phaser.Game | null,

    // Initialize
    init(this: any) {
      this.loadProfiles();
      this.setupEventListeners();
      window.addEventListener('keydown', (event) => this.handleGlobalKeydown(event));

      this.$watch('screen', (value: string) => {
        if (value === 'gameover') {
          this.$nextTick(() => {
            const playAgainButton = (this.$refs as { playAgain?: HTMLButtonElement }).playAgain;
            playAgainButton?.focus();
          });
        }
      });

      // Check if there's an active profile
      const activeProfile = StorageService.getActiveProfile();
      if (activeProfile) {
        this.currentProfile = activeProfile;
        this.selectedDifficulty = activeProfile.settings.difficulty || 1;
        this.screen = 'menu';
      }
    },

    // Load all profiles
    loadProfiles() {
      this.profiles = StorageService.getAllProfiles();
    },

    // Setup event listeners from Phaser
    setupEventListeners() {
      EventBus.on('problem:new', (data) => {
        this.gameState.currentEquation = data.equation;
        this.gameState.typedAnswer = '';
      });

      EventBus.on('score:update', (data) => {
        this.gameState.score = data.score;
        this.gameState.streak = data.streak;
      });

      EventBus.on('answer:correct', (data) => {
        this.gameState.xpEarned += data.xp;
        this.gameState.streak = data.streak;
        this.gameState.correct++;
      });

      EventBus.on('answer:wrong', () => {
        this.gameState.streak = 0;
      });

      EventBus.on('player:lives', (data) => {
        this.gameState.lives = data.lives;
      });

      EventBus.on('game:over', (data) => {
        this.gameState.score = data.score;
        this.gameState.correct = data.correct;
        this.gameState.xpEarned = data.xpEarned;
        this.gameState.bestStreak = data.bestStreak;

        // Update profile with earned XP
        if (this.currentProfile) {
          const oldStage = this.currentProfile.progress.evolutionStage;
          this.currentProfile.progress.xp += data.xpEarned;
          this.currentProfile.progress.totalProblems += data.correct;
          this.currentProfile.progress.correctAnswers += data.correct;
          if (data.bestStreak > this.currentProfile.progress.bestStreak) {
            this.currentProfile.progress.bestStreak = data.bestStreak;
          }

          // Check for evolution
          const newStage = getEvolutionStage(this.currentProfile.progress.xp);
          if (newStage > oldStage) {
            this.currentProfile.progress.evolutionStage = newStage;
            this.evolutionData = { from: oldStage, to: newStage };
            StorageService.saveProfile(this.currentProfile);
            this.screen = 'evolution';
            return;
          }

          StorageService.saveProfile(this.currentProfile);
        }

        this.screen = 'gameover';
      });
    },

    // Profile management
    selectProfile(id: string) {
      const profile = StorageService.getProfile(id);
      if (profile) {
        this.currentProfile = profile;
        this.selectedDifficulty = profile.settings.difficulty || 1;
        StorageService.setActiveProfile(id);
        this.screen = 'menu';
      }
    },

    createProfile() {
      if (!this.newProfileName.trim()) return;

      const profile = StorageService.createProfile(this.newProfileName.trim(), this.selectedAvatar);
      this.profiles.push(profile);
      this.currentProfile = profile;
      this.selectedDifficulty = profile.settings.difficulty || 1;
      this.newProfileName = '';
      this.selectedAvatar = this.availableAvatars[0] || DEFAULT_AVATAR;
      this.screen = 'menu';
    },

    saveProfile() {
      if (this.currentProfile) {
        StorageService.saveProfile(this.currentProfile);
      }
    },

    confirmDeleteProfile() {
      if (!this.currentProfile) return;

      if (confirm(`Are you sure you want to delete ${this.currentProfile.name}?`)) {
        StorageService.deleteProfile(this.currentProfile.id);
        this.loadProfiles();
        this.currentProfile = null;
        this.screen = 'profiles';
      }
    },

    // Settings
    setDifficulty(level: number) {
      this.selectedDifficulty = level;
      if (this.currentProfile) {
        this.currentProfile.settings.difficulty = level;
        this.saveProfile();
      }
    },

    getDifficultyLabel(level: number): string {
      const labels = ['Easy', 'Medium', 'Hard', 'Expert', 'Master'];
      return labels[level - 1] || 'Easy';
    },

    // Evolution helpers
    getEvolutionEmoji(stage: number): string {
      return getEvolutionByStage(stage).emoji;
    },

    getEvolutionName(stage: number): string {
      return getEvolutionByStage(stage).name;
    },

    getEvolutionProgress(): number {
      if (!this.currentProfile) return 0;
      return getEvoProgress(
        this.currentProfile.progress.xp,
        this.currentProfile.progress.evolutionStage
      );
    },

    getXPToNextEvolution(): number {
      if (!this.currentProfile) return 0;
      return getXPToNext(
        this.currentProfile.progress.xp,
        this.currentProfile.progress.evolutionStage
      );
    },

    // Game control
    startGame(this: any, mode: GameMode) {
      this.gameMode = mode;
      this.gameState = {
        score: 0,
        streak: 0,
        bestStreak: 0,
        correct: 0,
        xpEarned: 0,
        currentEquation: '',
        typedAnswer: '',
        lives: 5,
        maxLives: 5,
      };

      this.screen = 'game';

      // Start the game scene after the game container is visible
      this.$nextTick(() => {
        // Initialize Phaser if not already
        if (!this.game) {
          this.game = new Phaser.Game(createGameConfig());
          window.game = this.game;
        } else {
          this.game.scale.resize(window.innerWidth, window.innerHeight);
        }

        const gameScene = this.game?.scene.getScene('GameScene');
        if (gameScene) {
          this.game?.scene.stop('GameScene');
        }

        // Start preload first, then game
        this.game?.scene.start('PreloadScene');

        setTimeout(() => {
          this.game?.scale.resize(window.innerWidth, window.innerHeight);
          this.game?.scene.start('GameScene', {
            mode: this.gameMode,
            difficulty: this.selectedDifficulty || 1,
            evolutionStage: this.currentProfile?.progress.evolutionStage || 1,
            soundEnabled: this.currentProfile?.settings.soundEnabled ?? true,
            musicEnabled: this.currentProfile?.settings.musicEnabled ?? true,
          });

          // Focus answer input for type mode
          if (mode === 'type') {
            setTimeout(() => {
              const input = document.getElementById('answer-input') as HTMLInputElement;
              input?.focus();
            }, 100);
          }
        }, 100);
      });
    },

    pauseGame() {
      EventBus.emit('game:pause', undefined);
      this.screen = 'paused';
    },

    resumeGame() {
      EventBus.emit('game:resume', undefined);
      this.screen = 'game';

      // Refocus input for type mode
      if (this.gameMode === 'type') {
        setTimeout(() => {
          const input = document.getElementById('answer-input') as HTMLInputElement;
          input?.focus();
        }, 100);
      }
    },

    quitGame() {
      EventBus.emit('game:quit', undefined);
      this.screen = 'menu';
    },

    playAgain() {
      this.startGame(this.gameMode);
    },

    submitAnswer() {
      const answer = parseInt(this.gameState.typedAnswer, 10);
      if (!isNaN(answer)) {
        EventBus.emit('answer:submit', { answer });
        this.gameState.typedAnswer = '';
      }
    },

    handleGlobalKeydown(event: KeyboardEvent) {
      if (event.key !== 'Enter') return;

      const target = event.target as HTMLElement | null;
      const isAnswerInput = target?.id === 'answer-input';

      if (this.screen === 'game') {
        if (this.gameMode === 'type' && isAnswerInput) return;
        event.preventDefault();
        this.pauseGame();
      } else if (this.screen === 'paused') {
        event.preventDefault();
        this.resumeGame();
      } else if (this.screen === 'gameover') {
        event.preventDefault();
        this.playAgain();
      }
    },

    closeEvolution() {
      this.screen = 'gameover';
    },
  }));
});

// Start Alpine
Alpine.start();
window.Alpine = Alpine;
