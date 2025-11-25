import { useEffect, useRef, useState } from 'react';
import { Trophy, Users, Copy, LogOut, Star } from 'lucide-react';
import './App.css';

type Screen = 'home' | 'join' | 'username' | 'game';
type Mode = 'create' | 'join';
type Difficulty = 'easy' | 'normal' | 'hard';

type Player = {
  id: string;
  name: string;
  isMe: boolean;
  isBot?: boolean;
  points: number;
};

type Message = {
  type: 'system' | 'play' | 'error';
  text: string;
  player?: string;
  number?: number;
  correctRoman?: string;
  timestamp: number;
};

type StoredRoom = {
  code: string;
  players: Player[];
  showHints?: boolean;
  difficulty?: Difficulty;
};

const romanKeys = ['I', 'V', 'X', 'L', 'C', 'D', 'M'] as const;
const storageKey = 'numerus-room';
const HARD_MESSAGE_LIFETIME = 1000; // milliseconds before chat messages vanish in hard mode
const HARD_VANISH_DURATION = 600; // fade-out time before removal in hard mode

const isDifficulty = (value: unknown): value is Difficulty =>
  value === 'easy' || value === 'normal' || value === 'hard';

const randomRoomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const convertToRoman = (num: number): string => {
  const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const numerals = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let result = '';

  for (let i = 0; i < values.length; i += 1) {
    while (num >= values[i]) {
      result += numerals[i];
      num -= values[i];
    }
  }
  return result;
};

