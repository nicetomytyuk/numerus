import { useCallback, useEffect, useRef, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import './App.css';

import type { Difficulty, Mode, Player, Screen, StoredRoom, Message, GameMode } from './types';
import { romanKeys, HARD_MESSAGE_LIFETIME } from './constants';
import { convertToRoman } from './utils/roman';
import { randomRoomCode } from './utils/random';
import {
  readStoredRoom,
  persistRoomSnapshot,
  writeStoredRoom,
  readOnlineSession,
  writeOnlineSession
} from './utils/storage';
import type { StoredOnlineSession } from './utils/storage';
import { createRoom, getRoomByCode, getRoomById, updateRoomState } from './supabase/repositories/rooms';
import { addPlayer, listPlayers, updatePlayerPoints, removePlayer } from './supabase/repositories/players';
import { addMessage as addRemoteMessage, listMessages, clearMessages } from './supabase/repositories/messages';
import { subscribeToPlayers, subscribeToMessages, subscribeToRoom } from './supabase/subscriptions';
import type { PlayerRow, MessageRow, RoomRow } from './supabase/types';
import { supabase } from './supabase/client';
import { createPresenceChannel } from './supabase/presence';
import HomeScreen from './components/HomeScreen';
import JoinScreen from './components/JoinScreen';
import UsernameScreen from './components/UsernameScreen';
import TopBar from './components/TopBar';
import PlayersRow from './components/PlayersRow';
import ChatFeed from './components/ChatFeed';
import StatusCard from './components/StatusCard';
import Keyboard from './components/Keyboard';
import type { DifficultyOption } from './components/DifficultySelector';

const difficultyOptions: DifficultyOption[] = [
  { id: 'easy', label: 'Facile', detail: 'Mostra il numero da comporre', stars: 1 },
  { id: 'normal', label: 'Normale', detail: 'Nessun suggerimento', stars: 2 },
  { id: 'hard', label: 'Difficile', detail: 'I messaggi spariscono dopo pochi secondi', stars: 3 }
];

const createPlayer = (name: string, isMe: boolean, isBot = false): Player => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  name,
  isMe,
  isBot,
  points: 0
});

const nextIndex = (current: number, list: Player[]) =>
  list.length === 0 ? 0 : (current + 1) % list.length;

const mapPlayerRow = (row: PlayerRow, myId: string | null): Player => ({
  id: row.id,
  name: row.name,
  isMe: row.id === myId,
  isBot: row.is_bot,
  points: row.points,
  turnOrder: row.turn_order
});

const mapMessageRow = (row: MessageRow): Message => ({
  id: row.id,
  type: row.type,
  text: row.text,
  player: undefined,
  playerId: row.player_id ?? undefined,
  number: row.number ?? undefined,
  correctRoman: row.correct_roman ?? undefined,
  timestamp: new Date(row.created_at).getTime()
});

