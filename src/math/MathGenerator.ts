import type { MathProblem, MathOperation, DifficultyConfig } from './types';

const DIFFICULTY_CONFIGS: DifficultyConfig[] = [
  { level: 1, operations: ['addition'], maxNumber: 10, maxMultiplier: 5 },
  { level: 2, operations: ['addition', 'subtraction'], maxNumber: 15, maxMultiplier: 5 },
  { level: 3, operations: ['addition', 'subtraction', 'multiplication'], maxNumber: 20, maxMultiplier: 5 },
  { level: 4, operations: ['addition', 'subtraction', 'multiplication', 'division'], maxNumber: 50, maxMultiplier: 10 },
  { level: 5, operations: ['addition', 'subtraction', 'multiplication', 'division'], maxNumber: 100, maxMultiplier: 12 },
];

const OPERATION_SYMBOLS: Record<MathOperation, string> = {
  addition: '+',
  subtraction: '-',
  multiplication: '×',
  division: '÷',
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class MathGenerator {
  private difficultyLevel: number;
  private config: DifficultyConfig;

  constructor(difficultyLevel: number = 1) {
    this.difficultyLevel = Math.min(5, Math.max(1, difficultyLevel));
    this.config = DIFFICULTY_CONFIGS[this.difficultyLevel - 1];
  }

  setDifficulty(level: number): void {
    this.difficultyLevel = Math.min(5, Math.max(1, level));
    this.config = DIFFICULTY_CONFIGS[this.difficultyLevel - 1];
  }

  generate(preferredOperation?: MathOperation): MathProblem {
    const operation = preferredOperation && this.config.operations.includes(preferredOperation)
      ? preferredOperation
      : randomChoice(this.config.operations);

    switch (operation) {
      case 'addition':
        return this.generateAddition();
      case 'subtraction':
        return this.generateSubtraction();
      case 'multiplication':
        return this.generateMultiplication();
      case 'division':
        return this.generateDivision();
      default:
        return this.generateAddition();
    }
  }

  private generateAddition(): MathProblem {
    const operand1 = randomInt(1, this.config.maxNumber);
    const operand2 = randomInt(1, this.config.maxNumber);
    const answer = operand1 + operand2;

    return {
      operand1,
      operand2,
      operation: 'addition',
      answer,
      equation: `${operand1} + ${operand2} = ?`,
    };
  }

  private generateSubtraction(): MathProblem {
    // Ensure positive result by making operand1 >= operand2
    let operand1 = randomInt(1, this.config.maxNumber);
    let operand2 = randomInt(1, this.config.maxNumber);

    if (operand2 > operand1) {
      [operand1, operand2] = [operand2, operand1];
    }

    const answer = operand1 - operand2;

    return {
      operand1,
      operand2,
      operation: 'subtraction',
      answer,
      equation: `${operand1} - ${operand2} = ?`,
    };
  }

  private generateMultiplication(): MathProblem {
    const operand1 = randomInt(1, this.config.maxMultiplier);
    const operand2 = randomInt(1, this.config.maxMultiplier);
    const answer = operand1 * operand2;

    return {
      operand1,
      operand2,
      operation: 'multiplication',
      answer,
      equation: `${operand1} × ${operand2} = ?`,
    };
  }

  private generateDivision(): MathProblem {
    // Generate division that results in whole numbers
    const divisor = randomInt(1, this.config.maxMultiplier);
    const quotient = randomInt(1, this.config.maxMultiplier);
    const dividend = divisor * quotient;

    return {
      operand1: dividend,
      operand2: divisor,
      operation: 'division',
      answer: quotient,
      equation: `${dividend} ÷ ${divisor} = ?`,
    };
  }

  generateWrongAnswers(correctAnswer: number, count: number = 3): number[] {
    const wrongAnswers: Set<number> = new Set();
    const maxAttempts = 100;
    let attempts = 0;

    while (wrongAnswers.size < count && attempts < maxAttempts) {
      attempts++;

      // Generate wrong answers that are close to the correct one
      const offset = randomInt(1, Math.max(5, Math.floor(correctAnswer * 0.3) + 1));
      const sign = Math.random() > 0.5 ? 1 : -1;
      const wrongAnswer = correctAnswer + (offset * sign);

      // Only add positive numbers that aren't the correct answer
      if (wrongAnswer > 0 && wrongAnswer !== correctAnswer) {
        wrongAnswers.add(wrongAnswer);
      }
    }

    // If we couldn't generate enough, add some simple offsets
    let fallbackOffset = 1;
    while (wrongAnswers.size < count) {
      const candidate = correctAnswer + fallbackOffset;
      if (candidate > 0 && candidate !== correctAnswer && !wrongAnswers.has(candidate)) {
        wrongAnswers.add(candidate);
      }
      fallbackOffset = fallbackOffset > 0 ? -fallbackOffset : (-fallbackOffset + 1);
    }

    return Array.from(wrongAnswers);
  }
}

export const mathGenerator = new MathGenerator();
