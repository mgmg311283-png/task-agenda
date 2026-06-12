export interface Achievement {
  id: string;
  name: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  unlockedAt?: Date;
  progress?: number;
  maxProgress?: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-task',
    name: 'Primer paso',
    description: 'Crear tu primera tarea',
    emoji: '🎯',
    unlocked: false,
  },
  {
    id: 'five-completed',
    name: 'Cinco completadas',
    description: 'Completar 5 tareas',
    emoji: '✅',
    unlocked: false,
    progress: 0,
    maxProgress: 5,
  },
  {
    id: 'ten-completed',
    name: 'Diez completadas',
    description: 'Completar 10 tareas',
    emoji: '🏆',
    unlocked: false,
    progress: 0,
    maxProgress: 10,
  },
  {
    id: 'starred-five',
    name: 'Favoritas',
    description: 'Marcar 5 tareas como favorita',
    emoji: '⭐',
    unlocked: false,
    progress: 0,
    maxProgress: 5,
  },
  {
    id: 'productivity-streak',
    name: 'Racha de productividad',
    description: 'Completar tareas 5 días seguidos',
    emoji: '🔥',
    unlocked: false,
  },
  {
    id: 'speed-demon',
    name: 'Rápido',
    description: 'Completar 10 tareas en un día',
    emoji: '⚡',
    unlocked: false,
  },
];

export function checkAchievements(completedToday: number, totalCompleted: number, starredCount: number): Achievement[] {
  const achievements = [...ACHIEVEMENTS];

  if (totalCompleted > 0) {
    const first = achievements.find(a => a.id === 'first-task');
    if (first) first.unlocked = true;
  }

  const five = achievements.find(a => a.id === 'five-completed');
  if (five && totalCompleted >= 5) {
    five.unlocked = true;
    five.progress = Math.min(totalCompleted, 5);
  } else if (five) {
    five.progress = totalCompleted;
  }

  const ten = achievements.find(a => a.id === 'ten-completed');
  if (ten && totalCompleted >= 10) {
    ten.unlocked = true;
    ten.progress = Math.min(totalCompleted, 10);
  } else if (ten) {
    ten.progress = totalCompleted;
  }

  const starred = achievements.find(a => a.id === 'starred-five');
  if (starred && starredCount >= 5) {
    starred.unlocked = true;
    starred.progress = Math.min(starredCount, 5);
  } else if (starred) {
    starred.progress = starredCount;
  }

  const speedDemon = achievements.find(a => a.id === 'speed-demon');
  if (speedDemon && completedToday >= 10) {
    speedDemon.unlocked = true;
  }

  return achievements;
}
