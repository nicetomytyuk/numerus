import type { Difficulty } from './types';

export const romanKeys = ['I', 'V', 'X', 'L', 'C', 'D', 'M'] as const;
export const storageKey = 'numerus-room';

export const HARD_MESSAGE_LIFETIME = 1000; // milliseconds before chat messages vanish in hard mode
export const HARD_VANISH_DURATION = 600; // fade-out time before removal in hard mode

export const isDifficulty = (value: unknown): value is Difficulty =>
  value === 'easy' || value === 'normal' || value === 'hard';
