import { storageKey, isDifficulty } from '../constants';
import type { StoredRoom, Player, Difficulty } from '../types';

const onlineSessionKey = 'numerus-online-session';

export const readStoredRoom = (): StoredRoom | null => {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.code) return null;

    const loadedPlayers: Player[] = Array.isArray(parsed.players)
      ? parsed.players.map((p: Player, idx: number) => ({
        id: typeof p.id === 'string' ? p.id : `p-${idx}`,
        name: typeof p.name === 'string' ? p.name : `Giocatore ${idx + 1}`,
        points: typeof p.points === 'number' ? p.points : 0,
        isMe: false,
        isBot: Boolean(p.isBot)
      }))
      : [];

    const difficulty = isDifficulty(parsed.difficulty) ? parsed.difficulty : undefined;

    return {
      code: String(parsed.code),
      players: loadedPlayers,
      showHints: Boolean(parsed.showHints),
      difficulty
    };
  } catch {
    return null;
  }
};

export type StoredOnlineSession = {
  roomId: string;
  roomCode: string;
  playerId: string;
  username: string;
};

export const readOnlineSession = (): StoredOnlineSession | null => {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(onlineSessionKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.roomId || !parsed?.playerId || !parsed?.username || !parsed?.roomCode) {
      return null;
    }
    return {
      roomId: String(parsed.roomId),
      roomCode: String(parsed.roomCode),
      playerId: String(parsed.playerId),
      username: String(parsed.username)
    };
  } catch {
    return null;
  }
};

export const writeOnlineSession = (session: StoredOnlineSession | null) => {
  if (typeof localStorage === 'undefined') return;
  if (!session) {
    localStorage.removeItem(onlineSessionKey);
    return;
  }
  localStorage.setItem(onlineSessionKey, JSON.stringify(session));
};

export const writeStoredRoom = (room: StoredRoom | null) => {
  if (typeof localStorage === 'undefined') return;
  if (!room) {
    localStorage.removeItem(storageKey);
    return;
  }

  const payload: StoredRoom = {
    code: room.code,
    players: room.players.map((p) => ({
      ...p,
      isMe: false
    })),
    showHints: room.showHints,
    difficulty: room.difficulty
  };

  localStorage.setItem(storageKey, JSON.stringify(payload));
};

export const persistRoomSnapshot = (
  code: string,
  players: Player[],
  difficulty: Difficulty,
  setStored: (value: StoredRoom) => void
) => {
  if (!code) return;
  const snapshot: StoredRoom = {
    code,
    players,
    showHints: difficulty === 'easy',
    difficulty
  };
  writeStoredRoom(snapshot);
  setStored(snapshot);
};
