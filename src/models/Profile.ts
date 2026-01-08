export type GameMode = 'shoot' | 'type';

export interface OperationStats {
  attempts: number;
  correct: number;
}

export interface ProfileProgress {
  xp: number;
  totalProblems: number;
  correctAnswers: number;
  currentStreak: number;
  bestStreak: number;
  evolutionStage: number;
  operationStats: {
    addition: OperationStats;
    subtraction: OperationStats;
    multiplication: OperationStats;
    division: OperationStats;
  };
}

export interface ProfileSettings {
  difficulty: number;
  gameMode: GameMode;
  soundEnabled: boolean;
  musicEnabled: boolean;
}

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  createdAt: number;
  lastPlayed: number;
  settings: ProfileSettings;
  progress: ProfileProgress;
}

export const DEFAULT_AVATAR = '🧑‍🚀';

export function createDefaultProfile(id: string, name: string, avatar: string = DEFAULT_AVATAR): Profile {
  return {
    id,
    name,
    avatar,
    createdAt: Date.now(),
    lastPlayed: Date.now(),
    settings: {
      difficulty: 1,
      gameMode: 'shoot',
      soundEnabled: true,
      musicEnabled: true,
    },
    progress: {
      xp: 0,
      totalProblems: 0,
      correctAnswers: 0,
      currentStreak: 0,
      bestStreak: 0,
      evolutionStage: 1,
      operationStats: {
        addition: { attempts: 0, correct: 0 },
        subtraction: { attempts: 0, correct: 0 },
        multiplication: { attempts: 0, correct: 0 },
        division: { attempts: 0, correct: 0 },
      },
    },
  };
}
