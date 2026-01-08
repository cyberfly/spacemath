export type MathOperation = 'addition' | 'subtraction' | 'multiplication' | 'division';

export interface MathProblem {
  operand1: number;
  operand2: number;
  operation: MathOperation;
  answer: number;
  equation: string;
}

export interface DifficultyConfig {
  level: number;
  operations: MathOperation[];
  maxNumber: number;
  maxMultiplier: number;
}