const readStoredRoom = (): StoredRoom | null => {
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

const writeStoredRoom = (room: StoredRoom | null) => {
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

const App = () => {
  const storedRoomData = readStoredRoom();
  const initialDifficulty =
    storedRoomData?.difficulty ?? (storedRoomData?.showHints ? 'easy' : 'normal');
  const initialHints = storedRoomData?.difficulty
    ? storedRoomData.difficulty === 'easy'
    : (storedRoomData?.showHints ?? false);

  const [screen, setScreen] = useState<Screen>('home');
  const [mode, setMode] = useState<Mode>('create');
  const [roomCode, setRoomCode] = useState('');
  const [pendingCode, setPendingCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [username, setUsername] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const persistRoom = (code: string, playerList: Player[], level: Difficulty) => {
    if (!code) return;
    const snapshot: StoredRoom = {
      code,
      players: playerList,
      showHints: level === 'easy',
      difficulty: level
    };
    writeStoredRoom(snapshot);
    setStoredRoom(snapshot);
  };

  const resetGameState = () => {
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
  };

  const handleCreateGame = () => {
    resetGameState();
    setMode('create');
    setScreen('username');
  };

  const handleJoinGame = () => {
    resetGameState();
    setMode('join');
    setScreen('join');
    setPendingCode('');
  };

  const handleJoinWithCode = () => {
    const normalized = pendingCode.trim().toUpperCase();
    if (normalized.length !== 6) return;

    resetGameState();
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
  };

  const createPlayer = (name: string, isMe: boolean, isBot = false): Player => ({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    isMe,
    isBot,
    points: 0
  });

  const handleSetUsername = () => {
    const trimmed = usernameInput.trim();
    if (!trimmed) return;

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

  const handleAddBot = () => {
    if (!roomCode) return;

    const botNames = ['Samuele', 'Barbie', 'A Cadore', 'Tommy', 'Fra', 'Mela', 'Igor', 'Andrea la Valanga', 'Diana', 'Edo', 'Kledi', 'Martino del Trentino', 'Vince', 'Urcio', 'Vale'];
    const usedNames = new Set(players.map((p) => p.name));
    const availableNames = botNames.filter((name) => !usedNames.has(name));
    if (availableNames.length === 0) return;

    const botName = availableNames[Math.floor(Math.random() * availableNames.length)];
    const newBot = createPlayer(botName, false, true);
    const updatedPlayers = [...players, newBot];
    setPlayers(updatedPlayers);
    persistRoom(roomCode, updatedPlayers, difficulty);
    setMessages((prev) => [
      ...prev,
      { type: 'system', text: `${botName} si unisce come bot.`, timestamp: Date.now() }
    ]);
  };

  const nextIndex = (current: number, list: Player[]) => (list.length === 0 ? 0 : (current + 1) % list.length);

  const handleRomanInput = (letter: (typeof romanKeys)[number]) => {
    if (gameOver || players.length === 0) return;

    const currentPlayer = players[currentPlayerIndex];
    if (!currentPlayer?.isMe) return;

    const targetRoman = convertToRoman(currentNumber);
    const candidate = currentRoman + letter;

    if (!targetRoman.startsWith(candidate)) {
      setGameOver(true);
      setMessages((prev) => [
        ...prev,
        {
          type: 'error',
          text: `${currentPlayer.name} ha perso: combinazione non valida.`,
          number: currentNumber,
          correctRoman: targetRoman,
          timestamp: Date.now()
        }
      ]);
      return;
    }

    setMessages((prev) => [...prev, { type: 'play', player: currentPlayer.name, text: letter, timestamp: Date.now() }]);

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
  };

  useEffect(() => {
    if (players.length === 0) return;
    const currentPlayer = players[currentPlayerIndex];
    if (gameOver || !currentPlayer?.isBot) return;

    const targetRoman = convertToRoman(currentNumber);
    const nextLetter = targetRoman[currentRoman.length];
    if (!nextLetter) return;

    const timer = window.setTimeout(() => {
      const candidate = currentRoman + nextLetter;

      setMessages((prev) => [...prev, { type: 'play', player: currentPlayer.name, text: nextLetter, timestamp: Date.now() }]);

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
  }, [players, currentPlayerIndex, currentNumber, currentRoman, gameOver, roomCode, difficulty]);

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

  const handleRestart = () => {
    if (players.length === 0) return;
    const startIndex = Math.floor(Math.random() * players.length);

    setGameOver(false);
    setMessages([
      {
        type: 'system',
        text: `Nuova partita! Inizia ${players[startIndex].name}.`,
        timestamp: Date.now()
      }
    ]);
    setPlayers((prev) => {
      const next = prev.map((player) => ({ ...player, points: 0 }));
      persistRoom(roomCode, next, difficulty);
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
    resetGameState();
    setRoomCode('');
    writeStoredRoom(null);
    setStoredRoom(null);
    setScreen('home');
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
  const difficultyOptions: { id: Difficulty; label: string; detail: string; stars: number; }[] = [
    { id: 'easy', label: 'Facile', detail: 'Mostra il numero da comporre', stars: 1 },
    { id: 'normal', label: 'Normale', detail: 'Nessun suggerimento', stars: 2 },
    { id: 'hard', label: 'Difficile', detail: 'I messaggi spariscono dopo pochi secondi', stars: 3 }
  ];

  // Home
  if (screen === 'home') {
    return (
      <div className="app-shell home-screen">
        <div className="home-content">
          <p className="eyebrow">Gioco a turni con numeri romani</p>
          <h1>Stanghetta</h1>
          <p className="lede">
            Crea una stanza, condividi il codice, alterna i turni con la tastiera romana e non sbagliare la sequenza.
          </p>
          <div className="cta-row">
            <button className="primary-btn" onClick={handleCreateGame}>
              Gioca
            </button>
            <button className="ghost-btn" onClick={handleJoinGame}>
              Entra in una partita
            </button>
          </div>
          {storedRoom?.code && <p className="hint">Ultima stanza disponibile: {storedRoom.code}</p>}
        </div>
      </div>
    );
  }

  // Join by code
  if (screen === 'join') {
    return (
      <div className="app-shell centered-screen">
        <div className="panel">
          <p className="eyebrow">Entra con codice</p>
          <h2>Inserisci il codice stanza</h2>
          <input
            className="code-input"
            value={pendingCode}
            onChange={(e) => {
              setPendingCode(e.target.value.toUpperCase());
              setJoinError('');
            }}
            placeholder="ABC123"
            maxLength={6}
          />
          {joinError && <div className="error-text">{joinError}</div>}
          <div className="action-row">
            <button className="primary-btn" disabled={pendingCode.trim().length !== 6} onClick={handleJoinWithCode}>
              Entra
            </button>
            <button className="ghost-btn" onClick={() => setScreen('home')}>
              Indietro
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Username entry
  if (screen === 'username') {
    return (
      <div className="app-shell centered-screen">
        <div className="panel">
          <p className="eyebrow">{mode === 'create' ? 'Nuova stanza' : 'Unisciti'}</p>
          <h2>Scegli un nome</h2>
          {mode === 'join' && <div className="code-chip">{roomCode || 'Codice stanza'}</div>}
          <input
            className="text-input"
            placeholder="Il tuo nickname"
            value={usernameInput}
            maxLength={16}
            onChange={(e) => setUsernameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSetUsername()}
          />
          <div className="difficulty-card">
            <div className="difficulty-header">
              <span className="eyebrow">Difficolta</span>
              <div className="difficulty-stars">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Star
                    key={`star-${idx}`}
                    size={18}
                    className={
                      idx < (difficultyOptions.find((opt) => opt.id === difficulty)?.stars || 0)
                        ? 'filled'
                        : ''
                    }
                  />
                ))}
              </div>
            </div>
            <div className="difficulty-options">
              {difficultyOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`difficulty-option ${difficulty === option.id ? 'selected' : ''}`}
                  onClick={() => handleDifficultyChange(option.id)}
                >
                  <div className="option-top">
                    <span className="option-label">{option.label}</span>
                    <div className="option-stars">
                      {Array.from({ length: 3 }).map((_, idx) => (
                        <Star
                          key={`${option.id}-star-${idx}`}
                          size={16}
                          className={idx < option.stars ? 'filled' : ''}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="option-detail">{option.detail}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="action-row">
            <button className="primary-btn" onClick={handleSetUsername} disabled={!usernameInput.trim()}>
              Continua
            </button>
            <button className="ghost-btn" onClick={() => setScreen('home')}>
              Annulla
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Game view
  return (
    <div className="app-shell game-shell">
      <header className="toolbar">
        <div className="toolbar-left">
          <div className="toolbar-item">
            <Trophy size={18} />
            <span>{myPoints} pt</span>
          </div>
          <div className="toolbar-item">
            <Users size={18} />
            <span>{username || 'Tu'}</span>
          </div>
        </div>
        <div className="toolbar-right">
          <button className="pill code nav-btn" onClick={copyRoomCode}>
            <Copy size={16} />
            {copied ? 'Copiato' : roomCode || '---'}
          </button>
          <button className="pill danger nav-btn" onClick={handleExit} aria-label="Esci dalla partita">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="game-body">
        <section className="players-row">
          <div className="players-scroll" >
            <div className="players-list">
              {players.map((player, idx) => (
                <div
                  key={player.id}
                  className={`player-chip ${idx === currentPlayerIndex && !gameOver ? 'active' : ''} ${player.isMe ? 'me' : ''
                    }`}
                >
                  <div className="player-name">{player.name}</div>
                  <div className="player-points">{player.points} pt</div>
                </div>
              ))}
            </div>
          </div>
          {players.length < 8 && (
            <button className="ghost-btn small" onClick={handleAddBot}>
              + Bot
            </button>
          )}
        </section>

        <section className={`chat ${gameOver ? 'chat-danger' : ''}`}>
          {messages.map((msg) => {
            const isVanishing =
              difficulty === 'hard' && now - msg.timestamp >= HARD_MESSAGE_LIFETIME - HARD_VANISH_DURATION;
            return (
              <div key={msg.timestamp + msg.text} className={`chat-row ${isVanishing ? 'vanishing' : ''}`}>
                {msg.type === 'system' && <div className="chat-system">{msg.text}</div>}
                {msg.type === 'play' && (
                  <div className="chat-play">
                    <span className="chat-player">{msg.player}</span>
                    <span className="chat-letter">{msg.text}</span>
                  </div>
                )}
                {msg.type === 'error' && (
                  <div className="chat-error">
                    <div>{msg.text}</div>
                    <div className="chat-error-detail">
                      Numero {msg.number}: corretto {msg.correctRoman}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </section>

        <div className="bottom-panel">
          {!gameOver && showHints && (
            <div className="status-shell">
              <div className="status-card">
                <div className="label">Numero da comporre</div>
                <div className="value">{convertToRoman(currentNumber)}</div>
                <div className="meta">Turno di {activePlayer?.name || '...'}</div>
              </div>
            </div>
          )}

          {gameOver && (
            <div className="gameover-shell">
              <button className="primary-btn full" onClick={handleRestart}>
                Rigioca e scegli chi parte
              </button>
            </div>
          )}

          {!gameOver && (
            <div className="keyboard-shell">
              <div className={`keyboard ${!activePlayer?.isMe ? 'disabled' : ''}`} >
                {romanKeys.map((key) => (
                  <button key={key} className="key-btn" onClick={() => handleRomanInput(key)}>
                    {key}
                  </button>
                ))}
              </div>
              {!activePlayer?.isMe && (
                <div className="keyboard-overlay">
                  Attendi il tuo turno: {activePlayer?.name || '...'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
