export type Screen = 'home' | 'join' | 'username' | 'game';
export type Mode = 'create' | 'join';
export type Difficulty = 'easy' | 'normal' | 'hard';

export type Player = {
  id: string;
  name: string;
  isMe: boolean;
  isBot?: boolean;
  points: number;
};

export type Message = {
  type: 'system' | 'play' | 'error';
  text: string;
  player?: string;
  number?: number;
  correctRoman?: string;
  timestamp: number;
};

export type StoredRoom = {
  code: string;
  players: Player[];
  showHints?: boolean;
  difficulty?: Difficulty;
};
