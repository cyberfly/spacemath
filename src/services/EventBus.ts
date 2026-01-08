// Event bus for communication between Phaser and Alpine.js

export type GameEventType =
  | 'game:start'
  | 'game:pause'
  | 'game:resume'
  | 'game:over'
  | 'game:quit'
  | 'problem:new'
  | 'answer:correct'
  | 'answer:wrong'
  | 'answer:submit'
  | 'evolution:trigger'
  | 'score:update'
  | 'xp:update';

export interface GameEventData {
  'game:start': { mode: 'shoot' | 'type'; difficulty: number };
  'game:pause': void;
  'game:resume': void;
  'game:over': { score: number; correct: number; xpEarned: number; bestStreak: number };
  'game:quit': void;
  'problem:new': { equation: string; answer: number; wrongAnswers?: number[] };
  'answer:correct': { xp: number; streak: number };
  'answer:wrong': void;
  'answer:submit': { answer: number };
  'evolution:trigger': { from: number; to: number };
  'score:update': { score: number; streak: number };
  'xp:update': { xp: number; evolutionStage: number };
}

type EventCallback<T extends GameEventType> = (data: GameEventData[T]) => void;

class EventBusClass {
  private listeners: Map<GameEventType, Set<EventCallback<GameEventType>>> = new Map();

  on<T extends GameEventType>(event: T, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<GameEventType>);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback as EventCallback<GameEventType>);
    };
  }

  emit<T extends GameEventType>(event: T, data: GameEventData[T]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  off<T extends GameEventType>(event: T, callback: EventCallback<T>): void {
    this.listeners.get(event)?.delete(callback as EventCallback<GameEventType>);
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const EventBus = new EventBusClass();
