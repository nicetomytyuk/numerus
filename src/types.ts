export type Screen = 'home' | 'join' | 'username' | 'game';
export type Mode = 'create' | 'join';
export type GameMode = 'offline' | 'online';
export type Difficulty = 'easy' | 'normal' | 'hard';

export type Player = {
  id: string;
  name: string;
  isMe: boolean;
  isBot?: boolean;
  isOwner?: boolean;
  points: number;
  turnOrder?: number;
};

export type Message = {
  id?: number;
  type: 'system' | 'play' | 'error';
  text: string;
  player?: string;
  playerId?: string;
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
