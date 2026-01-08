export interface EvolutionStage {
  id: number;
  name: string;
  emoji: string;
  xpRequired: number;
}

export const EVOLUTION_STAGES: EvolutionStage[] = [
  { id: 1, name: 'Starter Shuttle', emoji: '🛸', xpRequired: 0 },
  { id: 2, name: 'Scout Rocket', emoji: '🚀', xpRequired: 500 },
  { id: 3, name: 'Orbital Skimmer', emoji: '🛰️', xpRequired: 1500 },
  { id: 4, name: 'Ion Spear', emoji: '☄️', xpRequired: 3500 },
  { id: 5, name: 'Nova Striker', emoji: '✨', xpRequired: 7000 },
  { id: 6, name: 'Starforged Cruiser', emoji: '🌌', xpRequired: 12000 },
  { id: 7, name: 'Celestial Apex', emoji: '⭐', xpRequired: 20000 },
];

export function getEvolutionStage(xp: number): number {
  let stage = 1;
  for (const evolution of EVOLUTION_STAGES) {
    if (xp >= evolution.xpRequired) {
      stage = evolution.id;
    } else {
      break;
    }
  }
  return stage;
}

export function getEvolutionByStage(stage: number): EvolutionStage {
  return EVOLUTION_STAGES.find(e => e.id === stage) || EVOLUTION_STAGES[0];
}

export function getNextEvolution(currentStage: number): EvolutionStage | null {
  const nextStage = currentStage + 1;
  return EVOLUTION_STAGES.find(e => e.id === nextStage) || null;
}

export function getXPToNextEvolution(currentXP: number, currentStage: number): number {
  const next = getNextEvolution(currentStage);
  if (!next) return 0;
  return Math.max(0, next.xpRequired - currentXP);
}

export function getEvolutionProgress(currentXP: number, currentStage: number): number {
  const current = getEvolutionByStage(currentStage);
  const next = getNextEvolution(currentStage);

  if (!next) return 100;

  const xpInCurrentStage = currentXP - current.xpRequired;
  const xpNeededForNext = next.xpRequired - current.xpRequired;

  return Math.min(100, (xpInCurrentStage / xpNeededForNext) * 100);
}