const App = () => {
  const storedRoomData = readStoredRoom();
  const initialDifficulty =
    storedRoomData?.difficulty ?? (storedRoomData?.showHints ? 'easy' : 'normal');
  const initialHints = storedRoomData?.difficulty
    ? storedRoomData.difficulty === 'easy'
    : (storedRoomData?.showHints ?? false);

  const navigate = useNavigate();
  const match = useMatch('/game/:roomId');
  const routeRoomId = match?.params?.roomId ?? null;

  const [screen, setScreen] = useState<Screen>(routeRoomId ? 'username' : 'home');
  const [mode, setMode] = useState<Mode>(routeRoomId ? 'join' : 'create');
  const [gameMode, setGameMode] = useState<GameMode>(routeRoomId ? 'online' : 'offline');
  const [roomCode, setRoomCode] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [username, setUsername] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentNumber, setCurrentNumber] = useState(1);
  const [currentRoman, setCurrentRoman] = useState('');
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [storedRoom, setStoredRoom] = useState<StoredRoom | null>(() => storedRoomData);
  const [difficulty, setDifficulty] = useState<Difficulty>(() => initialDifficulty);
  const [showHints, setShowHints] = useState<boolean>(() => initialHints);
  const [now, setNow] = useState(() => Date.now());
  const [onlineLoading, setOnlineLoading] = useState(Boolean(routeRoomId));
  const [onlineError, setOnlineError] = useState('');
  const [onlineSession, setOnlineSession] = useState<StoredOnlineSession | null>(() => readOnlineSession());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const playerChannelRef = useRef<ReturnType<typeof subscribeToPlayers> | null>(null);
  const messageChannelRef = useRef<ReturnType<typeof subscribeToMessages> | null>(null);
  const roomChannelRef = useRef<ReturnType<typeof subscribeToRoom> | null>(null);
  const presenceChannelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  const pendingRemovalRef = useRef<Map<string, number>>(new Map());

  const persistOnlineSessionState = (session: StoredOnlineSession | null) => {
    setOnlineSession(session);
    writeOnlineSession(session);
  };

  const sendMessage = useCallback(async (msg: Message) => {
    if (gameMode === 'online' && roomId) {
      const remote = await addRemoteMessage({
        roomId,
        playerId: msg.playerId ?? (msg.type === 'play' || msg.type === 'error' ? myPlayerId : undefined),
        type: msg.type,
        text: msg.text,
        number: msg.number,
        correctRoman: msg.correctRoman
      });
      if (remote) {
        addLocalMessage(mapMessageRow(remote));
      }
    } else {
      addLocalMessage(msg);
    }
  }, [gameMode, roomId, myPlayerId]);

  const attachRealtime = useCallback((room: RoomRow, myId: string, playerName: string) => {
    playerChannelRef.current?.unsubscribe?.();
    messageChannelRef.current?.unsubscribe?.();
    roomChannelRef.current?.unsubscribe?.();
    presenceChannelRef.current?.unsubscribe?.();

    playerChannelRef.current = subscribeToPlayers(room.id, ({ type, record }) => {
      setPlayers((prev) => {
        const mapped = mapPlayerRow(record, myId);
        if (type === 'DELETE') {
          return prev.filter((p) => p.id !== record.id);
        }
        const exists = prev.find((p) => p.id === record.id);
        if (exists) {
          return prev
            .map((p) => (p.id === record.id ? { ...mapped } : p))
            .sort((a, b) => (a.turnOrder ?? 0) - (b.turnOrder ?? 0));
        }
        return [...prev, mapped].sort((a, b) => (a.turnOrder ?? 0) - (b.turnOrder ?? 0));
      });
    });

    messageChannelRef.current = subscribeToMessages(room.id, ({ type, record }) => {
      setMessages((prev) => {
        if (type === 'DELETE') {
          if (!record.id) return prev;
          return prev.filter((m) => m.id !== record.id);
        }
        const mapped = mapMessageRow(record);
        if (mapped.id && prev.some((m) => m.id === mapped.id)) return prev;
        return [...prev, mapped];
      });
    });

    roomChannelRef.current = subscribeToRoom(room.id, ({ record }) => {
      setCurrentNumber((prev) => {
        if (prev !== record.current_number) {
          setCurrentRoman('');
        }
        return record.current_number;
      });
      setCurrentPlayerIndex(record.current_player_index);
      setGameOver(record.status === 'finished');
      setDifficulty(record.difficulty);
      setShowHints(record.show_hints);
    });

    presenceChannelRef.current = createPresenceChannel(room.id, myId, playerName, {
      onSync: (presentIds) => {
        // Cancel any pending removal for players that are back.
        presentIds.forEach((pid) => {
          const timeoutId = pendingRemovalRef.current.get(pid);
          if (timeoutId) {
            window.clearTimeout(timeoutId);
            pendingRemovalRef.current.delete(pid);
          }
        });
      },
      onLeave: (playersLeaving) => {
        playersLeaving.forEach(({ playerId, name }) => {
          // Grace period before removing: allows a quick reload to rejoin.
          const timeoutId = window.setTimeout(() => {
            pendingRemovalRef.current.delete(playerId);
            void removePlayer(playerId);
            void sendMessage({
              type: 'system',
              text: `${name ?? 'Un giocatore'} ha lasciato la partita.`,
              playerId,
              timestamp: Date.now()
            });
          }, 2000);
          pendingRemovalRef.current.set(playerId, timeoutId);
        });
      }
    });
  }, [sendMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setPlayerNames((prev) => {
      const next = { ...prev };
      players.forEach((p) => {
        if (p.id && !next[p.id]) {
          next[p.id] = p.name;
        }
      });
      return next;
    });
  }, [players]);

  useEffect(() => {
    if (difficulty !== 'hard') return;

    const purgeExpired = () => {
      const cutoff = Date.now() - HARD_MESSAGE_LIFETIME;
      setMessages((prev) => prev.filter((msg) => msg.timestamp >= cutoff));
    };

    purgeExpired();
    const interval = window.setInterval(purgeExpired, 750);
    return () => window.clearInterval(interval);
  }, [difficulty]);

  useEffect(() => {
    if (difficulty !== 'hard' || messages.length === 0) return;
    const interval = window.setInterval(() => setNow(Date.now()), 150);
    return () => window.clearInterval(interval);
  }, [difficulty, messages.length]);

  useEffect(() => {
    if (!routeRoomId) return;
    if (!supabase) {
      setOnlineError('Configurare Supabase per giocare online.');
      navigate('/');
      return;
    }
    if (roomId && myPlayerId && roomId === routeRoomId) return;

    setGameMode('online');
    setMode('join');
    setOnlineLoading(true);
    setOnlineError('');

    void (async () => {
      try {
        const room = await getRoomById(routeRoomId);
        if (!room) throw new Error('Stanza non trovata.');
        const playersInRoom = await listPlayers(room.id);
        const session = onlineSession;
        const stillPresent = session
          && session.roomId === room.id
          && playersInRoom.some((p) => p.id === session.playerId);

        if (session && stillPresent) {
          setMyPlayerId(session.playerId);
          setUsername(session.username);
          await hydrateFromRoom(room, session.playerId);
          attachRealtime(room, session.playerId, session.username);
          setScreen('game');
          return;
        }

        if (session && session.roomId === room.id) {
          persistOnlineSessionState(null);
        }

        setRoomId(room.id);
        setRoomCode(room.code);
        setDifficulty(room.difficulty);
        setShowHints(room.show_hints);
        setCurrentNumber(room.current_number);
        setCurrentPlayerIndex(room.current_player_index);
        setGameOver(room.status === 'finished');
        setScreen('username');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore online inatteso.';
        setOnlineError(message);
        navigate('/');
      } finally {
        setOnlineLoading(false);
      }
    })();
  }, [routeRoomId, roomId, myPlayerId, navigate, onlineSession, attachRealtime]);

  // Remove myself on tab close/navigation for online games
  const persistRoom = (code: string, playerList: Player[], level: Difficulty) => {
    persistRoomSnapshot(code, playerList, level, setStoredRoom);
  };

  const addLocalMessage = (msg: Message) =>
    setMessages((prev) => {
      if (msg.id && prev.some((m) => m.id === msg.id)) return prev;
      if (!msg.id && prev.some((m) => m.type === msg.type && m.text === msg.text && m.timestamp === msg.timestamp)) {
        return prev;
      }
      return [...prev, msg];
    });

  const resetGameState = () => {
    playerChannelRef.current?.unsubscribe?.();
    messageChannelRef.current?.unsubscribe?.();
    roomChannelRef.current?.unsubscribe?.();
    presenceChannelRef.current?.unsubscribe?.();
    pendingRemovalRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    pendingRemovalRef.current.clear();
    playerChannelRef.current = null;
    messageChannelRef.current = null;
    roomChannelRef.current = null;
    presenceChannelRef.current = null;
    setPlayers([]);
    setMessages([]);
    setCurrentNumber(1);
    setCurrentRoman('');
    setCurrentPlayerIndex(0);
    setGameOver(false);
    setUsername('');
    setUsernameInput('');
    setJoinError('');
    setCopied(false);
    setShowHints(false);
    setDifficulty('normal');
    setRoomId(null);
    setMyPlayerId(null);
    setGameMode('offline');
    setOnlineLoading(false);
    setOnlineError('');
    persistOnlineSessionState(null);
  };

  const handleCreateGame = () => {
    resetGameState();
    setMode('create');
    setGameMode('offline');
    setScreen('username');
  };

  const handleCreateOnlineGame = () => {
    resetGameState();
    setMode('create');
    setGameMode('online');
    setScreen('username');
  };

  const handleJoinOnlineGame = () => {
    resetGameState();
    setMode('join');
    setGameMode('online');
    setScreen('join');
    setPendingCode('');
  };

  const handleJoinWithCode = () => {
    const normalized = pendingCode.trim().toUpperCase();
    if (normalized.length !== 6) return;

    const targetMode = gameMode;
    resetGameState();
    setGameMode(targetMode);

    if (targetMode === 'offline') {
      if (storedRoom && storedRoom.code === normalized) {
        const storedDifficulty = storedRoom.difficulty ?? (storedRoom.showHints ? 'easy' : 'normal');
        setRoomCode(normalized);
        setDifficulty(storedDifficulty);
        setShowHints(storedDifficulty === 'easy');
        setPlayers(storedRoom.players.map((p) => ({ ...p, isMe: false })));
        setMessages([
          {
            type: 'system',
            text: `Codice ${normalized} trovato. Inserisci il tuo nome per entrare.`,
            timestamp: Date.now()
          }
        ]);
        setScreen('username');
      } else {
        setJoinError('Nessuna stanza trovata con questo codice.');
      }
    } else {
      setRoomCode(normalized);
      setMode('join');
      setScreen('username');
    }
  };

  const hydrateFromRoom = async (room: RoomRow, myId: string) => {
    const [remotePlayers, remoteMessages] = await Promise.all([
      listPlayers(room.id),
      listMessages(room.id)
    ]);
    setRoomId(room.id);
    setRoomCode(room.code);
    setDifficulty(room.difficulty);
    setShowHints(room.show_hints);
    setCurrentNumber(room.current_number);
    setCurrentPlayerIndex(room.current_player_index);
    setGameOver(room.status === 'finished');
    const sortedPlayers = remotePlayers
      .map((p) => mapPlayerRow(p, myId))
      .sort((a, b) => (a.turnOrder ?? 0) - (b.turnOrder ?? 0));
    setPlayers(sortedPlayers);
    setMessages(remoteMessages.map(mapMessageRow));
  };

  const startOnlineSession = async (playerName: string) => {
    if (!supabase) {
      setOnlineError('Configurare Supabase per giocare online.');
      return;
    }
    setOnlineLoading(true);
    setOnlineError('');
    try {
      if (mode === 'create') {
        const codeToUse = roomCode || randomRoomCode();
        const newRoom = await createRoom({ code: codeToUse, difficulty, showHints: difficulty === 'easy' });
        if (!newRoom) throw new Error('Impossibile creare la stanza online.');
        const myRemote = await addPlayer({
          roomId: newRoom.id,
          name: playerName,
          turnOrder: 0,
          isOwner: true
        });
        if (!myRemote) throw new Error('Impossibile creare il giocatore.');
        setMyPlayerId(myRemote.id);
        setUsername(playerName);
        persistOnlineSessionState({
          roomId: newRoom.id,
          roomCode: newRoom.code,
          playerId: myRemote.id,
          username: playerName
        });
        await hydrateFromRoom(newRoom, myRemote.id);
        attachRealtime(newRoom, myRemote.id, playerName);
        await sendMessage({
          type: 'system',
          text: `${playerName} ha creato la partita.`,
          playerId: myRemote.id,
          timestamp: Date.now()
        });
        navigate(`/game/${newRoom.id}`);
        setMode('create');
        setGameMode('online');
        setScreen('game');
      } else {
        const codeToUse = roomCode || pendingCode;
        if (!codeToUse) throw new Error('Codice stanza mancante.');
        const existingRoom = await getRoomByCode(codeToUse);
        if (!existingRoom) throw new Error('Stanza non trovata.');
        const currentPlayers = await listPlayers(existingRoom.id);
        const myRemote = await addPlayer({
          roomId: existingRoom.id,
          name: playerName,
          turnOrder: currentPlayers.length
        });
        if (!myRemote) throw new Error('Impossibile unirsi alla stanza.');
        setMyPlayerId(myRemote.id);
        setUsername(playerName);
        persistOnlineSessionState({
          roomId: existingRoom.id,
          roomCode: existingRoom.code,
          playerId: myRemote.id,
          username: playerName
        });
        await hydrateFromRoom(existingRoom, myRemote.id);
        attachRealtime(existingRoom, myRemote.id, playerName);
        await sendMessage({
          type: 'system',
          text: `${playerName} è entrato nella partita.`,
          playerId: myRemote.id,
          timestamp: Date.now()
        });
        navigate(`/game/${existingRoom.id}`);
        setMode('join');
        setGameMode('online');
        setScreen('game');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore online inatteso.';
      setOnlineError(message);
    } finally {
      setOnlineLoading(false);
    }
  };

  const handleSetUsername = () => {
    const trimmed = usernameInput.trim();
    if (!trimmed) return;

    if (gameMode === 'online') {
      void startOnlineSession(trimmed);
      return;
    }

    const codeToUse = roomCode || randomRoomCode();
    if (!roomCode) {
      setRoomCode(codeToUse);
    }
    const newPlayer = createPlayer(trimmed, true);
    const updatedPlayers = [...players, newPlayer];
    setUsername(trimmed);
    setPlayers(updatedPlayers);
    setShowHints(difficulty === 'easy');
    persistRoom(codeToUse, updatedPlayers, difficulty);
    setMessages((prev) => [
      ...prev,
      {
        type: 'system',
        text: mode === 'create' ? `${trimmed} ha creato la partita.` : `${trimmed} e entrato nella partita.`,
        timestamp: Date.now()
      }
    ]);
    setCurrentPlayerIndex(updatedPlayers.length === 1 ? 0 : updatedPlayers.length - 1);
    setGameOver(false);
    setCurrentNumber(1);
    setCurrentRoman('');
    setScreen('game');
  };

  const handleAddBot = async () => {
    const botNames = ['Samuele', 'Barbie', 'A Cadore', 'Tommy', 'Fra', 'Mela', 'Igor', 'Andrea la Valanga', 'Diana', 'Edo', 'Kledi', 'Martino del Trentino', 'Vince', 'Urcio', 'Vale'];
    const usedNames = new Set(players.map((p) => p.name));
    const availableNames = botNames.filter((name) => !usedNames.has(name));
    if (availableNames.length === 0) return;

    const botName = availableNames[Math.floor(Math.random() * availableNames.length)];

    if (gameMode === 'online') {
      if (!roomId) return;
      const turnOrder = players.length;
      const botRow = await addPlayer({
        roomId,
        name: botName,
        isBot: true,
        turnOrder
      });
      if (botRow) {
        await sendMessage({
          type: 'system',
          text: `${botName} si unisce come bot.`,
          playerId: botRow.id,
          timestamp: Date.now()
        });
      }
      return;
    }

    if (!roomCode) return;
    const newBot = createPlayer(botName, false, true);
    const updatedPlayers = [...players, newBot];
    setPlayers(updatedPlayers);
    persistRoom(roomCode, updatedPlayers, difficulty);
    void sendMessage({ type: 'system', text: `${botName} si unisce come bot.`, timestamp: Date.now() });
  };

  const handleRomanInput = async (letter: (typeof romanKeys)[number]) => {
    if (gameOver || players.length === 0) return;

    const currentPlayer = players[currentPlayerIndex];
    if (!currentPlayer?.isMe) return;

    const targetRoman = convertToRoman(currentNumber);
    const candidate = currentRoman + letter;

    if (!targetRoman.startsWith(candidate)) {
      const newMessage: Message = {
        type: 'error',
        text: `${currentPlayer.name} ha perso: combinazione non valida.`,
        number: currentNumber,
        correctRoman: targetRoman,
        timestamp: Date.now(),
        playerId: currentPlayer.id
      };
      setGameOver(true);
      await sendMessage(newMessage);
      if (gameMode === 'online' && roomId) {
        await updateRoomState(roomId, { status: 'finished' });
      }
      return;
    }

    const nextPlayerIndexValue = nextIndex(currentPlayerIndex, players);
    const playMessage: Message = {
      type: 'play',
      player: currentPlayer.name,
      playerId: currentPlayer.id,
      text: letter,
      timestamp: Date.now()
    };

    await sendMessage(playMessage);

    if (candidate === targetRoman) {
      if (gameMode === 'offline') {
        setPlayers((prev) => {
          const next = prev.map((player, idx) =>
            idx === currentPlayerIndex ? { ...player, points: player.points + 1 } : player
          );
          persistRoom(roomCode, next, difficulty);
          return next;
        });
        setCurrentNumber((prev) => prev + 1);
        setCurrentRoman('');
        setCurrentPlayerIndex(nextPlayerIndexValue);
      } else if (gameMode === 'online') {
        if (currentPlayer.id) {
          void updatePlayerPoints(currentPlayer.id, currentPlayer.points + 1);
        }
        setCurrentRoman('');
        setCurrentPlayerIndex(nextPlayerIndexValue);
        if (roomId) {
          await updateRoomState(roomId, {
            current_number: currentNumber + 1,
            current_player_index: nextPlayerIndexValue
          });
        }
      }
    } else {
      setCurrentRoman(candidate);
      setCurrentPlayerIndex(nextPlayerIndexValue);
      if (gameMode === 'online' && roomId) {
        await updateRoomState(roomId, {
          current_number: currentNumber,
          current_player_index: nextPlayerIndexValue
        });
      }
    }
  };

  useEffect(() => {
    if (players.length === 0 || gameMode === 'online') return;
    const currentPlayer = players[currentPlayerIndex];
    if (gameOver || !currentPlayer?.isBot) return;

    const targetRoman = convertToRoman(currentNumber);
    const nextLetter = targetRoman[currentRoman.length];
    if (!nextLetter) return;

    const timer = window.setTimeout(() => {
      const candidate = currentRoman + nextLetter;

      addLocalMessage({
        type: 'play',
        player: currentPlayer.name,
        playerId: currentPlayer.id,
        text: nextLetter,
        timestamp: Date.now()
      });

      if (candidate === targetRoman) {
        setPlayers((prev) => {
          const next = prev.map((player, idx) =>
            idx === currentPlayerIndex ? { ...player, points: player.points + 1 } : player
          );
          persistRoom(roomCode, next, difficulty);
          return next;
        });
        setCurrentNumber((prev) => prev + 1);
        setCurrentRoman('');
      } else {
        setCurrentRoman(candidate);
      }

      setCurrentPlayerIndex((prev) => nextIndex(prev, players));
    }, 650);

    return () => window.clearTimeout(timer);
  }, [players, currentPlayerIndex, currentNumber, currentRoman, gameOver, roomCode, difficulty, gameMode]);

  const handleRestart = async () => {
    if (players.length === 0) return;
    const startIndex = Math.floor(Math.random() * players.length);

    setGameOver(false);
    const restartMessage: Message = {
      type: 'system',
      text: `Nuova partita! Inizia ${players[startIndex].name}.`,
      timestamp: Date.now()
    };

    if (gameMode === 'online' && roomId) {
      await clearMessages(roomId);
      setMessages([]);
      await sendMessage(restartMessage);
    } else {
      setMessages([restartMessage]);
    }

    setPlayers((prev) => {
      const next = prev.map((player) => ({ ...player, points: 0 }));
      if (gameMode === 'offline') {
        persistRoom(roomCode, next, difficulty);
      } else {
        next.forEach((player) => {
          void updatePlayerPoints(player.id, 0);
        });
        if (roomId) {
          void updateRoomState(roomId, {
            current_number: 1,
            current_player_index: startIndex,
            status: 'active'
          });
        }
      }
      return next;
    });
    setCurrentNumber(1);
    setCurrentRoman('');
    setCurrentPlayerIndex(startIndex);
  };

  const copyRoomCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleExit = () => {
    if (gameMode === 'online' && myPlayerId) {
      void removePlayer(myPlayerId);
    }
    persistOnlineSessionState(null);
    resetGameState();
    setRoomCode('');
    writeStoredRoom(null);
    setStoredRoom(null);
    setScreen('home');
    navigate('/');
  };

  const handleDifficultyChange = (value: Difficulty) => {
    setDifficulty(value);
    setShowHints(value === 'easy');
    if (roomCode) {
      persistRoom(roomCode, players, value);
    }
  };

  const activePlayer = players[currentPlayerIndex];
  const myPoints = players.find((p) => p.isMe)?.points ?? 0;
  const isRouteLoading = Boolean(routeRoomId && onlineLoading);

  if (isRouteLoading) {
    return (
      <div className="app-shell game-shell">
        <TopBar
          myPoints={myPoints}
          username={username}
          roomCode={roomCode}
          copied={copied}
          onCopy={copyRoomCode}
          onExit={handleExit}
          showRoomCode={false}
        />
        <div className="game-body" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--muted)' }}>Riconnessione alla partita...</p>
        </div>
      </div>
    );
  }

  if (screen === 'home') {
    return (
      <HomeScreen
        storedRoom={storedRoom}
        onCreateOnline={handleCreateOnlineGame}
        onJoinOnline={handleJoinOnlineGame}
        onCreateOffline={handleCreateGame}
        onlineEnabled={Boolean(supabase)}
      />
    );
  }

  if (screen === 'join') {
    return (
      <JoinScreen
        pendingCode={pendingCode}
        joinError={joinError}
        onPendingChange={(value) => {
          setPendingCode(value);
          setJoinError('');
        }}
        onSubmit={handleJoinWithCode}
        onBack={() => setScreen('home')}
      />
    );
  }

  if (screen === 'username') {
    return (
      <UsernameScreen
        mode={mode}
        roomCode={roomCode}
        usernameInput={usernameInput}
        difficulty={difficulty}
        difficultyOptions={difficultyOptions}
        onUsernameChange={setUsernameInput}
        onSubmit={handleSetUsername}
        onCancel={() => setScreen('home')}
        onDifficultyChange={handleDifficultyChange}
        error={onlineError}
        loading={onlineLoading}
        showDifficulty={mode === 'create'}
        showRoomCode={mode === 'create'}
      />
    );
  }

  return (
    <div className="app-shell game-shell">
      <TopBar
        myPoints={myPoints}
        username={username}
        roomCode={roomCode}
        copied={copied}
        onCopy={copyRoomCode}
        onExit={handleExit}
        showRoomCode={gameMode === 'online'}
      />

      <div className="game-body">
        <PlayersRow
          players={players}
          currentPlayerIndex={currentPlayerIndex}
          gameOver={gameOver}
          onAddBot={handleAddBot}
          canAddBot={gameMode === 'offline'}
        />

        <ChatFeed
          messages={messages}
          gameOver={gameOver}
          difficulty={difficulty}
          now={now}
          players={players}
          playerNames={playerNames}
          endRef={messagesEndRef}
        />

        <div className="bottom-panel">
          {!gameOver && showHints && (
            <StatusCard
              numberLabel="Numero da comporre"
              value={convertToRoman(currentNumber)}
              meta={`Turno di ${activePlayer?.name || '...'}`}
            />
          )}

          {gameOver && (
            <div className="gameover-shell">
              <button className="primary-btn full" onClick={handleRestart}>
                Rigioca e scegli chi parte
              </button>
            </div>
          )}

          {!gameOver && (
            <Keyboard
              keys={romanKeys}
              disabled={
                !activePlayer?.isMe
                || (gameMode === 'online' && players.length < 2)
              }
              activePlayerName={activePlayer?.name}
              overlayLabel={
                gameMode === 'online' && players.length < 2
                  ? 'In attesa di altri giocatori...'
                  : activePlayer?.name
                    ? `È il turno di ${activePlayer.name}`
                    : 'In attesa di altri giocatori...'
              }
              onKeyPress={(key) => handleRomanInput(key as (typeof romanKeys)[number])}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
